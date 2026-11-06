// PUMPFUN PIRATES · [v347] SHORE <-> SEA COMBAT (BANKSY t1821u "players on island can shoot boats player and ai, and boats bomb players on coast",
// t1822u "gunshot same damage if captain is hit, if his ship do small ship damage", t1823u "cannon ball kills player").
// Pure geometry + numbers (no THREE, no DOM) shared by js/onfoot/battle.js (your musket), js/pvp.js (who gets hurt, validation) and
// tests/v347ShoreSeaCombat.test.mjs:
//  - a musket ball fired on foot now flies SHIP_RANGE m over the water; the CAPTAIN at the wheel is tested FIRST (same damage as an on-foot
//    pirate: your musket's real dmg), else the hull / deck / rig takes small HULL damage (3-6 for a common musket, scaled by its rank);
//  - a cannonball (any ship's, the cliff batteries') that hits OR lands within BLAST_R of a pirate on foot kills them in one shot.
export const SHIP_RANGE = 200;           // m a musket ball carries over the water at a ship (the on-foot pirate range stays ARENA.musket.range)
export const CAPTAIN_HP = 100;           // a captain at the helm has an on-foot pirate's HP: 0 = KO, the ship goes down with them
export const CAPTAIN_R = 0.62, CAPTAIN_TALL = 2.05;
export const HULL_DMG = [3, 6];          // common musket on a hull (ship HP 380-570+): small, chip damage
export const GUN_HIT_MAX = 40;           // victim-side cap for one gun hit (legendary musket + rank tops out ~25)
export const BLAST_R = 3.2, DIRECT_R = 1.25; // cannon splash radius on the ground / direct hit radius round the body
export const BOMB_DMG = 9999;            // >= any max HP: one shot
export const SHORE_SPOT = 150;           // m an AI ship spots an exposed pirate on the coast (and broadsides them)

// horizontal distance a along the ray (o + f * a, height o.y + slope * a; slope null = flat) where it enters a vertical cylinder, else -1
export function rayCylH(o, f, slope, cx, cz, r, y0, y1, maxD) {
  const dx = cx - o.x, dz = cz - o.z, a = dx * f.x + dz * f.z, side2 = dx * dx + dz * dz - a * a;
  if (side2 > r * r) return -1; const t = a - Math.sqrt(r * r - side2);
  if (t < 0.3 || t > maxD) return -1; const y = slope == null ? o.y : o.y + slope * t;
  return y >= y0 && y <= y1 ? t : -1;
}
// entry distance into a ship's hull box (local: |lx| < hw, |lz| < hl, y0..y1; yaw like js/main.js toLocal), else -1
export function rayShipBox(o, f, slope, s, maxD) {
  const c = Math.cos(s.yaw), n = Math.sin(s.yaw), dx = o.x - s.x, dz = o.z - s.z;
  const lx0 = dx * c - dz * n, lz0 = dx * n + dz * c, ux = f.x * c - f.z * n, uz = f.x * n + f.z * c;
  let t0 = 0.3, t1 = maxD;
  const slab = (p, u, h) => { if (Math.abs(u) < 1e-9) return Math.abs(p) <= h; let a = (-h - p) / u, b = (h - p) / u; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); return t0 <= t1; };
  if (!slab(lx0, ux, s.hw) || !slab(lz0, uz, s.hl)) return -1;
  if (slope == null || Math.abs(slope) < 1e-9) return o.y >= s.y0 && o.y <= s.y1 ? t0 : -1;
  if (!slab(o.y - (s.y0 + s.y1) / 2, slope, (s.y1 - s.y0) / 2)) return -1;
  return t0;
}
// small hull damage for one musket ball: the common 3-6, scaled by your musket's real damage (rarity / rank) vs the common 19
export const hullDamage = (gunDmg = 19, rnd = Math.random) => Math.max(1, Math.round((HULL_DMG[0] + rnd() * (HULL_DMG[1] - HULL_DMG[0])) * Math.max(0.5, Math.min(1.6, gunDmg / 19))));
// does a cannonball at p (direct, in flight) or landing at p (impact = splash) catch a pirate whose feet are at q?
export function blastHits(p, q, impact) {
  const cy = q.y + 0.95, dx = p.x - q.x, dz = p.z - q.z, dy = p.y - cy;
  if (impact) return dx * dx + dz * dz + Math.max(0, Math.abs(dy) - 1) ** 2 < BLAST_R * BLAST_R;
  return dx * dx + dz * dz < DIRECT_R * DIRECT_R && Math.abs(dy) < 1.25;
}
