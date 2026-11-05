// [dock-skin] BANKSY: picker lists every usable skin from the catalog (incl. prestige new ships), owner gets them all
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { NEW_SHIP_TABLE } from '../js/newShipsTable.js';
const src = readFileSync(new URL('../js/dock/skinPicker.js', import.meta.url), 'utf8');
const cat = readFileSync(new URL('../js/shopCatalog.js', import.meta.url), 'utf8');
const pvp = readFileSync(new URL('../js/pvpSkins.js', import.meta.url), 'utf8');
test('picker is data-driven from SKIN_ITEMS + canUse (cheapest first)', () => {
  assert.match(src, /SKIN_ITEMS/); assert.match(src, /canUse\(s\.id\)/); assert.match(src, /a\.price - b\.price/);
});
test('the five prestige hulls are in the Ship Shop catalog the picker reads', () => {
  assert.match(cat, /NEW_SHIP_TABLE\.map/); // SKIN_ITEMS spreads the table: every id is a catalog skin the picker lists
  assert.equal(NEW_SHIP_TABLE.length, 5);
});
test('owner (BANKSYDEGEN) can use every skin, so the five show in the picker', () => {
  assert.match(pvp, /ownerAllSkins\(\)/); assert.match(pvp, /canUse = \(id\) => ownerAllSkins\(\)/);
  assert.deepEqual(NEW_SHIP_TABLE.map(r => r.id), ['opal', 'leviathan', 'celestial', 'sunking', 'poseidon']);
});
