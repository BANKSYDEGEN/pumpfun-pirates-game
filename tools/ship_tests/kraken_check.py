# KRAKEN anti-clip check: samples the tentacle sway (CPU twin of the shader, max amplitude) over many phases, on every
# hull length / level, high + low, and checks (1) the displaced flesh never intersects any ship surface (hull, upper works,
# rails, cannons, lids, masts, channels) nor any sail (three-mesh-bvh triangle test), (2) every flesh sample sphere stays
# outside the hull footprint prism (|x| - r > halfW(t) * 1.04 + 0.12, keel to sky), >= 0.3 m from every crew anchor capsule
# (1.85 m chibi) and >= 0.25 m from the sails. Usage: kraken_check.py tree out.json
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
tree, out = sys.argv[1], sys.argv[2]
LVLS = [{'cannons': c} for c in (0, 2, 4, 6, 8)] + [{'hull': 3, 'cannons': 4}, {'hull': 6}, {'hull': 6, 'armor': 6, 'cannons': 8, 'sails': 6, 'range': 6, 'rudder': 6, 'reload': 6}]
JS = """async ({ levels, quality, N }) => {
  const T = V.THREE, BV = await import('https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.7.6/build/index.module.js');
  const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
  const { krakenSway } = await import(location.pathname.replace(/tools\\/ship_viewer.html$/, '') + 'assets/ships/pvp/kraken.js');
  V.show({ levels, skin: 'kraken', pvp: true, quality }); const s = V.ship, ud = s.userData; s.updateMatrixWorld(true);
  const vis = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const sailSet = new Set(); (ud.sails || []).forEach(g => g.traverse(o => o.isMesh && sailSet.add(o)));
  const obs = [], sails = [], names = []; let flesh = null;
  s.traverse(o => { if (!o.isMesh || !vis(o)) return; if (o.userData.kraken) { if (o.geometry.attributes.sway && !flesh) flesh = o; return; }
    const m = o.material; if (o.userData.outline || o.userData.waterMask || o.userData.crewMesh || m.transparent || m.name === 'kit-ratlines' || m.isShaderMaterial || o.isInstancedMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    g.applyMatrix4(o.matrixWorld); (sailSet.has(o) ? sails : obs).push(g); if (!sailSet.has(o)) names.push([o.parent?.name || '', m.name || m.type, g]); });
  const ob = new BV.MeshBVH(mergeGeometries(obs)), sb = new BV.MeshBVH(mergeGeometries(sails));
  const M = flesh.matrixWorld, L = flesh.parent, P0 = flesh.geometry.attributes.position, SW = flesh.geometry.attributes.sway, n = P0.count;
  const lay = ud.layout, tOf = (z) => { let a = -0.2, b = 1.2; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (lay.zAt(m) < z) a = m; else b = m; } return (a + b) / 2; };
  const caps = (ud.anchors || []).map(a => a.pos.clone()); // body (pre-lift) frame = flesh frame
  const probe = ud.krakenProbe || []; const res = { verts: n, probes: probe.length, phases: N, hitHull: 0, hitSail: 0, footprint: 0, crew: 0, sailNear: 0, minFoot: 99, minCrew: 99, minSail: 99, worst: null };
  const geo = new T.BufferGeometry(), arr = new Float32Array(n * 3); geo.setAttribute('position', new T.BufferAttribute(arr, 3)); geo.setIndex([...Array(n).keys()]);
  const v = new T.Vector3(), ident = new T.Matrix4(), tgt = {};
  for (let k = 0; k < N; k++) {
    const t = k * 1.37, ph = (k * 0.61) % 6.283, amp = 1.6;
    for (let i = 0; i < n; i++) { const x = P0.getX(i), d = krakenSway(SW.getX(i), Math.sign(x), t, ph, amp); v.set(x + d[0], P0.getY(i) + d[1], P0.getZ(i) + d[2]).applyMatrix4(M); arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; }
    geo.attributes.position.needsUpdate = true; geo.computeBoundingBox(); geo.boundsTree = new BV.MeshBVH(geo);
    if (ob.intersectsGeometry(geo, ident)) { res.hitHull++; if (!res.worst) { const who = []; for (const [pn, mn, g] of names) { g.boundsTree = g.boundsTree || new BV.MeshBVH(g); if (geo.boundsTree.intersectsGeometry(g, ident)) who.push(pn + '/' + mn); } const ids = {}; for (let i = 0; i < n; i += 3) { v.fromArray(arr, i * 3); const c = ob.closestPointToPoint(v, tgt); if (c && c.distance < 0.06) { const id = Math.floor(SW.getX(i) * 0.5); ids[id] = (ids[id] || 0) + 1; if (!res.at) res.at = [v.x, v.y, v.z].map(q => +q.toFixed(2)); } } res.worst = { k, what: who, ids }; } } if (sb.intersectsGeometry(geo, ident)) res.hitSail++;
    for (const [x, y, z, r, sw] of probe) {
      const d = krakenSway(sw, Math.sign(x), t, ph, amp), px = x + d[0], py = y + d[1], pz = z + d[2];
      const tt = tOf(pz); if (tt > 0.002 && tt < 0.998) { const f = Math.abs(px) - r - (lay.shape.halfW(tt) * 1.04 + 0.12); res.minFoot = Math.min(res.minFoot, f); if (f < 0) { res.footprint++; res.worst = res.worst || { k, x: px, y: py, z: pz, r, f }; } }
      for (const c of caps) { const yy = Math.min(Math.max(py, c.y), c.y + 1.85), dd = Math.hypot(px - c.x, py - yy, pz - c.z) - r - 0.3; res.minCrew = Math.min(res.minCrew, dd); if (dd < 0) res.crew++; }
      v.set(px, py, pz).applyMatrix4(L.matrixWorld); const cp = sb.closestPointToPoint(v, tgt); if (cp) { const dd = cp.distance - r; res.minSail = Math.min(res.minSail, dd); if (dd < 0.25) res.sailNear++; }
    }
  }
  for (const k of ['minFoot', 'minCrew', 'minSail']) res[k] = +res[k].toFixed(3);
  res.ok = !res.hitHull && !res.hitSail && !res.footprint && !res.crew && !res.sailNear; return res; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS); R = {}; errs = []
        for q in ('high', 'low'):
            pg = await b.new_page(viewport={'width': 900, 'height': 640}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(f'http://127.0.0.1:18952/{tree}/tools/ship_viewer.html?quality={q}', timeout=120000); await pg.wait_for_function('window.V_READY', timeout=120000)
            for lv in LVLS:
                r = await pg.evaluate(JS, {'levels': lv, 'quality': q, 'N': int(__import__('os').environ.get('KC_N', '48'))}); k = q + ' ' + json.dumps(lv); R[k] = r
                print(k, 'OK' if r['ok'] else 'FAIL', {x: r[x] for x in ('hitHull', 'hitSail', 'footprint', 'crew', 'sailNear', 'minFoot', 'minCrew', 'minSail')}, r['worst'] or '', flush=True)
            R['__errors_' + q] = errs[:5]; await pg.close()
        R['__all_ok'] = all(v['ok'] for k, v in R.items() if not k.startswith('__')); json.dump(R, open(out, 'w'), indent=1); print('ALL OK' if R['__all_ok'] else 'SOME FAIL', errs[:3])
asyncio.run(main())
