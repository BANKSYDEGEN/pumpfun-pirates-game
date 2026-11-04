// [inventory] THE INVENTORY GRID (BANKSY 11:01-11:03 AM): the HUD MAPS button is now INVENTORY and opens a scrolling grid of item slots
// (icon + count, identical items stack, no slot / stack cap). Tap a slot: OPEN (a treasure map -> the MAPS chart, as before), EQUIP (a
// weapon), GIVE (a player + a quantity), and at a plaza shop SELL (Fish Stand / Antiques) or LIST (Marketplace). The server does every
// move (migration 036); this only shows what it says. Used items leave the grid (a dug / sold / given map, a sold fish...).
import { itemInfo, RARITY_COLOR, FLAGS, MARKET } from './catalog.js';
const CSS = `
#inv-panel{position:fixed;inset:0;z-index:62;display:none;background:rgba(10,7,4,.72);font-family:'Just Another Hand',cursive;color:#f4e2bb;touch-action:manipulation}
#inv-panel.on{display:flex;align-items:center;justify-content:center}
#inv-panel .iv-box{width:min(760px,96vw);max-height:min(92vh,860px);display:flex;flex-direction:column;background:#2a1a0c;border:3px solid #ffcd77;border-radius:16px;box-shadow:0 10px 40px #000}
#inv-panel .iv-head{display:flex;align-items:center;gap:10px;padding:10px 14px 6px;font-size:30px;letter-spacing:.05em;color:#ffcd77}
#inv-panel .iv-head small{font-size:18px;color:#cdb68c;flex:1}
#inv-panel .iv-x{width:44px;height:44px;border-radius:50%;border:2px solid #ffcd77;background:#1a0f07;color:#ffcd77;font-size:22px;cursor:pointer}
#inv-panel .iv-tabs{display:flex;gap:6px;padding:0 14px 6px}
#inv-panel .iv-tabs button{font:20px 'Just Another Hand',cursive;padding:4px 12px 2px;border-radius:10px;border:2px solid rgba(255,205,119,.4);background:#1a0f07;color:#f4e2bb;cursor:pointer}
#inv-panel .iv-tabs button.on{border-color:#ffcd77;background:#5a3410;color:#fff}
#inv-panel .iv-grid{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px;padding:8px 14px 12px}
#inv-panel .iv-slot{position:relative;aspect-ratio:1;min-height:64px;border-radius:12px;border:3px solid #6b4a24;background:radial-gradient(#4a3018,#24160a);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;padding:2px}
#inv-panel .iv-slot.sel{outline:3px solid #fff;outline-offset:1px}
#inv-panel .iv-slot i{font-style:normal;font-size:32px;line-height:1}
#inv-panel .iv-slot span{font-size:14px;line-height:1;color:#e8d3a6;text-align:center;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#inv-panel .iv-slot b{position:absolute;right:4px;bottom:2px;font:bold 15px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000}
#inv-panel .iv-slot em{position:absolute;left:4px;top:2px;font:bold 12px system-ui,sans-serif;font-style:normal;color:#ffcd3c}
#inv-panel .iv-empty{grid-column:1/-1;text-align:center;font-size:24px;color:#cdb68c;padding:30px 0}
#inv-panel .iv-act{border-top:2px solid rgba(255,205,119,.35);padding:8px 14px 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:21px;min-height:56px}
#inv-panel .iv-act .t{flex:1 1 100%;font-size:22px}
#inv-panel .iv-act button{font:22px 'Just Another Hand',cursive;min-height:44px;padding:4px 16px 2px;border-radius:12px;border:2px solid #ffcd77;background:#7a4a10;color:#fff;cursor:pointer}
#inv-panel .iv-act button[disabled]{opacity:.45}
#inv-panel .iv-act input{font:20px system-ui,sans-serif;min-height:40px;width:130px;border-radius:10px;border:2px solid #ffcd77;background:#1a0f07;color:#fff;padding:0 8px}
#inv-panel .iv-act input.n{width:72px}
`;
// [inventory] equip = carry: Raul's raul/items-redo exports setCarriedWeapons({sword, musket}, src) from js/pirateGear.js (he owns the gr sync).
// Feature-checked: before his branch merges the export is missing and the old gear wear path runs instead. The id is the BASE (a SWORD_IDS /
// MUSKET_IDS id), the rarity is a stat layer only, so no new mesh ids are needed.
async function carry(slot, base, pv) {
  try { const G = await import('../pirateGear.js'); if (typeof G.setCarriedWeapons === 'function') { const cur = (typeof G.carriedWeapons === 'function' && G.carriedWeapons()) || {}; G.setCarriedWeapons({ sword: cur.sword ?? null, musket: cur.musket ?? null, [slot]: base }, 'inventory'); return; } } catch {}
  try { pv?.maps?.wear?.(`${slot}:${base}`); } catch {}
}
export function createInventory({ pvp, toast, treasure = null, nearbyPlayers = () => [] }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'inv-panel'; el.innerHTML = '<div class="iv-box"><div class="iv-head">🎒 <span class="iv-title">INVENTORY</span><small></small><button class="iv-x" aria-label="Close">✕</button></div><div class="iv-tabs"></div><div class="iv-grid"></div><div class="iv-act"></div></div>';
  document.body.appendChild(el); for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'keydown' });
  const $ = (s) => el.querySelector(s); let data = { items: [], maps: [], flags: {}, equipped: {} }, mode = 'bag', tab = 'mine', sel = null, listings = [], busy = false;
  el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); }); $('.iv-x').onclick = () => close();
  const slots = () => [...data.items.map(s => ({ key: s.item, qty: s.qty, tradeable: s.tradeable, info: itemInfo(s.item) })).filter(s => s.info),
    ...data.maps.map(m => ({ key: 'map:' + m.id, qty: 1, tradeable: 1, map: m, info: { ...itemInfo('map:' + m.id), rarity: m.tier, name: `${m.tier.toUpperCase()} MAP` } }))];
  const count = () => slots().reduce((a, s) => a + s.qty, 0);
  const shopTakes = (s) => mode === 'fish' ? s.info.kind === 'fish' : mode === 'antiques' ? s.info.kind !== 'fish' : true;
  const price = (s) => mode === 'fish' ? s.info.fish : mode === 'antiques' ? s.info.antiques : 0;
  const sellOn = () => mode === 'fish' ? !!data.flags.fish_sell : mode === 'antiques' ? !!data.flags.antiques_sell : false;
  async function refresh() { const r = await pvp()?.inv?.call('inv_state'); if (r && r.ok) data = r; if (mode === 'market') { const m = await pvp()?.inv?.call('mkt_browse'); listings = m?.ok ? m.listings : []; } render(); return r; }
  function render() {
    const title = { bag: 'INVENTORY', fish: 'FISH STAND', antiques: 'ANTIQUES', market: 'MARKETPLACE' }[mode]; $('.iv-title').textContent = title;
    $('.iv-head small').textContent = mode === 'bag' ? `${count()} items · tap one` : mode === 'market' ? (data.flags.market ? 'buy from pirates · list yours' : 'opens soon') : sellOn() ? 'tap an item to sell' : 'prices coming soon · BANKSY is setting them';
    $('.iv-tabs').innerHTML = mode === 'market' ? `<button data-t="browse" class="${tab === 'browse' ? 'on' : ''}">FOR SALE</button><button data-t="mine" class="${tab === 'mine' ? 'on' : ''}">SELL YOURS</button>` : '';
    $('.iv-tabs').querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.t; sel = null; render(); });
    const g = $('.iv-grid');
    if (mode === 'market' && tab === 'browse') {
      g.innerHTML = listings.length ? listings.map(l => { const i = itemInfo(l.item) || { icon: '❔', name: l.item, rarity: 'common' };
        return `<div class="iv-slot${sel === 'L' + l.id ? ' sel' : ''}" data-l="${l.id}" style="border-color:${RARITY_COLOR[i.rarity] || '#6b4a24'}"><em>${l.price.toLocaleString()}g</em><i>${i.icon}</i><span>${i.name}</span><b>${l.qty > 1 ? '×' + l.qty : ''}</b></div>`; }).join('') : '<div class="iv-empty">nothing for sale yet</div>';
      g.querySelectorAll('[data-l]').forEach(d => d.onclick = () => { sel = 'L' + d.dataset.l; render(); });
    } else {
      const list = slots().filter(shopTakes);
      g.innerHTML = list.length ? list.map(s => `<div class="iv-slot${sel === s.key ? ' sel' : ''}" data-k="${s.key}" style="border-color:${RARITY_COLOR[s.info.rarity] || '#6b4a24'}">${mode !== 'bag' && mode !== 'market' ? `<em>${price(s).toLocaleString()}g</em>` : ''}<i>${s.info.icon}</i><span>${s.info.name}</span><b>${s.qty > 1 ? '×' + s.qty : ''}</b></div>`).join('')
        : `<div class="iv-empty">${mode === 'fish' ? 'no fish yet · cast a line at Grandpa Gill\'s dock' : mode === 'bag' ? 'empty · dig treasure, fish, explore the island' : 'nothing this shop buys'}</div>`;
      g.querySelectorAll('[data-k]').forEach(d => d.onclick = () => { sel = d.dataset.k; render(); });
    }
    actions();
  }
  function actions() {
    const a = $('.iv-act');
    if (sel && sel.startsWith('L')) { const l = listings.find(x => 'L' + x.id === sel); if (!l) { a.innerHTML = ''; return; } const i = itemInfo(l.item) || { name: l.item };
      a.innerHTML = `<div class="t">${i.name}${l.qty > 1 ? ' ×' + l.qty : ''} · <b>${l.price.toLocaleString()} gold</b> · from ${l.seller}</div>` + (l.mine ? '<button data-a="cancel">TAKE BACK</button>' : `<button data-a="buy"${data.flags.market ? '' : ' disabled'}>BUY</button>`);
      bind(a, { buy: () => run('mkt_buy', { listing: l.id }, `BOUGHT ${i.name}`), cancel: () => run('mkt_cancel', { listing: l.id }, 'BACK IN YOUR INVENTORY') }); return; }
    const s = slots().find(x => x.key === sel); if (!s) { a.innerHTML = mode === 'bag' ? '<div class="t">tap an item</div>' : ''; return; }
    const n = s.qty > 1 ? `<input class="n" type="number" min="1" max="${s.qty}" value="1" aria-label="quantity">` : '', locked = !s.tradeable;
    let h = `<div class="t">${s.info.name}${s.qty > 1 ? ' ×' + s.qty : ''} <small>· ${s.info.rarity}${locked ? ' · bought with gold: keep it, it can\'t be resold' : ''}</small></div>`;
    if (mode === 'bag') { if (s.map) h += '<button data-a="open">OPEN MAP</button>'; if (s.info.kind === 'weapon') h += `<button data-a="equip">${data.equipped[s.info.slot] === s.key ? 'EQUIPPED' : 'EQUIP'}</button>`;
      h += `${n}<input class="to" list="iv-near" placeholder="pirate name" aria-label="give to"><datalist id="iv-near">${nearbyPlayers().map(p => `<option value="${p}">`).join('')}</datalist><button data-a="give"${locked || !data.flags.gift ? ' disabled' : ''}>GIVE</button>`; }
    else if (mode === 'market') h += `${n}<input class="pr" type="number" min="${MARKET.minPrice}" max="${MARKET.maxPrice}" placeholder="price" aria-label="price"><button data-a="list"${locked || !data.flags.market ? ' disabled' : ''}>LIST</button>`;
    else h += `${n}<button data-a="sell"${locked || !sellOn() ? ' disabled' : ''}>SELL · ${price(s).toLocaleString()}g each</button>`;
    a.innerHTML = h; const q = () => Math.max(1, Math.min(s.qty, +(a.querySelector('.n')?.value || 1) | 0));
    bind(a, { open: () => { close(); treasure?.openMap?.(s.map.id); },
      equip: () => run('inv_equip', { item: s.key }, (r) => { carry(r.slot, r.base, pvp()); window.PFP_WEAPON_RARITY = { ...(window.PFP_WEAPON_RARITY || {}), [r.slot]: r.rarity }; return 'EQUIPPED ' + s.info.name; }), // the look = the base (gear slot); the rarity stats: catalog weaponStats() (battle.js hook, see report)
      give: () => { const to = a.querySelector('.to').value.trim(); if (!to) return toast('WHO GETS IT?<br><small>type a pirate name</small>', 1800); run('inv_gift', { item: s.key, qty: q(), to }, `SENT ${q()} × ${s.info.name} TO ${to.toUpperCase()}`); },
      sell: () => run('inv_sell', { item: s.key, qty: q(), shop: mode }, (r) => `SOLD · +${(r.gold | 0).toLocaleString()} GOLD${r.mult > 1 ? `<br><small>pet bonus ×${(+r.mult).toFixed(2)}</small>` : ''}`),
      list: () => run('mkt_list', { item: s.key, qty: q(), price: +(a.querySelector('.pr').value || 0) | 0 }, 'LISTED ON THE MARKETPLACE') });
  }
  const bind = (a, fns) => a.querySelectorAll('[data-a]').forEach(b => b.onclick = () => fns[b.dataset.a]?.());
  const WHY = { 'shop closed': 'THE SHOP ISN\'T BUYING YET', 'not enough': 'YOU DON\'T HAVE THAT MANY', 'slow down': 'SLOW DOWN A MOMENT', 'not to yourself': 'YOU CAN\'T GIVE YOURSELF THINGS', 'no such pirate': 'NO PIRATE BY THAT NAME',
    'name not unique': 'SEVERAL PIRATES HAVE THAT NAME', 'not enough gold': 'NOT ENOUGH GOLD', 'gone': 'ALREADY SOLD', 'your own listing': 'THAT\'S YOUR OWN LISTING', 'bad price': `PRICE ${MARKET.minPrice}-${MARKET.maxPrice.toLocaleString()} GOLD`, 'too many listings': `MAX ${MARKET.maxActive} LISTINGS`, 'market closed': 'THE MARKETPLACE OPENS SOON', 'gifts closed': 'GIFTS ARE OFF' };
  async function run(action, body, okMsg) { if (busy) return; busy = true;
    try { const r = await pvp()?.inv?.call(action, body); if (r && r.ok) { toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 2400); sel = null; await refresh(); if (action !== 'inv_equip') treasure?.refresh?.(); }
      else toast(WHY[r?.error] || 'THAT DIDN\'T WORK<br><small>check your connection</small>', 2200); } finally { busy = false; } }
  function open(m = 'bag') { mode = m; tab = m === 'market' ? 'browse' : 'mine'; sel = null; el.classList.add('on'); render(); refresh(); }
  function close() { el.classList.remove('on'); }
  window.addEventListener('pfp-shop', (e) => open(e.detail?.shop || 'bag'));
  // island earnings -> the server (it decides what lands in the bag): a reeled-in fish (server-rolled species), an idol shard / river pearl
  window.addEventListener('pfp-catch', async () => { const r = await pvp()?.inv?.call('inv_fish'); if (r?.ok) { const i = itemInfo(r.item); setTimeout(() => toast(`${i.icon} ${i.name.toUpperCase()} · IN YOUR INVENTORY`, 2000), 2600); refresh(); } });
  window.addEventListener('pfp-find', async (e) => { const r = await pvp()?.inv?.call('inv_find', e.detail || {}); if (r?.ok) refresh(); });
  return { open, close, refresh, get isOpen() { return el.classList.contains('on'); }, get count() { return count(); }, get data() { return data; }, render, _setData(d) { data = { ...data, ...d }; render(); }, _setListings(l) { listings = l; render(); } };
}
export const INV_FLAGS = FLAGS;
