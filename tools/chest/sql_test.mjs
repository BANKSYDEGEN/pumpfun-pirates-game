// [v152] SQL test: in-memory Postgres (PGlite), no network, no real data: migration 026 + 035 on stub tables, every chest case. Run from a scratch dir with @electric-sql/pglite installed (ESM ignores NODE_PATH), with M pointed at this repo's supabase/migrations/.
import { PGlite } from '@electric-sql/pglite'; import fs from 'fs';
const db = new PGlite(); const M = new URL('../../supabase/migrations/', import.meta.url).pathname;
await db.exec(`create role anon; create role authenticated;
create function public.pvp_main(p_id text) returns text language sql as $$ select p_id $$;
create table pvp_profiles(id text primary key, gold int not null default 0);
create table pvp_dev_profiles(id text primary key, gold int not null default 0);
create table pvp_kills(id bigserial primary key, killer_id text, room text, life int);
create table public.pvp_owned (player_id text not null, item text not null check (item ~ '^(skin:[a-z0-9_]{2,24}|gear:[a-z]{2,10}:[a-z0-9_]{2,24})$'), source text not null check (source in ('buy','legacy','legacy_commodore','grant')), price integer not null default 0 check (price >= 0), uses_left integer, created_at timestamptz not null default now(), primary key (player_id, item));`);
await db.exec(fs.readFileSync(M+'026_treasure_maps.sql','utf8'));
await db.exec(fs.readFileSync(M+'035_chest_items.sql','utf8')); await db.exec(fs.readFileSync(M+'035_chest_items.sql','utf8')); console.log('031 applied twice ok');
await db.exec(`insert into pvp_dev_profiles values ('dev:a',100),('dev:e191a32e15abea4f14355121',0); insert into pvp_profiles values ('wallet:W',0);
insert into pvp_owned values ('dev:a','gear:hat:tricorn','buy',400);
insert into pvp_maps(id,player_id,tier,spot,source,source_ref,created_at) values
 ('00000000-0000-4000-8000-000000000001','dev:a','common','dig1','boss','b1',now()-interval '1 hour'),
 ('00000000-0000-4000-8000-000000000002','dev:a','rare','dig2','kill','b2',now()-interval '1 hour'),
 ('00000000-0000-4000-8000-000000000003','wallet:W','legendary','cave','streak','b3',now()-interval '1 hour'),
 ('00000000-0000-4000-8000-000000000004','dev:e191a32e15abea4f14355121','common','dig1','boss','b4',now()-interval '1 hour'),
 ('00000000-0000-4000-8000-000000000005','dev:a','common','dig3','boss','b5',now()-interval '1 hour');`);
const q = async (l, s) => { const r = await db.query(s); console.log(l, JSON.stringify(r.rows[0] ?? r.rows)); };
const age = () => db.exec(`update pvp_maps set dug_at=now()-interval '1 minute' where dug_at is not null`);
await q('new crew item ', `select pvp_map_dig_item('dev:a','00000000-0000-4000-8000-000000000001','dig1',false,'gear:crewhat:bicorne',true,600) r`); await age();
await q('duplicate     ', `select pvp_map_dig_item('dev:a','00000000-0000-4000-8000-000000000002','dig2',false,'gear:hat:tricorn',false,200) r`); await age();
await q('holder new    ', `select pvp_map_dig_item('wallet:W','00000000-0000-4000-8000-000000000003','cave',true,'gear:hat:crown',false,7500) r`);
await q('owner         ', `select pvp_map_dig_item('dev:e191a32e15abea4f14355121','00000000-0000-4000-8000-000000000004','dig1',false,'gear:hat:crown',false,7500) r`);
await q('re-dig        ', `select pvp_map_dig_item('dev:a','00000000-0000-4000-8000-000000000001','dig1',false,'gear:hat:crown',false,7500) r`);
await q('gold only(026)', `select pvp_map_dig('dev:a','00000000-0000-4000-8000-000000000005','dig3',false) r`);
for (const s of ['select player_id,item,source from pvp_owned order by 1,2','select id,gold from pvp_dev_profiles union all select id,gold from pvp_profiles','select map_id,item,crew,dup,dup_gold from pvp_map_loot']) console.log((await db.query(s)).rows);
