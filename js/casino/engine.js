// [Timothy] THE GOLDEN DOUBLOON CASINO: the game rules, the response reader and the practice table (pure, no DOM, testable in node).
// Contract (the pvp edge function, Emerly): pvp.inv.call('casino_play', { game, bet, choice, action, stateId, reqId })
//   -> { ok: true, gold, delta, outcome, detail, state }   (gold = the new balance, delta = the change this call: +win / -loss / 0 push)
// readResult() accepts the fields top-level or nested (result / data / detail / state) so a server that shapes them a little differently still reads.
// Practice table (createLocalCasino): the same contract on this device with crypto.getRandomValues, used for ?casinoqa=1 and whenever the
// server casino is unavailable. It plays from its own PRACTICE PURSE and never touches the player's real gold.
// Amounts are GOLD only (100 GOLD, 100g).

export const CHIPS = [10, 25, 50, 100, 250, 500];
export const MIN_BET = 10, MAX_BET = 5000;
export const GAMES = ['blackjack', 'roulette', 'dice', 'slots'];
export const SLOT_SYMBOLS = ['doubloon', 'anchor', 'skull', 'crown', 'ruby', 'chest', 'seven'];
export const SLOT_PAYS = { seven: 25, chest: 15, crown: 10, doubloon: 8, ruby: 6, anchor: 4, skull: 3 };   // three of a kind (x bet, total return)
export const SLOT_PAIR = 2;                                                                             // any two matching
export const DICE_BETS = { under7: 2, seven: 4, over7: 2, doubles: 5 };                                  // total return (x bet)
export const ROULETTE_PAYS = { color: 2, parity: 2, half: 2, dozen: 3, straight: 36 };
export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const pocketColor = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

export const fmtGold = (n) => Math.round(Number(n) || 0).toLocaleString('en-US') + ' GOLD';
export const fmtG = (n) => Math.round(Number(n) || 0).toLocaleString('en-US') + 'g';
export const clampBet = (b, gold) => Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(Number(b) || 0), Math.max(MIN_BET, Math.floor(Number(gold) || 0))));

// ---- roulette choices: objects { kind, value } or strings ('red', 'odd', 'low', 'dozen1' / '1st12', 'number:7', '7', 'n:17') ----
export function parseRouletteChoice(c) {
  if (c == null) return null;
  if (typeof c === 'number') return Number.isInteger(c) && c >= 0 && c <= 36 ? { kind: 'straight', value: c } : null;
  if (typeof c === 'object') {
    const k = String(c.kind || c.type || c.bet || '').toLowerCase(), v = c.value ?? c.v ?? c.pick ?? c.number;
    if (k === 'straight' || k === 'number' || k === 'n') return parseRouletteChoice(Number(v));
    if (k === 'color' || k === 'colour') return /^(red|black)(?![\s\S])/i.test(String(v)) ? { kind: 'color', value: String(v).toLowerCase() } : null;
    if (k === 'parity') return /^(odd|even)(?![\s\S])/i.test(String(v)) ? { kind: 'parity', value: String(v).toLowerCase() } : null;
    if (k === 'half') { const s = String(v).toLowerCase(); return s === 'low' || s === '1-18' ? { kind: 'half', value: 'low' } : s === 'high' || s === '19-36' ? { kind: 'half', value: 'high' } : null; }
    if (k === 'dozen') { const d = Number(String(v).replace(/\D/g, '')); return d >= 1 && d <= 3 ? { kind: 'dozen', value: d } : null; }
    return k ? parseRouletteChoice(k + (v != null ? ':' + v : '')) : null;
  }
  const s = String(c).trim().toLowerCase();
  if (s === 'red' || s === 'black') return { kind: 'color', value: s };
  if (s === 'odd' || s === 'even') return { kind: 'parity', value: s };
  if (s === 'low' || s === '1-18' || s === '1to18') return { kind: 'half', value: 'low' };
  if (s === 'high' || s === '19-36' || s === '19to36') return { kind: 'half', value: 'high' };
  let m = /^(?:dozen|doz|d)[:_ -]?([123])(?![\s\S])/.exec(s) || /^([123])(?:st|nd|rd)[ _-]?12(?![\s\S])/.exec(s); if (m) return { kind: 'dozen', value: +m[1] };
  m = /^(?:number|num|n|straight)?[:_ -]?(\d{1,2})(?![\s\S])/.exec(s); if (m) return parseRouletteChoice(+m[1]);
  return null;
}
export function rouletteMult(choice, n) {   // total return multiple (0 = lost)
  const c = parseRouletteChoice(choice); if (!c) return 0;
  if (c.kind === 'straight') return c.value === n ? ROULETTE_PAYS.straight : 0;
  if (n === 0) return 0;
  if (c.kind === 'color') return pocketColor(n) === c.value ? 2 : 0;
  if (c.kind === 'parity') return (n % 2 === 0 ? 'even' : 'odd') === c.value ? 2 : 0;
  if (c.kind === 'half') return (n <= 18 ? 'low' : 'high') === c.value ? 2 : 0;
  if (c.kind === 'dozen') return Math.ceil(n / 12) === c.value ? 3 : 0;
  return 0;
}
export const rouletteLabel = (choice) => { const c = parseRouletteChoice(choice); if (!c) return '';
  return c.kind === 'straight' ? 'NUMBER ' + c.value : c.kind === 'dozen' ? ['1ST', '2ND', '3RD'][c.value - 1] + ' 12' : c.kind === 'half' ? (c.value === 'low' ? '1-18' : '19-36') : String(c.value).toUpperCase(); };

// ---- dice ----
export function parseDiceChoice(c) { const s = String((c && typeof c === 'object' ? c.value ?? c.kind : c) || '').toLowerCase().replace(/[\s_-]/g, '');
  if (/^(under7|under|low|lt7)(?![\s\S])/.test(s)) return 'under7'; if (/^(seven|lucky7|7|lucky)(?![\s\S])/.test(s)) return 'seven'; if (/^(over7|over|high|gt7)(?![\s\S])/.test(s)) return 'over7'; if (/^(doubles|double|pair)(?![\s\S])/.test(s)) return 'doubles'; return null; }
export function diceMult(choice, d1, d2) { const c = parseDiceChoice(choice), s = d1 + d2; if (!c) return 0;
  return c === 'under7' ? (s < 7 ? 2 : 0) : c === 'seven' ? (s === 7 ? 4 : 0) : c === 'over7' ? (s > 7 ? 2 : 0) : d1 === d2 ? 5 : 0; }

// ---- slots ----
export function slotsMult(reels) { const [a, b, c] = reels; if (a === b && b === c) return SLOT_PAYS[a] || 0; if (a === b || b === c || a === c) return SLOT_PAIR; return 0; }

// ---- blackjack ----
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
export function readCard(c) {   // 'AS', '10H', 'K♠', 'TD', { rank, suit } / { r, s } / 1..13 -> { r, s } ; null / '??' / { hidden } -> null
  if (c == null || c === '??' || c === '?' || (typeof c === 'object' && (c.hidden || c.down))) return null;
  if (typeof c === 'number') return { r: RANKS[(c - 1) % 13] || 'A', s: 'S' };
  if (typeof c === 'object') { const r = String(c.rank ?? c.r ?? c.value ?? '').toUpperCase(), s = String(c.suit ?? c.s ?? 'S'); return readCard(r.replace(/^1(?![\s\S])/, 'A').replace(/^11(?![\s\S])/, 'J').replace(/^12(?![\s\S])/, 'Q').replace(/^13(?![\s\S])/, 'K').replace(/^T(?![\s\S])/, '10') + s); }
  const m = /^(10|[2-9AJQKT1])\s*([SHDC♠♥♦♣]|SPADES?|HEARTS?|DIAMONDS?|CLUBS?)?(?![\s\S])/i.exec(String(c).trim()); if (!m) return null;
  const r = m[1].toUpperCase() === 'T' ? '10' : m[1].toUpperCase() === '1' ? 'A' : m[1].toUpperCase(), sv = (m[2] || 'S').toUpperCase();
  const s = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' }[sv] || sv[0]; return { r, s: SUITS.includes(s) ? s : 'S' };
}
export function handTotal(cards) { let t = 0, aces = 0; for (const c0 of cards) { const c = readCard(c0); if (!c) continue; if (c.r === 'A') { aces++; t += 11; } else t += /^(J|Q|K|10)(?![\s\S])/.test(c.r) ? 10 : +c.r; }
  while (t > 21 && aces) { t -= 10; aces--; } return t; }
export const isNatural = (cards) => cards.length === 2 && handTotal(cards) === 21;

// ---- RNG: crypto.getRandomValues (rejection sampling, no modulo bias) ----
export function cryptoInt(n) { const lim = Math.floor(4294967296 / n) * n, b = new Uint32Array(1); let v;
  do { globalThis.crypto.getRandomValues(b); v = b[0]; } while (v >= lim); return v % n; }
export const newReqId = () => { const b = new Uint8Array(12); globalThis.crypto.getRandomValues(b); return 'cas_' + Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); };

// ---- the response reader (online + practice): top-level or nested fields ----
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : undefined);
const first = (...v) => v.find(x => x !== undefined && x !== null);
export function readResult(raw, game) {
  const r0 = raw && typeof raw === 'object' ? raw : {}, r = r0.result && typeof r0.result === 'object' ? { ...r0, ...r0.result } : r0.data && typeof r0.data === 'object' && !Array.isArray(r0.data) ? { ...r0, ...r0.data } : r0;
  const st = r.state && typeof r.state === 'object' ? r.state : {}, dt = r.detail && typeof r.detail === 'object' ? r.detail : {}, d = { ...st, ...dt };
  const ok = r.ok !== false && !r.error;
  const gold = num(first(r.gold, r.balance, r.newGold, d.gold, d.balance));
  const delta = num(first(r.delta, r.net, r.change, d.delta, d.net, r.payout !== undefined && r.bet !== undefined ? num(r.payout) - num(r.bet) : undefined));
  let outcome = String(first(r.outcome, d.outcome, r.result && typeof r.result === 'string' ? r.result : undefined, '') || '').toLowerCase();
  const out = { ok, error: r.error ? String(r.error) : null, game: first(r.game, d.game, game), gold, delta, outcome, detail: d, raw };
  if (game === 'roulette') { const n = num(first(d.number, d.pocket, d.n, d.result, r.number, r.pocket)); out.number = n; out.color = first(d.color, n !== undefined ? pocketColor(n) : undefined); }
  if (game === 'dice') { let dice = first(d.dice, d.roll, r.dice, r.roll); if (!Array.isArray(dice)) { const a = num(first(d.d1, d.die1, r.d1)), b = num(first(d.d2, d.die2, r.d2)); dice = a && b ? [a, b] : undefined; }
    out.dice = dice ? dice.map(Number) : undefined; out.sum = out.dice ? out.dice[0] + out.dice[1] : num(d.sum); }
  if (game === 'slots') { const reels = first(d.reels, d.symbols, d.slots, r.reels, r.symbols); out.reels = Array.isArray(reels) ? reels.map(s => String(s).toLowerCase()) : undefined; }
  if (game === 'blackjack') {
    const P = first(d.player, d.playerHand, d.hand, d.playerCards, r.player, r.playerHand), Dl = first(d.dealer, d.dealerHand, d.dealerCards, r.dealer, r.dealerHand);
    out.player = Array.isArray(P) ? P : []; out.dealer = Array.isArray(Dl) ? Dl : [];
    out.stateId = first(r.stateId, st.stateId, st.id, d.stateId, typeof r.state === 'string' ? r.state : undefined) ?? null;
    const phase = String(first(st.phase, d.phase, st.status, d.status, '') || '').toLowerCase();
    const fin = first(d.finished, d.done, st.done, st.finished, r.finished, r.done);
    out.finished = fin !== undefined ? !!fin : phase ? /done|over|settled|finished|end/.test(phase) : /win|lose|lost|push|bust|blackjack|natural/.test(outcome);
    out.canDouble = first(d.canDouble, st.canDouble, out.player.length === 2) && !out.finished;
    out.bet = num(first(d.bet, st.bet, r.bet));
  }
  if (!out.outcome) out.outcome = out.delta > 0 ? 'win' : out.delta < 0 ? 'lose' : out.delta === 0 ? 'push' : '';
  return out;
}
// is this failure "the casino is not there" (offline / not deployed yet) rather than a game error (not enough gold, bad bet)?
export const unavailable = (raw) => raw == null || raw === false || (typeof raw === 'object' && raw.ok === false &&
  /offline|unknown|unsupported|not.?implemented|not.?found|bad action|invalid action|no such|404|network|fetch|timeout|unavailable|disabled/i.test(String(raw.error || raw.message || '')));

// ---- the practice table: same contract, its own purse ----
export function createLocalCasino({ purse = 1000, rng = cryptoInt } = {}) {
  let gold = Math.max(0, Math.floor(purse)); const hands = new Map();
  const card = () => ({ r: RANKS[rng(13)], s: SUITS[rng(4)] });
  const fail = (error) => ({ ok: false, error, gold });
  const settle = (game, delta, outcome, detail, state = { phase: 'done' }) => { gold += delta; return { ok: true, gold, delta, outcome, detail, state }; };
  function play(req = {}) {
    const game = String(req.game || ''); if (!GAMES.includes(game)) return fail('unknown game');
    if (game === 'blackjack' && req.action && req.action !== 'deal') return blackjackAct(req);
    const bet = Math.floor(Number(req.bet)); if (!(bet >= MIN_BET) || bet > MAX_BET) return fail('bet must be ' + MIN_BET + ' to ' + MAX_BET + ' gold');
    if (bet > gold) return fail('not enough gold');
    if (game === 'roulette') { const c = parseRouletteChoice(req.choice); if (!c) return fail('pick a bet on the table');
      const n = rng(37), m = rouletteMult(c, n); return settle(game, m ? bet * (m - 1) : -bet, m ? 'win' : 'lose', { number: n, color: pocketColor(n), choice: c, mult: m, bet }); }
    if (game === 'dice') { const c = parseDiceChoice(req.choice); if (!c) return fail('pick a bet');
      const d1 = rng(6) + 1, d2 = rng(6) + 1, m = diceMult(c, d1, d2); return settle(game, m ? bet * (m - 1) : -bet, m ? 'win' : 'lose', { dice: [d1, d2], sum: d1 + d2, choice: c, mult: m, bet }); }
    if (game === 'slots') { const reels = [0, 1, 2].map(() => SLOT_SYMBOLS[rng(SLOT_SYMBOLS.length)]), m = slotsMult(reels);
      return settle(game, m ? bet * (m - 1) : -bet, m ? 'win' : 'lose', { reels, mult: m, line: reels[0] === reels[1] && reels[1] === reels[2] ? 'three' : m ? 'pair' : 'none', bet }); }
    // blackjack deal
    const P = [card(), card()], D = [card(), card()], id = newReqId().replace('cas_', 'bj_');
    if (isNatural(P) || isNatural(D)) { const pn = isNatural(P), dn = isNatural(D), delta = pn && dn ? 0 : pn ? Math.floor(bet * 1.5) : -bet;
      return settle(game, delta, pn && dn ? 'push' : pn ? 'blackjack' : 'lose', bjDetail(P, D, bet, true)); }
    hands.set(id, { P, D, bet }); return { ok: true, gold, delta: 0, outcome: 'playing', detail: bjDetail(P, D, bet, false), state: { stateId: id, phase: 'player', canDouble: bet * 2 <= gold } };
  }
  function bjDetail(P, D, bet, done) { return { player: P, dealer: done ? D : [D[0], null], playerTotal: handTotal(P), dealerTotal: done ? handTotal(D) : handTotal([D[0]]), bet, finished: done }; }
  function blackjackAct(req) {
    const h = hands.get(req.stateId); if (!h) return fail('that hand is over');
    const a = String(req.action).toLowerCase();
    if (a === 'double') { if (h.P.length !== 2 || h.bet * 2 > gold) return fail('cannot double now'); h.bet *= 2; h.P.push(card()); if (handTotal(h.P) > 21) { hands.delete(req.stateId); return settle('blackjack', -h.bet, 'bust', bjDetail(h.P, h.D, h.bet, true)); } return stand(req.stateId, h); }
    if (a === 'hit') { h.P.push(card()); const t = handTotal(h.P); if (t > 21) { hands.delete(req.stateId); return settle('blackjack', -h.bet, 'bust', bjDetail(h.P, h.D, h.bet, true)); }
      if (t === 21) return stand(req.stateId, h); return { ok: true, gold, delta: 0, outcome: 'playing', detail: bjDetail(h.P, h.D, h.bet, false), state: { stateId: req.stateId, phase: 'player', canDouble: false } }; }
    if (a === 'stand') return stand(req.stateId, h);
    return fail('unknown action');
  }
  function stand(id, h) { hands.delete(id); while (handTotal(h.D) < 17) h.D.push(card());
    const p = handTotal(h.P), d = handTotal(h.D), delta = d > 21 || p > d ? h.bet : p < d ? -h.bet : 0;
    return settle('blackjack', delta, delta > 0 ? 'win' : delta < 0 ? 'lose' : 'push', bjDetail(h.P, h.D, h.bet, true)); }
  return { play: (req) => Promise.resolve(play(req)), playSync: play, get gold() { return gold; }, set gold(v) { gold = Math.max(0, Math.floor(v)); } };
}

// [v342] save this device first (Promise.race: never wait more than 2.5 s for it)
export async function flushSave(pvp) { try { const p = pvp?.(); const f = p?.flushNow ? p.flushNow() : p?.save?.({ now: true, force: true }); await Promise.race([Promise.resolve(f), new Promise(r => setTimeout(r, 2500))]); } catch {} }
// [v342] no balance in the reply (old server): the local change. A blackjack follow-up (hit / stand / double) reports delta = payout - the WHOLE
// bet, but the deal already took the first bet here, so only the rest moves (the double's extra stake, the payout).
export function localChange(game, action, raw, res) {
  const delta = Number(res?.delta) || 0;
  if (game !== 'blackjack' || !action || action === 'deal') return delta;
  const pv = raw?.payout ?? res?.detail?.payout; if (pv == null || !Number.isFinite(Number(pv))) return delta;   // no payout to split by: the reply's delta as-is
  const payout = Number(pv), full = payout - delta, first = action === 'double' ? full / 2 : full;
  return Math.round(delta + first);
}
// ---- the client: the server casino when it is there, else the practice table (sticky for the session) ----
export function createCasinoClient({ pvp = () => null, getGold = () => 0, setGold = () => {}, qa = false, purse } = {}) {
  let practice = null, why = qa ? 'qa' : null;
  const local = () => (practice ||= createLocalCasino({ purse: purse ?? Math.max(1000, Math.floor(getGold() || 0)) }));
  const live = () => !qa && !why && typeof pvp()?.inv?.call === 'function';
  async function play(game, { bet, choice, action, stateId } = {}) {
    const req = { game, bet: Math.floor(Number(bet) || 0), choice: choice ?? null, action: action || null, stateId: stateId || null, reqId: newReqId() };
    if (live()) {
      const wager = game !== 'blackjack' || !action || action === 'deal' || action === 'double';
      if (wager) await flushSave(pvp);   // [v342] gold earned at sea / in the harbor reaches the server BEFORE it debits the bet
      const send = async () => { try { return await pvp().inv.call('casino_play', req); } catch (e) { return null; } };
      let raw = await send();
      if (raw && raw.ok === false && /no save yet/i.test(String(raw.error || raw.why || ''))) { await flushSave(pvp); req.reqId = newReqId(); raw = await send(); }   // [v342] first wager on a new device: save, then retry once
      if (!unavailable(raw)) { const res = readResult(raw, game);
        if (res.ok) {
          // [v342] BANKSY t1810u/t1811u: the server's balance IS the balance (it already debited / credited it): re-base every save path on it
          if (typeof res.gold === 'number') setGold(res.gold, { fromServer: true, rev: raw?.rev ?? null, owner: !!raw?.owner });
          else if (typeof res.delta === 'number' && !raw?.gold_landed) { const ch = localChange(game, action, raw, res); if (ch) setGold((Number(getGold()) || 0) + ch); } }   // pvp.inv.call already landed a nonzero gold_landed
        res.mode = 'live'; return res; }
      if (game === 'blackjack' && action && action !== 'deal') { const res = readResult({ ok: false, error: 'the dealer lost the hand: deal again' }, game); res.mode = 'live'; return res; }
      why = 'offline';
    }
    const res = readResult(await local().play(req), game); res.mode = 'practice'; return res;
  }
  return { play, get mode() { return live() ? 'live' : 'practice'; }, get why() { return why; }, get purse() { return practice ? practice.gold : null; }, gold: () => (live() ? Number(getGold()) || 0 : local().gold), local };
}
