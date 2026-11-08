import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createBuildingWaypoint,buildingPinButton,waypointOutsideView,drawBuildingPin} from '../js/mapWaypoint.js';
import {createPrivateBuildingMarker} from '../js/dock/buildingWaypoint.js';
import {fakeDom} from './helpers/fakeDom.mjs';
globalThis.location={search:''};
const CO=await import('../js/island/coast.js');
const {mapBuildings}=await import('../js/mapBuildings.js');
const {RENTABLE_SHOPS,MAIN_ST_SHOPS,SQUAD_HALL}=await import('../js/island/hillShops.js');
const buildings=mapBuildings({townToWorld:CO.t2w,worldToTown:CO.w2t,LOTS_MAP:[...RENTABLE_SHOPS,...MAIN_ST_SHOPS,SQUAD_HALL].map(s=>({lx:s.lx,z:s.lz,w:s.w,d:s.d,side:s.lot[0]==='L'?-1:1}))},[]);
const shop=buildings.find(b=>b.id==='musket_shop'),castle=buildings.find(b=>b.id==='castle_keep');
assert.ok(shop&&castle);
test('personal selection replaces rather than accumulates, snapshots cannot mutate it, clear removes it',()=>{
 const p=createBuildingWaypoint();assert.equal(p.current,null);
 for(const b of [shop,castle,castle]){assert.equal(p.select(b),true);assert.deepEqual(p.current,{id:b.id,name:b.name,x:b.x,z:b.z,audience:'private'});}
 p.current.x=0;assert.equal(p.current.x,castle.x);
 assert.equal(p.select({id:'bad',name:'bad',x:NaN,z:2}),false);assert.equal(p.current.id,castle.id);
 p.clear();assert.equal(p.current,null);
});
test('key uses native touch/Enter/Space buttons, isolates pointer/click and preserves native keyboard default',()=>{
 const {doc}=fakeDom();let selected=null,stops=0,prevented=0;
 const original=doc.createElement;doc.createElement=t=>{const el=original(t);el.setAttribute=(k,v)=>el[k]=v;return el;};
 const button=buildingPinButton(doc,shop,true,id=>selected=id);
 assert.equal(button.tagName,'BUTTON');assert.equal(button.type,'button');assert.equal(button['aria-pressed'],'true');
 const event={stopPropagation(){stops++;},preventDefault(){prevented++;}};
 button.dispatch('pointerdown',event);for(const key of ['Enter',' '])button.dispatch('keydown',{...event,key});
 button.dispatch('click',{...event,detail:0}); // same click handler receives native keyboard activation; browser default is intentionally not reimplemented
 assert.equal(selected,shop.id);assert.equal(stops,4);assert.equal(prevented,0);
});
test('map pin tip uses exact canonical projection at multiple zooms, rotated layout and panned safe viewport',()=>{
 const view={x:730,y:400,width:820,height:700};
 for(const b of [shop,castle])for(const zoom of [1,4,12]){
   const harbour=CO.toHarbor(b.x,b.z),back=CO.fromHarbor(...harbour);assert.ok(Math.hypot(back[0]-b.x,back[1]-b.z)<1e-9);
   const project=(x,z)=>[view.x+(x-b.x)*zoom,view.y+(z-b.z)*zoom];let tip;
   const ctx=new Proxy({translate:(...p)=>tip=p},{get:(o,k)=>o[k]??(()=>{})});drawBuildingPin(ctx,b,project);
   assert.deepEqual(tip,[view.x,view.y]);assert.equal(waypointOutsideView(b,project,view),false);
   assert.equal(waypointOutsideView(b,(x,z)=>[project(x,z)[0]+900,project(x,z)[1]],view),true);
 }
});
test('local world marker follows canonical foot-to-harbor frame and real ground sampler, reuses object, hides and disposes',()=>{
 const parent=new THREE.Group(),calls=[];const marker=createPrivateBuildingMarker({parent,layout:{footToHarbor:CO.toHarbor},ground:(x,z)=>{calls.push([x,z]);return 17;}});
 assert.equal(marker.group.visible,false);const childCount=parent.children.length;
 for(const b of [shop,castle,castle]){marker.update({...b,audience:'private'});const [x,z]=CO.toHarbor(b.x,b.z);assert.deepEqual(marker.group.position.toArray(),[x,17,z]);assert.deepEqual(calls.at(-1),[x,z]);assert.equal(marker.group.visible,true);assert.equal(parent.children.length,childCount);}
 for(const [pin,active] of [[null,true],[{...shop,audience:'squad'},true],[{...shop,audience:'private'},false]]){marker.update(pin,active);assert.equal(marker.group.visible,false);}
 marker.update({...shop,audience:'private'});marker.clear();assert.equal(marker.group.visible,false);assert.equal(marker.group.userData.buildingId,undefined);
 marker.dispose();marker.dispose();assert.equal(parent.children.length,0);marker.update({...shop,audience:'private'});assert.equal(marker.group.visible,false);
});
test('bad terrain samples cannot render a marker at NaN coordinates',()=>{
 const marker=createPrivateBuildingMarker({parent:new THREE.Group(),layout:{footToHarbor:CO.toHarbor},ground:()=>NaN});marker.update({...shop,audience:'private'});assert.equal(marker.group.visible,false);marker.dispose();
});
test('private feature has no room/broadcast/storage transport and clears on harbor exit before spectator display',()=>{
 for(const f of ['js/mapWaypoint.js','js/dock/buildingWaypoint.js'])assert.doesNotMatch(readFileSync(new URL('../'+f,import.meta.url),'utf8'),/\b(fetch|WebSocket|Room|localStorage|sessionStorage|broadcast|sendMessage)\s*[.(]/);
 const dock=readFileSync(new URL('../js/dock/index.js',import.meta.url),'utf8');assert.match(dock,/if \(!v\) \{ imap\.clearPin\(\); buildingMarker\.clear\(\);/);assert.match(dock,/buildingMarker\.update\(imap\.pin, on && !!P\(\)\?\.alive\)/);
 const map=readFileSync(new URL('../js/islandMap.js',import.meta.url),'utf8');assert.match(map,/PRIVATE PIN.*Only you/);assert.match(map,/waypointOutsideView\(pin,project,view\)/);assert.match(map,/drawBuildingPin\(ctx,pin,footProject\(T\)/);
});
test('production dock capture handler leaves native key-button Space/Enter alone while map is open',()=>{
 // Execute the real capture handler with gameplay dependencies that must never be reached.
 const dock=readFileSync(new URL('../js/dock/index.js',import.meta.url),'utf8');
 const body=dock.slice(dock.indexOf('const onKeyDown = (e) => {')+'const onKeyDown = '.length,dock.indexOf('\n  const onKeyUp'));
 let swallowed=0,closed=0,walked=0;
 const imap={isOpen:true,close(){closed++;}},event=code=>({code,target:{tagName:'BUTTON'},stopImmediatePropagation(){swallowed++;},preventDefault(){swallowed++;}});
 const make=new Function('on','treasure','ADM','casinoUi','imap','isKey','window','document','walker','openIsleMap',`return (${body.trim().replace(/;$/,'')});`);
 const handler=make(true,{isOpen:false},{frozen:false},null,imap,(action,code)=>action==='map'&&code==='KeyM',{PFP_PETS:null},{getElementById:()=>null},{onKey(){walked++;}},()=>{});
 handler(event('Space'));handler(event('Enter'));assert.equal(walked,0);assert.equal(swallowed,0);
 handler(event('Escape'));assert.equal(closed,1);assert.equal(swallowed,2);
});
