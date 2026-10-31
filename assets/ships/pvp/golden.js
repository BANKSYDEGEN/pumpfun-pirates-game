// [Raul] PvP GOLDEN GALLEON specialty build, unlocks at GOLDEN_KILLS lifetime kills. Cosmetic only.
// Ornate gilded galleon: high-sheered galleon hull (towering stern), two-tier red-lacquer stern castle with gold
// rails, quarter-gallery towers, glowing stern gallery windows, forecastle, gold strakes, gilded lion figurehead,
// metallic gold with a travelling glint sweep. Hitbox untouched (partsOverride API restores len/beam/depth).
// Cost: +4 draw calls net (galleon hull + outline replace the base hull + outline; +gold, +gold outline, +lacquer, +windows).
// Low quality: fewer hull sections / rail posts, no outlines on the small gold parts.
import { THREE, toon, place, merge, meshOf, loftHull, injectShine, fxOf, hash, liftRig, signatureWake } from './pvpKit.js';

export const GOLDEN_KILLS = 150; // change the tier here only

// polished gold: saturated yellow-gold base (texture kept only as luminance = gold-leaf panel lines), toon-banded fake
// env reflection dark amber -> white-gold, hard specular hotspot, fresnel rim, fast glint sweeps, 4-point star sparkles
const GOLD_COLOR = `#include <color_fragment>
  { float lum = clamp(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)) * uLumK, 0.0, 1.0);
    float red = smoothstep(0.2, 0.45, diffuseColor.r - max(diffuseColor.g, diffuseColor.b));   // painted red stripes / sail edging stay red
    diffuseColor.rgb = mix(mix(vec3(0.62, 0.36, 0.02), vec3(1.0, 0.78, 0.18), smoothstep(0.25, 0.85, lum)) * uTint * 0.72, vec3(0.95, 0.06, 0.09), red); }`;
// bright glossy red lacquer with a clear-coat highlight (castles, quarter galleries, forecastle)
const LACQUER = `
  vec3 L = normalize(vec3(0.45, 0.75, 0.48)); float sd = max(dot(Rw, L), 0.0);
  float band = smoothstep(0.04, 0.0, abs(Rw.y - 0.1));
  totalEmissiveRadiance += vec3(0.5, 0.0, 0.02) * 0.12 + vec3(1.0, 0.92, 0.9) * (pow(sd, 90.0) * 2.4 + band * 0.5) + vec3(1.0, 0.2, 0.2) * fres * 0.3;`;
const GOLD_FRAG = `
  vec3 L = normalize(vec3(0.45, 0.75, 0.48));
  float e = smoothstep(-0.35, 0.65, Rw.y); e = floor(e * 4.0 + 0.5) / 4.0;                 // toon reflection bands
  vec3 env = mix(vec3(0.10, 0.03, 0.0), vec3(1.0, 0.9, 0.55), e * e);
  env += vec3(1.0, 0.95, 0.75) * smoothstep(0.05, 0.0, abs(Rw.y - 0.08)) * 0.8;           // horizon streak
  float sd = max(dot(Rw, L), 0.0), spec = pow(sd, 24.0), hot = pow(sd, 260.0);
  float b1 = fract(dot(vKW, vec3(0.09, 0.06, 0.07)) - uKT * 0.45 - uPhase), b2 = fract(dot(vKW, vec3(-0.05, 0.08, 0.11)) - uKT * 0.31 - uPhase * 1.7);
  float sweep = smoothstep(0.03, 0.0, abs(b1 - 0.5)) + smoothstep(0.02, 0.0, abs(b2 - 0.5)) * 0.7;
  vec3 c = vKW * 1.3, f = fract(c) - 0.5; vec3 cc = floor(c); float h = fract(sin(dot(cc, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float tw = pow(0.5 + 0.5 * sin(uKT * (2.0 + h * 3.0) + h * 40.0), 5.0) * step(0.9, h);
  float star = (exp(-dot(f.yz, f.yz) * 700.0) * (1.0 - abs(f.x) * 2.0) + exp(-dot(f.xz, f.xz) * 700.0) * (1.0 - abs(f.y) * 2.0) + exp(-dot(f.xy, f.xy) * 700.0) * (1.0 - abs(f.z) * 2.0)) + (1.0 - smoothstep(0.0, 0.1, length(f)));
  totalEmissiveRadiance = totalEmissiveRadiance * 0.2 + (env * 0.4 * uTint + vec3(1.0, 0.9, 0.55) * (spec * 0.6 + hot * 3.5 + sweep * 1.0) + vec3(1.0, 0.82, 0.4) * fres * 0.7 + vec3(1.0, 0.97, 0.85) * tw * star * 2.5) * uGK;`;
// per-ship gold version of a source material (cloned once per ship; the shader program is shared by cache key)
function goldify(src, F, { k = 1, tint = [1, 1, 1], lumK = 1.6, sail = false } = {}) {
  const n = src.clone(), prev = src.onBeforeCompile, U = { uPhase: F.uPhase, uGK: { value: k }, uLumK: { value: lumK } }, T = { value: new THREE.Vector3(...tint) };
  n.color.set(0xffffff); n.emissive = new THREE.Color(0x4a2a00); n.emissiveIntensity = 0.4;
  if (sail) { n.transparent = false; n.opacity = 1; n.depthWrite = true; }
  injectShine(n, GOLD_FRAG, U, sail ? 'pvp-gold-sail' : 'pvp-gold');
  const inj = n.onBeforeCompile;
  n.onBeforeCompile = (s, r) => { if (prev && prev !== inj) prev.call(n, s, r); inj(s, r); s.uniforms.uTint = T;
    s.fragmentShader = s.fragmentShader.replace('uniform float uKT;', 'uniform float uKT; uniform vec3 uTint;').replace('#include <color_fragment>', GOLD_COLOR); };
  n.userData.pvpGold = true; return n;
}
const _geo = new Map();
function geos(ud, low) {
  const { len, beam, depth, layout } = ud, { shape, deckDrop, bowY } = layout, key = [len, beam, depth].map(v => v.toFixed(2)).join('|') + low;
  if (_geo.has(key)) return _geo.get(key);
  const zAt = (t) => (t - 0.5) * len, deckAt = (t) => shape.top(t) - deckDrop;
  const sheer = (t) => t < 0.26 ? 3.4 * Math.pow(1 - t / 0.26, 0.7) : (t > 0.84 ? 1.2 * (t - 0.84) / 0.16 : 0);
  const ring = (t) => { const w = shape.halfW(t) * 1.02, yt = shape.top(t) + sheer(t), yk = shape.keel(t), h = yt - yk;
    return [[w * 0.84, yt], [w * 1.03, yt - h * 0.3], [w * 1.0, yt - h * 0.55], [w * 0.72, yt - h * 0.84], [0, yk]]; };
  const hull = loftHull(len, ring, low ? 12 : 20);
  const gold = [], lac = [], win = [];
  // gold strakes following the sheer line + two lower wales
  for (const sx of [1, -1]) for (const [k, r] of [[0, 0.1], [1, 0.07], [2, 0.06]]) {
    const pts = []; for (let i = 0; i <= 16; i++) { const t = 0.03 + i / 16 * 0.95, q = ring(t)[k]; pts.push(new THREE.Vector3(sx * (q[0] + 0.04), q[1], zAt(t))); }
    gold.push(place(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), low ? 16 : 32, r, 5, false)));
  }
  // two-tier stern castle (red lacquer) with gold cornices + rail posts + finials
  const sz = zAt(0.09), sy = deckAt(0.09);
  lac.push(place(new THREE.BoxGeometry(beam * 0.8, 3.2, len * 0.17), [0, sy + 1.6, sz]));
  lac.push(place(new THREE.BoxGeometry(beam * 0.62, 2.0, len * 0.11), [0, sy + 4.3, sz - len * 0.02]));
  gold.push(place(new THREE.BoxGeometry(beam * 0.86, 0.24, len * 0.18), [0, sy + 3.25, sz]));
  gold.push(place(new THREE.BoxGeometry(beam * 0.68, 0.24, len * 0.12), [0, sy + 5.35, sz - len * 0.02]));
  const posts = low ? 3 : 5;
  for (const sx of [1, -1]) for (let i = 0; i < posts; i++) gold.push(place(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 5), [sx * beam * 0.31, sy + 5.8, sz - len * 0.07 + i * len * 0.1 / (posts - 1)]));
  for (const sx of [1, -1]) gold.push(place(new THREE.SphereGeometry(0.38, 8, 6), [sx * beam * 0.31, sy + 6.35, sz - len * 0.08]), place(new THREE.ConeGeometry(0.16, 0.7, 6), [sx * beam * 0.31, sy + 6.95, sz - len * 0.08]));
  // quarter-gallery towers on both stern quarters (gold domes)
  for (const sx of [1, -1]) { const w = shape.halfW(0.08);
    lac.push(place(new THREE.CylinderGeometry(0.75, 0.6, 2.6, 8), [sx * (w + 0.35), sy + 0.9, zAt(0.07)]));
    gold.push(place(new THREE.SphereGeometry(0.8, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), [sx * (w + 0.35), sy + 2.2, zAt(0.07)]), place(new THREE.ConeGeometry(0.12, 0.6, 5), [sx * (w + 0.35), sy + 3.25, zAt(0.07)])); }
  // stern gallery windows on the transom (glow) in gold frames
  const tz = zAt(0.02) - 0.08;
  for (const [row, y] of [[0, sy + 1.4], [1, sy + 3.5]]) for (let i = -2; i <= 2; i++) {
    if (row && Math.abs(i) > 1) continue;
    win.push(place(new THREE.PlaneGeometry(0.55, 0.75), [i * 0.8, y, tz], [0, Math.PI, 0]));
    gold.push(place(new THREE.BoxGeometry(0.72, 0.92, 0.08), [i * 0.8, y, tz + 0.05]));
  }
  // forecastle + gold rail
  const fz = zAt(0.86), fy = deckAt(0.86);
  lac.push(place(new THREE.BoxGeometry(beam * 0.5, 1.3, len * 0.1), [0, fy + 0.65, fz]));
  gold.push(place(new THREE.BoxGeometry(beam * 0.56, 0.18, len * 0.11), [0, fy + 1.35, fz]));
  // gilded lion figurehead + beak: head, mane ring, body, swept wings
  const bz = zAt(1) + 0.6, by = bowY + 0.2;
  gold.push(place(new THREE.ConeGeometry(0.5, 2.2, 7), [0, by - 0.3, bz + 0.3], [-1.15, 0, 0]));
  gold.push(place(new THREE.SphereGeometry(0.48, 10, 8), [0, by + 0.45, bz + 1.35]), place(new THREE.TorusGeometry(0.5, 0.17, 6, 12), [0, by + 0.42, bz + 1.22], [0, 0, 0]));
  for (const sx of [1, -1]) gold.push(place(new THREE.BoxGeometry(0.1, 1.0, 1.9), [sx * 0.5, by + 0.2, bz + 0.5], [-0.5, 0, sx * 0.55]));
  const out = { hull, gold: merge(gold), lac: merge(lac), win: merge(win) };
  _geo.set(key, out); return out;
}
let _lac = null, _win = null;
export function goldenPartsOverride(ship, ctx) {
  const low = ctx.quality === 'low', G = geos(ctx.ud, low), F = fxOf(ship);
  F.uPhase = { value: hash(ship.id) };
  ctx.hide(ctx.base.hull); ctx.hide(ctx.base.hullOutline);
  // PvP build only: every toon material on this ship becomes polished gold (planks, deck, masts, fittings, upgrades);
  // sails become cream-gold cloth with a softer sheen; outlines go dark amber. Red lacquer + windows are added after.
  const done = new Map(), sw = (m) => {
    if (done.has(m)) return done.get(m); if (m.userData.pvpGold) return m; let n = m;
    if (m.side === THREE.BackSide && m.isMeshBasicMaterial) { n = m.clone(); n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey; n.color.set(0x3a2200); }
    else if (m.isMeshToonMaterial) { const sail = m.customProgramCacheKey?.().startsWith('sail');
      n = sail ? goldify(m, F, { k: 0.55, tint: [1.0, 1.02, 0.92], lumK: 1.3, sail: true }) : goldify(m, F); }
    else if (m.isLineBasicMaterial) { n = m.clone(); n.color.set(0x8a6a20); }
    done.set(m, n); return n; };
  ship.traverse(o => { if ((o.isMesh || o.isLineSegments) && !o.userData.waterMask && o.material) o.material = sw(o.material); });
  meshOf(G.hull, sw(ctx.base.hull?.material || toon(0xb8862e)), ctx, { outline: 0.05 });
  const gold = goldify(toon(0xffffff, null), F, { k: 1.1, lumK: 1 });
  meshOf(G.gold, gold, ctx, { outline: low ? 0 : 0.04 });
  _lac = _lac || (() => { const m = toon(0xe8141c, null); m.emissive = new THREE.Color(0x3a0002); m.emissiveIntensity = 0.3; return injectShine(m, LACQUER, {}, 'pvp-lacquer'); })(); meshOf(G.lac, _lac, ctx, { outline: 0.05 });
  _win = _win || (() => { const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); m.color.set(0xffc46a).multiplyScalar(1.4); return m; })();
  ship.traverse(o => { if (o.isPointLight) o.intensity *= 0.4; }); // stern lantern light washed the gold out under bloom
  meshOf(G.win, _win, ctx);
  // premium: gold-dust wake, then a taller, bigger galleon (more freeboard; the whole rig rides up with the deck)
  signatureWake(ship, ctx, { c0: 0xfff0b0, c1: 0xffa818, n: 44, size: 320, rise: 0.6 });
  liftRig(ctx, { lift: 0.55, sx: 1.08, sy: 1.2, sz: 1.1 });
}
// per-frame (local + remote): the glint sweep runs faster with the ship's speed. No-op on other skins.
export function goldenTick(mesh, { speed = 0, dt = 1 / 60 } = {}) { // (sweeps also run without it, on the shared clock)
  if (mesh?.userData?.skinId !== 'golden') return;
  const F = mesh.userData.pvpFx; if (F?.uPhase) F.uPhase.value += dt * (0.05 + Math.abs(speed) * 0.02);
}
export const GOLDEN_PVP = { id: 'golden', killsRequired: GOLDEN_KILLS, partsOverride: goldenPartsOverride, tick: goldenTick };
export default GOLDEN_PVP;
