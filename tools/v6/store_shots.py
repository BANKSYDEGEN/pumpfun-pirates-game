# Clothing Store (islandShop 'clothes' vendor) on the island: PANTS + BOOTS tabs, desktop + phone. Supabase blocked (mock provider).
import asyncio, sys; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']; OUT='/workspace/brand/v6_characters/shots'
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    for vw in ('desktop','phone'):
      kw = dict(viewport={'width':1600,'height':900}) if vw=='desktop' else dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True)
      ctx = await b.new_context(**kw); await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); pg = await ctx.new_page(); E=[]
      pg.on('pageerror', lambda e: E.append('PAGE '+str(e)))
      await pg.goto('http://127.0.0.1:18970/raul-v6/island.html?coast=1&shot&quality='+('high' if vw=='desktop' else 'low')); await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=240000)
      for slot,item in (('pants','sailor_trousers'),('boots','boots_sea')):
        ok = await pg.evaluate(f"""(async()=>{{ const S = await import('./js/islandShop.js'), C = await import('./js/shopCatalog.js'); S.closeShop(); S.setShopProvider(S.mockProvider({{ gold: 1200, owned: {{ skins: ['classic'], gear: ['pants:classic_pants', 'boots:boots_classic'] }}, equipped: {{ skin: 'classic', gear: {{ ...C.CAPTAIN_DEFAULTS, pants: 'classic_pants', boots: 'boots_classic' }} }} }})); return S.openShop({{ vendor: 'clothes', tab: 'gear', slot: '{slot}', item: '{slot}:{item}' }}); }})()""")
        await pg.wait_for_timeout(30000); await pg.screenshot(path=f'{OUT}/store_{slot}_{vw}.png'); print(vw, slot, ok, E[:3], flush=True)
      await ctx.close()
    await b.close()
asyncio.run(main())
