# PUMPFUN PIRATES land emotes in the real game (index.html -> harbor -> dock -> ashore), Supabase + DexScreener blocked, one headless Chrome.
# usage: python3 tools/emote_game.py OUTDIR desktop|phone [peer]   (PORT env = static server on /workspace, WT env = worktree dir)
# checks: Arr! / Yo ho ho! / Follow me! start on your pirate through the real quick-chat (PFP_EMOTE.sendEmote), the shore crew copy Arr! + Yo ho ho!,
# Follow me! stays upper body while walking, the jig cancels when you walk, swimming = bubble + voice only, the bubble rides over your head,
# peer: a 2nd tab on the ?harborbc test channel sees your pirate emote (the 'emo' path, no new state field).
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT=os.environ.get('WT','raul-emotes'); PORT=os.environ.get('PORT','18931'); OUT, DEV = sys.argv[1], sys.argv[2]; PEER = 'peer' in sys.argv[3:]; os.makedirs(OUT, exist_ok=True)
HUDOFF='body>*:not(canvas):not(#emote-bubbles){visibility:hidden!important}'
FIND = """window.__me = () => { const w = PFP.dock.walker.w; let best = null; const crew = new Set((PFP.dock.followers?.list || []).map(c => c.p.object)); PFP.scene.traverse((o) => { if (o.name === 'pirate' && o.visible && !crew.has(o) && Math.hypot(o.position.x - w.x, o.position.z - w.z) < 1.5) best = o; }); return best; };
window.__st = () => { const me = __me(), m = me?.userData.emote, F = (PFP.dock.followers?.list || []).filter(c => c.p.object.visible);
  const b = [...document.querySelectorAll('.emote-bubble')].filter(e => e.style.display !== 'none').map(e => { const r = e.getBoundingClientRect(); return [e.textContent, Math.round(r.left + r.width / 2), Math.round(r.bottom)]; });
  let head = null; if (me) { const v = me.position.clone(); v.y += 2.1; v.project(PFP.camera); head = [Math.round((v.x * 0.5 + 0.5) * innerWidth), Math.round((-v.y * 0.5 + 0.5) * innerHeight)]; }
  return { emote: m ? { e: m.e, t: +m.t.toFixed(2), w: +m.w.toFixed(2), up: !!m.up, live: m.live } : null, crew: F.map(c => c.p.object.userData.emote?.e ?? null), bubbles: b, head, pose: PFP.dock.walker.w.pose, swim: !!PFP.dock.walker.w.body.swim }; };"""
async def boot(ctx, mob, q=''):
  pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append('PAGE '+str(e)))
  pg.on('console', lambda m: errs.append(m.type+': '+m.text[:160]) if m.type=='error' and 'Failed to load resource' not in m.text else None)
  await pg.goto(f'http://127.0.0.1:{PORT}/{WT}/index.html{q}'); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=240000); await pg.wait_for_timeout(2000)
  await (pg.tap('#btn-pvp') if mob else pg.evaluate("document.getElementById('btn-pvp').click()"))
  await pg.wait_for_function("PFP.dock && PFP.dock.on", timeout=300000); await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(3000)
  return pg, errs
async def ashore(pg, pick=0):
  await pg.evaluate(f"(()=>{{PFP.game.stormOverride=0;PFP.game.storm=0;const d=PFP.dock; const B=d.layout.berths; for (let k=0;k<B.length;k++) {{ const b=B[(k+{pick})%B.length]; d.dockAt(b.id); if (d.docking.mode !== 'sea') break; }} }})()")
  await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=600000)
  await pg.evaluate("PFP.dock.goAshore()"); await pg.wait_for_function('PFP.dock.onFoot', timeout=600000); await pg.wait_for_timeout(2500); await pg.evaluate(FIND); await pg.evaluate(SIM)
SIM = """(()=>{ const d = PFP.dock, wk = d.walker, fl = d.followers; if (!wk.__u) { wk.__u = wk.update; wk.update = () => {}; } if (fl && !fl.__u) { fl.__u = fl.update; fl.update = () => {}; }
  window.__sim = (sec, jx = 0, jy = 0) => { const w = wk.w, n = Math.round(sec * 30); for (let i = 0; i < n; i++) { w.joy.on = jx !== 0 || jy !== 0; w.joy.x = jx; w.joy.y = jy; wk.__u(1 / 30); fl?.__u(1 / 30, PFP.camera); } return n; }; })()"""
async def sim(pg, sec, jy=0): await pg.evaluate(f"__sim({sec}, 0, {jy})"); await pg.wait_for_timeout(700)   # exact sim time, then let a frame render
async def face(pg, dist=4.6):   # camera in front of you (3/4), no drift
  await pg.evaluate(f"(()=>{{ const d = PFP.dock, w = d.walker.w; w.camYaw = w.yaw + Math.PI - 0.7; w.pitch = 0.12; w.dist = {dist}; w.look = performance.now() + 1e7; d.walker.snapCam(); }})()"); await pg.evaluate('__sim(0.1)')
async def emote(pg, e): return await pg.evaluate(f"(()=>{{ PFP_EMOTE.last = -1e9; return PFP_EMOTE.sendEmote({e}); }})()")
async def main():
  R = {}; fails = []
  def check(name, ok, info=None):
    R[name] = {'ok': bool(ok), 'info': info}; print(('PASS ' if ok else 'FAIL ') + name, json.dumps(info)[:300], flush=True)
    if not ok: fails.append(name)
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob = DEV != 'desktop'
    kw = dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width':1100,'height':620})
    ctx = await b.new_context(**kw)
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.add_init_script("localStorage.setItem('pfp_name','EMOTE_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_gfx_hint','1')")
    q = '?harborbc=1' if PEER else ''
    pg, errs = await boot(ctx, mob, q); await ashore(pg)
    await pg.add_style_tag(content=HUDOFF); await pg.evaluate('(()=>{ const w = PFP.dock.walker.w; window.__home = [w.x, w.z, w.yaw]; })()'); await face(pg)
    # 1) all 8 standing on land: your pirate + the crew's answer (copy / bow / nod, staggered), bubble over your head
    CREW = {0: 0, 1: 100, 2: 100, 3: None, 4: 4, 5: None, 6: 6, 7: 7}; NAMES = ['arr', 'follow', 'boss', 'help', 'attack', 'retreat', 'gg', 'jig']
    MID = {0: 0.5, 1: 0.7, 2: 0.35, 3: 0.45, 4: 0.4, 5: 0.6, 6: 0.75, 7: 1.0}
    for e in range(8):
      await face(pg); ok = await emote(pg, e); await sim(pg, MID[e]); await pg.wait_for_timeout(600); s = await pg.evaluate('__st()')
      await pg.screenshot(path=f'{OUT}/{DEV}_{NAMES[e]}.png')
      check(f'{NAMES[e]}_starts', ok and s['emote'] and s['emote']['e'] == e, s['emote']); check(f'{NAMES[e]}_crew', len(s['crew']) and all(c == CREW[e] for c in s['crew']), s['crew'])
      if e == 0:
        hb = s['bubbles'] and s['head'] and abs(s['bubbles'][-1][1] - s['head'][0]) < 90 and s['bubbles'][-1][2] < s['head'][1] + 30; check('bubble_over_head', hb, [s['bubbles'], s['head']])
      await sim(pg, 2.6); s = await pg.evaluate('__st()'); check(f'{NAMES[e]}_ends', s['emote'] is None and all(c is None for c in s['crew']), [s['emote'], s['crew']])
    # 2) walking: upper body on 0-5, GG + the jig cancel
    for e in range(8):
      await pg.evaluate('(()=>{ const h = window.__home; PFP.dock.walker.enter(h[0], h[1], h[2]); })()'); await face(pg)
      await pg.evaluate('__sim(0.6, 0, -0.7)'); await emote(pg, e); await pg.evaluate('__sim(0.4, 0, -0.7)'); s = await pg.evaluate('__st()')
      if e in (6, 7): check(f'{NAMES[e]}_cancels_walking', s['emote'] is None or not s['emote']['live'], s['emote'])
      else: check(f'{NAMES[e]}_walking_upper', s['emote'] and s['emote']['e'] == e and s['emote']['up'] and s['emote']['live'], s['emote'])
      await pg.evaluate('__sim(2.4)')
    await sim(pg, 1.5)
    # 5) swimming: voice + bubble only (no body motion)
    await pg.evaluate("""(async()=>{ const CO = await import('./js/island/coast.js'), d = PFP.dock, L = d.layout; let a = null, best = 0; for (let lx = -284; lx <= -204; lx += 2) for (let lz = -62; lz <= -34; lz += 2) { const h = L.footToHarbor(...CO.t2w(lx, lz)), wv = d.world.water?.(h[0], h[1]); if (wv == null) continue; const dep = wv - d.world.ground(h[0], h[1]); if (dep > best) { best = dep; a = h; } } window.__deep = best; d.walker.enter(a[0], a[1], 0); })()""")
    await pg.wait_for_timeout(500); await pg.evaluate('__sim(3.0)'); s0 = await pg.evaluate('__st()'); ok = await emote(pg, 0); await pg.evaluate('__sim(0.3)'); s = await pg.evaluate('__st()')
    check('swim_voice_only', s0['swim'] and ok and s['emote'] is None and len(s['bubbles']) > 0, {'before': s0, 'after': s})
    # 6) peer (2nd tab, ?harborbc test channel): they see your pirate do Arr!
    if PEER:
      await pg.evaluate("(()=>{ const d = PFP.dock, h = window.__home; d.walker.enter(h[0], h[1], h[2]); __sim(1.0); })()")
      pg2, errs2 = await boot(ctx, mob, q); await ashore(pg2, 3)
      try: await pg2.wait_for_function('PFP.dock.fnet.peers.size > 0', timeout=60000)
      except Exception as e: pass
      n = await pg2.evaluate('PFP.dock.fnet.peers.size'); await emote(pg, 0); await pg.wait_for_timeout(1500)
      ps = await pg2.evaluate("[...PFP.dock.fnet.peers.values()].map(p => p.pirate.object.userData.emote?.e ?? null)")
      check('peer_sees_emote', n > 0 and 0 in ps, {'peers': n, 'emotes': ps}); errs += ['tab2 ' + e for e in errs2]
    json.dump({'checks': R, 'errors': errs[:20]}, open(f'{OUT}/{DEV}_emote_game.json', 'w'), indent=1); print(json.dumps({'fails': fails, 'errors': errs[:12]})); await b.close()
asyncio.run(main())
