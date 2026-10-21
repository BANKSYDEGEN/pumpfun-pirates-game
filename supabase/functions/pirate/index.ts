// PUMPFUN PIRATES · Supabase Edge Function `pirate`: read-only wallet sign-in + server-saved progress.
// Deploy: supabase functions deploy pirate --no-verify-jwt
// Secrets: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (automatic). Optional: ALLOWED_ORIGINS (comma-separated).
// (players.is_holder is reserved for a later NFT holder perk; nothing sets it yet.)
// POST JSON { action: "nonce" | "verify" | "load" | "save" | "logout", ... }
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildMessage, verifySignature, isWallet, cleanProgress, cleanSkins, cleanRun, runProblem, skinsProblem, type Progress } from "./lib.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://game.pumpfunpirates.com,https://banksydegen.github.io")
  .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const rand = (n: number) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const b64url = (a: Uint8Array) => btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const cleanName = (v: unknown) => v == null ? undefined : (String(v).replace(/[<>&"`\\]/g, "").trim().slice(0, 20) || null);

type Player = { wallet: string; name: string | null; progress: Progress; runs: number };
const publicPlayer = (p: Player, extra: Record<string, unknown> = {}) => ({
  wallet: p.wallet, name: p.name,
  skins: cleanProgress(p.progress).skins, best: cleanProgress(p.progress).best, runs: p.runs, ...extra,
});

async function sessionPlayer(token: unknown): Promise<Player | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const { data: s } = await db.from("player_sessions").select("wallet, expires_at").eq("token_hash", await sha256(token)).maybeSingle();
  if (!s || Date.parse(s.expires_at) < Date.now()) return null;
  const { data: p } = await db.from("players").select("*").eq("wallet", s.wallet).maybeSingle();
  return (p as Player) ?? null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
  const cors = {
    "Access-Control-Allow-Origin": allowed ?? ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
  };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: "bad json" }); }

  try {
    switch (b.action) {
      case "nonce": {
        const wallet = b.wallet;
        if (!isWallet(wallet)) return json(400, { error: "bad wallet" });
        const domain = new URL(allowed ?? ALLOWED_ORIGINS[0]).host;
        await db.from("wallet_nonces").delete().lt("expires_at", new Date(Date.now() - 3600_000).toISOString()); // tidy
        const { count } = await db.from("wallet_nonces").select("nonce", { count: "exact", head: true }).eq("wallet", wallet).gt("expires_at", new Date().toISOString());
        if ((count ?? 0) >= 10) return json(429, { error: "too many sign-in attempts, try again in a few minutes" });
        const nonce = hex(rand(16)), now = new Date(), exp = new Date(now.getTime() + NONCE_TTL_MS);
        const message = buildMessage(domain, wallet, nonce, now.toISOString(), exp.toISOString());
        const { error } = await db.from("wallet_nonces").insert({ nonce, wallet, message, expires_at: exp.toISOString() });
        if (error) throw error;
        return json(200, { nonce, message, expires_at: exp.toISOString() });
      }
      case "verify": {
        const wallet = b.wallet, nonce = String(b.nonce ?? ""), signature = String(b.signature ?? "");
        if (!isWallet(wallet) || !/^[0-9a-f]{32}$/.test(nonce)) return json(400, { error: "bad request" });
        // single use: flip used=false -> true atomically
        const { data: n } = await db.from("wallet_nonces").update({ used: true }).eq("nonce", nonce).eq("wallet", wallet).eq("used", false).select().maybeSingle();
        if (!n) return json(401, { error: "unknown or used nonce" });
        if (Date.parse(n.expires_at) < Date.now()) return json(401, { error: "nonce expired" });
        if (!verifySignature(n.message, signature, wallet)) return json(401, { error: "bad signature" });

        // upsert the player; merge this device's local progress in (union of skins, best of bests)
        const local = cleanProgress({ skins: b.local_skins, best: b.local_best });
        const { data: ex } = await db.from("players").select("*").eq("wallet", wallet).maybeSingle();
        let p: Player, merged = false;
        if (!ex) {
          const { data, error } = await db.from("players").insert({ wallet, name: cleanName(b.name) ?? null, progress: local }).select().single();
          if (error) throw error; p = data as Player; merged = local.skins.owned.length > 0;
        } else {
          const cur = cleanProgress(ex.progress);
          const owned = [...new Set([...cur.skins.owned, ...local.skins.owned])];
          merged = owned.length > cur.skins.owned.length;
          const progress: Progress = { ...cur, skins: { owned, equipped: cur.skins.equipped }, best: { score: Math.max(cur.best.score, local.best.score), wave: Math.max(cur.best.wave, local.best.wave) } };
          const { data, error } = await db.from("players").update({ progress, name: ex.name ?? cleanName(b.name) ?? null, updated_at: new Date().toISOString() }).eq("wallet", wallet).select().single();
          if (error) throw error; p = data as Player;
        }
        const token = b64url(rand(32)), exp = new Date(Date.now() + SESSION_TTL_MS).toISOString();
        await db.from("player_sessions").delete().eq("wallet", wallet).lt("expires_at", new Date().toISOString());
        const { error } = await db.from("player_sessions").insert({ token_hash: await sha256(token), wallet, expires_at: exp });
        if (error) throw error;
        return json(200, { token, expires_at: exp, player: publicPlayer(p, { merged }) });
      }
      case "load": {
        const p = await sessionPlayer(b.token);
        if (!p) return json(401, { error: "signed out" });
        return json(200, { player: publicPlayer(p) });
      }
      case "save": {
        const p = await sessionPlayer(b.token);
        if (!p) return json(401, { error: "signed out" });
        const cur = cleanProgress(p.progress), run = cleanRun(b.run);
        const want = cleanSkins(b.skins);
        const added = want.owned.filter((s) => !cur.skins.owned.includes(s));
        const prevRun = run && cur.cur_run?.id === run.id ? cur.cur_run : null;
        const runAdded = [...new Set([...(prevRun?.added ?? []), ...added])];
        const why = (run && runProblem(run)) || skinsProblem(added.length ? runAdded : [], run);
        if (why) return json(422, { error: why, player: publicPlayer(p) });
        const owned = [...new Set([...cur.skins.owned, ...want.owned])];
        const progress: Progress = { skins: { owned, equipped: owned.includes(want.equipped) || want.equipped === "classic" ? want.equipped : cur.skins.equipped }, best: { ...cur.best } };
        let runs = p.runs;
        if (run) {
          progress.cur_run = { id: run.id, added: runAdded, final: !!(prevRun?.final || run.over) };
          if (run.over && !prevRun?.final) { runs++; if (run.score > progress.best.score) progress.best = { score: run.score, wave: run.wave }; }
        } else if (cur.cur_run) progress.cur_run = cur.cur_run;
        const name = cleanName(b.name);
        const { data, error } = await db.from("players").update({ progress, runs, ...(name !== undefined ? { name } : {}), updated_at: new Date().toISOString() }).eq("wallet", p.wallet).select().single();
        if (error) throw error;
        return json(200, { player: publicPlayer(data as Player) });
      }
      case "logout": {
        if (typeof b.token === "string") await db.from("player_sessions").delete().eq("token_hash", await sha256(b.token));
        return json(200, { ok: true });
      }
      default: return json(400, { error: "unknown action" });
    }
  } catch (e) {
    console.error(e);
    return json(500, { error: "server error" });
  }
});
