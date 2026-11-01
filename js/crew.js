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
const PANTS = C(0x2b2018), WHITE = C(0xffffff), IRON = C(0xc9ccd2), WOOD = C(0x6a4026);
const hash = (i) => ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;

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
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(pa, 1)); out.push(g);
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), sph = (rad, a = 8, b = 6) => new THREE.SphereGeometry(rad, a, b), cyl = (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s);
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
  add(cyl(0.33, 0.33, 0.04, 10), hat, 0, [0, 1.1, 0], [0, 0, 0], [1, 1, 0.8]);
  add(cyl(0.17, 0.22, 0.2, 10), hat, 0, [0, 1.21, 0]);
  add(sph(0.055, 6, 4), WHITE, 0, [0, 1.22, 0.2], [0, 0, 0], [1, 1, 0.4]);
  add(box(0.15, 0.025, 0.02), WHITE, 0, [0, 1.17, 0.205], [0, 0, 0.5]); add(box(0.15, 0.025, 0.02), WHITE, 0, [0, 1.17, 0.205], [0, 0, -0.5]);
  const g = mergeGeometries(out, false); out.forEach(o => o.dispose()); _pc.set(v, g); return g;
}

const VERT = `attribute vec3 color; attribute float aPart; attribute vec3 aOrigin; attribute vec4 aInfo;
uniform float uT; uniform float uFireP; uniform float uFireS; uniform float uS;
varying vec3 vC; varying vec3 vN; varying vec3 vV;
#include <fog_pars_vertex>
vec3 rotX(vec3 p, vec3 pv, float a){ p -= pv; float c = cos(a), s = sin(a); return pv + vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
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
  if (aPart > 0.5 && aPart < 1.5) p = rotX(p, vec3(0.0, 0.36, 0.0), leg);
  else if (aPart > 1.5 && aPart < 2.5) p = rotX(p, vec3(0.0, 0.36, 0.0), -leg);
  else if (aPart > 2.5 && aPart < 3.5) p = rotX(p, vec3(0.0, 0.72, 0.0), mix(arm, -2.25, look));
  else if (aPart > 3.5 && aPart < 4.5) p = rotX(p, vec3(0.0, 0.72, 0.0), mix(role < 0.5 ? arm : -arm, -1.35, look));
  else if (aPart > 4.5) { // telescope: modelled at the eye; held in the right hand (tilted down-forward) until raised
    float ra = mix(arm, -2.25, look) + 2.25, ta = -1.47 * (1.0 - look);
    p = rotX(rotX(p, vec3(0.0, 0.92, 0.25), ta), vec3(0.0, 0.72, 0.0), ra); n = rotX(rotX(n, vec3(0.0), ta), vec3(0.0), ra); }
  p = rotX(p, vec3(0.0), lean) * uS * (role > 1.5 ? span : 1.0); n = rotX(n, vec3(0.0), lean);
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
  #include <fog_fragment>
}`;
const _sun = new THREE.Vector3(0.45, 0.8, 0.35).normalize(), _sv = new THREE.Vector3();
function crewMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uFireP: { value: -99 }, uFireS: { value: -99 }, uS: { value: 1 }, uSunV: { value: new THREE.Vector3() } }]),
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
  const parts = crew.map(c => { const g = pirate(c.v % 12).clone(), n = g.attributes.position.count;
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
  const g = mergeGeometries([pirate(v).clone(), scopeGeo().clone()], false), n = g.attributes.position.count;
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
const _key = (r, g, b) => `${Math.round(r * 4095)},${Math.round(g * 4095)},${Math.round(b * 4095)}`;
const _maps = new Map();
function outfitMap(id) {
  if (_maps.has(id)) return _maps.get(id);
  const o = OUTFIT[id]; let m = null;
  if (o) { m = new Map(); const put = (from, hex) => { if (from) m.set(_key(from.r, from.g, from.b), C(hex)); };
    COAT.forEach((c, i) => put(c, o.coat[i])); HAT.forEach((c, i) => put(c, o.hat[i])); put(PANTS, o.pants); put(BELT, o.accent); put(BAND, o.accent); }
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
export function crewFire(mesh, side) { const U = mesh?.userData?.crew; if (U) U[side === 'port' ? 'uFireP' : 'uFireS'].value = wind.uTime.value; }
