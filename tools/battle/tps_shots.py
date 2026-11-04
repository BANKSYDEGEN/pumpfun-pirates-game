# PUMPFUN PIRATES third-person musket aim (js/onfoot/tps.js) in the real game: index.html -> harbor -> dock -> ashore -> MUSKET RANGE.
# usage: python3 tps_shots.py desktop|phone [port]   -> screens/tps/<dev>_hipfire.png, <dev>_ads.png, <dev>_hitmarker.png + <dev>_tps.json
# PC = point and click (cursor on a target, click); phone = over the shoulder (crosshair, AIM / FIRE buttons)
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT=os.environ.get('WT','timothy-tps'); DEV=sys.argv[1]; PORT=sys.argv[2] if len(sys.argv) > 2 else '19377'; OUT=f'/workspace/{WT}/screens/tps'; os.makedirs(OUT, exist_ok=True)
JS_PRE = """window.__bt = (async()=>{ const CO = await import('./js/island/coast.js'), BA = await import('./js/island/battleAreas.js');
  const d = PFP.dock, L = d.layout, H = (lx, lz) => L.footToHarbor(...CO.t2w(lx, lz));
  const put = (lx, lz, faceLx, faceLz) => { const w = d.walker.w, [x, z] = H(lx, lz), [x2, z2] = H(faceLx, faceLz); w.x = x; w.z = z; w.y = d.world.ground(x, z); w.yaw = Math.atan2(x2 - x, z2 - z); w.camYaw = w.yaw; d.walker.snapCam(); return [x, z]; };
  // point the crosshair at a world point (a few passes: the camera moves with the yaw)
  const aimAt = (p) => { const T = d.battle.tps, w = d.walker.w, c = PFP.camera || d.walker.camera; for (let k = 0; k < 6; k++) { T.st.camOk = false; T.st.kick = 0; w.camHook?.(0.016); const cp = (window.PFP.camera || window.__cam).position;
      w.camYaw = Math.atan2(p[0] - cp.x, p[2] - cp.z); T.st.pitch = Math.atan2(p[1] - cp.y, Math.hypot(p[0] - cp.x, p[2] - cp.z)); } T.st.camOk = false; w.camHook?.(0.016); };
  const bt = d.battle, orig = bt.tick; let last = [true, null]; window.__freeze = false;
  bt.tick = (dt, o, p) => { last = [o, p]; return orig(window.__freeze ? 0 : dt, o, p); }; window.__step = (s) => { for (let k = 0; k < Math.ceil(s / 0.02); k++) orig(s / Math.ceil(s / 0.02), ...last); };
  return { CO, BA, H, put, aimAt }; })();"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob = DEV != 'desktop'
    print('chrome pid', b.process.pid if hasattr(b, 'process') else '?', flush=True)
    kw = dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width':1280,'height':720})
    ctx = await b.new_context(**kw)
    async def cors(r):
      if r.request.method == 'OPTIONS': return await r.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS'})
      resp = await r.fetch(); h = dict(resp.headers); h['access-control-allow-origin'] = '*'; await r.fulfill(response=resp, headers=h)
    await ctx.route('**/functions/v1/**', cors)
    await ctx.add_init_script("localStorage.setItem('pfp_name','TPS_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_gfx_hint','1')")
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGE '+str(e)))
    pg.on('console', lambda m: errs.append(m.type+': '+m.text[:200]) if m.type == 'error' else None); R = {}
    shot = lambda name: pg.screenshot(path=f'{OUT}/{DEV}_{name}.png')
    await pg.goto(f'http://127.0.0.1:{PORT}/{WT}/index.html' + (sys.argv[3] if len(sys.argv) > 3 else '')); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=180000); await pg.wait_for_timeout(2000)
    await (pg.tap('#btn-pvp') if mob else pg.click('#btn-pvp'))
    await pg.wait_for_function("PFP.dock && PFP.dock.on", timeout=240000); await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(3000)
    await pg.evaluate("(()=>{PFP.game.stormOverride=0;PFP.game.storm=0;const d=PFP.dock; for (const b of d.layout.berths) { d.dockAt(b.id); if (d.docking.mode !== 'sea') break; } })()")
    await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=600000)
    await pg.evaluate("PFP.dock.goAshore()"); await pg.wait_for_function('PFP.dock.onFoot', timeout=600000); await pg.wait_for_timeout(1500)
    R['camExposed'] = await pg.evaluate("!!PFP.camera")
    await pg.evaluate(JS_PRE); await pg.evaluate("window.__bt")
    # stand on the firing line of lane 1, facing the target
    await pg.evaluate("window.__bt.then(t => { const R = t.BA.RANGE; t.put(R.lanes[1] + 0.6, R.line + 1.2, R.lanes[1], R.targetLz); })")
    await pg.wait_for_timeout(2500)
    await pg.wait_for_function("PFP.dock.battle.tps?.on", timeout=120000)
    R['zone'] = await pg.evaluate("PFP.dock.battle.zone"); R['tpsOn'] = await pg.evaluate("!!PFP.dock.battle.tps?.on")
    R['htmlClass'] = await pg.evaluate("document.documentElement.className")
    tgt = "(()=>{ const t = PFP.dock.battle.targets[%d]; return [t.cx, t.cy, t.cz]; })()"
    # screen spot (CSS px) of a world point, through the camera's view offset when zoomed
    SCR = """(p => { const c = PFP.camera, v = c.position.clone().set(...p).project(c), r = PFP.renderer.domElement.getBoundingClientRect(), V = c.view;
      let u = (v.x + 1) / 2, w = (1 - v.y) / 2; if (V && V.enabled) { u = (u * V.width + V.offsetX) / V.fullWidth; w = (w * V.height + V.offsetY) / V.fullHeight; } return [r.left + u * r.width, r.top + w * r.height]; })"""
    flips = "PFP.dock.battle.targets.map(t => +t.flip.toFixed(2))"
    if mob:
      await pg.evaluate("window.__bt.then(t => t.aimAt(%s))" % (tgt % 0)); await pg.wait_for_timeout(600)
      await pg.evaluate("window.__freeze = true"); await pg.evaluate("(()=>{ const b = document.getElementById('bt-atk'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 7 })); })()")
      await pg.evaluate("window.__step(0.18)"); await pg.evaluate("window.__freeze = false"); await pg.wait_for_timeout(30)
      await shot('hipfire'); R['hip'] = await pg.evaluate(flips)
      await pg.evaluate("document.getElementById('tps-ads').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 8 }))")
      await pg.wait_for_timeout(900); await pg.evaluate("window.__bt.then(t => t.aimAt(%s))" % (tgt % 2)); await pg.wait_for_timeout(700); await shot('ads')
      await pg.add_style_tag(content="#tps-hm.on{animation:none!important;opacity:1!important}")
      await pg.evaluate("window.__freeze = true; window.__step(2.2); document.getElementById('tps-hm').classList.remove('on')")
      await pg.evaluate("(()=>{ const b = document.getElementById('bt-atk'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 9 })); })()")
      await pg.evaluate("window.__step(0.2)"); await pg.evaluate("window.__freeze = false"); await pg.wait_for_timeout(30); await shot('hitmarker')
      R['hit'] = await pg.evaluate("({ marker: document.getElementById('tps-hm').className, flips: %s })" % flips)
      await pg.evaluate("document.getElementById('tps-ads').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 8 }))")
    else:
      # PC point and click: the normal on-foot camera, a little higher + closer for the range
      await pg.evaluate("(()=>{ const w = PFP.dock.walker.w; w.pitch = 0.22; w.dist = 5.5; })()"); await pg.wait_for_timeout(1500)
      R['camHook'] = await pg.evaluate("!!PFP.dock.walker.w.camHook"); R['pcClass'] = await pg.evaluate("document.documentElement.classList.contains('tps-pc')")
      R['lockApi'] = await pg.evaluate("!!document.pointerLockElement")
      # 1) HIP-FIRE: put the cursor on target 1 and click
      xy = await pg.evaluate(SCR + "(%s)" % (tgt % 0)); await pg.mouse.move(*xy, steps=4); await pg.wait_for_timeout(1200)
      xy = await pg.evaluate(SCR + "(%s)" % (tgt % 0)); await pg.mouse.move(*xy); await pg.wait_for_timeout(400)
      R['faceBefore'] = await pg.evaluate("(()=>{ const w = PFP.dock.walker.w, t = PFP.dock.battle.targets[0]; return { faceYaw: w.faceYaw, toTarget: Math.atan2(t.cx - w.x, t.cz - w.z), aim: PFP.dock.battle.tps.st.aim?.kind }; })()")
      await pg.evaluate("window.__freeze = true"); await pg.mouse.click(*xy); await pg.evaluate("window.__step(0.18)"); await pg.evaluate("window.__freeze = false"); await pg.wait_for_timeout(30)
      await shot('hipfire'); R['hip'] = await pg.evaluate("({ flips: %s, aim: PFP.dock.battle.tps.st.lastAim?.kind, cursor: %s })" % (flips, xy)); print('hip', R['hip'], R['faceBefore'], flush=True)
      await pg.wait_for_timeout(1500)
      # 2) ADS: cursor on target 3, hold the right button (zoom toward the cursor)
      xy = await pg.evaluate(SCR + "(%s)" % (tgt % 2)); await pg.mouse.move(*xy, steps=4); await pg.wait_for_timeout(500)
      xy = await pg.evaluate(SCR + "(%s)" % (tgt % 2)); await pg.mouse.move(*xy); await pg.mouse.down(button='right'); await pg.wait_for_timeout(1500)
      xy2 = await pg.evaluate(SCR + "(%s)" % (tgt % 2)); await pg.mouse.move(*xy2); await pg.wait_for_timeout(500)
      await shot('ads'); R['ads'] = await pg.evaluate("(()=>{ const T = PFP.dock.battle.tps, c = PFP.camera; return { ads: +T.st.ads.toFixed(2), view: c.view && c.view.enabled ? [c.view.offsetX, c.view.offsetY, c.view.width, c.view.height].map(v => Math.round(v)) : null, zoom: c.zoom, spread: +T.st.spread.toFixed(2), moveK: PFP.dock.walker.w.moveK, cursorBefore: %s, cursorAfterZoom: %s }; })()" % (xy, xy2)); print('ads', R['ads'], flush=True)
      # 3) HIT MARKER: left click on target 3 while zoomed
      await pg.add_style_tag(content="#tps-hm.on{animation:none!important;opacity:1!important}")   # test only: hold the 0.32 s marker for the slow headless screenshot
      await pg.evaluate("window.__freeze = true; window.__step(2.2); document.getElementById('tps-hm').classList.remove('on')")
      await pg.mouse.down(button='left'); await pg.mouse.up(button='left'); await pg.evaluate("window.__step(0.2)"); await pg.evaluate("window.__freeze = false"); await pg.wait_for_timeout(30)
      await shot('hitmarker'); R['hit'] = await pg.evaluate("({ marker: document.getElementById('tps-hm').className, flips: %s, aim: PFP.dock.battle.tps.st.lastAim?.kind, msg: document.getElementById('bt-msg').innerText })" % flips); print('hit', R['hit'], flush=True)
      await pg.evaluate("window.__ev = []; for (const t of ['mouseup', 'pointerup', 'keyup']) addEventListener(t, e => window.__ev.push([t, e.button, e.buttons, e.code || '', PFP.dock.battle.tps.st.adsHeld]), true)")
      await pg.mouse.up(button='right'); await pg.wait_for_timeout(1000); R['upEvents'] = await pg.evaluate("window.__ev.concat([['held', PFP.dock.battle.tps.st.adsHeld]])"); print('up', R['upEvents'], flush=True)
      R['afterAds'] = await pg.evaluate("(()=>{ const c = PFP.camera; return { view: !!(c.view && c.view.enabled), ads: PFP.dock.battle.tps.st.ads }; })()")
      # 4) Esc = pause (no pointer lock in the way); the musket aim steps aside while paused, back on resume
      await pg.keyboard.press('Escape'); await pg.wait_for_timeout(1200)
      R['esc'] = await pg.evaluate("({ paused: !document.getElementById('pause').classList.contains('hidden'), tps: PFP.dock.battle.tps.on, reticle: getComputedStyle(document.getElementById('tps-x')).display, view: !!(PFP.camera.view && PFP.camera.view.enabled), aimSens: !!document.getElementById('aim-sens') })")
      await shot('paused')
      await pg.keyboard.press('Escape'); await pg.wait_for_timeout(1500)
      R['resume'] = await pg.evaluate("({ paused: !document.getElementById('pause').classList.contains('hidden'), tps: PFP.dock.battle.tps.on })")
      # 5) emote wheel (T) opens + its buttons are clickable with the free cursor
      await pg.keyboard.press('KeyT'); await pg.wait_for_timeout(800)
      R['emote'] = await pg.evaluate("(()=>{ const w = document.getElementById('emote-wheel'); const b = w && w.querySelector('button'); const r = b && b.getBoundingClientRect(); const top = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { open: !!w && !w.classList.contains('hidden'), btnOnTop: !!b && (top === b || b.contains(top)) }; })()")
      await shot('emote_wheel'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(800)
      R['emoteClosed'] = await pg.evaluate("(()=>{ const w = document.getElementById('emote-wheel'); return { wheelOpen: !!w && !w.classList.contains('hidden'), paused: !document.getElementById('pause').classList.contains('hidden') }; })()")
      print('esc', R['esc'], R['resume'], R['emote'], R['emoteClosed'], flush=True)
      R['afterEsc'] = await pg.evaluate("({ tps: PFP.dock.battle.tps.on })")
      if R['emoteClosed']['paused']: await pg.keyboard.press('Escape'); await pg.wait_for_timeout(800)
    # leave the range: back to the old camera, zoom 1, no lock
    await pg.evaluate("window.__bt.then(t => t.put(40, -40, 40, -60))"); await pg.wait_for_function("!PFP.dock.battle.tps.on", timeout=60000); await pg.wait_for_timeout(1500)
    R['afterLeave'] = await pg.evaluate("(()=>{ const c = PFP.camera; return { tps: PFP.dock.battle.tps.on, zone: PFP.dock.battle.zone, zoom: c ? c.zoom : null, view: !!(c.view && c.view.enabled), hook: !!PFP.dock.walker.w.camHook, faceYaw: PFP.dock.walker.w.faceYaw, cls: document.documentElement.className }; })()")
    R['errors'] = errs[:12]; json.dump(R, open(f'{OUT}/{DEV}_tps.json','w'), indent=1); print(json.dumps(R, indent=1)); await b.close()
asyncio.run(main())
