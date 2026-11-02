# [Raul] in-game perf probe (index.html?coast=1, PvP harbor -> dock -> ashore), renderer.info over one full frame (autoReset off,
# so bloom / shadow passes count). Supabase blocked. usage: B=http://127.0.0.1:8963 perf_game.py TAG [high|low] [shots]
import asyncio, json, os, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
B=os.environ.get('B','http://127.0.0.1:8963'); OUT='/workspace/raul-island/screens/coast_v2'
PERF='''(async()=>{const R=PFP.renderer,I=R.info;I.autoReset=false;const raf=()=>new Promise(r=>requestAnimationFrame(r));
 await raf();await raf();I.reset();await raf();const c=I.render.calls,t=I.render.triangles;I.autoReset=true;return {calls:c,tris:t}})()'''
BRK='''(()=>{const o2={};const top=o=>{let p=o;const path=[];while(p&&p!==PFP.scene){path.push(p.name||p.type);p=p.parent}return path.slice(-3).reverse().join('/')};
 PFP.scene.traverseVisible(o=>{if(!o.isMesh&&!o.isLine&&!o.isPoints&&!o.isSprite)return;const g=o.geometry;if(!g)return;const t=((g.index?g.index.count:(g.attributes.position?g.attributes.position.count:0))/3)*(o.isInstancedMesh?o.count:1);
 const k=top(o)+(o.castShadow?' [sh]':'');o2[k]=o2[k]||[0,0];o2[k][0]++;o2[k][1]+=Math.round(t)});return Object.entries(o2).sort((a,b)=>b[1][0]-a[1][0]).slice(0,30).map(e=>e[0]+' n='+e[1][0]+' t='+e[1][1]).join('\\n')})()'''
CALLS='''new Promise(res=>{const R=PFP.renderer,o=R.renderBufferDirect.bind(R),T={};R.renderBufferDirect=function(cam,scene,geo,mat,obj,grp){
 let p=obj,top='';while(p&&p.parent&&p.parent!==PFP.scene)p=p.parent;top=(p&&p.name)||'?';const inFoot=top==='onfoot_world';
 let n=inFoot?(obj.name||'?').replace(/_-?\\d+_-?\\d+/,'_tile').replace(/chunk.*/,'chunk'):top+(obj.type==='Mesh'?'':'/'+obj.type);if(cam!==PFP.camera)n+=' [pass]';T[n]=(T[n]||0)+1;return o(cam,scene,geo,mat,obj,grp)};
 requestAnimationFrame(()=>{for(const k in T)T[k]=0;requestAnimationFrame(()=>{R.renderBufferDirect=o;res(JSON.stringify(Object.entries(T).filter(e=>e[1]).sort((a,b)=>b[1]-a[1])))})})})'''
# harbor frame from js/island/coast.js: hx = 250 - lz, hz = 60 + lx (town-local lx along the waterfront, lz out to sea)
SPOTS0=[('foot_thead_P1',-90,42,1.57),('foot_plaza',20,-25,1.57),('foot_main_street',6,-120,1.57),('foot_fort',30,-200,1.57),('foot_mole_spyglass',108,104,-1.57),('foot_inland',6,-450,1.57)]
SPOTS=[s for s in SPOTS0 if not os.environ.get('ONLY') or s[0] in os.environ['ONLY']]
async def gwait(pg,s): t0=await pg.evaluate('PFP.game.t'); await pg.wait_for_function(f'PFP.game.t>={t0+s}',timeout=240000,polling=200)
async def main():
  tag=sys.argv[1]; q=sys.argv[2] if len(sys.argv)>2 else 'high'; shots=sys.argv[3].split(',') if len(sys.argv)>3 else []
  W,H=(1600,900) if q=='high' else (844,390); res={}
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=ARGS)
    kw=dict(viewport={'width':W,'height':H})
    if q=='low': kw.update(device_scale_factor=2,is_mobile=True,has_touch=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    ctx=await b.new_context(**kw); await ctx.route('**/*supabase.co/**',lambda r:r.abort())
    await ctx.add_init_script("try{localStorage.setItem('pfp_gfx_hint','1');localStorage.setItem('pfp_tut_seen','1')}catch(e){}")
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    await pg.goto(B+f'/index.html?coast=1&quality={q}'); await pg.wait_for_function('window.PFP && PFP.renderer',timeout=180000); await pg.wait_for_timeout(800)
    await pg.evaluate("document.getElementById('btn-pvp').click()"); await pg.wait_for_function("PFP.pvp && PFP.pvp.where==='harbor'",timeout=60000)
    await pg.wait_for_function('PFP.dock && PFP.dock.on',timeout=180000); await pg.evaluate("document.getElementById('pvp-entry-go')?.click()"); await gwait(pg,0.5)
    async def rec(name):
      r=await pg.evaluate(PERF); res[name]=r; print(q,name,r,flush=True)
      if os.environ.get('BRK'): print(await pg.evaluate(CALLS),flush=True)
      if name in shots or 'all' in shots: await pg.screenshot(path=f'{OUT}/{tag}_game_{q}_{name}.png',timeout=240000)
    await rec('at_sea')
    await pg.evaluate("(()=>{const b=PFP.dock.layout.berths[0],s=PFP.player;s.x=b.x+b.out.x*22;s.z=b.z+b.out.z*22-6;s.yaw=Math.PI/2;s.speed=2.5;s.sail=1;s.anchor=false})()")
    await gwait(pg,0.6); await pg.click('#dk-acts button:not([hidden])'); await pg.wait_for_function("PFP.dock.docking.mode==='docked'",timeout=240000); await gwait(pg,0.3)
    await rec('docked')
    await pg.click('#dk-acts button.primary'); await pg.wait_for_function('PFP.dock.onFoot',timeout=240000); await gwait(pg,0.4)
    for name,lx,lz,yaw in SPOTS:
      x,z=250-lz,60+lx
      await pg.evaluate(f"(()=>{{const W=PFP.dock.walker;W.w.x={x};W.w.z={z};W.w.yaw={yaw};W.w.camYaw={yaw};W.w.y=PFP.dock.world.ground({x},{z});W.snapCam()}})()"); await gwait(pg,0.4)
      await rec(name)
    res['errors']=errs[:5]; await b.close()
  json.dump(res,open(f'{OUT}/perf_game_{tag}_{q}.json','w'),indent=1)
asyncio.run(main())
