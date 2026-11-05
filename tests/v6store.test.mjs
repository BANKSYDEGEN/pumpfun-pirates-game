// [V6 store] BANKSY (Nov 4) "Having pants and shoes in the store will be better" + "Ok give them ability boosts": the Clothing Store
// pants + shoes (append-only ids, prices cheapest first, hi + lo GLBs per sex), their boosts (server = client), the wire digit,
// and the one-time legacy grant (classic pants + classic boots for pirates from before V6; idempotent, client == server).
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { BOOSTS } from '../js/boosts.js';
import { GEAR_ITEMS, GEAR_SLOTS as SHOP_SLOTS, VENDORS } from '../js/shopCatalog.js';
const ROOT = new URL('../', import.meta.url), txt = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const lib = txt('supabase/functions/pvp/lib.ts'), idx = txt('supabase/functions/pvp/index.ts'), gear = txt('js/pirateGear.js'), items = txt('js/pirateItems.js');
const PANTS = [['classic_pants', 150, { hp: 0.004 }], ['canvas_pants', 250, { hp: 0.006 }], ['sailor_trousers', 300, { hp: 0.008 }], ['leather_breeches', 400, { hp: 0.01 }]];
const SHOES = [['sandals', 120, { speed: 0.003 }], ['boots_classic', 150, { speed: 0.004 }], ['shoes_buckle', 250, { speed: 0.006 }], ['boots_sea', 300, { speed: 0.008 }]];
const slotList = (src, slot, q) => { const m = src.match(new RegExp(`\\b${slot}: \\[([^\\]]*)\\]`)); assert.ok(m, slot); return m[1].split(',').map((s) => s.trim().replace(new RegExp(q, 'g'), '')); };

test('ids are appended (old order kept), the same on client + server', async () => {
  const sv = txt('js/pvpSave.js'), GEAR_SLOTS = { boots: ['none', ...slotList(sv.slice(sv.indexOf('export const GEAR_SLOTS')), 'boots', "'").slice(1)], pants: slotList(sv.slice(sv.indexOf('export const GEAR_SLOTS')), 'pants', "'") };
  assert.deepEqual(GEAR_SLOTS.boots, ['none', 'boots_buckle', 'boots_cavalier', 'boots_gold', 'boots_classic', 'sandals', 'shoes_buckle', 'boots_sea']);
  assert.deepEqual(GEAR_SLOTS.pants, ['none', ...PANTS.map((p) => p[0])]);
  const ser = lib.slice(lib.indexOf('export const GEAR_SLOTS'));
  assert.deepEqual(slotList(ser, 'boots', '"'), GEAR_SLOTS.boots); assert.deepEqual(slotList(ser, 'pants', '"'), GEAR_SLOTS.pants);
  const R = gear.slice(gear.indexOf('GEAR_RENDERS'));
  assert.deepEqual(slotList(R, 'boots', "'"), GEAR_SLOTS.boots.slice(1)); assert.deepEqual(slotList(R, 'pants', "'"), GEAR_SLOTS.pants.slice(1));
});
test('prices: shop == server, cheapest first, flagged proposed; boosts: server == client, scaled by price, under the old boots', () => {
  for (const [slot, L] of [['pants', PANTS], ['boots', SHOES]]) { let last = 0;
    for (const [id, pr, b] of L) { const it = GEAR_ITEMS.find((i) => i.slot === slot && i.id === id); assert.ok(it && it.price === pr && !it.proposed, id);   // [v6-store-clothes] BANKSY 1:36 PM OK'd them for sale
      assert.ok(pr >= last); last = pr; assert.match(lib, new RegExp(`"gear:${slot}:${id}": \\{ price: ${pr} \\}`), id);
      assert.deepEqual(BOOSTS[`${slot}:${id}`], b, id); assert.match(lib, new RegExp(`"${slot}:${id}": \\{ ${Object.keys(b)[0]}: ${Object.values(b)[0]} \\}`)); } }
  const sh = GEAR_ITEMS.filter((i) => i.slot === 'pants'); assert.ok(sh.indexOf(sh.find((i) => i.id === 'classic_pants')) < sh.indexOf(sh.find((i) => i.id === 'leather_breeches')));
  for (const [, , b] of SHOES) assert.ok(b.speed < BOOSTS['boots:boots_buckle'].speed); for (const [, , b] of PANTS) assert.ok(b.hp <= 0.01);
  assert.equal(BOOSTS['boots:sandals'].speed, Math.min(...SHOES.map((s) => s[2].speed))); assert.equal(BOOSTS['pants:leather_breeches'].hp, Math.max(...PANTS.map((s) => s[2].hp)));
});
test('sold in the Clothing Store (and the Shop / Red Stall); the free "none" rows', () => {
  assert.ok(SHOP_SLOTS.some(([s]) => s === 'pants')); assert.ok(VENDORS.shop.slots.includes('pants') && VENDORS.shop.slots.includes('boots'));
  for (const v of ['clothes', 'stall_red']) {   // [v6-store-clothes] BANKSY 1:40 PM: SHOES + PANTS = more tabs under PIRATE GEAR
    assert.deepEqual(VENDORS[v].tabs, ['gear'], v); assert.deepEqual(VENDORS[v].slots.slice(-2), ['boots', 'pants'], v);
  }
  assert.ok(SHOP_SLOTS.some(([s, l]) => s === 'boots' && l === 'SHOES'));
  const ish = txt('js/islandShop.js'); assert.match(ish, /'SHOES & PANTS'/); assert.match(ish, /tabForSlot/);
  assert.ok(GEAR_ITEMS.find((i) => i.slot === 'pants' && i.id === 'none' && i.free));
});
test('models: hi + lo per sex, rigged; pants = the base item (boots / pegs cut it), shoes = one boots slot', () => {
  for (const [id] of [...PANTS, ...SHOES]) for (const s of ['male', 'female']) for (const l of ['hi', 'lo']) assert.ok(existsSync(new URL(`assets/pirates/items/v5/${id}_${s}_${l}.glb`, ROOT)), `${id} ${s} ${l}`);
  for (const [id] of PANTS) assert.match(gear, new RegExp(`'pants:${id}': \\['base', '${id}', null\\]`));
  for (const [id] of SHOES) { assert.match(gear, new RegExp(`'boots:${id}': \\['boots', '${id}', null\\]`)); assert.match(items, new RegExp(`item\\('${id}', [^\\n]*'boots'[^\\n]*BOOT5\\('${id}'\\)`)); }
  assert.match(items, /item\(id, id\.replace\(\/_\/g, ' '\), 'base', [^\n]*v5cloth: true, base: true/);
  assert.match(gear, /p\.v5 && !p\.v6 && !p\.forCrew && !p\.raulKeys\.base/, 'V6: no auto base outfit');
});
test('wire: pants ride one digit after the carry digits (older clients see a longer string = default look)', () => {
  assert.match(gear, /const WIRE_LEN = WIRE_SLOTS\.length \+ 6 \+ 7 \+ 2 \+ 1 \+ 1;/);
  assert.match(gear, /GEAR_RENDERS\.pants\.indexOf\(g\.pants\) \+ 1, g\.capeColor \| 0\]/); assert.match(gear, /const v = d\(c \+ 2\); if \(v > 0 && v <= GEAR_RENDERS\.pants\.length\) g\.pants = GEAR_RENDERS\.pants\[v - 1\]/);
});
test('legacy grant: old saves get + wear classic pants + boots once; new pirates nothing; never overrides a worn item', async () => {
  const { v6Legacy: L, addLegacyOwned, V6_LEGACY } = await import('../js/v6Legacy.js');
  const EMPTY = { pants: 'none', boots: 'none' }, blankProfile = () => ({ gold: 0, gear: { pants: 'none', boots: 'none' }, gearOwned: [] });
  const cleanProfile = (p) => { const q = JSON.parse(JSON.stringify(p)); addLegacyOwned(q.gear, q.gearOwned); return q; }, v6Legacy = (p) => L(p, !p.gold, EMPTY);
  const sv = txt('js/pvpSave.js'); assert.match(sv, /addLegacyOwned\(b\.gear, b\.gearOwned\);/); assert.match(sv, /if \(r\?\.profile && v6Legacy\(r\.profile\)/);
  const old = cleanProfile({ ...blankProfile(), gold: 500 }); assert.equal(v6Legacy(old), true);
  assert.equal(old.gear.pants, 'classic_pants'); assert.equal(old.gear.boots, 'boots_classic'); assert.equal(old.gear.v6legacy, 2);
  for (const k of V6_LEGACY) assert.ok(old.gearOwned.includes(k));
  const again = cleanProfile(JSON.parse(JSON.stringify(old))); assert.equal(v6Legacy(again), false); assert.equal(again.gear.pants, 'classic_pants', 'survives a reload'); assert.equal(again.gearOwned.filter((k) => k === 'pants:classic_pants').length, 1);
  again.gear.pants = 'none'; assert.equal(v6Legacy(again), false, 'taking them off sticks');
  const nu = blankProfile(); assert.equal(v6Legacy(nu), true); assert.equal(nu.gear.pants, 'none'); assert.equal(nu.gear.v6legacy, 1); assert.deepEqual(nu.gearOwned, []);
  const worn = cleanProfile({ ...blankProfile(), gold: 9, gear: { pants: 'none', boots: 'boots_gold' }, gearOwned: ['boots:boots_gold'] }); v6Legacy(worn); assert.equal(worn.gear.boots, 'boots_gold');
  // server: same two items, ADD-only + ignoreDuplicates, only rows from before V6, in devSync + wallet load + save
  assert.match(lib, /export const V6_LEGACY = \["gear:pants:classic_pants", "gear:boots:boots_classic"\];/);
  const { v6LegacyDue } = { v6LegacyDue: Function(`return ${lib.match(/export const v6LegacyDue = ([^;]+);/)[1].replace(/: string \| null \| undefined|: string/g, '')}`)() };
  assert.equal(v6LegacyDue('2026-10-01T00:00:00Z', '2026-11-06T05:00:00Z'), true); assert.equal(v6LegacyDue('2026-11-07T00:00:00Z', '2026-11-06T05:00:00Z'), false); assert.equal(v6LegacyDue(null, '2026-11-06T05:00:00Z'), false);
  assert.match(idx, /ignoreDuplicates: true/); assert.equal((idx.match(/await grantV6Legacy\(/g) || []).length, 3);
  assert.match(lib, /if \(g\?\.v6legacy === 1 \|\| g\?\.v6legacy === 2\) o\.v6legacy = g\.v6legacy;/);
});
