// [br-death] sunk in SOLO / SQUADS: lose min(100, gold), pile = loss + 100 bonus (+ bounty), back to the harbor
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PVP_DEATH_BONUS, PVP_BR_DEATH_LOSS } from '../js/config.js';
const src = readFileSync(new URL('../js/pvp.js', import.meta.url), 'utf8');
const brLoss = (g) => Math.min(PVP_BR_DEATH_LOSS, Math.max(0, Math.floor(+g || 0)));
test('flat loss values', () => {
  assert.equal(PVP_BR_DEATH_LOSS, 100); assert.equal(PVP_DEATH_BONUS, 100);
  for (const [g, l] of [[0, 0], [40, 40], [100, 100], [5000, 100], [-5, 0]]) { assert.equal(brLoss(g), l); assert.ok(g - l >= 0 || g < 0); }
  assert.equal(brLoss(5000) + PVP_DEATH_BONUS, 200);
});
test('pvp.js uses the flat loss everywhere a pirate death takes gold', () => {
  assert.ok(src.includes('const brLoss = (g) => Math.min(PVP_BR_DEATH_LOSS'));
  assert.equal((src.match(/game\.gold = 0/g) || []).length, 0, 'no death wipes all gold');
  assert.equal((src.match(/brLoss\(game\.gold\)/g) || []).length, 2, 'sunk + combat log');
  assert.ok(src.includes('Math.min(PVP_BR_DEATH_LOSS, earned.has(m.v)'), 'host caps a peer drop at the flat loss');
});
test('SOLO death goes back to the harbor; SQUADS keeps watching the teammate', () => {
  assert.ok(/where === 'arena' && !me\.aiDeath && !isSq\(\)\) \{ lobbyCall\('leave'\); toHarbor\(/.test(src));
  assert.ok(!src.includes("lobbyCall('died').then((r) => {\n      if (r.state === 'queue') { lob.queuedByDeath = true; const q"), 'no death-rotation queue');
  assert.ok(src.includes("isSq() ? 'Watching your teammate.' : 'Back to the harbor.'"));
  assert.ok(src.includes('if (isSq()) { sq.sunk.add(myId); me.respawn = Infinity;'), 'squads: out for the round');
});
