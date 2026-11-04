// [island-rework] THE PIRATES' CLIMB (BANKSY 2:46 PM "the path on, redesign it all make it better"). Plan: docs/island_rework/PLAN.md §1b
// One designed route: plaza gap -> Main Street (R1) -> the town gate -> trail A -> the locked jungle trailhead (566 m along trail A).
//   R0 join (v150 Blender plaza is live; Timothy's connector main_street lx 6, lz -56, y 2.6, 14 m wide lx -1..13): a 14 m threshold band +
//      kerb starts at lz -58, 2 m inland of the plaza edge. Only the walkway, kerbs + lamps are touched: the Main Street buildings / lots
//      (Timothy's weapon-shop GLBs go in them) are never restyled.
//   R1 Main Street: kerbs, landing bands every 12 m, benches, a notice board, planters at the gate (walk = the terrain, unchanged)
//   trail A: every pitch steeper than 12 % becomes STONE STEPS (walkable stair decks: the tread you see is the height you stand on),
//            retaining walls where the trail cuts the slope, edging stones, 19 lamps (Lamplighter: light them all, cosmetic),
//            landmarks: gate signpost, L1 log footbridge at the stream ford, L3 Lagoon Overlook deck, L4 Ridge View bench + cairn,
//            L5 Ruin Steps (pillars + fallen arch) before the trailhead
// Three modules (street / low / high) so each part is built + culled on its own. Nothing pays gold (flags.js).
import * as THREE from 'three';
import { Kit, M, box, cyl, hash, jitter, W, C, store } from './common.js';
import { AREA_GOLD_ON, PENDING } from './flags.js';
import { JUNGLE_TRAILHEAD as TH } from '../digSpots.js';

export const ROUTE = { along: 566, hw: 2.3, stairG: 0.12, rise: 0.22, lampEvery: 30, lampOff: 3.4, split: 290, streetLz0: -58 }; // R0 joins 2 m inside Main Street from Timothy's plaza edge (lz -56, quay y 2.6)
const RT = { ready: false, pts: [], acc: [], stairs: [], walls: [], lamps: [], lm: {}, bridge: null, street: null };
const lerp = (a, b, t) => a + (b - a) * t;
function at(along) { const { pts, acc } = RT; for (let i = 1; i < pts.length; i++) if (acc[i] >= along) { const t = (along - acc[i - 1]) / (acc[i] - acc[i - 1] || 1), a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { x: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), ux: (b[0] - a[0]) / L, uz: (b[1] - a[1]) / L }; } const p = pts[pts.length - 1]; return { x: p[0], z: p[1], ux: 1, uz: 0 }; }
// left of the walking direction (looking down the trail from the gate) = (uz, -ux)
const side = (p, d) => [p.x + p.uz * d, p.z - p.ux * d];

function prep(h) {
  if (RT.ready) return; RT.ready = true; const { H } = h, A = h.TRAILS.A;
  // lead-in: trail A's loop spline bows ~2.5 m west out of the gate into the gate tower + the first west lot (the walker slid along
  // them for 8 m); the designed route leaves the gate straight and rejoins trail A 20.7 m on (A[10], the top of the gate-drop steps), flat ground (y 19.8-19.95)
  let acc = 0; RT.pts.push(A[0]); RT.acc.push(0); const J0 = 10;
  for (const t of [0.25, 0.5, 0.75]) { const p = [lerp(A[0][0], A[J0][0], t) + Math.sin(t * Math.PI) * 1.2, lerp(A[0][1], A[J0][1], t)]; /* bowed 1.2 m east: both tread edges clear the lot */ acc += Math.hypot(p[0] - RT.pts[RT.pts.length - 1][0], p[1] - RT.pts[RT.pts.length - 1][1]); RT.pts.push(p); RT.acc.push(acc); }
  acc += Math.hypot(A[J0][0] - RT.pts[RT.pts.length - 1][0], A[J0][1] - RT.pts[RT.pts.length - 1][1]); RT.pts.push(A[J0]); RT.acc.push(acc); RT.lead = { from: A[0], to: A[J0] };
  for (let i = J0 + 1; i < A.length; i++) { const d = Math.hypot(A[i][0] - A[i - 1][0], A[i][1] - A[i - 1][1]); if (acc + d > ROUTE.along) break; acc += d; RT.pts.push(A[i]); RT.acc.push(acc); }
  RT.pts.push([TH.x, TH.z]); RT.acc.push(acc + Math.hypot(TH.x - RT.pts[RT.pts.length - 2][0], TH.z - RT.pts[RT.pts.length - 2][1]));
  // L1: the stream ford = the lowest point between 50 and 130 m; L4: the ridge = the highest between 380 and 500 m
  let lo = 1e9, hi = -1e9; for (let a = 50; a <= 130; a += 2) { const p = at(a), y = H(p.x, p.z); if (y < lo) { lo = y; RT.lm.ford = a; } }
  for (let a = 380; a <= 500; a += 2) { const p = at(a), y = H(p.x, p.z); if (y > hi) { hi = y; RT.lm.ridge = a; } }
  // L3: the overlook stands on the DOWNHILL edge (the view opens out): prefer the lagoon side, else whichever side drops most, 220..320 m
  { let best = null; for (let a = 220; a <= 320; a += 4) { const p = at(a), y = H(p.x, p.z), dx = -205 - p.x, dz = -130 - p.z, n = Math.hypot(dx, dz);
      for (const [ox, oz, pref] of [[dx / n, dz / n, 1.5], [p.uz, -p.ux, 0], [-p.uz, p.ux, 0]]) { const drop = y - H(p.x + ox * 7, p.z + oz * 7), sc = drop + (drop > 1 ? pref : 0);
        if (!best || sc > best.sc) best = { a, ox, oz, sc, drop }; } }
    RT.lm.overlook = best.a; RT.lm.ovDir = [best.ox, best.oz]; RT.lm.ovDrop = best.drop; } RT.lm.ruin = 538;
  // L1 footbridge: 12 m, a smooth deck over the ford that never dips under the ground (prof = max(line, ground + 0.3))
  { const a0 = RT.lm.ford - 6, a1 = RT.lm.ford + 6, p0 = at(a0), p1 = at(a1), y0 = H(p0.x, p0.z) + 0.25, y1 = H(p1.x, p1.z) + 0.25, n = 24, prof = [];
    for (let k = 0; k < n; k++) { const u = (k + 0.5) / n, x = lerp(p0.x, p1.x, u), z = lerp(p0.z, p1.z, u); prof.push(Math.max(lerp(y0, y1, u), H(x, z) + 0.3)); }
    const L = Math.hypot(p1.x - p0.x, p1.z - p0.z), ux = (p1.x - p0.x) / L, uz = (p1.z - p0.z) / L;
    RT.bridge = { a0, a1, x: (p0.x + p1.x) / 2, z: (p0.z + p1.z) / 2, L, ux, uz, yaw: Math.atan2(ux, uz), prof };
    h.addDeck({ id: 'route_ford_bridge', x: RT.bridge.x, z: RT.bridge.z, hw: 1.3, hl: L / 2, yaw: RT.bridge.yaw, y: prof[0], prof, ya: H(p0.x, p0.z), yb: H(p1.x, p1.z) }); }
  // stone steps on every pitch > 12 % (one stair deck per 3 m trail segment; tread tops = the highest ground under the tread + 4 cm)
  for (let i = 1; i < RT.pts.length; i++) { const a = RT.pts[i - 1], b = RT.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
    const ya = H(a[0], a[1]), yb = H(b[0], b[1]), mid = (RT.acc[i - 1] + RT.acc[i]) / 2; let g = Math.abs(yb - ya) / L, gl = 0;
    for (let u = 0; u < L - 0.25; u += 0.5) { const t0 = u / L, t1 = Math.min(1, (u + 0.5) / L); gl = Math.max(gl, Math.abs(H(lerp(a[0], b[0], t1), lerp(a[1], b[1], t1)) - H(lerp(a[0], b[0], t0), lerp(a[1], b[1], t0))) / ((t1 - t0) * L)); }
    if (gl > 0.3) g = Math.max(g, ROUTE.stairG); // a short steep kink inside a gentle segment gets steps too
    if (g < ROUTE.stairG || (mid > RT.bridge.a0 - 1 && mid < RT.bridge.a1 + 1)) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, n = Math.max(2, Math.ceil(Math.max(Math.abs(yb - ya), gl * L * 0.5) / ROUTE.rise)), prof = [], low = [];
    for (let k = 0; k < n; k++) { let mx = -1e9, mn = 1e9; for (const u of [k / n, (k + 0.5) / n, (k + 1) / n]) for (const s of [-ROUTE.hw - 0.3, -1.2, 0, 1.2, ROUTE.hw + 0.3]) {
      const x = a[0] + (b[0] - a[0]) * u + uz * s, z = a[1] + (b[1] - a[1]) * u - ux * s, y = H(x, z); if (Math.abs(s) < 1.5) mx = Math.max(mx, y); mn = Math.min(mn, y); } prof.push(mx + 0.04); low.push(mn); }
    if (yb < ya) for (let k = n - 2; k >= 0; k--) prof[k] = Math.max(prof[k], prof[k + 1]); else for (let k = 1; k < n; k++) prof[k] = Math.max(prof[k], prof[k - 1]); // never a tread that dips
    const st = { i, a, b, L, ux, uz, g, prof, prof0: prof.slice(), low, along: mid, x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, yaw: Math.atan2(ux, uz) }; RT.stairs.push(st);

    // retaining wall on the uphill side where the trail cuts across the slope (> 1.2 m between the two edges)
    const [lx, lz] = [st.x + uz * 3.6, st.z - ux * 3.6], [rx, rz] = [st.x - uz * 3.6, st.z + ux * 3.6], hl = H(lx, lz), hr = H(rx, rz);
    if (Math.abs(hl - hr) > 1.2) { const s = hl > hr ? 1 : -1, wx = st.x + uz * 2.95 * s, wz = st.z - ux * 2.95 * s; RT.walls.push({ s, x: wx, z: wz, L: L + 0.3, yaw: st.yaw, top: Math.max(hl, hr) + 0.3, base: Math.min(...low) - 0.4, along: mid });
      h.addBox(wx, wz, 0.7, L + 0.3, st.yaw); } }
  // stair joins (BANKSY 5:50 PM "no height pops over 3 cm"): two stair decks meeting share ONE join height (the mean of their end treads);
  // a stair meeting the dirt trail ends at the trail-centre ground. Then the treads are pulled onto the stair's line
  // (every tread top within a quarter rise of the straight line between the stair's two end heights), so the walk line through the
  // tread centres never jumps (the old ends faded tread-top -> centre-line ground over half a tread: up to 0.5 m on the cross-slopes
  // = 0.04-0.25 m per 2 cm step)
  { const byI = new Map(RT.stairs.map(s => [s.i, s])), R = ROUTE.rise;
    for (const st of RT.stairs) { const p = byI.get(st.i - 1), q = byI.get(st.i + 1);
      st.ya = p ? (p.prof0[p.prof0.length - 1] + st.prof0[0]) / 2 : H(st.a[0], st.a[1]); st.yb = q ? (st.prof0[st.prof0.length - 1] + q.prof0[0]) / 2 : H(st.b[0], st.b[1]); }
    for (const st of RT.stairs) { const P = st.prof, n = P.length, tol = R * 0.25; // each tread top within a quarter rise of the straight ya -> yb line
      for (let k = 0; k < n; k++) { const c = st.ya + (st.yb - st.ya) * (k + 0.5) / n; P[k] = Math.min(c + tol, Math.max(c - tol, P[k])); }
      h.addDeck({ id: 'route_stair_' + st.i, x: st.x, z: st.z, hw: ROUTE.hw, hl: st.L / 2 + 1.2, pad: 1.2, skirt: [byI.has(st.i - 1) ? 'join' : 'ground', byI.has(st.i + 1) ? 'join' : 'ground'], yaw: st.yaw, y: P[0], prof: P, ya: st.ya, yb: st.yb }); } }
  // lamps: every 30 m on the side opposite the trail's own torches (foot.js puts those at +3.2)
  for (let a = 15, k = 0; a < ROUTE.along - 4; a += ROUTE.lampEvery, k++) { const p = at(a), w = RT.walls.find(w => w.s < 0 && Math.abs(w.along - a) < w.L / 2 + 1.5), off = w ? 2.95 : ROUTE.lampOff; // on a retaining wall: stand on its cap
    const [x, z] = side(p, -off), [ix, iz] = side(p, -1.4); RT.lamps.push({ k, x, z, y: w ? w.top + 0.12 : H(x, z), along: a, yaw: Math.atan2(p.ux, p.uz), onWall: !!w });
    h.addCirc(x, z, 0.3); h.INTERACT.push({ id: 'route_lamp_' + k, area: a < ROUTE.split ? 'route_low' : 'route_high', x: ix, z: iz, r: 1.8, label: 'E · LIGHT THE LAMP' }); }
  // landmarks (colliders + interact points)
  { const p = at(RT.lm.overlook); const [ox, oz] = RT.lm.ovDir, cx = p.x + ox * 5.0, cz = p.z + oz * 5.0, yaw = Math.atan2(ox, oz), y = H(p.x + ox * 2.3, p.z + oz * 2.3) + 0.08; // level with the ground at the trail edge (the trail itself can tilt)
    RT.lm.ov = { x: cx, z: cz, ox, oz, yaw, y }; h.addDeck({ id: 'route_overlook', x: cx, z: cz, hw: 2.6, hl: 2.75, yaw, y });
    h.addBox(cx + ox * 2.3, cz + oz * 2.3, 5.4, 0.3, yaw); for (const s of [-1, 1]) h.addBox(cx + oz * 2.55 * s, cz - ox * 2.55 * s, 0.3, 4.6, yaw);
    h.poi('route_overlook', 'The Overlook', cx, cz, { clear: 8 }); h.INTERACT.push({ id: 'route_overlook', area: 'route_low', x: cx, z: cz, r: 2.6, label: 'E · THE OVERLOOK' }); }
  { const p = at(RT.lm.ridge), [x, z] = side(p, 4.3); RT.lm.rv = { x, z, yaw: Math.atan2(p.ux, p.uz), y: H(x, z) }; h.addBox(x, z, 2.6, 0.8, RT.lm.rv.yaw + Math.PI / 2); h.addCirc(x + p.ux * 2.4, z + p.uz * 2.4, 0.9);
    h.poi('route_ridge', 'Ridge View', x, z, { clear: 8 }); h.INTERACT.push({ id: 'route_ridge', area: 'route_high', x: x - p.uz * 1.4, z: z + p.ux * 1.4, r: 2.2, label: 'E · RIDGE VIEW' }); }
  { RT.lm.pillars = []; for (const a of [RT.lm.ruin - 6, RT.lm.ruin, RT.lm.ruin + 6]) { const p = at(a); for (const s of [-1, 1]) { const [x, z] = side(p, 3.5 * s); RT.lm.pillars.push({ x, z, y: H(x, z), s, a }); h.addCirc(x, z, 0.75); } }
    const p = at(RT.lm.ruin); h.poi('route_ruin', 'Ruin Steps', p.x, p.z, { clear: 7 }); }
  { const p = at(4), [x, z] = side(p, -3.6); RT.lm.sign = { x, z, y: H(x, z), yaw: Math.atan2(p.ux, p.uz) }; h.addCirc(x, z, 0.25); }
  // R1 Main Street (town-local x 6, lz -64 -> -205): kerbs, landing bands, benches, the notice board, planters (walk = the terrain)
  { const [x0, z0] = h.townToWorld(h.STREET.x, ROUTE.streetLz0), [x1, z1] = h.GATE, L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    RT.street = { x0, z0, x1, z1, L, ux, uz, half: h.STREET.half, yaw: Math.atan2(ux, uz) };
    const bench = (f, s) => { const x = x0 + ux * f + uz * (h.STREET.half - 1.4) * s, z = z0 + uz * f - ux * (h.STREET.half - 1.4) * s; h.addBox(x, z, 0.7, 2.2, RT.street.yaw); return { x, z, s }; };
    RT.street.benches = [bench(L * 0.33, 1), bench(L * 0.66, -1)]; const nb = bench(L * 0.5, 1); RT.street.board = { x: nb.x, z: nb.z };
    h.INTERACT.push({ id: 'route_board', area: 'route_street', x: nb.x - uz * 1.4, z: nb.z + ux * 1.4, r: 2.2, label: 'E · NOTICE BOARD' }); }
  const bb = (list) => { let a = [1e9, -1e9, 1e9, -1e9]; for (const [x, z] of list) a = [Math.min(a[0], x - 8), Math.max(a[1], x + 8), Math.min(a[2], z - 8), Math.max(a[3], z + 8)]; return a.map(v => Math.round(v)); };
  MODS[0].rect = bb([[RT.street.x0, RT.street.z0], [RT.street.x1, RT.street.z1]]);
  MODS[1].rect = bb(RT.pts.filter((_, i) => RT.acc[i] <= ROUTE.split + 3)); MODS[2].rect = bb(RT.pts.filter((_, i) => RT.acc[i] >= ROUTE.split - 3));
}

// ---------- meshes ----------
const inPart = (part, along) => part === 'route_low' ? along < ROUTE.split : along >= ROUTE.split;
function buildTrail(part, { MATS, OUT, low, H }) {
  const k = new Kit(), near = new THREE.Group(); near.name = 'area_' + part;
  const ST = (i) => (i % 3 === 0 ? 0xbdb6a8 : i % 3 === 1 ? C.STONE : 0xa9a294);
  // stone steps: one chunky slab per tread (top = the walk height), running down into the ground
  for (const s of RT.stairs) { if (!inPart(part, s.along)) continue; const n = s.prof.length, d = s.L / n;
    for (let j = 0; j < n; j++) { const u = (j + 0.5) / n, x = s.a[0] + (s.b[0] - s.a[0]) * u, z = s.a[1] + (s.b[1] - s.a[1]) * u, top = s.prof[j], bot = Math.min(s.low[j], top - 0.3) - 0.35;
      W(k, box(ROUTE.hw * 2, top - bot, d + 0.04), ST(j + s.i), M(x, (top + bot) / 2, z, s.yaw), j % 2 === 0); }
    for (const sd of [-1, 1]) { const x = s.x + s.uz * (ROUTE.hw + 0.25) * sd, z = s.z - s.ux * (ROUTE.hw + 0.25) * sd, top = Math.max(...s.prof) + 0.25, bot = Math.min(...s.low) - 0.3; // cheek walls
      W(k, box(0.5, top - bot, s.L + 0.1), C.STONE_D, M(x, (top + bot) / 2, z, s.yaw)); } }
  for (const w of RT.walls) { if (!inPart(part, w.along)) continue; W(k, box(0.7, w.top - w.base, w.L), 0x9e978a, M(w.x, (w.top + w.base) / 2, w.z, w.yaw)); W(k, box(0.9, 0.25, w.L + 0.1), C.STONE_D, M(w.x, w.top + 0.12, w.z, w.yaw), false); }
  // edging stones every 2.5 m on both sides (skipped on stairs: the cheek walls edge those)
  const onStair = (a) => RT.stairs.some(s => Math.abs(s.along - a) < s.L / 2 + 0.5);
  for (let a = 1; a < ROUTE.along; a += low ? 3.5 : 2.5) { if (!inPart(part, a) || onStair(a)) continue; const p = at(a);
    for (const sd of [-1, 1]) { const [x, z] = side(p, 2.75 * sd); W(k, jitter(new THREE.IcosahedronGeometry(0.42, 0), 0.25, a * sd), (Math.round(a) + sd) % 3 ? C.STONE_D : 0x9e978a, M(x, H(x, z) + 0.1, z, a), false); } }
  // lamps: post + bracket + lantern (the flame is a separate instanced mesh: lit / unlit per lamp)
  const lamps = RT.lamps.filter(l => inPart(part, l.along));
  for (const l of lamps) { if (!l.onWall) W(k, box(0.28, 0.5, 0.28), C.STONE_D, M(l.x, l.y + 0.25, l.z)); W(k, cyl(0.09, 0.11, 3.2, 6), C.IRON, M(l.x, l.y + 1.9, l.z), false);
    W(k, box(0.7, 0.08, 0.08), C.IRON, M(l.x, l.y + 3.4, l.z, l.yaw + Math.PI / 2), false); W(k, box(0.44, 0.5, 0.44), 0x3b2a1a, M(l.x, l.y + 3.1, l.z)); W(k, cyl(0, 0.34, 0.26, 4), C.IRON, M(l.x, l.y + 3.48, l.z, Math.PI / 4), false); }
  // landmarks
  if (part === 'route_low') {
    const s = RT.lm.sign; W(k, box(0.2, 2.8, 0.2), C.WOOD_D, M(s.x, s.y + 1.4, s.z));
    [['TOWN', Math.PI], ['FORT', Math.PI / 2], ['JUNGLE', 0]].forEach(([_, a], i) => W(k, box(1.6, 0.36, 0.08), i === 2 ? C.WOOD_L : C.WOOD, M(s.x, s.y + 2.4 - i * 0.45, s.z, s.yaw + a + Math.PI / 2)));
    const b = RT.bridge, n = b.prof.length; // L1 log footbridge: planks follow the deck, log stringers, posts + rope rails
    for (let j = 0; j < n; j++) { const u = (j + 0.5) / n, x = b.x + b.ux * (u - 0.5) * b.L, z = b.z + b.uz * (u - 0.5) * b.L; W(k, box(2.5, 0.16, b.L / n - 0.06), j % 2 ? C.WOOD : C.WOOD_L, M(x, b.prof[j] - 0.08, z, b.yaw), false); }
    for (const sd of [-1, 1]) { for (let j = 0; j <= 4; j++) { const u = j / 4, ii = Math.min(n - 1, Math.floor(u * n)), x = b.x + b.ux * (u - 0.5) * b.L + b.uz * 1.3 * sd, z = b.z + b.uz * (u - 0.5) * b.L - b.ux * 1.3 * sd, y = b.prof[ii];
      W(k, cyl(0.12, 0.14, 2.6, 6), C.WOOD_D, M(x, y - 0.3, z)); }
      const x = b.x + b.uz * 1.3 * sd, z = b.z - b.ux * 1.3 * sd, y = Math.max(...b.prof); W(k, cyl(0.035, 0.035, b.L, 4), 0xc9a36b, M(x, y + 0.9, z, b.yaw, Math.PI / 2, 0), false);
      W(k, cyl(0.22, 0.22, b.L, 7), C.WOOD_D, M(b.x + b.uz * 0.9 * sd, Math.min(...b.prof) - 0.3, b.z - b.ux * 0.9 * sd, b.yaw, Math.PI / 2, 0)); }
    const o = RT.lm.ov; W(k, box(5.2, 0.3, 5.5), C.WOOD, M(o.x, o.y - 0.15, o.z, o.yaw)); // L3 Lagoon Overlook deck on stone piers + railings
    for (const [u, v] of [[-2.3, -2.1], [2.3, -2.1], [-2.3, 2.1], [2.3, 2.1]]) { const x = o.x + o.oz * u + o.ox * v, z = o.z - o.ox * u + o.oz * v, g = H(x, z); W(k, box(0.6, Math.max(0.6, o.y - g + 0.8), 0.6), C.STONE_D, M(x, (o.y + g - 0.8) / 2, z)); }
    W(k, box(5.2, 0.14, 0.14), C.WOOD_D, M(o.x + o.ox * 2.3, o.y + 1.0, o.z + o.oz * 2.3, o.yaw), false); for (const sd of [-1, 1]) W(k, box(0.14, 0.14, 4.6), C.WOOD_D, M(o.x + o.oz * 2.55 * sd, o.y + 1.0, o.z - o.ox * 2.55 * sd, o.yaw), false);
    for (let j = -2; j <= 2; j++) W(k, box(0.12, 1.0, 0.12), C.WOOD_D, M(o.x + o.ox * 2.3 + o.oz * j * 1.25, o.y + 0.5, o.z + o.oz * 2.3 - o.ox * j * 1.25), false);
    W(k, cyl(0.07, 0.09, 0.9, 5), C.GOLD, M(o.x + o.ox * 1.9, o.y + 1.2, o.z + o.oz * 1.9, o.yaw, Math.PI / 2 - 0.25, 0), false); // a fixed spyglass on the rail
  } else {
    const r = RT.lm.rv; W(k, box(2.6, 0.45, 0.8), C.STONE, M(r.x, r.y + 0.45, r.z, r.yaw + Math.PI / 2)); for (const sd of [-1, 1]) W(k, box(0.5, 0.45, 0.7), C.STONE_D, M(r.x + Math.cos(r.yaw) * 1.0 * sd, r.y + 0.22, r.z - Math.sin(r.yaw) * 1.0 * sd, r.yaw + Math.PI / 2), false);
    const cx = r.x + Math.sin(r.yaw) * 2.4, cz = r.z + Math.cos(r.yaw) * 2.4, cy = H(cx, cz); for (let j = 0; j < 5; j++) W(k, jitter(new THREE.IcosahedronGeometry(0.75 - j * 0.12, 0), 0.2, j), j % 2 ? C.STONE : C.STONE_D, M(cx, cy + 0.4 + j * 0.55, cz, j), j === 0);
    W(k, box(0.06, 0.9, 0.06), C.WOOD_D, M(cx, cy + 3.3, cz), false); W(k, box(0.6, 0.4, 0.02), C.RED, M(cx + 0.3, cy + 3.5, cz), false);
    for (const p of RT.lm.pillars) { const hh = p.a === RT.lm.ruin ? 4.2 : 2 + hash(p.a, p.s) * 2.5; W(k, cyl(0.6, 0.7, hh, 8), (p.a + p.s) % 2 ? C.STONE : 0xa9a294, M(p.x, p.y + hh / 2 - 0.2, p.z)); W(k, box(1.5, 0.35, 1.5), C.STONE_D, M(p.x, p.y + 0.1, p.z), false);
      if (p.s > 0) W(k, box(0.3, 1.4, 0.12), C.VINE, M(p.x, p.y + hh - 0.8, p.z + 0.62), false); }
    const ps = RT.lm.pillars.filter(p => p.a === RT.lm.ruin); if (ps.length === 2) { const [a, b] = ps, y = Math.max(a.y, b.y) + 4.2; W(k, box(Math.hypot(a.x - b.x, a.z - b.z) + 1.4, 0.8, 1.0), 0xa39c8e, M((a.x + b.x) / 2, y + 0.3, (a.z + b.z) / 2, Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2)); }
  }
  near.add(k.build(MATS, OUT));
  // flames: one small mesh per lamp, toggled by the Lamplighter state (19 tiny meshes at most per part; Low: unlit lamps simply hide it)
  const kf = new Kit(); W(kf, box(0.22, 0.3, 0.22), 0xffd75a, M(0, 0, 0), false); const fl = kf.build(MATS, OUT), flames = {};
  for (const l of lamps) { const g = fl.clone(); g.position.set(l.x, l.y + 3.12, l.z); near.add(g); flames[l.k] = g; }
  const refresh = () => { const lit = store.get().lamps || {}; for (const [kk, g] of Object.entries(flames)) g.visible = !!lit[kk]; }; refresh();
  return { near, far: null, flames, refresh };
}
function buildStreet({ MATS, OUT, H }) {
  const k = new Kit(), near = new THREE.Group(); near.name = 'area_route_street'; const s = RT.street, n = Math.floor(s.L / 1.15), gy = (x, z) => H(x, z);
  for (let j = 0; j < n; j++) for (const sd of [-1, 1]) { const f = (j + 0.5) * s.L / n, x = s.x0 + s.ux * f + s.uz * (s.half + 0.2) * sd, z = s.z0 + s.uz * f - s.ux * (s.half + 0.2) * sd; // kerbs
    W(k, box(0.42, 0.3, s.L / n - 0.08), j % 2 ? C.STONE_D : 0x9e978a, M(x, gy(x, z) + 0.05, z, s.yaw), false); }
  { const x = s.x0 + s.ux * 0.8, z = s.z0 + s.uz * 0.8, g = (gy(x + s.ux, z + s.uz) - gy(x - s.ux, z - s.uz)) / 2; // R0 threshold: a darker dressed-stone band where the plaza hands over
    W(k, box(s.half * 2, 0.1, 1.4), 0x8a837a, M(x, gy(x, z) + 0.035, z, s.yaw, -Math.atan(g), 0), false);
    for (const sd of [-1, 1]) { const px = x + s.uz * (s.half + 0.5) * sd, pz = z - s.ux * (s.half + 0.5) * sd, py = gy(px, pz); W(k, box(0.7, 1.1, 0.7), C.STONE, M(px, py + 0.55, pz, s.yaw)); W(k, box(0.85, 0.2, 0.85), C.STONE_D, M(px, py + 1.2, pz, s.yaw), false); } }
  for (let f = 12; f < s.L - 4; f += 12) { const x = s.x0 + s.ux * f, z = s.z0 + s.uz * f, g = (gy(x + s.ux, z + s.uz) - gy(x - s.ux, z - s.uz)) / 2; // landing bands (flush, tilted to the street)
    W(k, box(s.half * 2, 0.08, 1.1), 0xd8d0bf, M(x, gy(x, z) + 0.03, z, s.yaw, -Math.atan(g), 0), false); }
  for (const b of [...s.benches]) { const y = gy(b.x, b.z); W(k, box(0.6, 0.12, 2.0), C.WOOD, M(b.x, y + 0.5, b.z, s.yaw)); for (const e of [-0.8, 0.8]) W(k, box(0.5, 0.45, 0.16), C.STONE_D, M(b.x + s.ux * e, y + 0.22, b.z + s.uz * e, s.yaw), false); }
  { const b = s.board, y = gy(b.x, b.z); for (const e of [-0.9, 0.9]) W(k, box(0.14, 2.2, 0.14), C.WOOD_D, M(b.x + s.ux * e, y + 1.1, b.z + s.uz * e, s.yaw)); W(k, box(0.12, 1.1, 2.1), C.WOOD, M(b.x, y + 1.6, b.z, s.yaw));
    for (let i = 0; i < 4; i++) W(k, box(0.03, 0.4, 0.34), [0xf4e9c8, C.WHITE, 0xf4e9c8, C.RED][i], M(b.x - s.uz * 0.07 * (b.s > 0 ? 1 : -1), y + 1.4 + (i % 2) * 0.45, b.z + s.ux * 0.07 + (i - 1.5) * 0.45, s.yaw), false); }
  for (const sd of [-1, 1]) { const f = s.L - 3, x = s.x0 + s.ux * f + s.uz * (s.half - 0.9) * sd, z = s.z0 + s.uz * f - s.ux * (s.half - 0.9) * sd, y = gy(x, z); // planters at the gate
    W(k, box(1.2, 0.6, 1.2), C.STONE_D, M(x, y + 0.3, z, s.yaw)); for (let i = 0; i < 3; i++) W(k, new THREE.IcosahedronGeometry(0.35, 0), [C.RED, 0xffc93c, 0x5f9a3a][i], M(x + (i - 1) * 0.3, y + 0.75, z, i), false); }
  near.add(k.build(MATS, OUT)); return { near, far: null };
}

const lampMsg = (k) => { const o = store.upd(o => { (o.lamps = o.lamps || {})[k] = 1; }), n = Object.keys(o.lamps).length, all = RT.lamps.length;
  return n >= all ? `LAMPLIGHTER!<br><small>all ${all} lamps on the Pirates' Climb are lit · the lantern cosmetic arrives with the next update<br>${PENDING}</small>` : `LAMP LIT · ${n}/${all}<br><small>light every lamp from the gate to the jungle</small>`; };
const trailMod = (id, name) => ({
  id, name, rect: [0, 0, 0, 0], terrain: { pads: [], paths: [] },
  register(h) { prep(h); },
  build(ctx) { return buildTrail(id, ctx); },
  label(q) { if (q.id.startsWith('route_lamp_')) return (store.get().lamps || {})[q.id.slice(11)] ? 'LAMP LIT' : 'E · LIGHT THE LAMP'; return null; },
  activate(q, t, api, b) {
    if (q.id.startsWith('route_lamp_')) { const kk = q.id.slice(11); if ((store.get().lamps || {})[kk]) return 'THIS LAMP IS ALREADY LIT'; const m = lampMsg(kk); b?.refresh(); return m; }
    if (q.id === 'route_overlook') return 'THE OVERLOOK<br><small>the valley drops away below · the lagoon and its falls to the south · the harbor masts and the fort behind you</small>';
    if (q.id === 'route_ridge') return 'RIDGE VIEW · the top of the climb<br><small>the harbor and the fort behind you · Skull Peak to the south-east · the temple ruins are just down the steps ahead</small>';
    return null; },
});
const MODS = [
  { id: 'route_street', name: "Pirates' Climb: Main Street", rect: [0, 0, 0, 0], terrain: { pads: [], paths: [] }, register(h) { prep(h); }, build: buildStreet,
    activate(q) { if (q.id === 'route_board') return `NOTICE BOARD<br><small>· the PIRATES' CLIMB: through the gate, follow the lamps to the jungle ruins<br>· HILLTOP FORT: up the ramp by the gate<br>· light every lamp on the climb: LAMPLIGHTER</small>`; return null; } },
  trailMod('route_low', "Pirates' Climb: gate to the Lagoon Overlook"),
  trailMod('route_high', "Pirates' Climb: ridge to the jungle trailhead"),
];
export const _route = RT;
export default MODS;
