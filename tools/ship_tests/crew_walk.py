# [Raul] crew-walk + gun-room test: python3 crew_walk.py <tree> [port]  (serve the parent dir of <tree>)
# Every build (all hull levels x guns x Waves / Battle Royale x skins, + enemy / boss hulls): simulates each deck walker's
# shader path (js/crew.js) for 1800 frames (60 s) and checks it never enters the stern room / cabin, never leaves the deck
# (bulwark), never overlaps a mast / gun / gunner / deck part (ship.userData.deckObs), keeps 0.5 m from the other walkers,
# and its feet stay on the deck sheer. Also: no gunner, gun or muzzle in the room. Exit 1 on any failure.
import asyncio, json, sys
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
JS = r'''async () => {
  const S = await import('./js/ships.js'); const T = V.THREE, out = [];
  const fract = (x) => x - Math.floor(x);
  function check(name, ship) {
    const u = ship.userData, L = u.layout, room = u.room, W = u.walkInfo, r = 0.3, fails = [];
    let lod = null; ship.traverse(o => { if (!lod && o.isLOD && o.children[0]?.userData?.crewMesh) lod = o; });
    const seats = lod?.userData.seats || [], walkers = seats.filter(c => c.info[0] === 1 && c.info[3] >= 0), gunners = seats.filter(c => c.info[0] === 0);
    const deckY = (z) => L.shape.top(L.zAt ? tOf(z) : 0.5) - L.deckDrop;
    const ZM = S.zMap(u.baseLen / (u.shipScale ? ship.scale.x : 1), L.stretch); // design length (pre whole-ship scale)
    function tOf(z) { return ZM.t(z); }
    const inRoom = (x, z) => z < room.z1 + r && (room.w == null || Math.abs(x) < room.w + r);
    for (const g of gunners) if (inRoom(g.o[0], g.o[2])) fails.push(`gunner in room z ${g.o[2].toFixed(2)} (room to ${room.z1.toFixed(2)})`);
    for (const side of ['port', 'star']) for (const m of u.muzzles[side]) { const p = m.position; if (p.z < room.z1 && Math.abs(p.y - (room.y0 + room.y1) / 2) < (room.y1 - room.y0)) fails.push(`muzzle in room z ${p.z.toFixed(2)}`); }
    // [Raul] cannons: every iron (barrel / axle / tyre) vertex in body space + each deck gun's footprint box (carriage + barrel)
    ship.updateMatrixWorld(true); const inv = (lod?.parent || u.body).matrixWorld.clone().invert(), // crew space (PvP skins lift + enlarge it)
      IV = [], v3 = new T.Vector3();
    ship.traverse(o => { if (!o.isMesh || o.userData.outline) return; const n = o.material?.name || ''; if (!/iron/.test(n)) return;
      let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) vis = false; if (!vis) return;
      const P = o.geometry.attributes.position, M4 = inv.clone().multiply(o.matrixWorld); for (let i = 0; i < P.count; i++) { v3.fromBufferAttribute(P, i).applyMatrix4(M4); IV.push([v3.x, v3.y, v3.z]); } });
    const GB = (u.gunSlots || []).map(g => { const a = g.inner, b = g.x + g.sx * 0.6; return [Math.min(a, b), Math.max(a, b), g.z - g.r, g.z + g.r]; });
    const CR = 0.26, hitsGun = (x, z0, z1, y) => { for (const b of GB) if (x > b[0] - CR && x < b[1] + CR && z1 > b[2] - CR && z0 < b[3] + CR) return 'gun footprint';
      for (const p of IV) if (Math.abs(p[0] - x) < CR && p[2] > z0 - CR && p[2] < z1 + CR && p[1] > y + 0.1 && p[1] < y + 1.5) return `barrel/iron vertex (${p.map(v => v.toFixed(2))})`; return null; };
    const mastZ = L.mastDefs.filter(([tf]) => !(u.art && tf < u.art.tB)).map(([tf]) => L.zAt(tf));
    for (const g of gunners) { const h = hitsGun(g.o[0], g.o[2], g.o[2], g.o[1]); if (h) fails.push(`gunner ${g.info[3]}/${g.info[1]} in ${h}`);
      for (const mz of mastZ) if (Math.abs(g.o[0]) < 0.53 + CR && Math.abs(g.o[2] - mz) < 0.53 + CR) fails.push('gunner in mast footing'); }
    for (let i = 0; i < gunners.length; i++) for (let j = i + 1; j < gunners.length; j++) if (Math.hypot(gunners[i].o[0] - gunners[j].o[0], gunners[i].o[2] - gunners[j].o[2]) < 0.55) fails.push('gunners overlap');
    for (const c of walkers) { const sp = Math.max(0, c.info[3]), h = hitsGun(c.o[0], c.o[2] - sp / 2, c.o[2] + sp / 2, c.o[1] - 0.6); if (h) fails.push(`walker lane x ${c.o[0]} in ${h}`); }
    for (const a of (u.anchors || []).filter(a => a.role === 'deck')) { const h = hitsGun(a.pos.x, a.pos.z, a.pos.z, a.pos.y); if (h) fails.push(`deck spot ${a.index} in ${h}`); }
    const zS = L.zAt(0); let aft = 0; for (const p of IV) if (p[1] > 0.6 && Math.abs(p[0]) > 0.22) aft = Math.max(aft, zS - p[2]); // [Raul] BANKSY: no cannon sticks out of the stern (rudder pintles |x| < 0.2; lamp brackets / transom plates stick out < 0.6 m)
    u._aft = +aft.toFixed(2); if (aft > 0.9) fails.push(`iron sticks out ${aft.toFixed(2)} m behind the transom (a stern gun?)`);
    for (const m of [...u.muzzles.port, ...u.muzzles.star, ...(u.muzzles.bow || [])]) if (m.position.z < zS + 0.5) fails.push('a muzzle at the stern'); // (stern lamp brackets / rudder iron are fine)
    if (u.crewBad?.length) fails.push('placeCrew found no clear spot: ' + u.crewBad.join(','));
    const bow = u.muzzles.bow || [], maxSide = Math.max(-99, ...[...u.muzzles.port, ...u.muzzles.star].map(m => m.position.z));
    const bowInfo = bow.map(m => m.position.z.toFixed(2)); if (bow.some(m => m.position.z <= maxSide)) fails.push('bow muzzle not forward');
    let maxDy = 0, frames = 0, minSep = 99;

    for (let f = 0; f < 1800; f++) { const uT = f / 30, P = [];
      for (const c of walkers) { const span = c.info[3], ph = c.info[2], s = fract(uT * 0.9 / Math.max(1, span * 2) + ph), tri = Math.abs(s * 2 - 1);
        const x = c.o[0], z = c.o[2] + span * (0.5 - tri); P.push([x, z]);
        if (inRoom(x, z)) fails.push(`walker in room z ${z.toFixed(2)}`);
        if (Math.abs(x) + r > W.half(z) + 1e-6) fails.push(`walker through bulwark x ${x} z ${z.toFixed(2)}`);
        if (z < W.z0 - 1e-6 || z > W.z1 + 1e-6) fails.push(`walker through castle wall z ${z.toFixed(2)}`);
        for (const o of u.deckObs) if (x > o[0] - r && x < o[1] + r && z > o[2] - r && z < o[3] + r) { fails.push(`walker hits [${o.map(v => v.toFixed(2))}] at z ${z.toFixed(2)}`); break; }
        const D = lod.children[0].material.uniforms, A = D.uDk.value, B = D.uDk2.value, t = z < A.y ? 0.25 + (z - A.x) / A.z : 0.72 + (z - A.y) / A.w, q = (t - 0.47) * 2, yS = B.z > 0.5 ? B.x * (0.5 + 0.5 * q * q) - B.y : c.o[1]; maxDy = Math.max(maxDy, Math.abs(yS - deckY(z))); }
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]); minSep = Math.min(minSep, d); if (d < 0.5) fails.push('walkers collide'); }
      frames++; }
    out.push({ name, walkers: walkers.length, lanes: walkers.map(c => [c.o[0], +(c.o[2] - c.info[3] / 2).toFixed(2), +(c.o[2] + c.info[3] / 2).toFixed(2)]), gunners: gunners.length, ironVerts: IV.length, aft: u._aft, bow: bowInfo, frames, minSep: +minSep.toFixed(2), maxFootErr: +maxDy.toFixed(3), fails: [...new Set(fails)].slice(0, 6), nFail: fails.length });
  }
  const PL = [{}, {hull:1,cannons:1}, {hull:2,cannons:3,reload:2}, {hull:3,cannons:4,reload:5,sails:5}, {hull:4,cannons:6,reload:6,sails:6}, {hull:5,cannons:7,reload:4}, {hull:6,cannons:6,sails:4,reload:3,armor:2,rudder:3,range:2}, {hull:6,cannons:8,reload:6,sails:6,armor:6,rudder:6,range:6}];
  for (const pvp of [true, false]) for (const skin of ['classic', 'coral', 'ghost', 'golden', 'diamond', 'flaming', 'commodore']) for (const lv of PL) {
    if (skin !== 'classic' && skin !== 'coral' && Object.keys(lv).length && lv.hull !== 6) continue;
    try { V.show({ levels: lv, skin, pvp }); check(`${pvp ? 'BR' : 'Waves'} ${skin} ${JSON.stringify(lv)}`, V.ship); } catch (e) { out.push({ name: `${skin} ${JSON.stringify(lv)}`, fails: ['build error ' + e], nFail: 1 }); } }
  // every hull x every CANNONS tier (classic), both modes: the added side barrels + longer rows on every combination
  for (const pvp of [true, false]) for (let h = 0; h <= 6; h++) for (let c = 0; c <= 8; c++) { const lv = { hull: h, cannons: c, reload: Math.min(c, 6) };
    try { V.show({ levels: lv, skin: 'classic', pvp }); check(`${pvp ? 'BR' : 'Waves'} sweep ${JSON.stringify(lv)}`, V.ship); } catch (e) { out.push({ name: `sweep ${JSON.stringify(lv)}`, fails: ['build error ' + e], nFail: 1 }); } }
  const en = [['enemy small', { len: 14, beam: 4.7, depth: 2.8, scheme: 'slime', cannonsPerSide: 2, masts: 2 }], ['enemy boss', { len: 19, beam: 6, depth: 2.8, scheme: 'boss', boss: true, cannonsPerSide: 4, masts: 3 }], ['enemy 6 guns', { len: 15.5, beam: 5, depth: 2.8, scheme: 'reef', cannonsPerSide: 6, masts: 2 }]];
  for (const [n, o] of en) { const fm = new T.CanvasTexture(document.createElement('canvas')); const s = S.buildShip({ ...o, flagMap: fm, stretch: S.stretchFor(o.cannonsPerSide, o.len, 1.5), hitLen: o.len, lookout: true }); check(n, s); }
  return out;
}'''
async def main():
    tree = sys.argv[1]; port = sys.argv[2] if len(sys.argv) > 2 else '18977'
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = await b.new_page(viewport={'width': 320, 'height': 240})
        await pg.goto(f'http://127.0.0.1:{port}/{tree}/tools/ship_viewer.html?quality=high', timeout=120000); await pg.wait_for_function('window.V_READY', timeout=120000)
        res = await pg.evaluate(JS)
        bad = 0
        for r in res:
            bad += r['nFail'] > 0
            print(('FAIL ' if r['nFail'] else 'ok   ') + r['name'], {k: r.get(k) for k in ('walkers', 'gunners', 'ironVerts', 'aft', 'bow', 'minSep', 'maxFootErr', 'lanes')}, r['fails'] if r['nFail'] else '')
        print(f'{len(res)} builds, {bad} failing'); json.dump(res, open(f'/tmp/crew_walk_{tree.replace("/", "_")}.json', 'w'), indent=1)
        sys.exit(1 if bad else 0)
asyncio.run(main())
