import asyncio, json, sys
from playwright.async_api import async_playwright
B='http://127.0.0.1:8962'; OUT='/workspace/raul-island/screens/coast_v1'
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def shot(b,name,q,w,h,extra,dump=False):
  ctx=await b.new_context(viewport={'width':w,'height':h}); await ctx.route('**/*supabase.co/**',lambda r:r.abort())
  errs=[]; pg=await ctx.new_page(); pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e))); pg.on('console',lambda m: m.type in('error',) and errs.append(m.text))
  await pg.goto(f'{B}/island.html?quality={q}&shot=1&coast=1'+extra)
  try: await pg.wait_for_function('window.ISLAND_STATS && ISLAND_STATS.calls>0',timeout=120000)
  except Exception: print('FAIL',errs); await ctx.close(); return
  await pg.wait_for_timeout(2500); print('pre', json.dumps(await pg.evaluate('ISLAND_STATS')), errs[:5], flush=True); await pg.screenshot(path=f'{OUT}/{name}.png', timeout=240000)
  print(name, json.dumps(await pg.evaluate('ISLAND_STATS')), errs[:5])
  if dump: print('DUMP', json.dumps(await pg.evaluate('({shop:ISLAND_FOOT.shop, coast:ISLAND_FOOT.coast, stats:ISLAND_FOOT.stats})')))
  await ctx.close()
async def main():
  only=sys.argv[1:]
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=ARGS)
    jobs=[('coast_34','high',1600,900,'&view=coast34',True),('overview_coast','high',2400,1400,'&view=coastTop&map=1',False),('coast_top3d','high',1600,900,'&view=coastTop',False),('phone_low_coast_34','low',844,390,'&view=coast34',False)]
    for n,q,w,h,e,d in jobs:
      if only and n not in only: continue
      await shot(b,n,q,w,h,e,d)
    await b.close()
asyncio.run(main())
