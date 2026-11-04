# [Timothy] PUMPFUN PIRATES material library perf + live shots (adapted from /workspace/mobileperf_measure.py): harbor spawn (docked) + ashore at the
# plaza, the hill street and the GATE JUNCTION (BANKSY 9:55 PM shot, game camera). renderer.info, texture MB, rAF fps (swiftshader: relative only).
#   BASE=http://127.0.0.1:18960/WORKTREE/ python3 perf_shots.py TAG desktop|phone OUTDIR
import asyncio, json, os, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--renderer-process-limit=1','--enable-precise-memory-info']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
BASE=os.environ['BASE']; TAG=sys.argv[1]; DEV=sys.argv[2]; OUT=sys.argv[3]; os.makedirs(OUT, exist_ok=True)
INIT="localStorage.setItem('pfp_name','PERF_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_tutorial_off','1');localStorage.setItem('pfp_gfx_hint','1')"
PROBE="""async ()=>{ const R=PFP.renderer, I=R.info; const tex=new Map(); let geoB=0; const geos=new Set();
  PFP.scene.traverse(o=>{ if(o.geometry&&!geos.has(o.geometry)){ geos.add(o.geometry); for(const a of Object.values(o.geometry.attributes)) geoB+=a.array?.byteLength||0; if(o.geometry.index) geoB+=o.geometry.index.array.byteLength; }
    for(const m of [o.material].flat()) if(m) for(const v of Object.values(m)) if(v&&v.isTexture) tex.set(v.uuid,v); if(o.material?.uniforms) for(const u of Object.values(o.material.uniforms)) if(u?.value?.isTexture) tex.set(u.value.uuid,u.value); });
  let tb=0; const big=[]; for(const t of tex.values()){ const im=t.image, w=im?.width||im?.videoWidth||0, h=im?.height||0; const b=w*h*4*(t.generateMipmaps!==false?1.33:1); tb+=b; big.push([w+'x'+h, t.name||'', (b/1e6).toFixed(1)]); }
  big.sort((a,b)=>b[2]-a[2]);
  const t0=performance.now(); let n=0; await new Promise(r=>{ const f=()=>{ n++; if(performance.now()-t0<4000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  const res=performance.getEntriesByType('resource').filter(e=>/\\.(glb|webp|jpg|png|ktx2)(\\?|$)/.test(e.name)).map(e=>[e.name.replace(location.origin,'').replace(/^.*?\\/assets\\//,'assets/'), Math.round((e.encodedBodySize||e.transferSize)/1024)]);
  return { pr:R.getPixelRatio(), canvas:[R.domElement.width,R.domElement.height], calls:I.render.calls, tris:I.render.triangles, geometries:I.memory.geometries, textures:I.memory.textures, programs:I.programs?.length,
    sceneTex:tex.size, texMB:+(tb/1e6).toFixed(1), geoMB:+(geoB/1e6).toFixed(1), heapMB: performance.memory? +(performance.memory.usedJSHeapSize/1e6).toFixed(0):null, fps:+(n/4).toFixed(1),
    bigTex:big.slice(0,12), assets:res.length, assetKB:res.reduce((a,b)=>a+b[1],0), glbs:res.filter(r=>/glb/.test(r[0])).map(r=>r[0].replace('assets/','')+' '+r[1]+'k') }; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx=await b.new_context(**(dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if DEV=='phone' else dict(viewport={'width':1600,'height':900})), service_workers='block')
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.add_init_script(INIT); pg=await ctx.new_page(); pg.set_default_timeout(400000); errs=[]; logs=[]
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: logs.append(m.text[:160]) if ('[mobile]' in m.text or 'context' in m.text.lower()) else None)
    await pg.goto(BASE+'index.html', wait_until='domcontentloaded'); await pg.wait_for_function("document.getElementById('loading').classList.contains('hidden')", timeout=400000)
    await pg.evaluate("document.getElementById('btn-pvp').click()"); await pg.wait_for_function("PFP.dock && PFP.dock.on && PFP.player", timeout=600000)
    await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(12000)
    r=await pg.evaluate(PROBE); r.pop('bigTex',None); print(TAG,DEV,'HARBOR',json.dumps(r),flush=True); await pg.screenshot(path=f'{OUT}/{TAG}_{DEV}_live_harbor.png')
    await pg.evaluate("(()=>{const d=PFP.dock; if (d.docking.mode!=='docked') for (const b of d.layout.berths) { d.dockAt(b.id); if (d.docking.mode !== 'sea') break; } })()")
    await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=600000); await pg.evaluate("(()=>{ try{PFP.dock.goAshore()}catch(e){} })()"); await pg.wait_for_timeout(3000); await pg.evaluate("(()=>{ if(!PFP.dock.onFoot){ const b=[...document.querySelectorAll('button')].find(b=>/GO ASHORE/i.test(b.innerText)&&b.offsetParent); b&&b.click(); } })()"); await pg.wait_for_function('PFP.dock.onFoot', timeout=120000)
    await pg.wait_for_timeout(4000)
    VIEWS=[('plaza',20.0,-20.0,None,-1.5708),('hill',1.0,-135.2,None,-1.5708),('junction',-431.0,-95.0,'w',2.82)]   # junction: world point, camYaw looking at the gate
    for name,a1,b1,fr,cy in VIEWS:
      await pg.evaluate("(async([a1,b1,fr,cy])=>{ const CO=await import('./js/island/coast.js'); const D=PFP.dock, W=D.walker; const [x,z]=D.layout.footToHarbor(...(fr==='w'?[a1,b1]:CO.t2w(a1,b1))); W.enter(x,z,0); W.w.camYaw=fr==='w'?cy:CO.t2wYaw(cy+Math.PI/2); })", [a1,b1,fr,cy])
      await pg.wait_for_timeout(9000); r2=await pg.evaluate(PROBE); r2.pop('bigTex',None); print(TAG,DEV,'ASHORE',name,json.dumps(r2),flush=True); await pg.screenshot(path=f'{OUT}/{TAG}_{DEV}_live_{name}.png')
    print(TAG,'logs',logs[:8],'errors',errs[:4],flush=True); await b.close()
asyncio.run(main())
