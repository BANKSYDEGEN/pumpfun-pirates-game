// [scale-afk] BANKSY t2512u: ~5 min idle -> title + free world_cap; menus/shops pause; owner exempt; one config value.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORLD_AFK_S } from '../js/config.js';
import { inMenuOrShop, createWorldAfk, showWorldAfkNote, clearWorldAfkNote, AFK_NOTE, MENU_IDS } from '../js/worldAfk.js';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('one config value: 300 s (~5 min); owner exempt; menus pause; kick copy is friendly', () => {
  assert.equal(WORLD_AFK_S, 300);
  assert.match(src('js/config.js'), /export const WORLD_AFK_S = 300/);
  assert.match(AFK_NOTE, /spot was freed/);
  assert.match(AFK_NOTE, /ENTER GAME/);
  const html = src('index.html');
  assert.match(html, /id="title-afk"/);
  const main = src('js/main.js');
  assert.match(main, /worldAfk\.start\(\)/);
  assert.match(main, /worldAfk\.stop\(\)/);
  assert.match(main, /cancelJoin\(\)/);
  assert.match(main, /ownerAllSkins\(\) \|\| shopCache\(\)\.owner/);
  assert.match(main, /showWorldAfkNote\(AFK_NOTE\)/);
  assert.match(src('sw.js'), /\.\/js\/worldAfk\.js/);
  assert.ok(MENU_IDS.includes('pause') && MENU_IDS.includes('shop') && MENU_IDS.includes('casino-ui') && MENU_IDS.includes('inv-panel'));
});

test('inMenuOrShop: pause / shop / inventory / casino / html open-classes; title itself is not a menu', () => {
  const el = (id, { hidden = false, on = [] } = {}) => {
    const o = { id, hidden, on };
    o.classList = { contains: (c) => c === 'hidden' ? !!o.hidden : o.on.includes(c) };
    return o;
  };
  const store = {
    title: el('title'),
    pause: el('pause', { hidden: true }),
    shop: el('shop', { hidden: true }),
    'casino-ui': el('casino-ui'),
    'inv-panel': el('inv-panel', { hidden: true }),
  };
  const doc = { documentElement: { className: '' }, getElementById: (id) => store[id] || null };
  assert.equal(inMenuOrShop(doc), false);
  store.pause.hidden = false;
  assert.equal(inMenuOrShop(doc), true);
  store.pause.hidden = true;
  doc.documentElement.className = 'pfp-booted shop-open';
  assert.equal(inMenuOrShop(doc), true);
  doc.documentElement.className = 'pfp-booted';
  store['casino-ui'].on = ['on'];
  assert.equal(inMenuOrShop(doc), true);
});

test('timer: 5 min idle kicks once; menus pause the clock; owner never kicks; input resets', () => {
  let t = 0, kicks = 0, owner = false, ui = false;
  const a = createWorldAfk({ clock: () => t, idleS: 300, isOwner: () => owner, inUi: () => ui, onKick: () => kicks++ });
  a.start();
  t = 299000; assert.equal(a.tick(), false); assert.equal(kicks, 0);
  t = 300000; assert.equal(a.tick(), true); assert.equal(kicks, 1);
  t = 600000; assert.equal(a.tick(), false); assert.equal(kicks, 1, 'one kick until they start again');
  a.stop();

  kicks = 0; t = 0; owner = false; ui = false;
  const b = createWorldAfk({ clock: () => t, idleS: 300, isOwner: () => owner, inUi: () => ui, onKick: () => kicks++ });
  b.start();
  t = 200000; assert.equal(b.tick(), false);
  ui = true; assert.equal(b.tick(), false, 'clock pauses the moment the shop opens');
  t = 400000; assert.equal(b.tick(), false, 'time in the shop does not count'); assert.equal(kicks, 0);
  ui = false; t = 400000; assert.equal(b.tick(), false, 'unpause applies the frozen time');
  t = 499000; assert.equal(b.tick(), false, 'remaining idle still counts after leaving the shop (200s + 99s < 300s)');
  t = 500000; assert.equal(b.tick(), true); assert.equal(kicks, 1);
  b.stop();

  kicks = 0; t = 0; owner = true; ui = false;
  const c = createWorldAfk({ clock: () => t, idleS: 300, isOwner: () => owner, inUi: () => ui, onKick: () => kicks++ });
  c.start();
  t = 999000; assert.equal(c.tick(), false); assert.equal(kicks, 0);
  c.stop();

  kicks = 0; t = 0; owner = false;
  const d = createWorldAfk({ clock: () => t, idleS: 300, isOwner: () => false, inUi: () => false, onKick: () => kicks++ });
  d.start();
  t = 290000; d.touch();
  t = 580000; assert.equal(d.tick(), false); t = 590000; assert.equal(d.tick(), true);
  d.stop();
});

test('title note shows and hides without inventing copy', () => {
  const el = { id: 'title-afk', textContent: '', hidden: true };
  const doc = { getElementById: (id) => id === 'title-afk' ? el : null };
  showWorldAfkNote(AFK_NOTE, doc);
  assert.equal(el.textContent, AFK_NOTE); assert.equal(el.hidden, false);
  clearWorldAfkNote(doc);
  assert.equal(el.textContent, ''); assert.equal(el.hidden, true);
});
