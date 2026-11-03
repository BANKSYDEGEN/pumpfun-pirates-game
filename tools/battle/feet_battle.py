# PUMPFUN PIRATES battle areas feet test (MUSKET RANGE pad, SWORD PIT pad, the 2 paths, the SWORD SHOP + MUSKET SHOP doors): walk height (js/dock/world.js ground() = max(layout deck, foot.groundAt)) vs a downward
# raycast against the drawn surfaces (terrain chunks at their finest LOD + the merged coast kit), on a 1 m grid over the range pad,
# the pit pad, the paths and the 2 weapon shop doors. + = floating, - = sunk (m). usage: python3 feet_battery.py "plaza=2" (or "" for the default plaza)
import asyncio, json, sys, os; from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
Q = sys.argv[1] if len(sys.argv) > 1 else ''; WT = os.environ.get('WT', 'emerly-battle')
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); pg = await (await b.new_context(viewport={'width':800,'height':450})).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(f'http://127.0.0.1:18960/{WT}/island.html?coast=1&shot&quality=high&{Q}'); await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=240000)
    r = await pg.evaluate("""(async()=>{ const THREE = await import('three'), CO = await import('./js/island/coast.js'), LY = await import('./js/dock/layout.js'), BA = await import('./js/island/battleAreas.js');
      const I = ISLAND, F = I.foot, L = await LY.coastLayout(), decks = L.decks.map(d => ({ ...d, c: Math.cos(d.yaw), s: Math.sin(d.yaw) }));
      const deckAt = (x, z) => { let y = null; for (const d of decks) { const dx = x - d.x, dz = z - d.z, along = dx * d.s + dz * d.c, across = dx * d.c - dz * d.s; if (Math.abs(along) <= d.hl && Math.abs(across) <= d.hw - 0.35) y = Math.max(y ?? -1e9, d.y); } return y; };
      const ground = (fx, fz) => { const [hx, hz] = L.footToHarbor(fx, fz), d = deckAt(hx, hz), g = F.groundAt(fx, fz); return d !== null ? Math.max(d, g) : g; };
      const targets = []; F.root.traverse(o => { if (!o.isMesh || o.isInstancedMesh) return; const m = o.material; if (Array.isArray(m) || m.side === THREE.BackSide || m.transparent || o.userData.outline || o.userData.bucket === 'glow' || /sea|water|shallow|fresh|fall|mist|grass|sign|bird|crab|flame|net|outline|nature|pirate/i.test(o.name)) return; if (/^chunk_/.test(o.name) || /coast|townkit/.test(o.name)) targets.push(o); });
      const pts = [], R = BA.RANGE, P = BA.PIT;
      for (let lx = R.lx0 + 1; lx <= R.lx1 - 1; lx += 1) for (let lz = R.lz0 + 1; lz <= R.lz1 - 1; lz += 1) pts.push([lx, lz, 'range pad']);
      for (let lx = P.lx - 15; lx <= P.lx + 15; lx += 1) for (let lz = P.lz - 15; lz <= P.lz + 15; lz += 1) { const r = Math.hypot(lx - P.lx, lz - P.lz); if (r < P.r - 0.5) pts.push([lx, lz, 'pit floor']); else if (r > P.r + 0.8 && r < P.pad - 0.5) pts.push([lx, lz, 'pit ring']); }
      BA.PATHS.forEach((pl, i) => { for (let k = 0; k < pl.length - 1; k++) { const [a, b] = [pl[k], pl[k + 1]], m = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let j = 0; j <= m; j++) pts.push([a[0] + (b[0] - a[0]) * j / m, a[1] + (b[1] - a[1]) * j / m, 'path ' + (i ? 'pit' : 'range')]); } });
      for (const r of BA.MAIN_ST_SHOPS) { const s = Math.sin(r.yaw), c = Math.cos(r.yaw), dl = r.lx + c * r.door[0] + s * r.door[1], dz = r.lz - s * r.door[0] + c * r.door[1];
        for (let k = 0; k < 9; k++) { const f = (Math.floor(k / 3) - 1) * 0.6, q = (k % 3 - 1) * 0.6; pts.push([dl + s * f + c * q, dz + c * f - s * q, r.id + ' door']); } }
      const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), by = {}, bad = []; let miss = 0, n = 0, prop = 0;
      for (const [cx, cz] of [[-104, -144], [-80, -100], [-40, -60], [60, -86], [30, -55], [6, -134]]) { const [x, z] = CO.t2w(cx, cz); I.camera.position.set(x, 60, z); I.camera.lookAt(x, 0, z); await new Promise(r => setTimeout(r, 1500));
        for (const [lx, lz, zone] of pts) { if (Math.hypot(lx - cx, lz - cz) > 34 || pts.done?.has(lx + ',' + lz)) continue; (pts.done ||= new Set()).add(lx + ',' + lz);
          const [fx, fz] = CO.t2w(lx, lz); if (F.whyBlocked(fx, fz) === 'prop') { prop++; continue; } const y = ground(fx, fz); rc.set(new THREE.Vector3(fx, y + 1.2, fz), down); rc.far = 4;
          const h = rc.intersectObjects(targets, false)[0]; if (!h) { miss++; continue; } n++; const dl = y - h.point.y;
          const s = by[zone] ||= { n: 0, maxSunk: 0, maxFloat: 0 }; s.n++; s.maxSunk = Math.min(s.maxSunk, +dl.toFixed(3)); s.maxFloat = Math.max(s.maxFloat, +dl.toFixed(3));
          if (dl < -0.01 || dl > 0.01) bad.push([lx, lz, zone, +dl.toFixed(3), h.object.name]); } }
      return { points: n, miss, standOnProp: prop, by, bad: bad.length, worst: bad.sort((a, b) => Math.abs(b[3]) - Math.abs(a[3])).slice(0, 12) }; })()""")
    r['errors'] = errs[:5]; r['query'] = Q or '(default)'; print(json.dumps(r, indent=1)); await b.close()
asyncio.run(main())
