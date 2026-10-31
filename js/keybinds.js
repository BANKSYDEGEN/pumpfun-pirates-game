// [keybinds] desktop rebindable keys (localStorage 'pfp_keys_v1'). Two slots per action (main + alt). Esc is reserved (pause / close).
// Duplicates are swapped: binding a key another action uses gives that action your old key. Touch controls are unaffected.
export const ACTIONS = [
  ['left', 'Steer left', ['KeyA', 'ArrowLeft']], ['right', 'Steer right', ['KeyD', 'ArrowRight']],
  ['sailUp', 'Raise sails', ['KeyW', 'ArrowUp']], ['sailDown', 'Lower sails', ['KeyS', 'ArrowDown']],
  ['firePort', 'Fire port (left)', ['KeyQ', '']], ['fireStar', 'Fire starboard (right)', ['KeyE', '']],
  ['anchor', 'Anchor', ['Space', '']], ['camera', 'Reset camera', ['KeyC', '']], ['shop', 'Shop (Waves)', ['KeyU', 'KeyB']],
  ['menu', 'Battle Royale menu', ['Tab', '']], ['pause', 'Pause', ['KeyP', '']], ['sound', 'Sound on/off', ['KeyM', '']], ['full', 'Fullscreen', ['KeyF', '']],
];
const KEY = 'pfp_keys_v1', RESERVED = new Set(['Escape']);
const defaults = () => Object.fromEntries(ACTIONS.map(([id, , d]) => [id, [...d]]));
let map = defaults();
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) for (const id in map) if (Array.isArray(s[id])) map[id] = [0, 1].map(i => typeof s[id][i] === 'string' && !RESERVED.has(s[id][i]) ? s[id][i] : ''); } catch {}
const subs = new Set();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch {} subs.forEach(f => f()); };
export const onBindsChange = (f) => { subs.add(f); };
export const binds = (id) => map[id] || [];
export const isKey = (id, code) => !!code && (map[id] || []).includes(code);
export const held = (id, keys) => (map[id] || []).some(c => c && keys[c]);
export function setBind(id, slot, code) {
  if (!map[id] || RESERVED.has(code)) return false;
  const old = map[id][slot];
  for (const k in map) for (let i = 0; i < 2; i++) if (map[k][i] === code && !(k === id && i === slot)) map[k][i] = old || ''; // swap with the action that had it
  map[id][slot] = code; save(); return true;
}
export function resetBinds() { map = defaults(); save(); }
export function keyName(code) {
  if (!code) return '—';
  const n = { Space: 'SPACE', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Tab: 'TAB', Enter: 'ENTER', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', Backspace: 'BKSP', CapsLock: 'CAPS' }[code];
  return n || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM ').toUpperCase();
}
const both = (id) => binds(id).filter(Boolean).map(keyName).join('/');
// one-line summary used by the title, pause and in-game hint
export function controlsLine(short = false) {
  const steer = `${keyName(binds('left')[0])}/${keyName(binds('right')[0])}${binds('left')[1] && binds('right')[1] ? ` or ${keyName(binds('left')[1])}/${keyName(binds('right')[1])}` : ''}`;
  const sail = `${keyName(binds('sailUp')[0])}/${keyName(binds('sailDown')[0])}`, fire = `${both('firePort')}/${both('fireStar')}`;
  return short ? `${steer} steer · ${sail} sails · ${fire} broadsides · ${both('anchor')} anchor · drag to look`
    : `${steer} steer · ${sail} raise/lower sails · ${fire} fire port/starboard · ${both('anchor')} anchor · ${both('camera')} camera · ${both('sound')} sound · drag mouse to orbit`;
}
