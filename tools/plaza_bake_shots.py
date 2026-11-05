# [hilltop] top-of-hill shots via island.html free-cam (fast).
# python3 castle_redo_shots.py PORT OUTDIR TAG desktop|phone
import asyncio, sys, os, math, json
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
PORT, OUT, TAG, DEV = sys.argv[1:5]
os.makedirs(OUT, exist_ok=True)
# Camera: (name, eye_x, eye_y, eye_z, look_x, look_y, look_z, fov)
# Fort centre (-408,-44) y36, gate west X0=-421, keep (-403,-44), wallTop 42
VIEWS = [
  ('from_street', -476, 27, -84, -420, 26, -76, 58),
  ('plaza', -447, 28, -84, -414, 19.5, -84, 62),
  ('plaza_top', -420.5, 62, -100, -420.5, 20, -84, 55),
  ('fort_overview', -490, 75, -150, -418, 28, -70, 50),
  ('keep_door', -416, 38.3, -44, -408, 38, -44, 60),
  ('spy_stair', -414, 47.5, -30.5, -397.5, 43.2, -32.8, 52),   # [plaza-bake] along N wall-walk: rampart stair -> landing -> NE fort_spyglass
  ('flowers_fort', -428.5, 24.5, -76, -434, 23, -63, 55),
  ('flowers_close', -429.5, 27, -78, -437.5, 21.5, -71, 50),
  ('ford', -396, 15, -120, -408.6, 6, -131, 55),
  ('ford_wide', -380, 40, -100, -410, 6, -128, 55),
]
if os.environ.get('EXTRA'): VIEWS += [tuple(v) for v in json.loads(os.environ['EXTRA'])]   # ad-hoc camera tries: EXTRA='[["name",ex,ey,ez,lx,ly,lz,fov]]'
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    mob = DEV == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1600, 'height': 900})
    ctx = await b.new_context(**kw)
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.add_init_script("try{localStorage.setItem('pfp_gfx_hint','1');localStorage.setItem('pfp_tut_seen','1')}catch(e){}")
    pg = await ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)[:240]))
    q = 'low' if mob else 'high'
    url = f'http://127.0.0.1:{PORT}/island.html?coast=1&shot&quality={q}' + os.environ.get('XQS', '')
    print('GOTO', url, flush=True)
    await pg.goto(url, wait_until='domcontentloaded', timeout=180000)
    await pg.wait_for_function('window.ISLAND && ISLAND.foot && ISLAND.camera', timeout=300000)
    print('ISLAND ready', flush=True)
    await pg.wait_for_timeout(4000)
    await pg.evaluate("""() => { try { ISLAND.foot.areas.update({x:-425,z:-80}, 0, true); } catch(e){} }""")
    await pg.wait_for_timeout(3000)
    built = await pg.evaluate("""() => ({ loaded: ISLAND.foot.areas?.loaded || [], hasFort: !!(ISLAND.foot.root||ISLAND.scene)?.getObjectByName?.('area_fort') || !!(ISLAND.scene?.getObjectByName?.('area_fort')), names: (ISLAND.foot.areas&&ISLAND.foot.areas.loaded)||[] })""")
    print('BUILT', built, flush=True)
    meta = {'built': built, 'errs': []}
    ONLY = os.environ.get('ONLY')
    meta['rb'] = await pg.evaluate("""async () => { try { const m = await import('./js/island/areas/hillRound.js'); return m.RB_STATS || null; } catch(e) { return String(e); } }""")
    print('RB', meta['rb'], flush=True)
    for name, ex, ey, ez, lx, ly, lz, fov in VIEWS:
      if ONLY and name not in ONLY.split(','): continue
      r = await pg.evaluate("""([e,l,fov]) => {
        const cam = ISLAND.camera, c = ISLAND.controls;
        cam.fov = fov; cam.updateProjectionMatrix();
        cam.position.set(e[0], e[1], e[2]);
        if (c) { c.target.set(l[0], l[1], l[2]); c.update(); }
        cam.lookAt(l[0], l[1], l[2]);
        window.__lock = [e[0],e[1],e[2], l[0],l[1],l[2]];
        try { ISLAND.foot.areas.update({x:-425,z:-80}, ISLAND.t||0, false); } catch(err){}
        return {eye:e, look:l, fov};
      }""", [[ex,ey,ez],[lx,ly,lz], fov])
      await pg.wait_for_timeout(700)
      path = f'{OUT}/{TAG}_{DEV}_{name}.png'
      await pg.screenshot(path=path, timeout=180000)
      meta[name] = r
      print('SHOT', path, flush=True)
    meta['interact'] = await pg.evaluate("""() => {
      const hits = {};
      for (const q of (ISLAND.foot.INTERACT || [])) if (/^fort_/.test(q.id||'')) hits[q.id] = {x:+q.x.toFixed(2), z:+q.z.toFixed(2), r:q.r, label:q.label};
      return hits;
    }""")
    meta['errs'] = errs[:10]
    json.dump(meta, open(f'{OUT}/{TAG}_{DEV}_meta.json','w'), indent=1)
    print('INTERACT', json.dumps(meta['interact']), flush=True)
    print('DONE', TAG, DEV, 'errs', len(errs), flush=True)
    await b.close()
asyncio.run(main())
