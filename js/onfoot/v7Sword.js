// [v7 sword fight] BANKSY t439u / t452u / t453u "Make fighting animations" (V7 male + V7 female bodies only).
// The old pit pose (battle.js P_READY / P_WIND / P_SLASH) blended three keys straight-line on the sword arm + a spine twist: the free
// arm stayed on the base clip (the V7 girl's clip arm = a T-pose), the hips never joined in, the blade roll snapped at the key changes.
// This module is ONLY posing. battle.js still owns the swing clock (ARENA.sword dur 0.42 s, hitAt 0.2 s, cool 0.55 s), reach, arc,
// damage, net triggers and controls; nothing here reads or changes them.
//   v7SwordPose(s, opts)  s = swing progress 0..1 (null = held guard). A smooth path (Hermite, zero slope at the guard ends so repeated
//                         swings chain seamlessly): guard -> wind-up (blade chambered over the sword shoulder, torso coiled) -> the blade
//                         sweeps out and round -> strike across the front at the hit frame (s = hitAt / dur) -> follow-through low across
//                         the body -> controlled recovery -> guard. The free hand holds a guard in front of the chest, reaches forward
//                         on the wind-up and pulls back to the hip on the strike (counter-balance). Arm directions are authored in the
//                         TORSO frame (right-hand sword, x = the pirate's left, y up, +z front) and carried round by the torso turn.
//   makeV7SwordApply(THREE) -> apply(B, P, k, rootQ, hand) blends the real V7 bones after the clip: root (pelvis turn, the thighs undo
//                         it so the feet stay planted), spine (turn + lean), head (eyes stay on the target), both arms. The blade stays
//                         a child of the sword forearm (battle.js dress()).
export const V7_SWORD_DUR = 0.42, V7_SWORD_HIT_S = 0.2 / 0.42;   // = battle.js ARENA.sword (tests/v7Sword.test.mjs keeps them in step)
// t, sword arm: u upper arm, f forearm, b blade (forearm roll); free arm: o upper arm, of forearm; tw torso turn (+ = to his left, the
// slash direction), pel the part of it in the pelvis, lean forward (rad)
const K = [   // the blade rides at ~90 deg to the forearm (battle.js dress(): blade = forearm +Z), so each key picks the forearm the blade needs
  { t: 0,    u: [-0.35, -0.85, 0.4],  f: [-0.05, -0.55, 0.83], b: [0.15, 0.8, 0.55],    o: [0.35, -0.85, 0.4],   of: [-0.35, 0.25, 0.9],    tw: 0.12, pel: 0.05, lean: 0.03 },   // guard: hand at the waist, blade angled up + forward at the target, free hand up in front
  { t: 0.28, u: [-0.85, 0.4, -0.2],   f: [-0.2, 0.95, -0.15],  b: [-0.3, -0.1, -0.95],  o: [0.3, -0.25, 0.92],   of: [0.0, 0.1, 1],         tw: -0.5, pel: -0.2, lean: -0.04 },  // wind-up: hand by the ear, blade chambered back over the shoulder
  { t: 0.4,  u: [-0.65, 0.15, 0.75],  f: [-0.15, 0.2, 0.97],   b: [-0.95, 0.2, -0.1],   o: [0.38, -0.55, 0.5],   of: [0.1, -0.2, 0.97],     tw: -0.12, pel: -0.05, lean: 0.06 }, // the blade swings out wide on the sword side
  { t: V7_SWORD_HIT_S, u: [-0.15, -0.1, 0.98], f: [0.95, -0.1, 0.3], b: [-0.25, 0.05, 0.97], o: [0.4, -0.8, 0.1], of: [0.3, -0.9, 0.2], tw: 0.2, pel: 0.09, lean: 0.13 },   // strike: arm out front, blade straight at the target
  { t: 0.64, u: [0.45, -0.45, 0.77],  f: [0.35, -0.45, -0.82], b: [0.85, -0.35, 0.35],  o: [0.35, -0.85, -0.3],  of: [0.1, -0.7, -0.7],     tw: 0.5, pel: 0.22, lean: 0.1 },     // follow-through low across to the off hip
  { t: 0.82, u: [-0.2, -0.8, 0.55],   f: [0.1, -0.3, 0.95],    b: [0.15, 0.95, 0.25],   o: [0.38, -0.82, 0.35],  of: [-0.3, 0.2, 0.93],    tw: 0.2, pel: 0.08, lean: 0.05 },    // recovery: blade back up
  { t: 1,    u: [-0.35, -0.85, 0.4],  f: [-0.05, -0.55, 0.83], b: [0.15, 0.8, 0.55],    o: [0.35, -0.85, 0.4],   of: [-0.35, 0.25, 0.9],    tw: 0.12, pel: 0.05, lean: 0.03 },
];
export const V7_SWORD_KEYS = K;
const VEC = ['u', 'f', 'b', 'o', 'of'];
function herm(s, key) {
  let i = 0; while (i < K.length - 2 && s > K[i + 1].t) i++;
  const a = K[i], b = K[i + 1], h = b.t - a.t, u = Math.min(1, Math.max(0, (s - a.t) / h)), p = K[i - 1], n = K[i + 2];
  const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u, h11 = u ** 3 - u * u;
  const one = (A, B, P, N) => { const m0 = P ? (B - P.v) / (b.t - P.t) * h : 0, m1 = N ? (N.v - A) / (N.t - a.t) * h : 0; return h00 * A + h10 * m0 + h01 * B + h11 * m1; };   // zero slope at the guard ends
  if (typeof a[key] === 'number') return one(a[key], b[key], p && { v: p[key], t: p.t }, n && { v: n[key], t: n.t });
  const o = [0, 1, 2].map((c) => one(a[key][c], b[key][c], p && { v: p[key][c], t: p.t }, n && { v: n[key][c], t: n.t }));
  const l = Math.hypot(...o) || 1; return o.map((v) => v / l);
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// opts: female (her own tuning: narrower elbows, a little less torso coil), hand 'R' | 'L' (a left-hand sword mirrors x and the turns),
// moving 0..1 (walk / run clip weight: the gait owns the legs, so a smaller pelvis turn and no thigh counter-turn), time (s, the held
// guard breathes), flinch 0..1 (a hit taken: a short lean back, presentation only)
export function v7SwordPose(s, { female = false, hand = 'R', moving = 0, time = 0, flinch = 0 } = {}) {
  const held = s == null; s = held ? 0 : clamp01(s);
  const mx = hand === 'L' ? -1 : 1, nx = female ? 0.88 : 1, coil = female ? 0.85 : 1, mv = clamp01(moving), P = {};
  for (const k of VEC) { const v = herm(s, k); if (k === 'u' || k === 'o') v[0] *= nx; const l = Math.hypot(...v); P[k] = [mx * v[0] / l, v[1] / l, v[2] / l]; }
  if (held) { const br = Math.sin(time * 2.1) * 0.025; P.b = norm([P.b[0] + br * mx, P.b[1], P.b[2] - br]); P.f = norm([P.f[0], P.f[1] + br * 0.5, P.f[2]]); }
  const tw = herm(s, 'tw') * coil, pel = herm(s, 'pel') * coil * (1 - 0.6 * mv);
  P.tw = mx * tw; P.pel = mx * pel; P.sp = P.tw - P.pel;          // spine turn sits ON TOP of the pelvis turn: net torso = tw
  P.thigh = -P.pel * (1 - mv);                                       // planted feet: the thighs undo the pelvis turn (none while stepping)
  P.lean = herm(s, 'lean') - 0.2 * clamp01(flinch);
  P.head = -P.tw * 0.7; P.headLean = -P.lean * 0.6;   // eyes stay level and on the target
  return P;
}
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
// the s for each named phase (harness / proofs): held guard, wind-up peak, the hit frame, follow-through, recovery
export const V7_SWORD_PHASES = { guard: 0, windup: 0.28, hit: V7_SWORD_HIT_S, follow: 0.64, recover: 0.82 };

// THREE-dependent apply (same maths as battle.js aimBone / twist, kept here so the preview harness runs the identical code)
export function makeV7SwordApply(THREE) {
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(),
    _a = new THREE.Vector3(), _x = new THREE.Vector3(), _d = new THREE.Vector3(), _ax = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), _ty = new THREE.Quaternion();
  const BONE_PERP = new THREE.Vector3(0, 0, 1);
  function set(bone, q) { bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert().multiply(q)); bone.updateMatrixWorld(true); }
  function aim(bone, d, k, rootQ, roll, axis) { if (!bone || k <= 0) return; bone.updateWorldMatrix(true, false); bone.getWorldQuaternion(_q);
    _v.set(axis, 0, 0).applyQuaternion(_q); _w.set(d[0], d[1], d[2]).applyQuaternion(_ty).applyQuaternion(rootQ);
    _q2.setFromUnitVectors(_v, _w); _q2.slerp(_rq.identity(), 1 - k); _q.premultiply(_q2);
    if (roll) { _w.normalize(); _a.set(roll[0], roll[1], roll[2]).applyQuaternion(_ty).applyQuaternion(rootQ); _a.addScaledVector(_w, -_a.dot(_w)).normalize(); _x.copy(BONE_PERP).applyQuaternion(_q); _x.addScaledVector(_w, -_x.dot(_w)).normalize();
      if (_a.lengthSq() > 0.5 && _x.lengthSq() > 0.5) { const ang = Math.atan2(_d.crossVectors(_x, _a).dot(_w), _x.dot(_a)); _q2.setFromAxisAngle(_w, ang * k); _q.premultiply(_q2); } }
    set(bone, _q); }
  function rot(bone, axisRoot, ang, rootQ) { if (!bone || !ang) return; bone.updateWorldMatrix(true, false); bone.getWorldQuaternion(_q); _ax.copy(axisRoot).applyQuaternion(rootQ); _q2.setFromAxisAngle(_ax, ang); _q.premultiply(_q2); set(bone, _q); }
  const X = new THREE.Vector3(1, 0, 0);
  // B: { root, tL, tR, spine, head, uR, fR, uL, fL }; hand = the sword hand; k = arena blend weight (battle.js st.w)
  return function applyV7Sword(B, P, k, rootQ, hand = 'R') {
    if (k <= 0.001) return; const L = hand === 'L', sx = L ? 1 : -1;   // sword forearm points along +X (left) / -X (right)
    rot(B.root, _Y, P.pel * k, rootQ); rot(B.tL, _Y, P.thigh * k, rootQ); rot(B.tR, _Y, P.thigh * k, rootQ);
    rot(B.spine, _Y, P.sp * k, rootQ); rot(B.spine, X, P.lean * k, rootQ);
    rot(B.head, _Y, P.head * k, rootQ); rot(B.head, X, P.headLean * k, rootQ);
    _ty.setFromAxisAngle(_Y, P.tw * k);   // arm keys are in the torso frame: carried round by the torso turn
    aim(L ? B.uL : B.uR, P.u, k, rootQ, null, sx); aim(L ? B.fL : B.fR, P.f, k, rootQ, P.b, sx);
    aim(L ? B.uR : B.uL, P.o, k, rootQ, null, -sx); aim(L ? B.fR : B.fL, P.of, k, rootQ, null, -sx);
    _ty.identity(); };
}
