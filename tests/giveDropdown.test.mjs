// node --test tests/   [give-dropdown] the inventory GIVE picker: who it lists and in what order, the typed-name fallback stays, pad layers
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { pickList } = await import('../js/inventory/givePick.js');
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('your harbor first (A-Z), then everyone else online (A-Z); never you; no duplicates; PIRATE + junk dropped', () => {
  const l = pickList({ harbor: ['zed', 'Anne', 'PIRATE', 'Me'], online: [{ n: 'bob', w: 'arena' }, { n: 'anne', w: 'harbor' }, { n: 'Carl', w: 'harbor' }, { n: 'me', w: 'harbor' }, { n: '' }], me: 'ME' });
  assert.deepEqual(l.map(p => [p.n, p.here]), [['Anne', true], ['zed', true], ['bob', false], ['Carl', false]]);
  assert.equal(l.find(p => p.n === 'bob').w, 'arena');
});
test('search filters (case-insensitive, anywhere in the name)', () => {
  const l = pickList({ harbor: ['Anne Bonny'], online: [{ n: 'Bonnet' }, { n: 'Calico Jack' }], q: 'BON' });
  assert.deepEqual(l.map(p => p.n), ['Anne Bonny', 'Bonnet']);
});
test('inventory GIVE opens the picker; the typed name stays as a fallback; a confirm step before inv_gift', () => {
  const ui = src('js/inventory/ui.js'), gp = src('js/inventory/givePick.js');
  assert.match(ui, /data-a="give"[^>]*>GIVE TO A PIRATE/); assert.match(ui, /picker\.open\(/); assert.doesNotMatch(ui, /class="to" list="iv-near"/);
  assert.match(gp, /data-typed="1"/); assert.match(gp, /inv_online/); assert.match(gp, /No other pirates online/); assert.match(gp, /gp-sk/); assert.match(gp, /data-b="give"/);
});
test('controller: the picker + its confirm are focus layers above the inventory', () => {
  const g = src('js/gamepad.js'), i = (s) => g.indexOf(`'${s}'`);
  assert.ok(i('#iv-pick-ok') > 0 && i('#iv-pick-ok') < i('#iv-pick') && i('#iv-pick') < i('#inv-panel'));
});

test('[gift-fix] a harbor name maps to its one unique registered online name', async () => {
  const { pickList } = await import('../js/inventory/givePick.js');
  const r = pickList({ harbor: ['Trav The Tracker', 'Bob'], online: [{ n: 'Trav The Track #1545', w: 'harbor' }, { n: 'Bob', w: 'harbor' }], me: 'me' });
  const t = r.find((p) => p.n === 'Trav The Tracker'); if (!t || t.to !== 'Trav The Track #1545' || !t.here) throw new Error(JSON.stringify(r));
  if (r.length !== 2 || r.find((p) => p.n === 'Bob').to) throw new Error('dup / bob ' + JSON.stringify(r));
  const amb = pickList({ harbor: ['Trav The Tracker'], online: [{ n: 'Trav The Track #1' }, { n: 'Trav The Track #2' }] });
  if (amb[0].to) throw new Error('ambiguous must not map');
});
