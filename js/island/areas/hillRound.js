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
import { COLISEUM_ON, castleSample, CASTLE_RAMP_HW, inFoot } from '../coliseum.js';
// BANKSY: the old castle stair / coli approach stays bare; &coliseum=0 restores all the dressing.
const clearColiStair = (x,z) => COLISEUM_ON && (castleSample(z+90,-x-640).d < CASTLE_RAMP_HW+1.4 || inFoot(z+90,-x-640,-8));
const clearCastleDressing = (x,z) => COLISEUM_ON && x > -443 && x < -418 && z > -79 && z < -36;
import * as THREE from 'three';
import { Kit, M, box, cyl, hash, jitter, W, C } from './common.js';
const C2 = C;   // ([stairs2] buildClimb's C = CLIMB)
import { _route as RT } from './route.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { softRamp } from '../look.js';
import { libMaterial } from '../libTex.js';
import { pfpFlagMaterial } from './fort.js';

// the Blender fountain (tools/roundabout_blender/rb_fountain_blender.py -> assets/island/rb_fountain.glb desktop LOD0, rb_fountain_low.glb phones
// LOD1: one mesh, one draw call, library stone): OFF by default for the layout pass, &rbglb=1 = try it; a failed load = the kit fountain (same heights, same collider).
const RBGLB_ON = typeof location !== 'undefined' && (/[?&]rbblend=0(&|$)/.test(location.search) ? /[?&]rbglb=1(&|$)/.test(location.search) : !/[?&]rbglb=0(&|$)/.test(location.search));   // [rb-blender] ON with the Blender pass (&rbglb=0 = the kit fountain)   // BANKSY 1:14 PM: three.js kit layout first, Blender pass after he approves it
let RBG = null;
// [plaza-fix] BANKSY 5:19 PM "Fountain plaza is broken / the ground was missing": both GLBs are meshopt + KHR_mesh_quantization, so the
// positions are int16 in -1..1 and the NODE carries the real size (rb_plaza: scale 76.6 + an offset, rb_fountain: scale 4.73, y +3.1).
// Taking only mesh.geometry dropped that: the plaza shrank to a ~2 m lump inside the fountain and the fountain to a small white post in
// the kit water. keepNode keeps the node's translation / rotation / scale on an inner mesh (never baked into the int16 attributes).
// [plaza-fix2] BANKSY 5:29 PM "the textures are just broken": the library stone (libTex.js) is triplanar on the vertex `position`, so a
// mesh left in its quantized -1..1 frame (scale on the node) got the stone tiled ~76x too big = flat, featureless walls + white fountain
// tiers. Bake the node matrix into plain float geometry like townkit.js toFloat (the shops / docks), so the stone tiles in metres.
function keepNode(src, mat, name) { let r = src; while (r.parent) r = r.parent; r.updateMatrixWorld(true);
  const s = src.geometry, g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'color']) { const a = s.attributes[k]; if (!a) continue; const n = k === 'color' ? Math.min(a.itemSize, 3) : a.itemSize, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); if (n > 1) out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); }
    g.setAttribute(k, new THREE.BufferAttribute(out, n)); }
  if (s.index) g.setIndex(Array.from(s.index.array)); g.applyMatrix4(src.matrixWorld); g.computeBoundingBox(); g.computeBoundingSphere();
  const grp = new THREE.Group(), m = new THREE.Mesh(g, mat); m.name = name + '_mesh'; grp.name = name; grp.add(m); return grp; }
function rbFountainGLB(low) {
  if (!RBGLB_ON || typeof window === 'undefined') return Promise.resolve(null);
  if (!RBG) { const solid = libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp() }), low); solid.name = 'rb_solid';
    RBG = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`assets/island/rb_fountain${low ? '_low' : ''}.glb`).then(gl => {
      const want = low ? 'rb_fountain_LOD1' : 'rb_fountain_LOD0'; let mesh = null; gl.scene.traverse(o => { if (o.isMesh && (o.name === want || o.parent?.name === want)) mesh = o; });
      if (!mesh) return null; const m = keepNode(mesh, solid, 'rb_fountain_glb'); m.children[0].castShadow = !low; m.children[0].receiveShadow = !low;
      RB_STATS.fountainTris = mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3; return m; })
      .catch(e => { console.warn('[hill_round] Blender fountain failed, the kit fountain stays', e); return null; }); }
  return RBG.then(m => m && m.clone());
}

// [rb-blender] BANKSY 1:33 PM: "make the fountain plaza more symmetrical off of hill street" + "Probably remove the archway too": the plaza, the
// fountain and the bridge head are centred on Main Street's axis (world z -84 = town-local lx 6 at the gate), the castle to the right (N), the
// Pirates' Climb to the left (S); the structural stone (deck, borders, retaining walls, parapets, stair flights, castle apron, gate piers, bridge
// towers + piers) is the Blender model assets/island/rb_plaza(_low).glb (tools/roundabout_blender/rb_plaza_blender.py, shared library).
// &rbblend=0 = the v214 layout exactly (fountain at z -88, kit stone, the arch).
// [plaza-bake] BANKSY 10:30 PM "the flowers rn they look like stop lights": a real flower clump instead of a red/yellow ball. A few stems with
// leaves, each topped by a five-petal bloom (a shallow 5-sided cup) round a little gold heart, soft mixed palette per clump. All on the kit
// (merged per material = no extra draw calls); phones get 2 blooms + 1 leaf per clump (~50 tris), desktop 3-4 blooms (~110 tris).
const FL_PAL = [0xf2a7c3, 0xe98aa8, 0xb99ae0, 0xf6ecd0, 0xf3c6a5, 0xf08a6e, 0xf5d97a, 0xfbf7ee, 0xc9b3f0];
const FL_PETAL = new THREE.CylinderGeometry(0.12, 0.035, 0.05, 5), FL_HEART = new THREE.OctahedronGeometry(0.035, 0), FL_LEAF = new THREE.OctahedronGeometry(0.1, 0);
function bloomClump(k, x, y, z, seed, s = 1, low = false) {
  const n = low ? 2 : 3 + (hash(seed, 7.3) > 0.5 ? 1 : 0), c0 = Math.floor(hash(seed, 1.7) * FL_PAL.length);
  for (let i = 0; i < n; i++) { const a = seed * 2.1 + i * 2.4, r = (0.06 + 0.1 * hash(seed, i)) * s, h = (0.22 + 0.2 * hash(i, seed + 3)) * s;
    const bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r, tilt = 0.25 * (hash(seed + i, 5) - 0.5);
    W(k, box(0.018 * s, h, 0.018 * s), 0x4f7f2e, M(bx, y + h / 2, bz, a, tilt, 0), false);   // stem
    const col = FL_PAL[(c0 + (i % 2) * (1 + (seed % 2))) % FL_PAL.length];   // one or two related tints per clump, never a R/Y/G stack
    W(k, FL_PETAL, col, M(bx, y + h + 0.02 * s, bz, a, tilt, 0, [s, s, s]), false); W(k, FL_HEART, 0xe8b23a, M(bx, y + h + 0.05 * s, bz, 0, 0, 0, [s, s, s]), false);
    if (!low || i === 0) W(k, FL_LEAF, i % 2 ? 0x5f9a3a : 0x6fae45, M(bx + Math.cos(a + 1.6) * 0.07 * s, y + h * 0.45, bz + Math.sin(a + 1.6) * 0.07 * s, a, 0, 0.9, [1.4 * s, 0.25 * s, 0.6 * s]), false); } }
export const RBB_ON = !(typeof location !== 'undefined' && /[?&]rbblend=0(&|$)/.test(location.search));
const AXZ = -84;   // foot.js townToWorld(STREET.x, STREET.z1)[1]
// [v220] BANKSY 3:51-3:57 PM "Fix the steps, fix the side of castle, remove the archways" + "Also remove the clutter on ground around fountain" +
// "Also remove arch at waterfall end of rope bridge": with the Blender plaza on, the bridge's two tower-head arches (stone towers + timber lintel +
// name board) become low lantern newels, the town gate towers go (foot.js GATE_ARCH_OFF), and the paving round the fountain is clear (no benches,
// planters or signposts on it; the perimeter lamps stay). &rbarch=1 = the arches back (towers, lintels, gate); &rbblend=0 = v214 exactly.
export const ARCH_OFF = RBB_ON && !(typeof location !== 'undefined' && /[?&]rbarch=1(&|$)/.test(location.search));
const CLEAN = RBB_ON;
export const RB_LAYOUT = [];   // the last build's structural pieces { kind, w, h, d, c, e (world Matrix4) } (tools/roundabout_blender/node/export_layout.mjs)
// the Blender plaza (rb_plaza.glb desktop / rb_plaza_low.glb phones, world coords about RB_ORIGIN): only used when its baked layout matches this
// build's (same pieces, positions within 2 cm, heights within 0.6 m: a live terrain edit under a wall = the kit stays, no gaps)
export const RB_ORIGIN = [-425.5, 20.1, -84];
let RBP = null;
export function layoutMatch(a, b) { if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) { const p = a[i], q = b[i]; if (p.kind !== q.kind || Math.abs(p.w - q.w) > 0.02 || Math.abs(p.d - q.d) > 0.02 || Math.abs(p.h - q.h) > 0.6) return false;
    for (const j of [12, 14]) if (Math.abs(p.e[j] - q.e[j]) > 0.02) return false; if (Math.abs(p.e[13] - q.e[13]) > 0.35) return false; } return true; }
function rbPlazaGLB(low, lay) {
  if (!RBB_ON || HILLTOP_KIT || typeof window === 'undefined' || typeof fetch === 'undefined') return Promise.resolve(null);
  if (!RBP) { const solid = libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp() }), low); solid.name = 'rb_plaza_solid';
    RBP = fetch('assets/island/rb_plaza_layout.json').then(r => r.json()).then(ref => { if (!layoutMatch(ref.pieces, lay)) { console.warn('[hill_round] rb_plaza layout differs from this build: the kit stone stays'); RB_STATS.plazaMismatch = true; return null; }
      return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`assets/island/rb_plaza${low ? '_low' : ''}.glb`).then(gl => {
        const want = low ? 'rb_plaza_LOD1' : 'rb_plaza_LOD0'; let mesh = null; gl.scene.traverse(o => { if (o.isMesh && (o.name === want || o.parent?.name === want)) mesh = o; });
        if (!mesh) return null; const m = keepNode(mesh, solid, 'rb_plaza_glb'); m.position.set(...RB_ORIGIN); m.children[0].castShadow = !low; m.children[0].receiveShadow = true;
        RB_STATS.plazaTris = mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3; return m; }); })
      .catch(e => { console.warn('[hill_round] Blender plaza failed, the kit stone stays', e); return null; }); }
  return RBP;
}
const Y = 20.1;   // >= the natural ground anywhere under the plaza (max 20.05): the deck is never under the grass
// BANKSY's sketch (12:35 PM, from under the gate arch): one wide paved plaza filling the view, the fountain centred a little way out, a low wall on
// the far rim with the bridge head in the middle; LEFT = the path down the hill (the Pirates' Climb, its own route), RIGHT = up to the castle
// [hilltop] BANKSY 9:31 PM "Want that entire hill fixed": the plaza grows 10 m east (35 x 24 m: a proper roundabout, fountain centred on the
// new court, paved ring r 12.5 + an outer kerb ring), so the Blender rb_plaza.glb (baked for the 25 m plaza) no longer matches: HILLTOP_KIT = the
// kit stone for this preview (&rbplazaglb=1 = try the old bake anyway; the layout guard then keeps the kit). Re-bake after BANKSY OKs the layout.
// [plaza-bake] BANKSY OK'd the layout (10:29 PM): rb_plaza(_low).glb re-baked for the 35 x 24 m plaza -> the Blender stone is back; &rbplazaglb=0 = the kit stone
export const HILLTOP_KIT = RBB_ON && typeof location !== 'undefined' && /[?&]rbplazaglb=0(&|$)/.test(location.search);
export const RB2 = RBB_ON ? { c: [-420.5, AXZ], y: Y, plaza: [-438, -403, AXZ - 12, AXZ + 12], r: 11.5, half: 2.3, sag: 0.5, piers: [1 / 3, 2 / 3], end: [-282, -72], az: AXZ }
  : { c: [-425.5, -88], y: Y, plaza: [-438, -413, -100, -76], r: 9.5, half: 2.3, sag: 0.5, piers: [1 / 3, 2 / 3], end: [-282, -72], az: -88 };
const [CX, CZ] = RB2.c, [PX0, PX1, PZ0, PZ1] = RB2.plaza;
// the fountain (BANKSY's later wishing fountain: a rim spot for the prompt + where a thrown coin splashes), world coords
// [hilltop] the fountain scaled x1.4 about its centre (FS) to suit the bigger roundabout (collider + wishing spot scale with it)
const FS = RBB_ON ? 1.4 : 1, BR0 = 4.2;
export const FOUNTAIN = { x: CX, z: CZ, basinR: BR0 * FS, rimY: Y + 0.75 * FS, waterY: Y + 0.62 * FS };
export const FOUNTAIN_ANCHORS = { rim: { x: CX - 4.75 * FS, y: Y, z: CZ }, coin: { x: CX - 2.6 * FS, y: Y + 0.62 * FS, z: CZ }, radius: 1.6 };
// [wish] the wishing spot, read at runtime from assets/island/fountain_anchor.json (rim / coin / radius) so it follows the fountain if it moves
// (Timothy's rb-blender pass: z -84); missing / bad file = FOUNTAIN_ANCHORS above. &wish=0 = no wishing fountain at all.
export const WISH_ON = !(typeof location !== 'undefined' && /[?&]wish=0(&|$)/.test(location.search));
export const WISH_AT = { rim: { ...FOUNTAIN_ANCHORS.rim }, coin: { ...FOUNTAIN_ANCHORS.coin }, radius: FOUNTAIN_ANCHORS.radius };
let WISH_Q = null;
export function applyWishAnchor(j) { const ok = (p) => p && [p.x, p.y, p.z].every(Number.isFinite);
  if (!j || !ok(j.rim) || !ok(j.coin)) return false;
  Object.assign(WISH_AT.rim, { x: +j.rim.x, y: +j.rim.y, z: +j.rim.z }); Object.assign(WISH_AT.coin, { x: +j.coin.x, y: +j.coin.y, z: +j.coin.z });
  if (Number.isFinite(+j.radius) && +j.radius > 0) WISH_AT.radius = +j.radius;
  if (WISH_Q) Object.assign(WISH_Q, { x: WISH_AT.rim.x, z: WISH_AT.rim.z, r: WISH_AT.radius + 1.4 }); return true; }
if (WISH_ON && typeof fetch !== 'undefined' && typeof location !== 'undefined') fetch('assets/island/fountain_anchor.json').then(r => r.ok ? r.json() : null).then(applyWishAnchor).catch(() => {});
// the Pirates' Climb stairs, on the trail's own line (trail A, plaza edge (-428, -100) -> the valley floor (-416, -119.3)): two flights + a landing,
// 4.6 m wide (the trail width); [id, u0, u1, y0, y1] along that line (y1 null = the ground at the foot, set in register)
const CL = { x0: -428, z0: RBB_ON ? PZ0 : -100, x1: -416, z1: -119.3, hw: 2.3 }; CL.L = Math.hypot(CL.x1 - CL.x0, CL.z1 - CL.z0); CL.yaw = Math.atan2(CL.x1 - CL.x0, CL.z1 - CL.z0);
const clAt = (u) => [CL.x0 + (CL.x1 - CL.x0) * u, CL.z0 + (CL.z1 - CL.z0) * u];
const ST = [['rb_f1', 0, 0.47, Y, 12.8], ['rb_l1', 0.47, 0.58, 12.8, 12.8], ['rb_f2', 0.58, 1, 12.8, null]].map(([id, u0, u1, y0, y1]) => {
  const [x0, z0] = clAt(u0), [x1, z1] = clAt(u1); return { id, u0, u1, x0, z0, x1, z1, y0, y1, hw: CL.hw, L: Math.hypot(x1 - x0, z1 - z0), yaw: CL.yaw, flat: y0 === y1 }; });
const ACR = [Math.cos(CL.yaw), -Math.sin(CL.yaw)], cheek = (s, u) => { const [x, z] = clAt(u); return [x + ACR[0] * s * (CL.hw + 0.25), z + ACR[1] * s * (CL.hw + 0.25)]; };
const uEdge = (s) => { const z = cheek(s, 0)[1]; return z < PZ0 - 0.25 ? 0 : (z - (PZ0 - 0.25)) / (CL.z0 - CL.z1); };   // where each cheek leaves the plaza
// [stairs2] BANKSY 2:18-2:26 PM "Stair fix is worst redesign the stairs down the hill / trail" + "Make it curve, line it up flush": with the
// Blender plaza on (RBB_ON) the Pirates' Climb is ONE CURVED FLIGHT. From a paved landing that opens off the plaza's S rim (its SW corner, flush
// with the paving: same height, no lip), the stair sweeps east under the plaza's south wall and curves round down the hill into the trail
// (the last metres run ON the trail's own line + direction, the bottom tread = the trail surface). 5 m between the walls (trail 4.6), ~90 even
// risers of ~15.5 cm on ~33 cm goings (the hill sets the grade: the flight may stand on masonry but never dips under the ground). Walk = one
// PATH deck (foot.js pathDeckY: the line through every tread centre), low walls + coping follow the curve flush with the treads (colliders = the
// walls only), lantern piers top + bottom and wall lanterns on the way. The wedge between the plaza's S wall and the stair = a planted bed.
// (&rbblend=0 = the v214 two-flight stairs below, untouched.)
export const CLIMB = (() => { const P = [[-428.5, -100], [-414.6, -101.68], [-417.76, -116.58], [-413.49, -123.34]];   // cubic Bezier: P3 = trail A 45 m from the gate (3 m before the ford footbridge), P2 on its tangent
  const B = (t) => { const m = 1 - t; return [0, 1].map(j => m * m * m * P[0][j] + 3 * m * m * t * P[1][j] + 3 * m * t * t * P[2][j] + t * t * t * P[3][j]); };
  const raw = [B(0)], rs = [0]; for (let i = 1; i <= 800; i++) { const q = B(i / 800); rs.push(rs[i - 1] + Math.hypot(q[0] - raw[i - 1][0], q[1] - raw[i - 1][1])); raw.push(q); }
  const L = rs[800], at = (s) => { if (s <= 0) { const [x, z] = raw[0], [x1, z1] = raw[4], n = Math.hypot(x1 - x, z1 - z); return [x + (x1 - x) / n * s, z + (z1 - z) / n * s]; }
    let i = 1; while (i < 800 && rs[i] < s) i++; const f = (s - rs[i - 1]) / (rs[i] - rs[i - 1] || 1); return [raw[i - 1][0] + (raw[i][0] - raw[i - 1][0]) * f, raw[i - 1][1] + (raw[i][1] - raw[i - 1][1]) * f]; };
  const yawAt = (s) => { const a = at(Math.max(0, Math.min(L, s) - 0.15)), b = at(Math.min(L, Math.max(0, s) + 0.15)); return Math.atan2(b[0] - a[0], b[1] - a[1]); };
  return { P, L, at, yawAt, hw: 2.5, wall: 2.75, back: 5.5, y0: Y, rise: 0.155, n: 0, d: 0, yE: 0 }; })();
CLIMB.side = (s, off) => { const [x, z] = CLIMB.at(s), a = CLIMB.yawAt(s); return [x + Math.cos(a) * off, z - Math.sin(a) * off]; };   // off > 0 = the outer (S / W) side
CLIMB.walk = (s) => { const C = CLIMB; return Math.max(C.yE, Math.min(C.y0, C.y0 - C.rise * (s / C.d + 0.5))); };   // = every tread's top at its centre
// the trail falls ~7 cm/m across its width: the last 4 m of treads roll (about the stair's centre line) into that cross-fall, so the bottom tread meets
// the trail flush edge to edge (no buried corner on the uphill side, no lip on the downhill side)
CLIMB.roll = (s) => { const C = CLIMB, t = Math.min(1, Math.max(0, (s - (C.L - 4)) / 4)); return C.rE * t * t * (3 - 2 * t); };
CLIMB.walkO = (s, o) => CLIMB.walk(s) + CLIMB.roll(Math.max(0, s)) * o;   // walk height at offset o (o > 0 outer)
{ const C = CLIMB, a0 = C.yawAt(0), T = [Math.sin(a0), Math.cos(a0)], A = [Math.cos(a0), -Math.sin(a0)], [x0, z0] = C.at(0), bk = (t, o) => [x0 - T[0] * t + A[0] * o, z0 - T[1] * t + A[1] * o];
  C.a0 = a0; C.land = { c: bk(C.back / 2, 0), hl: C.back / 2 };   // the landing: a box behind the first tread (+ a strip up to the rim)
  const bo = bk(C.back + 0.25, C.wall), bi = bk(C.back + 0.25, -0.3), rim = [bi[0] + (bi[0] - bo[0]) / (bi[1] - bo[1]) * (PZ0 - 0.25 - bi[1]), PZ0 - 0.25];
  C.landRect = [rim[0] + 0.3, C.side(0, -C.wall)[0] - 0.12, bk(0, -C.hw)[1] - 0.25, PZ0 + 0.2];   // x0 x1 z0 z1: the strip between the landing box + the plaza rim
  C.rimW = rim[0]; C.rimE = C.side(0, -C.wall)[0] - 0.15;   // the opening in the plaza's S parapet
  const outer = [rim, bo], inner = [[C.rimE, PZ0 - 0.25]];
  for (let s = 0; s <= C.L + 1e-6; s += 0.75) { outer.push(C.side(Math.min(s, C.L), C.wall)); inner.push(C.side(Math.min(s, C.L), -C.wall)); }
  if (outer.length && Math.hypot(...[0, 1].map(j => outer[outer.length - 1][j] - C.side(C.L, C.wall)[j])) > 0.05) { outer.push(C.side(C.L, C.wall)); inner.push(C.side(C.L, -C.wall)); }
  C.walls = { outer, inner };
  // the wedge between the plaza's S parapet (south face z PZ0 - 0.5) and the Climb's inner wall (north face): a planted bed, 0.5 m strips, closed
  // by an end wall where it is 4.5 m wide (or at the plaza's SE corner)
  const zIn = (x) => { for (let i = 2; i < inner.length; i++) { const [ax, az] = inner[i - 1], [bx, bz] = inner[i]; if ((x - ax) * (x - bx) <= 0 && ax !== bx) return az + (bz - az) * (x - ax) / (bx - ax); } return null; };
  C.bed = []; for (let x = C.rimE + 0.45, i = 0; x < PX1; x += 0.5, i++) { const zw = zIn(x); if (zw === null) break; const z0 = zw + 0.22, z1 = PZ0 - 0.48; if (z1 - z0 > 4.5) break; if (z1 - z0 > 0.05) C.bed.push({ i, x, z0, z1 }); }
  C.bedEnd = C.bed.length ? C.bed[C.bed.length - 1] : null; }
// [stairs2] the town-side ramp + its two broad steps only span the hill-street mouth (z -92 .. -76, between the fronts of shops #32 rent_12 and
// #44 rent_22): they used to run the plaza's full 24 m, ~1 m into both shops
const WEST_HW = 7.9;
// parapets / cheek walls (colliders + the low walls you see): polylines just outside the walk edges
const WALLS = RBB_ON ? [
  [[-430, PZ1 + 0.25], [PX1 + 0.25, PZ1 + 0.25], [PX1 + 0.25, RB2.az + 2.9]],          // plaza N (east of the castle opening x -438..-430) + E down to the bridge
  [[PX1 + 0.25, RB2.az - 2.9], [PX1 + 0.25, PZ0 - 0.25], ...CLIMB.walls.inner],      // plaza E (south of the bridge) + S rim -> the Climb's inner wall, one unbroken wall (no slot)
  [[PX0 - 0.3, PZ0 - 0.25], ...CLIMB.walls.outer],                                    // plaza S rim west of the landing -> round the landing -> the Climb's outer wall
] : [
  [[-430, PZ1 + 0.25], [PX1 + 0.25, PZ1 + 0.25], [PX1 + 0.25, RB2.az + 2.9]],          // plaza N (east of the castle opening x -438..-430) + E down to the bridge
  [[PX1 + 0.25, RB2.az - 2.9], [PX1 + 0.25, PZ0 - 0.25], [cheek(-1, uEdge(-1))[0], PZ0 - 0.25]],   // plaza E (south of the bridge) + S to the stair head
  [cheek(-1, uEdge(-1)), cheek(-1, 1)], [cheek(1, uEdge(1)), cheek(1, 1)],            // the stair's two cheek walls
  // [stairfix] BANKSY 1:36 PM "I got stuck down here": the plaza's S rim WEST of the stair head had no parapet (only the retaining wall you
  // see), so you walked off the 2-8 m drop into the slot between the stair's west cheek wall and the hill. Now a parapet runs from the
  // town-side ramp's foot along the rim and joins the cheek wall (no gap): the only way down is the stairs.
  [[PX0 - 1.6, PZ0 - 0.25], [cheek(1, uEdge(1))[0], PZ0 - 0.25]],
];
const LAMPS = RBB_ON ? [[PX1 - 1.3, PZ1 - 1.3], [PX1 - 1.3, PZ0 + 1.3], [PX0 + 0.6, CZ - 7.6], [PX0 + 0.6, CZ + 7.6]]   // mirrored about the street axis (the W pair flank the street mouth where the arch was)
  : [[PX1 - 1.3, PZ1 - 1.3], [PX1 - 1.3, PZ0 + 1.3], [-429.2, PZ1 - 1.2], [PX0 + 1.5, PZ0 + 1.4]];   // never in an exit (the hill street enters at z -91..-77)
const BENCHES = (CLEAN ? [] : RBB_ON ? [0.62, -0.62 + Math.PI, Math.PI + 0.62, -0.62] : [0.45, 2.3, -2.2]).map(a => ({ x: CX + Math.sin(a) * 7.4, z: CZ + Math.cos(a) * 7.4, yaw: a }));
const PLANTERS = CLEAN ? [] : RBB_ON ? [[PX1 - 1.8, CZ - 5.6], [PX1 - 1.8, CZ + 5.6]] : [[PX0 + 1.8, -96.6], [-419.5, PZ1 - 1.6], [PX1 - 1.8, -96.4]];
const SIGNS = CLEAN ? [] : RBB_ON ? [[PX1 - 1.4, RB2.az + 3.6], [-429.6, PZ1 - 1.0]] : [[PX1 - 1.4, RB2.az + 3.6], [-430.4, PZ1 - 3.2]];
// the fort stair foot (fort.js LEG1 x -434, z -72 .. -46.5, hw 2, parapets at hw + 0.3, 1.0 m over the tread): gate piers with braziers
// flanking the foot, planters either side of the apron; lanterns + red banners on Post's parapets are visual only (no collider changes there)
const FORT_FOOT = { x: -434, z0: -72, z1: -46.5, y0: 20.2, y1: 31, hw: 2 }, GPIERS = [[-437.0, -72.7], [-431.0, -72.7]], CPLANT = [[-438.1, -73.6], [-429.4, -73.4]];
const CASTLE = { x0: -436, x1: -431, z0: PZ1 - 0.1, z1: COLISEUM_ON ? -63.6 : Math.max(-71.6, PZ1 + 0.4) };   // the approach to the fort stair (fort.js fort_stair_1 starts at z -72)
const HB = { ax: PX1 - 0.3, az: RB2.az, bx: 0, bz: 0, L: 0, yaw: 0, ya: Y, yb: Y, half: RB2.half, sag: RB2.sag, piers: RB2.piers, yAt: null };
HB.yAt = (u) => { u = Math.min(1, Math.max(0, u)); const P = [0, ...HB.piers, 1]; let k = 0; while (k < P.length - 2 && u > P[k + 1]) k++;
  const f = (u - P[k]) / (P[k + 1] - P[k]); return HB.ya + (HB.yb - HB.ya) * u - Math.sin(f * Math.PI) * HB.sag; };
export const _hb = HB;
export const RB_STATS = { replaced: [], lamps: [] };
const OLD_STAIRS = (s) => s.x > -432 && s.x < -414 && s.z > -119 && s.z < -94;   // Post's route_stair_3..9 (the gate -> the ford)

// [v220] BANKSY 3:51 PM "fix the side of castle": the plaza's tall retaining faces (N towards the castle, E under the bridge head, S over the
// Climb) and the Climb's outer wall were one flat sheet of ashlar. Their OUTER faces (never the walk side) get pilasters every ~3.6 m where the
// wall stands > 1.7 m over the ground (battered base, cap under the coping, a wall lantern on every other one), a plinth course along the foot
// and a string course under the deck on the level runs; ivy + shrubs in the bays (kit). Structural pieces go through SB (the Blender bake);
// colliders = the pilasters (register). Visual + colliders only: walk decks unchanged.
let CS_SAMP = null;
const climbS = (x, z) => { const C = CLIMB; if (!CS_SAMP) { CS_SAMP = []; for (let s = -C.back - 1; s <= C.L; s += 0.2) CS_SAMP.push([s, ...C.at(s)]); }
  let b = 1e18, bs = 0; for (const [s, px, pz] of CS_SAMP) { const d = (px - x) ** 2 + (pz - z) ** 2; if (d < b) { b = d; bs = s; } } return [bs, Math.sqrt(b)]; };
const walkish = (x, z) => (x >= PX0 - 0.3 && x <= PX1 + 0.3 && z >= PZ0 - 0.3 && z <= PZ1 + 0.3) || climbS(x, z)[1] < CLIMB.wall + 0.6;
const walkY0 = (x, z) => { if (x >= PX0 - 0.6 && x <= PX1 + 0.6 && z >= PZ0 - 0.6) return Y; const [s] = climbS(x, z); return s <= 0 ? Y : CLIMB.walk(s); };
let DRESS = null;
export function wallDress(H) { if (DRESS) return DRESS; const D = DRESS = { pil: [], plinth: [], string: [], bays: [] }; if (!RBB_ON) return D;
  const gAt = (x, z, nx, nz) => Math.min(H(x + nx * 0.35, z + nz * 0.35), H(x + nx * 0.9, z + nz * 0.9));
  WALLS.forEach((pl, pi) => { let acc = 1.8;
    for (let i = 1; i < pl.length; i++) { if (pi === 1 && i >= 3) break;   // (the Climb's inner wall: its far face is the planted bed)
      const [ax, az] = pl[i - 1], [bx, bz] = pl[i], L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue; const ux = (bx - ax) / L, uz = (bz - az) / L, yaw = Math.atan2(ux, uz);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2; let nx = uz, nz = -ux; if (walkish(mx + nx * 1.3, mz + nz * 1.3)) { nx = -nx; nz = -nz; } if (walkish(mx + nx * 1.3, mz + nz * 1.3) || !walkish(mx - nx * 1.0, mz - nz * 1.0)) { acc += L; continue; }
      // plinth + string course: chunks of <= 1.2 m (plinth follows the ground) / 2.4 m (string, level runs only)
      const nP = Math.max(1, Math.ceil(L / 1.2)); for (let j = 0; j < nP; j++) { const t = (j + 0.5) / nP, x = ax + (bx - ax) * t, z = az + (bz - az) * t, w = walkY0(x, z), g = gAt(x + nx * 0.25, z + nz * 0.25, nx, nz);
        if (w - g > 1.0) D.plinth.push({ x: x + nx * 0.36, z: z + nz * 0.36, yaw, l: L / nP + 0.02, g }); }
      const lvl = Math.abs(walkY0(ax, az) - walkY0(bx, bz)) < 1e-3 && Math.abs(walkY0(ax, az) - Y) < 1e-3, nS = Math.max(1, Math.ceil(L / 2.4));
      if (lvl) for (let j = 0; j < nS; j++) { const t = (j + 0.5) / nS, x = ax + (bx - ax) * t, z = az + (bz - az) * t, g = gAt(x + nx * 0.25, z + nz * 0.25, nx, nz); if (Y - g > 1.6) D.string.push({ x: x + nx * 0.31, z: z + nz * 0.31, yaw, l: L / nS + 0.02 }); }
      // pilasters every 3.6 m along the run
      let d = 3.6 - acc % 3.6; for (; d < L; d += 3.6) { const x = ax + ux * d, z = az + uz * d, w = walkY0(x, z), g = gAt(x + nx * 0.25, z + nz * 0.25, nx, nz);
        if (w - g < 1.7 || walkish(x + nx * 1.6, z + nz * 1.6) || d < 0.6 || d > L - 0.6) continue;
        D.pil.push({ x: x + nx * 0.46, z: z + nz * 0.46, fx: x + nx * 0.25, fz: z + nz * 0.25, nx, nz, yaw, g: g - 0.3, top: w + 0.9 - 0.36, i: D.pil.length }); }
      acc += L; } });
  for (let i = 1; i < D.pil.length; i++) { const a = D.pil[i - 1], b = D.pil[i]; if (Math.hypot(a.x - b.x, a.z - b.z) < 4.5 && Math.abs(a.yaw - b.yaw) < 0.6) D.bays.push({ x: (a.fx + b.fx) / 2, z: (a.fz + b.fz) / 2, nx: a.nx, nz: a.nz, yaw: a.yaw, top: Math.min(a.top, b.top), g: Math.max(a.g, b.g) + 0.3, i }); }
  return D; }

// [v220] the castle's side (the knoll's south face, right above the plaza's N parapet: 16 m of bare cut slope between the plaza and the fort's south
// wall in BANKSY's 3:51 PM shot): two dry-stone terrace walls on the 24 m + 30.5 m contours (coursed, coping, planted beds behind them: shrubs,
// flowers, ivy over the edge) + ivy curtains down the fort's south wall. Stone through SB (the bake), plants on the kit, colliders = the walls.
let TERR = null;
export function castleTerraces(H) { if (TERR) return TERR; TERR = []; if (!RBB_ON) return TERR;
  for (const [lvl, x0, x1] of [[24, -427, -394], [30.5, -424, -396]]) { const pts = [];
    for (let x = x0; x <= x1 + 1e-6; x += 1.5) { let zc = null; for (let z = -73.5; z < -55; z += 0.1) if (H(x, z) >= lvl) { zc = z; break; } if (zc !== null && zc > PZ1 + 1.2) pts.push([x, zc]); else if (pts.length) break; }
    for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L > 4) continue;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, yaw = Math.atan2(bx - ax, bz - az), g = Math.min(H(mx, mz - 0.8), H(ax, az - 0.8), H(bx, bz - 0.8)) - 0.3;
      TERR.push({ x: mx, z: mz, yaw, L, g, top: lvl + 0.75, lvl, i: TERR.length }); } }
  return TERR; }

// [hilltop] BANKSY 9:31 PM "Want that entire hill fixed": the fort knoll read as a bare grey/green cone. Dressed retaining rings all round
// the mound on the 27 m + 33 m contours (coursed ashlar, coping, planted beds, ivy), skipping the fort stair corridor + the plaza. Visual stone
// on the plain kit (NOT the Blender bake: rb_plaza_layout.json unchanged), colliders = the ring walls (like the v220 terraces).
let MOUND = null;
const MC = [-408, -44];
// [castle-access] BANKSY 10:41 PM "cant get to castle": the skip only covered leg 1 (x < -427); the 33.4 m ring ran straight across
// leg 2 (z -44, x -431.5 -> the gate at -421) just below the gate mouth, an invisible wall. Leg 2 + the gate mouth are skipped too.
// BANKSY castle last-step: 2D mound rings below the fort blocked its y=42 wall-walk.
const moundSkip = (x, z) => (x > -440 && x < -427 && z < -38) || (x > -440 && x < -418 && Math.abs(z + 44) < 4.5) || (z < PZ1 + 2 && x < PX1 + 3) || (x > -426 && x < -390 && z > -62 && z < -26); // [fort-upper] full fort + gatehouse + 4 bastions
export function moundRings(H) { if (MOUND) return MOUND; MOUND = []; if (!RBB_ON) return MOUND;
  for (const lvl of [21, 27.2, 33.4]) { let prev = null, first = null;
    for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a); let pt = null;
      for (let r = 14; r < 46; r += 0.25) { const x = MC[0] + ux * r, z = MC[1] + uz * r; if (H(x, z) < lvl) { pt = [x, z]; break; } }
      if (pt && moundSkip(pt[0], pt[1])) pt = null;
      if (pt && prev) { const L = Math.hypot(pt[0] - prev[0], pt[1] - prev[1]); if (L < 5.5) { const mx = (pt[0] + prev[0]) / 2, mz = (pt[1] + prev[1]) / 2;
        MOUND.push({ x: mx, z: mz, L, yaw: Math.atan2(pt[0] - prev[0], pt[1] - prev[1]), g: 0, top: lvl + 1.6, nx: (mx - MC[0]), nz: (mz - MC[1]), i: MOUND.length }); } }
      prev = pt; } }
  for (const m of MOUND) { const n = Math.hypot(m.nx, m.nz) || 1; m.nx /= n; m.nz /= n; m.g = Math.min(H(m.x, m.z), H(m.x + m.nx * 1.5, m.z + m.nz * 1.5)) - 0.4; }
  return MOUND; }

export default {
  id: 'hill_round', name: 'Fountain plaza + Pirates\' Climb stairs + high rope bridge', rect: [-440, -278, -128, -60],
  // [v220] BANKSY 3:57 PM "fix the trail on that end of rope bridge to the next rope bridge": the plateau landing -> trail A is a real paved trail
  // (the loop's cobble splat + kerb stones, 4.6 m: paint only, no height change) instead of loose flags thinning out + rocks; it meets trail A
  // east of the old cliff drop (foot.js A_DEAD now leaves that unpainted), and trail A runs on along the cutting floor to D3's rope bridge
  terrain: { pads: [], cuts: [], paths: RBB_ON ? [{ id: 'rb_plateau_path', pts: [[-280.6, -71.9], [-278.0, -70.4], [-275.5, -66.2], [-271.5, -62.6], [-266, -59.8], [-260, -58.6], [-230, -60], [-205, -63]], pave: true }] : []  /* [v328] flush to east landing lip → Trail A → Gill dock */ },
  register(h) {
    const { H, AREA_DECKS = [], collidersOff = null } = h;   // (from foot.js: no import, no module cycle)
    // the plateau end: walk in from the target until the ground stops rising (the cliff top), deck end = that ground
    { const [ex, ez] = RB2.end; let bx = ex, bz = ez; const ux = HB.ax - ex, uz = HB.az - ez, n = Math.hypot(ux, uz);
      for (let s = 0; s < 20; s += 0.5) { const x = ex + ux / n * s, z = ez + uz / n * s; if (H(x, z) < H(ex, ez) - 0.6) break; bx = x; bz = z; }
      Object.assign(HB, { bx, bz, yb: H(bx, bz), L: Math.hypot(bx - HB.ax, bz - HB.az), yaw: Math.atan2(bx - HB.ax, bz - HB.az) }); }
    h.addHighBridge?.(HB);
    // [v328] BANKSY t1735u: east plateau landing was VISUAL ONLY (10×7 m white tiles at ~HB.yb) while
    // highBridgeAt stops at L+0.6 and H() under the cliff edge drops 0.3–18 m — pirate sank waist-deep /
    // fell through. Solid addDeck covers the tiles; graded ramp eases onto rb_plateau_path; lantern
    // newels get corner circs ONLY (bridge mouth + 9 m front stay open).
    if (RBB_ON) { const ux = Math.sin(HB.yaw), uz = Math.cos(HB.yaw), c0 = Math.cos(HB.yaw), s0 = Math.sin(HB.yaw);
      const d0 = -0.4, d1 = 7.4, mid = (d0 + d1) / 2;
      h.addDeck({ id: 'rb_hb_east_land', x: HB.bx + ux * mid, z: HB.bz + uz * mid, hw: 5.2, hl: (d1 - d0) / 2, yaw: HB.yaw, y: HB.yb });
      const rd0 = 7.2, rLen = 8.0, rMid = rd0 + rLen / 2, ex = HB.bx + ux * (rd0 + rLen), ez = HB.bz + uz * (rd0 + rLen);
      h.addDeck({ id: 'rb_hb_east_ramp', x: HB.bx + ux * rMid, z: HB.bz + uz * rMid, hw: 2.8, hl: rLen / 2, yaw: HB.yaw, y: HB.yb, y1: H(ex, ez) + 0.03 });
      for (const s of [-1, 1]) { const x = HB.bx + ux * 7 + c0 * s * 5.1, z = HB.bz + uz * 7 - s0 * s * 5.1; h.addCirc(x, z, 0.45); }
      h.poi('high_bridge_e_path', 'High rope bridge: plateau path', HB.bx + ux * 10, HB.bz + uz * 10, { clear: 7 }); }
    // the plaza + the stairs (walk decks)
    h.addDeck({ id: 'rb_plaza', x: (PX0 + PX1) / 2, z: (PZ0 + PZ1) / 2, hw: (PX1 - PX0) / 2, hl: (PZ1 - PZ0) / 2, yaw: 0, y: Y });
    h.addDeck({ id: 'rb_castle', x: (CASTLE.x0 + CASTLE.x1) / 2, z: (CASTLE.z0 + CASTLE.z1) / 2, hw: (CASTLE.x1 - CASTLE.x0) / 2, hl: (CASTLE.z1 - CASTLE.z0) / 2, yaw: 0, y: Y, y1: COLISEUM_ON ? Y : Math.max(H(-434, CASTLE.z1), 20.2) });
    h.addDeck({ id: 'rb_west', x: PX0 - 0.7, z: RBB_ON ? CZ : (PZ0 + PZ1) / 2, hw: RBB_ON ? WEST_HW : (PZ1 - PZ0) / 2, hl: 0.75, yaw: Math.PI / 2, y: H(PX0 - 1.45, RBB_ON ? CZ - 7 : -95), y1: Y });   // the town side: a 1.5 m ramp onto the plaza, not a 0.4 m lip
    if (RBB_ON) { const C = CLIMB, [ex, ez] = C.at(C.L);   // [stairs2] the curved Climb: n even risers from the plaza (Y) to the trail surface at its foot
      C.yE = H(ex, ez) + 0.03; { const [ox, oz] = C.side(C.L, C.hw - 0.1), [ix, iz] = C.side(C.L, -C.hw + 0.1); C.rE = (H(ox, oz) - H(ix, iz)) / (2 * C.hw - 0.2); } C.n = Math.round((C.y0 - C.yE) / 0.155); C.rise = (C.y0 - C.yE) / C.n; C.d = C.L / C.n;
      const path = [], ps = []; for (let s = -C.d / 2; s < C.L + 0.1; s += 0.25) { const q = Math.min(s, C.L); path.push(C.at(q)); ps.push(q); if (q === C.L) break; }
      const xs = path.map(q => q[0]), zs = path.map(q => q[1]), m = C.hw + 0.5;
      h.addDeck({ id: 'rb_climb', path, ps, hw: C.hw, yAt: C.walk, yAtO: C.walkO, bb: [Math.min(...xs) - m, Math.max(...xs) + m, Math.min(...zs) - m, Math.max(...zs) + m], x: C.at(C.L / 2)[0], z: C.at(C.L / 2)[1], y: C.walk(C.L / 2) });
      const [lx, lz] = C.land.c, T = [Math.sin(C.a0), Math.cos(C.a0)];   // the landing (plaza height) up to half a tread before the first nosing, + the strip to the rim
      h.addDeck({ id: 'rb_climb_land', x: lx - T[0] * C.d / 2, z: lz - T[1] * C.d / 2, hw: C.hw + 0.05, hl: C.back / 2, yaw: C.a0, y: Y });
      const [rx0, rx1, rz0, rz1] = C.landRect; h.addDeck({ id: 'rb_climb_rim', x: (rx0 + rx1) / 2, z: (rz0 + rz1) / 2, hw: (rx1 - rx0) / 2, hl: (rz1 - rz0) / 2, yaw: 0, y: Y });
    } else { const last = ST[ST.length - 1]; last.y1 = H(last.x1, last.z1) + 0.03;
      for (const s of ST) h.addDeck({ id: s.id, x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2, hw: s.hw, hl: s.L / 2 + 0.06, yaw: s.yaw, y: s.y0, ...(s.flat ? {} : { y1: s.y1 }) }); }
    // Post's steps on that stretch: decks off, treads + cheeks sunk out of sight (his edging stays skipped there: the stair entries remain)
    for (const d of AREA_DECKS) if (/^route_stair_/.test(d.id) && OLD_STAIRS(d)) { d.off = true; RB_STATS.replaced.push(d.id); }
    for (const s of RT.stairs || []) if (OLD_STAIRS(s)) { s.prof = s.prof.map(() => -60); s.low = s.low.map(() => -61); }
    { const gone = (RT.walls || []).filter(w => w.x > -433 && w.x < -414 && w.z > -119 && w.z < -94); RT.walls = (RT.walls || []).filter(w => !gone.includes(w));   // his retaining walls there: mesh + collider
      RB_STATS.wallsOff = collidersOff?.((o) => o.t === 1 && gone.some(w => Math.abs(o.x - w.x) < 1e-6 && Math.abs(o.z - w.z) < 1e-6)) ?? 0; }
    { const l = (RT.lamps || []).find(q => q.k === 0); if (l && l.x > PX0 && l.x < PX1 && l.z > PZ0 && l.z < PZ1) { l.y = Y; l.onWall = false; RB_STATS.lamps.push(0); } }   // lamp 0 now stands on the plaza
    if (RBB_ON) { const l = (RT.lamps || []).find(q => q.k === 1), C = CLIMB, [px, pz] = C.side(C.L, -C.wall);   // [stairs2] lamp 1 stood 0.7 m from the Climb's inner foot pier: 1.4 m on down the trail
      if (l && Math.hypot(l.x - px, l.z - pz) < 1.3) { const ox = l.x, oz = l.z, ux = Math.sin(l.yaw), uz = Math.cos(l.yaw); collidersOff?.((o) => o.t === 0 && Math.abs(o.x - ox) < 1e-6 && Math.abs(o.z - oz) < 1e-6);
        l.x += ux * 1.4; l.z += uz * 1.4; if (!l.onWall) l.y = H(l.x, l.z); h.addCirc(l.x, l.z, 0.3); const it = h.INTERACT.find(q => q.id === 'route_lamp_1'); if (it) { it.x += ux * 1.4; it.z += uz * 1.4; } RB_STATS.lamps.push(1); } }
    { const sg = RT.lm?.sign; if (sg && sg.x > PX0 && sg.x < PX1 && sg.z > PZ0 && sg.z < PZ1) { const ox = sg.x, oz = sg.z;   // the TOWN / FORT / JUNGLE post: off the fountain, to the head of the stairs
      collidersOff?.((o) => o.t === 0 && Math.abs(o.x - ox) < 1e-6 && Math.abs(o.z - oz) < 1e-6); Object.assign(sg, CLEAN ? (() => { const s = CLIMB.L - 1.2, [x, z] = CLIMB.side(s, CLIMB.wall + 0.9); return { x, z, y: H(x, z), yaw: CLIMB.yawAt(s) + Math.PI }; })() /* [v220] off the plaza paving: at the foot of the Climb where the trail goes on */ : RBB_ON ? { x: CLIMB.rimW - 1.6, z: PZ0 + 0.75, y: Y, yaw: CLIMB.a0 } /* [stairs2] beside the Climb's opening, not in it */ : { x: -433.2, z: -99.35, y: Y, yaw: CL.yaw } /* [stairfix] (main 714474c) against the new S parapet */); h.addCirc(sg.x, sg.z, 0.25); RB_STATS.sign = [ox, oz]; } }
    // colliders: fountain, parapets / cheek walls, lamps, benches, planters, bridge towers, piers
    h.addCirc(CX, CZ, FOUNTAIN.basinR + 0.15);
    // [wish] the wishing fountain: an E / tap spot on the rim (shown only while the server's 'wish_fountain' flag is on: inventory/ui.js PFP_INV_FLAGS)
    if (WISH_ON) h.INTERACT?.push(WISH_Q = { id: 'wish_fountain', kind: 'wish', area: 'hill_round', x: WISH_AT.rim.x, z: WISH_AT.rim.z, r: WISH_AT.radius + 1.4, label: 'E · TOSS A COIN (100 gold)', hidden: wishHidden });
    for (const pl of WALLS) for (let i = 1; i < pl.length; i++) { const [ax, az] = pl[i - 1], [bx, bz] = pl[i], L = Math.hypot(bx - ax, bz - az); h.addBox((ax + bx) / 2, (az + bz) / 2, 0.5, L + 0.5, Math.atan2(bx - ax, bz - az)); }
    for (const [x, z] of LAMPS) if(!clearCastleDressing(x,z)) h.addCirc(x, z, 0.3);
    for (const p of wallDress(H).pil) h.addBox(p.x, p.z, 0.62, 1.0, p.yaw);   // [v220] the pilasters on the walls' outer faces
    for (const t of castleTerraces(H)) h.addBox(t.x, t.z, 0.7, t.L + 0.3, t.yaw);
    for (const t of moundRings(H)) if(!clearColiStair(t.x,t.z) && !moundSkip(t.x,t.z)) h.addBox(t.x, t.z, 0.8, t.L + 0.3, t.yaw);   // [hilltop] the mound's ring walls   // [v220] the castle-side terrace walls
    if (RBB_ON && CLIMB.bedEnd) { const b = CLIMB.bedEnd; h.addBox(b.x + 0.25, (b.z0 + b.z1) / 2, 0.5, b.z1 - b.z0 + 0.6, 0); }   // [stairs2] the planted bed's open end: you can't walk into the wedge
    for (const b of BENCHES) h.addBox(b.x, b.z, 2.0, 0.7, b.yaw);
    for (const [x, z] of PLANTERS) h.addBox(x, z, 1.6, 1.6, 0);
    for (const t of [0, 1]) { const [x, z] = along(t), cs = Math.cos(HB.yaw), sn = Math.sin(HB.yaw); for (const s of [-1, 1]) h.addBox(x + cs * s * 3.25 - sn * (t ? -0.6 : 0.6), z - sn * s * 3.25 - cs * (t ? -0.6 : 0.6), 1.5, 1.5, HB.yaw); }
    for (const t of HB.piers) { const [x, z] = along(t); h.addBox(x, z, 6.4, 4.4, HB.yaw); }
    for (const [x, z] of SIGNS) h.addCirc(x, z, 0.25);
    for (let i = 0; i < 14; i++) { const [x, z, r] = rockfall(i); h.addCirc(x, z, r * 0.9); }
    for (const [x, z] of GPIERS) h.addBox(x, z, 0.9, 0.9, 0); for (const [x, z] of CPLANT) if (!clearCastleDressing(x,z)) h.addBox(x, z, 1.4, 1.4, 0);   // stone piers: solid down in the valley, the deck walks over them
    // foliage kept clear (POIs): the plaza, the stairs, both bridge heads
    h.poi('hill_round', 'Fountain plaza', CX, CZ, { clear: 19 });
    if (RBB_ON) for (const f of [0.2, 0.5, 0.8]) h.poi('rb_stairs' + (f === 0.5 ? '' : '_' + f * 10), "Pirates' Climb stairs", ...CLIMB.at(CLIMB.L * f), { clear: 8 });
    else h.poi('rb_stairs', "Pirates' Climb stairs", ...clAt(0.6), { clear: 9 });
    h.poi('high_bridge', 'High rope bridge to the waterfalls plateau', (HB.ax + HB.bx) / 2, (HB.az + HB.bz) / 2, { clear: 6 });
    h.poi('high_bridge_e', 'High rope bridge: plateau end', HB.bx, HB.bz, { clear: 9 });
  },
  build({ MATS, OUT, low, H }) {
    const k = new Kit(), near = new THREE.Group(), far = new THREE.Group(); near.name = 'area_hill_round'; far.name = 'area_hill_round_far';
    // [rb-blender] the structural stone goes on its own kit + is recorded (RB_LAYOUT: the Blender script's input); swapped for rb_plaza.glb below
    const ks = new Kit(), LAY = []; RB_LAYOUT.length = 0; const SB = (kind, g, c, m, o = true) => { const p = g.parameters; LAY.push({ kind, w: p.width, h: p.height, d: p.depth, c, e: Array.from(m.elements) }); W(ks, g, c, m, o); };
    const gmin = (x, z, r = 1.2) => Math.min(H(x, z), H(x + r, z), H(x - r, z), H(x, z + r), H(x, z - r));
    // ---- the plaza terrace: retaining walls down to the ground on the 3 open sides (coursed: band every 1.6 m), cobble deck + border
    const retain = (ax, az, bx, bz, nx, nz, top) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 2.4)), yaw = Math.atan2(bx - ax, bz - az);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, g = gmin(x + nx * 0.6, z + nz * 0.6, 1.4) - 0.4, hh = top - g; if (hh < 0.3) continue;
        SB('retain', box(0.8, hh, L / n + 0.03), i % 2 ? 0xb9b2a6 : 0xb0a99c, M(x + nx * 0.4, g + hh / 2, z + nz * 0.4, yaw), true);
        for (let r = 1.6; r < hh - 0.5; r += 1.6) SB('retain_band', box(0.86, 0.12, L / n + 0.05), 0x8a837a, M(x + nx * 0.42, top - r, z + nz * 0.42, yaw), false); } };
    retain(PX0, PZ1, -430, PZ1, 0, 1, Y); retain(PX1, RB2.az + 2.9, PX1, RB2.az - 2.9, 1, 0, Y); if (!RBB_ON) retain(PX0, PZ0, cheek(1, uEdge(1))[0], PZ0, 0, -1, Y);   // ([stairs2] the S rim: parapets all along + the Climb's landing)   // the openings (the parapet walls below are the rest)
    for (const [dx, dy] of [[-1.1, 0.36], [-0.35, 0.18]]) SB('step', box(0.8, 0.5, RBB_ON ? WEST_HW * 2 : PZ1 - PZ0), 0xd2c9b6, M(PX0 + dx, Y - dy - 0.25, RBB_ON ? CZ : (PZ0 + PZ1) / 2), false);   // the two broad steps on the town side (walk = the ramp)
    // deck: a slab whose top is the walk height; cobble field (the library's cobble layer), dressed-stone border band, a paved ring round the fountain
    SB('deck', box(PX1 - PX0, 0.5, PZ1 - PZ0), 0x9f9585, M(CX, Y - 0.25, (PZ0 + PZ1) / 2), false);
    for (const [x0, x1, z0, z1] of [[PX0, PX1, PZ0, PZ0 + 0.9], [PX0, PX1, PZ1 - 0.9, PZ1], [PX0, PX0 + 0.9, PZ0, PZ1], [PX1 - 0.9, PX1, PZ0, PZ1]])
      SB('border', box(x1 - x0, 0.06, z1 - z0), 0xd2c9b6, M((x0 + x1) / 2, Y + 0.005, (z0 + z1) / 2), false);
    W(ks, new THREE.CylinderGeometry(RB2.r, RB2.r, 0.05, 48), 0xc8bda7, M(CX, Y + 0.01, CZ), false);
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; W(ks, box(0.06, 0.06, RB2.r - FOUNTAIN.basinR - 0.3), 0x8f8676, M(CX + Math.sin(a) * (RB2.r + FOUNTAIN.basinR) / 2, Y + 0.02, CZ + Math.cos(a) * (RB2.r + FOUNTAIN.basinR) / 2, a), false); }
    for (let i = 0; i < 48; i++) { const a = (i + 0.5) / 48 * Math.PI * 2; W(ks, box(0.42, 0.14, 1.28), 0x8a837a, M(CX + Math.sin(a) * (RB2.r + 0.2), Y + 0.07, CZ + Math.cos(a) * (RB2.r + 0.2), a + Math.PI / 2), false); }
    const kfo = new Kit();   // the stone fountain on its own kit: swapped for the Blender model (rb_fountain.glb) once that has loaded
    // ---- the fountain: a broad octagonal basin with a thick rim, a carved pedestal, two bowls, a gilded finial
    W(kfo, new THREE.CylinderGeometry(BR0, BR0 + 0.25, 0.7, 8), 0xb9b2a6, M(CX, Y + 0.35, CZ, Math.PI / 8));
    W(kfo, new THREE.CylinderGeometry(BR0 + 0.15, BR0 + 0.15, 0.16, 8), 0xd2c9b6, M(CX, Y + 0.76, CZ, Math.PI / 8), false);
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2 + Math.PI / 8, r = BR0 + 0.12; W(kfo, box(0.5, 0.86, 0.5), 0x8a837a, M(CX + Math.sin(a) * r, Y + 0.43, CZ + Math.cos(a) * r, a), false); }
    W(kfo, cyl(0.9, 1.25, 0.6, 8), 0xb9b2a6, M(CX, Y + 0.9, CZ)); W(kfo, cyl(0.55, 0.8, 1.6, 8), 0xb0a99c, M(CX, Y + 2.0, CZ));
    W(kfo, cyl(2.1, 0.7, 0.55, 12), 0xb9b2a6, M(CX, Y + 3.05, CZ)); W(kfo, cyl(2.2, 2.2, 0.1, 12), 0xd2c9b6, M(CX, Y + 3.35, CZ), false);
    W(kfo, cyl(0.32, 0.45, 1.3, 8), 0xb0a99c, M(CX, Y + 4.0, CZ)); W(kfo, cyl(1.1, 0.35, 0.36, 10), 0xb9b2a6, M(CX, Y + 4.75, CZ)); W(kfo, cyl(1.15, 1.15, 0.08, 10), 0xd2c9b6, M(CX, Y + 4.95, CZ), false);
    W(kfo, cyl(0.14, 0.22, 0.6, 8), 0x8a837a, M(CX, Y + 5.25, CZ)); W(kfo, new THREE.SphereGeometry(0.28, 10, 8), C.GOLD, M(CX, Y + 5.7, CZ), false);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; W(kfo, box(0.36, 0.42, 0.5), 0xb0a99c, M(CX + Math.sin(a) * 0.62, Y + 2.55, CZ + Math.cos(a) * 0.62, a)); }   // spout heads
    // ---- lamps (iron post on a stone plinth), benches, planters with flowers
    const lamp = (x, y, z) => { if(clearCastleDressing(x,z)) return; W(k, box(0.55, 0.45, 0.55), 0xb0a99c, M(x, y + 0.22, z)); W(k, cyl(0.08, 0.11, 3.4, 6), C.IRON, M(x, y + 2.1, z)); W(k, box(0.5, 0.6, 0.5), 0x2b2f36, M(x, y + 3.95, z));
      W(k, box(0.38, 0.46, 0.52), 0xffd27a, M(x, y + 3.95, z), false); W(k, box(0.52, 0.46, 0.38), 0xffd27a, M(x, y + 3.95, z), false); W(k, cyl(0.02, 0.42, 0.3, 4), C.IRON, M(x, y + 4.4, z, Math.PI / 4), false); };
    for (const [x, z] of LAMPS) lamp(x, Y, z);
    for (const b of BENCHES) { const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); W(k, box(2.0, 0.12, 0.6), 0xd9a36b, M(b.x, Y + 0.48, b.z, b.yaw + Math.PI / 2)); W(k, box(2.0, 0.5, 0.1), 0xa86a3a, M(b.x + sn * 0.3, Y + 0.8, b.z + cs * 0.3, b.yaw + Math.PI / 2), false);
      for (const s of [-0.8, 0.8]) W(k, box(0.5, 0.45, 0.14), 0x8a837a, M(b.x + cs * s, Y + 0.22, b.z - sn * s, b.yaw + Math.PI / 2), false); }
    const planter = (x, y, z, s = 1.6) => { W(k, box(s, 0.6, s), 0xb0a99c, M(x, y + 0.3, z)); W(k, box(s + 0.14, 0.1, s + 0.14), 0xd2c9b6, M(x, y + 0.62, z), false); W(k, box(s - 0.2, 0.08, s - 0.2), 0x5a3a22, M(x, y + 0.64, z), false);
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + x, r = (i % 3) * 0.22, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;   // [plaza-bake] leafy mound + flower clumps (no red/yellow balls)
        if (i === 3 || i === 4 || i === 6) bloomClump(k, px, y + 0.82, pz, Math.round(i * 13 + x * 3 + z), 1.2, low);
        else k.add(jitter(new THREE.IcosahedronGeometry(0.26 + hash(i, x) * 0.12, 0), 0.2, i + z), [0x5f9a3a, 0x4e8a34, 0x6fae45, 0, 0, 0x5f9a3a][i], { m: M(px, y + 0.8 + (i % 2) * 0.08, pz, a, 0, 0, [1, 0.7, 1]), outline: false }); } };
    for (const [x, z] of PLANTERS) planter(x, Y, z);
    // ---- parapets + cheek walls: a low wall (0.9 m over the walk) with a dressed coping, following the walk height under it
    const walkY = (x, z) => { let y = null; for (const s of ST) { const dx = x - s.x0, dz = z - s.z0, u = (dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw)) / s.L, a = Math.abs(dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw));
      if (u < -0.02 || u > 1.02 || a > s.hw + 0.8) continue; const yy = s.y0 + (s.y1 - s.y0) * Math.min(1, Math.max(0, u)); y = y === null ? yy : Math.max(y, yy); }
      if (x >= PX0 - 0.6 && x <= PX1 + 0.6 && z >= PZ0 - 0.6 && z <= PZ1 + 0.6) y = Math.max(y ?? -1e9, Y); return y ?? H(x, z); };
    if (!RBB_ON) for (const pl of WALLS) for (let i = 1; i < pl.length; i++) { const [ax, az] = pl[i - 1], [bx, bz] = pl[i], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 1.0)), yaw = Math.atan2(bx - ax, bz - az);
      for (let j = 0; j < n; j++) { const t = (j + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, top = walkY(x, z) + 0.9, g = gmin(x, z, 0.8) - 0.3, hh = top - g;
        SB('parapet', box(0.5, hh, L / n + 0.02), j % 3 ? 0xb9b2a6 : 0xb0a99c, M(x, g + hh / 2, z, yaw), j % 2 === 0); SB('parapet', box(0.66, 0.12, L / n + 0.04), 0xd2c9b6, M(x, top + 0.06, z, yaw), false); } }
    if (RBB_ON) buildClimb({ SB, W, k, H, gmin, lampAt: lamp, low });
    if (RBB_ON) { const D = wallDress(H);   // [v220] the walls' outer faces: plinth, string course, pilasters (+ caps, lanterns), ivy + shrubs in the bays
      for (const p of D.plinth) SB('plinth', box(0.22, 0.75, p.l), 0x8a837a, M(p.x, p.g + 0.12, p.z, p.yaw), false);
      for (const p of D.string) SB('string', box(0.12, 0.16, p.l), 0xd2c9b6, M(p.x, Y - 0.32, p.z, p.yaw), false);
      for (const p of D.pil) { const hh = p.top - p.g, bh = Math.min(1.4, hh * 0.3);
        SB('pilaster', box(0.42, hh, 0.86), p.i % 2 ? 0xb0a99c : 0xb9b2a6, M(p.x, p.g + hh / 2, p.z, p.yaw), true);
        SB('pilaster', box(0.66, bh, 1.08), 0xa9a294, M(p.x + p.nx * 0.12, p.g + bh / 2, p.z + p.nz * 0.12, p.yaw), false);   // battered base
        SB('pcap', box(0.56, 0.16, 1.0), 0xd2c9b6, M(p.x + p.nx * 0.05, p.top - 0.08, p.z + p.nz * 0.05, p.yaw), false);
        if (p.i % 2 === 0 && !clearCastleDressing(p.x,p.z)) { const lx = p.x + p.nx * 0.36, lz = p.z + p.nz * 0.36, ly = p.top - 1.15;   // a wall lantern on an iron bracket
          W(k, box(0.08, 0.08, 0.42), C.IRON, M(p.x + p.nx * 0.3, ly + 0.42, p.z + p.nz * 0.3, p.yaw + Math.PI / 2), false);
          W(k, box(0.34, 0.44, 0.34), 0x2b2f36, M(lx + p.nx * 0.08, ly, lz + p.nz * 0.08, p.yaw)); W(k, box(0.26, 0.34, 0.36), 0xffd27a, M(lx + p.nx * 0.08, ly, lz + p.nz * 0.08, p.yaw), false); W(k, box(0.36, 0.34, 0.26), 0xffd27a, M(lx + p.nx * 0.08, ly, lz + p.nz * 0.08, p.yaw), false); } }
      for (const b of D.bays) { if(clearCastleDressing(b.x,b.z)) continue; if (low && b.i % 2) continue; const ivy = hash(b.i, 31) < 0.6, drop = Math.min(b.top - b.g - 0.4, 1.4 + hash(b.i, 33) * 1.8);
        if (ivy) for (let q = 0; q < 6; q++) { const f = q / 5, ax = Math.cos(b.yaw), az = -Math.sin(b.yaw), o = (hash(b.i, q) - 0.5) * 2.2, r = 0.34 - f * 0.12;   // ivy hanging from the coping
          k.add(jitter(new THREE.IcosahedronGeometry(r, 0), 0.3, b.i * 9 + q), [0x3f7d2c, 0x4e8a34, 0x5f9a3a][q % 3], { m: M(b.x + ax * o + b.nx * 0.06, b.top - 0.1 - f * drop, b.z + az * o + b.nz * 0.06, b.yaw, 0, 0, [0.45, 1.25, 1.5]), outline: false }); }   // (flat against the face)
        for (let q = 0; q < 3; q++) { const ax = Math.cos(b.yaw), az = -Math.sin(b.yaw), o = (q - 1) * 0.9 + (hash(q, b.i) - 0.5) * 0.3, x = b.x + ax * o + b.nx * 0.6, z = b.z + az * o + b.nz * 0.6, r = 0.36 + hash(b.i, q + 5) * 0.22;   // shrubs at the foot
          k.add(jitter(new THREE.IcosahedronGeometry(r, 0), 0.25, b.i * 5 + q), [0x4e8a34, 0x5f9a3a, 0x6fae45][(b.i + q) % 3], { m: M(x, H(x, z) + r * 0.55, z, q + b.i), outline: false });
          if ((b.i + q) % 4 === 0) bloomClump(k, x, H(x, z) + r * 1.2 - 0.084, z, Math.round((q) * 7 + (x) * 3), 0.82, low); } }
      for (const t of castleTerraces(H)) { const hh = t.top - t.g, ax = Math.sin(t.yaw), az = Math.cos(t.yaw), nx = az, nz = -ax, bk = nz > 0 ? 1 : -1;   // the castle-side terraces (bk: uphill = +z)
        SB('terrace', box(0.6, hh, t.L + 0.06), t.i % 2 ? 0xb0a99c : 0xb9b2a6, M(t.x, t.g + hh / 2, t.z, t.yaw), t.i % 2 === 0); SB('tcap', box(0.78, 0.16, t.L + 0.1), 0xd2c9b6, M(t.x, t.top + 0.08, t.z, t.yaw), false);
        const bx = t.x + nx * bk * 0.95, bz = t.z + nz * bk * 0.95; if(clearCastleDressing(bx,bz)) continue; W(k, box(1.3, 0.3, t.L + 0.05), 0x5a3a22, M(bx, t.top - 0.12, bz, t.yaw), false);   // the bed's soil, just under the coping
        if (!low || t.i % 2 === 0) for (let q = 0; q < 2; q++) { const o = (q - 0.5) * t.L * 0.5, x = bx + ax * o, z = bz + az * o, r = 0.42 + hash(t.i, q) * 0.3;
          k.add(jitter(new THREE.IcosahedronGeometry(r, 0), 0.25, t.i * 3 + q), [0x4e8a34, 0x5f9a3a, 0x6fae45][(t.i + q) % 3], { m: M(x, t.top + r * 0.5, z, t.i + q), outline: false });
          if ((t.i + q) % 3 === 0) bloomClump(k, x + 0.2, t.top + r * 1.05 - 0.102, z, Math.round((q + t.i) * 7 + (x + 0.2) * 3), 1.00, low); }
        if (t.i % 3 === 1) for (let q = 0; q < 4; q++) k.add(jitter(new THREE.IcosahedronGeometry(0.26, 0), 0.3, t.i * 7 + q), [0x3f7d2c, 0x4e8a34][q % 2], { m: M(t.x - nx * bk * 0.36 + ax * (hash(q, t.i) - 0.5) * t.L * 0.7, t.top - 0.15 - q * 0.33, t.z - nz * bk * 0.36 + az * (hash(q, t.i) - 0.5) * t.L * 0.7, t.yaw, 0, 0, [0.45, 1.2, 1.4]), outline: false }); }   // ivy over the edge
      { const fz = -57 - 0.85; for (let x = -419, i = 0; x < -396; x += 2.6, i++) { if (low && i % 2) continue; const drop = 1.6 + hash(i, 41) * 2.4;   // ivy curtains down the fort's south wall (outer face z ~ -57.8)
          for (let q = 0; q < 5; q++) k.add(jitter(new THREE.IcosahedronGeometry(0.34 - q * 0.04, 0), 0.3, i * 11 + q), [0x3f7d2c, 0x4e8a34, 0x5f9a3a][(i + q) % 3], { m: M(x + (hash(i, q) - 0.5) * 1.2, 41.6 - q * drop / 4, fz, 0, 0, 0, [1.4, 1.2, 0.45]), outline: false }); } }
      // the castle approach: a dressed-flag runner across the paving from the fountain court to the fort stair (flush with the border band)
      { const ex = -434, ez = PZ1 - 0.9, L0 = Math.hypot(ex - CX, ez - CZ), ux = (ex - CX) / L0, uz = (ez - CZ) / L0, yaw = Math.atan2(ux, uz), ax = Math.cos(yaw), az = -Math.sin(yaw), s0 = RB2.r + 0.45;
        const n = Math.max(2, Math.floor((L0 - s0) / 0.55)); for (let i = 0; i < n; i++) { const sc = s0 + (i + 0.5) * (L0 - s0) / n; for (let j = -1; j <= 1; j++) { const o = j * 1.1 + (i % 2 ? 0.28 : -0.28) * (j === 0 ? 0 : 1), x = CX + ux * sc + ax * o, z = CZ + uz * sc + az * o;
          SB('runner', box(1.04, 0.06, (L0 - s0) / n - 0.05), [0xd2c9b6, 0xc8bda7, 0xbfb39c][(i + j + 3) % 3], M(x, Y + 0.005, z, yaw), false); } }
        for (const sd of [-1, 1]) SB('runner', box(0.16, 0.06, L0 - s0), 0x8a837a, M(CX + ux * (s0 + L0) / 2 + ax * sd * 1.75, Y + 0.006, CZ + uz * (s0 + L0) / 2 + az * sd * 1.75, yaw), false); } }
    // ---- the stairs: one solid stone tread per 0.2 m rise down to the ground (masonry under it), landings = paved slabs; a lamp at each landing
    if (!RBB_ON) for (const s of ST) { const ux = Math.sin(s.yaw), uz = Math.cos(s.yaw), drop = s.y0 - s.y1, n = s.flat ? 1 : Math.max(2, Math.round(drop / 0.2)), d = s.L / n;
      for (let j = 0; j < n; j++) { const u = (j + 0.5) / n, x = s.x0 + (s.x1 - s.x0) * u, z = s.z0 + (s.z1 - s.z0) * u, top = s.flat ? s.y0 : s.y0 - drop * (j + 0.5) / n,
          bot = gmin(x, z, s.hw) - 0.4, hh = Math.max(0.3, top - bot);
        SB('tread', box(s.hw * 2, hh, d + 0.03), s.flat ? 0x9f9585 : (j % 2 ? 0xb9b2a6 : 0xb0a99c), M(x, top - hh / 2, z, s.yaw), j % 3 === 0);
        SB('tread_cap', box(s.hw * 2 - 0.1, 0.06, d - 0.06), s.flat ? 0xc8bda7 : 0xd2c9b6, M(x - ux * 0, top + 0.03, z, s.yaw), false); } }
    if (!RBB_ON) for (const sd of [-1, 1]) { const [x, z] = cheek(sd, (ST[1].u0 + ST[1].u1) / 2); lamp(x, ST[1].y0 + 0.96, z); }   // a lamp on each cheek wall at the landing
    // ---- the old east trail (the dip) now runs into the plaza's east wall: rubble + scrub at the wall foot, so it reads as the hillside
    for (let i = 0; i < (low ? 6 : 12); i++) { const x = PX1 + 1.2 + hash(i, 3) * 6, z = PZ1 - 3 + hash(i, 5) * 5, g = H(x, z), r = 0.6 + hash(i, 7) * 0.8;
      W(k, jitter(new THREE.IcosahedronGeometry(r, 0), 0.25, i), i % 3 ? 0x9e978a : 0x8a837a, M(x, g + r * 0.25, z, i, 0, 0, [1.3, 0.8, 1.1]), true);
      if (i % 2) k.add(jitter(new THREE.IcosahedronGeometry(r * 0.8, 0), 0.3, i + 1), 0x4e8a34, { m: M(x + 0.8, g + r * 0.35, z - 0.5, i), outline: false }); }
    // ---- RIGHT: the castle approach: a paved apron to the fort stair foot, lanterns, two banners on tall poles flanking the stair
    { const { x0, x1, z0, z1 } = CASTLE, cx = (x0 + x1) / 2; SB('apron', box(x1 - x0, 0.3, z1 - z0), 0x9f9585, M(cx, Y - 0.15 + 0.05, (z0 + z1) / 2), false);
      for (let i = 0, n = 6; i < n; i++) SB('apron', box(x1 - x0 - 0.2, 0.06, (z1 - z0) / n - 0.06), i % 2 ? 0xc8bda7 : 0xb3a993, M(cx, Y + 0.03 + 0.1 * (i + 0.5) / n, z0 + (z1 - z0) * (i + 0.5) / n), false);
      lamp(x1 + 0.6, H(x1 + 0.6, z0 + 0.8), z0 + 0.8);
      for (const bx of [-437.4, -430.6]) { const bz = -69.8, g = H(bx, bz); W(k, box(0.6, 0.4, 0.6), 0xb0a99c, M(bx, g + 0.2, bz)); W(k, cyl(0.07, 0.09, 6.2, 6), C.IRON, M(bx, g + 3.3, bz));
        W(k, box(0.06, 0.06, 1.3), C.IRON, M(bx, g + 6.2, bz - 0.65), false); W(k, box(0.08, 2.4, 1.2), 0xd8322f, M(bx, g + 4.9, bz - 0.7), false); W(k, box(0.09, 0.5, 0.5), C.GOLD, M(bx, g + 5.2, bz - 0.7), false);
        W(k, new THREE.ConeGeometry(0.6, 0.6, 3), 0xd8322f, M(bx, g + 3.5, bz - 0.7, 0, 0, Math.PI), false); W(k, new THREE.SphereGeometry(0.12, 8, 6), C.GOLD, M(bx, g + 6.45, bz), false); } }
    // castle stair foot: two gate piers with iron braziers, planters, and up the stair a lantern + a red banner on each parapet every 6 m
    for (const [x, z] of GPIERS) { const g = gmin(x, z, 0.5) - 0.2, top = Y + 2.6;
      SB('gpier', box(0.9, top - g, 0.9), 0xb9b2a6, M(x, (top + g) / 2, z)); SB('gpier', box(1.1, 0.16, 1.1), 0xd2c9b6, M(x, top + 0.08, z), false);
      W(k, cyl(0.42, 0.22, 0.4, 8), C.IRON, M(x, top + 0.36, z), false); W(k, new THREE.ConeGeometry(0.3, 0.7, 6), 0xffa53a, M(x, top + 0.85, z), false); W(k, new THREE.ConeGeometry(0.16, 0.45, 5), 0xffe08a, M(x, top + 0.8, z), false); }
    for (const [x, z] of CPLANT) if(!clearCastleDressing(x,z)) planter(x, H(x, z), z, 1.4);
    { const F2 = FORT_FOOT, wy = (z) => Math.max(F2.y0 + (F2.y1 - F2.y0) * (z - F2.z0) / (F2.z1 - F2.z0), H(F2.x, z) + 0.04);
      for (let z = F2.z0 + 6; z < F2.z1 - 1; z += 6) for (const s of [-1, 1]) { const x = F2.x + s * (F2.hw + 0.3), y = wy(z) + 1.0; if(clearCastleDressing(x,z)) continue;
        W(k, cyl(0.05, 0.06, 0.7, 5), C.IRON, M(x, y + 0.35, z), false); W(k, box(0.3, 0.36, 0.3), 0x2b2f36, M(x, y + 0.86, z), false); W(k, box(0.22, 0.3, 0.32), 0xffd27a, M(x, y + 0.86, z), false);
        const bx = x + s * 0.3, bz = z + 3; W(k, box(0.08, 0.08, 0.9), C.IRON, M(bx, y - 0.08, bz), false);
        W(k, box(0.05, 1.5, 0.8), 0xd8322f, M(bx + s * 0.02, y - 0.85, bz), false); W(k, box(0.06, 0.34, 0.34), C.GOLD, M(bx + s * 0.03, y - 0.75, bz), false);
        if (RBB_ON) { const tz = z - 3, ty = wy(tz) + 1.0; W(k, box(0.42, 0.26, 1.5), 0x8a5a32, M(x, ty + 0.13, tz), false); W(k, box(0.34, 0.06, 1.42), 0x5a3a22, M(x, ty + 0.27, tz), false);   // [v220] flower troughs on the parapets (the castle path)
          for (let q = 0; q < 4; q++) bloomClump(k, x, ty + 0.4 - 0.12, tz - 0.55 + q * 0.37, Math.round((q + z) * 7 + (x) * 3), 1.18, low); } } }
    // ---- the high rope bridge: towers, plank deck (4.6 m walk + rope rails), stringers, hangers, 2 stone piers
    const bk = new Kit(), cs = Math.cos(HB.yaw), sn = Math.sin(HB.yaw), n = Math.round(HB.L / 0.6), RW = HB.half + 0.25;
    for (let i = 0; i <= n; i++) { const t = i / n, [x, z] = along(t), y = HB.yAt(t);
      W(bk, box(RW * 2 + 0.3 + hash(i, 1) * 0.2, 0.12, 0.52), hash(i, 2) > 0.5 ? 0xd9a36b : 0xc28a55, M(x, y - 0.06, z, HB.yaw + (hash(i, 3) - 0.5) * 0.03), false);
      if (i % 4 === 0) for (const s of [-1, 1]) W(bk, box(0.14, 1.25, 0.14), 0x6b4527, M(x + cs * s * RW, y + 0.55, z - sn * s * RW, HB.yaw), false); }
    for (const s of [-1, 1]) { for (const [hgt, r, off] of [[1.15, 0.075, RW], [0.55, 0.05, RW], [-0.25, 0.2, RW - 0.5]]) { const pts = [];
      for (let i = 0; i <= 120; i++) { const t = i / 120, [x, z] = along(t); pts.push(new THREE.Vector3(x + cs * s * off, HB.yAt(t) + hgt, z - sn * s * off)); }
      W(bk, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, r, hgt < 0 ? 6 : 5), hgt < 0 ? 0x6b4527 : 0xc9a36b, null, false); } }
    for (const t of HB.piers) { const [x, z] = along(t), top = HB.yAt(t) - 0.3, g = gmin(x, z, 3) - 0.6, hh = top - g;
      SB('pier', box(6.0, hh, 4.0), 0xb9b2a6, M(x, g + hh / 2, z, HB.yaw)); SB('pier', box(6.6, 0.45, 4.6), 0x8a837a, M(x, top - 0.1, z, HB.yaw), false);
      SB('pier', box(6.8, 3.2, 4.8), 0xa9a294, M(x, g + 1.6, z, HB.yaw), false);   // footing
      for (let r = 2.4; r < hh - 1; r += 2.4) SB('pier_band', box(6.06, 0.14, 4.06), 0x8a837a, M(x, g + r, z, HB.yaw), false);
      for (const s of [-1, 1]) { const px = x + cs * s * 2.75, pz = z - sn * s * 2.75; W(k, cyl(0.2, 0.24, 2.2, 7), 0x6b4527, M(px, top + 1.2, pz)); W(k, box(0.4, 0.46, 0.4), 0xffd27a, M(px, top + 2.5, pz), false); } }
    for (const t of [0, 1]) { const [x, z] = along(t), y = t ? HB.yb : Y, back = t ? 0.6 : -0.6;   // tower heads: two stone pillars + a timber lintel + lanterns
      if (ARCH_OFF) { for (const s of [-1, 1]) { const px = x + cs * s * 3.25 + sn * back, pz = z - sn * s * 3.25 + cs * back, g = Math.min(y, gmin(px, pz, 0.8)) - 0.3, top = y + 1.55, hh = top - g;   // [v220] no arch: a low lantern newel each side (the rope rails' anchors)
          SB('tower', box(1.1, hh, 1.1), 0xb9b2a6, M(px, g + hh / 2, pz, HB.yaw)); SB('tower', box(1.36, 0.22, 1.36), 0xd2c9b6, M(px, top + 0.11, pz, HB.yaw), false);
          for (let r = 1.75; r < hh - 0.8; r += 1.4) SB('tower_band', box(1.16, 0.1, 1.16), 0x8a837a, M(px, top - r, pz, HB.yaw), false);
          W(k, cyl(0.05, 0.06, 0.3, 5), C.IRON, M(px, top + 0.37, pz), false); W(k, box(0.42, 0.52, 0.42), 0x2b2f36, M(px, top + 0.78, pz, HB.yaw)); W(k, box(0.3, 0.4, 0.44), 0xffd27a, M(px, top + 0.78, pz, HB.yaw), false); W(k, box(0.44, 0.4, 0.3), 0xffd27a, M(px, top + 0.78, pz, HB.yaw), false);
          W(k, cyl(0.02, 0.33, 0.24, 4), C.IRON, M(px, top + 1.14, pz, HB.yaw + Math.PI / 4), false); }
        continue; }
      for (const s of [-1, 1]) { const px = x + cs * s * 3.25 + sn * back, pz = z - sn * s * 3.25 + cs * back, g = Math.min(y, gmin(px, pz, 0.8)) - 0.3, hh = y + 5.4 - g;
        SB('tower', box(1.4, hh, 1.4), 0xb9b2a6, M(px, g + hh / 2, pz, HB.yaw)); SB('tower', box(1.7, 0.3, 1.7), 0xd2c9b6, M(px, y + 5.5, pz, HB.yaw), false); SB('tower', box(1.1, 0.5, 1.1), 0xb0a99c, M(px, y + 5.9, pz, HB.yaw), false);
        for (let r = 1.2; r < hh - 0.8; r += 1.4) SB('tower_band', box(1.46, 0.1, 1.46), 0x8a837a, M(px, y + 5.4 - r, pz, HB.yaw), false);
        W(k, box(0.4, 0.5, 0.4), 0xffd27a, M(px - cs * s * 0.9, y + 4.2, pz + sn * s * 0.9), false); }
      { const px = x + sn * back, pz = z + cs * back; W(k, box(8.0, 0.55, 0.6), 0x6b4527, M(px, y + 5.0, pz, HB.yaw + Math.PI / 2)); W(k, box(3.2, 0.7, 0.14), 0xd9a36b, M(px, y + 4.25, pz, HB.yaw + Math.PI / 2), false); } }
    // the plateau landing: a flagged path from the deck end round onto trail A (the lagoon path, z ~ -61), edged, thinning out into the trail paint
    if (!RBB_ON) { const PP = [[HB.bx + sn * 0.6, HB.bz + cs * 0.6], [-280, -67.6], [-272.5, -61.4]], seg = []; let tot = 0;   // ([v220] Blender plaza on: the paved terrain path above)
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
    if (SIGNS.length) { sign(...SIGNS[0], [[Math.PI / 2, 0xd9a36b]]); sign(...SIGNS[1], [[Math.PI / 2, 0xc98a4c], [Math.PI, 0xe7c08d]]); }
    if (RBB_ON) {   // [hilltop] the whole hill top
      for (const t of moundRings(H)) { if(clearColiStair(t.x,t.z)) continue; const hh = t.top - t.g, ox = t.nx * 0.2, oz = t.nz * 0.2;
        W(k, box(0.9, hh, t.L + 0.08), t.i % 2 ? 0xb0a99c : 0xbab3a5, M(t.x + ox, t.g + hh / 2, t.z + oz, t.yaw), t.i % 3 === 0);
        W(k, box(1.1, 0.2, t.L + 0.14), 0xd2c9b6, M(t.x + ox, t.top + 0.1, t.z + oz, t.yaw), false);
        for (let r = 1.3; r < hh - 0.4; r += 1.3) W(k, box(0.96, 0.1, t.L + 0.1), 0x8a837a, M(t.x + ox, t.top - r, t.z + oz, t.yaw), false);
        const bx = t.x - t.nx * 1.0, bz = t.z - t.nz * 1.0; if(clearCastleDressing(bx,bz)) continue; W(k, box(1.4, 0.3, t.L + 0.05), 0x4e7a2e, M(bx, t.top - 0.05, bz, t.yaw), false);
        if (!low || t.i % 2 === 0) { const r = 0.45 + hash(t.i, 7) * 0.35; k.add(jitter(new THREE.IcosahedronGeometry(r, 0), 0.25, t.i), [0x4e8a34, 0x5f9a3a, 0x3f7d2c][t.i % 3], { m: M(bx, t.top + r * 0.5, bz, t.i), outline: false });
          if (t.i % 3 === 0) bloomClump(k, bx + 0.3, t.top + r * 1.1 - 0.108, bz, Math.round((t.i) * 7 + (bx + 0.3) * 3), 1.06, low); }
        if (t.i % 4 === 1) for (let q = 0; q < 3; q++) k.add(jitter(new THREE.IcosahedronGeometry(0.3, 0), 0.3, t.i * 3 + q), 0x3f7d2c, { m: M(t.x + t.nx * 0.7, t.top - 0.3 - q * 0.45, t.z + t.nz * 0.7, t.yaw, 0, 0, [0.5, 1.2, 1.4]), outline: false });
        if (t.i % 6 === 0) { const lx = t.x + t.nx * 0.75, lz = t.z + t.nz * 0.75; W(k, box(0.34, 0.44, 0.34), 0x2b2f36, M(lx, t.top - 0.9, lz, t.yaw)); W(k, box(0.26, 0.34, 0.36), 0xffd27a, M(lx, t.top - 0.9, lz, t.yaw), false); } }
      // tall pennants on the four fort towers + gatehouse: the silhouette reads from the street
      for (const [x, z, c] of [[-421, -57, 0xd8322f], [-395, -57, 0x111111], [-421, -31, 0x111111], [-395, -31, 0xd8322f]]) { W(k, cyl(0.06, 0.07, 5, 5), 0x5e3b20, M(x, 49.5 + 2.5, z), false); { const fm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), pfpFlagMaterial()); fm.position.set(x, 53.1, z + 1.3); fm.rotation.y = Math.PI / 2; near.add(fm); } /* [hilltop] Pumpfun Pirates flags */ W(k, new THREE.SphereGeometry(0.18, 6, 4), C.GOLD, M(x, 54.6, z), false); }
      // the castle approach: hedge + flower borders down both sides of the fort stair (outside its parapets) and topiary at the foot
      for (let z = -70; z < -47; z += 2.2) for (const s of [-1, 1]) { const x = -434 + s * 3.4; if(clearCastleDressing(x,z)) continue; const g = H(x, z), r = 0.55 + hash(z, s) * 0.15;
        k.add(jitter(new THREE.IcosahedronGeometry(r, 0), 0.15, z * s), 0x3f7d2c, { m: M(x, g + r * 0.7, z, 0, 0, 0, [1, 0.85, 1.5]), outline: false });
        if (Math.round(z) % 3 === 0) bloomClump(k, x, g + r * 1.35 - 0.102, z, Math.round((z) * 7 + (x) * 3), 1.00, low); }
      for (const [x, z] of [[-439, -71.5], [-429, -71.5]]) { if(clearCastleDressing(x,z)) continue; const g = H(x, z); W(k, cyl(0.55, 0.65, 0.7, 8), 0xb0a99c, M(x, g + 0.35, z)); k.add(new THREE.SphereGeometry(0.85, 10, 8), 0x3f7d2c, { m: M(x, g + 1.5, z), outline: false }); k.add(new THREE.SphereGeometry(0.55, 10, 8), 0x4e8a34, { m: M(x, g + 2.6, z), outline: false }); }
      // the plaza: a paved compass rose in the fountain ring's apron (flush inlay) + four tall twin-lantern standards on the corners
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, L = i % 2 ? 2.2 : 3.6, r0 = RB2.r + 0.6;
        W(k, box(i % 2 ? 0.45 : 0.7, 0.04, L), i % 2 ? 0xd2c9b6 : 0x8f6a3a, M(CX + Math.sin(a) * (r0 + L / 2), Y + 0.04, CZ + Math.cos(a) * (r0 + L / 2), a), false); }
      // [hilltop] the roundabout: an outer kerb ring + a second paved band (r 11.5 -> 14), 8 dark radial setts: reads as a roundabout from the street
      W(k, new THREE.CylinderGeometry(14, 14, 0.04, 56), 0xb9ab92, M(CX, Y + 0.012, CZ), false);
      for (let i = 0; i < 64; i++) { const a = (i + 0.5) / 64 * Math.PI * 2; W(k, box(0.5, 0.16, 1.45), 0x7d766c, M(CX + Math.sin(a) * 14.1, Y + 0.08, CZ + Math.cos(a) * 14.1, a + Math.PI / 2), false); }
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; W(k, box(0.22, 0.05, 2.3), 0x8a837a, M(CX + Math.sin(a) * 12.75, Y + 0.03, CZ + Math.cos(a) * 12.75, a), false); }
      // the path down (S): a paved trail-head apron at the Climb's foot (9 x 7 m flags on the ground), then 36 m of kerbed flag trail at trail
      // width with lantern posts + shrub borders: a real trail exit (paint-level: no height change, the walk stays the terrain)
      { const [ex, ez] = CLIMB.at(CLIMB.L), a = CLIMB.yawAt(CLIMB.L), ux = Math.sin(a), uz = Math.cos(a), cx = Math.cos(a), cz = -Math.sin(a);
        for (let d = -1; d < 6; d += 1.2) for (let o = -4.2; o <= 4.21; o += 1.2) { const x = ex + ux * d + cx * o, z = ez + uz * d + cz * o; W(k, box(1.12, 0.1, 1.12), (Math.round(d * 5 + o * 3) % 3) ? 0xc8bda7 : 0xb3a993, M(x, H(x, z) + 0.04, z, a), false); }
        for (const s of [-1, 1]) { const x = ex + ux * 5.6 + cx * s * 4.9, z = ez + uz * 5.6 + cz * s * 4.9, g = H(x, z); W(k, box(0.9, 1.6, 0.9), 0xb9b2a6, M(x, g + 0.8, z)); W(k, box(1.06, 0.14, 1.06), 0xd2c9b6, M(x, g + 1.67, z), false);
          W(k, box(0.42, 0.52, 0.42), 0x2b2f36, M(x, g + 2.05, z)); W(k, box(0.3, 0.4, 0.44), 0xffd27a, M(x, g + 2.05, z), false); }
        for (let d = 6; d < 42; d += 1.3) { const x0 = ex + ux * d, z0 = ez + uz * d; for (let o = -1.7; o <= 1.71; o += 1.15) { const x = x0 + cx * o, z = z0 + cz * o; W(k, box(1.08, 0.08, 1.2), (Math.round(d) + Math.round(o * 2)) % 3 ? 0xc8bda7 : 0xb3a993, M(x, H(x, z) + 0.03, z, a + (hash(d, o) - 0.5) * 0.08), false); }
          for (const s of [-1, 1]) { const x = x0 + cx * s * 2.5, z = z0 + cz * s * 2.5; W(k, box(0.3, 0.2, 1.25), 0x8a837a, M(x, H(x, z) + 0.06, z, a), false);
            if (Math.round(d / 1.3) % 3 === 0) { const sx = x0 + cx * s * 3.4, sz = z0 + cz * s * 3.4, r = 0.5 + hash(d, s) * 0.3; k.add(jitter(new THREE.IcosahedronGeometry(r, 0), 0.25, d * s), [0x4e8a34, 0x5f9a3a, 0x3f7d2c][Math.round(d) % 3], { m: M(sx, H(sx, sz) + r * 0.6, sz, d), outline: false });
              if (Math.round(d) % 4 === 0) bloomClump(k, sx, H(sx, sz) + r * 1.3 - 0.102, sz, Math.round((d) * 7 + (sx) * 3), 1.00, low); } }
          if (Math.round(d / 1.3) % 8 === 4) { const s = Math.round(d / 1.3) % 16 === 4 ? 1 : -1, x = x0 + cx * s * 3.0, z = z0 + cz * s * 3.0, g = H(x, z); W(k, box(0.5, 0.4, 0.5), 0xb0a99c, M(x, g + 0.2, z)); W(k, cyl(0.06, 0.08, 2.6, 5), C.IRON, M(x, g + 1.6, z)); W(k, box(0.4, 0.5, 0.4), 0x2b2f36, M(x, g + 3.05, z)); W(k, box(0.3, 0.38, 0.44), 0xffd27a, M(x, g + 3.05, z), false); } } }
      // the bridge (E): a suspension-rope look: tall timber masts at each end + each pier (both sides), main cables sagging between them and
      // hangers down to the hand rail; a broad paved landing at the plateau end (10 x 7 m) with lantern newels; heavier pier caps + cutwaters
      { const c0 = cs0(), s0 = sn0(), stations = [0, ...HB.piers, 1], top = (t) => (t === 0 ? Y : t === 1 ? HB.yb : HB.yAt(t)) + 6.2, off = HB.half + 0.55;
        for (const t of stations) { const [x, z] = along(t), y0 = t === 0 ? Y : t === 1 ? HB.yb : HB.yAt(t) - 0.3;
          for (const s of [-1, 1]) { const px = x + c0 * s * off, pz = z - s0 * s * off; W(k, box(0.42, top(t) - y0 + 0.3, 0.42), 0x6b4527, M(px, (top(t) + y0) / 2, pz, HB.yaw)); W(k, box(0.6, 0.3, 0.6), 0x4a2e18, M(px, top(t) + 0.15, pz, HB.yaw), false); W(k, new THREE.SphereGeometry(0.16, 6, 4), C.GOLD, M(px, top(t) + 0.45, pz), false); } }
        for (let q = 1; q < stations.length; q++) { const ta = stations[q - 1], tb = stations[q];
          for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 24; i++) { const f = i / 24, t = ta + (tb - ta) * f, [x, z] = along(t); pts.push(new THREE.Vector3(x + c0 * s * off, top(ta) + (top(tb) - top(ta)) * f - Math.sin(f * Math.PI) * 4.4, z - s0 * s * off)); }
            W(k, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.09, 5), 0x8a6a3e, null, false);
            const nh = Math.floor((tb - ta) * HB.L / (low ? 3.6 : 1.8)); for (let i = 1; i < nh; i++) { const f = i / nh, t = ta + (tb - ta) * f, [x, z] = along(t), yc = top(ta) + (top(tb) - top(ta)) * f - Math.sin(f * Math.PI) * 4.4, yd = HB.yAt(t) + 1.15;
              if (yc - yd > 0.2) W(k, box(0.04, yc - yd, 0.04), 0xc9a36b, M(x + c0 * s * (off - 0.2), (yc + yd) / 2, z - s0 * s * (off - 0.2), HB.yaw), false); } } }
        for (const t of HB.piers) { const [x, z] = along(t), y = HB.yAt(t) - 0.3, g = gmin(x, z, 3) - 0.6; W(k, box(7.6, 0.5, 5.4), 0xd2c9b6, M(x, y + 0.05, z, HB.yaw), false);
          for (const s of [-1, 1]) { const px = x - s0 * s * 2.6, pz = z - c0 * s * 2.6; W(k, new THREE.CylinderGeometry(0.01, 2.6, Math.max(2, (y - g) * 0.85), 4), 0xa9a294, M(px, g + Math.max(2, (y - g) * 0.85) / 2, pz, HB.yaw + Math.PI / 4), false); } }
        { const ux = Math.sin(HB.yaw), uz = Math.cos(HB.yaw);
          // [v328] tiles pinned to HB.yb (walk deck top); retaining skirt under edges where cliff drops away
          for (let d = 0.3; d < 7.3; d += 1.2) for (let o = -4.8; o <= 4.81; o += 1.2) { const x = HB.bx + ux * d + c0 * o, z = HB.bz + uz * d - s0 * o;
            W(k, box(1.12, 0.12, 1.12), (Math.round(d * 3 + o)) % 3 ? 0xc8bda7 : 0xb3a993, M(x, HB.yb - 0.06, z, HB.yaw), false); }
          for (let d = 0.6; d < 7.1; d += 1.4) for (const o of [-5.15, 5.15]) { const x = HB.bx + ux * d + c0 * o, z = HB.bz + uz * d - s0 * o, g = gmin(x, z, 1.2) - 0.2, hh = HB.yb - g;
            if (hh > 0.45) { W(k, box(0.7, hh, 1.35), 0xb9b2a6, M(x, g + hh / 2, z, HB.yaw), false); for (let r = 1.5; r < hh - 0.4; r += 1.5) W(k, box(0.76, 0.1, 1.4), 0x8a837a, M(x, HB.yb - r, z, HB.yaw), false); } }
          for (const s of [-1, 1]) { const x = HB.bx + ux * 0.4 + c0 * s * 5.15, z = HB.bz + uz * 0.4 - s0 * s * 5.15, g = gmin(x, z, 1.4) - 0.25, hh = HB.yb - g;
            if (hh > 0.45) W(k, box(1.35, hh, 0.7), 0xb0a99c, M(x, g + hh / 2, z, HB.yaw), false); }
          // dressed-stone ramp steps from landing lip onto the plateau path
          for (let i = 0; i < 6; i++) { const d = 7.4 + i * 1.3, t = (i + 0.5) / 6, y = HB.yb + (H(HB.bx + ux * (7.4 + 8), HB.bz + uz * (7.4 + 8)) + 0.03 - HB.yb) * t;
            for (let o = -2.4; o <= 2.41; o += 1.2) { const x = HB.bx + ux * d + c0 * o, z = HB.bz + uz * d - s0 * o; W(k, box(1.12, 0.1, 1.2), (i + Math.round(o)) % 2 ? 0xc8bda7 : 0xb3a993, M(x, y - 0.05, z, HB.yaw), false); }
            for (const s of [-1, 1]) { const x = HB.bx + ux * d + c0 * s * 2.9, z = HB.bz + uz * d - s0 * s * 2.9; W(k, box(0.28, 0.18, 1.2), 0x8a837a, M(x, y + 0.02, z, HB.yaw), false); } }
          // lantern newels at outer corners ONLY (o=±5.1) — mouth + front stay clear (no belvedere / trail sign)
          for (const s of [-1, 1]) { const x = HB.bx + ux * 7 + c0 * s * 5.1, z = HB.bz + uz * 7 - s0 * s * 5.1, g = HB.yb;
            W(k, box(0.9, 1.6, 0.9), 0xb9b2a6, M(x, g + 0.8, z)); W(k, box(1.06, 0.14, 1.06), 0xd2c9b6, M(x, g + 1.67, z), false);
            W(k, box(0.42, 0.52, 0.42), 0x2b2f36, M(x, g + 2.05, z)); W(k, box(0.3, 0.4, 0.44), 0xffd27a, M(x, g + 2.05, z), false); } }
        for (const t of HB.piers) { const [x, z] = along(t), tp = HB.yAt(t); for (const s of [-1, 1]) { const px = x + c0 * s * off, pz = z - s0 * s * off; { const fm = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), pfpFlagMaterial()); fm.position.set(px, top(t) - 0.9, pz + 0.95); fm.rotation.y = Math.PI / 2; near.add(fm); } } }
      }
    }
    const fk = kfo.build(MATS, OUT); fk.name = 'rb_fountain_kit'; near.add(fk); rbFountainGLB(low).then(g => { if (!g || !fk.parent) return; const pp = fk.parent; pp.remove(fk); g.position.set(CX, Y, CZ); pp.add(g); RB_STATS.fountainGLB = true; });
    RB_LAYOUT.push(...LAY); const sk = ks.build(MATS, OUT); sk.name = 'rb_struct_kit'; near.add(sk);
    rbPlazaGLB(low, LAY).then(g => { if (!g || !sk.parent) return; near.remove(sk); near.add(g); RB_STATS.plazaGLB = true; });
    near.add(k.build(MATS, OUT)); const deck = bk.build(MATS, OUT); const sway = new THREE.Group(); sway.add(deck); near.add(sway);
    // fountain water: basin, two bowls, falling sheets from the bowls, 4 spout arcs + the top jet (animated, cheap: no textures)
    const wm = new THREE.MeshBasicMaterial({ color: 0x3f9fd6, transparent: true, opacity: 0.8, depthWrite: false }), jm = new THREE.MeshBasicMaterial({ color: 0xcdeeff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(BR0 - 0.15, BR0 - 0.15, 0.04, 8), wm); pool.position.set(CX, Y + 0.62, CZ); pool.rotation.y = Math.PI / 8;
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.04, 12), wm); b1.position.set(CX, Y + 3.32, CZ);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.04, 10), wm); b2.position.set(CX, Y + 4.92, CZ);
    const jets = new THREE.Group(); jets.position.set(CX, Y, CZ);
    jets.add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.45, 2.7, 16, 1, true), jm).translateY(1.95)); jets.add(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 1.6, 12, 1, true), jm).translateY(4.15));
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2, pts = []; for (let j = 0; j <= 8; j++) { const u = j / 8; pts.push(new THREE.Vector3(Math.sin(a) * (0.85 + u * 2.4), 2.55 - u * u * 1.9 + u * 0.2, Math.cos(a) * (0.85 + u * 2.4))); }
      jets.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.07, 4), jm)); }
    const spout = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.1, 6, 1, true), jm); spout.position.set(0, 6.3, 0); jets.add(spout);
    const fsg = new THREE.Group(); fsg.name = 'rb_fountain_scale'; fsg.position.set(CX * (1 - FS), Y * (1 - FS), CZ * (1 - FS)); fsg.scale.setScalar(FS); fsg.add(pool, b1, b2, jets); near.add(fsg);
    near.remove(fk); fsg.add(fk);
    // far: the plaza slab, the fountain block, the bridge as one deck strip + piers
    const kf = new Kit(); W(kf, box(PX1 - PX0, 0.6, PZ1 - PZ0), 0xc8bda7, M(CX, Y - 0.3, (PZ0 + PZ1) / 2), false); W(kf, cyl(FOUNTAIN.basinR, FOUNTAIN.basinR, 1, 8), 0xb9b2a6, M(CX, Y + 0.5, CZ), false);
    for (let i = 0; i < 12; i++) { const t = (i + 0.5) / 12, [x, z] = along(t); W(kf, box(5.2, 0.3, HB.L / 12 + 0.1), 0xa86a3a, M(x, HB.yAt(t) - 0.15, z, HB.yaw), false); }
    for (const t of HB.piers) { const [x, z] = along(t), top = HB.yAt(t), g = H(x, z); W(kf, box(6, top - g, 4), 0xb9b2a6, M(x, (top + g) / 2, z, HB.yaw), false); }
    far.add(kf.build(MATS, OUT));
    // [wish] the coin: a little gold disc flips from the rim into the basin, then a ring ripples out (looks only)
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.018, 12), new THREE.MeshStandardMaterial({ color: 0xffcd3c, metalness: 0.8, roughness: 0.3 }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    coin.visible = false; ring.rotation.x = -Math.PI / 2; ring.visible = false; near.add(coin, ring); let wishT = -1;
    const A = WISH_AT, wishAt = (t) => { const k = Math.min(1, t / 0.8);
      coin.visible = k < 1; coin.position.set(A.rim.x + (A.coin.x - A.rim.x) * k, A.rim.y + 1.3 + 1.2 * k - 1.9 * k * k, A.rim.z + (A.coin.z - A.rim.z) * k); coin.rotation.x = t * 14;
      const r = Math.max(0, (t - 0.8) / 1.4); ring.visible = r > 0 && r < 1; ring.position.set(A.coin.x, A.coin.y + 0.02, A.coin.z); ring.scale.setScalar(1 + r * 7); ring.material.opacity = 0.7 * (1 - r);
      return t < 2.2; };
    return { near, far, wish: () => { wishT = 0; }, tick(t) { if (wishT >= 0) { if (wishT === 0) wishT = t; if (!wishAt(t - wishT)) { wishT = -1; coin.visible = ring.visible = false; } }
      jets.rotation.y = t * 0.5; spout.scale.y = 1 + Math.sin(t * 7) * 0.12; pool.scale.setScalar(1 + Math.sin(t * 3) * 0.004);
      sway.position.set(cs * Math.sin(t * 0.9) * 0.03, Math.sin(t * 1.3) * 0.01, -sn * Math.sin(t * 0.9) * 0.03); } }; // sway: looks only (walk height = foot.js)
  },
  // [wish] E / tap at the rim: the toss itself is pvp.js ('pfp-wish': 100 gold on the server, then the splash + a plain line)
  label(q) { return null; },
  activate(q, t, api, b) { if (q.id !== 'wish_fountain' || typeof window === 'undefined') return null;
    window.dispatchEvent(new CustomEvent('pfp-wish', { detail: { toast: (m, ms) => api?.toast?.(m, ms), splash: () => b?.wish?.() } })); return null; },
};
// [stairs2] the curved Pirates' Climb (RBB_ON): treads, landing, walls + coping along the curve, the planted bed, lantern piers. Structural stone
// goes through SB (recorded for the Blender bake: rb_plaza_layout.json), soil / plants / lanterns on the plain kit.
function buildClimb({ SB, W, k, H, gmin, lampAt, low }) {
  const C = CLIMB, T0 = [Math.sin(C.a0), Math.cos(C.a0)], A0 = [Math.cos(C.a0), -Math.sin(C.a0)], [x0, z0] = C.at(0);
  const samp = []; for (let s = -C.back - 1; s <= C.L; s += 0.2) samp.push([s, ...C.at(s)]);
  const sNear = (x, z) => { let b = 1e18, bs = 0; for (const [s, px, pz] of samp) { const d = (px - x) ** 2 + (pz - z) ** 2; if (d < b) { b = d; bs = s; } } return bs; };
  const offOf = (x, z, s) => { const [px, pz] = C.at(s), a = C.yawAt(s); return Math.max(-C.wall, Math.min(C.wall, (x - px) * Math.cos(a) - (z - pz) * Math.sin(a))); };
  const wTop = (x, z) => { if (x >= PX0 - 0.6 && x <= PX1 + 0.6 && z >= PZ0 - 0.6) return Y + 0.9; const s = Math.max(0, sNear(x, z)); return C.walkO(s, offOf(x, z, s)) + 0.9; };
  const ground = (x, z, r) => gmin(x, z, r) - 0.4;
  // the landing (plaza height + the border band's 3.5 cm: flush with the paving and kerb you step off) + the strip to the rim
  { const LY = Y + 0.035, [cx, cz] = C.land.c, hh = Math.max(0.6, LY - Math.min(ground(cx, cz, C.hw), ground(...C.side(-C.back, C.wall), 0.6), ground(...C.side(-C.back, -C.wall), 0.6)));
    SB('landing', box(C.wall * 2 + 0.5, hh, C.back + 0.02), 0x9f9585, M(cx, LY - hh / 2, cz, C.a0), false);
    const [rx0, rx1, rz0, rz1] = C.landRect, rh = Math.max(0.6, LY - ground((rx0 + rx1) / 2, (rz0 + rz1) / 2, 2.5));
    SB('landing', box(rx1 - rx0 + 0.3, rh, rz1 - rz0), 0x9f9585, M((rx0 + rx1) / 2 - 0.15, LY - rh / 2, (rz0 + rz1) / 2), false); }
  // the treads: one solid stone block per riser (down to the ground: the flight stands on masonry where the hill falls away) + a dressed cap whose
  // top IS the walk height at the tread centre (CLIMB.walk); blocks run under both walls (no gap at the wall foot) and back under the tread above
  for (let i = 0; i < C.n; i++) { const sc = (i + 0.5) * C.d, top = C.y0 - C.rise * (i + 1), yaw = C.yawAt(sc), [bx, bz] = C.at(sc - C.d / 4);
    let g = 1e9; const rl = C.roll(sc), lo = top - Math.abs(rl) * (C.wall + 0.25);
    for (const o of [-C.wall - 0.25, -C.hw, 0, C.hw, C.wall + 0.25]) g = Math.min(g, H(...C.side(sc, o)) - 0.4); const hh = Math.max(0.3, lo - 0.06 - g);
    SB('tread', box(C.wall * 2 + 0.5, hh, C.d * 1.5), i % 2 ? 0xb9b2a6 : 0xb0a99c, M(bx, lo - 0.06 - hh / 2, bz, yaw), i % 3 === 0);
    const [cx, cz] = C.at(sc + 0.015); SB('tread_cap', box(C.hw * 2 + 0.04, 0.06, C.d + 0.03), 0xd2c9b6, M(cx, top - 0.03, cz, yaw, 0, Math.atan(rl)), false);
    if (rl) SB('tread', box(C.hw * 2 + 0.04, Math.abs(rl) * C.hw * 2 + 0.02, C.d + 0.03), i % 2 ? 0xb9b2a6 : 0xb0a99c, M(cx, top - 0.06 - (Math.abs(rl) * C.hw * 2 + 0.02) / 2, cz, yaw, 0, Math.atan(rl)), false); }   // (the rolled treads: a riser block under the tilted cap)
  // walls: short upright blocks (top = the lower end's coping line) under a pitched coping that follows the walk line + 0.9 m: one smooth sloping
  // rail along the curve, its inner face flush with the tread ends (the blocks overlap the treads: no slot)
  for (const pl of WALLS) for (let i = 1; i < pl.length; i++) { const [ax, az] = pl[i - 1], [bx, bz] = pl[i], L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue;
    const flat = Math.abs(wTop(ax, az) - wTop(bx, bz)) < 1e-3 && Math.abs(wTop((ax + bx) / 2, (az + bz) / 2) - wTop(ax, az)) < 1e-3, n = Math.max(1, Math.ceil(L / (flat ? 4 : 0.75))), yaw = Math.atan2(bx - ax, bz - az);   // level runs: 4 m blocks; sloping: 0.75 m
    for (let j = 0; j < n; j++) { const pa = [ax + (bx - ax) * j / n, az + (bz - az) * j / n], pb = [ax + (bx - ax) * (j + 1) / n, az + (bz - az) * (j + 1) / n], l = L / n,
        ta = wTop(...pa), tb = wTop(...pb), x = (pa[0] + pb[0]) / 2, z = (pa[1] + pb[1]) / 2, lo = Math.min(ta, tb), g = Math.min(ground(...pa, 0.6), ground(...pb, 0.6)) + 0.1, hh = Math.max(0.3, lo - g);
      SB('cwall', box(0.5, hh, l + 0.03), (i + j) % 3 ? 0xb9b2a6 : 0xb0a99c, M(x, g + hh / 2, z, yaw), (i + j) % 2 === 0);   // (cwall: plain ashlar in the bake, no drip lips stepping under the pitched coping)
      SB('coping', box(0.66, 0.42, l + 0.05), 0xd2c9b6, M(x, (ta + tb) / 2 + 0.06 - 0.21, z, yaw, Math.atan2(ta - tb, l)), false); } }
  // lantern piers flanking the top + the foot of the flight (the lanterns of the old landing), small lanterns on the coping at the thirds
  const pier = (s, o) => { const [x, z] = C.side(s, o), y = (s <= 0 ? Y : C.walkO(s, o)) + 1.25, g = ground(x, z, 0.6) + 0.1, a = C.yawAt(s);
    SB('gpier', box(0.86, y - g, 0.86), 0xb9b2a6, M(x, (y + g) / 2, z, a)); SB('gpier', box(1.02, 0.14, 1.02), 0xd2c9b6, M(x, y + 0.07, z, a), false);
    W(k, cyl(0.05, 0.06, 0.35, 5), C2.IRON, M(x, y + 0.31, z), false); W(k, box(0.42, 0.52, 0.42), 0x2b2f36, M(x, y + 0.74, z, a)); W(k, box(0.3, 0.4, 0.44), 0xffd27a, M(x, y + 0.74, z, a), false); W(k, box(0.44, 0.4, 0.3), 0xffd27a, M(x, y + 0.74, z, a), false);
    W(k, cyl(0.02, 0.33, 0.24, 4), C2.IRON, M(x, y + 1.1, z, a + Math.PI / 4), false); };
  for (const o of [-C.wall, C.wall]) { pier(0, o); pier(C.L, o); }
  for (const f of [1 / 3, 2 / 3]) for (const o of [-C.wall, C.wall]) { const s = C.L * f, [x, z] = C.side(s, o), y = C.walkO(s, o) + 0.96 + 0.06;
    W(k, box(0.3, 0.36, 0.3), 0x2b2f36, M(x, y + 0.2, z), false); W(k, box(0.22, 0.28, 0.32), 0xffd27a, M(x, y + 0.2, z), false); W(k, box(0.32, 0.28, 0.22), 0xffd27a, M(x, y + 0.2, z), false); }
  // the planted bed in the wedge between the plaza's S wall and the Climb's inner wall (a raised bank of soil + shrubs just under the stair's coping)
  for (const b of C.bed) { b.top = Math.min(Y - 0.25, wTop(b.x, b.z0 - 0.3) - 0.14); const g = ground(b.x, (b.z0 + b.z1) / 2, 0.8) + 0.1, hh = Math.max(0.3, b.top - g);
    SB('retain', box(0.52, hh, b.z1 - b.z0 + 0.04), 0xb0a99c, M(b.x, g + hh / 2, (b.z0 + b.z1) / 2), false);
    W(k, box(0.5, 0.08, b.z1 - b.z0), 0x5a3a22, M(b.x, b.top + 0.03, (b.z0 + b.z1) / 2), false);
    if (!low || b.i % 2 === 0) for (let q = 0; q < Math.max(1, Math.round((b.z1 - b.z0) / 1.1)); q++) { const z = b.z0 + (q + 0.5) * (b.z1 - b.z0) / Math.max(1, Math.round((b.z1 - b.z0) / 1.1)), r = 0.32 + hash(b.i, q) * 0.25;
      k.add(jitter(new THREE.IcosahedronGeometry(r, 0), 0.25, b.i * 7 + q), [0x4e8a34, 0x5f9a3a, 0x6fae45, 0x4e8a34][(b.i + q) % 4], { m: M(b.x + (hash(q, b.i) - 0.5) * 0.3, b.top + r * 0.7, z, b.i + q), outline: false });
      if ((b.i + q) % 5 === 0) bloomClump(k, b.x, b.top + r * 1.3 - 0.096, z + 0.2, Math.round((q) * 7 + (b.x) * 3), 0.94, low); } }
}
// [wish] off until the server says the fountain is open (inv_state flags); ?wish=1 = show the spot anyway (tests)
function wishHidden() { if (typeof window === 'undefined') return true; if (/[?&]wish=1(&|$)/.test(location.search)) return false; return !(window.PFP_INV_FLAGS && window.PFP_INV_FLAGS.wish_fountain); }
const rockfall = (i) => [-294.5 + hash(i, 21) * 6, -66 + hash(i, 23) * 7, 0.8 + hash(i, 25) * 1.1];
function cs0() { return Math.cos(HB.yaw); } function sn0() { return Math.sin(HB.yaw); }
function along(t) { return [HB.ax + (HB.bx - HB.ax) * t, HB.az + (HB.bz - HB.az) * t]; }
