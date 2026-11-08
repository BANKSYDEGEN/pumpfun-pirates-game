import { BOARD_ROWS } from './boardgrid.js';
// Free latest profiles are CANDIDATES, not proof of payment. Verify tokenProfile orders.
import { safeMint, safeText, safeImg, selectPair } from './market.js';

const API = 'https://api.dexscreener.com';
export const DEX_PAID_CACHE_MS = 30000;

export function makeDexPaidFeed({ fetcher = (...a) => fetch(...a), clock = () => Date.now() } = {}) {
  const state = { rows: [], status: 'Loading…', updatedAt: null };
  let next = 0, busy = null;
  async function get(path) {
    const c = new AbortController(), timeout = setTimeout(() => c.abort(), 8000);
    try { const r = await fetcher(API + path, { signal: c.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!r.ok) throw Error('feed unavailable'); return await r.json();
    } finally { clearTimeout(timeout); }
  }
  async function refresh() {
    try {
      const profiles = await get('/token-profiles/latest/v1'), seen = new Set();
      const candidates = (Array.isArray(profiles) ? profiles : []).filter(t => t.chainId === 'solana' && safeMint(t.tokenAddress) && t.tokenAddress.endsWith('pump') && !seen.has(t.tokenAddress) && (seen.add(t.tokenAddress), true)).slice(0, 10);
      const rows = [];
      // At most 10 order checks / 120s. Two concurrent; never the paid trade stream.
      let index = 0;
      async function worker() { while (index < candidates.length) {
        const t = candidates[index++], j = await get('/orders/v1/solana/' + t.tokenAddress);
        const orders = Array.isArray(j) ? j : j.orders || [];
        const paid = orders.filter(o => o.type === 'tokenProfile' && o.status === 'approved' && o.chainId === 'solana' && o.tokenAddress === t.tokenAddress && Number.isFinite(o.paymentTimestamp) && o.paymentTimestamp > 0 && o.paymentTimestamp <= clock()).sort((a,b) => b.paymentTimestamp - a.paymentTimestamp)[0];
        if (paid) rows.push({ mint: t.tokenAddress, symbol: t.tokenAddress.slice(0,4) + '…' + t.tokenAddress.slice(-4), name: '', paidAt: paid.paymentTimestamp, mcUsd: null, imageUrl: null, verifiedPaid: true });
      } }
      await Promise.all([worker(), worker()]);
      rows.sort((a,b) => b.paidAt - a.paidAt);
      const top = rows.slice(0,BOARD_ROWS);
      if (top.length) try {
        const pairs = await get('/tokens/v1/solana/' + top.map(r => r.mint).join(','));
        for (const row of top) { const pair = selectPair(pairs, row.mint); if (!pair) continue;
          row.symbol = safeText(pair.baseToken.symbol) || row.symbol; row.name = safeText(pair.baseToken.name); row.mcUsd = Number.isFinite(+pair.marketCap) && pair.marketCap != null ? +pair.marketCap : null; row.imageUrl = safeImg(pair.info?.imageUrl);
        }
      } catch {} // Payment proof remains useful without optional market caps.
      state.rows = top; state.updatedAt = clock(); state.status = top.length ? 'Verified paid token profiles · 120s snapshots' : 'No verified recent paid profiles';
    } catch { state.status = state.rows.length ? 'Feed offline · cached paid profiles' : 'Feed offline'; }
    return state.rows;
  }
  function fetchDexJustPaid() { if (busy) return busy; if (clock() < next) return Promise.resolve(state.rows);
    next = clock() + DEX_PAID_CACHE_MS; busy = refresh().finally(() => { busy = null; }); return busy; }
  return { state, fetchDexJustPaid };
}
export const dexPaidFeed = makeDexPaidFeed();
export const fetchDexJustPaid = () => dexPaidFeed.fetchDexJustPaid();
