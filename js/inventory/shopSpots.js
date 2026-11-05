// [inventory] the plaza_shops.json contract parser + fallback spots (pure: node-tested, used by js/island/areas/invShops.js)
export const SHOP_IDS = ['fish', 'antiques', 'market'];
export const SHOP_NAMES = { fish: 'FISH MARKET', antiques: 'TREASURE TRADER', market: 'MARKETPLACE' };   // [v241] ANTIQUES -> TREASURE TRADER (shop key stays 'antiques': server, prices, flags unchanged)   // [v240] the Fish Stand grew into the FISH MARKET
export const SHOP_PROMPTS = { fish: 'SELL FISH', antiques: 'SELL TREASURE', market: 'TRADE' };   // [v248] market: TRADE (walk-in)   // [v245] walk-up prompt text (BANKSY 7:27 PM 'fix the treasure sell point'); panel titles stay SHOP_NAMES
export const SHOP_ICON_IDS = { fish: 'fish_stand', antiques: 'antiques', market: 'market' }; // js/mapIcons.js badges (post/minimap-themes)
export const FALLBACK = { // [v212] = assets/island/plaza_shops.json (BANKSY 1:21 PM "move the marketplaces to the plaza"): existing structures reused, numbers from building_numbers.json
  // [v240] BANKSY 6:19 PM: FISH MARKET = #8 (the old Token Exchange spot + the tavern tables, js/island/plazaTown.js FISH_MARKET), MARKETPLACE =
  // #7 the Harbor Exchange Hall entrance (MARKET_DOOR). Their signs are painted on the buildings (plazaTown signList), so sign: false = no
  // floating board here (the v212 boards stood edge-on to the street, rotY 0, and never read). Stalls #18 / #19 are plain decor again.
  fish:     { trigger: { x: -604.5, y: 2.73, z: -16.8, radius: 3.5 }, rotY: 0, sign: false },   // [v248] centred in the wider shop (lx 73.2, lz -35.5; lx 56.9-89.5), r 3.5   // [v247] #10 FISH MARKET (walk-in, on the row where #10 house_e + #11 the tower stood): the shop floor 5.5 m in from the door (town lx 82, lz -35.5), r 3 = a couple of steps in, not the street (v240: #8 shed, x -618.8 z -25.75 r 3.5)
  antiques: { trigger: { x: -566.9, y: 5.8, z: -96.2, radius: 3.2 }, rotY: 1.571, sign: false },   // [v246] BANKSY 7:36 PM 'make sell point inside the stores': on the shop floor in front of the counter (lx -6.2, lz -73.1; rent_1 interior lx -10.85..-2.5), r 3.2 = a step or two in through the door, not the doorstep / street (v245 lx -0.3 r 3.6, v241 lx 0 r 2.6)   // [v241] signs: js/island/areas/treasureTrader.js // #20 rent_1, the empty stone hill-street shop at the plaza end (door lx -2)
  market:   { trigger: { x: -604.5, y: 2.73, z: -43.0, radius: 3.5 }, rotY: 0, sign: false },   // [v248] #7 MARKETPLACE walk-in: mid-floor 5.5 m inside the hall_e door (town lx 47, lz -35.5; v240 the doorway lz -27.4)
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
