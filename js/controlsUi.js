// [controls] the CONTROLS overlay (home ⌨, in-game ⌨, pause): keyboard list with click-then-press rebinding on desktop, touch list on phones.
// Every controls line on the page ([data-ctl]) follows the current binds.
import { ACTIONS, binds, setBind, resetBinds, keyName, controlsLine, onBindsChange } from './keybinds.js';
import { CONSOLE, padConnected, padHelpHtml, padActive, padLine, onPadMode } from './gamepad.js'; // [Emerly gamepad] the controller map (a pad plugged in, or a console)
const $ = (id) => document.getElementById(id);
const KEYBOARD = matchMedia('(hover: hover) and (pointer: fine)');
let waiting = null, onClose = null;
// registered at import time, before any game key listener: while waiting for a key nothing else sees it
addEventListener('keydown', (e) => {
  const ov = $('ctl-ov'); if (!ov || ov.classList.contains('hidden')) return;
  if (waiting) {
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code !== 'Escape') setBind(waiting.id, waiting.slot, e.code);
    waiting = null; render(); return;
  }
  if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeControls(); }
}, true);
function render() {
  const body = $('ctl-body'); if (!body) return;
  const touch = `<p class="ctl-touch"><b>◀ FIRE / FIRE ▶</b> broadsides · <b>◀ ▶</b> steer · <b>▲ ▼</b> sails · <b>⚓</b> anchor · drag the sea to look around · <b>🧰</b> shop · <b>🏴</b> Battle Royale menu · <b>II</b> pause</p>`;
  const pad = CONSOLE || padConnected() ? padHelpHtml() : '';
  if (!KEYBOARD.matches || CONSOLE) { body.innerHTML = (CONSOLE ? '' : touch) + pad; return; }
  let h = '<table class="ctl-table"><tbody>';
  for (const [id, label] of ACTIONS) {
    h += `<tr><td>${label}</td>` + [0, 1].map(i => { const w = waiting && waiting.id === id && waiting.slot === i;
      return `<td><button type="button" class="ctl-key${w ? ' wait' : ''}" data-id="${id}" data-slot="${i}">${w ? 'press a key…' : keyName(binds(id)[i])}</button></td>`; }).join('') + '</tr>';
  }
  h += '</tbody></table><p class="ctl-note muted">Click a key, then press the new one. A key already in use swaps over. Esc is reserved (pause / close). Drag the mouse to look around.</p><button id="ctl-reset" type="button" class="ghost">RESET TO DEFAULTS</button>';
  body.innerHTML = h + pad;
  body.querySelectorAll('.ctl-key').forEach(b => b.onclick = () => { waiting = { id: b.dataset.id, slot: +b.dataset.slot }; render(); });
  $('ctl-reset').onclick = () => { waiting = null; resetBinds(); render(); };
}
export function syncControlsText() { const pad = padActive() || CONSOLE; document.querySelectorAll('[data-ctl]').forEach(el => { el.textContent = pad ? padLine(el.dataset.ctl === 'short') : controlsLine(el.dataset.ctl === 'short'); }); } // [Emerly gamepad] pad buttons while a pad is in use (consoles: always)
onPadMode(() => syncControlsText());
export function openControls(close) { onClose = close || null; waiting = null; render(); $('ctl-ov').classList.remove('hidden'); $('ctl-close').focus(); }
export function closeControls() { waiting = null; $('ctl-ov').classList.add('hidden'); const f = onClose; onClose = null; f?.(); }
export function initControlsUi() {
  const ov = $('ctl-ov'); if (!ov) return;
  $('ctl-close').onclick = closeControls;
  ov.addEventListener('click', (e) => { if (e.target === ov) closeControls(); });
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) ov.addEventListener(ev, e => e.stopPropagation());
  onBindsChange(syncControlsText); syncControlsText();
}
