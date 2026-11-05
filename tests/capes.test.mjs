// [capes 2] the three shop capes: rebuilt per body / LOD inside the phone budget, the captain cape's fold key coloured, ids / boosts unchanged
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync, existsSync } from 'node:fs';
const tris = (f) => { const b = readFileSync(f), n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n).toString()); return j.meshes.flatMap((m) => m.primitives).reduce((s, p) => s + j.accessors[p.indices].count / 3, 0); };
test('capes: 12 GLBs, one mesh each, within the budget', () => {
  for (const id of ['cape_tattered', 'cape_captain', 'cape_royal']) for (const who of ['male', 'female']) for (const [lod, cap] of [['hi', 5000], ['lo', 1400]]) {
    const f = `assets/pirates/items/v5/${id}_${who}_${lod}.glb`; assert.ok(existsSync(f), f); const t = tris(f); assert.ok(t > 300 && t <= cap, `${f}: ${t} tris`);
  }
});
test('capes: captain keyed (cloth + fold shade), boosts unchanged, builder present', () => {
  const g = readFileSync('js/pirateGear.js', 'utf8'), b = readFileSync('js/boosts.js', 'utf8');
  assert.match(g, /'cape:cape_captain': \['cape', 'cape_captain', \(g, c\) => \{ const k = capeHex\(g\.capeColor\) \|\| outfitColors\('suit', c\)\.cloth; return \{ 1: k, 2: capeFold\(k\) \}/);
  assert.match(b, /'cape:cape_tattered': \{ hp: 0\.01 \}, 'cape:cape_captain': \{ hp: 0\.02 \}, 'cape:cape_royal': \{ hp: 0\.04 \}/);
  assert.ok(existsSync('tools/blender/capes/build_capes.py'));
});
test('carry: the musket squashes long hair below the shoulders', () => {
  const s = readFileSync('js/carryWeapons.js', 'utf8'); assert.match(s, /HAIR_SQUASH = 0\.45/); assert.match(s, /import \{ TINTS \} from '\.\/pirateGLB\.js'/);
});
