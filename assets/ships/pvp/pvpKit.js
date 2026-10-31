// [Raul] Shared helpers for the PvP specialty skins (golden.js, ghost.js, kraken.js). Hitbox-neutral, merged geometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, outlineFor } from '../../../js/toon.js';
import { wind } from '../../../js/ships.js';
export { THREE, wind, toon, outlineFor, mergeGeometries };

// position / rotate / scale a geometry in place, returns it (non-indexed, position+normal only, so merges are trivial)
export function place(g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  g = g.index ? g.toNonIndexed() : g;
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
export const merge = (list) => mergeGeometries(list, false);
// one mesh (+ optional toon outline) per material; geometry is cached by the caller, so mark it shared
export function meshOf(geo, mat, ctx, { outline = 0, parent } = {}) {
  const m = new THREE.Mesh(geo, mat); m.userData.sharedGeo = true; ctx.add(m, parent);
  if (outline) { const o = outlineFor(m, outline); ctx.add(o, parent); }
  return m;
}
// lofted hull on the base hull's own plan shape (same footprint), with a custom girth profile per section:
//   ring(t) -> [[x, y], ...] for the port side, gunwale first, keel last (mirrored to starboard)
export function loftHull(len, ring, N = 16, t0 = 0.02, t1 = 0.99) {
  const P = [], U = [];
  for (let i = 0; i < N; i++) {
    const ta = t0 + i / N * (t1 - t0), tb = t0 + (i + 1) / N * (t1 - t0), za = (ta - 0.5) * len, zb = (tb - 0.5) * len, A = ring(ta), B = ring(tb);
    for (const sx of [1, -1]) for (let j = 0; j < A.length - 1; j++) {
      const a0 = [sx * A[j][0], A[j][1], za], a1 = [sx * A[j + 1][0], A[j + 1][1], za], b0 = [sx * B[j][0], B[j][1], zb], b1 = [sx * B[j + 1][0], B[j + 1][1], zb];
      if (sx > 0) P.push(...a0, ...a1, ...b0, ...b0, ...a1, ...b1); else P.push(...a0, ...b0, ...a1, ...b0, ...b1, ...a1);
      const v0 = j / (A.length - 1), v1 = (j + 1) / (A.length - 1); U.push(za / 4, v0, za / 4, v1, zb / 4, v0, zb / 4, v0, za / 4, v1, zb / 4, v1);
    }
  }
  const S = ring(t0), zs = (t0 - 0.5) * len, cy = (S[0][1] + S[S.length - 1][1]) / 2; // flat transom
  for (let j = 0; j < S.length - 1; j++) for (const sx of [1, -1]) { const p = [sx * S[j][0], S[j][1], zs], q = [sx * S[j + 1][0], S[j + 1][1], zs]; if (sx > 0) P.push(0, cy, zs, ...q, ...p); else P.push(0, cy, zs, ...p, ...q); U.push(0.5, 0.5, 0, 0, 0, 0); }
  P.push(-S[0][0], S[0][1], zs, S[0][0], S[0][1], zs, 0, cy, zs); U.push(0, 0, 0, 0, 0, 0);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals();
  return g;
}
// a tapered tube along a curve; adds a 'sway' attribute (0 at the root .. 1 at the tip) for vertex animation
export function taperTube(points, r0, r1, seg = 20, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(points), frames = curve.computeFrenetFrames(seg, false), P = [], W = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, c = curve.getPointAt(t), r = r0 + (r1 - r0) * t, N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) { const a = j / radial * Math.PI * 2; P.push(c.x + r * (Math.cos(a) * N.x + Math.sin(a) * B.x), c.y + r * (Math.cos(a) * N.y + Math.sin(a) * B.y), c.z + r * (Math.cos(a) * N.z + Math.sin(a) * B.z)); W.push(t); }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('sway', new THREE.Float32BufferAttribute(W, 1)); g.setIndex(idx); g.computeVertexNormals();
  return { geo: g, curve };
}
// metallic / spectral toon shine injected into a toon material (shared wind clock; per-ship k via uniform object)
export function injectShine(mat, frag, uniforms = {}, key = 'shine') {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey?.() || 'toon';
  mat.onBeforeCompile = (s, r) => {
    prev?.call(mat, s, r);
    Object.assign(s.uniforms, { uKT: wind.uTime }, uniforms);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vKW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvKW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vKW; uniform float uKT;\n' + Object.keys(uniforms).map(k => `uniform float ${k};`).join('\n'))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 Nv = normalize(normal); vec3 Vv = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);\n  vec3 Rw = normalize((vec4(reflect(-Vv, Nv), 0.0) * viewMatrix).xyz); float fres = pow(1.0 - clamp(dot(Nv, Vv), 0.0, 1.0), 3.0);\n' + frag + '\n}');
  };
  mat.customProgramCacheKey = () => prevKey + '|' + key;
  return mat;
}
// per-ship effect state: ticks find it here (and do nothing on other skins)
export const fxOf = (ship) => ship.userData.pvpFx || (ship.userData.pvpFx = {});
export const hash = (i) => ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
