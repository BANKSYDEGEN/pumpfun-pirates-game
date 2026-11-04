// [Timothy tps] js/onfoot/tpsMath.js: the musket aim maths (phone camera offset, bloom, rays, PC zoom toward the cursor, kill switch, sensitivity)
import test from 'node:test';
import assert from 'node:assert/strict';
import { TPS, tpsOn, zoomWindow, sensLoad, sensSave, spreadTarget, spreadReal, aimDir, rightOf, shoulderCam, yawTo, angleTo, raySphere, rayCyl, spreadPx } from '../js/onfoot/tpsMath.js';

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const mem = () => { const m = new Map(); return { getItem: (k) => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; };

test('camera sits behind, above and to the RIGHT of the head; the swap mirrors it', () => {
  const [x, y, z] = shoulderCam(0, 0, 0, 0, 0, 1, 0), r = rightOf(0);
  near(x, r[0] * TPS.side); near(z, -TPS.dist); near(y, TPS.head + TPS.up);
  assert.equal(r[0], -1, 'yaw 0 looks along +z, so screen right is -x');
  const [x2] = shoulderCam(0, 0, 0, 0, 0, -1, 0); near(x2, -x);
  const [, , za] = shoulderCam(0, 0, 0, 0, 0, 1, 1); near(za, -TPS.distAds);
});
test('bloom: moving opens it, sights close it, standing still costs nothing', () => {
  const still = spreadTarget({ speed: 0 }), run = spreadTarget({ speed: 9.6 }), ads = spreadTarget({ speed: 0, ads: 1 }), air = spreadTarget({ speed: 0, air: true });
  assert.ok(run > still && air > still && ads < still);
  near(spreadReal(still, 0), 0); near(spreadReal(ads, 1), 0); assert.ok(spreadReal(run, 0) > 1);
});
test('aim directions, the fire yaw and the crosshair gap', () => {
  const d = aimDir(Math.PI / 2, 0); near(d[0], 1); near(d[2], 0, 1e-9);
  near(yawTo(0, 0, 0, 10), 0); near(yawTo(0, 0, 10, 0), Math.PI / 2);
  near(angleTo([0, 0, 0], [0, 0, 1], [0, 0, 5]), 0, 1e-4); near(angleTo([0, 0, 0], [0, 0, 1], [5, 0, 0]), 90, 1e-4);
  near(spreadPx(0, 60, 1, 800), 0); assert.ok(spreadPx(2, 60, 1.5, 800) > spreadPx(2, 60, 1, 800), 'zoom widens the gap per degree');
});
test('rays: sphere (target board) + upright cylinder (pirate / cover)', () => {
  near(raySphere([0, 0, 0], [0, 0, 1], [0, 0, 10], 1), 9); assert.equal(raySphere([0, 0, 0], [0, 0, 1], [0, 3, 10], 1), -1);
  near(rayCyl([0, 1, 0], [0, 0, 1], 0, 10, 0.5, 0, 2), 9.5); assert.equal(rayCyl([0, 3, 0], [0, 0, 1], 0, 10, 0.5, 0, 2), -1, 'over the head');
});
test('sensitivity: 100 % default, clamped 20-300 %, saved', () => {
  const s = mem(); near(sensLoad(s), 1); near(sensSave(s, 5), 3); near(sensLoad(s), 3); s.setItem('pfp_aim_sens', 'junk'); near(sensLoad(s), 1); near(sensLoad(null), 1);
});
test('PC zoom toward the cursor keeps the point under it in place', () => {
  const W = 1280, H = 720, [ax, ay] = [900, 250];
  for (const z of [1, 1.25, 1.5]) { const [x, y, w, h] = zoomWindow(ax, ay, W, H, z); near(w, W / z); near(h, H / z); near((ax - x) / w, ax / W); near((ay - y) / h, ay / H); }
  const [x0, y0] = zoomWindow(ax, ay, W, H, 1); near(x0, 0); near(y0, 0);
});
test('kill switch: &tps=0 turns it off, anything else leaves it on', () => {
  assert.equal(tpsOn('?pvp=1&tps=0'), false); assert.equal(tpsOn('?tps=0'), false); assert.equal(tpsOn('?tps=0&x=1'), false);
  assert.equal(tpsOn(''), true); assert.equal(tpsOn('?tps=1'), true); assert.equal(tpsOn('?tps=01'), true);
});
