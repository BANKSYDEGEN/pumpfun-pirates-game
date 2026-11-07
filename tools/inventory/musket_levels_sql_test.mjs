// [musket-levels] SQL test for migration 061 (in-memory PGlite, no network, no real data): 026 + 035 + 036 + 042 + 043 + 047 + 061 on stub
// tables (same stubs as sql_test.mjs). Checks the levelled keys, the level-up price / provenance / attachments / equip rules, the closed
// rank-up, salvage and Treasure Trader prices against js/inventory/catalog.js.
// Run: cd /tmp/pglite && node /workspace/<worktree>/tools/inventory/musket_levels_sql_test.mjs   (needs @electric-sql/pglite there)
import { createRequire } from 'module'; import fs from 'fs'; import assert from 'assert/strict';
const C = await import(new URL('../../js/inventory/catalog.js', import.meta.url).href);
const { PGlite } = await import(createRequire(process.cwd() + '/x.js').resolve('@electric-sql/pglite'));
const db = new PGlite(); const M = new URL('../../supabase/migrations/', import.meta.url).pathname;
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
create table pvp_purchases (id bigserial primary key, player_id text not null, req text not null unique, item text not null, price integer not null, gold_before integer not null, gold_after integer not null, rev integer not null, created_at timestamptz not null default now());
create table public.pvp_owned (player_id text not null, item text not null, source text not null check (source in ('buy','legacy','legacy_commodore','grant')), price integer not null default 0, uses_left integer, created_at timestamptz not null default now(), primary key (player_id, item));`);
for (const f of ['026_treasure_maps.sql', '035_chest_items.sql', '036_inventory.sql', '042_musket_rank_gunacc.sql', '043_houses.sql', '046_fix_house_take.sql', '047_per_gun_attachments.sql', '049_gift_weapons.sql']) {
  try { await db.exec(fs.readFileSync(M + f, 'utf8')); } catch (e) { console.error('LOAD', f, e.message); process.exit(1); } }
// a row that exists before 061 (every old key must still pass the new CHECKs)
await db.exec(`insert into pvp_dev_profiles values ('dev:a',100000),('dev:b',0);
  select pvp_inv_add('dev:a','wpn:musket:navy:legendary',1,'chest','old'); select pvp_inv_add('dev:a','wpn:sword:bone:epic',1,'chest','old');`);
await db.exec(fs.readFileSync(M + '061_musket_levels.sql', 'utf8'));
await db.exec(fs.readFileSync(M + '061_musket_levels.sql', 'utf8')); // re-runnable
const one = async (s) => (await db.query(s)).rows[0]; const r = async (s) => Object.values(await one(s))[0];
const gold = async (id) => (await one(`select gold from pvp_dev_profiles where id='${id}'`))?.gold;
const qty = async (id, it, src) => +(await r(`select coalesce(sum(qty),0) from pvp_inv where player_id='${id}' and item='${it}'${src ? ` and source='${src}'` : ''}`));
const rl = () => db.exec('delete from pvp_rl');
let ok = 0; const t = (c, m) => { assert.ok(c, m); ok++; };
// key <-> level = the catalog, every base x level
for (const b of C.WEAPON_BASES.musket) for (let lv = 1; lv <= 20; lv++) {
  const k = C.muskKeyAt(b, lv); t(await r(`select pvp_musk_key('${b}',${lv})`) === k, 'key ' + k); t(await r(`select pvp_musk_lv('${k}')`) === lv, 'lv ' + k);
  t(C.KEY_RE.test(k) && C.muskLevelOf(k) === lv, 'catalog ' + k); }
for (const bad of ['wpn:musket:navy:rare:3', 'wpn:musket:navy:common:1', 'wpn:musket:navy:legendary:21', 'wpn:musket:navy:epic:11', 'wpn:sword:bone:rare:7']) {
  t(await r(`select pvp_musk_lv('${bad}')`) === null && !C.KEY_RE.test(bad), 'bad ' + bad);
  let threw = false; try { await db.exec(`insert into pvp_inv values ('dev:z','${bad}','chest',1,now())`); } catch { threw = true; } t(threw, 'CHECK refuses ' + bad); }
for (let lv = 1; lv < 20; lv++) { const c = await one(`select * from pvp_musk_lv_cost(${lv})`); t(c.gold === C.muskLevelCost(lv).gold && c.parts === C.muskLevelCost(lv).parts, 'cost ' + lv); }
// Treasure Trader prices = catalog musketLevelPriceRows (036 rows untouched)
for (const [k, shop, p] of C.musketLevelPriceRows()) t(+(await r(`select price from pvp_inv_prices where item='${k}' and shop='${shop}'`)) === p, 'price ' + k);
t(+(await r(`select price from pvp_inv_prices where item='wpn:sword:bone:epic'`)) === 3500, '036 price kept');
// level up: flag on by default; a found copy -> LV 2 for 200 g, keeps its source; equipped + attachments follow the gid
await db.exec(`select pvp_inv_add('dev:a','wpn:musket:dragoon:common',1,'chest','find'); select pvp_inv_add('dev:a','wpn:musket:navy:common',1,'carry_buy','carry');
  insert into pvp_inv_equip values ('dev:a','musket','wpn:musket:dragoon:common');`);
const ens = await r(`select pvp_gun_ensure('dev:a')`); t(ens.ok, 'ensure');
const eqGid = (await one(`select gid from pvp_gun_inst where player_id='dev:a' and place='equip'`)).gid;
await db.exec(`update pvp_gun_inst set acc='{"scope":"val:acc_scope"}' where gid='${eqGid}'`);
let g0 = await gold('dev:a'), d = await r(`select pvp_inv_musk_level('dev:a','wpn:musket:dragoon:common','${eqGid}',false)`);
t(d.ok && d.item === 'wpn:musket:dragoon:common:2' && d.level === 2 && d.rarity === 'common' && d.price === 200 && d.parts === 0, 'lv2 ' + JSON.stringify(d));
t(await gold('dev:a') === g0 - 200, 'paid 200'); t(await qty('dev:a', 'wpn:musket:dragoon:common:2', 'chest') === 1 && await qty('dev:a', 'wpn:musket:dragoon:common') === 0, 'moved, source kept');
t((await one(`select item from pvp_inv_equip where player_id='dev:a'`)).item === 'wpn:musket:dragoon:common:2', 'equip follows');
{ const g = await one(`select item, place, acc from pvp_gun_inst where gid='${eqGid}'`); t(g.item === 'wpn:musket:dragoon:common:2' && g.place === 'equip' && g.acc.scope === 'val:acc_scope', 'gun inst follows'); }
t((await r(`select pvp_gun_ensure('dev:a')`)).guns.length === 3, 'ensure stable');
// a gold-bought copy levels too and stays carry_buy (never resold)
await rl(); d = await r(`select pvp_inv_musk_level('dev:a','wpn:musket:navy:common',null,false)`); t(d.ok && await qty('dev:a', 'wpn:musket:navy:common:2', 'carry_buy') === 1, 'bought copy levels, stays carry_buy');
await db.exec(`update pvp_flags set on_=true where k in ('antiques_sell','market','gift','musket_rank')`);
t(!(await r(`select pvp_inv_sell('dev:a','wpn:musket:navy:common:2',1,'antiques',1)`)).ok, 'bought levelled copy not sellable');
// level 5 -> 6 = rarity step: needs 3 parts + 1500 g; no parts = refused and NOTHING moves
await db.exec(`delete from pvp_inv where player_id='dev:a' and item like 'wpn:musket:dragoon:%'; select pvp_inv_add('dev:a','wpn:musket:dragoon:common:5',1,'chest','t'); update pvp_gun_inst set item='wpn:musket:dragoon:common:5' where gid='${eqGid}'; update pvp_inv_equip set item='wpn:musket:dragoon:common:5' where player_id='dev:a'`);
await rl(); g0 = await gold('dev:a'); d = await r(`select pvp_inv_musk_level('dev:a','wpn:musket:dragoon:common:5',null,false)`);
t(!d.ok && d.why === 'not enough parts' && await qty('dev:a', 'wpn:musket:dragoon:common:5') === 1 && await gold('dev:a') === g0, 'no parts = rollback ' + JSON.stringify(d));
await db.exec(`select pvp_inv_add('dev:a','val:musket_parts',4,'find','t')`); await rl();
d = await r(`select pvp_inv_musk_level('dev:a','wpn:musket:dragoon:common:5',null,false)`);
t(d.ok && d.item === 'wpn:musket:dragoon:rare' && d.rarity === 'rare' && d.level === 6 && d.price === 1500 && d.parts === 3, 'rare at lv6 ' + JSON.stringify(d));
t(await gold('dev:a') === g0 - 1500 && await qty('dev:a', 'val:musket_parts') === 1, 'paid 1500 + 3 parts');
t((await one(`select item from pvp_inv_equip where player_id='dev:a'`)).item === 'wpn:musket:dragoon:rare', 'only copy: equip follows');
// not enough gold
await db.exec(`update pvp_dev_profiles set gold=10 where id='dev:a'`); await rl();
d = await r(`select pvp_inv_musk_level('dev:a','wpn:musket:dragoon:rare',null,false)`); t(!d.ok && d.why === 'not enough gold' && await qty('dev:a', 'wpn:musket:dragoon:rare') === 1, 'poor = rollback');
// owner: free; max level; bad / not owned
await rl(); d = await r(`select pvp_inv_musk_level('dev:a','wpn:musket:dragoon:rare',null,true)`); t(d.ok && d.price === 0 && d.item === 'wpn:musket:dragoon:rare:7', 'owner free');
await db.exec(`select pvp_inv_add('dev:a','wpn:musket:bone:legendary:20',1,'chest','t')`); await rl();
t((await r(`select pvp_inv_musk_level('dev:a','wpn:musket:bone:legendary:20',null,true)`)).why === 'max level', 'max');
await rl(); t((await r(`select pvp_inv_musk_level('dev:a','wpn:musket:bone:epic:12',null,true)`)).why === 'not enough', 'not owned');
await rl(); t((await r(`select pvp_inv_musk_level('dev:a','wpn:musket:bone:rare:3',null,true)`)).why === 'bad item', 'bad key');
// rate limit
await db.exec(`select pvp_inv_add('dev:a','wpn:musket:navy:common',3,'chest','t'); update pvp_dev_profiles set gold=100000 where id='dev:a'`); await rl();
t((await r(`select pvp_inv_musk_level('dev:a','wpn:musket:navy:common',null,false)`)).ok && (await r(`select pvp_inv_musk_level('dev:a','wpn:musket:navy:common',null,false)`)).ok, '2 quick ok');
t((await r(`select pvp_inv_musk_level('dev:a','wpn:musket:navy:common',null,false)`)).why === 'slow down', '3rd = slow down');
// a levelled found copy trades: gift + market + Trader
await rl(); d = await r(`select pvp_inv_gift('dev:a','dev:b','wpn:musket:navy:common:2',1)`); t(d.ok && await qty('dev:b', 'wpn:musket:navy:common:2') === 1, 'gift levelled ' + JSON.stringify(d));
d = await r(`select pvp_mkt_list('dev:b','wpn:musket:navy:common:2',1,500)`); t(d.ok, 'list levelled');
d = await r(`select pvp_inv_sell('dev:a','wpn:musket:bone:legendary:20',1,'antiques',1)`); t(d.ok && d.gold === 5000, 'trader buys lv20 at legendary price');
// rank-up closed while levels are on; salvage takes a levelled copy (parts by rarity)
await rl(); t((await r(`select pvp_inv_musk_rank('dev:a','wpn:musket:navy:common',1500,3,false)`)).why === 'use level up', 'rank closed');
await db.exec(`select pvp_inv_add('dev:a','wpn:musket:dragoon:epic:13',1,'chest','t')`); await rl();
d = await r(`select pvp_inv_musk_salvage('dev:a','wpn:musket:dragoon:epic:13',4)`); t(d.ok && d.parts === 4 && await qty('dev:a', 'wpn:musket:dragoon:epic:13') === 0, 'salvage levelled');
// flag off = closed
await db.exec(`update pvp_flags set on_=false where k='musket_levels'`); await rl();
t((await r(`select pvp_inv_musk_level('dev:a','wpn:musket:navy:common',null,false)`)).why === 'levels closed', 'flag off');
console.log('061 SQL OK', ok, 'checks');
