// [Raul] ship upgrades — SHOP button (top HUD row) + shipwright overlay.
// Tap SHOP (or press U / B) to pause and open the shop; close (or U / B / Esc) to resume.
// In-game gold only. Nothing here touches a wallet, token, NFT or the leaderboard.
import { UPGRADES, REPAIR, newRun, shipStats, applyStats, fmtStat, ROMAN } from './upgrades.js';
import { celebrateUpgrade } from './upgradeVisuals.js'; // [Raul] upgrade visuals
import { setLoadout } from './audio.js'; // [Raul] sound upgrades: sounds follow the upgrade levels
import { SKINS, ownsSkin, equippedSkin, unlockSkin, equipSkin, skinSwatch } from './skins.js'; // [Raul] ship skins
import { initSkinPreview, requestPreviews, pausePreviews } from './skinPreview.js'; // [Raul] skin previews
import { pvpTierCost, PVP_REPAIR_COST } from './config.js'; // [pvp] same items/stats, PvP cost curve (by tier index)
const PVP = () => ctx?.game.mode === 'pvp';
const TIER_IDX = new Map(); for (const u of UPGRADES) u.tiers.forEach((t, i) => TIER_IDX.set(t, i));
const costOf = (t) => PVP() ? pvpTierCost(TIER_IDX.get(t) ?? 0) : t.cost; // [pvp] same price in the harbor and the arena
const repairCost = () => PVP() ? PVP_REPAIR_COST : REPAIR.cost; // [pvp]
const SUB_UPG = () => PVP() ? 'Spend PvP gold on your ship. Upgrades are kept after you sink (and saved if you chose a save).' : 'Spend looted gold on your ship. Upgrades last this voyage only.';

let ctx = null, run = newRun(), lastBuy = null; // [Raul] lastBuy replays the purchase moment on the ship when the shop closes
const $ = (id) => document.getElementById(id);

const CHEST_SVG = `<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
  <path d="M4 14 Q4 6 16 6 Q28 6 28 14 Z" fill="#6b3e1e" stroke="#ffcd77" stroke-width="2" stroke-linejoin="round"/>
  <rect x="4" y="14" width="24" height="12" rx="1.5" fill="#6b3e1e" stroke="#ffcd77" stroke-width="2"/>
  <rect x="4" y="13" width="24" height="3" fill="#ffcd77"/>
  <rect x="13.5" y="12" width="5" height="7" rx="1" fill="#ffcd77" stroke="#161616" stroke-width="1"/>
  <circle cx="16" cy="15.6" r="1" fill="#161616"/></svg>`;

function injectCss() {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/shop.css'; document.head.appendChild(l);
}

function buildDom() {
  const btn = document.createElement('button');
  btn.id = 'btn-shop'; btn.className = 'icon'; btn.title = 'Shipwright shop (U / B)'; btn.setAttribute('aria-label', 'Open shop');
  btn.innerHTML = `${CHEST_SVG}<span class="shop-dot"></span>`;
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggle(); });
  $('hud').appendChild(btn);

  const ov = document.createElement('div');
  ov.id = 'shop'; ov.className = 'overlay hidden';
  ov.innerHTML = `<div class="panel shop-panel">
    <div class="shop-head">
      <h1>SHIPWRIGHT</h1>
      <div class="shop-purse">${CHEST_SVG}<b id="shop-gold">0</b><span class="label">GOLD</span></div>
    </div>
    <div class="shop-sub muted">Spend looted gold on your ship. Upgrades last this voyage only.</div>
    <div id="shop-hp" class="shop-hp"><span class="label">HULL</span><div class="bar"><div class="fill red"></div></div><span class="hp-txt"></span>
      <button id="shop-repair" class="buy">REPAIR HULL +${REPAIR.hp} HP · ${REPAIR.cost}g</button></div>
    <div id="shop-escort" class="shop-hp shop-escort" title="An allied ship that sails with you and fights until it sinks. Up to 5 at once."><span class="esc-ico" aria-hidden="true">⚓</span><span class="label">ESCORTS</span><span id="esc-count" class="esc-count">0/5</span>
      <button id="shop-hire" class="buy">HIRE ESCORT · 1500g</button></div>
    <div class="shop-tabs" role="tablist"><button id="tab-upg" class="shop-tab on" role="tab">UPGRADES</button><button id="tab-skins" class="shop-tab" role="tab">SKINS</button></div>
    <div id="shop-grid" class="shop-grid"></div>
    <div id="skin-grid" class="shop-grid skin-grid hidden"></div>
    <button id="shop-close" class="big">BACK TO BATTLE</button>
    <div class="shop-keys muted">U / B / Esc to close</div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
  $('shop-close').onclick = close;
  $('shop-repair').onclick = repair;
  $('shop-hire').onclick = hire; // [escorts]
  const grid = $('shop-grid');
  for (const u of UPGRADES) {
    const c = document.createElement('div'); c.className = 'shop-card'; c.dataset.id = u.id; c.title = u.desc; // [Raul] upgrade buffs: desc as a hover hint
    c.innerHTML = `<div class="sc-top"><span class="sc-ico txt">${u.icon}</span><span class="sc-name">${u.name}</span></div>
      <div class="sc-pips">${u.tiers.map(() => '<i></i>').join('')}</div>
      <div class="sc-stat"></div><button class="buy"></button>`;
    c.querySelector('.buy').onclick = () => buy(u.id);
    grid.appendChild(c);
  }
  // [Raul] ship skins: permanent cosmetic unlocks bought with in-game gold
  $('tab-upg').onclick = () => setTab('upg'); $('tab-skins').onclick = () => setTab('skins');
  const sg = $('skin-grid');
  for (const s of SKINS) {
    const c = document.createElement('div'); c.className = 'shop-card skin-card'; c.dataset.skin = s.id;
    c.innerHTML = `<div class="sk-sw"><canvas class="sk-prev" aria-hidden="true"></canvas><span class="sk-lock" title="Locked">🔒</span></div><div class="sc-name">${s.name}</div><div class="sk-blurb muted">${s.blurb}</div><button class="buy"></button>`;
    const sw = skinSwatch(s); sw.classList.add('sk-swatch'); c.querySelector('.sk-sw').prepend(sw); // fallback until / unless the 3D preview renders
    c.querySelector('.buy').onclick = () => skinAction(s.id);
    sg.appendChild(c);
  }
}
let tab = 'upg';
// [Raul] skin previews: real side-view renders of the current build in each skin (cached, rendered in idle time)
function showPreview(s, src) {
  const c = $('skin-grid')?.querySelector(`[data-skin="${s.id}"]`); if (!c) return;
  const cv = c.querySelector('.sk-prev'); cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(src, 0, 0);
  c.classList.add('has-prev');
}
function refreshPreviews() { if (ctx && ctx.game.state === 'shop') requestPreviews(SKINS, { ...run.levels }, showPreview); }
function setTab(t) {
  tab = t;
  $('tab-upg').classList.toggle('on', t === 'upg'); $('tab-skins').classList.toggle('on', t === 'skins');
  $('shop-grid').classList.toggle('hidden', t !== 'upg'); $('skin-grid').classList.toggle('hidden', t !== 'skins');
  $('shop-hp').classList.toggle('hidden', t !== 'upg'); $('shop-escort').classList.toggle('hidden', t !== 'upg');
  if (t === 'skins') refreshPreviews();
  document.querySelector('#shop .shop-sub').textContent = t === 'upg' ? SUB_UPG() : 'Paint jobs are cosmetic and yours to keep across every voyage.';
  render();
}
function renderSkins() {
  const g = ctx.game.gold, eq = equippedSkin().id;
  for (const s of SKINS) {
    const c = $('skin-grid').querySelector(`[data-skin="${s.id}"]`), b = c.querySelector('.buy'), own = ownsSkin(s.id);
    c.classList.toggle('equipped', s.id === eq); c.classList.toggle('owned', own); c.classList.toggle('locked', !own);
    if (s.id === eq) { b.textContent = 'EQUIPPED'; b.disabled = true; }
    else if (own) { b.textContent = 'EQUIP'; b.disabled = false; }
    else { b.textContent = `${s.price}g`; b.disabled = g < s.price; }
  }
}
// [wave skins] every 5th wave: free unlock of the cheapest unowned skin + a non-blocking toast with EQUIP
export function waveSkinUnlock(wave) {
  if (!ctx || wave < 5 || wave % 5) return null;
  const s = SKINS.filter(x => !ownsSkin(x.id)).sort((a, b) => a.price - b.price)[0];
  if (!s) return null; // owns everything: show nothing
  unlockSkin(s.id);
  document.getElementById('skin-toast')?.remove();
  const t = document.createElement('div'); t.id = 'skin-toast';
  t.innerHTML = `<div class="st-txt"><b>NEW SKIN UNLOCKED</b><span>${s.name}</span></div><button class="buy">EQUIP</button>`;
  const sw = skinSwatch(s, 88, 44); sw.className = 'st-sw'; t.prepend(sw);
  const btn = t.querySelector('button');
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) t.addEventListener(ev, e => e.stopPropagation()); // don't steer / fire
  btn.onclick = (e) => { e.stopPropagation(); equipSkin(s.id); ctx.rebuildShip?.(run.levels); ctx.sfx?.equip?.(); btn.textContent = 'EQUIPPED'; btn.disabled = true; if (ctx.game.state === 'shop') render(); setTimeout(() => t.remove(), 900); };
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 6000);
  return s.id;
}
function skinAction(id) {
  const s = SKINS.find(x => x.id === id); if (!s) return;
  let bought = false;
  if (!ownsSkin(id)) {
    if (ctx.game.gold < s.price) return;
    ctx.game.gold -= s.price; ctx.game.goldSpent = (ctx.game.goldSpent || 0) + s.price; unlockSkin(id); bought = true;
  }
  equipSkin(id);
  const mesh = ctx.rebuildShip?.(run.levels);
  const label = bought ? `+${s.name}` : s.name;
  celebrateUpgrade(mesh, 'skin', { camera: ctx.camera, label });
  lastBuy = { id: 'skin', label, legendary: false };
  if (bought) ctx.sfx?.upgrade?.(false); ctx.sfx?.equip?.(); // [Raul] sound upgrades: cloth swish + sparkle
  ctx.updateHud(); render();
  const c = $('skin-grid').querySelector(`[data-skin="${id}"]`); if (c) { c.classList.remove('tierup'); void c.offsetWidth; c.classList.add('tierup'); setTimeout(() => c.classList.remove('tierup'), 800); }
}

function render() {
  if (!ctx) return;
  const { game } = ctx, p = ctx.getPlayer();
  $('shop-gold').textContent = game.gold;
  $('shop-hp').querySelector('.fill').style.width = `${(p.hp / p.maxHp) * 100}%`;
  $('shop-hp').querySelector('.hp-txt').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  const rb = $('shop-repair'); rb.disabled = p.hp >= p.maxHp || game.gold < repairCost();
  rb.textContent = p.hp >= p.maxHp ? 'HULL IS SOUND' : `REPAIR HULL +${REPAIR.hp} HP · ${repairCost()}g`;
  $('shop-escort').classList.toggle('pvp-hide', PVP()); $('tab-skins').classList.toggle('pvp-hide', PVP()); // [pvp] no escorts; PvP skins unlock by kills (PvP menu)
  const stats = shipStats(run);
  for (const u of UPGRADES) {
    const c = $('shop-grid').querySelector(`[data-id="${u.id}"]`), lv = run.levels[u.id];
    c.querySelectorAll('.sc-pips i').forEach((el, i) => el.classList.toggle('on', i < lv));
    const b = c.querySelector('.buy'), next = u.tiers[lv];
    if (!next) { c.querySelector('.sc-stat').innerHTML = `<b>${fmtStat(u, stats[u.stat], stats.gunDmg)}</b>`; b.textContent = PVP() ? `MAX ${ROMAN[u.tiers.length - 1]}` : 'MAXED'; b.disabled = true; c.classList.add('max'); continue; } // [pvp] hard cap: MAX, more gold buys no power
    c.classList.remove('max');
    c.querySelector('.sc-stat').innerHTML = `${fmtStat(u, stats[u.stat], stats.gunDmg)} <span class="arrow">→</span> <b>${fmtStat(u, next.value, next.gunDmg)}</b>`;
    b.textContent = `${costOf(next)}g`; b.disabled = game.gold < costOf(next);
  }
  renderEscorts();
  renderSkins();
}
// [escorts] HIRE ESCORT: 1500g, up to 5 afloat; they stay until sunk (rest of the run)
function renderEscorts() {
  const E = ctx.escorts; if (!E) return;
  const n = E.count(), max = E.max, cost = E.cost, b = $('shop-hire');
  $('esc-count').textContent = `${n}/${max}`;
  b.textContent = n >= max ? 'FLEET FULL' : `HIRE ESCORT · ${cost}g`;
  b.disabled = n >= max || ctx.game.gold < cost;
}
function hire() {
  const E = ctx.escorts; if (!E) return;
  if (!E.hire()) return;
  ctx.sfx?.upgrade?.(false); ctx.updateHud(); render();
  const r = $('shop-escort'); r.classList.remove('tierup'); void r.offsetWidth; r.classList.add('tierup'); setTimeout(() => r.classList.remove('tierup'), 800);
}

function canAfford() {
  if (!ctx) return false;
  const g = ctx.game.gold;
  if (!PVP() && ctx.escorts && ctx.escorts.count() < ctx.escorts.max && g >= ctx.escorts.cost) return true; // [escorts]
  return UPGRADES.some(u => { const t = u.tiers[run.levels[u.id]]; return t && g >= costOf(t); });
}

function buy(id) {
  const u = UPGRADES.find(x => x.id === id), lv = run.levels[id], t = u && u.tiers[lv];
  if (!t || ctx.game.gold < costOf(t)) return;
  const cost = costOf(t); ctx.game.gold -= cost; ctx.game.goldSpent = (ctx.game.goldSpent || 0) + cost; run.spent += cost;
  run.levels[id]++; setLoadout(run.levels);
  applyStats(ctx.getPlayer(), shipStats(run));
  // [Raul] upgrade visuals: recompile the ship from the new trait levels, then the purchase moment
  const lvl = run.levels[id], legendary = lvl === u.tiers.length;
  const mesh = ctx.rebuildShip?.(run.levels);
  const label = `+${u.name} ${ROMAN[lvl - 1]}${legendary ? ' · LEGENDARY' : ''}`;
  celebrateUpgrade(mesh, id, { camera: ctx.camera, label, legendary });
  lastBuy = { id, label, legendary };
  if (ctx.sfx?.upgrade) ctx.sfx.upgrade(legendary); else ctx.sfx?.coin?.();
  ctx.updateHud(); render(); tierUp(id, lvl, legendary); ctx.onRunChange?.(run); // [pvp] save upgrades
  ctx.prebuildShips?.(run.levels, ctx.game.gold); // [Raul] next likely purchases, built while the shop is open
  refreshPreviews(); // [Raul] skin previews: the build changed
}
function repair() {
  const p = ctx.getPlayer();
  if (p.hp >= p.maxHp || ctx.game.gold < repairCost()) return;
  const rc = repairCost(); ctx.game.gold -= rc; ctx.game.goldSpent = (ctx.game.goldSpent || 0) + rc;
  p.hp = Math.min(p.maxHp, p.hp + REPAIR.hp);
  ctx.sfx?.coin?.(); ctx.updateHud(); render(); ctx.onRunChange?.(run);
}

export function open() {
  if (!ctx || ctx.game.state !== 'playing' || !ctx.getPlayer().alive) return;
  ctx.game.state = 'shop';
  if (PVP()) setTab('upg'); else if (tab === 'upg') document.querySelector('#shop .shop-sub').textContent = SUB_UPG(); // [pvp]
  render(); $('shop').classList.remove('hidden'); ctx.sfx?.shopOpen?.(); // [Raul] sound upgrades
  refreshPreviews(); // [Raul] skin previews: idle-rendered, only builds missing ones
  ctx.prebuildShips?.(run.levels, ctx.game.gold); // [Raul] pre-compile next purchases so buying is instant
}
export function close() {
  if (!ctx || ctx.game.state !== 'shop') return;
  ctx.game.state = 'playing'; $('shop').classList.add('hidden'); pausePreviews(); // [Raul] skin previews
  if (lastBuy) { celebrateUpgrade(ctx.getPlayer().mesh, lastBuy.id, { camera: ctx.camera, label: lastBuy.label, legendary: lastBuy.legendary }); lastBuy = null; }
}
// [Raul] upgrade visuals: tier-up flourish on the shop card (CSS bounce + stamp, ~0.7 s)
function tierUp(id, lvl, legendary) {
  const c = $('shop-grid').querySelector(`[data-id="${id}"]`); if (!c) return;
  c.classList.remove('tierup'); void c.offsetWidth; c.classList.add('tierup');
  const st = document.createElement('span'); st.className = 'sc-stamp' + (legendary ? ' legendary' : ''); st.textContent = legendary ? 'LEGENDARY!' : `TIER ${ROMAN[lvl - 1]}!`;
  c.appendChild(st); setTimeout(() => { st.remove(); c.classList.remove('tierup'); }, 800);
}
export function toggle() { if (ctx?.game.state === 'shop') close(); else open(); }

// New run: wipe upgrades and give the fresh player ship the base stats.
export function resetShop() {
  run = newRun(); setLoadout(run.levels);
  if (ctx) { ctx.game.goldSpent = 0; const p = ctx.getPlayer(); p.maxHp = 0; applyStats(p, shipStats(run)); p.hp = p.maxHp; lastBuy = null; }
  $('shop')?.classList.add('hidden');
}

// [pvp] load / read the upgrade levels (PvP keeps them across lives and saves them)
export function setRunLevels(lv = {}) {
  for (const u of UPGRADES) run.levels[u.id] = Math.max(0, Math.min(u.tiers.length, Math.floor(lv[u.id] || 0)));
  setLoadout(run.levels); if (ctx) { const p = ctx.getPlayer(); p.maxHp = 0; applyStats(p, shipStats(run)); p.hp = p.maxHp; ctx.rebuildShip?.(run.levels); }
}
export const getRunLevels = () => ({ ...run.levels });

export function initShop(c) {
  ctx = c; injectCss(); buildDom(); initSkinPreview(c.previewBase || {});
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyU' || e.code === 'KeyB') toggle();
    else if (e.code === 'Escape' && ctx.game.state === 'shop') { e.stopImmediatePropagation(); close(); }
  }, true);
  setInterval(() => { const b = $('btn-shop'); if (b) b.classList.toggle('afford', canAfford()); }, 400);
  window.PFP_SHOP = { celebrateUpgrade, open, close, buy, repair, hire, get run() { return run; },
    // test/preview hook: set tiers directly (stats + model), e.g. PFP_SHOP.setLevels({ hull: 1, cannons: 2, armor: 2 })
    setLevels(lv) { for (const u of UPGRADES) run.levels[u.id] = Math.max(0, Math.min(u.tiers.length, lv[u.id] || 0)); setLoadout(run.levels); const p = ctx.getPlayer(); applyStats(p, shipStats(run)); ctx.rebuildShip?.(run.levels); refreshPreviews(); } };
}
