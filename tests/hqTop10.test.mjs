import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {BOARD_ROWS,WALL_ROW_Y0,WALL_ROW_H,MAIN_ROW_Y0,MAIN_ROW_H,BOOST_STEP_MS,boardRows,mainBoardRow} from '../js/pumpfun/boardgrid.js';
import {WALL_BOARDS,wallRows,wallPanelMint} from '../js/pumpfun/wallboards.js';
import {dexPanelRow} from '../js/pumpfun/dexpanel.js';
import {boardScale,boardTexture} from '../js/pumpfun/boardtexture.js';
import {aboutToBond,justMigrated,volumeLeaders} from '../js/pumpfun/feeds.js';
import {makeDexPaidFeed} from '../js/pumpfun/dexpaid.js';
import {makeMarketFeed} from '../js/pumpfun/market.js';
const rows=Array.from({length:12},(_,i)=>({mint:'A'.repeat(30)+'BCDEFGHJKLMN'[i]+'pump',symbol:'COIN'+i,progress:60+i,volume:100+i,createdAt:1000+i,venue:'pumpswap'}));
const uv=y=>({x:.5,y:1-y/512});
test('ranked parsers return ten sorted real rows, never padding empty or sparse feeds',()=>{
 assert.equal(BOARD_ROWS,10);
 for(const f of [aboutToBond,volumeLeaders,r=>justMigrated(r,2000)]){
  assert.equal(f(rows).length,10);assert.equal(f([rows[0]]).length,1);assert.deepEqual(f([]),[]);
  assert.equal(f(rows)[0].mint,rows[11].mint);
 }
});
test('all wall grids and main-board hit grid reach row ten but not eleven',()=>{
 for(const b of WALL_BOARDS.filter(b=>!b.ours)){
  const s={[b.key]:rows};assert.equal(wallRows(b,s,0).length,10);
  for(let i=0;i<10;i++)assert.equal(wallPanelMint(b,s,uv(WALL_ROW_Y0+WALL_ROW_H*(i+.5)),0),rows[i].mint);
  assert.equal(wallPanelMint(b,s,uv(WALL_ROW_Y0+WALL_ROW_H*10+1),0),null);
  assert.equal(wallPanelMint(b,{[b.key]:rows.slice(0,2)},uv(WALL_ROW_Y0+WALL_ROW_H*9.5),0),null);
 }
 for(let i=0;i<10;i++){
  assert.equal(dexPanelRow(uv(WALL_ROW_Y0+WALL_ROW_H*(i+.5))),i);
  assert.equal(mainBoardRow({y:1-(MAIN_ROW_Y0+MAIN_ROW_H*(i+.5))/384}),i);
 }
 assert.equal(dexPanelRow(uv(WALL_ROW_Y0+WALL_ROW_H*10+1)),-1);
 assert.equal(mainBoardRow({y:1-(MAIN_ROW_Y0+MAIN_ROW_H*10+1)/384}),-1);
 assert.ok(WALL_ROW_Y0+WALL_ROW_H*10<448,'rows stop above footer');
});
test('main and side DEX BOOSTED share the identical ten-row scrolling window every 2.5 seconds',()=>{
 const b=WALL_BOARDS.find(b=>b.key==='callouts'),s={callouts:rows};assert.equal(b.tickMs,BOOST_STEP_MS);
 for(const t of [0,2499,2500,5000,29999,30000])assert.deepEqual(wallRows(b,s,t).map(r=>r.mint),boardRows(s,'callouts',t).map(r=>r.mint));
 assert.equal(boardRows(s,'callouts',2499)[0].mint,rows[0].mint);assert.equal(boardRows(s,'callouts',2500)[0].mint,rows[1].mint);
 assert.equal(boardRows({callouts:rows.slice(0,2)},'callouts',5000).length,2);
});
test('every generated board texture is sRGB, anisotropic and mip-filtered, mobile density capped',()=>{
 assert.equal(boardScale(true),1);assert.equal(boardScale(false),2);
 for(const low of [false,true]){const t=boardTexture({width:640,height:512},low);assert.equal(t.colorSpace,THREE.SRGBColorSpace);assert.equal(t.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(t.magFilter,THREE.LinearFilter);assert.equal(t.generateMipmaps,true);assert.ok(t.anisotropy>=4);t.dispose();}
 for(const p of ['render','dexpanel','wallpanels'])assert.match(readFileSync(new URL('../js/pumpfun/'+p+'.js',import.meta.url),'utf8'),/boardTexture/);
 const dock=readFileSync(new URL('../js/dock/pumpfun.js',import.meta.url),'utf8');assert.match(dock,/const rows=\(s\[key\]\|\|\[\]\)\.slice\(0,BOARD_ROWS\)/);assert.match(dock,/mod.drawHQBoard\(hq.cv,marketFeed.state,hqBoardAt\)/);
});
test('DEX paid returns ten verified rows with the existing ten-check request budget',async()=>{
 const paid=rows.slice(0,10);let orders=0;
 const f=makeDexPaidFeed({clock:()=>10000,fetcher:async u=>({ok:true,json:async()=>{
  if(u.includes('token-profiles'))return paid.map(r=>({chainId:'solana',tokenAddress:r.mint}));
  if(u.includes('/orders/')){orders++;return [{chainId:'solana',tokenAddress:u.split('/').at(-1),type:'tokenProfile',status:'approved',paymentTimestamp:1000}];}return [];
 }})});assert.equal((await f.fetchDexJustPaid()).length,10);assert.equal(orders,10);await f.fetchDexJustPaid();assert.equal(orders,10);
});
test('trending keeps ten entries from one existing queued pool call',async()=>{
 let trends=0;
 const f=makeMarketFeed({storage:null,gtGapMs:1,fetcher:async u=>({ok:true,json:async()=>{
  if(u.includes('trending_pools')){trends++;return {data:rows.map((r,i)=>({attributes:{},relationships:{base_token:{data:{id:'t'+i}},dex:{data:{id:'pump-fun'}}}})),included:rows.map((r,i)=>({id:'t'+i,attributes:{address:r.mint,symbol:r.symbol}}))};}
  return {data:[],included:[]};
 }})});await f.tick(true,true);assert.equal(f.state.trending.length,10);assert.equal(trends,1);
});
test('AHOY and SUNK occupy distinct existing board meshes, no added geometry or feed clients',()=>{
 const ours=WALL_BOARDS.filter(b=>b.ours);assert.equal(ours.length,2);
 assert.deepEqual(ours.map(b=>[b.slot,b.ours]),[['squad_ranks',['SUNK']],['front_e',['AHOY']]]);
 for(const b of ours){const mint=wallPanelMint(b,{},uv(300));assert.ok(mint);assert.equal(wallPanelMint(b,{},uv(40)),null);}
 assert.notEqual(wallPanelMint(ours[0],{},uv(300)),wallPanelMint(ours[1],{},uv(300)));
 const code=readFileSync(new URL('../js/pumpfun/wallpanels.js',import.meta.url),'utf8');assert.match(code,/hq.squadBoards/);assert.doesNotMatch(code,/new THREE\.(Plane|Box)Geometry|fetch\(/);
});
test('attachment reuses seven existing meshes and releases replaced placeholder textures',async()=>{
 const {attachWallPanels}=await import('../js/pumpfun/wallpanels.js');
 const {HQ_PANELS}=await import('../js/pumpfun/site.js');
 const {attachDexPanel}=await import('../js/pumpfun/dexpanel.js');
 const oldDocument=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0})};
 try {for(const low of [false,true]){
  const mesh=()=>new THREE.Mesh(new THREE.PlaneGeometry(3.72,3),new THREE.MeshBasicMaterial());
  const hq={panels:HQ_PANELS.map(p=>{const m=mesh();m.userData.panelSlot=p.id;return m;}),squadBoards:['squad','squad_ranks','daily_ranks'].map(a=>{const m=mesh();m.userData.pumpAction=a;return m;})};
  const geometries=[...hq.panels,...hq.squadBoards].map(m=>m.geometry);
  const wall=attachWallPanels(hq,low),dex=attachDexPanel(hq,low);assert.equal(wall.length,6);assert.ok(dex);
  for(const b of [...wall,dex]){assert.equal(b.cv.width,low?640:1280);assert.equal(b.cv.height,low?512:1024);}
  assert.deepEqual([...hq.panels,...hq.squadBoards].map(m=>m.geometry),geometries);
  assert.equal(wall.find(w=>w.board.ours?.[0]==='SUNK').mesh,hq.squadBoards[1]);
  for(const m of [...hq.panels,...hq.squadBoards]){m.material.map?.dispose();m.material.dispose();m.geometry.dispose();}
 }}finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});
