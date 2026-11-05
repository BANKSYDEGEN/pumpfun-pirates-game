// [give-dropdown] WHO IS ONLINE for the inventory GIVE picker (BANKSY 4:59 PM: "on inventory give do a drop down of all current players").
// [squad-hall] BANKSY 9:35 PM: same list for the Squad Hall, with world/room labels (harbor copy + Solo/Squads arena) when detail:true.
// Reads the two heartbeat tables the lobby already keeps (no new table for the list): pvp_harbor_seats (every harbor copy, a beat every few
// seconds, stale rows dropped after 20 s) and pvp_seats (Solo / Squads arenas + their queue / spectators, dropped after 15-25 s). It returns
// DISPLAY NAMES ONLY (+ harbor / arena / copy / mode). No ids, seats, wallets or times leave the server.
export const ONLINE_FRESH_S = 30, ONLINE_MAX = 300;
export type OnlineRow = { name: unknown; seen?: unknown; copy?: unknown; prefix?: unknown; state?: unknown };
export const cleanName = (n: unknown) => String(n ?? "").replace(/[<>&"'`\\\u0000-\u001f]/g, "").trim().slice(0, 20);

function modeOf(prefix: unknown): "" | "solo" | "squads" {
  const p = String(prefix ?? "");
  if (/sq$/i.test(p) || /sq-/i.test(p)) return "squads";
  if (/^pfp-pvp-/i.test(p)) return "solo";
  return "";
}

// harbor + arena heartbeat rows -> [{ n, w, copy?, mode? }] (unique by name, case-insensitive; a pirate in both = harbor wins)
export function onlineNames(harbor: OnlineRow[], arena: OnlineRow[], now: number, fresh = ONLINE_FRESH_S, detail = false) {
  const out = new Map<string, { n: string; w: string; copy?: number; mode?: string }>();
  const add = (rows: OnlineRow[], kind: "harbor" | "arena") => {
    for (const r of rows || []) {
      const n = cleanName(r?.name); if (!n || n.toUpperCase() === "PIRATE") continue;
      const t = Date.parse(String(r?.seen ?? "")); if (Number.isFinite(t) && now - t > fresh * 1000) continue;
      const k = n.toLowerCase();
      if (kind === "harbor") {
        const copy = Math.max(0, Math.min(99, Number(r?.copy) || 0));
        const row: { n: string; w: string; copy?: number; mode?: string } = { n, w: "harbor" };
        if (detail && copy) row.copy = copy;
        // harbor wins over arena
        out.set(k, row);
      } else {
        if (out.has(k) && out.get(k)!.w === "harbor") continue;
        const st = String(r?.state ?? "play");
        const w = st === "queue" || st === "offer" ? "queue" : st === "spec" ? "spec" : "arena";
        const row: { n: string; w: string; copy?: number; mode?: string } = { n, w };
        if (detail) { const m = modeOf(r?.prefix); if (m) row.mode = m; }
        out.set(k, row);
      }
    }
  };
  add(harbor, "harbor"); add(arena, "arena"); return [...out.values()];
}

// keep the names a gift reaches (one registered pirate with exactly that name), sorted A-Z, capped
export function giftable(list: { n: string; w: string; copy?: number; mode?: string }[], registered: unknown[]) {
  const c = new Map<string, number>(); for (const r of registered || []) { const n = String((r as any)?.name ?? ""); c.set(n, (c.get(n) || 0) + 1); }
  return list.filter((p) => c.get(p.n) === 1).sort((a, b) => a.n.localeCompare(b.n, "en", { sensitivity: "base" })).slice(0, ONLINE_MAX);
}

export async function onlineAction(db: any, pid: string, opts: { detail?: boolean } = {}) {
  const { data: ok } = await db.rpc("pvp_rl_hit", { p_key: "online:" + pid, p_window_s: 10, p_max: 4 }); if (ok === false) return { ok: false, why: "slow down" };
  const since = new Date(Date.now() - ONLINE_FRESH_S * 1000).toISOString();
  const detail = !!opts.detail;
  const hSel = detail ? "name, seen, copy" : "name, seen";
  const aSel = detail ? "name, seen, prefix, state" : "name, seen";
  const [h, a] = await Promise.all([
    db.from("pvp_harbor_seats").select(hSel).gt("seen", since).limit(1000),
    db.from("pvp_seats").select(aSel).gt("seen", since).limit(1000),
  ]);
  const list = onlineNames(h?.data || [], a?.data || [], Date.now(), ONLINE_FRESH_S, detail); if (!list.length) return { ok: true, players: [] };
  const { data: reg } = await db.from("pvp_players").select("name").in("name", list.map((p) => p.n)).limit(2000);
  return { ok: true, players: giftable(list, reg || []) };
}
