# [Raul] scans every terrain chunk at every LOD step (1/2/4/8) + every mesh in the live scene for NaN / zero-length normals
import asyncio, json, sys
from playwright.async_api import async_playwright
import os; B=os.environ.get('B','http://127.0.0.1:8962')
JS='''async()=>{const F=await import('/js/island/foot.js');const r={terrain:{geos:0,verts:0,bad:0,nan:0},scene:{geos:0,verts:0,bad:0,badNames:[]}};
 const chk=(N)=>{let bad=0,nan=0;for(let i=0;i<N.count;i++){const x=N.getX(i),y=N.getY(i),z=N.getZ(i),l=Math.hypot(x,y,z);if(!isFinite(l))nan++;if(!(Math.abs(l-1)<1e-3))bad++;}return [bad,nan]};
 for(let cj=0;cj<5;cj++)for(let ci=0;ci<5;ci++)for(const s of [1,2,4,8]){const g=F.chunkGeo(ci,cj,s);if(!g.attributes.position.count)continue;const [b,n]=chk(g.attributes.normal);r.terrain.geos++;r.terrain.verts+=g.attributes.normal.count;r.terrain.bad+=b;r.terrain.nan+=n;g.dispose();}
 ISLAND.scene.traverse(o=>{const g=o.geometry;if(!g||!g.attributes||!g.attributes.normal)return;const [b]=chk(g.attributes.normal);r.scene.geos++;r.scene.verts+=g.attributes.normal.count;r.scene.bad+=b;if(b&&r.scene.badNames.length<12)r.scene.badNames.push(o.name+':'+b);});return r}'''
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx=await b.new_context(viewport={'width':800,'height':450}); await ctx.route('**/*supabase.co/**',lambda r:r.abort()); pg=await ctx.new_page()
    await pg.goto(B+'/island.html?quality=low&shot=1&coast=1&view=coast34'); await pg.wait_for_function('window.ISLAND_STATS&&ISLAND_STATS.calls>0',timeout=180000)
    r=await pg.evaluate(JS); print(json.dumps(r)); json.dump(r,open(sys.argv[1],'w'),indent=1) if len(sys.argv)>1 else None; await b.close()
asyncio.run(main())
