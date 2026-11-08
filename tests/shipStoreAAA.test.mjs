// [ship-aaa] BANKSY 6:18-6:19 PM "Then start on ship store" / "Make higher ceilings and make the store nice, keep 2 counters one for upgrades
// and one for skins": the Blender SHIP STORE hall (plaza_shops.glb node 'ship_store'): 22 m x 12 m (the casino is right behind), 8.6 m
// ceiling, three arches, two counters (UPGRADES / SHIP SKINS) each with its own prompt + hanging sign, painted light only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHIP_STORE, shipWalls, shipRoom } from '../js/island/shipStore.js';
import { STOREFRONTS, FACADE_LZ, HALLS } from '../js/island/plazaTown.js';
import { MALE_SHOP_DISPLAYS } from '../js/island/plazaMannequins.js';
import { SHIP_LAMPS, SKIN_LAMPS } from '../js/island/clothesLook.js';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function glbJson(file) { const b = readFileSync(new URL('../' + file, import.meta.url)), len = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + len).toString('utf8')); }
const S = SHIP_STORE;
function colliders(file) {
  const ex = glbJson(file).nodes.find(n => n.name === 'ship_store')?.extras; assert.ok(ex && ex.colliders, 'ship_store colliders ride in ' + file);
  const boxes = shipWalls().map(([x, z, w, d]) => ({ x, z, w, d })), circles = [];
  for (const c of JSON.parse(ex.colliders)) { const x = S.lx + c[1], z = S.lz + c[2]; if (c[0] === 'c') circles.push({ x, z, r: c[3] }); else boxes.push({ x, z, w: c[3], d: c[4] }); }
  for (const d of MALE_SHOP_DISPLAYS.ship_store) circles.push({ x: S.lx + d.x, z: S.lz + d.z, r: 0.38 });
  const R = .33; return { boxes, circles, blocked: (x, z) => boxes.some(b => Math.abs(x - b.x) < b.w / 2 + R && Math.abs(z - b.z) < b.d / 2 + R) || circles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + R) };
}
test('the hall: one GLB node, old standalone nodes gone, the lot depth kept (the casino stands right behind)', () => {
  for (const f of ['assets/island/plaza_shops.glb', 'assets/island/plaza_shops_low.glb']) {
    const names = glbJson(f).nodes.map(n => n.name); assert.ok(names.includes('ship_store')); assert.ok(!names.includes('shop_ships') && !names.includes('shop_upgrades'));
  }
  const casino = JSON.parse(read('assets/island/building_numbers.json')).buildings.find(b => b.id === 'casino');
  assert.ok(S.facadeLz - S.depth >= casino.lz + casino.d / 2 - 0.06, 'back wall (same line as the old 12 m shell) clear of the casino front');
  const hall = HALLS.find(h => h.id === 'hall_e'); assert.ok(S.lx + S.w / 2 + 0.3 <= hall.lx - hall.w / 2, 'clear of the marketplace');
  assert.ok(S.ceil >= 8, 'a raised ceiling'); assert.equal(S.facadeLz, FACADE_LZ);
  const R = shipRoom(); assert.ok(R.lx1 - R.lx0 > 20 && R.lz1 - R.lz0 > 10);
  assert.match(read('js/island/plazaTown.js'), /glb: SHOPS_KIT && SHOPS_KIT\.shops\.ship_store/);
  assert.match(read('js/island/plazaShops.js'), /\(shop\|house\|ship\)_/);
  assert.doesNotMatch(read('js/island/shipStore.js'), /Posts/, '[no-awn] no awning posts (BANKSY 6:53 PM)');
  assert.match(read('tools/plaza_blender/plaza_shops_blender.py'), /dict\(id='ship_store'[^\n]*noawn=True/);
});
test('walk in through each arch straight to its own counter prompt; counters solid; prompts apart; centre aisle to the dais', () => {
  for (const file of ['assets/island/plaza_shops.glb', 'assets/island/plaza_shops_low.glb']) {
    const { blocked } = colliders(file);
    for (const c of S.counters) {
      for (let z = FACADE_LZ + 3; z >= S.promptLz; z -= 0.1) assert.ok(!blocked(c.lx, z), `${c.id} walk-in blocked at lz ${z.toFixed(2)}`);
      assert.ok(blocked(c.lx, S.counterLz), c.id + ' counter solid'); assert.ok(Math.abs(S.promptLz - S.counterLz) < 3.4, 'prompt reaches the counter');
      const s = STOREFRONTS.find(s => s.id === c.id); assert.equal(s.promptLz, S.promptLz); assert.equal(s.lx, c.lx);
    }
    assert.ok(Math.abs(S.counters[0].lx - S.counters[1].lx) > 2 * 3.4, 'the two prompts never overlap');
    for (let z = FACADE_LZ + 3; z >= -38.6; z -= 0.1) assert.ok(!blocked(S.lx, z), 'centre aisle ' + z.toFixed(2));
    for (const ax of S.arches) assert.ok(!blocked(S.lx + ax, FACADE_LZ + 0.2), 'arch open');
    assert.ok(blocked(S.lx, -41.9) && blocked(S.lx - 11, -36) && blocked(S.lx + 11, -36), 'outer walls hold');
  }
  for (const d of MALE_SHOP_DISPLAYS.ship_store) assert.ok(S.lz + d.z < S.counterLz - 0.5 && S.lz + d.z > -41.5, 'keepers stand behind their counter');
});
test('painted light only, one 16-lamp bank per stall, signs per stall in the model', () => {
  for (const f of ['js/island/clothesLook.js', 'js/island/shipStore.js']) assert.doesNotMatch(read(f), /PointLight|SpotLight|PMREM|WebGLRenderTarget|CanvasTexture|DataTexture/);
  assert.ok(SHIP_LAMPS.length <= 16 && SKIN_LAMPS.length <= 16);
  assert.ok(SHIP_LAMPS.filter(l => l[3] > 0).every(l => l[0] < 0.5) && SKIN_LAMPS.filter(l => l[3] > 0).every(l => l[0] > -0.5));
  assert.match(read('js/island/plazaShops.js'), /shipLookSetup\(lod\)/);
  const py = read('tools/plaza_blender/plaza_shops_blender.py'); assert.match(py, /hang_sign\(b, -5\.5, [\d.]+, 'UPGRADES'/); assert.match(py, /hang_sign\(b, 6\.0, [\d.]+, 'SHIP SKINS'/);
  for (const f of ['assets/island/plaza_shops.glb', 'assets/island/plaza_shops_low.glb']) { const J = glbJson(f); assert.ok(!(J.images || []).length, 'no textures in the GLB'); }
});
