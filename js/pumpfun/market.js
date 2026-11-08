// One shared, proximity-driven FREE poller per game client. No socket, API key, timer, proxy or server deployment.
export const PRICE_MS = 60000, DISCOVERY_MS = 120000;
export const WATCH_TOKENS = [
 {sym:'SUNK',ca:'By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump'},
 {sym:'AHOY',ca:'39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump'},
 {sym:'PUMP',ca:'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn'}];
const DEX='https://api.dexscreener.com';
const finite=(v)=>v!==null && v!=='' && Number.isFinite(+v) ? +v : null;
export const safeMint=v=>typeof v==='string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
export const safeText=v=>String(v??'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,48);
export function selectPair(pairs,ca) {return (Array.isArray(pairs)?pairs:[]).filter(p=>p.chainId==='solana'&&p.baseToken?.address===ca&&finite(p.priceUsd)>0).sort((a,b)=>(finite(b.liquidity?.usd)||0)-(finite(a.liquidity?.usd)||0))[0]||null;}
export function pairRow(p) {return {mint:p.baseToken.address,symbol:safeText(p.baseToken.symbol),name:safeText(p.baseToken.name),price:finite(p.priceUsd),cap:finite(p.marketCap),fdv:finite(p.fdv),change:finite(p.priceChange?.h24),volume:finite(p.volume?.h24)};}
export function makeMarketFeed({fetcher=(...a)=>fetch(...a),clock=()=>Date.now()}={}) {
 const state={prices:{},trending:[],callouts:[],bonding:[],dexpaid:[],status:{prices:'Loading…',trending:'Loading…',callouts:'Loading…',dexpaid:'Loading…',bonding:'Free launch feed unavailable · no verified near-bond list'},revision:0};
 let nextP=0,nextD=0,busyP=null,busyD=null,active=false,discovery=false;const controllers=new Set();
 async function get(url){const c=new AbortController();controllers.add(c);const tm=setTimeout(()=>c.abort(),10000);try{const r=await fetcher(url,{signal:c.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(tm);controllers.delete(c);}}
 async function prices(){let failed=false;await Promise.all(WATCH_TOKENS.map(async t=>{try{
  // Separate token reads avoid the aggregate endpoint's 30-pair truncation (PUMP otherwise hides SUNK pools).
  const j=await get(DEX+'/latest/dex/tokens/'+t.ca),p=selectPair(j.pairs,t.ca);
  if(!p)throw Error('no priced pair');state.prices[t.sym]={...pairRow(p),pair:p,updated:clock(),stale:false};
 }catch{failed=true;if(state.prices[t.sym])state.prices[t.sym].stale=true;}}));
 state.status.prices=failed?'Feed offline for some prices · cached values marked stale':'DexScreener · 60s snapshots';state.revision++;}
 async function discoveries(){await Promise.all([
  // DEX JUST PAID (BANKSY 2026-11-07): verified paid DexScreener profiles, own 120s cache; lazy module, errors never escape.
  (async()=>{try{const d=await import('./dexpaid.js');state.dexpaid=await d.fetchDexJustPaid();state.status.dexpaid=d.dexPaidFeed.state.status;}catch{state.status.dexpaid='Feed offline'+(state.dexpaid.length?' · cached paid profiles':'');}})(),
  (async()=>{try{const j=await get('https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?include=base_token');
   const tokens=new Map((j.included||[]).map(t=>[t.id,t.attributes])); const rows=[]; const seen=new Set();
   for(const p of j.data||[]){const a=p.attributes||{},base=tokens.get(p.relationships?.base_token?.data?.id),mint=base?.address;const dex=p.relationships?.dex?.data?.id||'';
    if(!safeMint(mint)||!/(pump)/i.test(dex)||seen.has(mint))continue;seen.add(mint);rows.push({mint,symbol:safeText(base.symbol),name:safeText(base.name),price:finite(a.base_token_price_usd),change:finite(a.price_change_percentage?.h24),volume:finite(a.volume_usd?.h24)});}
   state.trending=rows.slice(0,5);state.status.trending=rows.length?'GeckoTerminal · Pump venues · 120s snapshots':'Feed offline · no Pump venue rows';
  }catch{state.status.trending='Feed offline · trending'+(state.trending.length?' · cached snapshot':'');}})(),
  (async()=>{try{const j=await get(DEX+'/token-boosts/latest/v1');const seen=new Set();state.callouts=(Array.isArray(j)?j:[]).filter(t=>t.chainId==='solana'&&safeMint(t.tokenAddress)&&!seen.has(t.tokenAddress)&&(seen.add(t.tokenAddress),true)).slice(0,5).map(t=>({mint:t.tokenAddress,symbol:t.tokenAddress.slice(0,4)+'…'+t.tokenAddress.slice(-4),amount:finite(t.totalAmount)||0}));state.status.callouts=state.callouts.length?'DexScreener · PAID PROMOTION · 120s snapshots':'Feed offline · no Solana boost rows · PAID PROMOTION';
  }catch{state.status.callouts='Feed offline · callouts'+(state.callouts.length?' · cached snapshot':'');}})()
 ]);state.revision++;}
 function tick(on,discover=false){active=!!on;discovery=!!discover; if(!active){for(const c of controllers)c.abort();return Promise.resolve();}const now=clock(),jobs=[];
  if(now>=nextP&&!busyP){nextP=now+PRICE_MS;busyP=prices().finally(()=>{busyP=null;});}if(busyP)jobs.push(busyP);
  if(discovery&&now>=nextD&&!busyD){nextD=now+DISCOVERY_MS;busyD=discoveries().finally(()=>{busyD=null;});}if(busyD)jobs.push(busyD);
  return Promise.all(jobs);}
 return {state,tick};
}
export const marketFeed=makeMarketFeed();
