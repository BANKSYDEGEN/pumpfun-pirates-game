# every shop, desktop + phone, BEFORE (b5aa30f server) / AFTER (this branch), 3 s after opening (what a player sees first).
# python3 tools/shop_before_after.py <after_port> <before_port>
import asyncio, sys
src=open('/workspace/timothy-crewpets/tools/crew_pets.py').read().replace('asyncio.run(main())','')
sys.argv=['x',sys.argv[1],sys.argv[2]]; g={'__name__':'cp'}; exec(src,g)
OUT=g['OUT']+'/shops'
SHOPS=[('clothes',"window.openShop({vendor:'clothes',tab:'gear',slot:'hat'})"),('pets',"window.openShop({vendor:'pets'})"),('crew',"window.openShop({vendor:'crew'})"),
       ('ship_skins',"window.openShop({vendor:'ships',tab:'skins'})"),('upgrades',"window.PFP_OPEN_UPGRADES && window.PFP_OPEN_UPGRADES()")]
MOCK="""PFP_ISLAND_SHOP.setShopProvider(PFP_ISLAND_SHOP.mockProvider({ gold: 30000, stats:{ kills: 1240, deaths: 300, botKills: 120, harborKills: 412, bossKills: 37 },
  owned:{ skins:['classic','blood'], gear:['hat:tricorn','parrot:parrot_blue','outfit:coat'] }, equipped:{ skin:'blood', gear:{ hat:'tricorn', outfit:'coat', eyes:'plain', parrot:'parrot_blue', hook:'none', leg:'none', crewhat:'bandana', crewoutfit:'tank' } } }))"""
async def main():
    import os; os.makedirs(OUT,exist_ok=True); errs=[]
    async with g['async_playwright']() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=g['ARGS'])
        for n,vp,ph in [('desktop',(1280,800),False),('phone',(390,844),True)]:
            for tag,base in [('before',g['BEFORE']),('after',g['B'])]:
                ctx,pg=await g['page'](b,base,f'{n}-{tag}',vp,ph,errs); await pg.evaluate(MOCK)
                for s,js in SHOPS:
                    await pg.evaluate("window.closeShop && closeShop(); document.querySelector('#shop-close, .shop-x, #upg-close')?.click?.()"); await pg.wait_for_timeout(400)
                    await pg.evaluate(js); await pg.wait_for_timeout(3000); await pg.screenshot(path=f'{OUT}/{n}_{s}_{tag}.png')
                await ctx.close()
        await b.close()
    print('errors', [e for e in errs if 'supabase' not in e.lower()][:6])
asyncio.run(main())
