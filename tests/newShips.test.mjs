// [Emerly] the five new hulls (js/newShips.js): data checks only (the looks are WebGL, checked with tools/new_ships_viewer.html).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const table = src('js/newShips.js');
const IDS = ['opal', 'leviathan', 'celestial', 'sunking', 'poseidon'];
const FILES = ['opal', 'leviathan', 'celestial', 'sunKing', 'poseidon'];
test('every new ship is in the one table and NOT unlockable yet', () => {
  for (const id of IDS) assert.match(table, new RegExp(`id: '${id}'[^\\n]*unlock: null`), id);
});
test('no new ship is sold, granted or listed (no server / migration change)', () => {
  const shop = src('js/shopCatalog.js'), cfg = src('js/config.js'), lib = src('supabase/functions/pvp/lib.ts'), pres = src('js/prestige.js');
  for (const id of IDS) for (const [n, s] of [['shopCatalog', shop], ['config', cfg], ['lib.ts', lib], ['prestige', pres]]) assert.ok(!new RegExp(`['"\`:]${id}['"\`]`).test(s), `${id} in ${n}`);
});
test('the service worker caches every new ship module', () => {
  const sw = src('sw.js');
  for (const f of ['js/newShips.js', 'assets/ships/pvp/newShips/kit.js', ...FILES.map(f => `assets/ships/pvp/newShips/${f}.js`)]) assert.ok(sw.includes(`"./${f}"`), f);
});
test('each hull keeps the DIAMOND rig scale (berth fit + hitbox unchanged) and has an animated look', () => {
  for (const f of FILES) { const s = src(`assets/ships/pvp/newShips/${f}.js`);
    assert.match(s, /liftRig\(ctx, \{ lift: 0\.6, sx: 1\.12, sy: 1\.26, sz: 1\.12 \}\)/, f);
    assert.match(s, /uNT/, f + ' animates on the shared clock');
    assert.ok(!/new THREE\.\w+\(/.test(s.split('onBeforeRender')[1]?.split('\n')[0] || ''), f + ': no allocation per frame'); }
});
test('CREW_EXTRA_SLOTS stays empty', () => { assert.match(src('js/crewV4.js'), /export const CREW_EXTRA_SLOTS = \[\],/); });
