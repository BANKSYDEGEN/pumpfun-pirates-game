# [Raul] perf probe: renderer.info per view, High 1600x900 + Phone Low 844x390, Supabase blocked. usage: perf_coast.py TAG [shots]
import asyncio, json, sys
from playwright.async_api import async_playwright
import os; B=os.environ.get('B','http://127.0.0.1:8962'); OUT='/workspace/raul-island/screens/coast_v2'
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
POSE='''(v)=>{const I=ISLAND,F=I.foot,c=ISLAND_FOOT,T=(a,b)=>{const y=-Math.PI/2,C=Math.cos(y),S=Math.sin(y);return [-640+a*C+b*S,-90-a*S+b*C]};
 if(v==='fort'){const [x,z]=T(6,-150),[tx,tz]=T(46,-232);I.camera.position.set(x,F.H(x,z)+10,z);I.controls.target.set(tx,F.H(tx,tz)+14,tz);}
 else if(v==='piers'){const [x,z]=T(-90,40),[tx,tz]=T(30,-70);I.camera.position.set(x,4.6,z);I.controls.target.set(tx,9,tz);}
 else if(v==='mole'){const [x,z]=T(108,104),[tx,tz]=T(-60,250);I.camera.position.set(x,4.2,z);I.controls.target.set(tx,3,tz);}
 else I.goView(v,true); I.controls.update(); return true}'''
VIEWS=['street','fort','coast34','coastTop','piers','mole']
async def run(b,q,w,h,tag,shots):
  ctx=await b.new_context(viewport={'width':w,'height':h}); await ctx.route('**/*supabase.co/**',lambda r:r.abort())
  errs=[]; pg=await ctx.new_page(); pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
  await pg.goto(f'{B}/island.html?quality={q}&shot=1&coast=1&view=coast34')
  await pg.wait_for_function('window.ISLAND_STATS && ISLAND_STATS.calls>0',timeout=180000); res={}
  for v in VIEWS:
    await pg.evaluate(POSE,v)
    for _ in range(3): await pg.evaluate('window.__s=ISLAND_STATS'); await pg.wait_for_function('ISLAND_STATS!==window.__s',timeout=120000); await pg.evaluate(POSE,v)
    s=await pg.evaluate('ISLAND_STATS'); res[v]={'calls':s['calls'],'tris':s['triangles']}; print(q,v,res[v],flush=True)
    if shots and v in shots: await pg.screenshot(path=f'{OUT}/{tag}_{q}_{v}.png',timeout=240000)
  res['errors']=errs[:5]; await ctx.close(); return res
async def main():
  tag=sys.argv[1]; shots=sys.argv[2].split(',') if len(sys.argv)>2 else []
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=ARGS)
    out={'high':await run(b,'high',1600,900,tag,shots),'low':await run(b,'low',844,390,tag,shots)}
    await b.close()
  json.dump(out,open(f'{OUT}/perf_{tag}.json','w'),indent=1)
asyncio.run(main())
