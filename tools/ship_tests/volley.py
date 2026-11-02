# [Raul] PUMPFUN PIRATES volley test: every deck muzzle (port / star broadside) sits at the tip of a real barrel on the
# CURRENT layout (no ball spawns from an old / moved gun); a volley = the gameplay gun count (fireGuns) of them, spread over the
# whole deck row incl. the extra barrels (js/upgrades.js gunList); no bow / stern guns. Then renders balls leaving the barrels.
#   python3 volley.py <tree> <outdir> [port]
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
tree, outdir = sys.argv[1], sys.argv[2]; port = sys.argv[3] if len(sys.argv) > 3 else '18977'
G = {"hull": 6, "cannons": 6, "sails": 4, "reload": 3, "armor": 2, "rudder": 3, "range": 2}
MAX = {"cannons": 8, "hull": 6, "armor": 6, "sails": 6, "range": 6, "rudder": 6, "reload": 6}
CFGS = [('galleon', {"levels": G, "skin": "coral"}), ('max', {"levels": MAX, "skin": "golden", "pvp": True})]
for pvp in (False, True):
    for h in (0, 2, 4, 6):
        for c in range(9): CFGS.append((f"{'BR' if pvp else 'Waves'} h{h} c{c}", {"levels": {"hull": h, "cannons": c, "reload": min(c, 6)}, "skin": "classic", "pvp": pvp}))
CHECK = r'''(cfg) => { V.show(cfg); const s = V.ship, T = V.THREE; s.updateMatrixWorld(true); const pts = [];
  s.traverse(o => { if (!o.isMesh || !/iron/.test(o.material?.name || '') && o.material?.userData?.kitRole !== 'iron') return; let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) vis = false; if (!vis) return;
    const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i++) pts.push(new T.Vector3().fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld)); });
  const u = s.userData, near = (w, r) => pts.some(p => p.distanceTo(w) < r), q = s.getWorldQuaternion(new T.Quaternion()), res = [];
  for (const [side, dir] of [['port', [1, 0, 0]], ['star', [-1, 0, 0]]]) for (const m of (u.muzzles[side] || []).slice(0, u.deckGuns || 99)) {
    const w = m.getWorldPosition(new T.Vector3()), d = new T.Vector3(...dir).applyQuaternion(q), inner = w.clone().addScaledVector(d, -0.6);
    let gap = 1e9; for (const p of pts) gap = Math.min(gap, p.distanceTo(w));
    res.push({ side, at: [w.x, w.y, w.z].map(v => +v.toFixed(2)), gap: +gap.toFixed(2), barrelBehind: near(inner, 0.6) }); }
  const D = u.deckGuns || u.muzzles.port.length, n = u.fireGuns || D, fired = {};
  for (const side of ['port', 'star']) { const L = window.__gunList({ mesh: s, cannons: n }, side); fired[side] = L.map(m => u.muzzles[side].indexOf(m)); }
  const rowOk = ['port', 'star'].every(side => { const f = fired[side]; return f.length === n && new Set(f).size === n && f.every(i => i >= 0 && i < D) && (n < 2 || (f[0] === 0 && f[n - 1] === D - 1)); });
  const slots = (u.gunSlots || []).filter(g => g.sx > 0).length;
  const room = u.room; return { D, n, slots, rowOk, fired: fired.port, noBow: !(u.muzzles.bow || []).length, tips: res.length, bad: res.filter(r => r.gap > 0.35 || !r.barrelBehind), aft: res.filter(r => r.side === 'bow' && false), minZ: Math.min(...res.map(r => r.at[2])), roomZ1: room ? +room.z1.toFixed(2) : null, bow: res.filter(r => r.side === 'bow').map(r => r.at) }; }'''
BALLS = r'''(t) => { const s = V.ship, T = V.THREE; let g = s.parent.getObjectByName('volley'); if (g) g.parent.remove(g); g = new T.Group(); g.name = 'volley'; s.parent.add(g);
  const geo = new T.SphereGeometry(0.32, 12, 8), mat = new T.MeshBasicMaterial({ color: 0x111111 }), fl = new T.MeshBasicMaterial({ color: 0xffb030 }), q = s.getWorldQuaternion(new T.Quaternion()), u = s.userData;
  for (const [side, dir] of [['port', [1, 0, 0]], ['star', [-1, 0, 0]]]) for (const m of window.__gunList({ mesh: s, cannons: u.fireGuns || 0 }, side)) {
    const w = m.getWorldPosition(new T.Vector3()), d = new T.Vector3(...dir).applyQuaternion(q), b = new T.Mesh(geo, mat); b.position.copy(w).addScaledVector(d, 28 * t); b.position.y -= 4.9 * t * t; g.add(b);
    if (t < 0.15) { const f = new T.Mesh(new T.SphereGeometry(0.55, 10, 8), fl); f.position.copy(w).addScaledVector(d, 0.4); g.add(f); } } }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = await b.new_page(viewport={'width': 1024, 'height': 680})
        await pg.goto(f'http://127.0.0.1:{port}/{tree}/tools/ship_viewer.html?quality=high', timeout=120000); await pg.wait_for_function('window.V_READY', timeout=120000)
        assert await pg.evaluate('V.crew') == 'v4', 'viewer fell back to the procedural crew (v4 pirate GLBs not baked)'
        await pg.evaluate("async () => { window.__gunList = (await import(new URL('../js/upgrades.js', location.href).href)).gunList; }")
        fails = 0
        for name, cfg in CFGS:
            r = await pg.evaluate(CHECK, cfg)
            ok = not r['bad'] and r['minZ'] > (r['roomZ1'] or -99) - 0.01 and r['rowOk'] and r['noBow'] and r['D'] == r['slots']
            fails += 0 if ok else 1
            print(('ok   ' if ok else 'FAIL ') + name, {k: r[k] for k in ('D', 'n', 'slots', 'fired', 'rowOk', 'noBow', 'minZ', 'roomZ1')}, r['bad'][:4], flush=True)
        for name, cfg, cam in [('galleon', CFGS[0][1], ([24, 21, -30], [0, 5, -3], 45)), ('galleon_side', CFGS[0][1], ([40, 10, -6], [0, 8, -3], 48)), ('max', CFGS[1][1], ([30, 22, -26], [0, 5, 0], 45))]:
            await pg.evaluate('(c) => { V.show(c); V.step(1/30); }', cfg)
            for t in (0.06, 0.25):
                await pg.evaluate(BALLS, t); await pg.evaluate('(c) => { V.cam(c[0], c[1], c[2]); V.step(0); }', cam)
                await pg.screenshot(path=f'{outdir}/volley_{name}_{int(t * 100):02d}.png')
        print(f'{len(CFGS)} configs, {fails} failing')
asyncio.run(main())
