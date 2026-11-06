// [post/cottages] bespoke village at BANKSY's Build Mode location markers
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

// Pull exported geometry literals out of the source
const laneMatch = cot.match(/export const LANE = (\[[\s\S]*?\]);/);
assert.ok(laneMatch, 'LANE export');
const LANE = Function(`return (${laneMatch[1]})`)();
const wellMatch = cot.match(/export const WELL = (\{[^}]+\});/);
assert.ok(wellMatch, 'WELL export');
const WELL = Function(`return (${wellMatch[1]})`)();
const cotMatch = cot.match(/export const COTTAGES = (\[[\s\S]*?\]);/);
assert.ok(cotMatch, 'COTTAGES export');
const COTTAGES = Function(`return (${cotMatch[1]})`)();

// Reconstruct TRAIL_A the same way foot.js does (GATE from TOWN/STREET)
const GATE = [-435, -84];
const TRAIL_A = [GATE, [-428, -100], [-380, -170], [-292, -262], [-170, -330], [-20, -400], [110, -330], [230, -262], [300, -150], [190, -100], [44, -149], [26, -151], [17, -150], [16, -144], [16, -110], [16, -82], [16, -56], [10, -44], [-30, -32], [-120, -40], [-300, -64]];
const TRAIL = catmull(TRAIL_A, true, 3);
const laneSpline = catmull(LANE, false, 3);

describe('cottage neighborhood', () => {
  it('is registered in the area loader', () => {
    assert.match(idx, /import cottages from '\.\/cottages\.js'/);
    assert.match(idx, /cottages,/);
  });

  it('suppresses BANKSY\'s two Build Mode markers when COTTAGES_ON; &cottages=0 restores them', () => {
    assert.match(cot, /\+mw2osffcajh8/);
    assert.match(cot, /\+mw2oslf9ghm9/);
    assert.match(cot, /LOCATION MARKERS|location markers/i);
    assert.match(te, /COTTAGE_MARKERS/);
    assert.match(te, /mw2osffcajh8/);
    assert.match(te, /marker: 1/);
    assert.match(te, /COTTAGES_ON && COTTAGE_MARKERS\.has\(id\)/);
    assert.match(cot, /cottages=0/);
    assert.match(te, /cottages=0/);
  });

  it('builds exactly 4 cohesive cottages (balcony, dormer, gabled, garden)', () => {
    assert.match(cot, /buildBalcony/);
    assert.match(cot, /buildDormer/);
    assert.match(cot, /buildGabled/);
    assert.match(cot, /buildGarden/);
    assert.equal(COTTAGES.length, 4);
    assert.deepEqual(COTTAGES.map(c => c.kind), ['balcony', 'dormer', 'gabled', 'garden']);
    assert.doesNotMatch(cot, /function pathRibbon|pathRibbon\s*\(/); // jagged slab clutter deleted
    assert.doesNotMatch(cot, /SPUR_/);
    assert.doesNotMatch(cot, /flowerBed\(/); // no random yard flower boxes
  });

  it('registers ONE pave:true cottage_lane (foot.js splat + kerbs) joining TRAIL_A at both ends', () => {
    assert.match(cot, /id: 'cottage_lane'/);
    assert.match(cot, /pave: true/);
    assert.equal((cot.match(/\{ id: 'cottage_lane', pts: LANE, pave: true \}/g) || []).length, 1);
    assert.doesNotMatch(cot, /cottage_spur/);
    // both ends snap to live TRAIL_A
    const d0 = minDist(LANE[0], TRAIL);
    const d1 = minDist(LANE[LANE.length - 1], TRAIL);
    assert.ok(d0 < 0.5, `SW join ${d0} too far from TRAIL_A`);
    assert.ok(d1 < 0.5, `NW join ${d1} too far from TRAIL_A`);
    // foot.js consumes pave:true area paths
    assert.match(foot, /AREA_TERRAIN\.paths\.filter\(p => p\.pave\)/);
    assert.match(foot, /buildKerbs/);
  });

  it('puts every cottage front step within 4 m of the lane spline', () => {
    for (const c of COTTAGES) {
      const sx = c.x + Math.sin(c.ry) * c.frontZ;
      const sz = c.z + Math.cos(c.ry) * c.frontZ;
      const d = minDist([sx, sz], laneSpline);
      assert.ok(d <= 4.0, `${c.id} front step dist ${d.toFixed(2)} > 4 m`);
    }
  });

  it('keeps the wishing well completely off every path (≥ 6.5 m)', () => {
    const dl = minDist([WELL.x, WELL.z], laneSpline);
    const da = minDist([WELL.x, WELL.z], TRAIL);
    assert.ok(dl >= 6.5, `WELL→lane ${dl.toFixed(2)} < 6.5`);
    assert.ok(da >= 6.5, `WELL→TRAIL_A ${da.toFixed(2)} < 6.5`);
    assert.match(cot, /WELL = \{ x: -391/);
  });

  it('re-tags cottages via libTex material library; no PointLights; freezes matrices', () => {
    assert.match(lib, /id === 'cottages'/);
    assert.match(lib, /COTTAGE_RULES/);
    assert.match(lib, /stone_ashlar/);
    assert.match(lib, /plaster/);
    assert.match(lib, /roof_tile/);
    assert.match(lib, /planks_weathered/);
    assert.match(lib, /wear:\s*true/);
    assert.doesNotMatch(cot, /new THREE\.PointLight/);
    assert.match(cot, /bucket: 'glow'/);
    assert.match(cot, /matrixAutoUpdate = false/);
    assert.match(cot, /k\.build\(MATS, OUT\)/);
  });

  it('has colonial details: gables, muntins, deep plinth, front apron, trail-matching lanterns', () => {
    assert.match(cot, /function gables/);
    assert.match(cot, /muntin/);
    assert.match(cot, /function plinth/);
    assert.match(cot, /1\.8/); // deep plinth
    assert.match(cot, /frontApron/);
    assert.match(cot, /lanternPost/);
    assert.match(cot, /0xc8552e/);
  });
});
