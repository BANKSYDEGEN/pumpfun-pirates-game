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
// Links row on top; under it ONE pill: a native <select> ($SUNK default / $AHOY; native = touch-safe on iOS Safari) + the FULL CA + COPY.
// The shown CA, COPY and the chart link follow the pick (saved in pfp_ca_token). The full CA always shows: the font shrinks to fit,
// then the pill stacks (token + COPY on top, the CA on its own line), last resort the CA wraps. COPY always copies the full address.
const TOKENS = { SUNK: { ca: SUNK_CA, text: SUNK_CA_TEXT, dex: SUNK_DEX_URL }, AHOY: { ca: AHOY_CA, text: AHOY_CA || 'TBA', dex: AHOY_DEX_URL } };
const PICK_KEY = 'pfp_ca_token';
function init() {
  const chip = $('ca-chip'), line = $('ca-line'), sel = $('ca-token'); if (!chip || !line) return;
  for (const [id, url] of [['lnk-x', X_URL], ['lnk-tg', TG_URL]]) { const a = $(id); if (!a) continue; if (url) a.href = url; else a.style.display = 'none'; }
  let sym = 'SUNK'; try { const v = localStorage.getItem(PICK_KEY); if (TOKENS[v]) sym = v; } catch { /* private mode */ }
  const ca = chip.querySelector('.ca'), label = $('ca-copy');
  const fit = () => {
    line.classList.remove('stack', 'wrap'); ca.style.fontSize = '';
    const row = line.parentElement, over = () => ca.scrollWidth > ca.clientWidth + 1 || line.scrollWidth > line.clientWidth + 1 || line.getBoundingClientRect().width > row.clientWidth + 1;
    for (let px = 15; px >= 11 && over(); px -= 0.5) ca.style.fontSize = px + 'px';
    if (over()) { line.classList.add('stack'); ca.style.fontSize = ''; for (let px = 15; px >= 11 && over(); px -= 0.5) ca.style.fontSize = px + 'px'; }
    if (over()) { line.classList.add('wrap'); ca.style.fontSize = '12.5px'; } // narrow phones: two readable lines beat one tiny one
  };
  const show = () => {
    const T = TOKENS[sym]; if (sel) sel.value = sym;
    $('ca-full').textContent = T.text;
    chip.title = T.ca ? `Copy $${sym} CA: ${T.ca}` : `$${sym} CA: TBA`; chip.setAttribute('aria-label', T.ca ? `Copy the $${sym} contract address` : `$${sym} contract address: TBA`);
    if (label) { label.style.display = T.ca ? '' : 'none'; label.textContent = 'COPY'; } chip.classList.remove('copied', 'failed');
    const dex = $('lnk-dex'); if (dex) { if (T.dex) { dex.href = T.dex; dex.style.display = ''; } else dex.style.display = 'none'; dex.setAttribute('aria-label', `$${sym} chart on DexScreener`); dex.title = `$${sym} chart (DexScreener)`; }
    fit();
  };
  if (sel) {
    sel.addEventListener('change', () => { if (!TOKENS[sel.value]) return; sym = sel.value; try { localStorage.setItem(PICK_KEY, sym); } catch {} show(); });
    for (const t of ['click', 'pointerdown', 'touchstart']) sel.addEventListener(t, (e) => e.stopPropagation(), { passive: true }); // the title screen's own taps never see the pick
  }
  show(); addEventListener('resize', fit); document.fonts?.ready.then(fit);
  let t = 0;
  chip.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const T = TOKENS[sym]; if (!T.ca) return; // CA: TBA, nothing to copy yet
    const ok = await copyText(T.ca);
    label.textContent = ok ? 'COPIED!' : 'COPY FAILED'; chip.classList.toggle('copied', ok); chip.classList.toggle('failed', !ok);
    clearTimeout(t); t = setTimeout(() => { label.textContent = 'COPY'; chip.classList.remove('copied', 'failed'); }, 1600);
  });
}
init();
