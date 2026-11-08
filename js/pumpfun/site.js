// Town-local metres. BANKSY t2192u/t2193u: replace Token Hall + old Pets; do not move ground or roads.
import { RENTABLE_SHOPS } from '../island/hillShops.js';
export const HQ = Object.freeze({ id: 'pumpfun_hq', lx0: -33, lx1: -4, lz0: -65, lz1: -30, floor: 2.73,
  door: { lx: -18.5, lz: -30, w: 6 }, prompt: { lx: -18.5, lz: -40, r: 3 }, board: { lx: -18.5, lz: -47.8, y: 6.83, w: 24, h: 6.2 } });
export const TOKEN_BOARD_SPOTS = Object.freeze({ SUNK: { lx: -46, lz: -14 }, AHOY: { lx: -38, lz: -14 }, PUMP: { lx: -30, lz: -14 } });
// L0 is the Treasure Trader, L1 Wanted, L2 Rum Export, L3 Harbor Fence. L4 is FIRST genuinely unused room.
export const PET_LOT = RENTABLE_SHOPS.find(s => s.id === 'rent_5');
export const PET_SHOP = Object.freeze({ id: 'shop_pets', name: 'PET STORE', lot: PET_LOT.lot, vendor: 'pets',
  lx: -5.1, lz: PET_LOT.door.lz, r: 2.0, keeper: { lx: -9.35, lz: PET_LOT.door.lz }, birds: { lx: -5.8, lz: -114.8 } });
export const petFloor = lz => { const I = PET_LOT.interior; return I.floorY.atLz0 + (lz - I.lz0) / (I.lz1 - I.lz0) * (I.floorY.atLz1 - I.floorY.atLz0); };
export const HQ_WALLS = [
  [-32.7, -39.5, .6, 19], [-4.3, -39.5, .6, 19], // room side walls
  [-27.25, -30.3, 11.5, .6], [-9.75, -30.3, 11.5, .6], // six-metre entry
  [-18.5, -56.5, 29, 17], // rear volume; terrain untouched beneath it
];
export const inHQ = (lx, lz, pad = 0) => lx >= HQ.lx0 - pad && lx <= HQ.lx1 + pad && lz >= HQ.lz0 - pad && lz <= HQ.lz1 + pad;
export function hqDistance(lx, lz) { return Math.hypot(Math.max(HQ.lx0 - lx, 0, lx - HQ.lx1), Math.max(HQ.lz0 - lz, 0, lz - HQ.lz1)); }
// Manual-only hook: aggregated prices/volume cannot prove an individual buy. Never simulate a buy ticker.
export const BIG_BUY_SOL = 1;
