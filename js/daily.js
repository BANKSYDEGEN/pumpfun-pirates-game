// DAILY challenge: one fixed seed per UTC day, so every pirate sails the same waves
// (enemy mix, spawn positions, hull variants, chest scatter). Enemy aim/reload stays random,
// so runs still play out differently once the shooting starts.
export const dailySeed = (d = new Date()) => d.toISOString().slice(0, 10); // 'YYYY-MM-DD' (UTC)

// string -> 32-bit hash (FNV-1a), then a small fast PRNG (mulberry32)
function hash(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// one independent stream per wave (and per purpose), so wave 5 is identical no matter what happened in wave 4
export const waveRng = (seed, wave, purpose = 'spawn') => mulberry32(hash(`pfp-daily:${seed}:${wave}:${purpose}`));

// countdown to the next UTC midnight, e.g. '7h 12m'
export function untilNextDaily(now = Date.now()) {
  const d = new Date(now), next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  const m = Math.max(0, Math.round((next - now) / 60000));
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
