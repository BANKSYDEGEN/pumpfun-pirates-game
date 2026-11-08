import test from 'node:test';
import assert from 'node:assert/strict';
import { pillyEnabledFor } from '../js/features.js';
import { readFileSync } from 'node:fs';
test('Pilly disabled on touch phones, tablets and coarse-pointer devices', () => {
  assert.equal(pillyEnabledFor({ navigator: { maxTouchPoints: 5 } }), false);
  assert.equal(pillyEnabledFor({ matchMedia: () => ({ matches: true }) }), false);
  assert.equal(pillyEnabledFor({ window: { ontouchstart: null } }), false);
});
test('emergency pause disables desktop Pilly too', () => {
  assert.equal(pillyEnabledFor({ navigator: { maxTouchPoints: 0 }, matchMedia: () => ({ matches: false }), window: {} }), false);
});
test('disabled feature guards both companion construction and purchase entry points', () => {
  const text = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  assert.match(text('js/dock/index.js'), /!PILLY_ENABLED.*\? null : createPilly/);
  assert.match(text('js/dock/index.js'), /if \(PILLY_ENABLED\) \{ pillyS = createPillyState/);
  assert.match(text('js/petsPanel.js'), /PILLY_ENABLED \?/);
});
