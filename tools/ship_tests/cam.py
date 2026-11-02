# viewer screenshots with explicit cameras: python3 cam.py tree prefix cfgjson quality 'name:px,py,pz:tx,ty,tz:fov' ...
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    tree, prefix, cfg, qual = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]), sys.argv[4]
    W, H = 1200, 800
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = await b.new_page(viewport={'width': W, 'height': H})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
        await pg.goto(f'http://127.0.0.1:18952/{tree}/tools/ship_viewer.html?quality={qual}', timeout=120000)
        await pg.wait_for_function('window.V_READY', timeout=120000)
        await pg.evaluate('(c)=>V.show(c)', cfg)
        for spec in sys.argv[5:]:
            n, pp, tt, fov = spec.split(':')
            await pg.evaluate(f'()=>{{V.cam([{pp}],[{tt}],{fov}); for(let i=0;i<12;i++) V.step();}}')
            await pg.screenshot(path=f'{prefix}{n}.png')
        print(tree, errs[:6])
asyncio.run(main())
