// [Emerly gamepad] PUMPFUN PIRATES · CONTROLLERS (BANKSY 2:31 PM Nov 4: "work on control if they plug one in or try to play from
// PlayStation / Xbox web browser"). The standard Gamepad API (navigator.getGamepads, polled once per frame from main.js frame()).
// A pad drives the SAME input paths the keyboard / mouse / touch use: buttons send the bound key (js/keybinds.js binds, as a synthetic
// keydown / keyup, exactly like the mouse binds), so every gate (moored = no helm, on foot = no broadsides, the musket swallowing MouseR,
// Esc closing the top menu first) works unchanged. The sticks feed the walker joystick / camera + the ship camera directly.
// Menus: D-pad / left stick move a focus ring over the buttons of the top-most open menu, A clicks, B = Esc (back / close).
// Prompts say the pad button while a pad is in use ('A · TOSS A COIN'); a key press, a click or a touch switches them back.
// Consoles (Xbox Edge, PlayStation): never treated as phones (no touch sticks), TV-size UI, Xbox mouse-mode cursor asked off.
// &pad=0 (or ?pad=0) = off (no polling, no console tweaks: exactly as before).

export const PAD = {
  dead: 0.2,          // stick dead zone (radial, rescaled so just past it = 0)
  trig: 0.35,         // trigger press threshold (0-1)
  dig: 0.5,           // a stick counts as a D-pad press past this (menus, sails, steering)
  repeat: [380, 120], // menu / sail auto-repeat: first delay, then every (ms)
  look: [2.8, 1.7],   // on-foot camera turn (rad/s at full right stick): yaw, pitch
  orbit: [2.2, 1.2],  // ship camera orbit (rad/s): azimuth, polar
  aim: 420,           // musket look: virtual px/s at full stick (fed through tps.js look(), so AIM SENS + aim assist apply)
  rumble: true,
};
export const padOn = (search = '') => !/[?&]pad=0(&|$)/.test(String(search));
// standard mapping (https://w3c.github.io/gamepad/#remapping)
export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, HOME: 16 };

// ---------- consoles ----------
// Xbox Edge: '... (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) ... Edg/...'. PS5: 'Mozilla/5.0 (PlayStation; PlayStation 5/10.20) AppleWebKit/...'
export function consoleKind(ua = '') { ua = String(ua); return /\bXbox\b/i.test(ua) ? 'xbox' : /PlayStation|PLAYSTATION/.test(ua) ? 'ps' : /Nintendo (Switch|WiiU)/i.test(ua) ? 'switch' : ''; }
const NAV = typeof navigator !== 'undefined' ? navigator : null;
const LOC = (() => { try { return typeof location !== 'undefined' ? location.search : ''; } catch { return ''; } })(); // (deno: no location)
import { toggleHudHidden } from './hudHide.js'; // [gold-hud]
export const PAD_ENABLED = padOn(LOC);
export const CONSOLE = PAD_ENABLED ? consoleKind(NAV?.userAgent || '') : '';

// ---------- pure helpers (node-tested: tests/gamepad.test.mjs) ----------
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function deadzone(x, y, d = PAD.dead) { const m = Math.hypot(x, y); if (m <= d || !Number.isFinite(m)) return [0, 0]; const k = Math.min(1, (m - d) / (1 - d)) / m; return [x * k, y * k]; }
export function padBrand(id = '') { id = String(id); return /xbox|045e|xinput/i.test(id) ? 'xbox' : /054c|DualSense|DualShock|PlayStation|PS[345]\b/i.test(id) ? 'ps' : /057e|Nintendo|Pro Controller|Joy-Con/i.test(id) ? 'nintendo' : 'xbox'; }
const GLY = {
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', VIEW: 'VIEW', START: 'MENU', L3: 'L3', R3: 'R3', UP: '▲', DOWN: '▼', LEFT: '◀', RIGHT: '▶' },
  ps: { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', VIEW: 'CREATE', START: 'OPTIONS', L3: 'L3', R3: 'R3', UP: '▲', DOWN: '▼', LEFT: '◀', RIGHT: '▶' },
  nintendo: { A: 'B', B: 'A', X: 'Y', Y: 'X', LB: 'L', RB: 'R', LT: 'ZL', RT: 'ZR', VIEW: '−', START: '+', L3: 'L3', R3: 'R3', UP: '▲', DOWN: '▼', LEFT: '◀', RIGHT: '▶' }, // standard mapping is positional: the south button is Nintendo's B
};
export const glyphFor = (brand, b) => (GLY[brand] || GLY.xbox)[b] || b;
// one snapshot of a Gamepad (standard mapping; others best effort with the same indices)
export function readPad(gp) {
  const B = gp?.buttons || [], A = gp?.axes || [], val = (i) => { const b = B[i]; return b == null ? 0 : typeof b === 'object' ? (+b.value || (b.pressed ? 1 : 0)) : +b || 0; };
  const b = []; for (let i = 0; i < 17; i++) b[i] = i === 6 || i === 7 ? val(i) > PAD.trig : (typeof B[i] === 'object' ? !!B[i]?.pressed || val(i) > 0.5 : val(i) > 0.5);
  const [lx, ly] = deadzone(+A[0] || 0, +A[1] || 0), [rx, ry] = deadzone(+A[2] || 0, +A[3] || 0);
  return { b, lt: val(6), rt: val(7), lx, ly, rx, ry, id: gp?.id || '', brand: padBrand(gp?.id), index: gp?.index ?? -1 };
}
// the pad that counts: the last one that pressed something (several pads = whoever touched one last)
export function pickPad(list, lastIndex = -1) { const pads = [...(list || [])].filter(p => p && p.connected !== false); if (!pads.length) return null; return pads.find(p => p.index === lastIndex) || pads[0]; }
export const anyInput = (s) => !!s && (s.b.some(Boolean) || Math.hypot(s.lx, s.ly) > 0 || Math.hypot(s.rx, s.ry) > 0);

// The button map, per mode. Each entry: an action name (see ACT below). '+' prefix = held (keydown on press, keyup on release).
// sea = sailing your ship (Waves, Battle Royale SOLO / SQUADS, the harbor); foot = walking the island (+ the sword pit / musket range);
// spec = spectating a battle; ui = any menu / shop / inventory / pop-up on top (focus navigation).
export const MAP = {
  sea: { [BTN.A]: 'promptA', [BTN.X]: 'promptB|anchor', [BTN.Y]: 'map', [BTN.LT]: 'firePort', [BTN.RT]: 'fireStar', [BTN.LB]: 'firePort', [BTN.RB]: 'fireStar',
    [BTN.VIEW]: 'invite|menu', [BTN.START]: 'pause', [BTN.L3]: 'emote', [BTN.R3]: 'camera', [BTN.UP]: 'sailUp', [BTN.DOWN]: 'sailDown', [BTN.LEFT]: '+left', [BTN.RIGHT]: '+right', [BTN.B]: 'inventory', [BTN.HOME]: 'hideHud' }, // [gold-hud] GUIDE/PS button toggles Hide HUD · [invite-discreet] VIEW opens invite pill when one is pending (else BR menu)
  foot: { [BTN.A]: 'promptA|jump', [BTN.X]: 'promptB|weapon', [BTN.Y]: 'map', [BTN.RT]: 'attack', [BTN.LT]: '+ads', [BTN.RB]: 'swap', [BTN.LB]: 'team',
    [BTN.VIEW]: 'invite|menu', [BTN.START]: 'pause', [BTN.L3]: '+sprint', [BTN.R3]: 'swap|camBehind', [BTN.UP]: 'emote', [BTN.DOWN]: 'inventory', [BTN.B]: 'inventory', [BTN.HOME]: 'hideHud' }, // [gold-hud]
  spec: { [BTN.A]: 'specFollow', [BTN.X]: 'specLeader', [BTN.Y]: 'specOverview', [BTN.B]: 'specHud', [BTN.LB]: 'specPrev', [BTN.RB]: 'specNext', [BTN.VIEW]: 'specBoard', [BTN.START]: 'pause' },
  ui: { [BTN.A]: 'click', [BTN.B]: 'back', [BTN.START]: 'back', [BTN.LB]: 'tabPrev', [BTN.RB]: 'tabNext', [BTN.Y]: 'click2', [BTN.X]: 'click3' },
  // [map-zoom] BANKSY 2:44 PM: while the ISLAND MAP is open — sticks pan/zoom, Y recentre, B close (no sea fire / no menu focus fight)
  map: { [BTN.B]: 'mapClose', [BTN.START]: 'mapClose', [BTN.Y]: 'mapRecentre', [BTN.A]: 'mapRecentre', [BTN.LB]: 'mapZoomOut', [BTN.RB]: 'mapZoomIn' },
};
// readable map for the CONTROLS overlay + the report (glyphs follow the pad brand)
export const MAP_HELP = {
  sea: [['LEFT STICK', 'steer · push up / down = more / less sail'], ['RIGHT STICK', 'look around (R3 = reset camera)'], ['RT / RB', 'fire starboard (right)'], ['LT / LB', 'fire port (left)'],
    ['A', 'dock / go ashore (the prompt)'], ['X', 'anchor · SET SAIL when moored'], ['Y', 'island map (harbor)'], ['B', 'inventory (harbor)'], ['D-PAD', '▲▼ sails · ◀▶ steer'], ['L3', 'quick chat'], ['VIEW', 'squad invite (when pending) · else Battle Royale menu'], ['MENU', 'settings / pause'], ['GUIDE', 'hide / show HUD']],
  foot: [['LEFT STICK', 'walk (push all the way = sprint, or hold L3)'], ['RIGHT STICK', 'look / aim'], ['A', 'the prompt (shop, door, fountain, dig, fish…) · else jump'], ['X', 'change weapon (Unarmed → Musket → Sword)'], ['Y', 'island map'],
    ['RT', 'swing sword / fire musket'], ['LT', 'aim down the sights (musket range)'], ['RB / R3', 'swap shoulder (musket)'], ['LB', 'team FFA / RED / BLUE (in an area)'], ['B / D-PAD ▼', 'inventory'], ['D-PAD ▲', 'quick chat'], ['VIEW', 'squad invite (when pending) · else Battle Royale menu'], ['MENU', 'settings / pause'], ['GUIDE', 'hide / show HUD']],
  ui: [['D-PAD / LEFT STICK', 'move'], ['A', 'select'], ['B', 'back / close'], ['LB / RB', 'switch tabs'], ['RIGHT STICK', 'scroll'], ['◀ ▶ on a slider', 'change it']],
  map: [['LEFT STICK', 'pan the island map'], ['RIGHT STICK / LT·RT', 'zoom out / in'], ['LB / RB', 'zoom out / in (tap)'], ['Y / A', 'recentre (fit whole island)'], ['B', 'close map']],
};
// the one-line hint (title, pause, the HUD) while a pad is in use
export function padLine(short = false, b = brand) { const g = (k) => glyphFor(b, k);
  return short ? `left stick steer · ▲▼ sails · ${g('LT')}/${g('RT')} broadsides · ${g('X')} anchor · right stick look`
    : `left stick steer / walk · ▲▼ sails · ${g('LT')}/${g('RT')} broadsides (on foot ${g('RT')} swing / fire) · ${g('A')} dock / interact · ${g('X')} anchor / change weapon · ${g('Y')} island map · ${g('B')} inventory / back · right stick look · ${g('START')} settings`; }
// the CONTROLS overlay's controller section (button names follow the pad in use: Xbox A/B/X/Y, PlayStation ✕/○/□/△)
export function padHelpHtml(b = brand) {
  const g = (t) => t.replace(/\b(LT|RT|LB|RB|VIEW|MENU|A|B|X|Y)\b/g, (m) => glyphFor(b, m === 'MENU' ? 'START' : m));
  const sec = (h, rows) => `<h4>${h}</h4><table><tbody>${rows.map(([k, v]) => `<tr><td>${g(k)}</td><td>${v}</td></tr>`).join('')}</tbody></table>`;
  return `<div id="pad-help"><p class="muted">🎮 CONTROLLER${connected ? '' : ' (plug one in or press a button)'}</p>${sec('SAILING', MAP_HELP.sea)}${sec('ON FOOT', MAP_HELP.foot)}${sec('ISLAND MAP', MAP_HELP.map)}${sec('MENUS', MAP_HELP.ui)}</div>`;
}
// "a|b": a when it applies, else b. Returns the resolved action (pure; ctx = { prompt: [bool, bool], area, tps, docked, harbor })
export function resolve(action, ctx = {}) {
  if (!action) return null;
  for (const a of action.split('|')) {
    const n = a.replace(/^\+/, '');
    if (n === 'promptA' && !ctx.prompt?.[0]) continue;
    if (n === 'promptB' && !ctx.prompt?.[1]) continue;
    if (n === 'attack' && !(ctx.area || ctx.armed)) continue; // [t1734u] RT swings/fires with a drawn weapon in open-world PvP too
    if (n === 'team' && !ctx.area) continue;
    if ((n === 'ads' || n === 'swap') && !ctx.tps) continue;
    if ((n === 'map' || n === 'inventory') && !ctx.harbor) continue;
    if (n === 'invite' && !ctx.invites) continue; // [invite-discreet] VIEW only steals the invite when a pill is up
    return a;
  }
  return null;
}
// the key each action sends (codes from the live binds; avoid E for broadsides so the dock's E prompt never eats a shot)
export function keyFor(n, binds = () => []) {
  const pick = (id, avoid = []) => { const b = binds(id).filter(Boolean); return b.find(c => !avoid.includes(c)) || b[0] || ''; };
  switch (n) {
    case 'firePort': return pick('firePort', ['KeyE']); case 'fireStar': return pick('fireStar', ['KeyE']);
    case 'sailUp': return pick('sailUp', ['MouseR', 'MouseM', 'Mouse4', 'Mouse5']); case 'sailDown': return pick('sailDown', ['MouseR', 'MouseM', 'Mouse4', 'Mouse5']);
    case 'left': case 'right': case 'anchor': case 'camera': case 'map': case 'jump': case 'sprint': return pick(n, ['MouseR', 'MouseM', 'Mouse4', 'Mouse5']);
    case 'menu': return pick('menu') || 'Tab'; case 'shop': return pick('shop');
    case 'pause': case 'back': return 'Escape';
    case 'promptA': return 'KeyE'; case 'attack': return 'KeyR'; case 'team': return 'KeyG'; case 'emote': return 'KeyT'; case 'weapon': return 'Tab';
    case 'specFollow': return 'KeyF'; case 'specLeader': return 'KeyL'; case 'specOverview': return 'KeyO'; case 'specHud': return 'KeyH'; case 'specPrev': return 'KeyQ'; case 'specNext': return 'Period'; case 'specBoard': return 'Tab';
    default: return '';
  }
}
// spatial focus move: from rect `from`, the best of `rects` in direction dir ('up' | 'down' | 'left' | 'right'); returns its index or -1
export function spatialPick(from, rects, dir) {
  const cx = (r) => r.left + r.width / 2, cy = (r) => r.top + r.height / 2, fx = cx(from), fy = cy(from);
  let best = -1, bs = Infinity;
  rects.forEach((r, i) => {
    const dx = cx(r) - fx, dy = cy(r) - fy;
    const main = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy, side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    // overlap on the cross axis counts as "in line" (a row of buttons / a grid column)
    const overlap = dir === 'left' || dir === 'right' ? Math.min(r.bottom, from.bottom) - Math.max(r.top, from.top) : Math.min(r.right, from.right) - Math.max(r.left, from.left);
    if (main <= 1) return; const s = main + side * (overlap > 0 ? 0.3 : 2.2); if (s < bs) { bs = s; best = i; }
  });
  return best;
}
// auto-repeat for held directions (menus / sails): true on press, then after repeat[0] ms, then every repeat[1] ms
export function repeater() { const t = {}; return (key, down, now) => { if (!down) { delete t[key]; return false; } if (!(key in t)) { t[key] = now + PAD.repeat[0]; return true; } if (now >= t[key]) { t[key] = now + PAD.repeat[1]; return true; } return false; }; }

// ---------- live state (browser) ----------
const subs = new Set();
let active = false, brand = 'xbox', connected = 0;
export const padActive = () => active;
export const padConnected = () => connected > 0;
export const padGlyph = (b) => glyphFor(brand, b);
export const onPadMode = (f) => { subs.add(f); return () => subs.delete(f); };
// prompt key label: the pad button while a pad is in use, else the keyboard key (slot 0 = the main prompt (A), 1 = the second one (X))
export const promptKey = (key, slot = 0) => active ? padGlyph(slot ? 'X' : 'A') : key;
function setActive(v, b = brand) {
  v = !!v; if (v === active && b === brand) return; active = v; brand = b;
  const d = typeof document !== 'undefined' ? document.documentElement : null;
  if (d) { d.classList.toggle('pfp-pad', v); d.classList.toggle('pfp-pad-ps', v && b === 'ps'); }
  if (!v) clearFocusRing();
  subs.forEach(f => { try { f(v); } catch (e) { console.warn('[pad]', e); } });
}
// dock/index.js registers what only it knows (on foot, the walker, the prompt buttons, the battle areas)
export const padHooks = { dock: null };
export const registerPadDock = (h) => { padHooks.dock = h; };
let _rumble = null; export const padRumble = (w, s, ms) => { if (active) _rumble?.(w, s, ms); }; // [fish2] the fishing dock: a bite / a pull / a snap (only while the pad is the input)

// ---------- menus: what is open on top ----------
// top-most first; the first one that is really on screen is the layer the focus ring walks
const LAYERS = ['#ctl-ov', '.pfp-hatcolor', '#prest-confirm', '.ishop-confirm', '#pfp-share', '#acct-login', '#ch-reveal', '#tm-reveal', '#tm-map', '#isle-map', '#emote-wheel',
  '#iv-pick-ok', '#iv-pick', '#inv-panel', '#island-shop', '#shop', '#plaza-panel', '#sq-hall', '#sq-note.open', '#profile', '#pvp-menu', '#pvp-entry', '#waves-skins', '.faq', '#pause', '#pvp-dead', '#gameover', '#title']; // [invite-discreet] #sq-note.open = expanded invite panel (pill alone stays non-blocking)
const FOCUSABLE = 'button, a[href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"]), [role=button], [role=menuitem], [role=tab], [role=radio], .ew-opt, .iv-slot, [data-id], [data-skin], tr[data-id]'; // + the inventory / shop card grids (divs with a click handler)
function shown(el) {
  if (!el || el.hidden || !el.isConnected) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05) return false;
  return r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
}
export function topLayer() {
  if (typeof document === 'undefined') return null;
  for (const s of LAYERS) for (const el of document.querySelectorAll(s)) if (!el.classList.contains('hidden') && shown(el)) return el;
  if (document.documentElement.classList.contains('dk-board')) { const b = document.getElementById('pvp-board') || document.querySelector('.harbor-card, #harbor-card'); if (b && shown(b)) return b; }
  return null;
}
function focusables(root) {
  const out = []; for (const el of root.querySelectorAll(FOCUSABLE)) { if (el.disabled || el.closest('[hidden], .hidden') || !shown(el)) continue;
    const r = el.getBoundingClientRect(), x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)), hit = document.elementFromPoint(x, y);
    if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) continue; // covered by something on top
    out.push(el); }
  return out;
}
let ring = null;
function clearFocusRing() { ring?.classList.remove('pad-focus'); ring = null; }
function setRing(el) { if (ring === el) return; clearFocusRing(); if (!el) return; ring = el; el.classList.add('pad-focus'); try { el.focus({ preventScroll: true }); } catch {} try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch {} }
const FIRST = ['#btn-pvp', '#pvp-entry-go', '#btn-resume', '#we-go', '#ws-done', '#al-go', '#pvp-dead-menu', '[autofocus]', '.primary', 'button.big', '.ew-opt'];
function startFocus(list) { for (const q of FIRST) { const e = list.find(x => x.matches(q)); if (e) return e; } return list.find(e => e.tagName === 'BUTTON') || list[0] || null; } // the main button of each screen first
function activate(el) {
  if (!el) return;
  if (el.tagName === 'INPUT' && /^(text|search|email|password|number|tel|url)$/i.test(el.type || 'text')) { el.focus(); return; } // opens the console / OS keyboard
  if (el.tagName === 'SELECT') { el.focus(); try { el.showPicker?.(); } catch {} return; }
  const r = el.getBoundingClientRect(), o = { bubbles: true, cancelable: true, composed: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, buttons: 1, pointerId: 31, pointerType: 'mouse', isPrimary: true, view: window };
  // a real click's sequence: some controls listen to pointerdown (hold buttons, the prompt buttons), most to click
  const P = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
  el.dispatchEvent(new P('pointerdown', o)); el.dispatchEvent(new MouseEvent('mousedown', o));
  el.dispatchEvent(new P('pointerup', { ...o, buttons: 0 })); el.dispatchEvent(new MouseEvent('mouseup', { ...o, buttons: 0 }));
  if (el.isConnected) el.click();
}
function nudgeRange(el, d) { const st = +el.step || 1, v = clamp(+el.value + d * st * Math.max(1, Math.round(((+el.max || 100) - (+el.min || 0)) / 20 / st)), +el.min || 0, +el.max || 100); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
function tabStep(root, d) {
  let tabs = [...root.querySelectorAll('[role=tab], [id^="tab-"], [class*="tabs"] > button, button[class*="tab"]')].filter(shown); if (tabs.length < 2) return false;
  const row = tabs[0].parentElement; if (tabs.filter(t => t.parentElement === row).length > 1) tabs = tabs.filter(t => t.parentElement === row); // the top tab row only (the island shop has a 2nd row of slots)
  const cur = tabs.findIndex(t => t.matches('.on, .active, .sel, .selected, [aria-selected="true"]')); const n = tabs[(Math.max(0, cur) + d + tabs.length) % tabs.length]; activate(n); setRing(n); return true;
}
function scrollLayer(root, dy) { let el = ring || root; while (el && el !== document.body) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) { el.scrollTop += dy; return; } el = el.parentElement; } root.scrollTop += dy; }

// ---------- the driver ----------
// opts: { game() -> { state, mode }, controls (OrbitControls), camera, binds(id) -> codes, spectating() -> bool }
export function initGamepad(opts = {}) {
  if (!PAD_ENABLED || typeof window === 'undefined') return { tick() {}, on: false };
  const doc = document.documentElement;
  if (CONSOLE) { doc.classList.add('pfp-console', 'pfp-' + CONSOLE); try { if ('gamepadInputEmulation' in NAV || CONSOLE === 'xbox') NAV.gamepadInputEmulation = 'gamepad'; } catch {} } // legacy Xbox: ask for raw pad input, no mouse cursor
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const hasApi = typeof NAV?.getGamepads === 'function';
  // consoles: B can mean the browser's BACK (Xbox Edge in mouse mode): one same-URL history entry, re-pushed on back, from the first pad press
  let trapped = false; const trap = () => { try { history.pushState({ pfpPad: 1 }, '', location.href); } catch {} };
  if (CONSOLE) { onPadMode((v) => { if (v && !trapped) { trapped = true; trap(); } }); addEventListener('popstate', () => { if (trapped) trap(); }); }
  let lastIdx = -1, prev = null, lastPadT = -1e9; const held = new Map(), btnHeld = new Map(), rep = repeater(); // held: action -> key code down; btnHeld: button -> its held action
  const pads = () => { try { return hasApi ? NAV.getGamepads() : []; } catch { return []; } };
  const recount = () => { connected = [...pads()].filter(p => p && p.connected !== false).length; doc.classList.toggle('pfp-padc', connected > 0); };
  addEventListener('gamepadconnected', (e) => { recount(); lastIdx = e.gamepad?.index ?? lastIdx; console.info('[pad] connected', e.gamepad?.id); });
  addEventListener('gamepaddisconnected', () => { recount(); prev = null; releaseAll(); if (!connected) setActive(false); });
  // back to keyboard / mouse / touch prompts on a REAL key / click / touch (not ours, not the click Xbox mouse mode makes from the A button)
  const human = (e) => { if (!e.isTrusted || !active) return; if (performance.now() - lastPadT < 250) return; setActive(false); };
  addEventListener('keydown', human, true); addEventListener('pointerdown', human, true); addEventListener('touchstart', human, { capture: true, passive: true });
  if (!CONSOLE) { let mx = null; addEventListener('mousemove', (e) => { if (!e.isTrusted) return; if (mx && Math.hypot(e.screenX - mx[0], e.screenY - mx[1]) > 40) human(e); mx = [e.screenX, e.screenY]; }, { passive: true }); }
  const target = () => { const a = document.activeElement; return a && a !== document.body && a.tagName !== 'CANVAS' && !a.closest?.('#hud') ? a : document.body; };
  function key(code, down) { if (!code) return; const t = down ? target() : document.body; t.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code === 'Escape' ? 'Escape' : code === 'Tab' ? 'Tab' : code === 'Space' ? ' ' : code.replace(/^Key/, '').toLowerCase(), bubbles: true, cancelable: true })); }
  const tap = (code) => { key(code, true); key(code, false); };
  function releaseAll() { for (const [, c] of held) if (c) key(c, false); held.clear(); btnHeld.clear(); const D = padHooks.dock; D?.move?.(0, 0, false); D?.ads?.(false); }
  const rumble = (w = 0.25, s = 0.15, ms = 60) => { if (!PAD.rumble || !prefRumble()) return; try { const gp = pickPad(pads(), lastIdx); const va = gp?.vibrationActuator; va?.playEffect?.(va.type || 'dual-rumble', { duration: ms, weakMagnitude: w, strongMagnitude: s }); } catch {} };
  _rumble = rumble; // [fish2]
  const prefRumble = () => { try { return localStorage.getItem('pfp_pad_rumble') !== '0'; } catch { return true; } };

  function mode() {
    const g = opts.game?.() || {};
    const top = topLayer();
    if (top && top.id === 'isle-map') return 'map'; // [map-zoom] sticks pan/zoom the full map (not menu focus)
    if (top || (g.state && g.state !== 'playing' && !opts.spectating?.())) return 'ui';
    if (doc.classList.contains('pvp-spec') || opts.spectating?.()) return 'spec';
    return padHooks.dock?.onFoot?.() ? 'foot' : 'sea';
  }
  function context() { const D = padHooks.dock; return { prompt: D?.prompts?.() || [false, false], area: !!D?.zone?.(), armed: !!D?.armed?.(), tps: !!D?.tps?.()?.on, harbor: !!D?.on?.(), invites: !!D?.hasInvites?.() }; }

  function doAction(a, down, m) {
    const hold = a.startsWith('+'), n = hold ? a.slice(1) : a, D = padHooks.dock;
    if (n === 'promptA' || n === 'promptB') { if (down) { D?.press?.(n === 'promptA' ? 0 : 1); rumble(0.15, 0, 40); } return; }
    if (n === 'weapon') { if (down) { if (D?.cycleWeapon) D.cycleWeapon(); else tap('Tab'); rumble(0.12, 0, 30); } return; }
    if (n === 'ads') { D?.ads?.(down); return; }
    if (n === 'swap') { if (down) D?.tps?.()?.swap?.(); return; }
    if (n === 'camBehind') { if (down) D?.camBehind?.(); return; }
    if (n === 'inventory') { if (down) document.getElementById('tm-btn')?.click(); return; }
    if (n === 'hideHud') { if (down) toggleHudHidden(); return; } // [gold-hud]
    if (n === 'invite') { if (down) D?.openInvites?.(); return; } // [invite-discreet] VIEW → expand the under-inventory invite pill
    if (n === 'sprint') { sprint = down; return; }
    if (n === 'jump' && m === 'foot') { if (down) D?.jump?.(); return; }
    if (n === 'mapClose') { if (down) D?.islandMap?.close?.(); return; } // [map-zoom]
    if (n === 'mapRecentre') { if (down) D?.islandMap?.resetView?.(); return; }
    if (n === 'mapZoomIn') { if (down) D?.islandMap?.zoomIn?.(); return; }
    if (n === 'mapZoomOut') { if (down) D?.islandMap?.zoomOut?.(); return; }
    const code = keyFor(n, opts.binds);
    if (hold) { if (down) { held.set(n, code); key(code, true); } else { key(code, false); held.delete(n); } return; }
    if (down) { tap(code); if (n === 'fireStar' || n === 'firePort' || n === 'attack') rumble(n === 'attack' ? 0.3 : 0.45, n === 'attack' ? 0.1 : 0.3, 90); }
  }
  let sprint = false, steer = 0, lastMode = '', modeT = -1e9;

  function uiFrame(s, p, now) {
    const root = topLayer() || document.getElementById('title') || document.body; let list = null; // the focus list only when it is needed (big shop grids: elementFromPoint per card)
    const L = () => { if (!list) { list = focusables(root); if (!list.length && root !== document.body) list = focusables(document.body); } return list; };
    if (!ring || !ring.isConnected || !root.contains(ring) || ring.disabled || !shown(ring)) setRing(startFocus(L()));
    const dir = [['up', s.b[BTN.UP] || s.ly < -PAD.dig], ['down', s.b[BTN.DOWN] || s.ly > PAD.dig], ['left', s.b[BTN.LEFT] || s.lx < -PAD.dig], ['right', s.b[BTN.RIGHT] || s.lx > PAD.dig]];
    for (const [d, on] of dir) if (rep('nav-' + d, on, now)) {
      if (ring?.tagName === 'INPUT' && ring.type === 'range' && (d === 'left' || d === 'right')) { nudgeRange(ring, d === 'left' ? -1 : 1); continue; }
      const cur = ring && L().includes(ring) ? ring : null; if (!cur) { setRing(startFocus(L())); continue; }
      const others = L().filter(e => e !== cur), i = spatialPick(cur.getBoundingClientRect(), others.map(e => e.getBoundingClientRect()), d);
      if (i >= 0) setRing(others[i]); else if (d === 'down' || d === 'up') scrollLayer(root, d === 'down' ? 80 : -80);
    }
    if (Math.abs(s.ry) > 0.1) scrollLayer(root, s.ry * 22);
    const pr = (b) => s.b[b] && !p.b[b];
    if (pr(BTN.A)) { activate(ring); rumble(0.12, 0, 30); }
    if (pr(BTN.B) || pr(BTN.START)) { if (ring?.tagName === 'INPUT' && document.activeElement === ring && ring.type !== 'range') ring.blur(); tap('Escape'); closeFallback(root); }
    if (pr(BTN.LB)) tabStep(root, -1); if (pr(BTN.RB)) tabStep(root, 1);
  }
  // B on a menu that ignores Esc: its own ✕ / CLOSE / BACK button
  function closeFallback(root) { setTimeout(() => { if (topLayer() !== root || !shown(root)) return; const x = root.querySelector('.faq-x, .iv-x, [aria-label^="Close"], .ew-back, .ok, #pvp-menu-close, #btn-resume, .close, [data-c="no"]'); if (x && shown(x)) activate(x); }, 60); }

  function gameFrame(m, s, p, dt, now) {
    const map = MAP[m], ctx = context();
    for (let i = 0; i < 17; i++) {
      const a = map[i]; if (!a) continue;
      if (s.b[i] && !p.b[i]) { const r = resolve(a, ctx); if (r) { doAction(r, true, m); if (r.startsWith('+')) btnHeld.set(i, r); } }
      else if (!s.b[i] && p.b[i]) { const r = btnHeld.get(i); if (r) { btnHeld.delete(i); doAction(r, false, m); } }
    }
    const D = padHooks.dock;
    if (m === 'sea') {
      // steering: the stick = the steer keys (digital helm, same turn rate as A / D); the D-pad is a held key above
      const want = s.lx < -0.35 ? -1 : s.lx > 0.35 ? 1 : 0;
      if (want !== steer) { if (steer) key(keyFor(steer < 0 ? 'left' : 'right', opts.binds), false); if (want) key(keyFor(want < 0 ? 'left' : 'right', opts.binds), true); steer = want; }
      if (rep('sail-up', s.ly < -0.7, now)) tap(keyFor('sailUp', opts.binds));
      if (rep('sail-dn', s.ly > 0.7, now)) tap(keyFor('sailDown', opts.binds));
      if (s.rx || s.ry) orbit(s.rx * PAD.orbit[0] * dt, s.ry * PAD.orbit[1] * dt);
    } else if (m === 'foot') {
      let mx = s.lx, my = s.ly; const mg = Math.hypot(mx, my); if (sprint && mg > 0.2) { mx /= mg; my /= mg; }
      D?.move?.(mx, my, mg > 0);
      if (s.rx || s.ry) D?.look?.(s.rx, s.ry, dt);
    } else if (m === 'spec') {
      for (const [k, on] of [['KeyW', s.ly < -0.4], ['KeyS', s.ly > 0.4], ['KeyA', s.lx < -0.4], ['KeyD', s.lx > 0.4]]) { const was = held.get('pan' + k); if (on && !was) { held.set('pan' + k, k); key(k, true); } else if (!on && was) { held.delete('pan' + k); key(k, false); } }
      if (s.rx || s.ry) orbit(s.rx * PAD.orbit[0] * dt, s.ry * PAD.orbit[1] * dt);
    } else if (m === 'map') { // [map-zoom] continuous stick pan + trigger/right-stick zoom; edge buttons handled above via MAP.map
      const pr = (b) => s.b[b] && !p.b[b];
      D?.islandMap?.padTick?.({
        lx: s.lx, ly: s.ly, rx: s.rx, ry: s.ry, lt: s.lt, rt: s.rt,
        recenter: pr(BTN.Y) || pr(BTN.A), close: pr(BTN.B) || pr(BTN.START),
      });
    }
  }
  function leaveGame() { if (steer) { key(keyFor(steer < 0 ? 'left' : 'right', opts.binds), false); steer = 0; } releaseAll(); sprint = false; }
  const _o = { x: 0, y: 0, z: 0 };
  function orbit(da, dp) { const c = opts.controls, cam = opts.camera; if (!c || !cam || c.enabled === false) return; const t = c.target;
    _o.x = cam.position.x - t.x; _o.y = cam.position.y - t.y; _o.z = cam.position.z - t.z; const r = Math.hypot(_o.x, _o.y, _o.z) || 1;
    let th = Math.atan2(_o.x, _o.z), ph = Math.acos(clamp(_o.y / r, -1, 1)); th -= da; ph = clamp(ph - dp, Math.max(0.05, c.minPolarAngle ?? 0), Math.min(Math.PI - 0.05, c.maxPolarAngle ?? Math.PI));
    cam.position.set(t.x + r * Math.sin(ph) * Math.sin(th), t.y + r * Math.cos(ph), t.z + r * Math.sin(ph) * Math.cos(th)); }

  function tick(dt = 1 / 60) {
    if (!hasApi || (!connected && !prev)) { if (!connected && hasApi && ++tick.n % 60 === 0) recount(); return; } // some browsers only list a pad after its first press: re-check now and then
    const gp = pickPad(pads(), lastIdx); if (!gp) { if (prev) { leaveGame(); prev = null; } return; }
    const s = readPad(gp), now = performance.now(), p = prev && prev.index === s.index ? prev : { b: [], lx: 0, ly: 0, rx: 0, ry: 0 };
    if (s.b.some((v, i) => v !== !!p.b[i])) lastPadT = now;
    if (anyInput(s)) { if (!active || brand !== s.brand) setActive(true, s.brand); lastIdx = s.index; }
    if (!active) { if (lastMode) { leaveGame(); clearFocusRing(); lastMode = ''; } prev = s; return; } // a key / click / touch took over: let go of everything
    // which mode: re-read the page every 120 ms (getComputedStyle / rects), at once on any button change
    let m = lastMode; if (!m || lastPadT === now || now - modeT > 120) { m = mode(); modeT = now; }
    if (m !== lastMode) { if (lastMode && lastMode !== 'ui') leaveGame(); if (m !== 'ui') { clearFocusRing(); if (document.activeElement?.tagName === 'BUTTON') document.activeElement.blur(); } lastMode = m; }
    if (m === 'ui') uiFrame(s, p, now); else gameFrame(m, s, p, dt, now);
    prev = s;
  }
  tick.n = 0; recount();
  // ⚙ SETTINGS: RUMBLE on / off (shown while a pad is plugged in; localStorage pfp_pad_rumble)
  { const box = document.querySelector('#pause .vol-box'); if (box) { const lab = document.createElement('label'); lab.id = 'pad-rumble'; lab.innerHTML = '<span class="label">RUMBLE</span><input type="checkbox" aria-label="Controller rumble">';
    box.appendChild(lab); const inp = lab.querySelector('input'); inp.checked = prefRumble(); inp.addEventListener('change', () => { try { localStorage.setItem('pfp_pad_rumble', inp.checked ? '1' : '0'); } catch {} if (inp.checked) rumble(0.4, 0.2, 120); }); } }
  addEventListener('blur', () => { leaveGame(); });
  return { tick, on: true, get mode() { return lastMode; }, rumble };
}

const CSS = `
html.pfp-pad .pad-focus{outline:3px solid #ffcd77 !important;outline-offset:3px !important;box-shadow:0 0 0 6px rgba(22,22,22,.8),0 0 18px 4px rgba(255,205,119,.75) !important;position:relative;z-index:1}
html.pfp-pad canvas,html.pfp-pad.tps-on.tps-pc canvas{cursor:none}
html.pfp-pad #dk-acts kbd{display:inline-block !important;min-width:1.1em;text-align:center;border-radius:50%}
html.pfp-pad.pfp-pad-ps #dk-acts kbd{font-family:system-ui,sans-serif}
html.pfp-pad.dk-touch #dk-joy,html.pfp-pad.dk-touch #dk-jump,html.pfp-pad.dk-touch.tps-on #tps-ads,html.pfp-pad.dk-touch.tps-on #tps-sw,html.pfp-pad #bt-atk{display:none !important}
html.pfp-pad.dk-touch.pfp-onfoot #dk-acts{left:50%;right:auto;transform:translateX(-50%) !important;flex-direction:row;align-items:center}
html.pfp-console{font-size:112%}
html.pfp-console button,html.pfp-console .ghost{min-height:44px}
html.pfp-console #hud{zoom:1.15}
html.pfp-console #dk-acts button{font-size:32px;padding:12px 26px 9px}html.pfp-console #dk-acts kbd{font-size:19px}html.pfp-console #dk-toast{font-size:130%}html.pfp-console .pad-focus{outline-width:4px !important}
@media (min-width:1800px){html.pfp-console #hud{zoom:1.35}}
html.pfp-console #dk-joy,html.pfp-console #dk-jump,html.pfp-console #tps-ads,html.pfp-console #tps-sw,html.pfp-console #rotate{display:none !important}
#pad-rumble{display:none}html.pfp-padc #pad-rumble{display:flex;align-items:center;gap:10px}#pad-rumble input{width:24px;height:24px}
#pad-help{margin-top:12px}#pad-help table{width:100%;border-collapse:collapse;font-size:19px}#pad-help td{padding:2px 6px;border-bottom:1px solid rgba(255,205,119,.18)}#pad-help td:first-child{color:#ffcd77;white-space:nowrap}#pad-help h4{margin:10px 0 2px;color:#ffcd77}
`;
