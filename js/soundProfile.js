// [Raul] sound upgrades — PUMPFUN PIRATES · Storm Hunt
// Data-driven sound settings per Shipwright upgrade tier (0 = base ship, 1..3 = tiers in js/upgrades.js).
// js/audio.js reads soundProfile(levels) whenever upgrades change; nothing here touches stats.
import { tier3 } from './upgrades.js'; // [more levels] 6-8 shop levels map onto these 4 sound tiers
export const SOUND_TIERS = {
  // CANNONS: black-powder muzzle-loaders. Tier 0 = light field gun (still a boom), tier 3 = ship-of-the-line /
  // siege guns. Per shot: sub = sine thump (subF Hz, pitch drops ~40 %), blast = soft-attack low-passed noise
  // (blast → blastEnd Hz, mostly under 1 kHz, no click), rumble = long low noise tail, verb = send into the
  // shared "echo across the water" convolution reverb, echo = faint late reflection, crackle = burning powder.
  // gap = [min, max] seconds between guns in a broadside (ragged crew fire, overlapping into rolling thunder).
  cannons: [
    { subF: 78, sub: 0.75, subDur: 0.55, blast: 950, blastEnd: 140, blastDur: 0.45, attack: 0.012, rumble: 0.28, rumbleDur: 2.0, verb: 0.55, echo: 0.10, crackle: 0.25, vol: 0.62, gap: [0.18, 0.34] },
    { subF: 64, sub: 0.85, subDur: 0.7,  blast: 820, blastEnd: 110, blastDur: 0.55, attack: 0.013, rumble: 0.34, rumbleDur: 2.6, verb: 0.65, echo: 0.13, crackle: 0.3,  vol: 0.68, gap: [0.2, 0.38] },
    { subF: 52, sub: 0.95, subDur: 0.85, blast: 700, blastEnd: 80,  blastDur: 0.65, attack: 0.014, rumble: 0.4,  rumbleDur: 3.2, verb: 0.75, echo: 0.16, crackle: 0.35, vol: 0.74, gap: [0.2, 0.42] },
    { subF: 42, sub: 1.05, subDur: 1.0,  blast: 600, blastEnd: 55,  blastDur: 0.8,  attack: 0.016, rumble: 0.48, rumbleDur: 4.0, verb: 0.85, echo: 0.2,  crackle: 0.4,  vol: 0.8,  gap: [0.18, 0.45] },
  ],
  // GUN CREW: reload-ready ratchet. clicks = ratchet clicks, gap = seconds between, pitch = click brightness
  reload: [
    { clicks: 2, gap: 0.11,  pitch: 1700, vol: 0.16 },
    { clicks: 2, gap: 0.08,  pitch: 2100, vol: 0.18 },
    { clicks: 3, gap: 0.055, pitch: 2500, vol: 0.2 },
    { clicks: 3, gap: 0.04,  pitch: 3000, vol: 0.22, ring: true },
  ],
  // HULL PLANKS: bigger hull = deeper creak and wood impact
  hull: [{ creak: 1.0, impact: 1.0 }, { creak: 0.85, impact: 0.85 }, { creak: 0.72, impact: 0.72 }, { creak: 0.6, impact: 0.6 }],
  // IRON PLATING: hits on your ship ring metallic (mix 0..1 against the wood thud)
  armor: [{ metal: 0 }, { metal: 0.35 }, { metal: 0.6 }, { metal: 0.85 }],
  // SAILS: stronger wind / canvas flap
  sails: [{ wind: 1.0, flap: 0 }, { wind: 1.2, flap: 0.5 }, { wind: 1.4, flap: 0.8 }, { wind: 1.6, flap: 1 }],
  // SPYGLASS: tier 3 lookout rings a bell when enemies spawn
  range: [{ bell: false }, { bell: false }, { bell: false }, { bell: true }],
};
export function soundProfile(levels = {}) {
  const pick = (id) => SOUND_TIERS[id][tier3(id, levels[id])];
  return { cannon: pick('cannons'), reload: pick('reload'), hull: pick('hull'), armor: pick('armor'), sails: pick('sails'), range: pick('range'), cannonTier: tier3('cannons', levels.cannons) };
}

// [Raul] damage sounds: every cannonball hit picks a tier from the damage it actually dealt.
// frac = damage / target max HP (+ the shooter's CANNONS bonus for your own shots), dmg = absolute damage.
// A tier applies if frac >= minFrac OR dmg >= minDmg (highest matching tier wins); a hit that sinks the ship = 'kill'.
// punch = extra low thump for boss hits (the game has no crits); metal = iron ring on armored ships.
export const HIT_TIERS = [
  { id: 'light',  minFrac: 0,    minDmg: 0,  vol: 0.55 }, // small wood crack / thunk
  { id: 'medium', minFrac: 0.12, minDmg: 22, vol: 0.75 }, // heavier crunch with splinters
  { id: 'heavy',  minFrac: 0.22, minDmg: 32, vol: 0.9 },  // deep splintering crash + timber groan
];
export const KILL_HIT = { id: 'kill', vol: 1 };             // big hull-breaking crash
export const HIT_PLAYER_FRAC_MUL = 1.5; // hits on YOUR ship count 1.5x (your hull is the one that matters)
export const HIT_CANNON_BONUS = [0, 0.025, 0.05, 0.08];       // added to frac for hits from YOUR guns, per CANNONS tier
export const ARMORED_ENEMIES = { galleon: 0.35, boss: 0.55 }; // metal ring mix when you hit these
export const HIT_THROTTLE = { window: 0.3, max: 5, mergeGap: 0.045 }; // at most 5 hit sounds per 0.3 s; near-simultaneous hits merge
export function hitTier({ dmg = 0, maxHp = 100, kill = false, cannonTier = -1, onPlayer = false } = {}) {
  if (kill) return KILL_HIT;
  const frac = dmg / Math.max(1, maxHp) * (onPlayer ? HIT_PLAYER_FRAC_MUL : 1) + (cannonTier >= 0 ? HIT_CANNON_BONUS[Math.min(3, cannonTier)] : 0);
  let t = HIT_TIERS[0];
  for (const h of HIT_TIERS) if (frac >= h.minFrac || dmg >= h.minDmg) t = h;
  return t;
}
