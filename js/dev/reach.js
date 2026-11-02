// [v105] DEV ONLY (not precached, never imported by the game): on-foot reachability check over the harbor walk API.
// Flood-fills a grid from the dock (forward: where can you walk to) and back (from where can you walk home), using the same
// world.blocked(x, z, fromX, fromZ) + 0.3 m sub-steps as js/onfoot/walker.js. Reports unreachable POIs, trail points, the bridge,
// elevated land you cannot get onto, and "trap" cells (reachable but no way back = stuck in a valley).
export async function reachReport({ world, layout, start, step = 4 }) {
  const FM = layout.FM, toH = layout.footToHarbor, toF = layout.harborToFoot, B = world.blocked;
  // bbox of the island in the harbor frame
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [fx, fz] of [[-940, -820], [700, -820], [700, 780], [-940, 780]]) { const [x, z] = toH(fx, fz); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const NI = Math.ceil((x1 - x0) / step), NJ = Math.ceil((z1 - z0) / step), N = NI * NJ;
  const X = (i) => x0 + i * step, Z = (j) => z0 + j * step;
  const free = new Uint8Array(N), flat = new Uint8Array(N); // free = you can stand here; flat = free and not itself a steep face
  // standable = not solid / sea, and not itself a steep face (grade over 2 m in any of 4 directions > the walk limit): steep faces are
  // MEANT to block, so they are counted apart (steepM2), not as unreachable land
  const lim = FM.WALK_RULES ? FM.WALK_RULES.slope : 1.25; let steep = 0;
  const gradeAt = (fx, fz) => { let g = 0; for (const [a, b] of [[1, 0], [0, 1], [0.7, 0.7], [0.7, -0.7]]) g = Math.max(g, Math.abs(FM.H(fx + a, fz + b) - FM.H(fx - a, fz - b)) / 2); return g; };
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) { const x = X(i), z = Z(j), n = j * NI + i; free[n] = !B(x, z) && (world.deckAt(x, z) !== null || FM.H(...toF(x, z)) > 0.4) ? 1 : 0;
    flat[n] = free[n]; if (free[n] && world.deckAt(x, z) === null && gradeAt(...toF(x, z)) > lim) { flat[n] = 0; steep++; } }
  function move(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 0.3)); let cx = ax, cz = az;
    for (let k = 1; k <= n; k++) { const nx = ax + (bx - ax) * k / n, nz = az + (bz - az) * k / n; if (B(nx, nz, cx, cz)) return false; cx = nx; cz = nz; } return true; }
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const si = Math.round((start.x - x0) / step), sj = Math.round((start.z - z0) / step);
  // seeds: free cells within 14 m you can walk to (forward) / from (back) the start point (the berth you stepped ashore at)
  const seeds = (rev) => { const out = []; for (let j = sj - 4; j <= sj + 4; j++) for (let i = si - 4; i <= si + 4; i++) { if (i < 0 || j < 0 || i >= NI || j >= NJ) continue; const n = j * NI + i;
    if (free[n] && Math.hypot(X(i) - start.x, Z(j) - start.z) < 14 && (rev ? move(X(i), Z(j), start.x, start.z) : move(start.x, start.z, X(i), Z(j)))) out.push(n); } return out; };
  const startLink = seeds(false).length;
  function fill(rev) { const seen = new Uint8Array(N), q = new Int32Array(N); let h = 0, t = 0; for (const n of seeds(rev)) { seen[n] = 1; q[t++] = n; }
    while (h < t) { const c = q[h++], ci = c % NI, cj = (c - ci) / NI;
      for (const [di, dj] of NB) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= NI || j >= NJ) continue; const n = j * NI + i; if (seen[n] || !free[n]) continue;
        if (rev ? move(X(i), Z(j), X(ci), Z(cj)) : move(X(ci), Z(cj), X(i), Z(j))) { seen[n] = 1; q[t++] = n; } } }
    return seen; }
  const t0 = performance.now(), fwd = fill(false), back = fill(true), ms = Math.round(performance.now() - t0);
  const near = (x, z, r, A = fwd) => { const r2 = Math.ceil(r / step); const ci = Math.round((x - x0) / step), cj = Math.round((z - z0) / step);
    for (let j = cj - r2; j <= cj + r2; j++) for (let i = ci - r2; i <= ci + r2; i++) { if (i < 0 || j < 0 || i >= NI || j >= NJ) continue; if (A[j * NI + i] && Math.hypot(X(i) - x, Z(j) - z) <= r + 0.01) return true; } return false; };
  const rep = { step, grid: [NI, NJ], ms, startLink, steepFaceM2: 0, free: 0, reached: 0, traps: 0, pois: [], trails: {}, bridge: null, elevated: [], trapAreas: [] };
  rep.steepFaceM2 = steep * step * step;
  for (let n = 0; n < N; n++) if (flat[n]) { rep.free++; if (fwd[n]) rep.reached++; if (fwd[n] && !back[n]) rep.traps++; }
  // POIs (interact points + Raul's inland POIs + dig spots)
  const pois = [...layout.interact.map(q => ({ id: q.id, x: q.x, z: q.z, r: q.r || 3 })), ...(world.footInteract || []).map(q => ({ id: q.id, x: q.x, z: q.z, r: q.r || 3 })),
    ...FM.FOOT_POIS.map(p => { const [x, z] = toH(p.x, p.z); return { id: 'poi:' + p.id, x, z, r: Math.max(6, p.r || 0) }; })];
  rep.seaPois = []; // POIs out on the water (seen from the boat, not walked to)
  for (const p of pois) { const y = FM.H(...toF(p.x, p.z)); if (y < 0.4 && world.deckAt(p.x, p.z) === null && B(p.x, p.z)) { if (!near(p.x, p.z, 30)) rep.seaPois.push(p.id); else continue; continue; }
    const solid = B(p.x, p.z) ? 9 : 0; // the POI is a solid prop (lighthouse, tower): reaching its foot counts
    const ok = near(p.x, p.z, p.r + solid + step * 0.75); if (!ok) rep.pois.push({ id: p.id, x: Math.round(p.x), z: Math.round(p.z), y: +FM.H(...toF(p.x, p.z)).toFixed(1) }); }
  rep.poiCount = pois.length;
  for (const [k, path] of Object.entries(FM.TRAILS)) { let bad = 0, segs = []; for (let i = 0; i < path.length; i += 3) { const [x, z] = toH(...path[i]); if (!near(x, z, step * 1.5)) { bad++; segs.push([Math.round(path[i][0]), Math.round(path[i][1])]); } }
    rep.trails[k] = { points: Math.ceil(path.length / 3), unreachable: bad, sample: segs.filter((_, i) => i % 5 === 0).slice(0, 12) }; }
  if (FM.BRIDGE && FM.BRIDGE.L) { const b = FM.BRIDGE, pts = [0, 0.25, 0.5, 0.75, 1].map(t => toH(b.ax + (b.bx - b.ax) * t, b.az + (b.bz - b.az) * t));
    // walk the deck end to end with the real collision
    const [ax, az] = toH(b.ax - Math.sin(b.yaw) * 3, b.az - Math.cos(b.yaw) * 3), [bx, bz] = toH(b.bx + Math.sin(b.yaw) * 3, b.bz + Math.cos(b.yaw) * 3);
    rep.bridge = { ends: [near(...pts[0], 6), near(...pts[4], 6)], crossAB: move(ax, az, bx, bz), crossBA: move(bx, bz, ax, az), L: Math.round(b.L) }; }
  // unreached standable land: clusters (8-connected over free cells), report the big ones with their high point
  const lab = new Int32Array(N).fill(-1), qq = new Int32Array(N); let L = 0;
  const clusters = (want, out) => { lab.fill(-1);
    for (let n = 0; n < N; n++) { if (!want(n) || lab[n] >= 0) continue; let h = 0, t = 0, cnt = 0, hy = -1e9, hx = 0, hz = 0, lo = 1e9; qq[t++] = n; lab[n] = L;
      while (h < t) { const c = qq[h++], ci = c % NI, cj = (c - ci) / NI; cnt++; const y = FM.H(...toF(X(ci), Z(cj))); if (y > hy) { hy = y; hx = X(ci); hz = Z(cj); } lo = Math.min(lo, y);
        for (const [di, dj] of NB) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= NI || j >= NJ) continue; const m = j * NI + i; if (lab[m] < 0 && want(m)) { lab[m] = L; qq[t++] = m; } } }
      L++; if (cnt >= 6) { const [fx, fz] = toF(hx, hz); out.push({ id: L - 1, cells: cnt, areaM2: cnt * step * step, top: +hy.toFixed(1), low: +lo.toFixed(1), at: [Math.round(fx), Math.round(fz)] }); } } };
  clusters(n => flat[n] && !fwd[n], rep.elevated); rep.elevated.sort((a, b) => b.cells - a.cells);
  // stair suggestions: for each unreached inland pocket, the best straight flight (foot frame) from reached ground into it —
  // lowest max grade, then shortest; no sea / solid props on the way
  rep.stairs = [];
  for (const c of rep.elevated) { const cells = [], edge = []; for (let n = 0; n < N; n++) if (lab[n] === c.id) cells.push(n);
    const R = Math.ceil(45 / step); let best = null;
    for (const a of cells) { const ai = a % NI, aj = (a - ai) / NI;
      for (let j = aj - R; j <= aj + R; j++) for (let i = ai - R; i <= ai + R; i++) { if (i < 0 || j < 0 || i >= NI || j >= NJ) continue; const b = j * NI + i; if (!fwd[b] || !back[b]) continue;
        const [ax, az] = toF(X(ai), Z(aj)), [bx, bz] = toF(X(i), Z(j)), d = Math.hypot(bx - ax, bz - az); if (d > 45 || d < 3) continue;
        const ya = FM.H(ax, az), yb = FM.H(bx, bz), rise = Math.abs(ya - yb); if (rise / d > 0.7) continue; // a carved ramp: ≤ 0.7 grade (35°)
        let ok = true; const n2 = Math.ceil(d / 0.5), why = world.foot.whyBlocked;
        for (let k = 1; k < n2 && ok; k++) { const t = k / n2, x = bx + (ax - bx) * t, z = bz + (az - bz) * t, w = why(x, z); if (w && w !== 'slope' && w !== 'prop') ok = false; }
        if (!ok) continue; const score = d;
        if (!best || score < best.score) best = { score: +score.toFixed(1), from: [Math.round(bx), Math.round(bz)], to: [Math.round(ax), Math.round(az)], len: +d.toFixed(1), rise: +rise.toFixed(1) }; } }
    rep.stairs.push({ pocket: c.at, top: c.top, cells: c.cells, flight: best }); }
  clusters(n => fwd[n] && !back[n], rep.trapAreas); rep.trapAreas.sort((a, b) => b.cells - a.cells);
  rep.unreachedLand = rep.free - rep.reached;
  // summits + high ground: every local high point over 25 m (9x9-cell neighbourhood) must be reached
  rep.summits = []; for (let j = 4; j < NJ - 4; j += 2) for (let i = 4; i < NI - 4; i += 2) { const n = j * NI + i; const y = FM.H(...toF(X(i), Z(j))); if (y < 25) continue; let top = true;
    for (let b = -4; b <= 4 && top; b++) for (let a = -4; a <= 4; a++) if (FM.H(...toF(X(i + a), Z(j + b))) > y) { top = false; break; }
    if (top) { const [fx, fz] = toF(X(i), Z(j)); rep.summits.push({ at: [Math.round(fx), Math.round(fz)], y: +y.toFixed(1), reached: near(X(i), Z(j), step * 1.5) }); } }
  const sm = []; for (const t of rep.summits.sort((a, b) => b.y - a.y)) if (!sm.some(u => Math.hypot(u.at[0] - t.at[0], u.at[1] - t.at[1]) < 60)) sm.push(t); rep.summits = sm;
  rep.summitsUnreached = rep.summits.filter(s => !s.reached).length;
  // coarse picture in the FOOT frame (20 m cells, north up): '~' sea, '.' reached land, 'X' land you can't reach, '#' blocked land
  // (colliders / steep / water inland), 'A' / 'B' trails, 'o' unreachable trail
  { const rows = []; const TR = new Map(); for (const [k, P] of Object.entries(FM.TRAILS)) for (const [x, z] of P) TR.set(Math.floor((x + 940) / 20) + ',' + Math.floor((z + 820) / 20), k);
    for (let fz = -820; fz < 780; fz += 20) { let r = ''; for (let fx = -940; fx < 700; fx += 20) { const [x, z] = toH(fx + 10, fz + 10), i = Math.round((x - x0) / step), j = Math.round((z - z0) / step), n = j * NI + i;
      const land = FM.H(fx + 10, fz + 10) > 0.4, t = TR.get(Math.floor((fx + 10 + 940) / 20) + ',' + Math.floor((fz + 10 + 820) / 20));
      const ok = near(x, z, 10);
      r += t ? (ok ? t : 'o') : !land ? '~' : ok ? '.' : free[n] ? 'X' : '#'; } rows.push(r); }
    rep.ascii = rows; }
  rep.elevated = rep.elevated.slice(0, 40); rep.trapAreas = rep.trapAreas.slice(0, 20);
  return rep;
}
