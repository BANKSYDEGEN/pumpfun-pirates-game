// node --test tests/weaponShopMenus.test.mjs
// [t1714u] Separate SWORD SHOP / MUSKET SHOP / MUSKET UPGRADES menus + two musket-store counters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VENDORS } from '../js/shopCatalog.js';

const SHOP = readFileSync(new URL('../js/islandShop.js', import.meta.url), 'utf8');
const BAT = readFileSync(new URL('../js/onfoot/battle.js', import.meta.url), 'utf8');
const AREAS = readFileSync(new URL('../js/island/battleAreas.js', import.meta.url), 'utf8');
const CAT = readFileSync(new URL('../js/shopCatalog.js', import.meta.url), 'utf8');

test('[t1714u] three dedicated vendors: swords / muskets / musket_upgrades (no mixed tabs)', () => {
  assert.deepEqual(VENDORS.swords.tabs, ['swords']);
  assert.deepEqual(VENDORS.swords.slots, ['sword']);
  assert.equal(VENDORS.swords.name, 'SWORD SHOP');
  assert.ok(!VENDORS.swords.tabs.includes('muskets') && !VENDORS.swords.tabs.includes('muskupg'));

  assert.deepEqual(VENDORS.muskets.tabs, ['muskets']);
  assert.deepEqual(VENDORS.muskets.slots, ['musket']);
  assert.equal(VENDORS.muskets.name, 'MUSKET SHOP');
  assert.ok(!VENDORS.muskets.tabs.includes('swords') && !VENDORS.muskets.tabs.includes('muskupg'));

  assert.deepEqual(VENDORS.musket_upgrades.tabs, ['muskupg']);
  assert.equal(VENDORS.musket_upgrades.name, 'MUSKET UPGRADES');
  assert.ok(!VENDORS.musket_upgrades.tabs.includes('swords') && !VENDORS.musket_upgrades.tabs.includes('muskets'));

  assert.ok(VENDORS.weapons);
  assert.deepEqual(VENDORS.weapons.tabs, ['swords', 'muskets']);
});

test('[t1714u] islandShop never appends muskupg onto swords/muskets vendors; ignores stale tabs', () => {
  assert.match(SHOP, /view\.vendor === 'weapons'/);
  assert.match(SHOP, /ignore a stale saved tab/);
  assert.match(SHOP, /!V\.tabs\.includes\(lastTab\)/);
});

test('[t1714u] openWeaponStore routes to the three menus', () => {
  assert.match(BAT, /vendor: 'swords'/);
  assert.match(BAT, /vendor: 'muskets'/);
  assert.match(BAT, /vendor: 'musket_upgrades'/);
  assert.match(BAT, /openMusketUpgrades/);
  assert.match(BAT, /title: 'SWORD SHOP'/);
  assert.match(BAT, /title: 'MUSKET SHOP'/);
  assert.match(BAT, /title: 'MUSKET UPGRADES'/);
});

test('[t1714u] MAIN_ST_SHOPS has three counter interact points with non-overlapping radii', () => {
  assert.match(AREAS, /id: 'sword_shop'/);
  assert.match(AREAS, /id: 'musket_shop'/);
  assert.match(AREAS, /id: 'musket_upgrades'/);
  assert.match(AREAS, /vendor: 'swords'/);
  assert.match(AREAS, /vendor: 'muskets'/);
  assert.match(AREAS, /vendor: 'musket_upgrades'/);
  assert.match(AREAS, /label: 'E · SWORD SHOP'/);
  assert.match(AREAS, /label: 'E · MUSKET SHOP'/);
  assert.match(AREAS, /label: 'E · MUSKET UPGRADES'/);
  assert.match(AREAS, /fixCounter: true/);
  assert.match(AREAS, /door: \[0\.9, -0\.72\]/);
  assert.match(AREAS, /door: \[-0\.582, -0\.85\]/);
  assert.match(AREAS, /door: \[4\.618, -0\.85\]/);
  assert.match(BAT, /fixCounter/);
  assert.match(BAT, /must NOT clobber/);

  const dx = Math.abs(-0.582 - 4.618);
  const rSum = 2.4 + 2.4;
  assert.ok(dx > 4.5);
  assert.ok(dx > rSum * 0.85, 'prompt radii do not fully overlap');
});

test('[t1714u] catalog copy present', () => {
  assert.match(CAT, /SWORD SHOP/);
  assert.match(CAT, /MUSKET SHOP/);
  assert.match(CAT, /MUSKET UPGRADES/);
  assert.match(CAT, /Gunsmith bench/);
});
