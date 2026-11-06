// [v343] BANKSY t1812u–t1814u: dynamic Caribbean sky — shared clock, sunrise/sunny/sunset/night, stars, storm blend
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  SKY_CYCLE_S, skyPhase, setPhase, clearPhase, phaseName, sunElevation, sunDir, moonDir,
  evalSky, evalSkyNow, isStormForced,
} from '../js/skyCycle.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

test('skyCycle exports + 20-minute shared clock', () => {
  assert.equal(SKY_CYCLE_S, 1200);
  const a = skyPhase(0);
  const b = skyPhase(1200_000); // exactly one cycle later
  assert.ok(Math.abs(a - b) < 1e-9 || Math.abs(a - b) > 0.999); // wrap
  const mid = skyPhase(600_000); // 10 minutes in
  assert.ok(mid > 0.4 && mid < 0.6);
});

test('setPhase overrides: sunrise / sunny / sunset / night / storm', () => {
  clearPhase();
  setPhase('sunny'); assert.equal(phaseName(skyPhase()), 'sunny');
  setPhase('sunrise'); assert.equal(phaseName(skyPhase()), 'sunrise');
  setPhase('sunset'); assert.equal(phaseName(skyPhase()), 'sunset');
  setPhase('night'); assert.equal(phaseName(skyPhase()), 'night');
  setPhase('storm'); assert.equal(isStormForced(), 1);
  clearPhase(); assert.equal(isStormForced(), null);
});

test('sun elevation: noon high, midnight low, sunrise/sunset ~0', () => {
  assert.ok(sunElevation(0.5) > 0.9);
  assert.ok(sunElevation(0.0) < -0.9);
  assert.ok(Math.abs(sunElevation(0.25)) < 0.08);
  assert.ok(Math.abs(sunElevation(0.75)) < 0.08);
  assert.ok(sunElevation(0.26) > -0.1);
});

test('sunDir / moonDir are unit length and roughly opposite', () => {
  const s = sunDir(0.5), m = moonDir(0.5);
  assert.ok(Math.abs(Math.hypot(s.x, s.y, s.z) - 1) < 1e-6);
  assert.ok(Math.abs(Math.hypot(m.x, m.y, m.z) - 1) < 1e-6);
  // moon roughly opposite sun
  assert.ok(s.x * m.x + s.y * m.y + s.z * m.z < -0.85);
});

test('sunny daytime: bright sun, zero stars, azure-ish zenith, no rain', () => {
  const st = evalSky(0.50, 0);
  assert.equal(st.name, 'sunny');
  assert.ok(st.sunVis > 0.8);
  assert.equal(st.starVis, 0);
  assert.ok(st.rainAlpha === 0);
  assert.ok(st.zenith.b > st.zenith.r); // blue-dominant zenith
  assert.ok(st.keyIntensity > 1.2);
  assert.ok(st.dayAmt > 0.7);
});

test('sunrise / sunset: golden warm horizon, sun near horizon', () => {
  const rise = evalSky(0.26, 0);
  const set = evalSky(0.74, 0);
  assert.equal(rise.name, 'sunrise');
  assert.equal(set.name, 'sunset');
  assert.ok(rise.goldenW > 0.4 || rise.sunriseW > 0.4);
  assert.ok(set.goldenW > 0.4 || set.sunsetW > 0.4);
  assert.ok(rise.horiz.r > 0.6); // warm coral/amber horizon
  assert.ok(set.horiz.r > 0.6);
  assert.ok(rise.sunVis > 0.2);
  assert.ok(Math.abs(rise.elev) < 0.35);
});

test('night: stars > 0, moon visible, readable key light, indigo zenith', () => {
  const st = evalSky(0.02, 0);
  assert.equal(st.name, 'night');
  assert.ok(st.starVis > 0.5, `starVis=${st.starVis}`);
  assert.ok(st.moonVis > 0.5);
  assert.ok(st.sunVis < 0.2);
  assert.ok(st.keyIntensity > 0.2, 'night stays playable'); // not pitch black
  assert.ok(st.zenith.b >= st.zenith.r);
  assert.ok(st.rainAlpha === 0);
});

test('storm=1: stars off, rain on, dark fog, sun/moon crushed', () => {
  const st = evalSky(0.50, 1);
  assert.ok(st.starVis === 0 || st.starVis < 1e-6);
  assert.ok(st.rainAlpha > 0.2);
  assert.ok(st.storm === 1);
  assert.ok(st.sunVis < 0.15);
  // fog matches darkened horizon
  assert.ok(st.fogColor.r < 0.2);
});

test('storm < 0.25: rain alpha is 0 (Harbor fair weather)', () => {
  assert.equal(evalSky(0.5, 0).rainAlpha, 0);
  assert.equal(evalSky(0.5, 0.2).rainAlpha, 0);
  assert.ok(evalSky(0.5, 0.5).rainAlpha > 0);
});

test('fog horizon matches sky horizon color', () => {
  for (const ph of [0.02, 0.22, 0.5, 0.78]) {
    const st = evalSky(ph, 0);
    assert.equal(st.fogColor.r, st.horiz.r);
    assert.equal(st.fogColor.g, st.horiz.g);
    assert.equal(st.fogColor.b, st.horiz.b);
  }
});

test('ocean.js createSky has day/night uniforms + stars; createOcean has uSunColor/uSky*', () => {
  const o = read('js/ocean.js');
  assert.match(o, /uSunDir/);
  assert.match(o, /uMoonDir/);
  assert.match(o, /uStarVis/);
  assert.match(o, /uSunVis/);
  assert.match(o, /uMoonVis/);
  assert.match(o, /Milky Way|mwN|starGate/);
  assert.match(o, /uSunColor/);
  assert.match(o, /uSkyZenith/);
  assert.match(o, /uSkyHorizon/);
  // still exports legacy symbols
  assert.match(o, /export function createSky/);
  assert.match(o, /export function createOcean/);
  assert.match(o, /export function createRain/);
  assert.match(o, /export const FOG_COLOR/);
  assert.match(o, /export const STORM_FOG/);
  assert.match(o, /export const MAX_HULLS/);
});

test('main.js: Harbor storm gated; rain from skySt; lightning only when storming; sky API', () => {
  const m = read('js/main.js');
  assert.match(m, /skyCycle/);
  assert.match(m, /evalSkyNow/);
  assert.match(m, /game\.mode !== 'pvp'/); // PvP Harbor does not drive storm from wave
  assert.match(m, /rain\.uniforms\.uAlpha\.value = skySt\.rainAlpha/);
  assert.match(m, /rain\.mesh\.visible = skySt\.rainAlpha > 0\.02/);
  assert.match(m, /\(game\.storm \|\| 0\) > 0\.4/);
  assert.match(m, /window\.__pfpSky/);
  assert.match(m, /setSkyPhase/);
});

test('sw.js caches skyCycle.js', () => {
  assert.match(read('sw.js'), /skyCycle\.js/);
});

test('sw.js VERSION is pfp-v344+', () => {
  const sw = read('sw.js');
  const m = sw.match(/VERSION = 'pfp-v(\d+)'/);
  assert.ok(m, 'VERSION present');
  assert.ok(+m[1] >= 344, `expected >= 344, got pfp-v${m[1]}`);
});
