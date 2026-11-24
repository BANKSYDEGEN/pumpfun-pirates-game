// [ship-fixes t2746u] BANKSY 10:12 AM: "upgraded ship only 17.8 knots, only 37 booty for sinking a ship, aim assist won't hit a ship"
// + 10:14 AM "forget the aim for the hull of always gonna miss". node --test tests/shipFixes2746.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as BA from '../js/broadsideAim.js';
import { SAIL_SPEED, UPGRADES, shipStats, modeStats, maxRun } from '../js/upgrades.js';
import { harborGold, HARBOR_PAY_MUL, HARBOR_BOSS, PVP_BASE_HP, PVP_HULL_MUL, pvpTierCost } from '../js/config.js';
import { SHIP_SPEED_CAP } from '../js/shipCollide.js';
import { MAX_BOOST } from '../js/boosts.js';

const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const kn = (mul, sail = 3) => +(sail * SAIL_SPEED * mul * 1.2).toFixed(1);
const PVP = { base: PVP_BASE_HP, mul: PVP_HULL_MUL, boost: true };
const sails = UPGRADES.find(u => u.id === 'sails');

test('speed: every SAILS level beats the 20 kn starter at full sail, Waves and harbor/BR', () => {
  assert.equal(kn(1), 20);
  const waves = [], harbor = [];
  for (let lv = 1; lv <= sails.tiers.length; lv++) { waves.push(kn(shipStats({ levels: { sails: lv } }).speed)); harbor.push(kn(modeStats({ levels: { sails: lv } }, PVP).speed)); }
  assert.deepEqual(waves, [21.2, 22.4, 23.4, 24.4, 25.6, 26.6]);
  assert.deepEqual(harbor, [21.8, 23.6, 25.1, 26.6, 28.4, 29.9]);
  for (const v of [...waves, ...harbor]) assert.ok(v > 20);
  // the report: 17.8 kn is the PRE-v596 formula (3 × 4.2 m/s × 1.2) with harbor SAILS II (1 + 0.12 × 1.5 = 1.18), not v596+
  assert.equal(+(3 * 4.2 * 1.18 * 1.2).toFixed(1), 17.8);
});

test('speed: hull-contact clamp no longer cuts a fast upgraded ship (was 22 m/s = 26.4 kn)', () => {
  const maxed = 3 * SAIL_SPEED * modeStats(maxRun(), PVP).speed * (1 + MAX_BOOST.speed);
  assert.ok(maxed > 22, `maxed ${maxed}`);
  assert.ok(SHIP_SPEED_CAP >= maxed, `cap ${SHIP_SPEED_CAP} >= maxed ${maxed}`);
  assert.match(R('js/shipCollide.js'), /clamp\(a\.speed, -5, SHIP_SPEED_CAP\)/);
});

test('booty: regular harbor sink +50% (37 -> 56 at L 20), Commodore unchanged, upgrade prices unchanged', () => {
  assert.equal(HARBOR_PAY_MUL, 3);
  assert.deepEqual([0, 10, 20, 30, 44].map(harborGold), [15, 36, 56, 77, 105]);
  const oldGold = (L) => Math.round(5 * 2 * (1 + 0.137 * L));
  assert.equal(oldGold(20), 37);
  for (const L of [0, 10, 20, 44]) assert.ok(Math.abs(harborGold(L) * HARBOR_BOSS.pay - oldGold(L) * 12) <= 8, `boss L${L}`);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(pvpTierCost), [75, 540, 930, 1500, 2360, 3750]);
  // the harbor HUD 'pay N Booty' shows what a sink in this copy really drops (scaleAi uses copyLevel)
  const p = R('js/pvp.js');
  assert.match(p, /pay \$\{formatGoldAmount\(harborGold\(copyLevel\(\)\)\)\} Booty/);
  assert.match(p, /e\.gold = harborGold\(L\); e\.aiLevel = L;/);
});

// --- aim assist ---
const sideDir = (yaw, side) => { const k = side === 'port' ? 1 : -1; return { x: Math.cos(yaw) * k, z: -Math.sin(yaw) * k }; };
function volley({ sp, tsp, trel, range, bearing = 0, nGuns = 6, mode }) {
  const yaw = 0, dir = sideDir(yaw, 'port'), fw = { x: 0, z: 1 }, b = bearing * Math.PI / 180;
  const off = { x: dir.x * Math.cos(b) - dir.z * Math.sin(b), z: dir.x * Math.sin(b) + dir.z * Math.cos(b) };
  const vel0 = BA.forwardVel(yaw, sp), dt = 1 / 60; let hits = 0;
  for (let i = 0; i < nGuns; i++) {
    const T = { x: off.x * range, z: off.z * range, y: 0, yaw: trel * Math.PI / 180, speed: tsp, deckY: 2.6, depth: 3, beam: 5.6, len: 18 };
    const along = (i - (nGuns - 1) / 2) * 1.6, p = { x: dir.x * 2.2, y: 2.4, z: fw.z * along };
    const fan = (i - (nGuns - 1) / 2) * Math.min(1.2, 8.4 / Math.max(1, nGuns - 1));
    let v, home = null;
    if (mode === 'live') { // v568-v597: aim at the lead point, add vel0 on top, home 1.35 s
      const lp = BA.leadPoint(0, 0, T, BA.AIM.lead), g = BA.playerAimVelocity(p, dir, lp.x + fw.x * fan, lp.z + fw.z * fan, BA.hullAimY(T), BA.AIM.maxDev);
      if (!g) continue; v = { x: g.x + vel0.x, y: g.y, z: g.z + vel0.z }; home = { x: g.ax, z: g.az, until: BA.AIM.homeT, rate: BA.AIM.homeRate };
    } else { const g = BA.playerIntercept(p, dir, T, vel0, { fan }); if (!g) continue; v = { x: g.x, y: g.y, z: g.z }; }
    let px = p.x, py = p.y, pz = p.z, t = 0;
    while (t < 6) {
      if (home && t <= home.until) { const s = BA.steerHoriz(v.x, v.z, px, pz, home.x, home.z, home.rate, dt); v.x = s.x; v.z = s.z; }
      v.y -= BA.AIM.G * dt; px += v.x * dt; py += v.y * dt; pz += v.z * dt; t += dt;
      T.x += Math.sin(T.yaw) * T.speed * dt; T.z += Math.cos(T.yaw) * T.speed * dt;
      const c = Math.cos(T.yaw), n = Math.sin(T.yaw), lx = (px - T.x) * c - (pz - T.z) * n, lz = (px - T.x) * n + (pz - T.z) * c;
      if (Math.abs(lx) < T.beam / 2 + 0.7 && Math.abs(lz) < T.len / 2 + 0.6 && BA.inHullBand(T, py)) { hits++; break; }
      if (py < 0) break;
    }
  }
  return hits / nGuns;
}
const rate = (mode, sp, pred = () => true) => { let h = 0, n = 0;
  for (const tsp of [0, 6, 9, 16]) for (const trel of [0, 90, 180, 270, 45]) for (const range of [30, 55, 85]) for (const bearing of [0, 25, -25, 40, -40]) {
    if (!pred({ tsp, trel, range, bearing })) continue; h += volley({ sp, tsp, trel, range, bearing, mode }); n++; }
  return h / n; };

test('aim: exact intercept solves |D + w t| = H t (meets the moving target, your way included)', () => {
  const t = BA.interceptTime(50, 0, 0, 8, 42);
  assert.ok(Math.abs(Math.hypot(50, 8 * t) - 42 * t) < 1e-6);
  const T = { x: 55, z: 0, y: 0, yaw: Math.PI, speed: 9, deckY: 2.6, depth: 3, len: 18 }, dir = { x: 1, z: 0 }, vel0 = { x: 0, z: 16.7 };
  const g = BA.playerIntercept({ x: 2.2, y: 2.4, z: 0 }, dir, T, vel0);
  assert.ok(g && !g.clamped);
  const mx = T.x, mz = T.z - 9 * g.t; // target centre at impact
  assert.ok(Math.hypot(g.ax - mx, g.az - mz) < 1e-6, 'meets the centre mass');
  const ux = g.x - vel0.x, uz = g.z - vel0.z; assert.ok(Math.abs(Math.hypot(ux, uz) - BA.AIM.H) < 1e-6, 'muzzle speed is H');
  assert.ok(Math.abs(2.4 + g.y * g.t - 0.5 * BA.AIM.G * g.t * g.t - g.ty) < 1e-6, 'natural gravity arc lands at aim height');
});

test('aim: centre mass = deck height inside the hit band (not the waterline)', () => {
  const T = { y: 0, deckY: 2.6, depth: 3 };
  assert.equal(BA.centerMassY(T), 2.6);
  assert.ok(BA.inHullBand(T, BA.centerMassY(T)));
  assert.ok(BA.centerMassY({ y: 0, deckY: 6, depth: 3 }) <= BA.hullHitY1({ y: 0, deckY: 6, depth: 3 }) - 0.9 + 1e-9);
  assert.equal(BA.centerMassY({ footY: 4 }), 4.6);
});

test('aim: assisted broadsides land on moving ships at every own speed (was falling off with speed)', () => {
  const live = [0, 16.7, 22].map(sp => rate('live', sp)), fix = [0, 16.7, 22].map(sp => rate('fix', sp));
  assert.ok(fix[0] >= 0.92 && fix[0] >= live[0] - 0.03, `at anchor: fix ${fix[0]} vs live ${live[0]}`); // homing used to bend balls round the cone edge
  assert.ok(fix[1] >= 0.9 && fix[2] >= 0.9, `fix ${fix}`);
  assert.ok(fix[1] > live[1] + 0.15 && fix[2] > live[2] + 0.25, `fix ${fix} vs live ${live}`);
  // the case BANKSY hits most: full sail, target ahead or behind the beam at range
  const hard = (c) => c.range >= 55 && Math.abs(c.bearing) === 25;
  assert.ok(rate('fix', 16.7, hard) > rate('live', 16.7, hard) + 0.2);
  assert.ok(rate('fix', 22, hard) > rate('live', 22, hard) + 0.2);
});

test('aim: main.js uses the intercept for the player, no homing; AI path unchanged', () => {
  const m = R('js/main.js');
  assert.match(m, /BA\.playerIntercept\(p, dir, playerHome\.T, vel0, \{ delay: i \* gap, fan, aimY: playerHome\.y \}\)/);
  assert.match(m, /aimY = isPlayer \? BA\.centerMassY\(target\) : BA\.hullAimY\(target\)/);
  assert.doesNotMatch(m, /home = \{ x: g\.ax, z: g\.az, until: BA\.AIM\.homeT/);
  assert.match(m, /BA\.fireLine\(dir, shooter\.x, shooter\.z, aimPt\.x - vel0\.x \* tf, aimPt\.z - vel0\.z \* tf, BA\.AIM\.aiMaxDev\)/);
  assert.ok(BA.ASSIST.maxDev <= BA.AIM.cone, 'never steers wider than the lock cone');
});
