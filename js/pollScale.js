// [scale] BANKSY t2494u "continue the scaling" (capacity review Fix 2): quieter polling, same gameplay.
// Hidden tabs don't fire background polls (harbor/arena seat heartbeats that would expire a seat are unchanged in js/pvp.js).
// Intervals are the only contract: callers keep their existing tick loops.

// Title-screen arena / harbor head-count under SPECTATE (js/pvpBoard.js). Was 10 s; a visibilitychange still refreshes at once.
export const HOME_LIVE_MS = 60000;
// In-harbor read-only arena head-count (js/pvp.js lobbyTick). Was 6 s. Queue / offer stays 3 s (seats expire in 15 s);
// arena seats stay 10 s (expire in 25 s).
export const LOBBY_HARBOR_MS = 15000;
export const LOBBY_QUEUE_MS = 3000;
export const LOBBY_ARENA_MS = 10000;
// Squad-hall invite pill (js/dock/squadHall.js). Was 4 s; the open hall already refreshes the roster every 8 s.
export const SQUAD_INVITE_MS = 15000;
// Admin / presence heartbeat (js/adminMenu.js). Was 25 s.
export const ADMIN_BEAT_MS = 30000;
// Wanted-board pull while standing near the posters (js/island/moneyMakers/index.js). Was 10 s; an open board / live duel stays 10 s.
export const ISL_BOARD_NEAR_S = 20;
export const ISL_BOARD_OPEN_S = 10;
// Walk-XP pings (pets / parrot / Pilly). Already 60 s; skipped while the tab is hidden.
export const WALK_XP_S = 60;

export const tabHidden = (doc = globalThis.document) => !!doc?.hidden;

// Steady-state request rates for one visible player in the harbor (hall + friends closed, walks armed).
// Used by tests/scalePolling.test.mjs to measure Fix 2. Values are calls / minute.
export const POLL_RPM_BEFORE = {
  harborBeat: 60 / 6,       // HARBOR_NET.beat (seat TTL 20 s; kept)
  lobbyHarbor: 60 / 6,      // title-adjacent arena head-count while sailing
  squadInvites: 60 / 4,
  frList: 60 / 30,
  adminBeat: 60 / 25,
  walkXp: 3,                // pilly + pet + parrot, 1/min each
  titleLive: 60 / 10,       // title screen only
};
export const POLL_RPM_AFTER = {
  harborBeat: 60 / 6,
  lobbyHarbor: 60 / (LOBBY_HARBOR_MS / 1000),
  squadInvites: 60 / (SQUAD_INVITE_MS / 1000),
  frList: 60 / 30,
  adminBeat: 60 / (ADMIN_BEAT_MS / 1000),
  walkXp: 3,
  titleLive: 60 / (HOME_LIVE_MS / 1000),
};
