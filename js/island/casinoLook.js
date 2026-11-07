// [pass2] BANKSY 3:09 PM "Do another pass on casino": the hall's own surface layers + painted lamp light, patched into the casino's two
// toon materials (js/island/casino.js: the hall + the table kit). No new draw calls, no new materials, one small generated texture:
//   - surface layers 13..15 (tools/casino_blender/build_casino.py tags them in the same TEXCOORD_0 code as the shared material library):
//     13 = crimson damask wallpaper (tone-on-tone motif), 14 = patterned carpet (gilt trellis + fibre), 15 = polished boards (grain)
//   - painted light: the room interiors drop to a darker base and every table lamp throws a tight warm pool (a downward cone), the
//     chandeliers a broad warm glow, per pixel (the baked vertex light alone is too even on the big floor / wall faces)
// ?caspass2=0 = off (the pass-1 look). Phones get both (one texture fetch + a 16-lamp loop on the casino surfaces only).
import * as THREE from 'three';

const Q = typeof location !== 'undefined' ? location.search : '';
export const CAS_LOOK_ON = !/[?&]caspass2=0(&|$)/.test(Q);
const NL = 16;
export const CAS_U = {
  uCasPat: { value: null }, uCasOn: { value: 0 }, uCasW2B: { value: new THREE.Matrix4() },
  uCasL: { value: Array.from({ length: NL }, () => new THREE.Vector4()) }, uCasLN: { value: 0 },
  uCasRoomA: { value: new THREE.Vector4(-1e3, -1e3, -1e3, -1e3) }, uCasRoomB: { value: new THREE.Vector4(-1e3, -1e3, -1e3, -1e3) }, uCasCeil: { value: new THREE.Vector2(8.2, 7.0) },
  uCasDark: { value: 0.6 }, uCasWarm: { value: new THREE.Color(1.0, 0.78, 0.5) },
};

const VDECL = '\nuniform mat4 uCasW2B; varying vec3 vCasP; varying float vCasId;';
const VMAIN = `
{ vec4 cw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  cw = instanceMatrix * cw;
#endif
  cw = modelMatrix * cw; vCasP = (uCasW2B * cw).xyz; vCasId = floor(floor(uv.x * 32.0) * 0.5); }`;
const FDECL = `
uniform sampler2D uCasPat; uniform float uCasOn; uniform vec4 uCasL[${NL}]; uniform int uCasLN; uniform vec4 uCasRoomA; uniform vec4 uCasRoomB;
uniform vec2 uCasCeil; uniform float uCasDark; uniform vec3 uCasWarm; varying vec3 vCasP; varying float vCasId;`;
const FMAIN = `
if (uCasOn > 0.5) {
  vec3 cp = vCasP; vec3 cn = normalize(cross(dFdx(cp), dFdy(cp))); vec3 an = abs(cn);
  vec2 pu = (an.y > an.x && an.y > an.z) ? cp.xz : (an.x > an.z ? vec2(-cp.z * sign(cn.x), cp.y) : vec2(cp.x * sign(cn.z), cp.y));
  if (vCasId > 12.5 && vCasId < 13.5) { float m = texture2D(uCasPat, pu / vec2(0.64, 0.8)).r; diffuseColor.rgb *= mix(0.74, 1.26, m); }
  else if (vCasId > 13.5 && vCasId < 14.5) { vec4 t = texture2D(uCasPat, pu / 0.7); float l = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
    diffuseColor.rgb = mix(diffuseColor.rgb * (0.78 + 0.34 * t.a), vec3(0.9, 0.62, 0.24) * (0.5 + 0.8 * l) * (0.8 + 0.3 * t.a), t.g * 0.62); }
  else if (vCasId > 14.5) { float g = texture2D(uCasPat, vec2(pu.x / 0.52, pu.y / 3.1)).b; diffuseColor.rgb *= 0.74 + 0.5 * g; }
  bool inA = cp.x > uCasRoomA.x && cp.x < uCasRoomA.z && cp.z > uCasRoomA.y && cp.z < uCasRoomA.w && cp.y < uCasCeil.x;
  bool inB = cp.x > uCasRoomB.x && cp.x < uCasRoomB.z && cp.z > uCasRoomB.y && cp.z < uCasRoomB.w && cp.y < uCasCeil.y;
  if (inA || inB) {
    float acc = 0.0;
    for (int i = 0; i < ${NL}; i++) { if (i >= uCasLN) break; vec4 L = uCasL[i]; vec3 d = L.xyz - cp; float r2 = max(dot(d, d), 0.04); float ir = inversesqrt(r2);
      float lam = 0.3 + 0.7 * max(dot(cn, d * ir), 0.0);
      if (L.w > 0.0) acc += L.w * smoothstep(0.55, 0.9, d.y * ir) * lam / (1.0 + 0.22 * r2);
      else { float f = max(1.0 - sqrt(r2) / -L.w, 0.0); acc += 0.75 * f * f * lam; } }
    diffuseColor.rgb *= uCasDark + acc * uCasWarm;
  }
}
`;
// patch a casino toon material (already patched by libMaterial + bakeLit): the layers 13..15 skip the shared library
export function casinoSurface(mat) {
  if (!CAS_LOOK_ON) return mat;
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (s, r) => { if (base) base(s, r); Object.assign(s.uniforms, CAS_U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>' + VDECL).replace('#include <begin_vertex>', '#include <begin_vertex>' + VMAIN);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>' + FDECL).replace('vLibC.x > 0.5)', 'vLibC.x > 0.5 && vLibC.x < 12.5)')
      .replace('#include <emissivemap_fragment>', FMAIN + '#include <emissivemap_fragment>'); };
  mat.customProgramCacheKey = () => key() + '_cas2';
  return mat;
}

// the pattern texture (tileable, 4 channels): R damask, G carpet trellis, B board grain, A carpet fibre
function patternTex(low) {
  const doc = typeof document !== 'undefined' && document.createElement ? document : null; if (!doc) return null;
  const S = low ? 256 : 512, mk = () => { const c = doc.createElement('canvas'); c.width = c.height = S; return [c, c.getContext && c.getContext('2d')]; };
  const [ca, ga] = mk(), [cb, gb] = mk(); if (!ga || !gb) return null;
  // damask: a symmetric ogee medallion on a half-drop lattice
  ga.fillStyle = '#000'; ga.fillRect(0, 0, S, S);
  const motif = (g, cx, cy, k) => { g.save(); g.translate(cx, cy); g.scale(k, k);
    for (const sx of [-1, 1]) { g.save(); g.scale(sx, 1); g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(0, -0.46); g.bezierCurveTo(0.1, -0.3, 0.2, -0.18, 0.15, 0.0); g.bezierCurveTo(0.1, 0.16, 0.04, 0.3, 0, 0.44); g.lineTo(0, -0.46); g.fill();
      g.beginPath(); g.ellipse(0.2, 0.12, 0.12, 0.045, -0.7, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(0.24, -0.16, 0.1, 0.035, 0.6, 0, Math.PI * 2); g.fill();
      g.lineWidth = 0.028; g.strokeStyle = '#fff'; g.beginPath(); g.arc(0.3, -0.02, 0.07, -2.4, 1.6); g.stroke();
      g.beginPath(); g.arc(0.12, 0.36, 0.05, -1.2, 2.6); g.stroke();
      g.beginPath(); g.ellipse(0.06, -0.48, 0.05, 0.02, 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.moveTo(0, -0.24); g.bezierCurveTo(0.05, -0.14, 0.08, -0.06, 0.06, 0.02); g.bezierCurveTo(0.04, 0.1, 0.02, 0.18, 0, 0.24); g.lineTo(0, -0.24); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -0.12); g.lineTo(0.03, 0.0); g.lineTo(0, 0.12); g.fill();
      g.restore(); }
    g.restore(); };
  for (const [x, y] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]]) motif(ga, x * S, y * S, S * 0.5);
  for (const [x, y] of [[0, 0.5], [1, 0.5], [0.5, 0], [0.5, 1]]) { ga.save(); ga.translate(x * S, y * S); ga.fillStyle = '#fff'; ga.beginPath(); ga.arc(0, 0, S * 0.03, 0, Math.PI * 2); ga.fill();
    for (let k = 0; k < 4; k++) { ga.rotate(Math.PI / 2); ga.beginPath(); ga.ellipse(S * 0.06, 0, S * 0.035, S * 0.012, 0, 0, Math.PI * 2); ga.fill(); } ga.restore(); }
  // carpet: a gilt diamond trellis with quatrefoils at the nodes + a small fleuron in each diamond
  gb.fillStyle = '#000'; gb.fillRect(0, 0, S, S); gb.strokeStyle = '#fff'; gb.fillStyle = '#fff'; gb.lineWidth = S * 0.028;
  gb.beginPath(); gb.moveTo(-S * 0.5, S * 0.5); gb.lineTo(S * 0.5, -S * 0.5); gb.moveTo(0, S); gb.lineTo(S, 0); gb.moveTo(S * 0.5, S * 1.5); gb.lineTo(S * 1.5, S * 0.5);
  gb.moveTo(-S * 0.5, S * 0.5); gb.lineTo(S * 0.5, S * 1.5); gb.moveTo(0, 0); gb.lineTo(S, S); gb.moveTo(S * 0.5, -S * 0.5); gb.lineTo(S * 1.5, S * 0.5); gb.stroke();
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; gb.beginPath(); gb.arc(x * S + Math.cos(a) * S * 0.05, y * S + Math.sin(a) * S * 0.05, S * 0.045, 0, Math.PI * 2); gb.fill(); }
  for (const [x, y] of [[0.5, 0], [0, 0.5], [1, 0.5], [0.5, 1]]) { gb.beginPath(); gb.moveTo(x * S, y * S - S * 0.08); gb.lineTo(x * S + S * 0.04, y * S); gb.lineTo(x * S, y * S + S * 0.08); gb.lineTo(x * S - S * 0.04, y * S); gb.fill(); }
  const A = ga.getImageData(0, 0, S, S).data, B = gb.getImageData(0, 0, S, S).data, out = new Uint8Array(S * S * 4);
  let seed = 4747; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const TAU = Math.PI * 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, u = x / S, v = y / S;
    const w = 0.5 + 0.2 * Math.sin(TAU * (3 * u + 0.18 * Math.sin(TAU * (2 * v + 0.3 * Math.sin(TAU * u))))) + 0.14 * Math.sin(TAU * (17 * u + 0.06 * Math.sin(TAU * 3 * v))) + 0.08 * Math.sin(TAU * (41 * u + 0.1 * Math.sin(TAU * 5 * v)));
    out[i] = A[i]; out[i + 1] = B[i]; out[i + 2] = Math.max(0, Math.min(255, w * 255)); out[i + 3] = 150 + rnd() * 105; }
  const t = new THREE.DataTexture(out, S, S, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = low ? 2 : 8; t.needsUpdate = true; t.name = 'casino_pattern';
  return t;
}

// once the hall is placed: world -> building frame, the two room boxes, the lamps (from the GLB's 'lamps': three building frame [x, y, z])
export function casinoLookSetup(K, P) {
  if (!CAS_LOOK_ON || !K) return null;
  CAS_U.uCasW2B.value.makeRotationY(P.yaw).setPosition(P.x, P.y, P.z).invert();
  const fp = K.footprint || {}, I = fp.inner, M = 0.14;
  if (I) CAS_U.uCasRoomA.value.set(I[0] - M, I[1] - M, I[2] + M, I[3] + M + 0.8);   // + the front arch reveal
  if (fp.ceil) CAS_U.uCasCeil.value.x = fp.ceil + 0.1;
  if (K.wing && K.wing.inner) { const W = K.wing.inner; CAS_U.uCasRoomB.value.set(W[0] - M, W[1] - M, W[2] + M, W[3] + M + 0.7); CAS_U.uCasCeil.value.y = (K.wing.ceil || 7) + 0.1; }
  const L = CAS_U.uCasL.value; let n = 0;
  for (const [x, y, z] of K.lamps || []) { if (n >= NL) break; L[n++].set(x, y, z, y < 3.6 ? 1.45 : -(y > 5.5 ? 9.0 : 7.5)); }
  CAS_U.uCasLN.value = n; CAS_U.uCasDark.value = K.low ? 0.66 : 0.6;
  CAS_U.uCasPat.value = patternTex(K.low); CAS_U.uCasOn.value = CAS_U.uCasPat.value ? 1 : 0;
  return { lamps: n };
}
