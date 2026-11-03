# PUMPFUN PIRATES: CREW SHOP + crew outfit split + PET STORE (timothy/crew-pets). Desktop 1280x800 + phone 390x844, mock shop,
# Supabase stubbed, SW blocked. Usage: python3 tools/crew_pets.py <port> [before_port]   (before = a b5aa30f server, crew shot only)
import asyncio, sys, json
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
B='http://127.0.0.1:'+sys.argv[1]; BEFORE=('http://127.0.0.1:'+sys.argv[2]) if len(sys.argv)>2 else None
OUT='/workspace/timothy-crewpets/screens'
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
INIT="try{localStorage.setItem('pfp_gfx_hint','1');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_off','1')}catch(e){}"
KIT="{hat:'bicorne',outfit:'suit',eyes:'eyepatch',parrot:'parrot_blue',hook:'none',leg:'none',hatColor:0}"
R=[]
def ok(n,c,i=''): R.append((n,bool(c),i)); print(('PASS ' if c else 'FAIL ')+n,str(i)[:300],flush=True)
TAG="""async()=>{ const cr=await import('/js/crew.js'); const m=PFP.player.mesh, body=m.userData.body||m; return String(cr.crewGearTag(body)); }"""
async def page(b,base,name,vp,phone,errs):
    kw=dict(viewport={'width':vp[0],'height':vp[1]},service_workers='block',device_scale_factor=1)
    if phone: kw.update(is_mobile=True,has_touch=True,user_agent=UA)
    ctx=await b.new_context(**kw); await ctx.route('**/*supabase.co/**',lambda r:r.abort()); await ctx.add_init_script(INIT)
    pg=await ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(f'[{name}] PAGEERROR {e}'))
    pg.on('console',lambda m: errs.append(f'[{name}] {m.type}: {m.text[:300]}') if m.type=='error' and 'Failed to load resource' not in m.text else None)
    await pg.goto(base+'/index.html?quality='+('low' if phone else 'high'),wait_until='domcontentloaded',timeout=180000)
    await pg.wait_for_function('window.PFP && PFP.renderer',timeout=300000); await pg.wait_for_timeout(1500)
    await pg.evaluate("document.getElementById('btn-pvp').click()")
    await pg.wait_for_function("PFP.pvp && PFP.pvp.where==='harbor' && window.openShop && window.PFP_GEAR",timeout=400000); await pg.wait_for_timeout(3000)
    return ctx,pg
async def crewshot(pg,tag):  # close on your own deck crew: overlays hidden, orbit camera pulled in beside the deck
    await pg.evaluate("""(()=>{ for (const id of ['pvp-entry','pvp-harbor']) document.getElementById(id)?.classList.add('hidden');
      const c=PFP.camera, k=PFP.controls, m=PFP.player.mesh, y=m.rotation.y, t=k.target; k.minDistance=4;
      c.position.set(t.x+Math.cos(y)*9+Math.sin(y)*3, t.y+2.5, t.z-Math.sin(y)*9+Math.cos(y)*3); k.update(); })()""")
    await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{OUT}/{tag}.png')
async def before(b,name,vp,phone,errs):
    ctx,pg=await page(b,BEFORE,name+'-before',vp,phone,errs)
    await pg.evaluate("PFP_GEAR.setLocalGear(%s)"%KIT); await pg.wait_for_timeout(14000)
    for _ in range(20):
        t=await pg.evaluate(TAG)
        if 'suit' in t: break
        await pg.wait_for_timeout(2000)
    ok(f'{name} BEFORE (b5aa30f): crew copy the captain (suit/bicorne in crew tag)', 'suit' in t and 'bicorne' in t, t[:120])
    await crewshot(pg,f'{name}_crew_before'); await ctx.close()
async def run(b,name,vp,phone,errs):
    ctx,pg=await page(b,B,name,vp,phone,errs)
    async def shot(t): await pg.screenshot(path=f'{OUT}/{name}_{t}.png')
    # ---- old saves: client cleanProfile on a pre-crew save (no crew keys) ----
    o=await pg.evaluate("""async()=>{ const s=await import('/js/pvpSave.js'); const p=s.cleanProfile({ gold: 900, gear:{ hat:'tricorn', outfit:'coat' }, gearOwned:['hat:tricorn','outfit:coat'], skins:{ owned:[], equipped:'classic' } });
      const q=s.cleanProfile({ gold: 900, gear:{ hat:'tricorn', crewhat:'tricorn' }, gearOwned:['crewhat:tricorn'] }); const r=s.cleanProfile({ gear:{ hat:'tricorn', crewhat:'tricorn' }, gearOwned:['hat:tricorn'] });
      return { old: p.gear, oldGold: p.gold, crewOnly: q.gear, playerOnly: r.gear }; }""")
    ok(f'{name} old save loads: gold + player gear kept, crew = uniform', o['oldGold']==900 and o['old']['hat']=='tricorn' and o['old']['outfit']=='coat' and o['old']['crewhat']=='bandana' and o['old']['crewoutfit']=='tank', o['old'])
    ok(f'{name} save: owning CREW tricorn does not give the player the tricorn', o['crewOnly']['hat']=='none' and o['crewOnly']['crewhat']=='tricorn', o['crewOnly'])
    ok(f'{name} save: owning PLAYER tricorn does not dress the crew in it', o['playerOnly']['hat']=='tricorn' and o['playerOnly']['crewhat']=='bandana', o['playerOnly'])
    # ---- crew wear the uniform, not your clothes ----
    await pg.evaluate("PFP_GEAR.setLocalGear(%s)"%KIT); await pg.wait_for_timeout(14000)
    t=await pg.evaluate(TAG)
    ok(f'{name} crew wear the default uniform (bandana + tank), not the captain\'s suit / bicorne', '"bandana"' in t and '"tank"' in t and 'suit' not in t and 'bicorne' not in t, t[:120])
    await crewshot(pg,f'{name}_crew_after_uniform')
    # ---- mock shop wired like pvp.js (equip -> player gear / crew loadout) ----
    await pg.evaluate("""(()=>{ const mk=(seed)=>{ const mp=PFP_ISLAND_SHOP.mockProvider(seed); const eq=mp.equip.bind(mp);
        mp.equip=async(k,id)=>{ const r=await eq(k,id); if(k==='gear'&&r?.equipped){ const g=r.equipped.gear; PFP_GEAR.setLocalGear({hat:g.hat,outfit:g.outfit,eyes:g.eyes,parrot:g.parrot,hook:g.hook,leg:g.leg}); PFP_CREW.setCrewLoadout(g); } return r; }; return mp; };
      window.__mk=mk; const mp=mk({ owner:false, gold: 30000, stats:{ kills: 1240, deaths: 300, botKills: 120, harborKills: 412, bossKills: 37, goldEarned: 23450 },
        owned:{ skins:['classic'], gear:['hat:bicorne','outfit:suit','eyes:eyepatch','parrot:parrot_blue','hat:none','outfit:shirtless','parrot:none'] },
        equipped:{ skin:'classic', gear:{ hat:'bicorne', outfit:'suit', eyes:'eyepatch', parrot:'parrot_blue', hook:'none', leg:'none', face:'plain', crewhat:'bandana', crewoutfit:'tank' } } });
      PFP_ISLAND_SHOP.setShopProvider(mp); window.__mp=mp; })()""")
    # ---- CREW SHOP ----
    await pg.evaluate("window.openShop({vendor:'crew', tab:'skins'})"); await pg.wait_for_timeout(4000)
    v=await pg.evaluate("""(()=>{ const r=document.getElementById('island-shop'); return { title: r.querySelector('.ishop-title b').textContent, cards:[...r.querySelectorAll('.ishop-card')].map(c=>c.dataset.id+'|'+c.querySelector('.ishop-badge')?.textContent),
      chips:[...r.querySelectorAll('.ishop-chips button')].map(b=>b.textContent), chipsHidden: r.querySelector('.ishop-chips').hidden, live: !!r.querySelector('.ishop-detail canvas.gear-live') }; })()""")
    ok(f'{name} CREW SHOP opens (counter vendor crew; tab falls back to gear)', v['title']=='CREW SHOP' and len(v['cards'])==5 and all(c.startswith('crewhat:') for c in v['cards']), v)
    ok(f'{name} CREW SHOP chips: CREW HATS / CREW CLOTHES', v['chips']==['CREW HATS','CREW CLOTHES'] and not v['chipsHidden'], v['chips'])
    ok(f'{name} CREW SHOP prices = player prices, uniform free + equipped', 'crewhat:bandana|EQUIPPED ✓' in v['cards'] and 'crewhat:tricorn|400g' in ''.join(v['cards']).replace(',','') or any('crewhat:tricorn' in c and '400' in c for c in v['cards']), v['cards'])
    ok(f'{name} CREW SHOP: owning the player bicorne does NOT own the crew bicorne', any(c.startswith('crewhat:bicorne|') and 'OWNED' not in c and 'EQUIPPED' not in c for c in v['cards']), v['cards'])
    ok(f'{name} CREW SHOP live preview on a crew member', v['live'])
    await pg.wait_for_timeout(2500); await shot('crewshop_hats')
    # buy + equip crew tricorn
    await pg.evaluate("document.querySelector('#island-shop .ishop-card[data-id=\"crewhat:tricorn\"]').click()"); await pg.wait_for_timeout(600)
    await pg.evaluate("document.querySelector('#island-shop .ishop-detail [data-a=buy]').click()"); await pg.wait_for_timeout(500); await shot('crewshop_confirm')
    await pg.evaluate("document.querySelector('#island-shop .ishop-cbox [data-c=yes]').click()"); await pg.wait_for_timeout(1200)
    st=await pg.evaluate("(()=>({ owned: __mp.state.owned.gear, gold: __mp.state.gold }))()")
    ok(f'{name} buy crew TRICORN: 400 gold, owns crewhat:tricorn, NOT hat:tricorn', 'crewhat:tricorn' in st['owned'] and 'hat:tricorn' not in st['owned'] and st['gold']==29600, st)
    await pg.evaluate("document.querySelector('#island-shop .ishop-detail [data-a=equip]').click()"); await pg.wait_for_timeout(13000)
    e=await pg.evaluate("(()=>({ crew: PFP_CREW.getCrewLoadout(), me: PFP_GEAR.getLocalGear().hat }))()"); t=await pg.evaluate(TAG)
    ok(f'{name} equip crew TRICORN: crew wear it, your own hat stays the bicorne', e['crew']['crewhat']=='tricorn' and e['me']=='bicorne' and 'tricorn' in t and 'bicorne' not in t, [e, t[:100]])
    await shot('crewshop_equipped')
    await pg.evaluate("document.querySelector('#island-shop .ishop-chips button[data-slot=crewoutfit]').click()"); await pg.wait_for_timeout(3500); await shot('crewshop_clothes')
    await pg.evaluate("closeShop()"); await crewshot(pg,f'{name}_crew_after_tricorn')
    # player buy does not reach the crew
    await pg.evaluate("window.openShop({vendor:'clothes', tab:'gear', slot:'hat'})"); await pg.wait_for_timeout(1500)
    r=await pg.evaluate("(async()=>{ const x=await __mp.buy('gear','hat:crown'); return { ok:x.ok, owned:__mp.state.owned.gear }; })()")
    ok(f'{name} buy PLAYER crown: owns hat:crown, NOT crewhat:crown', r['ok'] and 'hat:crown' in r['owned'] and 'crewhat:crown' not in r['owned'], r)
    eqc=await pg.evaluate("(async()=>{ const s=await __mp.equip('gear','crewhat:crown'); return s.equipped.gear.crewhat; })()")
    ok(f'{name} the crew cannot wear the crown you bought for yourself', eqc=='tricorn', eqc)
    await pg.evaluate("closeShop()")
    # ---- PET STORE ----
    await pg.evaluate("window.openShop({vendor:'pets', tab:'skins'})"); await pg.wait_for_timeout(4000)
    v=await pg.evaluate("""(()=>{ const r=document.getElementById('island-shop'); return { title: r.querySelector('.ishop-title b').textContent, cards:[...r.querySelectorAll('.ishop-card')].map(c=>c.dataset.id+'|'+(c.className.split(' ')[1]||'')+'|'+(c.querySelector('.ishop-rar')?.textContent||'')),
      chipsHidden: r.querySelector('.ishop-chips').hidden, live: !!r.querySelector('.ishop-detail canvas.gear-live') }; })()""")
    ok(f'{name} PET STORE opens with the 8 parrot cards (7 parrots + NO PARROT), chips hidden', v['title']=='PET STORE' and len(v['cards'])==8 and v['chipsHidden'], v)
    ok(f'{name} PET STORE goals kept: BLACK goal met (1240 kills >= 1000, then gold), GOLD + DIAMOND locked', any(c.startswith('parrot:parrot_black|buy') or c.startswith('parrot:parrot_black|poor') for c in v['cards']) and await pg.evaluate("document.querySelector('#island-shop .ishop-card[data-id=\"parrot:parrot_black\"]').classList.contains('goal-met')") and any(c.startswith('parrot:parrot_gold|locked') for c in v['cards']) and any(c.startswith('parrot:parrot_diamond|locked') for c in v['cards']), v['cards'])
    ok(f'{name} PET STORE rarity tags', sum(1 for c in v['cards'] if c.split('|')[2])==7, v['cards'])
    await pg.wait_for_timeout(2500); await shot('petstore')
    await pg.evaluate("document.querySelector('#island-shop .ishop-card[data-id=\"parrot:parrot_gold\"]').click()"); await pg.wait_for_timeout(2500); await shot('petstore_locked_gold')
    await pg.evaluate("document.querySelector('#island-shop .ishop-card[data-id=\"parrot:parrot_red\"]').click()"); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelector('#island-shop .ishop-detail [data-a=buy]').click()"); await pg.wait_for_timeout(400)
    await pg.evaluate("document.querySelector('#island-shop .ishop-cbox [data-c=yes]').click()"); await pg.wait_for_timeout(1200)
    await pg.evaluate("document.querySelector('#island-shop .ishop-detail [data-a=equip]').click()"); await pg.wait_for_timeout(1500)
    p=await pg.evaluate("(()=>({ owned: __mp.state.owned.gear.includes('parrot:parrot_red'), eq: __mp.state.equipped.gear.parrot, me: PFP_GEAR.getLocalGear().parrot, gold: __mp.state.gold, crew: PFP_CREW.getCrewLoadout() }))()")
    ok(f'{name} PET STORE buy + equip RED MACAW (5,000)', p['owned'] and p['eq']=='parrot_red' and p['me']=='parrot_red' and p['gold']==30000-400-15000-5000, p)
    gl=await pg.evaluate("(async()=>{ const x=await __mp.buy('gear','parrot:parrot_gold'); return x.error; })()")
    ok(f'{name} PET STORE: locked GOLDEN PARROT cannot be bought', gl=='goal not reached', gl)
    await shot('petstore_equipped')
    lay=await pg.evaluate("""(()=>{ const p=document.querySelector('#island-shop .ishop-panel').getBoundingClientRect(); const g=document.querySelector('#island-shop .ishop-grid');
      return { inView: p.left>=0 && p.right<=innerWidth+1 && p.top>=0 && p.bottom<=innerHeight+1, hOverflow: g.scrollWidth>g.clientWidth+2 }; })()""")
    ok(f'{name} layout: panel in view, no sideways grid overflow', lay['inView'] and not lay['hOverflow'], lay)
    await pg.evaluate("closeShop()")
    # ---- OWNER: everything free ----
    await pg.evaluate("""(()=>{ const mp=__mk({ owner:true, gold: 0, equipped:{ skin:'classic', gear:{ hat:'none', outfit:'shirtless', eyes:'plain', parrot:'none', hook:'none', leg:'none', crewhat:'bandana', crewoutfit:'tank' } } }); PFP_ISLAND_SHOP.setShopProvider(mp); window.__mp=mp; })()""")
    for vend in ['crew','pets']:
        await pg.evaluate(f"window.openShop({{vendor:'{vend}'}})"); await pg.wait_for_timeout(1500)
        cs=await pg.evaluate("[...document.querySelectorAll('#island-shop .ishop-card')].map(c=>c.className.split(' ')[1])")
        ok(f'{name} OWNER: every {vend} card owned / equipped (no buy, no lock)', all(c in ('owned','equipped') for c in cs), cs)
        if vend=='crew':
            await shot('crewshop_owner')
            e=await pg.evaluate("(async()=>{ const s=await __mp.equip('gear','crewhat:crown_imperial'); return s.equipped.gear.crewhat; })()")
            ok(f'{name} OWNER equips the crew IMPERIAL CROWN free', e=='crown_imperial', e)
        await pg.evaluate("closeShop()")
    # ---- plaza counters ----
    w=await pg.evaluate("(async()=>{ const m=await import('/js/island/plazaTown.js'); return Object.fromEntries(m.STOREFRONTS.map(s=>[s.id,s.vendor])); })()")
    ok(f'{name} plaza counters: PET STORE -> pets, CREW SHOP -> crew', w.get('shop_pets')=='pets' and w.get('shop_crew')=='crew' and w.get('shop_clothes')=='clothes', w)
    await ctx.close()
async def main():
    errs=[]
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=ARGS)
        for n,vp,ph in [('desktop',(1280,800),False),('phone',(390,844),True)]:
            if BEFORE: await before(b,n,vp,ph,errs)
            await run(b,n,vp,ph,errs)
        await b.close()
    real=[e for e in errs if 'supabase' not in e.lower() and 'ERR_FAILED' not in e]
    ok('no console errors / page errors', not real, real[:8])
    print(f"{sum(1 for r in R if r[1])}/{len(R)} passed")
    open(f'{OUT}/results.txt','w').write('\n'.join(('PASS ' if c else 'FAIL ')+n+'  '+str(i)[:300] for n,c,i in R)+f"\n{sum(1 for r in R if r[1])}/{len(R)} passed\nall console errors seen: {errs[:20]}\n")
asyncio.run(main())
