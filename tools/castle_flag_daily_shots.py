# [castle-flag-daily] flag down / mid-raise / raised+toast / already-claimed. One headless Chrome.
# python3 tools/castle_flag_daily_shots.py WORKTREE OUTDIR desktop|phone PREFIX [port]
import asyncio, sys, json, os
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
INIT = """localStorage.setItem('pfp_name','FLAG_DAILY_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_tutorial_off','1');localStorage.setItem('pfp_gfx_hint','1');
try{const o=JSON.parse(localStorage.getItem('pfp_isle_v1')||'{}');delete o.fortFlag;localStorage.setItem('pfp_isle_v1',JSON.stringify(o));localStorage.removeItem('pfp_owner_daily_v1')}catch(e){}"""
WT, OUT, DEV, PRE = sys.argv[1:5]
PORT = sys.argv[5] if len(sys.argv) > 5 else '18960'
os.makedirs(OUT, exist_ok=True)

async def boot(pg, mob):
  q = 'quality=low'
  url = f'http://127.0.0.1:{PORT}/{WT}/index.html?{q}'
  print('GOTO', url, flush=True)
  await pg.goto(url, wait_until='domcontentloaded')
  await pg.wait_for_function('window.PFP && PFP.renderer', timeout=240000)
  await pg.wait_for_timeout(1500)
  if mob: await pg.tap('#btn-pvp')
  else: await pg.click('#btn-pvp')
  await pg.wait_for_function('PFP.dock && PFP.dock.on', timeout=240000)
  await pg.evaluate("document.getElementById('pvp-entry-go')?.click()")
  await pg.wait_for_timeout(3000)
  await pg.evaluate("""(()=>{ PFP.game.stormOverride=0; PFP.game.storm=0; const d=PFP.dock;
    for (const b of d.layout.berths) { try { d.dockAt(b.id); } catch(e) {} if (d.docking.mode !== 'sea') break; }
    if (d.docking.mode === 'sea' && d.layout.berths[0]) try { d.dockAt(d.layout.berths[0].id); } catch(e) {} })()""")
  try:
    await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=120000)
  except Exception as e:
    mode = await pg.evaluate("({mode:PFP.dock?.docking?.mode, on:!!PFP.dock?.on, berths:(PFP.dock?.layout?.berths||[]).length})")
    print('DOCK FAIL', mode, e, flush=True)
    raise
  await pg.evaluate('PFP.dock.goAshore()')
  await pg.wait_for_function('PFP.dock.onFoot', timeout=180000)
  await pg.wait_for_timeout(1500)

async def at_flag(pg, *, claimed=False, gold_ready=True):
  return await pg.evaluate("""([claimed, goldReady]) => {
    const d = PFP.dock, w = d.walker.w;
    // force fort area meshes to build
    try { d.world.foot.areas.update({x:-414, z:-50}, PFP.game?.t || 0, true); } catch(e) {}
    // stub holder + claim (supabase is blocked in shots)
    const pv = PFP.pvp; if (pv) {
      if (!pv.holder) pv.holder = {};
      Object.assign(pv.holder, { on: !!goldReady, claimed: !!claimed, checked: true });
      pv.claimHolderGold = async (opts) => {
        if (pv.holder.claimed) { const e = new Error('already claimed today'); e.status = 409; throw e; }
        pv.holder.claimed = true; PFP.game.gold = (PFP.game.gold|0) + 100;
        try { const m = await import('./js/island/areas/fort.js'); m.markFortFlagRaised(); } catch(e) {}
        return { ok: true, gold: 100, day: 'shot', owner: true };
      };
    }
    globalThis.__pfpFlagDailyHolder = { on: !!goldReady, claimed: !!claimed, checked: true };
    if (claimed) {
      try { const o = JSON.parse(localStorage.getItem('pfp_isle_v1')||'{}');
        const day = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Indiana/Indianapolis'}).format(new Date());
        o.fortFlag = day; localStorage.setItem('pfp_isle_v1', JSON.stringify(o)); } catch(e) {}
    } else {
      try { const o = JSON.parse(localStorage.getItem('pfp_isle_v1')||'{}'); delete o.fortFlag; localStorage.setItem('pfp_isle_v1', JSON.stringify(o)); } catch(e) {}
    }
    // teleport to fort_flag interact (harbor frame)
    const q = (d.world.footInteract||[]).find(x => x.id === 'fort_flag' || x.src?.id === 'fort_flag');
    if (!q) return { ok:false, why:'no fort_flag interact' };
    w.x = q.x; w.z = q.z; w.y = d.world.ground(q.x, q.z);
    // face the mast (slightly west of interact — mast is at interact - 1.2 in foot x)
    w.yaw = Math.PI * 0.15; w.camYaw = w.yaw + 0.35; w.pitch = 0.18; w.dist = 6.5;
    d.walker.snapCam?.();
    // if claimed, raise immediately so the cloth is at the top
    if (claimed) { try { d.world.foot.areas.activate(q.src || q, PFP.game?.t||0, { holder:()=>({on:true,claimed:true,checked:true}) }); } catch(e) {} }
    return { ok:true, x:+w.x.toFixed(2), z:+w.z.toFixed(2), y:+w.y.toFixed(2), label:q.label, r:q.r };
  }""", [claimed, gold_ready])

async def prompt(pg):
  return await pg.evaluate("""() => {
    const acts = [...document.querySelectorAll('#dk-acts button')].filter(b => !b.hidden && b.offsetParent)
      .map(b => ({ text: b.innerText.replace(/\\s+/g,' ').trim(), primary: b.classList.contains('primary') }));
    const toast = document.getElementById('dk-toast');
    return { acts, toast: toast ? { text: toast.innerText.replace(/\\s+/g,' ').trim(), opacity: getComputedStyle(toast).opacity } : null,
      holder: globalThis.__pfpFlagDailyHolder || null };
  }""")

async def flag_y(pg):
  return await pg.evaluate("""() => {
    let y = null, found = false;
    const root = PFP.dock?.world?.foot?.root || PFP.scene;
    root?.traverse?.(o => { if (o.name === 'fort_pfp_flag') { found = true; y = o.parent?.position?.y; } });
    return { found, y: y == null ? null : +y.toFixed(2) };
  }""")

async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    pid = getattr(getattr(b, 'process', None), 'pid', None)
    print('chrome pid', pid, flush=True)
    mob = DEV == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1280, 'height': 720})
    ctx = await b.new_context(**kw, service_workers='block')
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.add_init_script(INIT)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)[:200]))
    await boot(pg, mob)
    info = {'errs': [], 'shots': {}}

    async def flag_api(op):
      return await pg.evaluate("""(op) => {
        const areas = PFP.dock?.world?.foot?.areas; if (!areas) return { ok:false };
        // find hilltop_fort build via activate's owner — poke through loaded list + private S by raising via activate side effects
        const q = (PFP.dock.world.footInteract||[]).find(x => (x.src||x).id === 'fort_flag');
        const src = q?.src || q;
        // walk the area root's userData? Fall back: traverse + direct y, and call raise/lower if we stashed them
        const root = PFP.dock.world.foot.root;
        let b = null;
        // areas module keeps S private; recover raise/lower from a prior stash or by activate
        if (!globalThis.__pfpFortFlagBuild) {
          // stash by calling activate with a no-op claim that still gets b
          try { areas.activate(src, 0, { holder:()=>({on:false,claimed:false}), claimDaily:()=>Promise.resolve(null) }); } catch(e) {}
        }
        root?.traverse?.(o => { if (o.name === 'fort_pfp_flag') globalThis.__pfpFortFlagMesh = o.parent; });
        const flag = globalThis.__pfpFortFlagMesh;
        if (op === 'down') {
          try { const o = JSON.parse(localStorage.getItem('pfp_isle_v1')||'{}'); delete o.fortFlag; localStorage.setItem('pfp_isle_v1', JSON.stringify(o)); } catch(e) {}
          if (flag) flag.position.y = 36 + 3.4;
          return { ok:true, y: flag ? +flag.position.y.toFixed(2) : null };
        }
        if (op === 'mid') {
          try { const o = JSON.parse(localStorage.getItem('pfp_isle_v1')||'{}'); delete o.fortFlag; localStorage.setItem('pfp_isle_v1', JSON.stringify(o)); } catch(e) {}
          if (flag) flag.position.y = 36 + 7.5; return { ok:true, y: flag ? +flag.position.y.toFixed(2) : null };
        }
        if (op === 'up') {
          try { const o = JSON.parse(localStorage.getItem('pfp_isle_v1')||'{}');
            o.fortFlag = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Indiana/Indianapolis'}).format(new Date());
            localStorage.setItem('pfp_isle_v1', JSON.stringify(o)); } catch(e) {}
          if (flag) flag.position.y = 36 + 11.5; return { ok:true, y: flag ? +flag.position.y.toFixed(2) : null };
        }
        return { ok:false };
      }""", op)

    # 1) flag down + prompt
    pos = await at_flag(pg, claimed=False, gold_ready=True)
    await flag_api('down')
    for _ in range(8):
      await pg.wait_for_timeout(250)
    # freeze flag at bottom for the shot (tick may try to climb if fortFlag set)
    await flag_api('down')
    pr = await prompt(pg); fy = await flag_y(pg)
    path = f'{OUT}/{PRE}_{DEV}_flag_down.png'
    await pg.screenshot(path=path)
    info['shots']['flag_down'] = {'pos': pos, 'prompt': pr, 'flag': fy, 'path': path}
    print('flag_down', pr.get('acts'), fy, flush=True)

    # 2) mid-raise: press E (starts claim + toast), park cloth halfway while toast is fresh
    if mob: await pg.tap('#dk-acts button.primary, #dk-acts button')
    else: await pg.keyboard.press('KeyE')
    await pg.wait_for_timeout(250)
    await flag_api('mid')
    await pg.wait_for_timeout(50)
    pr2 = await prompt(pg); fy2 = await flag_y(pg)
    path2 = f'{OUT}/{PRE}_{DEV}_mid_raise.png'
    await pg.screenshot(path=path2)
    info['shots']['mid_raise'] = {'prompt': pr2, 'flag': fy2, 'path': path2}
    print('mid_raise', pr2.get('toast'), fy2, flush=True)

    # 3) raised + reward toast
    await flag_api('up')
    await pg.evaluate("""() => {
      const el = document.getElementById('dk-toast');
      if (el) { el.innerHTML = 'THE JOLLY ROGER FLIES · +100 DAILY GOLD!<br><small>come back tomorrow · resets in 12h</small>'; el.style.opacity = 1; }
    }""")
    await pg.wait_for_timeout(300)
    pr3 = await prompt(pg); fy3 = await flag_y(pg)
    path3 = f'{OUT}/{PRE}_{DEV}_raised_toast.png'
    await pg.screenshot(path=path3)
    info['shots']['raised_toast'] = {'prompt': pr3, 'flag': fy3, 'path': path3}
    print('raised_toast', pr3.get('toast'), fy3, flush=True)

    # 4) already-claimed state
    pos4 = await at_flag(pg, claimed=True, gold_ready=True)
    await flag_api('up')
    for _ in range(8):
      await pg.wait_for_timeout(250)
    await flag_api('up')
    if mob: await pg.tap('#dk-acts button.primary, #dk-acts button')
    else: await pg.keyboard.press('KeyE')
    await pg.wait_for_timeout(500)
    pr4 = await prompt(pg); fy4 = await flag_y(pg)
    path4 = f'{OUT}/{PRE}_{DEV}_claimed.png'
    await pg.screenshot(path=path4)
    info['shots']['claimed'] = {'pos': pos4, 'prompt': pr4, 'flag': fy4, 'path': path4}
    print('claimed', pr4.get('acts'), pr4.get('toast'), fy4, flush=True)

    info['errs'] = errs[:12]
    info['chrome_pid'] = pid
    open(f'{OUT}/{PRE}_{DEV}_meta.json','w').write(json.dumps(info, indent=2))
    print('DONE', PRE, DEV, 'errs', len(errs), flush=True)
    await b.close()

asyncio.run(main())
