// [backpack-pvp] BANKSY t1703u "Make kd count as sunk ships or ground fights": ONE K/D tally for
//   ship sinks (Battle Royale arena + Harbor open-water PvP, Option B) AND on-foot ground fights (Coliseum SWORD PIT / MUSKET RANGE,
//   open-island PvP). Player kills only: AI ships stay on botKills (BANKSY's "AI ships cost you nothing · K/D unchanged").
// Pure (no DOM / three.js). Every event carries a key (victim id + their life / respawn counter): the same KO or sink heard twice
// (lost ack, the transport's resend, two code paths) is counted ONCE.
export const KD_SOURCES = Object.freeze(['ship', 'ground']);
export const KD_DEDUPE_MS = 10 * 60 * 1000;

export function kdText(k, d) { k = Math.max(0, k | 0); d = Math.max(0, d | 0); return d ? (k / d).toFixed(2) : String(k); }

/**
 * @param {{ stats: () => object, onChange?: (ev) => void, now?: () => number }} o
 *   stats() returns the LIVE saved profile.stats (mutated in place: kills / deaths + per-source groundKills / groundDeaths / shipKills / shipDeaths)
 */
export function createKdTally({ stats, onChange = () => {}, now = () => Date.now() } = {}) {
  const seen = new Map();
  const extra = { k: 0, d: 0 };                       // this session's kills / deaths NOT on the BR kills board (ground fights)
  // opts.board: open-island / bomb / shore kills also go through claimKill (KOTH board). They still
  // bump profile.stats, but NOT `extra` — lifeK = max(stats, rk + extra) must not double-count them.
  function record(side, src, key, opts = {}) {
    if (side !== 'k' && side !== 'd') return false;
    if (!KD_SOURCES.includes(src)) return false;
    const k = `${side}|${src}|${String(key ?? '').slice(0, 80)}`, t = now();
    if (key != null && key !== '' && seen.has(k) && t - seen.get(k) < KD_DEDUPE_MS) return false; // already counted
    seen.set(k, t); if (seen.size > 400) for (const [a, b] of seen) if (t - b > KD_DEDUPE_MS) seen.delete(a);
    const st = stats?.(); if (!st) return false;
    const f = side === 'k' ? 'kills' : 'deaths', per = `${src}${side === 'k' ? 'Kills' : 'Deaths'}`;
    st[f] = (st[f] | 0) + 1; st[per] = (st[per] | 0) + 1;
    if (src === 'ground' && !opts.board) extra[side]++;
    try { onChange({ side, src, key, kills: st.kills | 0, deaths: st.deaths | 0, board: !!opts.board }); } catch {}
    return true;
  }
  return {
    record,
    kill: (src, key, opts) => record('k', src, key, opts),
    death: (src, key, opts) => record('d', src, key, opts),
    get extra() { return { ...extra }; },
    seen: (side, src, key) => seen.has(`${side}|${src}|${key}`),
  };
}
