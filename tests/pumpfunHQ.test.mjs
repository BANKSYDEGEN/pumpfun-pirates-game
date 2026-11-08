import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HQ,HQ_WALLS,PET_LOT,PET_SHOP,TOKEN_BOARD_SPOTS,petFloor} from '../js/pumpfun/site.js';
import {makeMarketFeed,selectPair,WATCH_TOKENS,PRICE_MS,DISCOVERY_MS} from '../js/pumpfun/market.js';
import {tokenURL,tokenFallbackURL,REFERRAL_CODE,REFERRAL_URL} from '../js/pumpfun/links.js';
import {hqParts} from '../js/pumpfun/model.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('HQ fits before trader and leaves existing Hill Street, Outfit Store and walk route clear',()=>{
 assert.ok(HQ.lx0>=-33&&HQ.lx1<=-4);assert.ok(HQ.lz0>=-65&&HQ.lz1<=-30);
 assert.ok(HQ.lz0>-68.5);assert.ok(HQ.lx0>-34);assert.ok(HQ.lx1<-1);
 for(const [x,z,w,d] of HQ_WALLS){assert.ok(x-w/2>=HQ.lx0-.01&&x+w/2<=HQ.lx1+.01);assert.ok(z-d/2>=HQ.lz0-.01&&z+d/2<=HQ.lz1+2.1);assert.ok(!(x-w/2< HQ.door.lx && x+w/2>HQ.door.lx&&z+d/2>=HQ.door.lz-.6));}
});
test('first really empty hill room is L4; buyer shops and trader are preserved',()=>{assert.equal(PET_LOT.lot,'L4');assert.equal(PET_LOT.id,'rent_5');const I=PET_LOT.interior;assert.ok(PET_SHOP.lx>I.lx0&&PET_SHOP.lx<I.lx1);assert.ok(PET_SHOP.lz>I.lz0&&PET_SHOP.lz<I.lz1);assert.ok(petFloor(I.lz0)>petFloor(I.lz1));assert.ok(PET_SHOP.keeper.lx<I.lx0+1);});
test('moved boards retain safe gaps from lamps, palms and street, common source drives prompts',()=>{for(const b of Object.values(TOKEN_BOARD_SPOTS)){assert.equal(b.lz,-14);assert.ok(b.lx<-27);assert.ok(b.lx-2.3>-54);assert.ok(b.lz+2.2>-14);}assert.match(src('js/island/plazaTown.js'),/\.\.\.tokenSpot\(t.sym\)/);assert.match(src('js/dock/layout.js'),/tb.lz \+ 2.2/);});
test('safe referral links use fixed hosts/code, never an untrusted source URL',()=>{const mint=WATCH_TOKENS[0].ca,other='GDRSWpEeKWngc26CVLFXZyZCUwo9fEzctZoEAp1qpump';assert.equal(REFERRAL_CODE,'PUMPFUNPIRATES');for(const m of [mint,other]){assert.equal(tokenURL(m),'https://pump.fun/coin/'+m+'?caller=3kDkcoVoJNmrC6fe98SQU7cK1rwvGT77ouBDB871wy34&ref=PUMPFUNPIRATES');assert.equal(tokenFallbackURL(m),tokenURL(m));}assert.equal(REFERRAL_URL,'https://pump.fun/u/PUMPFUNPIRATES');for(const x of ['<script>','https://evil.test','../coin','',null])assert.equal(tokenURL(x),null);});
test('pair selection requires exact BASE mint and Solana, prefers liquidity',()=>{const a=WATCH_TOKENS[0].ca;assert.equal(selectPair([{chainId:'solana',baseToken:{address:'wrong'},quoteToken:{address:a},priceUsd:'20'}],a),null);const p=[1,4,2].map(x=>({chainId:'solana',baseToken:{address:a},liquidity:{usd:x},priceUsd:'0.01'}));assert.equal(selectPair(p,a),p[1]);});
test('one lazy poller coalesces callers, bounded cadence, prices stay last-known on failure',async()=>{let now=1,calls=[],fail=false;const feed=makeMarketFeed({clock:()=>now,fetcher:async url=>{calls.push(url);if(fail)throw Error('offline');return{ok:true,json:async()=>url.includes('/latest/dex/tokens/')?{pairs:WATCH_TOKENS.map(t=>({chainId:'solana',baseToken:{address:t.ca,symbol:t.sym,name:'a<img onerror=x>'},priceUsd:'0.01',marketCap:12,volume:{h24:3},priceChange:{h24:2}}))}:[]};}});
 await feed.tick(false);assert.equal(calls.length,0);await Promise.all([feed.tick(true),feed.tick(true)]);assert.equal(calls.length,3);assert.equal(feed.state.prices.SUNK.price,.01);await feed.tick(true);assert.equal(calls.length,3);now+=PRICE_MS;fail=true;await feed.tick(true);assert.equal(feed.state.prices.SUNK.price,.01);assert.equal(feed.state.prices.SUNK.stale,true);
});
test('discovery distinguishes sponsored boosts; never invents bonding progress or ranking rows',async()=>{let now=1;const feed=makeMarketFeed({clock:()=>now,fetcher:async url=>({ok:true,json:async()=>url.includes('/launches')?{source:'pumpfun:unavailable',launches:[]}:url.includes('trending_pools')?{data:[],included:[]}:[]})});await feed.tick(true,true);assert.deepEqual(feed.state.bonding,[]);assert.doesNotMatch(feed.state.status.bonding,/Loading/);assert.match(feed.state.status.callouts,/PAID PROMOTION/);assert.ok(DISCOVERY_MS>=120000);});
test('light geometry budget and no fake buy ticker, untrusted DOM HTML or paid feed',()=>{assert.ok(hqParts().length<900&&hqParts().filter(p=>!p.detail).length<400&&hqParts().filter(p=>p.glow).length<90);const code=src('js/dock/pumpfun.js');assert.ok(!code.includes('innerHTML'));assert.match(code,/createFlightParrot/);assert.match(code,/low\?\['parrot_green'\]:/);assert.ok(!src('js/pumpfun/market.js').includes('WebSocket'));assert.match(code,/no ranking feed connected/);});

import {HQ_PILLARS,HQ_TOWERS} from '../js/pumpfun/site.js';
const inBox=([x,z,w,d],px,pz,pad=.3)=>Math.abs(px-x)<w/2+pad&&Math.abs(pz-z)<d/2+pad;
const solidAt=(lx,lz,pad=.3)=>HQ_WALLS.some(b=>inBox(b,lx,lz,pad));
test('the rear wall is gone: one hall over the whole footprint, open across the old wall line (lz -48)',()=>{
 assert.ok(!HQ_WALLS.some(([x,z,w,d])=>d>5&&w>5)); // no solid rear mass of any size
 assert.ok(!hqParts().some(p=>p.z===-56.5&&p.h===9.6));
 for(let lz=-31;lz>=-63.8;lz-=.25) assert.ok(!solidAt(-18.5,lz),'centre aisle blocked at '+lz);
 for(const lx of [-30,-18.5,-8]) for(const lz of [-47,-48,-49,-50]) assert.ok(!solidAt(lx,lz),'old wall line blocked at '+lx);
 const plaza=src('js/island/plazaTown.js');
 assert.match(plaza,/lz>=HQ.lz0-3&&lz<HQ.lz1\)\{const o=Math.max\(HQ.lx0-lx,HQ.lz0-lz,0\);h=Math.min\(h,HQ.floor-.05\+o\*1.3\)/); // floor flattened to the back wall
 assert.match(plaza,/hw:14.2,hl:17.2,yaw:yaw0,y:HQ.floor/);
 assert.match(plaza,/lz0: HQ.lz0\+.8, lz1: HQ.lz1-.5 \}, HQ.ceil-.4/);
});
test('tall gilded beamed ceiling, chandeliers and painted light pools, no realtime lights',()=>{
 const parts=hqParts(),Y=HQ.floor;assert.ok(HQ.ceil>=11);
 const ceiling=parts.filter(p=>p.mat===26&&p.w>25&&p.d>30).sort((a,b)=>b.y-a.y)[0];assert.ok(ceiling.y-ceiling.h/2-Y>=11);
 assert.ok(parts.filter(p=>p.glow).length>=30);
 const r=src('js/pumpfun/render.js');assert.ok(!/PointLight|SpotLight|PMREM/.test(r));assert.match(r,/AdditiveBlending/);assert.match(r,/c.width=c.height=128/);
 assert.match(src('js/dock/pumpfun.js'),/hq.dispose\(\)/);
 assert.ok(!src('js/dock/pumpfun.js').includes('BANKSYDEGEN'));assert.ok(!r.includes('BANKSYDEGEN'));
 assert.match(r,/PET_LOT.doorY\+3.6/);
});
test('pirate-fortress exterior: crenellated parapet, round gun towers, stone kit materials, no roof cones',()=>{
 const parts=hqParts(),TOP=HQ.floor+HQ.wallTop;
 assert.ok(parts.filter(p=>p.kind==='box'&&p.y>TOP+.5&&p.y<TOP+1.5&&p.mat===11).length>=50);
 assert.equal(HQ_TOWERS.length,2);assert.ok(parts.filter(p=>p.kind==='cyl').length>=6);
 assert.ok(parts.some(p=>p.mat===11)&&parts.some(p=>p.mat===22)&&parts.some(p=>p.mat===26));
 assert.ok(!src('js/pumpfun/model.js').includes('ConeGeometry'));
 assert.match(src('js/island/plazaTown.js'),/p.kind==='cyl'/);
});
test('exactly two entrances: dock plaza gate + Hill Street door, both walkable; no back door, tunnel or ramp',()=>{
 assert.ok(!HQ.sideDoor&&!HQ.backDoor);
 // dock plaza gate: walk from the plaza straight in
 for(let lz=-26;lz>=-34;lz-=.25) assert.ok(!solidAt(HQ.door.lx,lz,.35),'front gate blocked '+lz);
 for(const lx of [HQ.door.lx-HQ.door.w/2-.6,HQ.door.lx+HQ.door.w/2+.6]) assert.ok(solidAt(lx,-30.3,0));
 // Hill Street door: walk in from the street (east) across the 1 m wall
 const D=HQ.hillDoor;for(let lx=-1;lx>=-9;lx-=.25) assert.ok(!solidAt(lx,D.lz,.35),'hill door blocked '+lx);
 for(const lz of [D.lz-D.w/2-.6,D.lz+D.w/2+.6]) assert.ok(solidAt(D.lx,lz,0));
 // the back wall is solid end to end (no door toward the trader), and it is the plaza deck height everywhere inside
 for(let lx=-32;lx<=-5;lx+=.5) assert.ok(solidAt(lx,-64.7,0),'back wall gap '+lx);
 const plaza=src('js/island/plazaTown.js');assert.ok(!plaza.includes('pumpfun_backdoor'));assert.ok(!src('js/pumpfun/model.js').includes('backDoor'));
 assert.match(plaza,/c=T\(HQ.hillDoor.lx,HQ.hillDoor.lz\); h.addDeck/);
 assert.ok(HQ.dais.rise<=.5); // a step, not a climb (DECK_STEP 0.6)
 for(const q of HQ_PILLARS) assert.ok(Math.abs(q.lx-HQ.door.lx)>4);
});

// v475 supplied token_AHOY, which was never a SHOP_ICONS entry: the first
// completed minimap bake threw inside the frame loop when going ashore.
test('HQ landmark has a real map icon and unknown icons cannot kill the frame',()=>{
 assert.match(src('js/mapLandmarks.js'), /\[HQ.id, HQ.id,/);
 assert.match(src('js/mapIcons.js'), /pumpfun_hq: \['coin'/);
 assert.match(src('js/islandMap.js'), /SHOP_ICONS\[l.icon\] \|\| SHOP_ICONS.shop/);
 assert.match(src('js/features.js'), /PILLY_ENABLED = false/);
});

test('board CSP allows only the needed public discovery host; no unverified launch proxy',()=>{
 const html=src('index.html'),feed=src('js/pumpfun/market.js');
 assert.match(html,/connect-src[^;]*https:\/\/api.geckoterminal.com/);
 assert.ok(!html.includes('three.ws'));assert.ok(!feed.includes('three.ws'));
 assert.match(src('js/pumpfun/render.js'),/Feed offline/);
});

test('p2: towers clear the Outfit Store eaves, every bench / prop is solid, walk routes stay open',async()=>{
 const {OUTFIT_STORE}=await import('../js/island/outfitStore.js');const {HQ_PROPS}=await import('../js/pumpfun/site.js');
 const eave=OUTFIT_STORE.lx+OUTFIT_STORE.w/2;for(const t of HQ_TOWERS)assert.ok(t.lx-t.r-.6>eave+1.2,'tower under outfit eaves');
 for(const [k,x,z] of HQ_PROPS)assert.ok(HQ_WALLS.some(b=>inBox(b,x,z,0)),'no collider for '+k);
 assert.ok(HQ_PROPS.filter(p=>p[0]==='bench').length===2);
 for(const k of ['cannon','maptable','rack','treasure','rope'])assert.ok(HQ_PROPS.some(p=>p[0]===k),k);
 for(let lz=-26;lz>=-59;lz-=.25)assert.ok(!solidAt(-18.5,lz,.35),'aisle '+lz);
 for(let lx=-1;lx>=-18.5;lx-=.25)assert.ok(!solidAt(lx,HQ.hillDoor.lz,.35),'hill route '+lx);
 assert.match(src('js/pumpfun/render.js'),/const n=low\?256:512/); // damask <= 1024 px
});
