// [backpack-pvp] PvP loot bags: drop unequipped haul on on-foot PvP death; claim with 16-slot backpack cap.
// BANKSY / who.owner = unlimited slots. Migration 044. Kill switch via pvp_flags 'pvploot'.
import { KEY_RE } from "./invCatalog.ts";
import { OWNER_MAIN } from "./lib.ts";

export const LOOT_ACTIONS = ["pvp_drop_haul", "pvp_claim_loot", "pvp_loot_list", "pvp_manual_drop", "pvp_loot_status"] as const;
export type LootAction = (typeof LOOT_ACTIONS)[number];

export const LOOT_TTL_S = 120;
export const BACKPACK_CAP = 16;

const okKey = (k: unknown) => typeof k === "string" && KEY_RE.test(k);
const qtyOf = (q: unknown) => { const n = Math.floor(Number(q)); return Number.isFinite(n) && n >= 1 && n <= 9999 ? n : 0; };
const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

type Who = { raw: string; pid: string; wallet: string | null; owner: boolean };
type Ctx = {
  db: any;
  whoAmI: (b: Record<string, unknown>) => Promise<Who | null>;
  json: (status: number, body: Record<string, unknown>) => Response;
};

/** Mirror client backpackCap.js: stacks = 1 slot; equipped sword/musket excluded; weapons 1 each. */
export function countSlots(rows: { item: string; qty: number }[], equipped: Record<string, string> = {}) {
  const skip = new Map<string, number>();
  if (equipped.sword) skip.set(equipped.sword, (skip.get(equipped.sword) || 0) + 1);
  if (equipped.musket) skip.set(equipped.musket, (skip.get(equipped.musket) || 0) + 1);
  let n = 0;
  for (const r of rows) {
    let qty = Math.max(0, r.qty | 0); if (!qty || !r.item || r.item.startsWith("map:")) continue;
    const sk = skip.get(r.item) || 0;
    if (sk > 0) { const use = Math.min(sk, qty); skip.set(r.item, sk - use); qty -= use; if (!qty) continue; }
    if (r.item.startsWith("wpn:")) n += qty; else n += 1;
  }
  return n;
}

export function needsNewSlot(rows: { item: string; qty: number }[], item: string, equipped: Record<string, string> = {}) {
  if (item.startsWith("wpn:")) return true;
  let qty = 0;
  for (const r of rows) if (r.item === item) qty += r.qty | 0;
  if (equipped.sword === item) qty = Math.max(0, qty - 1);
  if (equipped.musket === item) qty = Math.max(0, qty - 1);
  return qty <= 0;
}

export function splitForCap(
  bagItems: { item: string; qty: number }[],
  looter: { item: string; qty: number }[],
  equipped: Record<string, string>,
  unlimited: boolean,
) {
  const take: { item: string; qty: number }[] = [], left: { item: string; qty: number }[] = [];
  let cur = looter.map((r) => ({ item: r.item, qty: r.qty | 0 }));
  for (const row of bagItems) {
    const key = row.item; let qty = row.qty | 0; if (!key || !qty) continue;
    if (unlimited) { take.push({ item: key, qty }); continue; }
    let got = 0;
    while (qty > 0) {
      const step = key.startsWith("wpn:") ? 1 : qty;
      const used = countSlots(cur, equipped);
      const need = needsNewSlot(cur, key, equipped) ? step : 0;
      // stacking onto existing stackable: need=0 when already held
      if (needsNewSlot(cur, key, equipped)) {
        if (used + (key.startsWith("wpn:") ? 1 : 1) > BACKPACK_CAP) break;
      }
      got += step; qty -= step;
      const ex = cur.find((r) => r.item === key);
      if (ex && !key.startsWith("wpn:")) ex.qty += step; else cur.push({ item: key, qty: step });
    }
    if (got > 0) take.push({ item: key, qty: got });
    if (qty > 0) left.push({ item: key, qty });
  }
  return { take, left };
}

async function loadInv(db: any, pid: string) {
  const { data: rows } = await db.from("pvp_inv").select("item, qty").eq("player_id", pid);
  const stack = new Map<string, number>();
  for (const r of rows || []) stack.set(r.item, (stack.get(r.item) || 0) + (r.qty | 0));
  return [...stack.entries()].map(([item, qty]) => ({ item, qty }));
}

async function loadEquip(db: any, pid: string) {
  const { data: eq } = await db.from("pvp_inv_equip").select("slot, item").eq("player_id", pid);
  return Object.fromEntries((eq || []).map((e: any) => [e.slot, e.item]));
}

export async function lootAction(c: Ctx, action: string, b: Record<string, unknown>): Promise<Response> {
  const who = await c.whoAmI(b); if (!who) return c.json(401, { error: "no identity" });
  const pid = who.pid, db = c.db;

  try {
    // Feature flag (missing row = on, so local/dev works before migration)
    const { data: fl } = await db.from("pvp_flags").select("on_").eq("k", "pvploot").maybeSingle();
    if (fl && fl.on_ === false) return c.json(409, { error: "closed" });

    switch (action) {
      case "pvp_loot_list": {
        const room = typeof b.room === "string" ? b.room.slice(0, 24) : "island";
        const { data } = await db.from("pvp_loot_bags")
          .select("id, x, y, z, room, victim_id, victim_name, killer_id, items, expires_at")
          .eq("room", room).gt("expires_at", new Date().toISOString()).order("expires_at").limit(24);
        return c.json(200, { ok: true, bags: data || [], owner: !!who.owner, cap: who.owner ? null : BACKPACK_CAP });
      }
      case "pvp_drop_haul": {
        const x = num(b.x), y = num(b.y), z = num(b.z);
        const room = b.sea === true ? "sea" : typeof b.room === "string" ? b.room.slice(0, 24) : "island"; // [backpack-pvp] Option B sea crates
        const killer_id = typeof b.killer_id === "string" ? b.killer_id.slice(0, 64) : "";
        let victim_name = typeof b.victim_name === "string" ? b.victim_name.slice(0, 24) : "";
        if (!victim_name) {
          const { data: me } = await db.from("pvp_players").select("name").eq("id", pid).maybeSingle();
          victim_name = (me?.name || "PIRATE").slice(0, 24);
        }
        if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 5000 || Math.abs(z) > 5000) {
          return c.json(400, { error: "bad pos" });
        }
        // Prefer server inventory + equipped (client list is a hint only)
        const equipped = await loadEquip(db, pid);
        const inv = await loadInv(db, pid);
        const drop: { item: string; qty: number }[] = [];
        const skip = new Map<string, number>();
        if (equipped.sword) skip.set(equipped.sword, 1);
        if (equipped.musket) skip.set(equipped.musket, (skip.get(equipped.musket) || 0) + 1);
        for (const r of inv) {
          let qty = r.qty | 0; const sk = skip.get(r.item) || 0;
          if (sk > 0) { const use = Math.min(sk, qty); skip.set(r.item, sk - use); qty -= use; }
          if (qty > 0 && okKey(r.item)) drop.push({ item: r.item, qty });
        }
        if (!drop.length) return c.json(200, { ok: true, bag: null, remainingInventory: inv, empty: true });

        // Move haul out of inventory into the bag (atomic-ish: take each stack)
        for (const it of drop) {
          try { await db.rpc("pvp_inv_take", { p_pid: pid, p_item: it.item, p_qty: it.qty, p_why: "pvp_drop", p_ref: "loot" }); }
          catch { /* soft: continue */ }
        }
        const expires = new Date(Date.now() + LOOT_TTL_S * 1000).toISOString();
        const id = crypto.randomUUID();
        const row = {
          id, x, y, z, room, victim_id: pid, victim_name, killer_id: killer_id || null,
          items: drop, expires_at: expires,
        };
        const { error } = await db.from("pvp_loot_bags").insert(row);
        if (error) {
          // Soft-fail offline-shaped reply so clients can still local-drop
          if (/pvp_loot_bags|42P01|PGRST/.test(`${error.code} ${error.message}`)) {
            return c.json(409, { error: "closed", soft: true });
          }
          throw error;
        }
        const remaining = await loadInv(db, pid);
        return c.json(200, { ok: true, bag: row, remainingInventory: remaining, owner: !!who.owner });
      }
      case "pvp_loot_status": {
        const { data, error } = await db.rpc("pvp_manual_loot_status", { p_room: String(b.room_key || "").slice(0, 64) });
        if (error) return c.json(200, { ok: true, manualDrops: false, bags: [] });
        return c.json(200, data);
      }
      case "pvp_manual_drop": {
        const item = b.item, qty = Number(b.qty);
        const pos = [b.x, b.y, b.z].map(Number);
        if (!okKey(item) || String(item).startsWith("par:") || !Number.isInteger(qty) || qty < 1 || qty > 999 ||
            !pos.every(Number.isFinite) || !/^[0-9a-f-]{36}$/.test(String(b.drop_id || ""))) return c.json(400, { error: "bad drop" });
        const { data, error } = await db.rpc("pvp_manual_drop", {
          p_pid: pid, p_item: item, p_qty: qty, p_x: pos[0], p_y: pos[1], p_z: pos[2],
          p_room: String(b.room_key || "").slice(0, 64), p_sea: b.sea === true, p_id: b.drop_id,
          p_gid: typeof b.gid === "string" ? b.gid : null,
        });
        if (error) return c.json(409, { error: "Drop unavailable — try again after reloading" });
        return c.json(data?.ok ? 200 : 409, data || { error: "Drop unavailable" });
      }
      case "pvp_claim_loot": {
        if (!/^[0-9a-f-]{36}$/.test(String(b.bag_id || ""))) return c.json(400, { error: "bad bag" });
        const { data, error } = await db.rpc("pvp_claim_loot_atomic", {
          p_pid: pid, p_bag: b.bag_id, p_room: String(b.room_key || "").slice(0, 64),
          p_owner: !!who.owner || pid === OWNER_MAIN,
        });
        if (error) return c.json(409, { error: "Loot unavailable — try again shortly" });
        return c.json(data?.ok ? 200 : 409, data || { error: "gone" });
      }
      default:
        return c.json(400, { error: "bad action" });
    }
  } catch (e: any) {
    console.error("[loot]", action, e?.message || e);
    return c.json(500, { error: "loot error" });
  }
}
