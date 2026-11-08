// Town-local metres. BANKSY t2192u/t2193u: replace Token Hall + old Pets; do not move ground or roads.
import { RENTABLE_SHOPS } from '../island/hillShops.js';
// [post-hq-castle] BANKSY t261u: the rear stone mass is gone; the hall now fills the WHOLE 29 x 35 m footprint (one walk-in hall),
// 11.4 m beamed ceiling, castle exterior, and exactly two entrances (t-10:18 PM): the dock plaza gate (front) and a Hill Street door in the east wall.
export const HQ = Object.freeze({ id: 'pumpfun_hq', lx0: -33, lx1: -4, lz0: -65, lz1: -30, floor: 2.73, ceil: 11.4, wallTop: 13.6,
  door: { lx: -18.5, lz: -30, w: 6 }, hillDoor: { lx: -4.5, lz: -44, w: 4.4, h: 4.0 }, prompt: { lx: -18.5, lz: -40, r: 3 },
  dais: { lz0: -64.4, lz1: -59.6, rise: .4 }, board: { lx: -18.5, lz: -64.2, y: 8.53, w: 24, h: 6.2 } });
export const HQ_TOWERS = Object.freeze([{ lx: -29.8, lz: -30.2, r: 2.0 }, { lx: -7.2, lz: -30.2, r: 2.0 }]);   // front gun towers (p2: pulled in clear of the Outfit Store eaves)
// p2 pirate dressing, one table drives both the geometry (model.js) and the colliders: [kind, lx, lz, colliderW, colliderD]
// BANKSY 12:45 AM "remove the tables on ground so can walk up to the boards": only corner stores remain, clear of every board front
export const HQ_PROPS = Object.freeze([
  ['barrels', -31.1, -31.6, 2.4, 1.3], ['barrels', -5.8, -31.6, 1.2, 1.3], ['barrels', -31.4, -63.5, 1.3, 1.3], ['barrels', -5.8, -63.5, 1.3, 1.3],
  ['crates', -31.6, -32.6, 1.3, 1.0], ['crates', -5.8, -32.5, 1.2, 1.0], ['crates', -5.8, -62.4, 1.2, 1.2],
]);
export const HQ_PILLARS = Object.freeze([]);   // BANKSY 10:43 PM: no pillars; the roof spans on heavy trusses
// Wall info-panel SLOTS (BANKSY 10:43 PM "more wall panels on the free walls"): framed in model.js, a placeholder face in render.js
// (hq.panels[i].userData.panelSlot = id) for Emerly to draw on later. face: the inward normal axis.
// p3 board layout (BANKSY "space all the boards and frame them nicely"): every wall board shares one band (centre floor+4.1, face 3.0 m
// tall), centred in its wall bay between the doors, torches and corner towers. face: inward normal ('w' = -x, 'e' = +x, 's' = -z).
export const HQ_BOARD_BAND = Object.freeze({ y: 4.1, h: 3.0 });
export const HQ_PANELS = Object.freeze([
  { id: 'east_1', lx: -5.0, lz: -35.85, face: 'w', w: 3.72, h: 3.0, title: 'DEX JUST PAID' },
  { id: 'east_2', lx: -5.0, lz: -52.15, face: 'w', w: 3.72, h: 3.0, title: 'TRENDING TOKENS' },
  { id: 'east_3', lx: -5.0, lz: -59.5, face: 'w', w: 3.72, h: 3.0, title: 'ABOUT TO BOND' },
  { id: 'west_1', lx: -32.4, lz: -52.15, face: 'e', w: 3.72, h: 3.0, title: 'NOTICE BOARD' },
  { id: 'front_w', lx: -27.25, lz: -30.6, face: 's', w: 3.72, h: 3.0, title: 'SQUAD · PFPIRATES' },
  { id: 'front_e', lx: -9.75, lz: -30.6, face: 's', w: 3.72, h: 3.0, title: 'LEADERBOARD' },
]);
// BANKSY 1:06 AM "keep boards symmetrical": west wall mirrors the east wall (lz -35.85 / -52.15 / -59.5, same 3.72 x 3.0 frames);
// opposite the Hill Street archway (lz -44): a matching blind stone arch with the ship's wheel, no board. Exact mirror of the east wall
// (east_1 / east_2 / east_3 <-> squad / west_1 / squad_ranks).
export const HQ_SQUAD_BOARDS = Object.freeze([['squad', -35.85, 'squad'], ['squad_ranks', -59.5, 'squad_ranks']]
  .map(([file, lz, kind]) => Object.freeze({ file, lx: -32.4, lz, face: 'e', w: 3.72, h: 3.0, kind })));

export const TOKEN_BOARD_SPOTS = Object.freeze({ SUNK: { lx: -46, lz: -14 }, AHOY: { lx: -38, lz: -14 }, PUMP: { lx: -30, lz: -14 } });
// L0 is the Treasure Trader, L1 Wanted, L2 Rum Export, L3 Harbor Fence. L4 is FIRST genuinely unused room.
export const PET_LOT = RENTABLE_SHOPS.find(s => s.id === 'rent_5');
export const PET_SHOP = Object.freeze({ id: 'shop_pets', name: 'PET STORE', lot: PET_LOT.lot, vendor: 'pets',
  lx: -5.1, lz: PET_LOT.door.lz, r: 2.0, keeper: { lx: -9.35, lz: PET_LOT.door.lz }, birds: { lx: -5.8, lz: -114.8 } });
export const petFloor = lz => { const I = PET_LOT.interior; return I.floorY.atLz0 + (lz - I.lz0) / (I.lz1 - I.lz0) * (I.floorY.atLz1 - I.floorY.atLz0); };
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
