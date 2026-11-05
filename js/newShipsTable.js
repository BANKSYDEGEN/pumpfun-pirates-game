// [Emerly] PUMPFUN PIRATES · THE ONE TABLE for the five new top-tier hulls (BANKSY 8:37 PM: "Just make them prestige 3 on").
// Pure data (no three.js), so js/config.js (the BR skin menu), js/shopCatalog.js (the island shop goals) and js/prestige.js (the
// prestige reward text + free grant) all read the SAME rows. To change the order, change `prestige` here AND the server mirror
// supabase/functions/pvp/lib.ts NEW_SHIP_PRESTIGE (tests/newShips.test.mjs checks the two match). Looks: js/newShips.js.
// Reaching that prestige GIVES the ship free (pvp_owned grant, like P1 GOLDEN / P2 DIAMOND). The owner (BANKSYDEGEN) has them all.
export const NEW_SHIP_TABLE = [
  { id: 'opal',      name: 'OPAL EMPEROR',      concept: 'P4',  prestige: 3 },
  { id: 'leviathan', name: 'LEVIATHAN',         concept: 'P6',  prestige: 4 },
  { id: 'celestial', name: 'CELESTIAL GALLEON', concept: 'P8',  prestige: 5 },
  { id: 'sunking',   name: 'SUN KING',          concept: 'P9',  prestige: 6 },
  { id: 'poseidon',  name: "POSEIDON'S THRONE", concept: 'P10', prestige: 7 },
];
