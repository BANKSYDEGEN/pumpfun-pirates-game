// node --test tests/canoeAndAiSpawns.test.mjs   [v314] BANKSY t1672u-t1675u: canoe owns its input + rides the swell, GO TO ISLAND / BOARD SHIP,
// no DROP ANCHOR popup (on-screen ⚓ only, never at the main dock), every harbor AI spawns + patrols round the island away from the dock.
// The probe (tools/sail/canoe_check.mjs) runs the real js/dock/canoe.js + js/pvp.js + foot heightmap in node and prints one JSON line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const ROOT = new URL('../', import.meta.url);
const R = JSON.parse(execFileSync(process.execPath, ['--import', './tools/roundabout_blender/node/reg.mjs', 'tools/sail/canoe_check.mjs'], { cwd: ROOT, env: { ...process.env, QS: '?coast=1' }, encoding: 'utf8', timeout: 180000 }).trim().split('\n').pop());
const src = (p) => readFileSync(new URL(p, ROOT), 'utf8');

test('AI island spawns: far from the harbor dock (160,0) and (0,0), deep water, all round the island', () => {
  assert.ok(R.spawns.n >= 20, `${R.spawns.n} spawns`);
  assert.ok(R.spawns.minDock > 540, `closest spawn ${R.spawns.minDock.toFixed(0)} m from the dock`);
  assert.ok(R.spawns.min0 > 480, `closest spawn ${R.spawns.min0.toFixed(0)} m from (0,0)`);
  assert.ok(R.spawns.deepN >= 12 && R.spawns.maxHdeep < -9, `deep spawns ${R.spawns.deepN}, shallowest ${R.spawns.maxHdeep}`);
  assert.deepEqual(R.spawns.sectors, [0, 1, 2, 3]);
});
test('the Commodore spawns at random spots all round the island (40 picks)', () => {
  assert.equal(R.boss.n, 40);
  assert.ok(R.boss.minDock > 540, `closest ${R.boss.minDock.toFixed(0)} m from the dock`);
  assert.ok(R.boss.maxH < -9, `shallowest ${R.boss.maxH}`);
  assert.deepEqual(R.boss.quads, [0, 1, 2, 3], 'all 4 quadrants round (SAIL.cx, SAIL.cz)');
  assert.ok(R.boss.distinct >= 8, `${R.boss.distinct} distinct spots`);
  assert.ok(R.boss.minJump > 400, 'consecutive spawns jump to another side');
  assert.ok(R.boss.minShip > 160, 'clear of ships');
  assert.match(src('js/pvp.js'), /pickBossSpawn\(H, allShips\(\), boss\.last\)/);
});
test('AI patrol (no target) orbits the island, stays out of the dock keep-out and off the shallows', () => {
  assert.ok(R.patrol.minDock > 450, `patrol came ${R.patrol.minDock.toFixed(0)} m from the dock`);
  assert.equal(R.patrol.shallowHits, 0);
  const s = src('js/pvp.js');
  assert.match(s, /const preferIsland = SAIL_ALL && where === 'harbor';/, 'every harbor AI prefers the island ring');
  assert.match(s, /pickSpawn\(null, isle\)/, 'the Commodore spawns round the island too');
  assert.match(src('js/main.js'), /e\.islandPatrol && e\.patrolC/, 'no-target waypoints follow the island ring, not (0,0)');
});
test('canoe onKey captures W/A/S/D and paddles while the anchored ship stays locked', () => {
  assert.equal(R.launch, true); assert.equal(R.mode1, 'canoe');
  assert.equal(R.keyW, true); assert.equal(R.keyM, false);
  assert.ok(R.paddle.moved > 15, `moved ${R.paddle.moved}`);
  assert.equal(R.paddle.shipLocked, true, 'ship x/z/yaw/sail/anchor locked');
  assert.ok(R.turnD < -0.5, 'D turns right (yaw decreases like the ship helm)');
  assert.equal(R.lockedBeached, true, 'still locked while beached');
});
test('canoe rides on top of the waves; hullCap() returns a valid water cap', () => {
  assert.equal(R.paddle.wavePass, true); assert.ok(R.paddle.minGap > 0.15, `min gap ${R.paddle.minGap}`);
  assert.equal(R.paddle.capOk, true);
  assert.ok(R.highWave.y > R.highWave.wave, `y ${R.highWave.y} over a ${R.highWave.wave} m crest`);
  const c = R.highWave.cap; assert.ok(c.capY - 0.3 > R.highWave.wave && c.halfBeam > 0.5 && c.len > 5);
  assert.match(src('js/main.js'), /waveHeight, \/\* \[v314\]/, 'createDock gets waveHeight');
  assert.match(src('js/main.js'), /uHullY\.value\[k\]\.set\(ch\.capY, ch\.slopeZ, ch\.slopeX, ch\.halfBeam\)/);
});
test('GO TO ISLAND + BOARD SHIP prompts appear and run', () => {
  assert.equal(R.shorePrompt.a.label, 'GO TO ISLAND'); assert.equal(R.landOk, true); assert.equal(R.mode2, 'beached');
  assert.ok(R.landed.H > 0.65, 'landed on dry sand'); assert.ok(R.beach.H > -0.6 && R.beach.H < 0.3, 'canoe at the waterline'); assert.ok(R.beach.dWalk < 7.5);
  assert.equal(R.boardCanoePrompt, 'BOARD CANOE'); assert.equal(R.relaunch, true); assert.equal(R.mode3, 'canoe'); assert.ok(R.relaunchH < -0.3);
  assert.equal(R.bothPrompt.a.label, 'GO TO ISLAND'); assert.equal(R.bothPrompt.b.label, 'BOARD SHIP'); assert.equal(R.bothPrompt.b.key, 'Q');
  assert.equal(R.shipPrompt.a.label, 'BOARD SHIP'); assert.equal(R.boardShip, true); assert.equal(R.aboard, true); assert.equal(R.mode4, 'sea');
  assert.equal(R.afterBoard.anchor, true, 'still anchored after BOARD SHIP'); assert.equal(R.canoeCls, false);
});
test('no DROP ANCHOR popup: canoe prompt only when anchored with the on-screen ⚓, never at the main dock', () => {
  assert.equal(R.prompts.unanchored, null); assert.equal(R.prompts.unanchoredFast, null); assert.equal(R.prompts.anchoredFast, null);
  assert.equal(R.prompts.anchored, 'GO TO ISLAND · CANOE');
  assert.equal(R.prompts.mainDockAnchored, null, 'anchored at (185,0): no canoe prompt');
  assert.equal(R.dock.canoeAtBerth, null, 'anchored next to berth B1: no canoe prompt');
  assert.ok(R.dock.query?.berth, 'docking.query offers ⚓ DOCK at the berth');
  assert.equal(R.afterAnchorUp, null, 'anchor raised: prompt gone');
  assert.doesNotMatch(src('js/dock/canoe.js'), /label: 'DROP ANCHOR'/); assert.doesNotMatch(src('js/dock/canoe.js'), /tag: 'drop'/);
  const ix = src('js/dock/index.js'), q = ix.indexOf("const q = now - leftAt > 5 ? docking.query(s) : null;"), c = ix.indexOf('const cp = q ? null : canoe?.prompts(');
  assert.ok(q > 0 && c > q, 'index.js: the dock approach is checked before the canoe prompt');
});
