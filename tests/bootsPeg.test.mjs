// [Raul items redo] the rebuilt shop boots (tools/blender/boots/build_boots.py) x every peg leg: BANKSY (10:02 AM 2026-11-04)
// "boots don't work with peg leg" -> with a peg on, the boot renders ONLY on the real foot: the peg-side boot is fully dropped, nothing
// of the kept boot reaches the peg / knee sleeve, the boot hide rule leaves the peg leg to PEG5. Plus: the fit, the skin, the tri budget.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOOT_CUT, BOOT5, bootKeep, bootHides } from '../js/bootPeg.js';
const ROOT = new URL('../', import.meta.url);
function glb(path) {
  const b = readFileSync(new URL(path, ROOT)); const jl = b.readUInt32LE(12); const J = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = b.subarray(20 + jl + 8); const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }, T = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const acc = (i) => { const a = J.accessors[i], v = J.bufferViews[a.bufferView], n = N[a.type], Ty = T[a.componentType], st = v.byteStride || n * Ty.BYTES_PER_ELEMENT, off = (v.byteOffset || 0) + (a.byteOffset || 0), out = new Ty(a.count * n);
    const dv = new DataView(bin.buffer, bin.byteOffset); const rd = { 5121: (o) => dv.getUint8(o), 5123: (o) => dv.getUint16(o, true), 5125: (o) => dv.getUint32(o, true), 5126: (o) => dv.getFloat32(o, true) }[a.componentType];
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = rd(off + k * st + c * Ty.BYTES_PER_ELEMENT);
    return out; };
  const prim = J.meshes[0].primitives[0];
  return { J, P: acc(prim.attributes.POSITION), I: prim.indices != null ? acc(prim.indices) : null, Jn: prim.attributes.JOINTS_0 != null ? acc(prim.attributes.JOINTS_0) : null, W: prim.attributes.WEIGHTS_0 != null ? acc(prim.attributes.WEIGHTS_0) : null };
}
const shim = (P) => ({ getX: (i) => P[i * 3] });
const BOOTS = ['boots_buckle', 'boots_cavalier', 'boots_gold'], PEGS = ['peg', 'peg_gold', 'peg_kraken', 'peg_ghost'];
const src = readFileSync(new URL('js/pirateItems.js', ROOT), 'utf8'), gear = readFileSync(new URL('js/pirateGear.js', ROOT), 'utf8');
const PEG_CUT = JSON.parse(src.match(/PEG_CUT = (\{[^}]+\})/)[1].replace(/(\w+):/g, '"$1":'));
const cache = new Map(), load = (p) => (cache.has(p) ? cache.get(p) : (cache.set(p, glb(p)), cache.get(p)));
for (const boot of BOOTS) for (const who of ['male', 'female']) for (const lod of ['hi', 'lo']) {
  const B = () => load(`assets/pirates/items/v5/${boot}_${who}_${lod}.glb`);
  test(`${boot} ${who} ${lod}: one boot per foot, skinned to its own leg, top over the hide line, tris`, () => {
    const { J, P, I, Jn, W } = B(); const names = J.skins[0].joints.map((j) => J.nodes[j].name);
    let zmin = 9, zmax = -9; const top = { L: -9, R: -9 };
    for (let i = 0; i < P.length / 3; i++) { const x = P[i * 3], y = P[i * 3 + 1]; zmin = Math.min(zmin, y); zmax = Math.max(zmax, y); const s = x > 0 ? 'L' : 'R'; top[s] = Math.max(top[s], y);
      assert.ok(Math.abs(x) > 0.004, 'no vertex on the centre line ' + x);
      for (let k = 0; k < 4; k++) if (W[i * 4 + k] > 0.01) assert.match(names[Jn[i * 4 + k]], new RegExp(`^(shin|thigh)\\.${s}$`), `vertex ${i} weighted to ${names[Jn[i * 4 + k]]}`); }
    for (let t = 0; t < I.length; t += 3) { const sg = [0, 1, 2].map((k) => Math.sign(P[I[t + k] * 3])); assert.ok(sg[0] === sg[1] && sg[1] === sg[2], 'a triangle spans both feet'); }
    assert.ok(zmin > -0.01 && zmin < 0.002, 'sole on the floor ' + zmin);
    for (const s of ['L', 'R']) { assert.ok(top[s] > BOOT_CUT[boot][who] + 0.02, `${s} top ${top[s]} over the cut`); assert.ok(top[s] < PEG_CUT[who] + 0.03, 'under the knee'); }
    assert.ok(BOOT_CUT[boot][who] < PEG_CUT[who], 'boot hide line under the peg sleeve cut');
    const tris = I.length / 3; assert.ok(tris < (lod === 'lo' ? 3400 : 12000), 'tris ' + tris);   // [boots 4] BANKSY-approved caps: hi ~12k, lo +25%
  });
  for (const peg of PEGS) for (const side of ['L', 'R']) test(`${boot} x ${peg} ${side} (${who} ${lod}): the peg-side boot is hidden, the other foot keeps its boot`, () => {
    // the peg item routes to slot leg<side> (js/pirateGear.js), its v5 fit lives on that side
    assert.match(gear, new RegExp(`'leg:${peg}':\\s*\\[\\(g\\) => 'leg' \\+ g\\.legSide`), 'routing ' + peg);
    assert.match(src, new RegExp(`item\\('${peg}_${side.toLowerCase()}', [^\\n]*'leg${side}'[^\\n]*v5hide: PEG5\\('${side}'\\)`), `${peg}_${side.toLowerCase()} on leg${side}`);
    const { P, I } = B(); const keep = bootKeep(shim(P), I, side === 'L', side === 'R'), other = side === 'L' ? 'R' : 'L';
    const all = { L: 0, R: 0 }; for (let t = 0; t < I.length; t += 3) all[P[I[t] * 3] > 0 ? 'L' : 'R']++;
    const kept = { L: 0, R: 0 }; let xin = 9; for (let t = 0; t < keep.length; t += 3) for (let k = 0; k < 3; k++) { const x = P[keep[t + k] * 3]; kept[x > 0 ? 'L' : 'R'] += k === 0; xin = Math.min(xin, Math.abs(x)); }
    assert.equal(kept[side], 0, 'nothing of the boot left on the peg side'); assert.equal(kept[other], all[other], 'the real foot keeps its whole boot');
    // nothing of the kept boot reaches the peg or its knee sleeve (bind space: the boot stays on its own side, clear of the peg's inner edge)
    const G = load(`assets/pirates/items/v5/${peg}_${side.toLowerCase()}_${who}_${lod}.glb`).P, sx = side === 'L' ? 1 : -1, H = new Map(), C = 0.012, key = (x, y, z) => `${Math.floor(x / C)},${Math.floor(y / C)},${Math.floor(z / C)}`;
    for (let i = 0; i < G.length / 3; i++) { const k = key(G[i * 3], G[i * 3 + 1], G[i * 3 + 2]); (H.get(k) || H.set(k, []).get(k)).push(i); }
    let dmin = 9; const seen = new Set(keep);
    for (const i of seen) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], cx = Math.floor(x / C), cy = Math.floor(y / C), cz = Math.floor(z / C);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) for (const j of H.get(`${cx + a},${cy + b},${cz + c}`) || []) dmin = Math.min(dmin, Math.hypot(x - G[j * 3], y - G[j * 3 + 1], z - G[j * 3 + 2])); }
    assert.ok(dmin > 0.01, `kept boot ${xin.toFixed(3)} from the centre line, ${dmin.toFixed(4)} m from the peg: touching`);
    // the boot hide rule never cuts the peg leg (PEG5 owns it); the real leg still hides under the boot
    const r = BOOT5(boot).find((q) => (who === 'female' ? q.female : q.male)), x = sx * 0.09;
    assert.equal(bootHides(r, x, 0.05, who === 'female', side === 'L', side === 'R'), false, 'peg leg left to PEG5');
    assert.equal(bootHides(r, -x, 0.05, who === 'female', side === 'L', side === 'R'), true, 'real leg hidden under its boot');
    assert.equal(bootHides(r, -x, BOOT_CUT[boot][who] + 0.01, who === 'female', side === 'L', side === 'R'), false, 'pants above the cut stay');
  });
}
test('boots keep their ids, slot, prices; every boot hides with BOOT5; crews copy no captain items', () => {
  for (const b of BOOTS) assert.match(src, new RegExp(`item\\('${b}', [^\\n]*'boots'[^\\n]*v5hide: BOOT5\\('${b}'\\)`), b);
  const cat = readFileSync(new URL('js/shopCatalog.js', ROOT), 'utf8');
  for (const [id, pr] of [['boots_buckle', 350], ['boots_cavalier', 1000], ['boots_gold', 3000]]) assert.match(cat, new RegExp(`id: '${id}'[^\\n]*price: ${pr}\\b`), id);
  const crew = readFileSync(new URL('js/crewV4.js', ROOT), 'utf8'); assert.match(crew, /CREW_EXTRA_SLOTS = \[\], CREW_EXTRA_LOW = \[\]/);
});
