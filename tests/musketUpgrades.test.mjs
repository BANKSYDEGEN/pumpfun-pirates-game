// [Emerly musket-upgrades] tiers in order, owner owns all, rank cap, modest numbers, accessories, prices = lib.ts / inventory.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { muskLevels, applyMuskUpg, applyGunAcc, MUSK_SHOP_ITEMS, RANK_UP, SALVAGE_PARTS } from '../js/musketUpgrades.js';
import { GUN_ITEMS } from '../js/inventory/catalog.js';
const lib = readFileSync(new URL('../supabase/functions/pvp/lib.ts', import.meta.url), 'utf8'), inv = readFileSync(new URL('../supabase/functions/pvp/inventory.ts', import.meta.url), 'utf8');
assert.deepEqual(muskLevels(['muskupg:reload1', 'muskupg:reload3']), { reload: 1, range: 0, acc: 0, skin: false }, 'a tier needs every tier below it');
assert.equal(muskLevels([], true).skin, true, 'owner: everything free');
const base = { dmg: 50, range: 60, wide: 0.55, reload: 2.0 }, max = { reload: 3, range: 3, acc: 3 };
const c = applyMuskUpg(base, 'common', max), l = applyMuskUpg(base, 'legendary', max);
assert.equal(c.reload, 1.94, 'common musket: tier 1 only'); assert.equal(l.reload, 1.82); assert.equal(l.range, 67.2); assert.equal(l.dmg, 50, 'damage never changes');
const a = applyGunAcc(l, { scope: 'x', bayonet: 'x', stock: 'x', horn: 'x' }); assert.ok(a.bayonet.dmg + a.dmg < 100, 'still 2 hits'); assert.ok((a.bayonet.dmg + 21) * 4 < 100, 't1711u legendary 21 + bayonet: still 5 shots'); assert.ok(a.reload >= 1.7);
for (const [k, v] of Object.entries(MUSK_SHOP_ITEMS)) assert.ok(lib.includes(`"${k}": { price: ${v.price} }`), 'lib.ts price ' + k);
for (const [r, v] of Object.entries(RANK_UP)) assert.ok(inv.includes(`${r}: { gold: ${v.gold}, parts: ${v.parts} }`), 'inventory.ts rank ' + r);
for (const [r, n] of Object.entries(SALVAGE_PARTS)) assert.ok(inv.includes(`${r}: ${n}`));
for (const [id, it] of Object.entries(GUN_ITEMS)) if (it.price) assert.ok(inv.includes(`"val:${id}": ${it.price}`), 'accessory price ' + id);
console.log('musketUpgrades ok');
