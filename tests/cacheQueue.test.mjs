// [cache-queue] BANKSY t2486u "Do 4 and 5 rn": capacity fixes 4 (cache shared reads) + 5 (join gate: SEAS ARE CROWDED + backoff).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { backoffMs, createGate, isOverload, GATE, GATE_TEXT, retryAfterOf } from '../js/netGate.js';
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('backoff: 6 s -> 12 -> 24 -> 48 -> 60 s cap, ±25 % jitter, never past 60 s (Retry-After may lengthen it, max 120 s)', () => {
  const lo = (n) => backoffMs(n, { rnd: () => 0 }), hi = (n) => backoffMs(n, { rnd: () => 0.999999 }), mid = (n) => backoffMs(n, { rnd: () => 0.5 });
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(mid), [6000, 12000, 24000, 48000, 60000, 60000]);
  assert.deepEqual([1, 2, 3, 4, 5].map(lo), [4500, 9000, 18000, 36000, 45000]);
  for (let n = 1; n < 12; n++) { assert.ok(hi(n) <= GATE.max, 'cap ' + n); assert.ok(lo(n) >= GATE.base / 2); }
  assert.equal(backoffMs(1, { rnd: () => 0.5, retryAfter: 30 }), 30000);
  assert.equal(backoffMs(1, { rnd: () => 0.5, retryAfter: 9999 }), GATE.retryAfterMax);
  assert.equal(backoffMs(5, { rnd: () => 0.5, retryAfter: 2 }), 60000, 'a short Retry-After never shortens our own wait');
  assert.equal(retryAfterOf({ headers: { get: () => '15' } }), 15); assert.equal(retryAfterOf({ headers: { get: () => null } }), 0); assert.equal(retryAfterOf(null), 0);
});
test('overload = 429, 5xx or no answer; 4xx is a real answer', () => {
  for (const s of [0, undefined, 429, 500, 502, 503, 504]) assert.equal(isOverload(s), true, String(s));
  for (const s of [200, 304, 400, 401, 403, 404, 409]) assert.equal(isOverload(s), false, String(s));
});
test('gate: harbor full shows the card at once; api only after a streak of 3; ok() clears; mute keeps the backoff', () => {
  let t = 1000; const shown = []; const ui = { show: (v) => shown.push(['show', v.reason, v.source, v.attempt]), hide: () => shown.push(['hide']) };
  const g = createGate({ clock: () => t, rnd: () => 0.5, ui });
  assert.equal(g.fail('harbor', { full: true }), 6000); assert.deepEqual(shown.at(-1), ['show', 'full', 'harbor', 1]);
  assert.equal(g.wait('harbor'), 6000); t += 6000; assert.equal(g.wait('harbor'), 0);
  assert.equal(g.fail('harbor', { full: true }), 12000); assert.equal(g.attempts('harbor'), 2);
  g.mute('harbor'); assert.deepEqual(shown.at(-1), ['hide']); assert.ok(g.wait('harbor') > 0, 'muted, still backing off');
  g.ok('harbor'); assert.equal(g.wait('harbor'), 0); assert.equal(g.attempts('harbor'), 0);
  shown.length = 0; g.fail('api', { status: 503 }); g.fail('api', { status: 503 }); assert.equal(shown.length, 0, 'two failed calls back off quietly');
  g.fail('api', { status: 503 }); assert.deepEqual(shown.at(-1), ['show', 'busy', 'api', 3]);
  g.ok('api'); assert.deepEqual(shown.at(-1), ['hide']);
  shown.length = 0; g.fail('lobby', { quiet: true }); assert.equal(shown.length, 0); assert.ok(g.wait('lobby') > 0);
  g.fail('harbor'); assert.equal(g.visible.reason, 'offline'); g.retryNow('harbor'); assert.equal(g.wait('harbor'), 0);
  for (const r of ['full', 'busy', 'offline']) { assert.equal(GATE_TEXT[r].title, 'SEAS ARE CROWDED'); assert.ok(GATE_TEXT[r].body.length > 40); }
});
test('harbor beat: no 6 s hammering when full / erroring, gate cleared when seated; lobby + title polls back off', () => {
  const p = src('js/pvp.js');
  assert.match(p, /now - hb\.beatAt < HARBOR_NET\.beat \* 1000 \|\| netGate\.wait\('harbor'\) > 0\) return;/);
  assert.match(p, /netGate\.fail\('harbor', \{ full: r\?\.state === 'full'/);
  assert.match(p, /netGate\.ok\('harbor'\);/);
  assert.match(p, /netGate\.wait\('lobby'\) > 0\) return;/);
  const t = src('js/transport.js'); assert.equal((t.match(/retryAfter: retryAfterOf\(r\)/g) || []).length, 2);
  const b = src('js/pvpBoard.js'); assert.match(b, /netGate\.wait\('home'\) > 0\) return;/); assert.match(b, /\}, 60000\);/);
});
test('pvp api: polls fail fast while the gate waits (no request); saves still go out; any good answer clears it', async () => {
  const { gateCall } = await import('../js/netGate.js'); let t = 0; const g = createGate({ clock: () => t, rnd: () => 0.5 });
  let status = 503, n = 0; const f = async () => { n++; if (status === 0) throw new TypeError('network'); return { status, headers: { get: () => (status === 429 ? '20' : null) } }; };
  await gateCall(g, 'api', true, f); assert.equal(n, 1); assert.equal(g.wait('api'), 6000);
  await assert.rejects(gateCall(g, 'api', true, f), (e) => e.gated && e.status === 503); assert.equal(n, 1, 'gated: no second request');
  await gateCall(g, 'api', false, f); assert.equal(n, 2, 'a save / buy still asks'); assert.equal(g.attempts('api'), 2);
  status = 409; await gateCall(g, 'api', false, f); assert.equal(g.wait('api'), 0, 'a real (4xx) answer clears it');
  status = 429; await gateCall(g, 'api', true, f); assert.equal(g.wait('api'), 20000, 'Retry-After honoured');
  status = 0; t += 20000; await assert.rejects(gateCall(g, 'api', true, f)); assert.equal(g.attempts('api'), 2);
  const s = src('js/pvpSave.js'); assert.match(s, /gateCall\(netGate, 'api', POLL_ACTIONS\.has\(action\)/);
  assert.match(s, /POLL_ACTIONS = new Set\(\['squad_invites'/); for (const a of ['dev_sync', 'shop_buy', 'save', 'casino_play', 'holder']) assert.doesNotMatch(s.match(/POLL_ACTIONS = new Set\(\[[^\]]*\]/)[0], new RegExp("'" + a + "'"));
});
test('cache: boards / terrain / feed are shared and fetched less, never invented', () => {
  const m = src('js/pumpfun/market.js'); assert.match(m, /export const SHARED_MS = 30000;/); assert.match(m, /nextShared=clock\(\)\+SHARED_MS;/);
  const s = src('js/pvpSave.js'); assert.match(s, /Date\.now\(\) - c\.at < 45000\) return c\.rows;/); assert.match(s, /\{ have \}/);
  const te = src('js/island/terrainEdit.js'); assert.match(te, /j\?\.ok && j\.same && cached\?\.cells/); assert.match(te, /etag: typeof j\.etag === 'string'/);
  const lb = src('js/leaderboard.js'); assert.match(lb, /export const TOP_TTL = 30000;/); assert.equal((lb.match(/this\.topMemo\?\.clear\(\)/g) || []).length, 3);
  const pv = src('supabase/functions/pvp/index.ts'); assert.match(pv, /topMemo\.get\(period/); assert.match(pv, /terrainMemo\.get\("pub"/); assert.match(pv, /terrainMemo\.drop\(\)/);
  assert.match(pv, /json\(503, \{ error: "terrain busy, try again soon" \}\)/, 'a DB error is no longer an EMPTY island');
  assert.match(src('supabase/functions/pvp/admin.ts'), /terrainMemo\.drop\(\); return json\(200/);
  assert.match(src('supabase/functions/pvp/island.ts'), /islBoardMemo\.get\("b"/);
  const bf = src('supabase/functions/boardfeed/index.ts'); assert.match(bf, /'Retry-After':'15'/); assert.match(bf, /status:304/); assert.match(bf, /cachedRead\(\)/);
  assert.match(src('sw.js'), /"\.\/js\/netGate\.js",/);
  const css = src('css/style.css'); assert.match(css, /#seas-crowded \.sc-title \{[^}]*var\(--red\)/); assert.match(css, /#seas-crowded-chip/);
});
