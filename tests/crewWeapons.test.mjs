// [crew-weapons] BANKSY 4:42 PM Nov 5: "Just make them all have what you have"
// [crew-weapons-swap] t2446u: sword IN HAND + musket on BACK (was hip + back)
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crewWeaponsOf, crewWeapOn } from '../js/carryRules.js';
const v4 = readFileSync(new URL('../js/crewV4.js', import.meta.url), 'utf8');
const cw = readFileSync(new URL('../js/carryWeapons.js', import.meta.url), 'utf8');
const nv = readFileSync(new URL('../js/crewNativeV7.js', import.meta.url), 'utf8');
test('crew mirror the captain sword + musket; hook side -> hand; &crewweap=0 off', () => {
  assert.deepEqual(crewWeaponsOf({ carrySword: 'cutlass', carryMusket: 'none' }, true), { carryCrew: 1, carrySword: 'cutlass', carryMusket: 'none', carryHand: 'R' });
  assert.equal(crewWeaponsOf({ carrySword: 'cutlass', hook: 'hook_iron' }, true).carryHand, 'L');
  assert.equal(crewWeaponsOf({ carrySword: 'cutlass', hook: 'hook_iron', hookSide: 'L' }, true).carryHand, 'R');
  assert.deepEqual(crewWeaponsOf({ carrySword: 'none', carryMusket: 'none' }, true), {});
  assert.deepEqual(crewWeaponsOf({ carrySword: 'cutlass' }, false), {});
  assert.equal(crewWeapOn('?a=1&crewweap=0'), false); assert.equal(crewWeapOn('?a=1'), true);
  assert.match(v4, /if \(gear\.carryCrew === 1\)/); assert.match(v4, /bakeCarry\(p, pose/);   // deck bake carries them
});
test('t2446u: placeCarryNow keeps sword in hand (not hip); musket still placeMusket on back', () => {
  assert.match(cw, /setSwordSpot\(st, false\)/);
  assert.doesNotMatch(cw, /setSwordSpot\(st, true\)/);
  assert.match(cw, /placeMusket\(st\)/);
  // live crew no longer force-holster to hip
  assert.match(cw, /const hol = st\.crew \? false : swordHolstered/);
  assert.doesNotMatch(cw, /const hol = st\.crew \|\| swordHolstered/);
});
test('t2446u: native V7 places carry after applyGear so near crew get the swap', () => {
  assert.match(nv, /placeCarryNow/);
  assert.match(nv, /nativeGear\.carryCrew===1/);
});
