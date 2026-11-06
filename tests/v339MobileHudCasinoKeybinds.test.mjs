// [v339] BANKSY t1792u–t1795u: mobile stability, keybind de-clash, Play & Servers hub, decluttered mobile HUD, mobile Casino
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIONS, isKey, binds, anyModalOpen, closeTopModal } from '../js/keybinds.js';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('v339 sw.js is pfp-v339 with pooled install + phone-heavy captains_quarters', () => {
  const SW = src('sw.js');
  assert.ok(+(SW.match(/VERSION = 'pfp-v(\d+)'/) || [])[1] >= 339); // [v341] later builds keep the v339 behaviour
  assert.match(SW, /const POOL = 8/);
  assert.match(SW, /async function pool\(/);
  assert.match(SW, /oldCaches = await Promise\.all/);
  assert.ok(SW.includes('captains_quarters.glb'));
  assert.match(SW, /heavy = \(u\)/);
  assert.match(SW, /phone && heavy\(u\)/);
});

test('v339 mobile memory: shipHull / houses / pirateGLB low-mem paths', () => {
  const hull = src('js/dock/shipHull.js');
  assert.match(hull, /QUARTERS_LOW_MEM/);
  assert.match(hull, /setWorkerLimit\(1\)/);
  assert.match(hull, /releaseQuartersAssets/);
  assert.match(hull, /if \(!QUARTERS_LOW_MEM\) preloadQuartersGlb/);
  const houses = src('js/dock/houses.js');
  assert.match(houses, /HOUSES_LOW_MEM/);
  assert.match(houses, /preloadCabinAssets\(\{ boot: true \}\)/);
  assert.match(houses, /boot && HOUSES_LOW_MEM/);
  assert.match(houses, /disposeRoom/);
  assert.match(src('js/pirateGLB.js'), /setWorkerLimit\(2\)/);
});

test('v339 WebGL loss preventDefault + Harbor resume helpers', () => {
  const main = src('js/main.js');
  assert.match(main, /webglcontextlost[\s\S]*e\.preventDefault\(\)/);
  assert.match(main, /pfp_harbor_resume_v1/);
  assert.match(main, /harborResumeBoot/);
  assert.match(main, /harborResumeClear/);
  assert.match(main, /applyResume/);
  assert.match(src('js/pvp.js'), /harborInfo:\s*\(\)\s*=>/);
  assert.match(src('js/pvp.js'), /resumeServer:/);
  assert.match(src('js/dock/index.js'), /resumeState:/);
  assert.match(src('js/dock/index.js'), /applyResume:/);
  assert.match(src('js/boot.js'), /benign/);
});

test('v339 keybinds: weapon + inventory actions, CTX separates sea/foot Q E Space', () => {
  const ids = ACTIONS.map((a) => a[0]);
  assert.ok(ids.includes('weapon'));
  assert.ok(ids.includes('inventory'));
  assert.deepEqual(binds('weapon'), ['KeyQ', '']);
  assert.deepEqual(binds('inventory'), ['KeyI', '']);
  assert.ok(isKey('menu', 'Tab'));
  assert.ok(!isKey('weapon', 'Tab'));
  const kb = src('js/keybinds.js');
  assert.match(kb, /firePort: 'sea'/);
  assert.match(kb, /weapon: 'foot'/);
  assert.match(kb, /anyModalOpen/);
  assert.match(kb, /closeTopModal/);
  assert.match(kb, /installModalKeyIsolation/);
});

test('v339 Tab no longer cycles stance; Q does; Enter Hull keeps H; Hide HUD gated', () => {
  const b = src('js/onfoot/battle.js');
  assert.match(b, /isKey\('weapon', e\.code\)/);
  assert.doesNotMatch(b, /if \(e\.code === 'Tab'\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); cycleStance/);
  assert.match(src('js/dock/index.js'), /label: 'ENTER HULL', key: 'H'/);
  assert.match(src('js/hudHide.js'), /ENTER HULL/);
  assert.match(src('js/dock/index.js'), /isKey\('inventory'/);
  assert.match(src('js/dock/index.js'), /pfp-tedit/);
  assert.match(src('js/gamepad.js'), /case 'weapon': return 'KeyQ'/);
});

test('v339 Play & Servers hub pill + modal; #srv-btn never display:none in compact', () => {
  const hc = src('js/harborCard.js');
  assert.match(hc, /hb-hub-btn/);
  assert.match(hc, /hb-modal-open/);
  assert.match(hc, /PLAY &/);
  const css = src('css/style.css');
  assert.match(css, /#hb-hub-btn/);
  assert.match(css, /html\.pvp-harbor #hud-top/);
  assert.match(css, /#pvp-harbor #srv-btn/);
  assert.match(css, /#pvp-harbor\.ph-compact #srv-btn/);
  assert.match(css, /max-width:\s*330px/);
  assert.doesNotMatch(src('js/serverPicker.js'), /#pvp-harbor\.ph-compact #srv-btn\{display:none/);
  assert.match(src('js/serverPicker.js'), /SWITCH \/ PRIVATE SERVER/);
});

test('v339 casino mobile CSS: no backdrop blur on coarse, fluid 13-col board, landscape compact', () => {
  const ui = src('js/casino/ui.js');
  assert.match(ui, /pointer:coarse/);
  assert.match(ui, /backdrop-filter:none/);
  assert.match(ui, /touch-action:manipulation|overscroll-behavior:contain/);
  assert.match(ui, /max-height:540px/);
  assert.match(ui, /grid-template-columns:repeat\(13,minmax\(0,1fr\)\)/);
  assert.match(ui, /grid-template-columns:repeat\(4,/);
  assert.match(ui, /cas-reel\{[^}]*height:1[4568]0px/);
});

test('v339 anyModalOpen / closeTopModal work against a tiny DOM stub', () => {
  const els = {};
  globalThis.document = {
    documentElement: { classList: { contains: () => false, remove() {}, add() {} } },
    getElementById(id) { return els[id] || null; },
    querySelector() { return null; },
  };
  els['inv-panel'] = { classList: { _c: new Set(['on']), contains(c) { return this._c.has(c); }, remove(c) { this._c.delete(c); }, add(c) { this._c.add(c); } } };
  assert.equal(anyModalOpen(), true);
  assert.equal(closeTopModal(), true);
  assert.equal(anyModalOpen(), false);
});

test('v339 t1800u Solo Arena maxArena 8 + Batcher.hz auto-scales 1..8 ships under scaleBudget 76.8', async () => {
  const { PVP_NET, SQUADS } = await import('../js/config.js');
  assert.equal(PVP_NET.supabase.maxArena, 8);
  assert.equal(PVP_NET.supabase.scaleBudget, 76.8);
  assert.equal(PVP_NET.supabase.minHz, 1);
  assert.equal(PVP_NET.supabase.keepalive, 2);
  assert.equal(SQUADS.size, 2);
  assert.equal(SQUADS.players, 4); // SQUADS stays 2v2 / cap 4
  const { Batcher } = await import('../js/transport.js');
  const b = new Batcher('me00000001', PVP_NET.supabase, () => true); b.stop();
  assert.equal(b.hz(), 1);
  const expect = { 1: 4, 2: 4, 3: 4, 4: 3.072, 5: 2.133, 6: 1.567, 7: 1.2 }; // heard peers => ships = heard+1
  for (const [heard, hz] of Object.entries(expect)) {
    b.heardAt.clear();
    const n = +heard;
    for (let i = 0; i < n; i++) b.heardAt.set('p' + i, performance.now());
    assert.equal(b.hz(), hz, `heard=${n} ships=${n + 1}`);
    const ships = n + 1, msgs = ships * b.hz() * ships;
    assert.ok(msgs <= 80.01, `msgs ${msgs} at ${ships}p`);
  }
  b.heardAt.clear(); for (let i = 0; i < 7; i++) b.heardAt.set('p' + i, performance.now());
  b.specs = 1;
  const hz8s = b.hz();
  assert.ok(hz8s <= 1.2);
  assert.ok(8 * hz8s * 9 <= 80.01, `8p+1spec msgs ${8 * hz8s * 9}`);
  const tx = src('js/transport.js'), pvp = src('js/pvp.js'), mig = src('supabase/migrations/051_arena_cap_8_autoscale.sql');
  assert.match(tx, /scaleBudget/);
  assert.match(pvp, /mode === 'squads' \? SQUADS\.players : net\.cfg\.maxArena/);
  assert.match(pvp, /room\.specs = lob\.specs/);
  assert.match(pvp, /step \* 1\.35/);
  assert.match(mig, /pvp_arena_hz/);
  assert.match(mig, /pfp-pvp-v1' then 8/);
  assert.match(mig, /pfp-pvp-v1sq' then 4/);
});
