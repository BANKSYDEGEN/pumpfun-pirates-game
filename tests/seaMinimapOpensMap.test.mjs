// [sea-map] BANKSY t2739u: tap / click the minimap at sea opens the full island map (it only worked on foot);
// while the map is open the keyboard never steers / sails / anchors / fires the ship.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('ship radar is tappable at sea (isle-tap on when sailing in the harbor, not only on foot)', () => {
  const d = src('js/dock/index.js');
  assert.match(d, /radarEl\?\.classList\.toggle\('isle-tap', !!\(ok \|\| \(on && !onFoot && game\.state === 'playing'\)\)\)/);
  // the tap handler still opens the same full map (M / controller map button share openIsleMap)
  assert.match(d, /radarEl\?\.addEventListener\('pointerdown'[^\n]*openIsleMap\(\)/);
  assert.match(src('css/style.css'), /#radar\.isle-tap \{ pointer-events: auto !important;/);
});

test('full map open = no helm input from the keyboard', () => {
  const m = src('js/main.js');
  assert.match(m, /const seaMapOpen = \(\) => [^\n]*classList\.contains\('isle-map-open'\)/);
  assert.match(m, /const helmOff = shipLocked\(\) \|\| seaMapOpen\(\);/);
  assert.match(m, /const turn = helmOff \|\| seaMapOpen\(\) \? 0 :/);
});

test('full map shows YOUR LOCATION from the ship when at sea', () => {
  assert.match(src('js/islandMap.js'), /const who = st\.me \|\| st\.ship \|\| null/);
});

test('controller: the sea layer keeps its map button', () => {
  assert.match(src('js/gamepad.js'), /sea: \{[^\n]*\[BTN\.TOUCHPAD\]: 'map'/);
});
