import asyncio, json, sys; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
JS = sys.argv[1]; Q = sys.argv[2] if len(sys.argv) > 2 else ''
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); pg = await (await b.new_context(viewport={'width':400,'height':300})).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(f'http://127.0.0.1:18960/raul-foot-physics/island.html?coast=1&shot&quality=low&{Q}'); await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=240000)
    r = await pg.evaluate("(async()=>{ const CO = await import('./js/island/coast.js'), FM = await import('./js/island/foot.js'); const F = ISLAND.foot; " + open(JS).read() + " })()")
    print(r if isinstance(r, str) else json.dumps(r)); print('errors', errs[:5]); await b.close()
asyncio.run(main())
