import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adminAction, ADMIN_ACTIONS, OWNER_ACTIONS } from '../supabase/functions/pvp/admin.ts';
import { areaOf, sessionLabel, filterPlayers, statsMarkup, openAdminPortal, LIVE_POLL_MS, STATS_POLL_MS } from '../js/adminPortal.js';
const R = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const json=(status,b)=>new Response(JSON.stringify(b),{status});
const who={pid:'dev:e191a32e15abea4f14355121',owner:true};
const body=async r=>({status:r.status,...await r.json()});

test('new analytics action is routed and owner-gated before any database access', async()=>{
  assert.ok(ADMIN_ACTIONS.includes('admin_stats')); assert.ok(OWNER_ACTIONS.includes('admin_stats'));
  for(const owner of [false,null]){
    let touched=false;
    const r=await body(await adminAction({db:{rpc(){touched=true;throw Error('must not query')}},json,whoAmI:async()=>owner===null?null:{...who,owner}},'admin_stats',{}));
    assert.equal(r.status,403); assert.equal(touched,false);
  }
});
test('stats rpc receives the authenticated identity, not request owner, and returns aggregates',async()=>{
  const r=await body(await adminAction({json,whoAmI:async()=>who,db:{rpc:async(fn,args)=>{assert.equal(fn,'pvp_admin_stats');assert.deepEqual(args,{p_owner:who.pid});return{data:{ok:true,saved_gold:123}};}}},'admin_stats',{p_owner:'attacker'}));
  assert.equal(r.saved_gold,123);
});
test('missing SQL update degrades to explicit pending; SQL refusal remains forbidden',async()=>{
  for(const [rpc,status] of [[{error:{message:'not installed'}},503],[{data:{ok:false}},403]]){
    const r=await body(await adminAction({json,whoAmI:async()=>who,db:{rpc:async()=>rpc}},'admin_stats',{}));assert.equal(r.status,status);
    if(status===503)assert.equal(r.pending,true);
  }
});
test('portal does not mount or request data when server says non-owner',async()=>{
  const calls=[]; await openAdminPortal({call:async a=>{calls.push(a);return{ok:true,owner:false};}});assert.deepEqual(calls,['admin_status']);
});
test('area classification keeps interior and arena frames separate from island',()=>{
  assert.equal(areaOf({room:'Arena',mode:'foot'}),'Arena');
  assert.equal(areaOf({room:'Harbor #2',mode:'hull'}),'Hull');
  assert.equal(areaOf({mode:'cottage'}),'House');assert.equal(areaOf({mode:'foot'}),'Island');assert.equal(areaOf({mode:'canoe'}),'Sea');
  assert.equal(areaOf({room:'Harbor #1'}),'Harbor');
});
test('unknown device/session data is not invented; session lengths do not go negative',()=>{
  const now=Date.now(); assert.equal(sessionLabel({},now),'—');assert.equal(sessionLabel({session_started_at:new Date(now+1000).toISOString()},now),'—');
  assert.equal(sessionLabel({session_started_at:new Date(now-65*60000).toISOString()},now),'1h 5m');
});
test('search and area filters use real roster values',()=>{
  const p=[{name:'BANKSY',room:'Harbor #1',mode:'foot'},{name:'Gill',room:'Harbor #2',mode:'sea'}];
  assert.equal(filterPlayers(p,'banks','')[0],p[0]);assert.equal(filterPlayers(p,'','Sea')[0],p[1]);assert.equal(filterPlayers(p,'nobody','').length,0);
});
test('analytics explain proxies and missing data, never show fake zero while pending',()=>{
  assert.match(statsMarkup(null),/—/);assert.doesNotMatch(statsMarkup(null),/<b>0<\/b>/);
  assert.match(statsMarkup({seen_today:0}),/<b>0<\/b>/);
  const ui=R('js/adminPortal.js');for(const phrase of ['not a historical session log','Casino payouts are not recorded','retention','Most held does not mean most used','Server update pending'])assert.ok(ui.includes(phrase));
  assert.equal(LIVE_POLL_MS,5000);assert.equal(STATS_POLL_MS,60000);
});
test('SQL is double owner-gated and service-role only; no destructive/gameplay writes',()=>{
  const sql=R('supabase/migrations/064_admin_portal.sql');
  assert.equal((sql.match(/p_owner is distinct from public.pvp_inv_owner\(\)/g)||[]).length,2);
  for(const fn of ['pvp_admin_stats','pvp_admin_live']){
    assert.ok(sql.includes(`revoke all on function public.${fn}(text) from public, anon, authenticated`));
    assert.ok(sql.includes(`grant execute on function public.${fn}(text) to service_role`));
  }
  assert.doesNotMatch(sql,/\b(?:insert into|delete from|drop table|update public\.pvp_)\b/i);
  assert.match(sql,/coalesce\(g.gold, c.gold\)/); assert.match(sql,/item not like 'casino:%'/);
});
test('map reuses the existing bake and transform; does not plot arena or interior frames',()=>{
  const map=R('js/islandMap.js');assert.match(map,/function drawAdminChart/);assert.match(map,/f: toF\(p.x, p.z\)/);assert.match(map,/base\(THEMES.colored\)/);assert.match(map,/\^Harbor/);assert.match(map,/\['hull', 'cottage'\]\.includes\(p.mode\)/);
  const menu=R('js/adminMenu.js');assert.match(menu,/import\('\.\/adminPortal.js'\)/);
  assert.match(R('js/keybinds.js'),/pfp-admin-portal/);
});
test('portal roster keeps owner sessions, enriches only via owner RPC, and works before migration',async()=>{
  for(const installed of [true,false]){
    const now=Date.now(), rows=[{net_id:'abcdef12',pid:who.pid,name:'BANKSY',room:'Harbor #1',mode:'foot',x:1,y:0,z:2,updated_at:new Date(now).toISOString()}];
    const db={from(table){const q={select(){return q},gt(){return q},limit(){return q},then(resolve){resolve({data:table==='pvp_admin_presence'?rows:[],error:null})}};return q},rpc:async(fn,a)=>{assert.equal(fn,'pvp_admin_live');assert.equal(a.p_owner,who.pid);return installed?{data:{ok:true,players:[{net:'abcdef12',gold:26000,device:'phone'}]}}:{error:{message:'not deployed'}}}};
    const r=await body(await adminAction({db,json,whoAmI:async()=>who,now:()=>now},'admin_players',{portal:true}));
    assert.equal(r.status,200);assert.equal(r.players[0].pid,who.pid);assert.equal(r.metadata_pending,!installed);
    assert.equal(r.players[0].gold,installed?26000:undefined);
  }
});
