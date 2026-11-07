import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { createDocking, DOCK } = await import('../js/dock/docking.js');
const PV = await import('../js/island/plazaTown.js');
const CO = await import('../js/island/coast.js');
import { boardReach } from '../js/hullReach.js';
const parts = PV.harborParts((x,z) => [x,z], y => y);
const ship = () => ({ x: 0, z: 0, yaw: 0, speed: 2, alive: true });
test('double approach range, nearest lane only, and speed / occupancy gates', () => {
  assert.equal(DOCK.range, 60);
  const b = parts.berths[0], d = createDocking({ berths: parts.berths, myId: 'me' });
  const s = { ...ship(), x: b.x, z: b.z + 59 };
  assert.equal(d.query(s).berth, b);
  s.z = b.z + 61; assert.equal(d.query(s), null);
  s.z = b.z + 50; s.speed = 7; assert.equal(d.query(s).reason, 'fast');
  s.speed = 2; d.onPeer('peer', b.id); assert.equal(d.query(s).reason, 'taken');
  d.dropPeer('peer'); assert.equal(d.query(s).berth, b);
});
test('all ten new berths glide in, stay fixed, and unmoor to open water', () => {
  for (const b of parts.berths) {
    const d = createDocking({ berths: parts.berths, myId: 'me' });
    const s = { ...ship(), x: b.x, z: b.z + 55 };
    d.begin(s, b); for (let n=0; n<50; n++) d.tick(s, .1);
    assert.equal(d.mode, 'docked'); assert.equal(s.x, b.x); assert.equal(s.z, b.z);
    d.tick(s, .1); assert.equal(s.speed, 0);
    assert.equal(d.setSail(s), true); for (let n=0; n<40; n++) d.tick(s, .1);
    assert.equal(d.mode, 'sea'); assert.ok(s.z > b.z + 34);
    d.moor(s,b); assert.equal(s.x,b.x); assert.equal(s.z,b.z);
  }
});
test('largest supported hull clears jetty / boardwalk and neighbouring yards', () => {
  assert.ok(PV.JETTY.shipOff - PV.JETTY.w/2 - PV.SHIP.beam/2 > 3);
  assert.ok(PV.JETTY.shipLz - PV.SHIP.aft - PV.BOARDWALK.lz1 > 12);
  assert.ok(52 - 2*PV.JETTY.shipOff > PV.SHIP.yardW);
  assert.ok(PV.APPROACH.lz0 > PV.JETTY.shipLz + PV.SHIP.fwd);
  for (const b of parts.berths) {
    const deck = parts.decks.find(q => q.id === 'jetty_' + PV.BERTHS.find(q => q.id === b.id).jetty);
    assert.ok(Math.abs(b.ashore.x-deck.x) < deck.hw);
    assert.ok(Math.abs(b.ashore.z-deck.z) < deck.hl);
    // GO ASHORE uses this unchanged deck landing, not the widened water gap;
    // BOARD SHIP still reaches from it even on the smallest hull.
    assert.ok(boardReach(b.ashore, b, { ...ship(), x:b.x,z:b.z,mesh:{userData:{beam:5.4,hitLen:17}} }));
  }
  const ix = readFileSync(new URL('../js/dock/index.js', import.meta.url), 'utf8');
  assert.match(ix, /walker.enter\(b.ashore.x, b.ashore.z/);
});
test('legacy pier / quay parks move 4 m seawards without moving deck landings', () => {
  assert.equal(CO.PIER_BERTH_LZ,53.8); assert.equal(CO.QUAY_BERTH_LZ,14.5);
});

const THREE = await import('three');
const { hullHalfBeam, parkedPose, PARK_GAP } = await import('../js/dock/parkPose.js');
test('measured lower hull, not nominal beam, controls moor / glide / ship swaps / departure', () => {
  const b = parts.berths[0];
  const m = new THREE.Group(), body = new THREE.Group(); m.add(body);
  body.add(new THREE.Mesh(new THREE.BoxGeometry(22, 4, 44)));
  m.userData = { body, beam: 10.4, depth: 4.7, deckY: 1.65 };
  const s = { ...ship(), mesh: m };
  assert.equal(hullHalfBeam(s), 11);
  const p = parkedPose(s, b);
  assert.ok(Math.abs((p.x-b.edge.x)*b.away.x + (p.z-b.edge.z)*b.away.z - 11 - PARK_GAP) < 1e-6);
  const d = createDocking({ berths:parts.berths, myId:'me' });
  d.moor(s,b); assert.equal(s.x,p.x);
  d.setSail(s); d.tick(s,0); assert.equal(s.x,p.x);
  d.release(); s.x=b.x; s.z=b.z+50; d.begin(s,b);
  for(let i=0;i<50;i++) d.tick(s,.1);
  assert.equal(s.x,p.x); assert.equal(s.z,p.z);
});
