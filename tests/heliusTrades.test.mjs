// [heliuswh] Helius webhook trade parsing + $SUNK bond celebration gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrades } from '../supabase/functions/helius-ingest/parse.js';
import { bondFxDue } from '../js/bondfx.js';
const fp = 'Trader1111111111111111111111111111111111111', pool = 'Pool111111111111111111111111111111111111111', SUNK = 'By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump', AHOY = '39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump', WSOL = 'So11111111111111111111111111111111111111112';
const sig = '5'.repeat(88), base = { signature: sig, feePayer: fp, timestamp: 1794150000, source: 'PUMP_AMM', nativeTransfers: [] };
test('buy: tokens from pool, quote paid to pool', () => {
  const [r] = parseTrades({ ...base, tokenTransfers: [{ mint: SUNK, fromUserAccount: pool, toUserAccount: fp, tokenAmount: 1000 }, { mint: WSOL, fromUserAccount: fp, toUserAccount: pool, tokenAmount: 0.25 }] });
  assert.equal(r.side, 'buy'); assert.equal(r.sol_amount, 0.25); assert.equal(r.token_amount, 1000); assert.equal(r.wallet_short, 'Trad…1111'); });
test('sell in AHOY quote keeps quote, sol from events when present', () => {
  const [r] = parseTrades({ ...base, events: { swap: { nativeOutput: { amount: '120000000' } } }, tokenTransfers: [{ mint: SUNK, fromUserAccount: fp, toUserAccount: pool, tokenAmount: 50 }, { mint: AHOY, fromUserAccount: pool, toUserAccount: fp, tokenAmount: 9 }] });
  assert.equal(r.side, 'sell'); assert.equal(r.quote_mint, AHOY); assert.equal(r.sol_amount, 0.12); });
test('failed, pass-through and plain transfers are ignored', () => {
  const tt = [{ mint: SUNK, fromUserAccount: pool, toUserAccount: fp, tokenAmount: 5 }];
  assert.deepEqual(parseTrades({ ...base, transactionError: { x: 1 }, tokenTransfers: [...tt, { mint: WSOL, fromUserAccount: fp, toUserAccount: pool, tokenAmount: 1 }] }), []);
  assert.deepEqual(parseTrades({ ...base, tokenTransfers: [...tt, { mint: SUNK, fromUserAccount: fp, toUserAccount: 'x'.repeat(44), tokenAmount: 5 }] }), []);
  assert.deepEqual(parseTrades({ ...base, tokenTransfers: tt }), []); });
test('bond celebration needs chain-confirmed bondedAt inside 30 min, once', () => {
  const now = 1794160000000, st = at => ({ details: { SUNK: { bonded: true, curveSource: 'chain', bondedAt: at } } });
  assert.equal(bondFxDue(st(now - 60e3), now, null), true);
  assert.equal(bondFxDue(st(now - 60e3), now, '1'), false);
  assert.equal(bondFxDue(st(now - 31 * 60e3), now, null), false);
  assert.equal(bondFxDue({ details: { SUNK: { bonded: true, bondedAt: now } } }, now, null), false);
  assert.equal(bondFxDue({ details: { SUNK: { bonded: false, curveProgress: 97 } } }, now, null), false); });
