# phone budget: draw calls / tris per skin and level, base (main) vs game tree.  cost2.py out.json [trees]
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
SK=['classic','blood','storm','kraken','golden','ghost','flaming','diamond']
MAX={'cannons':8,'hull':6,'armor':6,'sails':6,'range':6,'rudder':6,'reload':6}
LV=[('lvl0',{}),('cannons8',{'cannons':8}),('max',MAX)]
async def main():
    out=sys.argv[1]; trees=(sys.argv[2] if len(sys.argv)>2 else 'base,game').split(',')
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=ARGS); res={}
        for tree in trees:
            for q in ('low','high'):
                pg=await b.new_page(viewport={'width':400,'height':300})
                await pg.goto(f'http://127.0.0.1:18952/{tree}/tools/ship_viewer.html?quality={q}',timeout=120000); await pg.wait_for_function('window.V_READY',timeout=120000)
                for sk in SK:
                    for ln,lv in LV:
                        r=await pg.evaluate('''(c)=>{ V.show({levels:c.lv, skin:c.sk, pvp:true}); V.frame(0.9,0.2,2.5); V.step(1/30); V.renderer.info.autoReset=true; V.step(1/30); const i=V.renderer.info.render;
                          let tris=0, meshes=0, pts=0; V.ship.traverse(o=>{ if((o.isMesh||o.isPoints||o.isLine) && o.visible){ meshes += o.isInstancedMesh ? 1 : 1; const g=o.geometry; if(o.isPoints) pts += g.attributes.position.count; else tris += (g.index?g.index.count:g.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);} });
                          return {calls:i.calls, shipDraws:meshes, shipTris:Math.round(tris), particles:pts}; }''',{'lv':lv,'sk':sk})
                        res[f'{tree} {q} {sk} {ln}']=r; print(tree,q,sk,ln,r,flush=True)
                await pg.close()
        json.dump(res,open(out,'w'),indent=1)
asyncio.run(main())
