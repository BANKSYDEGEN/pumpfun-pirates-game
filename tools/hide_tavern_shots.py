# [hide-tavern] before/after shots of TAVERN + BOUNTY BOARD walk-near buttons at empty rental lots.
# python3 tools/hide_tavern_shots.py WORKTREE OUTDIR desktop|phone PREFIX [query] [port]
import asyncio, sys, json, os
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
INIT = "localStorage.setItem('pfp_name','HIDE_TAVERN_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_tutorial_off','1');localStorage.setItem('pfp_gfx_hint','1')"
WT, OUT, DEV, PRE = sys.argv[1:5]
Q = sys.argv[5] if len(sys.argv) > 5 else ''
PORT = sys.argv[6] if len(sys.argv) > 6 else '18960'
os.makedirs(OUT, exist_ok=True)
# stand in the street in front of L1 / L4 doors (town-local), facing the facade
SPOTS = {
  'tavern_L1': (1.5, -83.1, -6.0, -83.1),
  'bounty_L4': (1.5, -114.1, -6.0, -114.1),
}

async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    print('chrome pid', getattr(getattr(b, 'process', None), 'pid', '?'), flush=True)
    mob = DEV == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1600, 'height': 900})
    ctx = await b.new_context(**kw, service_workers='block')
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    await ctx.add_init_script(INIT)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)[:180]))
    q = '&'.join(x for x in [Q, f"quality={'low' if mob else 'high'}"] if x)
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
      for (const b of d.layout.berths) { d.dockAt(b.id); if (d.docking.mode !== 'sea') break; } })()""")
    await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=300000)
    await pg.evaluate('PFP.dock.goAshore()')
    await pg.wait_for_function('PFP.dock.onFoot', timeout=180000)
    await pg.wait_for_timeout(1500)
    info = {'errs': errs[:8], 'spots': {}}
    for name, (lx, lz, flx, flz) in SPOTS.items():
      pos = await pg.evaluate("""([lx,lz,flx,flz])=>{
        const d=PFP.dock, CO=d.layout.CO, H=(a,b)=>d.layout.footToHarbor(...CO.t2w(a,b));
        const w=d.walker.w, [x,z]=H(lx,lz), [x2,z2]=H(flx,flz);
        w.x=x; w.z=z; w.y=d.world.ground(x,z); w.yaw=Math.atan2(x2-x, z2-z); w.camYaw=w.yaw; w.pitch=0.1; w.dist=5.2;
        d.walker.snapCam?.(); return {x:+x.toFixed(2), z:+z.toFixed(2), lx, lz};
      }""", [lx, lz, flx, flz])
      # let the prompt tick run
      for _ in range(8):
        await pg.wait_for_timeout(400)
        await pg.evaluate('PFP.dock.walker?.tick?.(0.05)')
      pr = await pg.evaluate("""()=>{
        const d=PFP.dock;
        const acts=[...document.querySelectorAll('#dk-acts button')].filter(b=>!b.hidden && b.offsetParent).map(b=>({text:b.innerText.replace(/\\s+/g,' ').trim(), primary:b.classList.contains('primary')}));
        const inter=(d.layout.interact||[]).filter(q=>q.kind==='tavern'||q.kind==='bounties');
        const near=(d.layout.interact||[]).map(q=>{ const W=d.walker.w; return {id:q.id,kind:q.kind,label:q.label,d:+Math.hypot(q.x-W.x,q.z-W.z).toFixed(2),r:q.r}; })
          .filter(q=>q.d < 8).sort((a,b)=>a.d-b.d).slice(0,6);
        return { showTavern:!!d.layout.CO?.SHOW_TAVERN, showBounty:!!d.layout.CO?.SHOW_BOUNTY_BOARDS,
          interact: inter.map(q=>({id:q.id,kind:q.kind,label:q.label})), acts, near,
          actsDisplay: getComputedStyle(document.getElementById('dk-acts')||document.body).display };
      }""")
      path = f'{OUT}/{PRE}_{DEV}_{name}.png'
      await pg.screenshot(path=path, full_page=False)
      info['spots'][name] = {'pos': pos, **pr}
      print(name, 'acts=', pr.get('acts'), 'tbInteract=', pr.get('interact'), 'near=', pr.get('near')[:3], flush=True)
    open(f'{OUT}/{PRE}_{DEV}_probe.json','w').write(json.dumps(info, indent=2))
    print('DONE', PRE, DEV, 'errs', len(errs), flush=True)
    await b.close()

asyncio.run(main())
