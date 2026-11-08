import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenCurveState,fetchTokenDetail} from '../js/pumpfun/feeds.js';
import {makeMarketFeed,CACHE_KEY,CACHE_MAX_AGE} from '../js/pumpfun/market.js';
const mint='By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump';
const price=p=>{const t=1.073e9-793.1e6*p/100;return 30*1.073e9/t/t;};
const pools=(dex='pump-fun',p=75)=>({data:[{attributes:{name:'SUNK / SOL',base_token_price_native_currency:price(p)},relationships:{base_token:{data:{id:'solana_'+mint}},dex:{data:{id:dex}}}}],included:[{id:'solana_'+mint,attributes:{address:mint,symbol:'SUNK'}}]});
test('SUNK progress uses the standard SOL curve price estimate, not volume or market cap',()=>{
 const c=tokenCurveState(pools(),mint,true);assert.equal(c.bonded,false);assert.ok(Math.abs(c.progress-75)<1e-7);
 const bad=pools();bad.data[0].attributes.base_token_price_native_currency=null;assert.deepEqual(tokenCurveState(bad,mint,true),{bonded:false,progress:null});
 const quote=pools();quote.data[0].attributes.name='SUNK / USDC';assert.equal(tokenCurveState(quote,mint,true).progress,null);
});
test('migration or token-specific curve disappearance hides progress; a global top-list omission does not',()=>{
 for(const dex of ['pumpswap','raydium','raydium-clmm'])assert.deepEqual(tokenCurveState(pools(dex),mint),{bonded:true,progress:null});
 assert.equal(tokenCurveState({data:[]},mint),null);assert.deepEqual(tokenCurveState({data:[]},mint,true),{bonded:true,progress:null});
 assert.deepEqual(tokenCurveState(pools('meteora-damm-v2'),mint,true),{bonded:true,progress:null});
 for(const j of [{},{data:null},{data:[{}]}])assert.equal(tokenCurveState(j,mint,true),null);
});
test('shared curve snapshot avoids an additional token-pools read; missing data stays unknown',async()=>{
 const calls=[];const get=async u=>{calls.push(u);if(u.includes('/pools?'))return pools();return {};};
 let d=await fetchTokenDetail(get,mint,null,{skipHolders:true,curve:true,curveSnapshot:{bonded:false,progress:75}});assert.equal(d.curve.progress,75);assert.equal(calls.length,0);
 d=await fetchTokenDetail(get,mint,null,{skipHolders:true,curve:true});assert.ok(Math.abs(d.curve.progress-75)<1e-7);assert.equal(calls.length,1);assert.match(calls[0],/tokens\/.*\/pools\?/);
 d=await fetchTokenDetail(async()=>{throw Error('offline');},mint,null,{skipHolders:true,curve:true});assert.equal(d.curve,null);
 d=await fetchTokenDetail(get,mint,null,{skipHolders:true,curve:false});assert.equal(calls.length,1,'already bonded stops curve requests');
});
test('graduation remains hidden after cached chart and price snapshots have expired',()=>{
 const cached={updated:{},prices:{},details:{SUNK:{bonded:true,curveProgress:75,updated:1}}};
 const f=makeMarketFeed({clock:()=>CACHE_MAX_AGE+1000,storage:{getItem:k=>k===CACHE_KEY?JSON.stringify(cached):null,setItem(){}}});
 assert.equal(f.state.details.SUNK.bonded,true);assert.equal(f.state.details.SUNK.curveProgress,undefined);
});
