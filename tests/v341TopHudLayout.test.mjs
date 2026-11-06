// [v341] BANKSY t1808u: sound / camera / settings / fullscreen row in the TOP MIDDLE, minimap flush in the TOP RIGHT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const css = src('css/style.css'), html = src('index.html'), dock = src('js/dock/index.js');
const v341 = css.slice(css.indexOf('[v341] BANKSY t1808u'));

test('sw.js is pfp-v341', () => { assert.match(src('sw.js'), /const VERSION = 'pfp-v341';/); });

test('#hud-icons stays inside #hud-tr (every hide rule still applies) but is fixed to the top centre', () => {
  const tr = html.slice(html.indexOf('<div id="hud-tr">'), html.indexOf('<div id="controls">'));
  assert.match(tr, /id="hud-icons"/); assert.match(tr, /id="btn-sound"/); assert.match(tr, /id="radar"/);
  assert.ok(v341.length > 200, 'v341 block present');
  assert.match(v341, /#hud-icons \{ position: fixed; left: 50%;[^}]*top: calc\(10px \+ var\(--safe-t, 0px\)\); transform: translateX\(-50%\)/);
  assert.match(v341, /html\.hud-hide #hud-icons \{ visibility: hidden !important/);
  assert.match(css, /html\.hud-hide #hud-tl, html\.hud-hide #hud-tr, html\.hud-hide #hud-icons/);
});

test('the minimap column (#hud-tr) is flush top-right; PLAY · HARBOR sits under the icon row', () => {
  assert.match(v341, /#hud-tr \{ top: calc\(10px \+ var\(--safe-t, 0px\)\) !important; right: calc\(10px \+ var\(--safe-r, 0px\)\) !important; \}/);
  assert.match(v341, /#hud-tr \{ top: calc\(6px \+ var\(--safe-t, 0px\)\) !important; right: calc\(8px \+ var\(--safe-r, 0px\)\) !important; \}/);
  assert.match(v341, /#hb-hub-btn, \.hb-hub-btn \{ top: calc\(62px \+ var\(--safe-t, 0px\)\)/); // desktop: below the 44px icon row
  assert.match(v341, /#hb-hub-btn, \.hb-hub-btn \{ top: calc\(46px \+ var\(--safe-t, 0px\)\) !important/); // phones: below the 34px row
});

test('phones upright: the icon row + pill live between the captain card and the radar (390 + 360 widths)', () => {
  const p = v341.slice(v341.indexOf('@media (orientation: portrait) and (max-width: 600px)'));
  assert.match(p, /#hud-icons \{ left: calc\(156px \+ var\(--safe-l, 0px\)\); right: calc\(8px \+ 104px \+ 6px \+ var\(--safe-r, 0px\)\); transform: none/);
  assert.match(p, /#hud-tl \{ max-width: 152px !important; \}/);
  const n = v341.slice(v341.indexOf('@media (orientation: portrait) and (max-width: 380px)'));
  assert.match(n, /#radar \{ width: 92px !important; height: 92px !important; \}/);
  assert.match(n, /#hud-icons > button\.icon \{ width: 29px; height: 29px;/);
  // 3 phone icons (29px + 3px gaps) fit the 360px gap: 360 - 150 - (8 + 92 + 4) = 106 >= 3*29 + 2*3
  assert.ok(360 - 150 - (8 + 92 + 4) >= 3 * 29 + 2 * 3);
  assert.ok(390 - 156 - (8 + 104 + 6) >= 3 * 32 + 2 * 4);
});

test('grace countdown / battle HUD sit under the top-centre stack; on-foot pill placement avoids the new spots', () => {
  assert.match(v341, /#dk-islesafe \{ top: calc\(var\(--safe-t, 0px\) \+ 104px\) !important; \}/);
  assert.match(v341, /#bt-hud \{ top: calc\(var\(--safe-t, 0px\) \+ 104px\) !important; \}/);
  assert.match(dock, /const extra = \['radar', 'tps-ads', 'tps-sw', 'bt-stance', 'btn-sound', 'btn-cam', 'btn-pause', 'btn-full', 'captain', 'hb-hub-btn'/);
  assert.match(dock, /html\.pfp-onfoot\.dk-touch\.tps-on #tps-sw\{bottom:calc\(var\(--safe-b,0px\) \+ 210px\)!important\}/);
});
