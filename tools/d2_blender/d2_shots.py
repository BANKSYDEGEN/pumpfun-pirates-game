# [Timothy] D2 JUNGLE RUINS shots + per-pose phone/desktop stats + a feet probe on the Blender treads / temple floor (island.html?coast=1, one
# headless browser).  python3 d2_shots.py WORKTREE_DIRNAME OUTDIR desktop|phone PREFIX [extra query] [names...]   (PROBE=1: feet check)
# Fixed poses (foot world x, y, z): the Ruin Steps (west flight), the jungle trail from the trailhead, the two idol heads, Mossbeard's camp.
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT, OUT, DEV, PRE = sys.argv[1:5]; Q = sys.argv[5] if len(sys.argv) > 5 else ''; WANT = set(sys.argv[6:]); os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = {  # name: (cam x, y, z), (target x, y, z), fov
  'steps': ((61.0, 29.5, -362.0), (86.0, 38.5, -345.5), 60),
  'steps_e': ((165.5, 34.5, -302.5), (140.0, 44.0, -314.5), 60),
  'trail': ((-2.5, 28.6, -392.0), (20.0, 27.5, -418.0), 60),
  'idols': ((59.5, 28.0, -368.5), (69.5, 26.6, -357.0), 55),
  'camp': ((-6.0, 29.2, -379.5), (4.0, 26.6, -389.5), 58),
  'temple': ((45.0, 40.0, -418.0), (45.0, 31.0, -456.0), 62),
}
CAM = """(([c,t,fov])=>{ const I = ISLAND; I.camera.fov = fov; I.camera.updateProjectionMatrix(); I.camera.position.set(...c); if (I.controls) { I.controls.target.set(...t); I.controls.update(); } I.camera.lookAt(...t); })"""
FEET = """(async () => { const THREE = await import('three'), L = await (await fetch('tools/d2_blender/d2_layout.json')).json(), F = ISLAND.foot, scn = ISLAND.scene;
  const rc = new THREE.Raycaster(), dn = new THREE.Vector3(0, -1, 0), tgt = []; scn.traverse(o => { if (o.isMesh && /^d2_(temple|steps|merged)/.test(o.name)) tgt.push(o); });
  const probe = (x, z) => { const y = F.groundAt(x, z); rc.set(new THREE.Vector3(x, y + 0.6, z), dn); rc.far = 1.2; const h = rc.intersectObjects(tgt, false)[0]; return h ? h.point.y - y : null; };
  const R = {}; const st = (d) => { const v = d.map(q => q[0]); const ok = v.filter(q => Math.abs(q) <= 0.01).length; const w = [...d].sort((a, b) => Math.abs(b[0]) - Math.abs(a[0])).slice(0, 4).map(q => [+(q[0] * 100).toFixed(1), +q[1].toFixed(1), +q[2].toFixed(1)]);
    return { n: v.length, within1cm: ok, min: +(Math.min(...v) * 100).toFixed(2), max: +(Math.max(...v) * 100).toFixed(2), worst: w }; };
  L.steps.forEach((S, si) => { const d = []; for (const T of S.treads) for (const s of [-2.2, -1.1, 0, 1.1, 2.2]) for (const a of [-0.15, 0.15]) { const x = T.x + S.ux * a - S.uz * s, z = T.z + S.uz * a + S.ux * s, v = probe(x, z); if (v !== null) d.push([v, x, z]); }
    R['steps_' + 'we'[si]] = st(d); });
  const T = L.TEMPLE, d = []; for (let x = T.x0 + 2.5; x < T.x1 - 2; x += 1.7) for (let z = T.z0 + 7.5; z < T.z1 - 1; z += 1.7) { if (Math.abs(x - 45) < 3.4) continue; const v = probe(x, z); if (v !== null) d.push([v, x, z]); }
  R.temple_floor = st(d);
  R.meshes = tgt.length; return R; })()"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob = DEV == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1600, 'height': 900})
    ctx = await b.new_context(**kw); await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e))); pg.on('console', lambda m: errs.append(m.type + ' ' + m.text) if m.type == 'error' or (m.type == 'warning' and ('d2' in m.text or 'jungle' in m.text)) else None)
    await pg.goto(f'http://127.0.0.1:{os.environ.get('PFP_PORT', '18960')}/{WT}/island.html?coast=1&shot&quality={"low" if mob else "high"}&{Q}')
    await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=300000); await pg.wait_for_timeout(2500)
    out = {'stats': {}}
    for name, (c, t, fov) in SHOTS.items():
      if WANT and name not in WANT: continue
      await pg.evaluate(CAM, [c, t, fov]); await pg.wait_for_timeout(4500)
      await pg.screenshot(timeout=120000, path=f'{OUT}/{PRE}_{DEV}_{name}.png')
      out['stats'][name] = await pg.evaluate('window.ISLAND_STATS ? { calls: ISLAND_STATS.calls, tris: ISLAND_STATS.triangles } : null'); print('shot', DEV, name, out['stats'][name], flush=True)
    out['d2'] = await pg.evaluate("import('./js/island/d2Blender.js').then(m => m.D2_STATS)")
    out['loaded'] = await pg.evaluate("ISLAND.foot.areas.loaded")
    if os.environ.get('PROBE'): out['feet'] = await pg.evaluate(FEET)
    out['errors'] = [e for e in errs if '503' not in e][:12]
    print('RESULT', json.dumps(out)); await b.close()
asyncio.run(main())
