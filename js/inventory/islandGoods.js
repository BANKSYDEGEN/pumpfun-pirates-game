// [v349 money-makers] ISLAND GOODS: what the 5 island gold loops gather (crab pots, reef / wreck diving, cave mining, cottage spice plots +
// rum stills). One source for the client (bag icons / names / rarities, shop sell prices), migration 053 (pvp_isl_prices seed rows; the
// tests check they match) and supabase/functions/pvp/island.ts (ISLAND_GOODS copy, tests check it matches too).
// Keys: isl:<id>. Shops: 'fish' = FISH MARKET, 'antiques' = TREASURE TRADER, 'rum' = HARBOR RUM EXPORT STALL. A good can sell at more than one.
// Separate from js/inventory/catalog.js on purpose: catalog.js is code-generated into invCatalog.ts and seeds migration 036 (untouched).
export const ISLAND_GOODS = {
  // crabs (shore crab pots) -> FISH MARKET
  shore_crab:      { name: 'Shore Crab',          icon: '🦀', rarity: 'common',    src: 'crab',  sell: { fish: 40 } },
  blue_claw_crab:  { name: 'Blue Claw Crab',      icon: '🦀', rarity: 'uncommon',  src: 'crab',  sell: { fish: 85 } },
  spiny_king_crab: { name: 'Spiny King Crab',     icon: '🦞', rarity: 'rare',      src: 'crab',  sell: { fish: 170 } },
  golden_emperor_crab: { name: 'Golden Emperor Crab', icon: '🦀', rarity: 'epic', src: 'crab',  sell: { fish: 420 } },
  // reef + shipwreck diving -> TREASURE TRADER
  sea_pearl:       { name: 'Sea Pearl',           icon: '⚪', rarity: 'uncommon',  src: 'dive',  sell: { antiques: 120 } },
  black_pearl:     { name: 'Black Pearl',         icon: '⚫', rarity: 'rare',      src: 'dive',  sell: { antiques: 450 } },
  barnacled_doubloons: { name: 'Barnacled Doubloons', icon: '🪙', rarity: 'uncommon', src: 'dive', sell: { antiques: 220 } },
  // Dead Man's Cave mining -> TREASURE TRADER
  iron_ore:        { name: 'Iron Ore',            icon: '🪨', rarity: 'common',    src: 'mine',  sell: { antiques: 45 } },
  refined_saltpeter: { name: 'Refined Saltpeter', icon: '🧂', rarity: 'common',    src: 'mine',  sell: { antiques: 60 } },
  cave_gold_nugget: { name: 'Cave Gold Nugget',   icon: '🟡', rarity: 'rare',      src: 'mine',  sell: { antiques: 300 } },
  // cottage spice plots (brew ingredients; spare ones sell cheap)
  island_cane:     { name: 'Island Cane',         icon: '🎋', rarity: 'common',    src: 'plot',  sell: { antiques: 12 } },
  island_spices:   { name: 'Island Spices',       icon: '🌶️', rarity: 'common',    src: 'plot',  sell: { antiques: 18 } },
  // cottage copper rum still -> HARBOR RUM EXPORT STALL (best) or TREASURE TRADER
  cottage_spiced_rum: { name: 'Cottage Spiced Rum', icon: '🍾', rarity: 'rare',    src: 'still', sell: { rum: 140, antiques: 110 } },
  reserve_spiced_rum: { name: 'Reserve Spiced Rum', icon: '🥃', rarity: 'epic',    src: 'still', sell: { rum: 175, antiques: 135 } },
};
export const ISL_KEY_RE = /^isl:[a-z_]{2,24}$/;
export const ISL_SHOPS = ['fish', 'antiques', 'rum'];
export const ISL_SHOP_NAMES = { fish: 'FISH MARKET', antiques: 'TREASURE TRADER', rum: 'HARBOR RUM EXPORT STALL' };
export const islKey = (id) => `isl:${id}`;
export function islInfo(key) {
  const m = /^isl:([a-z_]{2,24})$/.exec(String(key)); const g = m && ISLAND_GOODS[m[1]];
  return g ? { kind: 'island', id: m[1], ...g } : null;
}
export const islPrice = (key, shop) => islInfo(key)?.sell?.[shop] | 0;
// every NPC price row [key, shop, price]: migration 053 seeds exactly these (tests/v349IslandMoneyMakers.test.mjs)
export function islPriceRows() {
  const out = []; for (const [id, g] of Object.entries(ISLAND_GOODS)) for (const [shop, p] of Object.entries(g.sell)) out.push([islKey(id), shop, p]);
  return out;
}
