// [Raul] upgrade visuals — PUMPFUN PIRATES · Storm Hunt — modular trait-part ship compiler
// The player's ship is COMPILED from the Shipwright upgrade levels (js/upgrades.js) + the equipped skin (js/skins.js):
//   1. HULL picks one of four hull builds (sloop → brig → frigate → man-o'-war). Each is a real hull from
//      Emerly's buildShip() at its own size, so each gets its own matching depth-only water lid.
//   2. Every other trait's part set for its level (WEAPONS, CREW, SAILS, ARMOR, SPY TOWER, RUDDER/STERN) is attached
//      to that hull's anchor points (gun slots, gunwale, masts, bow, transom, roofs) and sized to fit, so any combo works.
//   3. All trait parts are merged into ONE mesh per material (+ one outline mesh), so a maxed ship costs a handful
//      of extra draw calls. Low quality uses fewer segments / rivets / decorative pieces and fewer outlines.
//   4. Purchases are instant: likely next builds are pre-compiled (and their shaders warmed) while the game is not
//      in active play (title, shop, pause), then swapped in when bought.
// Every trait level is a plain data definition in TRAITS (swappable, future-trait friendly; nothing on-chain).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildShip, disposeShip } from './ships.js';
import { toon, glowMat, outlineFor, woodTexture, metalTexture, goldTexture } from './toon.js';
import { UPGRADES, BASE_SHIP } from './upgrades.js';
import { equippedSkin, skinBuildOpts, skinMaterialFx } from './skins.js';
import { runPartsOverride } from '../assets/ships/pvp/partsOverride.js'; // [Raul] PvP skin parts-override API

// ---------- trait definitions (level 0..6, CANNONS 0..8) ----------
// [more levels] every shop level adds or grows something visible, and parts stack level over level.
const tierVal = (id, lv, base) => (lv > 0 ? UPGRADES.find(u => u.id === id).tiers[lv - 1].value : base);
export const TRAITS = {
  hull: [ // level 0 is the original player ship, so base gameplay is unchanged. Beam grows faster than length so
          // a bigger hull reads as WIDER from the stern chase camera, not just a taller rig.
    { name: 'SLOOP',      len: 17,   beam: 5.4, depth: 3.1 },
    { name: 'CUTTER',     len: 18,   beam: 6.0, depth: 3.25, belt: true },
    { name: 'BRIG',       len: 19,   beam: 6.6, depth: 3.4,  belt: true, forecastle: true, quarter: 1 },
    { name: 'BRIGANTINE', len: 20.2, beam: 7.2, depth: 3.6,  belt: true, forecastle: true, poop: true, quarter: 1, patches: true },
    { name: 'FRIGATE',    len: 21.5, beam: 7.9, depth: 3.8,  belt: true, forecastle: true, poop: true, fenders: true, quarter: 1, patches: true },
    { name: 'SHIP OF THE LINE', len: 23, beam: 8.6, depth: 4.05, belt: true, forecastle: true, poop: true, fenders: true, quarter: 2, patches: true },
    { name: "MAN-O'-WAR", len: 24.5, beam: 9.4, depth: 4.3,  belt: true, forecastle: true, poop: true, fenders: true, quarter: 2, patches: true, gold: true },
  ],
  sails: [ // w/h = scale of every base sail; top = topmast height (fraction of the mast)
    { w: 1,    h: 1 },
    { w: 1.08, h: 1.01, top: 0.06 },
    { w: 1.18, h: 1.03, top: 0.12 },
    { w: 1.25, h: 1.04, top: 0.15, royal: true },
    { w: 1.32, h: 1.05, top: 0.18, royal: true, spanker: true },
    { w: 1.38, h: 1.05, top: 0.2,  royal: true, spanker: true, fourthMast: true },
    { w: 1.45, h: 1.06, top: 0.22, royal: true, spanker: true, fourthMast: true, gold: true },
  ],
  cannons: [ // perSide = real deck guns (matches the cannon stat); the rest are extra weapon mounts
    { perSide: tierVal('cannons', 0, BASE_SHIP.cannons) },
    { perSide: tierVal('cannons', 1), big: 1.15 },
    { perSide: tierVal('cannons', 2), big: 1.25, swivels: true },
    { perSide: tierVal('cannons', 3), big: 1.3, swivels: true, bowChaser: true },
    { perSide: tierVal('cannons', 4), big: 1.38, swivels: true, bowChaser: true, sternGuns: true },
    { perSide: tierVal('cannons', 5), big: 1.42, swivels: true, bowChaser: true, sternGuns: true },
    { perSide: tierVal('cannons', 6), big: 1.48, swivels: true, bowChaser: true, sternGuns: true, lowerDeck: true },
    { perSide: tierVal('cannons', 7), big: 1.54, swivels: true, bowChaser: true, sternGuns: true, lowerDeck: true, mortar: true },
    { perSide: tierVal('cannons', 8), big: 1.6, swivels: true, bowChaser: true, sternGuns: true, lowerDeck: true, mortar: true, gold: true },
  ],
  reload: [{}, { racks: true }, { racks: true, litPorts: true }, { racks: true, litPorts: true, linstocks: true }, { racks: true, litPorts: true, linstocks: true, magazine: true },
    { racks: true, litPorts: true, linstocks: true, magazine: true, lockers: true }, { racks: true, litPorts: true, linstocks: true, magazine: true, lockers: true, gold: true }],
  armor: [{}, { plates: true }, { plates: true, rail: true }, { plates: true, rail: true, bands: 1 }, { plates: true, rail: true, bands: 1, ram: true },
    { plates: true, rail: true, bands: 2, ram: true }, { plates: true, rail: true, bands: 2, ram: true, gold: true }],
  range: [{}, { lookout: true }, { lookout: true, crowsNest: true, jibGlass: true }, { lookout: true, crowsNest: true, jibGlass: true, railScopes: true },
    { lookout: true, crowsNest: true, jibGlass: true, railScopes: true, watchtower: true }, { lookout: true, crowsNest: true, jibGlass: true, railScopes: true, watchtower: true, lamps: true },
    { lookout: true, crowsNest: true, jibGlass: true, railScopes: true, watchtower: true, lamps: true, gold: true }],
  rudder: [{}, { rudder: 1 }, { rudder: 1.05, sternLamps: true }, { rudder: 1.12, sternLamps: true, wheel: true }, { rudder: 1.2, sternLamps: true, wheel: true, gallery: true },
    { rudder: 1.3, sternLamps: true, wheel: true, gallery: true, straps: true }, { rudder: 1.35, sternLamps: true, wheel: true, gallery: true, straps: true, gold: true }],
};
export const TRAIT_IDS = ['hull', 'armor', 'sails', 'rudder', 'cannons', 'reload', 'range'];
const WATCH_H = 1.9;
// overall scale: hull size does most of it, every other tier adds a little (max ≈ 1.6× length, 1.9× beam)
const extraScale = (lv) => 1 + 0.0028 * TRAIT_IDS.reduce((a, id) => a + (id === 'hull' ? 0 : (lv[id] || 0)), 0);

// ---------- quality ----------
let LO = false; // set per compile (compile is synchronous)
const seg = (hi, lo) => (LO ? lo : hi);

// ---------- materials per skin (brand: gold #ffcd77, red #fa0d0d, dark #161616) ----------
const _mats = new Map();
let M = null;
function mats(skin) {
  if (_mats.has(skin.id)) return (M = _mats.get(skin.id));
  const P = skin.parts || {};
  const goldT = goldTexture({ base: P.gold ?? 0xffcd77 });
  const m = {
    oak: toon(0xffffff, woodTexture({ base: P.oak ?? 0x4a2c18, rows: 4, seed: 91, w: 256, h: 128 })),
    plank: toon(0xffffff, woodTexture({ base: P.plank ?? 0x5a3820, rows: 3, seed: 93, w: 256, h: 128, vertical: true })),
    deck: toon(0xffffff, woodTexture({ base: P.deck ?? 0x9a6b43, rows: 6, seed: 7, w: 256, h: 128 })),
    iron: toon(0xffffff, metalTexture({ base: P.iron ?? 0x23272e, highlight: 0x8d97a6, seed: 17 }), { side: THREE.DoubleSide }),
    gold: toon(0xffffff, goldT),
    rivet: toon(0xffffff, goldT), // same look as gold, but never outlined (hundreds of tiny parts)
    red: toon(0xfa0d0d, null, { side: THREE.DoubleSide }),
    dark: toon(0x161616),
    ball: toon(0x22252b),
    keg: toon(0xffffff, woodTexture({ base: 0x7a4a2a, rows: 5, seed: 95, w: 256, h: 128, nails: false })),
    glow: glowMat(P.glow ?? 0xffb04a, 2.6),
    fuse: glowMat(0xff7a2a, 3.2),
    lens: glowMat(0x9fe8ff, 2.4),
    gleam: glowMat(P.gold ?? 0xffcd77, 1.8),
  };
  m.outlinedHi = new Set([m.oak, m.plank, m.deck, m.iron, m.gold, m.dark, m.keg]);
  m.outlinedLo = new Set([m.oak, m.plank, m.deck, m.iron]);
  _mats.set(skin.id, m);
  return (M = m);
}

const cyl = (r1, r2, h, s = 8) => new THREE.CylinderGeometry(r1, r2, h, LO ? Math.max(4, s - 3) : s);
const sph = (r) => new THREE.SphereGeometry(r, seg(8, 6), seg(6, 4));
const torus = (r, t) => new THREE.TorusGeometry(r, t, seg(5, 4), seg(12, 8));
const tube = (curve, n, r, rs = 5) => new THREE.TubeGeometry(curve, Math.max(6, Math.round(n * seg(0.6, 0.4))), r, LO ? 4 : Math.min(rs, 5));
const RIVET = new THREE.OctahedronGeometry(0.08);
const box = (x, y, z, r = 0.05) => new RoundedBoxGeometry(x, y, z, 1, Math.max(0.005, Math.min(r, x / 2.2, y / 2.2, z / 2.2)));
const lathe = (pts, segs = 8) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
const CANNON = [[0.001, -0.15], [0.24, -0.15], [0.29, 0.05], [0.23, 0.2], [0.21, 0.86], [0.25, 0.9], [0.3, 1.12], [0.3, 1.22], [0.15, 1.12]];
const KEG = [[0.001, 0], [0.3, 0], [0.36, 0.25], [0.36, 0.45], [0.3, 0.7], [0.001, 0.7]];
const SPYGLASS = [[0.001, 0], [0.11, 0], [0.11, 0.45], [0.09, 0.47], [0.09, 0.9], [0.075, 0.92], [0.075, 1.3], [0.06, 1.32], [0.06, 1.55], [0.001, 1.55]];
const MORTAR = [[0.001, 0], [0.75, 0], [0.75, 0.25], [0.6, 0.35], [0.62, 0.9], [0.72, 1.0], [0.72, 1.12], [0.5, 1.12], [0.48, 0.5], [0.001, 0.5]];
const _up = new THREE.Vector3(0, 1, 0);

// collects geometry per material; build() returns a template: merged geometry per material (+ outlines) and extras
class Layer {
  constructor(name) { this.group = new THREE.Group(); this.group.name = 'upg-' + name; this.by = new Map(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); }
  add(mat, geo, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
    const sv = Array.isArray(s) ? s : [s, s, s];
    const q = r.isQuaternion ? r : this._q.setFromEuler(this._e.set(r[0], r[1], r[2], r[3] || 'XYZ'));
    const c = (geo.index ? geo.clone() : geo.clone()).applyMatrix4(this._m.compose(new THREE.Vector3(...p), q, new THREE.Vector3(...sv)));
    for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(k)) c.deleteAttribute(k);
    if (!c.index) { const n = c.attributes.position.count, ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; c.setIndex(new THREE.BufferAttribute(ix, 1)); }
    if (!c.attributes.uv) c.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2));
    if (!c.attributes.normal) c.computeVertexNormals();
    if (!this.by.has(mat)) this.by.set(mat, []);
    this.by.get(mat).push(c);
  }
  span(mat, a, b, r1, r2 = r1, segs = 7) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    this.add(mat, cyl(r2, r1, L, segs), A.clone().add(B).multiplyScalar(0.5).toArray(), new THREE.Quaternion().setFromUnitVectors(_up, d.normalize()));
  }
  build() {
    const parts = [], outlines = [], box3 = new THREE.Box3(), outlined = LO ? M.outlinedLo : M.outlinedHi;
    for (const [mat, list] of this.by) {
      const geo = mergeGeometries(list, false); list.forEach(g => g.dispose());
      if (!geo) continue;
      geo.computeBoundingBox(); box3.union(geo.boundingBox);
      parts.push({ mat, geo });
      if (outlined.has(mat)) { const o = outlineFor(new THREE.Mesh(geo, mat), 0.05); outlines.push({ mat: o.material, geo: o.geometry }); }
    }
    this.by.clear();
    this.group.children.forEach(o => o.traverse(c => { if (c.geometry) c.userData.sharedGeo = true; }));
    return { parts, outlines, extras: this.group, box: box3 };
  }
}

// ---------- hull anchor points (same parametric hull as ships.js) ----------
function anchors(ud, lv) {
  const L = ud.layout, { shape } = L, len = ud.len, beam = ud.beam, depth = ud.depth;
  const zAt = (t) => (t - 0.5) * len;
  const deckAt = (t) => shape.top(t) - L.deckDrop;
  const sideX = (t, drop) => { // hull half-width `drop` metres below the gunwale at station t
    const yd = shape.top(t), yk = shape.keel(t), w = shape.halfW(t);
    const u = Math.min(1, Math.pow(Math.max(0, drop) / Math.max(0.01, yd - yk), 1 / 1.1));
    return w * Math.pow(Math.sqrt(Math.max(0, 1 - u * u)), 0.42) * (1 - 0.08 * Math.pow(1 - u, 3));
  };
  const sideYaw = (t, sx) => { const dw = (shape.halfW(Math.min(1, t + 0.01)) - shape.halfW(Math.max(0, t - 0.01))) / (0.02 * len); return Math.atan2(sx * dw, 1); };
  const n = TRAITS.cannons[lv.cannons || 0].perSide;
  const gunT = [...Array(n)].map((_, i) => 0.3 + (i / Math.max(1, n - 1)) * 0.34); // same slots buildShip uses
  const midT = gunT.slice(1).map((t, i) => (t + gunT[i]) / 2);
  const masts = L.mastDefs.map(([tf, hf]) => ({ t: tf, z: zAt(tf), y: deckAt(tf), h: len * 0.98 * hf }));
  const H = TRAITS.hull[lv.hull || 0], S = TRAITS.sails[lv.sails || 0];
  const roofY = L.cab.y0 + L.cab.h + 0.15;
  const poop = H.poop ? { w: L.cab.w * 0.74, l: L.cab.l * 0.52, h: 1.3 * depth / 3.1, z: L.cab.z - L.cab.l * 0.21 } : null;
  const foreT0 = 0.85, foreY = (t) => shape.top(t) + 0.32;
  const mainTop = masts[0].y + masts[0].h + (S.top ? masts[0].h * S.top : 0);
  return { L, shape, len, beam, depth, k: depth / 3.1, zAt, deckAt, sideX, sideYaw, gunT, midT, masts, roofY, poop, foreT0, foreY, hull: H, sails: S, mainTop };
}
// curved strip that hugs the hull side between drops d0..d1 over stations t0..t1 (outward normals)
function hullPanel(A, t0, t1, d0, d1, sx, out = 0.06, nt = 6, nd = 3) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nt; i++) for (let j = 0; j <= nd; j++) {
    const t = t0 + (t1 - t0) * i / nt, D1 = typeof d1 === 'function' ? d1(t) : d1, d = d0 + (D1 - d0) * j / nd;
    pos.push(sx * (A.sideX(t, d) + out), A.shape.top(t) - d, A.zAt(t)); uv.push(i / nt, 1 - j / nd);
  }
  const P = nd + 1;
  for (let i = 0; i < nt; i++) for (let j = 0; j < nd; j++) {
    const a = i * P + j, b = (i + 1) * P + j, c = a + 1, d = b + 1;
    if (sx > 0) idx.push(a, b, c, c, b, d); else idx.push(a, c, b, c, d, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function sideCurve(A, t, sx, d0, d1, out) {
  const pts = []; for (let i = 0; i <= 8; i++) { const d = d0 + (d1 - d0) * i / 8; pts.push(new THREE.Vector3(sx * (A.sideX(t, d) + out), A.shape.top(t) - d, A.zAt(t))); }
  return new THREE.CatmullRomCurve3(pts);
}
function lineCurve(A, sx, d, out, t0 = 0.04, t1 = 0.95) {
  const pts = []; for (let i = 0; i <= 20; i++) { const t = t0 + (t1 - t0) * i / 20; pts.push(new THREE.Vector3(sx * (A.sideX(t, d) + out), A.shape.top(t) - d, A.zAt(t))); }
  return new THREE.CatmullRomCurve3(pts);
}
function sailGeo(w, h, billow) {
  const g = new THREE.PlaneGeometry(w, h, 8, 6); g.translate(0, -h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), y = -p.getY(i) / h; p.setZ(i, billow * (1 - x * x) * (0.35 + 0.65 * Math.sin(Math.min(1, y * 1.15) * Math.PI * 0.9))); }
  g.computeVertexNormals(); return g;
}
function sailPair(geo, front, back, furl = true) { const g = new THREE.Group(); g.add(new THREE.Mesh(geo, front), new THREE.Mesh(geo, back)); g.userData.upgSail = furl; return g; }
function muzzle(Ly, side, p, order) { const m = new THREE.Object3D(); m.position.set(...p); m.userData.upgMuzzle = side; m.userData.order = order; Ly.group.add(m); }

// ---------- part sets per trait ----------
const PARTS = {
  // HULL: size comes from buildShip; this adds the build's superstructure (belt, forecastle, poop deck, fenders, gold)
  hull(A, T, Ly) {
    const { k } = A;
    if (T.belt) for (const sx of [1, -1]) {
      Ly.add(M.oak, tube(lineCurve(A, sx, 1.0 * k, 0.05), 40, 0.17 * k, 6));
      for (let i = 0; i < 16; i++) { const t = 0.2 + (i + 0.5) / 16 * 0.68; Ly.add(M.plank, box(0.14, 0.5, 0.68 / 16 * A.len + 0.02, 0.03), [sx * A.shape.halfW(t) * 0.9, A.shape.top(t) + 0.3, A.zAt(t)], [0, A.sideYaw(t, sx), 0]); }
    }
    if (T.forecastle) { // raised bow deck with a railing
      for (let i = 0; i < 6; i++) {
        const t = A.foreT0 + (i + 0.5) / 6 * 0.12, w = A.shape.halfW(t) * 1.9, y = A.foreY(t);
        Ly.add(M.deck, box(w, 0.32, 0.12 * A.len / 6 + 0.04, 0.04), [0, y - 0.16, A.zAt(t)]);
        for (const sx of [1, -1]) Ly.add(M.oak, cyl(0.07, 0.08, 0.6, 5), [sx * w / 2 * 0.92, y + 0.3, A.zAt(t)]);
      }
      Ly.add(M.oak, box(A.shape.halfW(A.foreT0) * 1.9, A.foreY(A.foreT0) - A.deckAt(A.foreT0) + 0.1, 0.3, 0.06), [0, (A.foreY(A.foreT0) + A.deckAt(A.foreT0)) / 2 - 0.1, A.zAt(A.foreT0)]);
      for (const sx of [1, -1]) {
        const pts = []; for (let i = 0; i <= 6; i++) { const t = A.foreT0 + i / 6 * 0.12; pts.push(new THREE.Vector3(sx * A.shape.halfW(t) * 0.87, A.foreY(t) + 0.6, A.zAt(t))); }
        Ly.add(T.gold ? M.gold : M.oak, tube(new THREE.CatmullRomCurve3(pts), 12, 0.09, 5));
      }
    }
    if (A.poop) { // second stern deck on the cabin roof, glowing stern windows, gold roof
      const p = A.poop, y0 = A.roofY - 0.15;
      Ly.add(M.plank, box(p.w, p.h, p.l, 0.18), [0, y0 + p.h / 2, p.z]);
      Ly.add(M.gold, box(p.w + 0.35, 0.2, p.l + 0.3, 0.07), [0, y0 + p.h + 0.08, p.z]);
      for (let i = 0; i < 3; i++) { const x = (i - 1) * p.w * 0.3; Ly.add(M.dark, box(0.6, 0.66, 0.08, 0.03), [x, y0 + p.h * 0.55, p.z - p.l / 2 - 0.02]); Ly.add(M.glow, box(0.44, 0.5, 0.06, 0.02), [x, y0 + p.h * 0.55, p.z - p.l / 2 - 0.06]); }
      for (const sx of [1, -1]) Ly.add(M.oak, cyl(0.06, 0.06, p.l, 5), [sx * p.w / 2, y0 + p.h + 0.6, p.z], [Math.PI / 2, 0, 0]);
      for (const sx of [1, -1]) for (let i = 0; i <= 3; i++) Ly.add(M.oak, cyl(0.05, 0.05, 0.55, 5), [sx * p.w / 2, y0 + p.h + 0.35, p.z - p.l / 2 + i * p.l / 3]);
    }
    if (T.fenders && !LO) for (const sx of [1, -1]) for (const t of [0.12, 0.24, ...A.midT.filter((_, i) => i % 2 === 0), 0.76, 0.86]) Ly.add(M.oak, tube(sideCurve(A, t, sx, 0.05, 1.6 * k, 0.1), 10, 0.13 * k, 6));
    if (T.gold) for (const sx of [1, -1]) Ly.add(M.gold, tube(lineCurve(A, sx, 0.45 * k, 0.12, 0.08, 0.9), 40, 0.08, 5));
    if (T.patches) for (const sx of [1, -1]) for (const [t, d] of [[0.16, 0.9], [0.34, 1.35], [0.58, 1.0], [0.8, 1.3]]) { // [more levels] fresh repair planks + nails on the sides
      Ly.add(M.deck, box(0.1, 0.42 * k, 1.5, 0.03), [sx * (A.sideX(t, d * k) + 0.07), A.shape.top(t) - d * k, A.zAt(t)], [0, A.sideYaw(t, sx), sx * 0.08]);
      if (!LO) for (const dz of [-0.6, 0.6]) Ly.add(M.rivet, RIVET, [sx * (A.sideX(t, d * k) + 0.13), A.shape.top(t) - d * k, A.zAt(t) + dz]);
    }
    if (T.quarter) { // quarter galleries: glowing window boxes on the stern corners, widen the stern seen from behind
      const c = A.L.cab, n = T.quarter;
      for (const sx of [1, -1]) for (let q = 0; q < n; q++) {
        const gw = 0.95, gh = c.h * (q ? 0.5 : 0.72), gl = c.l * (q ? 0.32 : 0.46), y = c.y0 + 0.35 + (q ? c.h * 0.78 : gh / 2 - 0.05), x = sx * (c.w / 2 + gw / 2 - 0.05 - q * 0.25), z = c.z - c.l * 0.22;
        Ly.add(M.plank, box(gw, gh, gl, 0.12), [x, y, z]);
        Ly.add(T.gold ? M.gold : M.oak, box(gw + 0.2, 0.16, gl + 0.2, 0.05), [x, y + gh / 2 + 0.06, z]);
        Ly.add(M.oak, box(gw * 0.7, 0.3, gl * 0.8, 0.08), [x, y - gh / 2 - 0.12, z]);
        for (const dz of [-gl * 0.25, gl * 0.25]) Ly.add(M.glow, box(0.06, gh * 0.45, gl * 0.3, 0.02), [x + sx * (gw / 2 + 0.02), y + 0.05, z + dz]);
        Ly.add(M.glow, box(gw * 0.6, gh * 0.4, 0.06, 0.02), [x, y + 0.05, z - gl / 2 - 0.03]);
      }
    }
  },
  // ARMOR: dark iron plates over the hull sides with gold rivets, plated railings, iron belt, bow ram, gold trim
  armor(A, T, Ly) {
    if (!T.plates) return;
    const { k } = A, segs = Math.max(7, Math.round(A.len / 2.1));
    const toWater = (t) => Math.max(1.0, A.shape.top(t) - 0.35); // plate from the gunwale down past the waterline
    const t0s = 0.015, t1s = 0.965;
    for (const sx of [1, -1]) {
      for (let i = 0; i < segs; i++) { // full-height iron armour plates, gold rivets top and middle
        const a = t0s + i / segs * (t1s - t0s) + 0.003, b = t0s + (i + 1) / segs * (t1s - t0s) - 0.003;
        Ly.add(M.iron, hullPanel(A, a, b, 0.03, toWater, sx, 0.08, 5, 5));
        for (const d of (LO ? [0.14] : [0.14, 0.75 * k])) for (const f of (LO ? [0.5] : [0.18, 0.5, 0.82])) { const t = a + (b - a) * f; Ly.add(M.rivet, RIVET, [sx * (A.sideX(t, d) + 0.13), A.shape.top(t) - d, A.zAt(t)]); }
      }
      // iron gun-port frames over the plates at every deck gun slot
      for (const t of A.gunT) Ly.add(M.dark, box(0.16, 0.7 * k, 0.86, 0.04), [sx * (A.sideX(t, 0.5 * k) + 0.13), A.shape.top(t) - 0.5 * k, A.zAt(t)], [0, A.sideYaw(t, sx), 0]);
      if (T.rail) { // plated bulwarks + iron-clad stern castle
        for (let i = 0; i < segs; i++) {
          const t = 0.2 + (i + 0.5) / segs * 0.68, w = A.shape.halfW(t) * 0.93, y = A.shape.top(t), yaw = A.sideYaw(t, sx);
          Ly.add(M.iron, box(0.14, 0.56, 0.68 / segs * A.len - 0.1, 0.04), [sx * w, y + 0.32, A.zAt(t)], [0, yaw, 0]);
          if (!LO) for (const dz of [-0.3, 0.3]) Ly.add(M.rivet, RIVET, [sx * (w + 0.08), y + 0.48, A.zAt(t) + dz]);
        }
        const c = A.L.cab;
        Ly.add(M.iron, box(0.1, c.h * 0.42, c.l * 0.96, 0.03), [sx * (c.w / 2 + 0.06), c.y0 + c.h * 0.2, c.z]);
        Ly.add(M.iron, box(0.1, c.h * 0.2, c.l * 0.96, 0.03), [sx * (c.w / 2 + 0.06), c.y0 + c.h * 0.88, c.z]);
      }
      if (T.gold) { // legendary trim: gold edging along the top of the armour and a gold band at the waterline
        Ly.add(M.gold, tube(lineCurve(A, sx, 0.05, 0.14, t0s, t1s), 48, 0.1, 6));
        Ly.add(M.gold, tube(lineCurve(A, sx, 1.05 * k, 0.14, 0.05, 0.93), 48, 0.09, 6));
      }
    }
    { // iron plates across the stern transom (what the chase camera sees first) + riveted stern corners
      const z = A.zAt(0) - 0.08, top0 = A.shape.top(0.01), bottom = Math.max(0.15, top0 - 0.45);
      for (let d = 0.12; d < top0 - 0.35; d += 0.5) {
        const w = A.sideX(0.01, d + 0.2) * 2 * 0.98;
        Ly.add(M.iron, box(w, 0.42, 0.1, 0.03), [0, top0 - d - 0.2, z]);
        if (!LO) for (const f of [-0.42, -0.14, 0.14, 0.42]) Ly.add(M.rivet, RIVET, [w * f, top0 - d - 0.06, z - 0.07]);
      }
      if (T.gold) Ly.add(M.gold, cyl(0.09, 0.09, A.sideX(0.01, 0.1) * 2, 6), [0, top0 - 0.08, z - 0.06], [0, 0, Math.PI / 2]);
    }
    if (T.rail) { const c = A.L.cab; Ly.add(M.iron, box(c.w * 0.98, c.h * 0.22, 0.1, 0.03), [0, c.y0 + c.h * 0.12, c.z - c.l / 2 - 0.06]); }
    if (T.bands) for (const sx of [1, -1]) for (const t of (T.bands > 1 ? [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] : [0.1, 0.3, 0.5, 0.7, 0.9])) Ly.add(M.dark, tube(sideCurve(A, t, sx, 0.02, 1.25 * A.k, 0.14), 8, 0.1, 5)); // [more levels] iron hoops over the plates
    if (T.ram) { // iron bow ram + armoured prow
      const zb = A.zAt(1), yb = A.shape.top(1) - 1.25 * k;
      Ly.add(M.iron, new THREE.ConeGeometry(0.65 * k, 2.6 * k, 8), [0, yb, zb + 1.1 * k], [Math.PI / 2, 0, 0]);
      Ly.add(M.gold, torus(0.62 * k, 0.11), [0, yb, zb - 0.1]);
      for (const sx of [1, -1]) Ly.add(M.iron, hullPanel(A, 0.9, 0.995, 0.15, 1.5 * k, sx, 0.16, 4, 3));
    }
  },
  // SAILS: bigger sails, topgallants, royals, a big skull spanker sheeted out so it shows, a 4th mast at max
  sails(A, T, Ly, ship) {
    const ud = ship.userData, ref = ud.sails[1] || ud.sails[0], mainRef = ud.sails[0];
    const sf = ref.children[0].material, sb = ref.children[1].material, mf = mainRef.children[0].material, mb = mainRef.children[1].material;
    const yard = (yw, p) => Ly.add(T.gold ? M.gold : M.oak, lathe([[0.03, -yw / 2], [0.1, 0], [0.03, yw / 2]], 6), p, [0, 0, Math.PI / 2]);
    if (T.w > 1) A.masts.forEach((m, mi) => { // broader yards so the wider sails hang from wood, not air
      for (const [yf, wf] of [[0.74, 1.5], [0.98, 1.08]]) { const yw = A.beam * wf * A.L.mastDefs[mi][1] * T.w; yard(yw, [0, m.y + m.h * yf, m.z + 0.22]); }
    });
    if (T.top) A.masts.slice(0, 2).forEach((m, mi) => {
      const ext = m.h * T.top, top = m.y + m.h;
      Ly.add(M.oak, cyl(0.1, 0.16, ext + 0.4, 8), [0, top + ext / 2 - 0.1, m.z]);
      Ly.add(M.gold, torus(0.17, 0.05), [0, top, m.z], [Math.PI / 2, 0, 0]);
      const yw = A.beam * 1.05 * T.w * (mi ? 0.8 : 1), yy = top + ext * 0.5;
      yard(yw, [0, yy, m.z + 0.2]);
      const g = sailPair(sailGeo(yw * 0.92, ext * 0.45, 0.6), sf, sb); g.position.set(0, yy - 0.1, m.z + 0.3); Ly.group.add(g);
      if (T.royal) { const rw = yw * 0.7, ry = top + ext * 0.92; yard(rw, [0, ry, m.z + 0.2]); const r = sailPair(sailGeo(rw * 0.92, ext * 0.36, 0.45), sf, sb); r.position.set(0, ry - 0.1, m.z + 0.3); Ly.group.add(r); }
    });
    if (T.spanker) { // fore-and-aft skull sail on the mizzen, swung out to port so the chase camera sees it
      const m = A.masts[2], th = 0.6, h = m.h * 0.5, w = A.len * 0.3, y0 = m.y + m.h * 0.86;
      const dir = new THREE.Vector3(-Math.sin(-th), 0, -Math.cos(-th)); // aft, swung to +X (port)
      const at = (d, y) => [dir.x * d, y, m.z + dir.z * d];
      Ly.span(M.oak, at(0, y0), at(w, y0 + 0.9), 0.09, 0.07);
      Ly.span(M.oak, at(0, y0 - h), at(w * 1.05, y0 - h), 0.09, 0.08);
      const geo = sailGeo(w, h, 0.5); geo.translate(w / 2, 0, 0);
      const g = sailPair(geo, mf, mb, false); g.children.forEach(c => c.rotation.y = Math.PI / 2 - th); g.position.set(0, y0 - 0.05, m.z); Ly.group.add(g);
    }
    if (T.fourthMast) { // extra mast amidships with its own skull course and topsail
      const t = 0.445, z = A.zAt(t), y = A.deckAt(t), mh = A.len * 0.98 * 0.86;
      Ly.add(M.oak, cyl(0.16, 0.28, mh, 10), [0, y + mh / 2, z]);
      for (const f of [0.08, 0.4, 0.66, 1.0]) Ly.add(M.gold, torus(0.27 - f * 0.1, 0.06), [0, y + mh * f, z], [Math.PI / 2, 0, 0]);
      [[0.72, 1.3, 0.36, mf, mb], [0.96, 0.95, 0.22, sf, sb]].forEach(([yf, wf, hf, f, b]) => {
        const yw = A.beam * wf * 0.86, yy = y + mh * yf; yard(yw, [0, yy, z + 0.22]);
        const g = sailPair(sailGeo(yw * 0.92, mh * hf, 1.0), f, b); g.position.set(0, yy - 0.12, z + 0.34); Ly.group.add(g);
      });
    }
    if (T.gold) A.masts.forEach(m => { const top = m.y + m.h * (1 + (T.top || 0)); Ly.add(M.gleam, sph(0.22), [0, top + 0.3, m.z]); });
  },
  // RUDDER / STERN: oak rudder with iron pintles → bigger + ship's wheel → stern gallery, gold wheel, big stern lanterns
  rudder(A, T, Ly) {
    if (!T.rudder) return;
    const { k } = A, zs = A.zAt(0) - 0.22, keel = A.shape.keel(0.02), s = T.rudder;
    const bh = (1.6 * k - keel) * s, bw = 0.9 * s * k, yc = keel + bh / 2 - 0.3;
    Ly.add(M.oak, box(0.24, bh, bw, 0.06), [0, yc, zs - bw / 2 + 0.2]);
    Ly.add(M.oak, cyl(0.15, 0.15, bh + 1.3, 8), [0, yc + 0.65, zs + 0.12]);
    for (const f of [0.2, 0.45, 0.7, 0.92]) Ly.add(M.iron, box(0.32, 0.14, bw * 0.8, 0.03), [0, keel + bh * f - 0.3, zs - bw * 0.35]);
    Ly.add(T.gold ? M.gold : M.iron, sph(0.2), [0, yc + bh / 2 + 1.3, zs + 0.12]);
    if (T.straps) for (const f of [0.3, 0.6, 0.85]) Ly.add(T.gold ? M.gold : M.dark, box(0.4, 0.18, bw * 1.02, 0.04), [0, keel + bh * f - 0.3, zs - bw / 2 + 0.2]); // [more levels] heavy pintle straps
    if (T.sternLamps) { // big brass stern lanterns on iron brackets at the transom corners
      const c = A.L.cab, z = c.z - c.l / 2 - 0.55, y = c.y0 + 0.25, s = T.gold ? 1.3 : 1.1;
      for (const sx of [1, -1]) {
        const x = sx * c.w * 0.44;
        Ly.span(M.iron, [x, y + 0.9, z + 0.5], [x, y + 0.9, z - 0.05], 0.05);
        Ly.add(M.gold, cyl(0.2 * s, 0.3 * s, 0.18 * s, 8), [x, y + 0.75, z]);
        Ly.add(M.glow, sph(0.3 * s), [x, y + 0.4, z], [0, 0, 0], [1, 1.25, 1]);
        Ly.add(M.gold, cyl(0.26 * s, 0.18 * s, 0.12 * s, 8), [x, y + 0.02, z]);
      }
    }
    if (T.wheel) { // helm at the front of the stern-castle roof
      const c = A.L.cab, y = A.roofY, z = c.z + c.l / 2 - 0.75, r = 0.8 * k, rim = T.gold ? M.gold : M.oak;
      Ly.add(M.oak, box(0.34, 1.1, 0.34, 0.06), [0, y + 0.55, z - 0.25]);
      const wy = y + 1.3;
      Ly.add(rim, torus(r, 0.09), [0, wy, z]);
      for (let i = 0; i < (LO ? 4 : 8); i++) Ly.add(M.oak, cyl(0.045, 0.045, r * 2.5, 5), [0, wy, z], [0, 0, i / 8 * Math.PI * 2]);
      Ly.add(M.gold, cyl(0.16, 0.16, 0.24, 10), [0, wy, z], [Math.PI / 2, 0, 0]);
    }
    if (T.gallery) { // stern balcony under the stern windows, gold rail, two big glowing lanterns
      const c = A.L.cab, y = c.y0 + c.h * 0.22, z = c.z - c.l / 2 - 0.6, w = c.w * 0.95;
      Ly.add(M.plank, box(w, 0.22, 1.2, 0.05), [0, y, z]);
      Ly.add(T.gold ? M.gold : M.oak, cyl(0.08, 0.08, w, 6), [0, y + 0.85, z - 0.55], [0, 0, Math.PI / 2]);
      for (let i = 0; i <= (LO ? 3 : 6); i++) Ly.add(M.oak, cyl(0.05, 0.05, 0.8, 5), [-w / 2 + i * w / 6, y + 0.45, z - 0.55]);
      if (T.gold) for (const sx of [1, -1]) { Ly.add(M.gold, cyl(0.24, 0.32, 0.18, 8), [sx * w / 2, y + 1.45, z - 0.5]); Ly.add(M.gleam, sph(0.32), [sx * w / 2, y + 1.15, z - 0.5]); Ly.add(M.gold, cyl(0.28, 0.2, 0.12, 8), [sx * w / 2, y + 0.82, z - 0.5]); }
    }
  },
  // WEAPONS: big guns over every deck slot, lower-deck guns in every port, rail swivels, bow chaser, stern guns, mortar
  cannons(A, T, Ly) {
    const { k } = A, barrel = lathe(CANNON, seg(8, 6));
    let order = 0;
    if (T.big) for (const t of A.gunT) for (const sx of [1, -1]) { // chunkier guns over the deck slots
      const w = A.shape.halfW(t), y = A.deckAt(t), z = A.zAt(t), cx = sx * (w - 0.45), s = T.big * k;
      Ly.add(M.iron, barrel, [cx - sx * 0.5, y + 0.6, z], [0, 0, -sx * Math.PI / 2], [s, s * 1.05, s]);
      if (!LO || T.gold) Ly.add(T.gold ? M.gold : M.iron, torus(0.3 * s, 0.06 * s), [cx + sx * 0.45 * s, y + 0.6, z], [0, Math.PI / 2, 0]);
    }
    if (T.lowerDeck) for (const t of A.gunT) for (const sx of [1, -1]) { // second gun deck: a barrel in every hull port
      const d = 0.5 * k, x = A.sideX(t, d), y = A.shape.top(t) - d, z = A.zAt(t);
      Ly.add(M.iron, barrel, [sx * (x - 0.15), y, z], [0, 0, -sx * Math.PI / 2], [0.95 * k, 1.15 * k, 0.95 * k]); // pokes ~1 m out of the hull
      if (T.gold) Ly.add(M.gold, torus(0.29 * k, 0.05), [sx * (x + 0.45 * k), y, z], [0, Math.PI / 2, 0]);
      muzzle(Ly, sx > 0 ? 'port' : 'star', [sx * (x + 1.5), y, z], 100 + order++);
    }
    if (T.swivels) for (const t of A.midT) for (const sx of [1, -1]) { // swivel guns on the rail between the deck guns
      const w = A.shape.halfW(t) * 0.92, y = A.shape.top(t) + 0.7, z = A.zAt(t);
      Ly.add(M.oak, cyl(0.1, 0.13, 0.8, 8), [sx * w, y - 0.34, z]);
      Ly.add(M.iron, box(0.2, 0.34, 0.5, 0.04), [sx * w, y + 0.1, z]);
      Ly.add(M.iron, barrel, [sx * (w + 0.05), y + 0.26, z], [0, 0, -sx * Math.PI / 2], [0.85, 1.05, 0.85]);
      muzzle(Ly, sx > 0 ? 'port' : 'star', [sx * (w + 1.2), y + 0.26, z], 200 + order++);
    }
    if (T.bowChaser) { // forward-firing gun at the bow (on the forecastle when the hull has one)
      const t = 0.93, y = (A.hull.forecastle ? A.foreY(t) : A.deckAt(t) + 0.3) + 0.35, z = A.zAt(t), s = 1.15 * k;
      Ly.add(M.oak, box(0.9, 0.4, 1.0, 0.08), [0, y - 0.2, z]);
      Ly.add(M.iron, barrel, [0, y + 0.25, z - 0.2], [Math.PI / 2, 0, 0], [s, s * 1.2, s]);
      Ly.add(M.gold, torus(0.33 * s, 0.06), [0, y + 0.25, z + 1.15 * s]);
    }
    if (T.sternGuns) { // two stern chasers out of the transom under the cabin
      const c = A.L.cab, y = c.y0 - 0.15, z = A.zAt(0);
      for (const sx of [1, -1]) {
        Ly.add(M.dark, box(0.8 * k, 0.7 * k, 0.12, 0.04), [sx * c.w * 0.25, y, z - 0.06]);
        Ly.add(M.iron, barrel, [sx * c.w * 0.25, y, z + 0.25], [-Math.PI / 2, 0, 0], [1.1 * k, 1.1 * k, 1.1 * k]);
      }
    }
    if (T.mortar) { // big squat mortar amidships, aimed high
      const t = 0.68, z = A.zAt(t), y = A.deckAt(t), s = 1.15 * k;
      Ly.add(M.oak, box(1.9 * s, 0.35, 1.9 * s, 0.08), [0, y + 0.18, z]);
      Ly.add(M.iron, lathe(MORTAR, seg(12, 8)), [0, y + 0.32, z], [0.35, 0, 0], s);
      Ly.add(M.gold, torus(0.72 * s, 0.08), [0, y + 0.32 + 1.05 * s * Math.cos(0.35), z + 1.05 * s * Math.sin(0.35)], [Math.PI / 2 - 0.35, 0, 0]);
      Ly.add(M.dark, new THREE.CircleGeometry(0.5 * s, 14), [0, y + 0.33 + 1.12 * s * Math.cos(0.35), z + 1.12 * s * Math.sin(0.35)], [-Math.PI / 2 + 0.35, 0, 0]);
    }
  },
  // GUN CREW: shot racks → glowing lit gun ports + smouldering linstocks → powder magazine (+ gold at max)
  reload(A, T, Ly, ship, lv) {
    if (!T.racks) return;
    const { k } = A, ball = new THREE.IcosahedronGeometry(0.2, LO ? 0 : 1), keg = lathe(KEG, seg(8, 6));
    A.gunT.forEach((t, i) => {
      const z = A.zAt(t), y = A.deckAt(t);
      for (const sx of [1, -1]) {
        const w = A.shape.halfW(t), cx = sx * (w - 1.55);
        if (i % 2 === 0) {
          Ly.add(T.gold ? M.gold : M.oak, box(0.6, 0.12, 0.6, 0.03), [cx, y + 0.06, z - 0.62]);
          if (!LO) [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(([dx, dz]) => Ly.add(M.ball, ball, [cx + dx, y + 0.32, z - 0.62 + dz]));
          Ly.add(M.ball, ball, [cx, y + 0.6, z - 0.62]);
        }
        if (T.litPorts) {
          const d = 0.5 * k;
          Ly.add(M.glow, box(0.06, 0.52 * k, 0.66, 0.03), [sx * (A.sideX(t, d) + 0.21), A.shape.top(t) - d, z], [0, A.sideYaw(t, sx), 0]);
        }
        if (T.linstocks && !LO && i % 2 === 1) { Ly.add(M.dark, cyl(0.035, 0.035, 1.2, 4), [cx, y + 0.6, z + 0.6], [0.2, 0, 0]); Ly.add(M.fuse, sph(0.11), [cx, y + 1.2, z + 0.72]); }
      }
    });
    if (T.magazine) { // ring of red-banded powder kegs amidships (around the 4th mast if it's there)
      const z = A.zAt(0.445), y = A.deckAt(0.445);
      for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
        Ly.add(M.keg, keg, [dx, y, z + dz], [0, 0, 0], 1.1);
        for (const b of [0.18, 0.56]) Ly.add(T.gold ? M.gold : M.red, torus(0.39, 0.04), [dx, y + b * 1.1, z + dz], [Math.PI / 2, 0, 0]);
      }
      Ly.add(M.fuse, sph(0.16), [0.8, y + 0.95, z - 0.8]);
    }
    if (T.lockers) for (const sx of [1, -1]) { // [more levels] shot lockers by the stern castle, lids open, stacked balls
      const t = 0.24, z = A.zAt(t), y = A.deckAt(t), x = sx * (A.shape.halfW(t) - 1.3);
      Ly.add(T.gold ? M.gold : M.oak, box(0.9, 0.5, 1.2, 0.05), [x, y + 0.25, z]);
      Ly.add(M.iron, box(0.95, 0.08, 1.25, 0.02), [x, y + 0.52, z]);
      for (const dz of [-0.3, 0, 0.3]) Ly.add(M.ball, ball, [x, y + 0.72, z + dz]);
    }
  },
  // SPY TOWER: lookout spyglass → fore crow's nest + jib-boom glass → tall watchtower at the main masthead with a beacon
  range(A, T, Ly) {
    if (!T.lookout) return;
    const glass = lathe(SPYGLASS, seg(8, 5));
    const scope = (p, rx, s = 1) => {
      Ly.add(M.gold, glass, p, [rx, 0, 0], s);
      if (!LO) Ly.add(M.lens, sph(0.075 * s), [p[0], p[1] + Math.cos(rx) * 1.56 * s, p[2] + Math.sin(rx) * 1.56 * s]);
    };
    const nest = (x, y, z, r, h, gold) => {
      Ly.add(M.plank, cyl(r, r * 0.78, h, 14), [x, y, z]);
      Ly.add(gold ? M.gold : M.oak, torus(r * 1.01, 0.09), [x, y + h / 2, z], [Math.PI / 2, 0, 0]);
      const np = LO ? 4 : 8; for (let i = 0; i < np; i++) { const a = i / np * Math.PI * 2; Ly.add(M.oak, cyl(0.05, 0.05, 0.6, 4), [x + Math.cos(a) * r, y + h / 2 + 0.3, z + Math.sin(a) * r]); }
      Ly.add(gold ? M.gold : M.oak, torus(r, 0.06), [x, y + h / 2 + 0.6, z], [Math.PI / 2, 0, 0]);
    };
    const m0 = A.masts[0], ny = m0.y + m0.h * 0.84;
    nest(0, ny + 0.1, m0.z, 1.05, 0.5, T.gold); // lookout rail around the main top
    scope([0.1, ny + 0.75, m0.z + 0.6], Math.PI / 2 - 0.12, 1.1);
    if (T.crowsNest) {
      const f = A.masts[1], fy = f.y + f.h * 0.8;
      nest(0, fy, f.z, 0.95, 1.1, T.gold);
      scope([0, fy + 0.95, f.z + 0.5], Math.PI / 2 - 0.12, 0.9);
      Ly.add(M.glow, sph(0.2), [0.7, fy + 1.2, f.z]);
      // jib-boom out along the bowsprit with a brass glass at its tip
      const a = 0.35, dir = new THREE.Vector3(0, Math.sin(a), Math.cos(a)), bsL = A.L.bsL;
      const c = new THREE.Vector3(0, A.L.bowY + 0.5 + Math.sin(a) * bsL * 0.4, A.zAt(1) + bsL * 0.32);
      const tip = c.clone().addScaledVector(dir, bsL / 2), end = tip.clone().addScaledVector(dir, bsL * 0.45);
      Ly.span(M.oak, tip.clone().addScaledVector(dir, -0.4).toArray(), end.toArray(), 0.1, 0.06);
      scope([0, end.y + 0.15, end.z - 0.6], Math.PI / 2 - a, 0.7);
    }
    if (T.railScopes) for (const sx of [1, -1]) { // [more levels] brass glasses on swivel posts at the bow rail
      const t = 0.8, y = A.shape.top(t), x = sx * A.shape.halfW(t) * 0.8, z = A.zAt(t);
      Ly.add(M.oak, cyl(0.07, 0.09, 0.9, 5), [x, y + 0.45, z]);
      scope([x, y + 0.9, z - 0.4], Math.PI / 2 - 0.08, 0.8);
    }
    if (T.lamps) { const f = A.masts[1]; for (const sx of [1, -1]) { Ly.add(M.gold, cyl(0.16, 0.22, 0.14, 8), [sx * 0.75, m0.y + m0.h * 0.84 + 0.9, m0.z]); Ly.add(M.glow, sph(0.22), [sx * 0.75, m0.y + m0.h * 0.84 + 0.65, m0.z]); Ly.add(M.glow, sph(0.2), [sx * 0.7, f.y + f.h * 0.8 + 1.2, f.z]); } } // [more levels] signal lamps on both tops
    if (T.watchtower) { // tall lattice tower on top of the main mast (above any topmasts) with a glowing beacon
      const y0 = A.mainTop + 0.4, z = m0.z, r = 0.75, hgt = WATCH_H;
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; Ly.span(M.oak, [Math.cos(a) * 0.25, y0, z + Math.sin(a) * 0.25], [Math.cos(a) * r, y0 + hgt, z + Math.sin(a) * r], 0.06); }
      nest(0, y0 + hgt, z, r + 0.15, 0.55, true);
      Ly.add(M.gold, cyl(0.25, 0.35, 0.25, 10), [0, y0 + hgt + 0.95, z]);
      Ly.add(M.gleam, sph(0.42), [0, y0 + hgt + 1.35, z]);
      Ly.add(M.gold, new THREE.ConeGeometry(0.4, 0.5, 10), [0, y0 + hgt + 1.95, z]);
      scope([0, y0 + hgt + 0.7, z + 0.6], Math.PI / 2 - 0.1, 1.2);
    }
  },
};

// ---------- compiler ----------
const _parts = new Map(); // trait part templates, keyed by everything that shapes them
function partKey(id, lv, skin) { return `${id}:${lv[id] || 0}|h${lv.hull}s${lv.sails}c${lv.cannons}|${skin.id}|${LO ? 'L' : 'H'}`; }
function partSet(id, A, lv, ship, skin) {
  const key = partKey(id, lv, skin);
  let tpl = _parts.get(key);
  if (!tpl) { const Ly = new Layer(id); PARTS[id](A, TRAITS[id][lv[id] || 0], Ly, ship, lv); tpl = Ly.build(); _parts.set(key, tpl); }
  return tpl;
}
const normLevels = (levels = {}) => Object.fromEntries(TRAIT_IDS.map(id => [id, Math.max(0, Math.min(TRAITS[id].length - 1, levels[id] || 0))]));
const shipKey = (lv, skin, q, shadows, pvp) => `${TRAIT_IDS.map(id => lv[id]).join('')}|${skin.id}|${q}|${shadows ? 1 : 0}${pvp ? '|pvp' : ''}`; // [pvp skins] PvP builds add skin parts
let BASE_RIG = 0, lastOpts = {};

function buildCompiled(lv, opts, skin) {
  LO = opts.quality === 'low';
  mats(skin);
  const H = TRAITS.hull[lv.hull], W = TRAITS.cannons[lv.cannons], S = TRAITS.sails[lv.sails];
  const { quality, skin: _s, pvp: _pvp, ...bopts } = opts;
  const ship = buildShip({ len: H.len, beam: H.beam, depth: H.depth, scheme: 'player', cannonsPerSide: W.perSide, masts: 3, ...bopts, ...(skinBuildOpts(skin) || {}) });
  const ud = ship.userData, A = anchors(ud, lv);
  ud.sails.forEach(s => s.children.forEach(c => c.scale.set(S.w, S.h, 1)));
  if (S.top) ud.layout.flagPole.position.y += A.masts[0].h * S.top;
  if (TRAITS.range[lv.range].watchtower) ud.layout.flagPole.position.y = A.mainTop + 0.4 + WATCH_H + 2.3;
  // merge every trait's parts into one mesh per material (+ outlines), add the animated / functional extras
  const buckets = new Map(), extraMuzzles = [];
  ud.traitBoxes = {};
  for (const id of TRAIT_IDS) {
    const tpl = partSet(id, A, lv, ship, skin);
    ud.traitBoxes[id] = tpl.box;
    for (const p of [...tpl.parts, ...tpl.outlines]) { if (!buckets.has(p.mat)) buckets.set(p.mat, []); buckets.get(p.mat).push(p.geo); }
    for (const x of tpl.extras.children) {
      const c = x.clone(); c.traverse(o => { if (o.geometry) o.userData.sharedGeo = true; });
      ud.body.add(c);
      c.traverse(o => { if (o.userData.upgSail) ud.sails.push(o); if (o.userData.upgMuzzle) extraMuzzles.push(o); });
    }
  }
  const traits = new THREE.Group(); traits.name = 'upg-traits';
  for (const [mat, list] of buckets) {
    const geo = list.length === 1 ? list[0].clone() : mergeGeometries(list, false);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, mat);
    if (mat.side === THREE.BackSide && mat.isMeshBasicMaterial) { mesh.userData.outline = true; mesh.renderOrder = 0; }
    else mesh.castShadow = mesh.receiveShadow = !!opts.shadows && !mat.isMeshBasicMaterial;
    traits.add(mesh);
  }
  ud.body.add(traits); ud.traitsMesh = traits;
  extraMuzzles.sort((a, b) => a.userData.order - b.userData.order).forEach(m => ud.muzzles[m.userData.upgMuzzle].push(m));
  // skin material effects (ghost glow / golden gleam) on everything, never on the water lid
  const fx = skinMaterialFx(skin);
  if (fx) ship.traverse(o => { if ((o.isMesh || o.isLineSegments) && !o.userData.waterMask) o.material = fx(o.material); });
  ship.userData.skinId = skin?.id || 'classic'; // per-ship skin hooks (e.g. diamondTick) key off this
  if (opts.pvp || skin?.wavesLooks) runPartsOverride(ship, skin, { quality: opts.quality, levels: lv }); // [pvp skins] PvP builds + the Waves skins that share an upgraded look (js/skinLooks.js); CLASSIC never changes
  // whole-ship scale from the overall upgrade count; hitbox / wake / camera read these
  const s = extraScale(lv);
  ship.scale.setScalar(s);
  ud.len *= s; ud.beam *= s; ud.depth *= s; ud.shipScale = (H.len * s) / TRAITS.hull[0].len;
  const rig = (ud.layout.flagPole.position.y + 2.5 + (ud.flag?.geometry?.parameters?.height || 4)) * s; // flag top
  if (!BASE_RIG && TRAIT_IDS.every(id => !lv[id])) BASE_RIG = rig;
  ud.rigTop = rig; ud.frameK = Math.max(1, rig / (BASE_RIG || rig)); // camera framing factor (fits the tallest mast)
  ud.levels = lv; ud.hullName = H.name; ud.skinId = skin.id; ud.key = shipKey(lv, skin, opts.quality, opts.shadows, opts.pvp);
  return ship;
}

// Build (or take a pre-built) player ship for `levels` ({ hull: 0..3, ... }). `opts` = buildShip extras
// (sail map, flag, light, shadows) + quality ('low' | 'high') + optional skin (defaults to the equipped skin).
export function compileShip(levels = {}, opts = {}) {
  lastOpts = opts;
  const lv = normLevels(levels), skin = opts.skin || equippedSkin();
  const key = shipKey(lv, skin, opts.quality, opts.shadows, opts.pvp);
  if (_ready.has(key)) { const ship = _ready.get(key); _ready.delete(key); return ship; }
  _queue = _queue.filter(q => q.key !== key);
  const t0 = performance.now(), ship = buildCompiled(lv, opts, skin);
  compileShip.lastBuildMs = performance.now() - t0;
  return ship;
}

// [Raul] skin previews: build a ship for an offscreen preview without touching the game's pre-build queue / options
export function compilePreview(levels = {}, opts = {}) { return buildCompiled(normLevels(levels), opts, opts.skin || equippedSkin()); }

// ---------- pre-build + shader warm-up (makes purchase swaps instant) ----------
let R = null; // { renderer, scene, camera, canWork }
const _ready = new Map(); let _queue = [], _pump = 0;
const MAX_READY = 8;
export function setRenderContext(ctx) { R = ctx; warmUp(); }
function warm(obj) { if (!R?.renderer) return; try { R.renderer.compile(obj, R.camera, R.scene); } catch { /* older three: skipped */ } }
// compile shader programs for every material the trait parts / purchase effect can use (once per skin + quality)
const _warmed = new Set();
export function warmUp(skin = equippedSkin()) {
  if (!R?.renderer) return;
  const q = lastOpts.quality === 'low';
  const key = skin.id + q; if (_warmed.has(key)) return; _warmed.add(key);
  LO = q; mats(skin);
  const g = new THREE.Group(), tiny = new THREE.BoxGeometry(0.01, 0.01, 0.01), fx = skinMaterialFx(skin);
  for (const k of Object.keys(M)) { const m = M[k]; if (m?.isMaterial) { const mesh = new THREE.Mesh(tiny, fx ? fx(m) : m); mesh.castShadow = true; g.add(mesh); } }
  g.add(outlineFor(new THREE.Mesh(tiny, M.oak), 0.05));
  g.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)), sparkMat()));
  g.add(new THREE.Mesh(tiny, flashMat()));
  g.position.set(0, -500, 0);
  warm(g);
}
// queue the ships one purchase away from `levels` (cheapest next tier first); built only while not in active play
export function prebuildNext(levels = {}, { gold = Infinity } = {}) {
  const lv = normLevels(levels), skin = lastOpts.skin || equippedSkin();
  const cands = UPGRADES.filter(u => lv[u.id] < u.tiers.length && TRAITS[u.id])
    .map(u => ({ id: u.id, cost: u.tiers[lv[u.id]].cost }))
    .sort((a, b) => (b.cost <= gold) - (a.cost <= gold) || a.cost - b.cost); // affordable first, then cheapest
  _queue = []; // older candidates are one purchase stale now
  const want = new Set();
  for (const c of cands) {
    const nl = { ...lv, [c.id]: lv[c.id] + 1 }, key = shipKey(nl, skin, lastOpts.quality, lastOpts.shadows, lastOpts.pvp);
    want.add(key);
    if (!_ready.has(key)) _queue.push({ key, lv: nl, skin, opts: lastOpts });
  }
  for (const [k, sh] of [..._ready]) if (!want.has(k)) { _ready.delete(k); disposeShip(sh); } // free stale pre-builds
  pump();
}
export function dropPrebuilt() { for (const s of _ready.values()) disposeShip(s); _ready.clear(); _queue = []; }
function pump() {
  if (_pump || !_queue.length) return;
  const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 60));
  _pump = idle(() => {
    _pump = 0;
    if (R?.canWork && !R.canWork()) { setTimeout(pump, 400); return; } // never during active sailing
    const job = _queue.shift();
    if (job && !_ready.has(job.key)) {
      const ship = buildCompiled(job.lv, job.opts, job.skin);
      warm(ship);
      _ready.set(job.key, ship);
      while (_ready.size > MAX_READY) { const [k, s] = _ready.entries().next().value; _ready.delete(k); disposeShip(s); }
    }
    pump();
  }, { timeout: 300 });
}
// ---------- purchase moment: pop, gold sparkle + flash, floating label (all < 1 s, never blocks input) ----------
let _spark = null, _sparkMat = null, _flashMat = null;
function sparkTex() {
  if (_spark) return _spark;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,205,119,0.95)'); r.addColorStop(1, 'rgba(255,205,119,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,240,200,0.9)'; g.fillRect(30, 4, 4, 56); g.fillRect(4, 30, 56, 4);
  _spark = new THREE.CanvasTexture(c); return _spark;
}
function sparkMat() { return _sparkMat || (_sparkMat = new THREE.PointsMaterial({ map: sparkTex(), size: 1.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); }
function flashMat() { return _flashMat || (_flashMat = new THREE.MeshBasicMaterial({ color: 0xffcd77, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending })); }
const anims = new Set(); let raf = 0;
function tick() {
  const now = performance.now();
  for (const a of anims) if (a(now) === false) anims.delete(a);
  raf = anims.size ? requestAnimationFrame(tick) : 0;
}
function run(fn) { anims.add(fn); if (!raf) raf = requestAnimationFrame(tick); }
const easePop = (u) => (u < 0.45 ? 0.35 + (1.22 - 0.35) * (u / 0.45) : 1.22 - 0.22 * Math.sin(((u - 0.45) / 0.55) * Math.PI / 2));
// lowest on-screen point of the HUD (score bar / captain card / icon row) so labels never cover it
function hudBottom() {
  let b = 0;
  for (const id of ['hud-top', 'hud-tl', 'hud-tr']) { const el = document.getElementById(id); if (el && el.offsetParent !== null) { const r = el.getBoundingClientRect(); if (r.height && r.top < innerHeight * 0.4) b = Math.max(b, Math.min(r.bottom, id === 'hud-tr' ? r.top + 52 : r.bottom)); } }
  return b;
}

// dev/capture hook: celebrateUpgrade.timeScale = 6 slows the effect down for screenshots (default 1)
let _cut = null; // cleanup for the effect still running (rapid buys: the newest one wins, nothing stacks)
export function celebrateUpgrade(ship, id, { camera = null, label = '', legendary = false } = {}) {
  if (!ship?.parent) return;
  _cut?.();
  const ud = ship.userData, scene = ship.parent, t0 = performance.now(), TS = celebrateUpgrade.timeScale || 1, DUR = 850 * TS;
  // where the new parts are (trait bounding box in body space → world); whole ship for hull / skins
  const lb = (id && ud.traitBoxes?.[id] && !ud.traitBoxes[id].isEmpty() && id !== 'hull') ? ud.traitBoxes[id] : new THREE.Box3().setFromObject(ud.body).applyMatrix4(ud.body.matrixWorld.clone().invert());
  const box3 = lb.clone().applyMatrix4(ud.body.matrixWorld);
  const cW = box3.getCenter(new THREE.Vector3()), size = box3.getSize(new THREE.Vector3());
  // 1) quick scale pop of the ship (parts are merged into one mesh per material, so the whole build bounces)
  const body = ud.body;
  run((now) => {
    const u = Math.min(1, (now - t0) / (520 * TS)), s = 1 + (easePop(u) - 1) * (id === 'hull' || id === 'skin' ? 1 : 0.35);
    body.scale.setScalar(s);
    if (u >= 1) { body.scale.setScalar(1); return false; }
  });
  // 2) gold sparkle burst + flash
  const N = LO ? 40 : 70, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = cW.x + (Math.random() - 0.5) * size.x; pos[i * 3 + 1] = cW.y + (Math.random() - 0.5) * size.y; pos[i * 3 + 2] = cW.z + (Math.random() - 0.5) * size.z;
    vel.push(new THREE.Vector3((Math.random() - 0.5) * 9, 4 + Math.random() * 9, (Math.random() - 0.5) * 9));
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = sparkMat().clone(); pm.size = 1.5 * (ud.shipScale || 1);
  pm.color.set(legendary ? 0xffe6a8 : 0xffcd77).multiplyScalar(1.5);
  const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; scene.add(pts);
  const fm = flashMat().clone();
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), fm); flash.position.copy(cW); scene.add(flash);
  const Rr = Math.max(size.x, size.y, size.z) * 0.55;
  let last = t0, dead = false;
  const cleanup = () => { if (dead) return; dead = true; scene.remove(pts, flash); pg.dispose(); pm.dispose(); flash.geometry.dispose(); fm.dispose(); body.scale.setScalar(1); };
  _cut = cleanup;
  run((now) => {
    if (dead) return false;
    const u = Math.min(1, (now - t0) / DUR), dt = Math.min(0.05, (now - last) / 1000) / TS; last = now;
    for (let i = 0; i < N; i++) { const v = vel[i]; v.y -= 14 * dt; pos[i * 3] += v.x * dt; pos[i * 3 + 1] += v.y * dt; pos[i * 3 + 2] += v.z * dt; }
    pg.attributes.position.needsUpdate = true;
    pm.opacity = 1 - u * u;
    flash.scale.setScalar(Rr * (0.3 + 0.7 * Math.min(1, u * 3))); fm.opacity = 0.2 * Math.max(0, 1 - u * 2.6);
    if (u >= 1) { cleanup(); if (_cut === cleanup) _cut = null; return false; }
  });
  // 3) floating "+UPGRADE" text anchored to the new parts, clamped below the HUD and inside the safe area
  if (label) {
    const el = document.createElement('div'); el.className = 'upg-float' + (legendary ? ' legendary' : ''); el.textContent = label.replace(' · LEGENDARY', '');
    if (legendary) { const sm = document.createElement('small'); sm.textContent = 'LEGENDARY'; el.appendChild(sm); }
    const top = new THREE.Vector3(cW.x, box3.max.y, cW.z);
    document.querySelectorAll('.upg-float').forEach(e => e.remove()); // rapid buys: newest label wins
    el.style.animationDuration = `${0.95 * TS}s`; document.body.appendChild(el);
    const W = innerWidth, Hh = innerHeight, hb = hudBottom(), lh = el.offsetHeight || 50, lw = el.offsetWidth || 200;
    let x = W / 2, y = Hh * 0.4;
    if (camera) { const v = top.clone().project(camera); x = (v.x * 0.5 + 0.5) * W; y = (-v.y * 0.5 + 0.5) * Hh; }
    // the label floats up ~1.4 of its height, so keep its whole path below the HUD and above the bottom controls
    x = Math.min(W - lw / 2 - 12, Math.max(lw / 2 + 12, x));
    y = Math.min(Hh * 0.62, Math.max(hb + lh * 2.2 + 12, y));
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    setTimeout(() => el.remove(), 1000 * TS);
  }
}
