import test from 'node:test';
import assert from 'node:assert/strict';
import { swordHand, mirrorX, mirrorTwist, handAxis } from '../js/onfoot/swordHand.js';

test('sword pit hand = the hand without the hook', () => {
  assert.equal(swordHand({ hook: 'hook_iron', hookSide: 'R' }), 'L');
  assert.equal(swordHand({ hook: 'hook_gold', hookSide: 'R' }), 'L');
  assert.equal(swordHand({ hook: 'hook_iron', hookSide: 'L' }), 'R');
  assert.equal(swordHand({ hook: 'none', hookSide: 'R' }), 'R');
  assert.equal(swordHand({ hookSide: 'R' }), 'R');
  assert.equal(swordHand(null), 'R');
  assert.equal(swordHand(undefined), 'R');
});
test('left hand mirrors the swing across x, right is unchanged', () => {
  assert.deepEqual(mirrorX({ x: 0.35, y: -0.4, z: 0.82 }, 'L'), { x: -0.35, y: -0.4, z: 0.82 });
  assert.deepEqual(mirrorX({ x: 0.35, y: -0.4, z: 0.82 }, 'R'), { x: 0.35, y: -0.4, z: 0.82 });
  assert.equal(mirrorTwist(0.45, 'L'), -0.45); assert.equal(mirrorTwist(0.45, 'R'), 0.45);
  assert.equal(handAxis('L'), 1); assert.equal(handAxis('R'), -1);
});
