// Title screen: website / DexScreener / X / Telegram links + the token pick ($SUNK / $AHOY) with its FULL contract address (tap = copy).
// Values live in config.js. No wallet, no signing: this only copies text and opens links.
import { SUNK_CA, SUNK_CA_TEXT, SUNK_DEX_URL, X_URL, TG_URL, AHOY_CA, AHOY_DEX_URL } from './config.js';

const $ = (id) => document.getElementById(id);

function legacyCopy(text) { // older iOS Safari: hidden textarea + execCommand('copy')
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.setAttribute('aria-hidden', 'true');
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;';
  document.body.appendChild(ta);
  const sel = document.getSelection(), prev = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove(); if (prev && sel) { sel.removeAllRanges(); sel.addRange(prev); }
  return ok;
}
export async function copyText(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch { /* fall back */ }
  return legacyCopy(text);
}

// [v113] BANKSY: "do full ca and links under it" -> "link buttons above ca" -> "on the ca do a drop down and add Ahoy as option too".
// Links row on top; under it ONE pill on ONE line: the token toggle + the CA (tap the CA = copy the full address, a COPIED! toast).
// [v117] BANKSY: "Fix the ui on the drop down" -> no list at all: the token label is ONE game-styled button; each click / tap / Enter / Space
// switches straight between $SUNK and $AHOY (⇄ icon). $SUNK stays the default.
// The shown CA, COPY and the chart link follow the pick (saved in pfp_ca_token). The full CA always shows: the font shrinks to fit,
// then the pill stacks (token + COPY on top, the CA on its own line), last resort the CA wraps. COPY always copies the full address.
const TOKENS = { SUNK: { ca: SUNK_CA, text: SUNK_CA_TEXT, dex: SUNK_DEX_URL, logo: 'assets/tokens/sunk.png' }, AHOY: { ca: AHOY_CA, text: AHOY_CA || 'TBA', dex: AHOY_DEX_URL, logo: 'assets/tokens/ahoy.png' } };
const ORDER = ['SUNK', 'AHOY'];   // [sunk-first] fixed order: $SUNK always first
const PICK_KEY = 'pfp_ca_token';
function init() {
  const chip = $('ca-chip'), line = $('ca-line'), sel = $('ca-token'); if (!chip || !line) return;
  for (const [id, url] of [['lnk-x', X_URL], ['lnk-tg', TG_URL]]) { const a = $(id); if (!a) continue; if (url) a.href = url; else a.style.display = 'none'; }
  let sym = ORDER[0]; // [sunk-first] BANKSY: "on home page $sunk always shows first": every load starts on $SUNK (a switch to $AHOY lasts this visit only)
  try { localStorage.removeItem(PICK_KEY); } catch { /* private mode */ }
  const ca = chip.querySelector('.ca'), full = $('ca-full'), label = $('ca-copy');
  // [v117] ONE line always: the toggle + the CA. The full CA shrinks 15 -> 10 px to fit; if it still can't (phones), a short CA
  // (By1Nd4…Bpump) on the same line. The tap / copy always uses the FULL address.
  const short = (t, n) => (t && t.length > 2 * n + 2 ? t.slice(0, n) + '…' + t.slice(-n) : t);
  const fit = () => {
    const T = TOKENS[sym]; line.classList.remove('stack', 'wrap', 'short');
    const row = line.parentElement, over = () => ca.scrollWidth > ca.clientWidth + 1 || line.scrollWidth > line.clientWidth + 1 || line.getBoundingClientRect().width > row.clientWidth + 1;
    const tryText = (txt, lo) => { full.textContent = txt; ca.style.fontSize = ''; for (let px = 15; px >= lo && over(); px -= 0.5) ca.style.fontSize = px + 'px'; return !over(); };
    if (tryText(T.text, 10)) return; // 44-char CA in ~280 px on the 1280-1440 desktop panel
    line.classList.add('short');
    for (const n of [6, 5, 4]) if (tryText(short(T.text, n), 12)) return;
  };
  const show = () => {
    const T = TOKENS[sym];
    if (sel) {
      const next = ORDER[(ORDER.indexOf(sym) + 1) % ORDER.length];
      const symEl = $('ca-token-sym'), logo = $('ca-token-logo');
      if (symEl) symEl.textContent = '$' + sym; if (logo) logo.src = T.logo;
      sel.dataset.sym = sym; sel.setAttribute('aria-label', `Token: $${sym}. Switch to $${next}`); sel.title = `Switch to $${next}`;
    }
    chip.title = T.ca ? `Tap to copy the $${sym} CA: ${T.ca}` : `$${sym} CA: TBA`; chip.setAttribute('aria-label', T.ca ? `Copy the $${sym} contract address ${T.ca}` : `$${sym} contract address: TBA`); chip.classList.toggle('tba', !T.ca);
    if (label) label.textContent = ''; chip.classList.remove('copied', 'failed');
    const dex = $('lnk-dex'); if (dex) { if (T.dex) { dex.href = T.dex; dex.style.display = ''; } else dex.style.display = 'none'; dex.setAttribute('aria-label', `$${sym} chart on DexScreener`); dex.title = `$${sym} chart (DexScreener)`; }
    fit();
  };
  if (sel) { // a real <button>: Enter / Space fire click natively, so keyboard + touch + mouse all take this one path
    sel.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      sym = ORDER[(ORDER.indexOf(sym) + 1) % ORDER.length]; show();
      sel.classList.remove('flip'); void sel.offsetWidth; sel.classList.add('flip');
    });
    for (const t of ['pointerdown', 'touchstart']) sel.addEventListener(t, (e) => e.stopPropagation(), { passive: true }); // the title screen's own taps never see the toggle
    for (const s of ORDER) { const i = new Image(); i.src = TOKENS[s].logo; } // both logos ready before the first switch
  }
  show(); addEventListener('resize', fit); document.fonts?.ready.then(fit);
  let t = 0;
  chip.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const T = TOKENS[sym]; if (!T.ca) return; // CA: TBA, nothing to copy yet
    const ok = await copyText(T.ca);
    label.textContent = ok ? 'COPIED!' : 'COPY FAILED'; chip.classList.remove('copied', 'failed'); void chip.offsetWidth; chip.classList.add(ok ? 'copied' : 'failed');
    clearTimeout(t); t = setTimeout(() => { label.textContent = ''; chip.classList.remove('copied', 'failed'); }, 1400);
  });
}
init();
