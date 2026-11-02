// [keybinds] desktop rebindable keys (localStorage 'pfp_keys_v1'). Two slots per action (main + alt). Esc is reserved (pause / close).
// Duplicates are swapped: binding a key another action uses gives that action your old key. Touch controls are unaffected.
export const ACTIONS = [
  ['left', 'Steer left', ['KeyA', 'ArrowLeft']], ['right', 'Steer right', ['KeyD', 'ArrowRight']],
  ['sailUp', 'Raise sails', ['KeyW', 'ArrowUp']], ['sailDown', 'Lower sails', ['KeyS', 'ArrowDown']],
  ['firePort', 'Fire port (left)', ['KeyQ', 'Mouse4']], ['fireStar', 'Fire starboard (right)', ['KeyE', 'MouseR']],
  ['anchor', 'Anchor', ['Space', '']], ['camera', 'Reset camera', ['KeyC', '']], ['shop', 'Shop', ['KeyU', 'KeyB']],
  ['sprint', 'Sprint (on foot, hold)', ['ShiftLeft', 'ShiftRight']],
  ['menu', 'Battle Royale menu', ['Tab', '']], ['pause', 'Pause', ['KeyP', '']], ['sound', 'Sound on/off', ['KeyN', '']], ['full', 'Fullscreen', ['KeyF', '']],
  ['map', 'Island map (harbor)', ['KeyM', '']], ['jump', 'Jump (on foot)', ['Space', '']], // [v106] M = map (sound moved to N), Space = jump on foot
];
// [v106] actions that only ever fire in one mode can share a key with the other mode (Space: anchor at sea, jump on foot)
const CTX = { anchor: 'sea', jump: 'foot' };
const clash = (a, b) => !(CTX[a] && CTX[b] && CTX[a] !== CTX[b]);
const KEY = 'pfp_keys_v1', RESERVED = new Set(['Escape', 'MouseL']); // left click = camera drag / orbit
// [mouse binds] mouse buttons bind like keys: 'MouseM' (wheel click), 'MouseR' (right), 'Mouse4' (side / back), 'Mouse5' (side / forward)
export const MOUSE_CODES = ['MouseL', 'MouseM', 'MouseR', 'Mouse4', 'Mouse5'];
export const mouseCode = (button) => MOUSE_CODES[button] || '';
const defaults = () => Object.fromEntries(ACTIONS.map(([id, , d]) => [id, [...d]]));
let map = defaults();
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) {
  for (const id in map) if (Array.isArray(s[id])) map[id] = [0, 1].map(i => typeof s[id][i] === 'string' && !RESERVED.has(s[id][i]) ? s[id][i] : '');
  // saved binds stay; the new mouse defaults only fill an EMPTY slot, and only if no other action already uses that button
  const used = new Set(Object.values(map).flat());
  for (const [id, , d] of ACTIONS) d.forEach((c, i) => { if (c.startsWith('Mouse') && !map[id][i] && !used.has(c)) { map[id][i] = c; used.add(c); } });
  // [v106] saves from before the map key: sound on M moves to N (if N is free), and a new action's default never steals a key you use
  if (!Array.isArray(s.map) && Array.isArray(s.sound)) { const taken = Object.entries(map).some(([k, v]) => k !== 'sound' && k !== 'map' && v.includes('KeyN'));
    map.sound = map.sound.map(c => c === 'KeyM' ? (taken ? '' : 'KeyN') : c); }
  for (const [id] of ACTIONS) if (!Array.isArray(s[id])) map[id] = map[id].map(c => c && Object.entries(map).some(([k, v]) => k !== id && clash(k, id) && v.includes(c)) ? '' : c);
} } catch {}
const subs = new Set();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch {} subs.forEach(f => f()); };
export const onBindsChange = (f) => { subs.add(f); };
export const binds = (id) => map[id] || [];
export const isKey = (id, code) => !!code && (map[id] || []).includes(code);
export const held = (id, keys) => (map[id] || []).some(c => c && keys[c]);
export function setBind(id, slot, code) {
  if (!map[id] || RESERVED.has(code)) return false;
  const old = map[id][slot];
  for (const k in map) for (let i = 0; i < 2; i++) if (map[k][i] === code && !(k === id && i === slot) && clash(k, id)) map[k][i] = old || ''; // swap with the action that had it
  map[id][slot] = code; save(); return true;
}
export function resetBinds() { map = defaults(); save(); }
export function keyName(code) {
  if (!code) return '—';
  const n = { MouseL: 'MOUSE L', MouseM: 'MOUSE M', MouseR: 'MOUSE R', Mouse4: 'MOUSE 4', Mouse5: 'MOUSE 5', Space: 'SPACE', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Tab: 'TAB', Enter: 'ENTER', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', Backspace: 'BKSP', CapsLock: 'CAPS' }[code];
  return n || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM ').toUpperCase();
}
const both = (id) => binds(id).filter(Boolean).map(keyName).join('/');
// one-line summary used by the title, pause and in-game hint
export function controlsLine(short = false) {
  const steer = `${keyName(binds('left')[0])}/${keyName(binds('right')[0])}${binds('left')[1] && binds('right')[1] ? ` or ${keyName(binds('left')[1])}/${keyName(binds('right')[1])}` : ''}`;
  const sail = `${keyName(binds('sailUp')[0])}/${keyName(binds('sailDown')[0])}`, fire = `${both('firePort')}/${both('fireStar')}`;
  return short ? `${steer} steer · ${sail} sails · ${fire} broadsides · ${both('anchor')} anchor · drag to look · wheel zoom`
    : `${steer} steer · ${sail} raise/lower sails · ${fire} fire port/starboard · ${both('anchor')} anchor · ${both('camera')} camera · ${both('sound')} sound · ${both('map')} island map · ${both('jump')} jump (on foot) · hold ${both('sprint')} sprint (on foot) · drag mouse to orbit · wheel to zoom`;
}

// [mouse binds] mouse buttons (not left) act as keys: a synthetic keydown / keyup with code 'MouseR' etc., so every key handler
// (game, shop, Battle Royale menu, the rebind overlay) works unchanged. Only while playing / spectating or while rebinding.
// Right click: no context menu over the game. Side buttons: no browser back / forward while in game.
export function installMouseBinds({ inGame, canvas }) {
  const rebinding = () => { const ov = document.getElementById('ctl-ov'); return ov && !ov.classList.contains('hidden'); };
  const send = (type, e) => {
    const code = mouseCode(e.button); if (!code || code === 'MouseL') return;
    const reb = rebinding(); if (!reb && !inGame()) return;
    if (!reb && e.target !== canvas && e.target.closest?.('button, input, a, select, textarea, .overlay:not(.hidden), #shop, #pvp-menu, .faq')) return; // clicks on menus stay clicks
    if (e.button >= 3 || e.button === 1) e.preventDefault(); // no back / forward / autoscroll
    dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
  };
  // [v71] mouse back / forward (buttons 3 / 4) never navigate, on ANY screen (home, shop, settings, pop-ups, spectate)
  const side = (e) => { if (e.button === 3 || e.button === 4) { e.preventDefault(); return true; } return false; };
  addEventListener('mousedown', (e) => { side(e); send('keydown', e); }, true);
  addEventListener('mouseup', (e) => { side(e); send('keyup', e); }, true);
  addEventListener('auxclick', (e) => { if (!side(e) && e.button === 1 && inGame()) e.preventDefault(); }, true);
  addEventListener('contextmenu', (e) => { if (e.target === canvas || rebinding() || (inGame() && e.target.closest?.('#hud'))) e.preventDefault(); }, true);
  // fallback for browsers that ignore preventDefault on the side buttons: one same-URL history entry, re-pushed on back
  const trap = () => { try { history.pushState({ pfpTrap: 1 }, '', location.href); } catch {} };
  let armed = false; const arm = () => { if (armed) return; armed = true; trap(); }; // after the first interaction (browsers skip entries without one)
  addEventListener('pointerdown', arm, { capture: true, once: true }); addEventListener('keydown', arm, { capture: true, once: true });
  addEventListener('popstate', () => { if (armed) trap(); });
}
