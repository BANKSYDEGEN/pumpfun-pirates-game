// [scale] BANKSY t2494u "continue the scaling" — Fix 3: drop the two global advisory locks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MIG = 'supabase/migrations/20261114180000_scale_shard_locks.sql';

test('shard-lock migration exists and replaces both cores + wrappers', () => {
  const names = readdirSync(new URL('../supabase/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(names.includes('20261114180000_scale_shard_locks.sql'));
  const m = src(MIG);
  assert.match(m, /create or replace function public\.pvp_harbor_core/);
  assert.match(m, /create or replace function public\.pvp_lobby_core/);
  assert.match(m, /create or replace function public\.pvp_harbor\(/);
  assert.match(m, /create or replace function public\.pvp_lobby\(/);
});

test('global hashtext(\'pvp_harbor\') / hashtext(\'pvp_lobby\') keys are gone; budget + per-prefix keys replace them', () => {
  const m = src(MIG);
  const locks = [...m.matchAll(/pg_(?:try_)?advisory_xact_lock\(hashtext\('([^']+)'/g)].map((x) => x[1]);
  assert.ok(!locks.includes('pvp_harbor'), 'no process-wide harbor lock: ' + locks);
  assert.ok(!locks.includes('pvp_lobby'), 'no process-wide lobby lock: ' + locks);
  assert.ok(locks.includes('pvp_harbor_budget'));
  assert.ok(locks.includes('pvp_lobby_budget'));
  assert.ok(locks.includes('pvp_harbor_gc'));
  assert.ok(locks.includes('pvp_lobby_gc'));
  assert.match(m, /hashtext\('pvp_harbor_budget'\)/);
  assert.match(m, /hashtext\('pvp_harbor:' \|\| p_prefix\)/);
  assert.match(m, /hashtext\('pvp_lobby_budget'\)/);
  assert.match(m, /hashtext\('pvp_lobby:' \|\| p_prefix\)/);
  assert.match(m, /pg_try_advisory_xact_lock\(hashtext\('pvp_harbor_gc'\)\)/);
  assert.match(m, /pg_try_advisory_xact_lock\(hashtext\('pvp_lobby_gc'\)\)/);
});

test('peek and seatless lobby poll are lock-free reads; heartbeats skip the budget lock', () => {
  const m = src(MIG);
  assert.match(m, /if p_op = 'peek' then\s+return pvp_harbor_view/s);
  assert.match(m, /if p_op = 'poll' then[\s\S]*if not found then\s+return pvp_lobby_snapshot/);
  assert.match(m, /if p_op = 'peek' then\s+return pvp_harbor_core/s);
  assert.match(m, /if p_op = 'poll' and not exists \(select 1 from pvp_seats where seat = p_seat\)/);
  // an existing-seat harbor beat returns the view after a try-gc, without taking the budget lock first
  assert.match(m, /if r\.seat is not null then\s+if random\(\) < 0\.05 then perform pvp_harbor_gc\(\); end if;\s+return pvp_harbor_view/s);
});

test('caps, budgets and seating rules from 050 / 051 are unchanged', () => {
  const m = src(MIG);
  assert.match(m, /harbor_max constant numeric := 80/);
  assert.match(m, /total_max constant numeric := 95/);
  assert.match(m, /max_copies constant int := 60/);
  assert.match(m, /when p_prefix = 'pfp-harbor' then 8/);
  assert.match(m, /when p_prefix = 'pfp-pvp-v1' then 8 when p_prefix = 'pfp-pvp-v1sq' then 4/);
  assert.match(m, /budget constant numeric := 80/);
  assert.match(m, /max_queue constant int := 100/);
  assert.match(m, /seen < now\(\) - interval '20 seconds'/);
});
