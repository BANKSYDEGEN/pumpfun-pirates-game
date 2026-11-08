import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.location = {search:''};
const M = await import('../js/mapBuildings.js');
const {RENTABLE_SHOPS,MAIN_ST_SHOPS,SQUAD_HALL} = await import('../js/island/hillShops.js');
const CO = await import('../js/island/coast.js');
const {HQ,PET_LOT} = await import('../js/pumpfun/site.js');
const {CASINO_HALL,CASINO_WING} = await import('../js/island/casinoData.js');
const {FORT} = await import('../js/island/areas/fort.js');
const {ellF} = await import('../js/island/coliseum.js');
const known = [...RENTABLE_SHOPS,...MAIN_ST_SHOPS,SQUAD_HALL];
const lots = known.map(s=>({lx:s.lx,z:s.lz,w:s.w,d:s.d,side:s.lot.startsWith('L')?-1:1}));
lots.push({label:'CASINO: HIGH SEAS ROOM',lx:40,z:-50,w:16,d:26});
const FM = {townToWorld:CO.t2w,worldToTown:CO.w2t,LOTS_MAP:lots,LIGHTHOUSES:[{id:'lighthouse',x:-758,z:18,opts:{height:20}},{id:'sandbar_lh',x:-745,z:-435,opts:{baseR:4.6}}]};
const interactions = [['rent_2','mm_wanted','E · WANTED BOARD · CONTRACTS + BOUNTIES'],['rent_3','mm_rum','E · HARBOR RUM EXPORT STALL · SELL RUM'],['rent_4','mm_buyer_harbor','E · HARBOR FENCE'],['rent_16','mm_fight','E · FIGHT MASTER · PRIZE FIGHTS']].map(([id,q,label])=>{const s=known.find(s=>s.id===id);return {id:q,lx:s.lx,lz:s.lz,label};});
const buildings = M.mapBuildings(FM,interactions);
test('every placed hill building has one footprint and matching name; merged musket remains one',()=>{
 for(const s of known) assert.equal(buildings.filter(b=>b.id===s.id).length,1,s.id);
 assert.equal(new Set(buildings.map(b=>b.id)).size,buildings.length);
 assert.equal(buildings.find(b=>b.id===PET_LOT.id).name,'PET STORE');
 for(const name of ['WANTED BOARD','HARBOR FENCE','FIGHT MASTER','TREASURE TRADER']) assert.ok(buildings.some(b=>b.name===name),name);
 assert.equal(buildings.filter(b=>/MUSKET SHOP/.test(b.name)).length,1);
});
test('no phantom buildings from interaction counters, retired pets shell or old harbor tower',()=>{
 assert.ok(!buildings.some(b=>['shop_clothes','shop_crew','shop_upgrades','shop_ships','house_e','harbor_tower'].includes(b.id)));
 assert.deepEqual(buildings.find(b=>b.id==='ship_store').aliases,['shop_upgrades','shop_ships']);
 assert.deepEqual(buildings.find(b=>b.id==='outfit_store').aliases,['shop_clothes','shop_crew']);
});
test('HQ and casino wing use exact canonical corners; wing only exists when actually built',()=>{
 const h=buildings.find(b=>b.id===HQ.id);
 assert.deepEqual(h.polygons[0].map(p=>CO.w2t(...p)).map(p=>p.map(v=>+v.toFixed(5))),[[HQ.lx0,HQ.lz0],[HQ.lx1,HQ.lz0],[HQ.lx1,HQ.lz1],[HQ.lx0,HQ.lz1]]);
 assert.ok(buildings.some(b=>b.id==='casino_wing'));
 assert.ok(!M.mapBuildings({...FM,LOTS_MAP:lots.filter(l=>!l.label)},interactions).some(b=>b.id==='casino_wing'));
 assert.ok(!M.mapBuildings({...FM,LOTS_MAP:[]},[]).some(b=>b.id.startsWith('rent_')));
});
test('castle follows real foot-world fort, not old approach prompt; colosseum follows superellipse',()=>{
 const f=buildings.find(b=>b.id==='castle'); assert.equal(f.x,FORT.x);assert.equal(f.z,FORT.z);
 for(const p of buildings.find(b=>b.id==='coliseum').polygons[0]) assert.ok(Math.abs(ellF(...CO.w2t(...p))-1)<1e-10);
});
test('all paths are finite closed-able polygons with emblems and names',()=>{
 for(const b of buildings){ assert.ok(b.name && b.icon); for(const p of b.polygons){assert.ok(p.length>=4);for(const v of p) assert.ok(v.every(Number.isFinite));}}
});
test('rotated footprints and minimap zoom project all corners without changing world dimensions',()=>{
 const yaw=0.7, r=M.rectangle(11,-7,8,6,yaw), near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9);
 near(Math.hypot(r[1][0]-r[0][0],r[1][1]-r[0][1]),8);
 near(Math.hypot(r[2][0]-r[1][0],r[2][1]-r[1][1]),6);
 const paths=[];const ctx=new Proxy({}, {get:(_,k)=>k==='moveTo'||k==='lineTo'?(...p)=>paths.push(p):()=>{},set:()=>true});
 const subset=[{polygons:[r]}]; const heading=1.2,c=Math.cos(heading),s=Math.sin(heading);
 for(const scale of [0.7,1.7,3]){paths.length=0;const project=(x,z)=>[90+scale*(x*c-z*s),90+scale*(x*s+z*c)];M.drawBuildingFootprints(ctx,subset,project);assert.deepEqual(paths,r.map(p=>project(...p)));}
});
test('source wiring preserves HUD range, removes inset, uses page-only sailing sheet and social space',()=>{
 const s=readFileSync(new URL('../js/islandMap.js',import.meta.url),'utf8');
 assert.ok(s.includes('paperSheet(\'island\')')); assert.ok(s.includes('paperSheet(true)'));
 assert.ok(s.includes('let zr = 95')); assert.ok(s.includes('want = dn < 45 ? 52'));
 assert.ok(s.includes("getElementById('soc-panel')")); assert.ok(s.includes('fc.clientWidth'));
 assert.ok(!s.includes("fillText('HARBOR TOWN'")); assert.ok(!s.includes('p.town'));
 assert.ok(s.includes('zoomPOIs = raw.filter'));
 const t=readFileSync(new URL('../js/dock/treasureMap.js',import.meta.url),'utf8');
 assert.ok(t.includes("bare === 'island' && SAIL_ALL"));assert.ok(t.includes('if (!bare) { const tw'));
});
test('real parchment sheet covers offshore boat extremes only on Island Map; title omitted without erasing map', async()=>{
 const texts=[];
 const context=new Proxy({}, {get:(_,k)=>k==='createImageData'?(w,h)=>({data:new Uint8ClampedArray(w*h*4)}):k==='createRadialGradient'?()=>({addColorStop(){}}):k==='fillText'?(text)=>texts.push(text):()=>{},set:()=>true});
 globalThis.document={createElement:t=>t==='canvas'?{width:0,height:0,getContext:()=>context}:{},head:{appendChild(){}}};
 const {createTreasureMap}=await import('../js/dock/treasureMap.js');
 const {SAIL}=await import('../js/dock/canoe.js');
 const ground={...FM,H:(x,z)=>Math.hypot(x,z)<500?3:-20,TERRAIN:{rev:0},MAP_PATHS:()=>null,FOOT_POIS:[]};
 const chart=createTreasureMap({FM:ground,toF:CO.fromHarbor,low:true});
 const hud=chart.sheet(true);texts.length=0;const page=chart.sheet('island');
 assert.ok(!texts.includes('PUMPFUN PIRATES'));assert.ok(!texts.some(t=>/chart of the isle/.test(t)));
 const [cx,cz]=CO.fromHarbor(SAIL.cx,SAIL.cz);
 for(const [x,z] of [[cx-SAIL.r,cz],[cx+SAIL.r,cz],[cx,cz-SAIL.r],[cx,cz+SAIL.r]]){
  const px=(x-page.x0)*page.k,py=(z-page.z0)*page.k;
  assert.ok(px>0&&px<page.w&&py>0&&py<page.h,`offshore ${x},${z}`);
 }
 assert.ok(page.w/page.k>hud.w/hud.k);
 assert.equal(chart.sheet(true),hud);assert.equal(chart.sheet('island'),page);
 texts.length=0;chart.sheet(false);assert.ok(texts.includes('PUMPFUN PIRATES'),'treasure reward retains its own banner');
});
