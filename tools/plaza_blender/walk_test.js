// [Timothy] plaza collision walk test (runs in island.html via game_shots.py walk|colliders): foot.whyBlocked = the on-foot collider check
(async (mode) => { const THREE = await import('three'), CO = await import('./js/island/coast.js'), PV = await import('./js/island/plazaTown.js'), PS = await import('./js/island/plazaShops.js');
  const F = ISLAND.foot, prop = (lx, lz) => { const [x, z] = CO.t2w(lx, lz); return F.whyBlocked(x, z) === 'prop'; };
  const R = { buildings: [], props: [], paths: [], spots: [] };
  // 1) walk from the street straight at each storefront (5 lanes across its width): must be stopped at the counter / facade line
  for (const s of PV.STOREFRONTS) for (const dx of [-s.w * 0.45, -s.w * 0.25, 0, s.w * 0.25, s.w * 0.45]) { let lz = -22, stop = null;
    while (lz > -42) { if (prop(s.lx + dx, lz)) { stop = lz; break; } lz -= 0.1; }
    R.buildings.push({ shop: s.id, dx: +dx.toFixed(2), stoppedAt: stop === null ? null : +stop.toFixed(2), ok: stop !== null && stop > -30.0 }); }
  // 2) every Blender prop collider: approach from 2.5 m out in 4 directions -> blocked before its centre
  const kit = PS.SHOPS_KIT; if (kit) for (const s of PV.STOREFRONTS) for (const c of (kit.shops[s.id] || {}).colliders || []) { const lx = s.lx + c[1], lz = PV.FACADE_LZ - PV.ROW_D / 2 + c[2];
    for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let d = 2.5, hit = false; while (d > 0) { if (prop(lx + ux * d, lz + uz * d)) { hit = true; break; } d -= 0.1; } R.props.push({ shop: s.id, lx, lz, dir: [ux, uz], ok: hit }); } }
  // 2b) the market props the blockout already collides (lamps, stalls, carts, palms, cargo, tavern tables, billboards): their centres are solid
  const pts = [...PV.LAMPS.map(p => ['lamp', ...p]), ...PV.STALLS.map(s => ['stall', s.lx, s.lz]), ...PV.CARTS.map(p => ['cart', ...p]), ...PV.PALMS.map(p => ['palm', ...p]), ...PV.TAVERN_TABLES.map(p => ['table', ...p]),
    ...Object.entries(PV.TOKEN_SLOTS).map(([k, lx]) => ['billboard ' + k, lx, PV.FACADE_LZ + 0.6])];
  for (const [k, lx, lz] of pts) R.props.push({ shop: k, lx, lz, ok: prop(lx, lz) });
  // 3) main paths that must stay clear
  const line = (name, a, b, step = 0.25) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step); const bad = [];
    for (let i = 0; i <= n; i++) { const lx = a[0] + (b[0] - a[0]) * i / n, lz = a[1] + (b[1] - a[1]) * i / n, [x, z] = CO.t2w(lx, lz), w = F.whyBlocked(x, z); if (w === 'prop' || w === 'edge') bad.push([+lx.toFixed(1), +lz.toFixed(1), w]); }
    R.paths.push({ name, ok: bad.length === 0, blocked: bad.slice(0, 6), n: n + 1 }); };
  line('market street lz -25 (lx -54..60)', [-54, -25], [60, -25]);
  line('boardwalk lz 4 (lx -170..96)', [-170, 4], [96, 4]); line('main street mouth lx 6', [6, -27], [6, -55]);
  for (const j of PV.JETTIES) line('jetty ' + j.id, [j.lx, 9], [j.lx, 58]);
  for (const s of PV.STOREFRONTS) line('counter approach ' + s.name, [s.lx, -22], [s.lx, -26.5]);
  for (const b of PV.BERTHS) { const [x, z] = CO.t2w(b.ashore.lx, b.ashore.lz); R.spots.push({ id: 'ashore ' + b.id, ok: F.whyBlocked(x, z) !== 'prop' }); }
  { const [x, z] = CO.t2w(PV.SPAWN.lx, PV.SPAWN.lz); R.spots.push({ id: 'spawn', ok: F.whyBlocked(x, z) !== 'prop' }); }
  for (const s of PV.STOREFRONTS) { const [x, z] = CO.t2w(s.lx, PV.FACADE_LZ + 0.7 + 3.8); R.spots.push({ id: 'interact ' + s.id, ok: F.whyBlocked(x, z) !== 'prop' }); }
  if (mode === 'colliders') {   // debug overlay: a red tile on every 0.4 m cell a pirate can't stand on (props + buildings)
    const P = []; for (let lx = -58; lx <= 40; lx += 0.4) for (let lz = -46; lz <= -10; lz += 0.4) if (prop(lx, lz)) P.push(CO.t2w(lx, lz));
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.06, 0.36), new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true, opacity: 0.55, depthTest: false }), P.length), m = new THREE.Matrix4();
    P.forEach(([x, z], i) => { m.makeTranslation(x, 2.86, z); im.setMatrixAt(i, m); }); im.renderOrder = 9; ISLAND.scene.add(im); R.debugTiles = P.length; }
  const sum = k => ({ total: R[k].length, fail: R[k].filter(r => !r.ok).length });
  R.summary = { buildings: sum('buildings'), props: sum('props'), paths: sum('paths'), spots: sum('spots') };
  R.failures = [...R.buildings, ...R.props, ...R.paths, ...R.spots].filter(r => !r.ok).slice(0, 20); return R; })
