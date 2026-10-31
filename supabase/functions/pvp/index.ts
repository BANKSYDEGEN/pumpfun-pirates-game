// PUMPFUN PIRATES · Supabase Edge Function `pvp`: wallet-signed PvP saves (gold, upgrades, skins, K/D).
// Deploy: supabase functions deploy pvp --no-verify-jwt   (tables: migrations/005_pvp.sql)
// POST JSON { action: "nonce" | "verify" | "load" | "save" | "logout" | "kill" | "top" | "holder" | "holder_claim", ... }. The wallet only ever SIGNS A MESSAGE.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildMessage, verifySignature, isWallet, cleanProfile, saveProblem, tokenBalance, HOLDER_MINTS, HOLDER_MIN_TOKENS, HOLDER_DAILY_GOLD, HOLDER_CACHE_MS, type Profile } from "./lib.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://game.pumpfunpirates.com,https://banksydegen.github.io,http://localhost:8787,http://127.0.0.1:8787")
  .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
const NONCE_TTL_MS = 5 * 60 * 1000, SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const rand = (k: number) => { const a = new Uint8Array(k); crypto.getRandomValues(a); return a; };
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const b64url = (a: Uint8Array) => btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

type Row = { id: string; wallet: string; gold: number; upgrades: Record<string, number>; skins: Profile["skins"]; kills: number; deaths: number; bot_kills: number; updated_at: string };
const toProfile = (r: Row): Profile => cleanProfile({ gold: r.gold, levels: r.upgrades, skins: r.skins, stats: { kills: r.kills, deaths: r.deaths, botKills: r.bot_kills } });
const toRow = (p: Profile) => ({ gold: p.gold, upgrades: p.levels, skins: p.skins, kills: p.stats.kills, deaths: p.stats.deaths, bot_kills: p.stats.botKills });

async function getRow(wallet: string): Promise<Row> {
  const id = `wallet:${wallet}`;
  const { data } = await db.from("pvp_profiles").select("*").eq("id", id).maybeSingle();
  if (data) return data as Row;
  const { data: ins, error } = await db.from("pvp_profiles").insert({ id, wallet }).select().single();
  if (error) throw error; return ins as Row;
}
async function sessionWallet(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const { data: s } = await db.from("pvp_sessions").select("wallet, expires_at").eq("token_hash", await sha256(token)).maybeSingle();
  return s && Date.parse(s.expires_at) > Date.now() ? s.wallet : null;
}

// HOLDER PERK: balance checked here (never trusted from the client), cached in pvp_holders ~10 min. Any RPC error = not a
// holder for now (fail closed, quietly) and is re-checked after a minute.
const SOLANA_RPC = Deno.env.get("SOLANA_RPC") ?? "https://api.mainnet-beta.solana.com";
const indyDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Indiana/Indianapolis" }).format(new Date());
async function holderStatus(wallet: string) {
  const { data: c } = await db.from("pvp_holders").select("*").eq("wallet", wallet).maybeSingle();
  if (c && Date.now() - Date.parse(c.checked_at) < (c.holder ? HOLDER_CACHE_MS : Math.min(HOLDER_CACHE_MS, c.sunk < 0 ? 60_000 : HOLDER_CACHE_MS))) return c;
  let sunk = -1, ahoy = -1;
  try { [sunk, ahoy] = await Promise.all([tokenBalance(SOLANA_RPC, wallet, HOLDER_MINTS.sunk), tokenBalance(SOLANA_RPC, wallet, HOLDER_MINTS.ahoy)]); }
  catch (e) { console.warn("holder rpc", String(e)); }
  const row = { wallet, holder: sunk >= HOLDER_MIN_TOKENS || ahoy >= HOLDER_MIN_TOKENS, sunk, ahoy, checked_at: new Date().toISOString() };
  await db.from("pvp_holders").upsert(row);
  return row;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
  const cors = { "Access-Control-Allow-Origin": allowed ?? ALLOWED_ORIGINS[0], "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: "bad json" }); }
  try {
    switch (b.action) {
      case "nonce": {
        const wallet = b.wallet; if (!isWallet(wallet)) return json(400, { error: "bad wallet" });
        await db.from("pvp_nonces").delete().lt("expires_at", new Date(Date.now() - 3600_000).toISOString());
        const { count } = await db.from("pvp_nonces").select("nonce", { count: "exact", head: true }).eq("wallet", wallet).gt("expires_at", new Date().toISOString());
        if ((count ?? 0) >= 10) return json(429, { error: "too many sign-in attempts, try again in a few minutes" });
        const nonce = hex(rand(16)), now = new Date(), exp = new Date(now.getTime() + NONCE_TTL_MS);
        const message = buildMessage(wallet, nonce, now.toISOString());
        const { error } = await db.from("pvp_nonces").insert({ nonce, wallet, message, expires_at: exp.toISOString() });
        if (error) throw error;
        return json(200, { nonce, message, expires_at: exp.toISOString() });
      }
      case "verify": {
        const wallet = b.wallet, nonce = String(b.nonce ?? ""), signature = String(b.signature ?? "");
        if (!isWallet(wallet) || !/^[0-9a-f]{32}$/.test(nonce)) return json(400, { error: "bad request" });
        const { data: nn } = await db.from("pvp_nonces").update({ used: true }).eq("nonce", nonce).eq("wallet", wallet).eq("used", false).select().maybeSingle();
        if (!nn) return json(401, { error: "unknown or used nonce" });
        if (Date.parse(nn.expires_at) < Date.now()) return json(401, { error: "nonce expired" });
        if (!verifySignature(nn.message, signature, wallet)) return json(401, { error: "bad signature" });
        const row = await getRow(wallet);
        const token = b64url(rand(32)), exp = new Date(Date.now() + SESSION_TTL_MS).toISOString();
        await db.from("pvp_sessions").delete().eq("wallet", wallet).lt("expires_at", new Date().toISOString());
        const { error } = await db.from("pvp_sessions").insert({ token_hash: await sha256(token), wallet, expires_at: exp });
        if (error) throw error;
        return json(200, { token, expires_at: exp, profile: toProfile(row) });
      }
      case "load": {
        const wallet = await sessionWallet(b.token); if (!wallet) return json(401, { error: "signed out" });
        return json(200, { profile: toProfile(await getRow(wallet)) });
      }
      case "save": {
        const wallet = await sessionWallet(b.token); if (!wallet) return json(401, { error: "signed out" });
        const row = await getRow(wallet), cur = toProfile(row), next = cleanProfile(b.profile);
        // seed: a brand-new (blank) wallet save may be filled once from the device save when the wallet is first linked
        const blank = !cur.gold && !cur.stats.kills && !cur.stats.deaths && !cur.stats.botKills && !Object.values(cur.levels).some(Boolean);
        const why = b.seed === true && blank ? null : saveProblem(cur, next, (Date.now() - Date.parse(row.updated_at)) / 60000);
        if (why) return json(422, { error: why, profile: cur });
        const { data, error } = await db.from("pvp_profiles").update({ ...toRow(next), updated_at: new Date().toISOString() }).eq("id", row.id).select().single();
        if (error) throw error;
        return json(200, { profile: toProfile(data as Row) });
      }
      case "logout": {
        if (typeof b.token === "string") await db.from("pvp_sessions").delete().eq("token_hash", await sha256(b.token));
        return json(200, { ok: true });
      }
      // PvP KILLS leaderboard: each side of a kill reports it; pvp_claim_kill records it when both match (migration 006)
      case "kill": {
        const wallet = typeof b.token === "string" ? await sessionWallet(b.token) : null;
        const dk = typeof b.dk === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(b.dk) ? b.dk : null;
        const player = wallet ? `wallet:${wallet}` : dk ? `dev:${(await sha256("pfp-dev:" + dk)).slice(0, 24)}` : null;
        if (!player) return json(401, { error: "no identity" });
        const net = /^[0-9a-z]{6,20}$/, room = String(b.room ?? ""), k = String(b.k ?? ""), v = String(b.v ?? ""), life = Number(b.l);
        if (!/^[0-9a-z_:-]{1,40}$/i.test(room) || !net.test(k) || !net.test(v) || !Number.isInteger(life) || life < 0 || life > 1e6 || (b.side !== "k" && b.side !== "v")) return json(400, { error: "bad claim" });
        const name = String(b.name ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 20) || "PIRATE";
        const { data, error } = await db.rpc("pvp_claim_kill", { p_player: player, p_name: name, p_room: room, p_killer_net: k, p_victim_net: v, p_life: life, p_side: b.side });
        if (error) throw error;
        if (Math.random() < 0.02) await db.rpc("pvp_kills_gc");
        return json(200, { result: data });
      }
      case "top": {
        const period = b.period === "day" || b.period === "month" ? b.period : "all";
        const { data, error } = await db.rpc("pvp_kills_top", { p_period: period, p_limit: 50 });
        if (error) throw error;
        return json(200, { period, tz: "America/Indiana/Indianapolis", rows: data ?? [] });
      }
      case "holder": {
        const wallet = await sessionWallet(b.token); if (!wallet) return json(401, { error: "signed out" });
        const h = await holderStatus(wallet), day = indyDay();
        const { data: cl } = await db.from("pvp_holder_claims").select("day").eq("wallet", wallet).eq("day", day).maybeSingle();
        return json(200, { holder: !!h.holder, day, claimed: !!cl, daily: HOLDER_DAILY_GOLD, tz: "America/Indiana/Indianapolis" });
      }
      case "holder_claim": {
        const wallet = await sessionWallet(b.token); if (!wallet) return json(401, { error: "signed out" });
        const h = await holderStatus(wallet); if (!h.holder) return json(403, { error: "not a holder" });
        await getRow(wallet);
        const { data, error } = await db.rpc("pvp_holder_claim", { p_wallet: wallet, p_gold: HOLDER_DAILY_GOLD });
        if (error) throw error;
        if (!data?.ok) return json(409, { error: data?.why || "already claimed today", day: data?.day });
        return json(200, { ok: true, gold: HOLDER_DAILY_GOLD, day: data.day, profile: toProfile(await getRow(wallet)) });
      }
      default: return json(400, { error: "unknown action" });
    }
  } catch (e) { console.error(e); return json(500, { error: "server error" }); }
});
