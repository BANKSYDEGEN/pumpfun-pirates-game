// [v356 friends] BANKSY t1851u: "Make it so you can add friends and have friend list and auto join their server if possible".
// Edge actions on top of migration 054 (pvp_friend_op / pvp_friend_seen, service-role only). Who is asking = index.ts whoAmI (signed
// wallet session, else device key, through pvp_main): a client can never act as another pirate. Display names + where they are leave
// the server, only for ACCEPTED friends; never ids, seats, wallets or device keys.
import { cleanName } from "./online.ts";

export const FRIEND_ACTIONS = ["fr_list", "fr_request", "fr_respond", "fr_cancel", "fr_remove", "fr_search"] as const;
// rate limits (pvp_rl_hit, per player): list/heartbeat ~ every 8-30 s from the client; writes are rarer
export const FR_RL: Record<string, [string, number, number]> = {
  fr_list: ["frl:", 60, 20], fr_search: ["frs:", 60, 20], fr_request: ["frq:", 600, 30], fr_respond: ["frw:", 60, 30], fr_cancel: ["frw:", 60, 30], fr_remove: ["frw:", 60, 30],
};
const HARBOR_RE = /^pfp-harbor(-[a-z0-9]{2,12})?$/;
export const HARBOR_CAP = 8;

/** The caller's own "where am I" from the client -> clean args for pvp_friend_seen, or null (= don't touch presence). */
export function cleanAt(at: unknown): { w: string; prefix: string | null; copy: number | null; mode: string | null } | null {
  if (!at || typeof at !== "object") return null;
  const a = at as Record<string, unknown>, w = String(a.w ?? "");
  if (w === "off") return { w: "off", prefix: null, copy: null, mode: null };
  if (!["harbor", "arena", "queue", "spec", "solo"].includes(w)) return null;
  const mode = a.mode === "squads" ? "squads" : a.mode === "solo" ? "solo" : null;
  if (w !== "harbor") return { w, prefix: null, copy: null, mode };
  const prefix = String(a.prefix ?? "").toLowerCase(), copy = Math.floor(Number(a.copy));
  return { w, prefix: HARBOR_RE.test(prefix) ? prefix : "pfp-harbor", copy: Number.isFinite(copy) && copy >= 1 && copy <= 60 ? copy : 0, mode };
}

type Friend = { n: string; on: boolean; w: string; prefix?: string | null; copy?: number | null; mode?: string | null; room_n?: number | null };
/** One friend row for the client: name, online, where (label), and whether / how you can join. */
export function friendView(f: Friend, cap = HARBOR_CAP) {
  const n = cleanName(f?.n); if (!n) return null;
  const on = !!f.on, w = on ? String(f.w || "off") : "off";
  const out: Record<string, unknown> = { n, on, w };
  if (w === "harbor") {
    const prefix = HARBOR_RE.test(String(f.prefix || "")) ? String(f.prefix) : "pfp-harbor", copy = Math.max(0, Math.min(60, Number(f.copy) | 0)), rn = Math.max(0, Number(f.room_n) | 0);
    const code = prefix === "pfp-harbor" ? "" : prefix.slice("pfp-harbor-".length).toUpperCase();
    Object.assign(out, { copy, code, room_n: rn, cap, full: rn >= cap });
  } else if (f.mode === "solo" || f.mode === "squads") out.mode = f.mode;
  return out;
}

export async function claimName(db: any, who: { pid: string; raw?: string; wallet?: string | null }, raw: unknown) {
  const name = cleanName(raw); if (!name || name.toUpperCase() === "PIRATE" || !/^(wallet:[1-9A-HJ-NP-Za-km-z]{32,44}|dev:[0-9a-f]{24})$/.test(who.pid)) return false;
  const { data: free, error: fe } = await db.rpc("pvp_name_free", { p_name: name, p_player: who.raw ?? who.pid, p_wallet: who.wallet ?? null }); if (fe || free !== true) return false;
  const { error } = await db.from("pvp_players").insert({ id: who.pid, name, updated_at: new Date().toISOString() }); return !error;
}
export async function friendAction(c: { db: any; whoAmI: (b: Record<string, unknown>) => Promise<{ pid: string; raw?: string; wallet?: string | null } | null>; json: (s: number, o: unknown) => Response }, action: string, b: Record<string, unknown>) {
  const { db, json } = c; const who = await c.whoAmI(b); if (!who) return json(401, { error: "no identity" });
  const rl = FR_RL[action]; if (!rl) return json(400, { error: "unknown action" });
  const { data: okRate } = await db.rpc("pvp_rl_hit", { p_key: rl[0] + who.pid, p_window_s: rl[1], p_max: rl[2] });
  if (okRate === false) return json(429, { ok: false, why: "slow down" });
  const op = async (p_op: string, extra: Record<string, unknown> = {}) => { const { data, error } = await db.rpc("pvp_friend_op", { p_player: who.pid, p_op, ...extra }); if (error) throw error; return data; };
  if (action === "fr_list") {
    const at = cleanAt(b.at);
    if (at) { const { error } = await db.rpc("pvp_friend_seen", { p_player: who.pid, p_w: at.w, p_prefix: at.prefix, p_copy: at.copy, p_mode: at.mode }); if (error) console.warn("friend seen", error.message); }
    let d = await op("list"); if (!d?.ok) return json(200, d || { ok: false, why: "busy" });
    // a Harbor-only pirate may have no board row yet (rows come from kills / arena / accounts): claim the display name they sail under,
    // ONLY when this id has no row and the name is free (same pvp_name_free rule as accounts); never renames anyone
    if (!d.me && await claimName(db, who, b.name)) d = await op("list");
    const friends = (Array.isArray(d.friends) ? d.friends : []).map((f: Friend) => friendView(f)).filter(Boolean).slice(0, 100);
    const names = (a: unknown) => (Array.isArray(a) ? a : []).map(cleanName).filter(Boolean).slice(0, 50);
    return json(200, { ok: true, me: cleanName(d.me), friends, incoming: names(d.incoming), outgoing: names(d.outgoing) });
  }
  const name = cleanName(b.name);
  if (action === "fr_search") {
    const d = await op("search", { p_name: name }); if (!d?.ok) return json(200, d);
    return json(200, { ok: true, players: (Array.isArray(d.players) ? d.players : []).map((p: any) => ({ n: cleanName(p?.n), s: ["friend", "sent", "incoming"].includes(p?.s) ? p.s : "" })).filter((p: any) => p.n).slice(0, 8) });
  }
  if (!name) return json(400, { ok: false, why: "pick a pirate" });
  const map: Record<string, string> = { fr_request: "request", fr_respond: "respond", fr_cancel: "cancel", fr_remove: "remove" };
  const d = await op(map[action], { p_name: name, ...(action === "fr_respond" ? { p_accept: b.accept === true } : {}) });
  return json(200, d?.ok ? { ok: true, state: String(d.state || ""), name: cleanName(d.name) } : { ok: false, why: String(d?.why || "failed").slice(0, 60) });
}
