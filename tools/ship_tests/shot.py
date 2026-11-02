# viewer screenshots: python3 shot.py tree out.png '{"levels":{}}' yaw pitch dist [w h quality]
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    tree, out, cfg = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
    yaw, pitch, dist = map(float, sys.argv[4:7]); w, h = (int(sys.argv[7]), int(sys.argv[8])) if len(sys.argv) > 8 else (1000, 700)
    qual = sys.argv[9] if len(sys.argv) > 9 else 'high'
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = await b.new_page(viewport={'width': w, 'height': h})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
        await pg.goto(f'http://127.0.0.1:18952/{tree}/tools/ship_viewer.html?quality={qual}', timeout=120000)
        await pg.wait_for_function('window.V_READY', timeout=120000)
        d = await pg.evaluate('(c)=>V.show(c)', cfg)
        await pg.evaluate(f'()=>{{V.frame({yaw},{pitch},{dist}); for(let i=0;i<20;i++) V.step();}}')
        await pg.screenshot(path=out)
        print(d, errs[:6])
asyncio.run(main())
