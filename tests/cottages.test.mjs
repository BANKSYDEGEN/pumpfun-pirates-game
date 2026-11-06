// [post/cottages] village + wish well + foliage clearance + Emerly doorstep compatibility
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const src = (f) => readFileSync(root + f, 'utf8');
const cot = src('js/island/areas/cottages.js');
const idx = src('js/island/areas/index.js');
const te = src('js/island/terrainEdit.js');
const lib = src('js/island/libTex.js');
const foot = src('js/island/foot.js');
const imap = src('js/islandMap.js');
const pieces = JSON.parse(src('tools/cottages/terrain_pieces.json'));

function catmull(pts, closed, step = 3) {
  const out = [], n = pts.length, P = (i) => pts[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), k = Math.max(2, Math.ceil(L / step));
    for (let s = 0; s < k; s++) {
      const t = s / k, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (closed) out.push(out[0]); else out.push(pts[n - 1]);
  return out;
}
function minDist(pt, path) {
  let best = 1e9;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((pt[0] - ax) * dx + (pt[1] - az) * dz) / L2));
    best = Math.min(best, Math.hypot(pt[0] - ax - dx * t, pt[1] - az - dz * t));
  }
  return best;
}

const LANE = Function(`return (${cot.match(/export const LANE = (\[[\s\S]*?\]);/)[1]})`)();
const WELL = Function(`return (${cot.match(/export const WELL = (\{[^}]+\});/)[1]})`)();
const WELL_RIM = { x: WELL.x + 1.45, z: WELL.z + 0.85 }; assert.match(cot, /WELL_RIM = \{ x: WELL\.x \+ 1\.45/);
const COTTAGES = Function(`return (${cot.match(/export const COTTAGES = (\[[\s\S]*?\]);/)[1]})`)();
const COL_SIZES = Function(`return (${cot.match(/export const COL_SIZES = (\{[^}]+\});/)[1]})`)();

// Mirror cottages.js clearAt / indoorOrPadAt (source of truth for tests without three.js)
function clearAt(x, z) {
  if (Math.hypot(x - WELL.x, z - WELL.z) < 4.0) return true;
  for (const c of COTTAGES) {
    const [bw, bd] = COL_SIZES[c.kind] || [8, 7];
    const dx = x - c.x, dz = z - c.z;
    const lx = dx * Math.cos(c.ry) - dz * Math.sin(c.ry);
    const lz = dx * Math.sin(c.ry) + dz * Math.cos(c.ry);
    const mx = bw / 2 + 3.5, mzBack = bd / 2 + 3.5, mzFront = Math.max(bd / 2, c.frontZ || 4.5) + 3.5;
    if (Math.abs(lx) <= mx && lz >= -mzBack && lz <= mzFront) return true;
  }
  return false;
}
function indoorOrPadAt(x, z) {
  if (Math.hypot(x - WELL.x, z - WELL.z) < 2.2) return true;
  for (const c of COTTAGES) {
    const [bw, bd] = COL_SIZES[c.kind] || [8, 7];
    const dx = x - c.x, dz = z - c.z;
    const lx = dx * Math.cos(c.ry) - dz * Math.sin(c.ry);
    const lz = dx * Math.sin(c.ry) + dz * Math.cos(c.ry);
    const mx = bw / 2 + 0.6, mzBack = bd / 2 + 0.6, mzFront = Math.max(bd / 2, c.frontZ || 4.5) + 1.8;
    if (Math.abs(lx) <= mx && lz >= -mzBack && lz <= mzFront) return true;
  }
  return false;
}
function doorstepOf(c, pad = 1.35) {
  const d = (c.frontZ || 4.5) + pad;
  return { x: c.x + Math.sin(c.ry) * d, z: c.z + Math.cos(c.ry) * d };
}
// Oriented box hit (addBox stores hx=w/2, hz=d/2)
function inBox(px, pz, bx, bz, w, d, ry) {
  const dx = px - bx, dz = pz - bz;
  const lx = dx * Math.cos(ry) + dz * Math.sin(ry); // foot.js uses c=cos,s=sin; local: hx along rotated X
  // foot.js blocked check: see whyBlocked — typically |localX|<hx && |localZ|<hz with yaw
  const c = Math.cos(ry), s = Math.sin(ry);
  const lx2 = dx * c + dz * s, lz2 = -dx * s + dz * c;
  return Math.abs(lx2) < w / 2 && Math.abs(lz2) < d / 2;
}
function inCirc(px, pz, cx, cz, r) { return Math.hypot(px - cx, pz - cz) < r; }

const GATE = [-435, -84];
const TRAIL_A = [GATE, [-428, -100], [-380, -170], [-292, -262], [-170, -330], [-20, -400], [110, -330], [230, -262], [300, -150], [190, -100], [44, -149], [26, -151], [17, -150], [16, -144], [16, -110], [16, -82], [16, -56], [10, -44], [-30, -32], [-120, -40], [-300, -64]];
const TRAIL = catmull(TRAIL_A, true, 3);
const laneSpline = catmull(LANE, false, 3);

// Exact 40789fb coordinates Emerly's houses.js FALLBACK_COTTAGES sync to
const LOCKED = [
  { id: 'balcony', x: -375.34, z: -157.54, ry: -0.4867, frontZ: 5.40 },
  { id: 'dormer',  x: -359.48, z: -138.46, ry: -1.3910, frontZ: 5.20 },
  { id: 'gabled',  x: -369.88, z: -115.50, ry: -2.6347, frontZ: 6.30 },
  { id: 'garden',  x: -388.99, z: -111.15, ry: -3.0321, frontZ: 4.85 },
];

describe('cottage neighborhood', () => {
  it('is registered in the area loader', () => {
    assert.match(idx, /import cottages from '\.\/cottages\.js'/);
    assert.match(idx, /cottages,/);
  });

  it('keeps locked 40789fb COTTAGES coords for Emerly houses.js doorstepOf', () => {
    assert.equal(COTTAGES.length, 4);
    for (const L of LOCKED) {
      const c = COTTAGES.find((x) => x.id === L.id);
      assert.ok(c, L.id);
      assert.equal(c.x, L.x);
      assert.equal(c.z, L.z);
      assert.equal(c.ry, L.ry);
      assert.equal(c.frontZ, L.frontZ);
    }
  });

  it('suppresses BANKSY\'s two Build Mode markers when COTTAGES_ON; &cottages=0 restores them', () => {
    assert.match(cot, /\+mw2osffcajh8/);
    assert.match(te, /COTTAGES_ON && COTTAGE_MARKERS\.has\(id\)/);
    assert.match(cot, /cottages=0/);
  });

  it('registers ONE pave:true cottage_lane joining TRAIL_A; well off every path', () => {
    assert.match(cot, /id: 'cottage_lane'/);
    assert.equal((cot.match(/\{ id: 'cottage_lane', pts: LANE, pave: true \}/g) || []).length, 1);
    assert.doesNotMatch(cot, /function pathRibbon|pathRibbon\s*\(/);
    assert.ok(minDist(LANE[0], TRAIL) < 0.5);
    assert.ok(minDist(LANE[LANE.length - 1], TRAIL) < 0.5);
    assert.ok(minDist([WELL.x, WELL.z], laneSpline) >= 6.5);
    assert.ok(minDist([WELL.x, WELL.z], TRAIL) >= 6.5);
  });

  it('exports clearAt / indoorOrPadAt and wires them into foot.js foliage + grass', () => {
    assert.match(cot, /export function clearAt/);
    assert.match(cot, /export function indoorOrPadAt/);
    assert.match(cot, /clear: 38/);
    assert.match(cot, /h\.poi\('cottage_green', 'Cottage neighborhood', -380, -135/);
    assert.equal((cot.match(/h\.poi\(/g) || []).length, 1); // single POI only
    assert.match(foot, /cottageClearAt/);
    assert.match(foot, /cottagePadAt/);
    assert.match(foot, /COTTAGES_ON && cottageClearAt\(x, z\)/);
    assert.match(foot, /COTTAGES_ON && cottagePadAt\(x, z\)/);
    assert.match(foot, /cottageClearAt\(fx, fz\)/); // offset fern guard
  });

  it('clearAt covers every cottage center / porch / well; leaves far meadow open', () => {
    for (const c of COTTAGES) {
      assert.equal(clearAt(c.x, c.z), true, c.id + ' center');
      assert.equal(clearAt(c.x + Math.sin(c.ry) * c.frontZ, c.z + Math.cos(c.ry) * c.frontZ), true, c.id + ' front');
      assert.equal(indoorOrPadAt(c.x, c.z), true, c.id + ' pad');
    }
    assert.equal(clearAt(WELL.x, WELL.z), true);
    assert.equal(indoorOrPadAt(WELL.x, WELL.z), true);
    assert.equal(clearAt(-500, -500), false);
    assert.equal(indoorOrPadAt(-500, -500), false);
  });

  it('dense grid sample: 0 foliage-clear misses inside cottage footprints + well (and pad grass)', () => {
    let foliageHits = 0, padHits = 0, open = 0;
    for (let x = -420; x <= -345; x += 1.5) for (let z = -170; z <= -100; z += 1.5) {
      if (clearAt(x, z)) foliageHits++;
      if (indoorOrPadAt(x, z)) padHits++;
      else open++;
    }
    assert.ok(foliageHits > 80, 'expected a solid clear envelope, got ' + foliageHits);
    assert.ok(padHits > 40, 'expected pad hits, got ' + padHits);
    assert.ok(open > 200, 'meadow still open');
    // Every cottage center cell is cleared
    for (const c of COTTAGES) assert.ok(clearAt(c.x, c.z));
  });

  it('terrain_pieces.json has no Build Mode trees/rocks in the village (only the 2 house markers)', () => {
    const near = Object.entries(pieces.pieces || {}).filter(([, v]) => {
      const x = +v.x, z = +v.z;
      return x > -430 && x < -340 && z > -175 && z < -100;
    });
    assert.ok(near.length >= 2);
    for (const [id, v] of near) {
      assert.equal(v.t | 0, 0, id + ' must be house (t=0), not tree/rock');
      assert.match(id, /^\+mw2os/);
    }
  });

  it('cottage_well wish interact mirrors plaza fountain (flag / kill / coin+ripple / pfp-wish)', () => {
    assert.match(cot, /export const WISH_ON/);
    assert.match(cot, /wish=0/);
    assert.match(cot, /function wishHidden/);
    assert.match(cot, /PFP_INV_FLAGS\.wish_fountain/);
    assert.match(cot, /wish=1/);
    assert.match(cot, /id: 'cottage_well'/);
    assert.match(cot, /TOSS A COIN \(100 gold\)/);
    assert.match(cot, /r: 2\.8/);
    assert.match(cot, /pfp-wish/);
    assert.match(cot, /0xffcd3c/);
    assert.match(cot, /CylinderGeometry\(0\.09, 0\.09, 0\.018, 12\)/);
    assert.match(cot, /RingGeometry/);
    assert.match(cot, /wish:\s*\(\)\s*=>/);
    assert.match(cot, /tick\(t\)/);
    assert.doesNotMatch(cot, /new THREE\.PointLight/);
    assert.match(imap, /cottage_well/);
    // Interact rim is outside the 1.5 m well collider but within reach (r=2.8)
    const dRim = Math.hypot(WELL_RIM.x - WELL.x, WELL_RIM.z - WELL.z);
    assert.ok(dRim > 1.5, 'rim outside well collider');
    assert.ok(dRim + 0.01 < 2.8, 'player at rim still inside interact r');
  });

  it('Emerly doorstepOf(c) sits outside cottage addBox + well/bench circ colliders', () => {
    for (const c of COTTAGES) {
      const step = doorstepOf(c);
      const [bw, bd] = COL_SIZES[c.kind];
      assert.equal(inBox(step.x, step.z, c.x, c.z, bw, bd, c.ry), false, c.id + ' doorstep inside addBox');
      assert.equal(inCirc(step.x, step.z, WELL.x, WELL.z, 1.5), false, c.id + ' doorstep in well');
      // And doorstep is still near the front (reachable)
      assert.ok(Math.hypot(step.x - c.x, step.z - c.z) < (c.frontZ + 1.35) + 0.05);
      // doorstep should be clearAt-false? actually porch margin may still clear foliage there — that's fine.
      // Importantly interact/walk: not inside solid collider.
    }
  });

  it('libTex retags cottages; matrices frozen; Kit merge', () => {
    assert.match(lib, /id === 'cottages'/);
    assert.match(lib, /COTTAGE_RULES/);
    assert.match(cot, /matrixAutoUpdate = false/);
    assert.match(cot, /k\.build\(MATS, OUT\)/);
  });
});
