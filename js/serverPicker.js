// [backpack-pvp] BANKSY t1694u "Also give ability to choose own / new server": the Harbor SERVER SELECTOR.
//   public Harbor copies (pfp-harbor-1..60, migration 021/041/044 pvp_harbor 'copies'), + NEW PUBLIC SERVER (p_want_copy -1 = lowest
//   empty copy), PICK a copy (p_want_copy 1..60: joins when it has room and the Realtime budget allows), OWN / PRIVATE server codes
//   ([A-Za-z0-9]{2,12} -> prefix 'pfp-harbor-<code lower>': an isolated copy set your friends join with the same code), AUTO PUBLIC.
// Pure helpers on top (unit-tested); the modal is built lazily (no DOM at import). Every code / peer string goes through js/safe.js.
import { escHtml } from './safe.js';

export const SERVER_PICKER_ON = !(typeof location !== 'undefined' && /[?&]srvpick=0(&|$)/.test(location.search || ''));
export const PUBLIC_PREFIX = 'pfp-harbor';
export const MAX_COPY = 60;
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';           // no 0 / O / 1 / I
const RESERVED = new Set(['v1', 'v1sq', 'sq', 'test']);         // test-room / arena names (js/pvp.js ?pvproom)

/** 'k7-p9q!' -> 'K7P9Q'; '' when it can't be a code (2..12 letters / digits). */
export function cleanServerCode(s) {
  const c = String(s ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase();
  return c.length >= 2 && !RESERVED.has(c.toLowerCase()) ? c : '';
}
export const ownPrefix = (code) => { const c = cleanServerCode(code); return c ? `${PUBLIC_PREFIX}-${c.toLowerCase()}` : null; };
export function codeOfPrefix(prefix) { const m = /^pfp-harbor-([a-z0-9]{2,12})$/.exec(String(prefix || '')); return m ? m[1].toUpperCase() : ''; }
export function newServerCode(rand = Math.random) { let s = ''; for (let i = 0; i < 5; i++) s += CODE_ABC[Math.floor(rand() * CODE_ABC.length) % CODE_ABC.length]; return s; }
export const cleanCopy = (c) => { const n = Math.floor(Number(c)); return Number.isFinite(n) && n >= 1 && n <= MAX_COPY ? n : 0; };

/** The current-server pill text: 'HARBOR #1' | 'OWN · K7P9Q' | 'HARBOR · connecting'. */
export function serverLabel({ prefix = PUBLIC_PREFIX, copy = 0 } = {}) {
  const code = codeOfPrefix(prefix);
  if (code) return `OWN · ${code}`;
  return copy ? `HARBOR #${copy | 0}` : 'HARBOR · AUTO';
}
/** Rows for ACTIVE PUBLIC SERVERS from the RPC's [[copy, pirates], ...]. */
export function publicRows(copies = [], { cap = 8, cur = 0 } = {}) {
  const out = [];
  for (const r of Array.isArray(copies) ? copies : []) {
    const copy = cleanCopy(Array.isArray(r) ? r[0] : r?.copy), n = Math.max(0, Math.floor(Number(Array.isArray(r) ? r[1] : r?.n) || 0));
    if (!copy) continue;
    out.push({ copy, n, cap, full: n >= cap, here: copy === (cur | 0), text: `Harbor #${copy} · ${Math.min(n, 99)}/${cap} Pirates` });
  }
  return out.sort((a, b) => a.copy - b.copy).slice(0, MAX_COPY);
}
/**
 * What a switch asks the harbor for. kind: 'pick' (arg copy) | 'new' | 'own' (arg code) | 'create' | 'auto'.
 * -> { ok, prefix, wantCopy, code, label } | { ok:false, why }
 */
export function planSwitch(kind, arg, rand = Math.random) {
  if (kind === 'pick') { const c = cleanCopy(arg); return c ? { ok: true, prefix: PUBLIC_PREFIX, wantCopy: c, code: '', label: `HARBOR #${c}` } : { ok: false, why: 'pick a harbor 1-60' }; }
  if (kind === 'new') return { ok: true, prefix: PUBLIC_PREFIX, wantCopy: -1, code: '', label: 'NEW PUBLIC SERVER' };
  if (kind === 'auto') return { ok: true, prefix: PUBLIC_PREFIX, wantCopy: 0, code: '', label: 'AUTO PUBLIC' };
  if (kind === 'create' || kind === 'own') {
    const code = kind === 'create' ? newServerCode(rand) : cleanServerCode(arg);
    if (!code) return { ok: false, why: 'codes are 2-12 letters / numbers' };
    return { ok: true, prefix: ownPrefix(code), wantCopy: 1, code, label: `OWN · ${code}` };
  }
  return { ok: false, why: 'unknown' };
}

const CSS = `
/* [v328] BANKSY t1736u: #srv-btn matches #pvp-harbor-spec ghost from frame 1 (style injected in mountButton, not only on open) */
#srv-btn{font:17px 'Just Another Hand',cursive;letter-spacing:.05em;padding:5px 12px 3px;border-radius:999px;border:1px solid rgba(255,205,119,0.45);background:rgba(14,14,14,0.72);color:#fff;cursor:pointer;margin:0;line-height:1.1;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
#srv-btn:hover,#srv-btn:focus-visible{border-color:var(--gold,#ffcd77);color:var(--gold,#ffcd77);background:rgba(26,15,7,0.88);outline:none}
#srv-btn.pad-focus{box-shadow:0 0 0 2px #000,0 0 0 4px var(--gold,#ffcd77)}
#pvp-harbor.ph-compact #srv-btn{display:inline-flex!important}/* [v339] hub modal: never hide Switch Server */
#srv-modal{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);font-family:'Just Another Hand',cursive}
#srv-modal.on{display:flex}
#srv-modal .sv-box{width:min(560px,94vw);max-height:90vh;overflow:auto;background:linear-gradient(#2e1c0d,#1d1208);border:3px solid #ffcd77;border-radius:16px;box-shadow:0 12px 40px #000;color:#f4e2bb;padding:12px 16px 16px}
#srv-modal h2{margin:0;font-size:34px;letter-spacing:.08em;color:#ffcd77;display:flex;align-items:center;gap:10px}
#srv-modal h2 button{margin-left:auto;width:40px;height:40px;border-radius:50%;border:2px solid #ffcd77;background:#1a0f07;color:#ffcd77;font-size:20px;cursor:pointer}
#srv-modal .sv-cur{display:inline-block;margin:4px 0 10px;padding:2px 12px;border-radius:999px;border:2px solid #34d399;color:#a7f3d0;background:#0b1f16;font-size:22px;letter-spacing:.05em}
#srv-modal h3{margin:10px 0 4px;font-size:24px;color:#ffcd77;letter-spacing:.06em;border-bottom:2px solid rgba(255,205,119,.25)}
#srv-modal .sv-row{display:flex;align-items:center;gap:8px;padding:5px 8px;margin:4px 0;border:2px solid #6b4a24;border-radius:10px;background:#1a1008;font-size:22px}
#srv-modal .sv-row.here{border-color:#34d399}
#srv-modal .sv-row span{flex:1}
#srv-modal button.sv{font:20px 'Just Another Hand',cursive;letter-spacing:.05em;padding:4px 14px 2px;border-radius:10px;border:2px solid #ffcd77;background:#3a240f;color:#ffcd77;cursor:pointer}
#srv-modal button.sv.big{width:100%;font-size:24px;margin:6px 0;background:#4a2e12}
#srv-modal button.sv:disabled{opacity:.45;cursor:default}
#srv-modal .sv-own{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#srv-modal input{font:bold 18px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;width:150px;padding:6px 8px;border-radius:8px;border:2px solid #6b4a24;background:#120b05;color:#ffcd77}
#srv-modal .sv-note{font:13px system-ui,sans-serif;color:#cdb68c;margin:4px 0 0}
`;

/**
 * UI + glue. api: { info() -> { prefix, copy, copies, cap, wantCopy }, switchTo(plan) -> Promise<{ok, msg|why}>, toast(m) }
 */
export function createServerPicker(api) {
  let el = null, btn = null, styleEl = null, fr = null; // [v356 friends] fr = { rows() -> [{ n, label, ok, why }], join(name), open() } (set by js/dock/index.js)
  function ensureStyle() {
    if (styleEl || typeof document === 'undefined') return;
    styleEl = document.createElement('style'); styleEl.id = 'srv-picker-css'; styleEl.textContent = CSS; document.head.appendChild(styleEl);
  }
  function ensure() {
    if (el || typeof document === 'undefined') return;
    ensureStyle();
    el = document.createElement('div'); el.id = 'srv-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Choose server');
    document.body.appendChild(el);
    for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'keydown' });
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
  }
  function mountButton() {
    if (!SERVER_PICKER_ON || btn || typeof document === 'undefined') return;
    ensureStyle(); // [v328] style BEFORE first paint — never wait for open()
    const host = document.querySelector('#pvp-harbor .ph-btns') || document.getElementById('pvp-harbor'); if (!host) return;
    btn = document.createElement('button'); btn.id = 'srv-btn'; btn.type = 'button'; btn.className = 'ghost'; btn.textContent = '⚓ SWITCH / PRIVATE SERVER'; btn.title = 'Choose / create a server';
    btn.addEventListener('click', (e) => { e.stopPropagation(); open(); }); host.appendChild(btn);
  }
  function render() {
    ensure(); if (!el) return;
    const i = api.info(), rows = publicRows(i.copies, { cap: i.cap || 8, cur: codeOfPrefix(i.prefix) ? 0 : i.copy }), code = codeOfPrefix(i.prefix);
    el.innerHTML = `<div class="sv-box"><h2>⚓ CHOOSE SERVER <button type="button" data-x aria-label="Close">✕</button></h2>
      <div class="sv-cur" data-cur>${escHtml(serverLabel(i))}</div>
      ${friendsHtml()}
      <h3>ACTIVE PUBLIC SERVERS</h3>
      <div data-list>${rows.length ? rows.map((r) => `<div class="sv-row${r.here ? ' here' : ''}"><span>${escHtml(r.text)}${r.here ? ' · YOU' : ''}</span><button type="button" class="sv" data-pick="${r.copy}" ${r.here || r.full ? 'disabled' : ''}>${r.here ? 'HERE' : r.full ? 'FULL' : 'JOIN'}</button></div>`).join('') : '<div class="sv-row"><span>No other public harbors right now</span></div>'}</div>
      <button type="button" class="sv big" data-new>+ NEW PUBLIC SERVER</button>
      <h3>OWN / PRIVATE SERVER</h3>
      <div class="sv-own"><button type="button" class="sv" data-create>CREATE OWN SERVER</button>
        <input data-code maxlength="12" placeholder="CODE" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Server code" value="${escHtml(code)}">
        <button type="button" class="sv" data-join>JOIN CODE</button><button type="button" class="sv" data-copy ${code ? '' : 'disabled'}>COPY CODE</button>
        <button type="button" class="sv" data-auto>AUTO PUBLIC</button></div>
      <p class="sv-note">Own servers are private harbors: share the code and your crew lands in the same copy (up to 8 pirates). Open-water ship PvP is on outside Safe Harbor.</p></div>`;
    el.querySelector('[data-x]').onclick = close;
    el.querySelectorAll('[data-fjoin]').forEach((b) => { b.onclick = async () => { if (!fr) return; const r = await fr.join(b.dataset.fjoin); if (r?.ok) close(); else render(); }; });
    el.querySelector('[data-fopen]')?.addEventListener('click', () => fr?.open?.());
    el.querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => go(planSwitch('pick', b.dataset.pick)); });
    el.querySelector('[data-new]').onclick = () => go(planSwitch('new'));
    el.querySelector('[data-create]').onclick = () => go(planSwitch('create'));
    el.querySelector('[data-join]').onclick = () => go(planSwitch('own', el.querySelector('[data-code]').value));
    el.querySelector('[data-auto]').onclick = () => go(planSwitch('auto'));
    el.querySelector('[data-copy]').onclick = async () => { const c = codeOfPrefix(api.info().prefix); if (!c) return; try { await navigator.clipboard?.writeText(c); } catch {} api.toast?.(`⚓ Code ${escHtml(c)} copied`); };
  }
  function friendsHtml() { // [v356 friends] FRIENDS ONLINE: one-tap JOIN onto a friend's server (+ open the Friends panel)
    if (!fr) return '';
    let rows = []; try { rows = (fr.rows?.() || []).slice(0, 12); } catch { rows = []; }
    return `<h3>👥 FRIENDS ONLINE</h3>${rows.length ? rows.map((r) => `<div class="sv-row${r.here ? ' here' : ''}"><span>${escHtml(r.n)} · ${escHtml(r.label)}</span><button type="button" class="sv" data-fjoin="${escHtml(r.n)}" ${r.ok ? '' : 'disabled'} title="${escHtml(r.why || '')}">${r.ok ? (r.kind === 'arena' ? 'QUEUE' : 'JOIN') : r.here ? 'HERE' : r.full ? 'FULL' : 'JOIN'}</button></div>`).join('') : '<div class="sv-row"><span>No friends online right now</span></div>'}
      <button type="button" class="sv big" data-fopen data-fr-open>👥 FRIENDS</button>`;
  }
  async function go(plan) {
    if (!plan?.ok) { api.toast?.(escHtml(plan?.why || 'no')); return plan; }
    const r = await api.switchTo(plan); render(); return r;
  }
  function open() { ensure(); render(); el?.classList.add('on'); }
  function close() { el?.classList.remove('on'); }
  return {
    open, close, render, mountButton, go, setFriends: (h) => { fr = h || null; if (el?.classList.contains('on')) render(); },
    get isOpen() { return !!el?.classList.contains('on'); },
    pick: (copy) => go(planSwitch('pick', copy)), newServer: () => go(planSwitch('new')), create: () => go(planSwitch('create')),
    joinCode: (code) => go(planSwitch('own', code)), auto: () => go(planSwitch('auto')), info: () => ({ ...api.info(), label: serverLabel(api.info()) }),
  };
}
