# [castle-upstairs] rampart stair top + spyglass path shots
# python3 tools/castle_upstairs_shots.py PORT OUTDIR TAG desktop|phone
import asyncio, sys, os, json
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
PORT, OUT, TAG, DEV = sys.argv[1:5]
os.makedirs(OUT, exist_ok=True)
VIEWS = [
  # top of rampart stair — stone landing into wall-walk
  ('stair_top', -410, 46.5, -38.5, -404, 42, -34.5, 58),
  # spyglass top-down (BANKSY floor review)
  ('spyglass', -400.5, 52, -36.5, -398, 42, -32.5, 55),
  # spyglass player eye level on the NE tower deck
  ('spyglass_eye', -399.0, 43.55, -33.8, -396.6, 43.1, -32.4, 58),
  # framed path stairs -> spyglass along north wall-walk
  ('spy_stair', -414, 47.5, -30.5, -397.5, 43.2, -32.8, 52),
]
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
    url = f'http://127.0.0.1:{PORT}/island.html?coast=1&shot&quality={q}'
    print('GOTO', url, flush=True)
    await pg.goto(url, wait_until='domcontentloaded', timeout=180000)
    await pg.wait_for_function('window.ISLAND && ISLAND.foot && ISLAND.camera', timeout=300000)
    print('ISLAND ready', flush=True)
    await pg.wait_for_timeout(4000)
    await pg.evaluate("""() => { try { ISLAND.foot.areas.update({x:-410,z:-40}, 0, true); } catch(e){} }""")
    await pg.wait_for_timeout(3000)
    built = await pg.evaluate("""() => ({ loaded: ISLAND.foot.areas?.loaded || [], hasFort: !!(ISLAND.scene?.getObjectByName?.('area_fort')) })""")
    print('BUILT', built, flush=True)
    meta = {'built': built, 'errs': [], 'probe': None}
    # deck probe at the known gap + spyglass
    meta['probe'] = await pg.evaluate("""() => {
      const f = ISLAND.foot, pts = [
        [-404,-34.75,'stair_top'],[-403.5,-34.75,'gap_E'],[-403,-34.75,'gap_E2'],
        [-402,-34.75,'land'],[-401.5,-34.5,'land_c'],[-404,-32.4,'wall_n'],
        [-400,-32.4,'wall_mid'],[-397.6,-32.4,'near_spy'],[-396.6,-32.6,'spy']
      ];
      return pts.map(([x,z,id]) => {
        const y = f.groundAt(x,z), d = f.areaDeckAt ? f.areaDeckAt(x,z) : null;
        const hit = f.hitCollider ? f.hitCollider(x,z,0.45) : null;
        return {id,x,z,y, deck:d, hit};
      });
    }""")
    print('PROBE', json.dumps(meta['probe']), flush=True)
    ONLY = os.environ.get('ONLY')
    for name, ex, ey, ez, lx, ly, lz, fov in VIEWS:
      if ONLY and name not in ONLY.split(','): continue
      r = await pg.evaluate("""([e,l,fov]) => {
        const cam = ISLAND.camera, c = ISLAND.controls;
        cam.fov = fov; cam.updateProjectionMatrix();
        cam.position.set(e[0], e[1], e[2]);
        if (c) { c.target.set(l[0], l[1], l[2]); c.update(); }
        cam.lookAt(l[0], l[1], l[2]);
        try { ISLAND.foot.areas.update({x:-410,z:-40}, ISLAND.t||0, false); } catch(err){}
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
    print('DONE', TAG, DEV, 'errs', len(errs), flush=True)
    await b.close()
asyncio.run(main())
