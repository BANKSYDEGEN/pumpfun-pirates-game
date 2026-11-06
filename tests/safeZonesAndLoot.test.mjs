// node --test tests/safeZonesAndLoot.test.mjs
// [backpack-pvp] BANKSY t1712u "Make fishing a safe zone too": Grandpa Gill's Fishing Dock + the Freshwater Lagoon shore.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { insideSafeZone, canFightOnFoot, zoneAt, wardPosts, safeShapes, isInsideColiseum, LAKE } from '../js/island/safeZones.js';
import { DIG_SPOTS } from '../js/island/digSpots.js';

test('t1712u fishing: cast spot, Grandpa Gill, dock approach are Safe Zone; no PvP while fishing', () => {
  assert.equal(insideSafeZone(-205, -95.8), true, 'lagoon_fish cast prompt');
  assert.equal(insideSafeZone(-199.5, -61.5), true, 'Grandpa Gill');
  assert.equal(insideSafeZone(-205, -63), true, 'south shore dock approach');
  for (let z = -63; z >= -97; z -= 1) assert.equal(insideSafeZone(-205, z), true, `dock plank z ${z}`);
  assert.equal(canFightOnFoot({}, -205, -95.8, 100), false);
  assert.equal(zoneAt(-205, -95.8).name, "Grandpa Gill's Fishing Dock");
  const src = readFileSync(new URL('../js/island/areas/lagoon.js', import.meta.url), 'utf8');
  assert.match(src, /const LAKE = \{ x: -205, z: -130, r: 58/); assert.deepEqual({ ...LAKE }, { x: -205, z: -130, r: 58 });
});

test('t1712u fishing zone: lanterns ring the shore (never in the lake), map shapes include it, digs + Coliseum untouched', () => {
  const near = wardPosts(14).filter(([x, z]) => Math.hypot(x + 205, z + 120) < 80);
  assert.ok(near.length >= 20, 'lanterns round the lagoon');
  for (const [x, z] of near) assert.ok(Math.hypot(x - LAKE.x, z - LAKE.z) >= LAKE.r + 2, 'no lantern floating on the lake');
  assert.ok(safeShapes().some((s) => s.part === 'fishing_lagoon'));
  for (const d of DIG_SPOTS.filter((x) => x.active)) assert.ok(Math.hypot(d.x + 205, d.z + 120) - 72 > 200, d.id);
  for (let a = 0; a < 6.28; a += 0.2) assert.equal(isInsideColiseum(-205 + Math.cos(a) * 72, -120 + Math.sin(a) * 72), false);
});
