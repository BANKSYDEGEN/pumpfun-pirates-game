// node --test tests/   (Node 18+). [security] validators, escaping and the transport's peer filter.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.location = { hostname: 'localhost', search: '', protocol: 'http:', origin: 'http://localhost' };
const { escHtml, isNetId, safeMerge, num, isBase58 } = await import('../js/safe.js');

test('escHtml escapes every HTML-significant character', () => {
  assert.equal(escHtml(`<img src=x onerror="alert('1')">&\``), '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;&#96;');
  assert.equal(escHtml(null), ''); assert.equal(escHtml(42), '42');
});
test('XSS payloads stay inert inside a double-quoted attribute and in text', () => {
  const payloads = ['"><svg onload=alert(1)>', "'><img src=x onerror=alert(1)>", '" autofocus onfocus="alert(1)', '`-alert(1)-`', '</tr><script>alert(1)</script>'];
  for (const p of payloads) {
    const html = `<tr data-id="${escHtml(p)}"><td>${escHtml(p)}</td></tr>`;
    assert.ok(!/[<>"'`]/.test(escHtml(p)), p);
    assert.equal((html.match(/</g) || []).length, 4, 'no extra tags: ' + p); // only <tr> <td> </td> </tr>
    assert.equal((html.match(/"/g) || []).length, 2, 'attribute not broken: ' + p);
  }
});
test('isNetId accepts real ids only', () => {
  const myId = Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 6); // js/pvp.js
  for (const ok of [myId, 'b12abcd', 'abcdef', 'a'.repeat(20)]) assert.ok(isNetId(ok), ok);
  for (const bad of ['"><svg', 'abc', 'a'.repeat(21), 'ABCDEF', 'abc-def', 'abc def', '', null, 12345678, {}, ['abcdef'], '__proto__']) assert.ok(!isNetId(bad), String(bad));
});
test('safeMerge never touches prototypes', () => {
  const src = JSON.parse('{"x":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"p2":1}},"prototype":3}');
  const t = safeMerge(Object.create(null), src);
  assert.equal(t.x, 1); assert.equal(Object.getPrototypeOf(t), null);
  assert.equal({}.polluted, undefined); assert.equal({}.p2, undefined); assert.ok(!('constructor' in t)); assert.ok(!('prototype' in t));
  assert.equal(safeMerge({ a: 1 }, null).a, 1); assert.equal(safeMerge({ a: 1 }, [1, 2]).a, 1);
});
test('num / isBase58', () => {
  assert.equal(num('12'), 12); assert.equal(num('<b>'), 0); assert.equal(num(Infinity, 5), 5);
  assert.ok(isBase58('By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump')); assert.ok(!isBase58('javascript:alert(1)')); assert.ok(!isBase58('0OIl' + 'a'.repeat(30)));
});
test('transport Batcher drops bad ids and __proto__ keys from peers', async () => {
  globalThis.WebSocket = class {};
  const { Batcher } = await import('../js/transport.js');
  const b = new Batcher('me0000000', { hz: 4, soloHz: 1, keepalive: 1.5 }, () => true); b.stop();
  const seen = []; b.on('s', (p, from) => seen.push(['s', p, from])).on('hit', (p, from) => seen.push(['hit', p, from]));
  b.receive({ i: '"><svg onload=alert(1)>', s: { n: 'x' } });           // markup id: dropped
  b.receive({ i: 'ABCDEFG', s: { n: 'x' } });                          // wrong charset: dropped
  b.receive(JSON.parse('{"i":"peer01","s":{"n":"ok","__proto__":{"evil":1}},"e":[["hit",{"s":"peer01","h":[]}],["hit",[1,2]],["hit","str"]]}'));
  assert.equal(seen.length, 2);
  assert.equal(seen[0][0], 's'); assert.equal(seen[0][1].n, 'ok'); assert.equal(seen[0][1].evil, undefined); assert.equal(seen[0][2], 'peer01');
  assert.equal(seen[1][0], 'hit'); assert.equal(seen[1][2], 'peer01');
  assert.equal({}.evil, undefined);
});
