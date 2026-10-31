// [Timothy] PvP tier looks for the NON-specialty kill-tier skins. PUMPFUN PIRATES PvP.
// Upgrades the palette skins into proper unlocks with richer materials, trim and sail details and a few small
// add-on parts, each a step fancier than the one before and all well below FLAMING (2500) / DIAMOND (5000):
//   blood     CRIMSON SAILS   (10)   red lacquer sheen, glowing crimson hem, gold rubbing strakes
//   seagreen  SEA GREEN       (25)   sea-glint lacquer, stitched glowing hems + pinstripes, verdigris strake, glowing brass portholes
//   midnight  BLACK PEARL     (50)   black lacquer with a cold silver rim, pearl-sheen sails, twin silver strakes, iridescent pearl figurehead
//   coral     CORAL REEF      (1000) coral growth + shells on the hull, pulsing bioluminescent spots, rippling caustic sails, glowing wake
//   storm     STORM RIDER     (1500) storm-plate strakes, lightning veins on the sails, ship-wide lightning flashes, lightning rods + crackling arcs, spray wake
//   admiral   ADMIRAL WHITE   (2000) gold gleam sweeping the hull, gold-embroidered sails, three gold strakes, gilded figurehead,
//                                    masthead crowns, lit stern gallery, streaming pennants, gold sparkle wake
// Tiers (kills) are NOT set here: they stay in config.js PVP_SKIN_TIERS. Golden / Ghost / Kraken are not touched.
//
// Uses the parts-override API in ./partsOverride.js (materialFx + partsOverride), attached at load by applyTierLooks().
// Hitbox untouched (runPartsOverride snapshots + restores it; nothing here writes len / beam / depth). Add-ons sit on
// the hull surface inside the beam, never on muzzles / flag pole / sails.
// Phone cost: no textures, no post-processing, no per-ship materials (per-ship wake values are pushed into the shared
// material in onBeforeRender with uniformsNeedUpdate). Add-on geometry is merged per skin + hull size and cached
// (userData.sharedGeo, so disposeShip() never frees a shared buffer). Draw calls per ship: +1..+3 (blood/seagreen/
// midnight), +2..+5 (coral/storm/admiral, high).
// LOW quality: shader looks stay (emissive only, cheap), no particles (no wakes, no arcs), no pennants.
// Animation runs on the shared wind.uTime clock; speed-driven wakes read each ship's own speed: see tierTick().
//
// Wiring (mirrors DIAMOND / FLAMING; nothing in js/ is changed on this branch):
//   js/pvpSkins.js:  import { applyTierLooks, tierTick } from '../assets/ships/pvp/tierLooks.js';
//                    applyTierLooks([...SKINS, ...MOBILE_SKINS]);   // after MOBILE_SKINS are registered
//                    SHIP_TICKS.push(tierTick);                     // every PvP ship, every frame: tierTick(mesh, { speed })
//   (runPartsOverride is already PvP-build-only there, so solo-shop CRIMSON / BLACK PEARL look exactly as before.)
import * as THREE from 'three';
import { wind } from '../../../js/ships.js';
import { toon, outlineFor, outlineMat } from '../../../js/toon.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TIER_IDS = ['blood', 'seagreen', 'midnight', 'coral', 'storm', 'admiral'];

// ---------- storm seed: deterministic per ship ----------
// Lightning (flash timing, vein layout, arc flicker) = f(wind.uTime, hash(stable ship id)), so every client that sees a
// given ship computes the same pattern for it. Id field, first one present wins:
//   mesh.userData.netId   (set by tierTick(mesh, { speed, id }) or by the PvP code: remote = p.id / s.net.id, local = myId)
//   mesh.userData.playerId | pvpId | ownerId   (accepted aliases)
// No stable id in userData -> seed 0: still deterministic and identical on every client, just shared by all id-less ships.
// (No per-ship id exists in mesh.userData in this repo today; Emerly's pvp.js keeps it on the ship object as s.net.id.)
const STORM_SEED = { value: 0 }; // one uniform object shared by every storm material; set per draw from the ship's id
export function shipSeed(ud) {
  const id = ud?.netId ?? ud?.playerId ?? ud?.pvpId ?? ud?.ownerId;
  if (id === undefined || id === null || id === '') return 0;
  if (ud.tlSeedFor === id) return ud.tlSeed;
  let h = 2166136261; const str = String(id); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } // FNV-1a
  ud.tlSeedFor = id; ud.tlSeed = ((h >>> 0) % 10007) / 10007; return ud.tlSeed;
}
function seedOnDraw(ship, o) { // push this ship's seed before each draw of a storm material (shared materials, so flag the upload)
  const prev = o.onBeforeRender;
  o.onBeforeRender = function (r, sc, cam, geo, m, grp) { prev?.call(this, r, sc, cam, geo, m, grp); STORM_SEED.value = shipSeed(ship.userData); if (m) m.uniformsNeedUpdate = true; };
}

// ---------- shader kit ----------
const KIT = `float tlHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float tlNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tlHash(i), tlHash(i + vec3(1,0,0)), f.x), mix(tlHash(i + vec3(0,1,0)), tlHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(tlHash(i + vec3(0,0,1)), tlHash(i + vec3(1,0,1)), f.x), mix(tlHash(i + vec3(0,1,1)), tlHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float tlFlash(float T, float S){ float t = T * 3.0 + S * 7.0, s = floor(t); return step(0.9, tlHash(vec3(s, 1.7 + S * 13.0, 3.1))) * pow(1.0 - fract(t), 2.0); }`;
const VERT_HEAD = '#include <common>\nvarying vec3 vTlP; varying vec2 vTlUv;';
const VERT_BODY = '#include <begin_vertex>\nvTlP = position; vTlUv = uv;';
const FRAG_HEAD = `#include <common>\nvarying vec3 vTlP; varying vec2 vTlUv; uniform float uTlT; uniform float uTlSeed;\n${KIT}`;
const PRE = `#include <emissivemap_fragment>
{ vec3 Nv = normalize(normal); vec3 Vv = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
  float fres = pow(1.0 - clamp(dot(Nv, Vv), 0.0, 1.0), 2.5), T = uTlT; vec2 U = vTlUv; vec3 P = vTlP;
`;
function addLook(n, base, body, key) {
  const prev = base.onBeforeCompile, prevKey = base.customProgramCacheKey?.() || 'toon';
  n.onBeforeCompile = (s, r) => {
    prev?.call(n, s, r);
    s.uniforms.uTlT = wind.uTime; s.uniforms.uTlSeed = STORM_SEED;
    s.vertexShader = s.vertexShader.replace('#include <common>', VERT_HEAD).replace('#include <begin_vertex>', VERT_BODY);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', FRAG_HEAD).replace('#include <emissivemap_fragment>', PRE + body + '\n}');
  };
  n.customProgramCacheKey = () => prevKey + '|tl-' + key;
  return n;
}

// ---------- per-skin material looks (hull = every non-sail toon material, sail = sail cloth) ----------
const LOOK = {
  blood: { outline: 0x2a0606, hullK: 0.9, emissive: 0x140202, glow: 0xff5a2a,
    hull: `totalEmissiveRadiance += vec3(0.75, 0.08, 0.05) * fres * 0.5;`,
    sail: `diffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.0, 0.35, U.y));
      totalEmissiveRadiance += vec3(0.9, 0.08, 0.03) * smoothstep(0.05, 0.0, U.y) * 0.9 + vec3(0.6, 0.05, 0.02) * fres * 0.25;` },
  seagreen: { outline: 0x06281a, hullK: 0.92, emissive: 0x021208, glow: 0x5cff9a,
    hull: `totalEmissiveRadiance += vec3(0.2, 0.85, 0.5) * fres * 0.45
      + vec3(0.15, 0.7, 0.42) * smoothstep(0.985, 1.0, sin(P.z * 0.8 - T * 1.4 + P.y * 2.0)) * 0.3;`,
    sail: `float s = smoothstep(0.9, 1.0, sin(U.x * 42.0));
      totalEmissiveRadiance += vec3(0.25, 0.95, 0.5) * (smoothstep(0.05, 0.0, U.y) + smoothstep(0.96, 1.0, U.y) * 0.6 + s * 0.12) * 0.7;` },
  midnight: { outline: 0x0a1424, hullK: 0.7, emissive: 0x020408, glow: 0x8fd4ff,
    hull: `totalEmissiveRadiance += vec3(0.55, 0.7, 0.92) * pow(fres, 1.4) * 0.5;`,
    sail: `vec3 ir = 0.5 + 0.5 * cos(6.2831 * (fres * 1.4 + U.y * 0.3 + T * 0.04 + vec3(0.0, 0.33, 0.67)));
      totalEmissiveRadiance += ir * (fres * 0.3 + 0.03) + vec3(0.7, 0.8, 0.95) * smoothstep(0.04, 0.0, U.y) * 0.5;` },
  coral: { outline: 0x0c2a26, hullK: 1.0, emissive: 0x081a16, glow: 0xffb08a,
    hull: `vec3 c = P * 1.7, f = fract(c) - 0.5; float h = tlHash(floor(c));
      float spot = smoothstep(0.2, 0.06, length(f)) * step(0.82, h), pl = 0.45 + 0.55 * sin(T * (1.4 + h * 2.2) + h * 40.0);
      totalEmissiveRadiance += vec3(0.2, 1.0, 0.85) * spot * pl * 1.3 + vec3(1.0, 0.5, 0.4) * fres * 0.35;`,
    sail: `float ca = sin(U.x * 14.0 + T * 1.2 + sin(U.y * 9.0 - T) * 1.6) * sin(U.y * 12.0 - T * 0.9 + sin(U.x * 7.0 + T * 0.7) * 1.6);
      totalEmissiveRadiance += vec3(1.0, 0.62, 0.52) * smoothstep(0.55, 1.0, ca) * 0.32 + vec3(0.3, 1.0, 0.85) * smoothstep(0.04, 0.0, U.y) * 0.6;` },
  storm: { outline: 0x0c1622, hullK: 0.95, emissive: 0x04080c, glow: 0xbfe8ff,
    hull: `float fl = tlFlash(T, uTlSeed);
      totalEmissiveRadiance += vec3(0.62, 0.85, 1.0) * (fres * 0.45 + fl * 0.3);`,
    sail: `float fl = tlFlash(T, uTlSeed), n = tlNoise(vec3(U * vec2(6.0, 4.0), floor(T * 3.0 + uTlSeed * 7.0) * 0.37 + uTlSeed * 19.0));
      float vein = smoothstep(0.962, 0.995, 1.0 - abs(n * 2.0 - 1.0));
      totalEmissiveRadiance += vec3(0.6, 0.85, 1.0) * (vein * (0.35 + fl * 2.2) + fl * 0.22);` },
  admiral: { outline: 0x3a2a08, hullK: 1.0, emissive: 0x0c0802, glow: 0xffe2a8,
    hull: `float sw = smoothstep(0.92, 1.0, sin(P.z * 0.35 - T * 1.6 + P.y * 0.5));
      totalEmissiveRadiance += vec3(1.0, 0.82, 0.45) * (sw * 0.3 + fres * 0.18);`,
    sail: `float e = min(min(U.x, 1.0 - U.x), min(U.y, 1.0 - U.y));
      float b = smoothstep(0.065, 0.04, e) * (0.75 + 0.25 * sin(U.x * 80.0 + U.y * 80.0));
      float sw = smoothstep(0.94, 1.0, sin(U.x * 3.0 - T * 1.2 + U.y * 2.0));
      totalEmissiveRadiance += vec3(1.0, 0.78, 0.35) * (b * 0.95 + sw * 0.18);` },
};
function makeFx(id) {
  const L = LOOK[id], cache = new Map();
  return (m) => {
    if (!m || m.colorWrite === false) return m; // never the depth-only water lid
    if (cache.has(m)) return cache.get(m);
    let n = m;
    if (m.side === THREE.BackSide && m.isMeshBasicMaterial) {
      n = m.clone(); n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey; n.color.set(L.outline);
    } else if (m.isMeshToonMaterial) {
      const isSail = m.customProgramCacheKey?.() === 'sail';
      n = m.clone();
      if (!isSail) n.color.multiplyScalar(L.hullK);
      n.emissive = new THREE.Color(L.emissive); n.emissiveIntensity = 1;
      addLook(n, m, isSail ? L.sail : L.hull, id + (isSail ? 's' : 'h'));
      if (id === 'storm') n.userData.tlStorm = true;
    } else if (m.isMeshBasicMaterial) { n = m.clone(); n.color.set(L.glow).multiplyScalar(1.8); }
    cache.set(m, n); return n;
  };
}

// ---------- add-on parts (merged per skin + hull size, cached) ----------
const ni = (g) => g.index ? g.toNonIndexed() : g;
const place = (g, p, r = [0, 0, 0], s = [1, 1, 1]) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));
function clean(g) { g = ni(g); for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g.computeVertexNormals(); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }
const merge = (list) => { const g = mergeGeometries(list, false); list.forEach(x => x.dispose()); return g; };
// a strake: short boxes following the hull curve on one side, `dy` below the gunwale
function strake(out, ud, sx, dy, h = 0.18, t0 = 0.08, t1 = 0.92, n = 10, push = 1.0) {
  const { shape } = ud.layout, len = ud.len, zAt = (t) => (t - 0.5) * len;
  for (let i = 0; i < n; i++) {
    const ta = t0 + (t1 - t0) * i / n, tb = t0 + (t1 - t0) * (i + 1) / n, tm = (ta + tb) / 2;
    const xa = shape.halfW(ta) * push, xb = shape.halfW(tb) * push, za = zAt(ta), zb = zAt(tb);
    const l = Math.hypot(xb - xa, zb - za) * 1.04, yaw = Math.atan2(xb - xa, zb - za) * sx;
    out.push(clean(place(new THREE.BoxGeometry(0.1, h, l), [sx * (xa + xb) / 2 + sx * 0.03, shape.top(tm) - dy, (za + zb) / 2], [0, yaw, 0])));
  }
}
const _geo = new Map();
function cached(id, ud, quality, build) {
  const key = id + '|' + [ud.len, ud.beam, ud.depth, ud.layout.mastDefs.length].map(v => v.toFixed(2)).join('|') + quality;
  if (!_geo.has(key)) _geo.set(key, build());
  return _geo.get(key);
}
const MAT = {};
const mat = (k, make) => MAT[k] || (MAT[k] = make());
const gold = () => mat('gold', () => addLook(toon(0xffcd77, null, { emissive: new THREE.Color(0x4a3008), emissiveIntensity: 1 }), toon(0xffcd77), LOOK.admiral.hull, 'gold'));
const silver = () => mat('silver', () => addLook(toon(0xc8d4e0, null, { emissive: new THREE.Color(0x101820), emissiveIntensity: 1 }), toon(0xc8d4e0), `totalEmissiveRadiance += vec3(0.8, 0.9, 1.0) * fres * 0.7;`, 'silver'));
const pearl = () => mat('pearl', () => addLook(toon(0xf4f0ff, null, { emissive: new THREE.Color(0x202028), emissiveIntensity: 1 }), toon(0xf4f0ff),
  `vec3 ir = 0.5 + 0.5 * cos(6.2831 * (fres * 1.8 + T * 0.08 + P.y * 0.2 + vec3(0.0, 0.33, 0.67))); totalEmissiveRadiance += ir * (0.25 + fres * 0.6);`, 'pearl'));
const verdigris = () => mat('verd', () => toon(0x3fa88a, null, { emissive: new THREE.Color(0x0a2a1e), emissiveIntensity: 1 }));
const brass = () => mat('brass', () => toon(0xc9a24a, null, { emissive: new THREE.Color(0x2a1a04), emissiveIntensity: 1 }));
const glow = (c, k = 2.0) => mat('glow' + c, () => { const m = new THREE.MeshBasicMaterial(); m.color.set(c).multiplyScalar(k); return m; });
const coralM = () => mat('coral', () => addLook(toon(0xff6a50, null, { emissive: new THREE.Color(0x5a160a), emissiveIntensity: 1 }), toon(0xff7f6a),
  `totalEmissiveRadiance += vec3(1.0, 0.55, 0.45) * smoothstep(0.6, 1.0, fract(P.y * 1.3)) * 0.25 * (0.6 + 0.4 * sin(T * 1.7 + P.z));`, 'coral'));
const shellM = () => mat('shell', () => toon(0xffe0cc, null, { emissive: new THREE.Color(0x2a1a14), emissiveIntensity: 1 }));
const slate = () => mat('slate', () => { const m = addLook(toon(0x5a6470, null, { emissive: new THREE.Color(0x06090c), emissiveIntensity: 1 }), toon(0x5a6470), LOOK.storm.hull, 'slate'); m.userData.tlStorm = true; return m; });
const line = (c) => mat('line' + c, () => outlineMat(0.04, c));
function meshOf(ctx, geo, m, outlineCol) {
  const o = new THREE.Mesh(geo, m); o.userData.sharedGeo = true; ctx.add(o);
  if (outlineCol != null) { const l = outlineFor(o, 0.04); l.material = line(outlineCol); l.userData.sharedGeo = false; ctx.add(l); }
  return o;
}
const zAtOf = (ud) => (t) => (t - 0.5) * ud.len;
const deckAtOf = (ud) => (t) => ud.layout.shape.top(t) - ud.layout.deckDrop;

const PARTS = {
  blood(ship, ctx) {
    const g = cached('blood', ctx.ud, '', () => { const o = []; for (const sx of [1, -1]) strake(o, ctx.ud, sx, 0.32); return merge(o); });
    meshOf(ctx, g, gold(), null);
  },
  seagreen(ship, ctx) {
    const ud = ctx.ud, { shape } = ud.layout, zAt = zAtOf(ud);
    const G = cached('seagreen', ud, '', () => {
      const s = [], ring = [], lens = [];
      for (const sx of [1, -1]) {
        strake(s, ud, sx, 0.3, 0.16); strake(s, ud, sx, 1.55, 0.2, 0.12, 0.88, 9, 0.93);
        for (const t of [0.24, 0.36, 0.48, 0.6, 0.72]) {
          const x = sx * shape.halfW(t) * 0.99 + sx * 0.04, y = shape.top(t) - 0.9, z = zAt(t);
          ring.push(clean(place(new THREE.TorusGeometry(0.24, 0.06, 5, 10), [x, y, z], [0, Math.PI / 2, 0])));
          lens.push(clean(place(new THREE.CircleGeometry(0.2, 10), [x + sx * 0.01, y, z], [0, sx * Math.PI / 2, 0])));
        }
      }
      return { s: merge(s), ring: merge(ring), lens: merge(lens) };
    });
    meshOf(ctx, G.s, verdigris(), null); meshOf(ctx, G.ring, brass(), null); meshOf(ctx, G.lens, glow(0x5cff9a, 1.6), null);
  },
  midnight(ship, ctx) {
    const ud = ctx.ud, { shape, bowY } = ud.layout, zAt = zAtOf(ud);
    const G = cached('midnight', ud, '', () => {
      const s = [], p = [];
      for (const sx of [1, -1]) { strake(s, ud, sx, 0.28, 0.12); strake(s, ud, sx, 0.62, 0.08); }
      const cz = zAt(1) + 0.55;
      s.push(clean(place(new THREE.ConeGeometry(0.5, 1.3, 6), [0, bowY - 0.1, cz], [-1.9, 0, 0])));      // silver cradle under the pearl
      p.push(clean(place(new THREE.SphereGeometry(0.62, 14, 10), [0, bowY + 0.45, cz + 0.35])));
      return { s: merge(s), p: merge(p) };
    });
    meshOf(ctx, G.s, silver(), null); meshOf(ctx, G.p, pearl(), 0x0a1424);
  },
  coral(ship, ctx) {
    const ud = ctx.ud, { shape, bowY } = ud.layout, zAt = zAtOf(ud), low = ctx.quality === 'low';
    const G = cached('coral', ud, ctx.quality, () => {
      const c = [], sh = [];
      const ts = low ? [0.2, 0.5, 0.8] : [0.14, 0.3, 0.46, 0.62, 0.78, 0.9];
      for (const sx of [1, -1]) ts.forEach((t, i) => {
        const x = sx * shape.halfW(t) * 0.97, y = shape.top(t) - 1.6 - (i % 2) * 0.45, z = zAt(t);
        for (let k = 0; k < (low ? 3 : 5); k++) { const h = 0.8 + ((i * 7 + k * 3) % 5) * 0.22, a = (k - 2) * 0.42;
          const g = new THREE.ConeGeometry(0.16 + (k % 2) * 0.07, h, 5); g.translate(0, h / 2, 0);
          c.push(clean(place(g, [x + sx * 0.05, y, z + (k - 2) * 0.22], [a * 0.5, 0, -sx * (0.5 + Math.abs(a) * 0.4)]))); }
        if (i % 2 === 0) sh.push(clean(place(new THREE.SphereGeometry(0.28, 8, 5), [x + sx * 0.08, shape.top(t) - 1.25, z], [0, 0, 0], [0.4, 1, 1.1])));
      });
      // bow cluster: rooted on both cheeks of the stem just below the bowsprit, branching forward / out / up
      for (let k = 0; k < (low ? 4 : 7); k++) { const sx = k % 2 ? 1 : -1, t = 0.955 + (k % 3) * 0.012, h = 0.7 + (k % 4) * 0.22;
        const g = new THREE.ConeGeometry(0.15, h, 5); g.translate(0, h / 2, 0);
        c.push(clean(place(g, [sx * shape.halfW(t) * 0.85, shape.top(t) - 0.7 - (k % 3) * 0.35, zAt(t)], [0.55 + (k % 3) * 0.2, 0, -sx * (0.45 + (k % 2) * 0.25)]))); }
      return { c: merge(c), sh: merge(sh) };
    });
    meshOf(ctx, G.c, coralM(), 0x3a0c06); meshOf(ctx, G.sh, shellM(), null);
    if (!low) ctx.add(wake(ud, 'coral'), ship);
  },
  storm(ship, ctx) {
    const ud = ctx.ud, { mastDefs } = ud.layout, zAt = zAtOf(ud), deckAt = deckAtOf(ud), low = ctx.quality === 'low';
    const G = cached('storm', ud, '', () => {
      const s = [], tip = [], arcs = [];
      for (const sx of [1, -1]) { strake(s, ud, sx, 0.3, 0.22); strake(s, ud, sx, 1.2, 0.3, 0.15, 0.85, 8, 0.97); }
      mastDefs.forEach(([tf, hf], i) => { if (i === 0) return; // the main masthead keeps the flag
        const my = deckAt(tf) + ud.len * 0.98 * hf, z = zAt(tf);
        s.push(clean(place(new THREE.CylinderGeometry(0.04, 0.08, 2.0, 5), [0, my + 1.0, z])));
        tip.push(clean(place(new THREE.SphereGeometry(0.16, 8, 6), [0, my + 2.05, z])));
        arcs.push([0, my + 2.05, z]); });
      mastDefs.forEach(([tf, hf]) => { const mh = ud.len * 0.98 * hf, yw = ud.beam * 1.5 * hf; for (const sx of [1, -1]) arcs.push([sx * yw / 2, deckAt(tf) + mh * 0.74, zAt(tf) + 0.22]); });
      return { s: merge(s), tip: merge(tip), arcs };
    });
    meshOf(ctx, G.s, slate(), null); meshOf(ctx, G.tip, glow(0xbfe8ff, 2.4), null);
    if (!low) { ctx.add(arcPoints(ship, ud, G.arcs)); ctx.add(wake(ud, 'storm'), ship); }
    ship.traverse(o => { if (o.isMesh && o.material?.userData?.tlStorm) seedOnDraw(ship, o); });
  },
  admiral(ship, ctx) {
    const ud = ctx.ud, { shape, mastDefs, bowY } = ud.layout, zAt = zAtOf(ud), deckAt = deckAtOf(ud), low = ctx.quality === 'low';
    const G = cached('admiral', ud, '', () => {
      const g = [], win = [];
      for (const sx of [1, -1]) { strake(g, ud, sx, 0.26, 0.14); strake(g, ud, sx, 0.62, 0.1); strake(g, ud, sx, 1.7, 0.16, 0.12, 0.88, 9, 0.93); }
      // gilded figurehead: body, head, swept wings
      const fz = zAt(1) + 0.7;
      g.push(clean(place(new THREE.ConeGeometry(0.5, 2.0, 7), [0, bowY - 0.5, fz], [-1.05, 0, 0])));
      g.push(clean(place(new THREE.SphereGeometry(0.38, 10, 8), [0, bowY + 0.3, fz + 0.75])));
      for (const sx of [1, -1]) g.push(clean(place(new THREE.BoxGeometry(0.08, 0.8, 1.5), [sx * 0.5, bowY - 0.1, fz + 0.1], [-0.4, 0, sx * 0.55])));
      // masthead crowns (not on the flag mast top), stern gallery rail + windows
      mastDefs.forEach(([tf, hf], i) => { const my = deckAt(tf) + ud.len * 0.98 * hf; if (i) g.push(clean(place(new THREE.TorusGeometry(0.3, 0.07, 5, 10), [0, my - 0.15, zAt(tf)], [Math.PI / 2, 0, 0])));
        g.push(clean(place(new THREE.TorusGeometry(0.34, 0.06, 5, 12), [0, deckAt(tf) + ud.len * 0.98 * hf * 0.5, zAt(tf)], [Math.PI / 2, 0, 0]))); });
      const ts = 0.03, sz = zAt(ts) - 0.08, sy = shape.top(ts);
      g.push(clean(place(new THREE.BoxGeometry(shape.halfW(ts) * 1.8, 0.14, 0.14), [0, sy - 0.2, sz])));
      for (let i = 0; i < 4; i++) win.push(clean(place(new THREE.PlaneGeometry(0.42, 0.5), [(i - 1.5) * shape.halfW(ts) * 0.42, sy - 0.85, sz - 0.02], [0, Math.PI, 0])));
      return { g: merge(g), win: merge(win) };
    });
    meshOf(ctx, G.g, gold(), 0x3a2a08); meshOf(ctx, G.win, glow(0xffe2a8, 2.0), null);
    if (!low) { ctx.add(pennants(ud)); ctx.add(wake(ud, 'admiral'), ship); }
  },
};

// ---------- streaming pennants (admiral, high): wide swallowtail flags, one merged mesh, waved on the GPU ----------
// navy field, gold border + gold centre stripe; the wave is a travelling sine (lateral + vertical) that grows toward
// the fly end, plus a fixed S-curve so a still frame (shop preview, screenshot) still shows a flag in the wind.
const _penMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime },
  vertexShader: `attribute float aK; attribute float aV; uniform float uT; varying float vK; varying float vV; varying float vShade;
    void main(){ vK = aK; vV = aV; vec3 p = position; float w = 0.25 + 0.75 * aK;
      float ph = uT * 4.2 - aK * 7.5;
      p.x += (sin(ph) * 0.55 + sin(aK * 5.5) * 0.35) * w * aK * 1.6;
      p.y += sin(uT * 3.1 - aK * 6.0) * 0.22 * w * aK - aK * aK * 0.35;
      vShade = 0.72 + 0.28 * cos(ph);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader: `varying float vK; varying float vV; varying float vShade;
    void main(){ float a = abs(vV); float border = step(0.78, a) + step(vK, 0.04); float stripe = step(a, 0.16) * step(0.12, vK);
      vec3 c = mix(vec3(0.1, 0.17, 0.44), vec3(1.0, 0.8, 0.42), clamp(border + stripe, 0.0, 1.0));
      gl_FragColor = vec4(c * vShade, 1.0); }`,
  side: THREE.DoubleSide,
});
// one swallowtail ribbon in local space: hoist at z = 0, flies aft to z = -L; aV -1 (foot) .. 1 (head)
function swallowtail(L, H, N = 16, notch = 0.68) {
  const pos = [], aK = [], aV = [], idx = [];
  const half = (k) => H / 2 * (1 - 0.5 * k); // tapers toward the fly
  for (const sgn of [1, -1]) { const base = pos.length / 3;
    for (let j = 0; j <= N; j++) { const k = j / N, km = Math.min(k, notch);
      pos.push(0, sgn * half(k), -k * L); aK.push(k); aV.push(sgn);                    // outer edge runs to the tail tip
      pos.push(0, sgn * (k > notch ? half(k) * 0.18 : 0), -km * L); aK.push(km); aV.push(0); } // centre line stops at the notch
    for (let j = 0; j < N; j++) { const a = base + j * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute(aK, 1)); g.setAttribute('aV', new THREE.Float32BufferAttribute(aV, 1));
  g.setIndex(idx); return g;
}
function pennants(ud) {
  const g = cached('pen', ud, '', () => {
    const { mastDefs } = ud.layout, zAt = zAtOf(ud), deckAt = deckAtOf(ud), list = [];
    mastDefs.forEach(([tf, hf], i) => { if (!i) return; const my = deckAt(tf) + ud.len * 0.98 * hf, L = ud.len * 0.3, H = 1.3;
      const p = swallowtail(L, H); p.translate(0, my - H / 2 - 0.1, zAt(tf) - 0.15); list.push(p); });
    return list.length ? mergeGeometries(list, false) : null;
  });
  const m = new THREE.Mesh(g || new THREE.BufferGeometry(), _penMat); m.frustumCulled = false; m.userData.sharedGeo = !!g; return m;
}

// ---------- storm arcs (high): crackling sparks on rods + yard tips, flicker on the shared clock ----------
const _arcMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime, uPR: { value: 1 }, uSeed: STORM_SEED },
  vertexShader: `attribute float aS; uniform float uT; uniform float uPR; uniform float uSeed; varying float vA;
    float h(float n){ return fract(sin(n) * 43758.5453); }
    void main(){ float s = floor(uT * 14.0 + aS * 5.0 + uSeed * 11.0); vA = step(0.55, h(s + aS * 31.0 + uSeed * 97.0));
      vec3 p = position + (vec3(h(s + 1.0), h(s + 2.0), h(s + 3.0)) - 0.5) * 0.6;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = clamp(220.0 / max(1.0, -mv.z), 3.0, 40.0) * uPR; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float a = (max(0.0, 1.0 - abs(q.x) * 12.0) * max(0.0, 1.0 - abs(q.y) * 2.2)
      + max(0.0, 1.0 - abs(q.y) * 12.0) * max(0.0, 1.0 - abs(q.x) * 2.2) + smoothstep(0.2, 0.0, length(q))) * vA; if (a < 0.02) discard;
      gl_FragColor = vec4(vec3(0.7, 0.9, 1.0) * a * 1.6, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
function arcPoints(ship, ud, pts) {
  const g = cached('arcs', ud, '', () => { const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    b.setAttribute('aS', new THREE.Float32BufferAttribute(pts.map((_, i) => i * 0.618 % 1), 1)); return b; });
  const p = new THREE.Points(g, _arcMat); p.frustumCulled = false; p.renderOrder = 3; p.userData.sharedGeo = true;
  p.onBeforeRender = (r) => { _arcMat.uniforms.uPR.value = r.getPixelRatio(); STORM_SEED.value = shipSeed(ship.userData); _arcMat.uniformsNeedUpdate = true; };
  return p;
}

// ---------- speed-driven wake (coral / storm / admiral, high): one shared Points material, per-ship values pushed ----------
const WAKE = { coral: [0.3, 1.0, 0.85, 0], storm: [0.85, 0.93, 1.0, 1], admiral: [1.0, 0.82, 0.45, 2] }; // rgb, style
const _wakeMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime, uSpeed: { value: 0 }, uBox: { value: new THREE.Vector3() }, uCol: { value: new THREE.Vector4() }, uPR: { value: 1 } },
  vertexShader: `attribute vec3 seed; uniform float uT; uniform float uSpeed; uniform vec3 uBox; uniform vec4 uCol; uniform float uPR; varying float vA;
    void main(){ float life = fract(uT * (0.24 + seed.z * 0.14) + seed.x);
      vec3 p = vec3((seed.y - 0.5) * uBox.x * (0.35 + life * 1.1), 0.15, uBox.z - life * uBox.y * (0.35 + 0.65 * uSpeed));
      if (uCol.w > 0.5 && uCol.w < 1.5) p.y += sin(life * 3.1416) * (0.8 + seed.z); // storm spray arcs up
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float tw = 0.5 + 0.5 * sin(uT * (uCol.w > 1.5 ? 9.0 : 3.0) + seed.y * 80.0);
      vA = (1.0 - life) * (0.55 + 0.45 * tw) * uSpeed;
      float sz = uCol.w > 0.5 && uCol.w < 1.5 ? 1.4 : 0.7;
      gl_PointSize = clamp(sz * (0.5 + 0.5 * seed.z) * (1.0 - life * 0.5) * 260.0 / max(1.0, -mv.z), 1.0, 60.0) * uPR;
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec4 uCol; varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q);
      float a = smoothstep(0.5, 0.0, d) * vA * (uCol.w > 0.5 && uCol.w < 1.5 ? 0.45 : 0.9); if (a < 0.02) discard;
      gl_FragColor = vec4(uCol.rgb * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
let _wakeGeo = null;
function wake(ud, id) {
  if (!_wakeGeo) { const n = 28, s = new Float32Array(n * 3); for (let i = 0; i < s.length; i++) s[i] = ((Math.sin(i * 91.7 + 17.3) * 43758.5453) % 1 + 1) % 1;
    _wakeGeo = new THREE.BufferGeometry(); _wakeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); _wakeGeo.setAttribute('seed', new THREE.BufferAttribute(s, 3)); }
  const p = new THREE.Points(_wakeGeo, _wakeMat); p.frustumCulled = false; p.renderOrder = 4; p.userData.sharedGeo = true; p.userData.tierWake = id;
  const box = new THREE.Vector3(ud.beam, ud.len * 0.9, -ud.len * 0.46), col = WAKE[id], F = { v: 0 };
  p.userData.tier = F;
  p.onBeforeRender = (r) => { wakeSpeed(p, F); const U = _wakeMat.uniforms; U.uSpeed.value = F.v; U.uBox.value.copy(box); U.uCol.value.set(...col); U.uPR.value = r.getPixelRatio(); _wakeMat.uniformsNeedUpdate = true; };
  return p;
}
// each ship's own speed, never the local player's: tierTick() feed (remote ships) > userData.speed > measured movement
const _wp = new THREE.Vector3(), SPEED_FULL = 10;
function wakeSpeed(p, F) {
  const ship = p.parent; if (!ship) return;
  const ud = ship.userData, now = performance.now(), S = ud.tierFx || (ud.tierFx = { t: now, x: 0, z: 0 });
  if (now - S.t < 12) return;
  const dt = Math.min(0.25, (now - S.t) / 1000); ship.getWorldPosition(_wp);
  let v; if (S.fedAt && now - S.fedAt < 600) v = S.fed; else if (typeof ud.speed === 'number') v = ud.speed; else v = Math.hypot(_wp.x - S.x, _wp.z - S.z) / dt;
  S.x = _wp.x; S.z = _wp.z; S.t = now;
  F.v += (Math.min(1, Math.max(0, Math.abs(v) / SPEED_FULL)) - F.v) * Math.min(1, dt * 4);
}

// Per-frame hook for PvP ships whose speed comes from the network (one shared hook for all six tier skins):
//   tierTick(ship, { speed, id })   speed in world units / s (the synced value); id = that ship's stable PvP id
//   (remote: s.net.id, local: myId), stored as userData.netId for the storm seed if not already set.
// No-op unless ship.userData.skinId is one of TIER_IDS. Shader / arc / pennant animation runs on the shared
// wind.uTime clock on every client with no tick at all; the tick only feeds the speed-driven wakes.
export function tierTick(ship, { speed, id } = {}) {
  const ud = ship?.userData; if (!ud || !TIER_IDS.includes(ud.skinId)) return;
  if (id !== undefined && id !== null && ud.netId === undefined) ud.netId = id; // stable PvP id -> storm seed (see shipSeed)
  if (typeof speed !== 'number') return;
  const S = ud.tierFx || (ud.tierFx = { t: performance.now(), x: 0, z: 0 });
  S.fed = speed; S.fedAt = performance.now();
}

// { id: { materialFx, partsOverride } } for the six tier skins
export const TIER_LOOKS = Object.fromEntries(TIER_IDS.map(id => [id, { materialFx: makeFx(id), partsOverride: (ship, ctx) => PARTS[id](ship, ctx) }]));
// attach the looks to the matching skin objects (Golden / Ghost / Kraken and every other id are left alone)
export function applyTierLooks(skins) {
  for (const s of skins || []) { const L = s && TIER_LOOKS[s.id]; if (L) { s.materialFx = L.materialFx; s.partsOverride = L.partsOverride; } }
  return skins;
}
export default TIER_LOOKS;
