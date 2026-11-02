# your captain-creator pirate at the wheel, from the real gameplay camera (desktop + phone): registers buildCaptainMesh from the
# timothy/captain-creator tree (read-only, served at /captain) and attaches a pfp_captain_v1 object to the player ship's captain anchor
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
DEV={'desktop': dict(viewport={'width':1600,'height':900}, device_scale_factor=1),
     'phone': dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA)}
CAP={'v':1,'hat':'tricorn','hair':'short','face':'eyepatch','outfit':'coat','colors':{'skin':'#d9a074','hair':'#161616','coat':'#1b2f6b','accent':'#ffcd77'}}
def save(levels): return json.dumps({'profiles':{'device':{'v':1,'gold':0,'levels':levels,'skins':{'owned':[],'equipped':'classic'},'stats':{'kills':0,'deaths':0,'botKills':0}}}})
async def run(b, tree, dev, levels, out):
    ctx = await b.new_context(**DEV[dev]); errs = []
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, content_type='application/json', body='[]'))
    pg = await ctx.new_page(); pg.set_default_timeout(90000)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    await pg.add_init_script(f"localStorage.setItem('pfp_name','CAPT_TEST'); localStorage.setItem('pfp_tut_seen','1'); localStorage.setItem('pfp_tutorial_v1','1'); localStorage.setItem('pfp_pvp_save_v1', {json.dumps(save(levels))}); localStorage.setItem('pfp_captain_v1', {json.dumps(json.dumps(CAP))});")
    await pg.goto(f'http://127.0.0.1:18952/{tree}/index.html?pvproom=cap{dev}', wait_until='domcontentloaded', timeout=120000)
    await pg.wait_for_function('window.PFP', timeout=120000); await pg.wait_for_timeout(1500)
    await pg.click('#btn-pvp'); await pg.wait_for_function("window.PFP_PVP && PFP_PVP.active && PFP_PVP.where==='harbor'", timeout=60000)
    try: await pg.wait_for_selector('#pvp-entry-go', state='visible', timeout=8000); await pg.click('#pvp-entry-go')
    except Exception: pass
    info = await pg.evaluate("""async () => { PFP.game.stormOverride = 0; PFP.game.storm = 0;
      const cc = await import('/captain/js/captain/captainCreator.js'), slot = await import('./js/captainSlot.js');
      slot.registerCaptainBuilder(cc.buildCaptainMesh); slot.setLocalCaptain(cc.getCaptain());
      const fig = slot.attachCaptain(PFP.player.mesh, slot.localCaptain()); const a = slot.captainAnchor(PFP.player.mesh);
      return { attached: !!fig, anchor: a && a.pos.toArray().map(v => +v.toFixed(2)), captain: cc.getCaptain() }; }""")
    await pg.wait_for_timeout(5000); await pg.screenshot(path=f'{out}_{dev}.png')
    await pg.mouse.move(600 if dev == 'phone' else 800, 200)
    for _ in range(6): await pg.mouse.wheel(0, -300); await pg.wait_for_timeout(150)
    await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{out}_{dev}_zoom.png')
    info['errors'] = errs[:5]; print(dev, json.dumps(info), flush=True); await ctx.close()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        for dev in sys.argv[3:] or ['desktop', 'phone']: await run(b, sys.argv[1], dev, {}, sys.argv[2])
asyncio.run(main())
