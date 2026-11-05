// [hide-shoes] BANKSY 10:03 PM: boots hidden from the Clothing Store listing only (catalog / owned / equipped untouched)
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const cat = readFileSync(new URL('../js/shopCatalog.js', import.meta.url), 'utf8');
const shop = readFileSync(new URL('../js/islandShop.js', import.meta.url), 'utf8');
const crew = readFileSync(new URL('../js/crewV4.js', import.meta.url), 'utf8');
test('boots stay in the catalog', () => {
  for (const id of ['boots_buckle', 'boots_cavalier', 'boots_gold']) assert.match(cat, new RegExp(`id: '${id}'`));
});
test('Clothes Store drops the boots slot + STORE_HIDDEN lists the three boots', () => {
  assert.match(cat, /STORE_HIDDEN = new Set\(\['boots:boots_buckle', 'boots:boots_cavalier', 'boots:boots_gold'\]\)/);
  const clothes = cat.match(/clothes:\s*\{[^}]+\}/); assert.ok(clothes); assert.doesNotMatch(clothes[0], /'boots'/);
});
test('islandShop filters clothes boots and still sorts cheapest first', () => {
  assert.match(shop, /STORE_HIDDEN/); assert.match(shop, /view\.vendor === 'clothes'/); assert.match(shop, /sortByPrice/);
});
test('CREW_EXTRA_SLOTS stays empty', () => { assert.match(crew, /export const CREW_EXTRA_SLOTS = \[\]/); });
