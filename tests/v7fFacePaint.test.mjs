// [v7f paint] BANKSY t433u "Do v7 girl face paint too": the V7 female wears her own skin-mapped Retardio shell (assets/pirates/items/v7f_paint,
// built by tools/v7f_paint/build.py from her hi / lo body: same topology + weights, 1.6 mm off along seam-welded normals, masked map).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
function glb(path) { const b = readFileSync(path); assert.equal(b.readUInt32LE(0), 0x46546c67); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12))); }
const names = (j) => new Set(j.skins.flatMap((s) => s.joints.map((i) => j.nodes[i].name)));
const PAINTS = { hi: 'assets/pirates/items/v7f_paint/facepaint_retardio_female_hi.glb', lo: 'assets/pirates/items/v7f_paint/facepaint_retardio_female_lo.glb' };
for (const [lod, PAINT] of Object.entries(PAINTS)) test(`V7 female Retardio paint (${lod}): textured alpha-masked shell on her face only`, () => {
  const j = glb(PAINT), body = glb(`assets/pirates/pirate_female_v7_${lod}.glb`);
  for (const n of names(j)) assert.ok(names(body).has(n), 'bone ' + n);
  assert.equal(j.meshes.length, 1); assert.equal(j.meshes[0].primitives.length, 1); assert.ok(!j.animations?.length, 'no clips');
  const pr = j.meshes[0].primitives[0], A = pr.attributes, pos = j.accessors[A.POSITION];
  for (const k of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0', 'COLOR_0', '_TINT']) assert.ok(A[k] !== undefined, k);
  assert.ok(pos.count < 3000, 'small shell');
  assert.ok(pos.min[0] > -0.2 && pos.max[0] < 0.2, 'between the ears'); assert.ok(pos.min[1] > 0.88 && pos.max[1] < 1.32, 'forehead to chin, not the neck'); assert.ok(pos.min[2] > 0.03, 'front of the head only');
  const bp = j.accessors[body.meshes[0].primitives[0].attributes.POSITION]; assert.ok(pos.max[2] < bp.max[2] + 0.004, 'hugs her face (no floating mask)');
  const m = j.materials[pr.material]; assert.equal(m.alphaMode, 'MASK'); assert.ok(m.pbrMetallicRoughness.baseColorTexture, 'painted map');
  assert.equal(j.images[j.textures[m.pbrMetallicRoughness.baseColorTexture.index].source].mimeType, 'image/png');
});
test('female V7 only: male V7 paint, v5 paints and the V7M refit table untouched', () => {
  const s = readFileSync('js/pirateItems.js', 'utf8');
  assert.match(s, /export const V7F_PAINT = \{ facepaint_retardio: \{ hi: 'assets\/pirates\/items\/v7f_paint\/facepaint_retardio_female_hi\.glb', lo: 'assets\/pirates\/items\/v7f_paint\/facepaint_retardio_female_lo\.glb' \} \}/);
  assert.match(s, /if \(p\.female && p\.v7 && V7F_PAINT\[def\.id\]\) return buildV5\(p, \{\.\.\.def, v5:\{female:V7F_PAINT\[def\.id\]\}/);
  assert.match(s, /if \(!p\.female && p\.v7 && body\.userData\.sourceLocked && V7M_PAINT\[def\.id\]\)/);   // the live male route as shipped
  assert.match(s, /export const V7M_PAINT = \{ facepaint_retardio: 'assets\/pirates\/items\/v7m_paint\/facepaint_retardio_male\.glb' \}/);
  assert.match(s, /item\('facepaint_retardio', 'Retardio Face Paint', 'face', 350, null, \[\], \{ v5: v5files\('facepaint_retardio'\), v5hide: \[\], v5only: true, paint: true \}\)/);
  for (const f of ['v5/facepaint_retardio_female_hi.glb', 'v5/facepaint_retardio_male_hi.glb', 'v7m_fit/facepaint_retardio_male_hi.glb', 'v7m_paint/facepaint_retardio_male.glb']) assert.ok(glb('assets/pirates/items/' + f).meshes.length, f);
});
