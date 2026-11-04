// [webgl-card] the "can't run the 3D sea" card: only after webgl2 + webgl1 both fail for ~3 s, the real reason logged, RELOAD on a PC
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/boot.js', import.meta.url), 'utf8');
function run(ctxs, ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130') { // ctxs: per getContext call, true = a context
  let i = 0; const timers = [], logs = [], panel = { innerHTML: '' }; let reloads = 0;
  const g = { getExtension: () => ({ loseContext() {} }) };
  const doc = { readyState: 'complete', documentElement: { classList: { add() {} } }, createElement: () => ({ addEventListener() {}, getContext: () => (ctxs[i++] ? g : null) }),
    querySelector: () => panel, getElementById: () => ({ addEventListener() {}, classList: { contains: () => false } }), addEventListener() {} };
  const win = {}; const loc = { search: '', hostname: 'game.pumpfunpirates.com', reload: () => reloads++ };
  new Function('window', 'document', 'location', 'navigator', 'sessionStorage', 'setTimeout', 'addEventListener', 'console', 'matchMedia', 'caches', src)(
    win, doc, loc, { userAgent: ua, standalone: false }, { getItem: () => null, setItem() {}, removeItem() {} }, (f) => timers.push(f), () => {}, { error: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')) }, () => ({ matches: false }), undefined);
  for (let k = 0; k < 50 && timers.length; k++) { const f = timers.shift(); f(); }
  return { panel, logs, reloads, failHeld: !!win.__pfpBootFail };
}
test('webgl2 ok: no card, no reload', () => { const r = run([true]); assert.equal(r.panel.innerHTML, ''); assert.equal(r.reloads, 0); });
test('webgl2 missing, webgl1 ok (older PC): no card', () => { const r = run([false, true]); assert.equal(r.panel.innerHTML, ''); });
test('GPU process restarting: back on a retry = reload, no card', () => { const r = run([false, false, false, false, false, false, true]); assert.equal(r.panel.innerHTML, ''); assert.equal(r.reloads, 1); });
test('really no WebGL on a PC: card with RELOAD + restart hint, reason logged', () => { const r = run(new Array(40).fill(false));
  assert.match(r.panel.innerHTML, /can't run the 3D sea/); assert.match(r.panel.innerHTML, /boot-reload/); assert.match(r.panel.innerHTML, /reopen it/); assert.ok(r.logs.some(l => /WebGL could not be created/.test(l))); });
test('PS5: the console text, no reload button', () => { const r = run(new Array(40).fill(false), 'Mozilla/5.0 (PlayStation; PlayStation 5/6.50)'); assert.match(r.panel.innerHTML, /PlayStation browser/); assert.doesNotMatch(r.panel.innerHTML, /boot-reload/); });
test('never asks for failIfMajorPerformanceCaveat', () => assert.doesNotMatch(src, /failIfMajorPerformanceCaveat\s*:\s*true/));
