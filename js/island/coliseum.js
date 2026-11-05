// [Emerly] PUMPFUN PIRATES intact colosseum (BANKSY approved 11:39 AM Nov 5): pink footprint east of Hill Street,
// down to the back of Fish Market / plaza #5–7. Kill switch: &coliseum=0 restores the pre-coli layout (old battle pads,
// red/blue stalls, quay leaderboards). Town-local frame (coast.js). Static art merges into the coast kit.
import * as THREE from 'three';
import { M } from './kit.js';
import * as CO from './coast.js';
import { FACADE_LZ, ROW_D, STREET_Y, SLAB, PLAZA_V2 } from './plazaTown.js';

export const COLISEUM_ON = !(typeof location !== 'undefined' && /[?&]coliseum=0(&|$)/.test(location.search));

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rectD = (lx, lz, R) => Math.hypot(Math.max(R.lx0 - lx, 0, lx - R.lx1), Math.max(R.lz0 - lz, 0, lz - R.lz1));

// Outer footprint (town-local): east of Hill Street, dock end at plaza shop backs (lz -44), castle end near roundabout.
// [Timothy v294] BANKSY 4:22 PM "the south end can come up a bit doesn't have to hang so far over edge of ground": map south = +lx
// (islandMap: north = -z = town -lx). The +lx shell edge sat on the lip of the 6 m drop east of lx 100; pulled in 96 -> 88.
export const FOOT = { lx0: 34, lx1: 88, lz0: -208, lz1: -44, y: 9.2, feather: 8, wall: 3.2, walk: 4.5, tiers: 3 };
export const ELL = { cx: (FOOT.lx0 + FOOT.lx1) / 2, cz: (FOOT.lz0 + FOOT.lz1) / 2, rx: (FOOT.lx1 - FOOT.lx0) / 2, rz: (FOOT.lz1 - FOOT.lz0) / 2 };
// Main entrance (remove stall_red/blue): between #36/#37 on east Hill Street
// R3/#36 ends at -109.949; R5/#37 starts at -119.573. The portal occupies that WHOLE bay.
// lx is the street-facing edge, exactly the neighboring shop door plane (14), not the ellipse edge (34).
export const MAIN_GATE = { lx: 14, lz: -114.761, w: 9.624, d: 29, opening: 6.824, shellLx: 34.3 };
// Back exit returns to the FOUNTAIN PLAZA at y20.1, not the upper castle approach.
// The old CASTLE_* export names are retained for callers. The route now ends on the lower plaza apron.
export const CASTLE_GATE = { lx: 43, lz: -184, w: 7 };
export const CASTLE_JOIN = { lx: 12, lz: -206, y: 20.1 };
export const CASTLE_RAMP_HW = 2.4;
// Rounded back flight and a 16m open landing into the fountain plaza. Terrain, art and walk deck share this profile.
const CP = [[CASTLE_GATE.lx, CASTLE_GATE.lz], [35, -194], [29, -201], [23, -206], [CASTLE_JOIN.lx, CASTLE_JOIN.lz]];
const rounded = [CP[0]];
for (let i = 1; i < CP.length - 1; i++) {
  const a = CP[i - 1], b = CP[i], c = CP[i + 1], la = Math.hypot(a[0]-b[0],a[1]-b[1]), lc = Math.hypot(c[0]-b[0],c[1]-b[1]);
  const r = Math.min(4, la / 3, lc / 3), u = b.map((v,j)=>v+(a[j]-v)*r/la), v = b.map((x,j)=>x+(c[j]-x)*r/lc);
  rounded.push(u); for (let j=1;j<=12;j++) { const t=j/12; rounded.push(u.map((x,k)=>(1-t)**2*x+2*(1-t)*t*b[k]+t*t*v[k])); }
}
rounded.push(CP.at(-1));
const PS = [0]; for (let i=1;i<rounded.length;i++) PS.push(PS[i-1]+Math.hypot(rounded[i][0]-rounded[i-1][0],rounded[i][1]-rounded[i-1][1]));
export const CASTLE_STAIR = { path: rounded, ps: PS, length: PS.at(-1) };
export function castleAt(s) { s = Math.max(0,Math.min(CASTLE_STAIR.length,s)); let i=1; while(i<PS.length-1 && PS[i]<s) i++;
  const t=(s-PS[i-1])/(PS[i]-PS[i-1]); return rounded[i-1].map((v,j)=>v+(rounded[i][j]-v)*t); }
export function castleY(s) {
  const L=CASTLE_STAIR.length;
  return FOOT.y+(CASTLE_JOIN.y-FOOT.y)*Math.max(0,Math.min(1,(s-3)/(L-19)));
}
export function castleSample(lx,lz) { let d=Infinity, s=0; for(let i=1;i<rounded.length;i++) {
  const a=rounded[i-1], b=rounded[i], dx=b[0]-a[0], dz=b[1]-a[1], t=Math.max(0,Math.min(1,((lx-a[0])*dx+(lz-a[1])*dz)/(dx*dx+dz*dz)));
  const dd=Math.hypot(lx-a[0]-dx*t,lz-a[1]-dz*t); if(dd<d) { d=dd; s=PS[i-1]+(PS[i]-PS[i-1])*t; }
} return { d, s, y: castleY(s) }; }
export const inMainAlley = (lx,lz,pad=0) => COLISEUM_ON && lx > MAIN_GATE.lx-2-pad && lx < MAIN_GATE.lx+MAIN_GATE.d+pad && Math.abs(lz-MAIN_GATE.lz)<MAIN_GATE.w/2+pad;
export function mainY(lx,lz) { // street crossfall at the mouth, easing onto the level arena; no threshold step
  const t=sm(MAIN_GATE.lx,MAIN_GATE.shellLx,lx), street=3+Math.max(0,-lz-50)*0.11;
  return street+(FOOT.y-street)*t;
}
// Cannon Hill / Cliff Battery exit (seaward-east)
export const BATTERY_GATE = { lx: +(ELL.cx + ELL.rx * Math.sqrt(1 - ((-120 - ELL.cz) / ELL.rz) ** 2)).toFixed(2), lz: -120, w: 4.5 };   // [v294] on the pulled-in shell
// [Timothy v294] BANKSY 4:58 PM "add colisuem entrance to plaza off of fish market" (+ photo: solid arches behind a sand ramp, beside the
// FISH MARKET): a grand gate in the plaza-end wall (ring segment 6 of 48, centred so only that bay opens) + a paved, walled approach that
// leaves the plaza in the open gap east of the FISH MARKET (lx 89.5-99), bends square onto the gate and climbs 2.73 -> 9.2 at ~1:4.4.
// Terrain, cobble paint, the walk deck and the art all share FISH_STAIR. &coliseum=0 = none of it.
const FG_A = 6.5 / 48 * 2 * Math.PI, FG_N = (() => { const nx = Math.cos(FG_A) / ELL.rx, nz = Math.sin(FG_A) / ELL.rz, l = Math.hypot(nx, nz); return [nx / l, nz / l]; })();
export const FISH_GATE = { lx: ELL.cx + Math.cos(FG_A) * ELL.rx, lz: ELL.cz + Math.sin(FG_A) * ELL.rz, w: 7.2, n: FG_N, plazaY: STREET_Y };
export const FISH_HW = 3.6;
const FG_OUT = 1.6, FG_IN = 8;
const FP = [[94.5, -41.2], [FISH_GATE.lx + FG_N[0] * 13, FISH_GATE.lz + FG_N[1] * 13], [FISH_GATE.lx + FG_N[0] * FG_OUT, FISH_GATE.lz + FG_N[1] * FG_OUT], [FISH_GATE.lx - FG_N[0] * FG_IN, FISH_GATE.lz - FG_N[1] * FG_IN]];
function roundPath(CPs, rmax) { const out = [CPs[0]];
  for (let i = 1; i < CPs.length - 1; i++) { const a = CPs[i - 1], b = CPs[i], c = CPs[i + 1], la = Math.hypot(a[0]-b[0],a[1]-b[1]), lc = Math.hypot(c[0]-b[0],c[1]-b[1]);
    const r = Math.min(rmax, la / 3, lc / 3), u = b.map((v,j)=>v+(a[j]-v)*r/la), v = b.map((x,j)=>x+(c[j]-x)*r/lc);
    out.push(u); for (let j=1;j<=12;j++) { const t=j/12; out.push(u.map((x,k)=>(1-t)**2*x+2*(1-t)*t*b[k]+t*t*v[k])); } }
  out.push(CPs.at(-1)); const ps = [0]; for (let i=1;i<out.length;i++) ps.push(ps[i-1]+Math.hypot(out[i][0]-out[i-1][0],out[i][1]-out[i-1][1])); return { path: out, ps, length: ps.at(-1) }; }
export const FISH_STAIR = roundPath(FP, 6);
FISH_STAIR.sTop = FISH_STAIR.length - (FG_IN + FG_OUT) - 0.4;   // reaches the arena level just outside the shell face
FISH_STAIR.sShell = FISH_STAIR.length - (FG_IN + FG_OUT);
export function fishAt(s) { const P = FISH_STAIR.path, PS = FISH_STAIR.ps; s = Math.max(0, Math.min(FISH_STAIR.length, s)); let i = 1; while (i < PS.length - 1 && PS[i] < s) i++;
  const t = (s - PS[i - 1]) / (PS[i] - PS[i - 1]); return P[i - 1].map((v, j) => v + (P[i][j] - v) * t); }
export const fishY = (s) => STREET_Y + (FOOT.y - STREET_Y) * Math.max(0, Math.min(1, (s - 1.5) / (FISH_STAIR.sTop - 1.5)));
export function fishSample(lx, lz) { const P = FISH_STAIR.path, PS = FISH_STAIR.ps; let d = Infinity, s = 0;
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((lx - a[0]) * dx + (lz - a[1]) * dz) / (dx * dx + dz * dz)));
    const dd = Math.hypot(lx - a[0] - dx * t, lz - a[1] - dz * t); if (dd < d) { d = dd; s = PS[i - 1] + (PS[i] - PS[i - 1]) * t; } }
  return { d, s, y: fishY(s) }; }
// lowest profile height within r of a point: inside the bend a terrain vertex can sit nearer the upper leg than the paving it shades,
// so the terrain cut takes the lowest nearby deck (never pokes through, the cheek walls hide any step)
const FISH_PTS = []; { for (let s = 0; s <= FISH_STAIR.length; s += 0.5) FISH_PTS.push([...fishAt(s), s]); }
function fishLowY(lx, lz, r) { for (const [x, z, s] of FISH_PTS) if (Math.hypot(lx - x, lz - z) < r) return fishY(s); return null; }
const nearFish = (lx, lz) => lx > 62 && lx < 112 && lz > -84 && lz < -30;
// cobble paint on the approach floor + a 2.5 m shoulder (foot.js colorAt / splatAt), 0..1
export function pave(lx, lz) { if (!COLISEUM_ON || !nearFish(lx, lz)) return 0; const f = fishSample(lx, lz); if (f.s > FISH_STAIR.sShell) return 0; return 1 - sm(FISH_HW + 1.5, FISH_HW + 3.5, f.d); }
// Empty rentable stores (next free numbers #45 / #46). #45 south of #20 = 1 storey, roof ≤ 2.8 m.
export const NEW_STORES = [
  { id: 'coli_store_45', n: 45, lx: -10.0, lz: -56.5, w: 16, d: 21, storeys: 1, maxRoof: 2.8, yaw: Math.PI / 2, label: 'EMPTY SHOP' },
  { id: 'coli_store_46', n: 46, lx: 22.0, lz: -56.5, w: 16, d: 21, storeys: 2, maxRoof: 0, yaw: -Math.PI / 2, label: 'EMPTY SHOP' },
];
// Same anchors as the rendered frames, live screens and walk-up prompts (scores untouched).
export const BOARD_POIS = CO.PLAZA_POIS.filter(q => q.id === 'waves' || q.id === 'arena');

export const near = (lx, lz) => COLISEUM_ON && (nearFish(lx, lz) || (lx > FOOT.lx0 - 12 && lx < FOOT.lx1 + 8 && lz > FOOT.lz0 - 12 && lz < FOOT.lz1 + 8) || inMainAlley(lx,lz,3) || castleSample(lx,lz).d < CASTLE_RAMP_HW+2);

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
  // Rectangular throat, aligned to the full alley (the former radial stamp missed the street end).
  const dg = Math.hypot(Math.max(MAIN_GATE.lx-lx,0,lx-MAIN_GATE.lx-MAIN_GATE.d),Math.max(Math.abs(lz-MAIN_GATE.lz)-MAIN_GATE.w/2,0));
  if (dg < 2) { const w=1-sm(0,2,dg); h=h*(1-w)+mainY(lx,lz)*w; }
  const ramp = castleSample(lx,lz), rd = ramp.d;
  if (rd < CASTLE_RAMP_HW+1.2) { const w=1-sm(CASTLE_RAMP_HW,CASTLE_RAMP_HW+1.2,rd); h=h*(1-w)+ramp.y*w; }

  // Rectangular coli feather used to bury the plaza shop backs (-42) in 6m of dirt.
  // Reserve the full facade row, not just two prompts, with one grid cell of clearance.
  // The 9.2m coliseum ground at lz <= -48 is unchanged.
  if (PLAZA_V2 && lx > SLAB.lx0-4 && lx < SLAB.lx1+4 && lz > FACADE_LZ-ROW_D-6) {
    const keep = sm(FACADE_LZ-ROW_D-6, FACADE_LZ-ROW_D-2, lz);
    h += (Math.min(h, STREET_Y-0.14)-h)*keep;
  }
  // [v294] fish-market approach: the sand bank in the open plaza gap is cut / filled to the paved ramp (after the shop-back clamp,
  // which it overrides only inside its own corridor east of the FISH MARKET; west of lx 89.5 it only ever lowers to plaza level).
  let fd = 99;
  if (nearFish(lx, lz)) { const f = fishSample(lx, lz); fd = f.d;
    if (f.d < FISH_HW + 8.5 && f.s < FISH_STAIR.sShell + 1) { const w = 1 - sm(FISH_HW + 4.5, FISH_HW + 8.5, f.d), ty = Math.min(f.y, fishLowY(lx, lz, FISH_HW + 6) ?? f.y) - 0.12;   // full cut 4.5 m past the paving: the 4 m terrain grid never pokes through
      h = h * (1 - w) + (lx < 93 && lz > -46 ? Math.min(h, ty) : ty) * w; } }
  return { h, d: Math.min(d, dg, rd, fd + 4) };
}

export function clearAt(lx, lz) {
  if (!near(lx, lz)) return 0;
  if (inMainAlley(lx,lz,2) || castleSample(lx,lz).d < CASTLE_RAMP_HW+2 || rectD(lx, lz, FOOT) < 6) return 1;
  if (nearFish(lx, lz) && fishSample(lx, lz).d < FISH_HW + 8) return 1;
  if (Math.hypot(lx - MAIN_GATE.lx, lz - MAIN_GATE.lz) < MAIN_GATE.w + 2) return 1;
  for (const s of NEW_STORES) {
    if (Math.abs(lx - s.lx) < s.d / 2 + 2 && Math.abs(lz - s.lz) < s.w / 2 + 2) return 1;
  }
  return 0;
}

// [Timothy v273] plaza-quality art pass: intact Roman shell in dressed stone (look layer 11, same as the plaza / fort), true round
// arches on every tier, attic + crenellated parapet, continuous cobbled ring walk, stepped seating podium, sand arena floor,
// arched gates, a stepped back stair to the fountain plaza. Colliders: outer wall + podium + gate piers only (arena floor / stair / ring walk open).
export function buildArt(o) {
  if (!COLISEUM_ON) return;
  const { k, W, box, cyl, T, H, addBox, addCirc, torchPost, addDeck, F, C } = o;
  const ST = 0xc4b8a2, ST_L = 0xd3c8b3, ST_D = 0x8f8474, SAND = 0xd4bc8c, COB = 0xc9a090, WOOD_D = C.WOOD_D || 0x6b4527;
  const DS = 11, CB = 10, SA = 8; // look layers: dressed stone, cobbles, sand
  const F0 = FOOT, cx = (F0.lx0 + F0.lx1) / 2, cz = (F0.lz0 + F0.lz1) / 2;
  const rx = (F0.lx1 - F0.lx0) / 2, rz = (F0.lz1 - F0.lz0) / 2;
  const y0 = F0.y, tierH = 3.6, N = 48, wt = 1.85, Y0W = CO.t2wYaw(0);
  const P = (a, off = 0) => T(cx + Math.cos(a) * (rx - off), cz + Math.sin(a) * (rz - off));
  const seg = (i, off = 0) => { const a0 = i / N * 2 * Math.PI, a1 = (i + 1) / N * 2 * Math.PI, am = (a0 + a1) / 2;
    const [x0, z0] = P(a0, off), [x1, z1] = P(a1, off), [xm, zm] = P(am, off);
    return { a0, am, x0, z0, xm, zm, span: Math.hypot(x1 - x0, z1 - z0), yaw: Math.atan2(-(z1 - z0), x1 - x0) }; };
  const gateHit = (i) => { const am = (i + 0.5) / N * 2 * Math.PI, lx = cx + Math.cos(am) * rx, lz = cz + Math.sin(am) * rz;
    for (const g of [MAIN_GATE, CASTLE_GATE, BATTERY_GATE, FISH_GATE]) if (Math.hypot(lx - (g.shellLx ?? g.lx), lz - g.lz) < Math.max(g.w * 0.75, 5.5)) return g; return null; };
  const archG = (r, tube) => new THREE.TorusGeometry(r, tube, 4, 10, Math.PI);
  const arch = (x, y, z, yaw, r, tube = 0.28, depth = 1) => { // archivolt ring + keystone, standing in the wall plane
    const g = archG(r, tube); g.scale(1, 1, depth / tube / 2); W(k, g, ST_L, DS, M(x, y, z, yaw), false);
    W(k, box(0.5, 0.7, depth + 0.1), ST_L, DS, M(x, y + r + 0.15, z, yaw), false); };

  // sand arena floor (ellipse, open) + low kerb where the ring walk meets it
  { const [x, z] = T(cx, cz), g = new THREE.CylinderGeometry(1, 1, 0.2, 40); g.scale(rx - 8.2, 1, rz - 8.2);
    W(k, g, SAND, SA, M(x, y0 + 0.06, z, Y0W), false); }
  for (let i = 0; i < N; i++) { const s = seg(i, 8.1); W(k, box(s.span * 1.04, 0.22, 0.5), ST_D, DS, M(s.xm, y0 + 0.1, s.zm, s.yaw), false); }

  // plan colors: soft yellow musket pad (castle end) + purple sword pad (dock end) on the sand
  { const YEL = 0xbca779, PUR = 0xb5a48b;
    const [mx, mz] = T(62, -156); W(k, box(32, 0.08, 28), YEL, SA, M(mx, y0 + 0.1, mz, Y0W), false);   // [v294] follows battleAreas RANGE / PIT
    const [px, pz] = T(61, -84); W(k, new THREE.CylinderGeometry(12, 12, 0.08, 28), PUR, SA, M(px, y0 + 0.1, pz), false); }

  // Worn flag patches break up the gritty earth at human scale (all look-layer, no floor colliders).
  for(let row=0;row<45;row++) for(let col=0;col<15;col++) {
    const lx=43+col*3+(row%2)*1.5,lz=-194+row*3.1, v=Math.sin(row*127.1+col*311.7)*43758.5453, h=v-Math.floor(v);
    if(((lx-cx)/(rx-9))**2+((lz-cz)/(rz-9))**2>0.94 || h<0.58) continue;
    const [x,z]=T(lx,lz); W(k,box(0.8+h*1.1,0.035,0.6+h*0.9),h>0.8?0xb4a58c:0xc5b69b,DS,M(x,y0+0.18,z,Y0W+h*0.28),false);
  }

  // continuous cobbled ring walk (pink) between the podium and the arena
  for (let i = 0; i < N; i++) { const s = seg(i, 5.6); W(k, box(s.span * 1.06, 0.16, 4.6), COB, CB, M(s.xm, y0 + 0.07, s.zm, s.yaw), false); }

  // seating podium + stepped cavea against the shell (solid stone, colliding front)
  // [v294] the two bays either side of the fish-market gate stop 1.8 m short of it, so the 7.2 m approach runs on into the ring walk
  const fgi = Math.round(FG_A / (2 * Math.PI) * N - 0.5), trim = (i, s) => { const t = i === fgi - 1 ? 1 : i === fgi + 1 ? -1 : 0; if (!t) return s;
    const c = 1.8, ux = Math.cos(s.yaw), uz = -Math.sin(s.yaw); return { ...s, span: s.span - c, xm: s.xm - ux * t * c / 2, zm: s.zm - uz * t * c / 2 }; };
  for (let i = 0; i < N; i++) {
    if (gateHit(i)) continue;
    for (let r = 0; r < 4; r++) { const s = trim(i, seg(i, 3.3 - r * 0.6)), h = 1.2 + r * 1.1;
      W(k, box(s.span * 1.05, h, 0.7), r % 2 ? ST : ST_L, DS, M(s.xm, y0 + h / 2, s.zm, s.yaw), r === 0); }
    const s = trim(i, seg(i, 3.1)); addBox(s.xm, s.zm, s.span * 1.02, 1.0, s.yaw);
    if (i % 3 === 0) { const t = seg(i, 3.9); torchPost?.(k, F, t.xm, y0, t.zm); addCirc(t.xm, t.zm, 0.25); }
  }

  // outer shell: 3 arcaded tiers + attic + parapet with merlons
  for (let i = 0; i < N; i++) {
    const s = seg(i), g = gateHit(i), [px, pz] = [s.x0, s.z0];
    const totH = F0.tiers * tierH + 2.6;
    // pier + engaged half-column — skip if the pier sits inside a gate opening (gateArt owns those piers)
    const pierInGate = (() => { const lx = cx + Math.cos(s.a0) * rx, lz = cz + Math.sin(s.a0) * rz;
      for (const gg of [MAIN_GATE, CASTLE_GATE, BATTERY_GATE, FISH_GATE]) if (Math.hypot(lx - (gg.shellLx ?? gg.lx), lz - gg.lz) < gg.w * 0.65) return true; return false; })();
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
  gateArt(CASTLE_GATE, false); gateArt(BATTERY_GATE, false); gateArt(FISH_GATE, true);

  // [v294] GRAND ENTRANCE off the fish-market plaza: paved ramp (cobbles on the exact walk-deck profile), dressed-stone cheek / retaining
  // walls (solid, collide), entrance pylons with torches on the plaza, red banners on the gate piers. Opening = FISH_HW * 2 = 7.2 m.
  { const FS = FISH_STAIR, L = FS.sShell, hw = FISH_HW, path = FS.path.map(p => T(...p)), xs = path.map(p => p[0]), zs = path.map(p => p[1]);
    addDeck?.({ id: 'coli_fish', path, ps: FS.ps, hw, yAt: fishY, bb: [Math.min(...xs) - hw, Math.max(...xs) + hw, Math.min(...zs) - hw, Math.max(...zs) + hw] });
    const frame = (s) => { const a = fishAt(s - 0.05), b = fishAt(s + 0.05), l = Math.hypot(b[0] - a[0], b[1] - a[1]); return { p: fishAt(s), dx: (b[0] - a[0]) / l, dz: (b[1] - a[1]) / l }; };
    for (let a = 0; a < FS.length - 0.01; a += 0.6) { const b = Math.min(FS.length, a + 0.6), [ax, az] = T(...fishAt(a)), [bx, bz] = T(...fishAt(b)), len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax), ya = fishY(a), yb = fishY(b);
      const geom = box(len + 0.06, 0.3, hw * 2 + 0.2), pos = geom.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + pos.getX(i) * (yb - ya) / Math.max(len, 1e-3)); geom.computeVertexNormals();
      W(k, geom, COB, CB, M((ax + bx) / 2, (ya + yb) / 2 - 0.12, (az + bz) / 2, yaw), false);
      if (Math.round(a / 0.6) % 4 === 0) W(k, box(0.35, 0.06, hw * 2), ST_D, DS, M((ax + bx) / 2, (ya + yb) / 2 + 0.04, (az + bz) / 2, yaw), false); }   // stone bands across the paving
    for (let a = 0; a < L - 0.3; a += 0.7) { const b = Math.min(L - 0.3, a + 0.7), m = frame((a + b) / 2), [ax, az] = T(...fishAt(a)), [bx, bz] = T(...fishAt(b)), len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax), y = fishY((a + b) / 2);
      for (const sd of [-1, 1]) { const ox = -m.dz * sd, oz = m.dx * sd, [x, z] = T(m.p[0] + ox * (hw + 0.35), m.p[1] + oz * (hw + 0.35)), [gx, gz] = T(m.p[0] + ox * (hw + 7), m.p[1] + oz * (hw + 7));
        const top = Math.max(y + 1.05, Math.min(H(gx, gz) + 0.35, y + 4.5)), bot = Math.min(y, H(x, z)) - 0.6;
        W(k, box(len + 0.06, top - bot, 0.6), ST, DS, M(x, (top + bot) / 2, z, yaw), false);
        W(k, box(len + 0.1, 0.16, 0.78), ST_L, DS, M(x, top + 0.08, z, yaw), false); addBox(x, z, len + 0.03, 0.6, yaw); } }
    { const m = frame(0.3); for (const sd of [-1, 1]) { const lx = m.p[0] - m.dz * sd * (hw + 0.6), lz = m.p[1] + m.dx * sd * (hw + 0.6), [x, z] = T(lx, lz), y = STREET_Y;
        W(k, box(1.5, 4.2, 1.5), ST, DS, M(x, y + 2.1, z, Y0W)); W(k, box(1.8, 0.35, 1.8), ST_D, DS, M(x, y + 4.35, z, Y0W), false);
        W(k, box(1.2, 0.7, 1.2), ST_L, DS, M(x, y + 4.85, z, Y0W), false); torchPost?.(k, F, x, y + 5.2, z); addBox(x, z, 1.6, 1.6, Y0W); } }
    { const g = FISH_GATE, a = Math.atan2((g.lz - cz) / rz, (g.lx - cx) / rx), [x, z] = P(a), [x2, z2] = P(a + 0.01), yaw = Math.atan2(-(z2 - z), x2 - x), ca = Math.cos(yaw), sa = Math.sin(yaw), [nx, nz] = g.n;
      for (const sd of [-1, 1]) { const [bx, bz] = T(g.lx + nx * (wt / 2 + 0.55), g.lz + nz * (wt / 2 + 0.55)), px = bx + ca * sd * (g.w / 2 + 0.9), pz = bz - sa * sd * (g.w / 2 + 0.9);
        W(k, box(1.3, 4.6, 0.08), 0xb32a22, 12, M(px, y0 + 6.6, pz, yaw), false); W(k, box(1.4, 0.2, 0.2), C.IRON || 0x2b2f36, 2, M(px, y0 + 8.95, pz, yaw), false); } }
  }

  // Main portal: facade flush with #36/#37; parallel return walls fill the alley to the ellipse.
  { const g=MAIN_GATE, D=g.d, ph=10.8, th=1.4;
    for(const sd of [-1,1]) { const lz=g.lz+sd*(g.w/2-th/2), [x,z]=T(g.lx+D/2,lz);
      W(k,box(D,ph,th),ST,DS,M(x,y0+ph/2,z,Y0W),false); addBox(x,z,D,th,Y0W);
      W(k,box(D,0.3,th+0.2),ST_D,DS,M(x,y0+ph+0.15,z,Y0W),false); }
    // A proper arched face inside the full-width bay; no geometry sticks west of the shopfront plane.
    const [x,z]=T(g.lx+0.9,g.lz), yaw=CO.t2wYaw(Math.PI/2), r=g.opening/2;
    arch(x,y0+4.8,z,yaw,r,0.28,1.8);
    W(k,box(g.w,ph-4.8-r-0.3,1.8),ST,DS,M(x,y0+(ph+4.8+r+0.3)/2,z,yaw),false);
    // Paving follows the same crossfall-to-flat ribbon as the terrain and the precise walk deck.
    const path=[T(g.lx,g.lz),T(g.lx+D,g.lz)];
    addDeck?.({id:'coli_main',path,ps:[0,D],hw:g.opening/2,yAtO:(s,o)=>mainY(g.lx+s,g.lz+o),bb:[Math.min(...path.map(p=>p[0]))-g.w,Math.max(...path.map(p=>p[0]))+g.w,Math.min(...path.map(p=>p[1]))-g.w,Math.max(...path.map(p=>p[1]))+g.w]});
    for(let i=0;i<58;i++) { const lx=g.lx+(i+0.5)*D/58, [px,pz]=T(lx,g.lz), geom=box(D/58+0.01,0.1,g.opening);
      const pos=geom.attributes.position; for(let j=0;j<pos.count;j++) pos.setY(j,pos.getY(j)+mainY(lx+pos.getX(j),g.lz+pos.getZ(j))-y0); geom.computeVertexNormals();
      W(k,geom,COB,CB,M(px,y0-0.05,pz,Y0W),false); }
  }
  // Back-coliseum to fountain plaza stair: constant small risers, flush landings and an exact PATH walk deck.
  { const L=CASTLE_STAIR.length, n=Math.ceil((CASTLE_JOIN.y-y0)/0.17), step=(L-19)/n;
    const path=CASTLE_STAIR.path.map(p=>T(...p)), xs=path.map(p=>p[0]), zs=path.map(p=>p[1]), hw=CASTLE_RAMP_HW;
    addDeck?.({id:'coli_castle',path,ps:CASTLE_STAIR.ps,hw,yAt:castleY,bb:[Math.min(...xs)-hw,Math.max(...xs)+hw,Math.min(...zs)-hw,Math.max(...zs)+hw]});
    const slab=(a,b,ya,yb)=> { const [ax,az]=T(...castleAt(a)),[bx,bz]=T(...castleAt(b)),len=Math.hypot(bx-ax,bz-az),yaw=Math.atan2(-(bz-az),bx-ax),y=(ya+yb)/2;
      const geom=box(len+0.05,0.34,hw*2), pos=geom.attributes.position;
      for(let i=0;i<pos.count;i++) pos.setY(i,pos.getY(i)+pos.getX(i)*(yb-ya)/len); geom.computeVertexNormals();
      W(k,geom,ST_L,DS,M((ax+bx)/2,y-0.17,(az+bz)/2,yaw),false);
    };
    slab(0,3,y0,y0); slab(L-16,L,CASTLE_JOIN.y,CASTLE_JOIN.y);
    for(let i=0;i<n;i++) { const a=3+i*step,b=a+step; slab(a,b,castleY((a+b)/2),castleY((a+b)/2)); }
    // Short cheek segments track bends without intruding on the open 6.4 m walk. Stop short at the plaza join.
    for(let a=0;a<L-16;a+=0.65) { const b=Math.min(L-16,a+0.65),[ax,az]=T(...castleAt(a)),[bx,bz]=T(...castleAt(b)),len=Math.hypot(bx-ax,bz-az),dx=(bx-ax)/len,dz=(bz-az)/len,y=castleY((a+b)/2),yaw=Math.atan2(-dz,dx);
      for(const sd of [-1,1]) { const x=(ax+bx)/2-dz*sd*(hw+0.3),z=(az+bz)/2+dx*sd*(hw+0.3);
        W(k,box(len+0.05,1.15,0.45),ST_D,DS,M(x,y+0.45,z,yaw),false); addBox(x,z,len+0.03,0.45,yaw); }
    }
  }

  // new empty store shells (dressed stone, cornice); #45 stays one storey under 2.8 m so the Treasure sign reads
  for (const s of NEW_STORES) {
    { const f = s.yaw > 0 ? 1 : -1, clx = s.lx + f * (s.d / 2 - 7), [rx, rz] = T(clx, s.lz);   // [Emerly] BANKSY: rentable like the hill street shops (front kept on the street line)
      if (o.rentLot && o.rentLot({ id: s.id, x: rx, y: H(rx, rz), wz: rz, yaw: CO.t2wYaw(s.yaw), addBox, addCirc })) continue; }
    const [x, z] = T(s.lx, s.lz), y = H(x, z), yaw = CO.t2wYaw(s.yaw);
    const h = s.storeys === 1 ? Math.min(2.75, s.maxRoof || 2.8) : 6.2;
    W(k, box(s.w, h - 0.3, s.d), ST, DS, M(x, y + (h - 0.3) / 2, z, yaw));
    W(k, box(s.w + 0.5, 0.3, s.d + 0.5), ST_D, DS, M(x, y + h - 0.15, z, yaw), false);
    W(k, box(s.w + 0.2, 0.5, s.d + 0.2), ST_D, DS, M(x, y + 0.25, z, yaw), false);
    addBox(x, z, s.w + 0.4, s.d + 0.4, yaw);
  }
}
