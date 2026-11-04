// [inventory] the plaza_shops.json contract parser + fallback spots (pure: node-tested, used by js/island/areas/invShops.js)
export const SHOP_IDS = ['fish', 'antiques', 'market'];
export const SHOP_NAMES = { fish: 'FISH STAND', antiques: 'ANTIQUES', market: 'MARKETPLACE' };
export const SHOP_ICON_IDS = { fish: 'fish_stand', antiques: 'antiques', market: 'market' }; // js/mapIcons.js badges (post/minimap-themes)
export const FALLBACK = { // ONLY for a missing/broken plaza_shops.json, never the truth: positions are ALWAYS read from the JSON (Timothy is moving fish + market to the dock plaza)
  fish:     { trigger: { x: -442.5, y: 19.225, z: -110.0, radius: 3 },   rotY: 0 },
  antiques: { trigger: { x: -453.0, y: 18.07,  z: -126.3, radius: 3 },   rotY: 0 },
  market:   { trigger: { x: -465.4, y: 16.706, z: -114.0, radius: 4.5 }, rotY: 1.571 },
};
// the contract parser: a key with a trigger_<id> wins, else the fallback. Exported for tests.
export function shopSpots(json) {
  const out = {};
  for (const id of SHOP_IDS) { const e = json && json[id], t = e && e['trigger_' + id];
    const ok = t && [t.x, t.z].every(Number.isFinite);
    out[id] = ok ? { trigger: { x: +t.x, y: +t.y || 0, z: +t.z, radius: Number.isFinite(+t.radius) && +t.radius > 0 ? +t.radius : 3 }, rotY: +(e['door_' + id]?.rotY) || 0, fromFile: true }
                 : { ...FALLBACK[id], trigger: { ...FALLBACK[id].trigger }, fromFile: false }; }
  return out;
}
