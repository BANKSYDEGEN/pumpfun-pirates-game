// deno test supabase/functions/pvp/wish_test.ts   (no network, no database)
import { assert, assertEquals } from "jsr:@std/assert@1";
import { chestItems, luckyTable, WISH } from "./chest.ts";
import { CHEST_VALUABLES, CHEST_WEAPON, VALUABLES } from "./invCatalog.ts";
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const rar = (k: string) => (VALUABLES as any)[k]?.rarity;
Deno.test("wish: lucky tables sum to 1000 and only tilt toward rare+", () => {
  for (const t of ["common", "rare", "legendary"] as const) {
    const v = luckyTable(CHEST_VALUABLES[t], rar); assertEquals(Object.values(v).reduce((a, b) => a + b, 0), 1000);
    const w = luckyTable(CHEST_WEAPON[t].tiers, (k) => k); assertEquals(Object.values(w).reduce((a, b) => a + b, 0), 1000);
    const R: any = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }, mean = (tb: any) => Object.entries(tb).reduce((a, [k, n]) => a + R[rar(k)] * (n as number), 0);
    assert(mean(v) >= mean(CHEST_VALUABLES[t]), t);
  }
  assertEquals(WISH.price, 100); assertEquals(WISH.minutes, 5);
});
Deno.test("wish: not lucky = exactly the old chest; lucky = never worse on average", () => {
  const val = (it: { item: string }[]) => it.reduce((a, x) => a + ({ common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 } as any)[rar(x.item.slice(4)) ?? "common"], 0);
  let a = 0, b = 0;
  for (let i = 0; i < 3000; i++) { const base = chestItems(uuid(i), "rare", false, true); assertEquals(base, chestItems(uuid(i), "rare", false, true, false));
    a += val(base.filter((x) => x.item.startsWith("val:"))); b += val(chestItems(uuid(i), "rare", false, true, true).filter((x) => x.item.startsWith("val:"))); }
  assert(b > a && b < a * 1.2, `${a} -> ${b}`);
});
