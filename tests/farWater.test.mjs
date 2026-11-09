// [far-water] t2443u/t2444u: distant ocean matches near — same swell scroll, deep horizon, Fresnel + glint.
// node --test tests/farWater.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WAVES, SEA_REACH, FOG_COLOR } from '../js/ocean.js';

const src = () => readFileSync(new URL('../js/ocean.js', import.meta.url), 'utf8');

test('v348 single continuous sea surface kept (SEA_REACH, one seaGeometry)', () => {
  assert.ok(SEA_REACH >= 5000);
  const s = src();
  assert.match(s, /seaGeometry/);
  assert.match(s, /\[v348\]/);
  // still one createOcean mesh path
  assert.equal([...s.matchAll(/export function createOcean/g)].length, 1);
});

test('Gerstner WAVES primary wind is the far-water scroll reference', () => {
  assert.equal(WAVES.length, 4);
  const [x, z] = WAVES[0];
  const n = Math.hypot(x, z);
  assert.ok(x / n > 0.9 && z / n > 0.2); // ~ (0.94, 0.33)
});

test('no opposing hard-coded far/near ripple directions remain', () => {
  const s = src();
  // the old anti-wind ripples
  assert.ok(!s.includes('vec2(-0.7, -0.71)'));
  assert.ok(!s.includes('vec2(-0.95, 0.31)'));
  assert.ok(!s.includes('vec2(0.25, -0.97)'));
  assert.ok(!s.includes('vec2(uTime * 0.03, -uTime * 0.02)')); // foam against the wind
});

test('near + far macro normals share uWaves / wind dirs and gerstner omega', () => {
  const s = src();
  assert.match(s, /vec2 wind = normalize\(uWaves\[0\]\.xy/);
  assert.match(s, /rfFar/);
  assert.match(s, /kFar/);
  assert.match(s, /sqrt\(9\.8 \* kFar\)/);
  assert.match(s, /gN \* rfNear \+ gF \* rfFar/);
  // cross-swell capped ~20°, not reverse
  assert.match(s, /wind\.x \* 0\.94 - wind\.y \* 0\.34/);
});

test('far horizon tints deep sea; Fresnel + horizon sun glint present', () => {
  const s = src();
  assert.match(s, /fogSea/);
  assert.match(s, /hzGlint/);
  assert.match(s, /farAmt/);
  // must not melt solely into pale uSkyHorizon
  assert.match(s, /fogFar/);
  assert.match(s, /rfFar = smoothstep\(250\.0/);
  assert.match(s, /mix\(mid, deep/);
  assert.ok(FOG_COLOR !== undefined);
});

test('far-water comments mark t2443u/t2444u and keep one draw call', () => {
  const s = src();
  assert.match(s, /\[far-water\] t2443u\/t2444u/);
  assert.match(s, /one draw call/);
});
