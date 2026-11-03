# PUMPFUN PIRATES battle areas, in the real game (index.html -> harbor -> dock -> ashore): WEAPON STORE, MUSKET RANGE + SWORD PIT
# fights against a simulated peer (fake room messages through PFP.dock.onPeerState). usage: python3 battle_game.py desktop|phone
# Frame strips use a slowed swing / musket (ARENA timings x SLOW, in this test page only) so a headless renderer can catch the motion.
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT=os.environ.get('WT','emerly-battle'); DEV=sys.argv[1]; OUT=f'/workspace/{WT}/screens/battle'; os.makedirs(OUT+'/frames', exist_ok=True)
PEER='pq7test01'
JS_PRE = """window.__bt = (async()=>{ const CO = await import('./js/island/coast.js'), BA = await import('./js/island/battleAreas.js'), BM = await import('./js/onfoot/battle.js');
  const d = PFP.dock, L = d.layout, H = (lx, lz) => L.footToHarbor(...CO.t2w(lx, lz));
  const put = (lx, lz, faceLx, faceLz, cam = {}) => { const w = d.walker.w, [x, z] = H(lx, lz), [x2, z2] = H(faceLx, faceLz); w.x = x; w.z = z; w.y = d.world.ground(x, z); w.yaw = Math.atan2(x2 - x, z2 - z); w.camYaw = w.yaw + (cam.dy || 0); w.pitch = cam.pitch ?? 0.28; w.dist = cam.dist ?? 7; d.walker.snapCam(); return [x, z]; };
  const myId = () => (window.PFP?.pvp?.myId || PFP.dock.netState().i || 'me');
  const bt = d.battle, orig = bt.tick; let last = [true, null]; window.__freeze = false;   // test-only: freeze / single-step the battle clock for frame strips
  bt.tick = (dt, o, p) => { last = [o, p]; return orig(window.__freeze ? 0 : dt, o, p); }; window.__step = (s) => { for (let k = 0; k < Math.ceil(s / 0.02); k++) orig(s / Math.ceil(s / 0.02), ...last); };
  return { CO, BA, BM, H, put, myId }; })();"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob = DEV != 'desktop'
    kw = dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width':1280,'height':720})
    ctx = await b.new_context(**kw)
    async def cors(r):
      if r.request.method == 'OPTIONS': return await r.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS'})
      resp = await r.fetch(); h = dict(resp.headers); h['access-control-allow-origin'] = '*'; await r.fulfill(response=resp, headers=h)
    await ctx.route('**/functions/v1/**', cors)
    await ctx.add_init_script("localStorage.setItem('pfp_name','BATTLE_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_gfx_hint','1')")
    pg = await ctx.new_page(); errs = []; claims = []; pg.on('request', lambda q: claims.append(q.url) if 'claim' in q.url or 'claim' in (q.post_data or '') else None); pg.on('pageerror', lambda e: errs.append('PAGE '+str(e)))
    pg.on('console', lambda m: errs.append(m.type+': '+m.text[:200]) if m.type in ('error','warning') and 'battle' in m.text.lower() or m.type=='error' else None); R = {}
    shot = lambda name: pg.screenshot(path=f'{OUT}/{DEV}_{name}.png')
    await pg.goto(f'http://127.0.0.1:18960/{WT}/index.html'); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=180000); await pg.wait_for_timeout(2000)
    await (pg.tap('#btn-pvp') if mob else pg.click('#btn-pvp'))
    await pg.wait_for_function("PFP.dock && PFP.dock.on", timeout=240000); await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(3000)
    await pg.evaluate("(()=>{PFP.game.stormOverride=0;PFP.game.storm=0;const d=PFP.dock; for (const b of d.layout.berths) { d.dockAt(b.id); if (d.docking.mode !== 'sea') break; } })()")
    await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=600000)
    await pg.evaluate("PFP.dock.goAshore()"); await pg.wait_for_function('PFP.dock.onFoot', timeout=600000); await pg.wait_for_timeout(1500)
    await pg.evaluate(JS_PRE); await pg.evaluate("window.__bt")
    # [Emerly] the store needs a shop provider: headless has no live account, so the live provider's shop_state answers 'no identity' and
    # openShop() returns false ('THE SHOP IS CLOSED'). The MOCK provider applies the same rules (price, goal, gold) with no server call.
    await pg.evaluate("(()=>{ const S = window.PFP_ISLAND_SHOP; S.setShopProvider(S.mockProvider({ gold: 30000, stats: { kills: 412, deaths: 90, botKills: 300, harborKills: 500, bossKills: 31, goldEarned: 90000, sqWins: 3, bestStreak: 4 } })); })()")
    R['battle'] = await pg.evaluate("!!PFP.dock.battle && !!PFP.dock.battle.store")
    R['myId'] = await pg.evaluate("window.__bt.then(t => t.myId())")
    # ---- WEAPON STORE (placeholder trigger on the plaza's south edge; the building is the Blender plaza branch's) ----
    await pg.evaluate("""(()=>{ const s = PFP.dock.battle.store, w = PFP.dock.walker.w; w.x = s.q.x; w.z = s.q.z; w.y = PFP.dock.world.ground(w.x, w.z); w.yaw = Math.atan2(s.g.position.x - w.x, s.g.position.z - w.z); w.camYaw = w.yaw + 0.5; w.pitch = 0.2; w.dist = 6; PFP.dock.walker.snapCam(); })()""")
    await pg.wait_for_timeout(2500); R['store_prompt'] = await pg.evaluate("document.getElementById('dk-acts')?.innerText || ''"); R['store_blocked'] = await pg.evaluate("(()=>{ const s = PFP.dock.battle.store.q, W = PFP.dock.world; return { ground: +W.ground(s.x, s.z).toFixed(2), blockedIn: W.blocked(s.x, s.z + 1, s.x, s.z) }; })()"); await shot('store_trigger'); print('store', flush=True)
    if mob: await pg.evaluate("document.querySelector('#dk-acts button')?.click()")
    else: await pg.keyboard.press('KeyE')
    await pg.wait_for_timeout(3000)
    shop = "(()=>{ const s = document.getElementById('island-shop'); return s ? { open: !s.classList.contains('hidden'), title: s.querySelector('.ishop-title')?.innerText.replace(/\\s+/g, ' '), tabs: [...s.querySelectorAll('.ishop-tabs button')].map(b => b.innerText + (b.classList.contains('on') ? '*' : '')), cards: [...s.querySelectorAll('.ishop-card')].map(c => c.innerText.replace(/\\s+/g, ' ').slice(0, 50)), detail: s.querySelector('.ishop-detail')?.innerText.replace(/\\s+/g, ' ').slice(0, 260) } : null; })()"
    R['shop_swords'] = await pg.evaluate(shop); await shot('store_swords')
    cards = await pg.query_selector_all('.ishop-card')
    if len(cards) > 4: await cards[4].click(); await pg.wait_for_timeout(1500); R['shop_sword_detail'] = await pg.evaluate(shop); await shot('store_sword_detail')
    await pg.click('.ishop-tabs button[data-tab="muskets"]'); await pg.wait_for_timeout(2000); R['shop_muskets'] = await pg.evaluate(shop); await shot('store_muskets')
    cards = await pg.query_selector_all('.ishop-card')
    if len(cards) > 2: await cards[2].click(); await pg.wait_for_timeout(1500); R['shop_musket_detail'] = await pg.evaluate(shop); await shot('store_musket_detail')
    await pg.evaluate("document.querySelector('.ishop-x')?.click()"); await pg.wait_for_timeout(800)
    R['openWeaponStore'] = await pg.evaluate("Promise.resolve(window.openWeaponStore('muskets')).then(() => new Promise(r => setTimeout(() => { const s = document.getElementById('island-shop'); r({ open: !s.classList.contains('hidden'), tab: s.dataset.tab }); document.querySelector('.ishop-x')?.click(); }, 1500)))")
    await pg.wait_for_timeout(800)
    # ---- MUSKET RANGE: targets ----
    await pg.evaluate("window.__bt.then(t => { const R = t.BA.RANGE; t.put(R.lanes[1], R.line + 1.2, R.lanes[1], R.targetLz, { dy: 0.0, pitch: 0.12, dist: 4.2 }); })")
    await pg.wait_for_timeout(2500); R['rangeZone'] = await pg.evaluate("PFP.dock.battle.zone"); await shot('range')
    await pg.evaluate("window.__bt.then(t => { const R = t.BA.RANGE; t.put(-104, -120, -104, -150, { pitch: 0.42, dist: 15 }); })"); await pg.wait_for_timeout(2000); await shot('range_overview')
    await pg.evaluate("window.__bt.then(t => { const R = t.BA.RANGE; t.put(R.lanes[1], R.line + 1.2, R.lanes[1], R.targetLz, { pitch: 0.1, dist: 4.2 }); })"); await pg.wait_for_timeout(1500)
    R['fireTarget'] = await pg.evaluate("(()=>{ const b = PFP.dock.battle; return b.attack(); })()"); await pg.wait_for_timeout(500)
    R['targetFlipped'] = await pg.evaluate("PFP.dock.battle.targets.map(t => +t.flip.toFixed(2))"); await shot('range_target_hit')
    # ---- musket fight vs a simulated peer ----
    await pg.wait_for_timeout(2200)
    await pg.evaluate("""window.__bt.then(t => { const R = t.BA.RANGE, [px, pz] = t.H(R.lanes[2] + 1, R.line - 12), [mx, mz] = t.H(R.lanes[0], R.line + 1);
      window.__peer = { x: px, z: pz, yaw: Math.atan2(mx - px, mz - pz), life: 777, seq: 0, hp: 100 };
      const P = window.__peer; window.__send = (extra = {}) => PFP.dock.onPeerState({ i: '%s', n: 'SIM PIRATE', dk: '', ft: [P.x, P.z, Math.round(P.yaw * 100), 0], ba: [2, P.hp, P.life, P.seq, P.kind || 0, 2, P.down || 0, 2], ...extra });
      window.__send(); t.put(R.lanes[0], R.line + 1, R.lanes[2] + 1, R.line - 12, { dy: 0.5, pitch: 0.18, dist: 6 }); })""" % PEER)
    await pg.wait_for_timeout(3500); await pg.evaluate("window.__send()")
    await pg.evaluate("window.__bt.then(t => { const w = PFP.dock.walker.w, P = window.__peer; w.camYaw = Math.atan2(P.x - w.x, P.z - w.z); w.yaw = w.camYaw; w.pitch = 0.16; w.dist = 5.5; PFP.dock.walker.snapCam(); })"); await pg.wait_for_timeout(800)
    await pg.evaluate("window.__freeze = true"); R['fireAtPeer'] = await pg.evaluate("PFP.dock.battle.attack()")
    for i, st in enumerate([0, 0.1, 0.075, 0.1, 0.25, 0.6]): await pg.evaluate(f"window.__step({st})"); await pg.wait_for_timeout(250); await pg.screenshot(path=f'{OUT}/frames/{DEV}_musket_{i}.png'); print('musket', i, flush=True)
    await pg.evaluate("window.__freeze = false")
    R['dealtAfterShot'] = await pg.evaluate("PFP.dock.battle.netState()")
    # the peer shoots back twice: bh[myId] = [my life, total] -> I'm knocked out (2 x 50)
    life = await pg.evaluate("PFP.dock.battle.me.life"); me_id = R['myId']
    await pg.evaluate("(([id, life]) => { const P = window.__peer; P.seq++; P.kind = 2; window.__send({ bh: { [id]: [life, 50] } }); })", [me_id, life]); await pg.wait_for_timeout(700)
    R['hpAfter1'] = await pg.evaluate("PFP.dock.battle.me.hp"); await shot('range_got_hit')
    await pg.evaluate("(([id, life]) => { const P = window.__peer; P.seq++; window.__send({ bh: { [id]: [life, 100] } }); })", [me_id, life]); await pg.wait_for_timeout(900)
    R['afterKO'] = await pg.evaluate("(()=>{ const m = PFP.dock.battle.me; return { hp: m.hp, down: +m.down.toFixed(2), downs: m.downs }; })()"); await shot('range_ko')
    R['replay'] = await pg.evaluate("(([id, life]) => { const P = window.__peer; window.__send({ bh: { [id]: [life, 100] } }); return PFP.dock.battle.me.downs; })", [me_id, life])
    await pg.wait_for_function("PFP.dock.battle.me.down <= 0", timeout=120000); await pg.wait_for_timeout(500); R['respawn'] = await pg.evaluate("(()=>{ const m = PFP.dock.battle.me; return { hp: m.hp, down: m.down > 0, life: m.life, zone: m.zone, guard: +m.guard.toFixed(2) }; })()")
    # ---- SWORD PIT ----
    await pg.evaluate("window.__send({ ba: 0, ft: '' })"); await pg.wait_for_timeout(300)
    await pg.evaluate("window.__bt.then(t => { const P = t.BA.PIT, [lx, lz] = t.BA.pitAt(P.gateA, P.r + 9); t.put(lx, lz, P.lx, P.lz, { pitch: 0.4, dist: 13 }); })"); await pg.wait_for_timeout(2500); await shot('pit_gate')
    await pg.evaluate("window.__bt.then(t => { const P = t.BA.PIT; t.put(P.lx + 1.5, P.lz + 1.5, P.lx - 2, P.lz - 2, { dy: 0.9, pitch: 0.2, dist: 6 }); })"); await pg.wait_for_timeout(2500)
    R['pitZone'] = await pg.evaluate("PFP.dock.battle.zone"); await shot('pit')
    await pg.evaluate("""window.__bt.then(t => { const P = t.BA.PIT, w = PFP.dock.walker.w, [px, pz] = t.H(P.lx - 0.2, P.lz - 0.2); const Q = window.__peer; Q.x = px; Q.z = pz; Q.yaw = Math.atan2(w.x - px, w.z - pz); Q.hp = 100; Q.life = 900; Q.seq = 10; Q.kind = 0; Q.down = 0;
      PFP.dock.onPeerState({ i: '%s', n: 'SIM PIRATE', dk: '', ft: [Q.x, Q.z, Math.round(Q.yaw * 100), 0], ba: [1, 100, 900, 10, 0, 4, 0, 0] }); w.yaw = Math.atan2(px - w.x, pz - w.z); w.camYaw = w.yaw + 1.25; w.pitch = 0.16; w.dist = 4.6; PFP.dock.walker.snapCam(); })""" % PEER)
    await pg.wait_for_timeout(3500)
    await pg.evaluate("window.__freeze = true"); R['swing'] = await pg.evaluate("PFP.dock.battle.attack()")
    for i in range(8): await pg.evaluate("window.__step(0.0001)" if i == 0 else "window.__step(0.06)"); await pg.wait_for_timeout(250); await pg.screenshot(path=f'{OUT}/frames/{DEV}_sword_{i}.png'); print('sword', i, flush=True)
    await pg.evaluate("window.__freeze = false"); await pg.wait_for_timeout(600)
    R['dealtAfterSwing'] = await pg.evaluate("PFP.dock.battle.netState()")
    # the peer swings back (shown on their rig), 3 x 34 = KO
    life = await pg.evaluate("PFP.dock.battle.me.life")
    for k, n in enumerate([34, 68, 102]):
      await pg.evaluate("(([id, life, n]) => { const Q = window.__peer; Q.seq++; PFP.dock.onPeerState({ i: '%s', n: 'SIM PIRATE', dk: '', ft: [Q.x, Q.z, Math.round(Q.yaw * 100), 0], ba: [1, 66, 900, Q.seq, 1, 4, 0], bh: { [id]: [life, n] } }); })" % PEER, [me_id, life, n])
      if k == 0: await pg.evaluate("window.__freeze = true; window.__step(0.2)"); await pg.wait_for_timeout(250); await shot('pit_peer_swing'); await pg.evaluate("window.__freeze = false")
      await pg.wait_for_timeout(500)
    R['pitKO'] = await pg.evaluate("(()=>{ const m = PFP.dock.battle.me; return { hp: m.hp, down: m.down > 0, downs: m.downs }; })()"); await shot('pit_ko')
    # peer KO'd by us (their ba down flag) -> our KO tally
    await pg.evaluate("window.__bt.then(t => { const Q = window.__peer; PFP.dock.onPeerState({ i: '%s', n: 'SIM PIRATE', dk: '', ft: [Q.x, Q.z, Math.round(Q.yaw * 100), 0], ba: [1, 0, 900, Q.seq, 1, 4, 1] }); })" % PEER)
    R['myKOs'] = await pg.evaluate("PFP.dock.battle.me.kos")
    await pg.wait_for_function("PFP.dock.battle.me.down <= 0", timeout=120000)
    # no rewards / goals: profile + pvp counters unchanged, nothing sent to pvp_claim_kill (checked by request log below)
    R['profile'] = await pg.evaluate("(()=>{ const p = window.PFP_PVP?.profile; return p ? { gold: p.gold, kills: p.stats?.kills, bossKills: p.stats?.bossKills, sword: p.gear?.sword ?? null } : null; })()")
    R['leave'] = await pg.evaluate("window.__bt.then(t => { t.put(40, -40, 40, -60); return new Promise(r => setTimeout(() => r({ zone: PFP.dock.battle.zone, ba: PFP.dock.netState().ba, hud: getComputedStyle(document.getElementById('bt-hud')).display }), 800)); })")
    R['claimRequests'] = claims; R['errors'] = errs[:12]; json.dump(R, open(f'{OUT}/{DEV}_game.json','w'), indent=1); print(json.dumps(R, indent=1)); await b.close()
asyncio.run(main())
