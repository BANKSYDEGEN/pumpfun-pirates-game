// [Raul] PUMPFUN PIRATES island "look" pass (BANKSY: legit-game quality, cohesive with the toon ships + pirates).
// - Surface detail: 8 tiling hand-painted-style layers generated once at load into ONE RG8 DataArrayTexture (13 layers) (R = albedo
//   detail, G = height), mipmapped. No downloads, no asset files. High 512 px (~5.6 MB GPU), Low 256 px (~1.4 MB).
//   Layers: 0 sand ripples, 1 grass, 2 wood grain, 3 rock, 4 roof tiles, 5 palm bark, 6 leaf veins, 7 plaster.
// - Per-vertex material id (aMat, set by kit.js from the palette) picks the layer; triplanar in island space.
//   Terrain (aMat 1) splat-blends sand <-> grass by the vertex colour + height, with a darker wet band at the waterline.
// - High: bump-from-height normals (derivative perturbation), a soft 6-step toon ramp, warm rim light.
//   Low: half-res layers, albedo detail only (no bump, no rim, no extra passes).
import * as THREE from 'three';
import { SWAY_DECL, SWAY_BODY } from './kit.js';
import { LIB_ON, LIB_U, LIB_FDECL } from './libTex.js';   // [Timothy] the shared material library (aMat 21..32 + the town's man-made layers)

// ---------- tileable procedural layers ----------
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, P, s) { // periodic value noise, period P cells
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const m = (a) => ((a % P) + P) % P;
  const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), c = hash(m(xi), m(yi + 1), s), d = hash(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, P, s, o = 4) { let t = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { t += a * vnoise(x * f, y * f, P * f, s + i * 17); a *= 0.5; f *= 2; } return t / 0.9375; }
function vor(u, v, P, s) { const x = u * P, y = v * P, ci = Math.floor(x), cj = Math.floor(y); let f1 = 9, f2 = 9, id = 0; // periodic voronoi
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = ci + di, j = cj + dj, mi = ((i % P) + P) % P, mj = ((j % P) + P) % P, px = i + 0.15 + 0.7 * hash(mi, mj, s), py = j + 0.15 + 0.7 * hash(mj, mi, s + 1), d = Math.hypot(x - px, y - py);
    if (d < f1) { f2 = f1; f1 = d; id = hash(mi, mj, s + 2); } else if (d < f2) f2 = d; }
  return { f1, f2, id }; }
const sat = (v) => Math.max(0, Math.min(1, v)), smooth = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const LAYERS = [
  (u, v) => { const w = fbm(u * 4, v * 4, 4, 1); const r = 0.5 + 0.5 * Math.sin((v * 9 + w * 2.2) * Math.PI * 2); const g = hash((u * 997) | 0, (v * 991) | 0, 3);
    return [0.55 + 0.25 * r + 0.18 * (g > 0.93 ? 1 : 0) - 0.1 * fbm(u * 8, v * 8, 8, 2), 0.25 + 0.6 * r * r]; },                                  // sand ripples + grains
  (u, v) => { const c = fbm(u * 6, v * 6, 6, 4), b = vnoise(u * 64, v * 10, 64, 5), s = vnoise(u * 90, v * 14, 90, 6);
    return [0.35 + 0.45 * c + 0.25 * (b - 0.5) + 0.2 * (s > 0.7 ? 1 : 0), 0.3 + 0.5 * b * c]; },                                                  // grass clumps + blades
  (u, v) => { const w = fbm(u * 2, v * 8, 2, 7, 3); const gr = 0.5 + 0.5 * Math.sin((v * 22 + w * 3.0) * Math.PI * 2); const k = smooth(0.08, 0.0, Math.hypot(((u * 3) % 1) - 0.5, (((v * 2) + 0.3) % 1) - 0.5) - 0.05);
    return [0.5 + 0.3 * gr - 0.35 * k + 0.12 * (vnoise(u * 128, v * 4, 128, 8) - 0.5), 0.45 + 0.35 * gr - 0.4 * k]; },                          // wood grain + knots
  (u, v) => { const f = fbm(u * 5, v * 5, 5, 9, 5); const cr = smooth(0.04, 0.0, Math.abs(fbm(u * 3, v * 3, 3, 10) - 0.5));
    return [0.35 + 0.55 * f - 0.4 * cr, 0.2 + 0.7 * f - 0.5 * cr]; },                                                                              // rock + cracks
  (u, v) => { const rows = 8, y = v * rows, row = Math.floor(y), x = u * rows * 0.75 + (row % 2) * 0.5, fx = x - Math.floor(x), fy = y - row;
    const sh = Math.sqrt(sat(1 - Math.pow(Math.abs(fx - 0.5) * 2, 2))) * smooth(0, 0.25, fy) * (1 - fy * 0.4);
    return [0.4 + 0.5 * sh + 0.1 * vnoise(u * 32, v * 32, 32, 11), 0.15 + 0.8 * sh]; },                                                            // scalloped roof tiles
  (u, v) => { const ring = Math.pow(0.5 + 0.5 * Math.sin(v * 12 * Math.PI * 2 + fbm(u * 4, v * 4, 4, 12) * 1.5), 3); const fib = vnoise(u * 48, v * 6, 48, 13);
    return [0.45 + 0.25 * fib - 0.3 * ring, 0.5 + 0.3 * fib - 0.45 * ring]; },                                                                     // palm bark rings
  (u, v) => { const vein = smooth(0.06, 0.0, Math.abs(((u * 6 + v * 3) % 1) - 0.5) - 0.42); const c = fbm(u * 4, v * 4, 4, 14);
    return [0.55 + 0.3 * c + 0.25 * vein, 0.4 + 0.3 * vein + 0.2 * c]; },                                                                          // leaf veins
  (u, v) => { const f = fbm(u * 3, v * 3, 3, 15, 5); const cr = smooth(0.025, 0.0, Math.abs(fbm(u * 2, v * 2, 2, 16) - 0.5));
    return [0.62 + 0.3 * f - 0.3 * cr, 0.5 + 0.3 * f - 0.4 * cr]; },                                                                              // plaster
  // [foot] on-foot island layers
  (u, v) => { const f = fbm(u * 4, v * 4, 4, 21); const c = vor(u, v, 10, 22), peb = smooth(0.32, 0.18, c.f1) * (c.id > 0.55 ? 1 : 0);
    return [0.45 + 0.35 * f + 0.3 * peb, 0.3 + 0.3 * f + 0.45 * peb]; },                                                                          // 8 dirt trail + pebbles
  (u, v) => { const y = v * 5 + 0.45 * (fbm(u * 3, v * 3, 3, 23) - 0.5), row = Math.floor(y), fy = y - row, nb = 2 + (((row % 5) + 5) % 5 === 2 ? 1 : 2) % 3,
      x = u * nb + hash(((row % 5) + 5) % 5, 0, 30) * 7 + 0.25 * (fbm(u * 2, v * 6, 2, 31) - 0.5), bi = ((Math.floor(x) % nb) + nb) % nb, fx = x - Math.floor(x), tone = hash(bi, ((row % 5) + 5) % 5, 32);
    const e = Math.min(fx * 2.2 / nb * 5, (1 - fx) * 2.2 / nb * 5, fy, 1 - fy), crack = smooth(0.06, 0.0, e), bev = smooth(0.0, 0.22, e), grain = fbm(u * 16, v * 16, 16, 24);
    const vfr = smooth(0.02, 0.0, Math.abs(fbm(u * 4, v * 1, 4, 33) - 0.5)) * 0.8, top = smooth(0.78, 0.97, fy), under = smooth(0.2, 0.0, fy);
    return [0.48 + 0.22 * tone + 0.16 * (grain - 0.5) - 0.38 * Math.max(crack, vfr) + 0.14 * top - 0.2 * under, 0.25 + 0.55 * bev + 0.15 * grain - 0.4 * Math.max(crack, vfr) + 0.1 * top]; }, // 9 fractured cliff rock: broken strata blocks, cracks, lit ledges
  (u, v) => { const c = vor(u, v, 6, 25), e = smooth(0.02, 0.12, c.f2 - c.f1), dome = sat(1 - c.f1 * 1.3);
    return [0.25 + 0.6 * e * (0.7 + 0.3 * c.id) , e * (0.4 + 0.6 * dome)]; },                                                                     // 10 cobbles
  (u, v) => { const rows = 6, y = v * rows, row = Math.floor(y), x = u * 3 + (row % 2) * 0.5, fx = x - Math.floor(x), fy = y - row, e = Math.min(fx, 1 - fx, fy * 0.5, (1 - fy) * 0.5), m = smooth(0.015, 0.05, e);
    const t = hash(Math.floor(x) % 3, row % rows, 26); return [(0.5 + 0.3 * t + 0.15 * fbm(u * 6, v * 6, 6, 27)) * (0.45 + 0.55 * m), m * (0.6 + 0.3 * fbm(u * 8, v * 8, 8, 28))]; }, // 11 dressed stone blocks
  (u, v) => { const wv = ((Math.floor(u * 64) + Math.floor(v * 64)) % 2) * 0.12, tw = 0.5 + 0.5 * Math.sin((u + v * 0.6) * 24 * Math.PI * 2);
    return [0.6 + wv + 0.15 * tw + 0.1 * fbm(u * 4, v * 4, 4, 29), 0.4 + 0.4 * tw]; },                                                           // 12 rope / cloth weave
];
// Only natural layers remain local; built surfaces use the plaza/hill atlas.
const DETAIL_LAYERS = LIB_ON ? [0, 1, 3, 5, 6, 8, 9] : LAYERS.map((_, i) => i);
const DETAIL_INDEX = LIB_ON ? [0, 1, 3, 2, 2, 3, 4, 2, 5, 6, 2, 2, 3] : LAYERS.map((_, i) => i);
const _tex = {};
export function detailTexture(low) {
  const S = low ? 256 : 512; if (_tex[S]) return _tex[S];
  const N = DETAIL_LAYERS.length, data = new Uint8Array(S * S * N * 2);
  for (let l = 0; l < N; l++) { const f = LAYERS[DETAIL_LAYERS[l]], off = l * S * S * 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const [a, h] = f(x / S, y / S), i = off + (y * S + x) * 2; data[i] = 255 * sat(a); data[i + 1] = 255 * sat(h); } }
  const t = new THREE.DataArrayTexture(data, S, S, N);
  t.format = THREE.RGFormat; t.type = THREE.UnsignedByteType; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = low ? 1 : 4; t.needsUpdate = true;
  t.userData.bytes = Math.round(S * S * N * 2 * 4 / 3);
  return (_tex[S] = t);
}
// soft 6-step toon ramp (linear between steps) for the island only
let _ramp = null;
export function softRamp() {
  if (_ramp) return _ramp;
  const v = [78, 112, 150, 196, 232, 255], d = new Uint8Array(v.length * 4); v.forEach((x, i) => d.set([x, x, x, 255], i * 4));
  _ramp = new THREE.DataTexture(d, v.length, 1, THREE.RGBAFormat); _ramp.minFilter = _ramp.magFilter = THREE.LinearFilter; _ramp.generateMipmaps = false; _ramp.needsUpdate = true;
  return _ramp;
}

// metres per texture tile, bump strength, per layer
const SCALE = [7, 5, 2.4, 4, 3.2, 1.6, 2.2, 3.5, 4, 9, 2.6, 3.2, 1.2], BUMP = [0.9, 0.7, 0.8, 1.4, 1.2, 1.0, 0.5, 0.6, 1.2, 1.6, 1.6, 1.4, 0.6];
export const NL = SCALE.length; // layer count (13); aMat 13 = on-foot terrain splat (aW0 / aW1 weights)
const VERT_DECL = '\nattribute float aMat; varying float vMat; varying vec3 vOP; varying vec3 vON; attribute vec4 aW0; attribute vec4 aW1; varying vec4 vW0; varying vec4 vW1;\n';
const VERT_BODY = 'vMat = aMat; vOP = position; vON = normal; vW0 = aW0; vW1 = aW1;\n';
function fragDecl(low) {
  return `
uniform sampler2DArray uDetail; uniform float uScale[13]; uniform float uBump[13];
const int DETAIL_INDEX[13] = int[13](${DETAIL_INDEX.join(', ')});
const int LIB_PL[12] = int[12](11, 11, 11, 7, 10, 2, 2, 2, 4, 3, 12, 12); // library layer -> procedural fallback (&plazatex=0 / not loaded)
${LIB_FDECL}
varying float vMat; varying vec3 vOP; varying vec3 vON; varying vec4 vW0; varying vec4 vW1;
vec2 isTri(int L, vec3 p, vec3 w) { float s = 1.0 / uScale[L]; float l = float(DETAIL_INDEX[L]);
  return texture(uDetail, vec3(p.zy * s, l)).rg * w.x + texture(uDetail, vec3(p.xz * s, l)).rg * w.y + texture(uDetail, vec3(p.xy * s, l)).rg * w.z; }
`;
}
// [nature kit] cut-out cards (aMat 14): the Blender card sheet (palm fronds, leaf clusters, fern, vine) through aCardUv
const CARD_VDECL = '\nattribute vec2 aCardUv; varying vec2 vCUv;\n', CARD_FDECL = '\nuniform sampler2D uCards; varying vec2 vCUv;\n';
function fragColor(low, cards = false) {
  return `
float isH = 0.0; int isM = int(vMat + 0.5);
if (isM > 0) {
  vec3 tw = pow(abs(normalize(vON)), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);
  vec2 d;
  if (isM == 1) { // terrain: sand <-> grass splat by vertex colour, height-aware edge, wet band at the waterline
    float g = clamp((vColor.g - max(vColor.r, vColor.b)) * 5.0, 0.0, 1.0);
    vec2 ds = isTri(0, vOP, tw), dg = isTri(1, vOP, tw);
    float w = smoothstep(0.3, 0.7, g + (dg.y - ds.y) * 0.45);
    d = mix(ds, dg, w);
    float wet = (1.0 - w) * smoothstep(1.25, 0.15, vOP.y);
    diffuseColor.rgb *= mix(1.0, 0.68, wet); d.x = mix(d.x, 0.55, wet * 0.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 1.0, 0.86), w * (1.0 - d.x) * 0.6);
  } else if (isM == 13) { // [foot] 8-way splat: sand, wet, grass, dirt | rock, cliff, cobble, jungle floor (colour comes from the vertex)
    float w[8]; w[0] = vW0.x; w[1] = vW0.y; w[2] = vW0.z; w[3] = vW0.w; w[4] = vW1.x; w[5] = vW1.y; w[6] = vW1.z; w[7] = vW1.w;
    vec2 L[8]; L[0] = isTri(0, vOP, tw); L[1] = L[0] * vec2(0.85, 0.6); L[2] = isTri(1, vOP, tw); L[3] = isTri(8, vOP, tw);
    L[4] = isTri(3, vOP, tw); L[5] = isTri(9, vOP, tw); L[6] = isTri(10, vOP, tw); if (uLibOn > 0.5) { vec4 cb = libTri(4, vOP, vON, 0.0); L[6] = vec2(dot(cb.rgb, vec3(0.3, 0.6, 0.1)), cb.a); } L[7] = isTri(6, vOP * 0.7, tw);
    float mx = 0.0; for (int i = 0; i < 8; i++) { w[i] = w[i] > 0.02 ? w[i] + L[i].y * 0.5 : 0.0; mx = max(mx, w[i]); }
    vec2 acc = vec2(0.0); float ws = 0.0; for (int i = 0; i < 8; i++) { float k = max(w[i] - (mx - 0.25), 0.0); acc += L[i] * k; ws += k; }
    d = acc / max(ws, 1e-4);
  }${cards ? ` else if (isM == 14) { vec4 cc = texture2D(uCards, vCUv); if (cc.a < 0.5) discard; diffuseColor.rgb *= cc.rgb * 1.35; d = vec2(0.5, dot(cc.rgb, vec3(0.3, 0.6, 0.1)) * 1.4); }` : ''}
  else if (isM >= 21 || (uLibOn > 0.5 && (isM == 2 || isM == 4 || isM == 7 || isM == 10 || isM == 11 || isM == 12))) { // [Timothy] material library layer (libTex.js)
    int li = isM >= 21 ? min(isM - 21, 11) : (isM == 2 ? 6 : isM == 4 ? 8 : isM == 7 ? 3 : isM == 10 ? 4 : isM == 12 ? 10 : 0);
    if (uLibOn > 0.5) { vec4 lt = libTri(li, vOP, vON, 0.0); diffuseColor.rgb *= lt.rgb * 2.0; d = vec2(0.5, lt.a); } else d = isTri(LIB_PL[li], vOP, tw);
  }
  else d = isTri(min(isM, 12), vOP, tw);
  diffuseColor.rgb *= 0.7 + 0.6 * d.x; isH = d.y;
}
`;
}
const FRAG_BUMP = `
if (isM > 0) { // bump from the height layer (screen-space derivatives), no tangents needed
  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
  float hx = dFdx(isH), hy = dFdy(isH); vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
  vec3 grad = sign(det) * (hx * r1 + hy * r2) * uBump[isM == 1 || isM == 13 ? 0 : min(isM, 12)] * (isM == 14 ? 0.5 : 1.0);
  normal = normalize(abs(det) * normal - grad);
}
`;
const FRAG_RIM = `
{ float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0); outgoingLight += vec3(1.0, 0.86, 0.66) * rim * 0.22 * diffuseColor.rgb; }
`;
// patch a MeshToonMaterial with the island surface (and optional palm sway)
export function islandSurface(mat, { low, uTime = null, sway = false, cards = null }) {
  const tex = detailTexture(low);
  mat.gradientMap = softRamp();
  mat.onBeforeCompile = (s) => {
    s.uniforms.uDetail = { value: tex }; s.uniforms.uScale = { value: SCALE }; s.uniforms.uBump = { value: BUMP }; Object.assign(s.uniforms, LIB_U); if (cards) s.uniforms.uCards = { value: cards };
    if (sway) s.uniforms.uTime = uTime;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>' + VERT_DECL + (cards ? CARD_VDECL : '') + (sway ? SWAY_DECL : ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY + (cards ? 'vCUv = aCardUv;\n' : '') + (sway ? SWAY_BODY : ''));
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>' + fragDecl(low) + (cards ? CARD_FDECL : ''))
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + fragColor(low, !!cards))
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + (low ? '' : FRAG_BUMP))
      .replace('#include <opaque_fragment>', (low ? '' : FRAG_RIM) + '#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => `isl_surf_${low ? 'l' : 'h'}${sway ? '_s' : ''}${cards ? '_c' : ''}`;
  return mat;
}
// instanced grass with wind sway (tip-weighted, per-instance phase)
export function grassMaterial(mat, uTime) {
  mat.gradientMap = softRamp();
  mat.onBeforeCompile = (s) => { s.uniforms.uTime = uTime;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]); float w = clamp(position.y / 1.4, 0.0, 1.0); w *= w;
          float g = sin(uTime * 1.7 + ip.x * 0.13 + ip.z * 0.09) * 0.6 + sin(uTime * 3.3 + ip.x * 0.4) * 0.25;
          transformed.x += g * 0.22 * w; transformed.z += cos(uTime * 1.3 + ip.z * 0.11) * 0.12 * w; }`); };
  mat.customProgramCacheKey = () => 'isl_grass';
  return mat;
}

// ---------- small life + fire (custom shaders, fogged, one draw call each) ----------
const FOG_U = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
function instGeo(base, n, attrs) { // base BufferGeometry (non-indexed) -> InstancedBufferGeometry with per-instance attrs
  const g = new THREE.InstancedBufferGeometry(); for (const k of Object.keys(base.attributes)) g.setAttribute(k, base.attributes[k]);
  for (const [k, size, fn] of attrs) { const a = new Float32Array(n * size); for (let i = 0; i < n; i++) { const v = fn(i); if (size === 1) a[i] = v; else a.set(v, i * size); } g.setAttribute(k, new THREE.InstancedBufferAttribute(a, size)); }
  g.instanceCount = n; return g;
}
function merged(parts) { // [[geo, hex, extra(number)]...] -> non-indexed geometry with color + aK
  const pos = [], col = [], nrm = [], kk = [], c = new THREE.Color();
  for (const [g0, hex, k] of parts) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); const P = g.attributes.position, N = g.attributes.normal; c.set(hex);
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nrm.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); kk.push(typeof k === 'function' ? k(P.getX(i), P.getY(i), P.getZ(i)) : k || 0); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute(kk, 1)); return g;
}
const LIT_FRAG = `varying vec3 vC; varying vec3 vN;
  #include <common>
  #include <fog_pars_fragment>
  void main(){ float l = 0.62 + 0.38 * clamp(dot(normalize(vN), normalize(vec3(-0.4, 0.8, 0.45))), 0.0, 1.0); gl_FragColor = vec4(vC * l, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
// seagulls circling the island (local frame), flapping in the vertex shader
export function buildBirds(low, uTime) {
  const n = low ? 4 : 9;
  const base = merged([[new THREE.BoxGeometry(0.28, 0.22, 1.0), 0xf4f6f8, 0], [new THREE.ConeGeometry(0.07, 0.3, 4).rotateX(Math.PI / 2).translate(0, 0, 0.62), 0xffb020, 0],
    [new THREE.BoxGeometry(1.7, 0.05, 0.5).translate(0.95, 0.05, 0), 0xe8ecf0, (x) => Math.min(1, Math.abs(x) / 1.8)], [new THREE.BoxGeometry(1.7, 0.05, 0.5).translate(-0.95, 0.05, 0), 0xe8ecf0, (x) => Math.min(1, Math.abs(x) / 1.8)],
    [new THREE.BoxGeometry(0.6, 0.06, 0.45).translate(1.95, 0.06, -0.02), 0x3a3f46, 1], [new THREE.BoxGeometry(0.6, 0.06, 0.45).translate(-1.95, 0.06, -0.02), 0x3a3f46, 1]]);
  const r = (i, k) => hash(i, k, 91);
  const g = instGeo(base, n, [['aPh', 1, (i) => r(i, 1) * 6.28], ['aR', 1, (i) => 30 + r(i, 2) * 80], ['aH', 1, (i) => 20 + r(i, 3) * 22], ['aSp', 1, (i) => (0.07 + r(i, 4) * 0.08) * (i % 3 ? 1 : -1)]]);
  const mat = new THREE.ShaderMaterial({ fog: true, uniforms: { ...FOG_U(), uTime },
    vertexShader: `uniform float uTime; attribute float aPh, aR, aH, aSp, aK; attribute vec3 color; varying vec3 vC; varying vec3 vN;
      #include <common>
      #include <fog_pars_vertex>
      void main(){ vC = color; vec3 p = position; float fl = sin(uTime * 6.5 + aPh * 3.0) * (0.5 + 0.5 * sin(uTime * 0.4 + aPh)); p.y += fl * 0.75 * aK * aK; p.y -= abs(p.x) * 0.08;
        float an = aPh + uTime * aSp, R = aR + sin(uTime * 0.21 + aPh) * 10.0; vec3 c = vec3(cos(an) * R, aH + sin(uTime * 0.5 + aPh * 3.0) * 3.0, sin(an) * R);
        vec3 f = normalize(vec3(-sin(an), 0.0, cos(an)) * sign(aSp)), rt = normalize(cross(vec3(0.0, 1.0, 0.0), f)) * -1.0; float bank = 0.35 * sign(aSp);
        vec3 up = normalize(vec3(0.0, 1.0, 0.0) + rt * bank);
        vec3 wp = c + rt * p.x + up * p.y + f * p.z; vN = rt * normal.x + up * normal.y + f * normal.z;
        vec4 mvPosition = modelViewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`, fragmentShader: LIT_FRAG });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.name = 'island_birds'; return m;
}
// crabs scuttling sideways on the beach (High only)
export function buildCrabs(spots, uTime) {
  const parts = [[new THREE.SphereGeometry(0.42, 8, 5).scale(1.25, 0.5, 1), 0xff5a2a, 0], [new THREE.SphereGeometry(0.17, 6, 4).translate(0.55, 0.05, 0.38), 0xff6b38, 0], [new THREE.SphereGeometry(0.17, 6, 4).translate(-0.55, 0.05, 0.38), 0xff6b38, 0],
    [new THREE.SphereGeometry(0.06, 4, 3).translate(0.13, 0.26, 0.3), 0x111111, 0], [new THREE.SphereGeometry(0.06, 4, 3).translate(-0.13, 0.26, 0.3), 0x111111, 0]];
  for (let k = 0; k < 3; k++) for (const sx of [-1, 1]) parts.push([new THREE.BoxGeometry(0.42, 0.06, 0.06).translate(sx * 0.62, -0.1, -0.2 + k * 0.2).rotateZ(sx * -0.4), 0xd9441f, 1 + k]);
  const base = merged(parts), n = spots.length;
  const g = instGeo(base, n, [['aP', 3, (i) => [spots[i].x, spots[i].y, spots[i].z]], ['aA', 1, (i) => spots[i].a], ['aPh', 1, (i) => hash(i, 7, 13) * 6.28]]);
  const mat = new THREE.ShaderMaterial({ fog: true, uniforms: { ...FOG_U(), uTime },
    vertexShader: `uniform float uTime; attribute vec3 aP; attribute float aA, aPh, aK; attribute vec3 color; varying vec3 vC; varying vec3 vN;
      #include <common>
      #include <fog_pars_vertex>
      void main(){ vC = color; vec3 p = position; float t = uTime * 0.6 + aPh; float go = sin(t) * 0.5 + 0.5; go = smoothstep(0.15, 0.85, go);
        float s = (go - 0.5) * 4.0 + sin(t * 0.37) * 1.5; float moving = abs(cos(t)) > 0.3 ? 1.0 : 0.0;
        if (aK > 0.5) p.y += abs(sin(uTime * 22.0 + aK * 2.1)) * 0.07 * moving;
        vec3 f = vec3(sin(aA), 0.0, cos(aA)), rt = vec3(f.z, 0.0, -f.x);
        vec3 wp = aP + rt * s + rt * p.x + vec3(0.0, p.y + 0.12, 0.0) + f * p.z; vN = rt * normal.x + vec3(0.0, normal.y, 0.0) + f * normal.z;
        vec4 mvPosition = modelViewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`, fragmentShader: LIT_FRAG });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.name = 'island_crabs'; return m;
}
// torch flames (High): additive flickering teardrops, HDR so the bloom pass catches them
export function buildFlames(torches, uTime) {
  const base = new THREE.ConeGeometry(0.26, 1.0, 7, 3, true).translate(0, 0.5, 0).toNonIndexed();
  const g = instGeo(base, torches.length, [['aP', 3, (i) => [torches[i].x, torches[i].y + 0.1, torches[i].z]], ['aPh', 1, (i) => i * 1.7]]);
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime },
    vertexShader: `uniform float uTime; attribute vec3 aP; attribute float aPh; varying float vY;
      void main(){ vec3 p = position; vY = p.y; float f = 0.85 + 0.2 * sin(uTime * 13.0 + aPh) + 0.1 * sin(uTime * 23.0 + aPh * 2.0);
        p.xz *= (1.0 - p.y * 0.85) * (1.1 + 0.15 * sin(uTime * 9.0 + aPh)); p.y *= f; p.x += sin(uTime * 7.0 + aPh + p.y * 4.0) * 0.08 * p.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(aP + p, 1.0); }`,
    fragmentShader: `varying float vY; void main(){ vec3 c = mix(vec3(3.0, 2.2, 0.8), vec3(2.2, 0.6, 0.1), vY); gl_FragColor = vec4(c * (1.0 - vY * 0.7), 1.0 - vY); }` });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 4; m.name = 'island_flames'; return m;
}
// fishing nets draped over the pier rails (High): one alpha-tested mesh, canvas net texture
export function buildNets(spots) {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
  x.clearRect(0, 0, S, S); x.strokeStyle = '#fff'; x.lineWidth = 5; for (let i = -S; i < 2 * S; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + S, S); x.stroke(); x.beginPath(); x.moveTo(i, S); x.lineTo(i + S, 0); x.stroke(); }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  const geos = spots.map(({ m }) => { const g = new THREE.PlaneGeometry(3.2, 2.2, 8, 6); const P = g.attributes.position, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) { const px = P.getX(i), py = P.getY(i); P.setZ(i, Math.sin((py + 1.1) / 2.2 * Math.PI) * 0.35 + Math.sin(px * 2.0) * 0.08); P.setY(i, py - Math.pow(Math.cos(px / 3.2 * Math.PI), 2) * 0.25 * (1.1 - py) / 2.2); U.setXY(i, U.getX(i) * 4, U.getY(i) * 3); }
    g.applyMatrix4(m); return g.toNonIndexed(); });
  const pos = [], uv = []; for (const g of geos) { pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const mat = new THREE.MeshToonMaterial({ color: 0xcdb48a, alphaMap: tex, alphaTest: 0.45, side: THREE.DoubleSide, gradientMap: softRamp() });
  const m = new THREE.Mesh(g, mat); m.name = 'island_nets'; return m;
}
