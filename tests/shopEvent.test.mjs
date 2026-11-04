// node --test tests/   [shop-crash] the 'pfp-shop' event is shared by js/islandShop.js (Pet Store / Crew Shop / gear shops: { open, vendor } on
// every open AND close) and the plaza shop triggers (js/island/areas/invShops.js: { shop }). Only the latter may open the inventory panel.
import test from 'node:test';
import assert from 'node:assert/strict';
const mkEl = () => { const cls = new Set(), kids = new Map();
  return { style: {}, dataset: {}, textContent: '', innerHTML: '', classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    addEventListener() {}, appendChild() {}, setAttribute() {}, removeAttribute() {}, remove() {}, append() {}, focus() {}, querySelector: (s) => { if (!kids.has(s)) kids.set(s, mkEl()); return kids.get(s); }, querySelectorAll: () => [] }; };
const W = new EventTarget();
globalThis.window = W; globalThis.CustomEvent ??= class extends Event { constructor(t, o = {}) { super(t); this.detail = o.detail; } };
globalThis.document = { createElement: mkEl, head: mkEl(), body: mkEl(), documentElement: mkEl(), addEventListener() {}, removeEventListener() {} };
const { createInventory } = await import('../js/inventory/ui.js');
const calls = [], inv = createInventory({ pvp: () => ({ inv: { call: async (a) => { calls.push(a); return { ok: true, items: [], maps: [], flags: {}, equipped: {} }; } } }), toast() {} });
const fire = (detail) => W.dispatchEvent(new CustomEvent('pfp-shop', { detail }));
test('island shop open / close (Pet Store, Crew Shop, gear) does NOT pop the inventory', () => {
  for (const d of [{ open: true, vendor: 'pets' }, { open: false }, { open: true, vendor: 'shop' }, { open: true, vendor: 'weapons' }, undefined]) { fire(d); assert.equal(inv.isOpen, false, JSON.stringify(d)); }
  assert.equal(calls.length, 0);
});
test('the plaza triggers still open Fish Stand / Antiques / Marketplace', () => {
  for (const shop of ['fish', 'antiques', 'market']) { inv.close(); fire({ shop }); assert.equal(inv.isOpen, true, shop); }
  inv.close(); fire({ shop: 'bogus' }); assert.equal(inv.isOpen, false);
});
