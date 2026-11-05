// [crew-weapons] BANKSY 4:42 PM Nov 5: "Just make them all have what you have"
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crewWeaponsOf, crewWeapOn } from '../js/carryRules.js';
const v4 = readFileSync(new URL('../js/crewV4.js', import.meta.url), 'utf8');
test('crew mirror the captain sword + musket; hook side -> hand; &crewweap=0 off', () => {
  assert.deepEqual(crewWeaponsOf({ carrySword: 'cutlass', carryMusket: 'none' }, true), { carryCrew: 1, carrySword: 'cutlass', carryMusket: 'none', carryHand: 'R' });
  assert.equal(crewWeaponsOf({ carrySword: 'cutlass', hook: 'hook_iron' }, true).carryHand, 'L');
  assert.equal(crewWeaponsOf({ carrySword: 'cutlass', hook: 'hook_iron', hookSide: 'L' }, true).carryHand, 'R');
  assert.deepEqual(crewWeaponsOf({ carrySword: 'none', carryMusket: 'none' }, true), {});
  assert.deepEqual(crewWeaponsOf({ carrySword: 'cutlass' }, false), {});
  assert.equal(crewWeapOn('?a=1&crewweap=0'), false); assert.equal(crewWeapOn('?a=1'), true);
  assert.match(v4, /if \(gear\.carryCrew === 1\)/); assert.match(v4, /bakeCarry\(p, pose/);   // deck bake carries them
});
