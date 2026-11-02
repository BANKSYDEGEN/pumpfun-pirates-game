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
// [Timothy v2] tentacles stay OUTSIDE the ship at every hull length and through the whole sway: they rise from the sea
// beyond the gun muzzles, climb the side clear of the ports / lids, arch over ABOVE the rail line (never across the deck
// or the crew) and curl back out to sea. Placed on the stretched hull (layout.zAt). Every sample sphere of the flesh is
// kept in ud.krakenProbe for tools/ship_tests/kraken_check.py (BVH check against hull, dress, cannons, sails, crew).
function geos(ud, low, muzX) {
  const { beam, depth, layout } = ud, { shape, bowY } = layout, zAt = layout.zAt, key = [ud.len, beam, depth, muzX].map(v => v.toFixed(2)).join('|') + low + (ud.art ? 'a' : '');
  if (_geo.has(key)) return _geo.get(key);
  const parts = [], eyes = [], probe = [];
  const rail = (t) => ud.art ? ud.art.railY(t) : shape.top(t) + 0.7;
  const spots = low ? [[1, 0.3], [-1, 0.62], [1, 0.74], [-1, 0.2]] : [[1, 0.17], [1, 0.47], [1, 0.75], [-1, 0.27], [-1, 0.57], [-1, 0.8]];
  spots.forEach(([sx, t], i) => {
    const W = shape.halfW(t) * 1.04 + 0.18, top = shape.top(t), R = rail(t), z0 = zAt(t), lean = (i % 2 ? 1 : -1) * (0.9 + hash(i) * 0.8), c = 0.9 + hash(i + 9) * 0.25;
    const X0 = Math.max(muzX + 1.0, W + 1.25); // clear of the barrels and the open port lids
    const P = [[X0 + 1.6, -2.6, z0 - lean], [X0 + 0.9, -0.9, z0 - lean * 0.6], [X0 + 0.35, top * 0.45, z0 - lean * 0.3], [X0 + 0.15, top + 0.55, z0 - lean * 0.1],
      [W + 1.15, R + 1.15 * c, z0 + lean * 0.1], [W + 1.25, R + 2.0 * c, z0 + lean * 0.3], [W + 2.1, R + 2.35 * c, z0 + lean * 0.45], [W + 2.9, R + 1.7 * c, z0 + lean * 0.55], [W + 2.7, R + 1.0 * c, z0 + lean * 0.5]]
      .map(p => new THREE.Vector3(sx * p[0], p[1], p[2]));
    const r0 = 0.7, r1 = 0.07, { geo, curve } = taperTube(P, r0, r1, low ? 16 : 28, low ? 5 : 7);
    { const a = geo.attributes.sway.array; for (let q = 0; q < a.length; q++) a[q] += (i + 1) * 2; } // tentacle id in the integer part (phase), u in [0,1]
    parts.push(paint(geo, FLESH));
    for (let k = 0; k <= 40; k++) { const u = k / 40, p = curve.getPointAt(u); probe.push([p.x, p.y, p.z, r0 + (r1 - r0) * u, (i + 1) * 2 + u]); }
    // suction cups on the underside of the arch (facing the sea / the hull side below them)
    const nc = low ? 5 : 9;
    for (let k = 1; k <= nc; k++) { const u = 0.12 + k / (nc + 1) * 0.7, c = curve.getPointAt(u), r = r0 + (r1 - r0) * u, cr = Math.max(0.07, r * 0.42);
      const cp = [c.x - sx * r * 0.55, c.y - r * 0.45, c.z];
      parts.push(paint(place(new THREE.SphereGeometry(cr, 6, 4), cp, [0, 0, sx * Math.PI / 2], [1, 0.45, 1]), CUP, u + (i + 1) * 2));
      probe.push([...cp, cr, (i + 1) * 2 + u]); }
  });
  // the kraken's head surfaces off the port bow (clear of the stem, figurehead, bowsprit and ram): mantle, brow ridge, eyes and
  // 5 curled arms reaching down into the sea. Built facing +Z, then the whole head group is offset (hx) out to port.
  const hx = shape.halfW(0.9) * 1.04 + 0.18 + 2.5, hz = zAt(0.93) - 0.4, hy = 0.15, hs = 0.95, H0 = parts.length, E0 = probe.length;
  parts.push(paint(place(new THREE.SphereGeometry(1.0, 12, 10), [0, hy + 0.5 * hs, hz], [-0.5, 0, 0], [hs, 1.35 * hs, 1.05 * hs]), HEAD));
  probe.push([0, hy + 0.5 * hs, hz, 1.0 * hs, 0], [0, hy + 1.1 * hs, hz - 0.2, 0.8 * hs, 0], [0, hy - 0.1 * hs, hz + 0.1, 0.8 * hs, 0]);
  parts.push(paint(place(new THREE.TorusGeometry(0.62 * hs, 0.14 * hs, 5, 12, Math.PI), [0, hy + 0.35 * hs, hz + 0.55 * hs], [0.2, 0, 0]), HEAD));
  for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.5, pts = []; for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push(new THREE.Vector3(Math.sin(a) * (0.5 + u * 0.4) * hs + Math.sin(u * 5) * 0.15 * Math.sign(a || 1), hy - 0.3 * hs - u * 1.4 * hs + Math.sin(u * 4) * 0.2, hz + 0.4 * hs + Math.cos(a) * u * 0.9 * hs)); }
    const { geo: tg, curve } = taperTube(pts, 0.26 * hs, 0.05, low ? 8 : 12, 5); { const a = tg.attributes.sway.array; for (let q = 0; q < a.length; q++) a[q] = a[q] * 0.7 + (10 + i) * 2; } // figurehead arms: gentler
    for (let k = 0; k <= 12; k++) { const u = k / 12, p = curve.getPointAt(u); probe.push([p.x, p.y, p.z, 0.26 * hs + (0.05 - 0.26 * hs) * u, (10 + i) * 2 + u * 0.7]); }
    parts.push(paint(tg, FLESH)); }
  for (const sx of [1, -1]) eyes.push(place(new THREE.SphereGeometry(0.2 * hs, 8, 6), [sx * 0.45 * hs, hy + 0.3 * hs, hz + 0.88 * hs]));
  for (let i = H0; i < parts.length; i++) parts[i].translate(hx, 0, 0); eyes.forEach(e => e.translate(hx, 0, 0)); for (let i = E0; i < probe.length; i++) probe[i][0] += hx;
  const out = { flesh: mergeAll(parts), eyes: mergeAll(eyes.map(e => paint(e, CUP))), probe };
  _geo.set(key, out); return out;
}
// CPU twin of SWAY_V (the check samples the animation with it): sway = id * 2 + u, xs = sign(local x)
export function krakenSway(sway, xs, T, phase, amp) {
  const id = Math.floor(sway * 0.5), u = sway - id * 2; if (id < 0.5) return [0, 0, 0];
  const ph = id * 1.93 + phase, w = u * u * (3 - 2 * u), t = T * 1.1, a = Math.sin(t - u * 4.5 + ph), b = Math.cos(t * 0.8 - u * 3.5 + ph * 1.7), k = (id > 9.5 ? 0.25 : 0.75) * Math.min(amp, 1.6) * w;
  return [xs * Math.abs(b) * 0.35 * k, (a * 0.55 + 0.2 * b) * k, (b * 0.8 + a * 0.3) * k];
}
const SWAY_V = `#include <begin_vertex>
  { // [v87] organic curl: a wave travels from base to tip, bending more toward the tip, each tentacle on its own phase.
    // sway = tentacle id * 2 + u (u: 0 root .. 1 tip; id 0 = rigid). Sideways motion only pushes AWAY from the hull centreline.
    float id = floor(sway * 0.5), u = sway - id * 2.0;
    if (id > 0.5) { float ph = id * 1.93 + uKPhase, w = u * u * (3.0 - 2.0 * u), t = uKT * 1.1;
      float a = sin(t - u * 4.5 + ph), b = cos(t * 0.8 - u * 3.5 + ph * 1.7);
      float amp = (id > 9.5 ? 0.25 : 0.75) * min(uSway, 1.6);
      transformed += vec3(sign(position.x) * abs(b) * 0.35, a * 0.55 + 0.2 * b, b * 0.8 + a * 0.3) * w * amp; } }`;
const SLIME = `totalEmissiveRadiance += vec3(0.55, 0.25, 0.9) * fres * 0.7 + vec3(0.9, 0.7, 1.0) * pow(max(dot(Rw, normalize(vec3(0.45, 0.75, 0.48))), 0.0), 40.0) * 0.8;`;
export function krakenPartsOverride(ship, ctx) {
  const low = ctx.quality === 'low', F = fxOf(ship);
  ship.updateMatrixWorld(true); const v = new THREE.Vector3(); let muzX = 0;
  for (const m of [...(ctx.ud.muzzles?.port || []), ...(ctx.ud.muzzles?.star || [])]) { ctx.body.worldToLocal(m.getWorldPosition(v)); muzX = Math.max(muzX, Math.abs(v.x)); }
  const G = geos(ctx.ud, low, muzX); ctx.ud.krakenProbe = G.probe;
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
  const e = new THREE.Mesh(G.eyes, eye); e.userData.sharedGeo = true; ctx.add(e); flesh.userData.kraken = e.userData.kraken = true; ctx.ud.krakenFx = F;
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
