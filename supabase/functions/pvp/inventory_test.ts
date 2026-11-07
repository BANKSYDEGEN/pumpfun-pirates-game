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
  const k = ownerKitItems(); assert(k.length === 8 + 11 + 36, String(k.length)); // 8 fish + 11 valuables (golden idol) + (4 sword + 5 musket bases [musket-levels bone]) x 4 rarities for (const x of k) assert(KEY_RE.test(x), x);
});
// [fish2] lengths + reel tickets
import { rollCm, signFishTicket, readFishTicket, FISH_TICKET_TTL_MS } from "./inventory.ts";
import { FISH_CM } from "./invCatalog.ts";
Deno.test("fish2: server lengths stay inside each species' range and are deterministic", () => {
  for (let i = 0; i < 400; i++) { const f = rollFish("c" + i), [a, b] = (FISH_CM as any)[f.slice(5)], cm = rollCm("c" + i, f); assert(cm >= a && cm <= b, f + " " + cm); assertEquals(cm, rollCm("c" + i, f)); }
});
Deno.test("fish2: reel tickets verify, bind to the pirate, expire, and refuse tampering", async () => {
  const n = "00000000-0000-4000-8000-000000000001", at = 1_000_000, tok = await signFishTicket("s3cret", { p: "dev:a", f: "fish:koi", cm: 50, n, at });
  assertEquals(await readFishTicket("s3cret", tok, "dev:a", at + 3000), { ok: true, f: "fish:koi", cm: 50, n });
  assertEquals((await readFishTicket("s3cret", tok, "dev:b", at + 3000)).ok, false);                       // someone else's ticket
  assertEquals(await readFishTicket("s3cret", tok, "dev:a", at + 200), { ok: false, why: "too fast" });     // no instant landing
  assertEquals(await readFishTicket("s3cret", tok, "dev:a", at + FISH_TICKET_TTL_MS + 1), { ok: false, why: "it got away" });
  assertEquals((await readFishTicket("other", tok, "dev:a", at + 3000)).ok, false);                        // wrong key
  const [body, sig] = tok.split("."), forged = btoa(JSON.stringify({ p: "dev:a", f: "fish:leviathan", cm: 250, n, at })).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  assertEquals((await readFishTicket("s3cret", forged + "." + sig, "dev:a", at + 3000)).ok, false);        // a swapped fish
  assertEquals((await readFishTicket("s3cret", body, "dev:a", at + 3000)).ok, false);
  assertEquals((await readFishTicket("s3cret", 42, "dev:a", at + 3000)).ok, false);
});
