// [map-streets] BANKSY t1717u — named districts + streets + locatePoint
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ISLAND_DISTRICTS, ISLAND_STREETS, GEO_LABELS, GEO_PROBES, STREET_SIGN_SPOTS, ISLAND_BOUNDS,
  locatePoint, nearestStreet, streetAt, districtAt, polyDist,
} from '../js/islandGeography.js';

const root = new URL('..', import.meta.url).pathname;
const src = (f) => readFileSync(root + f, 'utf8');
const finite = (n) => Number.isFinite(n);

describe('islandGeography districts', () => {
  it('every district has a finite center inside island bounds and a positive radius', () => {
    assert.ok(ISLAND_DISTRICTS.length >= 12);
    for (const d of ISLAND_DISTRICTS) {
      assert.ok(d.id && d.name, d.id);
      assert.ok(finite(d.x) && finite(d.z) && finite(d.r) && d.r > 0, d.id);
      assert.ok(d.x >= ISLAND_BOUNDS.x0 - 50 && d.x <= ISLAND_BOUNDS.x1 + 50, d.id + ' x');
      assert.ok(d.z >= ISLAND_BOUNDS.z0 - 50 && d.z <= ISLAND_BOUNDS.z1 + 50, d.id + ' z');
      assert.ok(!Number.isNaN(d.x + d.z + d.r), d.id);
    }
  });
  it('district names are unique', () => {
    const names = ISLAND_DISTRICTS.map((d) => d.name);
    assert.equal(new Set(names).size, names.length);
  });
});

describe('islandGeography streets', () => {
  it('every street has a valid polyline of finite points', () => {
    assert.ok(ISLAND_STREETS.length >= 10);
    for (const s of ISLAND_STREETS) {
      assert.ok(s.id && s.name && Array.isArray(s.pts) && s.pts.length >= 2, s.id);
      for (const [x, z] of s.pts) {
        assert.ok(finite(x) && finite(z), s.id);
        assert.ok(x >= ISLAND_BOUNDS.x0 - 20 && x <= ISLAND_BOUNDS.x1 + 20, `${s.id} x ${x}`);
        assert.ok(z >= ISLAND_BOUNDS.z0 - 20 && z <= ISLAND_BOUNDS.z1 + 20, `${s.id} z ${z}`);
      }
    }
  });
  it('named trails / rows exist', () => {
    for (const id of ['crimson_trail', 'doubloon_trail', 'market_row', 'gunpowder_row', 'lantern_lane', 'boardwalk', 'highgate_road', 'gladiator_way', 'hangmans_bridge', 'pier_1']) {
      assert.ok(streetAt(id), id);
    }
  });
  it('no duplicate street ids', () => {
    const ids = ISLAND_STREETS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('locatePoint key spots', () => {
  for (const [key, p] of Object.entries(GEO_PROBES)) {
    it(`${key} → ${p.district}${p.street ? ' · ' + p.street : ''}`, () => {
      const r = locatePoint(p.x, p.z, { onFoot: true });
      assert.equal(r.district, p.district, `${key} district got ${r.district}`);
      if (p.street) assert.equal(r.street, p.street, `${key} street got ${r.street}`);
      assert.ok(r.callout.includes(p.district));
      assert.ok(!r.callout.includes('NaN'));
    });
  }
  it('cottage green is COTTAGE VILLAGE', () => {
    const r = locatePoint(-392, -136, { onFoot: true });
    assert.equal(r.district, 'COTTAGE VILLAGE');
  });
});

describe('GEO_LABELS + signs', () => {
  it('labels are finite and unique ids', () => {
    const ids = GEO_LABELS.map((g) => g.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const g of GEO_LABELS) {
      assert.ok(finite(g.x) && finite(g.z) && g.name, g.id);
      assert.ok(!/ROPE BRIDGE|RED TRAIL|YELLOW TRAIL|HILLTOP FORT|CLIFF BATTERY/.test(g.name), g.name);
    }
  });
  it('[v335] 3D street signs removed: STREET_SIGN_SPOTS is empty, 2D streets + districts intact', () => {
    assert.ok(Array.isArray(STREET_SIGN_SPOTS));
    assert.equal(STREET_SIGN_SPOTS.length, 0);
    assert.ok(ISLAND_STREETS.length >= 7 && ISLAND_DISTRICTS.length >= 5);
  });
});

describe('source wiring', () => {
  it('islandMap uses bare parchment + Crimson/Doubloon + no RED/YELLOW TRAIL', () => {
    const imap = src('js/islandMap.js');
    assert.match(imap, /paperSheet\(true\)/);
    assert.match(imap, /islandGeography/);
    assert.match(imap, /CRIMSON TRAIL|crimson_trail/);
    assert.doesNotMatch(imap, /RED TRAIL|YELLOW TRAIL/);
    assert.match(imap, /YOUR LOCATION/);
  });
  it('mapLandmarks renamed fort/battery/pier', () => {
    const m = src('js/mapLandmarks.js');
    assert.match(m, /CROWN CITADEL/);
    assert.match(m, /CANNON HEADLAND/);
    assert.match(m, /PIER /);
    assert.doesNotMatch(m, /HILLTOP FORT|CLIFF BATTERY/);
  });
  it('treasureMap imports geography and uses new bridge name', () => {
    const t = src('js/dock/treasureMap.js');
    assert.match(t, /islandGeography/);
    assert.match(t, /HANGMAN'S BRIDGE/);
    assert.doesNotMatch(t, /Rope Bridge/);
  });
  it('dock HUD location stays wired, 3D street signs removed (v335)', () => {
    const d = src('js/dock/index.js');
    assert.doesNotMatch(d, /createStreetSigns|streetSigns\.js/);
    assert.match(d, /map-loc-hud/);
    assert.match(d, /locatePoint/);
    const ss = src('js/dock/streetSigns.js');
    assert.doesNotMatch(ss, /STREET_SIGN_SPOTS|THREE|Mesh/);
    assert.match(ss, /export function createStreetSigns\(\) \{ return \{ root: null, clear\(\) \{\}, tick\(\) \{\} \}; \}/);
    assert.match(src('css/style.css'), /#map-loc-hud/);
    assert.match(src('index.html'), /map-loc-hud/);
  });
  it('PUMPFUN PIRATES stays one word in geography comments', () => {
    assert.match(src('js/islandGeography.js'), /PUMPFUN PIRATES/);
    assert.doesNotMatch(src('js/islandGeography.js'), /PUMP FUN PIRATES|PumpFun Pirates/);
  });
});
