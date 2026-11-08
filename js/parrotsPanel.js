import { itemImg, treatArt } from './inventory/itemArt.js';
import { itemIconHtml } from './inventory/itemIcon.js';
import { parrotBoostText, parrotBoostNext } from './boosts.js';
import { parrotPreviewEl, releaseParrotPreviews } from './parrotFlight.js';
// Hull cage: each bird is a real inventory instance. Never computes gold or grants colors locally.
export const PARROT_COLORS = [
  ['parrot_green', 'DEFAULT', 0, '#3fd16a'], ['parrot_red', 'RED', 1, '#e8231d'],
  ['parrot_blue', 'BLUE', 2, '#1e74e8'], ['parrot_cockatoo', 'WHITE', 4, '#f6f4ee'],
  ['parrot_black', 'BLACK', 6, '#383842'], ['parrot_gold', 'GOLD', 8, '#ffc21f'],
  ['parrot_diamond', 'DIAMOND', 10, '#bfe8ff'],
];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS = `
#parrot-cage-panel{position:fixed;inset:0;z-index:10040;background:#000b;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;color:#fff;font:24px/1.1 var(--ui-font,'Just Another Hand',cursive)}
#parrot-cage-panel[hidden]{display:none}#parrot-cage-panel *{box-sizing:border-box}
#parrot-cage-panel .pc-box{width:min(760px,100%);max-height:90dvh;display:flex;flex-direction:column;border:3px solid #ffcd77;border-radius:12px;background:linear-gradient(135deg,#24160e,#100d0b);box-shadow:0 16px 60px #000b;overflow:hidden}
#parrot-cage-panel header{display:flex;align-items:center;gap:10px;background:#332013;border-bottom:2px solid #ffcd7766;padding:12px 16px;color:#ffcd77;font-size:32px}#parrot-cage-panel header b{flex:1}#parrot-cage-panel button,#parrot-cage-panel input{font:inherit;color:inherit;border:2px solid #ffcd7777;border-radius:8px;background:#21160f;padding:8px;min-height:44px}#parrot-cage-panel button{cursor:pointer}#parrot-cage-panel button:disabled{opacity:.45;cursor:default}#parrot-cage-panel button.on{border-color:#ffcd77;background:#6c4720}#parrot-cage-panel .pc-list{padding:14px;overflow-y:auto;overscroll-behavior:contain}#parrot-cage-panel article{border:2px solid #ffcd7755;border-radius:10px;margin-bottom:14px;padding:12px}#parrot-cage-panel .pc-top{display:flex;gap:12px;align-items:center}#parrot-cage-panel .pc-preview{width:104px;height:104px;object-fit:contain;background:#0004;border-radius:8px}#parrot-cage-panel .pc-top b{font-size:30px;color:#ffcd77}#parrot-cage-panel small{display:block;color:#ddc9a4;font-size:19px;margin:4px 0}#parrot-cage-panel .pc-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}#parrot-cage-panel input{flex:1;min-width:100px}#parrot-cage-panel .pc-colors{display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:6px;margin-top:10px}#parrot-cage-panel .pc-colors i{display:block;width:24px;height:24px;border-radius:50%;border:1px solid #ffcd77;margin:0 auto 4px}#parrot-cage-panel .pc-bar{height:8px;background:#0008;margin-top:8px;border-radius:6px;overflow:hidden}#parrot-cage-panel .pc-bar i{height:100%;display:block;background:#ffcd77}#parrot-cage-panel footer{padding:10px 16px;border-top:1px solid #ffcd7766;font-size:20px}#parrot-cage-panel [role=status]{color:#ffcd77;padding:8px 16px;min-height:32px}
@media(max-width:440px){#parrot-cage-panel .pc-preview{width:78px;height:78px}#parrot-cage-panel .pc-list{padding:8px}#parrot-cage-panel header{font-size:27px}}
`;
export function createParrotsPanel(ctx) {
  let root, birds = [], equipped = null, busy = false, walkT = 0;
  const call = async (a, b = {}) => { try { return await ctx.call(a, b) || { ok: false, why: 'offline' }; } catch { return { ok: false, why: 'offline' }; } };
  function status(s) { if (root) root.querySelector('[role=status]').textContent = s; }
  function ensure() {
    if (root) return;
    const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
    root = document.createElement('div'); root.id = 'parrot-cage-panel'; root.hidden = true;
    root.innerHTML = '<section class="pc-box" role="dialog" aria-modal="true" aria-label="Parrot cage"><header><b>🦜 PARROT CAGE</b><button data-close aria-label="Close">✕</button></header><div class="pc-list"></div><div role="status" aria-live="polite"></div><footer>Name & upgrade here · equip from your inventory · list individual parrots at the Marketplace. Boosts come from the equipped parrot\'s LEVEL (color is cosmetic) and grow every level: gold find from LV 0, dig luck from LV 3, sell bonus from LV 6, sword + musket hit at LV 10. Colors unlock at levels 1, 2, 4, 6, 8 & 10.</footer></section>';
    root.querySelector('[data-close]').onclick = close;
    root.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === root) close(); });
    root.addEventListener('click', act);
    for (const ev of ['keyup', 'mousedown', 'touchstart', 'wheel']) root.addEventListener(ev, e => e.stopPropagation(), { passive: true });
    window.addEventListener('keydown', e => { if (root.hidden) return; if (e.code === 'Escape') { close(); e.preventDefault(); } e.stopImmediatePropagation(); }, true);
    document.body.append(root);
  }
  function draw() {
    if (!root || root.hidden) return;
    root.querySelector('.pc-list').innerHTML = birds.length ? birds.map(p => {
      const lv = p.lv | 0, xp = p.xp | 0, progress = lv >= 10 ? 100 : Math.max(0, Math.min(100, (xp - lv * lv * 100) / ((lv + 1) ** 2 * 100 - lv * lv * 100) * 100));
      return `<article data-id="${p.id}"><div class="pc-top"><img class="pc-preview" alt="${esc(p.color.replace('parrot_', ''))} parrot preview" loading="lazy" decoding="async" src="${itemImg('par:' + p.id, { kind: 'parrot', color: p.color })}" onerror="this.replaceWith(document.createTextNode('🦜'))"><div><b>${esc(p.name || 'Parrot')}</b><small>LV ${lv} · ${xp.toLocaleString()} XP${p.id === equipped ? ' · EQUIPPED' : ''}</small><small>🪙 ${esc(parrotBoostText(lv))}</small><small>${esc(parrotBoostNext(lv))}</small><small>Inventory bird #${p.id.slice(0, 8)}</small></div></div><div class="pc-bar"><i style="width:${progress}%"></i></div><div class="pc-row"><input data-name maxlength="16" aria-label="Parrot name" value="${esc(p.name || '')}" placeholder="Name your parrot"><button data-a="name">SAVE NAME</button></div><div class="pc-row"><button data-a="equip" class="${p.id === equipped ? 'on' : ''}">EQUIP PARROT</button><button data-a="treat"${lv >= 10 ? ' disabled' : ''}>${lv >= 10 ? 'MAX LEVEL' : `${itemIconHtml({ icon: '🍎', iconImage: treatArt })} TREAT +100 XP · ${(250 * (lv + 1) ** 2).toLocaleString()}g`}</button></div><div class="pc-colors">${PARROT_COLORS.map(([id, name, need, hex]) => `<button data-a="color" data-color="${id}" class="${p.color === id ? 'on' : ''}"${!p.colors?.includes(id) ? ' disabled' : ''}><i style="background:${hex}"></i>${name}${lv < need ? `<small>🔒 LV ${need}</small>` : ''}</button>`).join('')}</div></article>`;
    }).join('') : '<p>No parrots aboard. Buy a base parrot at the Pet Store, or trade for one at the Marketplace.</p>';
    for (const card of root.querySelectorAll('article[data-id]')) {
      const p = birds.find(p => p.id === card.dataset.id); if (!p) continue;
      const preview = parrotPreviewEl(p.color); preview.classList.add('pc-preview'); preview.style.height = '52px'; preview.style.flexShrink = '0'; card.querySelector('.pc-preview')?.replaceWith(preview);
    }
    if (busy) root.querySelectorAll('button[data-a]').forEach(b => b.disabled = true);
  }
  async function load() {
    const r = await call('parrot_list');
    if (!r.ok) { status(r.why || r.error || 'Could not load parrots. Reopen to retry.'); return; }
    birds = r.parrots || []; equipped = r.equipped;
    draw();
    const p = birds.find(p => p.id === equipped);
    window.dispatchEvent(new CustomEvent('pfp-parrot', { detail: p || null }));
  }
  async function act(e) {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled || busy) return;
    const card = b.closest('[data-id]'); if (!card) return;
    const op = b.dataset.a; busy = true; status('Saving…');
    if (op === 'treat') await ctx.flush?.();
    const r = await call('parrot_' + op, { id: card.dataset.id, name: card.querySelector('[data-name]')?.value, color: b.dataset.color });
    if (r.ok) {
      if (r.gold != null) ctx.gold?.(r);
      if (op === 'equip' || op === 'color') await ctx.equip?.(r.color);
      status('Saved · your parrot stays with its inventory item.');
    } else status(r.why || r.error || 'Could not save. Try again.');
    busy = false; await load();
  }
  function open() { ensure(); root.hidden = false; status('Loading parrots…'); draw(); load(); root.querySelector('[data-close]').focus(); }
  function close() { if (root) { releaseParrotPreviews(root); root.hidden = true; } }
  async function tick(dt) {
    walkT += dt; if (walkT < 60) return; walkT = 0;
    if (!ctx.out?.() || !String(ctx.equipped?.()).startsWith('parrot_') || document.hidden) return;
    const r = await call('parrot_walk'); if (r.ok && root && !root.hidden) await load();
  }
  return { open, close, load, tick, get isOpen() { return !!root && !root.hidden; } };
}
