# Cottage neighborhood verification shots (desktop overlook / lane / reverse + phone).
# Injects live terrain_get pieces so BANKSY's two Build Mode houses appear beside the new dressing.
import asyncio, json, os, time
from pathlib import Path
from playwright.async_api import async_playwright

ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage']
PORT = int(os.environ.get('COTTAGE_PORT', '8877'))
ROOT = Path('/workspace/post-cottages')
OUT = Path(os.environ.get('COTTAGE_OUT', '/workspace/post-cottages-shots'))
OUT.mkdir(parents=True, exist_ok=True)
TERRAIN = json.loads((ROOT / 'tools/cottages/terrain_pieces.json').read_text())

# Camera views matching BANKSY's staircase overlook + street-level / reverse.
# Eye near Trail-A / stair side looking over the two live houses + new cottages.
VIEWS = [
  # High vantage from Coliseum / upper Trail A — full crescent, both junctions, 4 cottages, well on green
  ('desktop_overlook', -425.0, 16.5, -108.0, -385.0, 9.5, -135.0, 48, False),
  # Eye-level looking down cottage_lane past porches + lanterns; well on side green
  ('desktop_lane_closeup', -386.0, 10.4, -147.0, -370.0, 9.2, -132.0, 55, False),
  # Reverse from east meadow / SE cottage looking back across lane + green + Trail A
  ('desktop_reverse_view', -350.0, 14.0, -134.0, -390.0, 9.2, -136.0, 50, False),
  # Phone framing
  ('phone_neighborhood', -420.0, 14.0, -112.0, -385.0, 9.2, -135.0, 55, True),
]


INIT = f"""
try {{
  localStorage.setItem('pfp_gfx_hint','1');
  localStorage.setItem('pfp_tut_seen','1');
  localStorage.setItem('pfp_tutorial_off','1');
  localStorage.setItem('pfp_terrain_v1', {json.dumps(json.dumps({**TERRAIN, 'rev': TERRAIN.get('rev', 79)}))});
  navigator.serviceWorker?.getRegistrations?.().then(rs => rs.forEach(r => r.unregister()));
}} catch (e) {{}}
"""

async def main():
  async with async_playwright() as p:
    browser = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    pid = None
    try:
      proc = getattr(browser, 'process', None) or getattr(getattr(browser, '_impl_obj', None), 'process', None)
      pid = proc.pid if proc else None
    except Exception:
      pid = None
    if pid is None:
      # fall back: newest chrome that is NOT the box desktop profile
      import subprocess
      out = subprocess.check_output(['bash','-lc',"pgrep -af 'google-chrome|chrome' | grep -v Fork-4 | grep -v crashpad | grep -v 'type=' | head -5"], text=True)
      print('CHROME_CANDIDATES', out, flush=True)
      for line in out.splitlines():
        if 'remote-debugging' in line or 'headless' in line or 'swiftshader' in line or 'playwright' in line.lower() or '--no-sandbox' in line:
          try: pid = int(line.split()[0]); break
          except: pass
    print('CHROME_PID', pid, flush=True)
    meta = {'errs': [], 'views': {}, 'pid': pid}
    try:
      for name, ex, ey, ez, lx, ly, lz, fov, phone in VIEWS:
        vp = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True) if phone \
             else dict(viewport={'width': 1600, 'height': 900})
        ctx = await browser.new_context(**vp, service_workers='block')
        # Allow terrain_get through; mute noisy third-party
        await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
        # Fulfill terrain_get with the exact live payload (so houses show even if network flakes)
        async def terrain_route(route):
          req = route.request
          if req.method == 'POST' and 'functions/v1/pvp' in req.url:
            try:
              body = req.post_data_json or {}
            except Exception:
              body = {}
            if body.get('action') == 'terrain_get':
              return await route.fulfill(status=200, content_type='application/json',
                body=json.dumps({'ok': True, 'owner': False, 'rev': TERRAIN.get('rev', 79),
                                 'cells': TERRAIN.get('cells') or {}, 'pieces': TERRAIN.get('pieces') or {},
                                 'paint': TERRAIN.get('paint') or {}}))
          return await route.continue_()
        await ctx.route('**/*supabase.co/**', terrain_route)
        await ctx.add_init_script(INIT)
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:240]))
        bust = int(time.time())
        url = f'http://127.0.0.1:{PORT}/island.html?coast=1&shot&quality=high&_={bust}'
        print('GOTO', name, url, flush=True)
        await pg.goto(url, wait_until='domcontentloaded', timeout=180000)
        await pg.wait_for_function('window.ISLAND && ISLAND.foot && ISLAND.camera', timeout=300000)
        # island.html is art-only — init terrainEdit so live Build Mode houses (terrain_get +id) spawn
        te_info = await pg.evaluate("""async () => {
          try {
            const m = await import('/js/island/terrainEdit.js?v=' + Date.now());
            const te = await m.initTerrainEdit({
              scene: ISLAND.scene, camera: ISLAND.camera, canvas: document.querySelector('canvas'),
              footRoot: ISLAND.foot.root, walker: { w: { x: -378, y: 8, z: -150 } }, touch: false, toast: () => {}
            });
            window.__TE = te;
            let n = 0;
            try { ISLAND.foot.root.traverse(o => { if (o.isInstancedMesh && /placed_house/.test(o.name||'')) n += o.count|0; }); } catch(e){}
            return { ok: true, owner: !!(te && te.owner), placedHouses: n, teKeys: te && Object.keys(te) };
          } catch (e) { return { ok: false, err: String(e).slice(0, 240) }; }
        }""")
        print('TE', name, te_info, flush=True)
        # Force areas near the cottage pocket to build
        await pg.evaluate("""() => { try { ISLAND.foot.areas.update({x:-378,z:-150}, 0, true); } catch(e){} }""")
        await pg.wait_for_timeout(2500)
        # Give Timothy's shared KTX2 lib time to bind (libAreaBuilt already re-tagged aMat)
        try:
          lib_on = await pg.evaluate("""async () => {
            try { const m = await import('/js/island/libTex.js'); 
              const t0 = performance.now();
              while (m.LIB_U.uLibOn.value < 0.5 && performance.now() - t0 < 12000) await new Promise(r => setTimeout(r, 200));
              return m.LIB_U.uLibOn.value;
            } catch (e) { return -1; }
          }""")
          print('LIB_ON', lib_on, flush=True)
        except Exception as e:
          print('LIB_WAIT', e, flush=True)
        await pg.wait_for_timeout(800)
        # Confirm live houses + cottage area present
        info = await pg.evaluate("""() => {
          const pieces = (window.ISLAND?.foot && (ISLAND.foot.terrainEdit?.PIECES || ISLAND.foot.TE?.PIECES)) || null;
          let housed = 0, cot = false, calls = 0, tris = 0;
          try {
            const r = ISLAND.renderer; if (r) { calls = r.info.render.calls; tris = r.info.render.triangles; }
          } catch(e){}
          try {
            ISLAND.foot.root?.traverse(o => { if (o.name && /area_cottages/.test(o.name)) cot = true; });
          } catch(e){}
          // placed props live under placeRoot / PIECES
          try {
            const TE = ISLAND.foot.TE || ISLAND.foot.terrainEdit || window.__TE;
            if (TE?.PIECES) for (const [id,v] of TE.PIECES) if (id[0]==='+' && (v.t|0)===0) housed++;
          } catch(e){}
          return { housed, cot, calls, tris, loaded: ISLAND.foot.areas?.loaded || [] };
        }""")
        print('INFO', name, info, flush=True)
        await pg.evaluate("""([e,l,fov]) => {
          const cam = ISLAND.camera, c = ISLAND.controls;
          cam.fov = fov; cam.updateProjectionMatrix();
          cam.position.set(e[0], e[1], e[2]);
          if (c) { c.target.set(l[0], l[1], l[2]); c.update(); }
          cam.lookAt(l[0], l[1], l[2]);
          try { ISLAND.foot.areas.update({x:l[0], z:l[2]}, ISLAND.t||0, false); } catch(err){}
          try { ISLAND.render?.(); } catch(err){}
        }""", [[ex, ey, ez], [lx, ly, lz], fov])
        await pg.wait_for_timeout(1500)
        # Re-sample draw calls after framing
        stats = await pg.evaluate("""() => {
          try { ISLAND.render?.(); } catch(e){}
          const r = ISLAND.renderer;
          return r ? { calls: r.info.render.calls, tris: r.info.render.triangles, frame: r.info.render.frame } : {};
        }""")
        path = str(OUT / f'{name}.png')
        await pg.screenshot(path=path, timeout=180000)
        print('SHOT', path, stats, flush=True)
        meta['views'][name] = {'path': path, 'info': info, 'stats': stats, 'errs': errs[:5]}
        meta['errs'].extend(errs)
        await ctx.close()
    finally:
      await browser.close()
      print('CLOSED', pid, flush=True)
    (OUT / 'meta.json').write_text(json.dumps(meta, indent=2))
    print('DONE', flush=True)

asyncio.run(main())
