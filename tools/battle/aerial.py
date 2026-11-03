# PUMPFUN PIRATES battle areas: quick aerial check (island.html) of the range + pit. usage: python3 tools/battle/aerial.py [tag]
import asyncio, json, sys; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
TAG = sys.argv[1] if len(sys.argv) > 1 else 'a'
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); pg = await (await b.new_context(viewport={'width':1100,'height':700})).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text[:200]) if m.type=='error' else None)
    await pg.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await pg.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    await pg.goto('http://127.0.0.1:18960/timothy-battle/island.html?coast=1&shot&quality=high'); await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=300000); await pg.wait_for_timeout(2000)
    for name, c, off in [('range', (-104, -144), (40, 34, 36)), ('pit', (60, -86), (30, 26, 26))]:
      await pg.evaluate("""(async (a)=>{ const CO = await import('./js/island/coast.js'); const I = ISLAND, cam = I.camera; const [x, z] = CO.t2w(a.c[0], a.c[1]); const [ox, oz] = CO.t2w(a.c[0] + a.o[0], a.c[1] + a.o[2]);
        const y = I.foot.H(x, z); I.controls && (I.controls.enabled = false); I.__hold = () => { cam.position.set(ox, y + a.o[1], oz); if (I.controls) { I.controls.target.set(x, y, z); I.controls.update(); } cam.lookAt(x, y, z); }; I.__hold(); })""", {'c': c, 'o': off})
      for _ in range(6):
        await pg.evaluate("ISLAND.__hold()"); await pg.wait_for_timeout(700)
      await pg.screenshot(path=f'/workspace/timothy-battle/screens/battle/_aerial_{name}_{TAG}.png')
    r = await pg.evaluate("""(async()=>{ const CO = await import('./js/island/coast.js'); const F = ISLAND.foot; const g = (lx, lz) => +F.H(...CO.t2w(lx, lz)).toFixed(3);
      return { range: [g(-104, -144), g(-125, -125), g(-83, -163)], pit: [g(60, -86), g(70, -86), g(60, -102)], trees: F.stats.trees }; })()""")
    print(json.dumps(r), errs[:6]); await b.close()
asyncio.run(main())
