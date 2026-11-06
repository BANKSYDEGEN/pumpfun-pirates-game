// Migration 053 functional checks in PGlite (in-process Postgres). Not a *.test.mjs: it needs @electric-sql/pglite, which this repo does not ship.
// Run: PFP_PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js node tests/sql/053_island_check.mjs   (NOSAVE=1 = no save column)
// tests/v349IslandMoneyMakers.test.mjs runs this file automatically when PFP_PGLITE is set.
import { readFileSync } from 'fs';
const { PGlite } = await import(process.env.PFP_PGLITE || '@electric-sql/pglite');
const MIG = readFileSync(new URL('../../supabase/migrations/053_island_money_makers.sql', import.meta.url), 'utf8');
const STUB = `
create table pvp_flags (k text primary key, on_ boolean not null, note text, updated_at timestamptz default now());
create function pvp_flag(p_k text) returns boolean language sql stable as $$ select coalesce((select on_ from pvp_flags where k = p_k), false) $$;
create function pvp_main(p_id text) returns text language sql stable as $$ select p_id $$;
create function pvp_inv_owner() returns text language sql immutable as $$ select 'dev:e191a32e15abea4f14355121'::text $$;
create function pvp_rl_hit(p_key text, p_window_s integer, p_max integer) returns boolean language sql as $$ select true $$;
create table pvp_profiles (id text primary key, gold integer not null default 0, shop_rev integer not null default 0);
create table pvp_dev_profiles (id text primary key, gold integer not null default 0, shop_rev integer not null default 0);
create table pvp_group_saves (main text primary key, gold integer not null default 0, upgrades jsonb default '{}', devs text[] default '{}', updated_at timestamptz default now() ${process.env.NOSAVE ? '' : ", save jsonb"});
create table pvp_houses (player_id text, cottage_id text, primary key (player_id, cottage_id));
create table pvp_players (id text primary key, name text not null, updated_at timestamptz default now());
create table pvp_kills (id bigserial primary key, killer_id text not null references pvp_players(id), victim_id text not null references pvp_players(id), room text not null default 'pfp-pvp-v1-1',
  killer_net text not null default 'kkkkkk', victim_net text not null default 'vvvvvv', life integer not null default 0, created_at timestamptz not null default now(), check (killer_id <> victim_id));
insert into pvp_players (id, name) values ('dev:aaaaaaaaaaaaaaaaaaaaaaaa', 'Alpha'), ('dev:bbbbbbbbbbbbbbbbbbbbbbbb', 'Bravo'), ('dev:cccccccccccccccccccccccc', 'Charlie'),
  ('wallet:WaLLetWaLLetWaLLetWaLLetWaLLetWa', 'Wally'), ('dev:e191a32e15abea4f14355121', 'BANKSY');
create role anon; create role authenticated;
insert into pvp_dev_profiles values ('dev:aaaaaaaaaaaaaaaaaaaaaaaa', 2000, 3), ('dev:bbbbbbbbbbbbbbbbbbbbbbbb', 2000, 0), ('dev:cccccccccccccccccccccccc', 1000, 0);
insert into pvp_profiles values ('wallet:WaLLetWaLLetWaLLetWaLLetWaLLetWa', 500, 1);
insert into pvp_group_saves (main, gold) values ('dev:e191a32e15abea4f14355121', 777);
insert into pvp_houses values ('dev:aaaaaaaaaaaaaaaaaaaaaaaa', 'balcony');
`;
const db = new PGlite();
const gold = async (id) => (await q(`select gold from pvp_dev_profiles where id = $1 union all select gold from pvp_profiles where id = $1`, [id]))[0]?.gold;
const kill = async (k, v, ago = 0) => (await q(`insert into pvp_kills (killer_id, victim_id, life, created_at) values ($1, $2, (random() * 1e6)::int, now() - make_interval(secs => $3)) returning id`, [k, v, ago]))[0].id;
let fails = 0; const ok = (c, m, extra) => { if (!c) { fails++; console.log('FAIL', m, extra ?? ''); } else console.log('ok  ', m); };
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (fn, args) => { const ph = args.map((_, i) => '$' + (i + 1)).join(','); const r = await q(`select public.${fn}(${ph}) as r`, args); return r[0].r; };
await db.exec(STUB); await db.exec(MIG); console.log('migration applied');
const A = 'dev:aaaaaaaaaaaaaaaaaaaaaaaa', B = 'dev:bbbbbbbbbbbbbbbbbbbbbbbb', C = 'dev:cccccccccccccccccccccccc', O = 'dev:e191a32e15abea4f14355121', W = 'wallet:WaLLetWaLLetWaLLetWaLLetWaLLetWa';
await db.exec(MIG); console.log('migration re-applied (idempotent)');
// contract
let r = await call('pvp_isl_contract', [A, 'cave_raiders', 'req_contract_1']); ok(r.ok && r.gold === 2150 && r.paid === 150 && r.rev === 3, 'contract pays 150', r);
r = await call('pvp_isl_contract', [A, 'cave_raiders', 'req_contract_1']); ok(r.ok && r.retry && r.gold === 2150, 'contract retry idempotent', r);
r = await call('pvp_isl_contract', [A, 'cave_raiders', 'req_contract_2']); ok(!r.ok && r.why === 'claimed today', 'contract once a day', r);
r = await call('pvp_isl_contract', [A, 'nope', 'req_contract_3']); ok(!r.ok, 'bad contract');
// owner gold + save sync
r = await call('pvp_isl_contract', [O, 'salvage_patrol', 'req_owner_c1']); ok(r.ok && r.owner && r.gold === 877, 'owner credit to pot', r);
if (!process.env.NOSAVE) { const s = await q(`select gold, save from pvp_group_saves where main = $1`, [O]); ok(s[0].gold === 877 && s[0].save.gold === 877, 'owner save.gold synced', s[0]); }
// bounty
r = await call('pvp_isl_bounty_post', [A, 'Alpha', 'Bravo', 250, 'req_bpost_1']); ok(r.ok && r.gold === 1900 && r.pot === 250 && r.rev === 4, 'bounty post debits + rev bump', r);
r = await call('pvp_isl_bounty_post', [C, 'Charlie', 'bravo', 100, 'req_bpost_2']); ok(r.ok && r.pot === 350, 'pot stacks case-insensitive', r);
r = await call('pvp_isl_bounty_post', [A, 'Alpha', 'alpha', 100, 'req_bpost_3']); ok(!r.ok, 'no bounty on yourself');
r = await call('pvp_isl_bounty_post', [A, 'Alpha', 'Bravo', 50, 'req_bpost_4']); ok(!r.ok, 'min stake 100');
r = await call('pvp_isl_bounty_post', [C, 'Charlie', 'Bravo', 5000, 'req_bpost_5']); ok(!r.ok && r.why === 'not enough gold', 'not enough gold', r);
let bd = await call('pvp_isl_board', []); ok(bd.wanted.length === 1 && bd.wanted[0].pot === 350 && bd.wanted[0].name === 'Bravo', 'board lists Bravo 350', bd.wanted);
r = await call('pvp_isl_bounty_claim', [B, 'Bravo', 'Bravo', 'req_bclaim_0']); ok(!r.ok, 'target cannot claim own');
r = await call('pvp_isl_bounty_claim', [C, 'Charlie', 'Bravo', 'req_bclaim_f']); ok(!r.ok && r.why === 'no confirmed kill' && r.pending, '[fix 4] FAKE bounty claim (no confirmed kill) pays nothing', r);
ok((await gold(C)) === 900, '[fix 4] fake claim left the gold alone', await gold(C));
await kill(C, B, 20 * 60); r = await call('pvp_isl_bounty_claim', [C, 'Charlie', 'Bravo', 'req_bclaim_f2']); ok(!r.ok && r.why === 'no confirmed kill', '[fix 4] a stale kill (20 min) does not pay', r);
await kill(C, W); r = await call('pvp_isl_bounty_claim', [C, 'Charlie', 'Bravo', 'req_bclaim_f3']); ok(!r.ok && r.why === 'no confirmed kill', '[fix 4] a kill of ANOTHER pirate does not pay', r);
await kill(B, C); r = await call('pvp_isl_bounty_claim', [C, 'Charlie', 'Bravo', 'req_bclaim_f4']); ok(!r.ok && r.why === 'no confirmed kill', '[fix 4] being killed BY the target does not pay', r);
const KB = await kill(C, B);
r = await call('pvp_isl_bounty_claim', [C, 'Charlie', 'Bravo', 'req_bclaim_1']); ok(r.ok && r.claimed === 350 && r.gold === 1250 && String(r.kill) === String(KB), 'claim pays pot on a confirmed kill', r);
r = await call('pvp_isl_bounty_claim', [C, 'Charlie', 'Bravo', 'req_bclaim_1']); ok(r.ok && r.retry && r.gold === 1250, 'claim retry', r);
r = await call('pvp_isl_bounty_post', [A, 'Alpha', 'Bravo', 100, 'req_bpost_again']); ok(r.ok, 'a new pot on Bravo', r);
r = await call('pvp_isl_bounty_claim', [C, 'Charlie', 'Bravo', 'req_bclaim_again']); ok(!r.ok && r.why === 'no confirmed kill', '[fix 4] the same kill is consumed once (second pot not paid)', r);
ok((await q(`select count(*)::int n from pvp_isl_kill_used where kill_id = $1`, [KB]))[0].n === 1, '[fix 4] kill marked used once');
await q(`delete from pvp_isl_bounties where target_key = 'bravo'`); await q(`update pvp_dev_profiles set gold = gold + 100 where id = $1`, [A]);
r = await call('pvp_isl_bounty_claim', [A, 'Alpha', 'Bravo', 'req_bclaim_2']); ok(!r.ok && r.why === 'no bounty', 'pot gone', r);
bd = await call('pvp_isl_board', []); ok(bd.wanted.length === 0 && bd.claims.length === 1 && bd.claims[0].gold === 350, 'board claim announce', bd.claims);
// duel + bets
r = await call('pvp_isl_duel_post', [A, 'Alpha', 500, 'req_duel_post1']); ok(r.ok && r.gold === 1400 && r.duel, 'duel post', r); const D = r.duel;
r = await call('pvp_isl_duel_post', [A, 'Alpha', 500, 'req_duel_post2']); ok(!r.ok, 'one fight at a time');
r = await call('pvp_isl_bet', [C, 'Charlie', D, 'r', 200, 'req_bet_c']); ok(r.ok && r.gold === 1050, 'bet on red', r);
r = await call('pvp_isl_bet', [W, 'Wally', D, 'b', 100, 'req_bet_w']); ok(r.ok && r.gold === 400, 'wallet bet on blue', r);
r = await call('pvp_isl_bet', [A, 'Alpha', D, 'b', 100, 'req_bet_a']); ok(!r.ok, 'fighter cannot bet');
r = await call('pvp_isl_duel_accept', [A, 'Alpha', D, 'req_acc_self']); ok(!r.ok, 'no self accept');
r = await call('pvp_isl_duel_accept', [B, 'Bravo', D, 'req_acc_b']); ok(r.ok && r.gold === 1500 && r.side === 'b', 'accept', r);
r = await call('pvp_isl_duel_settle', [C, D, 'won']); ok(!r.ok, 'outsider cannot settle');
r = await call('pvp_isl_duel_settle', [B, D, 'lost']); ok(r.ok && r.winner === 'r' && r.pot === 1000 && !r.you_won, 'loser concedes -> red wins', r);
const g = Object.fromEntries((await q(`select id, gold from pvp_dev_profiles`)).map(x => [x.id, x.gold]));
ok(g[A] === 2400, 'red got pot 1000', g[A]); ok(g[C] === 1050 + 300, 'red bettor gets whole pool', g[C]);
r = await call('pvp_isl_duel_settle', [A, D, 'won']); ok(r.ok && r.settled, 'second settle is a no-op', r);
r = await call('pvp_isl_duel_accept', [B, 'Bravo', D, 'req_acc_b']); ok(r.ok && r.retry && r.side === 'b', '[fix 1] accept retry = first reply, no change', r);
r = await call('pvp_isl_duel_accept', [C, 'Charlie', D, 'req_acc_b']); ok(!r.ok && r.why === 'request id reused', "[fix 1] another pirate replaying B's accept req is rejected", r);
// [fix 1] a duel that is OPEN: the poster replays his own post req as an accept -> rejected, nothing goes live
let gA = await gold(A); r = await call('pvp_isl_duel_post', [A, 'Alpha', 100, 'req_duel_post9']); const D9 = r.duel; ok(r.ok, 'post D9', r);
r = await call('pvp_isl_duel_post', [A, 'Alpha', 100, 'req_duel_post9']); ok(r.ok && r.retry && r.duel === D9, '[fix 1] post retry returns the same fight', r);
r = await call('pvp_isl_duel_post', [A, 'Alpha', 250, 'req_duel_post9']); ok(!r.ok && r.why === 'request id reused', '[fix 1] post replay with another stake rejected', r);
r = await call('pvp_isl_duel_accept', [A, 'Alpha', D9, 'req_duel_post9']); ok(!r.ok && r.why === 'request id reused', '[fix 1] post req replayed as an accept rejected', r);
r = await call('pvp_isl_duel_accept', [C, 'Charlie', D9, 'req_contract_1']); ok(!r.ok && r.why === 'request id reused', "[fix 1] someone else's contract req replayed as an accept rejected", r);
ok((await q(`select status from pvp_isl_duels where id = $1`, [D9]))[0].status === 'open', '[fix 1] D9 still open (no stake-free live)');
// [fix 3] fake duel win: C accepts D9, A reports 'won' without any confirmed KO -> nothing paid
r = await call('pvp_isl_duel_accept', [C, 'Charlie', D9, 'req_acc_c9']); ok(r.ok, 'C accepts D9', r);
gA = await gold(A); let gC = await gold(C);
r = await call('pvp_isl_duel_settle', [A, D9, 'won']); ok(!r.ok && r.pending && /confirm/.test(r.why), '[fix 3] FAKE duel win (self-report, no KO) is not paid', r);
r = await call('pvp_isl_duel_settle', [C, D9, 'won']); ok(!r.ok && r.pending, '[fix 3] the other fighter cannot fake it either', r);
ok((await gold(A)) === gA && (await gold(C)) === gC && (await q(`select status from pvp_isl_duels where id = $1`, [D9]))[0].status === 'live', '[fix 3] no gold moved, fight still live');
// a both-sides-confirmed KO on the board after the start pays the claimant
await q(`update pvp_isl_duels set started_at = now() - interval '30 seconds' where id = $1`, [D9]);
await kill(A, C, 60); r = await call('pvp_isl_duel_settle', [A, D9, 'won']); ok(!r.ok && r.pending, '[fix 3] a KO from BEFORE the fight does not count', r);
await kill(A, C); r = await call('pvp_isl_duel_settle', [A, D9, 'won']); ok(r.ok && r.winner === 'r' && r.you_won && (await gold(A)) === gA + 200, '[fix 3] confirmed KO (pvp_kills) pays the winner', r);
// timeout: a live fight nobody concedes refunds both stakes after 10 min
r = await call('pvp_isl_duel_post', [B, 'Bravo', 250, 'req_duel_postT']); const DT = r.duel;
r = await call('pvp_isl_duel_accept', [W, 'Wally', DT, 'req_acc_wT']); ok(r.ok, 'W accepts DT', r);
let gB = await gold(B); let gW = await gold(W);
r = await call('pvp_isl_duel_settle', [B, DT, 'won']); ok(!r.ok && r.pending, 'DT unconfirmed win pending');
r = await call('pvp_isl_duel_settle', [W, DT, 'cancel']); ok(!r.ok, '[fix 3] no cancel while the fight is on');
await q(`update pvp_isl_duels set started_at = now() - interval '11 minutes' where id = $1`, [DT]);
r = await call('pvp_isl_duel_settle', [A, DT, 'cancel']); ok(r.ok && r.status === 'cancelled', '[fix 3] expired live fight -> cancel', r);
ok((await gold(B)) === gB + 250 && (await gold(W)) === gW + 250, '[fix 3] timeout refunds both stakes', [await gold(B), await gold(W)]);
// [fix 1] cross-operation replay on the ledger
gA = await gold(A);
r = await call('pvp_isl_crate', [A, 'standard', 'crateRunX001', 'req_contract_1']); ok(!r.ok && r.why === 'request id reused', '[fix 1] a contract req replayed as a crate is rejected', r);
r = await call('pvp_isl_contract', [A, 'cursed_captains', 'req_contract_1']); ok(!r.ok && r.why === 'request id reused', '[fix 1] same kind, other ref rejected', r);
r = await call('pvp_isl_move', [A, 999, 'req_contract_1', 'contract', 'cave_raiders', null]); ok(!r.ok && r.why === 'request id reused', '[fix 1] same kind + ref, other delta rejected', r);
r = await call('pvp_isl_move', [B, 150, 'req_contract_1', 'contract', 'cave_raiders', null]); ok(!r.ok && r.why === 'request id reused', '[fix 1] other player rejected', r);
ok((await gold(A)) === gA, '[fix 1] replays moved no gold');
// [fix 2] one-time payouts are unique in the table: a second crate row for the same run never pays, even straight through pvp_isl_move
r = await call('pvp_isl_move', [A, 100, 'req_uniq_1', 'crate', 'uniqRun0001', null]); ok(r.ok, 'first crate row');
r = await call('pvp_isl_move', [A, 100, 'req_uniq_2', 'crate', 'uniqRun0001', null]); ok(!r.ok && r.why === 'already paid' && (await gold(A)) === gA + 100, '[fix 2] unique index blocks a double pay and rolls the gold back', r);
const st = await call('pvp_isl_state', [A, 0]); ok(st.credits.some(c => c.kind === 'duel_win' && c.delta === 1000), 'state credits show duel win', st.credits);
// cancel refund
const gC2 = await gold(C); r = await call('pvp_isl_duel_post', [C, 'Charlie', 100, 'req_duel_post3']); const D2 = r.duel;
r = await call('pvp_isl_duel_settle', [C, D2, 'cancel']); ok(r.ok && r.status === 'cancelled' && r.gold === gC2, 'cancel refunds stake', r);
// horde
r = await call('pvp_isl_horde', [A, 'runAAAAAAAA', 2, 'req_hh_2']); ok(!r.ok && r.why.includes('order'), 'waves in order', r);
r = await call('pvp_isl_horde', [A, 'runAAAAAAAA', 1, 'req_hh_1']); ok(r.ok && r.paid === 60, 'wave 1', r);
r = await call('pvp_isl_horde', [A, 'runAAAAAAAA', 1, 'req_hh_1b']); ok(!r.ok, 'wave paid once', r);
r = await call('pvp_isl_horde', [A, 'runAAAAAAAA', 2, 'req_hh_2b']); ok(!r.ok && r.why === 'slow down', '12 s between waves', r);
// crate
r = await call('pvp_isl_crate', [B, 'cutthroat', 'crateRun0001', 'req_crate_1']); ok(r.ok && r.paid === 220, 'cutthroat crate', r);
r = await call('pvp_isl_crate', [B, 'cutthroat', 'crateRun0001', 'req_crate_2']); ok(!r.ok, 'same run once', r);
// goods: gather, timers, sell
r = await call('pvp_isl_gather', [A, 'mine', 'dm_iron_1', 'iron', 'req_mine_1']); ok(r.ok && r.goods['isl:iron_ore'] >= 1, 'mine gives iron', r);
r = await call('pvp_isl_gather', [A, 'mine', 'dm_iron_1', 'iron', 'req_mine_2']); ok(r.ok, 'mine 2nd swing');
r = await call('pvp_isl_gather', [A, 'mine', 'dm_iron_1', 'iron', 'req_mine_3']); ok(r.ok, 'mine 3rd swing');
r = await call('pvp_isl_gather', [A, 'mine', 'dm_iron_1', 'iron', 'req_mine_4']); ok(!r.ok && r.why === 'depleted', 'node depleted after 3', r);
r = await call('pvp_isl_gather', [A, 'dive', 'wreck_chest_1', 'chest', 'req_dive_1']); ok(r.ok && Object.keys(r.items)[0].startsWith('isl:'), 'dive loot', r);
r = await call('pvp_isl_timer_start', [A, 'crab', 'dock_beach_1', false, 'req_crab_s1']); ok(r.ok, 'crab pot set', r);
r = await call('pvp_isl_timer_finish', [A, 'crab', 'dock_beach_1', 'req_crab_f1']); ok(!r.ok && r.why === 'not ready' && r.left_s > 800, 'pot not ready', r);
await q(`update pvp_isl_timers set started_at = now() - interval '16 minutes' where player_id = $1 and kind = 'crab'`, [A]);
r = await call('pvp_isl_timer_finish', [A, 'crab', 'dock_beach_1', 'req_crab_f2']); ok(r.ok && Object.values(r.items).reduce((a, b) => a + b, 0) >= 2, 'haul 2-4 crabs', r);
for (const s of ['s1', 's2', 's3']) await call('pvp_isl_timer_start', [A, 'crab', 'spot_' + s, false, 'req_crabx_' + s]);
r = await call('pvp_isl_timer_start', [A, 'crab', 'spot_s4', false, 'req_crabx_s4']); ok(!r.ok && r.why === 'three pots max', '3 pots max', r);
r = await call('pvp_isl_timer_start', [B, 'plot', 'balcony', false, 'req_plot_b']); ok(!r.ok && r.why.includes('cottage'), 'plot needs cottage', r);
r = await call('pvp_isl_timer_start', [A, 'plot', 'balcony', false, 'req_plot_a']); ok(r.ok, 'owner plants plot');
await q(`update pvp_isl_timers set started_at = now() - interval '14 minutes' where player_id = $1 and kind = 'plot'`, [A]);
r = await call('pvp_isl_timer_finish', [A, 'plot', 'balcony', 'req_plot_h']); ok(r.ok && r.goods['isl:island_cane'] === 2 && r.goods['isl:island_spices'] === 2, 'harvest cane + spices', r);
r = await call('pvp_isl_timer_start', [A, 'still', 'balcony', true, 'req_still_a']); ok(r.ok && !r.goods['isl:island_cane'] && r.goods['isl:island_spices'] === 1, 'homegrown brew takes 2 cane + 1 spice', r);
await q(`update pvp_isl_timers set started_at = now() - interval '16 minutes' where player_id = $1 and kind = 'still'`, [A]);
r = await call('pvp_isl_timer_finish', [A, 'still', 'balcony', 'req_still_f']); ok(r.ok && r.goods['isl:reserve_spiced_rum'] === 2, 'reserve rum x2', r);
const before = (await q(`select gold from pvp_dev_profiles where id = $1`, [A]))[0].gold;
r = await call('pvp_isl_sell', [A, 'isl:reserve_spiced_rum', 2, 'rum', 'req_sell_rum']); ok(r.ok && r.gold === before + 350 && !r.goods['isl:reserve_spiced_rum'], 'sell 2 reserve rum @175 at rum stall', r);
r = await call('pvp_isl_sell', [A, 'isl:iron_ore', 1, 'fish', 'req_sell_bad']); ok(!r.ok, 'fish market does not buy ore');
r = await call('pvp_isl_sell', [A, 'isl:iron_ore', 999, 'antiques', 'req_sell_many']); ok(!r.ok && r.why === 'not enough', 'cannot oversell');
r = await call('pvp_isl_timer_start', [A, 'still', 'balcony', false, 'req_still_mash']); ok(r.ok && r.delta === -25, 'mash costs 25g', r);
r = await call('pvp_isl_state', [A, 0]); ok(r.ok && Array.isArray(r.timers) && r.contracts.includes('cave_raiders'), 'state', { t: r.timers.length });
console.log(fails ? `FAILED ${fails}` : 'ALL SQL CHECKS PASSED'); process.exit(fails ? 1 : 0);
