// [Timothy] PUMPFUN PIRATES: THE GATE JUNCTION (BANKSY 9:55 PM "improve this 4 way intersection"): the top end of the hill street, outside
// the town gate, where Main Street, trail A (the Pirates' Climb steps down to the jungle) and the HILLTOP FORT stair meet under the fort knoll.
// Pure dressing on top of Post's route (js/island/areas/route.js, untouched): built once, right after the 'route_low' area builds, and merged
// into that area's own meshes (no extra draw calls, culled with it). Nothing here is walkable or a collider, and every walk height stays the
// terrain / Post's stair decks: the flagstones sit 9 mm over the ground, the tread caps 9 mm over the decks, everything else is beside the paths.
//   - a flagstone junction pad (running-bond flags, conforming to the ground) from the gate arch to the fort stair foot and the steps' head
//   - dressed steps: a worn sandstone cap on every tread + a coping on both cheek walls (the first 45 m of the climb), lamps on the head copings
//   - a carved signpost over Post's (thicker post, stone collar, finial, pointed arms with a carved border) - same spot, same collider
//   - barrels / crate against the north gate tower, planters at the fort stair foot, mossy boulders + grass along the knoll's foot
//   Materials = the shared library (libTex.js), picked per piece. &gatejx=0 = off.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, M, box, cyl, hash, jitter, C } from './areas/common.js';
import { _route as RT, ROUTE } from './areas/route.js';
import { RB_ON } from './areas/index.js'; import { RB2 } from './areas/hillRound.js';   // [roundabout-bridge] no flags under the fountain plaza deck
import { Htri, trailDist } from './foot.js';   // the drawn terrain triangles (this module is loaded lazily, after foot.js)

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
export const GATEJX_ON = !(Q && Q.get('gatejx') === '0');
export const GATEJX = { pad: { x: -434.2, z: -84.0, rx: 4.7, rz: 10.4, xMin: -437.7 }, along: 45, stats: null };
const prism = (pts, d) => { const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g; };
const tint = (hex, k, seed) => { const c = new THREE.Color(hex), f = 1 + (hash(seed, 7.3) - 0.5) * 2 * k; return c.setRGB(Math.min(1, c.r * f), Math.min(1, c.g * f), Math.min(1, c.b * f)).getHex(); };

// a slab whose top follows the ground (4 corner heights + lift) with short skirts: one flagstone
function flag(x0, x1, z0, z1, H, lift) {
  const y = (x, z) => H(x, z) + lift, P = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => [x, y(x, z), z]), D = 0.07, pos = [];
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  quad(P[0], P[3], P[2], P[1]);   // top (counter-clockwise from above)
  for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; quad(a, b, [b[0], b[1] - D, b[2]], [a[0], a[1] - D, a[2]]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}

export function buildGateJunction({ MATS, OUT, low, H: Hb }, LIB) {
  const H = (x, z) => Math.max(Hb(x, z), Htri(x, z));   // never under the drawn ground
  GATEJX._H = H;
  if (!GATEJX_ON || !RT.ready || !RT.street) return null;
  const k = new Kit(), id = (n) => 20 + LIB.LIB_ID[n], add = (g, c, m, mat, o = false) => k.add(g, c, { m, mat: id(mat), outline: o });
  const P = GATEJX.pad, st = { flags: 0, caps: 0, rocks: 0, tufts: 0 };
  const inRB = (x, z) => RB_ON && x > RB2.plaza[0] - 0.3 && x < RB2.plaza[1] + 0.3 && z > RB2.plaza[2] - 0.3 && z < RB2.plaza[3] + 0.3;
  const inPad = (x, z, s = 1) => x > P.xMin && ((x - P.x) / (P.rx * s)) ** 2 + ((z - P.z) / (P.rz * s)) ** 2 < 1 && !inRB(x, z);
  // ---- the flagstone pad: running-bond courses across the junction (x strips), irregular rim
  { let x = P.xMin; for (let c = 0; x < P.x + P.rx; c++) { const w = 0.95 + hash(c, 1.7) * 0.5; let z = P.z - P.rz - hash(c, 2.1) * 0.8;
      for (let r = 0; z < P.z + P.rz; r++) { const l = 0.8 + hash(c, r + 3.3) * 0.7, cx = x + w / 2, cz = z + l / 2;
        const rim = 0.94 + hash(c * 3.1, r) * 0.12; if (inPad(cx, cz, rim)) { add(flag(x + 0.025, x + w - 0.025, z + 0.03, z + l - 0.03, H, 0.009), tint([0xb3a994, 0xa59e90, 0xbcae92, 0xa89f8e][(c + r * 3) % 4], 0.07, c * 31 + r), null, 'stone_trim'); st.flags++; }
        z += l; }
      x += w; } }
  { const S = 0.8, pos = []; for (let x = P.xMin; x < P.x + P.rx; x += S) for (let z = P.z - P.rz; z < P.z + P.rz; z += S) { if (!inPad(x + S / 2, z + S / 2, 0.98)) continue;   // dark grout bed under the joints
      const v = (a, b) => pos.push(a, H(a, b) + 0.004, b); v(x, z); v(x, z + S); v(x + S, z + S); v(x, z); v(x + S, z + S); v(x + S, z); }
    if (pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); k.add(g, 0x8a8174, { mat: 0, outline: false }); } }
  // ---- dressed steps on the first 45 m of the climb: a worn cap on each tread, copings on the cheek walls, lamps at the head
  const head = RT.stairs.filter(s => s.along < GATEJX.along);
  for (const s of head) { const n = s.prof.length, d = s.L / n;
    for (let j = 0; j < n; j++) { const u = (j + 0.5) / n, x = s.a[0] + (s.b[0] - s.a[0]) * u, z = s.a[1] + (s.b[1] - s.a[1]) * u, top = s.prof[j];
      add(box(ROUTE.hw * 2 + 0.06, 0.1, d - 0.07), tint(0xd6cfc0, 0.09, s.i * 17 + j), M(x, top - 0.041, z, s.yaw), 'stone_trim', j === 0); st.caps++; }
    for (const sd of [-1, 1]) { const x = s.x + s.uz * (ROUTE.hw + 0.25) * sd, z = s.z - s.ux * (ROUTE.hw + 0.25) * sd, top = Math.max(...s.prof) + 0.25;
      const nb = Math.max(1, Math.round((s.L + 0.22) / 1.1)), bl = (s.L + 0.22) / nb;   // coping in dressed blocks with joints
      for (let q = 0; q < nb; q++) { const f = (q + 0.5) * bl - (s.L + 0.22) / 2; add(box(0.74, 0.17, bl - 0.035), tint(0xcfc8bb, 0.07, s.i * 7 + q + sd), M(x + s.ux * f, top + 0.085, z + s.uz * f, s.yaw), 'stone_trim', q === 0); } } }
  if (head.length) { const s = head[0], dn = s.prof[0] > s.prof[s.prof.length - 1], ex = dn ? s.a : s.b, top = Math.max(...s.prof) + 0.25 + 0.16; // lamps on the copings at the head of the steps
    for (const sd of [-1, 1]) { const x = ex[0] + s.uz * (ROUTE.hw + 0.25) * sd + (dn ? 1 : -1) * s.ux * 0.4, z = ex[1] - s.ux * (ROUTE.hw + 0.25) * sd + (dn ? 1 : -1) * s.uz * 0.4;
      add(box(0.5, 0.3, 0.5), 0xbdb6a8, M(x, top + 0.15, z, s.yaw), 'stone_trim', true); add(cyl(0.07, 0.09, 2.1, 6), C.IRON, M(x, top + 1.35, z), 'iron');
      add(box(0.62, 0.07, 0.07), C.IRON, M(x, top + 2.35, z, s.yaw + Math.PI / 2), 'iron'); add(box(0.42, 0.5, 0.42), 0x2b2f36, M(x, top + 2.05, z), 'iron', true);
      k.add(box(0.32, 0.38, 0.44), 0xffd27a, { m: M(x, top + 2.05, z), outline: false, mat: 0 }); k.add(box(0.44, 0.38, 0.32), 0xffd27a, { m: M(x, top + 2.05, z), outline: false, mat: 0 });
      add(cyl(0.02, 0.34, 0.26, 4), C.IRON, M(x, top + 2.43, z, Math.PI / 4), 'iron'); } }
  // ---- the carved signpost (envelops Post's post + boards at the same spot / heights / yaws)
  { const s = RT.lm.sign; if (s) { add(box(0.62, 0.36, 0.62), 0xb9b2a6, M(s.x, s.y + 0.1, s.z, s.yaw), 'stone_ashlar', true); add(box(0.7, 0.08, 0.7), 0xcfc8bb, M(s.x, s.y + 0.31, s.z, s.yaw), 'stone_trim');
    add(box(0.3, 3.0, 0.3), 0x5e3b20, M(s.x, s.y + 1.75, s.z, s.yaw), 'timber', true); add(box(0.42, 0.1, 0.42), 0x3b2414, M(s.x, s.y + 3.28, s.z, s.yaw), 'timber');
    add(new THREE.OctahedronGeometry(0.16, 0), 0xd9a36b, M(s.x, s.y + 3.5, s.z, s.yaw), 'timber', true);
    [Math.PI, Math.PI / 2, 0].forEach((a, i) => { const y = s.y + 2.4 - i * 0.45, yw = s.yaw + a + Math.PI / 2, cw = [0xd9a36b, 0xc98a4c, 0xe7c08d][i];
      k.at(M(s.x, y, s.z, yw), () => { add(box(1.72, 0.42, 0.12), cw, M(0, 0, 0), 'timber', true); add(prism([[0, 0.21], [0.3, 0], [0, -0.21]], 0.12), cw, M(0.86, 0, 0), 'timber', true);
        for (const f of [-1, 1]) { const zz = f * 0.066; add(box(1.56, 0.035, 0.012), 0x3b2414, M(0, 0.15, zz), 'timber'); add(box(1.56, 0.035, 0.012), 0x3b2414, M(0, -0.15, zz), 'timber');   // carved border
          add(box(0.035, 0.3, 0.012), 0x3b2414, M(-0.78, 0, zz), 'timber'); add(box(1.3, 0.2, 0.008), tint(cw, 0.1, i + 4) & 0xdddddd, M(0.02, 0, zz), 'timber'); } }); }); } }   // + a sunk name panel
  // ---- props against the north gate tower + planters at the fort stair foot
  { const bx = -436.95; [[bx, -76.7, 0], [bx, -75.9, 1], [bx - 0.05, -75.1, 2]].forEach(([x, z, i]) => { const y = H(x, z); k.at(M(x, y, z, i * 1.3), () => {
      add(cyl(0.34, 0.3, 0.9, 10), [0xa86a3a, 0x9a5f33, 0xb07440][i], M(0, 0.45, 0), 'timber', true); for (const hy of [0.16, 0.74]) add(cyl(0.355, 0.33, 0.06, 10), 0x2b2f36, M(0, hy, 0), 'iron'); }); });
    { const x = -436.9, z = -77.7, y = H(x, z); add(box(0.8, 0.8, 0.8), 0xc98a4c, M(x, y + 0.4, z, 0.2), 'planks_weathered', true); for (const e of [-1, 1]) add(box(0.84, 0.1, 0.1), 0x6b4527, M(x, y + 0.4 + e * 0.33, z, 0.2), 'timber'); }
    for (const x of [-437.1, -430.9]) { const z = -73.4, y = H(x, z); add(box(1.1, 0.6, 1.1), 0xa9a294, M(x, y + 0.3, z), 'stone_ashlar', true); add(box(1.24, 0.1, 1.24), 0xcfc8bb, M(x, y + 0.64, z), 'stone_trim');
      add(box(0.9, 0.1, 0.9), 0x5a3a22, M(x, y + 0.66, z), 'timber'); for (let i = 0; i < 5; i++) { const a = i * 1.26; k.add(new THREE.IcosahedronGeometry(0.22 + hash(i, x) * 0.1, 0), [C.RED, 0xffc93c, 0x5f9a3a, 0x4e8a34, 0xf4efe6][i], { m: M(x + Math.cos(a) * 0.28, y + 0.85, z + Math.sin(a) * 0.28, a), outline: false, mat: 0 }); } } }
  // ---- the knoll's foot: mossy boulders where the ground turns steep (never on a path), grass tufts round the pad rim
  const pathD = (x, z) => { let d = 1e9; for (let i = 1; i < RT.pts.length && RT.acc[i - 1] < 90; i++) { const [ax, az] = RT.pts[i - 1], [bx, bz] = RT.pts[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t)); }
    if (x > -437.5 && x < -430.5 && z > -75 && z < -40) d = 0; if (x < -437.5) d = 0; return Math.min(d, trailDist(x, z) + 1.0); };   // + the fort stair corridor, + inside the town
  const slope = (x, z) => Math.hypot(H(x + 0.5, z) - H(x - 0.5, z), H(x, z + 0.5) - H(x, z - 0.5)), y0 = H(P.x, P.z);
  for (let x = -432; x <= -408; x += 1.6) for (let z = -80; z <= -56; z += 1.6) { const jx = x + (hash(x, z) - 0.5), jz = z + (hash(z, x) - 0.5), y = H(jx, jz);
    if (st.rocks >= (low ? 16 : 30) || slope(jx, jz) < 0.28 || slope(jx, jz) > 0.8 || y - y0 < -1.2 || y - y0 > 1.8 || pathD(jx, jz) < 3.4 || hash(jx * 1.7, jz) > 0.62) continue;
    const r = 0.5 + hash(jz, jx * 2.3) * 0.75; add(jitter(new THREE.IcosahedronGeometry(r, 0), 0.22, jx + jz), tint(0x9e978a, 0.08, jx * jz), M(jx, y + r * 0.1, jz, jx, 0, 0, [1.3, 0.75, 1.15]), 'stone_trim', true);
    k.add(jitter(new THREE.IcosahedronGeometry(r * 0.8, 0), 0.25, jz), tint(0x5f9a3a, 0.08, jx), { m: M(jx - 0.05, y + r * 0.45, jz + 0.04, jz, 0, 0, [1.3, 0.4, 1.15]), outline: false, mat: 0 }); st.rocks++; }
  // the knoll face: a dressed-stone skin over the steep ground (8 cm proud of the drawn terrain), mossy where it eases into the grass, so the
  // rock-to-grass seam becomes moss on stone; one triplanar library layer (stone_ashlar) across it, ground-hugging like the terrain itself
  { const S = 0.75, pos = [], col = [], cA = new THREE.Color(0xc4bcae), cM = new THREE.Color(0x5f8a3a), cG = new THREE.Color(0x6fb84a), cc = new THREE.Color(), sl = (x, z) => Math.hypot(H(x + 0.6, z) - H(x - 0.6, z), H(x, z + 0.6) - H(x, z - 0.6)) / 1.2;
    const vtx = (x, z) => { const s1 = sl(x, z), t = Math.min(1, Math.max(0, (s1 - 0.5) / 0.4)), g0 = Math.min(1, Math.max(0, (s1 - 0.3) / 0.2)), n = 0.92 + hash(Math.round(x * 2), Math.round(z * 2)) * 0.14; cc.copy(cG).lerp(cM, g0).lerp(cA, t * t * (3 - 2 * t)).multiplyScalar(n); pos.push(x, H(x, z) + 0.08, z); col.push(cc.r, cc.g, cc.b); };
    for (let x = -432; x < -406; x += S) for (let z = -78; z < -50; z += S) { const s0 = sl(x + S / 2, z + S / 2); if (s0 < 0.3 || pathD(x + S / 2, z + S / 2) < 2.6) continue;
      vtx(x, z); vtx(x, z + S); vtx(x + S, z + S); vtx(x, z); vtx(x + S, z + S); vtx(x + S, z); }
    if (pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); const C3 = col;
      k.add(g, (p, i) => (Math.round(C3[i * 3] * 255) << 16) | (Math.round(C3[i * 3 + 1] * 255) << 8) | Math.round(C3[i * 3 + 2] * 255), { mat: id('stone_ashlar'), outline: false }); st.skin = pos.length / 9; } }
  const tuft = (x, z, seed) => { const y = H(x, z); for (let b = 0; b < 5; b++) { const a = b * 1.256 + seed, h = 0.32 + hash(seed, b) * 0.28;
    k.add(new THREE.ConeGeometry(0.045, h, 3), [0x5f9a3a, 0x6fae45, 0x4e8a34][b % 3], { m: M(x + Math.cos(a) * 0.1, y + h / 2 - 0.03, z + Math.sin(a) * 0.1, a, Math.cos(a) * 0.35, Math.sin(a) * 0.35), outline: false, mat: 0 }); } st.tufts++; };
  for (let i = 0, n = low ? 26 : 64; i < n; i++) { const a = (i / n) * Math.PI * 2 + hash(i, 5) * 0.2, s = 1.06 + hash(i, 9) * 0.3, x = P.x + Math.cos(a) * P.rx * s, z = P.z + Math.sin(a) * P.rz * s;
    if (x < P.xMin + 0.4 || pathD(x, z) < 2.8) continue; tuft(x, z, i); }
  for (let x = -432; x <= -410; x += 2.2) for (let z = -80; z <= -56; z += 2.2) { const jx = x + hash(x, z * 1.3) * 1.4, jz = z + hash(z, x * 1.1) * 1.4; if (low && hash(jx, jz) > 0.5) continue;
    if (slope(jx, jz) > 0.3 && pathD(jx, jz) > 3.0 && H(jx, jz) - y0 < 4 && hash(jz, jx) < 0.5) tuft(jx, jz, jx); }
  GATEJX.stats = st; return k.build(MATS, OUT);
}

// merge the dressing into the area's own toon / outline meshes (same materials -> no extra draw calls); falls back to adding the group
const inRBp = (x, z) => RB_ON && x > RB2.plaza[0] - 0.8 && x < RB2.plaza[1] + 0.8 && z > RB2.plaza[2] - 0.8 && z < RB2.plaza[3] + 0.8;   // [roundabout-bridge] + Post's edging under the plaza deck
export function mergeInto(near, grp) {
  if (!near || !grp) return 0; let merged = 0;
  const own = []; near.traverse(o => { if (o.isMesh) own.push(o); });
  // Post's loose edging stones (route.js: every 2.5 m, 2.75 m either side of the trail) that land on the new flagstone pad: folded away
  // (degenerate triangles; nothing else is touched) - the pad's rim is the edge now
  { const P = GATEJX.pad, cs = [], Hs = GATEJX._H; for (let a = 1; a < 60; a += 0.5) { let i = 1; while (i < RT.pts.length - 1 && RT.acc[i] < a) i++; const A = RT.pts[i - 1], B = RT.pts[i], L = RT.acc[i] - RT.acc[i - 1] || 1, t = (a - RT.acc[i - 1]) / L,
      x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t, ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L;
      for (const sd of [-1, 1]) { const cx = x + uz * 2.75 * sd, cz = z - ux * 2.75 * sd; if ((cx > P.xMin - 0.6 && ((cx - P.x) / P.rx) ** 2 + ((cz - P.z) / P.rz) ** 2 < 1.1) || inRBp(cx, cz)) cs.push([cx, cz]); } }
    let hid = 0; if (cs.length && Hs) for (const o of own) { const Pa = o.geometry.attributes.position; if (!Pa || o.geometry.index) continue; let ch = false;
      for (let t = 0; t + 2 < Pa.count; t += 3) { const x = (Pa.getX(t) + Pa.getX(t + 1) + Pa.getX(t + 2)) / 3, y = (Pa.getY(t) + Pa.getY(t + 1) + Pa.getY(t + 2)) / 3, z = (Pa.getZ(t) + Pa.getZ(t + 1) + Pa.getZ(t + 2)) / 3;
        if (!cs.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 0.72) || y - Hs(x, z) > 0.75 || y - Hs(x, z) < -0.5) continue;
        if (Math.max(Pa.getY(t), Pa.getY(t + 1), Pa.getY(t + 2)) - Hs(x, z) > 0.8) continue;   // never a tread / wall / post (they rise higher)
        for (let q = 1; q < 3; q++) Pa.setXYZ(t + q, Pa.getX(t), Pa.getY(t), Pa.getZ(t)); ch = true; hid++; }
      if (ch) Pa.needsUpdate = true; }
    GATEJX.hidden = hid; }
  for (const m of [...grp.children]) { const t = own.find(o => o.name === m.name && o.material === m.material);
    const same = t && Object.keys(t.geometry.attributes).sort().join() === Object.keys(m.geometry.attributes).sort().join();
    if (same) { const g = mergeGeometries([t.geometry, m.geometry], false); if (g) { g.computeBoundingSphere(); t.geometry.dispose(); t.geometry = g; m.geometry.dispose(); merged++; continue; } }
    near.add(m); }
  return merged;
}
