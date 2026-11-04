# [Emerly gamepad] the controller in the real game (index.html -> harbor -> moored -> ashore), a MOCKED navigator.getGamepads (Xbox pad),
# Supabase + DexScreener blocked, one headless Chrome. usage: PORT=… WT=emerly-gamepad python3 tools/gamepad/pad_game.py OUTDIR
# checks: title focus ring + D-pad moves it; moored prompt says 'A' / 'X'; A goes ashore; left stick walks; right stick turns the camera;
# an interact spot says 'A · …'; MENU opens settings, the ring is in it, B closes it; B = inventory + D-pad walks its grid; X = SET SAIL;
# RT fires (or the SAFE HARBOR no-firing gate answers); left stick steers; a real key press puts the 'E' back; rumble asked; &pad=0 polls nothing;
# Xbox / PS5 user agents: console classes, no touch stick; PS5 without WebGL: the "can't run the 3D sea" card.
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
WT=os.environ.get('WT','emerly-gamepad'); PORT=os.environ.get('PORT','19571'); OUT=sys.argv[1]; os.makedirs(OUT, exist_ok=True)
XBOX='Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
PS5='Mozilla/5.0 (PlayStation; PlayStation 5/10.20) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
MOCK = """(() => { const B = () => Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: B(),
    vibrationActuator: { type: 'dual-rumble', playEffect: (t, o) => { (window.__rumble ||= []).push(o); return Promise.resolve('complete'); } } };
  window.__pad = pad; window.__polls = 0; window.__padOn = false;
  Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: function () { window.__polls++; return [window.__padOn ? pad : null, null, null, null]; } });
  window.__plug = () => { window.__padOn = true; dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad })); };
  window.__btn = (i, v) => { pad.buttons[i].pressed = !!v; pad.buttons[i].value = v ? 1 : 0; pad.timestamp++; };
  window.__ax = (a) => { pad.axes = a.slice(); pad.timestamp++; };
})()"""
async def frames(pg, n=2):   # wait until frame() has polled the pad n more times (headless swiftshader can be 1-3 frames / s under load)
  k = await pg.evaluate('__polls'); await pg.wait_for_function(f'__polls >= {k + n}', timeout=120000)
async def shot(pg, path):
  try: await pg.screenshot(path=path, timeout=180000)
  except Exception as e: print('shot failed', path, str(e)[:80], flush=True)
async def press(pg, i):
  await pg.evaluate(f'__btn({i}, 1)'); await frames(pg); await pg.evaluate(f'__btn({i}, 0)'); await frames(pg)
async def main():
  R = {}; fails = []
  def check(name, ok, info=None):
    R[name] = {'ok': bool(ok), 'info': info}; print(('PASS ' if ok else 'FAIL ') + name, json.dumps(info)[:260], flush=True)
    if not ok: fails.append(name)
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    print('browser pid', b.process.pid if hasattr(b, 'process') else '?', flush=True)
    async def newctx(**kw):
      ctx = await b.new_context(**kw)
      await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
      await ctx.add_init_script("localStorage.setItem('pfp_name','PAD_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_gfx_hint','1')")
      await ctx.add_init_script(MOCK); return ctx
    # ---------- desktop + a pad ----------
    ctx = await newctx(viewport={'width': 1280, 'height': 720})
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)))
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text[:200]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    await pg.goto(f'http://127.0.0.1:{PORT}/{WT}/index.html'); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=240000); await pg.wait_for_timeout(2500)
    await pg.evaluate('__plug()'); await press(pg, 13)
    s = await pg.evaluate("(() => { const f = document.querySelector('.pad-focus'); return { pad: document.documentElement.classList.contains('pfp-pad'), ring: f ? (f.id || f.className || f.textContent).slice(0, 40) : null, inTitle: !!f?.closest('#title') }; })()")
    check('title_ring', s['pad'] and s['ring'] and s['inTitle'], s); await shot(pg, f'{OUT}/1_title_focus.png')
    seen = set([s['ring']])
    for d in [13, 13, 15, 12]:
      await press(pg, d); seen.add(await pg.evaluate("(document.querySelector('.pad-focus')?.id || document.querySelector('.pad-focus')?.textContent || '').slice(0, 40)"))
    check('title_dpad_moves', len(seen - {None, ''}) >= 3, sorted(str(x) for x in seen))
    # the CONTROLS overlay lists the controller map; B closes it
    await pg.evaluate("document.getElementById('btn-ctl-title').click()"); await frames(pg, 3)
    s = await pg.evaluate("({ help: !!document.querySelector('#ctl-ov #pad-help'), ring: !!document.querySelector('#ctl-ov .pad-focus') })"); check('controls_overlay_pad_map', s['help'] and s['ring'], s)
    await shot(pg, f'{OUT}/1b_controls_pad_map.png'); await press(pg, 1); await frames(pg, 2)
    check('B_closes_controls', await pg.evaluate("document.getElementById('ctl-ov').classList.contains('hidden')"))
    # harbor: SET SAIL into Battle Royale (moored at a berth on join)
    await pg.evaluate("document.getElementById('btn-pvp').click()"); await pg.wait_for_function("PFP.dock && PFP.dock.on", timeout=300000)
    await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(3000)
    await pg.evaluate("(()=>{PFP.game.stormOverride=0;PFP.game.storm=0;})()")
    if not await pg.evaluate("PFP.dock.docking.mode==='docked'"):
      await pg.evaluate("(()=>{const d=PFP.dock; for (const b of d.layout.berths) { d.dockAt(b.id); if (d.docking.mode !== 'sea') break; }})()")
      await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=600000)
    await pg.evaluate('__ax([0,0,0,0])'); await pg.wait_for_timeout(600)
    acts = await pg.evaluate("[...document.querySelectorAll('#dk-acts button')].filter(b => !b.hidden).map(b => b.innerText.replace(/\\s+/g, ' ').trim())")
    check('moored_prompts_say_A_X', len(acts) == 2 and acts[0].startswith('A') and 'GO ASHORE' in acts[0] and acts[1].startswith('X') and 'SET SAIL' in acts[1], acts)
    await shot(pg, f'{OUT}/2_moored_prompts.png')
    await press(pg, 0); await pg.wait_for_function('PFP.dock.onFoot', timeout=120000); await pg.wait_for_timeout(1500)
    check('A_goes_ashore', await pg.evaluate('PFP.dock.onFoot'), await pg.evaluate("({ crewAshore: (PFP.dock.followers?.list || []).filter(c => c.p.object.visible).length, dock: PFP.dock.docking.mode })"))
    w0 = await pg.evaluate('(()=>{const w=PFP.dock.walker.w; return [w.x, w.z, w.camYaw];})()')
    await pg.evaluate('__ax([0,-1,0,0])'); await frames(pg, 10); await pg.evaluate('__ax([0,0,0,0])'); await frames(pg, 2)
    w1 = await pg.evaluate('(()=>{const w=PFP.dock.walker.w; return [w.x, w.z, w.camYaw, w.joy.on];})()')
    moved = ((w1[0]-w0[0])**2 + (w1[1]-w0[1])**2) ** 0.5; check('left_stick_walks', moved > 1.5 and not w1[3], {'moved_m': round(moved, 2), 'joy_released': not w1[3]})
    await pg.evaluate('__ax([0,0,1,0])'); await frames(pg, 8); await pg.evaluate('__ax([0,0,0,0])'); await frames(pg, 2)
    w2 = await pg.evaluate('PFP.dock.walker.w.camYaw'); check('right_stick_turns_camera', abs(w2 - w1[2]) > 0.4, {'dYaw': round(w2 - w1[2], 2)})
    # an interact spot (the first layout prompt that is not the berth): 'A · …'
    q = await pg.evaluate("""(()=>{ const d = PFP.dock, L = [...d.layout.interact, ...d.world.footInteract].filter(q => !q.used && !q.src?.hidden?.());
      const q = L.find(q => /fountain|wish/i.test(q.id || '')) || L.find(q => q.kind === 'shop') || L[0]; const w = d.walker.w; w.x = q.x + 0.6; w.z = q.z; w.y = d.world.ground(w.x, w.z); d.walker.snapCam(); return q.id; })()""")
    await frames(pg, 4)
    a2 = await pg.evaluate("[...document.querySelectorAll('#dk-acts button')].filter(b => !b.hidden).map(b => b.innerText.replace(/\\s+/g, ' ').trim())")
    check('interact_prompt_says_A', len(a2) >= 1 and a2[0].startswith('A'), [q, a2]); await shot(pg, f'{OUT}/3_interact_prompt_A.png')
    # MENU = settings, ring inside, B closes
    await press(pg, 9); await pg.wait_for_timeout(400); await press(pg, 13)
    s = await pg.evaluate("({ st: PFP.game.state, open: !document.getElementById('pause').classList.contains('hidden'), ring: !!document.querySelector('#pause .pad-focus'), id: document.querySelector('.pad-focus')?.id || document.querySelector('.pad-focus')?.textContent?.slice(0, 30) })")
    check('menu_opens_settings_with_ring', s['open'] and s['ring'], s); await shot(pg, f'{OUT}/4_settings_focus.png')
    await press(pg, 1); await pg.wait_for_timeout(400)
    s = await pg.evaluate("({ st: PFP.game.state, open: !document.getElementById('pause').classList.contains('hidden') })"); check('B_closes_settings', not s['open'], s)
    # B on foot = inventory; D-pad walks it; B closes
    await press(pg, 1); await pg.wait_for_timeout(700)
    s = await pg.evaluate("({ open: document.getElementById('inv-panel')?.classList.contains('on'), ring: document.querySelector('#inv-panel .pad-focus')?.className || null })"); r0 = s['ring']
    await press(pg, 15); await press(pg, 13)
    s2 = await pg.evaluate("({ ring: document.querySelector('#inv-panel .pad-focus') ? (document.querySelector('#inv-panel .pad-focus').className + '|' + document.querySelector('#inv-panel .pad-focus').textContent).slice(0, 50) : null })")
    check('B_opens_inventory_ring_moves', s['open'] and s2['ring'] is not None, [s, s2]); await shot(pg, f'{OUT}/5_inventory_focus.png')
    await press(pg, 1); await pg.wait_for_timeout(500); check('B_closes_inventory', not await pg.evaluate("document.getElementById('inv-panel')?.classList.contains('on')"))
    # back aboard, X = SET SAIL, then RT fires / LS steers
    await pg.evaluate('PFP.dock.goAboard(true)'); await frames(pg, 4)   # the moored prompts come back on the next ship() frame
    await press(pg, 2); await pg.wait_for_timeout(1500); check('X_sets_sail', await pg.evaluate("PFP.dock.docking.mode !== 'docked'"), await pg.evaluate('PFP.dock.docking.mode'))
    await pg.wait_for_function("PFP.dock.docking.mode !== 'out'", timeout=180000)   # the scripted push-off from the berth owns the helm until it ends
    y0 = await pg.evaluate('PFP.player.yaw'); await pg.evaluate('__ax([-1,0,0,0])'); await frames(pg, 12); await pg.evaluate('__ax([0,0,0,0])'); await frames(pg, 2)
    y1 = await pg.evaluate('PFP.player.yaw'); check('left_stick_steers_ship', abs(y1 - y0) > 0.05, {'dYaw': round(y1 - y0, 3)})
    c0 = await pg.evaluate('({ star: PFP.player.cd.star, balls: PFP.balls.length })')
    await pg.evaluate('__btn(7, 1)'); await frames(pg, 2); c1 = await pg.evaluate('({ star: PFP.player.cd.star, balls: PFP.balls.length, toast: document.getElementById("dk-toast")?.innerText || "" })'); await pg.evaluate('__btn(7, 0)')
    check('RT_fires_starboard_or_safe_gate', c1['star'] > 0 or c1['balls'] > c0['balls'] or 'NO FIRING' in c1['toast'], [c0, c1])
    check('rumble_asked', await pg.evaluate('(window.__rumble || []).length') > 0, await pg.evaluate('(window.__rumble || []).slice(-2)'))
    await shot(pg, f'{OUT}/6_sailing.png')
    # a real key: the keyboard prompts come back
    await pg.wait_for_timeout(400); await pg.keyboard.press('KeyN'); await pg.keyboard.press('KeyN'); await pg.wait_for_timeout(300)
    check('real_key_back_to_keyboard', not await pg.evaluate("document.documentElement.classList.contains('pfp-pad')"))
    check('no_page_errors', not [e for e in errs if 'PAGE' in e], errs[:6])
    await ctx.close()
    # ---------- &pad=0: no polling ----------
    ctx = await newctx(viewport={'width': 1100, 'height': 620}); pg = await ctx.new_page()
    await pg.goto(f'http://127.0.0.1:{PORT}/{WT}/index.html?pad=0'); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=240000); await pg.wait_for_timeout(1500)
    await pg.evaluate('__plug()'); await pg.evaluate('__btn(0,1)'); await pg.wait_for_timeout(2500)
    s = await pg.evaluate("({ polls: window.__polls, pad: document.documentElement.classList.contains('pfp-pad') })"); check('pad0_kill_switch', s['polls'] == 0 and not s['pad'], s)
    await ctx.close()
    # ---------- Xbox Edge (TV 1080p): console, not a phone ----------
    ctx = await newctx(viewport={'width': 1920, 'height': 1080}, user_agent=XBOX); pg = await ctx.new_page()
    await pg.goto(f'http://127.0.0.1:{PORT}/{WT}/index.html'); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=240000); await pg.wait_for_timeout(2000)
    await pg.evaluate('__plug()'); await press(pg, 13)
    s = await pg.evaluate("({ cls: document.documentElement.className, q: PFP.quality, pr: PFP.renderer.getPixelRatio() })")
    check('xbox_console_classes', 'pfp-console' in s['cls'] and 'pfp-xbox' in s['cls'] and 'dk-touch' not in s['cls'], s)
    await shot(pg, f'{OUT}/7_xbox_title_1080p.png')
    await pg.evaluate("document.getElementById('btn-pvp').click()"); await pg.wait_for_function("PFP.dock && PFP.dock.on", timeout=300000)
    await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(2500)
    if not await pg.evaluate("PFP.dock.docking.mode==='docked'"):
      await pg.evaluate("(()=>{const d=PFP.dock; for (const b of d.layout.berths) { d.dockAt(b.id); if (d.docking.mode !== 'sea') break; }})()")
      await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=600000)
    await press(pg, 0); await pg.wait_for_function('PFP.dock.onFoot', timeout=120000); await pg.wait_for_timeout(1500)
    s = await pg.evaluate("({ joy: getComputedStyle(document.getElementById('dk-joy')).display, jump: getComputedStyle(document.getElementById('dk-jump')).display, touch: document.documentElement.classList.contains('dk-touch') })")
    check('xbox_no_touch_stick_on_foot', s['joy'] == 'none' and s['jump'] == 'none' and not s['touch'], s); await shot(pg, f'{OUT}/8_xbox_ashore_1080p.png')
    await ctx.close()
    # ---------- PS5 UA without WebGL: the honest card, no reload loop ----------
    ctx = await newctx(viewport={'width': 1280, 'height': 720}, user_agent=PS5)
    await ctx.add_init_script("(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/.test(t) ? null : g.call(this, t, o); }; })()")
    pg = await ctx.new_page(); await pg.goto(f'http://127.0.0.1:{PORT}/{WT}/index.html'); await pg.wait_for_timeout(5000)
    s = await pg.evaluate("({ t: document.querySelector('#loading .panel')?.innerText || '', reloads: +(sessionStorage.getItem('pfp_boot_retry') || 0), cls: document.documentElement.className })")
    check('ps5_nogl_card', "can't run the 3D sea" in s['t'] and 'PlayStation' in s['t'] and s['reloads'] == 0, s); await shot(pg, f'{OUT}/9_ps5_no_webgl.png')
    await ctx.close(); await b.close()
  json.dump(R, open(f'{OUT}/results.json', 'w'), indent=1); print('FAILS', fails)
asyncio.run(main())
