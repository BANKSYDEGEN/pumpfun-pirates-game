// [rare-equip] BANKSY 7:05 PM "Make sure they can select their rare muskets and swords they find to use as primary"
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const ui = readFileSync(new URL('../js/inventory/ui.js', import.meta.url), 'utf8'), inv = readFileSync(new URL('../supabase/functions/pvp/inventory.ts', import.meta.url), 'utf8');
const pg = readFileSync(new URL('../js/pirateGear.js', import.meta.url), 'utf8');
test('USE AS PRIMARY / USE STORE + the equipped badge', () => { assert.match(ui, /USE AS PRIMARY/); assert.match(ui, /data-a="unequip"/); assert.match(ui, /class="iv-eq"/); });
test('the found weapon comes back in hand after a reload', () => { assert.match(ui, /if \(!restored && r\.ok\)/); });
test('server: unequip is an action, equipped only counts what you still hold', () => {
  assert.match(inv, /"inv_unequip"/); assert.match(inv, /who\.owner \|\| stack\.has\(e\.item\)/); assert.match(inv, /not yours/); });
test('the store pick is remembered for switching back', () => { assert.match(pg, /export const storeWeapons/); assert.match(pg, /if \(src === 'profile'\) _carry\.prof/); });
