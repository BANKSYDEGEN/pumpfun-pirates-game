// [backpack-pvp] BANKSY t1693u: 16-slot backpack haul cap (stacks = 1 slot; equipped sword/musket excluded).
// BANKSY / owner = unlimited. Kill switch: &bagcap=0.
export const BACKPACK_CAP = 16;
export const BAGCAP_ON = !(typeof location !== 'undefined' && /[?&]bagcap=0(&|$)/.test(location.search || ''));

const OWNER_NAMES = new Set(['banksy', 'banksydegen']);

/** Server-verified owner OR local ownerAll / account.owner OR ?banksy=1 (dev/headless only). */
export function isUnlimitedBag(state = {}) {
  if (state.owner === true || state.isOwner === true) return true;
  if (state.unlimited === true) return true;
  const n = String(state.name || state.captain || '').trim().toLowerCase();
  if (OWNER_NAMES.has(n)) return true;
  try {
    if (typeof location !== 'undefined' && /[?&]banksy=1(&|$)/.test(location.search || '')) return true;
  } catch {}
  return false;
}

export function maxBackpackSlots(state = {}) {
  if (!BAGCAP_ON) return Infinity;
  return isUnlimitedBag(state) ? Infinity : BACKPACK_CAP;
}

/**
 * Count occupied haul slots.
 * - Each stackable item row (qty > 0) = 1 slot (qty does not add slots).
 * - Each distinct weapon key occupies 1 slot PER unit when weapons don't stack (caller passes expanded or qty).
 * - Equipped primary sword + musket keys are excluded (worn on body).
 * Maps are NOT haul slots (pvp_maps stay soulbound).
 *
 * @param {Array<{item?:string,key?:string,qty?:number}>} items
 * @param {{sword?:string,musket?:string}|null} equipped
 * @param {{wstack?:boolean}} opts  wstack true (default) = each weapon unit is its own slot
 */
export function countBackpackSlots(items = [], equipped = null, opts = {}) {
  const eqSword = equipped?.sword || null;
  const eqMusket = equipped?.musket || null;
  const wstack = opts.wstack !== false; // default: weapons don't stack
  let n = 0;
  const eqSkip = new Map(); // key -> remaining equipped copies to exclude (1 each)
  if (eqSword) eqSkip.set(eqSword, (eqSkip.get(eqSword) || 0) + 1);
  if (eqMusket) eqSkip.set(eqMusket, (eqSkip.get(eqMusket) || 0) + 1);

  for (const row of items || []) {
    const key = String(row.item || row.key || '');
    if (!key || key.startsWith('map:') || key === 'val:gold') continue; // [gold-item] balance-backed, not a bag slot
    let qty = Math.max(0, Math.floor(Number(row.qty) || 0));
    if (!qty) continue;
    const skip = eqSkip.get(key) || 0;
    if (skip > 0) {
      const use = Math.min(skip, qty);
      eqSkip.set(key, skip - use);
      qty -= use;
      if (!qty) continue;
    }
    if (wstack && key.startsWith('wpn:')) n += qty; // one slot per weapon instance
    else n += 1; // stackable row = 1 slot
  }
  return n;
}

/** How many free haul slots remain (Infinity for BANKSY / bagcap off). */
export function freeBackpackSlots(items, equipped, state = {}, opts = {}) {
  const max = maxBackpackSlots(state);
  if (!Number.isFinite(max)) return Infinity;
  return Math.max(0, max - countBackpackSlots(items, equipped, opts));
}

/**
 * Would adding `addItem` with `addQty` need a NEW slot (vs stacking onto an existing stackable)?
 * Weapons always need a new slot per unit when wstack.
 */
export function needsNewSlot(items, addItem, addQty = 1, equipped = null, opts = {}) {
  const key = String(addItem || '');
  if (!key || key.startsWith('map:')) return false;
  const wstack = opts.wstack !== false;
  if (wstack && key.startsWith('wpn:')) return true;
  // stackable: new slot only if not already held (after excluding equipped copies of same key)
  const held = countBackpackSlots(
    (items || []).filter((r) => String(r.item || r.key) === key),
    // don't exclude equipped for "do I already have a stack" — if only equipped copy exists, withdrawing more still stacks visually as one row
    null,
    opts,
  );
  // Simpler: any existing non-equipped qty of this stackable key means no new slot
  const eqSword = equipped?.sword || null;
  const eqMusket = equipped?.musket || null;
  let qty = 0;
  for (const row of items || []) {
    if (String(row.item || row.key) !== key) continue;
    qty += Math.max(0, Math.floor(Number(row.qty) || 0));
  }
  if (key === eqSword) qty = Math.max(0, qty - 1);
  if (key === eqMusket) qty = Math.max(0, qty - 1);
  return qty <= 0;
}

/**
 * Can the player accept `addItem`×`addQty` under the cap?
 * Stacking onto an existing stackable always allowed; new slots blocked at cap.
 */
export function canAcceptItem(items, addItem, addQty = 1, equipped = null, state = {}, opts = {}) {
  if (!BAGCAP_ON || isUnlimitedBag(state)) return { ok: true, used: countBackpackSlots(items, equipped, opts), max: maxBackpackSlots(state) };
  const used = countBackpackSlots(items, equipped, opts);
  const max = BACKPACK_CAP;
  if (!needsNewSlot(items, addItem, addQty, equipped, opts)) return { ok: true, used, max, stacked: true };
  const wstack = opts.wstack !== false;
  const key = String(addItem || '');
  const need = (wstack && key.startsWith('wpn:')) ? Math.max(1, Math.floor(Number(addQty) || 1)) : 1;
  if (used + need > max) return { ok: false, used, max, why: `Backpack full (${used}/${max}) — stash or sell items first!` };
  return { ok: true, used, max };
}

/** Split a loot list into what fits under the looter's cap and what overflows. */
export function splitLootForCap(bagItems, looterItems, equipped, state = {}, opts = {}) {
  const take = [], left = [];
  let cur = (looterItems || []).map((r) => ({ item: r.item || r.key, qty: r.qty | 0 }));
  for (const row of bagItems || []) {
    const key = String(row.item || row.key || '');
    let qty = Math.max(0, Math.floor(Number(row.qty) || 0));
    if (!key || !qty) continue;
    if (!BAGCAP_ON || isUnlimitedBag(state)) { take.push({ item: key, qty }); continue; }
    let got = 0;
    while (qty > 0) {
      const step = (opts.wstack !== false && key.startsWith('wpn:')) ? 1 : qty;
      const check = canAcceptItem(cur, key, step, equipped, state, opts);
      if (!check.ok) break;
      got += step; qty -= step;
      const existing = cur.find((r) => r.item === key);
      if (existing && !(opts.wstack !== false && key.startsWith('wpn:'))) existing.qty += step;
      else cur.push({ item: key, qty: step });
    }
    if (got > 0) take.push({ item: key, qty: got });
    if (qty > 0) left.push({ item: key, qty });
  }
  return { take, left };
}

export function slotMeterText(used, state = {}) {
  const max = maxBackpackSlots(state);
  if (!Number.isFinite(max)) return { text: `👑 ${used} / ∞ SLOTS`, level: 'owner', used, max: Infinity };
  let level = 'ok';
  if (used >= max) level = 'full';
  else if (used >= max - 2) level = 'warn';
  return { text: `🎒 ${used} / ${max} SLOTS`, level, used, max };
}

export const BAG_FULL_MSG = 'Backpack full (16/16) — stash or sell items first!';
export const BAG_FULL_TOAST = '🎒 Backpack full (16/16)! Stash haul at your Cottage!';

/** Split inventory into soulbound equipped keep vs unequipped haul that drops on PvP death. Maps stay kept. */
export function splitHaulForDrop(items = [], equipped = {}) {
  const eqSword = equipped?.sword || null;
  const eqMusket = equipped?.musket || null;
  const skip = new Map();
  if (eqSword) skip.set(eqSword, (skip.get(eqSword) || 0) + 1);
  if (eqMusket) skip.set(eqMusket, (skip.get(eqMusket) || 0) + 1);
  const drop = [], keep = [];
  for (const row of items || []) {
    const key = String(row.item || row.key || '');
    if (!key || key.startsWith('map:')) { keep.push({ ...row, item: key }); continue; }
    let qty = Math.max(0, Math.floor(Number(row.qty) || 0));
    if (!qty) continue;
    const sk = skip.get(key) || 0;
    if (sk > 0) {
      const use = Math.min(sk, qty);
      skip.set(key, sk - use);
      keep.push({ item: key, qty: use });
      qty -= use;
    }
    if (qty > 0) drop.push({ item: key, qty });
  }
  return { drop, keep };
}
