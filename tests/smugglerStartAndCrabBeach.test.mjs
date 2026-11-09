// [smuggler-start-cannonhill] t2464u + [crab-crates-beach] t2465u
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
  // destinations / routes untouched
  assert.match(M, /from: 'wharf', to: 'fort'/);
  assert.match(M, /from: 'wharf', to: 'jungle'/);
  assert.match(M, /name: 'Fort Quartermaster'/);
  assert.match(M, /name: "Smugglers' Cove"/);
  assert.match(M, /cove: \{ x: 1086, z: 430/);
});

test('crab pots moved to Cannon Headland south beach with extras', () => {
  assert.match(M, /\[crab-crates-beach\]/);
  assert.doesNotMatch(M, /id: 'quay_a'/);
  const ids = [...M.matchAll(/id: '(beach_[a-g])'/g)].map(m => m[1]);
  assert.deepEqual(ids, ['beach_a','beach_b','beach_c','beach_d','beach_e','beach_f','beach_g']);
  const coords = [...M.matchAll(/id: 'beach_[a-g]', x: ([-\d.]+), z: ([-\d.]+)/g)].map(m => [+m[1], +m[2]]);
  assert.equal(coords.length, 7);
  const HEADLAND = CO.HEADLAND;
  for (const [x, z] of coords) {
    const [lx, lz] = CO.w2t(x, z);
    const hd = Math.hypot(lx - HEADLAND.lx, lz - HEADLAND.lz);
    assert.ok(hd > 30 && hd < 80, `pot ${x},${z} hd=${hd}`);
    assert.ok(z > 70, `map-south of headland battery (world z): ${z}`); // battery harbor z≈70
  }
  // rewards / caps unchanged
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
