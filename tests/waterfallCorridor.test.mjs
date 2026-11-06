// [waterfall-aaa] BANKSY [t387u]/[t388u]: graded rope-bridge→fishing path, AAA waterfall corridor, Waterfall Hill → ziplines
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const R = JSON.parse(execFileSync('node', ['--import', './reg.mjs', 'waterfall_corridor_check.mjs'], {
  cwd: new URL('../tools/roundabout_blender/node/', import.meta.url),
  env: { ...process.env, QS: '?coast=1' },
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
}).trim().split('\n').pop());

test('LAKE + Grandpa Gill dock anchors stay put for Emerly fishing safe-zone', () => {
  assert.equal(R.anchorsOk, true);
  assert.deepEqual(R.lake, { x: -205, z: -130, r: 58, y: 20 });
  assert.equal(R.dock.x, -205);
  assert.equal(R.dock.z0, -63);
  assert.equal(R.gill.x, -199.5);
  assert.equal(R.grotto.y, 21);
});

test('walk: High Rope Bridge east landing → fishing dock is graded, cleared, no stuck steps', () => {
  const w = R.walkFish;
  assert.ok(w.n > 20, 'samples');
  assert.equal(w.uncleared, 0, 'corridorClearAt covers the whole fish_approach');
  assert.equal(w.stuck, 0, `stuck steps ${w.stuck}`);
  assert.ok(w.maxStep < 0.55, `maxStep ${w.maxStep}`);
  assert.equal(w.nHits, 0);
  // ends at the dock shore
  assert.ok(Math.abs(w.last[0] + 205) < 1.5 && Math.abs(w.last[1] + 63) < 1.5, JSON.stringify(w.last));
});

test('walk: fishing lagoon → Waterfall Hill trail → summit zipline terrace', () => {
  const w = R.walkHill;
  assert.ok(w.n > 40);
  assert.equal(w.uncleared, 0);
  assert.equal(w.stuck, 0, `stuck ${w.stuck}`);
  assert.ok(w.maxStep < 1.2, `maxStep ${w.maxStep} (stepped trail)`);
  assert.ok(w.last[2] > 70, `summit height ${w.last[2]}`);
});

test('walk: stepping stones ENTRY → grotto chest ledge stays dry at y≈21', () => {
  const w = R.walkGrotto;
  assert.ok(w.n > 10);
  assert.ok(R.grottoY.ground >= 20.5 && R.grottoY.ground <= 22.5, JSON.stringify(R.grottoY));
});

test('ziplines castle↔waterfall and waterfall↔skull build with safe cable clearance', () => {
  const { skull, castle } = R.zipline;
  assert.ok(skull.minClr >= 2.8, `skull clr ${skull.minClr}`);
  assert.ok(castle.minClr >= 3.0, `castle clr ${castle.minClr}`);
  assert.ok(Math.hypot(skull.A[0] + 188, skull.A[1] + 247) < 8 || Math.hypot(skull.A[0] + 188, skull.A[1] + 232) < 25, JSON.stringify(skull.A));
  assert.ok(Math.hypot(castle.B[0] + 188, castle.B[1] + 232) < 25, JSON.stringify(castle.B));
  assert.ok(skull.L > 40 && castle.L > 40);
});

test('falls.glb + falls_low.glb + &falls=0 kill switch', () => {
  assert.equal(R.layout, true);
  assert.ok(R.glb['falls.glb'] && R.glb['falls.glb'].bytes > 100000);
  assert.ok(R.glb['falls_low.glb'] && R.glb['falls_low.glb'].bytes > 50000);
  assert.ok(R.glb['falls.glb'].bytes < 2_500_000, 'desktop size');
  assert.ok(R.glb['falls_low.glb'].bytes < 800_000, 'phone size');
  const nodes = R.glb['falls.glb'].nodes.join(' ');
  assert.match(nodes, /falls_area_LOD0/);
  assert.match(nodes, /falls_d3_LOD0/);
  assert.match(nodes, /falls_hb_LOD0/);
  assert.equal(R.killSwitch.src, true);
  // tri budgets from pack report if present
  const src = readFileSync(new URL('../js/island/fallsBlender.js', import.meta.url), 'utf8');
  assert.match(src, /falls=0/);
  assert.match(src, /rbbridge=0/);
  // Emerly-safe: no safe-zone / pvp files in this change set (static check of our modules)
  for (const f of ['js/dock/safe.js', 'js/onfoot/battle.js', 'js/pvp.js', 'js/dock/index.js', 'js/dock/houses.js', 'js/main.js']) {
    // file may exist on main; we just assert our waterfall modules don't import them
    const corridor = readFileSync(new URL('../js/island/areas/waterfallCorridor.js', import.meta.url), 'utf8');
    assert.doesNotMatch(corridor, /safe\.js|battle\.js|pvp\.js/);
  }
});

test('sw.js is >= pfp-v323 and precaches falls assets', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  // [v324+] VERSION bumps continue; falls assets must stay in SHELL forever after v323
  assert.match(sw, /const VERSION = 'pfp-v(?:32[3-9]|[4-9]\d+)'/);
  assert.match(sw, /fallsBlender\.js/);
  assert.match(sw, /waterfallCorridor\.js/);
  assert.match(sw, /falls\.glb/);
  assert.match(sw, /falls_low\.glb/);
  assert.match(sw, /falls_layout\.json/);
});
