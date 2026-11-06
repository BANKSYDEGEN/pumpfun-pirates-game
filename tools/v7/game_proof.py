import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path('/workspace/v7-male-ingame-shots');OUT.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);report={}
  for device,w,h in [('pc',1280,800),('phone',390,844)]:
   ctx=await b.new_context(viewport={'width':w,'height':h},is_mobile=device=='phone',has_touch=device=='phone',service_workers='block');await ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:8787/') else r.fulfill(status=503,body='{}'));page=await ctx.new_page();await page.route_web_socket('**',lambda ws:ws.close());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto('http://127.0.0.1:8787/island.html?coast=1&shot&quality='+('high' if device=='pc' else 'low')+'&opt=0',timeout=120000);await page.wait_for_function('window.ISLAND?.foot',timeout=240000)
   info=await page.evaluate(Path('tools/v7/game_scenes.js').read_text(),device);report[device]={'initial':info,'errors':errors};print(device,info,flush=True)
   for pose in ['idle','walk','sword','gun']:
    await page.evaluate("pose=>{V7GAME.mode=pose==='walk'?'walk':'idle';if(pose==='sword'||pose==='gun')V7GAME.hold(pose==='sword'?1:2)}",pose);await page.wait_for_timeout(1200);await page.screenshot(path=str(OUT/f'onfoot_{device}_{pose}.png'),timeout=120000)
   for s,h,e in [(9,1,3),(1,10,7),(0,0,0)]:
    await page.evaluate('([s,h,e])=>V7GAME.color(s,h,e)',[s,h,e]);await page.wait_for_timeout(500);await page.screenshot(path=str(OUT/f'colors_{device}_{s}_{h}_{e}.png'),timeout=120000)
   for shop in ['shop_clothes','shop_crew']:
    report[device][shop]=await page.evaluate('id=>V7GAME.shopView(id)',shop);await page.wait_for_timeout(1500);await page.screenshot(path=str(OUT/f'mannequins_{device}_{shop}.png'),timeout=120000)
   report[device]['helm']=await page.evaluate('V7GAME.helm()');await page.wait_for_timeout(1000);await page.screenshot(path=str(OUT/f'helm_{device}.png'),timeout=120000)
   for vendor,tab,slot,item in [('clothes','gear','outfit','outfit:coat'),('clothes','wardrobe','outfit','outfit:coat'),('weapons','swords','sword','sword:cutlass')]:
    await page.evaluate("async([vendor,tab,slot,item])=>{const S=await import('/js/islandShop.js'),C=await import('/js/shopCatalog.js');S.closeShop();S.setShopProvider(S.mockProvider({gold:1200,owner:true,owned:{skins:['classic'],gear:['outfit:coat','hat:tricorn','pants:classic_pants','boots:boots_classic']},equipped:{skin:'classic',gear:{...C.CAPTAIN_DEFAULTS,outfit:'coat',hat:'tricorn',pants:'classic_pants',boots:'boots_classic'}}}));return S.openShop({vendor,tab,slot,item})}",[vendor,tab,slot,item]);await page.wait_for_timeout(2500);await page.screenshot(path=str(OUT/f'shop_{device}_{vendor}_{tab}.png'),timeout=120000)
   await page.evaluate("async()=>{const S=await import('/js/islandShop.js');S.closeShop();(await import('/js/gearColorPicker.js')).openGearColorPicker({kind:'look'});}");await page.wait_for_timeout(500);await page.screenshot(path=str(OUT/f'look_picker_{device}.png'),timeout=120000)
   print('PROOF',device,report[device],flush=True)
   await ctx.close()
  (OUT/'game_report.json').write_text(json.dumps(report,indent=2));await b.close()
asyncio.run(main())
