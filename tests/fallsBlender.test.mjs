// node --test tests/   [falls-blender] the fishing bridge + waterfall + high rope bridge in Blender (BANKSY 5:07 PM), visuals only
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const run = (qs) => JSON.parse(execFileSync('node', ['--import', '../../roundabout_blender/node/reg.mjs', 'falls_check.mjs'], { cwd: new URL('../tools/falls_blender/node/', import.meta.url), env: { ...process.env, QS: qs }, encoding: 'utf8' }).trim().split('\n').pop());
const ON = run('?coast=1'), OFF = run('?coast=1&falls=0'), NOHB = run('?coast=1&rbbridge=0');
test('the baked layout matches this build (else the old kit stays)', () => {
  assert.ok(ON.d3 && ON.hb, 'regenerate: tools/falls_blender/node/export_layout.mjs + falls_blender.py + pack');
  for (const k of ['d3', 'hb', 'area']) assert.ok(ON.ground[k][0], k + ' ground ' + ON.ground[k][1]);
});
test('kill switches: &falls=0 = all off, &rbbridge=0 = the high bridge only', () => {
  assert.equal(ON.on, true); assert.equal(ON.hbOn, true); assert.equal(OFF.on, false); assert.equal(OFF.hbOn, false); assert.equal(NOHB.on, true); assert.equal(NOHB.hbOn, false);
});
test('walk unchanged: the fishing bridge deck + the high bridge profile (v220 values)', () => {
  assert.deepEqual({ ...ON.bridge, deckY: +ON.bridge.deckY.toFixed(3), sag: +ON.bridge.sag.toFixed(3) }, { ax: 16, az: -103, bx: 16, bz: -64, L: 39, yaw: 0, deckY: 35.243, sag: 1.95, half: 1.35 });
  assert.equal(ON.hbN, 1);
  const expect = [20.1, 20.341, 20.915, 21.881, 22.387, 22.826, 23.677, 24.462, 24.786, 25.502, 26.552];
  assert.equal(ON.hbProfile.length, expect.length);
  for (let i = 0; i < expect.length; i++) assert.ok(Math.abs(ON.hbProfile[i] - expect[i]) < 0.02, `hb[${i}] ${ON.hbProfile[i]} vs ${expect[i]}`);
});
test('nothing dropped on a trail or the fishing dock; trail lanterns stand past the kerbs', () => {
  assert.deepEqual(ON.clear.trail, []); assert.deepEqual(ON.clear.dock, []); assert.ok(ON.clear.lantern.length >= 6 && ON.clear.lantern.every(d => d >= 3.3), JSON.stringify(ON.clear.lantern));
});
test('GLB + phone LOD shipped, small, with all three sections', () => {
  const a = ON.glb['falls.glb'], b = ON.glb['falls_low.glb'];
  assert.ok(a.bytes < 1.1e6 && b.bytes < 300e3 && b.bytes < a.bytes, a.bytes + ' ' + b.bytes);
  for (const s of ['d3', 'hb', 'area']) { assert.ok(a.nodes.includes(`falls_${s}_LOD0`) && a.nodes.includes(`falls_${s}_LOD1`), s); assert.ok(b.nodes.includes(`falls_${s}_LOD1`) && !b.nodes.includes(`falls_${s}_LOD0`), s + ' low'); }
});
