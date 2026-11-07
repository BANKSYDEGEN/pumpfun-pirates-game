// [admin-menu] PUMPFUN PIRATES · the OWNER's Admin Menu, server half (migration 045). Wired from index.ts (ADMIN_ACTIONS).
// OWNER ONLY (who.owner = pid === OWNER_MAIN, decided by index.ts whoAmI from the signed session / device key, never the body):
//   admin_status · admin_players · admin_freeze · admin_pocket_get · admin_pocket_take · admin_pocket_give · admin_pocket_gold  -> 403 for anyone else
// ANY PIRATE, about THEMSELVES only:
//   admin_register_net (their own net id -> their pid, for the owner's roster) · admin_my_state (am I frozen? read from pvp_admin_controls)
// A Realtime 'adm' poke from the owner's client only makes the target re-ask admin_my_state / its inventory: nothing a peer
// broadcasts can freeze anyone or move an item.
import { KEY_RE, itemInfo } from "./invCatalog.ts";
import { mergeWorld, worldOf } from "./adminWorld.ts"; // [v346] owner sky / weather + collision edits (pvp_terrain.pieces)

export const ADMIN_ACTIONS = ["admin_status", "admin_players", "admin_freeze", "admin_pocket_get", "admin_pocket_take", "admin_pocket_give", "admin_pocket_gold", "admin_register_net", "admin_my_state", "admin_world_get", "admin_world_put"] as const;
export const OWNER_ACTIONS = ["admin_status", "admin_players", "admin_freeze", "admin_pocket_get", "admin_pocket_take", "admin_pocket_give", "admin_pocket_gold", "admin_world_put"];
export const PRESENCE_FRESH_S = 45, FREEZE_MAX_S = 3600, FREEZE_DEFAULT_S = 600;

type Who = { raw: string; pid: string; wallet: string | null; owner: boolean };
type Ctx = { db: any; whoAmI: (b: Record<string, unknown>) => Promise<Who | null>; json: (status: number, body: Record<string, unknown>) => Response; now?: () => number };

export const NET_ID_RE = /^[a-z0-9]{6,20}$/;
export const PID_RE = /^(dev:[0-9a-f]{24}|wallet:[1-9A-HJ-NP-Za-km-z]{32,44}|acct:[A-Za-z0-9_-]{6,64})$/;
const okNet = (v: unknown) => typeof v === "string" && NET_ID_RE.test(v);
const okPid = (v: unknown) => typeof v === "string" && PID_RE.test(v);
const okItem = (k: unknown) => typeof k === "string" && (KEY_RE.test(k) || /^map:[0-9a-f-]{36}$/.test(k));
const qtyOf = (q: unknown, max = 99) => { const n = Math.floor(Number(q)); return Number.isFinite(n) && n >= 1 && n <= max ? n : 0; };
const cleanName = (n: unknown) => String(n ?? "").replace(/[<>&"'`\\\u0000-\u001f]/g, "").trim().slice(0, 20);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : null; };
const isGiveable = (k: string) => KEY_RE.test(k) && !k.startsWith("par:") && (!!itemInfo(k) || /^isl:[a-z_]{2,24}$/.test(k)); // [admin-spawn 062] island goods have no server itemInfo; the SQL regex is the gate

// one pirate's pockets: stacked items (all sources), undug maps, equipped weapons, gold (save + waiting pot)
export async function pocketOf(db: any, pid: string) {
  const [{ data: rows }, { data: maps }, { data: eq }, { data: pot }] = await Promise.all([
    db.from("pvp_inv").select("item, source, qty").eq("player_id", pid),
    db.from("pvp_maps").select("id, tier").eq("player_id", pid).is("dug_at", null).limit(100),
    db.from("pvp_inv_equip").select("slot, item").eq("player_id", pid),
    db.from("pvp_inv_owner_pot").select("gold").eq("player_id", pid).maybeSingle(),
  ]);
  const prof = pid.startsWith("wallet:") ? await db.from("pvp_profiles").select("gold").eq("id", pid).maybeSingle() : await db.from("pvp_dev_profiles").select("gold").eq("id", pid).maybeSingle();
  const stack = new Map<string, { item: string; qty: number }>();
  for (const r of rows || []) { const s = stack.get(r.item) || { item: r.item, qty: 0 }; s.qty += r.qty | 0; stack.set(r.item, s); }
  const items = [...stack.values()].sort((a, b) => a.item.localeCompare(b.item));
  for (const m of maps || []) items.push({ item: `map:${m.id}`, qty: 1 });
  const gold = (prof?.data?.gold | 0), pending = Number(pot?.gold || 0) | 0;
  return { items, equipped: Object.fromEntries((eq || []).map((e: any) => [e.slot, e.item])), gold, pending };
}

// roster: fresh presence rows (net -> pid, where) merged with the lobby heartbeats (harbor copies + arenas) by seat prefix = net id
export function mergeRoster(presence: any[], harbor: any[], arena: any[], now: number, fresh = PRESENCE_FRESH_S) {
  const out = new Map<string, any>();
  for (const r of presence || []) {
    if (!okNet(r?.net_id) || !okPid(r?.pid)) continue; const t = Date.parse(String(r.updated_at ?? "")); if (Number.isFinite(t) && now - t > fresh * 1000) continue;
    out.set(r.net_id, { net: r.net_id, pid: r.pid, name: cleanName(r.name) || "PIRATE", room: String(r.room ?? "").slice(0, 24), mode: String(r.mode ?? "").slice(0, 12), x: num(r.x), y: num(r.y), z: num(r.z), copy: 0, w: "" });
  }
  for (const h of harbor || []) for (const [net, p] of out) if (String(h?.seat ?? "").startsWith(net)) { p.copy = Math.max(0, Math.min(99, Number(h.copy) || 0)); p.w = h.state === "spec" ? "spec" : "harbor"; }
  for (const a of arena || []) for (const [net, p] of out) if (!p.w && String(a?.seat ?? "").startsWith(net)) p.w = a.state === "spec" ? "spec" : a.state === "play" ? "arena" : "queue";
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function adminAction(c: Ctx, action: string, b: Record<string, unknown>): Promise<Response> {
  const { db, json } = c; const now = c.now ? c.now() : Date.now();
  const who = await c.whoAmI(b).catch(() => null);
  if (OWNER_ACTIONS.includes(action) && !who?.owner) return json(403, { error: "Owner only." });
  if (action === "admin_world_get") { // [v346] ANY pirate (no identity needed): the owner's sky / weather + collision edits, read from the SERVER (never from a peer)
    const { data } = await db.from("pvp_terrain").select("pieces, updated_at").eq("id", "island").maybeSingle();
    return json(200, { ok: true, world: worldOf(data?.pieces), at: data?.updated_at ?? null });
  }
  if (!who) return json(401, { error: "no identity" });
  const rpc = async (fn: string, args: Record<string, unknown>) => { const { data, error } = await db.rpc(fn, args); if (error) throw error; return data; };
  try {
    switch (action) {
      case "admin_status": return json(200, { ok: true, owner: true });
      case "admin_register_net": { // any pirate: THEIR OWN net id (pid from whoAmI)
        if (!okNet(b.net_id)) return json(400, { error: "bad net" });
        const d = await rpc("pvp_admin_register", { p_net: b.net_id, p_pid: who.pid, p_name: cleanName(b.name), p_room: String(b.room ?? "").slice(0, 24), p_mode: String(b.mode ?? "").slice(0, 12), p_x: num(b.x), p_y: num(b.y), p_z: num(b.z) });
        return d?.ok ? json(200, { ok: true }) : json(409, { error: d?.why || "refused" });
      }
      case "admin_my_state": { // any pirate: am I frozen? (keyed on MY pid, the net id only narrows nothing)
        const { data: r } = await db.from("pvp_admin_controls").select("frozen, expires_at").eq("target_pid", who.pid).maybeSingle();
        const live = !!r?.frozen && Date.parse(r.expires_at) > now;
        return json(200, { ok: true, frozen: live, until: live ? r.expires_at : null });
      }
      case "admin_players": {
        const since = new Date(now - PRESENCE_FRESH_S * 1000).toISOString();
        const [p, h, a] = await Promise.all([
          db.from("pvp_admin_presence").select("net_id, pid, name, room, mode, x, y, z, updated_at").gt("updated_at", since).limit(500),
          db.from("pvp_harbor_seats").select("seat, copy, state").gt("seen", since).limit(1000),
          db.from("pvp_seats").select("seat, state").gt("seen", since).limit(1000),
        ]);
        const list = mergeRoster(p?.data || [], h?.data || [], a?.data || [], now).filter((x) => x.pid !== who.pid);
        const { data: ctl } = list.length ? await db.from("pvp_admin_controls").select("target_pid, frozen, expires_at").in("target_pid", list.map((x) => x.pid)) : { data: [] };
        const fz = new Set((ctl || []).filter((r: any) => r.frozen && Date.parse(r.expires_at) > now).map((r: any) => r.target_pid));
        return json(200, { ok: true, players: list.map((x) => ({ ...x, frozen: fz.has(x.pid) })) });
      }
      case "admin_freeze": {
        const pid = b.target_pid, net = b.target_net == null ? null : b.target_net;
        if (!okPid(pid) || (net !== null && !okNet(net))) return json(400, { error: "bad target" });
        if (pid === who.pid) return json(400, { error: "not yourself" });
        const frozen = b.frozen === true, secs = Math.max(10, Math.min(FREEZE_MAX_S, Math.floor(Number(b.seconds) || FREEZE_DEFAULT_S)));
        const row = { target_pid: pid, target_net: net, frozen, expires_at: new Date(now + (frozen ? secs : 0) * 1000).toISOString(), updated_at: new Date(now).toISOString() };
        const { error } = await db.from("pvp_admin_controls").upsert(row, { onConflict: "target_pid" }); if (error) throw error;
        return json(200, { ok: true, frozen, until: frozen ? row.expires_at : null });
      }
      case "admin_pocket_get": {
        if (!okPid(b.target_pid)) return json(400, { error: "bad target" });
        return json(200, { ok: true, target: b.target_pid, ...(await pocketOf(db, b.target_pid as string)) });
      }
      case "admin_pocket_take": {
        const pid = b.target_pid, item = b.item, all = b.all === true, qty = all ? 0 : qtyOf(b.qty, 100000);
        if (!okPid(pid) || pid === who.pid || !okItem(item) || (!all && !qty)) return json(400, { error: "bad take" });
        const d = await rpc("pvp_admin_pocket_take", { p_owner: who.pid, p_target: pid, p_item: item, p_qty: qty });
        if (!d?.ok) return json(409, { error: d?.why || "refused" });
        return json(200, { ok: true, took: { item, qty: d.qty | 0 }, target: await pocketOf(db, pid as string), mine: await pocketOf(db, who.pid) });
      }
      case "admin_pocket_give": {
        const pid = b.target_pid, item = b.item, qty = qtyOf(b.qty);
        if (!okPid(pid) || typeof item !== "string" || !isGiveable(item) || !qty) return json(400, { error: "bad give" });
        const d = await rpc("pvp_admin_pocket_give", { p_owner: who.pid, p_target: pid, p_item: item, p_qty: qty });
        if (!d?.ok) return json(409, { error: d?.why || "refused" });
        return json(200, { ok: true, gave: { item, qty }, target: await pocketOf(db, pid as string) });
      }
      case "admin_pocket_gold": {
        const pid = b.target_pid, delta = Math.trunc(Number(b.delta));
        if (!okPid(pid) || pid === who.pid || !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1000000) return json(400, { error: "bad gold" });
        const d = await rpc("pvp_admin_gold", { p_owner: who.pid, p_target: pid, p_delta: delta });
        if (!d?.ok) return json(409, { error: d?.why || "refused" });
        return json(200, { ok: true, delta, target: await pocketOf(db, pid as string) });
      }
      case "admin_world_put": { // [v346] OWNER: merge { id: record | null } ('!env', '!col_*', '!noc_*', '!cmod_*', '!cdel_*') into pvp_terrain.pieces
        for (let tries = 0; tries < 4; tries++) { // optimistic: only writes over the row it read (updated_at), else re-reads; the terrain rev is untouched (Build Mode never 409s)
          const { data: cur } = await db.from("pvp_terrain").select("pieces, updated_at").eq("id", "island").maybeSingle();
          const m = mergeWorld(cur?.pieces, b.set, now); if (m.error) return json(400, { error: m.error });
          const at = new Date(now + tries).toISOString();
          if (!cur) { const { error } = await db.from("pvp_terrain").insert({ id: "island", cells: {}, pieces: m.pieces, paint: {}, rev: 0, log: [], updated_at: at }); if (error) { if (tries < 3) continue; throw error; } }
          else { const { data: up, error } = await db.from("pvp_terrain").update({ pieces: m.pieces, updated_at: at }).eq("id", "island").eq("updated_at", cur.updated_at).select("id"); if (error) throw error; if (!up?.length) continue; }
          return json(200, { ok: true, n: m.n, world: worldOf(m.pieces), at });
        }
        return json(409, { error: "busy, try again" });
      }
      default: return json(400, { error: "bad action" });
    }
  } catch (e: any) {
    console.error("[admin]", action, e?.message || e);
    return json(500, { error: "admin error" });
  }
}
