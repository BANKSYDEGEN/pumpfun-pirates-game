// node --test tests/   [fish2] the fishing upgrade: the fight gets harder with rarity, the server's lengths match the lagoon journal,
// every species has a 3D look + an item icon, the Fish Stand prices are untouched, and the reel flag ships OFF.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const T = await import('../js/island/areas/fishTune.js');
const C = await import('../js/inventory/catalog.js');
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('reel fight: rarer = smaller, faster zone and more pulls', () => {
  const order = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  for (let i = 1; i < order.length; i++) { const a = T.TIERS[order[i - 1]], b = T.TIERS[order[i]];
    assert.ok(b.zone < a.zone && b.hz > a.hz && b.pulls >= a.pulls, order[i]); }
  for (const r of order) assert.ok(T.TIERS[r].zone >= 0.12 && T.TIERS[r].pulls <= 6, 'still landable on a phone: ' + r);
  assert.equal(T.STRIKES, 3);
});
test('lengths: catalog FISH_CM (server) == lagoon.js FISH ranges; weights + shown sizes sane', () => {
  const lag = src('js/island/areas/lagoon.js'), rows = [...lag.matchAll(/\['([a-z]+)', '[^']+', \d+, \[(\d+), (\d+)\]/g)];
  assert.equal(rows.length, 8); for (const [, id, a, b] of rows) assert.deepEqual(C.FISH_CM[id], [+a, +b], id);
  assert.deepEqual(Object.keys(C.FISH_CM).sort(), Object.keys(C.FISH).sort());
  for (const [id, [a, b]] of Object.entries(C.FISH_CM)) { assert.ok(T.fishKg(id, a) <= T.fishKg(id, b)); assert.ok(T.showLen(b) <= 2.3 && T.showLen(a) >= 0.34); }
  assert.equal(T.fmtKg(0.25), '250 g'); assert.equal(T.fmtKg(3.42), '3.4 kg'); assert.equal(T.fmtKg(125), '125 kg');
});
test('every species has a 3D look and an item icon', () => {
  const f2 = src('js/island/areas/fishing2.js');
  for (const id of Object.keys(C.FISH)) { assert.match(f2, new RegExp(`\\n  ${id}: \\(k\\) =>`), id); assert.ok(existsSync(new URL(`../assets/items/fish_${id}.webp`, import.meta.url)), id); }
});
test('economy untouched: Fish Stand prices 25..500, fish weights as before', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(C.FISH).map(([k, v]) => [k, v.fish])), { minnow: 25, perch: 35, snapper: 60, eel: 90, pike: 140, carp: 200, koi: 300, leviathan: 500 });
  assert.deepEqual(C.FISH_WEIGHT, { minnow: 30, perch: 24, snapper: 16, eel: 12, pike: 9, carp: 5, koi: 3, leviathan: 1 });
});
test('migration 040 only adds the fish_reel flag, OFF', () => {
  const sql = src('supabase/migrations/040_fish_reel.sql').replace(/--.*$/gm, '');
  assert.match(sql, /insert into public\.pvp_flags \(k, on_, note\) values \('fish_reel', false,/); assert.match(sql, /on conflict \(k\) do nothing/);
  assert.doesNotMatch(sql, /\b(drop|delete|truncate|alter|update)\b/i);
});
test('the off switches are wired: &fish2=0 keeps the old prompt; the Edge refuses tickets unless fish_reel is on', () => {
  assert.match(src('js/island/areas/fishing2.js'), /get\('fish2'\) !== '0'/);
  assert.match(src('js/island/areas/lagoon.js'), /if \(FISH2\) fs2 = createFishing2/);
  assert.match(src('supabase/functions/pvp/inventory.ts'), /eq\("k", "fish_reel"\)[^\n]*if \(!fl\?\.\[0\]\?\.on_\) return json\(409, \{ error: "reel closed" \}\)/);
});
