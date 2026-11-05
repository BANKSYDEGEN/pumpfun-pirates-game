// [inventory] THE ITEM CATALOG: one source for the client (grid icons / names), the Edge Function (supabase/functions/pvp/invCatalog.ts is
// GENERATED from this file by tools/gen_inv_catalog.mjs) and the SQL price table (migration 036 seeds pvp_inv_prices; tests check it matches).
// Item keys: fish:<id> · val:<id> (valuables + island finds) · wpn:<sword|musket>:<base>:<rarity> · dup:<slot>:<id> (a chest cosmetic you
// already own) · map:<uuid> (a treasure map: one row in pvp_maps, never stacks). Everything sell-related sits behind flags that are OFF.
export const FLAGS = {
  INV_ON: true,              // the HUD INVENTORY grid (was the MAPS button)
  FISH_SELL_ON: true,        // Fish Stand pays gold (BANKSY 12:55 PM: on, 25-500 by rarity; migration 037)
  ANTIQUES_SELL_ON: true,    // Antiques shop pays gold (prices = BANKSY 11:19 AM; on 12:55 PM)
  GIFT_ON: true,             // gifting between players (no gold moves)
  MARKET_ON: true,           // the player Marketplace (on: BANKSY 12:55 PM)
  MARKET_FEE_ON: false,      // listing fee / sales tax gold sink (BANKSY to decide)
  WEAPON_STATS_ON: true,     // rarity stats on swords / muskets
  RARE_WEAPON_DROPS_ON: true,  // rare+ weapons in chests
  TEST_ONLY_LOCK: false,     // owner test-kit copies can't be sold / listed / gifted (BANKSY 11:18: OFF, "it's just for me")
};
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_COLOR = { common: '#c9c9c9', uncommon: '#6fd36f', rare: '#4fa8ff', epic: '#c070ff', legendary: '#ffcd3c' };
// FISH (the lagoon's 8 species, js/island/areas/lagoon.js FISH): Fish Stand PROPOSAL, by rarity of the bite
export const FISH = {
  minnow:    { name: 'Lagoon Minnow',    icon: '🐟', rarity: 'common',    fish: 25 },
  perch:     { name: 'Mossy Perch',      icon: '🐟', rarity: 'common',    fish: 35 },
  snapper:   { name: 'Rainbow Snapper',  icon: '🐠', rarity: 'uncommon',  fish: 60 },
  eel:       { name: 'Spotted Eel',      icon: '🐍', rarity: 'uncommon',  fish: 90 },
  pike:      { name: 'Pirate Pike',      icon: '🐟', rarity: 'rare',      fish: 140 },
  carp:      { name: 'Golden Carp',      icon: '🐡', rarity: 'rare',      fish: 200 },
  koi:       { name: 'Ghost Koi',        icon: '🎏', rarity: 'epic',      fish: 300 },
  leviathan: { name: 'Lagoon Leviathan', icon: '🐋', rarity: 'legendary', fish: 500 },
};
export const FISH_WEIGHT = { minnow: 30, perch: 24, snapper: 16, eel: 12, pike: 9, carp: 5, koi: 3, leviathan: 1 }; // = lagoon.js weights
// [fish2] length range (cm) per species = js/island/areas/lagoon.js FISH; the server rolls the length with the species (the catch card shows it)
export const FISH_CM = { minnow: [6, 14], perch: [15, 32], snapper: [20, 45], eel: [40, 110], pike: [45, 95], carp: [30, 70], koi: [35, 80], leviathan: [150, 260] };
// VALUABLES + island finds: Antiques shop, BANKSY 11:19 AM: "keep item values they find 500-5000" (common ~500 .. legendary 5000)
export const VALUABLES = {
  silver_ring:    { name: 'Silver Ring',       icon: '💍', rarity: 'common',    antiques: 500 },
  idol_shard:     { name: 'Idol Shard',        icon: '🔶', rarity: 'common',    antiques: 500 },
  river_pearl:    { name: 'River Pearl',       icon: '⚪', rarity: 'common',    antiques: 500 },
  gold_bar:       { name: 'Gold Bar',          icon: '🧈', rarity: 'uncommon',  antiques: 1000 },
  pearl_necklace: { name: 'Pearl Necklace',    icon: '📿', rarity: 'uncommon',  antiques: 1200 },
  ruby:           { name: 'Ruby',              icon: '🔴', rarity: 'rare',      antiques: 2000 },
  gem_ring:       { name: 'Gold Ring w/ Gem',  icon: '💍', rarity: 'rare',      antiques: 2200 },
  diamond:        { name: 'Diamond',           icon: '💎', rarity: 'epic',      antiques: 3500 },
  jewel_necklace: { name: 'Jewelled Necklace', icon: '📿', rarity: 'epic',      antiques: 3500 },
  crown_jewel:    { name: 'Royal Crown Jewel', icon: '👑', rarity: 'legendary', antiques: 5000 },
};
export const MAP_ANTIQUES = 100;                       // BANKSY: "sell a map for 100 gold"
export const RARITY_ANTIQUES = { common: 500, uncommon: 1000, rare: 2000, epic: 3500, legendary: 5000 }; // weapons + cosmetic duplicates
// a duplicate chest cosmetic -> its rarity from its shop price
export const dupRarity = (price) => price <= 1500 ? 'common' : price <= 5000 ? 'uncommon' : price <= 12000 ? 'rare' : price <= 25000 ? 'epic' : 'legendary';
// WEAPONS: rarity tiers on top of the shop bases. MODEST stats (PvP stays fair). rare+ NEVER sold in a store: chests only.
export const WEAPON_BASES = { sword: ['rusty', 'cutlass', 'rapier', 'bone'], musket: ['rusty', 'navy', 'blunder', 'dragoon'] }; // goal-locked bases (gilded / gold / bone musket) are never rolled
export const WEAPON_TIERS = ['common', 'rare', 'epic', 'legendary'];
export const WEAPON_STATS = { // multipliers on the arena base (js/onfoot/battle.js ARENA): dmg, reload (lower = faster), range, accuracy (spread), swing (cooldown, lower = faster)
  common:    { dmg: 1.00, reload: 1.00, range: 1.00, acc: 1.00, swing: 1.00 },
  rare:      { dmg: 1.04, reload: 0.97, range: 1.03, acc: 1.02, swing: 0.97 },
  epic:      { dmg: 1.07, reload: 0.95, range: 1.05, acc: 1.04, swing: 0.95 },
  legendary: { dmg: 1.10, reload: 0.92, range: 1.07, acc: 1.06, swing: 0.92 },
};
// the arena numbers with a rarity applied (the hook for battle.js; flag off = base numbers)
export function weaponStats(slot, rarity, base, on = FLAGS.WEAPON_STATS_ON) {
  const m = (on && WEAPON_STATS[rarity]) || WEAPON_STATS.common, o = { ...base };
  if (slot === 'sword') { if ('dmg' in o) o.dmg = Math.round(o.dmg * m.dmg); if ('cool' in o) o.cool = +(o.cool * m.swing).toFixed(3); if ('reach' in o) o.reach = +(o.reach * m.range).toFixed(3); }
  else { if ('dmg' in o) o.dmg = Math.round(o.dmg * m.dmg); if ('reload' in o) o.reload = +(o.reload * m.reload).toFixed(3); if ('range' in o) o.range = +(o.range * m.range).toFixed(2); if ('wide' in o) o.wide = +(o.wide / m.acc).toFixed(3); }
  return o;
}
// CHEST DROPS (BANKSY 11:12: "don't get gold from chests only items"): per mille tables, the server rolls them from the map id
export const CHEST_VALUABLES = {
  common:    { silver_ring: 450, gold_bar: 300, pearl_necklace: 200, ruby: 50 },
  rare:      { gold_bar: 300, pearl_necklace: 200, ruby: 250, gem_ring: 150, diamond: 80, jewel_necklace: 20 },
  legendary: { ruby: 200, gem_ring: 200, diamond: 250, jewel_necklace: 200, crown_jewel: 150 },
};
export const CHEST_EXTRA_VALUABLE = { common: 0, rare: 250, legendary: 1000 }; // per mille: a 2nd valuable
export const CHEST_WEAPON = { // per mille a weapon drops, then its tier. common chests = common (store) bases only
  common:    { chance: 100, tiers: { common: 1000 } },
  rare:      { chance: 200, tiers: { rare: 750, epic: 220, legendary: 30 } },
  legendary: { chance: 500, tiers: { rare: 400, epic: 450, legendary: 150 } },
};
export const STACKS = (key) => !key.startsWith('map:');             // maps carry their own spot: one slot each
// [Emerly musket-rank + gunacc] MUSKET PARTS (rank-up material) + the 4 GUN ACCESSORIES (one per sub-slot of the EQUIPPED musket).
// Keys fit the existing val: pattern (no CHECK change). Not in VALUABLES on purpose: the Antiques shop never buys them (priceRows unchanged).
// Boosts are MODEST (PvP): see js/musketUpgrades.js GUN_ACC for the numbers. Prices = the MUSKET SHOP (cheapest first).
export const GUN_ITEMS = {
  musket_parts: { kind: 'part', name: 'Musket Parts', icon: '🔩', rarity: 'common' },
  acc_stock:    { kind: 'gunacc', acc: 'stock', name: 'Padded Stock', icon: '🪵', rarity: 'uncommon', price: 600 },
  acc_bayonet:  { kind: 'gunacc', acc: 'bayonet', name: 'Bayonet', icon: '🔪', rarity: 'uncommon', price: 800 },
  acc_horn:     { kind: 'gunacc', acc: 'horn', name: 'Powder Horn', icon: '📯', rarity: 'rare', price: 1000 },
  acc_scope:    { kind: 'gunacc', acc: 'scope', name: 'Brass Scope', icon: '🔭', rarity: 'rare', price: 1200 },
};
export function itemInfo(key) {
  const p = String(key).split(':');
  if (p[0] === 'fish' && FISH[p[1]]) return { kind: 'fish', ...FISH[p[1]], antiques: 0 };
  if (p[0] === 'val' && GUN_ITEMS[p[1]]) return { ...GUN_ITEMS[p[1]], antiques: 0, fish: 0 }; // [Emerly musket-rank / gunacc] not sold to NPCs
  if (p[0] === 'val' && VALUABLES[p[1]]) return { kind: 'valuable', ...VALUABLES[p[1]], fish: 0 };
  if (p[0] === 'wpn' && WEAPON_BASES[p[1]]?.includes(p[2]) && WEAPON_TIERS.includes(p[3])) return { kind: 'weapon', slot: p[1], base: p[2], rarity: p[3], name: `${p[3][0].toUpperCase() + p[3].slice(1)} ${p[2]} ${p[1]}`, icon: p[1] === 'sword' ? '🗡️' : '🔫', antiques: RARITY_ANTIQUES[p[3]], fish: 0 };
  if (p[0] === 'dup' && p.length === 4) { const r = RARITIES.includes(p[3]) ? p[3] : 'common'; return { kind: 'dup', slot: p[1], id: p[2], rarity: r, name: `Spare ${p[2].replace(/_/g, ' ')}`, icon: '🎩', antiques: RARITY_ANTIQUES[r], fish: 0 }; }
  if (p[0] === 'map') return { kind: 'map', name: 'Treasure Map', icon: '🗺️', rarity: 'common', antiques: MAP_ANTIQUES, fish: 0 };
  return null;
}
export const KEY_RE = /^(fish:[a-z_]{2,16}|val:[a-z_]{2,20}|wpn:(sword|musket):[a-z_]{2,16}:(common|rare|epic|legendary)|dup:[a-z]{2,10}:[a-z0-9_]{2,24}:(common|uncommon|rare|epic|legendary))$/;
// every NPC price, flat: [key, shop, base price]. migration 036 seeds exactly these rows (tests/inventory.test.mjs checks)
export function priceRows() {
  const out = [];
  for (const [id, f] of Object.entries(FISH)) out.push([`fish:${id}`, 'fish', f.fish]);
  for (const [id, v] of Object.entries(VALUABLES)) out.push([`val:${id}`, 'antiques', v.antiques]);
  for (const [s, bases] of Object.entries(WEAPON_BASES)) for (const b of bases) for (const t of WEAPON_TIERS) out.push([`wpn:${s}:${b}:${t}`, 'antiques', RARITY_ANTIQUES[t]]);
  return out;
}
// PROVENANCE: where an inventory row came from. Only EARNED items can be sold / gifted / listed (no gold loops).
export const SOURCES = ['fish', 'chest', 'find', 'gift', 'market', 'kit', 'carry_buy', 'carry_grant'];
export const TRADEABLE_SOURCES = ['fish', 'chest', 'find', 'gift', 'market', 'kit', 'carry_grant']; // carry_buy = a gold-bought shop weapon: never resold
export const MARKET = { minPrice: 10, maxPrice: 1000000, maxActive: 20, listPerMin: 6, buyPerMin: 10, feePct: 5 };
export const GIFT = { perMin: 6, perDay: 100, maxQty: 999 };
