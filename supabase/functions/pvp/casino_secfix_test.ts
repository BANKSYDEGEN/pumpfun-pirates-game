// [security C1/H3 2026-11-09] casino replay + blackjack settlement race, against an in-memory db that mirrors the SQL of
// migration 20261110020000 (pvp_casino_debit / pvp_casino_settle / pvp_casino_credit) and PostgREST's conditional update.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { casinoAction } from "./casino.ts";

const tick = () => new Promise((r) => setTimeout(r, 0));
function fakeDb(startGold = 10000) {
  const S = { gold: startGold, house: 0, purchases: new Map<string, any>(), results: new Map<string, any>(), hands: new Map<string, any>(), credits: [] as number[], debits: [] as number[], rl: 0, rlMax: 1e9 };
  const rpc = async (fn: string, a: any) => {
    await tick();
    if (fn === "pvp_rl_hit") return { data: ++S.rl <= S.rlMax };
    if (fn === "pvp_casino_debit") {
      if (++S.rl > S.rlMax) return { data: { ok: false, why: "slow down" } };
      const prev = S.purchases.get(a.p_req);
      if (prev) return { data: { ok: true, retry: true, debited: prev.price, gold: prev.after, game: prev.item.slice(7), result: S.results.get(a.p_req)?.body ?? null } };
      if (S.gold < a.p_bet) return { data: { ok: false, why: "not enough gold", gold: S.gold } };
      S.gold -= a.p_bet; S.house += a.p_bet; S.debits.push(a.p_bet);
      S.purchases.set(a.p_req, { price: a.p_bet, after: S.gold, item: "casino:" + a.p_game });
      return { data: { ok: true, debited: a.p_bet, gold: S.gold, rev: 1 } };
    }
    if (fn === "pvp_casino_credit") { S.gold += a.p_payout; if (a.p_payout) S.credits.push(a.p_payout); return { data: { ok: true, gold: S.gold, credited: a.p_payout } }; }
    if (fn === "pvp_casino_settle") {
      if (S.results.has(a.p_key)) return { data: { ok: false, why: "settled", stored: S.results.get(a.p_key).body } };
      S.results.set(a.p_key, { body: a.p_body, payout: a.p_payout });
      S.gold += a.p_payout; if (a.p_payout) S.credits.push(a.p_payout);
      return { data: { ok: true, settled: true, gold: S.gold, credited: a.p_payout } };
    }
    throw new Error("rpc " + fn);
  };
  const from = (t: string) => {
    const f: [string, unknown][] = []; let patch: any = null, op = "select";
    const match = (r: any) => f.every(([k, v]) => r[k] === v);
    const q: any = {
      select: () => q, eq: (k: string, v: unknown) => { f.push([k, v]); return q; },
      update: (p: any) => { op = "update"; patch = p; return q; },
      upsert: async (row: any) => { await tick(); S.hands.set(row.player_id, { ...row }); return { error: null }; },
      maybeSingle: async () => {
        await tick();
        if (t === "pvp_casino_results") { const r = S.results.get(String(f.find(([k]) => k === "req")?.[1])); return { data: r ? { body: r.body } : null }; }
        const h = [...S.hands.values()].find(match); return { data: h ? structuredClone(h) : null };
      },
      then: async (res: any, rej: any) => {
        try {
          await tick();
          if (op !== "update") return res({ data: [] });
          const out = [];
          for (const h of S.hands.values()) if (match(h)) {
            Object.assign(h, patch, { updated_at: new Date(Date.parse(patch.updated_at) + Math.random()).toISOString() + Math.random() });
            out.push({ state_id: h.state_id });
          }
          res({ data: out, error: null });
        } catch (e) { rej(e); }
      },
    };
    return q;
  };
  return { S, db: { rpc, from } };
}
function ctx(db: any) {
  return { db, whoAmI: async () => ({ pid: "dev:test", raw: "dev:test", wallet: null, owner: false }),
    json: (s: number, o: unknown) => new Response(JSON.stringify(o), { status: s }), acctBump: async () => {} };
}
const play = async (c: any, b: Record<string, unknown>) => { const r = await casinoAction(c, "casino_play", b); return { status: r.status, body: await r.json() }; };
const R = (n: number) => "cas_" + String(n).padStart(24, "0");

Deno.test("C1: a replayed request id returns the stored round and never pays twice", async () => {
  for (const game of ["dice", "slots", "roulette"]) {
    const { S, db } = fakeDb(); const c = ctx(db);
    const b = { game, bet: 100, reqId: R(1), choice: game === "dice" ? "doubles" : game === "roulette" ? { type: "color", value: "red" } : undefined };
    const first = await play(c, b);
    assertEquals(first.status, 200);
    const goldAfter = S.gold, credits = S.credits.length;
    for (let i = 0; i < 20; i++) {
      const again = await play(c, { ...b, bet: 25000 });   // even with a bigger "bet" in the retry
      assertEquals(again.status, 200);
      assertEquals(again.body.payout, first.body.payout); assertEquals(again.body.detail, first.body.detail); assertEquals(again.body.retry, true);
    }
    assertEquals(S.gold, goldAfter); assertEquals(S.credits.length, credits); assertEquals(S.debits, [100]);
  }
});

Deno.test("C1: concurrent replays of one request id settle once", async () => {
  const { S, db } = fakeDb(); const c = ctx(db);
  const rs = await Promise.all(Array.from({ length: 12 }, () => play(c, { game: "slots", bet: 500, reqId: R(2) })));
  assertEquals(S.debits, [500]); assert(S.results.size === 1);
  const paid = S.credits.reduce((a, b) => a + b, 0);
  assertEquals(paid, S.results.get(R(2)).payout);   // paid once, whatever the reels said
  for (const r of rs) assert(r.status === 200 || r.status === 409);
});

Deno.test("C1: the original debit decides the stake; a request id from another game is refused", async () => {
  const { S, db } = fakeDb(); const c = ctx(db);
  S.purchases.set(R(3), { price: 10, after: S.gold, item: "casino:dice" });   // debited 10, crashed before the roll
  const r = await play(c, { game: "dice", bet: 25000, reqId: R(3), choice: "lucky7" });
  assertEquals(r.status, 200); assert(r.body.payout === 0 || r.body.payout === 40, "lucky7 pays 4x the ORIGINAL 10");
  assertEquals(S.debits, []);
  const x = await play(c, { game: "slots", bet: 10, reqId: R(3) });
  assertEquals(x.status, 409);
});

Deno.test("C1: rate limit still applies to retries", async () => {
  const { S, db } = fakeDb(); const c = ctx(db);
  await play(c, { game: "slots", bet: 10, reqId: R(4) }); S.rlMax = 0;
  const r = await play(c, { game: "slots", bet: 10, reqId: R(4) });
  assertEquals(r.status, 409); assertEquals(r.body.error, "slow down");
});

async function openHand(c: any, S: any, req: string) {
  for (let i = 0; i < 200; i++) {
    const d = await play(c, { game: "blackjack", subAction: "deal", bet: 100, reqId: req + String(i).padStart(3, "0") });
    if (d.body.outcome === "deal") return d;
  }
  throw new Error("no open hand");
}

Deno.test("H3: double stand / stand+double race pays once", async () => {
  for (let k = 0; k < 30; k++) {
    const { S, db } = fakeDb(); const c = ctx(db);
    const d = await openHand(c, S, "cas_bj" + String(k).padStart(19, "0"));
    const stateId = d.body.state.stateId;
    const base = S.credits.length;
    const rs = await Promise.all([
      play(c, { game: "blackjack", subAction: "stand", stateId }),
      play(c, { game: "blackjack", subAction: "stand", stateId }),
      play(c, { game: "blackjack", subAction: "double", stateId, reqId: "cas_dbl" + String(k).padStart(19, "0") }),
      play(c, { game: "blackjack", subAction: "stand", stateId }),
    ]);
    const hand = S.results.get("bjs:" + stateId); assert(hand, "the hand settled");
    const handPaid = S.credits.slice(base).reduce((a: number, b: number) => a + b, 0) - [...S.results.keys()].filter((key) => key.startsWith("bjr:")).length * 100;
    assertEquals(handPaid, hand.payout, "only one settlement paid");
    for (const r of rs) if (r.status === 200) assertEquals(r.body.payout, hand.payout);
    // a double that lost the race got its stake back exactly once
    const refunds = [...S.results.keys()].filter((key) => key.startsWith("bjr:")).length;
    assert(refunds <= 1 && refunds <= S.debits.length - 1, "a double that lost the race is refunded once, never more");
  }
});

Deno.test("H3: a replayed deal returns the same hand, not a new one", async () => {
  const { S, db } = fakeDb(); const c = ctx(db);
  const d = await openHand(c, S, "cas_deal00000000000000000");
  const again = await play(c, { game: "blackjack", subAction: "deal", bet: 100, reqId: [...S.purchases.keys()].pop() });
  assertEquals(again.body.state.stateId, d.body.state.stateId); assertEquals(again.body.detail.player, d.body.detail.player);
  assertEquals(S.debits.filter((x) => x === 100).length, S.purchases.size);
});

Deno.test("H3: stand after settle returns the stored result", async () => {
  const { S, db } = fakeDb(); const c = ctx(db);
  const d = await openHand(c, S, "cas_after0000000000000000");
  const a = await play(c, { game: "blackjack", subAction: "stand", stateId: d.body.state.stateId });
  const g = S.gold;
  const b = await play(c, { game: "blackjack", subAction: "stand", stateId: d.body.state.stateId });
  assertEquals(b.body.payout, a.body.payout); assertEquals(b.body.retry, true); assertEquals(S.gold, g);
});
