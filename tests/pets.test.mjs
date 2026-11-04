// [Raul items redo 2] pets: BANKSY 10:36 AM 2026-11-04 "have the cat and monkey follow you around like crew does, make the parrot fly
// around and land back on shoulder" + "make monkey bigger" (knee to hip) + 10:53 AM chimp (hip) / gorilla + white gorilla (chest).
// Pure motion (js/petMotion.js), the shared follow pathing (js/onfoot/followPath.js), the GLBs (rig, floor, size, budgets), the beards,
// and the shop / server wiring.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GROUND_PETS, PET_FOLLOW, PET_SIT, newPetState, petPose, FLIGHT, FLIGHT_T, birdFlight, newBirdState, birdTick, isBird, isGroundPet } from '../js/petMotion.js';
import { makeTrail, makeMover, followStep } from '../js/onfoot/followPath.js';
import { PET_RIG } from '../js/petRig.js';
import { BOOSTS, BOOST_STATS } from '../js/boosts.js';
import { GEAR_ITEMS } from '../js/shopCatalog.js';
const ROOT = new URL('../', import.meta.url), txt = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const seq = (a) => { let i = 0; return () => a[i++ % a.length]; };
const KNEE = 0.214, HIP = 0.402, BODY_H = 1.40;   // the v5 male in bind space (m)
// the hip JOINT (0.40) sits at the crotch on this chibi body; what reads as "your hip" is the sash / belt line, ~0.50 (measured off the pf renders)
const SASH = 0.50;

// ------------------------------------------------------------ GLB reader (every mesh / primitive, node transforms are identity)
function glb(path) {
  const b = readFileSync(new URL(path, ROOT)); const jl = b.readUInt32LE(12); const J = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = b.subarray(20 + jl + 8), dv = new DataView(bin.buffer, bin.byteOffset); const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const SZ = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }, RD = { 5121: (o) => dv.getUint8(o), 5123: (o) => dv.getUint16(o, true), 5125: (o) => dv.getUint32(o, true), 5126: (o) => dv.getFloat32(o, true) };
  const acc = (i) => { const a = J.accessors[i], v = J.bufferViews[a.bufferView], n = N[a.type], s = SZ[a.componentType], st = v.byteStride || n * s, off = (v.byteOffset || 0) + (a.byteOffset || 0), out = new Float64Array(a.count * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = RD[a.componentType](off + k * st + c * s); return out; };
  const prims = []; for (const m of J.meshes) for (const p of m.primitives) prims.push({ P: acc(p.attributes.POSITION), UV: p.attributes.TEXCOORD_0 != null ? acc(p.attributes.TEXCOORD_0) : null, tris: (p.indices != null ? J.accessors[p.indices].count : J.accessors[p.attributes.POSITION].count) / 3 });
  return { J, prims, tris: prims.reduce((s, p) => s + p.tris, 0) };
}
const PETS = Object.keys(GROUND_PETS);
const LO_BUDGET = { pet_cat: 1400, pet_cat_black: 1400, pet_monkey: 1660, pet_chimp: 1700, pet_gorilla: 2000, pet_gorilla_white: 2000, pet_tiger: 2000 };
for (const id of PETS) for (const lod of ['hi', 'lo']) for (const who of ['male', 'female']) test(`${id} ${who} ${lod}: rig parts, feet on the floor at the anchor, budget`, () => {
  const G = glb(`assets/pirates/items/v5/${id}_${who}_${lod}.glb`), R = PET_RIG[id]; let ymin = 9, ymax = -9; const parts = new Set();
  for (const p of G.prims) { for (let i = 0; i < p.P.length / 3; i++) { ymin = Math.min(ymin, p.P[i * 3 + 1]); if (!p.UV || Math.round(p.UV[i * 2]) !== 2) ymax = Math.max(ymax, p.P[i * 3 + 1]); } if (p.UV) for (let i = 0; i < p.UV.length / 2; i++) parts.add(Math.round(p.UV[i * 2])); }
  assert.ok(Math.abs(ymin - R.anchor[1]) < 0.012, `floor ${ymin}`);   // stands on the floor: no floating, no sinking
  for (const k of [0, 1, 3, 4, 5, 6]) assert.ok(parts.has(k), `rig part ${k}`);
  if (R.tail) assert.ok(parts.has(2), 'tail part');
  assert.ok(Math.abs((ymax - ymin) - R.h) < Math.max(lod === 'lo' ? 0.04 : 0.03, R.h * 0.085),   // ears ride above the rig height
    `height (tail aside) ${ymax - ymin} vs rig ${R.h}`);
  if (lod === 'lo') assert.ok(G.tris <= LO_BUDGET[id], `${G.tris} tris > ${LO_BUDGET[id]}`); else assert.ok(G.tris <= 5000, `${G.tris} hi tris`);
});
test('sizes next to the captain: monkey knee-to-hip, chimp about hip, gorillas chest height and the same size; cats the smallest', () => {
  const h = (id) => PET_RIG[id].h;
  assert.ok(h('pet_monkey') > HIP && h('pet_monkey') <= SASH + 0.02, 'monkey ' + h('pet_monkey'));   // 11:39 AM: clearly above the knee, top at the sash
  assert.ok(Math.abs(h('pet_chimp') - SASH) < 0.08, 'chimp ' + h('pet_chimp'));
  assert.ok(h('pet_gorilla') > 0.5 * BODY_H && h('pet_gorilla') < 0.7 * BODY_H, 'gorilla ' + h('pet_gorilla'));
  assert.equal(h('pet_gorilla'), h('pet_gorilla_white'));
  assert.ok(Math.abs(h('pet_tiger') - h('pet_gorilla')) < 0.06, 'tiger about the black gorilla\'s height ' + h('pet_tiger'));
  assert.ok(h('pet_cat') < h('pet_monkey') && h('pet_monkey') < h('pet_chimp') && h('pet_chimp') < h('pet_gorilla'));
  for (const id of PETS) assert.ok(PET_RIG[id].anchor[0] > 0.25, `${id} stands clear of the captain's left foot`);
});

// ------------------------------------------------------------ idle / gait personality
const run = (st, speed, secs, rnd = seq([0.1, 0.5, 0.9])) => { for (let t = 0; t < secs; t += 1 / 30) petPose(st, speed, 1 / 30, rnd); return st; };
test('petPose: walk then run blend by speed, phase advances by stride, sit only when idle', () => {
  for (const k of ['cat', 'monkey', 'chimp', 'gorilla']) {
    const s = newPetState(k); run(s, 1.4, 1); assert.ok(s.G[1] > 0.9 && s.G[2] < 0.05 && s.G[3] < 0.05, `${k} walk ${s.G}`);
    const ph = s.ph; petPose(s, 1.4, 0.05); assert.ok(s.ph > ph, 'phase moves');
    run(s, 7, 1); assert.ok(s.G[2] > 0.9, `${k} run`);
    run(s, 0, 4); assert.ok(Math.abs(s.G[3] - (PET_SIT[k] || 0)) < 0.05, `${k} settles to sit ${s.G[3]}`); assert.ok(s.G[1] < 0.05 && s.G[2] < 0.05);
  }
});
test('the tiger: cat gait, sits, stretches + yawns, pounces', () => {
  const s = newPetState('tiger'); run(s, 1.4, 1); assert.ok(s.G[1] > 0.9); run(s, 7, 1); assert.ok(s.G[2] > 0.9); run(s, 0, 4); assert.ok(s.G[3] > 0.8, 'sits');
  assert.ok(sawAct('tiger', 0) > 0.9, 'stretch'); assert.ok(sawAct('tiger', 1, [0.45, 0.5]) > 0.9, 'pounce hop');
  const src = txt('js/pirateItems.js'); assert.match(src, /R\.kind === 'tiger' \? 1 : 0/); assert.match(src, /stc = uLyA\.x \* tg/);
});
test('on foot the follower is drawn at YOUR scale (the bound copy rides it): the monkey reads knee-to-hip next to you, not under the knee', () => {
  const p = txt('js/onfoot/pets.js'); assert.match(p, /mesh\.scale\.setScalar\(k\)/); assert.match(p, /k = figScale\(fig\)/);
  const k = 1.75 / BODY_H, mk = PET_RIG.pet_monkey.h * k;   // pirateFigure: the 1.40 m v5 body drawn at 1.75 m
  assert.ok(mk > KNEE * k * 2 && mk <= (SASH + 0.02) * k, `monkey ${mk.toFixed(2)} m vs knee ${(KNEE * k).toFixed(2)} / sash ${(SASH * k).toFixed(2)}`);
  assert.ok(PET_RIG.pet_cat.h * k > KNEE * k, 'the cat stands above your knee'); assert.ok(Math.abs(PET_RIG.pet_chimp.h - SASH) < 0.08);
});
const sawAct = (k, slot, R = [0, 0.3, 0.6, 0.9]) => { const s = newPetState(k, 0), rnd = seq(R); let best = 0; for (let t = 0; t < 40; t += 1 / 30) { petPose(s, 0, 1 / 30, rnd); best = Math.max(best, s.A[slot]); } return best; };
test('idle personality: the cat sits and grooms, the monkey and chimp hop, the gorillas beat their chest', () => {
  assert.ok(sawAct('cat', 0) > 0.9, 'cat grooms'); assert.equal(PET_SIT.cat, 1);
  assert.ok(sawAct('monkey', 1) > 0.9, 'monkey hops'); assert.ok(sawAct('chimp', 1) > 0.9, 'chimp hops');
  assert.ok(sawAct('gorilla', 0) > 0.9, 'gorilla chest-beat');
  const s = newPetState('cat'); run(s, 0, 30); run(s, 2, 0.1); assert.equal(s.act, '', 'moving cancels the act');
});

// ------------------------------------------------------------ follow pathing (shared with the crew)
const walkLine = (env, c, o, steps, vx = 0, vz = 2.0, dt = 1 / 30, blocked) => { let tp = 0;
  for (let i = 0; i < steps; i++) { o.x += vx * dt; o.z += vz * dt; o.yaw = Math.atan2(vx, vz); env.trail.push(o.x, o.z); if (followStep(c, o, dt, env) === 'tp') tp++; if (blocked) assert.ok(!blocked(c.x, c.z), `inside a wall at ${c.x},${c.z}`); }
  return tp; };
const SP = { far: 7, run: PET_FOLLOW.run, near: PET_FOLLOW.near, walk: PET_FOLLOW.run, base: 1.6, k: 2.4 };
const mk = (blocked = () => false, extra = {}) => ({ trail: makeTrail(0.5, 64), move: makeMover(blocked, [0.6, -0.6, 1.2, -1.2]), back: PET_FOLLOW.back.cat, side: PET_FOLLOW.side, lost: PET_FOLLOW.lost, sp: SP, free: (x, z) => !blocked(x, z), ...extra });
test('followStep: keeps up at a walk and at a run, stays near the follow distance, settles when you stop', () => {
  for (const v of [1.8, 6.5]) {
    const env = mk(), c = { x: 0, z: -1, yaw: 0, speed: 0, stuck: 0, idleT: 0, look: 0 }, o = { x: 0, z: 0, yaw: 0 };
    walkLine(env, c, o, 300, 0, v); const d = Math.hypot(o.x - c.x, o.z - c.z);
    assert.ok(d < PET_FOLLOW.back.cat + PET_FOLLOW.side + 1.6, `speed ${v}: ${d.toFixed(2)} m behind`);
    for (let i = 0; i < 90; i++) followStep(c, o, 1 / 30, env);
    assert.ok(c.speed < 0.3, 'stops'); assert.ok(Math.hypot(o.x - c.x, o.z - c.z) > 0.5, 'does not stand on you');
  }
});
test('followStep: slides round a wall instead of walking through it, teleports when lost, respects the arena keep-out', () => {
  const wall = (x, z) => z > 2 && z < 2.6 && x > -1 && x < 3;   // a wall you walked round
  const env = mk(wall), c = { x: 0, z: 0, yaw: 0, speed: 0, stuck: 0, idleT: 0, look: 0 }, o = { x: 0, z: 0, yaw: 0 };
  walkLine(env, c, o, 60, -1.6, 0, 1 / 30, wall); walkLine(env, c, o, 120, 0, 2, 1 / 30, wall); walkLine(env, c, o, 90, 0, 2, 1 / 30, wall);
  assert.ok(c.z > 2.6, `got past the wall: ${c.z.toFixed(2)}`);
  const c2 = { x: 0, z: 0, yaw: 0, speed: 0, stuck: 0, idleT: 0, look: 0 }, o2 = { x: 0, z: 40, yaw: 0 }, e2 = mk(); for (let z = 0; z <= 40; z += 0.5) e2.trail.push(0, z);
  assert.equal(followStep(c2, o2, 1 / 30, e2), 'tp'); assert.ok(Math.hypot(o2.x - c2.x, o2.z - c2.z) < 4, 'regrouped behind you');
  const ko = (x, z) => (Math.hypot(x, z - 10) < 3 ? [0, 6.5] : null), e3 = mk(() => false, { ko }), c3 = { x: 0, z: 5, yaw: 0, speed: 0, stuck: 0, idleT: 0, look: 0 }, o3 = { x: 0, z: 6, yaw: 0 };
  walkLine(e3, c3, o3, 120, 0, 2); assert.ok(Math.hypot(c3.x, c3.z - 10) >= 3 - 1e-6, 'waits outside the arena');
});
test('the crew followers use the very same pathing module', () => {
  const s = txt('js/onfoot/followers.js'); assert.match(s, /from '\.\/followPath\.js'/); assert.match(s, /followStep\(/);
  const p = txt('js/onfoot/pets.js'); assert.match(p, /followStep\(/); assert.match(p, /PET_FOLLOW/);
  assert.match(txt('sw.js'), /"\.\/js\/onfoot\/followPath\.js"/); assert.match(txt('sw.js'), /"\.\/js\/onfoot\/pets\.js"/);
});

// ------------------------------------------------------------ parrot flight
test('birdFlight: leaves the perch, loops round you, lands back on it (continuous)', () => {
  const seat = [0.27, 1.05, 0.02], o = { p: [0, 0, 0], yaw: 0, bank: 0, pitch: 0, flap: 0 };
  assert.equal(birdFlight(-0.01, seat), null); assert.equal(birdFlight(FLIGHT_T, seat), null);
  const a = birdFlight(0, seat, { ...o, p: [0, 0, 0] }).p; for (let k = 0; k < 3; k++) assert.ok(Math.abs(a[k] - seat[k]) < 1e-6, 'starts on the perch');
  const z = birdFlight(FLIGHT_T - 1e-4, seat, { ...o, p: [0, 0, 0] }).p; for (let k = 0; k < 3; k++) assert.ok(Math.abs(z[k] - seat[k]) < 0.01, 'lands on the perch');
  let prev = null, angSum = 0, lastA = null, minR = 9;
  for (let t = 0; t < FLIGHT_T; t += 1 / 120) { const p = birdFlight(t, seat, { ...o, p: [0, 0, 0] }).p;
    if (prev) assert.ok(Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) < 0.12, `jump at t=${t.toFixed(3)}`);
    if (t > FLIGHT.up && t < FLIGHT.up + FLIGHT.loop) { const a2 = Math.atan2(p[0], p[2]); if (lastA != null) { let d = a2 - lastA; d = Math.atan2(Math.sin(d), Math.cos(d)); angSum += d; } lastA = a2; minR = Math.min(minR, Math.hypot(p[0], p[2])); }
    assert.ok(p[1] > seat[1] - 0.05, 'never dives below the shoulder'); prev = p; }
  assert.ok(Math.abs(Math.abs(angSum) - Math.PI * 2) < 0.3, `one full loop round you: ${angSum}`); assert.ok(minR > 0.6, 'clear of your body');
});
test('birdTick: perched on the ship, flies on foot (sooner when you stand still), rests between flights', () => {
  const b = newBirdState(0.5); for (let i = 0; i < 3000; i++) birdTick(b, 1 / 30, { moving: true, canFly: false }); assert.equal(b.t, -1, 'stays perched aboard');
  const c = newBirdState(0.5); let s = 0; while (c.t < 0 && s < 10) { birdTick(c, 1 / 30, { moving: false }); s += 1 / 30; } assert.ok(c.t >= 0 && s <= FLIGHT.idle + 0.1, 'takes off when you idle');
  while (c.t >= 0) birdTick(c, 1 / 30, { moving: true }, () => 0); assert.equal(c.t, -1); let w = 0; while (c.t < 0 && w < 60) { birdTick(c, 1 / 30, { moving: true }, () => 0); w += 1 / 30; }
  assert.ok(w >= FLIGHT.every[0] - 0.1, `rests ${w}s between flights`);
  assert.ok(isBird('parrot_green') && !isBird('pet_cat') && isGroundPet('pet_gorilla') && !isGroundPet('parrot_gold'));
});

// ------------------------------------------------------------ beards
const BEARD_LO = { beard_moustache: 600, beard_forked: 1400, beard_black: 2040 };
for (const id of Object.keys(BEARD_LO)) test(`${id}: lo budget (phone), hi budget, both bodies built`, () => {
  for (const who of ['male', 'female']) { const lo = glb(`assets/pirates/items/v5/${id}_${who}_lo.glb`), hi = glb(`assets/pirates/items/v5/${id}_${who}_hi.glb`);
    assert.ok(lo.tris <= BEARD_LO[id], `${who} lo ${lo.tris}`); assert.ok(hi.tris <= 9000, `${who} hi ${hi.tris}`); }
});
test('beards: keyed to your hair colour except Blackbeard (= BLACK hair), hidden on female bodies, beard colour = the hair colour', () => {
  const it = txt('js/pirateItems.js'), g = txt('js/pirateGear.js');
  assert.match(it, /item\('beard_moustache'[^\n]*keyed: true/); assert.match(it, /item\('beard_forked'[^\n]*keyed: true/); assert.doesNotMatch(it.match(/item\('beard_black'[^\n]*/)[0], /keyed: true/);
  assert.match(g, /export const BEARD_ON_FEMALE = false;/); assert.match(g, /slot === 'beard' && p\.female && !BEARD_ON_FEMALE/);
  // [Raul items redo] BANKSY 3:14 PM: the beard matches the hair (the same swatch, DEFAULT included), no separate beard default
  assert.match(g, /export function beardCols\(p, g\) \{\n  _bc\.set\(hairHexOf\(p, g\)\);/); assert.doesNotMatch(g, /BEARD_DEFAULT/);
});

// ------------------------------------------------------------ shop + server wiring
test('new pets: in the shop (proposed), server prices + gear slots, client save slots, distinct boosts on the price ladder, crew stays bare', () => {
  const lib = txt('supabase/functions/pvp/lib.ts'), save = txt('js/pvpSave.js'), crew = txt('js/crewV4.js');
  const pets = GEAR_ITEMS.filter((i) => i.slot === 'parrot' && i.id.startsWith('pet_'));
  for (const id of ['pet_chimp', 'pet_gorilla', 'pet_gorilla_white', 'pet_tiger']) {
    const it = GEAR_ITEMS.find((i) => i.slot === 'parrot' && i.id === id); assert.ok(it, id); assert.ok(it.proposed, `${id} price is a proposal`);
    assert.match(lib, new RegExp(`"gear:parrot:${id}": \\{ price: ${it.price} \\}`)); assert.match(lib.match(/parrot: \[[^\]]*\]/)[0], new RegExp(`"${id}"`));
    assert.match(save.match(/parrot: \[[^\]]*\]/)[0], new RegExp(`'${id}'`));
  }
  // BANKSY 11:29 AM "make pets be good boost on sells" (PROPOSED): every ground pet = its own sell bonus, strictly up the price ladder,
  // the white gorilla the biggest and the priciest (after the black gorilla); the three pets already sold keep their gold find
  const ladder = pets.map((i) => [i.id, i.price, BOOSTS[`parrot:${i.id}`]?.sell || 0]).sort((a, b) => a[1] - b[1]);
  for (const [id, , v] of ladder) assert.ok(v > 0 && Object.keys(BOOSTS[`parrot:${id}`])[0] === 'sell', `${id} leads with a sell bonus`);
  for (let k = 1; k < ladder.length; k++) assert.ok(ladder[k][2] > ladder[k - 1][2], `${ladder[k][0]} sells better than ${ladder[k - 1][0]}`);
  assert.equal(ladder.at(-1)[0], 'pet_gorilla_white'); assert.equal(ladder.at(-2)[0], 'pet_tiger'); assert.equal(ladder.at(-3)[0], 'pet_gorilla');
  assert.equal(BOOSTS['parrot:pet_tiger'].sell, 0.35); assert.equal(GEAR_ITEMS.find((i) => i.id === 'pet_tiger').price, 12000);
  assert.match(txt('js/shopCatalog.js'), /pet_tiger: 'EPIC'/);
  assert.equal(new Set(ladder.map((l) => l[2])).size, ladder.length, 'each pet its own sell bonus');
  for (const [id, gf] of [['pet_cat', 0.025], ['pet_monkey', 0.03], ['pet_cat_black', 0.035]]) assert.equal(BOOSTS[`parrot:${id}`].goldFind, gf, `${id} keeps its gold find`);
  for (const [k, b] of Object.entries(BOOSTS)) if (k.startsWith('parrot:parrot_')) assert.equal(b.sell, undefined, `${k}: parrots keep their own boosts`);
  for (const [k, b] of Object.entries(BOOSTS)) if (!k.startsWith('parrot:pet_')) assert.equal(b.sell, undefined, `${k}: sell is a pet-only boost`);
  assert.match(crew, /export const CREW_EXTRA_SLOTS = \[\]/);
});
test('sell bonus is applied server-side where the game sells (a spare chest item -> gold) and shown on the card + reveal', async () => {
  const lib = txt('supabase/functions/pvp/lib.ts'), idx = txt('supabase/functions/pvp/index.ts');
  assert.match(lib, /BOOST_CAPS[^\n]*sell: 0\.40/); assert.equal(BOOST_STATS.sell.cap, 0.40); assert.ok(BOOST_STATS.sell.live);
  const sellGold = Function(`const BOOST_CAPS = { sell: 0.40 }; return ${lib.match(/export const sellGold = ([^\n]*);/)[1].replace(/: number/g, '')};`)();
  assert.equal(sellGold(1000, 0), 1000); assert.equal(sellGold(1000, 0.4), 1400); assert.equal(sellGold(1000, 0.9), 1400, 'capped'); assert.equal(sellGold(1000, -1), 1000); assert.equal(sellGold(-5, 0.2), 0);
  assert.match(idx, /const sell = drop \? \(\(await boostsOf\(who, b\)\)\.sell \|\| 0\) : 0;/, 'map_dig reads the worn pet from the server copy');
  assert.match(idx, /p_dup: sellGold\(drop\.dup_gold, sell\)/, 'the spare-item sale pays the bonus');
  assert.match(txt('js/dock/chestReveal.js'), /pet \+\$\{Math\.round\(L\.sell \* 100\)\}% sell/);
  assert.match(txt('js/islandShop.js'), /BOOST_STATS\[c\.k\]\?\.hint/);
});
