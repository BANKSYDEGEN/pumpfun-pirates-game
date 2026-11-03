# PUMPFUN PIRATES: PRESTIGE (emerly/prestige). UPGRADE SHOP bar + confirm, the top-left HUD emblem (P1 gold / P2 diamond / P3+),
# the profile badge, the BR menu skin list + the SHIP SKINS shop goals. The `pvp` function is MOCKED (prestige answers ok), the rest
# of Supabase is blocked, SW blocked. Usage: BASE=http://127.0.0.1:18960/emerly-prestige/ python3 tools/prestige_shots.py desktop|phone|portrait
import asyncio, sys, json, os
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--renderer-process-limit=1','--js-flags=--max-old-space-size=1024']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
BASE=os.environ.get('BASE','http://127.0.0.1:18960/emerly-prestige/'); OUT=os.environ.get('OUT','/workspace/emerly-prestige-shots'); os.makedirs(OUT,exist_ok=True)
MAX={'hull':6,'armor':6,'sails':6,'rudder':6,'cannons':8,'reload':6,'range':6}
SAVE={'profiles':{'device':{'v':1,'gold':91234,'levels':MAX,'skins':{'owned':[],'equipped':'classic'},'rev':0,'prestige':0,'stats':{'kills':240,'deaths':20,'botKills':500,'harborKills':900,'bossKills':12}}}}
INIT="try{localStorage.setItem('pfp_name','CAPTAINPRESTIGE');localStorage.setItem('pfp_gfx_hint','1');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_tutorial_off','1');if(!sessionStorage.getItem('seeded')){localStorage.setItem('pfp_pvp_save_v1',%s);sessionStorage.setItem('seeded','1')}}catch(e){}" % json.dumps(json.dumps(SAVE))
R=[]
def ok(n,c,i=''): R.append((n,bool(c),str(i)[:300])); print(('PASS ' if c else 'FAIL ')+n,str(i)[:300],flush=True)
CALLS=[]
async def pvp_route(route):
  try: body=json.loads(route.request.post_data or '{}')
  except Exception: body={}
  a=body.get('action'); CALLS.append(a)
  if a=='prestige':
    ok('prestige call: confirm + from level sent', body.get('confirm') is True and isinstance(body.get('from'),int), {k:body.get(k) for k in ('confirm','from')})
    await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps({'ok':True,'prestige':body.get('from',0)+1,'levels':{k:0 for k in MAX}}))
  else: await route.fulfill(status=503, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body='{"error":"mock offline"}')
async def main(dev):
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob=dev!='desktop'
    vp={'width':390,'height':844} if dev=='portrait' else {'width':844,'height':390}
    kw=dict(viewport=vp, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width':1280,'height':800})
    ctx=await b.new_context(service_workers='block', **kw)
    await ctx.route('**/*supabase.co/**', lambda r: r.abort()); await ctx.route('**/functions/v1/pvp', pvp_route); await ctx.add_init_script(INIT)
    pg=await ctx.new_page(); pg.set_default_timeout(240000); errs=[]
    pg.on('pageerror', lambda e: errs.append('PAGE '+str(e)))
    pg.on('console', lambda m: errs.append(m.type+': '+m.text[:200]) if m.type=='error' and 'Failed to load resource' not in m.text and 'mock offline' not in m.text else None)
    async def shot(t): await pg.screenshot(path=f'{OUT}/{dev}_{t}.png', timeout=240000, caret='initial')
    async def clip(t, sel):
      bb=await pg.evaluate(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return [r.x,r.y,r.width,r.height]}})()")
      x=max(0,bb[0]-12); y=max(0,bb[1]-12); await pg.screenshot(path=f'{OUT}/{dev}_{t}.png', clip={'x':x,'y':y,'width':min(vp['width'] if mob else 1280, bb[2]+24+ (bb[0]-x-12)),'height':bb[3]+24})
    await pg.goto(BASE+'index.html?quality=low', wait_until='domcontentloaded', timeout=300000)
    await pg.wait_for_function('window.PFP && PFP.renderer', timeout=400000); await pg.wait_for_timeout(1500)
    await pg.evaluate("document.getElementById('btn-pvp').click()")
    await pg.wait_for_function("PFP.pvp && PFP.pvp.where==='harbor' && window.PFP_PRESTIGE && PFP.player", timeout=600000)
    await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(3000)
    st=await pg.evaluate("({lv: PFP_PRESTIGE.level(), can: PFP_PRESTIGE.canPrestige(), emb: !!document.getElementById('cap-prest'), gold: PFP.game.gold})")
    ok(f'{dev} maxed save: can prestige, level 0, no emblem', st['can'] and st['lv']==0 and not st['emb'], st)
    await shot('00_hud_p0')
    await pg.evaluate("PFP_UPGRADES.openFromIsland()"); await pg.wait_for_timeout(1500)
    v=await pg.evaluate("(()=>{const b=document.getElementById('shop-prestige');return {hidden:b.classList.contains('hidden'), txt:b.innerText}})()")
    ok(f'{dev} UPGRADE SHOP: PRESTIGE bar shows (Golden Galleon reward)', not v['hidden'] and 'PRESTIGE' in v['txt'] and 'GOLDEN GALLEON' in v['txt'], v)
    await pg.evaluate("document.getElementById('shop-prestige').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(400)
    await shot('01_shop_prestige_button')
    await pg.evaluate("document.getElementById('shop-prest-btn').click()"); await pg.wait_for_timeout(600)
    c=await pg.evaluate("document.getElementById('prest-confirm').innerText")
    ok(f'{dev} confirm: reset + keep + reward', 'PRESTIGE 1?' in c and 'base' in c and 'gold, skins, gear, kills' in c and 'GOLDEN GALLEON' in c, c)
    await shot('02_confirm')
    await pg.evaluate("document.getElementById('pc-no').click()"); await pg.wait_for_timeout(300)
    lv0=await pg.evaluate("PFP_PRESTIGE.level()"); ok(f'{dev} cancel keeps level 0', lv0==0 and 'prestige' not in CALLS, CALLS[-3:])
    await pg.evaluate("document.getElementById('shop-prest-btn').click()"); await pg.wait_for_timeout(300)
    await pg.evaluate("document.getElementById('pc-yes').click()")
    try: await pg.wait_for_function("PFP_PRESTIGE.level()>0", timeout=30000)
    except Exception: print('pc-err:', await pg.evaluate("document.querySelector('#prest-confirm .pc-err')?.textContent"), flush=True)
    await pg.wait_for_timeout(1500)
    a=await pg.evaluate("(()=>{const lv=window.PFP_UPGRADES&&PFP.pvp; return {lv: PFP_PRESTIGE.level(), gold: PFP.game.gold, bar: document.getElementById('shop-prestige').classList.contains('hidden'), conf: document.getElementById('prest-confirm').classList.contains('hidden'), save: JSON.parse(localStorage.getItem('pfp_pvp_save_v1')).profiles.device, emb: document.getElementById('cap-prest')?.className}})()")
    ok(f'{dev} PRESTIGE 1: level 1, upgrades back to base, gold kept, bar gone', a['lv']==1 and a['gold']==st['gold'] and a['bar'] and a['conf'] and all(v==0 for v in a['save']['levels'].values()) and a['save']['prestige']==1 and a['save']['gold']==st['gold'], {k:a[k] for k in ('lv','gold','bar','emb')} | {'levels':a['save']['levels']})
    await shot('03_shop_after_prestige')
    await pg.evaluate("PFP_UPGRADES.close()"); await pg.wait_for_timeout(1200)
    ok(f'{dev} HUD emblem P1 gold', a['emb']=='p1', a['emb'])
    await shot('04_hud_p1'); await clip('04b_hud_p1_zoom', '#hud-tl')
    await pg.evaluate("dispatchEvent(new CustomEvent('pfp-prestige',{detail:{level:2,reset:false}}))"); await pg.wait_for_timeout(600)
    ok(f'{dev} HUD emblem P2 diamond', await pg.evaluate("document.getElementById('cap-prest')?.className")=='p2')
    await shot('05_hud_p2'); await clip('05b_hud_p2_zoom', '#hud-tl')
    await pg.evaluate("dispatchEvent(new CustomEvent('pfp-prestige',{detail:{level:3,reset:false}}))"); await pg.wait_for_timeout(600)
    await clip('06_hud_p3_zoom', '#hud-tl')
    fit=await pg.evaluate("(()=>{const e=document.getElementById('cap-prest').getBoundingClientRect(), c=document.getElementById('captain').getBoundingClientRect(), n=document.getElementById('captain-name').getBoundingClientRect(); return {inside: e.left>=c.left-2 && e.right<=c.right && e.top>=c.top-2 && e.bottom<=c.bottom+4, overName: e.right>n.left+2 && e.bottom>n.top && e.top<n.bottom, w:e.width}})()")
    ok(f'{dev} emblem fits the card, does not cover the name', fit['inside'] and not fit['overName'], fit)
    # profile badge (back to 2 for the skins view)
    await pg.evaluate("PFP.pvp.profile.prestige=2; dispatchEvent(new Event('resize'))")
    await pg.evaluate("document.getElementById('captain').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); document.getElementById('captain').dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))"); await pg.wait_for_timeout(800)
    if not await pg.evaluate("!!document.getElementById('profile') && !document.getElementById('profile').classList.contains('hidden')"):
      await pg.evaluate("window.PFP_PROFILE?.openProfile?.()"); await pg.wait_for_timeout(600)
    pf=await pg.evaluate("document.getElementById('pf-prest')?.innerText||''")
    ok(f'{dev} profile: PRESTIGE badge', 'PRESTIGE' in pf, pf)
    await shot('07_profile')
    await pg.evaluate("document.getElementById('pf-x')?.click()"); await pg.wait_for_timeout(400)
    # BR menu skin list (unlock text)
    await pg.evaluate("PFP.pvp.profile.prestige=1; PFP.pvp.toggleMenu(true)"); await pg.wait_for_timeout(2500)
    sk=await pg.evaluate("[...document.querySelectorAll('#pvp-skins .pvp-skin')].map(c=>c.dataset.skin+'|'+c.querySelector('span').innerText.replace(/\\n/g,' '))")
    ok(f'{dev} menu skins: GHOST 100 kills (met at 240), FIRE 200 kills only, GOLDEN given (owned) at P1, DIAMOND PRESTIGE 2', any(x.startswith('diamond|') and 'PRESTIGE 2' in x for x in sk) and any(x.startswith('golden|') and ('OWNED' in x or 'EQUIPPED' in x) for x in sk) and any(x.startswith('flaming|') and 'K/D' not in x for x in sk), sk)
    await pg.evaluate("document.getElementById('pvp-skins').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(500)
    await shot('08_menu_skins')
    await pg.evaluate("PFP.pvp.toggleMenu(false)"); await pg.wait_for_timeout(300)
    # SHIP SKINS shop with a mock provider (prestige 1: GOLDEN buyable, DIAMOND locked)
    await pg.evaluate("""(()=>{ const mp=PFP_ISLAND_SHOP.mockProvider({ owner:false, gold: 91234, stats:{ kills: 240, deaths: 30, botKills: 500, harborKills: 900, bossKills: 12, prestige: 1 }, owned:{ skins:['classic','blood'], gear:[] } }); PFP_ISLAND_SHOP.setShopProvider(mp); })()""")
    await pg.evaluate("window.openShop({vendor:'ships', tab:'skins'})"); await pg.wait_for_timeout(3500)
    cards=await pg.evaluate("[...document.querySelectorAll('#island-shop .ishop-card')].map(c=>c.dataset.id+'|'+c.innerText.replace(/\\n/g,' '))")
    ok(f'{dev} SHIP SKINS: GOLDEN UNLOCKED FREE (PRESTIGE 1), DIAMOND PRESTIGE 1/2, GHOST 100 met, FIRE K/D + 200', any('golden' in x and 'UNLOCKED' in x and 'FREE' in x for x in cards) and not any('flaming' in x and 'K/D' in x for x in cards) and any('diamond' in x and 'PRESTIGE 1/2' in x for x in cards), cards)
    order=await pg.evaluate("[...document.querySelectorAll('#island-shop .ishop-card')].map(c=>c.dataset.id)")
    await shot('09_skins_shop')
    for sid in ['diamond','golden','flaming']:
      await pg.evaluate(f"document.querySelector('#island-shop .ishop-card[data-id*=\"{sid}\"]')?.click()"); await pg.wait_for_timeout(1500)
      d=await pg.evaluate("document.querySelector('#island-shop .ishop-detail')?.innerText||''"); ok(f'{dev} detail {sid}', len(d)>0, d.replace('\n',' | ')[:220])
      await shot(f'10_detail_{sid}')
    ok(f'{dev} no page errors', not [e for e in errs if 'PAGE' in e], errs[:6])
    print('ORDER', order)
    await b.close()
  print(json.dumps({'pass':sum(1 for r in R if r[1]),'fail':[r for r in R if not r[1]]}))
asyncio.run(main(sys.argv[1] if len(sys.argv)>1 else 'desktop'))
