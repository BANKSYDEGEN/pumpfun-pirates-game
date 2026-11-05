// [Emerly] PUMPFUN PIRATES intact colosseum (BANKSY approved 11:39 AM Nov 5): pink footprint east of Hill Street,
// down to the back of Fish Market / plaza #5–7. Kill switch: &coliseum=0 restores the pre-coli layout (old battle pads,
// red/blue stalls, quay leaderboards). Town-local frame (coast.js). Static art merges into the coast kit.
import * as THREE from 'three';
import { M } from './kit.js';
import * as CO from './coast.js';

export const COLISEUM_ON = !(typeof location !== 'undefined' && /[?&]coliseum=0(&|$)/.test(location.search));

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rectD = (lx, lz, R) => Math.hypot(Math.max(R.lx0 - lx, 0, lx - R.lx1), Math.max(R.lz0 - lz, 0, lz - R.lz1));

// Outer footprint (town-local): east of Hill Street, dock end at plaza shop backs (lz -44), castle end near roundabout.
export const FOOT = { lx0: 34, lx1: 96, lz0: -208, lz1: -44, y: 9.2, feather: 8, wall: 3.2, walk: 4.5, tiers: 3 };
// Main entrance (remove stall_red/blue): between #36/#37 on east Hill Street
export const MAIN_GATE = { lx: 34, lz: -115, w: 9, d: 12 };
// Castle exit: arched gate → ≥4 m near-level stone ramp to castle approach (avoids LEG1 x=-434 / fort wall)
export const CASTLE_GATE = { lx: 51.6, lz: -200, w: 6 }; // [Timothy v273] on the shell ring (was lx 38 lz -205: off the ring, no opening)
export const CASTLE_JOIN = { lx: 46, lz: -210 }; // joins approach below castle
export const CASTLE_RAMP_HW = 3.2; // [Timothy v273] wide stone stair (BANKSY: clean wide stair)
// Cannon Hill / Cliff Battery exit (seaward-east)
export const BATTERY_GATE = { lx: 94, lz: -120, w: 4.5 };
// Empty rentable stores (next free numbers #45 / #46). #45 south of #20 = 1 storey, roof ≤ 2.8 m.
export const NEW_STORES = [
  { id: 'coli_store_45', n: 45, lx: -10.0, lz: -56.5, w: 16, d: 21, storeys: 1, maxRoof: 2.8, yaw: Math.PI / 2, label: 'EMPTY SHOP' },
  { id: 'coli_store_46', n: 46, lx: 22.0, lz: -56.5, w: 16, d: 21, storeys: 2, maxRoof: 0, yaw: -Math.PI / 2, label: 'EMPTY SHOP' },
];
// Leaderboards remounted on plaza side walls facing Hill Street mouth (boards only; scores untouched)
export const BOARD_POIS = [
  { id: 'waves', label: 'STORM HUNT board', lx: -4.2, lz: -36, yaw: Math.PI / 2 },   // #4 SHIPS east wall
  { id: 'arena', label: 'ARENA board', lx: 14.8, lz: -36, yaw: -Math.PI / 2 },       // #5 UPGRADES west wall
];

export const near = (lx, lz) => COLISEUM_ON && lx > FOOT.lx0 - 12 && lx < FOOT.lx1 + 8 && lz > FOOT.lz0 - 12 && lz < FOOT.lz1 + 8;

export function inFoot(lx, lz, pad = 0) {
  return lx > FOOT.lx0 + pad && lx < FOOT.lx1 - pad && lz > FOOT.lz0 + pad && lz < FOOT.lz1 - pad;
}

export function stamp(lx, lz, h) {
  if (!near(lx, lz)) return { h, d: 99 };
  const d = rectD(lx, lz, FOOT);
  if (d < FOOT.feather) {
    const w = 1 - sm(0, FOOT.feather, d);
    h = h * (1 - w) + FOOT.y * w;
  }
  // flatten main-gate throat onto the street
  const dg = Math.hypot(lx - MAIN_GATE.lx, lz - MAIN_GATE.lz);
  if (dg < MAIN_GATE.w) {
    const w = 1 - sm(MAIN_GATE.w * 0.4, MAIN_GATE.w, dg);
    h = h * (1 - w) + FOOT.y * w;
  }
  // castle ramp ribbon (near-level)
  const rx0 = CASTLE_GATE.lx, rz0 = CASTLE_GATE.lz, rx1 = CASTLE_JOIN.lx, rz1 = CASTLE_JOIN.lz;
  const rdx = rx1 - rx0, rdz = rz1 - rz0, rL = Math.hypot(rdx, rdz) || 1;
  const t = Math.max(0, Math.min(1, ((lx - rx0) * rdx + (lz - rz0) * rdz) / (rL * rL)));
  const cx = rx0 + rdx * t, cz = rz0 + rdz * t;
  const rd = Math.hypot(lx - cx, lz - cz);
  if (rd < CASTLE_RAMP_HW + 1.2) {
    const w = 1 - sm(CASTLE_RAMP_HW, CASTLE_RAMP_HW + 1.2, rd);
    const yR = FOOT.y + (20.1 - FOOT.y) * t; // ease toward roundabout deck
    h = h * (1 - w) + yR * w;
  }
  return { h, d: Math.min(d, dg, rd) };
}

export function clearAt(lx, lz) {
  if (!near(lx, lz)) return 0;
  if (rectD(lx, lz, FOOT) < 6) return 1;
  if (Math.hypot(lx - MAIN_GATE.lx, lz - MAIN_GATE.lz) < MAIN_GATE.w + 2) return 1;
  for (const s of NEW_STORES) {
    if (Math.abs(lx - s.lx) < s.d / 2 + 2 && Math.abs(lz - s.lz) < s.w / 2 + 2) return 1;
  }
  return 0;
}

// [Timothy v273] plaza-quality art pass: intact Roman shell in dressed stone (look layer 11, same as the plaza / fort), true round
// arches on every tier, attic + crenellated parapet, continuous cobbled ring walk, stepped seating podium, sand arena floor,
// arched gates, a wide stepped stair to the castle. Colliders: outer wall + podium + gate piers only (arena floor / stair / ring walk open).
export function buildArt(o) {
  if (!COLISEUM_ON) return;
  const { k, W, box, cyl, T, H, addBox, addCirc, torchPost, F, C } = o;
  const ST = 0xc4b8a2, ST_L = 0xd3c8b3, ST_D = 0x8f8474, SAND = 0xd4bc8c, COB = 0xc9a090, WOOD_D = C.WOOD_D || 0x6b4527;
  const DS = 11, CB = 10, SA = 0; // look layers: dressed stone, cobbles, sand
  const F0 = FOOT, cx = (F0.lx0 + F0.lx1) / 2, cz = (F0.lz0 + F0.lz1) / 2;
  const rx = (F0.lx1 - F0.lx0) / 2, rz = (F0.lz1 - F0.lz0) / 2;
  const y0 = F0.y, tierH = 3.6, N = 48, wt = 1.85, Y0W = CO.t2wYaw(0);
  const P = (a, off = 0) => T(cx + Math.cos(a) * (rx - off), cz + Math.sin(a) * (rz - off));
  const seg = (i, off = 0) => { const a0 = i / N * 2 * Math.PI, a1 = (i + 1) / N * 2 * Math.PI, am = (a0 + a1) / 2;
    const [x0, z0] = P(a0, off), [x1, z1] = P(a1, off), [xm, zm] = P(am, off);
    return { a0, am, x0, z0, xm, zm, span: Math.hypot(x1 - x0, z1 - z0), yaw: Math.atan2(-(z1 - z0), x1 - x0) }; };
  const gateHit = (i) => { const am = (i + 0.5) / N * 2 * Math.PI, lx = cx + Math.cos(am) * rx, lz = cz + Math.sin(am) * rz;
    for (const g of [MAIN_GATE, CASTLE_GATE, BATTERY_GATE]) if (Math.hypot(lx - g.lx, lz - g.lz) < Math.max(g.w, 5.5)) return g; return null; };
  const archG = (r, tube) => new THREE.TorusGeometry(r, tube, 4, 10, Math.PI);
  const arch = (x, y, z, yaw, r, tube = 0.28, depth = 1) => { // archivolt ring + keystone, standing in the wall plane
    const g = archG(r, tube); g.scale(1, 1, depth / tube / 2); W(k, g, ST_L, DS, M(x, y, z, yaw), false);
    W(k, box(0.5, 0.7, depth + 0.1), ST_L, DS, M(x, y + r + 0.15, z, yaw), false); };

  // sand arena floor (ellipse, open) + low kerb where the ring walk meets it
  { const [x, z] = T(cx, cz), g = new THREE.CylinderGeometry(1, 1, 0.2, 40); g.scale(rx - 8.2, 1, rz - 8.2);
    W(k, g, SAND, SA, M(x, y0 + 0.06, z, Y0W), false); }
  for (let i = 0; i < N; i++) { const s = seg(i, 8.1); W(k, box(s.span * 1.04, 0.22, 0.5), ST_D, DS, M(s.xm, y0 + 0.1, s.zm, s.yaw), false); }

  // plan colors: soft yellow musket pad (castle end) + purple sword pad (dock end) on the sand
  { const YEL = 0xd4b85a, PUR = 0x8a6aad;
    const [mx, mz] = T(69, -158); W(k, box(34, 0.08, 30), YEL, SA, M(mx, y0 + 0.1, mz, Y0W), false);
    const [px, pz] = T(70, -78); W(k, new THREE.CylinderGeometry(12, 12, 0.08, 28), PUR, SA, M(px, y0 + 0.1, pz), false); }

  // continuous cobbled ring walk (pink) between the podium and the arena
  for (let i = 0; i < N; i++) { const s = seg(i, 5.6); W(k, box(s.span * 1.06, 0.16, 4.6), COB, CB, M(s.xm, y0 + 0.07, s.zm, s.yaw), false); }

  // seating podium + stepped cavea against the shell (solid stone, colliding front)
  for (let i = 0; i < N; i++) {
    if (gateHit(i)) continue;
    for (let r = 0; r < 4; r++) { const s = seg(i, 3.3 - r * 0.6), h = 1.2 + r * 1.1;
      W(k, box(s.span * 1.05, h, 0.7), r % 2 ? ST : ST_L, DS, M(s.xm, y0 + h / 2, s.zm, s.yaw), r === 0); }
    const s = seg(i, 3.1); addBox(s.xm, s.zm, s.span * 1.02, 1.0, s.yaw);
    if (i % 3 === 0) { const t = seg(i, 3.9); torchPost?.(k, F, t.xm, y0, t.zm); addCirc(t.xm, t.zm, 0.25); }
  }

  // outer shell: 3 arcaded tiers + attic + parapet with merlons
  for (let i = 0; i < N; i++) {
    const s = seg(i), g = gateHit(i), [px, pz] = [s.x0, s.z0];
    const totH = F0.tiers * tierH + 2.6;
    // pier + engaged half-column — skip if the pier sits inside a gate opening (gateArt owns those piers)
    const pierInGate = (() => { const lx = cx + Math.cos(s.a0) * rx, lz = cz + Math.sin(s.a0) * rz;
      for (const gg of [MAIN_GATE, CASTLE_GATE, BATTERY_GATE]) if (Math.hypot(lx - gg.lx, lz - gg.lz) < gg.w * 0.55) return true; return false; })();
    if (!pierInGate) {
      W(k, box(1.5, totH, wt + 0.3), ST, DS, M(px, y0 + totH / 2, pz, s.yaw));
      { const [wx, wz] = T(cx, cz), dx = px - wx, dz = pz - wz, dl = Math.hypot(dx, dz) || 1; W(k, cyl(0.42, 0.46, totH - 0.4, 8), ST_L, DS, M(px + dx / dl * 0.95, y0 + totH / 2, pz + dz / dl * 0.95), false); }
      addBox(px, pz, 1.6, wt + 0.4, s.yaw);
    }
    if (g) { // attic/cornice/merlons still crown the gate bay; arches/fill come from gateArt
      const ay = y0 + F0.tiers * tierH;
      W(k, box(s.span * 1.02, 2.2, wt), ST, DS, M(s.xm, ay + 1.1, s.zm, s.yaw), false);
      W(k, box(s.span * 1.04, 0.4, wt + 0.7), ST_D, DS, M(s.xm, ay + 2.3, s.zm, s.yaw), false);
      for (const f of [-0.25, 0.25]) W(k, box(s.span * 0.28, 0.9, wt), ST_L, DS, M(s.xm + Math.cos(s.yaw) * s.span * f, ay + 2.95, s.zm - Math.sin(s.yaw) * s.span * f, s.yaw), false);
      continue;
    }
    const open = s.span - 1.5, r = Math.min(open / 2, 1.5);
    for (let ti = 0; ti < F0.tiers; ti++) {
      const ty = y0 + ti * tierH, spring = ty + tierH - 0.75 - r;
      // spandrel above the arch + string course
      W(k, box(open, tierH - (spring - ty) - r, wt), ST, DS, M(s.xm, (spring + r + ty + tierH) / 2, s.zm, s.yaw), false);
      W(k, box(s.span * 1.02, 0.32, wt + 0.5), ST_D, DS, M(s.xm, ty + tierH - 0.1, s.zm, s.yaw), false);
      arch(s.xm, spring, s.zm, s.yaw, r, 0.22, wt + 0.1);
      if (ti === 0) { // intact ground storey: solid infill behind the archivolt (no see-through), arch reads as relief
        W(k, box(open, Math.max(0.4, spring + r - ty), wt * 0.85), ST_D, DS, M(s.xm, (ty + spring + r) / 2, s.zm, s.yaw), false);
        addBox(s.xm, s.zm, s.span, wt, s.yaw);
      }
    }
    // attic (solid) + cornice + merlons
    const ay = y0 + F0.tiers * tierH;
    W(k, box(s.span * 1.02, 2.2, wt), ST, DS, M(s.xm, ay + 1.1, s.zm, s.yaw), false);
    W(k, box(s.span * 1.04, 0.4, wt + 0.7), ST_D, DS, M(s.xm, ay + 2.3, s.zm, s.yaw), false);
    for (const f of [-0.25, 0.25]) W(k, box(s.span * 0.28, 0.9, wt), ST_L, DS, M(s.xm + Math.cos(s.yaw) * s.span * f, ay + 2.95, s.zm - Math.sin(s.yaw) * s.span * f, s.yaw), false);
  }

  // arched gate bays (wide, clean) on the ring: main (Hill Street), castle, battery
  const gateArt = (g, label) => {
    const lx = g.lx, lz = g.lz, a = Math.atan2((lz - cz) / rz, (lx - cx) / rx);
    const [x, z] = P(a), [x2, z2] = P(a + 0.01), yaw = Math.atan2(-(z2 - z), x2 - x), w = g.w, ca = Math.cos(yaw), sa = Math.sin(yaw);
    const gh = 5.2;
    for (const sd of [-1, 1]) { const px = x + ca * sd * (w / 2 + 0.9), pz = z - sa * sd * (w / 2 + 0.9);
      W(k, box(1.8, gh, wt + 0.8), ST, DS, M(px, y0 + gh / 2, pz, yaw)); addBox(px, pz, 1.8, wt + 0.8, yaw); }
    arch(x, y0 + gh, z, yaw, w / 2 + 0.2, 0.4, wt + 0.8);
    W(k, box(w + 3.6, F0.tiers * tierH - gh - w / 2 - 0.4, wt), ST, DS, M(x, (y0 + gh + w / 2 + 0.4 + y0 + F0.tiers * tierH) / 2, z, yaw), false);
    if (label) W(k, box(Math.min(w, 5), 0.9, 0.2), WOOD_D, 2, M(x - Math.cos(a) * 0, y0 + F0.tiers * tierH - 1.2, z, yaw), false);
  };
  gateArt(MAIN_GATE, true); gateArt(CASTLE_GATE, false); gateArt(BATTERY_GATE, false);

  // castle exit: wide stepped stair gate → approach, cheek walls each side (stair itself open)
  { const g = CASTLE_GATE, j = CASTLE_JOIN, [gx, gz] = T(g.lx, g.lz), [jx, jz] = T(j.lx, j.lz);
    const L = Math.hypot(jx - gx, jz - gz), yaw = Math.atan2(-(jz - gz), jx - gx), dirx = (jx - gx) / L, dirz = (jz - gz) / L;
    const n = Math.max(6, Math.round(L / 0.9)), hw = CASTLE_RAMP_HW;
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = gx + (jx - gx) * t, z = gz + (jz - gz) * t, y = H(x, z);
      // tread: short along ramp (box.x), wide across (box.z); yaw faces along ramp so cheeks sit on the long edges
      W(k, box(L / n + 0.08, 0.55, hw * 2), i % 2 ? ST : ST_L, DS, M(x, y - 0.15, z, yaw), false); }
    for (const sd of [-1, 1]) for (let i = 0; i < n; i++) { const t = (i + 0.5) / n;
      const x = gx + (jx - gx) * t - dirz * sd * (hw + 0.4), z = gz + (jz - gz) * t + dirx * sd * (hw + 0.4), y = H(x, z);
      W(k, box(L / n + 0.06, 1.3, 0.6), ST_D, DS, M(x, y + 0.2, z, yaw), false); addBox(x, z, L / n, 0.6, yaw); }
  }

  // new empty store shells (dressed stone, cornice); #45 stays one storey under 2.8 m so the Treasure sign reads
  for (const s of NEW_STORES) {
    const [x, z] = T(s.lx, s.lz), y = H(x, z), yaw = CO.t2wYaw(s.yaw);
    const h = s.storeys === 1 ? Math.min(2.75, s.maxRoof || 2.8) : 6.2;
    W(k, box(s.w, h - 0.3, s.d), ST, DS, M(x, y + (h - 0.3) / 2, z, yaw));
    W(k, box(s.w + 0.5, 0.3, s.d + 0.5), ST_D, DS, M(x, y + h - 0.15, z, yaw), false);
    W(k, box(s.w + 0.2, 0.5, s.d + 0.2), ST_D, DS, M(x, y + 0.25, z, yaw), false);
    addBox(x, z, s.w + 0.4, s.d + 0.4, yaw);
  }
}
