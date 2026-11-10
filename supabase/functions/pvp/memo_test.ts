import { assertEquals } from "jsr:@std/assert@1";
import { ttlMemo, etagOf } from "./memo.ts";
Deno.test("memo: one read per TTL, shared in-flight read, failures not cached", async () => {
  let t = 0, reads = 0, fail = false; const m = ttlMemo<number>(1000, { clock: () => t });
  const load = async () => { reads++; await new Promise((r) => setTimeout(r, 5)); if (fail) throw Error("db down"); return reads; };
  const [a, b] = await Promise.all([m.get("k", load), m.get("k", load)]); assertEquals([a, b, reads], [1, 1, 1]);
  t = 999; assertEquals(await m.get("k", load), 1); assertEquals(reads, 1);
  t = 1000; fail = true; let threw = false; try { await m.get("k", load); } catch { threw = true; } assertEquals(threw, true);
  fail = false; assertEquals(await m.get("k", load), 3); // the failed read left nothing behind
  m.drop("k"); assertEquals(await m.get("k", load), 4);
});
Deno.test("memo: bounded size; etag is stable and content-sensitive", async () => {
  const m = ttlMemo<string>(1000, { max: 2 }); for (const k of ["a", "b", "c"]) await m.get(k, async () => k); assertEquals(m.size(), 2);
  assertEquals(await etagOf("x"), await etagOf("x")); assertEquals((await etagOf("x")) === (await etagOf("y")), false); assertEquals((await etagOf("x")).length, 32);
});
