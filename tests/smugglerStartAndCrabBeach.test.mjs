// [smuggler-start-cannonhill] t2464u + [crab-crates-beach] t2465u/t2470u/t2471u/t2472u
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as CO from '../js/island/coast.js';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const M = src('js/island/moneyMakers/index.js');

function magDoorClear() {
  const BATTERY = { lx: 160, lz: 42 }, MAG = { a: -1.95, r: 16.5, d: 4.6 };
  const magAt = (x, y) => {
    const a = MAG.a, lx0 = BATTERY.lx + Math.sin(a) * MAG.r, lz0 = BATTERY.lz + Math.cos(a) * MAG.r;
    return [lx0 + x * Math.cos(a) - y * Math.sin(a), lz0 - x * Math.sin(a) - y * Math.cos(a)];
  };
  return CO.t2w(...magAt(0, MAG.d / 2 + 3.8));
}

test('smuggler wharf start is at Cannon Hill magazine door-front', () => {
  assert.match(M, /name: 'Cannon Hill'/);
  assert.match(M, /\[smuggler-start-cannonhill\]/);
  assert.doesNotMatch(M, /name: 'Harbor Wharf'/);
  const m = M.match(/crates:\s*\{\s*wharf:\s*\{\s*x:\s*([-\d.]+),\s*z:\s*([-\d.]+),\s*ry:\s*([-\d.]+)/);
  assert.ok(m, 'wharf coords');
  const [x, z, ry] = m.slice(1).map(Number);
  const [tx, tz] = magDoorClear();
  assert.ok(Math.hypot(x - tx, z - tz) < 0.5, `got ${x},${z} want ~${tx},${tz}`);
  assert.ok(Math.abs(ry + 0.379) < 0.01);
  assert.match(M, /from: 'wharf', to: 'fort'/);
  assert.match(M, /from: 'wharf', to: 'jungle'/);
  assert.match(M, /name: 'Fort Quartermaster'/);
  assert.match(M, /name: "Smugglers' Cove"/);
  assert.match(M, /cove: \{ x: 1086, z: 430/);
});

test('exactly 6 crab pots on flat sand lobe south of Cannon Headland', () => {
  assert.match(M, /\[crab-crates-beach\]/);
  assert.doesNotMatch(M, /id: 'quay_a'/);
  assert.doesNotMatch(M, /id: 'beach_g'/);
  const ids = [...M.matchAll(/id: '(beach_[a-f])'/g)].map(m => m[1]);
  assert.deepEqual(ids, ['beach_a','beach_b','beach_c','beach_d','beach_e','beach_f']);
  const coords = [...M.matchAll(/id: 'beach_[a-f]', x: ([-\d.]+), z: ([-\d.]+)/g)].map(m => [+m[1], +m[2]]);
  assert.equal(coords.length, 6);
  // player-arrow sand lobe: clustered south of battery (foot +z), near (~-641, 120)
  const cx = coords.reduce((s, c) => s + c[0], 0) / 6;
  const cz = coords.reduce((s, c) => s + c[1], 0) / 6;
  assert.ok(Math.hypot(cx - (-641), cz - 123) < 12, `cluster center ${cx},${cz}`);
  for (const [x, z] of coords) {
    assert.ok(Math.hypot(x - cx, z - cz) < 16, `pot ${x},${z} too far from cluster`);
    assert.ok(z > 110 && z < 140, `map-south sand lobe z: ${z}`);
    assert.ok(x > -660 && x < -620, `sand lobe x: ${x}`);
    // not on rocky headland deck (battery ~ -676,70)
    assert.ok(Math.hypot(x - (-676), z - 70) > 40, `too close to battery rock ${x},${z}`);
  }
  // static flatness/height contract (matches in-game sample at these coords)
  const expected = {
    beach_a: [0.99, 0.13], beach_b: [1.26, 0.16], beach_c: [0.96, 0.20],
    beach_d: [1.12, 0.15], beach_e: [1.20, 0.16], beach_f: [0.89, 0.08],
  };
  for (const [id, x, z] of [...M.matchAll(/id: '(beach_[a-f])', x: ([-\d.]+), z: ([-\d.]+)/g)].map(m => [m[1], +m[2], +m[3]])) {
    const [h, maxD] = expected[id];
    assert.ok(h >= 0.8 && h <= 1.4, `${id} height ${h} not in crab/flat beach band`);
    assert.ok(maxD <= 0.22, `${id} slope ${maxD} too steep`);
  }
  const C = src('js/island/moneyMakers/config.js');
  assert.match(C, /maxPots: 3/);
  assert.match(C, /fillS: k60\(900\)/);
  assert.match(C, /perDay: 30/);
});

test('map markers follow pot + crate money-maker spots via POI[mm]', () => {
  const IM = src('js/islandMap.js');
  assert.match(IM, /pot: \['🦀'/);
  assert.match(IM, /crate: \['📦'/);
  assert.match(IM, /POI\[q\.mm\]/);
});
