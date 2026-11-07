// [Timothy] THE GOLDEN DOUBLOON CASINO probe (tests/casino.test.mjs): load the hill + casino GLBs in node (fetch -> local files), build Main Street,
// then measure the hall: colliders, decks, E points, walkability from Main Street through the arch, terrain vs the floor, neighbours.
//   cd tools/roundabout_blender/node && QS='?coast=1' node --import ./reg.mjs ../../casino_blender/node/casino_check.mjs
import { readFileSync } from 'node:fs';
const ROOT = new URL('../../../', import.meta.url);
globalThis.ProgressEvent = class { constructor(t, o = {}) { Object.assign(this, { type: t }, o); } };
globalThis.Request = class { constructor(u, o = {}) { this.url = String(u); this.headers = new Headers(o.headers || {}); this.credentials = o.credentials; this.signal = o.signal; } };
globalThis.fetch = async (u) => new Response(readFileSync(new URL((u.url || String(u)).replace(/^.*?assets\//, 'assets/'), ROOT)));
const low = process.env.LOW === '1';
const HS = await import('../../../js/island/hillStreet.js'), C = await import('../../../js/island/casino.js'), CD = await import('../../../js/island/casinoData.js');
await HS.loadHill(low); const kit = await C.loadCasinoReady(low);
const F = await import('../../../js/island/foot.js'), CO = await import('../../../js/island/coast.js');
const R = new Proxy({}, { get: () => [0, 0, 1, 1] }); for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, low, []);
const out = { on: CD.CASINO_ON, kit: !!kit, lods: kit ? kit.lods.length : 0, colliders: kit ? kit.colliders.length : 0, tablesGlb: kit ? kit.tables : null, hall: CD.CASINO_HALL };
const t2w = CO.t2w, ga = (lx, lz) => { const [x, z] = t2w(lx, lz); return F.areaDeckAt(x, z) ?? F.H(x, z); }, hit = (lx, lz, r = 0.45) => F.hitCollider(...t2w(lx, lz), r);
out.interacts = F.INTERACT.filter(q => /^casino_/.test(q.id)).map(q => { const [lx, lz] = CO.w2t(q.x, q.z); return { id: q.id, label: q.label, game: q.game, r: q.r, lx: +lx.toFixed(3), lz: +lz.toFixed(3), y: +ga(lx, lz).toFixed(3), blocked: hit(lx, lz) }; });
out.overlap = [CD.casinoOverlap(15, 27, -57, -44), CD.casinoOverlap(40, 50, -57, -44)];   // the coliseum store clones skip the hall
out.lots = F.LOTS_MAP ? F.LOTS_MAP.filter(l => /CASINO/.test(l.label || '')).length : null;
out.H = { s18_60: +F.H(...t2w(18, -60)).toFixed(3), s14_60: +F.H(...t2w(14, -60)).toFixed(3), s22_50: +F.H(...t2w(22, -50)).toFixed(3) };
if (kit) {
  const I = CD.CASINO_HALL.inner, V = CD.CASINO_HALL.vault, step = 0.2;
  // terrain never pokes through the plank floor (top = deck + 0.025) outside the solid treasure dais
  let poke = -9, pokeAt = null; for (let lx = I.lx0; lx <= I.lx1 + 1e-6; lx += 0.25) for (let lz = I.lz0; lz <= I.lz1 + 1e-6; lz += 0.25) {
    if (lx >= V.lx0 - 0.01 && lx <= V.lx1 + 0.01 && lz >= V.lz0 - 0.01 && lz <= V.lz1 + 0.01) continue;
    const e = F.H(...t2w(lx, lz)) - (CD.CASINO_Y + 0.025); if (e > poke) { poke = e; pokeAt = [lx, lz]; } }
  out.floorPoke = { max: +poke.toFixed(3), at: pokeAt };
  { const WI = CD.CASINO_WING?.inner; let wp = -9, wat = null; if (WI) for (let lx = WI.lx0 + 0.7; lx <= WI.lx1 + 1e-6; lx += 0.25) for (let lz = WI.lz0; lz <= WI.lz1 + 1e-6; lz += 0.25) {   // [v378] the wing floor
      const e = F.H(...t2w(lx, lz)) - (CD.CASINO_Y + 0.025); if (e > wp) { wp = e; wat = [lx, lz]; } }
    out.wingPoke = { max: +wp.toFixed(3), at: wat }; }
  let vault = -9; for (let lx = V.lx0; lx <= V.lx1; lx += 0.25) for (let lz = V.lz0; lz <= V.lz1; lz += 0.25) vault = Math.max(vault, F.H(...t2w(lx, lz)) - CD.CASINO_Y); out.vaultTerrain = +vault.toFixed(3);
  // BFS from Main Street (lx 8, the arch's lz) to each E point: 0.2 m grid, 0.45 m walker, steps <= 0.3 m
  const LX0 = 4, LX1 = 56,   /* [v378] through the wing */ LZ0 = -60, LZ1 = -41, nx = Math.round((LX1 - LX0) / step) + 1, nz = Math.round((LZ1 - LZ0) / step) + 1, id = (i, j) => i * nz + j;
  const prev = new Int32Array(nx * nz).fill(-2), Y = new Float32Array(nx * nz), free = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const lx = LX0 + i * step, lz = LZ0 + j * step; free[id(i, j)] = hit(lx, lz) ? 0 : 1; Y[id(i, j)] = ga(lx, lz); }
  const si = Math.round((8 - LX0) / step), sj = Math.round((CD.CASINO_HALL.arch.lz - LZ0) / step), Qu = [id(si, sj)]; prev[id(si, sj)] = -1;
  while (Qu.length) { const k = Qu.shift(), i = Math.floor(k / nz), j = k % nz;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const kk = id(a, b);
      if (prev[kk] !== -2 || !free[kk] || Math.abs(Y[kk] - Y[k]) > 0.3) continue; prev[kk] = k; Qu.push(kk); } }
  out.reach = out.interacts.map(q => { const i = Math.round((q.lx - LX0) / step), j = Math.round((q.lz - LZ0) / step), k = id(i, j); if (prev[k] === -2) return { id: q.id, ok: false };
    let n = 0, maxStep = 0, viaArch = false; for (let c = k; prev[c] >= 0; c = prev[c]) { n++; maxStep = Math.max(maxStep, Math.abs(Y[c] - Y[prev[c]])); const lx = LX0 + Math.floor(c / nz) * step, lz = LZ0 + (c % nz) * step;
      if (Math.abs(lx - 14.35) < 0.3 && Math.abs(lz - CD.CASINO_HALL.arch.lz) < 2.45) viaArch = true; }
    return { id: q.id, ok: true, len: +(n * step).toFixed(1), maxStep: +maxStep.toFixed(3), viaArch }; });
  // the arch: walk straight in along its centre line
  { let prevY, maxStep = 0, hits = 0; for (let lx = 8; lx <= 20; lx += 0.1) { const y = ga(lx, CD.CASINO_HALL.arch.lz); if (hit(lx, CD.CASINO_HALL.arch.lz)) hits++; if (prevY !== undefined) maxStep = Math.max(maxStep, Math.abs(y - prevY)); prevY = y; }
    out.archWalk = { hits, maxStep: +maxStep.toFixed(3) }; }
  // the arch's clear width (no collider for a point walker) and the solid walls
  { let w = 0; for (let lz = CD.CASINO_HALL.arch.lz - 3; lz <= CD.CASINO_HALL.arch.lz + 3; lz += 0.05) if (!hit(14.35, lz, 0)) w += 0.05; out.archClear = +w.toFixed(2); }
  const R_ = CD.CASINO_HALL.rect; out.walls = { front: [hit(14.35, -56), hit(14.35, -45)], south: hit(20, R_.lz0 + 0.25), north: hit(20, R_.lz1 - 0.25), back: hit(R_.lx1 - 0.3, -57.6) && hit(R_.lx1 - 0.3, -43.2) && !hit(R_.lx1 - 0.3, -50.4) && !hit(R_.lx1 - 0.3, -45.4) && !hit(R_.lx1 - 0.3, -55.4) };   // [t2007u] solid only outside the 12 m opening into the High Seas Room
  // aisles: a 2.2 m wide walker (r 1.1) along the runner, across the hall between the tables
  { let a = 0, b = 0; for (let lx = 14.9; lx <= 24.8; lx += 0.1) if (hit(lx, CD.CASINO_HALL.lz, 1.1)) a++; for (let lz = -53.8; lz <= -47.0; lz += 0.1) if (hit(22.4, lz, 1.1)) b++; out.aisles = { runner: a, cross: b }; }
  // free radius round each E point (the nearest collider)
  out.freeR = out.interacts.map(q => { let r = 0; while (r < 3 && !hit(q.lx, q.lz, r)) r += 0.05; return +r.toFixed(2); });
  // the Squad Hall's north strip still walks on the street grade
  { const gy = CD.streetGrade; let maxErr = 0; for (let lx = 15; lx <= 27; lx += 0.5) for (let lz = -63.8; lz <= -59.8; lz += 0.4) { if (hit(lx, lz)) continue; maxErr = Math.max(maxErr, Math.abs(ga(lx, lz) - gy(lz))); } out.squadNorth = +maxErr.toFixed(3); }
  const root = C.buildCasino(); out.built = root ? { name: root.name, tris: root.userData.tris, lod: !!root.getObjectByName('casino_lod'), meshes: (() => { let n = 0; root.traverse(o => { if (o.isMesh) n++; }); return n; })() } : null;
  // a few colliders in town coords (frame check)
  out.place = C.casinoPlace();
}
console.log(JSON.stringify(out));
