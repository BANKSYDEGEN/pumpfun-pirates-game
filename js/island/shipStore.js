// One shared shell on the former upgrade + skins lots; two independent shop counters.
import * as THREE from 'three';
export const SHIP_STORE = Object.freeze({ id: 'ship_store', lx: 26, lz: -36, w: 22, d: 12, promptLz: -35.5,
  counters: Object.freeze([{ id: 'shop_upgrades', lx: 20.5, color: 0xc49731 }, { id: 'shop_ships', lx: 32, color: 0x367bd0 }]) });
export function buildShipStore(h, { stoneHouse, shopWalkInCols, sign }) {
  const { k, W, box, cyl, M, at, addBox, addCirc, T, yaw0 } = h;
  const S = SHIP_STORE, floor = 2.73, timber = 26, trim = 22, cloth = 32;
  stoneHouse(S.lx, S.w, 3, 2, { shop: true, hollow: true, openGround: true });
  shopWalkInCols(S);
  at(S.lx, S.lz, 0, () => {
    // Dark oak skirting, navy runner and brass threshold; wide, obstruction-free central aisle.
    W(k, box(S.w - 1.1, .12, 1), 0x684225, timber, M(0, .06, 5.25), false);
    W(k, box(7.6, .025, 7), 0x254c72, cloth, M(0, .075, 1.4), false);
    W(k, box(S.w - 1.2, 2.8, .16), 0x443021, timber, M(0, 1.8, -5.4), false);
    for (const c of S.counters) {
      const x = c.lx - S.lx, z = -1.6, width = 7.4;
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
    addBox(...T(c.lx, S.lz - 1.6), 7.6, 1.4, yaw0);
    addCirc(...T(c.lx, S.lz - 3.5), .38);
    sign(c.id, 5.3, .75, c.lx, floor + 3.0, S.lz - 5.1);
  }
  sign(S.id, 12.6, .9, S.lx, floor + 3.05, -29.65);
}
