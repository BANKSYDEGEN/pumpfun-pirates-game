# crew anchors at the new chibi scale: Raul's pirate GLB (read-only, 1.37 units x 1.35 = 1.85 m) dropped on every anchor of the ship
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
tree, out, cfg = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]); views = json.loads(sys.argv[4])
JS = """async (cfg) => { V.show(cfg); const T = V.THREE, ud = V.ship.userData;
  const SU = await import('three/addons/utils/SkeletonUtils.js'); const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
  const dl = new DRACOLoader(); dl.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/'); const gl = new GLTFLoader(); gl.setDRACOLoader(dl);
  const [m, f] = await Promise.all(['chibi/pirate_male_lo.glb', 'chibi/pirate_female_lo.glb'].map(u => gl.loadAsync('../' + u).then(g => g.scene)));
  const bb = new T.Box3().setFromObject(m), hh = bb.max.y - bb.min.y, k = 1.85 / hh;
  V.ship.traverse(o => { if (o.isLOD && o.children[0]?.userData?.crewMesh) o.visible = false; });
  const sil = new T.MeshBasicMaterial({ color: 0xfa0d0d }); const counts = {}; ud.anchors.forEach((a, i) => { const g = SU.clone(i % 2 ? f : m); g.scale.multiplyScalar(k); if (cfg.sil) g.traverse(o => { if (o.isMesh) o.material = sil; }); g.position.copy(a.pos); g.rotation.y = a.facing; ud.body.add(g); counts[a.role] = (counts[a.role] || 0) + 1; });
  return { srcHeight: hh, counts, anchors: ud.anchors.map(a => ({ role: a.role, index: a.index, side: a.side, pos: a.pos.toArray().map(v => +v.toFixed(2)), facing: +a.facing.toFixed(3) })) }; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = await b.new_page(viewport={'width': 1400, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:18952/{tree}/tools/ship_viewer.html?quality=high', timeout=120000)
        await pg.wait_for_function('window.V_READY', timeout=120000)
        r = await pg.evaluate(JS, cfg)
        for i, (yaw, pitch, dist) in enumerate(views):
            await pg.evaluate(f'()=>{{V.frame({yaw},{pitch},{dist}); for(let i=0;i<6;i++) V.step();}}')
            await pg.screenshot(path=f'{out}_{i}.png')
        print(r['srcHeight'], json.dumps(r['counts']), errs[:3]); json.dump(r, open(out + '.json', 'w'), indent=0)
asyncio.run(main())
