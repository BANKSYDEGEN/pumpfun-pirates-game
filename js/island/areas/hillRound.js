// [path-fix2] THE FOUNTAIN ROUNDABOUT + THE HIGH ROPE BRIDGE (BANKSY 10:47-11:22 AM: "rework this path/area, add a bridge ..." / "I don't want
// that dip from the hill road to the waterfall" / "Or can do a rope bridge" / "So players below can walk under and get to beach still" /
// "coming out of the hill street will be a water fountain area roundabout that goes right to the castle, left down the hill or straight
// across rope bridge to waterfalls plateau").
//   - the roundabout: a flat stone terrace just outside the town gate (the hill street's top end), retaining walls where the hill falls away,
//     a round paved ring with kerbs, a stone fountain in the middle (collider: you walk round it), 4 lamps, 2 benches. Exits: the gate (hill
//     street), the castle (north, past the gate pad to the fort stair), down the hill (south: the Pirates' Climb steps), the bridge (east)
//   - the high rope bridge: terrace (y ~19.9) -> the waterfalls plateau above the old cliff dead-end (y ~25), 3 spans on 2 stone piers, a gentle
//     even grade (no dip: sag 0.5 m a span). Walkable ONLY for whoever is up at deck height (foot.js HIGH_BRIDGES + setLayer): the valley trail
//     below keeps 10+ m of headroom and still runs to the beach. D3's gorge bridge is untouched.
import * as THREE from 'three';
import { Kit, M, box, cyl, hash, W, C } from './common.js';

export const RB2 = { c: [-425, -93], r: 7.6, y: 19.9, pad: [-433.5, -416.5, -101.5, -84.5], end: [-282, -72], half: 1.35, sag: 0.5, piers: [1 / 3, 2 / 3] };
const [CX, CZ] = RB2.c, PV = 0xcfc6b4, PV_D = 0xb3a993, KERB = 0x8a837a, WATER = 0x3f9fd6;
const HB = { ax: RB2.pad[1] - 0.2, az: CZ, bx: 0, bz: 0, L: 0, yaw: 0, ya: RB2.y, yb: RB2.y, half: RB2.half, sag: RB2.sag, piers: RB2.piers, yAt: null };
HB.yAt = (u) => { u = Math.min(1, Math.max(0, u)); const P = [0, ...HB.piers, 1]; let k = 0; while (k < P.length - 2 && u > P[k + 1]) k++;
  const f = (u - P[k]) / (P[k + 1] - P[k]); return HB.ya + (HB.yb - HB.ya) * u - Math.sin(f * Math.PI) * HB.sag; };
export const _hb = HB;

export default {
  id: 'hill_round', name: 'Fountain roundabout + high rope bridge', rect: [-436, -278, -104, -60],
  terrain: { pads: [[...RB2.pad, RB2.y]], cuts: [], paths: [] },
  register(h) {
    const { H } = h;
    // the plateau end: walk in from the target until the ground stops rising (the cliff top), deck end = that ground
    { const [ex, ez] = RB2.end; let bx = ex, bz = ez; const ux = HB.ax - ex, uz = HB.az - ez, n = Math.hypot(ux, uz);
      for (let s = 0; s < 20; s += 0.5) { const x = ex + ux / n * s, z = ez + uz / n * s; if (H(x, z) < H(ex, ez) - 0.6) break; bx = x; bz = z; }
      Object.assign(HB, { bx, bz, yb: H(bx, bz), L: Math.hypot(bx - HB.ax, bz - HB.az), yaw: Math.atan2(bx - HB.ax, bz - HB.az) }); }
    h.addHighBridge?.(HB);
    h.poi('hill_round', 'Fountain roundabout', CX, CZ, { clear: 12 });
    h.poi('high_bridge', 'High rope bridge to the waterfalls plateau', (HB.ax + HB.bx) / 2, (HB.az + HB.bz) / 2, { clear: 8 });
    h.addCirc(CX, CZ, 2.5);                                                        // the fountain basin
    for (const [x, z] of lampsXZ()) h.addCirc(x, z, 0.3);
    for (const b of benches()) h.addBox(b.x, b.z, 1.9, 0.6, b.yaw);
    for (const t of HB.piers) { const [x, z] = along(t); h.addCirc(x, z, 1.9); }  // stone piers: solid down in the valley, the deck walks over them
  },
  build({ MATS, OUT, low, H }) {
    const k = new Kit(), near = new THREE.Group(), far = new THREE.Group(); near.name = 'area_hill_round'; far.name = 'area_hill_round_far';
    const Y = RB2.y, [x0, x1, z0, z1] = RB2.pad;
    // terrace: retaining walls on the 4 edges (they run 16 m down: the cut ground hides under them), coping + parapet where it drops
    const side = (ax, az, bx, bz, nx, nz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2.2), yaw = Math.atan2(bx - ax, bz - az);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, g = H(x + nx * 1.5, z + nz * 1.5), drop = Y - g;
        if (drop < 0.4) continue;
        W(k, box(0.9, drop + 1.2, L / n + 0.02), i % 2 ? C.STONE : 0xa9a196, M(x + nx * 0.45, Y - (drop + 1.2) / 2 + 0.05, z + nz * 0.45, yaw), true);
        for (let r = 1; r < Math.min(8, drop); r += 1.1) W(k, box(0.92, 0.06, L / n), C.STONE_D, M(x + nx * 0.46, Y - r, z + nz * 0.46, yaw), false);
        if (!gapAt(x, z)) W(k, box(0.7, 0.55, L / n + 0.02), C.STONE_D, M(x + nx * 0.35, Y + 0.27, z + nz * 0.35, yaw)); } };
    side(x1, z0, x1, z1, 1, 0); side(x0, z0, x1, z0, 0, -1); side(x0, z1, x1, z1, 0, 1); side(x0, z0, x0, z1, -1, 0);
    // paving: outer ring + inner disc, radial joints, kerb ring with gaps at the 4 exits
    W(k, new THREE.CylinderGeometry(RB2.r, RB2.r, 0.08, 40), PV, M(CX, Y + 0.03, CZ), false);
    W(k, new THREE.CylinderGeometry(RB2.r - 2.6, RB2.r - 2.6, 0.09, 36), PV_D, M(CX, Y + 0.035, CZ), false);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, rr = RB2.r - 1.3; W(k, box(0.05, 0.1, 2.5), 0x9c937f, M(CX + Math.sin(a) * rr, Y + 0.04, CZ + Math.cos(a) * rr, a), false); }
    for (let i = 0; i < 40; i++) { const a = (i + 0.5) / 40 * Math.PI * 2, x = CX + Math.sin(a) * (RB2.r + 0.1), z = CZ + Math.cos(a) * (RB2.r + 0.1); if (gapAt(x, z, 2.2)) continue;
      W(k, box(0.35, 0.22, 1.2), KERB, M(x, Y + 0.1, z, a + Math.PI / 2), false); }
    // the fountain: octagonal basin, rim, pedestal, upper bowl, finial (water + jets are their own meshes below: animated)
    W(k, new THREE.CylinderGeometry(2.45, 2.6, 0.75, 8), C.STONE, M(CX, Y + 0.37, CZ, Math.PI / 8));
    W(k, new THREE.CylinderGeometry(2.6, 2.6, 0.14, 8), PV_D, M(CX, Y + 0.78, CZ, Math.PI / 8), false);
    W(k, cyl(0.38, 0.55, 1.9, 8), C.STONE, M(CX, Y + 1.3, CZ)); W(k, cyl(1.15, 0.45, 0.4, 12), C.STONE, M(CX, Y + 2.35, CZ));
    W(k, cyl(0.16, 0.25, 0.7, 8), C.STONE_D, M(CX, Y + 2.85, CZ)); W(k, new THREE.SphereGeometry(0.24, 10, 8), C.GOLD, M(CX, Y + 3.3, CZ), false);
    // lamps + benches (the plaza's iron lamp post: post, arm, glowing lantern)
    for (const [x, z] of lampsXZ()) { W(k, cyl(0.08, 0.11, 3.4, 6), C.IRON, M(x, Y + 1.7, z)); W(k, box(0.45, 0.55, 0.45), 0xffd27a, M(x, Y + 3.55, z), false); W(k, box(0.6, 0.08, 0.6), C.IRON, M(x, Y + 3.88, z), false); }
    for (const b of benches()) { W(k, box(1.9, 0.12, 0.55), C.WOOD_L, M(b.x, Y + 0.48, b.z, b.yaw)); W(k, box(1.9, 0.5, 0.1), C.WOOD, M(b.x - Math.sin(b.yaw) * 0.0 + Math.cos(b.yaw) * 0, Y + 0.8, b.z, b.yaw), false);
      for (const s of [-0.8, 0.8]) W(k, box(0.12, 0.45, 0.5), C.IRON, M(b.x + Math.cos(b.yaw) * s, Y + 0.22, b.z - Math.sin(b.yaw) * s, b.yaw), false); }
    // signpost at the bridge head
    { const [x, z] = [HB.ax - 1.2, HB.az + 2.4]; W(k, box(0.2, 2.6, 0.2), C.WOOD_D, M(x, Y + 1.3, z)); W(k, box(1.9, 0.45, 0.1), C.WOOD_L, M(x, Y + 2.25, z, HB.yaw - Math.PI / 2)); W(k, box(1.7, 0.45, 0.1), C.WOOD_L, M(x, Y + 1.7, z, HB.yaw + 0.6)); }
    // the high rope bridge (D3's look: jittered planks, rope rails + hangers, stone piers, anchor posts)
    const bk = new Kit(), cs = Math.cos(HB.yaw), sn = Math.sin(HB.yaw), n = Math.round(HB.L / 0.62);
    for (let i = 0; i <= n; i++) { const t = i / n, [x, z] = along(t); if (hash(i, 9) > 0.975 && i > 3 && i < n - 3 && !nearPier(t)) continue;
      W(bk, box(2.9 + hash(i, 1) * 0.3, 0.12, 0.5), hash(i, 2) > 0.5 ? C.WOOD_L : 0xc28a55, M(x, HB.yAt(t) - 0.06, z, HB.yaw + (hash(i, 3) - 0.5) * 0.06), false);
      if (i % 4 === 0) for (const s of [-1, 1]) W(bk, cyl(0.035, 0.035, 1.15, 4), 0xc9a36b, M(x + cs * s * 1.45, HB.yAt(t) + 0.55, z - sn * s * 1.45), false); }
    for (const s of [-1, 1]) for (const hgt of [1.15, 0.05]) { const pts = []; for (let i = 0; i <= 90; i++) { const t = i / 90, [x, z] = along(t); pts.push(new THREE.Vector3(x + cs * s * 1.45, HB.yAt(t) + hgt, z - sn * s * 1.45)); }
      W(bk, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, hgt > 1 ? 0.07 : 0.05, 5), 0xc9a36b, null, false); }
    for (const t of HB.piers) { const [x, z] = along(t), top = HB.yAt(t) - 0.15, g = Math.min(H(x, z), H(x + 1.5, z), H(x - 1.5, z), H(x, z + 1.5), H(x, z - 1.5)) - 0.5, hgt = top - g;
      W(k, box(3.4, hgt, 3.4), C.STONE, M(x, g + hgt / 2, z, HB.yaw)); W(k, box(3.8, 0.35, 3.8), C.STONE_D, M(x, top - 0.1, z, HB.yaw), false);
      for (let r = 2; r < hgt - 1; r += 2.4) W(k, box(3.45, 0.08, 3.45), C.STONE_D, M(x, g + r, z, HB.yaw), false);
      for (const s of [-1, 1]) { W(k, cyl(0.16, 0.2, 2.2, 6), C.WOOD_D, M(x + cs * s * 1.6, top + 1.1, z - sn * s * 1.6)); W(k, box(0.36, 0.42, 0.36), 0xffd27a, M(x + cs * s * 1.6, top + 2.35, z - sn * s * 1.6), false); } }
    for (const t of [0, 1]) { const [x, z] = along(t), y = HB.yAt(t); for (const s of [-1, 1]) { const px = x + cs * s * 1.9, pz = z - sn * s * 1.9;
      W(k, cyl(0.24, 0.3, 3.2, 7), C.WOOD_D, M(px, y + 1.0, pz)); for (let r = 0; r < 3; r++) W(k, cyl(0.31, 0.31, 0.12, 7), 0xc9a36b, M(px, y + 1.6 + r * 0.22, pz), false);
      W(k, box(0.4, 0.5, 0.4), 0xffd27a, M(px, y + 2.85, pz), false); } }
    // the plateau landing: a few flags from the deck end onto the upper path
    for (let i = 0; i < 6; i++) { const x = HB.bx + Math.sin(HB.yaw) * (1 + i * 1.6), z = HB.bz + Math.cos(HB.yaw) * (1 + i * 1.6); W(k, box(2.8, 0.1, 1.5), i % 2 ? PV : PV_D, M(x, H(x, z) + 0.03, z, HB.yaw), false); }
    near.add(k.build(MATS, OUT)); const deck = bk.build(MATS, OUT); const sway = new THREE.Group(); sway.add(deck); near.add(sway);
    // fountain water: basin surface + 6 arcing jets + the top spout (animated, cheap: 3 meshes, no textures)
    const wm = new THREE.MeshBasicMaterial({ color: WATER, transparent: true, opacity: 0.78, depthWrite: false }), jm = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.55, depthWrite: false });
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.04, 8), wm); pool.position.set(CX, Y + 0.68, CZ); pool.rotation.y = Math.PI / 8;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.04, 12), wm); bowl.position.set(CX, Y + 2.53, CZ);
    const jets = new THREE.Group(); jets.position.set(CX, Y, CZ);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, pts = []; for (let j = 0; j <= 8; j++) { const u = j / 8; pts.push(new THREE.Vector3(Math.sin(a) * (0.9 + u * 1.0), 2.45 - u * u * 1.75 + u * 0.25, Math.cos(a) * (0.9 + u * 1.0))); }
      jets.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.05, 4), jm)); }
    const spout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 6, 1, true), jm); spout.position.set(0, 3.75, 0); jets.add(spout);
    near.add(pool, bowl, jets);
    const kf = new Kit(); W(kf, new THREE.CylinderGeometry(RB2.r, RB2.r, 0.1, 16), PV, M(CX, Y + 0.03, CZ), false);
    for (let i = 0; i <= 12; i++) { const t = i / 12, [x, z] = along(t); W(kf, box(3, 0.2, HB.L / 12), C.WOOD, M(x, HB.yAt(t) - 0.1, z, HB.yaw), false); }
    for (const t of HB.piers) { const [x, z] = along(t), top = HB.yAt(t), g = H(x, z); W(kf, box(3.4, top - g, 3.4), C.STONE, M(x, (top + g) / 2, z, HB.yaw), false); }
    far.add(kf.build(MATS, OUT));
    return { near, far, tick(t) { jets.rotation.y = t * 0.6; spout.scale.y = 1 + Math.sin(t * 7) * 0.12; pool.scale.setScalar(1 + Math.sin(t * 3) * 0.004);
      sway.position.set(Math.cos(HB.yaw) * Math.sin(t * 0.9) * 0.03, Math.sin(t * 1.3) * 0.01, -Math.sin(HB.yaw) * Math.sin(t * 0.9) * 0.03); } }; // sway: looks only (walk height = foot.js)
  },
};
function along(t) { return [HB.ax + (HB.bx - HB.ax) * t, HB.az + (HB.bz - HB.az) * t]; }
const nearPier = (t) => HB.piers.some(p => Math.abs(t - p) * HB.L < 2.5);
// exits (kerb / parapet gaps): west = the gate (hill street), north = to the castle, south = the steps down the hill, east = the bridge
function gapAt(x, z, w = 2.6) { const dx = x - CX, dz = z - CZ, a = Math.atan2(dx, dz);
  for (const g of [Math.PI / 2, -Math.PI / 2, 0, Math.PI, -2.35]) { let d = Math.abs(a - g); d = Math.min(d, Math.PI * 2 - d); if (d * Math.max(RB2.r, Math.hypot(dx, dz)) < w) return true; } return false; }
function lampsXZ() { const [x0, x1, z0, z1] = RB2.pad; return [[x0 + 1.2, z0 + 1.2], [x1 - 1.2, z0 + 1.2], [x0 + 1.2, z1 - 1.2], [x1 - 1.2, z1 - 1.2]]; }
function benches() { return [Math.PI / 4, -3 * Math.PI / 4 + 0.4].map(a => ({ x: CX + Math.sin(a) * 5.4, z: CZ + Math.cos(a) * 5.4, yaw: a + Math.PI / 2 })); }
