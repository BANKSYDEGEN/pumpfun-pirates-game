// [v356 friends] node --test tests/friends.test.mjs — BANKSY t1851u: add friends, friends list, join their server
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { myAt, whereLabel, joinPlan, pickAutoJoin, cleanName, FR_POLL_BG_MS, FR_POLL_OPEN_MS } from '../js/friends.js';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const F = (o) => ({ n: 'Anne', on: true, w: 'harbor', copy: 2, code: '', room_n: 3, cap: 8, full: false, ...o });

test('myAt: harbor server / arena / queue / spectate / menus', () => {
  const pv = (o) => ({ active: true, where: 'harbor', mode: 'solo', lob: { state: 'harbor' }, harborInfo: () => ({ prefix: 'pfp-harbor', copy: 4 }), ...o });
  const g = { mode: 'pvp', state: 'playing' };
  assert.deepEqual(myAt(pv(), g), { w: 'harbor', prefix: 'pfp-harbor', copy: 4 });
  assert.deepEqual(myAt(pv({ harborInfo: () => ({ prefix: 'pfp-harbor-k7p9q', copy: 1 }) }), g), { w: 'harbor', prefix: 'pfp-harbor-k7p9q', copy: 1 });
  assert.deepEqual(myAt(pv({ where: 'arena', mode: 'squads' }), g), { w: 'arena', mode: 'squads' });
  assert.deepEqual(myAt(pv({ lob: { state: 'queue' } }), g), { w: 'queue', mode: 'solo' });
  assert.deepEqual(myAt(pv({ where: 'spec' }), g), { w: 'spec', mode: 'solo' });
  assert.deepEqual(myAt(pv(), { mode: 'waves', state: 'playing' }), { w: 'solo' });
  assert.deepEqual(myAt(pv({ active: false }), g), { w: 'solo' });
  assert.deepEqual(myAt(null, g), { w: 'solo' });
});

test('whereLabel: harbor # + headcount, own code, arena modes, offline', () => {
  assert.equal(whereLabel(F()), 'HARBOR #2 · 3/8');
  assert.equal(whereLabel(F({ code: 'K7P9Q', copy: 1, room_n: 1 })), 'OWN SERVER · K7P9Q · 1/8');
  assert.equal(whereLabel(F({ w: 'arena', mode: 'squads' })), 'SQUADS ARENA');
  assert.equal(whereLabel(F({ w: 'queue', mode: 'solo' })), 'SOLO QUEUE');
  assert.equal(whereLabel(F({ w: 'spec' })), 'SPECTATING');
  assert.equal(whereLabel(F({ w: 'solo' })), 'ONLINE · STORM HUNT / MENUS');
  assert.equal(whereLabel(F({ on: false })), 'OFFLINE');
});

test('joinPlan: public copy, own code (with copy), full, already there, arena queues, spectate / menus explain why', () => {
  assert.deepEqual(joinPlan(F()), { ok: true, kind: 'harbor', label: 'HARBOR #2', server: { kind: 'pick', arg: 2, copy: 2 } });
  assert.deepEqual(joinPlan(F({ code: 'K7P9Q', copy: 2 })).server, { kind: 'own', arg: 'K7P9Q', copy: 2 });
  const full = joinPlan(F({ room_n: 8, full: true })); assert.equal(full.ok, false); assert.equal(full.full, true); assert.match(full.why, /full \(8\/8\)/);
  const here = joinPlan(F(), { w: 'harbor', prefix: 'pfp-harbor', copy: 2 }); assert.equal(here.ok, false); assert.equal(here.here, true);
  assert.equal(joinPlan(F(), { w: 'harbor', prefix: 'pfp-harbor-abc', copy: 2 }).ok, true); // same copy number, different server
  assert.deepEqual(joinPlan(F({ w: 'arena', mode: 'squads' })), { ok: true, kind: 'arena', mode: 'squads', label: 'SQUADS QUEUE' });
  assert.match(joinPlan(F({ w: 'spec' })).why, /spectating/);
  assert.match(joinPlan(F({ w: 'solo' })).why, /Storm Hunt/);
  assert.equal(joinPlan(F({ on: false })).ok, false);
  assert.equal(joinPlan(F({ copy: 0 })).ok, false);
  assert.equal(joinPlan(null).ok, false);
});

test('pickAutoJoin: busiest joinable friend harbor; none when full / offline / arena / already with a friend', () => {
  const list = [F({ n: 'A', copy: 1, room_n: 2 }), F({ n: 'B', copy: 3, room_n: 5 }), F({ n: 'C', copy: 4, room_n: 8, full: true }), F({ n: 'D', w: 'arena' }), F({ n: 'E', on: false })];
  assert.equal(pickAutoJoin(list).n, 'B');
  assert.equal(pickAutoJoin([list[2], list[3], list[4]]), null);
  assert.equal(pickAutoJoin(list, { w: 'harbor', prefix: 'pfp-harbor', copy: 1 }), null);
  assert.equal(pickAutoJoin([]), null);
});

test('cleanName strips markup + caps at 20', () => {
  assert.equal(cleanName('  <b>Jack</b> "Sparrow" the Magnificent '), 'bJack/b Sparrow the ');
  assert.ok(FR_POLL_BG_MS >= 20000 && FR_POLL_OPEN_MS >= 5000); // Free-tier friendly heartbeat
});

test('wiring: settings FRIENDS button, picker FRIENDS ONLINE, Squad Hall + KotH add, pad layer, pvp joinFriend', () => {
  const html = src('index.html'), dock = src('js/dock/index.js'), sp = src('js/serverPicker.js'), pvp = src('js/pvp.js'), pad = src('js/gamepad.js'), sq = src('js/dock/squadHall.js'), pz = src('js/dock/plaza.js');
  assert.match(html, /id="btn-friends"[^>]*data-fr-open[^>]*hidden/);
  assert.match(dock, /createFriends\(/); assert.match(dock, /friends\.tick\(/); assert.match(dock, /setFriends\(/); assert.match(dock, /window\.PFP_FRIENDS = Object\.freeze/);
  assert.match(sp, /FRIENDS ONLINE/); assert.match(sp, /data-fjoin/); assert.match(sp, /setFriends:/);
  assert.match(pvp, /async function joinFriend\(p\)/); assert.match(pvp, /joinWorld, joinFriend,/); assert.match(pvp, /return switchServer\(plan\)/);
  assert.match(pad, /LAYERS = \['#ctl-ov', '#fr-panel'/);
  assert.match(sq, /\+ FRIEND/); assert.match(pz, /pz-fr/);
  assert.match(src('js/preloadList.js'), /"js\/friends\.js"/);
});

test('friends panel: names escaped, B/Esc closes, controller hints, safe areas + short landscape', () => {
  const f = src('js/friends.js');
  assert.match(f, /import \{ escHtml as esc \} from '\.\/safe\.js'/);
  assert.doesNotMatch(f, /\$\{(?:n|f\.n|p\.n|r\.name)\}/); // every network name goes through esc()
  assert.match(f, /e\.key === 'Escape' \|\| e\.code === 'Escape'/); assert.match(f, /data-x aria-label="Close friends"/);
  assert.match(f, /L1\/R1 tabs/); assert.match(f, /LB\/RB tabs/); assert.match(f, /role="tab"/);
  assert.match(f, /safe-area-inset-top/); assert.match(f, /@media \(max-height:520px\)/); assert.match(f, /@media \(max-width:420px\)/);
});

test('migration 054: additive, RLS on, service-role only, rate limits + caps, no spoofing (player id from the Edge Function)', () => {
  const sql = src('supabase/migrations/054_friends.sql');
  for (const t of ['pvp_friend_reqs', 'pvp_friends', 'pvp_friend_presence']) { assert.match(sql, new RegExp(`create table if not exists public\\.${t}`)); assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`)); }
  assert.match(sql, /revoke all on public\.pvp_friend_reqs, public\.pvp_friends, public\.pvp_friend_presence from anon, authenticated/);
  assert.match(sql, /revoke all on function public\.pvp_friend_op\(text, text, text, boolean\) from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.pvp_friend_seen\(text, text, text, int, text\) from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant execute/i); assert.doesNotMatch(sql, /\b(drop|alter) (table|function) (if exists )?public\.(?!pvp_friend)/i);
  assert.match(sql, /max_friends constant int := 100; max_out constant int := 30; max_in constant int := 50/);
  assert.match(sql, /check \(a < b\)/);
  const ts = src('supabase/functions/pvp/friends.ts'), idx = src('supabase/functions/pvp/index.ts');
  assert.match(ts, /p_player: who\.pid/); assert.match(ts, /pvp_rl_hit/);
  assert.match(idx, /FRIEND_ACTIONS\.includes\(String\(b\.action\) as any\)\) return await friendAction\(\{ db, whoAmI, json \}/);
});

test('createFriends (no DOM): heartbeat sends where I am; AUTO-JOIN joins the busiest friend server once; request/accept/remove go to the server by name', async () => {
  const store = { pfp_fr_autojoin: '1' }; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  const { createFriends } = await import('../js/friends.js');
  const calls = [], joins = [], toasts = [];
  const list = { ok: true, me: 'Me', friends: [F({ n: 'A', copy: 3, room_n: 2 }), F({ n: 'B', copy: 5, room_n: 6 })], incoming: ['Zed'], outgoing: [] };
  const fr = createFriends({ call: async (a, b) => { calls.push([a, b]); return a === 'fr_list' ? list : { ok: true, state: a === 'fr_request' ? 'sent' : 'none', name: b.name }; },
    at: () => ({ w: 'harbor', prefix: 'pfp-harbor', copy: 1 }), join: async (p) => { joins.push(p); return { ok: true }; }, toast: (m) => toasts.push(m) });
  fr.tick(1e6); await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(calls[0], ['fr_list', { at: { w: 'harbor', prefix: 'pfp-harbor', copy: 1 }, name: '' }]);
  assert.equal(joins.length, 1); assert.deepEqual(joins[0].server, { kind: 'pick', arg: 5, copy: 5 }); // B: busier, not full
  fr.tick(1e6 + 5000); await new Promise((r) => setTimeout(r, 20)); assert.equal(joins.length, 1); // once per session
  assert.equal(fr.relationOf('a'), 'friend'); assert.equal(fr.relationOf('zed'), 'incoming'); assert.equal(fr.relationOf('nobody'), '');
  await fr.request('<b>Cal</b>'); assert.deepEqual(calls.find((c) => c[0] === 'fr_request'), ['fr_request', { name: 'bCal/b' }]);
  delete globalThis.localStorage;
});
