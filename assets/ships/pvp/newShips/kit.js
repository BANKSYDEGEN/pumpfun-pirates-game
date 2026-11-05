// [Emerly] PUMPFUN PIRATES · NEW SHIPS kit (BANKSY: "Make p4 p6 p8 p9 p10, ships"; "we are just making new ships we can rework the order").
// Shared by the five new top-tier hulls (opal.js, leviathan.js, celestial.js, sunKing.js, poseidon.js). Same parts-override API as
// DIAMOND / GOLDEN (./partsOverride.js): a skin swaps materials + adds merged parts; the hitbox (len / beam / depth) is restored after.
//
// The look is SHADER-driven so it costs no per-frame JS and no extra draw calls on the hull itself:
//   shipMat(src, S, role, quality)  clones a kit material ONCE per skin + quality and injects the ship's GLSL `shipFx()` (S.glsl), which
//                                   paints base colour + emissive from object-space position, facet normal, fresnel and the shared
//                                   wind clock (wind.uTime). role = which part of the ship it is (hull / castle / sail / trim / ...).
//   Parts                           every added solid part of one ship in ONE merged mesh: per-vertex colour, aFx (0 matte, 1 metal,
//                                   2 self-glow, 3 the ship's own shader), aSway (0..1 tip weight: tentacles, pennants) + aPh (phase).
//   glows(list)                     camera-facing additive quads (stars, sparks, eye glow, sun corona) in ONE draw; kinds: 0 pulse,
//                                   1 orbit round the mast axis, 2 rise + fade, 3 big soft corona.
// Phone ('low'): NS_LOW drops the noise octaves, fewer segments, fewer glows, no outline on the parts.
import * as THREE from 'three';
import { wind } from '../../../../js/ships.js';
import { toon, outlineFor } from '../../../../js/toon.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE, wind, toon, outlineFor, mergeGeometries };

// ---------- GLSL library (shared by every new ship; tiny value noise, no textures) ----------
export const NS_LIB = `
float nsH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float nsH2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nsN(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(nsH(i), nsH(i + vec3(1,0,0)), f.x), mix(nsH(i + vec3(0,1,0)), nsH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(nsH(i + vec3(0,0,1)), nsH(i + vec3(1,0,1)), f.x), mix(nsH(i + vec3(0,1,1)), nsH(i + vec3(1,1,1)), f.x), f.y), f.z); }
float nsF(vec3 p){
#ifdef NS_LOW
  return nsN(p) * 0.7 + nsN(p * 2.1) * 0.3;
#else
  return nsN(p) * 0.5 + nsN(p * 2.03) * 0.28 + nsN(p * 4.1) * 0.14 + nsN(p * 8.3) * 0.08;
#endif
}
vec3 nsRainbow(float h){ return 0.5 + 0.5 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67))); }
// toon-banded fake environment reflection (sky above, sea below) + sun hotspot: polished metal / gloss
vec3 nsEnv(vec3 Rw, vec3 tint){ float e = smoothstep(-0.35, 0.65, Rw.y); e = floor(e * 4.0 + 0.5) / 4.0;
  vec3 env = mix(tint * 0.08, tint * 1.05 + 0.1, e * e); env += vec3(1.0, 0.97, 0.9) * smoothstep(0.05, 0.0, abs(Rw.y - 0.08)) * 0.7;
  float sd = max(dot(Rw, normalize(vec3(0.45, 0.75, 0.48))), 0.0); return env + vec3(1.0) * (pow(sd, 24.0) * 0.5 + pow(sd, 240.0) * 3.0); }
`;
// roles a ship's shipFx() gets (ROLE constant in the program)
export const ROLE = { hull: 0, upper: 1, sail: 2, gold: 3, wood: 4, parts: 5, mast: 6, accent: 7 };

// ---------- build-quality finish (every new ship, after its shipFx) ----------
// Keeps the base galleon's hand-painted detail (planks, gun-port frames, mouldings, sail seams + emblem) under the ship's look, and
// shades the glow with the sun so curved sails / hull sides keep their form instead of reading as flat glowing slabs (the GOLDEN /
// DIAMOND builds keep the toon shading; a flat emissive flood was what made the first pass look blocky).
//   detail: high-pass of the original texel (its luminance over a blurred mip of the same map: one extra texture read, no new texture)
//   form:   the emissive is scaled by a soft sun term on the world normal, and soft-clipped so only real highlights bloom
function finishGlsl(role, F = {}, parts) {
  const d = F.detail ?? (role === ROLE.sail ? 0.7 : role === ROLE.gold || role === ROLE.accent ? 0.6 : 1.0);
  const sh = F.shade ?? (role === ROLE.gold || role === ROLE.accent ? 0.35 : 0.6), clip = F.clip ?? 0.45;
  return `void nsFinish(inout vec3 base, inout vec3 emit, vec3 N, vec2 uv, float on){
  if (on < 0.5) return;
#ifdef USE_MAP
  { float l = dot(texture2D(map, uv).rgb, vec3(0.3, 0.59, 0.11)), lb = dot(texture2D(map, uv, 5.0).rgb, vec3(0.3, 0.59, 0.11));
    float hp = clamp((l + 0.04) / (lb + 0.04), 0.45, 1.5); hp = mix(1.0, hp, ${d.toFixed(2)});
    base *= hp; emit *= mix(1.0, hp, 0.7); }
#endif
  float sun = clamp(dot(N, normalize(vec3(0.45, 0.75, 0.48))) * 0.7 + 0.45, 0.0, 1.0);
  emit *= mix(1.0, 0.35 + 0.85 * sun, ${sh.toFixed(2)});
  emit = emit / (1.0 + ${clip.toFixed(2)} * emit);
}`;
}

// ---------- one material per (kit material, skin, quality): the ship's look injected ----------
// S = { id, glsl, uniforms? }. glsl defines: void shipFx(inout vec3 base, inout vec3 emit, vec3 P, vec3 W, vec3 N, vec3 Nf, vec3 Rw, float fres, float lum, vec2 uv)
//   P = object-space position (body frame: +z bow, +y up), W = world position, N = world normal, Nf = flat (facet) world normal,
//   Rw = world reflection vector, uv = the texture uv (sails: 0..1 across the cloth), lum = luminance of the original texel (keeps plank / cloth detail), uNT = shared clock (s).
const _mats = new Map();
export function shipMat(src, S, role, quality, extra = {}) {
  const key = `${S.id}|${role}|${quality}|${src.uuid}`;
  if (_mats.has(key)) return _mats.get(key);
  const n = src.clone(), prev = src.onBeforeCompile, prevKey = src.customProgramCacheKey?.() || 'toon', low = quality === 'low';
  if (extra.color != null) n.color.set(extra.color);
  if (extra.transparent) { n.transparent = true; n.opacity = extra.transparent; n.depthWrite = extra.depthWrite ?? true; }
  if (extra.vertexColors) n.vertexColors = true;
  n.emissive = new THREE.Color(0x000000); n.emissiveIntensity = 1;
  const parts = role === ROLE.parts;
  n.onBeforeCompile = (s, r) => {
    if (prev && !parts) prev.call(n, s, r);
    s.uniforms.uNT = wind.uTime; if (S.uniforms) Object.assign(s.uniforms, S.uniforms);
    const head = `#define NS_ROLE ${role}.0\n${low ? '#define NS_LOW\n' : ''}varying vec3 vNP; varying vec3 vNW;${parts ? ' varying float vFx;' : ''}`;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${head}\nuniform float uNT;${parts ? ' attribute float aFx; attribute float aSway; attribute float aPh; uniform float uSwayAmp;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${parts ? `vFx = aFx; { float w = aSway * aSway; transformed += vec3(sin(uNT * 1.3 + aPh), 0.55 * sin(uNT * 0.9 + aPh * 1.7), cos(uNT * 1.1 + aPh * 0.7)) * w * uSwayAmp; }` : ''}\nvNP = transformed;`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvNW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${head}\nuniform float uNT;\n${(S.uniformDecl || '')}`)
      .replace('void main() {', `${NS_LIB}\n${S.glsl}\n${finishGlsl(role, S.finish, parts)}\nvoid main() {`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 Nv = normalize(normal); vec3 Vv = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
  vec3 N = normalize((vec4(Nv, 0.0) * viewMatrix).xyz); vec3 Rw = normalize((vec4(reflect(-Vv, Nv), 0.0) * viewMatrix).xyz);
  vec3 Nf = normalize(cross(dFdx(vNW), dFdy(vNW))); float fres = pow(1.0 - clamp(dot(Nv, Vv), 0.0, 1.0), 3.0);
  vec3 base = diffuseColor.rgb, emit = vec3(0.0); float lum = dot(base, vec3(0.3, 0.59, 0.11)); vec2 nsUv = vec2(0.5);
  #ifdef USE_MAP
  nsUv = vMapUv;
  #endif
  ${parts ? `if (vFx > 2.5) shipFx(base, emit, vNP, vNW, N, Nf, Rw, fres, lum, nsUv);
  else if (vFx > 1.5) emit += base * (1.3 + 0.5 * sin(uNT * 3.0 + vNP.z * 0.7));
  else if (vFx > 0.5) { emit += base * base * nsEnv(Rw, base) * 0.75 + base * fres * 0.5; base *= 0.45; }` : 'shipFx(base, emit, vNP, vNW, N, Nf, Rw, fres, lum, nsUv);'}
  nsFinish(base, emit, N, nsUv, ${parts ? 'vFx > 2.5 ? 1.0 : 0.0' : '1.0'});
  diffuseColor.rgb = base; totalEmissiveRadiance = emit; }`);
  };
  n.customProgramCacheKey = () => `${prevKey}|ns-${S.id}-${role}-${quality}`;
  if (parts) n.userData.nsParts = true;
  _mats.set(key, n); return n;
}

// ---------- which part of the ship a kit material is ----------
export function roleOf(m, ctx) {
  const K = ctx.ud.kitMats || {};
  if (!m || !m.isMeshToonMaterial) return -1;
  if (m === ctx.base.hull?.material) return ROLE.hull;
  if (m === K.upper) return ROLE.upper;
  if (m === K.gold || m.userData?.kitRole === 'gold') return ROLE.gold;
  if (m === K.lid || m === K.band2) return ROLE.accent;
  if (m.customProgramCacheKey?.().startsWith('sail')) return ROLE.sail;
  if (m === ctx.base.mastMat) return ROLE.mast;
  if (m.userData?.kitRole === 'wood') return ROLE.wood;
  return -1; // deck planks, iron, rope, crew: left as they are
}
// swap every ship material: toon by role, outlines / glows / rigging by colour. Returns the per-material map (for parts reuse).
export function dressShip(ship, ctx, S, { outline = 0x0b0d10, glow = null, rope = null, sail = {} } = {}) {
  const done = new Map(), q = ctx.quality;
  ship.traverse(o => {
    if (!(o.isMesh || o.isLineSegments) || o.userData.waterMask || !o.material || o.userData.nsPart) return;
    const m = o.material; if (done.has(m)) { o.material = done.get(m); return; }
    let n = m;
    if (m.side === THREE.BackSide && m.isMeshBasicMaterial) { n = m.clone(); n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey; n.color.set(outline); }
    else if (m.isMeshToonMaterial) { const r = roleOf(m, ctx); if (r >= 0) n = shipMat(m, S, r, q, r === ROLE.sail ? sail : {}); }
    else if (m.isMeshBasicMaterial && glow != null && m.colorWrite !== false) { n = m.clone(); n.color.set(glow).multiplyScalar(1.6); }
    else if (m.isLineBasicMaterial && rope != null) { n = m.clone(); n.color.set(rope); }
    done.set(m, n); o.material = n;
  });
  return done;
}

// ---------- body-frame layout helpers (the art hull: +z bow, y up, deck at shape.top - deckDrop) ----------
// railY(t): the real top of the upper works (castles, bulwarks) at t, sampled once per hull from the hull + hull-dress meshes
const _rail = new Map(), _rv = new THREE.Vector3(), _rm = new THREE.Matrix4();
function railProfile(ud) {
  const k = `${ud.len.toFixed(2)}|${ud.beam.toFixed(2)}`; if (_rail.has(k)) return _rail.get(k);
  const B = 40, top = new Float32Array(B + 1).fill(-1e9), body = ud.body, len = ud.len;
  const roots = [ud.hullDress, ...body.children.filter(o => o.isMesh && o.material?.isMeshToonMaterial && o.material.side === THREE.DoubleSide)].filter(Boolean);
  body.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
  for (const r of roots) r.traverse(o => { if (!o.isMesh || !o.geometry?.attributes.position) return; _rm.multiplyMatrices(inv, o.matrixWorld); const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 1) { _rv.fromBufferAttribute(p, i).applyMatrix4(_rm); const b = Math.round((_rv.z / len + 0.5) * B); if (b >= 0 && b <= B && _rv.y > top[b] && Math.abs(_rv.x) > ud.layout.shape.halfW(b / B) * 0.6) top[b] = _rv.y; } });
  for (let i = 0; i <= B; i++) if (top[i] < -1e8) top[i] = ud.layout.shape.top(i / B) + 0.9;
  const f = (t) => { const x = Math.max(0, Math.min(1, t)) * B, i = Math.floor(x), j = Math.min(B, i + 1); return top[i] + (top[j] - top[i]) * (x - i); };
  _rail.set(k, f); return f;
}
export function frame(ud) {
  const { len, beam, layout } = ud, { shape, deckDrop, bowY, mastDefs } = layout;
  const zAt = (t) => (t - 0.5) * len, deckAt = (t) => shape.top(t) - deckDrop;
  const fig = ud.figure || { p: [0, bowY - 1, zAt(1) - 0.3], s: 1 };
  const jib = ud.jibPts || null;
  return { len, beam, shape, zAt, deckAt, halfW: shape.halfW, top: shape.top, keel: shape.keel, bowY, mastDefs, fig, jib, railY: railProfile(ud),
    mastTop: (i) => { const [tf, hf] = mastDefs[i]; return [0, deckAt(tf) + len * 0.98 * hf, zAt(tf)]; } };
}

// ---------- merged parts builder ----------
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
export class Parts {
  constructor() { this.list = []; }
  // geo: any BufferGeometry (consumed); o: { p, r, s, color, fx (0 matte,1 metal,2 glow,3 ship), sway (number or Float32Array per vertex), ph }
  add(geo, { p = [0, 0, 0], r = [0, 0, 0], s = 1, color = 0xffffff, fx = 0, sway = 0, ph = 0 } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    _m4.compose(_v.set(...p), _q.setFromEuler(_e.set(...r)), Array.isArray(s) ? _s.set(...s) : _s.set(s, s, s)); g.applyMatrix4(_m4);
    const swayAttr = g.attributes.sway; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, c = new THREE.Color(color), C = new Float32Array(n * 3), F = new Float32Array(n), W = new Float32Array(n), P = new Float32Array(n);
    for (let i = 0; i < n; i++) { C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b; F[i] = fx; W[i] = swayAttr ? swayAttr.getX(i) * (typeof sway === 'number' ? sway : 1) : (typeof sway === 'number' ? sway : sway[i]); P[i] = ph; }
    g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('aFx', new THREE.BufferAttribute(F, 1));
    g.setAttribute('aSway', new THREE.BufferAttribute(W, 1)); g.setAttribute('aPh', new THREE.BufferAttribute(P, 1));
    this.list.push(g); return this;
  }
  mirror(fn) { fn(1); fn(-1); return this; }
  // a rod (cylinder, or a cone when r1 = 0) from a to b
  rod(a, b, r0, r1, o = {}) { const A = new THREE.Vector3(...a), D = new THREE.Vector3(...b).sub(A), L = D.length();
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), D.clone().normalize()));
    const g = r1 > 0 ? new THREE.CylinderGeometry(r1, r0, L, o.radial || 6) : new THREE.ConeGeometry(r0, L, o.radial || 6);
    return this.add(g, { ...o, p: A.addScaledVector(D, 0.5).toArray(), r: [e.x, e.y, e.z] }); }
  build() { if (!this.list.length) return null; const g = mergeGeometries(this.list, false); this.list.forEach(x => x.dispose()); this.list = []; g.computeBoundingSphere(); return g; }
}
const _partsBase = new Map();
export function partsMat(S, quality, swayAmp = 0.35) {
  const k = S.id + quality; if (_partsBase.has(k)) return _partsBase.get(k);
  const src = toon(0xffffff, null, { vertexColors: true });
  const S2 = { ...S, uniforms: { ...(S.uniforms || {}), uSwayAmp: { value: swayAmp } } };
  const m = shipMat(src, S2, ROLE.parts, quality, { vertexColors: true }); _partsBase.set(k, m); return m;
}
// one parts mesh (+ an outline on desktop) under `parent` (default body)
export function addParts(ctx, geo, mat, { parent, outline = 0.05 } = {}) {
  if (!geo) return null;
  const m = new THREE.Mesh(geo, mat); m.userData.sharedGeo = true; m.userData.nsPart = true; ctx.add(m, parent);
  if (outline && ctx.quality !== 'low') { const o = outlineFor(m, outline); o.userData.nsPart = true; ctx.add(o, parent); }
  return m;
}

// ---------- additive glow quads (one draw) ----------
// item: [x, y, z, size, color(hex), kind, seed]; kinds: 0 pulse, 1 orbit (radius = hypot(x, z) about the body's y axis at (cx, cz)),
// 2 rise + fade (loops), 3 big soft corona (slow breathe), 4 four-point star (twinkle)
const _glowMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime, uC: { value: new THREE.Vector2() } },
  vertexShader: `attribute vec2 corner; attribute vec4 gl; attribute vec3 gcol; uniform float uT; uniform vec2 uC; varying vec2 vUv; varying vec3 vCol; varying float vA; varying float vK;
    void main(){ vec3 p = position; float kind = gl.y, sd = gl.z, sz = gl.x, a = 1.0;
      if (kind > 0.5 && kind < 1.5) { vec2 d = p.xz - uC; float r = length(d), an = atan(d.y, d.x) + uT * (0.25 + sd * 0.35); p.xz = uC + vec2(cos(an), sin(an)) * r; p.y += sin(uT * 0.8 + sd * 20.0) * 0.4; }
      else if (kind > 1.5 && kind < 2.5) { float l = fract(uT * (0.18 + sd * 0.2) + sd * 7.0); p.y += l * 6.0; p.x += sin(uT + sd * 30.0) * l * 1.2; a = sin(l * 3.14159); sz *= 0.6 + l * 0.6; }
      else if (kind > 2.5 && kind < 3.5) { sz *= 0.9 + 0.12 * sin(uT * 1.6 + sd * 9.0); }
      else { float tw = 0.5 + 0.5 * sin(uT * (1.8 + sd * 2.5) + sd * 40.0); a = 0.45 + 0.55 * tw; sz *= 0.65 + 0.5 * tw; }
      vec4 mv = modelViewMatrix * vec4(p, 1.0); bool ortho = projectionMatrix[3][3] == 1.0;
      float d = max(1.0, -mv.z); float s = sz * (ortho ? 1.0 : clamp(0.75 + d * 0.012, 0.8, 2.2));
      mv.xy += corner * s; vUv = corner; vCol = gcol; vA = a; vK = kind; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec2 vUv; varying vec3 vCol; varying float vA; varying float vK; void main(){ vec2 u = vUv; float r = length(u);
      float soft = exp(-r * r * 5.0), core = exp(-r * r * 40.0), a;
      if (vK > 2.5 && vK < 3.5) a = soft * 0.55 + core * 0.3;
      else if (vK > 3.5) a = max(0.0, 1.0 - abs(u.y) * 22.0) * pow(max(0.0, 1.0 - abs(u.x)), 1.5) + max(0.0, 1.0 - abs(u.x) * 22.0) * pow(max(0.0, 1.0 - abs(u.y)), 1.5) + core * 1.4;
      else a = soft * 0.45 + core * 1.2;
      a *= vA; if (a < 0.015) discard; gl_FragColor = vec4(vCol * a * 1.6, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const _glowGeo = new Map();
export function glows(ctx, key, items, { parent, center = [0, 0] } = {}) {
  if (!_glowGeo.has(key)) {
    const pos = [], cor = [], gl = [], col = [], idx = [], c = new THREE.Color();
    items.forEach(([x, y, z, s, hex, kind = 0, seed = Math.random()], i) => { c.set(hex); const b = i * 4;
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(x, y, z); cor.push(cx, cy); gl.push(s, kind, seed, 0); col.push(c.r, c.g, c.b); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('corner', new THREE.Float32BufferAttribute(cor, 2));
    g.setAttribute('gl', new THREE.Float32BufferAttribute(gl, 4)); g.setAttribute('gcol', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    g.computeBoundingSphere(); g.boundingSphere.radius += 8; _glowGeo.set(key, g);
  }
  const m = _glowMat.clone(); m.uniforms.uT = wind.uTime; m.uniforms.uC.value.set(center[0], center[1]);
  const mesh = new THREE.Mesh(_glowGeo.get(key), m); mesh.renderOrder = 3; mesh.userData.sharedGeo = true; mesh.userData.nsPart = true; mesh.frustumCulled = false;
  ctx.add(mesh, parent); return mesh;
}
export const hash = (i) => ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
// cached per hull size + quality
const _geoCache = new Map();
export function cached(id, ud, quality, fn) { const k = `${id}|${ud.len.toFixed(2)}|${ud.beam.toFixed(2)}|${quality}`; if (!_geoCache.has(k)) _geoCache.set(k, fn()); return _geoCache.get(k); }
// a tapered tube along points with a 0..1 'sway' attribute (root -> tip)
export function tube(points, r0, r1, seg = 16, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), fr = curve.computeFrenetFrames(seg, false), P = [], W = [], idx = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg, c = curve.getPointAt(t), r = r0 + (r1 - r0) * t, N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j <= radial; j++) { const a = j / radial * Math.PI * 2; P.push(c.x + r * (Math.cos(a) * N.x + Math.sin(a) * B.x), c.y + r * (Math.cos(a) * N.y + Math.sin(a) * B.y), c.z + r * (Math.cos(a) * N.z + Math.sin(a) * B.z)); W.push(t); } }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); } // outward-facing
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('sway', new THREE.Float32BufferAttribute(W, 1)); g.setIndex(idx); g.computeVertexNormals();
  return { geo: g, curve };
}
// soften the stern lantern light (bloom washes bright hulls out), like GOLDEN / DIAMOND
export const dimLights = (ship, k = 0.4) => ship.traverse(o => { if (o.isPointLight) o.intensity *= k; });
