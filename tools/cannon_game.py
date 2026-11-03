# PUMPFUN PIRATES headland battery, in the real game (index.html -> harbor -> dock -> ashore): walk the ramp, man a gun, fire,
# reload, no damage. usage: python3 cannon_game.py desktop|phone [extra query e.g. plaza=2]   (WT env = worktree dir)
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT=os.environ.get('WT','timothy-cannons'); DEV=sys.argv[1]; Q=sys.argv[2] if len(sys.argv)>2 else ''; TAG=os.environ.get('TAG', DEV + ('_' + Q.replace('=','') if Q else ''))
OUT=f'/workspace/{WT}/screens/game'; os.makedirs(OUT, exist_ok=True)
HUDOFF='body>*:not(canvas):not(#dk-acts){visibility:hidden!important}'
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob = DEV != 'desktop'
    kw = dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width':1280,'height':720})
    ctx = await b.new_context(**kw)
    async def cors(r):
      if r.request.method == 'OPTIONS': return await r.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS'})
      resp = await r.fetch(); h = dict(resp.headers); h['access-control-allow-origin'] = '*'; await r.fulfill(response=resp, headers=h)
    await ctx.route('**/functions/v1/**', cors)
    await ctx.add_init_script("localStorage.setItem('pfp_name','CANNON_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_gfx_hint','1')")
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGE '+str(e)))
    pg.on('console', lambda m: errs.append(m.type+': '+m.text[:200]) if m.type=='error' else None); R = {}
    await pg.goto(f'http://127.0.0.1:18960/{WT}/index.html' + ('?' + Q if Q else '')); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=180000); await pg.wait_for_timeout(2000)
    await (pg.tap('#btn-pvp') if mob else pg.click('#btn-pvp'))
    await pg.wait_for_function("PFP.dock && PFP.dock.on", timeout=240000); await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(3000)
    await pg.evaluate("(()=>{PFP.game.stormOverride=0;PFP.game.storm=0;const d=PFP.dock; for (const b of d.layout.berths) { d.dockAt(b.id); if (d.docking.mode !== 'sea') break; } })()")
    await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=600000)
    await pg.evaluate("PFP.dock.goAshore()"); await pg.wait_for_function('PFP.dock.onFoot', timeout=600000); await pg.wait_for_timeout(1500)
    R['battery'] = await pg.evaluate("!!PFP.dock.battery")
    R['path'] = await pg.evaluate("""(async()=>{ const CO = await import('./js/island/coast.js'), BT = await import('./js/island/battery.js'), d = PFP.dock, W = d.world, L = d.layout;
      const H = (lx, lz) => L.footToHarbor(...CO.t2w(lx, lz)), R = BT.RAMP, g = BT.GUNS[2];
      const way = [[96, -4], [R.lx0 - 2, -2], [R.lx1 + 4, -2], [180, 14], [168, 28], [g.slx, g.slz]];
      let n = 0, blocked = [], maxStep = 0, prev = null;
      for (let k = 0; k < way.length - 1; k++) { const [a, b] = [H(...way[k]), H(...way[k + 1])], len = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.ceil(len / 0.3);
        for (let i = 1; i <= m; i++) { const x = a[0] + (b[0] - a[0]) * i / m, z = a[1] + (b[1] - a[1]) * i / m, px = a[0] + (b[0] - a[0]) * (i - 1) / m, pz = a[1] + (b[1] - a[1]) * (i - 1) / m; n++;
          if (W.blocked(x, z, px, pz)) blocked.push([+x.toFixed(1), +z.toFixed(1), k]); const y = W.ground(x, z); if (prev !== null) maxStep = Math.max(maxStep, Math.abs(y - prev)); prev = y; } }
      const mid = (R.lx0 + R.lx1) / 2, side = [[mid, R.lz0 + 0.5, mid, R.lz0 - 1.0], [mid, R.lz1 - 0.5, mid, R.lz1 + 1.0]].map(([a, b, c, e]) => { const [x0, z0] = H(a, b), [x1, z1] = H(c, e); let bl = false; for (let i = 1; i <= 6; i++) { const t = i / 6; if (W.blocked(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, x0 + (x1 - x0) * (i - 1) / 6, z0 + (z1 - z0) * (i - 1) / 6)) { bl = true; break; } } return bl; });
      const [sx, sz] = H(g.slx, g.slz), [gx, gz] = H(g.lx, g.lz); let gunBl = false; for (let i = 1; i <= 12; i++) { const t = i / 12; if (W.blocked(sx + (gx - sx) * t, sz + (gz - sz) * t, sx + (gx - sx) * (i - 1) / 12, sz + (gz - sz) * (i - 1) / 12)) { gunBl = true; break; } }
      return { steps: n, blocked: blocked.slice(0, 10), nBlocked: blocked.length, maxStepY: +maxStep.toFixed(3), sideWallsBlock: side, gunBlocks: gunBl, topY: +W.ground(...H(g.slx, g.slz)).toFixed(2) }; })()""")
    await pg.evaluate("""(async()=>{ const CO = await import('./js/island/coast.js'), BT = await import('./js/island/battery.js'), d = PFP.dock, w = d.walker.w, L = d.layout;
      const [x, z] = L.footToHarbor(...CO.t2w(BT.RAMP.lx0 + 2, -2)), [x2, z2] = L.footToHarbor(...CO.t2w(BT.RAMP.lx0 + 30, -2)); w.x = x; w.z = z; w.y = d.world.ground(x, z); w.yaw = w.camYaw = Math.atan2(x2 - x, z2 - z); w.pitch = 0.3; w.dist = 9; d.walker.snapCam(); window.__w0 = [w.x, w.z, w.y]; })()""")
    await pg.wait_for_timeout(800)
    if mob: await pg.evaluate("(()=>{ const w = PFP.dock.walker.w; w.joy.on = true; w.joy.x = 0; w.joy.y = -0.7; })()")
    else: await pg.keyboard.down('KeyW')
    await pg.wait_for_timeout(3500); await pg.add_style_tag(content=HUDOFF); await pg.screenshot(path=f'{OUT}/{TAG}_path_up.png')
    await pg.wait_for_timeout(2500)
    if mob: await pg.evaluate("(()=>{ const w = PFP.dock.walker.w; w.joy.on = false; w.joy.y = 0; })()")
    else: await pg.keyboard.up('KeyW')
    R['walk'] = await pg.evaluate("(()=>{ const w = PFP.dock.walker.w, a = window.__w0; return { moved: +Math.hypot(w.x - a[0], w.z - a[1]).toFixed(1), climbed: +(w.y - a[2]).toFixed(2), feetVsGround: +(w.y - PFP.dock.world.ground(w.x, w.z)).toFixed(3) }; })()")
    await pg.evaluate("""(async()=>{ const d = PFP.dock, w = d.walker.w, q = d.battery.points[2], g = d.battery.guns[2]; w.x = q.x; w.z = q.z; w.y = d.world.ground(q.x, q.z); w.yaw = g.rest; w.camYaw = g.rest + 0.25; w.pitch = 0.22; w.dist = 8; d.walker.snapCam();
      const P = PFP.player; window.__before = JSON.stringify({ hp: P.hp, maxHp: P.maxHp, alive: P.alive, gold: PFP.pvp?.profile?.gold ?? null, kills: PFP.pvp?.kills ?? null, balls: PFP.balls.length }); })()""")
    await pg.wait_for_timeout(2500)
    R['prompt'] = await pg.evaluate("document.getElementById('dk-acts').innerText")
    R['manned'] = await pg.evaluate("PFP.dock.battery.manned")
    await pg.screenshot(path=f'{OUT}/{TAG}_at_cannon.png')
    if mob: await pg.tap('#dk-acts button')
    else: await pg.keyboard.press('KeyE')
    await pg.wait_for_timeout(120); await pg.screenshot(path=f'{OUT}/{TAG}_firing.png')
    R['afterFire'] = await pg.evaluate("({ balls: PFP.dock.battery.balls, cool: +PFP.dock.battery.guns[2].cool.toFixed(2), recoil: +PFP.dock.battery.guns[2].recoil.toFixed(2), prompt: document.getElementById('dk-acts').innerText, net: PFP.dock.netState().bc })")
    await pg.wait_for_timeout(900); await pg.screenshot(path=f'{OUT}/{TAG}_firing_smoke.png')
    if mob: await pg.tap('#dk-acts button')
    else: await pg.keyboard.press('KeyE')
    R['duringReload'] = await pg.evaluate("({ balls: PFP.dock.battery.balls, net: PFP.dock.netState().bc })")
    R['flightS'] = await pg.evaluate("new Promise(r => { const t0 = performance.now(); const i = setInterval(() => { if (PFP.dock.battery.balls === 0 || performance.now() - t0 > 16000) { clearInterval(i); r(+((performance.now() - t0) / 1000).toFixed(1)); } }, 50); })")
    await pg.wait_for_timeout(2600)
    R['reloaded'] = await pg.evaluate("document.getElementById('dk-acts').innerText")
    if mob: await pg.tap('#dk-acts button')
    else: await pg.keyboard.press('KeyE')
    R['secondShot'] = await pg.evaluate("({ balls: PFP.dock.battery.balls, net: PFP.dock.netState().bc })")
    await pg.evaluate("(()=>{ const w = PFP.dock.walker.w, g = PFP.dock.battery.guns[2]; w.camYaw = g.rest + 1.4; w.pitch = -0.35; })()"); await pg.wait_for_timeout(1500)
    R['aim'] = await pg.evaluate("(()=>{ const g = PFP.dock.battery.guns[2]; return { yawOff: +(g.yaw - g.rest).toFixed(3), pitch: +g.pitch.toFixed(3) }; })()")
    await pg.wait_for_timeout(1500)
    R['after'] = await pg.evaluate("(()=>{ const P = PFP.player; return JSON.stringify({ hp: P.hp, maxHp: P.maxHp, alive: P.alive, gold: PFP.pvp?.profile?.gold ?? null, kills: PFP.pvp?.kills ?? null, balls: PFP.balls.length }); })()")
    R['before'] = await pg.evaluate("window.__before")
    R['peer'] = await pg.evaluate("""(()=>{ const d = PFP.dock, n0 = d.battery.balls; d.onPeerState({ i: 'peertest1', bc: [5, 0, 0, 10] }); const n1 = d.battery.balls; d.onPeerState({ i: 'peertest1', bc: [6, 0, Math.round(d.battery.guns[0].rest * 100), 10] }); return { firstSightingFired: n1 > n0, replayed: d.battery.balls > n1 }; })()""")
    R['errors'] = errs[:10]; json.dump(R, open(f'{OUT}/{TAG}.json','w'), indent=1); print(json.dumps(R, indent=1)); await b.close()
asyncio.run(main())
