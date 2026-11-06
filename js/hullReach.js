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
// [board-anywhere] BANKSY t1722u "make it so they can board their ship anywhere around it": BOARD SHIP at your berth's step-ashore spot (the old 4 m,
// now 4.5) OR within `hull` m of your moored hull box (bow, stern, port, starboard), on the pier or swimming beside it (js/dock/index.js).
// Canoe / un-moored ship reach: js/dock/canoe.js BOARD_HULL. Dock ladders never take the E button (js/dock/ladders.js: automatic climbs).
export const BOARD_REACH = { ashore: 4.5, hull: 5.5 };
export function boardReach(W, b, s) { return (!!b?.ashore && Math.hypot(W.x - b.ashore.x, W.z - b.ashore.z) < BOARD_REACH.ashore) || (!!s?.alive && hullDist(s, W.x, W.z) <= BOARD_REACH.hull); }
