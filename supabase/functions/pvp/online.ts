// [give-dropdown] WHO IS ONLINE for the inventory GIVE picker (BANKSY 4:59 PM: "on inventory give do a drop down of all current players").
// Reads the two heartbeat tables the lobby already keeps (no new table, no migration): pvp_harbor_seats (every harbor copy, a beat every few
// seconds, stale rows dropped after 20 s) and pvp_seats (Solo / Squads arenas + their queue / spectators, dropped after 15-25 s). It returns
// DISPLAY NAMES ONLY (+ harbor / arena), and only names that a gift can reach: exactly one pvp_players row with that name (inv_gift resolves
// the same way). No ids, seats, rooms, wallets or times leave the server.
export const ONLINE_FRESH_S = 30, ONLINE_MAX = 300;
export type OnlineRow = { name: unknown; seen?: unknown };
export const cleanName = (n: unknown) => String(n ?? "").replace(/[<>&"'`\\\u0000-\u001f]/g, "").trim().slice(0, 20);
// harbor + arena heartbeat rows -> [{ n, w }] (unique by name, case-insensitive; a pirate in both = harbor), the default PIRATE dropped
export function onlineNames(harbor: OnlineRow[], arena: OnlineRow[], now: number, fresh = ONLINE_FRESH_S) {
  const out = new Map<string, { n: string; w: "harbor" | "arena" }>();
  const add = (rows: OnlineRow[], w: "harbor" | "arena") => { for (const r of rows || []) { const n = cleanName(r?.name); if (!n || n.toUpperCase() === "PIRATE") continue;
    const t = Date.parse(String(r?.seen ?? "")); if (Number.isFinite(t) && now - t > fresh * 1000) continue;
    const k = n.toLowerCase(); if (!out.has(k) || (w === "harbor" && out.get(k)!.w === "arena")) out.set(k, { n, w }); } };
  add(harbor, "harbor"); add(arena, "arena"); return [...out.values()];
}
// keep the names a gift reaches (one registered pirate with exactly that name), sorted A-Z, capped
export function giftable(list: { n: string; w: string }[], registered: unknown[]) {
  const c = new Map<string, number>(); for (const r of registered || []) { const n = String((r as any)?.name ?? ""); c.set(n, (c.get(n) || 0) + 1); }
  return list.filter((p) => c.get(p.n) === 1).sort((a, b) => a.n.localeCompare(b.n, "en", { sensitivity: "base" })).slice(0, ONLINE_MAX);
}
export async function onlineAction(db: any, pid: string) {
  const { data: ok } = await db.rpc("pvp_rl_hit", { p_key: "online:" + pid, p_window_s: 10, p_max: 4 }); if (ok === false) return { ok: false, why: "slow down" };
  const since = new Date(Date.now() - ONLINE_FRESH_S * 1000).toISOString();
  const [h, a] = await Promise.all([db.from("pvp_harbor_seats").select("name, seen").gt("seen", since).limit(1000), db.from("pvp_seats").select("name, seen").gt("seen", since).limit(1000)]);
  const list = onlineNames(h?.data || [], a?.data || [], Date.now()); if (!list.length) return { ok: true, players: [] };
  const { data: reg } = await db.from("pvp_players").select("name").in("name", list.map((p) => p.n)).limit(2000);
  return { ok: true, players: giftable(list, reg || []) };
}
