# [Timothy] runs d2_probe.js in island.html?coast=1 (one headless browser) -> tools/d2_blender/d2_layout.json.  python3 d2_probe.py WORKTREE_DIRNAME
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
WT = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__)); JS = open(os.path.join(HERE, 'd2_probe.js')).read()
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); ctx = await b.new_context(viewport={'width': 640, 'height': 360})
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    pg = await ctx.new_page(); await pg.goto(f'http://127.0.0.1:{os.environ.get('PFP_PORT', '18960')}/{WT}/island.html?coast=1&shot&quality=low')
    await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=300000); await pg.wait_for_timeout(1000)
    r = await pg.evaluate(JS); json.dump(r, open(os.path.join(HERE, 'd2_layout.json'), 'w'), indent=0); print('OK', len(r['steps'][0]['treads']), len(r['steps'][1]['treads'])); await b.close()
asyncio.run(main())
