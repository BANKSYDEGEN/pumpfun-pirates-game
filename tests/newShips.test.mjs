// [Emerly] the five new hulls (js/newShipsTable.js + js/newShips.js): data checks only (the looks are WebGL: tools/new_ships_viewer.html).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NEW_SHIP_TABLE } from '../js/newShipsTable.js';
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const IDS = ['opal', 'leviathan', 'celestial', 'sunking', 'poseidon'];
const FILES = ['opal', 'leviathan', 'celestial', 'sunKing', 'poseidon'];
test('the one table: P3 OPAL .. P7 POSEIDON (BANKSY 8:37 PM "Just make them prestige 3 on")', () => {
  assert.deepEqual(NEW_SHIP_TABLE.map(r => [r.id, r.prestige]), [['opal', 3], ['leviathan', 4], ['celestial', 5], ['sunking', 6], ['poseidon', 7]]);
  assert.equal(new Set(NEW_SHIP_TABLE.map(r => r.prestige)).size, 5, 'one ship per level');
  for (const r of NEW_SHIP_TABLE) assert.ok(r.prestige > 2, 'P1 GOLDEN / P2 DIAMOND untouched');
});
test('the server mirror (lib.ts NEW_SHIP_PRESTIGE) matches the client table', () => {
  const m = src('supabase/functions/pvp/lib.ts').match(/export const NEW_SHIP_PRESTIGE: Record<string, number> = (\{[^}]*\})/);
  assert.ok(m, 'NEW_SHIP_PRESTIGE in lib.ts');
  const srv = Function(`return (${m[1]})`)();
  assert.deepEqual(srv, Object.fromEntries(NEW_SHIP_TABLE.map(r => [r.id, r.prestige])));
});
test('each new ship is a free prestige GRANT everywhere (never sold for gold, never in chests or the legacy kill seed)', () => {
  const lib = src('supabase/functions/pvp/lib.ts'), chest = src('supabase/functions/pvp/chest.ts');
  assert.match(lib, /PRESTIGE_SKINS[^\n]*NEW_SHIP_PRESTIGE/);
  assert.match(lib, /`skin:\$\{id\}`, \{ price: 0, goal: \[\{ stat: "prestige", need: lv \}\] \}/);
  const kills = lib.match(/export const SKIN_KILLS[^\n]*/)[0];
  for (const id of IDS) { assert.ok(!kills.includes(id + ':'), id + ' not in SKIN_KILLS'); assert.ok(!chest.includes(`'${id}'`) && !chest.includes(`"${id}"`), id + ' not in chests'); }
  assert.match(src('js/shopCatalog.js'), /NEW_SHIP_TABLE\.map\([^\n]*price: 0, grant: 'prestige'/);
  assert.match(src('js/prestige.js'), /NEW_SHIP_TABLE\.map\(r => \[r\.prestige, \{ skin: r\.id, name: r\.name \}\]\)/);
  assert.match(src('js/config.js'), /\.\.\.NEW_SHIP_TABLE\.map/);
});
test('the service worker caches every new ship module', () => {
  const sw = src('sw.js');
  for (const f of ['js/newShipsTable.js', 'js/newShips.js', 'assets/ships/pvp/newShips/kit.js', ...FILES.map(f => `assets/ships/pvp/newShips/${f}.js`)]) assert.ok(sw.includes(`"./${f}"`), f);
});
test('each hull keeps the DIAMOND rig scale (berth fit + hitbox unchanged) and has an animated look', () => {
  for (const f of FILES) { const s = src(`assets/ships/pvp/newShips/${f}.js`);
    assert.match(s, /liftRig\(ctx, \{ lift: 0\.6, sx: 1\.12, sy: 1\.26, sz: 1\.12 \}\)/, f);
    assert.match(s, /uNT/, f + ' animates on the shared clock');
    assert.ok(!/new THREE\.\w+\(/.test(s.split('onBeforeRender')[1]?.split('\n')[0] || ''), f + ': no allocation per frame'); }
});
test('CREW_EXTRA_SLOTS stays empty', () => { assert.match(src('js/crewV4.js'), /export const CREW_EXTRA_SLOTS = \[\],/); });
