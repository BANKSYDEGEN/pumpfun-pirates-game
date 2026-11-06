// [v351] Brass Scope ADS zoom: shared helper (PC / phone / controller), active-weapon gating, look sensitivity scaling
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TPS, adsZoom, adsZoomAt, adsLookScale, hasScope, approach } from '../js/onfoot/tpsMath.js';
import { applyGunAcc, GUN_ACC } from '../js/musketUpgrades.js';

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

test('v351: base ADS zoom is 1.5x; Brass Scope is 3x', () => {
  assert.equal(TPS.zoom, 1.5);
  assert.equal(TPS.scopeZoom, 3);
  assert.equal(adsZoom(null), 1.5);
  assert.equal(adsZoom({}), 1.5);
  assert.equal(adsZoom({ bayonet: 'val:acc_bayonet' }), 1.5, 'bayonet alone is not a scope');
  assert.equal(adsZoom({ scope: 'val:acc_scope' }), 3);
  assert.equal(adsZoom({ scope: 'val:acc_scope', stock: 'x' }), 3);
  assert.ok(hasScope({ scope: 'val:acc_scope' }));
  assert.ok(!hasScope({}));
  assert.ok(!hasScope(null));
});

test('v351: adsZoomAt eases with st.ads (no snap)', () => {
  near(adsZoomAt(0, null), 1);
  near(adsZoomAt(1, null), 1.5);
  near(adsZoomAt(0.5, null), 1.25);
  near(adsZoomAt(0, { scope: 'x' }), 1);
  near(adsZoomAt(1, { scope: 'x' }), 3);
  near(adsZoomAt(0.5, { scope: 'x' }), 2);
  // approach helper used by tps.tick for the blend
  near(approach(0, 1, 12, 1 / 12), 1);
  assert.ok(approach(0, 1, 12, 0.02) > 0 && approach(0, 1, 12, 0.02) < 0.3, 'eases in');
});

test('v351: active-weapon gating — no scope fitted = no extra zoom (pistol / bare musket)', () => {
  // PFP_GUN_ACC only carries fitted musket accessories; empty / missing scope = base zoom
  assert.equal(adsZoom(undefined), TPS.zoom);
  assert.equal(adsZoom({ horn: 'val:acc_horn' }), TPS.zoom);
  const bare = applyGunAcc({ reload: 1.25, wide: 0.55, dmg: 19 }, {});
  assert.equal(bare.zoom, 1);
  const scoped = applyGunAcc({ reload: 1.25, wide: 0.55, dmg: 19 }, { scope: 'val:acc_scope' });
  assert.equal(scoped.zoom, 3);
  // spread still -5% with scope (balance untouched beyond the zoom number)
  assert.ok(scoped.wide < 0.55 && scoped.wide > 0.5, 'scope still trims spread ~5%');
});

test('v351: look sensitivity scales down while scoped (not twitchy at 3x)', () => {
  // hip: full sens
  near(adsLookScale(0, null), 1);
  near(adsLookScale(0, { scope: 'x' }), 1);
  // unscoped full ADS: adsSens only (same as before)
  near(adsLookScale(1, null), TPS.adsSens);
  // scoped full ADS: adsSens * (1.5 / 3) = half of unscoped ADS
  near(adsLookScale(1, { scope: 'x' }), TPS.adsSens * (TPS.zoom / TPS.scopeZoom));
  assert.ok(adsLookScale(1, { scope: 'x' }) < adsLookScale(1, null), 'scoped slower than unscoped ADS');
  // mid ADS with scope is between hip and full scoped
  const mid = adsLookScale(0.5, { scope: 'x' });
  assert.ok(mid > adsLookScale(1, { scope: 'x' }) && mid <= 1);
});

test('v351: GUN_ACC fx label + tps.js wires the shared helper on all three paths', () => {
  const scope = GUN_ACC.find((a) => a.slot === 'scope');
  assert.ok(scope);
  assert.match(scope.fx, /scope zoom 3x/i);
  assert.match(scope.fx, /spread -5%/);
  const tps = readFileSync(new URL('../js/onfoot/tps.js', import.meta.url), 'utf8');
  assert.match(tps, /adsZoomAt\(st\.ads,\s*gunAccLive\(\)\)/);
  assert.match(tps, /adsLookScale/);
  assert.match(tps, /#tps-scope/);
  // all three zoom call sites use the helper (PC zoomView, phone camHook, tick zoom)
  assert.ok((tps.match(/adsZoomAt\(/g) || []).length >= 3);
  const math = readFileSync(new URL('../js/onfoot/tpsMath.js', import.meta.url), 'utf8');
  assert.match(math, /scopeZoom:\s*3/);
  const walk = readFileSync(new URL('../js/onfoot/walker.js', import.meta.url), 'utf8');
  assert.match(walk, /lookK/);
});
