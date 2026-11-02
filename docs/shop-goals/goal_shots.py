# PUMPFUN PIRATES shop goals: goal progress on the 4 layouts in locked / partial / met / no-stats states (all faked locally:
# Supabase mocked, mock shop gold + owned). Also a LIVE run through Emerly's real shop provider with the `pvp` function mocked. Usage: python3 goal_shots.py http://127.0.0.1:18953/ [devs]
import asyncio, sys, os, json
sys.path.insert(0, '/workspace/timothy-ui/tools')
from shots import new_page, to_harbor, ARGS, DEVICES, mk_route
from playwright.async_api import async_playwright
OUT = '/workspace/timothy-ui/screens/goals'
OWN = {'skins': ['classic', 'blood', 'seagreen', 'midnight'], 'gear': ['hat:none', 'outfit:shirtless', 'eyes:plain', 'parrot:none', 'hook:none']}
STATES = {
  'locked':  dict(gold=3400,  stats=dict(kills=3, deaths=2, botKills=40, harborKills=36, bossKills=4)),
  'partial': dict(gold=3400,  stats=dict(kills=41, deaths=7, botKills=300, harborKills=260, bossKills=37), modes=dict(solo=30, squads=11, src='server')),
  'met':     dict(gold=160000, stats=dict(kills=5210, deaths=486, botKills=900, harborKills=800, bossKills=100), modes=dict(solo=3904, squads=1306, src='server')),
  'nostats': dict(gold=0,     stats=None),
}
async def snap(pg, dev, name): await pg.wait_for_timeout(600); await pg.screenshot(path=f'{OUT}/{dev}_{name}.png')
async def open_state(pg, name, item):
    s = STATES[name]
    await pg.evaluate("""([s, own, item]) => { const P = PFP_ISLAND_SHOP; const m = P.mockProvider({ gold: s.gold, stats: s.stats, owned: own, equipped: { skin: 'midnight', gear: {} } });
      const base = m.load; m.load = async () => ({ ...(await base()), modes: s.modes || null }); P.setShopProvider(m);
      return P.openShop({ vendor: 'shop', tab: 'skins', item }); }""", [s, OWN, item])
    await pg.wait_for_timeout(400)
    await pg.evaluate("(k)=>document.querySelector(`#island-shop .ishop-card[data-id=\"${k}\"]`)?.scrollIntoView({block:'center'})", item)
async def run(b, dev, base, errs):
    ctx, pg = await new_page(b, dev, base, errs, {}, extra_ls={'pfp_island_shop': '1'})
    await to_harbor(pg)
    await pg.wait_for_function("window.PFP_ISLAND_SHOP && window.PFP_SHOP_GOALS", timeout=20000)
    await open_state(pg, 'locked', 'commodore'); await pg.wait_for_timeout(7000)  # real skin renders fill in
    await snap(pg, dev, 'locked_commodore')
    await open_state(pg, 'partial', 'flaming'); await pg.wait_for_timeout(2500); await snap(pg, dev, 'partial_flaming')
    await open_state(pg, 'partial', 'diamond'); await pg.wait_for_timeout(1500); await snap(pg, dev, 'partial_diamond_modes')
    await open_state(pg, 'met', 'commodore'); await pg.wait_for_timeout(2500); await snap(pg, dev, 'met_commodore_buy')
    await open_state(pg, 'met', 'diamond'); await pg.wait_for_timeout(1500); await snap(pg, dev, 'met_diamond_needgold')
    await open_state(pg, 'nostats', 'flaming'); await pg.wait_for_timeout(1500); await snap(pg, dev, 'nostats_flaming')
    # check: card text + BUY state
    await pg.evaluate("()=>PFP_ISLAND_SHOP.closeShop()")
    await ctx.close()

async def run_live(b, dev, base, errs):
    # Emerly's REAL provider (js/pvp.js setShopProvider -> pvpSave shopState -> the `pvp` function), with the function mocked:
    # dev_sync / shop_state answer a server shop view (stats + goals + modes, as goals.ts adds them). First partial, then met.
    view = {'stats': {'kills': 41, 'deaths': 7, 'botKills': 300, 'harborKills': 260, 'bossKills': 37}, 'gold': 3400}
    ctx, pg = await new_page(b, dev, base, errs, {}, extra_ls={'pfp_br_mode_kills_v1': json.dumps({'solo': 9, 'squads': 3, 'since': 1793000000000})})
    async def fn(r):
        try: body = json.loads(r.request.post_data or '{}')
        except Exception: body = {}
        a = body.get('action')
        if a == 'me': return await r.fulfill(status=200, content_type='application/json', body=json.dumps({'rank': 412, 'kills': view['stats']['kills'], 'deaths': view['stats']['deaths']}))
        if a in ('dev_sync', 'shop_state'):
            st = view['stats']; kd = st['kills'] / max(1, st['deaths'])
            goals = {'skin:commodore': {'met': st['bossKills'] >= 100, 'rows': [{'stat': 'bossKills', 'need': 100, 'have': st['bossKills'], 'done': st['bossKills'] >= 100}]}}
            return await r.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'owner': False, 'gold': view['gold'], 'rev': 0, 'stats': st,
                'owned': {'skins': ['classic', 'blood', 'seagreen'], 'gear': []}, 'goals': goals, 'modes': {'solo': 30, 'squads': 11, 'soloDeaths': 5, 'squadsDeaths': 2}}))
        return await r.fulfill(status=200, content_type='application/json', body='{}')
    await ctx.route('**/functions/v1/pvp**', fn)
    await pg.reload(wait_until='domcontentloaded')
    await pg.wait_for_function('window.PFP && document.getElementById("loading").classList.contains("hidden")', timeout=120000)
    await to_harbor(pg)
    await pg.wait_for_function("window.PFP_ISLAND_SHOP && window.PFP_SHOP_GOALS", timeout=20000)
    ok = await pg.evaluate("()=>PFP_ISLAND_SHOP.openShop({vendor:'shop', tab:'skins', item:'diamond'})"); await pg.wait_for_timeout(7000)
    await pg.evaluate("()=>document.querySelector('#island-shop .ishop-card[data-id=diamond]')?.scrollIntoView({block:'center'})")
    await snap(pg, dev, 'live_server_partial')
    st = await pg.evaluate("()=>PFP_SHOP_GOALS.goalStats()")
    view['stats'] = {'kills': 52, 'deaths': 5, 'botKills': 330, 'harborKills': 280, 'bossKills': 100}; view['gold'] = 160000
    await pg.evaluate("()=>PFP_ISLAND_SHOP.closeShop()")
    await pg.evaluate("()=>PFP_ISLAND_SHOP.openShop({vendor:'shop', tab:'skins', item:'commodore'})"); await pg.wait_for_timeout(2500)
    await pg.evaluate("()=>document.querySelector('#island-shop .ishop-card[data-id=commodore]')?.scrollIntoView({block:'center'})")
    await snap(pg, dev, 'live_server_met')
    st2 = await pg.evaluate("()=>PFP_SHOP_GOALS.goalStats()")
    errs.append(f'[{dev}] LIVE opened={ok} partial: {json.dumps(st)}'); errs.append(f'[{dev}] LIVE met: {json.dumps(st2)}')
    await ctx.close()

async def main():
    base = sys.argv[1]; devs = sys.argv[2].split(',') if len(sys.argv) > 2 else list(DEVICES)
    os.makedirs(OUT, exist_ok=True); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        for d in devs:
            await run(b, d, base, errs); await run_live(b, d, base, errs); print(d, 'done', flush=True)
        await b.close()
    open(f'{OUT}/log.txt', 'w').write('\n'.join(errs)); print('\n'.join(errs[:60]))
asyncio.run(main())
