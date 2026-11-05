# Musket arm before/after shots: desktop 1280x800 + phone 390x844, behind + side.
import asyncio, json, os, sys
from playwright.async_api import async_playwright

ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
BASE=os.environ.get('MUSKET_QA_URL', 'http://127.0.0.1:18960/emerly-musket-arm')
TAG=sys.argv[1] if len(sys.argv)>1 else 'after'  # before|after
QS=sys.argv[2] if len(sys.argv)>2 else ''
OUT=os.environ.get('MUSKET_QA_OUT', f'/workspace/emerly-musket-arm-shots/{TAG}')
os.makedirs(OUT, exist_ok=True)

JS_PRE = """window.__bt = (async()=>{ const CO = await import('./js/island/coast.js'), BA = await import('./js/island/battleAreas.js');
  const d = PFP.dock, L = d.layout, H = (lx, lz) => L.footToHarbor(...CO.t2w(lx, lz));
  const put = (lx, lz, faceLx, faceLz, opt={}) => { const w = d.walker.w, [x, z] = H(lx, lz), [x2, z2] = H(faceLx, faceLz);
    w.x = x; w.z = z; w.y = d.world.ground(x, z); w.yaw = Math.atan2(x2 - x, z2 - z); w.camYaw = w.yaw + (opt.dy||0);
    if (opt.pitch!=null) w.pitch = opt.pitch; if (opt.dist!=null) w.dist = opt.dist; d.walker.snapCam(); return [x, z]; };
  return { CO, BA, H, put }; })();"""

DIAG = """(async()=>{
  const THREE = await import('./vendor/three-0.165.0/build/three.module.js');
  const b = PFP.dock.battle, R = b.rig, fig = R?.fig, v4 = fig?.userData?.v4, B = R?.bones || {};
  const rootQ = new THREE.Quaternion(); fig?.getWorldQuaternion(rootQ);
  const dump = (bone) => { if (!bone) return {missing:true}; const wp=new THREE.Vector3(), wq=new THREE.Quaternion();
    bone.updateWorldMatrix(true,false); bone.getWorldPosition(wp); bone.getWorldQuaternion(wq);
    const negX=new THREE.Vector3(-1,0,0).applyQuaternion(wq); const d=negX.clone().applyQuaternion(rootQ.clone().invert());
    return { name: bone.name, dirPirate: [+d.x.toFixed(3), +d.y.toFixed(3), +d.z.toFixed(3)],
      wPos: [+wp.x.toFixed(3),+wp.y.toFixed(3),+wp.z.toFixed(3)] }; };
  let coat=null; fig?.traverse(o=>{ if (o.isSkinnedMesh && /coat|suit/i.test(o.name)) coat=o.name; });
  return { zone:b.zone, stW:R?.st?.w, bones:{uR:!!B.uR,fR:!!B.fR,uL:!!B.uL,fL:!!B.fL},
    arms:{uR:dump(B.uR),fR:dump(B.fR),uL:dump(B.uL),fL:dump(B.fL)},
    musket: R?.musket ? { parent: R.musket.parent?.name || R.musket.parent?.uuid?.slice(0,8), local: R.musket.position.toArray().map(v=>+v.toFixed(3)), id:R.musketId } : null,
    coat, v6:!!v4?.v6, search: location.search };
})()"""

async def run_dev(p, DEV):
  b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
  print('chrome pid', getattr(b, 'process', None).pid if getattr(b, 'process', None) else '?', flush=True)
  mob = DEV != 'desktop'
  kw = dict(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width':1280,'height':800})
  ctx = await b.new_context(service_workers='block', **kw)
  await ctx.route('**/*supabase.co/**', lambda r: r.abort())
  await ctx.add_init_script("try{localStorage.setItem('pfp_name','MUSKET_ARM_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_tutorial_off','1');localStorage.setItem('pfp_gfx_hint','1')}catch(e){}")
  pg = await ctx.new_page()
  url = f'{BASE}/index.html?quality={"low" if mob else "high"}{QS}'
  print('goto', url, flush=True)
  await pg.goto(url, wait_until='domcontentloaded', timeout=300000)
  await pg.wait_for_function('window.PFP && PFP.renderer', timeout=400000); await pg.wait_for_timeout(1200)
  await (pg.tap('#btn-pvp') if mob else pg.click('#btn-pvp'))
  await pg.wait_for_function("PFP.dock && PFP.dock.on", timeout=240000)
  await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(2000)
  await pg.evaluate("(()=>{PFP.game.stormOverride=0;PFP.game.storm=0;const d=PFP.dock; for (const b of d.layout.berths) { d.dockAt(b.id); if (d.docking.mode !== 'sea') break; } })()")
  await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=600000)
  await pg.evaluate("PFP.dock.goAshore()"); await pg.wait_for_function('PFP.dock.onFoot', timeout=600000); await pg.wait_for_timeout(1200)
  # equip coat + cape + crown if possible
  await pg.evaluate("""(async()=>{
    try {
      const S = window.PFP_ISLAND_SHOP;
      if (S?.setShopProvider) S.setShopProvider(S.mockProvider({ owner:true, gold:999999,
        owned:{ skins:['classic'], gear:['hat:crown','outfit:cloth_coat','cape:cape_captain','sword:cutlass','musket:navy'] },
        equipped:{ skin:'classic', gear:{ hat:'crown', outfit:'cloth_coat', cape:'cape_captain', sword:'cutlass', musket:'navy', eyes:'plain', hook:'none', leg:'none', face:'none', parrot:'none' } } }));
      if (window.PFP_GEAR?.setLocalGear) PFP_GEAR.setLocalGear({ hat:'crown', outfit:'cloth_coat', cape:'cape_captain', sword:'cutlass', musket:'navy' });
    } catch(e) { console.warn('gear', e); }
  })()""")
  await pg.wait_for_timeout(2500)
  await pg.evaluate(JS_PRE); await pg.evaluate("window.__bt")
  await pg.evaluate("""window.__bt.then(t => { const R = t.BA.RANGE; t.put(R.lanes[1] + 0.6, R.line + 1.2, R.lanes[1], R.targetLz, { pitch: 0.18, dist: 3.6 }); })""")
  await pg.wait_for_timeout(3500)
  zone = await pg.evaluate("PFP.dock.battle.zone"); print(DEV, 'zone', zone, flush=True)
  assert zone == 2, f"Not in musket range: {zone}"
  if not mob:
    # Aim at background, not the centred avatar, so both held-arm states are visible.
    await pg.mouse.move(850,400)
  # Fixed three-quarter inspection camera: the old phone orbit entered the character/bench.
  # This is QA framing only; production TPS, pose, and ADS remain running.
  await pg.evaluate("""() => {
    const w=PFP.dock.walker.w, c=PFP.camera, yaw=w.yaw;
    const dist=innerWidth<600 ? 3.8 : 3.5;
    w.camHook=() => {
      const a=yaw+Math.PI*0.5;
      c.position.set(w.x+Math.sin(a)*dist, w.y+2.15, w.z+Math.cos(a)*dist);
      c.lookAt(w.x,w.y+1.05,w.z);
      if (innerWidth<600) { c.zoom=1+.5*PFP.dock.battle.tps.st.ads; c.updateProjectionMatrix(); }
    };
  }""")
  await pg.wait_for_timeout(1000)
  await pg.wait_for_function('PFP.dock.battle.rig?.st.w > .99', timeout=120000)
  diag = await pg.evaluate(DIAG)
  assert all(diag['bones'].values()), 'Missing arm bones'
  assert diag['stW'] > .99, 'Arm pose has not blended in'
  await pg.screenshot(path=f'{OUT}/{DEV}_idle.png')
  if mob:
    await pg.dispatch_event('#tps-ads','pointerdown', {'pointerId':7,'pointerType':'touch','bubbles':True})
  else:
    await pg.mouse.move(850,400)
    await pg.mouse.down(button='right')
  await pg.wait_for_function('PFP.dock.battle.tps.st.ads > .95', timeout=120000)
  await pg.wait_for_timeout(600)
  await pg.screenshot(path=f'{OUT}/{DEV}_aiming.png')
  aiming = await pg.evaluate(DIAG)
  aiming['ads'] = await pg.evaluate('PFP.dock.battle.tps.st.ads')
  # Verify the actual loaded parent agrees with the URL kill switch.
  parent_ok = await pg.evaluate("""() => {
    const r=PFP.dock.battle.rig;
    return r.musket.parent === (new URLSearchParams(location.search).get('musketarm')==='0' ? r.fig : r.v4.root);
  }""")
  assert parent_ok, 'Musket attachment does not match kill switch'
  open(f'{OUT}/{DEV}_idle_diag.json','w').write(json.dumps(diag, indent=2))
  open(f'{OUT}/{DEV}_aiming_diag.json','w').write(json.dumps(aiming, indent=2))
  print(DEV, 'PASS: idle + ADS; attachment verified', flush=True)
  await b.close()
  return diag

async def main():
  async with async_playwright() as p:
    for DEV in os.environ.get('MUSKET_QA_DEVICES', 'desktop,phone').split(','):
      await run_dev(p, DEV)

asyncio.run(main())
