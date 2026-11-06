// [v349 money-makers] BANKSY t203u/t204u "Add the first 5": the island gold loops (migration 053_island_money_makers.sql). Wired from index.ts.
// Every gold move is ONE definer RPC (pvp_isl_move inside): wallet / device profile or the OWNER's pot (gold + save.gold), and every reply
// carries gold (+ rev + owner) so the client re-bases through pvp.serverGold (052 rule: no later save overwrites earned / staked gold).
// Actions (POST { action, ... } like every other pvp action; identity = token | dk):
//   isl_state { since }                      goods, timers, today's claims, gold that landed for you (duel / bet wins + refunds)
//   isl_board                                the Wanted list, open + live Coliseum fights (+ ringside pools), the last 90 s of bounty claims
//   isl_contract { contract, reqId }          daily PvE contract payout (150 / 120 / 250 / 100, once a day each)
//   isl_bounty_post { target, amount, name, reqId } / isl_bounty_claim { target, name, reqId }
//   isl_duel_post { stake, name, reqId } / isl_duel_accept { duel, name, reqId } / isl_duel_settle { duel, result: won|lost|cancel }
//   isl_bet { duel, side: r|b, amount, name, reqId }
//   isl_horde { run, wave, reqId }            Skeleton Horde wave payout (60/90/120/160/220 + 300 champion, 1900 / day)
//   isl_crate { tier, run, reqId }            Smuggler crate delivery (standard 100 / cutthroat 220, 12 / day)
//   isl_gather { src: dive|mine, spot, kind, reqId }   server-rolled pearls / doubloons / ore
//   isl_timer_start { kind: crab|plot|still, slot, homegrown, reqId } / isl_timer_finish { kind, slot, reqId }
//   isl_sell { item, qty, shop: fish|antiques|rum, reqId }
// A missing 053 (PGRST202 / 42883) answers 409 { error: "closed" }: the client keeps its offline practice mode.
export const ISLAND_ACTIONS = ["isl_state", "isl_board", "isl_contract", "isl_bounty_post", "isl_bounty_claim", "isl_duel_post", "isl_duel_accept",
  "isl_duel_settle", "isl_bet", "isl_horde", "isl_crate", "isl_gather", "isl_timer_start", "isl_timer_finish", "isl_sell"] as const;
export type IslandAction = (typeof ISLAND_ACTIONS)[number];

// = js/island/moneyMakers/config.js + js/inventory/islandGoods.js (tests/v349IslandMoneyMakers.test.mjs keeps them in step)
export const CONTRACT_GOLD: Record<string, number> = { cave_raiders: 150, jungle_stalkers: 120, cursed_captains: 250, salvage_patrol: 100 };
export const DUEL_STAKES = [100, 250, 500, 1000];
export const BET_MIN = 50, BET_MAX = 500, BOUNTY_MIN = 100, BOUNTY_MAX = 5000;
export const HORDE_GOLD = [60, 90, 120, 160, 220], HORDE_CHAMPION = 300;
export const CRATE_GOLD: Record<string, number> = { standard: 100, cutthroat: 220 };
export const ISLAND_SHOPS = ["fish", "antiques", "rum"];
// NPC prices [item, shop, gold]: = js/inventory/islandGoods.js islPriceRows() = migration 053 pvp_isl_prices seed (the server's table decides)
export const ISLAND_PRICES: [string, string, number][] = [
  ["isl:shore_crab", "fish", 40], ["isl:blue_claw_crab", "fish", 85], ["isl:spiny_king_crab", "fish", 170], ["isl:golden_emperor_crab", "fish", 420],
  ["isl:sea_pearl", "antiques", 120], ["isl:black_pearl", "antiques", 450], ["isl:barnacled_doubloons", "antiques", 220],
  ["isl:iron_ore", "antiques", 45], ["isl:refined_saltpeter", "antiques", 60], ["isl:cave_gold_nugget", "antiques", 300],
  ["isl:island_cane", "antiques", 12], ["isl:island_spices", "antiques", 18],
  ["isl:cottage_spiced_rum", "rum", 140], ["isl:cottage_spiced_rum", "antiques", 110], ["isl:reserve_spiced_rum", "rum", 175], ["isl:reserve_spiced_rum", "antiques", 135],
];

type Ctx = {
  db: any;
  whoAmI: (b: Record<string, unknown>) => Promise<any>;
  json: (status: number, body: Record<string, unknown>) => Response;
  acctBump?: (db: any, raw: string, delta: number) => Promise<void>;
};
const reqOf = (r: unknown) => typeof r === "string" && /^[A-Za-z0-9_:-]{8,64}$/.test(r) ? r : "";
const runOf = (r: unknown) => typeof r === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(r) ? r : "";
const slotOf = (s: unknown) => typeof s === "string" && /^[a-z0-9_]{2,24}$/.test(s) ? s : "";
const uuidOf = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : "";
const nameOf = (s: unknown) => String(s ?? "").replace(/[<>&"'`\\]/g, "").trim().slice(0, 20);
const intOf = (n: unknown) => { const v = Math.floor(Number(n)); return Number.isFinite(v) ? v : 0; };
const missing = (e: any) => /pvp_isl_|PGRST202|42883|42P01/.test(`${e?.code || ""} ${e?.message || ""}`);

async function rpc(c: Ctx, fn: string, args: Record<string, unknown>) {
  const { data, error } = await c.db.rpc(fn, args); if (error) throw error; return data;
}
// the reply, plus the account mirror for a logged-in device (same as the casino: a wallet / the owner never)
async function goldReply(c: Ctx, who: any, data: any) {
  if (!data?.ok) return c.json(data?.why === "not enough gold" ? 402 : 409, { error: data?.why || "could not", gold: data?.gold, cap: data?.cap, left_s: data?.left_s, pending: data?.pending || undefined });
  const d = Number(data.delta) || 0;
  if (d && !who.wallet && !who.owner && !data.owner && !data.retry) await c.acctBump?.(c.db, who.raw, d);
  return c.json(200, { ...data, ok: true, owner: !!(data.owner ?? who.owner) });
}

export async function islandAction(c: Ctx, action: string, b: Record<string, unknown>): Promise<Response> {
  if (!(ISLAND_ACTIONS as readonly string[]).includes(action)) return c.json(400, { error: "bad action" });
  try {
    if (action === "isl_board") return c.json(200, { ...(await rpc(c, "pvp_isl_board", {})), ok: true });
    const who = await c.whoAmI(b); if (!who) return c.json(401, { error: "no identity" });
    const pid = who.pid, req = reqOf(b.reqId), name = nameOf(b.name);
    const needReq = () => (req ? null : c.json(400, { error: "bad request" }));
    switch (action as IslandAction) {
      case "isl_state": return c.json(200, { ...(await rpc(c, "pvp_isl_state", { p_player: pid, p_since: Math.max(0, intOf(b.since)) })), ok: true });
      case "isl_contract": {
        const id = String(b.contract || ""); if (!CONTRACT_GOLD[id]) return c.json(400, { error: "bad contract" }); if (!req) return needReq()!;
        return goldReply(c, who, await rpc(c, "pvp_isl_contract", { p_player: pid, p_contract: id, p_req: req }));
      }
      case "isl_bounty_post": {
        const amt = intOf(b.amount), target = nameOf(b.target);
        if (!target || amt < BOUNTY_MIN || amt > BOUNTY_MAX) return c.json(400, { error: "stake 100 to 5000" }); if (!req) return needReq()!;
        return goldReply(c, who, await rpc(c, "pvp_isl_bounty_post", { p_player: pid, p_name: name, p_target: target, p_amount: amt, p_req: req }));
      }
      case "isl_bounty_claim": { // [review fix 4] the SQL pays only against a confirmed pvp_kills row of that pirate (claimKill flow), consumed once
        const target = nameOf(b.target); if (!target) return c.json(400, { error: "bad target" }); if (!req) return needReq()!;
        return goldReply(c, who, await rpc(c, "pvp_isl_bounty_claim", { p_player: pid, p_name: name, p_target: target, p_req: req }));
      }
      case "isl_duel_post": {
        const stake = intOf(b.stake); if (!DUEL_STAKES.includes(stake)) return c.json(400, { error: "bad stake" }); if (!req) return needReq()!;
        return goldReply(c, who, await rpc(c, "pvp_isl_duel_post", { p_player: pid, p_name: name, p_stake: stake, p_req: req }));
      }
      case "isl_duel_accept": {
        const duel = uuidOf(b.duel); if (!duel) return c.json(400, { error: "bad duel" }); if (!req) return needReq()!;
        return goldReply(c, who, await rpc(c, "pvp_isl_duel_accept", { p_player: pid, p_name: name, p_duel: duel, p_req: req }));
      }
      case "isl_duel_settle": {
        const duel = uuidOf(b.duel), result = String(b.result || ""); if (!duel || !["won", "lost", "cancel"].includes(result)) return c.json(400, { error: "bad request" });
        const data = await rpc(c, "pvp_isl_duel_settle", { p_player: pid, p_duel: duel, p_result: result });
        // [review fix 3] 'won' only pays on a both-sides-confirmed KO (pvp_kills); else pending until the loser's own client concedes or it expires + refunds
        if (!data?.ok) return c.json(409, { error: data?.why || "could not", pending: data?.pending || undefined });
        return goldReply(c, who, data.gold == null ? { ...data, delta: 0 } : data);
      }
      case "isl_bet": {
        const duel = uuidOf(b.duel), side = String(b.side || ""), amt = intOf(b.amount);
        if (!duel || !["r", "b"].includes(side) || amt < BET_MIN || amt > BET_MAX) return c.json(400, { error: "bet 50 to 500" }); if (!req) return needReq()!;
        return goldReply(c, who, await rpc(c, "pvp_isl_bet", { p_player: pid, p_name: name, p_duel: duel, p_side: side, p_amount: amt, p_req: req }));
      }
      case "isl_horde": {
        const run = runOf(b.run), wave = intOf(b.wave); if (!run || wave < 1 || wave > 5) return c.json(400, { error: "bad request" }); if (!req) return needReq()!;
        return goldReply(c, who, await rpc(c, "pvp_isl_horde", { p_player: pid, p_run: run, p_wave: wave, p_req: req }));
      }
      case "isl_crate": {
        const tier = String(b.tier || ""), run = runOf(b.run); if (!CRATE_GOLD[tier] || !run) return c.json(400, { error: "bad request" }); if (!req) return needReq()!;
        return goldReply(c, who, await rpc(c, "pvp_isl_crate", { p_player: pid, p_tier: tier, p_run: run, p_req: req }));
      }
      case "isl_gather": {
        const src = String(b.src || ""), spot = slotOf(b.spot), kind = String(b.kind || "");
        if (!["dive", "mine"].includes(src) || !spot || !["chest", "clam", "iron", "saltpeter", "gold"].includes(kind)) return c.json(400, { error: "bad request" }); if (!req) return needReq()!;
        const data = await rpc(c, "pvp_isl_gather", { p_player: pid, p_src: src, p_spot: spot, p_kind: kind, p_req: req });
        return data?.ok ? c.json(200, { ...data, ok: true }) : c.json(409, { error: data?.why || "could not", left_s: data?.left_s });
      }
      case "isl_timer_start": {
        const kind = String(b.kind || ""), slot = slotOf(b.slot); if (!["crab", "plot", "still"].includes(kind) || !slot) return c.json(400, { error: "bad request" }); if (!req) return needReq()!;
        const data = await rpc(c, "pvp_isl_timer_start", { p_player: pid, p_kind: kind, p_slot: slot, p_homegrown: b.homegrown === true, p_req: req });
        return data?.delta ? goldReply(c, who, data) : (data?.ok ? c.json(200, { ...data, ok: true }) : c.json(409, { error: data?.why || "could not" }));
      }
      case "isl_timer_finish": {
        const kind = String(b.kind || ""), slot = slotOf(b.slot); if (!["crab", "plot", "still"].includes(kind) || !slot) return c.json(400, { error: "bad request" }); if (!req) return needReq()!;
        const data = await rpc(c, "pvp_isl_timer_finish", { p_player: pid, p_kind: kind, p_slot: slot, p_req: req });
        return data?.ok ? c.json(200, { ...data, ok: true }) : c.json(409, { error: data?.why || "could not", left_s: data?.left_s });
      }
      case "isl_sell": {
        const item = String(b.item || ""), shop = String(b.shop || ""), qty = intOf(b.qty);
        if (!/^isl:[a-z_]{2,24}$/.test(item) || !ISLAND_SHOPS.includes(shop) || qty < 1 || qty > 999) return c.json(400, { error: "bad request" }); if (!req) return needReq()!;
        return goldReply(c, who, await rpc(c, "pvp_isl_sell", { p_player: pid, p_item: item, p_qty: qty, p_shop: shop, p_req: req }));
      }
    }
    return c.json(400, { error: "bad action" });
  } catch (e: any) {
    console.error("[island]", action, e?.code || "", e?.message || e);
    if (missing(e)) return c.json(409, { error: "closed" });   // 053 not applied yet: the client stays in practice mode
    return c.json(500, { error: "island error" });
  }
}
