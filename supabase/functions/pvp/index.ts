// PUMPFUN PIRATES · Supabase Edge Function `pvp`: wallet-signed PvP saves (gold, upgrades, skins, K/D).
// Deploy: supabase functions deploy pvp --no-verify-jwt   (tables: migrations/005_pvp.sql)
// POST JSON { action: "nonce" | "verify" | "load" | "save" | "logout" | "kill" | "top" | "me" | "holder" | "holder_claim" | "airdrop" | "rename" | "group_sync" | "dev_sync" | "shop_state" | "shop_buy" | "waves_start" | "waves_claim" | "acct_set" | "acct_login" | "acct_sync" | "acct_change" | "acct_logout" | "airdrop_nonce" | "waves_score" | "ticket", ... }. The wallet only ever SIGNS A MESSAGE.
import { createClient } from "npm:@supabase/supabase-js@2.118.0"; // [security L] exact version (was @2 = whatever is newest at deploy time)
import { acctAction, isAcctDevice, acctBump, nameHasAccount } from "./accounts.ts"; // [v106] player accounts (name + password)
import { verifySignature, isWallet, cleanProfile, saveProblem, keepCounters, CAPS, BATTERY_GOLD, batteryCap, batteryDelta, tokenBalance, HOLDER_MINTS, HOLDER_MIN_TOKENS, HOLDER_DAILY_GOLD, HOLDER_CACHE_MS, type Profile,
  OWNER_MAIN, V6_LEGACY, v6LegacyDue, SHOP_ITEMS, SHOP_SKINS, GEAR_SLOTS, SEED_GOLD_CAP, goalMet, fitEquipped, cleanGear, value, pvpTierCost, TIER_COSTS, SKIN_KILLS, PRESTIGE_MAX, stalePrestige, prestigeSkins, WAVES_GOLD, wavesGold, wavesProblem, MAP_SPOTS, MAP_SPOTS_ALL, boostsFor, sellGold } from "./lib.ts";
import { goalsView, killsByMode } from "./goals.ts";
import { chestDrop, chestItems, dupItem, WISH, type ChestDrop } from "./chest.ts"; // [v152] treasure chest items (server-picked) // [inventory] + items-only chests
import { inventoryAction, INV_ACTIONS, gunDropRpc } from "./inventory.ts"; // [inventory] migration 036: inventory, NPC shops, gifts, Marketplace
import { houseAction, HOUSE_ACTIONS } from "./houses.ts"; // [storage-houses] migration 043: buyable cottages + chest storage
import { adminAction, ADMIN_ACTIONS } from "./admin.ts"; // [admin-menu] migration 045: the owner Admin Menu (owner-only actions return 403)
import { trustedIp, siwsMessage, siwsFacts, allowedOrigin, SIWS_STATEMENTS, parseTopic, mintJwt, relayTicket, seatNetOk, NET_RE } from "./security.ts"; // [security] SECURITY_FIXES.md // [Timothy] shop goal progress (read-only)

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://game.pumpfunpirates.com,https://banksydegen.github.io,http://localhost:8787,http://127.0.0.1:8787")
  .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
const NONCE_TTL_MS = 5 * 60 * 1000, SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
// [security M1] Realtime tickets: HS256 JWT signed with the project's JWT secret (unset = no private channels yet: the client keeps
// using public ones). RELAY_TICKET_SECRET: the same idea for server/relay.js once it is hosted.
const RT_JWT_SECRET = Deno.env.get("PFP_RT_JWT_SECRET") ?? "", RELAY_SECRET = Deno.env.get("RELAY_TICKET_SECRET") ?? "", TICKET_TTL_S = 30 * 60;
const TRUSTED_IP_HEADER = Deno.env.get("TRUSTED_IP_HEADER") || null;
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const rand = (k: number) => { const a = new Uint8Array(k); crypto.getRandomValues(a); return a; };
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const b64url = (a: Uint8Array) => btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const devId = async (b: Record<string, unknown>) => typeof b.dk === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(b.dk) ? `dev:${(await sha256("pfp-dev:" + b.dk)).slice(0, 24)}` : null;
type Row = { id: string; wallet: string; gold: number; upgrades: Record<string, number>; skins: Profile["skins"]; kills: number; deaths: number; bot_kills: number; harbor_kills?: number; boss_kills?: number; battery_hits?: number; updated_at: string; shop_rev?: number; gear?: Record<string, string> };
const toProfile = (r: Row): Profile => cleanProfile({ gold: r.gold, levels: r.upgrades, skins: r.skins, gear: r.gear, stats: { kills: r.kills, deaths: r.deaths, botKills: r.bot_kills, harborKills: r.harbor_kills ?? 0, bossKills: r.boss_kills ?? 0, batteryHits: r.battery_hits ?? 0 } });
async function withOwned(p: Profile, pid: string) { const own = await ownedSet(pid); p.skins.owned = [...own].filter((i) => i.startsWith("skin:")).map((i) => i.slice(5)); (p as any).gearOwned = [...own].filter((i) => i.startsWith("gear:")).map((i) => i.slice(5)); return p; }
const toRow = (p: Profile) => ({ gold: p.gold, upgrades: p.levels, skins: { owned: [], equipped: p.skins.equipped }, gear: cleanGear(p.gear), kills: p.stats.kills, deaths: p.stats.deaths, bot_kills: p.stats.botKills, harbor_kills: p.stats.harborKills, boss_kills: p.stats.bossKills, battery_hits: p.stats.batteryHits ?? 0 }); // [v98]; [cliff gold] migration 032 migration 020 columns

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

// ---------------- [v102] THE ISLAND SHOP ----------------
// Who is asking: the signed wallet session, else this device's key. `pid` = the resolved id (pvp_main: the owner's alias device acts as
// its main). Ownership lives ONLY in pvp_owned; gold for device players lives in pvp_dev_profiles (server copy, dev_sync).
async function whoAmI(b: Record<string, unknown>) {
  const sw = typeof b.token === "string" ? await sessionWallet(b.token) : null;
  const raw = sw ? `wallet:${sw}` : await devId(b); if (!raw) return null;
  const { data } = await db.rpc("pvp_main", { p_id: raw }); const pid = typeof data === "string" ? data : raw;
  return { raw, pid, wallet: sw, owner: pid === OWNER_MAIN };
}
async function ownedSet(pid: string) { const { data } = await db.from("pvp_owned").select("item").eq("player_id", pid); const own = new Set((data ?? []).map((r: any) => r.item as string));
  for (const it of prestigeSkins(await prestigeOf(pid))) own.add(it); // [prestige] BANKSY: P1 GOLDEN / P2 DIAMOND are GIVEN (also counts for anyone already at that level)
  return own; }
// [prestige] write the given skins into pvp_owned (source 'grant', price 0). ADD only: an existing row is left as it is, nothing is removed.
async function grantPrestigeSkins(pid: string, lv: number) { const rows = prestigeSkins(lv).map((item) => ({ player_id: pid, item, source: "grant", price: 0 }));
  if (rows.length) { const { error } = await db.from("pvp_owned").upsert(rows, { onConflict: "player_id,item", ignoreDuplicates: true }); if (error) console.error("prestige grant", error.message); } }
// [V6 store] the legacy pants + boots (lib.ts V6_LEGACY) for a row that predates V6; idempotent (ignoreDuplicates)
const V6_SINCE = Deno.env.get("V6_SINCE") || "2026-11-06T05:00:00Z";
async function grantV6Legacy(pid: string, updatedAt: string | null | undefined) { if (!v6LegacyDue(updatedAt, V6_SINCE)) return;
  const { error } = await db.from("pvp_owned").upsert(V6_LEGACY.map((item) => ({ player_id: pid, item, source: "v6legacy", price: 0 })), { onConflict: "player_id,item", ignoreDuplicates: true });
  if (error) console.error("v6 legacy grant", error.message); }
const ownedLists = (own: Set<string>, owner: boolean) => owner
  ? { skins: ["classic", ...SHOP_SKINS], gear: Object.entries(GEAR_SLOTS).flatMap(([s, ids]) => ids.map((i) => `${s}:${i}`)) }
  : { skins: ["classic", ...[...own].filter((i) => i.startsWith("skin:")).map((i) => i.slice(5))], gear: [...own].filter((i) => i.startsWith("gear:")).map((i) => i.slice(5)) };
// [Emerly] ITEM SKILL BOOSTS: what a pirate's worn + owned gear gives (lib.ts boostsFor). Read-only; fails soft to no boost.
const ownedOfProfile = (p: Profile) => new Set<string>(((p as any).gearOwned ?? []).map((i: string) => `gear:${i}`));
async function boostsOf(who: { pid: string; owner: boolean; wallet: string | null }, b: Record<string, unknown>) {
  try {
    if (who.owner) return boostsFor(cleanProfile(b.profile).gear, new Set(), true);
    let gear: unknown = null;
    if (who.wallet) gear = toProfile(await getRow(who.wallet)).gear;
    else { const { data: r } = await db.from("pvp_dev_profiles").select("gear").eq("id", who.pid).maybeSingle(); gear = r?.gear ?? null; }
    return gear ? boostsFor(gear, await ownedSet(who.pid), false) : boostsFor(null, new Set(), false);
  } catch { return boostsFor(null, new Set(), false); }
}
// [prestige] this pirate's prestige level (migration 031; 0 while it isn't applied or on any read error: nothing locks up)
// [wish] is a fountain wish still running for this player? (flag on + 039 run; anything missing = no luck, nothing else changes)
async function wishLucky(pid: string) { try { const { data, error } = await db.rpc("pvp_wish_lucky", { p_player: pid }); return !error && data === true; } catch { return false; } }
async function prestigeOf(pid: string) { try { const { data, error } = await db.from("pvp_prestige").select("level").eq("player_id", pid).maybeSingle(); return error ? 0 : Math.max(0, Number(data?.level) || 0); } catch { return 0; } }
const zeroLevels = () => Object.fromEntries(Object.keys(PRESTIGE_MAX).map((k) => [k, 0]));
async function boardKD(pid: string) { const { data } = await db.rpc("pvp_kills_me", { p_player: pid }); const r = Array.isArray(data) ? data[0] : data; return { kills: Number(r?.kills ?? 0), deaths: Number(r?.deaths ?? 0) }; }
async function spendSince(pid: string, rev: number) { const { data } = await db.from("pvp_purchases").select("price").eq("player_id", pid).gt("rev", rev); return (data ?? []).reduce((a: number, r: any) => a + (r.price | 0), 0); }
// device row <-> Profile
type DevRow = { id: string; gold: number; gold_pending: number; upgrades: Record<string, number>; skin: string; gear: Record<string, string>; kills: number; deaths: number; bot_kills: number; harbor_kills: number; boss_kills: number; battery_hits?: number; shop_rev: number; updated_at: string };
const devProfile = (r: DevRow): Profile => cleanProfile({ gold: r.gold, levels: r.upgrades, skins: { equipped: r.skin }, gear: r.gear, stats: { kills: r.kills, deaths: r.deaths, botKills: r.bot_kills, harborKills: r.harbor_kills, bossKills: r.boss_kills, batteryHits: r.battery_hits ?? 0 } });
const devCols = (p: Profile) => ({ gold: p.gold, upgrades: p.levels, skin: p.skins.equipped, gear: cleanGear(p.gear), kills: p.stats.kills, deaths: p.stats.deaths, bot_kills: p.stats.botKills, harbor_kills: p.stats.harborKills, boss_kills: p.stats.bossKills, battery_hits: p.stats.batteryHits ?? 0 });
const upgValue = (lv: Record<string, number>) => { let v = 0; for (const [id, c] of Object.entries(TIER_COSTS)) for (let i = 0; i < Math.min(lv[id] || 0, c.length); i++) v += pvpTierCost(i); return v; };
// one sync step: the server copy follows the device save, but never faster than the game can pay / kill (same CAPS as wallet saves).
// Instead of rejecting a big jump (which could stall forever), it CLAMPS: the copy catches up over the next syncs.
function stepToward(cur: Profile, rep: Profile, mins: number, goldFind = 0): Profile { // [Emerly boosts] goldFind widens the gold pace (as saveProblem)
  const m = Math.max(0.25, Math.min(mins, 60)), up = (a: number, b: number, cap: number) => Math.max(a, Math.min(b, a + cap));
  const kc = CAPS.killsBase + CAPS.killsPerMin * m;
  const next = cleanProfile({ ...rep, stats: { kills: up(cur.stats.kills, rep.stats.kills, kc), deaths: Math.max(cur.stats.deaths, rep.stats.deaths), botKills: up(cur.stats.botKills, rep.stats.botKills, kc),
    harborKills: up(cur.stats.harborKills, rep.stats.harborKills, kc), bossKills: up(cur.stats.bossKills, rep.stats.bossKills, CAPS.bossBase + CAPS.bossPerMin * m), batteryHits: up(cur.stats.batteryHits ?? 0, rep.stats.batteryHits ?? 0, batteryCap(m)) } });
  const allow = CAPS.valuePerMin * (1 + Math.max(0, Math.min(0.10, goldFind))) * m + BATTERY_GOLD * batteryDelta(cur, next), over = value(next) - value(cur) - allow;
  if (over > 0) { if (over <= next.gold) next.gold -= over; else { next.levels = { ...cur.levels }; next.gold = Math.max(0, Math.min(next.gold, cur.gold + allow - Math.max(0, upgValue(next.levels) - upgValue(cur.levels)))); } }
  return next;
}
async function shopView(who: { pid: string; owner: boolean }, gold: number, stats: Profile["stats"], rev: number, extra: Record<string, unknown> = {}, gear?: unknown) {
  const own = who.owner ? new Set<string>() : await ownedSet(who.pid), bd = await boardKD(who.pid), prestige = await prestigeOf(who.pid);
  const st = { ...stats, kills: bd.kills, deaths: Math.max(stats.deaths, bd.deaths), prestige }; // [prestige] GOLDEN / DIAMOND goals; [security H3] kill goals = the both-sides-confirmed board only (a save's own count is client-reported)
  // [Timothy] goals = progress on the SAME stats shop_buy checks; modes = Solo / Squads split of the board (null until 025 runs)
  return { ok: true, owner: who.owner, gold, rev, stats: st, owned: ownedLists(own, who.owner), goals: goalsView(st), modes: await killsByMode(db, who.pid), boosts: boostsFor(gear ?? (extra as any).equipped?.gear ?? null, own, who.owner), prestige, ...extra }; // [Emerly] + boosts; [prestige] + level
}
async function devSync(who: { pid: string; owner: boolean }, b: Record<string, unknown>) {
  const rep0 = cleanProfile(b.profile), crev = Math.max(0, Math.floor(Number(b.rev) || 0));
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: row } = await db.from("pvp_dev_profiles").select("*").eq("id", who.pid).maybeSingle() as { data: DevRow | null };
    if (!row) { // first sync: the seed. Gold up to SEED_GOLD_CAP now (the rest catches up at the normal pace); kills from the board
      const bd = await boardKD(who.pid), { data: known } = await db.from("pvp_shop_legacy_ids").select("id").eq("id", who.pid).maybeSingle();
      const p = cleanProfile(rep0); p.gold = Math.min(p.gold, SEED_GOLD_CAP);
      p.stats.kills = Math.max(bd.kills, Math.min(p.stats.kills, Math.floor(bd.kills * 1.5) + 25)); p.stats.deaths = Math.max(p.stats.deaths, bd.deaths);
      if (!known) p.stats.bossKills = Math.min(p.stats.bossKills, 10);
      fitEquipped(p, new Set(), false);
      const { error } = await db.from("pvp_dev_profiles").insert({ id: who.pid, ...devCols(p) });
      if (error) { if ((error as any).code === "23505") continue; throw error; }
      if (known) { // LEGACY: skins this pirate could already use before the shop (kill tiers + the v98 COMMODORE unlock)
        const rows = Object.entries(SKIN_KILLS).filter(([id, need]) => id !== "classic" && p.stats.kills >= need).map(([id]) => ({ player_id: who.pid, item: `skin:${id}`, source: "legacy" }));
        if (rep0.stats.bossKills >= 100) rows.push({ player_id: who.pid, item: "skin:commodore", source: "legacy_commodore" });
        if (rows.length) await db.from("pvp_owned").upsert(rows, { onConflict: "player_id,item", ignoreDuplicates: true });
      }
      return shopView(who, p.gold, p.stats, 0, { seeded: true, equipped: { skin: p.skins.equipped, gear: p.gear } });
    }
    await grantV6Legacy(who.pid, row.updated_at); // [V6 store] before the owned check below
    const cur = devProfile(row), rep = cleanProfile(rep0);
    if (stalePrestige(rep0.prestige, await prestigeOf(who.pid))) rep.levels = { ...cur.levels }; // [prestige] an old snapshot can't undo the reset
    if (crev < row.shop_rev) rep.gold = Math.max(0, rep.gold - await spendSince(who.pid, crev)); // an older save can't refund a purchase
    const ownS = await ownedSet(who.pid), gfind = boostsFor(rep.gear, ownS, false).goldFind; // [Emerly boosts] PET gold find widens the pace
    const next = stepToward(cur, rep, (Date.now() - Date.parse(row.updated_at)) / 60000, gfind);
    fitEquipped(next, ownS, false);
    const { data: upd, error } = await db.from("pvp_dev_profiles").update({ ...devCols(next), updated_at: new Date().toISOString() }).eq("id", who.pid).eq("shop_rev", row.shop_rev).select("id");
    if (error) throw error;
    if (upd && upd.length) return shopView(who, next.gold, next.stats, row.shop_rev, { behind: Math.max(0, rep.gold - next.gold), equipped: { skin: next.skins.equipped, gear: next.gear } });
  } // a purchase landed meanwhile (shop_rev moved): retried; give up quietly after a few
  return { ok: false, why: "busy" };
}

// [security H4] a stored nonce may only be used for what it was issued for, from the domain it names, before it expires
function siwsProblem(nn: { message: string; purpose?: string | null }, purpose: string, origin: string | null): string | null {
  if ((nn.purpose ?? "signin") !== purpose) return "wrong confirmation, try again";
  const f = siwsFacts(nn.message); if (!f) return "old sign-in message, try again";
  if (!origin || new URL(origin).origin !== f.uri) return "this sign-in was made for another site";
  if (!(f.expires > Date.now())) return "sign-in expired, try again";
  return null;
}
// the airdrop row's owner: the signed wallet session, else this device (a logged-in device: the account's row)
async function airdropPlayer(b: Record<string, unknown>) {
  const sw = typeof b.token === "string" ? await sessionWallet(b.token) : null;
  if (sw) return `wallet:${sw}`;
  const dk = typeof b.dk === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(b.dk) ? b.dk : null;
  const dp = dk ? `dev:${(await sha256("pfp-dev:" + dk)).slice(0, 24)}` : null;
  return dp && await isAcctDevice(db, dp) ? (await whoAmI({ dk }))?.pid ?? dp : dp; // [v106]
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const allowed = allowedOrigin(origin, ALLOWED_ORIGINS);
  const cors = { "Access-Control-Allow-Origin": allowed ?? ALLOWED_ORIGINS[0], "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: "bad json" }); }
  // [security M3] the caller's IP from a header the platform sets (the first x-forwarded-for entry is client-typed)
  const ipHash = (await sha256("pfp-ip:" + trustedIp(req.headers, TRUSTED_IP_HEADER))).slice(0, 32);
  try {
    // [v106] PLAYER ACCOUNTS: acct_set / acct_login / acct_sync / acct_change / acct_logout (accounts.ts)
    if (typeof b.action === "string" && b.action.startsWith("acct_")) {
      const r = await acctAction({ db, ip: ipHash, devId, sha256, newToken: () => b64url(rand(32)), whoAmI, sessionWallet, devSync, devProfile, devCols, shopView, ownedSet, upgValue, prestigeOf }, b.action, b);
      if (r) return json(r.status, r.body);
    }
    switch (b.action) {
      // [security H4] nonce: a Sign-In-With-Solana message bound to the page's own domain (only allowed origins get one: a phishing
      // copy that relays it makes the wallet show a domain mismatch). purpose "airdrop": the NEW airdrop wallet proves it is yours.
      case "nonce": case "airdrop_nonce": {
        const wallet = b.wallet; if (!isWallet(wallet)) return json(400, { error: "bad wallet" });
        if (!allowed) return json(403, { error: "Open the game at https://game.pumpfunpirates.com to sign in." });
        const purpose = b.action === "airdrop_nonce" ? "airdrop" : "signin";
        let forPlayer: string | null = null;
        if (purpose === "airdrop") { forPlayer = await airdropPlayer(b); if (!forPlayer) return json(401, { error: "no identity" }); }
        await db.from("pvp_nonces").delete().lt("expires_at", new Date(Date.now() - 3600_000).toISOString());
        const { count } = await db.from("pvp_nonces").select("nonce", { count: "exact", head: true }).eq("wallet", wallet).gt("expires_at", new Date().toISOString());
        if ((count ?? 0) >= 10) return json(429, { error: "too many sign-in attempts, try again in a few minutes" });
        const nonce = hex(rand(16)), now = new Date(), exp = new Date(now.getTime() + NONCE_TTL_MS);
        const message = siwsMessage({ origin: allowed, wallet, nonce, issuedAt: now.toISOString(), expiresAt: exp.toISOString(), statement: SIWS_STATEMENTS[purpose === "airdrop" ? "airdrop" : "pvp"] });
        const { error } = await db.from("pvp_nonces").insert({ nonce, wallet, message, expires_at: exp.toISOString(), purpose, player_id: forPlayer });
        if (error) throw error;
        return json(200, { nonce, message, expires_at: exp.toISOString() });
      }
      case "verify": {
        const wallet = b.wallet, nonce = String(b.nonce ?? ""), signature = String(b.signature ?? "");
        if (!isWallet(wallet) || !/^[0-9a-f]{32}$/.test(nonce)) return json(400, { error: "bad request" });
        const { data: nn } = await db.from("pvp_nonces").update({ used: true }).eq("nonce", nonce).eq("wallet", wallet).eq("used", false).select().maybeSingle();
        if (!nn) return json(401, { error: "unknown or used nonce" });
        if (Date.parse(nn.expires_at) < Date.now()) return json(401, { error: "nonce expired" });
        const why = siwsProblem(nn, "signin", allowed); if (why) return json(401, { error: why }); // [security H4]
        if (!verifySignature(nn.message, signature, wallet)) return json(401, { error: "bad signature" });
        const row = await getRow(wallet);
        // [v72] this device's BATTLE ROYALE kills / deaths follow the wallet (first wallet only; rows kept)
        const dev = await devId(b); let link: unknown = null;
        if (dev) { const { data: l, error: le } = await db.rpc("pvp_link_device", { p_dev: dev, p_wallet: `wallet:${wallet}` }); if (le) console.warn("link", le.message); else link = l; }
        const token = b64url(rand(32)), exp = new Date(Date.now() + SESSION_TTL_MS).toISOString();
        await db.from("pvp_sessions").delete().eq("wallet", wallet).lt("expires_at", new Date().toISOString());
        const { error } = await db.from("pvp_sessions").insert({ token_hash: await sha256(token), wallet, expires_at: exp });
        if (error) throw error;
        return json(200, { token, expires_at: exp, profile: await withOwned(toProfile(row), `wallet:${wallet}`), rev: row.shop_rev ?? 0, link, prestige: await prestigeOf((await whoAmI({ token }))?.pid ?? `wallet:${wallet}`) });
      }
      case "load": {
        const wallet = await sessionWallet(b.token); if (!wallet) return json(401, { error: "signed out" });
        const lr0 = await getRow(wallet); await grantV6Legacy(`wallet:${wallet}`, (lr0 as any).updated_at); // [V6 store]
        const lr = lr0, lp = await withOwned(toProfile(lr), `wallet:${wallet}`); return json(200, { profile: lp, rev: lr.shop_rev ?? 0, boosts: boostsFor(lp.gear, ownedOfProfile(lp), false), prestige: await prestigeOf((await whoAmI(b))?.pid ?? `wallet:${wallet}`) }); // [Emerly] + boosts
      }
      case "save": {
        const wallet = await sessionWallet(b.token); if (!wallet) return json(401, { error: "signed out" });
        const row = await getRow(wallet); await grantV6Legacy(`wallet:${wallet}`, (row as any).updated_at); // [V6 store]
        const cur = toProfile(row), next = keepCounters(toProfile(row), cleanProfile(b.profile));
        const pres = await prestigeOf((await whoAmI(b))?.pid ?? `wallet:${wallet}`);
        if (stalePrestige(cleanProfile(b.profile).prestige, pres)) next.levels = { ...cur.levels }; // [prestige] a pre-prestige save keeps the reset
        // [v102] shop: a save from before a purchase (older shop_rev) can't refund it; equipped must be owned
        const crev = Math.max(0, Math.floor(Number(b.rev) || 0)), srev = row.shop_rev ?? 0;
        if (b.rev !== undefined && crev < srev) next.gold = Math.max(0, next.gold - await spendSince(`wallet:${wallet}`, crev));
        const ownW = await ownedSet(`wallet:${wallet}`); fitEquipped(next, ownW, false);
        const gfind = boostsFor(next.gear, ownW, false).goldFind; // [Emerly boosts] PET gold find widens the gold pace check
        // seed: a brand-new (blank) wallet save may be filled once from the device save when the wallet is first linked
        const blank = !cur.gold && !cur.stats.kills && !cur.stats.deaths && !cur.stats.botKills && !Object.values(cur.levels).some(Boolean);
        // [v72] merge: a device that played without a wallet, linking to a wallet that already has progress, is merged in ONCE
        // (max of each upgrade, gold and K/D; skins follow the kills), so nothing from either side is lost
        if (b.merge === true && !blank) {
          const dev = await devId(b); if (!dev) return json(400, { error: "no device" });
          const { data: l } = await db.from("pvp_links").update({ merged: true }).eq("dev", dev).eq("wallet", `wallet:${wallet}`).eq("merged", false).select().maybeSingle();
          if (!l) return json(409, { error: "already merged", profile: cur });
          const lv: Record<string, number> = {}; for (const k of Object.keys(cur.levels)) lv[k] = Math.max(cur.levels[k] || 0, next.levels[k] || 0);
          const m = cleanProfile({ gold: Math.max(cur.gold, next.gold), levels: lv, skins: { equipped: next.skins.equipped !== "classic" ? next.skins.equipped : cur.skins.equipped },
            stats: { kills: Math.max(cur.stats.kills, next.stats.kills), deaths: Math.max(cur.stats.deaths, next.stats.deaths), botKills: Math.max(cur.stats.botKills, next.stats.botKills), harborKills: Math.max(cur.stats.harborKills, next.stats.harborKills), bossKills: Math.max(cur.stats.bossKills, next.stats.bossKills), batteryHits: Math.max(cur.stats.batteryHits ?? 0, next.stats.batteryHits ?? 0) } });
          const { data, error } = await db.from("pvp_profiles").update({ ...toRow(m), updated_at: new Date().toISOString() }).eq("id", row.id).select().single();
          if (error) throw error;
          return json(200, { profile: await withOwned(toProfile(data as Row), `wallet:${wallet}`), merged: true, rev: srev, prestige: pres });
        }
        const why = b.seed === true && blank ? null : saveProblem(cur, next, (Date.now() - Date.parse(row.updated_at)) / 60000, gfind);
        if (why) return json(422, { error: why, profile: await withOwned(cur, `wallet:${wallet}`), rev: srev });
        if (b.seed === true && blank) { const dev = await devId(b); if (dev) await db.from("pvp_links").update({ merged: true }).eq("dev", dev).eq("wallet", `wallet:${wallet}`); }
        const { data, error } = await db.from("pvp_profiles").update({ ...toRow(next), updated_at: new Date().toISOString() }).eq("id", row.id).eq("shop_rev", srev).select().maybeSingle();
        if (error) throw error;
        if (!data) return json(409, { error: "purchase in progress, retry", profile: await withOwned(cur, `wallet:${wallet}`), rev: srev });
        const sp = await withOwned(toProfile(data as Row), `wallet:${wallet}`); return json(200, { profile: sp, rev: srev, boosts: boostsFor(sp.gear, ownedOfProfile(sp), false), prestige: pres }); // [Emerly] + boosts
      }
      // [v92] OWNER-ONLY one-off: the merged no-wallet account (pvp_alias group, migrations 017/018) shares gold + upgrades across
      // its devices. First sync per device adds its local gold once (max of each upgrade); later syncs send the gold delta.
      // Any other device gets 404 and keeps its normal device save.
      case "group_sync": {
        const dev = await devId(b); if (!dev) return json(401, { error: "no device" });
        const p = cleanProfile(b.profile), delta = Math.max(-1e7, Math.min(1e7, Math.floor(Number(b.delta) || 0)));
        const gw = await whoAmI({ dk: b.dk }), gpres = gw ? await prestigeOf(gw.pid) : 0;
        if (stalePrestige(p.prestige, gpres)) p.levels = zeroLevels(); // [prestige] the group keeps the max of each level: a stale device sends none
        const { data, error } = await db.rpc("pvp_group_sync", { p_dev: dev, p_gold: p.gold, p_delta: delta, p_levels: p.levels, p_gain_base: CAPS.valueBase, p_gain_per_min: CAPS.valuePerMin });
        if (error) throw error;
        if (!data?.ok) return data?.why === "not a group" || !data ? json(404, { error: "not a group" }) : json(422, { error: data.why });
        return json(200, { gold: data.gold, levels: data.levels, seeded: !!data.seeded, devices: data.devices, prestige: gpres });
      }
      case "logout": {
        if (typeof b.token === "string") await db.from("pvp_sessions").delete().eq("token_hash", await sha256(b.token));
        return json(200, { ok: true });
      }
      // PvP KILLS leaderboard: each side of a kill reports it; pvp_claim_kill records it when both match (migration 006)
      case "kill": {
        const wallet = typeof b.token === "string" ? await sessionWallet(b.token) : null;
        const dk = typeof b.dk === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(b.dk) ? b.dk : null;
        const player = (wallet ? `wallet:${wallet}` : dk ? `dev:${(await sha256("pfp-dev:" + dk)).slice(0, 24)}` : null);
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
      // HUD: my all-time PvP kills rank + confirmed kills / deaths (same identity as "kill": wallet session, else device key)
      case "me": {
        const wallet = typeof b.token === "string" ? await sessionWallet(b.token) : null;
        const dk = typeof b.dk === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(b.dk) ? b.dk : null;
        const player = (wallet ? `wallet:${wallet}` : dk ? `dev:${(await sha256("pfp-dev:" + dk)).slice(0, 24)}` : null);
        if (!player) return json(401, { error: "no identity" });
        const { data, error } = await db.rpc("pvp_kills_me", { p_player: player });
        if (error) throw error;
        const r = Array.isArray(data) ? data[0] : data;
        return json(200, { rank: r?.rank == null ? null : Number(r.rank), kills: Number(r?.kills ?? 0), deaths: Number(r?.deaths ?? 0) });
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
      // optional airdrop wallet from the PvP entry pop-up (no signature: it's just a paste-in address, like Waves).
      // Private table (migration 008), one change per 30 s per player, never returned to anyone.
      // optional airdrop wallet from the PvP entry pop-up. Private table (migration 008), never returned to anyone.
      // [security H4] the FIRST wallet a pirate pastes is kept as before (unverified, like Waves); CHANGING it needs a signature
      // from the NEW wallet (airdrop_nonce -> sign -> airdrop { nonce, signature }), so a stolen session / device key or a relayed
      // sign-in can't quietly redirect someone's airdrop. A wallet that signed (or is the signed-in wallet itself) is `verified`;
      // tools/export_airdrop.py exports verified wallets only by default.
      case "airdrop": {
        const player = await airdropPlayer(b); if (!player) return json(401, { error: "no identity" });
        const sw = typeof b.token === "string" ? await sessionWallet(b.token) : null;
        const wallet = typeof b.wallet === "string" ? b.wallet.trim() : "";
        if (!isWallet(wallet)) return json(400, { error: "bad wallet" });
        const name = String(b.name ?? "").replace(/[\u0000-\u001f<>&"`\\]/g, "").trim().slice(0, 20) || "PIRATE";
        const { data: cur } = await db.from("pvp_airdrop").select("wallet, name, writes, updated_at, verified").eq("player_id", player).maybeSingle();
        let signed = false;
        if (typeof b.nonce === "string" || typeof b.signature === "string") {
          const nonce = String(b.nonce ?? ""); if (!/^[0-9a-f]{32}$/.test(nonce)) return json(400, { error: "bad request" });
          const { data: nn } = await db.from("pvp_nonces").update({ used: true }).eq("nonce", nonce).eq("wallet", wallet).eq("used", false).select().maybeSingle();
          if (!nn || nn.player_id !== player || Date.parse(nn.expires_at) < Date.now()) return json(401, { error: "unknown or expired confirmation, try again" });
          const why = siwsProblem(nn, "airdrop", allowed); if (why) return json(401, { error: why });
          if (!verifySignature(nn.message, String(b.signature ?? ""), wallet)) return json(401, { error: "bad signature" });
          signed = true;
        }
        const verified = signed || (!!sw && sw === wallet) || (!!cur && cur.wallet === wallet && !!cur.verified);
        if (cur && cur.wallet === wallet && cur.name === name && (!verified || cur.verified)) return json(200, { ok: true, verified: !!cur.verified });
        if (cur && cur.wallet !== wallet && !verified) return json(428, { error: "confirm the new wallet", need: "signature" }); // client: airdrop_nonce + sign
        if (cur && Date.now() - Date.parse(cur.updated_at) < 30_000 && !signed) return json(429, { error: "slow down" });
        const now = new Date().toISOString();
        const { error } = await db.from("pvp_airdrop").upsert({ player_id: player, wallet, name, writes: (cur?.writes ?? 0) + 1, updated_at: now, verified, verified_at: verified ? now : null });
        if (error) throw error;
        return json(200, { ok: true, verified });
      }
      // [v72] rename: the caller's OWN board name (wallet session, else device key; the id is never taken from the client)
      case "rename": {
        const sw = typeof b.token === "string" ? await sessionWallet(b.token) : null;
        const player = (sw ? `wallet:${sw}` : await devId(b));
        if (!player) return json(401, { error: "no identity" });
        const { data, error } = await db.rpc("pvp_rename", { p_player: player, p_name: String(b.name ?? "") });
        if (error) throw error;
        if (!data?.ok) return json(data?.why === "name taken" ? 409 : 400, { error: data?.why || "bad name" });
        return json(200, { ok: true, name: data.name });
      }
      // [v76] is this name free for me? (one name = one pirate across BR + Waves). mode "waves": the typed Waves wallet owns its own
      // score names (Waves rows are keyed by that wallet); BR: only my device key / SIGNED wallet. Never moves anything.
      case "name_check": {
        const sw = typeof b.token === "string" ? await sessionWallet(b.token) : null;
        const player = sw ? `wallet:${sw}` : await devId(b);
        const typed = b.mode === "waves" && isWallet(b.wallet) ? String(b.wallet) : null;
        const name = String(b.name ?? "").replace(/[\u0000-\u001f<>&"`\\]/g, "").trim().slice(0, 20);
        if (!name) return json(400, { error: "empty name" });
        const { data, error } = await db.rpc("pvp_name_free", { p_name: name, p_player: player, p_wallet: sw || typed });
        if (error) throw error;
        // [v106] taken by a pirate with a password: the client offers LOG IN instead
        let account = false; if (data !== true) { const { data: me } = player ? await db.rpc("pvp_main", { p_id: player }) : { data: null }; account = await nameHasAccount(db, name, typeof me === "string" ? me : player); }
        return json(200, { ok: true, free: data === true, name, account });
      }
      // [v102] THE ISLAND SHOP. dev_sync: the server copy of a device save (gold the shop spends, stats for goals), sent by the client
      // every ~15 s while in the Battle Royale and right before a purchase. The owner group keeps its own shared save (group_sync).
      case "dev_sync": {
        const who = await whoAmI({ dk: b.dk }); if (!who) return json(401, { error: "no device" });
        if (who.owner) return json(200, await shopView(who, 0, cleanProfile(b.profile).stats, 0));
        if (await isAcctDevice(db, who.raw)) return json(409, { ok: false, why: "account" }); // [v106] logged-in devices use acct_sync
        const r = await devSync(who, b); return json(r.ok ? 200 : 409, r);
      }
      case "shop_state": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        if (who.owner) return json(200, await shopView(who, 0, cleanProfile(null).stats, 0, {}, cleanProfile(b.profile).gear));
        if (who.wallet) { const r = await getRow(who.wallet), rp = toProfile(r); return json(200, await shopView(who, r.gold, rp.stats, r.shop_rev ?? 0, {}, rp.gear)); }
        const { data: r } = await db.from("pvp_dev_profiles").select("*").eq("id", who.pid).maybeSingle();
        if (!r) return json(200, await shopView(who, 0, cleanProfile(null).stats, 0, { nosave: true }));
        const dp = devProfile(r as DevRow); return json(200, await shopView(who, r.gold, dp.stats, r.shop_rev, {}, dp.gear));
      }
      case "shop_buy": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        const item = String(b.item ?? ""), it = SHOP_ITEMS[item], req = String(b.req ?? "");
        if (!it) return json(400, { error: "not for sale" });
        if (!/^[A-Za-z0-9_-]{16,64}$/.test(req)) return json(400, { error: "bad request" });
        if (who.owner) return json(200, { ok: true, owner: true, item });
        let stats: Profile["stats"];
        if (who.wallet) stats = toProfile(await getRow(who.wallet)).stats;
        else { const { data: r } = await db.from("pvp_dev_profiles").select("*").eq("id", who.pid).maybeSingle(); if (!r) return json(409, { error: "no save yet" }); stats = devProfile(r as DevRow).stats; }
        const bd = await boardKD(who.pid); stats = { ...stats, kills: bd.kills, deaths: Math.max(stats.deaths, bd.deaths), prestige: await prestigeOf(who.pid) }; // [security H3] confirmed kills only; [prestige] GOLDEN / DIAMOND
        if (!goalMet(it.goal, stats)) return json(403, { error: "goal not reached", goal: goalsView(stats)[item] ?? null, stats }); // [Timothy] + where they stand
        const { data, error } = await db.rpc("pvp_shop_buy", { p_player: who.pid, p_item: item, p_price: it.price, p_req: req });
        if (error) throw error;
        if (!data?.ok) return json(data?.why === "not enough gold" ? 402 : 409, { error: data?.why || "could not buy", gold: data?.gold });
        if (!who.wallet && !data.retry) await acctBump(db, who.raw, -it.price); // [v106] a logged-in device takes the price off its own save too
        return json(200, { ok: true, item, price: it.price, gold: data.gold, rev: data.rev, retry: !!data.retry });
      }
      // [prestige] PRESTIGE (BANKSY: "Add ability to prestige when max out ship"). Every upgrade track at its top level (checked on the
      // SERVER's copy of the save) -> the prestige level goes up by one and ONLY the ship upgrades go back to base, in one transaction
      // (migration 031 pvp_prestige_do, which also logs the old levels as a backup). `from` = the level the client saw (a double tap
      // or a second device can't prestige twice). Gold, skins, gear, kills, deaths and the boards are not touched.
      // The owner (BANKSYDEGEN) prestiges from the shared group save; everything is free for the owner anyway.
      // [terrain-edit] BANKSY's island terrain deltas: anyone reads them (every client applies them at startup); only the owner writes
      case "terrain_get": {
        const who = (b.token || b.dk) ? await whoAmI(b).catch(() => null) : null;
        const { data } = await db.from("pvp_terrain").select("cells, pieces, paint, rev").eq("id", "island").maybeSingle();
        return json(200, { ok: true, cells: data?.cells ?? {}, pieces: data?.pieces ?? {}, paint: (data as any)?.paint ?? {}, rev: data?.rev ?? 0, owner: !!who?.owner });
      }
      case "terrain_put": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        if (!who.owner) return json(403, { error: "owner only" });
        const src = b.cells && typeof b.cells === "object" && !Array.isArray(b.cells) ? b.cells as Record<string, unknown> : null;
        if (!src) return json(400, { error: "bad cells" });
        const cells: Record<string, number> = {}; let n = 0;
        for (const [k, v] of Object.entries(src)) { const q = Number(k), cm = Math.round(Number(v));
          if (!Number.isInteger(q) || q < 0 || q > 400000 || !Number.isFinite(cm) || cm === 0) continue; if (++n > 60000) return json(413, { error: "too many cells" });
          cells[String(q)] = Math.max(-3000, Math.min(3000, cm)); }
        const pieces: Record<string, Record<string, number>> = {}; let np = 0, npl = 0; const ps = b.pieces && typeof b.pieces === "object" && !Array.isArray(b.pieces) ? b.pieces as Record<string, any> : {};
        for (const [id, v] of Object.entries(ps)) { if (typeof id !== "string" || id.length > 160 || !v || typeof v !== "object") continue; if (++np > 5000) return json(413, { error: "too many pieces" });
          const f = (x: unknown, lim: number) => Math.max(-lim, Math.min(lim, Math.round((Number(x) || 0) * 100) / 100));
          if (id[0] === "+") { const t = Math.round(Number(v.t)); if (!/^\+[a-z0-9]{4,24}$/.test(id) || !Number.isInteger(t) || t < 0 || t > 63) continue; if (++npl > 2000) return json(413, { error: "too many placed" }); // [build-place] owner-placed prop
            pieces[id] = { t, x: f(v.x, 1500), y: f(v.y, 300), z: f(v.z, 1500), ry: f(v.ry, 7) }; continue; }
          pieces[id] = v.h ? { h: 1 } : { dx: f(v.dx, 50), dy: f(v.dy, 20), dz: f(v.dz, 50), ry: f(v.ry, 7) }; }
        // [034] paint: { cell: layer * 1000 + percent } (layers 0-7); a save WITHOUT paint (v183 / v184 clients) keeps the stored paint
        let paint: Record<string, number> | null = null;
        if (b.paint && typeof b.paint === "object" && !Array.isArray(b.paint)) { paint = {}; let nq = 0;
          for (const [k, v] of Object.entries(b.paint as Record<string, unknown>)) { const q = Number(k), x = Math.round(Number(v));
            if (!Number.isInteger(q) || q < 0 || q > 400000 || !Number.isFinite(x)) continue; const L = Math.floor(x / 1000), pc = x % 1000;
            if (L < 0 || L > 7 || pc <= 0 || pc > 100) continue; if (++nq > 60000) return json(413, { error: "too much paint" }); paint[String(q)] = L * 1000 + pc; } }
        const { data: cur } = await db.from("pvp_terrain").select("cells, pieces, paint, rev, log").eq("id", "island").maybeSingle();
        if (cur && Number.isInteger(b.rev) && b.rev !== cur.rev) return json(409, { error: "terrain changed", cells: cur.cells, pieces: cur.pieces, paint: (cur as any).paint, rev: cur.rev });
        const log = [...(Array.isArray(cur?.log) ? cur.log : []), ...(cur ? [{ at: new Date().toISOString(), rev: cur.rev, cells: cur.cells, pieces: cur.pieces, paint: (cur as any).paint }] : [])].slice(-20);
        const rev = (cur?.rev ?? 0) + 1;
        const { error } = await db.from("pvp_terrain").upsert({ id: "island", cells, pieces, paint: paint ?? (cur as any)?.paint ?? {}, rev, log, updated_at: new Date().toISOString() });
        if (error) throw error;
        return json(200, { ok: true, rev, n, np });
      }
      case "prestige": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        if (b.confirm !== true) return json(400, { error: "confirm first" });
        const from = Math.floor(Number(b.from)); if (!Number.isFinite(from) || from < 0) return json(400, { error: "bad request" });
        const store = who.wallet ? "wallet" : who.owner ? "group" : "dev", sid = who.wallet ? `wallet:${who.wallet}` : who.pid;
        if (store === "dev" && !who.owner && !(await isAcctDevice(db, who.raw)) && b.profile) await devSync(who, b); // the latest device save first (levels bought a moment ago)
        const { data, error } = await db.rpc("pvp_prestige_do", { p_player: who.pid, p_store: store, p_store_id: sid, p_max: PRESTIGE_MAX, p_from: from, p_force: false });
        if (error) { if (/pvp_prestige/.test(error.message || "")) return json(503, { error: "prestige isn't switched on yet" }); throw error; }
        if (!data?.ok) return json(data?.why === "not maxed" ? 403 : 409, { error: data?.why || "could not prestige", prestige: data?.level ?? null, levels: data?.levels ?? null });
        if (!who.owner) await grantPrestigeSkins(who.pid, data.level | 0); // [prestige] P1 GOLDEN / P2 DIAMOND given free (the owner owns everything)
        return json(200, { ok: true, prestige: data.level | 0, levels: data.levels, owner: who.owner, granted: prestigeSkins(data.level | 0).map((i) => i.slice(5)) });
      }
      // [v103] WAVES PAYS GOLD FROM SCORE. waves_start: the server notes the run + its start time (one run at a time, max 1 / 10 s).
      // waves_claim: one payout per run id, the score checked against the server-measured run length, per-run + daily caps.
      case "waves_start": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        const run = String(b.run ?? ""); if (!/^[a-z0-9]{12,40}$/.test(run)) return json(400, { error: "bad run" });
        const { data: last } = await db.from("pvp_waves_runs").select("started_at").eq("player_id", who.pid).order("started_at", { ascending: false }).limit(1).maybeSingle();
        if (last && Date.now() - Date.parse(last.started_at) < 3_000) return json(429, { error: "slow down" }); // [security H1] 10 s -> 3 s: the board now needs a server-noted run, and a quick restart must still get one (gold still needs a 20 s run)
        const { error } = await db.from("pvp_waves_runs").insert({ run_id: run, player_id: who.pid });
        if (error) return json(409, { error: "run exists" });
        return json(200, { ok: true });
      }
      case "waves_claim": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        const run = String(b.run ?? ""), score = Math.floor(Number(b.score)), wave = Math.floor(Number(b.wave)), sunk = Math.floor(Number(b.sunk));
        if (!/^[a-z0-9]{12,40}$/.test(run)) return json(400, { error: "bad run" });
        const { data: r } = await db.from("pvp_waves_runs").select("*").eq("run_id", run).maybeSingle();
        if (!r || r.player_id !== who.pid) return json(404, { error: "unknown run" });
        const elapsed = Math.floor((Date.now() - Date.parse(r.started_at)) / 1000);
        if (elapsed < WAVES_GOLD.minRunS) return json(422, { error: "run too short" });
        if (elapsed > WAVES_GOLD.maxRunH * 3600) return json(422, { error: "run expired" });
        const why = wavesProblem(score, wave, sunk, elapsed); if (why) return json(422, { error: why });
        const { count } = await db.from("pvp_waves_payouts").select("run_id", { count: "exact", head: true }).eq("player_id", who.pid).gt("created_at", new Date(Date.now() - 3600_000).toISOString());
        if ((count ?? 0) >= 30) return json(429, { error: "too many runs this hour" });
        const holder = who.owner || (!!who.wallet && !!(await holderStatus(who.wallet)).holder); // the same 2x as every earned gold
        const gfind = (await boostsOf(who, b)).goldFind || 0; // [Emerly boosts] PET gold find on the Waves payout (the daily cap stays on base gold)
        const base = wavesGold(score), gold = Math.round((holder ? base * 2 : base) * (1 + gfind));
        const { data, error } = await db.rpc("pvp_waves_claim", { p_player: who.pid, p_run: run, p_score: score, p_wave: wave, p_sunk: sunk, p_elapsed: elapsed, p_base: base, p_gold: gold, p_holder: holder, p_day_cap: WAVES_GOLD.dayCap });
        if (error) throw error;
        if (!data?.ok) return json(409, { error: data?.why || "no payout" });
        if (!who.wallet && !who.owner) await acctBump(db, who.raw, data.gold | 0); // [v106] the device adds it to its own save too
        return json(200, { ok: true, gold: data.gold, base: data.base, holder, owner: who.owner, score, goldFind: gfind });
      }
      // [security H1] WAVES LEADERBOARD ROW through the server (the anon key can no longer insert into `scores`, migration 030).
      // The run must be one waves_start noted for this pirate; the score is checked against the SERVER-timed run length (the same
      // wavesProblem as the gold payout; a run that was already paid is held to the time it was paid at) and each run gets one row.
      case "waves_score": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        const run = String(b.run ?? ""), wallet = typeof b.wallet === "string" ? b.wallet.trim() : "";
        const score = Math.floor(Number(b.score)), wave = Math.floor(Number(b.wave)), sunk = Math.floor(Number(b.sunk)), dur = Math.floor(Number(b.duration_s));
        if (!/^[a-z0-9]{12,40}$/.test(run)) return json(400, { error: "bad run" });
        if (!isWallet(wallet)) return json(400, { error: "bad wallet" });
        const daily = b.mode === "daily", seed = daily ? String(b.seed ?? "") : null;
        if (daily) { const d0 = new Date().toISOString().slice(0, 10), d1 = new Date(Date.now() - 86400_000).toISOString().slice(0, 10); if (seed !== d0 && seed !== d1) return json(400, { error: "bad seed" }); }
        const { data: r } = await db.from("pvp_waves_runs").select("*").eq("run_id", run).maybeSingle();
        if (!r || r.player_id !== who.pid) return json(404, { error: "unknown run" });
        if (r.scored_at) return json(409, { error: "already saved" });
        const { data: paid } = await db.from("pvp_waves_payouts").select("score, elapsed_s").eq("run_id", run).maybeSingle();
        let elapsed = Math.floor((Date.now() - Date.parse(r.started_at)) / 1000);
        if (elapsed > WAVES_GOLD.maxRunH * 3600) return json(422, { error: "run expired" });
        if (paid) { if (score > paid.score) return json(422, { error: "score changed since the payout" }); elapsed = Math.min(elapsed, paid.elapsed_s + 5); }
        const why = wavesProblem(score, wave, sunk, elapsed); if (why || wave < 1) return json(422, { error: why || "bad run" });
        const { data: mark } = await db.from("pvp_waves_runs").update({ scored_at: new Date().toISOString() }).eq("run_id", run).is("scored_at", null).select("run_id");
        if (!mark?.length) return json(409, { error: "already saved" });
        const name = String(b.name ?? "").replace(/[\u0000-\u001f<>&"`\\]/g, "").trim().slice(0, 20) || null;
        const row: Record<string, unknown> = { wallet, name, score, wave, sunk, duration_s: Math.max(0, Math.min(Number.isFinite(dur) ? dur : elapsed, elapsed, 86400)), verified: !!who.wallet && who.wallet === wallet };
        if (daily) { row.mode = "daily"; row.seed = seed; }
        if ((row.sunk as number) > Math.max(1, Math.floor((row.duration_s as number) / 5))) row.duration_s = Math.min(elapsed, Math.max(row.duration_s as number, sunk * 5)); // schema.sql plausible_sinks
        const { error } = await db.from("scores").insert(row);
        if (error) { await db.from("pvp_waves_runs").update({ scored_at: null }).eq("run_id", run); return json(error.message?.includes("rate limit") ? 429 : 400, { error: error.message?.includes("rate limit") ? "too many scores for this wallet this hour" : "could not save" }); }
        return json(200, { ok: true, verified: row.verified });
      }
      // [security M1 + H2] REALTIME TICKET: before joining a PvP / harbor channel the client proves its LOBBY SEAT (secret seat id, which
      // starts with its network id). The server binds that network id to the caller (pvp_net), notes the seat in that match
      // (pvp_match_seats: the kill board only counts kills between pirates seated together) and, when PFP_RT_JWT_SECRET is set, returns a
      // short-lived JWT for that ONE private channel (migration 029). Party channels: identity only.
      case "ticket": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        const t = parseTopic(b.topic), net = String(b.net ?? ""), seat = String(b.seat ?? "");
        if (!t || !NET_RE.test(net)) return json(400, { error: "bad ticket" });
        const { data: okRate } = await db.rpc("pvp_rl_hit", { p_key: "tk:" + who.pid, p_window_s: 60, p_max: 30 });
        if (okRate === false) return json(429, { error: "slow down" });
        let state: string | null = "party";
        if (b.relay === true) { // [security M1] server/relay.js runs its own lobby: the ticket only binds this network id to the caller
          if (t.kind !== "arena" || !RELAY_SECRET) return json(404, { error: "no relay" });
          const { data: j, error: je } = await db.rpc("pvp_match_join", { p_rooms: [], p_net: net, p_player: who.pid, p_name: String(b.name ?? "").slice(0, 20), p_ip: ipHash }); if (je) throw je;
          if (j !== "ok") return json(409, { error: String(j) });
          return json(200, { ok: true, state: "relay", jwt: null, relay: await relayTicket(RELAY_SECRET, net, t.prefix, TICKET_TTL_S), exp: Math.floor(Date.now() / 1000) + TICKET_TTL_S });
        }
        if (t.kind !== "party") {
          if (!seatNetOk(seat, net)) return json(403, { error: "not seated" });
          const { data: st, error } = await db.rpc("pvp_seat_state", { p_seat: seat, p_kind: t.kind, p_prefix: t.prefix, p_n: t.n }); if (error) throw error;
          state = typeof st === "string" ? st : null;
          if (!state) return json(403, { error: "not seated" });
          const rooms = state === "spec" ? [] : t.claimRooms; // spectators can't sink anyone
          const name = String(b.name ?? "").slice(0, 20);
          const { data: j, error: je } = await db.rpc("pvp_match_join", { p_rooms: rooms, p_net: net, p_player: who.pid, p_name: name, p_ip: ipHash }); if (je) throw je;
          if (j !== "ok") return json(409, { error: String(j) });
        }
        const now = Math.floor(Date.now() / 1000), exp = now + TICKET_TTL_S;
        const jwt = RT_JWT_SECRET ? await mintJwt(RT_JWT_SECRET, { iss: "pfp-pvp", aud: "authenticated", role: "authenticated", sub: (await sha256("pfp-sub:" + who.pid)).slice(0, 32), iat: now, exp, pfp_topic: t.topic, pfp_net: net }) : null;
        return json(200, { ok: true, state, jwt, exp, private: !!jwt });
      }
      // [v105] TREASURE MAPS: maps_state = scan for new drops (boss kills from the STORED save, confirmed BR kills) + your undug maps;
      // map_dig = one claim per map at its spot (migration 026 pvp_map_dig: spot, 30 s, 20 s between digs, 25 a day, reward by tier)
      case "maps_state": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        let boss = 0;
        if (who.owner) boss = cleanProfile(b.profile).stats.bossKills | 0;
        else if (who.wallet) boss = (await getRow(who.wallet))?.boss_kills ?? 0;
        else { const { data: r } = await db.from("pvp_dev_profiles").select("boss_kills").eq("id", who.pid).maybeSingle(); boss = r?.boss_kills | 0; }
        const { data: sync, error: se } = await db.rpc("pvp_maps_sync", { p_player: who.pid, p_boss: boss, p_spots: MAP_SPOTS }); if (se) throw se;
        const { data: rows } = await db.from("pvp_maps").select("id, tier, spot, source, created_at").eq("player_id", who.pid).is("dug_at", null).order("created_at", { ascending: true }).limit(50);
        const { data: dug } = await db.from("pvp_maps").select("id, tier, gold, dug_at").eq("player_id", who.pid).not("dug_at", "is", null).order("dug_at", { ascending: false }).limit(5);
        // [v152] chest items in "last finds" (035 pvp_map_loot; not run yet = an error here = no items, nothing else changes)
        const ids = (dug || []).map((d: any) => d.id), { data: loot } = ids.length ? await db.from("pvp_map_loot").select("map_id, item, crew, dup").in("map_id", ids) : { data: [] };
        const lootOf = new Map((loot || []).map((l: any) => [l.map_id, { item: String(l.item).slice(5), crew: !!l.crew, dup: !!l.dup }]));
        const recent = (dug || []).map((d: any) => ({ tier: d.tier, gold: d.gold, dug_at: d.dug_at, loot: lootOf.get(d.id) ?? null }));
        return json(200, { ok: true, new: sync?.new | 0, maps: rows || [], recent });
      }
      // [wish] THE WISHING FOUNTAIN (hidden: the reply says nothing about luck). 100 gold off the SERVER save (039 pvp_wish_toss, same
      // idempotent req + shop_rev as shop_buy), then 5 min of a lucky chest table (chest.ts WISH). Behind pvp_flags 'wish_fountain'. Owner: free.
      case "wish_toss": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        const req = String(b.req ?? ""); if (!/^[A-Za-z0-9_-]{16,64}$/.test(req)) return json(400, { error: "bad request" });
        const { data, error } = await db.rpc("pvp_wish_toss", { p_player: who.pid, p_req: req, p_price: WISH.price, p_minutes: WISH.minutes });
        if (error) { if (/pvp_wish_toss|PGRST202|42883/.test(`${error.code} ${error.message}`)) return json(409, { error: "closed" }); throw error; }
        if (!data?.ok) return json(data?.why === "not enough gold" ? 402 : 409, { error: data?.why || "could not", gold: data?.gold });
        if (!who.wallet && !who.owner && !data.owner && !data.retry) await acctBump(db, who.raw, -WISH.price);
        return json(200, { ok: true, owner: !!data.owner, price: data.owner ? 0 : WISH.price, gold: data.gold, rev: data.rev, retry: !!data.retry });
      }
      case "map_dig": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        const id = String(b.map ?? ""), spot = String(b.spot ?? "");
        if (!/^[0-9a-f-]{36}$/.test(id) || !MAP_SPOTS_ALL.includes(spot)) return json(400, { error: "bad dig" });
        const holder = who.owner || (!!who.wallet && !!(await holderStatus(who.wallet)).holder);
        // [v152] CHEST ITEMS: the server picks the chest item from the map id (chest.ts; tier from OUR row, never the client's);
        // migration 035 grants it in the dig's own transaction. 035 not run yet -> the 026 dig (gold only), same as before.
        let drop: ChestDrop = null;
        const { data: mr } = await db.from("pvp_maps").select("tier").eq("id", id).eq("player_id", who.pid).is("dug_at", null).maybeSingle();
        if (!who.owner && mr) drop = chestDrop(id, mr.tier);
        // [inventory] 036: ITEMS ONLY (no chest gold): valuables + maybe a weapon + the cosmetic (owned -> a sellable 'dup:' item)
        if (mr) { const { data: rf } = await db.from("pvp_flags").select("on_").eq("k", "rare_weapon_drops").maybeSingle();
          const items = chestItems(id, mr.tier, holder, !!rf?.on_, await wishLucky(who.pid)); // [wish] a quiet tilt for 5 min after a fountain wish (039)
          const { data: iv, error: ie } = await db.rpc("pvp_map_dig_inv", { p_player: who.pid, p_map: id, p_spot: spot, p_holder: holder, p_items: items, p_cosmetic: drop?.item ?? null, p_crew: !!drop?.crew, p_dup: dupItem(drop) });
          if (!ie) { if (!iv?.ok) return json(409, { error: iv?.why || "no treasure" });
            const loot = drop && iv.item ? { item: String(iv.item).slice(5), crew: !!iv.crew, dup: !!iv.dup, dup_gold: 0, dup_item: iv.dup_item ?? null, price: drop.price } : null;
            const gun = await gunDropRpc(db, who.pid, "m:" + id, (mr.tier === "rare" || mr.tier === "legendary") ? mr.tier : "common"); // [Emerly musket-rank] parts + accessories (042; off = none)
            return json(200, { ok: true, gold: 0, dig_gold: 0, tier: iv.tier, holder, owner: who.owner, items: [...(iv.items || []), ...gun], loot }); }
          if (!/pvp_map_dig_inv|PGRST202|42883/.test(`${ie.code} ${ie.message}`)) throw ie; } // 036 not run yet -> the 035 / 026 dig below, as before
        // [Raul items redo 2] PET SELL BONUS (PROPOSED): a spare item is SOLD for CHEST_DUP_SHARE of its price; the worn pet adds its % (server gear + ownership)
        const sell = drop ? ((await boostsOf(who, b)).sell || 0) : 0;
        let { data, error } = drop
          ? await db.rpc("pvp_map_dig_item", { p_player: who.pid, p_map: id, p_spot: spot, p_holder: holder, p_item: drop.item, p_crew: drop.crew, p_dup: sellGold(drop.dup_gold, sell) })
          : await db.rpc("pvp_map_dig", { p_player: who.pid, p_map: id, p_spot: spot, p_holder: holder });
        if (error && drop && /pvp_map_dig_item|PGRST202|42883/.test(`${error.code} ${error.message}`)) { drop = null; ({ data, error } = await db.rpc("pvp_map_dig", { p_player: who.pid, p_map: id, p_spot: spot, p_holder: holder })); }
        if (error) throw error;
        if (!data?.ok) return json(409, { error: data?.why || "no treasure" });
        // [v106] a logged-in device that adds the dig gold to its own save too sends mirror: true (like the Waves payout)
        if (b.mirror === true && !who.wallet && !who.owner) await acctBump(db, who.raw, data.gold | 0);
        const loot = drop && data.item ? { item: String(data.item).slice(5), crew: !!data.crew, dup: !!data.dup, dup_gold: data.dup_gold | 0, price: drop.price, sell: data.dup ? sell : 0 } : null; // item = 'slot:id' (the client's gear key)
        return json(200, { ok: true, gold: data.gold, dig_gold: data.dig_gold ?? data.gold, base: data.base, tier: data.tier, holder, owner: who.owner, loot });
      }
      default:
        if (INV_ACTIONS.includes(String(b.action))) return await inventoryAction({ db, whoAmI, boostsOf, json, mapSpots: MAP_SPOTS }, String(b.action), b); // [inventory]
        if (HOUSE_ACTIONS.includes(String(b.action) as any)) return await houseAction({ db, whoAmI, json, acctBump }, String(b.action), b); // [storage-houses]
        if (ADMIN_ACTIONS.includes(String(b.action) as any)) return await adminAction({ db, whoAmI, json }, String(b.action), b); // [admin-menu] who.owner checked inside
        return json(400, { error: "unknown action" });
    }
  } catch (e) { console.error(e); return json(500, { error: "server error" }); }
});
