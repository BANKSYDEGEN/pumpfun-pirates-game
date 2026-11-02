// [v103] ported from Timothy c3c09f1 (timothy/ui-overhaul): BANKSY "the top-left player card is not clickable".
// PUMPFUN PIRATES · [ui overhaul] PROFILE panel (BANKSY: "Move the read only sign in the profile page" + "Get to that by clicking
// on your info top left"). Opened by a TAP / CLICK on the captain card (top left: name, avatar, HP). A drag that starts on the
// card still orbits the camera (the card keeps pointer-events: none; this module only watches the pointer, never blocks it).
// Holds what used to sit in the home screen's WAVES pop-up:
//   WALLET LABEL  the typed Solana address (read-only: a label for airdrops + your Waves scores; never signs, never boosts)
//   SAVE PROGRESS the read-only wallet sign-in (signs a free message) that saves Waves progress to the wallet
//   LINK WALLET   Battle Royale: the signed link (BR save + the holder 2× boost), the same button as the 🏴 menu's
//   ACCOUNT       [v106] SET PASSWORD for your name / LOG IN on another device / CHANGE PASSWORD / LOG OUT (js/accountUi.js)
// The nodes are MOVED, not copied: main.js / pvp.js keep their element references, listeners and flows. Crypto-free portal builds
// (itch.io / Newgrounds): main.js has already removed the wallet nodes there, and the crypto sections stay hidden.
import { ON_PORTAL } from './config.js';
import { isValidSolanaAddress, shortWallet, getSavedWallet, saveWallet } from './wallet.js';

const $ = (id) => document.getElementById(id), html = document.documentElement;
let root = null, pausedByUs = false;
const G = () => window.PFP?.game;
const isBR = () => G()?.mode === 'pvp' && !!window.PFP?.pvp;

function build() {
  root = document.createElement('div'); root.id = 'profile'; root.className = 'hidden'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Profile');
  root.innerHTML = `<div class="pf-card">
    <button id="pf-x" class="faq-x" type="button" aria-label="Close profile">✕</button>
    <div class="pf-head"><img id="pf-img" alt=""><div class="pf-who"><b id="pf-name"></b><small id="pf-stats"></small></div></div>
    <section class="pf-sec pf-crypto" id="pf-label"><h4>WALLET LABEL <em>read-only · no signing</em></h4>
      <p class="pf-note">A Solana address used as a label: airdrops and your WAVES scores. It never signs anything and gives <b>no boost</b>.</p></section>
    <section class="pf-sec pf-crypto pf-waves" id="pf-save"><h4>SAVE PROGRESS <em>read-only wallet sign-in</em></h4>
      <p class="pf-note">Signs a free message (never a transaction) so your WAVES progress follows the wallet.</p></section>
    <section class="pf-sec pf-crypto pf-br" id="pf-boost"><h4>LINK WALLET <em>Battle Royale · holder 2× gold</em></h4>
      <p class="pf-note">The signed link saves your Battle Royale progress to the wallet; holders of $SUNK / $AHOY get 2× gold. Only this signed link counts for the boost.</p>
      <button id="pf-link" type="button" class="pvp-btn">LINK WALLET</button><small id="pf-link-state" class="pf-note"></small></section>
    <section class="pf-sec" id="pf-acct"></section><!-- [v106] ACCOUNT: set password / log in / change / log out (js/accountUi.js) -->
  </div>`;
  document.body.appendChild(root);
  // the moved nodes (home WAVES pop-up -> profile)
  const lab = $('we-addr')?.closest('label'), msg = $('we-addr-msg'), row = document.querySelector('#waves-entry .wallet-row'), note = $('wallet-note');
  if (lab) $('pf-label').append(lab, msg || ''); if (row) $('pf-save').append(row); if (note) $('pf-save').append(note);
  if (!lab) $('pf-label').remove(); if (!row) $('pf-save').remove();
  if (ON_PORTAL) root.querySelectorAll('.pf-crypto').forEach(n => n.remove());
  // the WAVES pop-up points here instead (website only)
  if (!ON_PORTAL && $('we-go') && !$('we-prof-hint')) { const p = document.createElement('p'); p.id = 'we-prof-hint'; p.className = 'muted'; p.textContent = 'Wallet + save progress: tap your captain (top left) in game.'; $('we-go').before(p); }
  const a = $('we-addr');
  if (a) a.addEventListener('change', () => { // the label is saved here too (the WAVES pop-up used to save it on SET SAIL)
    const v = a.value.trim(); if (v && !isValidSolanaAddress(v)) return;
    saveWallet(v); const g = G(); if (g) g.wallet = v; if ($('wallet-short')) $('wallet-short').textContent = shortWallet(v);
    const b = $('pvp-entry-addr'); if (b) b.value = v; });
  $('pf-x').onclick = closeProfile;
  root.addEventListener('pointerdown', (e) => { if (e.target === root) closeProfile(); });
  for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'wheel']) root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  root.addEventListener('keydown', (e) => e.stopPropagation()); // typing an address never steers / fires
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isProfileOpen()) { e.stopPropagation(); e.preventDefault(); closeProfile(); } }, true);
  if ($('pf-link')) $('pf-link').onclick = () => { if (!isBR()) return; window.PFP.pvp.renderMenu?.(); $('pvp-wallet')?.click();
    clearInterval(renderBR.t); let n = 0; renderBR.t = setInterval(() => { renderBR(); if (++n > 240 || !isProfileOpen()) clearInterval(renderBR.t); }, 500); };
}
function renderBR() {
  const s = window.PFP_PVP_SAVE?.walletSession?.(), w = s?.wallet;
  $('pf-link').textContent = w ? 'DISCONNECT' : 'LINK WALLET';
  $('pf-link-state').textContent = w ? `Linked: ${shortWallet(w)}` : window.PFP_ACCT?.info() ? 'Not linked · progress saved to your account' : (document.getElementById('pvp-wallet-state')?.textContent || 'Not linked · progress saved on this device'); // [v106]
}
export const isProfileOpen = () => !!root && !root.classList.contains('hidden');
export function openProfile() {
  if (!root) build();
  const g = G(); root.classList.toggle('br', isBR()); root.classList.toggle('waves', !isBR());
  $('pf-img').src = $('captain-img')?.src || ''; $('pf-name').textContent = $('captain-name')?.textContent || '';
  const st = ['score', 'wave', 'gold', 'sunk'].map(id => [$(id)?.previousElementSibling?.textContent || '', $(id)?.textContent || '']).filter(([, v]) => v !== '');
  $('pf-stats').textContent = st.map(([l, v]) => `${l} ${v}`.trim()).join(' · ');
  const a = $('we-addr'); if (a) { a.value = getSavedWallet() || g?.wallet || ''; a.dispatchEvent(new Event('input')); }
  if (isBR() && $('pf-link')) renderBR();
  try { window.PFP_ACCT_UI?.renderProfile($('pf-acct')); } catch (e) { console.warn('[account] profile', e); }
  if (g && g.mode !== 'pvp' && g.state === 'playing') { g.state = 'paused'; pausedByUs = true; } // Waves pauses underneath (like ⚙); Battle Royale keeps going
  root.classList.remove('hidden'); html.classList.add('ui-profile');
  try { dispatchEvent(new CustomEvent('pfp-profile', { detail: { open: true } })); } catch {}
}
export function closeProfile() {
  if (!isProfileOpen()) return; root.classList.add('hidden'); html.classList.remove('ui-profile');
  const g = G(); if (pausedByUs && g && g.state === 'paused' && $('pause')?.classList.contains('hidden')) g.state = 'playing'; pausedByUs = false;
  try { dispatchEvent(new CustomEvent('pfp-profile', { detail: { open: false } })); } catch {}
}

// ---------- the captain card as the entry point: tap / click opens, drag still orbits ----------
const capRect = () => { const c = $('captain'); if (!c || $('hud')?.classList.contains('hidden') || html.classList.contains('pvp-spec') || html.classList.contains('ctl-edit')) return null;
  const r = c.getBoundingClientRect(); return r.width ? r : null; };
const inside = (r, x, y) => r && x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4;
let down = null, hover = false;
function setHover(on) { if (on === hover) return; hover = on; html.classList.toggle('ui-cap-hover', on); const cv = $('game'); if (cv) cv.style.cursor = on ? 'pointer' : ''; }
addEventListener('pointerdown', (e) => {
  if (isProfileOpen() || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) { down = null; return; }
  const top = document.elementFromPoint(e.clientX, e.clientY); if (top && top.closest('button, input, a, .overlay:not(.hidden), #pvp-menu, #shop, #emote-wheel, #hud-top')) { down = null; return; }
  down = inside(capRect(), e.clientX, e.clientY) ? { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId } : null;
  if (down) { html.classList.add('ui-cap-press'); setTimeout(() => html.classList.remove('ui-cap-press'), 180); }
}, { capture: true, passive: true });
addEventListener('pointermove', (e) => {
  if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) down = null; // a drag: the camera has it
  if (e.pointerType === 'mouse') setHover(!isProfileOpen() && inside(capRect(), e.clientX, e.clientY));
}, { capture: true, passive: true });
addEventListener('pointerup', (e) => {
  const d = down; down = null; if (!d || e.pointerId !== d.id) return;
  if (performance.now() - d.t < 600 && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 10 && inside(capRect(), e.clientX, e.clientY)) { setHover(false); openProfile(); }
}, { capture: true, passive: true });
addEventListener('pointercancel', () => { down = null; }, { capture: true, passive: true });

// build once the page (main.js, portal.js) has set itself up, so the moved nodes and the portal removals are final
const boot = () => setTimeout(() => { if (!root) build(); }, 0);
if (document.readyState === 'complete') boot(); else addEventListener('load', boot, { once: true });
window.PFP_PROFILE = { openProfile, closeProfile, isProfileOpen };
