// [Raul] PvP KRAKEN specialty build, unlocks at KRAKEN_KILLS lifetime kills. Cosmetic only. Built on the KRAKEN INK
// palette (mobileSkins.js). Thick tapered tentacles rise out of the sea, wrap both sides of the hull and curl over the
// rails, rows of pale suction cups, a bulbous kraken figurehead with glowing eyes and curled arms on the bow, and a
// slow tentacle sway in the vertex shader (stronger as the ship moves). Hitbox untouched (partsOverride API).
// Cost: +2 draw calls (one vertex-coloured tentacle/sucker/head mesh, one eye glow mesh). Low quality: 4 tentacles, fewer segments.
import { THREE, toon, place, taperTube, injectShine, fxOf, hash, wind, liftRig, signatureWake } from './pvpKit.js';

export const KRAKEN_KILLS = 600; // change the tier here only

const FLESH = new THREE.Color(0x4a1f6a), CUP = new THREE.Color(0xe0b8ff), HEAD = new THREE.Color(0x3a1656);
function paint(g, c, sway = null) {
  g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.sway) g.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(n).fill(sway ?? 0), 1));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'sway'].includes(k)) g.deleteAttribute(k);
  return g;
}
function mergeAll(list) { // own merge: all non-indexed with position/normal/color/sway
  const keys = ['position', 'normal', 'color', 'sway'], out = new THREE.BufferGeometry();
  for (const k of keys) { const sz = list[0].attributes[k].itemSize, total = list.reduce((a, g) => a + g.attributes[k].array.length, 0), arr = new Float32Array(total); let o = 0;
    for (const g of list) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(arr, sz)); }
  return out;
}
const _geo = new Map();
function geos(ud, low) {
  const { len, beam, depth, layout } = ud, { shape, bowY } = layout, key = [len, beam, depth].map(v => v.toFixed(2)).join('|') + low;
  if (_geo.has(key)) return _geo.get(key);
  const zAt = (t) => (t - 0.5) * len, parts = [], eyes = [];
  const spots = low ? [[1, 0.3], [-1, 0.62], [1, 0.72], [-1, 0.2]] : [[1, 0.2], [1, 0.48], [1, 0.74], [-1, 0.28], [-1, 0.58], [-1, 0.8]];
  spots.forEach(([sx, t], i) => {
    const w = shape.halfW(t), top = shape.top(t), z0 = zAt(t), lean = (i % 2 ? 1 : -1) * (1.5 + hash(i) * 1.5), c = 0.85 + hash(i + 9) * 0.4;
    const P = [[sx * (w + 2.2), -2.6, z0 - lean], [sx * (w + 1.4), -0.5, z0 - lean * 0.6], [sx * (w + 0.7), top * 0.6, z0 - lean * 0.2], [sx * (w + 0.35), top + 0.7, z0 + lean * 0.2],
      [sx * w * 0.55, top + 1.9 * c, z0 + lean * 0.5], [sx * w * 0.15, top + 3.0 * c, z0 + lean * 0.8], [sx * w * 0.45, top + 3.9 * c, z0 + lean * 1.1], [sx * w * 0.95, top + 3.6 * c, z0 + lean * 0.95], [sx * w * 0.85, top + 2.8 * c, z0 + lean * 0.75]]
      .map(p => new THREE.Vector3(...p));
    const { geo, curve } = taperTube(P, 0.7, 0.07, low ? 16 : 28, low ? 5 : 7);
    parts.push(paint(geo, FLESH));
    // suction cups along the underside, facing the hull
    const nc = low ? 5 : 9;
    for (let k = 1; k <= nc; k++) { const u = 0.12 + k / (nc + 1) * 0.7, c = curve.getPointAt(u), r = 0.62 + (0.07 - 0.62) * u;
      const cup = place(new THREE.SphereGeometry(Math.max(0.07, r * 0.42), 6, 4), [c.x - sx * r * 0.75, c.y, c.z], [0, 0, sx * Math.PI / 2], [1, 0.45, 1]);
      parts.push(paint(cup, CUP, u)); }
  });
  // kraken figurehead: bulbous mantle, brow ridge, 5 curled arms under it
  const hz = zAt(1) + 0.9, hy = bowY + 0.6;
  parts.push(paint(place(new THREE.SphereGeometry(1.0, 12, 10), [0, hy + 0.5, hz], [-0.5, 0, 0], [1.0, 1.45, 1.1]), HEAD));
  parts.push(paint(place(new THREE.TorusGeometry(0.62, 0.14, 5, 12, Math.PI), [0, hy + 0.35, hz + 0.55], [0.2, 0, 0]), HEAD));
  for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.5, pts = []; for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push(new THREE.Vector3(Math.sin(a) * (0.5 + u * 0.4) + Math.sin(u * 5) * 0.15 * Math.sign(a || 1), hy - 0.3 - u * 1.4 + Math.sin(u * 4) * 0.25, hz + 0.4 + Math.cos(a) * u * 0.9)); }
    parts.push(paint(taperTube(pts, 0.26, 0.05, low ? 8 : 12, 5).geo, FLESH)); }
  for (const sx of [1, -1]) eyes.push(place(new THREE.SphereGeometry(0.2, 8, 6), [sx * 0.45, hy + 0.3, hz + 0.88]));
  const out = { flesh: mergeAll(parts), eyes: (() => { const g = eyes.length > 1 ? mergeAll(eyes.map(e => paint(e, CUP))) : eyes[0]; return g; })() };
  _geo.set(key, out); return out;
}
const SWAY_V = `#include <begin_vertex>
  { float w = sway * sway; transformed += vec3(sin(uKT * 1.5 + position.y * 0.8 + uKPhase), 0.0, cos(uKT * 1.2 + position.z * 0.6 + uKPhase)) * 0.28 * w * uSway; }`;
const SLIME = `totalEmissiveRadiance += vec3(0.55, 0.25, 0.9) * fres * 0.7 + vec3(0.9, 0.7, 1.0) * pow(max(dot(Rw, normalize(vec3(0.45, 0.75, 0.48))), 0.0), 40.0) * 0.8;`;
export function krakenPartsOverride(ship, ctx) {
  const low = ctx.quality === 'low', G = geos(ctx.ud, low), F = fxOf(ship);
  F.uSway = { value: 1 }; F.uKPhase = { value: hash(ship.id) * 6.28 };
  // per-ship clone (same program) so each ship sways on its own phase / speed
  const m = toon(0xffffff, null, { vertexColors: true }); m.emissive = new THREE.Color(0x1a0630); m.emissiveIntensity = 0.5;
  injectShine(m, SLIME, {}, 'pvp-kraken');
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (s, r) => { prev(s, r); s.uniforms.uSway = F.uSway; s.uniforms.uKPhase = F.uKPhase;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float sway; uniform float uSway; uniform float uKPhase; uniform float uKT;').replace('#include <begin_vertex>', SWAY_V);
    s.uniforms.uKT = s.uniforms.uKT || wind.uTime; };
  const flesh = new THREE.Mesh(G.flesh, m); flesh.userData.sharedGeo = true; ctx.add(flesh);
  const eye = new THREE.MeshBasicMaterial(); eye.color.set(0xd8ff4a).multiplyScalar(2.4);
  const e = new THREE.Mesh(G.eyes, eye); e.userData.sharedGeo = true; ctx.add(e);
  signatureWake(ship, ctx, { c0: 0xe0a0ff, c1: 0x7a20ff, n: 44, size: 330, rise: 0.3 }); // bioluminescent wake
  liftRig(ctx, { lift: 0.5, sx: 1.1, sy: 1.2, sz: 1.1 });
}
// per-frame (local + remote): tentacles sway harder as this ship moves. No-op on other skins.
export function krakenTick(mesh, { speed = 0, dt = 1 / 60 } = {}) {
  if (mesh?.userData?.skinId !== 'kraken') return;
  const F = mesh.userData.pvpFx; if (!F?.uSway) return;
  F.uSway.value += ((1 + Math.min(1, Math.abs(speed) / 10) * 1.4) - F.uSway.value) * Math.min(1, dt * 2);
  F.uKPhase.value += dt * Math.abs(speed) * 0.08;
}
export const KRAKEN_PVP = { id: 'kraken', killsRequired: KRAKEN_KILLS, partsOverride: krakenPartsOverride, tick: krakenTick };
export default KRAKEN_PVP;
