// [Raul] PUMPFUN PIRATES on-foot island (PHASE 1 BLOCKOUT, layout review only). Loaded with island.html?foot=1 (dynamic
// import: the harbor / ship view never downloads or renders it). Two scales: from the ships you see the compact dock-town
// island (6 piers, 18 berths, arena untouched); step off and the dock town is the tip of a headland on a massive jungle
// island (~1.0 x 1.3 km, a few minutes to cross at 4.2 m/s). Heightmap (4 m grid) -> 5 x 5 chunks x 3 LODs streamed by
// camera distance + fog; jungle is instanced and streamed (nearest N trees). World frame: island centre (0,0), north = -z.
import * as THREE from 'three';
import { Kit, M } from './kit.js';
import { groundY } from './art.js';
import { buildBirds, buildCrabs, buildFlames, buildNets, grassMaterial, islandSurface } from './look.js';
import { toon } from '../toon.js';
import { kitMesh, pickHouse, HOUSE_VARIANTS } from './townkit.js';
import * as CO from './coast.js';
const COASTM = CO.COAST_ON;
export { CO }; // ?coast=1: town + berths built into the main island's west coast (js/island/coast.js); no round dock island
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildLighthouse, tickLighthouse } from '../lighthouseKit.js';

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
// [v105] coast mode: the west leg used to run ~500 m through the sea inlet (-280..0, 100..510); it now follows the inlet's east shore
const TRAIL_B = [[-120, -40], ...(COASTM ? [[-150, 60], [-140, 170], [-100, 290], [-30, 400], [20, 500]] : [[-210, 60], [-282, 150], [-200, 290], [-60, 420]]), [40, 540], [150, 420], [232, 252], [196, 150], [130, 150], [40, 60], [-30, -10]];
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
  if (COASTM) { const [lx, lz] = CO.w2t(x, z), rag = 1 - sm(-330, -300, lx) * (1 - sm(110, 140, lx)) * sm(-60, -20, lz);   // straight quay, ragged elsewhere
    d = Math.min(d, polySD(lx, lz, CO.APRON) + rag * (7 * Math.sin(x * 0.03 + z * 0.017) + 4 * Math.sin(x * 0.07 - z * 0.05)));
    d = Math.min(d, Math.hypot(lx - CO.ISLET.lx, lz - CO.ISLET.lz) - CO.ISLET.r * (0.8 + 0.4 * vnoise(x * 0.05, z * 0.05))); }
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
const G = 4, X0 = COASTM ? -940 : -820, Z0 = -820, NX = COASTM ? 410 : 380, NZ = 400;                               // x -820..700, z -820..780
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
export const SKULL = { x: PEAK.x, z: PEAK.z - 62 }; SKULL.y = rawH(SKULL.x, SKULL.z, coastSD(SKULL.x, SKULL.z)); // treasure-cave floor pad
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
    const ys = COASTM ? CO.QUAY.y + 0.4 + Math.max(0, -lz - 50) * 0.11 : 3.6 + Math.max(0, -lz + STREET.z0) * 0.035, w = 1 - sm(STREET.half + 12, STREET.half + 26, sx), along = sm(STREET.z1 - 30, STREET.z1, lz);
    const flat = STREET.half + 14 + Math.min(45, Math.max(0, -lz - 105) * 0.6), bridge = sx < flat ? ys : ys - (sx - flat) * 0.9;     // the land bridge's own shoulders
    h = lz > STREET.z1 ? Math.max(h, bridge) * (1 - w) + ys * w : h * (1 - along * w) + Math.max(h, ys) * along * w;
  }
  // the dock town keeps its own terrain disc: the big terrain sits just under it (no seams, no z-fight)
  if (COASTM) coastH(); else { const rT = Math.hypot(lx, lz); if (rT < 104) { const gy = groundY(lx, lz) - 0.6; h = rT < 90 ? Math.max(Math.min(h, gy), lz < -50 && sx < STREET.half + 14 ? h : gy) : Math.max(h, gy); } }
  function coastH() { // [coast] stone quay + plaza flat, mole, cliff headland, fort knoll
    const e = sm(-64, -52, lz) * sm(CO.PLAZA.lx0 - 12, CO.PLAZA.lx0, lx) * (1 - sm(CO.PLAZA.lx1, CO.PLAZA.lx1 + 12, lx));
    if (lz <= 0.5) h = h * (1 - e) + CO.QUAY.y * e;
    if (lz > 0.5 && lx > -320 && lx < 132 && sd > 0) h = Math.min(h, -3.5 - Math.min(lz, 60) * 0.12);   // dredged harbor: berths + quay stay deep
    if ((Math.abs(lx - CO.MOLE.lx) < CO.MOLE.w / 2 + 1 && lz > -2 && lz < CO.MOLE.lz1) || Math.hypot(lx - CO.MOLE.lx, lz - CO.MOLE.lz1) < CO.MOLE.tipR) h = CO.MOLE.y;
    const hd = Math.hypot(lx - CO.HEADLAND.lx, lz - CO.HEADLAND.lz); if (sd < 0) h = Math.max(h, CO.HEADLAND.top * (1 - sm(CO.HEADLAND.r * 0.6, CO.HEADLAND.r * 1.5, hd)) * sm(-2, 6, -sd));
    const fd = Math.hypot(lx - CO.FORT.lx, lz - CO.FORT.lz); if (fd < CO.FORT.r * 2.8) h = Math.max(h, CO.FORT.top * (1 - sm(CO.FORT.r, CO.FORT.r * 2.8, fd)));
  }
  const sk = Math.hypot(x - SKULL.x, z - (SKULL.z + 8)); if (sk < 32) h = h + (SKULL.y - h) * (1 - sm(19, 32, sk));
  Hg[q] = h;
}
// [v105] rope bridge approaches: the gorge walls ran up past the deck ends (a 4:1 wall = no way on or off). Carve a 5 m ramp cut
// (grade 0.5) into each wall along the bridge axis, so trail A walks straight onto the deck and off the far side.
const BRIDGE_ENDS = [];
{ const c = ROPE_BRIDGE.c, deckY = H(c[0], c[1]) + 24, out = (dz) => { let z = c[1]; while (H(c[0], z) < deckY && Math.abs(z - c[1]) < 90) z += dz; return z; };
  const za = out(-1), zb = out(1);
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = X0 + i * G, z = Z0 + j * G, ax = Math.abs(x - c[0]); if (ax > 6) continue;
    const along = z < za ? za - z : z > zb ? z - zb : -1; if (along < 0 || along > 60) continue;
    const q = IDX(i, j), tgt = deckY - 0.1 + along * 0.5, w = 1 - sm(3, 6, ax); if (Hg[q] > tgt) Hg[q] += (tgt - Hg[q]) * w; }
  BRIDGE_ENDS.push([c[0], za], [c[0], zb]); }
// [v105] carved ramps: the reachability check (js/dev/reach.js) found one walkable shelf cut off by steep faces on every side (the
// river bank inside the gorge, ~540 m², 16 m up); this ramp (grade 0.67) leads down onto it from trail A's side. Each is cut / filled to a straight
// grade (≤ 0.7) 5 m wide, 3 m past each end, and painted + kept clear like a trail. [fromX, fromZ, toX, toZ] foot frame.
export const RAMPS = [[-116, -108, -104, -100]]
  .map(([ax, az, bx, bz]) => { const L0 = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L0, uz = (bz - az) / L0, e = 3;
    const a = [ax - ux * e, az - uz * e], b = [bx + ux * e, bz + uz * e]; return { ax: a[0], az: a[1], bx: b[0], bz: b[1], ay: H(...a), by: H(...b), L: L0 + 2 * e, ux, uz }; });
for (const r of (typeof location !== 'undefined' && /[?&]ramps=0/.test(location.search)) ? [] : RAMPS) { const pts = [[r.ax, r.az], [r.bx, r.bz]];
  const i0 = Math.max(0, Math.floor((Math.min(r.ax, r.bx) - 6 - X0) / G)), i1 = Math.min(NX, Math.ceil((Math.max(r.ax, r.bx) + 6 - X0) / G));
  const j0 = Math.max(0, Math.floor((Math.min(r.az, r.bz) - 6 - Z0) / G)), j1 = Math.min(NZ, Math.ceil((Math.max(r.az, r.bz) + 6 - Z0) / G));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const [d, t] = segD(X0 + i * G, Z0 + j * G, r.ax, r.az, r.bx, r.bz), q = IDX(i, j); if (d > 5) continue;
    const w = 1 - sm(2.5, 5, d); Hg[q] += (r.ay + (r.by - r.ay) * t - Hg[q]) * w; TRg[q] = Math.min(TRg[q], d); } }
// [v105] on-foot walk rules (navigability pass): uphill grade limit (rise / run), tree + rock colliders. ?slope=1.2 / ?trees=0 for tests
const QS = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const WALK_RULES = { slope: +(QS.get('slope') || 1.25), trees: QS.get('trees') !== '0' };
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


// ---------- terrain splat weights (8 layers: sand, wet, grass, dirt | rock, cliff, cobble, jungle floor) ----------
function slopeAt(i, j) { const hx = Hg[IDX(Math.min(NX, i + 1), j)] - Hg[IDX(Math.max(0, i - 1), j)], hz = Hg[IDX(i, Math.min(NZ, j + 1))] - Hg[IDX(i, Math.max(0, j - 1))]; return Math.hypot(hx, hz) / (2 * G); }
function splatAt(i, j, w) {
  const q = IDX(i, j), h = Hg[q], x = X0 + i * G, z = Z0 + j * G, sl = slopeAt(i, j);
  w.fill(0); w[2] = 1;
  const paint = (L, a) => { if (a <= 0.001) return; a = Math.min(1, a); for (let k = 0; k < 8; k++) w[k] *= 1 - a; w[L] += a; };
  const jm = fbm(x * 0.01 + 7, z * 0.01, 3);
  paint(7, sm(0.4, 0.58, jm) * sm(5, 12, h));
  paint(0, 1 - sm(2.3, 3.9, h));
  paint(1, sm(1.4, 0.5, h) * sm(-3, -0.6, h));
  if (RVg[q] < 12 && h < RVl[q] + 2.5) paint(1, 0.85 * sm(12, 6, RVg[q]));
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 8) paint(1, 0.8 * sm(LAKE.r + 8, LAKE.r, Math.hypot(x - LAKE.x, z - LAKE.z)));
  paint(3, 1 - sm(2.0, 4.3, TRg[q]));
  paint(4, sm(0.7, 1.05, sl) + sm(75, 105, h) * 0.7);
  paint(5, sm(1.05, 1.5, sl));
  paint(6, 1 - sm(STREET.half + 1.6, STREET.half + 3.2, STg[q])); // cobbles run right up to the house fronts
  const sk = Math.hypot(x - SKULL.x, z - (SKULL.z + 8)); if (sk < 24) paint(4, 1 - sm(14, 24, sk));
  return w;
}
// ---------- chunked terrain (5 x 5 chunks, LOD steps 4 / 8 / 16 m, skirts hide LOD cracks) ----------
const CH = 80; // cells per chunk side (320 m)
// every normal unit length and finite: degenerate / zero / NaN normals fall back to straight up (0,1,0)
export function safeNormals(g) { const a = g.attributes.normal; if (!a) return g; const N = a.array;
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]); if (!(l > 1e-6)) { N[i] = 0; N[i + 1] = 1; N[i + 2] = 0; } else if (Math.abs(l - 1) > 1e-4) { N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; } }
  a.needsUpdate = true; return g; }
const _w8 = new Float32Array(8);
const SPLAT_C = [0xf2d9a0, 0xb8975f, 0x7cc94e, 0xb98b55, 0x939089, 0x9a8c7b, 0xb3a690, 0x4a8a34].map(h => new THREE.Color(h)), GRASS_V = [0x7cc94e, 0x9bd65a, 0x5fae42].map(h => new THREE.Color(h));
export function chunkGeo(ci, cj, step) {
  const i0 = ci * CH, j0 = cj * CH, i1 = Math.min(NX, i0 + CH), j1 = Math.min(NZ, j0 + CH), nx = Math.ceil((i1 - i0) / step) + 1, nz = Math.ceil((j1 - j0) / step) + 1;
  const pos = [], col = [], w0 = [], w1 = [], idx = [], at = (a, b) => [Math.min(i1, i0 + a * step), Math.min(j1, j0 + b * step)];
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) { const [i, j] = at(a, b), x = X0 + i * G, z = Z0 + j * G; pos.push(x, Hg[IDX(i, j)], z);
    splatAt(i, j, _w8); w0.push(_w8[0], _w8[1], _w8[2], _w8[3]); w1.push(_w8[4], _w8[5], _w8[6], _w8[7]);
    const mm = 0.9 + 0.2 * fbm(x * 0.017 + 3, z * 0.017, 3), gv = fbm(x * 0.03, z * 0.03 + 5, 2); let r = 0, g = 0, bl = 0;
    for (let k = 0; k < 8; k++) { const c = k === 2 ? GRASS_V[gv > 0.55 ? 1 : gv < 0.42 ? 2 : 0] : SPLAT_C[k]; r += c.r * _w8[k]; g += c.g * _w8[k]; bl += c.b * _w8[k]; }
    const deep = sm(-0.5, -6, Hg[IDX(i, j)]); col.push(r * mm * (1 - deep * 0.35), g * mm * (1 - deep * 0.15), bl * mm * (1 - deep * 0.05)); }
  for (let b = 0; b < nz - 1; b++) for (let a = 0; a < nx - 1; a++) { const p = b * nx + a; idx.push(p, p + nx, p + 1, p + 1, p + nx, p + nx + 1); }
  const cp = (arr, p, n) => arr.push(...arr.slice(p * n, p * n + n));
  const surf = idx.length, skirt = []; // skirt verts copy their top vertex normal (double-sided skirt tris cancel to a zero normal -> NaN -> black bloom)
  const edge = (list) => { for (let k = 0; k < list.length - 1; k++) { const p = list[k], r = list[k + 1], n = pos.length / 3; skirt.push(n, p, n + 1, r);
    pos.push(pos[p * 3], pos[p * 3 + 1] - 6, pos[p * 3 + 2], pos[r * 3], pos[r * 3 + 1] - 6, pos[r * 3 + 2]); cp(col, p, 3); cp(col, r, 3); cp(w0, p, 4); cp(w0, r, 4); cp(w1, p, 4); cp(w1, r, 4);
    idx.push(p, r, n, r, n + 1, n, p, n, r, r, n, n + 1); } };
  const row = (b) => Array.from({ length: nx }, (_, a) => b * nx + a), colm = (a) => Array.from({ length: nz }, (_, b) => b * nx + a);
  edge(row(0)); edge(row(nz - 1)); edge(colm(0)); edge(colm(nx - 1));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aMat', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(13), 1)); // look.js on-foot splat
  g.setAttribute('aW0', new THREE.Float32BufferAttribute(w0, 4)); g.setAttribute('aW1', new THREE.Float32BufferAttribute(w1, 4));
  g.setIndex(idx.slice(0, surf)); g.computeVertexNormals(); const N = g.attributes.normal.array;
  for (let k = 0; k < skirt.length; k += 2) { const d = skirt[k] * 3, sr = skirt[k + 1] * 3; N[d] = N[sr]; N[d + 1] = N[sr + 1]; N[d + 2] = N[sr + 2]; }
  g.setIndex(idx); safeNormals(g); g.computeBoundingSphere(); return g;
}

// ---------- shoreline: turquoise shallows + breaking foam over the whole coast (1 call, rides the ocean swell) ----------
function heightTexture() { const d = new Uint8Array((NX + 1) * (NZ + 1));
  for (let k = 0; k < d.length; k++) d[k] = Math.max(0, Math.min(255, (Hg[k] + 30) / 70 * 255));
  const t = new THREE.DataTexture(d, NX + 1, NZ + 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; }
const WAVE_GLSL = `uniform vec4 uWaves[4]; float waveY(vec2 p, float t) { float h = 0.0; for (int i = 0; i < 4; i++) { float k = uWaves[i].w; h += uWaves[i].z * sin(k * dot(uWaves[i].xy, p) - sqrt(9.8 * k) * t); } return h; }`;
function shallows(uTime, uWaves, low, hTex) {
  const W = NX * G, D = NZ * G, g = new THREE.PlaneGeometry(W, D, low ? 90 : 128, low ? 95 : 134); g.rotateX(-Math.PI / 2); g.translate(X0 + W / 2, 0, Z0 + D / 2);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uH: { value: hTex }, uWaves: { value: [] }, uTime: { value: 0 }, uTown: { value: COASTM ? new THREE.Vector2(1e5, 1e5) : new THREE.Vector2(TOWN.x, TOWN.z) }, uGrid: { value: new THREE.Vector4(X0, Z0, W, D) } }]),
    vertexShader: `${WAVE_GLSL} uniform float uTime; uniform vec4 uGrid; varying vec2 vUv; varying vec3 vP;
      #include <fog_pars_vertex>
      void main(){ vec3 p = position; p.y = waveY(p.xz, uTime) + 0.45; vP = p; vP.y -= 0.37; vUv = (p.xz - uGrid.xy) / uGrid.zw; vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D uH; uniform float uTime; uniform vec2 uTown; varying vec2 vUv; varying vec3 vP;
      #include <common>
      #include <fog_pars_fragment>
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        if (length(vP.xz - uTown) < 106.0) discard;
        float h = texture2D(uH, vUv).r * 70.0 - 30.0, depth = vP.y - h;
        if (depth < -0.05 || h < -18.0) discard;
        float n = vn(vP.xz * 0.15 + uTime * 0.05) * 0.6 + vn(vP.xz * 0.6 - uTime * 0.1) * 0.4;
        vec3 shallow = vec3(0.36, 0.9, 0.86), mid = vec3(0.12, 0.66, 0.74);
        vec3 col = mix(shallow, mid, smoothstep(0.5, 7.0, depth));
        float caus = pow(abs(sin(vP.x * 0.5 + uTime * 0.7 + sin(vP.z * 0.3)) * sin(vP.z * 0.45 - uTime * 0.6 + sin(vP.x * 0.27))), 6.0) * smoothstep(5.0, 0.5, depth);
        col += caus * 0.25;
        float a = smoothstep(18.0, 5.0, -h) * 0.94; // near-opaque over the shelf so the ocean / terrain facets never show through
        // foam: solid lip at the waterline + bands rolling in on the swell
        float lip = smoothstep(0.55, 0.0, depth + (n - 0.5) * 0.35);
        float band = smoothstep(0.65, 1.0, sin(depth * 2.6 - uTime * 1.6 + n * 3.0)) * smoothstep(3.2, 0.4, depth) * (0.4 + 0.6 * n);
        float foam = clamp(lip + band * 0.8, 0.0, 1.0);
        col = mix(col, vec3(1.0), foam); a = max(a, foam * 0.95);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` });
  m.uniforms.uWaves = uWaves; m.uniforms.uTime = uTime;
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 3; mesh.frustumCulled = false; mesh.name = 'foot_shallows'; return mesh;
}

// ---------- fresh water: river ribbon + lake (flowing foam streaks), waterfall sheet, mist ----------
function freshWater(uTime, low) {
  const pos = [], fl = [];
  const L = pathLen(RIVERP); let s = 0;
  for (let i = 0; i < RIVERP.length - 1; i++) { const [ax, az] = RIVERP[i], [bx, bz] = RIVERP[i + 1], sl = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / sl, nz = (bx - ax) / sl, w = 6;
    const ya = LAKE.y * (1 - s / L) - 1.2 * (s / L) + 0.2, yb = LAKE.y * (1 - (s + sl) / L) - 1.2 * ((s + sl) / L) + 0.2;
    const q = [[ax + nx * w, ya, az + nz * w, s, 1], [bx + nx * w, yb, bz + nz * w, s + sl, 1], [ax - nx * w, ya, az - nz * w, s, -1], [bx - nx * w, yb, bz - nz * w, s + sl, -1]];
    for (const k of [0, 1, 2, 2, 1, 3]) { pos.push(q[k][0], q[k][1], q[k][2]); fl.push(q[k][3], q[k][4], 0); } s += sl; }
  for (let i = 0; i < 48; i++) { const a0 = i / 48 * Math.PI * 2, a1 = (i + 1) / 48 * Math.PI * 2, r = LAKE.r + 3;
    pos.push(LAKE.x, LAKE.y + 0.05, LAKE.z, LAKE.x + Math.cos(a1) * r, LAKE.y + 0.05, LAKE.z + Math.sin(a1) * r, LAKE.x + Math.cos(a0) * r, LAKE.y + 0.05, LAKE.z + Math.sin(a0) * r);
    fl.push(0, 0, 1, r, 0, 1, r, 0, 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(fl, 3));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLake: { value: new THREE.Vector3(LAKE.x, LAKE.z, LAKE.r) } }]),
    vertexShader: `attribute vec3 aFlow; varying vec3 vF; varying vec3 vP;
      #include <fog_pars_vertex>
      void main(){ vF = aFlow; vP = position; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uLake; varying vec3 vF; varying vec3 vP;
      #include <common>
      #include <fog_pars_fragment>
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec3 deep = vec3(0.1, 0.55, 0.62), lite = vec3(0.32, 0.82, 0.8); vec3 col; float a = 0.88, foam = 0.0;
        if (vF.z < 0.5) { float along = vF.x, across = vF.y; float st = vn(vec2(along * 0.25 - uTime * 2.2, across * 3.0)) * vn(vec2(along * 0.08 - uTime * 0.9, across * 1.3 + 4.0));
          foam = smoothstep(0.32, 0.6, st) * 0.7 + smoothstep(0.7, 1.0, abs(across)) * 0.8; col = mix(deep, lite, 0.4 + 0.3 * abs(across)); }
        else { float r = length(vP.xz - uLake.xy) / uLake.z; float rip = sin(r * 40.0 - uTime * 1.5) * 0.5 + 0.5;
          foam = smoothstep(0.93, 1.0, r) * 0.8 + rip * smoothstep(0.5, 0.0, length(vP.xz - vec2(uLake.x - 2.0, uLake.y - uLake.z + 6.0)) / uLake.z) * 0.7;
          col = mix(lite, deep, smoothstep(0.2, 0.9, 1.0 - r)); col += vn(vP.xz * 0.3 + uTime * 0.1) * 0.06; }
        col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0)); gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` });
  m.uniforms.uTime = uTime;
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 3; mesh.name = 'foot_freshwater'; return mesh;
}
function waterfall(uTime, top, low) { // curved sheet: lip at the cliff top, falls into the lagoon
  const fx = FALLS_CLIFF.x + 6, fz = LAKE.z - LAKE.r + 2, hgt = top - LAKE.y + 1, g = new THREE.PlaneGeometry(11, hgt, 8, 16), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const v = (P.getY(i) + hgt / 2) / hgt; P.setZ(i, (v > 0.92 ? (v - 0.92) * -20 : 0) + (1 - v) * 3.0); }
  g.translate(0, hgt / 2, 0); g.computeVertexNormals();
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
      void main(){ float s = vn(vec2(vUv.x * 14.0, vUv.y * 6.0 + uTime * 3.2)) * 0.6 + vn(vec2(vUv.x * 30.0, vUv.y * 12.0 + uTime * 5.0)) * 0.4;
        vec3 col = mix(vec3(0.45, 0.85, 0.9), vec3(1.0), smoothstep(0.35, 0.75, s) + smoothstep(0.2, 0.0, vUv.y) * 0.8);
        float a = (0.6 + 0.4 * s) * smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  m.uniforms.uTime = uTime;
  const sheet = new THREE.Mesh(g, m); sheet.position.set(fx, LAKE.y - 0.5, fz - 4); sheet.renderOrder = 4;
  // mist + splash (points)
  const N = low ? 40 : 120, pp = new Float32Array(N * 3), sd = new Float32Array(N);
  for (let i = 0; i < N; i++) { pp[i * 3] = (Math.random() - 0.5) * 12; pp[i * 3 + 2] = Math.random() * 6; sd[i] = Math.random(); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const mist = new THREE.Points(pg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: uTime },
    vertexShader: `attribute float aSeed; uniform float uTime; varying float vA; void main(){ float t = fract(uTime * 0.35 + aSeed); vec3 p = position; p.y += t * 7.0; p.x *= 1.0 + t; vA = sin(t * 3.14159) * 0.5;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (40.0 + 60.0 * aSeed) * (30.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0), smoothstep(0.5, 0.0, d) * vA); }' }));
  mist.position.set(fx, LAKE.y, fz - 2); mist.renderOrder = 5; mist.frustumCulled = false;
  return [sheet, mist];
}

// ---------- foliage: instanced + streamed (nearest N to the camera), wind sway in the vertex shader ----------
// parts: [geometry, hex, look material id, sway(fn y,x,z -> 0..)] -> one non-indexed geometry with color / aMat / aSway
function partsGeo(parts) {
  const pos = [], nrm = [], col = [], mat = [], sw = [], c = new THREE.Color();
  for (const [g0, hex, mid, swf] of parts) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); c.set(typeof hex === 'function' ? hex(x, y, z) : hex);
      pos.push(x, y, z); nrm.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); mat.push(mid); sw.push(swf ? swf(x, y, z) : 0); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aMat', new THREE.Float32BufferAttribute(mat, 1)); g.setAttribute('aSway', new THREE.Float32BufferAttribute(sw, 1)); return g;
}
const jitter = (g, k, seed) => { const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), n = 1 + k * (Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 2) * Math.sin(z * 3.3 + seed)); P.setXYZ(i, x * n, y * n, z * n); } return g; };
function treeGeos(low) {
  // jungle broadleaf: flared, bent trunk + a cluster of lumpy canopy blobs (two greens) + hanging vines on High
  const tp = [], seg = low ? 5 : 7;
  for (let k = 0; k < 3; k++) { const t = new THREE.CylinderGeometry(0.42 - k * 0.1, 0.62 - k * 0.1, 2.6, seg); t.translate(k * 0.18, 1.3 + k * 2.4, 0); tp.push([t, 0x6b4a30, 5, (x, y) => Math.max(0, (y - 2) / 7) * 0.5]); }
  for (let r = 0; r < 4; r++) { const root = new THREE.ConeGeometry(0.35, 1.6, 4); root.rotateZ(Math.PI / 2 - 0.5); root.translate(0.6, 0.35, 0); root.rotateY(r * Math.PI / 2 + 0.4); tp.push([root, 0x5d3f28, 5, null]); }
  const blobs = low ? [[0, 8.6, 0, 3.4], [1.9, 7.6, 0.9, 2.5], [-1.7, 7.8, -0.8, 2.6]] : [[0, 8.8, 0, 3.5], [2.0, 7.7, 0.9, 2.6], [-1.8, 7.9, -1.0, 2.7], [0.4, 10.3, -0.6, 2.4], [-0.6, 7.2, 1.9, 2.2], [1.0, 7.4, -2.0, 2.1]];
  blobs.forEach(([x, y, z, r], i) => { const b = jitter(new THREE.IcosahedronGeometry(r, low ? 1 : 1), 0.16, i * 3.1); b.translate(x, y, z); tp.push([b, (bx, by) => (by > y + r * 0.2 ? 0x5fb84a : i % 2 ? 0x2f8a36 : 0x3c9a3e), 6, (bx, by) => Math.max(0, (by - 5) / 6)]); });
  if (!low) for (let v = 0; v < 3; v++) { const vn = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 3); vn.translate(-1.5 + v * 1.4, 5.7, 1.3 - v * 0.9); tp.push([vn, 0x3d7a2a, 6, (x, y) => Math.max(0, (7.3 - y) / 3) * 1.5]); }
  const tree = partsGeo(tp);
  // palm: curved ringed trunk + drooping two-tone fronds + coconuts (fronds sway hardest)
  const pp = [], H = 10, lean = 1.6, n = low ? 5 : 8, cv = (t) => [lean * t * t * 2.2, t * H];
  for (let i = 0; i < n; i++) { const [ax, ay] = cv(i / n), [bx, by] = cv((i + 1) / n), L = Math.hypot(bx - ax, by - ay), g = new THREE.CylinderGeometry(0.3 - 0.12 * (i + 1) / n, 0.38 - 0.12 * i / n, L * 1.05, seg);
    g.rotateZ(-Math.atan2(bx - ax, by - ay)); g.translate((ax + bx) / 2, (ay + by) / 2, 0); pp.push([g, i % 2 ? 0x9a6b3e : 0x84592f, 5, (x, y) => (y / H) * 0.4]); }
  const [tx, ty] = cv(1), NF = low ? 6 : 9;
  for (let k = 0; k < NF; k++) { const L = 5.6, g = new THREE.PlaneGeometry(L, 1.6, low ? 4 : 7, 2); g.translate(L / 2, 0, 0); g.rotateX(-Math.PI / 2); const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const u = P.getX(i) / L, w = P.getZ(i); P.setZ(i, w * (1.15 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)), 0.6) + 0.05)); P.setY(i, 1.1 * u - 2.6 * u * u - Math.abs(w) * 0.35); }
    g.rotateY(k / NF * Math.PI * 2 + (k % 2) * 0.2); g.translate(tx, ty, 0); pp.push([g, k % 2 ? 0x3fae44 : 0x63c64e, 6, (x, y, z) => 0.4 + Math.min(2.2, Math.hypot(x - tx, z) / 2.5)]); }
  for (let c2 = 0; c2 < 3; c2++) { const s = new THREE.SphereGeometry(0.32, 6, 4); s.translate(tx + Math.cos(c2 * 2.1) * 0.35, ty - 0.4, Math.sin(c2 * 2.1) * 0.35); pp.push([s, 0x6b4a22, 0, () => 0.4]); }
  const palm = partsGeo(pp);
  // jungle undergrowth: fern fan + a big-leaf plant
  const fp = [];
  for (let k = 0; k < (low ? 5 : 8); k++) { const L = 1.9, g = new THREE.PlaneGeometry(L, 0.6, 3, 1); g.translate(L / 2, 0, 0); g.rotateX(-Math.PI / 2); const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const u = P.getX(i) / L; P.setZ(i, P.getZ(i) * Math.sin(Math.PI * Math.min(1, u + 0.1))); P.setY(i, 1.2 * u - 1.3 * u * u + 0.15); }
    g.rotateY(k / (low ? 5 : 8) * Math.PI * 2); fp.push([g, k % 2 ? 0x3a9a3a : 0x2c7d30, 6, (x, y, z) => Math.hypot(x, z) / 1.9]); }
  const fern = partsGeo(fp);
  const rock = partsGeo([[jitter(new THREE.IcosahedronGeometry(1, low ? 0 : 1), 0.22, 4), (x, y) => (y > 0.3 ? 0xa59d92 : 0x7d766e), 3, null]]);
  for (const g of [tree, palm, fern, rock]) safeNormals(g);
  return { tree, palm, fern, rock };
}
// instanced foliage material: look.js surface (textured, bump on High) + per-instance-phase sway (aSway weight)
function foliageMat(low, uTime, cards = null) {
  const m = islandSurface(toon(0xffffff, null, { vertexColors: true }), { low, cards }), base = m.onBeforeCompile;
  if (cards) m.userData.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: cards, alphaTest: 0.5 }); // cut-out shadows
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = (s) => { base(s); s.uniforms.uTime = uTime;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aSway;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        { vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]); float ph = ip.x * 0.11 + ip.z * 0.07; float w = aSway * aSway;
          float gust = 0.6 + 0.4 * sin(uTime * 0.35 + ip.x * 0.01);
          transformed.x += (sin(uTime * 1.3 + ph) * 0.22 + sin(uTime * 2.9 + ph * 2.0) * 0.06) * w * gust; transformed.z += cos(uTime * 1.05 + ph * 1.3) * 0.16 * w * gust; transformed.y += sin(uTime * 2.1 + ph) * 0.05 * w; }
        #endif`); };
  m.customProgramCacheKey = () => 'foot_foliage_' + (low ? 'l' : 'h') + (cards ? 'c' : '');
  return m;
}
function foliageSpots() {
  const trees = [], palms = [], ferns = [], rocks = [], cliffs = [];
  // POI vistas stay open: a band along the camera -> POI line, widened into a cone in front of the camera (no canopy in the lens)
  const views = FOOT_POIS.filter(p => p.view).map(p => { const dx = p.x - p.view[0], dz = p.z - p.view[2], L = Math.hypot(dx, dz); return { x: p.view[0], z: p.view[2], ux: dx / L, uz: dz / L, L }; });
  const inView = (x, z) => views.some(v => { const ax = x - v.x, az = z - v.z, al = ax * v.ux + az * v.uz, lat = Math.abs(ax * v.uz - az * v.ux);
    return al > -8 && al < v.L + 10 && (lat < 14 || (al < 60 && lat < 8 + al * 0.8)); });
  for (let j = 1; j < NZ; j += 2) for (let i = 1; i < NX; i += 2) {
    const x = X0 + i * G + (hash(i, j) - 0.5) * 7, z = Z0 + j * G + (hash(j, i) - 0.5) * 7, h = H(x, z), q = IDX(i, j), r = hash(i * 3.1, j * 1.7);
    if (h < 0.9) continue; const [lx, lz] = worldToTown(x, z); if (Math.hypot(lx, lz) < 110) continue;
    if (STg[q] < 26 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4 || RVg[q] < 7) continue;
    const sl = slopeAt(i, j);
    if (FOOT_POIS.some(p => Math.hypot(p.x - x, p.z - z) < (p.clear || 22))) continue;
    if (sl > 0.95 && TRg[q] > 9) { if (r < 0.2 && !inView(x, z)) cliffs.push([x, h, z, r]); else if (r < 0.3) rocks.push([x, h, z, r]); continue; }
    if (inView(x, z)) { if (r < 0.1 && TRg[q] > 6) ferns.push([x, h, z, r]); continue; }
    if (Math.hypot(x - SKULL.x, z - SKULL.z - 6) < 34) continue;
    if (TRg[q] < 10) { if (TRg[q] > 4.5 && r < 0.18) ferns.push([x, h, z, r]); continue; }
    if (h < 2.6) { if (r < 0.05) rocks.push([x, h, z, r]); continue; }
    if (sl > 0.85 || h > 105) { if (r < 0.1) rocks.push([x, h, z, r]); continue; }
    const jm = fbm(x * 0.01 + 7, z * 0.01, 3);
    if (h < 6.5 && SDg[q] > -70) { if (r < 0.45) palms.push([x, h, z, r]); else if (r < 0.52) rocks.push([x, h, z, r]); }
    else if (r < 0.15 + 0.8 * sm(0.36, 0.56, jm)) { trees.push([x, h, z, r]); if (hash(i, j * 2.3) < 0.8) ferns.push([x + 3 * (hash(i, 7) - 0.5) * 2, H(x + 2, z + 2), z + 3, hash(j, 5)]); }
    else if (r < 0.5) ferns.push([x, h, z, r]);
  }
  return { trees, palms, ferns, rocks, cliffs };
}
// grass tufts + flowers near the camera (deterministic per 1.7 m cell, rebuilt as you move)
function grassGeos() {
  const blades = [], c1 = new THREE.Color(0x4f9a36), c2 = new THREE.Color(0xa6dc62);
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + hash(k, 1), r = 0.12 + hash(k, 2) * 0.22, h = 0.55 + hash(k, 3) * 0.6, bx = Math.cos(a) * r, bz = Math.sin(a) * r, lean = 0.25;
    const tx = bx + Math.cos(a) * lean, tz = bz + Math.sin(a) * lean, px = -Math.sin(a) * 0.07, pz = Math.cos(a) * 0.07;
    blades.push([bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, h, tz]); }
  const pos = [], col = []; for (const b of blades) { pos.push(...b); for (const t of [0, 0, 1]) { const c = c1.clone().lerp(c2, t); col.push(c.r, c.g, c.b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const fl = []; for (let k = 0; k < 5; k++) { const p = new THREE.CircleGeometry(0.13, 5); p.translate(0.14, 0, 0); p.rotateX(-Math.PI / 2 + 0.35); p.rotateY(k * 1.2566); p.translate(0, 0.55, 0); fl.push([p, 0xffffff, 0]); }
  const st = new THREE.CylinderGeometry(0.02, 0.025, 0.55, 3); st.translate(0, 0.27, 0); fl.push([st, 0x2f8a3a, 0]); const ce = new THREE.SphereGeometry(0.07, 5, 3); ce.translate(0, 0.58, 0); fl.push([ce, 0xffe066, 0]);
  return { grass: g, flower: partsGeo(fl) };
}
const grassOK = (x, z) => { const fx = Math.round((x - X0) / G), fz = Math.round((z - Z0) / G); if (fx < 1 || fz < 1 || fx >= NX || fz >= NZ) return 0; const q = IDX(fx, fz), h = Hg[q];
  if (h < 3.2 || TRg[q] < 3.2 || STg[q] < STREET.half + 3.5 || slopeAt(fx, fz) > 0.65 || (RVg[q] < 9) || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 2) return 0;
  const [lx, lz] = worldToTown(x, z); if (Math.hypot(lx, lz) < 100) return 0; return 1; };

// nearest sandy beach cell to a hint (dig sites)
function beachNear(x, z) { let best = [x, z], bd = 1e9;
  for (let j = 0; j <= NZ; j += 2) for (let i = 0; i <= NX; i += 2) { const q = IDX(i, j), h = Hg[q]; if (h < 1.4 || h > 3.0 || SDg[q] > -6) continue;
    const px = X0 + i * G, pz = Z0 + j * G, d = (px - x) ** 2 + (pz - z) ** 2; if (d < bd) { bd = d; best = [px, pz]; } }
  return best; }
function vantage(q, ty, up, d0, d1) { let best = null;
  for (const path of [TRAILS.A, TRAILS.B]) for (const [x, z] of path) { const d = Math.hypot(x - q.x, z - q.z); if (d < d0 || d > d1 || (best && d > best.d)) continue;
    const y0 = H(x, z) + up; let ok = true; for (let k = 1; k < 30 && ok; k++) { const f = k / 30; if (H(x + (q.x - x) * f, z + (q.z - z) * f) > y0 + (ty - y0) * f - 0.5) ok = false; }
    if (ok) best = { d, p: [x, y0, z] }; }
  return best ? best.p : [q.x + d1, H(q.x + d1, q.z) + 20, q.z]; }

// ---------- colliders (world): circles + oriented boxes, spatial hash ----------
const CIRC = [], BOXES = [], CELL = 16, HASH = new Map();
function hashAdd(o, x, z, r) { for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) { const k = i * 4096 + j; if (!HASH.has(k)) HASH.set(k, []); HASH.get(k).push(o); } }
function addCirc(x, z, r) { const o = { t: 0, x, z, r }; CIRC.push(o); hashAdd(o, x, z, r); }
function addBox(x, z, w, d, yaw) { const o = { t: 1, x, z, hx: w / 2, hz: d / 2, c: Math.cos(yaw), s: Math.sin(yaw) }; BOXES.push(o); hashAdd(o, x, z, Math.hypot(w, d) / 2); }
export const MAP_BOXES = () => BOXES; // [v106] building / wall footprints for the island map
export function hitCollider(x, z, rad = 0.45) {
  const list = HASH.get(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL)); if (!list) return false;
  for (const o of list) { if (o.t === 0) { if (Math.hypot(x - o.x, z - o.z) < o.r + rad) return true; }
    else { const dx = x - o.x, dz = z - o.z, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hx + rad && Math.abs(lz) < o.hz + rad) return true; } }
  return false; }

// ---------- buildings + props (look.js material ids: 2 wood, 3 rock, 4 roof, 5 bark, 6 leaf, 7 plaster, 8 dirt, 10 cobble, 11 stone, 12 rope/cloth) ----------
const STONE = 0xb9b2a6, STONE_D = 0x8a837a, WOOD = 0xa86a3a, WOOD_D = 0x6b4527, WOOD_L = 0xd9a36b, IRON = 0x2b2f36, GOLD = 0xffc93c, RED = 0xd8322f, CREAM = 0xfff1d2;
const PLASTER = [0xfbf1dc, 0xf3d6a4, 0xeab48e, 0xc6e2e6, 0xf4c9c4, 0xdbe9bd, 0xf7e7a8], SHUTTER = [0x2a6df4, 0x1f8a5a, 0xc0392b, 0x2b8fa3, 0x8a5a2b, 0x6a4fb3], ROOFS = [0xc8552e, 0xb8472a, 0xd2693a, 0xa94428];
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, n = 10) => new THREE.CylinderGeometry(a, b, h, n);
const W = (k, g, c, mid, m, o = true) => k.add(g, c, { m, mat: mid, outline: o });
function lampFlame(list, x, y, z) { list.push({ x, y, z }); }
// colonial timber + plaster house (front = local +z): stone plinth, plaster storeys with timber framing, framed windows with
// open shutters + sills + flower boxes, a plank door in a stone surround, balconies with balusters + brackets, tile roof with
// eaves + ridge, gable ends, chimney, door lantern; optional hanging sign (atlas, faces the street)
function colonial(k, F, x, y, z, yaw, w, d, fl, v, low, sign = null, A = null) {
  if (KP) { const sq = w >= 15, vi = sq ? -1 : pickHouse(w, fl, v), vw = sq ? 16 : HOUSE_VARIANTS[vi][0];
    kp(k, sq ? 'squadhall' : 'house' + vi, M(x, y, z, yaw, 0, 0, [w / vw, 1, sq ? 1 : d / 9]));
    if (sign && A && A[sign] && !sq) k.at(M(x, y, z, yaw), () => { W(k, box(0.1, 0.1, 1.4), IRON, 0, M(-w * 0.3, 3.9, d / 2 + 0.7), false); W(k, box(2.9, 1.15, 0.12), WOOD_D, 2, M(-w * 0.3, 3.3, d / 2 + 1.25), false);
      atlasQuad(k, 2.7, 0.95, A[sign], M(-w * 0.3, 3.3, d / 2 + 1.32)); atlasQuad(k, 2.7, 0.95, A[sign], M(-w * 0.3, 3.3, d / 2 + 1.18, Math.PI)); });
    return; }
  k.at(M(x, y, z, yaw), () => {
    const fh = 3.4, wall = PLASTER[v % PLASTER.length], sh = SHUTTER[v % SHUTTER.length], stoneGround = v % 3 === 0;
    W(k, box(w + 0.5, 1.0, d + 0.5), STONE_D, 11, M(0, 0.1, 0));
    for (let f = 0; f < fl; f++) {
      const yy = 0.6 + f * fh, ww = w + (f ? 0.5 : 0), dd = d + (f ? 0.3 : 0);
      W(k, box(ww, fh, dd), f === 0 && stoneGround ? STONE : wall, f === 0 && stoneGround ? 11 : 7, M(0, yy + fh / 2, 0));
      W(k, box(ww + 0.14, 0.32, dd + 0.14), WOOD_D, 2, M(0, yy + fh - 0.12, 0), false);
      if (f > 0) { for (const sx of [-1, 1]) W(k, box(0.3, fh, 0.3), WOOD_D, 2, M(sx * (ww / 2 - 0.05), yy + fh / 2, dd / 2 + 0.02), false);
        if (!low) for (const sx of [-1, 1]) { W(k, box(0.22, fh * 1.1, 0.12), WOOD_D, 2, M(sx * (ww / 2 + 0.07), yy + fh / 2, 0, Math.PI / 2, sx * 0.6, 0), false); } }
      const nw = Math.max(1, Math.floor(w / 3.0));
      for (let i = 0; i < nw; i++) { const wx = (i - (nw - 1) / 2) * (w / nw), fz = dd / 2;
        if (f === 0 && i === Math.floor(nw / 2)) { // door
          W(k, box(1.9, 3.0, 0.3), STONE_D, 11, M(wx, yy + 1.5, fz + 0.06), false); W(k, box(1.4, 2.5, 0.16), 0x6e4325, 2, M(wx, yy + 1.25, fz + 0.16), false);
          W(k, box(0.12, 0.12, 0.12), GOLD, 0, M(wx + 0.45, yy + 1.2, fz + 0.27), false); W(k, box(2.0, 0.25, 0.9), STONE_D, 11, M(wx, 0.62, fz + 0.45), false);
          W(k, box(0.1, 0.5, 0.3), IRON, 0, M(wx + 1.25, yy + 2.6, fz + 0.3), false); k.add(new THREE.SphereGeometry(0.2, 6, 4), 0xffd36b, { bucket: 'glow', m: M(wx + 1.25, yy + 2.4, fz + 0.45), outline: false }); continue; }
        const lit = hash(i + f * 7, v) > 0.45;
        W(k, box(1.3, 1.7, 0.18), WOOD_D, 2, M(wx, yy + 1.9, fz + 0.04), false);
        k.add(box(1.0, 1.4, 0.1), lit ? 0xffcf6b : 0x2b3d4a, lit ? { bucket: 'glow', m: M(wx, yy + 1.9, fz + 0.1), outline: false } : { m: M(wx, yy + 1.9, fz + 0.1), outline: false, mat: 0 });
        W(k, box(0.08, 1.4, 0.06), WOOD_D, 2, M(wx, yy + 1.9, fz + 0.16), false); W(k, box(1.0, 0.08, 0.06), WOOD_D, 2, M(wx, yy + 1.95, fz + 0.16), false);
        W(k, box(1.6, 0.14, 0.4), STONE_D, 11, M(wx, yy + 1.0, fz + 0.2), false);
        if (!low || i % 2 === 0) for (const s of [-1, 1]) W(k, box(0.62, 1.6, 0.07), sh, 2, M(wx + s * 0.98, yy + 1.9, fz + 0.32, s * 0.5), false);
        if (!low && f > 0 && hash(i, f + v) > 0.5) { W(k, box(1.3, 0.3, 0.35), WOOD, 2, M(wx, yy + 0.85, fz + 0.4), false);
          for (let p = 0; p < 4; p++) k.add(new THREE.IcosahedronGeometry(0.17, 0), [0xff4f6d, 0xffd43b, 0xffffff, 0xb36bff][(p + i + v) % 4], { m: M(wx - 0.45 + p * 0.3, yy + 1.08, fz + 0.4), outline: false, mat: 0 }); }
      }
      if (f > 0) { // balcony
        W(k, box(ww - 0.6, 0.2, 1.3), WOOD, 2, M(0, yy + 0.1, dd / 2 + 0.65));
        W(k, box(ww - 0.6, 0.12, 0.12), WOOD_D, 2, M(0, yy + 1.15, dd / 2 + 1.25), false);
        const step = low ? 1.1 : 0.42; for (let b = -(ww - 0.6) / 2; b <= (ww - 0.6) / 2 + 0.01; b += step) W(k, cyl(0.045, 0.05, 1.0, 5), WOOD_L, 2, M(b, yy + 0.65, dd / 2 + 1.25), false);
        for (const sx of [-1, 0, 1]) W(k, box(0.18, 0.9, 0.18), WOOD_D, 2, M(sx * (ww / 2 - 0.6), yy - 0.3, dd / 2 + 0.55, 0, 0.75), false);
      }
    }
    const top = 0.6 + fl * fh, pitch = 0.6, half = d / 2 + 0.9, slab = half / Math.cos(pitch), rise = Math.tan(pitch) * half;
    for (const s of [-1, 1]) W(k, box(w + 1.4, 0.28, slab), ROOFS[v % 4], 4, M(0, top + rise / 2, s * half / 2, 0, s * pitch));
    W(k, cyl(0.26, 0.26, w + 1.5, 6), ROOFS[(v + 1) % 4], 4, M(0, top + rise + 0.05, 0, 0, 0, Math.PI / 2), false);
    const gable = new THREE.BufferGeometry(); gable.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -d / 2 - 0.1, 0, 0, d / 2 + 0.1, 0, rise - 0.2, 0], 3)); gable.computeVertexNormals();
    for (const sx of [-1, 1]) { const g = gable.clone(); if (sx < 0) g.scale(-1, 1, 1); W(k, g, wall, 7, M(sx * (w / 2 + 0.25), top, 0, sx > 0 ? 0 : Math.PI, 0, 0, 1), false); }
    W(k, box(0.9, 2.4, 0.9), STONE, 11, M(w * 0.3, top + rise * 0.6 + 1.0, -d * 0.18)); W(k, box(1.15, 0.25, 1.15), STONE_D, 11, M(w * 0.3, top + rise * 0.6 + 2.25, -d * 0.18), false);
    if (sign && A && A[sign]) { W(k, box(0.1, 0.1, 1.4), IRON, 0, M(-w * 0.3, 3.9, d / 2 + 0.7), false); W(k, box(2.9, 1.15, 0.12), WOOD_D, 2, M(-w * 0.3, 3.3, d / 2 + 1.25), false);
      atlasQuad(k, 2.7, 0.95, A[sign], M(-w * 0.3, 3.3, d / 2 + 1.32)); atlasQuad(k, 2.7, 0.95, A[sign], M(-w * 0.3, 3.3, d / 2 + 1.18, Math.PI)); } // hanging sign: one face per side, both read right
  });
}
function atlasQuad(kit, w, h, r, m) { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0), r.v0 + uv.getY(i) * (r.v1 - r.v0)); kit.add(g, 0, { bucket: 'atlas', m, outline: false }); }
// [kit] when the Blender town kit is loaded (KP set by createFoot), props / houses become kit placements (one merged mesh)
let KP = null, KPG = 'street'; const kp = (k, name, m) => (KP[KPG] = KP[KPG] || []).push([name, k.stack[k.stack.length - 1].clone().multiply(m)]);
// [nature] Blender nature kit placements (static hero pieces: Skull Peak, spires, boulders), merged per group like the town kit
let NK = null, NP = null; const np = (name, m, lod = 0) => (NP[KPG] = NP[KPG] || []).push([name, lod, m]);
const NM = (x, y, z, ry = 0, s = 1, sy = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, sy, s));
function natRock(x, z, s, seed, sink = 0.3, kind = 'rock') { np(kind + (seed % (kind === 'rock' ? 3 : 2)), NM(x, H(x, z) - s * sink, z, seed * 1.7, s, s * (0.8 + 0.3 * hash(seed, 2)))); }
function barrel(k, m) { if (KP) return kp(k, 'barrel', m); k.at(m, () => { W(k, cyl(0.62, 0.55, 1.5, 12), WOOD_L, 2, M(0, 0.75, 0)); for (const y of [0.3, 1.2]) W(k, cyl(0.66, 0.66, 0.1, 12), IRON, 0, M(0, y, 0), false); }); }
function crate(k, m, s = 1.3) { if (KP) return kp(k, 'crate', m.clone().multiply(new THREE.Matrix4().makeScale(s / 1.2, s / 1.2, s / 1.2))); k.at(m, () => { W(k, box(s, s, s), WOOD_L, 2, M(0, s / 2, 0)); for (const y of [0.12, s - 0.12]) W(k, box(s + 0.06, 0.18, s + 0.06), WOOD_D, 2, M(0, y, 0), false); W(k, box(s + 0.04, s * 1.25, 0.14), WOOD_D, 2, M(0, s / 2, 0, 0, 0, 0.78), false); }); }
function sacks(k, m) { if (KP) return kp(k, 'sacks', m); k.at(m, () => { for (let i = 0; i < 3; i++) W(k, jitter(new THREE.SphereGeometry(0.5, 8, 6), 0.1, i).scale(1, 0.75, 0.8), 0xd9c39a, 12, M(i * 0.7 - 0.7, 0.36 + (i === 1 ? 0.5 : 0), i === 1 ? 0 : 0.2)); }); }
function torchPost(k, F, x, y, z) { if (KP) { kp(k, 'torch', M(x, y, z)); F.push({ x, y: y + 2.75, z }); return; } W(k, cyl(0.1, 0.14, 2.6, 6), WOOD_D, 2, M(x, y + 1.3, z)); W(k, cyl(0.3, 0.18, 0.4, 8), IRON, 0, M(x, y + 2.7, z), false); F.push({ x, y: y + 2.75, z }); }
function cannon(k, m) { k.at(m, () => { W(k, box(1.2, 0.6, 1.8), WOOD_D, 2, M(0, 0.5, 0)); W(k, cyl(0.3, 0.42, 2.6, 10), IRON, 0, M(0, 1.05, 0.5, 0, Math.PI / 2 - 0.12));
  for (const s of [-1, 1]) for (const zz of [-0.6, 0.6]) W(k, cyl(0.3, 0.3, 0.15, 8), WOOD, 2, M(s * 0.65, 0.3, zz, 0, 0, Math.PI / 2), false); }); }
function stall(k, x, y, z, yaw, c) { k.at(M(x, y, z, yaw), () => { W(k, box(3.2, 1.0, 1.4), WOOD, 2, M(0, 0.5, 0)); for (const sx of [-1.5, 1.5]) for (const sz of [-0.6, 0.6]) W(k, cyl(0.07, 0.07, 2.6, 5), WOOD_D, 2, M(sx, 1.3, sz), false);
  W(k, box(3.6, 0.08, 2.0), c, 12, M(0, 2.6, 0.2, 0, 0.18)); for (let i = 0; i < 5; i++) k.add(new THREE.SphereGeometry(0.18, 6, 4), [0xff7a1a, 0xffd43b, 0x8fd352, 0xd8322f][i % 4], { m: M(-1.2 + i * 0.6, 1.15, 0.1), outline: false, mat: 0 }); }); }

// town-side: main street (world coords via the town frame), Squad Hall, gate, square with a well, fort battery
const tw = (lx, lz) => townToWorld(lx, lz), twy = (lyaw) => lyaw + TOWN.yaw;
// [v103] plaza (town-local): live leaderboard frame size, the two shops, the token billboards. js/dock/layout.js puts the interact
// points on them, js/dock/plaza.js lays the live leaderboard screens on PLAZA_BOARD.
export const PLAZA_BOARD = { w: 6.0, h: 4.4, y: 3.5, face: 0.2 };
export const PLAZA_SHOPS = [{ id: 'shop_clothes', vendor: 'clothes', lx: -50, lz: -32, sign: 'clothesShop', wall: 0xc9a27a, roof: 0xd8322f, label: 'CLOTHES SHOP · PIRATE GEAR' },
  { id: 'shop_ships', vendor: 'ships', lx: -22, lz: -32, sign: 'shipShop', wall: 0x9db7c9, roof: 0x2a6df4, label: 'SHIP SKINS + UPGRADES' }];
export const PLAZA_TOKENS_TITLE = { SUNK: 'STORM HUNT', AHOY: '$AHOY', PUMP: 'PUMP' }; // [v108] billboard titles (config ISLAND_TOKENS)
export const PLAZA_TOKENS = [{ sym: 'SUNK', lx: -42, lz: -36 }, { sym: 'AHOY', lx: -36, lz: -36 }, { sym: 'PUMP', lx: -30, lz: -36 }];
export const INTERACT = []; // { id, x, z, r, label }
export function buildStreet(A, low, F) {
  const k = new Kit(), S = STREET; k.ao = (x, y, z) => 0.58 + 0.42 * sm(0, 2.6, y - H(x, z)); KPG = 'street';
  const lots = []; for (let z = S.z0 - 10, n = 0; z > S.z1 + 8; n++) { const w = 7 + hash(n, 3) * 4; lots.push([z - w / 2, w, n]); z -= w + 1.6; }
  const SIGNS = { '-1:1': 'tavern', '1:3': 'shop', '-1:4': 'bounties' };
  for (const side of [-1, 1]) for (const [z, w, n] of lots) {
    if (side === 1 && n === 0) continue;                      // Squad Hall plot
    if (n === 4 && side === 1) continue;                      // the square (well)
    const fl = 2 + (hash(n, side) > 0.55 ? 1 : 0), d = 8 + hash(side, n) * 2, lx = S.x + side * (S.half + 1 + d / 2), [x, wz] = tw(lx, z), yaw = twy(side === -1 ? Math.PI / 2 : -Math.PI / 2);
    colonial(k, F, x, H(x, wz), wz, yaw, w, d, fl, n * 2 + (side > 0 ? 1 : 0), low, SIGNS[side + ':' + n] || null, A);
    { const nm = { '1:3': 'SHOP (R3)', '-1:1': 'Tavern (L1)', '-1:4': 'Bounties (L4)' }[side + ':' + n]; LOTS_MAP.push({ lx, z, w, d, side, label: nm || null, col: nm ? '#fbbf24' : 'rgba(240,220,190,0.9)', tc: nm ? '#fde68a' : '#fff', ...({ '1:3': { ldx: 20, ldy: 75 }, '-1:1': { ldx: -10, ldy: -70 }, '-1:4': { ldx: 10, ldy: -70 } }[side + ':' + n] || {}) });
      if (side === 1 && n === 3) { const [sx, sz] = tw(S.x + S.half + 1 - 1.6, z); SHOP_SPOTS.shop = { id: 'shop', x: +sx.toFixed(2), z: +sz.toFixed(2), r: 2.4, label: 'E · SHOP' }; } }
    addBox(x, wz, w + 0.6, d + 0.6, yaw);
  }
  { // SQUAD HALL: wide 3 storeys, stone ground floor, banners, interact at the door
    const [z] = lots[0], lx = S.x + S.half + 1 + 7, [x, wz] = tw(lx, z - 3), yaw = twy(-Math.PI / 2), y = H(x, wz);
    colonial(k, F, x, y, wz, yaw, 16, 14, 3, 3, low, 'squad', A); addBox(x, wz, 16.6, 14.6, yaw);
    k.at(M(x, y, wz, yaw), () => { for (const sx of [-5.5, 5.5]) { if (!KP) W(k, box(1.8, 0.12, 4.6), RED, 12, M(sx, 7.5, 7.4, 0, Math.PI / 2), false); if (A.ppflag) atlasQuad(k, 1.7, 1.2, A.ppflag, M(sx, 7.9, KP ? 8.18 : 7.48)); }
      if (KP) atlasQuad(k, 6.6, 1.3, A.squad, M(0, 9.3, 7.5)); // on the Blender hall's facade sign board (2nd floor, reads from the street)
      else { W(k, box(4.2, 0.9, 0.3), WOOD_D, 2, M(0, 4.4, 7.4), false); atlasQuad(k, 4.0, 0.8, A.squad, M(0, 4.4, 7.56)); } });
    LOTS_MAP.push({ lx, z: z - 3, w: 16, d: 14, side: 1, label: 'SQUAD HALL (R0)', col: '#a855f7', tc: '#e9d5ff', ldx: -30, ldy: 70 });
    const [dx, dz] = tw(lx - 7 - 1.6, z - 3); INTERACT.push({ id: 'squadhall', x: dx, z: dz, r: 3.2, label: 'E · SQUAD HALL' });
  }
  { // the square: a stone well + market stalls + crates
    const [z, w] = lots[4], lx = S.x + S.half + 7, [x, wz] = tw(lx, z), y = H(x, wz);
    W(k, cyl(1.6, 1.7, 1.0, 14), STONE, 11, M(x, y + 0.5, wz)); W(k, cyl(1.25, 1.25, 0.2, 14), 0x2b5d6a, 0, M(x, y + 0.92, wz), false);
    for (const s of [-1, 1]) W(k, box(0.2, 2.6, 0.2), WOOD_D, 2, M(x + s * 1.3, y + 1.8, wz), false); W(k, box(3.0, 0.2, 0.25), WOOD_D, 2, M(x, y + 3.1, wz), false);
    W(k, new THREE.ConeGeometry(2.1, 1.0, 4), ROOFS[0], 4, M(x, y + 3.7, wz, Math.PI / 4));
    addCirc(x, wz, 1.8);
    LOTS_MAP.push({ lx, z, w, d: 12, side: 1, label: 'SQUARE + well, red/blue stalls (R4)', col: 'rgba(201,191,174,0.95)', tc: '#fff', ldx: 50, ldy: 40 });
    for (const [id, dz] of [['stall_red', 3.5], ['stall_blue', -3.5]]) { const [sx, sz] = tw(lx + 3.2, z + dz); SHOP_SPOTS[id] = { id, x: +sx.toFixed(2), z: +sz.toFixed(2), r: 2.6, label: 'E · ' + (id === 'stall_red' ? 'RED' : 'BLUE') + ' STALL' }; }
    stall(k, ...tw(lx + 3.2, z + 3.5).flatMap((v, i) => i ? [v] : [v, H(...tw(lx + 3.2, z + 3.5))]), twy(-Math.PI / 2), 0xd8322f); addCirc(...tw(lx + 3.2, z + 3.5), 1.8);
    stall(k, ...tw(lx + 3.2, z - 3.5).flatMap((v, i) => i ? [v] : [v, H(...tw(lx + 3.2, z - 3.5))]), twy(-Math.PI / 2), 0x2a6df4); addCirc(...tw(lx + 3.2, z - 3.5), 1.8);
  }
  // street dressing: lamps (flame + light), crates / barrels / sacks against the walls
  for (let z = S.z0 - 6; z > S.z1; z -= 16) for (const s of [-1, 1]) { const [x, wz] = tw(S.x + s * (S.half - 0.6), z), y = H(x, wz);
    if (KP) kp(k, 'lamp', M(x, y, wz)); else { W(k, cyl(0.09, 0.12, 3.6, 6), IRON, 0, M(x, y + 1.8, wz)); W(k, box(0.5, 0.6, 0.5), IRON, 0, M(x, y + 3.7, wz), false); k.add(new THREE.SphereGeometry(0.2, 6, 4), 0xffd36b, { bucket: 'glow', m: M(x, y + 3.65, wz), outline: false }); } F.push({ x, y: y + 3.95, z: wz, lamp: true }); addCirc(x, wz, 0.3); }
  for (let i = 0; i < (low ? 10 : 22); i++) { const s = i % 2 ? 1 : -1, z = S.z0 - 8 - i * 6.4, [x, wz] = tw(S.x + s * (S.half - 0.2), z), y = H(x, wz), ry = twy(hash(i, 4) * 6);
    if (i % 3 === 0) barrel(k, M(x, y, wz, ry)); else if (i % 3 === 1) crate(k, M(x, y, wz, ry), 1.1); else sacks(k, M(x, y, wz, ry)); addCirc(x, wz, 0.8); }
  { const z = S.z1 + 4, y = H(...tw(S.x, z)); // town gate
    for (const s of [-1, 1]) { const [x, wz] = tw(S.x + s * (S.half + 1.6), z); W(k, box(3.2, 10, 3.2), STONE, 11, M(x, y + 5, wz, twy(0))); for (let c = 0; c < 4; c++) W(k, box(0.8, 0.9, 0.8), STONE, 11, M(x + (c % 2 - 0.5) * 2, y + 10.4, wz + (c > 1 ? 1 : -1) * 1.0, twy(0)), false); addBox(x, wz, 3.4, 3.4, twy(0)); torchPost(k, F, ...tw(S.x + s * (S.half - 0.4), z + 2.5).flatMap((v, i) => i ? [H(...tw(S.x + s * (S.half - 0.4), z + 2.5)), v] : [v])); }
    const [gx, gz] = tw(S.x, z); W(k, box(S.half * 2 + 6, 2.2, 3.0), STONE_D, 11, M(gx, y + 9.0, gz, twy(0)));
    k.at(M(gx, y + 9.8, gz, twy(0)), () => { if (A.ppflag) { W(k, cyl(0.08, 0.08, 4, 5), WOOD_D, 2, M(0, 2, 0), false); atlasQuad(k, 3.0, 2.0, A.ppflag, M(1.55, 3.0, 0.03)); atlasQuad(k, 3.0, 2.0, A.ppflag, M(1.55, 3.0, -0.03, Math.PI)); } }); }
  // fort battery (cannons round the keep) + crates on the land bridge shoulders
  if (!COASTM) for (let i = 0; i < 6; i++) { const a = -0.9 + i * 0.5, r = 12.5, lx = -41 + Math.sin(a + Math.PI * 1.5) * r, lz = -15 + Math.cos(a + Math.PI * 1.5) * r, [x, wz] = tw(lx, lz);
    cannon(k, M(x, groundY(lx, lz) - 0.1, wz, twy(Math.atan2(lx + 41, lz + 15)))); }
  return k;
}

// ---------- [coast] the harbor town built into the west coast (?coast=1, BLOCKOUT) ----------
// Reuses the Blender town kit (pier stem / T-head modules, crates, barrels, lamps, torches, bollards) + the street builders;
// the round Dock Town island (art.js buildIsland) is not built at all in this mode.
export const SHOP_SPOTS = {};                                     // Timothy's interact spots, world coords (filled by buildStreet)
export function buildCoast(A, low, F, decorHulls = true) { // [Emerly] decorHulls = false: the game's live berths stay empty for docking
  KPG = 'coast';
  const k = new Kit(); k.ao = (x, y, z) => 0.6 + 0.4 * sm(0, 2.6, y - H(x, z));
  const T = (lx, lz) => CO.t2w(lx, lz), Y0 = CO.QUAY.y, PY = CO.BOARDWALK.y, yaw0 = CO.t2wYaw(0);
  const at = (lx, lz, ly, fn, y = null) => { const [x, z] = T(lx, lz); k.at(M(x, y === null ? H(x, z) : y, z, CO.t2wYaw(ly)), fn); };
  const deck = (lx, lz, w, d) => { const [x, z] = T(lx, lz); k.at(M(x, 0, z, yaw0), () => { // planks (kit modules) + stilts, local x = lx, z = lz
    if (KP) { const nx = Math.max(1, Math.round(w / 6)), nz = Math.max(1, Math.round(d / 4)); for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) kp(k, 'pierHead', M(-w / 2 + (i + 0.5) * w / nx, PY, -d / 2 + (j + 0.5) * d / nz, 0, 0, 0, [w / nx / 6, 1, d / nz / 4])); }
    else W(k, box(w, 0.3, d), WOOD_L, 2, M(0, PY, 0));
    for (let i = 0; i <= Math.floor(w / 5); i++) for (const sz of [-d / 2 + 0.3, d / 2 - 0.3]) W(k, cyl(0.25, 0.3, 7, 6), WOOD_D, 2, M(-w / 2 + 0.3 + i * (w - 0.6) / Math.max(1, Math.floor(w / 5)), PY - 3.5, sz), false); }); };
  const stem = (lx, lz0, lz1) => { const [x, z] = T(lx, lz0); k.at(M(x, 0, z, yaw0), () => { const L = lz1 - lz0, n = Math.ceil(L / 6);
    if (KP) for (let i = 0; i < n; i++) kp(k, 'pierStem', M(0, PY, (i + 0.5) * L / n, 0, 0, 0, [1, 1, L / n / 6])); else W(k, box(5, 0.3, L), WOOD_L, 2, M(0, PY, L / 2));
    for (let zz = 3; zz < L; zz += 6) for (const sx of [-2.6, 2.6]) W(k, cyl(0.28, 0.32, 8, 6), WOOD_D, 2, M(sx, PY - 4, zz), false);
    for (const sx of [-2.4, 2.4]) { W(k, box(0.12, 0.12, L - 1), 0xe7c08d, 12, M(sx, PY + 1.0, L / 2), false); for (let zz = 1; zz < L; zz += 4) W(k, cyl(0.08, 0.1, 1.1, 5), WOOD_D, 2, M(sx, PY + 0.55, zz), false); } }); };
  const hull = (lx, lz, len, c, sails = true) => at(lx, lz, Math.PI / 2, () => { // toy ship blockout (decor at the berths)
    W(k, box(len * 0.22, 2.2, len * 0.78), c, 2, M(0, 0.6, -len * 0.05)); W(k, new THREE.ConeGeometry(len * 0.12, len * 0.24, 4), c, 2, M(0, 0.6, len * 0.43, Math.PI / 4, Math.PI / 2), false);
    W(k, box(len * 0.2, 0.2, len * 0.75), WOOD_L, 2, M(0, 1.75, -len * 0.05), false);
    if (sails) for (const [mz, mh] of [[len * 0.15, len * 0.75], [-len * 0.2, len * 0.6]]) { W(k, cyl(0.2, 0.25, mh, 6), WOOD_D, 2, M(0, mh / 2, mz), false); W(k, box(len * 0.34, mh * 0.42, 0.15), CREAM, 12, M(0, mh * 0.6, mz + 0.4), false); } }, 0);
  const shack = (lx, lz, ly, w, d, stilt, c) => at(lx, lz, ly, () => { // wooden shack (on stilts at the waterline)
    const b = stilt; for (const sx of [-w / 2 + 0.3, w / 2 - 0.3]) for (const sz of [-d / 2 + 0.3, d / 2 - 0.3]) W(k, cyl(0.2, 0.24, b + 3, 5), WOOD_D, 2, M(sx, b / 2 - 1.5, sz), false);
    W(k, box(w + 1.6, 0.25, d + 1.6), WOOD_L, 2, M(0, b, 0)); W(k, box(w, 3.0, d), c, 2, M(0, b + 1.6, 0));
    W(k, box(1.0, 1.9, 0.1), WOOD_D, 2, M(0, b + 1.05, d / 2 + 0.05), false);
    for (const s of [-1, 1]) W(k, box(w + 1.2, 0.2, d / 2 / Math.cos(0.55) + 0.6), ROOFS[(lx | 0) & 3] === undefined ? WOOD : 0x8a6a45, 4, M(0, b + 3.1 + Math.tan(0.55) * d / 4, s * d / 4, 0, s * 0.55)); }, 0);
  // stone quay: seawall face + coping + a cobbled plaza slab, bollards along the edge
  { const L = CO.QUAY.lx1 - CO.QUAY.lx0, cx = (CO.QUAY.lx0 + CO.QUAY.lx1) / 2;
    at(cx, 0.6, 0, () => { W(k, box(L, 7.6, 1.6), STONE_D, 11, M(0, Y0 - 3.7, 0)); W(k, box(L + 0.4, 0.4, 2.0), STONE, 11, M(0, Y0 + 0.1, 0), false); }, 0);
    at(cx, -27, 0, () => W(k, box(L - 2, 0.3, 54), 0xc9bfae, 10, M(0, Y0 - 0.02, 0), false), 0);
    for (let lx = CO.QUAY.lx0 + 6; lx < CO.QUAY.lx1 - 4; lx += 12) { const [x, z] = T(lx, -0.6); if (KP) kp(k, 'bollard', M(x, Y0 + 0.2, z)); } }
  // stone mole out to the lighthouse (the lighthouse itself = the inland lighthouse POI, moved onto the mole tip)
  { const m = CO.MOLE; at(m.lx, (m.lz0 + m.lz1) / 2, 0, () => { W(k, box(m.w, 7.6, m.lz1 - m.lz0), STONE_D, 11, M(0, m.y - 3.7, 0)); W(k, box(m.w + 0.4, 0.4, m.lz1 - m.lz0), STONE, 11, M(0, m.y + 0.1, 0), false); }, 0);
    at(m.lx, m.lz1, 0, () => W(k, cyl(m.tipR, m.tipR + 0.6, 7.6, 18), STONE_D, 11, M(0, m.y - 3.7, 0)), 0);
    for (let lz = 10; lz < m.lz1 - 8; lz += 14) { const [x, z] = T(m.lx, lz); if (KP) kp(k, 'lamp', M(x, m.y + 0.2, z)); F.push({ x, y: m.y + 4.2, z, lamp: true }); } }
  // boardwalk on stilts along the beach + the four T-head piers (8 berths)
  { const B = CO.BOARDWALK; deck((B.lx0 + B.lx1) / 2, (B.lz0 + B.lz1) / 2, B.lx1 - B.lx0, B.lz1 - B.lz0); }
  for (const p of CO.PIERS) { stem(p.lx, p.lz0, p.head0); deck(p.lx, (p.head0 + p.head1) / 2, p.half * 2, p.head1 - p.head0);
    for (const t of [-12, 12]) for (const e of [-8.5, 8.5]) { const [x, z] = T(p.lx + t + e, p.head1 - 0.7); if (KP) kp(k, 'bollard', M(x, PY + 0.16, z)); }
    for (const sx of [-1, 1]) torchPost(k, F, ...(([x, z]) => [x, PY + 0.15, z])(T(p.lx + sx * (p.half - 1), (p.head0 + p.head1) / 2)));
    { const [x, z] = T(p.lx - 2.2, p.head0 + 1.6); crate(k, M(x, PY + 0.16, z, 0.3 + p.k)); } { const [x, z] = T(p.lx + 2.4, p.head0 + 1.5); barrel(k, M(x, PY + 0.16, z)); }
    // small side jetty with a rowboat between piers
    stem(p.lx - 30, 4, 22); at(p.lx - 26, 16, 0, () => { W(k, box(2.2, 0.8, 5.5), WOOD, 2, M(0, 0.2, 0)); W(k, box(1.8, 0.15, 5.0), WOOD_L, 2, M(0, 0.62, 0), false); }, 0); }
  // decor ships on 7 berths (the 8th, P4R, gets a real baked game ship in main.js)
  CO.COAST_BERTHS.forEach((b, i) => { if (decorHulls && b.id !== 'P4R') hull(b.lx, b.lz, 20, [0x6b4527, 0x3d2a1c, 0x7b3b20, 0x2c3e50][i % 4], i % 3 !== 2); });
  // shacks on stilts at the waterline + on the beach behind the boardwalk, barrels / crates / nets between them
  for (let i = 0; i < 9; i++) { const lx = -70 - i * 26 - hash(i, 2) * 6, onW = i % 3 === 1; shack(lx, onW ? 12 : -8 - hash(i, 5) * 8, onW ? Math.PI / 2 : 0, 5 + hash(i, 1) * 2, 4.5 + hash(i, 3) * 1.5, onW ? PY : H(...T(lx, -8)) + 1.6, [0xa86a3a, 0x8a5a2b, 0xb98a5a, 0x7a5232][i % 4]);
    const [x, z] = T(lx + 9, -1); barrel(k, M(x, PY + 0.16, z)); const [x2, z2] = T(lx + 11, 1.5); crate(k, M(x2, PY + 0.16, z2, i)); }
  // plaza: WAVES + ARENA boards facing the harbor, token exchange, harbor market, the tall stone harbor tower framing it
  const P = Object.fromEntries(CO.PLAZA_POIS.map(q => [q.id, q]));
  // [v103] WAVES + ARENA boards are LIVE LEADERBOARDS (BANKSY): a bigger frame; js/dock/plaza.js lays one live canvas screen
  // (both boards in one texture, 1 draw call) on the front at PLAZA_BOARD.face; the painted title sign rides on top + on the back
  for (const [id, sg, c] of [['waves', 'waves', 0xd8322f], ['arena', 'arena', 0x2a6df4]]) at(P[id].lx, P[id].lz, 0, () => { const B = PLAZA_BOARD;
    for (const s of [-1, 1]) W(k, box(0.34, B.y + B.h / 2 + 1.3, 0.34), WOOD_D, 2, M(s * (B.w / 2 + 0.25), (B.y + B.h / 2 + 1.3) / 2, 0));
    W(k, box(B.w + 0.4, B.h + 0.4, 0.3), c, 2, M(0, B.y, 0)); W(k, box(B.w + 0.1, B.h + 0.1, 0.05), 0x161616, 0, M(0, B.y, 0.16), false);
    W(k, box(B.w * 0.84, 1.1, 0.2), WOOD_D, 2, M(0, B.y + B.h / 2 + 0.85, 0), false);
    if (A[sg]) { atlasQuad(k, B.w * 0.8, 0.95, A[sg], M(0, B.y + B.h / 2 + 0.85, 0.11)); atlasQuad(k, B.w * 0.8, 0.95, A[sg], M(0, B.y + B.h / 2 + 0.85, -0.11, Math.PI));
      atlasQuad(k, B.w * 0.9, 1.1, A[sg], M(0, B.y, -0.17, Math.PI)); }
    W(k, box(B.w + 0.6, 0.3, 0.5), WOOD_D, 2, M(0, B.y + B.h / 2 + 0.2, 0), false); }, Y0);
  for (const id of ['waves', 'arena']) { const [x, z] = T(P[id].lx, P[id].lz); addBox(x, z, PLAZA_BOARD.w + 1, 0.6, yaw0); }
  at(P.exchange.lx, P.exchange.lz, 0, () => { W(k, box(6, 3.4, 4.5), CREAM, 7, M(0, 1.7, 0)); W(k, new THREE.ConeGeometry(5.0, 2.2, 4), GOLD, 4, M(0, 4.5, 0, Math.PI / 4)); W(k, box(4.5, 1.1, 0.8), WOOD, 2, M(0, 0.55, 2.6));
    if (A.exchange) atlasQuad(k, 3.4, 0.9, A.exchange, M(0, 2.9, 2.27)); }, Y0); { const [x, z] = T(P.exchange.lx, P.exchange.lz); addBox(x, z, 6.4, 5, yaw0); }
  // [v103] the HARBOR MARKET stalls are now two proper shops (BANKSY): CLOTHES SHOP + SHIP SKINS / UPGRADES, and between them
  // three token billboards ($SUNK / $AHOY / $PUMP). All static + atlas signage, merged into the street mesh (0 extra draw calls).
  for (const sp of PLAZA_SHOPS) at(sp.lx, sp.lz, 0, () => { const w = 7.2, d = 4.4;
    W(k, box(w, 3.4, 0.3), sp.wall, 7, M(0, 1.7, -d / 2));                                                   // back wall
    for (const sx of [-1, 1]) W(k, box(0.3, 3.4, d), sp.wall, 7, M(sx * w / 2, 1.7, 0));                      // side walls
    W(k, box(w - 0.6, 1.1, 1.0), WOOD, 2, M(0, 0.55, d / 2 - 0.6));                                            // counter
    W(k, box(w - 0.4, 0.12, 1.2), WOOD_L, 2, M(0, 1.16, d / 2 - 0.6), false);
    for (const sx of [-1, 1]) W(k, box(0.26, 3.6, 0.26), WOOD_D, 2, M(sx * (w / 2 - 0.1), 1.8, d / 2), false);  // front posts
    W(k, box(w + 1.0, 0.16, d + 1.6), sp.roof, 4, M(0, 3.75, 0.3, 0.16));                                     // sloped roof
    for (let i = 0; i < 6; i++) W(k, box((w + 1.0) / 6 - 0.04, 0.5, 0.06), i % 2 ? 0xf2efe6 : sp.roof, 12, M(-((w + 1.0) / 2) + (i + 0.5) * (w + 1.0) / 6, 3.4, d / 2 + 1.12), false); // striped valance
    W(k, box(5.8, 1.5, 0.16), WOOD_D, 2, M(0, 4.65, d / 2 + 0.75), false);                                    // sign board
    if (A[sp.sign]) atlasQuad(k, 5.5, 1.3, A[sp.sign], M(0, 4.65, d / 2 + 0.84));
    if (sp.id === 'shop_clothes') { for (const sx of [-2.2, 0, 2.2]) { W(k, cyl(0.05, 0.05, 1.6, 5), WOOD_D, 2, M(sx, 1.95, -d / 2 + 0.5), false);  // mannequins: hat + coat
        W(k, box(0.8, 1.0, 0.4), [0xd8322f, 0x161616, 0x2a6df4][(sx / 2.2 + 1) | 0], 12, M(sx, 2.0, -d / 2 + 0.5)); W(k, cyl(0.55, 0.55, 0.12, 10), 0x161616, 0, M(sx, 2.9, -d / 2 + 0.5)); W(k, cyl(0.28, 0.32, 0.36, 10), 0x161616, 0, M(sx, 3.1, -d / 2 + 0.5), false); } }
    else { for (const [sx, c] of [[-2.2, 0xffc93c], [0, 0xfa0d0d], [2.2, 0x2a6df4]]) { W(k, box(1.4, 0.5, 0.7), WOOD_D, 2, M(sx, 1.45, -d / 2 + 0.5), false);   // ship models on stands
        W(k, box(1.1, 0.35, 0.36), c, 12, M(sx, 1.85, -d / 2 + 0.5)); W(k, cyl(0.04, 0.04, 1.0, 4), WOOD_D, 2, M(sx, 2.4, -d / 2 + 0.5), false); W(k, box(0.7, 0.55, 0.04), 0xf2efe6, 12, M(sx, 2.45, -d / 2 + 0.56), false); } }
  }, Y0);
  for (const sp of PLAZA_SHOPS) { const [x, z] = T(sp.lx, sp.lz); addBox(x, z, 7.6, 4.8, yaw0); }
  for (const tb of PLAZA_TOKENS) at(tb.lx, tb.lz, 0, () => {
    for (const sx of [-1, 1]) W(k, box(0.26, 5.8, 0.26), WOOD_D, 2, M(sx * 2.05, 2.9, 0));
    W(k, box(4.5, 4.0, 0.24), WOOD_D, 2, M(0, 3.75, 0)); if (A['bb' + tb.sym]) atlasQuad(k, 4.2, 3.8, A['bb' + tb.sym], M(0, 3.95, 0.13));
    if (A['tokLive' + tb.sym]) atlasQuad(k, 3.8, 1.0, A['tokLive' + tb.sym], M(0, 1.55, 0.13));                // live price strip (atlas.drawTokenBoard)
    W(k, box(4.2, 1.2, 0.2), 0x161616, 0, M(0, 1.55, 0.02), false);
    if (A.ppflag) atlasQuad(k, 4.2, 3.0, A.ppflag, M(0, 3.75, -0.13, Math.PI));                                  // back: the PUMPFUN PIRATES flag
  }, Y0);
  for (const tb of PLAZA_TOKENS) { const [x, z] = T(tb.lx, tb.lz); addBox(x, z, 4.6, 0.5, yaw0); }
  for (let i = 0; i < 10; i++) { const [x, z] = T(-50 + i * 11 + hash(i, 9) * 4, -6 - hash(i, 7) * 6); (i % 2 ? crate : barrel)(k, M(x, Y0, z, i), 1.2); addCirc(x, z, 0.8); }
  at(P.tower.lx, P.tower.lz, 0, () => { W(k, box(9, 24, 9), STONE, 11, M(0, 12, 0)); W(k, box(10, 1, 10), STONE_D, 11, M(0, 24.3, 0), false); W(k, new THREE.ConeGeometry(7.4, 7, 4), ROOFS[1], 4, M(0, 28.3, 0, Math.PI / 4));
    for (const y of [8, 15, 20]) W(k, box(1.4, 2.2, 0.3), 0x2b3d4a, 0, M(0, y, 4.6), false); }, Y0); { const [x, z] = T(P.tower.lx, P.tower.lz); addBox(x, z, 9.4, 9.4, yaw0); }
  for (const lx of [-50, -20, 10, 40, 70]) { const [x, z] = T(lx, -3); torchPost(k, F, x, Y0, z); }
  // spectate spyglass on the mole deck (CO.SPYGLASS, walkable; the interact point is the same spot)
  at(CO.SPYGLASS.lx, CO.SPYGLASS.lz, 0, () => { W(k, cyl(0.12, 0.16, 1.4, 6), IRON, 0, M(0, 0.7, 0)); W(k, cyl(0.12, 0.2, 1.6, 8), GOLD, 0, M(0, 1.55, 0.3, 0, Math.PI / 2 - 0.2), false); }, CO.SPYGLASS.y);
  // fort at the top of Main Street: keep, curtain wall, 4 round towers, pirate flag
  at(CO.FORT.lx, CO.FORT.lz, 0, () => { W(k, box(26, 7, 26), STONE, 11, M(0, 2.5, 0)); W(k, box(14, 18, 14), STONE_D, 11, M(0, 10.5, 0));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { W(k, cyl(3.2, 3.6, 18, 12), STONE, 11, M(sx * 13, 7, sz * 13)); W(k, new THREE.ConeGeometry(4, 5, 12), ROOFS[0], 4, M(sx * 13, 18.5, sz * 13)); }
    W(k, cyl(0.2, 0.2, 12, 5), WOOD_D, 2, M(0, 25.5, 0), false); if (A.ppflag) { atlasQuad(k, 6, 4, A.ppflag, M(3.05, 29, 0.03)); atlasQuad(k, 6, 4, A.ppflag, M(3.05, 29, -0.03, Math.PI)); }
    for (let i = 0; i < 4; i++) cannon(k, M(-6 + i * 4, 6.1, 13.4, 0)); }, null); { const [x, z] = T(CO.FORT.lx, CO.FORT.lz); addBox(x, z, 27, 27, yaw0); }
  // battery on the cliff headland: parapet + 6 cannons facing the harbor
  { const hd = CO.HEADLAND; for (let i = 0; i < 6; i++) { const a = -0.75 + i * 0.3, lx = hd.lx + Math.sin(a) * 15, lz = hd.lz + 6 + Math.cos(a) * 15, [x, z] = T(lx, lz);
      cannon(k, M(x, H(x, z) - 0.1, z, CO.t2wYaw(a))); W(k, box(4, 1.3, 1.2), STONE, 11, M(...(([xx, zz]) => [xx, H(xx, zz) + 0.4, zz])(T(hd.lx + Math.sin(a) * 18, hd.lz + 6 + Math.cos(a) * 18)), CO.t2wYaw(a)), false); }
    const [x, z] = T(hd.lx, hd.lz - 8); torchPost(k, F, x, H(x, z), z); }
  return k;
}
// 2D review map of the coast harbor (?coast=1&map=1): battle area, rings, spawns, berths, no-fire zone, town, Main Street lots
export function drawCoastMap(cv) {
  const Wd = cv.width, Hh = cv.height, g = cv.getContext('2d'), [hx0, hz0] = CO.HC, R = 420;
  const x0 = hx0 - 440, x1 = hx0 + 820, z0 = hz0 - 450, z1 = hz0 + 450;
  const proj = (bx0, bx1, bz0, bz1, px, py, pw, ph) => { const sc = Math.min(pw / (bx1 - bx0), ph / (bz1 - bz0)); return { sc, P: (x, z) => [px + (x - bx0) * sc, py + (z - bz0) * sc], inv: (a, b) => [bx0 + (a - px) / sc, bz0 + (b - py) / sc] }; };
  const terrain = (pr, px, py, pw, ph) => { const img = g.createImageData(pw, ph), c = new THREE.Color();
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const [wx, wz] = pr.inv(px + x, py + y), i = Math.round((wx - X0) / G), j = Math.round((wz - Z0) / G), o = (y * pw + x) * 4;
      if (i < 0 || j < 0 || i > NX || j > NZ) c.set(0x174f70); else { const h = Hg[IDX(i, j)]; if (h < -4) c.set(0x1f6e94).lerp(new THREE.Color(0x174f70), Math.min(1, (-h - 4) / 12)); else if (h < 0.3) c.set(0x3fc6c9); else colorAt(i, j, c);
        if (h >= 0.3) { const s = 1 + (Hg[IDX(Math.min(NX, i + 1), j)] - h) * -0.04; c.multiplyScalar(s); } }
      img.data[o] = Math.min(255, c.r * 255); img.data[o + 1] = Math.min(255, c.g * 255); img.data[o + 2] = Math.min(255, c.b * 255); img.data[o + 3] = 255; }
    g.putImageData(img, px, py); };
  const draw = (pr, zoom) => {
    const { P, sc } = pr, L = (lx, lz) => P(...CO.t2w(lx, lz));
    const poly = (pts, fill, stroke, w = 2, dash = []) => { g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.setLineDash(dash); g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); g.setLineDash([]); } };
    const circ = (r, col, w, dash = []) => { const [a, b] = P(hx0, hz0); g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(a, b, r * sc, 0, 7); g.stroke(); g.setLineDash([]); };
    const rectL = (lx0, lz0, lx1, lz1, fill, stroke) => poly([[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]].map(p => L(...p)), fill, stroke, 1.5);
    const T = (s, a, b, size = 15, col = '#fff', al = 'left') => { g.font = `bold ${size}px sans-serif`; g.textAlign = al; g.textBaseline = 'middle'; g.lineWidth = Math.max(3, size / 4); g.strokeStyle = '#111'; g.strokeText(s, a, b); g.fillStyle = col; g.fillText(s, a, b); };
    const TL = (s, lx, lz, dx, dy, size, col) => { const [a, b] = L(lx, lz); g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.moveTo(a, b); g.lineTo(a + dx, b + dy); g.stroke(); g.strokeStyle = col || '#fff'; g.lineWidth = 1.5; g.stroke(); T(s, a + dx + (dx >= 0 ? 4 : -4), b + dy, size, col, dx >= 0 ? 'left' : 'right'); };
    poly(CO.SAFE.map(p => L(...p)), 'rgba(255,255,255,0.16)', '#ffffff', 2.5, [9, 6]);
    if (!zoom) { circ(R, '#ff2b2b', 4); circ(370, '#ff9a3a', 2, [10, 8]); for (const r of [176, 344]) circ(r, '#fbbf24', 1.8, [5, 7]); for (const r of [40, 85, 130]) circ(r, '#4ade80', 2, [7, 6]);
      for (const s of CO.spawnCheck()) { const [a, b] = P(hx0 + s.hx, hz0 + s.hz); if (s.ok) { g.fillStyle = '#111'; g.beginPath(); g.arc(a, b, 6, 0, 7); g.fill(); g.fillStyle = '#fbbf24'; g.beginPath(); g.arc(a, b, 4.5, 0, 7); g.fill(); }
        else { g.strokeStyle = '#111'; g.lineWidth = 6; g.beginPath(); g.moveTo(a - 7, b - 7); g.lineTo(a + 7, b + 7); g.moveTo(a + 7, b - 7); g.lineTo(a - 7, b + 7); g.stroke(); g.strokeStyle = '#ff3b3b'; g.lineWidth = 3; g.stroke(); } }
      const [sa, sb] = P(hx0, hz0); g.fillStyle = '#60a5fa'; g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(sa + 12, sb); g.lineTo(sa - 8, sb - 9); g.lineTo(sa - 8, sb + 9); g.closePath(); g.fill(); g.stroke(); }
    // quay, mole, boardwalk, piers, plaza, fort
    rectL(CO.QUAY.lx0, -56, CO.QUAY.lx1, 0, 'rgba(201,191,174,0.85)', '#555'); rectL(CO.QUAY.lx0, -0.5, CO.QUAY.lx1, 1.5, '#6f6a62', null);
    rectL(CO.MOLE.lx - 4, 0, CO.MOLE.lx + 4, CO.MOLE.lz1, '#8a837a', '#333'); { const [a, b] = L(CO.MOLE.lx, CO.MOLE.lz1); g.fillStyle = '#8a837a'; g.beginPath(); g.arc(a, b, 9 * sc, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(a, b, Math.max(3, 3 * sc), 0, 7); g.fill(); }
    rectL(CO.BOARDWALK.lx0, CO.BOARDWALK.lz0, CO.BOARDWALK.lx1, CO.BOARDWALK.lz1, '#c48a50', '#5a3a1e');
    for (const p of CO.PIERS) { rectL(p.lx - 2.5, p.lz0, p.lx + 2.5, p.head0, '#c48a50', '#5a3a1e'); rectL(p.lx - p.half, p.head0, p.lx + p.half, p.head1, '#c48a50', '#5a3a1e'); }
    for (const b of CO.COAST_BERTHS) { rectL(b.lx - 10, b.lz - 3.6, b.lx + 10, b.lz + 3.6, 'rgba(103,232,249,0.85)', '#0e7490'); if (zoom) { const [a, c] = L(b.lx, b.lz + 9); T(b.id, a, c, 12, '#67e8f9', 'center'); } }
    { const f = CO.FORT; const [a, b] = L(f.lx, f.lz); g.fillStyle = '#b9b2a6'; g.strokeStyle = '#333'; g.lineWidth = 2; g.fillRect(a - 13 * sc, b - 13 * sc, 26 * sc, 26 * sc); g.strokeRect(a - 13 * sc, b - 13 * sc, 26 * sc, 26 * sc); }
    // main street
    { const [a, b] = L(STREET.x, STREET.z0), [c, d] = L(STREET.x, STREET.z1); g.strokeStyle = '#111'; g.lineWidth = Math.max(5, 15 * sc); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); g.strokeStyle = '#e7d7b8'; g.lineWidth = Math.max(3, 12 * sc); g.stroke(); }
    if (zoom) { for (const q of LOTS_MAP) rectL(q.lx - q.d / 2, q.z - q.w / 2, q.lx + q.d / 2, q.z + q.w / 2, q.col, '#222');
      for (const q of LOTS_MAP.filter(q => q.label)) TL(q.label, q.lx, q.z, q.ldx, q.ldy, 13, q.tc);
      for (const [id, lab] of [['shop', 'SHOP door (Timothy)'], ['stall_red', 'red stall'], ['stall_blue', 'blue stall']]) { const s = SHOP_SPOTS[id]; if (!s) continue; const [lx, lz] = CO.w2t(s.x, s.z), [a, b] = L(lx, lz);
        g.fillStyle = id === 'shop' ? '#ffc93c' : id === 'stall_red' ? '#ff3b3b' : '#3b82f6'; g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.arc(a, b, 6, 0, 7); g.fill(); g.stroke(); }
      for (const q of CO.PLAZA_POIS) { const [a, b] = L(q.lx, q.lz); g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.arc(a, b, 5, 0, 7); g.fill(); g.stroke(); }
      TL('WAVES + ARENA boards', -10, -12, -40, 70, 13); TL('Token exchange', CO.PLAZA_POIS[2].lx, CO.PLAZA_POIS[2].lz, 30, 90, 13); TL('Harbor market', -36, -32, -60, 30, 13);
      TL('Spectate spyglass + lighthouse', CO.MOLE.lx, CO.MOLE.lz1, 40, -10, 13); TL('Stone harbor tower', 86, -44, 50, 40, 13); TL('Step ashore (P1)', -90, 42, -20, -40, 13, '#67e8f9');
      TL('Cliff headland: FORT BATTERY (6 guns)', CO.HEADLAND.lx, CO.HEADLAND.lz, 30, 30, 13); TL('FORT (top of Main Street)', CO.FORT.lx, CO.FORT.lz, -20, 70, 13);
      TL('STONE QUAY + PLAZA', 20, -40, -80, 150, 14, '#fde68a'); TL('Wooden piers on stilts, shacks, rowboats', -180, 0, -10, 110, 13); TL('Sandbar islet', CO.ISLET.lx, CO.ISLET.lz, -10, -40, 13);
      TL('Main Street climbs to the gate (Trails A + B start here)', STREET.x, STREET.z1, -10, -115, 13, '#e7d7b8');
    } else {
      T('HARBOR BATTLE AREA', ...P(hx0 - 230, hz0 - 230), 20, '#fff', 'center'); T('sail + fight here', ...P(hx0 - 230, hz0 - 205), 14, '#fff', 'center');
      T('Battle edge 420 m (ships stopped)', ...P(hx0 - 300, hz0 + 330), 14, '#ff6b6b', 'center'); T('AI turn back 370 m', ...P(hx0 - 230, hz0 + 280), 13, '#ff9a3a', 'center');
      T('PLAYER SPAWN', ...(([a, b]) => [a, b - 18])(P(hx0, hz0)), 14, '#93c5fd', 'center'); T('respawn rings 40 / 85 / 130 m', ...P(hx0 - 60, hz0 + 150), 13, '#4ade80', 'center');
      T('AI / boss spawn rings 176 + 344 m', ...P(hx0 - 160, hz0 - 360), 13, '#fbbf24', 'center'); T('✕ = AI spawn that must move (on land / no-fire)', ...P(hx0 - 250, hz0 + 395), 13, '#ff6b6b', 'center');
      T('NO-FIRE SAFE HARBOR', ...L(-100, 100), 15, '#fff', 'center'); T('8 BERTHS (P1-P4, L/R)', ...L(-180, 62), 13, '#67e8f9', 'center');
      { const [a, b] = L(150, -140); T('DOCK TOWN', a, b, 20, '#fde68a', 'center'); T('(built into the coast)', a, b + 22, 13, '#fde68a', 'center'); } T('MAIN STREET', ...(([a, b]) => [a, b - 14])(L(STREET.x, -150)), 13, '#e7d7b8', 'center');
      T('FORT', ...(([a, b]) => [a + 18, b])(L(CO.FORT.lx, CO.FORT.lz)), 14); T('FORT BATTERY', ...(([a, b]) => [a + 14, b])(L(CO.HEADLAND.lx + 25, CO.HEADLAND.lz + 20)), 14);
      T('LIGHTHOUSE MOLE', ...(([a, b]) => [a + 12, b])(L(CO.MOLE.lx, CO.MOLE.lz1 + 10)), 13); T('SANDBAR', ...L(CO.ISLET.lx, CO.ISLET.lz + 32), 12, '#fff', 'center');
      T('MAIN ISLAND INTERIOR (on foot only)', ...P(-330, -420), 20, '#fff', 'center'); T('jungle, trails A + B, dig sites, Skull Peak →', ...P(-330, -395), 14, '#fff', 'center');
      line(pr, TRAILS.A, '#fa0d0d'); line(pr, TRAILS.B, '#ffc93c'); T('TRAIL A', ...P(-370, -175), 13, '#fa0d0d'); T('TRAIL B', ...P(-290, 140), 13, '#ffc93c');
      const [sa, sb] = P(hx0 - 400, hz0 + 420); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(sa, sb); g.lineTo(sa + 200 * sc, sb); g.stroke(); T('200 m', sa + 100 * sc, sb - 12, 13, '#fff', 'center');
    }
  };
  const line = (pr, p, col) => { g.setLineDash([10, 6]); g.strokeStyle = '#161616'; g.lineWidth = 5; g.beginPath(); p.forEach(([x, z], i) => { const [a, b] = pr.P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); g.strokeStyle = col; g.lineWidth = 2.5; g.stroke(); g.setLineDash([]); };
  // main panel: whole harbor + the town coast; inset: the town at ~4x
  const mainW = Math.round(Wd * 0.56), pr = proj(x0, x1, z0, z1, 0, 0, mainW, Hh); g.fillStyle = '#1f6e94'; g.fillRect(0, 0, Wd, Hh);
  g.save(); g.beginPath(); g.rect(0, 0, mainW, Hh); g.clip(); terrain(pr, 0, 0, mainW, Hh); draw(pr, false); g.restore();
  const ix = mainW + 8, iw = Wd - ix - 8, [ax, az] = CO.t2w(-300, 92), [bx, bz] = CO.t2w(205, -255);
  const ipr = proj(Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz), ix, 40, iw, Hh - 48);
  g.save(); g.beginPath(); g.rect(ix, 40, iw, Hh - 48); g.clip(); terrain(ipr, ix, 40, iw, Hh - 48); draw(ipr, true); g.restore();
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(ix, 40, iw, Hh - 48);
  g.font = 'bold 26px sans-serif'; g.textAlign = 'left'; g.lineWidth = 6; g.strokeStyle = '#111'; g.fillStyle = '#fde68a';
  g.strokeText('PUMPFUN PIRATES · harbor coast (blockout)', 14, 26); g.fillText('PUMPFUN PIRATES · harbor coast (blockout)', 14, 26);
  g.font = 'bold 18px sans-serif'; g.strokeText('TOWN CLOSE-UP: quay, piers, plaza, Main Street lots', ix + 6, 22); g.fillStyle = '#fff'; g.fillText('TOWN CLOSE-UP: quay, piers, plaza, Main Street lots', ix + 6, 22);
}
export const LOTS_MAP = [];

// [v105] island map bake (js/islandMap.js): one map pixel's colour (foot frame), returns 0 land, 1 steep face (walk limit), 2 water
const _mc = new THREE.Color(), _deep = new THREE.Color(0x174f70);
export function mapPixel(x, z, out) {
  const i = Math.round((x - X0) / G), j = Math.round((z - Z0) / G);
  if (i < 0 || j < 0 || i > NX || j > NZ) { out.copy(_deep); return 2; }
  const q = IDX(i, j), h = Hg[q];
  if (h < -4) { out.set(0x1f6e94).lerp(_deep, Math.min(1, (-h - 4) / 12)); return 2; }
  if (h < 0.3) { out.set(0x3fc6c9).lerp(_mc.set(0x1f8fb0), sm(0.3, -4, h)); return 2; }
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r || (RVg[q] < 5 && h < RVl[q] + 0.5)) { out.set(0x2fb8c9); return 2; }
  colorAt(i, j, out); return slopeAt(i, j) > WALK_RULES.slope ? 1 : 0;
}
export const MAP_PATHS = () => ({ A: TRAILS.A, B: TRAILS.B, street: STREETP, ramps: RAMPS.map(r => [[r.ax, r.az], [r.bx, r.bz]]), lake: LAKE, river: RIVERP });
// ---------- inland POIs ----------
export const FOOT_POIS = [];
export const LIGHTHOUSES = []; // [v108] { id, x, y, z, opts } built with the shared lighthouse kit (createFoot adds them to the root)
function poi(id, label, x, z, extra = {}) { const p = { id, label, x, z, y: H(x, z), action: null, ...extra }; FOOT_POIS.push(p); return p; }
export const BRIDGE = {};
export const DIGS = [];
const jagCone = (r, h, seg, seed) => { const g = new THREE.ConeGeometry(r, h, seg, 5), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), t = 0.5 - y / h, k = 1 + 0.3 * t * Math.sin(x * 0.9 + seed) * Math.sin(z * 1.1 + seed * 2) + 0.12 * t * Math.sin(y * 0.8 + seed); P.setXYZ(i, x * k, y, z * k); }
  g.computeVertexNormals(); return g; };
function boulder(k, x, z, s, seed, sink = 0.3) { if (NP) return natRock(x, z, s * 1.05, seed, sink * 0.5); W(k, jitter(new THREE.IcosahedronGeometry(1, 1), 0.22, seed), (px, py) => (py > 0.2 ? 0xa8a095 : 0x7f786f), 3, M(x, H(x, z) + s * (0.6 - sink), z, seed, 0.3, 0.2, [s * 1.2, s * 0.8, s])); }
export function buildInland(A, low, F) {
  const k = new Kit(); k.ao = (x, y, z) => 0.6 + 0.4 * sm(0, 2.6, y - H(x, z));
  // lighthouse: dressed-stone base, banded tower with stone trim rings, gallery + rail, lantern room, keeper's hut
  KPG = 'lighthouse';
  { const p = poi('lighthouse', 'Lighthouse', ...(COASTM ? CO.t2w(CO.MOLE.lx, CO.MOLE.lz1) : [-556, -236])), y = p.y - 0.3;
    // [v108] the shared lighthouse kit (island / rock / sandbar): tower + working light, door facing back along the mole
    const [bx, bz] = COASTM ? CO.t2w(CO.MOLE.lx, CO.MOLE.lz0) : [p.x + 10, p.z], doorYaw = Math.atan2(-(bz - p.z), bx - p.x);
    LIGHTHOUSES.length = 0; LIGHTHOUSES.push({ id: 'lighthouse', x: p.x, y: y + 0.3, z: p.z, opts: { height: 20, style: 'bands', base: 'none', hut: false, yaw: doorYaw, seed: 3, light: true } });
    if (COASTM) { const [sx, sz] = CO.t2w(CO.ISLET.lx, CO.ISLET.lz), sy = H(sx, sz), [qx, qz] = CO.t2w(CO.ISLET.lx, CO.ISLET.lz - 40); // sandbar: a short tower on a stone apron, door facing the docks
      poi('sandbar_lh', 'Sandbar lighthouse', sx, sz); addCirc(sx, sz, 5.2);
      LIGHTHOUSES.push({ id: 'sandbar_lh', x: sx, y: sy - 0.15, z: sz, opts: { height: 14, style: 'stone', base: 'apron', baseR: 4.6, hut: false, yaw: Math.atan2(-(qz - sz), qx - sx), seed: 5 } }); }
    addCirc(p.x, p.z, 7.4);
    colonial(k, F, p.x + 11, H(p.x + 11, p.z + 6), p.z + 6, -1.2, 6, 5, 1, 5, low); addBox(p.x + 11, p.z + 6, 6.6, 5.6, -1.2);
    for (let i = 0; i < 7; i++) boulder(k, p.x - 10 + hash(i, 3) * 6, p.z - 6 + i * 3, 1.4 + hash(i, 4) * 1.6, i); }
  // rope bridge over the gorge: jittered planks, rope rails + hangers, side netting, anchor posts with rope wraps
  { const c = ROPE_BRIDGE.c, deckY = H(c[0], c[1]) + 24, out = (dz) => { let z = c[1]; while (H(c[0], z) < deckY && Math.abs(z - c[1]) < 90) z += dz; return [c[0], z]; };
    const [ax, az] = out(-1), [bx, bz] = out(1), L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), sag = Math.min(3.5, L * 0.05);
    Object.assign(BRIDGE, { ax, az, bx, bz, L, yaw, deckY, sag, half: 1.35 });
    const p = poi('bridge', 'Rope bridge over the gorge', (ax + bx) / 2, (az + bz) / 2, { deck: deckY });
    const n = Math.round(L / 0.62), cs = Math.cos(yaw), sn = Math.sin(yaw), Y = (t) => deckY - Math.sin(t * Math.PI) * sag;
    if (KP) { KPG = 'bridge'; // Blender pieces: chunky A-frame towers with lanterns, lashed planks, thick hand ropes + hangers + stays (reads at range)
      const rope = (a, b, r) => { const d = b.clone().sub(a), L2 = d.length(); kp(k, 'ropeSeg', new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()), new THREE.Vector3(r, r, L2 + r))); };
      const at = (t, s, up) => new THREE.Vector3(ax + (bx - ax) * t + cs * s * 1.5, Y(t) + up, az + (bz - az) * t - sn * s * 1.5);
      for (let i = 0; i <= n; i++) { const t = i / n; if (hash(i, 9) > 0.97 && i > 3 && i < n - 3) continue;
        kp(k, 'bridgePlank', M(ax + (bx - ax) * t, Y(t) - 0.02, az + (bz - az) * t, yaw + (hash(i, 3) - 0.5) * 0.06, 0, 0, [1 + hash(i, 1) * 0.06, 1, 1])); }
      const S = 24; for (const s of [-1, 1]) { for (let i = 0; i < S; i++) { rope(at(i / S, s, 1.15), at((i + 1) / S, s, 1.15), 0.085); rope(at(i / S, s, 0.02), at((i + 1) / S, s, 0.02), 0.06); }
        for (let i = 2; i < n - 1; i += 3) { const t = i / n; rope(at(t, s, 0.02), at(t, s, 1.15), 0.03); } }
      for (const [x, z, dir] of [[ax, az, -1], [bx, bz, 1]]) { const tx = x + Math.sin(yaw) * dir * 1.2, tz = z + Math.cos(yaw) * dir * 1.2, ty = H(tx, tz);
        kp(k, 'bridgeTower', M(tx, ty, tz, yaw)); F.push({ x: tx, y: ty + 4.6, z: tz, lamp: true });
        for (const s of [-1, 1]) { const top = new THREE.Vector3(tx + cs * s * 1.85, ty + 5.3, tz - sn * s * 1.85), t0 = dir < 0 ? 0 : 1, tt = dir < 0 ? 0.12 : 0.88;
          rope(top, at(t0, s, 1.15), 0.085); rope(top, at(tt, s, 1.15), 0.06); addCirc(tx + cs * s * 1.85, tz - sn * s * 1.85, 0.4);
          const back = new THREE.Vector3(tx + cs * s * 1.9 + Math.sin(yaw) * dir * 4, H(tx + cs * s * 1.9 + Math.sin(yaw) * dir * 4, tz - sn * s * 1.9 + Math.cos(yaw) * dir * 4) + 0.2, tz - sn * s * 1.9 + Math.cos(yaw) * dir * 4);
          rope(top, back, 0.07); kp(k, 'bollard', M(back.x, back.y - 0.3, back.z)); } }
      KPG = 'lighthouse';
    } else {
    for (let i = 0; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (hash(i, 9) > 0.96 && i > 2 && i < n - 2) continue; // a missing plank or two
      W(k, box(2.9 + hash(i, 1) * 0.3, 0.12, 0.5), hash(i, 2) > 0.5 ? WOOD_L : 0xc28a55, 2, M(x, Y(t), z, yaw + (hash(i, 3) - 0.5) * 0.08), false);
      if (i % 4 === 0) for (const s of [-1, 1]) W(k, cyl(0.035, 0.035, 1.15, 4), 0xc9a36b, 12, M(x + cs * s * 1.45, Y(t) + 0.6, z - sn * s * 1.45), false); }
    for (const s of [-1, 1]) for (const hgt of [1.15, 0.05]) { const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(new THREE.Vector3(ax + (bx - ax) * t + cs * s * 1.45, Y(t) + hgt, az + (bz - az) * t - sn * s * 1.45)); }
      W(k, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, hgt > 1 ? 0.07 : 0.05, 5), 0xc9a36b, 12, null, false); }
    if (!low) for (const s of [-1, 1]) for (let i = 0; i < n; i += 3) { const t0 = i / n, t1 = Math.min(1, (i + 3) / n), x0 = ax + (bx - ax) * t0 + cs * s * 1.45, z0 = az + (bz - az) * t0 - sn * s * 1.45, x1 = ax + (bx - ax) * t1 + cs * s * 1.45, z1 = az + (bz - az) * t1 - sn * s * 1.45;
      const g = new THREE.CylinderGeometry(0.02, 0.02, 1.0, 3); const a = new THREE.Vector3(x0, Y(t0) + 0.1, z0), b = new THREE.Vector3(x1, Y(t1) + 1.1, z1), d = b.clone().sub(a);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())); g.scale(1, 1, 1); k.add(g, 0xbf9a62, { m: M((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, 0, 0, 0, [1, d.length(), 1]), outline: false, mat: 12 }); }
    for (const [x, z] of [[ax, az], [bx, bz]]) for (const s of [-1, 1]) { const px = x + cs * s * 1.9, pz = z - sn * s * 1.9, py = H(px, pz);
      W(k, cyl(0.24, 0.3, 3.2, 7), WOOD_D, 2, M(px, py + 1.2, pz)); for (let r = 0; r < 3; r++) W(k, cyl(0.31, 0.31, 0.12, 7), 0xc9a36b, 12, M(px, py + 1.8 + r * 0.22, pz), false); addCirc(px, pz, 0.35);
      torchPost(k, F, px + cs * s * 0.9, py, pz - sn * s * 0.9); } } }
  // Skull Peak: a giant skull carved in the peak's north face, gold-glowing eye caves, an enterable treasure cave through the jaw
  { const S0 = SKULL, y = S0.y, p = poi('skullpeak', 'Skull Peak: treasure cave (walk in)', S0.x, S0.z - 6, { clear: 45 });
    const R = Math.PI, toW = (lx, lz) => [S0.x + Math.cos(R) * lx + Math.sin(R) * lz, S0.z - Math.sin(R) * lx + Math.cos(R) * lz];
    KPG = 'skull';
    if (NP) { np('skull', NM(S0.x, y, S0.z, R));
      for (let i = 0; i < 6; i++) { const [sx, sz] = toW(-16 + i * 6.4, -18 - hash(i, 9) * 8); np('spire0', NM(sx, y - 2, sz, i * 1.3, 6 + hash(i, 7) * 3, 7 + hash(i, 8) * 4)); }
      for (let i = 0; i < 10; i++) { const a = i * 0.63, [rx, rz] = toW(Math.cos(a) * 24, -4 + Math.sin(a) * 20); natRock(rx, rz, 2.2 + hash(i, 5) * 2.4, 60 + i, 0.4, i % 3 ? 'rock' : 'cliff'); } }
    k.at(M(S0.x, y, S0.z, R), () => {
      const bone = (px, py) => (py > 14 ? 0xd9cfbd : 0xb9ad98);
      if (NP) { for (const sx of [-1, 1]) k.add(new THREE.SphereGeometry(2.4, 12, 8), GOLD, { bucket: 'glow', m: M(sx * 5.4, 15.2, 7.6, 0, 0, 0, [1, 1.1, 0.4]), outline: false }); } else {
      W(k, jitter(new THREE.IcosahedronGeometry(14, 2), 0.05, 2), bone, 3, M(0, 18, -5, 0, 0, 0, [1.15, 1.0, 0.95]), false);
      for (const sx of [-1, 1]) { W(k, jitter(new THREE.IcosahedronGeometry(5.5, 1), 0.08, sx + 3), bone, 3, M(sx * 7.8, 5.5, 3, 0, 0, 0, [1, 1.3, 1.1]), false);   // cheekbones / jaw hinge
        W(k, new THREE.SphereGeometry(4.0, 14, 10), 0x15100a, 0, M(sx * 5.2, 17, 7.6, 0, 0, 0, [1, 1.15, 0.45]), false);
        k.add(new THREE.SphereGeometry(2.6, 12, 8), GOLD, { bucket: 'glow', m: M(sx * 5.2, 16.6, 8.9, 0, 0, 0, [1, 1.1, 0.25]), outline: false }); }
      W(k, new THREE.ConeGeometry(1.8, 3.6, 3), 0x15100a, 0, M(0, 11.6, 9.3, 0, Math.PI), false);
      for (let i = -3; i <= 3; i++) W(k, box(1.3, 2.0, 1.4), 0xebe3d2, 3, M(i * 1.45 + (i > 0 ? 0.6 : i < 0 ? -0.6 : 0) * 0, 7.2, 6.4), false); // upper teeth over the cave mouth
      W(k, box(16, 2.4, 3.5), bone, 3, M(0, 9.0, 5.0), false); }
      // the cave (inward-facing shell): floor, walls, ceiling; gold hoard, chests, torches
      const room = (w, h, d, mx, my, mz, ry) => { const g = new THREE.PlaneGeometry(w, h); W(k, g, 0x6a5643, 3, M(mx, my, mz, ry), false); };
      room(13, 7, 0, 0, 3.5, -12.5, 0); room(18, 7, 0, -6.5, 3.5, -3.5, Math.PI / 2); room(18, 7, 0, 6.5, 3.5, -3.5, -Math.PI / 2);
      { const g = new THREE.PlaneGeometry(13, 18); g.rotateX(Math.PI / 2); W(k, g, 0x4f4032, 3, M(0, 7, -3.5), false); }
      for (const sx of [-1, 1]) room(3.5, 7, 0, sx * 4.75, 3.5, 5.4, Math.PI); room(6, 1.5, 0, 0, 6.25, 5.4, Math.PI);
      { const g = new THREE.PlaneGeometry(13, 18); g.rotateX(-Math.PI / 2); W(k, g, 0xa08a64, 0, M(0, 0.08, -3.5), false); }
      for (let i = 0; i < 9; i++) { const gx = -4 + (i % 3) * 4 + hash(i, 1), gz = -10 + Math.floor(i / 3) * 3.2; k.add(new THREE.ConeGeometry(1.2 + hash(i, 2), 1.0 + hash(i, 3) * 0.6, 10), GOLD, { m: M(gx, 0.45, gz), outline: false, mat: 0 });
        if (i % 2 === 0) k.add(new THREE.SphereGeometry(0.5, 8, 6), 0xffe9a0, { bucket: 'glow', m: M(gx, 1.0, gz), outline: false }); }
      for (const sx of [-1, 1]) { k.at(M(sx * 4.2, 0, -11, sx * -0.4), () => { W(k, box(2.2, 1.3, 1.4), WOOD, 2, M(0, 0.65, 0)); W(k, box(2.25, 0.18, 1.45), GOLD, 0, M(0, 1.0, 0), false); W(k, box(2.2, 0.25, 1.4), WOOD_D, 2, M(0, 1.55, -0.55, 0, -1.0), false); k.add(new THREE.SphereGeometry(0.7, 10, 6, 0, 6.29, 0, Math.PI / 2), 0xffd75a, { bucket: 'glow', m: M(0, 1.2, 0, 0, 0, 0, [1.2, 0.5, 0.75]), outline: false }); }); }
      if (!NP) for (let i = 0; i < 6; i++) W(k, jagCone(6 + hash(i, 7) * 4, 22 + hash(i, 8) * 16, low ? 5 : 7, i), (px, py) => (py > 0 ? 0x9a8f80 : 0x7a6f62), 3, M(-16 + i * 6.4, 10, -18 - hash(i, 9) * 8, i), false);
    });
    for (const [lx, lz, sx] of [[-4, -6, 1], [4, -6, -1], [0, -11.8, 1]]) { const [x, z] = toW(lx, lz); F.push({ x, y: y + 2.4, z, cave: true }); const [px, pz] = toW(lx + sx * 0.3, lz); W(k, box(0.12, 0.6, 0.12), IRON, 0, M(px, y + 2.0, pz), false); }
    for (const [cx, cz, w, d] of [[-11.5, -2.5, 9, 22], [11.5, -2.5, 9, 22], [0, -19, 32, 12], [-5, 6.2, 4, 2.2], [5, 6.2, 4, 2.2]]) { const [x, z] = toW(cx, cz); addBox(x, z, w, d, R); }
    const [ex, ez] = toW(0, 8); INTERACT.push({ id: 'cave', x: ex, z: ez, r: 4, label: 'TREASURE CAVE · walk in', info: true });
  }
  KPG = 'cove';
  // smugglers' cove: plank-built wreck on its side, broken masts, torn sail, a jetty with nets, crates, a campfire
  { const c = COVES[0], wx = c[0] - 8, wz = c[1] + 6; poi('cove', "Smugglers' cove + shipwreck", wx, wz);
    k.at(M(wx, -1.0, wz, 0.9, 0, 0.42), () => {
      for (let r = 0; r < 9; r++) { const zz = -11 + r * 2.8, wdt = 3.6 * Math.cos((zz / 15) * 1.2); for (const s of [-1, 1]) W(k, box(0.35, 5, 0.35), 0x4a3020, 2, M(s * wdt, 2, zz, 0, 0, s * 0.25), false); }
      for (let pl = 0; pl < 8; pl++) { const yy = -0.3 + pl * 0.6; if (pl === 5) continue; for (const s of [-1, 1]) W(k, box(0.16, 0.55, 22 - pl * 0.6), pl % 2 ? 0x6b4a2a : 0x5a3c22, 2, M(s * (3.0 - Math.abs(pl - 3) * 0.25), yy, 0, 0, 0, s * 0.2)); }
      W(k, box(6.6, 0.3, 21), 0x3e2a18, 2, M(0, 4.2, 0), false); W(k, new THREE.ConeGeometry(3.4, 7, 4), 0x5a3c22, 2, M(0, 1.8, 14, Math.PI / 4, Math.PI / 2, 0, [1.1, 1, 0.7]));
      W(k, box(5.2, 3, 6), 0x6b4a2a, 2, M(0, 5.8, -9)); W(k, cyl(0.4, 0.5, 15, 7), WOOD_D, 2, M(0, 11, 2, 0, 0.3)); W(k, cyl(0.3, 0.4, 6, 7), WOOD_D, 2, M(0, 6, -4, 0, -0.9));
      const sail = new THREE.PlaneGeometry(7, 5, 6, 4), P = sail.attributes.position; for (let i = 0; i < P.count; i++) { P.setZ(i, Math.sin(P.getX(i) * 0.6) * 0.5); if (P.getY(i) < -1.5 && hash(i, 3) > 0.5) P.setY(i, P.getY(i) + 1.2); }
      k.add(sail, 0xe2d4b6, { m: M(0, 12, 2.8, 0, 0.3, 0.15), outline: false, mat: 12 }); });
    addBox(wx, wz, 9, 26, 0.9);
    const jx = c[0] + 20, jz = c[1] - 20, jy = 1.5;
    for (let i = 0; i < 10; i++) { const x = jx - i * 1.25, z = jz + i * 1.25; W(k, box(3, 0.22, 1.2), WOOD_L, 2, M(x, jy, z, -0.78), false); if (i % 3 === 0) for (const s of [-1, 1]) W(k, cyl(0.15, 0.17, 4, 6), WOOD_D, 2, M(x + s * 1.1, jy - 1.4, z + s * 1.1), false); }
    const cx = jx + 5, cz = jz - 5, cy = H(cx, cz);
    for (let i = 0; i < 5; i++) crate(k, M(cx + 2 + hash(i, 4) * 3, H(cx + 2, cz - 3), cz - 3 - i * 1.5, hash(i, 5)), 1.2);
    for (let i = 0; i < 3; i++) barrel(k, M(cx - 2 + i * 1.4, H(cx - 2, cz + 2), cz + 2 + hash(i, 6)));
    for (let i = 0; i < 6; i++) W(k, jitter(new THREE.IcosahedronGeometry(0.35, 0), 0.2, i), 0x7d766e, 3, M(cx + Math.cos(i) * 1.1, cy + 0.15, cz + 6 + Math.sin(i) * 1.1), false); F.push({ x: cx, y: cy + 0.3, z: cz + 6, fire: true });
    addCirc(cx + 3.5, cz - 6, 3.5); addCirc(cx - 0.6, cz + 2.5, 2.2); }
  // gallows hill: gallows on a plank stage, ruined stone keep walls with arches, fallen column drums, torches
  KPG = 'gallows';
  { const g = GALLOWS_HILL, y = H(g.x, g.z); poi('gallows', 'Gallows hill + ruins', g.x, g.z, { clear: 34 });
    W(k, box(9, 1.2, 7), WOOD, 2, M(g.x, y + 0.6, g.z)); for (let i = 0; i < 3; i++) W(k, box(2.4, 0.25, 0.9), WOOD_L, 2, M(g.x, y + 0.25 + i * 0.35, g.z + 4 + i * -0.5), false);
    for (const s of [-1, 1]) W(k, box(0.55, 6.5, 0.55), WOOD_D, 2, M(g.x + s * 3, y + 4.2, g.z)); W(k, box(7.4, 0.55, 0.55), WOOD_D, 2, M(g.x, y + 7.3, g.z));
    W(k, box(0.4, 0.4, 2.2), WOOD_D, 2, M(g.x - 2.4, y + 6.6, g.z, 0, 0.7), false); W(k, new THREE.TorusGeometry(0.38, 0.07, 5, 10), 0xc9a36b, 12, M(g.x, y + 4.6, g.z), false); W(k, cyl(0.05, 0.05, 2.1, 4), 0xc9a36b, 12, M(g.x, y + 6.0, g.z), false);
    addBox(g.x, g.z, 9.4, 7.4, 0);
    for (let i = 0; i < 12; i++) { const a = i * 0.55 + 0.3, r = 16 + hash(i, 9) * 9, x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r, yy = H(x, z), hh = 2.5 + hash(i, 8) * 6;
      if (i % 3 === 1) { W(k, cyl(0.9, 1.0, hh, 10), STONE, 11, M(x, yy + hh / 2 - 0.3, z)); W(k, box(2.3, 0.5, 2.3), STONE_D, 11, M(x, yy + 0.1, z), false); addCirc(x, z, 1.1); }
      else if (i % 3 === 2) { W(k, cyl(0.9, 0.9, 1.8, 10), STONE, 11, M(x, yy + 0.8, z, a, 0, Math.PI / 2)); addCirc(x, z, 1.0); }
      else { const wl = 7, g2 = box(wl, hh, 1.4); const P = g2.attributes.position; for (let v = 0; v < P.count; v++) if (P.getY(v) > 0) P.setY(v, P.getY(v) - hash(Math.round(P.getX(v) * 3), i) * hh * 0.5);
        W(k, g2, STONE, 11, M(x, yy + hh / 2 - 0.4, z, a)); if (hh > 5) W(k, box(1.6, 2.6, 1.6), 0x2a2a2a, 0, M(x, yy + 1.2, z, a), false); addBox(x, z, wl, 1.6, a); } }
    for (const s of [-1, 1]) torchPost(k, F, g.x + s * 5.5, y, g.z + 4.5); }
  // waterfall pool: boulders round the lagoon edge under the falls
  KPG = 'falls';
  { const fx = FALLS_CLIFF.x + 6, fz = LAKE.z - LAKE.r + 2; poi('falls', 'Waterfall + lagoon', fx, fz, { clear: 30 });
    for (let i = 0; i < 10; i++) { const a = Math.PI * 1.1 + i * 0.13, x = LAKE.x + Math.cos(a) * (LAKE.r + 2), z = LAKE.z + Math.sin(a) * (LAKE.r + 2); boulder(k, x, z, 1.6 + hash(i, 2) * 2.2, i + 20); }
    for (const s of [-1, 1]) boulder(k, fx + s * 7, fz - 3, 3.2, 40 + s); }
  KPG = 'digs';
  // beach dig sites: buried chests (interactive, js/island/main.js); static dressing here
  for (const [x0, z0, n] of [[-306, 150, 1], [-82, 456, 2], [340, -360, 3]]) { const [x, z] = beachNear(x0, z0), y = H(x, z); poi('dig' + n, 'Dig site ' + n, x, z);
    DIGS.push({ id: 'dig' + n, x, z, y }); INTERACT.push({ id: 'dig' + n, x, z, r: 3, label: 'E · DIG' });
    for (const r of [0.6, -0.6]) W(k, box(4.4, 0.08, 0.5), RED, 0, M(x + 3.5, y + 0.06, z + 2.5, r), false);
    W(k, cyl(0.06, 0.06, 1.8, 5), WOOD_D, 2, M(x - 2.6, y + 0.8, z - 1.6, 0, 0.3, 0.2), false); W(k, box(0.5, 0.6, 0.06), IRON, 0, M(x - 2.9, y + 0.15, z - 1.75, 0, 0.3, 0.2), false);
    W(k, cyl(0.05, 0.05, 2.4, 4), WOOD_D, 2, M(x + 1.5, y + 1.2, z - 2.5), false); W(k, box(0.9, 0.6, 0.04), RED, 12, M(x + 1.95, y + 2.1, z - 2.5), false);
    for (let i = 0; i < 4; i++) boulder(k, x + Math.cos(i * 1.7) * 7, z + Math.sin(i * 1.7) * 7, 0.6 + hash(i, n) * 0.7, i + n * 10); }
  KPG = 'trail';
  // trail torches every ~45 m (flames + lights)
  for (const path of Object.values(TRAILS)) { let acc = 0; for (let i = 1; i < path.length; i++) { acc += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); if (acc > 45) { acc = 0;
    const [x, z] = path[i], dx = path[i][0] - path[i - 1][0], dz = path[i][1] - path[i - 1][1], n = Math.hypot(dx, dz) || 1, tx = x + dz / n * 3.2, tz = z - dx / n * 3.2; if (H(tx, tz) > 1) torchPost(k, F, tx, H(tx, tz), tz); } } }
  poi('gate', 'Town gate (trailhead A + B)', GATE[0], GATE[1]);
  for (const [id, ty, up, d0, d1] of [['skullpeak', 14, 2.2, 45, 120], ['gallows', 4, 1.7, 45, 120], ['falls', LAKE.y + 12 - H(-206, -186), 1.7, 60, 150]]) { const q = FOOT_POIS.find(p => p.id === id); q.view = vantage(q, q.y + ty, up, d0, d1); q.ty = q.y + ty; }
  return k;
}
// one dig site's interactive chest (separate small mesh group so it can animate)
function digChest(MATS, OUT, low) {
  const mk = () => { const q = new Kit(); if (low) { const add = q.add.bind(q); q.add = (g, c, o = {}) => add(g, c, { ...o, outline: false }); } return q; }, k = mk(); // Low: no outline shells (fewer calls)
  W(k, new THREE.SphereGeometry(1.9, 12, 6, 0, 6.29, 0, Math.PI / 2), 0xe8cf95, 0, M(0, -0.1, 0, 0, 0, 0, [1, 0.45, 1]));
  const mound = k.build(MATS, OUT);
  const c = mk(); W(c, box(1.7, 1.0, 1.1), WOOD, 2, M(0, 0.5, 0)); for (const sx of [-0.7, 0.7]) W(c, box(0.12, 1.04, 1.14), IRON, 0, M(sx, 0.5, 0), false);
  c.add(new THREE.SphereGeometry(0.6, 10, 6, 0, 6.29, 0, Math.PI / 2), 0xffd75a, { bucket: 'glow', m: M(0, 0.95, 0, 0, 0, 0, [1.25, 0.45, 0.8]), outline: false });
  const chest = c.build(MATS, OUT);
  const l = mk(); W(l, box(1.75, 0.3, 1.15), WOOD_D, 2, M(0, 0.15, 0.55)); W(l, box(0.3, 0.3, 0.1), GOLD, 0, M(0, 0.05, 1.12), false);
  const lid = l.build(MATS, OUT); lid.position.set(0, 1.0, -0.55);
  const grp = new THREE.Group(), cg = new THREE.Group(); cg.add(chest, lid); grp.add(mound, cg); return { grp, mound, cg, lid };
}

// ---------- assemble ----------
export function createFoot({ scene, isle, MATS, OUT, low, atlas, uTime, uWaves, renderer, kit = null, nat = null, decorHulls = true }) { // [Emerly] decorHulls
  const root = new THREE.Group(); root.name = 'foot'; scene.add(root);
  const F = [];                                                  // torch / lamp / fire flame spots
  const NCX = Math.ceil(NX / CH), NCZ = Math.ceil(NZ / CH), chunks = [];
  for (let cj = 0; cj < NCZ; cj++) for (let ci = 0; ci < NCX; ci++) {
    const cx = X0 + (ci * CH + Math.min(CH, NX - ci * CH) / 2) * G, cz = Z0 + (cj * CH + Math.min(CH, NZ - cj * CH) / 2) * G;
    let land = false; for (let j = cj * CH; j <= Math.min(NZ, cj * CH + CH) && !land; j += 4) for (let i = ci * CH; i <= Math.min(NX, ci * CH + CH); i += 4) if (Hg[IDX(i, j)] > -8) { land = true; break; }
    if (!land) continue;
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), MATS.toon); mesh.receiveShadow = !low; mesh.name = `chunk_${ci}_${cj}`; mesh.visible = false;
    chunks.push({ ci, cj, cx, cz, mesh, geos: {}, lod: -1 }); root.add(mesh);
  }
  // terrain LOD steps by chunk distance (centre - 160 m): High 4 / 8 / 16 / 32 m grid, Low 8 / 16 / 32 m
  const LODS = low ? [[0, 2], [150, 4], [330, 8]] : [[0, 1], [110, 2], [300, 4], [560, 8]], VIEW_R = low ? 560 : 1100;
  // kits: street (world coords) + inland POIs, each a handful of merged meshes
  KP = kit ? {} : null; NK = nat; NP = nat ? {} : null;
  const fm = foliageMat(low, uTime, nat ? nat.cards : null);
  const street = buildStreet(atlas.R, low, F).build(MATS, OUT); street.name = 'foot_street'; root.add(street);
  const inland = buildInland(atlas.R, low, F).build(MATS, OUT); inland.name = 'foot_pois'; root.add(inland);
  const coast = COASTM ? buildCoast(atlas.R, low, F, decorHulls).build(MATS, OUT) : null; if (coast) { coast.name = 'foot_coast'; root.add(coast); }
  // kit groups (one merged mesh each, distance-culled): town kit (street, lighthouse, bridge, cove...) + nature kit (skull, rocks)
  const groups = []; let kitN = 0, kitTris = 0, natN = 0, natTris = 0;
  // High: the coast kit group (the waterfront runs ~700 m) is cut into KIT_TILE m tiles so each tile frustum-culls (main + shadow pass)
  // and swaps to its LOD1 twin on its own distance; one 700 m mesh never left LOD0 and drew all of its 170k tris twice. Low: whole groups.
  const KIT_TILE = 250; if (KP && !low) KP = Object.fromEntries(Object.entries(KP).flatMap(([gname, list]) => { const T = {}, X = list.map(e => e[1].elements[12]), Z = list.map(e => e[1].elements[14]);
    if (gname !== 'coast' || Math.max(Math.max(...X) - Math.min(...X), Math.max(...Z) - Math.min(...Z)) < 1.6 * KIT_TILE) return [[gname, list]]; // the trail's small markers stay one mesh
    for (const e of list) { const key = gname + '_' + Math.floor(e[1].elements[12] / KIT_TILE) + '_' + Math.floor(e[1].elements[14] / KIT_TILE); (T[key] = T[key] || []).push(e); }
    return Object.entries(T); }));
  if (KP) for (const [gname, list] of Object.entries(KP)) { const m = kitMesh(kit, list, 'foot_townkit_' + gname); if (!m) continue; root.add(m); groups.push(m); kitN += list.length; kitTris += m.userData.tris;
    if (!low) { const f = kitMesh(kit, list, 'foot_townkit_' + gname + '_lod1', true); if (f) { f.castShadow = false; f.visible = false; root.add(f); m.userData.far = f; } } } // High: LOD1 twin beyond ~170 m
  if (NP) for (const [gname, list] of Object.entries(NP)) { const parts = list.map(([nm, lod, m]) => { const g = nat.get(nm, low ? 1 : lod); return g ? g.clone().applyMatrix4(m) : null; }).filter(Boolean);
    if (!parts.length) continue; const g = safeNormals(mergeGeometries(parts, false)); parts.forEach(p => p.dispose()); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, fm); m.name = 'foot_nature_' + gname; m.castShadow = m.receiveShadow = !low; m.customDepthMaterial = fm.userData.depth; root.add(m); groups.push(m);
    natN += list.length; natTris += (g.index ? g.index.count : g.attributes.position.count) / 3; }
  const kitM = groups[0] || null; KP = null; NP = null;
  for (const g of [street, inland, coast].filter(Boolean)) g.traverse(o => { if (o.isMesh && !o.userData.outline && o.userData.bucket !== 'glow') { o.castShadow = !low; o.receiveShadow = !low; } });
  // water: shoreline shallows + foam, river + lake flow, waterfall + mist
  const hTex = heightTexture();
  const sea = shallows(uTime, uWaves, low, hTex); root.add(sea);
  const fresh = freshWater(uTime, low); root.add(fresh);
  let top = H(FALLS_CLIFF.x + 6, LAKE.z - LAKE.r - 10); if (!isFinite(top)) top = LAKE.y + 30; const [fall, mist] = waterfall(uTime, Math.max(top, LAKE.y + 20), low); root.add(fall); if (!low) root.add(mist);
  // foliage (instanced, streamed nearest-N around the camera)
  const spots = foliageSpots();
  // [v105] solid trees + rocks: trunk-sized circles (never bigger than the mesh, so no invisible walls), none on a trail, the
  // main street, the bridge approaches or a POI clearing (foliageSpots already keeps those clear; this re-checks the jittered spot)
  if (WALK_RULES.trees) { const B0 = (x, z) => BRIDGE_ENDS.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 14);
    const okAt = (x, z) => trailDist(x, z) > 5 && gridAt(STg, x, z) > 26 && !B0(x, z);
    for (const t of spots.trees) if (okAt(t[0], t[2])) addCirc(t[0], t[2], 0.45);
    for (const t of spots.palms) if (okAt(t[0], t[2])) addCirc(t[0], t[2], 0.32);
    for (const t of spots.rocks) if (okAt(t[0], t[2])) addCirc(t[0], t[2], 0.35 * (0.7 + t[3] * 2.4));
    for (const t of spots.cliffs) if (okAt(t[0], t[2])) addCirc(t[0], t[2], 0.35 * (3.2 + t[3] * 4.2)); }
  // foliage buckets: [kind(s), geometry, variant (-1 any), r0, r1 (m from the camera), cap, casts shadow]. High: per-variant LOD0 up close,
  // one LOD1 mesh beyond; Low: one LOD1 mesh per kind (4 calls, as before). Procedural fallback (&nature=0): the old blockout shapes.
  let BK;
  if (nat) BK = low ? [[['trees'], 'tree0', -1, 0, 210, 520, 0], [['palms'], 'palm1', -1, 0, 210, 200, 0], [['ferns'], 'fern', -1, 0, 70, 300, 0], [['rocks', 'cliffs'], 'cliff0', -1, 0, 300, 360, 0]]
    : [[['trees'], 'tree0', 0, 0, 75, 160, 1], [['trees'], 'tree1', 1, 0, 75, 160, 1], [['trees'], 'tree2', 2, 0, 75, 160, 1], [['trees'], 'tree2_far', -1, 75, 330, 1700, 0],
       [['palms'], 'palm0', 0, 0, 70, 90, 1], [['palms'], 'palm1', 1, 0, 70, 90, 1], [['palms'], 'palm2', 2, 0, 70, 90, 1], [['palms'], 'palm1_far', -1, 70, 360, 600, 0],
       [['ferns'], 'fern', -1, 0, 120, 1600, 0], [['rocks'], 'rock0', -1, 0, 110, 400, 1], [['rocks'], 'rock1_far', -1, 110, 320, 500, 0],
       [['cliffs'], 'cliff0', -1, 0, 220, 300, 1], [['cliffs'], 'cliff1_far', -1, 220, 620, 600, 0]];
  else { const geo = treeGeos(low); BK = [[['trees'], geo.tree, -1, 0, low ? 210 : 380, low ? 520 : 2400, !low], [['palms'], geo.palm, -1, 0, low ? 210 : 380, low ? 200 : 600, !low],
    [['ferns'], geo.fern, -1, 0, low ? 70 : 140, low ? 300 : 2000, 0], [['rocks', 'cliffs'], geo.rock, -1, 0, low ? 160 : 300, low ? 160 : 700, !low]]; }
  const IM = {}, BUCKETS = BK.map(([kinds, g, v, r0, r1, cap, sh], i) => {
    const geom = typeof g === 'string' ? nat.get(g.replace('_far', ''), g.endsWith('_far') || low ? 1 : 0) : g;
    if (geom) safeNormals(geom);
    const m = new THREE.InstancedMesh(geom, fm, cap); m.count = 0; m.frustumCulled = false; m.castShadow = !low && !!sh; m.receiveShadow = !low; m.name = 'foot_' + kinds[0] + '_' + (typeof g === 'string' ? g : i);
    if (fm.userData.depth) m.customDepthMaterial = fm.userData.depth; root.add(m); IM[m.name] = m; return { kinds, v, r0, r1, cap, m, n: 0 }; });
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const SC = nat ? { trees: [0.75, 0.55], palms: [0.85, 0.4], ferns: [0.8, 0.9], rocks: [0.7, 2.4], cliffs: [3.2, 4.2] } : { trees: [0.8, 1.6], palms: [0.85, 0.5], ferns: [0.8, 0.9], rocks: [0.8, 2.8], cliffs: [2.0, 3.0] };
  const KINDS = ['trees', 'palms', 'ferns', 'rocks', 'cliffs'], RMAX = Object.fromEntries(KINDS.map(k => [k, Math.max(0, ...BUCKETS.filter(b => b.kinds.includes(k)).map(b => b.r1))]));
  function fill(cx, cz, all = false) {
    for (const b of BUCKETS) b.n = 0;
    for (const k of KINDS) { const R = all ? 5000 : RMAX[k], near = [];
      for (const t of spots[k]) { const d = (t[0] - cx) ** 2 + (t[2] - cz) ** 2; if (d < R * R && (all || k !== 'trees' || d > 330)) near.push([Math.sqrt(d), t]); }
      near.sort((a, b) => a[0] - b[0]);
      const bl = BUCKETS.filter(b => b.kinds.includes(k));
      for (const [d, t] of near) { const v = Math.floor(t[3] * 37) % 3, b = all ? bl[bl.length - 1] : bl.find(b => d >= b.r0 && d < b.r1 && (b.v < 0 || b.v === v) && b.n < b.cap); if (!b || b.n >= b.cap) continue;
        const s = SC[k][0] + t[3] * SC[k][1], tall = k === 'cliffs' ? 1.0 + t[3] * 0.6 : k === 'trees' ? 0.9 + t[3] * 0.3 : 0.9 + t[3] * 0.4;
        _q.setFromAxisAngle(_up, t[3] * 40); _s.set(s, s * tall, s); _p.set(t[0], t[1] - (k === 'rocks' ? 0.45 * s : k === 'cliffs' ? 0.9 * s : 0.3), t[2]); _m.compose(_p, _q, _s); b.m.setMatrixAt(b.n++, _m); } }
    for (const b of BUCKETS) { b.m.count = b.n; b.m.instanceMatrix.needsUpdate = true; } }
  // grass + flowers (instanced, a ring round the camera)
  const gg = grassGeos(), gMat = grassMaterial(new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide }), uTime);
  const GCAP = low ? 1400 : 9000, FCAP = low ? 0 : 900, GR = low ? 30 : 55;
  const imGrass = new THREE.InstancedMesh(gg.grass, gMat, GCAP); imGrass.count = 0; imGrass.frustumCulled = false; imGrass.name = 'foot_grass'; root.add(imGrass);
  const imFlow = new THREE.InstancedMesh(gg.flower, gMat, FCAP); imFlow.count = 0; imFlow.frustumCulled = false; imFlow.name = 'foot_flowers'; if (FCAP) root.add(imFlow); // Low: no flowers (1 call)
  const FLC = [0xff4f6d, 0xffd43b, 0xffffff, 0xb36bff, 0xff8a3d].map(h => new THREE.Color(h));
  function fillGrass(cx, cz) { let n = 0, nf = 0; const C = 1.7, i0 = Math.floor((cx - GR) / C), i1 = Math.floor((cx + GR) / C), j0 = Math.floor((cz - GR) / C), j1 = Math.floor((cz + GR) / C);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = (i + hash(i, j)) * C, z = (j + hash(j, i)) * C, d = Math.hypot(x - cx, z - cz); if (d > GR) continue;
      const r = hash(i * 1.3, j * 0.7); if (r > 0.75 - 0.4 * fbm(x * 0.03, z * 0.03, 2)) continue; if (!grassOK(x, z)) continue;
      const s = 0.7 + hash(i, j * 3) * 0.7; _q.setFromAxisAngle(_up, r * 40); _s.set(s, s, s); _p.set(x, H(x, z) - 0.05, z); _m.compose(_p, _q, _s);
      if (r < 0.04 && nf < FCAP) { imFlow.setMatrixAt(nf, _m); imFlow.setColorAt(nf, FLC[(i + j) % 5 < 0 ? 0 : (((i + j) % 5) + 5) % 5]); nf++; } else if (n < GCAP) imGrass.setMatrixAt(n++, _m); }
    imGrass.count = n; imFlow.count = nf; imGrass.instanceMatrix.needsUpdate = true; imFlow.instanceMatrix.needsUpdate = true; if (imFlow.instanceColor) imFlow.instanceColor.needsUpdate = true; }
  // flames + flickering point lights (High: the nearest few torches get a real light)
  const flames = buildFlames(F, uTime); root.add(flames);
  // [v108] lighthouses (shared kit): one merged body + lens / glass / beam / flare each; High: the island one adds ONE point light
  const lhs = LIGHTHOUSES.map((L, i) => { const g = buildLighthouse({ ...L.opts, low, light: L.opts.light && !low }); g.position.set(L.x, L.y, L.z); g.userData.phase = i * 2.1; g.name = 'lighthouse_' + L.id; root.add(g); return g; });
  const lights = []; if (!low) for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffa64a, 0, 16, 1.6); root.add(l); lights.push(l); }
  // small life: gulls (town + falls), crabs on beaches (High)
  const birds = buildBirds(low, uTime); { const g = new THREE.Group(); g.position.set(TOWN.x + 40, 4, TOWN.z - 30); g.add(birds); root.add(g); }
  if (!low) { const b2 = buildBirds(true, uTime); const g = new THREE.Group(); g.position.set(SKULL.x, 50, SKULL.z); g.add(b2); root.add(g); }
  if (!low) { const cs = []; for (let j = 2; j < NZ; j += 3) for (let i = 2; i < NX; i += 3) { const q = IDX(i, j), h = Hg[q]; if (h > 0.6 && h < 1.6 && hash(i, j) < 0.05 && cs.length < 120) cs.push({ x: X0 + i * G, y: h, z: Z0 + j * G, a: hash(j, i) * 6.28 }); }
    root.add(buildCrabs(cs, uTime)); }
  // dig sites: mound -> dig -> chest rises + lid opens (local only, no rewards backend)
  const digs = DIGS.map(d => { const c = digChest(MATS, OUT, low); c.grp.position.set(d.x, d.y, d.z); c.cg.position.y = -1.6; root.add(c.grp); return { ...d, ...c, t: -1 }; });
  let lastP = new THREE.Vector3(1e9, 0, 0), lastG = new THREE.Vector3(1e9, 0, 0), allDone = false; const GROUP_R = low ? 260 : 900;
  const lightPick = new THREE.Vector3();
  function update(cam, t, opts = {}) {
    const all = !!opts.all;
    for (const c of chunks) { const d = Math.hypot(c.cx - cam.x, c.cz - cam.z) - 160;
      if (!all && d > VIEW_R) { c.mesh.visible = false; continue; }
      let lv = all ? 4 : LODS[0][1]; if (!all) for (const [r, s] of LODS) if (d >= r) lv = s;
      if (c.lod !== lv) { c.geos[lv] = c.geos[lv] || chunkGeo(c.ci, c.cj, lv); c.mesh.geometry = c.geos[lv]; c.lod = lv; }
      c.mesh.visible = true; }
    if (all) { if (!allDone) { fill(0, 0, true); for (const b of BUCKETS) if (b.kinds.includes('ferns') || b.kinds.includes('rocks')) b.m.count = 0; imGrass.count = imFlow.count = 0; allDone = true; lastP.set(1e9, 0, 0); } }
    else { allDone = false;
      if (cam.distanceTo(lastP) > 6) { fill(cam.x, cam.z); lastP.copy(cam); }
      if (cam.distanceTo(lastG) > 4) { fillGrass(cam.x, cam.z); lastG.copy(cam); } }
    for (const b of BUCKETS) b.m.visible = b.m.count > 0; imGrass.visible = imGrass.count > 0; imFlow.visible = imFlow.count > 0; // an empty InstancedMesh still costs a call (+1 per shadow pass)
    for (const g of groups) { const bs = g.geometry.boundingSphere, d = Math.hypot(bs.center.x - cam.x, bs.center.z - cam.z) - bs.radius, on = all || d < GROUP_R, far = g.userData.far;
      if (far) { const useFar = all || d > 170; g.visible = on && !useFar; far.visible = on && useFar; } else g.visible = on; }
    if (lights.length) { const near = F.map(f => [(f.x - cam.x) ** 2 + (f.z - cam.z) ** 2, f]).sort((a, b) => a[0] - b[0]);
      lights.forEach((l, i) => { const f = near[i] && near[i][1]; if (!f || near[i][0] > 90 * 90) { l.intensity = 0; return; } l.position.set(f.x, f.y + 0.6, f.z); l.intensity = (f.fire ? 30 : 18) * (0.85 + 0.15 * Math.sin(t * 13 + i * 1.7) + 0.08 * Math.sin(t * 23 + i)); }); }
    for (const g of lhs) tickLighthouse(g, t, opts.camW || cam, opts.storm || 0);
    for (const d of digs) if (d.t >= 0) { const k = Math.min(1, (t - d.t) / 2.2); d.mound.scale.setScalar(Math.max(0.01, 1 - k)); d.cg.position.y = -1.6 + 1.7 * sm(0, 0.7, k); d.lid.rotation.x = -1.6 * sm(0.6, 1, k); d.mound.visible = k < 1; }
  }
  // gameplay hooks (world coords): solid props, water / slope / bridge rules, interact points
  function bridgeAt(x, z) { const B = BRIDGE; if (!B.L) return null; const dx = x - B.ax, dz = z - B.az, along = dx * Math.sin(B.yaw) + dz * Math.cos(B.yaw), across = dx * Math.cos(B.yaw) - dz * Math.sin(B.yaw);
    if (along < -1 || along > B.L + 1 || Math.abs(across) > B.half + 0.6) return null; return { y: B.deckY - Math.sin(Math.min(1, Math.max(0, along / B.L)) * Math.PI) * B.sag, inside: Math.abs(across) <= B.half }; }
  function groundAt(x, z) { const b = bridgeAt(x, z); return b ? b.y + 0.12 : H(x, z); }
  function blocked(x, z, fx, fz) { const b = bridgeAt(x, z); if (b) return !b.inside;          // on the deck: rails bound you
    if (hitCollider(x, z)) return true; const h = H(x, z); if (h < 0.4) return true;               // sea
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r - 3) return true;
    const i = Math.round((x - X0) / G), j = Math.round((z - Z0) / G); if (i < 1 || j < 1 || i >= NX || j >= NZ) return true; const q = IDX(i, j);
    if (RVg[q] < 4.5 && h < RVl[q] + 0.8) return true;                                              // river
    if (fx !== undefined) { const d = Math.hypot(x - fx, z - fz); if (d > 1e-4) {           // [v105] slope limit: only real cliffs / steep faces
      const ux = (x - fx) / d, uz = (z - fz) / d, e = Math.max(d, 0.1), g = (H(x, z) - H(x - ux * e, z - uz * e)) / e;     // the grade of the step you just took (no look-ahead: a cliff edge doesn't fence off the ground in front of it)
      if (Math.abs(g) > WALK_RULES.slope) return true; } }                                            // same limit up AND down: you never drop into a pit you can't climb out of
    return false; }
  function whyBlocked(x, z, fx, fz) { const b = bridgeAt(x, z); if (b) return b.inside ? '' : 'rail';  // [v105] dev: reachability report
    if (hitCollider(x, z)) return 'prop'; const h = H(x, z); if (h < 0.4) return 'sea'; if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r - 3) return 'lake';
    const i = Math.round((x - X0) / G), j = Math.round((z - Z0) / G); if (i < 1 || j < 1 || i >= NX || j >= NZ) return 'edge'; const q = IDX(i, j);
    if (RVg[q] < 4.5 && h < RVl[q] + 0.8) return 'river'; return blocked(x, z, fx, fz) ? 'slope' : ''; }
  function nearInteract(x, z) { let best = null, bd = 1e9; for (const q of INTERACT) { const d = Math.hypot(q.x - x, q.z - z); if (d < q.r && d < bd && !(q.used)) { bd = d; best = q; } } return best; }
  function activate(q, t) { if (q.id.startsWith('dig')) { const d = digs.find(d => d.id === q.id); if (d && d.t < 0) { d.t = t; q.used = true; } return 'dig'; } return q.id; }
  const stats = { buildMs: BUILD_MS, chunks: chunks.length, trees: spots.trees.length, palms: spots.palms.length, ferns: spots.ferns.length, rocks: spots.rocks.length, torches: F.length, kitPieces: kitN, kitTris, kitTexBytes: kit ? kit.texBytes : 0, kitKtx2: kit ? kit.ktx2 : false, natPieces: natN, natTris, natTexBytes: nat ? nat.texBytes : 0, natKtx2: nat ? nat.ktx2 : false, cliffs: spots.cliffs.length, groups: groups.map(g => g.name), trailA: Math.round(pathLen(TRAILS.A)), trailB: Math.round(pathLen(TRAILS.B)), street: Math.round(Math.abs(STREET.z1 - STREET.z0)), texBytes: hTex.image.data.length };
  return { root, update, lighthouses: lhs, H, groundAt, blocked, whyBlocked, spots, nearInteract, activate, stats, pois: FOOT_POIS, digs, street, inland, IM, flames, lights, groups };
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
