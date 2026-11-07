import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { VENDORS, GEAR_ITEMS, gearStoreForSlot } from '../js/shopCatalog.js';
import { STOREFRONTS, SHOPS_OUTSIDE, FACADE_LZ, buildPlazaV2, signList } from '../js/island/plazaTown.js';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('old crew building is one Accessories store; clothing sells only tops, pants and shoes', () => {
  const s = STOREFRONTS.find(s => s.id === 'shop_crew'); assert.equal(s.vendor, 'accessories'); assert.equal(s.name, 'ACCESSORIES STORE'); assert.ok(s.walkIn); assert.ok(!SHOPS_OUTSIDE.has(s.id));
  assert.deepEqual(VENDORS.clothes.slots, ['outfit', 'pants', 'boots']); assert.deepEqual(VENDORS.clothes.tabs, ['gear']);
  assert.deepEqual(VENDORS.accessories.tabs, ['gear']);
  for (const slot of [...VENDORS.clothes.slots, ...VENDORS.accessories.slots]) assert.ok(VENDORS.wardrobe.slots.includes(slot), 'owned player wardrobe keeps ' + slot);
  for (const slot of ['ears', 'face', 'cape', 'eyes', 'teeth', 'hat']) { assert.ok(VENDORS.accessories.slots.includes(slot)); assert.ok(!VENDORS.clothes.slots.includes(slot)); assert.equal(gearStoreForSlot(slot), 'accessories'); }
  for (const slot of VENDORS.accessories.slots) assert.ok(GEAR_ITEMS.some(it => it.slot === slot));
  assert.equal(STOREFRONTS.filter(s => s.vendor === 'accessories').length, 1);
  assert.equal(signList().find(s => s.key === 'shop_crew').text, 'ACCESSORIES STORE');
  assert.match(read('js/mapIcons.js'), /shop_crew: \['gem'[^\n]*ACCESSORIES STORE/);
  assert.match(read('js/mapLandmarks.js'), /s\.name, 'town'/); // map label derives from the same storefront name
});
test('walk from plaza through the actual open door to the counter prompt without a stand blocking it', () => {
  // [outfit-store] Accessories is the right-hand area of the joint Clothes + Accessories building (GLB colliders: outfitStore.test);
  // here the &shopsglb=0 fallback shell: the prompt must still be reachable through the one wide door
  const boxes = [], circles = [];
  const noop = () => {};
  buildPlazaV2({ k: { at: (m,fn) => fn(), add: g => g.dispose() }, W: (k, g) => g.dispose(), box: (...a) => new THREE.BoxGeometry(...a), cyl: (...a) => new THREE.CylinderGeometry(...a),
    M: () => new THREE.Matrix4(), at: (x,z,y,fn) => fn(), barrel: noop, crate: noop, sacks: noop, torchPost: noop, stall: noop,
    addBox: (x,z,w,d,yaw) => boxes.push({x,z,w,d,yaw}), addCirc: (x,z,r) => circles.push({x,z,r}), T: (x,z) => [x,z], F: () => 0, A: {}, low: true,
    C: { SHUTTER: [0,0,0,0], ROOFS: [0,0,0,0] }, yaw0: 0, deckY: 0 });
  const s = STOREFRONTS.find(s => s.vendor === 'accessories'), radius = .33;
  const blocked = (x,z) => boxes.some(b => Math.abs(x-b.x) < b.w/2+radius && Math.abs(z-b.z) < b.d/2+radius) || circles.some(c => Math.hypot(x-c.x,z-c.z) < c.r+radius);
  for (let z = FACADE_LZ + 3; z >= FACADE_LZ - 10; z -= .1) assert.ok(!blocked(s.lx,z), 'blocked entry at ' + z);
  assert.ok(Math.abs(s.promptLz - (FACADE_LZ - 10)) < 3.4, 'the prompt circle reaches inside the fallback shell');
  assert.ok(blocked(s.lx, FACADE_LZ - 12), 'back wall holds');
});
test('no exterior crew stands, old crew model or hiring UI is wired into this building', () => {
  const src = read('js/island/plazaTown.js');
  assert.match(src, /if \(s\.part === OUTFIT_STORE\.id\) continue/);   // [outfit-store] one building with the Clothing area
  const room = src.slice(src.indexOf('function outfitStore()'),src.indexOf('SHOP_PLACES.length = 0'));
  assert.doesNotMatch(room, /PointLight|CanvasTexture|WebGLRenderTarget|hiring|recruit/);
  assert.ok(!STOREFRONTS.some(s => s.vendor === 'crew'));
  assert.doesNotMatch(read('js/island/plazaMannequins.js'), /shop_crew: \[/);
  assert.match(read('js/islandShop.js'), /vendor: gearStoreForSlot\(x\.it\.base\)/);
});
