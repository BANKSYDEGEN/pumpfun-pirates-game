import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS); res = {}
        for q in ('high', 'low'):
            pg = await b.new_page(viewport={'width': 300, 'height': 200})
            await pg.goto(f'http://127.0.0.1:18952/game/tools/ship_viewer.html?quality={q}'); await pg.wait_for_function('window.V_READY', timeout=120000)
            for c in ({'levels': {}}, {'levels': {'cannons': 4}}, {'levels': {'cannons': 8}}, {'levels': {'cannons': 8}, 'pvp': False}, {'levels': {'cannons': 8, 'hull': 6, 'armor': 6}}, {'levels': {'cannons': 4}, 'skin': 'diamond'}, {'levels': {'cannons': 4}, 'skin': 'golden'}, {'levels': {'cannons': 4}, 'skin': 'flaming'}):
                r = await pg.evaluate('(c)=>V.barrelGap(c)', dict(c, quality=q))
                k = q + ' ' + json.dumps(c); res[k] = {'guns': len(r['gaps']), 'max_gap_m': max(r['gaps']) if r['gaps'] else None, 'kit_iron_verts': r['n']}
                print(k, res[k], flush=True)
        json.dump(res, open('/workspace/timothy-ships/screens/barrel_tip_gaps.json', 'w'), indent=1)
asyncio.run(main())
