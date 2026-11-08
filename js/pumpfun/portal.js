// PumpPortal documented FREE creation + migration streams only. Trade subscriptions are paid;
// never subscribe to those, request a wallet/key, or follow event metadata URLs.
export const PORTAL_URL = 'wss://pumpportal.fun/api/data';
export const PORTAL_MAX_AGE = 24 * 3600000;
const mintOK = v => typeof v === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
const text = v => typeof v === 'string' ? v.replace(/[\x00-\x1f\x7f<>]/g, ' ').slice(0, 48) : '';
export function portalEvent(d, now) {
 if (!d || !mintOK(d.mint) || !['create', 'migrate', 'migration'].includes(d.txType)) return null;
 return { mint:d.mint, symbol:text(d.symbol) || d.mint.slice(0,6), name:text(d.name), createdAt:now,
  observedAt:now, source:'pumpportal', event:d.txType==='migrate'?'migration':d.txType, cap:null,
  capSol:d.marketCapSol != null && Number.isFinite(+d.marketCapSol) && +d.marketCapSol >= 0 ? +d.marketCapSol : null };
}
export function makePortal({socket=url=>new WebSocket(url),clock=()=>Date.now(),publish=()=>{}}={}) {
 let ws=null, active=false, next=0, attempt=0, started=0, last=0, connected=false;
 const rows={newtokens:[],migrated:[]};
 const status=()=>!active?'PumpPortal paused · last observed events':connected?'PumpPortal live · observed this visit':'Feed offline · PumpPortal reconnecting';
 function emit(){const now=clock();for(const k of Object.keys(rows))rows[k]=rows[k].filter(r=>now-r.observedAt<PORTAL_MAX_AGE).slice(0,10);publish(rows,status());}
 function disconnect(){const old=ws;ws=null;connected=false;if(old){old.onopen=old.onmessage=old.onerror=old.onclose=null;old.close();}}
 function fail(){disconnect();next=clock()+Math.min(300000,5000*2**Math.min(attempt++,6));emit();}
 function tick(on){const now=clock();if(!on){if(active){active=false;disconnect();emit();}return;}
  active=true;
  if(ws){if(now-(connected?last:started)>(connected?120000:20000))fail();return;}
  if(now<next)return;
  started=now;
  try{const w=socket(PORTAL_URL);ws=w;
   w.onopen=()=>{if(ws!==w)return;connected=true;last=clock();for(const method of ['subscribeNewToken','subscribeMigration'])w.send(JSON.stringify({method}));emit();};
   w.onmessage=e=>{if(ws!==w||typeof e.data!=='string'||e.data.length>32768)return;last=clock();let d;try{d=JSON.parse(e.data);}catch{return;}
    if(d?.error||d?.errors){fail();return;}
    const r=portalEvent(d,clock());if(!r)return;attempt=0;
    const key=r.event==='create'?'newtokens':'migrated';const known=rows.newtokens.find(x=>x.mint===r.mint);
    if(known&&r.event==='migration'){r.symbol=known.symbol;r.name=known.name;}
    rows[key]=[r,...rows[key].filter(x=>x.mint!==r.mint)].slice(0,10);emit();};
   w.onerror=()=>{if(ws===w)fail();};w.onclose=()=>{if(ws===w)fail();};
  }catch{fail();}
 }
 return {tick};
}
