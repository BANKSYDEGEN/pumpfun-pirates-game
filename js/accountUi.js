// PUMPFUN PIRATES · [v106] PLAYER ACCOUNTS UI (BANKSY: "Add the account password part next").
// No sign-up: your pirate NAME is the account. PROFILE (tap the captain card) > ACCOUNT: SET PASSWORD for your name, then LOG IN
// with name + password on any other device and play as the same pirate. Logged in: CHANGE PASSWORD (logs out every other
// device) and LOG OUT. Home screen: a small LOG IN link under ENTER GAME for a fresh device. A name pop-up that finds the name
// taken by a pirate with a password offers LOG IN for it. No email, so no recovery: the panel says so.
// The password only ever goes to the pvp Edge Function over HTTPS (js/pvpSave.js); this file never stores it.
import { getSavedName } from './wallet.js';

const $ = (id) => document.getElementById(id), A = () => window.PFP_ACCT;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PW_MIN = 10; // [security M3] new passwords (the server enforces it too; existing 8-9 character passwords still log in)
function toast(msg) {
  let t = $('copy-toast'); if (!t) { t = document.createElement('div'); t.id = 'copy-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 4200);
}
const eye = (id) => `<button type="button" class="acct-eye" data-for="${id}" aria-label="Show password" aria-pressed="false">SHOW</button>`;
const pwField = (id, label, auto) => `<label class="acct-field"><span>${label}</span><span class="acct-pw"><input id="${id}" type="password"${auto === 'new-password' ? ` minlength="${PW_MIN}"` : ''} maxlength="72" autocomplete="${auto}" spellcheck="false" autocapitalize="off" autocorrect="off">${eye(id)}</span></label>`;
function wireEyes(root) {
  root.querySelectorAll('.acct-eye').forEach((b) => b.onclick = (e) => { e.preventDefault(); const i = $(b.dataset.for); if (!i) return;
    const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? 'HIDE' : 'SHOW'; b.setAttribute('aria-pressed', String(show)); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); });
}
const guard = (el) => { for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'wheel', 'keydown', 'keyup']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'keydown' }); };
const busy = (btn, on, txt) => { btn.disabled = on; if (txt) btn.textContent = txt; };

// ---------- LOG IN pop-up (home screen + profile + name-taken) ----------
let modal = null;
function buildModal() {
  modal = document.createElement('div'); modal.id = 'acct-login'; modal.className = 'hidden'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'al-h');
  modal.innerHTML = `<form class="acct-card" novalidate>
    <button id="al-x" class="faq-x" type="button" aria-label="Close">✕</button>
    <h2 id="al-h">LOG IN</h2>
    <p class="acct-note">Your pirate name + the password you set in PROFILE on your other device.</p>
    <label class="acct-field"><span>PIRATE NAME</span><input id="al-name" type="text" maxlength="20" autocomplete="username" spellcheck="false" autocapitalize="off" autocorrect="off" enterkeyhint="next"></label>
    ${pwField('al-pw', 'PASSWORD', 'current-password')}
    <small id="al-msg" class="acct-msg" role="alert"></small>
    <button id="al-go" type="submit" class="pvp-btn big">LOG IN</button>
    <p class="acct-note small">This device switches to that pirate's progress. Its own save is kept and comes back if you log out.</p>
  </form>`;
  document.body.appendChild(modal); guard(modal); wireEyes(modal);
  for (const id of ['al-name', 'al-pw']) $(id).addEventListener('input', () => { $('al-msg').textContent = ''; });
  const close = () => closeLogin();
  $('al-x').onclick = close; modal.addEventListener('pointerdown', (e) => { if (e.target === modal) close(); });
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  modal.querySelector('form').addEventListener('submit', async (e) => { e.preventDefault();
    const go = $('al-go'), msg = $('al-msg'), name = $('al-name').value.trim(), pw = $('al-pw').value; if (go.disabled) return;
    if (!name || !pw) { msg.textContent = 'Type your pirate name and password.'; return; }
    busy(go, true, 'LOGGING IN…'); msg.textContent = '';
    const r = await A()?.login(name, pw);
    if (r?.ok) { $('al-pw').value = ''; msg.textContent = ''; go.textContent = 'LOGGED IN ✓'; try { sessionStorage.setItem('pfp_acct_welcome', r.name); } catch {} setTimeout(() => location.reload(), 350); return; }
    busy(go, false, 'LOG IN'); msg.textContent = r?.status === 429 ? r.error : r?.status === 401 ? 'Wrong name or password.' : (r?.error && r.status ? r.error : 'Could not reach the server. Try again.');
    $('al-pw').select?.(); });
}
export function openLogin(name = '') {
  if (!modal) buildModal();
  if (A()?.info()) { toast(`Already logged in as ${A().info().name}. Log out first (PROFILE).`); return; }
  $('al-name').value = name || ''; $('al-pw').value = ''; $('al-msg').textContent = ''; busy($('al-go'), false, 'LOG IN');
  modal.classList.remove('hidden'); document.documentElement.classList.add('acct-open');
  setTimeout(() => (name ? $('al-pw') : $('al-name')).focus(), 60);
}
export function closeLogin() { if (!modal) return; modal.classList.add('hidden'); document.documentElement.classList.remove('acct-open'); $('al-pw').value = ''; }

// ---------- PROFILE > ACCOUNT section ----------
export function renderProfile(sec) {
  if (!sec || !A()) return;
  const info = A().info(), name = info?.name || getSavedName();
  sec.classList.add('acct-sec');
  if (info) {
    sec.innerHTML = `<h4>ACCOUNT <em>logged in</em></h4>
      <p class="pf-note acct-ok">✔ Logged in as <b>${esc(info.name)}</b>. Your progress is the same on every device you log in on.</p>
      <div class="pf-row acct-row"><button id="pa-chg" type="button" class="ghost">CHANGE PASSWORD</button><button id="pa-out" type="button" class="ghost">LOG OUT</button></div>
      <div id="pa-chg-f" class="acct-sub" hidden>${pwField('pa-old', 'CURRENT PASSWORD', 'current-password')}${pwField('pa-new', 'NEW PASSWORD (10+ characters)', 'new-password')}
        <small class="pf-note">Every other device gets logged out.</small><button id="pa-chg-go" type="button" class="pvp-btn">SAVE NEW PASSWORD</button></div>
      <div id="pa-out-f" class="acct-sub" hidden><small class="pf-note">Log out? This device goes back to its own save. Your pirate stays safe on the account: log in again any time.</small>
        <div class="pf-row acct-row"><button id="pa-out-go" type="button" class="pvp-btn">LOG OUT</button><button id="pa-out-no" type="button" class="ghost">CANCEL</button></div></div>
      <small id="pa-msg" class="acct-msg" role="status"></small>`;
    wireEyes(sec);
    $('pa-chg').onclick = () => { $('pa-chg-f').hidden = !$('pa-chg-f').hidden; $('pa-out-f').hidden = true; if (!$('pa-chg-f').hidden) $('pa-old').focus(); };
    $('pa-out').onclick = () => { $('pa-out-f').hidden = !$('pa-out-f').hidden; $('pa-chg-f').hidden = true; };
    $('pa-out-no').onclick = () => { $('pa-out-f').hidden = true; };
    $('pa-chg-go').onclick = async () => { const b = $('pa-chg-go'), m = $('pa-msg'), o = $('pa-old').value, n = $('pa-new').value; if (b.disabled) return;
      if (n.length < PW_MIN) { m.textContent = `New password: at least ${PW_MIN} characters.`; return; }
      busy(b, true, 'SAVING…'); const r = await A().changePassword(o, n); busy(b, false, 'SAVE NEW PASSWORD');
      if (r.ok) { $('pa-old').value = ''; $('pa-new').value = ''; $('pa-chg-f').hidden = true; m.textContent = `Password changed.${r.loggedOut ? ` ${r.loggedOut} other device${r.loggedOut > 1 ? 's' : ''} logged out.` : ''}`; }
      else m.textContent = r.status === 401 ? 'Current password is wrong.' : (r.error || 'Could not reach the server.'); };
    $('pa-out-go').onclick = async () => { const b = $('pa-out-go'); if (b.disabled) return; busy(b, true, 'LOGGING OUT…'); await A().logout(); try { sessionStorage.setItem('pfp_acct_bye', '1'); } catch {} location.reload(); };
  } else {
    sec.innerHTML = `<h4>ACCOUNT <em>optional · no email</em></h4>
      <p class="pf-note">Progress is saved on this device. Set a password for your pirate name to log in and play on any device.</p>
      ${name ? `<p class="pf-note">Pirate name: <b class="acct-name">${esc(name)}</b></p>${pwField('pa-pw', 'PASSWORD (10+ characters)', 'new-password')}
      <p class="pf-note acct-warn">No email, no recovery: if you forget it, it can't be reset. Write it down.</p>
      <button id="pa-set" type="button" class="pvp-btn">SET PASSWORD</button>` : `<p class="pf-note acct-warn">Pick a pirate name first (SET SAIL pop-up), then come back here.</p>`}
      <p class="pf-note acct-alt">Already set one on another device? <button id="pa-login" type="button" class="wallet-link">LOG IN</button></p>
      <small id="pa-msg" class="acct-msg" role="status"></small>`;
    wireEyes(sec);
    $('pa-login').onclick = () => openLogin();
    if ($('pa-set')) $('pa-set').onclick = async () => { const b = $('pa-set'), m = $('pa-msg'), pw = $('pa-pw').value; if (b.disabled) return;
      if (pw.length < PW_MIN) { m.textContent = `At least ${PW_MIN} characters.`; $('pa-pw').focus(); return; }
      busy(b, true, 'SAVING…'); m.textContent = ''; const r = await A().setPassword(pw, name); busy(b, false, 'SET PASSWORD');
      if (r.ok) { $('pa-pw').value = ''; toast(`Password set for ${r.name}. Log in with it on any device.`); renderProfile(sec); $('pa-msg').textContent = `Password set for ${r.name}.`; }
      else m.textContent = r.taken ? 'That name belongs to another pirate. Pick another name first.' : (r.error || 'Could not reach the server.'); };
  }
  sec.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; e.preventDefault();
    const btn = sec.querySelector(i.id === 'pa-pw' ? '#pa-set' : '#pa-chg-go'); btn?.click(); }));
}

// ---------- the name pop-ups: a name taken by a pirate with a password -> LOG IN ----------
export function nameTaken(msgEl, name) {
  if (!msgEl) return false; if (!A()?.takenByAccount(name)) { msgEl.textContent = 'Name taken. Pick another.'; return false; }
  msgEl.innerHTML = `"${esc(name)}" is taken. Is it yours? <button type="button" class="wallet-link acct-taken-login">LOG IN</button>`;
  msgEl.querySelector('button').onclick = (e) => { e.preventDefault(); e.stopPropagation(); document.querySelectorAll('#pvp-entry, #waves-entry').forEach(n => n.classList.add('hidden')); openLogin(name); };
  return true;
}

// ---------- home screen: LOG IN link under ENTER GAME (fresh device) / who is logged in ----------
function homeRow() {
  const after = document.querySelector('#title .start-row'); if (!after) return;
  let row = $('acct-home'); if (!row) { row = document.createElement('div'); row.id = 'acct-home'; row.className = 'row acct-home'; after.after(row); }
  const info = A()?.info();
  row.innerHTML = info ? `<span class="acct-who">⚓ Logged in as <b>${esc(info.name)}</b></span>` : `<span class="acct-who">Already a pirate?</span> <button id="btn-acct-login" type="button" class="wallet-link">LOG IN</button>`;
  $('btn-acct-login')?.addEventListener('click', (e) => { e.stopPropagation(); openLogin(); });
}
function boot() {
  if (!A()) return setTimeout(boot, 200);
  homeRow();
  let note = A().note(); try { const w = sessionStorage.getItem('pfp_acct_welcome'), bye = sessionStorage.getItem('pfp_acct_bye'); sessionStorage.removeItem('pfp_acct_welcome'); sessionStorage.removeItem('pfp_acct_bye');
    if (w && !note) note = `Logged in as ${w}. Your progress is here.`; else if (bye && !note) note = 'Logged out. This device is back to its own save.'; } catch {}
  if (note) setTimeout(() => toast(note), 600);
  A().check(); // logged out elsewhere (password changed)? -> back to this device's own save
}
addEventListener('pfp-acct', (e) => { if (e.detail?.out) location.reload(); else homeRow(); });
if (document.readyState === 'complete') setTimeout(boot, 0); else addEventListener('load', () => setTimeout(boot, 0), { once: true });
window.PFP_ACCT_UI = { openLogin, closeLogin, renderProfile, nameTaken };
