// PUMPFUN PIRATES · [Timothy] shop goal progress for the `pvp` Edge Function (read-only; the BUY check stays lib.ts goalMet).
// shop_state / dev_sync answer with `goals` (per goal-locked item: met + each row's have / need, from the SAME stats shop_buy
// checks) and `modes` (BR kills / deaths split Solo vs Squads from the confirmed board, migration 025 DRAFT; null until it runs).
// Trust: exactly what shop_buy already trusts (see docs/shop-goals/AUDIT.md). Nothing here writes, so nothing here can be gamed.
import { SHOP_ITEMS, type Goal, type Profile } from "./lib.ts";

const have = (st: Profile["stats"], k: string) => k === "kd" ? st.kills / Math.max(1, st.deaths) : Math.max(0, Number((st as any)[k]) || 0);
export type GoalRow = { stat: string; need: number; have: number; done: boolean };
export function goalsView(st: Profile["stats"]): Record<string, { met: boolean; rows: GoalRow[] }> {
  const out: Record<string, { met: boolean; rows: GoalRow[] }> = {};
  for (const [item, it] of Object.entries(SHOP_ITEMS)) {
    const g = it.goal as Goal | undefined; if (!g) continue;
    const rows = g.map((r) => { const h = have(st, r.stat); return { stat: r.stat, need: r.need, have: r.stat === "kd" ? Math.floor(h * 100) / 100 : Math.floor(h), done: h >= r.need }; });
    out[item] = { met: rows.every((r) => r.done), rows };
  }
  return out;
}
// Solo / Squads split of the confirmed board. Fails soft (null) while migration 025 isn't applied, or on any error.
// deno-lint-ignore no-explicit-any
export async function killsByMode(db: any, pid: string) {
  try {
    const { data, error } = await db.rpc("pvp_kills_by_mode", { p_player: pid }); if (error) return null;
    const r = Array.isArray(data) ? data[0] : data; if (!r) return null;
    return { solo: Number(r.solo_kills ?? 0), squads: Number(r.squads_kills ?? 0), soloDeaths: Number(r.solo_deaths ?? 0), squadsDeaths: Number(r.squads_deaths ?? 0) };
  } catch { return null; }
}
