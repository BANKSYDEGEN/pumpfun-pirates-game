// [Timothy v308] BANKSY coli-cliff: south tip lz1=-72 off Fish Market cliff + shell-protect stamp + foundation skirt;
// [v305] rounded-oval / superellipse (p=2.7); MAIN_GATE = vaulted Roman vomitorium gallery. Kill switch: &coliseum=0.
import * as THREE from 'three';
import { M } from './kit.js';
import * as CO from './coast.js';
import { FACADE_LZ, ROW_D, STREET_Y, SLAB, PLAZA_V2 } from './plazaTown.js';

export const COLISEUM_ON = !(typeof location !== 'undefined' && /[?&]coliseum=0(&|$)/.test(location.search));

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rectD = (lx, lz, R) => Math.hypot(Math.max(R.lx0 - lx, 0, lx - R.lx1), Math.max(R.lz0 - lz, 0, lz - R.lz1));

// [v308] south tip pulled to lz -72 (off Fish Market cliff) + stamp never undercuts shell; foundation skirt under outer bays.
// [v305] rounded amphitheatre: mid-width lx 34..88, p>2 blunts the hairpin ends.
export const FOOT = { lx0: 34, lx1: 88, lz0: -200, lz1: -72, y: 9.2, feather: 8, wall: 3.2, walk: 4.5, tiers: 3 };
export const ELL = {
  cx: (FOOT.lx0 + FOOT.lx1) / 2, cz: (FOOT.lz0 + FOOT.lz1) / 2,
  rx: (FOOT.lx1 - FOOT.lx0) / 2, rz: (FOOT.lz1 - FOOT.lz0) / 2, p: 2.7,
};
const { cx: ECX, cz: ECZ, rx: ERX, rz: ERZ, p: EP } = ELL;

// Superellipse |dx/rx|^p + |dz/rz|^p = 1. Parametric sample → arc-length table for uniform bays + true normals.
function _sgnPow(v, e) { return Math.sign(v || 1) * Math.abs(v) ** e; }
export function ellPoint(th, off = 0) {
  const c = Math.cos(th), s = Math.sin(th);
  const lx = ECX + ERX * _sgnPow(c, 2 / EP), lz = ECZ + ERZ * _sgnPow(s, 2 / EP);
  if (!off) return [lx, lz];
  const [nx, nz] = ellNormal(lx, lz);
  return [lx - nx * off, lz - nz * off];
}
export function ellNormal(lx, lz) {
  const dx = lx - ECX, dz = lz - ECZ;
  const nx = EP / ERX * _sgnPow(dx / ERX, EP - 1), nz = EP / ERZ * _sgnPow(dz / ERZ, EP - 1);
  const L = Math.hypot(nx, nz) || 1; return [nx / L, nz / L];
}
export function ellF(lx, lz, inset = 0) {
  const rx = Math.max(0.5, ERX - inset), rz = Math.max(0.5, ERZ - inset);
  return Math.abs((lx - ECX) / rx) ** EP + Math.abs((lz - ECZ) / rz) ** EP;
}
export function ellOutD(lx, lz) {
  const f = ellF(lx, lz); if (f <= 1) return 0;
  const s = f ** (-1 / EP); return Math.hypot((lx - ECX) * (1 - s), (lz - ECZ) * (1 - s));
}
export function ellInside(lx, lz, inset = 0) { return ellF(lx, lz, inset) <= 1; }

const _N = 2048, _PTS = [], _PS = [0];
for (let i = 0; i <= _N; i++) {
  _PTS.push(ellPoint(-Math.PI + i / _N * 2 * Math.PI));
  if (i) _PS.push(_PS[i - 1] + Math.hypot(_PTS[i][0] - _PTS[i - 1][0], _PTS[i][1] - _PTS[i - 1][1]));
}
export const CONTOUR_LEN = _PS[_N];
export function contourAt(s, off = 0) {
  s = ((s % CONTOUR_LEN) + CONTOUR_LEN) % CONTOUR_LEN;
  let i = 1; while (i < _PS.length - 1 && _PS[i] < s) i++;
  const t = (s - _PS[i - 1]) / (_PS[i] - _PS[i - 1] || 1);
  const lx = _PTS[i - 1][0] + (_PTS[i][0] - _PTS[i - 1][0]) * t;
  const lz = _PTS[i - 1][1] + (_PTS[i][1] - _PTS[i - 1][1]) * t;
  const tx = _PTS[i][0] - _PTS[i - 1][0], tz = _PTS[i][1] - _PTS[i - 1][1];
  const [nx, nz] = ellNormal(lx, lz);
  const yaw = Math.atan2(-tz, tx);
  return { lx: lx - nx * off, lz: lz - nz * off, nx, nz, yaw, s };
}
export function contourNearest(lx, lz) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < _N; i++) { const d = Math.hypot(_PTS[i][0] - lx, _PTS[i][1] - lz); if (d < bd) { bd = d; best = i; } }
  return contourAt(_PS[best]);
}
function baySeg(i, N, off = 0) {
  const s0 = i / N * CONTOUR_LEN, s1 = (i + 1) / N * CONTOUR_LEN;
  return baySegRange(s0, s1, off, i);
}
// Exact arc-length sub-segment (for gate cutout remnants that aren't a full bay).
function baySegRange(s0, s1, off = 0, i = -1) {
  const smid = (s0 + s1) / 2;
  const a = contourAt(s0, off), b = contourAt(s1, off), m = contourAt(smid, off);
  const [x0, z0] = CO.t2w(a.lx, a.lz), [x1, z1] = CO.t2w(b.lx, b.lz), [xm, zm] = CO.t2w(m.lx, m.lz);
  const [wx1, wz1] = CO.t2w(m.lx + m.nx, m.lz + m.nz);
  const nx = wx1 - xm, nz = wz1 - zm, nL = Math.hypot(nx, nz) || 1;
  return { i, s0, s1, smid, lx0: a.lx, lz0: a.lz, lx1: b.lx, lz1: b.lz, lxm: m.lx, lzm: m.lz,
    x0, z0, x1, z1, xm, zm, nx: nx / nL, nz: nz / nL, span: Math.hypot(x1 - x0, z1 - z0), yaw: Math.atan2(-(z1 - z0), x1 - x0) };
}
// Subtract a circular arc cutout [gS-hw, gS+hw] (mod CONTOUR_LEN) from [s0,s1]; return remaining [sa,sb] pieces.
function subtractArc(s0, s1, gS, hw) {
  const L = CONTOUR_LEN;
  const norm = (s) => ((s % L) + L) % L;
  // Lift cutout into a window that overlaps [s0,s1] (unwrap by ±L)
  const pieces = [];
  for (const k of [-1, 0, 1]) {
    const c0 = gS - hw + k * L, c1 = gS + hw + k * L;
    const a = Math.max(s0, c0), b = Math.min(s1, c1);
    if (a < b) pieces.push([a, b]);
  }
  if (!pieces.length) return [[s0, s1]];
  pieces.sort((u, v) => u[0] - v[0]);
  const out = []; let cur = s0;
  for (const [a, b] of pieces) {
    if (a > cur + 1e-6) out.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (s1 > cur + 1e-6) out.push([cur, s1]);
  return out;
}

// Main entrance (remove stall_red/blue): between #36/#37 on east Hill Street
export const MAIN_GATE = (() => {
  let best = 0, bd = Infinity;
  for (let i = 0; i < _N; i++) { if (_PTS[i][0] > 55) continue; const d = Math.abs(_PTS[i][1] + 114.761); if (d < bd) { bd = d; best = i; } }
  return { lx: 14, lz: -114.761, w: 9.624, d: 29, opening: 6.824, shellLx: +_PTS[best][0].toFixed(2) };
})();
// Back exit → fountain plaza. CASTLE_* names retained.
export const CASTLE_GATE = (() => { const c = contourNearest(41, -185); return { lx: +c.lx.toFixed(2), lz: +c.lz.toFixed(2), w: 7, n: [c.nx, c.nz] }; })();
export const CASTLE_JOIN = { lx: 12, lz: -206, y: 20.1 };
export const CASTLE_RAMP_HW = 2.4;
const CP = [[CASTLE_GATE.lx, CASTLE_GATE.lz], [36, -190], [32, -195], [28, -200], [26, -204], [22, -206], [CASTLE_JOIN.lx, CASTLE_JOIN.lz]];
const rounded = [CP[0]];
for (let i = 1; i < CP.length - 1; i++) {
  const a = CP[i - 1], b = CP[i], c = CP[i + 1], la = Math.hypot(a[0] - b[0], a[1] - b[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const r = Math.min(4, la / 3, lc / 3), u = b.map((v, j) => v + (a[j] - v) * r / la), v = b.map((x, j) => x + (c[j] - x) * r / lc);
  rounded.push(u); for (let j = 1; j <= 12; j++) { const t = j / 12; rounded.push(u.map((x, k) => (1 - t) ** 2 * x + 2 * (1 - t) * t * b[k] + t * t * v[k])); }
}
rounded.push(CP.at(-1));
const PS = [0]; for (let i = 1; i < rounded.length; i++) PS.push(PS[i - 1] + Math.hypot(rounded[i][0] - rounded[i - 1][0], rounded[i][1] - rounded[i - 1][1]));
export const CASTLE_STAIR = { path: rounded, ps: PS, length: PS.at(-1) };
export function castleAt(s) { s = Math.max(0, Math.min(CASTLE_STAIR.length, s)); let i = 1; while (i < PS.length - 1 && PS[i] < s) i++;
  const t = (s - PS[i - 1]) / (PS[i] - PS[i - 1]); return rounded[i - 1].map((v, j) => v + (rounded[i][j] - v) * t); }
export function castleY(s) {
  const L = CASTLE_STAIR.length;
  return FOOT.y + (CASTLE_JOIN.y - FOOT.y) * Math.max(0, Math.min(1, (s - 3) / (L - 19)));
}
export function castleSample(lx, lz) { let d = Infinity, s = 0; for (let i = 1; i < rounded.length; i++) {
  const a = rounded[i - 1], b = rounded[i], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((lx - a[0]) * dx + (lz - a[1]) * dz) / (dx * dx + dz * dz)));
  const dd = Math.hypot(lx - a[0] - dx * t, lz - a[1] - dz * t); if (dd < d) { d = dd; s = PS[i - 1] + (PS[i] - PS[i - 1]) * t; }
} return { d, s, y: castleY(s) }; }
export const inMainAlley = (lx, lz, pad = 0) => COLISEUM_ON && lx > MAIN_GATE.lx - 2 - pad && lx < MAIN_GATE.lx + MAIN_GATE.d + pad && Math.abs(lz - MAIN_GATE.lz) < MAIN_GATE.w / 2 + pad;
export function mainY(lx, lz) {
  const t = sm(MAIN_GATE.lx, MAIN_GATE.shellLx, lx), street = 3 + Math.max(0, -lz - 50) * 0.11;
  return street + (FOOT.y - street) * t;
}
// Cannon Hill / Cliff Battery exit (seaward-east) on the rounded shell at lz -120
export const BATTERY_GATE = (() => {
  let best = null, bd = Infinity;
  for (let i = 0; i < _N; i++) { if (_PTS[i][0] < 70) continue; const d = Math.abs(_PTS[i][1] + 120); if (d < bd) { bd = d; best = i; } }
  const c = contourAt(_PS[best]); return { lx: +c.lx.toFixed(2), lz: +c.lz.toFixed(2), w: 4.5, n: [c.nx, c.nz] };
})();
// Fish-market plaza approach: SE gate on the rounded shell, approach corridor east of FISH MARKET unchanged.
export const FISH_GATE = (() => {
  let best = null, bs = -Infinity;
  for (let i = 0; i < _N; i++) {
    const [lx, lz] = _PTS[i]; if (lx < 72 || lz <= FOOT.lz1 - 14 || lz >= FOOT.lz1 - 1.5) continue;
    const [nx, nz] = ellNormal(lx, lz); const toA = [95.5 - lx, -41.2 - lz], al = Math.hypot(...toA) || 1;
    const align = (nx * toA[0] + nz * toA[1]) / al; if (align > bs) { bs = align; best = i; }
  }
  const c = contourAt(_PS[best]); return { lx: c.lx, lz: c.lz, w: 7.2, n: [c.nx, c.nz], plazaY: STREET_Y };
})();
export const FISH_HW = 3.6;
const FG_OUT = 1.6, FG_IN = 8;
const FP = [[95.8, -41.2], [FISH_GATE.lx + FISH_GATE.n[0] * 13, FISH_GATE.lz + FISH_GATE.n[1] * 13], [FISH_GATE.lx + FISH_GATE.n[0] * FG_OUT, FISH_GATE.lz + FISH_GATE.n[1] * FG_OUT], [FISH_GATE.lx - FISH_GATE.n[0] * FG_IN, FISH_GATE.lz - FISH_GATE.n[1] * FG_IN]];
function roundPath(CPs, rmax) { const out = [CPs[0]];
  for (let i = 1; i < CPs.length - 1; i++) { const a = CPs[i - 1], b = CPs[i], c = CPs[i + 1], la = Math.hypot(a[0] - b[0], a[1] - b[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const r = Math.min(rmax, la / 3, lc / 3), u = b.map((v, j) => v + (a[j] - v) * r / la), v = b.map((x, j) => x + (c[j] - x) * r / lc);
    out.push(u); for (let j = 1; j <= 12; j++) { const t = j / 12; out.push(u.map((x, k) => (1 - t) ** 2 * x + 2 * (1 - t) * t * b[k] + t * t * v[k])); } }
  out.push(CPs.at(-1)); const ps = [0]; for (let i = 1; i < out.length; i++) ps.push(ps[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1])); return { path: out, ps, length: ps.at(-1) }; }
export const FISH_STAIR = roundPath(FP, 6);
FISH_STAIR.sTop = FISH_STAIR.length - (FG_IN + FG_OUT) - 0.4;
FISH_STAIR.sShell = FISH_STAIR.length - (FG_IN + FG_OUT);
export function fishAt(s) { const P = FISH_STAIR.path, PS = FISH_STAIR.ps; s = Math.max(0, Math.min(FISH_STAIR.length, s)); let i = 1; while (i < PS.length - 1 && PS[i] < s) i++;
  const t = (s - PS[i - 1]) / (PS[i] - PS[i - 1]); return P[i - 1].map((v, j) => v + (P[i][j] - v) * t); }
export const fishY = (s) => STREET_Y + (FOOT.y - STREET_Y) * Math.max(0, Math.min(1, (s - 1.5) / (FISH_STAIR.sTop - 1.5)));
export function fishSample(lx, lz) { const P = FISH_STAIR.path, PS = FISH_STAIR.ps; let d = Infinity, s = 0;
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((lx - a[0]) * dx + (lz - a[1]) * dz) / (dx * dx + dz * dz)));
    const dd = Math.hypot(lx - a[0] - dx * t, lz - a[1] - dz * t); if (dd < d) { d = dd; s = PS[i - 1] + (PS[i] - PS[i - 1]) * t; } }
  return { d, s, y: fishY(s) }; }
const FISH_PTS = []; { for (let s = 0; s <= FISH_STAIR.length; s += 0.5) FISH_PTS.push([...fishAt(s), s]); }
function fishLowY(lx, lz, r) { for (const [x, z, s] of FISH_PTS) if (Math.hypot(lx - x, lz - z) < r) return fishY(s); return null; }
const nearFish = (lx, lz) => lx > 62 && lx < 112 && lz > -84 && lz < -30;
export function pave(lx, lz) { if (!COLISEUM_ON || !nearFish(lx, lz)) return 0; const f = fishSample(lx, lz); if (f.s > FISH_STAIR.sShell) return 0; return 1 - sm(FISH_HW + 1.5, FISH_HW + 3.5, f.d); }

export const NEW_STORES = [
  { id: 'coli_store_45', n: 45, lx: -10.0, lz: -56.5, w: 16, d: 21, storeys: 1, maxRoof: 2.8, yaw: Math.PI / 2, label: 'EMPTY SHOP' },
  { id: 'coli_store_46', n: 46, lx: 22.0, lz: -56.5, w: 16, d: 21, storeys: 2, maxRoof: 0, yaw: -Math.PI / 2, label: 'EMPTY SHOP' },
];
export const COLI_STORES_ON = typeof location !== 'undefined' && /[?&]colirent=1(&|$)/.test(location.search || '');
export const BOARD_POIS = CO.PLAZA_POIS.filter(q => q.id === 'waves' || q.id === 'arena');

export const near = (lx, lz) => COLISEUM_ON && (nearFish(lx, lz) || (lx > FOOT.lx0 - 12 && lx < FOOT.lx1 + 8 && lz > FOOT.lz0 - 12 && lz < FOOT.lz1 + 8) || inMainAlley(lx, lz, 3) || castleSample(lx, lz).d < CASTLE_RAMP_HW + 2);

export function inFoot(lx, lz, pad = 0) { return ellInside(lx, lz, pad); }

export function stamp(lx, lz, h) {
  if (!near(lx, lz)) return { h, d: 99 };
  const d = ellOutD(lx, lz);
  // Flatten interior + 3.6 m shell shoulder to FOOT.y (cuts west hillside down AND supports south cliff bays across G=4 grid).
  if (d <= 3.6) h = FOOT.y;
  else if (d < 8.5) {
    const w = 1 - sm(3.6, 8.5, d);
    h = h * (1 - w) + FOOT.y * w;
  }
  const dg = Math.hypot(Math.max(MAIN_GATE.lx - lx, 0, lx - MAIN_GATE.lx - MAIN_GATE.d), Math.max(Math.abs(lz - MAIN_GATE.lz) - MAIN_GATE.w / 2, 0));
  const ramp = castleSample(lx, lz), rd = ramp.d;
  // [v307] plaza / fish cuts must never carve a cliff under the outer shell (d < 3.6), except inside the FISH_STAIR corridor itself.
  let fd = 99, onFishRamp = false;
  if (nearFish(lx, lz)) {
    const f = fishSample(lx, lz); fd = f.d;
    onFishRamp = f.d < FISH_HW + 0.4 && f.s < FISH_STAIR.sShell + 1;
    if (f.d < FISH_HW + 8.5 && f.s < FISH_STAIR.sShell + 1 && (d >= 3.6 || onFishRamp)) {
      const w = 1 - sm(FISH_HW + 4.5, FISH_HW + 8.5, f.d), ty = Math.min(f.y, fishLowY(lx, lz, FISH_HW + 6) ?? f.y) - 0.12;
      h = h * (1 - w) + (lx < 93 && lz > -46 ? Math.min(h, ty) : ty) * w;
    }
  }
  if (PLAZA_V2 && d >= 3.6 && lx > SLAB.lx0 - 4 && lx < SLAB.lx1 + 4 && lz > FACADE_LZ - ROW_D - 6) {
    const keep = sm(FACADE_LZ - ROW_D - 6, FACADE_LZ - ROW_D - 2, lz);
    h += (Math.min(h, STREET_Y - 0.14) - h) * keep;
  }
  // Gate ramps after plaza/fish so they win cleanly in their openings.
  if (dg < 2) { const w = 1 - sm(0, 2, dg); h = h * (1 - w) + mainY(lx, lz) * w; }
  if (rd < CASTLE_RAMP_HW + 1.2) { const w = 1 - sm(CASTLE_RAMP_HW, CASTLE_RAMP_HW + 1.2, rd); h = h * (1 - w) + ramp.y * w; }
  return { h, d: Math.min(d, dg, rd, fd + 4) };
}

export function clearAt(lx, lz) {
  if (!near(lx, lz)) return 0;
  if (inMainAlley(lx, lz, 2) || castleSample(lx, lz).d < CASTLE_RAMP_HW + 2 || ellOutD(lx, lz) < 6) return 1;
  if (nearFish(lx, lz) && fishSample(lx, lz).d < FISH_HW + 8) return 1;
  if (Math.hypot(lx - MAIN_GATE.lx, lz - MAIN_GATE.lz) < MAIN_GATE.w + 2) return 1;
  for (const s of NEW_STORES) {
    if (Math.abs(lx - s.lx) < s.d / 2 + 2 && Math.abs(lz - s.lz) < s.w / 2 + 2) return 1;
  }
  return 0;
}

export function buildArt(o) {
  if (!COLISEUM_ON) return;
  const { k, W, box, cyl, T, H, addBox, addCirc, torchPost, addDeck, F, C } = o;
  const ST = 0xc4b8a2, ST_L = 0xd3c8b3, ST_D = 0x8f8474, SAND = 0xd4bc8c, COB = 0xc9a090, WOOD_D = C.WOOD_D || 0x6b4527;
  const CRIM = 0xb32a22, GOLD = 0xc9a227, IRON = C.IRON || 0x2b2f36;
  const DS = 11, CB = 10, SA = 8;
  const F0 = FOOT, cx = ELL.cx, cz = ELL.cz, rx = ELL.rx, rz = ELL.rz;
  const y0 = F0.y, tierH = 3.6, N = 48, wt = 1.85, Y0W = CO.t2wYaw(0);
  const KERB = 8.2, RING = 5.6, SEAT0 = 3.3;
  // baySeg already returns world-space x0/xm/yaw/nx (via CO.t2w); Wseg is identity.
  const Wseg = (s) => s;
  const gateHit = (s) => {
    for (const g of [MAIN_GATE, CASTLE_GATE, BATTERY_GATE, FISH_GATE]) {
      const glx = g.shellLx ?? g.lx, glz = g.lz;
      if (Math.hypot(s.lxm - glx, s.lzm - glz) < Math.max(g.w * 0.75, 5.5)) return g;
    }
    return null;
  };
  const pierInGateAt = (lx, lz) => {
    for (const gg of [MAIN_GATE, CASTLE_GATE, BATTERY_GATE, FISH_GATE])
      if (Math.hypot(lx - (gg.shellLx ?? gg.lx), lz - gg.lz) < gg.w * 0.65) return true;
    return false;
  };
  const archG = (r, tube) => new THREE.TorusGeometry(r, tube, 4, 10, Math.PI);
  const arch = (x, y, z, yaw, r, tube = 0.28, depth = 1) => {
    const g = archG(r, tube); g.scale(1, 1, depth / tube / 2); W(k, g, ST_L, DS, M(x, y, z, yaw), false);
    W(k, box(0.5, 0.7, depth + 0.1), ST_L, DS, M(x, y + r + 0.15, z, yaw), false);
  };
  const banner = (x, y, z, yaw, h = 2.4, w = 1.2) => {
    W(k, box(w, h, 0.06), CRIM, 12, M(x, y, z, yaw), false);
    W(k, box(w + 0.1, 0.12, 0.12), GOLD, 2, M(x, y + h / 2 + 0.06, z, yaw), false);
    W(k, box(w + 0.05, 0.08, 0.08), GOLD, 2, M(x, y - h / 2 - 0.04, z, yaw), false);
  };

  // sand arena floor (superellipse matching inset kerb) + stone kerb on true normals
  { const [x, z] = T(cx, cz), g = new THREE.CylinderGeometry(1, 1, 0.2, 64), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vz = pos.getZ(i), r = Math.hypot(vx, vz);
      if (r > 1e-4) { const th = Math.atan2(vz, vx); pos.setX(i, (rx - KERB + 0.3) * _sgnPow(Math.cos(th), 2 / EP) * r); pos.setZ(i, (rz - KERB + 0.3) * _sgnPow(Math.sin(th), 2 / EP) * r); }
    }
    g.computeVertexNormals();
    W(k, g, SAND, SA, M(x, y0 + 0.06, z, Y0W), false); }
  for (let i = 0; i < N; i++) { const s = Wseg(baySeg(i, N, KERB - 0.1)); W(k, box(s.span * 1.04, 0.22, 0.5), ST_D, DS, M(s.xm, y0 + 0.1, s.zm, s.yaw), false); }

  // plan colors: musket pad + sword pad
  { const YEL = 0xbca779, PUR = 0xb5a48b;
    const [mx, mz] = T(61, -150); W(k, box(27, 0.08, 27), YEL, SA, M(mx, y0 + 0.1, mz, Y0W), false);
    const [px, pz] = T(61, -101); W(k, new THREE.CylinderGeometry(10.1, 10.1, 0.08, 32), PUR, SA, M(px, y0 + 0.1, pz), false); }

  // Worn flag patches
  for (let row = 0; row < 45; row++) for (let col = 0; col < 15; col++) {
    const lx = 43 + col * 3 + (row % 2) * 1.5, lz = -186 + row * 3.0, v = Math.sin(row * 127.1 + col * 311.7) * 43758.5453, h = v - Math.floor(v);
    if (ellF(lx, lz, KERB + 0.8) > 0.94 || h < 0.58) continue;
    const [x, z] = T(lx, lz); W(k, box(0.8 + h * 1.1, 0.035, 0.6 + h * 0.9), h > 0.8 ? 0xb4a58c : 0xc5b69b, DS, M(x, y0 + 0.18, z, Y0W + h * 0.28), false);
  }

  // continuous cobbled ring walk
  for (let i = 0; i < N; i++) { const s = Wseg(baySeg(i, N, RING)); W(k, box(s.span * 1.06, 0.16, 4.6), COB, CB, M(s.xm, y0 + 0.07, s.zm, s.yaw), false); }

  // [v307] gate cutouts by exact arc-length (not whole-bay skip) so shell/cavea tie flush into gate piers
  const GATE_CUTS = [MAIN_GATE, CASTLE_GATE, BATTERY_GATE, FISH_GATE].map((g) => {
    const c = contourNearest(g.shellLx ?? g.lx, g.lz);
    const isMain = g === MAIN_GATE;
    return {
      g, s: c.s,
      shellHW: isMain ? g.opening / 2 + 3.0 : g.w / 2 + 2.4,
      seatHW: isMain ? g.opening / 2 + 1.2 : g.w / 2 + 1.4,
    };
  });
  const remainders = (s0, s1, kind) => {
    let segs = [[s0, s1]];
    for (const cut of GATE_CUTS) {
      const hw = kind === 'seat' ? cut.seatHW : cut.shellHW;
      const next = [];
      for (const [a, b] of segs) next.push(...subtractArc(a, b, cut.s, hw));
      segs = next;
    }
    return segs;
  };

  // seating podium + cavea — trim exactly to seatCutHW at each gate
  for (let i = 0; i < N; i++) {
    const s0 = i / N * CONTOUR_LEN, s1 = (i + 1) / N * CONTOUR_LEN;
    const bits = remainders(s0, s1, 'seat').filter(([a, b]) => b - a > 0.25);
    for (const [sa, sb] of bits) {
      for (let r = 0; r < 4; r++) {
        const s = Wseg(baySegRange(sa, sb, SEAT0 - r * 0.6, i)), h = 1.2 + r * 1.1;
        W(k, box(s.span * 1.05, h, 0.7), r % 2 ? ST : ST_L, DS, M(s.xm, y0 + h / 2, s.zm, s.yaw), r === 0);
      }
      const s = Wseg(baySegRange(sa, sb, SEAT0 - 0.2, i)); addBox(s.xm, s.zm, s.span * 1.02, 1.0, s.yaw);
    }
    if (i % 3 === 0 && bits.length) {
      const mid = bits[0], t = Wseg(baySegRange(mid[0], mid[1], SEAT0 + 0.6, i));
      torchPost?.(k, F, t.xm, y0, t.zm); addCirc(t.xm, t.zm, 0.25);
    }
  }

  // [v307] outer shell: exact arc-length remnants around gates (arched if long, solid ashlar if short)
  const totH = F0.tiers * tierH + 2.6;
  const placePier = (s, force = false) => {
    // Only skip when deep inside the walkable opening (not the cheek / shellHW zone).
    if (!force) {
      let inOpen = false;
      for (const gg of [MAIN_GATE, CASTLE_GATE, BATTERY_GATE, FISH_GATE]) {
        const glx = gg.shellLx ?? gg.lx, glz = gg.lz, hw = (gg.opening ?? gg.w) / 2 + 0.15;
        if (Math.hypot(s.lx0 - glx, s.lz0 - glz) < hw) { inOpen = true; break; }
      }
      if (inOpen) return;
    }
    const [px, pz] = [s.x0, s.z0];
    W(k, box(1.5, totH, wt + 0.3), ST, DS, M(px, y0 + totH / 2, pz, s.yaw));
    W(k, cyl(0.42, 0.46, totH - 0.4, 8), ST_L, DS, M(px + s.nx * 0.95, y0 + totH / 2, pz + s.nz * 0.95), false);
    W(k, box(1.7, 2.6, wt + 0.55), ST_D, DS, M(px, y0 - 1.3, pz, s.yaw), false);
    W(k, box(1.95, 0.28, wt + 0.75), ST_D, DS, M(px, y0 - 0.05, pz, s.yaw), false);
    addBox(px, pz, 1.6, wt + 0.4, s.yaw);
  };
  const placeAttic = (s) => {
    const ay = y0 + F0.tiers * tierH;
    W(k, box(s.span * 1.02, 2.2, wt), ST, DS, M(s.xm, ay + 1.1, s.zm, s.yaw), false);
    W(k, box(s.span * 1.04, 0.4, wt + 0.7), ST_D, DS, M(s.xm, ay + 2.3, s.zm, s.yaw), false);
    for (const f of [-0.25, 0.25]) W(k, box(Math.min(s.span * 0.28, 1.2), 0.9, wt), ST_L, DS, M(s.xm + Math.cos(s.yaw) * s.span * f * 0.5, ay + 2.95, s.zm - Math.sin(s.yaw) * s.span * f * 0.5, s.yaw), false);
  };
  const placeArched = (s) => {
    const open = Math.max(0.6, s.span - 1.3), r = Math.min(open / 2, 1.5);
    for (let ti = 0; ti < F0.tiers; ti++) {
      const ty = y0 + ti * tierH, spring = ty + tierH - 0.75 - r;
      W(k, box(open, tierH - (spring - ty) - r, wt), ST, DS, M(s.xm, (spring + r + ty + tierH) / 2, s.zm, s.yaw), false);
      W(k, box(s.span * 1.02, 0.32, wt + 0.5), ST_D, DS, M(s.xm, ty + tierH - 0.1, s.zm, s.yaw), false);
      arch(s.xm, spring, s.zm, s.yaw, r, 0.22, wt + 0.1);
      if (ti === 0) {
        W(k, box(open, Math.max(0.4, spring + r - ty), wt * 0.85), ST_D, DS, M(s.xm, (ty + spring + r) / 2, s.zm, s.yaw), false);
        W(k, box(s.span * 1.02, 2.5, wt + 0.45), ST_D, DS, M(s.xm, y0 - 1.25, s.zm, s.yaw), false);
        addBox(s.xm, s.zm, s.span, wt, s.yaw);
      }
    }
    placeAttic(s);
  };
  const placeSolid = (s) => {
    for (let ti = 0; ti < F0.tiers; ti++) {
      const ty = y0 + ti * tierH;
      W(k, box(s.span + 0.4, tierH, wt + 0.2), ST, DS, M(s.xm, ty + tierH / 2, s.zm, s.yaw), false);
      W(k, box(s.span + 0.45, 0.32, wt + 0.5), ST_D, DS, M(s.xm, ty + tierH - 0.1, s.zm, s.yaw), false);
      if (ti === 0) {
        W(k, box(s.span + 0.4, 2.6, wt + 0.45), ST_D, DS, M(s.xm, y0 - 1.3, s.zm, s.yaw), false);
        addBox(s.xm, s.zm, s.span + 0.3, wt + 0.2, s.yaw);
      }
    }
    placeAttic(s);
  };
  // [v307] solid full-height cheek panels from the gate opening edge out to shellHW —
  // closes the daylight slit that whole-bay skipping left beside every gate pier.
  for (const cut of GATE_CUTS) {
    const openHW = cut.g === MAIN_GATE ? cut.g.opening / 2 + 0.2 : cut.g.w / 2 + 0.2;
    for (const sd of [-1, 1]) {
      const a = cut.s + sd * openHW, b = cut.s + sd * cut.shellHW;
      const sa = Math.min(a, b), sb = Math.max(a, b);
      if (sb - sa < 0.2) continue;
      const seg = Wseg(baySegRange(sa, sb, 0));
      for (let ti = 0; ti < F0.tiers; ti++) {
        const ty = y0 + ti * tierH;
        W(k, box(seg.span + 0.6, tierH, wt + 0.25), ST, DS, M(seg.xm, ty + tierH / 2, seg.zm, seg.yaw), false);
        W(k, box(seg.span + 0.65, 0.32, wt + 0.5), ST_D, DS, M(seg.xm, ty + tierH - 0.1, seg.zm, seg.yaw), false);
      }
      placeAttic({ ...seg, span: seg.span + 0.5 });
      W(k, box(seg.span + 0.6, 2.6, wt + 0.45), ST_D, DS, M(seg.xm, y0 - 1.3, seg.zm, seg.yaw), false);
      addBox(seg.xm, seg.zm, seg.span + 0.35, wt + 0.25, seg.yaw);
      // matching cavea cheek fill (look + collider) up to seatHW
      const seatA = cut.s + sd * (cut.g === MAIN_GATE ? cut.g.opening / 2 + 0.2 : cut.g.w / 2 + 0.2);
      const seatB = cut.s + sd * cut.seatHW;
      const s0 = Math.min(seatA, seatB), s1 = Math.max(seatA, seatB);
      if (s1 - s0 > 0.15) {
        for (let r = 0; r < 4; r++) {
          const seat = Wseg(baySegRange(s0, s1, SEAT0 - r * 0.6));
          const h = 1.2 + r * 1.1;
          W(k, box(seat.span * 1.05, h, 0.7), r % 2 ? ST : ST_L, DS, M(seat.xm, y0 + h / 2, seat.zm, seat.yaw), r === 0);
        }
      }
    }
  }
  for (let i = 0; i < N; i++) {
    const s0 = i / N * CONTOUR_LEN, s1 = (i + 1) / N * CONTOUR_LEN;
    const bits = remainders(s0, s1, 'shell').filter(([a, b]) => b - a > 0.15);
    const startInGate = GATE_CUTS.some((c) => {
      const L = CONTOUR_LEN, d = Math.min(Math.abs(s0 - c.s), L - Math.abs(s0 - c.s));
      return d < c.shellHW;
    });
    if (!startInGate) placePier(baySegRange(s0, Math.min(s0 + 0.01, s1), 0, i));
    for (const [sa, sb] of bits) {
      const len = sb - sa;
      const s = Wseg(baySegRange(sa, sb, 0, i));
      placePier(baySegRange(sa, sa + 0.01, 0, i));
      placePier(baySegRange(sb - 0.01, sb, 0, i));
      // Gate-adjacent remnants stay solid ashlar (no open arches) so you cannot see
      // through the first bay into Hill Street / the arena — that was BANKSY's "hole".
      const touchesGate = GATE_CUTS.some((c) => {
        const L = CONTOUR_LEN;
        const near = (u) => Math.min(Math.abs(u - (c.s - c.shellHW)), Math.abs(u - (c.s + c.shellHW)),
          Math.abs(u - (c.s - c.shellHW) - L), Math.abs(u - (c.s + c.shellHW) - L),
          Math.abs(u - (c.s - c.shellHW) + L), Math.abs(u - (c.s + c.shellHW) + L)) < 0.08;
        return near(sa) || near(sb);
      });
      if (len >= 4.2) placeArched(s); else placeSolid(s);
    }
  }

  // arched gate bays on the ring (castle / battery / fish). MAIN_GATE has its own vomitorium portal below.
  const gateArt = (g, label) => {
    const c = contourNearest(g.shellLx ?? g.lx, g.lz), w = g.w, yaw = CO.t2wYaw(c.yaw), ca = Math.cos(c.yaw), sa = Math.sin(c.yaw);
    const [x, z] = T(c.lx, c.lz);
    const gh = 5.2;
    for (const sd of [-1, 1]) {
      const [px, pz] = T(c.lx + ca * sd * (w / 2 + 0.9), c.lz - sa * sd * (w / 2 + 0.9));
      // [v307] full-height gate pier matching outer shell
      W(k, box(1.9, totH, wt + 0.9), ST, DS, M(px, y0 + totH / 2, pz, yaw)); addBox(px, pz, 1.9, wt + 0.9, yaw);
      W(k, box(2.1, 0.35, wt + 1.1), ST_D, DS, M(px, y0 + totH - 0.15, pz, yaw), false);
      W(k, box(2.0, 2.6, wt + 1.0), ST_D, DS, M(px, y0 - 1.3, pz, yaw), false);
    }
    arch(x, y0 + gh, z, yaw, w / 2 + 0.2, 0.4, wt + 0.8);
    W(k, box(w + 4.0, totH - gh - w / 2 - 0.2, wt + 0.2), ST, DS, M(x, (y0 + gh + w / 2 + 0.2 + y0 + totH) / 2, z, yaw), false);
    W(k, box(w + 4.2, 0.4, wt + 0.8), ST_D, DS, M(x, y0 + F0.tiers * tierH + 2.3, z, yaw), false);
    // [v307] radial full-height cheeks (stop short of pink ring)
    for (const sd of [-1, 1]) {
      for (let off = 0.3; off <= SEAT0 + 0.4; off += 0.7) {
        const clx = c.lx - c.nx * off + ca * sd * (w / 2 + 0.55), clz = c.lz - c.nz * off - sa * sd * (w / 2 + 0.55);
        const [cxw, czw] = T(clx, clz);
        W(k, box(1.1, totH, 1.6), ST, DS, M(cxw, y0 + totH / 2, czw, yaw));
        if (off < SEAT0 - 0.2) addBox(cxw, czw, 1.0, 1.4, yaw);
      }
    }
    if (label) W(k, box(Math.min(w, 5), 0.9, 0.2), WOOD_D, 2, M(x, y0 + F0.tiers * tierH - 1.2, z, yaw), false);
  };
  gateArt(CASTLE_GATE, false); gateArt(BATTERY_GATE, false); gateArt(FISH_GATE, true);

  // Fish-market grand approach
  { const FS = FISH_STAIR, L = FS.sShell, hw = FISH_HW, path = FS.path.map(p => T(...p)), xs = path.map(p => p[0]), zs = path.map(p => p[1]);
    addDeck?.({ id: 'coli_fish', path, ps: FS.ps, hw, yAt: fishY, bb: [Math.min(...xs) - hw, Math.max(...xs) + hw, Math.min(...zs) - hw, Math.max(...zs) + hw] });
    const frame = (s) => { const a = fishAt(s - 0.05), b = fishAt(s + 0.05), l = Math.hypot(b[0] - a[0], b[1] - a[1]); return { p: fishAt(s), dx: (b[0] - a[0]) / l, dz: (b[1] - a[1]) / l }; };
    for (let a = 0; a < FS.length - 0.01; a += 0.6) { const b = Math.min(FS.length, a + 0.6), [ax, az] = T(...fishAt(a)), [bx, bz] = T(...fishAt(b)), len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax), ya = fishY(a), yb = fishY(b);
      const geom = box(len + 0.06, 0.3, hw * 2 + 0.2), pos = geom.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + pos.getX(i) * (yb - ya) / Math.max(len, 1e-3)); geom.computeVertexNormals();
      W(k, geom, COB, CB, M((ax + bx) / 2, (ya + yb) / 2 - 0.12, (az + bz) / 2, yaw), false);
      if (Math.round(a / 0.6) % 4 === 0) W(k, box(0.35, 0.06, hw * 2), ST_D, DS, M((ax + bx) / 2, (ya + yb) / 2 + 0.04, (az + bz) / 2, yaw), false); }
    for (let a = 1.4; a < L - 0.3; a += 0.7) { const b = Math.min(L - 0.3, a + 0.7), m = frame((a + b) / 2), [ax, az] = T(...fishAt(a)), [bx, bz] = T(...fishAt(b)), len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax), y = fishY((a + b) / 2);
      for (const sd of [-1, 1]) { const ox = -m.dz * sd, oz = m.dx * sd, [x, z] = T(m.p[0] + ox * (hw + 0.35), m.p[1] + oz * (hw + 0.35)), [gx, gz] = T(m.p[0] + ox * (hw + 7), m.p[1] + oz * (hw + 7));
        const top = Math.max(y + 1.05, Math.min(H(gx, gz) + 0.35, y + 4.5)), bot = Math.min(y, H(x, z)) - 0.6;
        W(k, box(len + 0.06, top - bot, 0.6), ST, DS, M(x, (top + bot) / 2, z, yaw), false);
        W(k, box(len + 0.1, 0.16, 0.78), ST_L, DS, M(x, top + 0.08, z, yaw), false); addBox(x, z, len + 0.03, 0.6, yaw); } }
    { const m = frame(0.4), pyaw = CO.t2wYaw(Math.atan2(-m.dz, m.dx)); for (const sd of [-1, 1]) { const lx = m.p[0] - m.dz * sd * (hw + 1.25), lz = m.p[1] + m.dx * sd * (hw + 1.25), [x, z] = T(lx, lz), y = STREET_Y;
        W(k, box(1.5, 4.2, 1.5), ST, DS, M(x, y + 2.1, z, pyaw)); W(k, box(1.8, 0.35, 1.8), ST_D, DS, M(x, y + 4.35, z, pyaw), false);
        W(k, box(1.2, 0.7, 1.2), ST_L, DS, M(x, y + 4.85, z, pyaw), false); torchPost?.(k, F, x, y + 5.2, z); addBox(x, z, 1.5, 1.5, pyaw); } }
    { const g = FISH_GATE, c = contourNearest(g.lx, g.lz), yaw = CO.t2wYaw(c.yaw), ca = Math.cos(c.yaw), sa = Math.sin(c.yaw), [nx, nz] = g.n;
      for (const sd of [-1, 1]) {
        const [bx, bz] = T(g.lx + nx * (wt / 2 + 0.55) + ca * sd * (g.w / 2 + 0.9), g.lz + nz * (wt / 2 + 0.55) - sa * sd * (g.w / 2 + 0.9));
        W(k, box(1.3, 4.6, 0.08), CRIM, 12, M(bx, y0 + 6.6, bz, yaw), false); W(k, box(1.4, 0.2, 0.2), IRON, 2, M(bx, y0 + 8.95, bz, yaw), false);
      } }
  }

  // ─── MAIN_GATE: Roman vomitorium / triumphal entrance gallery ───
  { const g = MAIN_GATE, D = g.d, ph = 10.8, th = 1.4, shell = g.shellLx, DW = shell + 2.2 - g.lx;
    const yawE = CO.t2wYaw(Math.PI / 2); // facing east into the arena
    const open = g.opening, halfW = g.w / 2;
    // Side gallery walls (street → shell), dressed with plinth + cornice
    for (const sd of [-1, 1]) {
      const lz = g.lz + sd * (halfW - th / 2), [x, z] = T(g.lx + DW / 2, lz);
      W(k, box(DW, ph, th), ST, DS, M(x, y0 + ph / 2, z, Y0W), false); addBox(x, z, DW, th, Y0W);
      W(k, box(DW, 0.35, th + 0.25), ST_D, DS, M(x, y0 + 0.2, z, Y0W), false); // base plinth
      W(k, box(DW, 0.3, th + 0.35), ST_D, DS, M(x, y0 + ph + 0.15, z, Y0W), false); // cornice
    }
    // Rhythmic bays along the gallery: pilasters, blind arches, torches, banners
    const nBay = 5, bayL = DW / nBay;
    for (let i = 0; i < nBay; i++) {
      const lx = g.lx + (i + 0.5) * bayL;
      for (const sd of [-1, 1]) {
        const lzIn = g.lz + sd * (open / 2); // inner corridor wall face
        // pilasters protruding inward from inner wall face
        for (const edge of [-0.5, 0.5]) {
          const plx = g.lx + (i + 0.5 + edge) * bayL; if (plx < g.lx + 0.5 || plx > shell + 0.8) continue;
          const [px, pz] = T(plx, lzIn - sd * 0.14);
          W(k, box(0.58, ph - 0.6, 0.36), ST_L, DS, M(px, y0 + (ph - 0.6) / 2 + 0.3, pz, Y0W), false);
          W(k, box(0.72, 0.32, 0.48), ST_D, DS, M(px, y0 + 5.05, pz, Y0W), false); // pilaster impost capital at vault spring
        }
        // framed blind arch / dark stone niche panel on inner wall face
        { const [nx, nz] = T(lx, lzIn - sd * 0.05); const nicheH = 3.8, spring = mainY(lx, g.lz) + 3.4;
          W(k, box(bayL * 0.54, nicheH, 0.14), ST_D, DS, M(nx, spring - nicheH / 2, nz, Y0W), false);
          arch(nx, spring, nz, Y0W, bayL * 0.25, 0.15, 0.28);
        }
        // wall torch tucked against inner wall face (clear walk >= 6.0 m)
        if (i % 2 === (sd > 0 ? 0 : 1)) {
          const [tx, tz] = T(lx, lzIn - sd * 0.26);
          torchPost?.(k, F, tx, mainY(lx, g.lz), tz); addCirc(tx, tz, 0.18);
        }
        // crimson & gold arena banners hanging proud on inner corridor wall
        if (i % 2 === (sd > 0 ? 1 : 0)) {
          const [bx, bz] = T(lx, lzIn - sd * 0.13);
          banner(bx, mainY(lx, g.lz) + 3.65, bz, Y0W, 2.1, 1.1);
        }
      }
      // transverse threshold band on the floor
      { const [fx, fz] = T(lx, g.lz); W(k, box(0.35, 0.06, open), ST_D, DS, M(fx, mainY(lx, g.lz) + 0.02, fz, Y0W), false); }
      // transverse Roman rib arch at impost (y0 + 5.1) + barrel-vaulted coffered stone ceiling
      { const spring = y0 + 5.1, r = open / 2 + 0.08;
        for (const ribLx of i === 0 ? [lx - bayL / 2 + 0.55, lx + bayL / 2] : [lx + bayL / 2]) {
          if (ribLx > shell + 0.6) continue;
          const [rx, rz] = T(ribLx, g.lz);
          arch(rx, spring, rz, yawE, r, 0.28, 0.75);
        }
        // 7-facet Roman barrel vault spanning bayL with recessed dark coffer bands
        const nV = 7, rv = r + 0.22;
        for (let v = 0; v < nV; v++) {
          if (i % 2 === 1 && v === 3) continue; // open skylight oculus slot in crown of odd bays
          const a0 = (v / nV) * Math.PI, a1 = ((v + 1) / nV) * Math.PI, am = (a0 + a1) / 2;
          const chord = 2 * rv * Math.sin((a1 - a0) / 2) + 0.14;
          const dlz = -Math.cos(am) * rv, dy = Math.sin(am) * rv;
          const [vx, vz] = T(lx, g.lz + dlz);
          const m = M(vx, spring + dy, vz, Y0W).multiply(new THREE.Matrix4().makeRotationX(am - Math.PI / 2));
          W(k, box(bayL - 0.12, 0.26, chord), ST, DS, m, false);
          const mc = M(vx, spring + dy - Math.sin(am) * 0.09, vz, Y0W).multiply(new THREE.Matrix4().makeRotationX(am - Math.PI / 2));
          W(k, box(bayL * 0.62, 0.08, chord * 0.68), ST_D, DS, mc, false);
        }
        // flat roof deck above barrel vault so it reads solid from above too
        const [tx, tz] = T(lx, g.lz);
        W(k, box(bayL + 0.04, 0.32, g.w), ST, DS, M(tx, y0 + ph - 0.16, tz, Y0W), false);
      }
    }
    // Roof cornice crown along the gallery
    { const [rx, rz] = T(g.lx + DW / 2, g.lz);
      W(k, box(DW + 0.4, 0.4, open + 2.4), ST_D, DS, M(rx, y0 + ph + 0.35, rz, Y0W), false);
      W(k, box(DW + 0.2, 0.25, open + 2.0), ST_L, DS, M(rx, y0 + ph + 0.65, rz, Y0W), false);
    }

    // Street-front triumphal portal (flush with #36/#37 — nothing west of lx=14)
    { const [x, z] = T(g.lx + 0.9, g.lz), r = open / 2;
      // engaged columns / pilasters either side
      for (const sd of [-1, 1]) {
        const [px, pz] = T(g.lx + 0.7, g.lz + sd * (open / 2 + 1.1));
        W(k, box(1.1, ph - 0.4, 1.1), ST, DS, M(px, y0 + (ph - 0.4) / 2, pz, yawE));
        W(k, cyl(0.38, 0.42, ph - 1.2, 8), ST_L, DS, M(px, y0 + (ph - 1.2) / 2 + 0.4, pz), false);
        W(k, box(1.3, 0.45, 1.3), ST_D, DS, M(px, y0 + ph - 0.2, pz, yawE), false);
        addBox(px, pz, 1.2, 1.2, yawE);
        const [bxw, bzw] = T(g.lx + 0.08, g.lz + sd * (open / 2 + 1.1));
        banner(bxw, y0 + 6.6, bzw, yawE, 2.6, 1.15);
      }
      arch(x, y0 + 4.8, z, yawE, r, 0.32, 1.9);
      W(k, box(g.w, ph - 4.8 - r - 0.3, 1.9), ST, DS, M(x, y0 + (ph + 4.8 + r + 0.3) / 2, z, yawE), false);
      // keystone / plaque
      W(k, box(1.2, 0.9, 0.35), ST_L, DS, M(x, y0 + 4.8 + r + 0.4, z, yawE), false);
      W(k, box(Math.min(g.w - 1, 5.5), 0.7, 0.18), WOOD_D, 2, M(x, y0 + ph - 1.4, z, yawE), false);
      W(k, box(g.w + 0.6, 0.4, 2.2), ST_D, DS, M(x, y0 + ph + 0.2, z, yawE), false);
    }

    // Inner arena mouth / vomitorium portal (shell → arena) — town offsets, T + t2wYaw
    { const c = contourNearest(shell, g.lz), [x, z] = T(c.lx, c.lz), yaw = CO.t2wYaw(c.yaw), ca = Math.cos(c.yaw), sa = Math.sin(c.yaw), w = open;
      const gh = 5.6;
      for (const sd of [-1, 1]) {
        const [px, pz] = T(c.lx + ca * sd * (w / 2 + 1.0), c.lz - sa * sd * (w / 2 + 1.0));
        // [v307] full-height portal pier (was only gh) so it meets the 3-tier shell with zero slit
        W(k, box(2.2, totH, wt + 1.15), ST, DS, M(px, y0 + totH / 2, pz, yaw)); addBox(px, pz, 2.2, wt + 1.15, yaw);
        W(k, box(2.4, 0.4, wt + 1.35), ST_D, DS, M(px, y0 + totH - 0.15, pz, yaw), false);
        const [bx, bz] = T(c.lx + ca * sd * (w / 2 + 1.0) - c.nx * 0.6, c.lz - sa * sd * (w / 2 + 1.0) - c.nz * 0.6);
        banner(bx, y0 + 7.4, bz, yaw, 2.4, 1.15);
        W(k, box(2.3, 2.6, wt + 1.25), ST_D, DS, M(px, y0 - 1.3, pz, yaw), false);
      }
      arch(x, y0 + gh, z, yaw, w / 2 + 0.25, 0.42, wt + 1.0);
      W(k, box(w + 4.6, totH - gh - w / 2, wt + 0.5), ST, DS, M(x, (y0 + gh + w / 2 + y0 + totH) / 2, z, yaw), false);
      W(k, box(w + 4.8, 0.4, wt + 1.1), ST_D, DS, M(x, y0 + F0.tiers * tierH + 2.3, z, yaw), false);
      // [v307] full-height radial cheek walls (shell → cavea), stop short of pink ring walk
      for (const sd of [-1, 1]) {
        for (let off = 0.3; off <= SEAT0 + 0.4; off += 0.7) {
          const clx = c.lx - c.nx * off + ca * sd * (w / 2 + 0.55), clz = c.lz - c.nz * off - sa * sd * (w / 2 + 0.55);
          const [cxw, czw] = T(clx, clz);
          W(k, box(1.15, totH, 1.7), ST, DS, M(cxw, y0 + totH / 2, czw, yaw));
          W(k, box(1.3, 0.35, 1.85), ST_D, DS, M(cxw, y0 + totH - 0.15, czw, yaw), false);
          if (off < SEAT0 - 0.2) addBox(cxw, czw, 1.05, 1.5, yaw);
        }
        for (let r = 0; r < 4; r++) {
          const off = SEAT0 - r * 0.6, h = 1.2 + r * 1.1;
          const clx = c.lx - c.nx * off + ca * sd * (w / 2 + 1.35), clz = c.lz - c.nz * off - sa * sd * (w / 2 + 1.35);
          const [cxw, czw] = T(clx, clz);
          W(k, box(1.8, h, 0.75), r % 2 ? ST : ST_L, DS, M(cxw, y0 + h / 2, czw, yaw), false);
          if (r === 0) addBox(cxw, czw, 1.7, 0.7, yaw);
        }
      }
    }

    // Paving follows mainY ribbon
    const path = [T(g.lx, g.lz), T(g.lx + D, g.lz)];
    addDeck?.({ id: 'coli_main', path, ps: [0, D], hw: open / 2, yAtO: (s, o) => mainY(g.lx + s, g.lz + o), bb: [Math.min(...path.map(p => p[0])) - g.w, Math.max(...path.map(p => p[0])) + g.w, Math.min(...path.map(p => p[1])) - g.w, Math.max(...path.map(p => p[1])) + g.w] });
    for (let i = 0; i < 58; i++) { const lx = g.lx + (i + 0.5) * D / 58, [px, pz] = T(lx, g.lz), geom = box(D / 58 + 0.01, 0.1, open);
      const pos = geom.attributes.position; for (let j = 0; j < pos.count; j++) pos.setY(j, pos.getY(j) + mainY(lx + pos.getX(j), g.lz + pos.getZ(j)) - y0); geom.computeVertexNormals();
      W(k, geom, COB, CB, M(px, y0 - 0.05, pz, Y0W), false); }
    // low bevelled kerbs at base of side walls along the clear walk
    for (const sd of [-1, 1]) {
      const lz = g.lz + sd * (open / 2 - 0.14);
      for (let i = 0; i < 20; i++) {
        const lx = g.lx + (i + 0.5) * DW / 20, [kx, kz] = T(lx, lz);
        W(k, box(DW / 20 + 0.02, 0.22, 0.35), ST_D, DS, M(kx, mainY(lx, lz) + 0.08, kz, Y0W), false);
      }
    }
  }

  // Back-coliseum to fountain plaza stair
  { const L = CASTLE_STAIR.length, n = Math.ceil((CASTLE_JOIN.y - y0) / 0.17), step = (L - 19) / n;
    const path = CASTLE_STAIR.path.map(p => T(...p)), xs = path.map(p => p[0]), zs = path.map(p => p[1]), hw = CASTLE_RAMP_HW;
    addDeck?.({ id: 'coli_castle', path, ps: CASTLE_STAIR.ps, hw, yAt: castleY, bb: [Math.min(...xs) - hw, Math.max(...xs) + hw, Math.min(...zs) - hw, Math.max(...zs) + hw] });
    const slab = (a, b, ya, yb) => { const [ax, az] = T(...castleAt(a)), [bx, bz] = T(...castleAt(b)), len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax), y = (ya + yb) / 2;
      const geom = box(len + 0.05, 0.34, hw * 2), pos = geom.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + pos.getX(i) * (yb - ya) / len); geom.computeVertexNormals();
      W(k, geom, ST_L, DS, M((ax + bx) / 2, y - 0.17, (az + bz) / 2, yaw), false);
    };
    slab(0, 3, y0, y0); slab(L - 16, L, CASTLE_JOIN.y, CASTLE_JOIN.y);
    for (let i = 0; i < n; i++) { const a = 3 + i * step, b = a + step; slab(a, b, castleY((a + b) / 2), castleY((a + b) / 2)); }
    for (let a = 0; a < L - 16; a += 0.65) { const b = Math.min(L - 16, a + 0.65), [ax, az] = T(...castleAt(a)), [bx, bz] = T(...castleAt(b)), len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len, y = castleY((a + b) / 2), yaw = Math.atan2(-dz, dx);
      for (const sd of [-1, 1]) { const x = (ax + bx) / 2 - dz * sd * (hw + 0.3), z = (az + bz) / 2 + dx * sd * (hw + 0.3);
        W(k, box(len + 0.05, 1.15, 0.45), ST_D, DS, M(x, y + 0.45, z, yaw), false); addBox(x, z, len + 0.03, 0.45, yaw); }
    }
  }

  for (const s of COLI_STORES_ON ? NEW_STORES : []) {
    if (o.squadOverlap && o.squadOverlap(s.lx - s.d / 2, s.lx + s.d / 2, s.lz - s.w / 2, s.lz + s.w / 2)) continue;   // [Timothy v312] #46 vs the widened Squad Hall
    { const f = s.yaw > 0 ? 1 : -1, clx = s.lx + f * (s.d / 2 - 7), [rx, rz] = T(clx, s.lz);
      if (o.rentLot && o.rentLot({ id: s.id, x: rx, y: H(rx, rz), wz: rz, yaw: CO.t2wYaw(s.yaw), addBox, addCirc })) continue; }
    const [x, z] = T(s.lx, s.lz), y = H(x, z), yaw = CO.t2wYaw(s.yaw);
    const h = s.storeys === 1 ? Math.min(2.75, s.maxRoof || 2.8) : 6.2;
    W(k, box(s.w, h - 0.3, s.d), ST, DS, M(x, y + (h - 0.3) / 2, z, yaw));
    W(k, box(s.w + 0.5, 0.3, s.d + 0.5), ST_D, DS, M(x, y + h - 0.15, z, yaw), false);
    W(k, box(s.w + 0.2, 0.5, s.d + 0.2), ST_D, DS, M(x, y + 0.25, z, yaw), false);
    addBox(x, z, s.w + 0.4, s.d + 0.4, yaw);
  }
}
