// [Timothy] PUMPFUN PIRATES · Battle Royale kills by mode, THIS DEVICE (display only: the shop's DIAMOND card "Solo · Squads").
// profile.stats.kills (the goal) already counts Solo + Squads together; this only splits it for the UI. Counting starts when this
// ships (`since`), so older kills sit in neither bucket. The server's split (pvp_kills_by_mode, migration 025 DRAFT) wins when it
// answers. Never sent to the server, never read by any gameplay or save code.
const KEY = 'pfp_br_mode_kills_v1';
export function readModeKills() {
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') return { solo: Math.max(0, o.solo | 0), squads: Math.max(0, o.squads | 0), since: o.since || 0 }; } catch {}
  return { solo: 0, squads: 0, since: 0 };
}
export function bumpModeKill(mode) {
  try { const o = readModeKills(); if (!o.since) o.since = Date.now(); o[mode === 'squads' ? 'squads' : 'solo']++; localStorage.setItem(KEY, JSON.stringify(o)); } catch {}
}
