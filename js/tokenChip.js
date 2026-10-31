// Title screen: $SUNK contract-address chip (tap = copy the FULL CA) + DexScreener / X / Telegram links.
// Values live in config.js. No wallet, no signing: this only copies text and opens links.
import { SUNK_CA, SUNK_CA_TEXT, SUNK_DEX_URL, X_URL, TG_URL } from './config.js';

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
  $('ca-full').textContent = SUNK_CA_TEXT; $('ca-short').textContent = short(SUNK_CA_TEXT);
  chip.title = SUNK_CA ? `Copy $SUNK CA: ${SUNK_CA}` : '$SUNK CA: TBA';
  if (!SUNK_CA) { const cp = $('ca-copy'); if (cp) cp.style.display = 'none'; chip.setAttribute('aria-label', '$SUNK contract address: TBA'); }
  for (const [id, url] of [['lnk-dex', SUNK_DEX_URL], ['lnk-x', X_URL], ['lnk-tg', TG_URL]]) { const a = $(id); if (!a) continue; if (url) a.href = url; else a.style.display = 'none'; }
  // full CA when the row has room (wide desktop), else abc123…xyzpump; the copy is always the full address
  // Every layout (BANKSY): the FULL CA on its own line (monospace, never an ellipsis), link buttons on a row under it.
  // Too narrow: shrink to 11 px; still too narrow: the CA drops to its own line inside the chip and shrinks; last resort: wraps.
  const row = chip.parentElement, fit = () => {
    const ca = chip.querySelector('.ca');
    row.classList.toggle('ca-desk', !!SUNK_CA);
    if (SUNK_CA) {
      chip.classList.add('full'); chip.classList.remove('stack', 'wrap'); ca.style.fontSize = '';
      const over = () => ca.scrollWidth > ca.clientWidth + 1 || chip.scrollWidth > row.clientWidth + 1 || chip.getBoundingClientRect().right > row.getBoundingClientRect().right + 1;
      for (let px = 15; px >= 11 && over(); px -= 0.5) ca.style.fontSize = px + 'px';
      if (over()) { chip.classList.add('stack'); for (let px = 15; px >= 9 && over(); px -= 0.5) ca.style.fontSize = px + 'px'; }
      if (over()) chip.classList.add('wrap');
      return;
    }
    ca.style.fontSize = '';
    chip.classList.add('full');
    const socs = row.querySelector('.socs'), wrapped = socs && socs.offsetTop > chip.offsetTop + 4; // the row wraps; full CA only if links stay beside it
    if (ca.scrollWidth > ca.clientWidth + 1 || row.scrollWidth > row.clientWidth + 1 || wrapped) chip.classList.remove('full');
  };
  fit(); addEventListener('resize', fit); document.fonts?.ready.then(fit);
  const label = $('ca-copy'); let t = 0;
  chip.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!SUNK_CA) return; // CA: TBA, nothing to copy yet
    const ok = await copyText(SUNK_CA);
    label.textContent = ok ? 'COPIED!' : 'COPY FAILED'; chip.classList.toggle('copied', ok); chip.classList.toggle('failed', !ok);
    clearTimeout(t); t = setTimeout(() => { label.textContent = 'COPY'; chip.classList.remove('copied', 'failed'); }, 1600);
  });
}
init();
