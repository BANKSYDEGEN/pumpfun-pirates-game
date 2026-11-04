// [inventory] SQL test: in-memory Postgres (PGlite), no network, no real data: 026 + 035 + 036 on stub tables. Asserts every rule.
// Run: cd /tmp/pglite && node /workspace/pfp-inv/tools/inventory/sql_test.mjs   (needs @electric-sql/pglite there; ESM ignores NODE_PATH)
import { createRequire } from 'module'; import fs from 'fs'; import assert from 'assert/strict';
const { PGlite } = await import(createRequire(process.cwd() + '/x.js').resolve('@electric-sql/pglite'));
const db = new PGlite(); process.on("unhandledRejection", e => { console.error("SQL ERR", e.message, e.where || "", e.position || ""); process.exit(1); }); const M = new URL('../../supabase/migrations/', import.meta.url).pathname;
await db.exec(`create role anon; create role authenticated;
create function public.pvp_main(p_id text) returns text language sql as $$ select p_id $$;
create table pvp_players(id text primary key, name text);
create table pvp_profiles(id text primary key, gold int not null default 0);
create table pvp_dev_profiles(id text primary key, gold int not null default 0);
create table pvp_kills(id bigserial primary key, killer_id text, room text, life int);
create table pvp_rl (k text not null, w timestamptz not null, n integer not null default 0, primary key (k, w));
create function public.pvp_rl_hit(p_key text, p_window_s integer, p_max integer) returns boolean language plpgsql as $$
declare win timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s); c integer;
begin insert into pvp_rl (k, w, n) values (p_key, win, 1) on conflict (k, w) do update set n = pvp_rl.n + 1 returning n into c; return c <= p_max; end $$;
create table public.pvp_owned (player_id text not null, item text not null, source text not null check (source in ('buy','legacy','legacy_commodore','grant')), price integer not null default 0, uses_left integer, created_at timestamptz not null default now(), primary key (player_id, item));`);
for (const f of ['026_treasure_maps.sql', '035_chest_items.sql', '036_inventory.sql', '036_inventory.sql']) await db.exec(fs.readFileSync(M + f, 'utf8'));
const OWN = 'dev:e191a32e15abea4f14355121';
await db.exec(`insert into pvp_dev_profiles values ('dev:a',1000),('dev:b',50),('${OWN}',0); insert into pvp_profiles values ('wallet:W',0);
insert into pvp_owned values ('dev:a','gear:sword:rapier','buy',4000),('dev:a','gear:musket:navy','grant',0),('dev:a','gear:hat:tricorn','buy',400);
insert into pvp_maps(id,player_id,tier,spot,source,source_ref,created_at) values
 ('00000000-0000-4000-8000-000000000001','dev:a','common','dig1','boss','b1',now()-interval '1 hour'),
 ('00000000-0000-4000-8000-000000000002','dev:a','rare','dig2','kill','b2',now()-interval '1 hour'),
 ('00000000-0000-4000-8000-000000000003','dev:a','common','dig3','boss','b3',now()-interval '1 hour');`);
const one = async (s) => (await db.query(s)).rows[0]; const r = async (s) => Object.values(await one(s))[0];
const gold = async (id) => (await one(`select gold from pvp_dev_profiles where id='${id}' union all select gold from pvp_profiles where id='${id}'`))?.gold;
const qty = async (id, it) => +(await r(`select coalesce(sum(qty),0) from pvp_inv where player_id='${id}' and item='${it}'`));
const rlReset = () => db.exec('delete from pvp_rl');
let ok = 0; const t = (c, m) => { assert.ok(c, m); ok++; };
// carry-over: bought rapier = carry_buy (never resold), granted navy = carry_grant; pvp_owned untouched; idempotent
t(await r(`select pvp_inv_carry('dev:a')`) === 2, 'carry 2'); t(await r(`select pvp_inv_carry('dev:a')`) === 0, 'carry idempotent');
t(+(await r(`select count(*) from pvp_owned where player_id='dev:a'`)) === 3, 'pvp_owned untouched');
// dig = items only, no gold
const g0 = await gold('dev:a');
let d = await r(`select pvp_map_dig_inv('dev:a','00000000-0000-4000-8000-000000000001','dig1',false,'[{"item":"val:ruby","qty":2},{"item":"val:hack","qty":1},{"item":"wpn:sword:rapier:epic","qty":1}]','gear:hat:tricorn',false,'dup:hat:tricorn:common')`);
t(d.ok && d.gold === 0 && d.items.length === 2 && d.dup && d.dup_item === 'dup:hat:tricorn:common', 'dig items ' + JSON.stringify(d));
t(await gold('dev:a') === g0, 'dig paid no gold'); t(await qty('dev:a', 'val:ruby') === 2, 'ruby x2 stacked');
d = await r(`select pvp_map_dig_inv('dev:a','00000000-0000-4000-8000-000000000001','dig1',false,'[]',null,false,null)`); t(!d.ok && d.why === 'already dug', 're-dig');
d = await r(`select pvp_map_dig_inv('dev:b','00000000-0000-4000-8000-000000000002','dig2',false,'[]',null,false,null)`); t(!d.ok && d.why === 'not your map', 'not yours');
// sell: shop closed by default (flags off)
d = await r(`select pvp_inv_sell('dev:a','val:ruby',1,'antiques',1.0)`); t(!d.ok && d.why === 'shop closed', 'antiques flag off');
await db.exec(`update pvp_flags set on_=true where k in ('antiques_sell','fish_sell','market')`);
d = await r(`select pvp_inv_sell('dev:a','val:ruby',1,'antiques',1.0)`); t(d.ok && d.gold === 2000, 'ruby 2000');
d = await r(`select pvp_inv_sell('dev:a','val:ruby',1,'antiques',9)`); t(d.ok && d.gold === 2800 && +d.mult === 1.4, 'mult clamped to 1.40: ' + JSON.stringify(d));
d = await r(`select pvp_inv_sell('dev:a','val:ruby',1,'antiques',1)`); t(!d.ok && d.why === 'not enough', 'no more rubies');
await db.exec(`select pvp_inv_add('dev:a','val:crown_jewel',2,'chest','t')`);
d = await r(`select pvp_inv_sell('dev:a','val:crown_jewel',1,'antiques',0.2)`); t(d.ok && d.gold === 5000, 'mult floor 1.0');
d = await r(`select pvp_inv_sell('dev:a','val:crown_jewel',1,'antiques',1.4)`); t(d.ok && d.gold === 7000, 'legendary + max pet bonus = 7000, no 5000 cap');
d = await r(`select pvp_inv_sell('dev:a','val:ruby',1,'fish',1)`); t(!d.ok && d.why === 'not bought here', 'fish stand buys fish only');
d = await r(`select pvp_inv_sell('dev:a','wpn:sword:rapier:common',1,'antiques',1)`); t(!d.ok && d.why === 'not enough', 'gold-bought weapon never resold');
d = await r(`select pvp_inv_sell('dev:a','wpn:musket:navy:common',1,'antiques',1)`); t(d.ok && d.gold === 500, 'granted weapon sells');
d = await r(`select pvp_inv_sell('dev:a','dup:hat:tricorn:common',1,'antiques',1)`); t(d.ok && d.gold === 500, 'dup cosmetic sells');
d = await r(`select pvp_inv_sell('dev:a','map:00000000-0000-4000-8000-000000000003',1,'antiques',1)`); t(d.ok && d.gold === 100, 'map 100');
d = await r(`select pvp_map_dig_inv('dev:a','00000000-0000-4000-8000-000000000003','dig3',false,'[]',null,false,null)`); t(!d.ok, 'sold map cannot be dug');
// fish
await rlReset(); t((await r(`select pvp_fish_catch('dev:a','fish:koi')`)).ok, 'catch'); t(!(await r(`select pvp_fish_catch('dev:a','fish:koi')`)).ok, 'fish rate limit');
t(!(await r(`select pvp_fish_catch('dev:a','fish:shark')`)).ok, 'bad fish');
d = await r(`select pvp_inv_sell('dev:a','fish:koi',1,'fish',1)`); t(d.ok && d.gold === 300, 'koi 300');
// finds once per spot per day
t((await r(`select pvp_inv_find('dev:a','val:idol_shard','jungle_shard_0')`)).ok, 'find'); t(!(await r(`select pvp_inv_find('dev:a','val:idol_shard','jungle_shard_0')`)).ok, 'find once');
// gifting
await rlReset();
t((await r(`select pvp_inv_gift('dev:a','dev:a','val:idol_shard',1)`)).why === 'not to yourself', 'no self gift');
t((await r(`select pvp_inv_gift('dev:a','dev:nobody','val:idol_shard',1)`)).why === 'no such pirate', 'recipient must exist');
t((await r(`select pvp_inv_gift('dev:a','dev:b','val:idol_shard',5)`)).why === 'not enough', 'no dupes: qty checked');
d = await r(`select pvp_inv_gift('dev:a','dev:b','val:idol_shard',1)`); t(d.ok && d.left === 0 && await qty('dev:b', 'val:idol_shard') === 1, 'gift moved');
t((await r(`select pvp_inv_gift('dev:a','dev:b','wpn:sword:rapier:common',1)`)).why === 'not enough', 'bought weapon not giftable');
t((await r(`select pvp_inv_gift('dev:a','dev:b','map:00000000-0000-4000-8000-000000000002',1)`)).ok && (await one(`select player_id from pvp_maps where id='00000000-0000-4000-8000-000000000002'`)).player_id === 'dev:b', 'map gifted');
for (let i = 0; i < 6; i++) await db.query(`select pvp_inv_gift('dev:a','dev:b','val:crown_jewel',1)`); t((await r(`select pvp_inv_gift('dev:a','dev:b','val:crown_jewel',1)`)).why, 'gift rate limit');
// market
await rlReset(); await db.exec(`select pvp_inv_add('dev:a','val:diamond',3,'chest','t')`);
t((await r(`select pvp_mkt_list('dev:a','val:diamond',1,5)`)).why === 'bad price', 'min price');
t((await r(`select pvp_mkt_list('dev:a','val:diamond',1,2000000)`)).why === 'bad price', 'max price');
t((await r(`select pvp_mkt_list('dev:a','wpn:sword:rapier:common',1,100)`)).why === 'not enough', 'bought weapon not listable');
d = await r(`select pvp_mkt_list('dev:a','val:diamond',2,600)`); t(d.ok && await qty('dev:a', 'val:diamond') === 1, 'escrowed'); const L = d.listing;
t((await r(`select pvp_mkt_buy('dev:a',${L})`)).why === 'your own listing', 'no self buy');
t((await r(`select pvp_mkt_buy('dev:b',${L})`)).why === 'not enough gold', 'buyer gold checked');
await db.exec(`update pvp_dev_profiles set gold=1000 where id='dev:b'`); const ga = await gold('dev:a');
d = await r(`select pvp_mkt_buy('dev:b',${L})`); t(d.ok && await gold('dev:b') === 400 && await gold('dev:a') === ga && +(await r(`select pvp_inv_pot_take('dev:a')`)) === 600 && await gold('dev:a') === ga + 600 && await qty('dev:b', 'val:diamond') === 2, 'atomic buy');
t((await r(`select pvp_mkt_buy('wallet:W',${L})`)).why === 'gone', 'no double buy');
t(+(await r(`select count(*) from pvp_mkt_listings where id=${L} and status='sold'`)) === 1, 'closed once');
d = await r(`select pvp_mkt_list('dev:b','val:diamond',2,100)`); t((await r(`select pvp_mkt_cancel('dev:a',${d.listing})`)).why === 'gone', 'only seller cancels');
t((await r(`select pvp_mkt_cancel('dev:b',${d.listing})`)).ok && await qty('dev:b', 'val:diamond') === 2, 'cancel returns item');
t(!(await r(`select pvp_mkt_cancel('dev:b',${d.listing})`)).ok && await qty('dev:b', 'val:diamond') === 2, 'no double cancel dupe');
// fee flag
await db.exec(`update pvp_flags set on_=true where k='market_fee'`); d = await r(`select pvp_mkt_list('dev:b','val:diamond',1,1000)`); const gb = await gold('dev:b');
await db.exec(`update pvp_dev_profiles set gold=5000 where id='dev:a'`); await r(`select pvp_mkt_buy('dev:a',${d.listing})`); await r(`select pvp_inv_pot_take('dev:b')`); t(await gold('dev:b') === gb + 950, '5% fee');
// active cap
await rlReset(); await db.exec(`select pvp_inv_add('dev:a','fish:minnow',100,'fish','t')`); let last;
for (let i = 0; i < 21; i++) { if (i % 6 === 0) await rlReset(); last = await r(`select pvp_mkt_list('dev:a','fish:minnow',1,10)`); } t(last.why === 'too many listings', 'active cap 20');
// owner kit: owner only, once, sellable (lock off); lock on blocks
t((await r(`select pvp_inv_owner_kit('dev:a',array['val:ruby'],array['dig1','dig2'])`)).why === 'owner only', 'kit owner only');
t((await r(`select pvp_inv_owner_kit('${OWN}',array['val:ruby','fish:koi','wpn:sword:bone:legendary'],array['dig1','dig2'])`)).granted, 'kit');
t((await r(`select pvp_inv_owner_kit('${OWN}',array['val:ruby'],array['dig1'])`)).granted === false, 'kit once');
t(await qty(OWN, 'val:ruby') === 3 && +(await r(`select count(*) from pvp_maps where player_id='${OWN}'`)) === 9, 'kit contents');
await rlReset(); d = await r(`select pvp_inv_sell('${OWN}','val:ruby',1,'antiques',1)`); t(d.ok && d.owner && +(await r(`select gold from pvp_inv_owner_pot where player_id='${OWN}'`)) === 2000, 'owner sale -> pot');
t(+(await r(`select pvp_inv_pot_take('${OWN}')`)) === 2000 && +(await r(`select pvp_inv_pot_take('${OWN}')`)) === 0, 'pot taken once');
await db.exec(`update pvp_flags set on_=true where k='test_only_lock'`); t((await r(`select pvp_inv_gift('${OWN}','dev:a','val:ruby',1)`)).why === 'not enough', 'test_only_lock blocks kit');
// "concurrency": 6 buyers fire at one listing together, 5 gifts of a 2-stack fire together. PGlite runs them one at a time (a real
// Postgres runs them in parallel; the FOR UPDATE row locks in pvp_mkt_buy / pvp_inv_take give the same outcome): one buy, no dupes.
await rlReset(); await db.exec(`update pvp_flags set on_=false where k='test_only_lock'; insert into pvp_dev_profiles values ('dev:s',0); select pvp_inv_add('dev:s','val:gold_bar',3,'chest','t')`);
for (const b of ['dev:c1','dev:c2','dev:c3','dev:c4','dev:c5','dev:c6']) await db.exec(`insert into pvp_dev_profiles values ('${b}',100000)`);
const Lc = (await r(`select pvp_mkt_list('dev:s','val:gold_bar',1,700)`)).listing;
const buys = await Promise.all(['dev:c1','dev:c2','dev:c3','dev:c4','dev:c5','dev:c6'].map(b => r(`select pvp_mkt_buy('${b}',${Lc})`)));
t(buys.filter(x => x.ok).length === 1 && +(await r(`select coalesce(sum(qty),0) from pvp_inv where item='val:gold_bar' and player_id like 'dev:c%'`)) === 1, 'one listing = one buy');
t(+(await r(`select sum(gold) from pvp_dev_profiles where id like 'dev:c%'`)) === 600000 - 700, 'only the winner paid');
const gifts = await Promise.all([1,2,3,4,5].map(() => r(`select pvp_inv_gift('dev:s','dev:c1','val:gold_bar',1)`)));
t(gifts.filter(x => x.ok).length === 2 && await qty('dev:s','val:gold_bar') === 0, 'a 2-stack gives twice, never more');
t(+(await r(`select coalesce(sum(qty),0) from pvp_inv where item='val:gold_bar'`)) === 3, 'gold bars conserved');
console.log('SQL OK', ok, 'checks');
