# [Timothy] runs hill_probe.js in island.html?coast=1 (one headless browser).  python3 hill_probe.py WORKTREE_DIRNAME desktop|phone [extra query]
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT, DEV = sys.argv[1:3]; Q = sys.argv[3] if len(sys.argv) > 3 else ''
JS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hill_probe.js')).read()
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob = DEV == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, device_scale_factor=1, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1280, 'height': 720})
    ctx = await b.new_context(**kw); await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e))); pg.on('console', lambda m: errs.append(m.type + ' ' + m.text) if m.type in ('error', 'warning') else None)
    await pg.goto(f'http://127.0.0.1:18960/{WT}/island.html?coast=1&shot&quality={"low" if mob else "high"}&{Q}')
    await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=300000); await pg.wait_for_timeout(2500)
    r = await pg.evaluate(JS); r = r if isinstance(r, dict) else {'out': r}; r['errors'] = [e for e in errs if '503' not in e][:12]
    print('RESULT', json.dumps(r)); await b.close()
asyncio.run(main())
