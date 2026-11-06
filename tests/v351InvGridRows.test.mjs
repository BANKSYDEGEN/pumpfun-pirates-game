// [v351] inventory grid rows must NOT collapse/overlap when the panel is short (BANKSY t1839u/t1840u regression after v350 flex fit)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../js/inventory/ui.js', import.meta.url), 'utf8');
const css = ui.slice(ui.indexOf('const CSS'), ui.indexOf('`;', ui.indexOf('const CSS')) + 2);

test('v351: .iv-grid uses FIXED grid-auto-rows so slots scroll instead of squashing', () => {
  assert.match(css, /#inv-panel \.iv-grid\{[^}]*grid-auto-rows:76px/);
  assert.match(css, /#inv-panel \.iv-grid\{[^}]*overflow-y:auto/);
  assert.match(css, /#inv-panel \.iv-grid\{[^}]*align-content:start/);
  assert.match(css, /#inv-panel \.iv-slot\{[^}]*height:100%/);
  assert.match(css, /#inv-panel \.iv-act\{flex:none/);
  // no aspect-ratio + min-height:0 trap that collapsed rows in v350 landscape
  assert.doesNotMatch(css, /max-height:520px[\s\S]*#inv-panel \.iv-slot\{min-height:0/);
});

test('v351: desktop 8-col fixed 84px rows', () => {
  assert.match(css, /min-width:900px[\s\S]*grid-auto-rows:84px/);
});

test('v351: phone portrait 4-col fixed 78px rows', () => {
  assert.match(css, /max-width:640px[\s\S]*grid-auto-rows:78px/);
});

test('v351: short landscape — 10-col 52px rows, compact EQUIPPED, act bar still fits', () => {
  const land = css.slice(css.indexOf('@media (max-height:520px)'));
  assert.match(land, /grid-template-columns:repeat\(10/);
  assert.match(land, /grid-auto-rows:52px/);
  assert.doesNotMatch(land, /grid-auto-rows:minmax/);
  assert.match(land, /#inv-panel \.iv-eqs \.iv-slot\{width:48px;height:48px/);
  assert.match(land, /#inv-panel \.iv-eqs \.iv-acc\{width:40px;height:40px/);
  assert.match(land, /#inv-panel \.iv-eqs>small\{font-size:13px/);
  assert.match(land, /\.iv-act\{flex:none/);
  assert.match(land, /max-height:38dvh/);
});

test('v351: Brass Scope zoom helpers still present (same release)', () => {
  const math = readFileSync(new URL('../js/onfoot/tpsMath.js', import.meta.url), 'utf8');
  assert.match(math, /scopeZoom:\s*3/);
  assert.match(math, /export const adsZoom/);
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(+((sw.match(/VERSION = 'pfp-v(\d+)'/) || [])[1]) >= 351);
});
