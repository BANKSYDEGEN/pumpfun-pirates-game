// [scale-burst] BANKSY "just keep scaling" (free plan): spread first-load RPCs / edge calls so a
// big simultaneous join does not all hit the database in the same second. Gameplay is unchanged;
// only the first request of a kind is delayed by a random 0..max ms. Later ticks keep that phase
// (the 60 s title peek stays desynchronized instead of realigning every minute).
export const TITLE_FIRST_MS = 1500;     // existing first title peek delay
export const TITLE_BURST_MS = 8000;     // + 0..8 s (first head-count lands in 1.5–9.5 s)
export const JOIN_BURST_MS = 4000;      // first harbor beat / lobby poll / rank / pulse / boardfeed

export function burstMs(maxMs, rnd = Math.random) {
  const cap = Math.max(0, Number(maxMs) || 0);
  const r = typeof rnd === 'function' ? rnd() : 0;
  return Math.floor(Math.max(0, Math.min(1, r)) * cap);
}

/** Peak requests/sec if `n` clients all start at t=0 and each waits uniform 0..windowMs. */
export function burstPeakRps(n, windowMs) {
  if (!windowMs || windowMs <= 0) return n;
  return n / (windowMs / 1000);
}

// 5_000 players opening the title at once (the event-start case).
export const TITLE_PEAK_RPS_BEFORE = burstPeakRps(5000, 1000); // one-second spike (old first peeks, and the 60 s interval, were synchronized)
export const TITLE_PEAK_RPS_AFTER = burstPeakRps(5000, TITLE_FIRST_MS + TITLE_BURST_MS);
export const JOIN_PEAK_RPS_BEFORE = burstPeakRps(5000, 1000);
export const JOIN_PEAK_RPS_AFTER = burstPeakRps(5000, JOIN_BURST_MS);
