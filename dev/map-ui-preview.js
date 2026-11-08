// Isolated visual QA page. Executes production map UI, CSS, terrain and social UI.
// Placement fixture/synthetic peers only: no gameplay session, wallet, backend, audio or messaging.
import * as FM from '../js/island/foot.js';
import { coastLayout } from '../js/dock/layout.js';
import { RENTABLE_SHOPS, MAIN_ST_SHOPS, SQUAD_HALL } from '../js/island/hillShops.js';
import { CASINO_HALL, CASINO_WING } from '../js/island/casinoData.js';
import { SAIL } from '../js/dock/canoe.js';
import { createIslandMap, mapOverlayViewport } from '../js/islandMap.js';
import { createTreasureMap } from '../js/dock/treasureMap.js';
import { createSocial } from '../js/social.js';
import { setMapStyle } from '../js/mapIcons.js';
try {
  const layout = await coastLayout();
  for (const s of [...RENTABLE_SHOPS,...MAIN_ST_SHOPS,SQUAD_HALL]) FM.LOTS_MAP.push({lx:s.lx,z:s.lz,w:s.w,d:s.d,side:s.lot.startsWith('L')?-1:1});
  for (const [r,label] of [[CASINO_HALL.rect,'CASINO'],[CASINO_WING.rect,'CASINO: HIGH SEAS ROOM']]) FM.LOTS_MAP.push({lx:(r.lx0+r.lx1)/2,z:(r.lz0+r.lz1)/2,w:r.lz1-r.lz0,d:r.lx1-r.lx0,label});
  FM.LIGHTHOUSES.push({id:'lighthouse',x:-758,z:18,opts:{height:20}},{id:'sandbar_lh',x:-745,z:-435,opts:{baseR:4.6}});
  FM.FOOT_POIS.push(...FM.LIGHTHOUSES.map(l=>({id:l.id,x:l.x,z:l.z})));
  const footInteract=[];
  for (const [id,q,label] of [['rent_2','mm_wanted','WANTED BOARD · CONTRACTS'],['rent_3','mm_rum','HARBOR RUM EXPORT STALL · SELL RUM'],['rent_4','mm_buyer_harbor','HARBOR FENCE'],['rent_16','mm_fight','FIGHT MASTER']]) {
    const s=RENTABLE_SHOPS.find(s=>s.id===id),[x,z]=layout.footToHarbor(...FM.townToWorld(s.lx,s.lz));footInteract.push({id:q,x,z,label});
  }
  const world={foot:{spots:{trees:[],palms:[]}},footInteract};
  const pos=(x,z)=>{const [a,b]=layout.footToHarbor(x,z);return {x:a,z:b};};
  const state={me:{...pos(-620,-91),yaw:0,foot:true},ship:{...pos(-710,-80),yaw:0},peers:[{...pos(970,-100),foot:false},{...pos(-1250,-200),foot:false}],ai:[{...pos(-1210,60)},{...pos(1070,90)},{...pos(-1180,-190)}]};
  const style=new URLSearchParams(location.search).get('style');setMapStyle(style || 'treasure');
  const treasure=createTreasureMap({FM,toF:layout.harborToFoot,decks:layout.decks,layout});
  const map=createIslandMap({world,layout,low:false,paperSheet:bare=>treasure.sheet(bare)});
  const peers=new Map([['sample1',{id:'sample1',name:'Harbor Scout',mate:true}],['sample2',{id:'sample2',name:'Captain Ash',mate:false}],['sample3',{id:'sample3',name:'The Golden Gull',mate:false}]]);
  const relations=new Map();
  const pv={where:'harbor',room:{send(){}},party:{code:''},peers,isHarborSquadMate:q=>q.mate,myId:'preview1',name:'Preview Captain',partyMake:()=>'',partyJoin(){}};
  createSocial({pvp:()=>pv,friends:{relationOf:n=>relations.get(n)||'',request:n=>{relations.set(n,'sent');return Promise.resolve();}},toast(){}});
  setInterval(()=>{for(const p of peers.values())p.heard=performance.now();},200);
  for(const p of peers.values())p.heard=performance.now();
  map.bakeRows(2000);map.open(()=>state);
  document.getElementById('preview-reopen').onclick=()=>map.open(()=>state);
  addEventListener('keydown',e=>{if(e.code==='Escape')map.close();else if(e.code==='KeyM')map.toggle(()=>state);});
  // Review only: ?zoom=5 starts near the buildings; default includes offshore fixture dots.
  const zoom=Number(new URLSearchParams(location.search).get('zoom'));
  if(zoom>1)setTimeout(()=>{
    const canvas=document.querySelector('#isle-map > canvas'),r=canvas.getBoundingClientRect();
    const key=document.querySelector('.im-building-key').getBoundingClientRect(),panel=document.getElementById('soc-panel');
    const v=mapOverlayViewport(r.width,r.height,key.right-r.left+16,panel?r.right-panel.getBoundingClientRect().left+16:16);
    const k=Math.min(v.width,v.height)/(2*(SAIL.r+60)),[cx,cz]=layout.harborToFoot(SAIL.cx,SAIL.cz);
    map.zoomAt(zoom,v.x+(-540-cx)*k,v.y+(-80-cz)*k);
  },600);
} catch(error) {
  const pre=document.createElement('pre');pre.id='preview-error';pre.textContent='Preview failed to load (not browser verified):\n'+error.stack;document.body.append(pre);
}
