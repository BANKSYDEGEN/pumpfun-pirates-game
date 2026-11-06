// [dock-ladders] BANKSY t1715u "also make it if jump off docks can climb up the ladders" + t1723u "Don't need clickable dock ladders
// just if ladder is there climb up" + [board-anywhere] t1722u "make it so they can board their ship anywhere around it".
// Pure checks in Node (the in-game audit of every ladder against the live walk world is tools-side: emerly-dock-ladder-shots/shot_ladders.py).
import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const PV = await import('../js/island/plazaTown.js');
const CO = await import('../js/island/coast.js');
const LG = await import('../js/island/areas/lagoon.js');
const LD = await import('../js/dock/ladders.js');
const { hullDist, boardReach, BOARD_REACH } = await import('../js/hullReach.js');
const CN = await import('../js/dock/canoe.js');
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const glbJson = (f) => { const b = readFileSync(new URL('../assets/island/' + f, import.meta.url)); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); };

const lagoon = { ...LG.LAGOON_LADDER, dock: LG.LAGOON_DOCK, y: LG.lagoonDockY() };
const CAT = LD.ladderCatalog({ PV, CO, lagoon, plazaV2: true });
const town = (lx, lz) => CO.toHarbor(...CO.t2w(lx, lz)), foot = (x, z) => CO.toHarbor(x, z);
const MAP = LD.mapLadders(CAT, { town, foot });
const by = (k) => CAT.filter(L => L.kind === k);

test('every ladder drawn in the game is registered: 20 jetty (10 end + 10 side), 7 boardwalk, the cove + the lagoon dock', () => {
  assert.equal(by('jetty_end').length, 10); assert.equal(by('jetty_side').length, 10);
  assert.equal(by('boardwalk').length, 7); assert.equal(by('cove').length, 1); assert.equal(by('lagoon').length, 1);
  assert.equal(new Set(CAT.map(L => L.id)).size, CAT.length);
  for (const j of PV.JETTIES) assert.equal(CAT.filter(L => L.jetty === j.id).length, 4, j.id);
  assert.deepEqual(LD.boardwalkLadderX(PV).map(Math.round), [-163, -123, -82, -62, -16, 36, 87]);
});

test('same spots as the art: docks_blender.py jetty / boardwalk ladders, foot.js cove ladder, lagoon.js dock ladder', () => {
  const py = src('tools/plaza_blender/docks_blender.py');
  assert.match(py, /ladder\(b, X \+ sx \* \(JW \/ 2 \+ 0\.2\), -\(lz0 \+ 8\), y, SEA - 1\.2, \(sx, 0\), lod\)/);
  assert.match(py, /ladder\(b, X \+ sx \* 2\.5, -\(lz1 \+ 0\.2\), y, SEA - 1\.2, \(0, -1\), lod\)/);
  assert.match(py, /for x in np\.arange\(lxa \+ 13, lxb - 2, 40\):.*\n\s+if not in_root\(x, 3\): ladder\(b, x, -\(BW\['lz1'\] \+ 0\.2\), bwY\(x\)/);
  for (const L of by('jetty_end')) { assert.ok(Math.abs(L.rung[1] - 59.35) < 1e-9); assert.deepEqual(L.out, [0, 1]); assert.ok(Math.abs(L.land[1] - 57.85) < 1e-9); }
  for (const L of by('jetty_side')) { const j = PV.JETTIES.find(q => q.id === L.jetty); assert.ok(Math.abs(Math.abs(L.rung[0] - j.lx) - 6.2) < 1e-9); assert.equal(L.rung[1], 15.5);
    assert.ok(L.land[1] <= 15.0, 'clear of the B1-B10 plaque board (lz 16.025..17.975)'); assert.equal(Math.abs(L.land[0] - j.lx), 4.5); assert.equal(L.yTop, j.y); }
  for (const L of by('boardwalk')) { assert.ok(Math.abs(L.rung[1] - 8.2) < 1e-9); assert.equal(L.land[1], 6.5); assert.ok(Math.abs(L.yTop - PV.bwY(L.rung[0])) < 1e-3); }
  const C = by('cove')[0], J = CO.SWIM_COVE.jetty; assert.deepEqual(C.rung, [J.lx1 + 2, J.lz - J.hw - 0.12]); assert.equal(C.yTop, J.y); assert.deepEqual(C.land, [J.lx1 + 2, J.lz]);
  assert.match(src('js/island/foot.js'), /at\(J\.lx1 \+ 2, J\.lz - J\.hw - 0\.12, 0, \(\) => \{.*swim ladder/);
  const G = by('lagoon')[0]; assert.deepEqual(G.rung, [-203, -96.4]); assert.deepEqual(G.land, [-205, -96.4]); assert.equal(G.frame, 'foot');
  assert.match(src('js/island/areas/lagoon.js'), /M\(DOCK\.x \+ DOCK\.hw \+ 0\.4, DOCK_Y - 0\.4 - i \* 0\.45, DOCK\.z1 \+ 0\.6\)/);
});

// the plaza walk replica: world.js deckAt over PV.harborParts decks + the docks GLB colliders + the plazaTown torch posts (foot.js hitCollider, r 0.45)
const parts = PV.harborParts((lx, lz) => town(lx, lz), CO.t2wYaw);
const decks = parts.decks.map(d => ({ ...d, c: Math.cos(d.yaw), s: Math.sin(d.yaw) }));
function deckAt(x, z) { let y = null; for (const d of decks) { const dx = x - d.x, dz = z - d.z, along = dx * d.s + dz * d.c, across = dx * d.c - dz * d.s;
  if (Math.abs(along) <= d.hl && Math.abs(across) <= d.hw - 0.35) y = Math.max(y ?? -1e9, d.y); } return y; }
const COLS = []; for (const n of glbJson('docks.glb').nodes) { const c = n.extras?.colliders; if (!c) continue; for (const q of JSON.parse(c)) COLS.push(q); }
for (const j of PV.JETTIES) for (const sx of [-1, 1]) { COLS.push(['c', j.lx + sx * (PV.JETTY.w / 2 - 0.6), PV.JETTY.lz1 - 1, 0.3]); COLS.push(['c', j.lx + sx * (PV.JETTY.w / 2 + 0.6), PV.BOARDWALK.lz1 - 0.6, 0.3]); }
const hitTown = (lx, lz, rad = 0.45) => COLS.some(q => q[0] === 'b' ? Math.abs(lx - q[1]) < q[3] / 2 + rad && Math.abs(lz - q[2]) < q[4] / 2 + rad : Math.hypot(lx - q[1], lz - q[2]) < q[3] + rad);

test('every plaza ladder lands on a walkable deck at its top (0.15 m) with zero collision (rails, bollards, coils, torches, plaques)', () => {
  assert.ok(COLS.length > 80, 'docks GLB colliders read');
  const M = new Map(MAP.map(L => [L.id, L]));
  for (const L of CAT.filter(q => q.frame === 'town' && q.kind !== 'cove')) { const H = M.get(L.id), y = deckAt(H.landX, H.landZ);
    assert.notEqual(y, null, L.id + ' on a deck'); assert.ok(Math.abs(y - L.yTop) < 0.15, `${L.id} deck ${y} vs top ${L.yTop}`);
    assert.ok(!hitTown(...L.land), L.id + ' landing clear of props'); assert.equal(deckAt(H.grabX, H.grabZ), null, L.id + ' grab point over the water'); }
  const bw62 = CAT.find(L => L.id === 'bw_-62'); assert.notEqual(bw62.land[0], bw62.rung[0], 'nudged off the BOLL bollard at lx -62 + its coil');
  // the cove: foot.js coveDeckAt is the walkway at J.y; the lagoon: Grandpa Gill's deck rect (x +- hw, z0 .. z1) clear of Gill + his barrels
  const C = by('cove')[0], J = CO.SWIM_COVE.jetty; assert.ok(J.lx0 - C.land[0] < J.lx0 - J.lx1 && Math.abs(C.land[1] - J.lz) <= J.hw);
  const G = by('lagoon')[0], D = LG.LAGOON_DOCK; assert.ok(Math.abs(G.land[0] - D.x) <= D.hw - 0.45 && G.land[1] <= D.z0 && G.land[1] >= D.z1 - 0.5);
  for (const [x, z, r] of [[-199.5, -61.5, 0.6], [D.x + 3.2, D.z0 + 2.2, 0.7]]) assert.ok(Math.hypot(G.land[0] - x, G.land[1] - z) > r + 0.45);
});

test('mapped ladders face the rungs (climb yaw = into the dock) and grab / face points sit out over the water', () => {
  for (const L of MAP) { const fx = Math.sin(L.climbYaw), fz = Math.cos(L.climbYaw); assert.ok(Math.abs(fx + L.outX) < 1e-9 && Math.abs(fz + L.outZ) < 1e-9, L.id);
    assert.ok(Math.abs(Math.hypot(L.grabX - L.x, L.grabZ - L.z) - LD.LADDER.grabOff) < 1e-9); assert.ok((L.landX - L.x) * L.outX + (L.landZ - L.z) * L.outZ < 0, L.id + ' lands inward'); }
});

// ---- the runtime with a fake world + walker: jump-off cooldown, swim-in auto climb, JUMP climb, no prompt ever ----
function rig(id = 'J4_end_e') {
  const L0 = MAP.find(L => L.id === id), top = L0.yTop, D = 30;
  const inDeck = (x, z) => { const u = (x - L0.x) * -L0.outX + (z - L0.z) * -L0.outZ, v = Math.abs((x - L0.x) * -L0.outZ + (z - L0.z) * L0.outX); return u > 0.25 && u < D && v < 6; };
  const world = { ground: (x, z) => (inDeck(x, z) ? top : -10), water: (x, z) => (inDeck(x, z) ? null : 0.05), blocked: () => false, deckAt: (x, z) => (inDeck(x, z) ? top : null), layer: () => {} };
  const layout = { CO, FM: { PV }, decks: [{ id: 'jetty_J1' }], footToHarbor: (x, z) => CO.toHarbor(x, z) };
  const w = { active: true, x: 0, z: 0, y: 0, yaw: 0, camYaw: 0, keys: {}, joy: { on: false, x: 0, y: 0 }, drags: new Map(), jumpQ: false, ride: null,
    body: { y: 0, vy: 0, air: false, swim: false, wade: 0, surf: null, off: 0, last: null, dip: 0, dipV: 0, climb: 0, climbD: 0, hop: false } };
  const pirate = { object: { userData: {} } }, crew = [{ x: 0, z: 0, y: -1.07, body: { swim: true, air: false } }];
  const crewF = { active: true, list: crew }, pet = { x: 0, z: 0, y: -1.07, body: { swim: true } }, petF = { active: true, state: pet };
  const lad = LD.createLadders({ world, layout, walker: { w }, pirate, crewF, petF, lagoon });
  const L = lad.list.find(q => q.id === id);
  const swimAt = (d, ahead = 0) => { w.x = L.grabX + L.outX * d; w.z = L.grabZ + L.outZ * d; w.y = -1.07; Object.assign(w.body, { swim: true, air: false, y: -1.07 }); for (const c of [...crew, pet]) { c.x = w.x + 1; c.z = w.z; c.y = -1.07; c.body.swim = true; } };
  const toward = () => { w.camYaw = L.climbYaw; w.keys = { KeyW: true }; }, away = () => { w.camYaw = L.climbYaw + Math.PI; w.keys = { KeyW: true }; };
  const run = (n = 40) => { let r = null; for (let i = 0; i < n && w.ride; i++) r = w.ride(1 / 30); if (r === 'done') { w.body.swim = false; w.body.y = w.y; } return r; };
  return { lad, L, w, world, crew, pet, swimAt, toward, away, run };
}

test('jumping off the dock next to a ladder never climbs straight back up (air + the entry cooldown), then swimming into it does', () => {
  const { lad, L, w, swimAt, toward, run, crew, pet } = rig();
  swimAt(0.2); toward(); Object.assign(w.body, { air: true, swim: false, vy: -6 }); w.y = 1.5;   // falling past the ladder on the way down
  for (let i = 0; i < 6; i++) lad.tick(1 / 30); assert.equal(w.ride, null, 'no climb in the air');
  Object.assign(w.body, { air: false, swim: true }); w.y = -1.07; w.jumpQ = true;            // splash right at the rungs, still holding W + a jump press
  let t = 0; while (t < LD.LADDER.entryCool - 0.1) { lad.tick(1 / 30); t += 1 / 30; assert.equal(w.ride, null, `no climb ${t.toFixed(2)} s after the splash`); w.jumpQ = true; }
  for (let i = 0; i < 10 && !w.ride; i++) lad.tick(1 / 30); assert.ok(w.ride, 'past the cooldown: swimming into it climbs');
  assert.equal(run(), 'done'); assert.equal(w.y, L.yTop); assert.equal(w.x, L.landX); assert.equal(w.z, L.landZ); assert.equal(w.body.swim, false); assert.equal(w.yaw, L.climbYaw);
  assert.ok(crew.every(c => !c.body.swim && c.y === L.yTop) && !pet.body.swim && pet.y === L.yTop, 'crew + pet came up too');
  lad.tick(1 / 30); assert.equal(w.ride, null, 'standing on the deck: nothing');
});

test('auto climb: swim into the ladder (<= grabR, moving at it), touch its rungs, or JUMP within jumpR; never swimming away / far off', () => {
  { const { lad, w, swimAt, away } = rig(); swimAt(1.0); away(); for (let i = 0; i < 40; i++) lad.tick(1 / 30); assert.equal(w.ride, null, 'swimming away'); }
  { const { lad, w, swimAt, toward } = rig(); swimAt(LD.LADDER.grabR + 0.3); toward(); for (let i = 0; i < 40; i++) lad.tick(1 / 30); assert.equal(w.ride, null, 'too far'); }
  { const { lad, w, swimAt, toward, run } = rig(); swimAt(1.2); toward(); lad.tick(1 / 30); assert.ok(w.ride, 'swim into it'); assert.equal(run(), 'done'); }
  { const { lad, w, swimAt } = rig(); swimAt(0.5); w.keys = {}; lad.tick(1 / 30); assert.ok(w.ride, 'touching the rungs (no input)'); }
  { const { lad, w, swimAt, run, L } = rig('bw_36'); swimAt(2.0); w.keys = {}; w.jumpQ = true; lad.tick(1 / 30); assert.ok(w.ride, 'JUMP next to it'); assert.equal(w.jumpQ, false, 'the jump is eaten (no surface kick)'); assert.equal(run(), 'done'); assert.equal(w.y, L.yTop); }
  { const { lad, w, swimAt } = rig(); swimAt(3.0); w.jumpQ = true; lad.tick(1 / 30); assert.equal(w.ride, null, 'JUMP too far'); }
});

test('the climb path: onto the rung face, straight up, over the top hoop, ending exactly on the landing at the deck top', () => {
  const { L } = rig(); const x0 = L.grabX + L.outX, z0 = L.grabZ + L.outZ, y0 = -1.07; let prevY = -9;
  for (let k = 0; k < LD.LADDER.upK; k += 0.02) { const p = LD.climbPath(L, x0, y0, z0, k); assert.ok(p.y >= prevY - 1e-9); prevY = p.y; if (k > 0.25) assert.ok(Math.hypot(p.x - L.faceX, p.z - L.faceZ) < 0.02, 'on the rungs while going up'); }
  const end = LD.climbPath(L, x0, y0, z0, 1); assert.equal(end.x, L.landX); assert.equal(end.z, L.landZ); assert.equal(end.y, L.yTop);
  assert.ok(LD.rideTime(4) >= LD.LADDER.T && LD.rideTime(4) <= LD.LADDER.Tmax && LD.rideTime(1) === LD.LADDER.T);
});

test('NO clickable ladder: no CLIMB LADDER prompt / button anywhere (BANKSY t1723u), the E button stays free', () => {
  const { lad } = rig(); assert.equal(lad.prompt, undefined);
  for (const f of ['js/dock/ladders.js', 'js/dock/index.js']) assert.doesNotMatch(src(f).replace(/\/\/.*$/gm, ''), /CLIMB LADDER|ladders\.prompt|ladders\?\.prompt/);
  const ix = src('js/dock/index.js'); assert.match(ix, /ladders\?\.tick\(dt\);.*walker\.update\(dt\)/); assert.match(ix, /else if \(ladders\?\.climbing\) setActs\(null, null\)/);
  const wk = src('js/onfoot/walker.js'); assert.match(wk, /if \(w\.ridePose\) w\.pose = w\.ridePose;/);
  assert.match(src('js/onfoot/swimPose.js'), /else if \(sw\.st === 'ladder'\) ladder\(S, R, dir, sw\.kk\)/);
});

// ---- [board-anywhere] ----
const ship = (x = 100, z = 50, yaw = 0.7) => ({ x, z, yaw, alive: true, mesh: { userData: { hitLen: 44.1, beam: 10.4 } } });
const around = (s, a, b) => [s.x + Math.sin(s.yaw) * a + Math.cos(s.yaw) * b, s.z + Math.cos(s.yaw) * a - Math.sin(s.yaw) * b];
const SIDES = (s, m) => ({ bow: around(s, 22.05 + m, 0), stern: around(s, -22.05 - m, 0), port: around(s, 0, -5.2 - m), starboard: around(s, 0, 5.2 + m) });

test('BOARD SHIP 360 deg round your moored ship (bow / stern / port / starboard), on the pier or swimming; not from far off', () => {
  const s = ship(), b = { ashore: { x: s.x + 40, z: s.z } };
  for (const [k, [x, z]] of Object.entries(SIDES(s, 4))) { assert.ok(hullDist(s, x, z) <= BOARD_REACH.hull, k); assert.ok(boardReach({ x, z, swim: true }, b, s), k + ' swimming'); assert.ok(boardReach({ x, z }, b, s), k + ' on the pier'); }
  for (const [k, [x, z]] of Object.entries(SIDES(s, 7))) assert.ok(!boardReach({ x, z }, b, s), k + ' too far');
  assert.ok(boardReach({ x: b.ashore.x + 3, z: b.ashore.z }, b, s), 'the old step-ashore spot still works');
  assert.ok(!boardReach({ x: SIDES(s, 1).bow[0], z: SIDES(s, 1).bow[1] }, b, { ...s, alive: false }), 'sunk: no');
  const ix = src('js/dock/index.js'); assert.match(ix, /docking\.mode === 'docked' && boardReach\(W, b, s\)\) \{ const wet = !!W\.swim;/); assert.match(ix, /canoe\?\.clearAll\?\.\(s\); goAboard\(wet\)/);
});

test('un-moored ship: BOARD SHIP swimming / on the shore round its hull, and from the canoe anywhere round the (long) hull', () => {
  const s = ship(), st = { mode: 'sea' }, docking = { mode: 'sea', berths: [] };
  for (const [k, [x, z]] of Object.entries(SIDES(s, 4))) assert.ok(hullDist(CN.shipRefOf(s, st), x, z) <= CN.BOARD_HULL.foot, k);
  // canoe out: the anchored pose is the ship
  const st2 = { mode: 'canoe', ax: s.x, az: s.z, ayaw: s.yaw }; for (const [k, [x, z]] of Object.entries(SIDES(s, 6))) assert.ok(hullDist(CN.shipRefOf(s, st2), x, z) <= CN.BOARD_HULL.canoe, 'canoe ' + k);
  assert.ok(Math.hypot(SIDES(s, 6).bow[0] - s.x, SIDES(s, 6).bow[1] - s.z) > CN.SAIL.canoeR, 'the bow of a long hull is past the old centre radius');
  const cs = src('js/dock/canoe.js');
  assert.match(cs, /nearShip = dShip < SAIL\.canoeR \|\| \(!!s && hullDist\(shipRefOf\(s, st\), st\.cx, st\.cz\) <= BOARD_HULL\.canoe\)/);
  assert.match(cs, /if \(onFoot && W && s\?\.alive && !\(s\.sinking > 0\) && \(!docking \|\| docking\.mode === 'sea'\) && hullDist\(shipRefOf\(s, st\), W\.x, W\.z\) <= BOARD_HULL\.foot\)/);
  assert.match(cs, /clearAll\(s, controls\); if \(away\) \{ s\.x = st\.ax;/);
  void docking;
});
