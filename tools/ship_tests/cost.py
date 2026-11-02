import asyncio, json
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS); res = {}
        for tree in ('base', 'game'):
            for q in ('high', 'low'):
                pg = await b.new_page(viewport={'width': 400, 'height': 300})
                await pg.goto(f'http://127.0.0.1:18952/{tree}/tools/ship_viewer.html?quality={q}'); await pg.wait_for_function('window.V_READY', timeout=120000)
                for lv in ({}, {'cannons': 8}):
                    r = await pg.evaluate('''(lv)=>{ V.show({levels: lv}); V.frame(0.9, 0.2, 2.5); V.renderer.info.autoReset = true; V.step(); const i = V.renderer.info.render;
                        let tris = 0; V.ship.traverse(o => { if (o.isMesh && o.visible) { const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
                        return { calls: i.calls, frameTris: i.triangles, shipTris: Math.round(tris) }; }''', lv)
                    res[f'{tree} {q} cannons={lv.get("cannons",0)}'] = r; print(tree, q, lv, r, flush=True)
                await pg.close()
        json.dump(res, open('/workspace/timothy-ships/screens/ship_cost.json', 'w'), indent=1)
asyncio.run(main())
