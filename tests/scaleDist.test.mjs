// [scale-dist] BANKSY t2512u: nearby ships stay at the full room rate; far ships drop to farHz (Realtime 100 msg/s).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PVP_NET, HARBOR_NET } from '../js/config.js';
import { Batcher } from '../js/transport.js';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

function batch(cfg, my = { x: 0, z: 0 }) {
  const b = new Batcher('me00000001', cfg, () => true); b.stop();
  b.lastDyn = my;
  return b;
}
function hear(b, id, x, z) {
  b.heardAt.set(id, performance.now());
  b.full.set(id, { i: id, x, z });
}

test('config: one nearM / farHz pair on the Free-plan arena and harbor (relay unchanged)', () => {
  assert.equal(PVP_NET.supabase.nearM, 160);
  assert.equal(PVP_NET.supabase.farHz, 1);
  assert.equal(HARBOR_NET.nearM, 160);
  assert.equal(HARBOR_NET.farHz, 0.5);
  assert.equal(PVP_NET.relay.nearM, undefined);
  // existing caps stay
  assert.equal(PVP_NET.supabase.hz, 4);
  assert.equal(PVP_NET.supabase.scaleBudget, 76.8);
  assert.equal(HARBOR_NET.hz, 1);
});

test('nearby peers keep the full (budget-scaled) rate; far peers drop to farHz; missing positions stay full', () => {
  const cfg = PVP_NET.supabase;
  const b = batch(cfg);
  // 2 heard + me = 3 ships: scaleBudget stays 4 Hz
  hear(b, 'p00000001', 40, 0);
  hear(b, 'p00000002', 50, 0);
  assert.equal(b.nearestM(), 40);
  assert.equal(b.hz(), 4, 'someone within 160 m: full 4 Hz');

  // everyone far
  b.full.set('p00000001', { i: 'p00000001', x: 400, z: 0 });
  b.full.set('p00000002', { i: 'p00000002', x: 500, z: 0 });
  assert.ok(b.nearestM() > cfg.nearM);
  assert.equal(b.hz(), 1, 'all farther than 160 m: farHz 1');

  // one close, one far: still full (nearby gameplay stays smooth)
  b.full.set('p00000001', { i: 'p00000001', x: 80, z: 0 });
  assert.equal(b.hz(), 4);

  // no positions yet (v339 style): full rate
  const c = new Batcher('me00000001', cfg, () => true); c.stop();
  c.heardAt.set('p00000001', performance.now());
  assert.equal(c.nearestM(), 0);
  assert.equal(c.hz(), 4);

  // solo: unchanged
  const s = new Batcher('me00000001', cfg, () => true); s.stop();
  assert.equal(s.hz(), cfg.soloHz);
});

test('harbor: far sailors drop to farHz 0.5; a fight boost still applies when someone is in range', () => {
  const b = batch(HARBOR_NET);
  hear(b, 'p00000001', 20, 0);
  b.boost = () => 10;
  assert.equal(b.hz(), 10, 'nearby fight keeps the boosted rate');
  b.full.set('p00000001', { i: 'p00000001', x: 400, z: 0 });
  assert.equal(b.hz(), 0.5, 'far from everyone: harbor farHz, even if boost would have fired');
});

test('shots still flush immediately; 4 far arena ships stay under the 100 msg/s cap', () => {
  const sent = [];
  const b = new Batcher('me00000001', PVP_NET.supabase, (m) => { sent.push(m); return true; }); b.stop();
  b.lastDyn = { x: 0, z: 0, v: 0 };
  hear(b, 'a00000001', 400, 0);
  hear(b, 'b00000002', 500, 0);
  hear(b, 'c00000003', 600, 0);
  assert.equal(b.hz(), 1);
  // 4 ships at 1 Hz, all-to-all: 4*1*4 = 16 msgs/s (was 4*4*4 = 64 at full rate)
  const n = 4, msgs = n * b.hz() * n;
  assert.equal(msgs, 16);
  assert.ok(msgs < 100);
  b.send('shot', { o: 'me00000001' }, { now: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].e[0][0], 'shot');
  const tx = src('js/transport.js');
  assert.match(tx, /distanceHz/);
  assert.match(src('sw.js'), /const VERSION = 'pfp-v584'/);
});
