// [backpack-pvp] BANKSY t1693u + t1695u: Island Safe Zones (on-foot no-PvP sanctuaries).
//   t1695u "Make cottages to dock all safe zone, don't interfere with coliseum games":
//   ONE continuous corridor  Cottage Village -> Trail A -> Main Street / Hill Street (#33..#36) -> Harbor Plaza -> Main Dock
//   (jetties J1..J5 + boardwalk + old piers P3/P4), plus the Swim Cove lagoon.
//   The Coliseum (arena floor, stands, outer walls + 8 m skirt, main-gate gallery) and every sword pit / musket range are
//   ALWAYS outside (isInsideColiseum wins over every zone) and never get the 3 s exit-grace weapon lock.
//   Active treasure DIG_SPOTS are carved out (stay contested).
// Kill switch: &safezones=0. Pure data (no three.js): unit tests + the island map import it.
// FRAMES: zones are authored town-local (coast.js t2w / w2t: lx along the waterfront, +lz out to sea) and every public test
// takes FOOT-world (x, z) = the island map / digSpots frame. The on-foot walker + scene use the HARBOR frame: use the *H helpers.
import { t2w, w2t, toHarbor, fromHarbor } from './coast.js';
import { DIG_SPOTS } from './digSpots.js';

export const SAFE_GRACE_S = 3;
export const SAFEZONES_ON = !(typeof location !== 'undefined' && /[?&]safezones=0(&|$)/.test(location.search || ''));
export const CORRIDOR_ID = 'cottages_to_dock';
export const CORRIDOR_NAME = 'Cottages-to-Dock Sanctuary';

// ---- Coliseum exclusion (mirrors js/island/coliseum.js FOOT / ELL / MAIN_GATE; tests check the numbers match) ----
export const COLI = Object.freeze({ lx0: 34, lx1: 88, lz0: -200, lz1: -72, p: 2.7, skirt: 8,
  gate: Object.freeze({ lx: 14, lz: -114.761, w: 9.624, d: 29, pad: 2.5 }) });
const ECX = (COLI.lx0 + COLI.lx1) / 2, ECZ = (COLI.lz0 + COLI.lz1) / 2, ERX = (COLI.lx1 - COLI.lx0) / 2, ERZ = (COLI.lz1 - COLI.lz0) / 2;
const ellF = (lx, lz) => Math.abs((lx - ECX) / ERX) ** COLI.p + Math.abs((lz - ECZ) / ERZ) ** COLI.p;
/** Outward distance (m) from the coliseum shell; 0 inside. Same maths as coliseum.js ellOutD. */
export function coliOutD(lx, lz) { const f = ellF(lx, lz); if (f <= 1) return 0; const s = f ** (-1 / COLI.p); return Math.hypot((lx - ECX) * (1 - s), (lz - ECZ) * (1 - s)); }
// battle pads in BOTH layouts (coliseum on: inside the shell; &coliseum=0: the old west range + east pit) — battleAreas.js
const PADS = Object.freeze([
  { kind: 'rect', lx0: 47, lx1: 75, lz0: -164, lz1: -136 }, { kind: 'circ', lx: 61, lz: -101, r: 12.5 },        // coli range + pit
  { kind: 'rect', lx0: -130, lx1: -78, lz0: -168, lz1: -120 }, { kind: 'circ', lx: 60, lz: -86, r: 16 },        // old range + pit
]);
function inColiTown(lx, lz) {
  if (coliOutD(lx, lz) < COLI.skirt) return true;                                                                   // floor + stands + walls + skirt
  const g = COLI.gate; if (lx > g.lx - 2 - g.pad && lx < g.lx + g.d + g.pad && Math.abs(lz - g.lz) < g.w / 2 + g.pad) return true; // vomitorium gallery
  for (const p of PADS) if (p.kind === 'rect' ? (lx > p.lx0 && lx < p.lx1 && lz > p.lz0 && lz < p.lz1) : Math.hypot(lx - p.lx, lz - p.lz) < p.r) return true;
  return false;
}
/** Foot-world: anywhere in / on the Coliseum (or a battle pad). Always PvP-live, never a Safe Zone. */
export function isInsideColiseum(x, z) { const [lx, lz] = w2t(x, z); return inColiTown(lx, lz); }

// ---- the corridor (town-local shapes; union) ----
// rect: [lx0, lx1, lz0, lz1]; cap: polyline in FOOT coords + half-width hw; circ: FOOT centre + r
const R = (part, name, lx0, lx1, lz0, lz1) => Object.freeze({ part, name, kind: 'rect', lx0, lx1, lz0, lz1 });
export const TRAIL_A_LINK = Object.freeze([[-446, -88], [-435, -84], [-428, -100], [-416, -119.3], [-404.8, -136.8], [-391.1, -156]]); // foot.js TRAIL_A spline, gate -> cottage lane joins
export const SAFE_PARTS = Object.freeze([
  R('harbor_plaza', 'Harbor Plaza & Main Dock', -180, 104, -58, 70),        // plazaTown.js PLAZA.bounds (-176..100, -56..66) + 4 m: shops, halls, boardwalk, jetties J1..J5, berths
  R('old_boardwalk', 'Harbor Plaza & Main Dock', -304, -176, -6, 10),       // coast.js BOARDWALK west leg -> old piers
  R('pier3', 'Harbor Plaza & Main Dock', -236, -184, 2, 46), R('pier4', 'Harbor Plaza & Main Dock', -296, -244, 2, 46),
  R('hill_street', 'Hill Street & Squad Hall', -18, 24, -212, -54),         // Main Street lx 6 ± 7 + both lot rows (#34+#35 / #36 east, lx <= 23)
  R('squad_hall', 'Hill Street & Squad Hall', 12, 30, -86, -54),            // hillShops SQUAD_HALL rect (lx 14..28.5, lz -83..-59) + 1.5 m
  Object.freeze({ part: 'trail_a', name: 'Trail A', kind: 'cap', pts: TRAIL_A_LINK, hw: 9 }),
  Object.freeze({ part: 'cottage_village', name: 'Cottage Village', kind: 'circ', x: -380, z: -134, r: 44 }), // 4 doorsteps + lane + wishing well
]);
export const EXTRA_ZONES = Object.freeze([
  Object.freeze({ id: 'swim_cove', part: 'swim_cove', name: 'Swim Cove Lagoon', kind: 'circ', x: -592, z: -334, r: 50 }),
  // [backpack-pvp] BANKSY t1712u "Make fishing a safe zone too": Grandpa Gill (-199.5, -61.5), the south-shore dock (-205, -63..-97), the
  // lagoon_fish cast spot (-205, -95.8) + the whole Freshwater Lagoon shore (js/island/areas/lagoon.js LAKE { -205, -130, r 58 })
  Object.freeze({ id: 'fishing_lagoon', part: 'fishing_lagoon', name: "Grandpa Gill's Fishing Dock", kind: 'circ', x: -205, z: -120, r: 72 }),
]);
export const LAKE = Object.freeze({ x: -205, z: -130, r: 58 }); // lantern posts never stand in the lake
// active digs stay contested: a carve-out ring round each (never on the walk: dig6 sits 12 m behind the boardwalk)
export const DIG_CARVE = Object.freeze(DIG_SPOTS.filter((d) => d.active).map((d) => Object.freeze({ id: d.id, x: d.x, z: d.z, r: Math.max(6, d.clear || 0) + 2 })));

function segD(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
function inPart(p, x, z, lx, lz) {
  if (p.kind === 'rect') return lx >= p.lx0 && lx <= p.lx1 && lz >= p.lz0 && lz <= p.lz1;
  if (p.kind === 'circ') return Math.hypot(x - p.x, z - p.z) <= p.r;
  if (p.kind === 'cap') { for (let i = 1; i < p.pts.length; i++) if (segD(x, z, ...p.pts[i - 1], ...p.pts[i]) <= p.hw) return true; return false; }
  return false;
}
const CORRIDOR_ZONE = Object.freeze({ id: CORRIDOR_ID, name: CORRIDOR_NAME });
/** Foot-world: the zone (with .part / .name of the piece you stand in) or null. */
export function zoneAt(x, z) {
  if (!SAFEZONES_ON) return null;
  const [lx, lz] = w2t(x, z);
  if (inColiTown(lx, lz)) return null;                                   // Coliseum exclusion guarantee
  for (const d of DIG_CARVE) if (Math.hypot(x - d.x, z - d.z) < d.r) return null;
  for (const p of SAFE_PARTS) if (inPart(p, x, z, lx, lz)) return { ...CORRIDOR_ZONE, part: p.part, label: p.name };
  for (const p of EXTRA_ZONES) if (inPart(p, x, z, lx, lz)) return { id: p.id, name: p.name, part: p.part, label: p.name };
  return null;
}
export const insideSafeZone = (x, z) => !!zoneAt(x, z);
export const inIslandSafeZone = insideSafeZone; // part-1 name
// HARBOR-frame (scene / walker.w) wrappers
export const zoneAtH = (hx, hz) => zoneAt(...fromHarbor(hx, hz));
export const insideSafeZoneH = (hx, hz) => !!zoneAtH(hx, hz);
export const isInsideColiseumH = (hx, hz) => isInsideColiseum(...fromHarbor(hx, hz));

/** Bookkeeping for exit grace (mirrors js/dock/safe.js). FOOT coords. Entering the Coliseum clears the grace at once. */
export function tickIsleSafe(state, x, z, now) {
  const zn = zoneAt(x, z), inn = !!zn;
  if (state._isleSafe && !inn) state._isleSafeOut = now;
  if (!inn && isInsideColiseum(x, z)) state._isleSafeOut = 0;           // never a weapon lock inside the Coliseum
  state._isleSafe = inn; state._isleSafeZone = zn;
  return zn;
}
export function graceLeft(state, now, graceS = SAFE_GRACE_S) {
  if (state?._isleSafe) return 0;
  if (state?._isleSafeOut && now - state._isleSafeOut < graceS) return graceS - (now - state._isleSafeOut);
  return 0;
}
/** Can this pirate deal / take on-foot PvP damage at FOOT (x, z)? Coliseum = always yes (games untouched); cottage interior = never. */
export function canFightOnFoot(state, x, z, now, opts = {}) {
  if (opts.inHouse) return false;
  if (!SAFEZONES_ON) return true;
  if (isInsideColiseum(x, z)) return true;
  if (zoneAt(x, z)) return false;
  if (graceLeft(state || {}, now ?? 0, opts.graceS ?? SAFE_GRACE_S) > 0) return false;
  return true;
}

// ---- drawing helpers (island map / ward lanterns): every shape in FOOT coords ----
const rectPoly = (p) => [[p.lx0, p.lz0], [p.lx1, p.lz0], [p.lx1, p.lz1], [p.lx0, p.lz1]].map(([a, b]) => t2w(a, b));
/** [{ kind:'poly', pts } | { kind:'cap', pts, hw } | { kind:'circ', x, z, r }] (corridor + extras), foot coords. */
export function safeShapes() {
  const out = [];
  for (const p of [...SAFE_PARTS, ...EXTRA_ZONES]) {
    if (p.kind === 'rect') out.push({ part: p.part, kind: 'poly', pts: rectPoly(p) });
    else if (p.kind === 'cap') out.push({ part: p.part, kind: 'cap', pts: p.pts.map((q) => [...q]), hw: p.hw });
    else out.push({ part: p.part, kind: 'circ', x: p.x, z: p.z, r: p.r });
  }
  return out;
}
/** Coliseum exclusion outline (shell + skirt) + gallery, foot coords, for carving on the map. */
export function coliseumExclusion(n = 96) {
  const pts = [];
  for (let i = 0; i < n; i++) { const th = i / n * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    const sp = (v) => Math.sign(v || 1) * Math.abs(v) ** (2 / COLI.p);
    const lx = ECX + ERX * sp(c), lz = ECZ + ERZ * sp(s);
    const dx = lx - ECX, dz = lz - ECZ, nx = COLI.p / ERX * Math.sign(dx || 1) * Math.abs(dx / ERX) ** (COLI.p - 1), nz = COLI.p / ERZ * Math.sign(dz || 1) * Math.abs(dz / ERZ) ** (COLI.p - 1), L = Math.hypot(nx, nz) || 1;
    pts.push(t2w(lx + nx / L * COLI.skirt, lz + nz / L * COLI.skirt)); }
  const g = COLI.gate, hw = g.w / 2 + g.pad;
  return { shell: pts, gallery: [[g.lx - 2 - g.pad, g.lz - hw], [g.lx + g.d + g.pad, g.lz - hw], [g.lx + g.d + g.pad, g.lz + hw], [g.lx - 2 - g.pad, g.lz + hw]].map(([a, b]) => t2w(a, b)),
    centre: t2w(ECX, ECZ), digs: DIG_CARVE.map((d) => ({ ...d })) };
}
/** Ward-lantern posts along the OUTER edge of the union (not inside another piece, never in the Coliseum), foot coords. */
export function wardPosts(step = 14) {
  const out = [], on = (x, z) => { // a point on a piece's edge is a union-boundary post when a step outward leaves every zone
    const [lx, lz] = w2t(x, z); if (inColiTown(lx, lz) || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 2) return; out.push([x, z]); };
  const edge = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; // either side: keep it if one side is outside the union
      if (!insideSafeZone(x + nx * 1.5, z + nz * 1.5) || !insideSafeZone(x - nx * 1.5, z - nz * 1.5)) { if (insideSafeZone(x + nx * 0.4, z + nz * 0.4) || insideSafeZone(x - nx * 0.4, z - nz * 0.4)) on(x, z); } } };
  for (const s of safeShapes()) {
    if (s.kind === 'poly') for (let i = 0; i < s.pts.length; i++) edge(s.pts[i], s.pts[(i + 1) % s.pts.length]);
    else if (s.kind === 'circ') { const n = Math.max(8, Math.round(2 * Math.PI * s.r / step)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = s.x + Math.cos(a) * s.r, z = s.z + Math.sin(a) * s.r;
      if (!insideSafeZone(x + Math.cos(a) * 1.5, z + Math.sin(a) * 1.5) && insideSafeZone(x - Math.cos(a) * 0.4, z - Math.sin(a) * 0.4)) on(x, z); } }
    else if (s.kind === 'cap') for (let i = 1; i < s.pts.length; i++) { const a = s.pts[i - 1], b = s.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
      for (const sd of [-1, 1]) edge([a[0] + nx * s.hw * sd, a[1] + nz * s.hw * sd], [b[0] + nx * s.hw * sd, b[1] + nz * s.hw * sd]); }
  }
  return out;
}
/** Part-1 name kept for old callers: one ring-ish entry per piece (map legend only). */
export function mapSafeZoneRings() {
  return [...SAFE_PARTS, ...EXTRA_ZONES].map((p) => {
    if (p.kind === 'circ') return { id: p.part, name: p.name, x: p.x, z: p.z, r: p.r };
    if (p.kind === 'cap') { const m = p.pts[Math.floor(p.pts.length / 2)]; return { id: p.part, name: p.name, x: m[0], z: m[1], r: p.hw }; }
    const [x, z] = t2w((p.lx0 + p.lx1) / 2, (p.lz0 + p.lz1) / 2); return { id: p.part, name: p.name, x, z, r: Math.min(p.lx1 - p.lx0, p.lz1 - p.lz0) / 2 };
  });
}
/** Doorstep of a cottage (foot-world), matching houses.js doorstepOf. */
export function cottageDoorstep(c, pad = 1.35) {
  const d = (c.frontZ || 4.5) + pad;
  return { x: c.x + Math.sin(c.ry) * d, z: c.z + Math.cos(c.ry) * d };
}
export { toHarbor as footToHarbor, fromHarbor as harborToFoot };
