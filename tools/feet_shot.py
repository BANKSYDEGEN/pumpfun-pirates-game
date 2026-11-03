# close-up of the game's on-foot pirate (js/onfoot/pirate.js loadPirate, read-only use) standing at the game's walk height on the
# plaza cobbles and on the waterfront boardwalk; also reports the figure's sole offset (Box3 min y - root y)
import asyncio, json, sys; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
OUT='/workspace/timothy-plaza/screens/blockout'
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); pg = await (await b.new_context(viewport={'width':1600,'height':900})).new_page()
    await pg.goto('http://127.0.0.1:18960/timothy-plaza/island.html?coast=1&shot&quality=high&plaza=2&light=golden'); await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=240000)
    r = await pg.evaluate("""(async()=>{ const THREE = await import('three'), CO = await import('./js/island/coast.js'), LY = await import('./js/dock/layout.js'), PM = await import('./js/onfoot/pirate.js');
      const I = ISLAND, F = I.foot, L = await LY.coastLayout(), decks = L.decks.map(d => ({ ...d, c: Math.cos(d.yaw), s: Math.sin(d.yaw) }));
      const deckAt = (x, z) => { let y = null; for (const d of decks) { const dx = x - d.x, dz = z - d.z, along = dx * d.s + dz * d.c, across = dx * d.c - dz * d.s; if (Math.abs(along) <= d.hl && Math.abs(across) <= d.hw - 0.35) y = Math.max(y ?? -1e9, d.y); } return y; };
      const ground = (fx, fz) => { const [hx, hz] = L.footToHarbor(fx, fz), d = deckAt(hx, hz), g = F.groundAt(fx, fz); return d !== null ? Math.max(d, g) : g; };
      const out = []; const spots = [[-6, -1.2, 'street, 1.2 m from the boardwalk'], [-5, 1.0, 'boardwalk'], [-3, 3.6, 'boardwalk'], [-8, -3.5, 'cobbles']];
      for (const [lx, lz, nm] of spots) { const pr = PM.loadPirate({ look: { skin: 1, hair: 2 } }), [x, z] = CO.t2w(lx, lz), y = ground(x, z); pr.object.position.set(x, y, z); pr.object.rotation.y = CO.t2wYaw(-0.6); I.scene.add(pr.object); out.push({ nm, lx, lz, y: +y.toFixed(3), pr }); }
      await new Promise(r => setTimeout(r, 6000));
      const res = out.map(o => { o.pr.object.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(o.pr.object); return { nm: o.nm, walkY: o.y, soleOffset: +(bb.min.y - o.y).toFixed(3) }; });
      const [cx, cz] = CO.t2w(0.5, -5.5), [tx, tz] = CO.t2w(-5.5, 0.4); I.camera.fov = 40; I.camera.updateProjectionMatrix(); I.camera.position.set(cx, 3.9, cz); if (I.controls) { I.controls.target.set(tx, 3.1, tz); I.controls.update(); } else I.camera.lookAt(tx, 3.1, tz);
      return res; })()""")
    await pg.wait_for_timeout(2500); await pg.screenshot(timeout=120000, path=f'{OUT}/desktop_feet_v2.png'); print(json.dumps(r)); await b.close()
asyncio.run(main())
