import asyncio, json; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); pg = await (await b.new_context(viewport={'width':640,'height':360})).new_page()
    await pg.goto('http://127.0.0.1:18960/timothy-plaza/island.html?coast=1&shot&quality=low&plaza=2'); await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=240000)
    r = await pg.evaluate("""(async()=>{ const CO = await import('./js/island/coast.js'), FT = await import('./js/island/foot.js'); const t=(x,z)=>CO.w2t(x,z).map(v=>Math.round(v));
      return { boxes: FT.MAP_BOXES().map(o=>[...t(o.x,o.z), Math.round(o.hx*2), Math.round(o.hz*2)]), pois: FT.FOOT_POIS.map(p=>[p.id, ...t(p.x,p.z)]), inter: FT.INTERACT.map(i=>[i.id, ...t(i.x,i.z)]),
        lots: FT.LOTS_MAP.map(l=>[l.label, Math.round(l.lx), Math.round(l.z), l.w, l.d]), digs: FT.DIG_HINTS.map(([x,z,k])=>t(x,z)) }; })()""")
    json.dump(r, open('/workspace/timothy-battle/screens/dump.json','w')); await b.close()
asyncio.run(main())
