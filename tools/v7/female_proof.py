# [Emerly V7 female] stage-1 proof shots through the real game (island.html) in headless Chrome. Serve the worktree on $PORT.
import asyncio,json,os,sys
from pathlib import Path
from playwright.async_api import async_playwright
PORT=os.environ.get('PORT','18995');BASE=f'http://127.0.0.1:{PORT}/';OUT=Path(os.environ.get('OUT','/workspace/v7-female-emerly/shots/raw'));OUT.mkdir(parents=True,exist_ok=True)
DEV=os.environ.get('DEVICES','pc').split(',')
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for device in DEV:
   w,h=(1200,1200) if device=='pc' else (390,844)
   ctx=await b.new_context(viewport={'width':w,'height':h},is_mobile=device=='phone',has_touch=device=='phone',service_workers='block')
   await ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) else r.fulfill(status=503,body='{}'));page=await ctx.new_page();await page.route_web_socket('**',lambda ws:ws.close());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto(BASE+'island.html?coast=1&shot&quality='+('high' if device=='pc' else 'low')+'&opt=0',timeout=180000);await page.wait_for_function('window.ISLAND?.foot',timeout=300000)
   info=await page.evaluate(Path('tools/v7/female_proof_scene.js').read_text(),device);print(device,json.dumps(info),flush=True)
   await page.evaluate("()=>{document.querySelectorAll('body > *:not(canvas)').forEach(e=>{if(!e.querySelector('canvas'))e.style.visibility='hidden'})}")
   shots=[('front',0,3.2,.70,30),('side',90,3.2,.70,30),('back',180,3.2,.70,30),('face',0,3.2,float(os.environ.get('FACE_Y','1.24')),float(os.environ.get('FACE_FOV','13')))]
   if os.environ.get('FACE_ONLY'):shots=shots[3:]
   for name,a,d,ty,fov in shots:
    await page.evaluate("([a,d,ty,fov])=>{V7F.mode='tpose';V7F.view(a,d,ty,fov)}",[a,d,ty,fov]);await page.wait_for_timeout(1500);await page.screenshot(path=str(OUT/f'{device}_tpose_{name}.png'),timeout=180000)
   for mode in ([] if os.environ.get('FACE_ONLY') else ['idle','walk','run']):
    for name,a in [('front',0),('side',90),('back',180)]:
     await page.evaluate("([m,a])=>{V7F.mode=m;V7F.view(a,3.2,.70,30)}",[mode,a]);await page.wait_for_timeout(1300);await page.screenshot(path=str(OUT/f'{device}_{mode}_{name}.png'),timeout=180000)
   print('errors',errors[:5],flush=True);await ctx.close()
  await b.close()
asyncio.run(main())
