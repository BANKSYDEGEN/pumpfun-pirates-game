import { VILLAGE_ON } from '../island/village.js';
// Town-local metres. BANKSY t2192u/t2193u: replace Token Hall + old Pets; do not move ground or roads.
import { RENTABLE_SHOPS } from '../island/hillShops.js';
// [post-hq-castle] BANKSY t261u: the rear stone mass is gone; the hall now fills the WHOLE 29 x 35 m footprint (one walk-in hall),
// 11.4 m beamed ceiling, castle exterior, and exactly two entrances (t-10:18 PM): the dock plaza gate (front) and a Hill Street door in the east wall.
export const HQ = Object.freeze({ id: 'pumpfun_hq', lx0: -33, lx1: -4, lz0: -65, lz1: -30, floor: 2.73, ceil: 11.4, wallTop: 13.6,
  door: { lx: -18.5, lz: -30, w: 6 }, hillDoor: { lx: -4.5, lz: -44, w: 4.4, h: 4.0 }, prompt: { lx: -18.5, lz: -62, r: 1.6 },
  dais: { lz0: -64.4, lz1: -59.6, rise: .4 }, board: { lx: -18.5, lz: -64.2, y: 8.53, w: 24, h: 6.2 } });
// Visible top surfaces, not box centres: keep boots above planks / cloth / dais.
export const HQ_WALK_DECKS = Object.freeze([
 {id:'hq_floor',lx:-18.5,lz:-47.5,hw:14.4,hl:17.2,top:.034},
 {id:'hq_dock_threshold',lx:HQ.door.lx,lz:HQ.door.lz,hw:HQ.door.w/2,hl:.7,top:.034},
 {id:'hq_hill_threshold',lx:HQ.hillDoor.lx,lz:HQ.hillDoor.lz,hw:1.2,hl:HQ.hillDoor.w/2,top:.034},
 {id:'hq_dais',lx:-18.5,lz:(HQ.dais.lz0+HQ.dais.lz1)/2,hw:13.8,hl:(HQ.dais.lz1-HQ.dais.lz0)/2,top:HQ.dais.rise+.04},
 {id:'hq_runner',lx:-18.5,lz:(HQ.lz1-.6+HQ.dais.lz1)/2,hw:1.6,hl:(HQ.lz1-.6-HQ.dais.lz1)/2,top:.06},
 {id:'hq_cross_runner',lx:(-18.5+HQ.lx1-1)/2+.8,lz:HQ.hillDoor.lz,hw:(HQ.lx1-1+18.5-1.6)/2,hl:1.3,top:.055},
 ...[[-26.5,-37.5,5.2,3.2,Math.PI/2],[-10.5,-37.5,5.2,3.2,Math.PI/2],[-28.3,-52,4.6,2.9,0],[-8.6,-52.6,4.6,2.9,0],[-26.5,-45.5,5.2,3.2,Math.PI/2],[-10.5,-46.8,4.2,2.6,0]].map(([lx,lz,w,d,ry],i)=>({id:'hq_rug_'+i,lx,lz,hw:w/2,hl:d/2,ry,top:.045}))
]);
export const HQ_TOWERS = Object.freeze([{ lx: -29.8, lz: -30.2, r: 2.0 }, { lx: -7.2, lz: -30.2, r: 2.0 }]);   // front gun towers (p2: pulled in clear of the Outfit Store eaves)
// p2 pirate dressing, one table drives both the geometry (model.js) and the colliders: [kind, lx, lz, colliderW, colliderD]
// BANKSY 12:45 AM "remove the tables on ground so can walk up to the boards": only corner stores remain, clear of every board front
export const HQ_PROPS = Object.freeze([
  ['barrels', -31.1, -31.6, 2.4, 1.3], ['barrels', -5.8, -31.6, 1.2, 1.3], ['barrels', -31.4, -63.5, 1.3, 1.3], ['barrels', -5.8, -63.5, 1.3, 1.3],
  ['crates', -31.6, -32.6, 1.3, 1.0], ['crates', -5.8, -32.5, 1.2, 1.0], ['crates', -5.8, -62.55, 1.2, 1.2],
]);
export const HQ_PILLARS = Object.freeze([]);   // BANKSY 10:43 PM: no pillars; the roof spans on heavy trusses
// Wall info-panel SLOTS (BANKSY 10:43 PM "more wall panels on the free walls"): framed in model.js, a placeholder face in render.js
// (hq.panels[i].userData.panelSlot = id) for Emerly to draw on later. face: the inward normal axis.
// p3 board layout (BANKSY "space all the boards and frame them nicely"): every wall board shares one band (centre floor+4.1, face 3.0 m
// tall), centred in its wall bay between the doors, torches and corner towers. face: inward normal ('w' = -x, 'e' = +x, 's' = -z).
// BANKSY t303u "increase sign size": every wall board 4.7 x 3.8 m (was 3.72 x 3.0), band centre floor+4.3; same centres, so the
// doorway walls stay symmetric about each door and the corners
export const HQ_BOARD_BAND = Object.freeze({ y: 4.3, h: 3.8 });
export const HQ_PANELS = Object.freeze([
  { id: 'east_1', lx: -5.0, lz: -35.85, face: 'w', w: 4.7, h: 3.8, title: 'DEX JUST PAID' },
  { id: 'east_2', lx: -5.0, lz: -52.15, face: 'w', w: 4.7, h: 3.8, title: 'TRENDING TOKENS' },
  { id: 'east_3', lx: -5.0, lz: -59.5, face: 'w', w: 4.7, h: 3.8, title: 'ABOUT TO BOND' },
  { id: 'west_1', lx: -32.4, lz: -52.15, face: 'e', w: 4.7, h: 3.8, title: 'NOTICE BOARD' },
  { id: 'front_w', lx: -27.25, lz: -30.6, face: 's', w: 4.7, h: 3.8, title: 'SQUAD · PFPIRATES' },
  { id: 'front_e', lx: -9.75, lz: -30.6, face: 's', w: 4.7, h: 3.8, title: 'LEADERBOARD' },
]);
// BANKSY 1:06 AM "keep boards symmetrical": west wall mirrors the east wall (lz -35.85 / -52.15 / -59.5, same frames);
// BANKSY 1:17 AM: v501 west layout (4 boards) kept, no fake arch, anchor stand removed
export const HQ_SQUAD_BOARDS = Object.freeze([['squad', -35.85, 'squad'], ['daily_ranks', -44, 'daily_ranks'], ['squad_ranks', -59.5, 'squad_ranks']]
  .map(([file, lz, kind]) => Object.freeze({ file, lx: -32.4, lz, face: 'e', w: 4.7, h: 3.8, kind })));

export const TOKEN_BOARD_SPOTS = Object.freeze({ SUNK: { lx: -46, lz: -14 }, AHOY: { lx: -38, lz: -14 }, PUMP: { lx: -30, lz: -14 } });
// L0 is the Treasure Trader, L1 Wanted, L2 Rum Export, L3 Harbor Fence. L4 is FIRST genuinely unused room.
export const PET_LOT = RENTABLE_SHOPS.find(s => s.id === 'rent_5');
// [post-petstore] BANKSY t299u "rework the pet store with 3a quality": L4 is a procedural stone walk-in (the Blender L4 house is skipped in
// hillStreet.js), 14 m deep (back wall lx -16.2), a flat floor level with the door threshold, a 7 m beamed ceiling.
// [post-village] BANKSY "move pet store one building up hill street": the whole v515 store shifts 8.9 m north (L5's slot; Rum Row runs
// through the old L4 lot). Every pet z below is the v515 value + PET_DZ.
export const PET_DZ = VILLAGE_ON ? -8.9 : 0, PET_FLOOR = VILLAGE_ON ? 11.03 : PET_LOT.doorY;
export const PET_STORE = Object.freeze({ x0: -16.2, x1: -1.75, z0: (-119.15+PET_DZ), z1: (-110.4+PET_DZ), floor: PET_FLOOR, ceil: 7.0, wall: .5, top: 8.4,
  door: Object.freeze({ lz: (PET_LOT.door.lz+PET_DZ), w: 3.2, h: 2.6 }),   // h = arch springing (crown 2.6 + w/2 = 4.2 m)
  I: Object.freeze({ lx0: -15.7, lx1: -2.25, lz0: (-118.65+PET_DZ), lz1: (-110.9+PET_DZ) }) });
export const PET_SHOP = Object.freeze({ id: 'shop_pets', name: 'PET STORE', lot: PET_LOT.lot, vendor: 'pets',
  lx: -9.4, lz: (PET_LOT.door.lz+PET_DZ), r: 2.4, keeper: { lx: -12.6, lz: (PET_LOT.door.lz+PET_DZ) }, birds: { lx: -6.2, lz: (-117.0+PET_DZ) } });
// [BANKSY: parrots only] props (all solid): [kind, lx, lz, w(x), d(z)] - nothing between the door and the counter (lz (-115.7+PET_DZ) .. (-112.4+PET_DZ) stays open)
export const PET_PROPS = Object.freeze([
  ['counter', -11.3, (-114.06+PET_DZ), 1.0, 5.6],
  ['shelf', -15.35, (-114.06+PET_DZ), .6, 6.4],
  ['bigcage', -4.2, (-118.0+PET_DZ), 1.6, 1.3], ['tree', -7.3, (-118.0+PET_DZ), 1.6, 1.3],
  ['cage', -10.0, (-117.9+PET_DZ), 1.1, 1.1], ['perch', -13.4, (-117.6+PET_DZ), 1.2, 1.2],
  ['toyrack', -4.3, (-111.35+PET_DZ), 2.0, .7], ['bigcage', -7.0, (-111.6+PET_DZ), 1.6, 1.3],
  ['cage', -10.0, (-111.6+PET_DZ), 1.1, 1.1], ['perch', -13.4, (-111.5+PET_DZ), 1.2, 1.2],
  ['stand', -8.9, (-111.4+PET_DZ), .6, .6], ['sacks', -11.7, (-118.2+PET_DZ), .9, .8], ['sacks', -15.2, (-118.2+PET_DZ), .8, .8],
]);
// walls (colliders, town lx/lz centre + size): back, two sides, the front split by the 3.2 m arched doorway
export const PET_WALLS = (() => { const S = PET_STORE, cz = (S.z0 + S.z1) / 2, L = S.x1 - S.x0, cx = (S.x0 + S.x1) / 2, dz0 = S.door.lz - S.door.w / 2, dz1 = S.door.lz + S.door.w / 2, fx = S.x1 - S.wall / 2;
  return [[S.x0 + S.wall / 2, cz, S.wall, S.z1 - S.z0], [cx, S.z0 + S.wall / 2, L, S.wall], [cx, S.z1 - S.wall / 2, L, S.wall],
    [fx, (S.z0 + dz0) / 2, S.wall, dz0 - S.z0], [fx, (dz1 + S.z1) / 2, S.wall, S.z1 - dz1]]; })();
export const petFloor = () => PET_STORE.floor;   // [post-petstore] flat floor (was the L4 house's 0.11 slope)
export const HQ_WALLS = [
  [-32.7, -47.5, .6, 35], // west wall, full depth
  [-4.5, -35.9, 1, 11.8], [-4.5, -55.6, 1, 18.8], // east wall, split by the Hill Street door (lz -46.2 .. -41.8)
  [-18.5, -64.7, 29, .6], // back wall (the old 17 m rear mass is gone)
  [-27.25, -30.3, 11.5, .6], [-9.75, -30.3, 11.5, .6], // six-metre front gate
  ...HQ_TOWERS.map(t => [t.lx, t.lz + 1.2, t.r * 2 + .9, 2.2]),   // exterior half only (BANKSY 12:48 AM: no tower bulge inside)
  ...HQ_PILLARS.map(p => [p.lx, p.lz, 1.2, 1.2]),
  ...HQ_PROPS.map(([, lx, lz, w, d]) => [lx, lz, w, d]),
  [-18.5 - 3.6, -29.4, 1.3, 1.3], [-18.5 + 3.6, -29.4, 1.3, 1.3], // gate buttresses (outside the 6 m opening)
];
export const inHQ = (lx, lz, pad = 0) => lx >= HQ.lx0 - pad && lx <= HQ.lx1 + pad && lz >= HQ.lz0 - pad && lz <= HQ.lz1 + pad;
export function hqDistance(lx, lz) { return Math.hypot(Math.max(HQ.lx0 - lx, 0, lx - HQ.lx1), Math.max(HQ.lz0 - lz, 0, lz - HQ.lz1)); }
// Manual-only hook: aggregated prices/volume cannot prove an individual buy. Never simulate a buy ticker.
export const BIG_BUY_SOL = 1;

// p3 outworks: the hill is cut back from the west + back walls into a paved stone service trench with a coped retaining wall
// (the hall floor sits ~2 m under the hill there). Colliders keep players from dropping in from the hill or the street.
export const HQ_TRENCH = Object.freeze({ w: 1.8, westLz: -48.5 });
export const HQ_OUTWORKS = Object.freeze([
  [-34.6, -57.65, .5, 18.7],   // west retaining wall (lz -48.3 .. -67)
  [-19.35, -66.6, 30.5, .5],   // back retaining wall (lx -34.6 .. -4.1)
  [-33.9, -48.5, 1.9, .4],     // west end cap (the Outfit Store's back)
  [-4.25, -65.85, .4, 1.9],    // east end cap at Hill Street
]);
