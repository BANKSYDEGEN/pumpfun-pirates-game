#!/usr/bin/env python3
"""In-game harbor tutorial shots: casino, shops, inventory hint/panel, canoe frames.
Loads the live game and routes local overrides for the tutorial JS."""
import asyncio, os, json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('OUT', '/workspace/harbor-tut-shots'))
LIVE = os.environ.get('LIVE', 'https://game.pumpfunpirates.com').rstrip('/')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
ARGS = [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--renderer-process-limit=1', '--no-sandbox',
    '--disable-dev-shm-usage', '--js-flags=--max-old-space-size=1024',
]
OVERRIDE = {
    '/js/harborTutorial.js': ROOT / 'js/harborTutorial.js',
    '/js/harborTutorialSteps.js': ROOT / 'js/harborTutorialSteps.js',
    '/js/dock/canoe.js': ROOT / 'js/dock/canoe.js',
    '/js/dock/index.js': ROOT / 'js/dock/index.js',
}

INIT = """
try {
  localStorage.setItem('pfp_name', 'TUTORIALSHOT');
  localStorage.setItem('pfp_gfx_hint', '1');
  localStorage.setItem('pfp_tut_seen', '1');
  localStorage.setItem('pfp_tutorial_v1', '1');
  localStorage.setItem('pfp_tutorial_off', '1');
  localStorage.setItem('pfp_harbor_tut_off', '1');
} catch (e) {}
"""

async def route_overrides(route):
    path = route.request.url.split('?')[0]
    for key, loc in OVERRIDE.items():
        if path.endswith(key) or f'/{key.lstrip("/")}' in path:
            body = loc.read_bytes()
            await route.fulfill(status=200, content_type='text/javascript; charset=utf-8',
                                headers={'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*'},
                                body=body)
            return
    if path.endswith('/sw.js'):
        await route.fulfill(status=404, body=b'')
        return
    await route.continue_()

async def dump(pg, label):
    try:
        info = await pg.evaluate("""() => ({
          href: location.href,
          titleOn: !document.getElementById('title')?.classList.contains('hidden'),
          btnPvp: !!document.getElementById('btn-pvp'),
          btnPvpText: document.getElementById('btn-pvp')?.textContent || null,
          entry: !!document.getElementById('pvp-entry-go'),
          where: window.PFP?.pvp?.where || null,
          state: window.PFP?.game?.state || null,
          tut: !!window.__pfpHarborTut,
          hasPFP: !!window.PFP,
          renderer: !!window.PFP?.renderer,
        })""")
        print(label, info, flush=True)
    except Exception as e:
        print(label, 'dump failed', e, flush=True)

async def enter_harbor(pg):
    await pg.wait_for_function('window.PFP && PFP.game && document.getElementById("btn-pvp")', timeout=180000)
    await dump(pg, 'loaded')
    await pg.wait_for_timeout(1500)
    # click ENTER GAME if still on the title
    await pg.evaluate("""() => {
      const b = document.getElementById('btn-pvp');
      if (b && !b.disabled) b.click();
    }""")
    await dump(pg, 'clicked-pvp')
    # dismiss leftover cards
    for i in range(40):
        await pg.evaluate("""() => {
          for (const id of ['pvp-entry-go', 'btn-enter', 'name-go', 'name-ok', 'btn-name-ok']) {
            const el = document.getElementById(id);
            if (el && getComputedStyle(el).display !== 'none' && !el.disabled) el.click();
          }
          const inp = document.querySelector('#name-card input, #pvp-name, input#name');
          if (inp && !inp.value) {
            inp.value = 'TUTORIALSHOT';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }""")
        st = await pg.evaluate("() => ({ where: window.PFP?.pvp?.where, state: window.PFP?.game?.state })")
        if st.get('where') == 'harbor' or st.get('state') == 'playing':
            print('harbor after', i, st, flush=True)
            break
        await pg.wait_for_timeout(500)
    else:
        await dump(pg, 'still-not-harbor')
        await pg.screenshot(path=str(OUT / 'debug-enter.png'), timeout=60000)
        raise RuntimeError('did not enter harbor')
    await pg.evaluate("""() => { try { document.getElementById('pvp-entry-go')?.click(); } catch (e) {} }""")
    try:
        await pg.wait_for_function('window.__pfpHarborTut && typeof window.__pfpHarborTut.show === "function"', timeout=180000)
    except Exception as e:
        await dump(pg, 'tut-wait')
        # one last chance — dock may still be finishing
        ok = await pg.evaluate('() => !!(window.__pfpHarborTut && window.__pfpHarborTut.show)')
        if not ok:
            raise
        print('tut appeared after wait', flush=True)
    await pg.wait_for_timeout(1200)
    await dump(pg, 'ready')

async def show_tut(pg):
    await pg.evaluate("() => { try { window.__pfpHarborTut.show(); } catch (e) { console.warn(e); } }")
    await pg.wait_for_function("() => window.__pfpHarborTut.open && window.__pfpHarborTut.open()", timeout=20000)

async def go_step(pg, sid, freeze=True, wait_ms=1200):
    await pg.evaluate("""(sid) => {
      const t = window.__pfpHarborTut;
      const ids = typeof t.ids === 'function' ? t.ids() : t.ids;
      const i = ids.indexOf(sid);
      if (i < 0) throw new Error('no step ' + sid + ' in ' + JSON.stringify(ids));
      t.go(i);
    }""", sid)
    if freeze:
        try:
            await pg.wait_for_function("() => window.__pfpHarborTut.phase() === 'hold'", timeout=8000)
        except Exception:
            pass
        await pg.evaluate("() => { try { window.__pfpHarborTut.freeze(); } catch (e) {} }")
    await pg.wait_for_timeout(wait_ms)

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    shots = []
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=ARGS)
        ctx = await b.new_context(service_workers='block', viewport={'width': 1280, 'height': 800})
        await ctx.add_init_script(INIT)
        for key in OVERRIDE:
            await ctx.route('**' + key, route_overrides)
        await ctx.route('**/sw.js', route_overrides)
        pg_holder = {}
        pg = await ctx.new_page()
        pg.set_default_timeout(240000)
        pg.on('pageerror', lambda e: (errors.append(str(e)), print('PAGEERROR', e, flush=True)))
        pg.on('console', lambda m: print('CONSOLE', m.type, m.text[:240], flush=True) if m.type in ('error', 'warning') else None)
        url = LIVE + '/index.html?quality=low&casino=1&gpuwarm=0'
        print('goto', url, flush=True)
        await pg.goto(url, wait_until='domcontentloaded', timeout=180000)
        try:
            await enter_harbor(pg)
        except Exception as e:
            print('ENTER FAIL', e, flush=True)
            if errors:
                print('errors', '\n'.join(errors[-8:]), flush=True)
            await dump(pg, 'fail')
            try:
                await pg.screenshot(path=str(OUT / 'debug-enter.png'), timeout=60000)
            except Exception:
                pass
            raise

        info = await pg.evaluate("""() => ({
          where: PFP?.pvp?.where, state: PFP?.game?.state, tut: !!window.__pfpHarborTut,
        })""")
        print('entered', info, flush=True)
        await show_tut(pg)
        ids = await pg.evaluate("() => window.__pfpHarborTut.ids()")
        print('ids', ids, flush=True)

        async def snap(name, wait=0):
            if wait: await pg.wait_for_timeout(wait)
            path = OUT / name
            await pg.screenshot(path=str(path), timeout=120000, caret='initial')
            print('wrote', path, 'bytes', path.stat().st_size, flush=True)
            shots.append(str(path))

        for sid in ('casino', 'fish', 'market', 'antiques'):
            await go_step(pg, sid, freeze=True, wait_ms=1800)
            await snap(f'desktop-{sid}.png')

        await go_step(pg, 'inventory', freeze=True, wait_ms=400)
        await pg.evaluate("() => window.__pfpHarborTut.showInvHint()")
        await pg.wait_for_timeout(400)
        await snap('desktop-inventory-highlight.png')
        await pg.evaluate("() => window.__pfpHarborTut.openInv()")
        await pg.wait_for_timeout(700)
        await snap('desktop-inventory-panel.png')

        await go_step(pg, 'treasure', freeze=True, wait_ms=1000)
        await snap('desktop-treasure.png')

        await go_step(pg, 'canoe', freeze=False, wait_ms=200)
        try:
            await pg.wait_for_function("() => { const p = window.__pfpHarborTut.canoePhase(); return p === 'drop' || p === 'reboard'; }", timeout=15000)
        except Exception:
            await pg.evaluate("() => window.__pfpHarborTut.canoeTo && window.__pfpHarborTut.canoeTo('drop')")
            await pg.wait_for_timeout(800)
        await snap('desktop-canoe-shore.png', wait=400)
        try:
            await pg.wait_for_function("() => window.__pfpHarborTut.canoePhase() === 'back'", timeout=10000)
        except Exception:
            await pg.evaluate("() => window.__pfpHarborTut.canoeTo && window.__pfpHarborTut.canoeTo('back')")
            await pg.wait_for_timeout(800)
        await snap('desktop-canoe-return.png', wait=500)

        await b.close()
    print('DONE', json.dumps(shots), flush=True)

if __name__ == '__main__':
    asyncio.run(main())
