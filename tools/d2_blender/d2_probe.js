// [Timothy] D2 JUNGLE RUINS layout probe (runs in island.html via d2_probe.py): every anchor of js/island/areas/jungle.js (Post's, read-only)
// with its ground height from foot.H, so the Blender rebuild (d2_blender.py) sits exactly where Post's kit pieces sit. Constants mirror jungle.js.
(async () => { const DS = await import('./js/island/digSpots.js'), TH = DS.JUNGLE_TRAILHEAD, H = ISLAND.foot.H;
  const TEMPLE = { x0: 25, x1: 65, z0: -472, z1: -436, y: 30 }, RUN = { x: 45, z0: -441, z1: -463, hw: 2.1 }, ALTAR = { x: 45, z: -467 };
  const HIDDEN = [{ id: 'j_moss', x: 61.5, z: -469 }, { id: 'j_idol', x: 18, z: -436 }, { id: 'j_ledge', x: 45, z: -479 }], IDOL_HEAD = { x: 16, z: -440 };
  const STEPS = [[69, -357.2, 25.4, 106, -332.4, 52], [158, -306.4, 30.6, 124, -322.2, 52]], IDOLS = [[72.6, -362.2, -0.62], [65.4, -352.2, 2.52]];
  const MB = { x: TH.x + 2.5, z: TH.z + 5.5 }, FIRE = { x: TH.x - 4.5, z: TH.z + 9.5 };
  const h = (x, z) => +H(x, z).toFixed(4), P = (x, z) => [x, z, h(x, z)];
  const cx = (TEMPLE.x0 + TEMPLE.x1) / 2;
  const out = { TH: { x: TH.x, z: TH.z, dx: TH.heading.dx, dz: TH.heading.dz, y: h(TH.x, TH.z) }, TEMPLE, RUN, ALTAR, HIDDEN, IDOL_HEAD: P(IDOL_HEAD.x, IDOL_HEAD.z),
    MB: P(MB.x, MB.z), LEAN: P(MB.x - 3.5, MB.z + 2.5), SIGN: P(TH.x - 1, TH.z - 3.2), FIRE: P(FIRE.x, FIRE.z), HAM: [P(FIRE.x + 3.5, FIRE.z + 1), P(FIRE.x + 7.5, FIRE.z + 1)],
    LEDGE: P(HIDDEN[2].x, HIDDEN[2].z - 2.5), LINTEL: P(cx + 6.5, TEMPLE.z1 + 1.5), IDOLS: IDOLS.map(([x, z, r]) => [...P(x, z), r]), steps: [] };
  out.FIRERING = []; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; out.FIRERING.push(P(FIRE.x + Math.cos(a) * 0.9, FIRE.z + Math.sin(a) * 0.9)); }
  for (const [ax, az, ay, bx, bz, by] of STEPS) { const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, S = { a: [ax, az, ay], b: [bx, bz, by], L, ux, uz, treads: [], pillars: [], edge: [] };
    for (let f = 2; f < L - 1; f += 1.6) { const x = ax + ux * f, z = az + uz * f, row = [];
      for (const a of [-0.3, 0, 0.3]) for (const s of [-2.8, -1.4, 0, 1.4, 2.8]) { const px = x + ux * a - uz * s, pz = z + uz * a + ux * s; row.push([+a.toFixed(2), s, h(px, pz)]); }   // (along, across) -> H
      S.treads.push({ f: +f.toFixed(2), x, z, y: h(x, z), g: (H(x + ux, z + uz) - H(x - ux, z - uz)) / 2, s: row }); }
    for (const sd of [-1, 1]) { const x = ax + ux * 1 + uz * 3.6 * sd, z = az + uz * 1 - ux * 3.6 * sd; S.pillars.push([x, z, h(x, z), sd]); }
    for (let f = 0; f <= L; f += 1.0) for (const sd of [-1, 1]) { const x = ax + ux * f + uz * 3.9 * sd, z = az + uz * f - ux * 3.9 * sd; S.edge.push([+f.toFixed(1), sd, x, z, h(x, z)]); }   // cheek-wall foot along both sides
    out.steps.push(S); }
  // the trail line (Post's PATH, paved by foot.js): heights along it for the wayside dressing check
  out.trail = DS.JUNGLE_TRAILHEAD ? [[TH.x, TH.z], [TH.x + TH.heading.dx * 6, TH.z + TH.heading.dz * 6], [16, -404], [17, -414], [24, -423], [33, -429], [41, -433], [45, -437]].map(([x, z]) => P(x, z)) : [];
  // the terrain grid itself over the cell's built pieces (foot.js: G 4, X0 -940, Z0 -820, H = bilinear): H at the grid points = Hg exactly,
  // so the Blender treads / flagstones can follow the walk surface to the millimetre (clipped to the grid cells)
  const GX0 = -940, GZ0 = -820, G = 4, gi0 = Math.floor((-20 - GX0) / G), gi1 = Math.ceil((180 - GX0) / G), gj0 = Math.floor((-496 - GZ0) / G), gj1 = Math.ceil((-288 - GZ0) / G);
  out.grid = { X0: GX0, Z0: GZ0, G, i0: gi0, j0: gj0, ni: gi1 - gi0 + 1, nj: gj1 - gj0 + 1, h: [] };
  for (let j = gj0; j <= gj1; j++) for (let i = gi0; i <= gi1; i++) out.grid.h.push(+H(GX0 + i * G, GZ0 + j * G).toFixed(4));
  return out; })()
