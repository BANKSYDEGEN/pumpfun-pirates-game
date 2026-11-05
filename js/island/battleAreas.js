// [Timothy] PUMPFUN PIRATES battle areas. [Emerly coli] pads relocate into the intact colosseum when COLISEUM_ON
// (&coliseum=0 = original west-of-street RANGE + east-of-Squad-Hall PIT). Town-local frame (coast.js).
// Pure data + static art. foot.js: stamp / clearAt / buildArt. Fighting: js/onfoot/battle.js.
import * as THREE from 'three';
import { M } from './kit.js';
import * as CO from './coast.js';
import { COLISEUM_ON, FOOT } from './coliseum.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rectD = (lx, lz, R) => Math.hypot(Math.max(R.lx0 - lx, 0, lx - R.lx1), Math.max(R.lz0 - lz, 0, lz - R.lz1));
function segD(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
const polyD = (lx, lz, P) => { let d = 1e9; for (let i = 0; i < P.length - 1; i++) d = Math.min(d, segD(lx, lz, ...P[i], ...P[i + 1])); return d; };

const RANGE_OLD = { lx0: -126, lx1: -82, lz0: -164, lz1: -124, y: 13.6, flat: 8, feather: 6, line: -131, targetLz: -157, lanes: [-121, -115, -109], divider: -104, gate: [-98, -124], gateW: 6 };
// [Timothy v294] the shell's +lx side came in 8 m (coliseum.js FOOT.lx1 96 -> 88): the range moves 6 m with it and its back stops 4 m
// short of the podium; BANKSY 4:23 PM "incorporate the musket hall and sword pits into coliseum design, make sure can still be walled
// around and be spectated" = chest-high dressed-stone walls on the same lines as the old fence / rope ring (same colliders) + benches.
// [Timothy v300] BANKSY 5:52 PM "rework the inside of coliseum can make the things fit better inside inner circle": both wings sit wholly on
// the sand inside the stone kerb (inner ellipse rx 18.8 / rz 73.8 round cx 61, cz -126) with >= 1.5 m of sand to spare, centred on lx 61,
// and the pink ring walk is never crossed. Range 28 x 28: 3 lanes west of the divider, the duel yard east of it.
const RANGE_COLI = { lx0: 47, lx1: 75, lz0: -164, lz1: -136, y: FOOT.y, flat: 8, feather: 6, line: -143, targetLz: -159, lanes: [50.5, 55, 59.5], railW: 3.0, divider: 62, gate: [62, -136], gateW: 6 };
export const RANGE = COLISEUM_ON ? RANGE_COLI : RANGE_OLD;

const PIT_OLD = { lx: 60, lz: -86, pad: 16, r: 11, flat: 22, y: 6.4, feather: 6 };
const PIT_COLI = { lx: 61, lz: -92, pad: 12.2, r: 9.5, flat: 14, y: FOOT.y, feather: 6 };   // [v300] r 9.5 ring + benches / torches / pennants within 12.3 m, flush with the arena sand (no 0.2 m dip across the ring walk); 18 m concourse to the range
export const PIT = Object.assign({}, COLISEUM_ON ? PIT_COLI : PIT_OLD);
PIT.gateA = COLISEUM_ON ? Math.PI : Math.atan2(46 - PIT.lx, -74 - PIT.lz);   // [v300] coli: the pit gate faces the central concourse (main + battery gates)
export const pitAt = (a, r) => [PIT.lx + Math.sin(a) * r, PIT.lz + Math.cos(a) * r];

export const PATHS = COLISEUM_ON
  ? [[[22, -115], [40, -112], [55, -108], pitAt(PIT.gateA, PIT.r + 4)], [[22, -115], [40, -122], [55, -131], [62, -133]]]
  : [[[-54, -46], [-66, -70], [-86, -100], [-98, -118], [-98, -125]], [[13, -59], [34, -62], pitAt(PIT.gateA, PIT.r + 4), pitAt(PIT.gateA, PIT.r - 1)]];

export const MAIN_ST_SHOPS = [
  { id: 'sword_shop', vendor: 'weapons', tab: 'swords', lx: -6.88, lz: -133.83, yaw: Math.PI / 2, door: [0, 2.2], w: 9.66, d: 9.77, sign: 'SWORD SHOP', label: 'E · SWORD SHOP', empty: 'door_swords' },
  { id: 'musket_shop', vendor: 'weapons', tab: 'muskets', lx: 18.87, lz: -133.83, yaw: -Math.PI / 2, door: [0, 2.2], w: 9.66, d: 9.74, sign: 'MUSKET SHOP', label: 'E · MUSKET SHOP', empty: 'door_muskets' },
];
export const DUMMIES = [[-4.2, -2.5], [4.2, -2.5]].map(([dx, dz]) => { const a = PIT.gateA + Math.PI; const c = Math.cos(a), s = Math.sin(a);
  return { lx: PIT.lx + s * 5 + c * dx, lz: PIT.lz + c * 5 - s * dx, ly: PIT.gateA }; });
export const COVER = COLISEUM_ON
  ? [[65, -146, 'crate'], [71.5, -143.5, 'barrel'], [67.5, -151.5, 'hay'], [72, -150, 'crate'], [64.5, -156.5, 'barrel'], [72.5, -155.5, 'hay'], [68.5, -146.5, 'barrel']]   // [v300] duel yard 63.5-73.5 x -160..-141: lanes, gate + both team spawns clear
  : [[-97, -140, 'crate'], [-89, -136, 'barrel'], [-93, -148, 'hay'], [-86, -152, 'crate'], [-99, -156, 'barrel'], [-88, -144, 'hay'], [-95, -133, 'barrel']];
export const near = (lx, lz) => COLISEUM_ON
  ? (lx > 20 && lx < 110 && lz > -220 && lz < -30)
  : (lx > -150 && lx < 100 && lz > -190 && lz < -38);
export const inRange = (lx, lz, pad = 0) => lx > RANGE.lx0 + pad && lx < RANGE.lx1 - pad && lz > RANGE.lz0 + pad && lz < RANGE.lz1 - pad;
export const onPath = (lx, lz) => { if (!near(lx, lz)) return 0; let d = 1e9; for (const P of PATHS) d = Math.min(d, polyD(lx, lz, P)); return 1 - sm(3.5, 5.5, d); };
export const inPit = (lx, lz, pad = 0) => Math.hypot(lx - PIT.lx, lz - PIT.lz) < PIT.r - pad;

export function stamp(lx, lz, h) {
  if (!near(lx, lz)) return { h, d: 99 };
  const dr = rectD(lx, lz, RANGE); if (dr < RANGE.flat + RANGE.feather) { const w = 1 - sm(RANGE.flat, RANGE.flat + RANGE.feather, dr); h = h * (1 - w) + RANGE.y * w; } // [Emerly] flat 8 m past the fence (like the pit's r22): every 4 / 8 m terrain cell the pad touches is planar, so the drawn ground = the walk height
  const dp = Math.max(0, Math.hypot(lx - PIT.lx, lz - PIT.lz) - PIT.flat); if (dp < PIT.feather) { const w = 1 - sm(0, PIT.feather, dp); h = h * (1 - w) + PIT.y * w; }
  const d = Math.min(dr, Math.max(0, Math.hypot(lx - PIT.lx, lz - PIT.lz) - PIT.pad), ...PATHS.map(P => polyD(lx, lz, P) + 0.6));
  return { h, d };
}
// (2) foliage: nothing on the pads, the paths or a 6 m margin
export function clearAt(lx, lz) {
  if (!near(lx, lz)) return 0;
  return rectD(lx, lz, RANGE) < 8 || Math.hypot(lx - PIT.lx, lz - PIT.lz) < PIT.flat + 4 || PATHS.some(P => polyD(lx, lz, P) < 6) ? 1 : 0;
}

// (3) static art + colliders, merged into the coast kit. o = foot.js buildCoast helpers
export function buildArt(o) {
  const { k, W, box, cyl, T, H, addBox, addCirc, torchPost, barrel, crate, F, C } = o, yaw0 = CO.t2wYaw(0);
  const WOOD = C.WOOD, WOOD_D = C.WOOD_D, ROPE = 0xd9c39a, HAY = 0xe6c35a;
  // fence run from a to b (town-local) at ground y: posts every <= 3 m + 2 rails, one box collider per span
  const fence = (a, b, y, h = 1.15) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 3)), ly = Math.atan2(b[0] - a[0], b[1] - a[1]);
    for (let i = 0; i <= n; i++) { const [x, z] = T(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n); W(k, cyl(0.12, 0.14, h + 0.6, 6), WOOD_D, 2, M(x, y + (h - 0.6) / 2, z)); }
    const [mx, mz] = T((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), wy = CO.t2wYaw(ly);
    for (const ry of [0.45, h - 0.1]) W(k, box(0.1, 0.16, L), WOOD, 2, M(mx, y + ry, mz, wy), false);
    addBox(mx, mz, 0.4, L, wy); };
  // [v294] coliseum: chest-high dressed-stone wall (1.25 m, coping + piers) on the fence line, same single collider per span:
  // walled round, and you watch over it. &coliseum=0 keeps the wooden fence.
  const STN = 0xc4b8a2, STN_L = 0xd3c8b3;
  const wall = (a, b, y, h = 1.25) => { if (!COLISEUM_ON) return fence(a, b, y, h); const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ly = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const [mx, mz] = T((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), wy = CO.t2wYaw(ly);
    W(k, box(0.55, h, L + 0.5), STN, 11, M(mx, y + h / 2 - 0.05, mz, wy)); W(k, box(0.75, 0.16, L + 0.6), STN_L, 11, M(mx, y + h + 0.03, mz, wy), false);
    const n = Math.max(1, Math.round(L / 4)); for (let i = 0; i <= n; i++) { const [x, z] = T(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n); W(k, box(0.8, h + 0.35, 0.8), STN_L, 11, M(x, y + (h + 0.35) / 2, z, wy)); }
    addBox(mx, mz, 0.55, L, wy); };
  const bench = (lx, lz, y, ly) => { const [x, z] = T(lx, lz), wy = CO.t2wYaw(ly);
    k.at(M(x, y, z, wy), () => { W(k, box(3.0, 0.14, 0.55), WOOD, 2, M(0, 0.5, 0)); for (const s of [-1.2, 1.2]) W(k, box(0.14, 0.5, 0.5), WOOD_D, 2, M(s, 0.25, 0), false); }); addBox(x, z, 3.0, 0.6, wy); };
  // ---------------- MUSKET RANGE ----------------
  { const R = RANGE, y = R.y, g0 = R.gate[0] - R.gateW / 2, g1 = R.gate[0] + R.gateW / 2;
    wall([R.lx0, R.lz1], [g0, R.lz1], y); wall([g1, R.lz1], [R.lx1, R.lz1], y);                     // town side, gate gap
    wall([R.lx0, R.lz1], [R.lx0, R.lz0 + 2], y); wall([R.lx1, R.lz1], [R.lx1, R.lz0 + 2], y);      // sides
    if (COLISEUM_ON) for (const lx of [51, 55, 68.5, 72]) bench(lx, R.lz1 + 2.2, y, 0);   // [v294] spectator benches facing the lanes over the town-side wall
    // backstop: earth berm + a plank wall with sandbags along the far end (blocks the walk, catches the balls)
    { const [x, z] = T((R.lx0 + R.lx1) / 2, R.lz0 + 1.2), L = R.lx1 - R.lx0; W(k, box(L, 3.2, 1.0), 0x8a5a2b, 2, M(x, y + 1.0, z, yaw0)); W(k, box(L + 0.3, 0.25, 1.2), WOOD_D, 2, M(x, y + 2.7, z, yaw0), false);
      for (let lx = R.lx0 + 1; lx < R.lx1; lx += 2.2) { const [sx, sz] = T(lx, R.lz0 + 2.0); W(k, new THREE.SphereGeometry(0.55, 7, 5).scale(1.6, 0.6, 0.9), 0xd9c39a, 12, M(sx, y + 0.3, sz, yaw0)); }
      addBox(x, z, L, 2.4, yaw0); }
    // firing line: a waist-high shooting rail in front of each lane (gaps between, you walk through to the yard)
    const RW = R.railW || 4.2;   // [v300] coli lanes are 4.5 m apart: 3 m rails, walk-through gaps between
    for (const lx of R.lanes) { const [x, z] = T(lx, R.line); W(k, box(RW, 0.14, 0.5), WOOD, 2, M(x, y + 1.05, z, yaw0)); for (const s of [-(RW / 2 - 0.2), RW / 2 - 0.2]) { const [px, pz] = T(lx + s, R.line); W(k, cyl(0.1, 0.12, 1.05, 6), WOOD_D, 2, M(px, y + 0.52, pz), false); addCirc(px, pz, 0.2); }
      const [mx, mz] = T(lx, R.line + 0.05); addBox(mx, mz, RW - 0.6, 0.45, yaw0);
      // target stand: two posts + a cross beam (the board itself hangs from it: js/onfoot/battle.js, it flips when hit)
      for (const s of [-0.95, 0.95]) { const [px, pz] = T(lx + s, R.targetLz - 0.2); W(k, cyl(0.09, 0.1, 2.5, 6), WOOD_D, 2, M(px, y + 1.25, pz)); addCirc(px, pz, 0.18); }
      { const [bx, bz] = T(lx, R.targetLz - 0.2); W(k, box(2.2, 0.14, 0.14), WOOD_D, 2, M(bx, y + 2.45, bz, yaw0), false); }
      // lane marker stones
      const [sx, sz] = T(lx, R.line + 2.2); W(k, box(0.6, 0.12, 0.6), C.STONE, 11, M(sx, y + 0.04, sz, yaw0), false); }
    // lane divider rail between the lanes and the duel yard (the yard side is open by the gate)
    fence([R.divider, R.line - 1], [R.divider, R.lz0 + 3], y, 0.9);
    // duel yard cover: crates, barrels, hay bales (solid)
    for (const [lx, lz, kind] of COVER) { const [x, z] = T(lx, lz);
      if (kind === 'crate') { crate(k, M(x, y, z, yaw0 + 0.3), 1.4); addBox(x, z, 1.5, 1.5, yaw0 + 0.3); }
      else if (kind === 'barrel') { barrel(k, M(x, y, z)); addCirc(x, z, 0.75); }
      else { W(k, box(2.4, 1.1, 1.2), HAY, 12, M(x, y + 0.55, z, yaw0 + 0.15)); for (const s of [-0.6, 0.6]) W(k, box(0.06, 1.14, 1.24), 0x8a5a2b, 2, M(...(([a, b]) => [a, y + 0.55, b])(T(lx + s, lz)), yaw0 + 0.15), false); addBox(x, z, 2.4, 1.2, yaw0 + 0.15); } }
    // gate: two posts + a cross beam (the MUSKET RANGE board hangs from it), torches either side, a musket stand
    for (const s of [-1, 1]) { const [px, pz] = T(R.gate[0] + s * (R.gateW / 2 + 0.2), R.lz1); W(k, cyl(0.2, 0.24, 4.4, 8), WOOD_D, 2, M(px, y + 2.2, pz)); addCirc(px, pz, 0.3);
      const [tx, tz] = T(R.gate[0] + s * (R.gateW / 2 + 1.4), R.lz1 + 1.2); torchPost(k, F, tx, y, tz); addCirc(tx, tz, 0.2); }
    { const [bx, bz] = T(R.gate[0], R.lz1); W(k, box(R.gateW + 1.4, 0.3, 0.3), WOOD_D, 2, M(bx, y + 4.2, bz, yaw0)); }
    for (const [lx, lz] of [[R.lx0 + 1, R.lz0 + 4], [R.lx1 - 1, R.lz0 + 4], [R.divider, R.line - 1.5]]) { const [x, z] = T(lx, lz); torchPost(k, F, x, y, z); addCirc(x, z, 0.2); }
    { const MS = COLISEUM_ON ? R.lx1 - 2.5 : R.gate[0] + 6, [x, z] = T(MS, R.lz1 - 2.2); /* [v300] coli: musket stand in the yard corner, clear of the team spawn */ W(k, box(2.2, 0.12, 0.5), WOOD, 2, M(x, y + 0.5, z, yaw0)); W(k, box(2.2, 0.12, 0.5), WOOD, 2, M(x, y + 1.3, z, yaw0)); for (const s of [-1, 1]) { const [px, pz] = T(MS + s, R.lz1 - 2.2); W(k, box(0.12, 1.5, 0.5), WOOD_D, 2, M(px, y + 0.75, pz, yaw0), false); } addBox(x, z, 2.3, 0.6, yaw0); }
  }
  // ---------------- SWORD PIT ----------------
  { const P = PIT, y = P.y, ga = P.gateA, gap = 0.2;   // gate half-angle (~2.2 m opening at r11)
    // rope ring: posts round the pit, two ropes per span, the gate open; a box collider per span
    const n = 24; for (let i = 0; i < n; i++) { const a0 = ga + gap + (i / n) * (Math.PI * 2 - 2 * gap), a1 = ga + gap + ((i + 1) / n) * (Math.PI * 2 - 2 * gap);
      if (COLISEUM_ON) { const [ax, az] = pitAt(a0, P.r), [bx, bz] = pitAt(a1, P.r), [mx, mz] = T((ax + bx) / 2, (az + bz) / 2), L = Math.hypot(bx - ax, bz - az), wy = CO.t2wYaw(Math.atan2(bx - ax, bz - az));
        W(k, box(0.5, 0.95, L + 0.3), STN, 11, M(mx, y + 0.42, mz, wy)); W(k, box(0.68, 0.14, L + 0.35), STN_L, 11, M(mx, y + 0.95, mz, wy), false); }   // [v294] stone ring wall under the ropes
      const [px, pz] = T(...pitAt(a0, P.r)); W(k, cyl(0.13, 0.15, 1.5, 6), WOOD_D, 2, M(px, y + 0.75, pz)); W(k, new THREE.SphereGeometry(0.16, 6, 4), WOOD, 2, M(px, y + 1.52, pz), false); addCirc(px, pz, 0.22);
      if (i === n - 1) { const [qx, qz] = T(...pitAt(a1, P.r)); W(k, cyl(0.13, 0.15, 1.5, 6), WOOD_D, 2, M(qx, y + 0.75, qz)); addCirc(qx, qz, 0.22); }
      const [ax, az] = pitAt(a0, P.r), [bx, bz] = pitAt(a1, P.r), [mx, mz] = T((ax + bx) / 2, (az + bz) / 2), L = Math.hypot(bx - ax, bz - az), wy = CO.t2wYaw(Math.atan2(bx - ax, bz - az));
      for (const ry of [0.65, 1.25]) W(k, cyl(0.04, 0.04, L, 5), ROPE, 12, M(mx, y + ry, mz, wy, Math.PI / 2), false);
      addBox(mx, mz, 0.35, L, wy); }
    // gate arch (the SWORD PIT board hangs from it) + torches
    for (const s of [-1, 1]) { const [px, pz] = T(...pitAt(ga + s * (gap + 0.03), P.r + 0.2)); W(k, cyl(0.2, 0.24, 4.2, 8), WOOD_D, 2, M(px, y + 2.1, pz)); addCirc(px, pz, 0.3); }
    { const [mx, mz] = T(...pitAt(ga, P.r + 0.2)); W(k, box(3.6, 0.3, 0.3), WOOD_D, 2, M(mx, y + 4.05, mz, CO.t2wYaw(ga))); }
    for (let i = 0; i < 4; i++) { const [x, z] = T(...pitAt(ga + Math.PI / 4 + i * Math.PI / 2, P.pad - 1.2)); torchPost(k, F, x, y, z); addCirc(x, z, 0.2); }
    // benches on the pad (spectators), skipping the gate side
    for (const a of [ga + 1.15, ga + 1.85, ga + Math.PI - 0.35, ga + Math.PI + 0.35, ga - 1.85, ga - 1.15]) { const [x, z] = T(...pitAt(a, P.r + (COLISEUM_ON ? 2.0 : 2.4))), wy = CO.t2wYaw(a);
      k.at(M(x, y, z, wy), () => { W(k, box(3.0, 0.14, 0.55), WOOD, 2, M(0, 0.5, 0)); for (const s of [-1.2, 1.2]) W(k, box(0.14, 0.5, 0.5), WOOD_D, 2, M(s, 0.25, 0), false); }); addBox(x, z, 3.0, 0.6, wy); }
    // training dummies: post + cross arm (the straw body wobbles: js/onfoot/battle.js), solid
    for (const d of DUMMIES) { const [x, z] = T(d.lx, d.lz); W(k, cyl(0.1, 0.12, 2.0, 6), WOOD_D, 2, M(x, y + 1.0, z)); W(k, box(0.3, 0.12, 0.3), WOOD_D, 2, M(x, y + 0.06, z), false); addCirc(x, z, 0.45); }
    // pennant poles at the pad edge
    for (const a of (COLISEUM_ON ? [ga + 1.5, ga - 1.5, ga + Math.PI] : [ga + 0.75, ga - 0.75, ga + Math.PI])) { const [x, z] = T(...pitAt(a, P.pad - 0.6)); W(k, cyl(0.07, 0.09, 6, 6), WOOD_D, 2, M(x, y + 3, z)); W(k, box(0.04, 0.9, 1.4), 0xd8322f, 0, M(x, y + 5.4, z + 0.7, yaw0), false); addCirc(x, z, 0.15); }
  }
}
