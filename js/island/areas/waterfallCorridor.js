// [Timothy waterfall-aaa] BANKSY [t387u]/[t388u]: rope-bridge → fishing path fix + Waterfall Hill trail to the
// two summit ziplines. Layout constants only (paths, clear zones, overlook / summit decks). LAKE + Grandpa Gill's
// dock stay anchored so Emerly's fishing safe-zone bounds line up. Gameplay (fishing2, interacts) stays in lagoon.js.
// &falls=0 still kills the Blender art; these walk paths stay on (they're the fix).

/** High Rope Bridge east landing (hillRound HB.bx/bz ≈). Belvedere + path head. */
export const HB_LAND = { x: -287.97, z: -72.59, y: 26.55 };
/** Grandpa Gill fishing dock shore abutment (lagoon.js DOCK.x / DOCK.z0) — DO NOT MOVE. */
export const DOCK_SHORE = { x: -205, z: -63 };
/** Waterfall Hill zipline stands (js/dock/zipline.js tuned summit). Preserve / host cleanly. */
export const ZIP_WF_CASTLE = { x: -188, z: -232 };
export const ZIP_WF_SKULL = { x: -188, z: -247 };

/** Graded paved path: High Rope Bridge east landing → Grandpa Gill's fishing dock. Trail-width (~4.6 m). */
export const FISH_APPROACH = [
  [-287.7, -72.3], [-283.8, -72.0], [-279.5, -69.6], [-275.5, -66.2], [-271.5, -62.6],
  [-266, -59.8], [-260, -58.6], [-250, -59.5], [-235, -61.0], [-220, -62.0],
  [-210, -62.5], [-205, -63.0],
];

/**
 * Scenic east-shoulder Waterfall Hill Trail: fishing lagoon SE shore → mid-falls overlook → summit terrace
 * linking both zipline stations. East of the gorge (cleaner grade than the wet west cliff).
 */
export const WF_HILL_TRAIL = [
  [-205, -63], [-195, -72], [-182, -90], [-168, -115], [-158, -145],
  [-154, -170], [-156, -188], [-162, -205], [-172, -218], [-182, -228],
  [-188, -232], [-188, -240], [-188, -247],
];

/** Mid-falls overlook deck (cantilever toward the cascade / lagoon). */
export const OVERLOOK = { x: -168, z: -198, hw: 2.4, hl: 3.2, yaw: -0.55 };
/** Summit terrace pad covering both zipline boarding pads. */
export const SUMMIT = { x: -188, z: -239.5, hw: 5.5, hl: 10.5, yaw: 0 };

/** Strip trees / rocks / grass along the corridor (half-width clearance). */
const BANDS = [
  { pts: FISH_APPROACH, hw: 5.5 },
  { pts: WF_HILL_TRAIL, hw: 5.0 },
];
function dPath(pts, x, z) {
  let best = 1e9;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
/** True when foliage / grass must stay off the corridor, belvedere, overlook, summit, dock apron. */
export function corridorClearAt(x, z) {
  if (Math.hypot(x - HB_LAND.x, z - HB_LAND.z) < 9) return true;                 // east landing belvedere
  if (Math.abs(x - DOCK_SHORE.x) < 8 && z > -100 && z < -55) return true;       // dock apron + shore abutment
  if (Math.hypot(x - OVERLOOK.x, z - OVERLOOK.z) < 7) return true;
  if (Math.abs(x - SUMMIT.x) < SUMMIT.hw + 3 && Math.abs(z - SUMMIT.z) < SUMMIT.hl + 3) return true;
  if (Math.hypot(x - ZIP_WF_CASTLE.x, z - ZIP_WF_CASTLE.z) < 8) return true;
  if (Math.hypot(x - ZIP_WF_SKULL.x, z - ZIP_WF_SKULL.z) < 8) return true;
  for (const b of BANDS) if (dPath(b.pts, x, z) < b.hw) return true;
  return false;
}

export default {
  id: 'waterfall_corridor',
  name: 'Waterfall corridor (path + hill trail)',
  // Covers HB landing → dock → east shoulder → summit. Lazy meshes built with lagoon / hillRound.
  rect: [-300, -140, -260, -50],
  terrain: {
    pads: [],
    cuts: [],
    // Paths are also declared on lagoon / hillRound so paint + kerbs land even if this module is toggled.
    paths: [
      { id: 'fish_approach', pts: FISH_APPROACH, pave: true },
      { id: 'wf_hill_trail', pts: WF_HILL_TRAIL, pave: true },
    ],
  },
  register(h) {
    const { H } = h;
    // Overlook deck + summit terrace (walkable floors). Zipline stations keep their own decks in zipline.js.
    const oy = Math.max(H(OVERLOOK.x, OVERLOOK.z), 40);
    h.addDeck({ id: 'wf_overlook', x: OVERLOOK.x, z: OVERLOOK.z, hw: OVERLOOK.hw, hl: OVERLOOK.hl, yaw: OVERLOOK.yaw, y: oy + 0.08 });
    const sy = Math.min(H(ZIP_WF_CASTLE.x, ZIP_WF_CASTLE.z), H(ZIP_WF_SKULL.x, ZIP_WF_SKULL.z));
    h.addDeck({ id: 'wf_summit', x: SUMMIT.x, z: SUMMIT.z, hw: SUMMIT.hw, hl: SUMMIT.hl, yaw: SUMMIT.yaw, y: sy + 0.06 });
    // Soft clear colliders for belvedere bollards (visuals in Blender / hillRound kit)
    h.addCirc(HB_LAND.x - 2.2, HB_LAND.z + 1.4, 0.45);
    h.addCirc(HB_LAND.x + 2.2, HB_LAND.z + 1.4, 0.45);
    h.addCirc(HB_LAND.x, HB_LAND.z - 2.8, 0.35); // signpost
    h.poi('wf_overlook', 'Mid-falls overlook', OVERLOOK.x, OVERLOOK.z, { clear: 10 });
    h.poi('wf_summit', 'Waterfall Hill zipline terrace', SUMMIT.x, SUMMIT.z, { clear: 16 });
    h.poi('fish_approach', 'Path to fishing lagoon', -235, -61, { clear: 8 });
  },
  build() {
    // Visuals live in falls.glb (area section) + lagoon / hillRound kits. Empty stub keeps the area loader happy.
    return { near: null, far: null };
  },
};
