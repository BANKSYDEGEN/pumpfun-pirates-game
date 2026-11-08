import { BOARD_ROWS } from './boardgrid.js';
// One shared, proximity-driven FREE poller per game client. No socket, API key, timer, proxy or server deployment.
export const PRICE_MS = 60000, DISCOVERY_MS = 150000; // boards poll every 2.5 min
export const WATCH_TOKENS = [
 {sym:'SUNK',ca:'By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump'},
 {sym:'AHOY',ca:'39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump'},
 {sym:'PUMP',ca:'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn'}];
const DEX='https://api.dexscreener.com';
const finite=(v)=>v!==null && v!=='' && Number.isFinite(+v) ? +v : null;
export const safeMint=v=>typeof v==='string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
export const safeImg=v=>typeof v==='string'&&v.length<=400&&/^https:\/\/[a-z0-9.-]+\/[^\s"'<>]*$/i.test(v)?v:null; // board logos only; logos.js re-checks the host
export const safeText=v=>String(v??'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,48);
export function selectPair(pairs,ca) {return (Array.isArray(pairs)?pairs:[]).filter(p=>p.chainId==='solana'&&p.baseToken?.address===ca&&finite(p.priceUsd)>0).sort((a,b)=>(finite(b.liquidity?.usd)||0)-(finite(a.liquidity?.usd)||0))[0]||null;}
export function pairRow(p) {return {mint:p.baseToken.address,symbol:safeText(p.baseToken.symbol),name:safeText(p.baseToken.name),price:finite(p.priceUsd),cap:finite(p.marketCap),fdv:finite(p.fdv),change:finite(p.priceChange?.h24),volume:finite(p.volume?.h24),liquidity:finite(p.liquidity?.usd),imageUrl:safeImg(p.info?.imageUrl)};}
// GeckoTerminal's free API allows ~30 calls/min PER IP; the v491-v493 boards fired 8 at once every 120 s and phones behind a shared IP got 429s,
// which left boards on "Feed offline" (BANKSY t2276u "most of the boards are offline"). Every GT read now goes through ONE queue:
// <= 1 call / 2.5 s, most important lists first, exponential backoff on 429. Last good rows are kept in memory + localStorage and shown
// with "updated Xm ago"; "Feed offline" only appears when a board has never had data.
export const GT_GAP_MS = 2500, CACHE_KEY = 'pfp_hq_feed_v1', CACHE_MAX_AGE = 12 * 3600000;
const GT = 'https://api.geckoterminal.com/';
const BOARD_KEYS = ['trending','callouts','bonding','dexpaid','migrated','volume'];
const defaultStorage = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export function makeMarketFeed({fetcher=(...a)=>fetch(...a),clock=()=>Date.now(),storage=defaultStorage(),gtGapMs=GT_GAP_MS,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
 const state={prices:{},trending:[],callouts:[],bonding:[],dexpaid:[],migrated:[],volume:[],details:{},updated:{},status:{prices:'Loading…',trending:'Loading…',callouts:'Loading…',dexpaid:'Loading…',bonding:'Loading…',migrated:'Loading…',volume:'Loading…'},revision:0};
 let nextP=0,nextD=0,busyP=null,busyD=null,active=false,discovery=false;const controllers=new Set();
 // ---- last good snapshot (memory + localStorage) ----
 try { const c = storage && JSON.parse(storage.getItem(CACHE_KEY) || 'null'), now = clock();
  if (c && typeof c === 'object') { for (const k of BOARD_KEYS) { const at = +c.updated?.[k]; if (Array.isArray(c[k]) && c[k].length && now - at < CACHE_MAX_AGE) { state[k] = c[k].filter(r => r && safeMint(r.mint)).slice(0, 20); if (state[k].length) { state.updated[k] = at; state.status[k] = 'Saved snapshot · refreshing'; } } }
   for (const t of WATCH_TOKENS) { const p = c.prices?.[t.sym]; if (p && now - (+p.updated || 0) < CACHE_MAX_AGE && finite(p.price)) { state.prices[t.sym] = { ...p, stale: true }; state.updated.prices = Math.max(state.updated.prices || 0, +p.updated); } const d = c.details?.[t.sym]; if (d && now - (+d.updated || 0) < CACHE_MAX_AGE) state.details[t.sym] = d; }
   if (state.updated.prices) state.status.prices = 'Saved snapshot · refreshing'; } } catch {}
 let saveAt = 0;
 function save(force = false) { if (!storage) return; const now = clock(); if (!force && now - saveAt < 15000) return; saveAt = now;
  try { const c = { updated: state.updated, prices: {}, details: state.details }; for (const k of BOARD_KEYS) c[k] = state[k];
   for (const [k, p] of Object.entries(state.prices)) { const { pair, ...rest } = p; c.prices[k] = { ...rest, pair: pair?.pairAddress ? { pairAddress: pair.pairAddress } : null }; }
   storage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {} }
 const good = (k, rows, status) => { state[k] = rows; state.updated[k] = clock(); state.status[k] = status; state.revision++; };
 const failed = (k, label) => { state.status[k] = state[k].length ? 'Refresh failed · showing last good snapshot' : 'Feed offline' + (label ? ' · ' + label : ''); state.revision++; };
 async function rawGet(url){const c=new AbortController();controllers.add(c);const tm=setTimeout(()=>c.abort(),10000);try{const r=await fetcher(url,{signal:c.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok){const e=Error('HTTP '+r.status);e.status=r.status;throw e;}return await r.json();}finally{clearTimeout(tm);controllers.delete(c);}}
 // ---- the GeckoTerminal queue ----
 const gtJobs=[];let gtSeq=0,gtRun=false,gtNext=0,gtBackoff=0;
 function gtGet(url,prio=5){return new Promise((resolve,reject)=>{gtJobs.push({url,prio,seq:gtSeq++,tries:0,resolve,reject});gtJobs.sort((a,b)=>a.prio-b.prio||a.seq-b.seq);if(!gtRun)gtPump();});}
 async function gtPump(){gtRun=true;try{while(gtJobs.length){const wait=gtNext-Date.now();if(wait>0)await sleep(wait);
   if(!active){for(const j of gtJobs.splice(0))j.reject(Error('inactive'));break;}   // walked away: nothing fires while far from the HQ
   const j=gtJobs.shift();try{const v=await rawGet(j.url);gtBackoff=0;gtNext=Date.now()+gtGapMs;j.resolve(v);}
   catch(e){if(e.status===429||e.name==='TypeError'){gtBackoff=Math.min(60000,gtBackoff?gtBackoff*2:Math.max(5000,gtGapMs*2));gtNext=Date.now()+gtBackoff;   // a GT 429 has no CORS header, so the browser reports a TypeError
     if(++j.tries<3){gtJobs.unshift(j);continue;}}else gtNext=Date.now()+gtGapMs;j.reject(e);}}}finally{gtRun=false;}}
 const get=(url,prio)=>url.startsWith(GT)?gtGet(url,prio):rawGet(url);
 async function prices(){let bad=false;await Promise.all(WATCH_TOKENS.map(async t=>{try{
  // Separate token reads avoid the aggregate endpoint's 30-pair truncation (PUMP otherwise hides SUNK pools).
  const j=await get(DEX+'/latest/dex/tokens/'+t.ca),p=selectPair(j.pairs,t.ca);
  if(!p)throw Error('no priced pair');state.prices[t.sym]={...pairRow(p),pair:p,updated:clock(),stale:false};
 }catch{bad=true;if(state.prices[t.sym])state.prices[t.sym].stale=true;}}));
 if(!bad)state.updated.prices=clock();
 state.status.prices=bad?(Object.keys(state.prices).length?'Some prices failed · last good values marked stale':'Feed offline'):'DexScreener · 60s snapshots';state.revision++;save();}
 async function details(){const f=await import('./feeds.js');   // lazy: only after the main lists, lowest GT priority
  for(const sym of ['AHOY','SUNK']){try{if(busyP)await busyP.catch(()=>{});const t=WATCH_TOKENS.find(t=>t.sym===sym),old=state.details[sym]||{},fresh=old.holders!=null&&clock()-(old.holdersAt||0)<600000;
   const d=await f.fetchTokenDetail(u=>get(u,8),t.ca,state.prices[sym]?.pair?.pairAddress,{skipHolders:fresh});
   state.details[sym]={holders:d.holders??old.holders??null,holdersAt:d.holders!=null?clock():old.holdersAt||0,chart:d.chart.length?d.chart:(old.chart||[]),updated:d.holders!=null||d.chart.length?clock():old.updated||0};state.revision++;}catch{}}
  save(true);}
 async function discoveries(){let f=null;try{f=await import('./feeds.js');}catch{}   // load first so the main GT reads queue ahead of the rest
 await Promise.all([
  // DEX JUST PAID (BANKSY 2026-11-07): verified paid DexScreener profiles, own 120s cache; lazy module, errors never escape.
  (async()=>{try{const d=await import('./dexpaid.js');const rows=await d.fetchDexJustPaid(),st=d.dexPaidFeed.state.status;if(rows.length||!/offline/i.test(st))good('dexpaid',rows,st);else failed('dexpaid');}catch{failed('dexpaid');}})(),
  // HQ wall boards (BANKSY t2262u): ONE pump-fun curve pools read + ONE PumpSwap read (+ new pools, soft) feed About to Bond, Volume Leaders and Just Migrated.
  (async()=>{try{const G=GT+'api/v2/networks/solana',q='?sort=h24_volume_usd_desc&include=base_token&page=1';
   const curveP=get(G+'/dexes/pump-fun/pools'+q,0),swapP=get(G+'/dexes/pumpswap/pools'+q,1).catch(()=>null),freshP=get(G+'/new_pools?include=base_token&page=1',3).catch(()=>null);
   const publish=(curveJ,swapJ,freshJ)=>{const curve=[...f.parseCurvePools(curveJ),...f.parseCurvePools(freshJ)],swap=[...f.parseSwapPools(swapJ),...f.parseSwapPools(freshJ)],now=clock();
    const bonding=f.aboutToBond(curve),volume=f.volumeLeaders([...curve,...swap]),migrated=f.justMigrated([...curve,...swap],now);
    good('bonding',bonding,bonding.length?'GeckoTerminal pump.fun curve pools · ≈ progress from curve price':'No tokens 60–99% bonded in the top curve pools');
    good('volume',volume,volume.length?'GeckoTerminal · pump.fun curve + PumpSwap pools · 24h volume':'No pump.fun pools in this snapshot');
    if(migrated.length||freshJ||!state.migrated.length)good('migrated',migrated,migrated.length?'Completed pump.fun curves + new PumpSwap pools · last 24h':'No pump.fun graduations seen in the last 24h');};
   const curveJ=await curveP;publish(curveJ,null,null);   // first paint the moment the main curve read lands
   const swapJ=await swapP;if(swapJ)publish(curveJ,swapJ,null);
   const freshJ=await freshP;if(freshJ)publish(curveJ,swapJ,freshJ);
  }catch{for(const k of ['bonding','volume','migrated'])failed(k);}})(),
  (async()=>{try{const j=await get(GT+'api/v2/networks/solana/trending_pools?include=base_token',2);
   const tokens=new Map((j.included||[]).map(t=>[t.id,t.attributes])); const rows=[]; const seen=new Set();
   for(const p of j.data||[]){const a=p.attributes||{},base=tokens.get(p.relationships?.base_token?.data?.id),mint=base?.address;const dex=p.relationships?.dex?.data?.id||'';
    if(!safeMint(mint)||!/(pump)/i.test(dex)||seen.has(mint))continue;seen.add(mint);rows.push({mint,symbol:safeText(base.symbol),name:safeText(base.name),price:finite(a.base_token_price_usd),cap:finite(a.market_cap_usd)??finite(a.fdv_usd),change:finite(a.price_change_percentage?.h24),volume:finite(a.volume_usd?.h24),imageUrl:safeImg(base.image_url)});}
   if(rows.length)good('trending',rows.slice(0,BOARD_ROWS),'GeckoTerminal · Pump venues, Solana trending');else failed('trending','no Pump venue rows');
  }catch{failed('trending');}})(),
  // DEX BOOSTED (BANKSY: renamed from Callout Feed): DexScreener token-boosts/latest
  (async()=>{try{const f=await import('./feeds.js');const rows=await f.fetchCallouts(get,clock());if(rows.length)good('callouts',rows,'Latest DexScreener boosts · pump.fun tokens');else failed('callouts','no pump.fun boosts');
  }catch{failed('callouts');}})()
 ]);save(true);details().catch(()=>{});}
 function tick(on,discover=false){active=!!on;discovery=!!discover; if(!active){for(const c of controllers)c.abort();return Promise.resolve();}const now=clock(),jobs=[];
  if(now>=nextP&&!busyP){nextP=now+PRICE_MS;busyP=prices().finally(()=>{busyP=null;});}if(busyP)jobs.push(busyP);
  if(discovery&&now>=nextD&&!busyD){nextD=now+DISCOVERY_MS;busyD=discoveries().finally(()=>{busyD=null;});}if(busyD)jobs.push(busyD);
  return Promise.all(jobs);}
 return {state,tick};
}
export const marketFeed=makeMarketFeed();
