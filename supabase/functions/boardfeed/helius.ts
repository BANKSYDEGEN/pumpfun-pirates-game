// Server only. No key, URL containing a key, wallet list or raw transaction is returned to a client.
export const heliusConfigured = () => !!Deno.env.get('HELIUS_API_KEY');
let nextRPC=0;
export async function heliusRPC(method: string, params: unknown) {
 const key = Deno.env.get('HELIUS_API_KEY'); if (!key) return null;
 const wait=nextRPC-Date.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));nextRPC=Date.now()+550;
 const r = await fetch('https://mainnet.helius-rpc.com/?api-key=' + encodeURIComponent(key), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'boardfeed',method,params}),signal:AbortSignal.timeout(8000)});
 if (!r.ok) throw Error('chain source unavailable');const j=await r.json();if(j.error)throw Error('chain source unavailable');return j.result;
}
export async function countHolders(mint: string) {
 if (!heliusConfigured()) return null;
 const owners = new Set<string>(); let cursor: string | undefined;
 // Count unique nonzero owners, NOT result.total (which is token accounts). Never publish partial counts.
 for(let page=0;page<5;page++) {
  const r=await heliusRPC('getTokenAccounts',{mint,limit:1000,...(cursor?{cursor}:{}),options:{showZeroBalance:false}});
  if(!Array.isArray(r?.token_accounts))return null;
  for(const a of r.token_accounts)if(a.owner && /^\d+$/.test(String(a.amount)) && BigInt(a.amount)>0n)owners.add(a.owner);
  if(r.token_accounts.length<1000)return {holders:owners.size,slot:r.last_indexed_slot??null};
  if(!r.cursor || r.cursor===cursor)return null;cursor=r.cursor;
 }
 return null;
}
// Bounded enhanced-transactions poll scaffold: only verified project/reward accounts may be added by maintainers.
// Do not automatically poll the high-volume pump.fun program on a free plan.
export async function pollEnhanced(address: string, before?: string) {
 const key=Deno.env.get('HELIUS_API_KEY');if(!key)return [];
 const allowed=(Deno.env.get('HELIUS_POLL_ADDRESSES')||'').split(',').filter(Boolean);
 if(!allowed.includes(address))throw Error('address not configured');
 const u=new URL('https://api-mainnet.helius-rpc.com/v0/addresses/'+address+'/transactions');u.searchParams.set('api-key',key);u.searchParams.set('limit','20');if(before)u.searchParams.set('before',before);
 const r=await fetch(u,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('chain source unavailable');return await r.json();
}
