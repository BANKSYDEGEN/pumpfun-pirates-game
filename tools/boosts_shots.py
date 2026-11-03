# PUMPFUN PIRATES: ITEM SKILL BOOSTS (emerly/boosts). Shop card chips, detail pane, BOOSTS bar, the profile section, and the
# stats on YOUR ship (harbor 100% / BR 50% / SWORD PIT 0). Mock shop, Supabase blocked, SW blocked.
# Usage: BASE=http://127.0.0.1:18960/emerly-boosts/ python3 tools/boosts_shots.py desktop|phone
import asyncio, sys, json, os
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
BASE=os.environ.get('BASE','http://127.0.0.1:18960/emerly-boosts/'); OUT=os.environ.get('OUT','/workspace/emerly-boosts/screens/boosts'); os.makedirs(OUT,exist_ok=True)
INIT="try{localStorage.setItem('pfp_name','BOOST_QA');localStorage.setItem('pfp_gfx_hint','1');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_tutorial_off','1')}catch(e){}"
R=[]
def ok(n,c,i=''): R.append((n,bool(c),str(i)[:300])); print(('PASS ' if c else 'FAIL ')+n,str(i)[:300],flush=True)
STATS="(()=>{const p=PFP.player; return {reload:p.reload, maxHp:p.maxHp, hp:p.hp, range:p.range, gunDmg:p.gunDmg, turn:p.turnMul, speed:p.speedMul, regen:p.regenPct, zone:PFP_BOOSTS.boostZone()};})()"
async def main(dev):
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob=dev!='desktop'
    kw=dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width':1280,'height':800})
    ctx=await b.new_context(service_workers='block', **kw); await ctx.route('**/*supabase.co/**', lambda r: r.abort()); await ctx.add_init_script(INIT)
    pg=await ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append('PAGE '+str(e)))
    pg.on('console', lambda m: errs.append(m.type+': '+m.text[:200]) if m.type=='error' and 'Failed to load resource' not in m.text else None)
    async def shot(t): await pg.screenshot(path=f'{OUT}/{dev}_{t}.png')
    await pg.goto(BASE+'index.html?quality='+('low' if mob else 'high'), wait_until='domcontentloaded', timeout=300000)
    await pg.wait_for_function('window.PFP && PFP.renderer', timeout=400000); await pg.wait_for_timeout(1500)
    await pg.evaluate("document.getElementById('btn-pvp').click()")
    await pg.wait_for_function("PFP.pvp && PFP.pvp.where==='harbor' && window.openShop && window.PFP_BOOSTS && PFP.player", timeout=600000)
    await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(3000)
    s0=await pg.evaluate(STATS)
    ok(f'{dev} no gear: no boost (zone harbor)', s0['zone']=='harbor', s0)
    # mock shop wired like pvp.js: equip -> gear -> boosts source (the server's owned list)
    await pg.evaluate("""(()=>{ const mp=PFP_ISLAND_SHOP.mockProvider({ owner:false, gold: 40000, stats:{ kills: 1240, deaths: 300, botKills: 120, harborKills: 412, bossKills: 37 },
        owned:{ skins:['classic'], gear:['hat:tricorn','hat:crown_imperial','outfit:suit','eyes:laser','parrot:parrot_cockatoo','hook:hook_iron','crewhat:crown','crewoutfit:coat','face:facepaint_retardio'] },
        equipped:{ skin:'classic', gear:{ hat:'tricorn', outfit:'shirtless', eyes:'plain', parrot:'none', hook:'none', leg:'none', face:'none', crewhat:'bandana', crewoutfit:'tank' } } });
      const sync=()=>PFP_BOOSTS.setBoostSource({ gear: mp.state.equipped.gear, owned: mp.state.owned.gear, owner: !!mp.state.owner });
      const eq=mp.equip.bind(mp), buy=mp.buy.bind(mp); mp.equip=async(k,id)=>{ const r=await eq(k,id); sync(); return r; }; mp.buy=async(k,id)=>{ const r=await buy(k,id); sync(); return r; };
      PFP_ISLAND_SHOP.setShopProvider(mp); window.__mp=mp; sync(); })()""")
    await pg.wait_for_timeout(400); s1=await pg.evaluate(STATS)
    ok(f'{dev} TRICORN worn: reload 2% faster', abs(s1['reload']-s0['reload']/1.02)<0.006 and s1['reload']<s0['reload'], [s0['reload'], s1['reload']])
    # CLOTHES SHOP hats: chips on the cards
    await pg.evaluate("window.openShop({vendor:'clothes', tab:'gear', slot:'hat'})"); await pg.wait_for_timeout(3500)
    v=await pg.evaluate("""(()=>{ const r=document.getElementById('island-shop'); return { cards:[...r.querySelectorAll('.ishop-card')].map(c=>c.dataset.id+'|'+(c.querySelector('.ishop-bst')?.textContent||'')), bar: r.querySelector('.ishop-bsts')?.textContent, barHidden: r.querySelector('.ishop-bsts')?.hidden, foot: r.querySelector('.ishop-foot').textContent }; })()""")
    ok(f'{dev} hat cards show "+x% RELOAD" chips (none on BARE HEAD)', any('hat:crown_imperial|' in c and '+6% RELOAD' in c for c in v['cards']) and any(c.startswith('hat:none|') and c.endswith('|') for c in v['cards']), v['cards'])
    ok(f'{dev} BOOSTS bar: 2 / 30 + RELOAD', not v['barHidden'] and 'BOOSTS 2 / 30' in (v['bar'] or '') and 'RELOAD' in v['bar'], v['bar'])
    await pg.wait_for_timeout(2500); await shot('01_hats_cards')
    await pg.evaluate("document.querySelector('#island-shop .ishop-card[data-id=\"hat:crown_imperial\"]').click()"); await pg.wait_for_timeout(1200)
    d=await pg.evaluate("document.querySelector('#island-shop .ishop-detail').innerText")
    ok(f'{dev} detail: SKILL BOOST +6% RELOAD, compare with worn TRICORN, ship units, BR 50% / off in the PIT', '+6% RELOAD' in d and 'Now wearing' in d and '→' in d and 'Battle Royale 50%' in d and 'SWORD PIT' in d, d)
    await shot('02_hat_detail')
    await pg.evaluate("document.querySelector('#island-shop .ishop-detail [data-a=equip]').click()"); await pg.wait_for_timeout(800)
    # outfits + eyes + face paint equip
    for slot,key in [('outfit','outfit:suit'),('eyes','eyes:laser'),('hook','hook:hook_iron'),('face','face:facepaint_retardio')]:
      await pg.evaluate(f"document.querySelector('#island-shop .ishop-chips [data-slot=\"{slot}\"]').click()"); await pg.wait_for_timeout(500)
      await pg.evaluate(f"document.querySelector('#island-shop .ishop-card[data-id=\"{key}\"]').click()"); await pg.wait_for_timeout(500)
      await pg.evaluate("document.querySelector('#island-shop .ishop-detail [data-a=equip]')?.click()"); await pg.wait_for_timeout(700)
    await pg.wait_for_timeout(2000); await shot('03_outfit_cards_total')
    # PET STORE: gold find chips
    await pg.evaluate("window.closeShop(); window.openShop({vendor:'pets'})"); await pg.wait_for_timeout(3000)
    await pg.evaluate("document.querySelector('#island-shop .ishop-card[data-id=\"parrot:parrot_cockatoo\"]').click()"); await pg.wait_for_timeout(800)
    pv=await pg.evaluate("(()=>{ const r=document.getElementById('island-shop'); return { cards:[...r.querySelectorAll('.ishop-card')].map(c=>c.dataset.id+'|'+(c.querySelector('.ishop-bst')?.textContent||'')), d: r.querySelector('.ishop-detail').innerText }; })()")
    ok(f'{dev} PET STORE: parrots show GOLD FIND (dig luck hidden until its migration)', any('parrot_diamond|' in c and '+10% GOLD FIND' in c for c in pv['cards']) and 'DIG LUCK' not in ''.join(pv['cards']), pv['cards'])
    await pg.evaluate("document.querySelector('#island-shop .ishop-detail [data-a=equip]')?.click()"); await pg.wait_for_timeout(1500); await shot('04_pets')
    # CREW SHOP
    await pg.evaluate("window.closeShop(); window.openShop({vendor:'crew'})"); await pg.wait_for_timeout(3000)
    await pg.evaluate("document.querySelector('#island-shop .ishop-card[data-id=\"crewhat:crown\"]').click()"); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelector('#island-shop .ishop-detail [data-a=equip]')?.click()"); await pg.wait_for_timeout(1500); await shot('05_crew')
    # confirm dialog shows the boost
    await pg.evaluate("document.querySelector('#island-shop .ishop-chips [data-slot=\"crewoutfit\"]').click()"); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelector('#island-shop .ishop-card[data-id=\"crewoutfit:suit\"]').click()"); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelector('#island-shop .ishop-detail [data-a=buy]')?.click()"); await pg.wait_for_timeout(700)
    cf=await pg.evaluate("document.querySelector('#island-shop .ishop-cbox')?.innerText||''")
    ok(f'{dev} buy confirm says what it gives', 'Gives +8% REPAIR' in cf, cf); await shot('06_confirm')
    await pg.evaluate("document.querySelector('#island-shop .ishop-cbox [data-c=no]')?.click()"); await pg.wait_for_timeout(400)
    await pg.evaluate("document.querySelector('#island-shop .ishop-card[data-id=\"crewoutfit:coat\"]').click()"); await pg.wait_for_timeout(400)
    await pg.evaluate("document.querySelector('#island-shop .ishop-detail [data-a=equip]')?.click()"); await pg.wait_for_timeout(700)
    await pg.evaluate("window.closeShop()"); await pg.wait_for_timeout(600)
    # stats on YOUR ship by zone
    tot=await pg.evaluate("PFP_BOOSTS.currentBoosts()")
    s2=await pg.evaluate(STATS)
    ok(f'{dev} harbor: worn kit boosts the ship (reload, HP, range, dmg, speed, repair)', s2['reload']<s0['reload'] and s2['maxHp']>s0['maxHp'] and s2['range']>s0['range'] and s2['gunDmg']>s0['gunDmg'] and s2['speed']>s0['speed'] and s2['regen']>s0['regen'], [s0, s2, tot])
    ok(f'{dev} hull damage kept when boosts change (hp <= maxHp, > 0)', 0 < s2['hp'] <= s2['maxHp'], s2)
    await pg.evaluate("PFP_BOOSTS.setBoostZone('br')"); await pg.wait_for_timeout(300); s3=await pg.evaluate(STATS)
    ok(f'{dev} Battle Royale zone: half the boost', s0['range'] < s3['range'] < s2['range'] and s2['reload'] < s3['reload'] < s0['reload'], [s3['range'], s2['range'], s3['reload']])
    await pg.evaluate("PFP_BOOSTS.setBoostZone('harbor'); PFP_BOOSTS.setFairFight(true)"); await pg.wait_for_timeout(300); s4=await pg.evaluate(STATS)
    ok(f'{dev} SWORD PIT / MUSKET RANGE: no combat boosts', abs(s4['reload']-s0['reload'])<1e-6 and s4['range']==s0['range'] and s4['maxHp']==s0['maxHp'] and s4['zone']=='pit', s4)
    await pg.evaluate("PFP_BOOSTS.setFairFight(false)"); await pg.wait_for_timeout(300)
    # profile panel
    await pg.evaluate("PFP_PROFILE.openProfile()"); await pg.wait_for_timeout(1200)
    pf=await pg.evaluate("document.getElementById('pf-boosts')?.innerText||''")
    ok(f'{dev} PROFILE: SKILL BOOSTS total + per-stat rows', 'SKILL BOOSTS' in pf and 'RELOAD' in pf and 'GOLD FIND' in pf and 'HARBOR 100%' in pf, pf)
    await pg.evaluate("document.getElementById('pf-boosts')?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(500); await shot('07_profile')
    await pg.evaluate("PFP_PROFILE.closeProfile()")
    # owner: owns everything, still capped
    o=await pg.evaluate("PFP_BOOSTS.boostsFor({hat:'crown_imperial',outfit:'suit',eyes:'laser',hook:'hook_gold',leg:'peg',face:'facepaint_retardio',crewhat:'crown_imperial',crewoutfit:'suit',parrot:'parrot_diamond'}, [], true)")
    ok(f'{dev} owner full kit: capped at 30 combat points', abs(o['combat']-0.30)<1e-6 and 'combat' in o['capped'], o)
    ok(f'{dev} no page errors', not errs, errs[:6])
    await b.close()
  json.dump(R, open(f'{OUT}/{dev}_results.json','w'), indent=1)
  print('SUMMARY', dev, sum(1 for r in R if r[1]), '/', len(R), flush=True)
asyncio.run(main(sys.argv[1] if len(sys.argv)>1 else 'desktop'))
