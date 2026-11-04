import asyncio, sys, json, os
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
import os
B=os.environ.get('PFP_B','http://127.0.0.1:8991')
SC='/workspace/pfp-treasure-shots'
async def boot(p, w=1280, h=720, q='high', mobile=False, extra='', ctx=None, browser=None):
  b = browser or await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=ARGS)
  if ctx is None:
    kw=dict(viewport={'width':w,'height':h})
    if mobile: kw.update(device_scale_factor=2, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    ctx=await b.new_context(**kw)
    await ctx.route('**/*supabase.co/**',lambda r:r.abort())
    await ctx.add_init_script("try{localStorage.setItem('pfp_gfx_hint','1');localStorage.setItem('pfp_tut_seen','1')}catch(e){}")
  pg=await ctx.new_page()
  pg.on('pageerror',lambda e: print('PAGEERR',e))
  pg.on('console',lambda m: print('CONSOLE',m.type,m.text[:300]) if (m.type in ('error','warning') and 'Failed to load resource' not in m.text) or '[dock' in m.text else None)
  await pg.goto(B+f'/index.html?coast=1&quality={q}'+extra)
  await pg.wait_for_function('window.PFP && PFP.renderer',timeout=900000); await pg.wait_for_timeout(800)
  await pg.evaluate("document.getElementById('btn-pvp').click()")
  await pg.wait_for_function("PFP.pvp && PFP.pvp.where==='harbor'",timeout=600000)
  await pg.wait_for_function("PFP.dock && PFP.dock.on",timeout=900000)
  await pg.wait_for_timeout(1000)
  return b, ctx, pg
async def ev(pg, js): 
  r = await pg.evaluate(js); print('>>', json.dumps(r)[:3000]); return r
async def shot(pg, name): os.makedirs(SC, exist_ok=True); await pg.screenshot(path=f'{SC}/{name}.png'); print('shot', name)
async def gwait(pg, secs, timeout=240000):
  t0 = await pg.evaluate("PFP.game.t"); await pg.wait_for_function(f"PFP.game.t >= {t0+secs}", timeout=timeout, polling=200)
async def until(pg, cond, timeout=240000): await pg.wait_for_function(cond, timeout=timeout, polling=200)
async def fps(pg, ms=4000):
  return await pg.evaluate(f"new Promise(r=>{{let n=0;const t0=performance.now();const f=()=>{{n++; if(performance.now()-t0<{ms}) requestAnimationFrame(f); else r(n*1000/(performance.now()-t0))}};requestAnimationFrame(f)}})")
async def perf(pg, tag, ms=6000):
  r = await pg.evaluate("""(async()=>{const R=PFP.renderer, I=R.info; I.autoReset=false; const raf=()=>new Promise(r=>requestAnimationFrame(r));
    await raf(); I.reset(); await raf(); const c=I.render.calls, t=I.render.triangles; I.autoReset=true; return {calls:c, tris:t, geos:I.memory.geometries, tex:I.memory.textures}})()""")
  r['fps_swiftshader'] = round(await fps(pg, ms), 2); r['tag']=tag; print('PERF', json.dumps(r)); return r
async def walk_to(pg, x, z, yaw):
  await pg.evaluate(f"(()=>{{const W=PFP.dock.walker; W.w.x={x}; W.w.z={z}; W.w.yaw={yaw}; W.w.camYaw={yaw}; W.w.y=PFP.dock.world.ground({x},{z}); W.snapCam();}})()")
