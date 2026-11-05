# [v250] Walk-in shops shots: front + inside for Clothes/Pets/Ships/Upgrades/Crew/Sword/Musket/Squad Hall.
# python3 shops_inside_shots.py WORKTREE OUTDIR desktop|phone PREFIX [names...]
import asyncio, sys, json, os
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT, OUT, DEV, PRE = sys.argv[1:5]
WANT = set(sys.argv[5:]); os.makedirs(OUT, exist_ok=True)
Y = 2.73
gy = lambda lz: 3.0 + max(0, -lz - 50) * 0.11
SH = dict(clothes=(-49, 10), pets=(-38.5, 9), ships=(-10, 12), upgrades=(20.5, 11), crew=(32, 10))
SHOTS = {}
for k, (lx, w) in SH.items():
    SHOTS[f'{k}_front'] = ((lx, -21.0, Y + 2.4), (lx, -33, Y + 2.8), 58)
    # inside: mid-room looking out the open arch (Y = street + ~1.8)
    SHOTS[f'{k}_inside'] = ((lx, -36.2, Y + 1.8), (lx, -30.5, Y + 1.5), 70)
# sword / musket / squad (hill street)
SHOTS['sword_front'] = ((10.5, -127.5, 1.9), (-4.5, -134.5, 2.6), 58)
SHOTS['sword_inside'] = ((-4.0, -135.2, 1.7), (-10.5, -135.2, 1.5), 62)
SHOTS['musket_front'] = ((1.5, -127.5, 1.9), (16.5, -134.5, 2.6), 58)
SHOTS['musket_inside'] = ((16.0, -133.3, 1.7), (22.0, -133.3, 1.5), 62)
SHOTS['squad_front'] = ((3.0, -76.5, 1.9), (16, -76.5, 4.5), 70)
SHOTS['squad_inside'] = ((16.5, -76.5, 1.7), (24.0, -76.5, 1.5), 62)
HILL = {'sword_front','sword_inside','musket_front','musket_inside','squad_front','squad_inside'}
CAM = """(async([c,t,fov])=>{ const CO = await import('./js/island/coast.js'); const I = ISLAND; const [cx, cz] = CO.t2w(c[0], c[1]), [tx, tz] = CO.t2w(t[0], t[1]);
  I.camera.fov = fov; I.camera.updateProjectionMatrix(); I.camera.position.set(cx, c[2], cz); if (I.controls) { I.controls.target.set(tx, t[2], tz); I.controls.update(); } I.camera.lookAt(tx, t[2], tz); window.__lock = [cx, c[2], cz, tx, t[2], tz]; })"""
PROBE = """(()=>{ const FM = ISLAND.foot; const want = ['shop_clothes','shop_pets','shop_ships','shop_upgrades','shop_crew','sword_shop','musket_shop','squadhall'];
  const all = [...(FM.INTERACT||[])];
  try { const L = window.PFP?.dock?.layout; if (L?.interact) all.push(...L.interact); } catch(e){}
  // also scan harbor interact via island dock if present
  const hits = {};
  for (const q of all) if (want.includes(q.id) || want.includes(q.id?.replace?.(/^invshop_/,''))) hits[q.id] = {x:+q.x.toFixed(2), z:+q.z.toFixed(2), r:q.r, label:q.label};
  // convert known ones to town
  const CO = null;
  return hits;
})()"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    mob = DEV == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1600, 'height': 900})
    ctx = await b.new_context(**kw)
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    await pg.goto(f'http://127.0.0.1:18960/{WT}/island.html?coast=1&shot&quality={"low" if mob else "high"}')
    await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=300000)
    await pg.wait_for_timeout(4000)
    # wait for hill GLB door empties a bit
    await pg.wait_for_timeout(3500)
    probe = await pg.evaluate("""async () => {
      const CO = await import('./js/island/coast.js');
      const FM = await import('./js/island/foot.js');
      const want = ['shop_clothes','shop_pets','shop_ships','shop_upgrades','shop_crew','sword_shop','musket_shop','squadhall'];
      const hits = {};
      for (const q of (ISLAND.foot.INTERACT || [])) if (want.includes(q.id)) {
        const [lx, lz] = CO.w2t(q.x, q.z); hits[q.id] = {x:+q.x.toFixed(2), z:+q.z.toFixed(2), r:q.r, label:q.label, lx:+lx.toFixed(2), lz:+lz.toFixed(2)};
      }
      try {
        for (const sp of (FM.PLAZA_SHOPS_ON || [])) {
          const lz = sp.promptLz != null ? sp.promptLz : sp.lz + 3.8;
          const [x,z] = CO.t2w(sp.lx, lz);
          hits[sp.id] = {x:+x.toFixed(2), z:+z.toFixed(2), r:3.4, label:sp.label, lx:sp.lx, lz:+(+lz).toFixed(2), promptLz: sp.promptLz ?? null};
        }
      } catch(e) { hits._plazaErr = String(e); }
      for (const id of ['door_swords','door_muskets']) {
        const o = ISLAND.scene.getObjectByName(id);
        hits[id] = !!o;
      }
      return hits;
    }""")
    open(f'{OUT}/{PRE}_{DEV}_probe.json','w').write(json.dumps(probe, indent=2))
    print('PROBE', json.dumps(probe), flush=True)
    for name, (c, t, fov) in SHOTS.items():
      if WANT and name not in WANT: continue
      cc = list(c); tt = list(t)
      if name in HILL:
        cc = [c[0], c[1], gy(c[1]) + c[2]]; tt = [t[0], t[1], gy(t[1]) + t[2]]
      await pg.evaluate(CAM, [cc, tt, fov]); await pg.wait_for_timeout(3200)
      path = f'{OUT}/{PRE}_{name}_{DEV}.png'
      await pg.screenshot(timeout=120000, path=path); print('shot', DEV, name, flush=True)
    out = {'errors': errs[:12], 'stats': await pg.evaluate('window.ISLAND_STATS ? { calls: ISLAND_STATS.calls, tris: ISLAND_STATS.triangles } : null')}
    print('RESULT', json.dumps(out)); await b.close()
asyncio.run(main())
