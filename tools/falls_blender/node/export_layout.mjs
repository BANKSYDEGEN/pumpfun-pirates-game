// [Timothy falls-blender] runs foot.js + hillRound.js in node (no browser) and writes assets/island/falls_layout.json: the input of
// tools/falls_blender/falls_blender.py and the runtime match check (js/island/fallsBlender.js). Three sections, each its own GLB node:
//   d3   the FISHING BRIDGE (foot.js BRIDGE: trail A's rope bridge over the river gorge at x 16, D3): deck curve, deck ends, the tower /
//        bollard spots the old kit stood on (their colliders stay), the approach width (areas/ropeBridge.js RB)
//   hb   the long HIGH ROPE BRIDGE (areas/hillRound.js HB: plaza -> waterfall plateau): deck curve, piers, both deck ends
//   area the WATERFALL: cliff ledges + buttresses round the falls, the old pool boulders (same spots), a mossy basin rim, shore pebbles,
//        reeds + planting, trail lanterns. Every ground-sitting piece records the ground it was baked on (hchk): the runtime keeps the
//        old look for a section whose ground moved (build mode) until it is re-baked.
//   cd tools/falls_blender/node && node --import ../../roundabout_blender/node/reg.mjs export_layout.mjs
import { writeFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url).href;
const F = await import(root + 'js/island/foot.js');
const HR = await import(root + 'js/island/areas/hillRound.js');
const RBm = await import(root + 'js/island/areas/ropeBridge.js');
const R = new Proxy({}, { get: () => [0, 0, 1, 1] }); for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, true, []);
const { H, LAKE } = F, r4 = (v) => +(+v).toFixed(4), r2 = (v) => +(+v).toFixed(2);
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
// ---- d3: the fishing bridge
const B = F.BRIDGE, d3 = { ax: r4(B.ax), az: r4(B.az), bx: r4(B.bx), bz: r4(B.bz), L: r4(B.L), yaw: r4(B.yaw), deckY: r4(B.deckY), sag: r4(B.sag), half: B.half, apHw: RBm.RB.hw, ends: [] };
const hchk = { d3: [], hb: [], area: [] };
{ const cs = Math.cos(B.yaw), sn = Math.sin(B.yaw);
  for (const [x, z, dir] of [[B.ax, B.az, -1], [B.bx, B.bz, 1]]) { const tx = x + sn * dir * 1.2, tz = z + cs * dir * 1.2, ty = H(tx, tz), posts = [], backs = [];
    for (const s of [-1, 1]) { const px = tx + cs * s * 1.85, pz = tz - sn * s * 1.85; posts.push([r4(px), r4(H(px, pz)), r4(pz)]); hchk.d3.push([r4(px), r4(pz), r4(H(px, pz))]);
      const bx = tx + cs * s * 1.9 + sn * dir * 4, bz = tz - sn * s * 1.9 + cs * dir * 4; backs.push([r4(bx), r4(H(bx, bz)), r4(bz)]); hchk.d3.push([r4(bx), r4(bz), r4(H(bx, bz))]); }
    // the ground under the abutment (sill -> the approach steps start 1 m past the deck end)
    const foot = []; for (const u of [0.5, 1.5, 2.5]) for (const s of [-1.9, 0, 1.9]) { const fx = x + sn * dir * u + cs * s, fz = z + cs * dir * u - sn * s; foot.push([r4(fx), r4(H(fx, fz)), r4(fz)]); hchk.d3.push([r4(fx), r4(fz), r4(H(fx, fz))]); }
    d3.ends.push({ x: r4(x), z: r4(z), dir, tx: r4(tx), ty: r4(ty), tz: r4(tz), lamp: [r4(tx), r4(ty + 4.6), r4(tz)], posts, backs, foot }); hchk.d3.push([r4(tx), r4(tz), r4(ty)]); } }
// ---- hb: the long high rope bridge
const hb0 = HR._hb, hb = { ax: r4(hb0.ax), az: r4(hb0.az), bx: r4(hb0.bx), bz: r4(hb0.bz), L: r4(hb0.L), yaw: r4(hb0.yaw), ya: r4(hb0.ya), yb: r4(hb0.yb), half: hb0.half, sag: hb0.sag, piers: hb0.piers, plateau: [] };
{ const ux = (hb0.bx - hb0.ax) / hb0.L, uz = (hb0.bz - hb0.az) / hb0.L;   // the plateau end: ground under the landing sill + the flared wing walls
  for (const u of [0.3, 1.0, 1.8, 2.6, 3.4]) for (const s of [-4.4, -3.4, -2.4, -1.2, 0, 1.2, 2.4, 3.4, 4.4]) { const x = hb0.bx + ux * u + uz * s, z = hb0.bz + uz * u - ux * s; hb.plateau.push([r2(u), r2(s), r4(H(x, z))]); hchk.hb.push([r4(x), r4(z), r4(H(x, z))]); } }
// ---- area: the waterfall + basin
const fp = F.FOOT_POIS.find(p => p.id === 'falls'), FX = fp.x, FZ = fp.z;   // the falls sheet's foot (-206, -186)
const area = { fx: FX, fz: FZ, lake: LAKE, pieces: [] }; const P = area.pieces;
const put = (k, x, z, s, extra = {}) => { const gY = H(x, z), y = extra.yOverride != null ? extra.yOverride : gY; const { yOverride, ...rest } = extra; P.push({ k, x: r4(x), y: r4(y), z: r4(z), s: r4(s), seed: P.length, ...rest }); hchk.area.push([r4(x), r4(z), r4(gY)]); }; // hchk always stores ground (yOverride pieces still validate against terrain)
const GROT = { x0: -214, x1: -198, z0: -199, z1: -188 }, inGrotto = (x, z) => x > GROT.x0 - 2 && x < GROT.x1 + 2 && z > GROT.z0 - 2 && z < GROT.z1 + 3;
const sheet = (x, z) => Math.abs(x - FX) < 7.5 && z < FZ + 8;                       // the water sheet + its plunge: kept clear
const lakeD = (x, z) => Math.hypot(x - LAKE.x, z - LAKE.z), ENTRY = [-258, -158], DOCK = { x: -205, z0: -63, z1: -97 }, GILL = [-199.5, -61.5];
const TP = [...F.TRAILS.A, ...F.TRAILS.B], tDist = (x, z) => { let d = 1e9; for (const [a, b] of TP) d = Math.min(d, (a - x) ** 2 + (b - z) ** 2); return Math.sqrt(d); };
const slope = (x, z) => Math.hypot(H(x + 1, z) - H(x - 1, z), H(x, z + 1) - H(x, z - 1)) / 2, aspect = (x, z) => Math.atan2(H(x + 1, z) - H(x - 1, z), H(x, z + 1) - H(x, z - 1));
// 1. cliff ledges: strata slabs on the falls cliff (x -244..-168, z -232..-172), lying along the contour, on the steep faces only
for (let i = 0; i < 420 && P.filter(p => p.k === 'ledge').length < 70; i++) { const x = -244 + hash(i, 1) * 76, z = -232 + hash(i, 2) * 60, y = H(x, z), sl = slope(x, z);
  if (sl < 0.55 || y < LAKE.y + 2 || y > 74 || sheet(x, z) || inGrotto(x, z) || lakeD(x, z) < LAKE.r - 1) continue;
  if (P.some(p => p.k === 'ledge' && Math.hypot(p.x - x, p.z - z) < 4.2)) continue;
  put('ledge', x, z, 2.2 + hash(i, 3) * 3.2, { yaw: r4(aspect(x, z) + Math.PI / 2), sl: r2(sl) }); }
// 2. two buttress rock stacks framing the falls + the old pool boulders (foot.js KPG 'falls': same spots and sizes, sculpted)
for (const s of [-1, 1]) put('buttress', FX + s * 9.5, FZ - 4, 4.2, { side: s });
for (let i = 0; i < 10; i++) { const a = Math.PI * 1.1 + i * 0.13, x = LAKE.x + Math.cos(a) * (LAKE.r + 2), z = LAKE.z + Math.sin(a) * (LAKE.r + 2); put('boulder', x, z, 1.6 + hash(i, 2) * 2.2, { old: 1 }); }
for (const s of [-1, 1]) put('boulder', FX + s * 7, FZ - 3, 3.2, { old: 1 });
// 3. the mossy basin rim: rim stones round the lake edge (r ~ 59), clear of the dock, the stepping-stone entry and the falls plunge
const dockClear = (x, z) => Math.abs(x - DOCK.x) < 6 && z > DOCK.z1 - 4, entryClear = (x, z) => Math.hypot(x - ENTRY[0], z - ENTRY[1]) < 7;
for (let i = 0, n = 120; i < n; i++) { const a = (i + hash(i, 4) * 0.6) / n * Math.PI * 2, r = LAKE.r + 0.8 + hash(i, 5) * 1.6, x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r, y = H(x, z);
  if (y > LAKE.y + 4.5 || y < LAKE.y - 1.5 || tDist(x, z) < 4 || dockClear(x, z) || entryClear(x, z) || sheet(x, z)) continue; put('rim', x, z, 0.55 + hash(i, 6) * 0.6, { yaw: r4(a) }); }
// 4. shore pebbles + gravel (desktop only: lod 0)
for (let i = 0; i < 700 && P.filter(p => p.k === 'pebble').length < 260; i++) { const a = hash(i, 7) * Math.PI * 2, r = LAKE.r - 1.5 + hash(i, 8) * 6.5, x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r, y = H(x, z);
  if (y > LAKE.y + 3 || y < LAKE.y - 0.6 || dockClear(x, z) || sheet(x, z)) continue; put('pebble', x, z, 0.12 + hash(i, 9) * 0.22, { lod: 0 }); }
// 5. reeds + cattails in the shallows, ferns / bushes / flowers on the rim and the cliff ledges
for (let i = 0; i < 400 && P.filter(p => p.k === 'reeds').length < 46; i++) { const a = hash(i, 10) * Math.PI * 2, r = LAKE.r - 3 + hash(i, 11) * 4, x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r, y = H(x, z);
  if (y > LAKE.y + 1.2 || y < LAKE.y - 1.6 || dockClear(x, z) || entryClear(x, z) || sheet(x, z)) continue; put('reeds', x, z, 0.8 + hash(i, 12) * 0.6); }
for (let i = 0; i < 900 && P.filter(p => p.k === 'plant').length < 150; i++) { const onCliff = i % 3 === 0;
  const [x, z] = onCliff ? [-244 + hash(i, 13) * 76, -232 + hash(i, 14) * 60] : (() => { const a = hash(i, 15) * Math.PI * 2, r = LAKE.r + 2 + hash(i, 16) * 12; return [LAKE.x + Math.cos(a) * r, LAKE.z + Math.sin(a) * r]; })();
  const y = H(x, z); if (y < LAKE.y + 0.4 || y > 74 || sheet(x, z) || inGrotto(x, z) || dockClear(x, z) || entryClear(x, z) || lakeD(x, z) < LAKE.r + 1) continue;
  if (!onCliff && (y > LAKE.y + 9 || tDist(x, z) < 5)) continue;
  put('plant', x, z, 0.6 + hash(i, 17) * 0.8, { v: Math.floor(hash(i, 18) * 4), lod: i % 2 ? 0 : 1 }); }
// 6. lanterns on the trail: the plateau landing -> trail A round the lagoon's south shore (lake side, 3.6 m out: past the kerbs)
{ const A = F.TRAILS.A; let acc = 0, n = 0;
  for (let i = 1; i < A.length; i++) { const [x, z] = A[i], [px, pz] = A[i - 1]; if (x < -282 || x > -120 || z > -30 || z < -80) { acc = 0; continue; } acc += Math.hypot(x - px, z - pz);   // (the south-shore leg only)
    if (acc < 24) continue; const dx = x - px, dz = z - pz, l = Math.hypot(dx, dz) || 1;
    const side = [1, -1].find(sd => { const qx = x - sd * dz / l * 3.6, qz = z + sd * dx / l * 3.6; return Math.abs(H(qx, qz) - H(x, z)) < 1.0 && Math.abs(qx - DOCK.x) > 7 && tDist(qx, qz) > 3.3; });   // lake side first, else the other
    if (!side) continue; const lx = x - side * dz / l * 3.6, lz = z + side * dx / l * 3.6; acc = 0; put('lantern', lx, lz, 1, { yaw: r4(Math.atan2(dx, dz)), lit: n++ % 2 }); }
  for (const s of [-1, 1]) put('lantern', DOCK.x + s * 2.6, DOCK.z0 + 3.5, 1, { yaw: 0, lit: 1 }); }   // the dock head

// ---- [waterfall-aaa] AAA corridor extras: belvedere, angler pier/pavilion, overlook, summit terrace, grotto vault ----
{ const HB = HR._hb;
  // east landing belvedere: bollards + winch + lanterns + signpost (ground-checked)
  for (const [u, s, kind] of [[0.8, -3.2, 'bollard'], [0.8, 3.2, 'bollard'], [2.4, 0, 'sign'], [1.6, -2.0, 'lantern'], [1.6, 2.0, 'lantern'], [0.4, 0, 'winch']]) {
    const ux = (HB.bx - HB.ax) / HB.L, uz = (HB.bz - HB.az) / HB.L;
    const x = HB.bx + ux * u + uz * s, z = HB.bz + uz * u - ux * s;
    put(kind === 'lantern' ? 'lantern' : 'belvedere_' + kind, x, z, kind === 'sign' ? 1.2 : 1, { yaw: r4(HB.yaw), aaa: 1 });
  }
}
// angler pier props around dock (pilings already in lagoon kit; Blender adds pavilion shell + skiff + shore abutment stones)
{ const DOCKY = H(DOCK.x, DOCK.z0);
  put('pavilion', GILL[0] + 0.4, GILL[1] - 2.8, 1, { yaw: 0, aaa: 1 });
  put('abutment', DOCK.x, DOCK.z0 + 1.6, 1, { yaw: 0, aaa: 1, yOverride: r4(DOCKY) });
  put('skiff', DOCK.x - 3.6, DOCK.z1 + 6, 1, { yaw: 0.2, aaa: 1, yOverride: r4(LAKE.y) });
  for (const s of [-1, 1]) put('lantern', DOCK.x + s * 3.1, DOCK.z0 + 2.0, 1, { yaw: 0, lit: 1, aaa: 1 });
  // mossy shore boulders flanking the abutment (clear of the path centre)
  for (let i = 0; i < 6; i++) { const s = i < 3 ? -1 : 1, x = DOCK.x + s * (4.2 + (i % 3) * 1.1), z = DOCK.z0 + 0.5 + (i % 3) * 1.4;
    if (Math.abs(x - DOCK.x) < 3) continue; put('boulder', x, z, 1.1 + hash(i, 21) * 0.8, { aaa: 1 }); }
}
// mid-falls overlook deck framing
{ const ox = -168, oz = -198; put('overlook', ox, oz, 1, { yaw: -0.55, aaa: 1 });
  for (const s of [-1, 1]) put('lantern', ox + s * 2.2, oz + 1.5, 1, { yaw: -0.55, lit: 1, aaa: 1 }); }
// summit terrace between zipline stands
{ const sx = -188, sz = -239.5;
  put('summit', sx, sz, 1, { yaw: 0, aaa: 1 });
  put('brazier', -188, -232, 1, { aaa: 1 }); put('brazier', -188, -247, 1, { aaa: 1 });
  put('sign', -188, -239.5, 1.1, { yaw: 0, aaa: 1, label: 'ZIP' });
  for (const s of [-1, 1]) put('lantern', sx + s * 4.5, sz, 1, { yaw: 0, lit: 1, aaa: 1 }); }
// grotto vault accents (stalactites / skull relief / lanterns) — floor stays at GROTTO.y = 21
{ const gx = -206, gz = -196.5, gy = 21.0;
  for (let i = 0; i < 5; i++) put('stalactite', gx - 4 + i * 2.0, gz - 1.5 + hash(i, 30), 0.8 + hash(i, 31) * 0.6, { aaa: 1, yOverride: r4(gy + 5.5) });
  put('skull_relief', gx, gz - 2.5, 1.4, { aaa: 1, yOverride: r4(gy + 2.2) });
  put('lantern', gx + 3.6, gz + 0.5, 1, { yaw: 0, lit: 1, aaa: 1 });
  put('lantern', gx - 3.6, gz + 0.5, 1, { yaw: 0, lit: 1, aaa: 1 }); }

const k = {}; for (const p of P) k[p.k] = (k[p.k] || 0) + 1;
writeFileSync(new URL('../../../assets/island/falls_layout.json', import.meta.url), JSON.stringify({ note: 'tools/falls_blender/node/export_layout.mjs -> falls_blender.py -> falls(_low).glb; js/island/fallsBlender.js swaps the kit only while this matches the build', d3, hb, area, hchk }) + '\n');
console.log(JSON.stringify({ d3: d3.ends.map(e => [e.tx, e.ty, e.tz]), hb: [hb.ax, hb.bx, hb.yb], area: k, hchk: Object.fromEntries(Object.entries(hchk).map(([a, b]) => [a, b.length])) }));
