// [Emerly musket-upgrades] BANKSY 2:52 PM Nov 5: "No just add it we can always change it". Gold-bought MUSKET UPGRADES (3 tracks x 3 tiers)
// + a cosmetic GILDED barrel / stock skin once all 9 are bought. Bought through the island shop's normal shop_buy as 'gear:muskupg:<id>'
// rows (pvp_owned, no migration; lib.ts SHOP_ITEMS has the same prices). The owner (BANKSYDEGEN) owns every tier free.
// MODEST on purpose: damage never changes (a musket hit is still ARENA 19, 5-6 hits = KO · t1711u), max tier = reload -9%, range +12%, spread -11%.
// [Emerly musket-rank] BANKSY 2:56 PM: a found musket ranks up one rarity (common -> rare -> epic -> legendary) for gold + MUSKET PARTS;
// each rank raises the upgrade-tier cap and tints the musket. Kill switches: &muskupg=0 (no upgrades, old stats), &muskrank=0 (no rank-up,
// no cap), &wstack=0 (weapons stack in the inventory again, js/inventory/ui.js).
const q = () => (typeof location !== 'undefined' ? location.search : '');
export const muskUpgOn = (s = q()) => !/[?&]muskupg=0(&|$)/.test(s || '');
export const muskRankOn = (s = q()) => !/[?&]muskrank=0(&|$)/.test(s || '');
export const wstackOn = (s = q()) => !/[?&]wstack=0(&|$)/.test(s || ''); // on = weapons DON'T stack (BANKSY 2:53 PM)
export const MUSK_TRACKS = [ // cost = gold per tier (cheapest first), mul = the multiplier at tier 1..3 (tier 0 = 1)
  { id: 'reload', name: 'RELOAD SPEED', icon: '⏱', cost: [1000, 3000, 8000], mul: [0.97, 0.94, 0.91], fmt: (m) => `-${Math.round((1 - m) * 100)}% reload` },
  { id: 'range', name: 'RANGE', icon: '🎯', cost: [1000, 3000, 8000], mul: [1.04, 1.08, 1.12], fmt: (m) => `+${Math.round((m - 1) * 100)}% range` },
  { id: 'acc', name: 'ACCURACY', icon: '✛', cost: [1000, 3000, 8000], mul: [1.04, 1.08, 1.12], fmt: (m) => `-${Math.round((1 - 1 / m) * 100)}% spread` },
];
export const MUSK_SKIN = { key: 'muskupg:skin_gilded', name: 'GILDED BARREL + STOCK', price: 0 }; // free once every tier is bought
export const muskKey = (t, n) => `muskupg:${t}${n}`;
export const MUSK_SHOP_ITEMS = Object.fromEntries(MUSK_TRACKS.flatMap(t => t.cost.map((c, i) => ['gear:' + muskKey(t.id, i + 1), { price: c }]))); // = lib.ts
// the rank ladder (= WEAPON_TIERS) and what each rank allows: the highest upgrade tier that applies while that musket is in hand
export const RANKS = ['common', 'rare', 'epic', 'legendary'];
export const RANK_CAP = { common: 1, rare: 2, epic: 3, legendary: 3 };
export const RANK_UP = { common: { gold: 1500, parts: 3 }, rare: { gold: 4000, parts: 6 }, epic: { gold: 10000, parts: 12 } }; // from -> next (= inventory.ts)
export const SALVAGE_PARTS = { common: 1, rare: 2, epic: 4, legendary: 8 };
export const PARTS_KEY = 'val:musket_parts';
// levels from the shop state's owned gear list ('muskupg:reload2' ...); a tier counts only with every tier below it
export function muskLevels(owned = [], owner = false) {
  const has = new Set(owned), o = {};
  for (const t of MUSK_TRACKS) { let n = 0; while (n < 3 && (owner || has.has(muskKey(t.id, n + 1)))) n++; o[t.id] = n; }
  o.skin = MUSK_TRACKS.every(t => o[t.id] >= 3); return o;
}
let LV = { reload: 0, range: 0, acc: 0, skin: false };
export const setMuskLevels = (lv) => { LV = { ...LV, ...lv }; if (typeof window !== 'undefined') window.PFP_MUSK_UPG = { ...LV }; };
export const getMuskLevels = () => ({ ...LV });
export const capFor = (rarity) => muskRankOn() ? (RANK_CAP[rarity] ?? 1) : 3;
// battle.js: the musket's arena numbers with the upgrades on top (after rarity). dmg is never touched.
export function applyMuskUpg(o, rarity = 'common', lv = LV) {
  if (!muskUpgOn()) return o; const cap = capFor(rarity), r = { ...o }, m = (t) => { const n = Math.min(cap, lv[t.id] | 0); return n ? t.mul[n - 1] : 1; };
  const [R, G, A] = MUSK_TRACKS;
  if ('reload' in r) r.reload = +(r.reload * m(R)).toFixed(3); if ('range' in r) r.range = +(r.range * m(G)).toFixed(2); if ('wide' in r) r.wide = +(r.wide / m(A)).toFixed(3);
  return r;
}
// the look: rank tint / trim (toon colour multiplier + a faint emissive), the GILDED skin wins
export const RANK_LOOK = { common: null, rare: { c: 0xd6e8ff, e: 0x0b2a55, ei: 0.35 }, epic: { c: 0xead6ff, e: 0x3a0f5a, ei: 0.4 }, legendary: { c: 0xffe08a, e: 0x7a4b00, ei: 0.55 } }; // [v332] legendary gold gleam
export const GILDED_LOOK = { c: 0xffe08a, e: 0x6b4a00, ei: 0.6 };
export function muskLook(rarity = 'common', lv = LV) {
  if (muskUpgOn() && lv.skin && (typeof window === 'undefined' || window.PFP_MUSK_SKIN !== false)) return { id: 'gilded', ...GILDED_LOOK };
  if (!muskRankOn()) return null; const l = RANK_LOOK[rarity]; return l ? { id: rarity, ...l } : null;
}
// [Emerly gunacc] BANKSY 2:58 PM "add gun accessories to that slot": 4 sub-slots on the EQUIPPED musket. Kept on the SLOT (swapping muskets
// keeps them). Modest: scope -5% spread + 3x ADS zoom, bayonet +3 dmg point-blank (<= 2.2 m, still 5+ hits: 21+3 = 24 x 4 < 100), stock -3%
// spread + 30% less recoil kick, powder horn -5% reload. &gunacc=0 = no sub-slots, no effects.
export const gunAccOn = (s = q()) => !/[?&]gunacc=0(&|$)/.test(s || '');
export const GUN_ACC = [ // sub-slot order on the card
  { slot: 'scope', key: 'val:acc_scope', label: 'SCOPE', fx: 'scope zoom 3x · spread -5%' },
  { slot: 'bayonet', key: 'val:acc_bayonet', label: 'BAYONET', fx: '+3 dmg point-blank (2.2 m)' },
  { slot: 'stock', key: 'val:acc_stock', label: 'STOCK', fx: 'recoil -30% · spread -3%' },
  { slot: 'horn', key: 'val:acc_horn', label: 'POWDER HORN', fx: 'reload -5%' },
];
const ACC_LS = 'pfp_gunacc_v1:';
let ACC = {};
export function loadGunAcc(who = 'me') { try { const v = JSON.parse(localStorage.getItem(ACC_LS + who) || '{}'); ACC = v && typeof v === 'object' ? v : {}; } catch { ACC = {}; } pub(); return { ...ACC }; }
export function setGunAcc(who, slot, key) { if (key) ACC[slot] = key; else delete ACC[slot]; try { localStorage.setItem(ACC_LS + who, JSON.stringify(ACC)); } catch {} pub(); return { ...ACC }; }
export const gunAcc = () => (gunAccOn() ? { ...ACC } : {});
// held = the server's bag counts: an accessory you no longer hold (sold / given) stops applying
export function pruneGunAcc(who, has) { let ch = false; for (const k of Object.keys(ACC)) if (!has(ACC[k])) { delete ACC[k]; ch = true; } if (ch) try { localStorage.setItem(ACC_LS + who, JSON.stringify(ACC)); } catch {} pub(); }
const pub = () => { if (typeof window !== 'undefined') window.PFP_GUN_ACC = gunAcc(); };
export function applyGunAcc(o, acc = gunAcc()) {
  const r = { ...o };
  if (acc.horn && 'reload' in r) r.reload = +(r.reload * 0.95).toFixed(3);
  if ('wide' in r) { let w = r.wide; if (acc.scope) w *= 0.95; if (acc.stock) w *= 0.97; r.wide = +w.toFixed(3); }
  r.recoil = acc.stock ? 0.7 : 1; r.zoom = acc.scope ? 3 : 1; r.bayonet = acc.bayonet ? { dmg: 3, reach: 2.2 } : null; // [v351] Brass Scope = 3x ADS zoom (tpsMath.scopeZoom); [backpack-pvp] t1711u: 21 + 3 = 24 x 4 = 96 < 100 = still 5 shots at legendary
  return r;
}

// [v332] swords share the same rarity look table (battle.js swordLook)
export const swordLook = (rarity = 'common') => muskLook(rarity, { reload: 0, range: 0, acc: 0, skin: false });
// [v332] per-musket instance binding: active equipped loadout lives in ACC; bag/house copies tracked by gid
let GUNS = []; // [{gid, item, place, acc, cottage_id?, house_slot?}] from inv_state
export function setGunInstances(list = []) { GUNS = Array.isArray(list) ? list.map((g) => ({ ...g, acc: { ...(g.acc || {}) } })) : []; const eq = GUNS.find((g) => g.place === 'equip'); if (eq) { ACC = { ...eq.acc }; pub(); } if (typeof window !== 'undefined') window.PFP_GUN_INST = GUNS.map((g) => ({ ...g, acc: { ...g.acc } })); }
export const gunInstances = () => GUNS.map((g) => ({ ...g, acc: { ...g.acc } }));
export function gunAccOf(gid) { const g = GUNS.find((x) => x.gid === gid); return g ? { ...g.acc } : {}; }
export function applyLocalAcc(gid, slot, key) { // optimistic client update while the RPC flies
  const g = GUNS.find((x) => x.gid === gid); if (!g) return gunAcc();
  if (key) g.acc[slot] = key; else delete g.acc[slot];
  if (g.place === 'equip') { ACC = { ...g.acc }; try { localStorage.setItem(ACC_LS + (typeof window !== 'undefined' && window.PFP_GUN_WHO || 'me'), JSON.stringify(ACC)); } catch {} pub(); }
  return { ...g.acc };
}

// [weapon-sync] allocation-free reads of YOUR musket look for the per-frame dress + the 'wl' wire (js/onfoot/weaponLook.js)
export const ACC_BIT = { scope: 1, bayonet: 2, stock: 4, horn: 8 };
export const accBitsOf = (acc) => (acc ? (acc.scope ? 1 : 0) | (acc.bayonet ? 2 : 0) | (acc.stock ? 4 : 0) | (acc.horn ? 8 : 0) : 0);
export const gunAccBits = () => (gunAccOn() ? accBitsOf(ACC) : 0);
export const muskGilded = (lv = LV) => !!(muskUpgOn() && lv.skin && (typeof window === 'undefined' || window.PFP_MUSK_SKIN !== false));
