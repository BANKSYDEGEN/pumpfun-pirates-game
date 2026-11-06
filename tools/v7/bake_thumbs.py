import asyncio,json,base64
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path('/workspace/emerly-v7-male');OUT=ROOT/'assets/pirates/thumbs'
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=await b.new_page(viewport={'width':800,'height':600});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));await page.goto('http://127.0.0.1:8787/tools/v7/qa.html');await page.wait_for_function('window.V7QA')
  for f in sorted(OUT.glob('*.png')):
   n=f.stem
   if n.endswith('_f') or n.startswith(('weapon_','figure_','flag_')):continue
   slot,id=n.split('_',1);opts={'w':400,'h':204}
   if slot.startswith('crew'):
    slot=slot[4:];slot={'what':'hat'}.get(slot,slot);opts['wear']={'outfit':'tank'} if slot=='hat' else {'hat':'bandana'}
   url=await page.evaluate("async ([slot,id,opts])=>(await import('/js/gearThumbs.js')).gearThumb(slot,id,opts)",[slot,id,opts])
   if not url:raise RuntimeError(n)
   f.write_bytes(base64.b64decode(url.split(',')[1]));print('BAKED',n,flush=True)
  await page.goto('http://127.0.0.1:8787/tools/v7/weapon_thumbs.html');await page.wait_for_function('window.done',timeout=180000)
  shots=await page.evaluate('window.shots')
  for key,url in shots.items():(OUT/('weapon_'+key+'.png')).write_bytes(base64.b64decode(url.split(',')[1]))
  print('WEAPONS',len(shots),'ERRORS',errors,flush=True);await b.close()
asyncio.run(main())
