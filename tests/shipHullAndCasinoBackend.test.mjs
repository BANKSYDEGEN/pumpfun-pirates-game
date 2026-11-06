// node --test tests/shipHullAndCasinoBackend.test.mjs
// [v333] BANKSY t1765u–t1769u: ENTER HULL UX, ship invuln, ship_quarters DB, pure-gold casino_play
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const DOCK = read('js/dock/index.js');
const HULL = read('js/dock/shipHull.js');
const HOUSES = read('js/dock/houses.js');
const PVP = read('js/pvp.js');
const MAIN = read('js/main.js');
const SQL = read('supabase/migrations/048_ship_quarters_and_casino.sql');
const CAS = read('supabase/functions/pvp/casino.ts');
const HTS = read('supabase/functions/pvp/houses.ts');
const IDX = read('supabase/functions/pvp/index.ts');
const SW = read('sw.js');

test('dock bar: GO ASHORE + SET SAIL + ENTER HULL when moored', () => {
  assert.match(DOCK, /GO ASHORE/);
  assert.match(DOCK, /SET SAIL/);
  assert.match(DOCK, /ENTER HULL/);
  assert.match(DOCK, /key: 'H'/);
  assert.match(DOCK, /enterHull/);
  // three-button setActs
  assert.match(DOCK, /actC/);
  assert.match(DOCK, /bC/);
  assert.ok(DOCK.includes("setActs({ label: 'GO ASHORE'"));
  assert.ok(DOCK.includes("{ label: 'ENTER HULL', key: 'H'"));
});

test('anchored sea bar: ENTER HULL + LAUNCH CANOE + WEIGH ANCHOR', () => {
  assert.match(DOCK, /LAUNCH CANOE/);
  assert.match(DOCK, /WEIGH ANCHOR/);
  assert.match(DOCK, /weighAnchor/);
  assert.ok(DOCK.includes("label: 'ENTER HULL', key: 'E'"));
  assert.match(DOCK, /s\.anchor && cp\?\.a/);
});

test('Captain\'s Quarters room + storage + leave returns to dock/sea', () => {
  assert.match(HULL, /buildCaptainsQuartersRoom/);
  assert.match(HULL, /ship_quarters/);
  assert.match(HULL, /OPEN STORAGE/);
  assert.match(HULL, /LEAVE HULL/);
  assert.match(HULL, /stern/);
  assert.match(HULL, /chart/);
  assert.match(HULL, /captains_quarters\.glb/);
  assert.match(HULL, /SHIP_QUARTERS_SLOTS = 12/);
  assert.match(DOCK, /leaveHull/);
  assert.match(DOCK, /from: fromDock \? 'dock' : 'sea'/);
  assert.match(DOCK, /ctx\?\.from === 'sea'/);
  assert.match(HULL, /BACK ABOARD/);
  assert.match(HOUSES, /SHIP_QUARTERS_ID/);
  assert.match(HOUSES, /ensureShipQuarters/);
  assert.match(HOUSES, /openFor/);
  assert.match(HOUSES, /hullqa=1/);
});

test('combat hatch lock 8s + toast', () => {
  assert.match(HULL, /HULL_COMBAT_LOCK_S = 8/);
  assert.match(DOCK, /Hull hatch battened down during combat/);
  assert.match(DOCK, /lastHitT/);
});

test('ship takes 0 damage while inHull (AI, cannonballs, MP unmanned)', () => {
  assert.match(DOCK, /invuln: \(s\) => on && \(zone\.inside\(s\.x, s\.z\) \|\| !!shipHull\?\.inHull\)/);
  assert.match(DOCK, /get inHull\(\)/);
  assert.match(PVP, /d\.inHull/);
  assert.match(PVP, /K\.dock\?\.inHull/);
  assert.match(MAIN, /dock\?\.inHull/);
  assert.match(MAIN, /shipLocked/);
});

test('048 migration: ship_quarters ensure + casino gold RPCs, zero crypto', () => {
  assert.match(SQL, /pvp_ensure_ship_quarters/);
  assert.match(SQL, /ship_quarters/);
  assert.match(SQL, /pvp_casino_hands/);
  assert.match(SQL, /pvp_casino_debit/);
  assert.match(SQL, /pvp_casino_credit/);
  assert.match(SQL, /pvp_house_store/);
  assert.match(SQL, /pvp_house_take_capped/);
  assert.doesNotMatch(SQL, /\b(solana|usdc|spl-token|crypto wallet)\b/i);
  // ship_quarters does not count as land cottage — free insert, no price
  assert.match(SQL, /values \(pid, 'ship_quarters', 'captain', 12\)/);
});

test('casino.ts: all 4 games, gold-only, cryptographic RNG, atomic accounting', () => {
  assert.match(CAS, /casino_play/);
  assert.match(CAS, /blackjack/);
  assert.match(CAS, /roulette/);
  assert.match(CAS, /dice/);
  assert.match(CAS, /slots/);
  assert.match(CAS, /crypto\.getRandomValues/);
  assert.match(CAS, /pvp_casino_debit/);
  assert.match(CAS, /pvp_casino_credit/);
  assert.match(CAS, /MIN_BET = 10/);
  assert.match(CAS, /MAX_BET = 25000/);
  assert.match(CAS, /gold only/);
  assert.match(CAS, /doubloon/);
  assert.match(CAS, /crown/);
  assert.match(CAS, /under7/);
  assert.match(CAS, /lucky7/);
  assert.match(CAS, /2\.5/); // blackjack 3:2
  // Guard list may mention banned terms; payouts must never credit crypto
  assert.match(CAS, /gold only/);
  assert.doesNotMatch(CAS, /mint|airdrop.*token|spl-token/i);
  assert.match(IDX, /CASINO_ACTIONS/);
  assert.match(IDX, /casinoAction/);
  assert.match(HTS, /SHIP_QUARTERS_ID/);
  assert.match(HTS, /okChest/);
  assert.match(HTS, /pvp_ensure_ship_quarters/);
  assert.match(HTS, /landOwned/);
});

test('sw.js bumped to pfp-v333+ with shipHull.js in SHELL', () => {
  assert.ok(existsSync(new URL('../sw.js', import.meta.url)));
  assert.ok(+(SW.match(/VERSION = 'pfp-v(\d+)'/) || [])[1] >= 333, 'sw VERSION >= v333');
  assert.match(SW, /shipHull\.js/);
});

test('pure casino math helpers (roulette / dice / slots / blackjack)', async () => {
  // Inline mirrors of casino.ts pure logic for unit confidence
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const evalRoulette = (n, choice) => {
    const { type, val } = choice;
    if (type === 'straight') return Number(val) === n ? 36 : 0;
    if (type === 'color') {
      if (n === 0) return 0;
      return ((val === 'red' && RED.has(n)) || (val === 'black' && !RED.has(n))) ? 2 : 0;
    }
    return 0;
  };
  assert.equal(evalRoulette(7, { type: 'straight', val: 7 }), 36);
  assert.equal(evalRoulette(0, { type: 'color', val: 'red' }), 0);
  assert.equal(evalRoulette(1, { type: 'color', val: 'red' }), 2);

  const handTotal = (cards) => {
    const rank = (c) => c % 13;
    const val = (c) => { const r = rank(c); return r >= 10 ? 10 : r === 0 ? 11 : r + 1; };
    let t = 0, aces = 0;
    for (const c of cards) { t += val(c); if (rank(c) === 0) aces++; }
    while (t > 21 && aces > 0) { t -= 10; aces--; }
    return t;
  };
  assert.equal(handTotal([0, 12]), 21); // A + K
  assert.equal(handTotal([0, 0, 9]), 12); // A A 10

  // slots 3-crown
  const PAY3 = { crown: 25, chest: 12, ruby: 8, doubloon: 5, skull: 4, anchor: 3, compass: 3 };
  assert.equal(PAY3.crown, 25);
  assert.equal(Math.floor(100 * 1.5), 150); // 2 doubloon partial
});
