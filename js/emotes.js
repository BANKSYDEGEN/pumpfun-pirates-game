// [v96] PUMPFUN PIRATES quick-chat wheel: 8 preset pirate callouts (ids only, never free text). Picking one shows a speech
// bubble over your ship for ~3 s and plays a pirate voice line (js/audio.js sfx.emote: real recorded takes for Arr! / Attack! / Yo ho ho!, synth for the rest).
// Battle Royale arena: js/pvp.js broadcasts { i, e } over the existing Supabase realtime room (rate-limited both ends).
// Waves + the harbor: local only. Cosmetic: no gameplay, stats or gold effect.
import * as THREE from 'three';
import { sfx } from './audio.js';
import { isKey } from './keybinds.js';

export const EMOTES = [
  { t: 'Arr!', i: '🏴‍☠️' }, { t: 'Follow me!', i: '🧭' }, { t: 'Boss incoming!', i: '💀' }, { t: 'Need help!', i: '🆘' },
  { t: 'Attack!', i: '⚔️' }, { t: 'Retreat!', i: '🏳️' }, { t: 'GG', i: '🤝' }, { t: 'Yo ho ho!', i: '🍻' },
];
export const EMOTE_GAP = 2000; // ms between your own callouts (1 per 2 s)
export const validEmote = (e) => Number.isInteger(e) && e >= 0 && e < EMOTES.length;

const $ = (id) => document.getElementById(id);
const bubbles = new Map(); // ship -> { el, until }
const _v = new THREE.Vector3();
let K = null, last = -1e9, open = false;

export function showEmote(ship, e, { vol = 1, pitch = 1, own = false } = {}) {
  if (!ship || !validEmote(e)) return false;
  let b = bubbles.get(ship);
  if (!b) { const el = document.createElement('div'); el.className = 'emote-bubble'; $('emote-bubbles')?.appendChild(el); b = { el }; bubbles.set(ship, b); }
  b.el.textContent = `${EMOTES[e].i} ${EMOTES[e].t}`; b.until = performance.now() + 3000;
  b.el.classList.remove('pop'); void b.el.offsetWidth; b.el.classList.add('pop');
  if (vol > 0.03) sfx.emote?.(e, vol, pitch, own); // [v101] own = your crew joins in (real recorded voices)
  return true;
}
// your own pick: rate limit, bubble over your ship, voice, then K.send (pvp broadcast when in a room)
export function sendEmote(e) {
  if (!K || !validEmote(e)) return false;
  const pl = K.getPlayer(), now = performance.now();
  if (!K.canEmote() || !pl?.alive) return false;
  if (now - last < EMOTE_GAP) { flashWait(); return false; }
  last = now; showEmote(pl, e, { own: true }); K.send?.(e); setWheel(false); return true;
}
function flashWait() { const b = $('btn-emote'); if (!b) return; b.classList.remove('wait'); void b.offsetWidth; b.classList.add('wait'); }

function setWheel(on) {
  open = !!on && !!K?.canEmote(); const w = $('emote-wheel'); if (!w) return;
  w.classList.toggle('hidden', !open); $('btn-emote')?.setAttribute('aria-expanded', open ? 'true' : 'false');
}
export const wheelOpen = () => open;

export function emoteTick() { // bubbles follow their ships (screen-space, above the mast tops)
  if (!bubbles.size || !K) return;
  const now = performance.now(), cam = K.camera;
  for (const [ship, b] of bubbles) {
    if (now > b.until || !ship.mesh?.parent || ship.alive === false) { b.el.remove(); bubbles.delete(ship); continue; }
    _v.set(ship.x ?? ship.mesh.position.x, (ship.mesh.position.y || 0) + 15 * (ship.mesh.scale?.y || 1), ship.z ?? ship.mesh.position.z).project(cam);
    const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
    b.el.style.display = vis ? 'block' : 'none'; if (!vis) continue;
    b.el.style.left = `${(_v.x * 0.5 + 0.5) * innerWidth}px`; b.el.style.top = `${(-_v.y * 0.5 + 0.5) * innerHeight}px`;
  }
}
export function clearEmotes() { for (const [, b] of bubbles) b.el.remove(); bubbles.clear(); setWheel(false); }

// K = { camera, getPlayer, canEmote: () => bool (playing, not spectating), send: (e) => void }
export function initEmotes(k) {
  K = k;
  const hud = $('hud') || document.body;
  if (!$('emote-bubbles')) { const d = document.createElement('div'); d.id = 'emote-bubbles'; document.body.appendChild(d); }
  const btn = document.createElement('button'); btn.id = 'btn-emote'; btn.type = 'button'; btn.title = 'Quick chat (T)'; btn.setAttribute('aria-label', 'Quick chat');
  btn.setAttribute('aria-expanded', 'false'); btn.innerHTML = '<span>💬</span>'; hud.appendChild(btn);
  const w = document.createElement('div'); w.id = 'emote-wheel'; w.className = 'hidden'; w.setAttribute('role', 'menu');
  w.innerHTML = `<div class="ew-back"></div><div class="ew-ring">${EMOTES.map((m, i) => { const a = i / EMOTES.length * Math.PI * 2 - Math.PI / 2;
    return `<button type="button" role="menuitem" class="ew-opt" data-e="${i}" style="--x:${Math.cos(a).toFixed(3)};--y:${Math.sin(a).toFixed(3)}"><b>${m.i}</b><span>${m.t}</span><i>${i + 1}</i></button>`; }).join('')}
    <div class="ew-hub">QUICK<br>CHAT</div></div>`;
  hud.appendChild(w);
  // the wheel eats its own pointer events so the phone camera spin / drag never sees them
  const stop = (ev) => { ev.stopPropagation(); };
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'wheel', 'contextmenu']) { w.addEventListener(t, stop); btn.addEventListener(t, stop); }
  btn.addEventListener('click', (ev) => { ev.preventDefault(); setWheel(!open); });
  w.addEventListener('click', (ev) => { const o = ev.target.closest('.ew-opt'); if (o) sendEmote(+o.dataset.e); else if (ev.target.classList.contains('ew-back')) setWheel(false); });
  addEventListener('keydown', (e) => {
    const tag = e.target?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable || e.repeat) return;
    if (e.code === 'KeyT' && !isBound('KeyT')) { if (K.canEmote()) { e.preventDefault(); setWheel(!open); } return; }
    if (!open) return;
    const d = /^(Digit|Numpad)([1-8])$/.exec(e.code); if (d) { e.preventDefault(); e.stopImmediatePropagation(); sendEmote(+d[2] - 1); return; }
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); setWheel(false); }
  }, true);
}
const isBound = (code) => { try { return ['left', 'right', 'sailUp', 'sailDown', 'firePort', 'fireStar', 'anchor', 'camera', 'shop', 'menu', 'pause', 'sound', 'full', 'map', 'jump'].some(a => isKey(a, code)); } catch { return false; } };

window.PFP_EMOTE = { EMOTES, sendEmote, showEmote, setWheel, wheelOpen, get last() { return last; }, set last(v) { last = v; } }; // test hook
