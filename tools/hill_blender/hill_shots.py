# [Timothy] PUMPFUN PIRATES hill street (Main Street): in-game shots + load errors + a street collider / feet probe on island.html?coast=1
# (local dev server :18960, one headless browser).  python3 hill_shots.py WORKTREE_DIRNAME OUTDIR desktop|phone PREFIX [extra query] [names...]
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT, OUT, DEV, PRE = sys.argv[1:5]; Q = sys.argv[5] if len(sys.argv) > 5 else ''; WANT = set(sys.argv[6:]); os.makedirs(OUT, exist_ok=True)
gy = lambda lz: 3.0 + max(0, -lz - 50) * 0.11          # Main Street walk height (foot.js coastH, town-local lz)
SHOTS = {  # name: (cam lx, lz, height over street), (target lx, lz, height over street), fov
  'street_up': ((6, -54, 2.2), (6, -140, 3.0), 60),
  'street_down_ref': ((9, -176, 1.9), (5, -90, -2.0), 55),          # framed like BANKSY's reference: down the street to the harbor
  'sword_shop': ((10.5, -127.5, 1.9), (-4.5, -134.5, 2.6), 58),
  'musket_shop': ((1.5, -127.5, 1.9), (16.5, -134.5, 2.6), 58),
  'weapon_pair': ((6, -118, 2.4), (6, -136, 2.4), 70),
  'right_r3': ((1.0, -98.5, 2.0), (16.5, -105, 2.6), 60),
  'right_r4_square': ((1.0, -108.5, 2.0), (16.5, -114.8, 2.0), 60),
  'rent_interior': ((6, -94, 1.9), (-8, -94, 1.6), 62),
  'top_view': ((6, -130, 70), (6, -129.9, 0), 70),
}
CAM = """(async([c,t,fov])=>{ const CO = await import('./js/island/coast.js'); const I = ISLAND; const [cx, cz] = CO.t2w(c[0], c[1]), [tx, tz] = CO.t2w(t[0], t[1]);
  I.camera.fov = fov; I.camera.updateProjectionMatrix(); I.camera.position.set(cx, c[2], cz); if (I.controls) { I.controls.target.set(tx, t[2], tz); I.controls.update(); } I.camera.lookAt(tx, t[2], tz); window.__lock = [cx, c[2], cz, tx, t[2], tz]; })"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    mob = DEV == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1600, 'height': 900})
    ctx = await b.new_context(**kw)
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e))); pg.on('console', lambda m: errs.append(m.type + ' ' + m.text) if m.type == 'error' or (m.type == 'warning' and ('hill' in m.text or 'plaza' in m.text)) else None)
    await pg.goto(f'http://127.0.0.1:18960/{WT}/island.html?coast=1&shot&quality={"low" if mob else "high"}&{Q}')
    await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=300000); await pg.wait_for_timeout(3000)
    out = {'hill': await pg.evaluate("""(()=>{ let s = null; ISLAND.foot.root.traverse(o => { if (o.name === 'hill_street') s = { n: o.children.length, tris: o.userData.tris }; });
      const d = ['door_swords', 'door_muskets', 'sign_swords', 'sign_muskets'].map(n => [n, !!ISLAND.scene.getObjectByName(n)]); return { s, d }; })()""")}
    for name, (c, t, fov) in SHOTS.items():
      if WANT and name not in WANT: continue
      c = [c[0], c[1], gy(c[1]) + c[2]]; t = [t[0], t[1], gy(t[1]) + t[2]]
      await pg.evaluate(CAM, [c, t, fov]); await pg.wait_for_timeout(3500)
      await pg.screenshot(timeout=120000, path=f'{OUT}/{PRE}_{DEV}_{name}.png'); print('shot', DEV, name, flush=True)
    out['errors'] = errs[:12]; out['stats'] = await pg.evaluate('window.ISLAND_STATS ? { calls: ISLAND_STATS.calls, tris: ISLAND_STATS.triangles } : null')
    print('RESULT', json.dumps(out)); await b.close()
asyncio.run(main())
