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

let Q = 'high', PHONE = false;
export function setCrewQuality(q, phone = false) { Q = q; PHONE = phone; }

const C = (h) => new THREE.Color(h);
const SKIN = [C(0xf2c9a0), C(0xe0ac7e), C(0x8a5a3c), C(0xf5f0ea)], BEARD = [C(0x1a1410), C(0xd9b25a), C(0x39ff6a), C(0x7a4a22)];
const COAT = [C(0xc4161c), C(0x2a2f3a), C(0xf2f2f2), null], HAT = [C(0x131313), C(0x5a3a22)];
// [v87] separate keys for the hat parts (brim 1-step hex offset, invisible) · [v90] classic band is the reference's tan
const HAT_BRIM = [C(0x131314), C(0x5a3a23)], HAT_BAND = [C(0xc8a060), C(0xc8a062)], SKULL = C(0xfefefe);
const PANTS = C(0x2b2018), WHITE = C(0xffffff), IRON = C(0xc9ccd2), WOOD = C(0x6a4026);
const hash = (i) => ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;

// [v90] PUMPFUN PIRATES crew, smooth chibi rebuild after the official crew art (crew_reference_pirate): big round head, black
// tricorn with the white skull badge and a tan band, eye patch + strap and one big blue eye, angry brows, shaggy blond hair and
// full beard, open shouting mouth, open red coat over a black-and-white striped shirt, a fist and a wooden-cuffed hook, dark
// pants + boots. Rounded geometry (spheres / lathes / tapered tubes, smooth normals) so the toon bands + ink rim read soft.
// Same skeleton as before (faces +Z, feet y=0, ~1.3 tall; parts 0 body/head, 1/2 legs at the hip, 3/4 arms at the shoulder),
// so every animation (gunner idle / recoil, walkers, lookout telescope, cheers, hit stagger) is unchanged. lo = Low / phones.
const _pc = new Map();
const BOOT = C(0x2a1a10), STRIPE_K = C(0x161616), MOUTH = C(0x3a0a0a), TONGUE = C(0xe0707a), EYE_W = C(0xffffff), IRIS = C(0x3a8ae0), PUPIL = C(0x0b0b0b), BROW = C(0x6a4a1a), PATCH = C(0x0b0b0b);
function pirate(v, lo = false) {
  const key = v + (lo ? 'L' : 'H'); if (_pc.has(key)) return _pc.get(key);
  const r = (k) => hash(v * 7.31 + k), skin = SKIN[Math.floor(r(1) * 4)];
  const beard = r(2) < 0.55 ? BEARD[1] : BEARD[[0, 3, 1, 2][Math.floor(r(9) * 4)]]; // mostly the reference's blond
  const hv = r(3) < 0.75 ? 0 : 1, hat = HAT[hv], ci = Math.floor(r(4) * 3), coat = COAT[ci];
  const patch = r(5) < 0.6, laser = !patch && r(8) < 0.25, hook = r(6) < 0.55;
  const S = lo ? 7 : 12, s2 = lo ? 5 : 8, ring = lo ? 4 : 8; // radial segments
  const out = [];
  const add = (g, col, part, p = [0, 0, 0], rot = [0, 0, 0], sc = [1, 1, 1]) => {
    g = g.index ? g.toNonIndexed() : g;
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...sc)));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count, c = new Float32Array(n * 3), pa = new Float32Array(n).fill(part);
    for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(pa, 1)); out.push(g);
  };
  const sph = (rad, a = s2, b = Math.max(4, s2 - 3), ...ang) => new THREE.SphereGeometry(rad, a, b, ...ang);
  const cyl = (a, b, h, s = ring, open = false, t0 = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(a, b, h, s, 1, open, t0, tl);
  const lath = (pts, s = S) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), s);
  // legs: tapered trousers + rounded boots (hip pivot y 0.36)
  for (const sx of [1, -1]) { const part = sx > 0 ? 1 : 2;
    add(cyl(0.075, 0.062, 0.3, ring), PANTS, part, [sx * 0.085, 0.22, 0]);
    add(sph(0.075, ring, 5), BOOT, part, [sx * 0.085, 0.055, 0.03], [0, 0, 0], [1, 0.75, 1.45]); }
  // torso: striped shirt (stacked bands; light stripes take the skin accent), belt, open coat with flared skirt
  const nb = lo ? 4 : 6, y0 = 0.36, y1 = 0.76;
  for (let i = 0; i < nb; i++) { const a = y0 + (y1 - y0) * i / nb, b = y0 + (y1 - y0) * (i + 1) / nb, ra = 0.16 + 0.02 * Math.sin(Math.PI * i / nb), rb = 0.16 + 0.02 * Math.sin(Math.PI * (i + 1) / nb);
    add(cyl(rb, ra, b - a, lo ? 4 : 6, true, -0.8, 1.6), i % 2 ? STRIPE_K : BAND, 0, [0, (a + b) / 2, 0]); } // only the front shows between the coat lapels
  add(sph(0.165, S, 3, 0, Math.PI * 2, 0, Math.PI / 2), coat, 0, [0, y1, 0], [0, 0, 0], [1, 0.45, 1]); // shoulders
  add(cyl(0.172, 0.176, 0.05, S, true), BELT, 0, [0, 0.4, 0]);
  const gap = 1.1; // open front of the coat
  add(cyl(0.185, 0.235, 0.46, S, true, gap / 2, Math.PI * 2 - gap), coat, 0, [0, 0.54, 0]);
  add(cyl(0.15, 0.185, 0.07, S, true, gap / 2, Math.PI * 2 - gap), coat, 0, [0, 0.8, 0]); // collar
  // arms (shoulder pivot y 0.72): coat sleeves, a fist, or the wooden cuff + iron hook
  for (const sx of [1, -1]) { const part = sx > 0 ? 3 : 4, isHook = hook && sx > 0;
    add(sph(0.075, ring, 5), coat, part, [sx * 0.215, 0.72, 0]);
    add(cyl(0.07, 0.058, 0.27, ring), coat, part, [sx * 0.235, 0.58, 0], [0, 0, sx * 0.08]);
    if (isHook) { add(cyl(0.06, 0.068, 0.1, ring), WOOD, part, [sx * 0.25, 0.41, 0]);
      add(cyl(0.012, 0.016, 0.07, 5), IRON, part, [sx * 0.25, 0.33, 0]);
      add(new THREE.TorusGeometry(0.05, 0.014, 4, lo ? 6 : 10, Math.PI * 1.3), IRON, part, [sx * 0.25, 0.27, 0.035], [0, Math.PI / 2, Math.PI * 0.85]); }
    else add(sph(0.062, ring, 6), skin, part, [sx * 0.25, 0.41, 0.01], [0, 0, 0], [1, 1.1, 1]); }
  // head + ears, shaggy hair behind, full beard with an open shouting mouth
  add(sph(0.215, lo ? 9 : 12, lo ? 6 : 12), skin, 0, [0, 0.95, 0], [0, 0, 0], [1.02, 0.98, 0.96]);
  for (const sx of [1, -1]) add(sph(0.045, 6, 4), skin, 0, [sx * 0.21, 0.94, -0.01], [0, 0, 0], [0.6, 1, 0.9]);
  add(sph(0.232, S, lo ? 4 : 8, Math.PI * 0.8, Math.PI * 1.4, Math.PI * 0.3, Math.PI * 0.45), beard, 0, [0, 0.96, -0.015], [0, 0, 0], [1.03, 1.05, 1.02]); // hair: back + sides
  if (!lo) for (let i = 0; i < 5; i++) { const a = Math.PI * (0.62 + i * 0.19); add(new THREE.ConeGeometry(0.055, 0.16, 5), beard, 0, [Math.sin(a) * 0.2, 0.8, Math.cos(a) * 0.2], [0, 0, Math.PI]); } // shaggy tips hanging at the back + sides
  add(sph(0.2, S, lo ? 4 : 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), beard, 0, [0, 0.92, 0.05], [0, 0, 0], [1.08, 1.25, 1.0]); // beard volume
  add(new THREE.ConeGeometry(0.11, 0.14, lo ? 5 : 8), beard, 0, [0, 0.74, 0.12], [Math.PI + 0.35, 0, 0], [1.25, 1, 0.8]); // beard point
  add(sph(0.075, ring, 6), MOUTH, 0, [0, 0.86, 0.235], [0, 0, 0], [1.0, 0.85, 0.4]); // open mouth
  if (!lo) add(sph(0.045, 6, 4), TONGUE, 0, [0, 0.835, 0.255], [0, 0, 0], [1.1, 0.5, 0.4]);
  // face: angry brows, one big blue eye (+ eye patch and strap), or two eyes / laser eyes
  const ey = 0.99, ez = 0.19;
  for (const sx of [1, -1]) add(cyl(0.012, 0.012, 0.09, 4), BROW, 0, [sx * 0.075, ey + 0.075, ez + 0.005], [0, 0, Math.PI / 2 + sx * 0.4]);
  const eye = (sx) => { add(sph(0.05, ring, 6), EYE_W, 0, [sx * 0.075, ey, ez - 0.015], [0, 0, 0], [1, 1.15, 0.6]);
    add(sph(0.03, ring, 5), laser ? C(0xff1010) : IRIS, 0, [sx * 0.075, ey, ez + 0.012], [0, 0, 0], [1, 1.1, 0.5]);
    if (!laser) add(sph(0.015, 6, 4), PUPIL, 0, [sx * 0.075, ey, ez + 0.024], [0, 0, 0], [1, 1, 0.5]); };
  if (patch) { eye(-1); add(sph(0.06, ring, 6), PATCH, 0, [0.075, ey, ez - 0.005], [0, 0, 0], [1.05, 0.95, 0.45]);
    add(new THREE.TorusGeometry(0.215, 0.008, 3, lo ? 8 : 18), PATCH, 0, [0, ey + 0.02, -0.01], [0, 0, -0.45]); }
  else { eye(1); eye(-1); if (laser) add(cyl(0.012, 0.012, 0.6, 4), C(0xff2a2a), 0, [0.075, ey, ez + 0.32], [Math.PI / 2, 0, 0]); }
  // tricorn: domed crown, three-cornered brim turned up (front corner forward), tan band, skull + crossbones badge
  add(lath([[0.001, 0.2], [0.11, 0.195], [0.165, 0.15], [0.19, 0.06], [0.2, 0.0]], S), hat, 0, [0, 1.12, -0.005]);
  const brim = lath([[0.18, 0.0], [0.24, 0.006], [0.3, 0.025], [0.33, 0.05], [0.335, 0.07]], lo ? 12 : 24), bp = brim.attributes.position;
  for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), z = bp.getZ(i), rr = Math.hypot(x, z), a = Math.atan2(x, z), up = Math.pow(Math.max(0, Math.cos(3 * a)), 1.5); // corners at front + back sides
    const k = Math.max(0, (rr - 0.18) / 0.155); bp.setY(i, bp.getY(i) + k * k * (0.02 + 0.16 * (1 - up))); bp.setX(i, x * (1 - 0.25 * k * (1 - up))); bp.setZ(i, z * (1 - 0.25 * k * (1 - up))); }
  brim.computeVertexNormals(); add(brim, HAT_BRIM[hv], 0, [0, 1.11, 0]);
  add(cyl(0.203, 0.207, 0.05, S, true), HAT_BAND[hv], 0, [0, 1.145, -0.005]);
  add(sph(0.05, ring, 6), SKULL, 0, [0, 1.24, 0.19], [-0.25, 0, 0], [1, 0.95, 0.45]);
  for (const sx of [1, -1]) add(cyl(0.011, 0.011, 0.15, 4), SKULL, 0, [0, 1.235, 0.185], [-0.25, 0, Math.PI / 2 + sx * 0.6]);
  const g = mergeGeometries(out, false); out.forEach(o => o.dispose()); _pc.set(key, g); return g;
}

const VERT = `attribute vec3 color; attribute float aPart; attribute vec3 aOrigin; attribute vec4 aInfo;
uniform float uT; uniform float uFireP; uniform float uFireS; uniform float uS; uniform float uHit; uniform float uHitK;
varying vec3 vC; varying vec3 vN; varying vec3 vV;
#include <fog_pars_vertex>
vec3 rotX(vec3 p, vec3 pv, float a){ p -= pv; float c = cos(a), s = sin(a); return pv + vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
vec3 rotZ(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }
void main(){
  vec3 p = position, n = normal; float role = aInfo.x, sx = aInfo.y, ph = aInfo.z, span = aInfo.w;
  vec3 o = aOrigin; float yaw, leg = 0.0, arm = 0.0, lean = 0.0, bob = 0.0, look = 0.0;
  if (role < 0.5) { // gunner beside its cannon, facing outboard
    yaw = sx * 1.5708;
    float tf = uT - (sx > 0.0 ? uFireP : uFireS);
    float rec = (tf >= 0.0 && tf < 0.55) ? sin(tf / 0.55 * 3.14159) : 0.0;
    float load = (tf >= 0.45 && tf < 2.6) ? sin((tf - 0.45) * 7.0) * smoothstep(2.6, 1.9, tf) : 0.0;
    lean = -0.38 * rec + 0.03 * sin(uT * 1.7 + ph);
    arm = -1.3 * rec - 0.9 * abs(load) - 0.15;
    bob = 0.015 * sin(uT * 2.1 + ph);
  } else if (role > 1.5) { // [v84] spy tower lookout: walks the platform rim, stops, faces the sea, raises the telescope and sweeps it
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
    o.z += span * (0.5 - tri); yaw = s < 0.5 ? 3.14159 : 0.0;
    float w = sin(uT * 7.5 + ph * 6.28);
    leg = w * 0.55; arm = -w * 0.5; bob = abs(w) * 0.035;
  }
  // [v87] REACTIONS. Hit: every pirate staggers (crouch, wobble, arms over the head; the lookout grabs the rail), staggered per
  // pirate, scaled by the hit size (uHitK). Fire: walkers + the lookout sometimes cheer / fist-pump after a broadside.
  float roll = 0.0, hop = 0.0;
  if (role < 0.5) { float tf0 = uT - (sx > 0.0 ? uFireP : uFireS); hop = (tf0 >= 0.0 && tf0 < 0.7) ? sin(tf0 / 0.7 * 3.14159) * 0.16 : 0.0; } // gunner hops back from the recoil
  else { float tc = uT - max(uFireP, uFireS) - 0.35 - ph * 0.3, cheer = step(0.45, fract(sin(ph * 91.7 + floor(max(uFireP, uFireS)) * 3.1) * 437.5));
    float ch = cheer * smoothstep(0.0, 0.2, tc) * (1.0 - smoothstep(1.2, 1.6, tc));
    arm = mix(arm, -2.7 + 0.35 * sin(uT * 14.0 + ph * 5.0), ch); leg *= 1.0 - ch; look *= 1.0 - ch; bob += ch * abs(sin(uT * 9.0 + ph)) * 0.08; }
  float th = uT - uHit - ph * 0.25;
  float hr = (th >= 0.0 && th < 1.4) ? uHitK * smoothstep(0.0, 0.12, th) * (1.0 - smoothstep(0.4, 1.4, th)) : 0.0;
  if (hr > 0.001) {
    roll = hr * 0.32 * sin(th * 13.0 + ph * 6.28); lean += hr * 0.3 * sin(th * 9.0 + ph * 3.0) - hr * 0.15; bob -= hr * 0.16;
    if (role > 1.5) { look *= 1.0 - min(1.0, hr * 2.0); arm = mix(arm, -1.45, min(1.0, hr * 2.0)); leg *= 1.0 - hr; } // lookout grabs the rail
    else { arm = mix(arm, -2.9, min(1.0, hr * 1.6)); leg = mix(leg, 0.35 * sin(th * 12.0 + ph * 4.0), min(1.0, hr * 1.6)); } // arms over the head, stumbling feet
  }
  if (aPart > 0.5 && aPart < 1.5) p = rotX(p, vec3(0.0, 0.36, 0.0), leg);
  else if (aPart > 1.5 && aPart < 2.5) p = rotX(p, vec3(0.0, 0.36, 0.0), -leg);
  else if (aPart > 2.5 && aPart < 3.5) p = rotX(p, vec3(0.0, 0.72, 0.0), mix(arm, -2.25, look));
  else if (aPart > 3.5 && aPart < 4.5) p = rotX(p, vec3(0.0, 0.72, 0.0), mix(role < 0.5 ? arm : -arm, -1.35, look));
  else if (aPart > 4.5) { // telescope: modelled at the eye; held in the right hand (tilted down-forward) until raised
    float ra = mix(arm, -2.25, look) + 2.25, ta = -1.47 * (1.0 - look);
    p = rotX(rotX(p, vec3(0.0, 0.92, 0.25), ta), vec3(0.0, 0.72, 0.0), ra); n = rotX(rotX(n, vec3(0.0), ta), vec3(0.0), ra); }
  p.z -= hop; p = rotZ(rotX(p, vec3(0.0), lean), roll) * uS * (role > 1.5 ? span : 1.0); n = rotZ(rotX(n, vec3(0.0), lean), roll);
  float c = cos(yaw), si = sin(yaw);
  p = vec3(p.x * c + p.z * si, p.y + bob, -p.x * si + p.z * c) + o; n = vec3(n.x * c + n.z * si, n.y, -n.x * si + n.z * c);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vC = color; vN = normalize(normalMatrix * n); vV = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = `uniform vec3 uSunV; varying vec3 vC; varying vec3 vN; varying vec3 vV;
#include <fog_pars_fragment>
void main(){ vec3 N = normalize(vN); float d = dot(N, normalize(uSunV));
  float band = d > 0.35 ? 1.0 : (d > -0.1 ? 0.78 : 0.58);
  float rim = 1.0 - clamp(dot(N, normalize(vV)), 0.0, 1.0);
  vec3 col = vC * band * (rim > 0.78 ? 0.25 : 1.0); // inked silhouette edge (bold-outline NFT look) without an outline mesh
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const _sun = new THREE.Vector3(0.45, 0.8, 0.35).normalize(), _sv = new THREE.Vector3();
function crewMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uFireP: { value: -99 }, uFireS: { value: -99 }, uHit: { value: -99 }, uHitK: { value: 0 }, uS: { value: 1 }, uSunV: { value: new THREE.Vector3() } }]),
    vertexShader: VERT, fragmentShader: FRAG, fog: true,
  });
  m.uniforms.uT = wind.uTime; // shared clock: every client animates the same way
  return m;
}

// ship: buildShip group. gunSlots: [{x, y, z, sx}] gun positions on the deck (body space). deck: {z0, z1, y, x}
export function addCrew(ship, { guns = [], walk = null, boss = false } = {}) {
  // [v82] phones + LOW keep a gunner at EVERY cannon (BANKSY). Cheap tier: gunners only (no walkers), the same single
  // merged draw call per ship, no shadows; desktop Medium keeps one gunner per gun pair.
  const lite = Q === 'low', med = PHONE || Q === 'medium';
  const crew = []; let k = 0;
  const gun = med && !PHONE && !lite ? guns.filter((g, i) => i % 2 === 0) : guns;
  for (const g of gun) crew.push({ v: k++, o: [g.x - g.sx * 0.95, g.y, g.z + 0.55], info: [0, g.sx, hash(k * 3.3), 0] });
  if (walk && !lite) { const n = med ? 2 : 3; for (let i = 0; i < n; i++) crew.push({ v: k++, o: [(i % 2 ? -0.75 : 0.75), walk.y, walk.z0 + (walk.z1 - walk.z0) * 0.5], info: [1, 0, hash(i * 5.1 + 2), Math.max(1, walk.z1 - walk.z0) * (0.85 - i * 0.12)] }); }
  if (!crew.length) return null;
  const parts = crew.map(c => { const g = pirate(c.v % 12, lite || PHONE).clone(), n = g.attributes.position.count;
    const O = new Float32Array(n * 3), I = new Float32Array(n * 4); for (let i = 0; i < n; i++) { O.set(c.o, i * 3); I.set(c.info, i * 4); }
    g.setAttribute('aOrigin', new THREE.BufferAttribute(O, 3)); g.setAttribute('aInfo', new THREE.BufferAttribute(I, 4)); return g; });
  const geo = mergeGeometries(parts, false); parts.forEach(p => p.dispose());
  const s = boss ? 1.6 : 1.35; // chibi pirates read above the bulwark (deck to rail top is ~1.1)
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 30);
  const mat = crewMaterial(), mesh = new THREE.Mesh(geo, mat); mat.uniforms.uS.value = s; mesh.frustumCulled = true; mesh.userData.crewMesh = true;
  mesh.onBeforeRender = (r, sc, cam) => { _sv.copy(_sun).transformDirection(cam.matrixWorldInverse); mat.uniforms.uSunV.value.copy(_sv); };
  const lod = new THREE.LOD(); lod.addLevel(mesh, 0); lod.addLevel(new THREE.Object3D(), lite || PHONE ? 80 : med ? 55 : 95); // phones zoom out to ~120: keep your own gunners in view lod.userData.crew = true;
  ship.userData.crew = mat.uniforms;
  return lod;
}
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
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(5), 1)); out.push(g);
  };
  const x = 0.13, y = 0.97; // at the right eye, pointing out along +Z
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.08, seg), DARK, [x, y, 0.22]);   // eyepiece
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.2, seg), BRASS, [x, y, 0.36]);   // draw tube
  add(new THREE.CylinderGeometry(0.06, 0.055, 0.24, seg), BRASS, [x, y, 0.57]);  // barrel
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.05, seg), DARK, [x, y, 0.7]);     // objective ring
  _scope = mergeGeometries(out, false); out.forEach(o => o.dispose()); return _scope;
}
export function addLookout(ship, body, { at, r = 0.8, size = 0.9, v = 5 }) {
  let lod = body.children.find(o => o.isLOD && o.children[0]?.userData?.crewMesh) || null;
  const g = mergeGeometries([pirate(v, Q === 'low' || PHONE).clone(), scopeGeo().clone()], false), n = g.attributes.position.count;
  const O = new Float32Array(n * 3), I = new Float32Array(n * 4), info = [2, r, hash(v * 9.7 + at.z), size / (lod ? lod.children[0].material.uniforms.uS.value : 1.35)];
  for (let i = 0; i < n; i++) { O.set([at.x, at.y, at.z], i * 3); I.set(info, i * 4); }
  g.setAttribute('aOrigin', new THREE.BufferAttribute(O, 3)); g.setAttribute('aInfo', new THREE.BufferAttribute(I, 4));
  const reach = Math.hypot(at.y, at.z) + 3;
  if (lod) {
    const mesh = lod.children[0], old = mesh.geometry, geo = mergeGeometries([old, g], false); g.dispose();
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), Math.max(old.boundingSphere?.radius || 30, reach));
    mesh.geometry = geo; old.dispose(); return lod;
  }
  const mat = crewMaterial(), mesh = new THREE.Mesh(g, mat); mat.uniforms.uS.value = 1.35; info[3] = size / 1.35;
  g.attributes.aInfo.array.forEach((_, i, a) => { if (i % 4 === 3) a[i] = info[3]; });
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), Math.max(30, reach)); mesh.userData.crewMesh = true;
  mesh.onBeforeRender = (rr, sc, cam) => { _sv.copy(_sun).transformDirection(cam.matrixWorldInverse); mat.uniforms.uSunV.value.copy(_sv); };
  lod = new THREE.LOD(); lod.addLevel(mesh, 0); lod.addLevel(new THREE.Object3D(), Q === 'low' || PHONE ? 80 : Q === 'medium' ? 55 : 95);
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
  const lod = body?.children?.find(o => o.isLOD && o.children[0]?.userData?.crewMesh); if (!lod) return false;
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
export function crewFire(mesh, side) { const U = crewU(mesh); if (U) U[side === 'port' ? 'uFireP' : 'uFireS'].value = wind.uTime.value; }
