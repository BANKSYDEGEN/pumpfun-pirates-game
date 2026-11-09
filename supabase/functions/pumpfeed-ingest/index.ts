// Private PC relay upload endpoint. No request bodies, credentials or upstream content are logged.
import { snapshotKey, maxAge, trimRows, databaseHeaders, databaseURL } from "../_shared/snapshots.ts";
const LIMIT=128*1024;
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
async function authorized(value:string, secret:string) {
 // Hash both values to fixed length, then compare all bytes without early exit.
 const enc=new TextEncoder();
 const [a,b]=await Promise.all([value,secret].map(x=>crypto.subtle.digest("SHA-256",enc.encode(x))));
 const aa=new Uint8Array(a),bb=new Uint8Array(b);let diff=0;
 for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];
 return diff===0;
}
async function boundedBody(req:Request) {
 if(Number(req.headers.get("content-length"))>LIMIT)throw new Error("size");
 if(!req.body)throw new Error("json");
 const reader=req.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>LIMIT){await reader.cancel();throw new Error("size");}chunks.push(value);}
 const buf=new Uint8Array(size);let pos=0;for(const c of chunks){buf.set(c,pos);pos+=c.length;}
 return JSON.parse(new TextDecoder().decode(buf));
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return reply(405,{ok:false,error:"method"});
 const secret=Deno.env.get("PUMPFEED_INGEST_SECRET");
 if(!secret)return reply(503,{ok:false,error:"not configured"});
 const auth=req.headers.get("authorization")||"";
 if(auth.length>512 || !await authorized(auth,`Bearer ${secret}`))return reply(401,{ok:false,error:"unauthorized"});
 if(!(req.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))return reply(415,{ok:false,error:"content type"});
 let body;try{body=await boundedBody(req);}catch(e){return reply((e as Error).message==="size"?413:400,{ok:false,error:"invalid body"});}
 try{
  if(!body || !Array.isArray(body.feeds) || body.feeds.length<1 || body.feeds.length>8)throw Error("batch");
  const records=[],seen=new Set<string>(),now=Date.now();let skipped=0;
  for(const f of body.feeds){
   if(!f || typeof f.feed!=="string" || typeof f.ok!=="boolean")throw Error("feed");
   const key=snapshotKey(f.feed,f.mint);if(!key || seen.has(key))throw Error("feed");seen.add(key);
   if(typeof f.fetchedAt!=="number" || !Number.isFinite(f.fetchedAt) || f.fetchedAt>now+30000 || now-f.fetchedAt>maxAge(f.feed))throw Error("timestamp");
   // Failed public reads never reset freshness or fabricate data. Last good snapshot expires normally.
   if(!f.ok){skipped++;continue;}
   const rows=trimRows(f.feed,f.rows);
   // Explicit test snapshots are never served to players. Used only for the initial round-trip test.
   records.push({feed:key,payload:{rows,...(f.testOnly===true?{testOnly:true}:{})},fetched_at:new Date(f.fetchedAt).toISOString()});
  }
  if(records.length){
   const r=await fetch(databaseURL()+"?on_conflict=feed",{method:"POST",headers:{...databaseHeaders(),Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(records),signal:AbortSignal.timeout(10000)});
   if(!r.ok)return reply(503,{ok:false,error:"storage unavailable"});
  }
  return reply(200,{ok:true,accepted:records.length,skipped});
 }catch(e){return reply((e as Error).name==="TimeoutError"?503:400,{ok:false,error:"invalid batch or storage unavailable"});}
});
