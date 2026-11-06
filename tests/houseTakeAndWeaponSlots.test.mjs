// [v329] BANKSY t1742u house_take CHECK fix + t1743u weapons never stack in cottage chest
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isStackable, applyChestStore, applyChestTake } from '../js/dock/houseStorage.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('isStackable: weapons never stack; fish/val do', () => {
  assert.equal(isStackable('wpn:sword:cutlass:common'), false);
  assert.equal(isStackable('wpn:musket:blunder:rare'), false);
  assert.equal(isStackable('fish:snapper'), true);
  assert.equal(isStackable('val:ruby'), true);
});

test('applyChestStore: depositing 3 swords fills 3 qty=1 slots (never merges)', () => {
  const r = applyChestStore([], 24, 'wpn:sword:cutlass:common', 3);
  assert.equal(r.ok, true);
  assert.equal(r.qty, 3);
  assert.equal(r.items.length, 3);
  assert.ok(r.items.every((x) => x.item.startsWith('wpn:') && x.qty === 1));
  // fish still stacks
  const f = applyChestStore(r.items, 24, 'fish:snapper', 5);
  assert.equal(f.ok, true);
  assert.equal(f.items.filter((x) => x.item === 'fish:snapper').length, 1);
  assert.equal(f.items.find((x) => x.item === 'fish:snapper').qty, 5);
});

test('applyChestStore: weapon into full chest of other items fails cleanly', () => {
  const filled = [];
  for (let i = 0; i < 2; i++) filled.push({ slot: i, item: 'fish:koi', qty: 1 });
  const r = applyChestStore(filled, 2, 'wpn:musket:rusty:common', 1);
  assert.equal(r.ok, false);
  assert.equal(r.why, 'chest full');
});

test('applyChestTake peels one weapon unit', () => {
  const items = [{ slot: 0, item: 'wpn:sword:rusty:common', qty: 1 }];
  const r = applyChestTake(items, 0, 1);
  assert.equal(r.ok, true);
  assert.equal(r.taken.item, 'wpn:sword:rusty:common');
  assert.equal(r.taken.qty, 1);
  assert.equal(r.items.length, 0);
});

test('046 migration + houses.ts: house source allowed; opaque error path documented', () => {
  const m = read('supabase/migrations/046_fix_house_take.sql');
  assert.match(m, /pvp_inv_source_check/);
  assert.match(m, /'house'::text/);
  assert.match(m, /pvp_house_inv_source/);
  assert.match(m, /item like 'wpn:%'/);
  assert.match(m, /qty = 1/);
  const ts = read('supabase/functions/pvp/houses.ts');
  assert.match(ts, /house_take/);
  assert.match(ts, /pvp_house_take_capped/);
  assert.match(ts, /house error/);
  assert.match(ts, /inv_source|23514/);
  const hs = read('js/dock/houses.js');
  assert.match(hs, /expandWeapons/);
  assert.match(hs, /weapons never stack/);
  assert.match(hs, /String\(item\)\.startsWith\('wpn:'\) \? 1/);
});

test('sw.js is pfp-v329', () => {
  assert.match(read('sw.js'), /VERSION = 'pfp-v329'/);
});
