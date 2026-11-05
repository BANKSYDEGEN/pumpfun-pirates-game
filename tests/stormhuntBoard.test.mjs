// node --test tests/stormhuntBoard.test.mjs — engine colliders + read-only screen binding.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const root = new URL('..', import.meta.url);
const run = qs => JSON.parse(execFileSync(process.execPath, ['--import', './reg.mjs', 'board_check.mjs'], {
  cwd: new URL('tools/roundabout_blender/node/', root), env: { ...process.env, QS: qs }, encoding: 'utf8'
}).trim().split('\n').pop());
const on = run('?coast=1');
test('both relocated boards are reachable with the real player radius; backing stays solid', () => {
  for (const b of on) {
    assert.equal(b.pathHits, 0, b.id + ' approach blocked');
    assert.equal(b.promptHit, false, b.id + ' prompt blocked');
    assert.equal(b.backingSolid, true, b.id + ' backing no longer solid');
    assert.ok(Math.abs(Math.hypot(b.approach.lx - b.anchor.lx, b.approach.lz - b.anchor.lz) - 2.6) < .001);
    assert.equal(b.prompt.kind, b.id);
  }
});
test('side-wall board backing clears shop footprint + plinth instead of intersecting it', () => {
  // #4 east edge -3.7, #5 west edge 14.7, including the solid 0.3 m plinth allowance.
  assert.ok(on[0].anchor.lx - .3 > -3.7);
  assert.ok(on[1].anchor.lx + .3 < 14.7);
});
test('coliseum=0 keeps the original quay board anchors and forward walk-up', () => {
  const off = run('?coast=1&coliseum=0');
  for (const [i, lx] of [-10, 22].entries()) {
    assert.equal(off[i].anchor.lx, lx); assert.equal(off[i].anchor.lz, -12);
    assert.equal(off[i].anchor.yaw, 0); assert.equal(off[i].approach.lz, -9.4);
  }
});
test('frame, live screen and collision use shared yaw (no stale hard-coded transform)', () => {
  const foot = readFileSync(new URL('js/island/foot.js', root), 'utf8');
  const plaza = readFileSync(new URL('js/dock/plaza.js', root), 'utf8');
  const coli = readFileSync(new URL('js/island/coliseum.js', root), 'utf8');
  assert.match(foot, /at\(P\[id\]\.lx, P\[id\]\.lz, P\[id\]\.yaw/);
  assert.match(foot, /addBox\(x, z, PLAZA_BOARD\.w \+ 1, 0\.6, CO\.t2wYaw\(P\[id\]\.yaw\)\)/);
  assert.match(plaza, /yaw = CO\.t2wYaw\(q\.yaw\)/);
  assert.match(coli, /BOARD_POIS = CO\.PLAZA_POIS\.filter/);
  assert.doesNotMatch(plaza, /q\.lz === -36/);
});
test('Storm Hunt screen and full panel retain the read-only all-time leaderboard path', () => {
  const plaza = readFileSync(new URL('js/dock/plaza.js', root), 'utf8');
  assert.match(plaza, /leaderboard\.getTop\(n, 'all'\)/);
  assert.match(plaza, /rowsFor\(b\.id, 10\)/);
  assert.match(plaza, /rowsFor\(id, 50\)/);
  assert.doesNotMatch(plaza, /leaderboard\.submit|method:\s*['"](?:POST|DELETE|PATCH)/);
});
