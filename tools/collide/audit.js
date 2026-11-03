// [Timothy] PUMPFUN PIRATES plaza collision audit (runs in island.html, tools/collide/audit.py). Two top-down grids over the town
// (town-local lx/lz, STEP m):  M = solid geometry at body height (any triangle between ground + LO and ground + HI, ground = the
// walk height: layout deck or foot.groundAt)  and  B = foot.whyBlocked() ('prop' = a collider incl. the 0.45 m body radius).
// walk-through = M and not blocked; invisible wall = prop-blocked with no geometry within the body radius (+ slack).
(async ({ lx0, lx1, lz0, lz1, step, lo, hi, deckColl }) => {
  const THREE = await import('three'), CO = await import('./js/island/coast.js'), LY = await import('./js/dock/layout.js');
  const I = ISLAND, F = I.foot, L = await LY.coastLayout();
  const decks = L.decks.map(d => ({ ...d, c: Math.cos(d.yaw), s: Math.sin(d.yaw) }));
  const deckAt = (x, z) => { let y = null; for (const d of decks) { const dx = x - d.x, dz = z - d.z, along = dx * d.s + dz * d.c, across = dx * d.c - dz * d.s;
    if (Math.abs(along) <= d.hl && Math.abs(across) <= d.hw) y = Math.max(y ?? -1e9, d.y); } return y; };
  const NX = Math.round((lx1 - lx0) / step) + 1, NZ = Math.round((lz1 - lz0) / step) + 1, N = NX * NZ;
  const G = new Float32Array(N), B = new Uint8Array(N), M = new Uint16Array(N), WHY = { prop: 1, slope: 2, sea: 3, edge: 4, rail: 5 };
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const lx = lx0 + i * step, lz = lz0 + j * step, [fx, fz] = CO.t2w(lx, lz), k = j * NX + i;
    const [hx, hz] = L.footToHarbor(fx, fz), d = deckAt(hx, hz), g = F.groundAt(fx, fz); G[k] = d !== null ? Math.max(d, g) : g;
    const w = F.whyBlocked(fx, fz); B[k] = w ? (d !== null && (w !== 'prop' || !deckColl) ? 0 : (WHY[w] || 6)) : 0; }   // harbor rule: on a deck only colliders count (and only with the deck-collider fix)
  // world -> town-local: t2w(lx, lz) = T + rot(yaw) (lx, lz); invert numerically from 3 points
  const [ax, az] = CO.t2w(0, 0), [bx, bz] = CO.t2w(1, 0), [cx, cz] = CO.t2w(0, 1);
  const ux = [bx - ax, bz - az], uz = [cx - ax, cz - az], det = ux[0] * uz[1] - ux[1] * uz[0];
  const toL = (x, z) => { const px = x - ax, pz = z - az; return [(px * uz[1] - pz * uz[0]) / det, (ux[0] * pz - ux[1] * px) / det]; };
  const names = [], skip = /sea|water|shallow|fresh|fall|mist|grass|bird|crab|flame|outline|pirate|smoke|cloud|sky|wake|foam|spray|shadow|marker|ring|halo|beam|chunk_/i;
  const meshes = [];
  const hidden = [];
  // streamed LODs: always use the near version (foot_* kit / nature meshes are hidden until the camera is close), never the _far / _lod1 copy
  const near = (o) => /^foot_/.test(o.name) && !/grass|flowers|ferns/.test(o.name);
  const walk = (o, forced) => { if (/_far$|_lod1$/.test(o.name)) return; if (!o.visible && !forced && near(o)) forced = true;
    if (!o.visible && !forced) { let n = 0; o.traverse(q => { if (q.isMesh) n++; }); if (n) hidden.push([o.name || o.type, n]); return; } if (o.isLOD) { if (o.levels.length) walk(o.levels[0].object, true); return; }
    if ((o.isMesh || o.isInstancedMesh) && !skip.test(o.name) && !o.userData.outline && !(o.material && o.material.side === THREE.BackSide)) meshes.push(o);
    for (const c of o.children) walk(c, false); };
  I.scene.updateMatrixWorld(true); walk(I.scene, false);
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], mi = new THREE.Matrix4(), mw = new THREE.Matrix4(), bb = new THREE.Box3();
  let tris = 0, used = 0;
  const raster = (P, id) => { // P: 3 town-local [lx, y, lz]; sample the triangle every <= step/2 (works for walls and floors alike)
    const minx = Math.min(P[0][0], P[1][0], P[2][0]), maxx = Math.max(P[0][0], P[1][0], P[2][0]), minz = Math.min(P[0][2], P[1][2], P[2][2]), maxz = Math.max(P[0][2], P[1][2], P[2][2]);
    if (maxx < lx0 || minx > lx1 || maxz < lz0 || minz > lz1) return;
    const e = Math.max(Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]), Math.hypot(P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]), Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1], P[2][2] - P[1][2]));
    const n = Math.max(1, Math.ceil(e / (step * 0.5)));
    for (let a = 0; a <= n; a++) for (let b = 0; a + b <= n; b++) { const u = a / n, w = b / n, r = 1 - u - w;
      const x = P[0][0] * r + P[1][0] * u + P[2][0] * w, y = P[0][1] * r + P[1][1] * u + P[2][1] * w, z = P[0][2] * r + P[1][2] * u + P[2][2] * w;
      const i = Math.round((x - lx0) / step), j = Math.round((z - lz0) / step); if (i < 0 || j < 0 || i >= NX || j >= NZ) continue;
      const k = j * NX + i, g = G[k]; if (y > g + lo && y < g + hi) M[k] = id; } };
  for (const o of meshes) { const geo = o.geometry; if (!geo || !geo.attributes.position) continue; if (!geo.boundingBox) geo.computeBoundingBox();
    const cnt = o.isInstancedMesh ? o.count : 1; let any = false;
    for (let n = 0; n < cnt; n++) { if (o.isInstancedMesh) { o.getMatrixAt(n, mi); mw.multiplyMatrices(o.matrixWorld, mi); } else mw.copy(o.matrixWorld);
      bb.copy(geo.boundingBox).applyMatrix4(mw); const c1 = toL(bb.min.x, bb.min.z), c2 = toL(bb.max.x, bb.max.z);
      if (Math.max(c1[0], c2[0]) < lx0 || Math.min(c1[0], c2[0]) > lx1 || Math.max(c1[1], c2[1]) < lz0 || Math.min(c1[1], c2[1]) > lz1) continue;
      if (!any) { any = true; names.push(o.name || o.parent?.name || '?'); used++; } const id = names.length; const pos = geo.attributes.position, idx = geo.index, nt = idx ? idx.count / 3 : pos.count / 3;
      for (let t = 0; t < nt; t++) { const P = [0, 1, 2].map(q => { const vi = idx ? idx.getX(t * 3 + q) : t * 3 + q; v[q].fromBufferAttribute(pos, vi).applyMatrix4(mw); const l = toL(v[q].x, v[q].z); return [l[0], v[q].y, l[1]]; });
        raster(P, id); tris++; } } }
  const b64 = (a) => { const u = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const list = meshes.map(o => [o.name, o.isInstancedMesh ? o.count : 0, o.geometry?.index ? o.geometry.index.count / 3 : (o.geometry?.attributes.position?.count || 0) / 3, o.parent?.name || '']);
  return { list, hidden, NX, NZ, step, lx0, lz0, names, used, meshes: meshes.length, tris, M: b64(M), B: b64(B), G: b64(G) };
})
