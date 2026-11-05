// [Emerly pitsword] BANKSY 12:05 PM: rare / inventory sword must show in the Sword Pit
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pitSwordOn, pitWeaponId } from '../js/carryRules.js';
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const SW = ['rusty', 'cutlass', 'rapier', 'bone', 'sabre_gilded', 'blade_gold'];
test('pitsword: kill switch &pitsword=0', () => {
  assert.equal(pitSwordOn(''), true); assert.equal(pitSwordOn('?pitsword=0'), false);
  assert.equal(pitSwordOn('?a=1&pitsword=0&b=2'), false); assert.equal(pitSwordOn('?pitsword=1'), true);
  assert.equal(pitSwordOn('?pitsword=05'), true);
});
test('pitsword: carry wins over store; off = store only; unknown = default', () => {
  assert.equal(pitWeaponId(SW, 'rusty', 'bone', 'rusty', true), 'bone');
  assert.equal(pitWeaponId(SW, 'rusty', 'blade_gold', 'cutlass', true), 'blade_gold');
  assert.equal(pitWeaponId(SW, 'rusty', 'bone', 'cutlass', false), 'cutlass'); // kill switch
  assert.equal(pitWeaponId(SW, 'rusty', null, 'rapier', true), 'rapier');
  assert.equal(pitWeaponId(SW, 'rusty', 'none', 'rapier', true), 'rapier');
  assert.equal(pitWeaponId(SW, 'rusty', 'nope', null, true), 'rusty');
});
test('pitsword: battle reads carriedWeapons + pfp-gear-local; sw v275+', () => {
  const b = src('js/onfoot/battle.js');
  assert.match(b, /carriedWeapons\(\)/); assert.match(b, /pitWeaponId\(SWORD_IDS/);
  assert.match(b, /pfp-gear-local/); assert.match(b, /PIT_SWORD_ON/); assert.match(b, /pitsword=0/);
  const v = +(src('sw.js').match(/const VERSION = 'pfp-v(\d+)'/) || [])[1];
  assert.ok(v >= 275, 'sw at or past v275: ' + v);
});
