# [Timothy] PUMPFUN PIRATES material library: before / after shots of the plaza, docks, battery, hill street, hilltop fort + a ship close-up
# (local dev server :18960, one headless browser).  python3 tex_shots.py WORKTREE_DIRNAME OUTDIR desktop|phone PREFIX [extra query] [names...]
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT, OUT, DEV, PRE = sys.argv[1:5]; Q = sys.argv[5] if len(sys.argv) > 5 else ''; WANT = set(sys.argv[6:]); os.makedirs(OUT, exist_ok=True)
gy = lambda lz: 3.0 + max(0, -lz - 50) * 0.11          # Main Street walk height (foot.js coastH, town-local lz)
SHOTS = {  # name: frame ('t' = town-local lx/lz, 'w' = world x/z), cam (a, b, y), target (a, b, y), fov  -- absolute heights
  'plaza': ('t', (24, 6, 7.5), (22, -50, 5.5), 62),
  'plaza_close': ('t', (2, -36, 2.4), (-6, -52, 4.6), 58),
  'docks': ('t', (-20, -4, 7.0), (-75, 40, 0.5), 60),
  'battery': ('t', (138, 22, 27.0), (162, 46, 21.5), 60),
  'hill_up': ('t', (6, -54, 5.2), (6, -140, 13.0), 60),
  'hill_down': ('t', (9, -176, 1.9 + 3.0 + 126 * 0.11), (5, -90, -2.0 + 3.0 + 40 * 0.11), 55),
  'fort': ('w', (-382, -22, 45.0), (-406, -44, 38.0), 60),
  'ship_close': ('ship', (-13.0, -16.0, 6.5), (0.0, -4.0, 6.0), 55),   # ISLAND.ships[0]: a, b = metres to its right / ahead
  'junction': ('w', (-429.0, -99.0, 27.0), (-436.0, -80.0, 20.0), 62),        # BANKSY 9:55 PM 4-way intersection, framed like his shot
  'junction_wide': ('w', (-424.0, -106.0, 33.0), (-437.0, -80.0, 19.0), 66),
  'junction_close': ('w', (-431.0, -92.0, 22.2), (-436.5, -79.0, 20.0), 60),
}
CAM = """(async([c,t,fov])=>{ const CO = await import('./js/island/coast.js'); const I = ISLAND; let W = c[3] === 'w' ? (a, b) => [a, b] : CO.t2w;
  if (c[3] === 'ship') { const s0 = (I.ships || [])[0], o = s0 && (s0.isObject3D ? s0 : (s0.group || s0.mesh || s0.root || s0.obj || s0.model)); if (!o) return 'no ship ' + (s0 ? Object.keys(s0).join('/') : 'none');
    o.updateMatrixWorld(true); const v = new (o.position.constructor)(); W = (a, b) => { v.set(a, 0, b).applyQuaternion(o.getWorldQuaternion(new (o.quaternion.constructor)())); const p = o.getWorldPosition(new (o.position.constructor)()); return [p.x + v.x, p.z + v.z]; }; }
  const [cx, cz] = W(c[0], c[1]), [tx, tz] = W(t[0], t[1]);
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
    for name, (fr, c, t, fov) in SHOTS.items():
      if WANT and name not in WANT: continue
      c = [c[0], c[1], c[2], fr]; t = [t[0], t[1], t[2]]
      r0 = await pg.evaluate(CAM, [c, t, fov]); await pg.wait_for_timeout(3500)
      if isinstance(r0, str): print('cam', name, r0, flush=True)
      await pg.screenshot(timeout=120000, path=f'{OUT}/{PRE}_{DEV}_{name}.png'); print('shot', DEV, name, flush=True)
    out['lib'] = await pg.evaluate("(async()=>{ try { const L = await import('./js/island/libTex.js'); return { stats: L.LIB_STATS, area: L.LIB_AREA_STATS || null, on: L.LIB_U.uLibOn.value }; } catch (e) { return String(e); } })()")
    out['errors'] = errs[:12]; out['stats'] = await pg.evaluate('window.ISLAND_STATS ? { calls: ISLAND_STATS.calls, tris: ISLAND_STATS.triangles } : null')
    print('RESULT', json.dumps(out)); await b.close()
asyncio.run(main())
