// [squad-hall] BANKSY 9:35 PM: Squad Hall panel — every online pirate across harbor copies + arenas, INVITE TO SQUAD + JOIN WORLD.
// [invite-discreet] BANKSY 10:06/10:07 PM: invites = a small pill under INVENTORY (expand for Accept/Decline), pad VIEW when invites pending.
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
/* [invite-discreet] BANKSY 10:06 PM: small non-blocking pill under INVENTORY (not a centred toast) */
#sq-note{display:none;align-self:flex-end;margin-top:4px;pointer-events:auto;z-index:9;position:relative;font-family:'Just Another Hand',cursive}
#sq-note.on{display:block}
#sq-note .sq-pill{display:flex;align-items:center;gap:6px;max-width:min(220px,46vw);padding:4px 10px 2px;border-radius:999px;border:2px solid #ffcd77;background:rgba(42,24,64,.92);color:#ffcd77;cursor:pointer;font-size:18px;letter-spacing:.03em;white-space:nowrap;box-shadow:0 2px 8px #000;touch-action:manipulation}
#sq-note .sq-pill .ic{font-size:16px;line-height:1}
#sq-note .sq-pill .nm{overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1;color:#f4e2bb}
#sq-note .sq-pill .n{min-width:1.2em;padding:0 5px;border-radius:999px;background:#fa0d0d;color:#fff;font:bold 13px system-ui,sans-serif;text-align:center}
#sq-note .sq-pill .gly{display:none;font:12px system-ui,sans-serif;opacity:.85;border:1px solid rgba(255,205,119,.55);border-radius:6px;padding:0 4px;color:#ffcd77}
html.pfp-padc #sq-note .sq-pill .gly{display:inline-block}
#sq-note.pulse .sq-pill{animation:sqPulse 1s ease-in-out 3}
@keyframes sqPulse{50%{background:#6a4fb3;box-shadow:0 0 12px #ffcd77}}
#sq-note-panel{display:none;position:absolute;right:0;top:calc(100% + 6px);width:min(260px,72vw);padding:8px;border-radius:12px;border:2px solid #ffcd77;background:linear-gradient(#2a1840,#1a0f28);box-shadow:0 8px 22px #000;z-index:10;touch-action:manipulation}
#sq-note.open #sq-note-panel{display:block}
#sq-note-panel .sq-ir{display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:10px;border:2px solid #6a4fb3;background:#1e1230;margin-bottom:5px;font-size:18px;color:#f4e2bb}
#sq-note-panel .sq-ir:last-child{margin-bottom:0}
#sq-note-panel .sq-ir b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:normal}
#sq-note-panel .sq-ir small{display:block;font-size:13px;color:#cdb68c;line-height:1}
#sq-note-panel .sq-ir button{font:15px 'Just Another Hand',cursive;padding:3px 8px 1px;border-radius:8px;border:2px solid #ffcd77;cursor:pointer;flex:none}
#sq-note-panel .sq-ir .ok{background:#fa0d0d;color:#fff}#sq-note-panel .sq-ir .no{background:#1a0f07;color:#ffcd77}
@media (max-height:520px){#hud-tr #sq-note{position:absolute;right:calc(100% + 8px);top:90px;margin:0}#sq-note-panel{right:0;left:auto;top:calc(100% + 4px)}}
@media (max-width:600px){.sq-row{flex-wrap:wrap}.sq-row .acts{width:100%;justify-content:stretch}.sq-row .acts button{flex:1}#sq-note .sq-pill{font-size:16px;padding:3px 8px 1px;max-width:min(180px,42vw)}}
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
  // [invite-discreet] pill under #tm-btn (INVENTORY) in the top-right HUD column
  const note = document.createElement('div'); note.id = 'sq-note'; note.innerHTML = `<button type="button" class="sq-pill" aria-label="Squad invites"><span class="ic" aria-hidden="true">🔔</span><span class="nm"></span><span class="n" hidden>1</span><kbd class="gly" data-gly></kbd></button><div id="sq-note-panel" role="dialog" aria-label="Squad invites"></div>`;
  const host = document.getElementById('hud-tr') || document.body; host.appendChild(note);
  const pill = note.querySelector('.sq-pill'), panel = note.querySelector('#sq-note-panel');
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) note.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

  let online = null, loading = false, reqId = 0, busy = '', pollT = 0, inviteT = 0, invites = [], noteOpen = false, lastPulse = '';
  const $ = (sel, root = el) => root.querySelector(sel);
  const me = () => { try { return cleanName(pvp()?.name || ''); } catch { return ''; } };
  const party = () => { try { return pvp()?.partyInfo?.() || { code: '', mate: null, msg: '' }; } catch { return { code: '', mate: null, msg: '' }; } };

  function partyBar() {
    const p = party(), box = $('[data-party]');
    const mates = Array.isArray(p.mates) ? p.mates : (p.mate ? [p.mate] : []);
    if (p.code) {
      box.innerHTML = `SQUAD <b>${esc(p.code)}</b> · ${mates.length ? `with ${mates.map(m => esc(m.n)).join(', ')}` : esc(p.msg || 'waiting…')}<button type="button" data-a="leave" class="ghost">LEAVE</button>`;
      box.querySelector('[data-a="leave"]').onclick = () => { pvp()?.partyLeave?.(); draw(); };
    } else {
      box.innerHTML = `No squad · create a code for Harbor co-op PvE (up to 16) or Arena 2v2<button type="button" data-a="new">NEW SQUAD</button>`;
      box.querySelector('[data-a="new"]').onclick = () => { pvp()?.partyMake?.(); draw(); toast?.('SQUAD READY<br><small>share the code · Harbor friendly fire OFF</small>', 2400); };
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
    list.querySelectorAll('[data-fr]').forEach(b => b.onclick = async () => { b.disabled = true; await window.PFP_FRIENDS?.request?.(b.dataset.fr); draw(); });
    list.querySelectorAll('[data-join]').forEach(b => b.onclick = () => joinWorld(b.dataset.join, b.dataset.w, b.dataset.copy, b.dataset.mode));
  }

  // [v356 friends] "+ FRIEND" on every pirate in the hall (your world first): sends a friend request (js/friends.js)
  function frBtn(n, dis) { const F = window.PFP_FRIENDS; if (!F) return ''; const r = F.relationOf?.(n) || '';
    return r === 'friend' ? '' : `<button type="button" class="join" data-fr="${esc(n)}"${dis}${r === 'sent' ? ' disabled' : ''}>${r === 'sent' ? 'REQUESTED' : r === 'incoming' ? '+ ACCEPT' : '+ FRIEND'}</button>`; }
  function rowHtml(p) {
    const lab = p.here ? 'YOUR HARBOR' : worldLabel(p);
    const dis = busy === p.n ? ' disabled' : '';
    return `<div class="sq-row" role="option"><span class="av">${esc(p.n[0].toUpperCase())}</span><div class="who"><b>${esc(p.n)}</b><em>${esc(lab)}${p.mode === 'squads' && p.w === 'harbor' ? ' · SQUADS MODE' : ''}</em></div>
      <div class="acts">${frBtn(p.n, dis)}<button type="button" data-inv="${esc(p.n)}"${dis}>INVITE</button><button type="button" class="join" data-join="${esc(p.n)}" data-w="${esc(p.w)}" data-copy="${p.copy | 0}" data-mode="${esc(p.mode || '')}"${dis}>JOIN WORLD</button></div></div>`;
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

  function setNoteOpen(v) { noteOpen = !!v; note.classList.toggle('open', noteOpen); if (noteOpen) drawNotePanel(); }
  function drawNote() {
    if (!invites.length) { if (note.classList.contains('on')) { note.classList.remove('on', 'open', 'pulse'); noteOpen = false; panel.innerHTML = ''; } lastPulse = ''; return; }
    const key = invites.map(i => i.from + '|' + i.code).join(',');
    const first = invites[0], nm = first.from || 'INVITE', count = invites.length > 1 ? String(invites.length) : '';
    if (!note.classList.contains('on')) note.classList.add('on');
    const nmEl = pill.querySelector('.nm'), n = pill.querySelector('.n');
    if (nmEl.textContent !== nm) nmEl.textContent = nm;
    if (count) { if (n.hidden || n.textContent !== count) { n.hidden = false; n.textContent = count; } }
    else if (!n.hidden) n.hidden = true;
    if (key !== lastPulse) { lastPulse = key; note.classList.remove('pulse'); void note.offsetWidth; note.classList.add('pulse'); if (noteOpen) drawNotePanel(); }
    else if (noteOpen && !panel.childElementCount) drawNotePanel();
    syncGlyph();
  }
  function drawNotePanel() {
    panel.innerHTML = invites.map((i, idx) => `<div class="sq-ir" data-i="${idx}"><span><b>${esc(i.from)}</b>${i.world ? `<small>${esc(i.world)}</small>` : `<small>party ${esc(i.code)}</small>`}</span>
      <button type="button" class="ok" data-a="1">ACCEPT</button><button type="button" class="no" data-a="0">DECLINE</button></div>`).join('');
    panel.querySelectorAll('button').forEach(b => b.onclick = (e) => { e.stopPropagation(); const row = b.closest('.sq-ir'); ack(invites[+row.dataset.i], b.dataset.a === '1'); });
  }
  async function ack(i, ok) {
    if (!i) return;
    invites = invites.filter(x => !(x.from === i.from && x.code === i.code));
    drawNote();
    try { await pvp()?.inv?.call('squad_invite_ack', { from: i.from, code: i.code, ok: !!ok }); } catch {}
    if (ok) { pvp()?.partyJoin?.(i.code); toast?.(`JOINED ${esc(i.from)}'S PARTY`, 2200); if (el.classList.contains('on')) draw(); }
    if (!invites.length) setNoteOpen(false);
  }
  // [invite-discreet] glyph + pill DOM only on invite / pad-mode changes — never from the per-frame dock tick
  let glyTxt = null, partySig = '';
  function syncGlyph() {
    const g = pill.querySelector('[data-gly]');
    let next = '';
    try {
      if (document.documentElement.classList.contains('pfp-padc'))
        next = document.documentElement.classList.contains('pfp-pad-ps') ? 'CREATE' : 'VIEW';
    } catch { next = 'VIEW'; }
    if (next === glyTxt) return; glyTxt = next; g.textContent = next;
  }
  // pad brand / connect flips html.pfp-padc (js/gamepad.js) — one observer, not a per-frame check
  try { new MutationObserver(() => syncGlyph()).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); } catch {}
  pill.onclick = (e) => { e.stopPropagation(); if (!invites.length) return; setNoteOpen(!noteOpen); };
  addEventListener('pointerdown', (e) => { if (noteOpen && !note.contains(e.target)) setNoteOpen(false); }, true);

  async function pollInvites() {
    let r = null;
    try { r = await pvp()?.inv?.call('squad_invites'); } catch { r = null; }
    const list = r?.ok && Array.isArray(r.invites) ? r.invites.filter(i => i && i.from && i.code).slice(0, 8) : [];
    invites = list; // server already drops expired (TTL); empty = clear the pill
    drawNote();
  }

  function tick(now) {
    // invites: poll every 4 s (event-driven drawNote); no per-frame DOM / allocations for #sq-note
    if (now - inviteT > 4000) { inviteT = now; pollInvites(); }
    if (el.classList.contains('on')) {
      if (now - pollT > 8000) { pollT = now; load(); }
      else if (now - pollT > 500) { // party bar only when the hall is open, and only if the party text changed
        const p = party(), mates = Array.isArray(p.mates) ? p.mates : (p.mate ? [p.mate] : []), sig = (p.code || '') + '|' + mates.map(m => m.n).join(',') + '|' + (p.msg || '');
        if (sig !== partySig) { partySig = sig; partyBar(); }
      }
    }
  }

  const onKey = (e) => {
    if (e.key !== 'Escape' && e.code !== 'Escape') return;
    if (noteOpen) { e.preventDefault(); e.stopImmediatePropagation(); setNoteOpen(false); return; }
    if (!el.classList.contains('on')) return;
    e.preventDefault(); e.stopImmediatePropagation(); close();
  };
  el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });
  $('.sq-x').onclick = () => close();
  document.addEventListener('keydown', onKey, true);

  function open() {
    el.classList.add('on');
    pollT = 0; inviteT = 0; load(); pollInvites();
  }
  function close() {
    reqId++; loading = false; el.classList.remove('on');
  }
  function openInvites() { if (!invites.length) { pollInvites().then(() => { if (invites.length) setNoteOpen(true); }); return; } setNoteOpen(true); }
  function hasInvites() { return invites.length > 0; }

  // background invite pill (harbor tick calls tick); openInvites / hasInvites for the pad VIEW binding
  return { open, close, tick, pollInvites, openInvites, hasInvites, get isOpen() { return el.classList.contains('on'); }, get noteOpen() { return noteOpen; }, _setOnline(o) { online = o; loading = false; draw(); }, _draw: draw, _setInvites(list) { invites = list || []; drawNote(); } };
}
