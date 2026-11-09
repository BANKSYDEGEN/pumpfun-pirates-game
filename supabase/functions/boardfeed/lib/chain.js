// hq-data-v2 (BANKSY t2448u "Add all of those"): pure on-chain math for the Helius backup source. No I/O, no keys.
// Every figure comes from real account data; anything that does not match the verified layout returns null (never a guess).
export const SUNK = 'By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump', AHOY = '39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump';
export const PUMP = 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn', WSOL = 'So11111111111111111111111111111111111111112';
export const CURVE_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', PUMPSWAP_PROGRAM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
export const SYSTEM_PROGRAM = '11111111111111111111111111111111';
// Verified Nov 9 2026 from chain: $SUNK curve (quote = $AHOY), $AHOY PumpSwap pool (base AHOY, quote PUMP).
export const SUNK_CURVE = 'Gyv6bpd6MLrPMYY4zdyE7hzWpcG3C6TnhnsEFqKoLT5b', AHOY_POOL = '6X2DJ4sAq6fYkUwz2Q5PWEJ4KfSUqzcUD5WRhmTV9zD4';
export const DECIMALS = 6; // SUNK, AHOY and PUMP all use 6 decimals (verified via getAsset token_info)
const A58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function bs58(bytes) { let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b); let o = ''; while (n > 0n) { o = A58[Number(n % 58n)] + o; n /= 58n; } for (const b of bytes) { if (b === 0) o = '1' + o; else break; } return o; }
export const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const u64 = (b, o) => new DataView(b.buffer, b.byteOffset, b.byteLength).getBigUint64(o, true);
// pump.fun curve: 8-byte discriminator, u64 virtualToken, virtualQuote, realToken, realQuote, supply, bool complete.
export function curvePrice(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 49) return null;
  const vt = u64(bytes, 8), vq = u64(bytes, 16);
  if (bytes[48] === 1 || vt <= 0n || vq <= 0n) return null; // completed curve: price lives in the pool now
  return Number(vq) / Number(vt); // quote per token; both sides 6 decimals
}
// PumpSwap pool account: disc(8) bump(1) index(2) creator base quote lp baseVault quoteVault (32 bytes each).
export function poolLayout(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 203) return null;
  const pk = o => bs58(bytes.subarray(o, o + 32));
  return { base: pk(43), quote: pk(75), baseVault: pk(139), quoteVault: pk(171) };
}
export function poolPrice(baseUi, quoteUi) { return Number.isFinite(baseUi) && Number.isFinite(quoteUi) && baseUi > 0 && quoteUi > 0 ? quoteUi / baseUi : null; }
// USD prices from real reserves: AHOY = (PUMP per AHOY) x PUMP/USD; SUNK = (AHOY per SUNK) x AHOY/USD.
export function chainPrices({ ahoyInPump, sunkInAhoy, pumpUsd, ahoySupplyUi, sunkSupplyUi }) {
  const out = {};
  if (ahoyInPump > 0 && pumpUsd > 0) { const p = ahoyInPump * pumpUsd; out.AHOY = { price: p, cap: ahoySupplyUi > 0 ? p * ahoySupplyUi : null }; }
  if (out.AHOY && sunkInAhoy > 0) { const p = sunkInAhoy * out.AHOY.price; out.SUNK = { price: p, cap: sunkSupplyUi > 0 ? p * sunkSupplyUi : null }; }
  return out;
}
export const shortWallet = w => typeof w === 'string' && w.length > 8 ? w.slice(0, 4) + '…' + w.slice(-4) : null;
// Holder ranking from a FULL nonzero scan. accounts: [{owner, amount(string)}]; programOwned: Set of owners that are not wallets
// (curve, pool, other program PDAs); hidden: Set of owners never shown (e.g. the owner's own wallets). Returns null on bad input.
export function rankHolders(accounts, { programOwned = new Set(), hidden = new Set(), labels = {}, top = 10 } = {}) {
  if (!Array.isArray(accounts)) return null;
  const byOwner = new Map(); let total = 0n;
  for (const a of accounts) { if (!a?.owner || !/^\d+$/.test(String(a.amount))) continue; const v = BigInt(a.amount); if (v <= 0n) continue; total += v; byOwner.set(a.owner, (byOwner.get(a.owner) || 0n) + v); }
  if (total <= 0n) return null;
  const pct = v => Number(v * 1000000n / total) / 10000;
  const ranked = [...byOwner.entries()].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));
  const wallets = ranked.filter(([o]) => !programOwned.has(o));
  const top10 = wallets.slice(0, 10).reduce((s, [, v]) => s + v, 0n);
  const rows = [];
  for (const [o, v] of ranked) {
    if (rows.length >= top) break;
    if (hidden.has(o)) continue; // never shown, never shortened, never counted as a row
    const label = labels[o] || (programOwned.has(o) ? 'Program account' : null);
    rows.push({ wallet: label ? null : shortWallet(o), label, pct: pct(v), amount: Number(v) / 10 ** DECIMALS });
  }
  return { holders: byOwner.size, top10Pct: pct(top10), rows, hiddenCount: [...hidden].filter(h => byOwner.has(h)).length };
}
export const parseHidden = s => new Set(String(s || '').split(/[\s,]+/).filter(x => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x)));
