import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const PG=[process.env.PFP_PGLITE_DIR,'/tmp/pglite','/workspace/emerly-itemdrop-tools'].filter(Boolean).find(p=>existsSync(p+'/node_modules/@electric-sql/pglite'));
test('manual drop / self and peer claim / double claim / expiry / rollback / exact 48-of-50 storage SQL', {skip:!PG && 'Install @electric-sql/pglite and set PFP_PGLITE_DIR'},()=>{
 const out=execFileSync('node',[new URL('../tools/inventory/manual_loot_sql_test.mjs',import.meta.url).pathname],{cwd:PG,encoding:'utf8',timeout:120000});
 assert.match(out,/MANUAL LOOT SQL OK \d+ checks/);console.log(out.trim());
});
test('DROP is capability gated, never uses offline debit and warns about permanent expiry including rare+',()=>{
 const ui=read('js/inventory/ui.js'),loot=read('js/dock/lootBags.js');
 assert.match(ui,/manualDrop\(\)\?\.canDrop/);assert.match(ui,/RARE\+ ITEM/);assert.match(ui,/gone forever/);
 assert.match(loot,/pvp_loot_status/);assert.match(loot,/crypto.randomUUID/);assert.match(loot,/!ok && !bagId.startsWith\('local_'\)/);
 assert.match(read('supabase/functions/pvp/loot.ts'),/manualDrops: false/);
});
test('every storage stack interaction opens exact-amount picker; both chest routes already carry qty',()=>{
 const h=read('js/dock/houses.js');
 assert.match(h,/if \(d.qty > 1 && isStackable\(d.item\)\)/);assert.match(h,/if \(q > 1 && isStackable\(item\)\) \{ openSplit\(el\)/);
 assert.match(h,/type="number"[^\n]+data-sp-num/);assert.match(h,/>HALF/);assert.match(h,/>ALL/);
 assert.match(h,/house_store', \{ cottage: activeId, item, qty/);assert.match(h,/house_take', \{ cottage: activeId, slot, qty/);
});
test('client integration: hidden before support, ISO TTL, safe-zone drop, no offline phantom or failed-claim grant',async()=>{
 await import('./helpers/threeRegister.mjs');
 const {createLootBags}=await import('../js/dock/lootBags.js');
 const storage=new Map(); globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 let supported=false,failDrop=false,claimReply={ok:false,why:'gone'},room='pfp-harbor-1';
 const sent=[],calls=[];const bid='00000000-0000-4000-8000-000000000099';
 const expiry=new Date(Date.now()+300000).toISOString();
 const row={id:bid,manual:true,items:[{item:'val:golden_idol',qty:48}],x:1,y:2,z:3,expires_at:expiry};
 const loot=createLootBags({scene:{add(){},remove(){}},world:{ground:()=>2},roomKey:()=>room,dropContext:()=>({x:1,y:2,z:3}),inSafe:()=>true,
  broadcast:m=>sent.push(m),inventory:{data:{items:[],equipped:{}}},invApi:async(action,payload)=>{
   calls.push([action,payload]); if(action==='pvp_loot_status')return supported?{ok:true,manualDrops:true,bags:[]}:{error:'unknown action'};
   if(action==='pvp_manual_drop')return failDrop?{ok:false,error:'offline'}:{ok:true,bag:row};
   if(action==='pvp_claim_loot')return claimReply;
  }});
 assert.equal(loot.canDrop(),false);await loot.syncManual(true);assert.equal(loot.canDrop(),false);
 supported=true;await loot.syncManual(true);assert.equal(loot.canDrop(),true);
 await loot.dropItem({item:'val:golden_idol',qty:48});assert.equal(loot.bags().length,1);assert.equal(loot.bags()[0].expires_at,Date.parse(expiry));
 assert.equal(sent[0].type,'loot_spawn');assert.equal(calls.find(([a])=>a==='pvp_manual_drop')[1].qty,48);
 assert.equal(await loot.claim(bid),null);assert.equal(loot.bags().length,0);assert.equal(storage.has('pfp_houses_v1'),false);
 assert.equal(sent.length,1,'failed claim never broadcasts a success');
 failDrop=true;await loot.dropItem({item:'val:golden_idol',qty:1});assert.equal(loot.bags().length,0,'no offline manual phantom');
 room='pfp-harbor-2';await loot.syncManual(true);assert.equal(loot.bags().length,0);
 loot.clear();delete globalThis.localStorage;
});
