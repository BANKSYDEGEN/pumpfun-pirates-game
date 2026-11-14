// [scale-scorefeed] one packed answer, ETag + 304, gzip, public max-age, one DB burst per 15 s per isolate.
// Stubbed fetch / Deno.serve: no network, no prod. Run: deno test -A supabase/functions/tests/scorefeed_test.ts
import { assertEquals, assert } from "jsr:@std/assert@1";
Deno.env.set("SUPABASE_URL", "https://db.test"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
let handler: (r: Request) => Promise<Response>; (Deno as any).serve = (h: any) => { handler = h; return {} as any; };
const wave = [{ wallet: "W1", name: "ANN", score: 9, wave: 2, sunk: 1, created_at: "2026-11-01T00:00:00Z" }];
const koth = [{ player: "w:W1…xxxx", name: "ANN", kills: 3, deaths: 1, wallet: "W1xxxx" }];
let calls = 0;
(globalThis as any).fetch = async (u: string, init: any = {}) => {
  const url = new URL(String(u)); calls++;
  const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
  if (url.pathname.endsWith("/rpc/pvp_kills_top")) return j(koth);
  if (url.pathname.endsWith("/leaderboard_best")) return j(wave);
  if (url.pathname.endsWith("/leaderboard_daily")) return j([]);
  if (url.pathname.endsWith("/scores")) return j(wave);
  return j({}, 503);
};
await import("../scorefeed/index.ts");
const req = (h: Record<string, string> = {}, method = "GET") => handler(new Request("https://f.test/scorefeed", { method, headers: { origin: "https://game.pumpfunpirates.com", ...h } }));
Deno.test("scorefeed: cacheable GET with ETag; If-None-Match -> 304; gzip; one DB burst shared", async () => {
  const a = await req(); assertEquals(a.status, 200); const et = a.headers.get("etag")!; assert(/^"[0-9a-f]{24}"$/.test(et), et);
  assert(/public, max-age=30/.test(a.headers.get("cache-control") || "")); assertEquals(a.headers.get("access-control-allow-origin"), "https://game.pumpfunpirates.com");
  const body = await a.json(); assertEquals(body.ok, true); assertEquals(body.waves.all[0].name, "ANN"); assertEquals(body.koth.all[0].kills, 3);
  assertEquals(typeof body.seed, "string"); assertEquals(body.daily.seed, body.seed); assertEquals(body.tz, "America/Indiana/Indianapolis");
  const first = calls;
  const b = await req({ "if-none-match": et }); assertEquals(b.status, 304); assertEquals(await b.text(), ""); assertEquals(b.headers.get("etag"), et);
  const c = await req({ "accept-encoding": "gzip, br" }); assertEquals(c.headers.get("content-encoding"), "gzip");
  const plain = JSON.parse(await new Response(c.body!.pipeThrough(new DecompressionStream("gzip"))).text()); assertEquals(plain, body);
  assertEquals(calls, first, "later requests reuse the isolate snapshot");
});
Deno.test("scorefeed: non-GET stays 405", async () => {
  const r = await req({}, "POST"); assertEquals(r.status, 405); await r.text();
});
