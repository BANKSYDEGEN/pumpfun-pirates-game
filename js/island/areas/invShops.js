// [inventory] THE PLAZA SHOPS, logic + placeholders (BANKSY 11:11-11:14 AM): FISH STAND (buys fish), ANTIQUES (buys every other earned
// item: maps, valuables, shards, chest finds, spare cosmetics, weapons) and the player MARKETPLACE. Timothy builds the real 3D buildings
// (timothy/plaza-shops, round the planned fountain roundabout); this file only places simple placeholder stalls + the E / tap triggers.
// CONTRACT (agreed): assets/island/plaza_shops.json, keys fish / antiques / market, each { door_<id>: {x,y,z,rotY}, sign_<id>, counter_<id>,
// trigger_<id>: {x,y,z,radius?=3} } in the FOOT frame (the island's x / z, y up). Missing file = the FALLBACK positions below (free plaza
// = Timothy's anchors, nothing of his is edited). With the file present the placeholders hide (his buildings + colliders stand there;
// the placeholders add NO colliders either way).
import * as THREE from 'three';
import { buildTreasureTrader, ttColliders } from './treasureTrader.js';   // [v241] the TREASURE TRADER storefront on hill shop #20
// [v212] BANKSY 1:21-1:22 PM: Fish Stand = dock-plaza stand #19 (lx 50), Marketplace = stand #18 (lx 34), Antiques = the empty stone shop rent_1 (#20); numbers: assets/island/building_numbers.json
import { SHOP_IDS, SHOP_NAMES, SHOP_PROMPTS, SHOP_ICON_IDS, FALLBACK, shopSpots } from '../../inventory/shopSpots.js';
export { SHOP_IDS, SHOP_NAMES, FALLBACK, shopSpots };
let SPOTS = shopSpots(null); const Q = {};
const INV_STALLS = typeof location !== 'undefined' && new URLSearchParams(location.search).get('invstalls') !== '0'; // [v209] BANKSY 1:03 PM "Show the shop stalls now": on by default, &invstalls=0 = kill switch
const ready = (typeof fetch === 'function' ? fetch(new URL('../../../assets/island/plaza_shops.json', import.meta.url)).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null))
  .then((j) => { if (!j) return; SPOTS = shopSpots(j); for (const id of SHOP_IDS) if (Q[id]) Object.assign(Q[id], { x: SPOTS[id].trigger.x, z: SPOTS[id].trigger.z, r: SPOTS[id].trigger.radius }); });
await ready; // top-level: the file (or its 404) is read before the island registers its interact points, so the triggers sit where it says
export const shopsReady = () => ready;
// a two-sided carved-look name board (canvas text; null without a DOM, e.g. node tests)
function signMesh(text, col) {
  if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#5a3219'; x.fillRect(0, 0, 512, 128); x.strokeStyle = col; x.lineWidth = 12; x.strokeRect(6, 6, 500, 116);
  x.fillStyle = '#ffcd77'; x.font = "bold 64px 'Just Another Hand', Georgia, serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
}
export default {
  id: 'inv_shops', name: 'Plaza shops', rect: [-626, -560, -102, -2],   // [v247] + the FISH MARKET on the row (#10, z -8)   // [v241] + the TREASURE TRADER storefront (z to -101.5)   // [v240] + the FISH MARKET (z -25.75)   // [v212] the dock-plaza stands (#18, #19) + rent_1 at the bottom of the hill street (#20)
  terrain: { pads: [], paths: [] },
  register(h) { ttColliders(h.addBox); for (const id of SHOP_IDS) { const s = SPOTS[id].trigger;
      h.INTERACT.push(Q[id] = { id: 'invshop_' + id, kind: 'shop', icon: SHOP_ICON_IDS[id], area: 'inv_shops', x: s.x, z: s.z, r: s.radius, label: 'E · ' + SHOP_PROMPTS[id] }); } },
  build({ MATS, OUT, low, H }) {   // [v212] the shops reuse EXISTING structures (#18 / #19 dock-plaza stands, #20 rent_1 on the hill street): no placeholder stalls, only a name sign each
    const near = new THREE.Group(); near.name = 'area_inv_shops';
    if (!INV_STALLS) return { near };   // &invstalls=0 = no signs (prompt-only E / tap triggers)
    near.add(buildTreasureTrader({ MATS, OUT, low, H }));   // [v241] library-material Kit + one sign canvas (libTex.js retags 'inv_shops')
    const COL = { fish: '#1d7fb8', antiques: '#b0267a', market: '#a77a12' };
    for (const id of SHOP_IDS) { if (SPOTS[id].sign === false) continue;   // [v240] painted on its building (plazaTown.js)
      const t = SPOTS[id].trigger, g = SPOTS[id].sign || { x: t.x, y: H(t.x, t.z) + 3.3, z: t.z, rotY: 0 };
      const m = signMesh(SHOP_NAMES[id], COL[id]); if (!m) continue; m.position.set(g.x, g.y, g.z); m.rotation.y = +g.rotY || 0; near.add(m); }
    return { near };
  },
  label(q) { return null; },
  activate(q) { const id = q.id.slice(8); if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pfp-shop', { detail: { shop: id } })); return null; },
};
