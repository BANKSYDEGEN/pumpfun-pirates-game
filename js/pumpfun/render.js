import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hqParts, petParts, HQ_CHANDELIERS, HQ_TORCHES } from './model.js';
import { HQ, PET_LOT } from './site.js';
export function buildParts(parts, low=false) {
 const group=new THREE.Group(),bins=new Map();
 for(const p of parts){if(p.detail&&low)continue;const geo=p.kind==='pill'?new THREE.CapsuleGeometry(p.h/2,p.w-p.h,4,low?8:12).rotateZ(Math.PI/2).scale(1,1,p.d/p.h):new THREE.BoxGeometry(p.w,p.h,p.d);geo.translate(p.x,p.y,p.z);(bins.get(p.c)||bins.set(p.c,[]).get(p.c)).push(geo);}
 for(const [c,geos] of bins){const geo=mergeGeometries(geos);geos.forEach(g=>g.dispose());group.add(new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:c})));}
 return group;
}
function plaque(group,url,w,h,x,y,z,yaw=0){const tex=new THREE.TextureLoader().load(url);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=2;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));m.position.set(x,y,z);m.rotation.y=yaw;group.add(m);return m;}
export function buildHQ(low=false){const group=new THREE.Group();group.name='pumpfun_hq_detail';
 plaque(group,'assets/pumpfun/hq_sign.webp',19,1.93,-18.5,HQ.floor+9.4,-29.45);
 const referral=plaque(group,'assets/pumpfun/referral_sign.webp',5.2,1.3,-18.5,HQ.floor+5.9,-29.85);referral.userData.referral=true;
 const cv=document.createElement('canvas');cv.width=low?512:1024;cv.height=low?128:256;const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
 const board=new THREE.Mesh(new THREE.PlaneGeometry(HQ.board.w,HQ.board.h),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));board.position.set(HQ.board.lx,HQ.board.y,HQ.board.lz+.08);group.add(board);
 const squadBoards = [['squad',-33.5,'squad'],['squad_ranks',-39,'squad_ranks'],['daily_ranks',-44.5,'daily_ranks']].map(([file,z,kind])=>{const m=plaque(group,'assets/pumpfun/'+file+'.webp',4.7,4.6,-32.16,6.9,z,Math.PI/2);m.userData.pumpAction=kind;return m;});
 try{glow(group,low);}catch(e){console.warn('[pumpfun] hall glow skipped',e.message);}
 return {group,board,referral,cv,tex,squadBoards,dispose(){group.traverse(o=>{o.geometry?.dispose?.();const m=o.material;if(m){m.map?.dispose?.();m.dispose?.();}});group.removeFromParent();}};}
// [post-hq-castle] casino-style warmth with ZERO realtime lights: unlit flame cores + painted additive light pools on the floor,
// walls and ceiling (one 128 px gradient shared by every pool, all merged into ONE mesh).
function glow(group,low){
 const flames=hqParts().filter(p=>p.glow);if(flames.length){const g=buildParts(flames.map(p=>({...p,detail:false})),false);g.traverse(o=>{if(o.material){const c=o.material.color;o.material.dispose();o.material=new THREE.MeshBasicMaterial({color:c,toneMapped:false});}});group.add(g);}
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),r=x.createRadialGradient(64,64,2,64,64,64);
 r.addColorStop(0,'rgba(255,200,120,0.85)');r.addColorStop(.45,'rgba(255,160,70,0.32)');r.addColorStop(1,'rgba(255,140,50,0)');x.fillStyle=r;x.fillRect(0,0,128,128);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const Y=HQ.floor,geos=[];
 const pool=(w,px,py,pz,rx,ry)=>{const g=new THREE.PlaneGeometry(w,w);g.rotateX(rx);g.rotateY(ry);g.translate(px,py,pz);geos.push(g);};
 for(const z of HQ_CHANDELIERS){pool(9,-18.5,Y+.06,z,-Math.PI/2,0);if(!low)pool(6,-18.5,Y+HQ.ceil-.02,z,Math.PI/2,0);}
 for(const [px,pz] of HQ_TORCHES){const s=px<-18?1:-1;pool(4.2,px+s*.03,Y+3.4,pz,0,s*Math.PI/2);pool(4,px+s*1.6,Y+.05,pz,-Math.PI/2,0);}
 pool(10,HQ.board.lx,Y+HQ.dais.rise+.05,-61.8,-Math.PI/2,0);
 const m=new THREE.Mesh(mergeGeometries(geos),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2}));geos.forEach(g=>g.dispose());m.renderOrder=2;group.add(m);}
export function buildPetDress(low=false){const g=buildParts(petParts(),low);g.name='pet_store_L4_dress';
 plaque(g,'assets/pumpfun/pet_sign.webp',5.65,.6,-1.14,PET_LOT.doorY+3.6,-114.76,Math.PI/2);
 plaque(g,'assets/pumpfun/pet_sign.webp',3,.9,-9.09,12.69,-114.761,Math.PI/2);
 plaque(g,'assets/pumpfun/pet_sign.webp',1.6,1.1,-7.69,10.84,-111.1,Math.PI/2);
 return g;}
const usd=v=>v===null||v===undefined?'—':'$'+(Math.abs(v)>=1e6?(v/1e6).toFixed(2)+'M':Math.abs(v)>=1e3?(v/1e3).toFixed(1)+'K':v>=1?v.toFixed(2):v.toPrecision(3));
export function drawHQBoard(cv,state){const g=cv.getContext('2d'),k=cv.width/1536;g.save();g.setTransform(k,0,0,cv.height/384,0,0);const W=1536;
 g.fillStyle='#101f1c';g.fillRect(0,0,W,384);g.strokeStyle='#54d08a';g.lineWidth=5;g.strokeRect(3,3,W-6,378);g.textBaseline='middle';g.textAlign='left';
 const text=(s,x,y,n=27,c='#e9e5d6')=>{g.font=`${n}px "Just Another Hand",sans-serif`;g.fillStyle=c;g.fillText(String(s),x,y);};
 text('PUMPFUN PIRATES / MARKET WATCH',24,24,33,'#54d08a');text('FREE SNAPSHOTS · NOT A LIVE TRADE FEED',925,24,25,'#ffcd77');
 ['SUNK','AHOY','PUMP'].forEach((sym,i)=>{const p=state.prices[sym],x=24+i*500;text('$'+sym+'  '+(p?usd(p.price):state.status.prices==='Loading…'?'Loading…':'Feed offline')+'   '+(p?.cap!=null?'MC '+usd(p.cap):p?.fdv!=null?'FDV '+usd(p.fdv):'MC —'),x,65,29);text((p?.change!=null?(p.change>=0?'+':'')+p.change.toFixed(1)+'% 24h':'24h —')+'   VOL '+usd(p?.volume)+(p?.stale?' · STALE':''),x,98,24,p?.change<0?'#ff817b':'#54d08a');});
 const defs=[['ABOUT TO BOND','bonding','No verified free near-bond source'],['TRENDING TOKENS','trending','GeckoTerminal · Pump venues, Solana trending'],['TRENDING CALLOUTS','callouts','Latest DexScreener PAID BOOSTS · not social calls']];
 defs.forEach(([title,key,source],i)=>{const x=24+i*500;g.fillStyle='#254038';g.fillRect(x-4,126,482,216);text(title,x+8,149,32,'#ffcd77');text(source,x+8,180,22,'#a8bfb0');
  const rows=state[key].slice(0,3);if(!rows.length){text(key==='bonding'?'No verified near-bond tokens available':state.status[key]==='Loading…'?'Loading…':'Feed offline',x+8,226,24);text(key==='bonding'?'Never estimated from market cap':'Retrying when nearby',x+8,261,23,'#a8bfb0');}
  text((state.status[key]||'Loading…').slice(0,58),x+8,326,19,'#a8bfb0');
  rows.forEach((r,n)=>text(`${n+1}. ${r.symbol}  ${key==='bonding'?r.progress.toFixed(1)+'%':key==='callouts'?r.amount+' boosts':usd(r.volume)+' vol / 24h'}`,x+8,221+n*39,29));});
 text('E / controller / tap to browse · token links open pump.fun · not financial advice',24,366,25,'#a8bfb0');g.restore();}
