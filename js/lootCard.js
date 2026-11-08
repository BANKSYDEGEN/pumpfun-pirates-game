import { itemIconHtml } from './inventory/itemIcon.js';
// [v370] BANKSY t1966u/t1967u: a clear LOOT card when you pick something up: the gold (+ holder / pet bonus) and every item, with icons.
// One card at a time near the top-centre; a new pickup inside 1.2 s merges into the card that is showing.
import { escHtml } from './safe.js';
let el = null, hideT = 0, cur = null;
function mount() {
  if (el) return el;
  const st = document.createElement('style');
  st.textContent = `#loot-card{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 92px);transform:translate(-50%,-12px) scale(.92);opacity:0;pointer-events:none;z-index:60;
min-width:220px;max-width:min(88vw,380px);padding:10px 14px 12px;border-radius:14px;background:linear-gradient(180deg,rgba(40,24,10,.94),rgba(22,13,6,.94));border:2px solid #e8b44a;
box-shadow:0 6px 24px rgba(0,0,0,.5),0 0 18px rgba(255,200,80,.25);color:#fff4dc;font:600 14px/1.25 system-ui,sans-serif;text-align:center;transition:opacity .18s,transform .18s}
#loot-card.on{opacity:1;transform:translate(-50%,0) scale(1)}
#loot-card .lc-t{font:800 12px/1 system-ui,sans-serif;letter-spacing:.12em;color:#e8b44a;margin-bottom:6px}
#loot-card .lc-g{font:900 28px/1.05 system-ui,sans-serif;color:#ffd257;text-shadow:0 2px 0 #6b3c00}
#loot-card .lc-b{font-size:12px;color:#ffe9a8;opacity:.9;margin-top:2px}
#loot-card .lc-i{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:8px}
#loot-card .lc-i span{background:rgba(255,255,255,.08);border:1px solid rgba(232,180,74,.45);border-radius:8px;padding:3px 7px;font-size:13px;white-space:nowrap}
#loot-card .lc-n{font-size:12px;color:#ffb38a;margin-top:6px}
@media (max-width:600px){#loot-card{top:calc(env(safe-area-inset-top,0px) + 64px)}#loot-card .lc-g{font-size:24px}}`;
  document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'loot-card'; document.body.appendChild(el); return el;
}
/** show({ title, from, gold, bonus, items: [{ icon, iconImage, name, qty }], note }) */
export function showLootCard(o = {}) {
  try {
    const now = performance.now();
    if (cur && now - cur.t < 1200 && (!o.from || !cur.from || o.from === cur.from)) {
      cur.gold += o.gold | 0; cur.bonus += o.bonus | 0; for (const it of o.items || []) { const m = cur.items.find(x => x.name === it.name); if (m) m.qty += it.qty | 0 || 1; else cur.items.push({ ...it, qty: it.qty | 0 || 1 }); }
      if (o.note) cur.note = o.note; cur.t = now;
    } else cur = { t: now, title: o.title || 'LOOT', from: o.from || '', gold: o.gold | 0, bonus: o.bonus | 0, items: (o.items || []).map(it => ({ ...it, qty: it.qty | 0 || 1 })), note: o.note || '' };
    const c = mount();
    c.innerHTML = `<div class="lc-t">${escHtml(cur.title)}${cur.from ? ' · ' + escHtml(String(cur.from).toUpperCase()) : ''}</div>`
      + (cur.gold ? `<div class="lc-g">🪙 +${cur.gold.toLocaleString()} GOLD</div>${cur.bonus ? `<div class="lc-b">incl. +${cur.bonus.toLocaleString()} bonus</div>` : ''}` : '')
      + (cur.items.length ? `<div class="lc-i">${cur.items.slice(0, 12).map(it => `<span>${itemIconHtml(it, '📦')} ${escHtml(it.name || 'item')}${it.qty > 1 ? ' ×' + it.qty : ''}</span>`).join('')}${cur.items.length > 12 ? `<span>+${cur.items.length - 12} more</span>` : ''}</div>` : '')
      + (cur.note ? `<div class="lc-n">${escHtml(cur.note)}</div>` : '');
    c.classList.add('on'); clearTimeout(hideT); hideT = setTimeout(() => { c.classList.remove('on'); cur = null; }, cur.items.length ? 3600 : 2600);
  } catch {}
}
