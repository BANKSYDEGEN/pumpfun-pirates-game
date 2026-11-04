// [path-fix2 -> Timothy roundabout-bridge] THE FOUNTAIN PLAZA + THE PIRATES' CLIMB STAIRS + THE HIGH ROPE BRIDGE (BANKSY 10:47 AM-12:30 PM:
// "rework this path/area, add a bridge ..." / "I don't want that dip from the hill road to the waterfall" / "Or can do a rope bridge" / "So players
// below can walk under and get to beach still" / "coming out of the hill street will be a water fountain area roundabout that goes right to the
// castle, left down the hill or straight across rope bridge to waterfalls plateau" / "make the roundabout fountain areas, redesign the path down
// the hill better ... then the long wide rope bridge" / "Normal tail path width" / "make the whole area blend together").
//   - the plaza: one built stone terrace (area deck, no terrain writes) 26 x 22.5 m at y 20.1 just outside the town gate: cobbles, a big
//     three-tier fountain (collider: walk round it), kerb ring, lamps, benches, planters; retaining walls + parapets where the hill falls away.
//     Exits: W = the gate (hill street), N = the castle (fort stair) + the old east trail, S = the Pirates' Climb stairs, E = the bridge.
//   - the Pirates' Climb stairs: Post's straight 0.8-grade steps (route_stair_3..9) are replaced by an L of stone flights at 1:2 with three
//     landings and cheek walls (trail width, 4.6 m), plaza -> the valley floor by the ford footbridge. Post's decks are switched off and his
//     treads sunk out of sight at runtime (route.js untouched); the two lamps on that stretch move onto the new stairs (same ids / progress).
//   - the high rope bridge: plaza -> the waterfalls plateau above the old cliff dead-end, 3 spans on 2 stone piers, 4.6 m deck (the trail
//     width), even grade, stone tower heads at both ends. Walkable ONLY for whoever is up at deck height (foot.js HIGH_BRIDGES + setLayer): the
//     valley trail below keeps 12+ m of headroom and still runs to the beach. D3's gorge bridge is untouched.
// &roundabout=0 (areas/index.js) = none of this: the old gate, steps and dip path exactly.
import * as THREE from 'three';
import { Kit, M, box, cyl, hash, jitter, W, C } from './common.js';
import { _route as RT } from './route.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { softRamp } from '../look.js';
import { libMaterial } from '../libTex.js';

// the Blender fountain (tools/roundabout_blender/rb_fountain_blender.py -> assets/island/rb_fountain.glb desktop LOD0, rb_fountain_low.glb phones
// LOD1: one mesh, one draw call, library stone): OFF by default for the layout pass, &rbglb=1 = try it; a failed load = the kit fountain (same heights, same collider).
const RBGLB_ON = typeof location !== 'undefined' && /[?&]rbglb=1(&|$)/.test(location.search);   // BANKSY 1:14 PM: three.js kit layout first, Blender pass after he approves it
let RBG = null;
function rbFountainGLB(low) {
  if (!RBGLB_ON || typeof window === 'undefined') return Promise.resolve(null);
  if (!RBG) { const solid = libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp() }), low); solid.name = 'rb_solid';
    RBG = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`assets/island/rb_fountain${low ? '_low' : ''}.glb`).then(gl => {
      const want = low ? 'rb_fountain_LOD1' : 'rb_fountain_LOD0'; let mesh = null; gl.scene.traverse(o => { if (o.isMesh && (o.name === want || o.parent?.name === want)) mesh = o; });
      if (!mesh) return null; const m = new THREE.Mesh(mesh.geometry, solid); m.name = 'rb_fountain_glb'; m.castShadow = !low; m.receiveShadow = !low;
      RB_STATS.fountainTris = mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3; return m; })
      .catch(e => { console.warn('[hill_round] Blender fountain failed, the kit fountain stays', e); return null; }); }
  return RBG.then(m => m && m.clone());
}

const Y = 20.1;   // >= the natural ground anywhere under the plaza (max 20.05): the deck is never under the grass
// BANKSY's sketch (12:35 PM, from under the gate arch): one wide paved plaza filling the view, the fountain centred a little way out, a low wall on
// the far rim with the bridge head in the middle; LEFT = the path down the hill (the Pirates' Climb, its own route), RIGHT = up to the castle
export const RB2 = { c: [-425.5, -88], y: Y, plaza: [-438, -413, -100, -76], r: 9.5, half: 2.3, sag: 0.5, piers: [1 / 3, 2 / 3], end: [-282, -72], az: -88 };
const [CX, CZ] = RB2.c, [PX0, PX1, PZ0, PZ1] = RB2.plaza;
// the fountain (BANKSY's later wishing fountain: a rim spot for the prompt + where a thrown coin splashes), world coords
export const FOUNTAIN = { x: CX, z: CZ, basinR: 4.2, rimY: Y + 0.75, waterY: Y + 0.62 };
export const FOUNTAIN_ANCHORS = { rim: { x: CX - 4.75, y: Y, z: CZ }, coin: { x: CX - 2.6, y: Y + 0.62, z: CZ }, radius: 1.6 };
// the Pirates' Climb stairs, on the trail's own line (trail A, plaza edge (-428, -100) -> the valley floor (-416, -119.3)): two flights + a landing,
// 4.6 m wide (the trail width); [id, u0, u1, y0, y1] along that line (y1 null = the ground at the foot, set in register)
const CL = { x0: -428, z0: -100, x1: -416, z1: -119.3, hw: 2.3 }; CL.L = Math.hypot(CL.x1 - CL.x0, CL.z1 - CL.z0); CL.yaw = Math.atan2(CL.x1 - CL.x0, CL.z1 - CL.z0);
const clAt = (u) => [CL.x0 + (CL.x1 - CL.x0) * u, CL.z0 + (CL.z1 - CL.z0) * u];
const ST = [['rb_f1', 0, 0.47, Y, 12.8], ['rb_l1', 0.47, 0.58, 12.8, 12.8], ['rb_f2', 0.58, 1, 12.8, null]].map(([id, u0, u1, y0, y1]) => {
  const [x0, z0] = clAt(u0), [x1, z1] = clAt(u1); return { id, u0, u1, x0, z0, x1, z1, y0, y1, hw: CL.hw, L: Math.hypot(x1 - x0, z1 - z0), yaw: CL.yaw, flat: y0 === y1 }; });
const ACR = [Math.cos(CL.yaw), -Math.sin(CL.yaw)], cheek = (s, u) => { const [x, z] = clAt(u); return [x + ACR[0] * s * (CL.hw + 0.25), z + ACR[1] * s * (CL.hw + 0.25)]; };
const uEdge = (s) => { const z = cheek(s, 0)[1]; return z < PZ0 - 0.25 ? 0 : (z - (PZ0 - 0.25)) / (CL.z0 - CL.z1); };   // where each cheek leaves the plaza
// parapets / cheek walls (colliders + the low walls you see): polylines just outside the walk edges
const WALLS = [
  [[-430, PZ1 + 0.25], [PX1 + 0.25, PZ1 + 0.25], [PX1 + 0.25, RB2.az + 2.9]],          // plaza N (east of the castle opening x -438..-430) + E down to the bridge
  [[PX1 + 0.25, RB2.az - 2.9], [PX1 + 0.25, PZ0 - 0.25], [cheek(-1, uEdge(-1))[0], PZ0 - 0.25]],   // plaza E (south of the bridge) + S to the stair head
  [cheek(-1, uEdge(-1)), cheek(-1, 1)], [cheek(1, uEdge(1)), cheek(1, 1)],            // the stair's two cheek walls
  // [stairfix] BANKSY 1:36 PM "I got stuck down here": the plaza's S rim WEST of the stair head had no parapet (only the retaining wall you
  // see), so you walked off the 2-8 m drop into the slot between the stair's west cheek wall and the hill. Now a parapet runs from the
  // town-side ramp's foot along the rim and joins the cheek wall (no gap): the only way down is the stairs.
  [[PX0 - 1.6, PZ0 - 0.25], [cheek(1, uEdge(1))[0], PZ0 - 0.25]],
];
const LAMPS = [[PX1 - 1.3, PZ1 - 1.3], [PX1 - 1.3, PZ0 + 1.3], [-429.2, PZ1 - 1.2], [PX0 + 1.5, PZ0 + 1.4]];   // never in an exit (the hill street enters at z -91..-77)
const BENCHES = [0.45, 2.3, -2.2].map(a => ({ x: CX + Math.sin(a) * 7.4, z: CZ + Math.cos(a) * 7.4, yaw: a }));
const PLANTERS = [[PX0 + 1.8, -96.6], [-419.5, PZ1 - 1.6], [PX1 - 1.8, -96.4]];
const SIGNS = [[PX1 - 1.4, RB2.az + 3.6], [-430.4, PZ1 - 3.2]];
// the fort stair foot (fort.js LEG1 x -434, z -72 .. -46.5, hw 2, parapets at hw + 0.3, 1.0 m over the tread): gate piers with braziers
// flanking the foot, planters either side of the apron; lanterns + red banners on Post's parapets are visual only (no collider changes there)
const FORT_FOOT = { x: -434, z0: -72, z1: -46.5, y0: 20.2, y1: 31, hw: 2 }, GPIERS = [[-437.0, -72.7], [-431.0, -72.7]], CPLANT = [[-438.1, -73.6], [-429.4, -73.4]];
const CASTLE = { x0: -436, x1: -431, z0: PZ1 - 0.1, z1: -71.6 };   // the approach to the fort stair (fort.js fort_stair_1 starts at z -72)
const HB = { ax: PX1 - 0.3, az: RB2.az, bx: 0, bz: 0, L: 0, yaw: 0, ya: Y, yb: Y, half: RB2.half, sag: RB2.sag, piers: RB2.piers, yAt: null };
HB.yAt = (u) => { u = Math.min(1, Math.max(0, u)); const P = [0, ...HB.piers, 1]; let k = 0; while (k < P.length - 2 && u > P[k + 1]) k++;
  const f = (u - P[k]) / (P[k + 1] - P[k]); return HB.ya + (HB.yb - HB.ya) * u - Math.sin(f * Math.PI) * HB.sag; };
export const _hb = HB;
export const RB_STATS = { replaced: [], lamps: [] };
const OLD_STAIRS = (s) => s.x > -432 && s.x < -414 && s.z > -119 && s.z < -94;   // Post's route_stair_3..9 (the gate -> the ford)

export default {
  id: 'hill_round', name: 'Fountain plaza + Pirates\' Climb stairs + high rope bridge', rect: [-440, -278, -128, -60],
  terrain: { pads: [], cuts: [], paths: [] },
  register(h) {
    const { H, AREA_DECKS = [], collidersOff = null } = h;   // (from foot.js: no import, no module cycle)
    // the plateau end: walk in from the target until the ground stops rising (the cliff top), deck end = that ground
    { const [ex, ez] = RB2.end; let bx = ex, bz = ez; const ux = HB.ax - ex, uz = HB.az - ez, n = Math.hypot(ux, uz);
      for (let s = 0; s < 20; s += 0.5) { const x = ex + ux / n * s, z = ez + uz / n * s; if (H(x, z) < H(ex, ez) - 0.6) break; bx = x; bz = z; }
      Object.assign(HB, { bx, bz, yb: H(bx, bz), L: Math.hypot(bx - HB.ax, bz - HB.az), yaw: Math.atan2(bx - HB.ax, bz - HB.az) }); }
    h.addHighBridge?.(HB);
    // the plaza + the stairs (walk decks)
    h.addDeck({ id: 'rb_plaza', x: (PX0 + PX1) / 2, z: (PZ0 + PZ1) / 2, hw: (PX1 - PX0) / 2, hl: (PZ1 - PZ0) / 2, yaw: 0, y: Y });
    h.addDeck({ id: 'rb_castle', x: (CASTLE.x0 + CASTLE.x1) / 2, z: (CASTLE.z0 + CASTLE.z1) / 2, hw: (CASTLE.x1 - CASTLE.x0) / 2, hl: (CASTLE.z1 - CASTLE.z0) / 2, yaw: 0, y: Y, y1: Math.max(H(-434, CASTLE.z1), 20.2) });
    h.addDeck({ id: 'rb_west', x: PX0 - 0.7, z: (PZ0 + PZ1) / 2, hw: (PZ1 - PZ0) / 2, hl: 0.75, yaw: Math.PI / 2, y: H(PX0 - 1.45, -95), y1: Y });   // the town side: a 1.5 m ramp onto the plaza, not a 0.4 m lip
    const last = ST[ST.length - 1]; last.y1 = H(last.x1, last.z1) + 0.03;
    for (const s of ST) h.addDeck({ id: s.id, x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2, hw: s.hw, hl: s.L / 2 + 0.06, yaw: s.yaw, y: s.y0, ...(s.flat ? {} : { y1: s.y1 }) });
    // Post's steps on that stretch: decks off, treads + cheeks sunk out of sight (his edging stays skipped there: the stair entries remain)
    for (const d of AREA_DECKS) if (/^route_stair_/.test(d.id) && OLD_STAIRS(d)) { d.off = true; RB_STATS.replaced.push(d.id); }
    for (const s of RT.stairs || []) if (OLD_STAIRS(s)) { s.prof = s.prof.map(() => -60); s.low = s.low.map(() => -61); }
    { const gone = (RT.walls || []).filter(w => w.x > -433 && w.x < -414 && w.z > -119 && w.z < -94); RT.walls = (RT.walls || []).filter(w => !gone.includes(w));   // his retaining walls there: mesh + collider
      RB_STATS.wallsOff = collidersOff?.((o) => o.t === 1 && gone.some(w => Math.abs(o.x - w.x) < 1e-6 && Math.abs(o.z - w.z) < 1e-6)) ?? 0; }
    { const l = (RT.lamps || []).find(q => q.k === 0); if (l && l.x > PX0 && l.x < PX1 && l.z > PZ0 && l.z < PZ1) { l.y = Y; l.onWall = false; RB_STATS.lamps.push(0); } }   // lamp 0 now stands on the plaza
    { const sg = RT.lm?.sign; if (sg && sg.x > PX0 && sg.x < PX1 && sg.z > PZ0 && sg.z < PZ1) { const ox = sg.x, oz = sg.z;   // the TOWN / FORT / JUNGLE post: off the fountain, to the head of the stairs
      collidersOff?.((o) => o.t === 0 && Math.abs(o.x - ox) < 1e-6 && Math.abs(o.z - oz) < 1e-6); Object.assign(sg, { x: -433.2, z: -99.35, y: Y, yaw: CL.yaw }); /* [stairfix] against the new S parapet: no wedge by the stair head */ h.addCirc(sg.x, sg.z, 0.25); RB_STATS.sign = [ox, oz]; } }
    // colliders: fountain, parapets / cheek walls, lamps, benches, planters, bridge towers, piers
    h.addCirc(CX, CZ, FOUNTAIN.basinR + 0.15);
    for (const pl of WALLS) for (let i = 1; i < pl.length; i++) { const [ax, az] = pl[i - 1], [bx, bz] = pl[i], L = Math.hypot(bx - ax, bz - az); h.addBox((ax + bx) / 2, (az + bz) / 2, 0.5, L + 0.5, Math.atan2(bx - ax, bz - az)); }
    for (const [x, z] of LAMPS) h.addCirc(x, z, 0.3);
    for (const b of BENCHES) h.addBox(b.x, b.z, 2.0, 0.7, b.yaw);
    for (const [x, z] of PLANTERS) h.addBox(x, z, 1.6, 1.6, 0);
    for (const t of [0, 1]) { const [x, z] = along(t), cs = Math.cos(HB.yaw), sn = Math.sin(HB.yaw); for (const s of [-1, 1]) h.addBox(x + cs * s * 3.25 - sn * (t ? -0.6 : 0.6), z - sn * s * 3.25 - cs * (t ? -0.6 : 0.6), 1.5, 1.5, HB.yaw); }
    for (const t of HB.piers) { const [x, z] = along(t); h.addBox(x, z, 6.4, 4.4, HB.yaw); }
    for (const [x, z] of SIGNS) h.addCirc(x, z, 0.25);
    for (let i = 0; i < 14; i++) { const [x, z, r] = rockfall(i); h.addCirc(x, z, r * 0.9); }
    for (const [x, z] of GPIERS) h.addBox(x, z, 0.9, 0.9, 0); for (const [x, z] of CPLANT) h.addBox(x, z, 1.4, 1.4, 0);   // stone piers: solid down in the valley, the deck walks over them
    // foliage kept clear (POIs): the plaza, the stairs, both bridge heads
    h.poi('hill_round', 'Fountain plaza', CX, CZ, { clear: 19 });
    h.poi('rb_stairs', "Pirates' Climb stairs", ...clAt(0.6), { clear: 9 });
    h.poi('high_bridge', 'High rope bridge to the waterfalls plateau', (HB.ax + HB.bx) / 2, (HB.az + HB.bz) / 2, { clear: 6 });
    h.poi('high_bridge_e', 'High rope bridge: plateau end', HB.bx, HB.bz, { clear: 9 });
  },
  build({ MATS, OUT, low, H }) {
    const k = new Kit(), near = new THREE.Group(), far = new THREE.Group(); near.name = 'area_hill_round'; far.name = 'area_hill_round_far';
    const gmin = (x, z, r = 1.2) => Math.min(H(x, z), H(x + r, z), H(x - r, z), H(x, z + r), H(x, z - r));
    // ---- the plaza terrace: retaining walls down to the ground on the 3 open sides (coursed: band every 1.6 m), cobble deck + border
    const retain = (ax, az, bx, bz, nx, nz, top) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 2.4)), yaw = Math.atan2(bx - ax, bz - az);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, g = gmin(x + nx * 0.6, z + nz * 0.6, 1.4) - 0.4, hh = top - g; if (hh < 0.3) continue;
        W(k, box(0.8, hh, L / n + 0.03), i % 2 ? 0xb9b2a6 : 0xb0a99c, M(x + nx * 0.4, g + hh / 2, z + nz * 0.4, yaw), true);
        for (let r = 1.6; r < hh - 0.5; r += 1.6) W(k, box(0.86, 0.12, L / n + 0.05), 0x8a837a, M(x + nx * 0.42, top - r, z + nz * 0.42, yaw), false); } };
    retain(PX0, PZ1, -430, PZ1, 0, 1, Y); retain(PX1, RB2.az + 2.9, PX1, RB2.az - 2.9, 1, 0, Y); retain(PX0, PZ0, cheek(1, uEdge(1))[0], PZ0, 0, -1, Y);   // the openings (the parapet walls below are the rest)
    for (const [dx, dy] of [[-1.1, 0.36], [-0.35, 0.18]]) W(k, box(0.8, 0.5, PZ1 - PZ0), 0xd2c9b6, M(PX0 + dx, Y - dy - 0.25, (PZ0 + PZ1) / 2), false);   // the two broad steps on the town side (walk = the ramp)
    // deck: a slab whose top is the walk height; cobble field (the library's cobble layer), dressed-stone border band, a paved ring round the fountain
    W(k, box(PX1 - PX0, 0.5, PZ1 - PZ0), 0x9f9585, M(CX, Y - 0.25, (PZ0 + PZ1) / 2), false);
    for (const [x0, x1, z0, z1] of [[PX0, PX1, PZ0, PZ0 + 0.9], [PX0, PX1, PZ1 - 0.9, PZ1], [PX0, PX0 + 0.9, PZ0, PZ1], [PX1 - 0.9, PX1, PZ0, PZ1]])
      W(k, box(x1 - x0, 0.06, z1 - z0), 0xd2c9b6, M((x0 + x1) / 2, Y + 0.005, (z0 + z1) / 2), false);
    W(k, new THREE.CylinderGeometry(RB2.r, RB2.r, 0.05, 48), 0xc8bda7, M(CX, Y + 0.01, CZ), false);
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; W(k, box(0.06, 0.06, RB2.r - FOUNTAIN.basinR - 0.3), 0x8f8676, M(CX + Math.sin(a) * (RB2.r + FOUNTAIN.basinR) / 2, Y + 0.02, CZ + Math.cos(a) * (RB2.r + FOUNTAIN.basinR) / 2, a), false); }
    for (let i = 0; i < 48; i++) { const a = (i + 0.5) / 48 * Math.PI * 2; W(k, box(0.42, 0.14, 1.28), 0x8a837a, M(CX + Math.sin(a) * (RB2.r + 0.2), Y + 0.07, CZ + Math.cos(a) * (RB2.r + 0.2), a + Math.PI / 2), false); }
    const kfo = new Kit();   // the stone fountain on its own kit: swapped for the Blender model (rb_fountain.glb) once that has loaded
    // ---- the fountain: a broad octagonal basin with a thick rim, a carved pedestal, two bowls, a gilded finial
    W(kfo, new THREE.CylinderGeometry(FOUNTAIN.basinR, FOUNTAIN.basinR + 0.25, 0.7, 8), 0xb9b2a6, M(CX, Y + 0.35, CZ, Math.PI / 8));
    W(kfo, new THREE.CylinderGeometry(FOUNTAIN.basinR + 0.15, FOUNTAIN.basinR + 0.15, 0.16, 8), 0xd2c9b6, M(CX, Y + 0.76, CZ, Math.PI / 8), false);
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2 + Math.PI / 8, r = FOUNTAIN.basinR + 0.12; W(kfo, box(0.5, 0.86, 0.5), 0x8a837a, M(CX + Math.sin(a) * r, Y + 0.43, CZ + Math.cos(a) * r, a), false); }
    W(kfo, cyl(0.9, 1.25, 0.6, 8), 0xb9b2a6, M(CX, Y + 0.9, CZ)); W(kfo, cyl(0.55, 0.8, 1.6, 8), 0xb0a99c, M(CX, Y + 2.0, CZ));
    W(kfo, cyl(2.1, 0.7, 0.55, 12), 0xb9b2a6, M(CX, Y + 3.05, CZ)); W(kfo, cyl(2.2, 2.2, 0.1, 12), 0xd2c9b6, M(CX, Y + 3.35, CZ), false);
    W(kfo, cyl(0.32, 0.45, 1.3, 8), 0xb0a99c, M(CX, Y + 4.0, CZ)); W(kfo, cyl(1.1, 0.35, 0.36, 10), 0xb9b2a6, M(CX, Y + 4.75, CZ)); W(kfo, cyl(1.15, 1.15, 0.08, 10), 0xd2c9b6, M(CX, Y + 4.95, CZ), false);
    W(kfo, cyl(0.14, 0.22, 0.6, 8), 0x8a837a, M(CX, Y + 5.25, CZ)); W(kfo, new THREE.SphereGeometry(0.28, 10, 8), C.GOLD, M(CX, Y + 5.7, CZ), false);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; W(kfo, box(0.36, 0.42, 0.5), 0xb0a99c, M(CX + Math.sin(a) * 0.62, Y + 2.55, CZ + Math.cos(a) * 0.62, a)); }   // spout heads
    // ---- lamps (iron post on a stone plinth), benches, planters with flowers
    const lamp = (x, y, z) => { W(k, box(0.55, 0.45, 0.55), 0xb0a99c, M(x, y + 0.22, z)); W(k, cyl(0.08, 0.11, 3.4, 6), C.IRON, M(x, y + 2.1, z)); W(k, box(0.5, 0.6, 0.5), 0x2b2f36, M(x, y + 3.95, z));
      W(k, box(0.38, 0.46, 0.52), 0xffd27a, M(x, y + 3.95, z), false); W(k, box(0.52, 0.46, 0.38), 0xffd27a, M(x, y + 3.95, z), false); W(k, cyl(0.02, 0.42, 0.3, 4), C.IRON, M(x, y + 4.4, z, Math.PI / 4), false); };
    for (const [x, z] of LAMPS) lamp(x, Y, z);
    for (const b of BENCHES) { const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); W(k, box(2.0, 0.12, 0.6), 0xd9a36b, M(b.x, Y + 0.48, b.z, b.yaw + Math.PI / 2)); W(k, box(2.0, 0.5, 0.1), 0xa86a3a, M(b.x + sn * 0.3, Y + 0.8, b.z + cs * 0.3, b.yaw + Math.PI / 2), false);
      for (const s of [-0.8, 0.8]) W(k, box(0.5, 0.45, 0.14), 0x8a837a, M(b.x + cs * s, Y + 0.22, b.z - sn * s, b.yaw + Math.PI / 2), false); }
    const planter = (x, y, z, s = 1.6) => { W(k, box(s, 0.6, s), 0xb0a99c, M(x, y + 0.3, z)); W(k, box(s + 0.14, 0.1, s + 0.14), 0xd2c9b6, M(x, y + 0.62, z), false); W(k, box(s - 0.2, 0.08, s - 0.2), 0x5a3a22, M(x, y + 0.64, z), false);
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + x, r = (i % 3) * 0.22; k.add(jitter(new THREE.IcosahedronGeometry(0.26 + hash(i, x) * 0.12, 0), 0.2, i + z), [0x5f9a3a, 0x4e8a34, 0x6fae45, 0xd8322f, 0xffc93c, 0x5f9a3a, 0xf4efe6][i], { m: M(x + Math.cos(a) * r, y + 0.85 + (i % 2) * 0.12, z + Math.sin(a) * r, a), outline: false }); } };
    for (const [x, z] of PLANTERS) planter(x, Y, z);
    // ---- parapets + cheek walls: a low wall (0.9 m over the walk) with a dressed coping, following the walk height under it
    const walkY = (x, z) => { let y = null; for (const s of ST) { const dx = x - s.x0, dz = z - s.z0, u = (dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw)) / s.L, a = Math.abs(dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw));
      if (u < -0.02 || u > 1.02 || a > s.hw + 0.8) continue; const yy = s.y0 + (s.y1 - s.y0) * Math.min(1, Math.max(0, u)); y = y === null ? yy : Math.max(y, yy); }
      if (x >= PX0 - 0.6 && x <= PX1 + 0.6 && z >= PZ0 - 0.6 && z <= PZ1 + 0.6) y = Math.max(y ?? -1e9, Y); return y ?? H(x, z); };
    for (const pl of WALLS) for (let i = 1; i < pl.length; i++) { const [ax, az] = pl[i - 1], [bx, bz] = pl[i], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 1.0)), yaw = Math.atan2(bx - ax, bz - az);
      for (let j = 0; j < n; j++) { const t = (j + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, top = walkY(x, z) + 0.9, g = gmin(x, z, 0.8) - 0.3, hh = top - g;
        W(k, box(0.5, hh, L / n + 0.02), j % 3 ? 0xb9b2a6 : 0xb0a99c, M(x, g + hh / 2, z, yaw), j % 2 === 0); W(k, box(0.66, 0.12, L / n + 0.04), 0xd2c9b6, M(x, top + 0.06, z, yaw), false); } }
    // ---- the stairs: one solid stone tread per 0.2 m rise down to the ground (masonry under it), landings = paved slabs; a lamp at each landing
    for (const s of ST) { const ux = Math.sin(s.yaw), uz = Math.cos(s.yaw), drop = s.y0 - s.y1, n = s.flat ? 1 : Math.max(2, Math.round(drop / 0.2)), d = s.L / n;
      for (let j = 0; j < n; j++) { const u = (j + 0.5) / n, x = s.x0 + (s.x1 - s.x0) * u, z = s.z0 + (s.z1 - s.z0) * u, top = s.flat ? s.y0 : s.y0 - drop * (j + 0.5) / n,
          bot = gmin(x, z, s.hw) - 0.4, hh = Math.max(0.3, top - bot);
        W(k, box(s.hw * 2, hh, d + 0.03), s.flat ? 0x9f9585 : (j % 2 ? 0xb9b2a6 : 0xb0a99c), M(x, top - hh / 2, z, s.yaw), j % 3 === 0);
        W(k, box(s.hw * 2 - 0.1, 0.06, d - 0.06), s.flat ? 0xc8bda7 : 0xd2c9b6, M(x - ux * 0, top + 0.03, z, s.yaw), false); } }
    for (const sd of [-1, 1]) { const [x, z] = cheek(sd, (ST[1].u0 + ST[1].u1) / 2); lamp(x, ST[1].y0 + 0.96, z); }   // a lamp on each cheek wall at the landing
    // ---- the old east trail (the dip) now runs into the plaza's east wall: rubble + scrub at the wall foot, so it reads as the hillside
    for (let i = 0; i < (low ? 6 : 12); i++) { const x = PX1 + 1.2 + hash(i, 3) * 6, z = PZ1 - 3 + hash(i, 5) * 5, g = H(x, z), r = 0.6 + hash(i, 7) * 0.8;
      W(k, jitter(new THREE.IcosahedronGeometry(r, 0), 0.25, i), i % 3 ? 0x9e978a : 0x8a837a, M(x, g + r * 0.25, z, i, 0, 0, [1.3, 0.8, 1.1]), true);
      if (i % 2) k.add(jitter(new THREE.IcosahedronGeometry(r * 0.8, 0), 0.3, i + 1), 0x4e8a34, { m: M(x + 0.8, g + r * 0.35, z - 0.5, i), outline: false }); }
    // ---- RIGHT: the castle approach: a paved apron to the fort stair foot, lanterns, two banners on tall poles flanking the stair
    { const { x0, x1, z0, z1 } = CASTLE, cx = (x0 + x1) / 2; W(k, box(x1 - x0, 0.3, z1 - z0), 0x9f9585, M(cx, Y - 0.15 + 0.05, (z0 + z1) / 2), false);
      for (let i = 0, n = 6; i < n; i++) W(k, box(x1 - x0 - 0.2, 0.06, (z1 - z0) / n - 0.06), i % 2 ? 0xc8bda7 : 0xb3a993, M(cx, Y + 0.03 + 0.1 * (i + 0.5) / n, z0 + (z1 - z0) * (i + 0.5) / n), false);
      lamp(x1 + 0.6, H(x1 + 0.6, z0 + 0.8), z0 + 0.8);
      for (const bx of [-437.4, -430.6]) { const bz = -69.8, g = H(bx, bz); W(k, box(0.6, 0.4, 0.6), 0xb0a99c, M(bx, g + 0.2, bz)); W(k, cyl(0.07, 0.09, 6.2, 6), C.IRON, M(bx, g + 3.3, bz));
        W(k, box(0.06, 0.06, 1.3), C.IRON, M(bx, g + 6.2, bz - 0.65), false); W(k, box(0.08, 2.4, 1.2), 0xd8322f, M(bx, g + 4.9, bz - 0.7), false); W(k, box(0.09, 0.5, 0.5), C.GOLD, M(bx, g + 5.2, bz - 0.7), false);
        W(k, new THREE.ConeGeometry(0.6, 0.6, 3), 0xd8322f, M(bx, g + 3.5, bz - 0.7, 0, 0, Math.PI), false); W(k, new THREE.SphereGeometry(0.12, 8, 6), C.GOLD, M(bx, g + 6.45, bz), false); } }
    // castle stair foot: two gate piers with iron braziers, planters, and up the stair a lantern + a red banner on each parapet every 6 m
    for (const [x, z] of GPIERS) { const g = gmin(x, z, 0.5) - 0.2, top = Y + 2.6;
      W(k, box(0.9, top - g, 0.9), 0xb9b2a6, M(x, (top + g) / 2, z)); W(k, box(1.1, 0.16, 1.1), 0xd2c9b6, M(x, top + 0.08, z), false);
      W(k, cyl(0.42, 0.22, 0.4, 8), C.IRON, M(x, top + 0.36, z), false); W(k, new THREE.ConeGeometry(0.3, 0.7, 6), 0xffa53a, M(x, top + 0.85, z), false); W(k, new THREE.ConeGeometry(0.16, 0.45, 5), 0xffe08a, M(x, top + 0.8, z), false); }
    for (const [x, z] of CPLANT) planter(x, H(x, z), z, 1.4);
    { const F2 = FORT_FOOT, wy = (z) => Math.max(F2.y0 + (F2.y1 - F2.y0) * (z - F2.z0) / (F2.z1 - F2.z0), H(F2.x, z) + 0.04);
      for (let z = F2.z0 + 6; z < F2.z1 - 1; z += 6) for (const s of [-1, 1]) { const x = F2.x + s * (F2.hw + 0.3), y = wy(z) + 1.0;
        W(k, cyl(0.05, 0.06, 0.7, 5), C.IRON, M(x, y + 0.35, z), false); W(k, box(0.3, 0.36, 0.3), 0x2b2f36, M(x, y + 0.86, z), false); W(k, box(0.22, 0.3, 0.32), 0xffd27a, M(x, y + 0.86, z), false);
        const bx = x + s * 0.3, bz = z + 3; W(k, box(0.08, 0.08, 0.9), C.IRON, M(bx, y - 0.08, bz), false);
        W(k, box(0.05, 1.5, 0.8), 0xd8322f, M(bx + s * 0.02, y - 0.85, bz), false); W(k, box(0.06, 0.34, 0.34), C.GOLD, M(bx + s * 0.03, y - 0.75, bz), false); } }
    // ---- the high rope bridge: towers, plank deck (4.6 m walk + rope rails), stringers, hangers, 2 stone piers
    const bk = new Kit(), cs = Math.cos(HB.yaw), sn = Math.sin(HB.yaw), n = Math.round(HB.L / 0.6), RW = HB.half + 0.25;
    for (let i = 0; i <= n; i++) { const t = i / n, [x, z] = along(t), y = HB.yAt(t);
      W(bk, box(RW * 2 + 0.3 + hash(i, 1) * 0.2, 0.12, 0.52), hash(i, 2) > 0.5 ? 0xd9a36b : 0xc28a55, M(x, y - 0.06, z, HB.yaw + (hash(i, 3) - 0.5) * 0.03), false);
      if (i % 4 === 0) for (const s of [-1, 1]) W(bk, box(0.14, 1.25, 0.14), 0x6b4527, M(x + cs * s * RW, y + 0.55, z - sn * s * RW, HB.yaw), false); }
    for (const s of [-1, 1]) { for (const [hgt, r, off] of [[1.15, 0.075, RW], [0.55, 0.05, RW], [-0.25, 0.2, RW - 0.5]]) { const pts = [];
      for (let i = 0; i <= 120; i++) { const t = i / 120, [x, z] = along(t); pts.push(new THREE.Vector3(x + cs * s * off, HB.yAt(t) + hgt, z - sn * s * off)); }
      W(bk, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, r, hgt < 0 ? 6 : 5), hgt < 0 ? 0x6b4527 : 0xc9a36b, null, false); } }
    for (const t of HB.piers) { const [x, z] = along(t), top = HB.yAt(t) - 0.3, g = gmin(x, z, 3) - 0.6, hh = top - g;
      W(k, box(6.0, hh, 4.0), 0xb9b2a6, M(x, g + hh / 2, z, HB.yaw)); W(k, box(6.6, 0.45, 4.6), 0x8a837a, M(x, top - 0.1, z, HB.yaw), false);
      W(k, box(6.8, 3.2, 4.8), 0xa9a294, M(x, g + 1.6, z, HB.yaw), false);   // footing
      for (let r = 2.4; r < hh - 1; r += 2.4) W(k, box(6.06, 0.14, 4.06), 0x8a837a, M(x, g + r, z, HB.yaw), false);
      for (const s of [-1, 1]) { const px = x + cs * s * 2.75, pz = z - sn * s * 2.75; W(k, cyl(0.2, 0.24, 2.2, 7), 0x6b4527, M(px, top + 1.2, pz)); W(k, box(0.4, 0.46, 0.4), 0xffd27a, M(px, top + 2.5, pz), false); } }
    for (const t of [0, 1]) { const [x, z] = along(t), y = t ? HB.yb : Y, back = t ? 0.6 : -0.6;   // tower heads: two stone pillars + a timber lintel + lanterns
      for (const s of [-1, 1]) { const px = x + cs * s * 3.25 + sn * back, pz = z - sn * s * 3.25 + cs * back, g = Math.min(y, gmin(px, pz, 0.8)) - 0.3, hh = y + 5.4 - g;
        W(k, box(1.4, hh, 1.4), 0xb9b2a6, M(px, g + hh / 2, pz, HB.yaw)); W(k, box(1.7, 0.3, 1.7), 0xd2c9b6, M(px, y + 5.5, pz, HB.yaw), false); W(k, box(1.1, 0.5, 1.1), 0xb0a99c, M(px, y + 5.9, pz, HB.yaw), false);
        for (let r = 1.2; r < hh - 0.8; r += 1.4) W(k, box(1.46, 0.1, 1.46), 0x8a837a, M(px, y + 5.4 - r, pz, HB.yaw), false);
        W(k, box(0.4, 0.5, 0.4), 0xffd27a, M(px - cs * s * 0.9, y + 4.2, pz + sn * s * 0.9), false); }
      { const px = x + sn * back, pz = z + cs * back; W(k, box(8.0, 0.55, 0.6), 0x6b4527, M(px, y + 5.0, pz, HB.yaw + Math.PI / 2)); W(k, box(3.2, 0.7, 0.14), 0xd9a36b, M(px, y + 4.25, pz, HB.yaw + Math.PI / 2), false); } }
    // the plateau landing: a flagged path from the deck end round onto trail A (the lagoon path, z ~ -61), edged, thinning out into the trail paint
    { const PP = [[HB.bx + sn * 0.6, HB.bz + cs * 0.6], [-280, -67.6], [-272.5, -61.4]], seg = []; let tot = 0;
      for (let q = 1; q < PP.length; q++) { const l = Math.hypot(PP[q][0] - PP[q - 1][0], PP[q][1] - PP[q - 1][1]); seg.push([PP[q - 1], PP[q], tot, l]); tot += l; }
      const at = (a) => { for (const [A, B, a0, l] of seg) if (a <= a0 + l || B === PP[PP.length - 1]) { const t = Math.min(1, (a - a0) / l); return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, Math.atan2(B[0] - A[0], B[1] - A[1])]; } };
      for (let a = 0, i = 0; a < tot; a += 1.45, i++) { const [x, z, yw] = at(a), f = a / tot, w = 4.6 - f * 1.2; if (f > 0.7 && hash(i, 11) < (f - 0.7) * 2.5) continue;
        W(k, box(w * (0.9 + hash(i, 2) * 0.1), 0.12, 1.3), i % 2 ? 0xc8bda7 : 0xb3a993, M(x, H(x, z) + 0.04, z, yw + (hash(i, 4) - 0.5) * 0.08), false);
        if (i % 2 === 0 && f < 0.8) for (const sd of [-1, 1]) { const ex = x + Math.cos(yw) * sd * (w / 2 + 0.4), ez = z - Math.sin(yw) * sd * (w / 2 + 0.4); W(k, jitter(new THREE.IcosahedronGeometry(0.38, 0), 0.25, i * sd), 0x8a837a, M(ex, H(ex, ez) + 0.1, ez, i), false); } } }
    // the old dead-end: trail A's valley end ran into the 17 m cliff below the plateau (x -297..-281): a rockfall at its foot, the bridge is the way up now
    for (let i = 0; i < 14; i++) { const [x, z, r] = rockfall(i), g = H(x, z);
      W(k, jitter(new THREE.IcosahedronGeometry(r, 0), 0.28, i + 40), i % 3 ? 0x9e978a : 0x8a837a, M(x, g + r * 0.3, z, i * 1.7, 0, 0, [1.25, 0.85, 1.1]), true);
      if (i % 3 === 0) k.add(jitter(new THREE.IcosahedronGeometry(r * 0.7, 0), 0.3, i + 41), 0x4e8a34, { m: M(x + 0.6, g + r * 0.5, z + 0.4, i), outline: false }); }
    // exit signposts (W = TOWN at the gate, N = FORT, E = FALLS, S = BEACH / JUNGLE): carved arrow boards on a post
    const sign = (x, z, boards) => { const y = walkY(x, z); W(k, box(0.55, 0.3, 0.55), 0xb0a99c, M(x, y + 0.15, z)); W(k, box(0.24, 2.9, 0.24), 0x5e3b20, M(x, y + 1.6, z));
      boards.forEach(([a, c], i) => W(k, box(1.6, 0.38, 0.1), c, M(x + Math.sin(a) * 0.7, y + 2.6 - i * 0.48, z + Math.cos(a) * 0.7, a + Math.PI / 2))); };
    sign(...SIGNS[0], [[Math.PI / 2, 0xd9a36b]]);
    sign(...SIGNS[1], [[Math.PI / 2, 0xc98a4c], [Math.PI, 0xe7c08d]]);
    const fk = kfo.build(MATS, OUT); fk.name = 'rb_fountain_kit'; near.add(fk); rbFountainGLB(low).then(g => { if (!g || !fk.parent) return; near.remove(fk); g.position.set(CX, Y, CZ); near.add(g); RB_STATS.fountainGLB = true; });
    near.add(k.build(MATS, OUT)); const deck = bk.build(MATS, OUT); const sway = new THREE.Group(); sway.add(deck); near.add(sway);
    // fountain water: basin, two bowls, falling sheets from the bowls, 4 spout arcs + the top jet (animated, cheap: no textures)
    const wm = new THREE.MeshBasicMaterial({ color: 0x3f9fd6, transparent: true, opacity: 0.8, depthWrite: false }), jm = new THREE.MeshBasicMaterial({ color: 0xcdeeff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(FOUNTAIN.basinR - 0.15, FOUNTAIN.basinR - 0.15, 0.04, 8), wm); pool.position.set(CX, FOUNTAIN.waterY, CZ); pool.rotation.y = Math.PI / 8;
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.04, 12), wm); b1.position.set(CX, Y + 3.32, CZ);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.04, 10), wm); b2.position.set(CX, Y + 4.92, CZ);
    const jets = new THREE.Group(); jets.position.set(CX, Y, CZ);
    jets.add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.45, 2.7, 16, 1, true), jm).translateY(1.95)); jets.add(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 1.6, 12, 1, true), jm).translateY(4.15));
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2, pts = []; for (let j = 0; j <= 8; j++) { const u = j / 8; pts.push(new THREE.Vector3(Math.sin(a) * (0.85 + u * 2.4), 2.55 - u * u * 1.9 + u * 0.2, Math.cos(a) * (0.85 + u * 2.4))); }
      jets.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.07, 4), jm)); }
    const spout = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.1, 6, 1, true), jm); spout.position.set(0, 6.3, 0); jets.add(spout);
    near.add(pool, b1, b2, jets);
    // far: the plaza slab, the fountain block, the bridge as one deck strip + piers
    const kf = new Kit(); W(kf, box(PX1 - PX0, 0.6, PZ1 - PZ0), 0xc8bda7, M(CX, Y - 0.3, (PZ0 + PZ1) / 2), false); W(kf, cyl(FOUNTAIN.basinR, FOUNTAIN.basinR, 1, 8), 0xb9b2a6, M(CX, Y + 0.5, CZ), false);
    for (let i = 0; i < 12; i++) { const t = (i + 0.5) / 12, [x, z] = along(t); W(kf, box(5.2, 0.3, HB.L / 12 + 0.1), 0xa86a3a, M(x, HB.yAt(t) - 0.15, z, HB.yaw), false); }
    for (const t of HB.piers) { const [x, z] = along(t), top = HB.yAt(t), g = H(x, z); W(kf, box(6, top - g, 4), 0xb9b2a6, M(x, (top + g) / 2, z, HB.yaw), false); }
    far.add(kf.build(MATS, OUT));
    return { near, far, tick(t) { jets.rotation.y = t * 0.5; spout.scale.y = 1 + Math.sin(t * 7) * 0.12; pool.scale.setScalar(1 + Math.sin(t * 3) * 0.004);
      sway.position.set(cs * Math.sin(t * 0.9) * 0.03, Math.sin(t * 1.3) * 0.01, -sn * Math.sin(t * 0.9) * 0.03); } }; // sway: looks only (walk height = foot.js)
  },
};
const rockfall = (i) => [-294.5 + hash(i, 21) * 6, -66 + hash(i, 23) * 7, 0.8 + hash(i, 25) * 1.1];
function along(t) { return [HB.ax + (HB.bx - HB.ax) * t, HB.az + (HB.bz - HB.az) * t]; }
