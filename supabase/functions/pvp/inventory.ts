// [inventory] Edge actions for THE INVENTORY (migration 036). Every rule lives in SQL (atomic, locked); this file only resolves who is
// asking (index.ts whoAmI), rolls server-side things (fish, chest items) and shapes replies. Client values are never trusted for
// prices, qty ownership, multipliers or recipients.
import { sellItem, OWNER_MAIN } from "./lib.ts";
import { FISH, FISH_WEIGHT, FISH_CM, VALUABLES, WEAPON_BASES, WEAPON_TIERS, KEY_RE, itemInfo, MARKET, CHEST_VALUABLES, RUIN_CHESTS, IDOL_SHARDS, muskLevelOf, muskTierOf } from "./invCatalog.ts";
import { chestRoll } from "./chest.ts";
import { acctBump } from "./accounts.ts";
import { onlineAction } from "./online.ts"; // [give-dropdown] the GIVE picker's online list
import { squadAction, SQUAD_ACTIONS } from "./squad.ts"; // [squad-hall]
type Who = { raw: string; pid: string; wallet: string | null; owner: boolean };
type Ctx = { db: any; whoAmI: (b: Record<string, unknown>) => Promise<Who | null>; boostsOf: (who: Who, b: Record<string, unknown>) => Promise<Record<string, number>>; json: (s: number, o: unknown) => Response; mapSpots: string[] };
export const INV_ACTIONS = ["inv_musk_level", "inv_musk_rank", "inv_musk_salvage", "inv_buy_acc", "inv_state", "inv_sell", "inv_gift", "inv_fish", "inv_fish_bite", "inv_fish_land", "inv_find", "inv_ruin_chest", "inv_idol_forge", "inv_equip", "inv_unequip", "inv_pot", "inv_online", "gun_acc_set", "gun_equip", "mkt_browse", "mkt_list", "mkt_buy", "mkt_cancel", ...SQUAD_ACTIONS];
const okKey = (k: unknown) => typeof k === "string" && (KEY_RE.test(k) || /^map:[0-9a-f-]{36}$/.test(k));
const qtyOf = (q: unknown) => { const n = Math.floor(Number(q)); return Number.isFinite(n) && n >= 1 && n <= 100000 ? n : 0; };
// every item the owner test kit holds (~3 of each): fish, valuables, weapons at every rarity (maps are added by SQL)
export const ownerKitItems = () => [...Object.keys(FISH).map((f) => `fish:${f}`), ...Object.keys(VALUABLES).map((v) => `val:${v}`),
  ...Object.entries(WEAPON_BASES).flatMap(([s, bs]) => (bs as string[]).flatMap((b) => WEAPON_TIERS.map((t: string) => `wpn:${s}:${b}:${t}`)))];
// the server's fish roll (lagoon journal weights), seeded by a server nonce: the client only says "I reeled in"
export function rollFish(seed: string) { const tot = Object.values(FISH_WEIGHT).reduce((a: number, b: any) => a + b, 0) as number; let r = (chestRoll("fish:" + seed) * 1000 + chestRoll("fish2:" + seed)) % tot;
  for (const [id, w] of Object.entries(FISH_WEIGHT)) { if (r < (w as number)) return `fish:${id}`; r -= w as number; } return "fish:minnow"; }
// [fish2] the server-rolled length (cm) for a caught species: same seed, skewed small (big ones are rare), within FISH_CM
export function rollCm(seed: string, fish: string) { const [a, b] = (FISH_CM as any)[fish.slice(5)] || [10, 20]; return Math.round(a + Math.pow(chestRoll("cm:" + seed) / 999, 1.6) * (b - a)); }
// [fish2] REEL TICKETS (flag fish_reel, OFF until BANKSY says so): the bite rolls the fish on the SERVER, the client only learns its rarity (how
// hard it fights); landing it redeems the HMAC-signed ticket once (pvp_inv_once 'fishq:<nonce>') through the same pvp_fish_catch (rate limits,
// 200 a day). A lost fight = no catch. Nothing is stored for a bite; no migration beyond the flag row (040).
export const FISH_TICKET_TTL_MS = 30000, FISH_TICKET_MIN_MS = 1200;
const b64u = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function hmac(secret: string, msg: string) { const k = await crypto.subtle.importKey("raw", new TextEncoder().encode("pfp-fish2:" + secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)))); }
export async function signFishTicket(secret: string, t: { p: string; f: string; cm: number; n: string; at: number }) { const body = b64u(new TextEncoder().encode(JSON.stringify(t))); return body + "." + await hmac(secret, body); }
export async function readFishTicket(secret: string, tok: unknown, pid: string, now: number): Promise<{ ok: true; f: string; cm: number; n: string } | { ok: false; why: string }> {
  if (typeof tok !== "string" || tok.length > 600 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(tok)) return { ok: false, why: "bad ticket" };
  const [body, sig] = tok.split("."); if (await hmac(secret, body) !== sig) return { ok: false, why: "bad ticket" };
  let t: any; try { t = JSON.parse(new TextDecoder().decode(unb64u(body))); } catch { return { ok: false, why: "bad ticket" }; }
  if (t?.p !== pid || typeof t.f !== "string" || !(FISH as any)[t.f.slice(5)] || typeof t.n !== "string" || !/^[0-9a-f-]{36}$/.test(t.n)) return { ok: false, why: "bad ticket" };
  const age = now - Number(t.at); if (!(age >= FISH_TICKET_MIN_MS)) return { ok: false, why: "too fast" }; if (age > FISH_TICKET_TTL_MS) return { ok: false, why: "it got away" };
  return { ok: true, f: t.f, cm: Math.max(1, Math.min(400, Number(t.cm) | 0)), n: t.n }; }
const FISH_SECRET = () => (globalThis as any).Deno?.env?.get?.("SUPABASE_SERVICE_ROLE_KEY") || "";
// [Emerly musket-rank + gunacc] = js/musketUpgrades.js RANK_UP / SALVAGE_PARTS + js/inventory/catalog.js GUN_ITEMS prices (keep in sync)
export const RANK_UP: Record<string, { gold: number; parts: number }> = { common: { gold: 1500, parts: 3 }, rare: { gold: 4000, parts: 6 }, epic: { gold: 10000, parts: 12 } };
export const SALVAGE_PARTS: Record<string, number> = { common: 1, rare: 2, epic: 4, legendary: 8 };
export const ACC_PRICE: Record<string, number> = { "val:acc_stock": 600, "val:acc_bayonet": 800, "val:acc_horn": 1000, "val:acc_scope": 1200 };
const ACCS = Object.keys(ACC_PRICE);
// drop rates (per mille, server-rolled): fishing = parts 80 (1 part); chests = parts by tier + one accessory
export const GUN_DROPS = { fish: { parts: 80, acc: 0 }, common: { parts: 250, acc: 30 }, rare: { parts: 500, acc: 60 }, legendary: { parts: 1000, acc: 120 } };
const roll = () => crypto.getRandomValues(new Uint32Array(1))[0] % 1000;
export function gunDrop(kind: "fish" | "common" | "rare" | "legendary") {
  const t = GUN_DROPS[kind] ?? GUN_DROPS.common, out: { item: string; qty: number }[] = [];
  if (roll() < t.parts) out.push({ item: "val:musket_parts", qty: kind === "legendary" ? 2 + (roll() % 2) : kind === "rare" ? 1 + (roll() % 2) : 1 });
  if (t.acc && roll() < t.acc) out.push({ item: ACCS[roll() % ACCS.length], qty: 1 });
  return out;
}
export async function gunDropRpc(db: any, pid: string, ref: string, kind: "fish" | "common" | "rare" | "legendary") { // fails soft (042 not run = nothing)
  const items = gunDrop(kind); if (!items.length) return [];
  try { const { data } = await db.rpc("pvp_inv_gun_drop", { p_player: pid, p_ref: ref, p_items: items, p_source: kind === "fish" ? "fish" : "chest" }); return data?.items || []; } catch { return []; }
}
export async function inventoryAction(c: Ctx, action: string, b: Record<string, unknown>): Promise<Response> {
  const { db, json } = c; const who = await c.whoAmI(b); if (!who) return json(401, { error: "no identity" });
  const pid = who.pid, rpc = async (fn: string, args: Record<string, unknown>) => { const { data, error } = await db.rpc(fn, args); if (error) throw error; return data; };
  const reply = (d: any) => d?.ok ? json(200, d) : json(409, { error: d?.why || "refused" });
  switch (action) {
    case "inv_state": {
      const { data: birds, error: birdError } = await db.rpc("pvp_parrot_op", { p_player: pid, p_op: "list" });
      if (birdError) throw birdError;
      await rpc("pvp_inv_carry", { p_player: pid });                                    // owned swords / muskets show up (once each)
      if (who.owner) await rpc("pvp_inv_owner_kit", { p_player: pid, p_items: ownerKitItems(), p_spots: c.mapSpots }); // once, owner only
      const { data: rows } = await db.from("pvp_inv").select("item, source, qty").eq("player_id", pid);
      const { data: maps } = await db.from("pvp_maps").select("id, tier, spot, source, created_at").eq("player_id", pid).is("dug_at", null).order("created_at").limit(200);
      const { data: eq } = await db.from("pvp_inv_equip").select("slot, item").eq("player_id", pid);
      const { data: flags } = await db.from("pvp_flags").select("k, on_");
      const stack = new Map<string, { item: string; qty: number; tradeable: number; kit: number }>();
      for (const r of rows || []) { const s = stack.get(r.item) || { item: r.item, qty: 0, tradeable: 0, kit: 0 }; s.qty += r.qty; if (r.source !== "carry_buy") s.tradeable += r.qty; if (r.source === "kit") s.kit += r.qty; stack.set(r.item, s); }
      let guns: any[] = [];
      try { const g = await rpc("pvp_gun_ensure", { p_player: pid }); guns = g?.guns || []; } catch { /* 047 not applied yet */ }
      return json(200, { ok: true, parrots: birds?.parrots || [], parrotEquipped: birds?.equipped || null, items: [...stack.values()], maps: maps || [], equipped: Object.fromEntries((eq || []).filter((e: any) => who.owner || stack.has(e.item)).map((e: any) => [e.slot, e.item])) /* [rare-equip] a given / sold weapon stops counting */, guns, flags: Object.fromEntries((flags || []).map((f: any) => [f.k, f.on_])), owner: who.owner });
    }
    case "inv_sell": {
      const item = b.item, qty = qtyOf(b.qty), shop = b.shop === "fish" ? "fish" : b.shop === "antiques" ? "antiques" : null;
      if (!okKey(item) || !qty || !shop) return json(400, { error: "bad sale" });
      const d = await sellItem(db, pid, item as string, qty, shop, () => c.boostsOf(who, b));
      if (d?.ok && b.mirror === true && !who.wallet && !who.owner) await acctBump(db, who.raw, d.gold | 0); // like map_dig: a logged-in device adds it to its own save
      return reply(d);
    }
    case "inv_gift": {
      const item = b.item, qty = qtyOf(b.qty); let to = typeof b.to === "string" ? b.to : "";
      if (!okKey(item) || !qty || !to) return json(400, { error: "bad gift" });
      if (!/^(wallet:|dev:)/.test(to)) { const { data: hits } = await db.from("pvp_players").select("id").eq("name", to.slice(0, 20)).limit(2); if (hits && hits.length > 1) return json(409, { error: "name not unique" });
        if (hits?.length === 1) to = hits[0].id; else { const r = await nameFallback(db, to); if (!r) return json(409, { error: "no such pirate" }); to = r; } }
      // [v335] weapons too (049): one copy at a time; a musket's fitted attachments travel with its gid
      const gid = typeof b.gid === "string" && /^[0-9a-f-]{36}$/i.test(b.gid) ? b.gid : null;
      if (/^wpn:/.test(item as string) && qty !== 1) return json(400, { error: "one weapon at a time" });
      return reply(await rpc("pvp_inv_gift", { p_from: pid, p_to: to, p_item: item, p_qty: qty, p_gid: gid }));
    }
    case "inv_fish": { const seed = pid + ":" + crypto.randomUUID(), f = rollFish(seed), d = await rpc("pvp_fish_catch", { p_player: pid, p_fish: f });
      const extra = d?.ok ? await gunDropRpc(db, pid, "f:" + seed.slice(-36), "fish") : []; // [Emerly musket-rank] parts from fishing
      return reply(d?.ok ? { ...d, cm: rollCm(seed, f), extra } : d); } // [fish2] + the length (old clients ignore it)
    case "inv_fish_bite": case "inv_fish_land": { // [fish2] reel tickets: closed unless pvp_flags fish_reel is on
      const { data: fl } = await db.from("pvp_flags").select("on_").eq("k", "fish_reel").limit(1); if (!fl?.[0]?.on_) return json(409, { error: "reel closed" });
      const secret = FISH_SECRET(); if (!secret) return json(503, { error: "reel closed" });
      if (action === "inv_fish_bite") { if (!(await rpc("pvp_rl_hit", { p_key: "fishb:" + pid, p_window_s: 4, p_max: 1 }))) return json(409, { error: "slow down" });
        const n = crypto.randomUUID(), seed = pid + ":" + n, f = rollFish(seed), cm = rollCm(seed, f);
        return json(200, { ok: true, rarity: (FISH as any)[f.slice(5)].rarity, ticket: await signFishTicket(secret, { p: pid, f, cm, n, at: Date.now() }) }); }
      const t = await readFishTicket(secret, b.ticket, pid, Date.now()); if (!t.ok) return json(409, { error: t.why });
      const { error: dup } = await db.from("pvp_inv_once").insert({ player_id: pid, k: "fishq:" + t.n }); if (dup) return json(409, { error: "used" }); // one landing per ticket
      const d = await rpc("pvp_fish_catch", { p_player: pid, p_fish: t.f }); const extra = d?.ok ? await gunDropRpc(db, pid, "f:" + t.n, "fish") : []; return reply(d?.ok ? { ...d, cm: t.cm, extra } : d); }
    case "inv_find": { const item = b.item === "val:river_pearl" ? "val:river_pearl" : b.item === "val:idol_shard" ? "val:idol_shard" : null; const spot = String(b.spot ?? "");
      if (!item || !/^(jungle_shard_\d{1,2}|lagoon_p(_grotto|\d))$/.test(spot)) return json(400, { error: "bad find" });
      return reply(await rpc("pvp_inv_find", { p_player: pid, p_item: item, p_spot: spot })); }
    case "inv_ruin_chest": { const spot = String(b.spot ?? ""); if (!(RUIN_CHESTS as string[]).includes(spot)) return json(400, { error: "bad chest" });   // [ruins] server rolls the common chest table
      const T = (CHEST_VALUABLES as any).common as Record<string, number>; let r = crypto.getRandomValues(new Uint32Array(1))[0] % 1000, item = "val:silver_ring";
      for (const [k, w] of Object.entries(T)) { if (r < w) { item = "val:" + k; break; } r -= w; }
      return json(200, (await rpc("pvp_inv_find", { p_player: pid, p_item: item, p_spot: spot })) ?? { ok: false, why: "refused" }); }   // 200 + why: the client shows "empty" / "need N"
    case "inv_idol_forge": return json(200, (await rpc("pvp_inv_idol_forge", { p_player: pid, p_need: IDOL_SHARDS })) ?? { ok: false, why: "refused" });   // [ruins] 21 shards -> Golden Idol
    case "inv_musk_rank": { const item = String(b.item ?? ""), m = /^wpn:musket:[a-z_]{2,16}:(common|rare|epic)$/.exec(item); if (!m) return json(400, { error: "bad item" });
      const c = RANK_UP[m[1]]; return reply(await rpc("pvp_inv_musk_rank", { p_player: pid, p_item: item, p_gold: c.gold, p_parts: c.parts, p_owner: who.owner })); }
    case "inv_musk_level": { // [musket-levels] 061: one copy -> the next level; SQL owns the price (pvp_musk_lv_cost = catalog muskLevelCost)
      const item = String(b.item ?? ""), lv = muskLevelOf(item); if (!lv) return json(400, { error: "bad item" }); if (lv >= 20) return json(409, { error: "max level" });
      const gid = typeof b.gid === "string" && /^[0-9a-f-]{36}$/i.test(b.gid) ? b.gid : null;
      return reply(await rpc("pvp_inv_musk_level", { p_player: pid, p_item: item, p_gid: gid, p_owner: who.owner })); }
    case "inv_musk_salvage": { const item = String(b.item ?? ""), lv = muskLevelOf(item); if (!lv) return json(400, { error: "bad item" }); // [musket-levels] any level; parts by its rarity
      return reply(await rpc("pvp_inv_musk_salvage", { p_player: pid, p_item: item, p_parts: SALVAGE_PARTS[muskTierOf(lv)] })); }
    case "inv_buy_acc": { const item = String(b.item ?? ""); if (!ACC_PRICE[item]) return json(400, { error: "not for sale" });
      return reply(await rpc("pvp_inv_buy_acc", { p_player: pid, p_item: item, p_price: ACC_PRICE[item], p_owner: who.owner })); }
    case "inv_equip": { // a weapon from the grid: the server checks you hold it, then records the rarity (gear slot = its base)
      const item = String(b.item ?? ""), info = itemInfo(item); if (!info || info.kind !== "weapon") return json(400, { error: "not a weapon" });
      const { data: have } = await db.from("pvp_inv").select("qty").eq("player_id", pid).eq("item", item).limit(1);
      if (!who.owner && !(have && have.length)) return json(409, { error: "not yours" });
      const { error } = await db.from("pvp_inv_equip").upsert({ player_id: pid, slot: info.slot, item }); if (error) throw error;
      return json(200, { ok: true, slot: info.slot, base: info.base, rarity: info.rarity }); }
    case "inv_unequip": { // [rare-equip] back to your WEAPON STORE / default weapon: the found weapon's rarity stops applying (it stays in the bag)
      const slot = b.slot === "sword" ? "sword" : b.slot === "musket" ? "musket" : null; if (!slot) return json(400, { error: "bad slot" });
      const { error } = await db.from("pvp_inv_equip").delete().eq("player_id", pid).eq("slot", slot); if (error) throw error;
      return json(200, { ok: true, slot }); }
    case "gun_acc_set": { // [v332] fit/detach attachment on a specific musket instance
      const gid = String(b.gid ?? ""), slot = String(b.slot ?? ""), key = b.key == null || b.key === "" ? null : String(b.key);
      if (!/^[0-9a-f-]{36}$/i.test(gid) || !["scope","bayonet","stock","horn"].includes(slot)) return json(400, { error: "bad gun" });
      if (key && !ACC_PRICE[key]) return json(400, { error: "bad key" });
      return reply(await rpc("pvp_gun_acc_set", { p_player: pid, p_gid: gid, p_slot: slot, p_key: key })); }
    case "gun_equip": { // [v332] equip a specific musket instance (keeps each copy's acc)
      const gid = String(b.gid ?? ""); if (!/^[0-9a-f-]{36}$/i.test(gid)) return json(400, { error: "bad gun" });
      return reply(await rpc("pvp_gun_equip", { p_player: pid, p_gid: gid })); }
    case "inv_online": return reply(await onlineAction(db, pid, { detail: !!b?.detail })); // [give-dropdown] / [squad-hall] detail = world labels
    case "squad_invite": case "squad_invites": case "squad_invite_ack": {
      const { data: me } = await db.from("pvp_players").select("name").eq("id", pid).maybeSingle();
      return reply(await squadAction(db, pid, me?.name || "", action, b));
    }
    case "inv_pot": { const g = Number(await rpc("pvp_inv_pot_take", { p_player: pid })) || 0; // Marketplace proceeds (+ the owner's sales / buys) -> this save
      if (g && b.mirror === true && !who.wallet && !who.owner) await acctBump(db, who.raw, g); return json(200, { ok: true, gold: g }); }
    case "mkt_browse": { const { data } = await db.from("pvp_mkt_listings").select("id, seller_id, item, qty, price, created_at").eq("status", "open").order("price", { ascending: true }).order("created_at", { ascending: true }).limit(100); // [v240] cheapest first (was newest first)
      const { data: names } = await db.from("pvp_players").select("id, name").in("id", [...new Set((data || []).map((l: any) => l.seller_id))]);
      const nm = new Map((names || []).map((n: any) => [n.id, n.name]));
      const ids = (data || []).filter((l: any) => l.item.startsWith("par:")).map((l: any) => l.item.slice(4));
      const { data: birds } = ids.length ? await db.from("pvp_parrots").select("id,name,xp,color").in("id", ids) : { data: [] };
      const birdMap = new Map((birds || []).map((p: any) => ["par:" + p.id, p]));
      return json(200, { ok: true, listings: (data || []).map((l: any) => ({ id: l.id, parrot: birdMap.get(l.item) || null, item: l.item, qty: l.qty, price: l.price, seller: nm.get(l.seller_id) || "PIRATE", mine: l.seller_id === pid })), limits: MARKET }); }
    case "mkt_list": { const item = b.item, qty = qtyOf(b.qty), price = Math.floor(Number(b.price)); if (!okKey(item) || !qty || !Number.isFinite(price)) return json(400, { error: "bad listing" });
      return reply(await rpc("pvp_mkt_list", { p_player: pid, p_item: item, p_qty: qty, p_price: price })); }
    case "mkt_buy": { const id = Math.floor(Number(b.listing)); if (!(id > 0)) return json(400, { error: "bad listing" }); const d = await rpc("pvp_mkt_buy", { p_player: pid, p_listing: id });
      if (d?.ok && b.mirror === true && !who.wallet && !who.owner) await acctBump(db, who.raw, -(d.price | 0)); return reply(d); }
    case "mkt_cancel": { const id = Math.floor(Number(b.listing)); if (!(id > 0)) return json(400, { error: "bad listing" }); return reply(await rpc("pvp_mkt_cancel", { p_player: pid, p_listing: id })); }
  }
  return json(400, { error: "unknown action" });
}
export { OWNER_MAIN };

// [gift-fix] additive: the name a player sees in the harbor is the save's display name, but 015 unique names can register it shortened
// with a suffix ("Trav The Tracker" -> "Trav The Track #1545"). Exact lookup misses -> ONE registered name whose base (without " #n")
// starts the typed name is the pirate, and only a name 015 CUT to fit (suffixed, 19-20 chars: "Bobby" never lands on "Bob #12"); none or several = no match (never a guess).
export const nameBase = (n: string) => String(n).replace(/\s*#\d+$/, "").toLowerCase();
export function pickByBase(typed: string, rows: { id: string; name: string }[]) {
  const l = String(typed).toLowerCase(), m = (rows || []).filter((r) => { const n = String(r.name); if (!/\s#\d+$/.test(n) || n.length < 19) return false; const b = nameBase(n); return b.length >= 3 && l.startsWith(b); }); // only a name 015 cut short + suffixed
  return m.length === 1 ? m[0].id : null;
}
async function nameFallback(db: any, typed: string) {
  const head = typed.slice(0, 3).replace(/[\\%_]/g, (c) => "\\" + c); if (head.length < 3) return null;
  const { data } = await db.from("pvp_players").select("id, name").ilike("name", head + "%").limit(500);
  return pickByBase(typed, data || []);
}
