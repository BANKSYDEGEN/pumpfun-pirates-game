// [Emerly musket-holster] BANKSY 11:00 AM: "Make it so when using musket the sword gets holstered"
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { holsterOn, holsterSide, swordHolstered, carryHand, carryShows } from '../js/carryRules.js';
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('holster: musket in hands -> sword sheathed; sword / nothing -> in the hand; &holster=0 kill switch', () => {
  assert.equal(swordHolstered({ armedMusket: true }), true); assert.equal(swordHolstered({ armedMusket: false }), false);
  assert.equal(swordHolstered({ on: false, armedMusket: true }), false);
  assert.equal(holsterOn(''), true); assert.equal(holsterOn('?holster=0'), false); assert.equal(holsterOn('?a=1&holster=0&b=2'), false); assert.equal(holsterOn('?holster=1'), true); assert.equal(holsterOn('?holster=05'), true);
  assert.equal(carryShows({ onFoot: true, state: 'idle', armedMusket: true }).sword, true);   // still drawn, at the hip
});
test('holster: the hip opposite the sword hand (hook rule)', () => {
  assert.equal(holsterSide(carryHand({})), 'L');
  assert.equal(holsterSide(carryHand({ hook: 'hook_iron', hookSide: 'R' })), 'R');   // right hook -> left-hand sword -> right hip
  assert.equal(holsterSide(carryHand({ hook: 'hook_gold', hookSide: 'L' })), 'L');
});
test('holster: wired in carryPost, reparents only on change, crews never carry', () => {
  const w = src('js/carryWeapons.js');
  assert.match(w, /if \(hol !== st\.holstered\) setSwordSpot\(st, hol\)/);
  assert.match(w, /holsterOn\(typeof location/); assert.match(w, /p\.forCrew/);
  assert.match(src('js/onfoot/battle.js'), /carryArmed\(R\.fig, zone === Z_PIT, zone === Z_RANGE\)/);   // you + every remote peer (their zone rides 'ba')
  assert.match(src('js/crewV4.js'), /export const CREW_EXTRA_SLOTS = \[\]/);
});
