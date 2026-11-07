// [hill-shopfronts] BANKSY "Improve those buildings and signs": the 4 money-maker shop fronts + interiors are fitted to the REAL Blender lots.
// Every dressing mesh is checked (its own oriented box) against the lot's LOD0 triangles from assets/island/hill_street.glb, the doorway prism,
// the door -> E-spot walk lane and the street lamps; the stands' E spots / ids / names are unchanged.
// node --import ./tests/helpers/threeRegister.mjs --test tests/hillShopFronts.test.mjs
import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
// a do-nothing 2D canvas (the stands + signs paint canvases; geometry is all this test needs)
const ctx2d = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 0 }) : /^create(Linear|Radial)Gradient$/.test(k) ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
// + a do-nothing DOM (createMoneyMakers builds its modal UI)
const el = () => { const o = { width: 0, height: 0, style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, children: [] };
  return new Proxy(o, { get: (t, k) => k in t ? t[k] : k === 'getContext' ? () => ctx2d : k === 'querySelectorAll' ? () => [] : () => el(), set: (t, k, v) => (t[k] = v, true) }); };
globalThis.document ??= new Proxy({ head: el(), body: el() }, { get: (t, k) => k in t ? t[k] : k === 'createElement' ? () => el() : /^(querySelector|getElementById)$/.test(k) ? () => null : k === 'querySelectorAll' ? () => [] : () => {} });
globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {}; globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
import { loadHillLots } from './helpers/hillLots.mjs';
const SF = await import('../js/island/moneyMakers/shopFronts.js');
const MM = await import('../js/island/moneyMakers/index.js');
const P = await import('../js/island/moneyMakers/props.js');
const { RENTABLE_SHOPS } = await import('../js/island/hillShops.js');
const KINDS = { wanted: MM.SITES.wanted, fight: MM.SITES.fight, rum: MM.SITES.rum, fence: MM.SITES.buyers.harbor };
const LOTS = await loadHillLots(Object.values(SF.BAKED).map(b => b.lot));

// ---- triangle vs box (centred at 0, half extents h): separating axis test ----
function triBox(a, b, c, h) {
  const v = [a, b, c], e = [[b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - b[0], c[1] - b[1], c[2] - b[2]], [a[0] - c[0], a[1] - c[1], a[2] - c[2]]];
  for (let i = 0; i < 3; i++) { const mn = Math.min(a[i], b[i], c[i]), mx = Math.max(a[i], b[i], c[i]); if (mn > h[i] || mx < -h[i]) return false; }
  const n = [e[0][1] * e[1][2] - e[0][2] * e[1][1], e[0][2] * e[1][0] - e[0][0] * e[1][2], e[0][0] * e[1][1] - e[0][1] * e[1][0]];
  const axes = [n]; for (let i = 0; i < 3; i++) for (const ed of e) { const u = [0, 0, 0]; u[i] = 1; axes.push([u[1] * ed[2] - u[2] * ed[1], u[2] * ed[0] - u[0] * ed[2], u[0] * ed[1] - u[1] * ed[0]]); }
  for (const ax of axes) { const l = Math.hypot(...ax); if (l < 1e-9) continue; const p = v.map(q => q[0] * ax[0] + q[1] * ax[1] + q[2] * ax[2]); const r = h[0] * Math.abs(ax[0]) + h[1] * Math.abs(ax[1]) + h[2] * Math.abs(ax[2]);
    if (Math.min(...p) > r || Math.max(...p) < -r) return false; }
  return true;
}
// every mesh under root as { part, toLocal (frame -> mesh-box centre frame), h, aabb (frame) }
function boxes(root, frame, shrink = 0.012) {
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert(), out = [];
  root.traverse(m => { if (!m.isMesh || !m.visible) return; const g = m.geometry; g.computeBoundingBox(); const bb = g.boundingBox, c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    const IM = new THREE.Matrix4(); for (let n = 0; n < (m.isInstancedMesh ? m.count : 1); n++) { if (m.isInstancedMesh) m.getMatrixAt(n, IM);   // every instance of an InstancedMesh
    const M = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld).multiply(IM).multiply(new THREE.Matrix4().makeTranslation(c.x, c.y, c.z));
    const sc = new THREE.Vector3(); M.decompose(new THREE.Vector3(), new THREE.Quaternion(), sc);
    const h = [Math.max(0, s.x * sc.x / 2 - shrink), Math.max(0, s.y * sc.y / 2 - shrink), Math.max(0, s.z * sc.z / 2 - shrink)];
    const R = M.clone().scale(new THREE.Vector3(1 / sc.x, 1 / sc.y, 1 / sc.z)), aabb = new THREE.Box3();
    for (let i = 0; i < 8; i++) aabb.expandByPoint(new THREE.Vector3(i & 1 ? h[0] : -h[0], i & 2 ? h[1] : -h[1], i & 4 ? h[2] : -h[2]).applyMatrix4(R));
    out.push({ part: m.userData.part || m.parent?.userData?.part || 'stand', name: m.name, toLocal: R.clone().invert(), h, aabb }); } });
  return out;
}
function hits(F, list, { floorOk = false, hide = null } = {}) {   // [part, count] of meshes that cut the real lot's triangles (floorOk: a stand's posts may stand into the sloped plank floor)
  const T = LOTS[F.B.lot].tris, half = F.d / 2, bad = new Map(), p = new THREE.Vector3();
  for (const q of list) { const A = q.aabb, loc = [];
    for (let i = 0; i < T.length; i += 9) { let inBox = true; const v = [];
      for (let k = 0; k < 3; k++) { v.push([T[i + k * 3] - F.xo, T[i + k * 3 + 1] - F.off, T[i + k * 3 + 2] - half]); }
      for (let j = 0; j < 3 && inBox; j++) { const mn = Math.min(v[0][j], v[1][j], v[2][j]), mx = Math.max(v[0][j], v[1][j], v[2][j]); if (mn > A.max.getComponent(j) || mx < A.min.getComponent(j)) inBox = false; }
      if (inBox && hide && v.every(w => hide.containsPoint(new THREE.Vector3(...w)))) inBox = false;   // baked counter faces hidden inside the case
      if (inBox && floorOk && v.every(w => Math.abs(w[1] - F.floorAt(w[0])) < 0.2)) inBox = false;
      if (!inBox) continue; const lv = v.map(w => p.set(...w).applyMatrix4(q.toLocal).toArray());
      if (triBox(lv[0], lv[1], lv[2], q.h)) { bad.set(q.part, (bad.get(q.part) || 0) + 1); if (process.env.SF_DEBUG) console.log(F.id, q.part, 'box', A.min.toArray().map(n => n.toFixed(2)), A.max.toArray().map(n => n.toFixed(2)), 'tri', v.map(w => w.map(n => n.toFixed(2)).join(','))); break; } } }
  return [...bad];
}
const built = {};
for (const [k, S] of Object.entries(KINDS)) { const g0 = SF.shopFront(S, k); built[k] = { g0, F: g0.userData.frame, frame: g0.getObjectByName('mm_front_frame') }; }

test('frames match the real lots (door width / door offset / balcony / plate from the generator)', () => {
  for (const [k, { F }] of Object.entries(built)) { const S = RENTABLE_SHOPS.find(r => r.id === F.id); assert.equal(F.doorW, S.doorW, k);
    assert.ok(Math.abs(F.xo - { rent_2: 0, rent_3: 0.4, rent_4: -3.1, rent_16: -2.4 }[F.id]) < 0.01, `${k} xo ${F.xo}`);
    const C = LOTS[F.B.lot].colliders.find(c => c[0] === 'b' && Math.abs(c[4] - 1.2) < 1e-6);   // the baked counter
    assert.ok(C && Math.abs((C[1] - F.xo) - F.counter.x) < 0.02 && Math.abs((C[2] - F.d / 2) - F.counter.z) < 0.02 && Math.abs(C[3] - (F.counter.w + 0.3)) < 0.02, `${k} counter ${C} vs ${JSON.stringify(F.counter)}`); }
  assert.deepEqual(Object.fromEntries(Object.entries(KINDS).map(([k, S]) => [k, S.shop])), { wanted: 'rent_2', fight: 'rent_16', rum: 'rent_3', fence: 'rent_4' });
  assert.ok(built.fence.g0, 'the Harbor Fence front is built (was skipped in v373: keyed by its buyer name)');
});
// the fitted joinery + counter are BUILT ROUND the baked counter / TO RENT board (they wrap them, asserted below); everything else must clear the shell
const WRAP = /^(join_body|join_face|counter_(body|face|top|nosing))$/;
test('no fitted fixture cuts the real building (LOD0 triangles), except the joinery / counter that wrap the baked counter + TO RENT board', () => {
  for (const [k, { F, frame }] of Object.entries(built)) { const list = boxes(frame, frame).filter(q => !WRAP.test(q.part));
    const hh = hits(F, list); if (!process.env.SF_DEBUG) assert.deepEqual(hh, [], k); }
});
test('architecture-integrated: back-wall joinery spans the room, full height, and the counter is fitted to it (no gap, wraps the baked counter)', () => {
  for (const [k, { F, frame }] of Object.entries(built)) { const one = (n) => { const l = boxes(frame, frame, 0).filter(q => q.part === n); assert.equal(l.length, 1, `${k} ${n}`); return l[0].aabb; };
    const J = one('join_body'), CB = one('counter_body'), C = F.counter, R = F.room;
    assert.ok(J.min.x <= R.xa + 0.3 && J.max.x >= R.xb - 0.3, `${k} joinery runs wall to wall (${J.min.x.toFixed(2)}..${J.max.x.toFixed(2)} in ${R.xa}..${R.xb})`);
    assert.ok(J.min.z <= R.back + 0.1 && J.max.y >= F.G - 0.7 && J.min.y <= F.floorAt(J.min.x) && J.min.y <= F.floorAt(J.max.x), `${k} joinery is against the back wall, floor to near the ceiling`);
    assert.ok(Math.abs(CB.min.z - J.max.z) < 0.02, `${k} counter is joined to the joinery face`);
    assert.ok(CB.min.x < C.x - (C.w + 0.2) / 2 - 0.02 && CB.max.x > C.x + (C.w + 0.2) / 2 + 0.02 && CB.max.z > C.z + 0.55 + 0.02 && CB.max.y > F.floorAt(C.x) + C.top + 0.02, `${k} counter wraps the baked counter`);
    assert.ok(CB.min.y <= Math.min(F.floorAt(CB.min.x), F.floorAt(CB.max.x)), `${k} counter sits on the floor (no feet / posts)`); }
});
test('each shop has its own fitted centrepiece (and the business hooks the v349 stands used)', () => {
  const NEED = { wanted: ['bounty_frame', 'bounty_cork', 'bounty_poster'], rum: ['backbar_mirror', 'backbar_shelf', 'backbar_bottles', 'cask', 'brass_rail'], fence: ['grille', 'grille_arch', 'strongbox'], fight: ['weapon_wall', 'weapon_rack', 'booking_slate'] };
  for (const [k, { g0, frame }] of Object.entries(built)) { const parts = new Set(boxes(frame, frame, 0).map(q => q.part)); for (const n of NEED[k]) assert.ok(parts.has(n), `${k} ${n}`);
    const J = boxes(frame, frame, 0).find(q => q.part === 'join_body').aabb, bf = k === 'fence' ? [] : boxes(frame, frame, 0).filter(q => q.part === NEED[k][0]);   // the fence's grille stands on its counter
    for (const q of bf) assert.ok(q.aabb.min.z >= J.min.z - 0.01 && q.aabb.max.z <= J.max.z + 0.25, `${k} ${q.part} is wall-mounted in the joinery`); }
  assert.equal(typeof built.wanted.g0.userData.setPosters, 'function'); built.wanted.g0.userData.setPosters([{ title: 'X', reward: 1 }]); built.wanted.g0.userData.setPosters([]);
  assert.ok(built.fight.g0.userData.gong?.rotation, 'fight gong hook');
});
test('no original booth geometry in the 4 shops, the outdoor buyer posts / crates still use it; E spots unchanged', async () => {
  for (const [k, { g0 }] of Object.entries(built)) { const bad = []; g0.traverse(o => { if (/^mm_(wanted_board|fight_master|rum_stall|buyer)$/.test(o.name)) bad.push(o.name);
    const p = o.isMesh && o.geometry?.parameters; if (o.visible && p && o.position.z < -0.5 && o.rotation.x > 0.15 && p.height <= 0.1 && p.depth >= 1.1) bad.push('stall roof'); }); assert.deepEqual(bad, [], k);
    const tall = boxes(g0.getObjectByName('mm_front_frame'), g0.getObjectByName('mm_front_frame'), 0).filter(q => q.aabb.max.z < -0.5 && q.aabb.min.z > g0.userData.frame.room.back + 0.7 && (q.aabb.max.x - q.aabb.min.x) < 0.2 && (q.aabb.max.z - q.aabb.min.z) < 0.2 && (q.aabb.max.y - q.aabb.min.y) > 1.2 && q.aabb.min.y < g0.userData.frame.floorAt((q.aabb.min.x + q.aabb.max.x) / 2) + 0.3);   // floor-standing poles (the fence grille stands on the counter)
    assert.deepEqual(tall.map(q => q.part), [], `${k}: no freestanding posts / poles in the room`); }
  const fs = await import('node:fs'), src = fs.readFileSync(new URL('../js/island/moneyMakers/index.js', import.meta.url), 'utf8');
  assert.ok(!/fitStand|STAND_SHIFT/.test(src), 'no stall fitting left');
  for (const n of ['P.wantedBoard()', 'P.fightMaster()', 'P.rumStall()', 'P.buyerPost(']) { const i = src.indexOf(n); assert.ok(i > 0, n); assert.ok(/fitted\([^;]*\(\) => put\($/.test(src.slice(Math.max(0, src.lastIndexOf('\n', i)), i)), `${n} is only the no-shop fallback`); }
  // and the real money-maker build: no stall at the 4 shops, outdoor posts / crates still built; E spots identical to v372 / v373
  const root = new THREE.Group(), stub = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : stub, apply: () => stub });
  const world = { root, ground: () => 0, water: () => null, footInteract: [] };
  MM.createMoneyMakers({ scene: root, world, layout: stub, walker: { w: { x: 0, z: 0 } }, pirate: stub, battle: stub, houses: null, fnet: null, game: stub, toast() {}, sfx: null, touch: null, pvp: () => null, updateHud() {} });
  const N = {}; root.traverse(o => { if (o.name) N[o.name] = (N[o.name] || 0) + 1; });
  assert.deepEqual([N.mm_wanted_board, N.mm_fight_master, N.mm_rum_stall, N.mm_buyer, N.mm_crate_stack > 0], [undefined, undefined, undefined, 2, true], JSON.stringify(N));
  const E = Object.fromEntries(world.footInteract.filter(q => /^mm_(wanted|fight|rum|buyer_harbor)$/.test(q.id)).map(q => [q.id, [+q.x.toFixed(3), +q.z.toFixed(3)]]));
  assert.deepEqual(E, { mm_wanted: [333.135, 53.028], mm_fight: [373.688, 78.812], mm_rum: [343.897, 51.698], mm_buyer_harbor: [355.031, 51.036] });
  const WAS = { wanted: [333.135, 51.428, 6.665], fight: [373.688, 80.412, 11.126], rum: [343.897, 50.298, 7.849], fence: [355.031, 51.036, 9.073] };
  for (const [k, S] of Object.entries(KINDS)) assert.deepEqual([S.x, S.z, S.y].map(v => +v.toFixed(3)), WAS[k], k);
  for (const line of ["spot('wanted', 'board', fx(SITES.wanted, 1.6), fz(SITES.wanted, 1.6), 3.0", "spot('fight', 'coliseum', fx(SITES.fight, 1.6), fz(SITES.fight, 1.6), 3.0", "spot('rum', 'rum', fx(SITES.rum, 1.4), fz(SITES.rum, 1.4), 3.0",
    "spot('buyer_' + k, 'buyer', s.x, s.z, C.CRATE.deliverR"]) assert.ok(src.includes(line), line);
});
test('doorway, the door -> E spot walk lane and the street lamps stay clear', () => {
  const LAMP = { rent_2: [-3.13], rent_3: [1.7], rent_4: [], rent_16: [-1.91] };   // foot.js street lamps (1.6 m out, head 3.4 - 4.0 m)
  for (const [k, { F, frame }] of Object.entries(built)) { const list = boxes(frame, frame, 0.005);
    const door = new THREE.Box3(new THREE.Vector3(-F.doorW / 2 + 0.05, 0.05, -1.2), new THREE.Vector3(F.doorW / 2 - 0.05, 2.6, 2.2));
    for (const q of list) assert.ok(!q.aabb.intersectsBox(door) || /^(rug|lamp_pool)$/.test(q.part), `${k} ${q.part} in the doorway`);
    const spot = { x: F.spot.x, z: F.spot.z }, n = 24;   // the lane: door sill -> the E spot, 1.3 m wide, to head height
    for (let i = 0; i <= n; i++) { const t = i / n, x = spot.x * t, z = -0.5 + (spot.z + 0.5) * t, fy = F.floorAt(x);
      const lane = new THREE.Box3(new THREE.Vector3(x - 0.65, fy + 0.05, z - 0.3), new THREE.Vector3(x + 0.65, fy + 2.1, z + 0.3));
      for (const q of list) assert.ok(!q.aabb.intersectsBox(lane) || /^(rug|lamp_pool)$/.test(q.part), `${k} ${q.part} blocks the walk lane at t=${t.toFixed(2)}`); }
    for (const lx of LAMP[F.id]) { const lb = new THREE.Box3(new THREE.Vector3(lx - 0.3, 0, 1.3), new THREE.Vector3(lx + 0.3, 4.1, 1.9)); for (const q of list) assert.ok(!q.aabb.intersectsBox(lb), `${k} ${q.part} hits the lamp`); }
    for (const q of list) if (q.aabb.max.z > 0.05) assert.ok(q.aabb.min.y > 2.3 || q.aabb.max.z < 0.45, `${k} ${q.part} sticks out over the pavement below head height`); }
});
test('signs: big fascia board on the balcony + both faces of the baked hanging plate + awning only where the lot has none', () => {
  for (const [k, { F, frame }] of Object.entries(built)) { const p = (n) => boxes(frame, frame, 0).filter(q => q.part === n);
    const fa = p('fascia')[0].aabb; assert.ok(fa.max.x - fa.min.x >= 4.4 && fa.min.y > F.G - 0.25 && fa.min.z >= F.bal.out - 0.001, `${k} fascia`);
    assert.equal(p('plate_face').length, 2, k); assert.equal(p('awning').length, F.B.awning || F.B.noAwning ? 0 : 1, k);
    assert.ok(fa.min.x >= F.bal.x0 && fa.max.x <= F.bal.x1, `${k} fascia within the balcony`); }
});
test('one name plate inside (on the joinery cornice), no second name board', () => {
  for (const [k, { frame }] of Object.entries(built)) { const inside = boxes(frame, frame, 0).filter(q => q.aabb.max.z < -0.5);
    assert.ok(!inside.some(q => /back_board|back_panel/.test(q.part)), `${k} doubled name board`);
    assert.equal(inside.filter(q => q.part === 'name_plate_face').length, 1, k); }
});
