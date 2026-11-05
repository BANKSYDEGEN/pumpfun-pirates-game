// [shipshop-fix] BANKSY 9:44 PM "Ship shop doesn't work": Ship Shop prompt + solid footprint at the door (same as Clothes/Pets/Upgrade/Crew)
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/island/plazaTown.js', import.meta.url), 'utf8');
test('Ship Shop is in SHOPS_OUTSIDE with the door-blocked shops', () => {
  assert.match(src, /SHOPS_OUTSIDE = new Set\(\[[^\]]*['"]shop_ships['"]/);
  for (const id of ['shop_clothes', 'shop_pets', 'shop_ships', 'shop_upgrades', 'shop_crew'])
    assert.match(src, new RegExp(`['"]${id}['"]`));
});
test('layout still uses street prompt when promptLz is absent', () => {
  const lay = readFileSync(new URL('../js/dock/layout.js', import.meta.url), 'utf8');
  assert.match(lay, /promptLz != null \? sp\.promptLz : sp\.lz \+ 3\.8/);
});
