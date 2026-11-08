import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FISH, VALUABLES, GUN_ITEMS, WEAPON_BASES, WEAPON_TIERS, itemInfo } from '../js/inventory/catalog.js';
import { ISLAND_GOODS, islInfo } from '../js/inventory/islandGoods.js';
import { itemImg, treatArt } from '../js/inventory/itemArt.js';
import { itemIconHtml } from '../js/inventory/itemIcon.js';
const keys = [
 ...Object.keys(FISH).map(id => `fish:${id}`), ...Object.keys(VALUABLES).map(id => `val:${id}`),
 ...Object.keys(GUN_ITEMS).map(id => `val:${id}`), ...Object.keys(ISLAND_GOODS).map(id => `isl:${id}`),
 ...Object.entries(WEAPON_BASES).flatMap(([slot, bases]) => bases.flatMap(base => WEAPON_TIERS.map(r => `wpn:${slot}:${base}:${r}`))),
 'par:00000000-0000-4000-8000-000000000001', 'map:any'
];
test('every catalog item and island good has a small existing baked image', () => {
 for (const key of keys) { const info = key.startsWith('isl:') ? islInfo(key) : itemInfo(key);
  const url = itemImg(key, info); assert.ok(url.endsWith('.webp'), key); assert.ok(existsSync(fileURLToPath(url)), key);
  assert.ok(statSync(fileURLToPath(url)).size < 40000, key);
 }
 assert.ok(existsSync(fileURLToPath(treatArt)));
});
test('parrot colors and all musket levels keep the correct image', () => {
 for (const color of ['green','red','blue','cockatoo','black','gold','diamond']) assert.ok(itemImg('par:x', {kind:'parrot',color:'parrot_'+color}).endsWith(`parrot_${color}.webp`));
 assert.ok(itemImg('par:x',{kind:'parrot',color:'../../not-a-color'}).endsWith('parrot_green.webp'));
 for (let lv=1;lv<=20;lv++) {const r=lv<6?'common':lv<11?'rare':lv<16?'epic':'legendary';const key=`wpn:musket:bone:${r}${[1,6,11,16].includes(lv)?'':':'+lv}`;
  assert.ok(existsSync(fileURLToPath(itemImg(key,itemInfo(key)))));}
});
test('image HTML stays lazy and preserves escaped emoji failure fallback', () => {
 const html=itemIconHtml(itemInfo('val:musket_parts'),'❔','val:musket_parts');
 assert.match(html,/loading="lazy"/);assert.match(html,/val_musket_parts.webp/);assert.match(html,/replaceWith/);assert.match(html,/🔩/);
 assert.equal(itemIconHtml({icon:'<' }), '&lt;');assert.equal(itemImg('unknown',null),'');
});
test('artwork is never added to first-load precache and no runtime renderer is imported', () => {
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');assert.doesNotMatch(sw,/assets\/items\//);
 const art=readFileSync(new URL('../js/inventory/itemArt.js',import.meta.url),'utf8');assert.doesNotMatch(art,/WebGL|GLTFLoader|render_icons/);
});
