// [v7f gear] BANKSY t436u "Fix all v7 girl clothes and accessories": V7 female refits (footwear + peg legs) on her own body, her cut
// heights, her pants dye height. Female V7 only: male V7 (V7M_FITS / v7m_fit), v5 / v6 bodies and the shared recolour default untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { MeshoptDecoder } from '../vendor/three-0.165.0/examples/jsm/libs/meshopt_decoder.module.js';
import { V7F_FITS, V7F_YMAP, v7fY, V7F_PANTS_DYE_Y } from '../js/v7fFitData.js';
import { BOOT_CUT } from '../js/bootPeg.js';
import { V7M_FITS, V7M_SKIP } from '../js/v7mFitData.js';

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
const FOOT = ['boots_buckle', 'boots_cavalier', 'boots_gold', 'boots_classic', 'boots_sea', 'sandals', 'shoes_buckle'];
const PEGS = ['peg', 'peg_gold', 'peg_kraken', 'peg_ghost'].flatMap((b) => [b + '_l', b + '_r']);

test('V7F_FITS: exactly the refit batches (7 footwear + 8 peg legs + the tank), hi + lo each', () => {
  assert.deepEqual(Object.keys(V7F_FITS).sort(), [...FOOT, ...PEGS, 'cloth_tank'].sort());
  for (const [id, F] of Object.entries(V7F_FITS)) for (const lod of ['hi', 'lo']) {
    assert.equal(F[lod], `assets/pirates/items/v7f_fit/${id}_female_${lod}.glb`); assert.ok(existsSync(F[lod]), F[lod]);
  }
});

test('height map: monotone, floor + crown fixed, her knee / hip joints', () => {
  const { v5, v7 } = V7F_YMAP; for (let i = 1; i < v5.length; i++) { assert.ok(v5[i] > v5[i - 1]); assert.ok(v7[i] > v7[i - 1]); }
  assert.equal(v7fY(0), 0); assert.equal(v7fY(1.397), 1.397); assert.ok(Math.abs(v7fY(0.224) - 0.304) < 1e-9); assert.ok(Math.abs(v7fY(0.42) - 0.534) < 1e-9);
});

for (const id of [...FOOT, ...PEGS]) for (const lod of ['hi', 'lo']) test(`${id} (${lod}): her bones, sound skin, sits on her legs / feet, packed no bigger than the v5 source`, () => {
  const F = V7F_FITS[id], g = glb(F[lod]), src = `assets/pirates/items/v5/${id}_female_${lod}.glb`;
  assert.ok(statSync(F[lod]).size <= statSync(src).size, 'not bigger than the source');
  assert.ok(!g.j.animations?.length, 'no clips');
  for (const n of joints(g)) assert.ok(BODY_BONES.has(n), 'bone ' + n);
  const p = prim(g), A = p.attributes; for (const k of ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0']) assert.ok(A[k] !== undefined, k);
  assert.equal(g.j.accessors[A.POSITION].componentType, 5126, 'float positions (no quantisation transform the skinned loader would skip)');
  const P = g.acc(A.POSITION), J = g.acc(A.JOINTS_0), W = g.acc(A.WEIGHTS_0), wn = g.j.accessors[A.WEIGHTS_0].normalized ? 255 : 1, names = joints(g), n = P.length / 3;
  let y0 = 1e9, y1 = -1e9, bad = 0, off = 0;
  for (let i = 0; i < n; i++) { const y = P[i * 3 + 1]; y0 = Math.min(y0, y); y1 = Math.max(y1, y); let s = 0;
    for (let k = 0; k < 4; k++) { const w = W[i * 4 + k] / wn; s += w; if (w > 0.05 && !/^(thigh\.|shin\.|root$)/.test(names[J[i * 4 + k]])) off++; }
    if (Math.abs(s - 1) > 0.02) bad++; }
  assert.equal(bad, 0, 'weights sum to 1'); assert.equal(off, 0, 'leg bones only (thigh / shin, hip root as her skin has it): follows her walk / idle, never the arms / spine / braid');
  assert.ok(y0 > -0.016 && y0 < 0.03, 'on the floor (v5 soles run to -1.35 cm): ' + y0);
  const hide = F.hide[0];
  if (FOOT.includes(id)) {   // the body below the cut hides; the cut stays inside the shaft / collar (2-5 cm under the top)
    assert.equal(hide.boot5, 1); assert.equal(hide.female, 1); assert.ok(Math.abs(hide.y - Math.round(v7fY(BOOT_CUT[id].female) * 1e4) / 1e4) < 1e-9);
    if (/^boots_/.test(id)) assert.ok(y1 - hide.y > 0.005 && y1 - hide.y < 0.06, `cut ${hide.y} under top ${y1}`); else assert.ok(hide.y < y1 - 0.005, 'low shoe / sandal: cut under the collar / footbed');
    if (/^boots_/.test(id)) assert.ok(y1 > 0.26 && y1 < 0.33, 'boot shaft up her calf, under her knee (0.304): ' + y1);
  } else {   // peg: the knee cup round her knee (0.304), her leg below the cut hides on that side only
    assert.ok(y1 > 0.33 && y1 < 0.42, 'knee cup at her knee: ' + y1); assert.equal(hide.leg5, id.endsWith('_l') ? 'L' : 'R'); assert.ok(hide.y > 0.27 && hide.y < 0.304, 'cut just under her knee');
    let side = 0; for (let i = 0; i < n; i++) if (P[i * 3 + 1] < 0.25) side += Math.sign(P[i * 3]); assert.ok((id.endsWith('_l') ? side : -side) > 0, 'peg on its own side');
  }
});

test('footwear sits under her own knees: one shell per foot, under her shin bone (her feet splay out)', () => {
  const sk = body.j.skins[0], M = body.acc(sk.inverseBindMatrices), knee = {};
  sk.joints.forEach((ni, k) => { const nm = body.j.nodes[ni].name; if (!/^shin\./.test(nm)) return; const m = M.subarray(k * 16, k * 16 + 16);   // inverse bind: the joint sits at -R^T t
    const t = [m[12], m[13], m[14]]; knee[nm.slice(-1)] = [-(m[0] * t[0] + m[1] * t[1] + m[2] * t[2]), -(m[8] * t[0] + m[9] * t[1] + m[10] * t[2])]; });
  assert.ok(knee.L[0] > 0.08 && knee.R[0] < -0.08, 'her knees ' + JSON.stringify(knee));
  for (const id of FOOT) { const g = glb(V7F_FITS[id].hi), P = g.acc(prim(g).attributes.POSITION); const s = { L: [0, 0, 0], R: [0, 0, 0] };
    for (let i = 0; i < P.length / 3; i++) { const y = P[i * 3 + 1]; if (y > 0.04 && y < 0.1) { const f = s[P[i * 3] > 0 ? 'L' : 'R']; f[0] += P[i * 3]; f[1] += P[i * 3 + 2]; f[2]++; } }
    for (const k of ['L', 'R']) { const c = s[k]; assert.ok(c[2] > 10, id + ' ' + k); const dx = (c[0] / c[2] - knee[k][0]) * (k === 'L' ? 1 : -1); assert.ok(dx > -0.02 && dx < 0.07, `${id} ${k} under her knee, feet splayed out (dx ${dx})`); } }
});

test('routing: female V7 only; male V7 refits, v5 / v6 and the shared dye default unchanged', () => {
  const s = readFileSync('js/pirateItems.js', 'utf8');
  assert.match(s, /if \(p\.female && p\.v7 && V7F_FITS\[def\.id\]\) \{ const F = V7F_FITS\[def\.id\];/);
  assert.match(s, /v5:\{female:\{hi:F\.hi,lo:F\.lo\}\}, crownFit:false, noFlatten:true, v5dy:0\}/);
  assert.match(s, /if \(F\.hide\) it\.v5hide = F\.hide; return it; \}/);
  assert.match(s, /if \(p\.female && p\.v7 && def\.pants && p\.v5 && def\.v5\) return buildV5\(p, \{\.\.\.def, dyeY: V7F_PANTS_DYE_Y\}/);
  // the female route sits after her face paint and before the male / generic routes; the male route is as shipped
  const iF = s.indexOf('if (p.female && p.v7 && V7F_FITS[def.id])'), iP = s.indexOf('if (p.female && p.v7 && V7F_PAINT[def.id])'), iM = s.indexOf('if (!p.female && p.v7 && body.userData.sourceLocked && V7M_FITS[def.id] && !V7M_SKIP.has(def.id))'), iG = s.indexOf('if (p.v5 && def.v5) return buildV5(p, def, opts, low, body, skel, names);');
  assert.ok(iP > 0 && iP < iF && iF < iM && iM < iG);
  // shared recolour: without dyeY the pants dye text is byte-identical to before (male V7 / v5 / v6 keep 0.565-0.595)
  assert.ok(s.includes(`:'(1.0-smoothstep(.565,.595,vGearY))')+' * (1.0-red) * (1.0-gold) * (1.0-step(2.5,vGearTag)*step(vGearTag,3.5))'`));
  assert.ok(s.includes(`+ Number(hasTint) + (def.dyeY ? '|dy' + def.dyeY.join(',') : '');`));
  // male isolation, checked on the code as it is (not by git history: V7M_FITS / v7m assets legitimately change in their own commits,
  // and a merge-base diff failed every branch carrying them). Her table only names her own v7f_fit files, the male table never names
  // hers, and the male route stays gated on !p.female ahead of nothing of hers: neither body can load the other's refit.
  for (const [id, F] of Object.entries(V7F_FITS)) for (const lod of ['hi', 'lo'])
    assert.match(F[lod], /^assets\/pirates\/items\/v7f_fit\/[a-z0-9_]+_female_(hi|lo)\.glb$/, `${id} ${lod}: female route only loads her v7f_fit refit`);
  assert.ok(Object.keys(V7M_FITS).length > 0 && V7M_SKIP instanceof Set);
  for (const [id, F] of Object.entries(V7M_FITS)) for (const lod of ['hi', 'lo']) if (F[lod])
    assert.ok(!/v7f_fit|_female_/.test(F[lod]), `${id} ${lod}: male route never loads a female file (${F[lod]})`);
  assert.ok(s.slice(iM, iM + 120).startsWith('if (!p.female && p.v7'), 'male route gated on the male V7 body');
});

test('pants recolour: her pants dye height covers the top of every v5 female pants mesh (no undyed waistband)', () => {
  assert.ok(V7F_PANTS_DYE_Y[0] < V7F_PANTS_DYE_Y[1]);
  for (const id of ['classic_pants', 'canvas_pants', 'sailor_trousers', 'leather_breeches']) for (const lod of ['hi', 'lo']) {
    const g = glb(`assets/pirates/items/v5/${id}_female_${lod}.glb`), a = g.j.accessors[prim(g).attributes.POSITION];
    const top = a.max?.[1]; assert.ok(top !== undefined, 'POSITION max');
    assert.ok(top > 0.595, `${id} ${lod} runs above the shared cut (${top}) - the old bug`); assert.ok(top < V7F_PANTS_DYE_Y[0], `${id} ${lod} under her dye cut`);
  }
});
