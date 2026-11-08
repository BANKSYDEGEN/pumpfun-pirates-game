declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
// Shared, fixed-source market snapshot. One DB lease across edge isolates; no open proxy, cookies or client keys.
import { aboutToBond, parseCurvePools, parseSwapPools, volumeLeaders, mergeMigrated, fetchNewPumpSwap, fetchCallouts, fetchTokenDetail } from './lib/feeds.js';
import { safeMint, safeText, safeImg, selectPair, pairRow } from './lib/market.js';
import { makeDexPaidFeed } from './lib/dexpaid.js';
import { countHolders, heliusConfigured, readCurve } from './helius.ts';
const GT='https://api.geckoterminal.com/api/v2/networks/solana',DEX='https://api.dexscreener.com';
const TOKENS=[{sym:'SUNK',ca:'By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump'},{sym:'AHOY',ca:'39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump'}];
const TTL=15000, MAX_AGE=600000;
const db=()=>Deno.env.get('SUPABASE_URL')+'/rest/v1/boardfeed_cache';
const headers=()=>{const k=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;return {'Content-Type':'application/json',apikey:k,Authorization:'Bearer '+k};};
async function dbRead(){const r=await fetch(db()+'?id=eq.hq&select=*',{headers:headers(),signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('cache unavailable');return (await r.json())[0];}
async function lease(){const now=new Date().toISOString();const r=await fetch(db()+'?id=eq.hq&lease_until=lt.'+encodeURIComponent(now),{method:'PATCH',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify({lease_until:new Date(Date.now()+110000).toISOString()}),signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('cache unavailable');return (await r.json()).length===1;}
let local:any=null,localAt=0,work:Promise<any>|null=null;
async function refresh(previous:any){
 const sources:any=previous?.sources||{},s:any=previous?.state||{prices:{},details:{},updated:{},status:{}};s.status ||= {};s.updated ||= {};let gtNext=0;let gtQueue=Promise.resolve();
 const source=async(url:string)=>{
  if(!url.startsWith(GT+'/')&&!url.startsWith(DEX+'/'))throw Error('source not allowed');
  const ttl=url.includes('/info')||url.includes('/ohlcv/')||url.includes('/tokens/')&&url.includes('/pools?')?300000:url.includes('/new_pools')&&!url.endsWith('page=1')?60000:TTL;
  const hit=sources[url];if(hit?.failed&&Date.now()-hit.failedAt<60000)throw Error('source cooling down');if(hit?.body&&Date.now()-hit.at<ttl)return hit.body;
  const run=async()=>{const wait=gtNext-Date.now();if(url.startsWith(GT)&&wait>0)await new Promise(r=>setTimeout(r,wait));
   try {const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok){sources[url]={...hit,failed:true,failedAt:Date.now(),status:r.status};throw Error('source unavailable');}const body=await r.json();sources[url]={at:Date.now(),body};return body;} finally {if(url.startsWith(GT))gtNext=Date.now()+2500;}};
  if(url.startsWith(GT)){const p=gtQueue.then(run);gtQueue=p.then(()=>{},()=>{});return p;}return run();
 };
 const publish=async(release=false)=>{const sorted=Object.keys(sources).sort((a,b)=>Math.max(sources[a].at||0,sources[a].failedAt||0)-Math.max(sources[b].at||0,sources[b].failedAt||0));for(const u of sorted)if(Date.now()-Math.max(sources[u].at||0,sources[u].failedAt||0)>1800000||Object.keys(sources).length>96)delete sources[u];const payload={state:s,sources,helius:{configured:heliusConfigured(),tradeStream:'webhook',rewards:'inactive'}};for(const u of sorted){if(new TextEncoder().encode(JSON.stringify(payload)).length<=1500000)break;delete sources[u];}const body:any={payload,fetched_at:new Date().toISOString()};if(release)body.lease_until=new Date(0).toISOString();const r=await fetch(db()+'?id=eq.hq',{method:'PATCH',headers:headers(),body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('cache write unavailable');local=payload;localAt=Date.now();return payload;};
 const put=(key:string,rows:any,at=Date.now(),label='Shared market cache')=>{s[key]=rows;s.updated[key]=at;s.status[key]=label;};
 const bad=(key:string)=>{s.status[key]=s[key]?.length?'Refresh failed · showing last good snapshot':'Feed offline';};
 const at=(url:string)=>sources[url]?.at||0;
 await Promise.all([
  (async()=>{try{await Promise.all(TOKENS.map(async t=>{const u=DEX+'/latest/dex/tokens/'+t.ca,j=await source(u),p=selectPair(j.pairs,t.ca);if(!p)throw Error('no pair');s.prices[t.sym]={...pairRow(p),pair:{pairAddress:p.pairAddress},updated:at(u),stale:false};}));s.updated.prices=Math.min(...TOKENS.map(t=>s.prices[t.sym].updated));s.status.prices='Shared DexScreener prices';}catch{s.status.prices='Refresh failed · last good prices';for(const p of Object.values(s.prices) as any[])p.stale=true;}})(),
  (async()=>{const u=GT+'/dexes/pump-fun/pools?sort=h24_volume_usd_desc&include=base_token&page=1',v=GT+'/dexes/pumpswap/pools?sort=h24_volume_usd_desc&include=base_token&page=1';let curve:any[]=[],swap:any[]=[];let ok=false;
   try{curve=parseCurvePools(await source(u));put('bonding',aboutToBond(curve),at(u),'Shared GeckoTerminal curve snapshot · ≈ progress');ok=true;}catch{bad('bonding');}
   try{swap=parseSwapPools(await source(v));ok=true;}catch{}
   if(ok){put('volume',volumeLeaders([...curve,...swap]),Math.min(...[at(u),at(v)].filter(Boolean)),'Shared GeckoTerminal · 24h pool volume');s.migrated=mergeMigrated([s.migrated||[],swap],Date.now());}else bad('volume');
  })(),
  (async()=>{const u=GT+'/trending_pools?include=base_token';try{const j=await source(u),tokens=new Map((j.included||[]).map((t:any)=>[t.id,t.attributes])),rows:any[]=[],seen=new Set();for(const p of j.data||[]){const a=p.attributes||{},base:any=tokens.get(p.relationships?.base_token?.data?.id),mint=base?.address,dex=p.relationships?.dex?.data?.id||'';if(!safeMint(mint)||!(/pump/i.test(dex))||seen.has(mint))continue;seen.add(mint);const num=(x:any)=>x==null||x===''||!Number.isFinite(+x)?null:+x;rows.push({mint,symbol:safeText(base.symbol),name:safeText(base.name),price:num(a.base_token_price_usd),cap:num(a.market_cap_usd)??num(a.fdv_usd),change:num(a.price_change_percentage?.h24),volume:num(a.volume_usd?.h24),imageUrl:safeImg(base.image_url)});}put('trending',rows.slice(0,10),at(u),'Shared GeckoTerminal trending');}catch{bad('trending');}})(),
  (async()=>{try{const u=DEX+'/token-boosts/latest/v1';const seen=new Map((s.callouts||[]).map((r:any)=>[r.mint+':'+(r.amount||0),r.seenAt]));put('callouts',await fetchCallouts(source,Date.now(),seen),at(u),'Shared DexScreener boosts');}catch{bad('callouts');}})(),
  (async()=>{try{const paid=makeDexPaidFeed({fetcher:async (url:string)=>({ok:true,json:()=>source(url)} as any)});const rows=await paid.fetchDexJustPaid();if(/offline/i.test(paid.state.status))throw Error('offline');put('dexpaid',rows,at(DEX+'/token-profiles/latest/v1'),paid.state.status.replace('120s snapshots','shared snapshots'));}catch{bad('dexpaid');}})(),
 ]);
 await publish(); // Publish the fast lists before slower migration backfill and charts.
 // Newest pools first. Additional pages fill the top ten; deep pages have a 60s source cache.
 try {const newest=Math.max(0,...(s.migrated||[]).map((r:any)=>r.createdAt||0));const rows=await fetchNewPumpSwap(source,{stopBefore:newest});put('migrated',mergeMigrated([rows,s.migrated||[]],Date.now()),at(GT+'/new_pools?include=base_token&page=1'),'Shared newest PumpSwap pools + live PumpPortal');}catch{bad('migrated');}
 await publish();
 for(const t of TOKENS){try{const old=s.details[t.sym]||{},d:any=await fetchTokenDetail(source,t.ca,s.prices[t.sym]?.pair?.pairAddress,{curve:t.sym==='SUNK'&&!old.bonded});const bonded=old.bonded||d.curve?.bonded||false;const detailUrls=Object.keys(sources).filter(u=>u.startsWith(GT+'/')&&(u.includes(t.ca)||u.includes(s.prices[t.sym]?.pair?.pairAddress+'/')));const holdersAt=at(GT+'/tokens/'+t.ca+'/info')||old.holdersAt||0,chartAt=at(GT+'/pools/'+s.prices[t.sym]?.pair?.pairAddress+'/ohlcv/hour?aggregate=1&limit=24&currency=usd')||old.chartAt||0;s.details[t.sym]={...old,holdersAt,chartAt,holders:old.chainAt&&Date.now()-old.chainAt<600000?old.holders:d.holders??old.holders??null,chart:d.chart.length?d.chart:old.chart||[],...(t.sym==='SUNK'?{bonded,curveProgress:bonded?null:d.curve?.progress??old.curveProgress??null}:{}),updated:Math.max(0,...detailUrls.map(u=>at(u)))};
  if(heliusConfigured()&&Date.now()-(old.chainAttemptAt||0)>600000){s.details[t.sym].chainAttemptAt=Date.now();const holders=await countHolders(t.ca);if(holders)s.details[t.sym]={...s.details[t.sym],...holders,chainAt:Date.now(),updated:Date.now(),holderSource:'Helius · unique nonzero owners'};}
 }catch{}
  try{if(t.sym==='SUNK'){const old=s.details[t.sym]||{};if(old.bondedAt)Object.assign(old,{bonded:true,curveProgress:null,curveSource:'chain'});else if(heliusConfigured()){const c=await readCurve(t.ca);if(c){const now=Date.now();s.details[t.sym]={...old,bonded:c.bonded,curveProgress:c.bonded?null:c.progress,curveSource:'chain',curveAt:now,updated:Math.max(+old.updated||0,now),...(c.bonded?{bondedAt:now}:{})};}}}}catch{}
  {const x=s.details[t.sym];if(x?.curveAt)x.updated=Math.max(+x.updated||0,x.curveAt);}
 }
 return await publish(true);
}
async function refreshOnce(row:any){if(work)return work;work=(async()=>{if(!await lease())return row?.payload;return await refresh(row?.payload);})().finally(()=>{work=null;});return work;}
const MINTSYM:Record<string,string>={'39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump':'AHOY','By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump':'SUNK','So11111111111111111111111111111111111111112':'SOL','pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn':'PUMP'};
let tradeCache:any=null,tradeAt=0;
async function recentTrades(){if(tradeCache&&Date.now()-tradeAt<5000)return tradeCache;const out:any={AHOY:[],SUNK:[]};let last=0;
 for(const t of TOKENS){const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/helius_trades?select=signature,side,token_amount,quote_mint,quote_amount,sol_amount,wallet_short,block_time,received_at&mint=eq.'+t.ca+'&order=block_time.desc&limit=20',{headers:headers(),signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('trades unavailable');
  out[t.sym]=(await r.json()).map((x:any)=>{last=Math.max(last,Date.parse(x.received_at)||0);return {id:String(x.signature).slice(0,16),side:x.side,amount:+x.token_amount,sol:x.sol_amount==null?null:+x.sol_amount,quote:MINTSYM[x.quote_mint]||null,quoteAmount:x.quote_amount==null?null:+x.quote_amount,wallet:x.wallet_short,at:Date.parse(x.block_time)};});}
 tradeCache={trades:out,lastAt:last||null};tradeAt=Date.now();return tradeCache;}
Deno.serve(async req=>{
 const o=req.headers.get('origin'),allowed=o==='https://game.pumpfunpirates.com'||/^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o||'');
 const h:Record<string,string>={'Content-Type':'application/json','Vary':'Origin','Access-Control-Allow-Methods':'GET, OPTIONS','Cache-Control':'no-store'};if(allowed)h['Access-Control-Allow-Origin']=o!;
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:h});if(req.method!=='GET')return new Response('{}',{status:405,headers:h});
 try{let row;if(local&&Date.now()-localAt<TTL)row={payload:local,fetched_at:new Date(localAt).toISOString()};else row=await dbRead();let data=row?.payload;
  let age=Date.now()-Date.parse(row?.fetched_at||'');const coreAt=Math.min(...Object.values(data?.state?.updated||{}).filter((x:any)=>typeof x==='number') as number[]);if(!data?.state || age>TTL || Date.now()-coreAt>TTL){const p=refreshOnce(row);if(data?.state){EdgeRuntime.waitUntil(p.catch(()=>{}));}else {data=await p;age=0;}}
  if(!data?.state || (Number.isFinite(age)&&age>MAX_AGE))return new Response(JSON.stringify({ok:false,error:'Feed offline'}),{status:503,headers:h});
  let tr:any=null;try{tr=await recentTrades();}catch{}
  const helius={...data.helius,tradeStream:!tr?'offline':tr.lastAt&&Date.now()-tr.lastAt<21600000?'live':'idle',tradesAt:tr?.lastAt??null};
  return new Response(JSON.stringify({ok:true,state:tr?{...data.state,trades:tr.trades}:data.state,helius}),{headers:h});
 }catch{return new Response(JSON.stringify({ok:false,error:'Feed offline'}),{status:503,headers:h});}
});
