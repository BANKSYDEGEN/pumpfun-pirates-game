// [t2078u] V7 guy + girl locomotion polish, layered over the Blender idle / walk / run clips (shared 13-bone rig, see swimPose.js).
//  1. stride match: each clip's real ground speed (stance-foot travel per second, measured once per body from the clip itself)
//     sets the clip time scale, so planted feet don't skate at any move speed
//  2. phase-matched blends: walk <-> run keeps the foot phase (no double step), idle <-> walk eases in / out
//  3. post-mixer layer (PirateGLB.addPost order 0.5, after swim, before emotes): pelvis yaw + roll driven by the clip's own legs,
//     counter-rotating shoulders, extra arm swing opposite the legs, a stabilised head with a small bob; the female gait steps a
//     little narrower with more hip. Only body bones (root / spine / head / arms / thighs): hair, braid, tattoo, face and eyes untouched;
//     gear + capes are skinned / parented to these bones so they follow.
// Cost: ~10 quaternion multiplies per visible near pirate per frame, no allocation; skipped when off-screen / far (PirateGLB.update LOD).
import * as THREE from 'three';
import { rig } from './swimPose.js';

const _q = new THREE.Quaternion(), _d = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _ws = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
export const GAIT = {
  male: { yaw: .10, roll: .05, counter: 1.5, arm: .35, head: .75, bob: .035, narrow: 0 },
  female: { yaw: .13, roll: .085, counter: 1.35, arm: .26, head: .8, bob: .03, narrow: .045 },
};
// signed swing of a bone about the parent X axis vs its bind pose (sign follows the rig; arms correlate with the opposite thigh in the clips)
export function swingX(q, rest) { _d.copy(q).multiply(_q.copy(rest).invert()); return 2 * Math.atan2(_d.x, _d.w); }
const pre = (bone, axis, ang) => { if (ang) bone.quaternion.premultiply(_q.setFromAxisAngle(axis, ang)); };

// stance-foot speed of a clip in scene-local units / s (forward = +Z). Sampled on a throwaway mixer; the live mixer rewrites the pose next frame.
export function clipSpeed(p, name) {
  const S = p._gaitSpeed || (p._gaitSpeed = {}); if (S[name] !== undefined) return S[name];
  const R = rig(p), clip = p.clips?.[name]; if (!R || !clip || !p.scene) return (S[name] = 0);
  const { B } = R, save = {}; for (const k in B) save[k] = B[k].quaternion.clone();
  for (const k in B) B[k].quaternion.copy(R.R[k]); p.scene.updateMatrixWorld(true);
  const off = {}; for (const s of ['L', 'R']) { const th = B['thigh.' + s].getWorldPosition(new THREE.Vector3()), sh = B['shin.' + s].getWorldPosition(new THREE.Vector3()); off[s] = B['shin.' + s].worldToLocal(sh.clone().multiplyScalar(2).sub(th)); }
  const m = new THREE.AnimationMixer(p.scene), act = m.clipAction(clip); act.play();
  const N = 32, foot = [], toScene = new THREE.Matrix4();
  for (let i = 0; i <= N; i++) { m.setTime(clip.duration * i / N); p.scene.updateMatrixWorld(true); toScene.copy(p.scene.matrixWorld).invert();
    foot.push(['L', 'R'].map((s) => B['shin.' + s].localToWorld(off[s].clone()).applyMatrix4(toScene))); }
  act.stop(); m.uncacheRoot(p.scene);
  for (const k in B) B[k].quaternion.copy(save[k]);
  let travel = 0; for (let i = 0; i < N; i++) { const s = foot[i][0].y < foot[i][1].y ? 0 : 1; travel += Math.max(0, foot[i][s].z - foot[i + 1][s].z); }
  return (S[name] = clip.duration > 0 ? travel / clip.duration : 0);
}

// choose + time-scale the locomotion clip for a ground speed (m/s). Returns the clip name.
export function locomote(p, c, speed, { fall = false } = {}) {
  if (p.clip !== c) {
    const from = p.action, loco = (n) => n === 'walk' || n === 'run';
    p.play(c, { fade: loco(p.clip) && loco(c) ? .18 : .25 });
    if (from && loco(c) && loco(from.getClip().name) && p.action) p.action.time = (from.time / from.getClip().duration) * p.action.getClip().duration; // keep the foot phase
  }
  const a = p.action; if (!a) return c;
  if (c === 'idle') { a.setEffectiveTimeScale(1); return c; }
  if (fall) { a.setEffectiveTimeScale(1.7); return c; }
  const native = clipSpeed(p, c) * Math.abs(p.scene?.getWorldScale(_ws).x || 1);
  if (!(native > .05)) { a.setEffectiveTimeScale(Math.max(.6, c === 'run' ? speed / 6 : speed / 2.4)); p._strideK = 1; return c; }
  // the chibi legs cover less ground per cycle than the game speed: split the gap between cadence (time scale) and a longer stride
  // (extra thigh swing in the post layer) so the planted foot keeps pace without a frantic shuffle
  const r = speed / native, ts = Math.min(c === 'run' ? 1.75 : 1.6, Math.max(c === 'run' ? .65 : .5, Math.pow(r, .55)));
  a.setEffectiveTimeScale(ts); p._strideK = Math.min(1.5, Math.max(1, r / ts));
  return c;
}

function gaitPost(dt) {
  const R = rig(this); if (!R) return;
  const m = this.mixer, clips = this.clips; if (!m || !clips) return;
  const wa = clips.walk && m.existingAction(clips.walk), ra = clips.run && m.existingAction(clips.run);
  let w = (wa?.isRunning() ? wa.getEffectiveWeight() : 0) + (ra?.isRunning() ? ra.getEffectiveWeight() : 0);
  w *= 1 - Math.min(1, this._sw?.w || 0) ; if (this.root?.userData?.emote) w *= .5;
  this._gaitW = (this._gaitW || 0) + (w - (this._gaitW || 0)) * Math.min(1, dt * 12); w = this._gaitW;
  if (w < .01) return;
  const { B, R: rest } = R, G = this.female ? GAIT.female : GAIT.male;
  const aL = swingX(B['thigh.L'].quaternion, rest['thigh.L']), aR = swingX(B['thigh.R'].quaternion, rest['thigh.R']);
  const kL = Math.abs(swingX(B['shin.L'].quaternion, rest['shin.L'])), kR = Math.abs(swingX(B['shin.R'].quaternion, rest['shin.R']));
  const diff = Math.max(-1, Math.min(1, aL - aR)), bend = Math.max(-1, Math.min(1, kL - kR));
  const yaw = G.yaw * diff * w, roll = -G.roll * bend * w; // thigh swing + = leg back on this rig
  pre(B.root, Y, yaw); pre(B.root, Z, roll);                                 // pelvis leads the forward leg, swing side drops
  pre(B.spine, Y, -yaw * G.counter); pre(B.spine, Z, -roll * .7);            // shoulders counter-rotate, chest stays level
  pre(B['upperarm.L'], X, G.arm * aR * w); pre(B['upperarm.R'], X, G.arm * aL * w);   // arms opposite the legs (adds to the clip)
  const ny = yaw * (G.counter - 1), bob = G.bob * Math.abs(diff) * w;
  pre(B.head, Y, -ny * G.head); pre(B.head, Z, roll * .3 * G.head); pre(B.head, X, bob - .5 * G.bob * w); // eyes level, small nod per step
  const k = ((this._strideK || 1) - 1) * w; if (k > 0) { pre(B['thigh.L'], X, aL * k); pre(B['thigh.R'], X, aR * k); }   // longer stride to match speed
  if (G.narrow) { pre(B['thigh.L'], Z, -G.narrow * w); pre(B['thigh.R'], Z, G.narrow * w); }   // narrower step line
}
export function attachGait(p) { if (p?.addPost && !p._gaitOn) { p._gaitOn = true; p.addPost('gait', gaitPost, .5); } }
