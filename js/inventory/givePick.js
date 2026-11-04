// [give-dropdown] the GIVE picker (BANKSY 4:59 PM "on inventory give do a drop down of all current players", 5:00 PM "make sure the ui is
// nice"). A sheet over the inventory: who is online now (every harbor copy + the arenas, from the pvp inv_online action: display names only)
// with the pirates in YOUR harbor copy first (tagged), then A-Z; a search box that is also the typed-name fallback; loading + empty states;
// then a confirm step (the item, the count, the pirate) before inv_gift runs. Touch, mouse + keyboard (arrows / Enter / Esc) and the v223
// pad (#iv-pick + #iv-pick-ok are focus layers in js/gamepad.js: D-pad walks the rows, A picks, B goes back one step).
const CSS = `
#iv-pick,#iv-pick-ok{position:fixed;inset:0;z-index:64;display:flex;align-items:center;justify-content:center;background:rgba(10,7,4,.6);font-family:'Just Another Hand',cursive;color:#f4e2bb;
 visibility:hidden;opacity:0;transition:opacity .18s ease,visibility 0s linear .18s;touch-action:manipulation}
#iv-pick.on,#iv-pick-ok.on{visibility:visible;opacity:1;transition:opacity .18s ease}
#iv-pick-ok{z-index:65;background:rgba(10,7,4,.45)}
.gp-box{width:min(440px,94vw);height:min(600px,84vh);display:flex;flex-direction:column;background:linear-gradient(#33200e,#24160a);border:3px solid #ffcd77;border-radius:16px;
 box-shadow:0 12px 40px #000,inset 0 0 0 2px #6b4a24;transform:translateY(14px) scale(.97);transition:transform .2s cubic-bezier(.2,1.3,.4,1)}
.on>.gp-box{transform:none}
.gp-head{display:flex;align-items:center;gap:10px;padding:10px 14px 4px;font-size:32px;letter-spacing:.05em;color:#ffcd77;flex:none}
.gp-head span{flex:1}
.gp-x{width:44px;height:44px;border-radius:50%;border:2px solid #ffcd77;background:#1a0f07;color:#ffcd77;font-size:22px;cursor:pointer;flex:none}
.gp-item{display:flex;align-items:center;gap:10px;margin:0 14px 8px;padding:6px 10px;border-radius:12px;background:#1a0f07;border:2px solid #6b4a24;font-size:22px;flex:none;min-height:52px}
.gp-item i{font-style:normal;font-size:30px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex:none}
.gp-item i img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 2px rgba(0,0,0,.55))}
.gp-q{margin:0 14px 8px;flex:none;font:20px system-ui,sans-serif;height:46px;border-radius:12px;border:2px solid #ffcd77;background:#1a0f07 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%23ffcd77' stroke-width='2.5'%3E%3Ccircle cx='8.5' cy='8.5' r='6'/%3E%3Cpath d='M13 13l5 5'/%3E%3C/svg%3E") no-repeat 12px center;color:#fff;padding:0 12px 0 40px;outline:none}
.gp-q:focus{box-shadow:0 0 0 3px rgba(255,205,119,.35)}
.gp-sub{margin:0 16px 4px;font-size:19px;color:#cdb68c;flex:none;min-height:22px}
.gp-list{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:2px 14px 14px;display:flex;flex-direction:column;gap:6px}
.gp-row{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:4px 12px 2px;border-radius:12px;border:2px solid #6b4a24;background:radial-gradient(circle at 20% 50%,#4a3018,#2a1a0c);
 color:#f4e2bb;font:25px 'Just Another Hand',cursive;text-align:left;cursor:pointer;flex:none;transition:background .12s,border-color .12s}
.gp-row:hover,.gp-row:focus-visible{border-color:#ffcd77;background:#5a3410;outline:none}
html.pfp-pad #iv-pick .gp-row.pad-focus,#iv-pick .gp-row.pad-focus{outline:3px solid #fff !important;outline-offset:-5px !important;border-color:#ffcd77;background:#7a4a10;box-shadow:0 0 14px 2px rgba(255,205,119,.7) !important}
.gp-row b{flex:1;font-weight:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:.02em}
.gp-row .av{width:34px;height:34px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font:bold 17px system-ui,sans-serif;color:#161616;background:#ffcd77}
.gp-row em{font:bold 12px system-ui,sans-serif;font-style:normal;letter-spacing:.06em;padding:3px 8px;border-radius:9px;flex:none}
.gp-row em.h{background:#ffcd77;color:#161616} .gp-row em.a{background:transparent;color:#cdb68c;border:1px solid rgba(205,182,140,.5)}
.gp-row.typed{border-style:dashed;border-color:#ffcd77}
.gp-row.typed .av{background:#1a0f07;color:#ffcd77;border:2px solid #ffcd77}
.gp-sec{font-size:18px;color:#ffcd77;letter-spacing:.08em;margin:6px 2px 0;flex:none}
.gp-sk{height:52px;border-radius:12px;flex:none;background:linear-gradient(90deg,#2a1a0c 0%,#4a3018 50%,#2a1a0c 100%);background-size:200% 100%;animation:gpsk 1.1s linear infinite;border:2px solid #3b2410}
@keyframes gpsk{from{background-position:200% 0}to{background-position:0 0}}
.gp-empty{text-align:center;padding:26px 10px;font-size:26px;color:#cdb68c}.gp-empty small{display:block;font-size:19px;margin-top:6px;opacity:.85}
.gp-empty .sk{font-size:46px;display:block;margin-bottom:4px}
.gp-ok{height:auto;max-height:min(520px,90vh);padding-bottom:16px}
.gp-ok .big{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 18px 14px;text-align:center}
.gp-ok .big i{font-style:normal;font-size:64px;width:104px;height:104px;display:flex;align-items:center;justify-content:center;border-radius:18px;background:radial-gradient(#4a3018,#1a0f07);border:3px solid var(--rc,#6b4a24)}
.gp-ok .big i img{width:84%;height:84%;object-fit:contain;filter:drop-shadow(0 3px 3px rgba(0,0,0,.6))}
.gp-ok .what{font-size:30px;color:#fff;line-height:1}.gp-ok .to{font-size:24px;color:#cdb68c}.gp-ok .to b{font-weight:normal;color:#ffcd77;font-size:32px}
.gp-ok .note{font-size:18px;color:#cdb68c;opacity:.85}
.gp-btns{display:flex;gap:10px;padding:0 18px}
.gp-btns button{flex:1;font:26px 'Just Another Hand',cursive;min-height:52px;border-radius:12px;border:2px solid #ffcd77;background:#1a0f07;color:#f4e2bb;cursor:pointer}
.gp-btns button.primary{background:linear-gradient(#a0661a,#7a4a10);color:#fff;box-shadow:0 3px 0 #3b2410}
.gp-btns button:disabled{opacity:.5}
@media (max-height:520px){.gp-box{height:94vh}.gp-ok .big i{width:72px;height:72px;font-size:44px}}
`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cleanName = (n) => String(n ?? '').replace(/[<>&"'`\\\u0000-\u001f]/g, '').trim().slice(0, 20);
// the list the sheet shows: your harbor copy (local peers) first, then everyone else online, each A-Z; you are never in it; q filters
export function pickList({ online = [], harbor = [], me = '', q = '' }) {
  const mine = String(me || '').toLowerCase(), seen = new Map();
  for (const n of harbor) { const c = cleanName(n); if (c && c.toUpperCase() !== 'PIRATE' && c.toLowerCase() !== mine) seen.set(c.toLowerCase(), { n: c, here: true }); }
  for (const p of online) { const c = cleanName(p?.n); if (!c || c.toLowerCase() === mine) continue; const k = c.toLowerCase(); if (!seen.has(k)) seen.set(k, { n: c, here: false, w: p.w === 'arena' ? 'arena' : 'harbor' }); }
  const f = String(q || '').trim().toLowerCase(), by = (a, b) => a.n.localeCompare(b.n, 'en', { sensitivity: 'base' });
  const all = [...seen.values()].filter((p) => !f || p.n.toLowerCase().includes(f));
  return [...all.filter((p) => p.here).sort(by), ...all.filter((p) => !p.here).sort(by)];
}
export function createGivePick({ pvp, nearby = () => [], toast = () => {} }) {
  if (typeof document === 'undefined') return { open() {}, close() {} };
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'iv-pick'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Give to a pirate');
  el.innerHTML = `<div class="gp-box"><div class="gp-head"><span>GIVE TO…</span><button class="gp-x" aria-label="Close">✕</button></div><div class="gp-item"></div>
    <input class="gp-q" type="search" placeholder="search, or type a pirate's name" aria-label="search pirates" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="20">
    <div class="gp-sub"></div><div class="gp-list" role="listbox"></div></div>`;
  const ok = document.createElement('div'); ok.id = 'iv-pick-ok'; ok.setAttribute('role', 'dialog'); ok.setAttribute('aria-label', 'Confirm the gift');
  ok.innerHTML = `<div class="gp-box gp-ok"><div class="gp-head"><span>SEND IT?</span></div><div class="big"></div><div class="gp-btns"><button data-b="back">BACK</button><button data-b="give" class="primary">GIVE IT ⚓</button></div></div>`;
  document.body.append(el, ok);
  for (const n of [el, ok]) for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'wheel']) n.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'keydown' });
  const $ = (s) => el.querySelector(s), q = $('.gp-q'), list = $('.gp-list');
  let cur = null, online = null, loading = false, reqId = 0, sending = false;
  el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); }); ok.addEventListener('pointerdown', (e) => { if (e.target === ok) back(); });
  $('.gp-x').onclick = () => close();
  ok.querySelector('[data-b="back"]').onclick = () => back(); ok.querySelector('[data-b="give"]').onclick = () => send();
  q.addEventListener('input', () => draw());
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); list.querySelector('.gp-row')?.click(); } else if (e.key === 'ArrowDown') { e.preventDefault(); list.querySelector('.gp-row')?.focus(); } });
  list.addEventListener('keydown', (e) => { const rows = [...list.querySelectorAll('.gp-row')], i = rows.indexOf(document.activeElement); if (i < 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); rows[Math.min(rows.length - 1, i + 1)].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); (i ? rows[i - 1] : q).focus(); } });
  const onKey = (e) => { if (e.key !== 'Escape' && e.code !== 'Escape') return; e.preventDefault(); e.stopImmediatePropagation(); if (ok.classList.contains('on')) back(); else close(); };
  const me = () => { try { return pvp()?.name || ''; } catch { return ''; } };
  const row = (p, i) => `<button class="gp-row" role="option" data-n="${esc(p.n)}"${i === 0 ? ' autofocus' : ''}><span class="av">${esc(p.n[0].toUpperCase())}</span><b>${esc(p.n)}</b>${p.here ? '<em class="h">YOUR HARBOR</em>' : `<em class="a">${p.w === 'arena' ? 'IN BATTLE' : 'ONLINE'}</em>`}</button>`;
  function draw() {
    const typed = cleanName(q.value), rows = online ? pickList({ online, harbor: nearby(), me: me(), q: typed }) : pickList({ harbor: nearby(), me: me(), q: typed });
    const exact = rows.some((p) => p.n.toLowerCase() === typed.toLowerCase()), here = rows.filter((p) => p.here), rest = rows.filter((p) => !p.here);
    const typedRow = typed && !exact && typed.toLowerCase() !== me().toLowerCase() ? `<button class="gp-row typed" role="option" data-n="${esc(typed)}" data-typed="1"><span class="av">✎</span><b>give to “${esc(typed)}”</b><em class="a">TYPED</em></button>` : '';
    let h = rows.length ? '' : typedRow;
    if (here.length) h += `<div class="gp-sec">⚓ YOUR HARBOR</div>` + here.map(row).join('');
    if (rest.length) h += `<div class="gp-sec">🌊 ONLINE NOW</div>` + rest.map((p, i) => row(p, here.length ? 1 : i)).join('');
    if (rows.length && typedRow) h += `<div class="gp-sec">✎ OR GIVE TO THE NAME YOU TYPED</div>` + typedRow;
    if (loading && !online) h += '<div class="gp-sk"></div><div class="gp-sk"></div><div class="gp-sk"></div><div class="gp-sk"></div>';
    else if (!rows.length && !typed) h += `<div class="gp-empty"><span class="sk">🏴‍☠️</span>No other pirates online<small>type a pirate's name above to give it anyway</small></div>`;
    else if (!rows.length) h += `<div class="gp-empty">No pirate online called “${esc(typed)}”<small>tap the typed name above to try it anyway</small></div>`;
    list.innerHTML = h;
    $('.gp-sub').textContent = loading && !online ? 'checking who\'s aboard…' : online ? `${rows.length} pirate${rows.length === 1 ? '' : 's'} ${typed ? 'match' + (rows.length === 1 ? 'es' : '') : 'online'}` : 'pirates near you · the full list is offline';
    list.querySelectorAll('.gp-row').forEach((b) => b.onclick = () => confirm(b.dataset.n, b.dataset.typed === '1'));
  }
  async function load() { const id = ++reqId; loading = true; draw();
    let r = null; try { r = await Promise.race([pvp()?.inv?.call('inv_online'), new Promise((res) => setTimeout(() => res(null), 6000))]); } catch { r = null; }
    if (id !== reqId) return; loading = false; online = r?.ok && Array.isArray(r.players) ? r.players : online; draw(); }
  function open(item) { cur = item; sending = false; q.value = '';
    $('.gp-item').innerHTML = `${item.ico || ''}<span>${esc(item.name)}${item.qty > 1 ? ` <small>×${item.qty}</small>` : ''}</span>`;
    el.classList.add('on'); ok.classList.remove('on'); document.addEventListener('keydown', onKey, true); load();
    if (!matchMedia('(pointer: coarse)').matches && !document.documentElement.classList.contains('pfp-pad')) setTimeout(() => q.focus({ preventScroll: true }), 60); } // desktop: type straight away (phones: no keyboard pop-up)
  function confirm(name, typed) { if (!cur || !name) return; ok.dataset.to = name;
    ok.querySelector('.big').innerHTML = `<i style="--rc:${cur.color || '#6b4a24'}">${cur.ico || '🎁'}</i><div class="what">${cur.qty > 1 ? cur.qty + ' × ' : ''}${esc(cur.name)}</div><div class="to">to <b>${esc(name)}</b></div>${typed ? '<div class="note">typed name · it only arrives if a pirate has exactly this name</div>' : '<div class="note">gifts can\'t be taken back</div>'}`;
    ok.querySelector('[data-b="give"]').disabled = false; ok.classList.add('on'); setTimeout(() => ok.querySelector('[data-b="give"]').focus({ preventScroll: true }), 30); }
  function back() { ok.classList.remove('on'); }
  async function send() { if (sending || !cur) return; sending = true; ok.querySelector('[data-b="give"]').disabled = true; const to = ok.dataset.to;
    try { const done = await cur.give(to); if (done) close(); else { sending = false; ok.querySelector('[data-b="give"]').disabled = false; } } catch { sending = false; ok.querySelector('[data-b="give"]').disabled = false; } }
  function close() { reqId++; loading = false; el.classList.remove('on'); ok.classList.remove('on'); document.removeEventListener('keydown', onKey, true); cur = null; }
  return { open, close, get isOpen() { return el.classList.contains('on'); }, _draw: draw, _setOnline(o) { online = o; loading = false; draw(); } };
}
