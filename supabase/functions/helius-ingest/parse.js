// Turns one Helius enhanced transaction into at most one trade row per watched mint, from real on-chain transfers only.
// Trader = fee payer. Side = sign of the fee payer's net change in the watched mint. The pool/curve that sent (buy) or
// received (sell) the watched token is the counterparty; the quote is what that counterparty took in (buy) or paid out (sell).
export const MINTS = { '39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump': 'AHOY', 'By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump': 'SUNK' };
export const WSOL = 'So11111111111111111111111111111111111111112';
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const shortWallet = w => typeof w === 'string' && w.length > 8 ? w.slice(0, 4) + '…' + w.slice(-4) : null;
export function parseTrades(tx) {
  if (!tx || typeof tx !== 'object' || tx.transactionError) return [];
  const sig = tx.signature, fp = tx.feePayer, ts = num(tx.timestamp);
  if (typeof sig !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig) || typeof fp !== 'string' || !ts) return [];
  const tt = Array.isArray(tx.tokenTransfers) ? tx.tokenTransfers : [], nt = Array.isArray(tx.nativeTransfers) ? tx.nativeTransfers : [];
  const out = [];
  for (const mint of Object.keys(MINTS)) {
    const mine = tt.filter(x => x?.mint === mint);
    if (!mine.length) continue;
    let delta = 0; const cp = {};
    for (const x of mine) { const a = num(x.tokenAmount);
      if (x.toUserAccount === fp && x.fromUserAccount !== fp) { delta += a; cp[x.fromUserAccount] = (cp[x.fromUserAccount] || 0) + a; }
      if (x.fromUserAccount === fp && x.toUserAccount !== fp) { delta -= a; cp[x.toUserAccount] = (cp[x.toUserAccount] || 0) + a; } }
    if (Math.abs(delta) < 1e-6) continue; // arbitrage / pass-through / no trade by the signer
    const side = delta > 0 ? 'buy' : 'sell';
    const c = Object.entries(cp).sort((a, b) => b[1] - a[1])[0]?.[0]; if (!c) continue;
    // Quote flow at the counterparty, per mint (lamports normalised to SOL as WSOL).
    const q = {};
    for (const x of tt) { if (!x || x.mint === mint) continue; const a = num(x.tokenAmount);
      if (side === 'buy' && x.toUserAccount === c && x.fromUserAccount !== c) q[x.mint] = (q[x.mint] || 0) + a;
      if (side === 'sell' && x.fromUserAccount === c && x.toUserAccount !== c) q[x.mint] = (q[x.mint] || 0) + a; }
    for (const x of nt) { const a = num(x?.amount) / 1e9;
      if (side === 'buy' && x?.toUserAccount === c && x.fromUserAccount !== c) q[WSOL] = (q[WSOL] || 0) + a;
      if (side === 'sell' && x?.fromUserAccount === c && x.toUserAccount !== c) q[WSOL] = (q[WSOL] || 0) + a; }
    const qm = q[WSOL] > 0 ? WSOL : Object.keys(q).sort((a, b) => (a in MINTS ? -1 : 0) - (b in MINTS ? -1 : 0) || q[b] - q[a])[0];
    if (!qm || !(q[qm] > 0)) continue; // a plain token transfer (no quote paid back) is not a trade
    let sol = qm === WSOL ? q[qm] : null;
    const sw = tx.events?.swap; // Helius-decoded route totals, when present, give the SOL leg of routed trades.
    if (sol == null && sw) { const v = side === 'buy' ? num(sw.nativeInput?.amount) : num(sw.nativeOutput?.amount); if (v > 0) sol = v / 1e9; }
    if (sol == null) { let o = 0, i = 0; // the signer's own wrapped-SOL leg (routed buys/sells)
      for (const x of tt) if (x?.mint === WSOL) { if (x.fromUserAccount === fp && x.toUserAccount !== fp) o += num(x.tokenAmount); if (x.toUserAccount === fp && x.fromUserAccount !== fp) i += num(x.tokenAmount); }
      const v = side === 'buy' ? o - i : i - o; if (v > 0) sol = v; }
    out.push({ signature: sig, mint, side, token_amount: Math.abs(delta), quote_mint: qm, quote_amount: q[qm], sol_amount: sol, usd: null,
      wallet_short: shortWallet(fp), venue: typeof tx.source === 'string' ? tx.source.slice(0, 32) : null, block_time: new Date(ts * 1000).toISOString() });
  }
  // One row per signature (table key): keep the watched mint with the largest move; SUNK<->AHOY trades are recorded under SUNK.
  if (out.length > 1) out.sort((a, b) => (a.mint === 'By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump' ? -1 : 1));
  return out.slice(0, 1);
}
