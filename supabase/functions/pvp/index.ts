// PUMPFUN PIRATES · Supabase Edge Function `pvp`: wallet-signed PvP saves (gold, upgrades, skins, K/D).
// Deploy: supabase functions deploy pvp --no-verify-jwt   (tables: migrations/005_pvp.sql)
// POST JSON { action: "nonce" | "verify" | "load" | "save" | "logout" | "kill" | "top" | "me" | "holder" | "holder_claim" | "airdrop" | "rename" | "group_sync" | "dev_sync" | "shop_state" | "shop_buy" | "waves_start" | "waves_claim", ... }. The wallet only ever SIGNS A MESSAGE.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildMessage, verifySignature, isWallet, cleanProfile, saveProblem, keepCounters, CAPS, tokenBalance, HOLDER_MINTS, HOLDER_MIN_TOKENS, HOLDER_DAILY_GOLD, HOLDER_CACHE_MS, type Profile,
  OWNER_MAIN, SHOP_ITEMS, SHOP_SKINS, GEAR_SLOTS, SEED_GOLD_CAP, goalMet, fitEquipped, cleanGear, value, pvpTierCost, TIER_COSTS, SKIN_KILLS, WAVES_GOLD, wavesGold, wavesProblem } from "./lib.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://game.pumpfunpirates.com,https://banksydegen.github.io,http://localhost:8787,http://127.0.0.1:8787")
  .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
const NONCE_TTL_MS = 5 * 60 * 1000, SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const rand = (k: number) => { const a = new Uint8Array(k); crypto.getRandomValues(a); return a; };
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const b64url = (a: Uint8Array) => btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const devId = async (b: Record<string, unknown>) => typeof b.dk === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(b.dk) ? `dev:${(await sha256("pfp-dev:" + b.dk)).slice(0, 24)}` : null;
type Row = { id: string; wallet: string; gold: number; upgrades: Record<string, number>; skins: Profile["skins"]; kills: number; deaths: number; bot_kills: number; harbor_kills?: number; boss_kills?: number; updated_at: string; shop_rev?: number; gear?: Record<string, string> };
const toProfile = (r: Row): Profile => cleanProfile({ gold: r.gold, levels: r.upgrades, skins: r.skins, gear: r.gear, stats: { kills: r.kills, deaths: r.deaths, botKills: r.bot_kills, harborKills: r.harbor_kills ?? 0, bossKills: r.boss_kills ?? 0 } });
async function withOwned(p: Profile, pid: string) { const own = await ownedSet(pid); p.skins.owned = [...own].filter((i) => i.startsWith("skin:")).map((i) => i.slice(5)); (p as any).gearOwned = [...own].filter((i) => i.startsWith("gear:")).map((i) => i.slice(5)); return p; }
const toRow = (p: Profile) => ({ gold: p.gold, upgrades: p.levels, skins: { owned: [], equipped: p.skins.equipped }, gear: cleanGear(p.gear), kills: p.stats.kills, deaths: p.stats.deaths, bot_kills: p.stats.botKills, harbor_kills: p.stats.harborKills, boss_kills: p.stats.bossKills }); // [v98] migration 020 columns

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
async function ownedSet(pid: string) { const { data } = await db.from("pvp_owned").select("item").eq("player_id", pid); return new Set((data ?? []).map((r: any) => r.item as string)); }
const ownedLists = (own: Set<string>, owner: boolean) => owner
  ? { skins: ["classic", ...SHOP_SKINS], gear: Object.entries(GEAR_SLOTS).flatMap(([s, ids]) => ids.map((i) => `${s}:${i}`)) }
  : { skins: ["classic", ...[...own].filter((i) => i.startsWith("skin:")).map((i) => i.slice(5))], gear: [...own].filter((i) => i.startsWith("gear:")).map((i) => i.slice(5)) };
async function boardKD(pid: string) { const { data } = await db.rpc("pvp_kills_me", { p_player: pid }); const r = Array.isArray(data) ? data[0] : data; return { kills: Number(r?.kills ?? 0), deaths: Number(r?.deaths ?? 0) }; }
async function spendSince(pid: string, rev: number) { const { data } = await db.from("pvp_purchases").select("price").eq("player_id", pid).gt("rev", rev); return (data ?? []).reduce((a: number, r: any) => a + (r.price | 0), 0); }
// device row <-> Profile
type DevRow = { id: string; gold: number; gold_pending: number; upgrades: Record<string, number>; skin: string; gear: Record<string, string>; kills: number; deaths: number; bot_kills: number; harbor_kills: number; boss_kills: number; shop_rev: number; updated_at: string };
const devProfile = (r: DevRow): Profile => cleanProfile({ gold: r.gold, levels: r.upgrades, skins: { equipped: r.skin }, gear: r.gear, stats: { kills: r.kills, deaths: r.deaths, botKills: r.bot_kills, harborKills: r.harbor_kills, bossKills: r.boss_kills } });
const devCols = (p: Profile) => ({ gold: p.gold, upgrades: p.levels, skin: p.skins.equipped, gear: cleanGear(p.gear), kills: p.stats.kills, deaths: p.stats.deaths, bot_kills: p.stats.botKills, harbor_kills: p.stats.harborKills, boss_kills: p.stats.bossKills });
const upgValue = (lv: Record<string, number>) => { let v = 0; for (const [id, c] of Object.entries(TIER_COSTS)) for (let i = 0; i < Math.min(lv[id] || 0, c.length); i++) v += pvpTierCost(i); return v; };
// one sync step: the server copy follows the device save, but never faster than the game can pay / kill (same CAPS as wallet saves).
// Instead of rejecting a big jump (which could stall forever), it CLAMPS: the copy catches up over the next syncs.
function stepToward(cur: Profile, rep: Profile, mins: number): Profile {
  const m = Math.max(0.25, Math.min(mins, 60)), up = (a: number, b: number, cap: number) => Math.max(a, Math.min(b, a + cap));
  const kc = CAPS.killsBase + CAPS.killsPerMin * m;
  const next = cleanProfile({ ...rep, stats: { kills: up(cur.stats.kills, rep.stats.kills, kc), deaths: Math.max(cur.stats.deaths, rep.stats.deaths), botKills: up(cur.stats.botKills, rep.stats.botKills, kc),
    harborKills: up(cur.stats.harborKills, rep.stats.harborKills, kc), bossKills: up(cur.stats.bossKills, rep.stats.bossKills, CAPS.bossBase + CAPS.bossPerMin * m) } });
  const allow = CAPS.valuePerMin * m, over = value(next) - value(cur) - allow;
  if (over > 0) { if (over <= next.gold) next.gold -= over; else { next.levels = { ...cur.levels }; next.gold = Math.max(0, Math.min(next.gold, cur.gold + allow - Math.max(0, upgValue(next.levels) - upgValue(cur.levels)))); } }
  return next;
}
async function shopView(who: { pid: string; owner: boolean }, gold: number, stats: Profile["stats"], rev: number, extra: Record<string, unknown> = {}) {
  const own = who.owner ? new Set<string>() : await ownedSet(who.pid), bd = await boardKD(who.pid);
  const st = { ...stats, kills: Math.max(stats.kills, bd.kills), deaths: Math.max(stats.deaths, bd.deaths) };
  return { ok: true, owner: who.owner, gold, rev, stats: st, owned: ownedLists(own, who.owner), ...extra };
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
    const cur = devProfile(row), rep = cleanProfile(rep0);
    if (crev < row.shop_rev) rep.gold = Math.max(0, rep.gold - await spendSince(who.pid, crev)); // an older save can't refund a purchase
    const next = stepToward(cur, rep, (Date.now() - Date.parse(row.updated_at)) / 60000);
    fitEquipped(next, await ownedSet(who.pid), false);
    const { data: upd, error } = await db.from("pvp_dev_profiles").update({ ...devCols(next), updated_at: new Date().toISOString() }).eq("id", who.pid).eq("shop_rev", row.shop_rev).select("id");
    if (error) throw error;
    if (upd && upd.length) return shopView(who, next.gold, next.stats, row.shop_rev, { behind: Math.max(0, rep.gold - next.gold), equipped: { skin: next.skins.equipped, gear: next.gear } });
  } // a purchase landed meanwhile (shop_rev moved): retried; give up quietly after a few
  return { ok: false, why: "busy" };
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
        // [v72] this device's BATTLE ROYALE kills / deaths follow the wallet (first wallet only; rows kept)
        const dev = await devId(b); let link: unknown = null;
        if (dev) { const { data: l, error: le } = await db.rpc("pvp_link_device", { p_dev: dev, p_wallet: `wallet:${wallet}` }); if (le) console.warn("link", le.message); else link = l; }
        const token = b64url(rand(32)), exp = new Date(Date.now() + SESSION_TTL_MS).toISOString();
        await db.from("pvp_sessions").delete().eq("wallet", wallet).lt("expires_at", new Date().toISOString());
        const { error } = await db.from("pvp_sessions").insert({ token_hash: await sha256(token), wallet, expires_at: exp });
        if (error) throw error;
        return json(200, { token, expires_at: exp, profile: await withOwned(toProfile(row), `wallet:${wallet}`), rev: row.shop_rev ?? 0, link });
      }
      case "load": {
        const wallet = await sessionWallet(b.token); if (!wallet) return json(401, { error: "signed out" });
        const lr = await getRow(wallet); return json(200, { profile: await withOwned(toProfile(lr), `wallet:${wallet}`), rev: lr.shop_rev ?? 0 });
      }
      case "save": {
        const wallet = await sessionWallet(b.token); if (!wallet) return json(401, { error: "signed out" });
        const row = await getRow(wallet), cur = toProfile(row), next = keepCounters(toProfile(row), cleanProfile(b.profile));
        // [v102] shop: a save from before a purchase (older shop_rev) can't refund it; equipped must be owned
        const crev = Math.max(0, Math.floor(Number(b.rev) || 0)), srev = row.shop_rev ?? 0;
        if (b.rev !== undefined && crev < srev) next.gold = Math.max(0, next.gold - await spendSince(`wallet:${wallet}`, crev));
        fitEquipped(next, await ownedSet(`wallet:${wallet}`), false);
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
            stats: { kills: Math.max(cur.stats.kills, next.stats.kills), deaths: Math.max(cur.stats.deaths, next.stats.deaths), botKills: Math.max(cur.stats.botKills, next.stats.botKills), harborKills: Math.max(cur.stats.harborKills, next.stats.harborKills), bossKills: Math.max(cur.stats.bossKills, next.stats.bossKills) } });
          const { data, error } = await db.from("pvp_profiles").update({ ...toRow(m), updated_at: new Date().toISOString() }).eq("id", row.id).select().single();
          if (error) throw error;
          return json(200, { profile: await withOwned(toProfile(data as Row), `wallet:${wallet}`), merged: true, rev: srev });
        }
        const why = b.seed === true && blank ? null : saveProblem(cur, next, (Date.now() - Date.parse(row.updated_at)) / 60000);
        if (why) return json(422, { error: why, profile: await withOwned(cur, `wallet:${wallet}`), rev: srev });
        if (b.seed === true && blank) { const dev = await devId(b); if (dev) await db.from("pvp_links").update({ merged: true }).eq("dev", dev).eq("wallet", `wallet:${wallet}`); }
        const { data, error } = await db.from("pvp_profiles").update({ ...toRow(next), updated_at: new Date().toISOString() }).eq("id", row.id).eq("shop_rev", srev).select().maybeSingle();
        if (error) throw error;
        if (!data) return json(409, { error: "purchase in progress, retry", profile: await withOwned(cur, `wallet:${wallet}`), rev: srev });
        return json(200, { profile: await withOwned(toProfile(data as Row), `wallet:${wallet}`), rev: srev });
      }
      // [v92] OWNER-ONLY one-off: the merged no-wallet account (pvp_alias group, migrations 017/018) shares gold + upgrades across
      // its devices. First sync per device adds its local gold once (max of each upgrade); later syncs send the gold delta.
      // Any other device gets 404 and keeps its normal device save.
      case "group_sync": {
        const dev = await devId(b); if (!dev) return json(401, { error: "no device" });
        const p = cleanProfile(b.profile), delta = Math.max(-1e7, Math.min(1e7, Math.floor(Number(b.delta) || 0)));
        const { data, error } = await db.rpc("pvp_group_sync", { p_dev: dev, p_gold: p.gold, p_delta: delta, p_levels: p.levels, p_gain_base: CAPS.valueBase, p_gain_per_min: CAPS.valuePerMin });
        if (error) throw error;
        if (!data?.ok) return data?.why === "not a group" || !data ? json(404, { error: "not a group" }) : json(422, { error: data.why });
        return json(200, { gold: data.gold, levels: data.levels, seeded: !!data.seeded, devices: data.devices });
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
      case "airdrop": {
        const sw = typeof b.token === "string" ? await sessionWallet(b.token) : null;
        const dk = typeof b.dk === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(b.dk) ? b.dk : null;
        const player = sw ? `wallet:${sw}` : dk ? `dev:${(await sha256("pfp-dev:" + dk)).slice(0, 24)}` : null;
        if (!player) return json(401, { error: "no identity" });
        const wallet = typeof b.wallet === "string" ? b.wallet.trim() : "";
        if (!isWallet(wallet)) return json(400, { error: "bad wallet" });
        const name = String(b.name ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 20) || "PIRATE";
        const { data: cur } = await db.from("pvp_airdrop").select("wallet, name, writes, updated_at").eq("player_id", player).maybeSingle();
        if (cur && cur.wallet === wallet && cur.name === name) return json(200, { ok: true });
        if (cur && Date.now() - Date.parse(cur.updated_at) < 30_000) return json(429, { error: "slow down" });
        const { error } = await db.from("pvp_airdrop").upsert({ player_id: player, wallet, name, writes: (cur?.writes ?? 0) + 1, updated_at: new Date().toISOString() });
        if (error) throw error;
        return json(200, { ok: true });
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
        return json(200, { ok: true, free: data === true, name });
      }
      // [v102] THE ISLAND SHOP. dev_sync: the server copy of a device save (gold the shop spends, stats for goals), sent by the client
      // every ~15 s while in the Battle Royale and right before a purchase. The owner group keeps its own shared save (group_sync).
      case "dev_sync": {
        const who = await whoAmI({ dk: b.dk }); if (!who) return json(401, { error: "no device" });
        if (who.owner) return json(200, await shopView(who, 0, cleanProfile(b.profile).stats, 0));
        const r = await devSync(who, b); return json(r.ok ? 200 : 409, r);
      }
      case "shop_state": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        if (who.owner) return json(200, await shopView(who, 0, cleanProfile(null).stats, 0));
        if (who.wallet) { const r = await getRow(who.wallet); return json(200, await shopView(who, r.gold, toProfile(r).stats, r.shop_rev ?? 0)); }
        const { data: r } = await db.from("pvp_dev_profiles").select("*").eq("id", who.pid).maybeSingle();
        if (!r) return json(200, await shopView(who, 0, cleanProfile(null).stats, 0, { nosave: true }));
        return json(200, await shopView(who, r.gold, devProfile(r as DevRow).stats, r.shop_rev));
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
        const bd = await boardKD(who.pid); stats = { ...stats, kills: Math.max(stats.kills, bd.kills), deaths: Math.max(stats.deaths, bd.deaths) };
        if (!goalMet(it.goal, stats)) return json(403, { error: "goal not reached" });
        const { data, error } = await db.rpc("pvp_shop_buy", { p_player: who.pid, p_item: item, p_price: it.price, p_req: req });
        if (error) throw error;
        if (!data?.ok) return json(data?.why === "not enough gold" ? 402 : 409, { error: data?.why || "could not buy", gold: data?.gold });
        return json(200, { ok: true, item, price: it.price, gold: data.gold, rev: data.rev, retry: !!data.retry });
      }
      // [v103] WAVES PAYS GOLD FROM SCORE. waves_start: the server notes the run + its start time (one run at a time, max 1 / 10 s).
      // waves_claim: one payout per run id, the score checked against the server-measured run length, per-run + daily caps.
      case "waves_start": {
        const who = await whoAmI(b); if (!who) return json(401, { error: "no identity" });
        const run = String(b.run ?? ""); if (!/^[a-z0-9]{12,40}$/.test(run)) return json(400, { error: "bad run" });
        const { data: last } = await db.from("pvp_waves_runs").select("started_at").eq("player_id", who.pid).order("started_at", { ascending: false }).limit(1).maybeSingle();
        if (last && Date.now() - Date.parse(last.started_at) < 10_000) return json(429, { error: "slow down" });
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
        const base = wavesGold(score), gold = holder ? base * 2 : base;
        const { data, error } = await db.rpc("pvp_waves_claim", { p_player: who.pid, p_run: run, p_score: score, p_wave: wave, p_sunk: sunk, p_elapsed: elapsed, p_base: base, p_gold: gold, p_holder: holder, p_day_cap: WAVES_GOLD.dayCap });
        if (error) throw error;
        if (!data?.ok) return json(409, { error: data?.why || "no payout" });
        return json(200, { ok: true, gold: data.gold, base: data.base, holder, owner: who.owner, score });
      }
      default: return json(400, { error: "unknown action" });
    }
  } catch (e) { console.error(e); return json(500, { error: "server error" }); }
});
