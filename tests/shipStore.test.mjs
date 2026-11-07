import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {readFileSync} from 'node:fs';
import {SHIP_STORE} from '../js/island/shipStore.js';import {STOREFRONTS,buildPlazaV2,signList} from '../js/island/plazaTown.js';
import {SHIP_STORE_PLACES,SHOP_PLACES} from '../js/island/plazaShops.js';import {MALE_SHOP_DISPLAYS} from '../js/island/plazaMannequins.js';import {mapLandmarks} from '../js/mapLandmarks.js';
test('one 22m shell replaces both former stores, retaining two independent stalls and keepers',()=>{
 assert.deepEqual(SHIP_STORE.counters.map(c=>c.id),['shop_upgrades','shop_ships']);
 for(const c of SHIP_STORE.counters){const s=STOREFRONTS.find(s=>s.id===c.id);assert.ok(s.walkIn);assert.ok(s.mapHidden);assert.equal(s.promptLz,SHIP_STORE.promptLz);}
 assert.equal(MALE_SHOP_DISPLAYS.ship_store.length,2);assert.equal(signList().filter(s=>s.key==='ship_store').length,1);
 const src=readFileSync(new URL('../js/island/plazaTown.js',import.meta.url),'utf8');assert.match(src,/s.id === 'shop_ships' \|\| s.id === 'shop_upgrades'\) continue/);
 const marks=mapLandmarks({townToWorld:(x,z)=>[x,z]});assert.equal(marks.filter(p=>p.id==='ship_store').length,1);assert.equal(marks.find(p=>p.id==='ship_store').x,26);
});
test('both stall prompts are reachable through open front, counters solid, shared center aisle clear',()=>{
 const boxes=[],circles=[],noop=()=>{};
 buildPlazaV2({k:{at:(m,f)=>f(),add:g=>g.dispose()},W:(k,g)=>g.dispose(),box:(...a)=>new THREE.BoxGeometry(...a),cyl:(...a)=>new THREE.CylinderGeometry(...a),M:()=>new THREE.Matrix4(),at:(x,z,y,f)=>f(),barrel:noop,crate:noop,sacks:noop,torchPost:noop,stall:noop,addBox:(x,z,w,d,yaw)=>boxes.push({x,z,w,d,yaw}),addCirc:(x,z,r)=>circles.push({x,z,r}),T:(x,z)=>[x,z],F:()=>0,A:{},low:true,C:{SHUTTER:[0,0,0,0],ROOFS:[0,0,0,0]},yaw0:0,deckY:0});
 const blocked=(x,z)=>boxes.some(b=>Math.abs(x-b.x)<b.w/2+.33&&Math.abs(z-b.z)<b.d/2+.33)||circles.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+.33);
 for(const c of SHIP_STORE.counters){for(let z=-27;z>=SHIP_STORE.promptLz;z-=.1)assert.ok(!blocked(c.lx,z),`${c.id} door at ${z}`);assert.ok(blocked(c.lx,-37.6),'counter solid');}
 for(let z=-28;z>=-40;z-=.1)assert.ok(!blocked(26,z),'shared center aisle');
 assert.equal(SHIP_STORE_PLACES.length,1);assert.ok(!SHOP_PLACES.some(p=>['shop_ships','shop_upgrades'].includes(p.id)));
});
