// [v352] BANKSY t1842u/t1843u: arena high-score board → KING OF THE HILL; ranks by Harbor+Arena
// player kills (on-foot gun, on-foot sword, boat sinks incl. cannon→on-foot). Coliseum pit/range stay cosmetic.
// node --test tests/v352KingOfTheHill.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createKdTally } from '../js/kdCounter.js';

const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('rename: plaza / interact / home tab / panel say KING OF THE HILL; JOIN BATTLE + BATTLE ROYALE mode name stay', () => {
  const plaza = R('js/dock/plaza.js'), layout = R('js/dock/layout.js'), html = R('index.html');
  assert.match(plaza, /KING OF THE HILL · TOP KILLS/);
  assert.doesNotMatch(plaza, /BATTLE ROYALE · TOP KILLS/);
  assert.match(plaza, /confirmed kills · Harbor \+ Arena · gun, sword & boat sinks/);
  assert.match(plaza, /⚔ JOIN BATTLE \/ SPECTATE/); // CTA unchanged
  assert.match(layout, /KING OF THE HILL LEADERBOARD · JOIN BATTLE/);
  assert.doesNotMatch(layout, /BATTLE ROYALE LEADERBOARD/);
  assert.match(html, />KING OF THE HILL</); // lb-modes tab
  assert.match(html, />BATTLE ROYALE</); // mode button unchanged
  assert.match(html, />JOIN BATTLE</);
  assert.match(R('js/pvpBoard.js'), /KING OF THE HILL/);
  const version = /^const VERSION = 'pfp-v(\d+)'/m.exec(R('sw.js'));
  assert.ok(version && +version[1] >= 352, 'KotH ships in v352 and must survive later cache-version bumps');
});

test('server top has no room filter (Harbor + Arena rooms all sum); claimKill RPC unchanged', () => {
  const top = R('supabase/migrations/016_pvp_board_deaths.sql');
  assert.match(top, /from pvp_kills, since where created_at >= since\.t group by killer_id/);
  assert.doesNotMatch(top, /room like|room ~|room =/);
  const idx = R('supabase/functions/pvp/index.ts');
  assert.match(idx, /pvp_kills_top/);
  assert.match(idx, /pvp_claim_kill/);
});

test('boat sinks (arena + harbor) still both-sides claimKill', () => {
  const p = R('js/pvp.js');
  assert.match(p, /function boardClaim\(/);
  assert.match(p, /claimKill\(\{ side, room: claimRoomId\(\)/);
  assert.match(p, /function claimRoomId\(\)/);
  assert.match(p, /where === 'harbor' \? `\$\{HB_PREFIX\}-\$\{roomIdx/);
  // arena sink: victim + killer claims
  assert.match(p, /boardClaim\('v', by, myId, me\.life\)/);
  assert.match(p, /boardClaim\('k', myId, m\.v, m\.l \| 0\)/);
  // harbor Option B sink
  assert.match(p, /function harborPvpSunk/);
  assert.match(p, /boardClaim\('v', by, myId, me\.life\)/); // victim (private harbor gated inside boardClaim too)
});

test('on-foot GUN / SWORD open-island KOs claimKill; Coliseum pit/range stay cosmetic', () => {
  const b = R('js/onfoot/battle.js'), p = R('js/pvp.js'), d = R('js/dock/index.js');
  assert.match(b, /function takeHit\(n, by, byId = null\)/);
  assert.match(b, /board \? \{ board: true, k: kid, v: mid, life: me\.life \}/); // victim
  assert.match(b, /board \? \{ board: true, k: mid, v: m\.i, life: ba\[2\] \}/); // killer
  assert.match(b, /COLISEUM \(pit \/ musket range\): COSMETIC/);
  assert.match(b, /OPEN ISLAND gun\/sword KOs/);
  assert.match(p, /function groundKd\(side, key, meta/);
  assert.match(p, /if \(ok && onBoard\) boardClaim\(side, meta\.k, meta\.v, meta\.life \| 0\)/);
  assert.match(d, /groundKd\?\.\(side, key, meta\)/);
});

test('boat cannon → on-foot pirate (bomb) both sides claimKill', () => {
  const p = R('js/pvp.js');
  assert.match(p, /B\.takeHit\(SC\.BOMB_DMG, by, sid\)/); // victim id into takeHit → board meta
  assert.match(p, /groundKd\('k', `bomb:\$\{key\}`, \{ board: true, k: myId, v: m\.s, life: m\.l \| 0 \}\)/);
  assert.match(p, /\.on\('bk', onBombKill\)/);
});

test('kdCounter: board-confirmed ground kills bump stats but not extra (no lifeK double-count)', () => {
  const st = { kills: 0, deaths: 0 };
  const kd = createKdTally({ stats: () => st });
  assert.equal(kd.kill('ground', 'A:1'), true); // cosmetic / pit → extra
  assert.deepEqual(kd.extra, { k: 1, d: 0 });
  assert.equal(kd.kill('ground', 'B:2', { board: true }), true); // KOTH open-island
  assert.equal(st.kills, 2);
  assert.deepEqual(kd.extra, { k: 1, d: 0 }, 'board ground must not bump extra');
  assert.equal(kd.death('ground', 'me:3', { board: true }), true);
  assert.equal(st.deaths, 1);
  assert.deepEqual(kd.extra, { k: 1, d: 0 });
});

test('per-type coverage matrix (source contracts)', () => {
  const p = R('js/pvp.js'), b = R('js/onfoot/battle.js');
  // gun / sword open island → claimKill via groundKd board meta
  assert.match(b, /kd\?\.\('k'/);
  assert.match(b, /kd\?\.\('d'/);
  assert.match(p, /onBoard\) boardClaim/);
  // boat sink harbor + arena → boardClaim
  assert.match(p, /harborPvpSunk/);
  assert.match(p, /onSunk/);
  // bomb → board
  assert.match(p, /onBombKill/);
  // AI still not on KOTH board (bot path never boardClaim)
  assert.match(p, /if \(m\.bot\) return/);
});
