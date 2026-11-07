// [v7 sword fight] js/onfoot/v7Sword.js: posing only. Phase continuity, rest recovery, blends, hand mirroring, the blade staying a child
// of the sword forearm, V7-only routing, and battle.js mechanics (dur / hitAt / dmg / reach / arc / cool) untouched.
import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { v7SwordPose, makeV7SwordApply, V7_SWORD_DUR, V7_SWORD_HIT_S, V7_SWORD_PHASES, V7_SWORD_KEYS } from '../js/onfoot/v7Sword.js';
const THREE = await import('three');
const src = fs.readFileSync(new URL('../js/onfoot/battle.js', import.meta.url), 'utf8');
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const VEC = ['u', 'f', 'b', 'o', 'of'], SC = ['tw', 'pel', 'sp', 'thigh', 'lean', 'head', 'headLean'];

test('battle mechanics unchanged: the sword clock / damage / reach / arc / cooldown, and the hit frame the strike key sits on', () => {
  assert.match(src, /sword: \{ dmg: 19, reach: 2\.5, arc: 1\.15, cool: 0\.55, dur: 0\.42, hitAt: 0\.2 \}/);
  assert.equal(V7_SWORD_DUR, 0.42); assert.equal(V7_SWORD_HIT_S, 0.2 / 0.42);
  assert.ok(V7_SWORD_KEYS.some((k) => k.t === V7_SWORD_HIT_S), 'a strike key on the hit frame');
  assert.match(src, /if \(!a\.hit && a\.t >= ARENA\.sword\.hitAt\) \{ a\.hit = true; swordHit\(\); \} if \(a\.t >= ARENA\.sword\.dur\) st\.act = null;/);
});
test('routing: V7 bodies only, pit zone only, &v7sword=0 keeps the old pose; the musket range path is untouched', () => {
  assert.match(src, /if \(st\.zone === Z_PIT && R\.v4\?\.v7 && V7_SWORD_ON\) v7Fight\(R\);\n\s+else if \(st\.zone === Z_PIT\) \{/);
  assert.match(src, /\[\?&\]v7sword=0\(&\|\$\)/);
  assert.match(src, /if \(v4\.v7\) Object\.assign\(R\.bones, \{ root: b\('root'\), head: b\('head'\), tL: b\('thighL'\), tR: b\('thighR'\) \}\)/);
  assert.match(src, /P_READY = \{ u: v3\(-0\.35, -0\.75, 0\.55\)/, 'old keys kept for v5 / v6 bodies');
  assert.match(src, /\} else if \(st\.zone === Z_RANGE\) \{/);
  assert.match(fs.readFileSync(new URL('../js/preloadList.js', import.meta.url), 'utf8'), /"js\/onfoot\/v7Sword\.js"/);
});
test('the swing chains: s = 0, s = 1 and the held guard (no breathing) are the same pose (repeated swings never pop)', () => {
  const a = v7SwordPose(0), b = v7SwordPose(1), g = v7SwordPose(null, { time: 0 });
  for (const k of VEC) for (const P of [b, g]) assert.ok(dot(a[k], P[k]) > 0.9999, k);
  for (const k of SC) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, k);
});
test('phase continuity: no jump between neighbouring frames at 240 Hz, and every direction stays unit length', () => {
  for (const female of [false, true]) for (const hand of ['R', 'L']) { let prev = null;
    for (let i = 0; i <= 240; i++) { const P = v7SwordPose(i / 240, { female, hand });
      for (const k of VEC) assert.ok(Math.abs(Math.hypot(...P[k]) - 1) < 1e-9);
      if (prev) { for (const k of VEC) assert.ok(dot(prev[k], P[k]) > Math.cos(0.25), `${k} jump at ${i}`); for (const k of SC) assert.ok(Math.abs(prev[k] - P[k]) < 0.06, `${k} jump at ${i}`); }
      prev = P; } }
});
test('rest recovery: zero slope into and out of the guard (eases in / settles)', () => {
  const e = 1e-3, d = (s0, s1) => Math.acos(Math.min(1, dot(v7SwordPose(s0).u, v7SwordPose(s1).u)));
  assert.ok(d(0, e) < 1e-4 && d(1 - e, 1) < 1e-4);
});
test('the phases read as a fight: chambered back on the wind-up, blade at the target on the strike, across to the off side after', () => {
  const W = v7SwordPose(V7_SWORD_PHASES.windup), H = v7SwordPose(V7_SWORD_PHASES.hit), F = v7SwordPose(V7_SWORD_PHASES.follow), G = v7SwordPose(null);
  assert.ok(W.b[2] < -0.8, 'blade back over the shoulder'); assert.ok(W.f[1] > 0.8, 'hand up'); assert.ok(W.tw < -0.3, 'torso coiled to the sword side');
  assert.ok(H.b[2] > 0.9, 'blade straight ahead'); assert.ok(H.u[2] > 0.9, 'arm out front'); assert.ok(H.lean > 0.1, 'leaning in');
  assert.ok(F.b[0] > 0.6 && F.tw > 0.4, 'blade + torso through to the off side');
  assert.ok(G.b[1] > 0.6 && G.b[2] > 0.3, 'guard blade up + forward'); assert.ok(G.of[2] > 0.8 && G.of[1] > 0, 'free hand up in front');
  assert.ok(H.of[1] < -0.8 && F.of[2] < -0.5, 'free arm drops on the strike and pulls back to the hip on the follow-through');
});
test('left hand mirrors x and every turn; the female tuning is narrower / less coil, same timing', () => {
  for (const s of [null, 0.2, 0.476, 0.7]) { const R = v7SwordPose(s, { time: 1 }), L = v7SwordPose(s, { hand: 'L', time: 1 });
    for (const k of VEC) { assert.ok(Math.abs(L[k][0] + R[k][0]) < 1e-9 && Math.abs(L[k][1] - R[k][1]) < 1e-9); }
    for (const k of ['tw', 'pel', 'sp', 'thigh', 'head']) assert.ok(Math.abs(L[k] + R[k]) < 1e-9, k); assert.ok(Math.abs(L.lean - R.lean) < 1e-9); }
  const m = v7SwordPose(0.64), f = v7SwordPose(0.64, { female: true }); assert.ok(Math.abs(f.tw) < Math.abs(m.tw));
});
test('moving: the gait keeps the legs (no thigh counter-turn, smaller pelvis turn); planted: thighs undo the pelvis turn', () => {
  const st = v7SwordPose(0.64), mv = v7SwordPose(0.64, { moving: 1 });
  assert.ok(Math.abs(st.thigh + st.pel) < 1e-12); assert.ok(Math.abs(mv.thigh) < 1e-12); assert.ok(Math.abs(mv.pel) < Math.abs(st.pel));
  assert.ok(Math.abs(st.sp + st.pel - st.tw) < 1e-12, 'net torso turn = tw');
});
test('flinch (a hit taken) only leans back; it never moves the sword arm', () => {
  const a = v7SwordPose(null, { time: 0 }), b = v7SwordPose(null, { time: 0, flinch: 1 });
  assert.ok(b.lean < a.lean); for (const k of VEC) assert.deepEqual(a[k], b[k]);
});
// a real three.js rig with the V7 bone names: blends, the planted feet, the blade staying in the hand
function rig() { const B = {}, mk = (n, p, par) => { const b = new THREE.Bone(); b.name = n; b.position.set(...p); (par || null)?.add(b); B[n] = b; return b; };
  const root = mk('root', [0, 0.55, 0]), spine = mk('spine', [0, 0.1, 0], root); mk('head', [0, 0.3, 0], spine);
  const uL = mk('upperarmL', [0.12, 0.2, 0], spine), uR = mk('upperarmR', [-0.12, 0.2, 0], spine); mk('forearmL', [0.13, 0, 0], uL); mk('forearmR', [-0.13, 0, 0], uR);
  const tL = mk('thighL', [0.09, -0.02, 0], root), tR = mk('thighR', [-0.09, -0.02, 0], root); mk('shinL', [0, -0.25, 0], tL); mk('shinR', [0, -0.25, 0], tR);
  const sc = new THREE.Group(); sc.add(root); sc.updateMatrixWorld(true);
  return { sc, B: { root, spine, head: B.head, uL, uR, fL: B.forearmL, fR: B.forearmR, tL, tR }, shin: [B.shinL, B.shinR] }; }
const apply = makeV7SwordApply(THREE), Q = new THREE.Quaternion();
test('k = 0 leaves the clip pose; k = 1 aims the sword forearm where the pose says; the blade stays a child of the forearm', () => {
  const r = rig(), before = Object.values(r.B).map((b) => b.quaternion.clone());
  apply(r.B, v7SwordPose(0.476), 0, Q, 'R'); Object.values(r.B).forEach((b, i) => assert.ok(b.quaternion.angleTo(before[i]) < 1e-9));
  const blade = new THREE.Object3D(); r.B.fR.add(blade); const P = v7SwordPose(0.476); apply(r.B, P, 1, Q, 'R'); r.sc.updateMatrixWorld(true);
  assert.equal(blade.parent, r.B.fR);
  const fdir = new THREE.Vector3(-1, 0, 0).applyQuaternion(r.B.fR.getWorldQuaternion(new THREE.Quaternion()));
  const want = new THREE.Vector3(...P.f).applyAxisAngle(new THREE.Vector3(0, 1, 0), P.tw); assert.ok(fdir.dot(want) > 0.999);
});
test('planted feet: the stance turn moves neither foot orientation (shins) more than a hair', () => {
  const r = rig(), q0 = r.shin.map((s) => s.getWorldQuaternion(new THREE.Quaternion()));
  apply(r.B, v7SwordPose(0.64), 1, Q, 'R'); r.sc.updateMatrixWorld(true);
  r.shin.forEach((s, i) => assert.ok(s.getWorldQuaternion(new THREE.Quaternion()).angleTo(q0[i]) < 1e-6));
});
test('left-hand sword drives the left arm; the right arm becomes the free guard arm', () => {
  const r = rig(), P = v7SwordPose(0.476, { hand: 'L' }); apply(r.B, P, 1, Q, 'L'); r.sc.updateMatrixWorld(true);
  const fdir = new THREE.Vector3(1, 0, 0).applyQuaternion(r.B.fL.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(fdir.dot(new THREE.Vector3(...P.f).applyAxisAngle(new THREE.Vector3(0, 1, 0), P.tw)) > 0.999);
  const odir = new THREE.Vector3(-1, 0, 0).applyQuaternion(r.B.fR.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(odir.dot(new THREE.Vector3(...P.of).applyAxisAngle(new THREE.Vector3(0, 1, 0), P.tw)) > 0.999);
});
