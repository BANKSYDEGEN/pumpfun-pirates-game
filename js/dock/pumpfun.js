// Proximity-built PUMPFUN hall + hill L4 pet store. No server writes, wallets, paid services or external images.
import * as THREE from 'three';
import { HQ, PET_LOT, PET_SHOP, petFloor, hqDistance } from '../pumpfun/site.js';
import { t2w, t2wYaw, w2t } from '../island/coast.js';
import { marketFeed, WATCH_TOKENS } from '../pumpfun/market.js';
import { openPump, openReferral, openSquad, openLeaderboard, tokenURL, tokenFallbackURL } from '../pumpfun/links.js';
const money=v=>v==null?'—':'$'+Number(v).toLocaleString('en-US',{maximumSignificantDigits:5});
export function createPumpfun({world,layout,camera,canvas,low=false}) {
 const root=new THREE.Group();root.name='pumpfun_hq';root.position.set(t2w(0,0)[0],0,t2w(0,0)[1]);root.rotation.y=t2wYaw(0);(world.footGroup||world.root).add(root);
 // A distant, texture-free shell only; expensive detail, canvases, pets and keeper load near their respective rooms.
 const proxy=new THREE.Group(); // Shell is merged into the plaza stone kit, not a mismatched distant box.

 let mod=null,loading=null,hq=null,petDress=null,petLoad=null,petReady=false,birds=[],keeper=null,rev=-1,active=false,nearHQ=false,lastPet=0,nearPet=false;
 let panel=null,uiRev=-1;
 const rendered=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
 const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();let down=null;
 function localPoint(p){return w2t(...layout.harborToFoot(p.x,p.z));}
 function loadRender(){return loading||(loading=import('../pumpfun/render.js').then(m=>(mod=m)).catch(e=>{loading=null;console.warn('[pumpfun] render unavailable',e.message);}));}
 function dress(){if(hq||!mod)return;hq=mod.buildHQ(low);root.add(hq.group);proxy.visible=false;}
 async function pets(){if(petLoad||petReady)return;petLoad=(async()=>{
  await loadRender();if(!mod)return;
  if(!petDress){petDress=mod.buildPetDress(low);root.add(petDress);}
  const [{createFlightParrot},{PirateGLB},{applyGear}]=await Promise.all([import('../parrotFlight.js'),import('../pirateGLB.js'),import('../pirateGear.js')]);
  const f=await import('../parrotFlight.js');
  for(const id of (low?['parrot_green','parrot_red']:['parrot_green','parrot_red','parrot_blue'])){const bird=await createFlightParrot(id);bird.scale.setScalar(.48);bird.userData.shopAnimate=f.animateParrot;root.add(bird);birds.push(bird);}
  keeper=await PirateGLB.create({lod:'lo'});await applyGear(keeper,{outfit:'shirt',hat:'none',pants:'classic_pants',boots:'boots_classic'});
  keeper.root.position.set(PET_SHOP.keeper.lx,petFloor(PET_SHOP.keeper.lz),PET_SHOP.keeper.lz);keeper.root.rotation.y=Math.PI/2;keeper.root.scale.setScalar(1.1);keeper.mixer.setTime(.35);root.add(keeper.root);petReady=true;
 })().catch(e=>{console.warn('[pet store] load unavailable',e.message);petReady=true;}).finally(()=>{petLoad=null;});}
 function createPanel(){if(panel)return;panel=document.createElement('section');panel.id='pumpfun-panel';panel.className='gp-modal hidden';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','PUMPFUN PIRATES token boards');document.body.append(panel);
  const style=document.createElement('style');style.textContent=`#pumpfun-panel{position:fixed;inset:6vh 5vw;z-index:75;background:#101b18;color:#e9e5d6;border:2px solid #54d08a;border-radius:18px;padding:20px;overflow:auto;font:18px system-ui;overscroll-behavior:contain}#pumpfun-panel.hidden{display:none}#pumpfun-panel h2{color:#54d08a;font:40px 'Just Another Hand';margin:0 0 10px}#pumpfun-panel button{cursor:pointer;border:1px solid #547566;background:#213e33;color:#54d08a;border-radius:8px;padding:12px;font:inherit;text-align:left}#pumpfun-panel button:focus-visible{outline:3px solid #ffcd77}#pumpfun-panel .ph-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}#pumpfun-panel .ph-col{min-width:0;padding:12px;border:1px solid #466153;border-radius:12px}#pumpfun-panel h3{color:#ffcd77;margin:5px 0 14px;font-size:20px}#pumpfun-panel .ph-rows{display:grid;gap:8px}#pumpfun-panel small{display:block;color:#b3c4b8;font-size:13px;line-height:1.5;margin:8px 0}#pumpfun-panel .ph-x{float:right}#pumpfun-panel .ph-actions{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}@media(max-width:700px){#pumpfun-panel{inset:3vh 3vw;padding:14px}#pumpfun-panel .ph-grid{grid-template-columns:1fr}}`;document.head.append(style);
  panel.addEventListener('pointerdown',e=>e.stopPropagation());addEventListener('keydown',e=>{if(e.code==='Escape'&&isOpen()){e.stopPropagation();close();}},true);
 }
 function isOpen(){return !!panel&&!panel.classList.contains('hidden');}
 function close(){panel?.classList.add('hidden');panel?.classList.remove('on');}
 function open(){createPanel();panel.classList.remove('hidden');panel.classList.add('on');renderPanel();panel.querySelector('button')?.focus();}
 function button(text,act,parent){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=act;parent.append(b);return b;}
 function renderPanel(){if(!panel)return;const focused=panel.querySelector(':focus')?.dataset.key;const s=marketFeed.state;panel.replaceChildren();const x=button('Close ×',close,panel);x.className='ph-x';
  const h=document.createElement('h2');h.textContent='PUMPFUN PIRATES / TOKEN HALL';panel.append(h);
  const note=document.createElement('small');note.textContent='Free snapshots, not live trades. Promotions are not endorsements.';panel.append(note);
  const actions=document.createElement('div');actions.className='ph-actions';panel.append(actions);button('Get the pump.fun app',()=>openReferral(),actions);button('Join our squad · PFPIRATES',openSquad,actions);
  const grid=document.createElement('div');grid.className='ph-grid';panel.append(grid);
  const col=(title,status)=>{const c=document.createElement('div');c.className='ph-col';const t=document.createElement('h3');t.textContent=title;c.append(t);const st=document.createElement('small');st.textContent=status||'Waiting for a free snapshot';c.append(st);grid.append(c);return c;};
  const prices=col('OUR TOKENS',s.status.prices);for(const t of WATCH_TOKENS){const p=s.prices[t.sym];const b=button('$'+t.sym+' · '+money(p?.price)+' / '+(p?.cap!=null?'MC '+money(p.cap):'FDV '+money(p?.fdv))+' / '+(p?.change==null?'—':p.change.toFixed(1)+'%')+' 24h / VOL '+money(p?.volume)+(p?.stale?' · STALE':''),()=>openPump(t.ca),prices);b.dataset.key=t.ca;const f=button('Alternative coin page · $'+t.sym,()=>window.open(tokenFallbackURL(t.ca),'_blank','noopener,noreferrer'),prices);f.style.fontSize='12px';}
  for(const [key,title] of [['bonding','ABOUT TO BOND'],['trending','TRENDING TOKENS'],['callouts','TRENDING CALLOUTS']]){const c=col(title,s.status[key]);const rows=s[key];if(!rows.length){const n=document.createElement('small');n.textContent=key==='bonding'?'No verified near-bond tokens available. Progress is never guessed from market cap.':'No current entries available.';c.append(n);}for(const r of rows){const b=button((r.symbol||r.mint.slice(0,6))+' · '+(key==='bonding'?r.progress.toFixed(1)+'% bonded':key==='callouts'?r.amount+' paid boosts':money(r.volume)+' volume / 24h'),()=>openPump(r.mint),c);b.dataset.key=r.mint;}}
  for(const daily of [false,true]){const c=col(daily?'DAILY LEADERBOARDS':'PUMPFUN SQUAD LEADERBOARD','LIVE RANKINGS ON PUMP.FUN · no ranking feed connected');const tabs=document.createElement('small');tabs.textContent='Traders  /  Perps  /  Squads  /  Rewards';c.append(tabs);button('View live '+(daily?'daily leaderboard':'squad standings'),()=>openLeaderboard(daily),c);}
  uiRev=s.revision;if(focused){const b=[...panel.querySelectorAll('button')].find(b=>b.dataset.key===focused);b?.focus();}}
 function update(on,position,t){active=!!on&&!document.hidden;const [lx,lz]=position?localPoint(position):[1e6,1e6];nearHQ=active&&hqDistance(lx,lz)<32;nearPet=active&&Math.hypot(lx-PET_SHOP.lx,lz-PET_SHOP.lz)<17;
  if(!active){close();if(hq)hq.group.visible=false;if(petDress)petDress.visible=false;for(const b of birds)b.visible=false;if(keeper)keeper.root.visible=false;return;}
  const dist=hqDistance(lx,lz);proxy.visible=dist>=95||!hq;if(dist<95&&!hq)loadRender().then(dress);if(hq){hq.group.visible=dist<95;if(nearHQ&&rev!==marketFeed.state.revision){mod.drawHQBoard(hq.cv,marketFeed.state);hq.tex.needsUpdate=true;rev=marketFeed.state.revision;}}
  if(nearPet&&!petReady)pets();if(petDress)petDress.visible=nearPet;if(keeper)keeper.root.visible=nearPet;
  if(nearPet){const now=performance.now();if(now-lastPet>(low?50:33)){lastPet=now;birds.forEach((b,i)=>{const a=t*.48+i*2.094;const bx=PET_SHOP.birds.lx+Math.cos(a)*1.1,bz=PET_SHOP.birds.lz+Math.sin(a)*1.8;b.position.set(bx,petFloor(bz)+2.35+Math.sin(a*1.7+i)*.24,bz);b.rotation.set(.05,-a-Math.PI/2,-.16);b.userData.shopAnimate(b,t+i);b.visible=true;});}}
  else for(const b of birds)b.visible=false;
  if(isOpen()&&uiRev!==marketFeed.state.revision)renderPanel();
 }
 canvas?.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
 canvas?.addEventListener('pointerup',e=>{if(!active||!nearHQ||!hq||!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8||isOpen())return;const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);const hit=ray.intersectObjects([hq.board,hq.referral,...hq.squadBoards],false)[0];if(!hit)return; const solid=ray.intersectObjects((world.footGroup||world.root).children,true).find(h=>rendered(h.object)&&h.object!==hq.board&&h.object!==hq.referral&&!hq.squadBoards.includes(h.object));if(solid&&solid.distance<hit.distance-.05)return;
  if(hit.object===hq.referral)openReferral();else if(hit.object.userData.pumpAction){const a=hit.object.userData.pumpAction;if(a==='squad')openSquad();else openLeaderboard(a==='daily_ranks');}else if(hit.uv){const x=hit.uv.x,y=1-hit.uv.y;const col=Math.min(2,Math.floor(x*3));if(y<.31)openPump(WATCH_TOKENS[col].ca);else{const key=['bonding','trending','callouts'][col],row=Math.floor((y*384-202)/39),entry=marketFeed.state[key][row];if(entry&&row>=0&&row<3)openPump(entry.mint);else open();}}
 });
 return {update,open,close,get openNow(){return isOpen();},get near(){return nearHQ;},root};
}
