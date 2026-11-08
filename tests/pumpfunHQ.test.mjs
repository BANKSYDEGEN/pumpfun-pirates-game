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
 for(const [x,z,w,d] of HQ_WALLS){assert.ok(x-w/2>=HQ.lx0-.01&&x+w/2<=HQ.lx1+.01);assert.ok(z-d/2>=HQ.lz0-.01&&z+d/2<=HQ.lz1+.01);assert.ok(!(x-w/2< HQ.door.lx && x+w/2>HQ.door.lx&&z+d/2>=HQ.door.lz-.6));}
});
test('first really empty hill room is L4; buyer shops and trader are preserved',()=>{assert.equal(PET_LOT.lot,'L4');assert.equal(PET_LOT.id,'rent_5');const I=PET_LOT.interior;assert.ok(PET_SHOP.lx>I.lx0&&PET_SHOP.lx<I.lx1);assert.ok(PET_SHOP.lz>I.lz0&&PET_SHOP.lz<I.lz1);assert.ok(petFloor(I.lz0)>petFloor(I.lz1));assert.ok(PET_SHOP.keeper.lx<I.lx0+1);});
test('moved boards retain safe gaps from lamps, palms and street, common source drives prompts',()=>{for(const b of Object.values(TOKEN_BOARD_SPOTS)){assert.equal(b.lz,-14);assert.ok(b.lx<-27);assert.ok(b.lx-2.3>-54);assert.ok(b.lz+2.2>-14);}assert.match(src('js/island/plazaTown.js'),/\.\.\.tokenSpot\(t.sym\)/);assert.match(src('js/dock/layout.js'),/tb.lz \+ 2.2/);});
test('safe referral links use fixed hosts/code, never an untrusted source URL',()=>{const mint=WATCH_TOKENS[0].ca;assert.equal(REFERRAL_CODE,'BANKSYDEGEN');assert.equal(tokenURL(mint),'https://pump.fun/c/'+mint+'/BANKSYDEGEN');assert.match(tokenFallbackURL(mint),/\?ref=BANKSYDEGEN$/);assert.equal(REFERRAL_URL,'https://pump.fun/u/BANKSYDEGEN');for(const x of ['<script>','https://evil.test','../coin','',null])assert.equal(tokenURL(x),null);});
test('pair selection requires exact BASE mint and Solana, prefers liquidity',()=>{const a=WATCH_TOKENS[0].ca;assert.equal(selectPair([{chainId:'solana',baseToken:{address:'wrong'},quoteToken:{address:a},priceUsd:'20'}],a),null);const p=[1,4,2].map(x=>({chainId:'solana',baseToken:{address:a},liquidity:{usd:x},priceUsd:'0.01'}));assert.equal(selectPair(p,a),p[1]);});
test('one lazy poller coalesces callers, bounded cadence, prices stay last-known on failure',async()=>{let now=1,calls=[],fail=false;const feed=makeMarketFeed({clock:()=>now,fetcher:async url=>{calls.push(url);if(fail)throw Error('offline');return{ok:true,json:async()=>url.includes('/latest/dex/tokens/')?{pairs:WATCH_TOKENS.map(t=>({chainId:'solana',baseToken:{address:t.ca,symbol:t.sym,name:'a<img onerror=x>'},priceUsd:'0.01',marketCap:12,volume:{h24:3},priceChange:{h24:2}}))}:[]};}});
 await feed.tick(false);assert.equal(calls.length,0);await Promise.all([feed.tick(true),feed.tick(true)]);assert.equal(calls.length,3);assert.equal(feed.state.prices.SUNK.price,.01);await feed.tick(true);assert.equal(calls.length,3);now+=PRICE_MS;fail=true;await feed.tick(true);assert.equal(feed.state.prices.SUNK.price,.01);assert.equal(feed.state.prices.SUNK.stale,true);
});
test('discovery distinguishes sponsored boosts; never invents bonding progress or ranking rows',async()=>{let now=1;const feed=makeMarketFeed({clock:()=>now,fetcher:async url=>({ok:true,json:async()=>url.includes('/launches')?{source:'pumpfun:unavailable',launches:[]}:url.includes('trending_pools')?{data:[],included:[]}:[]})});await feed.tick(true,true);assert.deepEqual(feed.state.bonding,[]);assert.match(feed.state.status.bonding,/unavailable/);assert.match(feed.state.status.callouts,/PAID PROMOTION/);assert.ok(DISCOVERY_MS>=180000);});
test('light geometry budget and no fake buy ticker, untrusted DOM HTML or paid feed',()=>{assert.ok(hqParts().length<65);const code=src('js/dock/pumpfun.js');assert.ok(!code.includes('innerHTML'));assert.match(code,/createFlightParrot/);assert.match(code,/low\?\['parrot_green','parrot_red'\]/);assert.ok(!src('js/pumpfun/market.js').includes('WebSocket'));assert.match(code,/no ranking feed connected/);});

test('high-ceiling hall uses the shared plaza stone kit; neutral signs retain referral targets',()=>{
 const parts=hqParts(),floor=HQ.floor;
 const ceiling=parts.find(p=>p.z===-39&&p.w===28&&p.h===.35);
 assert.ok(ceiling.y-ceiling.h/2-floor>=7.8);
 const front=parts.find(p=>p.z===-30.3&&p.w===11.5),back=parts.find(p=>p.z===-56.5&&p.h===9.6);
 assert.ok(front.y+front.h/2>=back.y+back.h/2);
 assert.ok(HQ.board.h>=6&&HQ.board.w>=24);
 assert.match(src('js/island/plazaTown.js'),/p.mat\|\|0/);
 assert.ok(parts.some(p=>p.mat===11));assert.ok(parts.some(p=>p.mat===22));assert.ok(parts.some(p=>p.mat===4&&p.rx===.55));
 assert.ok(!src('js/dock/pumpfun.js').includes('BANKSYDEGEN'));
 assert.ok(!src('js/pumpfun/render.js').includes('BANKSYDEGEN'));
 assert.match(src('js/pumpfun/render.js'),/PET_LOT.doorY\+3.6/);
});

test('cancelled hill entrance leaves no ramp, terrain override, deck or post colliders',()=>{
 const plaza=src('js/island/plazaTown.js');
 for(const removed of ['entranceGround','entranceParts','HILL_ENTRANCE','x:ex,z:ez,hw:3,hl:12','[2.75,10.25]'])assert.ok(!plaza.includes(removed),removed);
 assert.match(plaza,/for\(const p of hqParts\(\)\)/);
 assert.match(plaza,/hw:14,hl:9,yaw:yaw0,y:HQ.floor/); // HQ floor remains
});

test('east side door opens toward Trader with collider gap and one small doorstep',()=>{
 assert.deepEqual(HQ.sideDoor,{lx:-4,lz:-42,w:4});
 for(let x=-7;x<=-2.7;x+=.1)for(const [cx,cz,w,d] of HQ_WALLS)assert.ok(!(Math.abs(x-cx)<w/2+.33&&Math.abs(-42-cz)<d/2+.33),'side door walk lane');
 const parts=hqParts();assert.ok(!parts.some(p=>p.x===-6.5&&p.z===-42&&p.h===1));assert.ok(!parts.some(p=>p.x===-4.3&&p.z===-39.5&&p.d===19));
 const step=parts.find(p=>p.x===-3.3&&p.z===-42);assert.ok(Math.abs(step.y+step.h/2-HQ.floor-.15)<1e-6);
 assert.match(src('js/island/plazaTown.js'),/hw:.7,hl:2,yaw:yaw0,y:HQ.floor\+.15/);
});
