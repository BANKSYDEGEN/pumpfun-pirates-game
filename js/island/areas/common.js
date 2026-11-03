// [island-rework] shared bits for the island areas (js/island/areas/*.js): chunky kit helpers in the plaza style (flat toon colours +
// the inverted-hull outline from js/island/kit.js), NPC + chest builders, and the local cosmetic progress store.
import * as THREE from 'three';
import { Kit, M } from '../kit.js';
export { Kit, M };
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (a, b, h, n = 8) => new THREE.CylinderGeometry(a, b, h, n);
export const ball = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
export const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
export const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function jitter(g, k, seed) { const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), n = 1 + k * (Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 + seed * 1.3) + Math.sin(y * 4.3 + seed * 0.7)) * 0.5; P.setXYZ(i, x * n, y * n, z * n); } g.computeVertexNormals(); return g; }
export const W = (k, g, c, m, o = true) => k.add(g, c, { m, outline: o });
export const C = { STONE: 0xb9b2a6, STONE_D: 0x8a837a, MOSS: 0x5f9a3a, VINE: 0x2f8a3a, WOOD: 0xa86a3a, WOOD_D: 0x6b4527, WOOD_L: 0xd9a36b, IRON: 0x2b2f36, GOLD: 0xffc93c, RED: 0xd8322f, SKIN: 0xf1c27d, SKIN_D: 0xc68642, WHITE: 0xf4efe6, BLUE: 0x2a6df4, TEAL: 0x1f9aa3, REED: 0x7fae3a, REED_D: 0x5b7d2a, CLOTH: 0xe9d7b0 };

// a chunky NPC (plaza-pirate proportions, ~1.9 m), facing +z at the origin of the kit frame
export function npc(k, { shirt = C.BLUE, pants = C.WOOD_D, skin = C.SKIN, beard = null, hat = 'tricorn', hatC = 0x2b2f36, prop = null } = {}) {
  for (const s of [-1, 1]) { W(k, box(0.32, 0.8, 0.36), pants, M(s * 0.2, 0.4, 0)); W(k, box(0.36, 0.22, 0.5), 0x2a1a10, M(s * 0.2, 0.11, 0.06)); }
  W(k, box(0.86, 0.8, 0.5), shirt, M(0, 1.2, 0)); W(k, box(0.9, 0.14, 0.54), 0x3b2414, M(0, 0.86, 0), false);
  for (const s of [-1, 1]) { W(k, box(0.22, 0.7, 0.26), shirt, M(s * 0.55, 1.18, 0.02, 0, 0, s * 0.12)); W(k, ball(0.13), skin, M(s * 0.6, 0.8, 0.04), false); }
  W(k, box(0.56, 0.56, 0.52), skin, M(0, 1.9, 0));
  for (const s of [-1, 1]) W(k, box(0.08, 0.1, 0.02), 0x1a1a1a, M(s * 0.13, 1.95, 0.27), false);
  W(k, box(0.12, 0.14, 0.1), skin, M(0, 1.86, 0.3), false);
  if (beard) W(k, box(0.58, 0.34, 0.2), beard, M(0, 1.66, 0.22));
  if (hat === 'tricorn') { W(k, cyl(0.5, 0.5, 0.08, 3), hatC, M(0, 2.22, 0, Math.PI)); W(k, cyl(0.26, 0.32, 0.26, 8), hatC, M(0, 2.36, 0)); }
  else if (hat === 'straw') { W(k, cyl(0.62, 0.62, 0.05, 10), 0xe8c66a, M(0, 2.2, 0)); W(k, cyl(0.24, 0.3, 0.24, 10), 0xe8c66a, M(0, 2.33, 0)); W(k, cyl(0.31, 0.31, 0.06, 10), C.RED, M(0, 2.26, 0), false); }
  else if (hat === 'bandana') W(k, box(0.6, 0.22, 0.56), C.RED, M(0, 2.24, 0));
  if (prop === 'staff') W(k, cyl(0.05, 0.06, 2.3, 5), C.WOOD_D, M(0.7, 1.1, 0.15));
  if (prop === 'rod') { W(k, cyl(0.025, 0.04, 2.6, 4), C.WOOD_L, M(0.7, 1.6, 0.6, 0, 0.9)); }
}
// a small chest whose lid opens: { grp, lid, open(t), tick(t) } (two tiny merged meshes)
export function openChest(MATS, OUT, { c = C.WOOD, band = C.GOLD, s = 1 } = {}) {
  const kb = new Kit(), kl = new Kit();
  W(kb, box(1.1 * s, 0.6 * s, 0.75 * s), c, M(0, 0.3 * s, 0)); for (const x of [-0.4, 0.4]) W(kb, box(0.1 * s, 0.62 * s, 0.78 * s), band, M(x * s, 0.31 * s, 0), false);
  W(kb, box(0.9 * s, 0.1 * s, 0.6 * s), 0xffd75a, M(0, 0.58 * s, 0), false);
  W(kl, box(1.12 * s, 0.26 * s, 0.77 * s), c, M(0, 0.13 * s, 0.385 * s)); W(kl, box(0.18 * s, 0.2 * s, 0.06 * s), band, M(0, 0.06 * s, 0.78 * s), false);
  const grp = new THREE.Group(), base = kb.build(MATS, OUT), lid = new THREE.Group(), lm = kl.build(MATS, OUT); lid.add(lm); lid.position.set(0, 0.6 * s, -0.385 * s); grp.add(base, lid);
  let t0 = -1; return { grp, lid, open(t) { if (t0 < 0) t0 = t; }, reset() { t0 = -1; lid.rotation.x = 0; }, get isOpen() { return t0 >= 0; },
    tick(t) { if (t0 >= 0) lid.rotation.x = -1.7 * sm(0, 0.8, t - t0); } };
}
// local, cosmetic progress (journals, collectibles, daily finds). Never gold, never the leaderboard.
const KEY = 'pfp_isle_v1';
export const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } },
  upd(fn) { const o = store.get(); fn(o); try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { } return o; },
};
export const today = () => new Date().toISOString().slice(0, 10);
// instanced helper: one InstancedMesh of a kit-built piece (geometry + toon material of the merged kit), for reeds / pads / shards
export function instanced(MATS, OUT, buildFn, mats, name) {
  const k = new Kit(); buildFn(k); const grp = k.build(MATS, OUT), meshes = [];
  grp.traverse(o => { if (o.isMesh && !o.userData.outline) meshes.push(o); }); // instanced: toon only (the outline shell is per-merged-mesh)
  const out = new THREE.Group(); out.name = name;
  for (const m of meshes) { const im = new THREE.InstancedMesh(m.geometry, m.material, mats.length); mats.forEach((mx, i) => im.setMatrixAt(i, mx)); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.name = name + '_' + m.name; out.add(im); }
  return out;
}
