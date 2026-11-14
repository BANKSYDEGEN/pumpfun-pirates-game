// [scale-scorefeed] BANKSY t2506u "Keep scaling everything else" (capacity review Fix 4 remainder).
// One cacheable GET for the shared Storm Hunt boards (all / month / day / daily) and King of the Hill
// tops. Clients were doing PostgREST GETs (typically no-store) plus a POST to pvp `top` (POST is not
// reused by browsers). Real rows only; same shapes as leaderboard_best / pvp_kills_top.
const SHARED_MS = 15_000;
export const CLIENT_MAX_AGE = 30; // a 30 s board poll is often a browser-cache hit (no invocation)
const TZ = "America/Indiana/Indianapolis";
const LB = 100, KOTH = 50, SCORES_CAP = 2000;

const db = () => Deno.env.get("SUPABASE_URL") + "/rest/v1/";
const headers = () => {
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return { "Content-Type": "application/json", apikey: k, Authorization: "Bearer " + k };
};
async function rest(path: string) {
  const r = await fetch(db() + path, { headers: headers(), signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error("scorefeed db " + r.status);
  return r.json();
}
async function rpc(name: string, body: Record<string, unknown>) {
  const r = await fetch(db() + "rpc/" + name, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error("scorefeed rpc " + r.status);
  return r.json();
}
type Wave = { wallet: string; name: string | null; score: number; wave: number; sunk: number };
function waves(rows: Wave[]) {
  return (rows || []).map((x) => ({ wallet: x.wallet, name: x.name, score: x.score, wave: x.wave, sunk: x.sunk }));
}
function bestPerWallet(rows: Array<Wave & { created_at?: string }>, n: number) {
  const seen = new Set<string>(), out: Wave[] = [];
  for (const x of rows || []) {
    if (!x?.wallet || seen.has(x.wallet)) continue;
    seen.add(x.wallet);
    out.push({ wallet: x.wallet, name: x.name, score: x.score, wave: x.wave, sunk: x.sunk });
    if (out.length >= n) break;
  }
  return out;
}

async function load() {
  const now = Date.now();
  const dayIso = new Date(now - 86_400_000).toISOString();
  const monthIso = new Date(now - 30 * 86_400_000).toISOString();
  const seed = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD, same as js/daily.js dailySeed
  const scores = (since: string) =>
    `scores?select=wallet,name,score,wave,sunk,created_at&created_at=gte.${encodeURIComponent(since)}&mode=is.null&order=score.desc,created_at.asc&limit=${SCORES_CAP}`;
  const [all, monthRows, dayRows, daily, kAll, kMonth, kDay] = await Promise.all([
    rest(`leaderboard_best?select=wallet,name,score,wave,sunk&order=score.desc&limit=${LB}`),
    rest(scores(monthIso)),
    rest(scores(dayIso)),
    rest(`leaderboard_daily?select=wallet,name,score,wave,sunk&seed=eq.${encodeURIComponent(seed)}&order=score.desc,created_at.asc&limit=${LB}`),
    rpc("pvp_kills_top", { p_period: "all", p_limit: KOTH }),
    rpc("pvp_kills_top", { p_period: "month", p_limit: KOTH }),
    rpc("pvp_kills_top", { p_period: "day", p_limit: KOTH }),
  ]);
  return {
    ok: true,
    tz: TZ,
    seed,
    waves: { all: waves(all), month: bestPerWallet(monthRows, LB), day: bestPerWallet(dayRows, LB) },
    daily: { seed, rows: waves(daily) },
    koth: { all: kAll ?? [], month: kMonth ?? [], day: kDay ?? [] },
  };
}

let hit: { at: number; payload: Awaited<ReturnType<typeof load>> } | null = null;
let work: Promise<Awaited<ReturnType<typeof load>>> | null = null;
async function shared() {
  if (hit && Date.now() - hit.at < SHARED_MS) return hit.payload;
  if (work) return work;
  work = load().then((payload) => { hit = { at: Date.now(), payload }; return payload; }).finally(() => { work = null; });
  return work;
}

let packedOut: { key: string; body: string; etag: string; gz: ArrayBuffer | null } | null = null;
async function gzip(s: string) {
  try {
    const cs = new CompressionStream("gzip");
    const w = cs.writable.getWriter();
    w.write(new TextEncoder().encode(s));
    w.close();
    return await new Response(cs.readable).arrayBuffer();
  } catch { return null; }
}
async function pack(key: string, make: () => unknown) {
  if (packedOut?.key === key) return packedOut;
  const body = JSON.stringify(make());
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)));
  const etag = '"' + [...d.slice(0, 12)].map((x) => x.toString(16).padStart(2, "0")).join("") + '"';
  const p = { key, body, etag, gz: await gzip(body) };
  packedOut = p;
  return p;
}
function reply(req: Request, p: { body: string; etag: string; gz: ArrayBuffer | null }, h: Record<string, string>) {
  const hh: Record<string, string> = { ...h, "Cache-Control": `public, max-age=${CLIENT_MAX_AGE}`, ETag: p.etag, Vary: "Origin, Accept-Encoding" };
  const inm = req.headers.get("if-none-match");
  if (inm && inm.split(",").map((x) => x.trim().replace(/^W\//, "")).includes(p.etag)) return new Response(null, { status: 304, headers: hh });
  if (p.gz && /\bgzip\b/i.test(req.headers.get("accept-encoding") || "")) return new Response(p.gz, { headers: { ...hh, "Content-Encoding": "gzip" } });
  return new Response(p.body, { headers: hh });
}

Deno.serve(async (req) => {
  const o = req.headers.get("origin"), allowed = o === "https://game.pumpfunpirates.com" || /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o || "");
  const h: Record<string, string> = { "Content-Type": "application/json", Vary: "Origin", "Access-Control-Allow-Methods": "GET, OPTIONS", "Cache-Control": "no-store" };
  if (allowed) h["Access-Control-Allow-Origin"] = o!;
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "GET") return new Response("{}", { status: 405, headers: h });
  const down = { ...h, "Retry-After": "15" };
  try {
    const payload = await shared();
    return reply(req, await pack("live|" + payload.seed + "|" + (hit?.at || 0), () => payload), h);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Boards offline" }), { status: 503, headers: down });
  }
});
