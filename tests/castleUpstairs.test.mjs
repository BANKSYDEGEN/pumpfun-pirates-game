// [v267] castle upstairs: rampart landing hw/hl must span the top tread → wall-walk (BANKSY 10:47 AM fall-through)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const src = readFileSync(new URL('../js/island/areas/fort.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
test('sw is at or past pfp-v273', () => { const v = +(sw.match(/const VERSION = 'pfp-v(\d+)'/) || [])[1]; assert.ok(v >= 273, 'sw ' + v); }); // [v273] spyglass climb + war-room
test('fort_rampart_land: spans stair→wall-walk L (hl along x under yaw π/2, not the swapped 1.45 m hole)', () => {
  assert.match(src, /id:\s*'fort_rampart_land'[\s\S]{0,200}hl:\s*4\.0,\s*yaw:\s*Math\.PI\s*\/\s*2/);
  assert.doesNotMatch(src, /fort_rampart_land[\s\S]{0,80}hw:\s*2\.5,\s*hl:\s*NSTAIR\.hw/);
});
test('spy pad + larger interact + tower deck solid', () => {
  assert.match(src, /id:\s*'fort_spy_pad'/);
  assert.match(src, /id:\s*'fort_spyglass'[\s\S]{0,80}r:\s*2\.2/);
  assert.match(src, /fort_tower_[\s\S]{0,60}r:\s*3\.6/);
});
test('rampart stair cheek colliders present with open ends (v273 climb)', () => {
  assert.match(src, /NSTAIR\.z\s*\+\s*s\s*\*\s*\(NSTAIR\.hw\s*\+\s*0\.(?:25|35)\)/);
  assert.match(src, /openBot|leave ~4\.5 m open|leave ~2\.4 m open|yard→stair/);
});
test('war room banding is exterior strips not full-slab ceiling (v273)', () => {
  assert.match(src, /Exterior face strips only|exterior strips only|low ceiling/);
  assert.doesNotMatch(src, /for \(const yy of \[Y \+ 2\.2, Y \+ 5\.0, kt - 0\.4\]\) W\(k, box\(K\.half \* 2/);
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

// BANKSY castle last-step: mound rings are 2D blockers even below the y=42 wall-walk.
test('mound rings leave the fort footprint clear without removing the hillside rings', () => {
  const hill = readFileSync(new URL('../js/island/areas/hillRound.js', import.meta.url), 'utf8');
  const skip = hill.match(/const moundSkip = [^;]+;/)[0];
  const rings = hill.slice(hill.indexOf('export function moundRings'), hill.indexOf('export default')).replace('export function', 'function');
  const { inside, outside, walls } = runInNewContext(`
    const PZ1=-80, PX1=-403, MC=[-408,-44], RBB_ON=true; let MOUND=null;
    ${skip}
    ${rings}
    ({inside:[[-421,-57],[-405,-32.4],[-401,-32.4],[-396.6,-32.4]].map(([x,z])=>moundSkip(x,z)),
      outside:moundSkip(-390,-44),
      walls:moundRings((x,z)=>65-Math.hypot(x+408,z+44)*2)})
  `);
  assert.ok(inside.every(Boolean), 'the castle footprint must not generate mound rings');
  assert.equal(outside, false, 'retain the eastern hillside');
  assert.ok(walls.length > 0, 'do not disable the mound dressing everywhere');
  assert.ok(walls.every(t => !(t.x > -422 && t.x < -394 && t.z > -58 && t.z < -29)), 'no ring segment centers beneath the fort');
});
