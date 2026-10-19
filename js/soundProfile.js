// [Raul] sound upgrades — PUMPFUN PIRATES · Storm Hunt
// Data-driven sound settings per Shipwright upgrade tier (0 = base ship, 1..3 = tiers in js/upgrades.js).
// js/audio.js reads soundProfile(levels) whenever upgrades change; nothing here touches stats.
export const SOUND_TIERS = {
  // CANNONS: light pop → deep booming roar. body = lowpass noise burst, sub = sine kick with pitch drop,
  // tail = long low rumble, crack = bright muzzle snap, layers = extra detuned bodies, echo = late reflection.
  cannons: [
    { body: 1700, bodyEnd: 140, dur: 0.38, sub: 0,   subF: 90, tail: 0,   crack: 0.38, layers: 0, echo: 0,    vol: 0.62 },
    { body: 1250, bodyEnd: 95,  dur: 0.6,  sub: 0.5, subF: 72, tail: 0.6, crack: 0.32, layers: 1, echo: 0,    vol: 0.72 },
    { body: 950,  bodyEnd: 70,  dur: 0.85, sub: 0.7, subF: 60, tail: 1.1, crack: 0.28, layers: 1, echo: 0.18, vol: 0.8 },
    { body: 760,  bodyEnd: 48,  dur: 1.15, sub: 0.9, subF: 48, tail: 1.7, crack: 0.26, layers: 2, echo: 0.28, vol: 0.86 },
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
  const pick = (id) => SOUND_TIERS[id][Math.max(0, Math.min(3, levels[id] || 0))];
  return { cannon: pick('cannons'), reload: pick('reload'), hull: pick('hull'), armor: pick('armor'), sails: pick('sails'), range: pick('range'), cannonTier: levels.cannons || 0 };
}
