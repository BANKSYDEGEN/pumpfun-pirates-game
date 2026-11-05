// [hide-shoes] BANKSY 10:03 PM: boots hidden from the Clothing Store listing only (catalog / owned / equipped untouched)
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const cat = readFileSync(new URL('../js/shopCatalog.js', import.meta.url), 'utf8');
const shop = readFileSync(new URL('../js/islandShop.js', import.meta.url), 'utf8');
const crew = readFileSync(new URL('../js/crewV4.js', import.meta.url), 'utf8');
test('boots stay in the catalog', () => {
  for (const id of ['boots_buckle', 'boots_cavalier', 'boots_gold']) assert.match(cat, new RegExp(`id: '${id}'`));
});
test('Clothes Store: every shoe is listed again ([v6-store-clothes] BANKSY 1:36 PM "Add shoes and pants back to store")', async () => {
  assert.match(cat, /STORE_HIDDEN = new Set\(\)/);
  const clothes = cat.match(/clothes:\s*\{[^}]+\}/); assert.ok(clothes); assert.match(clothes[0], /'boots', 'pants'/);
  const { GEAR_ITEMS, STORE_HIDDEN } = await import('../js/shopCatalog.js');
  const listed = GEAR_ITEMS.filter((it) => it.slot === 'boots' && !STORE_HIDDEN.has(`boots:${it.id}`)).map((it) => it.id);
  assert.deepEqual(listed.sort(), ['boots_buckle', 'boots_cavalier', 'boots_classic', 'boots_gold', 'boots_sea', 'none', 'sandals', 'shoes_buckle']);
});
test('islandShop filters clothes boots and still sorts cheapest first', () => {
  assert.match(shop, /STORE_HIDDEN/); assert.match(shop, /view\.vendor === 'clothes'/); assert.match(shop, /sortByPrice/);
});
test('CREW_EXTRA_SLOTS stays empty', () => { assert.match(crew, /export const CREW_EXTRA_SLOTS = \[\]/); });
