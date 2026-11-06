// [v328] BANKSY t1736u — ⚓ SERVER ghost-styled from mount (never white default), and ship #radar
// never draws SAFE HARBOR / green dashed Safe Zone (onFoot minimap + Full Map M only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServerPicker, SERVER_PICKER_ON } from '../js/serverPicker.js';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('mountButton injects #srv-btn style + ghost class BEFORE open()', () => {
  assert.equal(SERVER_PICKER_ON, true);
  // minimal DOM
  globalThis.document = {
    head: { children: [], appendChild(n) { this.children.push(n); } },
    body: { children: [], appendChild(n) { this.children.push(n); } },
    getElementById(id) { return this._els?.[id] || null; },
    querySelector(sel) {
      if (sel === '#pvp-harbor .ph-btns') return this._host;
      return null;
    },
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(), id: '', className: '', type: '', textContent: '', title: '',
        style: {}, classList: { _c: new Set(), add(c) { this._c.add(c); }, contains(c) { return this._c.has(c); }, remove(c) { this._c.delete(c); } },
        setAttribute(k, v) { this[k] = v; },
        addEventListener() {}, appendChild(c) { (this.children ||= []).push(c); },
        querySelector() { return null; }, querySelectorAll() { return []; },
      };
      return el;
    },
  };
  const host = document.createElement('div'); host.id = 'ph-btns';
  document._host = host;
  document._els = {};
  const api = { info: () => ({ prefix: 'pfp-harbor', copy: 1, copies: [], cap: 4 }), switchTo: async () => ({ ok: true }), toast() {} };
  const P = createServerPicker(api);
  P.mountButton();
  const btn = host.children[0];
  assert.ok(btn, 'button mounted');
  assert.equal(btn.id, 'srv-btn');
  assert.ok(btn.className.split(/\s+/).includes('ghost') || btn.classList.contains('ghost'), 'ghost class');
  const style = document.head.children.find(c => c.id === 'srv-picker-css' || (c.textContent || '').includes('#srv-btn'));
  assert.ok(style, 'style injected at mount (not deferred to open)');
  assert.match(style.textContent, /rgba\(14,\s*14,\s*14,\s*0\.72\)|#1a0f07|var\(--glass\)/);
  assert.doesNotMatch(style.textContent, /background:\s*#fff|background:\s*white/i);
  // open() must NOT be required for styling
  assert.equal(P.isOpen, false);
});

test('source: serverPicker ensureStyle + ghost; CSS harbor #srv-btn; compact hides it', () => {
  const sp = src('js/serverPicker.js');
  assert.match(sp, /function ensureStyle\(/);
  assert.match(sp, /ensureStyle\(\);\s*\/\/ \[v328\]/);
  assert.match(sp, /btn\.className = 'ghost'/);
  const css = src('css/style.css');
  assert.match(css, /#pvp-harbor #srv-btn/);
  assert.match(css, /#pvp-harbor\.ph-compact #srv-btn/);
  assert.match(css, /max-width:\s*330px/);
});

test('ship radar / radarZones never draw SAFE HARBOR or green dashed Safe Zone', () => {
  const dock = src('js/dock/index.js');
  assert.match(dock, /radarZones:\s*\(\)\s*=>\s*false/);
  assert.match(dock, /on && onFoot && imap\.drawLocal/); // ship path does NOT call drawLocal
  const main = src('js/main.js');
  assert.match(main, /no Safe Zone overlay|ZERO Safe Zone|t1726u/i);
  assert.doesNotMatch(main, /SAFE HARBOR['"`].*radar|radar.*SAFE HARBOR/);
  const imap = src('js/islandMap.js');
  assert.match(imap, /NO Safe Zone rings on the ship\/island radar|NEVER on the at-sea ship radar/);
  // draw() (ship whole-island radar) must not call drawSafeZoneRings / drawSafeOverlay
  const drawFn = imap.match(/function draw\(ctx, W, st\)[\s\S]*?return true;\n  \}/);
  assert.ok(drawFn, 'draw() found');
  assert.doesNotMatch(drawFn[0], /drawSafeZoneRings|drawSafeOverlay|SAFE HARBOR/);
  // drawLocal (on-foot) MAY draw Safe Zone — that is intended
  assert.match(imap, /function drawLocal[\s\S]*drawSafeZoneRings/);
});

test('sw.js is pfp-v328 and registers with update()', () => {
  assert.match(src('sw.js'), /VERSION = 'pfp-v328'/);
  assert.match(src('js/main.js'), /r\.update\(\)/);
});
