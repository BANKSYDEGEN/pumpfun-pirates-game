// Title screen: $AHOY contract-address chip (tap = copy the FULL CA) + DexScreener / X / Telegram links.
// Values live in config.js. No wallet, no signing: this only copies text and opens links.
import { AHOY_CA, AHOY_DEX_URL, X_URL, TG_URL } from './config.js';

const $ = (id) => document.getElementById(id);
const short = (a) => a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-6)}` : a;

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

function init() {
  const chip = $('ca-chip'); if (!chip) return;
  $('ca-full').textContent = AHOY_CA; $('ca-short').textContent = short(AHOY_CA);
  chip.title = `Copy $AHOY CA: ${AHOY_CA}`;
  for (const [id, url] of [['lnk-dex', AHOY_DEX_URL], ['lnk-x', X_URL], ['lnk-tg', TG_URL]]) { const a = $(id); if (a) a.href = url; }
  // full CA when the row has room (wide desktop), else 39eBix…5ppump; the copy is always the full address
  const row = chip.parentElement, fit = () => {
    chip.classList.add('full');
    const ca = chip.querySelector('.ca');
    const socs = row.querySelector('.socs'), wrapped = socs && socs.offsetTop > chip.offsetTop + 4; // the row wraps; full CA only if links stay beside it
    if (ca.scrollWidth > ca.clientWidth + 1 || row.scrollWidth > row.clientWidth + 1 || wrapped) chip.classList.remove('full');
  };
  fit(); addEventListener('resize', fit); document.fonts?.ready.then(fit);
  const label = $('ca-copy'); let t = 0;
  chip.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const ok = await copyText(AHOY_CA);
    label.textContent = ok ? 'COPIED!' : 'COPY FAILED'; chip.classList.toggle('copied', ok); chip.classList.toggle('failed', !ok);
    clearTimeout(t); t = setTimeout(() => { label.textContent = 'COPY'; chip.classList.remove('copied', 'failed'); }, 1600);
  });
}
init();
