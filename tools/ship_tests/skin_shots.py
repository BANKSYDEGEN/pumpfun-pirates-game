# stills / clip frames of one skin from the real ship compiler: skin_shots.py tree out_prefix skin quality levels_json views_json [frames speed]
# views: [[yaw, pitch, dist], ...]; frames > 1 writes out_prefix_<view>_<frame>.jpg stepping 1/30 s; speed (m/s) sails the ship forward
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
tree, out, skin, q, lv, views = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], json.loads(sys.argv[5]), json.loads(sys.argv[6])
frames = int(sys.argv[7]) if len(sys.argv) > 7 else 1; speed = float(sys.argv[8]) if len(sys.argv) > 8 else 0; W, H = (900, 600)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = await b.new_page(viewport={'width': W, 'height': H}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:18952/{tree}/tools/ship_viewer.html?quality={q}', timeout=120000); await pg.wait_for_function('window.V_READY', timeout=120000)
        await pg.evaluate('(c)=>V.show(c)', {'levels': lv, 'skin': skin, 'pvp': True})
        for vi, (yaw, pitch, dist) in enumerate(views):
            for f in range(frames):
                await pg.evaluate(f'()=>{{ if ({speed}) V.ship.position.z += {speed} / 30; V.frame({yaw},{pitch},{dist}); V.step(1/30); }}')
                if frames == 1:
                    for _ in range(10): await pg.evaluate(f'()=>{{ if ({speed}) V.ship.position.z += {speed} / 30; V.frame({yaw},{pitch},{dist}); V.step(1/30); }}')
                await pg.screenshot(path=f'{out}_{vi}' + (f'_{f:03d}' if frames > 1 else '') + '.jpg', type='jpeg', quality=90)
        print('errors', errs[:4])
asyncio.run(main())
