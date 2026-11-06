// [v349 money-makers] BANKSY t203u/t204u "How else could they make money on island?" -> "Add the first 5". Pure rules + numbers (no DOM,
// no THREE) shared by the client modules, tests/v349IslandMoneyMakers.test.mjs and (copied, test-checked) supabase/functions/pvp/island.ts
// + migration 053_island_money_makers.sql. Every payout the server makes is decided by the SERVER's copy; the client numbers only draw the UI
// and drive the offline / pre-053 practice fallback.
//   1. WANTED & BOUNTY BOARDS   2. COLISEUM PRIZE FIGHTS + RINGSIDE BETTING + SKELETON HORDE   3. SMUGGLER CRATE RUNS
//   4. SHIPWRECK DIVING + SHORE CRAB POTS + DEAD MAN'S CAVE MINING   5. COTTAGE SPICE PLOTS + COPPER RUM STILLS (+ HARBOR RUM EXPORT STALL)
export const MM_ON = !(typeof location !== 'undefined' && /[?&]moneymakers=0(&|$)/.test(location.search || ''));
// ?mmfast=1 (tests / Playwright / QA): every timer x 1/60 (15:00 crab pot = 15 s). Never on by default.
export const MM_FAST = typeof location !== 'undefined' && /[?&]mmfast=1(&|$)/.test(location.search || '');
export const DAY_TZ = 'America/Indiana/Indianapolis';
export const dayKey = (t = Date.now()) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: DAY_TZ }).format(new Date(t)); } catch { return new Date(t).toISOString().slice(0, 10); } };

// ---------------- 1. WANTED & BOUNTY BOARDS ----------------
// Daily PvE contracts: progress from real on-foot enemy kills (event 'pfp-pve-kill' { kind }), 1 claim / contract / day.
export const CONTRACTS = [
  { id: 'cave_raiders',    name: 'Clear Skeleton Raiders', where: "Dead Man's Cave · Smugglers' Cove camp", kind: 'raider',  need: 5, gold: 150, icon: '💀' },
  { id: 'jungle_stalkers', name: 'Hunt Jungle Stalkers',   where: 'Temple Jungle ruins',                     kind: 'stalker', need: 4, gold: 120, icon: '🐆' },
  { id: 'cursed_captains', name: 'Slay Cursed Skeleton Captains', where: 'Coliseum Skeleton Horde · waves 3-5', kind: 'captain', need: 2, gold: 250, icon: '☠️' },
  { id: 'salvage_patrol',  name: 'Salvage & Patrol Duty',  where: 'any island kill, dive or mine',           kind: 'any',     need: 6, gold: 100, icon: '⚓' },
];
export const CONTRACT_BY_ID = Object.fromEntries(CONTRACTS.map(c => [c.id, c]));
// which contracts one event moves: a kill of `kind` (raider / stalker / captain / gladiator) or a salvage ('salvage': dive, mine, crab haul)
export function contractHits(kind) { return CONTRACTS.filter(c => c.kind === kind || (c.kind === 'any')).map(c => c.id); }
export function contractProgress(prog = {}, kind) {
  const out = { ...prog }; for (const id of contractHits(kind)) { const c = CONTRACT_BY_ID[id]; out[id] = Math.min(c.need, (out[id] | 0) + 1); } return out;
}
export const contractDone = (id, prog = {}) => !!CONTRACT_BY_ID[id] && (prog[id] | 0) >= CONTRACT_BY_ID[id].need;
// Live PvP head-bounties
export const BOUNTY = { stakes: [100, 250, 500], min: 100, max: 5000, potCap: 50000, list: 20, claimPerHour: 6 };
export const bountyStakeOk = (n) => Number.isInteger(n) && n >= BOUNTY.min && n <= BOUNTY.max;
export const nameKey = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 20);
// a KO claims a bounty only: killer != victim, not squadmates, outside every Safe Zone, a pot on that name
export function canClaimBounty({ killer, victim, squad = false, safe = false, pot = 0 } = {}) {
  if (!killer || !victim || nameKey(killer) === nameKey(victim)) return false;
  if (squad || safe) return false; return (pot | 0) > 0;
}

// ---------------- 2. COLISEUM ----------------
export const DUEL = { stakes: [100, 250, 500, 1000], openS: 300, liveS: 600, countdown: 3, betWindowS: 25 };
export const BET = { min: 50, max: 500 };
export const duelStakeOk = (n) => DUEL.stakes.includes(n);
export const betOk = (n) => Number.isInteger(n) && n >= BET.min && n <= BET.max;
// ringside settle: the winning corner's bettors split the WHOLE pool pro-rata to their stake (floor; dust stays with the house);
// nobody backed the loser OR nobody backed the winner = every bet refunded. Returns Map player -> payout (stake included).
export function betPayouts(bets = [], winner) {
  const pay = new Map(); const tot = (s) => bets.filter(b => b.side === s).reduce((a, b) => a + (b.amount | 0), 0);
  const loser = winner === 'r' ? 'b' : 'r', W = tot(winner), L = tot(loser);
  if (!(winner === 'r' || winner === 'b') || !W || !L) { for (const b of bets) pay.set(b.player, (pay.get(b.player) | 0) + (b.amount | 0)); return pay; }
  for (const b of bets) if (b.side === winner) pay.set(b.player, (pay.get(b.player) | 0) + Math.floor((b.amount | 0) * (W + L) / W));
  return pay;
}
export const duelPot = (stake) => (stake | 0) * 2;
// Skeleton Horde: 5 escalating waves of Skeleton Gladiators in the Coliseum pit; a Cursed Captain leads waves 3-5
export const HORDE = {
  waves: [{ n: 3, cap: 0, hp: 40, dmg: 6 }, { n: 4, cap: 0, hp: 45, dmg: 7 }, { n: 4, cap: 1, hp: 50, dmg: 8 }, { n: 5, cap: 1, hp: 55, dmg: 9 }, { n: 6, cap: 1, hp: 60, dmg: 10 }],
  gold: [60, 90, 120, 160, 220], champion: 300, runsPerDay: 2, cooldownS: 120, captainHp: 140,
};
export const hordeWaveGold = (w) => HORDE.gold[(w | 0) - 1] | 0;           // w = 1..5 just cleared
export const hordeRunGold = () => HORDE.gold.reduce((a, b) => a + b, 0) + HORDE.champion;   // 950 a full run
export const hordeDayCap = () => hordeRunGold() * HORDE.runsPerDay;

// ---------------- 3. SMUGGLER CRATE RUNS ----------------
export const CRATE = { speedK: 0.80, tiers: { standard: { gold: 100, name: 'Standard Coastal Haul' }, cutthroat: { gold: 220, name: 'Cutthroat PvP Route', pvpMeters: 60 } },
  perDay: 12, dropS: 180, pickR: 2.6, deliverR: 4.5 };
export const crateGold = (tier) => CRATE.tiers[tier]?.gold | 0;
// cutthroat pays only when the haul crossed >= pvpMeters of PvP ground (outside the Island Safe Zone)
export const crateEarned = (tier, pvpMeters = 0) => tier === 'cutthroat' ? (pvpMeters >= CRATE.tiers.cutthroat.pvpMeters ? crateGold('cutthroat') : crateGold('standard')) : crateGold(tier);
export const ZIP_BLOCK_MSG = 'Too heavy for the zipline! Haul the crate on foot.';
export const crateBanner = (buyer) => `📦 Hauling Contraband Crate → ${buyer} (80% speed · Ziplines disabled)`;

// ---------------- 4. DIVING / CRAB POTS / MINING ----------------
const k60 = (s) => (MM_FAST ? Math.max(1, Math.round(s / 60)) : s);
export const DIVE = { o2: 100, drain: 19, pry: { chest: 4.2, clam: 3.0 }, stuck: 1.6, stuckP: 0.3, regenS: k60(600), perDay: 30 };
// one salvage roll (r = 0..1): chest = doubloons / pearls, clam = pearls (black pearl rare)
export function diveLoot(kind, r) {
  if (kind === 'chest') return r < 0.55 ? { id: 'barnacled_doubloons', qty: 1 + (r < 0.2 ? 1 : 0) } : r < 0.9 ? { id: 'sea_pearl', qty: 1 } : { id: 'black_pearl', qty: 1 };
  return r < 0.8 ? { id: 'sea_pearl', qty: 1 + (r < 0.25 ? 1 : 0) } : { id: 'black_pearl', qty: 1 };
}
// O2 left after prying `need` seconds; < 0 = out of breath (cough, bumped up, no loot)
export const o2After = (need, o2 = DIVE.o2) => o2 - need * DIVE.drain;
export const CRAB = { maxPots: 3, fillS: k60(900), baitGold: 0, perDay: 30 };
// a pot set at `t0` (ms): { left (s), full }
export function potState(t0, now = Date.now(), fillS = CRAB.fillS) { const left = Math.max(0, fillS - (now - t0) / 1000); return { left, full: left <= 0 }; }
export const fmtClock = (s) => { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
export function crabLoot(r1, r2 = 0.5) {
  const one = (r) => r < 0.6 ? 'shore_crab' : r < 0.88 ? 'blue_claw_crab' : r < 0.98 ? 'spiny_king_crab' : 'golden_emperor_crab';
  const n = 2 + (r2 < 0.5 ? 0 : r2 < 0.85 ? 1 : 2); const out = {};
  for (let i = 0; i < n; i++) { const id = one((r1 + i * 0.37) % 1); out[id] = (out[id] | 0) + 1; } return out;
}
export const MINE = { charges: 3, regenS: k60(600), swingS: 1.1, perDay: 40,
  kinds: { iron: { item: 'iron_ore', color: 0xc46a3a, glow: 0xff8a4a, qty: [1, 2] }, saltpeter: { item: 'refined_saltpeter', color: 0xf2f0e6, glow: 0xdff7ff, qty: [1, 2] }, gold: { item: 'cave_gold_nugget', color: 0xffcd3c, glow: 0xffe27a, qty: [1, 1] } } };
export const mineQty = (kind, r) => { const q = MINE.kinds[kind]?.qty || [1, 1]; return q[0] + Math.floor(r * (q[1] - q[0] + 1)); };

// ---------------- 5. COTTAGE SPICE PLOTS + COPPER RUM STILLS ----------------
export const PLOT = { growS: k60(780), stages: ['seeded soil', 'green shoots', 'lush flowering cane & spice'], yield: { island_cane: 2, island_spices: 2 } };
export function plotStage(t0, now = Date.now(), growS = PLOT.growS) {
  if (!t0) return { stage: -1, ready: false, left: 0, frac: 0 };
  const frac = Math.min(1, (now - t0) / 1000 / growS); return { stage: frac >= 1 ? 2 : frac >= 0.4 ? 1 : 0, ready: frac >= 1, left: Math.max(0, growS * (1 - frac)), frac };
}
export const STILL = { brewS: k60(900), mashGold: 25, need: { island_cane: 2, island_spices: 1 }, bottles: 2 };
// loading homegrown cane + spices brews RESERVE; buying the 25g mash brews the standard bottle
export const stillOutput = (homegrown) => (homegrown ? 'reserve_spiced_rum' : 'cottage_spiced_rum');
export function stillState(t0, now = Date.now(), brewS = STILL.brewS) {
  if (!t0) return { phase: 'idle', left: 0, frac: 0 };
  const frac = Math.min(1, (now - t0) / 1000 / brewS); return { phase: frac >= 1 ? 'ready' : 'brewing', left: Math.max(0, brewS * (1 - frac)), frac };
}
export const COTTAGE_IDS = ['balcony', 'dormer', 'gabled', 'garden'];

// ---------------- daily caps the server also enforces (053 pvp_isl_daily) ----------------
// gold caps per payout kind / day, item caps per gathered-goods source / day
export const DAY_CAPS = { contract: CONTRACTS.reduce((a, c) => a + c.gold, 0), horde: hordeDayCap(), crate: CRATE.perDay * crateGold('cutthroat') };
export const GOODS_DAY = { crab: 40, dive: 30, mine: 40, plot: 40, still: 16 };
