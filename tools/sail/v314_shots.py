# [v314] canoe on waves / GO TO ISLAND / AI round the island: one headless Chrome in the real game (harbor), Supabase blocked.
# usage: python3 tools/sail/v314_shots.py PORT OUTDIR   (served from /workspace: http://127.0.0.1:PORT/emerly-sail-around/index.html)
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage','--no-sandbox']
PORT, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx = await b.new_context(viewport={'width': 1280, 'height': 720})
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.add_init_script("localStorage.setItem('pfp_name','SAIL_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_gfx_hint','1')")
    pg = await ctx.new_page(); pg.set_default_timeout(240000); errs = []; R = {}
    pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)[:240])); pg.on('console', lambda m: errs.append(m.type + ': ' + m.text[:200]) if m.type == 'error' else None)
    await pg.goto(f'http://127.0.0.1:{PORT}/emerly-sail-around/index.html?quality=low'); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=240000); await pg.wait_for_timeout(2000)
    await pg.click('#btn-pvp'); await pg.wait_for_function('PFP.dock && PFP.dock.on', timeout=300000)
    await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(4000)
    R['sw'] = await pg.evaluate("fetch('sw.js').then(r=>r.text()).then(t=>t.match(/VERSION = '([^']+)'/)[1])")
    # 0) the main dock: leave the berth, then pull back up to it: sailing OR anchored next to a berth = only the DOCK prompt (no canoe / DROP ANCHOR popup)
    await pg.evaluate("PFP.game.stormOverride=0; PFP.game.storm=0"); await pg.wait_for_function("PFP.dock.docking.mode === 'docked' && PFP.game.state === 'playing'", timeout=120000); await pg.wait_for_timeout(1500)
    R['dockStart'] = await pg.evaluate("document.getElementById('dk-acts').innerText"); await pg.keyboard.press('KeyW')
    await pg.wait_for_function("PFP.dock.docking.mode === 'sea'", timeout=120000); await pg.wait_for_timeout(6500)
    R['dock'] = await pg.evaluate("""(async()=>{ const d = PFP.dock, s = PFP.player, b = d.layout.berths[4], w = (ms) => new Promise(r=>setTimeout(r,ms)), acts = () => document.getElementById('dk-acts').innerText;
      const out = {}; const at = async (k, anchor, dx) => { s.x = b.x - dx; s.z = b.z; s.yaw = -Math.PI/2; s.speed = 0; s.sail = anchor ? 0 : 1; s.anchor = anchor; await w(400); s.x = b.x - dx; s.z = b.z; s.speed = 0; out[k] = { acts: acts(), mode: d.docking.mode }; };
      await at('approachSailing', false, 25); await at('approachAnchored', true, 25); await at('corridorAnchored', true, 60);
      s.x = 600; s.z = -500; s.anchor = false; s.sail = 1; s.speed = 0; await w(1500); out.sailingOffshore = acts();
      return out; })()""")
    print('DOCK', json.dumps(R['dock']), flush=True)
    # real docking with the keyboard: slow up to a berth -> [E] DOCK -> moored -> [E] GO ASHORE (captain on the pier)
    await pg.evaluate("(()=>{ const d = PFP.dock, s = PFP.player, b = d.layout.berths[4]; s.x = b.x - 26; s.z = b.z; s.yaw = Math.PI/2; s.speed = 1.5; s.sail = 0; s.anchor = true; })()")
    await pg.wait_for_function("document.getElementById('dk-acts').innerText.includes('DOCK')", timeout=60000)
    R['dockPrompt'] = await pg.evaluate("document.getElementById('dk-acts').innerText")
    await pg.keyboard.press('KeyE')
    await pg.wait_for_function("PFP.dock.docking.mode === 'docked'", timeout=60000); await pg.wait_for_timeout(1200)
    R['docked'] = await pg.evaluate("({ mode: PFP.dock.docking.mode, berth: PFP.dock.docking.berth?.id, acts: document.getElementById('dk-acts').innerText, canoe: PFP.dock.canoe.mode })")
    await pg.screenshot(path=f'{OUT}/0_main_dock_docked.png')
    await pg.keyboard.press('KeyE'); await pg.wait_for_function("PFP.dock.onFoot", timeout=60000); await pg.wait_for_timeout(1500)
    R['dockAshore'] = await pg.evaluate("({ onFoot: PFP.dock.onFoot, acts: document.getElementById('dk-acts').innerText })")
    await pg.screenshot(path=f'{OUT}/0b_main_dock_captain_on_pier.png')
    print('DOCKED', json.dumps([R['dockPrompt'], R['docked'], R['dockAshore']]), flush=True)
    await pg.evaluate("PFP.dock.goAboard(true)"); await pg.wait_for_timeout(800); await pg.keyboard.press('KeyW')
    await pg.wait_for_function("PFP.dock.docking.mode === 'sea'", timeout=120000)
    # 1) offshore by an island beach: anchor with the on-screen button, GO TO ISLAND · CANOE, paddle with W
    R['spot'] = await pg.evaluate("""(async()=>{ const d = PFP.dock, s = PFP.player, L = d.layout, H = (x,z) => L.FM.H(...L.harborToFoot(x,z)); const cx = 810, cz = 110;
      // east coast: march out from the centre until deep water, then 70 m more
      const a = Math.atan2(1, 0.15); let r = 100; while (r < 1100 && H(cx + Math.sin(a)*r, cz + Math.cos(a)*r) > -9) r += 4; r += 70;
      s.x = cx + Math.sin(a)*r; s.z = cz + Math.cos(a)*r; s.yaw = a + Math.PI/2; s.speed = 0; s.sail = 0; s.anchor = false;
      await new Promise(q=>setTimeout(q,1200)); const before = document.getElementById('dk-acts').innerText;
      document.getElementById('anchor').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.getElementById('anchor').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await new Promise(q=>setTimeout(q,1500)); return { x: s.x, z: s.z, H: H(s.x, s.z), anchor: s.anchor, before, after: document.getElementById('dk-acts').innerText }; })()""")
    await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(1500)
    R['launched'] = await pg.evaluate("({ mode: PFP.dock.canoe.mode, acts: document.getElementById('dk-acts').innerText, s: [PFP.player.x, PFP.player.z] })")
    await pg.evaluate("window.__c0 = [PFP.dock.canoe.state.cx, PFP.dock.canoe.state.cz]; window.__a0 = [PFP.player.x, PFP.player.z, PFP.player.yaw]")
    # turn the canoe away from the ship a bit so both show, then paddle
    await pg.keyboard.down('KeyW')
    await pg.wait_for_function("Math.hypot(PFP.dock.canoe.state.cx - __c0[0], PFP.dock.canoe.state.cz - __c0[1]) > 22", timeout=120000)
    await pg.evaluate("(()=>{ const c = PFP.dock.canoe, st = c.state, s = PFP.player; c.cam.yaw = Math.atan2(s.x - st.cx, s.z - st.cz) + 0.55; c.cam.pitch = 0.22; c.cam.dist = 13; c.cam.look = performance.now() + 8000; })()")
    await pg.wait_for_timeout(700)
    await pg.screenshot(path=f'{OUT}/1_canoe_on_waves_ship_anchored.png')
    await pg.keyboard.up('KeyW')
    R['paddle'] = await pg.evaluate("""(async()=>{ const { waveHeight } = await import('./js/ocean.js'); const d = PFP.dock, c = d.canoe, st = c.state, s = PFP.player, m = c.mesh.position, t = PFP.game.t;
      return { moved: Math.hypot(st.cx - __c0[0], st.cz - __c0[1]), ship: [s.x, s.z], anchor0: __a0, locked: s.x === __a0[0] && s.z === __a0[1] && s.yaw === __a0[2], sail: s.sail, anchor: s.anchor, speed: s.speed,
        canoeY: m.y, wave: waveHeight(m.x, m.z, t), floorAboveWave: m.y + 0.16 - waveHeight(m.x, m.z, t), hull: d.canoeHull(), oceanFollows: [PFP.ocean.mesh.position.x, PFP.ocean.mesh.position.z], acts: document.getElementById('dk-acts').innerText }; })()""")
    # 2) paddle up to the beach: hold W toward the island until GO TO ISLAND shows
    await pg.evaluate("""(()=>{ const c = PFP.dock.canoe, st = c.state; st.cyaw = Math.atan2(810 - st.cx, 110 - st.cz); c.camBehind(); })()""")
    await pg.keyboard.down('KeyW')
    try: await pg.wait_for_function("document.getElementById('dk-acts').innerText.includes('GO TO ISLAND')", timeout=90000)
    except Exception as e: R['waitShore'] = str(e)[:120]
    await pg.keyboard.up('KeyW'); await pg.wait_for_timeout(900)
    await pg.screenshot(path=f'{OUT}/2_canoe_go_to_island_prompt.png')
    R['shore'] = await pg.evaluate("(()=>{ const st = PFP.dock.canoe.state, L = PFP.dock.layout; return { acts: document.getElementById('dk-acts').innerText, H: L.FM.H(...L.harborToFoot(st.cx, st.cz)) }; })()")
    await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(2500)
    R['ashore'] = await pg.evaluate("(()=>{ const d = PFP.dock, w = d.walker.w, L = d.layout, st = d.canoe.state; return { onFoot: d.onFoot, mode: d.canoe.mode, H: L.FM.H(...L.harborToFoot(w.x, w.z)), swim: !!w.swim, toCanoe: Math.hypot(w.x - st.bx, w.z - st.bz), acts: document.getElementById('dk-acts').innerText, shipLocked: PFP.player.x === __a0[0] && PFP.player.z === __a0[1] }; })()")
    await pg.evaluate("(()=>{ const w = PFP.dock.walker.w; w.camYaw = w.yaw + Math.PI * 0.85; w.pitch = 0.35; w.look = performance.now() + 8000; })()"); await pg.wait_for_timeout(1200)
    await pg.screenshot(path=f'{OUT}/2b_ashore_dry_sand_beached_canoe.png')
    # 2c) back to the beached canoe -> [E] BOARD CANOE -> paddle back to the anchored ship -> [E] BOARD SHIP
    await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(1500)
    R['relaunch'] = await pg.evaluate("({ mode: PFP.dock.canoe.mode, onFoot: PFP.dock.onFoot, acts: document.getElementById('dk-acts').innerText })")
    await pg.evaluate("(()=>{ const c = PFP.dock.canoe, st = c.state; st.cyaw = Math.atan2(st.ax - st.cx, st.az - st.cz); c.camBehind(); })()")
    await pg.keyboard.down('KeyW')
    try: await pg.wait_for_function("document.getElementById('dk-acts').innerText.includes('BOARD SHIP')", timeout=150000)
    except Exception as e: R['waitShip'] = str(e)[:120]
    await pg.keyboard.up('KeyW'); await pg.wait_for_timeout(600)
    R['nearShip'] = await pg.evaluate("(()=>{ const st = PFP.dock.canoe.state; return { acts: document.getElementById('dk-acts').innerText, d: Math.hypot(st.cx - st.ax, st.cz - st.az) }; })()")
    await pg.screenshot(path=f'{OUT}/2c_canoe_back_at_ship_board_prompt.png')
    acts = R['nearShip']['acts']; await pg.keyboard.press('KeyQ' if 'QBOARD SHIP' in acts.replace(' ', '') else 'KeyE'); await pg.wait_for_timeout(1500)
    R['aboard'] = await pg.evaluate("({ mode: PFP.dock.canoe.mode, onFoot: PFP.dock.onFoot, canoeing: PFP.dock.canoeing, anchor: PFP.player.anchor, acts: document.getElementById('dk-acts').innerText })")
    await pg.keyboard.press('KeyW'); await pg.wait_for_timeout(2500)
    R['sailAway'] = await pg.evaluate("({ anchor: PFP.player.anchor, sail: PFP.player.sail, speed: PFP.player.speed, moved: Math.hypot(PFP.player.x - __a0[0], PFP.player.z - __a0[1]), acts: document.getElementById('dk-acts').innerText })")
    print('LOOP', json.dumps([R['relaunch'], R['nearShip'], R['aboard'], R['sailAway']]), flush=True)
    # 3) AI round the island: wait for the harbor AI, then the island map
    await pg.wait_for_function("PFP.enemies.filter(e => e.alive).length >= 8", timeout=180000); await pg.wait_for_timeout(20000)
    R['ai'] = await pg.evaluate("""(()=>{ const ai = PFP.enemies.filter(e => e.alive); const dd = ai.map(e => Math.hypot(e.x - 160, e.z)), d0 = ai.map(e => Math.hypot(e.x, e.z));
      const sec = ai.map(e => { const a = Math.atan2(e.x - 810, e.z - 110) * 180 / Math.PI; return a > -45 && a <= 45 ? 'S' : a > 45 && a <= 135 ? 'E' : a > -135 && a <= -45 ? 'W' : 'N'; });
      return { n: ai.length, patrol: ai.filter(e => e.islandPatrol).length, minDock: Math.min(...dd), min0: Math.min(...d0), within300: dd.filter(v => v < 300).length, sectors: sec, pos: ai.map(e => [Math.round(e.x), Math.round(e.z)]) }; })()""")
    R['boss'] = await pg.evaluate("""(()=>{ const T = PFP.pvp?._test; if (!T?.spawnBoss) return null; const e = T.spawnBoss(); if (!e) return 'not spawned'; return { x: Math.round(e.x), z: Math.round(e.z), dock: Math.round(Math.hypot(e.x - 160, e.z)), patrol: !!e.islandPatrol, dir: e.patrolDir, R: Math.round(e.patrolR) }; })()""")
    await pg.wait_for_timeout(1500)
    await pg.evaluate("PFP.dock.openIsleMap()"); await pg.wait_for_timeout(2500)
    await pg.screenshot(path=f'{OUT}/3_ai_spawns_around_island_map.png')
    R['errors'] = errs[:15]; json.dump(R, open(f'{OUT}/v314_metrics.json', 'w'), indent=1); print(json.dumps(R, indent=1)); await b.close()
asyncio.run(main())
