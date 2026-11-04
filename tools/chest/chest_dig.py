# [v152] CHEST ITEMS: the real dig flow (js/dock/treasure.js -> js/pvp.js -> js/pvpSave.js api) against a MOCKED pvp Edge Function
# (maps_state / map_dig answered here; nothing reaches Supabase). One dig per reward type: gold, item for you, item for your crew,
# duplicate (+ a weapon card, which only drops once the WEAPON STORE is merged). Shots of each reveal.
# usage: PFP_B=http://127.0.0.1:PORT python3 tools/chest/chest_dig.py desktop|phone|phoneland   (one headless browser at a time)
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import hchest as h; from hchest import *  # = pfp-treasure-test/h.py with slow-box timeouts
h.SC = os.environ.get('PFP_SC', '/workspace/pfp-chest-shots')
DEV = sys.argv[1]
U = lambda n: f'7a1b2c3d-0000-4a2b-9c3d-{n:012d}'
CASES = [  # (name, map, answer)
  ('gold',      {'id': U(1), 'tier': 'common', 'spot': 'dig1', 'source': 'boss'},   {'ok': True, 'gold': 940, 'dig_gold': 940, 'tier': 'common', 'holder': False, 'loot': None}),
  ('player',    {'id': U(2), 'tier': 'rare', 'spot': 'dig2', 'source': 'kill'},     {'ok': True, 'gold': 6400, 'dig_gold': 6400, 'tier': 'rare', 'holder': False, 'loot': {'item': 'hat:bicorne', 'crew': False, 'dup': False, 'dup_gold': 0, 'price': 1200}}),
  ('crew',      {'id': U(3), 'tier': 'common', 'spot': 'dig3', 'source': 'boss'},   {'ok': True, 'gold': 820, 'dig_gold': 820, 'tier': 'common', 'holder': False, 'loot': {'item': 'crewoutfit:coat', 'crew': True, 'dup': False, 'dup_gold': 0, 'price': 1000}}),
  ('duplicate', {'id': U(4), 'tier': 'common', 'spot': 'dig4', 'source': 'boss'},   {'ok': True, 'gold': 1300, 'dig_gold': 1100, 'tier': 'common', 'holder': False, 'loot': {'item': 'hat:tricorn', 'crew': False, 'dup': True, 'dup_gold': 200, 'price': 400}}),
  ('legendary', {'id': U(5), 'tier': 'legendary', 'spot': 'dig5', 'source': 'streak'}, {'ok': True, 'gold': 41200, 'dig_gold': 41200, 'tier': 'legendary', 'holder': True, 'loot': {'item': 'sword:rapier', 'crew': False, 'dup': False, 'dup_gold': 0, 'price': 4000}}),
]
MAPS = [c[1] for c in CASES]; ANS = {c[1]['id']: c[2] for c in CASES}; LOG = []
async def fn_route(route):
  try: b = json.loads(route.request.post_data or '{}')
  except Exception: b = {}
  a = b.get('action'); LOG.append(a)
  if a == 'maps_state': return await route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'new': 0, 'maps': MAPS, 'recent': []}))
  if a == 'map_dig':
    m = next((x for x in MAPS if x['id'] == b.get('map')), None)
    if not m or m['spot'] != b.get('spot'): return await route.fulfill(status=409, content_type='application/json', body=json.dumps({'error': 'wrong spot'}))
    MAPS.remove(m); return await route.fulfill(status=200, content_type='application/json', body=json.dumps(ANS[m['id']]))
  return await route.fulfill(status=400, content_type='application/json', body=json.dumps({'error': 'mock: ' + str(a)}))
async def main():
  async with async_playwright() as p:
    kw = dict(w=1280, h=800) if DEV == 'desktop' else dict(w=390, h=844, mobile=True) if DEV == 'phone' else dict(w=844, h=390, mobile=True)
    errs = []; R = {}
    b, ctx, pg = await boot(p, q='low', **kw)  # low on every device: the reveal is a DOM overlay, and the box is shared
    await ctx.route('**/functions/v1/pvp', fn_route)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'supabase' not in m.text.lower() else None)
    await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await gwait(pg, 0.3)
    await pg.evaluate("window.__gear=[]; addEventListener('pfp-gear', e => window.__gear.push(1))")
    await pg.evaluate("(()=>{PFP.game.stormOverride=0;PFP.game.storm=0;const d=PFP.dock; if (d.docking.mode==='docked') return; for (const b of d.layout.berths) { d.dockAt(b.id); if (d.docking.mode !== 'sea') break; } })()")
    await until(pg, "PFP.dock.docking.mode==='docked'", timeout=900000)  # slow on a busy box
    await pg.evaluate("PFP.dock.goAshore()"); await until(pg, 'PFP.dock.onFoot'); await gwait(pg, 0.5)
    await pg.evaluate("PFP.dock.treasure.refresh()"); await until(pg, "PFP.dock.treasure.maps.length>=5", timeout=30000)
    for name, m, ans in CASES:
      await pg.evaluate(f"(()=>{{const q=PFP.dock.world.footInteract.find(q=>q.id==='{m['spot']}'); const W=PFP.dock.walker.w; W.x=q.x; W.z=q.z; W.y=PFP.dock.world.ground(q.x,q.z); PFP.dock.walker.snapCam();}})()")
      await gwait(pg, 0.8)
      R[name + '_prompt'] = await pg.evaluate("document.querySelector('#dk-acts button:not([hidden])')?.textContent||null")
      await pg.evaluate("document.querySelector('#dk-acts button:not([hidden])').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))")
      if ans.get('loot'): await until(pg, "!!document.querySelector('#ch-reveal.on .ch-card')", timeout=30000); await pg.wait_for_timeout(2400)
      else: await until(pg, "/TREASURE/.test(document.getElementById('dk-toast')?.textContent||'')", timeout=30000); await pg.wait_for_timeout(500)
      R[name] = await ev(pg, "({card: document.querySelector('#ch-reveal.on')?.innerText?.replace(/\\s+/g,' ')||null, toast: document.getElementById('dk-toast')?.textContent||'', wear: !!document.querySelector('#ch-reveal .wear'), maps_left: PFP.dock.treasure.maps.length})")
      await shot(pg, f'chest_{DEV}_{name}')
      if name == 'crew':  # DRESS CREW equips the crew coat (client gear + the 'pfp-gear' redress)
        n0 = await pg.evaluate("window.__gear.length")
        await pg.evaluate("document.querySelector('#ch-reveal .wear').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))"); await pg.wait_for_timeout(800)
        R['crew_wear'] = await ev(pg, f"({{closed: !document.querySelector('#ch-reveal.on'), gear_events: window.__gear.length - {n0}}})")
      else:
        await pg.evaluate("PFP.dock.treasure.chest.hide(true)")
      await pg.wait_for_timeout(300)
    await pg.evaluate("document.getElementById('tm-btn').click()"); await pg.wait_for_timeout(1000)
    R['maps_hint'] = await pg.evaluate("document.querySelector('#tm-map, .tm-hint, #tm-hint')?.innerText||null")
    R['digs_sent'] = LOG.count('map_dig')
    print('RESULT', json.dumps({'dev': DEV, **R, 'errors': errs[:20]}))
    await b.close()
asyncio.run(main())
