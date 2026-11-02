# PvP skin picker in the real game: every card is renderPreview() -> compilePreview() (the game's own ship builder)
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    tree, out = sys.argv[1], sys.argv[2]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        ctx = await b.new_context(viewport={'width': 1280, 'height': 900}, device_scale_factor=2)
        await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, content_type='application/json', body='[]'))
        pg = await ctx.new_page(); pg.set_default_timeout(120000)
        await pg.add_init_script("localStorage.setItem('pfp_name','CAPT_TEST'); localStorage.setItem('pfp_tut_seen','1'); localStorage.setItem('pfp_tutorial_v1','1');")
        await pg.goto(f'http://127.0.0.1:18952/{tree}/index.html?pvproom=picker{tree}', wait_until='domcontentloaded')
        await pg.wait_for_function('window.PFP'); await pg.wait_for_timeout(1500)
        await pg.click('#btn-pvp'); await pg.wait_for_function("window.PFP_PVP && PFP_PVP.where==='harbor'")
        try: await pg.wait_for_selector('#pvp-entry-go', state='visible', timeout=8000); await pg.click('#pvp-entry-go')
        except Exception: pass
        await pg.evaluate("()=>{ PFP.game.stormOverride = 0; document.getElementById('btn-pvp-menu').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})); }")
        for _ in range(40):
            await pg.wait_for_timeout(3000)
            n = await pg.evaluate("()=>[...document.querySelectorAll('#pvp-skins .pvp-skin')].filter(c=>c.querySelector('img,canvas:not(.sk-swatch)')&&!c.querySelector('canvas[width=\"192\"]')).length")
            done = await pg.evaluate("()=>[...document.querySelectorAll('#pvp-skins .pvp-skin')].map(c=>c.firstElementChild?.tagName+':'+(c.firstElementChild?.className||''))")
        await pg.evaluate("()=>document.getElementById('pvp-skins').scrollIntoView({block:'center'})")
        await pg.wait_for_timeout(500)
        el = await pg.query_selector('#pvp-skins'); await el.screenshot(path=out)
        print(done)
asyncio.run(main())
