# Renders assets/pirates/thumbs/weapon_<slot>_<id>.png (WEAPON STORE cards: a v5 pirate holding it) locally (three.js in headless chrome). No AI image credits.
import asyncio, base64, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(); pg.on('console', lambda m: print('console', m.text)); pg.on('pageerror', lambda e: print('pageerror', e)); pg.on('requestfailed', lambda r: print('reqfail', r.url))
        await pg.goto('http://127.0.0.1:18960/timothy-battle/tools/battle/weapon_thumbs.html'); await pg.wait_for_function('window.done', timeout=90000)
        for k, v in (await pg.evaluate('window.shots')).items():
            f = ROOT / f'assets/pirates/thumbs/weapon_{k}.png'; f.write_bytes(base64.b64decode(v.split(',')[1])); print(f)
        await b.close()
asyncio.run(main())
