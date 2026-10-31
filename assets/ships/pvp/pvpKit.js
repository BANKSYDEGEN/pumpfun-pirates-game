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
  const E = ring(t1), ze = (t1 - 0.5) * len, ey = (E[0][1] + E[E.length - 1][1]) / 2; // closed stem (watertight bow, no gap at the tip)
  for (let j = 0; j < E.length - 1; j++) for (const sx of [1, -1]) { const p = [sx * E[j][0], E[j][1], ze], q = [sx * E[j + 1][0], E[j + 1][1], ze]; if (sx > 0) P.push(0, ey, ze, ...p, ...q); else P.push(0, ey, ze, ...q, ...p); U.push(0.5, 0.5, 0, 0, 0, 0); }
  P.push(E[0][0], E[0][1], ze, -E[0][0], E[0][1], ze, 0, ey, ze); U.push(0, 0, 0, 0, 0, 0);
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

// ---------- premium-tier helpers (all PvP skins) ----------
// Imposing silhouette: everything on the bobbing body (hull, deck, water-mask lid, masts, sails, props) moves into one
// lifted + enlarged group, so the deck, masts and props stay seated and the water lid stays on the new gunwale.
// Visual only (runPartsOverride restores len/beam/depth = hitbox). A child group, not body.scale, because the upgrade
// 'pop' animation writes body.scale. Call LAST in a partsOverride.
export function liftRig(ctx, { lift = 0.5, sx = 1.08, sy = 1.18, sz = 1.08 } = {}) {
  const body = ctx.body, g = new THREE.Group(); g.name = 'pvpLift';
  for (const c of [...body.children]) g.add(c);
  g.scale.set(sx, sy, sz); g.position.y = lift * ctx.depth / 3.1; body.add(g);
  return g;
}
// signature wake: additive GPU sparks streaming aft with THIS ship's own measured speed (local or remote),
// stars + soft cores, fade with distance travelled. One draw call; low quality uses fewer, larger points.
const _wakeMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime, uSpeed: { value: 0 }, uBox: { value: new THREE.Vector3() }, uC0: { value: new THREE.Color() }, uC1: { value: new THREE.Color() }, uSize: { value: 300 }, uRise: { value: 0 } },
  vertexShader: `attribute vec3 seed; uniform float uT; uniform float uSpeed; uniform vec3 uBox; uniform float uSize; uniform float uRise; varying float vA; varying float vL;
    void main(){ float life = fract(uT * (0.25 + seed.z * 0.15) + seed.x);
      float side = seed.y < 0.5 ? -1.0 : 1.0;
      vec3 p = vec3(side * uBox.x * (0.3 + life * (0.5 + seed.z)), 0.25 + life * uRise + sin(seed.x * 50.0 + uT * 4.0) * 0.15, uBox.z - life * uBox.y * (0.3 + 0.7 * uSpeed));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float tw = 0.5 + 0.5 * pow(0.5 + 0.5 * sin(uT * 8.0 + seed.y * 90.0), 2.0);
      vA = (1.0 - life) * tw * (0.25 + 0.75 * uSpeed); vL = life;
      gl_PointSize = (0.55 + 0.6 * seed.z) * (1.0 - life * 0.5) * uSize / max(1.0, -mv.z);
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uC0; uniform vec3 uC1; varying float vA; varying float vL; void main(){ vec2 q = gl_PointCoord - 0.5;
      float d = length(q), star = max(0.0, 1.0 - abs(q.x) * 12.0) * max(0.0, 1.0 - abs(q.y) * 2.2) + max(0.0, 1.0 - abs(q.y) * 12.0) * max(0.0, 1.0 - abs(q.x) * 2.2);
      float a = (smoothstep(0.3, 0.0, d) + star * 0.7) * vA; if (a < 0.02) discard;
      gl_FragColor = vec4(mix(uC0, uC1, vL) * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const _wakeGeo = new Map(), _wp = new THREE.Vector3();
export function signatureWake(ship, ctx, { c0 = 0xffffff, c1 = 0xffffff, n = 48, size = 300, rise = 0 } = {}) {
  if (ctx.quality === 'low') { n = Math.round(n * 0.4); size *= 1.3; }
  if (!_wakeGeo.has(n)) { const g = new THREE.BufferGeometry(), s = new Float32Array(n * 3); for (let i = 0; i < s.length; i++) s[i] = hash(i * 1.37 + 3);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 3)); _wakeGeo.set(n, g); }
  const m = _wakeMat.clone(); m.uniforms.uT = wind.uTime; m.uniforms.uC0.value.set(c0); m.uniforms.uC1.value.set(c1); m.uniforms.uSize.value = size; m.uniforms.uRise.value = rise;
  m.uniforms.uBox.value.set(ctx.beam, ctx.len * 1.1, -ctx.len * 0.45);
  const p = new THREE.Points(_wakeGeo.get(n), m); p.frustumCulled = false; p.renderOrder = 4; p.userData.sharedGeo = true; p.userData.pvpWake = true;
  const S = { t: 0, x: 0, z: 0 }, u = m.uniforms.uSpeed;
  p.onBeforeRender = () => { const now = performance.now(); if (now - S.t < 12) return; const dt = Math.min(0.25, (now - S.t) / 1000);
    ship.getWorldPosition(_wp); const fed = ship.userData.pvpFx?.speed, v = typeof fed === 'number' ? fed : (typeof ship.userData.speed === 'number' ? ship.userData.speed : Math.hypot(_wp.x - S.x, _wp.z - S.z) / dt);
    S.x = _wp.x; S.z = _wp.z; S.t = now; u.value += (Math.min(1, Math.abs(v) / 10) - u.value) * Math.min(1, dt * 4); };
  ctx.add(p, ship); // on the ship (level with the water), not the bobbing body
  return p;
}
