// deno test supabase/functions/pvp/chest_test.ts   (no network, no database)
import { assert, assertEquals } from "jsr:@std/assert@1";
import { chestDrop, chestPool, CHEST_LOOT } from "./chest.ts";
import { SHOP_ITEMS, GEAR_SLOTS } from "./lib.ts";
// the WEAPON STORE half (timothy/battle-areas server_weapon_store.SNIPPET.md), to check weapons join once it is merged
const WEAP = { ...SHOP_ITEMS,
  "gear:sword:cutlass": { price: 1500 }, "gear:sword:rapier": { price: 4000 }, "gear:sword:bone": { price: 12000 },
  "gear:sword:sabre_gilded": { price: 25000, goal: [{ stat: "bossKills" as const, need: 25 }] },
  "gear:sword:blade_gold": { price: 75000, goal: [{ stat: "kills" as const, need: 2000 }] },
  "gear:musket:navy": { price: 2000 }, "gear:musket:blunder": { price: 5000 }, "gear:musket:dragoon": { price: 12000 },
  "gear:musket:bone": { price: 25000, goal: [{ stat: "bossKills" as const, need: 25 }] },
  "gear:musket:blunder_gold": { price: 75000, goal: [{ stat: "kills" as const, need: 2000 }] } };
const WSLOTS = { ...GEAR_SLOTS, sword: ["rusty", "cutlass", "rapier", "bone", "sabre_gilded", "blade_gold"], musket: ["rusty", "navy", "blunder", "dragoon", "bone", "blunder_gold"] };
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

Deno.test("chest: same map id = same drop; owner = gold only", () => {
  for (let i = 0; i < 200; i++) assertEquals(chestDrop(uuid(i), "rare"), chestDrop(uuid(i), "rare"));
  for (let i = 0; i < 500; i++) assertEquals(chestDrop(uuid(i), "legendary", true), null);
  assertEquals(chestDrop(uuid(1), "bogus"), null);
});
Deno.test("chest: never a goal item, a skin, a pet or a free default; weapons only once their slot is live", () => {
  for (const [items, slots] of [[SHOP_ITEMS, GEAR_SLOTS], [WEAP, WSLOTS]] as const) for (const t of ["common", "rare", "legendary"] as const) for (const p of chestPool(t, items, slots)) {
    assert(!(items as any)[p.item].goal, p.item); assert(p.item.startsWith("gear:") && !p.item.startsWith("gear:parrot:"), p.item);
    assert((slots as any)[p.slot][0] !== p.id, p.item); assert(p.price >= CHEST_LOOT[t].min && p.price <= CHEST_LOOT[t].max, p.item);
  }
  // [v197] the WEAPON STORE is live now: weapons are in the real pool too (never the goal-locked ones)
  { const R = chestPool("legendary").map((p) => p.item); assert(R.includes("gear:sword:bone") && !R.includes("gear:sword:sabre_gilded") && !R.includes("gear:musket:blunder_gold"), R.join()); }
  const L = chestPool("legendary", WEAP, WSLOTS).map((p) => p.item);
  assert(L.includes("gear:sword:bone") && L.includes("gear:musket:dragoon") && !L.includes("gear:sword:sabre_gilded") && !L.includes("gear:musket:blunder_gold"));
});
Deno.test("chest: rates by tier, crew versions are real crew items, dup gold = half price", () => {
  for (const t of ["common", "rare", "legendary"] as const) { let n = 0;
    for (let i = 0; i < 20000; i++) { const d = chestDrop(uuid(i) + t, t, false, WEAP, WSLOTS); if (!d) continue; n++;
      assertEquals(d.dup_gold, Math.floor(d.price / 2)); assert(WEAP[d.item as keyof typeof WEAP], d.item);
      if (d.crew) assert(/^gear:crew(hat|outfit):/.test(d.item), d.item); }
    const rate = n / 20000 * 1000; assert(Math.abs(rate - CHEST_LOOT[t].chance) < 25, `${t} ${rate}`); }
});
Deno.test("chest: only ids the live shop sells (incl. shop items 2), no beards / pets / ship items", () => {
  for (const t of ["common", "rare", "legendary"] as const) for (const p of chestPool(t)) {
    assert((SHOP_ITEMS as any)[p.item] && (GEAR_SLOTS as any)[p.slot].includes(p.id), p.item);
    assert(!/^gear:(beard|parrot|flag|figure|crewhat|crewoutfit):/.test(p.item), p.item); }
  const all = ["common", "rare", "legendary"].flatMap((t) => chestPool(t as any).map((p) => p.slot));
  for (const s of ["ears", "teeth", "boots", "cape"]) assert(all.includes(s), s);
});
