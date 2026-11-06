// node --test tests/adminMenu.test.mjs
// [admin-menu] BANKSY's owner-only Admin Menu: server 403s for non-owners, owner pockets / freeze, client unlock rules (settings-only button,
// no HUD button, ?banksy=1 never on the live hosts), NOCLIP / GOD / INVISIBLE / FREEZE hooks, ESP + jump-to-player math.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const SRC = R('js/adminMenu.js'), STATE = R('js/adminState.js'), PVP = R('js/pvp.js'), MAIN = R('js/main.js'), WALK = R('js/onfoot/walker.js'), BATTLE = R('js/onfoot/battle.js');
const DOCK = R('js/dock/index.js'), IDX = R('supabase/functions/pvp/index.ts'), ATS = R('supabase/functions/pvp/admin.ts'), SQL = R('supabase/migrations/045_admin_controls.sql'), SW = R('sw.js'), HTML = R('index.html');
const A = await import('../supabase/functions/pvp/admin.ts');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OWNER = 'dev:e191a32e15abea4f14355121', VICTIM = 'dev:0123456789abcdef01234567';

// ---------- an in-memory stand-in for the service-role client (only what admin.ts touches) ----------
function fakeDb() {
  const T = { pvp_inv: [], pvp_maps: [], pvp_inv_equip: [], pvp_inv_owner_pot: [], pvp_dev_profiles: [], pvp_profiles: [], pvp_admin_presence: [], pvp_admin_controls: [], pvp_harbor_seats: [], pvp_seats: [], pvp_net: [], pvp_inv_log: [] };
  const q = (t) => { let rows = T[t]; const f = []; const api = {
    select() { return api; }, eq(k, v) { f.push(r => r[k] === v); return api; }, is(k, v) { f.push(r => (r[k] ?? null) === v); return api; }, gt(k, v) { f.push(r => String(r[k]) > String(v)); return api; },
    in(k, a) { f.push(r => a.includes(r[k])); return api; }, limit() { return api; }, order() { return api; },
    then(res) { return Promise.resolve({ data: rows.filter(r => f.every(g => g(r))), error: null }).then(res); },
    async maybeSingle() { return { data: rows.filter(r => f.every(g => g(r)))[0] ?? null, error: null }; },
    async upsert(row, o) { const k = o?.onConflict; const i = T[t].findIndex(r => r[k] === row[k]); i >= 0 ? T[t][i] = { ...T[t][i], ...row } : T[t].push({ ...row }); return { error: null }; } }; return api; };
  const add = (pid, item, qty, source = 'gift') => { const r = T.pvp_inv.find(x => x.player_id === pid && x.item === item && x.source === source); r ? r.qty += qty : T.pvp_inv.push({ player_id: pid, item, source, qty }); };
  const pot = (pid, d) => { const r = T.pvp_inv_owner_pot.find(x => x.player_id === pid); r ? r.gold += d : T.pvp_inv_owner_pot.push({ player_id: pid, gold: d }); return (r || T.pvp_inv_owner_pot.at(-1)).gold; };
  const rpc = async (fn, a) => {
    if (fn === 'pvp_admin_pocket_take') { if (a.p_owner !== OWNER) return { data: { ok: false, why: 'owner only' } };
      const rows = T.pvp_inv.filter(r => r.player_id === a.p_target && r.item === a.p_item), have = rows.reduce((s, r) => s + r.qty, 0); if (!have) return { data: { ok: false, why: 'not there' } };
      let need = a.p_qty > 0 ? Math.min(a.p_qty, have) : have; const k = need;
      for (const r of rows) { const n = Math.min(need, r.qty); r.qty -= n; need -= n; } T.pvp_inv = T.pvp_inv.filter(r => r.qty > 0); add(OWNER, a.p_item, k);
      return { data: { ok: true, item: a.p_item, qty: k, left: have - k } }; }
    if (fn === 'pvp_admin_pocket_give') { if (a.p_owner !== OWNER) return { data: { ok: false } }; add(a.p_target, a.p_item, Math.max(1, Math.min(99, a.p_qty))); return { data: { ok: true } }; }
    if (fn === 'pvp_admin_gold') { if (a.p_owner !== OWNER) return { data: { ok: false } }; const p = pot(a.p_target, a.p_delta); if (a.p_delta < 0) pot(OWNER, -a.p_delta); return { data: { ok: true, pot: p } }; }
    if (fn === 'pvp_admin_register') { const b = T.pvp_net.find(r => r.net_id === a.p_net) || T.pvp_admin_presence.find(r => r.net_id === a.p_net);
      if (b && (b.player_id || b.pid) !== a.p_pid) return { data: { ok: false, why: 'not yours' } };
      const i = T.pvp_admin_presence.findIndex(r => r.net_id === a.p_net), row = { net_id: a.p_net, pid: a.p_pid, name: a.p_name, room: a.p_room, mode: a.p_mode, x: a.p_x, y: a.p_y, z: a.p_z, updated_at: new Date().toISOString() };
      i >= 0 ? T.pvp_admin_presence[i] = row : T.pvp_admin_presence.push(row); return { data: { ok: true } }; }
    return { data: null, error: { message: 'no fn ' + fn } };
  };
  return { T, from: q, rpc, add };
}
const res = async (r) => ({ status: r.status, body: await r.json() });
const json = (s, b) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const ctx = (db, who) => ({ db, json, whoAmI: async () => who });
const ownerWho = { raw: OWNER, pid: OWNER, wallet: null, owner: true }, victimWho = { raw: VICTIM, pid: VICTIM, wallet: null, owner: false };

test('server: every owner action is 403 "Owner only." for non-owners (and for no identity)', async () => {
  const db = fakeDb(); db.add(VICTIM, 'val:ruby', 2);
  for (const action of ['admin_status', 'admin_players', 'admin_freeze', 'admin_pocket_get', 'admin_pocket_take', 'admin_pocket_give', 'admin_pocket_gold']) {
    for (const who of [victimWho, null]) {
      const r = await res(await A.adminAction(ctx(db, who), action, { target_pid: VICTIM, item: 'val:ruby', qty: 1, frozen: true, delta: 100 }));
      assert.equal(r.status, 403, `${action} as ${who?.pid ?? 'nobody'}`); assert.equal(r.body.error, 'Owner only.');
    }
  }
  assert.equal(db.T.pvp_inv.find(r => r.player_id === VICTIM).qty, 2, 'nothing moved'); assert.equal(db.T.pvp_admin_controls.length, 0, 'nobody frozen');
  assert.deepEqual(A.OWNER_ACTIONS.sort(), ['admin_freeze', 'admin_players', 'admin_pocket_get', 'admin_pocket_give', 'admin_pocket_gold', 'admin_pocket_take', 'admin_status']);
  assert.match(ATS, /if \(OWNER_ACTIONS\.includes\(action\) && !who\?\.owner\) return json\(403, \{ error: "Owner only\." \}\)/);
  assert.match(IDX, /owner: pid === OWNER_MAIN/); assert.match(IDX, /ADMIN_ACTIONS\.includes\(String\(b\.action\) as any\)\) return await adminAction\(\{ db, whoAmI, json \}/);
});

test('server: owner pockets: get lists items + gold, take moves stacks + unique weapons to OWNER_MAIN, give adds items + gold', async () => {
  const db = fakeDb(), c = ctx(db, ownerWho);
  db.add(VICTIM, 'val:gold_bar', 3, 'chest'); db.add(VICTIM, 'val:gold_bar', 2, 'gift'); db.add(VICTIM, 'wpn:sword:cutlass:legendary', 1, 'chest'); db.add(VICTIM, 'fish:koi', 4, 'fish');
  db.T.pvp_dev_profiles.push({ id: VICTIM, gold: 4250 }); db.T.pvp_maps.push({ id: '11111111-2222-3333-4444-555555555555', player_id: VICTIM, tier: 'rare', dug_at: null });
  let r = await res(await A.adminAction(c, 'admin_pocket_get', { target_pid: VICTIM }));
  assert.equal(r.status, 200); assert.equal(r.body.gold, 4250);
  assert.deepEqual(r.body.items.find(i => i.item === 'val:gold_bar'), { item: 'val:gold_bar', qty: 5 }, 'stacks across sources');
  assert.ok(r.body.items.some(i => i.item.startsWith('map:')), 'treasure maps listed');
  r = await res(await A.adminAction(c, 'admin_pocket_take', { target_pid: VICTIM, item: 'val:gold_bar', qty: 1 }));
  assert.equal(r.status, 200); assert.equal(r.body.took.qty, 1); assert.equal(r.body.target.items.find(i => i.item === 'val:gold_bar').qty, 4);
  assert.equal(r.body.mine.items.find(i => i.item === 'val:gold_bar').qty, 1, 'into BANKSY (OWNER_MAIN)');
  r = await res(await A.adminAction(c, 'admin_pocket_take', { target_pid: VICTIM, item: 'val:gold_bar', all: true }));
  assert.equal(r.body.took.qty, 4); assert.ok(!r.body.target.items.some(i => i.item === 'val:gold_bar')); assert.equal(r.body.mine.items.find(i => i.item === 'val:gold_bar').qty, 5);
  r = await res(await A.adminAction(c, 'admin_pocket_take', { target_pid: VICTIM, item: 'wpn:sword:cutlass:legendary', all: true }));
  assert.equal(r.body.took.qty, 1); assert.ok(r.body.mine.items.some(i => i.item === 'wpn:sword:cutlass:legendary'), 'unique weapon moved');
  assert.equal((await res(await A.adminAction(c, 'admin_pocket_take', { target_pid: VICTIM, item: 'val:ruby', qty: 1 }))).status, 409, 'not there');
  assert.equal((await res(await A.adminAction(c, 'admin_pocket_take', { target_pid: OWNER, item: 'val:ruby', qty: 1 }))).status, 400, 'not from yourself');
  r = await res(await A.adminAction(c, 'admin_pocket_give', { target_pid: VICTIM, item: 'val:diamond', qty: 3 }));
  assert.equal(r.status, 200); assert.equal(r.body.target.items.find(i => i.item === 'val:diamond').qty, 3);
  r = await res(await A.adminAction(c, 'admin_pocket_give', { target_pid: VICTIM, item: 'wpn:musket:dragoon:epic', qty: 1 }));
  assert.ok(r.body.target.items.some(i => i.item === 'wpn:musket:dragoon:epic'));
  for (const bad of [{ item: 'val:<script>', qty: 1 }, { item: 'val:not_a_thing', qty: 1 }, { item: 'val:diamond', qty: 0 }, { item: 'val:diamond', qty: 500 }])
    assert.equal((await res(await A.adminAction(c, 'admin_pocket_give', { target_pid: VICTIM, ...bad }))).status, 400, JSON.stringify(bad));
  r = await res(await A.adminAction(c, 'admin_pocket_gold', { target_pid: VICTIM, delta: 1000 })); assert.equal(r.status, 200); assert.equal(r.body.target.pending, 1000, 'waits in their pot (inv_pot collects)');
  r = await res(await A.adminAction(c, 'admin_pocket_gold', { target_pid: VICTIM, delta: -1500 })); assert.equal(r.body.target.pending, -500);
  assert.equal(db.T.pvp_inv_owner_pot.find(p => p.player_id === OWNER).gold, 1500, 'confiscated gold -> BANKSY');
  assert.equal((await res(await A.adminAction(c, 'admin_pocket_get', { target_pid: 'wallet:<bad>' }))).status, 400);
  // SQL: atomic + owner-checked again inside the functions, service role only
  for (const fn of ['pvp_admin_pocket_take', 'pvp_admin_pocket_give', 'pvp_admin_gold']) { assert.match(SQL, new RegExp(`function public\\.${fn}\\(p_owner text`)); assert.match(SQL, new RegExp(`revoke all on function public\\.${fn}`)); }
  assert.equal((SQL.match(/if p_owner is distinct from pvp_inv_owner\(\) then return jsonb_build_object\('ok', false, 'why', 'owner only'\)/g) || []).length, 3);
  assert.match(SQL, /for update/); assert.match(SQL, /pvp_inv_log/);
});

test('server: freeze lives in pvp_admin_controls; admin_my_state reads it for the caller only; presence is your own net id only', async () => {
  const db = fakeDb(); let now = Date.parse('2026-11-06T03:30:00Z');
  const oc = { ...ctx(db, ownerWho), now: () => now }, vc = { ...ctx(db, victimWho), now: () => now };
  let r = await res(await A.adminAction(vc, 'admin_my_state', {})); assert.deepEqual([r.status, r.body.frozen], [200, false]);
  r = await res(await A.adminAction(oc, 'admin_freeze', { target_pid: VICTIM, target_net: 'abcdef123', frozen: true, seconds: 600 }));
  assert.equal(r.status, 200); assert.equal(db.T.pvp_admin_controls[0].frozen, true);
  r = await res(await A.adminAction(vc, 'admin_my_state', {})); assert.equal(r.body.frozen, true); assert.ok(r.body.until);
  now += 601000; r = await res(await A.adminAction(vc, 'admin_my_state', {})); assert.equal(r.body.frozen, false, 'expires');
  r = await res(await A.adminAction(oc, 'admin_freeze', { target_pid: VICTIM, frozen: true })); now += 1000;
  r = await res(await A.adminAction(oc, 'admin_freeze', { target_pid: VICTIM, frozen: false })); assert.equal(r.body.frozen, false);
  r = await res(await A.adminAction(vc, 'admin_my_state', {})); assert.equal(r.body.frozen, false, 'unfreeze clears');
  assert.equal((await res(await A.adminAction(oc, 'admin_freeze', { target_pid: OWNER, frozen: true }))).status, 400, 'not yourself');
  assert.equal((await res(await A.adminAction(oc, 'admin_freeze', { target_pid: VICTIM, target_net: 'BAD NET', frozen: true }))).status, 400);
  // presence: register MY net id (pid from whoAmI, never the body); someone else's bound net id is refused
  r = await res(await A.adminAction(vc, 'admin_register_net', { net_id: 'mynet12345', pid: OWNER, name: 'Trav<b>', room: 'Harbor #2', mode: 'foot', x: 1, y: 2, z: 3 }));
  assert.equal(r.status, 200); assert.equal(db.T.pvp_admin_presence[0].pid, VICTIM); assert.equal(db.T.pvp_admin_presence[0].name, 'Travb');
  r = await res(await A.adminAction(oc, 'admin_register_net', { net_id: 'mynet12345' })); assert.equal(r.status, 409, 'hijack refused');
  db.T.pvp_harbor_seats.push({ seat: 'mynet12345-seat-abc', copy: 2, state: 'play', seen: new Date(now).toISOString() });
  db.T.pvp_admin_presence[0].updated_at = new Date(now).toISOString();
  r = await res(await A.adminAction(oc, 'admin_players', {})); assert.equal(r.status, 200);
  assert.deepEqual([r.body.players.length, r.body.players[0].pid, r.body.players[0].copy, r.body.players[0].w], [1, VICTIM, 2, 'harbor']);
  assert.match(SQL, /create table if not exists public\.pvp_admin_controls \(\s*target_pid text primary key/);
  assert.match(SQL, /create table if not exists public\.pvp_admin_presence \(\s*net_id\s+text primary key/);
  assert.match(SQL, /alter table public\.pvp_admin_controls enable row level security;\s*revoke all on public\.pvp_admin_controls from public, anon, authenticated;/);
  assert.match(SQL, /select player_id into bound from pvp_net where net_id = p_net/);
});

test('client: the Admin Menu only exists for the server-confirmed owner, tucked inside SETTINGS (no HUD button); ?banksy=1 never on the live host', () => {
  const run = (o) => JSON.parse(execFileSync(process.execPath, ['--import', './tests/helpers/adminRegister.mjs', 'tests/helpers/adminScenario.mjs', JSON.stringify(o)], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').pop());
  const prodUrl = run({ host: 'game.pumpfunpirates.com', search: '?banksy=1' });
  assert.deepEqual([prodUrl.owner, prodUrl.settingsBtn, prodUrl.f8Opens, prodUrl.adminDomIds.length], [false, false, false, 0], 'live host: ?banksy=1 unlocks nothing, nothing in the DOM');
  const prodNot = run({ host: 'game.pumpfunpirates.com', hint: true, serverOwner: false });
  assert.deepEqual([prodNot.owner, prodNot.settingsBtn, prodNot.adminDomIds.length], [false, false, 0], 'server said no (403): no button');
  assert.deepEqual(prodNot.calls, ['admin_status']);
  const anon = run({ host: 'game.pumpfunpirates.com' }); assert.deepEqual(anon.calls, [], 'ordinary players do not even ask'); assert.equal(anon.settingsBtn, false);
  const owner = run({ host: 'game.pumpfunpirates.com', hint: true, serverOwner: true });
  assert.deepEqual([owner.owner, owner.settingsBtn, owner.inPause], [true, true, true], 'owner: ⚙ SETTINGS > 👑 ADMIN MENU');
  assert.equal(owner.openedByClick, true, 'clicking it opens #pfp-admin'); assert.equal(owner.pauseHidden, true, 'and closes SETTINGS');
  assert.equal(owner.f8Closes && owner.f8Opens, true, 'F8 toggles for the owner');
  for (const r of [prodUrl, prodNot, anon, owner]) { assert.equal(r.hudButtons, 0, 'nothing on #hud'); assert.equal(r.bodyButtons, 0, 'no floating button'); }
  const local = run({ host: '127.0.0.1', search: '?banksy=1' }); assert.equal(local.settingsBtn, true, 'local tests only');
  assert.ok(!/ADMIN/.test(HTML), 'index.html carries no admin button');
  assert.match(SRC, /document\.querySelector\('#pause \.panel'\)/); assert.match(SRC, /btn-set-admin/);
});

test('client: pure rules: unlock, NOCLIP flight, landing, jump-to-player, ESP label, freeze lock', async () => {
  const M = await import('./helpers/adminPure.mjs').then(m => m.load());
  assert.equal(M.adminUnlocked({ serverOwner: false, prodHost: true, search: '?banksy=1' }), false);
  assert.equal(M.adminUnlocked({ serverOwner: false, prodHost: false, search: '?x=1&banksy=1' }), true);
  assert.equal(M.adminUnlocked({ serverOwner: true, prodHost: true, search: '' }), true);
  assert.equal(M.adminUnlocked({ serverOwner: 'true', prodHost: true, search: '' }), false, 'only a real true');
  // NOCLIP: forward along the camera, through anything (no world.blocked call), Space up, C down
  const w = { x: 0, y: 5, z: 0, camYaw: 0, pitch: 0.28, yaw: 0 };
  M.noclipStep(w, { KeyW: true }, 1, 1); assert.ok(Math.abs(w.z - M.NOCLIP.speed) < 1e-6 && Math.abs(w.y - 5) < 1e-6 && Math.abs(w.x) < 1e-6, 'level flight');
  M.noclipStep(w, { Space: true }, 1, 1); assert.ok(w.y > 5 + 6); const y = w.y; M.noclipStep(w, { KeyC: true }, 0.5, 2.5); assert.ok(w.y < y);
  const w2 = { x: 0, y: 5, z: 0, camYaw: Math.PI / 2, pitch: 0.28 + 0.5 }; M.noclipStep(w2, { KeyW: true }, 1, 5); assert.ok(w2.x > 30 && w2.y < 5, 'looking down flies down, 5× speed');
  const w3 = { x: 0, y: 5, z: 0, camYaw: 0, pitch: 0.28 }; M.noclipStep(w3, { KeyW: true, ShiftLeft: true }, 1, 1); assert.ok(Math.abs(w3.z - M.NOCLIP.speed * 2) < 1e-6, 'shift boost');
  assert.match(SRC, /noclipStep\(w, w\.keys/); assert.ok(!/blocked/.test(M.noclipStep.toString()), 'noclip never asks world.blocked');
  assert.equal(M.landY(-3, 2.5), 2.5); assert.equal(M.landY(9, 2.5), 9);
  const t = M.tpSpot({ x: 10, z: 20 }, true); assert.deepEqual([t.x, t.z], [11.8, 21.8]); assert.ok(Math.abs(Math.atan2(10 - t.x, 20 - t.z) - t.yaw) < 1e-9, 'faces the target');
  const s = M.tpSpot({ x: 100, z: -50 }, false); assert.deepEqual([s.x, s.z, s.foot], [118, -32, false]);
  const lab = M.espLabel({ name: '<img onerror=x>', mode: 'On Foot', hp: 87.4, x: 30, z: 40, frozen: true }, { x: 0, z: 0 });
  assert.equal(lab, '&lt;img onerror=x&gt; · On Foot · 87 HP · 50 m · ❄️ FROZEN');
  const walker = { speed: 9, jumpQ: true, vy: 3, joy: { x: 1, y: 1 } }, ship = { speed: 12, turn: 0.5, sail: 3 };
  M.frozenLock(walker, ship); assert.deepEqual([walker.speed, walker.jumpQ, walker.joy.x, ship.speed, ship.turn, ship.sail], [0, false, 0, 0, 0, 0]);
  assert.equal(M.applyMyState({ frozen: true, until: new Date(Date.now() + 60000).toISOString() }), true); assert.equal(M.ADM.frozen, true);
  assert.equal(M.applyMyState({ frozen: true, until: new Date(Date.now() - 1000).toISOString() }), false, 'expired = thawed');
  assert.equal(M.applyMyState({ frozen: false }), false);
  const cat = M.giveCatalog(); assert.ok(cat.length > 40); assert.ok(cat.some(c => c.key === 'wpn:sword:cutlass:legendary') && cat.some(c => c.key === 'fish:leviathan') && cat.some(c => c.key === 'val:crown_jewel'));
});

test('hooks: GOD (0 damage on foot + at sea), INVISIBLE (bye + no state + AI ignores + ghost), FREEZE (walker / ship / combat / interact), NOCLIP (ship rocks)', () => {
  assert.match(STATE, /export const ADM = \{ noclip: false, noclipMul: 1, god: false, invisible: false, frozen: false/);
  assert.match(BATTLE, /function takeHit\(n, by\) \{ if \(ADM\.god\) \{ me\.hp = ARENA\.hp; return; \}/);
  assert.match(BATTLE, /function attack\(\) \{\n    if \(ADM\.frozen\) return false;/);
  assert.match(PVP, /function localDamage\(raw, by, p, shooterObj = null\) \{\n    if \(ADM\.god\) \{ const g = P\(\); g\.hp = g\.maxHp; return; \}/);
  assert.match(MAIN, /if \(s === player && ADM\.god\) \{ s\.hp = s\.maxHp; return; \}/);
  assert.match(PVP, /if \(ADM\.invisible\) return null; \/\/ \[admin-menu\] INVISIBLE/);
  assert.match(PVP, /if \(!ADM\.invisible && pl\.alive && !me\.dead/);
  assert.match(SRC, /send\('bye', \{ i: id \}\); ADM\.invisible = true; ghostAll\(true\)/);
  assert.match(SRC, /ADM\.invisible = false; ghostAll\(false\); const id = myNet\(\); if \(id\) send\('hello', \{ i: id \}\)/);
  assert.match(SRC, /c\.opacity = 0\.42/);
  assert.match(PVP, /\.on\('bye', \(m\) => \{ const p = peers\.get\(m\?\.i\); if \(p\) p\.heard = 0; if \(isNetId\(m\?\.i\)\) K\.dock\?\.fnet\?\.drop\?\.\(m\.i\); \}\)/);
  assert.match(PVP, /\.on\('adm', \(m, from\) => \{ try \{ ADM\.onPoke\?\.\(m, from\); \} catch \{\} \}\)/);
  assert.match(SRC, /m\.t !== myNet\(\)\) return;/); assert.match(SRC, /if \(m\.k === 'chk'\) checkMine\(\); else if \(m\.k === 'inv'\) refreshMyPockets\(\)/);
  assert.match(WALK, /if \(w\.adminHook && w\.adminHook\(dt, \{ place, camPos, cam, tgt, pirate, camera, fovPush \}\)\) return;/);
  assert.match(MAIN, /const shipLocked = \(\) => !!\(dock\?\.onFoot \|\| dock\?\.canoeing \|\| ADM\.frozen\)/);
  assert.match(DOCK, /treasure\.isOpen \|\| ADM\.frozen\) return;/);
  assert.match(MAIN, /if \(!\(s === player && ADM\.noclip\)\) islands\.collide\(s, dt\)/);
  assert.match(SRC, /❄️ FROZEN BY CAPTAIN BANKSY/);
  assert.match(SRC, /_testApplyMyState/); assert.match(SRC, /if \(!IS_PROD_HOST\) \{ \/\/ local dev/);
  // escaping + id checks on everything from the network
  assert.ok(!/innerHTML = [^;]*\$\{p\.name\}/.test(SRC) && /escHtml\(p\.name\)/.test(SRC)); assert.match(SRC, /isNetId\(id\)/);
  assert.match(SW, /"\.\/js\/adminMenu\.js"/); assert.match(SW, /"\.\/js\/adminState\.js"/);
  assert.match(MAIN, /\[\?&\]admin=0\(&\|\$\)/);
  assert.ok(!/PUMP FUN PIRATES/.test(SRC + ATS + SQL));
});
