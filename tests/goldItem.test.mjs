import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GOLD_ITEM, GOLD_CAP, isGoldItem, goldQty, clampGoldMove, syntheticGoldStack, goldChestRoom } from '../js/inventory/goldItem.js';
import { isStackable, applyChestStore, applyChestTake, chestCanAccept } from '../js/dock/houseStorage.js';
import { itemInfo, KEY_RE } from '../js/inventory/catalog.js';
import { countBackpackSlots } from '../js/inventory/backpackCap.js';
import { formatGoldAmount } from '../js/goldFormat.js';

describe('gold-item helpers', () => {
  it('recognizes val:gold key + catalog', () => {
    assert.equal(GOLD_ITEM, 'val:gold');
    assert.ok(isGoldItem(GOLD_ITEM));
    assert.ok(!isGoldItem('val:gold_bar'));
    assert.ok(KEY_RE.test(GOLD_ITEM));
    const info = itemInfo(GOLD_ITEM);
    assert.equal(info.kind, 'gold');
    assert.equal(info.name, 'Gold');
    assert.equal(info.antiques | 0, 0);
    assert.equal(info.fish | 0, 0);
  });

  it('rejects nonfinite / fractional / overdraft qty', () => {
    assert.equal(goldQty(0), 0);
    assert.equal(goldQty(-3), 0);
    assert.equal(goldQty(1.9), 1);
    assert.equal(goldQty(NaN), 0);
    assert.equal(goldQty(Infinity), 0);
    assert.equal(goldQty(GOLD_CAP + 1), 0);
    assert.equal(goldQty(GOLD_CAP), GOLD_CAP);
    assert.equal(clampGoldMove(500, 200, 1000), 200);
    assert.equal(clampGoldMove(500, 2000, 100), 100);
    assert.equal(clampGoldMove(0, 999, 999), 0);
    assert.equal(clampGoldMove(50, 0, 999), 0);
  });

  it('synthetic bag row mirrors balance only (no invent when empty)', () => {
    assert.equal(syntheticGoldStack(0), null);
    assert.equal(syntheticGoldStack(-5), null);
    const s = syntheticGoldStack(12345);
    assert.deepEqual(s, { item: GOLD_ITEM, qty: 12345, tradeable: 12345, kit: 0, synthetic: true, source: 'balance' });
  });

  it('chest room respects GOLD_CAP and stacks', () => {
    assert.equal(goldChestRoom([]), GOLD_CAP);
    assert.equal(goldChestRoom([{ item: GOLD_ITEM, qty: 100 }]), GOLD_CAP - 100);
    assert.equal(goldChestRoom([{ item: GOLD_ITEM, qty: GOLD_CAP }]), 0);
  });

  it('comma thousands separators stay for displays', () => {
    assert.equal(formatGoldAmount(1234567), '1,234,567');
    assert.equal(formatGoldAmount(1000), '1,000');
  });
});

describe('gold-item house chest offline helpers', () => {
  it('gold stacks and respects 10M cap', () => {
    assert.ok(isStackable(GOLD_ITEM));
    assert.ok(chestCanAccept([], 8, GOLD_ITEM));
    let r = applyChestStore([], 8, GOLD_ITEM, 5000);
    assert.ok(r.ok);
    assert.equal(r.items[0].qty, 5000);
    r = applyChestStore(r.items, 8, GOLD_ITEM, 2500);
    assert.ok(r.ok);
    assert.equal(r.items[0].qty, 7500);
    r = applyChestStore([{ item: GOLD_ITEM, qty: GOLD_CAP, slot: 0 }], 8, GOLD_ITEM, 1);
    assert.equal(r.ok, false);
  });

  it('withdraw removes chest qty (conservation of stack)', () => {
    const start = [{ item: GOLD_ITEM, qty: 1000, slot: 0 }];
    const r = applyChestTake(start, 0, 400);
    assert.ok(r.ok);
    assert.equal(r.taken.qty, 400);
    assert.equal(r.items[0].qty, 600);
    const all = applyChestTake(r.items, 0, 600);
    assert.ok(all.ok);
    assert.equal(all.items.length, 0);
  });
});

describe('gold-item backpack rules', () => {
  it('synthetic gold does not consume a backpack slot', () => {
    const items = [{ item: GOLD_ITEM, qty: 99999 }, { item: 'fish:snapper', qty: 3 }];
    assert.equal(countBackpackSlots(items, {}), 1);
  });
});

describe('gold-item conservation (pure accounting model)', () => {
  // Mirrors SQL semantics without a DB: balance ↔ chest never dual-spendable.
  function store(state, qty) {
    const q = clampGoldMove(qty, state.bal, goldChestRoom(state.chest));
    if (!q) return { ok: false, why: 'not enough gold' };
    const next = { ...state, bal: state.bal - q, chest: [...state.chest] };
    const stack = next.chest.find((x) => x.item === GOLD_ITEM);
    if (stack) stack.qty += q; else next.chest.push({ item: GOLD_ITEM, qty: q, slot: next.chest.length });
    return { ok: true, qty: q, state: next };
  }
  function take(state, qty) {
    const stack = state.chest.find((x) => x.item === GOLD_ITEM);
    if (!stack) return { ok: false, why: 'empty' };
    const q = Math.min(goldQty(qty) || stack.qty, stack.qty, Math.max(0, GOLD_CAP - state.bal));
    if (!q) return { ok: false, why: 'bad' };
    const next = { bal: state.bal + q, chest: state.chest.map((x) => ({ ...x })) };
    const s = next.chest.find((x) => x.item === GOLD_ITEM);
    s.qty -= q;
    next.chest = next.chest.filter((x) => x.qty > 0);
    return { ok: true, qty: q, state: next };
  }
  function gift(a, b, qty) {
    const q = clampGoldMove(qty, a.bal, GOLD_CAP - b.bal);
    if (!q) return { ok: false };
    return { ok: true, qty: q, a: { ...a, bal: a.bal - q }, b: { ...b, bal: b.bal + q } };
  }

  it('store then take conserves total gold', () => {
    let s = { bal: 5000, chest: [] };
    const total = () => s.bal + s.chest.reduce((a, x) => a + (x.item === GOLD_ITEM ? x.qty : 0), 0);
    assert.equal(total(), 5000);
    let r = store(s, 2000); assert.ok(r.ok); s = r.state;
    assert.equal(s.bal, 3000);
    assert.equal(total(), 5000);
    r = take(s, 1500); assert.ok(r.ok); s = r.state;
    assert.equal(s.bal, 4500);
    assert.equal(total(), 5000);
    // stored remainder is not spendable
    assert.equal(s.chest[0].qty, 500);
  });

  it('gift is atomic subtract+credit; retry same amounts conserves', () => {
    let a = { bal: 1000 }, b = { bal: 100 };
    const r1 = gift(a, b, 250); assert.ok(r1.ok);
    a = r1.a; b = r1.b;
    assert.equal(a.bal, 750);
    assert.equal(b.bal, 350);
    // idempotent replay of same logical gift would re-apply only if not deduped —
    // with req dedupe the SQL returns retry; here assert overdraft protection
    const r2 = gift(a, b, 99999);
    assert.ok(r2.ok);
    assert.equal(r2.qty, 750); // clamps to sender balance
    assert.equal(r2.a.bal + r2.b.bal, 1100);
  });

  it('cannot store more than balance; cannot dual-spend chest gold', () => {
    const s0 = { bal: 100, chest: [] };
    const r = store(s0, 500);
    assert.ok(r.ok);
    assert.equal(r.qty, 100);
    assert.equal(r.state.bal, 0);
    // spendable is 0 even though chest has 100
    assert.equal(r.state.bal, 0);
    assert.equal(r.state.chest[0].qty, 100);
  });
});
