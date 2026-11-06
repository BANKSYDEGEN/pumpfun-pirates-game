// [v333] Pure-gold casino_play — Harbor gold ONLY (ZERO crypto/tokens). Matches js/casino/ui.js contract.
// Games: blackjack | roulette | dice | slots. Atomic debit/credit via 048 pvp_casino_debit / pvp_casino_credit.
export const CASINO_ACTIONS = ["casino_play"] as const;
export type CasinoAction = (typeof CASINO_ACTIONS)[number];

export const MIN_BET = 10;
export const MAX_BET = 25000;

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SLOT_SYMS = ["doubloon", "anchor", "skull", "compass", "ruby", "chest", "crown"] as const;
// Weighted pirate reels — ZERO crypto symbols
const SLOT_WEIGHTS: Record<string, number> = {
  doubloon: 22, anchor: 18, skull: 16, compass: 16, ruby: 12, chest: 10, crown: 6,
};
const SLOT_PAY3: Record<string, number> = {
  crown: 25, chest: 12, ruby: 8, doubloon: 5, skull: 4, anchor: 3, compass: 3,
};

type Ctx = {
  db: any;
  whoAmI: (b: Record<string, unknown>) => Promise<any>;
  json: (status: number, body: Record<string, unknown>) => Response;
  acctBump?: (db: any, raw: string, delta: number) => Promise<void>;
};

const reqOf = (r: unknown) => typeof r === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(r) ? r : "";
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
  if (!choice || typeof choice !== "object") return { win: false, mult: 0, label: "bad" };
  const type = String(choice.type || "");
  const val = choice.val;
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

function newReq() {
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function casinoAction(c: Ctx, action: string, b: Record<string, unknown>): Promise<Response> {
  if (action !== "casino_play") return c.json(400, { error: "bad action" });
  const who = await c.whoAmI(b); if (!who) return c.json(401, { error: "no identity" });
  const pid = who.pid, db = c.db;
  const game = String(b.game || "");
  if (!["blackjack", "roulette", "dice", "slots"].includes(game)) return c.json(400, { error: "bad game" });

  // Guard: refuse any crypto/token wording in payload (defense in depth)
  const blob = JSON.stringify(b).toLowerCase();
  if (/\b(sol|usdc|crypto|token|wallet.?pay|phantom|spl)\b/.test(blob)) {
    return c.json(400, { error: "gold only" });
  }

  try {
    if (game === "roulette") return await playRoulette(c, who, b);
    if (game === "dice") return await playDice(c, who, b);
    if (game === "slots") return await playSlots(c, who, b);
    return await playBlackjack(c, who, b);
  } catch (e: any) {
    console.error("[casino]", game, e?.code || "", e?.message || e);
    if (/pvp_casino_|PGRST202|42883/.test(`${e?.code || ""} ${e?.message || ""}`)) {
      return c.json(409, { error: "closed" });
    }
    return c.json(500, { error: "casino error" });
  }
}

async function playRoulette(c: Ctx, who: any, b: Record<string, unknown>) {
  const bet = betOf(b.bet); if (!bet) return c.json(400, { error: "bad bet" });
  const req = reqOf(b.reqId) || newReq();
  const deb = await debit(c.db, who.pid, bet, req, "roulette");
  if (!deb?.ok) return c.json(deb?.why === "not enough gold" ? 402 : 409, { error: deb?.why || "could not", gold: deb?.gold });
  if (!who.wallet && !who.owner && !deb.owner && !deb.retry) await c.acctBump?.(c.db, who.raw, -bet);

  const n = cryptoInt(37); // 0..36 European
  const choices = Array.isArray(b.choice) ? b.choice : [b.choice];
  let payout = 0;
  const detail: any[] = [];
  const per = Math.floor(bet / Math.max(1, choices.length));
  for (const ch of choices) {
    const ev = evalRouletteBet(n, ch);
    const winPay = ev.win ? per * ev.mult : 0;
    payout += winPay;
    detail.push({ ...ev, bet: per, payout: winPay, choice: ch });
  }
  const cred = await credit(c.db, who.pid, payout, "roulette", `n=${n}`);
  if (!who.wallet && !who.owner && !cred?.owner && payout > 0) await c.acctBump?.(c.db, who.raw, payout);
  const gold = cred?.gold ?? deb.gold;
  const delta = payout - bet;
  return c.json(200, {
    ok: true, game: "roulette", gold, delta, payout, outcome: payout > 0 ? "win" : "lose",
    detail: { number: n, color: n === 0 ? "green" : RED.has(n) ? "red" : "black", bets: detail },
    state: null,
  });
}

async function playDice(c: Ctx, who: any, b: Record<string, unknown>) {
  const bet = betOf(b.bet); if (!bet) return c.json(400, { error: "bad bet" });
  const choice = String(b.choice || "");
  if (!["under7", "over7", "lucky7", "doubles"].includes(choice)) return c.json(400, { error: "bad choice" });
  const req = reqOf(b.reqId) || newReq();
  const deb = await debit(c.db, who.pid, bet, req, "dice");
  if (!deb?.ok) return c.json(deb?.why === "not enough gold" ? 402 : 409, { error: deb?.why || "could not", gold: deb?.gold });
  if (!who.wallet && !who.owner && !deb.owner && !deb.retry) await c.acctBump?.(c.db, who.raw, -bet);

  const d1 = cryptoInt(6) + 1, d2 = cryptoInt(6) + 1, sum = d1 + d2;
  let mult = 0, win = false;
  if (choice === "under7" && sum >= 2 && sum <= 6) { win = true; mult = sum <= 5 ? 2.2 : 2; }
  else if (choice === "over7" && sum >= 8 && sum <= 12) { win = true; mult = sum >= 9 ? 2.2 : 2; }
  else if (choice === "lucky7" && sum === 7) { win = true; mult = 4; }
  else if (choice === "doubles" && d1 === d2) { win = true; mult = 5; }
  const payout = win ? Math.floor(bet * mult) : 0;
  const cred = await credit(c.db, who.pid, payout, "dice", `${d1}+${d2}`);
  if (!who.wallet && !who.owner && !cred?.owner && payout > 0) await c.acctBump?.(c.db, who.raw, payout);
  return c.json(200, {
    ok: true, game: "dice", gold: cred?.gold ?? deb.gold, delta: payout - bet, payout,
    outcome: win ? "win" : "lose",
    detail: { d1, d2, sum, choice, mult },
    state: null,
  });
}

async function playSlots(c: Ctx, who: any, b: Record<string, unknown>) {
  const bet = betOf(b.bet); if (!bet) return c.json(400, { error: "bad bet" });
  const req = reqOf(b.reqId) || newReq();
  const deb = await debit(c.db, who.pid, bet, req, "slots");
  if (!deb?.ok) return c.json(deb?.why === "not enough gold" ? 402 : 409, { error: deb?.why || "could not", gold: deb?.gold });
  if (!who.wallet && !who.owner && !deb.owner && !deb.retry) await c.acctBump?.(c.db, who.raw, -bet);

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
  const cred = await credit(c.db, who.pid, payout, "slots", reels.join(","));
  if (!who.wallet && !who.owner && !cred?.owner && payout > 0) await c.acctBump?.(c.db, who.raw, payout);
  return c.json(200, {
    ok: true, game: "slots", gold: cred?.gold ?? deb.gold, delta: payout - bet, payout,
    outcome: payout > 0 ? "win" : "lose",
    detail: { reels, mult },
    state: null,
  });
}

async function playBlackjack(c: Ctx, who: any, b: Record<string, unknown>) {
  const sub = b.subAction ? String(b.subAction) : "";
  const db = c.db, pid = who.pid;

  // Instant resolve (no subAction): deal + auto stand/dealer
  if (!sub) {
    const bet = betOf(b.bet); if (!bet) return c.json(400, { error: "bad bet" });
    const req = reqOf(b.reqId) || newReq();
    const deb = await debit(db, pid, bet, req, "blackjack");
    if (!deb?.ok) return c.json(deb?.why === "not enough gold" ? 402 : 409, { error: deb?.why || "could not", gold: deb?.gold });
    if (!who.wallet && !who.owner && !deb.owner && !deb.retry) await c.acctBump?.(db, who.raw, -bet);
    const deck = shuffleDeck();
    const player = [deck.pop()!, deck.pop()!];
    const dealer = [deck.pop()!, deck.pop()!];
    return settleBJ(c, who, bet, player, dealer, deck, deb, false);
  }

  if (sub === "deal") {
    const bet = betOf(b.bet); if (!bet) return c.json(400, { error: "bad bet" });
    const req = reqOf(b.reqId) || newReq();
    const stateId = stateIdOf(b.stateId) || newReq();
    const deb = await debit(db, pid, bet, req, "blackjack");
    if (!deb?.ok) return c.json(deb?.why === "not enough gold" ? 402 : 409, { error: deb?.why || "could not", gold: deb?.gold });
    if (!who.wallet && !who.owner && !deb.owner && !deb.retry) await c.acctBump?.(db, who.raw, -bet);
    const deck = shuffleDeck();
    const player = [deck.pop()!, deck.pop()!];
    const dealer = [deck.pop()!, deck.pop()!];
    // Natural blackjack ends immediately
    if (isBJ(player) || isBJ(dealer)) {
      await db.from("pvp_casino_hands").upsert({
        player_id: pid, state_id: stateId, game: "blackjack", bet, player, dealer, deck, doubled: false, status: "done", updated_at: new Date().toISOString(),
      });
      return settleBJ(c, who, bet, player, dealer, deck, deb, false, stateId);
    }
    await db.from("pvp_casino_hands").upsert({
      player_id: pid, state_id: stateId, game: "blackjack", bet, player, dealer, deck, doubled: false, status: "open", updated_at: new Date().toISOString(),
    });
    return c.json(200, {
      ok: true, game: "blackjack", gold: deb.gold, delta: -bet, payout: 0, outcome: "deal",
      detail: { player, dealer: [dealer[0], null], total: handTotal(player) },
      state: { stateId, status: "open", canHit: true, canDouble: true },
    });
  }

  // hit / stand / double — load hand
  const stateId = stateIdOf(b.stateId);
  if (!stateId) return c.json(400, { error: "bad state" });
  const { data: hand } = await db.from("pvp_casino_hands").select("*").eq("player_id", pid).eq("state_id", stateId).maybeSingle();
  if (!hand || hand.status !== "open") return c.json(409, { error: "no hand" });
  let player: number[] = hand.player || [];
  let dealer: number[] = hand.dealer || [];
  let deck: number[] = hand.deck || [];
  let bet = hand.bet | 0;
  let doubled = !!hand.doubled;

  if (sub === "hit") {
    player.push(deck.pop()!);
    if (handTotal(player) > 21) {
      await db.from("pvp_casino_hands").update({ player, deck, status: "done", updated_at: new Date().toISOString() }).eq("player_id", pid);
      const goldRow = await credit(db, pid, 0, "blackjack", "bust");
      return c.json(200, {
        ok: true, game: "blackjack", gold: goldRow?.gold, delta: -bet, payout: 0, outcome: "bust",
        detail: { player, dealer, total: handTotal(player), dealerTotal: handTotal(dealer) },
        state: { stateId, status: "done" },
      });
    }
    await db.from("pvp_casino_hands").update({ player, deck, updated_at: new Date().toISOString() }).eq("player_id", pid);
    return c.json(200, {
      ok: true, game: "blackjack", gold: null, delta: 0, payout: 0, outcome: "hit",
      detail: { player, dealer: [dealer[0], null], total: handTotal(player) },
      state: { stateId, status: "open", canHit: true, canDouble: false },
    });
  }

  if (sub === "double") {
    if (player.length !== 2 || doubled) return c.json(409, { error: "cannot double" });
    const req = reqOf(b.reqId) || newReq();
    const deb = await debit(db, pid, bet, req, "blackjack");
    if (!deb?.ok) return c.json(deb?.why === "not enough gold" ? 402 : 409, { error: deb?.why || "could not", gold: deb?.gold });
    if (!who.wallet && !who.owner && !deb.owner && !deb.retry) await c.acctBump?.(db, who.raw, -bet);
    bet = bet * 2; doubled = true;
    player.push(deck.pop()!);
    await db.from("pvp_casino_hands").update({ player, deck, bet, doubled: true, updated_at: new Date().toISOString() }).eq("player_id", pid);
    if (handTotal(player) > 21) {
      await db.from("pvp_casino_hands").update({ status: "done" }).eq("player_id", pid);
      const goldRow = await credit(db, pid, 0, "blackjack", "bust");
      return c.json(200, {
        ok: true, game: "blackjack", gold: goldRow?.gold, delta: -bet, payout: 0, outcome: "bust",
        detail: { player, dealer, total: handTotal(player) },
        state: { stateId, status: "done" },
      });
    }
    // auto stand after double
  }

  if (sub === "stand" || sub === "double") {
    while (handTotal(dealer) < 17) dealer.push(deck.pop()!);
    await db.from("pvp_casino_hands").update({ player, dealer, deck, status: "done", updated_at: new Date().toISOString() }).eq("player_id", pid);
    return settleBJ(c, who, bet, player, dealer, deck, { gold: null }, doubled, stateId);
  }

  return c.json(400, { error: "bad subAction" });
}

async function settleBJ(c: Ctx, who: any, bet: number, player: number[], dealer: number[], _deck: number[], deb: any, _doubled: boolean, stateId?: string) {
  const pt = handTotal(player), dt = handTotal(dealer);
  const pbj = isBJ(player), dbj = isBJ(dealer);
  let payout = 0, outcome = "lose";
  if (pt > 21) { payout = 0; outcome = "bust"; }
  else if (pbj && !dbj) { payout = Math.floor(bet * 2.5); outcome = "blackjack"; } // 3:2
  else if (dbj && !pbj) { payout = 0; outcome = "lose"; }
  else if (dt > 21 || pt > dt) { payout = bet * 2; outcome = "win"; }
  else if (pt === dt) { payout = bet; outcome = "push"; }
  else { payout = 0; outcome = "lose"; }
  const cred = await credit(c.db, who.pid, payout, "blackjack", outcome);
  if (!who.wallet && !who.owner && !cred?.owner && payout > 0) await c.acctBump?.(c.db, who.raw, payout);
  return c.json(200, {
    ok: true, game: "blackjack", gold: cred?.gold ?? deb?.gold, delta: payout - bet, payout, outcome,
    detail: { player, dealer, total: pt, dealerTotal: dt, blackjack: pbj },
    state: stateId ? { stateId, status: "done" } : null,
  });
}
