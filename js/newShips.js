// [Emerly] PUMPFUN PIRATES · NEW SHIPS (BANKSY 7:41 PM: "Make p4 p6 p8 p9 p10, ships"; 7:42 PM: "They won't go in that prestige order
// we are just making new ships we can rework the order"). Five new top-tier hulls, each above the GOLDEN GALLEON and the DIAMOND SHIP:
// OPAL EMPEROR, LEVIATHAN, CELESTIAL GALLEON, SUN KING, POSEIDON'S THRONE. Looks: assets/ships/pvp/newShips/*.js (animated hulls).
//
// THE ONE TABLE to wire them up later: `unlock` is null for every ship = NOT unlockable / not sold / not in any menu yet (no server
// or migration change). To ship one later, set e.g. unlock: { prestige: 4 } or { kills: 300 } here, add it to js/config.js
// PVP_SKIN_TIERS + js/shopCatalog.js SKIN_ITEMS, and mirror it in supabase/functions/pvp/lib.ts (SHOP_ITEMS, PRESTIGE_SKINS and the
// equipped-skin check in cleanProfile). The owner (BANKSYDEGEN) gets every item free as always (js/pvpSave.js ownerAllSkins).
//
// PREVIEW (dev / owner, local only, never saved or sent): add ?newship=<id> to the game URL (opal | leviathan | celestial | sunking |
// poseidon) and your own Battle Royale ship renders as that hull. tools/new_ships_viewer.html shows them on the water.
import { OPAL } from '../assets/ships/pvp/newShips/opal.js';
import { LEVIATHAN } from '../assets/ships/pvp/newShips/leviathan.js';
import { CELESTIAL } from '../assets/ships/pvp/newShips/celestial.js';
import { SUNKING } from '../assets/ships/pvp/newShips/sunKing.js';
import { POSEIDON } from '../assets/ships/pvp/newShips/poseidon.js';

export const NEW_SHIPS = [
  { id: 'opal',      name: 'OPAL EMPEROR',      skin: OPAL,      concept: 'P4', unlock: null },
  { id: 'leviathan', name: 'LEVIATHAN',         skin: LEVIATHAN, concept: 'P6', unlock: null },
  { id: 'celestial', name: 'CELESTIAL GALLEON', skin: CELESTIAL, concept: 'P8', unlock: null },
  { id: 'sunking',   name: 'SUN KING',          skin: SUNKING,   concept: 'P9', unlock: null },
  { id: 'poseidon',  name: "POSEIDON'S THRONE", skin: POSEIDON,  concept: 'P10', unlock: null },
];
export const NEW_SHIP_IDS = NEW_SHIPS.map(s => s.id);
export const newShipOf = (id) => NEW_SHIPS.find(s => s.id === id) || null;
// ?newship=<id>: the local player's ship look only (visual; the save keeps your real equipped skin)
export function previewShipId() {
  try { const id = new URLSearchParams(location.search).get('newship'); return id && newShipOf(id) ? id : null; } catch { return null; }
}
