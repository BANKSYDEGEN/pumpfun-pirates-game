// [scale-rl] BANKSY t2506u: cheaper pvp_rl (UNLOGGED + try-lock GC). Limits unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MIG = 'supabase/migrations/20261114230000_pvp_rl_unlogged.sql';

test('pvp_rl becomes UNLOGGED; GC uses a try-lock; over-cap rows stop incrementing', () => {
  const names = readdirSync(new URL('../supabase/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(names.includes('20261114230000_pvp_rl_unlogged.sql'));
  const m = src(MIG);
  assert.match(m, /alter table public\.pvp_rl set unlogged/i);
  assert.match(m, /pg_try_advisory_xact_lock\(hashtext\('pvp_rl_gc'\)\)/);
  assert.doesNotMatch(m, /random\(\) < 0\.002/);
  assert.match(m, /where pvp_rl\.n <= mx/);
  assert.match(m, /return c <= mx/);
  // rollback note for a plan upgrade / crash-recovery preference
  assert.match(m, /alter table public\.pvp_rl set logged/);
  // the previous function body (logged table + 0.2 % GC) stays in 028 for history
  const old = src('supabase/migrations/028_security_core.sql');
  assert.match(old, /create table if not exists public\.pvp_rl/);
  assert.match(old, /if random\(\) < 0\.002 then delete from pvp_rl/);
});
