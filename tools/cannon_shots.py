# PUMPFUN PIRATES headland battery shots (island.html on-foot viewer). usage: python3 cannon_shots.py OUTDIR "query" desktop|phone name:cx,cz,cy,tx,tz,ty,fov ...
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
OUT, Q, DEV = sys.argv[1], sys.argv[2], sys.argv[3]; os.makedirs(OUT, exist_ok=True)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob = DEV == 'phone'
    kw = dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width':1600,'height':900})
    ctx = await b.new_context(**kw)
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    WT = os.environ.get('WT', 'timothy-cannons'); await pg.goto(f'http://127.0.0.1:18960/{WT}/island.html?coast=1&shot&quality={"low" if mob else "high"}&{Q}')
    await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=240000); await pg.wait_for_timeout(3000)
    for spec in sys.argv[4:]:
      name, v = spec.split(':'); cx, cz, cy, tx, tz, ty, fov = map(float, v.split(','))
      await pg.evaluate(f"""(async()=>{{ const CO = await import('./js/island/coast.js'); const I = ISLAND; const [cx, cz] = CO.t2w({cx}, {cz}), [tx, tz] = CO.t2w({tx}, {tz});
        I.camera.fov = {fov}; I.camera.updateProjectionMatrix(); I.camera.position.set(cx, {cy}, cz); if (I.controls) {{ I.controls.target.set(tx, {ty}, tz); I.controls.update(); }} I.camera.lookAt(tx, {ty}, tz); window.__lock = [cx, {cy}, cz, tx, {ty}, tz]; }})()""")
      await pg.wait_for_timeout(3500); await pg.screenshot(timeout=120000, path=f'{OUT}/{DEV}_{name}.png'); print('shot', DEV, name, flush=True)
    print(json.dumps({'errors': errs[:8]})); await b.close()
asyncio.run(main())
