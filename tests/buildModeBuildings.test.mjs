// [build-mode-buildings] t2456u: admin Build Mode tools to adjust Blender GLB buildings
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILDING_UNIT, cleanBuildOv, followBuildingColliders, snapVal, copyTransform, xformXZ, obstaclesInBox } from '../js/island/buildBuildings.js';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('BUILDING_UNIT matches Blender GLBs and rejects merged street / chunks', () => {
  for (const n of ['plaza_shop_clothes', 'hill_L3', 'casino_hall', 'village_art', 'd2_blender', 'rb_plaza_glb', 'area_cottages', 'battery_blender', 'rb_fountain_scale'])
    assert.ok(BUILDING_UNIT.test(n), n);
  for (const n of ['hill_street', 'hill_signs_merged', 'hill_lod_L3', 'chunk_3_4', 'placed', 'd2_blender_far', 'area_cottages_far'])
    assert.ok(!BUILDING_UNIT.test(n), n);
});

test('cleanBuildOv keeps move / turn / scale / hide and drops noise', () => {
  assert.deepEqual(cleanBuildOv({ h: 1, dx: 9 }), { h: 1 });
  assert.equal(cleanBuildOv({ dx: 0, dy: 0, ry: 0, sx: 1 }), null);
  const o = cleanBuildOv({ dx: 12.345, dy: -1, dz: 4, ry: 1.5708, rx: 0.1, rz: -0.2, sx: 1.5, sy: 1.25, sz: 1.5 });
  assert.equal(o.dx, 12.35); assert.equal(o.sy, 1.25); assert.ok(o.rx && o.rz);
  assert.equal(cleanBuildOv({ sx: 9 }).sx, 4); // clamp
});

test('snap / copy / rotate helpers', () => {
  assert.equal(snapVal(1.4, 0.5), 1.5);
  assert.equal(snapVal(22, 15), 15);
  const c = copyTransform({ dx: 2, ry: 1 });
  assert.equal(c.dx, 2); assert.equal(c.ry, 1);
  const p = xformXZ(10, 0, 0, 0, 0, 0, Math.PI / 2);
  assert.ok(Math.abs(p.x) < 1e-9); assert.ok(Math.abs(p.z + 10) < 1e-9);
});

test('followBuildingColliders moves and restores obstacles in the footprint', () => {
  const box = { min: { x: -5, z: -5 }, max: { x: 5, z: 5 } };
  const a = { x: 1, z: 2 }, b = { x: 100, z: 0 }; // b outside
  const it = { box };
  assert.equal(obstaclesInBox([a, b], box).length, 1);
  followBuildingColliders(it, { dx: 3, dz: -1, ry: 0 }, [a, b]);
  assert.equal(a.x, 4); assert.equal(a.z, 1); assert.equal(b.x, 100);
  followBuildingColliders(it, null, [a, b]);
  assert.equal(a.x, 1); assert.equal(a.z, 2);
  followBuildingColliders(it, { h: 1 }, [a, b]);
  assert.equal(a.off, true);
});

test('terrainEdit wires BUILDINGS panel, collider follow, expanded UNIT', () => {
  const TE = src('js/island/terrainEdit.js');
  assert.match(TE, /casino_hall\$\|village_art\$\|d2_blender\$\|rb_plaza_glb\$\|area_cottages\$/);
  assert.match(TE, /#te-bxf/);
  assert.match(TE, /🏛 BUILDINGS/);
  assert.match(TE, /followBuildingColliders/);
  assert.match(TE, /pfp_build_col_follow/);
  assert.match(TE, /data-ba="follow"/);
  assert.match(TE, /data-ba="copy"/);
  assert.match(TE, /data-ba="reset"/);
  assert.match(TE, /ov\?\.sy/);
  assert.match(TE, /ov\?\.rx/);
  // owner-only: panel lives after the owner gate
  assert.ok(TE.indexOf('if (!owner) return { owner: false }') < TE.indexOf("bxf.id = 'te-bxf'"));
});

test('edge sanitizer (branch) keeps rx/rz/sy — needs deploy OK', () => {
  const I = src('supabase/functions/pvp/index.ts');
  assert.match(I, /\[build-mode-buildings\]/);
  assert.match(I, /\["rx", "rz"\]/);
  assert.match(I, /\["sx", "sy", "sz"\]/);
  assert.match(I, /f\(v\.dx, 200\)/);
});
