// [Raul] PvP GHOST SHIP specialty build, unlocks at GHOST_KILLS lifetime kills. Cosmetic only.
// Tattered spectral wreck: see-through glowing hull with a ragged, broken gunwale, a dark rib cage showing
// through it, shredded sails (alpha-tested holes, no sorting cost), and wispy green mist that clings to the
// waterline and streams aft with the ship's own speed. Hitbox untouched (partsOverride API).
// Cost: +3 draw calls net (spectral hull + ribs replace hull + outline; +rib outline... none; +mist Points; torn sails reuse
// the sail meshes). Low quality: fewer sections / ribs, 12 mist puffs instead of 36.
import { THREE, toon, place, merge, meshOf, loftHull, injectShine, fxOf, hash, wind } from './pvpKit.js';

export const GHOST_KILLS = 300; // change the tier here only

const SPECTRAL = `
  float flick = 0.75 + 0.25 * sin(uKT * 5.0 + vKW.z * 0.4) * sin(uKT * 1.7 + vKW.x);
  float wisp = 0.5 + 0.5 * sin(vKW.y * 3.0 - uKT * 2.0 + sin(vKW.z * 0.7 + uKT) * 2.0);
  totalEmissiveRadiance += vec3(0.25, 1.0, 0.6) * (fres * 1.4 + wisp * 0.18) * flick * uGK;`;
let _torn = null;
function tornTex() { // ragged holes + shredded foot (alpha map; white = cloth)
  if (_torn) return _torn;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#000';
  let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 10; i++) { g.beginPath(); const x = r() * 128, y = 18 + r() * 84; g.moveTo(x, y); for (let k = 0; k < 7; k++) g.lineTo(x + (r() - 0.5) * 36, y + (r() - 0.5) * 30); g.fill(); }
  g.beginPath(); g.moveTo(0, 0); for (let x = 0; x <= 128; x += 6) g.lineTo(x, 100 + r() * 26 - (x % 24 === 0 ? 18 : 0)); g.lineTo(128, 0); g.closePath();
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = '#fff'; g.fill(); g.globalCompositeOperation = 'source-over';
  _torn = new THREE.CanvasTexture(c); return _torn;
}
const _sail = new Map();
function tornSail(m) {
  if (_sail.has(m)) return _sail.get(m);
  const n = m.clone(); n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey;
  n.alphaMap = tornTex(); n.alphaTest = 0.5; n.transparent = true; n.depthWrite = false;
  _sail.set(m, n); return n;
}
const _geo = new Map();
function geos(ud, low) {
  const { len, beam, depth, layout } = ud, { shape } = layout, key = [len, beam, depth].map(v => v.toFixed(2)).join('|') + low;
  if (_geo.has(key)) return _geo.get(key);
  const zAt = (t) => (t - 0.5) * len, N = low ? 12 : 18;
  // broken gunwale: each section drops by a jagged amount (bigger bites amidships), hull flares a little
  const jag = (t) => { const i = Math.round(t * N * 1.7); return (hash(i) * 0.9 + (hash(i + 50) > 0.7 ? 0.7 : 0)) * (0.4 + Math.sin(t * Math.PI) * 0.8); };
  const ring = (t) => { const w = shape.halfW(t) * 1.02, yt = shape.top(t) - jag(t), yk = shape.keel(t), h = yt - yk;
    return [[w * 0.98, yt], [w * 1.04, yt - h * 0.35], [w * 0.8, yt - h * 0.78], [0, yk]]; };
  const hull = loftHull(len, ring, N);
  // rib cage: bony arcs every section, visible through the spectral planks
  const ribs = [], nr = low ? 6 : 10;
  for (let i = 0; i < nr; i++) {
    const t = 0.08 + i / (nr - 1) * 0.82, w = shape.halfW(t), yt = shape.top(t) + 0.2, yk = shape.keel(t), pts = [];
    for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * w * 0.94, yk + (yt - yk) * (1 - Math.pow(Math.sin(a), 1.4)) + Math.sin(a) * 0.05, zAt(t))); }
    ribs.push(place(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), low ? 8 : 14, 0.1, 4, false)));
  }
  // keelson spine
  const sp = []; for (let i = 0; i <= 10; i++) { const t = 0.05 + i / 10 * 0.9; sp.push(new THREE.Vector3(0, shape.keel(t) + 0.15, zAt(t))); }
  ribs.push(place(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp), 16, 0.14, 4, false)));
  const out = { hull, ribs: merge(ribs) }; _geo.set(key, out); return out;
}
// waterline mist: soft puffs that rise, swell and stream aft with the ship's own speed (GPU-animated)
const _mistMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime, uSpeed: { value: 0 }, uAlive: { value: 1 }, uBox: { value: new THREE.Vector3() } },
  vertexShader: `attribute vec3 seed; uniform float uT; uniform float uSpeed; uniform float uAlive; uniform vec3 uBox; varying float vA;
    void main(){ float life = fract(uT * (0.08 + seed.z * 0.06) + seed.x);
      float side = seed.y < 0.5 ? -1.0 : 1.0;
      vec3 p = vec3(side * uBox.x * (0.45 + life * 0.5), 0.2 + life * 2.2, (seed.y * 2.0 - 1.0) * uBox.y * 0.5 - life * uSpeed * uBox.y * 0.6);
      p.x += sin(uT * 0.7 + seed.x * 20.0) * 0.6;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vA = sin(life * 3.14159) * 0.32 * uAlive;
      gl_PointSize = (3.5 + life * 5.0) * 120.0 / max(1.0, -mv.z) * (1.0 + seed.z);
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = pow(max(0.0, 1.0 - d * 2.0), 1.8) * vA; if (a < 0.01) discard;
      gl_FragColor = vec4(vec3(0.55, 1.0, 0.78) * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const _mistGeo = new Map();
function mist(ud, low, F) {
  const n = low ? 12 : 36;
  if (!_mistGeo.has(n)) { const g = new THREE.BufferGeometry(), s = new Float32Array(n * 3); for (let i = 0; i < s.length; i++) s[i] = hash(i + 7);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 3)); _mistGeo.set(n, g); }
  const m = _mistMat.clone(); m.uniforms.uT = wind.uTime; m.uniforms.uBox.value.set(ud.beam, ud.len, 0);
  F.uSpeed = m.uniforms.uSpeed; F.uAlive = m.uniforms.uAlive;
  const p = new THREE.Points(_mistGeo.get(n), m); p.frustumCulled = false; p.renderOrder = 4; p.userData.sharedGeo = true;
  return p;
}
let _hullMat = null, _ribMat = null;
export function ghostPartsOverride(ship, ctx) {
  const low = ctx.quality === 'low', G = geos(ctx.ud, low), F = fxOf(ship);
  ctx.hide(ctx.base.hull); ctx.hide(ctx.base.hullOutline);
  _hullMat = _hullMat || (() => { const m = toon(0x6a9a84, null, { side: THREE.DoubleSide, transparent: true, opacity: 0.42, depthWrite: false });
    m.emissive = new THREE.Color(0x1f9a5a); m.emissiveIntensity = 0.45; return injectShine(m, SPECTRAL, { uGK: { value: 1 } }, 'pvp-ghost'); })();
  _ribMat = _ribMat || (() => { const m = toon(0x2a3a32, null); m.emissive = new THREE.Color(0x0f4a2a); m.emissiveIntensity = 0.5; return m; })();
  meshOf(G.ribs, _ribMat, ctx, { outline: low ? 0 : 0.04 });
  const h = meshOf(G.hull, _hullMat, ctx); h.renderOrder = 2;
  ship.traverse(o => { if (o.isMesh && o.material?.customProgramCacheKey?.() === 'sail') o.material = tornSail(o.material); });
  ctx.add(mist(ctx.ud, low, F), ship); // on the ship (level with the water), not the bobbing body
}
// per-frame (local + remote): mist streams aft with this ship's speed, fades out when it sinks. No-op on other skins.
export function ghostTick(mesh, { speed = 0, alive = true, dt = 1 / 60 } = {}) {
  if (mesh?.userData?.skinId !== 'ghost') return;
  const F = mesh.userData.pvpFx; if (!F?.uSpeed) return;
  const k = Math.min(1, Math.abs(speed) / 10), e = Math.min(1, dt * 3);
  F.uSpeed.value += (k - F.uSpeed.value) * e; F.uAlive.value += ((alive ? 1 : 0) - F.uAlive.value) * e;
}
export const GHOST_PVP = { id: 'ghost', killsRequired: GHOST_KILLS, partsOverride: ghostPartsOverride, tick: ghostTick };
export default GHOST_PVP;
