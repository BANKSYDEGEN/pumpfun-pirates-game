// [gold-item] Spendable gold stays on the profile balance. `val:gold` only lives in house /
// ship chests (or as a synthetic backpack row for give/store). Never dual-spendable.
export const GOLD_ITEM = 'val:gold';
export const GOLD_ITEM_ON = typeof location === 'undefined' || !/[?&]golditem=0(&|$)/.test(location.search || '');
export const GOLD_CAP = 10_000_000;
export const GOLD_INFO = Object.freeze({
  kind: 'gold', name: 'Gold', icon: '🪙', rarity: 'common', fish: 0, antiques: 0,
  tradeable: true, stackable: true, note: 'your spendable pirate gold',
});

export const isGoldItem = (key) => key === GOLD_ITEM;

export function goldQty(n) {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v >= 1 && v <= GOLD_CAP ? v : 0;
}

/** Clamp a deposit/gift amount against balance + optional chest room. */
export function clampGoldMove(want, balance, room = GOLD_CAP) {
  const bal = Math.max(0, Math.floor(Number(balance) || 0));
  const rm = Math.max(0, Math.floor(Number(room) || 0));
  const w = goldQty(want);
  if (!w) return 0;
  return Math.min(w, bal, rm, GOLD_CAP);
}

/** Synthetic backpack row from the live spendable balance (not a pvp_inv row). */
export function syntheticGoldStack(balance) {
  const qty = Math.max(0, Math.floor(Number(balance) || 0));
  if (qty < 1) return null;
  return { item: GOLD_ITEM, qty, tradeable: qty, kit: 0, synthetic: true, source: 'balance' };
}

export function goldChestRoom(items) {
  const list = Array.isArray(items) ? items : [];
  const stack = list.find((x) => x && x.item === GOLD_ITEM);
  if (stack) return Math.max(0, GOLD_CAP - (stack.qty | 0));
  return GOLD_CAP;
}
