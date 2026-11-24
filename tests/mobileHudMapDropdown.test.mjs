// [mobile-hud] BANKSY t2749u: ⚙ centred in its circle; rotate hint below the HUD row;
// on phones the ON THIS SERVER list is a top drop-down (▾ / ▴), and the map fills the screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const css = src('css/style.css'), social = src('js/social.js'), imap = src('js/islandMap.js');
const block = css.slice(css.indexOf('/* [mobile-hud] BANKSY t2749u'));

test('t2749u block centres the gear and drops the rotate hint below the HUD row', () => {
  assert.ok(block.length > 400, 't2749u CSS missing');
  assert.match(block, /#hud-icons > #btn-pause \{/);
  assert.match(block, /padding: 0 !important/);
  assert.match(block, /letter-spacing: 0 !important/);
  assert.match(block, /line-height: 1 !important/);
  assert.match(block, /font-variant-emoji: text/);
  assert.match(block, /display: flex !important/);
  assert.match(block, /align-items: center/);
  assert.match(block, /justify-content: center/);
  assert.match(block, /#rotate\.show \{[^}]*top: calc\(var\(--safe-t, 0px\) \+ 200px\)/s);
  assert.match(block, /html\.isle-map-open #rotate \{ display: none !important/);
  // winning rotate top is 200px, not the old 104px
  const lastTop = [...css.matchAll(/#rotate\.show \{[^}]*top: ([^;]+);/gs)].at(-1);
  assert.ok(lastTop); assert.match(lastTop[1], /200px/);
});

test('on phones the ON THIS SERVER panel is a full-width top drop-down, not a 42vw column', () => {
  assert.match(block, /@media \(max-width: 700px\)/);
  assert.match(block, /html\.isle-map-open #soc-panel,\s*html\.isle-map-open #soc-panel\.fold \{/s);
  assert.match(block, /left: calc\(8px \+ var\(--safe-l, 0px\)\)/);
  assert.match(block, /right: calc\(8px \+ var\(--safe-r, 0px\)\)/);
  assert.match(block, /bottom: auto !important/);
  assert.match(block, /width: auto !important/);
  // the 42vw column is no longer the last word
  const lastWidth = [...css.matchAll(/html\.isle-map-open #soc-panel[^{]*\{[^}]*width:([^;]+);/gs)].at(-1);
  assert.ok(lastWidth); assert.doesNotMatch(lastWidth[1], /42vw/);
});

test('header stays "ON THIS SERVER (N)" and the arrow flips ▾ collapsed / ▴ open', () => {
  assert.match(social, /👥 ON THIS SERVER <span class="sp-c"><\/span>/);
  assert.match(social, /b\.textContent = fold \? '▾' : '▴'/);
  assert.match(social, /setAttribute\('aria-expanded', String\(!fold\)\)/);
  assert.match(social, /querySelector\('\.sp-h'\)\.addEventListener\('click'/);
  assert.match(social, /if \(panel\._isPhoneMap\?\.\(\)\) panel\._setFold\?\.\(true, false\)/);
});

test('phone map fit ignores the friends panel so the chart can fill the canvas', () => {
  assert.match(imap, /matchMedia\('\(max-width: 700px\)'\)\.matches/);
  assert.match(imap, /socialRect = \(!phoneMap && panel && !panel\.hidden\) \? panel\.getBoundingClientRect\(\) : null/);
});

test('legend is a details drop-down on phones and stays an always-open row on desktop', () => {
  assert.match(imap, /<details class="im-key"><summary class="im-legend-toggle">Legend<\/summary>/);
  assert.match(imap, /legend\.open = innerWidth > 700/);
  assert.match(block, /#isle-map \.im-legend-toggle \{ display: none/);
  assert.match(block, /@media \(max-width: 700px\)[\s\S]*#isle-map \.im-legend-toggle \{[\s\S]*display: flex/);
  assert.match(block, /#isle-map \.im-key \{ max-height: none; font-size: 13px/);
});

test('on phones the ☰ buildings tab sits fully below the ON THIS SERVER drop-down', () => {
  assert.match(block, /html\.isle-map-open #isle-map \.im-building-key \{ margin-top: 60px/);
});
