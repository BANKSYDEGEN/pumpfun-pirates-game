# dump muzzle markers + hitbox dims from the real ship compiler (base tree vs branch), plus console errors
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
tree, out = sys.argv[1], sys.argv[2]
CFGS=[]
for pvp in (True, False):
    for c in range(0, 9): CFGS.append({'levels': {'cannons': c}, 'pvp': pvp})
for lv in ({'hull': 6}, {'armor': 6}, {'hull': 6, 'armor': 6, 'cannons': 8, 'sails': 6, 'range': 6, 'rudder': 6, 'reload': 6}):
    for pvp in (True, False): CFGS.append({'levels': lv, 'pvp': pvp})
for sk in ('diamond', 'golden', 'flaming', 'kraken', 'ghost', 'commodore', 'blood', 'navy', 'midnight', 'parchment'):
    CFGS.append({'levels': {'cannons': 4}, 'skin': sk, 'pvp': True})
import os
if os.environ.get('PROBE_ALL'):  # [v2] every PvP skin x levels 0 / max cannons / everything max / each upgrade type at 2,4,6,8
    MAX = {'hull': 6, 'armor': 6, 'cannons': 8, 'sails': 6, 'range': 6, 'rudder': 6, 'reload': 6}
    LV = [{}, {'cannons': 8}, MAX] + [{k: min(v, 6 if k != 'cannons' else 8)} for k in MAX for v in (2, 4, 6, 8) if not (k == 'cannons' and v == 8)]
    seen = set(json.dumps(c, sort_keys=True) for c in CFGS)
    for sk in ('classic', 'blood', 'seagreen', 'midnight', 'coral', 'storm', 'kraken', 'golden', 'ghost', 'admiral', 'flaming', 'diamond', 'commodore'):
        for lv in LV:
            c = {'levels': lv, 'skin': sk, 'pvp': True}; k = json.dumps(c, sort_keys=True)
            if k not in seen: seen.add(k); CFGS.append(c)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        res = {}
        for qual in ('high', 'low'):
            pg = await b.new_page(viewport={'width': 400, 'height': 300})
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
            await pg.goto(f'http://127.0.0.1:18952/{tree}/tools/ship_viewer.html?quality={qual}', timeout=120000)
            await pg.wait_for_function('window.V_READY', timeout=120000)
            for c in CFGS:
                c2 = dict(c, quality=qual); k = json.dumps(c2, sort_keys=True)
                res[k] = await pg.evaluate('(c)=>V.muzzles(c)', c2)
            res['__errors_' + qual] = errs
            await pg.close()
        json.dump(res, open(out, 'w'), indent=0)
        print('configs', len(res), 'errors', {q: res['__errors_' + q][:5] for q in ('high', 'low')})
asyncio.run(main())
