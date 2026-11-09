// [v573] BANKSY: King of the Hill counts all player-vs-player kills/deaths (Harbor, island, Arena);
// Storm Hunt + KOTH period tabs share ALL TIME / MONTH / DAY order everywhere.
// node --test tests/kothAllPvp.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createKdTally } from '../js/kdCounter.js';
import { kothEligiblePair, kothExcludedKind, kothOpenIslandBoard, BOARD_PERIODS } from '../js/kothAttr.js';

const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('attribution: self-kills and missing ids never count', () => {
  assert.equal(kothEligiblePair('a', 'a'), false);
  assert.equal(kothEligiblePair('', 'b'), false);
  assert.equal(kothEligiblePair('a', ''), false);
  assert.equal(kothEligiblePair(null, 'b'), false);
  assert.equal(kothEligiblePair('a', 'b'), true);
});

test('attribution: AI / NPC / crab / drown / fall excluded', () => {
  for (const k of ['ai', 'bot', 'npc', 'crab', 'drown', 'fall', 'environment', 'AI', 'Bot']) {
    assert.equal(kothExcludedKind(k), true, k);
    assert.equal(kothOpenIslandBoard({ coli: false, killerId: 'a', victimId: 'b', kind: k }), false, k);
  }
  assert.equal(kothExcludedKind('player'), false);
  assert.equal(kothOpenIslandBoard({ coli: false, killerId: 'a', victimId: 'b', kind: 'player' }), true);
});

test('attribution: Coliseum cosmetic; open island counts', () => {
  assert.equal(kothOpenIslandBoard({ coli: true, killerId: 'a', victimId: 'b' }), false);
  assert.equal(kothOpenIslandBoard({ coli: false, killerId: 'a', victimId: 'b' }), true);
});

test('kdCounter: board:true never double-counts via extra', () => {
  const st = { kills: 0, deaths: 0 };
  const kd = createKdTally({ stats: () => st });
  assert.equal(kd.kill('ground', 'p1:1', { board: true }), true);
  assert.equal(kd.kill('ground', 'p1:1', { board: true }), false, 'same key deduped');
  assert.equal(st.kills, 1);
  assert.deepEqual(kd.extra, { k: 0, d: 0 });
  assert.equal(kd.death('ground', 'me:1', { board: true }), true);
  assert.equal(st.deaths, 1);
  assert.deepEqual(kd.extra, { k: 0, d: 0 });
});

test('client wiring: open-island + bomb + boat sinks feed boardClaim; bots never', () => {
  const b = R('js/onfoot/battle.js'), p = R('js/pvp.js');
  assert.match(b, /kothOpenIslandBoard/);
  assert.match(b, /kothOpenIslandBoard\(\{ coli, killerId: kid, victimId: mid \}\)/);
  assert.match(b, /kothOpenIslandBoard\(\{ coli, killerId: mid, victimId: m\.i \}\)/);
  assert.match(p, /if \(ok && onBoard\) boardClaim/);
  assert.match(p, /groundKd\('k', `bomb:\$\{key\}`, \{ board: true/);
  assert.match(p, /boardClaim\('k', myId, m\.v, m\.l \| 0\)/);
  assert.match(p, /if \(m\.bot\) return/);
  assert.match(R('supabase/migrations/006_pvp_kills.sql'), /if p_killer_net = p_victim_net then return 'self kill'/);
});

test('period tabs: Storm Hunt + KOTH same order ALL TIME / MONTH / DAY', () => {
  assert.deepEqual(BOARD_PERIODS.map(p => p.id), ['all', 'month', 'day']);
  assert.deepEqual(BOARD_PERIODS.map(p => p.label), ['ALL TIME', 'MONTH', 'DAY']);
  const lb = R('js/leaderboard.js');
  assert.match(lb, /export const PERIODS = \[/);
  assert.match(lb, /\{ id: 'all', label: 'ALL TIME'/);
  assert.match(lb, /\{ id: 'month', label: 'MONTH'/);
  assert.match(lb, /\{ id: 'day', label: 'DAY'/);
  // order: all before month before day
  const iAll = lb.indexOf("{ id: 'all', label: 'ALL TIME'");
  const iMo = lb.indexOf("{ id: 'month', label: 'MONTH'");
  const iDay = lb.indexOf("{ id: 'day', label: 'DAY'");
  assert.ok(iAll < iMo && iMo < iDay, 'PERIODS order must be ALL TIME → MONTH → DAY');
  assert.doesNotMatch(lb.split('export const PERIODS_EXTRA')[0], /id: 'week'|id: 'year'/);
  const pk = R('js/pvpBoard.js');
  assert.match(pk, /BOARD_PERIODS/);
  assert.match(pk, /set\('pfp_lb_period', p\.id\)/);
  assert.match(R('js/main.js'), /pfp_pk_period/);
});

test('home + menu boards show KING OF THE HILL / STORM HUNT; deaths + empty state', () => {
  const html = R('index.html'), pk = R('js/pvpBoard.js'), plaza = R('js/dock/plaza.js');
  assert.match(html, />KING OF THE HILL</); // mode tab
  assert.match(html, /board-title">KING OF THE HILL/);
  assert.match(html, /board-title">STORM HUNT/);
  assert.match(html, /pvp-sub">KING OF THE HILL/);
  assert.match(pk, /\$\{deaths\}D · K\/D/);
  assert.match(pk, /No King of the Hill kills/);
  assert.match(plaza, /Harbor \+ island \+ Arena · players only/);
});

test('pvp edge keeps verify_jwt=false in supabase config', () => {
  const cfg = R('supabase/config.toml');
  assert.match(cfg, /\[functions\.pvp\]/);
  assert.match(cfg, /verify_jwt = false/);
  assert.match(R('supabase/functions/pvp/index.ts'), /--no-verify-jwt/);
});
