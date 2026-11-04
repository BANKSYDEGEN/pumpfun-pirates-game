// [Raul pegleg] the v5 peg legs (assets/pirates/items/v5/peg_{l,r}_{male,female}_{hi,lo}.glb, built by Raul's pegfit tools):
// skinned to that leg's thigh / shin only (bends with the knee, swings with the shin), tip on the floor, the knee sleeve covers the
// in-game hide line (js/pirateItems.js PEG_CUT), Low stays phone-light; the shop entry (price / slot) is unchanged
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ROOT = new URL('../', import.meta.url);
function glb(path) {   // tiny GLB reader: JSON + BIN chunks, accessor -> typed array
  const b = readFileSync(new URL(path, ROOT)); const jl = b.readUInt32LE(12); const J = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = b.subarray(20 + jl + 8); const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }, T = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const acc = (i) => { const a = J.accessors[i], v = J.bufferViews[a.bufferView], n = N[a.type], Ty = T[a.componentType], st = v.byteStride || n * Ty.BYTES_PER_ELEMENT, off = (v.byteOffset || 0) + (a.byteOffset || 0), out = new Ty(a.count * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = new Ty(bin.buffer.slice(bin.byteOffset + off + k * st + c * Ty.BYTES_PER_ELEMENT, bin.byteOffset + off + k * st + (c + 1) * Ty.BYTES_PER_ELEMENT))[0];
    return { a, out, n }; };
  return { J, acc };
}
const src = readFileSync(new URL('js/pirateItems.js', ROOT), 'utf8');
const CUT = JSON.parse(src.match(/PEG_CUT = (\{[^}]+\})/)[1].replace(/(\w+):/g, '"$1":'));
for (const id of ['peg', 'peg_gold', 'peg_kraken', 'peg_ghost']) for (const who of ['male', 'female']) for (const lod of ['hi', 'lo']) for (const s of ['l', 'r']) test(`${id} ${s} ${who} ${lod}`, () => {
  const { J, acc } = glb(`assets/pirates/items/v5/${id}_${s}_${who}_${lod}.glb`);
  assert.equal(J.skins?.length, 1, 'skinned'); const prim = J.meshes[0].primitives[0];
  const P = acc(prim.attributes.POSITION).out, Jn = acc(prim.attributes.JOINTS_0).out, W = acc(prim.attributes.WEIGHTS_0).out;
  const names = J.skins[0].joints.map((j) => J.nodes[j].name.replace(/[^a-zA-Z]/g, ''));
  const used = new Set(); for (let i = 0; i < W.length; i++) if (W[i] > 0.01) used.add(names[Jn[i]]);
  const S = s.toUpperCase(); assert.deepEqual([...used].sort(), [`shin${S}`, `thigh${S}`].sort(), 'only that leg: ' + [...used]);
  let y0 = 9, y1 = -9, xs = 0, n = P.length / 3; for (let i = 0; i < n; i++) { const y = P[i * 3 + 1]; y0 = Math.min(y0, y); y1 = Math.max(y1, y); xs += Math.sign(P[i * 3]); }
  assert.ok(y0 > -0.02 && y0 < 0.002, 'tip on the floor ' + y0); assert.ok(y1 < 0.3, 'sleeve top under the thigh ' + y1);
  assert.ok((s === 'l' ? 1 : -1) * xs / n > 0.95, 'on its own side');
  const cut = CUT[who]; assert.ok(cut > 0.15 && cut < y1 - 0.04, `hide line ${cut} under the sleeve top ${y1}`);
  const tris = (prim.indices != null ? J.accessors[prim.indices].count : n) / 3; assert.ok(tris < (id === 'peg' ? (lod === 'lo' ? 2600 : 6600) : (lod === 'lo' ? 2300 : 7000)), 'tris ' + tris);   // [Raul pegs 2] special pegs' phone files back near the standard peg's 2,200
});
test('every peg item hides with the v5 peg fit (PEG5), shop entry unchanged (price, slot, sides)', () => {
  for (const id of ['peg_l', 'peg_r', 'peg_gold_l', 'peg_gold_r', 'peg_kraken_l', 'peg_kraken_r', 'peg_ghost_l', 'peg_ghost_r']) assert.match(src, new RegExp(`item\\('${id}',[^\\n]*v5hide: PEG5\\('${id.slice(-1).toUpperCase()}'\\)`), id);
  const cat = readFileSync(new URL('js/shopCatalog.js', ROOT), 'utf8');
  assert.match(cat, /\{ slot: 'leg', id: 'peg', label: 'PEG LEG', price: 1000, glb: 'raul:peg_l\|peg_r', tint: null, side: 'legSide' \}/);
});
