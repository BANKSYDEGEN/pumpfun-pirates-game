// PUMPFUN PIRATES · [admin-spawn t2149u] pure item lists for the owner Admin Menu (js/adminMenu.js): no DOM, no network.
import { FISH, VALUABLES, GUN_ITEMS, WEAPON_BASES, WEAPON_TIERS, itemInfo, MUSKET_MAX_LV, muskKeyAt, muskLevelOf } from './inventory/catalog.js';
import { ISLAND_GOODS, islKey } from './inventory/islandGoods.js';
// every item BANKSY can slip into pockets
export function giveCatalog() {
  const out = [];
  for (const [id, f] of Object.entries(FISH)) out.push({ key: `fish:${id}`, name: f.name, icon: f.icon, rarity: f.rarity, group: 'Fish' });
  for (const [id, v] of Object.entries(VALUABLES)) out.push({ key: `val:${id}`, name: v.name, icon: v.icon, rarity: v.rarity, group: 'Treasure' });
  for (const [id, g] of Object.entries(GUN_ITEMS)) out.push({ key: `val:${id}`, name: g.name, icon: g.icon, rarity: g.rarity, group: 'Musket parts' });
  for (const [slot, bases] of Object.entries(WEAPON_BASES)) for (const b of bases) for (const t of WEAPON_TIERS) { const i = itemInfo(`wpn:${slot}:${b}:${t}`); if (i) out.push({ key: `wpn:${slot}:${b}:${t}`, name: i.name, icon: i.icon, rarity: t, group: slot === 'sword' ? 'Swords' : 'Muskets' }); }
  return out;
}
// [admin-spawn t2149u] the FULL list for BANKSY's own ITEM SPAWNER, built from the real registries: every musket LEVEL 1-20 + island goods.
// srv: 'live' = the deployed admin_pocket_give takes it today; '062' = needs migration 062_admin_spawn_all.sql (isl: + levelled muskets).
export function spawnCatalog() {
  const out = giveCatalog().filter(c => !c.key.startsWith('wpn:musket:')).map(c => ({ ...c, srv: 'live' }));
  for (const b of WEAPON_BASES.musket) for (let lv = 1; lv <= MUSKET_MAX_LV; lv++) { const key = muskKeyAt(b, lv), i = itemInfo(key); if (i) out.push({ key, name: i.name, icon: i.icon, rarity: i.rarity, group: 'Muskets', srv: (lv - 1) % 5 === 0 ? 'live' : '062' }); }
  for (const [id, g] of Object.entries(ISLAND_GOODS)) out.push({ key: islKey(id), name: g.name, icon: g.icon, rarity: g.rarity, group: 'Island goods · ' + (g.src || 'misc'), srv: '062' });
  return out;
}
// the max-upgraded key for an owned item (null = already max / nothing to upgrade)
export function maxKeyOf(key) {
  const p = String(key).split(':'); if (p[0] !== 'wpn') return null;
  if (p[1] === 'musket') { const lv = muskLevelOf(key); return lv && lv < MUSKET_MAX_LV ? muskKeyAt(p[2], MUSKET_MAX_LV) : null; }
  if (p[1] === 'sword' && p[3] !== 'legendary' && WEAPON_BASES.sword.includes(p[2])) return `wpn:sword:${p[2]}:legendary`;
  return null;
}
