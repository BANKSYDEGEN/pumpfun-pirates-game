# one 3/4 bow shot per skin / Squads team colour, same build (4 cannon upgrades), from the real ship compiler
import asyncio, json, sys, os, math
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
ORBIT = open('/workspace/timothy-ships/tools/turntable.py').read().split('ORBIT = """')[1].split('"""')[0]
SHOTS = [('classic', None, 'DEFAULT'), ('blood', None, 'CRIMSON SAILS'), ('seagreen', None, 'SEA GREEN'), ('midnight', None, 'BLACK PEARL'),
         ('coral', None, 'CORAL REEF'), ('storm', None, 'STORM RIDER'), ('kraken', None, 'KRAKEN INK'), ('golden', None, 'GOLDEN GALLEON'),
         ('ghost', None, 'GHOST SHIP'), ('admiral', None, 'ADMIRAL WHITE'), ('flaming', None, 'FLAMING SHIP'), ('diamond', None, 'DIAMOND SHIP'),
         ('commodore', None, 'COMMODORE (boss look, unchanged)'), ('classic', 'blue', 'SQUADS: your team (blue)'), ('classic', 'red', 'SQUADS: enemy (red)'), ('golden', 'blue', 'GOLDEN + team blue')]
LV = json.loads(os.environ.get('SK_LV', '{"cannons": 4}'))
async def main():
    tree, out, qual = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else 'high'); T = 520
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = await b.new_page(viewport={'width': T, 'height': T}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:18952/{tree}/tools/ship_viewer.html?quality={qual}', timeout=120000)
        await pg.wait_for_function('window.V_READY', timeout=120000)
        ims = []
        for sk, team, label in SHOTS:
            await pg.evaluate('(c)=>V.show(c)', {'levels': LV, 'skin': sk, 'team': team})
            await pg.evaluate(ORBIT, [0.95, 0.16, 1.45, 0.04])
            for _ in range(20): await pg.evaluate('()=>V.step(1/30)')
            f = f'/tmp/skin_{tree}_{qual}_{sk}_{team}.jpg'; await pg.screenshot(path=f, type='jpeg', quality=92); ims.append((f, label))
        print('errors', errs[:5])
    F = '/workspace/timothy-ships/game/assets/JustAnotherHand.ttf'; fl = ImageFont.truetype(F, 30); ft = ImageFont.truetype(F, 46)
    cols, pad, lab, head = 4, 8, 36, 64
    rows = (len(ims) + cols - 1) // cols; c = Image.new('RGB', (cols * (T + pad) + pad, head + rows * (T + lab + pad)), (13, 26, 34)); d = ImageDraw.Draw(c)
    d.text((14, 8), f'PUMPFUN PIRATES · skins + Squads colours on the v2 player hull ({qual.upper()} quality)', fill=(255, 205, 119), font=ft)
    for i, (f, label) in enumerate(ims):
        x = pad + (i % cols) * (T + pad); y = head + (i // cols) * (T + lab + pad)
        d.text((x + 4, y), label, fill=(240, 240, 240), font=fl); c.paste(Image.open(f), (x, y + lab))
    c.save(out, optimize=True); print(out, c.size)
asyncio.run(main())
