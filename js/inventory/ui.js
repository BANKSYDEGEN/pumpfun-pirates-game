// [inventory] THE INVENTORY GRID (BANKSY 11:01-11:03 AM): the HUD MAPS button is now INVENTORY and opens a scrolling grid of item slots
// (icon + count, identical items stack, no slot / stack cap). Tap a slot: OPEN (a treasure map -> the MAPS chart, as before), EQUIP (a
// weapon), GIVE (a player + a quantity), and at a plaza shop SELL (Fish Stand / Antiques) or LIST (Marketplace). The server does every
// move (migration 036); this only shows what it says. Used items leave the grid (a dug / sold / given map, a sold fish...).
import { itemInfo, RARITY_COLOR, FLAGS, MARKET } from './catalog.js';
import { wstackOn, muskRankOn, RANK_UP, RANKS, SALVAGE_PARTS, PARTS_KEY, RANK_CAP, GUN_ACC, gunAccOn, loadGunAcc, setGunAcc, gunAcc, pruneGunAcc, setGunInstances, gunInstances, applyLocalAcc } from '../musketUpgrades.js'; // [Emerly wstack / eqslots / musket-rank / gunacc / v332 per-gun]
import { createGivePick } from './givePick.js'; // [give-dropdown] GIVE: pick an online pirate (or type a name), then confirm
import { countBackpackSlots, slotMeterText, isUnlimitedBag, BAGCAP_ON } from './backpackCap.js'; // [backpack-pvp]
// [item-icons] real pictures for every item (assets/items/*.webp, 256 px, lazy); a spare cosmetic uses its baked shop render. The emoji stays as the fallback.
const IMG_DIR = new URL('../../assets/items/', import.meta.url).href, THUMB_DIR = new URL('../../assets/pirates/thumbs/', import.meta.url).href;
const MAP_TIER = { common: 'common', uncommon: 'common', rare: 'rare', epic: 'rare', legendary: 'legendary' };
export function itemImg(key, info) {
  const p = String(key).split(':'); if (!info) return '';
  if (info.kind === 'fish') return `${IMG_DIR}fish_${p[1]}.webp`;
  if (info.kind === 'gunacc') return `${IMG_DIR}val_${p[1]}.webp`; // [v332] crafted attachment thumbs
  if (info.kind === 'valuable') return `${IMG_DIR}val_${p[1]}.webp`;
  if (info.kind === 'weapon') {
    // [v332] legendary cards prefer a gold-rim sunburst thumb when present
    if (info.rarity === 'legendary') {
      const leg = `${IMG_DIR}wpn_${info.slot}_${info.base}_legendary.webp`;
      return leg; // onerror falls back to emoji via icoHtml; base webp still used if missing via onerror chain below
    }
    return `${IMG_DIR}wpn_${info.slot}_${info.base}.webp`;
  }
  if (info.kind === 'map') return `${IMG_DIR}map_${MAP_TIER[info.rarity] || 'common'}.webp`;
  if (info.kind === 'dup') return `${THUMB_DIR}${info.slot}_${info.id}.png`;
  return '';
}
// grid label: weapons drop the rarity word (the border colour shows it), so "Legendary rusty musket" reads "Rusty Musket"
const cap = (w) => w.replace(/\b[a-z]/g, c => c.toUpperCase());
export const shortName = (info) => info.kind === 'weapon' ? cap(`${info.base === 'blunder' ? 'blunderbuss' : info.base} ${info.base === 'blunder' ? '' : info.slot}`.trim()) : info.name;
const icoHtml = (key, info) => {
  const u = itemImg(key, info); if (!u) return `<i>${info.icon || '❔'}</i>`;
  const fb = info.kind === 'weapon' ? `${IMG_DIR}wpn_${info.slot}_${info.base}.webp` : '';
  const emoji = JSON.stringify(info.icon || '❔').replace(/"/g, '&quot;');
  const onerr = fb && info.rarity === 'legendary'
    ? `this.onerror=function(){this.replaceWith(document.createTextNode(${emoji}))};this.src='${fb}';`
    : `this.replaceWith(document.createTextNode(${emoji}))`;
  return `<i><img src="${u}" alt="" loading="lazy" decoding="async" onerror="${onerr}"></i>`;
};
const CSS = `
#inv-panel{position:fixed;inset:0;z-index:62;display:none;background:rgba(10,7,4,.72);font-family:'Just Another Hand',cursive;color:#f4e2bb;touch-action:manipulation}
#inv-panel.on{display:flex;align-items:center;justify-content:center}
#inv-panel .iv-box{width:min(760px,96vw);height:min(92vh,860px);height:calc(100dvh - 16px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));max-height:min(92vh,860px);max-height:calc(100dvh - 16px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));overflow:hidden;display:flex;flex-direction:column;background:#2a1a0c;border:3px solid #ffcd77;border-radius:16px;box-shadow:0 10px 40px #000}
#inv-panel .iv-head{flex:none;display:flex;align-items:center;gap:10px;padding:10px 14px 6px;font-size:30px;letter-spacing:.05em;color:#ffcd77}
#inv-panel .iv-head small{font-size:18px;color:#cdb68c;flex:1}
#inv-panel .iv-slots{font:bold 16px system-ui,sans-serif;padding:2px 10px;border-radius:999px;border:2px solid #ffcd77;background:#1a0f07;color:#ffcd77;letter-spacing:.04em}
#inv-panel .iv-slots.warn{border-color:#ffb020;color:#ffb020;background:#2a1a06}
#inv-panel .iv-slots.full{border-color:#ff4a3d;color:#ffd0c8;background:#2a0c0a}
#inv-panel .iv-slots.owner{border-color:#ffd700;color:#ffd700;background:#2a2208}
#inv-panel .iv-x{width:44px;height:44px;border-radius:50%;border:2px solid #ffcd77;background:#1a0f07;color:#ffcd77;font-size:22px;cursor:pointer}
#inv-panel .iv-tabs{flex:none;display:flex;gap:6px;padding:0 14px 6px}
#inv-panel .iv-tabs button{font:20px 'Just Another Hand',cursive;padding:4px 12px 2px;border-radius:10px;border:2px solid rgba(255,205,119,.4);background:#1a0f07;color:#f4e2bb;cursor:pointer}
#inv-panel .iv-tabs button.on{border-color:#ffcd77;background:#5a3410;color:#fff}
#inv-panel .iv-grid{flex:1 1 0;min-height:120px;overflow-y:auto;-webkit-overflow-scrolling:touch;display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));grid-auto-rows:76px;gap:8px;padding:8px 14px 12px;align-content:start}

#inv-panel .iv-slot.iv-leg{box-shadow:0 0 0 2px #ffd24a,0 0 14px rgba(255,205,60,.65),inset 0 0 18px rgba(255,200,80,.18);border-color:#ffd24a!important}
#inv-panel .iv-slot .iv-accpip{position:absolute;left:4px;bottom:4px;font:bold 11px system-ui,sans-serif;color:#ffcd77;background:rgba(0,0,0,.55);border-radius:6px;padding:0 4px;letter-spacing:.02em}
#inv-panel .iv-acc i img{width:100%;height:100%;object-fit:contain}
#inv-panel .iv-slot{position:relative;width:100%;height:100%;min-height:0;aspect-ratio:auto;box-sizing:border-box;border-radius:12px;border:3px solid #6b4a24;background:radial-gradient(#4a3018,#24160a);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;padding:2px;overflow:hidden}
#inv-panel .iv-slot.sel{outline:3px solid #fff;outline-offset:1px}
#inv-panel .iv-slot.iv-open{border-style:dashed;border-color:#4a3420;background:rgba(36,22,10,.55)}#inv-panel .iv-slot.iv-from{opacity:.35}#inv-panel .iv-slot.iv-over{outline:3px dashed #ffcd3c;outline-offset:1px}#inv-panel.iv-moving .iv-slot{cursor:copy}#inv-panel .iv-slot u{position:absolute;left:5px;top:2px;font:bold 11px system-ui,sans-serif;text-decoration:none;color:rgba(232,211,166,.55)}
.iv-menu{position:fixed;z-index:99999;min-width:150px;background:#24160a;border:2px solid #d9a441;border-radius:10px;padding:6px;display:flex;flex-direction:column;gap:4px;box-shadow:0 8px 24px rgba(0,0,0,.6)}.iv-menu .iv-mt{font-size:13px;color:#ffcd3c;padding:2px 4px 4px}.iv-menu button{background:#3d2a1c;color:#fff1d2;border:1px solid #6b4a24;border-radius:7px;padding:7px 10px;text-align:left;font:inherit;cursor:pointer}.iv-menu button:disabled{opacity:.45}
.iv-ghost{position:fixed;z-index:99999;pointer-events:none;width:72px;height:72px;transform:translate(-50%,-60%) scale(1.08);opacity:.9;box-shadow:0 8px 20px rgba(0,0,0,.6)}.iv-ghost{border-radius:12px;border:3px solid #6b4a24;background:radial-gradient(#4a3018,#24160a);display:flex;align-items:center;justify-content:center;overflow:hidden}.iv-ghost i{font-style:normal;font-size:30px;width:70%;aspect-ratio:1;display:flex;align-items:center;justify-content:center}.iv-ghost img{width:100%;height:100%;object-fit:contain}.iv-ghost span,.iv-ghost u{display:none}.iv-ghost b{position:absolute;right:4px;bottom:2px;font:bold 13px system-ui,sans-serif;color:#fff}
#inv-panel .iv-slot i{font-style:normal;font-size:32px;line-height:1;display:flex;align-items:center;justify-content:center;width:60%;aspect-ratio:1;flex:none}
#inv-panel .iv-slot i img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 2px rgba(0,0,0,.55));pointer-events:none}
#inv-panel .iv-slot span{font-size:13px;line-height:.95;color:#e8d3a6;text-align:center;max-width:100%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;min-height:1.9em}
#inv-panel .iv-slot b{position:absolute;right:4px;bottom:2px;font:bold 15px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000}
#inv-panel .iv-slot em{position:absolute;left:4px;top:2px;font:bold 12px system-ui,sans-serif;font-style:normal;color:#ffcd3c}
#inv-panel .iv-eq{position:absolute;top:2px;left:4px;font-style:normal;font-size:14px;color:#1b1206;background:#7be37b;border-radius:8px;padding:0 4px;z-index:1}
#inv-panel .iv-eqs{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:2px 0 8px;border-bottom:2px solid rgba(255,205,119,.3)}#inv-panel .iv-eqs>small{flex:1 1 100%;font-size:18px;color:#ffcd77;letter-spacing:.05em}#inv-panel .iv-eqs .iv-slot{width:84px;height:84px;min-height:84px;flex:none}#inv-panel .iv-eqs .iv-acc{width:60px;min-height:52px}#inv-panel .iv-eqs .iv-acc i{font-size:22px}#inv-panel .iv-eqs .iv-acc span{font-size:10px;min-height:0}#inv-panel .iv-slot.iv-eqslot{background:radial-gradient(#3a4a28,#18200c)}#inv-panel .iv-slot.iv-eqslot u{color:#bfe39a;font-size:10px}#inv-panel .iv-accs{display:flex;gap:6px;padding-left:6px;border-left:2px dashed rgba(191,227,154,.4)}#inv-panel .iv-slot i.iv-rk{position:absolute;right:4px;top:3px;width:auto;aspect-ratio:auto;display:block;font:bold 10px/1.3 system-ui,sans-serif;font-style:normal;color:#1b1206;border-radius:6px;padding:0 4px}
#inv-panel .iv-empty{grid-column:1/-1;text-align:center;font-size:24px;color:#cdb68c;padding:30px 0}
#inv-panel .iv-act{flex:none;max-height:min(36dvh,36vh,220px);overflow-y:auto;border-top:2px solid rgba(255,205,119,.35);padding:7px 14px 10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:21px;min-height:0}
#inv-panel .iv-act .t{flex:1 1 100%;font-size:20px}
#inv-panel .iv-act button{font:20px 'Just Another Hand',cursive;min-height:38px;padding:3px 13px 1px;border-radius:12px;border:2px solid #ffcd77;background:#7a4a10;color:#fff;cursor:pointer}
#inv-panel .iv-act button[disabled]{opacity:.45}
#inv-panel .iv-act input{font:18px system-ui,sans-serif;min-height:36px;width:120px;border-radius:10px;border:2px solid #ffcd77;background:#1a0f07;color:#fff;padding:0 8px}
#inv-panel .iv-act input.n{width:68px}
#inv-panel .iv-act small.iv-note{flex:1 1 100%;font-size:15px;color:#cdb68c;line-height:1.15;margin:0}
/* [v350 t1840u] controller focus */
html.pfp-pad #inv-panel .iv-slot.pad-focus,html.pfp-pad #inv-panel .iv-act button.pad-focus,html.pfp-pad #inv-panel .iv-tabs button.pad-focus,
#inv-panel .iv-slot:focus-visible,#inv-panel .iv-act button:focus-visible,#inv-panel .iv-tabs button:focus-visible{
  outline:3px solid #ffcd77 !important;outline-offset:2px !important;box-shadow:0 0 0 5px rgba(22,22,22,.75),0 0 16px 3px rgba(255,205,119,.7) !important;z-index:2}
#inv-panel .iv-slot{outline:none}#inv-panel .iv-act button,#inv-panel .iv-tabs button{outline:none}
@media (min-width:900px){#inv-panel .iv-grid{grid-template-columns:repeat(8,minmax(0,1fr));grid-auto-rows:84px}}
/* [v350 t1840u] phone portrait */
@media (max-width:640px){
  #inv-panel .iv-box{width:min(100vw - 12px,96vw);border-radius:14px}
  #inv-panel .iv-head{font-size:26px;padding:8px 10px 4px;gap:8px}
  #inv-panel .iv-head small{font-size:15px}
  #inv-panel .iv-x{width:40px;height:40px}
  #inv-panel .iv-tabs{padding:0 10px 4px;gap:4px;overflow-x:auto;-webkit-overflow-scrolling:touch}
  #inv-panel .iv-tabs button{font-size:18px;padding:3px 10px 1px;flex:none}
  #inv-panel .iv-grid{grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:78px;gap:6px;padding:6px 10px 8px}
  #inv-panel .iv-slot{border-width:2px}
  #inv-panel .iv-slot i{font-size:26px}
  #inv-panel .iv-slot span{font-size:11px}
  #inv-panel .iv-act{max-height:min(38dvh,38vh,240px);padding:6px 10px 8px;gap:5px}
  #inv-panel .iv-act .t{font-size:18px}
  #inv-panel .iv-act button{min-height:36px;padding:3px 11px 1px;font-size:18px}
  #inv-panel .iv-act small.iv-note{font-size:13px}
}
/* [v350 t1840u] phone landscape / short screens */
@media (max-height:520px){
  #inv-panel.on{align-items:stretch;padding:env(safe-area-inset-top,0px) 6px env(safe-area-inset-bottom,0px)}
  #inv-panel .iv-box{width:min(100vw - 10px,760px);height:calc(100dvh - 10px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));max-height:calc(100dvh - 10px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));border-radius:12px}
  #inv-panel .iv-head{font-size:22px;padding:6px 10px 2px;margin-bottom:0;gap:6px}
  #inv-panel .iv-head small{font-size:13px}
  #inv-panel .iv-x{width:36px;height:36px;font-size:18px}
  #inv-panel .iv-tabs{padding:0 10px 2px;margin-bottom:0;gap:4px;overflow-x:auto}
  #inv-panel .iv-tabs button{font-size:16px;padding:2px 9px 0;flex:none}
  #inv-panel .iv-eqs{gap:4px;padding:0 0 4px;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch}
  #inv-panel .iv-eqs>small{font-size:13px;padding:0;margin:0;line-height:1.1;flex:0 0 auto;white-space:nowrap}
  #inv-panel .iv-eqs .iv-slot{width:48px;height:48px;min-height:48px}
  #inv-panel .iv-eqs .iv-acc{width:40px;height:40px;min-height:40px}
  #inv-panel .iv-eqs .iv-acc i{font-size:16px}
  #inv-panel .iv-eqs .iv-slot u{font-size:8px}
  #inv-panel .iv-eqs .iv-slot span{font-size:9px;-webkit-line-clamp:1;min-height:0}
  #inv-panel .iv-accs{gap:4px;padding-left:4px}
  #inv-panel .iv-grid{flex:1 1 0;min-height:96px;overflow-y:auto;grid-template-columns:repeat(10,minmax(0,1fr));grid-auto-rows:52px;gap:4px;padding:4px 10px 6px}
  #inv-panel .iv-slot{border-width:2px;border-radius:8px;padding:1px}
  #inv-panel .iv-slot i{font-size:18px;width:50%}
  #inv-panel .iv-slot span{font-size:9px;min-height:1.1em;-webkit-line-clamp:1}
  #inv-panel .iv-act{flex:none;max-height:38dvh;overflow-y:auto;padding:4px 10px 6px;gap:4px}
  #inv-panel .iv-act .t{font-size:16px}
  #inv-panel .iv-act button{min-height:32px;padding:2px 9px 0;font-size:16px;border-radius:9px}
  #inv-panel .iv-act small.iv-note{font-size:12px}
  #inv-panel .iv-act input{min-height:30px;font-size:15px}
}
`;
// [inventory] equip = carry: Raul's raul/items-redo exports setCarriedWeapons({sword, musket}, src) from js/pirateGear.js (he owns the gr sync).
// Feature-checked: before his branch merges the export is missing and the old gear wear path runs instead. The id is the BASE (a SWORD_IDS /
// MUSKET_IDS id), the rarity is a stat layer only, so no new mesh ids are needed.
async function carry(slot, base, pv) {
  try { const G = await import('../pirateGear.js'); if (typeof G.setCarriedWeapons === 'function') { const cur = (typeof G.carriedWeapons === 'function' && G.carriedWeapons()) || {}; G.setCarriedWeapons({ sword: cur.sword ?? null, musket: cur.musket ?? null, [slot]: base }, 'inventory'); return; } } catch {}
  try { pv?.maps?.wear?.(`${slot}:${base}`); } catch {}
}
async function uncarry(slot, eq) { // [rare-equip] back to your WEAPON STORE pick (or the free default) for this slot
  try { const G = await import('../pirateGear.js'); if (typeof G.setCarriedWeapons !== 'function') return; const cur = G.carriedWeapons?.() || {}, st = G.storeWeapons?.() || {}, other = slot === 'sword' ? 'musket' : 'sword';
    G.setCarriedWeapons({ ...cur, [slot]: st[slot] ?? null }, eq[other] ? 'inventory' : 'profile'); } catch {} }
export function createInventory({ pvp, toast, treasure = null, nearbyPlayers = () => [] }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'inv-panel'; el.innerHTML = '<div class="iv-box"><div class="iv-head">🎒 <span class="iv-title">INVENTORY</span><small></small><span class="iv-slots" hidden></span><button class="iv-x" aria-label="Close">✕</button></div><div class="iv-tabs"></div><div class="iv-grid"></div><div class="iv-act"></div></div>';
  document.body.appendChild(el); for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'keydown' });
  const $ = (s) => el.querySelector(s); let data = { items: [], maps: [], flags: {}, equipped: {} }, mode = 'bag', tab = 'mine', sel = null, selI = -1, listings = [], busy = false;
  el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); }); $('.iv-x').onclick = () => close();
  const picker = createGivePick({ pvp, nearby: nearbyPlayers, toast }); // [give-dropdown]
  const slots = () => [...data.items.map(s => ({ key: s.item, qty: s.qty, tradeable: s.tradeable, info: itemInfo(s.item) })).filter(s => s.info),
    ...data.maps.map(m => ({ key: 'map:' + m.id, qty: 1, tradeable: 1, map: m, info: { ...itemInfo('map:' + m.id), rarity: m.tier, name: `${m.tier.toUpperCase()} MAP` } }))];
  const count = () => slots().reduce((a, s) => a + s.qty, 0);
  // [inv-arrange] BANKSY 9:40 PM "on inventory let them rearrange spots", modelled on QBCore qb-inventory (9:41 PM): fixed numbered
  // slots, drag onto an empty slot = move, onto another item = swap, onto the same item = stack, SHIFT-drag / the item menu's SPLIT =
  // split a stack into an empty slot, right-click / long-press = item menu (USE / EQUIP, SPLIT, GIVE: only actions the game already has).
  // No weight (BANKSY 9:42 PM: slots only). The server still owns every count: the slot layout is a per-pirate view saved on this
  // device (localStorage) that only splits the server's total of each item across slots, so no move can create or lose an item.
  // Selling / giving / equipping still go through the same server calls with the item key. HOTBAR hook: invSlots() / onSlotsChange().
  const ORDER_V = 'pfp_inv_slots_v1:', MIN_SLOTS = 20; let order = null, orderFor = '', moveFrom = -1, moveAmt = 0, dragged = false, splitAsk = false, splitTo = -1;
  const _slotFns = [];
  // [Emerly wstack] BANKSY 2:53 PM "make it so weapons can't stack in inventory": every sword / musket = its own slot (n 1). An old saved layout
  // with 'wpn:...' n>1 is split here into single slots (free slots first, else new slots at the end): only the VIEW changes, the server's
  // counts are the same, so nothing is ever lost. Non-weapons stack as before. &wstack=0 = the old stacking.
  const Q = typeof location === 'undefined' ? '' : location.search, WSTACK = wstackOn(Q), isW = (k) => typeof k === 'string' && k.startsWith('wpn:');
  const single = (k) => WSTACK && isW(k);
  // [Emerly eqslots] BANKSY 2:58 PM: the equipped sword + musket sit in their own EQUIPPED slots above the bag (drag out = unequip into that
  // bag slot, drag a matching weapon in = equip / swap, tap-then-tap on phone + pad). One copy of the equipped key leaves the bag view.
  // The EQUIPPED sword = the Sword Pit primary (same inv_equip / carry path as before). &eqslots=0 = the old ✓ badge in the bag.
  const EQS = !/[?&]eqslots=0(&|$)/.test(Q), ACC_ON = EQS && gunAccOn(Q), RANK_ON = muskRankOn(Q);
  const eqKey = (slot) => { const k = data.equipped?.[slot]; return k && slots().some(s => s.key === k) ? k : null; };
  let selE = '', accFor = ''; // the picked EQUIPPED slot ('sword' / 'musket' / 'acc:<sub>')
  const accWho = () => { const w = who(); if (accFor !== w) { accFor = w; loadGunAcc(w); } return w; };

  const accPip = (acc) => { if (!acc) return ''; const n = ['scope','bayonet','stock','horn'].filter((s) => acc[s]).length; return n ? `<b class="iv-accpip">${n}/4</b>` : ''; };
  const gunOfBag = (i) => { // match bag slot musket copy → gun instance (bag place, same item, by order among bag muskets)
    const k = order?.[i]?.k; if (!k || !k.startsWith('wpn:musket:')) return null;
    const bags = gunInstances().filter((g) => g.place === 'bag' && g.item === k);
    const prior = (order || []).slice(0, i).filter((e) => e?.k === k).length;
    return bags[prior] || bags[0] || null;
  };
  const eqGun = () => gunInstances().find((g) => g.place === 'equip') || null;

  const RK_BG = { rare: '#4fa8ff', epic: '#c070ff', legendary: '#ffcd3c' };
  const rk = (info) => RANK_ON && info?.kind === 'weapon' && info.slot === 'musket' && RK_BG[info.rarity] ? `<i class="iv-rk" style="background:${RK_BG[info.rarity]}">${info.rarity[0].toUpperCase()}</i>` : '';
  const qtyOf = (k) => slots().find(x => x.key === k)?.qty | 0;
  const freeBag = () => (order || []).findIndex(e => !e);
  const who = () => String(pvp()?.name || 'me').toLowerCase();
  const loadOrder = () => { const w = who(); if (order && orderFor === w) return order; orderFor = w;
    try { const v = JSON.parse(localStorage.getItem(ORDER_V + w) || '[]'); order = Array.isArray(v) ? v.map(e => e && typeof e.k === 'string' ? { k: e.k, n: Math.max(1, e.n | 0) } : null) : []; } catch { order = []; } return order; };
  const saveOrder = () => { try { let n = order.length; while (n && !order[n - 1]) n--; localStorage.setItem(ORDER_V + orderFor, JSON.stringify(order.slice(0, n))); } catch { /* private mode */ } for (const f of _slotFns) try { f(order.slice()); } catch {} };
  let view = []; // the last layout: slot index -> { s (slot item), n (qty shown in this slot) } | null
  function layout(list) { // the server's totals spread over the saved slots; leftovers go to that item's first slot, else the first empty one
    const o = loadOrder(), by = new Map(list.map(x => [x.key, x])), left = new Map(list.map(x => [x.key, x.qty]));
    if (EQS) for (const sl of ['sword', 'musket']) { const k = eqKey(sl); if (k && left.has(k)) left.set(k, left.get(k) - 1); } // [eqslots] it sits in EQUIPPED
    if (ACC_ON) { accWho(); for (const k of Object.values(gunAcc())) if (left.has(k)) left.set(k, left.get(k) - 1); } // [gunacc] fitted on the musket
    const out = o.map(e => { if (!e || !by.has(e.k)) return null; const r = left.get(e.k), n = Math.min(single(e.k) ? 1 : e.n, r); if (n <= 0) return null; left.set(e.k, r - n); return { s: by.get(e.k), n }; });
    for (const x of list) { let r = left.get(x.key); if (r <= 0) continue;
      if (single(x.key)) { for (; r > 0; r--) { const e = out.indexOf(null); if (e >= 0) out[e] = { s: x, n: 1 }; else out.push({ s: x, n: 1 }); } continue; } // [wstack] one slot each
      const f = out.findIndex(v => v && v.s.key === x.key); if (f >= 0) out[f].n += r; else { const e = out.indexOf(null); if (e >= 0) out[e] = { s: x, n: r }; else out.push({ s: x, n: r }); } }
    const n = Math.max(MIN_SLOTS, Math.ceil((out.filter(Boolean).length + 5) / 5) * 5, out.length); while (out.length < n) out.push(null);
    order = out.map(v => v ? { k: v.s.key, n: v.n } : null); view = out; return out;
  }
  // from slot a to slot b: empty = move (amt = split part), same item = stack, other item = swap (whole stacks only)
  function moveSlot(a, b, amt = 0) { if (a === b || !order?.[a]) return false; while (order.length <= b) order.push(null); const A = order[a], B = order[b], part = amt > 0 && amt < A.n ? amt : A.n;
    if (!B) { order[b] = { k: A.k, n: part }; if (part < A.n) A.n -= part; else order[a] = null; }
    else if (B.k === A.k && !single(A.k)) { B.n += part; if (part < A.n) A.n -= part; else order[a] = null; }
    else { if (part < A.n) return false; order[a] = B; order[b] = A; }
    saveOrder(); return true; }
  const shopTakes = (s) => mode === 'fish' ? s.info.kind === 'fish' : mode === 'antiques' ? s.info.kind !== 'fish' : true;
  const price = (s) => mode === 'fish' ? s.info.fish : mode === 'antiques' ? s.info.antiques : 0;
  const sellOn = () => mode === 'fish' ? !!data.flags.fish_sell : mode === 'antiques' ? !!data.flags.antiques_sell : false;
  // [inventory v209] battle.js reads these: the DB flags + the equipped weapons' rarity (after a reload too, once inv_state is read)
  function syncW(r) { if (typeof window === 'undefined') return; window.PFP_INV_FLAGS = r.flags || {}; const w = { ...(window.PFP_WEAPON_RARITY || {}) }; for (const [slot, k] of Object.entries(r.equipped || {})) { const i = itemInfo(k); if (i && (slot === 'sword' || slot === 'musket')) w[slot] = i.rarity || 'common'; } window.PFP_WEAPON_RARITY = w;
    if (!restored && r.ok) { restored = true; for (const [slot, k] of Object.entries(r.equipped || {})) { const i = itemInfo(k); if (i?.base && (slot === 'sword' || slot === 'musket')) carry(slot, i.base, pvp()); } } } // [rare-equip] after a reload your found weapon is back in hand / on your back, not only its stats
  let restored = false, legacyMigrated = false;
  async function migrateLegacyAcc() { // [v332] one-shot localStorage → server for equipped gun
    if (legacyMigrated || !ACC_ON) return; legacyMigrated = true;
    const eq = eqGun(); if (!eq || Object.keys(eq.acc || {}).length) return;
    const local = loadGunAcc(accWho()); const slots = Object.keys(local || {});
    if (!slots.length) return;
    for (const slot of slots) {
      const key = local[slot]; if (!key || qtyOf(key) <= 0) continue;
      try { const r = await pvp()?.inv?.call('gun_acc_set', { gid: eq.gid, slot, key }); if (r?.ok) applyLocalAcc(eq.gid, slot, key); } catch {}
    }
    try { localStorage.removeItem('pfp_gunacc_v1:' + accWho()); } catch {}
  }
  async function refresh() { const r = await pvp()?.inv?.call('inv_state'); if (r && r.ok) { data = r; syncW(r); if (ACC_ON) { setGunInstances(r.guns || []); const eq = (r.guns || []).find((g) => g.place === 'equip'); if (eq) { /* server is source of truth for equipped acc */ for (const a of GUN_ACC) setGunAcc(accWho(), a.slot, eq.acc?.[a.slot] || null); } else pruneGunAcc(accWho(), (k) => qtyOf(k) > 0); migrateLegacyAcc(); } } if (mode === 'market') { const m = await pvp()?.inv?.call('mkt_browse'); listings = m?.ok && Array.isArray(m.listings) ? sortListings(m.listings) : []; } render(); return r; }
  function render() {
    const title = { bag: 'INVENTORY', fish: 'FISH MARKET', antiques: 'TREASURE TRADER', market: 'MARKETPLACE' }[mode]; $('.iv-title').textContent = title;
    const bagState = { owner: !!data.owner, name: pvp()?.name };
    const haulUsed = countBackpackSlots(data.items || [], data.equipped || {});
    const meter = slotMeterText(haulUsed, bagState);
    const meterEl = $('.iv-slots');
    if (BAGCAP_ON && mode === 'bag') { meterEl.hidden = false; meterEl.textContent = meter.text; meterEl.className = 'iv-slots ' + meter.level; }
    else meterEl.hidden = true;
    $('.iv-head small').textContent = mode === 'bag' ? `${count()} items · ${meter.text} · tap one` : mode === 'market' ? (data.flags.market ? 'buy from pirates · list yours' : 'opens soon') : sellOn() ? 'tap an item to sell' : 'prices coming soon · BANKSY is setting them';
    $('.iv-tabs').innerHTML = mode === 'market' ? `<button data-t="browse" class="${tab === 'browse' ? 'on' : ''}">FOR SALE</button><button data-t="mine" class="${tab === 'mine' ? 'on' : ''}">SELL YOURS</button>` : '';
    $('.iv-tabs').querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.t; sel = null; render(); });
    const g = $('.iv-grid');
    if (mode === 'market' && tab === 'browse') {
      g.innerHTML = listings.length ? listings.map(l => { const i = itemInfo(l.item) || { icon: '❔', name: l.item, rarity: 'common' };
        return `<div class="iv-slot${sel === 'L' + l.id ? ' sel' : ''}" data-l="${l.id}" style="border-color:${RARITY_COLOR[i.rarity] || '#6b4a24'}"><em>${l.price.toLocaleString()}g</em>${icoHtml(l.item, i)}<span>${i.kind ? shortName(i) : i.name}</span><b>${l.qty > 1 ? '×' + l.qty : ''}</b></div>`; }).join('') : '<div class="iv-empty">nothing for sale yet</div>';
      g.querySelectorAll('[data-l]').forEach(d => d.onclick = () => { sel = 'L' + d.dataset.l; render(); });
    } else {
      const list = slots().filter(shopTakes); if (mode === 'fish' || mode === 'antiques') list.sort((a, b) => (price(a) - price(b)) || shortName(a.info).localeCompare(shortName(b.info))); // [v240] cheapest first (BANKSY's shop rule)
      g.innerHTML = list.length ? list.map(s => `<div class="iv-slot${sel === s.key ? ' sel' : ''}" data-k="${s.key}" style="border-color:${RARITY_COLOR[s.info.rarity] || '#6b4a24'}">${s.info.kind === 'weapon' && data.equipped?.[s.info.slot] === s.key ? '<i class="iv-eq" title="primary">✓</i>' : ''}${mode !== 'bag' && mode !== 'market' ? `<em>${price(s).toLocaleString()}g</em>` : ''}${icoHtml(s.key, s.info)}<span>${shortName(s.info)}</span><b>${s.qty > 1 ? '×' + s.qty : ''}</b></div>`).join('')
        : `<div class="iv-empty">${mode === 'fish' ? 'no fish yet · cast a line at Grandpa Gill\'s dock' : mode === 'bag' ? 'empty · dig treasure, fish, explore the island' : 'nothing this shop buys'}</div>`;
      if (mode === 'bag' && list.length) { el.classList.toggle('iv-moving', moveFrom >= 0); // [inv-arrange]
        const eqCell = (sl) => { const k = eqKey(sl), s = k && slots().find(x => x.key === k); const eg = sl === 'musket' ? eqGun() : null; const leg = s?.info?.rarity === 'legendary' ? ' iv-leg' : '';
          return `<div class="iv-slot iv-eqslot${s ? '' : ' iv-open'}${selE === sl ? ' sel' : ''}${leg}" data-e="${sl}"${s ? ` data-k="${k}"` : ''}${eg ? ` data-gid="${eg.gid}"` : ''} style="${s ? `border-color:${RARITY_COLOR[s.info.rarity] || '#6b4a24'}` : ''}"><u>${sl.toUpperCase()}</u>${s ? `${rk(s.info)}${icoHtml(k, s.info)}<span>${shortName(s.info)}</span>${accPip(eg?.acc || (sl==='musket'?gunAcc():null))}` : `<i>${sl === 'sword' ? '🗡️' : '🔫'}</i><span>store ${sl}</span>`}</div>`; };
        const accCell = (a) => { const k = gunAcc()[a.slot], i = k && itemInfo(k);
          return `<div class="iv-slot iv-eqslot iv-acc${i ? '' : ' iv-open'}${selE === 'acc:' + a.slot ? ' sel' : ''}" data-acc="${a.slot}"${i ? ` data-k="${k}"` : ''} title="${a.label}: ${a.fx}"><u>${a.label}</u>${i ? icoHtml(k, i) : '<i style="opacity:.35">＋</i>'}</div>`; };
        const eqRow = EQS ? `<div class="iv-eqs"><small>EQUIPPED · drag in to equip, out to unequip</small>${eqCell('sword')}${eqCell('musket')}${ACC_ON ? `<div class="iv-accs">${GUN_ACC.map(accCell).join('')}</div>` : ''}</div>` : '';
        g.innerHTML = eqRow + layout(list).map((v, i) => { const s = v?.s; const gInst = s?.info?.slot === 'musket' ? gunOfBag(i) : null; const leg = s?.info?.rarity === 'legendary' ? ' iv-leg' : '';
          return `<div class="iv-slot${s ? '' : ' iv-open'}${s && sel === s.key && selI === i ? ' sel' : ''}${moveFrom === i ? ' iv-from' : ''}${leg}"${s ? ` data-k="${s.key}"` : ''}${gInst ? ` data-gid="${gInst.gid}"` : ''} data-i="${i}" style="${s ? `border-color:${RARITY_COLOR[s.info.rarity] || '#6b4a24'}` : ''}"><u>${i + 1}</u>${s ? `${!EQS && s.info.kind === 'weapon' && data.equipped?.[s.info.slot] === s.key ? '<i class="iv-eq" title="primary">✓</i>' : ''}${rk(s.info)}${icoHtml(s.key, s.info)}<span>${shortName(s.info)}</span>${accPip(gInst?.acc)}<b>${v.n > 1 ? '×' + v.n : ''}</b>` : ''}</div>`; }).join('');
        g.querySelectorAll('[data-i]').forEach(d => d.onclick = () => { if (dragged) { dragged = false; return; } const i = +d.dataset.i;
          if (moveFrom === -2) { moveFrom = -1; const src = selE; selE = ''; dropOn({ e: src }, { i }); return; } // [eqslots] EQUIPPED -> this bag slot
          if (moveFrom >= 0) { const ok = moveSlot(moveFrom, i, moveAmt); if (!ok && order[i]) toast('SPLIT INTO AN EMPTY SLOT<br><small>or onto the same item</small>', 1800); moveFrom = -1; moveAmt = 0; if (ok) { sel = order[i]?.k || null; selI = i; } render(); return; }
          if (d.dataset.k) { sel = d.dataset.k; selI = i; selE = ''; render(); } });
        g.querySelectorAll('[data-e],[data-acc]').forEach(d => d.onclick = () => { if (dragged) { dragged = false; return; } const tg = d.dataset.e ? { e: d.dataset.e } : { e: 'acc:' + d.dataset.acc };
          if (moveFrom >= 0) { const from = moveFrom; moveFrom = -1; moveAmt = 0; dropOn({ i: from }, tg); return; } // tap-then-tap: bag item -> this EQUIPPED slot
          if (d.dataset.k) { sel = d.dataset.k; selI = -2; selE = tg.e; render(); } });
        g.oncontextmenu = (e) => { const d = e.target.closest?.('[data-k][data-i]'); if (!d) return; e.preventDefault(); itemMenu(+d.dataset.i, e.clientX, e.clientY); };
        dragSetup(g);
      } else { el.classList.remove('iv-moving'); g.querySelectorAll('[data-k]').forEach(d => d.onclick = () => { sel = d.dataset.k; render(); }); }
    }
    actions();
  }
  // [v335] BANKSY t1780u / t1783u / t1784u: GIVE TO A PIRATE for any item, weapons included (one copy; a musket's gid carries its fitted
  // attachments across, migration 049). Giving the last copy of your equipped weapon puts your store weapon back in your hands.
  function giveTo(s, k, gInst = null) {
    const wpn = s.info.kind === 'weapon';
    picker.open({ name: s.info.name, qty: k, ico: icoHtml(s.key, s.info), color: RARITY_COLOR[s.info.rarity] || '#6b4a24',
      give: (to) => run('inv_gift', { item: s.key, qty: k, to, ...(gInst?.gid ? { gid: gInst.gid } : {}) }, (r) => {
        if (wpn && (r.left | 0) === 0 && data.equipped?.[s.info.slot] === s.key) { const eq = { ...data.equipped }; delete eq[s.info.slot]; uncarry(s.info.slot, eq); window.PFP_WEAPON_RARITY = { ...(window.PFP_WEAPON_RARITY || {}), [s.info.slot]: 'common' }; }
        const mods = gInst?.acc ? Object.values(gInst.acc).filter(Boolean).length : 0;
        return `SENT ${k > 1 ? k + ' × ' : ''}${s.info.name}${mods ? ` (+${mods} MOD${mods > 1 ? 'S' : ''})` : ''} TO ${to.toUpperCase()}`; }) }); }
  function actions() {
    const a = $('.iv-act');
    if (sel && sel.startsWith('L')) { const l = listings.find(x => 'L' + x.id === sel); if (!l) { a.innerHTML = ''; return; } const i = itemInfo(l.item) || { name: l.item };
      a.innerHTML = `<div class="t">${i.name}${l.qty > 1 ? ' ×' + l.qty : ''} · <b>${l.price.toLocaleString()} gold</b> · from ${l.seller}</div>` + (l.mine ? '<button data-a="cancel">TAKE BACK</button>' : `<button data-a="buy"${data.flags.market ? '' : ' disabled'}>BUY</button>`);
      bind(a, { buy: () => run('mkt_buy', { listing: l.id }, `BOUGHT ${i.name}`), cancel: () => run('mkt_cancel', { listing: l.id }, 'BACK IN YOUR INVENTORY') }); return; }
    const s = slots().find(x => x.key === sel); if (!s) { a.innerHTML = mode === 'bag' ? '<div class="t">tap an item</div>' : ''; return; }
    if (mode === 'bag' && EQS && selI === -2 && selE) { // [eqslots] an EQUIPPED slot is picked: move it out (tap a bag slot) or unequip to the first free one
      const wq = selE === 'sword' || selE === 'musket'; // [v335] t1783u: an equipped sword / musket can be given straight from here
      a.innerHTML = `<div class="t">${s.info.name} <small>· equipped ${selE.startsWith('acc:') ? 'on your musket' : selE}</small></div><button data-a="eqout">MOVE TO BAG ⇄</button><button data-a="equnq">UNEQUIP</button>${wq ? `<button data-a="give"${!data.flags.gift ? ' disabled' : ''}>GIVE TO A PIRATE ▾</button>` : ''}`;
      bind(a, { eqout: () => { moveFrom = -2; render(); }, equnq: () => { const src = selE; selE = ''; dropOn({ e: src }, { i: freeBag() }); }, give: () => giveTo(s, 1, selE === 'musket' ? eqGun() : null) }); return; }
    const n = s.qty > 1 ? `<input class="n" type="number" min="1" max="${s.qty}" value="1" aria-label="quantity">` : '', locked = !s.tradeable;
    let h = `<div class="t">${s.info.name}${s.qty > 1 ? ' ×' + s.qty : ''} <small>· ${s.info.rarity}${locked ? (s.info.kind === 'weapon' ? ' · bought with gold · can give to pirates (not for market / salvage)' : ' · bought with gold: keep it, it can\'t be resold') : ''}</small></div>`;
    const slotN = mode === 'bag' && selI >= 0 && view[selI]?.s?.key === s.key ? view[selI].n : s.qty; // [inv-arrange] this slot's part of the stack
    if (mode === 'bag' && moveFrom >= 0) { a.innerHTML = `<div class="t">${moveAmt ? `SPLITTING ${moveAmt} × ` : 'MOVING '}${s.info.name} · tap ${moveAmt ? 'an empty slot (or the same item)' : 'a slot: empty = move, item = swap, same item = stack'}</div><button data-a="cancelmove">CANCEL</button>`; bind(a, { cancelmove: () => { moveFrom = -1; moveAmt = 0; render(); } }); return; }
    if (mode === 'bag' && splitAsk) { a.innerHTML = `<div class="t">SPLIT ${s.info.name} · how many of ${slotN}?</div><input class="sp" type="number" min="1" max="${slotN - 1}" value="${Math.max(1, slotN >> 1)}" aria-label="split amount"><button data-a="splitgo">SPLIT · PICK A SLOT</button><button data-a="cancelmove">CANCEL</button>`;
      bind(a, { splitgo: () => { const k = Math.max(1, Math.min(slotN - 1, +(a.querySelector('.sp').value || 1) | 0)); splitAsk = false; if (splitTo >= 0) { moveSlot(selI, splitTo, k); splitTo = -1; render(); return; } moveFrom = selI; moveAmt = k; render(); }, cancelmove: () => { splitAsk = false; splitTo = -1; render(); } }); a.querySelector('.sp')?.focus(); return; }
    if (mode === 'bag') { let note = ''; // [v350 t1839u] keep weapon buttons on one compact row; notes trail after GIVE
      h += `<button data-a="move">MOVE ⇄</button>${slotN > 1 && !single(s.key) ? '<button data-a="split">SPLIT</button>' : ''}`;
      if (ACC_ON && s.info.kind === 'gunacc') { h += `<button data-a="fit">FIT ${GUN_ACC.find(x => x.slot === s.info.acc)?.label || ''} ON MUSKET</button>`; note += `<small class="iv-note">${GUN_ACC.find(x => x.slot === s.info.acc)?.fx || ''}</small>`; }
      if (RANK_ON && s.info.kind === 'weapon' && s.info.slot === 'musket') { const up = RANK_UP[s.info.rarity], nx = RANKS[RANKS.indexOf(s.info.rarity) + 1], parts = qtyOf(PARTS_KEY), own = !!data.owner;
        h += up ? `<button data-a="rank"${(own || parts >= up.parts) && s.tradeable ? '' : ' disabled'}>RANK UP → ${nx.toUpperCase()} · ${own ? 'FREE' : `${up.gold.toLocaleString()}g + ${up.parts} 🔩`}</button>` : '<button disabled>MAX RANK</button>';
        h += `<button data-a="salvage"${s.tradeable ? '' : ' disabled'}>SALVAGE · +${SALVAGE_PARTS[s.info.rarity] | 0} 🔩</button>`;
        note += `<small class="iv-note">rank ${s.info.rarity} · upgrade tiers up to ${RANK_CAP[s.info.rarity]} apply · you have ${parts} musket parts</small>`; }
      if (s.map) h += '<button data-a="open">OPEN MAP</button>';
      if (s.info.kind === 'weapon') h += data.equipped[s.info.slot] === s.key ? `<button disabled>✓ PRIMARY ${s.info.slot.toUpperCase()}</button><button data-a="unequip">USE STORE ${s.info.slot.toUpperCase()}</button>` : `<button data-a="equip">USE AS PRIMARY ${s.info.slot.toUpperCase()}</button>`; // [rare-equip]
      h += `${single(s.key) || s.info.kind === 'weapon' ? '' : n}<button data-a="give"${!data.flags.gift ? ' disabled' : ''}>GIVE TO A PIRATE ▾</button>${note}`; } // [v335] t1783u + [v350 t1839u] notes after GIVE so buttons share one row
    else if (mode === 'market') h += `${n}<input class="pr" type="number" min="${MARKET.minPrice}" max="${MARKET.maxPrice}" placeholder="price" aria-label="price"><button data-a="list"${locked || !data.flags.market ? ' disabled' : ''}>LIST</button>`;
    else h += `${n}<button data-a="sell"${locked || !sellOn() ? ' disabled' : ''}>SELL · ${price(s).toLocaleString()}g each</button>`;
    a.innerHTML = h; const q = () => Math.max(1, Math.min(s.qty, +(a.querySelector('.n')?.value || 1) | 0));
    bind(a, { move: () => { moveFrom = selI >= 0 && order?.[selI]?.k === s.key ? selI : (order || []).findIndex(e => e?.k === s.key); moveAmt = 0; render(); }, // [inv-arrange] tap-then-tap (phones, controller A)
      split: () => { splitAsk = true; splitTo = -1; render(); },
      fit: () => dropOn({ i: selI }, { e: 'acc:' + s.info.acc }), // [gunacc] tap-to-equip (phone / pad)
      rank: () => run('inv_musk_rank', { item: s.key }, (r) => `RANKED UP · ${String(r.item || '').split(':')[3]?.toUpperCase() || ''} MUSKET`), // [musket-rank] server: gold + parts -> the next rarity (this one copy)
      salvage: () => run('inv_musk_salvage', { item: s.key }, (r) => `SALVAGED · +${r.parts | 0} MUSKET PARTS`),
      open: () => { close(); treasure?.openMap?.(s.map.id); },
      equip: () => run('inv_equip', { item: s.key }, (r) => { carry(r.slot, r.base, pvp()); window.PFP_WEAPON_RARITY = { ...(window.PFP_WEAPON_RARITY || {}), [r.slot]: r.rarity }; return 'EQUIPPED ' + s.info.name; }), // the look = the base (gear slot); the rarity stats: catalog weaponStats() (battle.js hook, see report)
      unequip: () => run('inv_unequip', { slot: s.info.slot }, (r) => { const eq = { ...data.equipped }; delete eq[r.slot]; uncarry(r.slot, eq); window.PFP_WEAPON_RARITY = { ...(window.PFP_WEAPON_RARITY || {}), [r.slot]: 'common' }; return 'BACK TO YOUR STORE ' + r.slot.toUpperCase(); }), // [rare-equip]
      give: () => { const wpn = s.info.kind === 'weapon'; giveTo(s, wpn ? 1 : q(), wpn && s.info.slot === 'musket' ? (selI >= 0 ? gunOfBag(selI) : null) : null); },
      sell: () => run('inv_sell', { item: s.key, qty: q(), shop: mode }, (r) => `SOLD · +${(r.gold | 0).toLocaleString()} GOLD${r.mult > 1 ? `<br><small>pet bonus ×${(+r.mult).toFixed(2)}</small>` : ''}`),
      list: () => run('mkt_list', { item: s.key, qty: q(), price: +(a.querySelector('.pr').value || 0) | 0 }, 'LISTED ON THE MARKETPLACE') });
  }
  // [eqslots + gunacc] one place for every EQUIPPED move. src/tgt: { i } bag slot | { e: 'sword' | 'musket' | 'acc:<sub>' }
  function dropOn(src, tgt) {
    const fromBag = src.i != null && src.i >= 0, k = fromBag ? order?.[src.i]?.k : (src.e?.startsWith('acc:') ? gunAcc()[src.e.slice(4)] : eqKey(src.e)), info = k && itemInfo(k);
    if (!info) { render(); return; }
    if (fromBag && tgt.e) { // bag -> an EQUIPPED slot: only the matching type
      if (tgt.e.startsWith('acc:')) { const sub = tgt.e.slice(4); if (info.kind !== 'gunacc' || info.acc !== sub) { toast(`ONLY A ${(GUN_ACC.find(x => x.slot === sub)?.label || 'MATCHING PART')} FITS THERE`, 1600); render(); return; }
        const eg = eqGun(); order[src.i] = null; saveOrder(); sel = null; selI = -1;
        if (eg?.gid) { run('gun_acc_set', { gid: eg.gid, slot: sub, key: k }, () => { applyLocalAcc(eg.gid, sub, k); setGunAcc(accWho(), sub, k); return `${info.name.toUpperCase()} FITTED`; }); return; }
        setGunAcc(accWho(), sub, k); toast(`${info.name.toUpperCase()} FITTED`, 1400); render(); return; }
      if (info.kind !== 'weapon' || info.slot !== tgt.e) { toast(`ONLY A ${tgt.e.toUpperCase()} FITS THERE`, 1600); render(); return; }
      const gInst = tgt.e === 'musket' ? gunOfBag(src.i) : null;
      const old = eqKey(tgt.e); order[src.i] = old ? { k: old, n: 1 } : null; saveOrder();
      sel = k; selI = -1;
      if (gInst?.gid) { run('gun_equip', { gid: gInst.gid }, (r) => { carry(r.slot || 'musket', info.base, pvp()); window.PFP_WEAPON_RARITY = { ...(window.PFP_WEAPON_RARITY || {}), musket: info.rarity }; const acc = r.acc || gInst.acc || {}; for (const a of GUN_ACC) setGunAcc(accWho(), a.slot, acc[a.slot] || null); return 'EQUIPPED ' + info.name; }); return; }
      run('inv_equip', { item: k }, (r) => { carry(r.slot, r.base, pvp()); window.PFP_WEAPON_RARITY = { ...(window.PFP_WEAPON_RARITY || {}), [r.slot]: r.rarity }; return 'EQUIPPED ' + info.name; }); return; }
    if (!fromBag && tgt.i != null) { // EQUIPPED -> the bag: needs a free bag slot
      const i = tgt.i >= 0 && !order?.[tgt.i] ? tgt.i : freeBag(); if (i < 0) { toast('BAG FULL<br><small>free a slot first</small>', 1800); render(); return; }
      order[i] = { k, n: 1 }; saveOrder();
      if (src.e.startsWith('acc:')) { const sub = src.e.slice(4); const eg = eqGun(); if (eg?.gid) { run('gun_acc_set', { gid: eg.gid, slot: sub, key: null }, () => { applyLocalAcc(eg.gid, sub, null); setGunAcc(accWho(), sub, null); return 'DETACHED'; }); return; } setGunAcc(accWho(), sub, null); render(); return; }
      run('inv_unequip', { slot: src.e }, (r) => { const eq = { ...data.equipped }; delete eq[r.slot]; uncarry(r.slot, eq); window.PFP_WEAPON_RARITY = { ...(window.PFP_WEAPON_RARITY || {}), [r.slot]: 'common' }; return 'BACK TO YOUR STORE ' + r.slot.toUpperCase(); }); return; }
    render(); }
  const bind = (a, fns) => a.querySelectorAll('[data-a]').forEach(b => b.onclick = () => fns[b.dataset.a]?.());
  const WHY = { 'one weapon at a time': 'GIVE ONE WEAPON AT A TIME', 'shop closed': 'THE SHOP ISN\'T BUYING YET', 'not enough': 'YOU DON\'T HAVE THAT MANY', 'slow down': 'SLOW DOWN A MOMENT', 'not to yourself': 'YOU CAN\'T GIVE YOURSELF THINGS', 'no such pirate': 'NO PIRATE BY THAT NAME',
    'name not unique': 'SEVERAL PIRATES HAVE THAT NAME', 'not enough gold': 'NOT ENOUGH GOLD', 'gone': 'ALREADY SOLD', 'your own listing': 'THAT\'S YOUR OWN LISTING', 'bad price': `PRICE ${MARKET.minPrice}-${MARKET.maxPrice.toLocaleString()} GOLD`, 'too many listings': `MAX ${MARKET.maxActive} LISTINGS`, 'market closed': 'THE MARKETPLACE OPENS SOON', 'gifts closed': 'GIFTS ARE OFF' };
  async function run(action, body, okMsg) { if (busy) return false; busy = true; // true = done ([give-dropdown] the picker closes on it)
    try { const r = await pvp()?.inv?.call(action, body); if (r && r.ok) { toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 2400); sel = null; await refresh(); if (action !== 'inv_equip') treasure?.refresh?.(); return true; }
      const why = WHY[r?.error] || 'THAT DIDN\'T WORK<br><small>check your connection</small>'; toast(why, 2200); return action === 'inv_gift' ? why : false; } // [gift-fix] the picker shows the reason (truthy string = failed)
    catch (e) { console.warn('[inv]', action, e); toast('THAT DIDN\'T WORK<br><small>check your connection</small>', 2200); return false; } finally { busy = false; } }
  // [inv-arrange] drag: mouse after 6 px (SHIFT held = split into an empty slot), touch after a 300 ms hold (a quick swipe still scrolls);
  // a touch hold released without moving = the item menu (the phone's right-click)
  let dr = null, menu = null;
  function dragSetup(g) { if (g._dragOn) return; g._dragOn = true;
    g.addEventListener('pointerdown', (e) => { const d = e.target.closest?.('[data-k][data-i], [data-k][data-e], [data-k][data-acc]'); if (!d || mode !== 'bag' || moveFrom >= 0 || e.button > 0) return; menuClose();
      dr = { id: e.pointerId, d, i: d.dataset.i != null ? +d.dataset.i : -2, e: d.dataset.e || (d.dataset.acc ? 'acc:' + d.dataset.acc : ''), x: e.clientX, y: e.clientY, on: false, held: false, shift: e.shiftKey, touch: e.pointerType !== 'mouse', t: 0, over: null };
      if (dr.touch) dr.t = setTimeout(() => { if (dr) { dr.held = true; d.classList.add('iv-over'); navigator.vibrate?.(15); } }, 300); });
    addEventListener('pointermove', (e) => { if (!dr || e.pointerId !== dr.id) return; const m = Math.hypot(e.clientX - dr.x, e.clientY - dr.y);
      if (!dr.on) { if (dr.touch && !dr.held) { if (m > 10) cancel(); return; } if (m < (dr.touch ? 12 : 6)) return; dr.d.classList.remove('iv-over'); start(e.clientX, e.clientY); }
      move(e.clientX, e.clientY); });
    addEventListener('pointerup', (e) => { if (!dr || e.pointerId !== dr.id) return;
      if (dr.on) { const ov = dr.over, to = ov?.dataset.i != null ? +ov.dataset.i : -1, from = dr.i, sh = dr.shift, srcE = dr.e, tgE = ov?.dataset.e || (ov?.dataset.acc ? 'acc:' + ov.dataset.acc : ''); dragged = true; setTimeout(() => { dragged = false; }, 0); cancel();
        if (srcE || tgE) { if (srcE && to >= 0) dropOn({ e: srcE }, { i: to }); else if (!srcE && tgE) dropOn({ i: from }, { e: tgE }); else render(); return; } // [eqslots]
        if (to >= 0 && to !== from) { if (sh && (order[from]?.n || 0) > 1 && (!order[to] || order[to].k === order[from].k)) { sel = order[from].k; selI = from; splitAsk = true; splitTo = to; } // SHIFT-drag: ask how many
          else if (moveSlot(from, to)) { sel = order[to]?.k || null; selI = to; } }
        render(); }
      else if (dr.held && dr.e) { cancel(); } // [eqslots] a hold on an EQUIPPED slot = nothing (tap picks it)
      else if (dr.held) { const i = dr.i, x = e.clientX, y = e.clientY; dragged = true; setTimeout(() => { dragged = false; }, 0); cancel(); itemMenu(i, x, y); }
      else cancel(); });
    addEventListener('pointercancel', (e) => { if (dr && e.pointerId === dr.id) { cancel(); render(); } });
    g.addEventListener('touchmove', (e) => { if (dr?.held || dr?.on) e.preventDefault(); }, { passive: false }); // no grid scroll while holding / dragging
  }
  function start(x, y) { dr.on = true; const gh = dr.d.cloneNode(true); gh.classList.add('iv-ghost'); gh.classList.remove('sel', 'iv-over'); document.body.appendChild(gh); dr.gh = gh; dr.d.classList.add('iv-from'); move(x, y); }
  function move(x, y) { dr.gh.style.left = x + 'px'; dr.gh.style.top = y + 'px'; const t = document.elementFromPoint(x, y)?.closest?.('#inv-panel [data-i], #inv-panel [data-e], #inv-panel [data-acc]') || null;
    if (t !== dr.over) { dr.over?.classList.remove('iv-over'); dr.over = t; t?.classList.add('iv-over'); } }
  function cancel() { if (!dr) return; clearTimeout(dr.t); dr.gh?.remove(); dr.over?.classList.remove('iv-over'); dr.d.classList.remove('iv-from', 'iv-over'); dr = null; }
  // the item menu: the same buttons the action bar already has for this item (no new actions)
  function itemMenu(i, x, y) { const v = view[i]; if (!v) return; sel = v.s.key; selI = i; splitAsk = false; render(); menuClose();
    const acts = [...$('.iv-act').querySelectorAll('button[data-a]')].filter(b => b.dataset.a !== 'move'); if (!acts.length) return;
    const LBL = { open: 'USE · OPEN MAP', equip: 'EQUIP', unequip: 'UNEQUIP', split: 'SPLIT', give: 'GIVE…' };
    menu = document.createElement('div'); menu.className = 'iv-menu'; menu.innerHTML = `<div class="iv-mt">${v.s.info.name}${v.n > 1 ? ' ×' + v.n : ''}</div>` + acts.map((b, k) => `<button data-m="${k}"${b.disabled ? ' disabled' : ''}>${LBL[b.dataset.a] || b.textContent}</button>`).join('');
    document.body.appendChild(menu); const r = menu.getBoundingClientRect(); menu.style.left = Math.max(6, Math.min(innerWidth - r.width - 6, x)) + 'px'; menu.style.top = Math.max(6, Math.min(innerHeight - r.height - 6, y)) + 'px';
    menu.querySelectorAll('[data-m]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const t = acts[+b.dataset.m]; menuClose(); t?.click(); });
    menu.addEventListener('pointerdown', (e) => e.stopPropagation()); setTimeout(() => addEventListener('pointerdown', menuClose, { once: true }), 0); }
  function menuClose() { menu?.remove(); menu = null; }
  function open(m = 'bag') { mode = m; tab = m === 'market' ? 'browse' : 'mine'; sel = null; selI = -1; moveFrom = -1; moveAmt = 0; splitAsk = false; menuClose(); el.classList.add('on'); render(); refresh(); }
  function close() { picker.close(); cancel(); menuClose(); moveFrom = -1; splitAsk = false; el.classList.remove('on'); }
  // [shop-crash] 'pfp-shop' is shared: js/islandShop.js (Pet Store / Crew Shop / gear / weapon shops) fires it with { open, vendor } on EVERY
  // open AND close. Only the plaza shop triggers (js/island/areas/invShops.js) send { shop }; anything else used to pop the INVENTORY over the shop.
  window.addEventListener('pfp-shop', (e) => { const m = e.detail?.shop; if (m === 'fish' || m === 'antiques' || m === 'market') open(m); });
  // island earnings -> the server (it decides what lands in the bag): a reeled-in fish (server-rolled species), an idol shard / river pearl
  window.addEventListener('pfp-catch', async () => { const r = await pvp()?.inv?.call('inv_fish'); if (r?.ok) { const i = itemInfo(r.item); setTimeout(() => toast(`${i.icon} ${i.name.toUpperCase()} · IN YOUR INVENTORY`, 2000), 2600); refresh(); } });
  // [fish2] the fishing dock's server calls (js/island/areas/fishing2.js): it shows the fish the SERVER put in the bag (its own catch card, no toast here)
  window.addEventListener('pfp-fish', async (e) => { const d = e.detail || {}; if (!['inv_fish', 'inv_fish_bite', 'inv_fish_land'].includes(d.action)) return d.done?.(null);
    let r = null; try { r = await pvp()?.inv?.call(d.action, d.body || {}); } catch { r = null; } d.done?.(r || null); if (r?.ok && d.action !== 'inv_fish_bite') refresh(); });
  window.addEventListener('pfp-find', async (e) => { const r = await pvp()?.inv?.call('inv_find', e.detail || {}); if (r?.ok) refresh(); });
  return { invSlots: () => (view || []).map(v => v ? { key: v.s.key, qty: v.n } : null), onSlotsChange: (f) => { _slotFns.push(f); }, // [inv-arrange] HOTBAR hook (not built): slot i -> item; fires on every move
    open, close, refresh, get isOpen() { return el.classList.contains('on'); }, get count() { return count(); }, get data() { return data; }, slots, haulUsed: () => countBackpackSlots(data.items || [], data.equipped || {}), isOwnerBag: () => isUnlimitedBag({ owner: !!data.owner, name: pvp()?.name }), render, _setData(d) { data = { ...data, ...d }; render(); }, _setListings(l) { listings = sortListings(l); render(); } };
}
export const INV_FLAGS = FLAGS;
// [v240] every shop list cheapest first: the Marketplace FOR SALE grid by price, then oldest listing first (the server sent newest first)
export const sortListings = (l) => [...l].sort((a, b) => ((+a.price || 0) - (+b.price || 0)) || ((+a.id || 0) - (+b.id || 0)));
