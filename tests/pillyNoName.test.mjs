import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
test('Pilly cannot be named (t2341u)', () => {
  const s = readFileSync('js/onfoot/pilly.js', 'utf8'), e = readFileSync('js/pillyEntries.js', 'utf8');
  assert.ok(!/RENAME|data-a="name"|placeholder="Name"/.test(s)); assert.ok(!/NAME/.test(e)); assert.match(s, /nm = 'Pilly'/);
});
