# [Timothy] collision-pass shots: python3 tools/collide/shots.py WT OUT_DIR PREFIX desktop|phone 'QUERY' NAME=lx,lz,y:tlx,tlz,ty[:fov] ...
# (y = height above the street level 2.73 if prefixed with +, else absolute)
import asyncio, sys, os
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT, OUT, PRE, DEV, Q = sys.argv[1:6]; os.makedirs(OUT, exist_ok=True); Y = 2.73
def num(s): return Y + float(s[1:]) if s.startswith('+') else float(s)
SH = []
for a in sys.argv[6:]:
  n, v = a.split('='); p = v.split(':'); c = p[0].split(','); t = p[1].split(','); SH.append((n, [float(c[0]), float(c[1]), num(c[2])], [float(t[0]), float(t[1]), num(t[2])], float(p[2]) if len(p) > 2 else 55))
CAM = """(async([c,t,fov])=>{ const CO = await import('./js/island/coast.js'); const I = ISLAND; const [cx, cz] = CO.t2w(c[0], c[1]), [tx, tz] = CO.t2w(t[0], t[1]);
  I.camera.fov = fov; I.camera.updateProjectionMatrix(); I.camera.position.set(cx, c[2], cz); if (I.controls) { I.controls.target.set(tx, t[2], tz); I.controls.update(); } I.camera.lookAt(tx, t[2], tz); window.__lock = [cx, c[2], cz, tx, t[2], tz]; })"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob = DEV == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1280, 'height': 720})
    ctx = await b.new_context(**kw); await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
    pg = await ctx.new_page(); pg.set_default_timeout(600000)
    await pg.goto(f'http://127.0.0.1:18960/{WT}/island.html?coast=1&shot&quality={"low" if mob else "high"}&{Q}')
    await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=600000); await pg.wait_for_timeout(3000)
    for n, c, t, fov in SH:
      await pg.evaluate(CAM, [c, t, fov]); await pg.wait_for_timeout(3000); await pg.screenshot(path=f'{OUT}/{PRE}_{DEV}_{n}.png'); print('shot', n, flush=True)
    await b.close()
asyncio.run(main())
