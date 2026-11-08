import test from 'node:test'; import assert from 'node:assert/strict';
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
const { createPillyState } = await import('../js/onfoot/pilly.js');
test('every player owns Pilly, out by default, LEAVE ON SHIP kept locally without a server row (t2348u)', async () => {
  const calls = []; const st = createPillyState({ call: async (a) => { calls.push(a); return { ok: true, owned: false, out: false, xp: 0, lv: 0 }; } });
  await st.refresh(); assert.equal(st.state.owned, true); assert.equal(st.state.out, true); assert.equal(st.show, true);
  assert.ok(!calls.includes('pilly_buy'));
});
test('offline still owned and out', async () => {
  const st = createPillyState({ call: async () => ({ ok: false, why: 'offline' }) });
  await st.refresh(); assert.equal(st.show, true);
});
test('server row out=false is respected', async () => {
  const st = createPillyState({ call: async () => ({ ok: true, owned: true, out: false, xp: 0, lv: 0 }) });
  await st.refresh(); assert.equal(st.show, false);
});
