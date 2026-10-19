// [Raul] ship upgrades — PUMPFUN PIRATES · Storm Hunt
// One data-driven config for the player's ship stats and the upgrade tiers bought with in-game gold.
// Fully off-chain: gold is looted in-game and upgrades last for one run (they reset on game over).
// BASE_SHIP is the single source of base stats, so a future feature could feed it from elsewhere
// (e.g. NFT traits) by passing a different base into shipStats(). None of that is built here.

export const BASE_SHIP = {
  maxHp: 100,      // hull hit points
  armor: 0,        // fraction of incoming cannon damage blocked (0..0.6)
  speed: 1,        // multiplier on sail speed (sail level × 4.2 m/s)
  turn: 1,         // multiplier on rudder turn rate
  cannons: 4,      // guns per broadside
  reload: 2.2,     // seconds between broadsides (per side)
  range: 90,       // metres the gunners will auto-range a target
};

// Each upgrade: a stat it sets, and tiers with an increasing cost. `value` is the stat AFTER buying that tier.
export const UPGRADES = [
  { id: 'hull',    name: 'HULL PLANKS',   icon: '🪵', stat: 'maxHp',   unit: ' HP', desc: 'More hull hit points',
    tiers: [{ cost: 60, value: 130 }, { cost: 140, value: 165 }, { cost: 280, value: 210 }] },
  { id: 'armor',   name: 'IRON PLATING',  icon: '🛡️', stat: 'armor',   unit: '%',   desc: 'Blocks cannon damage', pct: true,
    tiers: [{ cost: 70, value: 0.12 }, { cost: 160, value: 0.24 }, { cost: 320, value: 0.36 }] },
  { id: 'sails',   name: 'SAILS',         icon: '⛵', stat: 'speed',   unit: '%',   desc: 'Faster top speed', pct: true,
    tiers: [{ cost: 50, value: 1.12 }, { cost: 120, value: 1.24 }, { cost: 240, value: 1.38 }] },
  { id: 'rudder',  name: 'RUDDER',        icon: '☸️', stat: 'turn',    unit: '%',   desc: 'Sharper turns', pct: true,
    tiers: [{ cost: 40, value: 1.18 }, { cost: 100, value: 1.36 }, { cost: 200, value: 1.55 }] },
  { id: 'cannons', name: 'CANNONS',       icon: '💣', stat: 'cannons', unit: ' / side', desc: 'More guns per broadside',
    tiers: [{ cost: 90, value: 5 }, { cost: 200, value: 6 }, { cost: 380, value: 7 }] },
  { id: 'reload',  name: 'GUN CREW',      icon: '⏱️', stat: 'reload',  unit: 's',   desc: 'Faster reload', dec: 1,
    tiers: [{ cost: 70, value: 1.9 }, { cost: 160, value: 1.6 }, { cost: 320, value: 1.3 }] },
  { id: 'range',   name: 'SPYGLASS',      icon: '🔭', stat: 'range',   unit: ' m',  desc: 'Longer cannon range',
    tiers: [{ cost: 50, value: 110 }, { cost: 120, value: 130 }, { cost: 240, value: 150 }] },
];

// Repairs are a consumable, not a tier.
export const REPAIR = { cost: 30, hp: 35 };

export function newRun() {
  return { levels: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), spent: 0 };
}

export function shipStats(run, base = BASE_SHIP) {
  const s = { ...base };
  for (const u of UPGRADES) { const lv = run.levels[u.id] || 0; if (lv > 0) s[u.stat] = u.tiers[lv - 1].value; }
  return s;
}

// Copy stats onto the live player object (the fields main.js reads).
export function applyStats(player, stats) {
  const grow = stats.maxHp - (player.maxHp || stats.maxHp);
  player.maxHp = stats.maxHp;
  player.hp = Math.min(player.maxHp, Math.max(0, player.hp + Math.max(0, grow)));
  player.armor = stats.armor;
  player.speedMul = stats.speed;
  player.turnMul = stats.turn;
  player.cannons = stats.cannons;
  player.reload = stats.reload;
  player.range = stats.range;
}

export function fmtStat(u, v) {
  if (u.pct) return u.stat === 'armor' ? `${Math.round(v * 100)}%` : `+${Math.round((v - 1) * 100)}%`;
  if (u.dec) return `${v.toFixed(u.dec)}s`;
  return `${v}${u.unit}`;
}

// Cannon list for a broadside: the mesh's muzzles, repeated if the ship has more guns than modelled.
export function gunList(ship, side) {
  const m = ship.mesh.userData.muzzles[side];
  const n = ship.cannons || m.length;
  if (n <= m.length || !m.length) return m.slice(0, Math.max(1, n));
  const out = [];
  for (let i = 0; i < n; i++) out.push(m[i % m.length]);
  return out;
}
