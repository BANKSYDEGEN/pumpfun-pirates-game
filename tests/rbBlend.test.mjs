// node --test tests/   [rb-blender] the symmetric fountain plaza (BANKSY 1:33 PM) + its Blender stone (assets/island/rb_plaza*.glb)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const run = (qs) => JSON.parse(execFileSync('node', ['--import', './reg.mjs', 'rb_check.mjs'], { cwd: new URL('../tools/roundabout_blender/node/', import.meta.url), env: { ...process.env, QS: qs }, encoding: 'utf8' }).trim().split('\n').pop());
const ON = run('?coast=1&rbglb=0'), OFF = run('?coast=1&rbblend=0');
test('fountain, plaza and bridge head sit on the hill street axis', () => {
  assert.ok(Math.abs(ON.FOUNTAIN.z - ON.axisZ) < 0.01 && Math.abs(ON.hb.az - ON.axisZ) < 0.01);
  const [, , z0, z1] = ON.RB2.plaza; assert.ok(Math.abs((z0 + z1) / 2 - ON.axisZ) < 0.01);
});
test('&rbblend=0 = the v214 layout', () => { assert.equal(OFF.FOUNTAIN.z, -88); assert.deepEqual(OFF.RB2.plaza, [-438, -413, -100, -76]); });
test('the baked Blender layout matches this build (else the kit stone stays)', () => { assert.ok(ON.layoutMatch, 'regenerate: export_layout.mjs + rb_plaza_blender.py'); });
test('wishing anchors json = FOUNTAIN_ANCHORS', () => {
  const j = JSON.parse(readFileSync(new URL('../assets/island/fountain_anchor.json', import.meta.url), 'utf8'));
  for (const k of ['rim', 'coin']) for (const a of ['x', 'y', 'z']) assert.ok(Math.abs(j[k][a] - ON.anchors[k][a]) < 1e-3, k + a);
  assert.equal(j.fountain.z, ON.FOUNTAIN.z);
});
test('walkable exits: no step over 0.35 m, no hill-street building under the plaza', () => {
  for (const [k, w] of Object.entries(ON.walks)) { assert.ok(w.maxStep < 0.35, k + ' ' + w.maxStep); assert.equal(w.hits, 0, k); }
  assert.deepEqual(ON.overlap, []);
});
test('GLB + phone LOD shipped and small', () => {
  const a = statSync(new URL('../assets/island/rb_plaza.glb', import.meta.url)).size, b = statSync(new URL('../assets/island/rb_plaza_low.glb', import.meta.url)).size;
  assert.ok(a < 600e3 && b < 150e3 && b < a, a + ' ' + b);
});
