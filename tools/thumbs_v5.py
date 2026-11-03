# Re-bake the pre-baked shop card PNGs (assets/pirates/thumbs/<slot>_<id>.png, shown at once while the live render runs) on the v5
# pirate (the same gearThumbs.js renderer the shop uses), and check every still: drawn, and nothing cut at the top (hats / crowns),
# on desktop (hi) and phone (lo), player items + Crew Shop items (crew member in the uniform). python3 tools/thumbs_v5.py <port> [--bake]
import asyncio, base64, sys, json
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
B='http://127.0.0.1:'+sys.argv[1]; BAKE='--bake' in sys.argv; DST='/workspace/timothy-crewpets/assets/pirates/thumbs'
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
JS="""async(crewOnly)=>{ const T=await import('/js/gearThumbs.js'), C=await import('/js/shopCatalog.js'), L=await import('/js/crewLoadout.js');
  const img=(u)=>new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=u; });
  const chk=async(u)=>{ const i=await img(u); if(!i) return { ok:false }; const c=document.createElement('canvas'); c.width=i.width; c.height=i.height; const g=c.getContext('2d'); g.drawImage(i,0,0);
    const d=g.getImageData(0,0,c.width,c.height).data; let n=0, top=0; for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++){ const a=d[(y*c.width+x)*4+3]; if(a>20){ n++; if(y<2) top++; } } return { ok:true, px:n, top }; };
  const out={}, res=[];
  for (const it of C.GEAR_ITEMS) { const u=await T.gearThumb(it.slot,it.id,{}); out[it.slot+'_'+it.id]=u; res.push({ k:it.slot+':'+it.id, ...(await chk(u)) }); }
  for (const it of C.CREW_ITEMS) { const o={ ...L.CREW_LOOK, wear: it.slot==='crewhat' ? { outfit:'tank' } : { hat:'bandana' } }; const u=await T.gearThumb(it.base,it.id,o); out['crew_'+it.slot+'_'+it.id]=u; res.push({ k:it.slot+':'+it.id, ...(await chk(u)) }); }
  return { out, res }; }"""
async def run(b,name,phone):
    kw=dict(viewport={'width':1280,'height':800} if not phone else {'width':390,'height':844},service_workers='block')
    if phone: kw.update(is_mobile=True,has_touch=True,user_agent=UA)
    ctx=await b.new_context(**kw); await ctx.route('**/*supabase.co/**',lambda r:r.abort()); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    await pg.goto(B+'/index.html?quality='+('low' if phone else 'high'),wait_until='domcontentloaded',timeout=180000)
    await pg.wait_for_function('window.PFP && PFP.renderer',timeout=300000)
    r=await pg.evaluate(JS, False); await ctx.close(); return r, errs
async def main():
    R=[]; ok=lambda n,c,i='': (R.append((n,bool(c),i)), print(('PASS ' if c else 'FAIL ')+n, str(i)[:300], flush=True))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=ARGS)
        for name,phone in [('desktop',False),('phone',True)]:
            r,errs=await run(b,name,phone)
            bad=[x for x in r['res'] if not x.get('ok') or x['px']<800]; cut=[x for x in r['res'] if x.get('top',0)>3 and (x['k'].startswith('hat:') or x['k'].startswith('crewhat:'))]
            ok(f'{name} every thumbnail drawn ({len(r["res"])} player + crew items)', not bad, bad); ok(f'{name} no hat / crown cut at the top', not cut, cut); ok(f'{name} no page errors', not errs, errs[:3])
            if BAKE and not phone:
                for k,u in r['out'].items():
                    if u and not k.startswith('crew_'): open(f'{DST}/{k}.png','wb').write(base64.b64decode(u.split(',',1)[1]))
                    if u and k.startswith('crew_'): open(f'{DST}/{k[5:]}.png','wb').write(base64.b64decode(u.split(',',1)[1]))
        await b.close()
    print(f"{sum(1 for r in R if r[1])}/{len(R)} passed")
    open('/workspace/timothy-crewpets/screens/results_thumbs.txt','w').write('\n'.join(('PASS ' if c else 'FAIL ')+n+'  '+str(i)[:300] for n,c,i in R)+f"\n{sum(1 for r in R if r[1])}/{len(R)} passed\n")
asyncio.run(main())
