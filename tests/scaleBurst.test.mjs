// [scale-burst] BANKSY "just keep scaling" — spread first-load calls so 5k simultaneous
// joins do not all hit PostgREST / edge in the same second. Headless; no network, no prod.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TITLE_FIRST_MS, TITLE_BURST_MS, JOIN_BURST_MS, burstMs, burstPeakRps,
  TITLE_PEAK_RPS_BEFORE, TITLE_PEAK_RPS_AFTER, JOIN_PEAK_RPS_BEFORE, JOIN_PEAK_RPS_AFTER,
} from '../js/joinBurst.js';
import { HOME_LIVE_MS } from '../js/pollScale.js';
import { createPulse, resetPulse } from '../js/pulse.js';
import { makeMarketFeed, SHARED_MS, SHARED_CACHE_URL } from '../js/pumpfun/market.js';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test.afterEach(() => { resetPulse(); });

test('burst constants: title 1.5 s + 0..8 s, join 0..4 s; peak rps for 5k falls sharply', () => {
  assert.equal(TITLE_FIRST_MS, 1500);
  assert.equal(TITLE_BURST_MS, 8000);
  assert.equal(JOIN_BURST_MS, 4000);
  assert.equal(burstMs(4000, () => 0), 0);
  assert.equal(burstMs(4000, () => 0.999), 3996);
  assert.equal(burstPeakRps(5000, 1000), 5000);
  assert.equal(TITLE_PEAK_RPS_BEFORE, 5000);
  assert.equal(JOIN_PEAK_RPS_BEFORE, 5000);
  assert.ok(TITLE_PEAK_RPS_AFTER < 600); // 5000 / 9.5 s ≈ 526
  assert.ok(JOIN_PEAK_RPS_AFTER <= 1250); // 5000 / 4 s
  assert.ok(TITLE_PEAK_RPS_AFTER < TITLE_PEAK_RPS_BEFORE);
  assert.ok(JOIN_PEAK_RPS_AFTER < JOIN_PEAK_RPS_BEFORE);
});

test('headless: 5k title peeks stay desynchronized after the first minute (no setInterval from t=0)', () => {
  // Each client: first peek at 1500+J, then every HOME_LIVE_MS after that peek.
  const N = 5000, bin = 100; // 100 ms buckets
  const first = [], later = [];
  for (let i = 0; i < N; i++) {
    const j = burstMs(TITLE_BURST_MS, () => (i + 0.5) / N); // even spread
    const t0 = TITLE_FIRST_MS + j;
    first.push(t0);
    later.push(t0 + HOME_LIVE_MS);
  }
  const peak = (times) => {
    const buckets = new Map();
    for (const t of times) {
      const b = Math.floor(t / bin);
      buckets.set(b, (buckets.get(b) || 0) + 1);
    }
    return Math.max(...buckets.values());
  };
  // Old setInterval(tick, 60000) from t=0: all 5k fire in the same 100 ms at t=60000.
  assert.equal(peak(Array.from({ length: N }, () => HOME_LIVE_MS)), N);
  const p1 = peak(first), p2 = peak(later);
  assert.ok(p1 <= 80, 'first peek peak in 100 ms: ' + p1); // 5000 * 0.1 / 8 ≈ 62.5
  assert.ok(p2 <= 80, 'second peek stays spread: ' + p2);
  assert.ok(Math.min(...first) >= TITLE_FIRST_MS);
  assert.ok(Math.max(...first) < TITLE_FIRST_MS + TITLE_BURST_MS + 1);
});

test('createPulse: default tests fire at once; live burst delays the first non-kick pulse', async () => {
  let t = 0, calls = 0;
  const immediate = createPulse({
    call: async () => { calls++; return { ok: true }; },
    now: () => t, hidden: () => false, burst: 0,
  });
  immediate.setPart('friends', () => ({ at: { w: 'harbor', copy: 1 } }));
  await immediate.tick(0);
  assert.equal(calls, 1);

  calls = 0;
  const delayed = createPulse({
    call: async () => { calls++; return { ok: true }; },
    now: () => t, hidden: () => false, burst: 4000, rnd: () => 0.5, // 2000 ms
  });
  delayed.setPart('friends', () => ({ at: { w: 'harbor', copy: 1 } }));
  t = 0; await delayed.tick(0);
  assert.equal(calls, 0, 'first pulse still arming');
  t = 1999; await delayed.tick(1999);
  assert.equal(calls, 0);
  t = 2000; await delayed.tick(2000);
  assert.equal(calls, 1);

  calls = 0;
  const kicked = createPulse({
    call: async () => { calls++; return { ok: true }; },
    now: () => t, hidden: () => false, burst: 4000, rnd: () => 0.5,
  });
  kicked.setPart('friends', () => ({ at: { w: 'harbor', copy: 1 } }));
  t = 0; await kicked.tick(0);
  assert.equal(calls, 0);
  await kicked.kick();
  assert.equal(calls, 1, 'kick bypasses the first-load jitter');
});

test('boardfeed: burst=0 (tests) still fetches on the first tick; live burst delays it', async () => {
  let now = 100000, urls = [];
  const ca = 'By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump';
  const keys = ['trending', 'callouts', 'bonding', 'dexpaid', 'migrated', 'volume'];
  const state = { updated: Object.fromEntries([...keys, 'prices'].map((k) => [k, 99000])), status: {},
    prices: { SUNK: { price: 1, updated: 99000 }, AHOY: { price: 2, updated: 99000 } },
    details: { SUNK: { updated: 99000, chart: [[1, 1], [2, 2]] }, AHOY: { updated: 99000, chart: [[1, 1], [2, 2]] } } };
  for (const k of keys) state[k] = [];
  state.trending = [{ mint: ca, price: 1 }];
  const fetcher = async (u) => { urls.push(u); return { ok: true, json: async () => ({ ok: true, state }) }; };
  const a = makeMarketFeed({ storage: null, cacheURL: 'https://cache.example/boardfeed', clock: () => now, fetcher, burst: 0 });
  await a.tick(true, true, false);
  assert.equal(urls.length, 1);

  urls = [];
  const b = makeMarketFeed({ storage: null, cacheURL: 'https://cache.example/boardfeed', clock: () => now, fetcher, burst: 4000, rnd: () => 0.5 });
  await b.tick(true, true, false);
  assert.equal(urls.length, 0, 'armed, not yet due');
  now += 1999; await b.tick(true, true, false);
  assert.equal(urls.length, 0);
  now += 1; await b.tick(true, true, false);
  assert.equal(urls.length, 1);
  now += SHARED_MS - 1; await b.tick(true, true, false);
  assert.equal(urls.length, 1, 'phase preserved; no fetch inside SHARED_MS');
});

test('wiring: joinBurst is used at the title, harbor begin, pulse, boardfeed; interval no longer starts at t=0', () => {
  assert.match(src('js/pvpBoard.js'), /TITLE_FIRST_MS \+ burstMs\(TITLE_BURST_MS\)/);
  assert.doesNotMatch(src('js/pvpBoard.js'), /setInterval\(tick, HOME_LIVE_MS\)/);
  assert.match(src('js/pvp.js'), /hb\.beatAt = t0 - HARBOR_NET\.beat \* 1000 \+ joinJ/);
  assert.match(src('js/pvp.js'), /lastPoll: t0 - LOBBY_HARBOR_MS \+ joinJ/);
  assert.match(src('js/pulse.js'), /burst: JOIN_BURST_MS/);
  assert.match(src('js/pumpfun/market.js'), /burst:JOIN_BURST_MS/);
  assert.match(src('sw.js'), /"\.\/js\/joinBurst\.js"/);
  assert.equal(SHARED_CACHE_URL.startsWith('https://'), true);
});
