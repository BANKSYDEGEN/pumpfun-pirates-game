# Helius activation — PUMPFUN PIRATES

Prepared Nov 8, 2026 (EST). Server: `https://qhandcjwlkmovjzwzqfk.supabase.co/functions/v1/boardfeed`.
Source: `/workspace/boardfeed-deploy/supabase/functions/boardfeed/helius.ts` (also copied into game repo on release).

## What exists now
- No browser/client Helius code, key or key-bearing URL. No Helius signup was attempted by this executor.
- Server reads `Deno.env.get('HELIUS_API_KEY')`. With no secret, no Helius request is sent.
- Once the secret exists, `boardfeed` can obtain **unique nonzero token-account owners** for SUNK and AHOY, paginating `getTokenAccounts` (1000/page, max 5 pages, 550ms between RPC calls, once/10min/token). It does NOT confuse account `total` with holder count, and never publishes partial counts. Existing GT/last-good holder values remain on failure. More than 5000 nonzero accounts needs a resumable full scan/indexer.
- Bounded enhanced-transactions poll helper exists, but is deliberately not called yet. `HELIUS_POLL_ADDRESSES` is a server-only comma-separated account allowlist; empty means no polling allowed. No raw transaction or owner list is exposed in boardfeed.
- **Trade stream and holder rewards are NOT activated or claimed to be implemented.** API key alone enables only the holder-count attempt.

## To enable holder counts
1. Complete the free Helius dashboard signup in the parent's browser (not CLI signup: Helius documents a one-time payment for its separate Agent/CLI account).
2. Store the issued key as Supabase function secret `HELIUS_API_KEY` on project `qhandcjwlkmovjzwzqfk` using an approved secure channel. Never put its value in chat, source control, client JS, shell command history, stdout or screenshots.
3. No redeploy needed for an already-running new function instance to read the secret; redeploy `boardfeed` if a worker has old environment. Invoke the endpoint. Check the public boolean `helius.configured` and `details.AHOY/SUNK.holderSource` / `chainAt`.
4. Validate against a full paginated nonzero-owner scan; leave GT/— if Helius fails, returns an incomplete page set, or a plan limit is hit.
5. At worst 10 pages/10min continuously = 43,200 DAS calls/month (check the current per-method credit price before enabling longer scans). No autoscaling or paid plan upgrade is authorized.

## To improve Trending / Volume Leaders / About to Bond
IMPORTANT CORRECTION to the earlier proposal: Helius's current plan documentation says Free includes standard Solana WebSocket methods, but **Helius extended transactionSubscribe is Developer ($49/mo) or above**. A free account is not a promise of every pump.fun trade each second. Do not upgrade or enable overages.

Edge functions are short-lived and cannot be relied on for an always-on websocket. Preferred design: authenticated Helius webhook into a separate `helius-ingest` edge function, with bounded indexed pool/token subscriptions rather than the whole high-volume program. Alternative: demand-driven enhanced-transactions polling for a small verified account list, 20 tx/request, persisted signature cursor, strict monthly credit budget. Existing `pollEnhanced` is only the transport scaffold; persistence, decoding and board aggregation still need implementation/testing.

Before activation:
- Confirm actual Free account webhooks, event/address filters and credit limits in its dashboard (docs mention 5 webhooks / 100,000 addresses, but plans can differ).
- Generate and store a separate `HELIUS_WEBHOOK_AUTH` secret; set it as the webhook Authorization header. Implement constant-time authorization, content-type, payload size cap, POST-only, signature deduplication, transaction-finality checks and rate limiting. Do not expose unauthenticated ingest writes.
- Verify pump.fun and PumpSwap program IDs and current IDLs from official on-chain sources. Use actual swap events/account balance deltas; exclude transfer-only traffic, LP movements, failed transactions, and self-loop/double-counted txs.
- Persist rolling trade aggregates (mint, observed on-chain block time, USD/SOL volume, buy/sell, last price) and deduped signature cursors in a dedicated private table with RLS, service-role only access, a retention cap and a migration backup first. No test events in production.
- Trending is a defined local ranking, not pump.fun's proprietary ranking. Label the metric/window. Preserve full 24h volume semantics unless a separately labelled short-window column is added.
- About to Bond requires the actual curve reserve/account state or validated price-in-SOL model. Trades alone do not prove curve completion.
- A bounded free plan cannot index every pump.fun trade indefinitely; initially index our tokens plus top candidate pools, retaining GT snapshots as fallback. Measure budget before broadening.

## AHOY holder rewards paid in PUMP
A token balance delta or arbitrary PUMP transfer is NOT sufficient evidence of a holder-reward payout.
Still needed: verify AHOY's holder-reward configuration and distribution program/accounts, identify the current PUMP mint from authoritative chain data, obtain and validate the payout instruction/event schema, and independently cross-check real historical payout signatures. Only then decode mint amounts/decimals, deduplicate signature+instruction+recipient, and aggregate actual payouts and recipients. Never infer rewards from all token transfers. No reward totals are displayed from this scaffold today.

## Current sources opened this turn
- https://www.helius.dev/docs/billing/plans
- https://www.helius.dev/docs/api-reference/das/gettokenaccounts
- https://www.helius.dev/docs/api-reference/webhooks/llms.txt

## Shared-cache operations
`boardfeed_cache` is a new private, one-row cache table; existing `pumpfeed`, `pumpfeed_snapshots`, `pvp`, and game tables are untouched. A conditional database lease gates refreshes across edge isolates, not just in one process. Current warm clients poll every 15 seconds; source timestamps are preserved. GeckoTerminal requests are serialized 2.5 seconds apart, secondary source data caches for 60s / 5min and source failures cool down for 60s. Actual end-to-end GT freshness is bounded by upstream throttling and refresh work, not guaranteed 15 seconds. Refresh is demand-driven, not a paid always-on job. Client direct fetches remain the fallback.
