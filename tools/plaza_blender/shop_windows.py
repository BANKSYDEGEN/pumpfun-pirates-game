# [Timothy] PUMPFUN PIRATES: the two separate ship shops in the real game (index.html -> harbor -> dock -> ashore):
# SHIP SKINS storefront (vendor ships, skins only) and the UPGRADE SHOP storefront (open: 'upgrades' -> the upgrades panel, no skins tab).
# usage: python3 shop_windows.py WT OUTDIR desktop|phone
import asyncio, sys, json, os; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT, OUT, DEV = sys.argv[1], sys.argv[2], sys.argv[3]; os.makedirs(OUT, exist_ok=True)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob = DEV != 'desktop'
    kw = dict(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width':1280,'height':720})
    ctx = await b.new_context(**kw)
    async def cors(r):
      if r.request.method == 'OPTIONS': return await r.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS'})
      resp = await r.fetch(); h = dict(resp.headers); h['access-control-allow-origin'] = '*'; await r.fulfill(response=resp, headers=h)
    await ctx.route('**/functions/v1/**', cors)
    await ctx.add_init_script("localStorage.setItem('pfp_name','SHOP_QA');localStorage.setItem('pfp_tut_seen','1');localStorage.setItem('pfp_tutorial_v1','1');localStorage.setItem('pfp_gfx_hint','1')")
    pg = await ctx.new_page(); pg.set_default_timeout(180000); errs = []; pg.on('pageerror', lambda e: errs.append('PAGE '+str(e)))
    await pg.goto(f'http://127.0.0.1:18960/{WT}/index.html'); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=240000); await pg.wait_for_timeout(2000)
    await (pg.tap('#btn-pvp') if mob else pg.click('#btn-pvp'))
    await pg.wait_for_function("PFP.dock && PFP.dock.on", timeout=300000); await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await pg.wait_for_timeout(3000)
    await pg.evaluate("(()=>{PFP.game.stormOverride=0;PFP.game.storm=0;const d=PFP.dock; for (const b of d.layout.berths) { d.dockAt(b.id); if (d.docking.mode !== 'sea') break; } })()")
    await pg.wait_for_function("PFP.dock.docking.mode==='docked'", timeout=600000)
    await pg.evaluate("PFP.dock.goAshore()"); await pg.wait_for_function('PFP.dock.onFoot', timeout=600000); await pg.wait_for_timeout(1500)
    R = {}
    for sid, name in (('shop_ships', 'shop_window_ship_skins'), ('shop_upgrades', 'shop_window_upgrades')):
      q = await pg.evaluate(f"(()=>{{ const q = PFP.dock.layout.interact.find(x => x.id === '{sid}'); if (!q) return null; PFP.dock.interact(q); return {{ vendor: q.vendor, open: q.open || null, label: q.label }}; }})()")
      await pg.wait_for_timeout(4000)
      R[sid] = { 'q': q, 'ui': await pg.evaluate("""(()=>{ const vis = (el) => el && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
        const isle = document.querySelector('.isle-shop, #island-shop, [id*=\"isle\"][class*=\"shop\"]'); const up = document.getElementById('shop');
        const tabs = [...document.querySelectorAll('button[role=tab], .shop-isle-tabs button, [data-tab]')].filter(vis).map(b => b.textContent.trim());
        const h = [...document.querySelectorAll('h1, h2, .title')].filter(vis).map(e => e.textContent.trim()).slice(0, 4);
        return { upgradesPanel: !!(up && vis(up)), skinsTabInUpgrades: !!(up && vis(up.querySelector('.shop-isle-tabs'))), tabs, headings: h }; })()""") }
      await pg.screenshot(path=f'{OUT}/{DEV}_{name}.png'); print('shot', name, flush=True)
      await pg.keyboard.press('Escape'); await pg.wait_for_timeout(800)
      await pg.evaluate("(()=>{ for (const s of ['#shop-close', '.isle-close', '#isle-shop-close', '[data-close]']) { const e = document.querySelector(s); if (e && e.offsetParent) e.click(); } })()"); await pg.wait_for_timeout(800)
    R['errors'] = errs[:6]; print('RESULT', json.dumps(R)); await b.close()
asyncio.run(main())
