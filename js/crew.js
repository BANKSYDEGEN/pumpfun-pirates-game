// [Raul] PUMPFUN PIRATES deck crew: small NFT-style pirates (big black / brown tricorn with the white skull, beards,
// eyewear traits, red coat / tank / tee / shirtless, the odd hook arm) manning the guns and walking the deck.
// Cheap by design: ONE merged mesh + ONE draw call per ship, low-poly, vertex colours, all animation in the vertex
// shader on the shared wind clock (no per-frame JS, no skinning). Gunners recoil + ram/load when THEIR side fires
// (crewFire), walkers pace the waist with a leg/arm swing. A THREE.LOD hides the crew beyond a distance.
// Budget by quality: high = all gun crews + 3 walkers, culled past 95 m; phones / Medium = one gunner per gun pair + 2
// walkers past 55 m; [v82] low / phones = a gunner at every cannon (low: no walkers), culled past 80 m. Purely cosmetic: no collision, never in userData.len/beam/depth.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { wind } from './ships.js';
import { V4, crewPirateV4, crewPirateV4Dressed } from './crewV4.js'; // [v101] Raul's v4 pirates as the crew (baked poses, same single draw call)

let Q = 'high', PHONE = false;
export function setCrewQuality(q, phone = false) { Q = q; PHONE = phone; }

const C = (h) => new THREE.Color(h);
const SKIN = [C(0xf2c9a0), C(0xe0ac7e), C(0x8a5a3c), C(0xf5f0ea)], BEARD = [C(0x1a1410), C(0xd9b25a), C(0x39ff6a), C(0x7a4a22)];
const COAT = [C(0xc4161c), C(0x2a2f3a), C(0xf2f2f2), null], HAT = [C(0x131313), C(0x5a3a22)];
// [v87] separate keys for the hat parts; on classic they look the same as before (1-step hex offsets, invisible)
const HAT_BRIM = [C(0x131314), C(0x5a3a23)], HAT_BAND = [C(0x141313), C(0x5b3a22)], SKULL = C(0xfefefe);
const PANTS = C(0x2b2018), WHITE = C(0xffffff), IRON = C(0xc9ccd2), WOOD = C(0x6a4026);
const hash = (i) => ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;

// [v101] uv.x < 0 = vertex colour only (procedural parts); >= 0 = a v4 texture slot (js/crewV4.js)
const noUv = (g) => g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2).fill(-1), 2));
// [v101] a crew seat: Raul's v4 pirate (stable look per seat) once loaded, else the procedural NFT deckhand
const seat = (v, pose = 'idle') => V4 ? crewPirateV4(v, pose) : pirate(v % 12);
// one pirate (faces +Z, feet at y=0, ~1.25 tall), parts: 0 body/head, 1/2 legs (hip pivot), 3/4 arms (shoulder pivot)
const _pc = new Map();
function pirate(v) {
  if (_pc.has(v)) return _pc.get(v);
  const r = (k) => hash(v * 7.31 + k), skin = SKIN[Math.floor(r(1) * 4)], beard = BEARD[Math.floor(r(2) * 4)], hat = HAT[r(3) < 0.7 ? 0 : 1];
  const ci = Math.floor(r(4) * 4), coat = COAT[ci] || skin, eye = Math.floor(r(5) * 6), hook = r(6) < 0.3;
  const out = [];
  const add = (g, col, part, p = [0, 0, 0], rot = [0, 0, 0], s = [1, 1, 1]) => {
    g = g.index ? g.toNonIndexed() : g;
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...s)));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count, c = new Float32Array(n * 3), pa = new Float32Array(n).fill(part);
    for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(pa, 1)); noUv(g); out.push(g);
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), sph = (rad, a = 8, b = 6) => new THREE.SphereGeometry(rad, a, b), cyl = (a, b, h, s = 8, hs = 1, open = false) => new THREE.CylinderGeometry(a, b, h, s, hs, open);
  for (const sx of [1, -1]) add(box(0.13, 0.36, 0.15), PANTS, sx > 0 ? 1 : 2, [sx * 0.085, 0.18, 0]);
  add(box(0.36, 0.4, 0.24), coat, 0, [0, 0.55, 0]);
  if (ci === 1) add(box(0.37, 0.06, 0.25), C(0xeeeeee), 0, [0, 0.62, 0]); // striped tee band
  add(box(0.37, 0.06, 0.25), C(0x1a1208), 0, [0, 0.38, 0]); // belt
  for (const sx of [1, -1]) {
    const part = sx > 0 ? 3 : 4, isHook = hook && sx < 0;
    add(box(0.11, 0.3, 0.11), ci === 3 || ci === 1 && r(7) < 0.5 ? skin : coat, part, [sx * 0.24, 0.58, 0]);
    if (isHook) { add(cyl(0.05, 0.06, 0.12, 6), WOOD, part, [sx * 0.24, 0.38, 0]); add(new THREE.TorusGeometry(0.06, 0.018, 4, 8, Math.PI * 1.3), IRON, part, [sx * 0.24, 0.27, 0.02], [0, Math.PI / 2, 0]); }
    else add(sph(0.065, 6, 4), skin, part, [sx * 0.24, 0.4, 0]);
  }
  add(sph(0.21, 10, 8), skin, 0, [0, 0.93, 0]); // big chibi head
  add(new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), beard, 0, [0, 0.92, 0.06], [0, 0, 0], [1.05, 1.1, 0.95]); // beard (lower face)
  // eyewear: 0 none, 1 3d glasses, 2 eyepatch, 3 laser, 4 sunglasses, 5 vr
  const ey = 0.97, ez = 0.19;
  if (eye === 1) { add(box(0.1, 0.07, 0.03), C(0xe8261e), 0, [-0.07, ey, ez]); add(box(0.1, 0.07, 0.03), C(0x2a6aff), 0, [0.07, ey, ez]); add(box(0.3, 0.025, 0.03), WHITE, 0, [0, ey + 0.045, ez]); }
  else if (eye === 2) { add(box(0.09, 0.08, 0.03), C(0x0b0b0b), 0, [0.07, ey, ez]); add(box(0.42, 0.02, 0.02), C(0x0b0b0b), 0, [0, ey + 0.03, 0.12], [0.4, 0, 0]); }
  else if (eye === 3) { for (const sx of [1, -1]) add(box(0.06, 0.03, 0.03), C(0xff1010), 0, [sx * 0.07, ey, ez]); add(box(0.02, 0.02, 0.5), C(0xff2a2a), 0, [0.07, ey, ez + 0.26]); }
  else if (eye === 4) add(box(0.3, 0.07, 0.03), C(0x0b0b0b), 0, [0, ey, ez]);
  else if (eye === 5) add(box(0.3, 0.12, 0.1), C(0x1d1f26), 0, [0, ey, ez - 0.02]);
  else for (const sx of [1, -1]) add(sph(0.03, 5, 4), C(r(8) < 0.5 ? 0x2a6acc : 0x5a3a1a), 0, [sx * 0.07, ey, ez - 0.01]);
  // the hat: wide brim, tall crown with the white skull up front
  // [v87] brim / crown / band / skull each carry their own (classic-identical) colour key so dressCrew can recolour them per skin
  const hv = r(3) < 0.7 ? 0 : 1;
  add(cyl(0.33, 0.33, 0.04, 10), HAT_BRIM[hv], 0, [0, 1.1, 0], [0, 0, 0], [1, 1, 0.8]);
  add(cyl(0.17, 0.22, 0.2, 10), hat, 0, [0, 1.21, 0]);
  add(cyl(0.214, 0.226, 0.06, 10, 1, true), HAT_BAND[hv], 0, [0, 1.145, 0]); // hat band round the crown base
  add(sph(0.055, 6, 4), SKULL, 0, [0, 1.22, 0.2], [0, 0, 0], [1, 1, 0.4]);
  add(box(0.15, 0.025, 0.02), SKULL, 0, [0, 1.17, 0.205], [0, 0, 0.5]); add(box(0.15, 0.025, 0.02), SKULL, 0, [0, 1.17, 0.205], [0, 0, -0.5]);
  const g = mergeGeometries(out, false); out.forEach(o => o.dispose()); _pc.set(v, g); return g;
}

const VERT = `attribute vec3 color; attribute float aPart; attribute vec3 aOrigin; attribute vec4 aInfo;
uniform float uT; uniform float uFireP; uniform float uFireS; uniform float uS; uniform float uHit; uniform float uHitK; uniform float uSteer; uniform float uGap; uniform float uCapOff; uniform vec4 uDk; uniform vec4 uDk2;
varying vec3 vC; varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vK;
#include <fog_pars_vertex>
vec3 rotX(vec3 p, vec3 pv, float a){ p -= pv; float c = cos(a), s = sin(a); return pv + vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
vec3 rotZ(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }
void main(){
  vK = uv.x < -0.5 ? -1.0 : floor(uv.x * 0.5); vUv = vec2(uv.x - max(vK, 0.0) * 2.0, uv.y);
  vec3 p = position, n = normal; float role = aInfo.x, sx = aInfo.y, ph = aInfo.z, span = aInfo.w;
  vec3 o = aOrigin; float yaw, leg = 0.0, arm = 0.0, lean = 0.0, bob = 0.0, look = 0.0, armB = 0.0;
  if (aPart > 5.5) { // [v95] the ship's wheel (6) + its pedestal (7), in the captain's frame: no lean / bob; the wheel turns with the helm
    if (aPart < 6.5) { float wa = -uSteer * 2.4; vec3 pv = vec3(0.0, 0.95, 0.36); p = pv + rotZ(p - pv, wa); n = rotZ(n, wa); }
    p *= uS; vec4 mvPosition = modelViewMatrix * vec4(p + o, 1.0); vC = color; vN = normalize(normalMatrix * n); vV = -mvPosition.xyz; gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
    return;
  }
  if (role > 2.5) { // [v95] CAPTAIN at the wheel, facing the bow: hands on the rim, one up / one down with the helm, body leans into the turn
    yaw = 0.0; arm = -1.28 + 0.38 * uSteer; armB = -1.28 - 0.38 * uSteer; lean = 0.06 + 0.02 * sin(uT * 1.3 + ph);
    bob = 0.012 * sin(uT * 1.9 + ph);
  } else if (role < 0.5) { // gunner beside its cannon, facing outboard
    yaw = sx * 1.5708;
    float tf = uT - (sx > 0.0 ? uFireP : uFireS) - aInfo.w * uGap; // [v97] each gunner reacts when HIS gun goes off in the ripple
    float rec = (tf >= 0.0 && tf < 0.55) ? sin(tf / 0.55 * 3.14159) : 0.0;
    float load = (tf >= 0.45 && tf < 2.6) ? sin((tf - 0.45) * 7.0) * smoothstep(2.6, 1.9, tf) : 0.0;
    lean = -0.38 * rec + 0.03 * sin(uT * 1.7 + ph);
    arm = -1.3 * rec - 0.9 * abs(load) - 0.15;
    bob = 0.015 * sin(uT * 2.1 + ph);
  } else if (role > 1.5 && role < 2.5) { // [v84] spy tower lookout: walks the platform rim, stops, faces the sea, raises the telescope and sweeps it
    float T = 10.0, tt = uT + ph * T, u = mod(tt, T), cyc = floor(tt / T);
    float th = ph * 6.2832 + (cyc + smoothstep(0.0, 4.0, u)) * 1.75; // around the rim, a different stretch every stop
    o.x += cos(th) * sx; o.z += sin(th) * sx;
    float face = smoothstep(3.9, 4.6, u) * (1.0 - smoothstep(9.2, 9.9, u));
    look = smoothstep(4.5, 5.3, u) * (1.0 - smoothstep(8.5, 9.3, u));
    yaw = mix(-th, 1.5708 - th, face) + look * 0.7 * sin((u - 5.3) * 0.95);
    float walking = smoothstep(0.0, 0.35, u) * (1.0 - smoothstep(3.6, 4.0, u)), w = sin(uT * 6.0 + ph * 6.28);
    leg = w * 0.5 * walking; arm = -w * 0.4 * walking; bob = abs(w) * 0.03 * walking;
  } else { // walker pacing fore and aft
    float s = fract(uT * 0.9 / max(1.0, span * 2.0) + ph), tri = abs(s * 2.0 - 1.0);
    o.z += span * (0.5 - tri); yaw = s < 0.5 ? 0.0 : 3.14159; // [v103] face the way you walk (the pirates face +Z; first half walks +Z)
    if (uDk2.z > 0.5 && span >= 0.0) { float t = o.z < uDk.y ? 0.25 + (o.z - uDk.x) / uDk.z : 0.72 + (o.z - uDk.y) / uDk.w, q = (t - 0.47) * 2.0; o.y = uDk2.x * (0.5 + 0.5 * q * q) - uDk2.y; } // [Raul] feet on the deck sheer (ships.js hullShape top - deckDrop)
    float w = sin(uT * 7.5 + ph * 6.28);
    leg = w * 0.55; arm = -w * 0.5; bob = abs(w) * 0.035;
  }
  // [v87] REACTIONS. Hit: every pirate staggers (crouch, wobble, arms over the head; the lookout grabs the rail), staggered per
  // pirate, scaled by the hit size (uHitK). Fire: walkers + the lookout sometimes cheer / fist-pump after a broadside.
  float roll = 0.0, hop = 0.0;
  if (role < 0.5) { float tf0 = uT - (sx > 0.0 ? uFireP : uFireS) - aInfo.w * uGap; hop = (tf0 >= 0.0 && tf0 < 0.7) ? sin(tf0 / 0.7 * 3.14159) * 0.16 : 0.0; } // gunner hops back from the recoil
  else if (role > 2.5) { float tc = uT - max(uFireP, uFireS) - 0.25; // [v95] captain: one fist up after a broadside, the other hand stays on the wheel
    float ch = smoothstep(0.0, 0.2, tc) * (1.0 - smoothstep(1.0, 1.4, tc)); armB = mix(armB, -2.7 + 0.3 * sin(uT * 14.0), ch); bob += ch * 0.04 * abs(sin(uT * 9.0)); }
  else { float tc = uT - max(uFireP, uFireS) - 0.35 - ph * 0.3, cheer = step(0.45, fract(sin(ph * 91.7 + floor(max(uFireP, uFireS)) * 3.1) * 437.5));
    float ch = cheer * smoothstep(0.0, 0.2, tc) * (1.0 - smoothstep(1.2, 1.6, tc));
    arm = mix(arm, -2.7 + 0.35 * sin(uT * 14.0 + ph * 5.0), ch); leg *= 1.0 - ch; look *= 1.0 - ch; bob += ch * abs(sin(uT * 9.0 + ph)) * 0.08; }
  float th = uT - uHit - ph * 0.25;
  float hr = (th >= 0.0 && th < 1.4) ? uHitK * smoothstep(0.0, 0.12, th) * (1.0 - smoothstep(0.4, 1.4, th)) : 0.0;
  if (hr > 0.001) {
    roll = hr * 0.32 * sin(th * 13.0 + ph * 6.28); lean += hr * 0.3 * sin(th * 9.0 + ph * 3.0) - hr * 0.15; bob -= hr * 0.16;
    if (role > 2.5) { arm = mix(arm, -1.35, min(1.0, hr * 2.0)); armB = mix(armB, -1.35, min(1.0, hr * 2.0)); leg *= 1.0 - hr; } // [v95] captain hangs on to the wheel
    else if (role > 1.5) { look *= 1.0 - min(1.0, hr * 2.0); arm = mix(arm, -1.45, min(1.0, hr * 2.0)); leg *= 1.0 - hr; } // lookout grabs the rail
    else { arm = mix(arm, -2.9, min(1.0, hr * 1.6)); leg = mix(leg, 0.35 * sin(th * 12.0 + ph * 4.0), min(1.0, hr * 1.6)); } // arms over the head, stumbling feet
  }
  /* [v129] BANKSY "holes when walking": each limb used to swing as one rigid piece, so the hip / shoulder seam opened mid-stride.
     The swing now fades in over the joint (none at the hip / shoulder line, full a few cm below): the seam bends instead of tearing. */
  float kL = smoothstep(-0.03, 0.09, vec3(0.0, 0.36, 0.0).y - p.y), kA = smoothstep(-0.02, 0.11, vec3(0.0, 0.72, 0.0).y - p.y);
  if (aPart > 0.5 && aPart < 1.5) { p = rotX(p, vec3(0.0, 0.36, 0.0), leg * kL); n = rotX(n, vec3(0.0), leg * kL); }
  else if (aPart > 1.5 && aPart < 2.5) { p = rotX(p, vec3(0.0, 0.36, 0.0), -leg * kL); n = rotX(n, vec3(0.0), -leg * kL); }
  else if (aPart > 2.5 && aPart < 3.5) { float a = mix(arm, -2.25, look) * mix(kA, 1.0, look); p = rotX(p, vec3(0.0, 0.72, 0.0), a); n = rotX(n, vec3(0.0), a); }
  else if (aPart > 3.5 && aPart < 4.5) { float a = (role > 2.5 ? armB : mix(role < 0.5 ? arm : -arm, -1.35, look)) * mix(kA, 1.0, max(look, step(2.5, role))); p = rotX(p, vec3(0.0, 0.72, 0.0), a); n = rotX(n, vec3(0.0), a); }
  else if (aPart > 4.5) { // telescope: modelled at the eye; held in the right hand (tilted down-forward) until raised
    float ra = mix(arm, -2.25, look) + 2.25, ta = -1.47 * (1.0 - look);
    p = rotX(rotX(p, vec3(0.0, 0.92, 0.25), ta), vec3(0.0, 0.72, 0.0), ra); n = rotX(rotX(n, vec3(0.0), ta), vec3(0.0), ra); }
  if (role > 2.5) roll += -0.12 * uSteer; // [v95] the captain leans into the turn
  p.z -= hop; p = rotZ(rotX(p, vec3(0.0), lean), roll) * uS * (role > 1.5 && role < 2.5 ? span : 1.0); n = rotZ(rotX(n, vec3(0.0), lean), roll);
  if (role > 2.5 && aPart < 5.5 && uCapOff > 0.5) p = vec3(0.0); // [Timothy v2] a captain-creator figure stands here: hide the placeholder body, keep the wheel
  float c = cos(yaw), si = sin(yaw);
  p = vec3(p.x * c + p.z * si, p.y + bob, -p.x * si + p.z * c) + o; n = vec3(n.x * c + n.z * si, n.y, -n.x * si + n.z * c);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vC = color; vN = normalize(normalMatrix * n); vV = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = `uniform vec3 uSunV; varying vec3 vC; varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vK;
uniform sampler2D tA0; uniform sampler2D tA1; uniform sampler2D tF0; uniform sampler2D tF1; uniform sampler2D tS;
#include <fog_pars_fragment>
void main(){ vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N; /* [v122] double-sided: v5 bodies show no holes */ float d = dot(N, normalize(uSunV));
  float band = d > 0.35 ? 1.0 : (d > -0.1 ? 0.78 : 0.58);
  float rim = 1.0 - clamp(dot(N, normalize(vV)), 0.0, 1.0);
  vec3 base = vC;
  if (vK > -0.5) { // [v101] v4 pirate: body atlas (baked light) x tint colour, or the face decal (alpha-tested)
    vec4 tx = vK < 0.5 ? texture2D(tA0, vUv) : vK < 1.5 ? texture2D(tA1, vUv) : vK < 2.5 ? texture2D(tF0, vUv) : vK < 3.5 ? texture2D(tF1, vUv) : texture2D(tS, vUv);
    if (vK > 1.5 && vK < 3.5) { if (tx.a < 0.5) discard; base = tx.rgb; rim = 0.0; } else base = vC * tx.rgb; // [v106] slot 4 = captain's gear (stripe tex x colour)
    band = mix(1.0, band, 0.55); }
  vec3 col = base * band * (rim > 0.78 ? 0.25 : 1.0); // inked silhouette edge (bold-outline NFT look) without an outline mesh
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const _sun = new THREE.Vector3(0.45, 0.8, 0.35).normalize(), _sv = new THREE.Vector3();
let _stripe = null; // [v106] same 2 x 2 as js/pirateGear.js: u < .5 = sailor stripes along v, u > .5 = plain (vertex colour)
function stripeTex() { if (_stripe) return _stripe;
  _stripe = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 34, 44, 78, 255, 255, 255, 255, 255]), 2, 2);
  _stripe.magFilter = _stripe.minFilter = THREE.NearestFilter; _stripe.wrapT = THREE.RepeatWrapping; _stripe.colorSpace = THREE.SRGBColorSpace; _stripe.needsUpdate = true; return _stripe; }
function crewMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uFireP: { value: -99 }, uFireS: { value: -99 }, uHit: { value: -99 }, uHitK: { value: 0 }, uSteer: { value: 0 }, uGap: { value: 0.07 }, uCapOff: { value: 0 }, uDk: { value: new THREE.Vector4(0, 0, 1, 1) }, uDk2: { value: new THREE.Vector4(0, 0, 0, 0) }, uS: { value: 1 }, uSunV: { value: new THREE.Vector3() } }]),
    vertexShader: V4 ? VERT.replaceAll('vec3(0.0, 0.36, 0.0)', `vec3(0.0, ${V4.hipY.toFixed(3)}, 0.0)`).replaceAll('vec3(0.0, 0.72, 0.0)', `vec3(0.0, ${V4.shY.toFixed(3)}, 0.0)`)
      .replaceAll('vec3(0.0, 0.92, 0.25)', `vec3(0.0, ${(V4.eyeY - 0.05).toFixed(3)}, 0.25)`) : VERT, fragmentShader: FRAG, fog: true, side: THREE.DoubleSide,
  });
  if (V4) { const [a0, a1, f0, f1] = V4.tex; Object.assign(m.uniforms, { tA0: { value: a0 }, tA1: { value: a1 }, tF0: { value: f0 }, tF1: { value: f1 }, tS: { value: stripeTex() } }); }
  m.uniforms.uT = wind.uTime; // shared clock: every client animates the same way
  return m;
}

// [v95] the CAPTAIN (red-coat variant 17: eyepatch, black tricorn -> recoloured per skin by dressCrew like the crew) with a
// long coat, epaulettes and a wider three-cornered brim, plus the ship's wheel (part 6, turns in the shader) on its pedestal (7).
let _cap = null;
function captainGeo() {
  if (_cap) return _cap;
  const out = [V4 ? crewPirateV4(17, 'idle', { female: false }).clone() : pirate(17).clone()];
  const add = (g, col, part, p = [0, 0, 0], rot = [0, 0, 0], s = [1, 1, 1]) => {
    g = g.index ? g.toNonIndexed() : g;
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...s)));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1)); noUv(g); out.push(g);
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s);
  if (!V4) { // procedural captain's coat + tricorn (the v4 captain wears Raul's outfit, like the player's)
  add(box(0.38, 0.34, 0.05), COAT[0], 0, [0, 0.26, -0.13], [0.12, 0, 0]);                       // long coat tails
  for (const sx of [1, -1]) { add(box(0.12, 0.05, 0.14), BELT, 0, [sx * 0.2, 0.76, 0]); add(box(0.04, 0.4, 0.02), BELT, 0, [sx * 0.1, 0.56, 0.125]); } // epaulettes + lapels
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 3; add(box(0.3, 0.05, 0.16), HAT_BRIM[0], 0, [Math.sin(a) * 0.24, 1.13, Math.cos(a) * 0.24], [0.35, a, 0]); } } // tricorn corners, turned up
  // the wheel: rim + 8 spokes with handles + hub, in the XY plane at z 0.36 (just past the hands)
  const wy = 0.95, wz = 0.36, R = 0.42;
  add(new THREE.TorusGeometry(R, 0.035, 5, 18), WOOD, 6, [0, wy, wz]);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(cyl(0.018, 0.018, R * 2 + 0.24, 4), WOOD, 6, [0, wy, wz], [0, 0, a]); }
  add(cyl(0.07, 0.07, 0.1, 8), BRASS, 6, [0, wy, wz], [Math.PI / 2, 0, 0]);
  add(box(0.16, wy - 0.05, 0.16), WOOD, 7, [0, (wy - 0.05) / 2, wz + 0.12]);                   // pedestal + axle housing
  add(box(0.12, 0.12, 0.14), DARK, 7, [0, wy, wz + 0.1]);
  _cap = mergeGeometries(out, false); out.slice(1).forEach(o => o.dispose()); return _cap;
}
// ship: buildShip group. gunSlots: [{x, y, z, sx}] gun positions on the deck (body space). deck: {z0, z1, y, x}
export function addCrew(ship, { guns = [], walk = null, boss = false, helm = null, anchors = null } = {}) {
  if (anchors) { // [Timothy v2] placed from the ship's crew anchors (same spots as before: gunner 0.95 inboard + 0.42 aft of its gun, captain behind the wheel)
    const s0 = boss ? 1.6 : 1.35, cap = anchors.find(a => a.role === 'captain');
    guns = anchors.filter(a => a.role === 'gunner').map(a => { const sx = a.side === 'port' ? 1 : -1; return { x: a.pos.x + sx * 0.95, y: a.pos.y, z: a.pos.z - 0.42, sx, i: a.index }; });
    helm = cap ? { x: cap.pos.x, y: cap.pos.y, z: cap.pos.z + 0.36 * s0 } : null;
  }
  // [v82] phones + LOW keep a gunner at EVERY cannon (BANKSY). Cheap tier: gunners only (no walkers), the same single
  // merged draw call per ship, no shadows; desktop Medium keeps one gunner per gun pair.
  const lite = Q === 'low', med = PHONE || Q === 'medium';
  const crew = []; let k = 0;
  // [v97] one gunner at EVERY gun on every quality: each CANNONS upgrade adds a gun + its gunner on both sides (still one draw call)
  for (const g of guns) crew.push({ v: k++, o: [g.x - g.sx * 0.95, g.y, g.z + 0.42], info: [0, g.sx, hash(k * 3.3), g.i | 0] });
  if (walk && !lite) { const n = med ? 2 : 3; for (let i = 0; i < n; i++) {
    const L = walk.lanes ? walk.lanes[i] : null; if (walk.lanes && !L) continue; // [Raul] a clear lane per walker (ships.js walkLanes): no walking through walls, masts, guns or gunners
    crew.push(L ? { v: k++, o: [L.x, walk.y, (L.a + L.b) / 2], info: [1, 0, hash(i * 5.1 + 2), L.b - L.a] }
      : { v: k++, o: [(i % 2 ? -0.75 : 0.75), walk.y, walk.z0 + (walk.z1 - walk.z0) * 0.5], info: [1, 0, hash(i * 5.1 + 2), Math.max(1, walk.z1 - walk.z0) * (0.85 - i * 0.12)] }); } }
  if (helm) crew.push({ v: 17, cap: true, o: [helm.x, helm.y, helm.z - 0.36 * (boss ? 1.6 : 1.35)], info: [3, 0, hash(helm.z * 3.7), 0] }); // [v95] captain at the wheel
  if (!crew.length) return null;
  for (const c of crew) c.pose = c.info[0] === 0 ? 'cannon' : 'idle';
  const geo = crewGeo(crew, null, '');
  const s = boss ? 1.6 : 1.35; // chibi pirates read above the bulwark (deck to rail top is ~1.1)
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 30);
  const mat = crewMaterial(), mesh = new THREE.Mesh(geo, mat); mat.uniforms.uS.value = s;
  if (walk?.deck) { const d = walk.deck; mat.uniforms.uDk.value.set(d.zA, d.zB, d.lf, d.l); mat.uniforms.uDk2.value.set(d.depth, d.drop, 1, 0); } mesh.frustumCulled = true; mesh.userData.crewMesh = true;
  mesh.onBeforeRender = (r, sc, cam) => { _sv.copy(_sun).transformDirection(cam.matrixWorldInverse); mat.uniforms.uSunV.value.copy(_sv); };
  const lod = new THREE.LOD(); lod.addLevel(mesh, 0); lod.addLevel(new THREE.Object3D(), lite || PHONE ? 80 : med ? 55 : 95); lod.userData.seats = crew; lod.userData.v4 = !!V4; // phones zoom out to ~120: keep your own gunners in view lod.userData.crew = true;
  ship.userData.crew = mat.uniforms;
  return lod;
}
// [v109b] the ship's crew LOD: a child of the body, or one level down when a premium PvP skin moved everything into its
// 'pvpLift' group (assets/ships/pvp/pvpKit.js liftRig). Missing it there made those skins drop your crew's clothes.
const isCrewLod = (o) => o.isLOD && o.children[0]?.userData?.crewMesh;
export function crewLodOf(body) {
  const ch = body?.children; if (!ch) return null;
  for (const o of ch) if (isCrewLod(o)) return o;
  for (const g of ch) if (!g.isLOD && g.children?.length) for (const o of g.children) if (isCrewLod(o)) return o;
  return null;
}
// [v106] every seat (+ lookouts) -> ONE merged geometry; chunks = the captain's baked gear (js/crewV4.js crewGearV4) or null
function seatGeo(c, chunks, tag) {
  if (c.cap) return captainGeo(); // the captain seat (AI captains; on player ships it is hidden behind the animated captain)
  const body = chunks && V4 ? crewPirateV4Dressed(c.v, c.pose, chunks, tag) : seat(c.v, c.pose);
  return c.scope ? mergeGeometries([body.clone(), scopeGeo().clone()], false) : body.clone();
}
function crewGeo(seats, chunks, tag) {
  const parts = seats.map(c => { const g = seatGeo(c, chunks, tag), n = g.attributes.position.count;
    const O = new Float32Array(n * 3), I = new Float32Array(n * 4); for (let i = 0; i < n; i++) { O.set(c.o, i * 3); I.set(c.info, i * 4); }
    g.setAttribute('aOrigin', new THREE.BufferAttribute(O, 3)); g.setAttribute('aInfo', new THREE.BufferAttribute(I, 4)); return g; });
  const geo = mergeGeometries(parts, false); parts.forEach(p => p.dispose()); return geo;
}
// [v106] dress one ship's crew in its captain's gear (chunks from crewGearV4; null = back to the default outfit). Rebuilds that
// ship's merged crew geometry: same material, same single draw call. Skin colours (dressCrew) are re-applied on top.
export function setCrewGear(body, chunks, tag = '') {
  const lod = crewLodOf(body); if (!lod?.userData.seats) return false;
  if ((lod.userData.gearTag || '') === (chunks ? tag : '')) return true;
  const mesh = lod.children[0], old = mesh.geometry, geo = crewGeo(lod.userData.seats, chunks, tag);
  geo.boundingSphere = old.boundingSphere ? old.boundingSphere.clone() : new THREE.Sphere(new THREE.Vector3(0, 1, 0), 30);
  mesh.geometry = geo; old.dispose(); lod.userData.gearTag = chunks ? tag : '';
  if (lod.userData.outfit) dressCrew(body, lod.userData.outfit);
  return true;
}
// [Raul] move this ship's deck walkers onto new lanes ({ x, a, b } from ships.js walkLanes) in place: same geometry, same draw call.
// Seats are updated too, so later rebuilds (setCrewGear) keep the lanes. A walker without a lane is parked out of sight in the hull.
export function setWalkLanes(body, lanes) {
  const lod = crewLodOf(body); if (!lod?.userData.seats) return 0; // (also inside a premium skin's pvpLift group)
  const W = lod.userData.seats.filter(c => c.info[0] === 1); if (!W.length) return 0;
  W.forEach((c, i) => { const L = lanes[i]; c.o = L ? [L.x, c.o[1], (L.a + L.b) / 2] : [0, c.o[1] - 4, c.o[2]]; c.info[3] = L ? L.b - L.a : -1; }); // span -1: parked (no deck follow)
  const geo = lod.children[0].geometry, O = geo.attributes.aOrigin, I = geo.attributes.aInfo;
  for (let v = 0; v < I.count; v++) { if (I.getX(v) !== 1) continue; const ph = I.getZ(v), c = W.find(w => Math.abs(w.info[2] - ph) < 1e-5); if (c) { O.setXYZ(v, c.o[0], c.o[1], c.o[2]); I.setW(v, c.info[3]); } }
  O.needsUpdate = I.needsUpdate = true; return W.length;
}
// [v112] Raul: main.js gives the v4 crew bake 8 s; on a slow phone the first ships are built before it lands and kept the procedural
// crew forever. When initCrewV4 resolves late, every crew mesh built without it is rebuilt here: new v4 geometry + a v4-pivot shader
// (same uniforms object, so ship.userData.crew / fire / hit anims keep working), still one draw call. Gear re-dress follows (crewGear.js).
export function rebakeCrewV4(root) {
  if (!V4 || !root) return 0; const lods = []; _scope = null;
  root.traverse((o) => { if (o.isLOD && o.userData.seats && !o.userData.v4) lods.push(o); });
  for (const lod of lods) {
    const mesh = lod.children[0]; if (!mesh?.isMesh) continue; const om = mesh.material, nm = crewMaterial();
    nm.uniforms = om.uniforms; mesh.material = nm; om.dispose();
    const old = mesh.geometry, geo = crewGeo(lod.userData.seats, null, ''); geo.boundingSphere = old.boundingSphere ? old.boundingSphere.clone() : new THREE.Sphere(new THREE.Vector3(0, 1, 0), 30);
    mesh.geometry = geo; old.dispose(); lod.userData.gearTag = ''; lod.userData.v4 = true;
    if (lod.userData.outfit) dressCrew(lod.parent, lod.userData.outfit);
  }
  return lods.length;
}
export const crewGearTag = (body) => { const lod = crewLodOf(body); return lod?.userData.seats ? (lod.userData.gearTag || '') : null; };
// [v84] the SPY TOWER lookout: one more pirate with a brass telescope, merged into the ship's existing crew mesh (no extra
// draw call; same LOD cull distance as the deck crew, on every quality incl. Low). `at` = { x, y, z } platform centre on the
// floor (body space), r = patrol radius, size = pirate height scale (crew are 1.35).
const BRASS = C(0xd9b25a), DARK = C(0x2a1a0e);
let _scope = null;
function scopeGeo() {
  if (_scope) return _scope;
  const out = [], seg = 6, add = (g, col, pos) => {
    g = g.toNonIndexed(); g.rotateX(Math.PI / 2); g.translate(...pos);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(5), 1)); noUv(g); out.push(g);
  };
  const x = 0.13, y = V4 ? V4.eyeY : 0.97; // at the right eye, pointing out along +Z
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.08, seg), DARK, [x, y, 0.22]);   // eyepiece
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.2, seg), BRASS, [x, y, 0.36]);   // draw tube
  add(new THREE.CylinderGeometry(0.06, 0.055, 0.24, seg), BRASS, [x, y, 0.57]);  // barrel
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.05, seg), DARK, [x, y, 0.7]);     // objective ring
  _scope = mergeGeometries(out, false); out.forEach(o => o.dispose()); return _scope;
}
export function addLookout(ship, body, { at, r = 0.8, size = 0.9, v = 5 }) {
  let lod = crewLodOf(body);
  const g = mergeGeometries([seat(v).clone(), scopeGeo().clone()], false), n = g.attributes.position.count;
  const O = new Float32Array(n * 3), I = new Float32Array(n * 4), info = [2, r, hash(v * 9.7 + at.z), size / (lod ? lod.children[0].material.uniforms.uS.value : 1.35)];
  for (let i = 0; i < n; i++) { O.set([at.x, at.y, at.z], i * 3); I.set(info, i * 4); }
  g.setAttribute('aOrigin', new THREE.BufferAttribute(O, 3)); g.setAttribute('aInfo', new THREE.BufferAttribute(I, 4));
  const reach = Math.hypot(at.y, at.z) + 3, seatRec = { v, pose: 'idle', scope: true, o: [at.x, at.y, at.z], info };
  if (lod) { lod.userData.seats?.push(seatRec);
    const mesh = lod.children[0], old = mesh.geometry, geo = mergeGeometries([old, g], false); g.dispose();
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), Math.max(old.boundingSphere?.radius || 30, reach));
    mesh.geometry = geo; old.dispose(); return lod;
  }
  const mat = crewMaterial(), mesh = new THREE.Mesh(g, mat); mat.uniforms.uS.value = 1.35; info[3] = size / 1.35;
  g.attributes.aInfo.array.forEach((_, i, a) => { if (i % 4 === 3) a[i] = info[3]; });
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), Math.max(30, reach)); mesh.userData.crewMesh = true;
  mesh.onBeforeRender = (rr, sc, cam) => { _sv.copy(_sun).transformDirection(cam.matrixWorldInverse); mat.uniforms.uSunV.value.copy(_sv); };
  lod = new THREE.LOD(); lod.addLevel(mesh, 0); lod.addLevel(new THREE.Object3D(), Q === 'low' || PHONE ? 80 : Q === 'medium' ? 55 : 95); lod.userData.seats = [seatRec]; lod.userData.v4 = !!V4;
  ship.userData.crew = ship.userData.crew || mat.uniforms; body.add(lod); return lod;
}
// [v85] OUTFITS: the crew (deck gunners, walkers, spy tower lookout) dress in their ship's skin colours. The crew mesh keeps
// vertex colours, so this only rewrites that ship's colour buffer (same material, same single draw call, Low + phones too).
// Per skin: coat = [red-coat, striped-tee, white-shirt] variants, hat = [black, brown] variants, pants, accent (belt + tee band).
// 'classic' (and any skin not listed) keeps the original red coats.
const BELT = C(0x1a1208), BAND = C(0xeeeeee);
const OUTFIT = {
  parchment: { coat: [0xc9a25a, 0x7a4a22, 0xe8d3a2], hat: [0x8a5a32, 0x5a3a22], pants: 0x6a4424, accent: 0xffcd77 },
  blood:     { coat: [0x9e0c0c, 0x161616, 0xd21a1a], hat: [0x9e0c0c, 0x161616], pants: 0x2a0606, accent: 0xfa0d0d },
  midnight:  { coat: [0x1a1d22, 0x0d0d12, 0x8a96a4], hat: [0x0b0b0b, 0x2a2f3a], pants: 0x0b0806, accent: 0xb8c2cc },
  navy:      { coat: [0x1b2f6b, 0x101c44, 0xefe6cf], hat: [0x1b2f6b, 0x101c44], pants: 0xdcd2b8, accent: 0xffcd77 },
  degen:     { coat: [0x1f6b37, 0x0f2a18, 0x4ee37a], hat: [0x1f8a44, 0x0f2a18], pants: 0x0b120d, accent: 0x4ee37a },
  ghost:     { coat: [0xbfe3d2, 0x8fbfaa, 0xeef8f2], hat: [0xa8d8c4, 0x6f9488], pants: 0x6f9488, accent: 0x7dffa8 },
  golden:    { coat: [0xffc94a, 0xc9a25a, 0xffe6a8], hat: [0xe0a81e, 0xb8860b], pants: 0x7a5a1a, accent: 0xfff1b8 },
  seagreen:  { coat: [0x2ec4a0, 0x0f3a2c, 0x9ff0d8], hat: [0x22a888, 0x0f3a2c], pants: 0x123326, accent: 0x5cf2c4 },
  kraken:    { coat: [0x5a2a8a, 0x1a0f2a, 0x3fb59a], hat: [0x6a2fa0, 0x1a0f2a], pants: 0x14302a, accent: 0x3fb59a },
  storm:     { coat: [0x5a6470, 0x2a3038, 0xe8eef5], hat: [0x4a5868, 0x2a3038], pants: 0x2a3a52, accent: 0x8fd4ff },
  coral:     { coat: [0xff7a5c, 0x1f6b5a, 0xffc2a8], hat: [0xe8604a, 0x1f4a40], pants: 0x1f4a40, accent: 0xffd2a0 },
  admiral:   { coat: [0x14234f, 0xf4f4f4, 0xffffff], hat: [0x14234f, 0xf4f4f4], pants: 0xf2f2f2, accent: 0xffcd77 },
  flaming:   { coat: [0xff5a14, 0x2a0a04, 0xffb03a], hat: [0xd8360a, 0x1a0804], pants: 0x3a1206, accent: 0xffd23a },
  diamond:   { coat: [0xbfe8ff, 0x6ab8e0, 0xeefaff], hat: [0x8fd0f2, 0x4a7a9a], pants: 0x3a5a7a, accent: 0xffffff },
};
// [v87] HATS per skin: [crown, brim, band] for the black-hat and brown-hat variants + the skull badge colour.
// (The crew shader now ends with <colorspace_fragment>: without it, phones / Low / Medium (no post-processing OutputPass)
// showed the linear vertex colours raw, so every palette colour came out far darker: coral hats read red, gold brown,
// navy black. Desktop High was already right; now every quality shows the same colours.)
const HATS = {
  parchment: { a: [0xd8b47a, 0xb8925a, 0x5a3a22], b: [0x8a5e36, 0x6e4a2a, 0xe8d3a2], skull: 0xfff4dc },
  blood:     { a: [0xa81414, 0x7a0c0c, 0x111111], b: [0x1e1e1e, 0x141414, 0xe01e1e], skull: 0xffffff },
  midnight:  { a: [0x3a4258, 0x2a3044, 0xc8d2dc], b: [0x23283a, 0x181c2a, 0x8a9ab0], skull: 0xdfe6ee },
  navy:      { a: [0x2c4ca8, 0x1f3a86, 0xffcd77], b: [0x1d3270, 0x15265a, 0xefe6cf], skull: 0xffffff },
  degen:     { a: [0x36d468, 0x22a04c, 0x0b120d], b: [0x186a32, 0x104a22, 0x4ee37a], skull: 0xffffff },
  ghost:     { a: [0xe6f8ee, 0xc8eadb, 0x5ad88a], b: [0xbfe0d2, 0xa2cbba, 0xeef8f2], skull: 0x2a4a3e },
  golden:    { a: [0xffc414, 0xe09a00, 0x6a3c08], b: [0xf0b000, 0xc88a00, 0xfff1b8], skull: 0x3a2408 },
  seagreen:  { a: [0x44e6bf, 0x26b892, 0x0f3a2c], b: [0x1d7a60, 0x145a46, 0x9ff0d8], skull: 0xffffff },
  kraken:    { a: [0x3fc4a2, 0x2a967a, 0x7a3ab8], b: [0x22806a, 0x175a4a, 0xa66ae0], skull: 0xffffff },
  storm:     { a: [0x9aa8b8, 0x7a8898, 0x8fd4ff], b: [0x56667a, 0x404c5c, 0xe8eef5], skull: 0xffffff },
  coral:     { a: [0xffa98a, 0xff9070, 0x1f7a68], b: [0xffc8b0, 0xffb294, 0x2a9a84], skull: 0x1f4a40 },
  admiral:   { a: [0x22387e, 0x182a62, 0xffcc33], b: [0x1a2c66, 0x122050, 0xffd700], skull: 0xffffff },
  flaming:   { a: [0xff6a1a, 0xffb020, 0x8a1a04], b: [0xff4410, 0xff8c14, 0xffd23a], skull: 0xfff2c0 },
  diamond:   { a: [0xdaf6ff, 0xaee4ff, 0x4aa8e0], b: [0xa2dcfa, 0x82c8f0, 0xffffff], skull: 0x2a5a7a },
};
const _key = (r, g, b) => `${Math.round(r * 4095)},${Math.round(g * 4095)},${Math.round(b * 4095)}`;
const _maps = new Map();
function outfitMap(id) {
  if (_maps.has(id)) return _maps.get(id);
  const o = OUTFIT[id]; let m = null;
  if (o) { m = new Map(); const put = (from, hex) => { if (from) m.set(_key(from.r, from.g, from.b), C(hex)); };
    COAT.forEach((c, i) => put(c, o.coat[i])); HAT.forEach((c, i) => put(c, o.hat[i])); put(PANTS, o.pants); put(BELT, o.accent); put(BAND, o.accent);
    const h = HATS[id]; if (h) { const hp = (from, hex) => m.set(_key(from.r, from.g, from.b), C(hex));
      [h.a, h.b].forEach((v, i) => { hp(HAT[i], v[0]); hp(HAT_BRIM[i], v[1]); hp(HAT_BAND[i], v[2]); }); hp(SKULL, h.skull); } }
  _maps.set(id, m); return m;
}
export const outfitIds = () => Object.keys(OUTFIT);
// recolour the crew of one built ship (body = ship.userData.body or the ship). Always maps from the ORIGINAL colours, so it is safe to re-run.
export function dressCrew(body, skinId) {
  const lod = crewLodOf(body); if (!lod) return false;
  const geo = lod.children[0].geometry, col = geo.attributes.color; if (!col) return false;
  const a = col.array, base = geo.userData.baseColor || (geo.userData.baseColor = a.slice()), m = outfitMap(skinId);
  for (let i = 0; i < a.length; i += 3) { const t = m && m.get(_key(base[i], base[i + 1], base[i + 2]));
    if (t) { a[i] = t.r; a[i + 1] = t.g; a[i + 2] = t.b; } else { a[i] = base[i]; a[i + 1] = base[i + 1]; a[i + 2] = base[i + 2]; } }
  col.needsUpdate = true; lod.userData.outfit = skinId; return true;
}
// a broadside from `side` ('port' | 'star'): that side's gun crews recoil, then ram and reload
// [v87] the ship took a hit: the crew stagger (k 0..1, bigger hit = bigger reaction; a fresh hit never shrinks a running one)
// the crew uniforms of a ship (buildShip replaces ship.userData after addCrew, so look the crew mesh up on the body)
function crewU(mesh) { const ud = mesh?.userData; if (!ud) return null; if (ud.crew?.uHit) return ud.crew;
  let cm = null; (ud.body || mesh).traverse?.(o => { if (!cm && o.userData?.crewMesh) cm = o; }); const U = cm?.material?.uniforms || null;
  if (U) ud.crew = U; return U; }
export function crewHit(mesh, k = 0.5) { const U = crewU(mesh); if (!U?.uHit) return; const t = wind.uTime.value, run = t - U.uHit.value < 0.5 ? U.uHitK.value : 0;
  U.uHit.value = t; U.uHitK.value = Math.min(1, Math.max(0.35, k, run)); }
// [v95] helm input (-1..1, ship.turn) -> the wheel + captain, smoothed (every ship: yours, AI, remote pirates)
export { crewU };
export function crewSteer(mesh, turn, dt) { const U = crewU(mesh); if (!U?.uSteer) return; const t = Math.max(-1, Math.min(1, -(turn || 0)));
  U.uSteer.value += (t - U.uSteer.value) * Math.min(1, dt * 6); }
export function crewFire(mesh, side) { const U = crewU(mesh); if (U) U[side === 'port' ? 'uFireP' : 'uFireS'].value = wind.uTime.value; }
