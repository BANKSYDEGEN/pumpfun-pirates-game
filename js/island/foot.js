// [Raul] PUMPFUN PIRATES on-foot island (PHASE 1 BLOCKOUT, layout review only). Loaded with island.html?foot=1 (dynamic
// import: the harbor / ship view never downloads or renders it). Two scales: from the ships you see the compact dock-town
// island (6 piers, 18 berths, arena untouched); step off and the dock town is the tip of a headland on a massive jungle
// island (~1.0 x 1.3 km, a few minutes to cross at 4.2 m/s). Heightmap (4 m grid) -> 5 x 5 chunks x 3 LODs streamed by
// camera distance + fog; jungle is instanced and streamed (nearest N trees). World frame: island centre (0,0), north = -z.
import * as THREE from 'three';
import { Kit, M } from './kit.js';
import { groundY } from './art.js';

// ---------- layout ----------
// the dock town (round island) sits off the west coast, harbor face (+z local) to the open sea (west)
export const TOWN = { x: -640, z: -90, yaw: -Math.PI / 2 };
const TC = Math.cos(TOWN.yaw), TS = Math.sin(TOWN.yaw);
export const townToWorld = (lx, lz) => [TOWN.x + lx * TC + lz * TS, TOWN.z - lx * TS + lz * TC];
export const worldToTown = (x, z) => { const dx = x - TOWN.x, dz = z - TOWN.z; return [dx * TC - dz * TS, dx * TS + dz * TC]; };
// main street: a cobbled road on the land bridge from the town's back gate inland (town-local x = STREET.x, z from z0 to z1)
export const STREET = { x: 6, z0: -58, z1: -205, half: 7 };
// coastline traced from the Nublar-style reference (teardrop: broad north lobe, long tapering south), metres
const COAST = [[95,60],[150,40],[215,35],[270,45],[330,60],[385,85],[420,110],[430,150],[440,200],[432,250],[418,290],[395,330],[370,365],
  [345,400],[330,430],[318,470],[300,500],[280,520],[262,525],[250,505],[236,470],[220,430],[200,395],[180,365],[160,340],[150,320],[130,300],
  [110,285],[85,270],[60,255],[48,230],[45,200],[50,170],[62,140],[70,110],[80,85]].map(([x, y]) => [(x - 240) * 2.6, (y - 280) * 2.6]);
const ISLETS = [[-330, 560, 70], [-470, 420, 42], [420, 560, 38], [560, -420, 34], [-150, -770, 30]];           // outer islets
const HEADLANDS = [[-548, -232, 34]];                                                                              // lighthouse point
const COVES = [[262, 300, 46, 'smugglers'], [-420, -470, 50], [470, 120, 40], [-240, 170, 36]];                    // bays cut into the coast
// mountain ranges: polylines [x, z, height, width]
const RANGES = [
  [[-300, -520, 55, 70], [-60, -585, 80, 80], [190, -505, 75, 80], [340, -330, 58, 70]],                          // north rim
  [[-110, -290, 50, 70], [10, -120, 78, 75], [60, 60, 95, 85], [90, 250, 120, 90], [70, 450, 80, 70], [45, 580, 40, 50]], // central spine
];
export const LAKE = { x: -205, z: -130, r: 58, y: 20 };                                                           // the lagoon below the falls
const RIVER = [[-205, -130], [-120, -96], [-30, -86], [20, -82], [100, -60], [200, -48], [320, -70], [430, -62], [520, -60]];
const FALLS_CLIFF = { x: -212, z: -236, h: 48, s: 2200 };
const PEAK = { x: 90, z: 250 };                                                                                   // the skull peak (summit)
const GALLOWS_HILL = { x: 110, z: -320, h: 34, s: 2600 };
// pirate trails: two closed loops (catmull-rom) + the main street feeds them at the town gate
const GATE = townToWorld(STREET.x, STREET.z1);
const TRAIL_A = [GATE, [-380, -170], [-292, -262], [-170, -330], [-20, -400], [110, -330], [230, -262], [300, -150], [190, -100], [20, -150], [10, -40], [-120, -40], [-300, -64]];
const TRAIL_B = [[-120, -40], [-210, 60], [-282, 150], [-200, 290], [-60, 420], [40, 540], [150, 420], [232, 252], [196, 150], [130, 150], [40, 60], [-30, -10]];
const ROPE_BRIDGE = { c: [16, -82] };                                                              // trail A over the river gorge

// ---------- helpers ----------
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function segD(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return [Math.hypot(px - ax - dx * t, pz - az - dz * t), t]; }
function polySD(x, z, P) { let d = 1e9, inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, az] = P[j], [bx, bz] = P[i]; d = Math.min(d, segD(x, z, ax, az, bx, bz)[0]);
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside; }
  return inside ? -d : d; }
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v; }
const fbm = (x, z, o = 4) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, o)); };
function catmull(pts, closed, step = 3) {
  const out = [], n = pts.length, P = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), k = Math.max(2, Math.ceil(L / step));
    for (let s = 0; s < k; s++) { const t = s / k, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); } }
  if (closed) out.push(out[0]); else out.push(pts[n - 1]); return out; }
const pathLen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };
export const TRAILS = { A: catmull(TRAIL_A, true), B: catmull(TRAIL_B, true) };
const RIVERP = catmull(RIVER, false, 4);
const STREETP = [townToWorld(STREET.x, STREET.z0), GATE];

// ---------- the heightmap ----------
export function coastSD(x, z) {
  let d = polySD(x, z, COAST) + 9 * Math.sin(x * 0.021 + z * 0.013) + 5 * Math.sin(x * 0.047 - z * 0.039 + 1.3); // ragged coast
  for (const [cx, cz, r] of [...ISLETS, ...HEADLANDS]) d = Math.min(d, Math.hypot(x - cx, z - cz) - r * (0.85 + 0.25 * vnoise(x * 0.03, z * 0.03)));
  for (const [cx, cz, r] of COVES) d = Math.max(d, r - Math.hypot(x - cx, z - cz));
  return d;
}
function rangeH(x, z) { let h = 0;
  for (const R of RANGES) for (let i = 0; i < R.length - 1; i++) { const a = R[i], b = R[i + 1], [d, t] = segD(x, z, a[0], a[1], b[0], b[1]);
    const H = a[2] + (b[2] - a[2]) * t, w = a[3] + (b[3] - a[3]) * t; h = Math.max(h, H * Math.exp(-(d * d) / (w * w))); }
  return h * (0.72 + 0.5 * Math.abs(fbm(x * 0.012, z * 0.012, 3) - 0.5) * 2); }
const gauss = (x, z, c, s) => Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / s);
function rawH(x, z, sd) {
  if (sd > 0) return -2 - Math.min(sd, 70) * 0.22;                                  // sandy shelf -> deep
  const t = -sd;
  let h = 0.8 + 2.4 * sm(0, 26, t) + 16 * sm(26, 190, t);                           // beach (~25 m of sand) -> lowland plateau ~19
  h += (fbm(x * 0.006, z * 0.006) - 0.45) * 26 * sm(40, 150, t);                    // rolling jungle hills + valleys
  h += rangeH(x, z) * sm(18, 120, t);                                               // ranges stop short of most beaches (cliffs on the north rim)
  h += 34 * gauss(x, z, PEAK, 2400) * sm(0, 80, t);                                 // skull peak summit spike
  h = Math.max(h, (GALLOWS_HILL.h + 18) * Math.min(1, 1.5 * gauss(x, z, GALLOWS_HILL, GALLOWS_HILL.s)));  // flat-topped gallows hill
  h += FALLS_CLIFF.h * Math.min(1, 1.4 * gauss(x, z, FALLS_CLIFF, FALLS_CLIFF.s));  // the cliff the falls drop off
  return h;
}

// grid (4 m), filled once: H, plus stamped distance fields for trails / river / street
const G = 4, X0 = -820, Z0 = -820, NX = 380, NZ = 400;                               // x -820..700, z -820..780
const IDX = (i, j) => j * (NX + 1) + i;
const Hg = new Float32Array((NX + 1) * (NZ + 1)), SDg = new Float32Array(Hg.length);
const TRg = new Float32Array(Hg.length).fill(99), RVg = new Float32Array(Hg.length).fill(99), RVl = new Float32Array(Hg.length), STg = new Float32Array(Hg.length).fill(99);
function stamp(path, R, D, L = null, lv = null) {
  let s = 0; const Ltot = L ? pathLen(path) : 1;
  for (let k = 0; k < path.length - 1; k++) { const [ax, az] = path[k], [bx, bz] = path[k + 1], sl = Math.hypot(bx - ax, bz - az);
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - R - X0) / G)), i1 = Math.min(NX, Math.ceil((Math.max(ax, bx) + R - X0) / G));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - R - Z0) / G)), j1 = Math.min(NZ, Math.ceil((Math.max(az, bz) + R - Z0) / G));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const [d, t] = segD(X0 + i * G, Z0 + j * G, ax, az, bx, bz); const q = IDX(i, j);
      if (d < D[q]) { D[q] = d; if (L) L[q] = lv((s + t * sl) / Ltot); } }
    s += sl; }
}
const t0 = performance.now();
stamp(TRAILS.A, 14, TRg); stamp(TRAILS.B, 14, TRg); stamp(STREETP, 30, STg);
stamp(RIVERP, 40, RVg, RVl, (u) => LAKE.y * (1 - u) + (-1.2) * u);                  // river surface: lake level -> sea
for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
  const x = X0 + i * G, z = Z0 + j * G, q = IDX(i, j), sd = coastSD(x, z); SDg[q] = sd;
  let h = rawH(x, z, sd);
  // river: carved channel; where it cuts the spine it becomes a gorge (walls stay steep because the land around is high)
  const rd = RVg[q]; if (rd < 40 && sd < 6) { const lvl = RVl[q]; h = Math.min(h, lvl - 2.2 + Math.max(0, rd - 5) * 0.5 + Math.max(0, rd - 11) * 2.6); }   // steep gorge walls
  // lake basin with a raised rim, so the lagoon holds water at LAKE.y
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (ld < LAKE.r) h = Math.min(h, LAKE.y - 1.2 - 5 * Math.sqrt(1 - ld / LAKE.r));
  else if (ld < LAKE.r + 45 && rd > 9) h = Math.max(h, LAKE.y + 1.4 + (ld - LAKE.r) * 0.12);
  // trails: ease the ground towards a smoothed level (walkable switchbacks come with the art pass)
  if (TRg[q] < 5 && h > 0.6) h = h * 0.85 + Math.max(1.4, h) * 0.15;
  // land bridge + main street from the town gate inland (flat cobbles, cut into any hill it meets)
  const [lx, lz] = worldToTown(x, z), sx = Math.abs(lx - STREET.x);
  if (lz < -40 && lz > STREET.z1 - 30) {
    const ys = 3.6 + Math.max(0, -lz + STREET.z0) * 0.035, w = 1 - sm(STREET.half + 12, STREET.half + 26, sx), along = sm(STREET.z1 - 30, STREET.z1, lz);
    const flat = STREET.half + 14 + Math.min(45, Math.max(0, -lz - 105) * 0.6), bridge = sx < flat ? ys : ys - (sx - flat) * 0.9;     // the land bridge's own shoulders
    h = lz > STREET.z1 ? Math.max(h, bridge) * (1 - w) + ys * w : h * (1 - along * w) + Math.max(h, ys) * along * w;
  }
  // the dock town keeps its own terrain disc: the big terrain sits just under it (no seams, no z-fight)
  const rT = Math.hypot(lx, lz); if (rT < 104) { const gy = groundY(lx, lz) - 0.6; h = rT < 90 ? Math.max(Math.min(h, gy), lz < -50 && sx < STREET.half + 14 ? h : gy) : Math.max(h, gy); }
  Hg[q] = h;
}
export const BUILD_MS = Math.round(performance.now() - t0);
// bilinear sample (world metres)
export function H(x, z) {
  const fx = Math.min(NX - 1e-3, Math.max(0, (x - X0) / G)), fz = Math.min(NZ - 1e-3, Math.max(0, (z - Z0) / G)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  return (Hg[IDX(i, j)] * (1 - u) + Hg[IDX(i + 1, j)] * u) * (1 - v) + (Hg[IDX(i, j + 1)] * (1 - u) + Hg[IDX(i + 1, j + 1)] * u) * v;
}
const gridAt = (A, x, z) => A[IDX(Math.round(Math.min(NX, Math.max(0, (x - X0) / G))), Math.round(Math.min(NZ, Math.max(0, (z - Z0) / G))))];
export const trailDist = (x, z) => gridAt(TRg, x, z);

// ---------- terrain colours ----------
const C = (h) => new THREE.Color(h);
const SAND = C(0xffe3a1), WETS = C(0xd9b878), SHALLOW = C(0x52d6d0), GRASS = C(0x6fcf4a), JUNGLE = C(0x2a8a38), JUNGLE2 = C(0x1f7432), ROCK = C(0x8a8f99), ROCK2 = C(0x6d6a72),
  DIRT = C(0xc99a5e), COBBLE = C(0xb7a58c), BANK = C(0x8a7a4a), _c = new THREE.Color();
function colorAt(i, j, out) {
  const q = IDX(i, j), h = Hg[q], x = X0 + i * G, z = Z0 + j * G, sd = SDg[q];
  const hx = Hg[IDX(Math.min(NX, i + 1), j)] - Hg[IDX(Math.max(0, i - 1), j)], hz = Hg[IDX(i, Math.min(NZ, j + 1))] - Hg[IDX(i, Math.max(0, j - 1))], slope = Math.hypot(hx, hz) / (2 * G);
  if (h < -0.4) { out.copy(SAND).lerp(SHALLOW, sm(-0.4, -3, h)).lerp(C(0x2a8fb0), sm(-4, -12, h)); return out; }
  const jm = fbm(x * 0.01 + 7, z * 0.01, 3);
  out.copy(GRASS).lerp(JUNGLE, sm(0.38, 0.55, jm) * sm(5, 14, h)).lerp(JUNGLE2, sm(0.6, 0.75, jm) * sm(10, 20, h));
  out.lerp(SAND, 1 - sm(2.4, 4.2, h)).lerp(WETS, sm(1.2, 0.2, h) * (sd > -40 ? 1 : 0));
  out.lerp(ROCK, sm(0.85, 1.35, slope)).lerp(ROCK2, sm(85, 120, h) * 0.8);
  if (RVg[q] < 12 && h < RVl[q] + 2) out.lerp(BANK, 0.6);
  out.lerp(DIRT, 1 - sm(2.4, 4.4, TRg[q]));
  out.lerp(COBBLE, 1 - sm(STREET.half - 0.5, STREET.half + 1, STg[q]));
  return out;
}

// ---------- chunked terrain (5 x 5 chunks, LOD steps 4 / 8 / 16 m, skirts hide LOD cracks) ----------
const CH = 80; // cells per chunk side (320 m)
function chunkGeo(ci, cj, step) {
  const i0 = ci * CH, j0 = cj * CH, i1 = Math.min(NX, i0 + CH), j1 = Math.min(NZ, j0 + CH), nx = Math.ceil((i1 - i0) / step) + 1, nz = Math.ceil((j1 - j0) / step) + 1;
  const pos = [], col = [], idx = [], at = (a, b) => [Math.min(i1, i0 + a * step), Math.min(j1, j0 + b * step)];
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) { const [i, j] = at(a, b); pos.push(X0 + i * G, Hg[IDX(i, j)], Z0 + j * G); colorAt(i, j, _c); col.push(_c.r, _c.g, _c.b); }
  for (let b = 0; b < nz - 1; b++) for (let a = 0; a < nx - 1; a++) { const p = b * nx + a; idx.push(p, p + nx, p + 1, p + 1, p + nx, p + nx + 1); }
  // skirts
  const edge = (list) => { for (let k = 0; k < list.length - 1; k++) { const p = list[k], r = list[k + 1], n = pos.length / 3;
    pos.push(pos[p * 3], pos[p * 3 + 1] - 8, pos[p * 3 + 2], pos[r * 3], pos[r * 3 + 1] - 8, pos[r * 3 + 2]); col.push(...col.slice(p * 3, p * 3 + 3), ...col.slice(r * 3, r * 3 + 3));
    idx.push(p, r, n, r, n + 1, n, p, n, r, r, n, n + 1); } };
  const row = (b) => Array.from({ length: nx }, (_, a) => b * nx + a), colm = (a) => Array.from({ length: nz }, (_, b) => b * nx + a);
  edge(row(0)); edge(row(nz - 1)); edge(colm(0)); edge(colm(nx - 1));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}

// ---------- instanced jungle (streamed: nearest trees to the camera) ----------
function treeGeos(low) {
  const k = new Kit(), seg = low ? 5 : 6;
  const trunk = new THREE.CylinderGeometry(0.35, 0.6, 7, seg); trunk.translate(0, 3.5, 0);
  const parts = [[trunk, 0x6b4426]];
  for (const [x, y, z, r, c] of [[0, 8.4, 0, 3.6, 0x2f9a3a], [1.8, 7.4, 0.8, 2.6, 0x3fb34a], [-1.6, 7.6, -0.9, 2.7, 0x268a34]]) { const s = new THREE.IcosahedronGeometry(r, 0); s.translate(x, y, z); parts.push([s, c]); }
  const tree = merge(parts);
  const pt = new THREE.CylinderGeometry(0.22, 0.4, 9, seg); pt.translate(0, 4.5, 0); pt.rotateZ(0.12);
  const pp = [[pt, 0x8a6236]];
  for (let f = 0; f < 6; f++) { const leaf = new THREE.ConeGeometry(0.9, 5.2, 3); leaf.rotateX(Math.PI / 2); leaf.scale(1, 0.25, 1); leaf.translate(0, 0, 2.6); leaf.rotateX(0.45); leaf.rotateY(f * Math.PI / 3); leaf.translate(1.0, 9.0, 0); pp.push([leaf, f % 2 ? 0x46c24a : 0x2fa83e]); }
  pp.push([new THREE.IcosahedronGeometry(0.55, 0).translate(1.0, 8.6, 0), 0x6b4426]);
  return { tree, palm: merge(pp) };
}
function merge(parts) {
  const geos = parts.map(([g, c]) => { const n = g.index ? g.toNonIndexed() : g; const col = new Float32Array(n.attributes.position.count * 3), cc = new THREE.Color(c);
    for (let i = 0; i < col.length; i += 3) { col[i] = cc.r; col[i + 1] = cc.g; col[i + 2] = cc.b; } n.setAttribute('color', new THREE.BufferAttribute(col, 3)); n.deleteAttribute('uv'); return n; });
  const pos = [], nor = [], col = []; for (const g of geos) { g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); col.push(...g.attributes.color.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
function treeSpots() {
  const trees = [], palms = [];
  for (let j = 1; j < NZ; j += 2) for (let i = 1; i < NX; i += 2) {
    const x = X0 + i * G + (hash(i, j) - 0.5) * 7, z = Z0 + j * G + (hash(j, i) - 0.5) * 7, h = H(x, z), q = IDX(i, j);
    if (h < 2.6 || TRg[q] < 10 || STg[q] < 16 || RVg[q] < 7 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4) continue;
    const [lx, lz] = worldToTown(x, z); if (Math.hypot(lx, lz) < 110) continue;
    if (FOOT_POIS.some(p => Math.hypot(p.x - x, p.z - z) < (p.clear || 22) || (p.view && segD(x, z, p.view[0], p.view[2], p.x, p.z)[0] < 14))) continue;            // keep the POIs readable
    const hx = H(x + 3, z) - H(x - 3, z), hz = H(x, z + 3) - H(x, z - 3); if (Math.hypot(hx, hz) / 6 > 0.85 || h > 105) continue;
    const jm = fbm(x * 0.01 + 7, z * 0.01, 3), r = hash(i * 3.1, j * 1.7);
    if (h < 6.5 && SDg[q] > -70) { if (r < 0.45) palms.push([x, h, z, r]); }
    else if (r < 0.15 + 0.8 * sm(0.36, 0.56, jm)) trees.push([x, h, z, r]);
  }
  return { trees, palms };
}

function vantage(q, ty, up, d0, d1) { let best = null;
  for (const path of [TRAILS.A, TRAILS.B]) for (const [x, z] of path) { const d = Math.hypot(x - q.x, z - q.z); if (d < d0 || d > d1 || (best && d > best.d)) continue;
    const y0 = H(x, z) + up; let ok = true; for (let k = 1; k < 30 && ok; k++) { const f = k / 30; if (H(x + (q.x - x) * f, z + (q.z - z) * f) > y0 + (ty - y0) * f - 0.5) ok = false; }
    if (ok) best = { d, p: [x, y0, z] }; }
  return best ? best.p : [q.x + d1, H(q.x + d1, q.z) + 20, q.z]; }
// nearest sandy beach cell to a hint (dig sites)
function beachNear(x, z) { let best = [x, z], bd = 1e9;
  for (let j = 0; j <= NZ; j += 2) for (let i = 0; i <= NX; i += 2) { const q = IDX(i, j), h = Hg[q]; if (h < 1.4 || h > 3.0 || SDg[q] > -6) continue;
    const px = X0 + i * G, pz = Z0 + j * G, d = (px - x) ** 2 + (pz - z) ** 2; if (d < bd) { bd = d; best = [px, pz]; } }
  return best; }
// ---------- blockout POIs (merged kit: toon + glow + outline) ----------
const STONE = 0xa9b4c2, STONE_D = 0x7f8a99, WOOD = 0xb06a36, WOOD_D = 0x7b4524, WOOD_L = 0xd99a5b, IRON = 0x2b2f36, GOLD = 0xffc93c, RED = 0xfa0d0d, CREAM = 0xfff1d2;
const PLASTER = [0xfff1d2, 0xf6d7a7, 0xe9b98f, 0xbfe0e6, 0xf2c4c4, 0xd9e8b8], SHUTTER = [0x2a6df4, 0x1f8a5a, 0xc0392b, 0x2b8fa3, 0x8a5a2b];
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, n = 10) => new THREE.CylinderGeometry(a, b, h, n);
const prism = () => new THREE.CylinderGeometry(1, 1, 1, 3, 1, false, Math.PI / 2);
// colonial timber + plaster house: 2-3 storeys, tile roof, balcony with rail, shutters, lit windows, door lantern
function colonial(kit, x, y, z, yaw, w, d, fl, v, sign = null, A = null) {
  kit.at(M(x, y, z, yaw), () => {
    const fh = 3.4, wall = PLASTER[v % PLASTER.length], sh = SHUTTER[v % SHUTTER.length];
    kit.add(box(w + 0.6, 0.8, d + 0.6), STONE_D, { m: M(0, 0.2, 0) });
    for (let f = 0; f < fl; f++) {
      const yy = 0.6 + f * fh, ww = w + (f ? 0.6 : 0);
      kit.add(box(ww, fh, d), wall, { m: M(0, yy + fh / 2, 0) });
      kit.add(box(ww + 0.08, 0.3, d + 0.08), WOOD_D, { m: M(0, yy + fh - 0.1, 0), outline: false });              // timber beam
      for (const sx of [-1, 1]) kit.add(box(0.3, fh, 0.3), WOOD_D, { m: M(sx * ww / 2, yy + fh / 2, d / 2), outline: false });
      const nw = Math.max(1, Math.floor(w / 3.2));
      for (let k = 0; k < nw; k++) { const wx = (k - (nw - 1) / 2) * (w / nw);
        if (f === 0 && k === Math.floor(nw / 2)) { kit.add(box(1.4, 2.4, 0.12), WOOD, { m: M(wx, yy + 1.2, d / 2 + 0.05), outline: false }); continue; }
        kit.add(box(1.0, 1.4, 0.1), 0xffcf6b, { bucket: 'glow', m: M(wx, yy + 1.9, d / 2 + 0.04), outline: false });
        for (const s of [-1, 1]) kit.add(box(0.5, 1.5, 0.1), sh, { m: M(wx + s * 0.8, yy + 1.9, d / 2 + 0.08), outline: false }); }
      if (f > 0) { kit.add(box(ww, 0.22, 1.4), WOOD, { m: M(0, yy + 0.1, d / 2 + 0.7) });                             // balcony
        kit.add(box(ww, 0.12, 0.12), WOOD_D, { m: M(0, yy + 1.1, d / 2 + 1.35), outline: false });
        for (let k = -ww / 2; k <= ww / 2 + 0.01; k += 1.0) kit.add(box(0.1, 1.0, 0.1), WOOD_D, { m: M(k, yy + 0.6, d / 2 + 1.35), outline: false }); }
    }
    const top = 0.6 + fl * fh;
    kit.add(prism(), 0xd2552e, { m: M(0, top + 1.3, 0, 0, 0, Math.PI / 2, [2.6, w + 1.6, d / 2 + 0.9]) });              // tile roof
    kit.add(box(0.9, 2.2, 0.9), STONE_D, { m: M(w * 0.3, top + 2.2, -d * 0.2) });                                        // chimney
    kit.add(box(0.5, 0.7, 0.5), IRON, { m: M(1.4, 2.9, d / 2 + 0.5), outline: false }); kit.add(new THREE.SphereGeometry(0.22, 6, 4), 0xffd36b, { bucket: 'glow', m: M(1.4, 2.9, d / 2 + 0.5), outline: false });
    if (sign && A && A[sign]) atlasQuad(kit, Math.min(w - 1, 7), 1.3, A[sign], M(0, 3.75, d / 2 + 0.2));
  });
}
function atlasQuad(kit, w, h, r, m) { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0), r.v0 + uv.getY(i) * (r.v1 - r.v0)); kit.add(g, 0, { bucket: 'atlas', m, outline: false }); }
function cannon(kit, m) { kit.at(m, () => { kit.add(box(1.2, 0.6, 1.8), WOOD_D, { m: M(0, 0.5, 0) }); kit.add(cyl(0.3, 0.42, 2.6, 10), IRON, { m: M(0, 1.05, 0.5, 0, Math.PI / 2 - 0.12) });
  for (const s of [-1, 1]) for (const zz of [-0.6, 0.6]) kit.add(cyl(0.3, 0.3, 0.15, 8), WOOD, { m: M(s * 0.65, 0.3, zz, 0, 0, Math.PI / 2), outline: false }); }); }
function torch(kit, x, y, z) { kit.add(cyl(0.08, 0.1, 2.2, 5), WOOD_D, { m: M(x, y + 1.1, z), outline: false }); kit.add(new THREE.ConeGeometry(0.25, 0.6, 5), 0xffa63b, { bucket: 'glow', m: M(x, y + 2.4, z), outline: false }); }

// town-local kit (added to the isle group): main street, Squad Hall, fort cannons, town gate
export function buildTownKit(A, low) {
  const k = new Kit(), S = STREET;
  // street houses both sides (the Squad Hall is the big one at the head of the street)
  const lots = []; for (let z = S.z0 - 10, n = 0; z > S.z1 + 8; n++) { const w = 7 + hash(n, 3) * 4; lots.push([z - w / 2, w, n]); z -= w + 1.6; }
  for (const side of [-1, 1]) for (const [z, w, n] of lots) {
    if (side === 1 && n === 0) continue;                                                       // Squad Hall plot
    const sign = side === -1 && n === 1 ? 'tavern' : null;
    const fl = 2 + (hash(n, side) > 0.55 ? 1 : 0), d = 8 + hash(side, n) * 2, x = S.x + side * (S.half + 1 + d / 2);
    const [wx, wz] = townToWorld(x, z); colonial(k, x, H(wx, wz), z, side === -1 ? Math.PI / 2 : -Math.PI / 2, w, d, fl, n * 2 + (side > 0 ? 1 : 0), sign, A);
  }
  { const [z] = lots[0], x = S.x + S.half + 1 + 7, [wx, wz] = townToWorld(x, z - 3);
    colonial(k, x, H(wx, wz), z - 3, -Math.PI / 2, 16, 14, 3, 3, 'squad', A); }               // SQUAD HALL
  // street lanterns + cobble edging, a gate arch at the jungle end
  for (let z = S.z0 - 6; z > S.z1; z -= 16) for (const s of [-1, 1]) { const x = S.x + s * (S.half - 0.6), [wx, wz] = townToWorld(x, z), y = H(wx, wz);
    k.add(cyl(0.1, 0.12, 3.6, 6), IRON, { m: M(x, y + 1.8, z), outline: false }); k.add(new THREE.SphereGeometry(0.28, 6, 4), 0xffd36b, { bucket: 'glow', m: M(x, y + 3.7, z), outline: false }); }
  { const z = S.z1 + 4, [wx, wz] = townToWorld(S.x, z), y = H(wx, wz);
    for (const s of [-1, 1]) k.add(box(2.2, 8, 2.2), STONE, { m: M(S.x + s * (S.half + 1), y + 4, z) });
    k.add(box(S.half * 2 + 4.4, 1.8, 2.4), STONE_D, { m: M(S.x, y + 8.6, z) }); }
  // fort battery: cannons round the keep, facing out to sea
  for (let i = 0; i < 6; i++) { const a = -0.9 + i * 0.5, r = 12.5, x = -41 + Math.sin(a + Math.PI * 1.5) * r, z = -15 + Math.cos(a + Math.PI * 1.5) * r;
    cannon(k, M(x, groundY(x, z) - 0.1, z, Math.atan2(x + 41, z + 15))); }
  return k;
}

// world kit: inland POIs
export const FOOT_POIS = [];
function poi(id, label, x, z, extra = {}) { const p = { id, label, x, z, y: H(x, z), action: null, ...extra }; FOOT_POIS.push(p); return p; }
export function buildWorldKit(low) {
  const k = new Kit();
  // lighthouse on its point (red / white bands, lamp glow)
  { const p = poi('lighthouse', 'Lighthouse', -556, -236), y = p.y;
    k.add(cyl(6, 7, 3, 12), STONE_D, { m: M(p.x, y + 1.2, p.z) });
    for (let b = 0; b < 6; b++) k.add(cyl(3.2 - b * 0.18, 3.4 - b * 0.18, 4, 12), b % 2 ? CREAM : RED, { m: M(p.x, y + 4.7 + b * 4, p.z) });
    k.add(cyl(2.2, 2.2, 3, 10), 0xfff3b0, { bucket: 'glow', m: M(p.x, y + 28.5, p.z), outline: false }); k.add(new THREE.ConeGeometry(3, 3, 10), RED, { m: M(p.x, y + 31.5, p.z) }); }
  // rope bridge over the river gorge
  { // span the gorge level: walk out from the river until the ground reaches the deck height on both sides
    const c = ROPE_BRIDGE.c, deckY = H(c[0], c[1]) + 24, out = (dz) => { let z = c[1]; while (H(c[0], z) < deckY && Math.abs(z - c[1]) < 90) z += dz; return [c[0], z]; };
    ROPE_BRIDGE.a = out(-1); ROPE_BRIDGE.b = out(1);
    const [ax, az] = ROPE_BRIDGE.a, [bx, bz] = ROPE_BRIDGE.b, ya = deckY, yb = deckY, L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
    const p = poi('bridge', 'Rope bridge over the gorge', (ax + bx) / 2, (az + bz) / 2, { deck: Math.max(ya, yb) });
    const n = Math.round(L / 1.1);
    for (let i = 0; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ya + (yb - ya) * t - Math.sin(t * Math.PI) * 3.5;
      k.add(box(3.2, 0.18, 0.8), i % 4 ? WOOD_L : WOOD, { m: M(x, y, z, yaw), outline: false });
      if (i % 3 === 0) for (const s of [-1, 1]) k.add(box(0.07, 1.2, 0.07), 0xc9a36b, { m: M(x + Math.cos(yaw) * s * 1.6, y + 0.6, z - Math.sin(yaw) * s * 1.6), outline: false }); }
    for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector3(ax + (bx - ax) * t + Math.cos(yaw) * s * 1.6, ya + (yb - ya) * t - Math.sin(t * Math.PI) * 3.5 + 1.2, az + (bz - az) * t - Math.sin(yaw) * s * 1.6)); }
      k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.07, 4), 0xc9a36b, { outline: false }); }
    for (const [x, z, y] of [[ax, az, ya], [bx, bz, yb]]) for (const s of [-1, 1]) k.add(cyl(0.25, 0.3, 3, 6), WOOD_D, { m: M(x + Math.cos(yaw) * s * 1.9, y + 1, z - Math.sin(yaw) * s * 1.9) }); }
  // skull peak: a giant skull face on the summit's north flank, treasure caves glowing gold in the eyes + mouth
  { const fx = PEAK.x, fz = PEAK.z - 62, y = H(fx, fz), p = poi('skullpeak', 'Skull Peak: treasure caves', fx, fz);
    k.at(M(fx, y, fz, Math.PI), () => {
      k.add(new THREE.IcosahedronGeometry(26, 1), (v) => (v.y > 14 ? 0xb9b2a6 : 0x8f887e), { m: M(0, 22, 4, 0, 0, 0, [1.15, 1.0, 0.8]) });
      k.add(box(26, 12, 14), 0x8f887e, { m: M(0, 6, 8) });
      for (const s of [-1, 1]) { k.add(new THREE.SphereGeometry(5.2, 10, 8), 0x1a1208, { m: M(s * 9, 24, 22.5, 0, 0, 0, [1, 1.1, 0.4]), outline: false });
        k.add(new THREE.SphereGeometry(3.0, 10, 8), GOLD, { bucket: 'glow', m: M(s * 9, 23.5, 24.9, 0, 0, 0, [1, 1, 0.25]), outline: false }); }
      k.add(new THREE.ConeGeometry(2.6, 5, 3), 0x1a1208, { m: M(0, 16.5, 22.6, 0, Math.PI), outline: false });
      k.add(box(12, 4.6, 2), 0x1a1208, { m: M(0, 6.6, 15.2), outline: false }); k.add(box(9, 2.4, 1), 0xffb52e, { bucket: 'glow', m: M(0, 5.4, 15.9), outline: false }); // mouth cave
      for (let i = -2; i <= 2; i++) k.add(box(1.6, 2.2, 1.4), 0xe8e2d4, { m: M(i * 2.3, 9.4, 16.2) });
      for (let i = 0; i < 7; i++) k.add(new THREE.ConeGeometry(1.0 + hash(i, 1), 1.2, 6), GOLD, { m: M(-5 + i * 1.7, 4.4, 14 + hash(i, 2) * 2), outline: false }); // gold piles
    }); }
  // smugglers' cove: hidden bay, shipwreck on its side, a tiny jetty + crates
  { const c = COVES[0], wx = c[0] - 8, wz = c[1] + 6, p = poi('cove', "Smugglers' cove + shipwreck", wx, wz);
    k.at(M(wx, -1.2, wz, 0.9, 0, 0.42), () => {
      k.add(box(7, 4.5, 24), 0x5a3a22, { m: M(0, 1.8, 0) }); k.add(new THREE.ConeGeometry(3.6, 8, 4), 0x5a3a22, { m: M(0, 1.8, 15.5, Math.PI / 4, Math.PI / 2, 0, [1.1, 1, 0.7]) });
      k.add(box(7.4, 0.5, 24.4), 0x3a2414, { m: M(0, 4.1, 0), outline: false }); k.add(box(5, 2.6, 6), 0x6b4a2a, { m: M(0, 5.5, -9) });
      k.add(cyl(0.4, 0.5, 16, 6), WOOD_D, { m: M(0, 11, 2, 0, 0.25) }); k.add(cyl(0.3, 0.4, 7, 6), WOOD_D, { m: M(0, 6.5, -4, 0, -0.9) });
      k.add(box(8, 5, 0.12), 0xe8dcc0, { m: M(0, 12, 2.6, 0, 0.25, 0.15), outline: false }); });
    const jx = c[0] + 20, jz = c[1] - 20;
    for (let i = 0; i < 8; i++) k.add(box(3, 0.3, 1.6), WOOD_L, { m: M(jx - i * 1.8 * 0.7, 1.6, jz + i * 1.8 * 0.7, -0.78), outline: false });
    for (let i = 0; i < 5; i++) k.add(box(1.4, 1.4, 1.4), WOOD_L, { m: M(jx + 4 + hash(i, 4) * 4, H(jx + 4, jz - 4) + 0.7, jz - 4 - i * 1.6, hash(i, 5)) }); }
  // gallows + ruins on the hill
  { const g = GALLOWS_HILL, y = H(g.x, g.z), p = poi('gallows', 'Gallows hill + ruins', g.x, g.z);
    k.add(box(9, 1.2, 7), WOOD, { m: M(g.x, y + 0.6, g.z) });
    for (const s of [-1, 1]) k.add(box(0.5, 6, 0.5), WOOD_D, { m: M(g.x + s * 3, y + 4, g.z) });
    k.add(box(7, 0.5, 0.5), WOOD_D, { m: M(g.x, y + 7, g.z) }); k.add(new THREE.TorusGeometry(0.4, 0.06, 4, 8), 0xc9a36b, { m: M(g.x, y + 4.6, g.z), outline: false }); k.add(box(0.06, 2, 0.06), 0xc9a36b, { m: M(g.x, y + 5.9, g.z), outline: false });
    for (let i = 0; i < 9; i++) { const a = i * 0.7, r = 16 + hash(i, 9) * 8, x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r, yy = H(x, z), hh = 2 + hash(i, 8) * 6;
      if (i % 3) k.add(cyl(0.8, 0.9, hh, 8), STONE, { m: M(x, yy + hh / 2, z) }); else k.add(box(7, hh * 0.6, 1.2), STONE_D, { m: M(x, yy + hh * 0.3, z, a) }); } }
  // waterfall into the lagoon (lake)
  { const fx = FALLS_CLIFF.x + 6, fz = LAKE.z - LAKE.r + 2, top = H(FALLS_CLIFF.x, FALLS_CLIFF.z + 26), p = poi('falls', 'Waterfall + lagoon', fx, fz);
    k.add(box(10, top - LAKE.y + 2, 1.2), 0xd6f6ff, { bucket: 'glow', m: M(fx, (top + LAKE.y) / 2, fz - 3), outline: false });
    k.add(new THREE.CylinderGeometry(7, 7, 0.4, 14), 0xffffff, { bucket: 'glow', m: M(fx, LAKE.y + 0.25, fz + 2), outline: false }); }
  // beach dig sites (X marks, mounds, shovels, a half-dug chest)
  for (const [x, z, n] of [[-306, 150, 1], [-82, 456, 2], [340, -360, 3]].map(([x, z, n]) => [...beachNear(x, z), n])) { const y = H(x, z); poi('dig' + n, 'Dig site ' + n, x, z);
    for (const r of [0.6, -0.6]) k.add(box(5, 0.2, 0.6), RED, { m: M(x, y + 0.12, z, r), outline: false });
    k.add(new THREE.SphereGeometry(2.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xe2c07e, { m: M(x + 4, y - 0.2, z + 1), outline: false });
    k.add(box(1.6, 1.1, 1.1), WOOD, { m: M(x - 0.5, y + 0.2, z - 0.3, 0.4) }); k.add(box(1.7, 0.2, 1.2), GOLD, { m: M(x - 0.5, y + 0.8, z - 0.3, 0.4), outline: false });
    k.add(cyl(0.05, 0.05, 1.6, 4), WOOD_D, { m: M(x + 2.5, y + 0.8, z - 1.5, 0, 0.3, 0.2), outline: false }); }
  // trail torches (every ~45 m) so both loops read from the air and at dusk
  for (const [key, path] of Object.entries(TRAILS)) { let acc = 0; for (let i = 1; i < path.length; i++) { acc += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); if (acc > 45) { acc = 0;
    const [x, z] = path[i], dx = path[i][0] - path[i - 1][0], dz = path[i][1] - path[i - 1][1], n = Math.hypot(dx, dz) || 1, tx = x + dz / n * 3.2, tz = z - dx / n * 3.2; if (H(tx, tz) > 1) torch(k, tx, H(tx, tz), tz); } } }
  poi('gate', 'Town gate (trailhead A + B)', GATE[0], GATE[1]);
  // review vantages on the trails (the jungle keeps a sight corridor open to each)
  for (const [id, ty, up, d0, d1] of [['skullpeak', 22, 3, 80, 200], ['gallows', 4, 1.7, 45, 120], ['falls', LAKE.y + 12 - H(-206, -186), 1.7, 60, 150]]) { const q = FOOT_POIS.find(p => p.id === id); q.view = vantage(q, q.y + ty, up, d0, d1); q.ty = q.y + ty; }
  return k;
}

// ---------- water: lake + river ribbon (one mesh) ----------
function waterMesh() {
  const pos = [], col = [], c1 = new THREE.Color(0x2fb8c9), c2 = new THREE.Color(0x48d7d0);
  const tri = (a, b, c, cc) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(cc.r, cc.g, cc.b); };
  for (let i = 0; i < 40; i++) { const a0 = i / 40 * Math.PI * 2, a1 = (i + 1) / 40 * Math.PI * 2, r = LAKE.r + 3;
    tri([LAKE.x, LAKE.y, LAKE.z], [LAKE.x + Math.cos(a1) * r, LAKE.y, LAKE.z + Math.sin(a1) * r], [LAKE.x + Math.cos(a0) * r, LAKE.y, LAKE.z + Math.sin(a0) * r], c1); }
  const L = pathLen(RIVERP); let s = 0;
  for (let i = 0; i < RIVERP.length - 1; i++) { const [ax, az] = RIVERP[i], [bx, bz] = RIVERP[i + 1], sl = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / sl, nz = (bx - ax) / sl, w = 5.5;
    const ya = LAKE.y * (1 - s / L) - 1.2 * (s / L) + 0.15, yb = LAKE.y * (1 - (s + sl) / L) - 1.2 * ((s + sl) / L) + 0.15; s += sl;
    const A1 = [ax + nx * w, ya, az + nz * w], A2 = [ax - nx * w, ya, az - nz * w], B1 = [bx + nx * w, yb, bz + nz * w], B2 = [bx - nx * w, yb, bz - nz * w];
    tri(A1, B1, A2, c2); tri(A2, B1, B2, c2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

// ---------- assemble ----------
export function createFoot({ scene, isle, MATS, OUT, low, atlas, toonMat }) {
  const root = new THREE.Group(); root.name = 'foot'; scene.add(root);
  const terrainMat = toonMat;
  const NCX = Math.ceil(NX / CH), NCZ = Math.ceil(NZ / CH), chunks = [];
  for (let cj = 0; cj < NCZ; cj++) for (let ci = 0; ci < NCX; ci++) {
    const cx = X0 + (ci * CH + Math.min(CH, NX - ci * CH) / 2) * G, cz = Z0 + (cj * CH + Math.min(CH, NZ - cj * CH) / 2) * G;
    // skip chunks that are all deep sea (the game ocean covers them)
    let land = false; for (let j = cj * CH; j <= Math.min(NZ, cj * CH + CH) && !land; j += 4) for (let i = ci * CH; i <= Math.min(NX, ci * CH + CH); i += 4) if (Hg[IDX(i, j)] > -8) { land = true; break; }
    if (!land) continue;
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), terrainMat); mesh.receiveShadow = !low; mesh.name = `chunk_${ci}_${cj}`; mesh.visible = false;
    chunks.push({ ci, cj, cx, cz, mesh, geos: {}, lod: -1 }); root.add(mesh);
  }
  const LODS = low ? [[0, 2], [200, 4], [380, 4]] : [[0, 1], [260, 2], [600, 4]], VIEW_R = low ? 560 : 1100;
  let allView = false;
  const worldKit = buildWorldKit(low).build(MATS, OUT); worldKit.name = 'foot_pois'; root.add(worldKit);
  const { tree, palm } = treeGeos(low), spots = treeSpots();
  const CAP = low ? { t: 700, p: 220 } : { t: 2600, p: 600 }, TR = low ? 210 : 360;
  const mk = (geo, cap) => { const m = new THREE.InstancedMesh(geo, MATS.toon, cap); m.count = 0; m.frustumCulled = false; m.castShadow = !low; root.add(m); return m; };
  const imTree = mk(tree, CAP.t), imPalm = mk(palm, CAP.p), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function fill(im, list, cap, cx, cz, R) {
    const near = []; for (const t of list) { const d = (t[0] - cx) ** 2 + (t[2] - cz) ** 2; if (d < R * R && (R > 1000 || d > 330)) near.push([d, t]); } // never a trunk in the camera's face
    near.sort((a, b) => a[0] - b[0]); const n = Math.min(cap, near.length);
    for (let i = 0; i < n; i++) { const t = near[i][1], s = 0.8 + t[3] * 1.6; _q.setFromAxisAngle(_up, t[3] * 40); _s.set(s, s * (0.9 + t[3] * 0.4), s); _p.set(t[0], t[1] - 0.3, t[2]); _m.compose(_p, _q, _s); im.setMatrixAt(i, _m); }
    im.count = n; im.instanceMatrix.needsUpdate = true;
  }
  const townKit = buildTownKit(atlas.R, low).build(MATS, OUT); townKit.name = 'town_street'; isle.add(townKit);
  const water = waterMesh(); root.add(water);
  let lastT = -1, lastP = new THREE.Vector3(1e9, 0, 0);
  function update(cam, t, opts = {}) {
    allView = !!opts.all;
    for (const c of chunks) {
      const d = Math.hypot(c.cx - cam.x, c.cz - cam.z) - 160;
      if (!allView && d > VIEW_R) { c.mesh.visible = false; continue; }
      let lv = allView ? 4 : LODS[0][1]; if (!allView) for (const [r, s] of LODS) if (d >= r) lv = s;
      if (c.lod !== lv) { c.geos[lv] = c.geos[lv] || chunkGeo(c.ci, c.cj, lv); c.mesh.geometry = c.geos[lv]; c.lod = lv; }
      c.mesh.visible = true;
    }
    if (allView) { if (lastT !== -2) { fill(imTree, spots.trees, CAP.t, 0, 0, 5000); fill(imPalm, spots.palms, CAP.p, 0, 0, 5000); lastT = -2; } return; }
    if (lastT < 0 || cam.distanceTo(lastP) > 6) { fill(imTree, spots.trees, CAP.t, cam.x, cam.z, TR); fill(imPalm, spots.palms, CAP.p, cam.x, cam.z, TR); lastP.copy(cam); lastT = t; }
  }
  const stats = { buildMs: BUILD_MS, chunks: chunks.length, trees: spots.trees.length, palms: spots.palms.length, trailA: Math.round(pathLen(TRAILS.A)), trailB: Math.round(pathLen(TRAILS.B)), street: Math.round(Math.abs(STREET.z1 - STREET.z0)) };
  return { root, update, H, stats, pois: FOOT_POIS, townKit, worldKit, water, imTree, imPalm };
}

// ---------- 2D review map (canvas) ----------
export function drawMap(cv, extraPois = []) {
  const W = cv.width, Hh = cv.height, g = cv.getContext('2d'), x0 = -820, x1 = 700, z0 = -820, z1 = 780, sc = Math.min(W / (x1 - x0), Hh / (z1 - z0)), ox = (W - (x1 - x0) * sc) / 2, oz = (Hh - (z1 - z0) * sc) / 2;
  const P = (x, z) => [ox + (x - x0) * sc, oz + (z - z0) * sc];
  const img = g.createImageData(W, Hh), c = new THREE.Color();
  for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) { const x = x0 + (px - ox) / sc, z = z0 + (py - oz) / sc, i = Math.round((x - X0) / G), j = Math.round((z - Z0) / G), o = (py * W + px) * 4;
    if (i < 0 || j < 0 || i > NX || j > NZ) { img.data[o] = 30; img.data[o + 1] = 80; img.data[o + 2] = 120; img.data[o + 3] = 255; continue; }
    const h = Hg[IDX(i, j)]; if (h < -4) c.set(0x1f6e94).lerp(new THREE.Color(0x174f70), Math.min(1, (-h - 4) / 12)); else colorAt(i, j, c);
    const lake = Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r || (RVg[IDX(i, j)] < 5 && h < RVl[IDX(i, j)] + 0.5); if (lake) c.set(0x2fb8c9);
    const shade = 1 + (Hg[IDX(Math.min(NX, i + 1), j)] - h) * -0.04; img.data[o] = Math.min(255, c.r * 255 * shade); img.data[o + 1] = Math.min(255, c.g * 255 * shade); img.data[o + 2] = Math.min(255, c.b * 255 * shade); img.data[o + 3] = 255; }
  g.putImageData(img, 0, 0);
  const line = (p, col, w, dash = []) => { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash); g.beginPath(); p.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); g.setLineDash([]); };
  line(TRAILS.A, '#161616', 6); line(TRAILS.A, '#fa0d0d', 3, [10, 6]); line(TRAILS.B, '#161616', 6); line(TRAILS.B, '#ffc93c', 3, [10, 6]); line(STREETP, '#161616', 7); line(STREETP, '#e7d7b8', 4);
  g.font = 'bold 15px sans-serif'; g.textBaseline = 'middle';
  const label = (x, z, s, col = '#ffffff', dot = '#161616') => { const [a, b] = P(x, z); g.fillStyle = dot; g.beginPath(); g.arc(a, b, 6, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(a, b, 4, 0, 7); g.fill();
    g.lineWidth = 4; g.strokeStyle = '#161616'; g.strokeText(s, a + 9, b); g.fillStyle = '#ffffff'; g.fillText(s, a + 9, b); };
  for (const p of FOOT_POIS) label(p.x, p.z, p.label, '#ffc93c');
  for (const p of extraPois) label(p.x, p.z, p.label, p.col || '#60a5fa');
  const [tx, tz] = P(TOWN.x, TOWN.z); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.arc(tx, tz, 104 * sc, 0, 7); g.stroke();
  g.font = 'bold 22px sans-serif'; g.lineWidth = 5; const T = (s, x, z) => { const [a, b] = P(x, z); g.strokeText(s, a, b); g.fillText(s, a, b); };
  g.fillStyle = '#ffffff'; T('DOCK TOWN (harbor view island)', TOWN.x - 150, TOWN.z + 130); T('TRAIL A', -60, -455); T('TRAIL B', 170, 470);
  g.font = 'bold 26px sans-serif'; T('PUMPFUN PIRATES · on-foot island (blockout)', -800, -790);
  g.font = '15px sans-serif'; g.lineWidth = 4;
  const st = [`Trail A loop ${Math.round(pathLen(TRAILS.A))} m · Trail B loop ${Math.round(pathLen(TRAILS.B))} m · main street ${Math.abs(STREET.z1 - STREET.z0)} m`,
    `N-S ${Math.round(1275)} m (~5 min @4.2 m/s) · W-E ~1030 m (~4 min) · grid 4 m, 5x5 chunks`];
  st.forEach((s, i) => T(s, -800, 720 + i * 24));
  const [sa, sb] = P(420, 740), [sc2] = P(620, 740); g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.moveTo(sa, sb); g.lineTo(sc2, sb); g.stroke(); g.fillStyle = '#fff'; g.fillText('200 m', sa + 70, sb - 14);
}
