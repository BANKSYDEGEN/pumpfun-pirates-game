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
export function waveRoster(wave, rand = Math.random) { // [enemy variety] rand: seeded for the DAILY run
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
  addSpecialShip(list, wave, rand); // [enemy variety] at most one rammer / runner per wave
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
  if (typeId !== 'sloop' && typeId !== 'boss' && T.label) { // [enemy variety] new builds carry no label
    const nm = e.bar.querySelector('.name');
    nm.textContent = `${nm.textContent} · ${T.label}`;
    e.bar.classList.add(`t-${typeId}`);
  }
  if (typeId === 'boss') e.bar.classList.add('t-boss');
  return e;
}

// =====================================================================================
// [enemy variety] additions (not Raul's code above). Two extra ship builds + DEV WALLET attack patterns.
// Internal ids only ('rammer', 'runner'); these are never shown as names anywhere (health bars only).
// =====================================================================================
//  rammer: small, quick, no guns. Closes in, winds up (slows, shakes, red flash on its bar), then charges and rams.
//  runner: no guns, always flees, carries big gold. Escapes (despawns) if it gets far enough away or time runs out.
Object.assign(ENEMY_TYPES, {
  rammer: { len: 11,   hp: 55, cannons: 0, dmg: 1, reloadMul: 1, speed: [9.6, 10.4], accuracy: 0 },
  runner: { len: 12.5, hp: 60, cannons: 0, dmg: 1, reloadMul: 1, speed: [9.4, 10.0], accuracy: 0 },
});
// hull / rig / colours passed to buildShip() (schemes live in ships.js)
export const ENEMY_BUILDS = {
  rammer: { len: 11, beam: 3.5, depth: 2.4, scheme: 'rammer', masts: 2, cannonsPerSide: 0 },
  runner: { len: 12.5, beam: 4.3, depth: 2.6, scheme: 'runner', masts: 2, cannonsPerSide: 0 },
};
export const RAM = { windupAt: 42, windup: 1.1, chargeSpeed: 21, chargeTime: 2.6, recover: 3.4, dmg: 18, selfDmg: 0.35 };
export const RUN = { escapeDist: 300, maxTime: 55, goldChests: 3, goldBase: 70, goldPerWave: 12 };
export const BOSS_ATTACKS = { barrageEvery: [9, 12], barrageVolleys: 3, barrageGap: 0.45, barrageRange: 85, summonAt: 0.5, escorts: 2 };

// First DEV WALLET (wave 4) is an intro fight a no-upgrade player can win; later bosses keep the full stats
// (Raul's numbers above) and keep ramping. Applied after applyEnemyType() by main.js.
export const BOSS_TUNE = { firstWave: 4, hp: 0.7, dmg: 0.78, reload: 1.25, escorts: 1, trim: ['frigate', 'sloop'] }; // first boss wave: boss + 1 frigate + 2 sloops (was boss + 2 + 3)
export const isFirstBossWave = (wave) => wave === BOSS_TUNE.firstWave;
// early-wave grace for a no-upgrade ship: enemy cannon damage x0.8 on waves 1-4, full damage from wave 5 on
export const EARLY_DMG = { untilWave: 4, mul: 0.8 };
export function tuneEnemy(e, wave) {
  if (wave <= EARLY_DMG.untilWave && e.dmgMul) e.dmgMul *= EARLY_DMG.mul;
  return tuneBoss(e, wave);
}
export function tuneBoss(e, wave) {
  if (e.type !== 'boss' || !isFirstBossWave(wave)) return e;
  e.hp = e.maxHp = Math.round(e.maxHp * BOSS_TUNE.hp);
  e.dmgMul *= BOSS_TUNE.dmg; e.reload *= BOSS_TUNE.reload; e.escorts = BOSS_TUNE.escorts;
  return e;
}

function addSpecialShip(list, wave, rand) {
  if (isFirstBossWave(wave)) for (const t of BOSS_TUNE.trim) { const i = list.lastIndexOf(t); if (i >= 0 && list.filter(x => x === t).length > 1) list.splice(i, 1); }
  const sloopAt = list.lastIndexOf('sloop');
  if (sloopAt < 0) return;
  const r = rand(), bossWave = list.includes('boss');
  let pick = null;
  if (bossWave) pick = !isFirstBossWave(wave) && r < 0.4 ? 'rammer' : null; // boss waves are busy already (none on the first)
  else if (wave >= 3) pick = r < 0.6 ? 'rammer' : r < 0.85 ? 'runner' : null;
  else if (wave === 2) pick = r < 0.35 ? 'runner' : null;
  if (pick) list[sloopAt] = pick;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Per-frame AI for the new builds and the boss extras. Returns true when it fully handled movement for e.
// k = { player, enemies, game, moveShip, floatShip, fire, damage, spawnEnemy, despawn, fx, popup, sfx, V3 }
export function updateSpecialEnemy(e, dt, k) {
  if (e.type === 'rammer') return updateRammer(e, dt, k);
  if (e.type === 'runner') return updateRunner(e, dt, k);
  if (e.type === 'boss') updateBossAttacks(e, dt, k); // the boss keeps Raul's movement; this only adds attacks
  return false;
}

function updateRammer(e, dt, k) {
  const p = k.player, dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
  e.ram = e.ram || { st: 'approach', t: 0, yaw: 0, hit: false };
  const R = e.ram; R.t += dt;
  let desired = toP, spd = e.maxSpeed;
  e.state = 'engage';
  if (!p.alive) { R.st = 'approach'; spd = e.maxSpeed * 0.4; desired = e.yaw; }
  else if (R.st === 'approach') {
    spd = e.maxSpeed * (d < 90 ? 0.75 : 1);
    if (d < RAM.windupAt) { R.st = 'windup'; R.t = 0; e.bar.classList.add('windup'); k.fx.ring(new k.V3(e.x, 0.3, e.z), 2, 10, 1.1); }
  } else if (R.st === 'windup') {
    spd = e.maxSpeed * 0.15; desired = toP;
    e.roll += Math.sin(R.t * 40) * 0.02; // shake
    if (R.t > RAM.windup) { R.st = 'charge'; R.t = 0; R.yaw = toP; R.hit = false; e.bar.classList.remove('windup'); e.bar.classList.add('charging'); }
  } else if (R.st === 'charge') {
    desired = R.yaw + clamp(angWrap(toP - R.yaw), -0.25, 0.25); // a little homing, mostly committed
    e.speed = Math.max(e.speed, RAM.chargeSpeed * Math.min(1, R.t * 2.5)); spd = RAM.chargeSpeed;
    if (Math.random() < 0.7) k.fx.spray(new k.V3(e.x + Math.sin(e.yaw) * 5, e.y + 0.8, e.z + Math.cos(e.yaw) * 5), new k.V3((Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 6));
    const reach = (e.mesh.userData.len + p.mesh.userData.len) * 0.36;
    if (!R.hit && d < reach) {
      R.hit = true;
      const amt = Math.max(1, Math.round(RAM.dmg * (1 + k.game.wave * 0.05) * (1 - (p.armor || 0))));
      k.damage(p, amt, new k.V3(p.x, p.y + 2, p.z), e); // src = the rammer (Raul's damage sounds)
      k.game.shake = Math.max(k.game.shake, 1.2);
      p.speed *= 0.4; p.x += Math.sin(R.yaw) * 2.5; p.z += Math.cos(R.yaw) * 2.5; // shove
      k.damage(e, Math.round(e.maxHp * RAM.selfDmg), new k.V3(e.x, e.y + 2, e.z), p);
      R.st = 'recover'; R.t = 0; e.speed = -3;
    }
    if (R.t > RAM.chargeTime) { R.st = 'recover'; R.t = 0; }
    if (R.st === 'recover') e.bar.classList.remove('charging');
  } else if (R.st === 'recover') {
    desired = toP + Math.PI * 0.6; spd = e.maxSpeed * 0.5;
    if ((R.t > RAM.recover && d > 30) || R.t > RAM.recover * 2) { R.st = 'approach'; R.t = 0; } // back off before the next run-up
  }
  if (!e.alive) return true;
  k.moveShip(e, dt, spd, clamp(angWrap(desired - e.yaw) * 2.5, -1, 1));
  k.floatShip(e, dt);
  return true;
}

function updateRunner(e, dt, k) {
  const p = k.player, dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
  e.runT = (e.runT || 0) + dt; e.state = 'flee';
  // flee away from the player, weaving a little so it reads as a runner
  const desired = Math.atan2(dx, dz) + Math.sin(e.runT * 0.7) * 0.35;
  k.moveShip(e, dt, e.maxSpeed, clamp(angWrap(desired - e.yaw) * 2, -1, 1));
  k.floatShip(e, dt);
  if (Math.random() < 0.25) k.fx.sparkle(new k.V3(e.x, e.y + 2.5, e.z)); // gold glints on deck
  if (d > RUN.escapeDist || e.runT > RUN.maxTime) k.despawn(e, 'escaped');
  return true;
}

function updateBossAttacks(e, dt, k) {
  const p = k.player, d = Math.hypot(p.x - e.x, p.z - e.z), B = BOSS_ATTACKS;
  // summon 2 escorts once, at 50% hull
  if (!e.summoned && e.hp > 0 && e.hp <= e.maxHp * B.summonAt) {
    e.summoned = true;
    for (let i = 0, n = e.escorts ?? B.escorts; i < n; i++) {
      const side = i ? 1 : -1, px = Math.cos(e.yaw) * side, pz = -Math.sin(e.yaw) * side;
      const s = k.spawnEnemy(e.x + px * 14 - Math.sin(e.yaw) * 6, e.z + pz * 14 - Math.cos(e.yaw) * 6, 1, 'sloop');
      s.escort = true; s.yaw = e.yaw; s.speed = 5;
      k.fx.ring(new k.V3(s.x, 0.3, s.z), 2, 14, 1.4);
    }
    k.popup(new k.V3(e.x, e.y + 12, e.z), 'ESCORTS!', 'dmg');
  }
  // broadside barrage: 3 quick volleys from the side facing you, every 9-12 s when in range
  e.barrageCd = (e.barrageCd ?? B.barrageEvery[0]) - dt;
  if (e.barrage) {
    e.barrage.t -= dt;
    if (e.barrage.t <= 0 && e.barrage.n > 0) { k.fire(e, e.barrage.side, p, Math.max(0.35, e.accuracy - 0.15)); e.barrage.n--; e.barrage.t = B.barrageGap; }
    if (e.barrage.n <= 0) e.barrage = null;
  } else if (e.barrageCd <= 0 && d < B.barrageRange && p.alive) {
    const c = Math.cos(e.yaw), n = Math.sin(e.yaw), lx = (p.x - e.x) * c - (p.z - e.z) * n;
    e.barrage = { side: lx > 0 ? 'port' : 'star', n: k.game.wave < 8 ? B.barrageVolleys - 1 : B.barrageVolleys, t: 0.6 }; // first DEV WALLET fight: 2 volleys, later 3
    e.bar.classList.add('windup'); setTimeout(() => e.bar.classList.remove('windup'), 900);
    e.barrageCd = B.barrageEvery[0] + Math.random() * (B.barrageEvery[1] - B.barrageEvery[0]);
    e.cd = Math.max(e.cd, 2.5); // its normal broadside waits until the barrage is done
  }
}
