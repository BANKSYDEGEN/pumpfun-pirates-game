// [fort-upper] continuous wall-walk + NE spectate + 360° perimeter (BANKSY 5:57 PM)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const src = readFileSync(new URL('../js/island/areas/fort.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
test('sw is at or past pfp-v273', () => { const v = +(sw.match(/const VERSION = 'pfp-v(\d+)'/) || [])[1]; assert.ok(v >= 273, 'sw ' + v); });
test('fort_rampart_land: spans stair→wall-walk L (hl along x under yaw π/2)', () => {
  assert.match(src, /id:\s*'fort_rampart_land'[\s\S]{0,200}hl:\s*4\.0,\s*yaw:\s*Math\.PI\s*\/\s*2/);
});
test('spy pad centred on NE bastion with r>=2.6 + tower decks solid', () => {
  assert.match(src, /id:\s*'fort_spy_pad'/);
  assert.match(src, /id:\s*'fort_spyglass'[\s\S]{0,80}r:\s*2\.6/);
  assert.match(src, /SPY\s*=\s*\{\s*x:\s*X1\s*\+\s*0\.3,\s*z:\s*Z1\s*\+\s*0\.3/);
  assert.match(src, /fort_tower_[\s\S]{0,60}r:\s*3\.6/);
});
test('rampart stair cheek colliders present with open ends', () => {
  assert.match(src, /NSTAIR\.z\s*-\s*\(NSTAIR\.hw\s*\+\s*0\.35\)/);
  assert.match(src, /NSTAIR\.z\s*\+\s*\(NSTAIR\.hw\s*\+\s*0\.35\)/);
  assert.match(src, /openBot|must not enter the wall-walk/);
});
test('war room banding is exterior strips not full-slab ceiling', () => {
  assert.match(src, /Exterior face strips only|exterior strips only|low ceiling/);
  assert.doesNotMatch(src, /for \(const yy of \[Y \+ 2\.2, Y \+ 5\.0, kt - 0\.4\]\) W\(k, box\(K\.half \* 2/);
});
test('keeps moundSkip gate + fort EXIT return', () => {
  const hill = readFileSync(new URL('../js/island/areas/hillRound.js', import.meta.url), 'utf8');
  const dock = readFileSync(new URL('../js/dock/index.js', import.meta.url), 'utf8');
  assert.match(hill, /moundSkip/);
  assert.match(dock, /function fortReturn/);
  assert.match(dock, /specFrom\s*=\s*\{\s*src:\s*'fort'/);
});
test('upper floor is one seamless ExtrudeGeometry stone (no overlapping stoneFloor boxes)', () => {
  assert.match(src, /ShapeGeometry/);
  assert.match(src, /fort_walk_floor/);
  assert.match(src, /ENTIRE upper level = ONE seamless castle STONE|continuous castle STONE|seamless castle STONE/);
  assert.doesNotMatch(src, /const stoneFloor\s*=/);
  assert.doesNotMatch(src, /const ledge = .*C\.WOOD/);
});
test('wall-walk WW=3.1, continuous west deck, gatehouse west of curtain, keep nudged', () => {
  assert.match(src, /RAMP\s*=\s*1\.5/);
  assert.match(src, /id:\s*'fort_wall_w'/);
  assert.match(src, /X0\s*-\s*1\.9/);
  assert.match(src, /keep:\s*\{\s*x:\s*-404\.6/);
  assert.match(src, /paraSpan|TOWER_CLEAR\s*=\s*3\.6/);
});
test('mound rings leave the full fort footprint clear', () => {
  const hill = readFileSync(new URL('../js/island/areas/hillRound.js', import.meta.url), 'utf8');
  const skip = hill.match(/const moundSkip = [^;]+;/)[0];
  const rings = hill.slice(hill.indexOf('export function moundRings'), hill.indexOf('export default')).replace('export function', 'function');
  const { inside, outside, walls } = runInNewContext(`
    const PZ1=-80, PX1=-403, MC=[-408,-44], RBB_ON=true; let MOUND=null;
    ${skip}
    ${rings}
    ({inside:[[-421,-57],[-405,-32.4],[-401,-32.4],[-396.6,-32.4],[-422,-44],[-395,-31],[-421,-57]].map(([x,z])=>moundSkip(x,z)),
      outside:moundSkip(-380,-44),
      walls:moundRings((x,z)=>65-Math.hypot(x+408,z+44)*2)})
  `);
  assert.ok(inside.every(Boolean), 'fort footprint must skip mound rings');
  assert.equal(outside, false);
  assert.ok(walls.length > 0);
  assert.ok(walls.every(t => !(t.x > -426 && t.x < -390 && t.z > -62 && t.z < -26)), 'no ring under fort upper');
});
test('no waist-high kerb across north wall-walk / NSTAIR exit', () => {
  assert.doesNotMatch(src, /kerb\(F\.x,\s*F\.z\s*\+\s*ki,\s*F\.half \* 2/);
  assert.match(src, /NEVER across wall-walk|south edge of landing only/);
});
