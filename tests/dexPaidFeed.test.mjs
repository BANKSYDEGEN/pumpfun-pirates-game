import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { makeDexPaidFeed, openDexPaidToken } from '../js/pumpfun/dexpaid.js';
import { PUMP_SHARE_URLS } from '../js/config.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const mint='GDRSWpEeKWngc26CVLFXZyZCUwo9fEzctZoEAp1qpump', ours='By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump';
test('profiles alone are not proof of payment; approved profile orders are sorted and cached 120s',async()=>{
 let now=1000000,calls=0,paid=true;
 const feed=makeDexPaidFeed({clock:()=>now,fetcher:async url=>{calls++;return {ok:true,json:async()=>url.includes('/token-profiles/')?[{chainId:'solana',tokenAddress:mint},{chainId:'ethereum',tokenAddress:mint}]:url.includes('/orders/')?{orders:paid?[{chainId:'solana',tokenAddress:mint,type:'tokenProfile',status:'approved',paymentTimestamp:900000}]:[]}:[]};}});
 assert.equal(feed.state.status,'Loading…');
 assert.equal((await feed.fetchDexJustPaid()).length,1);const first=calls;await feed.fetchDexJustPaid();assert.equal(calls,first);
 now+=120000;paid=false;assert.deepEqual(await feed.fetchDexJustPaid(),[]);
});
test('a failing feed reports Feed offline and never throws',async()=>{
 const feed=makeDexPaidFeed({fetcher:async()=>({ok:false,status:500})});
 assert.deepEqual(await feed.fetchDexJustPaid(),[]);assert.match(feed.state.status,/^Feed offline/);
});
test('Dex Just Paid clicks use the pump.fun link builder, never DexScreener or a visible code',()=>{
 const seen=[];globalThis.window={open:(url)=>seen.push(url)};
 openDexPaidToken({mint});openDexPaidToken({mint:ours});delete globalThis.window;
 assert.deepEqual(seen,['https://pump.fun/coin/'+mint,PUMP_SHARE_URLS[ours]]);
 for(const f of ['js/pumpfun/dexpaid.js','js/pumpfun/render.js','js/dock/pumpfun.js']){const s=src(f);assert.ok(!s.includes('BANKSYDEGEN'),f);assert.ok(!/dexscreener\.com\/solana/.test(s),f);}
});
