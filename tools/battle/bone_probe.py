import asyncio, json; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); pg = await (await b.new_context(viewport={'width':400,'height':300})).new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto('http://127.0.0.1:18960/timothy-battle/tools/gear_viewer.html'); await pg.wait_for_timeout(1500)
    r = await pg.evaluate("""(async()=>{ const THREE = await import('three'); const P = await import('/timothy-battle/js/pirates.js');
      const out = {}; for (const fem of [false, true]) { const fig = await new Promise(res => { const f = P.pirateFigure({ female: fem, low: false, onReady: () => res(f) }); });
        const sc = new THREE.Scene(); sc.add(fig); const v4 = fig.userData.v4; v4.play('idle', {fade:0}); v4.update(0.3); fig.updateMatrixWorld(true);
        const o = {}; for (const n of ['spine','head','upperarmR','forearmR','upperarmL','forearmL','root']) { const bn = v4.scene.getObjectByName(n); const p = new THREE.Vector3(), q = new THREE.Quaternion(); bn.getWorldPosition(p); bn.getWorldQuaternion(q);
          // bone local axes in world
          const ax = [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map(v=>v.applyQuaternion(q).toArray().map(x=>+x.toFixed(2)));
          o[n] = { p: p.toArray().map(x=>+x.toFixed(3)), ax, parent: bn.parent.name, kids: bn.children.map(c=>c.name+':'+c.position.toArray().map(x=>+x.toFixed(3))) }; }
        out[fem?'f':'m'] = o; }
      return out; })()""")
    print(json.dumps(r, indent=0)); print(errs[:3]); await b.close()
asyncio.run(main())
