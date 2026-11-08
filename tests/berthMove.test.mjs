// [berth-move] + [berth-signs] BANKSY t2329u: one sign per berth (on the baked plaque, OPEN when free) and MOVE SHIP HERE to an open berth.
import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { createDocking } = await import('../js/dock/docking.js');
const PV = await import('../js/island/plazaTown.js');
const { berthSignPost, BERTH_SIGN } = await import('../js/dock/berthSigns.js');
const parts = PV.harborParts((x, z) => [x, z], y => y);
const B = (id) => parts.berths.find(b => b.id === id);
const ship = () => ({ x: 0, z: 0, yaw: 0, speed: 0, alive: true });
const moored = (id, me = 'mmmmmm') => { const d = createDocking({ berths: parts.berths, myId: me }), s = ship(); d.moor(s, B(id)); d.st.spawnAt = 0; return { d, s }; };

test('move to an open berth: re-moors there, old berth free, dk = new berth', () => {
  const { d, s } = moored('B1');
  assert.equal(d.canMoveTo(B('B1')), false, 'not your own berth');
  assert.equal(d.moveTo(s, B('B3')), true);
  assert.equal(d.berth.id, 'B3'); assert.equal(d.mode, 'docked'); assert.equal(d.isFree(B('B1')), true); assert.equal(d.fresh(), true);
  assert.ok(Math.hypot(s.x - B('B3').x, s.z - B('B3').z) < 20, 'ship sits at B3');
});
test('taken berths and non-moored ships cannot move', () => {
  const { d, s } = moored('B1'); d.onPeer('pppppp', 'B2', 0);
  assert.equal(d.canMoveTo(B('B2')), false); assert.equal(d.moveTo(s, B('B2')), false); assert.equal(d.berth.id, 'B1');
  const sea = createDocking({ berths: parts.berths, myId: 'x1x1x1' }); assert.equal(sea.moveTo(ship(), B('B3')), false);
});
test('race: an already-moored pirate reporting the berth wins, our ship goes back', () => {
  const { d, s } = moored('B1'); d.moveTo(s, B('B3'));
  const r = d.onPeer('zzzzzz', 'B3', 0); assert.equal(r.moveLost.id, 'B1'); assert.equal(r.lost.id, 'B3');
});
test('race: two fresh claims, the lower id keeps it', () => {
  const a = moored('B1', 'bbbbbb'); a.d.moveTo(a.s, B('B5'));
  assert.equal(a.d.onPeer('cccccc', 'B5', 1), null, 'higher-id fresh peer loses to us');
  const c = moored('B7', 'cccccc'); c.d.moveTo(c.s, B('B5'));
  assert.equal(c.d.onPeer('bbbbbb', 'B5', 1).moveLost.id, 'B7', 'lower-id fresh peer wins, back to B7');
});
test('after the grace the moved ship is established and keeps its berth', () => {
  const { d, s } = moored('B1'); d.moveTo(s, B('B3')); d.st.spawnAt = performance.now() - 7000;
  assert.equal(d.onPeer('zzzzzz', 'B3', 0), null); assert.equal(d.berth.id, 'B3');
});
test('one sign per berth, on the baked plaque station, covering it', () => {
  for (const b of parts.berths) { const P = berthSignPost(b); assert.ok(P, b.id);
    const [p] = b.signBollards; assert.ok(Math.abs(Math.hypot(P.x - p[0], P.z - p[1]) - 2) < 1e-6, b.id + ' 2 m shoreward of the sign bollard (plaque lz 17)');
    assert.ok(Math.abs(P.y - (b.ashore.y + 1.95)) < 1e-6); }
  assert.ok(BERTH_SIGN.w > 1.85 + 0.1 && BERTH_SIGN.t > 0.18 + 0.1 && BERTH_SIGN.h > 1.14, 'cover is larger than the baked plaque');
  const src = readFileSync(new URL('../js/dock/berthSigns.js', import.meta.url), 'utf8');
  assert.match(src, /'OPEN'/); assert.doesNotMatch(src, /2\.2\) \/ dl/, 'no second board 2.2 m away');
  const idx = readFileSync(new URL('../js/dock/index.js', import.meta.url), 'utf8');
  assert.match(idx, /MOVE SHIP HERE/); assert.match(idx, /moveLost/);
});
