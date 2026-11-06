// [Timothy] THE GOLDEN DOUBLOON CASINO (#47, BANKSY via Emerly): the walk-in pirate casino between the SQUAD HALL (#33) and the UPGRADE SHOP (#5).
// node --import ./tests/helpers/threeRegister.mjs --test tests/casino.test.mjs
// The hall itself is measured by tools/casino_blender/node/casino_check.mjs (real GLBs + foot.js colliders / decks / terrain, in a child process).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, readdirSync } from 'node:fs';
const ROOT = new URL('../', import.meta.url);
const src = (f) => readFileSync(new URL(f, ROOT), 'utf8');
const probe = (env = {}) => JSON.parse(execFileSync('node', ['--import', './reg.mjs', '../../casino_blender/node/casino_check.mjs'],
  { cwd: new URL('tools/roundabout_blender/node/', ROOT), env: { ...process.env, QS: '?coast=1', ...env }, encoding: 'utf8', maxBuffer: 1 << 24 }).trim().split('\n').pop());
const D = probe(), OFF = probe({ QS: '?coast=1&casino=0' });
const CD = await import('../js/island/casinoData.js');
const E = await import('../js/casino/engine.js');
const IDS = { blackjack: ['casino_blackjack', 'E · PIRATE BLACKJACK'], roulette: ['casino_roulette', 'E · BUCCANEER ROULETTE'], dice: ['casino_dice', "E · DEAD MAN'S DICE"], slots: ['casino_slots', 'E · TREASURE SLOTS'] };
const overlap = (a, b, pad = 0) => a.lx0 < b.lx1 + pad && b.lx0 < a.lx1 + pad && a.lz0 < b.lz1 + pad && b.lz0 < a.lz1 + pad;

test('footprint on Main Street between the Squad Hall (#33) and the Upgrade Shop (#5), clear of the Coliseum, every numbered building and the street signs', async () => {
  const H = CD.CASINO_HALL, R = H.rect;
  assert.equal(H.n, 47); assert.equal(R.lx0, 14); assert.ok(R.lx1 <= 28.5 + 1e-9); assert.ok(R.lz0 >= -59 && R.lz1 <= -42);
  assert.ok(H.arch.w >= 5 - 1e-9 && H.arch.h >= 4.4 - 1e-9 && H.arch.lx === 14, 'arch on the street face');
  const B = JSON.parse(src('assets/island/building_numbers.json')).buildings, rectOf = (b) => ({ lx0: b.lx - b.w / 2, lx1: b.lx + b.w / 2, lz0: b.lz - b.d / 2, lz1: b.lz + b.d / 2 });
  const sq = rectOf(B.find(b => b.n === 33)), up = rectOf(B.find(b => b.n === 5));
  assert.ok(sq.lz1 <= R.lz0 - 0.2, `Squad Hall north wall ${sq.lz1} vs casino ${R.lz0}`); assert.ok(up.lz0 >= R.lz1 && up.lz0 - R.lz1 < 0.5, `Upgrade Shop back ${up.lz0} vs casino ${R.lz1}`);
  for (const b of B) if (b.n !== 47 && b.kind === 'building') assert.ok(!overlap(rectOf(b), { lx0: R.lx0, lx1: R.lx1, lz0: R.lz0 + 0.01, lz1: R.lz1 - 0.01 }), `overlaps #${b.n} ${b.id}`);
  const cas = B.find(b => b.n === 47); assert.equal(cas.id, 'casino'); assert.equal(cas.use, 'THE GOLDEN DOUBLOON CASINO');
  const { FOOT } = await import('../js/island/coliseum.js'); assert.ok(FOOT.lx0 - R.lx1 >= 5, 'coliseum shell 5 m+ behind the back wall');
  const { STREET_SIGN_SPOTS } = await import('../js/islandGeography.js'); const CO = await import('../js/island/coast.js');
  for (const s of STREET_SIGN_SPOTS) { const [lx, lz] = CO.w2t(s.x + Math.cos(s.yaw) * 2.6, s.z - Math.sin(s.yaw) * 2.6); assert.ok(!(lx > R.lx0 - 1 && lx < R.lx1 + 1 && lz > R.lz0 - 1 && lz < R.lz1 + 1), `street sign ${s.id || s.name} at ${lx.toFixed(1)}, ${lz.toFixed(1)}`); }
  // the coliseum store clones (#46 sat on this block) skip the hall
  assert.deepEqual(D.overlap, [true, false]); assert.deepEqual(OFF.overlap, [false, false]);
  assert.match(src('js/island/foot.js'), /PV\.casinoOverlap\?\.\(/); assert.match(src('js/island/coliseum.js'), /o\.squadOverlap/);
  // the Squad Hall's north strip keeps the street grade (its own deck), the terrain under the hall drops to the floor
  assert.equal(D.squadNorth, 0); assert.equal(D.H.s18_60, CD.CASINO_FLAT); assert.equal(D.lots, 1);
});

test('kill switch &casino=0: no hall, no tables, no terrain change, no map icon', () => {
  assert.equal(OFF.on, false); assert.equal(OFF.kit, false); assert.deepEqual(OFF.interacts, []); assert.equal(OFF.lots, 0);
  assert.ok(OFF.H.s18_60 > D.H.s18_60 + 1, `terrain untouched with casino=0: ${OFF.H.s18_60}`);
  assert.match(src('js/mapLandmarks.js'), /CASINO_ON \? \[\['casino'/); assert.match(src('js/island/casinoData.js'), /casino=0|get\('casino'\)/);
  assert.equal(D.on, true);
});

test('GLBs: LOD0 + LOD1 with colliders and table points, each file under 1.2 MB; the tables in the GLB match CASINO_TABLES', () => {
  for (const f of ['casino_hall.glb', 'casino_hall_low.glb']) { const n = statSync(new URL('assets/island/' + f, ROOT)).size; assert.ok(n < 1.2e6, `${f} ${n}`); }
  assert.equal(D.kit, true); assert.equal(D.lods, 2); assert.ok(D.colliders >= 12, `colliders ${D.colliders}`);
  assert.ok(D.built && D.built.lod, 'buildCasino → THREE.LOD');
  // three.js building frame (x = lz - CZ, z = CX - lx; Blender y = lx - CX, z = -y) back to town
  for (const t of CD.CASINO_TABLES) { const g = D.tablesGlb[t.game]; assert.ok(g, t.game);
    assert.ok(Math.abs(g.e[0] - (t.e.lz - CD.CASINO_HALL.lz)) < 0.05 && Math.abs(g.e[1] - (CD.CASINO_HALL.lx - t.e.lx)) < 0.05, `${t.game} e ${g.e} vs ${t.e.lx}, ${t.e.lz}`); }
  const py = src('tools/casino_blender/build_casino.py');
  for (const k of ['THE GOLDEN DOUBLOON', 'CASINO', 'mansard', 'cupola', 'dormer', 'chandelier', 'lantern', 'awning', 'balcony', 'quoin', 'chest', 'cask']) assert.ok(py.toLowerCase().includes(k.toLowerCase()), k);
});

test('four stations: ids, labels, r 2.4, on the floor, 5.5 m+ apart, unblocked', () => {
  assert.equal(D.interacts.length, 4);
  for (const q of D.interacts) { const [id, label] = IDS[q.game]; assert.equal(q.id, id); assert.equal(q.label, label); assert.equal(q.r, 2.4); assert.equal(q.y, CD.CASINO_Y); assert.equal(q.blocked, false);
    assert.equal(CD.casinoInteract({ id: q.id }), q.game); assert.equal(CD.casinoInteract(q.id), q.game); }
  assert.equal(CD.casinoInteract({ id: 'squadhall' }), null);
  const T = CD.CASINO_TABLES; for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) { const a = T[i].at || T[i].e, b = T[j].at || T[j].e;
    assert.ok(Math.hypot(a.lx - b.lx, a.lz - b.lz) >= 5.5, `${T[i].game} - ${T[j].game}`); }
  for (const r of D.freeR) assert.ok(r >= 0.7, `free radius ${r}`);
});

test('walk in from Main Street (lx 8) through the arch to all four tables; 2.2 m aisles; floor never under terrain; walls solid', () => {
  for (const r of D.reach) { assert.ok(r.ok, r.id); assert.ok(r.viaArch, `${r.id} via the arch`); assert.ok(r.maxStep <= 0.3, `${r.id} step ${r.maxStep}`); }
  assert.equal(D.reach.length, 4);
  assert.equal(D.archWalk.hits, 0); assert.ok(D.archWalk.maxStep <= 0.3); assert.ok(D.archClear >= 4.5, `arch ${D.archClear}`);
  assert.equal(D.aisles.runner, 0, 'runner aisle (2.2 m walker)'); assert.equal(D.aisles.cross, 0, 'cross aisle (2.2 m walker)');
  assert.ok(D.floorPoke.max <= 0, `terrain through the planks at ${D.floorPoke.at}: ${D.floorPoke.max}`); assert.ok(D.vaultTerrain < 0.85, 'treasure dais covers the corner');
  assert.ok(D.walls.front.every(Boolean) && D.walls.south && D.walls.north && D.walls.back, JSON.stringify(D.walls));
});

test('wiring: plazaShops loads + places the hall, foot.js registers it, the dock and island.html open the casino UI, map icon + building #47', () => {
  assert.match(src('js/island/plazaShops.js'), /loadCasinoReady\(low\)/); assert.match(src('js/island/plazaShops.js'), /buildCasino\(\)/);
  const f = src('js/island/foot.js'); assert.match(f, /PV\.casinoGround/); assert.match(f, /PV\.casinoSite\(/); assert.match(f, /casinoClear/);
  const d = src('js/dock/index.js'); assert.match(d, /import\('\.\.\/casino\/ui\.js'\)/); assert.match(d, /casinoInteract\(/); assert.match(d, /casinoUi\?\.isOpen\) \{ casinoUi\.onKey/);
  assert.match(src('js/island/main.js'), /casinoInteract\(q\)/);
  const I = await_(import('../js/mapIcons.js')); void I;
  assert.match(src('js/mapIcons.js'), /casino: \['doubloon'/); assert.ok(+(src('sw.js').match(/const VERSION = 'pfp-v(\d+)'/) || [])[1] >= 336, 'sw.js VERSION >= v336');
  const C = src('js/island/casino.js'); for (const k of ['CASINO_ON', 'CASINO_HALL', 'CASINO_TABLES', 'loadCasinoReady', 'buildCasino', 'casinoInteract']) assert.match(C, new RegExp('\\b' + k + '\\b'), k);
});
function await_(p) { p.catch(() => {}); return p; }

test('no crypto anywhere in the casino: no currency signs, tickers, coins, wallets; gold reads 100 GOLD / 100g', () => {
  const DOLLAR = String.fromCharCode(36), TPL = DOLLAR + '{';   // template literals are the only allowed use
  const files = [...readdirSync(new URL('js/casino/', ROOT)).map(f => 'js/casino/' + f), 'js/island/casino.js', 'js/island/casinoData.js', 'tools/casino_blender/build_casino.py', 'tools/casino_blender/pack_casino.mjs', 'tools/casino_blender/node/casino_check.mjs'];
  const signs = [0x20bf, 0x39e, 0x25ce, 0x20ac, 0xa3, 0xa5].map(c => String.fromCharCode(c));
  const banned = new RegExp('\\b(' + ['SUNK', 'AHOY', 'PUMP', 'HQ', 'RETARDIO', 'SOL', 'BTC', 'ETH', 'USDC', 'USDT', 'solana', 'ethereum', 'bitcoin', 'wallet', 'phantom', 'metamask', 'tokens?', 'nft', 'blockchain', 'web3', 'dollars?', 'usd'].join('|') + ')\\b', 'i');
  for (const f of files) { const s = src(f);
    assert.ok(!s.split(TPL).join('').includes(DOLLAR), `${f}: a dollar sign`);
    for (const ch of signs) assert.ok(!s.includes(ch), `${f}: currency sign U+${ch.charCodeAt(0).toString(16)}`);
    const bad = banned.exec(s); assert.equal(bad, null, `${f}: ${bad && bad[0]}`);
    for (const c of s.match(/crypto[.\w]*/g) || []) assert.ok(/^crypto(\.getRandomValues|Int)?(?![\s\S])/.test(c), `${f}: ${c}`);
  }
  const ui = src('js/casino/ui.js'); assert.deepEqual(E.CHIPS, [10, 25, 50, 100, 250, 500]); assert.ok(ui.includes(TPL + 'c}g</button>'), 'chips read 10g .. 500g'); for (const k of ['1/2', '2×', 'MAX']) assert.ok(ui.includes(k), `chip ${k}`);
  assert.equal(E.fmtGold(1250), '1,250 GOLD'); assert.equal(E.fmtG(100), '100g');
});

test('practice table: payouts per game (blackjack natural 3:2, roulette 36x / 3x / 2x, dice 2x / 4x / 5x, slots 25..4, pair 2x)', async () => {
  assert.equal(E.rouletteMult(E.parseRouletteChoice('number:7'), 7), 36); assert.equal(E.rouletteMult(E.parseRouletteChoice('7'), 7), 36); assert.equal(E.rouletteMult(E.parseRouletteChoice('n:17'), 17), 36);
  assert.equal(E.rouletteMult(E.parseRouletteChoice('dozen1'), 5), 3); assert.equal(E.rouletteMult(E.parseRouletteChoice('1st12'), 13), 0);
  assert.equal(E.rouletteMult(E.parseRouletteChoice('red'), 1), 2); assert.equal(E.rouletteMult(E.parseRouletteChoice('red'), 2), 0); assert.equal(E.rouletteMult(E.parseRouletteChoice('odd'), 0), 0);
  assert.equal(E.rouletteMult(E.parseRouletteChoice('low'), 18), 2); assert.equal(E.rouletteMult(E.parseRouletteChoice({ kind: 'color', value: 'black' }), 2), 2);
  assert.equal(E.diceMult('under7', 2, 3), 2); assert.equal(E.diceMult('seven', 3, 4), 4); assert.equal(E.diceMult('over7', 6, 5), 2); assert.equal(E.diceMult('doubles', 4, 4), 5); assert.equal(E.diceMult('over7', 3, 4), 0);
  assert.equal(E.slotsMult(['seven', 'seven', 'seven']), 25); assert.equal(E.slotsMult(['chest', 'chest', 'chest']), 15); assert.equal(E.slotsMult(['crown', 'crown', 'crown']), 10);
  assert.equal(E.slotsMult(['doubloon', 'doubloon', 'doubloon']), 8); assert.equal(E.slotsMult(['ruby', 'ruby', 'ruby']), 6); assert.equal(E.slotsMult(['anchor', 'anchor', 'anchor']), 4);
  assert.equal(E.slotsMult(['ruby', 'ruby', 'anchor']), 2); assert.equal(E.slotsMult(['ruby', 'seven', 'anchor']), 0);
  assert.equal(E.handTotal(['AS', 'KH']), 21); assert.ok(E.isNatural(['AS', 'KH'])); assert.equal(E.handTotal(['AS', 'AH', '9C']), 21);
  // deterministic rng: the local purse moves by exactly the reported delta, never below zero, bets clamp to the purse
  let seq = 0; const rng = (n) => (seq = (seq * 1103515245 + 12345) >>> 0) % n;
  const L = E.createLocalCasino({ purse: 1000, rng });
  for (const [game, choice] of [['roulette', 'red'], ['roulette', 'number:7'], ['dice', 'seven'], ['dice', 'doubles'], ['slots', null]]) for (let i = 0; i < 20; i++) { if (L.gold < 100) L.gold = 1000;
    const before = L.gold, r = await L.play({ game, bet: 25, choice }); assert.equal(r.ok, true); assert.equal(r.gold, before + r.delta, `${game} purse`); assert.ok(r.gold >= 0); assert.ok(['win', 'lose'].includes(r.outcome)); assert.equal(r.delta, r.outcome === 'win' ? 25 * (r.detail.mult - 1) : -25); }
  for (let i = 0; i < 200; i++) { if (L.gold < 200) L.gold = 1000; const before = L.gold; let r = await L.play({ game: 'blackjack', bet: 50, action: 'deal' }); let k = 0;
    while (r.ok && !r.detail.finished && k++ < 10) r = await L.play({ game: 'blackjack', action: r.detail.playerTotal < 12 && r.state.canDouble ? 'double' : r.detail.playerTotal < 17 ? 'hit' : 'stand', stateId: r.state.stateId });
    assert.equal(r.ok, true); assert.equal(r.detail.finished, true); const b = r.detail.bet;
    const exp = { push: 0, lose: -b, bust: -b, win: b, blackjack: Math.floor(b * 1.5) }[r.outcome]; assert.equal(r.delta, exp, `${r.outcome} ${JSON.stringify(r.detail)}`);
    if (r.outcome === 'blackjack') assert.equal(r.delta, 75); assert.equal(L.gold, before + r.delta); }
});

test('live table: casino_play payload; nested + top-level replies set the HUD gold; unavailable → practice that never touches real gold', async () => {
  const calls = []; let gold = 1250; const setGold = (g) => { gold = g; };
  // what js/pvp.js inv.call hands back: the server reply + gold_landed 0 (the casino sets the gold itself)
  const reply = (raw) => ({ inv: { call: async (action, body) => { calls.push([action, body]); return raw && raw.ok ? { ...raw, gold_landed: 0 } : raw; } } });
  let pv = reply({ ok: true, gold: 1350, delta: 100, outcome: 'win', detail: { dice: [3, 4] } });
  let C = E.createCasinoClient({ pvp: () => pv, getGold: () => gold, setGold });
  assert.equal(C.mode, 'live');
  let r = await C.play('dice', { bet: 100, choice: 'seven' });
  assert.equal(calls[0][0], 'casino_play'); const b = calls[0][1];
  assert.deepEqual(Object.keys(b).sort(), ['action', 'bet', 'choice', 'game', 'reqId', 'stateId']); assert.equal(b.game, 'dice'); assert.equal(b.bet, 100); assert.equal(b.choice, 'seven'); assert.match(b.reqId, /^cas_[0-9a-f]{24}/);
  assert.equal(r.mode, 'live'); assert.equal(r.ok, true); assert.equal(r.gold, 1350); assert.equal(r.delta, 100); assert.deepEqual(r.dice, [3, 4]); assert.equal(r.sum, 7); assert.equal(gold, 1350);
  pv = reply({ ok: true, result: { gold: 1250, delta: -100, outcome: 'lose', detail: { reels: ['ruby', 'seven', 'anchor'] } } });
  r = await C.play('slots', { bet: 100 }); assert.equal(r.outcome, 'lose'); assert.equal(gold, 1250); assert.deepEqual(r.reels, ['ruby', 'seven', 'anchor']);
  pv = reply({ ok: true, data: { delta: 0, outcome: 'playing', state: { id: 'bj1', phase: 'player' }, player: ['AS', '9H'], dealer: ['KC', null] } });
  r = await C.play('blackjack', { bet: 50, action: 'deal' }); assert.equal(r.stateId, 'bj1'); assert.equal(r.finished, false); assert.deepEqual(r.player, ['AS', '9H']); assert.equal(gold, 1250);
  pv = reply({ ok: true, delta: 50, outcome: 'win', state: { stateId: 'bj1', phase: 'done' }, detail: { player: ['AS', '9H'], dealer: ['KC', '8D'] } });
  r = await C.play('blackjack', { action: 'stand', stateId: 'bj1', bet: 50 }); assert.equal(calls.at(-1)[1].stateId, 'bj1'); assert.equal(calls.at(-1)[1].action, 'stand');
  assert.equal(r.finished, true); assert.equal(gold, 1300, 'delta-only reply moves the HUD gold');
  pv = reply({ ok: true, gold: 1500, delta: 200, outcome: 'win', detail: { number: 7 } }); r = await C.play('roulette', { bet: 100, choice: { kind: 'number', value: 7 } });
  assert.equal(r.number, 7); assert.equal(r.color, 'red'); assert.equal(gold, 1500);
  // a game error stays live (no gold change)
  pv = reply({ ok: false, error: 'not enough gold' }); r = await C.play('dice', { bet: 5000, choice: 'seven' }); assert.equal(r.ok, false); assert.equal(r.mode, 'live'); assert.equal(gold, 1500);
  // the server has no casino yet: practice table, real gold untouched, mode sticks
  pv = reply({ ok: false, error: 'unknown action casino_play' });
  r = await C.play('roulette', { bet: 100, choice: 'red' }); assert.equal(r.mode, 'practice'); assert.equal(C.mode, 'practice'); assert.equal(C.why, 'offline'); assert.equal(gold, 1500);
  const n = calls.length; await C.play('dice', { bet: 10, choice: 'over7' }); assert.equal(calls.length, n, 'no more server calls once practising'); assert.equal(gold, 1500);
  // no pvp at all (island.html), ?casinoqa=1, the pvp offline reply, a throw
  gold = 500; C = E.createCasinoClient({ pvp: () => null, getGold: () => gold, setGold }); r = await C.play('slots', { bet: 10 }); assert.equal(r.mode, 'practice'); assert.equal(gold, 500);
  C = E.createCasinoClient({ pvp: () => reply({ ok: true, gold: 9 }), getGold: () => gold, setGold, qa: true }); r = await C.play('dice', { bet: 10, choice: 'seven' }); assert.equal(r.mode, 'practice'); assert.equal(gold, 500);
  C = E.createCasinoClient({ pvp: () => reply({ ok: false, error: 'offline' }), getGold: () => gold, setGold }); r = await C.play('dice', { bet: 10, choice: 'seven' }); assert.equal(r.mode, 'practice'); assert.equal(gold, 500);
  C = E.createCasinoClient({ pvp: () => ({ inv: { call: async () => { throw new Error('network'); } } }), getGold: () => gold, setGold }); r = await C.play('dice', { bet: 10, choice: 'seven' }); assert.equal(r.mode, 'practice'); assert.equal(gold, 500);
  assert.equal(E.clampBet(3, 1000), E.MIN_BET); assert.ok(E.clampBet(1e9, 1e9) <= E.MAX_BET);
});
