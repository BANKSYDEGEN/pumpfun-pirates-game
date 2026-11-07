// [v7m paint] BANKSY "Redo the retardio face paint on v7 characters" (male first): the restored V7 male wears his own skin-mapped
// Retardio shell (assets/pirates/items/v7m_paint, built by tools/v7m_paint/build.py from his body: same topology + weights, 1.6 mm off).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
function glb(path) { const b = readFileSync(path); assert.equal(b.readUInt32LE(0), 0x46546c67); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12))); }
const names = (j) => new Set(j.skins.flatMap((s) => s.joints.map((i) => j.nodes[i].name)));
const PAINT = 'assets/pirates/items/v7m_paint/facepaint_retardio_male.glb';
test('V7 male Retardio paint: a textured, alpha-masked skin shell on the face only (no mask plate, ears / neck / hair untouched)', () => {
  const j = glb(PAINT), body = glb('assets/pirates/pirate_male_v7_hi.glb');
  for (const n of names(j)) assert.ok(names(body).has(n), 'bone ' + n);
  assert.equal(j.meshes.length, 1); assert.equal(j.meshes[0].primitives.length, 1); assert.ok(!j.animations?.length, 'no clips');
  const pr = j.meshes[0].primitives[0], A = pr.attributes, pos = j.accessors[A.POSITION];
  for (const k of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0', 'COLOR_0', '_TINT']) assert.ok(A[k] !== undefined, k);
  assert.ok(pos.count < 3000, 'small shell');
  assert.ok(pos.min[0] > -0.2 && pos.max[0] < 0.2, 'between the ears'); assert.ok(pos.min[1] > 0.84 && pos.max[1] < 1.3, 'brow to mouth, not the neck'); assert.ok(pos.min[2] > 0.05, 'front of the head only');
  const m = j.materials[pr.material]; assert.equal(m.alphaMode, 'MASK'); assert.ok(m.pbrMetallicRoughness.baseColorTexture, 'painted map, crisp edges');
  assert.equal(j.images[j.textures[m.pbrMetallicRoughness.baseColorTexture.index].source].mimeType, 'image/png');
});
test('male V7 only: female, v5 bodies and the V7M refit table keep their own paint', async () => {
  const s = readFileSync('js/pirateItems.js', 'utf8'), { V7M_PAINT } = await import('../js/pirateItems.js').catch(() => ({ V7M_PAINT: null }));
  assert.match(s, /if \(!p\.female && p\.v7 && body\.userData\.sourceLocked && V7M_PAINT\[def\.id\]\)/);
  assert.ok(s.indexOf('V7M_PAINT[def.id]) {') < s.indexOf('V7M_FITS[def.id] && !V7M_SKIP'), 'paint override before the refit path');
  assert.match(s, /export const V7M_PAINT = \{ facepaint_retardio: 'assets\/pirates\/items\/v7m_paint\/facepaint_retardio_male\.glb' \}/);
  if (V7M_PAINT) assert.deepEqual(Object.keys(V7M_PAINT), ['facepaint_retardio']);
  assert.match(s, /item\('facepaint_retardio', 'Retardio Face Paint', 'face', 350, null, \[\], \{ v5: v5files\('facepaint_retardio'\), v5hide: \[\], v5only: true, paint: true \}\)/);
  for (const f of ['v5/facepaint_retardio_female_hi.glb', 'v5/facepaint_retardio_male_hi.glb', 'v7m_fit/facepaint_retardio_male_hi.glb']) assert.ok(glb('assets/pirates/items/' + f).meshes.length, f);
});
