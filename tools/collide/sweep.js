// [Timothy] PUMPFUN PIRATES plaza walk sweep (runs in island.html via tools/collide/sweep.py). Uses the HARBOR game's walk rule
// (js/dock/world.js blocked(): layout decks + foot.blocked) re-implemented 1:1 here, with opt.deckColl = colliders also on decks
// (the fix) or not (before). The player is an A*-planned path walked with walker.js's exact step() (<= 0.3 m sub-steps + axis
// slide); a stall (< 0.25 m progress in 1.2 s of game time) = a STUCK spot (corner snag / invisible edge / narrow gap). The 3 crew
// followers replay followers.js's rule on the player's breadcrumbs (2.4 / 4.0 / 5.6 m back, +-1.1 m side offsets, same slide);
// a follower stuck > 1.5 s (the game then teleports it) = a FOLLOWER STUCK spot.
(async (opt) => {
  const CO = await import('./js/island/coast.js'), LY = await import('./js/dock/layout.js'), PV = await import('./js/island/plazaTown.js'), BT = await import('./js/island/battery.js');
  const FM = await import('./js/island/foot.js'), F = ISLAND.foot, L = await LY.coastLayout();
  const decks = L.decks.map(d => ({ ...d, c: Math.cos(d.yaw), s: Math.sin(d.yaw) }));
  const deckAtH = (x, z) => { let y = null; for (const d of decks) { const dx = x - d.x, dz = z - d.z, along = dx * d.s + dz * d.c, across = dx * d.c - dz * d.s;
    if (Math.abs(along) <= d.hl && Math.abs(across) <= d.hw - 0.35) y = Math.max(y ?? -1e9, d.y); } return y; };
  // walk API in TOWN-LOCAL coords (lx, lz) -> foot world (t2w) -> harbor (footToHarbor), exactly world.js blocked()
  const W = (lx, lz) => CO.t2w(lx, lz);
  const deckAt = (lx, lz) => { const [fx, fz] = W(lx, lz), [hx, hz] = L.footToHarbor(fx, fz); return deckAtH(hx, hz); };
  const ground = (lx, lz) => { const d = deckAt(lx, lz), [fx, fz] = W(lx, lz), g = F.groundAt(fx, fz); return d !== null ? Math.max(d, g) : g; };
  let calls = 0;
  function blocked(lx, lz, plx, plz) { calls++; const [fx, fz] = W(lx, lz), d = deckAt(lx, lz);
    if (d !== null) { if (opt.deckColl && FM.hitCollider(fx, fz)) return true; if (plx === undefined) return false; return d - ground(plx, plz) > 2.4; }
    const pd = plx === undefined ? null : deckAt(plx, plz);
    if (pd !== null) return F.blocked(fx, fz) || F.H(fx, fz) - pd > 2.4;
    if (plx === undefined) return F.blocked(fx, fz); const [pfx, pfz] = W(plx, plz); return F.blocked(fx, fz, pfx, pfz); }
  // ---- A* on a 0.25 m grid over the town ----
  const G = { lx0: -190, lx1: 200, lz0: -80, lz1: 66, s: 0.25 }; const NX = Math.round((G.lx1 - G.lx0) / G.s) + 1, NZ = Math.round((G.lz1 - G.lz0) / G.s) + 1;
  const pass = new Int8Array(NX * NZ); // 0 unknown, 1 free, 2 blocked
  const free = (i, j) => { if (i < 0 || j < 0 || i >= NX || j >= NZ) return false; const k = j * NX + i; if (!pass[k]) pass[k] = blocked(G.lx0 + i * G.s, G.lz0 + j * G.s) ? 2 : 1; return pass[k] === 1; };
  const edge = new Map(), nk0 = (i, j, di, dj) => (j * NX + i) * 9 + (di + 1) * 3 + (dj + 1);
  const cell = (lx, lz) => [Math.round((lx - G.lx0) / G.s), Math.round((lz - G.lz0) / G.s)];
  function astar(a, b, maxN = 400000) { let [ai, aj] = cell(...a); const [bi, bj] = cell(...b);
    const near = (i, j) => { if (free(i, j)) return [i, j]; for (let r = 1; r < 8; r++) for (let di = -r; di <= r; di++) for (const dj of [-r, r]) { if (free(i + di, j + dj)) return [i + di, j + dj]; if (free(i + dj, j + di)) return [i + dj, j + di]; } return null; };
    const A = near(ai, aj), B = near(bi, bj); if (!A || !B) return null;
    const gS = new Map(), came = new Map(), open = [[0, A[1] * NX + A[0]]], key = (i, j) => j * NX + i, h = (i, j) => { const dx = Math.abs(i - B[0]), dz = Math.abs(j - B[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    gS.set(open[0][1], 0); let n = 0; const goal = key(B[0], B[1]);
    const push = (e) => { open.push(e); let c = open.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (open[p][0] <= open[c][0]) break; [open[p], open[c]] = [open[c], open[p]]; c = p; } };
    const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === c) break; [open[m], open[c]] = [open[c], open[m]]; c = m; } } return top; };
    while (open.length && n++ < maxN) { const [, k] = pop(); if (k === goal) break; const i = k % NX, j = (k - i) / NX, g0 = gS.get(k);
      for (const [di, dj, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) { const ni = i + di, nj = j + dj;
        if (!free(ni, nj) || (di && dj && (!free(i + di, j) || !free(i, j + dj)))) continue;
        const ek = nk0(i, j, di, dj); if (!edge.has(ek)) edge.set(ek, !blocked(G.lx0 + ni * G.s, G.lz0 + nj * G.s, G.lx0 + i * G.s, G.lz0 + j * G.s)); if (!edge.get(ek)) continue;   // the step itself (grade / ledge rules)
        const nk = key(ni, nj), g = g0 + w;
        if (g < (gS.get(nk) ?? 1e9)) { gS.set(nk, g); came.set(nk, k); push([g + h(ni, nj), nk]); } } }
    if (!came.has(goal) && goal !== key(A[0], A[1])) return null;
    const out = []; let k = goal; while (k !== undefined) { const i = k % NX, j = (k - i) / NX; out.push([G.lx0 + i * G.s, G.lz0 + j * G.s]); k = came.get(k); } return out.reverse(); }
  // ---- walker.js step() (sub-steps <= 0.3 m, then x-only / z-only slide) in harbor axes: town-local axes are world axes rotated by
  // the town yaw (-pi/2), so sliding along town lx == sliding along a world axis: same behaviour as the game.
  function step(p, dx, dz) { const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3)); let moved = 0;
    for (let i = 0; i < n; i++) { const sx = dx / n, sz = dz / n;
      if (!blocked(p.x + sx, p.z + sz, p.x, p.z)) { p.x += sx; p.z += sz; moved++; }
      else if (Math.abs(sx) > 1e-4 && !blocked(p.x + sx, p.z, p.x, p.z)) { p.x += sx; moved += 0.5; }
      else if (Math.abs(sz) > 1e-4 && !blocked(p.x, p.z + sz, p.x, p.z)) { p.z += sz; moved += 0.5; }
      else if (opt.deflect) for (const r of [0.6, -0.6, 1.2, -1.2]) { const c = Math.cos(r), s = Math.sin(r), rx = sx * c - sz * s, rz = sx * s + sz * c;   // walker.js / followers.js DEFLECT
        if (!blocked(p.x + rx, p.z + rz, p.x, p.z)) { p.x += rx; p.z += rz; moved += 0.25; break; } } }
    return moved / n; }
  const DT = 1 / 30, SPEED = 4.2, BACK = [2.4, 4.0, 5.6], SIDE = [-1.1, 1.1, 0];
  function run(lane) { const path = astar(lane.a, lane.b); if (!path) return { ...lane, ok: false, why: 'no path' };
    const p = { x: path[0][0], z: path[0][1] }, trail = [[p.x, p.z]], crew = BACK.map((bk, i) => ({ x: p.x, z: p.z, stuck: 0, tp: 0, spd: 0 })), stuckAt = [], crewStuck = [];
    let wi = 0, t = 0, last = { x: p.x, z: p.z, t: 0 }, yaw = 0;
    const trailAt = (d) => { let px = p.x, pz = p.z, acc = 0; for (const q of trail) { const s = Math.hypot(q[0] - px, q[1] - pz); if (acc + s >= d) { const f = (d - acc) / Math.max(1e-3, s); return [px + (q[0] - px) * f, pz + (q[1] - pz) * f]; } acc += s; px = q[0]; pz = q[1]; } return [px, pz]; };
    while (t < 240) { t += DT;
      while (wi < path.length - 1 && Math.hypot(path[wi][0] - p.x, path[wi][1] - p.z) < 0.9) wi++;
      const tg = path[wi], dx = tg[0] - p.x, dz = tg[1] - p.z, d = Math.hypot(dx, dz);
      if (wi >= path.length - 1 && d < 0.5) break;
      if (d > 1e-4) { step(p, dx / d * SPEED * DT, dz / d * SPEED * DT); yaw = Math.atan2(dx, dz); }
      if (t - last.t > 1.2) { if (Math.hypot(p.x - last.x, p.z - last.z) < 0.25) { stuckAt.push([+p.x.toFixed(2), +p.z.toFixed(2)]); // nudge on like a player would: skip ahead
          wi = Math.min(path.length - 1, wi + 4); p.x = path[wi][0]; p.z = path[wi][1]; } last = { x: p.x, z: p.z, t }; }
      const h0 = trail[0]; if (Math.hypot(p.x - h0[0], p.z - h0[1]) >= 0.8) { trail.unshift([p.x, p.z]); if (trail.length > 64) trail.pop(); }
      if (opt.crew) crew.forEach((c, i) => { let [tx, tz] = trailAt(BACK[i]); const bx = -Math.sin(yaw), bz = -Math.cos(yaw), sx = -bz * SIDE[i], sz = bx * SIDE[i];
        if (SIDE[i] && !blocked(tx + sx, tz + sz, tx, tz)) { tx += sx; tz += sz; }
        if (opt.deflect && c.stuck > 0.3 && trail.length > 1) { let m = 0, md = 1e9; for (let q = 0; q < trail.length; q++) { const e = (trail[q][0] - c.x) ** 2 + (trail[q][1] - c.z) ** 2; if (e < md) { md = e; m = q; } }
          const q = trail[Math.max(0, m - 1)]; tx = q[0]; tz = q[1]; }   // followers.js: caught on a corner -> walk the breadcrumbs
        const ddx = tx - c.x, ddz = tz - c.z, dd = Math.hypot(ddx, ddz); let want = dd > 5 ? 9.6 : dd > 0.9 ? Math.min(4.2, 1.2 + dd * 1.6) : 0; c.spd += (want - c.spd) * Math.min(1, DT * 6);
        if (c.spd > 0.15 && dd > 0.05) { const got = step(c, ddx / dd * c.spd * DT, ddz / dd * c.spd * DT); c.stuck = got < 0.3 ? c.stuck + DT : 0;
          if (c.stuck > 1.5) { crewStuck.push([i, +c.x.toFixed(2), +c.z.toFixed(2)]); const q = trailAt(BACK[i]); c.x = q[0]; c.z = q[1]; c.stuck = 0; } } }); }
    const end = path[path.length - 1], ok = Math.hypot(p.x - end[0], p.z - end[1]) < 1.0 && !stuckAt.length;
    return { name: lane.name, ok, why: ok ? '' : stuckAt.length ? 'stuck' : 'timeout', len: +(path.length * G.s).toFixed(1), t: +t.toFixed(1), stuckAt, crewStuck, crewOk: !crewStuck.length }; }
  // ---- lanes ----
  const lanes = [];
  for (const lz of [-26.5, -24, -21.5, -19, -14, -10.5, -6, -2, 3, 6.6]) { lanes.push({ name: `street lz ${lz} W->E`, a: [lz > 0 ? -170 : -58, lz], b: [96, lz] }); lanes.push({ name: `street lz ${lz} E->W`, a: [96, lz], b: [lz > 0 ? -170 : -58, lz] }); }
  for (const j of PV.JETTIES) for (const dx of [-5.2, -2.5, 0, 2.5, 5.2]) { lanes.push({ name: `jetty ${j.id} dx ${dx} out`, a: [j.lx + dx, -3], b: [j.lx + dx, 58] }); lanes.push({ name: `jetty ${j.id} dx ${dx} back`, a: [j.lx + dx, 58], b: [j.lx + dx, -3] }); }
  for (const s of PV.STOREFRONTS) for (const dx of [-0.3, 0, 0.3]) lanes.push({ name: `to ${s.id} ${dx}`, a: [s.lx + dx * s.w, -10], b: [s.lx + dx * s.w, -27] });
  lanes.push({ name: 'main street up', a: [6, -8], b: [6, -66] }, { name: 'main street down', a: [6, -66], b: [6, -8] });
  lanes.push({ name: 'diag NW->SE', a: [-56, -27], b: [95, 5] }, { name: 'diag NE->SW', a: [95, -27], b: [-56, 5] }, { name: 'boardwalk W -> plaza', a: [-172, 4], b: [0, -12] });
  lanes.push({ name: 'quay -> battery deck', a: [100, -1], b: [160, 32] }, { name: 'battery deck -> quay', a: [160, 32], b: [100, -1] });
  const B = BT.BATTERY; for (let k = 0; k < 8; k++) { const a0 = -1.4 + k * 0.4, a1 = a0 + 0.4, r = 11.5; lanes.push({ name: `battery ring ${k}`, a: [B.lx + Math.sin(a0) * r, B.lz + Math.cos(a0) * r], b: [B.lx + Math.sin(a1) * r, B.lz + Math.cos(a1) * r] }); }
  const rings = [...PV.STALLS.map(s => ['stall', s.lx, s.lz - 0.2, 3.0]), ...PV.CARTS.map(c => ['cart', c[0] + 0.8, c[1], 3.4]), ...PV.TAVERN_TABLES.map(c => ['table', c[0], c[1], 2.4]),
    ...PV.LAMPS.map(c => ['lamp', c[0], c[1], 1.3]), ...PV.CARGO.filter(c => PV.clearOfJetties(c[0], 3)).map(c => ['cargo', c[0], c[1], 3.2]), ...PV.PALMS.map(c => ['palm', c[0], c[1], 1.6]),
    ...BT.GUNS.map(g => ['gun', g.lx, g.lz, 2.6])];
  for (const [nm, x, z, r] of rings) for (let k = 0; k < 4; k++) { const a0 = k * Math.PI / 2, a1 = a0 + Math.PI / 2; lanes.push({ name: `ring ${nm} ${x},${z} q${k}`, a: [x + Math.cos(a0) * r, z + Math.sin(a0) * r], b: [x + Math.cos(a1) * r, z + Math.sin(a1) * r] }); }
  const res = []; const t0 = performance.now(); for (const ln of (opt.only ? lanes.filter(l => l.name.includes(opt.only)) : lanes)) res.push(run(ln));
  return { ms: Math.round(performance.now() - t0), calls, n: res.length, pass: res.filter(r => r.ok).length, fail: res.filter(r => !r.ok).length, crewFail: res.filter(r => r.crewOk === false).length, res };
})
