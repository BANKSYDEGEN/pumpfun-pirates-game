import { snapshotKey, maxAge, trimRows, databaseHeaders, databaseURL } from "../_shared/snapshots.ts";
// PUMPFUN PIRATES · pumpfeed: read-only relay for a FIXED allowlist of public pump.fun feeds (BANKSY "Try it").
// No open proxy: callers pick a feed name, never a URL. No cookies/auth are forwarded either way.
// Private PC snapshots only: no Cloudflare-blocked upstream calls. Short memory/CDN caching preserves original freshness.
const API = "https://frontend-api-v3.pump.fun", LIVE = "https://livestream-api.pump.fun";
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FEEDS: Record<string, (q: URLSearchParams) => string | null> = {
  leaderboard: () => `${API}/pnl-leaderboard?period=daily&limit=10`,
  live: () => `${API}/coins/currently-live?limit=10&offset=0&includeNsfw=false`,
  perps: () => `${API}/coins/perps?sort=volume_24h&limit=10`,
  bounties: () => `${LIVE}/bounties/v2/tasks?phase=OPEN&sort=rewardTotalUsd&order=desc&limit=10`,
  homefeed: () => `${API}/home-feed`,
  holderrewards: () => `${API}/fees/holder-rewards`,
  holderstats: (q) => { const m = q.get("mint") || ""; return BASE58.test(m) ? `${API}/coins/holder-stats/${m}` : null; },
};
const TTL = 25_000, ERR_TTL = 15_000, HEAVY_TTL = 90_000;
const cache = new Map<string, { at: number; ttl: number; status: number; body: string }>();
const inflight = new Map<string, Promise<{ status: number; body: string }>>();
const allowed = (o: string | null) => !!o && (o === "https://game.pumpfunpirates.com" || /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o));
function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { "Vary": "Origin", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400" };
  if (allowed(origin)) h["Access-Control-Allow-Origin"] = origin!;
  return h;
}
async function upstream(_url: string, feed: string, mint?: string): Promise<{ status: number; body: string }> {
  const offline = () => ({status: 503, body: JSON.stringify({ok:false,error:"upstream",reason:"offline"})});
  const key=snapshotKey(feed,mint);if(!key)return offline();
  try {
    const q=new URLSearchParams({feed:`eq.${key}`,select:"payload,fetched_at",limit:"1"});
    const r=await fetch(databaseURL()+"?"+q,{headers:databaseHeaders(),signal:AbortSignal.timeout(8000)});
    if(!r.ok)return offline();
    const list=await r.json(), row=list[0];
    if(!row || row.payload?.testOnly===true)return offline();
    const at=Date.parse(row.fetched_at),age=Date.now()-at;
    if(!Number.isFinite(at) || age>maxAge(feed) || age < -30000)return offline();
    return {status:200,body:JSON.stringify({ok:true,fetchedAt:at,fetched_at:row.fetched_at,rows:trimRows(feed,row.payload.rows)})};
  } catch {return offline();}
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin"), h = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "GET") return new Response("method", { status: 405, headers: h });
  const q = new URL(req.url).searchParams, feed = q.get("feed") || "", mk = Object.hasOwn(FEEDS, feed) ? FEEDS[feed] : null;
  const url = mk ? mk(q) : null;
  if (!url) return new Response(JSON.stringify({ ok: false, error: "unknown feed" }), { status: 400, headers: { ...h, "Content-Type": "application/json" } });
  const now = Date.now(); let hit = cache.get(url);
  if (!hit || now - hit.at > hit.ttl) {
    let p = inflight.get(url); if (!p) { p = upstream(url, feed, q.get("mint") || undefined).finally(() => inflight.delete(url)); inflight.set(url, p); }
    const r = await p; hit = { at: Date.now(), ttl: r.status !== 200 ? ERR_TTL : feed === "holderrewards" ? HEAVY_TTL : TTL, ...r }; if(r.status===200){const data=JSON.parse(r.body);hit.ttl=Math.max(0,Math.min(hit.ttl,data.fetchedAt+maxAge(feed)-hit.at));} cache.set(url, hit);
    if (cache.size > 200) for (const k of cache.keys()) { cache.delete(k); if (cache.size <= 150) break; }
  }
  const age = Math.max(0, Math.floor((Date.now() - hit.at) / 1000));
  return new Response(hit.body, { status: hit.status, headers: { ...h, "Content-Type": "application/json", "Cache-Control": `public, max-age=${Math.max(0, Math.floor(hit.ttl / 1000) - age)}`, "X-Cache-Age": String(age) } });
});
