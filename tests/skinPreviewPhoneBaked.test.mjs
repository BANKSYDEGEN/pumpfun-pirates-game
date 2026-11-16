// [t2578u] BANKSY "on mobile on low graphics game crashes every time try to buy a ship skin": phones never open the skin
// preview's 2nd WebGL context (it held ~220 textures + ~150 programs next to the game's own = iOS tab kill, like the v368 crew shop).
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync, existsSync } from 'node:fs';
import { BAKED_SKINS } from '../assets/ships/thumbs/manifest.js';
const src = readFileSync(new URL('../js/skinPreview.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const cat = readFileSync(new URL('../js/shopCatalog.js', import.meta.url), 'utf8');
test('phones (coarse pointer) are baked-only unless ?liveskins=1', () => {
  assert.match(src, /BAKED_ONLY = PHONE && !/); assert.match(src, /liveskins=1/);
});
test('renderPreview never creates the GL renderer on phones', () => {
  const body = src.slice(src.indexOf('export function renderPreview'), src.indexOf('// halo colour'));
  assert.ok(body.indexOf('if (BAKED_ONLY)') > -1 && body.indexOf('if (BAKED_ONLY)') < body.indexOf('renderer()'));
});
test('requestPreviews on phones returns before the idle render queue', () => {
  const body = src.slice(src.indexOf('export function requestPreviews'), src.indexOf('function pump()'));
  assert.ok(body.indexOf('if (BAKED_ONLY)') > -1 && body.indexOf('if (BAKED_ONLY)') < body.indexOf('pump()'));
  assert.match(body, /return;\n\s*\}/);
});
test('every baked skin has its image, and the Ship Shop skins are all baked', () => {
  for (const set of ['pvp', 'solo']) for (const id of BAKED_SKINS[set]) assert.ok(existsSync(new URL(`../assets/ships/thumbs/${set}_${id}.webp`, import.meta.url)), `${set}_${id}.webp`);
  for (const id of ['classic', 'blood', 'seagreen', 'midnight', 'admiral', 'coral', 'storm', 'kraken', 'commodore', 'golden', 'ghost', 'flaming', 'diamond', 'opal', 'leviathan', 'celestial', 'sunking', 'poseidon']) assert.ok(BAKED_SKINS.pvp.includes(id), id);
  assert.match(cat, /SKIN_ITEMS/);
});
test('the manifest module is in the offline shell (skinPreview.js imports it)', () => {
  assert.match(sw, /"\.\/assets\/ships\/thumbs\/manifest\.js"/);
});
