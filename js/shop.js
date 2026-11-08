import { formatGoldAmount, setGoldText } from './goldFormat.js';
import { devHook } from './env.js'; // [security L] console/test hook: local dev servers only
import { isKey } from './keybinds.js';
// [Raul] ship upgrades — SHOP button (top HUD row) + shipwright overlay.
// Tap SHOP (or press U / B) to pause and open the shop; close (or U / B / Esc) to resume.
// In-game gold only. Nothing here touches a wallet, token, NFT or the leaderboard.
import { UPGRADES, REPAIR, newRun, modeStats, applyStats, fmtStat, ROMAN, BASE_SHIP } from './upgrades.js';
import { sortByPrice } from './shopCatalog.js'; // [v157] shops sorted by price
import { applyBoosts, activeBoosts, setStatsSource } from './boosts.js'; // [Emerly] ITEM SKILL BOOSTS: worn gear adds a capped % after the upgrade tiers
import { celebrateUpgrade } from './upgradeVisuals.js'; // [Raul] upgrade visuals
import { setLoadout } from './audio.js'; // [Raul] sound upgrades: sounds follow the upgrade levels
import { SKINS, ownsSkin, equippedSkin, unlockSkin, equipSkin, skinSwatch } from './skins.js'; // [Raul] ship skins
import { initSkinPreview, requestPreviews, pausePreviews } from './skinPreview.js'; // [Raul] skin previews
import { emblemSvg, rewardFor } from './prestige.js'; // [prestige]
import { pvpTierCost, PVP_REPAIR_COST, PVP_BASE_HP, PVP_HULL_MUL, PVP_REPAIR_MUL } from './config.js'; // [pvp] same items/stats, PvP cost curve (by tier index)
const PVP = () => ctx?.game.mode === 'pvp';
const TIER_IDX = new Map(); for (const u of UPGRADES) u.tiers.forEach((t, i) => TIER_IDX.set(t, i));
const costOf = (t) => PVP() ? pvpTierCost(TIER_IDX.get(t) ?? 0) : t.cost; // [pvp] same price in the harbor and the arena
const PVP_HULL = { base: PVP_BASE_HP, mul: PVP_HULL_MUL, boost: true }, shipStats = (r) => applyBoosts(modeStats(r, PVP() ? PVP_HULL : null), activeBoosts(ctx?.game.mode)), repairHp = () => REPAIR.hp * (PVP() ? PVP_REPAIR_MUL : 1); // [pvp hp] 300 HP base in Battle Royale

const repairCost = () => PVP() ? PVP_REPAIR_COST : REPAIR.cost; // [pvp]
const SUB_UPG = () => PVP() ? 'Spend PvP gold on your ship. Upgrades are kept after you sink (and saved if you chose a save).' : 'Spend looted gold on your ship. Upgrades last this voyage only.';

let ctx = null, run = newRun(), lastBuy = null, fromIsland = false; // [Timothy] fromIsland: opened from the island UPGRADE SHOP (BR) // [Raul] lastBuy replays the purchase moment on the ship when the shop closes
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
  const row = $('hud-icons'); if (row) row.prepend(btn); else $('hud').appendChild(btn); // [v71] first in the top icon row

  const ov = document.createElement('div');
  ov.id = 'shop'; ov.className = 'overlay hidden';
  ov.innerHTML = `<div class="panel shop-panel">
    <div class="shop-head">
      <h1>SHIPWRIGHT</h1>
      <div class="shop-purse">${CHEST_SVG}<b id="shop-gold">0</b><span class="label">GOLD</span></div>
    </div>
    <nav class="shop-isle-tabs" role="tablist" aria-label="Ship shop"><button type="button" role="tab" data-isle="skins" aria-selected="false">SKINS</button><button type="button" role="tab" data-isle="upg" class="on" aria-selected="true">UPGRADES</button></nav>
    <div class="shop-sub muted">Spend looted gold on your ship. Upgrades last this voyage only.</div>
    <div id="shop-hp" class="shop-hp"><span class="label">HULL</span><div class="bar"><div class="fill red"></div></div><span class="hp-txt"></span>
      <button id="shop-repair" class="buy">REPAIR HULL +${REPAIR.hp} HP · ${formatGoldAmount(REPAIR.cost)}g</button></div>
    <div id="shop-escort" class="shop-hp shop-escort" title="An allied ship that sails with you and fights until it sinks. Up to 5 at once."><span class="esc-ico" aria-hidden="true">⚓</span><span class="label">ESCORTS</span><span id="esc-count" class="esc-count">0/5</span>
      <button id="shop-hire" class="buy">HIRE ESCORT · ${formatGoldAmount(1500)}g</button></div>
    <div class="shop-tabs" role="tablist"><button id="tab-upg" class="shop-tab on" role="tab">UPGRADES</button><button id="tab-skins" class="shop-tab" role="tab">SKINS</button></div>
    <div id="shop-grid" class="shop-grid"></div>
    <div id="skin-grid" class="shop-grid skin-grid hidden"></div>
    <div id="shop-prestige" class="shop-prest hidden"><span class="sp-emb"></span><span class="sp-txt"><b>SHIP MAXED</b><small></small></span><button id="shop-prest-btn" type="button" class="buy sp-btn">PRESTIGE</button></div>
    <div id="prest-confirm" class="prest-confirm hidden" role="dialog" aria-modal="true" aria-labelledby="pc-title"><div class="pc-card">
      <div class="pc-emb"></div><h2 id="pc-title">PRESTIGE?</h2>
      <ul class="pc-list"><li class="pc-reset">Every ship upgrade goes back to <b>base</b> (level 0). Your ship starts fresh.</li>
        <li class="pc-keep">You keep your <b>gold, skins, gear, kills</b> and your <b>leaderboard</b> spots.</li><li class="pc-gain"></li></ul>
      <div class="pc-err" role="alert"></div>
      <div class="pc-btns"><button id="pc-no" type="button" class="pc-no">CANCEL</button><button id="pc-yes" type="button" class="buy pc-yes">PRESTIGE</button></div></div></div>
    <button id="shop-close" class="big">BACK TO BATTLE</button>
    <div class="shop-keys muted">U / B / Esc to close</div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#shop-prest-btn').onclick = showPrestConfirm; ov.querySelector('#pc-no').onclick = hidePrestConfirm; ov.querySelector('#pc-yes').onclick = doPrestige; // [prestige]
  ov.querySelector('#prest-confirm').addEventListener('pointerdown', (e) => { if (e.target.id === 'prest-confirm') hidePrestConfirm(); });
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
  $('shop-close').onclick = close;
  // [Timothy] the island SKINS | UPGRADES toggle is gone (separate shops; css hides .shop-isle-tabs); the handler stays harmless.
  ov.querySelector('[data-isle="skins"]').onclick = () => { close(); try { (window.PFP_ISLAND_SHOP || window).openShop?.({ vendor: 'ships', tab: 'skins', from: 'island' }); } catch (e) { console.warn(e); } };
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
  for (const s of sortByPrice(SKINS)) { // [v157] cheapest first
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
function refreshPreviews() { if (ctx && ctx.game.state === 'shop' && tab === 'skins') requestPreviews(SKINS, { ...run.levels }, showPreview); } // [shop-exit-crash] only while the SKINS tab shows (the island SHIPWRIGHT has none: it rebuilt every skin's ship in a 2nd WebGL context on open + after every buy)
function setTab(t) {
  // [t1716u] Waves SHIPWRIGHT = upgrades only (no mid-run skin buying / swapping)
  tab = 'upg';
  $('tab-upg')?.classList.add('on'); $('tab-skins')?.classList.remove('on');
  $('tab-skins')?.classList.add('pvp-hide'); $('tab-skins')?.setAttribute('hidden', '');
  document.querySelector('.shop-tabs')?.classList.add('waves-upg-only');
  $('shop-grid')?.classList.remove('hidden'); $('skin-grid')?.classList.add('hidden');
  $('shop-hp')?.classList.remove('hidden'); $('shop-escort')?.classList.remove('hidden');
  document.querySelector('#shop .shop-sub').textContent = SUB_UPG();
  render();
}
function renderSkins() {
  const g = ctx.game.gold, eq = equippedSkin().id;
  for (const s of SKINS) {
    const c = $('skin-grid').querySelector(`[data-skin="${s.id}"]`), b = c.querySelector('.buy'), own = ownsSkin(s.id);
    c.classList.toggle('equipped', s.id === eq); c.classList.toggle('owned', own); c.classList.toggle('locked', !own);
    if (s.id === eq) { b.textContent = 'EQUIPPED'; b.disabled = true; }
    else if (own) { b.textContent = 'EQUIP'; b.disabled = false; }
    else { b.textContent = `${formatGoldAmount(s.price)}g`; b.disabled = g < s.price; }
  }
}
// [wave skins] every 5th wave: free unlock of the cheapest unowned skin + a non-blocking toast with EQUIP
// [waves skins] fixed schedule: the n-th skin (price order, CLASSIC free) unlocks when a run reaches wave 5·n. Skins you already own
// stay owned. Waves only ('pfp_skins_v1'); Battle Royale skins unlock by PvP kills. Picked in the WAVES entry pop-up (no shop tab).
export const wavesUnlocks = () => SKINS.filter(x => x.id !== 'classic').sort((a, b) => a.price - b.price).map((s, i) => ({ skin: s, wave: 5 * (i + 1) }));
// [t1716u] Waves is score-only: no skin unlocks mid-run (wear the Harbor skin you chose). Signature kept for callers.
export function waveSkinUnlock(_wave) { return null; }
function skinAction(_id) { /* [t1716u] Waves cannot buy / swap skins mid-run */ }

function render() {
  if (!ctx) return;
  const { game } = ctx, p = ctx.getPlayer();
  setGoldText($('shop-gold'), game.gold);
  $('shop-hp').querySelector('.fill').style.width = `${(p.hp / p.maxHp) * 100}%`;
  $('shop-hp').querySelector('.hp-txt').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  const rb = $('shop-repair'); rb.disabled = p.hp >= p.maxHp || game.gold < repairCost();
  rb.textContent = p.hp >= p.maxHp ? 'HULL IS SOUND' : `REPAIR HULL +${repairHp()} HP · ${formatGoldAmount(repairCost())}g`;
  $('shop-escort').classList.toggle('pvp-hide', PVP()); $('tab-skins')?.classList.add('pvp-hide'); $('tab-skins')?.setAttribute('hidden', ''); document.querySelector('.shop-tabs')?.classList.add('waves-upg-only'); // [t1716u] Waves: upgrades only
  const stats = shipStats(run);
  for (const u of UPGRADES) {
    const c = $('shop-grid').querySelector(`[data-id="${u.id}"]`), lv = run.levels[u.id];
    c.querySelectorAll('.sc-pips i').forEach((el, i) => el.classList.toggle('on', i < lv));
    const b = c.querySelector('.buy'), next = u.tiers[lv];
    if (!next) { c.querySelector('.sc-stat').innerHTML = `<b>${fmtStat(u, stats[u.stat], stats.gunDmg)}</b>`; b.textContent = PVP() ? `MAX ${ROMAN[u.tiers.length - 1]}` : 'MAXED'; b.disabled = true; c.classList.add('max'); continue; } // [pvp] hard cap: MAX, more gold buys no power
    c.classList.remove('max');
    const ns = shipStats({ ...run, levels: { ...run.levels, [u.id]: lv + 1 } }); // [v93] next level with the same mode boosts
    c.querySelector('.sc-stat').innerHTML = `${fmtStat(u, stats[u.stat], stats.gunDmg)} <span class="arrow">→</span> <b>${fmtStat(u, ns[u.stat], ns.gunDmg)}</b>`;
    b.textContent = `${formatGoldAmount(costOf(next))}g`; b.disabled = game.gold < costOf(next);
  }
  // [v157] cheapest next level first; maxed upgrades last; ties keep the catalogue order
  const g = $('shop-grid'), nx = (u) => { const t = u.tiers[run.levels[u.id]]; return t ? costOf(t) : Infinity; };
  UPGRADES.map((u, i) => [u, i]).sort((a, b) => (nx(a[0]) - nx(b[0])) || (a[1] - b[1])).forEach(([u]) => g.appendChild(g.querySelector(`[data-id="${u.id}"]`)));
  renderEscorts();
  renderSkins();
  renderPrestige();
}
// ---------------- [prestige] BANKSY: "Add ability to prestige when max out ship" ----------------
// Battle Royale UPGRADE SHOP only: every track maxed -> PRESTIGE (+ confirm). js/pvp.js window.PFP_PRESTIGE does it (server-checked).
const PR = () => window.PFP_PRESTIGE;
function rewardLine(n) { const rw = rewardFor(n);
  return rw ? `Unlocks the <b>${rw.name}</b> <b>FREE</b> (yours to equip at the SHIP SKINS shop).` : `Earns the <b>PRESTIGE ${n}</b> emblem.`; }
function renderPrestige() {
  const box = $('shop-prestige'); if (!box) return;
  const on = PVP() && fromIsland && !!PR()?.canPrestige?.(); box.classList.toggle('hidden', !on); if (!on) { hidePrestConfirm(); return; }
  const n = PR().next().level; box.querySelector('.sp-emb').innerHTML = emblemSvg(n, 34);
  box.querySelector('small').innerHTML = `PRESTIGE ${n}: upgrades back to base. ${rewardLine(n)}`;
}
function showPrestConfirm() {
  if (!PR()?.canPrestige?.()) return; const n = PR().next().level, d = $('prest-confirm');
  d.querySelector('.pc-emb').innerHTML = emblemSvg(n, 56); d.querySelector('#pc-title').textContent = `PRESTIGE ${n}?`;
  d.querySelector('.pc-gain').innerHTML = rewardLine(n); d.querySelector('.pc-err').textContent = '';
  const y = $('pc-yes'); y.disabled = false; y.textContent = `PRESTIGE ${n}`; d.classList.remove('hidden'); $('pc-no').focus();
}
function hidePrestConfirm() { $('prest-confirm')?.classList.add('hidden'); }
async function doPrestige() {
  const y = $('pc-yes'); if (y.disabled) return; y.disabled = true; y.textContent = 'PRESTIGING…';
  const r = await PR()?.run?.().catch(e => ({ ok: false, error: e?.message })) || { ok: false, error: 'offline' };
  if (!r.ok) { y.disabled = false; y.textContent = 'TRY AGAIN'; $('prest-confirm').querySelector('.pc-err').textContent = r.error === 'busy' ? 'One moment…' : `Couldn't prestige: ${r.error || 'offline'}`; return; }
  hidePrestConfirm(); render();
}
// [escorts] HIRE ESCORT: 1500g, up to 5 afloat; they stay until sunk (rest of the run)
function renderEscorts() {
  const E = ctx.escorts; if (!E) return;
  const n = E.count(), max = E.max, cost = E.cost, b = $('shop-hire');
  $('esc-count').textContent = `${n}/${max}`;
  b.textContent = n >= max ? 'FLEET FULL' : `HIRE ESCORT · ${formatGoldAmount(cost)}g`;
  b.disabled = n >= max || ctx.game.gold < cost;
}
function hire() {
  const E = ctx.escorts; if (!E) return;
  if (!E.hire()) return;
  ctx.sfx?.upgrade?.(false); ctx.updateHud(); render();
  const r = $('shop-escort'); r.classList.remove('tierup'); void r.offsetWidth; r.classList.add('tierup'); setTimeout(() => r.classList.remove('tierup'), 800);
}

function canAfford() {
  if (!ctx || PVP()) return false; // [Timothy] BR: upgrades are bought at the island ship shop, so the chest never glows there
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
  p.hp = Math.min(p.maxHp, p.hp + repairHp());
  ctx.sfx?.coin?.(); ctx.updateHud(); render(); ctx.onRunChange?.(run);
}

// [Timothy] BANKSY: "Remove other ways to upgrade ship or change skins, make them go to the shop on island" + "ship skins and ship
// upgrades must be separate shops". In BATTLE ROYALE (permanent, saved upgrades) this panel only opens from the island UPGRADE SHOP
// storefront (plazaTown shop_upgrades, open: 'upgrades' -> js/dock/index.js -> PFP_OPEN_UPGRADES -> open({ island: true }), no skins
// tab); skins are the separate SHIP SKINS shop (shopCatalog vendor 'ships'). Island / harbor only, never in battle: the chest button /
// U / B show a pointer instead. Waves (per-run upgrades, gone when the run ends) is unchanged.
const ISLE_MSG = '⛵ Ship upgrades: visit the UPGRADE SHOP on the island · skins: the SHIP SKINS shop';
export function islandPointer(msg = ISLE_MSG) {
  let t = $('shop-pointer'); if (!t) { t = document.createElement('div'); t.id = 'shop-pointer'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200);
}
export function open(opts = {}) {
  if (!ctx || ctx.game.state !== 'playing' || !ctx.getPlayer().alive) return false;
  if (PVP() && !opts.island) { islandPointer(); return false; }
  fromIsland = PVP() && !!opts.island;
  $('shop').classList.toggle('from-island', fromIsland);
  $('shop-close').textContent = fromIsland ? 'BACK TO THE ISLAND' : 'BACK TO BATTLE';
  ctx.game.state = 'shop';
  if (PVP()) setTab('upg'); else if (tab === 'upg') document.querySelector('#shop .shop-sub').textContent = SUB_UPG(); // [pvp]
  render(); $('shop').classList.remove('hidden'); ctx.sfx?.shopOpen?.(); // [Raul] sound upgrades
  refreshPreviews(); // [Raul] skin previews: idle-rendered, only builds missing ones
  ctx.prebuildShips?.(run.levels, ctx.game.gold); // [Raul] pre-compile next purchases so buying is instant
  return true;
}
export function close() {
  if (!ctx || ctx.game.state !== 'shop') return;
  fromIsland = false; $('shop').classList.remove('from-island'); hidePrestConfirm();
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
// [Emerly] boosts changed (gear equipped / bought, harbor <-> Battle Royale, the SWORD PIT): re-apply the stats, keep the hull's damage
addEventListener('pfp-boosts', () => { if (!ctx) return; const p = ctx.getPlayer(); if (!p) return; const dead = !(p.hp > 0) || p.alive === false, lost = Math.max(0, (p.maxHp || 0) - (p.hp || 0)); applyStats(p, shipStats(run)); p.hp = dead ? 0 : Math.max(1, Math.min(p.maxHp, p.maxHp - lost)); if (ctx.game.state === 'shop') render(); });

export function initShop(c) {
  ctx = c; setStatsSource((b) => applyBoosts(modeStats(run, PVP() ? PVP_HULL : null), b)); injectCss(); buildDom(); initSkinPreview(c.previewBase || {}); // [Emerly] boosts: the island shop's '2.20 s → 2.07 s' preview. [v164] FIX: v161 had put injectCss / buildDom / initSkinPreview inside this comment (no UPGRADE SHOP DOM)
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (isKey('shop', e.code)) toggle();
    else if (e.code === 'Escape' && ctx.game.state === 'shop' && !$('prest-confirm')?.classList.contains('hidden')) { e.stopImmediatePropagation(); hidePrestConfirm(); } // [prestige] Esc closes the confirm first
    else if (e.code === 'Escape' && ctx.game.state === 'shop') { e.stopImmediatePropagation(); close(); }
  }, true);
  setInterval(() => { const b = $('btn-shop'); if (b) b.classList.toggle('afford', canAfford()); }, 400);
  devHook('PFP_UPGRADES', { openFromIsland: () => open({ island: true }), close, isOpen: () => ctx?.game.state === 'shop', islandPointer }); // [Timothy] island ship shop UPGRADES tab
  devHook('PFP_SHOP', { celebrateUpgrade, open, close, buy, repair, hire, get run() { return run; },
    // test/preview hook: set tiers directly (stats + model), e.g. PFP_SHOP.setLevels({ hull: 1, cannons: 2, armor: 2 })
    setLevels(lv) { for (const u of UPGRADES) run.levels[u.id] = Math.max(0, Math.min(u.tiers.length, lv[u.id] || 0)); setLoadout(run.levels); const p = ctx.getPlayer(); applyStats(p, shipStats(run)); ctx.rebuildShip?.(run.levels); refreshPreviews(); } });
}
