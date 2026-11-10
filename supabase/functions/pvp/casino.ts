// [v333] Pure-gold casino_play — Harbor gold ONLY (ZERO crypto/tokens). Matches js/casino/ui.js contract.
// Games: blackjack | roulette | dice | slots. Atomic debit/credit via 048 pvp_casino_debit / pvp_casino_credit.
export const CASINO_ACTIONS = ["casino_play"] as const;
export type CasinoAction = (typeof CASINO_ACTIONS)[number];

export const MIN_BET = 10;
export const MAX_BET = 25000;

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SLOT_SYMS = ["doubloon", "anchor", "skull", "crown", "ruby", "chest", "seven"] as const;
// Weighted pirate reels — ZERO crypto symbols
const SLOT_WEIGHTS: Record<string, number> = {
  doubloon: 22, anchor: 18, skull: 16, crown: 10, ruby: 12, chest: 10, seven: 6,
};
const SLOT_PAY3: Record<string, number> = {
  seven: 25, chest: 15, crown: 10, doubloon: 8, ruby: 6, anchor: 4, skull: 3,
};

type Ctx = {
  db: any;
  whoAmI: (b: Record<string, unknown>) => Promise<any>;
  json: (status: number, body: Record<string, unknown>) => Response;
  acctBump?: (db: any, raw: string, delta: number) => Promise<void>;
};

const reqOf = (r: unknown) => typeof r === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(r) ? r : ""; // = pvp_purchases.req check (16-64)
const betOf = (b: unknown) => {
  const n = Math.floor(Number(b));
  return Number.isFinite(n) && n >= MIN_BET && n <= MAX_BET ? n : 0;
};
const stateIdOf = (s: unknown) => typeof s === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : "";

function cryptoInt(max: number) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}
function shuffleDeck(): number[] {
  // 52-card shoe as 0..51 (rank = i%13, suit = i/13); A=0..K=12
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i--) {
    const j = cryptoInt(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
const BJ_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const BJ_SUITS = ["S", "H", "D", "C"];
function fmtCard(c: number | null) { return c == null ? null : `${BJ_RANKS[c % 13]}${BJ_SUITS[Math.floor(c / 13) % 4]}`; }
function fmtHand(cs: (number | null)[]) { return cs.map(fmtCard); }
function cardRank(c: number) { return c % 13; }
function cardVal(c: number) { const r = cardRank(c); return r >= 10 ? 10 : r === 0 ? 11 : r + 1; }
function handTotal(cards: number[]) {
  let t = 0, aces = 0;
  for (const c of cards) { const v = cardVal(c); t += v; if (cardRank(c) === 0) aces++; }
  while (t > 21 && aces > 0) { t -= 10; aces--; }
  return t;
}
function isBJ(cards: number[]) { return cards.length === 2 && handTotal(cards) === 21; }

function pickSlotSym() {
  const total = Object.values(SLOT_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = cryptoInt(total);
  for (const s of SLOT_SYMS) { r -= SLOT_WEIGHTS[s]; if (r < 0) return s; }
  return "doubloon";
}

function evalRouletteBet(n: number, choice: any): { win: boolean; mult: number; label: string } {
  if (typeof choice === "number" && Number.isInteger(choice) && choice >= 0 && choice <= 36) return { win: choice === n, mult: 36, label: "straight" };
  if (typeof choice === "string") {
    const s = choice.trim().toLowerCase();
    if (s === "red" || s === "black") choice = { type: "color", val: s };
    else if (s === "odd" || s === "even") choice = { type: "parity", val: s };
    else if (s === "low" || s === "1-18") choice = { type: "half", val: "low" };
    else if (s === "high" || s === "19-36") choice = { type: "half", val: "high" };
    else if (/^(?:dozen|doz|d)[:_ -]?([123])$|^([123])(?:st|nd|rd)[ _-]?12$/.test(s)) choice = { type: "dozen", val: Number(s.replace(/\D/g, "")[0]) };
    else if (/^(?:number:|n:)?\d{1,2}$/.test(s)) choice = { type: "straight", val: Number(s.replace(/\D/g, "")) };
  }
  if (!choice || typeof choice !== "object") return { win: false, mult: 0, label: "bad" };
  const type = String(choice.type || choice.kind || choice.bet || "").toLowerCase();
  const val = choice.val ?? choice.value ?? choice.v ?? choice.number;
  if (type === "color") {
    if (n === 0) return { win: false, mult: 2, label: "color" };
    const want = String(val);
    const isRed = RED.has(n);
    return { win: (want === "red" && isRed) || (want === "black" && !isRed), mult: 2, label: "color" };
  }
  if (type === "parity") {
    if (n === 0) return { win: false, mult: 2, label: "parity" };
    const odd = n % 2 === 1;
    return { win: (val === "odd" && odd) || (val === "even" && !odd), mult: 2, label: "parity" };
  }
  if (type === "half") {
    if (n === 0) return { win: false, mult: 2, label: "half" };
    return { win: (val === "low" && n >= 1 && n <= 18) || (val === "high" && n >= 19 && n <= 36), mult: 2, label: "half" };
  }
  if (type === "dozen") {
    if (n === 0) return { win: false, mult: 3, label: "dozen" };
    const d = Number(val);
    return { win: (d === 1 && n <= 12) || (d === 2 && n >= 13 && n <= 24) || (d === 3 && n >= 25 && n <= 36), mult: 3, label: "dozen" };
  }
  if (type === "straight") {
    return { win: Number(val) === n, mult: 36, label: "straight" };
  }
  return { win: false, mult: 0, label: "bad" };
}

// [security C1/H3 2026-11-09] Every round is settled ONCE through pvp_casino_settle (migration 20261110020000): it writes the
// round's result to pvp_casino_results under a unique key (the request id, or 'bjs:' + the blackjack hand id) and credits the
// payout in the same transaction. A replayed request id never plays again: pvp_casino_debit hands back the stored result, the bet
// is the ORIGINAL debit (prev.price) and nothing is credited twice. A blackjack hand moves open -> done with a conditional UPDATE
// (status = 'open' and the same updated_at), so concurrent stand / double / hit calls can't settle one hand twice.
async function debit(db: any, pid: string, bet: number, req: string, game: string) {
  const { data, error } = await db.rpc("pvp_casino_debit", { p_player: pid, p_bet: bet, p_req: req, p_game: game });
  if (error) throw error;
  return data;
}
async function credit(db: any, pid: string, payout: number, game: string, note?: string) {
  const { data, error } = await db.rpc("pvp_casino_credit", { p_player: pid, p_payout: payout, p_game: game, p_note: note || null });
  if (error) throw error;
  return data;
}
async function settle(db: any, pid: string, key: string, game: string, bet: number, payout: number, note: string, body: Record<string, unknown>) {
  const { data, error } = await db.rpc("pvp_casino_settle", { p_player: pid, p_key: key, p_game: game, p_bet: bet, p_payout: payout, p_note: note || null, p_body: body });
  if (error) throw error;
  return data;
}
async function storedResult(db: any, pid: string, key: string) {
  const { data } = await db.from("pvp_casino_results").select("body").eq("req", key).eq("player_id", pid).maybeSingle();
  return data?.body ?? null;
}

// [v342] every reply carries the shop rev + the owner flag so the client re-bases its save (no second debit, no 409 / 422)
const meta = (who: any, deb: any, cred: any) => ({ rev: cred?.rev ?? deb?.rev ?? null, owner: !!(who?.owner || deb?.owner || cred?.owner) });

function newReq() {
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// the stored reply of an already-settled round, with today's balance (pvp_casino_credit with 0 only reads it)
async function replay(c: Ctx, who: any, game: string, stored: any) {
  const cur = await credit(c.db, who.pid, 0, game, "replay");
  return c.json(200, { ...stored, ...meta(who, null, cur), gold: cur?.gold, retry: true });
}
const busy = (c: Ctx) => c.json(409, { error: "That bet is still being settled. Check your balance in a moment." });

export async function casinoAction(c: Ctx, action: string, b: Record<string, unknown>): Promise<Response> {
  if (action !== "casino_play") return c.json(400, { error: "bad action" });
  const who = await c.whoAmI(b); if (!who) return c.json(401, { error: "no identity" });
  const game = String(b.game || "");
  if (!["blackjack", "roulette", "dice", "slots"].includes(game)) return c.json(400, { error: "bad game" });

  // Guard: refuse any crypto/token wording in payload (defense in depth)
  const blob = JSON.stringify(b).toLowerCase();
  if (/\b(sol|usdc|crypto|token|wallet.?pay|phantom|spl)\b/.test(blob)) {
    return c.json(400, { error: "gold only" });
  }

  try {
    if (game === "roulette") return await oneShot(c, who, b, "roulette", rollRoulette(b));
    if (game === "dice") {
      const rawCh = String((b.choice && typeof b.choice === "object" ? (b.choice as any).value ?? (b.choice as any).kind : b.choice) || "").toLowerCase();
      const choice = rawCh === "seven" || rawCh === "7" ? "lucky7" : rawCh;
      if (!["under7", "over7", "lucky7", "doubles"].includes(choice)) return c.json(400, { error: "bad choice" });
      return await oneShot(c, who, b, "dice", rollDice(choice));
    }
    if (game === "slots") return await oneShot(c, who, b, "slots", rollSlots);
    return await playBlackjack(c, who, b);
  } catch (e: any) {
    console.error("[casino]", game, e?.code || "", e?.message || e);
    if (/pvp_casino_|PGRST202|42883/.test(`${e?.code || ""} ${e?.message || ""}`)) {
      return c.json(409, { error: "closed" });
    }
    return c.json(500, { error: "casino error" });
  }
}

type Roll = (bet: number) => { payout: number; outcome?: string; detail: Record<string, unknown>; note: string };

// roulette / dice / slots: debit (or find the original debit) -> roll -> settle once
export async function oneShot(c: Ctx, who: any, b: Record<string, unknown>, game: string, roll: Roll) {
  const asked = betOf(b.bet); if (!asked) return c.json(400, { error: "bad bet" });
  const req = reqOf(b.reqId) || newReq();
  const deb = await debit(c.db, who.pid, asked, req, game);
  if (!deb?.ok) return c.json(deb?.why === "not enough gold" ? 402 : 409, { error: deb?.why || "could not", gold: deb?.gold });
  if (deb.retry) {
    if (deb.game && deb.game !== game) return c.json(409, { error: "that request id was already used" });
    if (deb.result) return replay(c, who, game, deb.result);   // the same round again: same outcome, nothing paid twice
  }
  if (!who.wallet && !who.owner && !deb.owner && !deb.retry) await c.acctBump?.(c.db, who.raw, -asked);
  const bet = Math.floor(Number(deb.debited)) || asked;   // the ORIGINAL debit decides the stake
  const r = roll(bet);
  const body = { ok: true, game, delta: r.payout - bet, payout: r.payout, outcome: r.outcome ?? (r.payout > 0 ? "win" : "lose"), detail: r.detail, state: null };
  const st = await settle(c.db, who.pid, req, game, bet, r.payout, r.note, body);
  if (!st?.ok) { if (st?.why === "settled") return st.stored ? replay(c, who, game, st.stored) : busy(c); return c.json(409, { error: st?.why || "could not" }); }
  if (!who.wallet && !who.owner && !st.owner && r.payout > 0) await c.acctBump?.(c.db, who.raw, r.payout);
  return c.json(200, { ...body, ...meta(who, deb, st), gold: st.gold ?? deb.gold });
}

export const rollRoulette = (b: Record<string, unknown>): Roll => (bet) => {
  const n = cryptoInt(37); // 0..36 European
  const choices = Array.isArray(b.choice) ? b.choice : [b.choice];
  let payout = 0;
  const bets: any[] = [];
  const per = Math.floor(bet / Math.max(1, choices.length));
  for (const ch of choices) {
    const ev = evalRouletteBet(n, ch);
    const winPay = ev.win ? per * ev.mult : 0;
    payout += winPay;
    bets.push({ ...ev, bet: per, payout: winPay, choice: ch });
  }
  return { payout, detail: { number: n, color: n === 0 ? "green" : RED.has(n) ? "red" : "black", bets }, note: `n=${n}` };
};

export const rollDice = (choice: string): Roll => (bet) => {
  const d1 = cryptoInt(6) + 1, d2 = cryptoInt(6) + 1, sum = d1 + d2;
  let mult = 0, win = false;
  if (choice === "under7" && sum >= 2 && sum <= 6) { win = true; mult = sum <= 5 ? 2.2 : 2; }
  else if (choice === "over7" && sum >= 8 && sum <= 12) { win = true; mult = sum >= 9 ? 2.2 : 2; }
  else if (choice === "lucky7" && sum === 7) { win = true; mult = 4; }
  else if (choice === "doubles" && d1 === d2) { win = true; mult = 5; }
  const payout = win ? Math.floor(bet * mult) : 0;
  return { payout, detail: { dice: [d1, d2], d1, d2, sum, choice, mult }, note: `${d1}+${d2}` };
};

export const rollSlots: Roll = (bet) => {
  const reels = [pickSlotSym(), pickSlotSym(), pickSlotSym()];
  let mult = 0;
  if (reels[0] === reels[1] && reels[1] === reels[2]) mult = SLOT_PAY3[reels[0]] || 0;
  else {
    const crowns = reels.filter((s) => s === "crown").length;
    const doub = reels.filter((s) => s === "doubloon").length;
    if (crowns >= 2) mult = 2;
    else if (doub >= 2) mult = 1.5;
  }
  const payout = mult > 0 ? Math.floor(bet * mult) : 0;
  return { payout, detail: { reels, mult }, note: reels.join(",") };
};

export function bjOutcome(bet: number, player: number[], dealer: number[]) {
  const pt = handTotal(player), dt = handTotal(dealer), pbj = isBJ(player), dbj = isBJ(dealer);
  let payout = 0, outcome = "lose";
  if (pt > 21) { payout = 0; outcome = "bust"; }
  else if (pbj && !dbj) { payout = Math.floor(bet * 2.5); outcome = "blackjack"; } // 3:2
  else if (dbj && !pbj) { payout = 0; outcome = "lose"; }
  else if (dt > 21 || pt > dt) { payout = bet * 2; outcome = "win"; }
  else if (pt === dt) { payout = bet; outcome = "push"; }
  return { payout, outcome, pt, dt, pbj };
}
const bjDone = (bet: number, player: number[], dealer: number[], stateId: string | null) => {
  const o = bjOutcome(bet, player, dealer);
  return { o, body: { ok: true, game: "blackjack", delta: o.payout - bet, payout: o.payout, outcome: o.outcome,
    detail: { player: fmtHand(player), dealer: fmtHand(dealer), total: o.pt, playerTotal: o.pt, dealerTotal: o.dt, blackjack: o.pbj, finished: true },
    state: stateId ? { stateId, status: "done" } : null } };
};
// settle a finished hand once; a lost race returns the winner's stored reply
async function bjSettle(c: Ctx, who: any, key: string, bet: number, player: number[], dealer: number[], stateId: string | null, deb: any) {
  const { o, body } = bjDone(bet, player, dealer, stateId);
  const st = await settle(c.db, who.pid, key, "blackjack", bet, o.payout, o.outcome, body);
  if (!st?.ok) { if (st?.why === "settled") return st.stored ? replay(c, who, "blackjack", st.stored) : busy(c); return c.json(409, { error: st?.why || "could not" }); }
  if (!who.wallet && !who.owner && !st.owner && o.payout > 0) await c.acctBump?.(c.db, who.raw, o.payout);
  return c.json(200, { ...body, ...meta(who, deb, st), gold: st.gold ?? deb?.gold });
}

async function playBlackjack(c: Ctx, who: any, b: Record<string, unknown>) {
  const sub = b.subAction ? String(b.subAction) : (b.bjAction ? String(b.bjAction) : "");
  const db = c.db, pid = who.pid;

  if (!sub || sub === "deal") {   // no subAction = instant resolve (deal + auto stand)
    const asked = betOf(b.bet); if (!asked) return c.json(400, { error: "bad bet" });
    const req = reqOf(b.reqId) || newReq();
    const deb = await debit(db, pid, asked, req, "blackjack");
    if (!deb?.ok) return c.json(deb?.why === "not enough gold" ? 402 : 409, { error: deb?.why || "could not", gold: deb?.gold });
    if (deb.retry) {
      if (deb.game && deb.game !== "blackjack") return c.json(409, { error: "that request id was already used" });
      if (deb.result) return replay(c, who, "blackjack", deb.result);
    }
    if (!who.wallet && !who.owner && !deb.owner && !deb.retry) await c.acctBump?.(db, who.raw, -asked);
    const bet = Math.floor(Number(deb.debited)) || asked;
    const deck = shuffleDeck();
    const player = [deck.pop()!, deck.pop()!];
    const dealer = [deck.pop()!, deck.pop()!];
    if (!sub) { while (handTotal(dealer) < 17) dealer.push(deck.pop()!); return bjSettle(c, who, req, bet, player, dealer, null, deb); }
    const stateId = newReq();   // always the server's id: a reused client id could collide with a settled hand
    if (isBJ(player) || isBJ(dealer)) {   // natural blackjack ends immediately
      const { o, body } = bjDone(bet, player, dealer, stateId);
      const st = await settle(db, pid, req, "blackjack", bet, o.payout, o.outcome, body);
      if (!st?.ok) { if (st?.why === "settled") return st.stored ? replay(c, who, "blackjack", st.stored) : busy(c); return c.json(409, { error: st?.why || "could not" }); }
      await db.from("pvp_casino_hands").upsert({ player_id: pid, state_id: stateId, game: "blackjack", bet, player, dealer, deck, doubled: false, status: "done", updated_at: new Date().toISOString() });
      if (!who.wallet && !who.owner && !st.owner && o.payout > 0) await c.acctBump?.(db, who.raw, o.payout);
      return c.json(200, { ...body, ...meta(who, deb, st), gold: st.gold ?? deb.gold });
    }
    const body = { ok: true, game: "blackjack", delta: -bet, payout: 0, outcome: "deal",
      detail: { player: fmtHand(player), dealer: [fmtCard(dealer[0]), null], total: handTotal(player), playerTotal: handTotal(player) },
      state: { stateId, status: "open", canHit: true, canDouble: true } };
    // the deal is recorded under the request id FIRST (payout 0): a replayed deal gets this same hand back, never a new one
    const st = await settle(db, pid, req, "blackjack", bet, 0, "deal", body);
    if (!st?.ok) { if (st?.why === "settled") return st.stored ? replay(c, who, "blackjack", st.stored) : busy(c); return c.json(409, { error: st?.why || "could not" }); }
    const { error: he } = await db.from("pvp_casino_hands").upsert({ player_id: pid, state_id: stateId, game: "blackjack", bet, player, dealer, deck, doubled: false, status: "open", updated_at: new Date().toISOString() });
    if (he) throw he;
    return c.json(200, { ...body, ...meta(who, deb, st), gold: st.gold ?? deb.gold });
  }

  // hit / stand / double on the open hand
  const stateId = stateIdOf(b.stateId);
  if (!stateId) return c.json(400, { error: "bad state" });
  if (!["hit", "stand", "double"].includes(sub)) return c.json(400, { error: "bad subAction" });
  const { data: rl } = await db.rpc("pvp_rl_hit", { p_key: "casinoa:" + pid, p_window_s: 60, p_max: 120 });
  if (rl === false) return c.json(409, { error: "slow down" });
  const doneKey = "bjs:" + stateId;
  const { data: hand } = await db.from("pvp_casino_hands").select("*").eq("player_id", pid).eq("state_id", stateId).maybeSingle();
  if (!hand || hand.status !== "open") {
    const stored = await storedResult(db, pid, doneKey);
    return stored ? replay(c, who, "blackjack", stored) : c.json(409, { error: "no hand" });
  }
  const player: number[] = [...(hand.player || [])], dealer: number[] = [...(hand.dealer || [])], deck: number[] = [...(hand.deck || [])];
  const baseBet = hand.bet | 0;
  // the one conditional write that moves this hand on (only one concurrent call can win it)
  const step = async (patch: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    let q = db.from("pvp_casino_hands").update({ ...patch, updated_at: new Date().toISOString() }).eq("player_id", pid).eq("state_id", stateId).eq("status", "open").eq("updated_at", hand.updated_at);
    for (const [k, v] of Object.entries(extra)) q = q.eq(k, v);
    const { data, error } = await q.select("state_id");
    if (error) throw error;
    return Array.isArray(data) && data.length === 1;
  };
  const lost = async () => { const stored = await storedResult(db, pid, doneKey); return stored ? replay(c, who, "blackjack", stored) : busy(c); };

  if (sub === "hit") {
    player.push(deck.pop()!);
    const bust = handTotal(player) > 21;
    if (!(await step({ player, deck, ...(bust ? { status: "done" } : {}) }))) return lost();
    if (bust) return bjSettle(c, who, doneKey, baseBet * (hand.doubled ? 2 : 1), player, dealer, stateId, null);
    return c.json(200, {
      ok: true, game: "blackjack", ...meta(who, null, null), gold: null, delta: 0, payout: 0, outcome: "hit",
      detail: { player: fmtHand(player), dealer: [fmtCard(dealer[0]), null], total: handTotal(player), playerTotal: handTotal(player) },
      state: { stateId, status: "open", canHit: true, canDouble: false },
    });
  }

  let bet = baseBet * (hand.doubled ? 2 : 1), deb: any = null, dreq = "";
  if (sub === "double") {
    if (player.length !== 2 || hand.doubled) return c.json(409, { error: "cannot double" });
    dreq = reqOf(b.reqId) || newReq();
    deb = await debit(db, pid, baseBet, dreq, "blackjack");
    if (!deb?.ok) return c.json(deb?.why === "not enough gold" ? 402 : 409, { error: deb?.why || "could not", gold: deb?.gold });
    if (deb.retry) return lost();   // this double was already sent: its hand result (or nothing yet), never a second double
    if (!who.wallet && !who.owner && !deb.owner) await c.acctBump?.(db, who.raw, -baseBet);
    player.push(deck.pop()!);
    bet = baseBet * 2;
  }
  if (handTotal(player) <= 21) while (handTotal(dealer) < 17) dealer.push(deck.pop()!);   // stand (and the auto stand after a double)
  const won = await step({ player, dealer, deck, status: "done", ...(sub === "double" ? { doubled: true } : {}) }, sub === "double" ? { doubled: false } : {});
  if (!won) {
    if (deb) { // another call moved the hand first: give the double's stake back (once, keyed by the hand) and answer like it
      const back = await settle(db, pid, "bjr:" + dreq, "blackjack", baseBet, baseBet, "double refund", { refund: true });
      if (back?.ok && !who.wallet && !who.owner && !back.owner) await c.acctBump?.(db, who.raw, baseBet);
    }
    return lost();
  }
  return bjSettle(c, who, doneKey, bet, player, dealer, stateId, deb);
}
