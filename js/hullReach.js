// [big-hitbox] BANKSY "fix the hitbox on bigger ships, have them collect the gold if any part touches": gold reaches a ship when it is
// within the old 10 m of its centre OR within `margin` of its hull footprint (an oriented box: hit length x beam, along the heading).
// Small hulls keep their old reach; long / wide hulls now also scoop gold at the bow, stern and sides.
export const PICK_R = 10, HULL_MARGIN = 3;
export function hullDist(s, x, z) { // metres from (x, z) to the ship's hull box (0 = inside)
  const u = s.mesh?.userData || {}, hl = (u.hitLen || u.len || 17) / 2, hb = (u.beam || 5.4) / 2;
  const dx = x - s.x, dz = z - s.z, sy = Math.sin(s.yaw || 0), cy = Math.cos(s.yaw || 0);
  const lz = dx * sy + dz * cy, lx = dx * cy - dz * sy;
  return Math.hypot(Math.max(0, Math.abs(lx) - hb), Math.max(0, Math.abs(lz) - hl));
}
export const touchesGold = (s, x, z, slack = 0) => Math.hypot(x - s.x, z - s.z) < PICK_R + slack || hullDist(s, x, z) < HULL_MARGIN + slack;
