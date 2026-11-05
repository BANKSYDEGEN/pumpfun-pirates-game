// [Emerly prestige outfits] every new prestige ship has captain clothes (pirateGear SKIN_CLOTH) + crew OUTFIT + crew HATS palettes,
// and the free clothes-colour pick still wins over them (clothColors). Source-level (pirateGear imports three).
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NEW_SHIP_TABLE } from '../js/newShipsTable.js';
const src = (f) => readFileSync(new URL('../js/' + f, import.meta.url), 'utf8');
const gear = src('pirateGear.js'), crew = src('crew.js');
const block = (s, name) => { const i = s.indexOf('const ' + name + ' = {'); return s.slice(i, s.indexOf('};', i)); };
const hex = /^#[0-9a-f]{6}$/;
test('five prestige ships have clothes + crew outfit + crew hat palettes', () => {
  for (const { id } of NEW_SHIP_TABLE) {
    const m = block(gear, 'SKIN_CLOTH').match(new RegExp('\\b' + id + ": \\['(#\\w+)', '(#\\w+)', '(#\\w+)'\\]")); assert.ok(m, id + ' SKIN_CLOTH');
    m.slice(1).forEach((h) => assert.match(h, hex));
    assert.match(block(crew, 'OUTFIT'), new RegExp('\\n  ' + id + ':\\s*\\{ coat: \\[0x\\w{6}, 0x\\w{6}, 0x\\w{6}\\], hat: \\[0x\\w{6}, 0x\\w{6}\\], pants: 0x\\w{6}, accent: 0x\\w{6} \\}'), id + ' OUTFIT');
    assert.match(block(crew, 'HATS'), new RegExp('\\n  ' + id + ':\\s*\\{ a: \\[0x\\w{6}, 0x\\w{6}, 0x\\w{6}\\], b: \\[0x\\w{6}, 0x\\w{6}, 0x\\w{6}\\], skull: 0x\\w{6} \\}'), id + ' HATS');
  }
});
test('free clothes pick still overrides the skin colours', () => {
  assert.match(gear, /export const clothColors = \(gear, colors\) => \(gear\?\.outfitColor > 0/);
  assert.match(gear, /const cloth = colors\?\.cloth \|\| \(k \?/);
});
test('each new hull dresses its crew in its OWN palette (crewOutfit = its id)', () => {
  for (const { id } of NEW_SHIP_TABLE) {
    const f = { sunking: 'sunKing' }[id] || id, s = readFileSync(new URL(`../assets/ships/pvp/newShips/${f}.js`, import.meta.url), 'utf8');
    assert.match(s, new RegExp(`crewOutfit: '${id}'`), id);
  }
});
