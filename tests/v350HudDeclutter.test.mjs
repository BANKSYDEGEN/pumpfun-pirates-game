import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameplayHint } from '../js/hudDeclutter.js';
import { BTN, MAP, resolve } from '../js/gamepad.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('index.html'), css = read('css/style.css'), dock = read('js/dock/index.js'), main = read('js/main.js');
const hull = read('js/dock/shipHull.js'), houses = read('js/dock/houses.js'), pad = read('js/gamepad.js');
const declutter = css.slice(css.indexOf('/* [v350]'));

test('v350 release preserves the Triangle hull mapping', () => {
  assert.ok(+read('sw.js').match(/VERSION = 'pfp-v(\d+)'/)[1] >= 350);
  assert.match(dock, /label: 'ENTER HULL', key: 'H', pad: 'Y'/);
  assert.match(pad, /\[BTN\.Y\]: 'enterHull\|map'/);
});

test('all ship DOM hooks remain exactly once', () => {
  for (const id of ['controls','fire-port','fire-star','steer-left','steer-right','sail-up','sail-down','sail-level','knots','anchor']) assert.equal(html.split(`id="${id}"`).length, 2, id);
  assert.match(html, /class="cd"/);
});

test('moored state derives from live docking/foot/hull state and clears on Harbor exit', () => {
  assert.match(dock, /toggle\('dk-harbor', !!on\)/);
  assert.match(dock, /toggle\('dk-moored', !!\(on && docking.mode === 'docked' && !onFoot && !shipHull\?\.inHull\)\)/);
  assert.match(dock, /docking\.tick\(s, dt\);\s*syncDockHud\(\)/);
  assert.match(dock, /syncDockHud\(\);\s*harborExtras/);
  assert.match(declutter, /html\.dk-moored #controls/);
});

test('desktop/controller compact mode does not remove mobile steering controls', () => {
  assert.match(main, /toggle\('pfp-desktop', !isMobile\)/);
  for (const id of ['steer-left','steer-right','sail-up','sail-down']) assert.ok(declutter.includes(`html:is(.pfp-desktop,.pfp-pad,.pfp-console) #${id}`));
  assert.match(declutter, /#sail-down \{ display: none !important/);
  assert.match(declutter, /#controls \{[^}]*bottom: calc\(12px \+ var\(--safe-b, 0px\)\); gap: 8px/);
  assert.match(declutter, /#fire-star \{[^}]*height: 30px; min-width: 58px/);
  assert.match(declutter, /#sail-readout \{ display: flex/);
  assert.match(declutter, /\.fire\.ready \{ box-shadow:/);
});

test('dock actions are horizontal compact pills, low while moored with touch collision clearance retained', () => {
  const rules = dock.slice(dock.indexOf('/* [v350]'));
  assert.match(rules, /#dk-acts \{ flex-direction:row; flex-wrap:wrap; justify-content:center; gap:6px/);
  assert.match(rules, /html\.dk-moored #dk-acts[^}]*bottom:calc\(16px/);
  assert.match(rules, /font-size:18px;[^}]*padding:4px 11px 3px;[^}]*border-radius:999px/);
  assert.match(rules, /#dk-acts kbd \{ font-size:13px/);
  assert.match(rules, /html\.pfp-console #dk-acts button \{ font-size:22px/);
  assert.match(dock, /const ctrls = \['dk-joy', 'dk-jump', 'bt-stance', 'bt-atk', 'btn-emote'\]/);
  assert.match(dock, /for \(const o of tries\) if \(tryAt\(o\)\) return/);
});

test('legacy sound/camera/fullscreen hooks stay in the icon container but are hidden', () => {
  const icons = html.slice(html.indexOf('id="hud-icons"'), html.indexOf('<canvas id="radar"'));
  for (const id of ['btn-sound','btn-cam','btn-full','btn-pause']) assert.ok(icons.includes(`id="${id}"`));
  assert.match(declutter, /#hud-icons > #btn-sound, #hud-icons > #btn-cam, #hud-icons > #btn-full \{ display: none !important/);
  assert.match(declutter, /#hud-icons > #btn-pause \{ width: 36px; height: 36px/);
  assert.match(css, /html\.dk-touch\.pfp-onfoot #hb-hub-btn/);
});

test('settings quick actions delegate to original buttons and sound reflects audio changes', () => {
  assert.match(html, /id="pause-quick-btns" class="row"/);
  for (const [id, target] of [['sound','sound'],['camera','cam'],['fullscreen','full']]) {
    assert.ok(html.includes(`id="pause-${id}"`));
    assert.ok(main.includes(`$('btn-${target}').click()`));
  }
  assert.match(main, /const label = a\.muted \? '🔇 MUTED' : '🔊 SOUND ON'/);
  assert.match(main, /\$\('pause-camera'\)\.onclick =[^\n]*togglePause\(\)/);
});

test('Gold is inside cap-info; Inventory is immediately after captain, never inside it', () => {
  const cap = html.slice(html.indexOf('<div id="captain">'), html.indexOf('<div id="hud-top">'));
  assert.match(cap, /class="cap-info"[\s\S]*id="hud-gold"[\s\S]*id="gold"/);
  assert.equal(html.split('id="gold"').length, 2);
  const treasure = read('js/dock/treasure.js');
  assert.match(treasure, /captain\.after\(btn\)/);
  assert.doesNotMatch(treasure, /hg\.after\(btn\)/);
  assert.match(declutter, /#captain #hud-gold \{[^}]*background: none; border: 0/);
  assert.match(declutter, /#hud-tl #tm-btn \{ font-size: 16px;[^}]*border-radius: 999px/);
});

test('Harbor hides redundant radar labels/stats, not the solo wave counters', () => {
  assert.match(declutter, /html\.dk-harbor #hud-top, html\.dk-harbor #enemies-left \{ display: none !important/);
  assert.match(declutter, /#map-loc-hud, #hud-logo \{ display: none !important/);
  assert.match(dock, /const hide = !imap\.isOpen/);
  for (const id of ['score','wave','sunk','enemies-left']) assert.ok(html.includes(`id="${id}"`));
});

function hintFixture() {
  let t = 0; const classes = new Set();
  const hint = createGameplayHint({classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}},()=>t);
  return {hint, faded:()=>classes.has('pfp-hint-faded'), at:v=>t=v};
}
test('hint starts timing only in gameplay and fades at 4.5 seconds', () => {
  const f=hintFixture(); f.at(20000); f.hint.update('title'); assert.equal(f.faded(),false);
  f.hint.update('playing'); f.at(24499); f.hint.update('playing'); assert.equal(f.faded(),false);
  f.at(24500); f.hint.update('playing'); assert.equal(f.faded(),true);
});
test('first gameplay input fades immediately, menu input does not; pause never re-arms', () => {
  const f=hintFixture(); f.hint.input('title'); assert.equal(f.faded(),false);
  f.hint.update('playing'); f.hint.input('playing'); assert.equal(f.faded(),true);
  f.hint.update('paused'); f.hint.update('playing'); assert.equal(f.faded(),true);
});
test('new voyage resets hint after game over and title', () => {
  const f=hintFixture(); f.hint.update('playing'); f.hint.input('playing');
  f.hint.update('over'); assert.equal(f.faded(),false);
  f.at(10000); f.hint.update('playing'); f.at(14499); f.hint.update('playing'); assert.equal(f.faded(),false);
  f.hint.update('title'); f.at(20000); f.hint.update('playing'); assert.equal(f.faded(),false);
});
test('hint is never interactive or visible while moored/foot/canoe/hull', () => {
  for (const cls of ['dk-moored','pfp-onfoot','pfp-canoe','pfp-inhull']) assert.ok(declutter.includes(`html.${cls} #hint`));
  assert.match(declutter, /#hint \{ pointer-events: none/);
  assert.match(declutter, /html\.pfp-hint-faded #hint \{ opacity: 0 !important/);
  assert.match(main, /gameplayHint\.update\(game.state\)/);
  assert.match(main, /addEventListener\('keydown',[\s\S]*gameplayHint\.input\(game.state\)/);
  assert.match(main, /addEventListener\('pointerdown',[\s\S]*#controls, #dk-joy, #dk-jump, #dk-acts/);
});

/* ---------- [t1838u] door-only LEAVE HULL + clean in-hull HUD ---------- */
test('t1838u #cq-leave never shown (API kept, CSS + enter() force display:none)', () => {
  assert.match(css, /#cq-leave \{ display: none !important/);
  assert.match(hull, /leaveBtn\.id = 'cq-leave'/);
  assert.match(hull, /leaveBtn/);
  assert.doesNotMatch(hull, /leaveBtn\.style\.display = 'block'/);
  assert.match(hull, /leaveBtn\.style\.display = 'none'/);
  assert.match(hull, /display:none !important/);
});

test('t1838u prompts(): OPEN STORAGE only at chest; LEAVE HULL only at exit; mid-room empty', () => {
  // exact return shapes (no LEAVE HULL on chest / mid-room)
  assert.match(hull, /if \(best\?\.tag === 'chest'\) return \{ a: \{ label: 'OPEN STORAGE', key: 'E', primary: true, tag: 'chest' \}, b: null \};/);
  assert.match(hull, /if \(best\?\.tag === 'exit'\) return \{ a: \{ label: 'LEAVE HULL', key: 'E', primary: true, tag: 'leave' \}, b: null \};/);
  assert.match(hull, /return \{ a: null, b: null \};/);
  assert.doesNotMatch(hull, /b: \{ label: 'LEAVE HULL', key: 'Q'/);
  // chest + exit radii must not overlap (QW=11.6, QD=11)
  const W = 11.6, D = 11.0;
  const chest = { x: -W / 2 + 2.25, z: -0.55, r: 2.5 };
  const exit = { x: 0, z: D / 2 - 1.35, r: 2.5 };
  const dist = Math.hypot(chest.x - exit.x, chest.z - exit.z);
  assert.ok(dist > chest.r + exit.r - 1e-9, `chest/exit overlap: dist=${dist} sum=${chest.r + exit.r}`);
  // spawn is inside the exit radius (doorway), not the chest
  const spawnZ = D / 2 - 1.55;
  assert.ok(Math.hypot(0 - exit.x, spawnZ - exit.z) < exit.r, 'spawn at doorway');
  assert.ok(Math.hypot(0 - chest.x, spawnZ - chest.z) >= chest.r, 'spawn not in chest radius');
  // mid-room (0,0) is in neither
  assert.ok(Math.hypot(0 - chest.x, 0 - chest.z) >= chest.r);
  assert.ok(Math.hypot(0 - exit.x, 0 - exit.z) >= exit.r);
});

test('t1838u dock clears #dk-acts mid-room; KeyQ cannot leave when actB is null; tag+pad on leave', () => {
  assert.match(dock, /tag: hp\.a\.tag/);
  assert.match(dock, /pad: hp\.a\.tag === 'leave' \? 'Y' : undefined/);
  assert.match(dock, /setActs\([\s\S]*null\);\s*skinPick\.close\(\);/);
  assert.match(dock, /KeyQ.*actB\?\.key === 'Q'/);
  assert.match(dock, /canLeaveHullDoor: \(\) => !!\(shipHull\?\.inHull && actA && !actA\.disabled && actA\.tag === 'leave'/);
  assert.match(dock, /leaveHullDoor: \(\) => \{ if \(game\.state === 'playing' && actA\?\.tag === 'leave'\) press\(actA\); \}/);
});

test('t1838u storage chest UI hides [data-a=leave] for ship_quarters; cottages restore it', () => {
  assert.match(houses, /activeId === SHIP_QUARTERS_ID/);
  assert.match(houses, /leaveB\.hidden = true; leaveB\.style\.display = 'none'/);
  assert.match(houses, /leaveB\.hidden = false; leaveB\.style\.display = ''; leaveB\.textContent = 'LEAVE COTTAGE'/);
});

test('t1838u html.pfp-inhull hides radar, hub, controls, hint, safe tags', () => {
  assert.match(css, /html\.pfp-inhull #radar/);
  assert.match(css, /html\.pfp-inhull #hb-hub-btn/);
  assert.match(css, /html\.pfp-inhull #controls/);
  assert.match(css, /html\.pfp-inhull #hint/);
  assert.match(css, /html\.pfp-inhull #dk-safe/);
  assert.match(css, /html\.pfp-inhull #dk-islesafe/);
});

test('t1838u controller Triangle / Y leaves only at the cabin door', () => {
  assert.equal(MAP.foot[BTN.Y], 'leaveHullDoor|map');
  assert.equal(resolve('leaveHullDoor|map', { canLeaveHullDoor: true, harbor: true }), 'leaveHullDoor');
  assert.equal(resolve('leaveHullDoor|map', { canLeaveHullDoor: false, harbor: true }), 'map');
  assert.equal(resolve('leaveHullDoor|map', { canLeaveHullDoor: false, harbor: false }), null);
  assert.match(pad, /n === 'leaveHullDoor' && !ctx\.canLeaveHullDoor/);
  assert.match(pad, /n === 'leaveHullDoor'.*D\?\.leaveHullDoor/);
  assert.match(pad, /canLeaveHullDoor: !!D\?\.canLeaveHullDoor/);
});

/* ---------- [t1839u] inventory weapon-share fits short screens ---------- */
test('t1839u inventory panel flex: grid scrolls, act bar never crushed or clipped', () => {
  const ui = read('js/inventory/ui.js');
  assert.match(ui, /#inv-panel \.iv-box\{[^}]*overflow:hidden/);
  assert.match(ui, /#inv-panel \.iv-box\{[^}]*height:calc\(100dvh - 16px - env\(safe-area-inset-top/);
  assert.match(ui, /#inv-panel \.iv-box\{[^}]*max-height:calc\(100dvh - 16px - env\(safe-area-inset-top/);
  assert.match(ui, /#inv-panel \.iv-head\{flex:none/);
  assert.match(ui, /#inv-panel \.iv-tabs\{flex:none/);
  assert.match(ui, /#inv-panel \.iv-grid\{flex:1 1 0;min-height:120px;overflow-y:auto/);
  assert.match(ui, /#inv-panel \.iv-act\{flex:none;max-height:min\(36dvh,36vh,220px\);overflow-y:auto/);
  assert.match(ui, /#inv-panel \.iv-act button\{[^}]*min-height:38px/);
  // musket-parts note trails AFTER GIVE so weapon buttons share one compact row
  assert.match(ui, /GIVE TO A PIRATE[\s\S]{0,80}\$\{note\}/);
  assert.doesNotMatch(ui, /SALVAGE[\s\S]{0,120}<small style="flex:1 1 100%/);
});

test('t1839u give-picker sheet fits short / landscape screens', () => {
  const gp = read('js/inventory/givePick.js');
  assert.match(gp, /\.gp-box\{[^}]*overflow:hidden/);
  assert.match(gp, /\.gp-box\{[^}]*max-height:calc\(100dvh - 20px - env\(safe-area-inset-top/);
  assert.match(gp, /\.gp-ok\{[^}]*max-height:calc\(100dvh - 20px - env\(safe-area-inset-top/);
  assert.match(gp, /\.gp-list\{flex:1 1 auto;min-height:0;overflow-y:auto/);
  assert.match(gp, /@media \(max-height:620px\)/);
});

/* ---------- [t1840u] phone + PC + controller inventory / HUD ---------- */
test('t1840u phone portrait + short landscape media rules keep act bar + scrolling grid', () => {
  const ui = read('js/inventory/ui.js');
  assert.match(ui, /max-height:calc\(100dvh - 16px - env\(safe-area-inset-top/);
  assert.match(ui, /@media \(max-width:640px\)/);
  assert.match(ui, /@media \(max-height:520px\)/);
  assert.match(ui, /max-height:520px[\s\S]*grid-template-columns:repeat\(8/);
  assert.match(ui, /max-height:520px[\s\S]*max-height:44dvh/);
  assert.match(ui, /max-height:520px[\s\S]*min-height:32px/);
  assert.match(ui, /max-width:640px[\s\S]*grid-template-columns:repeat\(4/);
  assert.match(ui, /max-width:640px[\s\S]*min-height:36px/);
  assert.match(ui, /html\.pfp-pad #inv-panel \.iv-slot\.pad-focus/);
});

test('t1840u give-picker safe-area + data-ok / data-pick for layered controller nav', () => {
  const gp = read('js/inventory/givePick.js');
  const pad = read('js/gamepad.js');
  assert.match(gp, /max-height:calc\(100dvh - 20px - env\(safe-area-inset-top/);
  assert.match(gp, /\.gp-list\{flex:1 1 auto;min-height:0;overflow-y:auto/);
  assert.match(gp, /data-ok="yes"/);
  assert.match(gp, /data-ok="no"/);
  assert.match(gp, /data-pick/);
  assert.match(gp, /data-x/);
  assert.match(gp, /@media \(max-height:520px\)/);
  // gamepad layers: confirm → pick → inventory (B backs out one layer)
  assert.match(pad, /#iv-pick-ok', '#iv-pick', '#inv-panel'/);
  assert.match(pad, /\.iv-slot/);
  assert.match(pad, /\[data-ok="yes"\]/);
  assert.match(pad, /scrollIntoView\(\{ block: 'nearest'/);
  assert.match(pad, /\[data-a="cancelmove"\]/); // B cancels MOVE before closing inventory
  assert.match(pad, /\[data-ok="no"\]/); // B on confirm → BACK, keeps #inv-panel
  assert.match(read('js/dock/index.js'), /data-a="cancelmove"/);
});

test('t1840u HUD: touch keeps sea controls; pad/desktop compact; safe-area acts', () => {
  const declutter = read('css/style.css').slice(read('css/style.css').indexOf('/* [v350]'));
  const dock = read('js/dock/index.js');
  assert.match(declutter, /html:is\(\.pfp-desktop,\.pfp-pad,\.pfp-console\) #steer-left/);
  assert.match(declutter, /html:is\(\.pfp-desktop,\.pfp-pad,\.pfp-console\) #controls/);
  assert.match(dock, /var\(--safe-b/);
  assert.match(dock, /html\.pfp-pad #dk-acts/);
  // touch phones are NOT forced into compact-hide of steer (only desktop/pad/console)
  assert.doesNotMatch(declutter, /html\.dk-touch #steer-left \{ display: none/);
});
