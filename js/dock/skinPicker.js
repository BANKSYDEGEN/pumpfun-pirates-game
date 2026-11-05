// [dock-skin] BANKSY 8:41 PM "at their ship they can choose what skin to equip that they own, while on land at dock looking at ship"
// + 8:42 PM "E to board, Q to change skin". At your own berth (on foot, the BOARD SHIP spot): Q / phone CHANGE SKIN / pad X opens
// SHIPYARD · CHOOSE YOUR SKIN. Lists only the skins you can use (owned on the server, prestige grants, owner = all), cheapest first,
// data-driven from the Ship Shop catalog (SKIN_ITEMS) + any registered PvP tier / unlock skin, so new skins show up on their own.
// Picking one goes through the Ship Shop's own equip (islandShop provider.equip -> pvp.js canUse + rebuildShip: one ship rebuilt,
// the old one disposed by main.js rebuildPlayerShip). No purchase path here.
import { SKIN_ITEMS } from '../shopCatalog.js';
import { TIERS, UNLOCKS, canUse, pvpSkin, skinName } from '../pvpSkins.js';
import { skinSwatch } from '../skins.js';
import { getShopProvider } from '../islandShop.js';

const CSS = `#dk-skins{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}
#dk-skins.on{display:flex}html.dk-skins-open #dk-acts{visibility:hidden!important}#dk-skins .ds-box{background:#2a1c12;border:3px solid #d9a441;border-radius:14px;padding:14px;width:min(92vw,560px);max-height:82vh;display:flex;flex-direction:column;color:#fff1d2;font-family:inherit}
#dk-skins h3{margin:0 0 10px;font-size:18px;color:#ffd36b;letter-spacing:1px;display:flex;justify-content:space-between;align-items:center}
#dk-skins h3 button{background:#161616;color:#fff1d2;border:2px solid #d9a441;border-radius:8px;padding:4px 10px;font:inherit;cursor:pointer}
#dk-skins .ds-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;overflow:auto}
#dk-skins .ds-card{background:#161616;border:2px solid #6b4a24;border-radius:10px;padding:6px;color:#fff1d2;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}
#dk-skins .ds-card canvas{width:96px;height:48px;border-radius:6px}#dk-skins .ds-card canvas.sk-real{width:100%;height:auto;aspect-ratio:9/5}#dk-skins .ds-card b{font-size:12px}#dk-skins .ds-card small{font-size:11px;color:#d9a441}
#dk-skins .ds-card.on{border-color:#ffd36b;box-shadow:0 0 10px rgba(255,211,107,.6)}#dk-skins .ds-card:focus{outline:3px solid #fff}
#dk-skins .ds-msg{margin-top:8px;font-size:12px;color:#d9a441;min-height:14px}`;

// every skin the catalog knows, priced (Ship Shop price; unpriced tier / unlock skins sort after by name)
export function skinList() {
  const seen = new Map();
  for (const it of SKIN_ITEMS) seen.set(it.id, { id: it.id, name: it.name, price: +it.price || 0 });
  for (const t of [...(TIERS || []), ...(UNLOCKS || [])]) if (t?.id && !seen.has(t.id)) seen.set(t.id, { id: t.id, name: t.name || skinName(t.id), price: +t.price || 0 });
  return [...seen.values()].filter(s => canUse(s.id)).sort((a, b) => (a.price - b.price) || a.name.localeCompare(b.name));
}

export function createSkinPicker({ current, onClose }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'dk-skins';
  root.innerHTML = '<div class="ds-box"><h3><span>SHIPYARD · CHOOSE YOUR SKIN</span><button type="button" class="ds-x">✕</button></h3><div class="ds-grid"></div><div class="ds-msg"></div></div>';
  document.body.appendChild(root);
  const grid = root.querySelector('.ds-grid'), msg = root.querySelector('.ds-msg'); let busy = false;
  // [dock-skin previews] BANKSY 8:49 PM: real rendered ships, not swatches. js/skinPreview.js (the Ship Shop's): one shared offscreen
  // renderer draws each skin once into a cached 2D bitmap (idle, one at a time); its GL context is released when the panel closes.
  let prev = null; const loadPrev = () => prev || (prev = import('../skinPreview.js').catch(() => null));
  const close = () => { if (!root.classList.contains('on')) return; root.classList.remove('on'); document.documentElement.classList.remove('dk-skins-open'); grid.innerHTML = ''; prev?.then(m => m?.releaseRenderer?.()); onClose?.(); };
  root.querySelector('.ds-x').onclick = (e) => { e.stopPropagation(); close(); };
  root.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === root) close(); });
  function render() {
    const cur = current(); grid.innerHTML = ''; // swatch canvases are plain 2D canvases (no GL), dropped with the cards
    for (const s of skinList()) {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'ds-card' + (s.id === cur ? ' on' : ''); c.dataset.skin = s.id;
      c.appendChild(skinSwatch(pvpSkin(s.id), 96, 48));
      c.insertAdjacentHTML('beforeend', `<b>${s.name}</b><small>${s.id === cur ? '✓ EQUIPPED' : 'TAP TO USE'}</small>`);
      c.onclick = (e) => { e.stopPropagation(); pick(s.id); };
      c.onpointerenter = c.onfocus = () => getShopProvider()?.prewarm?.('skin', s.id); // [skin-swap-perf] hover / pad focus = likely pick
      grid.appendChild(c);
    }
    grid.querySelector('.on, .ds-card')?.focus?.({ preventScroll: true });
    const list = [...grid.querySelectorAll('.ds-card')].map(c => ({ id: c.dataset.skin, skin: pvpSkin(c.dataset.skin) }));
    { const P = getShopProvider(), N = matchMedia('(pointer: coarse)').matches ? 2 : 4; skinList().filter(s => s.id !== cur).slice(0, N).forEach(s => P?.prewarm?.('skin', s.id)); } // [skin-swap-perf] the first few cards
    loadPrev().then(m => { if (m && root.classList.contains('on')) try { m.previewCards(grid, list, {}, { pvp: true }); } catch (e) { console.warn('[dock-skin] preview', e); } });
  }
  async function pick(id) {
    if (busy || id === current()) return; const p = getShopProvider();
    if (!p?.equip) { msg.textContent = 'shipyard offline'; return; }
    busy = true; msg.textContent = '';
    try { await p.equip('skin', id); } catch (e) { console.warn('[dock-skin]', e); msg.textContent = 'could not change skin'; }
    busy = false; if (current() !== id && !msg.textContent) msg.textContent = 'not yours yet'; render();
  }
  return { open() { msg.textContent = ''; render(); root.classList.add('on'); document.documentElement.classList.add('dk-skins-open'); }, close, get isOpen() { return root.classList.contains('on'); } };
}
