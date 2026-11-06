// [v346] BANKSY t1819u "Give me time and weather control in admin menu" + t1820u "Also give me ability to add remove or move collisions".
// node --test tests/v346AdminSkyAndCollisions.test.mjs
import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

register('../tools/roundabout_blender/node/hooks.mjs', import.meta.url);
globalThis.location = { search: '?coast=1', href: 'http://x/index.html?coast=1', hostname: 'x' };
globalThis.window = globalThis; globalThis.self = globalThis;
const el = () => ({ getContext: () => null, style: {}, addEventListener() {}, appendChild() {}, setAttribute() {}, classList: { add() {}, remove() {} } });
globalThis.document = globalThis.document || { createElement: el, createElementNS: el, addEventListener() {}, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };

const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const SKY = await import('../js/skyCycle.js');
const AW = await import('../js/adminWorld.js');
const W = await import('../supabase/functions/pvp/adminWorld.ts');
const A = await import('../supabase/functions/pvp/admin.ts');
const FM = await import('../js/island/foot.js');
{ const Rx = new Proxy({}, { get: () => [0, 0, 1, 1] }); for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) FM[fn](Rx, false, []); } // the island's built-in obstacles, no renderer

// ---------------- PART 1: time + weather ----------------
test('time presets, 24 h slider + badge (phase 0 = 00:00, 0.25 = 06:00, 0.5 = 12:00, 0.75 = 18:00)', () => {
  const P = Object.fromEntries(AW.TIME_PRESETS.map(p => [p[0], p[2]]));
  assert.deepEqual(AW.TIME_PRESETS.map(p => p[1]), ['🔄 AUTO', '🌅 SUNRISE', '☀️ NOON', '🌇 SUNSET', '🌌 NIGHT', '🌑 MIDNIGHT']);
  assert.equal(AW.phaseBadge(P.sunrise), '06:15 · SUNRISE'); assert.equal(AW.phaseBadge(P.noon), '12:00 · SUNNY');
  assert.equal(AW.phaseBadge(P.sunset), '17:45 · SUNSET'); assert.equal(AW.phaseBadge(P.night), '22:00 · NIGHT'); assert.equal(AW.phaseBadge(P.midnight), '00:00 · NIGHT');
  assert.equal(SKY.phaseClock(0.25), '06:00'); assert.equal(SKY.phaseClock(0.75), '18:00');
  assert.equal(AW.sliderToPhase(250), 0.25); assert.equal(AW.sliderToPhase(5000), 1); assert.equal(AW.sliderToPhase(-3), 0); assert.equal(AW.phaseToSlider(0.5), 500);
});

test('env state machine: preset holds, ⏸ FREEZE / ▶ RUN CLOCK, slider, 🔄 AUTO back to the UTC clock', () => {
  const t0 = 1_800_000_000_000;
  let e = AW.envStep(null, { k: 'time', id: 'sunset' }, t0); assert.equal(e.mode, 'hold'); assert.equal(e.phase, 0.7396); assert.equal(AW.freezeLabel(e), '▶ RUN CLOCK'); assert.equal(AW.timeActive(e), 'sunset');
  e = AW.envStep(e, { k: 'freeze' }, t0 + 1000); assert.equal(e.mode, 'run'); assert.equal(AW.freezeLabel(e), '⏸ FREEZE TIME');
  assert.ok(Math.abs(AW.envPhase(e, t0 + 1000 + 600_000) - (0.7396 + 0.5)) % 1 < 1e-9 || Math.abs(AW.envPhase(e, t0 + 601_000) - 0.2396) < 1e-9, 'runs at the 20-min cycle rate');
  e = AW.envStep(e, { k: 'slider', v: 500 }, t0 + 2000); assert.equal(e.mode, 'run'); assert.equal(e.phase, 0.5); // a running clock keeps running from the new time
  e = AW.envStep(e, { k: 'freeze' }, t0 + 62_000); assert.equal(e.mode, 'hold'); assert.ok(Math.abs(e.phase - (0.5 + 60 / 1200)) < 1e-9, 'freeze holds where it was');
  e = AW.envStep(e, { k: 'time', id: 'auto' }, t0); assert.equal(e.mode, 'auto'); assert.equal(AW.timeActive(e), 'auto');
  assert.equal(AW.envPhase(e, 1200 * 1000 * 7.25), 0.25);
});

test('applyEnv drives js/skyCycle.js + game.stormOverride; storm presets + slider + ⚡ bolt counter; auto clears', () => {
  const game = { storm: 0, stormOverride: null }, sky = { setPhase: SKY.setPhase, clearPhase: SKY.clearPhase, runFrom: SKY.runFrom };
  AW.applyEnv({ mode: 'hold', phase: 0.9167, storm: null }, sky, game); assert.ok(Math.abs(SKY.skyPhase() - 0.9167) < 1e-9); assert.equal(SKY.phaseName(SKY.skyPhase()), 'night'); assert.equal(game.stormOverride, null);
  const now = Date.now(); AW.applyEnv({ mode: 'run', phase: 0.25, t: now - 60_000, storm: 1 }, sky, game);
  assert.ok(Math.abs(SKY.skyPhase(now) - (0.25 + 0.05)) < 1e-6); assert.equal(game.stormOverride, 1); assert.equal(game.storm, 1);
  const S = Object.fromEntries(AW.STORM_PRESETS.map(p => [p[0], p[2]])); assert.deepEqual(S, { auto: null, clear: 0, squall: 0.42, tempest: 1 });
  let e = AW.envStep({}, { k: 'stormPreset', id: 'squall' }); assert.equal(e.storm, 0.42); assert.equal(AW.stormActive(e), 'squall');
  e = AW.envStep(e, { k: 'storm', v: 0.73 }); AW.applyEnv(e, sky, game); assert.equal(game.storm, 0.73); assert.equal(game.stormOverride, 0.73);
  e = AW.envStep(e, { k: 'bolt' }, 5); assert.equal(e.bolt, 1); assert.equal(e.bt, 5);
  e = AW.envStep(e, { k: 'stormPreset', id: 'auto' }); AW.applyEnv({ ...e, mode: 'auto' }, sky, game); assert.equal(game.stormOverride, null); assert.equal(SKY.skyOverride().mode, 'auto');
  const M = R('js/main.js'); assert.match(M, /game\.storm = game\.stormOverride \?\?/); assert.match(M, /if \(game\.adminBolt\) \{ game\.adminBolt = 0; game\.flash = 1;/); assert.match(M, /canvas: renderer\.domElement \}\)/);
});

test("'!env' server sanitization", () => {
  const now = 1_800_000_000_000;
  assert.deepEqual(W.cleanEnv({ mode: 'hold', phase: 1.25, storm: 7, t: now, bolt: 3, bt: now }, now), { mode: 'hold', phase: 0.25, t: now, storm: 1, bolt: 3, bt: now });
  const e = W.cleanEnv({ mode: '<script>', phase: 'x', storm: 'auto', t: 1, bolt: -4, bt: 9e15, evil: 1 }, now);
  assert.equal(e.mode, 'auto'); assert.equal(e.storm, null); assert.equal(e.phase, 0.5); assert.ok(e.t >= now - 7 * 864e5); assert.equal(e.bolt, 0); assert.ok(e.bt <= now + 60000); assert.equal(e.evil, undefined);
  assert.equal(W.cleanEnv(null), null); assert.equal(W.cleanEnv('auto'), null);
});

// ---------------- server: owner-only writes, everyone reads ----------------
function fakeDb(pieces) { const row = { id: 'island', pieces, updated_at: '2026-11-06T19:00:00.000Z', cells: { 1: 5 }, rev: 9 }; const calls = [];
  const from = (t) => { assert.equal(t, 'pvp_terrain'); const f = {}; const q = {
    select() { return q; }, eq(k, v) { f[k] = v; return q; }, async maybeSingle() { return { data: row ? { ...row } : null }; },
    update(v) { const u = { v, f: {} }; const uq = { eq(k, x) { u.f[k] = x; return uq; }, async select() { calls.push(['update', u]); if (u.f.updated_at !== row.updated_at) return { data: [], error: null }; Object.assign(row, v); return { data: [{ id: 'island' }], error: null }; } }; return uq; },
    async insert() { throw new Error('no insert expected'); } }; return q; };
  return { db: { from }, row, calls }; }
const ctx = (db, who) => ({ db, whoAmI: async () => who, json: (status, body) => ({ status, body }), now: () => 1_800_000_000_000 });
const OWNER = { raw: 'o', pid: 'dev:e191a32e15abea4f14355121', wallet: null, owner: true }, PIRATE = { raw: 'p', pid: 'dev:0123456789abcdef01234567', wallet: null, owner: false };

test('admin_world_put: owner only, sanitized merge into pvp_terrain.pieces (terrain rev untouched); admin_world_get: every pirate, world keys only', async () => {
  assert.ok(A.ADMIN_ACTIONS.includes('admin_world_get') && A.ADMIN_ACTIONS.includes('admin_world_put')); assert.ok(A.OWNER_ACTIONS.includes('admin_world_put')); assert.ok(!A.OWNER_ACTIONS.includes('admin_world_get'));
  const F = fakeDb({ 'hill#p3': { dx: 1 }, '!rw_abcd1': { rework: 1, note: 'secret' }, '!col_old1': { s: 'cyl', x: 1, z: 2, r: 2, y0: 0, y1: 4 } });
  assert.equal((await A.adminAction(ctx(F.db, PIRATE), 'admin_world_put', { set: { '!env': { mode: 'hold', phase: 0.5 } } })).status, 403);
  assert.equal((await A.adminAction(ctx(F.db, null), 'admin_world_put', { set: {} })).status, 403);
  assert.equal((await A.adminAction(ctx(F.db, OWNER), 'admin_world_put', { set: { 'hill#p3': null } })).status, 400, 'only world ids');
  assert.equal((await A.adminAction(ctx(F.db, OWNER), 'admin_world_put', { set: { '!col_abcd': { s: 'cone', x: 0, z: 0 } } })).status, 400);
  const ok = await A.adminAction(ctx(F.db, OWNER), 'admin_world_put', { set: { '!env': { mode: 'run', phase: 0.74, storm: 0.42, t: 1_800_000_000_000 }, '!col_new1': { s: 'box', x: 5, z: 6, w: 999, d: 1.2, yaw: 0, y0: 1, y1: 0 }, '!col_old1': null, '!cdel_ob_c_1a_-2b': { d: 1 } } });
  assert.equal(ok.status, 200); assert.equal(F.row.rev, 9); assert.deepEqual(F.row.pieces['hill#p3'], { dx: 1 }); assert.ok(F.row.pieces['!rw_abcd1']);
  assert.equal(F.row.pieces['!col_old1'], undefined); assert.deepEqual(F.row.pieces['!col_new1'], { s: 'box', x: 5, z: 6, w: 120, d: 1.2, yaw: 0, y0: 0, y1: 1 }); assert.equal(F.row.pieces['!env'].storm, 0.42);
  const get = await A.adminAction(ctx(F.db, null), 'admin_world_get', {}); assert.equal(get.status, 200);
  assert.deepEqual(Object.keys(get.body.world).sort(), ['!cdel_ob_c_1a_-2b', '!col_new1', '!env']); // no Build Mode pieces, never the owner-only 🚩 flags
  const IDX = R('supabase/functions/pvp/index.ts');
  assert.match(IDX, /if \(isWorldId\(id\)\) continue;/); assert.match(IDX, /if \(isWorldId\(id\)\) pieces\[id\] = v; \/\/ \[v346\] a Build Mode save never drops/);
  assert.match(R('js/island/terrainEdit.js'), /if \(id\[0\] === '!' && !id\.startsWith\(RW\)\) return;/);
});

test('world ids + shapes: strict ids, clamps, 600 cap', () => {
  for (const id of ['!env', '!col_ab12', '!noc_mw5dqsoio30o', '!cmod_ob_c_-57i_-1w7', '!cdel_ob_b_12_3_2']) assert.ok(W.isWorldId(id), id);
  for (const id of ['!col_AB', '!col_a', '!rw_abcd', 'env', '!cmod_x', '!col_abcd<']) assert.ok(!W.isWorldId(id), id);
  assert.deepEqual(W.cleanShape({ s: 'cyl', x: 1e9, z: 2, r: 0, y0: 5, y1: 500 }), { s: 'cyl', x: 1500, z: 2, r: 0.2, y0: 5, y1: 400 });
  assert.equal(W.cleanShape({ s: 'box', x: 'a', z: 1 }), null); assert.deepEqual(W.cleanWorld('!cmod_ob_c_1_2', { s: 'cyl', x: 1, z: 2, r: 3, y0: 9 }), { s: 'cyl', x: 1, z: 2, r: 3 });
  const big = {}; for (let i = 0; i < 601; i++) big['!col_' + String(i).padStart(4, '0')] = { s: 'cyl', x: 0, z: 0, r: 1 };
  assert.equal(W.mergeWorld({}, Object.fromEntries(Object.entries(big).slice(0, 200))).n, 200); assert.equal(W.mergeWorld(big, {}).error, 'too many colliders'); assert.equal(W.mergeWorld({}, big).error, 'too many changes');
});

// ---------------- PART 2: collisions (the real foot.js colliders) ----------------
const ids = FM.obstacleIds(), circ = [...ids.values()].find(o => o.t === 0 && o.r > 0.5 && !o.off), boxO = [...ids.values()].find(o => o.t === 1 && o.hx > 1 && !o.off);
test('built-in obstacles have stable ids (kind + original 0.1 m position)', () => {
  assert.ok(ids.size > 200, `${ids.size} obstacles`); assert.ok(circ && boxO);
  for (const [id, o] of ids) assert.match(id, /^ob_[bc]_[0-9a-z-]+_[0-9a-z-]+(_\d+)?$/) && assert.equal(o.id, id);
  const again = FM.obstacleIds(); assert.equal(again, ids, 'same map while the obstacle count is unchanged');
  const k = circ.id.replace(/_\d+$/, ''); assert.equal(k, `ob_c_${Math.round(circ.ox * 10).toString(36)}_${Math.round(circ.oz * 10).toString(36)}`);
  for (const id of [...ids.keys()].slice(0, 50)) assert.ok(W.isWorldId('!cdel_' + id) && W.isWorldId('!cmod_' + id), id);
});

test('!col_* box + cylinder blockers block inside [y0, y1]; !cdel_ removes a built-in; !cmod_ moves / resizes it', () => {
  const x = 40.25, z = 455.75; FM.applyAdminColliders({}); assert.equal(FM.hitCollider(x, z), false, 'open ground for the test');
  FM.applyAdminColliders({ '!col_box1': { s: 'box', x, z, w: 4, d: 1.2, yaw: 0, y0: 2, y1: 6 }, '!col_cyl1': { s: 'cyl', x: x + 20, z, r: 2, y0: 2, y1: 6 } });
  FM.setLayer(3); assert.equal(FM.hitCollider(x + 1.5, z), true); assert.equal(FM.hitCollider(x, z + 1.3), false); assert.equal(FM.hitCollider(x + 21.5, z), true); assert.equal(FM.hitCollider(x + 22.6, z), false);
  FM.setLayer(7); assert.equal(FM.hitCollider(x, z), false, 'over the top'); FM.setLayer(0.5); assert.equal(FM.hitCollider(x, z), true, 'a 1.8 m body overlaps the bottom'); FM.setLayer(-3); assert.equal(FM.hitCollider(x, z), false, 'below the bottom');
  FM.setLayer(null); assert.equal(FM.hitCollider(x, z), true, 'no layer = the whole column');
  // a built-in: removed, restored, moved
  const cx = circ.x, cz = circ.z; FM.applyAdminColliders({}); assert.equal(FM.hitCollider(cx, cz, 0), true);
  FM.applyAdminColliders({ ['!cdel_' + circ.id]: { d: 1 } }); const others = [...ids.values()].filter(o => o !== circ && !o.off && Math.hypot(o.x - cx, o.z - cz) < (o.r || Math.hypot(o.hx, o.hz)) + 0.1);
  if (!others.length) assert.equal(FM.hitCollider(cx, cz, 0), false, 'removed built-in unblocks its spot');
  assert.equal(circ.sup, true);
  FM.applyAdminColliders({}); assert.equal(circ.sup, false); assert.equal(FM.hitCollider(cx, cz, 0), true, 'restored');
  FM.applyAdminColliders({ ['!cmod_' + circ.id]: { s: 'cyl', x: x, z: z, r: circ.r * 2 } });
  if (!others.length) assert.equal(FM.hitCollider(cx, cz, 0), false, 'old spot open'); assert.equal(FM.hitCollider(x + circ.r * 1.9, z, 0), true, 'new spot + new size blocks');
  const bx = boxO.x, bz = boxO.z; FM.applyAdminColliders({ ['!cmod_' + boxO.id]: { s: 'box', x, z, w: 10, d: 1, yaw: Math.PI / 2 } });
  assert.equal(FM.hitCollider(x, z + 4.5, 0), true, 'turned 90°'); assert.equal(FM.hitCollider(x + 4.5, z, 0), false); void bx; void bz;
  assert.deepEqual(FM.obstacleShape(boxO).s, 'box'); assert.ok(FM.obstaclesNear(x, z, 30).length >= 0);
  FM.applyAdminColliders({});
});

test('!noc_* PASS ZONE carves through obstacles AND the procedural blocked() checks (rails, slopes, sea limit)', () => {
  const cx = circ.x, cz = circ.z;
  FM.applyAdminColliders({ '!noc_pass1': { s: 'box', x: cx, z: cz, w: 6, d: 6, yaw: 0, y0: -50, y1: 300 }, '!col_inzone': { s: 'cyl', x: cx + 1, z: cz, r: 1, y0: -50, y1: 300 } });
  assert.equal(FM.hitCollider(cx, cz, 0.45), false); assert.equal(FM.hitCollider(cx + 1, cz), false); assert.equal(FM.nocAt(cx + 2.9, cz), true); assert.equal(FM.nocAt(cx + 3.2, cz), false);
  FM.applyAdminColliders({ '!noc_pass2': { s: 'cyl', x: cx, z: cz, r: 3, y0: 10, y1: 14 } }); FM.setLayer(12); assert.equal(FM.nocAt(cx, cz), true); FM.setLayer(40); assert.equal(FM.nocAt(cx, cz), false, 'only inside its height');
  FM.setLayer(null); FM.applyAdminColliders({});
  const S = R('js/island/foot.js'), WS = R('js/dock/world.js');
  assert.match(S, /function blocked\(x, z, fx, fz\) \{ if \(ADMIN_COL\.nocs\.length && nocAt\(x, z\)\) return false;/, 'first check in blocked(): before rails / props / sea / slope');
  assert.match(S, /function whyBlocked\(x, z, fx, fz\) \{ if \(ADMIN_COL\.nocs\.length && nocAt\(x, z\)\) return '';/);
  assert.match(WS, /if \(FM\.ADMIN_COL\?\.nocs\.length && FM\.nocAt\(\.\.\.toF\(x, z\)\)\) return false;/, 'harbor decks too');
});

test('editor helpers: spawn in front of you, field edits, ids the server accepts', () => {
  const b = AW.spawnShape('box', 10, 20, 0, 3); assert.deepEqual([b.s, b.x, b.z, b.w, b.d, b.y0, b.y1], ['box', 10, 24.5, 4, 1.2, 2.7, 6.7]);
  const c = AW.spawnShape('cyl', 0, 0, Math.PI / 2, 0); assert.equal(c.r, 2); assert.equal(c.x, 4.5); assert.equal(c.y1 - c.y0, 4);
  const n = AW.spawnShape('noc', 0, 0, 0, 1); assert.equal(n.y0, -0.5); assert.equal(n.w, 4);
  for (let i = 0; i < 50; i++) { assert.ok(W.isWorldId(AW.newColId('col')), 'col id'); assert.ok(W.isWorldId(AW.newColId('noc'))); }
  assert.ok(W.cleanShape(b) && W.cleanShape(c) && W.cleanShape(n));
  let e = AW.editShape(b, 'rot', 90); assert.ok(Math.abs(e.yaw - Math.PI / 2) < 1e-9); e = AW.editShape(e, 'y1', 1); assert.ok(e.y0 <= 0.8 + 1e-9); e = AW.editShape(c, 'w', 8); assert.equal(e.r, 4);
  assert.equal(AW.editShape(b, 'x', 'NaN').x, b.x);
});

test('admin menu wiring: owner-only panel sections, zero-trust poke, mock fallback, Delete shortcut', () => {
  const M = R('js/adminMenu.js'), S = R('js/adminWorld.js');
  assert.match(M, /<div class="wa"><\/div>/); assert.match(M, /WA\.mount\(panel\.querySelector\('\.wa'\)\)/); assert.match(M, /if \(b\.dataset\.w\) return WA\.click\(b\);/);
  assert.match(M, /!m\.t && \(from == null \|\| isNetId\(from\)\) && WA\.poke\(m\)\) return;/); assert.match(M, /m\.t !== myNet\(\)\) return;/, 'targeted pokes unchanged');
  assert.match(M, /case 'admin_world_put':/); assert.match(M, /isOwner: \(\) => st\.owner/);
  for (const t of ['☀️ TIME & WEATHER', '🌐 SYNC ALL', '⏸ FREEZE TIME', '▶ RUN CLOCK', '⚡ LIGHTNING', '🧱 COLLISIONS', '👁 SHOW COLLISIONS', '✏️ EDIT COLLISIONS', '+ BOX WALL', '+ CYLINDER', '+ PASS ZONE', '🗑 REMOVE SELECTED', '↩ RESTORE REMOVED', '💾 SAVED', 'MOVE TO ME', 'ROTATE°', 'Y BOTTOM', 'Y TOP'])
    assert.ok(S.includes(t), t);
  assert.match(S, /if \(!m \|\| typeof m !== 'object' \|\| \(m\.k !== 'env' && m\.k !== 'col'\)\) return false; \/\/ values are never read from the poke/);
  assert.match(S, /e\.code === 'Delete' \|\| e\.code === 'Backspace'/); assert.match(S, /if \(!isOwner\(\) \|\| !st\.edit \|\| !st\.show/);
  for (const c of ['#ffb340', '#ff3b5c', '#25e878', '#3ce8ff']) assert.ok(S.includes(c), c);
});

test('sw version >= 346', () => { assert.ok(+((R('sw.js').match(/const VERSION = 'pfp-v(\d+)'/) || [])[1]) >= 346); });
