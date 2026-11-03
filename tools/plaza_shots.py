# PUMPFUN PIRATES plaza blockout shots: island.html?coast=1 (on-foot island viewer, local dev server), free camera
# usage: python3 plaza_shots.py OUTDIR "extra=query" desktop|phone [names...]
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
OUT, Q, DEV = sys.argv[1], sys.argv[2], sys.argv[3]; WANT = set(sys.argv[4:]); os.makedirs(OUT, exist_ok=True)
# town-local camera (lx, lz, height) -> look at (lx, lz, height); fov
SHOTS = {
  'top':      ((-38, 2, 180), (-38, 3, 0), 50),
  'arrival':  ((6, 36, 5.2), (6, -30, 5), 62),
  'hero_street': ((-52, -25.5, 3.4), (30, -12, 5.5), 62),
  'street_shops': ((60, -18, 3.6), (-20, -30, 4.2), 60),
  'dock':     ((-74, 12, 6.5), (-57, -3, 2.7), 55),
  'dock_top': ((-59, -4, 34), (-59, -3.9, 0), 45),
  'jetty_root': ((14, 12, 4), (2, -6, 2.6), 60),
  'boardwalk_v2': ((-172, 4.5, 5.2), (-60, 2.5, 3.4), 58),
  'context':  ((40, 260, 110), (-10, -60, 0), 55),
}
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    mob = DEV == 'phone'
    kw = dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width':1600,'height':900})
    ctx = await b.new_context(**kw)
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(f'http://127.0.0.1:18960/timothy-plaza/island.html?coast=1&shot&quality={"low" if mob else "high"}&{Q}')
    await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=240000); await pg.wait_for_timeout(3000)
    for name, (c, t, fov) in SHOTS.items():
      if WANT and name not in WANT: continue
      await pg.evaluate(f"""(async()=>{{ const CO = await import('./js/island/coast.js'); const I = ISLAND; const [cx, cz] = CO.t2w({c[0]}, {c[1]}), [tx, tz] = CO.t2w({t[0]}, {t[1]});
        I.camera.fov = {fov}; I.camera.updateProjectionMatrix(); I.camera.position.set(cx, {c[2]}, cz); if (I.controls) {{ I.controls.target.set(tx, {t[2]}, tz); I.controls.update(); }} I.camera.lookAt(tx, {t[2]}, tz); window.__lock = [cx, {c[2]}, cz, tx, {t[2]}, tz]; }})()""")
      await pg.wait_for_timeout(3500)
      await pg.screenshot(timeout=120000, path=f'{OUT}/{DEV}_{name}.png'); print('shot', DEV, name, flush=True)
      if name == 'top':   # label positions for the annotated plan (projected town-local points)
        labs = await pg.evaluate("""(async()=>{ const CO = await import('./js/island/coast.js'), PV = await import('./js/island/plazaTown.js'), I = ISLAND, out = [];
          const V = I.camera.position.constructor; const put = (t, lx, lz) => { const [x, z] = CO.t2w(lx, lz), v = new V(x, 3, z).project(I.camera); out.push([t, (v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]); };
          PV.STOREFRONTS.forEach(s => put(s.name, s.lx, -38)); PV.HALLS.forEach(h => put(h.trending ? 'HALL 2: $HQ $RETARDIO + TRENDING' : 'HALL: $SUNK $AHOY $PUMP', h.lx, h.trending ? -43 : -38));
          put('MAIN STREET', 6, -50); put('MARKET STREET (along the harbor)', -20, -24); put('STALLS', -34, -16); put('STALLS', 38, -16); put('STORM HUNT', -10, -11); put('ARENA', 22, -11);
          put('EXCHANGE', 62, -26); put('TAVERN', 70, -38); put('BOARDWALK lx -176..100 (west part slopes 2.95 -> 2.75 m)', -110, 4); PV.BERTHS.forEach(b => put(b.id, b.lx, b.lz)); PV.JETTIES.forEach(j => put(j.id, j.lx, 58));
          put('APPROACH LANE (open water from lz 69)', -38, 74); put('old piers P3/P4 (art only)', -240, 30);
          return out; })()""")
        open(f'{OUT}/{DEV}_top_labels.json', 'w').write(json.dumps(labs))
    print(json.dumps({'calls': await pg.evaluate('window.ISLAND_STATS && ISLAND_STATS.calls'), 'tris': await pg.evaluate('window.ISLAND_STATS && ISLAND_STATS.triangles'), 'errors': errs[:6]}))
    await b.close()
asyncio.run(main())
