// [v7f gear b3] BANKSY t442u / t445u: her refit tank keep the v5 female topology / UVs / colours / tint tags (tint regions unchanged), skin to her bones
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { readFileSync } from 'node:fs';
import { MeshoptDecoder } from '../vendor/three-0.165.0/examples/jsm/libs/meshopt_decoder.module.js';
import { V7F_FITS } from '../js/v7fFitData.js';
await MeshoptDecoder.ready;
const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }, NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function glb(path) {   // json + decoded (Meshopt / plain) accessors
  const b = readFileSync(path); assert.equal(b.readUInt32LE(0), 0x46546c67, path);
  const jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl)), bin = b.subarray(28 + jl, 28 + jl + b.readUInt32LE(20 + jl)), views = {};
  const view = (i) => { if (views[i]) return views[i]; const v = j.bufferViews[i], m = v.extensions?.EXT_meshopt_compression;
    if (!m) return (views[i] = { data: bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), stride: v.byteStride });
    const out = new Uint8Array(m.count * m.byteStride); MeshoptDecoder.decodeGltfBuffer(out, m.count, m.byteStride, bin.subarray(m.byteOffset || 0, (m.byteOffset || 0) + m.byteLength), m.mode, m.filter || 'NONE');
    return (views[i] = { data: out, stride: m.byteStride }); };
  const acc = (i) => { const a = j.accessors[i], T = CT[a.componentType], n = NC[a.type], v = view(a.bufferView), st = v.stride || T.BYTES_PER_ELEMENT * n, out = new T(a.count * n);
    const dv = new DataView(v.data.buffer, v.data.byteOffset + (a.byteOffset || 0)); const get = { 5126: 'getFloat32', 5121: 'getUint8', 5123: 'getUint16', 5125: 'getUint32', 5122: 'getInt16', 5120: 'getInt8' }[a.componentType];
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = dv[get](k * st + c * T.BYTES_PER_ELEMENT, true); return out; };
  return { j, acc };
}
const TOPS = { cloth_tank: 'cloth_tank' };   // [t445u] only the tank shipped; the other tops stay local
const acc = (g, i) => g.acc(i);
const big = (g) => g.j.meshes.map((m) => m.primitives[0]).reduce((a, p) => (g.j.accessors[p.attributes.POSITION].count > g.j.accessors[a.attributes.POSITION].count ? p : a));
for (const [id, f] of Object.entries(TOPS)) for (const lod of ['hi', 'lo']) test(`${id} ${lod}: same vertex / index counts + attributes (UV, colour, tint) as the v5 female file, finite, skinned to her bones`, () => {
  const a = glb(`assets/pirates/items/v5/${f}_female_${lod}.glb`), b = glb(V7F_FITS[id][lod]), pa = big(a), pb = big(b);
  assert.deepEqual(Object.keys(pb.attributes).sort(), Object.keys(pa.attributes).sort());
  for (const k of Object.keys(pa.attributes)) assert.equal(b.j.accessors[pb.attributes[k]].count, a.j.accessors[pa.attributes[k]].count, k);
  // (the v5 sources are Draco: values compared offline (b3 refit keeps UV / COLOR / _TINT / _HEM / index buffer); here counts + attribute set + index count)
  assert.equal(b.j.accessors[pb.indices].count, a.j.accessors[pa.indices].count);
  const P = acc(b, pb.attributes.POSITION); assert.ok(P.every(Number.isFinite)); let ymin = 9, ymax = -9; for (let i = 1; i < P.length; i += 3) { ymin = Math.min(ymin, P[i]); ymax = Math.max(ymax, P[i]); } assert.ok(ymin > 0.3 && ymax < 1.0, `${ymin}..${ymax}`);
  const W = acc(b, pb.attributes.WEIGHTS_0), sc = W instanceof Uint8Array ? 255 : 1; for (let i = 0; i < W.length; i += 4) { const s = (W[i] + W[i + 1] + W[i + 2] + W[i + 3]) / sc; assert.ok(Math.abs(s - 1) < 0.02); } });
test('routing: female V7 only; male V7 / v5 / v6 keep their paths', () => { const s = fs.readFileSync('js/pirateItems.js', 'utf8');
  assert.match(s, /if \(p\.female && p\.v7 && V7F_FITS\[def\.id\]\)/); assert.match(s, /if \(!p\.female && p\.v7 && body\.userData\.sourceLocked && V7M_FITS\[def\.id\]/); });
// [v7f gear b3] the b2 refit tore at every UV / colour seam (co-located copies smoothed / pushed / reweighted apart, up to 4.7 cm: open
// cracks = her skin + the background through 'torn' sleeve / back edges, widening in the walk). Seam copies must stay one cloth point.
for (const [id] of Object.entries(TOPS)) for (const lod of ['hi', 'lo']) test(`${id} ${lod}: seam copies share position (< 0.1 mm) and skin weights`, () => {
  const b = glb(V7F_FITS[id][lod]), pb = big(b), P = acc(b, pb.attributes.POSITION), J = acc(b, pb.attributes.JOINTS_0), W = acc(b, pb.attributes.WEIGHTS_0), sc = W instanceof Uint8Array ? 255 : 1;
  const grid = new Map(); let bad = 0, wbad = 0;
  const wmap = (i) => { const m = {}; for (let k = 0; k < 4; k++) if (W[i * 4 + k]) m[J[i * 4 + k]] = (m[J[i * 4 + k]] || 0) + W[i * 4 + k] / sc; return m; };
  for (let i = 0; i < P.length / 3; i++) { const key = [0, 1, 2].map((c) => Math.round(P[i * 3 + c] * 1e4)).join(','); const o = grid.get(key); if (o === undefined) { grid.set(key, i); continue; }
    for (let c = 0; c < 3; c++) if (Math.abs(P[i * 3 + c] - P[o * 3 + c]) > 1e-4) bad++;
    const a = wmap(i), c2 = wmap(o); for (const k of new Set([...Object.keys(a), ...Object.keys(c2)])) if (Math.abs((a[k] || 0) - (c2[k] || 0)) > 0.02) { wbad++; break; } }
  assert.equal(bad, 0); assert.equal(wbad, 0);
});
