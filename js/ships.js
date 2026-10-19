// Stylized toon ships built in code: rounded plank hulls with painted strakes, railings,
// chunky cannons, cabins with glowing windows, crow's nest, lanterns, rippling sails, waving flags.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, glowMat, outlineFor, woodTexture, clothTexture, metalTexture, goldTexture } from './toon.js';

// shared wind clock for the sail vertex ripple (main loop sets value)
export const wind = { uTime: { value: 0 } };

// ---------- flag textures ----------
export function makeSkullTexture(skullImg, { w = 512, h = 340, bg = '#0b0b0b', pad = 0.12, border = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.06; g.fillStyle = '#fff';
  for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 1);
  g.globalAlpha = 1;
  if (border) { g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); }
  // the REAL childlike skull logo (image file), never redrawn
  const s = Math.min(w, h) * (1 - pad * 2);
  const ar = skullImg.width / skullImg.height;
  const sw = ar >= 1 ? s : s * ar, sh = ar >= 1 ? s / ar : s;
  g.drawImage(skullImg, (w - sw) / 2, (h - sh) / 2, sw, sh);
  // frayed fly edge
  g.fillStyle = bg; for (let y = 0; y < h; y += 18) { g.beginPath(); g.moveTo(w, y); g.lineTo(w - 10 - (y % 36 ? 6 : 0), y + 9); g.lineTo(w, y + 18); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Parody "rug pill" flag: a cracked green/white capsule. Deliberately NOT the real pump.fun logo.
export function makePillTexture() {
  const w = 512, h = 340;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2a22'; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.07; g.fillStyle = '#fff';
  for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 1);
  g.globalAlpha = 1;
  g.save();
  g.translate(w / 2, h / 2); g.rotate(-Math.PI / 5.5);
  const L = 330, R = 62;
  const capsule = (x0, x1) => { g.beginPath(); g.moveTo(x0, -R); g.lineTo(x1, -R); g.arc(x1, 0, R, -Math.PI / 2, Math.PI / 2); g.lineTo(x0, R); g.arc(x0, 0, R, Math.PI / 2, -Math.PI / 2); g.closePath(); };
  g.save(); g.beginPath(); g.rect(-400, -200, 400 - 8, 400); g.clip();
  capsule(-L / 2 + R, L / 2 - R); g.fillStyle = '#f2f2f2'; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(-L / 2 + R, -R + 14, L - 2 * R, 12); g.restore();
  g.save(); g.translate(14, 6); g.rotate(0.12); g.beginPath(); g.rect(8, -200, 400, 400); g.clip();
  capsule(-L / 2 + R, L / 2 - R); g.fillStyle = '#4ee37a'; g.fill();
  g.fillStyle = 'rgba(200,255,215,0.7)'; g.fillRect(-L / 2 + R, -R + 14, L - 2 * R, 12); g.restore();
  g.lineWidth = 8; g.strokeStyle = '#0d0d0d';
  g.save(); g.beginPath(); g.rect(-400, -200, 400 - 8, 400); g.clip(); capsule(-L / 2 + R, L / 2 - R); g.stroke(); g.restore();
  g.save(); g.translate(14, 6); g.rotate(0.12); g.beginPath(); g.rect(8, -200, 400, 400); g.clip(); capsule(-L / 2 + R, L / 2 - R); g.stroke(); g.restore();
  g.beginPath(); g.moveTo(-4, -R - 4); [[6, -30], [-6, -8], [8, 14], [-4, 36], [6, R + 4]].forEach(([x, y]) => g.lineTo(x, y));
  g.lineWidth = 6; g.stroke();
  g.restore();
  g.fillStyle = '#1d2a22'; for (let y = 0; y < h; y += 18) { g.beginPath(); g.moveTo(w, y); g.lineTo(w - 14, y + 9); g.lineTo(w, y + 18); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- color schemes ----------
export const SCHEMES = {
  player: { seed: 11, wood: 0x6a4026, band: 0x161616, stripe: 0xffcd77, band2: 0xc4161c, tar: 0x231812, trim: 0xffcd77, sail: 0x1c1c1c, patch: [0x5e0e0e, 0x2a2a2a], hem: 0xb8964f, lantern: 0xffb04a, window: 0xffc46a },
  slime: { seed: 21, wood: 0x76502f, band: 0x2f9e4f, stripe: 0xf2f2f2, band2: 0x1f6b37, tar: 0x2a2018, trim: 0xd9c38a, sail: 0xe6e0cc, patch: [0xb9e8c4, 0xcfc7ae], hem: 0x5d7a4a, lantern: 0x9cffb5, window: 0x9cffb5 },
  grape: { seed: 31, wood: 0x6e4a33, band: 0x5b3591, stripe: 0x4ee37a, band2: 0x3b2266, tar: 0x221a22, trim: 0xc9b07a, sail: 0xd9e6cf, patch: [0xb79ad8, 0xbfd2b1], hem: 0x4b3a66, lantern: 0xc9a2ff, window: 0xc9a2ff },
  reef: { seed: 41, wood: 0x7a5636, band: 0x1d8686, stripe: 0xffe2a8, band2: 0x125a5a, tar: 0x1b2022, trim: 0xe0c27a, sail: 0xefe9da, patch: [0x9fd8cf, 0xd8cdb2], hem: 0x2d5a5a, lantern: 0x8ff7ff, window: 0x9cffb5, stripes: 0x4ee37a },
  boss: { seed: 51, wood: 0x4a3226, band: 0x15201a, stripe: 0x4ee37a, band2: 0x5b0f2a, tar: 0x140f0d, trim: 0x4ee37a, sail: 0x1f2b24, patch: [0x0f3a22, 0x3a1a26], hem: 0x4ee37a, lantern: 0x5cff8f, window: 0x7dffa8, stripes: 0x2d6b43 },
};
export const ENEMY_SCHEMES = ['slime', 'grape', 'reef'];

const _kits = new Map();
function kit(name, mainSailMap) {
  const k = name + (mainSailMap ? '+main' : '');
  if (_kits.has(k)) return _kits.get(k);
  const S = SCHEMES[name];
  const hullTex = woodTexture({ base: S.wood, rows: 10, seed: S.seed, bands: [
    { from: 0, to: 0.2, color: S.band, stripe: S.stripe, flat: true }, { from: 0.2, to: 0.3, color: S.band2, flat: true }, { from: 0.82, to: 1.01, color: S.tar },
  ] });
  const cabinTex = woodTexture({ base: S.wood, rows: 6, seed: S.seed + 1, bands: [{ from: 0, to: 0.17, color: S.band, flat: true }] });
  const deckTex = woodTexture({ base: 0x9a6b43, rows: 6, seed: 7, w: 512, h: 256 });
  const sailTex = clothTexture({ base: S.sail, seed: S.seed + 2, patchColors: S.patch, border: S.hem, stripes: S.stripes ? { color: S.stripes, n: 6 } : null });
  const ironTex = metalTexture({ base: name === 'boss' ? 0x1e2a24 : 0x2b2f36, highlight: name === 'boss' ? 0x6fe39a : 0x9aa6b8 });
  const goldTex = goldTexture({ base: S.trim });
  const kitObj = {
    S,
    hull: toon(0xffffff, hullTex, { side: THREE.DoubleSide }),
    cabin: toon(0xffffff, cabinTex),
    deck: toon(0xffffff, deckTex),
    mast: toon(0xffffff, woodTexture({ base: 0x7a5232, rows: 4, seed: 61, w: 256, h: 128, nails: false })),
    iron: toon(0xffffff, ironTex),
    gold: toon(0xffffff, goldTex),
    dark: toon(0x1a1410),
    rope: new THREE.LineBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.85 }),
    sail: sailMaterial(sailTex),
    sailBack: sailMaterial(mirror(sailTex), THREE.BackSide),
    main: mainSailMap ? sailMaterial(mainSailMap) : null,
    mainBack: mainSailMap ? sailMaterial(mirror(mainSailMap), THREE.BackSide) : null,
    lantern: glowMat(S.lantern, 2.6),
    window: glowMat(S.window, 1.9),
  };
  _kits.set(k, kitObj);
  return kitObj;
}
function mirror(t) { const m = t.clone(); m.wrapS = THREE.RepeatWrapping; m.repeat.x = -1; m.offset.x = 1; m.needsUpdate = true; return m; }
function sailMaterial(map, side = THREE.FrontSide) {
  const m = toon(0xffffff, map, { side });
  m.onBeforeCompile = (s) => {
    s.uniforms.uWindT = wind.uTime;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWindT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float cx = 1.0 - pow(uv.x * 2.0 - 1.0, 2.0); float hang = 1.0 - uv.y * 0.75;
          float ph = uWindT * 2.3 + modelMatrix[3].x * 0.05 + modelMatrix[3].z * 0.05;
          transformed.z += cx * hang * (sin(uv.y * 4.0 + ph + uv.x * 2.5) * 0.16 + sin(ph * 1.7 + uv.x * 7.0) * 0.05); }`);
  };
  m.customProgramCacheKey = () => 'sail';
  return m;
}

// ---------- geometry ----------
// Ship forward = local +Z, up = +Y, port (left) = +X, starboard (right) = -X. t=0 stern, t=1 bow.
function hullShape(len, beam, depth) {
  const halfW = (t) => t < 0.4 ? beam / 2 * (0.8 + 0.2 * Math.sin((t / 0.4) * Math.PI / 2)) : Math.max(0.06, beam / 2 * Math.pow(Math.max(0, Math.cos(((t - 0.4) / 0.6) * Math.PI / 2)), 0.68));
  const top = (t) => depth * (0.5 + 0.5 * Math.pow((t - 0.47) * 2, 2)) + (t < 0.2 ? depth * 0.42 * (1 - t / 0.2) : 0) + (t > 0.85 ? depth * 0.25 * (t - 0.85) / 0.15 : 0);
  const keel = (t) => -depth * 0.58 * (1 - 0.72 * Math.pow(Math.max(0, (t - 0.68) / 0.32), 1.6)) * (t < 0.05 ? 0.85 : 1);
  return { halfW, top, keel };
}
function hullGeometry(len, beam, depth) {
  const { halfW, top, keel } = hullShape(len, beam, depth);
  const N = 22, M = 16;
  const pos = [], uv = [], idx = [], sections = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = (t - 0.5) * len, w = halfW(t), yd = top(t), yk = keel(t);
    const ring = [];
    for (let j = 0; j <= M; j++) {
      const phi = (j / M) * Math.PI, c = Math.cos(phi), u = Math.sin(phi);
      const x = w * Math.sign(c) * Math.pow(Math.abs(c), 0.42) * (1 - 0.08 * Math.pow(1 - u, 3));
      const y = yd - (yd - yk) * Math.pow(u, 1.1);
      ring.push([x, y, z]);
    }
    // arc length from each gunwale down to the keel -> V (painted strakes follow the hull)
    const half = M / 2, arc = [0]; for (let j = 1; j <= half; j++) arc.push(arc[j - 1] + Math.hypot(ring[j][0] - ring[j - 1][0], ring[j][1] - ring[j - 1][1]));
    for (let j = 0; j <= M; j++) {
      const jj = j <= half ? j : M - j;
      pos.push(...ring[j]); uv.push(z / 5, arc[jj] / arc[half]);
    }
    sections.push(ring);
  }
  const P = M + 1;
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * P + j, b = a + 1, c = a + P, d = c + 1; idx.push(a, c, b, b, c, d); }
  // stern transom (separate verts so it gets its own flat normal)
  const base = pos.length / 3, s0 = sections[0];
  const cy = s0.reduce((a, p) => a + p[1], 0) / s0.length;
  pos.push(0, cy, s0[0][2]); uv.push(0.5, 0.5);
  s0.forEach(p => { pos.push(...p); uv.push(p[0] / beam + 0.5, p[1] / depth); });
  for (let j = 0; j < M; j++) idx.push(base, base + 1 + j + 1, base + 1 + j);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return { geo, sections, shape: { halfW, top, keel } };
}
function deckGeometry(len, shape, drop, inset = 0.9) {
  const N = 22, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = (t - 0.5) * len, w = shape.halfW(t) * (inset >= 1 ? 1.0 : inset * 0.93), y = shape.top(t) - drop;
    pos.push(w, y, z, -w, y, z); uv.push(z / 4, w / 1.4, z / 4, -w / 1.4);
  }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// billowed sail hanging from y=0 (yard) down to -h, curved foot
function sailGeometry(w, h, billow) {
  const g = new THREE.PlaneGeometry(w, h, 10, 8);
  g.translate(0, -h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2), y = -p.getY(i) / h; // y: 0 top .. 1 foot
    p.setZ(i, billow * (1 - x * x) * (0.35 + 0.65 * Math.sin(Math.min(1, y * 1.15) * Math.PI * 0.9)));
    p.setY(i, p.getY(i) + (1 - x * x) * h * 0.06 * y); // the foot bellies upward a bit
    p.setX(i, p.getX(i) * (1 - 0.08 * y));            // slightly narrower at the foot
  }
  g.computeVertexNormals();
  return g;
}
const WATER_MASK = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
const cyl = (r1, r2, h, s = 10, open = false) => new THREE.CylinderGeometry(r1, r2, h, s, 1, open);
function lathe(pts, segs = 12) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs); }
const CANNON = [[0.001, -0.15], [0.2, -0.15], [0.27, -0.08], [0.29, 0.05], [0.25, 0.14], [0.23, 0.2], [0.21, 0.82], [0.25, 0.86], [0.25, 0.94], [0.21, 0.98], [0.23, 1.06], [0.3, 1.12], [0.3, 1.22], [0.17, 1.22], [0.15, 1.1]];

// collects static parts per material, then merges them into one mesh per material (few draw calls)
class Parts {
  constructor() { this.by = new Map(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); }
  add(mat, geo, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
    const g = geo.index ? geo : geo; // all builders here are indexed
    const m = this._m.compose(new THREE.Vector3(...p), this._q.setFromEuler(this._e.set(...r)), new THREE.Vector3(...(Array.isArray(s) ? s : [s, s, s])));
    const c = g.clone().applyMatrix4(m);
    for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(k)) c.deleteAttribute(k);
    if (!c.index) { const n = c.attributes.position.count, ix = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) ix[i] = i; c.setIndex(new THREE.BufferAttribute(ix, 1)); }
    if (!c.attributes.uv) c.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2));
    if (!this.by.has(mat)) this.by.set(mat, []);
    this.by.get(mat).push(c);
  }
  build(parent, outlined = new Set(), thickness = 0.05, shadows = false) {
    for (const [mat, list] of this.by) {
      const geo = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadows && !mat.isMeshBasicMaterial; mesh.receiveShadow = shadows && !mat.isMeshBasicMaterial;
      parent.add(mesh);
      if (outlined.has(mat)) parent.add(outlineFor(mesh, thickness));
      list.forEach(g => g.dispose());
    }
  }
}

// ---------- ship builder ----------
export function buildShip(opts) {
  const {
    len = 16, beam = 5.2, depth = 3, scheme = 'player', mainSailMap = null, flagMap, flagScale = 1,
    cannonsPerSide = 3, masts = 2, light = false, shadows = false, boss = false,
  } = opts;
  const K = kit(scheme, mainSailMap);
  const ship = new THREE.Group();
  const body = new THREE.Group(); ship.add(body); // body gets bob/tilt
  const parts = new Parts();

  const { geo: hullGeo, sections, shape } = hullGeometry(len, beam, depth);
  parts.add(K.hull, hullGeo);
  const deckDrop = 0.5;
  parts.add(K.deck, deckGeometry(len, shape, deckDrop));
  const deckAt = (t) => shape.top(t) - deckDrop;
  const zAt = (t) => (t - 0.5) * len;

  // gunwale cap rail + wale (gold) + railing posts and top rail
  for (const sx of [1, -1]) {
    const cap = [], wale = [], rail = [];
    for (let i = 0; i <= 22; i++) {
      const t = 0.02 + i / 22 * 0.95, w = shape.halfW(t), y = shape.top(t), z = zAt(t);
      cap.push(new THREE.Vector3(sx * w * 0.97, y + 0.02, z));
      wale.push(new THREE.Vector3(sx * (w * 1.0 + 0.04), y - depth * 0.28, z));
      rail.push(new THREE.Vector3(sx * w * 0.9, y + 0.62, z));
    }
    parts.add(K.gold, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cap), 40, 0.13, 6));
    parts.add(K.gold, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wale), 40, 0.09, 5));
    parts.add(K.mast, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail.slice(4)), 30, 0.07, 5));
    const post = cyl(0.06, 0.07, 0.62, 5);
    for (let i = 4; i < rail.length; i += 1) { const p = rail[i]; parts.add(K.mast, post, [p.x, p.y - 0.31, p.z]); }
  }
  // bow knee + figure: a gold-capped stem post
  const bowT = 0.995, bowY = shape.top(bowT);
  parts.add(K.gold, new THREE.SphereGeometry(0.32, 10, 8), [0, bowY + 0.25, zAt(1) + 0.05]);

  // stern castle: chunky rounded cabin, gold roof trim, quarterdeck rail, glowing windows
  const cabT = 0.13, cabZ = zAt(cabT), cabL = len * 0.24, cabW = beam * 0.74, cabH = 1.9 + (boss ? 0.4 : 0);
  const deckY = deckAt(0.5);
  const cabY0 = deckAt(cabT) - 0.05;
  parts.add(K.cabin, new RoundedBoxGeometry(cabW, cabH, cabL, 3, 0.22), [0, cabY0 + cabH / 2, cabZ]);
  parts.add(K.gold, new RoundedBoxGeometry(cabW + 0.4, 0.22, cabL + 0.35, 2, 0.08), [0, cabY0 + cabH + 0.08, cabZ]);
  const qRail = [];
  for (let i = 0; i < 4; i++) { const a = i / 4; qRail.push([[cabW / 2, -cabL / 2 + a * cabL], [-cabW / 2, -cabL / 2 + a * cabL]]); }
  const qp = cyl(0.06, 0.06, 0.55, 5);
  for (const sx of [1, -1]) {
    parts.add(K.mast, cyl(0.06, 0.06, cabL, 5), [sx * cabW / 2, cabY0 + cabH + 0.62, cabZ], [Math.PI / 2, 0, 0]);
    for (let i = 0; i <= 4; i++) parts.add(K.mast, qp, [sx * cabW / 2, cabY0 + cabH + 0.36, cabZ - cabL / 2 + i * cabL / 4]);
  }
  parts.add(K.mast, cyl(0.06, 0.06, cabW, 5), [0, cabY0 + cabH + 0.62, cabZ - cabL / 2], [0, 0, Math.PI / 2]);
  // stern windows (back face) + side windows, each with a dark frame
  const winG = new THREE.PlaneGeometry(0.5, 0.62), frameG = new RoundedBoxGeometry(0.7, 0.82, 0.08, 1, 0.04);
  const nW = boss ? 4 : 3;
  for (let i = 0; i < nW; i++) {
    const x = (i - (nW - 1) / 2) * cabW * 0.26, y = cabY0 + cabH * 0.55, z = cabZ - cabL / 2 - 0.04;
    parts.add(K.gold, frameG, [x, y, z + 0.02]);
    parts.add(K.window, winG, [x, y, z - 0.03], [0, Math.PI, 0]);
  }
  for (const sx of [1, -1]) for (let i = 0; i < 2; i++) {
    const z = cabZ + (i - 0.5) * cabL * 0.45, y = cabY0 + cabH * 0.55, x = sx * (cabW / 2 + 0.04);
    parts.add(K.dark, frameG, [x - sx * 0.02, y, z], [0, Math.PI / 2, 0]);
    parts.add(K.window, winG, [x + sx * 0.03, y, z], [0, sx * Math.PI / 2, 0]);
  }
  // lanterns: stern pair, bow, crow's nest; brass cage + glowing core
  const lanterns = [];
  const lantern = (p, s = 1) => {
    parts.add(K.gold, cyl(0.16 * s, 0.24 * s, 0.14 * s, 8), [p[0], p[1] + 0.32 * s, p[2]]);
    parts.add(K.gold, cyl(0.2 * s, 0.14 * s, 0.1 * s, 8), [p[0], p[1] - 0.28 * s, p[2]]);
    parts.add(K.lantern, new THREE.SphereGeometry(0.22 * s, 10, 8), p, [0, 0, 0], [1, 1.25, 1]);
    parts.add(K.dark, cyl(0.03, 0.03, 0.5 * s, 4), [p[0], p[1] + 0.6 * s, p[2]]);
    lanterns.push(new THREE.Vector3(...p));
  };
  for (const sx of [1, -1]) lantern([sx * cabW * 0.46, cabY0 + cabH + 0.95, cabZ - cabL / 2 - 0.15], boss ? 1.4 : 1.15);
  lantern([0, bowY + 0.95, zAt(0.93)], 0.9);
  if (light) { const pl = new THREE.PointLight(K.S.lantern, 14, 32, 1.6); pl.position.set(0, cabY0 + cabH + 1.4, cabZ - cabL / 2 - 0.6); body.add(pl); }

  // cannons (port +X, starboard -X): lathe barrel on a rounded carriage, painted gun port behind
  const muzzles = { port: [], star: [] };
  const barrel = lathe(CANNON, 12);
  const carriage = new RoundedBoxGeometry(0.8, 0.38, 0.9, 2, 0.08), wheel = cyl(0.17, 0.17, 0.1, 10);
  const port = new RoundedBoxGeometry(0.12, 0.72, 0.9, 1, 0.04);
  const cs = boss ? 1.25 : 1;
  for (let i = 0; i < cannonsPerSide; i++) {
    const t = 0.3 + (i / Math.max(1, cannonsPerSide - 1)) * 0.34;
    const w = shape.halfW(t), y = deckAt(t), z = zAt(t);
    for (const side of ['port', 'star']) {
      const sx = side === 'port' ? 1 : -1;
      const cx = sx * (w - 0.45);
      parts.add(K.cabin, carriage, [cx - sx * 0.1, y + 0.2, z], [0, 0, 0], cs);
      for (const dz of [-0.36, 0.36]) parts.add(K.dark, wheel, [cx - sx * 0.1, y + 0.08, z + dz], [0, 0, Math.PI / 2], cs);
      // barrel axis = local +Y, rotate so it points outward along ±X, poking over the gunwale
      parts.add(K.iron, barrel, [cx - sx * 0.35, y + 0.55, z], [0, 0, -sx * Math.PI / 2], [cs * 1.1, cs * 1.25, cs * 1.1]);
      parts.add(K.dark, port, [sx * (w * 1.0 + 0.02), shape.top(t) - 0.5, z]);
      parts.add(K.gold, new RoundedBoxGeometry(0.08, 0.86, 1.04, 1, 0.03), [sx * (w * 1.0 + 0.0), shape.top(t) - 0.5, z]);
      const m = new THREE.Object3D(); m.position.set(sx * (w + 1.0), y + 0.55, z); body.add(m);
      muzzles[side].push(m);
    }
  }
  // a few barrels + crates on deck for detail
  const keg = lathe([[0.001, 0], [0.3, 0], [0.36, 0.25], [0.36, 0.45], [0.3, 0.7], [0.001, 0.7]], 10);
  [[0.25, 0.55, 0.42], [-0.3, 0.7, 0.4], [0.3, 0.78, 0.35]].forEach(([xf, t, s], i) => {
    const y = deckAt(t), z = zAt(t);
    if (i < 2) parts.add(K.cabin, keg, [xf * beam, y, z], [0, i, 0], s * 2.4);
    else parts.add(K.cabin, new RoundedBoxGeometry(0.8, 0.7, 0.8, 2, 0.08), [xf * beam, y + 0.35, z], [0, 0.4, 0]);
  });

  // masts, gold bands, yards, crow's nest, sails, rigging
  const mastDefs = masts >= 3 ? [[0.57, 1.0], [0.79, 0.78], [0.32, 0.72]] : [[0.55, 1.0], [0.8, 0.78]];
  const sails = [], rig = [];
  let flagPole = null;
  mastDefs.forEach(([tf, hf], mi) => {
    const mz = zAt(tf), my = deckAt(tf), mh = len * 0.98 * hf;
    parts.add(K.mast, cyl(0.17, 0.3, mh, 10), [0, my + mh / 2, mz]);
    for (const f of [0.08, 0.4, 0.66]) parts.add(K.gold, new THREE.TorusGeometry(0.29 - f * 0.12, 0.06, 6, 12), [0, my + mh * f, mz], [Math.PI / 2, 0, 0]);
    const tiers = [[0.74, 1.5, 0.4], [0.98, 1.08, 0.24]];
    tiers.forEach(([yf, wf, hfS], k) => {
      const yw = beam * wf * hf * (boss ? 1.08 : 1), sh = mh * hfS, yy = my + mh * yf;
      const yard = lathe([[0.04, -yw / 2], [0.12, -yw * 0.3], [0.14, 0], [0.12, yw * 0.3], [0.04, yw / 2]], 6);
      parts.add(K.mast, yard, [0, yy, mz + 0.22], [0, 0, Math.PI / 2]);
      const sg = sailGeometry(yw * 0.92, sh, 1.0 + sh * 0.07);
      const useMain = k === 0 && K.main;
      const sail = new THREE.Group();
      const front = new THREE.Mesh(sg, useMain ? K.main : K.sail), back = new THREE.Mesh(sg, useMain ? K.mainBack : K.sailBack);
      front.castShadow = back.castShadow = shadows;
      sail.add(front, back);
      sail.position.set(0, yy - 0.12, mz + 0.34);
      body.add(sail); sails.push(sail);
      // rigging: yard tips down to the gunwale
      for (const sx of [1, -1]) rig.push([sx * yw / 2, yy, mz + 0.22], [sx * shape.halfW(tf - 0.04) * 0.95, shape.top(tf - 0.04) + 0.1, mz - 1.2]);
    });
    // stays from the masthead fore and aft
    rig.push([0, my + mh, mz], [0, bowY + 0.6, zAt(1) + len * 0.12]);
    if (mi === 0) {
      const ny = my + mh * 0.84;
      parts.add(K.cabin, cyl(0.85, 0.62, 0.55, 12), [0, ny, mz]);
      parts.add(K.gold, new THREE.TorusGeometry(0.86, 0.08, 6, 16), [0, ny + 0.3, mz], [Math.PI / 2, 0, 0]);
      lantern([0.75, ny + 0.75, mz], 0.75);
      flagPole = new THREE.Object3D(); flagPole.position.set(0, my + mh, mz); body.add(flagPole);
    }
  });
  // bowsprit + jib
  const bsL = len * 0.34;
  parts.add(K.mast, cyl(0.1, 0.2, bsL, 8), [0, bowY + 0.5 + Math.sin(0.35) * bsL * 0.4, zAt(1) + bsL * 0.32], [Math.PI / 2 - 0.35, 0, 0]);
  const jg = new THREE.BufferGeometry();
  const mh0 = len * 0.98 * mastDefs[0][1], jTop = new THREE.Vector3(0, deckAt(mastDefs[0][0]) + mh0 * 0.78, zAt(mastDefs[0][0]) + 0.4);
  const jTip = new THREE.Vector3(0, bowY + 0.6 + Math.sin(0.35) * bsL * 0.8, zAt(1) + bsL * 0.62), jFoot = new THREE.Vector3(0, bowY + 0.5, zAt(0.88));
  jg.setAttribute('position', new THREE.Float32BufferAttribute([...jTop.toArray(), ...jTip.toArray(), ...jFoot.toArray()], 3));
  jg.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 1, 1, 0, 0, 0], 2));
  jg.computeVertexNormals();
  const jib = new THREE.Group(); jib.add(new THREE.Mesh(jg, K.sail), new THREE.Mesh(jg, K.sailBack)); body.add(jib);
  rig.push(jTop.toArray(), jTip.toArray());

  parts.build(body, new Set([K.hull, K.cabin, K.mast, K.iron, K.gold]), boss ? 0.07 : 0.05, shadows);

  // Water mask: an invisible depth-only lid over the hull opening at gunwale height. It renders after the
  // ship (so the deck stays visible) but before the ocean (renderOrder 2), so wave crests that rise above
  // the deck can never show inside the hull. Scales with the ship (frigates / galleons / boss).
  const lid = new THREE.Mesh(deckGeometry(len, shape, -0.06, 1.0), WATER_MASK);
  lid.renderOrder = 1; lid.userData.waterMask = true;
  body.add(lid);

  // rigging lines
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rig.flat(), 3));
  body.add(new THREE.LineSegments(rg, K.rope));

  // flag (animated cloth, CPU wave)
  const fw = len * 0.3 * flagScale, fh = fw * 0.66;
  const fGeo = new THREE.PlaneGeometry(fw, fh, 12, 6);
  fGeo.translate(-fw / 2, fh / 2, 0); // attach edge at x=0
  fGeo.rotateY(-Math.PI / 2);        // stream toward -Z (aft)
  const flag = new THREE.Group();
  const fm = flagMats(flagMap);
  flag.add(new THREE.Mesh(fGeo, fm[0]), new THREE.Mesh(fGeo, fm[1]));
  flag.geometry = fGeo;
  flag.position.y = -fh * 0.05 + 0.4; flagPole.add(flag);
  const pole = new THREE.Mesh(cyl(0.06, 0.06, fh + 1.2, 5), K.mast); pole.position.y = fh / 2 + 0.4; flagPole.add(pole);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), K.gold); knob.position.y = fh + 1.0; flagPole.add(knob);
  const base = fGeo.attributes.position.array.slice();

  ship.userData = { body, muzzles, sails, flag, flagBase: base, len, beam, depth, deckY, lanterns };
  // [Raul] upgrade visuals: hull/mast/cabin layout so js/upgradeVisuals.js can attach upgrade layers (no visual change here)
  ship.userData.layout = { shape, deckDrop, mastDefs, cab: { z: cabZ, l: cabL, w: cabW, h: cabH, y0: cabY0 }, bowY, bsL, flagPole };
  return ship;
}

export function animateShip(ship, t, sailLevel = 1) {
  const { flag, flagBase, sails } = ship.userData;
  const p = flag.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = flagBase[i * 3 + 2], y = flagBase[i * 3 + 1];
    const d = -z; // distance from pole
    p.setX(i, Math.sin(d * 1.3 - t * 7 + y * 0.4) * 0.2 * d + Math.sin(d * 3 - t * 11) * 0.05 * d);
    p.setY(i, y - d * d * 0.012 * (1 + Math.sin(t * 3 + d)));
  }
  p.needsUpdate = true;
  // furl sails up to the yard with sail level (0..1)
  const s = 0.16 + 0.84 * sailLevel;
  sails.forEach(sl => { sl.scale.y += (s - sl.scale.y) * 0.08; sl.scale.z += ((0.35 + 0.65 * sailLevel) - sl.scale.z) * 0.08; });
}

const _flagMats = new Map();
function flagMats(map) {
  if (!_flagMats.has(map)) _flagMats.set(map, [toon(0xffffff, map, { side: THREE.FrontSide }), toon(0xffffff, mirror(map), { side: THREE.BackSide })]);
  return _flagMats.get(map);
}
// free a removed ship's GPU geometry (materials/textures are shared per scheme and kept)
export function disposeShip(ship) { ship.traverse(o => { if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose(); }); }
