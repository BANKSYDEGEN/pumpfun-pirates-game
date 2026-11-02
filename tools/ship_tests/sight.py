# captain's sight line: rays from the captain anchor's eye (chibi 1.85 m, eye 1.48 m over the feet) to the bow, for each level/skin.
# Blockers = any solid ship mesh (masts, yards, sails, lanterns, rails...) except rope lines, ratline nets, crew, outlines, water lid.
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
tree, out = sys.argv[1], sys.argv[2]; shots = sys.argv[3] if len(sys.argv) > 3 else None
CFGS=[{'levels': {}}, {'levels': {'cannons': 8}}, {'levels': {'hull': 3}}, {'levels': {'hull': 6, 'armor': 6, 'cannons': 8, 'sails': 6, 'range': 6, 'rudder': 6, 'reload': 6}}, {'levels': {'sails': 6}}]
JS = """(cfg) => { V.show(cfg); const T = V.THREE, ship = V.ship, ud = ship.userData; ship.updateMatrixWorld(true);
  const a = ud.anchors.find(a => a.role === 'captain'); const eye = a.pos.clone().add(new T.Vector3(0, 1.48, 0.15)); ud.body.localToWorld(eye);
  const L = ud.layout, zb = L.zAt(1), targets = [];
  const ry = (t) => ud.art ? ud.art.railY(t) : L.shape.top(t) + 0.62;
  for (const [x, y, z] of [[-0.25, ry(0.985) + 0.5, L.zAt(0.985)], [-0.9, ry(0.95) + 0.35, L.zAt(0.95)], [-0.5, ry(0.985) + 0.4, L.zAt(0.985)], [-1.5, ry(0.985) + 0.2, zb + 3]]) targets.push(ud.body.localToWorld(new T.Vector3(x, y, z)));
  const solids = []; ship.traverse(o => { if (!o.isMesh || !o.visible) return; let p = o, vis = true; while (p) { if (p.visible === false) vis = false; p = p.parent; } if (!vis) return;
    const m = o.material; if (o.userData.waterMask || o.userData.crewMesh || o.userData.outline || m?.name === 'kit-ratlines' || m?.isLineBasicMaterial || (m?.side === T.BackSide && m?.isMeshBasicMaterial)) return; solids.push(o); });
  const rc = new T.Raycaster(); const res = [];
  for (const tg of targets) { const d = tg.clone().sub(eye), far = d.length(); d.normalize(); rc.set(eye, d); rc.far = far;
    const hits = rc.intersectObjects(solids, false).filter(h => h.distance > 0.35);
    res.push({ target: tg.toArray().map(v => +v.toFixed(2)), blocked: hits.length > 0, by: [...new Set(hits.map(h => (h.object.material.name || h.object.material.type) + (h.object.parent?.name ? '@' + h.object.parent.name : '')))].slice(0, 5), firstHit: hits[0] ? ud.body.worldToLocal(hits[0].point.clone()).toArray().map(v => +v.toFixed(2)) : null, dist: +far.toFixed(2) }); }
  return { eye: eye.toArray().map(v => +v.toFixed(2)), rays: res, eyeLocal: a.pos.toArray().map(v => +v.toFixed(2)) }; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        R = {}
        for qual in ('high', 'low'):
            pg = await b.new_page(viewport={'width': 1200, 'height': 700})
            await pg.goto(f'http://127.0.0.1:18952/{tree}/tools/ship_viewer.html?quality={qual}', timeout=120000)
            await pg.wait_for_function('window.V_READY', timeout=120000)
            for c in CFGS:
                k = qual + ' ' + json.dumps(c['levels']); r = await pg.evaluate(JS, c); R[k] = r
                print(k, 'BLOCKED' if any(x['blocked'] for x in r['rays']) else 'clear', [(x['by'], x['firstHit']) for x in r['rays'] if x['blocked']], r['eyeLocal'], flush=True)
                if shots and qual == 'high':
                    await pg.evaluate("""() => { const T = V.THREE, ud = V.ship.userData, a = ud.anchors.find(a => a.role === 'captain'); const e = ud.body.localToWorld(a.pos.clone().add(new T.Vector3(0, 1.48, 0.15)));
                      const t = ud.body.localToWorld(new T.Vector3(0, ud.layout.bowY + 0.6, ud.layout.zAt(1) + 2)); const o = V.ship.position; V.cam([e.x - o.x, e.y - o.y, e.z - o.z], [t.x - o.x, t.y - o.y, t.z - o.z], 75); window.V_HOLD = true; for (let i = 0; i < 4; i++) V.step(); }""")
                    await pg.screenshot(path=f"{shots}_{len([x for x in R if x.startswith('high')])}.png")
            await pg.close()
        json.dump(R, open(out, 'w'), indent=1)
asyncio.run(main())
