# [Emerly V7 female] quick gear check on her in the real game (idle front / side / back per kit).
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
PORT=os.environ.get('PORT','18995');BASE=f'http://127.0.0.1:{PORT}/';OUT=Path(os.environ.get('OUT','/workspace/v7-female-emerly/shots/gearcheck'));OUT.mkdir(parents=True,exist_ok=True)
KITS=json.loads(os.environ['KITS']) if os.environ.get('KITS') else {'coat':{'body':1,'outfit':'coat','hat':'tricorn','pants':'classic_pants','boots':'boots_classic'},
'shirt':{'body':1,'outfit':'shirt','hat':'bandana','pants':'canvas_pants','boots':'sandals','eyes':'eyepatch','parrot':'parrot_green'},
'suit':{'body':1,'outfit':'suit','hat':'bicorne','pants':'leather_breeches','boots':'boots_cavalier','cape':'cape_captain','hook':'hook_iron','leg':'peg'},
'tank':{'body':1,'outfit':'tank','hat':'crown','pants':'sailor_trousers','boots':'boots_buckle','ears':'earring_hoop','eyes':'sunglasses'}}
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await b.new_context(viewport={'width':900,'height':900},service_workers='block')
  await ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) else r.fulfill(status=503,body='{}'));page=await ctx.new_page();await page.route_web_socket('**',lambda ws:ws.close());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(BASE+'island.html?coast=1&shot&quality=high&opt=0',timeout=180000);await page.wait_for_function('window.ISLAND?.foot',timeout=300000)
  await page.evaluate(Path('tools/v7/female_proof_scene.js').read_text(),'pc')
  for k,g in KITS.items():
   items=await page.evaluate("async g=>{const GG=await import('/js/pirateGear.js');await GG.applyGear(V7F.pr.object,g);await new Promise(r=>setTimeout(r,2500));return Object.keys(V7F.p.items||{})}",g)
   print(k,items,flush=True)
   for name,a in [('front',0),('side',90),('back',180)][:int(os.environ.get('NV','3'))]:
    for mode in os.environ.get('MODES','idle,walk').split(','):
     await page.evaluate("([m,a])=>{V7F.mode=m;V7F.view(a,3.2,.70,30)}",[mode,a]);await page.wait_for_timeout(1200);await page.screenshot(path=str(OUT/f'{k}_{mode}_{name}.png'),timeout=180000)
  print('errors',errors[:5],flush=True);await b.close()
asyncio.run(main())
