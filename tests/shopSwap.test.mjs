import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {STOREFRONTS,SHOPS_OUTSIDE,signList} from '../js/island/plazaTown.js';
import {mapLandmarks} from '../js/mapLandmarks.js';
test('approved five-shop row and permanent physical building numbers agree',()=>{
 const row=[...STOREFRONTS].sort((a,b)=>a.lx-b.lx);
 assert.deepEqual(row.map(s=>s.id),['shop_clothes','shop_crew','shop_pets','shop_upgrades','shop_ships']);
 assert.deepEqual(row.map(s=>s.lx),[-49,-38.5,-10,20.5,32]);
 const buildings=JSON.parse(readFileSync(new URL('../assets/island/building_numbers.json',import.meta.url))).buildings;
 for(const s of row){const b=buildings.find(b=>b.id===s.id);assert.equal(b.lx,s.lx);assert.equal(b.w,s.w);assert.equal(b.z,s.lx-90);}
 assert.equal(buildings.find(b=>b.id==='shop_crew').n,2);assert.equal(buildings.find(b=>b.id==='shop_pets').n,4);assert.equal(buildings.find(b=>b.id==='shop_ships').n,6);
 assert.equal(row[1].walkIn,true);assert.ok(!SHOPS_OUTSIDE.has(row[1].id));
 assert.equal(row[4].w,10);assert.equal(row[4].modelScaleX,10/12,'complete ship model fits its new 10m lot');
 assert.equal(row[3].open,'upgrades');assert.equal(row[4].open,undefined,'skins and upgrades still open different shop views');
});
test('map labels and signage follow shop anchors rather than stale fixed coordinates',async()=>{
 const standard=mapLandmarks({townToWorld:(x,z)=>[x,z]});assert.ok(!standard.some(p=>p.id==='shop_pets'),'default map gets its single shop marker from layout.interact');
 const source=readFileSync(new URL('../js/dock/layout.js',import.meta.url),'utf8');assert.match(source,/for \(const sp of \(FM\.PLAZA_SHOPS_ON/);
 globalThis.location={search:'?mmicons=0'};const {mapLandmarks:legacy}=await import('../js/mapLandmarks.js?shop-swap-test');delete globalThis.location;
 const pins=legacy({townToWorld:(x,z)=>[x,z]});
 for(const id of ['shop_crew','shop_pets']){const s=STOREFRONTS.find(s=>s.id===id),p=pins.find(p=>p.id===id);assert.equal(p.x,s.lx);assert.equal(p.label,s.name);assert.equal(signList().find(p=>p.key===id).text,s.name);}
});
