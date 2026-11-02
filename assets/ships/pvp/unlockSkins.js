// [Timothy] PvP UNLOCK skins (not kill tiers): PUMPFUN PIRATES Battle Royale. Cosmetic only, never a stat change.
//   bondingcurve  BONDING CURVE  unlock: 100 harbor AI kills    PUMPFUN green lacquer hull with a white wale and gold strakes,
//                                                               green + white pill emblem on the topsails / jib / upgrade sails
//                                                               (gold ring, shimmer), gold pill figurehead, green-lit stern
//                                                               gallery, slow gold "graduated" gleam, green + gold spark wake
//   commodore     COMMODORE      unlock: 100 harbor boss kills  after the Waves boss THE COMMODORE (js/ships.js SCHEMES.boss:
//                                                               maroon band2, eerie green lamps), as a player flagship: navy-black
//                                                               lacquer, gold filigree scrolls + three gold strakes on a maroon
//                                                               wale, gold-embroidered night sails, maroon admiralty ensign on a
//                                                               stern staff + swallowtail broad pennants, iron ram + gold crown
//                                                               at the bow, green-lit stern gallery + lanterns, taller / bulkier rig
// Unlock data lives in js/config.js PVP_UNLOCK_SKINS ({ id, name, locked: true, unlock: { type, count } }); the counters and
// progress bars are Emerly's. Nothing here unlocks anything.
//
// Parts-override API (./partsOverride.js): materialFx(material) + partsOverride(ship, ctx), PvP builds only.
// Hull-length safe: every add-on is placed from the ship's own layout (shape.halfW / top(t), len, bowY, cab, mastDefs), so
// longer / taller v97 hulls (4..12 guns a side) just get longer strakes and more scrolls. Geometry is cached per
// len|beam|depth|masts|quality (userData.sharedGeo, never freed by disposeShip).
// Hitbox: nothing here writes len / beam / depth / traitBoxes; runPartsOverride snapshots + restores them anyway.
// COMMODORE uses Raul's liftRig (visual lift + scale of the body group, same as GOLDEN / GHOST / FLAMING).
// Low quality: shader looks + merged parts stay; no spark wake, no mast pennants (the stern ensign stays).
// Animation runs on the shared wind.uTime clock; unlockSkinsTick only feeds each ship's synced speed to its wake.
import { THREE, wind, toon, outlineFor, place, merge, fxOf, liftRig, signatureWake } from './pvpKit.js';
import { outlineMat } from '../../../js/toon.js';
import { skinBuildOpts } from '../../../js/skins.js';

export const PUMPFUN_GREEN = 0x4ee37a; // the game's PUMPFUN green (sea green trim, Waves boss trim, tutorial, escorts)
export const UNLOCK_IDS = ['bondingcurve', 'commodore'];

// ---------- shader plumbing (local position + uv varyings, shared clock) ----------
const VH = '#include <common>\nvarying vec3 vUkP; varying vec2 vUkUv;';
const VB = '#include <begin_vertex>\nvUkP = position; vUkUv = uv;';
const FH = '#include <common>\nvarying vec3 vUkP; varying vec2 vUkUv; uniform float uUkT;';
const PRE = `{ vec3 Nv = normalize(normal); vec3 Vv = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
  float fres = pow(1.0 - clamp(dot(Nv, Vv), 0.0, 1.0), 2.5), T = uUkT; vec2 U = vUkUv; vec3 P = vUkP;\n`;
const PRE_C = `{ float T = uUkT; vec2 U = vUkUv; vec3 P = vUkP;\n`; // color stage runs before the normal is set up
// color: GLSL run after the map (diffuseColor; sees T, U, P), emis: GLSL adding to totalEmissiveRadiance (also fres)
function look(n, base, { color = '', emis = '' }, key) {
  const prev = base.onBeforeCompile, prevKey = base.customProgramCacheKey?.() || 'toon';
  n.onBeforeCompile = (s, r) => {
    prev?.call(n, s, r);
    s.uniforms.uUkT = wind.uTime;
    s.vertexShader = s.vertexShader.replace('#include <common>', VH).replace('#include <begin_vertex>', VB);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', FH)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + PRE_C + color + '\n}')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + PRE + emis + '\n}');
  };
  n.customProgramCacheKey = () => prevKey + '|uk-' + key;
  return n;
}
const glsl = (c) => { const k = new THREE.Color(c); return `vec3(${k.r.toFixed(3)}, ${k.g.toFixed(3)}, ${k.b.toFixed(3)})`; };

// ---------- BONDING CURVE looks ----------
const G_GREEN = glsl(PUMPFUN_GREEN);
// pump.fun-style pill (generic capsule, not the real logo) on a dark roundel with a gold ring, so both halves read on any
// cloth: green half + white half, dark seam, shimmer sweep. o = sail uv around the upper middle (the course hides a
// topsail's foot from most angles), x stretched by the sail's aspect (~1.4); the pill is tilted ~26 degrees.
const PILL = `vec2 o = (U - vec2(0.5, 0.63)) * vec2(1.4, 1.0); float bd = length(o) - 0.27;
  float ca = cos(0.45), sa = sin(0.45); vec2 q = vec2(ca * o.x + sa * o.y, -sa * o.x + ca * o.y);
  float pd = length(vec2(max(abs(q.x) - 0.12, 0.0), q.y)) - 0.085;`;
const BC = {
  hull: { color: `float gl = smoothstep(0.12, 0.3, diffuseColor.r - diffuseColor.b) * step(0.5, diffuseColor.r) * smoothstep(0.62, 0.75, diffuseColor.g / max(diffuseColor.r, 0.01)); // keep gold / brass (not brown wood)
      float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)), wh = smoothstep(0.6, 0.8, l), gr = smoothstep(0.05, 0.2, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.5, 0.24) * (0.5 + l * 1.7), 0.55 * (1.0 - gl) * (1.0 - wh) * (1.0 - gr)); // brown timbers -> green lacquer`,
    emis: `float sw = smoothstep(0.93, 1.0, sin(P.z * 0.3 - T * 1.3 + P.y * 0.6));
      totalEmissiveRadiance += ${G_GREEN} * fres * 0.32 + vec3(1.0, 0.85, 0.45) * sw * 0.2;` },
  sailPill: { color: `${PILL}
      vec3 c = mix(diffuseColor.rgb, vec3(0.03, 0.09, 0.05), smoothstep(0.006, -0.006, bd));                  // roundel
      c = mix(c, vec3(1.0, 0.8, 0.4), smoothstep(0.03, 0.0, abs(bd + 0.012)));                                  // gold ring
      vec3 hc = q.x > 0.0 ? ${G_GREEN} : vec3(0.97, 0.98, 0.96);
      hc *= 1.0 - 0.2 * smoothstep(-0.02, 0.08, q.y);                                                          // toon shade
      hc = mix(hc, vec3(0.03, 0.08, 0.05), smoothstep(0.01, 0.003, abs(q.x)));                                 // seam
      diffuseColor.rgb = mix(c, hc, smoothstep(0.004, -0.008, pd));`,
    emis: `${PILL}
      float inside = smoothstep(0.004, -0.008, pd), ring = smoothstep(0.03, 0.0, abs(bd + 0.012));
      float sh = smoothstep(0.03, 0.0, abs(fract(q.x * 1.6 - q.y * 0.8 - T * 0.35) - 0.5)) * inside;
      float e = min(min(U.x, 1.0 - U.x), min(U.y, 1.0 - U.y));
      totalEmissiveRadiance += ${G_GREEN} * inside * step(0.0, q.x) * 0.4 + vec3(1.0, 0.82, 0.45) * (ring * 0.7 + sh * 0.6 + smoothstep(0.05, 0.03, e) * 0.55);` },
  sailMain: { color: ``,
    emis: `float e = min(min(U.x, 1.0 - U.x), min(U.y, 1.0 - U.y));
      float sw = smoothstep(0.94, 1.0, sin(U.x * 3.0 - T * 1.1 + U.y * 2.0));
      totalEmissiveRadiance += vec3(1.0, 0.82, 0.45) * smoothstep(0.05, 0.03, e) * 0.6 + ${G_GREEN} * sw * 0.12;` },
};

// ---------- COMMODORE looks ----------
const CM = {
  hull: { color: `float gl = smoothstep(0.12, 0.3, diffuseColor.r - diffuseColor.b) * step(0.5, diffuseColor.r) * smoothstep(0.62, 0.75, diffuseColor.g / max(diffuseColor.r, 0.01)); // keep gold / brass (not brown wood)
      float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)), red = smoothstep(0.12, 0.3, diffuseColor.r - max(diffuseColor.g, diffuseColor.b) * 1.6); // keep the maroon
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.12, 0.24) * (0.55 + l * 1.8), 0.6 * (1.0 - gl) * (1.0 - red));`,
    emis: `float sw = smoothstep(0.95, 1.0, sin(P.z * 0.25 - T * 0.9 + P.y * 0.4));
      totalEmissiveRadiance += vec3(1.0, 0.78, 0.38) * (pow(fres, 1.6) * 0.3 + sw * 0.12);` },
  sail: { color: ``,
    emis: `float e = min(min(U.x, 1.0 - U.x), min(U.y, 1.0 - U.y));
      float emb = smoothstep(0.07, 0.045, e) * (0.7 + 0.3 * sin(U.x * 90.0 + U.y * 90.0));            // gold-embroidered border
      float inner = smoothstep(0.012, 0.0, abs(e - 0.095));                                       // thin maroon inner hem
      float sw = smoothstep(0.95, 1.0, sin(U.x * 2.6 - T * 0.9 + U.y * 1.7));
      totalEmissiveRadiance += vec3(1.0, 0.76, 0.32) * (emb * 0.9 + sw * 0.1) + vec3(0.55, 0.05, 0.15) * inner * 0.8;` },
};

// per-skin materialFx (cached per source material, like tierLooks)
function makeFx(id, L, { outline, emissive, glow, hullK }) {
  const cache = new Map();
  return (m) => {
    if (!m || m.colorWrite === false) return m; // never the depth-only water lid
    if (cache.has(m)) return cache.get(m);
    let n = m;
    if (m.side === THREE.BackSide && m.isMeshBasicMaterial) {
      n = m.clone(); n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey; n.color.set(outline);
    } else if (m.isMeshToonMaterial) {
      const isSail = m.customProgramCacheKey?.() === 'sail';
      n = m.clone(); n.emissive = new THREE.Color(emissive); n.emissiveIntensity = 1;
      if (!isSail) { n.color.multiplyScalar(hullK); look(n, m, L.hull, id + 'h'); }
      else { const main = m.map && m.map.source === skinBuildOpts(id === 'commodore' ? COMMODORE : BONDING_CURVE)?.mainSailMap?.source;
        if (id === 'commodore') look(n, m, L.sail, id + 's');
        else look(n, m, main ? L.sailMain : L.sailPill, id + (main ? 'm' : 'p')); }
    } else if (m.isMeshBasicMaterial) { n = m.clone(); n.color.set(glow).multiplyScalar(1.8); }
    cache.set(m, n); return n;
  };
}

// ---------- geometry helpers (hull-relative) ----------
const ni = (g) => g.index ? g.toNonIndexed() : g;
const P = (g, p, r, s) => place(ni(g), p, r, s);
const zAtOf = (ud) => (t) => (t - 0.5) * ud.len;
const deckAtOf = (ud) => (t) => ud.layout.shape.top(t) - ud.layout.deckDrop;
// a strake: short boxes following the hull's own plan curve on one side, dy below the gunwale
function strake(out, ud, sx, dy, h = 0.18, t0 = 0.08, t1 = 0.92, n = 12, push = 1.0, w = 0.1) {
  const { shape } = ud.layout, zAt = zAtOf(ud);
  for (let i = 0; i < n; i++) {
    const ta = t0 + (t1 - t0) * i / n, tb = t0 + (t1 - t0) * (i + 1) / n, tm = (ta + tb) / 2;
    const xa = shape.halfW(ta) * push, xb = shape.halfW(tb) * push, za = zAt(ta), zb = zAt(tb);
    const l = Math.hypot(xb - xa, zb - za) * 1.04, yaw = Math.atan2(xb - xa, zb - za) * sx;
    out.push(P(new THREE.BoxGeometry(w, h, l), [sx * (xa + xb) / 2 + sx * 0.03, shape.top(tm) - dy, (za + zb) / 2], [0, yaw, 0]));
  }
}
const _geo = new Map();
function cached(id, ud, q, build) {
  const key = id + '|' + [ud.len, ud.beam, ud.depth, ud.layout.mastDefs.length].map(v => v.toFixed(2)).join('|') + q;
  if (!_geo.has(key)) _geo.set(key, build());
  return _geo.get(key);
}
const MAT = {}; const mat = (k, make) => MAT[k] || (MAT[k] = make());
const goldM = () => mat('gold', () => look(toon(0xffcd77, null, { emissive: new THREE.Color(0x4a3008), emissiveIntensity: 1 }), toon(0xffcd77),
  { emis: `float sw = smoothstep(0.9, 1.0, sin(P.z * 0.4 - T * 1.8 + P.y * 0.7)); totalEmissiveRadiance += vec3(1.0, 0.85, 0.5) * (sw * 0.35 + fres * 0.25);` }, 'gold'));
const flatM = (c, e = 0x000000, k = 'f') => mat(k + c, () => toon(c, null, { emissive: new THREE.Color(e), emissiveIntensity: 1 }));
const glowM = (c, k = 2.0) => mat('glow' + c, () => { const m = new THREE.MeshBasicMaterial(); m.color.set(c).multiplyScalar(k); return m; });
const lineM = (c) => mat('line' + c, () => outlineMat(0.04, c));
function meshOf(ctx, geo, m, outlineCol = null) {
  const o = new THREE.Mesh(geo, m); o.userData.sharedGeo = true; ctx.add(o);
  if (outlineCol != null) { const l = outlineFor(o, 0.04); l.material = lineM(outlineCol); ctx.add(l); }
  return o;
}
// one half of a capsule along +Y (cylinder from y 0..L, hemisphere cap on top)
function halfPill(r, L, seg) { return merge([P(new THREE.CylinderGeometry(r, r, L, seg, 1, true), [0, L / 2, 0]), P(new THREE.SphereGeometry(r, seg, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0, L, 0])]); }

// ---------- waving flags (swallowtail ribbons, GPU-waved on the shared clock) ----------
function flagMat(field, border, stripe) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: wind.uTime },
    vertexShader: `attribute float aK; attribute float aV; uniform float uT; varying float vK; varying float vV; varying float vShade;
      void main(){ vK = aK; vV = aV; vec3 p = position; float w = 0.25 + 0.75 * aK; float ph = uT * 3.6 - aK * 6.5;
        p.x += (sin(ph) * 0.5 + sin(aK * 5.0) * 0.3) * w * aK * 1.5; p.y += sin(uT * 2.7 - aK * 5.0) * 0.2 * w * aK - aK * aK * 0.3;
        vShade = 0.72 + 0.28 * cos(ph); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `varying float vK; varying float vV; varying float vShade;
      void main(){ float a = abs(vV); float border = max(step(0.8, a), step(vK, 0.04)); float stripe = step(a, 0.18) * step(0.1, vK);
        vec3 c = mix(${glsl(field)}, ${glsl(stripe)}, stripe); c = mix(c, ${glsl(border)}, border);
        gl_FragColor = vec4(c * vShade, 1.0); }`,
    side: THREE.DoubleSide,
  });
}
// hoist at the origin, flies to -Z (aft); aV -1 foot .. 1 head, aK 0 hoist .. 1 fly
function swallowtail(L, H, N = 16, notch = 0.7) {
  const pos = [], aK = [], aV = [], idx = [], half = (k) => H / 2 * (1 - 0.45 * k);
  for (const sgn of [1, -1]) { const base = pos.length / 3;
    for (let j = 0; j <= N; j++) { const k = j / N, km = Math.min(k, notch);
      pos.push(0, sgn * half(k), -k * L); aK.push(k); aV.push(sgn);
      pos.push(0, sgn * (k > notch ? half(k) * 0.2 : 0), -km * L); aK.push(km); aV.push(0); }
    for (let j = 0; j < N; j++) { const a = base + j * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute(aK, 1)); g.setAttribute('aV', new THREE.Float32BufferAttribute(aV, 1));
  g.setIndex(idx); return g;
}
function flagMesh(geo, m) { const o = new THREE.Mesh(geo, m); o.frustumCulled = false; o.userData.sharedGeo = true; return o; }

// ---------- BONDING CURVE parts ----------
function bondingParts(ship, ctx) {
  const ud = ctx.ud, low = ctx.quality === 'low', { shape, mastDefs, bowY } = ud.layout, zAt = zAtOf(ud), deckAt = deckAtOf(ud);
  const G = cached('bc', ud, low ? 'l' : 'h', () => {
    const gold = [], white = [], win = [], green = [], seg = low ? 8 : 14;
    for (const sx of [1, -1]) { strake(gold, ud, sx, 0.24, 0.13); strake(white, ud, sx, 0.62, 0.36, 0.1, 0.9, 12, 1.0, 0.12); strake(gold, ud, sx, 0.86, 0.09, 0.1, 0.9); strake(gold, ud, sx, 1.6, 0.12, 0.14, 0.86, 10, 0.94); }
    // gold pill figurehead on the stem: green half forward, white half aft, gold band at the seam
    const fz = zAt(1) + 0.55, fy = bowY + 0.15, rot = [1.0, 0, 0];
    const gH = halfPill(0.42, 0.55, seg), wH = halfPill(0.42, 0.55, seg); wH.rotateX(Math.PI);
    green.push(P(gH, [0, fy, fz], rot)); white.push(P(wH, [0, fy, fz], rot));
    gold.push(P(new THREE.TorusGeometry(0.45, 0.07, 6, seg + 2), [0, fy, fz], [rot[0] + Math.PI / 2, 0, 0]));
    gold.push(P(new THREE.ConeGeometry(0.22, 1.1, 6), [0, fy - 0.55, fz - 0.45], [1.2, 0, 0])); // bracket onto the stem
    // masthead gold rings (graduated) on every mast
    mastDefs.forEach(([tf, hf]) => { const my = deckAt(tf) + ud.len * 0.98 * hf;
      gold.push(P(new THREE.TorusGeometry(0.32, 0.07, 5, 12), [0, my - 0.2, zAt(tf)], [Math.PI / 2, 0, 0]));
      gold.push(P(new THREE.TorusGeometry(0.36, 0.06, 5, 12), [0, deckAt(tf) + ud.len * 0.98 * hf * 0.5, zAt(tf)], [Math.PI / 2, 0, 0])); });
    // stern: gold rail + green-lit gallery windows across the transom
    const ts = 0.03, sz = zAt(ts) - 0.08, sy = shape.top(ts), hw = shape.halfW(ts);
    gold.push(P(new THREE.BoxGeometry(hw * 1.8, 0.14, 0.14), [0, sy - 0.2, sz]));
    for (let i = 0; i < 4; i++) win.push(P(new THREE.PlaneGeometry(0.42, 0.5), [(i - 1.5) * hw * 0.42, sy - 0.85, sz - 0.02], [0, Math.PI, 0]));
    return { gold: merge(gold), white: merge(white), green: merge(green), win: merge(win) };
  });
  meshOf(ctx, G.gold, goldM(), low ? null : 0x3a2a08);
  meshOf(ctx, G.white, flatM(0xf4fbf6, 0x161a18, 'bcw'), 0x0b2a18);
  meshOf(ctx, G.green, flatM(PUMPFUN_GREEN, 0x0c3a1c, 'bcg'), 0x0b2a18);
  meshOf(ctx, G.win, glowM(0x7dffa8, 2.0));
  if (!low) signatureWake(ship, ctx, { c0: 0xb8ffcc, c1: 0xffcd77, n: 40, size: 300, rise: 0.9 });
}

// ---------- COMMODORE parts ----------
const _cmFlag = { ens: null, pen: null };
function commodoreParts(ship, ctx) {
  const ud = ctx.ud, low = ctx.quality === 'low', { shape, mastDefs, bowY, cab } = ud.layout, zAt = zAtOf(ud), deckAt = deckAtOf(ud);
  const G = cached('cm', ud, low ? 'l' : 'h', () => {
    const gold = [], maroon = [], iron = [], win = [], seg = low ? 6 : 10;
    for (const sx of [1, -1]) {
      strake(gold, ud, sx, 0.22, 0.14); strake(maroon, ud, sx, 0.62, 0.42, 0.08, 0.92, 12, 1.0, 0.12); strake(gold, ud, sx, 0.9, 0.1); strake(gold, ud, sx, 1.75, 0.16, 0.12, 0.88, 10, 0.93);
      // gold filigree: scroll pairs riding the maroon wale, spaced by length, so longer hulls just get more of them
      const n = Math.max(4, Math.round(ud.len / 3.2));
      for (let i = 0; i < n; i++) { const t = 0.16 + 0.68 * (i + 0.5) / n, x = shape.halfW(t) * 1.0 + 0.1, y = shape.top(t) - 0.62, z = zAt(t);
        const yaw = Math.atan2(shape.halfW(t + 0.01) - shape.halfW(t - 0.01), ud.len * 0.02) * sx;
        for (const d of [1, -1]) {
          gold.push(P(new THREE.TorusGeometry(0.17, 0.035, 4, seg, Math.PI * 1.4), [sx * x, y, z + d * 0.26], [0, sx * Math.PI / 2 + yaw, d > 0 ? 0.3 : Math.PI + 0.3]));
          gold.push(P(new THREE.SphereGeometry(0.06, 5, 4), [sx * x, y + 0.17 * d * 0.2, z + d * 0.52]));
        }
        gold.push(P(new THREE.OctahedronGeometry(0.11), [sx * x, y, z]));
      }
    }
    // bow: iron ram on the cutwater + a gold crown figurehead
    const fz = zAt(1);
    iron.push(P(new THREE.ConeGeometry(0.5, 2.6, 8), [0, 0.45, fz + 0.7], [Math.PI / 2, 0, 0]), P(new THREE.TorusGeometry(0.52, 0.12, 5, 12), [0, 0.45, fz - 0.4]));
    const cz = fz + 0.75, cy = bowY + 0.35;
    gold.push(P(new THREE.CylinderGeometry(0.42, 0.36, 0.34, 10, 1, true), [0, cy, cz]), P(new THREE.TorusGeometry(0.4, 0.06, 5, 12), [0, cy - 0.16, cz], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; gold.push(P(new THREE.ConeGeometry(0.08, 0.32, 4), [Math.cos(a) * 0.4, cy + 0.32, cz + Math.sin(a) * 0.4])); }
    gold.push(P(new THREE.ConeGeometry(0.3, 1.2, 6), [0, cy - 0.65, cz - 0.4], [1.2, 0, 0]));
    // stern: gold cornice on the cabin, green-lit gallery (THE COMMODORE's lamps; the base stern lanterns glow green too)
    const sz = cab.z - cab.l / 2 - 0.12, top = cab.y0 + cab.h;
    gold.push(P(new THREE.BoxGeometry(cab.w * 1.04, 0.18, cab.l * 1.02), [0, top + 0.05, cab.z]));
    gold.push(P(new THREE.BoxGeometry(cab.w * 1.0, 0.14, 0.14), [0, top - cab.h * 0.48, sz]));
    for (let i = 0; i < 5; i++) win.push(P(new THREE.PlaneGeometry(0.34, 0.5), [(i - 2) * cab.w * 0.18, cab.y0 + cab.h * 0.62, sz - 0.03], [0, Math.PI, 0]));
    // masthead crowns
    mastDefs.forEach(([tf, hf], i) => { const my = deckAt(tf) + ud.len * 0.98 * hf;
      gold.push(P(new THREE.TorusGeometry(0.34, 0.07, 5, 12), [0, my - 0.2, zAt(tf)], [Math.PI / 2, 0, 0]));
      if (i) for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; gold.push(P(new THREE.ConeGeometry(0.07, 0.3, 4), [Math.cos(a) * 0.32, my, zAt(tf) + Math.sin(a) * 0.32])); } });
    // ensign staff raked aft over the transom
    const sy = top + 0.1, stz = sz + 0.15, SL = Math.max(3.2, ud.len * 0.2);
    gold.push(P(new THREE.CylinderGeometry(0.06, 0.09, SL, 6), [0, sy + Math.cos(0.45) * SL / 2, stz - Math.sin(0.45) * SL / 2], [-0.45, 0, 0]));
    const ensTop = [0, sy + Math.cos(0.45) * SL, stz - Math.sin(0.45) * SL];
    // flags: big admiralty ensign on the staff + swallowtail broad pennants on the fore / mizzen mastheads
    const EH = Math.max(1.8, ud.depth * 0.75), ens = swallowtail(Math.max(3.2, ud.len * 0.2), EH, 18, 0.78); ens.translate(ensTop[0], ensTop[1] - EH / 2 - 0.05, ensTop[2]);
    const pens = []; mastDefs.forEach(([tf, hf], i) => { if (!i) return; const my = deckAt(tf) + ud.len * 0.98 * hf, L = ud.len * 0.34, H = 1.2;
      const p = swallowtail(L, H); p.translate(0, my - H / 2 - 0.15, zAt(tf) - 0.15); pens.push(p); });
    return { gold: merge(gold), maroon: merge(maroon), iron: merge(iron), win: merge(win), ens, pen: pens.length ? merge(pens) : null };
  });
  meshOf(ctx, G.gold, goldM(), low ? null : 0x2a1a04);
  meshOf(ctx, G.maroon, flatM(0x5b0f2a, 0x14020a, 'cmm'), 0x14020a);
  meshOf(ctx, G.iron, flatM(0x1e2a24, 0x050807, 'cmi'), 0x050807);
  meshOf(ctx, G.win, glowM(0x5cff8f, 2.1));
  _cmFlag.ens = _cmFlag.ens || flagMat(0x5b0f2a, 0xffcd77, 0x121a33);
  ctx.add(flagMesh(G.ens, _cmFlag.ens));
  if (!low && G.pen) { _cmFlag.pen = _cmFlag.pen || flagMat(0x121a33, 0xffcd77, 0x5b0f2a); ctx.add(flagMesh(G.pen, _cmFlag.pen)); }
  if (!low) signatureWake(ship, ctx, { c0: 0xffd98a, c1: 0x5cff8f, n: 40, size: 300, rise: 0.4 });
  liftRig(ctx, { lift: 0.4, sx: 1.06, sy: 1.14, sz: 1.06 }); // imposing flagship silhouette (visual only, LAST)
}

// ---------- skin defs (same data shape as js/skins.js + mobileSkins.js) ----------
export const BONDING_CURVE = {
  id: 'bondingcurve', name: 'BONDING CURVE', price: 0, premium: 'pvp', blurb: 'Graduated. PUMPFUN green and gold, pill on the sails.',
  locked: true, unlock: { type: 'harborAiKills', count: 100 },
  palette: { seed: 171, wood: 0x2fbf63, band: 0x0e3a20, stripe: 0xffcd77, band2: 0xf2fbf4, tar: 0x0a1a10, trim: 0xffcd77, sail: 0x14532f, patch: [0x186238, 0x10462a], hem: 0xffcd77, lantern: 0x7dffa8, window: 0x9cffb5, stripes: 0x1b6b3d },
  sail: { bg: '#1a6a3c', lines: 'rgba(78,227,122,0.10)', border: '#ffcd77' }, flag: { bg: '#0e3a20', border: '#4ee37a' },
  parts: { oak: 0x23914b, plank: 0x2fbf63, deck: 0xe8f5ec, iron: 0x1c3a2a, gold: 0xffcd77, glow: 0x7dffa8 },
  swatch: { hull: '#2fbf63', band: '#0e3a20', stripe: '#ffcd77', sail: '#1a6a3c', trim: '#ffcd77' },
};
export const COMMODORE = {
  id: 'commodore', name: 'COMMODORE', price: 0, premium: 'pvp', blurb: 'THE COMMODORE\'s own flagship. Navy, black and gold.',
  locked: true, unlock: { type: 'harborBossKills', count: 100 },
  palette: { seed: 181, wood: 0x182036, band: 0x0a0d18, stripe: 0xffcd77, band2: 0x5b0f2a, tar: 0x07080d, trim: 0xffcd77, sail: 0x141a2c, patch: [0x1a2136, 0x0e121e], hem: 0xffcd77, lantern: 0x5cff8f, window: 0x7dffa8 },
  sail: { bg: '#121828', lines: 'rgba(255,205,119,0.07)', border: '#ffcd77' }, flag: { bg: '#5b0f2a', border: '#ffcd77' },
  parts: { oak: 0x121a2e, plank: 0x182036, deck: 0x2a2a30, iron: 0x1e2a24, gold: 0xffcd77, glow: 0x5cff8f },
  swatch: { hull: '#182036', band: '#0a0d18', stripe: '#ffcd77', sail: '#121828', trim: '#ffcd77' },
};
BONDING_CURVE.materialFx = makeFx('bondingcurve', BC, { outline: 0x06301a, emissive: 0x031208, glow: 0x7dffa8, hullK: 1.0 });
BONDING_CURVE.partsOverride = bondingParts;
COMMODORE.materialFx = makeFx('commodore', CM, { outline: 0x05070d, emissive: 0x020308, glow: 0x5cff8f, hullK: 0.9 });
COMMODORE.partsOverride = commodoreParts;

// Per-frame hook for every PvP ship, local and remote: unlockSkinsTick(mesh, { speed }) with the ship's synced speed (world
// units / s). No-op unless mesh.userData.skinId is one of UNLOCK_IDS; it only feeds the spark wake (signatureWake reads
// userData.pvpFx.speed). Shader shimmer / flags run on the shared wind.uTime clock without it.
export function unlockSkinsTick(mesh, { speed } = {}) {
  if (!mesh?.userData || !UNLOCK_IDS.includes(mesh.userData.skinId)) return;
  if (typeof speed === 'number') fxOf(mesh).speed = speed;
}
BONDING_CURVE.tick = unlockSkinsTick; COMMODORE.tick = unlockSkinsTick;
export const UNLOCK_SKINS = [BONDING_CURVE, COMMODORE];
export default UNLOCK_SKINS;
