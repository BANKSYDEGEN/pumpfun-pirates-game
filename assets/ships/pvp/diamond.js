// [Raul] PvP DIAMOND skin, unlocks at DIAMOND_KILLS (5000) lifetime player kills. PUMPFUN PIRATES PvP.
// A ship cut from diamond: angular low-poly gem hull, crystal prow gem, crystal shard spikes on the masts,
// yard tips and gunwales, crystal masts / yards, very shiny facets (fake env reflection + specular + fresnel rim
// + prismatic rainbow edge flashes + star twinkles) and a light sparkle trail in the wake.
// Cool ice-blue / white / prism only, nothing warm, so it never reads like the 2500-kill Flaming Ship.
//
// Uses the parts-override API in ./partsOverride.js (materialFx + partsOverride). Hitbox is untouched.
// Phone cost: no post-processing, no textures, no per-frame JS. Draw calls: +3 (crystal shell, gem, shell outline)
// -2 (base hull + its outline hidden) +1 sparkle trail Points +1 distance flares/aura Points = net +3. Extra tris ~1.1k. Geometry and
// materials are built once per hull size and cached. Low quality: 14 trail sparkles + 4 flares, high: 40 + 7.
// Every ship (local or remote) animates on the shared wind clock and its own speed: see diamondTick().
import * as THREE from 'three';
import { wind } from '../../../js/ships.js';
import { toon, outlineFor, outlineMat } from '../../../js/toon.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { liftRig, signatureWake } from './pvpKit.js';

// change the unlock tier here only
export const DIAMOND_KILLS = 5000;

export const DIAMOND = {
  id: 'diamond', name: 'DIAMOND', killsRequired: DIAMOND_KILLS, price: 0, premium: 'pvp',
  blurb: `${DIAMOND_KILLS} kills. A ship cut from pure diamond. Every facet glitters.`,
  palette: { seed: 171, wood: 0x2a3aa8, band: 0x101a5a, stripe: 0x7fe0ff, band2: 0x3a2a9a, tar: 0x0a0c2a, trim: 0xdff4ff, sail: 0x4a68d8, patch: [0x3a54c0, 0x6a84f0], hem: 0x9fe8ff, lantern: 0xbff0ff, window: 0xd8f6ff, stripes: 0x7a5ae0 },
  sail: { bg: '#3d5cd0', badge: '#0a1040', lines: 'rgba(160,220,255,0.10)', border: '#9fe8ff' },
  flag: { bg: '#24318f', badge: '#0a1040', border: '#9fe8ff' },
  parts: { oak: 0x2a3aa8, plank: 0x3a4cc0, deck: 0x5a70d8, iron: 0x1a1f5a, gold: 0xcfeeff, glow: 0xbff0ff },
  swatch: { hull: '#22309a', band: '#101a5a', stripe: '#7fe0ff', sail: '#3d5cd0', trim: '#8fc8ff', diamond: true },
};

// ---------- gem shading (shared by every diamond material) ----------
// Facet tones: each flat facet hashes to deep indigo / sapphire / blue-violet / near-white (a cut gem, not frost).
// Edges: GPU edge detect on the flat normal (fwidth) paints thin cyan / magenta / yellow prism lines on facet rims.
// Plus a hard sun-glint hotspot, a bright fresnel rim, a horizon streak, and 3D star twinkles.
const VERT_HEAD = '#include <common>\nvarying vec3 vDiaW;';
const VERT_BODY = '#include <worldpos_vertex>\nvDiaW = (modelMatrix * vec4(transformed, 1.0)).xyz;';
const FRAG_HEAD = `#include <common>
varying vec3 vDiaW; uniform float uDiaT; uniform float uDiaK; uniform float uDiaFacet;
float diaHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 diaPrism(float h){ h = fract(h); return h < 0.333 ? vec3(0.1, 1.0, 1.0) : (h < 0.666 ? vec3(1.0, 0.15, 0.95) : vec3(1.0, 0.95, 0.1)); }`;
const FRAG_COLOR = `#include <color_fragment>
{ vec3 fn = normalize(cross(dFdx(vDiaW), dFdy(vDiaW)));
  float fh = diaHash(floor(fn * (uDiaFacet > 0.9 ? 5.0 : 2.5) + 5.0) + 0.37);
  vec3 tone = fh < 0.3 ? vec3(0.02, 0.03, 0.17) : (fh < 0.62 ? vec3(0.05, 0.17, 0.78) : (fh < 0.76 ? vec3(0.24, 0.13, 0.68) : vec3(0.85, 0.93, 1.0)));
  float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  diffuseColor.rgb = mix(diffuseColor.rgb, tone * (0.7 + 0.6 * lum), uDiaFacet); }`;
const FRAG_BODY = `#include <emissivemap_fragment>
{ vec3 Nv = normalize(normal);
  vec3 Vv = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
  float ndv = clamp(dot(Nv, Vv), 0.0, 1.0), fres = pow(1.0 - ndv, 3.5);
  vec3 Rw = normalize((vec4(reflect(-Vv, Nv), 0.0) * viewMatrix).xyz);
  vec3 L = normalize(vec3(0.45, 0.75, 0.48));
  float sunF = pow(max(dot(Rw, L), 0.0), 18.0), sunH = pow(max(dot(Rw, L), 0.0), 220.0);
  float streak = smoothstep(0.045, 0.0, abs(Rw.y - 0.1));
  // prism lines on facet rims (flat normal changes across an edge, so fwidth(normal) lights a 1-2 px line)
  float edge = clamp(length(fwidth(Nv)) * 6.0, 0.0, 1.0) * step(0.01, uDiaFacet); // never on cloth
  vec3 pr = diaPrism(dot(vDiaW, vec3(0.11, 0.17, 0.07)) + uDiaT * 0.15);
  vec3 prG = diaPrism(dot(Rw, vec3(1.3, 0.9, 1.7)) + uDiaT * 0.2);          // grazing facets flash a prism hue
  // star twinkles in the surface (cheap; the crisp crosses are the glint billboards)
  vec3 c = vDiaW * 1.15, f = fract(c) - 0.5; float h = diaHash(floor(c));
  float tw = pow(0.5 + 0.5 * sin(uDiaT * (2.5 + h * 4.0) + h * 60.0), 4.0) * step(0.85, h);
  float core = 1.0 - smoothstep(0.0, 0.12, length(f));
  vec3 add = vec3(0.92, 0.97, 1.0) * (sunF * 0.9 + streak * 0.35)
           + vec3(0.6, 0.9, 1.0) * fres * 1.1
           + prG * smoothstep(0.3, 0.75, fres) * 0.45 * step(0.01, uDiaFacet)
           + pr * edge * 1.1;
  totalEmissiveRadiance = totalEmissiveRadiance * 0.5 + add * uDiaK + vec3(1.0) * (sunH * 4.0 + tw * core * 2.5) * uDiaK; }`;
function addShine(n, base, k, facet = 1) {
  const prev = base.onBeforeCompile, prevKey = base.customProgramCacheKey?.() || 'toon';
  n.onBeforeCompile = (s, r) => {
    prev?.call(n, s, r);
    s.uniforms.uDiaT = wind.uTime; s.uniforms.uDiaK = { value: k }; s.uniforms.uDiaFacet = { value: facet };
    s.vertexShader = s.vertexShader.replace('#include <common>', VERT_HEAD).replace('#include <worldpos_vertex>', VERT_BODY);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', FRAG_HEAD).replace('#include <color_fragment>', FRAG_COLOR).replace('#include <emissivemap_fragment>', FRAG_BODY);
  };
  n.customProgramCacheKey = () => prevKey + '|diamond';
  return n;
}
// prismatic outlines: the toon silhouette line cycles cyan / magenta / yellow along the ship
function prismOutline(m) {
  const n = m.clone(), prev = m.onBeforeCompile;
  n.color.set(0x0a1040);
  n.onBeforeCompile = (s, r) => {
    prev?.call(n, s, r);
    s.uniforms.uDiaT = wind.uTime;
    s.vertexShader = s.vertexShader.replace('#include <common>', VERT_HEAD).replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvDiaW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vDiaW; uniform float uDiaT;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float h = fract(dot(vDiaW, vec3(0.09, 0.14, 0.06)) + uDiaT * 0.15); float b = fract(h * 3.0);
          vec3 c = h < 0.333 ? vec3(0.1, 1.0, 1.0) : (h < 0.666 ? vec3(1.0, 0.15, 0.95) : vec3(1.0, 0.95, 0.1));
          diffuseColor.rgb = mix(vec3(0.04, 0.05, 0.25), c, smoothstep(0.05, 0.2, b) * smoothstep(0.98, 0.85, b)); }`);
  };
  n.customProgramCacheKey = () => 'outline|diamond';
  return n;
}
function crystal(color, k, extra = {}) {
  const m = toon(color, null, extra); m.flatShading = true; // (not a toon ctor param in r165, but the shader honours it)
  m.emissive = new THREE.Color(0x0a1040); m.emissiveIntensity = 0.4;
  return addShine(m, m.clone(), k);
}
const MAT = {}; // built once
const mats = () => MAT.shell ? MAT : Object.assign(MAT, {
  shell: crystal(0xffffff, 1.0, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
  gem: crystal(0xffffff, 1.3),
  mast: crystal(0xffffff, 0.9),
  line: prismOutline(outlineMat(0.08, 0x0a1040)),
  edges: new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }),
});

const _fx = new Map();
// (material) => material: gem-colours every base material + adds the shine. Never touches the water lid.
export function diamondMaterialFx(m) {
  if (!m || m.colorWrite === false) return m;
  if (_fx.has(m)) return _fx.get(m);
  let n = m;
  if (m.side === THREE.BackSide && m.isMeshBasicMaterial) n = prismOutline(m); // toon outlines go prismatic
  else if (m.isMeshToonMaterial) {
    const isSail = m.customProgramCacheKey?.() === 'sail';
    n = m.clone();
    n.color.set(isSail ? 0xa8b8ff : 0x9fb4ff);
    n.flatShading = !isSail;
    n.emissive = new THREE.Color(0x0a1040); n.emissiveIntensity = 0.4;
    if (isSail) { n.transparent = true; n.opacity = 0.94; }
    addShine(n, m, isSail ? 0.3 : 0.8, isSail ? 0 : 0.5);
  } else if (m.isMeshBasicMaterial) { // lanterns / glows: cold white-blue
    n = m.clone(); n.color.set(0xbff0ff).multiplyScalar(1.3);
  } else if (m.isLineBasicMaterial) { n = m.clone(); n.color.set(0x8fc8ff); } // rigging: silver-blue
  _fx.set(m, n); return n;
}

// ---------- shape: gem hull + prow gem + shard spikes (merged, cached per hull size) ----------
const ni = (g) => g.index ? g.toNonIndexed() : g;
const shard = (r, h, sides = 4) => { const g = new THREE.ConeGeometry(r, h, sides, 1); g.translate(0, h / 2, 0); return ni(g); };
const place = (g, p, r = [0, 0, 0]) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(1, 1, 1)));
function strip(g) { for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g.computeVertexNormals(); return g; }
function gemHull(len, beam, depth, shape) {
  // same envelope as the base hull (so the deck / rails still sit right) but 8 sections x 3 facets a side
  const N = 8, rows = [[0, 0], [0.55, 0.45], [1, 1]]; // [width factor along girth, depth factor]
  const ring = (t) => { const w = shape.halfW(t) * 1.03, yt = shape.top(t), yk = shape.keel(t);
    return [[w, yt], [w * 1.06, yt - (yt - yk) * 0.4], [w * 0.55, yt - (yt - yk) * 0.86], [0, yk - 0.05]]; };
  const P = [];
  for (let i = 0; i < N; i++) {
    const ta = 0.02 + i / N * 0.97, tb = 0.02 + (i + 1) / N * 0.97, za = (ta - 0.5) * len, zb = (tb - 0.5) * len, A = ring(ta), B = ring(tb);
    for (const sx of [1, -1]) for (let j = 0; j < 3; j++) {
      const a0 = [sx * A[j][0], A[j][1], za], a1 = [sx * A[j + 1][0], A[j + 1][1], za], b0 = [sx * B[j][0], B[j][1], zb], b1 = [sx * B[j + 1][0], B[j + 1][1], zb];
      if (sx > 0) P.push(...a0, ...a1, ...b0, ...b0, ...a1, ...b1); else P.push(...a0, ...b0, ...a1, ...b0, ...b1, ...a1);
    }
  }
  // stern transom as a flat facet fan
  const S = ring(0.02), zs = -0.48 * len, cy = (S[0][1] + S[3][1]) / 2;
  for (let j = 0; j < 3; j++) for (const sx of [1, -1]) { const p = [sx * S[j][0], S[j][1], zs], q = [sx * S[j + 1][0], S[j + 1][1], zs]; if (sx > 0) P.push(0, cy, zs, ...q, ...p); else P.push(0, cy, zs, ...p, ...q); }
  P.push(-S[0][0], S[0][1], zs, S[0][0], S[0][1], zs, 0, cy, zs);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); return strip(g);
}
const _geo = new Map();
function diamondGeos(ud) {
  const { len, beam, depth, layout } = ud, { shape, mastDefs, deckDrop, bowY } = layout;
  const key = [len, beam, depth, mastDefs.length].map(v => v.toFixed(2)).join('|');
  if (_geo.has(key)) return _geo.get(key);
  const zAt = (t) => (t - 0.5) * len, deckAt = (t) => shape.top(t) - deckDrop;
  const shards = [];
  // gunwale crown: short spikes leaning outward along both rails (inside the beam, so the hitbox read stays honest)
  for (const sx of [1, -1]) for (const t of [0.1, 0.22, 0.36, 0.66, 0.8]) {
    const w = shape.halfW(t) * 0.92, y = shape.top(t);
    shards.push(strip(place(shard(0.32, 1.9 + (t * 7 % 1) * 1.2), [sx * w, y + 0.1, zAt(t)], [0, 0, -sx * 0.45])));
  }
  // stern crystal cluster
  for (const [x, h, r] of [[0, 3.2, 0], [0.8, 2.2, -0.35], [-0.8, 2.2, 0.35]]) shards.push(strip(place(shard(0.42, h), [x, shape.top(0.04) + 0.2, zAt(0.04)], [0.15, 0, r])));
  // mast crowns + yard-tip shards (masts are crystal via material swap)
  mastDefs.forEach(([tf, hf]) => {
    const mz = zAt(tf), my = deckAt(tf), mh = len * 0.98 * hf;
    for (const [yf, wf] of [[0.74, 1.5], [0.98, 1.08]]) {
      const yw = beam * wf * hf, yy = my + mh * yf;
      for (const sx of [1, -1]) shards.push(strip(place(shard(0.2, 1.6, 4), [sx * yw / 2, yy, mz + 0.22], [0, 0, -sx * Math.PI / 2])));
    }
    shards.push(strip(place(shard(0.2, 1.0, 4), [0, my + mh * 0.5, mz + 0.05], [Math.PI / 2, 0, 0])));
    if (hf < 1) { const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.55, 1.5, 0.55); shards.push(strip(place(g, [0, my + mh + 1.1, mz]))); } // gem mast heads (main mast keeps the flag)
  });
  // keel fins: two big faceted blades under the waterline sides, gem silhouette when the ship rolls
  for (const sx of [1, -1]) shards.push(strip(place(shard(0.35, depth * 0.9, 3), [sx * shape.halfW(0.5) * 0.7, shape.keel(0.5) * 0.4, zAt(0.5)], [0, 0, sx * (Math.PI - 0.9)])));
  const shell = mergeGeometries([gemHull(len, beam, depth, shape), ...shards], false);
  // prow gem: long octahedral crystal on the stem, pointing forward
  const gem = new THREE.OctahedronGeometry(1, 0); gem.scale(1.0, 1.15, 2.6);
  place(gem, [0, bowY + 0.35, zAt(1) + 1.0], [-0.25, 0, 0]);
  const gem2 = new THREE.OctahedronGeometry(1, 0); gem2.scale(0.6, 1.7, 0.6); place(gem2, [0, shape.top(0.98) + 1.2, zAt(0.97)]);
  const out = { shell, gem: mergeGeometries([strip(gem), strip(gem2)], false) };
  // prism facet rims: every hard edge of the gem hull + gems, coloured cyan / magenta / yellow (one LineSegments)
  const eg = mergeGeometries([new THREE.EdgesGeometry(shell, 20), new THREE.EdgesGeometry(out.gem, 20)], false), ep = eg.attributes.position, col = new Float32Array(ep.count * 3);
  const CMY = [[0.1, 1, 1], [1, 0.2, 0.95], [1, 0.95, 0.15]];
  for (let i = 0; i < ep.count; i += 2) { const c = CMY[Math.floor(Math.abs(ep.getX(i) * 1.7 + ep.getY(i) * 2.3 + ep.getZ(i) * 0.9)) % 3]; col.set(c, i * 3); col.set(c, i * 3 + 3); }
  eg.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.edges = eg;
  _geo.set(key, out); return out;
}

// ---------- sparkle wake trail (GPU-animated Points, no per-frame JS) ----------
const _trailMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime, uScale: { value: 260 }, uSpeed: { value: 0 }, uBox: { value: new THREE.Vector3() } },
  vertexShader: `attribute vec3 seed; uniform float uT; uniform float uScale; uniform float uSpeed; uniform vec3 uBox; varying float vA;
    void main(){ float life = fract(uT * (0.22 + seed.z * 0.12) + seed.x);
      vec3 p = vec3((seed.y - 0.5) * uBox.x * (0.35 + life * 1.1), 0.15 + sin(seed.x * 40.0 + uT * 3.0) * 0.12, uBox.z - life * uBox.y * (0.35 + 0.65 * uSpeed));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float tw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uT * 9.0 + seed.y * 80.0), 3.0);
      vA = (1.0 - life) * tw * uSpeed;
      gl_PointSize = (0.5 + 0.5 * seed.z) * (1.0 - life * 0.6) * uScale / max(1.0, -mv.z);
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5;
      float d = length(q), star = max(0.0, 1.0 - abs(q.x) * 14.0) * max(0.0, 1.0 - abs(q.y) * 2.2) + max(0.0, 1.0 - abs(q.y) * 14.0) * max(0.0, 1.0 - abs(q.x) * 2.2);
      float a = (smoothstep(0.22, 0.0, d) + star * 0.8) * vA; if (a < 0.02) discard;
      gl_FragColor = vec4(vec3(0.78, 0.93, 1.0) * 0.6 * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const _trailGeo = new Map();
function trail(ud, quality) {
  const n = quality === 'low' ? 14 : 40;
  if (!_trailGeo.has(n)) {
    const g = new THREE.BufferGeometry(), s = new Float32Array(n * 3);
    for (let i = 0; i < s.length; i++) s[i] = ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 3));
    _trailGeo.set(n, g);
  }
  const m = _trailMat.clone(); m.uniforms.uT = wind.uTime; // clone() copies uniforms: each ship owns uSpeed / uBox
  m.uniforms.uBox.value.set(ud.beam, ud.len * 0.9, -ud.len * 0.46);
  const p = new THREE.Points(_trailGeo.get(n), m); p.frustumCulled = false; p.userData.sharedGeo = true; p.userData.diamondTrail = true;
  p.onBeforeRender = () => trailSpeed(p, m.uniforms.uSpeed);
  return p;
}
// each ship's own speed drives its trail, never the local player's. Priority: a speed fed by diamondTick()
// (remote ships: the synced speed), else ship.userData.speed, else measured from the ship's own movement.
const _wp = new THREE.Vector3();
const SPEED_FULL = 10; // world units / s that count as "full sail" (game ships top out around 7-12)
function trailSpeed(p, u) {
  const ship = p.parent; if (!ship) return;
  const ud = ship.userData, now = performance.now(), D = ud.diamond || (ud.diamond = { t: now, x: 0, z: 0, v: 0 });
  if (now - D.t < 12) return; // the scene can render more than once a frame; measure once per frame
  const dt = Math.min(0.25, (now - D.t) / 1000);
  ship.getWorldPosition(_wp);
  let v;
  if (D.fedAt && now - D.fedAt < 600) v = D.fed;
  else if (typeof ud.speed === 'number') v = ud.speed;
  else v = Math.hypot(_wp.x - D.x, _wp.z - D.z) / dt;
  D.x = _wp.x; D.z = _wp.z; D.t = now;
  const k = Math.min(1, Math.max(0, Math.abs(v) / SPEED_FULL));
  u.value += (k - u.value) * Math.min(1, dt * 4); // smooth, so a jittery synced speed doesn't flicker
}

// ---------- distance flares + cold aura (one Points draw per ship, readable across the map) ----------
// glints: billboard size in PIXELS grows with distance and is clamped, fading in past ~30 units so the near
// view keeps the facet glints only. aura: a soft cold halo sized to the ship, also only from a distance.
const _flareMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime, uPR: { value: 1 }, uLen: { value: 17 } },
  vertexShader: `attribute vec4 seed; uniform float uT; uniform float uPR; uniform float uLen; varying float vA; varying float vAura;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = max(1.0, -mv.z);
      float far = smoothstep(30.0, 110.0, d); vAura = seed.y;
      if (seed.y > 0.5) { gl_PointSize = clamp(uLen * 2.4 * 900.0 / d, 18.0, 220.0) * uPR; vA = 0.16 * far; }
      else { float tw = pow(0.5 + 0.5 * sin(uT * (2.2 + seed.z * 2.5) + seed.x * 40.0), 6.0);
        gl_PointSize = clamp(5.0 + d * 0.07, 6.0, 30.0) * seed.w * uPR; vA = tw * far; }
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; varying float vAura; void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q), a;
      if (vAura > 0.5) a = pow(max(0.0, 1.0 - d * 2.0), 2.2) * vA;
      else a = (smoothstep(0.2, 0.0, d) + max(0.0, 1.0 - abs(q.x) * 16.0) * max(0.0, 1.0 - abs(q.y) * 2.0) + max(0.0, 1.0 - abs(q.y) * 16.0) * max(0.0, 1.0 - abs(q.x) * 2.0)) * vA;
      if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.82, 0.94, 1.0) * a, a); }`,
  transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
});
const _flareGeo = new Map();
function flares(ud, quality) {
  const { len, layout } = ud, { shape, mastDefs, deckDrop, bowY } = layout, zAt = (t) => (t - 0.5) * len, deckAt = (t) => shape.top(t) - deckDrop;
  const key = len.toFixed(2) + quality;
  if (!_flareGeo.has(key)) {
    const pts = [[0, shape.top(0.5) + 2, 0, 1, 0, 1]]; // aura: [x,y,z, type, speedSeed, size]
    pts.push([0, bowY + 0.4, zAt(1) + 1.0, 0, 0.3, 1.2]);                         // prow gem
    mastDefs.forEach(([tf, hf], i) => { const my = deckAt(tf), mh = len * 0.98 * hf; pts.push([0, my + mh + (hf < 1 ? 1.1 : -0.5), zAt(tf), 0, 0.5 + i * 0.2, 1]); });
    if (quality !== 'low') for (const sx of [1, -1]) { const [tf, hf] = mastDefs[0], mh = len * 0.98 * hf, yw = ud.beam * 1.5 * hf; pts.push([sx * yw / 2, deckAt(tf) + mh * 0.74, zAt(tf), 0, 0.8 + sx * 0.1, 0.8]); }
    if (quality !== 'low') pts.push([0, shape.top(0.04) + 3, zAt(0.04), 0, 0.9, 0.9]); // stern cluster
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(p => p.slice(0, 3)), 3));
    g.setAttribute('seed', new THREE.Float32BufferAttribute(pts.flatMap((p, i) => [i * 0.37 + 0.1, p[3], p[4], p[5]]), 4));
    _flareGeo.set(key, g);
  }
  const m = _flareMat.clone(); m.uniforms.uT = wind.uTime; m.uniforms.uLen.value = len;
  const p = new THREE.Points(_flareGeo.get(key), m); p.frustumCulled = false; p.renderOrder = 3; p.userData.sharedGeo = true; p.userData.diamondFlare = true;
  p.onBeforeRender = (r) => { m.uniforms.uPR.value = r.getPixelRatio(); };
  return p;
}

// Optional per-frame hook for ships whose speed comes from the network (PvP remote ships):
//   diamondTick(ship, { speed })   speed in world units / s (the synced value); dt / camera are accepted, unused.
// Safe to call on any ship (no-op for non-diamond). Without it a ship's trail reads userData.speed or measures
// the ship's own movement, so nothing depends on the local player.
export function diamondTick(ship, { speed } = {}) {
  const ud = ship?.userData; if (!ud || ud.skinId !== 'diamond' || typeof speed !== 'number') return;
  const D = ud.diamond || (ud.diamond = { t: performance.now(), x: 0, z: 0, v: 0 });
  D.fed = speed; D.fedAt = performance.now();
}

// ---------- crisp 4-point cross-star glints on facet vertices (one Mesh draw, visible up close + in stills) ----------
// A Mesh of camera-facing quads (billboarded in the vertex shader), not Points, so shop previews keep them too.
// Every glint is always lit (55-100%) and twinkles in size, so any still shows them; near-range size is in world
// units that grow gently with distance (clamped), fixed in the orthographic preview.
const _glintMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime },
  vertexShader: `attribute vec2 corner; attribute vec2 seed; uniform float uT; varying vec2 vUv; varying float vA;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); bool ortho = projectionMatrix[3][3] == 1.0;
      float d = max(1.0, -mv.z), tw = 0.5 + 0.5 * sin(uT * (1.6 + seed.x * 2.2) + seed.x * 50.0);
      float s = (ortho ? 1.5 : clamp(0.45 + d * 0.03, 0.5, 2.6)) * seed.y * (0.7 + 0.55 * tw);
      mv.xy += corner * s; vUv = corner; vA = 0.55 + 0.45 * tw; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec2 vUv; varying float vA; void main(){ vec2 u = vUv;
      float arms = max(0.0, 1.0 - abs(u.y) * 26.0) * pow(max(0.0, 1.0 - abs(u.x)), 1.6) + max(0.0, 1.0 - abs(u.x) * 26.0) * pow(max(0.0, 1.0 - abs(u.y)), 1.6);
      float diag = (max(0.0, 1.0 - abs(u.x - u.y) * 18.0) + max(0.0, 1.0 - abs(u.x + u.y) * 18.0)) * pow(max(0.0, 1.0 - length(u) * 1.6), 2.0) * 0.45;
      float core = exp(-dot(u, u) * 60.0);
      float a = min(1.0, (arms + diag + core * 1.5) * vA); if (a < 0.02) discard;
      gl_FragColor = vec4(vec3(0.9, 0.97, 1.0) * 2.0 * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const _glintGeo = new Map();
function glints(ud, G, quality) {
  const key = ud.len.toFixed(2) + ud.beam.toFixed(2) + quality;
  if (!_glintGeo.has(key)) {
    const pick = (geo, minY, n) => {
      const P = geo.attributes.position, N = geo.attributes.normal, seen = new Map();
      for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < minY) continue; const k = `${P.getX(i).toFixed(1)},${y.toFixed(1)},${P.getZ(i).toFixed(1)}`; if (!seen.has(k)) seen.set(k, i); }
      const idx = [...seen.values()].sort((a, b) => P.getZ(a) - P.getZ(b) || P.getY(a) - P.getY(b));
      const step = Math.max(1, idx.length / n), out = [];
      for (let j = 0; j < idx.length && out.length < n; j += step) { const i = idx[Math.floor(j)]; out.push([P.getX(i) + N.getX(i) * 0.3, P.getY(i) + N.getY(i) * 0.3, P.getZ(i) + N.getZ(i) * 0.3]); }
      return out;
    };
    const low = quality === 'low';
    const pts = [...pick(G.shell, -0.2, low ? 12 : 34).map(p => [p, 1]), ...pick(G.gem, -99, low ? 4 : 10).map(p => [p, 1.35])];
    const pos = [], cor = [], sd = [], idx = [];
    pts.forEach(([p, sz], i) => {
      const b = i * 4, ph = ((Math.sin(i * 91.7) * 43758.5) % 1 + 1) % 1;
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(...p); cor.push(cx, cy); sd.push(ph, sz * (0.8 + ph * 0.5)); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('corner', new THREE.Float32BufferAttribute(cor, 2));
    g.setAttribute('seed', new THREE.Float32BufferAttribute(sd, 2)); g.setIndex(idx);
    g.computeBoundingSphere(); g.boundingSphere.radius += 2.5; // quads grow in view space
    _glintGeo.set(key, g);
  }
  const m = new THREE.Mesh(_glintGeo.get(key), _glintMat); m.renderOrder = 3; m.userData.sharedGeo = true; m.userData.diamondGlints = true;
  return m;
}

// ---------- flag-pole diamond: classic brilliant cut (crown + pointed pavilion), spins on the shared clock ----------
let _cutGeo = null, _cutGlint = null;
function cutGem() {
  if (_cutGeo) return _cutGeo;
  // lathe profile bottom -> top: culet point, girdle, crown slope, table (8 sides = flat facets with the gem shading)
  const g = new THREE.LatheGeometry([[0, -1.0], [0.95, -0.05], [1.0, 0.05], [0.58, 0.42], [0, 0.42]].map(([x, y]) => new THREE.Vector2(x, y)), 8);
  _cutGeo = g.toNonIndexed(); _cutGeo.deleteAttribute('uv'); _cutGeo.computeVertexNormals();
  const q = new THREE.BufferGeometry(), c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  q.setAttribute('position', new THREE.Float32BufferAttribute(new Array(4).fill([0.55, 0.3, 0.55]).flat(), 3));
  q.setAttribute('corner', new THREE.Float32BufferAttribute(c.flat(), 2)); q.setAttribute('seed', new THREE.Float32BufferAttribute(new Array(4).fill([0.37, 2.4]).flat(), 2));
  q.setIndex([0, 1, 2, 0, 2, 3]); q.computeBoundingSphere(); q.boundingSphere.radius += 3; _cutGlint = q;
  return _cutGeo;
}
function flagGem(ctx) {
  const pole = ctx.base.flagPole; if (!pole) return;
  const knob = pole.children.find(o => o.isMesh && o.geometry?.type === 'SphereGeometry');
  const top = knob ? knob.position.y : (pole.children.find(o => o.isMesh)?.position.y || 0) * 2;
  const s = Math.max(1.2, ctx.len / 17 * 1.4);
  const holder = new THREE.Group(); holder.position.set(0, top + 0.35 + s * 1.0, 0); holder.scale.setScalar(s); holder.userData.diamondFlagGem = true;
  const gem = new THREE.Mesh(cutGem(), mats().gem); gem.userData.sharedGeo = true;
  const ph = Math.random() * 6.28;
  gem.onBeforeRender = () => { gem.rotation.y = wind.uTime.value * 0.8 + ph; }; // cheap, no tick needed (shared clock)
  const gl = new THREE.Mesh(_cutGlint, _glintMat); gl.userData.sharedGeo = true; gl.renderOrder = 3; gl.userData.diamondGlints = true;
  holder.add(gem, gl); ctx.add(holder, pole); // parented to the flag pole: follows it at every upgrade level
}

// ---------- the override (see ./partsOverride.js for ctx) ----------
export function diamondPartsOverride(ship, ctx) {
  const M = mats(), G = diamondGeos(ctx.ud);
  ctx.hide(ctx.base.hull); ctx.hide(ctx.base.hullOutline);           // base round hull out, gem hull in
  const shell = new THREE.Mesh(G.shell, M.shell); shell.userData.sharedGeo = true;
  const line = outlineFor(shell, 0.08); line.material = M.line; line.userData.sharedGeo = false; // own smoothed copy
  const gem = new THREE.Mesh(G.gem, M.gem); gem.userData.sharedGeo = true;
  ctx.add(shell); ctx.add(line); ctx.add(gem); ctx.add(glints(ctx.ud, G, ctx.quality));
  const ed = new THREE.LineSegments(G.edges, M.edges); ed.userData.sharedGeo = true; ctx.add(ed); // prism facet rims
  for (const o of ctx.base.mast) o.material = M.mast;                 // crystal masts, yards, bowsprit, flag pole
  ship.traverse(o => { if (o.isPointLight) o.intensity *= 0.35; }); // the stern lantern light blew the white crystal out under bloom
  ctx.add(trail(ctx.ud, ctx.quality), ship);
  flagGem(ctx);
  ctx.add(flares(ctx.ud, ctx.quality));                              // distance glints + aura, on the bobbing body
  signatureWake(ship, ctx, { c0: 0xffffff, c1: 0xb060ff, n: 56, size: 380, rise: 1.2 }); // prismatic star wake (top tier)
  liftRig(ctx, { lift: 0.6, sx: 1.12, sy: 1.25, sz: 1.12 });
}
DIAMOND.materialFx = diamondMaterialFx;
DIAMOND.partsOverride = diamondPartsOverride;
export default DIAMOND;
