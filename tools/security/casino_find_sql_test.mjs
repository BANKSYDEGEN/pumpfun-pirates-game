// [security C1/H3/H2 2026-11-09] Isolated PostgreSQL/WASM; no production connections. Run from a directory with @electric-sql/pglite.
// Applies 20261110020000_security_crit_high.sql on a stub schema and checks: a retried casino request id never pays twice,
// the retry returns the original stake + stored result, one settle per key, the rate limit counts retries, and inv_find spots.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const { PGlite } = await import(createRequire(process.cwd() + '/x.js').resolve('@electric-sql/pglite'));
const db = new PGlite();
const read = f => readFileSync(new URL('../../supabase/migrations/' + f, import.meta.url), 'utf8');
const fnUp = (file, name) => { const s = read(file), a = s.indexOf('CREATE OR REPLACE FUNCTION public.' + name + '('); assert.ok(a >= 0, name); return s.slice(a, s.indexOf('$function$', s.indexOf('AS $function$', a) + 14) + 10) + ';'; };
const call = async (q, args = []) => Object.values((await db.query(q, args)).rows[0])[0];
let checks = 0; const check = (v, m) => { assert.ok(v, m); checks++; };
const OWNER = 'dev:e191a32e15abea4f14355121';
await db.exec(`create role anon; create role authenticated; create role service_role;
create function pvp_main(text) returns text language sql as $$select $1$$;
create function pvp_inv_owner() returns text language sql immutable as $$ select '${OWNER}'::text $$;
create table pvp_flags(k text primary key,on_ boolean,note text); insert into pvp_flags values ('casino',true,'');
create function pvp_flag(text) returns boolean language sql as $$select coalesce((select on_ from pvp_flags where k=$1),false)$$;
create table rl(k text primary key, n int); create table rl_max(m int); insert into rl_max values (1000);
create function pvp_rl_hit(p_key text,p_window_s int,p_max int) returns boolean language plpgsql as $$ declare c int; begin
  insert into rl values (p_key,1) on conflict (k) do update set n=rl.n+1 returning n into c; return c <= least(p_max,(select m from rl_max)); end $$;
create table pvp_purchases(id bigserial primary key, player_id text not null, req text not null unique check (char_length(req) between 16 and 64),
  item text not null, price integer not null check (price >= 0), gold_before integer not null, gold_after integer not null, rev integer not null, created_at timestamptz not null default now());
create table pvp_profiles(id text primary key, gold int, shop_rev int default 0);
create table pvp_dev_profiles(id text primary key, gold int, shop_rev int default 0);
create table pvp_group_saves(main text primary key, gold int default 0);
create table pvp_inv_once(player_id text, k text, primary key(player_id,k));
create table pvp_inv_add_log(pid text, item text, qty int, src text, why text, ref text);
create function pvp_inv_add(p_pid text,p_item text,p_qty int,p_src text,p_why text,p_ref text) returns void language sql as $$ insert into pvp_inv_add_log values (p_pid,p_item,p_qty,p_src,p_why,p_ref) $$;
create table pvp_loot_bags(id uuid primary key, x float8, z float8);
create table scores(id bigserial primary key, score int);
alter table scores enable row level security;
grant insert, select, update, delete on scores to anon, authenticated;
create policy "anyone can submit a score" on scores for insert to anon, authenticated with check (true);
create policy "anon cannot self-verify" on scores as restrictive for insert to anon, authenticated with check (true);
create policy "anyone can read scores" on scores for select to anon, authenticated using (true);
insert into pvp_dev_profiles values ('dev:a',1000,0),('dev:b',50,0); insert into pvp_group_saves values ('${OWNER}',5000);
`);
await db.exec(fnUp('057_casino_house_owner.sql', 'pvp_casino_credit'));
await db.exec(read('20261110020000_security_crit_high.sql'));
const gold = async (p) => +(await call('select gold from pvp_dev_profiles where id=$1', [p]));
const house = async () => +(await call('select gold from pvp_group_saves where main=$1', [OWNER]));
const debit = (p, bet, req, game = 'dice') => call('select pvp_casino_debit($1,$2,$3,$4)', [p, bet, req, game]);
const settle = (p, key, payout, body = { ok: true, outcome: 'win', payout }, bet = 100, game = 'dice') => call('select pvp_casino_settle($1,$2,$3,$4,$5,$6,$7)', [p, key, game, bet, payout, 'n', body]);
const R1 = 'cas_000000000000000000000001';

// C1: first round
let d = await debit('dev:a', 100, R1);
check(d.ok && !d.retry && d.debited === 100 && await gold('dev:a') === 900 && await house() === 5100, 'first debit takes the stake into the house');
let s = await settle('dev:a', R1, 300);
check(s.ok && s.settled && s.credited === 300 && await gold('dev:a') === 1200 && await house() === 4800, 'first settle pays once');
// the same request id again, even with a bigger bet: original stake, stored result, no new debit
d = await debit('dev:a', 25000, R1);
check(d.ok && d.retry && d.debited === 100 && d.game === 'dice' && d.result?.payout === 300 && await gold('dev:a') === 1200, 'retry: original stake + stored result, no second debit');
s = await settle('dev:a', R1, 999);
check(!s.ok && s.why === 'settled' && s.stored?.payout === 300 && await gold('dev:a') === 1200 && await house() === 4800, 'second settle of the same key pays nothing');
check(+(await call('select count(*) from pvp_purchases')) === 1 && +(await call('select count(*) from pvp_casino_results')) === 1, 'one purchase row, one result row');
// a retry from another player is refused
check((await debit('dev:b', 100, R1)).why === 'bad request', 'another player cannot reuse a request id');
// retry before the round settled: no stored result yet (edge answers "still being settled"), still no second debit
const R2 = 'cas_000000000000000000000002';
await debit('dev:a', 50, R2); d = await debit('dev:a', 50, R2);
check(d.retry && d.result === null && await gold('dev:a') === 1150, 'unsettled retry: result null, no second debit');
// a shop purchase req can't be replayed as a casino round
await db.query("insert into pvp_purchases (player_id, req, item, price, gold_before, gold_after, rev) values ('dev:a','shop_0000000000000001','skin:x',10,0,0,0)");
check((await debit('dev:a', 100, 'shop_0000000000000001')).why === 'bad request', 'a non-casino purchase id is refused');
// H3: blackjack hand key settles once (stand vs stand / double race)
s = await settle('dev:a', 'bjs:hand0000000000000001', 200, { outcome: 'win' }, 100, 'blackjack');
const s2 = await settle('dev:a', 'bjs:hand0000000000000001', 200, { outcome: 'win' }, 100, 'blackjack');
check(s.ok && !s2.ok && s2.why === 'settled' && await gold('dev:a') === 1350, 'hand settles once');
// rate limit counts retries
await db.exec('update rl_max set m = 0');
check((await debit('dev:a', 100, R1)).why === 'slow down', 'retries hit the rate limit too');
await db.exec('update rl_max set m = 1000');
// closed casino: settle refuses before storing anything
await db.exec("update pvp_flags set on_=false where k='casino'");
check((await settle('dev:a', 'cas_closed00000000000000', 10)).why === 'closed' && +(await call("select count(*) from pvp_casino_results where req='cas_closed00000000000000'")) === 0, 'closed: nothing stored');
await db.exec("update pvp_flags set on_=true where k='casino'");
// owner path
d = await debit(OWNER, 100, 'cas_owner000000000000001'); s = await settle(OWNER, 'cas_owner000000000000001', 200);
check(d.ok && d.owner && s.ok && s.owner && (await settle(OWNER, 'cas_owner000000000000001', 200)).why === 'settled', 'owner settles once');
// grants: only service_role can touch the results table / settle
check(!(await call("select has_table_privilege('anon','pvp_casino_results','select')")) && await call("select has_table_privilege('service_role','pvp_casino_results','insert')"), 'results table: service role only');
check(!(await call("select has_function_privilege('anon','pvp_casino_settle(text,text,text,integer,integer,text,jsonb)','execute')")), 'settle: not anon');

// H2: inv_find
const find = (item, spot, p = 'dev:a') => call('select pvp_inv_find($1,$2,$3)', [p, item, spot]);
for (let i = 0; i <= 6; i++) check((await find('val:idol_shard', 'jungle_shard_' + i)).ok, 'shard spot ' + i);
check((await find('val:idol_shard', 'jungle_shard_0')).why === 'found today', 'once per spot per day');
for (const sp of ['jungle_shard_7', 'jungle_shard_42', 'jungle_shard_99', 'lagoon_p1', 'lagoon_p_grotto', 'jungle_ruin_chest']) check((await find('val:idol_shard', sp)).why === 'bad find', 'no shard at ' + sp);
for (const sp of ['lagoon_p_grotto', 'lagoon_p1', 'lagoon_p5']) check((await find('val:river_pearl', sp)).ok, 'pearl ' + sp);
for (const sp of ['lagoon_p0', 'lagoon_p6', 'lagoon_p9', 'jungle_shard_1']) check((await find('val:river_pearl', sp)).why === 'bad find', 'no pearl at ' + sp);
check((await find('val:ruby', 'j_moss')).ok && (await find('val:ruby', 'lagoon_p2')).why === 'bad find', 'ruin chests unchanged');
check(+(await call("select count(*) from pvp_inv_add_log where item='val:idol_shard'")) === 7, 'exactly 7 shards per day');

// H4: anon can no longer write scores, can still read
check(!(await call("select has_table_privilege('anon','scores','insert')")) && !(await call("select has_table_privilege('authenticated','scores','update')")) && await call("select has_table_privilege('anon','scores','select')"), 'scores: anon read only');
check(+(await call("select count(*) from pg_policies where tablename='scores' and cmd='INSERT'")) === 0, 'insert policies dropped');
check(await call("select count(*) from information_schema.columns where table_name='pvp_loot_bags' and column_name='zone'") == 1, 'loot zone column');
// rerunnable
await db.exec(read('20261110020000_security_crit_high.sql'));
check(+(await call('select count(*) from pvp_casino_results')) >= 3, 'migration reruns without losing results');
console.log(`casino_find_sql_test: ${checks} checks ok`);
