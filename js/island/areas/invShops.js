// [inventory] THE PLAZA SHOPS, logic + placeholders (BANKSY 11:11-11:14 AM): FISH STAND (buys fish), ANTIQUES (buys every other earned
// item: maps, valuables, shards, chest finds, spare cosmetics, weapons) and the player MARKETPLACE. Timothy builds the real 3D buildings
// (timothy/plaza-shops, round the planned fountain roundabout); this file only places simple placeholder stalls + the E / tap triggers.
// CONTRACT (agreed): assets/island/plaza_shops.json, keys fish / antiques / market, each { door_<id>: {x,y,z,rotY}, sign_<id>, counter_<id>,
// trigger_<id>: {x,y,z,radius?=3} } in the FOOT frame (the island's x / z, y up). Missing file = the FALLBACK positions below (free plaza
// = Timothy's anchors, nothing of his is edited). With the file present the placeholders hide (his buildings + colliders stand there;
// the placeholders add NO colliders either way).
import * as THREE from 'three';
import { Kit, M, box, cyl, W, C } from './common.js';
import { SHOP_IDS, SHOP_NAMES, SHOP_ICON_IDS, FALLBACK, shopSpots } from '../../inventory/shopSpots.js';
export { SHOP_IDS, SHOP_NAMES, FALLBACK, shopSpots };
let SPOTS = shopSpots(null); const Q = {};
const INV_STALLS = typeof location !== 'undefined' && new URLSearchParams(location.search).get('invstalls') !== '0'; // [v209] BANKSY 1:03 PM "Show the shop stalls now": on by default, &invstalls=0 = kill switch
const ready = (typeof fetch === 'function' ? fetch(new URL('../../../assets/island/plaza_shops.json', import.meta.url)).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null))
  .then((j) => { if (!j) return; SPOTS = shopSpots(j); for (const id of SHOP_IDS) if (Q[id]) Object.assign(Q[id], { x: SPOTS[id].trigger.x, z: SPOTS[id].trigger.z, r: SPOTS[id].trigger.radius }); });
await ready; // top-level: the file (or its 404) is read before the island registers its interact points, so the triggers sit where it says
export const shopsReady = () => ready;
export default {
  id: 'inv_shops', name: 'Plaza shops', rect: [-475, -435, -135, -100],   // Timothy's Market Square (x -461..-437, z -117.5..-103.4) + the antiques room
  terrain: { pads: [], paths: [] },
  register(h) { for (const id of SHOP_IDS) { const s = SPOTS[id].trigger;
      h.INTERACT.push(Q[id] = { id: 'invshop_' + id, kind: 'shop', icon: SHOP_ICON_IDS[id], area: 'inv_shops', x: s.x, z: s.z, r: s.radius, label: 'E · ' + SHOP_NAMES[id] }); } },
  build({ MATS, OUT, H }) {
    const near = new THREE.Group(); near.name = 'area_inv_shops';
    if (SHOP_IDS.every(id => SPOTS[id].fromFile)) return { near };                 // Timothy's buildings are in: no placeholders
    if (!INV_STALLS) return { near };   // &invstalls=0 = no placeholder stalls (prompt-only E / tap triggers); Timothy moves them to the dock plaza later
    const k = new Kit(), COL = { fish: 0x1d7fb8, antiques: 0xb0267a, market: 0xa77a12 };
    for (const id of SHOP_IDS) { if (SPOTS[id].fromFile) continue; const { x, z } = SPOTS[id].trigger, y = H(x, z) - 0.05, c = COL[id];
      W(k, box(3.2, 1.0, 1.2), C.WOOD, M(x, y + 0.5, z - 1.4));                           // counter
      for (const s of [-1, 1]) W(k, cyl(0.08, 0.08, 2.6, 6), C.WOOD_D, M(x + s * 1.5, y + 1.3, z - 1.9));
      W(k, box(3.6, 0.14, 2.0), c, M(x, y + 2.65, z - 1.5, 0.18));                        // awning in the shop colour
      W(k, box(1.6, 0.5, 0.08), C.WOOD_L, M(x, y + 3.05, z - 2.4), false); }              // sign board
    near.add(k.build(MATS, OUT)); return { near };
  },
  label(q) { return null; },
  activate(q) { const id = q.id.slice(8); if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pfp-shop', { detail: { shop: id } })); return null; },
};
