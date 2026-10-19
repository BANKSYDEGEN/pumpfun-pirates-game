// [Raul] ship upgrades — SHOP button (top HUD row) + shipwright overlay.
// Tap SHOP (or press U / B) to pause and open the shop; close (or U / B / Esc) to resume.
// In-game gold only. Nothing here touches a wallet, token, NFT or the leaderboard.
import { UPGRADES, REPAIR, newRun, shipStats, applyStats, fmtStat } from './upgrades.js';

let ctx = null, run = newRun();
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
      <button id="shop-repair" class="buy">REPAIR +${REPAIR.hp} · ${REPAIR.cost}g</button></div>
    <div id="shop-grid" class="shop-grid"></div>
    <button id="shop-close" class="big">BACK TO BATTLE</button>
    <div class="shop-keys muted">U / B / Esc to close</div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
  $('shop-close').onclick = close;
  $('shop-repair').onclick = repair;
  const grid = $('shop-grid');
  for (const u of UPGRADES) {
    const c = document.createElement('div'); c.className = 'shop-card'; c.dataset.id = u.id;
    c.innerHTML = `<div class="sc-top"><span class="sc-ico txt">${u.icon}</span><span class="sc-name">${u.name}</span></div>
      <div class="sc-pips">${u.tiers.map(() => '<i></i>').join('')}</div>
      <div class="sc-stat"></div><button class="buy"></button>`;
    c.querySelector('.buy').onclick = () => buy(u.id);
    grid.appendChild(c);
  }
}

function render() {
  if (!ctx) return;
  const { game } = ctx, p = ctx.getPlayer();
  $('shop-gold').textContent = game.gold;
  $('shop-hp').querySelector('.fill').style.width = `${(p.hp / p.maxHp) * 100}%`;
  $('shop-hp').querySelector('.hp-txt').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  const rb = $('shop-repair'); rb.disabled = p.hp >= p.maxHp || game.gold < REPAIR.cost;
  rb.textContent = p.hp >= p.maxHp ? 'HULL IS SOUND' : `REPAIR +${REPAIR.hp} · ${REPAIR.cost}g`;
  const stats = shipStats(run);
  for (const u of UPGRADES) {
    const c = $('shop-grid').querySelector(`[data-id="${u.id}"]`), lv = run.levels[u.id];
    c.querySelectorAll('.sc-pips i').forEach((el, i) => el.classList.toggle('on', i < lv));
    const b = c.querySelector('.buy'), next = u.tiers[lv];
    if (!next) { c.querySelector('.sc-stat').innerHTML = `<b>${fmtStat(u, stats[u.stat])}</b>`; b.textContent = 'MAXED'; b.disabled = true; c.classList.add('max'); continue; }
    c.classList.remove('max');
    c.querySelector('.sc-stat').innerHTML = `${fmtStat(u, stats[u.stat])} <span class="arrow">→</span> <b>${fmtStat(u, next.value)}</b>`;
    b.textContent = `${next.cost}g`; b.disabled = game.gold < next.cost;
  }
}

function canAfford() {
  if (!ctx) return false;
  const g = ctx.game.gold;
  return UPGRADES.some(u => { const t = u.tiers[run.levels[u.id]]; return t && g >= t.cost; });
}

function buy(id) {
  const u = UPGRADES.find(x => x.id === id), lv = run.levels[id], t = u && u.tiers[lv];
  if (!t || ctx.game.gold < t.cost) return;
  ctx.game.gold -= t.cost; ctx.game.goldSpent = (ctx.game.goldSpent || 0) + t.cost; run.spent += t.cost;
  run.levels[id]++;
  applyStats(ctx.getPlayer(), shipStats(run));
  ctx.sfx?.coin?.();
  ctx.updateHud(); render();
}
function repair() {
  const p = ctx.getPlayer();
  if (p.hp >= p.maxHp || ctx.game.gold < REPAIR.cost) return;
  ctx.game.gold -= REPAIR.cost; ctx.game.goldSpent = (ctx.game.goldSpent || 0) + REPAIR.cost;
  p.hp = Math.min(p.maxHp, p.hp + REPAIR.hp);
  ctx.sfx?.coin?.(); ctx.updateHud(); render();
}

export function open() {
  if (!ctx || ctx.game.state !== 'playing' || !ctx.getPlayer().alive) return;
  ctx.game.state = 'shop';
  render(); $('shop').classList.remove('hidden');
}
export function close() {
  if (!ctx || ctx.game.state !== 'shop') return;
  ctx.game.state = 'playing'; $('shop').classList.add('hidden');
}
export function toggle() { if (ctx?.game.state === 'shop') close(); else open(); }

// New run: wipe upgrades and give the fresh player ship the base stats.
export function resetShop() {
  run = newRun();
  if (ctx) { ctx.game.goldSpent = 0; const p = ctx.getPlayer(); p.maxHp = 0; applyStats(p, shipStats(run)); p.hp = p.maxHp; }
  $('shop')?.classList.add('hidden');
}

export function initShop(c) {
  ctx = c; injectCss(); buildDom();
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyU' || e.code === 'KeyB') toggle();
    else if (e.code === 'Escape' && ctx.game.state === 'shop') { e.stopImmediatePropagation(); close(); }
  }, true);
  setInterval(() => { const b = $('btn-shop'); if (b) b.classList.toggle('afford', canAfford()); }, 400);
  window.PFP_SHOP = { open, close, buy, repair, get run() { return run; } };
}
