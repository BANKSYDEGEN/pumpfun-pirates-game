# PUMPFUN PIRATES plaza v2 feet test: walk height (the game's js/dock/world.js ground() = max(layout deck, foot.groundAt)) vs a
# downward raycast against the visible surface meshes (terrain chunks + the merged coast / street kit + town-kit meshes), on a
# grid over the plaza street, the boardwalk and all 5 jetties. + = floating, - = sunk (metres).
import asyncio, json, sys, os; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
Q = sys.argv[1] if len(sys.argv) > 1 else 'plaza=2'
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); pg = await (await b.new_context(viewport={'width':800,'height':450})).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(f'http://127.0.0.1:18960/{os.environ.get('PFP_PATH', 'timothy-plaza')}/island.html?coast=1&shot&quality=high&{Q}'); await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=240000)
    r = await pg.evaluate("""(async()=>{ const THREE = await import('three'), CO = await import('./js/island/coast.js'), LY = await import('./js/dock/layout.js'), PV = await import('./js/island/plazaTown.js');
      const I = ISLAND, F = I.foot, L = await LY.coastLayout();
      // put the camera over the plaza so every chunk there is at its finest LOD, then let streaming settle
      const [cx, cz] = CO.t2w(-30, 0); I.camera.position.set(cx, 40, cz); I.camera.lookAt(cx, 0, cz); await new Promise(r => setTimeout(r, 2500));
      const decks = L.decks.map(d => ({ ...d, c: Math.cos(d.yaw), s: Math.sin(d.yaw) }));
      const deckAt = (x, z) => { let y = null; for (const d of decks) { const dx = x - d.x, dz = z - d.z, along = dx * d.s + dz * d.c, across = dx * d.c - dz * d.s;
        if (Math.abs(along) <= d.hl && Math.abs(across) <= d.hw - 0.35) y = Math.max(y ?? -1e9, d.y); } return y; };
      const ground = (fx, fz) => { const [hx, hz] = L.footToHarbor(fx, fz), d = deckAt(hx, hz), g = F.groundAt(fx, fz); return d !== null ? Math.max(d, g) : g; };
      const targets = []; F.root.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !o.visible && !/^chunk_/.test(o.name)) return; const m = o.material;
        if (Array.isArray(m) || m.side === THREE.BackSide || m.transparent || o.userData.outline || o.userData.bucket === 'glow' || /sea|water|shallow|fresh|fall|mist|grass|sign|bird|crab|flame|net|outline|nature|pirate/i.test(o.name)) return;
        if (/^chunk_/.test(o.name) && !o.visible) return; targets.push(o); });
      const names = [...new Set(targets.map(o => o.name.replace(/_\\d+.*$/, '')))];
      const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), pts = [];
      const digs = (F.digs || []).map(d => [d.x, d.z]);
      const add = (lx, lz, zone) => { const [fx, fz] = CO.t2w(lx, lz), why = F.whyBlocked(fx, fz), [hx, hz] = L.footToHarbor(fx, fz), onDeck = deckAt(hx, hz) !== null;
        if (why === 'prop' || (why && !onDeck)) return; if (digs.some(([x, z]) => Math.hypot(fx - x, fz - z) < 4)) zone = 'dig mound (interactive prop)';
        else if (lx < PV.BOARDWALK.lxS && lz < -14 && lz < 0) zone = 'beach outside plaza'; pts.push([lx, lz, zone, fx, fz]); };
      for (let lx = -174; lx <= 98; lx += 1.5) for (let lz = -28.5; lz <= 7.8; lz += 1.5) add(lx, lz, lz >= 0 ? 'boardwalk' : lx < PV.BOARDWALK.lxS ? 'shore strip' : 'street/quay');
      for (let lx = -0.5; lx <= 12.5; lx += 1.5) for (let lz = -60; lz < -28.5; lz += 1.5) add(lx, lz, 'main street mouth');
      for (const j of PV.JETTIES) for (let lz = 8.2; lz <= 58.5; lz += 2) for (const dx of [-5.5, -3, 0, 3, 5.5]) add(j.lx + dx, lz, 'jetty');
      const res = [], by = {}; let miss = 0; pts.sort((a, b) => a[0] - b[0]);
      // batches of 40 m along the waterfront: the camera sits over each batch first, so its terrain chunks are at the finest LOD
      for (let b0 = -180; b0 < 110; b0 += 40) { const batch = pts.filter(q => q[0] >= b0 && q[0] < b0 + 40); if (!batch.length) continue;
        const [cx, cz] = CO.t2w(b0 + 20, -10); I.camera.position.set(cx, 25, cz); I.camera.lookAt(cx, 0, cz); await new Promise(r => setTimeout(r, 1200));
        for (const [lx, lz, zone, fx, fz] of batch) { const y = ground(fx, fz); rc.set(new THREE.Vector3(fx, y + 1.2, fz), down); rc.far = 4; const h = rc.intersectObjects(targets, false)[0];
          if (!h) { miss++; continue; } const dlt = y - h.point.y; let col = null;
          if (Math.abs(dlt) > 0.3 && h.object.geometry.attributes.color) { const C = h.object.geometry.attributes.color; col = '#' + new THREE.Color(C.getX(h.face.a), C.getY(h.face.a), C.getZ(h.face.a)).getHexString(); }
          res.push([lx, lz, zone, +dlt.toFixed(3), h.object.name, +y.toFixed(3), +h.point.y.toFixed(3), col]);
          const z = by[zone] ||= { n: 0, maxSunk: 0, maxFloat: 0, sunkAt: null, floatAt: null }; z.n++;
          if (dlt < z.maxSunk) { z.maxSunk = +dlt.toFixed(3); z.sunkAt = [lx, lz, h.object.name]; } if (dlt > z.maxFloat) { z.maxFloat = +dlt.toFixed(3); z.floatAt = [lx, lz, h.object.name]; } } }
      const bad = res.filter(r => (r[3] < -0.02 || r[3] > 0.03) && !/dig|outside/.test(r[2]));
      return { points: res.length, miss, by, bad: bad.length, worst: bad.sort((a, b) => Math.abs(b[3]) - Math.abs(a[3])).slice(0, 25), targets: names }; })()""")
    r['errors'] = errs[:5]; print(json.dumps(r, indent=1)); await b.close()
asyncio.run(main())
