# PUMPFUN PIRATES on-foot physics, in the real game (index.html -> harbor -> dock -> ashore), Supabase + DexScreener blocked.
# usage: WT=raul-foot-physics python3 foot_physics_game.py OUTDIR desktop|phone scen1,scen2,...   scenarios: cliff wade swim lake climb jump cannon beach
# each scenario: put your pirate somewhere (walker.enter), lock the camera side-on, hold W for a while, grab frames + per-frame telemetry
import asyncio, sys, json, os, math; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT=os.environ.get('WT','raul-foot-physics'); OUT, DEV, SC = sys.argv[1], sys.argv[2], sys.argv[3].split(','); os.makedirs(OUT, exist_ok=True)
HUDOFF='body>*:not(canvas){visibility:hidden!important}'
# name: start (town lx, lz), heading toward (lx, lz), hold W seconds, frames, camera (yaw offset from heading, pitch, dist), run?
S = {
  'cliff':  dict(a=(30, -362), b=(30, -340), hold=2.4, n=5, cam=(2.9, 0.3, 15), run=False),
  'wade':   dict(a=(-292, -48), b=(-200, -48), hold=4.5, n=3, cam=(1.3, 0.3, 8), run=False),
  'swim':   dict(a=(-268, -50), b=(-200, -50), hold=5.0, n=3, cam=(1.2, 0.35, 8), run=False),
  'lake':   dict(foot=True, hold=5.0, n=3, cam=(1.3, 0.3, 8), run=False),
  'climb':  dict(a=(-210, -51.5), b=(-210, -40), hold=3.0, n=4, cam=(1.5, 0.25, 7), run=False),
  'hop':    dict(a=(-236, -50), b=(-200, -50), hold=0.6, n=5, cam=(1.45, 0.3, 4.5), run=False, hop=True),   # [swim-anim] surface kick (deep end)
  'swimC':  dict(a=(-240, -56), b=(-200, -56), hold=1.0, n=4, cam=(1.0, 0.5, 4.2), run=False),           # [swim-anim] close-up crawl, then tread (end)
  'climbC': dict(a=(-210, -51.5), b=(-210, -40), hold=0.75, n=6, cam=(1.9, 0.3, 4.8), run=False, until='climb'),         # [swim-anim] close-up pull-up
  'jump':   dict(a=(-220.5, -46), b=(-240, -46), hold=2.4, n=7, cam=(1.57, 0.12, 9), run=False),
  'cannon': dict(a=(116, 0), b=(140, 0), hold=7.0, n=3, cam=(1.2, 0.35, 9), run=True, then=((180, 12), (166, 30))),
  'edge':   dict(a=(183, 8), b=(200, 8), hold=2.0, n=1, cam=(1.3, 0.4, 9), run=False, then=((176, -1), (176, -9))),
  'beach':  dict(a=(-170, -20), b=(-60, -20), hold=6.0, n=2, cam=(1.4, 0.3, 8), run=False, mound=True),
}
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob = DEV != 'desktop'
    kw = dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width':800,'height':450})
    ctx = await b.new_context(**kw)
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.add_init_script("localStorage.setItem('pfp_name','FOOT_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_gfx_hint','1')")
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGE '+str(e)))
    pg.on('console', lambda m: errs.append(m.type+': '+m.text[:160]) if m.type=='error' and 'Failed to load resource' not in m.text else None); R = {}
    await pg.goto(f'http://127.0.0.1:{os.environ.get("PORT", "18960")}/{WT}/index.html' + os.environ.get('Q', '')); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=240000); await pg.wait_for_timeout(2000)
    await (pg.tap('#btn-pvp') if mob else pg.evaluate("document.getElementById('btn-pvp').click()"))
    await pg.wait_for_function("PFP.dock && PFP.dock.on", timeout=300000); await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(3000)
    await pg.evaluate("(()=>{PFP.game.stormOverride=0;PFP.game.storm=0;const d=PFP.dock; for (const b of d.layout.berths) { d.dockAt(b.id); if (d.docking.mode !== 'sea') break; } })()")
    await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=600000)
    await pg.evaluate("PFP.dock.goAshore()"); await pg.wait_for_function('PFP.dock.onFoot', timeout=600000); await pg.wait_for_timeout(1500)
    await pg.add_style_tag(content=HUDOFF)
    # deterministic stepping: walker + crew updated at a fixed 1/30 s inside one evaluate (no render), frames rendered between segments
    if os.environ.get('FREEZE'):   # [swim-anim] the game loop stops moving your pirate + crew: only __sim does (frames are exact sim times)
      await pg.evaluate("(()=>{ const d = PFP.dock, wk = d.walker, fl = d.followers; wk.__u = wk.update; wk.update = () => {}; if (fl) { fl.__u = fl.update; fl.update = () => {}; } })()")
    await pg.evaluate("""(()=>{ const d = PFP.dock, w = d.walker.w, cam = PFP.camera || null; window.__T = [];
      window.__sim = (sec, jx, jy, yawFn) => { const n = Math.round(sec * 30); for (let i = 0; i < n; i++) { if (yawFn) yawFn(); w.joy.on = jx !== 0 || jy !== 0; w.joy.x = jx; w.joy.y = jy;
          (d.walker.__u || d.walker.update)(1 / 30); const fl = d.followers; if (fl) (fl.__u || fl.update)(1 / 30, d.walker.world ? undefined : undefined);
          const W = d.world, B = w.body || {}, g = W.ground(w.x, w.z), s = W.water ? W.water(w.x, w.z) : null;
          const crew = (d.followers?.list || []).filter(c => c.p.object.visible).map(c => c.body ? (c.body.swim ? 'S' : c.body.air ? 'A' : c.body.wade > 0.15 ? 'W' : 'G') : 'G').join('');
          window.__T.push([+w.x.toFixed(2), +w.z.toFixed(2), +w.y.toFixed(3), +g.toFixed(3), s === null ? null : +s.toFixed(2), B.swim ? 1 : 0, B.air ? 1 : 0, w.pose || '', +w.speed.toFixed(2), crew]); }
        w.joy.on = false; w.joy.x = w.joy.y = 0; return window.__T.length; }; })()""")
    for name in SC:
      s = S[name]; spec = json.dumps(s); mag = 1.0 if s.get('run') else 0.8
      await pg.evaluate(f"""(async()=>{{ const CO = await import('./js/island/coast.js'), FM = await import('./js/island/foot.js'), d = PFP.dock, w = d.walker.w, L = d.layout, s = {spec};
        let a, b; if (s.foot) {{ const K = FM.LAKE, r = K.r + 9; a = L.footToHarbor(K.x + r * 0.6, K.z + r * 0.8); b = L.footToHarbor(K.x, K.z); }} else {{ a = L.footToHarbor(...CO.t2w(...s.a)); b = L.footToHarbor(...CO.t2w(...s.b)); }}
        const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]); d.walker.enter(a[0], a[1], yaw); w.camYaw = yaw + s.cam[0]; w.pitch = s.cam[1]; w.dist = s.cam[2]; w.look = performance.now() + 1e7; d.walker.snapCam();
        window.__yaw = yaw; window.__T = []; }})()""")
      await pg.wait_for_timeout(2500)
      off = s['cam'][0]; jx, jy = round(math.sin(off) * mag, 4), round(-math.cos(off) * mag, 4)
      shots = s['n']; seg = s['hold'] / max(1, shots - 1)
      if s.get('until'):   # [swim-anim] hold W until the pose shows up, then the frames are timed from there
        await pg.evaluate(f"(()=>{{ for (let k = 0; k < 240; k++) {{ window.__sim(1 / 30, {jx}, {jy}, () => {{ PFP.dock.walker.w.camYaw = window.__yaw + {off}; }}); if (PFP.dock.walker.w.pose === '{s['until']}') break; }} }})()")
      for i in range(shots):
        if i == 1 and s.get('hop'): await pg.evaluate("window.__sim(1.5, 0, 0); PFP.dock.walker.jump()")
        if i: await pg.evaluate(f"window.__sim({seg}, {jx}, {jy}, () => {{ PFP.dock.walker.w.camYaw = window.__yaw + {off}; }})")
        await pg.wait_for_timeout(400); await pg.screenshot(timeout=120000, path=f'{OUT}/{DEV}_{name}_{i}.png')
      for wp in s.get('then', ()):
        await pg.evaluate(f"""(async()=>{{ const CO = await import('./js/island/coast.js'), d = PFP.dock, w = d.walker.w, L = d.layout, b = L.footToHarbor(...CO.t2w({wp[0]}, {wp[1]}));
          for (let k = 0; k < 300 && Math.hypot(b[0] - w.x, b[1] - w.z) > 1.2; k++) window.__sim(1 / 30, 0, -1, () => {{ w.camYaw = Math.atan2(b[0] - w.x, b[1] - w.z); }}); }})()""")
      await pg.evaluate("window.__sim(2.5, 0, 0)")   # settle: idle (cannon deck: no sliding) / tread water
      await pg.wait_for_timeout(400); await pg.screenshot(timeout=120000, path=f'{OUT}/{DEV}_{name}_end.png')
      T = await pg.evaluate("window.__T.splice(0)"); R[name] = T; print('done', name, len(T), flush=True); json.dump({'telemetry': R}, open(f'{OUT}/{DEV}_telemetry.json', 'w'))
      if s.get('mound'):
        R['mound'] = await pg.evaluate("""(()=>{ const d = PFP.dock, L = d.layout, F = d.world.foot; return (F.digs || []).map(dg => { const [hx, hz] = L.footToHarbor(dg.x, dg.z); return [dg.id, +d.world.ground(hx, hz).toFixed(3), +(dg.y - 0.1 + 0.855).toFixed(3)]; }); })()""")
    json.dump({'errors': errs[:12], 'telemetry': R}, open(f'{OUT}/{DEV}_telemetry.json', 'w')); print(json.dumps({'errors': errs[:12]})); await b.close()
asyncio.run(main())
