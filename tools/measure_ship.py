import asyncio, json; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); pg = await (await b.new_context()).new_page()
    await pg.goto('http://127.0.0.1:18960/timothy-plaza/island.html?shot&kit=0&quality=low'); await pg.wait_for_function('window.ISLAND', timeout=240000)
    r = await pg.evaluate("""(async()=>{ const THREE = await import('three'), UV = await import('./js/upgradeVisuals.js'); const out = {};
      for (const [nm, lv] of [['max_all_VIII', {hull:7, armor:7, sails:7, rudder:7, cannons:7, reload:7, range:7}], ['base', {}]]) for (const pvp of [false, true]) {
        const s = UV.compileShip(lv, { quality: 'low', pvp, flagMap: new THREE.Texture(), mainSailMap: null }); s.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(s), sz = bb.getSize(new THREE.Vector3());
        out[nm + (pvp ? '_pvp' : '')] = { min: bb.min.toArray().map(v=>+v.toFixed(2)), max: bb.max.toArray().map(v=>+v.toFixed(2)), x: +sz.x.toFixed(2), y: +sz.y.toFixed(2), z: +sz.z.toFixed(2), ud: { len: +(s.userData.len||0).toFixed(2), beam: +(s.userData.beam||0).toFixed(2), scale: s.scale.x } }; }
      return out; })()""")
    print(json.dumps(r, indent=1)); await b.close()
asyncio.run(main())
