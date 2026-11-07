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
import { activeDigs } from './digSpots.js';
import { AREA_TERRAIN, registerAreas, createAreas, FORT_WALKIN, RB_ON } from './areas/index.js'; // [island-rework] the six rework areas (lazy-built, per-area culling) // [island-rework] dig spots: one shared registry (baked coords; server lists generated from it)
import * as PV from './plazaTown.js'; // [Timothy] ?plaza=2 harbor town blockout (off by default)
import * as BT from './battery.js'; // [Timothy] headland battery: ramp, gun deck, playable guns
import * as BA from './battleAreas.js'; // [Timothy] battle areas: MUSKET RANGE + SWORD PIT (pads, paths, art)
import * as COLI from './coliseum.js'; // [Emerly] intact colosseum (&coliseum=0 = off)
import { clearAt as cottageClearAt, indoorOrPadAt as cottagePadAt, COTTAGES_ON } from './areas/cottages.js'; // [post/cottages] no trees/grass in cottages / well
const PV2 = COAST_ON_PV2();
function COAST_ON_PV2() { return PV.PLAZA_V2 && CO.COAST_ON; }
const COASTM = CO.COAST_ON;
export { CO }; // ?coast=1: town + berths built into the main island's west coast (js/island/coast.js); no round dock island
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { buildLighthouse, tickLighthouse } from '../lighthouseKit.js';

// ---------- layout ----------
// the dock town (round island) sits off the west coast, harbor face (+z local) to the open sea (west)
export const TOWN = { x: -640, z: -90, yaw: -Math.PI / 2 };
const TC = Math.cos(TOWN.yaw), TS = Math.sin(TOWN.yaw);
export const townToWorld = (lx, lz) => [TOWN.x + lx * TC + lz * TS, TOWN.z - lx * TS + lz * TC];
export const worldToTown = (x, z) => { const dx = x - TOWN.x, dz = z - TOWN.z; return [dx * TC - dz * TS, dx * TS + dz * TC]; };
// main street: a cobbled road on the land bridge from the town's back gate inland (town-local x = STREET.x, z from z0 to z1)
export const STREET = { x: 6, z0: -58, z1: -205, half: 7 };
// [rb-blender] BANKSY 1:33 PM "Probably remove the archway too": the gate lintel + its flag go with the symmetric fountain plaza; [v220] BANKSY 3:51 PM
// "remove the archways": the two 10 m gate towers (+ battlements + colliders) go too: the hill street opens straight onto the plaza (torches stay)
// (&rbarch=1 = keep it; &rbblend=0 or &roundabout=0 = the old gate exactly)
const GATE_ARCH_OFF = typeof location !== 'undefined' && !/[?&](rbblend|roundabout)=0(&|$)/.test(location.search) && !/[?&]rbarch=1(&|$)/.test(location.search);
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
// [bridge-path-fix] BANKSY 6:56 PM "the draw bridge is still not accessible on either end": trail A used to dive into the river gorge
// UNDER the rope bridge and climb its 4:1 north wall (nobody gets out), and both bridge slots dead-ended in 20-35 m walls. Trail A now
// crosses ON the bridge: down the south slot (the stone steps), over the deck, up the north steps, then through two cuttings (RAMPS)
// that join the slots to the trail on the plateau either side.
// + [-428, -100]: the loop's spline bowed west out of the gate into the first west lot's collider (-450..-436.5, -90..-100: stuck 'prop')
const TRAIL_A = [GATE, [-428, -100], [-380, -170], [-292, -262], [-170, -330], [-20, -400], [110, -330], [230, -262], [300, -150], [190, -100], [44, -149], [26, -151], [17, -150], [16, -144], [16, -110], [16, -82], [16, -56], [10, -44], [-30, -32], [-120, -40], [-300, -64]];
// [v105] coast mode: the west leg used to run ~500 m through the sea inlet (-280..0, 100..510); it now follows the inlet's east shore
// [bridge-path-fix] trail B: + [198, 292] keeps the loop on the dry beach round the east bay's tip (it cut 40 m through the sea there, swim)
const TRAIL_B = [[-120, -40], ...(COASTM ? [[-150, 60], [-140, 170], [-100, 290], [-30, 400], [20, 500]] : [[-210, 60], [-282, 150], [-200, 290], [-60, 420]]), [40, 540], [150, 420], [198, 292], [232, 252], [196, 150], [130, 150], [40, 60], [-30, -10]];
const ROPE_BRIDGE = { c: [16, -82], a: [16, -103], b: [16, -64] }; // [island-rework] a / b = the deck ends as live builds them (pinned for the D3 approaches)                                                              // trail A over the river gorge

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
// [v220] BANKSY 3:57 PM "fix the trail on that end of rope bridge to the next rope bridge": between the north rope-bridge cutting's ends (RAMPS
// [15, -46] -> [-32, -31.6], an 8 m floor through the ridge) trail A's spline bowed 3-4 m off the floor onto both cutting walls (two 5 m humps
// in the walk + the paint / kerbs up the rock). With the roundabout on, those trail points sit on the cutting's centre line (eased in / out over
// 6 m at each end; same point count, so nothing indexed by trail A moves). &roundabout=0 = the old line exactly.
if (RB_ON) { const ax = 15, az = -46, bx = -32, bz = -31.6, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
  for (const p of TRAILS.A) { const t = (p[0] - ax) * ux + (p[1] - az) * uz, lat = -(p[0] - ax) * uz + (p[1] - az) * ux; if (t < 1 || t > L - 1 || Math.abs(lat) > 6) continue;
    const w = Math.min(1, (t - 1) / 6, (L - 1 - t) / 6); p[0] -= -uz * lat * w; p[1] -= ux * lat * w; }
  // + the turn at the cutting's east end onto D3's north steps (x 16): the spline cut the inside corner over the slot's west wall (a ridge); it
  // now runs out along the cutting floor to the head of the steps, then straight down them
  const Q = [[9.9, -44.35], [14.6, -44.2], [16, -45.2], [16, -50.5]], near = (x, z) => { let b = null; for (let i = 1; i < Q.length; i++) { const [ax2, az2] = Q[i - 1], [bx2, bz2] = Q[i], dx = bx2 - ax2, dz = bz2 - az2, t = Math.max(0, Math.min(1, ((x - ax2) * dx + (z - az2) * dz) / (dx * dx + dz * dz))), px = ax2 + dx * t, pz = az2 + dz * t, d = Math.hypot(x - px, z - pz); if (!b || d < b[2]) b = [px, pz, d]; } return b; };
  for (const p of TRAILS.A) if (p[0] > 9.8 && p[0] < 16.5 && p[1] > -50.6 && p[1] < -43.2) { const [px, pz] = near(p[0], p[1]); const c = Math.hypot(px - 16, pz + 45.2) < 2.85 ? [16, -45.2] : [px, pz]; p[0] = c[0]; p[1] = c[1]; } }   // (the spline point nearest the turn sits ON the turn: the 3 m chords don't cut it)
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
// [Raul] SWIM COVE (BANKSY): carve CO.SWIM_COVE into the west beach: pool floor (shallow west -> deep east), a low sand / rock rim
// that holds the raised still water, blended back into the beach by q = CO.SWIM_COVE.bank (ellipse units)
function coveH(lx, lz, h) { const C = CO.SWIM_COVE, q = CO.coveQ(lx, lz); if (q >= C.bank) return h; const dx = lx - C.lx;
  if (q < 1) return C.y - (0.7 + (C.y - C.bottom - 0.7) * sm(-30, 8, dx)) * (1 - sm(0.7, 1, q));
  const sand = 1 - sm(-20, 0, dx), rim = C.y + 0.6 * sm(1, 1.06 + 0.24 * sand, q), t = sm(1.18, C.bank, q); return rim * (1 - t) + h * t; }
export const SKULL = { x: PEAK.x, z: PEAK.z - 62 }; SKULL.y = rawH(SKULL.x, SKULL.z, coastSD(SKULL.x, SKULL.z)); // treasure-cave floor pad
const t0 = performance.now();
stamp(TRAILS.A, 14, TRg); stamp(TRAILS.B, 14, TRg); stamp(STREETP, 30, STg);
// [stairfix] BANKSY 1:37 PM: trail A's closing leg (the old dip path from the waterfalls plateau back to the gate, x -411..-298) is the stretch the
// high rope bridge replaced: with the roundabout on it loses its paint (dirt + cobbles), kerb stones and torches. The walk / heights / foliage
// clearance still use the whole loop (TRg); only the PAINT uses TRp. &roundabout=0 = the old paint exactly.
// [stairs2] + the Pirates' Climb stretch (the old trail line from the plaza rim down to the stair foot, x -432..-413.6, z -123.2..-96.4): the
// curved stairs replace it, so its dirt / cobble paint + kerbs go too (no stray old path beside the new flight; walk + heights unchanged)
const A_DEAD = (p) => RB_ON && ((p[0] > -411 && p[0] < -298 && p[1] > -96 && p[1] < -56) || (p[0] >= -298 && p[0] < -276.5 && p[1] > -68 && p[1] < -56) ||   // [v220] + the old drop off the plateau cliff beside the bridge landing (x -298 .. -276.5): the landing path joins trail A east of it
   (p[0] > -432 && p[0] < -413.6 && p[1] > -123.2 && p[1] < -96.4));
const TRAIL_A_PAINT = (() => { const out = [], A = TRAILS.A; let cur = []; for (const p of A) { if (A_DEAD(p)) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(p); } if (cur.length > 1) out.push(cur); return out; })();
const DEAD_A = []; { let cur = []; for (const p of TRAILS.A) { if (A_DEAD(p)) cur.push(p); else if (cur.length) { DEAD_A.push(cur); cur = []; } } if (cur.length > 1) DEAD_A.push(cur); }
// [bridge-path-fix] BANKSY 6:59 PM "make the path stone paved all the way around island": the red (A) + yellow (B) trail loops get the
// Main Street cobble splat layer (layer 6 + COBBLE colour, the same shader + material: 0 extra geometry / draw calls, no height change).
// Not paved: near the dig spots (they stay sand / dirt), Raul's swim cove, the battle areas (Timothy's dirt floors), Main Street (already cobbled).
const PAVE = { full: 2.6, out: 4.0, kerb: 2.8 }; // cobbles full out to 2.6 m, fade by 4 m (just past the kerb stones); kerbs 2.8 m each side of the centre line
// [ir2] + area paths flagged pave: true (the cells' connecting paths) get the same cobbles + kerbs as the loop
const PAVED_PATHS = AREA_TERRAIN.paths.filter(p => p.pave).map(p => catmull(p.pts, false, 3));
const PVg = new Float32Array(Hg.length).fill(99); for (const P of TRAIL_A_PAINT) stamp(P, 8, PVg); stamp(TRAILS.B, 8, PVg); for (const P of PAVED_PATHS) stamp(P, 8, PVg);
const PAVE_DIGS = activeDigs().map(d => [d.x, d.z]);
// [path-hotfix] BANKSY 9:48-9:50 PM (live v175) 'how do i get up here' / 'and this before bridge': the cobbles wrapped up the bridge
// cuttings' near-vertical walls (stretched, read as a climbable stone terrace). Paving is the walk surface only: none past ~35 deg (grade 0.7),
// so cutting walls, slot walls and scarps keep the rock / cliff paint and read as cliff.
const PAVE_FLAT = (g) => 1 - sm(0.55, 0.75, g);
function paveAt(q, x, z) { const d = PVg[q]; if (d > PAVE.out) return 0; let w = 1 - sm(PAVE.full, PAVE.out, d);
  for (const [dx, dz] of PAVE_DIGS) w *= sm(6, 9, Math.hypot(x - dx, z - dz));
  if (COASTM) { const [lx, lz] = CO.w2t(x, z); if (BA.near(lx, lz)) return 0; w *= sm(CO.SWIM_COVE.bank + 0.1, CO.SWIM_COVE.bank + 0.5, CO.coveQ(lx, lz)); }
  return w; }
const paveW = (x, z) => paveAt(IDX(Math.round(Math.min(NX, Math.max(0, (x - X0) / G))), Math.round(Math.min(NZ, Math.max(0, (z - Z0) / G)))), x, z);
const gridBi = (D, x, z) => { const fx = Math.min(NX - 1e-3, Math.max(0, (x - X0) / G)), fz = Math.min(NZ - 1e-3, Math.max(0, (z - Z0) / G)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  return (D[IDX(i, j)] * (1 - u) + D[IDX(i + 1, j)] * u) * (1 - v) + (D[IDX(i, j + 1)] * (1 - u) + D[IDX(i + 1, j + 1)] * u) * v; };
stamp(RIVERP, 40, RVg, RVl, (u) => LAKE.y * (1 - u) + (-1.2) * u);                  // river surface: lake level -> sea
for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
  const x = X0 + i * G, z = Z0 + j * G, q = IDX(i, j), sd = coastSD(x, z); SDg[q] = sd;
  let h = rawH(x, z, sd);
  // river: carved channel; where it cuts the spine it becomes a gorge (walls stay steep because the land around is high)
  const rd = RVg[q]; if (rd < 40 && sd < 6) { const lvl = RVl[q]; h = Math.min(h, lvl - 2.2 + Math.max(0, rd - 5) * 0.5 + Math.max(0, rd - 11) * 2.6); }   // steep gorge walls
  // lake basin with a raised rim, so the lagoon holds water at LAKE.y
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (ld < LAKE.r) h = Math.min(h, LAKE.y - 1.2 - 5 * Math.sqrt(1 - ld / LAKE.r));
  // [clean-water] widen river outflow throat: rim used to pinch at rd>9 while the channel is w≈10..11
  else if (ld < LAKE.r + 45) { const rim = sm(11, 18, rd); if (rim > 0.001) h = Math.max(h, (LAKE.y + 1.4 + (ld - LAKE.r) * 0.12) * rim + h * (1 - rim)); }
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
  if (COASTM) { coastH(); h = coveH(lx, lz, h); } else { const rT = Math.hypot(lx, lz); if (rT < 104) { const gy = groundY(lx, lz) - 0.6; h = rT < 90 ? Math.max(Math.min(h, gy), lz < -50 && sx < STREET.half + 14 ? h : gy) : Math.max(h, gy); } }
  function coastH() { // [coast] stone quay + plaza flat, mole, cliff headland, fort knoll
    const e = sm(-64, -52, lz) * sm(CO.PLAZA.lx0 - 12, CO.PLAZA.lx0, lx) * (1 - sm(CO.PLAZA.lx1, CO.PLAZA.lx1 + 12, lx));
    if (lz <= 0.5) h = h * (1 - e) + CO.QUAY.y * e;
    if (PV2) h = PV.plazaGround(lx, lz, h);   // [Timothy] v2 dock corner apron
    if (lz > 0.5 && lx > -320 && lx < 132 && sd > 0) h = Math.min(h, -3.5 - Math.min(lz, 60) * 0.12);   // dredged harbor: berths + quay stay deep
    if ((Math.abs(lx - CO.MOLE.lx) < CO.MOLE.w / 2 + 1 && lz > -2 && lz < CO.MOLE.lz1) || Math.hypot(lx - CO.MOLE.lx, lz - CO.MOLE.lz1) < CO.MOLE.tipR) h = CO.MOLE.y;
    const hd = Math.hypot(lx - CO.HEADLAND.lx, lz - CO.HEADLAND.lz); if (sd < 0) h = Math.max(h, CO.HEADLAND.top * (1 - sm(CO.HEADLAND.r * 0.6, CO.HEADLAND.r * 1.5, hd)) * sm(-2, 6, -sd));
    const fd = Math.hypot(lx - CO.FORT.lx, lz - CO.FORT.lz); if (fd < CO.FORT.r * 2.8) h = Math.max(h, CO.FORT.top * (1 - sm(CO.FORT.r, CO.FORT.r * 2.8, fd)));
    h = BT.ground(lx, lz, h); // [Timothy] battery ramp + gun deck
    { const ba = BA.stamp(lx, lz, h); h = ba.h; if (ba.d < TRg[q]) TRg[q] = ba.d; } // [Timothy] battle areas: level pads + dirt floors / paths
    if (COLI.COLISEUM_ON) { const c = COLI.stamp(lx, lz, h); h = c.h; if (c.d < TRg[q]) TRg[q] = c.d; }
    if (PV.hallGround) h = PV.hallGround(lx, lz, h); // [Timothy v312] the widened Squad Hall's ground stays on the street grade (js/island/hillStreet.js)
    if (PV.casinoGround) h = PV.casinoGround(lx, lz, h); // [Timothy] THE GOLDEN DOUBLOON CASINO: the hall's ground = the street level (js/island/casinoData.js)
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
// [bridge-path-fix] + the two rope-bridge cuttings (8 m wide floor): trail A's plateau east of the south slot -> the slot top, and the
// north slot top -> trail A's west slope (the ridge between was a 20-35 m wall); + a ramp up the 7 m scarp trail A climbs at x -150 (west of the bridge)
// keep = [x0, x1, z0, z1]: cells the ramp must not re-grade (the rope bridge's slot steps: their profile is cut to the deck, ropeBridge.js)
export const RAMPS = [[-116, -108, -104, -100], [46, -148.6, 17, -150.6, 4, [10, 22, -149, -100]], [15, -46, -32, -31.6, 4, [10, 22, -66, -47]], [-138, -42.1, -164, -45.6, 3]]
  .map(([ax, az, bx, bz, hw = 2.5, keep = null]) => { const L0 = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L0, uz = (bz - az) / L0, e = 3;
    const a = [ax - ux * e, az - uz * e], b = [bx + ux * e, bz + uz * e]; return { ax: a[0], az: a[1], bx: b[0], bz: b[1], ay: H(...a), by: H(...b), L: L0 + 2 * e, ux, uz, hw, keep }; });
for (const r of (typeof location !== 'undefined' && /[?&]ramps=0/.test(location.search)) ? [] : RAMPS) { const pts = [[r.ax, r.az], [r.bx, r.bz]];
  const i0 = Math.max(0, Math.floor((Math.min(r.ax, r.bx)  - 8 - X0) / G)), i1 = Math.min(NX, Math.ceil((Math.max(r.ax, r.bx) + 8 - X0) / G));
  const j0 = Math.max(0, Math.floor((Math.min(r.az, r.bz)  - 8 - Z0) / G)), j1 = Math.min(NZ, Math.ceil((Math.max(r.az, r.bz) + 8 - Z0) / G));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const [d, t] = segD(X0 + i * G, Z0 + j * G, r.ax, r.az, r.bx, r.bz), q = IDX(i, j); if (d > r.hw + 2.5) continue;
    const w = 1 - sm(r.hw, r.hw + 2.5, d), cx = X0 + i * G, cz = Z0 + j * G, kp = r.keep && cx > r.keep[0] && cx < r.keep[1] && cz > r.keep[2] && cz < r.keep[3];
    if (!kp) Hg[q] += (r.ay + (r.by - r.ay) * t - Hg[q]) * w; TRg[q] = Math.min(TRg[q], d); } }
// [island-rework] area terrain: flat floors (pads: [x0, x1, z0, z1, y], hard edges = chunky cut walls) + trails (painted + kept clear like trails A / B)
// pads: [x0, x1, z0, z1, y, blend = 0]: blend > 0 eases the ground outside the rect into the floor over `blend` m (only where the floor is ABOVE it = a ramp up)
for (const [x0, x1, z0, z1, y, bl = 0] of AREA_TERRAIN.pads) for (let j = Math.max(0, Math.floor((z0 - bl - Z0) / G)); j <= Math.min(NZ, Math.ceil((z1 + bl - Z0) / G)); j++) for (let i = Math.max(0, Math.floor((x0 - bl - X0) / G)); i <= Math.min(NX, Math.ceil((x1 + bl - X0) / G)); i++) {
  const x = X0 + i * G, z = Z0 + j * G, d = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1)), q = IDX(i, j);
  if (d === 0) Hg[q] = y; else if (bl > 0 && d < bl && Hg[q] < y) Hg[q] += (y - Hg[q]) * (1 - sm(0, bl, d)); }
// cuts: [ax, az, ay, bx, bz, by, hw]: lower the ground (never raise it) to just under a ramp / stair deck from a (y ay) to b (y by), so a
// deck built over it always sits ON TOP (the area hides the cut with retaining walls). Only grid points within hw + G/2 are touched.
for (const [ax, az, ay, bx, bz, by, hw, soft = 0] of AREA_TERRAIN.cuts || []) { const m = hw + (soft || G * 0.5); // [ir2] soft = the cut's sides ease out over soft m (a cutting, not a slot)
  for (let j = Math.max(0, Math.floor((Math.min(az, bz) - m - Z0) / G)); j <= Math.min(NZ, Math.ceil((Math.max(az, bz) + m - Z0) / G)); j++)
    for (let i = Math.max(0, Math.floor((Math.min(ax, bx) - m - X0) / G)); i <= Math.min(NX, Math.ceil((Math.max(ax, bx) + m - X0) / G)); i++) {
      const [d, t] = segD(X0 + i * G, Z0 + j * G, ax, az, bx, bz); if (d > m) continue; const q = IDX(i, j), yl = ay + (by - ay) * t - 0.45;
      Hg[q] = soft ? Math.min(Hg[q], Hg[q] + (yl - Hg[q]) * (1 - sm(hw, m, d))) : Math.min(Hg[q], yl); } }
for (const p of AREA_TERRAIN.paths) { const path = catmull(p.pts, false, 3); stamp(path, 12, TRg); }
// [clean-water] grade area paths to a walkable max rise/run (fishing approach / plateau→ziplines); ZERO added props
for (const p of AREA_TERRAIN.paths) {
  if (p.grade === false) continue;
  const path = catmull(p.pts, false, 2), hw = p.hw || (p.pave ? 3.2 : 2.6);
  if (path.length < 2) continue;
  const ys = path.map(([x, z]) => H(x, z)), ds = [0];
  for (let i = 1; i < path.length; i++) ds.push(ds[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const L = ds[ds.length - 1] || 1, y0 = ys[0], y1 = ys[ys.length - 1];
  const tgt = ds.map((s) => y0 + (y1 - y0) * (s / L));
  const accY = new Map(), accW = new Map();
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1], ay = tgt[i], by = tgt[i + 1];
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - hw - 3 - X0) / G)), i1 = Math.min(NX, Math.ceil((Math.max(ax, bx) + hw + 3 - X0) / G));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - hw - 3 - Z0) / G)), j1 = Math.min(NZ, Math.ceil((Math.max(az, bz) + hw + 3 - Z0) / G));
    for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
      const x = X0 + ii * G, z = Z0 + j * G, [d, t] = segD(x, z, ax, az, bx, bz);
      if (d > hw + 3) continue;
      const q = IDX(ii, j), w = 1 - sm(hw * 0.55, hw + 3, d);
      if (w <= 1e-3) continue;
      const y = ay + (by - ay) * t;
      accY.set(q, (accY.get(q) || 0) + y * w); accW.set(q, (accW.get(q) || 0) + w);
    }
  }
  for (const [q, w] of accW) { const ww = Math.min(1, w); Hg[q] = Hg[q] * (1 - ww) + (accY.get(q) / w) * ww; }
  if (p.id === 'wf_hill_trail') for (const [zx, zz] of [[-200, -219], [-228, -212]]) { // [v332] cliff-edge zip stands
    const zy = H(zx, zz);
    for (let j = Math.max(0, Math.floor((zz - 5 - Z0) / G)); j <= Math.min(NZ, Math.ceil((zz + 5 - Z0) / G)); j++)
      for (let ii = Math.max(0, Math.floor((zx - 5 - X0) / G)); ii <= Math.min(NX, Math.ceil((zx + 5 - X0) / G)); ii++) {
        const x = X0 + ii * G, z = Z0 + j * G, d = Math.hypot(x - zx, z - zz), q = IDX(ii, j); if (d > 5) continue;
        const w = 1 - sm(3.2, 5, d); Hg[q] = Hg[q] * (1 - w) + zy * w;
      }
  }
}
// [stairfix] the paint distance: = TRg, except near the dead leg of trail A, where only the live trails / area paths count
const TRP_G = (() => { if (!DEAD_A.length) return TRg; const DG = new Float32Array(Hg.length).fill(99), OG = new Float32Array(Hg.length).fill(99), T = new Float32Array(TRg); for (const P of DEAD_A) stamp(P, 14, DG);
  for (const P of TRAIL_A_PAINT) stamp(P, 14, OG); stamp(TRAILS.B, 14, OG); for (const p of AREA_TERRAIN.paths) stamp(catmull(p.pts, false, 3), 12, OG);
  for (let q = 0; q < DG.length; q++) if (DG[q] < 14 && DG[q] <= TRg[q] + 1e-3) T[q] = OG[q]; return T; })();
// [v105] on-foot walk rules (navigability pass): uphill grade limit (rise / run), tree + rock colliders. ?slope=1.2 / ?trees=0 for tests
const QS = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const SHALLOWS_ON = QS.get('shallows') === '1'; // [v348] t1829u: the old overlapping foot_shallows sea, opt-in only
export const WALK_RULES = { slope: +(QS.get('slope') || 1.25), trees: QS.get('trees') !== '0' };
export const BUILD_MS = Math.round(performance.now() - t0);
// bilinear sample (world metres)
// [terrain-edit] BANKSY's owner terrain editor: a height-delta layer on top of the built grid (cells q -> metres). Every reader (H, Htri,
// waterAt, the chunk meshes) reads Hg, so applying here moves the drawn ground, the walk / collision height and the followers together.
let Hb = null, CHUNKS = null; const DELTA = new Map(), PAINTM = new Map(); // [build-mode] PAINTM: cell -> [splat layer, 0..1]
// [build-mode] a deleted built-in piece takes its walk decks + colliders with it (those whose centre sits inside its footprint); restore = back on
export function pieceBlockers(box, off) { const hit = (x, z) => x >= box.min.x - 0.3 && x <= box.max.x + 0.3 && z >= box.min.z - 0.3 && z <= box.max.z + 0.3; let n = 0;
  for (const d of AREA_DECKS) if (hit(d.x, d.z) && d.y >= box.min.y - 1 && d.y <= box.max.y + 1) { d.off = off; n++; }
  for (const o of [...CIRC, ...BOXES]) if (hit(o.x, o.z)) { o.off = off; n++; } return n; }
function rebuild(dirty) { if (CHUNKS) for (const c of CHUNKS) if (dirty.has(c.ci + ',' + c.cj)) { for (const g of Object.values(c.geos)) if (g !== c.mesh.geometry) g.dispose(); const old = c.mesh.geometry; c.geos = {}; if (c.lod >= 0) { c.geos[c.lod] = chunkGeo(c.ci, c.cj, c.lod); c.mesh.geometry = c.geos[c.lod]; old.dispose(); } } }
let KERB_HOOK = null;   // [stairs2] createFoot: re-lay the kerbs after a terrain edit (debounced)
export const TERRAIN = { G, X0, Z0, NX, NZ, get CH() { return CH; }, IDX,
  base(q) { return Hb ? Hb[q] : Hg[q]; }, delta: DELTA, cell(x, z) { return [Math.round((x - X0) / G), Math.round((z - Z0) / G)]; },
  // set some cells' deltas (Map / [[q, m]]): rewrites Hg there and rebuilds only the touched chunks (their LOD meshes regenerate lazily)
  rev: 0, // [minimap-themes] bumped by set / paint: the island map + treasure chart re-bake from the edited ground
  set(entries) { if (!Hb) Hb = Hg.slice(); const dirty = new Set(); this.rev++;
    for (const [q, d] of entries) { const v = Math.abs(d) < 0.005 ? 0 : d; if (v) DELTA.set(q, v); else DELTA.delete(q); Hg[q] = Hb[q] + v;
      const i = q % (NX + 1), j = (q - i) / (NX + 1), ci = Math.floor(i / CH), cj = Math.floor(j / CH);
      dirty.add(ci + ',' + cj); if (i % CH === 0 && ci > 0) dirty.add((ci - 1) + ',' + cj); if (j % CH === 0 && cj > 0) dirty.add(ci + ',' + (cj - 1)); if (i % CH === 0 && j % CH === 0 && ci > 0 && cj > 0) dirty.add((ci - 1) + ',' + (cj - 1)); }
    rebuild(dirty); KERB_HOOK?.(); return dirty.size; },   // [stairs2] the kerb stones re-seat on the edited ground (they were laid on the unedited ground at startup)
  paint(entries) { const dirty = new Set(); this.rev++; for (const [q, v] of entries) { if (v && v[1] > 0.01) PAINTM.set(q, v); else PAINTM.delete(q); const i = q % (NX + 1), j = (q - i) / (NX + 1); dirty.add(Math.floor(i / CH) + ',' + Math.floor(j / CH)); } rebuild(dirty); return dirty.size; },
  paintMap: PAINTM, LAYERS: { grass: 2, sand: 0, dirt: 1, rock: 4, path: 6 },
  replacePaint(obj) { const next = new Map(Object.entries(obj || {}).map(([q, v]) => [+q, [Math.floor((v | 0) / 1000), ((v | 0) % 1000) / 100]])); const ch = [];
    for (const q of PAINTM.keys()) if (!next.has(q)) ch.push([q, null]); for (const [q, v] of next) { const o = PAINTM.get(q); if (!o || o[0] !== v[0] || o[1] !== v[1]) ch.push([q, v]); } return ch.length ? this.paint(ch) : 0; },
  dumpPaint() { const o = {}; for (const [q, [m, w]] of PAINTM) o[q] = m * 1000 + Math.round(w * 100); return o; },
  replace(obj) { const next = new Map(Object.entries(obj || {}).map(([q, cm]) => [+q, (cm | 0) / 100]).filter(([q]) => q >= 0 && q < Hg.length)); const ch = [];
    for (const q of DELTA.keys()) if (!next.has(q)) ch.push([q, 0]); for (const [q, d] of next) if (DELTA.get(q) !== d) ch.push([q, d]); return ch.length ? this.set(ch) : 0; },
  dump() { const o = {}; for (const [q, d] of DELTA) o[q] = Math.round(d * 100); return o; } };
export function H(x, z) {
  const fx = Math.min(NX - 1e-3, Math.max(0, (x - X0) / G)), fz = Math.min(NZ - 1e-3, Math.max(0, (z - Z0) / G)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  return (Hg[IDX(i, j)] * (1 - u) + Hg[IDX(i + 1, j)] * u) * (1 - v) + (Hg[IDX(i, j + 1)] * (1 - u) + Hg[IDX(i + 1, j + 1)] * u) * v;
}
// [Raul] water + the swim cove's walkable jetty (foot world). waterAt = the still-water surface over (x, z) or null (dry): the lake,
// the river ribbon, the sea (CO.FOOT_SWIM.seaY). seaLimit = sea you may not swim in (open water, the dredged berths).
export const FOOT_SWIM = CO.FOOT_SWIM;
// [v348] t1833u: WATER_KIND.k = which water the last waterAt() hit ('cove' | 'lake' | 'river' | 'sea' | null), WATER_KIND.h = the ground there.
// The harbor (js/dock/world.js) turns 'sea' (and the sunk river mouth) into the LIVE ocean swell; the still waters keep their exact heights.
export const WATER_KIND = { k: null, h: 0 };
export function waterAt(x, z) { const h = H(x, z), W = WATER_KIND; W.h = h; W.k = null;
  if (COASTM) { const [lx, lz] = worldToTown(x, z); if (CO.coveQ(lx, lz) < 1.02) { if (h < CO.SWIM_COVE.y) { W.k = 'cove'; return CO.SWIM_COVE.y; } return null; } }   // the swim cove
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 2.5) { if (h < LAKE.y + 0.05) { W.k = 'lake'; return LAKE.y + 0.05; } return null; }
  const q = IDX(Math.round(Math.min(NX, Math.max(0, (x - X0) / G))), Math.round(Math.min(NZ, Math.max(0, (z - Z0) / G))));
  if (RVg[q] < 10.5 && h < RVl[q] + 0.2 && RVl[q] > FOOT_SWIM.seaY) { W.k = 'river'; return RVl[q] + 0.2; }
  if (h < FOOT_SWIM.seaY) { W.k = 'sea'; return FOOT_SWIM.seaY; } return null; }
const SAIL_ALL_FOOT = !(typeof location !== 'undefined' && /[?&]sailall=0(?:&|$)/.test(location.search || '')); // [Emerly sail-around]
function seaLimit(x, z, h, surf) { if (surf !== FOOT_SWIM.seaY) return false;
  if (SAIL_ALL_FOOT) return false; // free swim to canoe / ship / islets
  if (h < FOOT_SWIM.maxSea) return true;
  if (!COASTM || surf - h <= FOOT_SWIM.depth) return false; const [lx, lz] = worldToTown(x, z); return CO.inPoly(lx, lz, CO.SAFE); }
// the cove jetty (bank -> west): walkway, 4 steps, the diving tower, the board (a = metres out from the bank). null = not on it
export function coveDeckAt(x, z) { if (!COASTM) return null; const [lx, lz] = worldToTown(x, z), J = CO.SWIM_COVE.jetty, a = J.lx0 - lx, dz = Math.abs(lz - J.lz);
  const aS = J.lx0 - J.lx1, aT0 = J.lx0 - J.tower.lx0, aT1 = J.lx0 - J.tower.lx1;
  if (a < 0 || a > J.lx0 - J.board.lx1 || dz > J.tower.hw) return null;
  if (a > aT1) return dz <= J.board.hw ? J.tower.y + 0.1 : null;
  if (a >= aT0) return J.tower.y;
  if (dz > J.hw) return null; return a < aS ? J.y : J.steps[Math.min(J.steps.length - 1, Math.floor(a - aS))]; }
const coveTower = (x, z) => coveDeckAt(x, z) === CO.SWIM_COVE.jetty.tower.y;   // the tower deck itself (not the board)
// [Emerly] battle areas: the walk height on the SWORD PIT / MUSKET RANGE dirt paths = the drawn LOD-1 terrain triangles (chunkGeo splits each
// 4 m cell on the (i+1, j)-(i, j+1) diagonal), not the bilinear H(), so feet sit on the slope there to the mm (tools/battle/feet_battle.py)
export function Htri(x, z) {
  const fx = Math.min(NX - 1e-3, Math.max(0, (x - X0) / G)), fz = Math.min(NZ - 1e-3, Math.max(0, (z - Z0) / G)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const h00 = Hg[IDX(i, j)], h10 = Hg[IDX(i + 1, j)], h01 = Hg[IDX(i, j + 1)], h11 = Hg[IDX(i + 1, j + 1)];
  return u + v <= 1 ? h00 + u * (h10 - h00) + v * (h01 - h00) : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
}
const gridAt = (A, x, z) => A[IDX(Math.round(Math.min(NX, Math.max(0, (x - X0) / G))), Math.round(Math.min(NZ, Math.max(0, (z - Z0) / G))))];
export const trailDist = (x, z) => gridAt(TRg, x, z);
// [v371] BANKSY t1972u: is (x, z) (FOOT frame) on / right beside a walkway? trails, the town street, battle-area paths, and PATH paint from Build Mode
export function onWalkway(x, z, pad = 1.5) {
  if (gridAt(TRg, x, z) < 3.4 + pad || gridAt(STg, x, z) < STREET.half + 1.6 + pad) return true;
  try { if (COASTM && BA.onPath(...CO.w2t(x, z)) > 0.15) return true; } catch {}
  if (PAINTM.size) { const r = Math.ceil((1.5 + pad) / G), i0 = Math.round((x - X0) / G), j0 = Math.round((z - Z0) / G);
    for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) { if (i < 0 || j < 0 || i > NX || j > NZ) continue; const v = PAINTM.get(IDX(i, j)); if (v && v[0] === 6 && v[1] > 0.3) return true; } }
  return false;
}

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
  out.lerp(ROCK, sm(0.4, 0.7, slope) * (1 - sm(10, 22, TRP_G[q]))); // [path-hotfix] trail cuttings / bridge slots: grey cliff rock (matches splat layer 5 there)
  out.lerp(DIRT, (1 - sm(2.4, 4.4, TRP_G[q])) * (1 - sm(0.75, 1.05, slope))); out.lerp(COBBLE, paveAt(q, x, z) * PAVE_FLAT(slope)); // [path-hotfix] cutting / slot walls keep the rock colour
  out.lerp(COBBLE, 1 - sm(STREET.half - 0.5, STREET.half + 1, STg[q]));
  if (COASTM) out.lerp(COBBLE, BT.pave(...worldToTown(x, z))); // [Timothy] battery ramp + gun deck
  if (COASTM && COLI.COLISEUM_ON) out.lerp(COBBLE, COLI.pave(...worldToTown(x, z))); // [Timothy v294] coliseum fish-market approach
  return out;
}


// ---------- terrain splat weights (8 layers: sand, wet, grass, dirt | rock, cliff, cobble, jungle floor) ----------
function slopeAt(i, j) { const hx = Hg[IDX(Math.min(NX, i + 1), j)] - Hg[IDX(Math.max(0, i - 1), j)], hz = Hg[IDX(i, Math.min(NZ, j + 1))] - Hg[IDX(i, Math.max(0, j - 1))]; return Math.hypot(hx, hz) / (2 * G); }
function splatAt(i, j, w) {
  const q = IDX(i, j), h = Hg[q], x = X0 + i * G, z = Z0 + j * G, sl = slopeAt(i, j);
  w.fill(0); w[2] = 1;
  const paint = (L, a) => { if (a <= 0.001) return; a = Math.min(1, a); for (let k = 0; k < 8; k++) w[k] *= 1 - a; w[L] += a; };
  const jm = fbm(x * 0.01 + 7, z * 0.01, 3);
  // [clean-water] w[7]->LAYERS[6] leaf-vein grid — keep off steep west hills / river gorge
  { const jn = sm(0.4, 0.58, jm) * sm(5, 12, h); const westGorge = x < -120 || RVg[q] < 30;
    paint(7, westGorge ? jn * (1 - sm(0.55, 0.95, sl)) : jn); }
  paint(0, 1 - sm(2.3, 3.9, h));
  paint(1, sm(1.4, 0.5, h) * sm(-3, -0.6, h));
  if (RVg[q] < 12 && h < RVl[q] + 2.5) paint(1, 0.85 * sm(12, 6, RVg[q]));
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 8) paint(1, 0.8 * sm(LAKE.r + 8, LAKE.r, Math.hypot(x - LAKE.x, z - LAKE.z)));
  paint(3, 1 - sm(2.0, 4.3, TRP_G[q]));
  // [clean-water] w[4]->LAYERS[3] organic grey cracked rock; w[5]->LAYERS[9] tan block strata
  paint(4, sm(0.72, 1.08, sl) + sm(82, 112, h) * 0.45);
  if (x < -120 || RVg[q] < 30) {
    paint(4, Math.max(sm(0.95, 1.4, sl), sm(0.45, 0.78, sl) * (1 - sm(10, 22, TRP_G[q]))));
    w[5] = 0;
  } else {
    paint(5, Math.max(sm(1.05, 1.5, sl), sm(0.4, 0.7, sl) * (1 - sm(10, 22, TRP_G[q]))));
  }
  paint(6, paveAt(q, x, z) * PAVE_FLAT(sl)); // [bridge-path-fix] paved trails: Main Street's cobble layer on the walkable floor only
  paint(6, 1 - sm(STREET.half + 1.6, STREET.half + 3.2, STg[q])); // cobbles run right up to the house fronts
  if (COASTM) paint(6, BT.pave(...worldToTown(x, z))); // [Timothy] battery ramp + gun deck
  if (COASTM && COLI.COLISEUM_ON) paint(6, COLI.pave(...worldToTown(x, z))); // [Timothy v294] coliseum fish-market approach
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
    splatAt(i, j, _w8); { const pv = PAINTM.get(IDX(i, j)); if (pv) { const a = Math.min(1, pv[1]); for (let k = 0; k < 8; k++) _w8[k] *= 1 - a; _w8[pv[0]] += a; } } w0.push(_w8[0], _w8[1], _w8[2], _w8[3]); w1.push(_w8[4], _w8[5], _w8[6], _w8[7]);
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
  const sheet = new THREE.Mesh(g, m); sheet.position.set(fx, LAKE.y - 0.5, fz - 4); sheet.renderOrder = 4; sheet.name = 'foot_waterfall';
  // mist + splash (points)
  const N = low ? 40 : 120, pp = new Float32Array(N * 3), sd = new Float32Array(N);
  for (let i = 0; i < N; i++) { pp[i * 3] = (Math.random() - 0.5) * 12; pp[i * 3 + 2] = Math.random() * 6; sd[i] = Math.random(); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const mist = new THREE.Points(pg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: uTime },
    vertexShader: `attribute float aSeed; uniform float uTime; varying float vA; void main(){ float t = fract(uTime * 0.35 + aSeed); vec3 p = position; p.y += t * 7.0; p.x *= 1.0 + t; vA = sin(t * 3.14159) * 0.5;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (40.0 + 60.0 * aSeed) * (30.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0), smoothstep(0.5, 0.0, d) * vA); }' }));
  mist.position.set(fx, LAKE.y, fz - 2); mist.renderOrder = 5; mist.frustumCulled = false; mist.name = 'foot_waterfall_mist';
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
    if (h < 0.9) continue; const [lx, lz] = worldToTown(x, z); if (Math.hypot(lx, lz) < 110) continue; if (COASTM && CO.coveQ(lx, lz) < 1.5) continue; // [Raul] swim cove
    if (STg[q] < 26 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4 || RVg[q] < 13.5 || gridAt(RVg, x, z) < 12.5) continue;
    const sl = slopeAt(i, j);
    if (FOOT_POIS.some(p => Math.hypot(p.x - x, p.z - z) < (p.clear || 22))) continue;
    const clr = COASTM ? BT.clearAt(lx, lz) : 0; if (clr > 1) continue; // [Timothy] battery: ramp + gun deck clear, no trees round the guns
    if (COASTM && (BA.clearAt(lx, lz) || (COLI.COLISEUM_ON && COLI.clearAt(lx, lz)))) continue; // [Timothy]/[Emerly] battle pads + colosseum
    if (COTTAGES_ON && cottageClearAt(x, z)) continue; // [post/cottages] no trees/palms/rocks/cliffs in cottages / porches / well
    if (sl > 0.95 && TRg[q] > 9) { if (r < 0.2 && !inView(x, z)) cliffs.push([x, h, z, r]); else if (r < 0.3) rocks.push([x, h, z, r]); continue; }
    if (clr) continue;
    if (inView(x, z)) { if (r < 0.1 && TRg[q] > 6) ferns.push([x, h, z, r]); continue; }
    if (Math.hypot(x - SKULL.x, z - SKULL.z - 6) < 34) continue;
    if (TRg[q] < 10) { const dead = x > -406 && TRP_G[q] > TRg[q] + 1; if ((TRg[q] > 4.5 || dead) && r < (dead ? 0.42 : 0.18)) ferns.push([x, h, z, r]); continue; }   // [v220] the dead leg (under the high bridge): ferns right across the old trail line, blends into the grass
    if (h < 2.6) { if (r < 0.05) rocks.push([x, h, z, r]); continue; }
    if (sl > 0.85 || h > 105) { if (r < 0.1) rocks.push([x, h, z, r]); continue; }
    const jm = fbm(x * 0.01 + 7, z * 0.01, 3);
    if (h < 6.5 && SDg[q] > -70) { if (r < 0.45) palms.push([x, h, z, r]); else if (r < 0.52) rocks.push([x, h, z, r]); }
    else if (r < 0.15 + 0.8 * sm(0.36, 0.56, jm)) { trees.push([x, h, z, r]); if (hash(i, j * 2.3) < 0.8) { const fx = x + 3 * (hash(i, 7) - 0.5) * 2, fz = z + 3; const fq = IDX(Math.round(Math.min(NX, Math.max(0, (fx - X0) / G))), Math.round(Math.min(NZ, Math.max(0, (fz - Z0) / G)))); if (!(COTTAGES_ON && cottageClearAt(fx, fz)) && TRg[fq] > 4 && PVg[fq] > 2.5) ferns.push([fx, H(fx, fz), fz, hash(j, 5)]); } }
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
  if (h < 3.2 || TRP_G[q] < 3.2 || STg[q] < STREET.half + 3.5 || slopeAt(fx, fz) > 0.65 || (RVg[q] < 9) || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 2) return 0;
  if (RB_ON && x > -440 && x < -405 && z > -130 && z < -60 && areaDeckAt(x, z) !== null) return 0;   // [v220] no grass tufts through the fountain plaza / Climb paving
  if (COTTAGES_ON && cottagePadAt(x, z)) return 0; // [post/cottages] no grass through cottage floors / porches / aprons / well pad
  const [lx, lz] = worldToTown(x, z); if (Math.hypot(lx, lz) < 100) return 0; if (PV.hillClear && PV.hillClear(lx, lz)) return 0; if (PV.casinoClear && PV.casinoClear(lx, lz)) return 0; if (COASTM && BT.pave(lx, lz) > 0.2) return 0; if (COASTM && CO.coveQ(lx, lz) < 1.3) return 0; return 1; };

// [v122] the six dig sites (server lib.ts MAP_SPOTS dig1..dig6; a treasure map names one of them, the legendary one the cave)
// [island-rework] now read from js/island/digSpots.js (active spots only, BAKED coords = today's beachNear() results, so no X moves)
export const DIG_HINTS = activeDigs().map(d => [d.x, d.z, d.n]);
const DIG_BAKED = new Set(DIG_HINTS.map(([x, z]) => x + ',' + z));
// nearest sandy beach cell to a hint (dig sites)
function beachNear(x, z) { if (DIG_BAKED.has(x + ',' + z)) return [x, z]; // [island-rework] baked registry spot: used as-is (terrain edits can't move it)
  let best = [x, z], bd = 1e9;
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
export function collidersOff(test) { let n = 0; for (const o of [...CIRC, ...BOXES]) if (!o.off && test(o)) { o.off = true; n++; } return n; } // [roundabout-bridge] a piece another area replaced: its old colliders off (o.t 0 = circle { x, z, r }, 1 = box { x, z, hx, hz })
// [island-rework] walkable area decks (fishing dock, stepping stones, temple floors ...): rect { x, z, hw, hl, yaw, y } or disc { x, z, r, y }
export const AREA_DECKS = [];
// decks: { x, z, r } disc or { x, z, hw, hl, yaw } box at y; a box deck can also be a STAIR / RAMP along its length (local +l = yaw
// direction): prof = tread tops [y0, y1, ...] from the -hl end (equal treads), or y1 = a smooth ramp from y (at -hl) to y1 (at +hl)
// [island-rework] smooth joins (BANKSY 5:50 PM "make it all transition smoothly"): a stair deck's WALK height is the line through its
// tread centres (prof[k] at u = (k + 0.5) / n), pinned to d.ya / d.yb at the two ends (= the ground / deck it joins), so the walker
// glides up the steps with no 0.2 m pops and meets the terrain / the next deck at the same height (walk test: <= 3 cm lips)
function profAt(d, u) { const P = d.prof, n = P.length, t = u * n - 0.5; if (t <= 0) { const a = d.ya ?? P[0]; return a + (P[0] - a) * Math.min(1, Math.max(0, u * n * 2)); }
  if (t >= n - 1) { const b = d.yb ?? P[n - 1]; return P[n - 1] + (b - P[n - 1]) * Math.min(1, Math.max(0, (u * n - (n - 0.5)) * 2)); }
  const i = Math.floor(t), f = t - i; return P[i] + (P[i + 1] - P[i]) * f; }
// [stairs2] a PATH deck (BANKSY 2:26 PM "make it curve"): { path: [[x, z], ...], ps: [arc length at each point], hw, yAt(s), bb: [x0, x1, z0, z1] }:
// the walk height is yAt(s) at the nearest point of the centre line (s = arc length), anywhere within hw of it; nothing past the two ends
function pathDeckY(d, x, z) { const b = d.bb; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) return null; const P = d.path, n = P.length; let best = 1e18, bs = 0, bo = 0, out = false;
  for (let i = 1; i < n; i++) { const ax = P[i - 1][0], az = P[i - 1][1], ex = P[i][0] - ax, ez = P[i][1] - az, t = ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez), tc = t < 0 ? 0 : t > 1 ? 1 : t,
      qx = ax + ex * tc - x, qz = az + ez * tc - z, dd = qx * qx + qz * qz; if (dd < best) { best = dd; bs = d.ps[i - 1] + (d.ps[i] - d.ps[i - 1]) * tc; bo = (-qx * ez + qz * ex) / Math.hypot(ex, ez); out = (i === 1 && t < -1e-3) || (i === n - 1 && t > 1 + 1e-3); } }
  return best <= d.hw * d.hw && !out ? (d.yAtO ? d.yAtO(bs, bo) : d.yAt(bs)) : null; }   // yAtO(s, o): o = signed offset (+ = right of the path's direction)
// [perf-plaza] BANKSY 5:24 PM "walking around plaza is laggy on pc": areaDeckAt ran over all ~140 area decks (5 us) several times per
// walker sub-step, per follower and per peer. A 6 m grid of each deck's bounds (rebuilt when decks are added) hands it only the decks that
// can contain the point: the same decks in the same order, so the same height. &deckgrid=0 = the full scan.
const DECK_GRID_ON = !(typeof location !== 'undefined' && /[?&]deckgrid=0(&|$)/.test(location.search));
export const DG = { on: DECK_GRID_ON, n: -1, cell: 6, map: new Map() };   // exported for the node equality probe
function deckBounds(d) { if (d.path && d.bb) return d.bb; const r = d.r ? d.r : Math.hypot(d.hw || 0, d.hl || 0) + 0.01; return [d.x - r, d.x + r, d.z - r, d.z + r]; }
function decksNear(x, z) { if (!DG.on) return AREA_DECKS;
  if (DG.n !== AREA_DECKS.length) { DG.n = AREA_DECKS.length; DG.map.clear(); const C = DG.cell;
    AREA_DECKS.forEach((d) => { const b = deckBounds(d); for (let i = Math.floor(b[0] / C); i <= Math.floor(b[1] / C); i++) for (let j = Math.floor(b[2] / C); j <= Math.floor(b[3] / C); j++) { const k = i * 100003 + j; let L = DG.map.get(k); if (!L) DG.map.set(k, L = []); L.push(d); } }); }
  return DG.map.get(Math.floor(x / DG.cell) * 100003 + Math.floor(z / DG.cell)) || NO_DECKS; }
const NO_DECKS = [];
export function areaDeckAt(x, z) { let y = null; for (const d of decksNear(x, z)) { if (d.off) continue; const dx = x - d.x, dz = z - d.z;
  if (d.path) { const v = pathDeckY(d, x, z); if (v !== null) y = Math.max(y ?? -1e9, v); continue; }
  if (d.r) { if (dx * dx + dz * dz <= d.r * d.r) y = Math.max(y ?? -1e9, d.y); continue; }
  const l = dx * d.s + dz * d.c; if (Math.abs(dx * d.c - dz * d.s) > d.hw || Math.abs(l) > d.hl) continue;
  // pad: the footprint runs pad m past both ends as a skirt that falls away 1:1 from the end height, so where two stair decks overlap
  // (a join, the outside wedge of a turn) the max of the two is the one you are really on: no plateau, no lip when you leave the other
  // skirt: [a end, b end]: 'join' = falls away 3:1 (another stair deck carries on: steeper than any stair, so the max is always the deck you are on), 'ground' = eases from the end height into the terrain
  // over the pad (the stair end on a cross-slope: no 0.3-0.9 m edge step onto the bank), null = stops at the true end
  const hp = d.hl - (d.pad || 0), u0 = (l + hp) / (2 * hp), u = Math.min(1, Math.max(0, u0)), out = d.pad ? Math.abs(u0 - u) * 2 * hp : 0;
  const sk = out > 0 ? (d.skirt ? d.skirt[u0 < 0 ? 0 : 1] : 'join') : null; if (out > 0 && !sk) continue;
  let yy = d.prof ? profAt(d, u) : d.y1 !== undefined ? d.y + (d.y1 - d.y) * u : d.y;
  if (sk === 'join') yy -= out * 3; else if (sk === 'ground') { const t = out / d.pad, e = t * t * (3 - 2 * t); yy += (H(x, z) - yy) * e; }
  y = Math.max(y ?? -1e9, yy); } return y; }
const addDeck = (d) => { AREA_DECKS.push({ ...d, c: Math.cos(d.yaw || 0), s: Math.sin(d.yaw || 0) }); };
export const MAP_CIRCS = () => CIRC; // [v300] coli_check: wing props inside the kerb
export const MAP_BOXES = () => BOXES; // [v106] building / wall footprints for the island map
export function hitCollider(x, z, rad = 0.45) {
  if (ADMIN_COL.nocs.length && nocAt(x, z)) return false; // [v346] BANKSY's PASS ZONE: nothing blocks inside it
  const list = HASH.get(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL));
  if (list) for (const o of list) { if (o.off || o.sup) continue; if (o.t === 0) { if (Math.hypot(x - o.x, z - o.z) < o.r + rad) return true; }   // o.sup = removed / moved by the owner (!cdel_ / !cmod_)
    else { const dx = x - o.x, dz = z - o.z, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hx + rad && Math.abs(lz) < o.hz + rad) return true; } }
  if (ADMIN_COL.cols.length) for (const c of ADMIN_COL.cols) if (yIn(c, 0) && shapeHit(c, x, z, rad)) return true;   // [v346] owner blockers + moved built-ins
  return false; }
// ---------- [v346] BANKSY t1820u "add remove or move collisions": the owner's collision edits (pvp_terrain.pieces, every player) ----------
// '!col_*' blocker / '!noc_*' pass zone { s: 'box' | 'cyl', x, z, w, d, yaw | r, y0, y1 } · '!cmod_<ob id>' a built-in moved { s, x, z, w, d, yaw | r } ·
// '!cdel_<ob id>' a built-in removed. Built-ins get a stable id from their kind + ORIGINAL position (0.1 m): ob_<c|b>_<x36>_<z36>[_n].
// y range: LAYER = the body's feet (walker / followers / physics set it); no layer (map tools, the ship) = the whole column.
export const ADMIN_COL = { cols: [], nocs: [], mods: new Map(), dels: new Set(), sup: [], ver: 0 };
const yIn = (c, pad) => LAYER === null || c.y0 === undefined || (LAYER < c.y1 + pad && LAYER + 1.8 > c.y0 - pad);
export function shapeHit(c, x, z, rad = 0) { const dx = x - c.x, dz = z - c.z;
  if (c.s === 'cyl') return dx * dx + dz * dz < (c.r + rad) * (c.r + rad);
  const co = Math.cos(c.yaw || 0), sn = Math.sin(c.yaw || 0), lx = dx * co - dz * sn, lz = dx * sn + dz * co; return Math.abs(lx) < c.w / 2 + rad && Math.abs(lz) < c.d / 2 + rad; }
export function nocAt(x, z) { for (const c of ADMIN_COL.nocs) if (yIn(c, 0.5) && shapeHit(c, x, z, 0)) return true; return false; }
const q36 = (v) => Math.round(v * 10).toString(36);
let OB = { n: -1, map: new Map() };
/** every built-in obstacle by its stable id (o.ox / o.oz = where the island built it) */
export function obstacleIds() { const all = CIRC.length + BOXES.length; if (OB.n === all) return OB.map; const map = new Map(), fresh = [];
  for (const o of [...CIRC, ...BOXES]) { if (o.ox === undefined) Object.assign(o, { ox: o.x, oz: o.z }); if (o.id) map.set(o.id, o); else fresh.push(o); }
  for (const o of fresh) { const k = `ob_${o.t ? 'b' : 'c'}_${q36(o.ox)}_${q36(o.oz)}`; let id = k, i = 1; while (map.has(id)) id = `${k}_${++i}`; o.id = id; map.set(id, o); }
  OB = { n: all, map }; return map; }
/** a built-in as an editable shape (its yaw from the box's c / s) */
export function obstacleShape(o) { return o.t === 0 ? { s: 'cyl', x: o.x, z: o.z, r: o.r } : { s: 'box', x: o.x, z: o.z, w: o.hx * 2, d: o.hz * 2, yaw: Math.atan2(-o.s, o.c) }; }
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
function shapeOf(v, withY) { if (!v || typeof v !== 'object' || (v.s !== 'box' && v.s !== 'cyl')) return null; const x = Number(v.x), z = Number(v.z); if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const o = { s: v.s, x, z }; if (v.s === 'cyl') o.r = num(v.r, 0.2, 60, 2); else { o.w = num(v.w, 0.2, 120, 4); o.d = num(v.d, 0.2, 120, 1.2); o.yaw = num(v.yaw, -7, 7, 0); }
  if (withY) { o.y0 = num(v.y0, -60, 400, 0); o.y1 = Math.max(o.y0 + 0.2, num(v.y1, -60, 400, o.y0 + 4)); } return o; }
/** apply the owner's world pieces ({ id: record }): replaces every earlier edit */
export function applyAdminColliders(pieces) { const P = pieces || {}, ids = obstacleIds();
  for (const o of ADMIN_COL.sup) o.sup = false; const cols = [], nocs = [], mods = new Map(), dels = new Set(), sup = [];
  for (const [id, v] of Object.entries(P)) {
    if (id.startsWith('!col_')) { const c = shapeOf(v, true); if (c) cols.push({ ...c, id }); }
    else if (id.startsWith('!noc_')) { const c = shapeOf(v, true); if (c) nocs.push({ ...c, id }); }
    else if (id.startsWith('!cdel_')) { const ob = id.slice(6); if (v && v.d) dels.add(ob); }
    else if (id.startsWith('!cmod_')) { const c = shapeOf(v, false); if (c) mods.set(id.slice(6), c); } }
  for (const ob of dels) { const o = ids.get(ob); if (o) { o.sup = true; sup.push(o); } }
  for (const [ob, c] of mods) { if (dels.has(ob)) continue; const o = ids.get(ob); if (o) { o.sup = true; sup.push(o); } cols.push({ ...c, id: '!cmod_' + ob, ob }); }
  Object.assign(ADMIN_COL, { cols, nocs, mods, dels, sup, ver: ADMIN_COL.ver + 1 }); return ADMIN_COL; }
/** built-ins (with their ids + current shapes) within r m of (x, z), for the owner's 👁 SHOW COLLISIONS */
export function obstaclesNear(x, z, r = 140) { const ids = obstacleIds(), out = [];
  for (const [id, o] of ids) { const d = Math.hypot(o.x - x, o.z - z); if (d > r + (o.r || Math.hypot(o.hx || 0, o.hz || 0))) continue; out.push({ id, o, off: !!o.off, del: ADMIN_COL.dels.has(id), mod: ADMIN_COL.mods.has(id), shape: obstacleShape(o) }); }
  return out; }

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
// [bridge-path-fix] BANKSY 7:40 PM "match the Main Street cobblestone exactly ... a low stone kerb on each side": the whole red (A) + yellow (B)
// loop gets Main Street's kerb stones (route.js buildStreet: 0.42 x 0.3 boxes, 0.05 sunk, alternating STONE_D / 0x9e978a), PAVE.kerb m out
// each side, following the ground. Gaps where the paving stops (dig spots, the cove, the battle areas), where another trail / ramp / Main
// Street crosses, on area decks + the rope bridge, in water, on colliders and where the ground is too steep for a stone to sit.
// Merged per 250 m tile (frustum-culled), no outlines, no colliders (0.25 m high: stepped over like Main Street's), Low: longer stones, no shadows.
export const KERB_STATS = {}; // laid / skipped-by-reason counts (dev)
function buildKerbs(MATS, OUT, low) {
  const tiles = {}, seg = low ? 2.4 : 1.6, off = PAVE.kerb; let n = 0;
  const R = KERB_STATS; for (const k in R) delete R[k]; const no = (why) => { R[why] = (R[why] || 0) + 1; return false; };
  const ok = (cx, cz, mx, mz) => (paveW(mx, mz) > 0.5 || no('unpaved')) && (gridBi(TRP_G, cx, cz) > off - 0.9 || no('trail')) && (gridBi(STg, cx, cz) > STREET.half + 2.5 || no('street'))
    && (waterAt(cx, cz) === null && H(cx, cz) > 0.3 && gridBi(RVg, cx, cz) > 8 || no('water')) /* [path-hotfix] + no kerb stones across a river ford */ && (areaDeckAt(cx, cz) === null && areaDeckAt(mx, mz) === null || no('deck'))
    && (!(Math.abs(cx - ROPE_BRIDGE.c[0]) < 7 && cz > -108 && cz < -59) || no('bridge')) && (!hitCollider(cx, cz, 0.3) || no('collider'));
  const dSeg = (P, x, z) => { let d = 1e9; for (let i = 1; i < P.length; i++) { const [ax, az] = P[i - 1], [bx, bz] = P[i], ux = bx - ax, uz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / (ux * ux + uz * uz || 1))); d = Math.min(d, Math.hypot(x - ax - ux * t, z - az - uz * t)); } return d; };
  for (const path of [...TRAIL_A_PAINT, TRAILS.B, ...PAVED_PATHS]) { const P = [path[0]]; // resample the spline at the stone length
    for (let i = 1, acc = 0; i < path.length; i++) { const [ax, az] = path[i - 1], [bx, bz] = path[i], L = Math.hypot(bx - ax, bz - az); let t = seg - acc;
      while (t <= L) { P.push([ax + (bx - ax) * t / L, az + (bz - az) * t / L]); t += seg; } acc = L - (t - seg); }
    for (let i = 1; i < P.length; i++) { const [ax, az] = P[i - 1], [bx, bz] = P[i], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.3) continue;
      const nx = dz / L, nz = -dx / L, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      for (const sd of [-1, 1]) { const x0 = ax + nx * off * sd, z0 = az + nz * off * sd, x1 = bx + nx * off * sd, z1 = bz + nz * off * sd, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, Ls = Math.hypot(x1 - x0, z1 - z0);
        if (Ls < 0.4 || !ok(cx, cz, mx, mz)) continue; const y0 = H(x0, z0), y1 = H(x1, z1), yc = H(cx, cz); if (Math.abs(y1 - y0) > Ls * 1.0 || Math.abs(yc - (y0 + y1) / 2) > 0.5) { no('steep'); continue; }
        if (RB_ON && cx > -295 && cx < -255 && cz > -80 && cz < -52 && PAVED_PATHS.some(Q => Q !== path && dSeg(Q, cx, cz) < off - 0.4)) { no('trail'); continue; }   // [v220] the high bridge's plateau landing path: trail A's kerb doesn't run across it (area paths aren't in TRP_G)
        if (RB_ON && ((cx > -295 && cx < -270 && cz > -80 && cz < -55) || (cx > -36 && cx < 18 && cz > -50 && cz < -28))) { const ymk = Math.max((y0 + y1) / 2, yc - 0.08) + 0.05;   // [v220] the high bridge's plateau landing + the north cutting: no stone that would hang off a lip / cutting wall
          if ([[x0, z0], [x1, z1]].some(([px, pz]) => [-0.21, 0.21].some(o => Math.abs(H(px + nx * o, pz + nz * o) - ymk) > 0.45))) { no('steep'); continue; } } R.laid = (R.laid || 0) + 1;
        const ym = Math.max((y0 + y1) / 2, yc - 0.08); // over a crest the middle rides up (never buried mid-stone)
        const key = Math.floor(cx / 250) + '_' + Math.floor(cz / 250), k = tiles[key] = tiles[key] || new Kit();
        W(k, box(0.42, 0.3, Ls - 0.08), (n++ & 1) ? STONE_D : 0x9e978a, 11, M(cx, ym + 0.05, cz, Math.atan2(x1 - x0, z1 - z0), -Math.atan2(y1 - y0, Ls)), false); } } }
  return Object.entries(tiles).map(([key, k]) => { const g = k.build(MATS, OUT); g.name = 'foot_kerbs_' + key; g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = !low; } }); return g; });
}
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
  { id: 'shop_ships', vendor: 'ships', lx: -22, lz: -32, sign: 'shipShop', wall: 0x9db7c9, roof: 0x2a6df4, label: 'SHIP SKINS' }]; // [Timothy] skins + upgrades are separate shops (upgrades: the plaza v2 UPGRADE SHOP)
export const PLAZA_TOKENS_TITLE = { SUNK: '$SUNK', AHOY: '$AHOY', PUMP: '$PUMP', HQ: '$HQ', RETARDIO: '$RETARDIO' }; // [v108] billboard titles (config ISLAND_TOKENS)
export const PLAZA_TOKENS = [{ sym: 'SUNK', lx: -42, lz: -36 }, { sym: 'AHOY', lx: -36, lz: -36 }, { sym: 'PUMP', lx: -30, lz: -36 },
  { sym: 'HQ', lx: 45, lz: -36 }, { sym: 'RETARDIO', lx: 51, lz: -36 }];   // [v144] the other side of the plaza (the first three mirrored across the leaderboards)
// [Timothy] ?plaza=2: the shops + billboards the plaza actually shows (js/dock/layout.js uses these too)
export const PLAZA_SHOPS_ON = PV2 ? PV.STOREFRONTS : PLAZA_SHOPS, PLAZA_TOKENS_ON = (PV2 ? PV.remapTokens(PLAZA_TOKENS) : PLAZA_TOKENS).filter(t => !CO.hallTokenHidden(t.sym)); // [v240] $HQ / $RETARDIO hidden (&hallboards=1)
export let PLAZA_V2_SIGNS = null; export const PV_DOCK = PV.DOCK; export { PV };
export const INTERACT = []; // { id, x, z, r, label }
// [v337] BANKSY t1790u: the SAME dock-plaza gravel (color 0xc9bfae, aMat 10 -> look.js libTri(4)) runs continuously up Main Street
// from the Dock Plaza seam (lz = SLAB.lz0 = -54, y = STREET_Y = 2.73) to the Fountain plaza mouth (STREET.z1 / GATE, y ≈ 20.1).
// Terrain-conforming strip (Htri crest-safe, ~4 cm proud of the 4 m facets) + a path deck so feet stand ON the gravel, never into shop interiors.
const STREET_GRAVEL = { col: 0xc9bfae, mat: 10, lift: 0.04, step: 1.25, half: STREET.half + 0.9, fountainY: 20.1 };
function streetGravelY(lx, lz) {
  const [x, z] = townToWorld(lx, lz), lift = STREET_GRAVEL.lift;
  let y = Math.max(H(x, z), Htri(x, z)) + lift;
  const sy = (PV && PV.STREET_Y) || 2.73;
  if (lz > -58) { const t = Math.min(1, Math.max(0, (lz + 58) / 4)); const e = t * t * (3 - 2 * t); y = y * (1 - e) + sy * e; }
  if (lz < STREET.z1 + 8) { const t = Math.min(1, Math.max(0, (STREET.z1 + 8 - lz) / 8)); const e = t * t * (3 - 2 * t); y = y * (1 - e) + STREET_GRAVEL.fountainY * e; }
  return y;
}
function buildStreetGravel(k) {
  // Returns { verts, decks } for diagnostics. Safe: never throws out of createFoot.
  try {
    const S = STREET, Gv = STREET_GRAVEL, hw = Gv.half, step = Gv.step, lz0 = -54, lz1 = S.z1 + 1.5;
    const pos = [];
    const pushV = (lx, lz) => { const [x, z] = townToWorld(lx, lz); pos.push(x, streetGravelY(lx, lz), z); };
    for (let lz = lz0; lz > lz1; lz -= step) {
      const lzB = Math.max(lz1, lz - step);
      for (let sx = -hw; sx < hw - 1e-6; sx += step) {
        const sx1 = Math.min(hw, sx + step), lx0 = S.x + sx, lx1 = S.x + sx1;
        const midx = (lx0 + lx1) / 2, midz = (lz + lzB) / 2;
        // only skip the coliseum alley mouth (east of street), never the Main Street corridor itself
        if (COLI.COLISEUM_ON && midx > S.x + S.half && COLI.inMainAlley(midx, midz, 0.4)) continue;
        pushV(lx0, lz); pushV(lx0, lzB); pushV(lx1, lzB);
        pushV(lx0, lz); pushV(lx1, lzB); pushV(lx1, lz);
      }
    }
    if (!pos.length) { console.warn('[v337] street gravel: empty pos'); return { verts: 0, decks: 0 }; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    W(k, g, Gv.col, Gv.mat, null, false);
    const path = [], ps = [0];
    for (let lz = lz0, i = 0; lz >= lz1 - 1e-6; lz -= step, i++) {
      const [x, z] = townToWorld(S.x, Math.max(lz1, lz)); path.push([x, z]);
      if (i) ps.push(ps[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    }
    let decks = 0;
    if (path.length >= 2) {
      const xs = path.map(p => p[0]), zs = path.map(p => p[1]), L = ps[ps.length - 1] || 1;
      addDeck({ id: 'street_gravel', path, ps, hw, yAt: (s) => {
        const u = Math.min(1, Math.max(0, s / L));
        return streetGravelY(S.x, lz0 + (lz1 - lz0) * u);
      }, bb: [Math.min(...xs) - hw - 1, Math.max(...xs) + hw + 1, Math.min(...zs) - hw - 1, Math.max(...zs) + hw + 1] });
      decks = 1;
    }
    return { verts: pos.length / 3, decks };
  } catch (e) { console.warn('[v337] street gravel failed', e); return { verts: 0, decks: 0, err: String(e && e.message || e) }; }
}
export function buildStreet(A, low, F) {
  const k = new Kit(), S = STREET; k.ao = (x, y, z) => 0.58 + 0.42 * sm(0, 2.6, y - H(x, z)); KPG = 'street';
  // gravel mesh is built as its own kit group in createFoot (foot_street_gravel) so it cannot be dropped by street kit merge
  const lots = []; for (let z = S.z0 - 10, n = 0; z > S.z1 + 8; n++) { const w = 7 + hash(n, 3) * 4; lots.push([z - w / 2, w, n]); z -= w + 1.6; }
  const SIGNS = { '-1:1': 'tavern', '1:3': 'shop', '-1:4': 'bounties' };
  for (const side of [-1, 1]) for (const [z, w, n] of lots) {
    if (side === 1 && n === 0) continue;                      // Squad Hall plot
    if (n === 4 && side === 1) continue;                      // the square (well)
    const fl = 2 + (hash(n, side) > 0.55 ? 1 : 0), d = 8 + hash(side, n) * 2, lx = S.x + side * (S.half + 1 + d / 2), [x, wz] = tw(lx, z), yaw = twy(side === -1 ? Math.PI / 2 : -Math.PI / 2);
    if (PV.hillLot && PV.hillLot({ side, n, z, w, d, lx, x, wz, yaw, y: H(x, wz), addBox, addCirc, LOTS_MAP })) continue; // [Timothy] Blender hill street building + its own colliders (js/island/hillStreet.js), else the colonial house
    colonial(k, F, x, H(x, wz), wz, yaw, w, d, fl, n * 2 + (side > 0 ? 1 : 0), low, SIGNS[side + ':' + n] || null, A);
    { const nm = { '1:3': 'SHOP (R3)', '-1:1': 'Tavern (L1)', '-1:4': 'Bounties (L4)' }[side + ':' + n]; LOTS_MAP.push({ lx, z, w, d, side, label: nm || null, col: nm ? '#fbbf24' : 'rgba(240,220,190,0.9)', tc: nm ? '#fde68a' : '#fff', ...({ '1:3': { ldx: 20, ldy: 75 }, '-1:1': { ldx: -10, ldy: -70 }, '-1:4': { ldx: 10, ldy: -70 } }[side + ':' + n] || {}) });
      if (side === 1 && n === 3) { const [sx, sz] = tw(S.x + S.half + 1 - 1.6, z); SHOP_SPOTS.shop = { id: 'shop', x: +sx.toFixed(2), z: +sz.toFixed(2), r: 2.4, label: 'E · SHOP' }; } }
    addBox(x, wz, w + 0.6, d + 0.6, yaw);
  }
  { // SQUAD HALL: [Timothy v312] the Blender guildhall (js/island/hillStreet.js bigShop: 24 x 14.5 m, walk-in war room, own colliders), else the old town-kit hall
    const [z] = lots[0], SQH = PV.squadHall ? PV.squadHall() : null, lx = SQH ? SQH.lx : S.x + S.half + 1 + 7, zc = SQH ? SQH.lz : z - 3, [x, wz] = tw(lx, zc), yaw = twy(-Math.PI / 2), y = H(x, wz);
    const BS = PV.bigShop && PV.bigShop({ x, y, wz, yaw, lx, z: zc, addBox, addCirc });
    if (!BS) colonial(k, F, x, y, wz, yaw, 16, 14, 3, 3, low, 'squad', A), addBox(x, wz, 16.6, 14.6, yaw);
    if (!BS) k.at(M(x, y, wz, yaw), () => { for (const sx of [-5.5, 5.5]) { if (!KP) W(k, box(1.8, 0.12, 4.6), RED, 12, M(sx, 7.5, 7.4, 0, Math.PI / 2), false); if (A.ppflag) atlasQuad(k, 1.7, 1.2, A.ppflag, M(sx, 7.9, KP ? 8.18 : 7.48)); }
      if (KP) atlasQuad(k, 6.6, 1.3, A.squad, M(0, 9.3, 7.5)); // on the Blender hall's facade sign board (2nd floor, reads from the street)
      else { W(k, box(4.2, 0.9, 0.3), WOOD_D, 2, M(0, 4.4, 7.4), false); atlasQuad(k, 4.0, 0.8, A.squad, M(0, 4.4, 7.56)); } });
    // the war table, banners, crew roster board, chandeliers, wing furniture + their colliders are baked into the Blender hall (hill_street_blender.py squad_hall)
    LOTS_MAP.push({ lx, z: zc, w: BS ? SQH.w : 16, d: BS ? SQH.d : 14, side: 1, label: 'SQUAD HALL (R0)', col: '#a855f7', tc: '#e9d5ff', ldx: -30, ldy: 70 });
    const [dx, dz] = BS ? tw(SQH.interact.lx, SQH.interact.lz) : tw(lx - 7 + 3.5, zc); INTERACT.push({ id: 'squadhall', x: dx, z: dz, r: BS ? SQH.interact.r : 3.2, label: 'E · SQUAD HALL' }); // inside the hall, on the runner in front of the war table
  }
  if (COASTM && PV.casinoSite) PV.casinoSite({ addBox, addCirc, addDeck, INTERACT, LOTS_MAP }); // [Timothy] THE GOLDEN DOUBLOON CASINO (#47): walls + tables colliders, floor deck, 4 E points (js/island/casino.js)
  if (!COLI.COLISEUM_ON) { // old square restored ONLY by &coliseum=0 (well + stalls + colliders)
    const [z, w] = lots[4], lx = S.x + S.half + 7, [x, wz] = tw(lx, z), y = H(x, wz);
    W(k, cyl(1.6, 1.7, 1.0, 14), STONE, 11, M(x, y + 0.5, wz)); W(k, cyl(1.25, 1.25, 0.2, 14), 0x2b5d6a, 0, M(x, y + 0.92, wz), false);
    for (const s of [-1, 1]) W(k, box(0.2, 2.6, 0.2), WOOD_D, 2, M(x + s * 1.3, y + 1.8, wz), false); W(k, box(3.0, 0.2, 0.25), WOOD_D, 2, M(x, y + 3.1, wz), false);
    W(k, new THREE.ConeGeometry(2.1, 1.0, 4), ROOFS[0], 4, M(x, y + 3.7, wz, Math.PI / 4));
    addCirc(x, wz, 1.8);
    LOTS_MAP.push({ lx, z, w, d: 12, side: 1, label: 'SQUARE + well, red/blue stalls (R4)', col: 'rgba(201,191,174,0.95)', tc: '#fff', ldx: 50, ldy: 40 });
    if (!COLI.COLISEUM_ON) {
      for (const [id, dz] of [['stall_red', 3.5], ['stall_blue', -3.5]]) { const [sx, sz] = tw(lx + 3.2, z + dz); SHOP_SPOTS[id] = { id, x: +sx.toFixed(2), z: +sz.toFixed(2), r: 2.6, label: 'E · ' + (id === 'stall_red' ? 'RED' : 'BLUE') + ' STALL' }; }
      stall(k, ...tw(lx + 3.2, z + 3.5).flatMap((v, i) => i ? [v] : [v, H(...tw(lx + 3.2, z + 3.5))]), twy(-Math.PI / 2), 0xd8322f); addCirc(...tw(lx + 3.2, z + 3.5), 1.8);
      stall(k, ...tw(lx + 3.2, z - 3.5).flatMap((v, i) => i ? [v] : [v, H(...tw(lx + 3.2, z - 3.5))]), twy(-Math.PI / 2), 0x2a6df4); addCirc(...tw(lx + 3.2, z - 3.5), 1.8);
    } // [Emerly] coli main entrance: stalls removed when COLISEUM_ON
  }
  // street dressing: lamps (flame + light), crates / barrels / sacks against the walls
  for (let z = S.z0 - 6; z > S.z1; z -= 16) for (const s of [-1, 1]) { if (s === 1 && COLI.inMainAlley(S.x + S.half - 0.6,z,1)) continue; const [x, wz] = tw(S.x + s * (S.half - 0.6), z), y = H(x, wz);
    if (KP) kp(k, 'lamp', M(x, y, wz)); else { W(k, cyl(0.09, 0.12, 3.6, 6), IRON, 0, M(x, y + 1.8, wz)); W(k, box(0.5, 0.6, 0.5), IRON, 0, M(x, y + 3.7, wz), false); k.add(new THREE.SphereGeometry(0.2, 6, 4), 0xffd36b, { bucket: 'glow', m: M(x, y + 3.65, wz), outline: false }); } F.push({ x, y: y + 3.95, z: wz, lamp: true }); addCirc(x, wz, 0.3); }
  for (let i = 0; i < (low ? 10 : 22); i++) { const s = i % 2 ? 1 : -1, z = S.z0 - 8 - i * 6.4, [x, wz] = tw(S.x + s * (S.half - 0.2), z), y = H(x, wz), ry = twy(hash(i, 4) * 6);
    if (s === 1 && (COLI.inMainAlley(S.x + S.half - 0.2,z,1) || (PV.hallFront && PV.hallFront(z)))) continue; // [Timothy v312] + the Squad Hall portal kept clear
    if (i % 3 === 0) barrel(k, M(x, y, wz, ry)); else if (i % 3 === 1) crate(k, M(x, y, wz, ry), 1.1); else sacks(k, M(x, y, wz, ry)); addCirc(x, wz, 0.8); }
  { const z = S.z1 + 4, y = H(...tw(S.x, z)); // town gate
    for (const s of [-1, 1]) { const [x, wz] = tw(S.x + s * (S.half + 1.6), z); if (!GATE_ARCH_OFF) { W(k, box(3.2, 10, 3.2), STONE, 11, M(x, y + 5, wz, twy(0))); for (let c = 0; c < 4; c++) W(k, box(0.8, 0.9, 0.8), STONE, 11, M(x + (c % 2 - 0.5) * 2, y + 10.4, wz + (c > 1 ? 1 : -1) * 1.0, twy(0)), false); addBox(x, wz, 3.4, 3.4, twy(0)); } torchPost(k, F, ...tw(S.x + s * (S.half - 0.4), z + 2.5).flatMap((v, i) => i ? [H(...tw(S.x + s * (S.half - 0.4), z + 2.5)), v] : [v])); }
    const [gx, gz] = tw(S.x, z); if (!GATE_ARCH_OFF) W(k, box(S.half * 2 + 6, 2.2, 3.0), STONE_D, 11, M(gx, y + 9.0, gz, twy(0)));   // [rb-blender] no lintel: the street opens onto the fountain plaza
    if (!GATE_ARCH_OFF) k.at(M(gx, y + 9.8, gz, twy(0)), () => { if (A.ppflag) { W(k, cyl(0.08, 0.08, 4, 5), WOOD_D, 2, M(0, 2, 0), false); atlasQuad(k, 3.0, 2.0, A.ppflag, M(1.55, 3.0, 0.03)); atlasQuad(k, 3.0, 2.0, A.ppflag, M(1.55, 3.0, -0.03, Math.PI)); } }); }
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
    if (PV2) at(cx, -0.2, 0, () => { W(k, box(L, 7.6, 0.4), STONE_D, 11, M(0, Y0 - 3.7, 0)); W(k, box(L + 0.4, 0.3, 0.4), STONE, 11, M(0, PV.STREET_Y - 0.15, 0), false); }, 0); // [Timothy] v2: the boardwalk covers the old coping; this one is flush with the street
    else at(cx, 0.6, 0, () => { W(k, box(L, 7.6, 1.6), STONE_D, 11, M(0, Y0 - 3.7, 0)); W(k, box(L + 0.4, 0.4, 2.0), STONE, 11, M(0, Y0 + 0.1, 0), false); }, 0);
    at(cx, -27, 0, () => W(k, box(L - 2, 0.3, 54), 0xc9bfae, 10, M(0, Y0 - 0.02, 0), false), 0);
    for (let lx = CO.QUAY.lx0 + 6; lx < CO.QUAY.lx1 - 4; lx += 12) { if (PV2) continue; // [Timothy] v2: the quay edge is the boardwalk (bollards on its sea rail)
      const [x, z] = T(lx, -0.6); if (KP) kp(k, 'bollard', M(x, Y0 + 0.2, z)); } }
  // stone mole out to the lighthouse (the lighthouse itself = the inland lighthouse POI, moved onto the mole tip)
  { const m = CO.MOLE; at(m.lx, (m.lz0 + m.lz1) / 2, 0, () => { W(k, box(m.w, 7.6, m.lz1 - m.lz0), STONE_D, 11, M(0, m.y - 3.7, 0)); W(k, box(m.w + 0.4, 0.4, m.lz1 - m.lz0), STONE, 11, M(0, m.y + 0.1, 0), false); }, 0);
    at(m.lx, m.lz1, 0, () => W(k, cyl(m.tipR, m.tipR + 0.6, 7.6, 18), STONE_D, 11, M(0, m.y - 3.7, 0)), 0);
    for (let lz = 10; lz < m.lz1 - 8; lz += 14) { const [x, z] = T(m.lx, lz); if (KP) kp(k, 'lamp', M(x, m.y + 0.2, z)); F.push({ x, y: m.y + 4.2, z, lamp: true }); } }
  // boardwalk on stilts along the beach + the four T-head piers (8 berths)
  { const B = CO.BOARDWALK, lx1 = PV2 ? PV.DOCK.deckEnd : B.lx1; deck((B.lx0 + lx1) / 2, (B.lz0 + B.lz1) / 2, lx1 - B.lx0, B.lz1 - B.lz0); } // [Timothy] v2: the last 9 m are the dock ramp
  for (const p of CO.PIERS) { if (PV2 && !PV.keepOldPier(p.lx)) continue; stem(p.lx, p.lz0, p.head0); deck(p.lx, (p.head0 + p.head1) / 2, p.half * 2, p.head1 - p.head0);
    for (const t of [-12, 12]) for (const e of [-8.5, 8.5]) { const [x, z] = T(p.lx + t + e, p.head1 - 0.7); if (KP) kp(k, 'bollard', M(x, PY + 0.16, z)); }
    for (const sx of [-1, 1]) torchPost(k, F, ...(([x, z]) => [x, PY + 0.15, z])(T(p.lx + sx * (p.half - 1), (p.head0 + p.head1) / 2)));
    { const [x, z] = T(p.lx - 2.2, p.head0 + 1.6); crate(k, M(x, PY + 0.16, z, 0.3 + p.k)); } { const [x, z] = T(p.lx + 2.4, p.head0 + 1.5); barrel(k, M(x, PY + 0.16, z)); }
    // small side jetty with a rowboat between piers
    stem(p.lx - 30, 4, 22); at(p.lx - 26, 16, 0, () => { W(k, box(2.2, 0.8, 5.5), WOOD, 2, M(0, 0.2, 0)); W(k, box(1.8, 0.15, 5.0), WOOD_L, 2, M(0, 0.62, 0), false); }, 0); }
  // decor ships on 7 berths (the 8th, P4R, gets a real baked game ship in main.js)
  if (!PV2) CO.COAST_BERTHS.forEach((b, i) => { if (decorHulls && b.id !== 'P4') hull(b.lx, b.lz, 20, [0x6b4527, 0x3d2a1c, 0x7b3b20, 0x2c3e50][i % 4], i % 3 !== 2); });
  // shacks on stilts at the waterline + on the beach behind the boardwalk, barrels / crates / nets between them
  for (let i = 0; i < 9; i++) { const lx = -70 - i * 26 - hash(i, 2) * 6, onW = i % 3 === 1; if (PV2 && lx > PV.BOARDWALK.lx0 - 14 && lx < PV.BOARDWALK.lx1) continue; shack(lx, onW ? 12 : -8 - hash(i, 5) * 8, onW ? Math.PI / 2 : 0, 5 + hash(i, 1) * 2, 4.5 + hash(i, 3) * 1.5, onW ? PY : H(...T(lx, -8)) + 1.6, [0xa86a3a, 0x8a5a2b, 0xb98a5a, 0x7a5232][i % 4]);
    if (PV2 && lx + 12 > PV.DOCK.deckEnd) continue; const [x, z] = T(lx + 9, -1); barrel(k, M(x, PY + 0.16, z)); const [x2, z2] = T(lx + 11, 1.5); crate(k, M(x2, PY + 0.16, z2, i)); }
  // plaza: WAVES + ARENA boards facing the harbor, token exchange, harbor market, the tall stone harbor tower framing it
  const P = Object.fromEntries(CO.PLAZA_POIS.map(q => [q.id, q]));
  // [v103] WAVES + ARENA boards are LIVE LEADERBOARDS (BANKSY): a bigger frame; js/dock/plaza.js lays one live canvas screen
  // (both boards in one texture, 1 draw call) on the front at PLAZA_BOARD.face; the painted title sign rides on top + on the back
  for (const [id, sg, c] of [['waves', 'waves', 0xd8322f], ['arena', 'arena', 0x2a6df4]]) at(P[id].lx, P[id].lz, P[id].yaw, () => { const B = PLAZA_BOARD;
    for (const s of [-1, 1]) W(k, box(0.34, B.y + B.h / 2 + 1.3, 0.34), WOOD_D, 2, M(s * (B.w / 2 + 0.25), (B.y + B.h / 2 + 1.3) / 2, 0));
    W(k, box(B.w + 0.4, B.h + 0.4, 0.3), c, 2, M(0, B.y, 0)); W(k, box(B.w + 0.1, B.h + 0.1, 0.05), 0x161616, 0, M(0, B.y, 0.16), false);
    W(k, box(B.w * 0.84, 1.1, 0.2), WOOD_D, 2, M(0, B.y + B.h / 2 + 0.85, 0), false);
    if (A[sg]) { atlasQuad(k, B.w * 0.8, 0.95, A[sg], M(0, B.y + B.h / 2 + 0.85, 0.11)); atlasQuad(k, B.w * 0.8, 0.95, A[sg], M(0, B.y + B.h / 2 + 0.85, -0.11, Math.PI));
      atlasQuad(k, B.w * 0.9, 1.1, A[sg], M(0, B.y, -0.17, Math.PI)); }
    W(k, box(B.w + 0.6, 0.3, 0.5), WOOD_D, 2, M(0, B.y + B.h / 2 + 0.2, 0), false); }, Y0);
  for (const id of ['waves', 'arena']) { const [x, z] = T(P[id].lx, P[id].lz); addBox(x, z, PLAZA_BOARD.w + 1, 0.6, CO.t2wYaw(P[id].yaw)); }
  if (CO.TOKENX_ON) at(P.exchange.lx, P.exchange.lz, 0, () => { W(k, box(6, 3.4, 4.5), CREAM, 7, M(0, 1.7, 0)); W(k, new THREE.ConeGeometry(5.0, 2.2, 4), GOLD, 4, M(0, 4.5, 0, Math.PI / 4)); W(k, box(4.5, 1.1, 0.8), WOOD, 2, M(0, 0.55, 2.6));
    if (A.exchange) atlasQuad(k, 3.4, 0.9, A.exchange, M(0, 2.9, 2.27)); }, Y0); if (CO.TOKENX_ON) { const [x, z] = T(P.exchange.lx, P.exchange.lz); addBox(x, z, 6.4, 5, yaw0); }   // [v240] the kiosk is hidden unless &tokenx=1 (the FISH MARKET stands there)
  // [v103] the HARBOR MARKET stalls are now two proper shops (BANKSY): CLOTHES SHOP + SHIP SKINS / UPGRADES, and between them
  // three token billboards ($SUNK / $AHOY / $PUMP). All static + atlas signage, merged into the street mesh (0 extra draw calls).
  if (!PV2) for (const sp of PLAZA_SHOPS) at(sp.lx, sp.lz, 0, () => { const w = 7.2, d = 4.4;
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
  if (!PV2) for (const sp of PLAZA_SHOPS) { const [x, z] = T(sp.lx, sp.lz); addBox(x, z, 7.6, 4.8, yaw0); }
  for (const tb of PLAZA_TOKENS_ON) at(tb.lx, tb.lz, 0, () => {
    for (const sx of [-1, 1]) W(k, box(0.26, 5.8, 0.26), WOOD_D, 2, M(sx * 2.05, 2.9, 0));
    W(k, box(4.5, 4.0, 0.24), WOOD_D, 2, M(0, 3.75, 0)); if (A['bb' + tb.sym]) atlasQuad(k, 4.2, 3.8, A['bb' + tb.sym], M(0, 3.95, 0.13));
    if (A['tokLive' + tb.sym]) atlasQuad(k, 3.8, 1.0, A['tokLive' + tb.sym], M(0, 1.55, 0.13));                // live price strip (atlas.drawTokenBoard)
    W(k, box(4.2, 1.2, 0.2), 0x161616, 0, M(0, 1.55, 0.02), false);
    if (A.ppflag) atlasQuad(k, 4.2, 3.0, A.ppflag, M(0, 3.75, -0.13, Math.PI));                                  // back: the PUMPFUN PIRATES flag
  }, Y0);
  for (const tb of PLAZA_TOKENS_ON) { const [x, z] = T(tb.lx, tb.lz); addBox(x, z, 4.6, 0.5, yaw0); }
  if (PV2) PLAZA_V2_SIGNS = PV.buildPlazaV2({ k, W, box, cyl, M, at, colonial, barrel, crate, sacks, torchPost, stall, addBox, addCirc, T, H, F, A, low, Y0, yaw0, deckY: PY + 0.15,
    C: { WOOD, WOOD_D, WOOD_L, IRON, STONE, STONE_D, ROOF: ROOFS[1], ROOFS, SHUTTER, BARK: 0xa96a38, GOLD, CREAM } });   // [Timothy] harbor town blockout
  if (!PV2) for (let i = 0; i < 10; i++) { const [x, z] = T(-50 + i * 11 + hash(i, 9) * 4, -6 - hash(i, 7) * 6); (i % 2 ? crate : barrel)(k, M(x, Y0, z, i), 1.2); addCirc(x, z, 0.8); }
  if (!(PV2 && PV.FISH_HALL)) { // [v247] the harbor tower (#11) made room for the FISH MARKET on the plaza-v2 row
  at(P.tower.lx, P.tower.lz, 0, () => { W(k, box(9, 24, 9), STONE, 11, M(0, 12, 0)); W(k, box(10, 1, 10), STONE_D, 11, M(0, 24.3, 0), false); W(k, new THREE.ConeGeometry(7.4, 7, 4), ROOFS[1], 4, M(0, 28.3, 0, Math.PI / 4));
    for (const y of [8, 15, 20]) W(k, box(1.4, 2.2, 0.3), 0x2b3d4a, 0, M(0, y, 4.6), false); }, Y0); { const [x, z] = T(P.tower.lx, P.tower.lz); addBox(x, z, 9.4, 9.4, yaw0); } }
  if (!PV2) for (const lx of [-50, -20, 10, 40, 70]) { const [x, z] = T(lx, -3); torchPost(k, F, x, Y0, z); } // [Timothy] v2 lights its own jetty roots
  // spectate spyglass on the mole deck (CO.SPYGLASS, walkable; the interact point is the same spot)
  at(CO.SPYGLASS.lx, CO.SPYGLASS.lz, 0, () => { W(k, cyl(0.12, 0.16, 1.4, 6), IRON, 0, M(0, 0.7, 0)); W(k, cyl(0.12, 0.2, 1.6, 8), GOLD, 0, M(0, 1.55, 0.3, 0, Math.PI / 2 - 0.2), false); }, CO.SPYGLASS.y);
  // fort at the top of Main Street: keep, curtain wall, 4 round towers, pirate flag
  // [island-rework] FORT_WALKIN: js/island/areas/fort.js builds the walk-in fort (gate stair, courtyard, keep war room, ramparts) instead
  if (!FORT_WALKIN) at(CO.FORT.lx, CO.FORT.lz, 0, () => { W(k, box(26, 7, 26), STONE, 11, M(0, 2.5, 0)); W(k, box(14, 18, 14), STONE_D, 11, M(0, 10.5, 0));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { W(k, cyl(3.2, 3.6, 18, 12), STONE, 11, M(sx * 13, 7, sz * 13)); W(k, new THREE.ConeGeometry(4, 5, 12), ROOFS[0], 4, M(sx * 13, 18.5, sz * 13)); }
    W(k, cyl(0.2, 0.2, 12, 5), WOOD_D, 2, M(0, 25.5, 0), false); if (A.ppflag) { atlasQuad(k, 6, 4, A.ppflag, M(3.05, 29, 0.03)); atlasQuad(k, 6, 4, A.ppflag, M(3.05, 29, -0.03, Math.PI)); }
    for (let i = 0; i < 4; i++) cannon(k, M(-6 + i * 4, 6.1, 13.4, 0)); }, null); if (!FORT_WALKIN) { const [x, z] = T(CO.FORT.lx, CO.FORT.lz); addBox(x, z, 27, 27, yaw0); }
  // battery on the cliff headland: [Timothy] js/island/battery.js (ramp up from the quay, parapets, shot piles, lamps, colliders; the 6 guns are createGuns)
  BT.buildArt({ k, W, box, cyl, T, H, addBox, addCirc, torchPost, F, C: { STONE, STONE_D, WOOD, WOOD_D, IRON } });
  buildSwimCove(k, at, low);                                                                       // [Raul] SWIM COVE (BANKSY)
  BA.buildArt({ k, W, box, cyl, T, H, addBox, addCirc, torchPost, barrel, crate, F, C: { STONE, STONE_D, WOOD, WOOD_D, IRON } }); // [Timothy] battle areas: range + pit (static art, colliders)
  COLI.buildArt({ rentLot: PV.rentLot, squadOverlap: (a, b, c, d) => !!(PV.squadOverlap?.(a, b, c, d) || PV.casinoOverlap?.(a, b, c, d)), /* [Timothy] + the casino */ k, W, box, cyl, T, H, addBox, addCirc, addDeck, torchPost, barrel, crate, F, C: { STONE, STONE_D, WOOD, WOOD_D, IRON } }); // [Emerly] intact colosseum shell + gates + stores
  return k;
}
// [Raul] SWIM COVE art (merged into the coast kit: 0 extra draw calls): jetty on posts + 4 steps up to a diving tower with rails and
// a board, a swim ladder, a red / white buoy line on a rope at the chest-deep line, boulders on the dune. Walk data: coveDeckAt.
function buildSwimCove(k, at, low) {
  const C = CO.SWIM_COVE, J = C.jetty, TW = J.tower, PLANK = 0xc99566, L = J.lx0 - J.lx1, PB = C.bottom - 0.3;
  at(J.lx0 - L / 2, J.lz, 0, () => { W(k, box(L, 0.22, J.hw * 2), PLANK, 2, M(0, J.y - 0.11, 0));                                   // walkway
    for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) W(k, cyl(0.13, 0.15, J.y - PB, 6), WOOD_D, 2, M(-L / 2 + 0.3 + i * (L - 0.6) / 4, (J.y + PB) / 2 - 0.2, s * (J.hw - 0.15)), false); }, 0);
  J.steps.forEach((y, i) => at(J.lx1 - i - 0.5, J.lz, 0, () => W(k, box(1.0, y - PB, J.hw * 2), PLANK, 2, M(0, (y + PB) / 2, 0)), 0));
  const tl = TW.lx0 - TW.lx1;
  at(TW.lx0 - tl / 2, J.lz, 0, () => { W(k, box(tl, 0.3, TW.hw * 2), PLANK, 2, M(0, TW.y - 0.15, 0));                                // tower deck
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) W(k, cyl(0.18, 0.2, TW.y - PB, 6), WOOD_D, 2, M(sx * (tl / 2 - 0.25), (TW.y + PB) / 2 - 0.3, sz * (TW.hw - 0.25)), false);
    for (const sz of [-1, 1]) { W(k, box(tl, 0.1, 0.1), WOOD_D, 2, M(0, TW.y + 0.95, sz * (TW.hw - 0.1)), false); for (const sx of [-1, 0, 1]) W(k, cyl(0.05, 0.05, 0.95, 5), WOOD_D, 2, M(sx * (tl / 2 - 0.2), TW.y + 0.47, sz * (TW.hw - 0.1)), false); } }, 0);
  at(J.lx1 + 2, J.lz - J.hw - 0.12, 0, () => { for (const sx of [-0.3, 0.3]) W(k, cyl(0.04, 0.04, J.y - C.y + 2.2, 5), IRON, 0, M(sx, (J.y + C.y - 2.2) / 2 + 0.6, 0), false);   // swim ladder
    for (let y = C.y - 1.2; y < J.y; y += 0.4) W(k, cyl(0.03, 0.03, 0.6, 4), IRON, 0, M(0, y, 0, 0, 0, Math.PI / 2), false); }, 0);
  const bl = TW.lx1 - J.board.lx1; at(TW.lx1 - bl / 2, J.lz, 0, () => { W(k, box(bl + 0.6, 0.12, J.board.hw * 2), 0xf2e4c4, 12, M(0.3, TW.y + 0.04, 0)); }, 0);  // diving board
  // buoy rope at the chest-deep line (static: the cove is calm)
  const B = C.buoys, pts = []; for (let i = 0; i < B.n; i++) { const u = i / (B.n - 1); pts.push([B.lx - Math.sin(u * Math.PI) * 3, B.lz0 + (B.lz1 - B.lz0) * u]); }
  pts.forEach(([lx, lz], i) => { at(lx, lz, 0, () => W(k, new THREE.SphereGeometry(0.38, low ? 8 : 12, low ? 6 : 8), i % 2 ? 0xffffff : 0xe0302a, 12, M(0, C.y + 0.08, 0, 0, 0, 0, [1, 0.85, 1])), 0);
    if (i) { const [ax, az] = pts[i - 1], dl = Math.hypot(lx - ax, lz - az); at((lx + ax) / 2, (lz + az) / 2, 0, () => W(k, cyl(0.035, 0.035, dl, 4), 0xe8d9a8, 12, M(0, C.y + 0.12, 0, Math.atan2(lx - ax, lz - az), Math.PI / 2), false), 0); } });
  // boulders round the rim (shelter + a low jump-off rock on the north side)
  [[-224, -70.5, 2.2], [-262, -71, 1.8], [-206, -62, 1.9], [-236, -25, 1.6], [-268, -26.5, 1.4], [-209, -33, 2.0]].forEach(([lx, lz, sc], i) => at(lx, lz, 0, () =>
    W(k, jitter(new THREE.IcosahedronGeometry(1, 1), 0.22, 40 + i), (px, py) => (py > 0.2 ? 0xa8a095 : 0x7f786f), 3, M(0, sc * 0.2, 0, i, 0.3, 0.2, [sc * 1.2, sc * 0.8, sc]))));
}
// [Raul] SWIM COVE water: one calm, clear ellipse at CO.SWIM_COVE.y (sandy tint in the shallows, deeper blue, slow caustics, a soft
// lip at the shore); per-vertex depth from the terrain. 1 draw call, ~250 (phone) / ~650 tris
function coveWater(uTime, low) {
  const C = CO.SWIM_COVE, NR = low ? 6 : 10, NS = low ? 24 : 40, pos = [], dep = [], idx = [];
  pos.push(...(([x, z]) => [x, C.y + 0.03, z])(CO.t2w(C.lx, C.lz))); dep.push(C.y - H(...CO.t2w(C.lx, C.lz)), 0);
  for (let r = 1; r <= NR; r++) for (let s = 0; s < NS; s++) { const u = r / NR * 1.02, a = s / NS * Math.PI * 2, [x, z] = CO.t2w(C.lx + Math.cos(a) * C.ax * u, C.lz + Math.sin(a) * C.az * u); pos.push(x, C.y + 0.03, z); dep.push(C.y - H(x, z), u); }
  for (let s = 0; s < NS; s++) idx.push(0, 1 + (s + 1) % NS, 1 + s);
  for (let r = 1; r < NR; r++) for (let s = 0; s < NS; s++) { const a = 1 + (r - 1) * NS + s, b = 1 + (r - 1) * NS + (s + 1) % NS, c = a + NS, d = b + NS; idx.push(a, b, d, a, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aD', new THREE.Float32BufferAttribute(dep, 2)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: `attribute vec2 aD; varying vec2 vD; varying vec3 vP;
      #include <fog_pars_vertex>
      void main(){ vD = aD; vP = position; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; varying vec2 vD; varying vec3 vP;
      #include <common>
      #include <fog_pars_fragment>
      void main(){ float d = max(vD.x, 0.0);
        vec3 col = mix(vec3(0.42, 0.86, 0.84), vec3(0.08, 0.5, 0.74), smoothstep(0.1, 2.2, d));
        float caus = pow(abs(sin(vP.x * 0.6 + uTime * 0.5 + sin(vP.z * 0.35)) * sin(vP.z * 0.5 - uTime * 0.45 + sin(vP.x * 0.3))), 6.0);
        col += caus * 0.22 * smoothstep(2.6, 0.2, d);
        float lip = smoothstep(0.12, 0.0, d) * 0.35 + smoothstep(0.97, 1.02, vD.y) * 0.2;
        col = mix(col, vec3(1.0), lip); float a = mix(0.3, 0.88, smoothstep(0.05, 1.8, d)); a = max(a, lip);
        gl_FragColor = vec4(col, a * (1.0 - smoothstep(0.99, 1.02, vD.y) * 0.5));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` });
  m.uniforms.uTime = uTime; const mesh = new THREE.Mesh(g, m); mesh.name = 'cove_water'; mesh.renderOrder = 3; return mesh;
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
    for (const b of CO.COAST_BERTHS) { rectL(b.lx - b.len / 2, b.lz - 4.5, b.lx + b.len / 2, b.lz + 4.5, 'rgba(103,232,249,0.85)', '#0e7490'); if (zoom) { const [a, c] = L(b.lx, b.lz + 9); T(b.id, a, c, 12, '#67e8f9', 'center'); } }
    { const f = CO.FORT; const [a, b] = L(f.lx, f.lz); g.fillStyle = '#b9b2a6'; g.strokeStyle = '#333'; g.lineWidth = 2; g.fillRect(a - 13 * sc, b - 13 * sc, 26 * sc, 26 * sc); g.strokeRect(a - 13 * sc, b - 13 * sc, 26 * sc, 26 * sc); }
    // main street
    { const [a, b] = L(STREET.x, STREET.z0), [c, d] = L(STREET.x, STREET.z1); g.strokeStyle = '#111'; g.lineWidth = Math.max(5, 15 * sc); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); g.strokeStyle = '#e7d7b8'; g.lineWidth = Math.max(3, 12 * sc); g.stroke(); }
    if (zoom) { for (const q of LOTS_MAP) rectL(q.lx - q.d / 2, q.z - q.w / 2, q.lx + q.d / 2, q.z + q.w / 2, q.col, '#222');
      for (const q of LOTS_MAP.filter(q => q.label)) TL(q.label, q.lx, q.z, q.ldx, q.ldy, 13, q.tc);
      for (const [id, lab] of [['shop', 'SHOP door (Timothy)'], ['stall_red', 'red stall'], ['stall_blue', 'blue stall']]) { const s = SHOP_SPOTS[id]; if (!s) continue; const [lx, lz] = CO.w2t(s.x, s.z), [a, b] = L(lx, lz);
        g.fillStyle = id === 'shop' ? '#ffc93c' : id === 'stall_red' ? '#ff3b3b' : '#3b82f6'; g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.arc(a, b, 6, 0, 7); g.fill(); g.stroke(); }
      for (const q of CO.PLAZA_POIS) { const [a, b] = L(q.lx, q.lz); g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.arc(a, b, 5, 0, 7); g.fill(); g.stroke(); }
      TL('STORM HUNT + ARENA boards', -10, -12, -40, 70, 13); TL('Token exchange', CO.PLAZA_POIS[2].lx, CO.PLAZA_POIS[2].lz, 30, 90, 13); TL('Harbor market', -36, -32, -60, 30, 13);
      TL('Spectate spyglass + lighthouse', CO.MOLE.lx, CO.MOLE.lz1, 40, -10, 13); TL('Stone harbor tower', 86, -44, 50, 40, 13); TL('Step ashore (P1)', -90, 42, -20, -40, 13, '#67e8f9');
      TL('Cliff headland: FORT BATTERY (6 guns)', CO.HEADLAND.lx, CO.HEADLAND.lz, 30, 30, 13); TL('FORT (top of Main Street)', CO.FORT.lx, CO.FORT.lz, -20, 70, 13);
      TL('STONE QUAY + PLAZA', 20, -40, -80, 150, 14, '#fde68a'); TL('Wooden piers on stilts, shacks, rowboats', -180, 0, -10, 110, 13); TL('Sandbar islet', CO.ISLET.lx, CO.ISLET.lz, -10, -40, 13);
      TL('Main Street climbs to the gate (Trails A + B start here)', STREET.x, STREET.z1, -10, -115, 13, '#e7d7b8');
    } else {
      T('HARBOR BATTLE AREA', ...P(hx0 - 230, hz0 - 230), 20, '#fff', 'center'); T('sail + fight here', ...P(hx0 - 230, hz0 - 205), 14, '#fff', 'center');
      T('Battle edge 420 m (ships stopped)', ...P(hx0 - 300, hz0 + 330), 14, '#ff6b6b', 'center'); T('AI turn back 370 m', ...P(hx0 - 230, hz0 + 280), 13, '#ff9a3a', 'center');
      T('PLAYER SPAWN', ...(([a, b]) => [a, b - 18])(P(hx0, hz0)), 14, '#93c5fd', 'center'); T('respawn rings 40 / 85 / 130 m', ...P(hx0 - 60, hz0 + 150), 13, '#4ade80', 'center');
      T('AI / boss spawn rings 176 + 344 m', ...P(hx0 - 160, hz0 - 360), 13, '#fbbf24', 'center'); T('✕ = AI spawn that must move (on land / no-fire)', ...P(hx0 - 250, hz0 + 395), 13, '#ff6b6b', 'center');
      T('NO-FIRE SAFE HARBOR', ...L(-100, 100), 15, '#fff', 'center'); T('7 BERTHS (P1-P4 + quay Q1-Q3)', ...L(-180, 62), 13, '#67e8f9', 'center');
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
  colorAt(i, j, out); const pm = PAINTM.get(q); if (pm) out.lerp(SPLAT_C[pm[0]] || out, Math.min(1, pm[1])); // [minimap-themes] build-mode PAINT shows on the maps
  return slopeAt(i, j) > WALK_RULES.slope ? 1 : 0;
}
export const MAP_PATHS = () => ({ A: TRAILS.A, B: TRAILS.B, street: STREETP, ramps: RAMPS.map(r => [[r.ax, r.az], [r.bx, r.bz]]), lake: LAKE, river: RIVERP,
  areas: AREA_TERRAIN.paths.map(p => ({ id: p.id, pave: !!p.pave, pts: catmull(p.pts, false, 3) })) }); // [minimap-themes] the rework cells' paths (Pirates' Climb, jungle trail, bridge approaches ...)
// ---------- inland POIs ----------
export const FOOT_POIS = [];
export const LIGHTHOUSES = []; // [v108] { id, x, y, z, opts } built with the shared lighthouse kit (createFoot adds them to the root)
function poi(id, label, x, z, extra = {}) { const p = { id, label, x, z, y: H(x, z), action: null, ...extra }; FOOT_POIS.push(p); return p; }
export const BRIDGE = {};
// [path-fix2] HIGH bridges (areas/hillRound.js): walkable only for whoever is up at deck height. The caller says how high the body is
// (setLayer(feet y) around its ground / blocked queries: physics, walker, followers); null = not up there = the ground below (the valley
// trail runs on under it). { ax, az, bx, bz, L, yaw, half, yAt(u) }. D3's BRIDGE (bridgeAt) is unchanged: always the floor.
export const HIGH_BRIDGES = []; let LAYER = null;
export function setLayer(y) { LAYER = y === undefined || y === null || !isFinite(y) ? null : y; }
export function highBridgeAt(x, z, ly = LAYER) { if (ly === null || !HIGH_BRIDGES.length) return null;
  for (const B of HIGH_BRIDGES) { const dx = x - B.ax, dz = z - B.az, sn = Math.sin(B.yaw), cs = Math.cos(B.yaw), along = dx * sn + dz * cs, across = dx * cs - dz * sn;
    if (along < -0.6 || along > B.L + 0.6 || Math.abs(across) > B.half + 0.6) continue; const y = B.yAt(along / B.L); if (ly < y - 2) continue;
    return { y, inside: Math.abs(across) <= B.half }; } return null; }
export const DIGS = [];
const jagCone = (r, h, seg, seed) => { const g = new THREE.ConeGeometry(r, h, seg, 5), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), t = 0.5 - y / h, k = 1 + 0.3 * t * Math.sin(x * 0.9 + seed) * Math.sin(z * 1.1 + seed * 2) + 0.12 * t * Math.sin(y * 0.8 + seed); P.setXYZ(i, x * k, y, z * k); }
  g.computeVertexNormals(); return g; };
function boulder(k, x, z, s, seed, sink = 0.3) { if (NP) return natRock(x, z, s * 1.05, seed, sink * 0.5); W(k, jitter(new THREE.IcosahedronGeometry(1, 1), 0.22, seed), (px, py) => (py > 0.2 ? 0xa8a095 : 0x7f786f), 3, M(x, H(x, z) + s * (0.6 - sink), z, seed, 0.3, 0.2, [s * 1.2, s * 0.8, s])); }
// [ruins t2003u] BANKSY: "make it a golden v7 pirate". The real V7 male body, frozen in his idle pose, cast in polished gold, on the altar
function goldPirateStatue(root, low) {
  if (typeof document === 'undefined') return;
  const S0 = SKULL, R = Math.PI, lx = 0, lz = -11.95, x = S0.x + Math.cos(R) * lx + Math.sin(R) * lz, z = S0.z - Math.sin(R) * lx + Math.cos(R) * lz;
  import('../pirateGLB.js').then(({ loadPirateGLB }) => loadPirateGLB('assets/pirates/pirate_male_v7_lo.glb')).then((gl) => {
    const scn = SkeletonUtils.clone(gl.scene), gold = new THREE.MeshStandardMaterial({ color: 0xffc24a, metalness: 1, roughness: 0.28, emissive: 0x4a2c00, emissiveIntensity: 0.55 });
    const clip = (gl.animations || []).find(a => a.name === 'idle') || gl.animations?.[0];
    if (clip) { const mx = new THREE.AnimationMixer(scn); mx.clipAction(clip).play(); mx.update(0.6); }
    scn.traverse(o => { if (o.isMesh) { o.material = gold; o.castShadow = false; o.frustumCulled = false; } });
    scn.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(scn), hgt = bb.max.y - bb.min.y || 1, s = 1.4 / hgt;
    const g = new THREE.Group(); g.name = 'gold_pirate_statue'; scn.scale.setScalar(s); scn.position.y = -bb.min.y * s; g.add(scn);
    g.position.set(x, S0.y + 1.25, z); g.rotation.y = R; root.add(g);
  }).catch(e => console.warn('[ruins] gold statue', e));
}
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
    const [ax, az] = ROPE_BRIDGE.a || out(-1), [bx, bz] = ROPE_BRIDGE.b || out(1), L = Math.hypot(bx - ax, bz - az)  /* [island-rework] pinned to the live ends (v156: z -103 / -64) so the D3 approach cuts can't move them */, yaw = Math.atan2(bx - ax, bz - az), sag = Math.min(3.5, L * 0.05);
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
      // [ruins] THE IDOL ALTAR (BANKSY t1996u): a carved stone altar against the back wall, an empty idol outline + 21 shard sockets, a gold glow
      k.at(M(0, 0, -11.75), () => { W(k, box(2.6, 0.35, 1.3), 0x7d7264, 3, M(0, 0.18, 0)); W(k, box(2.2, 0.75, 1.0), 0x958a7a, 3, M(0, 0.72, 0)); W(k, box(2.5, 0.16, 1.2), 0xa99e8c, 3, M(0, 1.17, 0));
        for (const sx of [-1, 1]) { W(k, box(0.34, 1.9, 0.34), 0x8a7f70, 3, M(sx * 1.05, 1.2, -0.2)); k.add(new THREE.SphereGeometry(0.16, 8, 6), 0xffb347, { bucket: 'glow', m: M(sx * 1.05, 2.25, -0.2), outline: false }); }
        W(k, box(0.9, 1.5, 0.12), 0x3a2e22, 0, M(0, 2.0, -0.42), false);   // the dark idol-shaped niche
        // [ruins t2003u] the idol is now a golden V7 pirate statue (goldPirateStatue, loaded after the kit)
        for (let i = 0; i < 21; i++) k.add(new THREE.OctahedronGeometry(0.07, 0), i % 3 ? 0xd9a531 : 0xffcf4a, { m: M(-0.95 + (i % 7) * 0.32, 1.27, 0.12 + Math.floor(i / 7) * 0.16), outline: false, mat: 0 }); });
      if (!NP) for (let i = 0; i < 6; i++) W(k, jagCone(6 + hash(i, 7) * 4, 22 + hash(i, 8) * 16, low ? 5 : 7, i), (px, py) => (py > 0 ? 0x9a8f80 : 0x7a6f62), 3, M(-16 + i * 6.4, 10, -18 - hash(i, 9) * 8, i), false);
    });
    for (const [lx, lz, sx] of [[-4, -6, 1], [4, -6, -1], [2.6, -11.8, 1]])   /* [ruins] back torch moved off the idol altar */ { const [x, z] = toW(lx, lz); F.push({ x, y: y + 2.4, z, cave: true }); const [px, pz] = toW(lx + sx * 0.3, lz); W(k, box(0.12, 0.6, 0.12), IRON, 0, M(px, y + 2.0, pz), false); }
    for (const [cx, cz, w, d] of [[-11.5, -2.5, 9, 22], [11.5, -2.5, 9, 22], [0, -19, 32, 12], [-5, 6.2, 4, 2.2], [5, 6.2, 4, 2.2]]) { const [x, z] = toW(cx, cz); addBox(x, z, w, d, R); }
    const [ex, ez] = toW(0, 8); INTERACT.push({ id: 'cave', x: ex, z: ez, r: 4, label: 'TREASURE CAVE · walk in', info: true });
    { const [ax, az] = toW(0, -11.75); addBox(ax, az, 2.6, 1.3, R); const [qx, qz] = toW(0, -10.4); INTERACT.push({ id: 'skull_idol_altar', area: 'jungle_ruins', x: qx, z: qz, r: 2.2, label: 'E · IDOL ALTAR · 21 SHARDS' }); }   // [ruins] 21 Idol Shards -> Golden Idol
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
  for (const [x0, z0, n] of DIG_HINTS) { const [x, z] = beachNear(x0, z0), y = H(x, z); poi('dig' + n, 'Dig site ' + n, x, z);
    DIGS.push({ id: 'dig' + n, x, z, y }); INTERACT.push({ id: 'dig' + n, x, z, r: 3, label: 'E · DIG' });
    // [v145] the painted X sits ON the dig spot (it was drawn 3.5 m / 2.5 m off it, 4.3 m away = outside the 3 m DIG prompt): centred on the mound, arms long enough to show round it
    for (const r of [0.6, -0.6, 0.6 + Math.PI, -0.6 + Math.PI]) { const cx = Math.cos(r), cz = -Math.sin(r); // 4 arms, each laid on the sloping sand in 2 pieces
      for (const [r0, r1] of [[0, 1.7], [1.7, 3.4]]) { const ya = H(x + cx * r0, z + cz * r0), yb = H(x + cx * r1, z + cz * r1), rm = (r0 + r1) / 2, L = r1 - r0;
        W(k, box(L + 0.12, 0.1, 0.62), RED, 0, M(x + cx * rm, (ya + yb) / 2 + 0.1, z + cz * rm, r, 0, Math.atan2(yb - ya, L)), false); } }
    W(k, cyl(0.06, 0.06, 1.8, 5), WOOD_D, 2, M(x - 2.6, y + 0.8, z - 1.6, 0, 0.3, 0.2), false); W(k, box(0.5, 0.6, 0.06), IRON, 0, M(x - 2.9, y + 0.15, z - 1.75, 0, 0.3, 0.2), false);
    W(k, cyl(0.05, 0.05, 2.4, 4), WOOD_D, 2, M(x + 1.5, y + 1.2, z - 2.5), false); W(k, box(0.9, 0.6, 0.04), RED, 12, M(x + 1.95, y + 2.1, z - 2.5), false);
    for (let i = 0; i < 4; i++) boulder(k, x + Math.cos(i * 1.7) * 7, z + Math.sin(i * 1.7) * 7, 0.6 + hash(i, n) * 0.7, i + n * 10); }
  KPG = 'trail';
  // trail torches every ~45 m (flames + lights)
  for (const path of Object.values(TRAILS)) { let acc = 0; for (let i = 1; i < path.length; i++) { acc += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); if (acc > 45) { acc = 0;
    const [x, z] = path[i], dx = path[i][0] - path[i - 1][0], dz = path[i][1] - path[i - 1][1], n = Math.hypot(dx, dz) || 1, tx = x + dz / n * 3.2, tz = z - dx / n * 3.2; if (H(tx, tz) > 1 && !(path === TRAILS.A && A_DEAD([x, z])) && !(Math.abs(tx - ROPE_BRIDGE.c[0]) < 5 && tz > -106 && tz < -61)) torchPost(k, F, tx, H(tx, tz), tz); } } } // (no torch pole down in the gorge under the bridge)
  poi('gate', 'Town gate (trailhead A + B)', GATE[0], GATE[1]);
  registerAreas({ H, poi, addCirc, addBox, addDeck, addHighBridge: (b) => HIGH_BRIDGES.push(b), AREA_DECKS, collidersOff, INTERACT, TRAILS, GATE, STREET, townToWorld }); // [island-rework] eager part of each area (POIs keep the foliage clear)
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
  CHUNKS = chunks; // [terrain-edit] TERRAIN.set rebuilds the touched ones
  // terrain LOD steps by chunk distance (centre - 160 m): High 4 / 8 / 16 / 32 m grid, Low 8 / 16 / 32 m
  const LODS = low ? [[0, 2], [150, 4], [330, 8]] : [[0, 1], [110, 2], [300, 4], [560, 8]], VIEW_R = low ? 560 : 1100;
  // kits: street (world coords) + inland POIs, each a handful of merged meshes
  KP = kit ? {} : null; NK = nat; NP = nat ? {} : null;
  const fm = foliageMat(low, uTime, nat ? nat.cards : null);
  const street = buildStreet(atlas.R, low, F).build(MATS, OUT); street.name = 'foot_street'; root.add(street);
  let streetGravel = null; if (COASTM) { // [v337] BANKSY t1790u: dock-plaza gravel up Hill Street to Fountain (own group, aMat 10)
    const gk = new Kit(); gk.ao = (x, y, z) => 0.7 + 0.3 * sm(0, 2.6, y - H(x, z));
    const gInfo = buildStreetGravel(gk); streetGravel = gk.build(MATS, OUT); streetGravel.name = 'foot_street_gravel'; root.add(streetGravel);
    if (typeof console !== 'undefined') console.info('[v337] street gravel', gInfo); }
  const inland = buildInland(atlas.R, low, F).build(MATS, OUT); inland.name = 'foot_pois'; root.add(inland);
  goldPirateStatue(root, low);   // [ruins t2003u] the Golden Idol on the Skull Cave altar is a gold V7 pirate
  const kerbG = buildKerbs(MATS, OUT, low); for (const g of kerbG) root.add(g); // [bridge-path-fix] the paved trails' kerbs (after the POIs: their colliders + area decks are in)
  // [stairs2] the saved terrain edits (BANKSY's, pvp_terrain) load after this: kerbs laid on the unedited ground floated / sank where he levelled
  // (up to 7.7 m by the bridge head). Every TERRAIN.set now re-lays them on the edited ground (geometry only; the ground itself is untouched)
  { let tm = 0; KERB_HOOK = () => { clearTimeout(tm); tm = setTimeout(() => { for (const g of kerbG.splice(0)) { root.remove(g); g.traverse(o => o.geometry?.dispose?.()); }
    for (const g of buildKerbs(MATS, OUT, low)) { root.add(g); kerbG.push(g); } }, 300); }; }
  const coast = COASTM ? buildCoast(atlas.R, low, F, decorHulls).build(MATS, OUT) : null; if (coast) { coast.name = 'foot_coast'; root.add(coast); }
  const battery = coast ? BT.createGuns(root, MATS, OUT, low) : null; // [Timothy] the headland battery's 6 playable guns (4 draw calls)
  if (coast && PLAZA_V2_SIGNS) { const sg = PV.buildPlazaSigns(PLAZA_V2_SIGNS); if (sg) root.add(sg); const sh = PV.buildBerthPreview(); if (sh) root.add(sh); } // [Timothy] v2 sign labels (1 draw call)
  if (coast && PLAZA_V2_SIGNS) { const ps = PV.buildPlazaShops(); if (ps) root.add(ps); } // [Timothy] Blender storefront models (plazaShops.js; null = blockout shells)
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
    if (!parts.length) continue; const items = new Map(); { let a = 0; parts.forEach((p, i) => { const c = p.attributes.position.count; p.computeBoundingBox(); items.set('n' + i, { key: 'n' + i, name: (list[i]?.[0] || 'plant'), ranges: [[null, a, c]], box: p.boundingBox.clone() }); a += c; }); } // [build-mode] one item per tree / rock
    const g = safeNormals(mergeGeometries(parts, false)); parts.forEach(p => p.dispose()); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, fm); m.name = 'foot_nature_' + gname; for (const it of items.values()) it.ranges[0][0] = m; m.userData.kitItems = items; m.castShadow = m.receiveShadow = !low; m.customDepthMaterial = fm.userData.depth; root.add(m); groups.push(m);
    natN += list.length; natTris += (g.index ? g.index.count : g.attributes.position.count) / 3; }
  const kitM = groups[0] || null; KP = null; NP = null;
  for (const g of [street, inland, coast].filter(Boolean)) g.traverse(o => { if (o.isMesh && !o.userData.outline && o.userData.bucket !== 'glow') { o.castShadow = !low; o.receiveShadow = !low; } });
  // water: shoreline shallows + foam, river + lake flow, waterfall + mist
  // [v348] BANKSY t1829u "there is 2 water types overlapping": foot_shallows (a second, unlit sea sampled in the rotated foot frame on a
  // ~10 m grid) poked flat cyan blotches up through the real ocean's troughs all round the coast. Off by default (&shallows=1 = old look);
  // the game ocean (js/ocean.js) is the ONE sea. River, lagoon lake, waterfall + mist and the swim cove below stay.
  if (SHALLOWS_ON) root.add(shallows(uTime, uWaves, low, heightTexture()));
  const fresh = freshWater(uTime, low); root.add(fresh);
  if (COASTM) root.add(coveWater(uTime, low));                                                     // [Raul] swim cove water
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
  if (PV.PALM_SPOTS && PV.PALM_SPOTS.length) { const pv = nat ? [0, 1, 2].map(v => low ? nat.get('palm1', 1) : nat.get('palm' + v, 0)) : null, fb = pv && pv.every(Boolean) ? null : treeGeos(low).palm;   // [Emerly] the plaza palms: the nature kit palms (rope bridge ones)
    for (const v of [0, 1, 2]) { const list = PV.PALM_SPOTS.filter(t => t[4] === v), geom = fb || pv[v]; if (!list.length || !geom) continue; safeNormals(geom);
      const m = new THREE.InstancedMesh(geom, fm, list.length); m.name = 'foot_plaza_palm' + v; m.castShadow = !low; m.receiveShadow = !low; if (fm.userData.depth) m.customDepthMaterial = fm.userData.depth;
      list.forEach((t, i) => { const s = 1.05; _q.setFromAxisAngle(_up, t[3]); _s.set(s, s * 1.1, s); _p.set(t[0], t[1] - 0.3, t[2]); _m.compose(_p, _q, _s); m.setMatrixAt(i, _m); });
      m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); root.add(m); } }
  const SC = nat ? { trees: [0.75, 0.55], palms: [0.85, 0.4], ferns: [0.8, 0.9], rocks: [0.7, 2.4], cliffs: [3.2, 4.2] } : { trees: [0.8, 1.6], palms: [0.85, 0.5], ferns: [0.8, 0.9], rocks: [0.8, 2.8], cliffs: [2.0, 3.0] };
  const KINDS = ['trees', 'palms', 'ferns', 'rocks', 'cliffs'], RMAX = Object.fromEntries(KINDS.map(k => [k, Math.max(0, ...BUCKETS.filter(b => b.kinds.includes(k)).map(b => b.r1))]));
  const FARTREE = !(typeof location !== 'undefined' && /[?&]fartree=0(&|$)/.test(location.search));
  function fill(cx, cz, all = false) {
    for (const b of BUCKETS) b.n = 0;
    for (const k of KINDS) { const R = all ? 5000 : RMAX[k], near = [];
      for (const t of spots[k]) { const d = (t[0] - cx) ** 2 + (t[2] - cz) ** 2; if (d < R * R && (all || k !== 'trees' || d > 330)) near.push([Math.sqrt(d), t]); }
      near.sort((a, b) => a[0] - b[0]);
      const bl = BUCKETS.filter(b => b.kinds.includes(k));
      for (const [d, t] of near) { const v = Math.floor(t[3] * 37) % 3, b = all ? bl[bl.length - 1] : bl.find(b => d >= b.r0 && d < b.r1 && (b.v < 0 || b.v === v) && b.n < b.cap); if (!b || b.n >= b.cap) continue;
        const thin = FARTREE && !all && k === 'trees' && d > 165; if (thin && Math.floor(t[3] * 9973) % 2) continue;   // [perf6] &fartree=0: past 165 m every other tree (the kept ones 20% bigger), the far tree mesh was 115k tris
        const s = (SC[k][0] + t[3] * SC[k][1]) * (thin ? 1.2 : 1), tall = k === 'cliffs' ? 1.0 + t[3] * 0.6 : k === 'trees' ? 0.9 + t[3] * 0.3 : 0.9 + t[3] * 0.4;
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
  const realLights = !low && new URLSearchParams(location.search).get('islandlights') === '1';
  const lhs = LIGHTHOUSES.map((L, i) => { const g = buildLighthouse({ ...L.opts, low, light: L.opts.light && realLights }); g.position.set(L.x, L.y, L.z); g.userData.phase = i * 2.1; g.name = 'lighthouse_' + L.id; root.add(g); return g; });
  const lights = []; if (realLights) for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffa64a, 0, 16, 1.6); root.add(l); lights.push(l); }
  // small life: gulls (town + falls), crabs on beaches (High)
  const birds = buildBirds(low, uTime); { const g = new THREE.Group(); g.position.set(TOWN.x + 40, 4, TOWN.z - 30); g.add(birds); root.add(g); }
  if (!low) { const b2 = buildBirds(true, uTime); const g = new THREE.Group(); g.position.set(SKULL.x, 50, SKULL.z); g.add(b2); root.add(g); }
  if (!low) { const cs = []; for (let j = 2; j < NZ; j += 3) for (let i = 2; i < NX; i += 3) { const q = IDX(i, j), h = Hg[q]; if (h > 0.6 && h < 1.6 && hash(i, j) < 0.05 && cs.length < 120) cs.push({ x: X0 + i * G, y: h, z: Z0 + j * G, a: hash(j, i) * 6.28 }); }
    root.add(buildCrabs(cs, uTime)); }
  // dig sites: mound -> dig -> chest rises + lid opens (local only, no rewards backend)
  const digs = DIGS.map(d => { const c = digChest(MATS, OUT, low); c.grp.position.set(d.x, d.y, d.z); c.cg.position.y = -1.6; root.add(c.grp); return { ...d, ...c, t: -1 }; });
  const areas = createAreas({ root, MATS, OUT, low, uTime, H }); // [island-rework] lazy area meshes
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
    areas.update(cam, t, all);
    for (const d of digs) if (d.t >= 0) { const k = Math.min(1, (t - d.t) / 2.2); d.mound.scale.setScalar(Math.max(0.01, 1 - k)); d.cg.position.y = -1.6 + 1.7 * sm(0, 0.7, k); d.lid.rotation.x = -1.6 * sm(0.6, 1, k); d.mound.visible = k < 1; }
  }
  // gameplay hooks (world coords): solid props, water / slope / bridge rules, interact points
  function bridgeAt(x, z) { const B = BRIDGE; if (!B.L) return null; const dx = x - B.ax, dz = z - B.az, along = dx * Math.sin(B.yaw) + dz * Math.cos(B.yaw), across = dx * Math.cos(B.yaw) - dz * Math.sin(B.yaw);
    if (along < -1 || along > B.L + 1 || Math.abs(across) > B.half + 0.6) return null; const y = B.deckY - Math.sin(Math.min(1, Math.max(0, along / B.L)) * Math.PI) * B.sag;
    if (LAYER !== null && LAYER < y - 2) return null; // [v342] BANKSY t1815u: swimming the river UNDER D3's rope bridge (deck ~20 m up) - the deck + its rails are only the floor for whoever is up on it (like highBridgeAt)
    return { y, inside: Math.abs(across) <= B.half }; }
  // [Raul] dig mounds are walked ON (the beach one outside the plaza sank your feet 0.7 m into it): the mound's dome (r 1.9, 0.855 tall at d.y - 0.1, shrinks as it's dug)
  function moundAt(x, z, h) { for (const d of digs) { if (!d.mound.visible) continue; const s = d.mound.scale.x, r = Math.hypot(x - d.x, z - d.z) / (1.9 * s); if (r < 1) h = Math.max(h, d.y - 0.1 + 0.855 * s * Math.sqrt(1 - r * r)); } return h; }
  function groundAt(x, z) { const hb = highBridgeAt(x, z); if (hb) return hb.y + 0.12; const b = bridgeAt(x, z); if (b) return b.y + 0.12; const ad = AREA_DECKS.length ? areaDeckAt(x, z) : null; if (ad !== null) return ad; // [island-rework] area decks (docks, stairs, ramps, ramparts) ARE the floor
    const h0 = H(x, z), w = COASTM ? BA.onPath(...CO.w2t(x, z)) : 0; // [Emerly] battle-area paths: walk on the drawn triangles
    const h = moundAt(x, z, w > 0 ? h0 + (Htri(x, z) - h0) * w : h0), c = coveDeckAt(x, z); return c !== null && c > h ? c : h; }
  const DECK_STEP = 0.6; // [island-rework] the biggest step up onto / along an area deck (stair treads are <= 0.25)
  // [Raul] foot physics (BANKSY "fall off cliffs" + "float / swim"): you may now walk OFF any ledge (js/onfoot/physics.js drops you
  // with gravity) and into water (deeper than chest height = swim at the surface). Uphill keeps the v105 grade limit; out of the
  // water you can pull yourself up onto anything up to FOOT_SWIM.climb above the surface (shore rocks, the lake rim, low jetties).
  function blocked(x, z, fx, fz) { if (ADMIN_COL.nocs.length && nocAt(x, z)) return false; /* [v346] owner PASS ZONE carves every check (props, rails, slopes, sea limit) */ const hb = highBridgeAt(x, z); if (hb) return !hb.inside; const b = bridgeAt(x, z); if (b) return !b.inside;          // on the deck: rails bound you
    if (hitCollider(x, z)) return true; const h = H(x, z);
    const i = Math.round((x - X0) / G), j = Math.round((z - Z0) / G); if (i < 1 || j < 1 || i >= NX || j >= NZ) return true;
    const surf = waterAt(x, z); if (surf !== null && seaLimit(x, z, h, surf)) return true;       // open sea / the berths stay off limits
    if (fx === undefined) return false;
    const d = Math.hypot(x - fx, z - fz); if (d < 1e-4) return false;
    if (coveTower(fx, fz) && coveDeckAt(x, z) === null) return true;                               // the diving tower's rails (dive off the board)
    const to = groundAt(x, z), fromG = groundAt(fx, fz), fs = waterAt(fx, fz), fromS = fs !== null && fs - fromG > FOOT_SWIM.depth ? fs - FOOT_SWIM.float : fromG;
    const toS = surf !== null && surf - to > FOOT_SWIM.depth ? surf - FOOT_SWIM.float : to, rise = toS - fromS;
    if (rise <= 0.02) return false;                                                                  // level / down: walk on, or drop off the edge (gravity)
    if (fs !== null && fs - fromG > 0.5 && toS <= fs + FOOT_SWIM.climb) return false;              // climbing out of the water
    const cd = coveDeckAt(x, z); if (cd !== null && cd >= h) return rise > FOOT_SWIM.step;          // onto the cove jetty: steps only
    if (AREA_DECKS.length) { if (areaDeckAt(x, z) !== null) return rise > DECK_STEP;                  // [island-rework] onto / along an area deck: steps only
      if (areaDeckAt(fx, fz) !== null && rise <= DECK_STEP) return false; }                         // deck -> ground
    if (coveDeckAt(fx, fz) !== null && rise <= FOOT_SWIM.step) return false;                       // jetty -> sand
    const ux = (x - fx) / d, uz = (z - fz) / d, e = Math.max(d, 0.1), g = (h - H(x - ux * e, z - uz * e)) / e;   // [v105] uphill grade of the step you just took
    return g > WALK_RULES.slope; }
  function whyBlocked(x, z, fx, fz) { if (ADMIN_COL.nocs.length && nocAt(x, z)) return ''; const hb = highBridgeAt(x, z); if (hb) return hb.inside ? '' : 'rail'; const b = bridgeAt(x, z); if (b) return b.inside ? '' : 'rail';  // [v105] dev: reachability report
    if (hitCollider(x, z)) return 'prop'; const h = H(x, z);
    if (AREA_DECKS.length && areaDeckAt(x, z) !== null) return blocked(x, z, fx, fz) ? 'deck step' : '';
    const i = Math.round((x - X0) / G), j = Math.round((z - Z0) / G); if (i < 1 || j < 1 || i >= NX || j >= NZ) return 'edge';
    const surf = waterAt(x, z); if (surf !== null && seaLimit(x, z, h, surf)) return 'sea'; return blocked(x, z, fx, fz) ? 'slope' : ''; }
  function nearInteract(x, z) { let best = null, bd = 1e9; for (const q of INTERACT) { const d = Math.hypot(q.x - x, q.z - z); if (d < q.r && d < bd && !(q.used) && !q.hidden?.()) { bd = d; best = q; } } return best; }
  function rearm(id) { const d = digs.find(d => d.id === id); if (d) { d.t = -1; d.mound.scale.setScalar(1); d.mound.visible = true; d.cg.position.y = -1.6; d.lid.rotation.x = 0; }
    const q = INTERACT.find(q => q.id === id); if (q) q.used = false; } // [v122] a dug site fills back in: another map can point here
  function activate(q, t) { if (q.id.startsWith('dig')) { const d = digs.find(d => d.id === q.id); if (d && d.t < 0) { d.t = t; q.used = true; } return 'dig'; } return q.id; }
  const stats = { buildMs: BUILD_MS, chunks: chunks.length, trees: spots.trees.length, palms: spots.palms.length, ferns: spots.ferns.length, rocks: spots.rocks.length, torches: F.length, kitPieces: kitN, kitTris, kitTexBytes: kit ? kit.texBytes : 0, kitKtx2: kit ? kit.ktx2 : false, natPieces: natN, natTris, natTexBytes: nat ? nat.texBytes : 0, natKtx2: nat ? nat.ktx2 : false, cliffs: spots.cliffs.length, groups: groups.map(g => g.name), trailA: Math.round(pathLen(TRAILS.A)), trailB: Math.round(pathLen(TRAILS.B)), street: Math.round(Math.abs(STREET.z1 - STREET.z0)), texBytes: 0 }; // [v348] no foot_shallows height texture by default
  return { areas, root, update, battery, lighthouses: lhs, H, groundAt, waterAt, blocked, whyBlocked, setLayer, spots, nearInteract, activate, rearm, stats, pois: FOOT_POIS, digs, street, inland, IM, flames, lights, groups, areaDeckAt, AREA_DECKS, townToWorld, worldToTown, streetGravel };
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
// [build-place] owner BUILD (BANKSY: place houses, walls, fences, crates, lamps, trees, docks, bridges): the catalog reuses the island's own
// kit builders as plain geometry (KP off: no GLB lists), terrainEdit.js merges each into ONE template and draws every copy of it INSTANCED
// (one draw call per bucket per type, phones included). col: 'b' box [w, d] | 'c' circle r | 'k' walk deck { hw, hl, y, pad } (+ side rails)
export const PROP_CAT = [
  { id: 'house', label: 'HOUSE', ico: '🏠', col: ['b', 10.4, 9.4] }, { id: 'hut', label: 'HUT', ico: '🛖', col: ['b', 7.4, 6.4] },
  { id: 'wall', label: 'WALL', ico: '🧱', col: ['b', 6, 0.9] }, { id: 'fence', label: 'FENCE', ico: '🚧', col: ['b', 4, 0.3] },
  { id: 'crate', label: 'CRATE', ico: '📦', col: ['c', 0.9] }, { id: 'barrel', label: 'BARREL', ico: '🛢️', col: ['c', 0.7] },
  { id: 'lamp', label: 'LAMP', ico: '🏮', col: ['c', 0.25] }, { id: 'tree', label: 'TREE', ico: '🌳', col: ['c', 0.7] },
  { id: 'palm', label: 'PALM', ico: '🌴', col: ['c', 0.45] }, { id: 'rock', label: 'ROCK', ico: '🪨', col: ['c', 1.3] },
  { id: 'stall', label: 'STALL', ico: '⛺', col: ['b', 3.3, 1.5] },
  { id: 'dock', label: 'DOCK', ico: '⚓', water: true, col: ['k', 3, 4, 0.7, 0] }, { id: 'bridge', label: 'BRIDGE', ico: '🌉', water: true, col: ['k', 1.4, 7, 0.9, 2] },
  // [sims-build t2071u] 2 m pirate building kit (snap grid 2 m): drag a line of walls / a path, drag a rectangle of floor / roof, room presets.
  // drag: 'line' = segments along the drag, 'area' = tiles over the dragged rectangle. Indices are stored in PIECES '+id'.t: append only.
  { id: 'twall', label: 'TIMBER WALL', ico: '🪵', col: ['b', 2, 0.3], drag: 'line', len: 2, shell: 'wall' },
  { id: 'twin', label: 'WINDOW WALL', ico: '🪟', col: ['b', 2, 0.3], drag: 'line', len: 2, shell: 'wall' },
  { id: 'tdoor', label: 'DOORWAY', ico: '🚪', col: null, drag: 'line', len: 2, shell: 'wall' },
  { id: 'swall', label: 'STONE WALL', ico: '🧱', col: ['b', 2, 0.5], drag: 'line', len: 2, shell: 'wall' },
  { id: 'tfloor', label: 'PLANK FLOOR', ico: '🟫', col: null, drag: 'area', len: 2, shell: 'floor' },
  { id: 'troof', label: 'ROOF', ico: '🛖', col: null, drag: 'area', len: 2, shell: 'roof' },
  { id: 'tpath', label: 'COBBLE PATH', ico: '🛤️', col: null, drag: 'line', len: 2 },
  { id: 'table', label: 'TABLE', ico: '🍽️', col: ['c', 0.75] }, { id: 'bench', label: 'BENCH', ico: '🪑', col: ['b', 1.6, 0.45] },
  { id: 'bed', label: 'BUNK', ico: '🛏️', col: ['b', 1.1, 2.1] }, { id: 'chest', label: 'TREASURE CHEST', ico: '🧰', col: ['c', 0.55] },
  { id: 'counter', label: 'COUNTER', ico: '🧾', col: ['b', 2, 0.7] }, { id: 'shelf', label: 'SHELF', ico: '📚', col: ['b', 1.8, 0.45] },
  { id: 'rack', label: 'RUM RACK', ico: '🍾', col: ['b', 2, 0.8] }, { id: 'lantern', label: 'LANTERN', ico: '🕯️', col: ['c', 0.15] },
  { id: 'rug', label: 'RUG', ico: '🟥', col: null }, { id: 'cannon', label: 'CANNON', ico: '💣', col: ['c', 0.8] },
  { id: 'gold', label: 'GOLD PILE', ico: '💰', col: ['c', 0.6] }];
export function propKit(id, low = false) { const k = new Kit(), kp0 = KP, F = []; KP = null;
  try { switch (id) {
    case 'house': colonial(k, F, 0, 0, 0, 0, 10, 9, 2, 3, low); break;
    case 'hut': colonial(k, F, 0, 0, 0, 0, 7, 6, 1, 5, low); break;
    case 'wall': W(k, box(6, 2.4, 0.8), STONE, 11, M(0, 1.2, 0)); W(k, box(6.3, 0.3, 1.0), STONE_D, 11, M(0, 2.5, 0)); for (const x of [-2, 0, 2]) W(k, box(0.9, 0.5, 1.0), STONE_D, 11, M(x, 2.9, 0)); break;
    case 'fence': for (const x of [-2, 0, 2]) W(k, cyl(0.1, 0.12, 1.4, 6), WOOD_D, 2, M(x, 0.7, 0)); for (const y of [0.5, 1.1]) W(k, box(4.1, 0.14, 0.08), WOOD, 2, M(0, y, 0)); break;
    case 'crate': crate(k, M()); break; case 'barrel': barrel(k, M()); break; case 'lamp': torchPost(k, F, 0, 0, 0); break;
    case 'tree': W(k, cyl(0.35, 0.55, 5, low ? 5 : 7), 0x6b4a30, 5, M(0, 2.5, 0)); for (const [x, y, z, r] of [[0, 6.2, 0, 2.6], [1.5, 5.4, 0.6, 1.9], [-1.3, 5.6, -0.6, 2]]) W(k, jitter(new THREE.IcosahedronGeometry(r, 1), 0.16, x + 3), 0x3c9a3e, 6, M(x, y, z)); break;
    case 'palm': for (let i = 0; i < 5; i++) W(k, cyl(0.24, 0.32, 1.9, 6), i % 2 ? 0x9a6b3e : 0x84592f, 5, M(i * i * 0.07, 0.95 + i * 1.8, 0, 0, 0, -i * 0.05), false); for (let f = 0; f < 7; f++) W(k, box(4.2, 0.08, 1.0), f % 2 ? 0x3fae44 : 0x63c64e, 6, M(1.6 + Math.cos(f / 7 * 6.28) * 2, 9, Math.sin(f / 7 * 6.28) * 2, -f / 7 * 6.28, 0, -0.35), false); break;
    case 'rock': W(k, jitter(new THREE.IcosahedronGeometry(1.4, 1), 0.22, 4), 0xa59d92, 3, M(0, 0.5, 0, 0, 0, 0, [1, 0.75, 1])); break;
    case 'stall': stall(k, 0, 0, 0, 0, 0xd8322f); break;
    case 'dock': W(k, box(6, 0.25, 8), WOOD_L, 2, M(0, 0.58, 0)); for (const x of [-2.7, 2.7]) for (const z of [-3.6, 0, 3.6]) W(k, cyl(0.18, 0.18, 3.4, 6), WOOD_D, 2, M(x, -1.1, z)); for (let z = -3.5; z <= 3.5; z += 1) W(k, box(6.05, 0.05, 0.08), WOOD_D, 2, M(0, 0.71, z), false); break;
    // [sims-build] 2 m kit: walls run along local X (x -1..1), 3 m tall; floor / roof tiles 2 x 2 m; furniture faces +Z
    case 'twall': W(k, box(2, 3, 0.22), WOOD, 2, M(0, 1.5, 0)); for (const x of [-0.95, 0.95]) W(k, box(0.2, 3.1, 0.3), WOOD_D, 2, M(x, 1.55, 0)); for (const y of [0.15, 2.95]) W(k, box(2.02, 0.14, 0.28), WOOD_D, 2, M(0, y, 0), false); break;
    case 'twin': for (const [y, h] of [[0.5, 1], [2.6, 0.8]]) W(k, box(2, h, 0.22), WOOD, 2, M(0, y, 0)); for (const x of [-0.75, 0.75]) W(k, box(0.5, 1.2, 0.22), WOOD, 2, M(x, 1.6, 0)); for (const x of [-0.95, 0.95]) W(k, box(0.2, 3.1, 0.3), WOOD_D, 2, M(x, 1.55, 0)); W(k, box(1.0, 0.08, 0.36), WOOD_D, 2, M(0, 1.02, 0.02), false); W(k, box(0.06, 1.2, 0.06), IRON, 0, M(0, 1.6, 0), false); W(k, box(1.0, 0.06, 0.06), IRON, 0, M(0, 1.6, 0), false); break;
    case 'tdoor': for (const x of [-0.85, 0.85]) W(k, box(0.3, 3.1, 0.3), WOOD_D, 2, M(x, 1.55, 0)); W(k, box(2, 0.6, 0.22), WOOD, 2, M(0, 2.7, 0)); W(k, box(1.5, 0.12, 0.34), WOOD_D, 2, M(0, 2.42, 0), false); break;
    case 'swall': W(k, box(2, 3, 0.45), STONE, 11, M(0, 1.5, 0)); W(k, box(2.05, 0.25, 0.55), STONE_D, 11, M(0, 3.05, 0)); W(k, box(2.05, 0.3, 0.55), STONE_D, 11, M(0, 0.15, 0), false); break;
    case 'tfloor': W(k, box(2, 0.12, 2), WOOD_L, 2, M(0, 0.06, 0), false); for (const z of [-0.5, 0, 0.5]) W(k, box(2.0, 0.01, 0.03), WOOD_D, 2, M(0, 0.125, z), false); break;
    case 'troof': W(k, box(2.3, 0.16, 2.3), 0x8a4a2a, 2, M(0, 3.15, 0)); W(k, box(2.32, 0.06, 0.12), WOOD_D, 2, M(0, 3.25, 0), false); break;
    case 'tpath': W(k, box(2, 0.08, 2), STONE_D, 11, M(0, 0.04, 0), false); for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) W(k, box(0.9, 0.06, 0.9), STONE, 11, M(x, 0.09, z, (x * z) * 0.3), false); break;
    case 'table': W(k, cyl(0.75, 0.75, 0.1, low ? 8 : 14), WOOD_L, 2, M(0, 0.85, 0)); W(k, cyl(0.12, 0.18, 0.8, 6), WOOD_D, 2, M(0, 0.4, 0)); W(k, cyl(0.45, 0.5, 0.06, 8), WOOD_D, 2, M(0, 0.03, 0), false); break;
    case 'bench': W(k, box(1.6, 0.1, 0.45), WOOD_L, 2, M(0, 0.5, 0)); for (const x of [-0.65, 0.65]) W(k, box(0.1, 0.45, 0.4), WOOD_D, 2, M(x, 0.23, 0)); break;
    case 'bed': W(k, box(1.1, 0.4, 2.1), WOOD_D, 2, M(0, 0.25, 0)); W(k, box(1.0, 0.18, 1.95), CREAM, 2, M(0, 0.52, 0)); W(k, box(0.8, 0.14, 0.4), 0xffffff, 2, M(0, 0.66, -0.75), false); W(k, box(1.02, 0.06, 1.2), RED, 2, M(0, 0.63, 0.35), false); W(k, box(1.1, 0.8, 0.1), WOOD_D, 2, M(0, 0.6, -1.05)); break;
    case 'chest': W(k, box(1.0, 0.55, 0.65), WOOD, 2, M(0, 0.28, 0)); W(k, cyl(0.33, 0.33, 1.0, 10), WOOD, 2, M(0, 0.55, 0, 0, 0, Math.PI / 2, [1, 1, 1])); for (const x of [-0.38, 0.38]) W(k, box(0.08, 0.9, 0.7), GOLD, 0, M(x, 0.45, 0), false); W(k, box(0.16, 0.16, 0.05), GOLD, 0, M(0, 0.5, 0.34), false); break;
    case 'counter': W(k, box(2, 1.05, 0.7), WOOD_D, 2, M(0, 0.53, 0)); W(k, box(2.1, 0.08, 0.8), WOOD_L, 2, M(0, 1.09, 0)); for (const x of [-0.6, 0.6]) W(k, box(0.5, 0.6, 0.02), WOOD, 2, M(x, 0.55, 0.36), false); break;
    case 'shelf': W(k, box(1.8, 2.2, 0.45), WOOD_D, 2, M(0, 1.1, 0)); for (const y of [0.55, 1.15, 1.75]) { W(k, box(1.7, 0.05, 0.42), WOOD_L, 2, M(0, y, 0.02), false); for (const x of [-0.6, -0.2, 0.25, 0.6]) W(k, cyl(0.07, 0.08, 0.3, 6), [0x2f7a3a, 0x7a2f2f, 0x2f4a7a, 0xa87a2f][(x * 10 + y * 3 | 0) & 3], 2, M(x, y + 0.18, 0.05), false); } break;
    case 'rack': for (const x of [-0.95, 0.95]) W(k, box(0.12, 1.6, 0.8), WOOD_D, 2, M(x, 0.8, 0)); for (const y of [0.45, 1.25]) for (const x of [-0.5, 0.5]) W(k, cyl(0.36, 0.36, 0.75, 10), WOOD_L, 2, M(x, y, 0, 0, Math.PI / 2, 0, [1, 1, 1])); break;
    case 'lantern': W(k, cyl(0.06, 0.08, 2.2, 6), WOOD_D, 2, M(0, 1.1, 0)); W(k, box(0.4, 0.06, 0.06), WOOD_D, 2, M(0.18, 2.15, 0), false); W(k, box(0.22, 0.32, 0.22), GOLD, 0, M(0.34, 1.9, 0), false); break;
    case 'rug': W(k, box(2.4, 0.03, 1.6), RED, 2, M(0, 0.14, 0), false); W(k, box(2.0, 0.035, 1.2), GOLD, 2, M(0, 0.145, 0), false); W(k, box(1.8, 0.04, 1.0), RED, 2, M(0, 0.15, 0), false); break;
    case 'cannon': W(k, cyl(0.2, 0.28, 2.0, 10), IRON, 0, M(0, 0.75, 0.2, 0, Math.PI / 2 - 0.12, 0)); for (const x of [-0.38, 0.38]) W(k, cyl(0.42, 0.42, 0.12, 10), WOOD_D, 2, M(x, 0.42, -0.1, 0, 0, Math.PI / 2)); W(k, box(0.6, 0.35, 1.3), WOOD, 2, M(0, 0.4, -0.1)); break;
    case 'gold': for (const [x, z, r] of [[0, 0, 0.55], [0.4, 0.2, 0.32], [-0.35, 0.25, 0.3]]) W(k, cyl(r * 0.4, r, r * 0.8, 10), GOLD, 0, M(x, r * 0.4, z), false); W(k, box(0.5, 0.35, 0.35), WOOD, 2, M(0.2, 0.18, -0.4)); break;
    case 'bridge': W(k, box(2.8, 0.22, 10), WOOD_L, 2, M(0, 0.8, 0)); for (const x of [-1.35, 1.35]) { W(k, box(0.12, 0.12, 10), WOOD_D, 2, M(x, 1.75, 0)); for (const z of [-4.9, -2.45, 0, 2.45, 4.9]) W(k, cyl(0.09, 0.11, 1.9, 6), WOOD_D, 2, M(x, 0.85, z)); } for (const s of [-1, 1]) W(k, box(2.8, 0.2, 2.2), WOOD, 2, M(0, 0.4, s * 5.9, 0, s * 0.35)); break;
  } } finally { KP = kp0; } return k; }
// placed-prop colliders / decks (foot frame); returns a handle for propUnblock
export function propBlock(id, x, y, z, ry) { const c = PROP_CAT.find(p => p.id === id)?.col, out = []; if (!c) return out; const n0 = CIRC.length, b0 = BOXES.length;
  if (c[0] === 'c') addCirc(x, z, c[1]); else if (c[0] === 'b') addBox(x, z, c[1], c[2], ry);
  else { const d = { x, z, hw: c[1], hl: c[2] + c[4], yaw: ry, y: y + c[3], pad: c[4] || 0, skirt: c[4] ? ['ground', 'ground'] : null }; addDeck(d); out.push(AREA_DECKS[AREA_DECKS.length - 1]);
    if (id === 'bridge') for (const s of [-1, 1]) addBox(x + Math.cos(ry) * s * 1.5, z - Math.sin(ry) * s * 1.5, 0.2, 10, ry); }
  out.push(...CIRC.slice(n0), ...BOXES.slice(b0)); return out; }
export function propUnblock(h) { for (const o of h || []) o.off = true; }
