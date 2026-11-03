# crew before (b5aa30f: crew copy the captain) / after (this branch: crew uniform, then a crew tricorn) close-ups. python3 tools/crew_shots.py <port> <before_port>
import asyncio, sys, importlib.util
spec=importlib.util.spec_from_file_location('cp','/workspace/timothy-crewpets/tools/crew_pets.py'); 
src=open('/workspace/timothy-crewpets/tools/crew_pets.py').read().replace('asyncio.run(main())','')
sys.argv=[sys.argv[0]]+sys.argv[1:]; g={'__name__':'cp'}; exec(src,g)
async def main():
    errs=[]
    async with g['async_playwright']() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=g['ARGS'])
        for n,vp,ph in [('desktop',(1280,800),False),('phone',(390,844),True)]:
            ctx,pg=await g['page'](b,g['BEFORE'],n+'-before',vp,ph,errs); await pg.evaluate("PFP_GEAR.setLocalGear(%s)"%g['KIT']); await pg.wait_for_timeout(16000)
            await g['crewshot'](pg,f'{n}_crew_before'); await ctx.close()
            ctx,pg=await g['page'](b,g['B'],n,vp,ph,errs); await pg.evaluate("PFP_GEAR.setLocalGear(%s)"%g['KIT']); await pg.wait_for_timeout(16000)
            await g['crewshot'](pg,f'{n}_crew_after_uniform')
            await pg.evaluate("PFP_CREW.setCrewLoadout({crewhat:'tricorn',crewoutfit:'coat'})"); await pg.wait_for_timeout(12000)
            await g['crewshot'](pg,f'{n}_crew_after_tricorn_coat'); await ctx.close()
        await b.close()
    print('errors', errs[:6])
asyncio.run(main())
