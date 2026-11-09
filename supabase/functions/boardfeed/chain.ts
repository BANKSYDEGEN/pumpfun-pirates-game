// hq-data-v2 backup on-chain source (Helius, server only). Used when the pump.fun relay / DexScreener / GT are offline.
// The key is read from Deno.env HELIUS_API_KEY inside heliusRPC; nothing here returns a key, a full wallet or a raw transaction.
import { heliusRPC, heliusConfigured } from './helius.ts';
import { SUNK, AHOY, PUMP, SUNK_CURVE, AHOY_POOL, CURVE_PROGRAM, PUMPSWAP_PROGRAM, SYSTEM_PROGRAM, b64, curvePrice, poolLayout, poolPrice, chainPrices, rankHolders, parseHidden } from './lib/chain.js';
const ui = (r: any) => { const v = r?.value; const n = v ? Number(v.amount) / 10 ** Number(v.decimals) : NaN; return Number.isFinite(n) ? n : null; };
async function supplyAndPrice(mint: string) { const a: any = await heliusRPC('getAsset', { id: mint, options: { showFungible: true } }); const t = a?.token_info;
  return { supply: t && Number.isFinite(+t.supply) ? +t.supply / 10 ** (+t.decimals || 6) : null, usd: t?.price_info?.currency === 'USDC' && +t.price_info.price_per_token > 0 ? +t.price_info.price_per_token : null }; }
// SUNK/AHOY USD prices from live reserves. Returns {} if any link is missing (callers keep their last good values).
export async function readChainPrices() {
  if (!heliusConfigured()) return {};
  const pool: any = await heliusRPC('getAccountInfo', [AHOY_POOL, { encoding: 'base64', commitment: 'confirmed' }]);
  if (pool?.value?.owner !== PUMPSWAP_PROGRAM) return {};
  const L = poolLayout(b64(pool.value.data[0])); if (!L || L.base !== AHOY || L.quote !== PUMP) return {};
  const base = ui(await heliusRPC('getTokenAccountBalance', [L.baseVault])), quote = ui(await heliusRPC('getTokenAccountBalance', [L.quoteVault]));
  const curve: any = await heliusRPC('getAccountInfo', [SUNK_CURVE, { encoding: 'base64', commitment: 'confirmed' }]);
  const sunkInAhoy = curve?.value?.owner === CURVE_PROGRAM ? curvePrice(b64(curve.value.data[0])) : null;
  const pump = await supplyAndPrice(PUMP), ahoy = await supplyAndPrice(AHOY), sunk = await supplyAndPrice(SUNK);
  const slot = pool?.context?.slot ?? null;
  const out: any = chainPrices({ ahoyInPump: poolPrice(base!, quote!), sunkInAhoy, pumpUsd: pump.usd, ahoySupplyUi: ahoy.supply, sunkSupplyUi: sunk.supply });
  for (const k of Object.keys(out)) out[k] = { ...out[k], source: 'chain', slot };
  return out;
}
// Full nonzero scan (max 5 x 1000 accounts, same bound as countHolders); partial scans publish nothing.
export async function readHolderBoard(mint: string) {
  if (!heliusConfigured()) return null;
  const all: any[] = []; let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const r: any = await heliusRPC('getTokenAccounts', { mint, limit: 1000, ...(cursor ? { cursor } : {}), options: { showZeroBalance: false } });
    if (!Array.isArray(r?.token_accounts)) return null;
    for (const a of r.token_accounts) all.push({ owner: a.owner, amount: String(a.amount) });
    if (r.token_accounts.length < 1000) { cursor = undefined; break; }
    if (!r.cursor || r.cursor === cursor) return null; cursor = r.cursor; if (page === 4) return null;
  }
  // Which of the biggest owners are programs (curve, pool, vault PDAs) rather than wallets: one batched account read.
  const big = [...new Set(all.sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1)).map(a => a.owner))].slice(0, 25);
  const info: any = await heliusRPC('getMultipleAccounts', [big, { encoding: 'base64', dataSlice: { offset: 0, length: 0 } }]);
  if (!Array.isArray(info?.value)) return null;
  const programOwned = new Set<string>(); big.forEach((o, i) => { const v = info.value[i]; if (v && v.owner !== SYSTEM_PROGRAM) programOwned.add(o); });
  const labels: Record<string, string> = { [SUNK_CURVE]: 'Bonding curve', [AHOY_POOL]: 'PumpSwap pool' };
  // HQ_HIDDEN_WALLETS: server-only list of the owner's own wallets; they are dropped before any row is built.
  const hidden = parseHidden(Deno.env.get('HQ_HIDDEN_WALLETS'));
  const board = rankHolders(all, { programOwned, hidden, labels });
  if (!board) return null;
  return { ...board, hiddenConfigured: Deno.env.get('HQ_HIDDEN_WALLETS') != null, source: 'Helius · full nonzero scan', at: Date.now() };
}
