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
export const MAIN_GATE = { lx: 28, lz: -115, w: 8, d: 10 };
// Castle exit: arched gate → ≥4 m near-level stone ramp to castle approach (avoids LEG1 x=-434 / fort wall)
export const CASTLE_GATE = { lx: 38, lz: -205, w: 4.5 };
export const CASTLE_JOIN = { lx: 46, lz: -210 }; // joins approach below castle
export const CASTLE_RAMP_HW = 2.25;
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

// Intact Roman-style shell: elliptical ring of arches, 3 tiers, full walls, clean stone. Merged into coast kit.
export function buildArt(o) {
  if (!COLISEUM_ON) return;
  const { k, W, box, cyl, T, H, addBox, addCirc, torchPost, F, C } = o;
  const STONE = C.STONE || 0xb9a990, STONE_D = C.STONE_D || 0x8a7a66, WOOD = C.WOOD || 0xb06a36, WOOD_D = C.WOOD_D || 0x7b4524;
  const F0 = FOOT, cx = (F0.lx0 + F0.lx1) / 2, cz = (F0.lz0 + F0.lz1) / 2;
  const rx = (F0.lx1 - F0.lx0) / 2, rz = (F0.lz1 - F0.lz0) / 2;
  const y0 = F0.y, wallH = 11.5, tierH = 3.6, archN = 28;

  // Arena floor pad (sand)
  {
    const [x, z] = T(cx, cz), y = H(x, z);
    W(k, new THREE.CylinderGeometry(Math.min(rx, rz) - F0.wall - F0.walk - 1, Math.min(rx, rz) - F0.wall - F0.walk - 1, 0.35, 32), 0xc2a87a, 3, M(x, y + 0.1, z), false);
    addCirc(x, z, Math.min(rx, rz) - F0.wall - F0.walk);
  }

  // Outer wall + tiered arcades (instanced arch rhythm via repeated kit pieces → merged)
  for (let ti = 0; ti < F0.tiers; ti++) {
    const ty = y0 + ti * tierH;
    for (let i = 0; i < archN; i++) {
      const a0 = (i / archN) * Math.PI * 2, a1 = ((i + 1) / archN) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const lx0 = cx + Math.cos(a0) * rx, lz0 = cz + Math.sin(a0) * rz;
      const lx1 = cx + Math.cos(a1) * rx, lz1 = cz + Math.sin(a1) * rz;
      const lxm = cx + Math.cos(am) * rx, lzm = cz + Math.sin(am) * rz;
      // skip main / castle / battery gate openings on ground tier
      const skipMain = ti === 0 && Math.hypot(lxm - MAIN_GATE.lx, lzm - MAIN_GATE.lz) < MAIN_GATE.w * 0.85;
      const skipCastle = ti === 0 && Math.hypot(lxm - CASTLE_GATE.lx, lzm - CASTLE_GATE.lz) < CASTLE_GATE.w;
      const skipBat = ti === 0 && Math.hypot(lxm - BATTERY_GATE.lx, lzm - BATTERY_GATE.lz) < BATTERY_GATE.w;
      if (skipMain || skipCastle || skipBat) continue;
      const [x0, z0] = T(lx0, lz0), [x1, z1] = T(lx1, lz1), [xm, zm] = T(lxm, lzm);
      const yaw = Math.atan2(x1 - x0, z1 - z0);
      const span = Math.hypot(x1 - x0, z1 - z0);
      // pier
      W(k, box(1.1, tierH - 0.15, 1.1), STONE_D, 3, M(x0, ty + tierH / 2, z0));
      addBox(x0, z0, 1.2, 1.2, yaw);
      // arch lintel / vault hint
      W(k, box(span * 0.92, 0.45, 1.0), STONE, 3, M(xm, ty + tierH - 0.35, zm, yaw), false);
      if (ti === 0) {
        // solid lower wall between piers (intact, not ruined)
        W(k, box(span * 0.7, 2.2, 0.85), STONE, 3, M(xm, ty + 1.15, zm, yaw));
        addBox(xm, zm, 0.9, span * 0.7, yaw);
      } else {
        // open arcade arch (clean stone)
        W(k, box(0.35, tierH - 0.8, 0.85), STONE, 3, M(xm - Math.sin(yaw) * span * 0.28, ty + (tierH - 0.8) / 2 + 0.3, zm - Math.cos(yaw) * span * 0.28, yaw), false);
        W(k, box(0.35, tierH - 0.8, 0.85), STONE, 3, M(xm + Math.sin(yaw) * span * 0.28, ty + (tierH - 0.8) / 2 + 0.3, zm + Math.cos(yaw) * span * 0.28, yaw), false);
      }
    }
  }
  // Cornice / top rail all the way round (intact crown)
  for (let i = 0; i < archN; i++) {
    const a0 = (i / archN) * Math.PI * 2, a1 = ((i + 1) / archN) * Math.PI * 2, am = (a0 + a1) / 2;
    const lxm = cx + Math.cos(am) * (rx + 0.2), lzm = cz + Math.sin(am) * (rz + 0.2);
    const [xm, zm] = T(lxm, lzm);
    const yaw = am + Math.PI / 2;
    const span = Math.hypot(Math.cos(a1) * rx - Math.cos(a0) * rx, Math.sin(a1) * rz - Math.sin(a0) * rz);
    W(k, box(span * 0.98, 0.55, 1.35), STONE_D, 3, M(xm, y0 + F0.tiers * tierH + 0.2, zm, yaw), false);
  }

  // Inner walkway ring (concourse)
  const walkR = Math.min(rx, rz) - F0.wall - F0.walk / 2;
  for (let i = 0; i < archN; i++) {
    const a = (i / archN) * Math.PI * 2;
    const lx = cx + Math.cos(a) * walkR, lz = cz + Math.sin(a) * walkR;
    const [x, z] = T(lx, lz), y = H(x, z);
    W(k, box(F0.walk, 0.25, 3.2), 0xa89878, 3, M(x, y + 0.05, z, a), false);
    if (i % 2 === 0) { torchPost?.(k, F, x, y, z); addCirc(x, z, 0.25); }
  }

  // Main gate throat (Hill Street)
  {
    const g = MAIN_GATE, [x, z] = T(g.lx, g.lz), y = H(x, z), yaw = CO.t2wYaw(0);
    for (const s of [-1, 1]) {
      const [px, pz] = T(g.lx + s * (g.w / 2 + 0.8), g.lz);
      W(k, box(2.2, 7.5, 2.2), STONE_D, 3, M(px, y + 3.7, pz));
      addBox(px, pz, 2.4, 2.4, yaw);
    }
    W(k, box(g.w + 2.5, 1.4, 2.0), STONE, 3, M(x, y + 7.2, z, yaw));
    // signboard
    W(k, box(4.5, 1.0, 0.2), WOOD_D, 2, M(x, y + 5.6, z + 1.3, yaw), false);
  }

  // Castle exit arched gate + ramp deck
  {
    const g = CASTLE_GATE, j = CASTLE_JOIN;
    const [gx, gz] = T(g.lx, g.lz), gy = H(gx, gz);
    for (const s of [-1, 1]) {
      const [px, pz] = T(g.lx + s * (g.w / 2 + 0.7), g.lz);
      W(k, box(1.8, 6.5, 1.8), STONE_D, 3, M(px, gy + 3.2, pz));
      addBox(px, pz, 2.0, 2.0, 0);
    }
    W(k, box(g.w + 1.6, 1.2, 1.6), STONE, 3, M(gx, gy + 6.2, gz));
    // ramp slabs toward join
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lx = g.lx + (j.lx - g.lx) * t, lz = g.lz + (j.lz - g.lz) * t;
      const [x, z] = T(lx, lz), y = H(x, z);
      W(k, box(CASTLE_RAMP_HW * 2, 0.3, 2.4), STONE, 3, M(x, y + 0.08, z, Math.atan2(j.lx - g.lx, j.lz - g.lz)), false);
      addBox(x, z, CASTLE_RAMP_HW * 2, 2.2, Math.atan2(j.lx - g.lx, j.lz - g.lz));
    }
  }

  // Cannon Hill / battery exit
  {
    const g = BATTERY_GATE, [x, z] = T(g.lx, g.lz), y = H(x, z);
    for (const s of [-1, 1]) {
      const [px, pz] = T(g.lx, g.lz + s * (g.w / 2 + 0.7));
      W(k, box(1.8, 5.5, 1.8), STONE_D, 3, M(px, y + 2.7, pz));
      addBox(px, pz, 2.0, 2.0, 0);
    }
    W(k, box(1.6, 1.0, g.w + 1.6), STONE, 3, M(x, y + 5.2, z));
  }

  // New empty store shells
  for (const s of NEW_STORES) {
    const [x, z] = T(s.lx, s.lz), y = H(x, z), yaw = CO.t2wYaw(s.yaw);
    const h = s.storeys === 1 ? Math.min(2.75, s.maxRoof || 2.8) : 6.2;
    W(k, box(s.w, h, s.d), STONE, 3, M(x, y + h / 2, z, yaw));
    W(k, box(s.w + 0.4, 0.35, s.d + 0.4), STONE_D, 3, M(x, y + h + 0.1, z, yaw), false); // roof slab (treasure-side stays under 2.8)
    // open door gap collider: solid footprint with a throat
    addBox(x, z, s.w + 0.4, s.d + 0.4, yaw);
    const [dx, dz] = T(s.lx + Math.sin(s.yaw) * (s.d / 2 + 0.6), s.lz + Math.cos(s.yaw) * (s.d / 2 + 0.6));
    // interact left for future rental; no shop content yet
  }
}
