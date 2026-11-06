// [v342/v343] BANKSY t1810u/t1811u "Casino gold is broken / lose = 0, win = 9999999" + t1815u "collision under the other
// rope bridge in the river so can't swim from waterfall to ocean".
// node --import ./tests/helpers/threeRegister.mjs --test tests/v342CasinoGoldAndRiverBridge.test.mjs
import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const FM = await import('../js/island/foot.js');
const E = await import('../js/casino/engine.js');

// ---------------- PART 1: casino gold ----------------
test('migration 052: no hardcoded 999999, owner plays from pvp_group_saves, clamp 1e7, rev returned', () => {
  const m = src('supabase/migrations/052_fix_casino_gold.sql');
  assert.doesNotMatch(m.replace(/--[^\n]*/g, ''), /\b999999\b/, 'no fake 999999 owner purse in the SQL');
  assert.match(m, /create or replace function public\.pvp_casino_debit/);
  assert.match(m, /create or replace function public\.pvp_casino_credit/);
  assert.match(m, /pvp_group_saves/); assert.match(m, /for update/);
  assert.match(m, /least\(10000000/); assert.match(m, /'rev'/); assert.match(m, /'owner'/);
  assert.match(m, /no save yet/); assert.match(m, /revoke all on function public\.pvp_casino_debit/i);
});

test('edge casino.ts: every reply carries rev + owner; hand updates scoped to the player', () => {
  const c = src('supabase/functions/pvp/casino.ts');
  assert.match(c, /const meta = \(who[^)]*, deb[^)]*, cred[^)]*\) =>/);
  assert.ok((c.match(/\.\.\.meta\(/g) || []).length >= 8, 'meta spread into all 8 replies');
  const upd = c.match(/from\("pvp_casino_hands"\)\.update\([^;]*/g) || [];
  assert.ok(upd.length >= 1); for (const u of upd) assert.match(u, /\.eq\("player_id", pid\)/);
});

test('client re-bases every save path on the server balance', () => {
  const s = src('js/pvpSave.js'), p = src('js/pvp.js'), d = src('js/dock/index.js');
  assert.match(s, /export function noteServerGold/); assert.match(s, /gEpoch\+\+; group\.base = g/);
  assert.match(s, /if \(ep !== gEpoch\) return/);
  assert.match(p, /serverGold/); assert.match(p, /flushNow/);
  assert.match(d, /meta\?\.fromServer && pv\?\.serverGold/);
});

test('localChange: blackjack follow-ups only move the rest of the bet (deal already took it)', () => {
  assert.equal(E.localChange('blackjack', 'stand', { payout: 40 }, { delta: 20 }), 40);   // bet 20 win
  assert.equal(E.localChange('blackjack', 'stand', { payout: 20 }, { delta: 0 }), 20);    // push: stake back
  assert.equal(E.localChange('blackjack', 'hit', { payout: 0 }, { delta: -20 }), 0);      // bust: nothing more
  assert.equal(E.localChange('blackjack', 'double', { payout: 80 }, { delta: 40 }), 60);  // double win: -20 extra +80
  assert.equal(E.localChange('blackjack', 'double', { payout: 0 }, { delta: -40 }), -20); // double lose: the extra stake
  assert.equal(E.localChange('blackjack', 'deal', {}, { delta: -20 }), -20);
  assert.equal(E.localChange('roulette', null, {}, { delta: 15 }), 15);
  assert.equal(E.localChange('blackjack', 'stand', {}, { delta: 50 }), 50);   // older reply without payout: delta as-is
});

test('client: pre-flush before a wager, server gold applied fromServer, "no save yet" retried once', async () => {
  const calls = [], gold = { v: 500 }, sets = []; let flushes = 0, n = 0;
  const pv = { flushNow: async () => { flushes++; }, inv: { call: async (k, req) => { calls.push(req.reqId); n++;
    if (n === 1) return { ok: false, error: 'no save yet' };
    return { ok: true, gold: 490, delta: -10, outcome: 'lose', rev: 7, owner: false }; } } };
  const cl = E.createCasinoClient({ pvp: () => pv, getGold: () => gold.v, setGold: (g, meta) => { sets.push([g, meta]); gold.v = g; } });
  const r = await cl.play('roulette', { bet: 10, choice: 'red' });
  assert.equal(r.mode, 'live'); assert.equal(flushes, 2); assert.equal(calls.length, 2); assert.notEqual(calls[0], calls[1]);
  assert.deepEqual(sets, [[490, { fromServer: true, rev: 7, owner: false }]]);
  assert.notEqual(gold.v, 0); assert.ok(gold.v < 9999999);
});

// ---------------- PART 2: D3 rope bridge over the river ----------------
const FOOT = src('js/island/foot.js');
const END = 'return { y, inside: Math.abs(across) <= B.half }; }';
const fnSrc = FOOT.slice(FOOT.indexOf('function bridgeAt(x, z)'), FOOT.indexOf(END, FOOT.indexOf('function bridgeAt(x, z)')) + END.length);
const mk = (B, L) => new Function('BRIDGE', 'LAYER', 'return ' + fnSrc)(B, L);
const RB = FOOT.match(/const ROPE_BRIDGE = \{ c: \[([-\d.]+), ([-\d.]+)\], a: \[([-\d.]+), ([-\d.]+)\], b: \[([-\d.]+), ([-\d.]+)\] \}/).slice(1).map(Number);
const B = (() => { const [cx, cz, ax, az, bx, bz] = RB, L = Math.hypot(bx - ax, bz - az);
  return { ax, az, bx, bz, L, yaw: Math.atan2(bx - ax, bz - az), deckY: FM.H(cx, cz) + 24, sag: Math.min(3.5, L * 0.05), half: 1.35 }; })();

test('bridgeAt is layer-aware like highBridgeAt', () => {
  assert.match(fnSrc, /if \(LAYER !== null && LAYER < y - 2\) return null;/);
  assert.match(FOOT, /function blocked\(x, z, fx, fz\) \{ (?:if \(ADMIN_COL\.nocs\.length && nocAt\(x, z\)\) return false; \/\*[^*]*\*\/ )?const hb = highBridgeAt\(x, z\); if \(hb\) return !hb\.inside; const b = bridgeAt\(x, z\); if \(b\) return !b\.inside;/);
});

test('swim the whole river both ways in 0.25 m steps: the D3 deck/rails never touch a swimmer', () => {
  const R = FM.MAP_PATHS().river, float = FM.FOOT_SWIM?.float ?? 0.5;
  let wet = 0, hits = 0, oldHits = 0, under = 0;
  for (const path of [R, [...R].reverse()]) for (const off of [0, -2, 2, -3.5, 3.5]) for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let s = 0; s < L; s += 0.25) { const x = ax + (bx - ax) * s / L + nx * off, z = az + (bz - az) * s / L + nz * off, surf = FM.waterAt(x, z);
      if (surf === null) continue; wet++;
      if (mk(B, surf - float)(x, z)) hits++;
      const old = mk(B, null)(x, z); if (old) { under++; if (!old.inside) oldHits++; } } }
  assert.ok(wet > 10000, `river sampled (${wet})`);
  assert.ok(under > 50 && oldHits > 0, `the river really runs under the D3 bridge and used to hit its rails (${under}/${oldHits})`);
  assert.equal(hits, 0, 'zero bridge blocks / deck floors for a swimmer');
});

test('walking over the D3 bridge stays solid: deck floor end to end, rails hold', () => {
  let deck = 0, rails = 0, n = 0;
  for (let a = 0; a <= B.L; a += 0.25) { n++; const x = B.ax + Math.sin(B.yaw) * a, z = B.az + Math.cos(B.yaw) * a, y = B.deckY - Math.sin(a / B.L * Math.PI) * B.sag, f = mk(B, y + 0.1);
    const on = f(x, z); if (on && on.inside && Math.abs(on.y - y) < 1e-6) deck++;
    for (const sx of [-1.7, 1.7]) { const r = f(x + Math.cos(B.yaw) * sx, z - Math.sin(B.yaw) * sx); if (r && !r.inside) rails++; } }
  assert.equal(deck, n); assert.equal(rails, 2 * n);
});

test('sw version >= 343', () => {
  assert.ok(+((src('sw.js').match(/const VERSION = 'pfp-v(\d+)'/) || [])[1]) >= 343);
});
