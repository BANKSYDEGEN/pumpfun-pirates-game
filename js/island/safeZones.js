// [backpack-pvp] BANKSY t1693u…t1727u: Island Safe Zone — ONE continuous smooth sanctuary.
//   t1727u "Make all this safe zone": a single FOOT-world polygon matching BANKSY's pink+blue outline on the
//   parchment Full Island Map — Harbor docks + cottages + Harbor Town + Lighthouse + Cliff Battery + Coliseum
//   + Musket Range + Hilltop Fort + Waterfall / Gill's Fishing Lagoon. Sandbar Light (NW), Rope / Hangman's
//   Bridge (E), and everything east/north of that loop stay contested.
//   NO Coliseum carve-out hole, NO DIG_CARVE swiss-cheese, NO "⚔ COLISEUM · PvP ON" label.
//   Battle pads (sword pit / musket range) still let you swing at dummies / shoot targets via me.arena —
//   open-world PvP haul drops stay OFF across the whole polygon.
// Kill switch: &safezones=0. Pure data (no three.js): unit tests + the island map import it.
// FRAMES: FOOT-world (x, z) = the island map / digSpots frame. Scene / walker use HARBOR: use the *H helpers.
import { t2w, w2t, toHarbor, fromHarbor } from './coast.js';

export const SAFE_GRACE_S = 3;
export const SAFEZONES_ON = !(typeof location !== 'undefined' && /[?&]safezones=0(&|$)/.test(location.search || ''));
export const CORRIDOR_ID = 'island_sanctuary';
export const CORRIDOR_NAME = 'Island Safe Zone';

// ---- Coliseum geometry kept for arena / isInsideColiseum helpers (NOT a Safe Zone carve-out) ----
export const COLI = Object.freeze({ lx0: 34, lx1: 88, lz0: -200, lz1: -72, p: 2.7, skirt: 8,
  gate: Object.freeze({ lx: 14, lz: -114.761, w: 9.624, d: 29, pad: 2.5 }) });
const ECX = (COLI.lx0 + COLI.lx1) / 2, ECZ = (COLI.lz0 + COLI.lz1) / 2, ERX = (COLI.lx1 - COLI.lx0) / 2, ERZ = (COLI.lz1 - COLI.lz0) / 2;
const ellF = (lx, lz) => Math.abs((lx - ECX) / ERX) ** COLI.p + Math.abs((lz - ECZ) / ERZ) ** COLI.p;
/** Outward distance (m) from the coliseum shell; 0 inside. Same maths as coliseum.js ellOutD. */
export function coliOutD(lx, lz) { const f = ellF(lx, lz); if (f <= 1) return 0; const s = f ** (-1 / COLI.p); return Math.hypot((lx - ECX) * (1 - s), (lz - ECZ) * (1 - s)); }
const PADS = Object.freeze([
  { kind: 'rect', lx0: 47, lx1: 75, lz0: -164, lz1: -136 }, { kind: 'circ', lx: 61, lz: -101, r: 12.5 },
  { kind: 'rect', lx0: -130, lx1: -78, lz0: -168, lz1: -120 }, { kind: 'circ', lx: 60, lz: -86, r: 16 },
]);
function inColiTown(lx, lz) {
  if (coliOutD(lx, lz) < COLI.skirt) return true;
  const g = COLI.gate; if (lx > g.lx - 2 - g.pad && lx < g.lx + g.d + g.pad && Math.abs(lz - g.lz) < g.w / 2 + g.pad) return true;
  for (const p of PADS) if (p.kind === 'rect' ? (lx > p.lx0 && lx < p.lx1 && lz > p.lz0 && lz < p.lz1) : Math.hypot(lx - p.lx, lz - p.lz) < p.r) return true;
  return false;
}
// Sand/dirt fighting floor = coliseum.js superellipse inset by the kerb (KERB 8.2 - 0.3).
const DIRT_IN = 7.9;
export function inColiDirt(x, z) { const [lx, lz] = w2t(x, z);
  return Math.abs((lx - ECX) / (ERX - DIRT_IN)) ** COLI.p + Math.abs((lz - ECZ) / (ERZ - DIRT_IN)) ** COLI.p <= 1; }
/** Foot-world: anywhere in / on the Coliseum (or a battle pad). Used by arena logic — NOT a Safe Zone hole. */
export function isInsideColiseum(x, z) { const [lx, lz] = w2t(x, z); return inColiTown(lx, lz); }

// ---- BANKSY t1727u: ONE continuous FOOT-world control polygon (clockwise from NW) ----
// Tuned 1:1 against BANKSY's pink+blue outline on the parchment Full Island Map:
//   NW wraps SE of SANDBAR LIGHT, west of Harbor piers, around LIGHTHOUSE + CLIFF BATTERY,
//   south of COLISEUM / MUSKET RANGE / HILLTOP FORT, around WATERFALL lagoon east bank
//   (west of ROPE / HANGMAN'S BRIDGE), then the northern U-dip south of "Harbor Town" woods
//   back along Coral Swim Cove to the NW start.
export const SAFE_CTRL = Object.freeze([
  // 1. NW — start north of Coral Swim Cove / Dock 1, SE of Sandbar Light (OUTSIDE to NW).
  //    Go WEST first so the outer arc wraps cove + Pier 4 / Dock 1..3, then south through Harbor water.
  [-610, -425], [-650, -420], [-690, -405], [-725, -375], [-745, -340],
  [-760, -280], [-770, -200], [-780, -110], [-785, -20],
  // 2. Lighthouse mole tip (LIGHTHOUSE INSIDE) → south around Cliff Battery headland
  [-792, 25], [-785, 60], [-760, 100], [-725, 130], [-680, 148], [-620, 142],
  // 3. South / SE — south of Coliseum, Musket Range, Hilltop Fort along south bay
  [-570, 118], [-510, 78], [-450, 50], [-390, 34], [-330, 18], [-270, -5],
  // 4. Wrap south + east bank of Waterfall / Gill's Fishing Lagoon (LAKE -205,-130 r=58);
  //    stop WEST of Rope / Hangman's Bridge (~[16,-82] stays OUTSIDE)
  [-220, -45], [-170, -72], [-140, -100], [-118, -130], [-114, -162], [-126, -195],
  // 5. North rim of lagoon → west, staying north of Town Gate / Trail A / Cottage Village
  [-160, -210], [-220, -218], [-290, -210], [-350, -202], [-410, -196],
  // 6. U-dip south of the "Harbor Town" northern jungle label (x≈-500, z≈-215..-195)
  [-460, -200], [-500, -218], [-530, -238], [-555, -262],
  // 7. East side of Coral Swim Cove / north piers → close north of cove
  [-565, -300], [-555, -340], [-560, -380], [-580, -410], [-610, -425],
]);

/** Chaikin corner-cutting: organic smooth border from the control polygon (closed). */
export function chaikin(pts, iters = 3) {
  let cur = pts.map((p) => [p[0], p[1]]);
  for (let n = 0; n < iters; n++) {
    const out = [];
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i], b = cur[i + 1];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    // close: last→first
    const a = cur[cur.length - 1], b = cur[0];
    out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
    out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    cur = out;
  }
  return cur;
}
export const SAFE_POLY = Object.freeze(chaikin(SAFE_CTRL, 3).map((p) => Object.freeze([p[0], p[1]])));

/** Ray-cast point-in-polygon (FOOT). Polygon may be open or closed. */
export function pointInPoly(x, z, poly = SAFE_POLY) {
  let inn = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-12) + xi)) inn = !inn;
  }
  return inn;
}

// Back-compat exports used by older tests / map helpers (single-zone world now)
export const TRAIL_A_LINK = Object.freeze([[-446, -88], [-435, -84], [-428, -100], [-416, -119.3], [-404.8, -136.8], [-391.1, -156]]);
export const SAFE_PARTS = Object.freeze([
  Object.freeze({ part: 'island_sanctuary', name: CORRIDOR_NAME, kind: 'poly', pts: SAFE_POLY }),
]);
export const EXTRA_ZONES = Object.freeze([]); // folded into SAFE_POLY (cove + fishing lagoon + battery + coli …)
export const LAKE = Object.freeze({ x: -205, z: -130, r: 58 });
export const DIG_CARVE = Object.freeze([]); // t1727u: no swiss-cheese holes inside the sanctuary

const ZONE = Object.freeze({ id: CORRIDOR_ID, name: CORRIDOR_NAME, part: 'island_sanctuary', label: CORRIDOR_NAME });

/** Foot-world: the Safe Zone object across the whole interior, or null. No coli / dig carve-outs. */
export function zoneAt(x, z) {
  if (!SAFEZONES_ON) return null;
  if (inColiDirt(x, z)) return null; // t2117u/t2118u: only the coliseum DIRT floor is PvP; red track + rest stay safe
  return pointInPoly(x, z) ? { ...ZONE } : null;
}
export const insideSafeZone = (x, z) => !!zoneAt(x, z);
export const inIslandSafeZone = insideSafeZone;
export const zoneAtH = (hx, hz) => zoneAt(...fromHarbor(hx, hz));
export const insideSafeZoneH = (hx, hz) => !!zoneAtH(hx, hz);
export const isInsideColiseumH = (hx, hz) => isInsideColiseum(...fromHarbor(hx, hz));

/** Bookkeeping for exit grace. Entering a contested area starts the 3 s no-fire lock. */
export function tickIsleSafe(state, x, z, now) {
  const zn = zoneAt(x, z), inn = !!zn;
  if (state._isleSafe && !inn) state._isleSafeOut = now;
  state._isleSafe = inn; state._isleSafeZone = zn;
  return zn;
}
export function graceLeft(state, now, graceS = SAFE_GRACE_S) {
  if (state?._isleSafe) return 0;
  if (state?._isleSafeOut && now - state._isleSafeOut < graceS) return graceS - (now - state._isleSafeOut);
  return 0;
}
/** Can this pirate deal / take on-foot open-world PvP damage at FOOT (x, z)?
 *  Whole sanctuary = no. Cottage interior = never. Arena pads still practice via me.arena (dummies/targets),
 *  but open-world haul-drop PvP is OFF everywhere inside the polygon (t1727u). */
export function canFightOnFoot(state, x, z, now, opts = {}) {
  if (opts.inHouse) return false;
  if (!SAFEZONES_ON) return true;
  if (zoneAt(x, z)) return false;
  if (graceLeft(state || {}, now ?? 0, opts.graceS ?? SAFE_GRACE_S) > 0) return false;
  return true;
}

/** [{ kind:'poly', pts }] — the single smoothed sanctuary, foot coords. */
export function safeShapes() {
  return [{ part: 'island_sanctuary', kind: 'poly', pts: SAFE_POLY.map((q) => [q[0], q[1]]) }];
}
/** Coliseum outline kept for callers that still want the shell (map no longer carves it). */
export function coliseumExclusion(n = 96) {
  const pts = [];
  for (let i = 0; i < n; i++) { const th = i / n * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    const sp = (v) => Math.sign(v || 1) * Math.abs(v) ** (2 / COLI.p);
    const lx = ECX + ERX * sp(c), lz = ECZ + ERZ * sp(s);
    const dx = lx - ECX, dz = lz - ECZ, nx = COLI.p / ERX * Math.sign(dx || 1) * Math.abs(dx / ERX) ** (COLI.p - 1), nz = COLI.p / ERZ * Math.sign(dz || 1) * Math.abs(dz / ERZ) ** (COLI.p - 1), L = Math.hypot(nx, nz) || 1;
    pts.push(t2w(lx + nx / L * COLI.skirt, lz + nz / L * COLI.skirt)); }
  const g = COLI.gate, hw = g.w / 2 + g.pad;
  return { shell: pts, gallery: [[g.lx - 2 - g.pad, g.lz - hw], [g.lx + g.d + g.pad, g.lz - hw], [g.lx + g.d + g.pad, g.lz + hw], [g.lx - 2 - g.pad, g.lz + hw]].map(([a, b]) => t2w(a, b)),
    centre: t2w(ECX, ECZ), digs: [] };
}
/** Ward-lantern posts along the OUTER edge — dry land only (never harbor water, swim cove, or lake). */
export function wardPosts(step = 14) {
  const out = [], poly = SAFE_POLY;
  const on = (x, z) => {
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4) return; // never in the fishing lagoon
    if (Math.hypot(x - (-592), z - (-334)) < 52) return;         // never in Coral Swim Cove water
    // harbor sea / pier water: reject very low-z seaward posts that sit in open water west of quay
    if (x < -720 && z > -50) return; // west of mole / open harbor approaches
    out.push([x, z]);
  };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const n = Math.max(1, Math.round(L / step));
    const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      // keep only true perimeter samples (one side outside the union)
      if (!pointInPoly(x + nx * 1.5, z + nz * 1.5) || !pointInPoly(x - nx * 1.5, z - nz * 1.5)) {
        if (pointInPoly(x + nx * 0.4, z + nz * 0.4) || pointInPoly(x - nx * 0.4, z - nz * 0.4)) on(x, z);
      }
    }
  }
  return out;
}
/** One ring-ish entry for map legend / badge placement (sanctuary centroid-ish = Harbor Plaza). */
export function mapSafeZoneRings() {
  return [{ id: 'harbor_plaza', name: CORRIDOR_NAME, x: -620, z: -130, r: 40 },
    { id: 'island_sanctuary', name: CORRIDOR_NAME, x: -480, z: -80, r: 80 }];
}
/** Doorstep of a cottage (foot-world), matching houses.js doorstepOf. */
export function cottageDoorstep(c, pad = 1.35) {
  const d = (c.frontZ || 4.5) + pad;
  return { x: c.x + Math.sin(c.ry) * d, z: c.z + Math.cos(c.ry) * d };
}
export { toHarbor as footToHarbor, fromHarbor as harborToFoot };
