// [v7f pants b2] BANKSY t462u / t490u girl pants (this batch: sailor_trousers only, BANKSY t491u one pair first; classic / canvas = Raul, separate batch).
// Her refit pants: same mesh / UVs / colours / tint / hem as the v5 files, designed symmetric garment weights (root / thighs / shins only),
// welded seams, the waistband still under her dye height, and the closed-cloth band hide on her body only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MeshoptDecoder } from '../vendor/three-0.165.0/examples/jsm/libs/meshopt_decoder.module.js';
import { V7F_FITS, V7F_PANTS_DYE_Y } from '../js/v7fFitData.js';
import { V7M_FITS } from '../js/v7mFitData.js';

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
const prim = (g) => { const ms = g.j.meshes.map((m) => m.primitives[0]); return ms.reduce((a, p) => (g.j.accessors[p.attributes.POSITION].count > g.j.accessors[a.attributes.POSITION].count ? p : a)); };
const joints = (g) => g.j.skins[0].joints.map((i) => g.j.nodes[i].name);
const body = glb('assets/pirates/pirate_female_v7_hi.glb'), BODY_BONES = new Set(joints(body));
const PANTS = ['sailor_trousers'], HEM = { sailor_trousers: [0.20, 0.23] };
const A = (g, k) => g.acc(prim(g).attributes[k]);

test('V7F_FITS: this batch = sailor_trousers, with the closed-cloth band hide; male fits stay his', () => {
  for (const id of PANTS) { const F = V7F_FITS[id]; assert.ok(F, id);
    for (const lod of ['hi', 'lo']) assert.equal(F[lod], `assets/pirates/items/v7f_fit/${id}_female_${lod}.glb`);
    assert.deepEqual(F.hide, [{ v7fUnder: [0.33, 0.64], female: 1 }]); }
  for (const id of PANTS) if (V7M_FITS[id]) assert.ok(!V7M_FITS[id].hi.includes('v7f_fit') && !V7M_FITS[id].hide?.some((r) => r.v7fUnder), id);   // his own male fits stay his
});

for (const id of PANTS) for (const lod of ['hi', 'lo']) {
  const f = glb(`assets/pirates/items/v7f_fit/${id}_female_${lod}.glb`), s = glb(`assets/pirates/items/v5/${id}_female_${lod}.glb`);
  test(`${id} ${lod}: same mesh, UVs, colours, _TINT, _HEM, textures as the v5 file`, () => {
    const tris = (g) => { const I = g.acc(prim(g).indices), o = []; for (let t = 0; t < I.length; t += 3) o.push([I[t], I[t + 1], I[t + 2]].sort((a, b) => a - b).join(',')); return o.sort(); };
    assert.deepEqual(tris(f), tris(s));   // same triangles on the same vertices (Meshopt packing only reorders them)
    for (const k of ['TEXCOORD_0', 'COLOR_0', '_TINT', '_HEM']) { const a = A(f, k), b = A(s, k); assert.equal(a.length, b.length, k); for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-3, k + ' ' + i); }
    assert.equal(f.j.images.length, s.j.images.length); assert.equal(f.j.materials.length, s.j.materials.length);
    assert.equal(JSON.stringify(f.j.materials[0].pbrMetallicRoughness?.baseColorTexture ? 1 : 0), '1');
  });
  test(`${id} ${lod}: designed garment weights (root / thighs / shins only, normalised, symmetric masses), her bones`, () => {
    const J = A(f, 'JOINTS_0'), W = A(f, 'WEIGHTS_0'), names = joints(f), sc = W.some((x) => x > 1.5) ? 255 : 1, mass = {};
    for (const n of names) assert.ok(BODY_BONES.has(n), n);
    for (let i = 0; i < J.length / 4; i++) { let t = 0; for (let k = 0; k < 4; k++) { const w = W[i * 4 + k] / sc; t += w; if (w > 0.004) { const n = names[J[i * 4 + k]]; mass[n] = (mass[n] || 0) + w;
      assert.ok(['root', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R'].includes(n), `${i} ${n}`); } } assert.ok(Math.abs(t - 1) < 0.02, `${i} sum ${t}`); }
    // symmetric by design: mirror-paired cloth points (the mesh is not fully symmetric: sash / flaps) carry mirrored leg weights
    const P = A(f, 'POSITION'), n = P.length / 3, wt = (i, b) => { let w = 0; for (let k = 0; k < 4; k++) if (names[J[i * 4 + k]] === b) w += W[i * 4 + k] / sc; return w; };
    let pairs = 0, err = 0; for (let i = 0; i < n; i++) { if (P[i * 3] < 0.03) continue; let bj = -1, bd = 0.012 ** 2;   // nearest cloth point to the mirror image (the mesh is not mirror-built)
      for (let j = 0; j < n; j++) { const d = (P[j * 3] + P[i * 3]) ** 2 + (P[j * 3 + 1] - P[i * 3 + 1]) ** 2 + (P[j * 3 + 2] - P[i * 3 + 2]) ** 2; if (d < bd) { bd = d; bj = j; } }
      if (bj < 0) continue; pairs++; err += Math.abs(wt(i, 'thigh.L') - wt(bj, 'thigh.R')) + Math.abs(wt(i, 'shin.L') - wt(bj, 'shin.R')); }
    assert.ok(pairs > 50, 'mirror pairs ' + pairs); assert.ok(err / pairs < 0.08, `mirror weight error ${err / pairs} over ${pairs}`);
  });
  test(`${id} ${lod}: welded seams stay welded (co-located v5 copies = one point, one weight set); waistband under her dye height; own hem`, () => {
    const P0 = A(s, 'POSITION'), P = A(f, 'POSITION'), J = A(f, 'JOINTS_0'), W = A(f, 'WEIGHTS_0'), n = P.length / 3, key = new Map();
    for (let i = 0; i < n; i++) { const k = [0, 1, 2].map((c) => Math.round(P0[i * 3 + c] * 1e5)).join(','); if (!key.has(k)) key.set(k, i); else { const j = key.get(k);
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(P[i * 3 + c] - P[j * 3 + c]) < 2e-5, `seam ${i}/${j}`);
      const wi = {}, wj = {}; for (let k2 = 0; k2 < 4; k2++) { wi[J[i * 4 + k2]] = (wi[J[i * 4 + k2]] || 0) + W[i * 4 + k2]; wj[J[j * 4 + k2]] = (wj[J[j * 4 + k2]] || 0) + W[j * 4 + k2]; }
      for (const b of new Set([...Object.keys(wi), ...Object.keys(wj)])) assert.ok(Math.abs((wi[b] || 0) - (wj[b] || 0)) <= (W.some((x) => x > 1.5) ? 3 : 0.012), `seam weights ${i}/${j}`); } }
    let ymin = 9, ymax = -9; for (let i = 0; i < n; i++) { const y = P[i * 3 + 1]; ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); if (P0[i * 3 + 1] > 0.665) assert.ok(y > 0.64, `waist top ${i} ${y}`); }
    assert.ok(ymax < V7F_PANTS_DYE_Y[0], 'top under the dye height'); assert.ok(ymin > HEM[id][0] && ymin < HEM[id][1], `hem ${ymin}`);
  });
}

test('runtime: v7fUnder hides her body only (never the pants, never hair / braid), refit pants keep V7F_PANTS_DYE_Y', () => {
  const s = readFileSync('js/pirateItems.js', 'utf8');
  assert.match(s, /if \(r\.v7fUnder\) \{ if \(!isCloth && p\.female && v7fUnderHit\(/);
  assert.match(s, /function v7fUnderHit\(r, x, y, z, t, br\) \{ return y > r\.v7fUnder\[0\] && y < r\.v7fUnder\[1\] && t !== TINTS\.indexOf\('hair'\) && br !== 1/);
  assert.ok(s.includes('v5:{female:{hi:F.hi,lo:F.lo}}, ...(def.pants ? {dyeY:V7F_PANTS_DYE_Y} : {}), crownFit:false, noFlatten:true, v5dy:0}'));
});
