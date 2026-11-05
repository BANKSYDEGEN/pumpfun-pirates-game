// [Emerly] PUMPFUN PIRATES · NEW SHIPS (BANKSY 7:41 PM: "Make p4 p6 p8 p9 p10, ships"; 7:42 PM: "They won't go in that prestige order
// we are just making new ships we can rework the order"). Five new top-tier hulls, each above the GOLDEN GALLEON and the DIAMOND SHIP:
// OPAL EMPEROR, LEVIATHAN, CELESTIAL GALLEON, SUN KING, POSEIDON'S THRONE. Looks: assets/ships/pvp/newShips/*.js (animated hulls).
//
// THE ONE TABLE (ids, names, which PRESTIGE level gives each one) is js/newShipsTable.js (pure data; mirrored on the server in
// supabase/functions/pvp/lib.ts NEW_SHIP_PRESTIGE). This file only attaches the looks. The owner (BANKSYDEGEN) has every skin.
//
// PREVIEW (dev / test hosts only, never on the live host, never saved or sent): add ?newship=<id> to the game URL (opal | leviathan | celestial | sunking |
// poseidon) and your own Battle Royale ship renders as that hull. tools/new_ships_viewer.html shows them on the water.
import { NEW_SHIP_TABLE } from './newShipsTable.js';
import { IS_PROD_HOST } from './env.js';
import { OPAL } from '../assets/ships/pvp/newShips/opal.js';
import { LEVIATHAN } from '../assets/ships/pvp/newShips/leviathan.js';
import { CELESTIAL } from '../assets/ships/pvp/newShips/celestial.js';
import { SUNKING } from '../assets/ships/pvp/newShips/sunKing.js';
import { POSEIDON } from '../assets/ships/pvp/newShips/poseidon.js';

const LOOKS = { opal: OPAL, leviathan: LEVIATHAN, celestial: CELESTIAL, sunking: SUNKING, poseidon: POSEIDON };
export const NEW_SHIPS = NEW_SHIP_TABLE.map(r => ({ ...r, skin: LOOKS[r.id] }));
export const NEW_SHIP_IDS = NEW_SHIPS.map(s => s.id);
export const newShipOf = (id) => NEW_SHIPS.find(s => s.id === id) || null;
// ?newship=<id>: the local player's ship look only (visual; the save keeps your real equipped skin). Ignored on the live host
// (game.pumpfunpirates.com): there the ships are prestige rewards (the owner equips them from the skin menu).
export function previewShipId() {
  if (IS_PROD_HOST) return null;
  try { const id = new URLSearchParams(location.search).get('newship'); return id && newShipOf(id) ? id : null; } catch { return null; }
}
