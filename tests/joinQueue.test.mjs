// [join-queue] BANKSY t2505u: extend the v577 SEAS ARE CROWDED gate (no second card).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGate, lineOf, GATE_TEXT } from '../js/netGate.js';
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('one config value: world_cap default 120 (under Free Realtime 200), stale 135 s, owner bypass', () => {
  const jq = src('js/joinQueue.js');
  assert.match(jq, /export const WORLD_CAP_DEFAULT = 120/);
  assert.match(jq, /export const JOIN_STALE_S = 135/);
  const sql = src('supabase/migrations/20261114220000_join_queue.sql');
  assert.match(sql, /world_cap int not null default 120/);
  assert.match(sql, /pvp_scale_config/);
  assert.match(sql, /interval '135 seconds'/);
  assert.match(sql, /coalesce\(p_owner, false\)/);
  assert.match(sql, /pg_try_advisory_xact_lock\(hashtext\('pvp_join_gate_gc'\)\)/);
  assert.match(sql, /pg_try_advisory_xact_lock\(hashtext\('pvp_join_gate_admit'\)\)/);
  assert.doesNotMatch(sql, /pg_advisory_xact_lock\(hashtext\('pvp_join_gate'\)\)/, 'poll must not take a blocking global lock');
  const js = src('js/joinQueue.js');
  assert.match(js, /tabHidden\(\)/);
  assert.match(js, /burstMs/);
  assert.match(js, /source === 'join'|fail\('join'/);
  assert.match(js, /solo: false/);
});

test('lineOf: place in line from the server only; no invented wait time', () => {
  assert.equal(lineOf({ pos: 3, cap: 120, in_world: 120 }), "You're #3 in line (120/120 sailors in the world)");
  assert.equal(lineOf({ pos: 1, cap: 120, in_world: 119 }), "You're next in line (119/120 sailors in the world)");
  assert.equal(lineOf({ pos: 0, cap: 120, in_world: 50 }), '');
  assert.equal(lineOf({ pos: 2, cap: 0 }), '');
  assert.equal(lineOf(null), '');
  assert.doesNotMatch(lineOf({ pos: 4, cap: 120, in_world: 120 }), /minute|eta|~|about/i);
});

test('createGate passes place-in-line + hides solo for the title join source', () => {
  let t = 1000; const shown = [];
  const ui = { show: (v) => shown.push(v), hide: () => shown.push({ hide: true }) };
  const g = createGate({ clock: () => t, rnd: () => 0.5, ui });
  g.fail('join', { full: true, pos: 2, cap: 120, in_world: 120, ahead: 1, queue: 4, solo: false });
  const v = shown.at(-1);
  assert.equal(v.reason, 'full');
  assert.equal(v.source, 'join');
  assert.equal(v.pos, 2);
  assert.equal(v.cap, 120);
  assert.equal(v.in_world, 120);
  assert.equal(v.solo, false);
  assert.equal(GATE_TEXT.full.title, 'SEAS ARE CROWDED');
  g.ok('join');
  assert.deepEqual(shown.at(-1), { hide: true });
});

test('wiring: same card, startPvp waits on the title, pulse refreshes the lease, edge action, sw + cache', () => {
  const main = src('js/main.js');
  assert.match(main, /import \{ requestJoin, cancelJoin \} from '\.\/joinQueue\.js'/);
  assert.match(main, /requestJoin\(\{ spectate: watch, enter: \(w\) => startPvpEnter\(w\) \}\)/);
  assert.match(main, /if \(admitted !== 'enter'\) return;/);
  assert.match(main, /cancelJoin\(\);/);
  const save = src('js/pvpSave.js');
  assert.match(save, /export async function joinGate/);
  assert.match(save, /POLL_ACTIONS = new Set\(\[[^\]]*'join_gate'/);
  const idx = src('supabase/functions/pvp/index.ts');
  assert.match(idx, /joinGateAction/);
  assert.match(idx, /String\(b\.action\) === "join_gate"/);
  const pulse = src('supabase/functions/pvp/pulse.ts');
  assert.match(pulse, /pvp_join_gate/);
  assert.match(pulse, /p_op: "beat"/);
  const ng = src('js/netGate.js');
  assert.match(ng, /for \(const k of \['harbor', 'lobby', 'api', 'join'\]\)/);
  assert.match(ng, /sc-pos/);
  assert.match(ng, /The world is at capacity right now/);
  const sw = src('sw.js');
  assert.match(sw, /const VERSION = 'pfp-v\d+'/);
  assert.match(sw, /"\.\/js\/joinQueue\.js"/);
  assert.match(src('css/style.css'), /#seas-crowded \.sc-pos/);
});
