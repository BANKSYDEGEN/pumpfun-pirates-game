// [Raul carry] BANKSY 12:02 PM: the sword in the no-hook hand, the musket on the back (on foot), no clipping with jackets / capes
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carryHand, carryPick, carryDigits, carryFromDigits, carryShows } from '../js/carryRules.js';
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const ids = (name) => JSON.parse(src('js/onfoot/swords.js').match(new RegExp(`export const ${name} = (\\[[^\\]]*\\])`))[1].replace(/'/g, '"'));
const SW = ids('SWORD_IDS'), MU = ids('MUSKET_IDS');
test('carry: the sword goes in the hand without the hook (no hook = right)', () => {
  assert.equal(carryHand({}), 'R'); assert.equal(carryHand({ hook: 'none' }), 'R');
  assert.equal(carryHand({ hook: 'hook_iron', hookSide: 'R' }), 'L'); assert.equal(carryHand({ hook: 'hook_gold' }), 'L'); assert.equal(carryHand({ hook: 'hook_iron', hookSide: 'L' }), 'R');
});
test('carry: ids validated, the free rusty default is not carried from the profile', () => {
  assert.equal(carryPick('cutlass', SW), 'cutlass'); assert.equal(carryPick('nope', SW), 'none'); assert.equal(carryPick(7, SW), 'none');
  assert.equal(carryPick('rusty', SW, 'rusty'), 'none'); assert.equal(carryPick('rusty', SW, 'rusty', true), 'rusty'); assert.equal(carryPick('rusty', MU), 'rusty');
});
test('carry: wire digits round trip every sword x musket, unknown digits = none', () => {
  for (const s of ['none', ...SW]) for (const m of ['none', ...MU]) { const [a, b] = carryDigits({ carrySword: s, carryMusket: m }, SW, MU); assert.deepEqual(carryFromDigits(a, b, SW, MU), { carrySword: s, carryMusket: m }); assert.ok(a < 36 && b < 36); }
  assert.deepEqual(carryFromDigits(30, 31, SW, MU), { carrySword: 'none', carryMusket: 'none' });
});
test('carry: on foot only, sword away while swimming, the arena copy hides the carried one', () => {
  assert.deepEqual(carryShows({ onFoot: false }), { sword: false, musket: false });
  assert.deepEqual(carryShows({ onFoot: true, state: 'idle' }), { sword: true, musket: true });
  assert.deepEqual(carryShows({ onFoot: true, state: 'swim' }), { sword: false, musket: true });
  assert.deepEqual(carryShows({ onFoot: true, state: 'run', armedSword: true }), { sword: false, musket: true });
  assert.deepEqual(carryShows({ onFoot: true, state: null, armedMusket: true }), { sword: true, musket: false });
});
test('carry: wired into gear + wire + battle, crews never carry, phones light', () => {
  const g = src('js/pirateGear.js'), w = src('js/carryWeapons.js'), b = src('js/onfoot/battle.js'), c = src('js/crewV4.js');
  assert.match(g, /const WIRE_LEN = WIRE_SLOTS\.length \+ 6 \+ 7 \+ 2( \+ 1)*;/); assert.match(g, /\.\.\.carryDigits\(g, SWORD_IDS, MUSKET_IDS\)(, GEAR_RENDERS\.pants\.indexOf\(g\.pants\) \+ 1)?(, g\.capeColor \| 0)?\]/); assert.match(g, /carryFromDigits\(d\(c\), d\(c \+ 1\), SWORD_IDS, MUSKET_IDS\)/);
  assert.match(g, /export function setCarriedWeapons\(\{ sword = null, musket = null \} = \{\}, src = 'inventory'\)/); assert.match(g, /syncCarry\(p, gear, body\)/);
  assert.match(g, /setCarriedWeapons\(\{ sword: gear\.sword, musket: gear\.musket \}, 'profile'\)/);
  assert.match(w, /if \(!p\?\.v5 \|\| p\.forCrew/); assert.match(w, /if \(!low\) \{ const o = new THREE\.Mesh\(geo, M\.s\)/); assert.match(w, /m\.castShadow = !low/);
  assert.match(w, /onFoot: this\.footSpeed !== undefined/);   // ships never set footSpeed: ship perf unchanged
  assert.match(w, /isSkinnedMesh && !\/\^pet\/\.test\(o\.name\)/);   // the musket's lift is measured over every worn mesh (coats, capes)
  assert.match(b, /carryArmed\(R\.fig, zone === Z_PIT, zone === Z_RANGE\)/);
  assert.match(c, /export const CREW_EXTRA_SLOTS = \[\]/); assert.doesNotMatch(c, /carry/);
  { const v = +(src('sw.js').match(/const VERSION = 'pfp-v(\d+)'/) || [])[1]; assert.ok(v >= 202, 'sw at or past v202 (carried weapons): ' + v); }
});
