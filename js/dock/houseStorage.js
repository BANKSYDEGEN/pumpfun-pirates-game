// Pure cottage-chest transfer helpers (no Three.js). Used by js/dock/houses.js + unit tests.
// [t1709u] Drag full stack / split stack — merging into an existing stack in a FULL chest
// uses 0 extra slots and MUST succeed.

export function isStackable(item) {
  return typeof item === 'string' && !item.startsWith('wpn:');
}

export function chestCanAccept(items, slots, item) {
  const list = Array.isArray(items) ? items : [];
  const cap = slots | 0;
  if (isStackable(item) && list.some((x) => x.item === item)) return true;
  return list.length < cap;
}

/** Deposit qty of item into chest. Returns { ok, items, why?, slot? }. Weapons (wpn:*) never stack — one unit per slot. */
export function applyChestStore(items, slots, item, qty, meta = null) {
  const q0 = Math.max(1, Math.min(999, Math.floor(Number(qty) || 0)));
  if (!item || !q0) return { ok: false, items: items || [], why: 'bad store' };
  const list = (items || []).map((x) => ({ ...x }));
  const cap = slots | 0;
  const metaObj = meta && typeof meta === 'object' ? { ...meta } : undefined;
  if (isStackable(item)) {
    const stack = list.find((x) => x.item === item);
    if (stack) { stack.qty = (stack.qty | 0) + q0; return { ok: true, items: list, slot: stack.slot }; }
    if (list.length >= cap) return { ok: false, items: list, why: 'chest full' };
    let slot = 0; const used = new Set(list.map((x) => x.slot));
    while (used.has(slot)) slot++;
    if (slot >= cap) return { ok: false, items: list, why: 'chest full' };
    const row = { slot, item, qty: q0 }; if (metaObj) row.meta = metaObj;
    list.push(row);
    return { ok: true, items: list, slot };
  }
  // [v329] wpn:* — never merge; deposit one qty=1 row per unit into free slots
  let placed = 0, first = null, left = q0;
  while (left > 0) {
    if (list.length >= cap) break;
    let slot = 0; const used = new Set(list.map((x) => x.slot));
    while (used.has(slot)) slot++;
    if (slot >= cap) break;
    const row = { slot, item, qty: 1 }; if (metaObj) row.meta = { ...metaObj };
    list.push(row);
    if (first == null) first = slot;
    placed++; left--;
  }
  if (!placed) return { ok: false, items: list, why: 'chest full' };
  return { ok: true, items: list, slot: first, qty: placed };
}

/** Withdraw qty from a chest slot. Returns { ok, items, taken?, why? }. */
export function applyChestTake(items, slot, qty) {
  const list = (items || []).map((x) => ({ ...x }));
  const row = list.find((x) => x.slot === (slot | 0));
  if (!row) return { ok: false, items: list, why: 'empty slot' };
  const q = Math.max(1, Math.min(row.qty | 0, Math.floor(Number(qty) || 0)));
  if (!q) return { ok: false, items: list, why: 'bad take' };
  row.qty -= q;
  const taken = { item: row.item, qty: q };
  return { ok: true, items: list.filter((x) => (x.qty | 0) > 0), taken };
}

export function filterCat(item, cat) {
  if (!cat || cat === 'all') return true;
  const k = String(item || '');
  if (cat === 'weapons') return k.startsWith('wpn:');
  if (cat === 'loot') return k.startsWith('fish:') || k.startsWith('val:');
  if (cat === 'resources') return k.startsWith('dup:') || (!k.startsWith('wpn:') && !k.startsWith('fish:') && !k.startsWith('val:'));
  return true;
}
