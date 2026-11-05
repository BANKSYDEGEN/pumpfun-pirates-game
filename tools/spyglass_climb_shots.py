# [v276] spyglass climb + war-room headroom shots
# python3 tools/spyglass_climb_shots.py PORT OUTDIR TAG desktop|phone
import asyncio, sys, os, json
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
PORT, OUT, TAG, DEV = sys.argv[1:5]
os.makedirs(OUT, exist_ok=True)
VIEWS = [
  # yard looking at rampart stair mouth (entry open)
  ('stairs', -414, 38.2, -40.5, -410, 39.5, -34.75, 55),
  # top of rampart stair — stone landing into wall-walk
  ('landing', -410, 46.5, -38.5, -404, 42, -34.5, 58),
  # framed path stairs -> spyglass along north wall-walk
  ('climb', -414, 47.5, -30.5, -397.5, 43.2, -32.8, 52),
  # spyglass player eye level on the NE tower deck (using it)
  ('spyglass_use', -399.0, 43.55, -33.8, -396.6, 43.1, -32.4, 58),
  # walking up to war room table (from keep door)
  ('warroom_approach', -411.2, 37.8, -44.0, -403.0, 37.4, -44.0, 58),
  # camera while using the table (inside keep, looking at table — headroom check)
  ('warroom_table', -406.2, 37.7, -44.0, -403.0, 39.5, -44.0, 60),  # look UP to prove headroom
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
    await pg.wait_for_timeout(2000 if ONLY else 4000)
    await pg.evaluate("""() => { try { ISLAND.foot.areas.update({x:-410,z:-40}, 0, true); } catch(e){} }""")
    await pg.wait_for_timeout(1500 if ONLY else 3000)
    built = await pg.evaluate("""() => ({ loaded: ISLAND.foot.areas?.loaded || [], hasFort: !!(ISLAND.scene?.getObjectByName?.('area_fort')) })""")
    print('BUILT', built, flush=True)
    meta = {'built': built, 'errs': [], 'probe': None, 'climb': None, 'warroom': None}
    if not ONLY: meta['probe'] = await pg.evaluate("""() => {
      const f = ISLAND.foot, pts = [
        [-414,-38,'yard_S'],[-414,-36.2,'cheek_S'],[-414,-34.75,'stair'],[-404,-34.75,'stair_top'],
        [-403.5,-34.75,'gap_E'],[-401.5,-33.5,'land'],[-401.5,-32.4,'wall'],[-396.6,-32.6,'spy'],
        [-405.2,-44,'table_i'],[-403,-44,'table']
      ];
      return pts.map(([x,z,id]) => {
        const y = f.groundAt(x,z), d = f.areaDeckAt ? f.areaDeckAt(x,z) : null;
        const hit = f.hitCollider ? f.hitCollider(x,z,0.45) : null;
        return {id,x,z,y, deck:d, hit:!!hit};
      });
    }""")
    print('PROBE', json.dumps(meta['probe']), flush=True)
    # walk a few key segments with blocked()
    meta['climb'] = await pg.evaluate("""() => {
      const f = ISLAND.foot;
      const segs = [
        [-414,-38,-414,-34.75,'yard_to_stair'],
        [-414,-34.75,-404,-34.75,'up_stair'],
        [-404,-34.75,-401.5,-32.4,'top_to_wall'],
        [-401.5,-32.4,-396.6,-32.6,'wall_to_spy'],
        [-408.5,-44,-405.2,-44,'door_to_table']
      ];
      return segs.map(([ax,az,bx,bz,id]) => {
        const n = 20; let stuck=0, drops=0, prev=null;
        for (let i=0;i<=n;i++){
          const t=i/n, x=ax+(bx-ax)*t, z=az+(bz-az)*t, y=f.groundAt(x,z);
          if (prev && f.blocked(x,z,prev[0],prev[1])) stuck++;
          if (prev && y - prev[2] < -0.6) drops++;
          prev=[x,z,y];
        }
        return {id, stuck, drops, endY: f.groundAt(bx,bz), endDeck: f.areaDeckAt?.(bx,bz) ?? null};
      });
    }""")
    print('CLIMB', json.dumps(meta['climb']), flush=True)
    meta['warroom'] = await pg.evaluate("""() => {
      const table = {x:-403,z:-44}, hits=[];
      const root = ISLAND.scene?.getObjectByName?.('area_fort');
      if (!root) return {hits:[], note:'no fort'};
      const THREE = window.THREE || ISLAND.THREE;
      if (!THREE?.Box3) return {hits:[], note:'no THREE.Box3'};
      root.updateMatrixWorld(true);
      const box = new THREE.Box3();
      root.traverse(o => {
        if (!o.isMesh || o.userData?.outline) return;
        try { box.setFromObject(o); } catch(e) { return; }
        if (!(box.max.y > 37.2 && box.min.y < 42.5)) return;
        if (box.min.y > 40) return;
        if (box.max.x < table.x-2 || box.min.x > table.x+2) return;
        if (box.max.z < table.z-1.5 || box.min.z > table.z+1.5) return;
        const spanX = box.max.x - box.min.x, spanZ = box.max.z - box.min.z;
        if (spanX > 6 && spanZ > 6) hits.push({y0:+box.min.y.toFixed(2), y1:+box.max.y.toFixed(2), sx:+spanX.toFixed(1), sz:+spanZ.toFixed(1), name:o.name||o.parent?.name||'?'});
      });
      return {hits: hits.slice(0,12), n: hits.length};
    }""")
    print('WARROOM', json.dumps(meta['warroom']), flush=True)
    ONLY = os.environ.get('ONLY')
    for name, ex, ey, ez, lx, ly, lz, fov in VIEWS:
      if ONLY and name not in ONLY.split(','): continue
      r = await pg.evaluate("""([e,l,fov]) => {
        const cam = ISLAND.camera, c = ISLAND.controls;
        cam.fov = fov; cam.updateProjectionMatrix();
        cam.position.set(e[0], e[1], e[2]);
        if (c) { c.target.set(l[0], l[1], l[2]); c.update(); }
        cam.lookAt(l[0], l[1], l[2]);
        try { ISLAND.foot.areas.update({x:l[0],z:l[2]}, ISLAND.t||0, false); } catch(err){}
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
