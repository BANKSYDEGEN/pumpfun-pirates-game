// [squad-hall] BANKSY 9:35 PM: Squad Hall panel — every online pirate across harbor copies + arenas, INVITE TO SQUAD + JOIN WORLD.
// Reuses the existing party system (js/pvp.js partyJoin / partyLeave) and the give-dropdown's inv_online presence list (enriched with world).
const CSS = `
#sq-hall{position:fixed;inset:0;z-index:63;display:flex;align-items:center;justify-content:center;background:rgba(10,7,4,.62);font-family:'Just Another Hand',cursive;color:#f4e2bb;
 visibility:hidden;opacity:0;transition:opacity .18s ease,visibility 0s linear .18s;touch-action:manipulation}
#sq-hall.on{visibility:visible;opacity:1;transition:opacity .18s ease}
.sq-box{width:min(520px,96vw);height:min(640px,88vh);display:flex;flex-direction:column;background:linear-gradient(#2a1840,#1a0f28 55%,#140a1c);border:3px solid #ffcd77;border-radius:16px;
 box-shadow:0 12px 40px #000,inset 0 0 0 2px #6a4fb3;transform:translateY(12px) scale(.97);transition:transform .2s cubic-bezier(.2,1.3,.4,1)}
.on>.sq-box{transform:none}
.sq-head{display:flex;align-items:center;gap:10px;padding:10px 14px 2px;font-size:34px;letter-spacing:.05em;color:#ffcd77;flex:none}
.sq-head span{flex:1}.sq-x{width:44px;height:44px;border-radius:50%;border:2px solid #ffcd77;background:#1a0f07;color:#ffcd77;font-size:22px;cursor:pointer;flex:none}
.sq-party{margin:4px 14px 8px;padding:6px 10px;border-radius:12px;background:#1a0f07;border:2px solid #6a4fb3;font-size:20px;flex:none;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sq-party b{color:#ffcd77;letter-spacing:.12em}.sq-party button{font:18px 'Just Another Hand',cursive;padding:4px 10px;border-radius:8px;border:2px solid #ffcd77;background:#6a4fb3;color:#fff;cursor:pointer}
.sq-party button.ghost{background:#1a0f07;color:#ffcd77}.sq-sub{margin:0 16px 4px;font-size:18px;color:#cdb68c;flex:none;min-height:20px}
.sq-list{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:2px 12px 14px;display:flex;flex-direction:column;gap:6px}
.sq-row{display:flex;align-items:center;gap:8px;width:100%;min-height:56px;padding:4px 8px 2px;border-radius:12px;border:2px solid #6a4fb3;background:radial-gradient(circle at 20% 50%,#3a2458,#1e1230);color:#f4e2bb;flex:none}
.sq-row .av{width:36px;height:36px;border-radius:50%;background:#6a4fb3;color:#ffcd77;display:flex;align-items:center;justify-content:center;font-size:22px;flex:none}
.sq-row .who{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.05}
.sq-row .who b{font-size:24px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sq-row .who em{font-style:normal;font-size:16px;color:#cdb68c}
.sq-row .acts{display:flex;gap:4px;flex:none;flex-wrap:wrap;justify-content:flex-end}
.sq-row .acts button{font:16px 'Just Another Hand',cursive;padding:4px 8px 2px;border-radius:8px;border:2px solid #ffcd77;background:#fa0d0d;color:#fff;cursor:pointer;white-space:nowrap}
.sq-row .acts button.join{background:#1a0f07;color:#ffcd77}
.sq-row .acts button[disabled]{opacity:.45;cursor:default}
.sq-sec{font-size:18px;color:#ffcd77;letter-spacing:.08em;padding:6px 4px 2px;flex:none}
.sq-empty{text-align:center;padding:28px 12px;font-size:24px;opacity:.85}.sq-empty small{display:block;font-size:16px;opacity:.7;margin-top:6px}
.sq-sk{height:52px;border-radius:12px;background:linear-gradient(90deg,#2a1840,#3a2458,#2a1840);background-size:200% 100%;animation:sqsh 1.1s linear infinite;flex:none}
@keyframes sqsh{to{background-position:-200% 0}}
#sq-invite{position:fixed;left:50%;bottom:calc(var(--safe-b,0px) + 120px);transform:translateX(-50%);z-index:64;display:none;max-width:min(420px,94vw);
 background:linear-gradient(#2a1840,#1a0f28);border:3px solid #ffcd77;border-radius:14px;padding:10px 14px;box-shadow:0 8px 28px #000;font-family:'Just Another Hand',cursive;color:#f4e2bb;text-align:center}
#sq-invite.on{display:block}
#sq-invite .t{font-size:26px;color:#ffcd77;margin-bottom:2px}
#sq-invite .m{font-size:20px;margin-bottom:8px}
#sq-invite .row{display:flex;gap:8px;justify-content:center}
#sq-invite button{font:20px 'Just Another Hand',cursive;padding:6px 14px 4px;border-radius:10px;border:2px solid #ffcd77;cursor:pointer}
#sq-invite .ok{background:#fa0d0d;color:#fff}#sq-invite .no{background:#1a0f07;color:#ffcd77}
@media (max-width:600px){.sq-row{flex-wrap:wrap}.sq-row .acts{width:100%;justify-content:stretch}.sq-row .acts button{flex:1}}
`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanName = (n) => String(n ?? '').replace(/[<>&"'`\\\u0000-\u001f]/g, '').trim().slice(0, 20);

function worldLabel(p) {
  if (!p) return 'ONLINE';
  if (p.w === 'arena') return p.mode === 'squads' ? 'SQUADS ARENA' : 'SOLO ARENA';
  if (p.w === 'queue') return p.mode === 'squads' ? 'SQUADS QUEUE' : 'SOLO QUEUE';
  if (p.w === 'spec') return 'SPECTATING';
  if (p.w === 'harbor') return p.copy > 1 ? `HARBOR ${p.copy}` : 'HARBOR';
  return 'ONLINE';
}

export function createSquadHall({ pvp, toast, nearby = () => [] }) {
  if (!document.getElementById('sq-hall-css')) {
    const s = document.createElement('style'); s.id = 'sq-hall-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  const el = document.createElement('div'); el.id = 'sq-hall'; el.innerHTML = `<div class="sq-box" role="dialog" aria-label="Squad Hall">
    <div class="sq-head"><span>⚔ SQUAD HALL</span><button type="button" class="sq-x" aria-label="Close">✕</button></div>
    <div class="sq-party" data-party></div>
    <div class="sq-sub">pirates across every world</div>
    <div class="sq-list" role="listbox"></div>
  </div>`;
  document.body.appendChild(el);
  const inv = document.createElement('div'); inv.id = 'sq-invite'; inv.innerHTML = `<div class="t">SQUAD INVITE</div><div class="m"></div><div class="row"><button type="button" class="ok">ACCEPT</button><button type="button" class="no">DECLINE</button></div>`;
  document.body.appendChild(inv);

  let online = null, loading = false, reqId = 0, busy = '', pollT = 0, inviteT = 0, seenInvite = '';
  const $ = (sel, root = el) => root.querySelector(sel);
  const me = () => { try { return cleanName(pvp()?.name || ''); } catch { return ''; } };
  const party = () => { try { return pvp()?.partyInfo?.() || { code: '', mate: null, msg: '' }; } catch { return { code: '', mate: null, msg: '' }; } };

  function partyBar() {
    const p = party(), box = $('[data-party]');
    if (p.code) {
      box.innerHTML = `PARTY <b>${esc(p.code)}</b> · ${p.mate ? `with ${esc(p.mate.n)}` : esc(p.msg || 'waiting…')}<button type="button" data-a="leave" class="ghost">LEAVE</button>`;
      box.querySelector('[data-a="leave"]').onclick = () => { pvp()?.partyLeave?.(); draw(); };
    } else {
      box.innerHTML = `No party · INVITE opens a code for Squads 2v2<button type="button" data-a="new">NEW PARTY</button>`;
      box.querySelector('[data-a="new"]').onclick = () => { pvp()?.partyMake?.(); draw(); toast?.('PARTY READY<br><small>share the code or invite from the list</small>', 2400); };
    }
  }

  function rows() {
    const mine = me().toLowerCase(), seen = new Map(), out = [];
    for (const n of nearby() || []) { const c = cleanName(n); if (!c || c.toLowerCase() === mine) continue; const k = c.toLowerCase(); if (!seen.has(k)) { seen.set(k, 1); out.push({ n: c, w: 'harbor', copy: 0, here: true, mode: '' }); } }
    for (const p of online || []) {
      const c = cleanName(p?.n); if (!c || c.toLowerCase() === mine) continue; const k = c.toLowerCase();
      if (seen.has(k)) { const row = out.find(x => x.n.toLowerCase() === k); if (row && !row.copy && p.copy) Object.assign(row, { copy: p.copy | 0, mode: p.mode || '', w: p.w || row.w }); continue; }
      seen.set(k, 1); out.push({ n: c, w: p.w === 'arena' || p.w === 'queue' || p.w === 'spec' ? p.w : 'harbor', copy: p.copy | 0, mode: p.mode || '', here: false });
    }
    out.sort((a, b) => (b.here - a.here) || a.n.localeCompare(b.n, 'en', { sensitivity: 'base' }));
    return out;
  }

  function draw() {
    partyBar();
    const list = $('.sq-list'), all = rows(), here = all.filter(p => p.here), rest = all.filter(p => !p.here);
    let h = '';
    if (here.length) h += `<div class="sq-sec">⚓ YOUR WORLD</div>` + here.map(rowHtml).join('');
    if (rest.length) h += `<div class="sq-sec">🌊 ALL WORLDS</div>` + rest.map(rowHtml).join('');
    if (loading && !online) h += '<div class="sq-sk"></div><div class="sq-sk"></div><div class="sq-sk"></div>';
    else if (!all.length) h += `<div class="sq-empty">🏴‍☠️ No other pirates online<small>open the hall again in a moment</small></div>`;
    list.innerHTML = h;
    $('.sq-sub').textContent = loading && !online ? 'checking every harbor + arena…' : `${all.length} pirate${all.length === 1 ? '' : 's'} online`;
    list.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => invite(b.dataset.inv));
    list.querySelectorAll('[data-join]').forEach(b => b.onclick = () => joinWorld(b.dataset.join, b.dataset.w, b.dataset.copy, b.dataset.mode));
  }

  function rowHtml(p) {
    const lab = p.here ? 'YOUR HARBOR' : worldLabel(p);
    const dis = busy === p.n ? ' disabled' : '';
    return `<div class="sq-row" role="option"><span class="av">${esc(p.n[0].toUpperCase())}</span><div class="who"><b>${esc(p.n)}</b><em>${esc(lab)}${p.mode === 'squads' && p.w === 'harbor' ? ' · SQUADS MODE' : ''}</em></div>
      <div class="acts"><button type="button" data-inv="${esc(p.n)}"${dis}>INVITE</button><button type="button" class="join" data-join="${esc(p.n)}" data-w="${esc(p.w)}" data-copy="${p.copy | 0}" data-mode="${esc(p.mode || '')}"${dis}>JOIN WORLD</button></div></div>`;
  }

  async function load() {
    const id = ++reqId; loading = true; draw();
    let r = null;
    try { r = await Promise.race([pvp()?.inv?.call('inv_online', { detail: true }), new Promise(res => setTimeout(() => res(null), 6000))]); } catch { r = null; }
    if (id !== reqId) return; loading = false;
    online = r?.ok && Array.isArray(r.players) ? r.players : online;
    draw();
  }

  async function invite(name) {
    name = cleanName(name); if (!name || busy) return; busy = name; draw();
    try {
      let code = party().code;
      if (!code) { code = pvp()?.partyMake?.() || ''; }
      if (!code) { toast?.('COULD NOT OPEN A PARTY', 2000); return; }
      const world = (() => { try { const pv = pvp(); if (!pv) return ''; if (pv.where === 'arena') return pv.mode === 'squads' ? 'Squads arena' : 'Solo arena'; const c = pv.roomIdx | 0; return c > 1 ? `Harbor ${c}` : 'Harbor'; } catch { return ''; } })();
      const r = await pvp()?.inv?.call('squad_invite', { to: name, code, world });
      if (r?.ok) toast?.(`INVITE SENT TO ${esc(name)}<br><small>party ${esc(code)}</small>`, 2400);
      else toast?.(r?.why || r?.error || 'INVITE FAILED', 2200);
    } finally { busy = ''; draw(); }
  }

  async function joinWorld(name, w, copy, mode) {
    name = cleanName(name); if (!name || busy) return; busy = name; draw();
    try {
      const r = await pvp()?.joinWorld?.({ name, w, copy: copy | 0, mode: mode || '' });
      if (r?.ok) { close(); toast?.(r.msg || `JOINING ${esc(name)}'S WORLD…`, 2400); }
      else toast?.(r?.why || r?.error || 'CANNOT JOIN THAT WORLD', 2400);
    } finally { busy = ''; draw(); }
  }

  async function pollInvites() {
    if (!el.classList.contains('on') && !inv.classList.contains('on')) return;
    let r = null;
    try { r = await pvp()?.inv?.call('squad_invites'); } catch { r = null; }
    if (!r?.ok || !Array.isArray(r.invites) || !r.invites.length) return;
    const i = r.invites[0], key = `${i.from}|${i.code}`;
    if (key === seenInvite && inv.classList.contains('on')) return;
    seenInvite = key;
    inv.querySelector('.m').innerHTML = `<b>${esc(i.from)}</b> invites you to party <b>${esc(i.code)}</b>${i.world ? `<br><small>${esc(i.world)}</small>` : ''}`;
    inv.classList.add('on');
    inv.querySelector('.ok').onclick = async () => {
      inv.classList.remove('on');
      await pvp()?.inv?.call('squad_invite_ack', { from: i.from, code: i.code, ok: true });
      pvp()?.partyJoin?.(i.code);
      toast?.(`JOINED ${esc(i.from)}'S PARTY`, 2200);
      if (el.classList.contains('on')) draw();
    };
    inv.querySelector('.no').onclick = async () => {
      inv.classList.remove('on');
      await pvp()?.inv?.call('squad_invite_ack', { from: i.from, code: i.code, ok: false });
    };
  }

  function tick(now) {
    if (!el.classList.contains('on') && !inv.classList.contains('on')) return;
    if (el.classList.contains('on') && now - pollT > 8000) { pollT = now; load(); }
    if (now - inviteT > 4000) { inviteT = now; pollInvites(); }
    if (el.classList.contains('on')) partyBar();
  }

  const onKey = (e) => { if (e.key !== 'Escape' && e.code !== 'Escape') return; e.preventDefault(); e.stopImmediatePropagation(); close(); };
  el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });
  $('.sq-x').onclick = () => close();

  function open() {
    el.classList.add('on'); document.addEventListener('keydown', onKey, true);
    pollT = 0; inviteT = 0; load(); pollInvites();
  }
  function close() {
    reqId++; loading = false; el.classList.remove('on'); document.removeEventListener('keydown', onKey, true);
  }

  // background invite toast even when the hall is closed (harbor tick calls tick)
  return { open, close, tick, pollInvites, get isOpen() { return el.classList.contains('on'); }, _setOnline(o) { online = o; loading = false; draw(); }, _draw: draw };
}
