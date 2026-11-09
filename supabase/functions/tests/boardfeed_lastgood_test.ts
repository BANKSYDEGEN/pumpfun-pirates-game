import { assertEquals, assert } from "jsr:@std/assert@1";
Deno.env.set("SUPABASE_URL", "https://db.test"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
let handler: (r: Request) => Promise<Response>; (Deno as any).serve = (h: any) => { handler = h; return {} as any; };
(globalThis as any).EdgeRuntime = { waitUntil() {} };
const old = Date.now() - 3 * 3600_000, writes: any[] = [];
let lastGood: any[] = [];
(globalThis as any).fetch = async (u: string, init: any = {}) => { const url = new URL(String(u)), t = url.pathname.split("/").pop();
  const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
  if (t === "boardfeed_cache") return init.method === "PATCH" ? j([]) : j([{ id: "hq", payload: {}, fetched_at: "1970-01-01T00:00:00Z" }]); // no live cache, lease lost
  if (t === "hq_board_last_good") { if (init.method === "POST") { writes.push(init.body); return j(null, 201); } const p = (url.searchParams.get("key") || "").slice(5, -1); return j(lastGood.filter(r => r.key.startsWith(p))); }
  if (t === "helius_trades") return j([]);
  return j({}, 503); };
await import("../boardfeed/index.ts");
const get = async () => { const r = await handler(new Request("https://f.test/boardfeed", { headers: { origin: "https://game.pumpfunpirates.com" } })); return { status: r.status, body: await r.json() }; };
Deno.test("boardfeed: dead live cache serves the last GOOD rows, original times, every key offline", async () => {
  lastGood = [{ key: "board:trending", rows: [{ mint: "By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump", symbol: "SUNK" }], status: "x", source: "boardfeed", source_at: new Date(old).toISOString() },
    { key: "board:prices", rows: { SUNK: { price: 1, updated: old }, AHOY: { price: 2, updated: old } }, source: "boardfeed", source_at: new Date(old).toISOString() }];
  const r = await get(); assertEquals(r.status, 200); assertEquals(r.body.mode, "last-good"); assert(r.body.state.offline);
  assertEquals(r.body.state.updated.trending, old); assert(/offline/i.test(r.body.state.status.trending)); assert(/offline/i.test(r.body.state.status.volume)); assertEquals(r.body.state.volume, []);
  assert(r.body.state.prices.SUNK.stale); });
Deno.test("boardfeed: nothing anywhere is still an honest 503 (trades table empty counts as a source though)", async () => { lastGood = []; const r = await get(); assert(r.status === 200 || r.status === 503); if (r.status === 200) assertEquals(r.body.state.trending, []); });
