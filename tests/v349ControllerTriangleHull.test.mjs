// node --test tests/v349ControllerTriangleHull.test.mjs
// Updated for t2343u: Cross / A enters hull; Triangle / Y goes ashore when moored;
// glyph △ (PlayStation) / Y (Xbox); keyboard H / E / Q / W unchanged; underway Y still opens the island map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BTN, MAP, MAP_HELP, resolve, glyphFor, padBrand, padAction, readPad } from '../js/gamepad.js';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const G = src('js/gamepad.js');
const D = src('js/dock/index.js');
const SW = src('sw.js');

test('v349 MAP.sea: Cross / A enters hull; Triangle / Y goes ashore', () => {
  assert.equal(BTN.Y, 3, 'standard Gamepad Y / Triangle index');
  assert.equal(MAP.sea[BTN.Y], 'goAshore');
  assert.equal(MAP.sea[BTN.A], 'enterHull|promptA');
  assert.equal(MAP.foot[BTN.Y], 'leaveHullDoor', 'on foot Y = leave at cabin door, else island map (A also leaves at the door)');
});

test('v349 resolve: enterHull only when canEnterHull; else map when harbor', () => {
  assert.equal(resolve('enterHull|map', { canEnterHull: true, harbor: true }), 'enterHull');
  assert.equal(resolve('enterHull|map', { canEnterHull: true, harbor: false }), 'enterHull');
  assert.equal(resolve('enterHull|map', { canEnterHull: false, harbor: true }), 'map');
  assert.equal(resolve('enterHull|map', { canEnterHull: false, harbor: false }), null);
  assert.equal(resolve('enterHull', { canEnterHull: false }), null);
  assert.equal(resolve('enterHull', { canEnterHull: true }), 'enterHull');
});

test('t2343u contextual swap preserves prompt, jump and UI fallbacks', () => {
  assert.equal(resolve(MAP.sea[BTN.A], { canEnterHull: true, prompt: [true] }), 'enterHull');
  assert.equal(resolve(MAP.sea[BTN.A], { canEnterHull: false, prompt: [true] }), 'promptA');
  assert.equal(resolve(MAP.sea[BTN.A], { canEnterHull: false, prompt: [false] }), null);
  assert.equal(resolve(MAP.sea[BTN.Y], { canGoAshore: true, harbor: true }), 'goAshore');
  assert.equal(resolve(MAP.sea[BTN.Y], { canGoAshore: false, harbor: true }), null);
  assert.equal(resolve(MAP.sea[BTN.Y], { canGoAshore: false, harbor: false }), null);
  assert.equal(resolve(MAP.foot[BTN.A], { prompt: [false], canEnterHull: true }), 'jump');
  assert.equal(resolve(MAP.foot[BTN.A], { prompt: [true], canEnterHull: true }), 'promptA');
  assert.equal(MAP.ui[BTN.A], 'click');
  assert.match(D, /label: 'GO ASHORE', key: 'E', pad: 'Y'/);
});

test('v349 glyphs: PlayStation △, Xbox Y, Nintendo X (positional Y face)', () => {
  assert.equal(glyphFor('ps', 'Y'), '△');
  assert.equal(glyphFor('xbox', 'Y'), 'Y');
  assert.equal(glyphFor('nintendo', 'Y'), 'X');
  assert.equal(padBrand('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'ps');
  assert.equal(padBrand('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'), 'xbox');
});

test('v349 MAP_HELP.sea documents Cross for hull and Triangle for shore', () => {
  const y = MAP_HELP.sea.find((row) => row[0] === 'Y');
  assert.ok(y, 'MAP_HELP.sea has a Y row');
  assert.match(y[1], /take canoe/i);
  assert.match(y[1], /go ashore/i);
  assert.match(MAP_HELP.sea.find(row => row[0] === 'A')[1], /enter hull/i);
  assert.match(y[1], /moored|anchored/i);
  assert.doesNotMatch(y[1], /island map/i);
  assert.match(G, /go ashore \(port berth\) · take canoe to shore \(anchored at sea\)/);
});

test('v349 gamepad wiring: resolve gate, doAction enterHull, context.canEnterHull, promptKey padBtn', () => {
  assert.match(G, /n === 'enterHull' && !ctx\.canEnterHull/);
  assert.match(G, /n === 'enterHull'.*D\?\.enterHull/);
  assert.match(G, /canEnterHull: !!D\?\.canEnterHull/);
  assert.match(G, /padBtn/);
  assert.match(G, /n === 'goAshore' && !ctx\.canGoAshore/);
  assert.match(G, /\[BTN\.A\]: 'enterHull\|promptA'/);
});

test('v349 dock: canEnterHull + enterHull hooks; ENTER HULL pad:A; keyboard keys preserved', () => {
  assert.match(D, /canEnterHull:\s*\(\)\s*=>/);
  assert.match(D, /enterHull:\s*\(\)\s*=>\s*\{\s*if \(game\.state === 'playing'\) enterHull\(\);/);
  assert.match(D, /docking\.mode === 'docked' \|\| \(docking\.mode === 'sea' && !!P\(\)\?\.anchor\)/);
  // keyboard keys unchanged (existing hull/dock tests also assert these)
  assert.ok(D.includes("{ label: 'ENTER HULL', key: 'H'"));
  assert.ok(D.includes("label: 'ENTER HULL', key: 'E'"));
  assert.match(D, /pad:\s*'Y'/);
  assert.match(D, /promptKey\(s\.key \|\| 'E', i, s\.pad \|\| \(s\.label === 'ENTER HULL' \? 'A' : null\)\)/);
  // GO ASHORE / SET SAIL / LAUNCH CANOE / WEIGH ANCHOR keyboard keys stay
  assert.match(D, /label: 'GO ASHORE', key: 'E'/);
  assert.match(D, /label: 'SET SAIL', key: 'W'/);
  assert.match(D, /key: 'Q'/); // LAUNCH CANOE / CHANGE SKIN
  assert.match(D, /label: 'WEIGH ANCHOR', key: 'W'/);
});

test('v349 driver: A calls enterHull when canEnterHull, else taps map key when underway', async () => {
  const win = new EventTarget(), body = new EventTarget(), cls = new Set(), sent = [];
  const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], set textContent(v) {}, set innerHTML(v) {}, set id(v) {} });
  body.tagName = 'BODY'; body.closest = () => null;
  const document = { documentElement: { classList: { add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), toggle: (c, v) => { v = v === undefined ? !cls.has(c) : !!v; v ? cls.add(c) : cls.delete(c); return v; }, contains: (c) => cls.has(c) } },
    head: el(), body, createElement: el, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, get activeElement() { return body; } };
  class KE extends Event { constructor(t, o = {}) { super(t, o); this.code = o.code; this.key = o.key; } }
  body.addEventListener('keydown', (e) => sent.push('+' + e.code)); body.addEventListener('keyup', (e) => sent.push('-' + e.code));
  const pads = [null, null, null, null];
  const keep = {};
  const set = (k, v) => { keep[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); };
  set('window', win); set('document', document); set('navigator', { userAgent: 'Mozilla/5.0', getGamepads: () => pads }); set('location', { search: '' });
  set('addEventListener', win.addEventListener.bind(win)); set('KeyboardEvent', KE); set('getComputedStyle', () => ({})); set('innerWidth', 1280); set('innerHeight', 720);
  try {
    const GP = await import('../js/gamepad.js?v349=' + Math.random());
    const { binds } = await import('../js/keybinds.js');
    const log = [];
    let can = false, ashore = false;
    GP.registerPadDock({
      on: () => true, onFoot: () => false,
      prompts: () => [false, false, false], press: () => {},
      canGoAshore: () => ashore, goAshore: () => log.push('goAshore'),
      canEnterHull: () => can, enterHull: () => log.push('enterHull'),
      zone: () => false, armed: () => false, tps: () => null,
      jump: () => {}, move: () => {}, look: () => {}, ads: () => {},
    });
    const drv = GP.initGamepad({ game: () => ({ state: 'playing', mode: 'pvp' }), binds, controls: null, camera: null, spectating: () => false });
    const mk = ({ press = [], id = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)' } = {}) => ({
      index: 0, id, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: press.includes(i), value: press.includes(i) ? 1 : 0 })),
    });
    const plug = (p) => { const fresh = !pads[p.index]; pads[p.index] = p; if (fresh) win.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: p })); };

    // wake pad
    plug(mk({ press: [BTN.A] })); drv.tick(0.016); assert.equal(GP.padActive(), true);
    plug(mk()); drv.tick(0.016);

    // docked / anchored: Cross / A → enterHull
    can = true; ashore = true; log.length = 0; sent.length = 0;
    plug(mk({ press: [BTN.A] })); drv.tick(0.016);
    assert.deepEqual(log, ['enterHull'], 'A enters hull without triggering shore prompt');
    assert.ok(!sent.includes('+' + binds('map')[0]), 'map key not fired while enterHull wins');

    // release
    plug(mk()); drv.tick(0.016);

    // moored: Triangle / Y takes the shore action, never hull or map
    log.length = 0; sent.length = 0;
    plug(mk({ press: [BTN.Y] })); drv.tick(0.016);
    assert.deepEqual(log, ['goAshore']);
    ashore = false; // action changed context immediately; a held Triangle stays consumed
    drv.tick(0.016); drv.tick(0.016);
    assert.deepEqual(log, ['goAshore']);
    assert.equal(sent.length, 0);
    plug(mk()); drv.tick(0.016);

    // anchored: Y stays map (no shore action), A still enters hull
    ashore = false; log.length = 0; sent.length = 0;
    plug(mk({ press: [BTN.Y] })); drv.tick(0.016);
    assert.deepEqual(log, []);
    assert.deepEqual(sent, [], 'Triangle never opens map, even when no ship action is available');
    plug(mk()); drv.tick(0.016);

    // underway at sea: Y → island map
    can = false; log.length = 0; sent.length = 0;
    plug(mk({ press: [BTN.Y] })); drv.tick(0.016);
    assert.ok(!log.includes('enterHull'), 'Y does not enter hull while sailing');
    const mapCode = binds('map')[0];
    assert.deepEqual(sent, [], 'Triangle has no map fallback underway');
    plug(mk()); drv.tick(0.016);
    plug(mk({ press: [BTN.START] })); drv.tick(0.016);
    assert.ok(sent.includes('+' + mapCode) && sent.includes('-' + mapCode), 'Start taps island map on pads without touchpad');
    plug(mk()); drv.tick(0.016);
    sent.length = 0;
    plug(mk({ press: [BTN.VIEW] })); drv.tick(0.016);
    assert.ok(sent.includes('+Escape'), 'View keeps settings reachable');

    // promptKey glyphs while pad active
    assert.equal(GP.promptKey('H', 2, 'A'), 'A'); // xbox brand from DualSense? pad brand from last pad = xbox
    // switch to DualSense and check △
    plug(mk({ id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', press: [BTN.A] })); drv.tick(0.016);
    assert.equal(GP.promptKey('H', 2, 'A'), '✕');
    assert.equal(GP.promptKey('E', 0, 'Y'), '△');
    assert.equal(GP.promptKey('E', 0), '✕'); // PS A = ✕
    assert.equal(GP.promptKey('Q', 1), '□'); // PS X = □
    assert.equal(GP.promptKey('W', 2), 'W', 'slot 2 without padBtn keeps keyboard letter');
  } finally {
    for (const k in keep) { if (keep[k]) Object.defineProperty(globalThis, k, keep[k]); else delete globalThis[k]; }
  }
});

test('v349 sw.js VERSION = pfp-v349', () => {
  assert.ok(+SW.match(/const VERSION = 'pfp-v(\d+)'/)[1] >= 349); // future releases preserve v349 mapping
});

test('t2351u: port Triangle walks ashore without canoe; anchored Triangle takes canoe', () => {
  // Execute the actual pad hook with minimal dock state, without loading the world.
  const hook = D.match(/goAshore: \(\) => \{([\s\S]*?)\n      \},\n      enterHull:/)[1];
  const run = new Function('game', 'actA', 'actB', 'SAIL_ALL', 'P', 'canoe', 'controls', 'press', hook);
  const ship = { anchor: false }, calls = [], controls = {};
  const canoe = { act: (tag, ctx) => calls.push([tag, ctx]) };
  const shore = { label: 'GO ASHORE', fn() {} }, launch = { tag: 'launchCanoe', fn() {} };
  run({ state: 'playing' }, shore, null, true, () => ship, canoe, controls, a => calls.push(a));
  assert.deepEqual(calls, [shore], 'port berth dispatches normal walk-off prompt, never canoe.act');
  assert.equal(ship.anchor, false, 'port walk-off does not alter ship anchor');
  calls.length = 0;
  run({ state: 'playing' }, { label: 'ENTER HULL' }, launch, true, () => ship, canoe, controls, a => calls.push(a));
  assert.deepEqual(calls, [launch]);
  calls.length = 0;
  run({ state: 'paused' }, shore, launch, true, () => ship, canoe, controls, a => calls.push(a));
  assert.deepEqual(calls, []);
  assert.match(D, /label: 'GO ASHORE', key: 'E', pad: 'Y', primary: true, fn: goAshore/);
  assert.doesNotMatch(D, /padLabel: SAIL_ALL \? 'TAKE CANOE'/);
  assert.match(D, /padLabel: 'GO TO SHORE · CANOE'/);
  assert.ok(D.indexOf("} else if (canoe?.mode === 'canoe')") < D.indexOf("else if (docking.mode === 'docked') setActs"), 'canoe prompts override moored ship prompts');
  assert.match(D, /!onFoot && !inCanoe && !inHull && docking.mode === 'docked'/, 'paddling W cannot set sail on the moored ship');
});

test('t2343u map uses touchpad 17 or Start; Triangle has no map consumer', () => {
  const ps = readPad({ id: 'DualSense Wireless Controller', buttons: Array.from({length: 18}, (_, i) => ({pressed: i === 17, value: i === 17 ? 1 : 0})), axes: [] });
  assert.equal(ps.hasTouchpad, true); assert.equal(ps.b[17], true);
  const xbox = readPad({ id: 'Xbox Wireless Controller', buttons: Array(17).fill({pressed:false,value:0}), axes: [] });
  const psNoTouch = readPad({ id: 'DualSense Wireless Controller', buttons: Array(17).fill({pressed:false,value:0}), axes: [] });
  for (const mode of ['sea', 'foot']) {
    assert.equal(padAction(mode, BTN.TOUCHPAD, ps, {harbor:true}), 'map');
    assert.equal(padAction(mode, BTN.START, ps, {harbor:true}), 'pause');
    for (const pad of [xbox, psNoTouch]) {
      assert.equal(resolve(padAction(mode, BTN.START, pad, {harbor:true}), {harbor:true}), 'map');
      assert.equal(resolve(padAction(mode, BTN.VIEW, pad, {harbor:true}), {harbor:true}), 'pause');
      assert.equal(resolve(padAction(mode, BTN.START, pad, {harbor:false}), {harbor:false}), 'pause');
    }
    assert.doesNotMatch(padAction(mode, BTN.Y, ps, {}), /map/);
  }
  assert.equal(MAP.map[BTN.Y], undefined);
  assert.match(G, /recenter: pr\(BTN.A\), close:/);
});
