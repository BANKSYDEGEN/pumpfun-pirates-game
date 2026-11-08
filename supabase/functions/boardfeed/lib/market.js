const finite=(v)=>v!==null && v!=='' && Number.isFinite(+v) ? +v : null;
export const safeMint=v=>typeof v==='string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
export const safeImg=v=>typeof v==='string'&&v.length<=400&&/^https:\/\/[a-z0-9.-]+\/[^\s"'<>]*$/i.test(v)?v:null; // board logos only; logos.js re-checks the host
export const safeText=v=>String(v??'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,48);
export function selectPair(pairs,ca) {return (Array.isArray(pairs)?pairs:[]).filter(p=>p.chainId==='solana'&&p.baseToken?.address===ca&&finite(p.priceUsd)>0).sort((a,b)=>(finite(b.liquidity?.usd)||0)-(finite(a.liquidity?.usd)||0))[0]||null;}
export function pairRow(p) {return {mint:p.baseToken.address,symbol:safeText(p.baseToken.symbol),name:safeText(p.baseToken.name),price:finite(p.priceUsd),cap:finite(p.marketCap),fdv:finite(p.fdv),change:finite(p.priceChange?.h24),volume:finite(p.volume?.h24),liquidity:finite(p.liquidity?.usd),imageUrl:safeImg(p.info?.imageUrl)};}
