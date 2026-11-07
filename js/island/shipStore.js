// One shared shell on the former upgrade + skins lots; two independent shop counters.
import * as THREE from 'three';
import { outfitWalls, outfitPosts } from './outfitStore.js';
// [ship-aaa] BANKSY 6:18-6:19 PM "Then start on ship store" / "Make higher ceilings and make the store nice, keep 2 counters one for
// upgrades and one for skins": the Blender hall (plaza_shops.glb node 'ship_store', tools/plaza_blender/plaza_shops_blender.py) fills
// the whole 12 m lot (the casino's front is right behind it at lz -42) and goes UP: an 8.6 m gilded ceiling, three street arches; the
// two counters stand at the back (Blender y 3.6 = lz -39.6), each prompt in front of its own counter. The procedural shell below stays as the &shopsglb=0 / load-failure fallback (same counter line).
export const SHIP_STORE = Object.freeze({ id: 'ship_store', lx: 26, lz: -36, w: 22, d: 12, promptLz: -38.0,
  depth: 12, ceil: 8.6, facadeLz: -30, door: 5.0, arches: Object.freeze([-6.5, 0, 6.5]), counterLz: -39.6,
  counters: Object.freeze([{ id: 'shop_upgrades', lx: 20.5, color: 0xc49731 }, { id: 'shop_ships', lx: 32, color: 0x367bd0 }]) });
// [ship-aaa] wall colliders (town-local [lx, lz, w, d]: back, sides, the four piers round the three arches), awning posts, camera room
export const shipWalls = (S = SHIP_STORE) => outfitWalls(S);
export const shipPosts = (S = SHIP_STORE) => outfitPosts(S);
export const shipRoom = (S = SHIP_STORE) => ({ id: S.id, lx0: S.lx - S.w / 2 + 0.5, lx1: S.lx + S.w / 2 - 0.5, lz0: S.facadeLz - S.depth + 0.5, lz1: S.facadeLz - 0.5 });
// glb = SHOPS_KIT.shops.ship_store (null = fallback); place(lx, lz) = put the model there; room(R, ceil) = an indoor camera box.
// Returns true when the Blender hall was placed.
export function buildShipStore(h, { stoneHouse, shopWalkInCols, sign, glb = null, place = null, room = null }) {
  const { k, W, box, cyl, M, at, addBox, addCirc, T, yaw0 } = h;
  const S = SHIP_STORE, floor = 2.73, timber = 26, trim = 22, cloth = 32;
  if (glb) {
    place?.(S.lx, S.lz);
    for (const [lx, lz, a, b] of shipWalls()) addBox(...T(lx, lz), a, b, yaw0);
    for (const c of glb.colliders) { const [x, z] = T(S.lx + c[1], S.lz + c[2]); if (c[0] === 'c') addCirc(x, z, c[3]); else addBox(x, z, c[3], c[4], yaw0 + (c[5] || 0)); }
    for (const [lx, lz] of shipPosts()) addCirc(...T(lx, lz), 0.25);
    room?.(shipRoom(), S.ceil);
    return true;
  }
  const CZ = S.counterLz - S.lz;   // [ship-aaa] fallback counters on the same line as the hall's (prompt in front, keepers behind)
  stoneHouse(S.lx, S.w, 3, 2, { shop: true, hollow: true, openGround: true });
  shopWalkInCols(S);
  at(S.lx, S.lz, 0, () => {
    // Dark oak skirting, navy runner and brass threshold; wide, obstruction-free central aisle.
    W(k, box(S.w - 1.1, .12, 1), 0x684225, timber, M(0, .06, 5.25), false);
    W(k, box(7.6, .025, 7), 0x254c72, cloth, M(0, .075, 1.4), false);
    W(k, box(S.w - 1.2, 2.8, .16), 0x443021, timber, M(0, 1.8, -5.4), false);
    for (const c of S.counters) {
      const x = c.lx - S.lx, z = CZ, width = 7.4;
      W(k, box(width, 1.05, 1.2), 0x573820, timber, M(x, .525, z));
      W(k, box(width + .22, .15, 1.4), 0x946338, timber, M(x, 1.12, z), false);
      W(k, box(width - .4, .03, .9), c.color, cloth, M(x, 1.215, z), false);
      for (const sx of [-1, 1]) W(k, box(.14, .9, .08), 0xd3ab56, trim, M(x + sx * (width / 2 - .2), .55, z + .65), false);
      W(k, box(width, .15, .7), 0x946338, timber, M(x, 1.2, -5), false);
      if (c.id === 'shop_upgrades') {
        // Shipwright's bench: fittings, brass wheel, cannon barrel and rigging coils.
        W(k, new THREE.TorusGeometry(.6, .065, 6, 18), 0x8a5a31, timber, M(x, 2.55, -5.05, Math.PI / 2), false);
        for (let j = 0; j < 6; j++) W(k, box(.07, 1.25, .08), 0xd3ab56, trim, M(x, 2.55, -5, 0, 0, j * Math.PI / 3), false);
        W(k, cyl(.16, .21, 1.5, 10), 0x343b40, 0, M(x - 2.1, 1.45, z, 0, 0, Math.PI / 2), false);
        for (const off of [.7, 1.6, 2.5]) W(k, new THREE.TorusGeometry(.25, .045, 5, 12), 0xc5a169, 31, M(x + off, 1.29, z), false);
      } else {
        // Two miniature ships on the skins stall; no pet cages or old exterior stands remain.
        for (const off of [-2, 1.8]) {
          W(k, box(2.2, .35, .7), off < 0 ? 0x563724 : 0x253e60, timber, M(x + off, 1.43, z), false);
          W(k, cyl(.035, .035, 1.1, 6), 0x634329, timber, M(x + off, 2.1, z), false);
          W(k, box(.9, .8, .04), off < 0 ? 0xe4d8b5 : 0x487fab, cloth, M(x + off + .28, 2.15, z), false);
        }
        for (const off of [-2, 0, 2]) W(k, box(1.1, 1.5, .05), off < 0 ? 0x253e60 : off > 0 ? 0x933a36 : 0xc4a14c, cloth, M(x + off, 2.35, -5.2), false);
      }
    }
    W(k, box(13, 1.05, .18), 0x352418, timber, M(0, 3.05, 6.2), false);
  }, floor);
  for (const c of S.counters) {
    addBox(...T(c.lx, S.lz + CZ), 7.6, 1.4, yaw0);
    addCirc(...T(c.lx, S.lz - 4.5), .38);
    sign(c.id, 5.3, .75, c.lx, floor + 3.0, S.lz - 5.1);
  }
  sign(S.id, 12.6, .9, S.lx, floor + 3.05, -29.65);
  return false;
}
