// [v152] CHEST ITEMS (BANKSY: "add accessories weapons clothes for character or crew as options for treasure hunt chests").
// A dug treasure chest still pays its gold (migration 026, unchanged), and MAY also hold one ITEM: a hat, clothes, an accessory
// (eyewear, hook, peg leg, face paint) or a weapon (sword / musket), for YOU or for YOUR CREW. The SERVER picks it (the Edge
// Function, from the map id: the map id is server-made and a map is dug once, so there is nothing to re-roll); the client only shows it.
// Migration 035 (was 031) pvp_map_dig_item grants it in the SAME transaction as the dig (pvp_owned, source 'grant'); one you already own
// pays CHEST_DUP_SHARE of its shop price in gold instead (x2 holder, like the dig gold). The OWNER owns everything: always gold.
// Pool = the live SHOP_ITEMS (so a price change follows automatically), only slots in CHEST_SLOTS, never a goal-locked item
// (Gilded Sabre, Legendary Gold Blade, Bone Musket, Golden Blunderbuss, the goal parrots, COMMODORE...), never a free default,
// never a ship skin. Weapons join the pool by themselves once the WEAPON STORE (timothy/battle-areas: SHOP_ITEMS gear:sword:* /
// gear:musket:* + GEAR_SLOTS sword / musket) is merged; until then they are simply absent. Cheaper items are likelier (1 / sqrt(price)).
import { SHOP_ITEMS, GEAR_SLOTS } from "./lib.ts";

export type ChestTier = "common" | "rare" | "legendary";
// chance = per mille that a chest of this tier holds an item; min / max = the shop-price band an item must sit in
export const CHEST_LOOT: Record<ChestTier, { chance: number; min: number; max: number }> = {
  common:    { chance: 250, min: 150,  max: 1500 },   // boss maps:   600-1,200 gold + 1 in 4: a cheap hat / shirt / patch / cutlass
  rare:      { chance: 350, min: 300,  max: 8000 },   // BR kill maps: 5,000-8,000 gold + ~1 in 3: up to the suit / rapier / blunderbuss
  legendary: { chance: 600, min: 2500, max: 25000 },  // streak (cave): 15,000-25,000 gold + 3 in 5: crowns, bone blade, dragoon...
};
export const CHEST_SLOTS = ["hat", "outfit", "eyes", "hook", "leg", "face", "ears", "teeth", "boots", "cape", "sword", "musket"]; // [v197] + Raul's shop items 2 accessories (beards: male-only, so not in chests) // pets ("parrot") + ship skins: NOT in chests (BANKSY to pick)
export const CHEST_CREW: Record<string, string> = { hat: "crewhat", outfit: "crewoutfit" }; // hats + clothes can be the CREW version
export const CHEST_CREW_CHANCE = 350;  // per mille of hat / clothes drops that are for your crew (when the crew version is sold)
export const CHEST_DUP_SHARE = 0.5;    // a duplicate pays half its shop price in gold

// small deterministic hash -> 0..999 (FNV-1a + a murmur finaliser); same seed = same roll, on any server
export function chestRoll(seed: string): number {
  let h = 0x811c9dc5; const s = seed + ":pfp-chest-v1";
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) % 1000;
}
export type PoolItem = { item: string; slot: string; id: string; price: number; weight: number };
export function chestPool(tier: ChestTier, items = SHOP_ITEMS, slots = GEAR_SLOTS): PoolItem[] {
  const band = CHEST_LOOT[tier]; if (!band) return [];
  const out: PoolItem[] = [];
  for (const [key, it] of Object.entries(items)) {
    const m = /^gear:([a-z]+):([a-z0-9_]+)$/.exec(key); if (!m) continue;
    const [, slot, id] = m;
    if (!CHEST_SLOTS.includes(slot) || it.goal || !(it.price > 0)) continue;
    const ids = slots[slot]; if (!ids || !ids.includes(id) || ids[0] === id) continue; // the slot must be live; the free default never drops
    if (it.price < band.min || it.price > band.max) continue;
    out.push({ item: key, slot, id, price: it.price, weight: Math.round(10000 / Math.sqrt(it.price)) });
  }
  return out.sort((a, b) => a.item < b.item ? -1 : 1); // stable order = stable rolls
}
export type ChestDrop = { item: string; slot: string; id: string; crew: boolean; price: number; dup_gold: number } | null;
// the drop for one map (null = gold only). owner = always null (owns everything).
export function chestDrop(mapId: string, tier: string, owner = false, items = SHOP_ITEMS, slots = GEAR_SLOTS): ChestDrop {
  if (owner || !(tier in CHEST_LOOT)) return null;
  const t = tier as ChestTier;
  if (chestRoll("drop:" + mapId) >= CHEST_LOOT[t].chance) return null;
  const pool = chestPool(t, items, slots); if (!pool.length) return null;
  const total = pool.reduce((a, p) => a + p.weight, 0);
  let r = (chestRoll("pick:" + mapId) * 1000 + chestRoll("pick2:" + mapId)) % total, pick = pool[pool.length - 1];
  for (const p of pool) { if (r < p.weight) { pick = p; break; } r -= p.weight; }
  let { item, slot, price } = pick; const id = pick.id; let crew = false;
  const cs = CHEST_CREW[slot], ck = cs && `gear:${cs}:${id}`;
  if (ck && items[ck] && !items[ck].goal && slots[cs]?.includes(id) && slots[cs][0] !== id && chestRoll("crew:" + mapId) < CHEST_CREW_CHANCE) {
    item = ck; slot = cs; price = items[ck].price; crew = true;
  }
  return { item, slot, id, crew, price, dup_gold: Math.floor(price * CHEST_DUP_SHARE) };
}
