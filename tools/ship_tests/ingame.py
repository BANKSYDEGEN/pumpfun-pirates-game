# real-game check in the queue harbor: screenshots (desktop + phone landscape), console errors, kit LOD, muzzle -> ball launch
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
DEV={'desktop': dict(viewport={'width':1600,'height':900}, device_scale_factor=1),
     'phone': dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA)}
def save(levels, skin='classic'): return json.dumps({'profiles':{'device':{'v':1,'gold':0,'levels':levels,'skins':{'owned':[],'equipped':skin},'stats':{'kills':0,'deaths':0,'botKills':0}}}})
async def run(b, tree, dev, levels, tag, out):
    ctx = await b.new_context(**DEV[dev]); errs = []
    async def sb(r):
        await r.fulfill(status=503 if '/functions/v1/' in r.request.url else 200, content_type='application/json', body='[]' if '/functions/v1/' not in r.request.url else '{"error":"offline"}')
    await ctx.route('**/*supabase.co/**', sb)
    pg = await ctx.new_page(); pg.set_default_timeout(90000)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error',) else None)
    await pg.add_init_script(f"localStorage.setItem('pfp_name','CAPT_TEST'); localStorage.setItem('pfp_tut_seen','1'); localStorage.setItem('pfp_tutorial_v1','1'); localStorage.setItem('pfp_pvp_save_v1', {json.dumps(save(levels))});")
    await pg.goto(f'http://127.0.0.1:18952/{tree}/index.html?pvproom=shiptest{tag}', wait_until='domcontentloaded', timeout=120000)
    await pg.wait_for_function('window.PFP', timeout=120000)
    await pg.wait_for_timeout(1500)
    await pg.click('#btn-pvp')
    await pg.wait_for_function("window.PFP_PVP && PFP_PVP.active && PFP_PVP.where==='harbor'", timeout=60000)
    try:
        await pg.wait_for_selector('#pvp-entry-go', state='visible', timeout=8000); await pg.click('#pvp-entry-go')
    except Exception: pass
    await pg.evaluate("()=>{ PFP.game.stormOverride = 0; PFP.game.storm = 0; }")  # clear weather for the photo (visual only)
    await pg.wait_for_timeout(6000)
    await pg.screenshot(path=f'{out}/{tag}.png')
    box = await pg.evaluate("()=>{const r=document.getElementById('game').getBoundingClientRect(); return [r.width, r.height]}")
    W, H = box; await pg.mouse.move(W * 0.5, H * 0.45); await pg.mouse.down(); await pg.mouse.move(W * 0.5 + W * 0.28, H * 0.42, steps=12); await pg.mouse.up()
    await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{out}/{tag}_side.png')
    info = await pg.evaluate("""async () => {
      const u = PFP.player.mesh.userData, r = (v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
      let kit = null; try { const m = await import('./js/shipKit.js'); kit = { ready: m.KIT.ready, lo: m.KIT.lo, err: m.KIT.err }; } catch (e) { kit = 'no kit module'; }
      return { kit, quality: PFP.quality, guns: u.muzzles.port.length + u.muzzles.star.length, len: u.len, hitLen: u.hitLen, beam: u.beam, depth: u.depth,
               crew: !!u.crew, state: PFP.game.state, mode: PFP.game.mode };
    }""")
    # fire both broadsides; each ball must launch exactly at its own muzzle marker (world space, the frame it appears)
    fire = await pg.evaluate("""() => new Promise(res => {
      const p = PFP.player; if (PFP.game.state !== 'playing') return res({ skipped: PFP.game.state });
      const n0 = PFP.balls.length; p.cd.port = 0; p.cd.star = 0; PFP.fire('port'); p.cd.star = 0; PFP.fire('star');
      const mine = PFP.balls.slice(n0), d = [], t0 = performance.now();
      for (const b of mine) b._m = b.muzzle;
      window.PFP_BALL_TAP = (b) => { if (!b._m) return; const w = b._m.getWorldPosition(b.spawnAt.clone()); d.push(+b.spawnAt.distanceTo(w).toFixed(5)); };
      const iv = setInterval(() => { if (performance.now() - t0 > 15000 || d.length >= mine.length) { clearInterval(iv); window.PFP_BALL_TAP = null;
          res({ balls: mine.length, launched: d.length, maxLaunchOffset_m: d.length ? Math.max(...d) : null }); } }, 30); })""")
    info['fire'] = fire
    if dev == 'desktop' and not levels:  # the PvP skin picker: its cards are live renders from the game's own ship builder
        await pg.evaluate("()=>document.getElementById('btn-pvp-menu').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}))")
        await pg.wait_for_timeout(12000); await pg.screenshot(path=f'{out}/{tag}_picker.png')
    info['errors'] = errs[:10]
    await ctx.close(); return info
async def main():
    out = sys.argv[1]; jobs = sys.argv[2:]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        res = {}
        for j in jobs:
            tree, dev, lv = j.split(':', 2); levels = json.loads(lv) if lv else {}
            tag = f'{tree}_{dev}_c{levels.get("cannons", 0)}'
            res[tag] = await run(b, tree, dev, levels, tag, out); print(tag, json.dumps(res[tag]), flush=True)
        json.dump(res, open(f'{out}/ingame_{"_".join(sorted(set(j.split(":")[0] for j in jobs)))}.json', 'w'), indent=1)
asyncio.run(main())
