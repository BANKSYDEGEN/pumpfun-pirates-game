// Extra free HQ board feeds (BANKSY t2262u "work on all the boards"). Keyless, CORS-open, already in CSP connect-src.
// Pure parsers + one fetch per feed; market.js calls them inside its 120 s discovery pass. Never invents rows.
import { safeMint, safeText, safeImg, selectPair } from './market.js';
const DEX = 'https://api.dexscreener.com', GT = 'https://api.geckoterminal.com/api/v2/networks/solana';
const finite = v => v !== null && v !== '' && v !== undefined && Number.isFinite(+v) ? +v : null;
// Standard pump.fun bonding curve (SOL quote): 30 virtual SOL x 1,073,000,000 virtual tokens, graduates after 793,100,000 tokens are sold.
// Progress is therefore an exact function of the curve price in SOL: sold = 1.073e9 - sqrt(k / priceSol). Labelled "≈" on every board.
const CURVE_K = 30 * 1.073e9, CURVE_T0 = 1.073e9, CURVE_SELL = 793.1e6;
export function curveProgress(priceSol) { const p = finite(priceSol); if (!p || p <= 0) return null; return (CURVE_T0 - Math.sqrt(CURVE_K / p)) / CURVE_SELL * 100; }
export const BOND_MIN = 60, BOND_MAX = 99.5; // >= 99.5 % is complete / migrating, so it is not "about to" bond
const uniq = rows => { const seen = new Set(); return rows.filter(r => !seen.has(r.mint) && (seen.add(r.mint), true)); };
const gtRows = j => { const toks = new Map((j?.included || []).map(t => [t.id, t.attributes])); return (Array.isArray(j?.data) ? j.data : []).map(p => ({ p, a: p.attributes || {}, base: toks.get(p.relationships?.base_token?.data?.id), dex: p.relationships?.dex?.data?.id || '' })); };
// pump.fun bonding-curve pools (GeckoTerminal dex "pump-fun"), SOL-quoted, with progress from the curve price.
export function parseCurvePools(j) { const out = [];
  for (const { a, base, dex } of gtRows(j)) { const mint = base?.address, at = Date.parse(a.pool_created_at); if (dex !== 'pump-fun' || !safeMint(mint) || !/\/ SOL$/.test(String(a.name || ''))) continue;
    const progress = curveProgress(a.base_token_price_native_currency); if (progress == null) continue;
    out.push({ mint, symbol: safeText(base.symbol), name: safeText(base.name), progress, createdAt: Number.isFinite(at) ? at : null, cap: finite(a.fdv_usd), volume: finite(a.volume_usd?.h24), change: finite(a.price_change_percentage?.h24), venue: 'curve', imageUrl: safeImg(base.image_url) }); }
  return out; }
// ABOUT TO BOND: 60..99.5 % bonded, most-bonded first.
export const aboutToBond = rows => uniq(rows.filter(r => r.progress >= BOND_MIN && r.progress < BOND_MAX).sort((x, y) => y.progress - x.progress)).slice(0, 5);
export const parseBonding = j => aboutToBond(parseCurvePools(j));
// PumpSwap pools (where pump.fun tokens migrate on graduation) for pump.fun mints, SOL-quoted.
export function parseSwapPools(j) { const out = [];
  for (const { a, base, dex } of gtRows(j)) { const mint = base?.address, at = Date.parse(a.pool_created_at);
    if (dex !== 'pumpswap' || !safeMint(mint) || !mint.endsWith('pump') || !/\/ SOL$/.test(String(a.name || ''))) continue;
    out.push({ mint, symbol: safeText(base.symbol), name: safeText(base.name), createdAt: Number.isFinite(at) ? at : null, cap: finite(a.market_cap_usd) ?? finite(a.fdv_usd), volume: finite(a.volume_usd?.h24), change: finite(a.price_change_percentage?.h24), venue: 'pumpswap', imageUrl: safeImg(base.image_url) }); }
  return out; }
// VOLUME LEADERS: pump.fun tokens on PumpSwap ranked by real 24h pool volume.
export const volumeLeaders = rows => uniq([...rows].filter(r => r.volume != null).sort((x, y) => y.volume - x.volume)).slice(0, 5);
// JUST MIGRATED: pump.fun curves that completed (>= 99.5 % bonded) or new PumpSwap pools for pump.fun mints, opened in the last 24 h, newest first.
export const MIGRATED_WINDOW_MS = 86400000;
export const justMigrated = (rows, now = Date.now()) => uniq([...rows].filter(r => r.createdAt != null && now - r.createdAt >= 0 && now - r.createdAt < MIGRATED_WINDOW_MS && (r.venue === 'pumpswap' || r.progress >= BOND_MAX)).sort((x, y) => y.createdAt - x.createdAt)).slice(0, 5);
// CALLOUT FEED: DexScreener token-boosts/latest is a stream of PAID boost events (newest first). Pump.fun mints only; first-seen time is ours.
export function parseCallouts(j, seenAt = new Map(), now = Date.now()) { const out = [], dup = new Set();
  for (const t of Array.isArray(j) ? j : []) { if (t.chainId !== 'solana' || !safeMint(t.tokenAddress) || !t.tokenAddress.endsWith('pump')) continue;
    const id = t.tokenAddress + ':' + (finite(t.totalAmount) || 0); if (dup.has(id)) continue; dup.add(id); if (!seenAt.has(id)) seenAt.set(id, now);
    out.push({ mint: t.tokenAddress, symbol: t.tokenAddress.slice(0, 4) + '…' + t.tokenAddress.slice(-4), boost: finite(t.amount) || 0, amount: finite(t.totalAmount) || 0, seenAt: seenAt.get(id), cap: null, change: null }); }
  if (seenAt.size > 400) for (const k of [...seenAt.keys()].slice(0, seenAt.size - 400)) seenAt.delete(k);
  return out.slice(0, 20); }
export function enrich(rows, pairs) { for (const r of rows) { const p = selectPair(pairs, r.mint); if (!p) continue; r.symbol = safeText(p.baseToken.symbol) || r.symbol; r.name = safeText(p.baseToken.name); r.cap = finite(p.marketCap) ?? finite(p.fdv); r.change = finite(p.priceChange?.h24); r.imageUrl = r.imageUrl || safeImg(p.info?.imageUrl); } return rows; }
// One pass, three GeckoTerminal reads: curve pools by volume, PumpSwap pools by volume, newest pools.
export async function fetchPumpBoards(get, now = Date.now()) { const soft = u => get(u).catch(() => null);
  const [curveJ, swapJ, freshJ] = await Promise.all([get(GT + '/dexes/pump-fun/pools?sort=h24_volume_usd_desc&include=base_token&page=1'), soft(GT + '/dexes/pumpswap/pools?sort=h24_volume_usd_desc&include=base_token&page=1'), soft(GT + '/new_pools?include=base_token&page=1')]);
  const curve = parseCurvePools(curveJ), swap = [...parseSwapPools(swapJ), ...parseSwapPools(freshJ)], freshCurve = parseCurvePools(freshJ);
  return { bonding: aboutToBond([...curve, ...freshCurve]), volume: volumeLeaders([...curve, ...swap]), migrated: justMigrated([...curve, ...freshCurve, ...swap], now) }; }
// OUR TOKENS detail: GeckoTerminal holder count (token info) + 24 hourly closes for the chart, from the token's main DexScreener pool.
export async function fetchTokenDetail(get, mint, pool, { skipHolders = false } = {}) { const out = { holders: null, chart: [] };
  await Promise.all([
    (async () => { if (skipHolders) return; try { const j = await get(GT + '/tokens/' + mint + '/info'); out.holders = finite(j?.data?.attributes?.holders?.count); } catch {} })(),
    (async () => { if (!safeMint(pool)) return; try { const j = await get(GT + '/pools/' + pool + '/ohlcv/hour?aggregate=1&limit=24&currency=usd');
      const list = j?.data?.attributes?.ohlcv_list; out.chart = (Array.isArray(list) ? list : []).map(c => [finite(c[0]), finite(c[4])]).filter(([t, c]) => t != null && c != null && c > 0).sort((a, b) => a[0] - b[0]); } catch {} })()]);
  return out; }
const calloutSeen = new Map();
export async function fetchCallouts(get, now = Date.now(), seen = calloutSeen) { const rows = parseCallouts(await get(DEX + '/token-boosts/latest/v1'), seen, now);
  if (rows.length) try { const mints = [...new Set(rows.map(r => r.mint))].slice(0, 30); enrich(rows, await get(DEX + '/tokens/v1/solana/' + mints.join(','))); } catch {} return rows; }
