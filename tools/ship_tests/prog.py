# upgrade progression sheet from the real ship compiler: rows = upgrade type, cols = level 0,2,4,6,8 (capped at the type's max)
# prog.py tree out.png quality skin [maxsheet]  -- maxsheet: one row per skin at level 0 vs everything max
import asyncio, json, sys, os
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
ORBIT = open('/workspace/timothy-ships/tools/turntable.py').read().split('ORBIT = """')[1].split('"""')[0]
tree, out, q, skin = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]; maxsheet = len(sys.argv) > 5
TYPES = [('cannons', 8), ('hull', 6), ('armor', 6), ('sails', 6), ('range', 6), ('rudder', 6), ('reload', 6)]
MAX = {k: m for k, m in TYPES}
if os.environ.get('PROG_TYPES'): TYPES = [t for t in TYPES if t[0] in os.environ['PROG_TYPES'].split(',')]
SK = ['classic', 'blood', 'seagreen', 'midnight', 'coral', 'storm', 'kraken', 'golden', 'ghost', 'admiral', 'flaming', 'diamond']
T = 360
import os
VIEW = json.loads(os.environ.get('PROG_VIEW', '[2.35, 0.2, 1.3, 0.12]'))
FIX = '''(a)=>{ const [yaw, pitch, k, ty] = a; const s = V.ship, T = V.THREE; const box = new T.Box3().setFromObject(s); const c = box.getCenter(new T.Vector3()), z = box.getSize(new T.Vector3());
  const R = Math.max(z.x, z.y, z.z) * k; const o = s.position; const tgt = [c.x - o.x, c.y - o.y - z.y * ty, c.z - o.z];
  return [[tgt[0] + Math.sin(yaw) * Math.cos(pitch) * R, tgt[1] + Math.sin(pitch) * R, tgt[2] + Math.cos(yaw) * Math.cos(pitch) * R], tgt]; }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = await b.new_page(viewport={'width': T, 'height': T}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:18952/{tree}/tools/ship_viewer.html?quality={q}', timeout=120000); await pg.wait_for_function('window.V_READY', timeout=120000)
        rows = []
        if maxsheet: grid = [(sk, [('lvl 0', {}), ('max cannons', {'cannons': 8}), ('everything max', MAX)], sk) for sk in SK]
        else: grid = [(skin, [(f'{t} {l}' if l <= m else f'{t} {m} (max)', {t: min(l, m)}) for l in (0, 2, 4, 6, 8) if l <= m or l == 8], t.upper()) for t, m in TYPES]
        for sk, cells, label in grid:
            ims = []
            # one fixed camera per row, framed on the row's biggest ship, so growth level to level reads
            await pg.evaluate('(c)=>V.show(c)', {'levels': cells[-1][1], 'skin': sk, 'pvp': True})
            cam = await pg.evaluate(FIX, VIEW)
            for name, lv in cells:
                await pg.evaluate('(c)=>V.show(c)', {'levels': lv, 'skin': sk, 'pvp': True})
                await pg.evaluate('(c)=>V.cam(c[0], c[1], 30)', cam)
                for _ in range(12): await pg.evaluate('()=>V.step(1/30)')
                f = f'/tmp/prog_{q}_{sk}_{len(rows)}_{len(ims)}.jpg'; await pg.screenshot(path=f, type='jpeg', quality=90); ims.append((f, name))
            rows.append((label, ims))
        print('errors', errs[:4])
    F = '/workspace/timothy-ships/game/assets/JustAnotherHand.ttf'; fl = ImageFont.truetype(F, 26); ft = ImageFont.truetype(F, 40)
    cols = max(len(r[1]) for r in rows); lw, pad, head, lab = 150, 6, 56, 30
    c = Image.new('RGB', (lw + cols * (T + pad) + pad, head + len(rows) * (T + lab + pad)), (13, 26, 34)); d = ImageDraw.Draw(c)
    d.text((12, 6), 'PUMPFUN PIRATES v2 hull: ' + ('every skin, lvl 0 / max cannons / all max' if maxsheet else f'upgrade progression ({skin}, levels 0 2 4 6 8)') + f' - {q.upper()}', fill=(255, 205, 119), font=ft)
    for ri, (label, ims) in enumerate(rows):
        y = head + ri * (T + lab + pad); d.text((10, y + T // 2), label, fill=(255, 255, 255), font=fl)
        for ci, (f, name) in enumerate(ims):
            x = lw + pad + ci * (T + pad); c.paste(Image.open(f), (x, y)); d.text((x + 4, y + T + 2), name, fill=(220, 220, 220), font=fl)
    c.save(out, optimize=True); print(out, c.size)
asyncio.run(main())
