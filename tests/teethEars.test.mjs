// [teeth/ears redo] the shop-items-2 teeth + earrings (GLB per body / LOD, Blender-built, in the mouth / on the lobe), no earrings under the mask
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const glb = (f) => { const b = readFileSync(f), n = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + n).toString()); };
const tris = (j) => j.meshes.reduce((s, m) => s + m.primitives.reduce((t, p) => t + j.accessors[p.indices].count / 3, 0), 0);
const CAP = { tooth_gold: [600, 200], grill_gold: [600, 200], grill_diamond: [800, 260], earring_hoop: [1600, 500], earring_double: [3200, 1100], earring_skull: [3200, 1100] };
test('teeth + earrings: every id / body / LOD, one vertex-coloured mesh, phone budget', () => {
  for (const [id, [hi, lo]] of Object.entries(CAP)) for (const who of ['male', 'female']) for (const [lod, cap] of [['hi', hi], ['lo', lo]]) {
    const j = glb(`assets/pirates/items/v5/${id}_${who}_${lod}.glb`), t = tris(j);
    assert.equal(j.meshes.length, 1, `${id} ${who} ${lod}`); assert.ok(j.meshes[0].primitives[0].attributes.COLOR_0 !== undefined);
    assert.ok(t > 50 && t <= cap, `${id} ${who} ${lod}: ${t}`);
  }
});
test('teeth + earrings: ids / prices / boosts unchanged; the luchador hood hides the earrings', () => {
  const b = readFileSync('js/boosts.js', 'utf8');
  assert.match(b, /'ears:earring_hoop': \{ range: 0\.01 \}, 'ears:earring_double': \{ range: 0\.015 \}, 'ears:earring_skull': \{ range: 0\.02 \}/);
  assert.match(b, /'teeth:tooth_gold': \{ goldFind: 0\.01 \}, 'teeth:grill_gold': \{ goldFind: 0\.02 \}, 'teeth:grill_diamond': \{ goldFind: 0\.03 \}/);
  const c = readFileSync('js/shopCatalog.js', 'utf8');
  for (const [id, p] of [['earring_hoop', 250], ['earring_double', 600], ['earring_skull', 1200], ['tooth_gold', 300], ['grill_gold', 1500], ['grill_diamond', 6000]]) assert.match(c, new RegExp(`id: '${id}', label: '[A-Z ]+', price: ${p},`));
  const it = readFileSync('js/pirateItems.js', 'utf8'); for (const id of ['tooth_gold', 'grill_gold', 'grill_diamond']) assert.match(it, new RegExp(`item\\('${id}'.*decal: true`));
  assert.match(readFileSync('js/pirateGear.js', 'utf8'), /if \(slot === 'ears' && gear\.hat === 'mask_luchador'\) continue;/);
});
