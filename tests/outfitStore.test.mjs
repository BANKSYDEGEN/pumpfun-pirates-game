// [clothes-aaa] BANKSY t231u-t232u: the CLOTHES SHOP is an 18 m deep walk-in (street-level floor, prompt at the counter), blank V7
// mannequins (no skin / hair colour), painted light only. [outfit-store] 5:52 PM "Combine clothing and accessories stores, make it
// 2 different areas of store tho": Clothes + Accessories = one 20 m building, two areas split by an archway, each with its own prompt.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { STOREFRONTS, SHOPS_OUTSIDE, CLOTHES_ROOM, FACADE_LZ, HALLS, signList } from '../js/island/plazaTown.js';
import { OUTFIT_STORE, outfitWalls, outfitRooms } from '../js/island/outfitStore.js';
import { MALE_SHOP_DISPLAYS, BLANK_FORMS, blankBodyGeometry } from '../js/island/plazaMannequins.js';
import { CLOTHES_LAMPS, ACC_LAMPS } from '../js/island/clothesLook.js';
import { mapLandmarks } from '../js/mapLandmarks.js';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function glbExtras(file, name) {   // the JSON chunk of a GLB (extras survive meshopt)
  const b = readFileSync(new URL('../' + file, import.meta.url)), len = b.readUInt32LE(12), J = JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
  return J.nodes.find(n => n.name === name)?.extras || null;
}
const O = OUTFIT_STORE, CZ = FACADE_LZ - 6;   // GLB building origin (plazaTown cz)
const CL = STOREFRONTS.find(s => s.id === 'shop_clothes'), AC = STOREFRONTS.find(s => s.id === 'shop_crew');
function colliders(file = 'assets/island/plaza_shops.glb') {
  const ex = glbExtras(file, 'shop_clothes'); assert.ok(ex && ex.colliders, 'colliders ride in ' + file);
  const boxes = outfitWalls().map(([x, z, w, d]) => ({ x, z, w, d })), circles = [];
  for (const c of JSON.parse(ex.colliders)) { const x = O.lx + c[1], z = CZ + c[2]; if (c[0] === 'c') circles.push({ x, z, r: c[3] }); else boxes.push({ x, z, w: c[3], d: c[4] }); }
  const R = .33; return { boxes, circles, blocked: (x, z) => boxes.some(b => Math.abs(x - b.x) < b.w / 2 + R && Math.abs(z - b.z) < b.d / 2 + R) || circles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + R) };
}
const walk = (blocked, path, what) => { for (let i = 1; i < path.length; i++) { const [a, b] = [path[i - 1], path[i]], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1);
  for (let k = 0; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; assert.ok(!blocked(x, z), `${what}: blocked at lx ${x.toFixed(2)} lz ${z.toFixed(2)}`); } } };
test('one building, two vendors: both former shops are areas of the joint store (one map pin, stable ids)', () => {
  for (const s of [CL, AC]) { assert.ok(s.walkIn); assert.ok(!SHOPS_OUTSIDE.has(s.id)); assert.ok(s.mapHidden); assert.equal(s.part, O.id); assert.equal(s.promptLz, O.promptLz); assert.equal(s.depth, 18); }
  assert.deepEqual(O.areas.map(a => a.id), ['shop_clothes', 'shop_crew']); assert.equal(CL.vendor, 'clothes'); assert.equal(AC.vendor, 'accessories');
  assert.equal(CLOTHES_ROOM.promptLz, O.promptLz); assert.ok(SHOPS_OUTSIDE.has('shop_pets'), 'the pet store is untouched (still outside)');
  const marks = mapLandmarks({ townToWorld: (x, z) => [x, z] }); assert.equal(marks.filter(p => p.id === O.id).length, 1); assert.ok(!marks.some(p => p.id === 'shop_crew' || p.id === 'shop_clothes'));
  assert.equal(signList().filter(s => s.key === O.id).length, 1); assert.match(read('js/mapIcons.js'), /outfit_store: \['shirt'/);
  const B = JSON.parse(read('assets/island/building_numbers.json')).buildings, b = B.find(b => b.id === O.id), c = B.find(b => b.id === 'shop_crew');
  assert.equal(b.n, 1); assert.equal(b.lx, O.lx); assert.equal(b.w, O.w); assert.equal(b.d, O.depth); assert.equal(b.z, O.lx - 90); assert.equal(c.n, 2); assert.equal(c.parent, O.id);
  assert.ok(!B.some(b => b.id === 'shop_clothes'), 'no stale standalone Clothes number');
  const src = read('js/island/plazaTown.js'); assert.doesNotMatch(src, /accessoriesRoom/); assert.match(src, /if \(s\.part === OUTFIT_STORE\.id\) continue/);
});
test('the wider + deeper footprint stays clear of the token hall, the Pet Store and the street', () => {
  const x0 = O.lx - O.w / 2 - 0.3, x1 = O.lx + O.w / 2 + 0.3, hall = HALLS.find(h => h.id === 'hall_w'), pets = STOREFRONTS.find(s => s.id === 'shop_pets');
  assert.ok(x1 <= hall.lx - hall.w / 2 - 0.3 + 1e-6, `clear of hall_w (${x1} <= ${hall.lx - hall.w / 2 - 0.3})`);
  assert.ok(x1 < pets.lx - pets.w / 2, 'clear of the Pet Store'); assert.ok(x0 >= -54.3 - 1e-6, 'west edge unchanged (old Clothes plinth)');
  assert.doesNotMatch(read('js/island/plazaTown.js') + read('js/island/outfitStore.js'), /outfitPosts/, '[no-awn] no awning posts (BANKSY 6:53 PM)');
  assert.match(read('tools/plaza_blender/plaza_shops_blender.py'), /dict\(id='shop_clothes'[^\n]*noawn=True/);
});
test('walk in through each arch to its own counter prompt, and through the archway between the areas', () => {
  for (const file of ['assets/island/plaza_shops.glb', 'assets/island/plaza_shops_low.glb']) {
    const { blocked } = colliders(file);
    walk(blocked, [[CL.lx, FACADE_LZ + 3], [CL.lx, FACADE_LZ - 3.4], [CL.lx - 2.6, FACADE_LZ - 4.6], [CL.lx - 2.6, FACADE_LZ - 12.4], [CL.lx, FACADE_LZ - 12.6], [CL.lx, CL.promptLz]], 'clothing ' + file);
    walk(blocked, [[AC.lx, FACADE_LZ + 3], [AC.lx, AC.promptLz]], 'accessories ' + file);   // straight up the plum runner
    const ay = -36 - (O.divider.arch[0] + O.divider.arch[1]) / 2;   // archway centre (lz)
    walk(blocked, [[CL.lx + 2.2, ay], [O.lx, ay], [AC.lx - 1.5, ay]], 'archway ' + file);
    for (const s of [CL, AC]) { assert.ok(blocked(s.lx, CZ - 9.2), s.id + ' counter is solid'); assert.ok(Math.abs(s.promptLz - (CZ - 9.2)) < 3.4, s.id + ' prompt reaches its counter'); }
    assert.ok(Math.hypot(CL.lx - AC.lx, 0) > 2 * 3.4, 'the two prompts never overlap');
    assert.ok(blocked(O.lx, FACADE_LZ - 2) && blocked(O.lx, FACADE_LZ - 15), 'the middle wall holds either side of the archway');
    for (const ax of O.arches) assert.ok(!blocked(O.lx + ax, FACADE_LZ + 0.2) && !blocked(O.lx + ax, FACADE_LZ - 0.6), 'arch open (no street counter)');
    assert.ok(blocked(O.lx, FACADE_LZ - 18.6) && blocked(O.lx - 10, FACADE_LZ - 9) && blocked(O.lx + 10, FACADE_LZ - 9), 'outer walls hold');
    const { circles } = colliders(file);
    for (const d of MALE_SHOP_DISPLAYS.shop_clothes) { assert.ok(d.x < -0.5, 'forms stand in the Clothing half'); assert.ok(circles.some(c => Math.hypot(O.lx + d.x - c.x, CZ + d.z - c.z) < c.r - 0.3), 'every form stands on a solid plinth / dais'); }
  }
  const R = outfitRooms(); assert.equal(R.length, 2); assert.ok(R[0].lx1 < R[1].lx0, 'two camera rooms, split by the middle wall');
});
test('blank V7 forms: the head is a smooth egg, hanging hair is cut, the source geometry is untouched', () => {
  assert.ok(BLANK_FORMS.has('shop_clothes'));
  const pos = new Float32Array([0, 1.38, 0.0, 0.3, 1.1, 0.1, 0.0, 0.6, -0.15, 0.2, 0.4, 0.05]), uv = new Float32Array(8);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(12), 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const before = pos.slice(), b = blankBodyGeometry(g, true, null), P = b.attributes.position, C = b.attributes.blankCut;
  assert.deepEqual(Array.from(g.attributes.position.array), Array.from(before), 'source untouched');
  const E = { c: [0, 1.13, 0.01], r: [0.17, 0.245, 0.19] };
  for (const i of [0, 1]) { const q = [P.getX(i), P.getY(i), P.getZ(i)].map((v, k) => (v - E.c[k]) / E.r[k]); assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-4, 'head vertex on the egg'); }
  assert.equal(C.getX(2), 1, 'her braid is cut'); assert.equal(C.getX(3), 0, 'the body stays');
  const src = read('js/island/plazaMannequins.js');
  assert.match(src, /color: 0xece4d6/); assert.doesNotMatch(src, /\.map\s*=|v7Skin|v7Hair/);
});
test('painted light only: no realtime lights, render targets or textures; one 16-lamp bank per area', () => {
  for (const f of ['js/island/clothesLook.js', 'js/island/plazaMannequins.js', 'js/island/outfitStore.js']) assert.doesNotMatch(read(f), /PointLight|SpotLight|PMREM|WebGLRenderTarget|CanvasTexture|DataTexture/);
  assert.ok(CLOTHES_LAMPS.length <= 16 && ACC_LAMPS.length <= 16);
  assert.ok(CLOTHES_LAMPS.every(l => l[0] < -0.5) && ACC_LAMPS.every(l => l[0] > 0.5), 'each bank lights its own half');
  assert.match(read('js/island/plazaShops.js'), /clothesLookSetup\(lod\)/);
  assert.match(read('js/onfoot/walker.js'), /world\.camClamp\?\.\(out/);
});
