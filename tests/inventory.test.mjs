// node --test tests/   [inventory] the item catalog: SQL price seed == catalog, generated Edge copy is fresh, flags default OFF,
// BANKSY's Antiques values, weapon stats modest. The SQL rules themselves: tools/inventory/sql_test.mjs (PGlite), run here when installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const C = await import('../js/inventory/catalog.js');
const SQL = readFileSync(new URL('../supabase/migrations/036_inventory.sql', import.meta.url), 'utf8');
const SQL37 = readFileSync(new URL('../supabase/migrations/037_fish_prices.sql', import.meta.url), 'utf8'); // [v208] fish prices + sell / market on
test('migrations 036 + 037 seed exactly the catalog prices', () => {
  const seeded = new Map([...(SQL + SQL37).matchAll(/\('([a-z:_]+)',\s*'(fish|antiques)',\s*(\d+)\)/g)].map(m => [m[1] + '|' + m[2], +m[3]]));
  const rows = C.priceRows(); assert.equal(seeded.get('map|antiques'), 100); assert.equal(seeded.size, rows.length + 1);
  for (const [k, s, p] of rows) assert.equal(seeded.get(k + '|' + s), p, k);
});
test('supabase invCatalog.ts is generated from js/inventory/catalog.js', () => {
  const gen = readFileSync(new URL('../supabase/functions/pvp/invCatalog.ts', import.meta.url), 'utf8');
  assert.equal(gen.slice(gen.indexOf('\n') + 1), readFileSync(new URL('../js/inventory/catalog.js', import.meta.url), 'utf8'), 'run node tools/gen_inv_catalog.mjs');
});
test('036 seeds every flag OFF but inventory + gifts; 037 (BANKSY 12:55 PM) turns on fish + antiques selling + the market only', () => {
  const F = C.FLAGS; assert.ok(F.FISH_SELL_ON && F.ANTIQUES_SELL_ON && F.MARKET_ON);
  assert.match(SQL37, /where k in \('fish_sell', 'antiques_sell', 'market'\);/); assert.doesNotMatch(SQL37, /market_fee|weapon|test_only/);
  for (const k of ['MARKET_FEE_ON', 'TEST_ONLY_LOCK']) assert.equal(F[k], false, k);
  for (const k of ['WEAPON_STATS_ON', 'RARE_WEAPON_DROPS_ON']) assert.equal(F[k], true, k); // [v209] BANKSY 1:03 PM
  assert.ok(F.INV_ON && F.GIFT_ON);
  for (const k of ['fish_sell', 'antiques_sell', 'market', 'market_fee', 'weapon_stats', 'rare_weapon_drops', 'test_only_lock']) assert.match(SQL, new RegExp(`\\('${k}', false`), k);
});
test("Antiques = BANKSY 11:19: map 100, finds 500..5000 by rarity", () => {
  assert.equal(C.MAP_ANTIQUES, 100); const R = { common: 500, uncommon: [1000, 1200], rare: [2000, 2200], epic: 3500, legendary: 5000 };
  for (const v of Object.values(C.VALUABLES)) { assert.ok(v.antiques >= 500 && v.antiques <= 5000); const r = R[v.rarity]; assert.ok(Array.isArray(r) ? r.includes(v.antiques) : r === v.antiques, v.name); }
  assert.deepEqual(C.RARITY_ANTIQUES, { common: 500, uncommon: 1000, rare: 2000, epic: 3500, legendary: 5000 });
});
test('weapon stats: modest (<= +10 % dmg), monotone, flag off = base numbers', () => {
  const base = { dmg: 34, reach: 2.5, cool: 0.55 }; assert.deepEqual(C.weaponStats('sword', 'legendary', base, false), base);
  let prev = 0; for (const t of C.WEAPON_TIERS) { const s = C.WEAPON_STATS[t]; assert.ok(s.dmg >= prev && s.dmg <= 1.10 && s.reload >= 0.92 && s.swing >= 0.92); prev = s.dmg; }
  assert.equal(C.weaponStats('musket', 'legendary', { dmg: 50, reload: 2, range: 60, wide: 0.55 }, true).dmg, 55);
});
test('drop tables sum to 1000, rare+ weapons only from rare / legendary chests', () => {
  for (const t of Object.values(C.CHEST_VALUABLES)) assert.equal(Object.values(t).reduce((a, b) => a + b, 0), 1000);
  for (const [k, w] of Object.entries(C.CHEST_WEAPON)) { assert.equal(Object.values(w.tiers).reduce((a, b) => a + b, 0), 1000); if (k === 'common') assert.deepEqual(Object.keys(w.tiers), ['common']); }
  for (const id of Object.keys(C.FISH)) assert.ok(C.FISH_WEIGHT[id] > 0);
});
test('provenance: gold-bought copies are never tradeable; stacking except maps', () => {
  assert.ok(!C.TRADEABLE_SOURCES.includes('carry_buy')); assert.ok(C.TRADEABLE_SOURCES.includes('kit'));
  assert.ok(C.STACKS('val:ruby') && !C.STACKS('map:00000000-0000-4000-8000-000000000001'));
  assert.equal(C.itemInfo('wpn:sword:rapier:epic').antiques, 3500); assert.equal(C.itemInfo('dup:hat:crown:legendary').antiques, 5000);
});
const PG = ['/tmp/pglite', '/workspace/pfp-secfix-test/pg'].find(d => existsSync(d + '/node_modules/@electric-sql/pglite'));
test('SQL rules (PGlite): sells, clamp, gifts, market escrow / double buy / cancel, kit, items-only digs', { skip: !PG && 'PGlite not installed' }, () => {
  const out = execFileSync('node', [new URL('../tools/inventory/sql_test.mjs', import.meta.url).pathname], { cwd: PG, encoding: 'utf8', timeout: 120000 });
  assert.match(out, /SQL OK \d+ checks/);
});
test("plaza_shops.json contract: Timothy's file parses, radius read, fallback = his anchors", async () => {
  const S = await import('../js/inventory/shopSpots.js'), f = '/workspace/timothy-plazashops/assets/island/plaza_shops.json';
  const fb = S.shopSpots(null); assert.deepEqual([fb.fish.trigger.x, fb.fish.trigger.z, fb.market.trigger.radius], [-604.5, -16.8, 3.5]); // [v248] centred in the wider shop   // [v247] FISH MARKET #10 (walk-in, sell inside)   // [v240] #8
  if (existsSync(f)) { const j = S.shopSpots(JSON.parse(readFileSync(f, 'utf8'))); const raw = JSON.parse(readFileSync(f, 'utf8')); for (const id of S.SHOP_IDS) { assert.ok(j[id].fromFile, id); assert.ok(Number.isFinite(j[id].trigger.x) && j[id].trigger.radius > 0, id); } }
  const moved = S.shopSpots({ fish: { trigger_fish: { x: -300, y: 5, z: 40, radius: 2.5 } } }); assert.deepEqual([moved.fish.trigger.x, moved.fish.trigger.radius, moved.fish.fromFile], [-300, 2.5, true]); // JSON wins over the fallback
  const p = S.shopSpots({ fish: { trigger_fish: { x: 1, y: 2, z: 3 } } }); assert.equal(p.fish.trigger.radius, 3); assert.ok(!p.antiques.fromFile);
});

test('[v209] 038 turns on only weapon_stats + rare_weapon_drops; common weapon stats = ARENA exactly, rare+ better', async () => {
  const fs = await import('node:fs'); const S38 = fs.readFileSync(new URL('../supabase/migrations/038_weapon_flags.sql', import.meta.url), 'utf8');
  assert.match(S38, /k in \('weapon_stats', 'rare_weapon_drops'\)/); assert.doesNotMatch(S38, /market_fee|drop table|delete from/i);
  const C = await import('../js/inventory/catalog.js'); const { ARENA } = { ARENA: { sword: { dmg: 19, reach: 2.5, arc: 1.15, cool: 0.55, dur: 0.42, hitAt: 0.2 }, musket: { dmg: 19, range: 60, wide: 0.55, reload: 1.25, delay: 0.16 } } };
  for (const s of ['sword', 'musket']) { assert.deepEqual(C.weaponStats(s, 'common', ARENA[s]), ARENA[s]); assert.deepEqual(C.weaponStats(s, 'legendary', ARENA[s], false), ARENA[s]); }
  const r = C.weaponStats('sword', 'rare', ARENA.sword), l = C.weaponStats('musket', 'legendary', ARENA.musket);
  assert.ok(r.dmg > 19 && r.cool < 0.55 && r.reach > 2.5); assert.ok(l.dmg > 19 && l.reload < 1.25 && l.range > 60 && l.wide < 0.55); // [backpack-pvp] t1711u 5-6 hits to KO
  const B = fs.readFileSync(new URL('../js/onfoot/battle.js', import.meta.url), 'utf8');
  assert.match(B, /carryArmed\(R\.fig/); assert.match(B, /tps\.shotYaw/); assert.match(B, /S = mine \? myW\('musket'\) : ARENA\.musket/);
  assert.match(B, /export const ARENA = \{\n  hp: 100, sword: \{ dmg: 19, reach: 2\.5, arc: 1\.15, cool: 0\.55/); assert.match(B, /musket: \{ dmg: 19, range: 60, wide: 0\.55, reload: 1\.25/);
});

test('[v212] plaza_shops.json = FALLBACK; shops sit on numbered existing structures, clear of the shop prompts', () => {
  const J = JSON.parse(readFileSync(new URL('../assets/island/plaza_shops.json', import.meta.url), 'utf8'));
  const N = JSON.parse(readFileSync(new URL('../assets/island/building_numbers.json', import.meta.url), 'utf8')).buildings;
  return import('../js/inventory/shopSpots.js').then((S) => { const f = S.shopSpots(J), fb = S.shopSpots(null);
    for (const id of S.SHOP_IDS) { assert.deepEqual(f[id].trigger, fb[id].trigger, id); assert.ok(f[id].fromFile); }
    const t2w = (lx, lz) => [-640 - lz, -90 + lx];
    const use = { fish: 'FISH MARKET', antiques: 'TREASURE TRADER', market: 'MARKETPLACE' };   // [v240] FISH MARKET #8, MARKETPLACE #7 (the hall: its centre is 6 m behind the door)
    for (const id of S.SHOP_IDS) { const hits = N.filter(q => q.use.startsWith(use[id])); assert.equal(hits.length, 1, id + ': exactly one'); const b = hits[0]; const d = Math.hypot(b.x - f[id].trigger.x, b.z - f[id].trigger.z); assert.ok(d < 10, id + ' on #' + b.n); }
    for (const n of [18, 19]) assert.match(N.find(q => q.n === n).use, /^EMPTY /, '#' + n + ' retired (decor / removed)');
    assert.equal(f.fish.sign, false); assert.equal(f.market.sign, false); assert.equal(f.antiques.sign, false); assert.equal(S.SHOP_NAMES.antiques, 'TREASURE TRADER');   // painted on their buildings, no floating boards
    // storefront prompts (lz + 3.8) + the squad hall door stay out of reach of the new triggers
    const prompts = [[-49, -25.5], [-38.5, -25.5], [-10, -25.5], [20.5, -25.5], [32, -25.5], [14, -76.7]].map(([a, c]) => t2w(a, c));
    for (const id of S.SHOP_IDS) for (const [x, z] of prompts) assert.ok(Math.hypot(x - f[id].trigger.x, z - f[id].trigger.z) > f[id].trigger.radius + 2, id);
    const RESERVED = new Set([45, 46]);   // [Timothy] #45 / #46 = js/island/coliseum.js NEW_STORES (&colirent=1); #47 = THE GOLDEN DOUBLOON CASINO
    const max = Math.max(...N.map(b => b.n)); assert.deepEqual(N.map(b => b.n), Array.from({ length: max }, (_, i) => i + 1).filter(n => !RESERVED.has(n))); assert.equal(new Set(N.map(b => b.id)).size, N.length); });
});

test('[v240] shop lists cheapest first + the plaza kill switches default OFF', async () => {
  const U = await import('../js/inventory/ui.js').catch(() => null);
  if (U?.sortListings) assert.deepEqual(U.sortListings([{ id: 3, price: 1800 }, { id: 1, price: 320 }, { id: 4, price: 320 }, { id: 2, price: 950 }]).map(l => l.id), [1, 4, 2, 3]);
  const CO = await import('../js/island/coast.js'); assert.equal(CO.TOKENX_ON, false); assert.equal(CO.HALL_BOARDS_ON, false);
  assert.ok(CO.hallTokenHidden('HQ') && CO.hallTokenHidden('RETARDIO') && !CO.hallTokenHidden('SUNK') && !CO.hallTokenHidden('AHOY') && !CO.hallTokenHidden('PUMP'));
  const src = readFileSync(new URL('../supabase/functions/pvp/inventory.ts', import.meta.url), 'utf8');
  assert.match(src, /case "mkt_browse".*order\("price", \{ ascending: true \}\)/);
});
