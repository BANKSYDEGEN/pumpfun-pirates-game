// [storage-houses] Buyable cottages + house chest storage (migration 043). Wired from index.ts.
// Actions: house_state, house_buy, house_store, house_take, house_upgrade. Offline clients fall back to localStorage.
import { KEY_RE } from "./invCatalog.ts";
import { BACKPACK_CAP, countSlots, needsNewSlot } from "./loot.ts"; // [backpack-pvp]

export const HOUSE_ACTIONS = ["house_state", "house_buy", "house_store", "house_take", "house_upgrade"] as const;
export type HouseAction = (typeof HOUSE_ACTIONS)[number];

export const HOUSE_PRICE = 2500;
export const UPGRADE_PRICE = 1500;
export const UPGRADE_SLOTS = 16;
export const TIER_SLOTS: Record<string, number> = { cozy: 24, captain: 40, manor: 60 };
export const COTTAGE_IDS = ["balcony", "dormer", "gabled", "garden"] as const;

const okCottage = (id: unknown) => typeof id === "string" && COTTAGE_IDS.includes(id as any);
const okKey = (k: unknown) => typeof k === "string" && KEY_RE.test(k);
const qtyOf = (q: unknown) => { const n = Math.floor(Number(q)); return Number.isFinite(n) && n >= 1 && n <= 999 ? n : 0; };
const reqOf = (r: unknown) => typeof r === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(r) ? r : "";

type Ctx = {
  db: any;
  whoAmI: (b: Record<string, unknown>) => Promise<any>;
  json: (status: number, body: Record<string, unknown>) => Response;
  acctBump?: (db: any, raw: string, delta: number) => Promise<void>;
};

async function loadHouse(db: any, pid: string, cottage: string) {
  const { data: h } = await db.from("pvp_houses").select("cottage_id, tier, slots, purchased_at").eq("player_id", pid).eq("cottage_id", cottage).maybeSingle();
  if (!h) return null;
  const { data: rows } = await db.from("pvp_house_storage").select("slot, item, qty, meta").eq("player_id", pid).eq("cottage_id", cottage).order("slot");
  return { cottage: h.cottage_id, tier: h.tier, slots: h.slots | 0, purchased_at: h.purchased_at, items: (rows || []).map((r: any) => ({ slot: r.slot | 0, item: r.item, qty: r.qty | 0, meta: r.meta || {} })) };
}

export async function houseAction(c: Ctx, action: string, b: Record<string, unknown>): Promise<Response> {
  const who = await c.whoAmI(b); if (!who) return c.json(401, { error: "no identity" });
  const pid = who.pid, db = c.db;

  try {
    switch (action) {
      case "house_state": {
        const { data: rows } = await db.from("pvp_houses").select("cottage_id, tier, slots, purchased_at").eq("player_id", pid);
        const owned: Record<string, unknown> = {};
        for (const h of rows || []) {
          const full = await loadHouse(db, pid, h.cottage_id);
          if (full) owned[h.cottage_id] = full;
        }
        return c.json(200, { ok: true, price: HOUSE_PRICE, upgrade: UPGRADE_PRICE, tiers: TIER_SLOTS, owned, owner: !!who.owner });
      }
      case "house_buy": {
        const cottage = String(b.cottage ?? ""); if (!okCottage(cottage)) return c.json(400, { error: "bad cottage" });
        const tier = String(b.tier ?? "cozy"); const slots = TIER_SLOTS[tier] || TIER_SLOTS.cozy;
        const req = reqOf(b.req); if (!req) return c.json(400, { error: "bad request" });
        const { data, error } = await db.rpc("pvp_house_buy", { p_player: pid, p_cottage: cottage, p_tier: tier in TIER_SLOTS ? tier : "cozy", p_slots: slots, p_price: HOUSE_PRICE, p_req: req });
        if (error) {
          if (/pvp_house_buy|PGRST202|42883/.test(`${error.code} ${error.message}`)) return c.json(409, { error: "closed" });
          throw error;
        }
        if (!data?.ok) return c.json(data?.why === "not enough gold" ? 402 : 409, { error: data?.why || "could not", gold: data?.gold });
        if (!who.wallet && !who.owner && !data.owner && !data.retry && !data.already) await c.acctBump?.(db, who.raw, -HOUSE_PRICE);
        const full = await loadHouse(db, pid, cottage);
        return c.json(200, { ok: true, owner: !!data.owner, price: data.owner || data.already ? 0 : HOUSE_PRICE, gold: data.gold, rev: data.rev, retry: !!data.retry, already: !!data.already, house: full });
      }
      case "house_store": {
        const cottage = String(b.cottage ?? ""), item = b.item, qty = qtyOf(b.qty);
        if (!okCottage(cottage) || !okKey(item) || !qty) return c.json(400, { error: "bad store" });
        const { data, error } = await db.rpc("pvp_house_store", { p_player: pid, p_cottage: cottage, p_item: item, p_qty: qty });
        if (error) {
          if (/pvp_house_store|PGRST202|42883/.test(`${error.code} ${error.message}`)) return c.json(409, { error: "closed" });
          throw error;
        }
        if (!data?.ok) return c.json(409, { error: data?.why || "could not" });
        return c.json(200, { ok: true, ...data, house: await loadHouse(db, pid, cottage) });
      }
      case "house_take": {
        const cottage = String(b.cottage ?? ""), slot = Math.floor(Number(b.slot)), qty = qtyOf(b.qty) || 1;
        if (!okCottage(cottage) || !Number.isFinite(slot) || slot < 0 || slot > 119) return c.json(400, { error: "bad take" });
        // [backpack-pvp] enforce 16-slot backpack cap (owner unlimited; stacking onto existing stackable OK)
        if (!who.owner) {
          const { data: invRows } = await db.from("pvp_inv").select("item, qty").eq("player_id", pid);
          const { data: eqRows } = await db.from("pvp_inv_equip").select("slot, item").eq("player_id", pid);
          const stack = new Map<string, number>();
          for (const r of invRows || []) stack.set(r.item, (stack.get(r.item) || 0) + (r.qty | 0));
          const inv = [...stack.entries()].map(([item, q]) => ({ item, qty: q }));
          const equipped = Object.fromEntries((eqRows || []).map((e: any) => [e.slot, e.item]));
          const { data: chestRow } = await db.from("pvp_house_storage").select("item, qty").eq("player_id", pid).eq("cottage_id", cottage).eq("slot", slot).maybeSingle();
          if (chestRow?.item) {
            const used = countSlots(inv, equipped);
            if (needsNewSlot(inv, chestRow.item, equipped) && used >= BACKPACK_CAP) {
              return c.json(409, { error: "Backpack full (16/16) — stash or sell items first!", full: true, used, cap: BACKPACK_CAP });
            }
          }
        }
        // Prefer capped RPC when migration 044 is live; fall back to uncapped take
        let data: any = null, error: any = null;
        ({ data, error } = await db.rpc("pvp_house_take_capped", { p_player: pid, p_cottage: cottage, p_slot: slot, p_qty: qty, p_cap: BACKPACK_CAP, p_owner: !!who.owner }));
        if (error && /pvp_house_take_capped|PGRST202|42883/.test(`${error.code} ${error.message}`)) {
          ({ data, error } = await db.rpc("pvp_house_take", { p_player: pid, p_cottage: cottage, p_slot: slot, p_qty: qty }));
        }
        if (error) {
          if (/pvp_house_take|PGRST202|42883/.test(`${error.code} ${error.message}`)) return c.json(409, { error: "closed" });
          throw error;
        }
        if (!data?.ok) return c.json(409, { error: data?.why || "could not", full: !!data?.full });
        return c.json(200, { ok: true, ...data, house: await loadHouse(db, pid, cottage), owner: !!who.owner });
      }
      case "house_upgrade": {
        const cottage = String(b.cottage ?? ""); if (!okCottage(cottage)) return c.json(400, { error: "bad cottage" });
        const req = reqOf(b.req); if (!req) return c.json(400, { error: "bad request" });
        const { data, error } = await db.rpc("pvp_house_upgrade", { p_player: pid, p_cottage: cottage, p_add: UPGRADE_SLOTS, p_price: UPGRADE_PRICE, p_req: req });
        if (error) {
          if (/pvp_house_upgrade|PGRST202|42883/.test(`${error.code} ${error.message}`)) return c.json(409, { error: "closed" });
          throw error;
        }
        if (!data?.ok) return c.json(data?.why === "not enough gold" ? 402 : 409, { error: data?.why || "could not", gold: data?.gold });
        if (!who.wallet && !who.owner && !data.owner && !data.retry) await c.acctBump?.(db, who.raw, -UPGRADE_PRICE);
        return c.json(200, { ok: true, owner: !!data.owner, price: data.owner ? 0 : UPGRADE_PRICE, gold: data.gold, rev: data.rev, retry: !!data.retry, slots: data.slots, house: await loadHouse(db, pid, cottage) });
      }
      default:
        return c.json(400, { error: "bad action" });
    }
  } catch (e: any) {
    console.error("[houses]", action, e?.message || e);
    return c.json(500, { error: "house error" });
  }
}
