# PUMPFUN PIRATES shop goals in the PROFILE panel (Emerly's v103 js/uiProfile.js: tap the captain card). A server shop view is
# faked ('pfp-shop-sync' with stats + modes), then the real profile opens in Battle Royale; the SHOP GOALS section mounts itself.
# Also one "no stats" pass (brand-new pirate: nothing saved, nothing from the server). All 4 layouts, port 18953.
import asyncio, sys, os, json
sys.path.insert(0, '/workspace/timothy-ui/tools')
from shots import new_page, to_harbor, ARGS, DEVICES
from playwright.async_api import async_playwright
OUT = '/workspace/timothy-ui/screens/goals'
async def main():
    base = sys.argv[1]; devs = sys.argv[2].split(',') if len(sys.argv) > 2 else list(DEVICES)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        for dev in devs:
            errs = []
            ctx, pg = await new_page(b, dev, base, errs, {})
            await to_harbor(pg); await pg.wait_for_function("window.PFP_SHOP_GOALS && window.PFP_PROFILE", timeout=20000)
            await pg.evaluate("()=>PFP_PROFILE.openProfile()"); await pg.wait_for_timeout(900)
            await pg.evaluate("()=>document.getElementById('pf-goals')?.scrollIntoView({block:'start'})")
            await pg.screenshot(path=f'{OUT}/{dev}_profile_goals_nostats.png')
            await pg.evaluate("()=>{ PFP_PROFILE.closeProfile(); dispatchEvent(new CustomEvent('pfp-shop-sync',{detail:{stats:{kills:41,deaths:7,botKills:300,harborKills:260,bossKills:100},modes:{solo:30,squads:11}}})); PFP_PROFILE.openProfile(); }")
            await pg.wait_for_timeout(900)
            await pg.evaluate("()=>document.getElementById('pf-goals')?.scrollIntoView({block:'start'})")
            await pg.screenshot(path=f'{OUT}/{dev}_profile_goals.png')
            n = await pg.evaluate("()=>document.querySelectorAll('#pf-goals .pg-item').length")
            print(dev, 'goal items', n, errs[:5], flush=True); await ctx.close()
        await b.close()
asyncio.run(main())
