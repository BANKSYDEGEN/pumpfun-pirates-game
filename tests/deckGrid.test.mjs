// [perf-plaza] areaDeckAt's deck grid: same answer as the full scan, &deckgrid=0 kill switch
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/island/foot.js', import.meta.url), 'utf8');
test('areaDeckAt walks decksNear (grid) with a full-scan kill switch', () => {
  assert.match(src, /export function areaDeckAt\(x, z\) \{ let y = null; for \(const d of decksNear\(x, z\)\)/);
  assert.match(src, /deckgrid=0/); assert.match(src, /if \(!DG\.on\) return AREA_DECKS;/); assert.match(src, /DG\.n !== AREA_DECKS\.length/);
});
