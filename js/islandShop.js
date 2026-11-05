// [Timothy] PUMPFUN PIRATES · ISLAND SHOP panel. [v102 live, Emerly] the REAL provider comes from js/pvp.js (setShopProvider): every
// buy goes to the `pvp` Edge Function (shop_buy), which checks price, goal, gold and ownership server-side. The mock stays for tests.
// Self-contained 2D panel. Hooks for Raul's on-foot island (js/island/main.js footPrompt -> foot.activate(q) returns q.id):
//   openShop({ vendor: 'shop' | 'stall_red' | 'stall_blue', tab: 'skins' | 'gear', slot?, item? }) -> true if it opened
//   closeShop()            isShopOpen()  (the island's prompt stays hidden while this is true, like its panel.sym)
//   setShopProvider(p)     data source: p.load() / p.buy(kind, id) / p.equip(kind, id) -> Promise<state>. Milestone 1 ships
//                          the MOCK provider only; the real one calls the `pvp` Edge Function (shop_state / shop_buy / shop_equip)
//                          and the SERVER decides every purchase (price, goal, gold, owned): see shop/PLAN.md.
// Events: 'pfp-shop' { open: true|false, vendor } on window. Off on the crypto-free portal builds (itch.io / Newgrounds).
import { SKIN_ITEMS, GEAR_ITEMS, GEAR_SLOTS, VENDORS, STORE_HIDDEN, CAPTAIN_DEFAULTS, HAT_SWATCHES, gearKey, goalProgress, fmtGoal, fmtGold, liveGoal, CREW_ITEMS, CREW_SLOT_LABELS, PET_RARITY, WEAPON_ITEMS, SWORD_FREE, MUSKET_FREE, sortByPrice } from './shopCatalog.js';
import { CREW_LOOK, CREW_DEFAULT, setCrewLoadout, getCrewLoadout, crewGear } from './crewLoadout.js'; // [Timothy] CREW SHOP: the crew's own loadout (gear.crewhat / gear.crewoutfit)
import { goalStats, onGoalStats, goalCardHtml, goalRowsHtml } from './shopGoals.js'; // [Timothy] goal progress (cards, detail, profile)
import { ON_PORTAL } from './config.js';
import { gearThumbEl, gearLive } from './gearThumbs.js'; // [Timothy] real 3D card art (the v4 pirate wearing the item)
import { getLocalGear, setLocalGear, CAPE_SWATCHES } from './pirateGear.js';
import { openGearColorPicker } from './gearColorPicker.js';
import { boostOf, boostChipHtml, boostChips, boostsFor, currentBoosts, BOOST_STATS, BOOST_MODE, COMBAT_CAP, ARENA_WEAPON_BOOSTS, fmtPct, statPreview } from './boosts.js'; // [Emerly] ITEM SKILL BOOSTS: chips, detail, totals

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const shopFlag = () => !ON_PORTAL; // [v102] live everywhere except the crypto-free portal builds (itch.io / Newgrounds)

// ---------- MOCK provider (applies the same rules the server will: not owned, goal met, enough gold) ----------
export function mockProvider(seed = {}) {
  const st = {
    source: 'mock', owner: false, gold: 3400,
    stats: { kills: 38, deaths: 6, botKills: 120, harborKills: 412, bossKills: 64, goldEarned: 23450, sqWins: 3, bestStreak: 4 },
    owned: { skins: ['classic', 'blood', 'seagreen', 'midnight'], gear: ['hat:none', 'outfit:shirtless', 'eyes:plain', 'parrot:none', 'hook:none', 'hat:bandana', 'outfit:tank'] },
    equipped: { skin: 'midnight', gear: { ...CAPTAIN_DEFAULTS, hat: 'bandana', eyes: 'plain', ...CREW_DEFAULT } },
    ...seed,
  };
  const clone = () => JSON.parse(JSON.stringify(st));
  const find = (kind, id) => kind === 'skin' ? SKIN_ITEMS.find(i => i.id === id) : [...GEAR_ITEMS, ...CREW_ITEMS, ...WEAPON_ITEMS].find(i => gearKey(i) === id);
  return {
    state: st,
    load: async () => clone(),
    async crewCapeColor(i, k = 'crewcapeColor') { st.equipped.gear[k] = i | 0; return clone(); },   // [v6-store-clothes]
    async buy(kind, id) {
      const it = find(kind, id), list = kind === 'skin' ? st.owned.skins : st.owned.gear;
      if (!it) return { ok: false, error: 'unknown item', state: clone() };
      if (st.owner || list.includes(id)) return { ok: false, error: 'already owned', state: clone() };
      const g = goalProgress(liveGoal(it), st.stats); if (g && !g.done) return { ok: false, error: 'goal not reached', state: clone() };
      if (st.gold < it.price) return { ok: false, error: 'not enough gold', state: clone() };
      st.gold -= it.price; list.push(id); await new Promise(r => setTimeout(r, 250));
      return { ok: true, state: clone() };
    },
    async equip(kind, id) {
      if (kind === 'skin') { if (st.owner || st.owned.skins.includes(id)) st.equipped.skin = id; }
      else if (st.owner || st.owned.gear.includes(id) || find(kind, id)?.price === 0) { const [slot, gid] = id.split(':'); st.equipped.gear[slot] = gid; }
      return clone();
    },
  };
}

let provider = null, state = null, open = false, view = { vendor: 'shop', tab: 'skins', slot: 'hat', sel: null }, root = null, skinMod = null;
export const setShopProvider = (p) => { provider = p; state = null; };
export const getShopProvider = () => provider; // [dock-skin] the berth skin picker equips through the same provider
export const isShopOpen = () => open;
// [Timothy] the Solo / Squads split for DIAMOND: the provider's state.modes if it has one, else js/shopGoals.js (the server's
// shop view once it carries `modes`, else this device's display-only counter). Re-draw when a server view lands while open.
const modesNow = () => state?.modes || goalStats().modes;
onGoalStats(() => { if (open && state) render(); });

// ---------- previews ----------
const SKIN_FALLBACK = { classic: ['#2b1d14', '#161616', '#ffcd77'], blood: ['#3a1a14', '#c4161c', '#ffcd77'], seagreen: ['#3a2a1c', '#0d1610', '#4ee37a'], midnight: ['#141414', '#0b0b0b', '#c9d4e0'],
  coral: ['#2f5a52', '#ff8c75', '#ffb3a3'], storm: ['#4a5058', '#dfe6ee', '#9fdcff'], kraken: ['#3a2440', '#1c1028', '#b07cff'], commodore: ['#3b2a1a', '#e8e2d4', '#ffcd77'],
  golden: ['#b8862b', '#ffd46b', '#fff1b0'], ghost: ['#24302a', 'rgba(140,255,190,.55)', '#5cff8f'], admiral: ['#f2f2f2', '#ffffff', '#ffcd77'], flaming: ['#231612', '#c23a0e', '#ff8a2a'], diamond: ['#22309a', '#3d5cd0', '#8fc8ff'] };
function skinThumb(id) {
  try { if (skinMod) { const c = skinMod.skinSwatch(skinMod.pvpSkin(id), 150, 76); c.classList.add('ishop-sw'); return c; } } catch {}
  const [h, s, t] = SKIN_FALLBACK[id] || SKIN_FALLBACK.classic, d = document.createElement('div'); d.className = 'ishop-sw';
  d.innerHTML = `<svg viewBox="0 0 150 76"><rect width="150" height="76" fill="#0e1a20"/><rect x="45" y="4" width="60" height="42" fill="${s}"/><rect x="45" y="2" width="60" height="3" fill="${t}"/><path d="M9 47H141L120 72H30Z" fill="${h}" stroke="#161616" stroke-width="2"/><rect x="9" y="45" width="132" height="3" fill="${t}"/></svg>`;
  return d;
}
const COLS = { coat: '#c4161c', accent: '#ffcd77' };
function svgThumb(it) { // the painted fallback (only shown until the real render / pre-baked PNG is in)
  const t = it.tint || {}, c1 = t.body || t.metal || (t.cloth ? COLS.coat : '#161616'), a = '#ffcd77';
  const art = {
    hat: { none: `<circle cx="50" cy="44" r="18" fill="#d9a074"/><text x="50" y="82" text-anchor="middle" font-size="12" fill="#fff8">bare head</text>`,
      bandana: `<circle cx="50" cy="48" r="18" fill="#d9a074"/><path d="M30 44Q50 18 70 44Z" fill="${COLS.coat}"/><path d="M68 40l14 6-12 4z" fill="${COLS.coat}"/>`,
      tricorn: `<circle cx="50" cy="52" r="17" fill="#d9a074"/><path d="M18 40L50 22 82 40 50 46Z" fill="#161616"/><path d="M22 40L50 44 78 40" stroke="${a}" stroke-width="3" fill="none"/>`,
      bicorne: `<circle cx="50" cy="54" r="16" fill="#d9a074"/><path d="M14 42Q50 0 86 42Q50 34 14 42Z" fill="#161616"/><path d="M16 41Q50 33 84 41" stroke="${a}" stroke-width="3" fill="none"/><circle cx="50" cy="28" r="5" fill="#fff"/>` },
    outfit: { shirtless: `<path d="M30 30h40v48H30z" fill="#d9a074"/><rect x="30" y="66" width="40" height="5" fill="${a}"/>`,
      tank: `<path d="M30 30h40v48H30z" fill="#d9a074"/><path d="M36 30h28v48H36z" fill="${COLS.coat}"/>`,
      tshirt: `<path d="M22 32l12-6h32l12 6-6 14-6-3v35H34V43l-6 3z" fill="${COLS.coat}"/><circle cx="50" cy="50" r="7" fill="#fff"/>`,
      coat: `<path d="M24 28h52l4 52H20z" fill="${COLS.coat}"/><path d="M50 28v52" stroke="${a}" stroke-width="4"/><path d="M24 28h52" stroke="${a}" stroke-width="4"/>` },
    eyes: { plain: `<circle cx="50" cy="48" r="26" fill="#d9a074"/><circle cx="41" cy="45" r="3.5" fill="#161616"/><circle cx="59" cy="45" r="3.5" fill="#161616"/>`,
      eyepatch: `<circle cx="50" cy="48" r="26" fill="#d9a074"/><circle cx="41" cy="45" r="3.5" fill="#161616"/><path d="M24 34L76 52" stroke="#161616" stroke-width="2.5"/><ellipse cx="60" cy="46" rx="9" ry="8" fill="#161616"/>`,
      sunglasses: `<circle cx="50" cy="48" r="26" fill="#d9a074"/><rect x="31" y="40" width="16" height="10" rx="3" fill="#161616"/><rect x="53" y="40" width="16" height="10" rx="3" fill="#161616"/><rect x="47" y="42" width="6" height="2.5" fill="${a}"/>`,
      laser: `<circle cx="50" cy="50" r="26" fill="#d9a074"/><path d="M18 46h64" stroke="#1b1b1f" stroke-width="6"/><rect x="26" y="36" width="48" height="22" rx="5" fill="#2b2e36"/><rect x="30" y="40" width="40" height="14" rx="3" fill="#0d0f14"/><rect x="36" y="50" width="28" height="2.5" fill="#38e1ff"/>` },
    parrot: { none: `<path d="M20 70h60" stroke="#8a5a2b" stroke-width="5"/><text x="50" y="50" text-anchor="middle" font-size="12" fill="#fff8">empty perch</text>`,
      _: `<path d="M20 74h60" stroke="#8a5a2b" stroke-width="5"/><ellipse cx="50" cy="50" rx="14" ry="20" fill="${c1}"/><circle cx="50" cy="28" r="11" fill="${c1}"/><path d="M58 26l9 4-9 4z" fill="#ffcd77"/><circle cx="53" cy="25" r="2" fill="#161616"/><path d="M44 66l-6 12M52 66l4 12" stroke="${c1}" stroke-width="5"/>` },
    hook: { none: `<path d="M38 24h24v30H38z" fill="#d9a074"/><text x="50" y="80" text-anchor="middle" font-size="12" fill="#fff8">both hands</text>`,
      _: `<rect x="38" y="16" width="24" height="18" rx="3" fill="#6b4527"/><path d="M50 34v18a14 14 0 1 1-14 14" stroke="${c1}" stroke-width="6" fill="none" stroke-linecap="round"/>` },
    map: { _: `<path d="M18 22l20-6 24 6 20-6v62l-20 6-24-6-20 6z" fill="#e8d6a8" stroke="#6b4527" stroke-width="2"/><path d="M30 60q12-20 24-6t14-22" stroke="#6b4527" stroke-dasharray="4 3" fill="none" stroke-width="2"/><path d="M62 26l8 8M70 26l-8 8" stroke="#c4161c" stroke-width="3"/>` },
  }[it.slot] || {};
  const d = document.createElement('div'); d.className = 'ishop-sw gear';
  d.innerHTML = `<svg viewBox="0 0 100 90">${art[it.id] || art._ || ''}</svg>`; return d;
}
// [Timothy] BANKSY: "Make sure in clothes shop all items render as real items": every gear card is the REAL item on Raul's v4
// pirate (js/gearThumbs.js: offscreen render, cached, one per frame), hats in your hat colour, clothes in your ship skin's colours.
// The pre-baked PNG shows while it renders; the painted SVG only if both fail. The detail pane turns it slowly (live preview).
const thumbOpts = () => { const g = getLocalGear(); return { skin: state?.equipped?.skin || 'classic', hatColor: (state?.equipped?.gear?.hatColor ?? g.hatColor) | 0, hookSide: g.hookSide, legSide: g.legSide, skinColor: g.skinColor | 0, hairColor: g.hairColor | 0, body: g.body | 0, eyeColor: g.eyeColor | 0, capeColor: g.capeColor | 0, pantsColor: g.pantsColor | 0, bootsColor: g.bootsColor | 0 }; };
// [Timothy] CREW SHOP items draw with the player item of the same id (it.base) on a CREW MEMBER (CREW_LOOK), hat in its own colour
// a crew HAT is shown over the uniform tank, crew CLOTHES under the uniform bandana (a crew member in the default uniform)
const optsFor = (it) => it.crew ? { ...thumbOpts(), ...CREW_LOOK, hatColor: it.slot === 'crewhat' && it.tint?.hatColor ? state?.equipped?.gear?.crewhatColor | 0 : 0, eyeColor: 0, capeColor: state?.equipped?.gear?.crewcapeColor | 0, pantsColor: state?.equipped?.gear?.crewpantsColor | 0, bootsColor: state?.equipped?.gear?.crewbootsColor | 0,   // [Raul gear colours] crew hats in the crew's hat colour
  wear: it.slot === 'crewhat' ? { outfit: CREW_DEFAULT.crewoutfit } : { hat: CREW_DEFAULT.crewhat }, png: `${it.slot}_${it.id}` } : it.maleOnly ? { ...thumbOpts(), body: 0 } : thumbOpts();   // [Raul shop2 fixes] beards: shown on a male pirate (female bodies don't draw them)
function gearThumb(it, live = false, extra = null) {
  if (it.weapon) { // [Timothy] WEAPON STORE: a pre-rendered v5 pirate holding the weapon (tools/battle/weapon_thumbs.py, local three.js render)
    const d = document.createElement('div'); d.className = 'ishop-sw gear real3d weapon'; const img = new Image(); img.alt = ''; img.decoding = 'async';
    img.className = 'gear-thumb'; img.src = new URL(`../assets/pirates/thumbs/weapon_${it.slot}_${it.id}.png`, import.meta.url).href; d.append(img); return d; }
  const base = it.base ? { ...it, slot: it.base } : it, sl = base.slot;
  const d = svgThumb(base); d.classList.add('real3d'); if (it.crew) d.classList.add('crew'); const svg = d.firstElementChild;
  if (live) { const cv = document.createElement('canvas'); cv.className = 'gear-live'; d.append(cv); gearLive(cv, sl, it.id, extra ? { ...optsFor(it), ...extra } : optsFor(it)); if (svg) svg.style.display = 'none'; return d; }
  const img = gearThumbEl(sl, it.id, optsFor(it)); img.addEventListener('load', () => { if (svg) svg.style.display = 'none'; img.style.display = ''; });
  img.style.display = 'none'; d.append(img); return d;
}
addEventListener('pfp-gear-local', () => { if (open && (view?.tab === 'gear' || view?.tab === 'shoes') && !document.querySelector('.pfp-hatcolor')) render(); }); // a new hat colour / side / skin / hair: redraw the cards (cached)

// the card's real render (skinPreview) once it exists, else the painted swatch
function realOr(id) {
  const src = root && root.querySelector(`.ishop-card[data-id="${id}"] canvas.sk-real`); if (!src) return skinThumb(id);
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.className = 'sk-real'; c.getContext('2d').drawImage(src, 0, 0);
  const w = document.createElement('div'); w.className = 'ishop-sw real'; w.append(c); return w;
}
setInterval(() => { if (!open || view.tab !== 'skins' || !view.sel) return; const d = root.querySelector('.ishop-detail > .ishop-sw');
  if (d && !d.classList.contains('real') && root.querySelector(`.ishop-card[data-id="${view.sel}"] canvas.sk-real`)) d.replaceWith(realOr(view.sel)); }, 600);

// ---------- item model ----------
const TAB_SLOT = { swords: 'sword', muskets: 'musket' };
export const tabSlots = (V, tab) => tab === 'shoes' ? (V.shoeSlots || []) : tab === 'gear' || tab === 'wardrobe' ? V.slots : [];   // [v6-store-clothes] CHANGING ROOM = the same chips   // [V6 store] the SHOES & PANTS tab's chips
export const tabForSlot = (V, slot) => V.shoeSlots?.includes(slot) && V.tabs.includes('shoes') ? 'shoes' : null; // [Timothy] WEAPON STORE tabs: one gear slot each
const itemsFor = () => sortByPrice(view.tab === 'skins' ? SKIN_ITEMS.map(it => ({ kind: 'skin', key: it.id, it, name: it.name }))
  : TAB_SLOT[view.tab] ? WEAPON_ITEMS.filter(it => it.slot === TAB_SLOT[view.tab]).map(it => ({ kind: 'gear', key: gearKey(it), it, name: it.label }))
  : [...GEAR_ITEMS, ...CREW_ITEMS].filter(it => it.slot === view.slot && !(view.vendor === 'clothes' && STORE_HIDDEN.has(gearKey(it)))   /* [V6 store] clothes BOOTS tab = the V6 shoes only */).map(it => ({ kind: 'gear', key: gearKey(it), it, name: it.label })), x => x.it.price); // [v157] cheapest first; [hide-shoes] Clothes Store hides boots
const eqGear = (slot) => state.equipped.gear?.[slot] ?? (slot === 'sword' ? SWORD_FREE : slot === 'musket' ? MUSKET_FREE : CREW_DEFAULT[slot]); // [Timothy] a state without the crew slots (older server) = the crew uniform
function statusOf(x) {
  const g = goalProgress(liveGoal(x.it), state.stats);
  // [prestige] a prestige grant (GOLDEN P1 / DIAMOND P2) is owned once that prestige is reached; other price-0 items are always free
  const owned = state.owner || (x.it.price === 0 && (x.it.grant !== 'prestige' || !!g?.done)) || (x.kind === 'skin' ? state.owned.skins : state.owned.gear).includes(x.key)
    || (x.it.crew && x.it.base && VENDORS.crew.dress && state.owned.gear.includes(`${x.it.base}:${x.it.id}`));   // [v6-store-clothes] CREW ROOM: own it = your crew can wear it
  const eq = x.kind === 'skin' ? state.equipped.skin === x.key : eqGear(x.it.slot) === x.it.id;
  if (x.it.soon && !state.owner) return { k: 'soon', owned: false, g: null }; // [v102] not on sale yet: never sold, never equipped ([Timothy] the owner owns + equips everything)
  if (eq) return { k: 'equipped', owned, g }; if (owned) return { k: 'owned', owned, g };
  if (x.it.crew && VENDORS.crew.dress) return { k: 'needbuy', owned: false, g: null };   // [v6-store-clothes] never sold twice: buy it once in the Clothes Shop
  if (g && !g.done) return { k: 'locked', g }; if (state.gold < x.it.price) return { k: 'poor', g }; return { k: 'buy', g };
}
const goalLine = (x, g) => `${g.tag && !g.rows.every(r => r.fmt === 'prestige') ? g.tag + ': ' : ''}${fmtGoal(g)}`; // [prestige] 'PRESTIGE 0/1', not 'PRESTIGE 1: PRESTIGE 0/1'

// ---------- render ----------
function build() {
  if (!document.querySelector('link[href$="islandShop.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../css/islandShop.css', import.meta.url).href; document.head.appendChild(l); }
  root = document.createElement('div'); root.id = 'island-shop'; root.className = 'ishop hidden'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Shop');
  root.innerHTML = `<div class="ishop-panel">
    <div class="ishop-awning" aria-hidden="true"></div>
    <header class="ishop-head"><div class="ishop-title"><b></b><small></small></div><div class="ishop-purse" aria-live="polite"></div><button class="ishop-x faq-x" type="button" aria-label="Close shop">✕</button></header>
    <nav class="ishop-tabs" role="tablist"></nav><div class="ishop-chips" role="tablist" aria-label="Gear"></div><div class="ishop-bsts" aria-live="polite"></div>
    <div class="ishop-body"><aside class="ishop-detail" aria-live="polite"></aside><div class="ishop-grid"></div></div>
    <div class="ishop-actbar" aria-live="polite"></div>
    <footer class="ishop-foot"></footer>
    <div class="ishop-confirm hidden" role="alertdialog" aria-modal="true"><div class="ishop-cbox"></div></div></div>`;
  document.body.appendChild(root);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) closeShop(); });
  for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'wheel']) root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); // like #pvp-menu: taps on the shop never steer / fire
  $('.ishop-x', root).onclick = closeShop;
  addEventListener('keydown', (e) => { if (open && e.key === 'Escape' && !document.querySelector('.pfp-hatcolor')) { // [Timothy] a colour picker on top closes itself first
    e.stopPropagation(); if (!$('.ishop-confirm', root).classList.contains('hidden')) hideConfirm(); else closeShop(); } }, true);
}
function render() {
  const V = VENDORS[view.vendor] || VENDORS.shop;
  root.dataset.vendor = view.vendor; root.dataset.tab = view.tab;
  root.style.setProperty('--ishop-awning', V.awning || 'transparent'); root.classList.toggle('stall', !!V.awning);
  $('.ishop-title b', root).textContent = view.title || V.name; $('.ishop-title small', root).textContent = V.sub;
  $('.ishop-purse', root).innerHTML = `<i class="coin"></i>${state.owner ? 'OWNER · ' : ''}${fmtGold(state.gold)}`;
  // [Timothy] V.upgrades adds an UPGRADES tab (opens the ship upgrades panel); no vendor sets it now: SHIP SKINS and the UPGRADE SHOP are separate
  const upg = !!(V.upgrades && window.PFP_OPEN_UPGRADES), tabList = upg ? [...V.tabs, 'upgrades'] : V.tabs;
  const tabName = (t) => t === 'wardrobe' ? 'CHANGING ROOM' : t === 'gear' && V.tabs.includes('wardrobe') ? (V.crew ? 'BUY CREW GEAR' : 'BUY GEAR') : t === 'upgrades' ? 'UPGRADES' : t === 'skins' ? (V.upgrades ? 'SKINS' : 'SHIP SKINS') : V.crew ? 'CREW OUTFITS' : V.pets ? 'PETS' : t === 'swords' ? 'SWORDS' : t === 'muskets' ? 'MUSKETS' : t === 'shoes' ? 'SHOES & PANTS' : 'PIRATE GEAR';   // [V6 store] SHOES & PANTS tab (V.shoeSlots)
  const tabs = $('.ishop-tabs', root); tabs.hidden = tabList.length < 2; tabs.setAttribute('aria-label', upg ? 'Ship shop' : 'Shop');
  tabs.innerHTML = tabList.map(t => `<button type="button" role="tab" data-tab="${t}" class="${t === view.tab ? 'on' : ''}" aria-selected="${t === view.tab}">${tabName(t)}</button>`).join('');
  tabs.querySelectorAll('button').forEach(b => b.onclick = () => { if (b.dataset.tab === 'upgrades') return openUpgrades(); view.tab = b.dataset.tab; try { localStorage.setItem('pfp_shop_tab_' + view.vendor, view.tab); } catch {} if (TAB_SLOT[view.tab]) view.slot = TAB_SLOT[view.tab]; const ss = tabSlots(V, view.tab); if (ss.length && !ss.includes(view.slot)) view.slot = ss[0]; view.sel = null; render(); });
  const chips = $('.ishop-chips', root); root.classList.toggle('wardrobe', view.tab === 'wardrobe'); chips.hidden = (view.tab !== 'gear' && view.tab !== 'shoes' && view.tab !== 'wardrobe') || tabSlots(V, view.tab).length < 2; root.classList.toggle('pets', !!V.pets); root.classList.toggle('crewshop', !!V.crew);
  chips.innerHTML = [...GEAR_SLOTS, ...CREW_SLOT_LABELS].filter(([s]) => tabSlots(V, view.tab).includes(s)).map(([s, l]) => `<button type="button" role="tab" data-slot="${s}" class="${s === view.slot ? 'on' : ''}">${l}</button>`).join('');
  { const on = chips.querySelector('button.on'); if (on && !chips.hidden) requestAnimationFrame(() => { const l = on.offsetLeft - chips.offsetLeft, w = on.offsetWidth; if (l < chips.scrollLeft || l + w > chips.scrollLeft + chips.clientWidth) chips.scrollLeft = Math.max(0, l - (chips.clientWidth - w) / 2); }); }   // [v6-store-clothes] phone: the picked chip (SHOES / PANTS) scrolled into view
  if (V.slots.includes('outfit') && (view.tab === 'wardrobe' || !V.tabs.includes('wardrobe'))) chips.insertAdjacentHTML('beforeend', '<button type="button" class="ishop-look" title="Body, skin tone, hair + eye colour (free)">👤 BODY · SKIN · HAIR · EYES</button>'); // [Timothy] captain look
  chips.querySelectorAll('button[data-slot]').forEach(b => b.onclick = () => { view.slot = b.dataset.slot; view.sel = null; render(); });
  { const lb = $('.ishop-look', chips); if (lb) lb.onclick = () => openGearColorPicker({ kind: 'look', parent: root, onClose: () => { if (open) render(); } }); }
  boostBar(V);
  const items = view.tab === 'wardrobe' && !V.dress ? itemsFor().filter(x => statusOf(x).owned) : itemsFor(); if (!items.some(x => x.key === view.sel)) view.sel = (items.find(x => statusOf(x).k === 'equipped') || items[0])?.key;
  const grid = $('.ishop-grid', root); grid.innerHTML = '';
  for (const x of items) {
    const s = statusOf(x), c = document.createElement('button'); c.type = 'button'; c.className = `ishop-card ${s.k}${x.key === view.sel ? ' sel' : ''}`; c.dataset.id = x.key; if (x.kind === 'skin') c.dataset.skin = x.key;
    c.append(x.kind === 'skin' ? skinThumb(x.key) : gearThumb(x.it));
    // [Timothy] locked: each goal row as text + bar ('Harbor boss kills 37/100'); goal met: the card turns to BUY · price
    const met = s.g && s.g.done && (s.k === 'buy' || s.k === 'poor');
    const badge = { equipped: 'EQUIPPED ✓', owned: 'OWNED', locked: '🔒 GOAL', poor: fmtGold(x.it.price), buy: met ? `BUY · ${fmtGold(x.it.price)}` : fmtGold(x.it.price), soon: 'COMING SOON', needbuy: '🔒 BUY IN CLOTHES SHOP' }[s.k];
    if (met) c.classList.add('goal-met'); if (s.k === 'locked') c.classList.add('has-goal');
    if (V.pets && PET_RARITY[x.it.id]) c.insertAdjacentHTML('beforeend', `<i class="ishop-rar r-${PET_RARITY[x.it.id].toLowerCase()}">${PET_RARITY[x.it.id]}</i>`);
    c.insertAdjacentHTML('beforeend', `<b class="ishop-name">${esc(x.name)}</b>${s.k === 'locked' ? goalCardHtml(s.g, modesNow()) : `<span class="ishop-badge">${x.it.price === 0 && s.k === 'owned' ? (x.it.grant === 'prestige' ? 'UNLOCKED · FREE' : 'FREE') : badge}</span>`}${met ? `<span class="ishop-metl">✓ GOAL MET${s.k === 'poor' ? ` · need ${fmtGold(x.it.price - state.gold)}` : ''}</span>` : ''}`);
    if (x.kind === 'gear') { const b = boostOf(x.it.slot, x.it.id); if (b && boostChips(b).length) c.insertAdjacentHTML('beforeend', `<span class="ishop-bst">${boostChipHtml(b, esc)}</span>`); } // [Emerly] '+4% RELOAD'
    c.onclick = () => { view.sel = x.key; if (x.kind === 'skin') provider?.prewarm?.('skin', x.key); render(); }; // [skin-swap-perf] selected = built + compiled before EQUIP
    grid.appendChild(c);
  }
  detail(items.find(x => x.key === view.sel));
  $('.ishop-foot', root).textContent = state.source === 'mock' ? `PREVIEW · mock data, nothing is spent${view.tab === 'skins' ? ' · cosmetic only' : ' · worn gear gives SKILL BOOSTS'}` : `Paid from your Battle Royale gold${view.tab === 'skins' ? ' · ship skins are cosmetic only' : ' · worn gear gives SKILL BOOSTS (capped) · Battle Royale 50% · off in the SWORD PIT + MUSKET RANGE'}${state.behind ? ' · some gold is still syncing' : ''}`;
  if (skinMod && view.tab === 'skins') try { skinMod.previewCards(grid, sortByPrice(SKIN_ITEMS, i => i.price).map(i => ({ id: i.id, skin: skinMod.pvpSkin(i.id) })), {}, { pvp: true }); } catch {}
}
function openUpgrades() { // [Timothy] UPGRADES tab: hand over to the ship upgrades panel (js/shop.js, opened in island mode)
  let ok = false; try { ok = !!window.PFP_OPEN_UPGRADES(); } catch (e) { console.warn('[shop] upgrades', e); }
  if (ok) closeShop(); else toast('Upgrades open in the harbor, out of battle');
}
// [v6-store-clothes] CHANGING ROOM preview: the whole pirate (or crew member) in everything equipped now, this item on top
function fullBodyOpts(it) {
  if (it.crew) { const g = eqState(), w = crewGear({ ...getCrewLoadout(), ...g }); return { frame: 'full', wear: { ...w, [it.base]: undefined } }; }
  const w = { ...getLocalGear() }; delete w[it.slot]; return { frame: 'full', wear: w };
}
function detail(x) {
  const d = $('.ishop-detail', root); d.innerHTML = ''; if (!x) { $('.ishop-actbar', root).innerHTML = ''; return; }
  const s = statusOf(x);
  d.append(x.kind === 'skin' ? realOr(x.key) : gearThumb(x.it, true, view.tab === 'wardrobe' ? fullBodyOpts(x.it) : null));   // [v6-store-clothes] CHANGING ROOM: full body in everything worn
  const rows = s.g ? goalRowsHtml(s.g, modesNow()) : '';
  const btn = { equipped: '<button type="button" class="ishop-act ghost" disabled>EQUIPPED ✓</button>', owned: '<button type="button" class="ishop-act big" data-a="equip">EQUIP</button>',
    locked: `<button type="button" class="ishop-act" disabled>${x.it.grant === 'prestige' ? 'PRESTIGE TO UNLOCK · FREE' : 'REACH THE GOAL FIRST'}</button>`, poor: `<button type="button" class="ishop-act" disabled>NEED ${fmtGold(x.it.price - state.gold)} MORE</button>`,
    buy: `<button type="button" class="ishop-act big" data-a="buy">BUY · ${fmtGold(x.it.price)}</button>`, soon: '<button type="button" class="ishop-act" disabled>COMING SOON</button>', needbuy: '<button type="button" class="ishop-act" data-a="goto">🔒 BUY IT IN THE CLOTHES SHOP</button>' }[s.k];
  d.insertAdjacentHTML('beforeend', `<div class="ishop-info"><h4>${esc(x.name)}</h4>
    <div class="ishop-pr">${x.it.price ? fmtGold(x.it.price) : 'FREE'}${s.owned ? ' · <b>OWNED</b>' : ''}${s.k === 'soon' ? ' · <b>COMING SOON</b>' : ''}</div>
    ${s.k === 'soon' ? '<div class="ishop-gl">Goes on sale when it shows on your pirate.</div>' : ''}
    ${s.g ? `<div class="ishop-gl">${x.it.grant === 'prestige' ? (s.g.done ? '<b>UNLOCKED · FREE</b>: your prestige reward' : `Prestige reward · <b>FREE</b> at <b>${esc(goalLine(x, s.g))}</b>`) : s.g.done ? (s.owned ? 'Goal reached' : 'Goal reached: you can buy it') : s.g.nostats ? `Goal unlocks buying · <b>${esc(s.g.rows.map(r => r.fmt === 'prestige' ? `PRESTIGE ${r.need}` : r.fmt === 'kd' ? `K/D ${r.need}` : `${r.need.toLocaleString('en-US')} ${r.label}`).join(' + '))}</b>` : `Goal unlocks buying · <b>${esc(goalLine(x, s.g))}</b>`}${s.g.proposed ? ' <em class="ishop-prop">proposed goal</em>' : ''}</div>${rows}` : ''}
    ${x.it.use === 'once' && s.k !== 'soon' ? `<div class="ishop-gl">One use: marks ${esc(x.it.dig)} on your island map</div>` : ''}
    ${btn}</div>`);
  if (view.tab === 'wardrobe' && s.k === 'equipped' && x.kind === 'gear') { const off = itemsFor().find(y => y.it.slot === x.it.slot && y.it.price === 0 && y.it.free && y.key !== x.key);   // [v6-store-clothes] take it off = the slot's free default
    if (off) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ishop-act ghost'; b.textContent = 'TAKE OFF'; b.onclick = () => doEquip(off); $('.ishop-info', d)?.append(b); } }
  const a = $('[data-a]', d); if (a) a.onclick = () => a.dataset.a === 'goto' ? openShop({ vendor: 'clothes', tab: 'gear', slot: x.it.base, item: `${x.it.base}:${x.it.id}` }) : a.dataset.a === 'buy' ? confirmBuy(x) : doEquip(x);
  { const bar = $('.ishop-actbar', root), main = $('.ishop-info > .ishop-act', d); bar.innerHTML = ''; // [Emerly] phones: the same EQUIP / BUY button pinned under the detail, always on screen (CSS shows it on phones only)
    if (main) { const c = main.cloneNode(true); c.insertAdjacentHTML('afterbegin', `<span class="ishop-actn">${esc(x.name)}</span>`); if (a) c.onclick = a.onclick; bar.append(c); } }
  if (x.kind === 'gear' && x.it.weapon) $('.ishop-pr', d)?.insertAdjacentHTML('afterend', x.it.slot === 'sword' // [Timothy] WEAPON STORE
    ? '<div class="ishop-gl">Drawn in the <b>SWORD PIT</b>. Pit KOs pay nothing and never count towards goals.</div>'
    : '<div class="ishop-gl">Shouldered at the <b>MUSKET RANGE</b>. Range KOs pay nothing and never count towards goals.</div>');
  if (x.kind === 'gear') boostDetail(x, s, d); // [Emerly] ITEM SKILL BOOSTS
  if (x.it.crew) { // [Timothy] CREW SHOP
    $('.ishop-pr', d)?.insertAdjacentHTML('afterend', `<div class="ishop-gl">For your <b>whole crew</b> · deck crew, gunners + the crew ashore. Your own pirate is not changed.${VENDORS.crew.dress ? ' Free in the CREW ROOM for any gear you own.' : x.it.price ? '' : ' Part of the free crew uniform.'}</div><div class="ishop-gl">Crew now wear: <b>${esc((CREW_ITEMS.find(i => i.slot === 'crewhat' && i.id === eqGear('crewhat')) || {}).label || '')}</b> + <b>${esc((CREW_ITEMS.find(i => i.slot === 'crewoutfit' && i.id === eqGear('crewoutfit')) || {}).label || '')}</b></div>`); }
  if (x.kind === 'gear' && x.it.maleOnly) $('.ishop-pr', d)?.insertAdjacentHTML('afterend', `<div class="ishop-gl">Male pirates only${getLocalGear().body ? ' · <b>not shown on your female pirate</b>' : ''}</div>`); // [Raul shop2 fixes]
  if (x.kind === 'gear' && x.it.slot === 'parrot' && PET_RARITY[x.it.id]) $('.ishop-pr', d)?.insertAdjacentHTML('afterend', `<div class="ishop-gl"><i class="ishop-rar r-${PET_RARITY[x.it.id].toLowerCase()}">${PET_RARITY[x.it.id]}</i> Perches on your shoulder (your crew don't carry parrots)</div>`); // [Timothy] PET STORE
  if (x.kind === 'gear' && x.it.slot === 'hat' && x.it.id !== 'none' && x.it.tint?.hatColor && s.owned && provider.hatColor) { // [v109b] not the crown (its velvet = your hair colour) // [v105] free hat colour (equipped hat)
    const cur = state.equipped?.gear?.hatColor | 0, eq = state.equipped?.gear?.hat === x.it.id;
    d.insertAdjacentHTML('beforeend', `<div class="ishop-hatc"><small>HAT COLOUR · free${eq ? '' : ' (equip it first)'}</small><div>${[['DEFAULT', ''], ...HAT_SWATCHES].map(([n, c], i) =>
      `<button type="button" data-hc="${i}" class="${i === cur ? 'on' : ''}" title="${n}" aria-label="${n}" ${eq ? '' : 'disabled'} style="${c ? `background:${c}` : ''}">${c ? '' : '✕'}</button>`).join('')}</div></div>`);
    d.querySelectorAll('[data-hc]').forEach(b => b.onclick = async () => { state = await provider.hatColor(+b.dataset.hc); render(); });
  }
  if (x.it.crew && x.it.slot === 'crewhat' && x.it.tint?.hatColor && s.owned && provider.crewHatColor) { // [Raul gear colours] the crew's own free hat colour (same swatches)
    const cg = state.equipped?.gear || {}, cur = cg.crewhatColor | 0, eq = (cg.crewhat || CREW_DEFAULT.crewhat) === x.it.id;
    d.insertAdjacentHTML('beforeend', `<div class="ishop-hatc"><small>CREW HAT COLOUR · free${eq ? '' : ' (equip it first)'}</small><div>${[['DEFAULT', ''], ...HAT_SWATCHES].map(([n, c], i) =>
      `<button type="button" data-chc="${i}" class="${i === cur ? 'on' : ''}" title="${n}" aria-label="${n}" ${eq ? '' : 'disabled'} style="${c ? `background:${c}` : ''}">${c ? '' : '✕'}</button>`).join('')}</div></div>`);
    d.querySelectorAll('[data-chc]').forEach(b => b.onclick = async () => { state = await provider.crewHatColor(+b.dataset.chc); render(); });
  }
  const COLK = { cape: 'capeColor', crewcape: 'crewcapeColor', pants: 'pantsColor', crewpants: 'crewpantsColor', boots: 'bootsColor', crewboots: 'crewbootsColor' }, LBL = { cape: 'CAPE', pants: 'PANTS', boots: 'SHOE' };   // [v6-store-clothes] cape / pants / shoes colours
  if (x.kind === 'gear' && COLK[x.it.slot] && x.it.id !== 'none' && s.owned) { // [v6-store-clothes] BANKSY 2:03 PM: free cape colour (yours, or the crew's)
    const crew = !!x.it.crew, ck = COLK[x.it.slot], lk = COLK[x.it.base || x.it.slot], cg = state.equipped?.gear || {}, cur = crew ? cg[ck] | 0 : getLocalGear()[lk] | 0, eq = eqGear(x.it.slot) === x.it.id;
    d.insertAdjacentHTML('beforeend', `<div class="ishop-hatc"><small>${crew ? 'CREW ' : ''}${LBL[x.it.base || x.it.slot]} COLOUR · free${eq ? '' : ' (equip it first)'}</small><div>${[['DEFAULT', ''], ...CAPE_SWATCHES].map(([n, c], i) =>
      `<button type="button" data-cpc="${i}" class="${i === cur ? 'on' : ''}" title="${n}" aria-label="${n}" ${eq ? '' : 'disabled'} style="${c ? `background:${c}` : ''}">${c ? '' : '✕'}</button>`).join('')}</div></div>`);
    d.querySelectorAll('[data-cpc]').forEach(b => b.onclick = async () => { const i = +b.dataset.cpc; if (crew) { if (provider.crewCapeColor) state = await provider.crewCapeColor(i, ck); setCrewLoadout({ ...getCrewLoadout(), [ck]: i }); } else setLocalGear({ [lk]: i }); render(); });
  }
  if (x.kind === 'gear' && x.it.slot === 'outfit' && x.it.id !== 'shirtless') { // [Timothy] clothes: your ship skin's colours, or a free clothes colour
    const oc = getLocalGear().outfitColor | 0;
    d.insertAdjacentHTML('beforeend', `<div class="ishop-gl">${oc ? 'Your clothes colour (free) · trim from your ship skin' : 'Takes your ship skin\'s colours'}</div>`);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ishop-act ghost ishop-clothcol'; b.textContent = '🎨 CLOTHES COLOUR';
    b.onclick = () => openGearColorPicker({ kind: 'cloth', parent: root, onClose: () => { if (open) render(); } }); d.append(b); }
  if (x.kind === 'gear' && x.it.side) { // [Timothy] hook / peg leg: LEFT or RIGHT arm / leg (free, any time; saved + sent to other players)
    const cur = getLocalGear()[x.it.side] === 'L' ? 'L' : 'R', w = document.createElement('div'); w.className = 'ishop-side'; w.setAttribute('role', 'radiogroup'); w.setAttribute('aria-label', 'Side');
    w.innerHTML = ['L', 'R'].map(k => `<button type="button" role="radio" data-side="${k}" aria-checked="${k === cur}" class="${k === cur ? 'on' : ''}">${k === 'L' ? '◀ LEFT' : 'RIGHT ▶'}</button>`).join('');
    w.querySelectorAll('button').forEach(b => b.onclick = () => setLocalGear({ [x.it.side]: b.dataset.side }));
    $('.ishop-info', d)?.append(w); }
}
// ---------- [Emerly] ITEM SKILL BOOSTS (js/boosts.js): card chips, the detail pane, the totals bar ----------
const eqState = () => { const g = { ...(state?.equipped?.gear || {}) }; for (const k of Object.keys(CREW_DEFAULT)) g[k] = eqGear(k); for (const k of ['crewcapeColor', 'crewpantsColor', 'crewbootsColor']) if (state?.equipped?.gear?.[k]) g[k] = state.equipped.gear[k]; return g; };
const ownedState = () => state?.owned?.gear || [];
const totalNow = (gear = eqState()) => boostsFor(gear, ownedState(), !!state?.owner);
function boostLine(x) { const b = boostOf(x.it.slot, x.it.id), c = boostChips(b); return c.length ? `Gives ${c.map(c => c.text + (BOOST_STATS[c.k]?.hint ? ` (${BOOST_STATS[c.k].hint})` : '')).join(' + ')} while worn` : 'Cosmetic only'; }   // [Raul items redo 2] + what a SELL BONUS pays on
function boostDetail(x, s, d) {
  const b = boostOf(x.it.slot, x.it.id), chips = boostChips(b), cur = eqGear(x.it.slot), curB = cur !== x.it.id ? boostOf(x.it.slot, cur) : null;
  const pr = $('.ishop-pr', d); if (!pr) return;
  if (!chips.length) { if (x.it.price) pr.insertAdjacentHTML('afterend', '<div class="ishop-gl ishop-bstd none">No skill boost · cosmetic only</div>'); return; }
  const k0 = chips[0].k, S = BOOST_STATS[k0];
  // compare with what this slot wears now: '+2% → +5% RANGE'; the totals after equipping (caps applied)
  const now = totalNow(), after = totalNow({ ...eqState(), [x.it.slot]: x.it.id }), owned = s.owned || state.owner;
  const cmp = curB && boostChips(curB).length ? `<div class="ishop-gl">Now wearing: ${boostChipHtml(curB, esc)} → this</div>` : '';
  const capNote = after.capped.includes(k0) ? ` · <b class="bst-cap">${S.label} CAPPED at ${fmtPct(S.cap)}</b>` : after.capped.includes('combat') ? ` · <b class="bst-cap">TOTAL CAPPED at ${Math.round(COMBAT_CAP * 100)}</b>` : '';
  const pv = S.combat ? statPreview(k0, after[k0] || 0, now[k0] || 0) : null;
  const unit = pv ? `<div class="ishop-gl">Your ship: <b>${esc(pv.from)} → ${esc(pv.to)}</b> ${esc(S.label.toLowerCase())}${state.owner || owned ? '' : ' once bought + worn'}</div>` : '';
  const where = S.combat ? `Stacks with ${esc(S.track)} upgrades · Battle Royale ${Math.round(BOOST_MODE.br * 100)}% · off in the SWORD PIT + MUSKET RANGE` : x.it.slot === 'parrot' ? 'More gold from loot piles, wins + Waves payouts (not the holder daily gold)' : S.foot ? `Your ${k0 === 'swordHit' ? 'sword' : 'musket'} lands more often, on foot in battle modes · never your ship's cannons${ARENA_WEAPON_BOOSTS ? '' : ' · off in the SWORD PIT + MUSKET RANGE for now'}` : '';
  pr.insertAdjacentHTML('afterend', `<div class="ishop-bstd"><small>SKILL BOOST</small><span class="ishop-bst big">${boostChipHtml(b, esc)}</span></div>${cmp}${unit}<div class="ishop-gl">${where}${capNote}</div>`);
  if (now.combat !== after.combat && S.combat) $('.ishop-bstd', d)?.insertAdjacentHTML('beforeend', `<small class="bst-tot">TOTAL ${Math.round(now.combat * 100)} → ${Math.round(after.combat * 100)} / ${Math.round(COMBAT_CAP * 100)}</small>`);
}
function boostBar(V) {
  const el = $('.ishop-bsts', root); if (!el) return;
  if (view.tab === 'skins' || view.tab === 'upgrades') { el.hidden = true; return; }
  const t = totalNow(), chips = boostChips(t);
  el.hidden = false;
  el.innerHTML = `<b class="bst-head">BOOSTS <span>${Math.round(t.combat * 100)} / ${Math.round(COMBAT_CAP * 100)}</span></b><span class="bst-meter" role="img" aria-label="Combat boosts ${Math.round(t.combat * 100)} of ${Math.round(COMBAT_CAP * 100)}"><i style="width:${Math.min(100, t.combat / COMBAT_CAP * 100)}%"></i></span>${chips.length ? `<span class="ishop-bst">${chips.map(c => `<i class="bst bst-${c.k}${t.capped.includes(c.k) ? ' capped' : ''}">${c.icon} ${esc(c.text)}${t.capped.includes(c.k) ? ' · CAPPED' : ''}</i>`).join('')}</span>` : '<span class="bst-none">Wear gear to get skill boosts</span>'}`;
}
function confirmBuy(x) {
  const box = $('.ishop-confirm', root), cb = $('.ishop-cbox', box);
  cb.innerHTML = ''; cb.append(x.kind === 'skin' ? realOr(x.key) : gearThumb(x.it));
  cb.insertAdjacentHTML('beforeend', `<h4>BUY ${esc(x.name)}?</h4><p class="ishop-math"><span>${fmtGold(state.gold)}</span> − <b>${fmtGold(x.it.price)}</b> = <span>${fmtGold(state.gold - x.it.price)}</span></p>
    <p class="muted">Paid from your Battle Royale gold. ${x.kind === 'skin' ? 'Cosmetic only.' : boostLine(x) + (x.it.crew ? ' · for your crew (not your own pirate) · on every device with this save.' : ' · yours on every device with this save.')}</p>
    <div class="ishop-cbtns"><button type="button" class="ghost" data-c="no">CANCEL</button><button type="button" class="big" data-c="yes">CONFIRM</button></div><p class="ishop-err" aria-live="assertive"></p>`);
  box.classList.remove('hidden'); $('[data-c="yes"]', cb).focus();
  $('[data-c="no"]', cb).onclick = hideConfirm;
  $('[data-c="yes"]', cb).onclick = async (e) => { e.target.disabled = true; e.target.textContent = '…';
    const r = await provider.buy(x.kind, x.key); state = r.state;
    if (!r.ok) { $('.ishop-err', cb).textContent = String(r.error || 'could not buy').toUpperCase(); e.target.disabled = false; e.target.textContent = 'CONFIRM'; return; }
    hideConfirm(); render(); toast(x.it?.crew ? `Your crew can wear ${x.name} (CREW ROOM)` : `${x.name} is yours`); };
}
const hideConfirm = () => $('.ishop-confirm', root).classList.add('hidden');
async function doEquip(x) { state = await provider.equip(x.kind, x.key); render(); }
function toast(t) { const el = document.createElement('div'); el.className = 'ishop-toast'; el.textContent = t; $('.ishop-panel', root).appendChild(el); setTimeout(() => el.remove(), 2200); }

// ---------- API ----------
export async function openShop(opts = {}) {
  if (ON_PORTAL || !provider) return false; // crypto-free portal builds: no Battle Royale, no shared gold, so no shop
  if (!root) build();
  const v = VENDORS[opts.vendor] ? opts.vendor : 'shop', V = VENDORS[v];
  const sTab = tabForSlot(V, opts.slot);   // [V6 store] a boots / pants link opens the SHOES & PANTS tab
  let lastTab = null; try { lastTab = localStorage.getItem('pfp_shop_tab_' + v); } catch {}   // [v6-store-clothes] remember BUY GEAR / CHANGING ROOM
  view = { vendor: v, tab: sTab || (V.tabs.includes(opts.tab) && !(opts.tab === 'gear' && lastTab === 'wardrobe') ? opts.tab : V.tabs.includes(lastTab) ? lastTab : V.tabs[0]), slot: sTab || V.slots.includes(opts.slot) ? opts.slot : V.slots[0], sel: opts.item || null, title: typeof opts.title === 'string' ? opts.title : null }; // [Emerly] title: e.g. SWORD SHOP / MUSKET SHOP (vendor 'weapons')
  if (!skinMod) try { const [a, b, c] = await Promise.all([import('./skins.js'), import('./pvpSkins.js'), import('./skinPreview.js')]); skinMod = { skinSwatch: a.skinSwatch, pvpSkin: b.pvpSkin, previewCards: c.previewCards }; } catch { skinMod = null; }
  state = await provider.load(); if (!state) return false; // offline: the caller shows a toast
  open = true; root.classList.remove('hidden'); document.documentElement.classList.add('shop-open'); render();
  try { dispatchEvent(new CustomEvent('pfp-shop', { detail: { open: true, vendor: v } })); } catch {}
  return true;
}
export function closeShop() {
  if (!open) return; open = false; root.classList.add('hidden'); hideConfirm(); document.documentElement.classList.remove('shop-open');
  try { import('./skinPreview.js').then(m => m.pausePreviews?.()); } catch {}
  try { dispatchEvent(new CustomEvent('pfp-shop', { detail: { open: false } })); } catch {}
}

// temporary harbor-menu entry (flag only): a button in the BATTLE ROYALE menu, above its SKINS list
function entry() {
  if (!shopFlag()) return;
  const put = () => { const card = $('#pvp-menu .pvp-card'), sub = card && [...card.querySelectorAll('.pvp-sub')].find(e => /SKINS/.test(e.textContent)); if (!sub || $('#pvp-shop-open')) return !!sub;
    const b = document.createElement('button'); b.id = 'pvp-shop-open'; b.type = 'button'; b.className = 'ghost'; b.innerHTML = '🏝 SHOP <small class="muted">ship skins for gold</small>';
    b.onclick = () => openShop({ vendor: 'shop', tab: 'skins' }); sub.before(b); return true; };
  if (!put()) { const t = setInterval(() => put() && clearInterval(t), 500); setTimeout(() => clearInterval(t), 20000); }
}
// [Timothy] BANKSY: skins are bought / equipped only at the island ship shop, so the menu button is gone (entry() kept for reference, not called)
window.PFP_SHOP = { openShop, closeShop, isShopOpen, setShopProvider, mockProvider };
window.PFP_ISLAND_SHOP = { openShop, closeShop, isShopOpen, setShopProvider, mockProvider }; // [Timothy] js/shop.js also sets window.PFP_SHOP (upgrade shop); whichever loads last wins, so tests use this one
if (!ON_PORTAL) { window.openShop = openShop; window.closeShop = closeShop; window.isShopOpen = isShopOpen; }
export const refreshShop = () => { if (open && provider) provider.load().then(st => { if (st && open) { state = st; render(); } }); };
