// [village-opt] the village freeze fix + deferred / culled village art. VILLAGE_ON is forced on for THIS test process only
// (village on: the live default since t2410u; villageSafetyPause.test.mjs covers ?village=0 / rollback).
import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.location = { hostname: '127.0.0.1', search: '?village=1' };
const THREE = await import('three');
const V = await import('../js/island/village.js');
const VB = await import('../js/island/villageBuild.js');
const { Kit, M } = await import('../js/island/kit.js');

test('village roads are iterable array-likes (the minimap bake destructures them every frame: this threw and froze the game)', () => {
  assert.equal(V.VILLAGE_ON, true);
  for (const r of V.VILLAGE_ROADS) { const [x0, x1, z0, z1, name] = r; assert.equal(x0, r.lx0); assert.equal(x1, r.lx1); assert.equal(z0, r.lz0); assert.equal(z1, r.lz1); assert.equal(name, r.name); assert.deepEqual([...r], [r.lx0, r.lx1, r.lz0, r.lz1, r.name]); }
  const map = readFileSync(new URL('../js/islandMap.js', import.meta.url), 'utf8');
  assert.match(map, /for \(const \[x0, x1, z0, z1\] of VILLAGE_ROADS\)/);
});

function harness() {
  const k = new Kit(); k.ao = () => 1; const boxes = [], decks = [], rooms = [], signs = [];
  const W = (kk, g, c, mid, m, o = true) => kk.add(g, c, { m, mat: mid, outline: o });
  const T = (lx, lz) => [lx, lz];
  const at = (lx, lz, ly, fn, y = null) => k.at(M(lx, y === null ? 3 : y, lz, ly), fn);
  const h = { k, W, box: (a, b, c) => new THREE.BoxGeometry(a, b, c), cyl: (a, b, c, n = 10) => new THREE.CylinderGeometry(a, b, c, n), M, at, T, H: () => 3, low: false, yaw0: 0,
    addBox: (...a) => boxes.push(a), addDeck: (d) => decks.push(d) };
  return { k, h, boxes, decks, rooms, signs, opts: { camRoom: (r) => rooms.push(r), Y0: 2.73, C: { ROOFS: [0x8e4a2c], WOOD: 0x6b4226, WOOD_D: 0x3d2a1c, WOOD_L: 0xa0703f }, sign: (...a) => signs.push(a) } };
}
const mats = { toon: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial(), atlas: new THREE.MeshBasicMaterial() }, out = { plain: new THREE.MeshBasicMaterial(), sway: new THREE.MeshBasicMaterial() };

test('buildVillage only records art: colliders / decks / camera rooms / signs are synchronous, the coast kit gets no village pieces', () => {
  const H = harness(); const n = VB.buildVillage(H.h, H.opts);
  assert.equal(n, V.VILLAGE_LOTS.length); assert.equal(H.k.b.size, 0, 'nothing merged into the coast kit'); assert.equal(H.k.out.length, 0); assert.equal(H.k.stack.length, 1);
  assert.ok(H.boxes.length > 100); assert.equal(H.rooms.length, V.VILLAGE_LOTS.length); assert.ok(H.decks.length >= V.VILLAGE_LOTS.length); assert.ok(H.signs.length >= V.VILLAGE_LOTS.length);
  const art = VB.buildVillageArt(mats, out, { sync: true }); const g = art.group;
  const lods = [], meshes = []; g.traverse(o => { if (o.isLOD) lods.push(o); if (o.isMesh) meshes.push(o); });
  assert.ok(meshes.every(m => /^village_/.test(m.name)), 'village_* names (mergeIslandKits leaves them alone)');
  const roomLods = lods.filter(l => /^village_room\d+_lod$/.test(l.name)); assert.equal(roomLods.length, V.VILLAGE_LOTS.length, 'one near-only interior per rental');
  for (const l of roomLods) { assert.equal(l.levels[1].distance, 70); assert.equal(l.levels[1].object.children.length, 0); }
  const shells = lods.filter(l => /^village_q\d_lod$/.test(l.name)); assert.ok(shells.length >= 3); for (const l of shells) { assert.equal(l.levels[1].distance, 220); l.levels[0].object.traverse(o => { if (o.isMesh) assert.ok(o.userData.outline); }); }
  const solids = g.children.filter(o => !o.isLOD); assert.ok(solids.length >= 3); for (const s of solids) s.traverse(o => { if (o.isMesh) assert.ok(!o.userData.outline && o.castShadow !== undefined); });
  // lantern glows sit inside their own rental (they were stacked at the world origin before)
  g.updateMatrixWorld(true);
  for (const l of roomLods) { const glow = l.levels[0].object.children.find(m => /_glow$/.test(m.name)), toon = l.levels[0].object.children.find(m => /_toon$/.test(m.name)); assert.ok(glow && toon);
    const bt = new THREE.Box3().setFromObject(toon), bg = new THREE.Box3().setFromObject(glow); assert.ok(bt.containsBox(bg), l.name + ' glow inside the rental'); }
  assert.equal(VB.buildVillageArt(mats, out, { sync: true }), null, 'records are consumed once');
});

test('time-sliced build yields between slices and produces the same meshes as the sync build', async () => {
  const count = (g) => { let t = 0, n = 0; g.traverse(o => { if (o.isMesh) { n++; t += o.geometry.attributes.position.count; } }); return [n, t]; };
  const A = harness(); VB.buildVillage(A.h, A.opts); const s = VB.buildVillageArt(mats, out, { sync: true }).group;
  const B = harness(); VB.buildVillage(B.h, B.opts); const art = VB.buildVillageArt(mats, out, { slice: 2 }); assert.equal(count(art.group)[0], 0, 'nothing built synchronously');
  const g = await art.done; assert.deepEqual(count(g), count(s)); assert.ok(g.userData.build.slices > 3);
});

test('shelf goods / plank seams drop only hidden faces; foot.js builds the village after the coast without blocking', () => {
  const src = readFileSync(new URL('../js/island/villageBuild.js', import.meta.url), 'utf8');
  assert.match(src, /openBox\(\.36, hh, \.44/); assert.match(src, /openBox\(\.42, hh, \.3/);
  const foot = readFileSync(new URL('../js/island/foot.js', import.meta.url), 'utf8');
  assert.match(foot, /PV\.buildVillageArt\(MATS, OUT, \{ low/); assert.doesNotMatch(foot, /buildVillageInteriors/);
});

test('walkers stand on the graded road surface (the 4 m terrain grid sagged below it); off the roads: null', () => {
  for (const r of V.VILLAGE_ROADS) { const lx = (r.lx0 + r.lx1) / 2, lz = (r.lz0 + r.lz1) / 2; assert.ok(Math.abs(V.villageRoadY(lx, lz) - (V.roadY(r, lx, lz) + .05)) < 1e-9 || V.villageRoadY(lx, lz) >= V.roadY(r, lx, lz) + .05); }
  assert.equal(V.villageRoadY(-200, -80), null); assert.equal(V.villageRoadY(-90, -125), null, 'inside lot 3, not a road');
  const foot = readFileSync(new URL('../js/island/foot.js', import.meta.url), 'utf8'); assert.match(foot, /const VROAD = !!\(COASTM && PV\.VILLAGE_ON && PV\.villageRoadY\)/);
});

test('a minimap draw error only warns once and never stops the frame', () => {
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(main, /try \{ drawRadar\(\); \} catch \(e\) \{ if \(!drawRadar\.warned\) \{ drawRadar\.warned = true; console\.warn\(/);
  const line = main.split('\n').find(l => l.includes('drawRadar.warned')); assert.ok(line.indexOf('//') > line.indexOf('emoteTick(); }'), 'nothing after the comment');
});
