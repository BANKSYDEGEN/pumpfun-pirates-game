# every shop grid + the PET STORE detail pane, desktop + phone, after the v5 preview re-bake -> screens/v5previews/
# python3 tools/v5_preview_shots.py <port>
import asyncio, sys, os
src=open('/workspace/timothy-crewpets/tools/crew_pets.py').read().replace('asyncio.run(main())','')
sys.argv=['x',sys.argv[1]]; g={'__name__':'cp'}; exec(src,g)
OUT=g['OUT']+'/v5previews'
SHOPS=[('clothes_hats',"window.openShop({vendor:'clothes',tab:'gear',slot:'hat'})"),('clothes_outfits',"window.openShop({vendor:'clothes',tab:'gear',slot:'outfit'})"),
       ('clothes_hooks',"window.openShop({vendor:'clothes',tab:'gear',slot:'hook'})"),('pets',"window.openShop({vendor:'pets'})"),('crew',"window.openShop({vendor:'crew'})"),
       ('ship_shop',"window.openShop({vendor:'ships',tab:'skins'})"),('upgrade_shop',"window.PFP_OPEN_UPGRADES && window.PFP_OPEN_UPGRADES()")]
MOCK=open('/workspace/timothy-crewpets/tools/shop_before_after.py').read().split('MOCK="""')[1].split('"""')[0]
async def main():
    os.makedirs(OUT,exist_ok=True); errs=[]
    async with g['async_playwright']() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=g['ARGS'])
        for n,vp,ph in [('desktop',(1280,800),False),('phone',(390,844),True)]:
            ctx,pg=await g['page'](b,g['B'],n,vp,ph,errs); await pg.evaluate(MOCK)
            for s,js in SHOPS:
                await pg.evaluate("window.closeShop && closeShop(); document.querySelector('#shop-close, .shop-x, #upg-close')?.click?.()"); await pg.wait_for_timeout(400)
                await pg.evaluate(js); await pg.wait_for_timeout(6000); await pg.screenshot(path=f'{OUT}/{n}_{s}.png')
                if s=='pets':
                    for pid in ['parrot_gold','parrot_red']:
                        await pg.evaluate(f"document.querySelector('#island-shop .ishop-card[data-id=\"parrot:{pid}\"]').click()"); await pg.wait_for_timeout(2500)
                        await pg.evaluate("document.querySelector('#island-shop .ishop-detail')?.scrollIntoView({block:'center'})"); await pg.screenshot(path=f'{OUT}/{n}_pets_detail_{pid}.png')
            await ctx.close()
        await b.close()
    print('errors', [e for e in errs if 'supabase' not in e.lower()][:6])
asyncio.run(main())
