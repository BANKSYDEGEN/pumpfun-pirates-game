# [Timothy] PUMPFUN PIRATES material library: shots in the LIVE harbor (index.html -> PvP harbor on foot), where the ships are moored and
# BANKSY's screenshots come from. Own camera rendered straight into the game's renderer (no HUD). One headless browser, local dev server :18960.
#   python3 harbor_shots.py WORKTREE_DIRNAME OUTDIR desktop|phone PREFIX [names...]
# Shot frames: 't' = town-local (coast.js t2w), 'w' = island world, 'ship' = relative to the moored ship nearest the player (a, b = metres
# right / ahead of the ship's bow axis, y absolute over the water).
import asyncio, sys, json, os, base64
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--renderer-process-limit=1']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
INIT = "localStorage.setItem('pfp_name','TEX_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_tutorial_off','1');localStorage.setItem('pfp_gfx_hint','1')"
WT, OUT, DEV, PRE = sys.argv[1:5]; WANT = set(sys.argv[5:]); os.makedirs(OUT, exist_ok=True)
SHOTS = {
  # BANKSY 9:55 PM "improve this 4 way intersection": the top end of the hill street (town gate, trail A + the fort ramp), framed like his shot
  'junction': ('w', (-429.0, -99.0, 27.0), (-436.0, -80.0, 20.0), 62),
  'junction_wide': ('w', (-424.0, -106.0, 33.0), (-437.0, -80.0, 19.0), 66),
  'junction_top': ('w', (-436.0, -88.0, 75.0), (-436.0, -87.9, 20.0), 60),
  'ship_close': ('ship', (-9.0, -20.0, 5.5), (2.0, -6.0, 5.0), 55),
}
CAM = """async ([fr, c, t, fov]) => { const THREE = await import('three'); const CO = await import('./js/island/coast.js');
  const root = PFP.scene.getObjectByName('onfoot_world'), fg = root && root.children[0]; if (!fg) return { err: 'no onfoot_world' }; fg.updateMatrixWorld(true);
  let P, Q;
  if (fr === 'ship') { let best = null, bd = 1e9; const wp = new THREE.Vector3(), px = PFP.player.x ?? 0, pz = PFP.player.z ?? 0;
    PFP.scene.traverse(o => { if (o.userData && (o.userData.ship || o.userData.isShip || /ship/i.test(o.name)) && o.parent === PFP.scene) { o.getWorldPosition(wp); const d = Math.hypot(wp.x - px, wp.z - pz); if (d < bd) { bd = d; best = o; } } });
    if (!best) return { err: 'no ship' }; best.getWorldPosition(wp); const yw = best.rotation.y, f = [Math.sin(yw), Math.cos(yw)], r = [Math.cos(yw), -Math.sin(yw)];
    const at = (a) => new THREE.Vector3(wp.x + r[0] * a[0] + f[0] * a[1], a[2], wp.z + r[1] * a[0] + f[1] * a[1]); P = at(c); Q = at(t); }
  else { const W = fr === 'w' ? (a, b) => [a, b] : CO.t2w; const [cx, cz] = W(c[0], c[1]), [tx, tz] = W(t[0], t[1]);
    P = fg.localToWorld(new THREE.Vector3(cx, c[2], cz)); Q = fg.localToWorld(new THREE.Vector3(tx, t[2], tz)); }
  const R = PFP.renderer, cam = new THREE.PerspectiveCamera(fov, R.domElement.width / R.domElement.height, 0.1, 2000); cam.position.copy(P); cam.lookAt(Q); cam.updateMatrixWorld(true);
  for (let i = 0; i < 3; i++) R.render(PFP.scene, cam); return { url: R.domElement.toDataURL('image/png'), P: P.toArray().map(v => +v.toFixed(1)) }; }"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    mob = DEV == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1600, 'height': 900})
    ctx = await b.new_context(**kw, service_workers='block')
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.add_init_script(INIT); pg = await ctx.new_page(); pg.set_default_timeout(600000); errs = []
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e))); pg.on('console', lambda m: errs.append(m.type + ' ' + m.text) if m.type == 'error' else None)
    await pg.goto(f'http://127.0.0.1:18960/{WT}/index.html?quality={"low" if mob else "high"}', wait_until='domcontentloaded')
    await pg.wait_for_function("document.getElementById('loading').classList.contains('hidden')", timeout=600000)
    await pg.evaluate("document.getElementById('btn-pvp').click()"); await pg.wait_for_function("window.PFP && PFP.dock && PFP.dock.on && PFP.player", timeout=600000)
    await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(12000)
    out = {}
    for name, (fr, c, t, fov) in SHOTS.items():
      if WANT and name not in WANT: continue
      r = await pg.evaluate(CAM, [fr, list(c), list(t), fov]); await pg.wait_for_timeout(2500); r = await pg.evaluate(CAM, [fr, list(c), list(t), fov])
      if 'url' in r: open(f'{OUT}/{PRE}_{DEV}_{name}.png', 'wb').write(base64.b64decode(r['url'].split(',')[1]))
      out[name] = {k: v for k, v in r.items() if k != 'url'}; print('shot', DEV, name, out[name], flush=True)
    if os.environ.get('PROBE'): out['probe'] = await pg.evaluate("(()=>{ const r = { pfp: Object.keys(PFP).slice(0, 80), top: PFP.scene.children.map(o => (o.name || o.type) + ':' + o.children.length).slice(0, 60), player: [PFP.player.x, PFP.player.z] }; return r; })()")
    out['lib'] = await pg.evaluate("(async()=>{ try { const L = await import('./js/island/libTex.js'); return { stats: L.LIB_STATS, area: L.LIB_AREA_STATS || null, on: L.LIB_U.uLibOn.value }; } catch (e) { return String(e).slice(0, 80); } })()")
    out['stats'] = await pg.evaluate("(()=>{ const i = PFP.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, tex: i.memory.textures, geo: i.memory.geometries }; })()")
    out['errors'] = [e for e in errs if '503' not in e][:12]
    print('RESULT', json.dumps(out)); await b.close()
asyncio.run(main())
