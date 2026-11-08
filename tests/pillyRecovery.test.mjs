import test from 'node:test';
import assert from 'node:assert/strict';
import { createPillyState } from '../js/onfoot/pilly.js';
import { pillyInventoryEntry, PILLY_HULL_SPOT } from '../js/pillyEntries.js';
import { readFileSync } from 'node:fs';
test('early Harbor initialization failure can recover without permanently marking Pilly coming soon', async () => {
  let ready = false;
  const state = createPillyState({ call: async () => ready ? { ok: true, owned: false } : { ok: false, why: 'set sail to the Harbor first' } });
  await state.refresh(); assert.equal(state.state.avail, false); assert.match(state.state.error, /Harbor/);
  ready = true; await state.refresh(); assert.equal(state.state.avail, true); assert.equal(state.state.error, null);
});
test('network failure preserves known ownership and availability', async () => {
  let online = true;
  const state = createPillyState({ call: async () => { if (!online) throw Error('offline'); return { ok: true, owned: true, lv: 3, xp: 900 }; } });
  await state.refresh(); online = false; await state.refresh();
  assert.equal(state.state.owned, true); assert.equal(state.state.lv, 3); assert.equal(state.state.avail, true); assert.equal(state.state.error, 'offline');
});
test('duplicate panel/store refreshes share one request', async () => {
  let count = 0, resolve;
  const state = createPillyState({ call: () => { count++; return new Promise(r => resolve = r); } });
  const a = state.refresh(), b = state.refresh(); assert.equal(count, 1);
  resolve({ ok: true, owned: true }); await Promise.all([a, b]); assert.equal(state.state.owned, true);
});
test('owned companion inventory entry opens existing Pilly upgrade flow, not a bag/trade mutation', () => {
  let opens = 0;
  const doc = { createElement: () => ({ style: {}, setAttribute() {} }) };
  assert.equal(pillyInventoryEntry({ state: { owned: false } }, doc), null);
  const entry = pillyInventoryEntry({ state: { owned: true, lv: 2 }, open() { opens++; } }, doc);
  assert.match(entry.innerHTML, /LV 2/); assert.match(entry.innerHTML, /LEVEL UP/); entry.onclick(); assert.equal(opens, 1);
  assert.ok(!entry.dataset);
});
test('hull upgrade spot sits beside cage and invokes the existing panel', () => {
  assert.ok(Math.abs(PILLY_HULL_SPOT.z - 3.3) < 2.2);
  const text = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  assert.match(text('js/dock/parrotCage.js'), /spots.pilly_companion =/);
  assert.match(text('js/dock/shipHull.js'), /tag === 'pilly_companion'.*PFP_PILLY\?\.open/);
  assert.match(text('js/dock/index.js'), /installPillyInventory\(window.PFP_PILLY\)/);
});
