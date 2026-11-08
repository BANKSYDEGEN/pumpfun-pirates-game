// [island-rework step 1] THE single source of truth for treasure-map dig spots (BANKSY: "make sure treasure map locations are compatible
// with the map changes we will be making"). Pure data, no imports: read by the client (js/island/foot.js -> DIGS / INTERACT -> world.footInteract
// -> js/dock/treasure.js X + MAPS), by the server list generator (tools/gen_digspots.mjs -> supabase/functions/pvp/digSpots.ts) and by the checks
// (tests/digspots.test.mjs static, tools/check_digspots.py in-game: walkable / clear of props + exclusions / reachable / client X == server spot).
//
// RULES (enforced by the checks):
//  - ids are NEVER removed or renamed, and the ROLL order (server MAP_SPOTS) is append-only: a stored map (pvp_maps.spot) names an id, and
//    migration 026 rolls new maps as p_spots[1 + roll % len], so reordering would change which spot future seeds land on.
//  - x / z are BAKED foot-frame coords (= exactly where the X is). dig1..dig6 are today's runtime beachNear() results, so no X moves.
//    If a spot ever has to move, change its x / z here and keep the id (held maps follow; no DB change).
//  - active:false = registered but OFF: not drawn, not interactable, not rolled, not accepted by map_dig. Flip only after the client that knows
//    the id has shipped (SW bump) and the checks pass; then regenerate the server lists.
//  - roll:false = never handed out by boss / kill drops (the legendary cave is streak-only).
// Frames: foot (x, z), north = -z. Town-local: lx = z + 90, lz = -640 - x.

export const DIG_SPOTS = [
  // ---- live today (positions = v147 main, measured by tools/check_digspots.py) ----
  { id: 'dig1', n: 1, area: 'west_inlet', x: -340, z: 164, active: true, roll: true, hint: [-306, 150] },
  { id: 'dig2', n: 2, area: 'south_beach', x: -28, z: 436, active: true, roll: true, hint: [-82, 456] },
  { id: 'dig3', n: 3, area: 'north_east_beach', x: 396, z: -460, active: true, roll: true, hint: [340, -360] },
  { id: 'dig4', n: 4, area: 'pirate_camp', x: -332, z: -580, active: true, roll: true, hint: [-335, -580], clear: 6 },   // NW bay: the camp keeps a 6 m ring
  { id: 'dig5', n: 5, area: 'east_bay', x: 420, z: 100, active: true, roll: true, hint: [421, 100] },
  { id: 'dig6', n: 6, area: 'town_shore', x: -626, z: -258, active: true, roll: true, hint: [-629, -254], clear: 6, inside: 'plaza_v2' }, // [post-village v3] BANKSY: moved off the plaza extension to the west shore sand (town lx -168, lz -14); was -628, -212 // Timothy keeps a clear ring
  { id: 'cave', area: 'skull_cave', x: 90, z: 180, r: 4, active: true, roll: false, derived: 'foot.js cave mouth toW(0, 8)' },            // legendary maps only
  // ---- island rework: registered, OFF until each area ships (plan: /docs/island_rework/PLAN.md) ----
  { id: 'dig7', n: 7, area: 'jungle_ruins', x: 62, z: -402, active: false, roll: false },
  { id: 'dig8', n: 8, area: 'jungle_ruins', x: 200, z: -260, active: false, roll: false },
  { id: 'dig9', n: 9, area: 'smugglers_cave', x: 245, z: 360, active: false, roll: false },
  { id: 'dig10', n: 10, area: 'smugglers_cave', x: 220, z: 262, active: false, roll: false },
  { id: 'dig11', n: 11, area: 'skull_lookout', x: 55, z: 205, active: false, roll: false, note: 'needs the lookout plateau' },
  { id: 'dig12', n: 12, area: 'lagoon', x: -140, z: -230, active: false, roll: false },
  { id: 'dig13', n: 13, area: 'lagoon', x: -268, z: -80, active: false, roll: false },
  { id: 'dig14', n: 14, area: 'pirate_camp', x: -537, z: -470, active: false, roll: false },
  { id: 'dig15', n: 15, area: 'pirate_camp', x: -400, z: -492, active: false, roll: false },
  { id: 'dig16', n: 16, area: 'islet_6a', x: -455, z: 418, active: true, roll: true, needs: 'swim|row', hint: [-470, 405] },
  { id: 'dig17', n: 17, area: 'islet_6b', x: -325, z: 545, active: true, roll: true, needs: 'swim|row', hint: [-330, 560] },
  { id: 'dig18', n: 18, area: 'islet_6c', x: 410, z: 548, active: true, roll: true, needs: 'swim|row', hint: [420, 560] },
  { id: 'dig19', n: 19, area: 'islet_6d', x: 548, z: -410, active: true, roll: true, needs: 'swim|row', hint: [560, -420] },
  { id: 'dig20', n: 20, area: 'islet_6e', x: -150, z: -755, active: true, roll: true, needs: 'swim|row', hint: [-150, -770] },
  // [v313] BANKSY: extra side-island digs (2nd on 6a-6d + 3rd on largest 6a/6b + bonus on 6b). islet_6e too small for a 40 m-separated 2nd dig.
  { id: 'dig21', n: 21, area: 'islet_6a', x: -496, z: 415, active: true, roll: true, needs: 'swim|row', hint: [-505, 405] },
  { id: 'dig22', n: 22, area: 'islet_6b', x: -330, z: 588, active: true, roll: true, needs: 'swim|row', hint: [-330, 600] },
  { id: 'dig23', n: 23, area: 'islet_6c', x: 425, z: 587, active: true, roll: true, needs: 'swim|row', hint: [430, 600] },
  { id: 'dig24', n: 24, area: 'islet_6d', x: 565, z: -447, active: true, roll: true, needs: 'swim|row', hint: [575, -455] },
  { id: 'dig25', n: 25, area: 'islet_6a', x: -478, z: 452, active: true, roll: true, needs: 'swim|row', hint: [-485, 465] },
  { id: 'dig26', n: 26, area: 'islet_6b', x: -365, z: 555, active: true, roll: true, needs: 'swim|row', hint: [-380, 555] },
  { id: 'dig27', n: 27, area: 'islet_6b', x: -285, z: 554, active: true, roll: true, needs: 'swim|row', hint: [-270, 560] },
];

// zones owned by others: no dig spot (and no rework prop) within `pad` m. Rects are foot-frame [x0, x1, z0, z1].
// t2w: x = -640 - lz, z = -90 + lx. `known:false` = bounds assumed, confirm with the owner.
const T = (lx0, lx1, lz0, lz1) => [-640 - lz1, -640 - lz0, -90 + lx0, -90 + lx1];
export const EXCLUDE = [
  { id: 'plaza_v2', owner: 'Timothy', rect: T(-176, 100, -56, 66), known: true, allow: ['route_street'], note: 'plazaTown.js PLAZA.bounds (v150 Blender plaza: unchanged, Main Street connector lx 6 lz -56 y 2.6 w 14); dig6 sits inside (kept, clear ring); route_street starts 2 m inland of the edge (R0 join, y 2.6, 14 m wide lx -1..13)' },
  { id: 'musket_range', owner: 'Timothy', rect: T(-126, -82, -164, -124), known: true, provisional: true, note: 'old pad; live pads follow battleAreas.js (coli when on)' },
  { id: 'sword_pit', owner: 'Emerly', rect: T(44, 76, -102, -70), known: true, provisional: true, y: 6.4, note: 'old pad; live pads follow battleAreas.js' },
  { id: 'coli_range', owner: 'Emerly', rect: T(47, 75, -164, -136), known: true, provisional: true, note: 'coliseum musket range (yellow)' },
  { id: 'coli_pit', owner: 'Emerly', rect: T(48, 74, -105, -79), known: true, provisional: true, note: 'coliseum sword pit (purple)' },
  { id: 'coliseum', owner: 'Emerly', rect: T(34, 96, -208, -44), known: true, allow: ['hilltop_fort'], note: 'intact colosseum footprint (v294 shell pulled in to lx 88; rect kept wide: fish-market approach + east feather); castle stair joins fort (BANKSY coli)' },
  { id: 'cliff_battery', owner: 'Timothy', rect: T(124, 196, 0, 72), known: true, note: 'HEADLAND lx 160, lz 36, r 36 + fort' },
  { id: 'swim_cove', owner: 'Raul', rect: T(-300, -180, -40, 130), known: false, note: 'west beach lx -300..-180 (lz span assumed)' },
  { id: 'main_street', owner: 'town', rect: T(-4, 16, -210, -56), known: true, allow: ['route_street', 'route_low', 'hilltop_fort'], note: 'dig spots stay off it; the Pirates\' Climb + the fort ramp rebuild it (BANKSY 2:46 PM)' },
  { id: 'cave_mouth', owner: 'cave', circle: [90, 180, 14], known: true },
];
export const EXCLUDE_PAD = 8;

// rework areas (plan footprints, foot frame) + the props each area will place (checked: >= spot.clear / 6 m from every dig spot)
export const AREAS = [
  { id: 'jungle_ruins', name: 'Jungle Trail & Ruins', rect: [0, 260, -490, -215],
    props: [{ id: 'temple', rect: [25, 65, -472, -436] }, { id: 'mossbeard_camp', rect: [1, 9, -392, -385] }, { id: 'idol_head', rect: [13, 19, -443, -437] }, { id: 'high_ledge', rect: [42, 48, -484, -479] }] },
  { id: 'route_street', name: "Pirates' Climb: Main Street (R0 join at lz -58 + R1 to the gate)", rect: [-582, -433, -92, -76] },
  { id: 'route_low', name: "Pirates' Climb: gate -> the Overlook", rect: [-440, -235, -305, -80] },
  { id: 'route_high', name: "Pirates' Climb: ridge -> jungle trailhead", rect: [-250, 8, -405, -285] },
  { id: 'hilltop_fort', name: 'Hilltop Fort (walk-in: gate stair, courtyard, keep, ramparts)', rect: [-437, -395, -73, -31] },
  { id: 'rope_bridge', name: 'Rope Bridge approaches (D3)', rect: [12, 20, -151, -44] },
  { id: 'smugglers_cave', name: "Smuggler's Cave", rect: [195, 345, 235, 395] },
  { id: 'skull_lookout', name: 'Skull Peak Lookout', rect: [25, 178, 195, 335] },
  { id: 'lagoon', name: 'Freshwater Lagoon', rect: [-295, -115, -265, -55],
    props: [{ id: 'fishing_dock', rect: [-208, -202, -98, -60] }, { id: 'gill', rect: [-202, -197, -64, -59] }, { id: 'grotto', rect: [-215, -197, -200, -187] }] },
  { id: 'pirate_camp', name: 'Pirate Camp & Wreck Beach (NW bay)', rect: [-570, -318, -612, -432],
    props: [ // planned footprints [x0, x1, z0, z1] (build step 5 must stay inside these)
      { id: 'galleon', rect: [-502, -458, -532, -518], note: 'beached on its side, bow up the beach, stern in the surf' },
      { id: 'tents', rect: [-530, -470, -500, -462] },
      { id: 'fires_rum', rect: [-468, -432, -496, -458], note: '2 campfires + rum-barrel hangout circle' },
      { id: 'dinghy_post', rect: [-372, -360, -566, -556], note: 'rowboat to islets (later)' },
    ] },
  { id: 'islets', name: 'Hidden Islets', circles: [[-470, 420, 48], [-330, 560, 78], [420, 560, 44], [560, -420, 40], [-150, -770, 36]] },
];

// [island-rework] LOCKED for Timothy's Blender plaza path (plaza -> the gap between the buildings -> up the slope -> here). Read-only for him.
// The bottom of the Jungle Trail & Ruins: ON trail A (catmull sample i = 190, 566 m along trail A from the town gate), just inside the area's
// plaza-side (west) edge, walkable, reachable from the harbor spawn, >= 8 m clear of every EXCLUDE zone and >= 40 m from every dig spot
// (checked by tests/digspots.test.mjs + tools/check_digspots.py). The jungle trail (js/island/areas/jungle.js) starts exactly here.
// heading = direction of travel arriving from the plaza along trail A (foot frame unit vector + degrees clockwise from +z... i.e. atan2(dx, dz)).
export const JUNGLE_TRAILHEAD = Object.freeze({ id: 'jungle_trailhead', area: 'jungle_ruins',
  x: 4.7, z: -395.9, lx: -305.9, lz: -644.7, y: 25.37,
  heading: { dx: 0.951, dz: 0.309, deg: 72.0, lx: 0.309, lz: -0.951 }, width: 5, clearR: 6,
  note: 'arrive along trail A from the west (5 m wide walkable band, ~0.1 grade); the jungle trail leaves north-east to the temple' });
export const spotById = (id) => DIG_SPOTS.find(s => s.id === id) || null;
export const activeDigs = () => DIG_SPOTS.filter(s => s.active && s.id !== 'cave');
export const rollIds = () => DIG_SPOTS.filter(s => s.active && s.roll).map(s => s.id);           // server MAP_SPOTS (order = registry order)
export const validIds = () => DIG_SPOTS.filter(s => s.active).map(s => s.id).sort((a, b) => (a === 'cave') - (b === 'cave')); // MAP_SPOTS_ALL: rolls first, cave last
