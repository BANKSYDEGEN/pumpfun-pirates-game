// [Raul] enemy types — tougher rug ships that scale with the wave, so ship upgrades matter.
// Data-driven: tweak the numbers here, main.js just asks for a roster and applies a type.

export const ENEMY_TYPES = {
  sloop:   { label: 'SLOOP',   len: 14,  hp: 70,  cannons: 2, dmg: 1.0,  reloadMul: 1.0,  speed: [7, 9],   accuracy: 0 },
  frigate: { label: 'FRIGATE', len: 17,  hp: 115, cannons: 3, dmg: 1.15, reloadMul: 0.9,  speed: [6.8, 7.6], accuracy: 0.03 },
  galleon: { label: 'GALLEON', len: 20.5, hp: 185, cannons: 4, dmg: 1.35, reloadMul: 1.05, speed: [5.4, 6], accuracy: 0.05 },
  // DEV WALLET boss every 4th wave (rebalanced: tankier, hits harder, gets faster each time it returns)
  boss:    { label: 'BOSS',    len: 22,  hp: 240, cannons: 5, dmg: 1.5,  reloadMul: 0.8,  speed: [6, 6.6], accuracy: 0.05 },
};

// Which ships show up in a wave. Same ship count as before: min(2 + wave, 8).
export function waveRoster(wave) {
  const n = Math.min(2 + wave, 8);
  const boss = wave % 4 === 0;
  let galleons = wave >= 5 ? Math.min(Math.floor((wave - 3) / 2), 3) : 0;
  let frigates = wave >= 2 ? Math.min(Math.floor(wave / 2), 4) : 0;
  const slots = n - (boss ? 1 : 0) - 1; // always keep at least one sloop
  galleons = Math.min(galleons, slots); frigates = Math.min(frigates, slots - galleons);
  const list = [];
  if (boss) list.push('boss');
  for (let i = 0; i < galleons; i++) list.push('galleon');
  for (let i = 0; i < frigates; i++) list.push('frigate');
  while (list.length < n) list.push('sloop');
  return list;
}

const rnd = (a, b) => a + Math.random() * (b - a);

// Apply a type to an enemy that spawnEnemy() already built (mesh is rescaled, not rebuilt,
// so it keeps whatever look ships.js gives it).
export function applyEnemyType(e, typeId, wave) {
  const T = ENEMY_TYPES[typeId] || ENEMY_TYPES.sloop;
  const u = e.mesh.userData;
  const k = T.len / u.len;
  if (Math.abs(k - 1) > 0.02) { e.mesh.scale.setScalar(k); u.len *= k; u.beam *= k; u.depth *= k; }
  e.type = typeId;
  e.hp = e.maxHp = Math.round(T.hp * (1 + wave * 0.12) * (typeId === 'boss' ? 1 + Math.floor(wave / 4 - 1) * 0.1 : 1));
  e.cannons = T.cannons;
  e.dmgMul = T.dmg;
  e.reload *= T.reloadMul;
  e.maxSpeed = rnd(T.speed[0], T.speed[1]) * (1 + Math.min(wave, 10) * 0.02);
  e.accuracy = Math.min(0.92, e.accuracy + T.accuracy);
  if (typeId !== 'sloop' && typeId !== 'boss') {
    const nm = e.bar.querySelector('.name');
    nm.textContent = `${nm.textContent} · ${T.label}`;
    e.bar.classList.add(`t-${typeId}`);
  }
  if (typeId === 'boss') e.bar.classList.add('t-boss');
  return e;
}
