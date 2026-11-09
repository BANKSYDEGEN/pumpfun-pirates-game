// [slower-swim] t2445u BANKSY "Also slow down swimming": regular stroke ~25% slower than v348;
// jump-swim (dolphin/porpoise) absolute tops unchanged. No separate underwater dive horizontal speed.
// node --test tests/slowerSwim.test.mjs
import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

register('../tools/roundabout_blender/node/hooks.mjs', import.meta.url);
globalThis.location = { search: '', href: 'http://x/', hostname: 'x' };
globalThis.window = globalThis; globalThis.self = globalThis;

const PHYS_M = await import('../js/onfoot/physics.js');
const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
// WALK lives in walker.js (THREE-heavy); pin the known constants so this stays a pure physics check.
const WALK = { walk: 4.2, run: 9.6 };
assert.match(R('js/onfoot/walker.js'), /walk:\s*4\.2,\s*run:\s*9\.6/);

test('t2445u: PHYS.swim is 25% slower than v348 [7.4, 11.3]; SWIM_SURGE absolute tops stay 11.475 / 17.55', () => {
  const { PHYS, SWIM_SURGE } = PHYS_M;
  assert.deepEqual(PHYS.swim, [5.55, 8.475]);
  assert.deepEqual(SWIM_SURGE.speed, [8.5 * 1.35, 13.0 * 1.35]);
  assert.ok(Math.abs(PHYS.swim[0] * SWIM_SURGE.kOf(false) - 11.475) < 1e-9);
  assert.ok(Math.abs(PHYS.swim[1] * SWIM_SURGE.kOf(true) - 17.55) < 1e-9);
  // Matching 25% cut on jump-swim (NOT applied — report only): current [11.475, 17.55] → would be [8.60625, 13.1625]
  assert.ok(PHYS.swim[1] < WALK.run, 'sprint swim stays below run');
  assert.ok(PHYS.swim[0] > WALK.walk, 'stroke still above walk (historical; see report)');
});

test('t2445u: foot net + ship MAX_SPEED still accept the new swim (no hard foot-speed reject)', () => {
  const net = R('js/onfoot/net.js'), pvp = R('js/pvp.js');
  // Foot peers lerp reported speed; no clamp against PHYS.swim
  assert.match(net, /p\.tspeed = ft\[3\] \/ 10/);
  assert.match(net, /p\.speed \+= \(\(p\.tspeed \|\| 0\) - p\.speed\) \* k/);
  assert.doesNotMatch(net, /PHYS\.swim|MAX_SPEED/);
  // Ship anti-cheat MAX_SPEED is ship-scale (>> any foot swim, including jump-swim 17.55)
  assert.match(pvp, /const MAX_SPEED = 3 \* 4\.2 \* MAXED\.speed/);
});

test('t2445u: river waterfall→ocean path untouched by PHYS.swim change', () => {
  const rw = R('js/island/riverWater.js');
  assert.doesNotMatch(rw, /PHYS\.swim/);
  assert.match(rw, /waterfallGeometry|outflow|LAKE/);
});
