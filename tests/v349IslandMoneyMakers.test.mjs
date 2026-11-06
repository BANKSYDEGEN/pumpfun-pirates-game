// [v349 money-makers] BANKSY t203u "How else could they make money on island?" -> t204u "Add the first 5":
// 1 Wanted & Bounty Boards · 2 Coliseum prize fights / ringside bets / Skeleton Horde · 3 Smuggler Crate Runs ·
// 4 Shipwreck + Lagoon diving / shore crab pots / Dead Man's Cave mining · 5 Cottage spice plots + copper rum still + Rum Export Stall.
// node --import ./tests/helpers/threeRegister.mjs --test tests/v349IslandMoneyMakers.test.mjs
import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const C = await import('../js/island/moneyMakers/config.js');
const IG = await import('../js/inventory/islandGoods.js');
const { createMMApi } = await import('../js/island/moneyMakers/api.js');
const MIG = src('supabase/migrations/053_island_money_makers.sql'), EDGE = src('supabase/functions/pvp/island.ts');
const noComments = (s) => s.replace(/--[^\n]*/g, '');

// ---------------- the numbers BANKSY asked for ----------------
test('1. contracts: 4 daily contracts, kill progress, done/claim rules', () => {
  assert.deepEqual(C.CONTRACTS.map(c => [c.id, c.kind, c.need, c.gold]), [['cave_raiders', 'raider', 5, 150], ['jungle_stalkers', 'stalker', 4, 120], ['cursed_captains', 'captain', 2, 250], ['salvage_patrol', 'any', 6, 100]]);
  let p = {}; for (let i = 0; i < 7; i++) p = C.contractProgress(p, 'raider');
  assert.equal(p.cave_raiders, 5, 'clamped at need'); assert.equal(p.salvage_patrol, 6, 'any kill counts for patrol');
  assert.ok(C.contractDone('cave_raiders', p)); assert.ok(!C.contractDone('jungle_stalkers', p)); assert.equal(C.DAY_CAPS.contract, 620);
});
test('1. bounties: stakes, claim rules (never yourself / squad / safe zone / no pot)', () => {
  assert.deepEqual(C.BOUNTY.stakes, [100, 250, 500]); assert.ok(C.bountyStakeOk(100) && C.bountyStakeOk(5000) && !C.bountyStakeOk(99) && !C.bountyStakeOk(5001));
  assert.ok(C.canClaimBounty({ killer: 'Ann', victim: 'Bob', pot: 250 }));
  assert.ok(!C.canClaimBounty({ killer: 'Bob', victim: ' bob ', pot: 250 })); assert.ok(!C.canClaimBounty({ killer: 'Ann', victim: 'Bob', pot: 250, squad: true }));
  assert.ok(!C.canClaimBounty({ killer: 'Ann', victim: 'Bob', pot: 250, safe: true })); assert.ok(!C.canClaimBounty({ killer: 'Ann', victim: 'Bob', pot: 0 }));
});
test('2. coliseum: duel stakes, pot, ringside pro-rata payouts + refunds; horde 5 waves = 950, 2 runs = 1900', () => {
  assert.deepEqual(C.DUEL.stakes, [100, 250, 500, 1000]); assert.equal(C.duelPot(250), 500);
  const bets = [{ player: 'a', side: 'r', amount: 100 }, { player: 'b', side: 'b', amount: 400 }, { player: 'c', side: 'r', amount: 300 }];
  const pay = C.betPayouts(bets, 'r'); assert.equal(pay.get('a'), 200); assert.equal(pay.get('c'), 600); assert.equal(pay.get('b'), undefined);
  const one = C.betPayouts([{ player: 'a', side: 'r', amount: 100 }], 'r'); assert.equal(one.get('a'), 100, 'one-sided pool = refund');
  assert.equal(C.HORDE.waves.length, 5); assert.deepEqual(C.HORDE.waves.map(w => w.cap), [0, 0, 1, 1, 1], 'a Cursed Captain leads waves 3-5');
  assert.equal(C.hordeRunGold(), 950); assert.equal(C.hordeDayCap(), 1900);
});
test('3. smuggler crates: 100 / 220, 80% speed, zipline blocked, cutthroat needs PvP ground', () => {
  assert.equal(C.crateGold('standard'), 100); assert.equal(C.crateGold('cutthroat'), 220); assert.equal(C.CRATE.speedK, 0.8);
  assert.equal(C.crateEarned('cutthroat', 59), 100); assert.equal(C.crateEarned('cutthroat', 60), 220);
  assert.equal(C.ZIP_BLOCK_MSG, 'Too heavy for the zipline! Haul the crate on foot.');
  assert.match(C.crateBanner('Fort Quartermaster'), /Hauling Contraband Crate → Fort Quartermaster \(80% speed · Ziplines disabled\)/);
});
test('4. diving O2, crab pots (3 max, 15:00), mining 3 swings', () => {
  assert.equal(C.DIVE.o2, 100); assert.ok(C.o2After(C.DIVE.pry.chest) > 0, 'a steady pry finishes the chest before the O2 runs out'); assert.ok(C.o2After(6) < 0);
  for (let i = 0; i < 20; i++) { const l = C.diveLoot(i % 2 ? 'chest' : 'clam', i / 20); assert.ok(IG.ISLAND_GOODS[l.id]?.src === 'dive'); }
  assert.equal(C.CRAB.maxPots, 3); assert.equal(C.fmtClock(900), '15:00'); const s = C.potState(Date.now() - 1000, Date.now(), 900); assert.ok(!s.full && s.left > 898);
  const haul = C.crabLoot(0.3, 0.9); assert.equal(Object.values(haul).reduce((a, b) => a + b, 0), 4); for (const k of Object.keys(haul)) assert.equal(IG.ISLAND_GOODS[k].src, 'crab');
  assert.equal(C.MINE.charges, 3); for (const k of Object.keys(C.MINE.kinds)) assert.equal(IG.ISLAND_GOODS[C.MINE.kinds[k].item].src, 'mine');
});
test('5. spice plot stages (~13 min), still (~15 min, 25g mash or homegrown = Reserve), rum stall 140 / 175', () => {
  const t0 = Date.now(); assert.equal(C.plotStage(t0, t0 + 1000, 780).stage, 0); assert.equal(C.plotStage(t0, t0 + 400e3, 780).stage, 1); assert.ok(C.plotStage(t0, t0 + 780e3, 780).ready);
  assert.equal(C.STILL.mashGold, 25); assert.equal(C.stillOutput(true), 'reserve_spiced_rum'); assert.equal(C.stillOutput(false), 'cottage_spiced_rum');
  assert.equal(C.stillState(t0, t0 + 899e3, 900).phase, 'brewing'); assert.equal(C.stillState(t0, t0 + 900e3, 900).phase, 'ready');
  assert.equal(IG.islPrice('isl:cottage_spiced_rum', 'rum'), 140); assert.equal(IG.islPrice('isl:reserve_spiced_rum', 'rum'), 175);
  assert.equal(IG.islPrice('isl:iron_ore', 'fish'), 0, 'the Fish Market buys crabs, not ore');
});

// ---------------- one price list: client = migration 053 = Edge copy ----------------
test('island goods: catalog rows == migration 053 seed == island.ts ISLAND_PRICES', () => {
  const rows = IG.islPriceRows().map(r => r.join('|')).sort();
  const sql = [...noComments(MIG).matchAll(/\('(isl:[a-z_]+)', '(fish|antiques|rum)', (\d+)\)/g)].map(m => `${m[1]}|${m[2]}|${m[3]}`).sort();
  const ts = [...EDGE.matchAll(/\["(isl:[a-z_]+)", "(fish|antiques|rum)", (\d+)\]/g)].map(m => `${m[1]}|${m[2]}|${m[3]}`).sort();
  assert.equal(rows.length, 16); assert.deepEqual(sql, rows); assert.deepEqual(ts, rows);
  const items = [...noComments(MIG).matchAll(/\('(isl:[a-z_]+)', '(crab|dive|mine|plot|still)'\)/g)].map(m => `${m[1]}|${m[2]}`).sort();
  assert.deepEqual(items, Object.entries(IG.ISLAND_GOODS).map(([id, g]) => `isl:${id}|${g.src}`).sort());
  for (const [id] of Object.entries(IG.ISLAND_GOODS)) assert.match(IG.islKey(id), IG.ISL_KEY_RE);
  assert.ok(!src('js/inventory/catalog.js').includes('isl:'), 'catalog.js (-> invCatalog.ts, migration 036) is untouched');
});

// ---------------- the server: migration 053 + island.ts ----------------
test('migration 053: additive, flagged, RLS, every function revoked, server-authoritative gold with save.gold sync', () => {
  assert.match(MIG, /^begin;/m); assert.match(MIG, /^commit;/m);
  assert.doesNotMatch(noComments(MIG), /\bdrop table\b|\btruncate\b|\bdelete from public\.pvp_(profiles|dev_profiles|group_saves)\b/i);
  assert.match(MIG, /'island_gold'/);
  const fns = [...MIG.matchAll(/create or replace function public\.(pvp_isl_\w+)/g)].map(m => m[1]);
  for (const f of ['pvp_isl_move', 'pvp_isl_contract', 'pvp_isl_bounty_post', 'pvp_isl_bounty_claim', 'pvp_isl_duel_post', 'pvp_isl_duel_accept', 'pvp_isl_bet', 'pvp_isl_duel_settle',
    'pvp_isl_horde', 'pvp_isl_crate', 'pvp_isl_gather', 'pvp_isl_timer_start', 'pvp_isl_timer_finish', 'pvp_isl_sell', 'pvp_isl_state', 'pvp_isl_board']) assert.ok(fns.includes(f), f);
  for (const f of fns) if (f !== 'pvp_isl_today' && f !== 'pvp_isl_key') assert.match(MIG, new RegExp(`revoke all on function public\\.${f}\\(`), `${f} revoked`);
  for (const t of [...MIG.matchAll(/create table if not exists public\.(pvp_isl_\w+)/g)].map(m => m[1])) assert.match(MIG, new RegExp(`alter table public\\.${t} enable row level security`), `${t} RLS`);
  // Emerly's gold-sync rule: gold AND save.gold together, rev returned
  assert.match(MIG, /update pvp_group_saves set gold = g/); assert.match(MIG, /jsonb_set\(coalesce\(save, ''?\{\}''?::jsonb\), ''?\{gold\}''?, to_jsonb\(/);
  assert.match(MIG, /'gold', g, 'delta', d, 'rev', rv, 'owner', is_owner/); assert.match(MIG, /for update/);
  assert.match(MIG, /select \* into prev from pvp_isl_ledger where req = p_req/, 'idempotent by request id');
  assert.match(MIG, /pvp_isl_move\(p_player, pay, p_req, 'contract', p_contract, 620\)/); assert.match(MIG, /'horde', p_run, 1900\)|1900/); assert.match(MIG, /'crate', p_run, 2640\)/);
  assert.match(MIG, /America\/Indiana\/Indianapolis/);
});
test('island.ts: 15 actions, dispatched from index.ts, missing 053 = 409 closed, casino-style account mirror', () => {
  const m = EDGE.match(/export const ISLAND_ACTIONS = \[([^\]]+)\]/); assert.ok(m); const acts = [...m[1].matchAll(/"(isl_\w+)"/g)].map(x => x[1]);
  assert.equal(acts.length, 15); for (const a of acts) assert.match(EDGE, new RegExp(`case "${a}"|action === "${a}"`));
  const idx = src('supabase/functions/pvp/index.ts');
  assert.match(idx, /import \{ islandAction, ISLAND_ACTIONS \} from "\.\/island\.ts"/); assert.match(idx, /ISLAND_ACTIONS\.includes\(String\(b\.action\) as any\)\) return await islandAction\(\{ db, whoAmI, json, acctBump \}/);
  assert.match(EDGE, /PGRST202\|42883/); assert.match(EDGE, /json\(409, \{ error: "closed" \}\)/); assert.match(EDGE, /!who\.wallet && !who\.owner/);
  for (const [k, v] of Object.entries({ cave_raiders: 150, jungle_stalkers: 120, cursed_captains: 250, salvage_patrol: 100 })) assert.match(EDGE, new RegExp(`${k}: ${v}`));
  assert.match(EDGE, /HORDE_GOLD = \[60, 90, 120, 160, 220\], HORDE_CHAMPION = 300/); assert.match(EDGE, /standard: 100, cutthroat: 220/);
  assert.equal(JSON.stringify(C.HORDE.gold), '[60,90,120,160,220]');
});

// ---------------- client: practice mode end-to-end (no server) ----------------
test('api practice mode: contracts, horde, crates, gathering, pots, plot -> still -> rum, sell; PvP money needs the live server', async () => {
  const game = { gold: 100 }; const saves = [];
  const api = createMMApi({ pvp: () => ({ inv: { call: async () => ({ ok: false, error: 'closed', status: 409 }) }, save: (o) => saves.push(o), flushNow: async () => null }), game });
  let r = await api.call('isl_contract', { contract: 'cave_raiders' }); assert.equal(r.ok, false); assert.equal(api.live, false, 'no 053 = practice');
  for (let i = 0; i < 5; i++) api.onKill('raider'); r = await api.call('isl_contract', { contract: 'cave_raiders' }); assert.ok(r.ok && r.practice); assert.equal(game.gold, 250);
  r = await api.call('isl_contract', { contract: 'cave_raiders' }); assert.equal(r.ok, false, 'once a day');
  for (let w = 1; w <= 5; w++) await api.call('isl_horde', { run: 'run_1', wave: w }); assert.equal(game.gold, 250 + 950);
  r = await api.call('isl_horde', { run: 'run_1', wave: 5 }); assert.ok(r.retry); assert.equal(game.gold, 1200, 'a wave pays once');
  await api.call('isl_crate', { tier: 'cutthroat', run: 'crate_1' }); assert.equal(game.gold, 1420);
  r = await api.call('isl_gather', { src: 'mine', spot: 'iron', kind: 'iron' }); assert.ok(r.ok && api.qty('iron_ore') >= 1);
  await api.call('isl_gather', { src: 'mine', spot: 'iron', kind: 'iron' }); await api.call('isl_gather', { src: 'mine', spot: 'iron', kind: 'iron' });
  r = await api.call('isl_gather', { src: 'mine', spot: 'iron', kind: 'iron' }); assert.equal(r.error, 'depleted', '3 swings a vein');
  for (const s of ['a1', 'b1', 'c1']) assert.ok((await api.call('isl_timer_start', { kind: 'crab', slot: s })).ok); assert.equal((await api.call('isl_timer_start', { kind: 'crab', slot: 'd1' })).error, 'max pots');
  assert.equal((await api.call('isl_timer_finish', { kind: 'crab', slot: 'a1' })).error, 'not ready');
  for (const t of Object.values(api.st.timers)) t.t0 -= 901e3; r = await api.call('isl_timer_finish', { kind: 'crab', slot: 'a1' }); assert.ok(r.ok && Object.keys(r.items).length);
  // plot -> homegrown still -> 2 reserve rum -> the stall
  await api.call('isl_timer_start', { kind: 'plot', slot: 'balcony' }); api.st.timers['plot:balcony'].t0 -= 781e3; await api.call('isl_timer_finish', { kind: 'plot', slot: 'balcony' });
  assert.equal(api.qty('island_cane'), 2); assert.equal(api.qty('island_spices'), 2);
  r = await api.call('isl_timer_start', { kind: 'still', slot: 'balcony', homegrown: true }); assert.ok(r.ok); assert.equal(api.qty('island_cane'), 0); assert.equal(api.qty('island_spices'), 1);
  api.st.timers['still:balcony'].t0 -= 901e3; r = await api.call('isl_timer_finish', { kind: 'still', slot: 'balcony' }); assert.deepEqual(r.items, { reserve_spiced_rum: 2 });
  const g0 = game.gold; r = await api.call('isl_sell', { item: 'isl:reserve_spiced_rum', qty: 2, shop: 'rum' }); assert.equal(game.gold - g0, 350);
  const g1 = game.gold; r = await api.call('isl_timer_start', { kind: 'still', slot: 'dormer', homegrown: false }); assert.equal(g1 - game.gold, 25, 'the mash costs 25g');
  assert.equal((await api.call('isl_sell', { item: 'isl:iron_ore', qty: 1, shop: 'fish' })).ok, false);
  r = await api.call('isl_bounty_post', { target: 'Bob', amount: 100 }); assert.equal(r.error, 'live only'); r = await api.call('isl_duel_post', { stake: 100 }); assert.equal(r.error, 'live only');
  assert.ok(saves.length > 0, 'practice gold is saved like the casino practice table');
});
test('api live mode: server gold re-bases (serverGold), never falls back to practice after the server answered', async () => {
  const game = { gold: 5 }; const based = []; let up = true;
  const pv = { inv: { call: async (a) => (up ? { ok: true, gold: 777, delta: 150, rev: 9, owner: false, goods: { 'isl:sea_pearl': 2 } } : null) }, serverGold: (g, m) => { based.push([g, m]); game.gold = g; } };
  const api = createMMApi({ pvp: () => pv, game });
  const r = await api.call('isl_contract', { contract: 'cave_raiders' }); assert.ok(r.ok); assert.equal(api.live, true); assert.deepEqual(based[0], [777, { rev: 9, owner: false }]); assert.equal(api.qty('sea_pearl'), 2);
  up = false; const r2 = await api.call('isl_crate', { tier: 'standard', run: 'crate_x' }); assert.equal(r2.ok, false); assert.equal(r2.error, 'offline'); assert.equal(game.gold, 777, 'no local mint once live');
});

// ---------------- the hooks stay surgical ----------------
test('hooks: dock / battle / walker / zipline / houses / inventory are 1-line hooks; module is a dynamic import', () => {
  const d = src('js/dock/index.js');
  assert.match(d, /import\('\.\.\/island\/moneyMakers\/index\.js'\)\.then\(m => m\.createMoneyMakers\(/); assert.doesNotMatch(d, /^import .*moneyMakers/m, 'not in the static import graph (preload list unchanged)');
  assert.match(d, /if \(q\.mm\) \{ mm\?\.interact\(q\); return; \}/); assert.match(d, /case 'bounties': if \(mm\) mm\.openBoard\(\)/); assert.doesNotMatch(d, /bounties coming soon/);
  assert.match(d, /mm\?\.tick\(dt, onFoot && !shipHull\?\.inHull\)/); assert.match(d, /\.\.\.\(mm\?\.netState\?\.\(\) \|\| \{\}\)/); assert.match(d, /mm\?\.onPeer\?\.\(m\)/);
  const b = src('js/onfoot/battle.js'); assert.match(b, /globalThis\.PFP_PVE\?\.sword\?\.\(W, f, S\)/); assert.match(b, /globalThis\.PFP_PVE\?\.shot\?\.\(x, z, f, best, S\.dmg\)/);
  assert.match(b, /new CustomEvent\('pfp-pvp-kill'/); assert.match(b, /new CustomEvent\('pfp-pvp-down'/);
  assert.match(src('js/onfoot/walker.js'), /if \(w\.carryK\) want \*= w\.carryK;/);
  assert.match(src('js/dock/zipline.js'), /if \(walker\.w\.noZipline\) \{ toast\?\.\('Too heavy for the zipline! Haul the crate on foot\.'/);
  const h = src('js/dock/houses.js'); assert.match(h, /globalThis\.PFP_MM\?\.houseRoom\?\.\(interior, d\)/); assert.match(h, /tag === 'still'\) return globalThis\.PFP_MM\?\.stillAct/);
  assert.match(h, /interior = buildInteriorRoom\(\{ tier, cottageId: d\.id, low \}\)/); assert.equal((h.match(/new THREE\.PointLight/g) || []).length, 4, 'no new lights in the cottage');
  assert.match(src('js/inventory/ui.js'), /new CustomEvent\('pfp-inv-render', \{ detail: \{ el, mode \} \}\)/);
  const mm = src('js/island/moneyMakers/index.js'); assert.doesNotMatch(mm, /PointLight|SpotLight/, 'props use emissive, no extra lights');
  assert.ok(existsSync(new URL('../js/island/moneyMakers/props.js', import.meta.url)) && existsSync(new URL('../js/island/moneyMakers/enemies.js', import.meta.url)));
  assert.doesNotMatch(src('sw.js'), /moneyMakers/, 'sw.js untouched');
});
test('props: every money-maker prop builds (THREE, no downloads) and sits on its own footprint', async () => {
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } }) }) };
  const P = await import('../js/island/moneyMakers/props.js');
  for (const f of ['wantedBoard', 'fightMaster', 'crateStack', 'rumStall', 'spicePlot', 'copperStill', 'crabPot', 'wreckChest', 'clam', 'diveBuoy', 'carriedCrate']) { const o = P[f](); assert.ok(o.isObject3D || o.isGroup, f); }
  const plot = P.spicePlot(); plot.userData.setStage(2); const ore = P.oreVein('gold', 0xffcd3c, 0xffe27a); ore.userData.setCharges(0); assert.ok(ore.userData.gems.every(g => !g.visible));
  const M = src('js/island/moneyMakers/index.js'); for (const k of ['wanted', 'fight', 'horde', 'rum', 'crates', 'buyers', 'dive', 'pots', 'mine']) assert.match(M, new RegExp(`\\b${k}: `));
});
