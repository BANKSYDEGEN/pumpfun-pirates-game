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
  regenWait: 20,   // self-repair: seconds without taking damage before the hull patches itself (main.js [repair])
  regenPct: 0.05,  // self-repair: share of max HP restored every 4 s once it kicks in; both raised by HULL PLANKS
  gunDmg: 1,       // multiplier on each of YOUR cannonballs (BALL_DMG per ball); raised by CANNONS
  reload: 2.2,     // seconds between broadsides (per side)
  range: 90,       // metres the gunners will auto-range a target
};

// Each upgrade: a stat it sets, and tiers with an increasing cost. `value` is the stat AFTER buying that tier.
// An upgrade can also raise more stats: `extra` lists them and each tier carries those values under the same keys.
// [Raul] upgrade buffs: hull / armor / cannons / gun crew / repair are stronger and the early tiers cheaper,
// so a run that spends its wave 1-3 gold survives wave 4. Enemies are unchanged; armor stays capped well below 60%.
// [more levels] 6 levels each (CANNONS 8), smaller steps: level II ≈ the old tier I (and I + II cost about what tier I did),
// the top level ends ~10-15% weaker than the old tier III, and maxing everything costs ~1.7× as much (5,275g vs 3,130g).
export const UPGRADES = [
  { id: 'hull',    name: 'HULL PLANKS',   icon: '🪵', stat: 'maxHp',   unit: ' HP', desc: 'More hull HP + faster self-repair', extra: ['regenWait', 'regenPct'],
    tiers: [{ cost: 20, value: 180, regenWait: 17, regenPct: 0.055 }, { cost: 25, value: 200, regenWait: 16, regenPct: 0.06 }, { cost: 70, value: 215, regenWait: 15, regenPct: 0.065 },
            { cost: 120, value: 235, regenWait: 14, regenPct: 0.07 }, { cost: 180, value: 255, regenWait: 13, regenPct: 0.072 }, { cost: 250, value: 275, regenWait: 12, regenPct: 0.075 }] },
  { id: 'armor',   name: 'IRON PLATING',  icon: '🛡️', stat: 'armor',   unit: '%',   desc: 'Blocks cannon & ram damage', pct: true,
    tiers: [{ cost: 25, value: 0.25 }, { cost: 30, value: 0.30 }, { cost: 80, value: 0.32 }, { cost: 130, value: 0.34 }, { cost: 190, value: 0.355 }, { cost: 260, value: 0.37 }] },
  { id: 'sails',   name: 'SAILS',         icon: '⛵', stat: 'speed',   unit: '%',   desc: 'Faster top speed', pct: true,
    tiers: [{ cost: 25, value: 1.06 }, { cost: 30, value: 1.12 }, { cost: 80, value: 1.17 }, { cost: 120, value: 1.22 }, { cost: 170, value: 1.28 }, { cost: 230, value: 1.33 }] },
  { id: 'rudder',  name: 'RUDDER',        icon: '☸️', stat: 'turn',    unit: '%',   desc: 'Sharper turns', pct: true,
    tiers: [{ cost: 20, value: 1.1 }, { cost: 25, value: 1.18 }, { cost: 65, value: 1.25 }, { cost: 100, value: 1.32 }, { cost: 145, value: 1.4 }, { cost: 200, value: 1.48 }] },
  { id: 'cannons', name: 'CANNONS',       icon: '💣', stat: 'cannons', unit: ' / side', desc: 'More, heavier guns: broadside damage', extra: ['gunDmg'],
    tiers: [{ cost: 30, value: 5, gunDmg: 1.2 }, { cost: 45, value: 5, gunDmg: 1.35 }, { cost: 80, value: 6, gunDmg: 1.2 }, { cost: 120, value: 6, gunDmg: 1.3 },
            { cost: 165, value: 7, gunDmg: 1.2 }, { cost: 220, value: 7, gunDmg: 1.28 }, { cost: 280, value: 8, gunDmg: 1.2 }, { cost: 350, value: 8, gunDmg: 1.27 }] },
  { id: 'reload',  name: 'GUN CREW',      icon: '⏱️', stat: 'reload',  unit: 's',   desc: 'Faster reload', dec: 2,
    tiers: [{ cost: 25, value: 1.8 }, { cost: 30, value: 1.6 }, { cost: 85, value: 1.5 }, { cost: 135, value: 1.4 }, { cost: 195, value: 1.3 }, { cost: 270, value: 1.22 }] },
  { id: 'range',   name: 'SPYGLASS',      icon: '🔭', stat: 'range',   unit: ' m',  desc: 'Longer cannon range',
    tiers: [{ cost: 25, value: 100 }, { cost: 30, value: 110 }, { cost: 80, value: 117 }, { cost: 120, value: 124 }, { cost: 170, value: 133 }, { cost: 230, value: 142 }] },
];
// Roman numerals for shop labels / stamps (up to 8 levels).
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
// Map a 0..n level to the old 0..3 scale (sound tiers etc. were authored for 3 tiers).
export const tier3 = (id, lv) => { const u = UPGRADES.find(x => x.id === id); return u ? Math.round((Math.max(0, Math.min(u.tiers.length, lv || 0)) / u.tiers.length) * 3) : Math.min(3, lv || 0); };

// Damage of one of YOUR cannonballs before CANNONS gunDmg (main.js rolls rnd(min, max) × gunDmg).
export const BALL_DMG = [14, 20];

// Repairs are a consumable, not a tier.
export const REPAIR = { cost: 25, hp: 50 }; // [Raul] upgrade buffs: was 30g for +35 HP

export function newRun() {
  return { levels: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), spent: 0 };
}

export function shipStats(run, base = BASE_SHIP) {
  const s = { ...base };
  for (const u of UPGRADES) { const lv = run.levels[u.id] || 0; if (lv > 0) { const t = u.tiers[lv - 1]; s[u.stat] = t.value; for (const k of u.extra || []) s[k] = t[k]; } }
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
  player.gunDmg = stats.gunDmg ?? 1;
  player.regenWait = stats.regenWait; // player-only self-repair boost (enemy repair in enemyTypes.js is separate)
  player.regenPct = stats.regenPct;
  player.reload = stats.reload;
  player.range = stats.range;
}

// Card text for one stat value; pass the matching `extra` value (gunDmg) too. CANNONS shows the average damage of
// one full broadside (guns × ball damage × gunDmg) so more AND heavier guns read as one short number on phones.
export function fmtStat(u, v, extra) {
  if (u.id === 'cannons') return `${Math.round(v * (BALL_DMG[0] + BALL_DMG[1]) / 2 * (extra || 1))} dmg`;
  return fmtMain(u, v);
}
function fmtMain(u, v) {
  if (u.pct) return u.stat === 'armor' ? `${Math.round(v * 100)}%` : `+${Math.round((v - 1) * 100)}%`;
  if (u.dec) return `${+v.toFixed(u.dec)}s`;
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
