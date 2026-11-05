import asyncio, json; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
import sys
VW=sys.argv[1] if len(sys.argv)>1 else 'desktop'
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); ctx = await b.new_context(**({'viewport':{'width':1600,'height':900}} if VW=='desktop' else {'viewport':{'width':844,'height':390},'device_scale_factor':2,'is_mobile':True,'has_touch':True}))
    await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); pg = await ctx.new_page(); E=[]
    pg.on('pageerror', lambda e: E.append('PAGE '+str(e))); pg.on('console', lambda m: E.append(m.text[:200]) if m.type=='error' else None)
    await pg.goto('http://127.0.0.1:18970/raul-v6/island.html?coast=1&shot&quality='+('high' if VW=='desktop' else 'low')); await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=240000)
    r = await pg.evaluate("""(async()=>{ const CO = await import('./js/island/coast.js'), PM = await import('./js/onfoot/pirate.js'); const I = ISLAND, F = I.foot;
      const GG = await import('./js/pirateGear.js'); const D = GG.GEAR_DEFAULTS;
      const gs=[{...D,pants:'classic_pants',boots:'boots_classic'},{...D,body:1,pants:'sailor_trousers',boots:'sandals'},{...D,skinColor:3,hairColor:2,eyeColor:2,hat:'tricorn',outfit:'coat',hook:'hook_iron',carrySword:'cutlass',pants:'canvas_pants',boots:'boots_sea'},{...D,body:1,skinColor:5,hairColor:4,eyeColor:3,boots:'boots_buckle',pants:'leather_breeches',parrot:'parrot_green',cape:'cape_royal',carryMusket:'navy'}]; const out=[], prs=[];
      gs.forEach((g,k)=>{ const pr = PM.loadPirate({ look: {}, gear: GG.normalizeGear ? GG.normalizeGear(g) : g, local: true }); prs.push(pr); const _u=0, [x, z] = CO.t2w(-8 + k*0.9, -3.5), y = F.groundAt(x, z); pr.object.position.set(x, y, z); pr.object.rotation.y = CO.t2wYaw(-0.3); I.scene.add(pr.object); out.push([x,y,z]); });
      const PS = await import('./js/pirates.js'); setInterval(()=>{ prs.forEach((p,i)=>p.update(0.033, i%2?1.6:0, i%2?'walk':'idle')); PS.tickPirates(0.033); },33); await new Promise(r => setTimeout(r, 12000));
      const [cx, cz] = CO.t2w(-6.6, 2.6), [tx, tz] = CO.t2w(-6.6, -3.5), y0 = out[0][1]; I.camera.fov = 30; I.camera.updateProjectionMatrix(); I.camera.position.set(cx, y0+1.6, cz); if (I.controls) { I.controls.target.set(tx, y0+0.8, tz); I.controls.update(); } else I.camera.lookAt(tx, y0+0.8, tz);
      return out; })()""")
    await pg.wait_for_timeout(3000); await pg.screenshot(timeout=120000, path=f'/workspace/brand/v6_characters/shots/ingame_v6_{VW}.png'); print(json.dumps(r), E[:8]); await b.close()
asyncio.run(main())
