// [v356 friends] BANKSY t1851u: "Make it so you can add friends and have friend list and auto join their server if possible".
// FRIENDS panel (⚙ SETTINGS → 👥 FRIENDS, the ⚓ server picker, Squad Hall + KING OF THE HILL rows): add by name (search) or from the
// pirates online now, requests with ACCEPT / DECLINE / CANCEL, UNFRIEND, online / offline + where they are, JOIN their Harbor server,
// and an AUTO-JOIN setting. Server: pvp Edge actions fr_* (supabase/functions/pvp/friends.ts, migration 054). Pure helpers are exported
// for tests; the DOM is built lazily. Every name from the network goes through escHtml.
import { escHtml as esc } from './safe.js';

export const FR_POLL_OPEN_MS = 8000, FR_POLL_BG_MS = 30000, FR_AUTO_KEY = 'pfp_fr_autojoin';
export const cleanName = (n) => String(n ?? '').replace(/[<>&"'`\\\u0000-\u001f]/g, '').trim().slice(0, 20);

/** Where I am, for my friends: { w: 'harbor', prefix, copy } | { w: 'arena'|'queue'|'spec', mode } | { w: 'solo' } */
export function myAt(pv, game) {
  try {
    if (!pv || !pv.active || game?.mode !== 'pvp' || game?.state === 'title') return { w: 'solo' };
    const mode = pv.mode === 'squads' ? 'squads' : 'solo';
    if (pv.where === 'arena') return { w: 'arena', mode };
    if (pv.where === 'spec' || pv.spectating) return { w: 'spec', mode };
    if (pv.lob?.state && pv.lob.state !== 'harbor') return { w: 'queue', mode };
    const h = pv.harborInfo?.() || {};
    return { w: 'harbor', prefix: h.prefix || 'pfp-harbor', copy: h.copy | 0 };
  } catch { return { w: 'solo' }; }
}

/** Status line for a friend row. */
export function whereLabel(f) {
  if (!f || !f.on) return 'OFFLINE';
  if (f.w === 'harbor') {
    const room = f.room_n ? ` · ${Math.min(f.room_n | 0, 99)}/${f.cap || 8}` : '';
    if (f.code) return `OWN SERVER · ${f.code}${room}`;
    return f.copy ? `HARBOR #${f.copy | 0}${room}` : 'HARBOR · joining';
  }
  if (f.w === 'arena') return f.mode === 'squads' ? 'SQUADS ARENA' : 'SOLO ARENA';
  if (f.w === 'queue') return f.mode === 'squads' ? 'SQUADS QUEUE' : 'SOLO QUEUE';
  if (f.w === 'spec') return 'SPECTATING';
  return 'ONLINE · STORM HUNT / MENUS';
}

/**
 * Can I join this friend, and how? -> { ok:true, kind:'harbor', label, server: { kind:'pick'|'own', arg, copy } }
 *  | { ok:true, kind:'arena', mode, label } | { ok:false, why }
 * cur = myAt() (only used for "already there").
 */
export function joinPlan(f, cur = null) {
  if (!f || !f.on) return { ok: false, why: 'offline' };
  if (f.w === 'harbor') {
    if (!(f.copy > 0)) return { ok: false, why: 'their server is still loading · try again in a moment' };
    const prefix = f.code ? `pfp-harbor-${String(f.code).toLowerCase()}` : 'pfp-harbor';
    if (cur && cur.w === 'harbor' && cur.prefix === prefix && (cur.copy | 0) === (f.copy | 0)) return { ok: false, why: 'you are already on their server', here: true };
    if (f.full) return { ok: false, why: `their server is full (${f.room_n | 0}/${f.cap || 8})`, full: true };
    return { ok: true, kind: 'harbor', label: f.code ? `OWN · ${f.code}` : `HARBOR #${f.copy | 0}`, server: f.code ? { kind: 'own', arg: f.code, copy: f.copy | 0 } : { kind: 'pick', arg: f.copy | 0, copy: f.copy | 0 } };
  }
  if (f.w === 'arena' || f.w === 'queue') return { ok: true, kind: 'arena', mode: f.mode === 'squads' ? 'squads' : 'solo', label: f.mode === 'squads' ? 'SQUADS QUEUE' : 'SOLO QUEUE' };
  if (f.w === 'spec') return { ok: false, why: 'they are spectating' };
  return { ok: false, why: 'they are in Storm Hunt / the menus (not a shared server)' };
}

/** AUTO-JOIN: the friend server to drop into (most pirates, not full, public or own), or null. */
export function pickAutoJoin(friends = [], cur = null) {
  const ok = (Array.isArray(friends) ? friends : []).filter((f) => f && f.on && f.w === 'harbor' && joinPlan(f, null).ok);
  if (!ok.length) return null;
  if (cur && ok.some((f) => !joinPlan(f, cur).ok && joinPlan(f, cur).here)) return null; // already with a friend
  ok.sort((a, b) => (b.room_n | 0) - (a.room_n | 0) || String(a.n).localeCompare(String(b.n)));
  return ok[0];
}

const CSS = `
#fr-panel{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:rgba(10,7,4,.62);font-family:'Just Another Hand',cursive;color:#f4e2bb;
 padding:calc(8px + var(--safe-t,env(safe-area-inset-top,0px))) calc(8px + var(--safe-r,env(safe-area-inset-right,0px))) calc(8px + var(--safe-b,env(safe-area-inset-bottom,0px))) calc(8px + var(--safe-l,env(safe-area-inset-left,0px)));box-sizing:border-box;touch-action:manipulation}
#fr-panel[hidden]{display:none}
#fr-panel .fr-box{width:min(540px,100%);height:min(660px,100%);display:flex;flex-direction:column;background:linear-gradient(#2e1c0d,#1d1208);border:3px solid #ffcd77;border-radius:16px;box-shadow:0 12px 40px #000;overflow:hidden}
#fr-panel .fr-head{display:flex;align-items:center;gap:10px;padding:8px 12px 2px;font-size:34px;letter-spacing:.06em;color:#ffcd77;flex:none}
#fr-panel .fr-head span{flex:1}
#fr-panel .fr-x{width:44px;height:44px;border-radius:50%;border:2px solid #ffcd77;background:#1a0f07;color:#ffcd77;font-size:22px;cursor:pointer;flex:none}
#fr-panel .fr-tabs{display:flex;gap:6px;padding:4px 12px 6px;flex:none}
#fr-panel .fr-tabs button{flex:1;font:22px 'Just Another Hand',cursive;letter-spacing:.05em;padding:6px 6px 3px;border-radius:10px;border:2px solid #6b4a24;background:#1a1008;color:#f4e2bb;cursor:pointer;position:relative;min-height:44px}
#fr-panel .fr-tabs button.on{border-color:#ffcd77;background:#4a2e12;color:#ffcd77}
#fr-panel .fr-badge{display:inline-block;min-width:1.3em;margin-left:6px;padding:0 5px;border-radius:999px;background:#fa0d0d;color:#fff;font:bold 13px system-ui,sans-serif;line-height:18px;vertical-align:2px}
#fr-panel .fr-list{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:2px 12px 10px;display:flex;flex-direction:column;gap:6px;overscroll-behavior:contain}
#fr-panel .fr-sec{font-size:19px;color:#ffcd77;letter-spacing:.08em;padding:6px 2px 0;flex:none}
#fr-panel .fr-row{display:flex;align-items:center;gap:8px;min-height:56px;padding:4px 8px 2px;border-radius:12px;border:2px solid #6b4a24;background:#1a1008;flex:none}
#fr-panel .fr-row.on{border-color:#34d399}
#fr-panel .fr-av{width:36px;height:36px;border-radius:50%;background:#4a2e12;color:#ffcd77;display:flex;align-items:center;justify-content:center;font-size:22px;flex:none;position:relative}
#fr-panel .fr-row.on .fr-av::after{content:'';position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;border-radius:50%;background:#34d399;border:2px solid #1a1008}
#fr-panel .fr-who{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.05}
#fr-panel .fr-who b{font-size:24px;font-weight:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fr-panel .fr-who em{font-style:normal;font-size:16px;color:#cdb68c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fr-panel .fr-row.on .fr-who em{color:#a7f3d0}
#fr-panel .fr-acts{display:flex;gap:5px;flex:none}
#fr-panel button.fr-b{font:19px 'Just Another Hand',cursive;letter-spacing:.04em;padding:5px 11px 2px;min-height:40px;border-radius:9px;border:2px solid #ffcd77;background:#3a240f;color:#ffcd77;cursor:pointer;white-space:nowrap}
#fr-panel button.fr-b.go{background:#0b6b3a;border-color:#34d399;color:#fff}
#fr-panel button.fr-b.no{background:#1a0f07;color:#cdb68c;border-color:#6b4a24}
#fr-panel button.fr-b.warn{background:#7a1010;color:#fff}
#fr-panel button.fr-b:disabled{opacity:.45;cursor:default}
#fr-panel .fr-add{display:flex;gap:6px;flex:none;padding:4px 0}
#fr-panel .fr-add input{flex:1;min-width:0;font:bold 18px system-ui,sans-serif;padding:8px 10px;border-radius:9px;border:2px solid #6b4a24;background:#120b05;color:#ffcd77;min-height:44px;box-sizing:border-box}
#fr-panel .fr-empty{text-align:center;padding:22px 10px;font-size:22px;opacity:.85}
#fr-panel .fr-empty small{display:block;font-size:16px;opacity:.75;margin-top:4px}
#fr-panel .fr-foot{flex:none;display:flex;align-items:center;gap:8px;padding:6px 12px 8px;border-top:2px solid rgba(255,205,119,.2);font-size:17px;color:#cdb68c}
#fr-panel .fr-foot .fr-auto{flex:1;text-align:left}
#fr-panel .fr-gly{display:none;font:12px system-ui,sans-serif;opacity:.85}
html.pfp-padc #fr-panel .fr-gly{display:inline}
#fr-panel .pad-focus{outline:3px solid #ffcd77;outline-offset:2px}
#fr-panel :focus-visible{outline:3px solid #ffcd77;outline-offset:2px}
.fr-dot{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 3px;border-radius:999px;background:#fa0d0d;color:#fff;font:bold 11px/16px system-ui,sans-serif;text-align:center;pointer-events:none;box-shadow:0 0 0 2px #161616}
#btn-pause{position:relative}
@media (max-height:520px){#fr-panel .fr-box{height:100%}#fr-panel .fr-head{font-size:26px;padding:4px 10px 0}#fr-panel .fr-x{width:38px;height:38px;font-size:18px}
 #fr-panel .fr-tabs{padding:2px 10px 4px}#fr-panel .fr-tabs button{font-size:19px;min-height:38px;padding:3px 4px 1px}#fr-panel .fr-row{min-height:48px}#fr-panel .fr-foot{padding:3px 10px 4px}}
@media (max-width:420px){#fr-panel .fr-tabs button{font-size:18px;padding:5px 3px 2px}#fr-panel .fr-badge{margin-left:3px}#fr-panel .fr-row{flex-wrap:wrap}#fr-panel .fr-acts{width:100%}#fr-panel .fr-acts .fr-b{flex:1}}
`;

/**
 * api: { call(action, body) -> Promise<reply>, at() -> myAt(), join(plan) -> Promise<{ok, why|msg}>, online() -> Promise<[{n,w,copy,mode}]>, toast(html, ms) }
 */
export function createFriends(api) {
  let el = null, tab = 'friends', data = { me: '', friends: [], incoming: [], outgoing: [] }, loaded = false, busy = '', lastPoll = 0, polling = false;
  let search = { q: '', rows: null }, online = null, sureRemove = '', autoDone = false, seenIncoming = new Set(), firstList = true, dot = null;
  const auto = () => { try { return localStorage.getItem(FR_AUTO_KEY) === '1'; } catch { return false; } };
  const setAuto = (v) => { try { localStorage.setItem(FR_AUTO_KEY, v ? '1' : '0'); } catch {} };
  const toast = (m, ms = 2200) => { try { api.toast?.(m, ms); } catch {} };
  const isOpen = () => !!el && !el.hidden;

  function ensureCss() { if (typeof document !== 'undefined' && !document.getElementById('fr-css')) { const s = document.createElement('style'); s.id = 'fr-css'; s.textContent = CSS; document.head.appendChild(s); } }
  function ensure() {
    if (el || typeof document === 'undefined') return;
    ensureCss();
    el = document.createElement('div'); el.id = 'fr-panel'; el.hidden = true;
    el.innerHTML = `<div class="fr-box" role="dialog" aria-label="Friends"><div class="fr-head"><span>👥 FRIENDS</span><button type="button" class="fr-x" data-x aria-label="Close friends">✕</button></div>
      <div class="fr-tabs" role="tablist"></div><div class="fr-list"></div><div class="fr-foot"></div></div>`;
    document.body.appendChild(el);
    for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target?.matches?.('input[data-q]')) { e.preventDefault(); doSearch(); } e.stopPropagation(); });
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    el.querySelector('[data-x]').onclick = () => close();
    addEventListener('keydown', (e) => { if ((e.key === 'Escape' || e.code === 'Escape') && isOpen()) { e.preventDefault(); e.stopImmediatePropagation(); if (document.activeElement?.matches?.('#fr-panel input')) document.activeElement.blur(); else close(); } }, true);
  }

  const counts = () => ({ on: data.friends.filter((f) => f.on).length, req: data.incoming.length });
  function drawTabs() {
    const c = counts(), t = el.querySelector('.fr-tabs');
    t.innerHTML = [['friends', `FRIENDS${data.friends.length ? ` ${c.on}/${data.friends.length}` : ''}`], ['requests', `REQUESTS${c.req ? `<span class="fr-badge">${c.req}</span>` : ''}`], ['add', '+ ADD']]
      .map(([id, lab]) => `<button type="button" role="tab" data-tab="${id}" class="${tab === id ? 'on' : ''}" aria-selected="${tab === id}">${lab}</button>`).join('');
    t.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; sureRemove = ''; draw(); if (tab === 'add') loadOnline(); }; });
  }
  const row = (n, sub, acts, on = false) => `<div class="fr-row${on ? ' on' : ''}"><span class="fr-av" aria-hidden="true">${esc((n[0] || '?').toUpperCase())}</span><div class="fr-who"><b>${esc(n)}</b><em>${esc(sub)}</em></div><div class="fr-acts">${acts}</div></div>`;
  const btn = (a, n, label, cls = '', dis = false) => `<button type="button" class="fr-b ${cls}" data-a="${a}" data-n="${esc(n)}"${dis || busy ? ' disabled' : ''}>${label}</button>`;
  function drawFriends() {
    if (!loaded) return '<div class="fr-empty">Loading your crew…</div>';
    if (!data.friends.length) return `<div class="fr-empty">🏴‍☠️ No friends yet<small>tap + ADD to find pirates by name, or add someone from the Squad Hall / King of the Hill board</small></div>`;
    const cur = api.at?.() || null;
    return data.friends.map((f) => {
      const p = joinPlan(f, cur), sub = whereLabel(f) + (f.on && p.full ? ' · FULL' : '') + (p.here ? ' · YOU ARE HERE' : '');
      const join = f.on ? (p.ok ? btn('join', f.n, p.kind === 'arena' ? 'QUEUE' : 'JOIN', 'go') : btn('why', f.n, p.here ? 'HERE' : p.full ? 'FULL' : 'JOIN', 'no')) : '';
      const rm = sureRemove === f.n ? btn('remove', f.n, 'SURE?', 'warn') : btn('askremove', f.n, '✕', 'no');
      return row(f.n, sub, join + rm, f.on);
    }).join('');
  }
  function drawRequests() {
    let h = '';
    if (data.incoming.length) h += `<div class="fr-sec">WANT TO BE FRIENDS</div>` + data.incoming.map((n) => row(n, 'friend request', btn('accept', n, 'ACCEPT', 'go') + btn('decline', n, 'DECLINE', 'no'))).join('');
    if (data.outgoing.length) h += `<div class="fr-sec">SENT</div>` + data.outgoing.map((n) => row(n, 'waiting for them', btn('cancel', n, 'CANCEL', 'no'))).join('');
    return h || '<div class="fr-empty">No requests right now</div>';
  }
  const relation = (n) => { const k = n.toLowerCase(); if (data.friends.some((f) => f.n.toLowerCase() === k)) return 'friend'; if (data.outgoing.some((x) => x.toLowerCase() === k)) return 'sent'; if (data.incoming.some((x) => x.toLowerCase() === k)) return 'incoming'; return ''; };
  const addBtn = (n, s) => s === 'friend' ? btn('x', n, 'FRIENDS ✓', 'no', true) : s === 'sent' ? btn('x', n, 'SENT', 'no', true) : s === 'incoming' ? btn('accept', n, 'ACCEPT', 'go') : btn('add', n, '+ ADD', 'go');
  function drawAdd() {
    let h = `<div class="fr-add"><input data-q maxlength="20" placeholder="Pirate name" autocomplete="off" spellcheck="false" aria-label="Pirate name" value="${esc(search.q)}"><button type="button" class="fr-b" data-a="search" data-n=""${busy ? ' disabled' : ''}>SEARCH</button></div>`;
    if (search.rows) h += `<div class="fr-sec">RESULTS</div>` + (search.rows.length ? search.rows.map((p) => row(p.n, 'pirate', addBtn(p.n, relation(p.n) || p.s))).join('') : '<div class="fr-empty">No pirate with that name</div>');
    const me = (data.me || '').toLowerCase(), list = (online || []).filter((p) => p.n && p.n.toLowerCase() !== me).slice(0, 40);
    h += `<div class="fr-sec">PIRATES ONLINE NOW</div>` + (online == null ? '<div class="fr-empty">Checking every harbor + arena…</div>' : list.length ? list.map((p) => row(p.n, p.w === 'harbor' ? (p.copy ? `HARBOR #${p.copy}` : 'HARBOR') : p.w === 'arena' ? 'ARENA' : p.w === 'queue' ? 'QUEUE' : 'SPECTATING', addBtn(p.n, relation(p.n)))).join('') : '<div class="fr-empty">No other pirates online</div>');
    return h;
  }
  function drawFoot() {
    const f = el.querySelector('.fr-foot');
    f.innerHTML = `<button type="button" class="fr-b ${auto() ? 'go' : 'no'} fr-auto" data-a="auto" data-n="" aria-pressed="${auto()}">AUTO-JOIN FRIENDS: ${auto() ? 'ON' : 'OFF'}</button><span class="fr-gly">${document.documentElement.classList.contains('pfp-pad-ps') ? '✕ select · ○ back · L1/R1 tabs' : 'A select · B back · LB/RB tabs'}</span>`;
    f.querySelector('[data-a="auto"]').onclick = () => { setAuto(!auto()); drawFoot(); toast(auto() ? '👥 AUTO-JOIN ON<br><small>you will land on an online friend\'s server when you set sail</small>' : '👥 AUTO-JOIN OFF', 2400); };
  }
  function draw() {
    ensure(); if (!el) return;
    const focusKey = document.activeElement && el.contains(document.activeElement) ? (document.activeElement.dataset?.a || '') + '|' + (document.activeElement.dataset?.n || document.activeElement.dataset?.tab || '') : '';
    const qv = el.querySelector('input[data-q]'); if (qv) search.q = qv.value;
    drawTabs();
    const list = el.querySelector('.fr-list'), st = list.scrollTop;
    list.innerHTML = tab === 'requests' ? drawRequests() : tab === 'add' ? drawAdd() : drawFriends();
    list.scrollTop = st;
    list.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => act(b.dataset.a, b.dataset.n); });
    drawFoot(); badge();
    if (focusKey) { const [a, n] = focusKey.split('|'); const b = [...el.querySelectorAll('[data-a],[data-tab]')].find((x) => (x.dataset.a || '') === a && (x.dataset.n || x.dataset.tab || '') === n); try { b?.focus({ preventScroll: true }); } catch {} }
  }
  function badge() { // red count on the ⚙ button + the SETTINGS FRIENDS button + the server picker's FRIENDS button
    if (typeof document === 'undefined') return; ensureCss(); // the ⚙ / FRIENDS badges are styled before the panel is ever opened
    const cnt = data.incoming.length, g = document.getElementById('btn-pause');
    if (g) { if (!dot) { dot = document.createElement('span'); dot.className = 'fr-dot'; dot.setAttribute('aria-hidden', 'true'); } if (cnt) { dot.textContent = cnt > 9 ? '9+' : String(cnt); if (dot.parentNode !== g) g.appendChild(dot); } else dot.remove(); }
    for (const b of document.querySelectorAll('[data-fr-open]')) { const c = counts(); b.innerHTML = `👥 FRIENDS${c.on ? ` · ${c.on} ONLINE` : ''}${cnt ? `<span class="fr-dot" style="position:static;display:inline-block;margin-left:6px">${cnt > 9 ? '9+' : cnt}</span>` : ''}`; }
  }

  async function poll(force = false) {
    if (polling) return; polling = true; lastPoll = performanceNow();
    try {
      const r = await api.call('fr_list', { at: api.at?.() || { w: 'solo' }, ...(loaded && data.me ? {} : { name: cleanName(api.name?.() || '') }) }); // name: lets a Harbor-only pirate claim their board name once
      if (r && r.ok) {
        data = { me: cleanName(r.me), friends: Array.isArray(r.friends) ? r.friends : [], incoming: (r.incoming || []).map(cleanName).filter(Boolean), outgoing: (r.outgoing || []).map(cleanName).filter(Boolean) };
        loaded = true;
        const fresh = data.incoming.filter((n) => !seenIncoming.has(n.toLowerCase()));
        if (fresh.length && !firstList && !isOpen()) toast(`👥 <b>${esc(fresh[0])}</b> wants to be friends<br><small>⚙ SETTINGS → FRIENDS</small>`, 3200);
        data.incoming.forEach((n) => seenIncoming.add(n.toLowerCase())); firstList = false;
        if (isOpen()) draw(); else badge();
        maybeAutoJoin();
      } else if (!loaded && isOpen()) { loaded = true; draw(); }
    } catch {} finally { polling = false; }
    return data;
  }
  const performanceNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  async function loadOnline() { try { const r = await api.online?.(); online = Array.isArray(r) ? r : []; } catch { online = []; } if (isOpen() && tab === 'add') draw(); }
  async function doSearch() {
    const q = cleanName(el?.querySelector('input[data-q]')?.value ?? search.q); search.q = q;
    if (q.length < 2) { toast('type at least 2 letters'); return; }
    const r = await api.call('fr_search', { name: q }); search.rows = r?.ok ? (r.players || []).map((p) => ({ n: cleanName(p.n), s: p.s || '' })).filter((p) => p.n) : [];
    if (r && !r.ok) toast(esc(r.why || r.error || 'search failed'));
    draw();
  }
  async function write(action, name, extra = {}) {
    busy = name || action; draw();
    try {
      const r = await api.call(action, { name, ...extra });
      if (!r?.ok) { toast(esc(r?.why || r?.error || 'try again'), 2400); return r; }
      return r;
    } finally { busy = ''; await poll(true); draw(); }
  }
  async function act(a, n) {
    n = cleanName(n);
    if (a === 'search') return doSearch();
    if (a === 'askremove') { sureRemove = n; draw(); return; }
    if (a === 'add') { const r = await write('fr_request', n); if (r?.ok) toast(r.state === 'friends' ? `👥 You and <b>${esc(r.name)}</b> are friends!` : `👥 Request sent to <b>${esc(r.name)}</b>`); return; }
    if (a === 'accept') { const r = await write('fr_respond', n, { accept: true }); if (r?.ok) toast(`👥 You and <b>${esc(r.name)}</b> are friends!`); return; }
    if (a === 'decline') { await write('fr_respond', n, { accept: false }); return; }
    if (a === 'cancel') { await write('fr_cancel', n); return; }
    if (a === 'remove') { sureRemove = ''; const r = await write('fr_remove', n); if (r?.ok) toast(`Removed <b>${esc(r.name)}</b>`); return; }
    if (a === 'why') { const f = data.friends.find((x) => x.n === n); const p = joinPlan(f, api.at?.()); toast(esc(p.why || 'cannot join right now'), 2600); return; }
    if (a === 'join') return joinFriend(n);
  }
  async function joinFriend(n, quiet = false) {
    const f = data.friends.find((x) => x.n.toLowerCase() === String(n).toLowerCase()); const p = joinPlan(f, api.at?.());
    if (!p.ok) { if (!quiet) toast(esc(p.why), 2600); return p; }
    busy = n; if (isOpen()) draw();
    let r; try { r = await api.join(p, f); } catch (e) { r = { ok: false, why: e?.message || 'could not join' }; } finally { busy = ''; }
    if (r?.ok) { close(); toast(`👥 ${quiet ? 'AUTO-JOIN · ' : ''}Joining <b>${esc(f.n)}</b> · ${esc(p.label)}`, 2600); }
    else if (!quiet) toast(esc(r?.why || 'could not join'), 2600);
    if (isOpen()) draw();
    return r;
  }
  // AUTO-JOIN (setting): once per session, the first time you are sailing the Harbor and a friend is on a joinable server
  function maybeAutoJoin() {
    if (autoDone || !auto()) return; const cur = api.at?.(); if (!cur || cur.w !== 'harbor' || !(cur.copy > 0)) return;
    if (typeof window !== 'undefined' && window.__pfpResume) { autoDone = true; return; } // a phone-reload resume puts you back where you were: that wins
    autoDone = true; const f = pickAutoJoin(data.friends, cur); if (f) joinFriend(f.n, true);
  }
  function tick(now = performanceNow()) {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (!autoDone && auto() && now - lastPoll > 2500) { const c = api.at?.(); if (c?.w === 'harbor' && c.copy > 0) { poll(); return; } } // AUTO-JOIN: check as soon as you have a Harbor seat
    if (now - lastPoll > (isOpen() ? FR_POLL_OPEN_MS : FR_POLL_BG_MS)) poll();
  }
  function open(t) { ensure(); if (!el) return; if (t) tab = t; sureRemove = ''; el.hidden = false; draw(); poll(true); if (tab === 'add') loadOnline(); setTimeout(() => { try { if (document.documentElement.classList.contains('pfp-pad')) el.querySelector('.fr-tabs .on')?.focus({ preventScroll: true }); } catch {} }, 0); } // controller: start on the tab row (B / ✕ closes)
  function close() { if (el) el.hidden = true; }
  async function request(name) { name = cleanName(name); if (!name) return { ok: false }; const r = await api.call('fr_request', { name }); await poll(true);
    toast(r?.ok ? (r.state === 'friends' ? `👥 You and <b>${esc(r.name)}</b> are friends!` : `👥 Request sent to <b>${esc(r.name)}</b>`) : esc(r?.why || r?.error || 'try again'), 2400); return r; }
  const relationOf = (name) => relation(cleanName(name));
  return { open, close, tick, poll, request, joinFriend, relationOf, badge, get isOpen() { return isOpen(); }, get data() { return data; }, onlineFriends: () => data.friends.filter((f) => f.on), _draw: draw, _set(d) { data = { me: '', friends: [], incoming: [], outgoing: [], ...d }; loaded = true; if (isOpen()) draw(); else badge(); }, _setOnline(o) { online = o; if (isOpen()) draw(); }, _search(rows, q = '') { search = { q, rows }; draw(); } };
}
