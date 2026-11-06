// [cannon-hill] BANKSY "upgrade cannon hill, make the flag real pumpfun pirate flag": GLBs, walkability round the 6 guns + mast, the real flag
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const R = JSON.parse(execFileSync('node', ['--import', './reg.mjs', 'cannon_hill_check.mjs'], { cwd: new URL('../tools/roundabout_blender/node/', import.meta.url), env: { ...process.env, QS: '?coast=1' }, encoding: 'utf8' }).trim().split('\n').pop());
const glbNodes = (f) => { const d = readFileSync(new URL('../assets/island/' + f, import.meta.url)), n = d.readUInt32LE(12); return JSON.parse(d.subarray(20, 20 + n).toString('utf8')); };

test('battery.glb + battery_low.glb parse, load and build the static LOD (solid + glow) and gun models', () => {
  const hi = glbNodes('battery.glb'), lo = glbNodes('battery_low.glb'), names = (j) => j.nodes.map(n => n.name);
  for (const n of ['battery', 'battery_LOD0', 'battery_LOD1', 'gun_carriage', 'gun_barrel']) assert.ok(names(hi).includes(n), n);
  assert.ok(!names(lo).includes('battery_LOD0') && names(lo).includes('battery_LOD1'));
  assert.deepEqual(hi.materials.map(m => m.name).sort(), ['plaza_glow', 'plaza_solid']);
  assert.deepEqual(JSON.parse(hi.nodes.find(n => n.name === 'battery').extras.flag), [160, 42]);
  for (const k of ['high', 'low']) { const K = R[k]; assert.equal(K.ok, true, K.err); assert.ok(K.carriage && K.barrel); assert.ok(K.glowMeshes >= 1); assert.equal(K.levels, k === 'high' ? 2 : 1); }
  assert.ok(R.high.tris[0] < 60000 && R.high.tris[1] < 15000, 'tri budget');
});

test('ramp foot -> ramp -> landing -> deck reaches all 6 gun stations and the mast with 0 collider hits and no snags', () => {
  for (const k of ['gun0', 'gun1', 'gun2', 'gun3', 'gun4', 'gun5', 'mast', 'ramp-3.5', 'ramp-1.75', 'ramp0', 'ramp1.75', 'ramp3.5']) {
    const w = R.walks[k]; assert.ok(w, k); assert.equal(w.nHits, 0, `${k} hits ${JSON.stringify(w.hits)}`); assert.ok(w.maxStep < 0.12, `${k} step ${w.maxStep}`); }
  assert.equal(R.solid.deckY, 21);
  for (const k of ['mast', 'mag', 'gateN', 'gateS']) assert.equal(R.solid[k], true, k + ' collider');
});

test('the real PUMPFUN PIRATES flag is mounted on the Cannon Hill mast, double-faced (unmirrored back) and waves', () => {
  const F = R.flag; assert.equal(F.src, 'assets/skull_transparent.png'); assert.ok(existsSync(new URL('../' + F.src, import.meta.url)));
  assert.equal(F.mounted, true); assert.equal(F.frontSide, 0); assert.equal(F.backSide, 1); assert.equal(F.sameGeo, true);
  assert.ok(F.moved > 0.2, 'cloth animates'); assert.equal(F.plaques, 2); assert.deepEqual(F.clothXZ, [160, 42]); assert.ok(F.clothY > 33);
  assert.equal(F.guns, 6); assert.ok(F.gunMeshes >= 2);
  const src = readFileSync(new URL('../js/island/battery.js', import.meta.url), 'utf8');
  assert.match(src, /tb\.repeat\.x = -1/); assert.match(src, /typeof Image !== 'undefined'/);
});
