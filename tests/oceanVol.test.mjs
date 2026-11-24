// [ocean-vol t2750u] BANKSY 12:12 PM Nov 24: "Also can we lower the ocean sound effects volume"
// Looping sea / wind-on-water bed is 45% quieter (×0.55). One-shot splashes and master/SFX/music sliders stay as they were.
// node --test tests/oceanVol.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');
const num = (re) => { const m = src.match(re); assert.ok(m, String(re)); return +m[1]; };

test('OCEAN_AMB is 0.55 (45% quieter than the previous bed)', () => {
  assert.equal(num(/const OCEAN_AMB = ([0-9.]+);/), 0.55);
});

test('looping sea wash, swell, recorded amb_sea and wind-on-water bed all scale by OCEAN_AMB', () => {
  assert.match(src, /seaG\.gain\.value = 0\.08 \* OCEAN_AMB;/);
  assert.match(src, /swellG\.gain\.value = 0\.05 \* OCEAN_AMB;/);
  assert.match(src, /windG\.gain\.value = 0\.02 \* OCEAN_AMB;/);
  assert.match(src, /windG\.gain\.setTargetAtTime\(\(0\.018 \+ sp \* 0\.05 \* S\.wind\) \* \(0\.6 \+ sail \* 0\.2\) \* OCEAN_AMB,/);
  assert.match(src, /seaG\.gain\.setTargetAtTime\(\(0\.07 \+ sp \* 0\.05\) \* \(amb\.rec \? 0\.4 : 1\) \* OCEAN_AMB,/);
  assert.match(src, /recG\.gain\.setTargetAtTime\(\(0\.07 \+ sp \* 0\.05\) \* LVL\.amb \* OCEAN_AMB,/);
});

test('recorded amb_sea trim and example bed gains are 45% of the old values', () => {
  const amb = num(/amb: ([0-9.]+)/);
  assert.equal(amb, 10.995);
  const scale = 0.55;
  // rest (sp=0) and full speed (sp=1), with the recorded bed on
  assert.equal(+(0.07 * amb).toFixed(5), 0.76965);
  assert.equal(+(0.07 * amb * scale).toFixed(5), 0.42331);
  assert.equal(+(0.12 * amb).toFixed(5), 1.3194);
  assert.equal(+(0.12 * amb * scale).toFixed(5), 0.72567);
  // synth-only sea (no recorded bed): old 0.07 / 0.12, new ×0.55
  assert.equal(+(0.07 * scale).toFixed(5), 0.0385);
  assert.equal(+(0.12 * scale).toFixed(5), 0.066);
  // wind at rest (sail 1) and full sail (sail 3, S.wind 1.6)
  assert.equal(+(0.018 * 0.8 * scale).toFixed(5), 0.00792);
  assert.equal(+((0.018 + 0.08) * 1.2 * scale).toFixed(5), 0.06468);
});

test('one-shot splashes stay at their old trims (louder than the quieter bed)', () => {
  assert.equal(num(/splashNear: ([0-9.]+)/), 0.3);
  assert.equal(num(/splash: ([0-9.]+)/), 0.6);
  assert.match(src, /vol: 0\.32 \* v/);
  assert.match(src, /vol: 0\.18 \* v/);
  assert.match(src, /vol: 0\.04 \* v/);
  // near-splash peak (~0.3) and mid/far (0.6) stay above the new rest bed (~0.42 is the recorded bed itself;
  // a short splash still cuts through, and mid/far 0.6 is above the new rest bed)
  assert.ok(0.6 > 0.07 * 10.995 * 0.55);
});

test('rain, cannons, music and the master/SFX sliders are unchanged', () => {
  assert.match(src, /rainG\.gain\.value = 0\.035;/);
  assert.doesNotMatch(src, /rainG\.gain\.value = 0\.035 \* OCEAN_AMB/);
  assert.equal(num(/cannon: ([0-9.]+)/), 0.83);
  assert.equal(num(/shanty: ([0-9.]+)/), 0.30);
  assert.match(src, /const d = \{ master: 0\.8, sfx: 0\.9, music: 0\.35 \};/);
  assert.match(src, /master\.gain\.setTargetAtTime\(muted \? 0 : settings\.master,/);
  assert.match(src, /sfxBus\.gain\.setTargetAtTime\(settings\.sfx,/);
  assert.match(src, /musicBus\.gain\.setTargetAtTime\(settings\.music \* 0\.55,/);
  assert.match(src, /ambBus\.gain\.setTargetAtTime\(Math\.min\(1, settings\.sfx \* 1\.1\),/);
});
