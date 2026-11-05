# V6 in-game checks (real game code, headless Chrome, Supabase blocked): gear viewer cells per body/LOD, emote viewer, island on foot
import asyncio, sys, json, os, urllib.parse; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
OUT='/workspace/brand/v6_characters/shots'; B='http://127.0.0.1:18970/raul-v6/'
CELLS=[['DEFAULT',{}],['SKIN 3 HAIR 2 EYE 2',{'skinColor':3,'hairColor':2,'eyeColor':2}],['SKIN 5 HAIR 4 EYE 4',{'skinColor':5,'hairColor':4,'eyeColor':4}],['SKIN 1 HAIR 6 EYE 1',{'skinColor':1,'hairColor':6,'eyeColor':1}],
 ['TRICORN',{'hat':'tricorn'}],['BICORNE',{'hat':'bicorne'}],['BANDANA',{'hat':'bandana'}],['CROWN',{'hat':'crown_imperial'}],['LUCHADOR',{'hat':'mask_luchador'}],
 ['COAT',{'outfit':'coat'}],['TANK',{'outfit':'tank'}],['SUIT',{'outfit':'suit'}],['HOOK',{'hook':'hook_iron'}],['PEG',{'leg':'peg'}],['PARROT',{'parrot':'parrot_green'}],['MONKEY',{'parrot':'pet_monkey'}],
 ['CAPE',{'cape':'cape_royal'}],['BOOTS',{'boots':'boots_buckle'}],['EYEPATCH',{'eyes':'eyepatch'}],['BEARD',{'beard':'beard_forked'}]]
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); errs={}
    async def page(key, url, ready, vw=(1800,1000), shot=None, js=None, wait=1500):
      ctx = await b.new_context(viewport={'width':vw[0],'height':vw[1]}); await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
      pg = await ctx.new_page(); E = errs[key] = []
      pg.on('pageerror', lambda e: E.append('PAGE ' + str(e))); pg.on('console', lambda m: E.append(m.text[:200]) if m.type == 'error' else None)
      await pg.goto(url); await pg.wait_for_function(ready, timeout=300000)
      if js: errs[key+'_info'] = await pg.evaluate(js)
      await pg.wait_for_timeout(wait); await pg.screenshot(path=f'{OUT}/{shot or key}.png', timeout=180000); print('shot', key, flush=True); await ctx.close()
    only=os.environ.get('ONLY','gear,emote,island').split(',')
    if 'gear' in only:
      for sex in ('m','f'):
        for lod in ('hi','lo'):
          c=[x for x in CELLS if not (sex=='f' and x[0]=='BEARD')]
          u=B+'tools/gear_viewer.html?'+urllib.parse.urlencode({'sex':sex,'lod':lod,'clip':'idle','view':'q','cols':10,'cells':json.dumps(c)})
          await page(f'gear_{sex}_{lod}', u, 'window.GEARV && GEARV.ready()', js='GEARV.tris()', wait=2500)
          u2=u.replace('clip=idle','clip=walk'); await page(f'gear_{sex}_{lod}_walk', u2, 'window.GEARV && GEARV.ready()', wait=2500)
    if 'emote' in only:
      for sex in ('m','f'):
        for lod in ('hi',):
          await page(f'emote_{sex}_{lod}', B+f'tools/emote_viewer.html?sex={sex}&lod={lod}&view=q', 'window.EMOV && EMOV.ready()', vw=(1500,1080), js='EMOV.go()', wait=500)
    if 'island' in only:
      await page('island_onfoot', B+'island.html?coast=1&shot&quality=high', 'window.ISLAND && ISLAND.foot', vw=(1600,900), wait=8000)
    json.dump(errs, open(f'{OUT}/shots_errors.json','w'), indent=0); print(json.dumps({k:(v[:6] if isinstance(v,list) else v) for k,v in errs.items()})[:3000]); await b.close()
asyncio.run(main())
