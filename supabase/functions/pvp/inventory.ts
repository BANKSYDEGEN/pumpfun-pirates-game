// [inventory] Edge actions for THE INVENTORY (migration 036). Every rule lives in SQL (atomic, locked); this file only resolves who is
// asking (index.ts whoAmI), rolls server-side things (fish, chest items) and shapes replies. Client values are never trusted for
// prices, qty ownership, multipliers or recipients.
import { sellItem, OWNER_MAIN } from "./lib.ts";
import { FISH, FISH_WEIGHT, VALUABLES, WEAPON_BASES, WEAPON_TIERS, KEY_RE, itemInfo, MARKET } from "./invCatalog.ts";
import { chestRoll } from "./chest.ts";
import { acctBump } from "./accounts.ts";
type Who = { raw: string; pid: string; wallet: string | null; owner: boolean };
type Ctx = { db: any; whoAmI: (b: Record<string, unknown>) => Promise<Who | null>; boostsOf: (who: Who, b: Record<string, unknown>) => Promise<Record<string, number>>; json: (s: number, o: unknown) => Response; mapSpots: string[] };
export const INV_ACTIONS = ["inv_state", "inv_sell", "inv_gift", "inv_fish", "inv_find", "inv_equip", "inv_pot", "mkt_browse", "mkt_list", "mkt_buy", "mkt_cancel"];
const okKey = (k: unknown) => typeof k === "string" && (KEY_RE.test(k) || /^map:[0-9a-f-]{36}$/.test(k));
const qtyOf = (q: unknown) => { const n = Math.floor(Number(q)); return Number.isFinite(n) && n >= 1 && n <= 100000 ? n : 0; };
// every item the owner test kit holds (~3 of each): fish, valuables, weapons at every rarity (maps are added by SQL)
export const ownerKitItems = () => [...Object.keys(FISH).map((f) => `fish:${f}`), ...Object.keys(VALUABLES).map((v) => `val:${v}`),
  ...Object.entries(WEAPON_BASES).flatMap(([s, bs]) => (bs as string[]).flatMap((b) => WEAPON_TIERS.map((t: string) => `wpn:${s}:${b}:${t}`)))];
// the server's fish roll (lagoon journal weights), seeded by a server nonce: the client only says "I reeled in"
export function rollFish(seed: string) { const tot = Object.values(FISH_WEIGHT).reduce((a: number, b: any) => a + b, 0) as number; let r = (chestRoll("fish:" + seed) * 1000 + chestRoll("fish2:" + seed)) % tot;
  for (const [id, w] of Object.entries(FISH_WEIGHT)) { if (r < (w as number)) return `fish:${id}`; r -= w as number; } return "fish:minnow"; }
export async function inventoryAction(c: Ctx, action: string, b: Record<string, unknown>): Promise<Response> {
  const { db, json } = c; const who = await c.whoAmI(b); if (!who) return json(401, { error: "no identity" });
  const pid = who.pid, rpc = async (fn: string, args: Record<string, unknown>) => { const { data, error } = await db.rpc(fn, args); if (error) throw error; return data; };
  const reply = (d: any) => d?.ok ? json(200, d) : json(409, { error: d?.why || "refused" });
  switch (action) {
    case "inv_state": {
      await rpc("pvp_inv_carry", { p_player: pid });                                    // owned swords / muskets show up (once each)
      if (who.owner) await rpc("pvp_inv_owner_kit", { p_player: pid, p_items: ownerKitItems(), p_spots: c.mapSpots }); // once, owner only
      const { data: rows } = await db.from("pvp_inv").select("item, source, qty").eq("player_id", pid);
      const { data: maps } = await db.from("pvp_maps").select("id, tier, spot, source, created_at").eq("player_id", pid).is("dug_at", null).order("created_at").limit(200);
      const { data: eq } = await db.from("pvp_inv_equip").select("slot, item").eq("player_id", pid);
      const { data: flags } = await db.from("pvp_flags").select("k, on_");
      const stack = new Map<string, { item: string; qty: number; tradeable: number; kit: number }>();
      for (const r of rows || []) { const s = stack.get(r.item) || { item: r.item, qty: 0, tradeable: 0, kit: 0 }; s.qty += r.qty; if (r.source !== "carry_buy") s.tradeable += r.qty; if (r.source === "kit") s.kit += r.qty; stack.set(r.item, s); }
      return json(200, { ok: true, items: [...stack.values()], maps: maps || [], equipped: Object.fromEntries((eq || []).map((e: any) => [e.slot, e.item])), flags: Object.fromEntries((flags || []).map((f: any) => [f.k, f.on_])), owner: who.owner });
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
      if (!/^(wallet:|dev:)/.test(to)) { const { data: hits } = await db.from("pvp_players").select("id").eq("name", to.slice(0, 20)).limit(2); if (!hits || hits.length !== 1) return json(409, { error: hits?.length ? "name not unique" : "no such pirate" }); to = hits[0].id; }
      return reply(await rpc("pvp_inv_gift", { p_from: pid, p_to: to, p_item: item, p_qty: qty }));
    }
    case "inv_fish": return reply(await rpc("pvp_fish_catch", { p_player: pid, p_fish: rollFish(pid + ":" + crypto.randomUUID()) }));
    case "inv_find": { const item = b.item === "val:river_pearl" ? "val:river_pearl" : b.item === "val:idol_shard" ? "val:idol_shard" : null; const spot = String(b.spot ?? "");
      if (!item || !/^(jungle_shard_\d{1,2}|lagoon_p(_grotto|\d))$/.test(spot)) return json(400, { error: "bad find" });
      return reply(await rpc("pvp_inv_find", { p_player: pid, p_item: item, p_spot: spot })); }
    case "inv_equip": { // a weapon from the grid: the server checks you hold it, then records the rarity (gear slot = its base)
      const item = String(b.item ?? ""), info = itemInfo(item); if (!info || info.kind !== "weapon") return json(400, { error: "not a weapon" });
      const { data: have } = await db.from("pvp_inv").select("qty").eq("player_id", pid).eq("item", item).limit(1);
      if (!who.owner && !(have && have.length)) return json(409, { error: "not yours" });
      const { error } = await db.from("pvp_inv_equip").upsert({ player_id: pid, slot: info.slot, item }); if (error) throw error;
      return json(200, { ok: true, slot: info.slot, base: info.base, rarity: info.rarity }); }
    case "inv_pot": { const g = Number(await rpc("pvp_inv_pot_take", { p_player: pid })) || 0; // Marketplace proceeds (+ the owner's sales / buys) -> this save
      if (g && b.mirror === true && !who.wallet && !who.owner) await acctBump(db, who.raw, g); return json(200, { ok: true, gold: g }); }
    case "mkt_browse": { const { data } = await db.from("pvp_mkt_listings").select("id, seller_id, item, qty, price, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(100);
      const { data: names } = await db.from("pvp_players").select("id, name").in("id", [...new Set((data || []).map((l: any) => l.seller_id))]);
      const nm = new Map((names || []).map((n: any) => [n.id, n.name]));
      return json(200, { ok: true, listings: (data || []).map((l: any) => ({ id: l.id, item: l.item, qty: l.qty, price: l.price, seller: nm.get(l.seller_id) || "PIRATE", mine: l.seller_id === pid })), limits: MARKET }); }
    case "mkt_list": { const item = b.item, qty = qtyOf(b.qty), price = Math.floor(Number(b.price)); if (!okKey(item) || !qty || !Number.isFinite(price)) return json(400, { error: "bad listing" });
      return reply(await rpc("pvp_mkt_list", { p_player: pid, p_item: item, p_qty: qty, p_price: price })); }
    case "mkt_buy": { const id = Math.floor(Number(b.listing)); if (!(id > 0)) return json(400, { error: "bad listing" }); const d = await rpc("pvp_mkt_buy", { p_player: pid, p_listing: id });
      if (d?.ok && b.mirror === true && !who.wallet && !who.owner) await acctBump(db, who.raw, -(d.price | 0)); return reply(d); }
    case "mkt_cancel": { const id = Math.floor(Number(b.listing)); if (!(id > 0)) return json(400, { error: "bad listing" }); return reply(await rpc("pvp_mkt_cancel", { p_player: pid, p_listing: id })); }
  }
  return json(400, { error: "unknown action" });
}
export { OWNER_MAIN };
