// [inventory] the plaza_shops.json contract parser + fallback spots (pure: node-tested, used by js/island/areas/invShops.js)
export const SHOP_IDS = ['fish', 'antiques', 'market'];
export const SHOP_NAMES = { fish: 'FISH MARKET', antiques: 'TREASURE TRADER', market: 'MARKETPLACE' };   // [v241] ANTIQUES -> TREASURE TRADER (shop key stays 'antiques': server, prices, flags unchanged)   // [v240] the Fish Stand grew into the FISH MARKET
export const SHOP_ICON_IDS = { fish: 'fish_stand', antiques: 'antiques', market: 'market' }; // js/mapIcons.js badges (post/minimap-themes)
export const FALLBACK = { // [v212] = assets/island/plaza_shops.json (BANKSY 1:21 PM "move the marketplaces to the plaza"): existing structures reused, numbers from building_numbers.json
  // [v240] BANKSY 6:19 PM: FISH MARKET = #8 (the old Token Exchange spot + the tavern tables, js/island/plazaTown.js FISH_MARKET), MARKETPLACE =
  // #7 the Harbor Exchange Hall entrance (MARKET_DOOR). Their signs are painted on the buildings (plazaTown signList), so sign: false = no
  // floating board here (the v212 boards stood edge-on to the street, rotY 0, and never read). Stalls #18 / #19 are plain decor again.
  fish:     { trigger: { x: -618.8, y: 2.73, z: -25.75, radius: 3.5 }, rotY: 0, sign: false },   // #8 FISH MARKET, 1.2 m in front of the counter (town lx 64.25, lz -21.2)
  antiques: { trigger: { x: -566.9, y: 5.54, z: -90.0, radius: 2.6 }, rotY: 1.571, sign: false },   // [v241] signs: js/island/areas/treasureTrader.js // #20 rent_1, the empty stone hill-street shop at the plaza end (door lx -2)
  market:   { trigger: { x: -612.6, y: 2.73, z: -43.0, radius: 3.5 }, rotY: 0, sign: false },   // #7 MARKETPLACE, the hall_e doorway (town lx 47, lz -27.4)
};
// the contract parser: a key with a trigger_<id> wins, else the fallback. Exported for tests.
export function shopSpots(json) {
  const out = {};
  for (const id of SHOP_IDS) { const e = json && json[id], t = e && e['trigger_' + id];
    const ok = t && [t.x, t.z].every(Number.isFinite);
    out[id] = ok ? { sign: e['sign_' + id] === false ? false : e['sign_' + id] || null, trigger: { x: +t.x, y: +t.y || 0, z: +t.z, radius: Number.isFinite(+t.radius) && +t.radius > 0 ? +t.radius : 3 }, rotY: +(e['door_' + id]?.rotY) || 0, fromFile: true }
                 : { ...FALLBACK[id], trigger: { ...FALLBACK[id].trigger }, fromFile: false }; }
  return out;
}
