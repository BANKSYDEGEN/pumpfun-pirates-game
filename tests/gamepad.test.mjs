// [Emerly gamepad] js/gamepad.js: dead zones, console + pad detection, the button map, key choice, focus moves, and the driver
// against a mocked navigator.getGamepads (sea: steer / fire / sails, on foot: walk / look / prompt, hot-plug, back to keyboard)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAD, BTN, MAP, padOn, consoleKind, deadzone, padBrand, glyphFor, readPad, pickPad, anyInput, resolve, keyFor, spatialPick, repeater, padHelpHtml, padLine } from '../js/gamepad.js';
import { binds } from '../js/keybinds.js';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const UA = {
  xboxS: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  xboxOne: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  ps5: 'Mozilla/5.0 (PlayStation; PlayStation 5/10.20) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  ps4: 'Mozilla/5.0 (PlayStation 4 11.00) AppleWebKit/605.1.15 (KHTML, like Gecko)',
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};
// a Gamepad-shaped object: buttons as { pressed, value }, axes [lx, ly, rx, ry]
const mkPad = ({ index = 0, id = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', press = [], axes = [0, 0, 0, 0], lt = 0, rt = 0 } = {}) => ({
  index, id, connected: true, mapping: 'standard', axes,
  buttons: Array.from({ length: 17 }, (_, i) => i === 6 ? { pressed: lt > 0.1, value: lt } : i === 7 ? { pressed: rt > 0.1, value: rt } : { pressed: press.includes(i), value: press.includes(i) ? 1 : 0 }) });

test('kill switch: &pad=0 / ?pad=0 only', () => {
  assert.equal(padOn(''), true); assert.equal(padOn('?x=1'), true); assert.equal(padOn('?pad=0'), false); assert.equal(padOn('?a=1&pad=0'), false); assert.equal(padOn('?pad=0&b=2'), false);
  assert.equal(padOn('?pad=01'), true); assert.equal(padOn('?ipad=0'), true);
});
test('console user agents: Xbox Edge, PlayStation; desktop + phones are not consoles', () => {
  assert.equal(consoleKind(UA.xboxS), 'xbox'); assert.equal(consoleKind(UA.xboxOne), 'xbox'); assert.equal(consoleKind(UA.ps5), 'ps'); assert.equal(consoleKind(UA.ps4), 'ps');
  assert.equal(consoleKind(UA.chrome), ''); assert.equal(consoleKind(UA.iphone), ''); assert.equal(consoleKind(''), '');
});
test('dead zone: radial, rescaled from 0 at the edge to 1 at full tilt', () => {
  assert.deepEqual(deadzone(0.1, 0.1), [0, 0]); assert.deepEqual(deadzone(PAD.dead, 0), [0, 0]);
  const [x] = deadzone(1, 0); near(x, 1); const [h] = deadzone((1 + PAD.dead) / 2, 0); near(h, 0.5);
  const [dx, dy] = deadzone(0.6, 0.6); near(dx, dy); assert.ok(Math.hypot(dx, dy) <= 1 + 1e-9, 'diagonals never exceed 1');
  assert.deepEqual(deadzone(NaN, 0), [0, 0]);
});
test('pad brand + glyphs: Xbox letters, PlayStation shapes, Nintendo positional', () => {
  assert.equal(padBrand('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'), 'xbox');
  assert.equal(padBrand('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'ps');
  assert.equal(padBrand('054c-05c4-Wireless Controller'), 'ps');
  assert.equal(padBrand('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)'), 'nintendo');
  assert.equal(padBrand('Generic USB Joystick'), 'xbox');
  assert.equal(glyphFor('xbox', 'A'), 'A'); assert.equal(glyphFor('ps', 'A'), '✕'); assert.equal(glyphFor('ps', 'B'), '○'); assert.equal(glyphFor('ps', 'RT'), 'R2'); assert.equal(glyphFor('nintendo', 'A'), 'B');
  assert.ok(padHelpHtml('ps').includes('R2') && !padHelpHtml('ps').includes('>RT'), 'the help table follows the brand');
});
test('readPad: buttons, analog triggers past the threshold, sticks through the dead zone', () => {
  const s = readPad(mkPad({ press: [BTN.A, BTN.UP], axes: [0.1, -0.05, 0.9, 0], lt: 0.2, rt: 0.8 }));
  assert.equal(s.b[BTN.A], true); assert.equal(s.b[BTN.UP], true); assert.equal(s.b[BTN.B], false);
  assert.equal(s.b[BTN.LT], false, 'a light trigger touch is not a press'); assert.equal(s.b[BTN.RT], true); near(s.rt, 0.8);
  assert.equal(s.lx, 0); assert.equal(s.ly, 0); assert.ok(s.rx > 0.8);
  assert.equal(anyInput(s), true); assert.equal(anyInput(readPad(mkPad())), false);
  const raw = readPad({ index: 1, buttons: [1, 0], axes: [] }); assert.equal(raw.b[0], true, 'old numeric buttons work too'); assert.equal(raw.lx, 0);
});
test('pickPad: the pad last used, else the first connected one; null slots skipped', () => {
  const a = mkPad({ index: 0 }), b = mkPad({ index: 2 }); assert.equal(pickPad([null, a, null, b], 2), b); assert.equal(pickPad([null, a], 5), a); assert.equal(pickPad([null, null]), null);
  assert.equal(pickPad([{ ...a, connected: false }]), null);
});
test('the map: every mode has the standard layout BANKSY asked for', () => {
  assert.equal(MAP.sea[BTN.RT], 'fireStar'); assert.equal(MAP.sea[BTN.LT], 'firePort'); assert.equal(MAP.sea[BTN.A], 'promptA'); assert.equal(MAP.sea[BTN.START], 'pause');
  assert.equal(MAP.foot[BTN.RT], 'attack'); assert.equal(MAP.foot[BTN.LT], '+ads'); assert.equal(MAP.foot[BTN.A], 'promptA|jump');
  assert.equal(MAP.ui[BTN.A], 'click'); assert.equal(MAP.ui[BTN.B], 'back'); assert.equal(MAP.ui[BTN.LB], 'tabPrev'); assert.equal(MAP.ui[BTN.RB], 'tabNext');
  assert.equal(MAP.spec[BTN.LB], 'specPrev'); assert.equal(MAP.spec[BTN.RB], 'specNext');
  const special = new Set(['promptA', 'promptB', 'ads', 'swap', 'camBehind', 'inventory', 'sprint', 'jump', 'invite', 'hideHud']); // [gold-hud] HOME → toggleHudHidden (no key) // [invite-discreet] VIEW → openInvites (no key)
  for (const m of ['sea', 'foot', 'spec']) for (const a of Object.values(MAP[m])) for (const n of a.split('|').map(x => x.replace(/^\+/, '')))
    assert.ok(special.has(n) || keyFor(n, binds), `${m}: ${n} sends nothing`);
});
test('resolve: the prompt wins only when one is up; area / musket / harbor actions only where they apply', () => {
  assert.equal(resolve('promptA|jump', { prompt: [true, false] }), 'promptA'); assert.equal(resolve('promptA|jump', { prompt: [false, false] }), 'jump');
  assert.equal(resolve('promptB|anchor', { prompt: [true, true] }), 'promptB'); assert.equal(resolve('promptB|anchor', {}), 'anchor');
  assert.equal(resolve('attack', { area: false }), null); assert.equal(resolve('attack', { area: true }), 'attack');
  assert.equal(resolve('+ads', { tps: true }), '+ads'); assert.equal(resolve('+ads', {}), null);
  assert.equal(resolve('swap|camBehind', { tps: false }), 'camBehind'); assert.equal(resolve('map', { harbor: false }), null); assert.equal(resolve('inventory', { harbor: true }), 'inventory');
  // [invite-discreet] VIEW = invite when a pill is pending, else the BR menu — never while a shop/menu has focus (ui mode skips the map)
  assert.equal(MAP.sea[BTN.VIEW], 'invite|menu'); assert.equal(MAP.foot[BTN.VIEW], 'invite|menu');
  assert.equal(resolve('invite|menu', { invites: true }), 'invite'); assert.equal(resolve('invite|menu', { invites: false }), 'menu'); assert.equal(resolve('invite|menu', {}), 'menu');
});

test('invite-discreet: VIEW binding, layers, dock hooks, no clash with A/B/Start', () => {
  const g = src('js/gamepad.js'), d = src('js/dock/index.js'), h = src('js/dock/squadHall.js');
  assert.match(g, /\[BTN\.VIEW\]: 'invite\|menu'/);
  assert.match(g, /n === 'invite' && !ctx\.invites/);
  assert.match(g, /n === 'invite'.*openInvites/);
  assert.match(g, /#sq-note\.open/);
  assert.match(g, /#sq-hall/);
  assert.match(d, /hasInvites:.*squadHall/);
  assert.match(d, /openInvites:.*squadHall/);
  assert.match(h, /id = 'sq-note'|#sq-note\b/);
  assert.match(h, /openInvites/);
  assert.match(h, /hasInvites/);
  assert.match(h, /data-gly/);
  assert.match(h, /pfp-padc/);
  // A / B stay click / back in ui (accept / decline via focus); VIEW unused in ui so shops block the shortcut
  assert.equal(MAP.ui[BTN.A], 'click'); assert.equal(MAP.ui[BTN.B], 'back'); assert.equal(MAP.ui[BTN.VIEW], undefined);
});

test('keyFor: the live binds; broadsides never use E (the dock prompt key), sails never a mouse button', () => {
  assert.equal(keyFor('fireStar', binds), 'MouseR', 'default E / MOUSE R -> MOUSE R'); assert.equal(keyFor('firePort', binds), 'KeyQ');
  assert.equal(keyFor('left', binds), 'KeyA'); assert.equal(keyFor('sailUp', binds), 'KeyW'); assert.equal(keyFor('anchor', binds), 'Space'); assert.equal(keyFor('pause', binds), 'Escape');
  assert.equal(keyFor('fireStar', () => ['KeyE', '']), 'KeyE', 'only E bound: E'); assert.equal(keyFor('sailUp', () => ['MouseR', 'KeyI']), 'KeyI');
  assert.equal(keyFor('attack'), 'KeyR'); assert.equal(keyFor('team'), 'KeyG'); assert.equal(keyFor('emote'), 'KeyT'); assert.equal(keyFor('nope'), '');
});
test('spatialPick: a 3x2 grid (inventory / shop cards)', () => {
  const R = (x, y) => ({ left: x * 100, top: y * 100, right: x * 100 + 80, bottom: y * 100 + 80, width: 80, height: 80 });
  const grid = [R(0, 0), R(1, 0), R(2, 0), R(0, 1), R(1, 1), R(2, 1)], from = grid[1], rest = grid.filter(r => r !== from);
  assert.equal(rest[spatialPick(from, rest, 'right')], grid[2]); assert.equal(rest[spatialPick(from, rest, 'left')], grid[0]);
  assert.equal(rest[spatialPick(from, rest, 'down')], grid[4], 'straight down, not the diagonal'); assert.equal(spatialPick(from, rest, 'up'), -1);
  const off = [R(0, 0), { left: 400, top: 140, right: 480, bottom: 220, width: 80, height: 80 }, R(3, 0)];
  assert.equal(off[spatialPick(R(2, 0), off, 'right')], off[2], 'in-line beats closer-but-diagonal');
});
test('repeater: press, then the first delay, then the fast repeat; release resets', () => {
  const r = repeater(); assert.equal(r('d', true, 0), true); assert.equal(r('d', true, 100), false); assert.equal(r('d', true, PAD.repeat[0] + 1), true);
  assert.equal(r('d', true, PAD.repeat[0] + 2), false); assert.equal(r('d', true, PAD.repeat[0] + PAD.repeat[1] + 2), true); assert.equal(r('d', false, 9999), false); assert.equal(r('d', true, 10000), true);
});

// ---------- the driver, against a mocked navigator.getGamepads + a tiny DOM ----------
function fakeDom() {
  const win = new EventTarget(), body = new EventTarget(), cls = new Set(), sent = [];
  const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], set textContent(v) {}, set innerHTML(v) {}, set id(v) {} });
  body.tagName = 'BODY'; body.closest = () => null;
  const document = { documentElement: { classList: { add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), toggle: (c, v) => { v = v === undefined ? !cls.has(c) : v; v ? cls.add(c) : cls.delete(c); return v; }, contains: (c) => cls.has(c) } },
    head: el(), body, createElement: el, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, get activeElement() { return body; } };
  class KE extends Event { constructor(t, o = {}) { super(t, o); this.code = o.code; this.key = o.key; } }
  body.addEventListener('keydown', (e) => sent.push('+' + e.code)); body.addEventListener('keyup', (e) => sent.push('-' + e.code));
  return { win, body, cls, sent, document, KE };
}
async function withDriver(fn) {
  const D = fakeDom(), pads = [null, null, null, null], keep = {};
  const set = (k, v) => { keep[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); };
  set('window', D.win); set('document', D.document); set('navigator', { userAgent: UA.chrome, getGamepads: () => pads }); set('location', { search: '' });
  set('addEventListener', D.win.addEventListener.bind(D.win)); set('KeyboardEvent', D.KE); set('getComputedStyle', () => ({})); set('innerWidth', 1280); set('innerHeight', 720);
  try {
    const G = await import('../js/gamepad.js?driver=' + Math.random());
    const calls = []; const game = { state: 'playing', mode: 'pvp' };
    const drv = G.initGamepad({ game: () => game, binds, controls: null, camera: null, spectating: () => false });
    await fn({ G, D, pads, drv, game, calls, mk: mkPad, plug: (p) => { const fresh = !pads[p.index]; pads[p.index] = p; if (fresh) D.win.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: p })); }, unplug: (i) => { pads[i] = null; D.win.dispatchEvent(new Event('gamepaddisconnected')); } });
  } finally { for (const k in keep) { if (keep[k]) Object.defineProperty(globalThis, k, keep[k]); else delete globalThis[k]; } }
}
test('driver at sea: hot-plug, RT fires starboard (MOUSE R), stick steers (A key held, released), stick up raises sail, unplug lets go', async () => {
  await withDriver(async ({ G, D, drv, plug, unplug, mk }) => {
    drv.tick(0.016); assert.equal(D.sent.length, 0, 'no pad: nothing');
    plug(mk()); drv.tick(0.016); assert.equal(G.padActive(), false, 'plugged in but untouched: keyboard prompts stay');
    plug(mk({ rt: 1 })); drv.tick(0.016); assert.equal(G.padActive(), true); assert.ok(D.cls.has('pfp-pad'));
    assert.deepEqual(D.sent.splice(0), ['+MouseR', '-MouseR']); drv.tick(0.016); assert.deepEqual(D.sent.splice(0), [], 'held trigger = one shot');
    plug(mk({ axes: [-0.9, 0, 0, 0] })); drv.tick(0.016); assert.deepEqual(D.sent.splice(0), ['+KeyA']);
    plug(mk({ axes: [0, -0.95, 0, 0] })); drv.tick(0.016); assert.deepEqual(D.sent.splice(0), ['-KeyA', '+KeyW', '-KeyW']);
    plug(mk({ press: [BTN.LEFT] })); drv.tick(0.016); assert.deepEqual(D.sent.splice(0), ['+KeyA'], 'D-pad left = held steer key');
    unplug(0); drv.tick(0.016); assert.ok(D.sent.includes('-KeyA'), 'unplugging releases held keys'); assert.equal(G.padActive(), false);
  });
});
test('driver on foot: left stick -> walker joystick, right stick -> look, A = the prompt (else jump), RT only in an area', async () => {
  await withDriver(async ({ G, D, drv, plug, mk }) => {
    const log = []; let prompt = [false, false], area = false;
    G.registerPadDock({ on: () => true, onFoot: () => true, prompts: () => prompt, press: (i) => log.push('press' + i), zone: () => area, tps: () => null, harbor: true,
      move: (x, y, a) => log.push(['move', +x.toFixed(2), +y.toFixed(2), a]), look: (rx, ry) => log.push(['look', +rx.toFixed(2), +ry.toFixed(2)]), jump: () => log.push('jump'), ads: () => {} });
    plug(mk({ axes: [0, -1, 0.5, 0] })); drv.tick(0.016);
    assert.deepEqual(log.find(e => e[0] === 'move'), ['move', 0, -1, true]); assert.ok(log.find(e => e[0] === 'look')[1] > 0);
    log.length = 0; plug(mk({ press: [BTN.A] })); drv.tick(0.016); assert.ok(log.includes('jump') && !log.includes('press0'), 'no prompt: A jumps');
    plug(mk()); drv.tick(0.016); prompt = [true, false]; log.length = 0; plug(mk({ press: [BTN.A] })); drv.tick(0.016); assert.ok(log.includes('press0') && !log.includes('jump'), 'prompt up: A = the prompt (E)');
    assert.equal(G.promptKey('E', 0), 'A'); assert.equal(G.promptKey('W', 1), 'X');
    D.sent.length = 0; plug(mk({ rt: 1 })); drv.tick(0.016); assert.deepEqual(D.sent.splice(0), [], 'RT outside the sword pit / range: nothing');
    plug(mk()); drv.tick(0.016); area = true; plug(mk({ rt: 1 })); drv.tick(0.016); assert.deepEqual(D.sent.splice(0), ['+KeyR', '-KeyR'], 'in an area: RT = R (swing / fire)');
    plug(mk()); drv.tick(0.016); assert.deepEqual(log.filter(e => e[0] === 'move').pop(), ['move', 0, 0, false], 'stick back to centre lets the joystick go');
  });
});
test('driver: a real key press switches prompts back to the keyboard; our own synthetic keys do not', async () => {
  await withDriver(async ({ G, D, drv, plug, mk }) => {
    plug(mk({ press: [BTN.X] })); drv.tick(0.016); assert.equal(G.padActive(), true);
    D.win.dispatchEvent(new Event('keydown')); assert.equal(G.padActive(), true, 'untrusted (synthetic) key: still the pad');
    // node / deno cannot make a trusted event; the rule lives in human(): e.isTrusted && 250 ms after the last pad button
    assert.ok(src('js/gamepad.js').includes("const human = (e) => { if (!e.isTrusted || !active) return; if (performance.now() - lastPadT < 250) return; setActive(false); };"));
  });
});
test('wiring: main.js polls in frame(), consoles are never phones, touch sticks off on consoles, sw precaches + bumps, crew untouched', () => {
  const main = src('js/main.js'), dock = src('js/dock/index.js'), sw = src('sw.js'), tps = src('js/onfoot/tps.js'), crew = src('js/crewV4.js');
  assert.ok(/function frame\(\) \{\n  const dt = [^\n]+\n  try \{ pad\.tick\(dt\); \}/.test(main), 'pad.tick at the top of frame()');
  assert.ok(main.includes("const isMobile = !CONSOLE && ("));
  assert.ok(dock.includes("const touch = !CONSOLE && ("));
  assert.ok(dock.includes('registerPadDock({') && dock.includes('promptKey('));
  assert.ok(/\.\/js\/gamepad\.js/.test(sw)); assert.ok(/const VERSION = 'pfp-v\d+'/.test(sw));
  assert.ok(tps.includes('pcAim()') && tps.includes('padLook'), 'musket: pad aims like the phone');
  assert.ok(crew.includes('export const CREW_EXTRA_SLOTS = [], CREW_EXTRA_LOW = [];'));
});

test('padLine: the hint line names the pad buttons for each brand', () => {
  const x = padLine(false, 'xbox'), p = padLine(true, 'ps');
  assert.ok(x.includes('RT') && x.includes('A') && x.includes('left stick')); assert.ok(p.includes('R2') && p.includes('○') === false && p.includes('□'));
});

