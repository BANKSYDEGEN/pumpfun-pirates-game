import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
let PGlite;try{({PGlite}=await import(createRequire(process.cwd()+'/package.json').resolve('@electric-sql/pglite')));}catch{}
test('backup precedes recovery; alias-aware consumed entitlements prevent re-grants',()=>{const s=read('supabase/migrations/060_parrot_legacy_recovery.sql');assert.ok(s.indexOf('create table if not exists')<s.indexOf('create or replace function'));assert.match(s,/enable row level security/);assert.match(s,/pvp_main\(p.legacy_player\)=pid/);});
test('server-save and alias recovery are idempotent, without duplicating new purchases or sold birds',{skip:!PGlite},async()=>{
 const db=new PGlite();try{
 const setup=read('tools/inventory/sql_test.mjs');await db.exec(setup.slice(setup.indexOf('create role anon;'),setup.indexOf('`);')));
 await db.exec(`create role service_role;alter table pvp_profiles add gear jsonb default '{}',add shop_rev int default 0;alter table pvp_dev_profiles add gear jsonb default '{}',add shop_rev int default 0;create table pvp_group_saves(main text primary key,gold int default 100000);create table pvp_purchases(id bigserial primary key,player_id text,req text unique,item text,price int,gold_before int,gold_after int,rev int);create function pvp_shop_buy(text,text,integer,text) returns jsonb language sql as $$select '{"ok":true}'::jsonb$$;`);
 for(const f of ['026_treasure_maps.sql','035_chest_items.sql','036_inventory.sql','058_pets.sql','059_parrot_inventory.sql'])await db.exec(read('supabase/migrations/'+f));
 await db.exec(`create or replace function pvp_main(p_id text) returns text language sql stable as $$select case when p_id='dev:alias' then 'dev:a' else p_id end$$;insert into pvp_dev_profiles(id,gold,gear) values('dev:a',100000,'{"parrot":"parrot_red"}'),('dev:alias',0,'{"parrot":"parrot_red"}'),('dev:b',100000,'{"parrot":"parrot_green"}');insert into pvp_owned(player_id,item,source,price) values('dev:alias','gear:parrot:parrot_blue','grant',0);select pvp_parrot_buy('dev:b','parrot-new-recovery-test');`);
 const migration=read('supabase/migrations/060_parrot_legacy_recovery.sql');await db.exec(migration);const q=async s=>(await db.query(s)).rows;
 assert.equal((await q("select count(*)::int n from pvp_inv where player_id='dev:a' and item like 'par:%'"))[0].n,2);assert.equal((await q("select count(*)::int n from pvp_inv where player_id='dev:b' and item like 'par:%'"))[0].n,1);
 const id=(await q("select id from pvp_parrots where legacy_player='dev:a' and color='parrot_red'"))[0].id;await db.exec(`delete from pvp_inv where item='par:${id}';select pvp_parrot_ensure('dev:alias');`);assert.equal((await q(`select count(*)::int n from pvp_inv where item='par:${id}'`))[0].n,0);await db.exec(migration);assert.equal((await q("select count(*)::int n from pvp_parrots where legacy_player='dev:a'"))[0].n,2);
 }finally{await db.close();}
});
