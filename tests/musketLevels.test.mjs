// [musket-levels] BANKSY t2084u + "Rarity goes up every 5 levels": 4 levelled muskets (2 sold at LV 1, 2 found at LV 1), the level in the
// item key, rarity per 5 levels, modest stats, and the shop / server tables in sync. The SQL half: tools/inventory/musket_levels_sql_test.mjs.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import * as C from '../js/inventory/catalog.js';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('levels: old keys keep meaning (common LV 1, rare 6, epic 11, legendary 16), rarity every 5 levels, max 20', () => {
  assert.equal(C.muskLevelOf('wpn:musket:navy:common'), 1); assert.equal(C.muskLevelOf('wpn:musket:navy:rare'), 6);
  assert.equal(C.muskLevelOf('wpn:musket:navy:epic'), 11); assert.equal(C.muskLevelOf('wpn:musket:navy:legendary'), 16);
  const bands = { common: [1, 5], rare: [6, 10], epic: [11, 15], legendary: [16, 20] };
  for (let lv = 1; lv <= 20; lv++) { const t = C.muskTierOf(lv); assert.ok(lv >= bands[t][0] && lv <= bands[t][1], `${lv} ${t}`);
    for (const b of C.WEAPON_BASES.musket) { const k = C.muskKeyAt(b, lv); assert.ok(C.KEY_RE.test(k), k); assert.equal(C.muskLevelOf(k), lv); const i = C.itemInfo(k); assert.equal(i.level, lv); assert.equal(i.rarity, t); assert.equal(i.slot, 'musket'); } }
  for (const bad of ['wpn:musket:navy:rare:3', 'wpn:musket:navy:common:1', 'wpn:musket:navy:common:6', 'wpn:musket:navy:legendary:21', 'wpn:sword:rapier:rare:7']) { assert.equal(C.KEY_RE.test(bad), false, bad); assert.equal(C.itemInfo(bad), null, bad); }
  assert.equal(C.itemInfo('wpn:sword:rapier:epic').level, undefined); // swords unchanged
});
test('models: shop sells navy + blunderbuss at LV 1, chests drop dragoon + bone at LV 1 only, server shop agrees', async () => {
  assert.deepEqual(C.MUSKET_SHOP_MODELS, ['navy', 'blunder']); assert.deepEqual(C.MUSKET_FIND_MODELS, ['dragoon', 'bone']);
  for (const b of [...C.MUSKET_SHOP_MODELS, ...C.MUSKET_FIND_MODELS]) assert.ok(C.WEAPON_BASES.musket.includes(b));
  const lib = read('supabase/functions/pvp/lib.ts');
  assert.match(lib, /"gear:musket:navy": \{ price: 2000 \}/); assert.match(lib, /"gear:musket:blunder": \{ price: 5000 \}/);
  assert.doesNotMatch(lib, /"gear:musket:dragoon":/); assert.doesNotMatch(lib, /"gear:musket:bone":/);
  const chest = read('supabase/functions/pvp/chest.ts'); assert.match(chest, /slot === "musket" \? MUSKET_FIND_MODELS/); assert.match(chest, /if \(slot === "musket"\) rar = "common"/);
  const { MUSKET_ITEMS } = await import('../js/shopCatalog.js');
  const by = Object.fromEntries(MUSKET_ITEMS.map((i) => [i.id, i]));
  assert.ok(by.navy.levels && !by.navy.findOnly && by.blunder.levels && !by.blunder.findOnly);
  assert.ok(by.dragoon.findOnly && by.bone.findOnly && !by.bone.goal); assert.ok(!by.rusty.levels && !by.blunder_gold.levels);
});
test('costs: gold every level, musket parts only at a new rarity (= the old rank-up price), SQL mirror', () => {
  let gold = 0, parts = 0; for (let lv = 1; lv < 20; lv++) { const c = C.muskLevelCost(lv); gold += c.gold; parts += c.parts; assert.equal(c.parts > 0, lv % 5 === 0, 'parts at ' + lv); }
  assert.equal(C.muskLevelCost(20), null); assert.equal(gold, 47500); assert.equal(parts, 21);
  const sql = read('supabase/migrations/061_musket_levels.sql');
  assert.match(sql, /case p_lv when 5 then 1500 when 10 then 4000 when 15 then 10000 else 200 \* p_lv end/);
  assert.match(sql, /case p_lv when 5 then 3 when 10 then 6 when 15 then 12 else 0 end/);
  for (const k of ['common:[2-5]', 'rare:([7-9]|10)', 'epic:1[2-5]', 'legendary:(1[7-9]|20)']) assert.ok(sql.includes(k) && C.KEY_RE.source.includes(k), k);
});
test('stats: modest, every level strictly better, the bigger bump at each rarity, damage only moves with rarity (5-6 hits kept)', () => {
  const A = { dmg: 19, range: 60, wide: 0.55, reload: 1.25 }; let prev = null, prevGap = 0;
  for (let lv = 1; lv <= 20; lv++) { const t = C.muskTierOf(lv), w = C.weaponStats('musket', t, A, true, lv);
    if (prev) { assert.ok(w.reload <= prev.reload && w.range > prev.range && w.wide <= prev.wide, 'lv ' + lv); const gap = w.range - prev.range; if (lv % 5 === 1) assert.ok(gap > prevGap * 3, 'tier bump at ' + lv); else prevGap = gap; }
    assert.ok(w.dmg >= 19 && w.dmg <= 21 && Math.ceil(100 / w.dmg) >= 5, 'still 5+ hits'); prev = w; }
  const top = C.weaponStats('musket', 'legendary', A, true, 20); assert.ok(top.reload / A.reload > 0.85 && top.range / A.range < 1.15);
  // LV 1 (and level 0 = old callers) = the old numbers exactly
  assert.deepEqual(C.weaponStats('musket', 'common', A, true, 1), C.weaponStats('musket', 'common', A, true));
  assert.deepEqual(C.weaponStats('musket', 'rare', A, true, 0), C.weaponStats('musket', 'rare', A, true));
  assert.deepEqual(C.weaponStats('musket', 'rare', A, false, 9), A); // flag off = base numbers
});
test('client: inventory LEVEL UP + level badge, HUD weapon slot badge, battle uses the level, shop marks chest finds', () => {
  const ui = read('js/inventory/ui.js'), bt = read('js/onfoot/battle.js'), sh = read('js/islandShop.js'), inv = read('supabase/functions/pvp/inventory.ts');
  assert.match(ui, /run\('inv_musk_level'/); assert.match(ui, /LEVEL UP → LV/); assert.match(ui, /PFP_WEAPON_LEVEL = \{ musket:/); assert.match(ui, /data\.flags\?\.musket_levels/);
  assert.match(bt, /slot === 'musket' \? myLv\(\) : 0/); assert.match(bt, /class="bt-lv"/);
  assert.match(sh, /found: '🗺️ CHEST FIND'/); assert.match(sh, /LV 1 · COMMON/);
  assert.match(inv, /"inv_musk_level"/); assert.match(inv, /pvp_inv_musk_level/);
  assert.equal(read('supabase/functions/pvp/invCatalog.ts').split('\n').slice(1).join('\n'), read('js/inventory/catalog.js')); // generated copy in sync
});
test('Treasure Trader rows for every musket level match the rarity price; the 036 rows are untouched', () => {
  const rows = C.musketLevelPriceRows(); assert.equal(rows.length, C.WEAPON_BASES.musket.length * 20);
  for (const [k, shop, p] of rows) { assert.equal(shop, 'antiques'); assert.equal(p, C.RARITY_ANTIQUES[C.itemInfo(k).rarity]); }
  assert.ok(!C.priceRows().some(([k]) => k.startsWith('wpn:musket:bone')));
});
