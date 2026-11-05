// [v267] castle upstairs: rampart landing hw/hl must span the top tread → wall-walk (BANKSY 10:47 AM fall-through)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/island/areas/fort.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
test('sw is pfp-v267', () => { assert.match(sw, /const VERSION = 'pfp-v267'/); });
test('fort_rampart_land: spans stair→wall-walk L (hl along x under yaw π/2, not the swapped 1.45 m hole)', () => {
  assert.match(src, /id:\s*'fort_rampart_land'[\s\S]{0,200}hl:\s*4\.0,\s*yaw:\s*Math\.PI\s*\/\s*2/);
  assert.doesNotMatch(src, /fort_rampart_land[\s\S]{0,80}hw:\s*2\.5,\s*hl:\s*NSTAIR\.hw/);
});
test('spy pad + larger interact + tower deck solid', () => {
  assert.match(src, /id:\s*'fort_spy_pad'/);
  assert.match(src, /id:\s*'fort_spyglass'[\s\S]{0,80}r:\s*2\.2/);
  assert.match(src, /fort_tower_[\s\S]{0,60}r:\s*3\.6/);
});
test('rampart stair cheek colliders present', () => {
  assert.match(src, /NSTAIR\.z\s*\+\s*s\s*\*\s*\(NSTAIR\.hw\s*\+\s*0\.25\)/);
});
test('keeps v261 moundSkip gate + v257 fort EXIT return untouched here', () => {
  const hill = readFileSync(new URL('../js/island/areas/hillRound.js', import.meta.url), 'utf8');
  const dock = readFileSync(new URL('../js/dock/index.js', import.meta.url), 'utf8');
  assert.match(hill, /moundSkip/);
  assert.match(dock, /function fortReturn/);
  assert.match(dock, /specFrom\s*=\s*\{\s*src:\s*'fort'/);
});
test('upper level floors are castle stone (no timber wall-walk / landing)', () => {
  assert.match(src, /stoneFloor|BANKSY 10:55/);
  assert.match(src, /ENTIRE upper level = continuous castle STONE|continuous castle STONE/);
  // no timber ledge helper left in fort.js
  assert.doesNotMatch(src, /const ledge = .*C\.WOOD/);
  assert.doesNotMatch(src, /top landing on timber posts/);
});

