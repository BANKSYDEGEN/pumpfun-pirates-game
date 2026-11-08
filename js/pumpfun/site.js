// Town-local metres. BANKSY t2192u/t2193u: replace Token Hall + old Pets; do not move ground or roads.
import { RENTABLE_SHOPS } from '../island/hillShops.js';
// [post-hq-castle] BANKSY t261u: the rear stone mass is gone; the hall now fills the WHOLE 29 x 35 m footprint (one walk-in hall),
// 11.4 m beamed ceiling, castle exterior, and exactly two entrances (t-10:18 PM): the dock plaza gate (front) and a Hill Street door in the east wall.
export const HQ = Object.freeze({ id: 'pumpfun_hq', lx0: -33, lx1: -4, lz0: -65, lz1: -30, floor: 2.73, ceil: 11.4, wallTop: 13.6,
  door: { lx: -18.5, lz: -30, w: 6 }, hillDoor: { lx: -4.5, lz: -44, w: 4.4, h: 5.2 }, prompt: { lx: -18.5, lz: -40, r: 3 },
  dais: { lz0: -64.4, lz1: -59.6, rise: .4 }, board: { lx: -18.5, lz: -64.2, y: 8.53, w: 24, h: 6.2 } });
export const HQ_TOWERS = Object.freeze([{ lx: -30.6, lz: -30.2, r: 2.2 }, { lx: -6.4, lz: -30.2, r: 2.2 }]);   // front corner gate towers
export const HQ_PILLARS = Object.freeze([-24.5, -12.5].flatMap(lx => [-40, -48, -56].map(lz => ({ lx, lz }))));
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
  ...HQ_TOWERS.map(t => [t.lx, t.lz, t.r * 1.8, t.r * 1.8]),
  ...HQ_PILLARS.map(p => [p.lx, p.lz, 1.2, 1.2]),
];
export const inHQ = (lx, lz, pad = 0) => lx >= HQ.lx0 - pad && lx <= HQ.lx1 + pad && lz >= HQ.lz0 - pad && lz <= HQ.lz1 + pad;
export function hqDistance(lx, lz) { return Math.hypot(Math.max(HQ.lx0 - lx, 0, lx - HQ.lx1), Math.max(HQ.lz0 - lz, 0, lz - HQ.lz1)); }
// Manual-only hook: aggregated prices/volume cannot prove an individual buy. Never simulate a buy ticker.
export const BIG_BUY_SOL = 1;
