// [inventory] deno test supabase/functions/pvp/inventory_test.ts : the NPC sell multiplier (clamp + fallback), sellItem, chest items, fish
import { assertEquals, assert } from "jsr:@std/assert@1";
import { sellMultiplier, sellItem, SELL_MULT_MAX } from "./lib.ts";
import { chestItems, dupItem, chestDrop } from "./chest.ts";
import { rollFish, ownerKitItems } from "./inventory.ts";
import { KEY_RE } from "./invCatalog.ts";
Deno.test("sellMultiplier: fallback 1.0 without a sell boost (main today, before Raul's branch)", () => {
  assertEquals(sellMultiplier(undefined), 1); assertEquals(sellMultiplier(null), 1); assertEquals(sellMultiplier({ reload: 0.05 }), 1);
  assertEquals(sellMultiplier({ sell: "x" }), 1); assertEquals(sellMultiplier({ sell: -0.5 }), 1); assertEquals(sellMultiplier({ sell: NaN }), 1);
});
Deno.test("sellMultiplier: 1 + sell, clamped to [1.0, 1.40]", () => {
  assertEquals(sellMultiplier({ sell: 0.15 }), 1.15); assertEquals(sellMultiplier({ sell: 0.4 }), 1.4); assertEquals(sellMultiplier({ sell: 3 }), SELL_MULT_MAX);
});
Deno.test("sellItem: passes the server multiplier, a throwing boosts read = 1.0, never the client's", async () => {
  const calls: any[] = []; const db = { rpc: (fn: string, a: any) => { calls.push([fn, a]); return Promise.resolve({ data: { ok: true, gold: 1 }, error: null }); } };
  await sellItem(db, "dev:a", "val:ruby", 2, "antiques", () => ({ sell: 0.25 }));
  await sellItem(db, "dev:a", "val:ruby", 1, "antiques", () => { throw new Error("no boosts"); });
  await sellItem(db, "dev:a", "fish:koi", 1, "fish", () => ({ sell: 9 }));
  assertEquals(calls.map((c) => [c[0], c[1].p_mult, c[1].p_shop, c[1].p_qty]), [["pvp_inv_sell", 1.25, "antiques", 2], ["pvp_inv_sell", 1, "antiques", 1], ["pvp_inv_sell", 1.4, "fish", 1]]);
});
Deno.test("chest items: valid keys, deterministic, no rare weapons while the flag is off", () => {
  for (let i = 0; i < 3000; i++) { const id = "00000000-0000-4000-8000-" + String(i).padStart(12, "0");
    for (const t of ["common", "rare", "legendary"]) { const a = chestItems(id, t, i % 2 === 0, false); assertEquals(a, chestItems(id, t, i % 2 === 0, false));
      for (const x of a) { assert(KEY_RE.test(x.item), x.item); assert(!/:(rare|epic|legendary)$/.test(x.item) || !x.item.startsWith("wpn:"), x.item); } }
    for (const x of chestItems(id, "common", false, true)) if (x.item.startsWith("wpn:")) assert(x.item.endsWith(":common"), "common chests never drop rare+ weapons"); }
});
Deno.test("dup items + fish + owner kit keys are valid", () => {
  const d = chestDrop("00000000-0000-4000-8000-000000000007", "legendary"); if (d) assert(KEY_RE.test(dupItem(d)!));
  for (let i = 0; i < 500; i++) assert(KEY_RE.test(rollFish("s" + i)));
  const k = ownerKitItems(); assert(k.length === 8 + 10 + 32); for (const x of k) assert(KEY_RE.test(x), x);
});
