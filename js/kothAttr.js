// KING OF THE HILL kill-attribution rules (pure, unit-tested).
// Counts player-vs-player kills AND deaths everywhere: Harbor/sea, open island on foot
// (guns, swords, shore↔ship cannons), and Arena. Never AI ships, NPCs, crabs, or drowning.
// Coliseum pit/musket-range stays cosmetic. Self-kills never count. Both killer + victim
// must claim (server matches) — client must not double-count via kdCounter.extra when board:true.

/** True when killer/victim net ids are distinct player ids (guards self-kills + missing ids). */
export function kothEligiblePair(killerId, victimId) {
  if (typeof killerId !== 'string' || typeof victimId !== 'string') return false;
  if (!killerId || !victimId) return false;
  if (killerId === victimId) return false;
  return true;
}

/** Death/kill kinds that must NEVER feed the King of the Hill board. */
export function kothExcludedKind(kind) {
  const k = String(kind || '').toLowerCase();
  return k === 'ai' || k === 'bot' || k === 'npc' || k === 'crab' || k === 'drown' || k === 'fall' || k === 'environment';
}

/**
 * Open-island / shore cannon → on-foot: feed KOTH when not inside Coliseum and pair is valid.
 * (Harbor boat sinks + Arena sinks use boardClaim separately; same pair / no-AI guards.)
 */
export function kothOpenIslandBoard({ coli = false, killerId, victimId, kind = 'player' } = {}) {
  if (kothExcludedKind(kind)) return false;
  if (coli) return false;
  return kothEligiblePair(killerId, victimId);
}

/** Shared period tabs for King of the Hill + Storm Hunt (same order / labels everywhere). */
export const BOARD_PERIODS = [
  { id: 'all', label: 'ALL TIME', desc: 'all time' },
  { id: 'month', label: 'MONTH', desc: 'this month' },
  { id: 'day', label: 'DAY', desc: 'today' },
];
