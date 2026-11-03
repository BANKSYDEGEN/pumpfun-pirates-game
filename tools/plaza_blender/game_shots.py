# [Timothy] PUMPFUN PIRATES plaza shops: in-game shots / FPS / collider debug + walk test on island.html?coast=1 (local dev server :18960).
#   python3 game_shots.py WORKTREE_DIRNAME OUTDIR desktop|phone MODE [extra query] [names...]
#   MODE: shots | fps | colliders | walk
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT, OUT, DEV, MODE = sys.argv[1:5]; Q = sys.argv[5] if len(sys.argv) > 5 else ''; WANT = set(sys.argv[6:]); os.makedirs(OUT, exist_ok=True)
Y = 2.73   # street level
SH = dict(clothes=(-49, 10), pets=(-38.5, 9), ships=(-10, 12), upgrades=(20.5, 11), crew=(32, 10))
SHOTS = {'hero_street': ((-57, -21.5, Y + 2.6), (25, -31, Y + 4.5), 62), 'hero_street_east': ((44, -20.5, Y + 2.6), (-20, -31.5, Y + 4.5), 62),
         'arrival': ((6, 36, 5.2), (6, -30, 5), 62),
         # docks (BANKSY "blender the plaza and docks"): arrival from the berths' approach lane, one jetty up close, the boardwalk -> street transition
         'dock_arrival': ((-20, 92, 14), (-30, 10, 2), 60), 'dock_jetty': ((-54.5, 30, 4.9), (-46, 46, 2.6), 60),
         'dock_plaque': ((-46.5, 20.5, 4.4), (-50.6, 17, 4.3), 50), 'dock_transition': ((-70, -6, 5.0), (-38, 6, 2.2), 62),
         'front_house_e': ((77.9, -21.0, Y + 2.4), (77.9, -33, Y + 3.4), 62),
         'dock_pilings': ((-35, 12, 1.0), (-46, 24, 1.2), 62)}
for k, (lx, w) in SH.items():
    SHOTS[f'front_{k}'] = ((lx, -21.0, Y + 2.4), (lx, -33, Y + 2.6), 58)
    SHOTS[f'sign_{k}'] = ((lx + w / 2 + 3.2, -23.6, Y + 3.0), (lx + w / 2 - 0.45, -29.6, Y + 4.4), 50)
SHOTS.update({'close_mannequins': ((-49, -25.4, Y + 1.9), (-49, -34.5, Y + 1.6), 46), 'close_birdcage': ((-39.2, -25.6, Y + 2.5), (-39.4, -34.4, Y + 2.7), 40),
              'close_modelships': ((-10, -25.4, Y + 2.3), (-10, -35, Y + 1.5), 48)})
CAM = """(async([c,t,fov])=>{ const CO = await import('./js/island/coast.js'); const I = ISLAND; const [cx, cz] = CO.t2w(c[0], c[1]), [tx, tz] = CO.t2w(t[0], t[1]);
  I.camera.fov = fov; I.camera.updateProjectionMatrix(); I.camera.position.set(cx, c[2], cz); if (I.controls) { I.controls.target.set(tx, t[2], tz); I.controls.update(); } I.camera.lookAt(tx, t[2], tz); window.__lock = [cx, c[2], cz, tx, t[2], tz]; })"""
WALK = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'walk_test.js')).read()
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    mob = DEV == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1600, 'height': 900})
    ctx = await b.new_context(**kw)
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') and 'plaza' in m.text else None)
    await pg.goto(f'http://127.0.0.1:18960/{WT}/island.html?coast=1&shot&quality={"low" if mob else "high"}&{Q}')
    await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=300000); await pg.wait_for_timeout(3000)
    info = await pg.evaluate("""(()=>{ let s = null; ISLAND.foot.root.traverse(o => { if (o.name === 'plaza_v2_shops') s = { lods: o.children.length, tris: o.userData.tris }; }); return s; })()""")
    out = {'shops_glb': info}
    if MODE == 'shots':
      for name, (c, t, fov) in SHOTS.items():
        if WANT and name not in WANT: continue
        await pg.evaluate(CAM, [list(c), list(t), fov]); await pg.wait_for_timeout(3500)
        await pg.screenshot(timeout=120000, path=f'{OUT}/{DEV}_{name}.png'); print('shot', DEV, name, flush=True)
    if MODE == 'fps':
      res = {}
      for name in (WANT or ['hero_street', 'front_clothes']):
        c, t, fov = SHOTS[name]; await pg.evaluate(CAM, [list(c), list(t), fov]); await pg.wait_for_timeout(2500)
        res[name] = await pg.evaluate("""(async()=>{ let n = 0, t0 = performance.now(); await new Promise(r => { const f = () => { n++; if (performance.now() - t0 < 8000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
          const s = window.ISLAND_STATS || {}; return { fps: +(n * 1000 / (performance.now() - t0)).toFixed(2), calls: s.calls, tris: s.triangles }; })()""")
      out['fps'] = res
    if MODE in ('colliders', 'walk'):
      out['walk'] = await pg.evaluate(WALK, MODE)
      if MODE == 'colliders':
        for name, (c, t, fov) in {'colliders_top_west': ((-46, -27, 46), (-46, -26.9, 0), 50), 'colliders_top_east': ((12, -27, 52), (12, -26.9, 0), 50), 'colliders_street': ((-58, -19, Y + 5), (-25, -33, Y + 1), 60)}.items():
          await pg.evaluate(CAM, [list(c), list(t), fov]); await pg.wait_for_timeout(3000); await pg.screenshot(timeout=120000, path=f'{OUT}/{DEV}_{name}.png'); print('shot', name, flush=True)
    out['errors'] = errs[:8]; out['stats'] = await pg.evaluate('window.ISLAND_STATS ? { calls: ISLAND_STATS.calls, tris: ISLAND_STATS.triangles } : null')
    print('RESULT', json.dumps(out)); await b.close()
asyncio.run(main())
