// [island-rework] HILLTOP FORT walk-in (BANKSY 2:46 PM "the inaccessible castle at top of hill"; 5:33 PM "fix those 3 first"). Plan: PLAN.md §1c
// Was: foot.js built CO.FORT (lx 46, lz -232 = foot (-408, -44), knoll top y 36) as one solid 27 x 27 collider: no door, no path, a 1.6:1 knoll.
// Now (this module replaces that block; foot.js skips it while FORT_WALKIN):
//   - THE FORT STAIR from the town gate: leg 1 north along x -434 (y 20 -> 31), a landing, leg 2 east (31 -> 36) through the
//     GATEHOUSE arch in the west wall (portcullis up), stone parapets both sides (colliders), masonry down to the ground
//   - the COURTYARD: a flat 22.8 x 22.8 yard at y 36 (terrain pad), the well, crates, the training dummy, the flag mast (RAISE THE COLOURS)
//   - the KEEP (roofless WAR ROOM, door on the west face): the map table (E: reads your treasure map / the fort chronicle)
//   - RAMPARTS: a stair up the inside of the north wall to the wall-walk (y 42) round all four walls + the four corner towers,
//     outer parapets (colliders), the 4 cannons on the south wall, the SPYGLASS on the NE tower
// Deck axes (foot.js areaDeckAt): yaw 0 = hw across x, hl along z; yaw PI/2 = hw across z, hl along x.
// Walls / towers / keep are WALK DECKS at their top height, not colliders: from the yard or the knoll they are > 0.6 m up, so the
// walker can't step into them (same rule as any deck), and the wall-walk on top is the same deck. Only the outer parapet strips
// + the stair parapets + props are colliders. Cosmetic only: nothing pays gold (flags.js).
import * as THREE from 'three';
import { Kit, M, box, cyl, ball, hash, W, C, store, today } from './common.js';
import { AREA_GOLD_ON, PENDING } from './flags.js';
export const FORT_WALKIN = true;
export const FORT = { x: -408, z: -44, y: 36, half: 13, wall: 1.6, wallTop: 42, gateHW: 2.0, keep: { x: -403, z: -44, half: 5, wall: 0.8, h: 9, doorHW: 1.3 } };
const F = FORT, X0 = F.x - F.half, X1 = F.x + F.half, Z0 = F.z - F.half, Z1 = F.z + F.half, WT = F.wallTop;
const LEG1 = { x: -434, z0: -72, z1: -46.5, hw: 2.0, y1: 31 }, LAND = { x: -434, z: -44, hw: 2.5 }, LEG2 = { z: -44, x0: -431.5, x1: X0 + 2.5, hw: F.gateHW }; // runs on through the gate arch onto the yard (covers the cut edge)
const NSTAIR = { z: Z1 - F.wall - 1.1 - 1.05, x0: -416, x1: -404, hw: 1.1 };   // inside the north wall, yard (36) -> wall-walk (42)
const RAMP = 1.1;                                                              // wall-walk ledge inside the wall (timber)
const SPY = { x: X1 - 1.6, z: Z1 - 1.6 }, TABLE = { x: F.keep.x, z: F.keep.z }, MAST = { x: F.x - 6, z: F.z - 6 };
let P1 = [], P2 = [], Y20 = 20;
const stepProf = (H, ax, az, bx, bz, y0, y1, n) => { const p = []; for (let k = 0; k < n; k++) { const u = (k + 0.5) / n; p.push(Math.max(y0 + (y1 - y0) * (k + 1) / n, H(ax + (bx - ax) * u, az + (bz - az) * u) + 0.04)); }
  for (let k = 1; k < n; k++) p[k] = Math.max(p[k], p[k - 1]); return p; };
export default {
  id: 'hilltop_fort', name: 'Hilltop Fort', rect: [-437, X1, -73, Z1],
  terrain: { pads: [[X0, X1, Z0, Z1, F.y]], paths: [], cuts: [[LEG2.x0 - 1, LEG2.z, LEG1.y1, -427, LEG2.z, LEG1.y1 + (F.y - LEG1.y1) * 4.5 / (LEG2.x1 - LEG2.x0), LEG2.hw]] }, // leg 2 cut into the knoll: one even grade (0.45), no steep last metres
  register(h) {
    const { H } = h; Y20 = H(LEG1.x, LEG1.z0);
    // the fort stair (2 legs + landing): treads of ~0.2 m
    const L1 = LEG1.z1 - LEG1.z0; P1 = stepProf(H, LEG1.x, LEG1.z0, LEG1.x, LEG1.z1, Y20, LEG1.y1, Math.ceil((LEG1.y1 - Y20) / 0.21));
    h.addDeck({ id: 'fort_stair_1', x: LEG1.x, z: (LEG1.z0 + LEG1.z1) / 2, hw: LEG1.hw, hl: L1 / 2, yaw: 0, y: P1[0], prof: P1, ya: Y20, yb: LEG1.y1 });
    h.addDeck({ id: 'fort_landing', x: LAND.x, z: LAND.z, hw: LAND.hw, hl: LAND.hw, yaw: 0, y: LEG1.y1 });
    const L2 = LEG2.x1 - LEG2.x0; P2 = stepProf(H, LEG2.x0, LEG2.z, LEG2.x1, LEG2.z, LEG1.y1, LEG1.y1 + (F.y - LEG1.y1) * (LEG2.x1 - LEG2.x0) / (X0 - LEG2.x0), Math.ceil((F.y - LEG1.y1) / 0.21 * (LEG2.x1 - LEG2.x0) / (X0 - LEG2.x0))).map(y => Math.min(y, F.y)); // reaches the yard level AT the gate line, flat through the arch
    h.addDeck({ id: 'fort_stair_2', x: (LEG2.x0 + LEG2.x1) / 2, z: LEG2.z, hw: LEG2.hw, hl: L2 / 2, yaw: Math.PI / 2, y: P2[0], prof: P2, ya: LEG1.y1, yb: F.y });
    // stair parapets (colliders): leg 1 both sides, the landing's west + north edges, leg 2 both sides
    h.addBox(LEG1.x - LEG1.hw - 0.3, (LEG1.z0 + 3 + LEG1.z1) / 2, 0.5, L1 - 3, 0); h.addBox(LEG1.x + LEG1.hw + 0.3, (LEG1.z0 + 3 + LEG1.z1) / 2, 0.5, L1 - 3, 0);
    h.addBox(LAND.x - LAND.hw - 0.3, LAND.z, 0.5, LAND.hw * 2 + 0.6, 0); h.addBox(LAND.x, LAND.z + LAND.hw + 0.3, LAND.hw * 2 + 0.6, 0.5, 0);
    for (const s of [-1, 1]) h.addBox((LEG2.x0 + X0) / 2, LEG2.z + s * (LEG2.hw + 0.3), X0 - LEG2.x0, 0.5, 0);
    // curtain walls = decks at the wall-walk height (inner ledge included); the west wall has the gate gap
    const wd = F.wall + RAMP, wc = F.half - wd / 2;
    h.addDeck({ id: 'fort_wall_n', x: F.x, z: F.z + wc, hw: F.half, hl: wd / 2, yaw: 0, y: WT });
    h.addDeck({ id: 'fort_wall_s', x: F.x, z: F.z - wc, hw: F.half, hl: wd / 2, yaw: 0, y: WT });
    h.addDeck({ id: 'fort_wall_e', x: F.x + wc, z: F.z, hw: wd / 2, hl: F.half, yaw: 0, y: WT });
    const gs = (F.half * 2 - F.gateHW * 2) / 2; // the two west wall pieces either side of the gate
    for (const s of [-1, 1]) h.addDeck({ id: 'fort_wall_w' + (s < 0 ? 's' : 'n'), x: F.x - wc, z: F.z + s * (F.gateHW + gs / 2), hw: wd / 2, hl: gs / 2, yaw: 0, y: WT });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) h.addDeck({ id: 'fort_tower_' + sx + sz, x: F.x + sx * F.half, z: F.z + sz * F.half, r: 3.4, y: WT });
    // outer parapets (colliders, 0.5 m on the outside edge of each wall; the gate gap stays open) + tower rims
    h.addBox(F.x, Z1 - 0.25, F.half * 2, 0.5, 0); h.addBox(F.x, Z0 + 0.25, F.half * 2, 0.5, 0); h.addBox(X1 - 0.25, F.z, 0.5, F.half * 2, 0);
    for (const s of [-1, 1]) h.addBox(X0 + 0.25, F.z + s * (F.gateHW + gs / 2), 0.5, gs, 0);
    // the north-wall stair (yard -> wall-walk)
    h.addDeck({ id: 'fort_rampart_stair', x: (NSTAIR.x0 + NSTAIR.x1) / 2, z: NSTAIR.z, hw: NSTAIR.hw, hl: (NSTAIR.x1 - NSTAIR.x0) / 2, yaw: Math.PI / 2, y: F.y, prof: Array.from({ length: 28 }, (_, k) => F.y + (WT - F.y) * (k + 0.5) / 28), ya: F.y, yb: WT });
    // the keep: its walls are decks at the keep top (door gap on the west face); roofless war room inside
    const K = F.keep, kw = K.wall, kt = F.y + K.h;
    h.addDeck({ id: 'fort_keep_n', x: K.x, z: K.z + K.half - kw / 2, hw: K.half, hl: kw / 2, yaw: 0, y: kt });
    h.addDeck({ id: 'fort_keep_s', x: K.x, z: K.z - K.half + kw / 2, hw: K.half, hl: kw / 2, yaw: 0, y: kt });
    h.addDeck({ id: 'fort_keep_e', x: K.x + K.half - kw / 2, z: K.z, hw: kw / 2, hl: K.half, yaw: 0, y: kt });
    const kg = (K.half * 2 - K.doorHW * 2) / 2; for (const s of [-1, 1]) h.addDeck({ id: 'fort_keep_w' + s, x: K.x - K.half + kw / 2, z: K.z + s * (K.doorHW + kg / 2), hw: kw / 2, hl: kg / 2, yaw: 0, y: kt });
    // props: well, table, mast, dummy, crates, cannons (on the south wall-walk, outer side)
    h.addCirc(F.x - 4, F.z + 6, 1.5); h.addCirc(TABLE.x, TABLE.z, 1.4); h.addCirc(MAST.x, MAST.z, 0.4); h.addCirc(F.x - 9, F.z - 8, 0.5);
    for (let i = 0; i < 4; i++) h.addCirc(F.x - 6 + i * 4, Z0 + 1.2, 0.6);
    h.addBox(F.x + 2.3, F.z - 8.7, 4.0, 2.6, 0);                                               // crates
    for (const s of [-1, 1]) { h.addBox(X0 + 0.6, F.z + s * (F.gateHW + 1.4), 3.4, 2.8, 0);      // gatehouse towers: collider + a solid deck at the
      h.addDeck({ id: 'fort_gatetower_' + s, x: X0 + 0.6, z: F.z + s * (F.gateHW + 1.4), hw: 1.7, hl: 1.4, yaw: 0, y: WT + 4.45 }); } // cap, so the follow camera pulls in in front of them (never inside)
    h.poi('fort', 'Hilltop Fort', F.x, F.z, { clear: 22 }); h.poi('fort_stair', 'Fort stair', LEG1.x, (LEG1.z0 + LEG1.z1) / 2, { clear: 6 });
    h.INTERACT.push({ id: 'fort_table', area: 'hilltop_fort', x: TABLE.x - 2.2, z: TABLE.z, r: 2.4, label: 'E · WAR-ROOM MAP TABLE' });
    h.INTERACT.push({ id: 'fort_flag', area: 'hilltop_fort', x: MAST.x + 1.2, z: MAST.z, r: 2.4, label: 'E · RAISE THE COLOURS' });
    h.INTERACT.push({ id: 'fort_spyglass', area: 'hilltop_fort', x: SPY.x, z: SPY.z, r: 1.4, label: 'E · SPYGLASS' });
  },
  build({ MATS, OUT, low, H }) {
    const k = new Kit(), near = new THREE.Group(), far = new THREE.Group(); near.name = 'area_fort'; far.name = 'area_fort_far';
    const Y = F.y, wh = WT - Y + 1.2, base = Y - 6;
    // stair legs: one masonry block per tread (top = the tread you stand on, down to the lowest ground under it) + parapets
    const tread = (x, z, w, d, top, yaw = 0) => { const lo = Math.min(H(x - w / 2, z - d / 2), H(x + w / 2, z + d / 2), H(x, z)) - 0.6; W(k, box(w, top - lo, d), C.STONE, M(x, (top + lo) / 2, z, yaw), false); W(k, box(w + 0.1, 0.12, d + 0.04), 0xcfc8bb, M(x, top - 0.06, z, yaw), false); };
    { const L = LEG1.z1 - LEG1.z0, n = P1.length; for (let i = 0; i < n; i++) tread(LEG1.x, LEG1.z0 + (i + 0.5) * L / n, LEG1.hw * 2, L / n + 0.02, P1[i]);
      for (const s of [-1, 1]) for (let i = 3; i < n; i += 2) { const z = LEG1.z0 + (i + 0.5) * L / n, y = P1[i]; W(k, box(0.5, 1.0, L / n * 2 + 0.05), C.STONE_D, M(LEG1.x + s * (LEG1.hw + 0.3), y + 0.5, z), i % 6 === 3); } }
    { const y = P1[P1.length - 1]; tread(LAND.x, LAND.z, LAND.hw * 2, LAND.hw * 2, y); W(k, box(0.5, 1.0, LAND.hw * 2 + 0.6), C.STONE_D, M(LAND.x - LAND.hw - 0.3, y + 0.5, LAND.z)); W(k, box(LAND.hw * 2 + 0.6, 1.0, 0.5), C.STONE_D, M(LAND.x, y + 0.5, LAND.z + LAND.hw + 0.3));
      // a lamp on the landing
      W(k, cyl(0.1, 0.13, 3.2, 6), C.IRON, M(LAND.x - LAND.hw - 0.3, y + 2.6, LAND.z + LAND.hw + 0.3)); W(k, box(0.5, 0.6, 0.5), 0xffd27a, M(LAND.x - LAND.hw - 0.3, y + 4.3, LAND.z + LAND.hw + 0.3), false); }
    { const L = LEG2.x1 - LEG2.x0, n = P2.length; for (let i = 0; i < n; i++) tread(LEG2.x0 + (i + 0.5) * L / n, LEG2.z, L / n + 0.02, LEG2.hw * 2, P2[i]);
      for (const s of [-1, 1]) for (let i = 0; i < n; i += 2) { const x = LEG2.x0 + (i + 0.5) * L / n, y = P2[i]; W(k, box(L / n * 2 + 0.05, 1.0, 0.5), C.STONE_D, M(x, y + 0.5, LEG2.z + s * (LEG2.hw + 0.3)), i % 6 === 0); } }
    // curtain walls (west wall in two pieces), crenellations on the outer parapet, timber ledge inside
    const wall = (x, z, w, d) => { W(k, box(w, wh + (Y - base), d), C.STONE, M(x, (WT + 1.2 + base) / 2, z)); };
    const wd = F.wall, gs = (F.half * 2 - F.gateHW * 2) / 2;
    wall(F.x, Z1 - wd / 2, F.half * 2, wd); wall(F.x, Z0 + wd / 2, F.half * 2, wd); wall(X1 - wd / 2, F.z, wd, F.half * 2);
    for (const s of [-1, 1]) wall(X0 + wd / 2, F.z + s * (F.gateHW + gs / 2), wd, gs);
    const cren = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 1.6); for (let i = 0; i < n; i += 2) { const u = (i + 0.5) / n; W(k, box(0.8, 0.9, 0.8), C.STONE_D, M(ax + (bx - ax) * u, WT + 1.65, az + (bz - az) * u), false); } };
    cren(X0, Z1 - 0.25, X1, Z1 - 0.25); cren(X0, Z0 + 0.25, X1, Z0 + 0.25); cren(X1 - 0.25, Z0, X1 - 0.25, Z1);
    for (const s of [-1, 1]) cren(X0 + 0.25, F.z + s * F.gateHW, X0 + 0.25, F.z + s * F.half);
    // wall-walk: the inner timber ledge on corbels (1.1 m inside each wall)
    const ledge = (x, z, w, d) => { W(k, box(w, 0.2, d), C.WOOD, M(x, WT - 0.1, z)); };
    const lc = F.half - wd - RAMP / 2; ledge(F.x, F.z + lc, F.half * 2 - 2 * wd, RAMP); ledge(F.x, F.z - lc, F.half * 2 - 2 * wd, RAMP); ledge(F.x + lc, F.z, RAMP, F.half * 2 - 2 * wd);
    for (const s of [-1, 1]) ledge(F.x - lc, F.z + s * (F.gateHW + gs / 2 - wd / 2), RAMP, gs - wd);
    for (let i = 0; i < 12; i++) { const u = -F.half + 2 + i * 2.1; for (const [x, z] of [[F.x + u, F.z + lc], [F.x + u, F.z - lc], [F.x + lc, F.z + u]]) W(k, box(0.3, 0.6, 0.3), C.WOOD_D, M(x, WT - 0.5, z), false); }
    // corner towers: round, a lookout top (= the wall-walk height) with crenels + a cone roof on posts
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = F.x + sx * F.half, z = F.z + sz * F.half;
      W(k, cyl(3.4, 3.8, WT - base, 12), C.STONE, M(x, (WT + base) / 2, z)); W(k, cyl(3.5, 3.5, 0.2, 12), 0xcfc8bb, M(x, WT - 0.05, z), false);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; W(k, box(0.9, 1.0, 0.6), C.STONE_D, M(x + Math.cos(a) * 3.2, WT + 0.5, z + Math.sin(a) * 3.2, -a), false); }
      for (const a of [0.8, 2.4, 3.9, 5.5]) W(k, cyl(0.12, 0.12, 3.6, 5), C.WOOD_D, M(x + Math.cos(a) * 2.6, WT + 1.8, z + Math.sin(a) * 2.6), false);
      W(k, new THREE.ConeGeometry(3.9, 3.2, 12), 0x9a3a2a, M(x, WT + 5.2, z)); }
    // gatehouse: two square towers flanking the arch, the lintel, the raised portcullis + chains, banners
    for (const s of [-1, 1]) { const z = F.z + s * (F.gateHW + 1.4); W(k, box(3.4, WT + 4 - base, 2.8), C.STONE_D, M(X0 + 0.6, (WT + 4 + base) / 2, z)); W(k, box(3.6, 0.5, 3.0), C.STONE, M(X0 + 0.6, WT + 4.2, z), false);
      W(k, box(0.1, 3.2, 1.4), s < 0 ? C.RED : 0x1a1a1a, M(X0 - 1.15, WT - 1.6, z), false); }
    W(k, box(3.4, 2.4, F.gateHW * 2 + 0.2), C.STONE_D, M(X0 + 0.6, WT + 0.4, F.z)); W(k, box(0.6, 0.6, F.gateHW * 2), 0xcfc8bb, M(X0 - 1.0, WT - 1.0, F.z), false);
    for (let i = 0; i < 6; i++) W(k, box(0.12, 1.6, 0.12), C.IRON, M(X0 - 0.2, WT - 2.3, F.z - F.gateHW + 0.3 + i * (F.gateHW * 2 - 0.6) / 5), false);
    W(k, box(0.12, 0.12, F.gateHW * 2 - 0.4), C.IRON, M(X0 - 0.2, WT - 3.0, F.z), false);
    // the wooden gate (concept B3_fort.jpg): two plank leaves with iron straps, swung open into the yard
    for (const s of [-1, 1]) { const z = F.z + s * (F.gateHW + 0.05); W(k, box(2.0, 4.4, 0.18), C.WOOD_D, M(X0 + 2.7, Y + 2.2, z)); for (const yy of [0.8, 2.2, 3.6]) W(k, box(2.05, 0.16, 0.22), C.IRON, M(X0 + 2.7, Y + yy, z), false);
      W(k, box(0.3, 5.0, 0.3), C.WOOD, M(X0 + 1.7, Y + 2.5, z), false); }
    // yard floor: flagstones round the edge, packed earth in the middle
    W(k, box(F.half * 2 - 2 * wd, 0.1, F.half * 2 - 2 * wd), 0xb3a58c, M(F.x, Y + 0.03, F.z), false);
    for (let i = 0; i < 40; i++) { const a = hash(i, 3) * 20 - 10, b = hash(i, 4) * 20 - 10; W(k, box(1.2 + hash(i, 5), 0.06, 0.9 + hash(i, 6)), i % 2 ? 0xa89c86 : 0xc4b9a4, M(F.x + a, Y + 0.09, F.z + b, hash(i, 7)), false); }
    // the north-wall stair
    { const n = 28, L = NSTAIR.x1 - NSTAIR.x0; for (let i = 0; i < n; i++) { const top = Y + (WT - Y) * (i + 1) / n; W(k, box(L / n + 0.02, top - Y + 0.1, NSTAIR.hw * 2), C.STONE, M(NSTAIR.x0 + (i + 0.5) * L / n, (top + Y - 0.1) / 2, NSTAIR.z), false); } }
    // the keep: roofless war room, door on the west face, banner + beams overhead, the map table + chronicle lectern
    { const K = F.keep, kw = K.wall, kt = Y + K.h, kg = (K.half * 2 - K.doorHW * 2) / 2;
      W(k, box(K.half * 2, K.h + 1, kw), C.STONE_D, M(K.x, Y + (K.h - 1) / 2, K.z + K.half - kw / 2)); W(k, box(K.half * 2, K.h + 1, kw), C.STONE_D, M(K.x, Y + (K.h - 1) / 2, K.z - K.half + kw / 2));
      W(k, box(kw, K.h + 1, K.half * 2), C.STONE_D, M(K.x + K.half - kw / 2, Y + (K.h - 1) / 2, K.z));
      for (const s of [-1, 1]) W(k, box(kw, K.h + 1, kg), C.STONE_D, M(K.x - K.half + kw / 2, Y + (K.h - 1) / 2, K.z + s * (K.doorHW + kg / 2)));
      W(k, box(kw + 0.1, K.h - 3, K.doorHW * 2 + 0.2), C.STONE_D, M(K.x - K.half + kw / 2, Y + 3 + (K.h - 3) / 2, K.z)); // over the door
      W(k, box(0.2, 2.8, K.doorHW * 2 + 0.5), C.WOOD_D, M(K.x - K.half - 0.05, Y + 1.4, K.z), false);                 // the door frame (open)
      for (let i = 0; i < 4; i++) W(k, box(K.half * 2 - 1, 0.35, 0.35), C.WOOD_D, M(K.x, kt - 0.8, K.z - K.half + 1.6 + i * 2.3), false);
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) W(k, box(0.8, 0.8, 0.8), C.STONE, M(K.x + s * (K.half - 0.4), kt + 0.9, K.z - K.half + 0.8 + i * 2.8), false);
      // map table: chunky trestles, the chart, a dagger + compass
      W(k, box(2.6, 0.18, 1.7), C.WOOD, M(TABLE.x, Y + 1.0, TABLE.z)); for (const s of [-1, 1]) W(k, box(0.2, 0.95, 1.4), C.WOOD_D, M(TABLE.x + s * 1.0, Y + 0.48, TABLE.z), false);
      W(k, box(2.2, 0.03, 1.4), 0xe8d6a8, M(TABLE.x, Y + 1.105, TABLE.z), false); W(k, box(0.4, 0.04, 0.06), C.RED, M(TABLE.x + 0.4, Y + 1.13, TABLE.z + 0.2, 0.7), false); W(k, box(0.06, 0.04, 0.4), C.RED, M(TABLE.x + 0.4, Y + 1.13, TABLE.z + 0.2, 0.7), false);
      W(k, cyl(0.15, 0.15, 0.05, 10), C.GOLD, M(TABLE.x - 0.6, Y + 1.13, TABLE.z - 0.3), false);
      W(k, box(0.5, 1.2, 0.4), C.WOOD_D, M(K.x + 2.8, Y + 0.6, K.z + 3.2)); W(k, box(0.7, 0.08, 0.5), 0xe8d6a8, M(K.x + 2.8, Y + 1.25, K.z + 3.2, 0, 0.3), false);
      for (const [dx, dz] of [[-3.6, 3.4], [-3.6, -3.4]]) { W(k, cyl(0.05, 0.05, 1.4, 4), C.IRON, M(K.x + dx, Y + 2.4, K.z + dz), false); W(k, box(0.3, 0.4, 0.3), 0xffd27a, M(K.x + dx, Y + 3.2, K.z + dz), false); } }
    // yard props: the well, crates + barrels, the training dummy + weapon rack
    { const x = F.x - 4, z = F.z + 6; W(k, cyl(1.3, 1.4, 0.9, 12), C.STONE, M(x, Y + 0.45, z)); W(k, cyl(1.0, 1.0, 0.1, 12), 0x2b5d6a, M(x, Y + 0.82, z), false);
      for (const s of [-1, 1]) W(k, box(0.18, 2.2, 0.18), C.WOOD_D, M(x + s * 1.1, Y + 1.6, z), false); W(k, box(2.6, 0.18, 0.2), C.WOOD_D, M(x, Y + 2.7, z), false); }
    for (let i = 0; i < 6; i++) { const x = F.x + 1 + (i % 3) * 1.3, z = F.z - 9.3 + Math.floor(i / 3) * 1.25; W(k, box(1.1, 1.1, 1.1), i % 2 ? C.WOOD : C.WOOD_L, M(x, Y + 0.55, z, hash(i, 2) * 0.4)); }
    { const x = F.x - 9, z = F.z - 8; W(k, cyl(0.12, 0.12, 1.9, 5), C.WOOD_D, M(x, Y + 0.95, z)); W(k, box(1.4, 0.18, 0.18), C.WOOD_D, M(x, Y + 1.5, z), false); W(k, cyl(0.38, 0.32, 0.8, 8), 0xd9c08a, M(x, Y + 1.25, z)); W(k, ball(0.3, 8, 6), 0xd9c08a, M(x, Y + 1.95, z));
      W(k, box(0.2, 1.6, 2.2), C.WOOD_D, M(X0 + wd + 0.3, Y + 0.8, F.z - 8), false); for (let i = 0; i < 4; i++) W(k, box(0.06, 1.5, 0.06), 0xc0c4cc, M(X0 + wd + 0.5, Y + 0.9, F.z - 8.8 + i * 0.5), false); }
    // the 4 cannons on the south wall-walk, pointing out over the bay
    for (let i = 0; i < 4; i++) { const x = F.x - 6 + i * 4, z = Z0 + 1.2; W(k, box(1.0, 0.5, 1.4), C.WOOD_D, M(x, WT + 0.25, z)); W(k, cyl(0.3, 0.38, 2.2, 10), C.IRON, M(x, WT + 0.75, z - 0.5, 0, Math.PI / 2 - 0.05)); }
    // the spyglass on its tripod (NE tower top)
    W(k, cyl(0.05, 0.05, 1.3, 4), C.WOOD_D, M(SPY.x, WT + 0.65, SPY.z), false); W(k, cyl(0.08, 0.13, 1.2, 8), C.GOLD, M(SPY.x, WT + 1.35, SPY.z - 0.3, 0, Math.PI / 2 - 0.25), false);
    near.add(k.build(MATS, OUT));
    // the flag mast: the pirate flag goes up when you RAISE THE COLOURS (today, local)
    const mast = new Kit(); W(mast, cyl(0.12, 0.16, 12, 6), C.WOOD_D, M(MAST.x, Y + 6, MAST.z)); W(mast, ball(0.25, 6, 4), C.GOLD, M(MAST.x, Y + 12.2, MAST.z), false); near.add(mast.build(MATS, OUT));
    const flag = new THREE.Group(); { const kf = new Kit(); W(kf, box(2.6, 1.7, 0.05), 0x111111, M(1.35, 0, 0), false); W(kf, ball(0.38, 8, 6), C.WHITE, M(1.3, 0.12, 0.05, 0, 0, 0, [1, 1, 0.3]), false);
      for (const s of [-1, 1]) W(kf, box(1.2, 0.12, 0.06), C.WHITE, M(1.3, -0.4, 0.05, 0, 0, s * 0.6), false); flag.add(kf.build(MATS, OUT)); }
    flag.position.set(MAST.x, Y + 3, MAST.z); near.add(flag);
    const up = () => store.get().fortFlag === today(); let fy = up() ? 11 : 3, fyT = fy; flag.position.y = Y + fy;
    // far impostor: walls + towers + keep + the stair (one small merged mesh)
    const kf = new Kit(); W(kf, box(F.half * 2, wh + 6, F.half * 2), C.STONE, M(F.x, (WT + 1.2 + base) / 2, F.z), false);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { W(kf, cyl(3.4, 3.8, WT - base, 8), C.STONE, M(F.x + sx * F.half, (WT + base) / 2, F.z + sz * F.half), false); W(kf, new THREE.ConeGeometry(3.9, 3.2, 8), 0x9a3a2a, M(F.x + sx * F.half, WT + 5.2, F.z + sz * F.half), false); }
    W(kf, box(F.keep.half * 2, F.keep.h + 1, F.keep.half * 2), C.STONE_D, M(F.keep.x, Y + (F.keep.h - 1) / 2, F.keep.z), false);
    W(kf, box(LEG1.hw * 2, 6, LEG1.z1 - LEG1.z0), C.STONE, M(LEG1.x, (Y20 + LEG1.y1) / 2 - 2, (LEG1.z0 + LEG1.z1) / 2), false); far.add(kf.build(MATS, OUT));
    return { near, far, flag, raise() { fyT = 11; }, tick(t) { const dt = 1 / 60; if (Math.abs(fyT - fy) > 0.01) { fy += Math.sign(fyT - fy) * Math.min(Math.abs(fyT - fy), 3 * dt); flag.position.y = Y + fy; } flag.rotation.y = Math.sin(t * 1.3) * 0.15; } };
  },
  label(q) { if (q.id === 'fort_flag') return store.get().fortFlag === today() ? 'THE COLOURS ARE FLYING' : 'RAISE THE COLOURS'; return null; },
  activate(q, t, api, b) {
    if (q.id === 'fort_flag') { const first = store.get().fortFlag !== today(); store.upd(o => { o.fortFlag = today(); o.fortFlags = (o.fortFlags || 0) + (first ? 1 : 0); }); b?.raise();
      return first ? `THE JOLLY ROGER FLIES OVER THE FORT!<br><small>raised ${store.get().fortFlags} day${store.get().fortFlags > 1 ? 's' : ''} · come back tomorrow</small>` : 'THE COLOURS ARE ALREADY FLYING<br><small>come back tomorrow</small>'; }
    if (q.id === 'fort_table') { const m = api?.mapSpot?.() || null;
      return `THE WAR-ROOM TABLE<br><small>${m ? 'your treasure map: X marks ' + m : 'an old chart of the island: the cove, the lagoon falls, the jungle temple…'}<br>"Held by the Brethren since the Siege of the Skull: the guns face the bay, the stair faces the town."${AREA_GOLD_ON ? '' : ''}</small>`; }
    if (q.id === 'fort_spyglass') return 'SPYGLASS<br><small>the harbor to the west, the lagoon falls and the jungle temple to the east · the cannons cover the bay</small>';
    return null;
  },
};
export const _fortPending = PENDING;
