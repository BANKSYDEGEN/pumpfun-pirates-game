import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path('/workspace/v7-male-ingame-shots/fit');OUT.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=await b.new_page(viewport={'width':1200,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  await page.goto('http://127.0.0.1:8787/tools/v7/qa.html');await page.wait_for_function('window.V7QA');catalog=await page.evaluate('V7QA.catalog');(OUT/'catalog.json').write_text(json.dumps(catalog,indent=2));report=[]
  for lod in ['hi','lo']:
   for start in range(0,len(catalog),12):
    batch=catalog[start:start+12];await page.evaluate('([b,l])=>V7QA.load(b,l)',[batch,lod])
    for pose in await page.evaluate('V7QA.modes'):
     await page.evaluate('m=>V7QA.render(m)',pose);audit=await page.evaluate('V7QA.audit()');report.append({'lod':lod,'start':start,'pose':pose,'audit':audit})
     if pose in ['idle','walk']:await page.screenshot(path=str(OUT/f'{lod}_{start:03d}_{pose}.png'))
    await page.evaluate('V7QA.render("idle",true)');await page.screenshot(path=str(OUT/f'{lod}_{start:03d}_back.png'));print('FIT',lod,start,[x['name'] for x in batch],flush=True)
  (OUT/'report.json').write_text(json.dumps({'errors':errors,'poses':report},indent=2));print('ERRORS',errors,flush=True);await b.close()
asyncio.run(main())
