// [Timothy] PUMPFUN PIRATES shared MATERIAL LIBRARY (runtime). BANKSY: "make the textures super nice like the ships", "make the shops up the
// hill match quality and the cannon hill", "keep it consistent", "improve / enhance the textures of plaza and hill and the castle".
// ONE 12-layer texture array for every built thing on the island, so the plaza, docks, battery, hill street and the hilltop fort share the
// same stone, brick, plaster, cobbles, timber, planks, roof tiles, iron, rope and canvas (tools/plaza_blender/materials.py = the source list):
//   assets/island/tex/lib.ktx2 (desktop, 1024 px) / lib_lo.ktx2 (phones, 512 px): Basis ETC1S 2D array + mips, transcoded to BC7 / ETC2 /
//   ASTC (~1 byte per texel: ~17 MB GPU desktop, ~4 MB phones). RGB = albedo detail graded around a neutral mean (x2 here, so the vertex
//   colour keeps the palette brightness and carries the hue), A = height (desktop bump only). No UVs, no extra draw calls, no new materials:
//   the layer is projected from the object-space position (dominant normal axis, sharp triplanar blend) inside the existing toon materials.
//   - Blender GLBs (plaza shops, docks, battery, hill street): TEXCOORD_0.u = (id * 2 + swap + 0.5) / 32 per corner (libMaterial below)
//   - island kit pieces (js/island/look.js): aMat 21..32 = library id 1..12; the kit's man-made layers (roof tiles 4, plaster 7, cobbles 10,
//     dressed stone 11) are drawn with the library too, so the whole town matches
// &plazatex=0 = the pre-library look (vertex colour / procedural layers only).
import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

export const LIB = ['stone_ashlar', 'stone_trim', 'brick', 'plaster', 'cobble', 'timber', 'planks_weathered', 'piling_wet', 'roof_tile', 'iron', 'rope', 'awning_cloth'];
export const LIB_ID = Object.fromEntries(LIB.map((n, i) => [n, i + 1]));
const TILE = [2.6, 1.6, 1.3, 2.4, 2.0, 1.6, 1.8, 1.4, 1.6, 0.9, 0.4, 0.8];          // metres per repeat (materials.py)
const BUMP = [1.2, 0.8, 1.3, 0.5, 1.5, 0.9, 1.0, 0.9, 1.3, 0.6, 1.0, 0.5];          // desktop bump strength
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
export const LIB_ON = !(Q && Q.get('plazatex') === '0');
const ph = new THREE.DataArrayTexture(new Uint8Array(4 * 12).fill(128), 1, 1, 12); ph.needsUpdate = true;   // neutral until the KTX2 arrives
export const LIB_U = { uLib: { value: ph }, uLibOn: { value: 0 }, uLibTile: { value: TILE }, uLibBump: { value: BUMP } };
export const LIB_STATS = { file: null, bytes: 0, gpuBytes: 0, ms: 0, format: null };
let _p = null;
export function initLib(low, renderer) {
  if (_p) return _p;
  if (!LIB_ON) return (_p = Promise.resolve(null));
  if (!renderer) return Promise.resolve(null);   // (no cache: a later call with the renderer still loads it)
  const t0 = performance.now(), file = `assets/island/tex/lib${low ? '_lo' : ''}.ktx2`;
  let ktx; try { ktx = new KTX2Loader().setTranscoderPath(new URL('../../vendor/three-0.165.0/examples/jsm/libs/basis/', import.meta.url).href).detectSupport(renderer); }
  catch (e) { console.warn('[lib] no KTX2 support, vertex colour only', e); return (_p = Promise.resolve(null)); }
  _p = ktx.loadAsync(new URL('../../' + file, import.meta.url).href).then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = low ? 2 : 8; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
    LIB_U.uLib.value = t; LIB_U.uLibOn.value = 1;
    Object.assign(LIB_STATS, { file, ms: Math.round(performance.now() - t0), format: t.format, gpuBytes: (t.mipmaps || []).reduce((s, m) => s + (m.data ? m.data.byteLength : 0), 0) });
    return t; }).catch(e => { console.warn('[lib] material library failed, vertex colour only', e); return null; });
  return _p;
}
// ---------- GLSL ----------
// libTri(L, p, n, swap): the layer L (0-based) projected on object position p with normal n; swap turns the grain 90 deg
export const LIB_FDECL = `
uniform highp sampler2DArray uLib; uniform float uLibOn; uniform float uLibTile[12]; uniform float uLibBump[12];
vec4 libTri(int L, vec3 p, vec3 n, float swap) {
  vec3 w = pow(abs(n), vec3(8.0)); w /= (w.x + w.y + w.z + 1e-5); float s = 1.0 / uLibTile[L], l = float(L);
  vec2 cx = p.zy * s, cy = p.xz * s, cz = p.xy * s; if (swap > 0.5) { cx = cx.yx; cy = cy.yx; cz = cz.yx; }
  vec2 dxx = dFdx(cx), dyx = dFdy(cx), dxy = dFdx(cy), dyy = dFdy(cy), dxz = dFdx(cz), dyz = dFdy(cz);
  vec4 a = vec4(0.0);
  if (w.x > 0.01) a += textureGrad(uLib, vec3(cx, l), dxx, dyx) * w.x;
  if (w.y > 0.01) a += textureGrad(uLib, vec3(cy, l), dxy, dyy) * w.y;
  if (w.z > 0.01) a += textureGrad(uLib, vec3(cz, l), dxz, dyz) * w.z;
  return a;
}
`;
// apply: id (1-based float), p / n object space; sets libH (height) + libL (layer) for the bump
export const libApply = (id, p, n, swap) => `
float libH = -1.0; int libL = 0;
if (uLibOn > 0.5 && ${id} > 0.5) { libL = int(${id} + 0.5) - 1; vec4 lt = libTri(libL, ${p}, normalize(${n}), ${swap}); diffuseColor.rgb *= lt.rgb * 2.0; libH = lt.a; }
`;
export const LIB_BUMP = `
if (libH >= 0.0) { vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float hx = dFdx(libH), hy = dFdy(libH);
  vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1); vec3 grad = sign(det) * (hx * r1 + hy * r2) * uLibBump[libL];
  normal = normalize(abs(det) * normal - grad); }
`;
// patch a vertex-colour MeshToonMaterial of a Blender GLB (TEXCOORD_0.u = library code) with the library (same material, same draw calls)
export function libMaterial(mat, low) {
  if (!LIB_ON) return mat;
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => { if (base) base(s, r); Object.assign(s.uniforms, LIB_U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLibP; varying vec3 vLibN; varying vec2 vLibC;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLibP = position; vLibN = normal; { float c = floor(uv.x * 32.0); vLibC = vec2(floor(c * 0.5), mod(c, 2.0)); }');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLibP; varying vec3 vLibN; varying vec2 vLibC;' + LIB_FDECL)
      .replace('#include <color_fragment>', '#include <color_fragment>' + libApply('vLibC.x', 'vLibP', 'vLibN', 'vLibC.y'))
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + (low ? '' : LIB_BUMP)); };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.customProgramCacheKey = () => key() + '_lib' + (low ? 'l' : 'h');
  return mat;
}
// ---------- island kit pieces (Post's area modules): re-tag a built group's aMat per triangle by its palette colour ----------
// rules: [[hex, libName | null]] matched on chromaticity only (kit AO darkens the vertex colours); top-facing triangles of a 'floor' rule
// colour inside floorY get the floor layer. One id per triangle (the kit is non-indexed), so a face never blends two layers.
const _c = new THREE.Color();
function libRetag(group, rules, { tol = 0.03, floor = null, wear = false } = {}) {
  const R = rules.map(([h, n]) => { _c.setHex(h); const s = _c.r + _c.g + _c.b; return [_c.r / s, _c.g / s, _c.b / s, n ? 20 + LIB_ID[n] : -1]; }); let n = 0;
  group.traverse(o => { const g = o.isMesh && o.geometry, A = g && g.attributes.aMat, C = g && g.attributes.color, P = g && g.attributes.position, N = g && g.attributes.normal;
    if (!A || !C || g.index || o.userData.outline) return;
    for (let t = 0; t + 2 < A.count; t += 3) { let r = 0, gg = 0, b = 0; for (let k = 0; k < 3; k++) { r += C.getX(t + k); gg += C.getY(t + k); b += C.getZ(t + k); }
      const s = r + gg + b + 1e-5; let best = 9, id = -1;
      for (const q of R) { const d = Math.abs(r / s - q[0]) + Math.abs(gg / s - q[1]) + Math.abs(b / s - q[2]); if (d < best) { best = d; id = q[3]; } }
      if (id <= 0 || best > tol) continue;
      if (floor && N && N.getY(t) > 0.9 && P.getY(t) > (floor.y0 ?? -1e9) && P.getY(t) < (floor.y1 ?? 1e9) && id === 20 + LIB_ID[floor.from]) id = 20 + LIB_ID[floor.to];
      A.setX(t, id); A.setX(t + 1, id); A.setX(t + 2, id); n++;
      if (wear && N && Math.abs(N.getY(t)) < 0.5 && (id === 20 + LIB_ID.stone_ashlar || id === 20 + LIB_ID.stone_trim)) {   // worn top arris (lighter) + grime at the foot of every stone side
        const top = Math.max(P.getY(t), P.getY(t + 1), P.getY(t + 2)); for (let q = 0; q < 3; q++) { const f = P.getY(t + q) > top - 0.01 ? 1.1 : 0.84; C.setXYZ(t + q, Math.min(1, C.getX(t + q) * f), Math.min(1, C.getY(t + q) * f), Math.min(1, C.getZ(t + q) * f)); } } }
    if (wear) C.needsUpdate = true;
    A.needsUpdate = true; });
  return n;
}
// js/island/areas/index.js calls this once per area build: the HILLTOP FORT (the "castle", fort.js) gets the library stone / timber / roof /
// iron; the courtyard floor + flagstones (top faces at the yard level) the cobbles
const FORT_RULES = [[0xb9b2a6, 'stone_ashlar'], [0x8a837a, 'stone_ashlar'], [0xcfc8bb, 'stone_ashlar'], [0xb3a58c, 'stone_ashlar'], [0xa89c86, 'stone_ashlar'], [0xc4b9a4, 'stone_ashlar'],
  [0xa86a3a, 'timber'], [0x6b4527, 'timber'], [0xd9a36b, 'timber'], [0x2b2f36, 'iron'], [0x9a3a2a, 'roof_tile'], [0xe8d6a8, null], [0xd8322f, null], [0xffc93c, null], [0x1a1a1a, null], [0x2b5d6a, null], [0xffd27a, null]];
// Post's PIRATES' CLIMB (areas/route.js: Main Street kerbs / bands, the trail steps + cheek walls, retaining walls, edging, lamps, landmarks):
// stone sides -> ashlar with a worn arris, every top face (treads, kerbs, copings) -> dressed sandstone, timber, iron, rope
const ROUTE_RULES = [[0xb9b2a6, 'stone_ashlar'], [0xbdb6a8, 'stone_ashlar'], [0xa9a294, 'stone_ashlar'], [0x8a837a, 'stone_ashlar'], [0x9e978a, 'stone_ashlar'], [0xd8d0bf, 'stone_ashlar'],
  [0xcfc8bb, 'stone_ashlar'], [0xa39c8e, 'stone_ashlar'], [0xa86a3a, 'timber'], [0x6b4527, 'timber'], [0xd9a36b, 'timber'], [0x2b2f36, 'iron'], [0x3b2a1a, 'iron'], [0xc9a36b, 'rope'],
  [0xffd75a, null], [0xffd27a, null], [0xffc93c, null], [0xd8322f, null], [0x2f8a3a, null], [0x5f9a3a, null], [0xf4e9c8, null], [0xf4efe6, null]];
export const LIB_AREA_STATS = {};
export function libAreaBuilt(id, built, ctx = null) {
  if (id === 'jungle_ruins') { import('./d2Blender.js').then(m => m.d2Built(built, ctx)).catch(e => console.warn('[d2]', e)); return; }   // [Timothy] D2 JUNGLE RUINS in Blender (&d2glb=0 = Post's kit)
  if (!LIB_ON || !built) return;
  if (id === 'hilltop_fort') LIB_AREA_STATS[id] = [built.near, built.far].filter(Boolean).reduce((s, g) => s + libRetag(g, FORT_RULES, { floor: { y0: 35.9, y1: 36.4, from: 'stone_ashlar', to: 'cobble' } }), 0);
  else if (/^route_/.test(id)) { LIB_AREA_STATS[id] = [built.near, built.far].filter(Boolean).reduce((s, g) => s + libRetag(g, ROUTE_RULES, { floor: { from: 'stone_ashlar', to: 'stone_trim' }, wear: true }), 0);
    if (id === 'route_low' && ctx) import('./gateJunction.js').then(({ buildGateJunction, mergeInto, GATEJX }) => {   // the hill street's top end (BANKSY 9:55 PM); lazy: keeps look.js's imports light
      const g = buildGateJunction(ctx, { LIB_ID }); const merged = mergeInto(built.near, g); LIB_AREA_STATS.gate_junction = { ...(GATEJX.stats || {}), merged, hidden: GATEJX.hidden }; }).catch(e => console.warn('[gate junction]', e)); }
}
