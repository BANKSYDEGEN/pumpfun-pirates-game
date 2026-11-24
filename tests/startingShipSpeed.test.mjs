// Starting ship speed: SAIL_SPEED is 50/9 m/s per sail so 3-sail top is 20.0 kn on the HUD (speed × 1.2).
// Prestige skins share this base; SAILS upgrades must stay strictly faster than the unupgraded ship.
// node --test tests/startingShipSpeed.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE_SHIP, SAIL_SPEED, UPGRADES, shipStats, modeStats, maxRun, PVP_BOOST } from '../js/upgrades.js';

const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const sails = UPGRADES.find(u => u.id === 'sails');
const top = (mul, sail = 3) => sail * SAIL_SPEED * mul;
const hudKn = (mul, sail = 3) => (top(mul, sail) * 1.2).toFixed(1);

test('SAIL_SPEED is 50/9 so starting full sails show 20.0 kn, and is the live movement / cap constant', () => {
  assert.equal(SAIL_SPEED, 50 / 9);
  assert.equal(BASE_SHIP.speed, 1);
  assert.equal(top(1), 3 * (50 / 9));
  assert.equal(hudKn(1), '20.0');
  const main = R('js/main.js'), pvp = R('js/pvp.js');
  assert.match(main, /player\.sail \* SAIL_SPEED \* \(player\.speedMul \|\| 1\)/);
  assert.doesNotMatch(main, /player\.sail \* 4\.2 \*/);
  assert.match(main, /\$\('knots'\)\.textContent = `\$\{\(player\.speed \* 1\.2\)\.toFixed\(1\)\} kn`/);
  assert.match(pvp, /const MAX_SPEED = 3 \* SAIL_SPEED \* MAXED\.speed/);
  assert.doesNotMatch(pvp, /3 \* 4\.2 \* MAXED\.speed/);
});

test('SAILS tiers stay strictly faster than the new base, so upgrades still matter', () => {
  assert.ok(sails);
  let prev = BASE_SHIP.speed;
  for (const [i, t] of sails.tiers.entries()) {
    assert.ok(t.value > prev, `SAILS ${i + 1} (${t.value}) must beat the previous speed ${prev}`);
    prev = t.value;
  }
  const baseTop = top(shipStats({ levels: {} }).speed);
  assert.equal(baseTop, 3 * (50 / 9));
  for (let lv = 1; lv <= sails.tiers.length; lv++) {
    const s = shipStats({ levels: { sails: lv } }).speed;
    assert.ok(top(s) > baseTop, `SAILS ${lv} top ${top(s)} must beat starting top ${baseTop}`);
  }
});

test('PvP boost does not let an unupgraded ship overtake a SAILS upgrade', () => {
  const pvp = { base: 150, mul: 1, boost: true };
  const base = modeStats({ levels: {} }, pvp).speed;
  const first = modeStats({ levels: { sails: 1 } }, pvp).speed;
  const maxed = modeStats(maxRun(), pvp).speed;
  assert.equal(base, BASE_SHIP.speed);
  assert.ok(first > base);
  assert.ok(maxed > first);
  assert.equal(maxed, Math.round((BASE_SHIP.speed + (sails.tiers.at(-1).value - BASE_SHIP.speed) * PVP_BOOST.speed) * 1000) / 1000);
});
