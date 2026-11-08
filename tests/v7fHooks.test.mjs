// [v7f hooks b10] BANKSY t449u / t450u: both hooks on the V7 female. The raw v5-female cuff sat ~3 cm low / ~4 cm forward of her
// forearm, so the runtime hand hide left her wrist stub showing under / behind it. Her files are a RIGID re-seat of the raw hook
// (one translation per file): mesh, indices, UVs, COLOR_0 (iron + goldHook recolour), _TINT and skin are byte-for-byte the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { MeshoptDecoder } from '../vendor/three-0.165.0/examples/jsm/libs/meshopt_decoder.module.js';
import { V7F_FITS } from '../js/v7fFitData.js';
import { V7M_FITS } from '../js/v7mFitData.js';

await MeshoptDecoder.ready;
const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }, NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function glb(path) {
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
const prim = (g) => g.j.meshes.map((m) => m.primitives[0]).reduce((a, p) => (g.j.accessors[p.attributes.POSITION].count > g.j.accessors[a.attributes.POSITION].count ? p : a));
const joints = (g) => g.j.skins[0].joints.map((i) => g.j.nodes[i].name);
const body = glb('assets/pirates/pirate_female_v7_hi.glb'), BODY_BONES = new Set(joints(body));
const BP = await (async () => {   // her body is Draco-packed: decode its bind positions with the vendored decoder
  const M = await createRequire(import.meta.url)('../vendor/three-0.165.0/examples/jsm/libs/draco/gltf/draco_decoder.js')({});
  const b = readFileSync('assets/pirates/pirate_female_v7_hi.glb'), jl = b.readUInt32LE(12), bin = b.subarray(28 + jl), ext = prim(body).extensions.KHR_draco_mesh_compression, bv = body.j.bufferViews[ext.bufferView];
  const data = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength), dec = new M.Decoder(), buf = new M.DecoderBuffer(), mesh = new M.Mesh();
  buf.Init(new Int8Array(data.buffer, data.byteOffset, data.byteLength), data.byteLength); assert.ok(dec.DecodeBufferToMesh(buf, mesh).ok());
  const arr = new M.DracoFloat32Array(); dec.GetAttributeFloatForAllPoints(mesh, dec.GetAttributeByUniqueId(mesh, ext.attributes.POSITION), arr);
  const out = new Float32Array(arr.size()); for (let i = 0; i < out.length; i++) out[i] = arr.GetValue(i); return out; })();
const near = (a, b, e) => Math.abs(a - b) <= e;
// bbox centre (y, z) of slices across x (per-side), as tools measure her forearm / the cuff band
function axis(P, sx, x0, x1, y0 = 0.6, y1 = 0.95) { const c = [];
  for (let x = x0; x < x1; x += 0.01) { let a = 1e9, b = -1e9, z0 = 1e9, z1 = -1e9, k = 0;
    for (let i = 0; i < P.length / 3; i++) { const X = sx * P[i * 3], Y = P[i * 3 + 1], Z = P[i * 3 + 2]; if (Math.abs(X - x) < 0.005 && Y > y0 && Y < y1) { a = Math.min(a, Y); b = Math.max(b, Y); z0 = Math.min(z0, Z); z1 = Math.max(z1, Z); k++; } }
    if (k > 4) c.push([(a + b) / 2, (z0 + z1) / 2]); }
  return [c.reduce((s, v) => s + v[0], 0) / c.length, c.reduce((s, v) => s + v[1], 0) / c.length]; }

for (const s of ['l', 'r']) {
  const id = `hook_${s}`, sx = s === 'l' ? 1 : -1, arm = axis(BP, sx, 0.30, 0.41);
  test(`${id}: routed for her (hi + lo), the item's own female arm cut kept, male route never names it`, () => {
    for (const lod of ['hi', 'lo']) assert.equal(V7F_FITS[id][lod], `assets/pirates/items/v7f_fit/${id}_female_${lod}.glb`);
    assert.equal(V7F_FITS[id].hide, undefined, 'no override: the v5hide { arm, s, female } rule of the item applies');
    const items = readFileSync('js/pirateItems.js', 'utf8');
    assert.ok(items.includes(s === 'l' ? "{ arm: 'L', s: 0.27, female: 1 }" : "{ arm: 'R', s: 0.276, female: 1 }"), 'female hand cut as shipped');
    assert.ok(!V7M_FITS[id] || !/_female_/.test(V7M_FITS[id].hi || ''));
    const gear = readFileSync('js/pirateGear.js', 'utf8');   // iron + gold share the item (gold = goldHook recolour on COLOR_0)
    assert.match(gear, /'hook:hook_gold': \[\(g\) => 'hand' \+ g\.hookSide, \(g\) => 'hook_' \+ g\.hookSide\.toLowerCase\(\), null, \{ gold: true \}\]/);
  });
  for (const lod of ['hi', 'lo']) test(`${id} (${lod}): a pure translation of the raw v5 hook; cuff centred on her forearm`, () => {
    const src = `assets/pirates/items/v5/${id}_female_${lod}.glb`, a = glb(src), b = glb(V7F_FITS[id][lod]), pa = prim(a), pb = prim(b);
    assert.ok(statSync(V7F_FITS[id][lod]).size <= statSync(src).size, 'not bigger than the source');
    assert.equal(b.j.accessors[pb.attributes.POSITION].componentType, 5126, 'float positions');
    assert.deepEqual(joints(b), joints(a)); for (const n of joints(b)) assert.ok(BODY_BONES.has(n), 'bone ' + n);
    assert.deepEqual(Object.keys(pb.attributes).sort(), Object.keys(pa.attributes).sort());
    for (const k of Object.keys(pa.attributes)) if (k !== 'POSITION') assert.deepEqual(Array.from(b.acc(pb.attributes[k])), Array.from(a.acc(pa.attributes[k])), k + ' unchanged');
    const tris = (I) => { const t = []; for (let i = 0; i < I.length; i += 3) { const v = [I[i], I[i + 1], I[i + 2]], k = v.indexOf(Math.min(...v)); t.push(`${v[k]},${v[(k + 1) % 3]},${v[(k + 2) % 3]}`); } return t.sort(); };
    assert.deepEqual(tris(b.acc(pb.indices)), tris(a.acc(pa.indices)), 'same triangles, same winding (Meshopt only reorders / rotates them)');
    assert.ok(b.j.images?.length >= 1 && b.j.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture, 'keeps its atlas map (runtime map x COLOR_0)');
    const A = a.acc(pa.attributes.POSITION), B = b.acc(pb.attributes.POSITION), d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    let dev = 0; for (let i = 0; i < A.length; i += 3) for (let c = 0; c < 3; c++) dev = Math.max(dev, Math.abs(B[i + c] - A[i + c] - d[c]));
    assert.ok(dev < 2e-6, 'one rigid translation (no reshaping): ' + dev);
    const m = Math.hypot(...d); assert.ok(m > 0.03 && m < 0.07, 'moved a few cm: ' + m);
    let x0 = 1e9; for (let i = 0; i < B.length; i += 3) x0 = Math.min(x0, sx * B[i]);
    const ca = axis(A, sx, 0.37, 0.46, 0, 2), cb = axis(B, sx, 0.37, 0.46, 0, 2);
    assert.ok(Math.hypot(ca[0] - arm[0], ca[1] - arm[1]) > 0.025, 'the raw cuff was off her forearm axis (the old bug)');
    assert.ok(near(cb[0], arm[0], 0.004) && near(cb[1], arm[1], 0.004), `cuff on her forearm axis ${cb} vs ${arm}`);
    assert.ok(x0 > 0.34 && x0 < 0.37, 'cuff rim just above her wrist (the hand cut sits inside it): ' + x0);
  });
}
