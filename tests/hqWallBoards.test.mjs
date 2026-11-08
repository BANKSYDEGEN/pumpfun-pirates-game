import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {curveProgress,parseBonding,parseCurvePools,parseSwapPools,justMigrated,volumeLeaders,parseCallouts,enrich} from '../js/pumpfun/feeds.js';
import {WALL_BOARDS,wallPanelMint} from '../js/pumpfun/wallboards.js';
import {makeMarketFeed} from '../js/pumpfun/market.js';
import {HQ_PANELS} from '../js/pumpfun/site.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const mint='GDRSWpEeKWngc26CVLFXZyZCUwo9fEzctZoEAp1qpump';
const gt=(rows)=>({data:rows.map(([id,dex,name,native,extra],i)=>({attributes:{name,base_token_price_native_currency:String(native),fdv_usd:'30000',volume_usd:{h24:'5'},...extra},relationships:{base_token:{data:{id:'t'+i}},dex:{data:{id:dex}}}})),included:rows.map(([id],i)=>({id:'t'+i,attributes:{address:id,symbol:'S'+i,name:'N'+i}}))});
test('pump.fun curve progress: 0% at launch price, 100% at graduation price',()=>{
 assert.ok(Math.abs(curveProgress(30/1.073e9))<1e-6);const vT=1.073e9-793.1e6;assert.ok(Math.abs(curveProgress((30*1.073e9/vT)/vT)-100)<1e-6);assert.equal(curveProgress(null),null);assert.equal(curveProgress('x'),null);});
test('about to bond keeps only SOL-quoted pump-fun curve pools 60..99.5%, sorted, never invents rows',()=>{
 const p=(pct)=>{const vT=1.073e9-793.1e6*pct/100;return 30*1.073e9/vT/vT;};
 const m2='By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump',m3='39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump';
 const rows=parseBonding(gt([[mint,'pump-fun','A / SOL',p(70)],[m2,'pump-fun','B / SOL',p(95)],[m3,'pump-fun','C / SOL',p(100)],['bad<x>','pump-fun','D / SOL',p(80)],['pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn','pumpswap','E / SOL',p(90)]]));
 assert.deepEqual(rows.map(r=>r.mint),[m2,mint]);assert.ok(Math.abs(rows[0].progress-95)<1e-6);
 assert.deepEqual(parseBonding({}),[]);assert.deepEqual(parseBonding([]),[]);assert.deepEqual(parseBonding(gt([[mint,'pump-fun','A / PUMP',p(80)]])),[]);});
test('just migrated / volume leaders / callout feed use real rows only',()=>{const now=Date.parse('2026-11-08T05:00:00Z');
 const vT=1.073e9-793.1e6,done=30*1.073e9/vT/vT;
 const curve=parseCurvePools(gt([[mint,'pump-fun','A / SOL',done,{pool_created_at:'2026-11-08T01:00:00Z',volume_usd:{h24:'900'}}]]));
 const swap=parseSwapPools(gt([['By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump','pumpswap','B / SOL',1,{pool_created_at:'2026-11-08T03:00:00Z',volume_usd:{h24:'5000'}}],['GXKH2nRJqu7BznzSdUELcMwk7C3ebNDcqB5YEgM4bbpK','pumpswap','C / SOL',1,{pool_created_at:'2026-11-08T04:00:00Z'}]]));
 assert.equal(swap.length,1);assert.deepEqual(justMigrated([...curve,...swap],now).map(r=>r.mint),['By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump',mint]);
 assert.deepEqual(justMigrated(curve,now+2*86400000),[]);assert.deepEqual(volumeLeaders([...curve,...swap]).map(r=>r.volume),[5000,900]);
 const seen=new Map(),c=parseCallouts([{chainId:'solana',tokenAddress:mint,amount:50,totalAmount:50},{chainId:'solana',tokenAddress:mint,amount:50,totalAmount:50},{chainId:'ethereum',tokenAddress:mint}],seen,now);
 assert.equal(c.length,1);assert.equal(c[0].seenAt,now);assert.equal(parseCallouts([{chainId:'solana',tokenAddress:mint,amount:50,totalAmount:50}],seen,now+9)[0].seenAt,now);
 const b=[{mint,symbol:'x',cap:null}];enrich(b,[{chainId:'solana',baseToken:{address:mint,symbol:'GIG',name:'n'},priceUsd:'0.001',marketCap:1234,priceChange:{h24:-3}}]);assert.equal(b[0].cap,1234);
 const ours=WALL_BOARDS.find(b=>b.slot==='front_w');assert.deepEqual(ours.ours,['AHOY']);assert.equal(wallPanelMint(ours,{},{y:1-150/512}),'39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump');const sunk=WALL_BOARDS.find(b=>b.slot==='front_e');assert.equal(wallPanelMint(sunk,{},{y:1-350/512}),'By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump');});
test('a dead feed reports Feed offline on every wall board key',async()=>{const feed=makeMarketFeed({fetcher:async()=>{throw Error('down');}});await feed.tick(true,true);for(const k of ['bonding','migrated','volume','callouts'])assert.match(feed.state.status[k],/^Feed offline/,k);});
test('all six wall slots carry a board; taps go through openPump; no DexScreener links or visible code',()=>{
 const w=src('js/pumpfun/wallboards.js')+src('js/pumpfun/wallpanels.js'),d=src('js/dock/pumpfun.js');
 for(const P of HQ_PANELS) assert.ok(P.id==='east_1'||w.includes(`slot: '${P.id}'`),P.id);
 assert.match(d,/wallPanelMint\(wb.board,marketFeed.state,hit.uv,wb.at\):null;if\(m\)openPump\(m\)/);
 for(const s of [w,src('js/pumpfun/feeds.js'),d,src('js/pumpfun/render.js')]){assert.ok(!s.includes('PUMPFUNPIRATES')&&!s.includes('BANKSYDEGEN')&&!s.includes('3kDkcoVoJNmrC6fe98SQU7cK1rwvGT77ouBDB871wy34'));assert.ok(!/dexscreener\.com\/solana|PointLight|SpotLight/.test(s));}
 assert.match(src('js/pumpfun/wallpanels.js'),/boardCanvas\(640, 512, low\)/);
 assert.deepEqual(WALL_BOARDS.map(b=>b.key),['bonding','callouts','migrated','volume','prices','prices']);});
