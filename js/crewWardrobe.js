// DOM-only hull dressing. All assignments use the existing server-owned gear/save path.
import { CREW_SLOTS, CREW_BASE, CREW_DEFAULT } from './crewLoadout.js';

const SLOT_NAMES = { crewhat: 'Hat', crewoutfit: 'Top', crewpants: 'Pants', crewboots: 'Boots', crewcape: 'Cape', crewbeard: 'Beard', crewface: 'Face accessory', creweyes: 'Eyewear' };
export const DRESS_SLOTS = ['crewhat', 'crewoutfit', 'crewpants', 'crewboots', 'crewcape', 'crewbeard', 'crewface', 'creweyes'];
export function ownedCrewChoices(state, slot) {
  const ids = CREW_SLOTS[slot]; if (!ids) return [];
  const owned = new Set(state?.owned?.gear || []);
  // The first value is the server's free uniform / empty slot. No purchases, copies or inventory removals.
  return ids.filter((id, i) => i === 0 || state?.owner === true || owned.has(`${slot}:${id}`) || owned.has(`${CREW_BASE[slot]}:${id}`));
}
export function crewChoiceLabel(slot, id) {
  if (slot === 'crewhat' && id === CREW_DEFAULT.crewhat) return 'No hat'; // legacy save ID stays bandana
  if ((slot === 'crewoutfit' && id === CREW_DEFAULT.crewoutfit) || (slot === 'crewpants' && id === 'none')) return 'None · Underwear';
  if (id === 'none' || (slot === 'creweyes' && id === 'plain')) return 'None';
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
const CSS = `
#crew-room{position:fixed;inset:0;z-index:10030;display:flex;align-items:center;justify-content:center;padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));box-sizing:border-box;background:rgba(3,9,15,.88);color:#f7ead0;font:15px/1.45 system-ui,sans-serif;touch-action:manipulation}
#crew-room *{box-sizing:border-box}#crew-room .cr-card{width:min(100%,620px);max-height:calc(100dvh - 28px);display:flex;flex-direction:column;border:1px solid #b79451;border-radius:18px;background:linear-gradient(150deg,#1c2c37,#0b171e);box-shadow:0 20px 70px #0009;overflow:hidden}
#crew-room header{display:flex;align-items:center;gap:12px;padding:18px 18px 8px}#crew-room h2{margin:0;font:800 clamp(20px,5vw,28px)/1.1 system-ui;letter-spacing:.04em}#crew-room header small{display:block;color:#d9b96e;margin-top:4px}#crew-room button{min-height:44px;padding:10px 12px;border-radius:9px;border:1px solid #68757b;background:#172a36;color:#f8eed6;font:700 14px system-ui;cursor:pointer;white-space:normal;touch-action:manipulation}#crew-room button:hover,#crew-room button:focus-visible{outline:2px solid #f5cb79;outline-offset:2px}#crew-room button[aria-pressed=true],#crew-room [aria-selected=true]{background:#b6924e;color:#101d24;border-color:#efd08d}#crew-room button:disabled{opacity:.5;cursor:wait}#crew-room .cr-x{margin-left:auto;flex-shrink:0}#crew-room .cr-copy{margin:6px 18px 12px;color:#cfdae0;font-size:13px}#crew-room .cr-scroll{overflow-y:auto;overscroll-behavior:contain;padding:4px 18px 18px;min-height:100px}#crew-room .cr-slots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:18px}#crew-room h3{margin:8px 0 5px;font-size:17px}#crew-room .cr-owned{color:#b8c6ce;font-size:12px;margin:0 0 12px}#crew-room .cr-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#crew-room .cr-choices button{min-height:56px;text-align:left}#crew-room .cr-choices small{display:block;font-size:11px;opacity:.8;margin-top:3px}#crew-room footer{padding:12px 18px 16px;border-top:1px solid #43505a}#crew-room [role=status]{font-size:13px;min-height:36px;margin-bottom:8px;color:#f5d38c}#crew-room .cr-done{width:100%;background:#ddb65d;color:#111e24;font-size:16px}#crew-room .cr-retry{margin-bottom:10px;width:100%}
@media(max-width:390px){#crew-room header{padding:14px 12px 8px}#crew-room .cr-scroll,#crew-room footer{padding-left:12px;padding-right:12px}#crew-room .cr-slots{gap:5px}#crew-room .cr-slots button{font-size:12px;padding:8px 4px}#crew-room .cr-copy{margin-left:12px;margin-right:12px}}
@media(prefers-reduced-motion:no-preference){#crew-room .cr-card{animation:cr-arrive .16s ease-out}@keyframes cr-arrive{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}}
`;
export function openCrewWardrobe({ provider, member = 0 } = {}) {
  document.getElementById('crew-room')?.querySelector('[data-close]')?.click();
  if (!document.getElementById('crew-room-style')) { const css = document.createElement('style'); css.id = 'crew-room-style'; css.textContent = CSS; document.head.append(css); }
  const before = document.activeElement, root = document.createElement('div');
  root.id = 'crew-room'; root.className = 'on'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'cr-title');
  root.innerHTML = `<section class="cr-card"><header><div><h2 id="cr-title">CREW ROOM</h2><small></small></div><button class="cr-x" data-close aria-label="Close crew room">✕</button></header><p class="cr-copy">Dress your whole crew in clothing you own. This is a shared crew uniform, on deck and ashore too. Your own outfit stays unchanged and items are never consumed.</p><div class="cr-scroll"><div class="cr-slots" role="tablist" aria-label="Clothing slot"></div><h3></h3><p class="cr-owned"></p><div class="cr-choices" role="group" aria-label="Owned clothing"></div></div><footer><div role="status" aria-live="polite">Loading owned clothes…</div><button class="cr-retry" hidden>RETRY CONNECTION</button><button class="cr-done primary" data-close>DONE</button></footer></section>`;
  root.querySelector('header small').textContent = `CREWMATE ${Math.max(1, (member | 0) + 1)} · FREE COSMETIC ASSIGNMENT`;
  const $ = q => root.querySelector(q), status = $('[role=status]'), choices = $('.cr-choices');
  let state = null, slot = DRESS_SLOTS[0], busy = false, closed = false;
  function close() { if (closed) return; closed = true; root.remove(); window.removeEventListener('keydown', key, true); try { before?.focus?.({ preventScroll: true }); } catch {} }
  function key(e) {
    if (closed) return;
    if (e.code === 'Escape') { close(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.code === 'Tab') {
      const buttons = [...root.querySelectorAll('button:not([disabled]):not([hidden])')];
      const at = buttons.indexOf(document.activeElement), next = buttons[(at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length];
      next?.focus(); e.preventDefault();
    }
    // Do not let E, movement or fire keys reach the hull while dressing. Buttons retain native Enter/Space.
    e.stopImmediatePropagation();
  }
  function button(label, cb) { const b = document.createElement('button'); b.textContent = label; b.onclick = cb; return b; }
  function render() {
    if (closed) return;
    const tabs = $('.cr-slots'); tabs.replaceChildren();
    for (const s of DRESS_SLOTS) { const b = button(SLOT_NAMES[s], () => { if (!busy) { slot = s; render(); $('.cr-slots [aria-selected=true]')?.focus(); } }); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(slot === s)); b.disabled = busy; tabs.append(b); }
    $('h3').textContent = SLOT_NAMES[slot];
    const ids = state ? ownedCrewChoices(state, slot) : [], current = state?.equipped?.gear?.[slot] || CREW_DEFAULT[slot];
    $('.cr-owned').textContent = 'Owned items only · free uniform / empty slot always available';
    choices.replaceChildren();
    for (const id of ids) {
      const b = button(crewChoiceLabel(slot, id), () => equip(slot, id)); b.setAttribute('aria-pressed', String(current === id)); b.disabled = busy;
      const detail = document.createElement('small'); detail.textContent = current === id ? '✓ EQUIPPED ON CREW' : 'EQUIP · NO COST'; b.append(detail); choices.append(b);
    }
  }
  async function load() {
    if (busy || closed) return; busy = true; $('.cr-retry').hidden = true;
    status.textContent = 'Checking your owned clothes…'; render();
    try {
      if (!provider?.load || !provider?.equip) throw Error('Sign in to dress your saved crew.');
      const next = await provider.load(); if (closed) return;
      if (next?.source !== 'live') throw Error('Connect to your saved pirate to dress the crew.');
      state = next; status.textContent = 'Choose a slot, then a piece of your clothing.';
    } catch (e) { status.textContent = e?.message || 'Could not load your owned clothes. Try again.'; $('.cr-retry').hidden = false; }
    finally { busy = false; render(); }
  }
  async function equip(s, id) {
    if (busy || closed || !ownedCrewChoices(state, s).includes(id)) return;
    busy = true; status.textContent = 'Dressing the crew…'; render();
    try {
      const fresh = await provider.load();
      if (closed) return;
      if (fresh?.source !== 'live' || !ownedCrewChoices(fresh, s).includes(id)) throw Error('That item is no longer available in your wardrobe.');
      state = await provider.equip('gear', `${s}:${id}`);
      if (!closed) status.textContent = 'Crew uniform updated · your clothing stays in your inventory.';
    } catch (e) { if (!closed) status.textContent = e?.message || 'Could not dress the crew. Try again.'; }
    finally { busy = false; render(); if (!closed) choices.querySelector('[aria-pressed=true]')?.focus(); }
  }
  root.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  $('.cr-retry').onclick = load;
  root.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === root) close(); });
  window.addEventListener('keydown', key, true); document.body.append(root); $('.cr-x').focus(); load();
  return { close, get isOpen() { return !closed; } };
}
