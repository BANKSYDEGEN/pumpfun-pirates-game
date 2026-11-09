// Both functions use the same fixed feed keys. Never accept a client-supplied URL.
export const MINTS = ["39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump", "By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump"];
export const FEED_NAMES = ["leaderboard", "live", "perps", "bounties", "homefeed", "holderrewards", "holderstats"];
export const maxAge = (feed: string) => feed === "holderrewards" ? 600_000 : 180_000;
export function snapshotKey(feed: string, mint?: string): string | null {
  if (!FEED_NAMES.includes(feed)) return null;
  if (feed === "holderstats") return MINTS.includes(mint || "") ? `${feed}:${mint}` : null;
  return mint ? null : feed;
}
export function databaseHeaders() {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("database configuration missing");
  return { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" };
}
export function databaseURL() {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("database configuration missing");
  return `${url}/rest/v1/pumpfeed_snapshots`;
}
// Revalidate and trim even though the PC also trims. Unknown fields are discarded.
type Shape = Record<string, string>;
const shapes: Record<string, Shape> = {
 homefeed: {mint:"mint",symbol:"s24",name:"s40",image:"image",mc:"n",caller:"s24",multiple:"n",pnlPct:"n",calledMc:"n",at:"n",views:"n"},
 leaderboard: {rank:"n",name:"s24",wallet:"mint",image:"image",pnlUsd:"n",pnlSol:"n",pnlPct:"n",positions:"n",verified:"b"},
 live: {mint:"mint",symbol:"s24",name:"s40",image:"image",mc:"n",viewers:"n",title:"s60"},
 perps: {symbol:"s16",name:"s30",image:"image",price:"n",vol:"n",oi:"n",changeBps:"n",lev:"n"},
 bounties: {id:"s40",title:"s70",rewardUsd:"n",mint:"mint",submissions:"n",expiresAt:"n"},
 holderstats: {holders:"n",top10Pct:"n",feesSol:"n"},
};
function object(v: unknown): Record<string, unknown> {
 if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("invalid rows");
 return v as Record<string, unknown>;
}
function fields(input: unknown, shape: Shape) {
 const src=object(input), out: Record<string,unknown>={};
 for (const [key,type] of Object.entries(shape)) {
  const v=src[key];
  if (v===null || v===undefined) {out[key]=null;continue;}
  if (type==="n") {if(typeof v!=="number" || !Number.isFinite(v))throw new Error("invalid number");out[key]=v;}
  else if(type==="b") {if(typeof v!=="boolean")throw new Error("invalid boolean");out[key]=v;}
  else {
   if(typeof v!=="string")throw new Error("invalid string");
   if(type==="mint") {if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v))throw new Error("invalid mint");out[key]=v;}
   else if(type==="image") {out[key]=/^https:\/\/[^\s"'<>]{4,300}$/.test(v)?v:null;}
   else out[key]=v.replace(/[\u0000-\u001f<>]/g, "").slice(0,Number(type.slice(1)));
  }
 }
 return out;
}
export function trimRows(feed:string, rows:unknown):unknown {
 if(feed==="holderrewards") {
  const r=object(rows), coins=object(r.coins), result:Record<string,unknown>={};
  const coinShape={paidUsd:"n",paid:"n",quote:"s12",payouts:"n",recipients:"n",lastPayoutAt:"n",accruedUsd:"n"};
  for(const sym of ["AHOY","SUNK"])result[sym]=coins[sym]==null?null:fields(coins[sym],coinShape);
  return {...fields(r,{generatedAt:"n"}),coins:result,totals:fields(r.totals,{walletsRewarded:"n",payouts:"n",accruedUsd:"n"})};
 }
 if(feed==="holderstats")return fields(rows,shapes[feed]);
 if(!Array.isArray(rows))throw new Error("invalid rows");
 return rows.slice(0,10).map(r=>fields(r,shapes[feed]));
}
