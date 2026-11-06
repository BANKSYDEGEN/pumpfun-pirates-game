import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=await b.new_page();await page.goto('http://127.0.0.1:8787/tools/v7/qa.html');await page.wait_for_function('window.V7QA')
  colors=await page.evaluate("""async()=>{const {PirateGLB}=await import('/js/pirateGLB.js'),G=await import('/js/pirateGear.js');const a=await PirateGLB.create(),b=await PirateGLB.create({lod:'lo'});G.setBodyLook(a,{skinColor:9,hairColor:10,eyeColor:7});const before=b._v7Tint.v7On.value.toArray();if(before.some(x=>x))throw Error('Tint leaked');const active=a._v7Tint.v7On.value.toArray();G.setBodyLook(a,{});return{a:a.v7,b:b.v7,active,other:before,reset:a._v7Tint.v7On.value.toArray(),geometryShared:a.atlasMeshes[0].geometry===b.atlasMeshes[0].geometry};}""");assert colors['active']==[1,1,1] and colors['reset']==[0,0,0]
  await page.route('**/pirate_male_v7_*.glb',lambda r:r.fulfill(status=404,body=''))
  await page.reload();await page.wait_for_function('window.V7QA');fallback=await page.evaluate("""async()=>{const {PirateGLB}=await import('/js/pirateGLB.js'),{applyGear}=await import('/js/pirateGear.js');const p=await PirateGLB.create();await applyGear(p,{hat:'tricorn',outfit:'coat'});return{v7:p.v7,v6:p.v6,items:Object.keys(p.items),clips:Object.keys(p.clips)};}""");assert not fallback['v7'] and fallback['v6'] and 'idle' in fallback['clips'];print(json.dumps({'colors':colors,'fallback':fallback},indent=2));await b.close()
asyncio.run(main())
