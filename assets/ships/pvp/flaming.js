// [Timothy] PvP FLAMING SHIP skin, unlocks at FLAMING_KILLS (2500) lifetime player kills. PUMPFUN PIRATES PvP.
// A ship that never stops burning: charred near-black timbers split by glowing, pulsing ember cracks (emissive ONLY
// in the cracks), sails that are always on fire (animated flame shader, burning edges, burn holes), fire pouring OFF
// the ship (flames licking up and out of the hull sides, rails, deck and stern, rising well above the rails and swept
// aft by the ship's own speed), charred broken rail stakes, a wake of smoke + trailing fire on the water + embers that
// grows with speed, a cheap heat-shimmer billboard over the deck and a warm halo that keeps the ship readable across
// the map. Hull + sails are fog-compensated (fogged pixels fade to soot + their own fire, not grey), so a distant
// Flaming ship stays dark and burning. Warm red / orange / gold only, never icy, so it can't be confused with DIAMOND.
//
// Uses the parts-override API in ./partsOverride.js (materialFx + partsOverride). Hitbox is untouched
// (runPartsOverride snapshots + restores it; nothing here writes len / beam / depth).
// Phone cost: no post-processing, no textures, no per-ship materials (every material is shared by all flaming
// ships; per-ship speed is pushed in onBeforeRender with uniformsNeedUpdate). Geometry is built once per hull /
// sail size and cached (userData.sharedGeo, so disposeShip() never frees a shared buffer).
// Draw calls: high +5 (sail flames + halo Points, wake Points, shimmer quad, charred stakes + their outline), low +2
// (flames, wake). Extra tris: high ~530 (stakes + outline + shimmer), low 0.
// Particles per ship: high 40 sail + 120 hull / rail / deck / stern fire + 72 wake; LOW 10 + 36 + 22.
// LOW quality: no heat shimmer, no stake geometry, the reduced particle counts above; crack / sail fire stays as
// emissive shader work only.
// Every ship (local or remote) animates on the shared wind clock and its own speed: see flamingTick().
//
// Wiring (same as DIAMOND; this branch, like Raul's, does not register PvP skins in js/ on its own):
//   js/pvpSkins.js:  import { FLAMING, flamingTick } from '../assets/ships/pvp/flaming.js';
//                    FLAMING.tick = flamingTick;  // or SHIP_TICKS.push(flamingTick)
//                    registerSkin(FLAMING)        // replaces the placeholder FLAMING there; tier stays config.js 'flaming' 2500
//   js/upgradeVisuals.js buildCompiled(): runPartsOverride(ship, skin, { quality, levels })  (PvP builds only)
//   PvP loop, every frame, for EVERY ship mesh (yours + remote): flamingTick(mesh, { speed })
import * as THREE from 'three';
import { wind } from '../../../js/ships.js';
import { toon, outlineFor, outlineMat } from '../../../js/toon.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// change the unlock tier here only
export const FLAMING_KILLS = 2500;

export const FLAMING = {
  id: 'flaming', name: 'FLAMING SHIP', killsRequired: FLAMING_KILLS, price: 0, premium: 'pvp',
  blurb: `${FLAMING_KILLS} kills. Charred timbers, ember cracks and sails that never stop burning.`,
  palette: { seed: 191, wood: 0x241713, band: 0x0d0907, stripe: 0xff5a14, band2: 0x3a120a, tar: 0x0a0605, trim: 0xff8a2a, sail: 0x5a1606, patch: [0x3a0e04, 0x7a2408], hem: 0x1a0603, lantern: 0xff9a3a, window: 0xffb04a, stripes: 0x2a0a04 },
  sail: { bg: '#4a1406', badge: '#0b0604', lines: 'rgba(255,140,40,0.10)', border: '#1a0603' },
  flag: { bg: '#1a0d08', badge: '#0b0604', border: '#ff5a14' },
  parts: { oak: 0x1c120e, plank: 0x2a1610, deck: 0x3a2418, iron: 0x14100e, gold: 0xff8a2a, glow: 0xff6a1a },
  swatch: { hull: '#231612', band: '#0d0907', stripe: '#ff5a14', sail: '#c23a0e', trim: '#ff8a2a', flaming: true },
};

// ---------- shader kit: cheap 3D value noise, ember cracks (hull) + live fire (sails) ----------
const NOISE = `float flHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float flNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(flHash(i), flHash(i + vec3(1,0,0)), f.x), mix(flHash(i + vec3(0,1,0)), flHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(flHash(i + vec3(0,0,1)), flHash(i + vec3(1,0,1)), f.x), mix(flHash(i + vec3(0,1,1)), flHash(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
const VERT_HEAD = '#include <common>\nvarying vec3 vFlP; varying vec2 vFlUv;';
const VERT_BODY = '#include <begin_vertex>\nvFlP = position; vFlUv = uv;';
const FRAG_HEAD = `#include <common>
varying vec3 vFlP; varying vec2 vFlUv; uniform float uFlT; uniform float uFlK; uniform float uFlFog;
vec3 flFire = vec3(0.0); // this pixel's fire, re-applied after fog so distant ships stay dark + burning, not grey
${NOISE}`;
// fog compensation: fogged pixels fade to soot black + their own fire instead of the grey fog colour
const FOG = `#include <fog_fragment>
#ifdef USE_FOG
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.022, 0.01, 0.007) + flFire, fogFactor * uFlFog);
#endif`;
// timbers: ridged noise in OBJECT space (cracks ride with the ship), broken up so they read as splits, slow
// travelling pulse. Emissive ONLY in the cracks (base emissive is zeroed), so the planks stay charred black.
const CRACK = `#include <emissivemap_fragment>
{ float n = flNoise(vFlP * 0.85), r = 1.0 - abs(n * 2.0 - 1.0);
  float crack = smoothstep(0.88, 0.985, r) * smoothstep(0.32, 0.62, flNoise(vFlP * 2.1 + 7.0));
  float pulse = 0.55 + 0.45 * sin(uFlT * 2.4 + vFlP.z * 0.55 + vFlP.y * 1.4) * (0.7 + 0.3 * sin(uFlT * 7.3 + vFlP.x * 3.0));
  diffuseColor.rgb *= 1.0 - smoothstep(0.7, 0.95, r) * 0.5;
  vec3 ember = mix(vec3(1.0, 0.18, 0.02), vec3(1.0, 0.62, 0.16), crack * pulse);
  totalEmissiveRadiance = ember * crack * pulse * uFlK * 2.2;
  flFire = ember * crack * pulse * uFlK * 1.4; }`;
// sails: two octaves of rising noise, fire strongest at the foot, flickering tongues licking up, charred
// rim around the flames and a few static burnt-through holes (discard) with glowing edges.
const FIRE = `#include <emissivemap_fragment>
{ vec2 u = vFlUv; float t = uFlT, h = 1.0 - u.y;
  float f = flNoise(vec3(u.x * 5.0, u.y * 3.0 - t * 1.7, t * 0.35)) * 0.62 + flNoise(vec3(u.x * 12.0, u.y * 7.5 - t * 3.3, 3.0 + t * 0.2)) * 0.38;
  float flame = smoothstep(0.46, 0.88, f + h * 0.72 - 0.3);
  float hole = flNoise(vec3(u * vec2(4.0, 3.0), 11.0)) * smoothstep(0.95, 0.4, u.y);
  if (hole > 0.74) discard;
  float rim = smoothstep(0.62, 0.74, hole);
  vec3 fc = mix(vec3(0.85, 0.10, 0.02), vec3(1.0, 0.5, 0.07), flame);
  fc = mix(fc, vec3(1.0, 0.86, 0.42), smoothstep(0.82, 1.0, flame));
  float e = min(min(u.x, 1.0 - u.x), min(u.y, 1.0 - u.y));            // burning edges: every sail outline smoulders
  float edge = smoothstep(0.1, 0.0, e) * (0.55 + 0.45 * flNoise(vec3(u * 14.0, t * 1.5)));
  float flick = 0.82 + 0.18 * sin(t * 13.0 + u.x * 9.0 + u.y * 4.0);
  diffuseColor.rgb *= mix(0.08, 0.6, smoothstep(0.05, 0.4, flame)) * (1.0 - rim * 0.8);
  flFire = (fc * flame * flick * 0.95 + vec3(1.0, 0.36, 0.04) * (rim * 1.4 + edge * 0.9)) * uFlK;
  totalEmissiveRadiance = min(totalEmissiveRadiance * 0.1 + flFire, vec3(1.15)); }`;
function addFire(n, base, body, k, fog = 0.6) {
  const prev = base.onBeforeCompile, prevKey = base.customProgramCacheKey?.() || 'toon';
  n.onBeforeCompile = (s, r) => {
    prev?.call(n, s, r);
    s.uniforms.uFlT = wind.uTime; s.uniforms.uFlK = { value: k }; s.uniforms.uFlFog = { value: fog };
    s.vertexShader = s.vertexShader.replace('#include <common>', VERT_HEAD).replace('#include <begin_vertex>', VERT_BODY);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', FRAG_HEAD).replace('#include <emissivemap_fragment>', body).replace('#include <fog_fragment>', FOG);
  };
  n.customProgramCacheKey = () => prevKey + (body === FIRE ? '|flame-sail' : '|flame-crack');
  return n;
}
const MAT = {}; // built once, shared by every flaming ship
const mats = () => MAT.char ? MAT : Object.assign(MAT, {
  char: addFire(toon(0x161010), toon(0x161010), CRACK, 1.15),
  line: outlineMat(0.05, 0x2a0702),
});

const _fx = new Map();
// (material) => material: chars every base material, cracks the timbers, sets the sails on fire. Never touches the water lid.
export function flamingMaterialFx(m) {
  if (!m || m.colorWrite === false) return m;
  if (_fx.has(m)) return _fx.get(m);
  let n = m;
  if (m.side === THREE.BackSide && m.isMeshBasicMaterial) { // toon outline: smouldering deep red instead of black
    n = m.clone(); n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey;
    n.color.set(0x2a0702);
  } else if (m.isMeshToonMaterial) {
    const isSail = m.customProgramCacheKey?.() === 'sail';
    n = m.clone();
    // near-black albedo (toon has no env map / specular, so albedo + lights are the whole lit response)
    if (isSail) { n.color.set(0x5a4038); n.emissive = new THREE.Color(0x000000); n.side = m.side; }
    else { n.color.setRGB(0.2, 0.17, 0.16); n.emissive = new THREE.Color(0x000000); }
    addFire(n, m, isSail ? FIRE : CRACK, isSail ? 1.0 : 0.85, isSail ? 0.85 : 0.6);
  } else if (m.isMeshBasicMaterial) { // lanterns / windows: fire glow
    n = m.clone(); n.color.set(0xff7a2a).multiplyScalar(2.0);
  } else if (m.isLineBasicMaterial) { n = m.clone(); n.color.set(0x1a0c08); } // rigging: scorched rope
  _fx.set(m, n); return n;
}

// ---------- shape: charred, broken rail stakes (merged, cached per hull size, high quality only) ----------
const ni = (g) => g.index ? g.toNonIndexed() : g;
const place = (g, p, r = [0, 0, 0]) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(1, 1, 1)));
function strip(g) { g = ni(g); for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g.computeVertexNormals(); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }
const _geo = new Map();
function stakeGeo(ud) {
  const { len, layout } = ud, { shape } = layout, key = [len, ud.beam].map(v => v.toFixed(2)).join('|');
  if (_geo.has(key)) return _geo.get(key);
  const zAt = (t) => (t - 0.5) * len, parts = [];
  for (const sx of [1, -1]) for (let i = 0; i < 11; i++) {
    const t = 0.08 + i / 10 * 0.84, h = 0.7 + ((i * 37 + (sx > 0 ? 3 : 0)) % 7) / 7 * 1.1, w = shape.halfW(t) * 0.94;
    const g = new THREE.ConeGeometry(0.14 + (i % 3) * 0.04, h, 4, 1); g.translate(0, h / 2, 0);
    parts.push(strip(place(g, [sx * w, shape.top(t) - 0.05, zAt(t)], [(i % 3 - 1) * 0.3, i * 0.7, -sx * (0.12 + (i % 2) * 0.28)])));
  }
  const g = mergeGeometries(parts, false); parts.forEach(p => p.dispose());
  _geo.set(key, g); return g;
}

// ---------- fire pouring off the ship + sail flames + far halo (one Points draw per ship, on the bobbing body) ----------
// seed.w: 0 sail flame (rises off a sail), 1 far halo, 2 / 3 hull-side fire licking out to port / starboard,
// 4 deck / rail / stern fire licking straight up. Hull fire climbs well above the rails (up to ~len * 0.45) and is
// swept aft by THIS ship's speed (uSpeed, pushed per draw), so a sailing ship drags its fire behind it.
// Sizes are clamped in pixels so the fire still reads far away.
const _flameMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime, uPR: { value: 1 }, uLen: { value: 17 }, uSpeed: { value: 0 } },
  vertexShader: `attribute vec4 seed; uniform float uT; uniform float uPR; uniform float uLen; uniform float uSpeed; varying float vLife; varying float vHalo; varying float vA;
    void main(){ vec3 p = position; vHalo = step(0.5, seed.w) * step(seed.w, 1.5); float hull = step(1.5, seed.w);
      float life = fract(uT * (hull > 0.5 ? 0.42 + seed.z * 0.5 : 0.7 + seed.z * 0.9) + seed.x); vLife = life;
      if (hull > 0.5) {
        float outw = seed.w < 2.5 ? 1.0 : (seed.w < 3.5 ? -1.0 : 0.0);
        p.y += life * (2.5 + seed.y * uLen * 0.42) * (1.0 + uSpeed * 0.2);
        p.x += outw * life * (1.0 + seed.z * 2.2) + sin(uT * 4.0 + seed.x * 30.0) * 0.4 * life;
        p.z -= life * life * (0.5 + uSpeed * uLen * 0.55) - cos(uT * 3.0 + seed.x * 17.0) * 0.2 * life;
      } else if (vHalo < 0.5) { p.y += life * (1.1 + seed.y * 1.8); p.x += sin(uT * 5.0 + seed.x * 30.0) * 0.25 * life; p.z += cos(uT * 4.0 + seed.x * 17.0) * 0.15 * life - life * uSpeed * 1.5; }
      vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = max(1.0, -mv.z);
      if (vHalo > 0.5) { gl_PointSize = clamp(uLen * 2.2 * 900.0 / d, 16.0, 200.0) * uPR; vA = 0.4 * smoothstep(35.0, 120.0, d); }
      else if (hull > 0.5) { gl_PointSize = clamp((3.2 + seed.y * 4.2) * (1.0 - life * 0.25) * 300.0 / d, 4.0 + smoothstep(60.0, 160.0, d) * 4.0, 130.0) * uPR; vA = smoothstep(0.0, 0.06, life) * 1.15; vHalo = -1.0; }
      else { gl_PointSize = clamp((0.9 + seed.y * 1.3) * (1.0 - life * 0.55) * 300.0 / d, 2.5 + smoothstep(60.0, 160.0, d) * 2.5, 70.0) * uPR; vA = 1.0; }
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vLife; varying float vHalo; varying float vA;
    void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5) discard;
      if (vHalo > 0.5) { float a = pow(1.0 - r * 2.0, 2.0) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.42, 0.1), a * 0.7); return; }
      if (vHalo < -0.5) { float w = mix(0.22, 1.0, clamp(q.y + 0.5, 0.0, 1.0)); r = length(vec2(q.x / w, q.y)); if (r > 0.5) discard; }
      vec3 c = mix(vec3(1.0, 0.78, 0.28), vec3(1.0, 0.36, 0.04), smoothstep(0.0, 0.35, vLife));
      c = mix(c, vec3(0.5, 0.05, 0.01), smoothstep(0.4, 0.9, vLife));
      float a = (1.0 - smoothstep(0.08, 0.5, r)) * (0.75 + 0.25 * sin(vLife * 40.0 + q.x * 9.0)) * (1.0 - vLife * 0.85) * 0.95 * vA; if (a < 0.02) discard; gl_FragColor = vec4(c * 0.9, min(a, 0.92)); }`,
  // normal (not additive) blending: overlapping tongues stay orange flame shapes instead of stacking to white under bloom
  transparent: true, depthWrite: false,
});
const _flameGeo = new Map();
const R1 = (i) => ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
function sailRects(ship) { // each sail's box in body space (sail groups are direct children of the body)
  return ship.userData.sails.map(s => {
    const b = new THREE.Box3();
    for (const c of s.children) if (c.isMesh) { c.geometry.computeBoundingBox(); const bb = c.geometry.boundingBox.clone(); bb.min.multiply(c.scale); bb.max.multiply(c.scale); b.union(bb); }
    if (b.isEmpty()) return null; b.translate(s.position); return b;
  }).filter(Boolean);
}
// emitter counts: [sail, hull sides (per side), rails (per side), deck, stern]
const COUNTS = { high: [40, 26, 14, 22, 18], low: [10, 8, 4, 6, 6] };
function flames(ship, ud, quality) {
  const rects = sailRects(ship), C = COUNTS[quality === 'low' ? 'low' : 'high'], n = C[0];
  const key = rects.map(b => [b.min.x, b.min.y, b.max.y, b.min.z].map(v => v.toFixed(1)).join(',')).join('/') + '|' + ud.len.toFixed(2) + '|' + C.join(',');
  if (!_flameGeo.has(key)) {
    const pos = [], seed = [];
    const area = rects.map(b => (b.max.x - b.min.x) * (b.max.y - b.min.y)), tot = area.reduce((a, b) => a + b, 0) || 1;
    let i = 0;
    rects.forEach((b, k) => { const m = Math.max(2, Math.round(n * area[k] / tot));
      for (let j = 0; j < m; j++, i++) { const u = R1(i * 3 + 1), v = Math.pow(R1(i * 3 + 2), 1.6); // more fire low on each sail
        pos.push(b.min.x + (b.max.x - b.min.x) * (0.08 + u * 0.84), b.min.y + (b.max.y - b.min.y) * (0.05 + v * 0.75), b.max.z + 0.15);
        seed.push(R1(i * 7 + 3), R1(i * 5 + 4), R1(i * 11 + 5), 0); } });
    const { shape, deckDrop } = ud.layout, len = ud.len, zAt = (t) => (t - 0.5) * len;
    const emit = (x, y, z, w) => { i++; pos.push(x, y, z); seed.push(R1(i * 7 + 3), R1(i * 5 + 4), R1(i * 11 + 5), w); };
    for (const sx of [1, -1]) {
      for (let j = 0; j < C[1]; j++) { const t = 0.06 + (j + R1(j * 13 + sx * 5)) / C[1] * 0.88; // flames licking out of the hull sides
        emit(sx * shape.halfW(t) * 1.01, shape.top(t) - 0.2 - R1(j * 17 + sx) * 1.5, zAt(t), sx > 0 ? 2 : 3); }
      for (let j = 0; j < C[2]; j++) { const t = 0.08 + (j + 0.5) / C[2] * 0.84;                // along the rails
        emit(sx * shape.halfW(t) * 0.92, shape.top(t) + 0.15, zAt(t), sx > 0 ? 2 : 3); }
    }
    for (let j = 0; j < C[3]; j++) { const t = 0.12 + R1(j * 29 + 3) * 0.76;                     // up through the deck
      emit((R1(j * 31 + 7) - 0.5) * shape.halfW(t) * 1.3, shape.top(t) - deckDrop + 0.2, zAt(t), 4); }
    for (let j = 0; j < C[4]; j++) { const t = 0.015 + R1(j * 37 + 1) * 0.06;                     // the stern / transom
      emit((R1(j * 41 + 9) - 0.5) * shape.halfW(t) * 1.8, shape.top(t) - R1(j * 43) * 1.6, zAt(t) - 0.1, 4); }
    pos.push(0, shape.top(0.5) + len * 0.35, 0); seed.push(0, 0, 0, 1); // halo
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 4));
    _flameGeo.set(key, g);
  }
  const p = new THREE.Points(_flameGeo.get(key), _flameMat); p.frustumCulled = false; p.renderOrder = 3;
  p.userData.sharedGeo = true; p.userData.flamingFlames = true;
  const L = ud.len; p.onBeforeRender = (r) => { const U = _flameMat.uniforms; U.uPR.value = r.getPixelRatio(); U.uLen.value = L; U.uSpeed.value = shipSpeed(ship); _flameMat.uniformsNeedUpdate = true; };
  return p;
}

// ---------- smoke + trailing fire + embers in the wake (one Points draw per ship, on the ship, level with the water) ----------
// seed.w < 0.4: smoke puff (dark, big, rises; thin drift even at rest), < 0.75: trailing fire on the water behind the
// stern (only while moving, length scales with speed), else ember (bright, small, arcs up then falls).
const _wakeMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime, uSpeed: { value: 0 }, uBox: { value: new THREE.Vector3() }, uPR: { value: 1 } },
  vertexShader: `attribute vec4 seed; uniform float uT; uniform float uSpeed; uniform vec3 uBox; uniform float uPR; varying float vA; varying float vKind; varying float vLife;
    void main(){ float kind = seed.w < 0.4 ? 0.0 : (seed.w < 0.75 ? 1.0 : 2.0); vKind = kind;
      float life = fract(uT * (kind < 0.5 ? 0.16 + seed.z * 0.08 : (kind < 1.5 ? 0.55 + seed.z * 0.4 : 0.45 + seed.z * 0.3)) + seed.x); vLife = life;
      float sp = kind < 0.5 ? max(uSpeed, 0.18) : uSpeed;
      float back = life * uBox.y * (kind > 0.5 && kind < 1.5 ? 0.15 + 1.1 * uSpeed : 0.25 + 0.75 * uSpeed);
      vec3 p = vec3((seed.y - 0.5) * uBox.x * (kind > 0.5 && kind < 1.5 ? 0.5 + life * 0.5 : 0.4 + life * 1.3), 0.0, uBox.z - back);
      p.y = kind < 0.5 ? 1.0 + life * (3.0 + seed.z * 3.0) : (kind < 1.5 ? 0.3 + life * (1.2 + seed.z * 2.6) : 0.4 + sin(life * 3.1416) * (1.5 + seed.z * 2.0));
      p.x += sin(uT * 1.3 + seed.x * 20.0) * life * 0.8;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = max(1.0, -mv.z);
      vA = (kind < 0.5 ? (1.0 - life) * smoothstep(0.0, 0.12, life) * 0.42 : (1.0 - life) * smoothstep(0.0, 0.06, life)) * sp;
      float sz = kind < 0.5 ? (1.6 + seed.z * 1.6) * (0.5 + life * 1.4) : (kind < 1.5 ? (1.3 + seed.z * 1.8) * (1.0 - life * 0.4) : 0.25 + seed.z * 0.25);
      gl_PointSize = clamp(sz * 260.0 / d, 1.5, 120.0) * uPR;
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; varying float vKind; varying float vLife;
    void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5) discard;
      if (vKind < 0.5) { float a = smoothstep(0.5, 0.1, r) * vA; if (a < 0.01) discard;
        vec3 c = mix(vec3(0.32, 0.12, 0.05), vec3(0.09, 0.08, 0.08), smoothstep(0.0, 0.35, vLife)); gl_FragColor = vec4(c, a); return; }
      float a = smoothstep(0.5, 0.0, r) * vA; if (a < 0.02) discard;
      vec3 c = vKind < 1.5 ? mix(mix(vec3(1.0, 0.9, 0.45), vec3(1.0, 0.42, 0.06), smoothstep(0.0, 0.4, vLife)), vec3(0.6, 0.07, 0.02), smoothstep(0.4, 0.9, vLife))
                           : mix(vec3(1.0, 0.85, 0.4), vec3(1.0, 0.3, 0.04), vLife);
      gl_FragColor = vec4(c * 1.8, a); }`,
  transparent: true, depthWrite: false,
});
const _wakeGeo = new Map();
function wakeGeo(n) {
  if (!_wakeGeo.has(n)) {
    const g = new THREE.BufferGeometry(), s = new Float32Array(n * 4);
    for (let i = 0; i < s.length; i++) s[i] = R1(i + 91);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 4));
    _wakeGeo.set(n, g);
  }
  return _wakeGeo.get(n);
}
function wake(ship, ud, quality) {
  const p = new THREE.Points(wakeGeo(quality === 'low' ? 22 : 72), _wakeMat); p.frustumCulled = false; p.renderOrder = 4;
  p.userData.sharedGeo = true; p.userData.flamingWake = true;
  const box = new THREE.Vector3(ud.beam, ud.len * 1.1, -ud.len * 0.46); // per-ship values, pushed into the shared material
  p.onBeforeRender = (r) => {
    const U = _wakeMat.uniforms; U.uSpeed.value = shipSpeed(ship); U.uBox.value.copy(box); U.uPR.value = r.getPixelRatio(); _wakeMat.uniformsNeedUpdate = true;
  };
  return p;
}
// each ship's own speed drives its trailing fire and wake, never the local player's. Priority: a speed fed by
// flamingTick() (remote ships: the synced speed), else ship.userData.speed, else measured from the ship's own movement.
// Returns the smoothed 0..1 "full sail" factor (ud.flaming.v), measured once per frame per ship.
const _wp = new THREE.Vector3();
const SPEED_FULL = 10; // world units / s that count as "full sail" (game ships top out around 7-12)
function shipSpeed(ship) {
  const ud = ship.userData, now = performance.now(), S = ud.flaming || (ud.flaming = { t: now, x: 0, z: 0, v: 0 });
  if (S.v === undefined) S.v = 0;
  if (now - S.t < 12) return S.v; // the scene can render more than once a frame; measure once per frame
  const dt = Math.min(0.25, (now - S.t) / 1000);
  ship.getWorldPosition(_wp);
  let v;
  if (S.fedAt && now - S.fedAt < 600) v = S.fed;
  else if (typeof ud.speed === 'number') v = ud.speed;
  else v = Math.hypot(_wp.x - S.x, _wp.z - S.z) / dt;
  S.x = _wp.x; S.z = _wp.z; S.t = now;
  const k = Math.min(1, Math.max(0, Math.abs(v) / SPEED_FULL));
  S.v += (k - S.v) * Math.min(1, dt * 4); // smooth, so a jittery synced speed doesn't flicker
  // lantern light (only ships built with light: true have one) flickers like firelight on the shared clock
  const t = wind.uTime.value;
  for (const L of S.lights || []) L.intensity = L.userData.flBase * (0.8 + 0.12 * Math.sin(t * 11.0) + 0.08 * Math.sin(t * 23.0 + 1.3));
  return S.v;
}

// ---------- heat shimmer: one camera-facing quad above the deck (high quality only, no post-processing) ----------
// faint warm wavy bands that crawl upward; billboarded in the vertex shader from a baked centre attribute.
const _shimMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime },
  vertexShader: `attribute vec3 aC; uniform float uT; varying vec2 vUv;
    void main(){ vUv = uv; float sc = length(modelMatrix[0].xyz);
      vec4 mv = modelViewMatrix * vec4(aC, 1.0); mv.xy += position.xy * sc;
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uT; varying vec2 vUv;
    void main(){ float w = sin(vUv.y * 38.0 - uT * 7.0 + sin(vUv.x * 9.0 + uT * 2.3) * 2.2) * 0.5 + 0.5;
      float edge = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x) * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
      float a = pow(w, 3.0) * edge * 0.09; if (a < 0.004) discard;
      gl_FragColor = vec4(vec3(1.0, 0.55, 0.25) * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const _shimGeo = new Map();
function shimmer(ud) {
  const { len, layout } = ud, key = len.toFixed(2);
  if (!_shimGeo.has(key)) {
    const w = ud.beam * 2.2, h = len * 0.75, g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0);
    const c = [0, layout.shape.top(0.5) + 0.3, 0], a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) a.set(c, i);
    g.setAttribute('aC', new THREE.BufferAttribute(a, 3)); _shimGeo.set(key, g);
  }
  const m = new THREE.Mesh(_shimGeo.get(key), _shimMat); m.frustumCulled = false; m.renderOrder = 5;
  m.userData.sharedGeo = true; m.userData.flamingShimmer = true; return m;
}

// Optional per-frame hook for ships whose speed comes from the network (PvP remote ships):
//   flamingTick(ship, { speed })   speed in world units / s (the synced value); dt / camera are accepted, unused.
// Safe to call on any ship (no-op unless ship.userData.skinId === 'flaming'). All flame / crack / shimmer
// animation runs on the shared wind.uTime clock (main.js sets it each frame), so every client sees the same fire.
// Without the hook a ship's wake reads userData.speed or measures the ship's own movement: nothing depends on the
// local player.
export function flamingTick(ship, { speed } = {}) {
  const ud = ship?.userData; if (!ud || ud.skinId !== 'flaming' || typeof speed !== 'number') return;
  const S = ud.flaming || (ud.flaming = { t: performance.now(), x: 0, z: 0, v: 0 });
  S.fed = speed; S.fedAt = performance.now();
}

// ---------- the override (see ./partsOverride.js for ctx) ----------
export function flamingPartsOverride(ship, ctx) {
  const M = mats(), low = ctx.quality === 'low';
  if (!low) {
    const stakes = new THREE.Mesh(stakeGeo(ctx.ud), M.char); stakes.userData.sharedGeo = true;
    const line = outlineFor(stakes, 0.05); line.material = M.line; line.userData.sharedGeo = false; // own smoothed copy
    ctx.add(stakes); ctx.add(line);
    ctx.add(shimmer(ctx.ud));
  }
  ctx.add(flames(ship, ctx.ud, ctx.quality));                        // on the bobbing body, with the sails
  ctx.add(wake(ship, ctx.ud, ctx.quality), ship);                         // on the ship (not the body), level with the water
  const S = ctx.ud.flaming || (ctx.ud.flaming = { t: performance.now(), x: 0, z: 0, v: 0 });
  S.lights = [];
  ship.traverse(o => { if (o.isPointLight) { o.color.set(0xffa070); o.userData.flBase = o.intensity *= 0.45; S.lights.push(o); } });
}
FLAMING.materialFx = flamingMaterialFx;
FLAMING.partsOverride = flamingPartsOverride;
export default FLAMING;
