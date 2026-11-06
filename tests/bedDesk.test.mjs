// [bed-desk] BANKSY t405u / t406u: LIE IN BED + SIT AT DESK in the ship hull (Captain's Quarters) and every cottage cabin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { hullRestSpots, cabinRestSpots, restPrompt, pickSeat, restTransform, lieHead, createRest, REST_LABEL, REST_GRACE_S, BED_DESK_ON } from '../js/dock/bedDesk.js';
import { REST_POSES } from '../js/onfoot/swimPose.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const HULL = read('js/dock/shipHull.js'), HOUSES = read('js/dock/houses.js'), DOCK = read('js/dock/index.js');
const BATTLE = read('js/onfoot/battle.js'), PAD = read('js/gamepad.js'), WALKER = read('js/onfoot/walker.js'), SWIM = read('js/onfoot/swimPose.js');
const inBox = (x, z, b, m = 0) => x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 - m && z <= b.z1 + m;
const hitsCollider = (x, z, cols, pad) => cols.some((c) => Math.abs(x - c.x) <= c.w / 2 + pad && Math.abs(z - c.z) <= c.d / 2 + pad);
// the hull colliders + room size (buildCaptainsQuartersRoom literal values)
const HULL_W = 11.6, HULL_D = 11.0;
const HULL_COLS = [
  { x: 0, z: -HULL_D / 2 + 0.45, w: 8.6, d: 0.85 }, { x: 2.75, z: -1.7, w: 1.35, d: 2.35 }, { x: 2.75, z: -3.28, w: 0.75, d: 0.65 },
  { x: 1.77, z: -1.55, w: 0.55, d: 0.55 }, { x: 3.73, z: -1.95, w: 0.55, d: 0.55 }, { x: HULL_W / 2 - 1.25, z: 2.65, w: 1.55, d: 2.85 },
  { x: HULL_W / 2 - 0.8, z: 0.95, w: 0.6, d: 0.65 }, { x: -HULL_W / 2 + 1.25, z: -0.55, w: 1.1, d: 1.7 }, { x: -4.85, z: -2.95, w: 1.02, d: 1.52 },
  { x: -4.36, z: -4.13, w: 0.68, d: 0.68 }, { x: -HULL_W / 2 + 0.75, z: 3.25, w: 1.3, d: 1.9 }, { x: -4.55, z: HULL_D / 2 - 0.3, w: 1.85, d: 0.6 },
  { x: 2.85, z: HULL_D / 2 - 0.3, w: 1.72, d: 0.56 },
];
const cabinCols = (W, D) => [
  { x: 0, z: -D / 2 + 0.7, w: 2.9, d: 1.1 }, { x: -W / 2 + 1.7, z: D / 2 - 1.5, w: 2.6, d: 1.5 }, { x: W / 2 - 2.1, z: 0.35, w: 2.1, d: 1.4 },
  { x: -W / 2 + 1.15, z: -0.55, w: 1.05, d: 1.55 }, { x: W / 2 - 0.7, z: -D / 2 + 1.6, w: 1.3, d: 2.0 }, { x: -W / 2 + 0.55, z: -2.35, w: 0.9, d: 1.8 },
];
const TIERS = [['cozy', 10, 9], ['captain', 12, 10.5], ['manor', 14, 12]];
const ROOMS = [['hull', hullRestSpots(), HULL_COLS, 0.3], ...TIERS.map(([t, W, D]) => [t, cabinRestSpots(W, D), cabinCols(W, D), 0.34])];

test('feature flag defaults on and the prompt labels match the brief', () => {
  assert.equal(BED_DESK_ON, true);
  assert.equal(REST_LABEL.bed, 'LIE IN BED'); assert.equal(REST_LABEL.desk, 'SIT AT DESK'); assert.equal(REST_LABEL.getup, 'GET UP');
});

for (const [name, spots, cols, pad] of ROOMS) {
  test(`${name}: lying pose sits inside the mattress, along the bed, above the mattress top`, () => {
    const b = spots.bed.bounds, p = spots.bed.pose, h = lieHead(spots.bed), mid = lieHead(spots.bed, 0.55);
    assert.ok(inBox(p.x, p.z, b), 'feet on the mattress');
    assert.ok(inBox(h.x, h.z, b), 'head on the mattress');
    assert.ok(inBox(mid.x, mid.z, b), 'hips on the mattress');
    const along = Math.abs(Math.sin(p.yaw)) > 0.99 ? 'x' : 'z', len = along === 'x' ? b.x1 - b.x0 : b.z1 - b.z0, wid = along === 'x' ? b.z1 - b.z0 : b.x1 - b.x0;
    assert.ok(len > wid, 'the body lies along the long side of the bed');
    assert.ok(p.y > b.top + 0.05 && p.y < b.top + 0.35, `back above the mattress, not floating (${p.y} vs ${b.top})`);
    const tf = restTransform('lie', spots.bed); assert.equal(tf.tilt, -Math.PI / 2, 'laid flat on the back');
  });
  test(`${name}: every desk seat faces the desk, close enough for the hands, at seat height`, () => {
    const d = spots.desk.desk, cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2;
    assert.ok(spots.desk.seats.length >= 2);
    for (const s of spots.desk.seats) {
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), tx = cx - s.x, tz = cz - s.z, n = Math.hypot(tx, tz);
      assert.ok((fx * tx + fz * tz) / n > 0.7, `seat ${s.x},${s.z} faces the desk`);
      assert.ok(!inBox(s.x, s.z, d), 'seat is beside the desk, not in it');
      assert.ok(inBox(s.x, s.z, d, 0.75), 'seat within arm reach of the desk edge');
      assert.ok(d.top > s.seat + 0.15, 'desk top above the seat');
      assert.ok(Math.abs(s.y + 0.5 - (s.seat + 0.04)) < 0.08, 'hips (0.5 m above the feet) rest on the seat cushion');
      assert.equal(restTransform('sit', spots.desk, s).tilt, 0);
    }
  });
  test(`${name}: get-up spots are clear of every furniture collider and the prompts are in reach`, () => {
    for (const sp of [spots.bed.stand, ...spots.desk.seats.map((s) => s.stand)]) assert.ok(!hitsCollider(sp.x, sp.z, cols, pad), `stand ${sp.x},${sp.z} clear`);
    assert.equal(restPrompt(spots, spots.bed.stand.x, spots.bed.stand.z)?.tag, 'bed');
    for (const s of spots.desk.seats) assert.equal(restPrompt(spots, s.stand.x, s.stand.z)?.tag, 'desk', `desk prompt from ${s.stand.x},${s.stand.z}`);
    assert.equal(restPrompt(spots, 0, 0)?.tag ?? null, null, 'mid-room: no prompt');
  });
}

test('pickSeat takes the chair nearest the pirate', () => {
  const sp = hullRestSpots().desk;
  assert.equal(pickSeat(sp, 1.1, -1.5), sp.seats[0]); assert.equal(pickSeat(sp, 4.4, -2), sp.seats[1]); assert.equal(pickSeat(sp, 2.7, -3.9), sp.seats[2]);
});

test('both interiors register the rest spots + LIE IN BED / SIT AT DESK / GET UP prompts', () => {
  assert.match(HULL, /rest: hullRestSpots\(\)/); assert.match(HULL, /restPrompt\(interior\.userData\.rest, lx, lz\)/);
  assert.match(HULL, /tag === 'bed' \|\| tag === 'desk'/); assert.match(HULL, /tag === 'getup'/); assert.match(HULL, /rest\.apply\(\)/); assert.match(HULL, /rest\.end\('leave'\)/);
  assert.match(HOUSES, /rest: cabinRestSpots\(W, D\)/); assert.match(HOUSES, /restPrompt\(interior\.userData\.rest, lx, lz\)/);
  assert.match(HOUSES, /tag === 'bed' \|\| tag === 'desk'/); assert.match(HOUSES, /tag === 'getup'/); assert.match(HOUSES, /rest\.apply\(\)/); assert.match(HOUSES, /rest\.end\('leave'\)/);
  // the room camera frames the lying / seated body
  assert.match(HULL, /rest\.focus\(\)/); assert.match(HOUSES, /rest\.focus\(\)/);
  // the cabin chairs' backrests sit on the far side of the table (you face the desk)
  assert.match(HOUSES, /cz \+ \(cry \? -0\.22 : 0\.22\)/);
});

test('the built Captain\'s Quarters carries the spots; every cabin tier passes its own W / D', async () => {
  const { buildCaptainsQuartersRoom } = await import('../js/dock/shipHull.js');
  const q = buildCaptainsQuartersRoom({ low: true }); assert.deepEqual(q.userData.rest, hullRestSpots());
  assert.equal(q.userData.W, HULL_W); assert.equal(q.userData.D, HULL_D);
  for (const c of [{ x: 2.75, z: -1.7 }, { x: HULL_W / 2 - 1.25, z: 2.65 }]) assert.ok(q.userData.colliders.some((k) => k.x === c.x && k.z === c.z), 'berth + chart table colliders still there');
  // cottage cabins (houses.js pulls in browser-only modules at import: source contract instead)
  assert.match(HOUSES, /const W = tier === 'manor' \? 14 : tier === 'captain' \? 12 : 10;/); assert.match(HOUSES, /const D = tier === 'manor' \? 12 : tier === 'captain' \? 10\.5 : 9;/);
  assert.match(HOUSES, /const bx = -W \/ 2 \+ 1\.85, bz = D \/ 2 - 1\.55;/); assert.match(HOUSES, /const tx = W \/ 2 - 2\.2, tz = 0\.2;/);
});

// ---- the enter / exit state machine on a fake walker ----
function rig(t0 = 0) {
  const clock = { t: t0 }, origin = { x: 3200, y: 140, z: 3200 }, room = { on: true };
  const w = { x: 3200, y: 140.14, z: 3203, yaw: 0, camYaw: 0, pitch: 0.2, speed: 0, vy: 0, air: false, keys: {}, joy: { x: 0, y: 0, on: false }, active: true, jumpQ: false };
  const object = new THREE.Group(); object.userData = {};
  const changes = [];
  const rest = createRest({ walker: { w }, pirate: { object }, getOrigin: () => (room.on ? origin : null), now: () => clock.t, onChange: (k, why) => changes.push([k, why]) });
  return { clock, origin, room, w, object, rest, changes };
}
test('LIE IN BED: snaps onto the mattress laid flat, E (GET UP) stands you up beside the bed', () => {
  const { w, object, rest, origin, changes } = rig(); const sp = hullRestSpots().bed;
  assert.equal(rest.begin('bed', sp, 3.1, 2.6), true); assert.equal(rest.posed, true); assert.equal(rest.kind, 'lie'); assert.equal(w.rest, 'lie');
  assert.equal(rest.begin('desk', hullRestSpots().desk), false, 'one pose at a time');
  rest.apply();
  assert.ok(Math.abs(object.rotation.x + Math.PI / 2) < 1e-9); assert.equal(object.rotation.y, sp.pose.yaw);
  assert.ok(Math.abs(object.position.y - (origin.y + sp.pose.y)) < 1e-9); assert.ok(Math.abs(object.position.x - (origin.x + sp.pose.x)) < 1e-9);
  assert.deepEqual(rest.prompt(), { label: 'GET UP', key: 'E', primary: true, tag: 'getup' });
  const f = rest.focus(); assert.ok(f && f.dMax <= 3.5, 'the camera pulls in on the bunk');
  assert.equal(rest.end('getup'), true); assert.equal(rest.posed, false); assert.equal(w.rest, null);
  assert.ok(Math.abs(w.x - (origin.x + sp.stand.x)) < 1e-9 && Math.abs(w.z - (origin.z + sp.stand.z)) < 1e-9, 'standing beside the bed');
  assert.equal(object.rotation.x, 0, 'upright again'); assert.equal(rest.prompt(), null); assert.equal(rest.focus(), null);
  assert.deepEqual(changes.map((c) => c[0]), ['lie', null]);
});
test('SIT AT DESK: nearest chair, facing the desk; walking after the grace stands you up, not before', () => {
  const { w, object, rest, clock, origin } = rig(); const sp = cabinRestSpots(12, 10.5).desk;
  rest.begin('desk', sp, sp.seats[1].stand.x, sp.seats[1].stand.z); rest.apply();
  assert.equal(rest.kind, 'sit'); assert.equal(rest.state.seat, sp.seats[1]); assert.equal(object.rotation.x, 0); assert.equal(object.rotation.y, sp.seats[1].yaw);
  w.keys.KeyW = true; clock.t = REST_GRACE_S * 0.5; assert.equal(rest.update(), false, 'the key still held from the walk up is ignored'); assert.equal(rest.posed, true);
  clock.t = REST_GRACE_S + 0.1; assert.equal(rest.update(), true); assert.equal(rest.posed, false);
  assert.ok(Math.abs(w.z - (origin.z + sp.seats[1].stand.z)) < 1e-9, 'up behind the chair');
});
test('JUMP, the stick, leaving the room and a hit all stand you up cleanly', () => {
  let r = rig(); r.rest.begin('bed', cabinRestSpots(10, 9).bed); r.clock.t = 1; r.w.jumpQ = true; assert.equal(r.rest.update(), true); assert.equal(r.w.jumpQ, false, 'the jump is eaten (no hop off the mattress)');
  r = rig(); r.rest.begin('bed', cabinRestSpots(10, 9).bed); r.clock.t = 1; r.w.joy = { on: true, x: 0, y: -0.9 }; assert.equal(r.rest.update(), true);
  r = rig(); r.rest.begin('desk', hullRestSpots().desk, 1, -1.5); r.clock.t = 1; r.w.joy = { on: true, x: 0.1, y: 0.1 }; assert.equal(r.rest.update(), false, 'a resting thumb on the stick is not a walk');
  r.room.on = false; assert.equal(r.rest.update(), true, 'room gone = up'); assert.equal(r.changes.at(-1)[1], 'leave');
  r = rig(); r.rest.begin('bed', hullRestSpots().bed); assert.equal(r.rest.end('hit'), true); assert.equal(r.rest.posed, false); assert.equal(r.rest.end('hit'), false, 'already up');
  r = rig(); r.room.on = false; assert.equal(r.rest.begin('bed', hullRestSpots().bed), false, 'not inside = no pose');
});

test('controls are locked while posed: the real walker does not move, jump or fall', async () => {
  const prevAdd = globalThis.addEventListener; globalThis.addEventListener = () => {};
  try {
    const { createWalker } = await import('../js/onfoot/walker.js');
    const world = { ground: () => 0, water: () => null, stand: () => 0, blocked: () => false };
    const object = new THREE.Group(); const states = [];
    const pirate = { object, update: (dt, speed, st) => states.push([speed, st]) };
    const camera = new THREE.PerspectiveCamera(60, 1.6, 0.1, 100);
    const walker = createWalker({ camera, canvas: { addEventListener() {} }, world, pirate, touch: false });
    walker.enter(5, 5, 0); const w = walker.w;
    w.rest = 'lie'; w.keys.KeyW = true; w.jumpQ = true;
    for (let i = 0; i < 30; i++) walker.update(1 / 30);
    assert.equal(w.x, 5); assert.equal(w.z, 5); assert.equal(w.jumps, 0, 'no jump'); assert.equal(w.speed, 0); assert.equal(w.air, false);
    assert.deepEqual(states.at(-1), [0, 'lie'], 'the pirate gets the lie pose');
    w.rest = 'sit'; walker.update(1 / 30); assert.deepEqual(states.at(-1), [0, 'sit']);
    w.rest = null; w.jumpQ = false; for (let i = 0; i < 10; i++) walker.update(1 / 30); assert.ok(w.z > 5.2, 'walks again once up');
  } finally { globalThis.addEventListener = prevAdd; }
});

test('weapons, attacks, emotes and the pad are wired to the pose', () => {
  assert.match(BATTLE, /posed = \(\) => false/); assert.match(BATTLE, /if \(s && \(inHouse\?\.\(\) \|\| posed\?\.\(\)\)\) return false;/);
  assert.match(BATTLE, /if \(posed\?\.\(\)\) return false; \/\/ \[bed-desk\] no swings/); assert.match(BATTLE, /me\.stance && \(inHouse\?\.\(\) \|\| posed\?\.\(\)\)\) setStance\(0, true\)/);
  assert.match(DOCK, /posed: \(\) => restPosed\(\)/); assert.match(DOCK, /standUp\('hit'\)/); assert.match(DOCK, /!pirate\.object\.visible \|\| restPosed\(\)\) return null;/);
  assert.match(DOCK, /standUp: \(\) => standUp\('pad'\)/); assert.match(PAD, /if \(D\?\.posed\?\.\(\)\) D\.standUp\?\.\(\)/);
  assert.match(WALKER, /if \(w\.rest\) \{/); assert.deepEqual([...REST_POSES], ['lie', 'sit']);
  assert.match(SWIM, /state === 'lie' \|\| state === 'sit'/);
});

test('no new multiplayer wire fields (private interiors: the pose is local only)', () => {
  const BD = read('js/dock/bedDesk.js'); assert.doesNotMatch(BD, /netState|broadcast|postMessage|pvp\(/);
  assert.doesNotMatch(read('js/onfoot/net.js'), /\bw\.rest\b/);
});

// ---- [t408u] BANKSY "Also make it so they can change clothes in hull and cabin" ----
test('CHANGE CLOTHES: label + a wardrobe spot in the hull and every cabin tier', () => {
  assert.equal(REST_LABEL.wardrobe, 'CHANGE CLOTHES');
  for (const [name, spots, cols, pad] of ROOMS) {
    const s = spots.wardrobe, W = name === 'hull' ? HULL_W : TIERS.find((t) => t[0] === name)[1], D = name === 'hull' ? HULL_D : TIERS.find((t) => t[0] === name)[2];
    assert.equal(s.kind, 'wardrobe', name); assert.equal(s.label, 'CHANGE CLOTHES', name);
    assert.ok(Math.abs(s.prop.x) + s.prop.w / 2 < W / 2 && Math.abs(s.prop.z) + s.prop.d / 2 < D / 2, `${name}: the prop is inside the room`);
    assert.ok(!hitsCollider(s.x, s.z, cols, pad), `${name}: you can stand at the prompt spot`);
    assert.ok(!cols.some((c) => Math.abs(s.prop.x - c.x) < (s.prop.w + c.w) / 2 && Math.abs(s.prop.z - c.z) < (s.prop.d + c.d) / 2), `${name}: the prop does not overlap other furniture`);
    const hit = restPrompt(spots, s.x, s.z); assert.equal(hit?.tag, 'wardrobe', `${name}: standing at it prompts CHANGE CLOTHES`);
    assert.equal(hit.label, 'CHANGE CLOTHES');
    // still LIE IN BED / SIT AT DESK at their own spots
    assert.equal(restPrompt(spots, spots.bed.x, spots.bed.z)?.tag, 'bed', name); assert.equal(restPrompt(spots, spots.desk.x, spots.desk.z)?.tag, 'desk', name);
  }
});

test('CHANGE CLOTHES: the built hull has the sea chest prop + collider', async () => {
  const { buildCaptainsQuartersRoom } = await import('../js/dock/shipHull.js');
  const q = buildCaptainsQuartersRoom({ low: true }), p = hullRestSpots().wardrobe.prop;
  assert.ok(q.getObjectByName('qs_wardrobe'), 'sea chest mesh');
  assert.ok(q.userData.colliders.some((c) => c.x === p.x && c.z === p.z && c.w === p.w && c.d === p.d), 'collider matches the spot');
  assert.match(HOUSES, /'hs_wardrobe'/); assert.match(HOUSES, /\{ x: W \/ 2 - 0\.6, z: D \/ 2 - 1\.35, w: 0\.6, d: 1\.2 \}/);
});

test('CHANGE CLOTHES opens the existing island shop CHANGING ROOM (owned clothes, nothing to buy)', async () => {
  const { VENDORS } = await import('../js/shopCatalog.js');
  const V = VENDORS.wardrobe; assert.ok(V, 'WARDROBE vendor'); assert.deepEqual(V.tabs, ['wardrobe']); assert.ok(!V.dress && !V.crew, 'owned clothes only');
  assert.deepEqual(V.slots, VENDORS.clothes.slots, 'same clothing slots as the CLOTHES SHOP changing room');
  assert.match(DOCK, /function openWardrobe\(/); assert.match(DOCK, /window\.openShop\(\{ vendor: 'wardrobe', tab: 'wardrobe', from \}\)/);
  assert.equal((DOCK.match(/openWardrobe: \(from\) => openWardrobe\(from\)/g) || []).length, 2, 'passed to both the hull and the cabins');
  assert.match(HULL, /if \(tag === 'wardrobe'\) \{ try \{ openWardrobe\?\.\('hull'\)/); assert.match(HOUSES, /if \(tag === 'wardrobe'\) \{ closeStorage\(\); try \{ openWardrobe\?\.\('cabin'\)/);
  // PC (E), phone (the act button) and controller (A) all go through the same setActs prompt → act(tag) path as the bed / desk
  assert.match(read('js/dock/bedDesk.js'), /for \(const tag of \['bed', 'desk', 'wardrobe'\]\)/);
});
