// [cache-queue] boardfeed: one packed answer per snapshot, ETag + 304, gzip, short public max-age, one cache-row read per 5 s per isolate.
// Stubbed fetch / Deno.serve: no network, no prod. Run: deno test -A supabase/functions/tests/
import { assertEquals, assert } from "jsr:@std/assert@1";
Deno.env.set("SUPABASE_URL", "https://db.test"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
let handler: (r: Request) => Promise<Response>; (Deno as any).serve = (h: any) => { handler = h; return {} as any; };
(globalThis as any).EdgeRuntime = { waitUntil() {} };
let reads = 0; const now = Date.now(), SUNK = "By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump";
const state = { prices: {}, details: {}, updated: { trending: now }, status: { trending: "Shared GeckoTerminal trending" }, trending: [{ mint: SUNK, symbol: "SUNK" }] };
(globalThis as any).fetch = async (u: string, init: any = {}) => { const url = new URL(String(u)), t = url.pathname.split("/").pop();
  const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
  if (t === "boardfeed_cache") { if (init.method === "PATCH") return j([]); reads++; return j([{ id: "hq", payload: { state, helius: {} }, fetched_at: new Date().toISOString() }]); }
  if (t === "helius_trades") return j([]);
  return j({}, 503); };
await import("../boardfeed/index.ts");
const req = (h: Record<string, string> = {}) => handler(new Request("https://f.test/boardfeed", { headers: { origin: "https://game.pumpfunpirates.com", ...h } }));
Deno.test("boardfeed: cacheable answer with ETag; If-None-Match -> 304 with no body; gzip when asked; one row read per 5 s", async () => {
  const a = await req(); assertEquals(a.status, 200); const et = a.headers.get("etag")!; assert(/^"[0-9a-f]{24}"$/.test(et), et);
  assert(/public, max-age=10/.test(a.headers.get("cache-control") || "")); assertEquals(a.headers.get("access-control-allow-origin"), "https://game.pumpfunpirates.com");
  const body = await a.json(); assertEquals(body.mode, "live"); assertEquals(body.state.trending[0].symbol, "SUNK");
  const b = await req({ "if-none-match": et }); assertEquals(b.status, 304); assertEquals(await b.text(), ""); assertEquals(b.headers.get("etag"), et);
  const c = await req({ "accept-encoding": "gzip, br" }); assertEquals(c.headers.get("content-encoding"), "gzip");
  const plain = JSON.parse(await new Response(c.body!.pipeThrough(new DecompressionStream("gzip"))).text()); assertEquals(plain, body);
  assertEquals(reads, 1, "the cache row was read once for all four requests");
});
Deno.test("boardfeed: non-GET stays 405 (no caching of anything but the GET snapshot)", async () => {
  const r = await handler(new Request("https://f.test/boardfeed", { method: "POST" })); assertEquals(r.status, 405); await r.text();
});
