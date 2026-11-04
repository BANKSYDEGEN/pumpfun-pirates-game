# PUMPFUN PIRATES swim animation contact sheets (tools/swim_viewer.html), one headless Chrome, Supabase blocked.
# usage: python3 swim_shots.py OUTDIR [port]  -> OUTDIR/swim_{male,female}_{hi,lo}.png (+ errors json)
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
OUT = sys.argv[1]; PORT = sys.argv[2] if len(sys.argv) > 2 else '18977'; os.makedirs(OUT, exist_ok=True)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); errs = {}; info = {}
    for sex in ('m', 'f'):
      for lod in ('hi', 'lo'):
        kw = dict(viewport={'width': 1500, 'height': 1080}) if lod == 'hi' else dict(viewport={'width': 1032, 'height': 760}, device_scale_factor=1)
        ctx = await b.new_context(**kw); await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
        pg = await ctx.new_page(); key = f"{'male' if sex == 'm' else 'female'}_{lod}"; E = errs[key] = []
        pg.on('pageerror', lambda e: E.append('PAGE ' + str(e))); pg.on('console', lambda m: E.append(m.text[:200]) if m.type == 'error' else None)
        await pg.goto(f'http://127.0.0.1:{PORT}/raul-swim-anim/tools/swim_viewer.html?sex={sex}&lod={lod}&zoom=1.25')
        await pg.wait_for_function('window.SWIMV && SWIMV.ready()', timeout=240000)
        info[key] = await pg.evaluate('SWIMV.go()'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/swim_{key}.png', timeout=120000); print('shot', key, flush=True); await ctx.close()
    json.dump({'errors': errs, 'cells': info}, open(f'{OUT}/swim_viewer.json', 'w'), indent=0); print(json.dumps(errs)); await b.close()
asyncio.run(main())
