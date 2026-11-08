// Isolated PostgreSQL/WASM; no production connections. Run from a directory with @electric-sql/pglite installed.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const { PGlite } = await import(createRequire(process.cwd() + '/x.js').resolve('@electric-sql/pglite'));
const db = new PGlite();
const read = f => readFileSync(new URL('../../supabase/migrations/' + f, import.meta.url), 'utf8');
const fn = (file, name) => { const s=read(file), a=s.indexOf('create or replace function public.'+name+'('); assert.ok(a>=0,name); return s.slice(a,s.indexOf('$$;',s.indexOf('as $$',a))+3); };
const sql = async (q, args=[]) => (await db.query(q,args)).rows[0];
const call = async (q,args=[]) => Object.values(await sql(q,args))[0];
const qty = async (pid,item='val:golden_idol') => +(await call('select coalesce(sum(qty),0) from pvp_inv where player_id=$1 and item=$2',[pid,item]));
let checks=0; const check=(v,m) => { assert.ok(v,m); checks++; };
await db.exec(`create role anon; create role authenticated; create role service_role;
create function pvp_main(text) returns text language sql as $$select $1$$;
create table pvp_players(id text primary key,name text);
create table pvp_flags(k text primary key,on_ boolean,note text);
insert into pvp_flags values ('pvploot',true,''),('houses',true,''),('ship_quarters',true,'');
create function pvp_flag(text) returns boolean language sql as $$select coalesce((select on_ from pvp_flags where k=$1),false)$$;
create function pvp_rl_hit(text,int,int) returns boolean language sql as $$select true$$;
create table pvp_inv(player_id text,item text,source text,qty int check(qty>0),updated_at timestamptz default now(),primary key(player_id,item,source));
create table pvp_inv_log(player_id text,item text,delta int,source text,why text,ref text);
create table pvp_inv_equip(player_id text,slot text,item text,primary key(player_id,slot));
create table pvp_houses(player_id text,cottage_id text,tier text,slots int,primary key(player_id,cottage_id));
create table pvp_house_storage(player_id text,cottage_id text,slot int,item text,qty int,meta jsonb default '{}',updated_at timestamptz default now(),primary key(player_id,cottage_id,slot));
`);
for (const name of ['pvp_inv_add','pvp_inv_take']) await db.exec(fn('036_inventory.sql',name));
const gun=read('047_per_gun_attachments.sql'); await db.exec(gun.slice(gun.indexOf('create table'),gun.indexOf('-- Valid attachment')));
await db.exec(fn('047_per_gun_attachments.sql','pvp_gun_ensure'));
await db.exec(fn('046_fix_house_take.sql','pvp_house_inv_source'));
await db.exec(fn('047_per_gun_attachments.sql','pvp_gun_from_house'));
for (const name of ['pvp_ensure_ship_quarters','pvp_house_store']) await db.exec(fn('048_ship_quarters_and_casino.sql',name));
const loot=read('044_pvp_loot_bags.sql');await db.exec(loot.slice(loot.indexOf('create table'),loot.indexOf('-- House withdraw')));
await db.exec(read('066_manual_item_drops.sql'));
// Rerunnable migration (functions + additive columns/indexes).
await db.exec(read('066_manual_item_drops.sql'));
await db.exec("insert into pvp_players values ('a','A'),('b','B'),('owner','BANKSY'); select pvp_inv_add('a','val:golden_idol',50,'chest','test');");
let next=1;const id=()=>`00000000-0000-4000-8000-${String(next++).padStart(12,'0')}`;
const drop=(pid,q=1,item='val:golden_idol',bid=id(),gid=null)=>call('select pvp_manual_drop($1,$2,$3,1::float8,0::float8,1::float8,$4,false,$5::uuid,$6::uuid)',[pid,item,q,'pfp-harbor-1',bid,gid]);
const claim=(pid,bid,room='pfp-harbor-1',owner=false)=>call('select pvp_claim_loot_atomic($1,$2::uuid,$3,$4)',[pid,bid,room,owner]);
let d=await drop('a',48);check(d.ok && await qty('a')===2,'drop exactly 48 of 50');
check(Date.parse(d.bag.expires_at)-Date.now()>290000,'manual TTL 5 min');
let c=await claim('a',d.bag.id);check(c.ok && await qty('a')===50,'self claim restores exact stack');
check(!(await claim('b',d.bag.id)).ok && await qty('b')===0,'double claim cannot duplicate');
d=await drop('a',48);check(!(await claim('b',d.bag.id,'pfp-harbor-2')).ok,'cross-copy claim blocked');
c=await claim('b',d.bag.id);check(c.ok && await qty('a')===2 && await qty('b')===48,'another player claims exact quantity');
const before=await qty('a');check(!(await drop('a',3)).ok && await qty('a')===before,'excess qty rejected without bag or debit');
check(!(await drop('a',0)).ok && !(await drop('a',-1)).ok && !(await drop('a',1000)).ok,'invalid quantities');
check(!(await drop('b',1,'par:fake')).ok,'pets excluded');
d=await drop('b',1);await db.query("update pvp_loot_bags set expires_at=now()-interval '1 second' where id=$1",[d.bag.id]);
check((await claim('a',d.bag.id)).why==='expired' && await qty('a')===2,'expired items cannot be recovered');
check((await claim('a',d.bag.id)).why==='gone','expired bag removed');
// Full bag may stack existing items but cannot open a seventeenth slot.
await db.exec("select pvp_inv_add('full','val:golden_idol',1,'chest','test'); select pvp_inv_add('full','val:fill_' || i,1,'chest','test') from generate_series(1,15) i;");
d=await drop('b',2);check((await claim('full',d.bag.id)).ok && await qty('full')===3,'existing stack allowed at full cap');
await db.exec("select pvp_inv_add('other','val:ruby',5,'chest','test')");d=await drop('other',2,'val:ruby');
check((await claim('full',d.bag.id)).full,'new stack blocked at cap');
check((await claim('owner',d.bag.id,'pfp-harbor-1',true)).ok,'owner unlimited');
// Equipment and provenance checks; fitted gun attachments follow escrow, not a client list.
await db.exec("select pvp_inv_add('gunner','wpn:musket:navy:rare',1,'chest','test'); insert into pvp_inv_equip values ('gunner','musket','wpn:musket:navy:rare')");
check((await drop('gunner',1,'wpn:musket:navy:rare')).why==='Unequip this weapon first','equipped blocked');
await db.exec("delete from pvp_inv_equip where player_id='gunner'; select pvp_gun_ensure('gunner'); update pvp_gun_inst set acc='{"+ '"scope":"val:acc_scope"' +"}' where player_id='gunner'");
d=await drop('gunner',1,'wpn:musket:navy:rare');check(d.ok,'unequipped gun dropped');
check((await claim('b',d.bag.id)).ok,'gun claim');
const g=await sql('select * from pvp_gun_inst where gid=$1',[d.bag.gun_id]);check(g.player_id==='b' && g.acc.scope==='val:acc_scope','same gun and attachments moved');
await db.exec("select pvp_inv_add('bought','wpn:sword:cutlass:common',1,'carry_buy','test')");check(!(await drop('bought',1,'wpn:sword:cutlass:common')).ok,'gold-bought locked provenance not laundered');
// Rate limit doesn't disappear when bags are immediately claimed.
await db.exec("select pvp_inv_add('spam','val:ruby',10,'chest','test')");
for(let i=0;i<3;i++){d=await drop('spam',1,'val:ruby');check(d.ok,'allowed drop');check((await claim('spam',d.bag.id)).ok,'self pickup');}
check((await drop('spam',1,'val:ruby')).why.includes('3 drops'),'3/10sec limit survives claims');
// Rollback injection: bag insertion fails AFTER take; original inventory remains intact.
await db.exec("select pvp_inv_add('rollback','val:ruby',5,'chest','test'); create function fail_bag() returns trigger language plpgsql as $$begin raise exception 'injected failure'; end$$; create trigger fail_insert before insert on pvp_loot_bags for each row execute function fail_bag();");
await assert.rejects(drop('rollback',2,'val:ruby'));check(await qty('rollback','val:ruby')===5,'failed insert rolls debit back');await db.exec('drop trigger fail_insert on pvp_loot_bags');
// Claim add failure also restores bag, inventory, and escrow in the same transaction.
d=await drop('rollback',2,'val:ruby');
await db.exec("create function fail_add() returns trigger language plpgsql as $$begin if NEW.player_id='failclaim' then raise exception 'injected add failure'; end if; return NEW; end$$; create trigger fail_add before insert on pvp_inv for each row execute function fail_add();");
await assert.rejects(claim('failclaim',d.bag.id));check(!!await sql('select id from pvp_loot_bags where id=$1',[d.bag.id]),'failed claim keeps bag');check(await qty('failclaim','val:ruby')===0,'failed claim grants nothing');await db.exec('drop trigger fail_add on pvp_inv');
check((await claim('b',d.bag.id)).ok,'bag claimable after rollback');
// Same request UUID cannot consume a second stack (even after first bag claimed).
const duplicate=id();d=await drop('repeat',1,'val:ruby',duplicate);check(!d.ok,'not owned rejected');await db.exec("select pvp_inv_add('repeat','val:ruby',3,'chest','test')");d=await drop('repeat',1,'val:ruby',duplicate);check(d.ok,'first valid request');await claim('b',duplicate);check(!(await drop('repeat',1,'val:ruby',duplicate)).ok && await qty('repeat','val:ruby')===2,'same request replay no second debit');
// Competing claims (single WASM PostgreSQL engine serializes queries): one winner, exact total conserved.
await db.exec("select pvp_inv_add('race','val:ruby',10,'chest','test')");
d=await drop('race',4,'val:ruby');
const winners=await Promise.all([claim('race_a',d.bag.id),claim('race_b',d.bag.id)]);
check(winners.filter(r=>r.ok).length===1 && (await qty('race_a','val:ruby'))+(await qty('race_b','val:ruby'))===4,'competing claims exactly one winner');
// Partial death-bag pickup leaves the remainder in the same locked bag without recreating a second bag.
const partial=id();await db.query("insert into pvp_loot_bags(id,x,z,victim_id,items,expires_at) values ($1,1,1,'dead',$2::jsonb,now()+interval '2 minutes')",[partial,JSON.stringify([{item:'val:golden_idol',qty:2},{item:'val:ruby',qty:2}])]);
c=await claim('full',partial);check(c.ok && c.take[0].qty===2 && c.left[0].item==='val:ruby','partial claim leaves blocked stack');
check((await claim('race_a',partial)).ok,'leftovers claimable once by another player');
// User acceptance: 50 idols => store EXACTLY 48, keep 2; inverse also 48/2, both chest types, regular cap.
for(const cottage of ['garden','ship_quarters']) {
  const pid='storage_'+cottage;
  await db.query("insert into pvp_houses values ($1,$2,'captain',24)",[pid,cottage]);
  await db.query("select pvp_inv_add($1,'val:golden_idol',50,'chest','test')",[pid]);
  let r=await call("select pvp_house_store($1,$2,'val:golden_idol',48)",[pid,cottage]);check(r.ok && await qty(pid)===2,'store 48 keep 2 '+cottage);
  let stored=await call('select qty from pvp_house_storage where player_id=$1 and cottage_id=$2',[pid,cottage]);check(stored===48,'chest has 48 '+cottage);
  r=await call('select pvp_house_take_capped($1,$2,0,48,16,false)',[pid,cottage]);check(r.ok && r.qty===48 && await qty(pid)===50,'withdraw 48 (not empty-slot count) '+cottage);
  await call("select pvp_house_store($1,$2,'val:golden_idol',50)",[pid,cottage]);
  r=await call('select pvp_house_take_capped($1,$2,0,48,16,false)',[pid,cottage]);
  stored=await call('select qty from pvp_house_storage where player_id=$1 and cottage_id=$2',[pid,cottage]);check(r.qty===48 && await qty(pid)===48 && stored===2,'reverse: 48 backpack 2 chest '+cottage);
}
console.log(`MANUAL LOOT SQL OK ${checks} checks (isolated PGlite)`);await db.close();
