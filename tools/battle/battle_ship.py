# [Emerly] PUMPFUN PIRATES battle areas release check, in the real game (index.html -> harbor -> dock -> ashore). usage:
#   WT=emerly-battle python3 tools/battle/battle_ship.py desktop|phone
# Covers: docking (no drift), deck crew, followers, the WEAPON STORE (mock shop provider: no live account in headless, so the live
# shop_state answers 'no identity'), SWORDS + MUSKETS tabs, MUSKET RANGE + SWORD PIT, a musket shot + a sword swing (frame strips via
# a test-only freeze / step of battle.tick), a simulated peer fight (KO / respawn / no claim), 2v2 TEAMS with 3 simulated peers, the
# fight sync rate (battle.fastHz), crew followers kept out of the arenas, and the candidate WEAPON STORE doors (shots + coords).
# Nothing is sent to pvp_claim_kill; peers are fake room messages through PFP.dock.onPeerState.
import asyncio, sys, json, os, time; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT=os.environ.get('WT','emerly-battle'); PLAZA=os.environ.get('PLAZA',''); QUAL=os.environ.get('QUAL',''); DEV=sys.argv[1]; TAG=DEV+('_plaza'+PLAZA if PLAZA else '')+('_'+QUAL if QUAL else ''); ONLY=set(sys.argv[2:]); OUT=f'/workspace/{WT}/screens/battle/ship'; os.makedirs(OUT+'/frames', exist_ok=True); os.makedirs(OUT+'/candidates', exist_ok=True)
T0=time.time(); log=lambda *a: print('[%4.0fs]'%(time.time()-T0), *a, flush=True)
want=lambda k: not ONLY or k in ONLY
PRE = """window.__bt = (async()=>{ const CO = await import('./js/island/coast.js'), BA = await import('./js/island/battleAreas.js');
  const d = PFP.dock, L = d.layout, H = (lx, lz) => L.footToHarbor(...CO.t2w(lx, lz));
  const put = (lx, lz, faceLx, faceLz, cam = {}) => { const w = d.walker.w, [x, z] = H(lx, lz), [x2, z2] = H(faceLx, faceLz); w.x = x; w.z = z; w.y = d.world.ground(x, z); w.yaw = Math.atan2(x2 - x, z2 - z); w.camYaw = w.yaw + (cam.dy || 0); w.pitch = cam.pitch ?? 0.28; w.dist = cam.dist ?? 7; d.walker.snapCam(); return [x, z]; };
  const bt = d.battle, orig = bt.tick; let last = [true, null]; window.__freeze = false;
  bt.tick = (dt, o, p) => { last = [o, p]; return orig(window.__freeze ? 0 : dt, o, p); }; window.__step = (s) => { const n = Math.max(1, Math.ceil(s / 0.02)); for (let k = 0; k < n; k++) orig(s / n, ...last); };
  window.__peerMsg = (id, P, extra = {}) => PFP.dock.onPeerState({ i: id, n: P.n || 'SIM', dk: '', ft: [P.x, P.z, Math.round(P.yaw * 100), 0], ba: [P.zone, P.hp ?? 100, P.life ?? 1, P.seq ?? 0, P.kind ?? 0, 2, P.down ?? 0, 2, P.team ?? 0], ...extra });
  return { CO, BA, H, put }; })();"""
SHOP = "(()=>{ const s = document.getElementById('island-shop'); return s ? { open: !s.classList.contains('hidden'), title: s.querySelector('.ishop-title')?.innerText.replace(/\\s+/g, ' '), tab: s.dataset.tab, tabs: [...s.querySelectorAll('.ishop-tabs button')].map(b => b.innerText.trim() + (b.classList.contains('on') ? '*' : '')), cards: [...s.querySelectorAll('.ishop-card')].map(c => c.innerText.replace(/\\s+/g, ' ').slice(0, 60)) } : null; })()"
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
    pg = await ctx.new_page(); pg.set_default_timeout(240000); errs = []; claims = []
    pg.on('request', lambda q: claims.append(q.url) if 'claim' in q.url or 'claim' in (q.post_data or '') else None); pg.on('pageerror', lambda e: errs.append('PAGE '+str(e)))
    pg.on('console', lambda m: errs.append(m.type+': '+m.text[:200]) if m.type=='error' or (m.type=='warning' and 'battle' in m.text.lower()) else None); R = {}
    shot = lambda name: pg.screenshot(path=f'{OUT}/{TAG}_{name}.png')
    ev = pg.evaluate
    await pg.goto(f'http://127.0.0.1:18960/{WT}/index.html?' + '&'.join(x for x in [('plaza='+PLAZA if PLAZA else ''), ('quality='+QUAL if QUAL else '')] if x)); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=300000); await pg.wait_for_timeout(2000); log('loaded')
    await (pg.tap('#btn-pvp') if mob else pg.click('#btn-pvp'))
    await pg.wait_for_function("PFP.dock && PFP.dock.on", timeout=300000); await ev("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(3000); log('harbor')
    await ev("(()=>{PFP.game.stormOverride=0;PFP.game.storm=0;const d=PFP.dock; for (const b of d.layout.berths) { d.dockAt(b.id); if (d.docking.mode !== 'sea') break; } })()")
    await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=900000); log('docked')
    # ---- docking: no drift over 6 s + deck crew present ----
    s0 = await ev("(()=>{ const s = PFP.P ? PFP.P() : (PFP.player || PFP.game.player); return s ? [s.x, s.z, s.yaw] : null; })()")
    await pg.wait_for_timeout(6000)
    s1 = await ev("(()=>{ const s = PFP.P ? PFP.P() : (PFP.player || PFP.game.player); return s ? [s.x, s.z, s.yaw] : null; })()")
    R['dock'] = { 'berth': await ev("PFP.dock.docking.berth?.id"), 'mode': await ev("PFP.dock.docking.mode"), 'drift_m': round(((s1[0]-s0[0])**2+(s1[1]-s0[1])**2)**0.5, 3) if s0 and s1 else None, 's0': s0, 's1': s1 }
    R['deckCrew'] = await ev("(()=>{ let n = 0; PFP.scene.traverse(o => { if (o.isSkinnedMesh) { let v = true; for (let q = o; q; q = q.parent) if (!q.visible) v = false; if (v) n++; } }); return n; })()")
    await shot('docked'); log('dock', R['dock'], 'skinned', R['deckCrew'])
    await ev("PFP.dock.goAshore()"); await pg.wait_for_function('PFP.dock.onFoot', timeout=600000); await pg.wait_for_timeout(2500); log('ashore')
    await ev(PRE); await ev("window.__bt")
    await ev("(()=>{ const S = window.PFP_ISLAND_SHOP; S.setShopProvider(S.mockProvider({ gold: 30000, stats: { kills: 412, deaths: 90, botKills: 300, harborKills: 500, bossKills: 31, goldEarned: 90000, sqWins: 3, bestStreak: 4 } })); })()")
    R['followersAshore'] = await ev("(()=>{ const f = PFP.dock.followers; return f ? { active: f.active, n: f.list.length } : null; })()")
    # ---- followers walk with me (2 s of W) ----
    await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(2500); await pg.keyboard.up('KeyW'); await pg.wait_for_timeout(800)
    R['followersWalk'] = await ev("(()=>{ const f = PFP.dock.followers, w = PFP.dock.walker.w; return f.list.map(c => +Math.hypot(c.x - w.x, c.z - w.z).toFixed(1)); })()"); await shot('followers'); log('followers', R['followersWalk'])
    # ---- the WEAPON SHOPS: SWORD SHOP + MUSKET SHOP (existing Main Street houses; js/island/battleAreas.js SHOPS) ----
    if want('store'):
      R['shops'] = await ev("PFP.dock.battle.shops.map(s => ({ id: s.id, door: s.door.id, name: s.door.name, tab: s.tab, lx: +s.door.lx.toFixed(1), lz: +s.door.lz.toFixed(1), house: s.door.house }))"); log('shops', R['shops'])
      for si, sh in enumerate(R['shops']):
        nm = 'sword_shop' if sh['tab'] == 'swords' else 'musket_shop'
        # the shopfront from across the street
        await ev("""(i => window.__bt.then(t => { const s = PFP.dock.battle.shops[i], d = s.door, f = [Math.sin(d.ly), Math.cos(d.ly)]; t.put(d.lx + f[0] * 2.2, d.lz - 7, d.lx - f[0] * 2, d.lz, { pitch: 0.06, dist: 3.2, dy: 0.15 }); }))""", si)
        await pg.wait_for_timeout(2500); await shot(nm + '_front')
        # walk to the door: prompt, E (desktop) / tap the prompt (phone)
        await ev("""(i => { const s = PFP.dock.battle.shops[i], w = PFP.dock.walker.w; w.x = s.q.x; w.z = s.q.z; w.y = PFP.dock.world.ground(w.x, w.z); w.yaw = Math.atan2(s.g.position.x - w.x, s.g.position.z - w.z); w.camYaw = w.yaw + 0.6; w.pitch = 0.15; w.dist = 6; PFP.dock.walker.snapCam(); })""", si)
        await pg.wait_for_timeout(2500); R[nm + '_prompt'] = await ev("document.getElementById('dk-acts')?.innerText || ''"); await shot(nm + '_door'); log(nm, 'prompt', R[nm + '_prompt'])
        if mob: await ev("[...document.querySelectorAll('#dk-acts button')].find(b => /SWORD SHOP|MUSKET SHOP/.test(b.innerText))?.click()")
        else: await pg.keyboard.press('KeyE')
        await pg.wait_for_timeout(3500); R[nm + '_window'] = await ev(SHOP); await shot(nm + '_window'); log(nm, 'window', R[nm + '_window'])
        cards = await pg.query_selector_all('.ishop-card')
        if len(cards) > 4: await cards[4 if nm == 'sword_shop' else 2].click(); await pg.wait_for_timeout(1500); await shot(nm + '_detail')
        await ev("window.closeShop?.()"); await pg.wait_for_timeout(1000)
      R['openWeaponStore_muskets'] = await ev("Promise.resolve(window.openWeaponStore('muskets')).then(() => new Promise(r => setTimeout(() => { const s = document.getElementById('island-shop'); r({ open: !s.classList.contains('hidden'), tab: s.dataset.tab }); window.closeShop(); }, 1500)))")
      log('openWeaponStore', R['openWeaponStore_muskets'])
      # sorted cheapest first (free at the top) + the owner gets every weapon free
      R['priceOrder'] = await ev("(async (w) => { const C = await import('./js/shopCatalog.js'); const P = (slot) => C.WEAPON_PRICES.filter(r => r[0] === slot); const order = (cards, slot) => cards.map(c => { const r = P(slot).find(r => c.startsWith(r[2])); return r ? r[3] : null; }); return { swords: order(w[0], 'sword'), muskets: order(w[1], 'musket') }; })", [R['sword_shop_window']['cards'], R['musket_shop_window']['cards']])
      R['cheapestFirst'] = all(None not in v and v == sorted(v) for v in R['priceOrder'].values()); log('price order', R['priceOrder'], 'cheapest first', R['cheapestFirst'])
      await ev("(()=>{ const S = window.PFP_ISLAND_SHOP; S.setShopProvider(S.mockProvider({ owner: true, gold: 0 })); })()")
      for tab in ['swords', 'muskets']:
        await ev(f"window.openWeaponStore('{tab}')"); await pg.wait_for_timeout(3000); R['owner_' + tab] = await ev(SHOP); await shot('owner_' + tab); await ev("window.closeShop?.()"); await pg.wait_for_timeout(800)
      log('owner', R['owner_swords'].get('cards'), R['owner_muskets'].get('cards'))
      await ev("(()=>{ const S = window.PFP_ISLAND_SHOP; S.setShopProvider(S.mockProvider({ gold: 30000, stats: { kills: 412, deaths: 90, botKills: 300, harborKills: 500, bossKills: 31, goldEarned: 90000, sqWins: 3, bestStreak: 4 } })); })()")
      R['storeDoors'] = await ev("PFP.dock.battle.storeDoors().map(c => ({ id: c.id, name: c.name, lx: +c.lx.toFixed(1), lz: +c.lz.toFixed(1) }))")
    # ---- MUSKET RANGE ----
    if want('range'):
      await ev("window.__bt.then(t => { const R = t.BA.RANGE; t.put(R.lanes[1], R.line + 1.2, R.lanes[1], R.targetLz, { pitch: 0.12, dist: 4.2 }); })")
      await pg.wait_for_timeout(2500); R['rangeZone'] = await ev("PFP.dock.battle.zone"); await shot('range'); log('range zone', R['rangeZone'])
      R['followersRange'] = await ev("""window.__bt.then(t => new Promise(r => setTimeout(() => { const f = PFP.dock.followers; r(f.list.map(c => { const [lx, lz] = t.CO.w2t(...PFP.dock.layout.harborToFoot(c.x, c.z)); return { lx: +lx.toFixed(1), lz: +lz.toFixed(1), inRange: t.BA.inRange(lx, lz, -0.5) }; })); }, 4000)))""")
      log('followers at range', R['followersRange'])
      await ev("window.__bt.then(t => { t.put(-104, -112, -104, -150, { pitch: 0.45, dist: 18 }); })"); await pg.wait_for_timeout(2500); await shot('range_overview')
      await ev("window.__bt.then(t => { const R = t.BA.RANGE; t.put(R.lanes[1], R.line + 1.2, R.lanes[1], R.targetLz, { pitch: 0.1, dist: 4.2, dy: 0 }); })"); await pg.wait_for_timeout(1500)
      await ev("window.__freeze = true"); R['fireTarget'] = await ev("PFP.dock.battle.attack()")
      for i, st in enumerate([0, 0.1, 0.075, 0.1, 0.25, 0.6]):
        await ev(f"window.__step({st})"); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/frames/{TAG}_musket_{i}.png')
      R['muzzle'] = await ev("(()=>{ const b = PFP.dock.battle, r = b.rig, w = PFP.dock.walker.w; if (!r?.musket) return null; r.musket.updateWorldMatrix(true, false); const e = r.musket.matrixWorld.elements, mz = b.muzzleAt ? b.muzzleAt() : null; return { visible: r.musket.visible, musketWorld: [e[12], e[13], e[14]].map(v => +v.toFixed(2)), me: [w.x, w.y, w.z].map(v => +v.toFixed(2)), muzzle: mz }; })()"); log('muzzle', R['muzzle'])
      await ev("window.__freeze = false"); await pg.wait_for_timeout(600); R['targetFlipped'] = await ev("PFP.dock.battle.targets.map(t => +t.flip.toFixed(2))"); R['aimDbg'] = await ev("(()=>{ const w = PFP.dock.walker.w, t = PFP.dock.battle.targets[1]; return { yaw: +w.yaw.toFixed(3), camYaw: +w.camYaw.toFixed(3), toTarget: +Math.atan2(t.x - w.x, t.z - w.z).toFixed(3), d: +Math.hypot(t.x - w.x, t.z - w.z).toFixed(1) }; })()"); log('aim', R['aimDbg']); log('musket', R['fireTarget'], R['targetFlipped'])
    # ---- SWORD PIT ----
    if want('pit'):
      await ev("window.__bt.then(t => { const P = t.BA.PIT, [lx, lz] = t.BA.pitAt(P.gateA, P.r + 9); t.put(lx, lz, P.lx, P.lz, { pitch: 0.42, dist: 14 }); })"); await pg.wait_for_timeout(2500); await shot('pit_gate')
      await ev("window.__bt.then(t => { const P = t.BA.PIT; t.put(P.lx + 1.5, P.lz + 1.5, P.lx - 2, P.lz - 2, { dy: 0.9, pitch: 0.2, dist: 6 }); })"); await pg.wait_for_timeout(2500)
      R['pitZone'] = await ev("PFP.dock.battle.zone"); await shot('pit')
      R['followersPit'] = await ev("""window.__bt.then(t => new Promise(r => setTimeout(() => { const f = PFP.dock.followers; r(f.list.map(c => { const [lx, lz] = t.CO.w2t(...PFP.dock.layout.harborToFoot(c.x, c.z)); return { r: +Math.hypot(lx - t.BA.PIT.lx, lz - t.BA.PIT.lz).toFixed(1) }; })); }, 4000)))""")
      log('pit', R['pitZone'], 'followers r', R['followersPit'])
      await ev("window.__bt.then(t => { const P = t.BA.PIT, [lx, lz] = t.BA.pitAt(P.gateA, P.r + 6); t.put(lx, lz, P.lx, P.lz, { pitch: 0.35, dist: 6, dy: 2.6 }); })"); await pg.wait_for_timeout(2500); await shot('pit_followers_wait')
      # sword swing vs a simulated peer
      await ev("""window.__bt.then(t => { const P = t.BA.PIT, w = PFP.dock.walker.w; t.put(P.lx + 1.5, P.lz + 1.5, P.lx, P.lz); const [px, pz] = t.H(P.lx - 0.2, P.lz - 0.2);
        window.__Q = { x: px, z: pz, yaw: Math.atan2(w.x - px, w.z - pz), zone: 1, hp: 100, life: 900, seq: 10 }; window.__peerMsg('pq7test01', window.__Q);
        w.yaw = Math.atan2(px - w.x, pz - w.z); w.camYaw = w.yaw + 1.25; w.pitch = 0.16; w.dist = 4.6; PFP.dock.walker.snapCam(); })""")
      await pg.wait_for_timeout(3500); R['fast1v1'] = await ev("PFP.dock.battle.fastHz()")
      await ev("window.__freeze = true"); R['swing'] = await ev("PFP.dock.battle.attack()")
      for i in range(8): await ev("window.__step(0.0001)" if i == 0 else "window.__step(0.06)"); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/frames/{TAG}_sword_{i}.png')
      R['swordScale'] = await ev("(()=>{ const r = PFP.dock.battle.rig; if (!r?.sword) return null; const THREE_V = r.sword.position.constructor, s = new THREE_V(); r.sword.getWorldScale(s); return { worldScale: +s.x.toFixed(3) }; })()")
      await ev("window.__freeze = false"); await pg.wait_for_timeout(600)
      R['dealtAfterSwing'] = await ev("PFP.dock.battle.netState()"); log('swing', R['swing'], R['dealtAfterSwing'], 'fastHz', R['fast1v1'], R['swordScale'])
      # peer KO'd -> my tally; then they hit me 3x = KO + respawn
      life = await ev("PFP.dock.battle.me.life"); me_id = await ev("PFP.dock.netState().i || (window.PFP?.pvp?.myId) || 'me'")
      myid = await ev("(()=>{ try { return PFP.pvp?.myId || null; } catch { return null; } })()") or 'me'
      for k, n in enumerate([34, 68, 102]):
        await ev("(([id, life, n]) => { const Q = window.__Q; Q.seq++; Q.kind = 1; window.__peerMsg('pq7test01', Q, { bh: { [id]: [life, n] } }); })", [myid, life, n]); await pg.wait_for_timeout(500)
      R['pitKO'] = await ev("(()=>{ const m = PFP.dock.battle.me; return { hp: m.hp, down: m.down > 0, downs: m.downs }; })()"); await shot('pit_ko'); log('pitKO', R['pitKO'], 'myid', myid)
      await pg.wait_for_function("PFP.dock.battle.me.down <= 0", timeout=120000)
    # ---- 2v2 TEAMS: me + mate (RED) vs 2 (BLUE) ----
    if want('2v2'):
      await ev("""window.__bt.then(t => { const P = t.BA.PIT, b = PFP.dock.battle; b.setTeam(1); const pts = [[P.lx - 3, P.lz + 2, 1], [P.lx + 3, P.lz - 4, 2], [P.lx - 1, P.lz - 5, 2]];
        window.__T = pts.map(([lx, lz, team], i) => { const [x, z] = t.H(lx, lz); return { id: 'tm2v2p' + i, x, z, yaw: 0, zone: 1, hp: 100, life: 50 + i, seq: 0, team, n: ['MATE', 'BLUE ONE', 'BLUE TWO'][i] }; });
        for (const Q of window.__T) window.__peerMsg(Q.id, Q); t.put(P.lx + 2, P.lz + 6, P.lx, P.lz - 2, { pitch: 0.35, dist: 9, dy: 0.4 }); })""")
      await pg.wait_for_timeout(1200); await ev("for (const Q of window.__T) window.__peerMsg(Q.id, Q)"); await pg.wait_for_timeout(3500)
      await ev("for (const Q of window.__T) window.__peerMsg(Q.id, Q)"); await pg.wait_for_timeout(1500)
      R['teams'] = await ev("(()=>{ const b = PFP.dock.battle; return { me: b.me.team, peers: [...b.peers.values()].map(r => r.team), fastHz: b.fastHz(), hud: document.getElementById('bt-hud').innerText.replace(/\\s+/g, ' ') }; })()")
      await shot('2v2'); log('teams', R['teams'])
      # friendly fire: the mate 'hits' me -> ignored; a BLUE hits me -> applied
      await pg.wait_for_function("PFP.dock.battle.me.guard <= 0 && PFP.dock.battle.me.down <= 0", timeout=300000)
      life = await ev("PFP.dock.battle.me.life")
      await ev("(() => { const Q = window.__T[0], w = PFP.dock.walker.w; Q.x = w.x + 1; Q.z = w.z; for (let j = 0; j < 3; j++) window.__peerMsg(Q.id, Q); })()"); await pg.wait_for_timeout(2500); await ev("(() => { const Q = window.__T[0]; window.__peerMsg(Q.id, Q); })()"); await pg.wait_for_timeout(1500)
      R['peerDist0'] = await ev("(() => { const p = PFP.dock.fnet.peers.get(window.__T[0].id), w = PFP.dock.walker.w; return p ? +Math.hypot(p.x - w.x, p.z - w.z).toFixed(2) : null; })()")
      await ev("(([id, life]) => { const Q = window.__T[0]; Q.seq++; Q.kind = 1; window.__peerMsg(Q.id, Q, { bh: { [id]: [life, 34] } }); })", [myid, life]); await pg.wait_for_timeout(500)
      R['hpAfterMate'] = await ev("PFP.dock.battle.me.hp")
      await ev("(() => { const Q = window.__T[1], w = PFP.dock.walker.w; Q.x = w.x - 1; Q.z = w.z; for (let j = 0; j < 3; j++) window.__peerMsg(Q.id, Q); })()"); await pg.wait_for_timeout(2500); await ev("(() => { const Q = window.__T[1]; window.__peerMsg(Q.id, Q); })()"); await pg.wait_for_timeout(1500)
      R['peerDist1'] = await ev("(() => { const p = PFP.dock.fnet.peers.get(window.__T[1].id), w = PFP.dock.walker.w; return p ? +Math.hypot(p.x - w.x, p.z - w.z).toFixed(2) : null; })()")
      await ev("(([id, life]) => { const Q = window.__T[1]; Q.seq++; Q.kind = 1; window.__peerMsg(Q.id, Q, { bh: { [id]: [life, 34] } }); })", [myid, life]); await pg.wait_for_timeout(500)
      R['hpAfterBlue'] = await ev("PFP.dock.battle.me.hp"); log('friendly fire', R['hpAfterMate'], R['hpAfterBlue'], 'dist', R.get('peerDist0'), R.get('peerDist1'), 'guard', await ev("PFP.dock.battle.me.guard"))
      await ev("(()=>{ const Q = window.__T[2]; Q.down = 1; Q.hp = 0; window.__peerMsg(Q.id, Q); })()"); await pg.wait_for_timeout(600)
      R['teamScore'] = await ev("(()=>{ const b = PFP.dock.battle, r = b.peers.get(window.__T[2].id); return { score: b.me.score, zone: b.me.zone, peer: r ? { team: r.team, lastDown: r.lastDown, ba: r.ba } : null }; })()"); await shot('2v2_score'); log('score', R['teamScore'])
      await ev("PFP.dock.battle.setTeam(0); for (const Q of window.__T) PFP.dock.onPeerState({ i: Q.id, n: Q.n, dk: '', ft: '' })")
    # ---- leave + no rewards ----
    R['leave'] = await ev("window.__bt.then(t => { t.put(40, -40, 40, -60); return new Promise(r => setTimeout(() => r({ zone: PFP.dock.battle.zone, ba: PFP.dock.netState().ba, fastHz: PFP.dock.battle.fastHz(), hud: getComputedStyle(document.getElementById('bt-hud')).display }), 1200)); })")
    R['claimRequests'] = claims; R['errors'] = errs[:15]
    json.dump(R, open(f'{OUT}/{TAG}.json','w'), indent=1); log('DONE'); print(json.dumps({k: v for k, v in R.items() if k != 'candidates'}, indent=1)); await b.close()
asyncio.run(main())
