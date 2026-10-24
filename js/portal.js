// Game portals (itch.io html*.itch.zone, Newgrounds uploads.ungrounded.net): offline, crypto-free presentation.
// config.js already turns off Supabase + wallet sign-in there (ON_PORTAL). This file only touches the DOM:
// removes the token/social/wallet/disclaimer bits, swaps the '?' panel for a how-to-play, and shows a this-device best
// score in place of the leaderboards. Does nothing on game.pumpfunpirates.com.
import { ON_PORTAL } from './config.js';
import { SKINS } from './skins.js';

const BEST_KEY = 'pfp_portal_best';
const $ = (id) => document.getElementById(id);
const getBest = () => { try { return Math.max(0, parseInt(localStorage.getItem(BEST_KEY), 10) || 0); } catch { return 0; } };
const setBest = (n) => { try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* private mode */ } };
const fmt = (n) => (n || 0).toLocaleString('en-US');

// main.js has a top-level await, so it can still be starting up when this runs: wait for it (it sets window.PFP last)
const mainReady = () => new Promise((res) => { const t = () => (window.PFP ? res() : setTimeout(t, 50)); t(); });
const neutral = (t) => t.replace(/the Solana seas/g, 'the seven seas');
if (ON_PORTAL) { for (const sk of SKINS) sk.blurb = neutral(sk.blurb); mainReady().then(initPortal); }
function initPortal() {
  // gone for good (nothing references them after start-up)
  document.querySelectorAll('#title .token-row, #title .wallet-row, #wallet-note, #title .disclaimer').forEach(el => el.remove());
  // hidden inputs that main.js still reads: keep them, but neutral and empty
  // (the game-over name/wallet form stays in the DOM, hidden by CSS: main.js looks its nodes up by id)
  const wi = $('wallet-input'); if (wi) { wi.value = ''; wi.placeholder = ''; wi.previousElementSibling?.remove(); }
  document.querySelectorAll('.sk-blurb').forEach(el => { el.textContent = neutral(el.textContent); }); // shop cards built before this ran
  // page meta (not shown, but keep the portal build clean)
  document.querySelectorAll('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]').forEach(m => m.setAttribute('content', 'PUMPFUN PIRATES: Storm Hunt, a stormy 3D pirate battle game in your browser. Sink enemy ships, grab the treasure, survive THE COMMODORE.'));
  // '?' panel: neutral how-to-play
  const card = document.querySelector('#faq .faq-card');
  if (card) {
    const close = $('faq-close');
    card.innerHTML = `<h3 id="faq-q1">How to play</h3>
      <p>Hit SET SAIL. Steer with A/D or ←/→, raise and lower sails with W/S or ↑/↓, and fire your port and starboard broadsides with Q and E. Space drops anchor; drag the mouse to look around.</p>
      <h3>Waves and THE COMMODORE</h3>
      <p>Every wave brings more enemy ships and tougher hulls. Every fourth wave, THE COMMODORE arrives with escorts.</p>
      <h3>Gold and the shipwright</h3>
      <p>Sink ships and grab their floating treasure, then spend your gold on upgrades, escort ships and new ship skins. Your best score and unlocks are saved in this browser.</p>`;
    if (close) card.prepend(close);
  }
  $('btn-faq')?.setAttribute('aria-label', 'How to play');
  // this-device best: start page (in place of TOP PIRATES) + game over
  const tb = document.createElement('div'); tb.className = 'portal-best'; tb.id = 'portal-best-title';
  document.querySelector('#title .col-b')?.prepend(tb);
  const gb = document.createElement('div'); gb.className = 'portal-best'; gb.id = 'portal-best-over';
  document.querySelector('#gameover .stats')?.after(gb);
  const showTitle = () => { const b = getBest(); tb.innerHTML = b ? `YOUR BEST <b>${fmt(b)}</b>` : 'SET SAIL AND SET A BEST SCORE'; };
  showTitle();
  const go = $('gameover');
  let wasOpen = false;
  new MutationObserver(() => {
    const open = !go.classList.contains('hidden');
    if (open && !wasOpen) {
      const score = parseInt(($('go-score')?.textContent || '0').replace(/\D/g, ''), 10) || 0, prev = getBest();
      if (score > prev) setBest(score);
      gb.innerHTML = score > prev && score > 0 ? `BEST <b>${fmt(score)}</b><span class="nb">NEW BEST!</span>` : `BEST <b>${fmt(Math.max(prev, score))}</b>`;
      showTitle();
    }
    wasOpen = open;
  }).observe(go, { attributes: true, attributeFilter: ['class'] });
}
