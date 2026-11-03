# PUMPFUN PIRATES battle-areas site probe: ground height + blocked reason on a town-local grid (inland of the plaza + headland side)
import asyncio, json, sys; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
SITE = sys.argv[1] if len(sys.argv) > 1 else 'timothy-plaza'; Q = sys.argv[2] if len(sys.argv) > 2 else 'plaza=2'
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); pg = await (await b.new_context(viewport={'width':640,'height':360})).new_page()
    await pg.goto(f'http://127.0.0.1:18960/{SITE}/island.html?coast=1&shot&quality=low&{Q}'); await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=240000)
    r = await pg.evaluate("""(async()=>{ const CO = await import('./js/island/coast.js'); const F = ISLAND.foot, out = [];
      for (let lx = -440; lx <= 400; lx += 4) for (let lz = -340; lz <= 120; lz += 4) { const [x, z] = CO.t2w(lx, lz);
        out.push([lx, lz, +F.groundAt(x, z).toFixed(2), F.whyBlocked(x, z) || '']); } return out; })()""")
    json.dump(r, open('/workspace/timothy-battle/screens/probe.json', 'w')); print(len(r)); await b.close()
asyncio.run(main())
