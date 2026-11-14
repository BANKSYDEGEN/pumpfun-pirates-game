// [scale] BANKSY t2494u "continue the scaling" — Fix 2: cut per-player polling (hidden-tab backoff, longer non-critical boards).
// Headless local measurement: no network, no prod. Counts requests/min from the published intervals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HOME_LIVE_MS, LOBBY_HARBOR_MS, LOBBY_QUEUE_MS, LOBBY_ARENA_MS,
  SQUAD_INVITE_MS, ADMIN_BEAT_MS, ISL_BOARD_NEAR_S, ISL_BOARD_OPEN_S, WALK_XP_S,
  tabHidden, POLL_RPM_BEFORE, POLL_RPM_AFTER,
} from '../js/pollScale.js';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// Count how many times a loop with period `everyMs` fires in `windowMs` of steady state (first fire at t=everyMs, last at t<=windowMs).
function fires(windowMs, everyMs) {
  if (!everyMs || everyMs <= 0) return 0;
  return Math.floor(windowMs / everyMs);
}

function harborRpm({ hidden, intervals }) {
  const min = 60_000;
  if (hidden) return { total: 0, parts: { harborBeat: 0, lobbyHarbor: 0, squadInvites: 0, frList: 0, adminBeat: 0, walkXp: 0 } };
  const parts = {
    harborBeat: fires(min, intervals.harborBeatMs),
    lobbyHarbor: fires(min, intervals.lobbyHarborMs),
    squadInvites: fires(min, intervals.squadInviteMs),
    frList: fires(min, intervals.frListMs),
    adminBeat: fires(min, intervals.adminBeatMs),
    walkXp: 3 * fires(min, intervals.walkXpMs),
  };
  return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts };
}

test('Fix 2 constants: longer non-critical polls; queue / arena / walk-XP seats unchanged', () => {
  assert.equal(HOME_LIVE_MS, 60000);
  assert.equal(LOBBY_HARBOR_MS, 15000);
  assert.equal(LOBBY_QUEUE_MS, 3000);
  assert.equal(LOBBY_ARENA_MS, 10000);
  assert.equal(SQUAD_INVITE_MS, 15000);
  assert.equal(ADMIN_BEAT_MS, 30000);
  assert.equal(ISL_BOARD_NEAR_S, 20);
  assert.equal(ISL_BOARD_OPEN_S, 10);
  assert.equal(WALK_XP_S, 60);
  assert.ok(HOME_LIVE_MS > 10000);
  assert.ok(LOBBY_HARBOR_MS > 6000);
  assert.ok(SQUAD_INVITE_MS > 4000);
  assert.ok(ADMIN_BEAT_MS >= 25000);
});

test('headless local run: req/min/player before vs after (visible harbor, hidden tab, title screen)', () => {
  const rpm = (parts) => Object.values(parts).reduce((a, b) => a + b, 0);
  // Exact steady-state rates (60 / interval_s). The capacity report's "~35/min" was the same mix without rounding the 25 s admin beat.
  const beforeParts = { harborBeat: 60 / 6, lobbyHarbor: 60 / 6, squadInvites: 60 / 4, frList: 60 / 30, adminBeat: 60 / 25, walkXp: 3 };
  const afterParts = { harborBeat: 60 / 6, lobbyHarbor: 60 / (LOBBY_HARBOR_MS / 1000), squadInvites: 60 / (SQUAD_INVITE_MS / 1000), frList: 60 / 30, adminBeat: 60 / (ADMIN_BEAT_MS / 1000), walkXp: 3 };
  const before = rpm(beforeParts), after = rpm(afterParts);
  // Hidden tab before Fix 2: harbor beat + in-harbor lobby poll already stopped; squad invites, admin beat and walk-XP still ran. Friends already paused.
  const hiddenBefore = 60 / 4 + 60 / 25 + 3;
  const hiddenAfter = 0;
  const titleBefore = 60 / 10, titleAfter = 60 / (HOME_LIVE_MS / 1000);

  const keys = ['harborBeat', 'lobbyHarbor', 'squadInvites', 'frList', 'adminBeat', 'walkXp'];
  for (const k of keys) {
    assert.equal(beforeParts[k], POLL_RPM_BEFORE[k]);
    assert.equal(afterParts[k], POLL_RPM_AFTER[k]);
  }
  assert.equal(titleBefore, POLL_RPM_BEFORE.titleLive);
  assert.equal(titleAfter, POLL_RPM_AFTER.titleLive);
  assert.equal(before, 42.4);
  assert.equal(after, 25);
  assert.ok(after < before);
  assert.equal(afterParts.harborBeat, beforeParts.harborBeat, 'harbor seat beat stays 6 s (20 s TTL)');
  assert.equal(hiddenBefore, 20.4);
  assert.equal(hiddenAfter, 0);
  assert.equal(titleBefore, 6);
  assert.equal(titleAfter, 1);

  // Integer fires in a 60 s window (for the report's "measured" column).
  const windowBefore = harborRpm({ hidden: false, intervals: { harborBeatMs: 6000, lobbyHarborMs: 6000, squadInviteMs: 4000, frListMs: 30000, adminBeatMs: 25000, walkXpMs: 60000 } });
  const windowAfter = harborRpm({ hidden: false, intervals: { harborBeatMs: 6000, lobbyHarborMs: LOBBY_HARBOR_MS, squadInviteMs: SQUAD_INVITE_MS, frListMs: 30000, adminBeatMs: ADMIN_BEAT_MS, walkXpMs: WALK_XP_S * 1000 } });
  assert.equal(windowBefore.total, 42);
  assert.equal(windowAfter.total, 25);

  console.log(JSON.stringify({
    visibleHarbor: { beforeRpm: before, afterRpm: after, partsBefore: beforeParts, partsAfter: afterParts, window60sBefore: windowBefore, window60sAfter: windowAfter },
    hiddenTab: { beforeRpm: hiddenBefore, afterRpm: hiddenAfter },
    titleScreen: { beforeRpm: titleBefore, afterRpm: titleAfter },
  }));
});

test('call sites use the Fix 2 constants and skip hidden tabs', () => {
  const board = src('js/pvpBoard.js');
  assert.match(board, /HOME_LIVE_MS/);
  assert.match(board, /TITLE_BURST_MS/);
  assert.doesNotMatch(board, /setInterval\(tick,/);
  assert.match(board, /document\.hidden/);
  const pvp = src('js/pvp.js');
  assert.match(pvp, /LOBBY_QUEUE_MS/);
  assert.match(pvp, /LOBBY_HARBOR_MS/);
  assert.match(pvp, /LOBBY_ARENA_MS/);
  const hall = src('js/dock/squadHall.js');
  assert.match(hall, /!tabHidden\(\) && now - inviteT > SQUAD_INVITE_MS/);
  const admin = src('js/adminMenu.js');
  assert.match(admin, /!tabHidden\(\) && now - st\.lastBeat > ADMIN_BEAT_MS/);
  const pets = src('js/petsPanel.js');
  assert.match(pets, /tabHidden\(\)/);
  assert.match(pets, /WALK_XP_S/);
  assert.match(src('js/parrotsPanel.js'), /WALK_XP_S/);
  assert.match(src('js/onfoot/pilly.js'), /tabHidden\(\)/);
  const mkt = src('js/pumpfun/market.js');
  assert.match(mkt, /document\?\.hidden\)return Promise\.resolve\(\);/);
  const mm = src('js/island/moneyMakers/index.js');
  assert.match(mm, /ISL_BOARD_NEAR_S/);
  assert.match(mm, /ISL_BOARD_OPEN_S/);
  assert.match(mm, /!tabHidden\(\)/);
  assert.match(src('sw.js'), /"\.\/js\/pollScale\.js"/);
});

test('tabHidden: true only when document.hidden is set', () => {
  assert.equal(tabHidden({ hidden: true }), true);
  assert.equal(tabHidden({ hidden: false }), false);
  assert.equal(tabHidden(null), false);
});
