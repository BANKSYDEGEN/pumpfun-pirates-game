# [Timothy] python3 tools/collide/sweep.py WT OUT.json [desktop|phone] [deckColl 0|1] [query]
import asyncio, json, sys, os
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT, OUT = sys.argv[1], sys.argv[2]; DEV = sys.argv[3] if len(sys.argv) > 3 else 'desktop'; DC = (sys.argv[4] if len(sys.argv) > 4 else '1') == '1'; Q = sys.argv[5] if len(sys.argv) > 5 else ''
JS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sweep.js')).read()
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob = DEV == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1280, 'height': 720})
    ctx = await b.new_context(**kw); await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
    pg = await ctx.new_page(); pg.set_default_timeout(900000)
    await pg.goto(f'http://127.0.0.1:18960/{WT}/island.html?coast=1&shot&quality={"low" if mob else "high"}&{Q}')
    await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=600000); await pg.wait_for_timeout(3000)
    r = await pg.evaluate(JS, dict(deckColl=DC, deflect=DC, crew=True, only=os.environ.get('ONLY'))); await b.close(); return r
r = asyncio.run(main()); r['dev'] = DEV; r['deckColl'] = DC
json.dump(r, open(OUT, 'w'), indent=1)
fails = [x for x in r['res'] if not x['ok'] or not x.get('crewOk', True)]
print(json.dumps(dict(dev=DEV, deckColl=DC, ms=r['ms'], lanes=r['n'], player_pass=r['pass'], player_fail=r['fail'], crew_fail=r['crewFail'])))
for x in fails[:60]: print(' ', x['name'], x['why'], x.get('stuckAt', [])[:4], 'crew', x.get('crewStuck', [])[:4])
