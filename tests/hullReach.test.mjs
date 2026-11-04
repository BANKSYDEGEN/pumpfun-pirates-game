import test from 'node:test';
import assert from 'node:assert/strict';
import { hullDist, touchesGold } from '../js/hullReach.js';
const ship = (len, beam, yaw = 0) => ({ x: 100, z: -50, yaw, mesh: { userData: { len: len + 2, hitLen: len, beam } } });
test('small sloop keeps the old 10 m centre reach', () => {
  const s = ship(17, 5.4); assert.ok(touchesGold(s, 100 + 9.5, -50)); assert.ok(!touchesGold(s, 100 + 10.5, -50));
});
test("man-o'-war collects gold touching its bow and stern, both headings", () => {
  for (const yaw of [0, Math.PI / 2, 2.2]) { const s = ship(24.5, 9.4, yaw), f = 12.25 + 2.5;
    assert.ok(touchesGold(s, 100 + Math.sin(yaw) * f, -50 + Math.cos(yaw) * f), 'bow ' + yaw);
    assert.ok(touchesGold(s, 100 - Math.sin(yaw) * f, -50 - Math.cos(yaw) * f), 'stern ' + yaw);
    assert.ok(!touchesGold(s, 100 + Math.sin(yaw) * 16, -50 + Math.cos(yaw) * 16), 'past the bow ' + yaw); }
});
test('hullDist is 0 inside the hull and the box gap outside', () => {
  const s = ship(20, 6); assert.equal(hullDist(s, 100, -50 + 9), 0); assert.ok(Math.abs(hullDist(s, 100 + 5, -50) - 2) < 1e-9);
});
test('host slack widens reach for lag', () => { const s = ship(24.5, 9.4); assert.ok(touchesGold(s, 100, -50 + 30, 18)); assert.ok(!touchesGold(s, 100, -50 + 40, 18)); });
