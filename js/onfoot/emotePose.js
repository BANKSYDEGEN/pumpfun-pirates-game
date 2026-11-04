// [Raul emotes] PUMPFUN PIRATES body emotes ON LAND (BANKSY: "keep the current emotes but give them motions for those emotes when on land").
// The quick-chat wheel (js/emotes.js) is unchanged; a pick made while you walk the island also plays a body motion on your pirate, your
// shore crew (Arr! / Yo ho ho! only, the lines their voices already join) and on your pirate in every other harbor client (the existing
// 'emo' room message, no new field). Procedural bone poses on the shared v4 armature (v4 + v5 bodies, hi + lo), same rig + helpers as
// js/onfoot/swimPose.js, run after the mixer through PirateGLB.addPost (order 1, after the swim layer) and blended in / out (~0.15 s).
//  - land only: in the water, mid-air, in the pull-up or the surface kick it fades straight out (the voice + bubble still play)
//  - moving: UPPER emotes keep playing on spine / head / arms over the walk / run clip; FULL emotes (the jig) cancel when you move
//  - all 8: 0 Arr! fist pump · 1 Follow me! point + wave · 2 Boss incoming! startle + point · 3 Need help! arms wave x3 · 4 Attack! lunge ·
//    5 Retreat! wave back over the shoulder · 6 GG bow (cancels when you walk) · 7 Yo ho ho! jig (cancels when you walk); 100 = the crew's nod
// Cost: <= 11 quaternion slerps per emoting pirate per frame, no allocation, nothing at all while no emote runs.
import * as THREE from 'three';
import { BONES, rig, eul, arm, leg, sm, TAU } from './swimPose.js';

const UPPER = ['spine', 'head', 'upperarm.L', 'forearm.L', 'upperarm.R', 'forearm.R'];
const FADE_IN = 0.15, FADE_OUT = 0.2, CANCEL = 0.15;
const ease = (x) => sm(0, 1, x), tri = (x) => 1 - Math.abs(((x % 1) + 1) % 1 * 2 - 1); // 0..1..0 per unit

// ---- the motions: f(S, R, dir, t, k) with t = seconds into the emote, k = t / dur ----
function arr(S, R, dir, t, k) { // 1.2 s: right fist thrust up beside the head twice (a "V" with the body), chest out, head back, left fist braced low
  const up = sm(0, 0.18, t) * (1 - sm(1.0, 1.2, t)), pump = Math.max(0, Math.sin(Math.min(1, Math.max(0, (t - 0.15) / 0.8)) * TAU)); // 2 pumps
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', -0.14 * up - 0.05 * pump, 0.05 * up, 0.03 * up); eul(S, R, 'head', -0.34 * up - 0.12 * pump, 0.12 * up, 0.05 * up);
  arm(S, R, dir, 'R', 0.7 - 0.3 * up + 0.15 * pump, -0.75 + 1.45 * up + 0.4 * pump, 0.05 + 0.25 * up - 0.15 * pump, 0.3 + 0.45 * up * (1 - pump) - 0.2 * up * pump); // fist cocked by the ear -> punched straight up
  arm(S, R, dir, 'L', 0.75, -0.75, 0.15 + 0.1 * up, 0.55 + 0.35 * up);
  leg(S, R, 'L', 0, 0, 0); leg(S, R, 'R', 0, 0, 0); }
function follow(S, R, dir, t, k) { // 1.4 s: right arm swings back then points ahead and up (your facing), left arm waves "this way" overhead, head nods
  const pt = sm(0.12, 0.42, t) * (1 - sm(1.15, 1.4, t)), wind = sm(0, 0.15, t) * (1 - sm(0.15, 0.4, t)), bk = sm(0.25, 0.45, t) * (1 - sm(1.1, 1.35, t));
  const cur = 0.5 + 0.5 * Math.sin((t - 0.3) * TAU * 1.9), nod = Math.sin(Math.max(0, t - 0.35) * TAU * 1.5) * bk;
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', 0.08 * pt, -0.1 * pt + 0.05 * wind, 0); eul(S, R, 'head', 0.18 * nod - 0.08 * pt, -0.25 * pt, 0);
  arm(S, R, dir, 'R', 0.7 - 0.45 * pt + 0.1 * wind, -0.75 + 1.05 * pt + 0.3 * wind, -0.6 * wind + 1.0 * pt, 0.3 * (1 - pt) + 0.04); // straight point, ahead + a little up
  arm(S, R, dir, 'L', 0.75 - 0.2 * bk, -0.75 + 1.45 * bk, 0.15 + 0.15 * bk, 0.3 + bk * (0.15 + 1.0 * cur));   // up by the head, forearm waving forward
  leg(S, R, 'L', 0, 0, 0); leg(S, R, 'R', 0, 0, 0); }
const BAR = 0.56; // the synth stomp spacing (js/audio.js pirateVoice e = 7)
function jig(S, R, dir, t, k) { // 4 bars: mug raised high on the left and swaying, right hand on the hip, alternating knee kicks on the beat
  const env = sm(0, 0.2, t) * (1 - sm(2.0, 2.24, t)), b = t / BAR, half = (b * 2) % 2, sway = Math.sin(b * Math.PI) * env, hk = half % 1, kick = sm(0, 0.3, hk) * (1 - sm(0.7, 1, hk)) * env; // held kick, down on the beat
  const L = half < 1, kl = L ? kick : 0, kr = L ? 0 : kick;
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', -0.05 * env + 0.05 * kick, 0.06 * sway, 0.08 * sway); eul(S, R, 'head', -0.14 * env + 0.12 * kick, -0.22 * sway, -0.12 * sway);
  arm(S, R, dir, 'L', 0.55, -0.4 + 1.25 * env + 0.12 * kick, 0.2, 0.3 + 0.35 * env);            // the mug, up high
  arm(S, R, dir, 'R', 0.85, -0.75 + 0.25 * env, -0.2 - 0.15 * sway, 0.4 + 0.9 * env);              // elbow out, hand on the hip
  leg(S, R, 'L', -1.15 * kl, 1.5 * kl, 0.1 * kl); leg(S, R, 'R', -1.15 * kr, 1.5 * kr, 0.1 * kr); }

function boss(S, R, dir, t, k) { // 1.5 s: startle (both hands jump to the sides of the head, lean back), then the right arm points out to sea
  const grab = sm(0, 0.12, t) * (1 - sm(0.5, 0.7, t)), pt = sm(0.55, 0.8, t) * (1 - sm(1.25, 1.5, t)), jit = Math.sin(t * 38) * 0.04 * grab;
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', -0.16 * grab + 0.08 * pt, jit - 0.1 * pt, 0); eul(S, R, 'head', -0.2 * grab + 0.05 * pt, -0.3 * pt, jit);
  arm(S, R, dir, 'R', 0.75 - 0.05 * grab - 0.4 * pt, -0.75 + 1.35 * grab + 0.95 * pt, 0.15 + 0.15 * grab + 0.75 * pt, 0.3 + 1.2 * grab - 0.25 * pt);
  arm(S, R, dir, 'L', 0.75 - 0.05 * grab, -0.75 + 1.35 * grab, 0.15 + 0.15 * grab, 0.3 + 1.2 * grab);
  leg(S, R, 'L', 0, 0, 0); leg(S, R, 'R', 0, 0, 0); }
function help(S, R, dir, t, k) { // 3 x 0.6 s: both arms high, waving side to side and crossing over the head
  const env = sm(0, 0.15, t) * (1 - sm(1.6, 1.8, t)), w = Math.sin(t / 0.6 * TAU);
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', -0.06 * env, 0, 0.07 * w * env); eul(S, R, 'head', -0.25 * env, 0.08 * w * env, 0);
  arm(S, R, dir, 'L', 0.75 - env * (0.45 + 0.4 * w), -0.75 + 1.7 * env, 0.15, 0.3 - 0.15 * env);
  arm(S, R, dir, 'R', 0.75 - env * (0.45 - 0.4 * w), -0.75 + 1.7 * env, 0.15, 0.3 - 0.15 * env);
  leg(S, R, 'L', 0, 0, 0); leg(S, R, 'R', 0, 0, 0); }
function attack(S, R, dir, t, k) { // 1.0 s: charge! step-lunge forward, right arm thrust ahead + up, left fist pulled back
  const l = sm(0, 0.22, t) * (1 - sm(0.7, 1.0, t));
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', 0.3 * l, -0.12 * l, 0); eul(S, R, 'head', -0.3 * l, 0.08 * l, 0);
  arm(S, R, dir, 'R', 0.75 - 0.55 * l, -0.75 + 1.2 * l, 0.15 + 0.85 * l, 0.3 - 0.25 * l);
  arm(S, R, dir, 'L', 0.75 - 0.25 * l, -0.75 + 0.15 * l, 0.15 - 0.75 * l, 0.3 + 0.9 * l);
  leg(S, R, 'R', -0.65 * l, 0.75 * l, 0.05 * l); leg(S, R, 'L', 0.35 * l, 0.2 * l, 0); }
function retreat(S, R, dir, t, k) { // 1.4 s: "fall back!": right arm sweeps back over the shoulder twice, torso turns away, a look back
  const env = sm(0, 0.15, t) * (1 - sm(1.15, 1.4, t)), sw = 0.5 - 0.5 * Math.cos(Math.max(0, t - 0.1) / 0.55 * TAU);
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', -0.04 * env, 0.18 * env, 0); eul(S, R, 'head', -0.08 * env, 0.55 * env, 0);
  arm(S, R, dir, 'R', 0.75 - 0.4 * env, -0.75 + env * (1.3 + 0.15 * sw), 0.15 + env * (0.45 - 1.1 * sw), 0.3 + 0.3 * env);
  arm(S, R, dir, 'L', 0.75, -0.75, 0.15, 0.3);
  leg(S, R, 'L', 0, 0, 0); leg(S, R, 'R', 0, 0, 0); }
function bow(S, R, dir, t, k) { // 1.6 s: GG: right hand to the chest, left arm swept out, a deep bow from the spine, back up
  const h = sm(0, 0.25, t) * (1 - sm(1.3, 1.6, t)), b = sm(0.2, 0.6, t) * (1 - sm(1.0, 1.4, t));
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', 0.55 * b, 0, 0); eul(S, R, 'head', 0.3 * b, 0, 0);
  arm(S, R, dir, 'R', 0.75 - 0.5 * h, -0.75 + 0.4 * h, 0.15 + 0.6 * h, 0.3 + 1.6 * h);
  arm(S, R, dir, 'L', 0.75 + 0.15 * h, -0.75 + 0.25 * h, 0.15 - 0.4 * h, 0.3 - 0.1 * h);
  leg(S, R, 'L', 0, 0, 0); leg(S, R, 'R', 0, 0, 0); }
function nod(S, R, dir, t, k) { // 0.8 s: the crew's answer to a point (Follow me! / Boss incoming!): look the way you point + a nod
  const env = sm(0, 0.15, t) * (1 - sm(0.6, 0.8, t)), n = Math.sin(Math.max(0, t - 0.1) / 0.35 * TAU) * env;
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', 0.04 * env, 0, 0); eul(S, R, 'head', 0.22 * n, -0.3 * env, 0);
  arm(S, R, dir, 'L', 0.75, -0.75, 0.15, 0.3); arm(S, R, dir, 'R', 0.75, -0.75, 0.15, 0.3); leg(S, R, 'L', 0, 0, 0); leg(S, R, 'R', 0, 0, 0); }
const HEADS = ['spine', 'head'];

export const EMOTE_POSES = {   // id (js/emotes.js EMOTES index) -> motion
  0: { f: arr, dur: 1.2, upper: true, walk: 'upper' },     // Arr!
  1: { f: follow, dur: 1.4, upper: true, walk: 'upper' }, // Follow me!
  7: { f: jig, dur: 2.24, upper: false, walk: 'cancel' }, // Yo ho ho! (4 bars)
  2: { f: boss, dur: 1.5, upper: true, walk: 'upper' },   // Boss incoming!
  3: { f: help, dur: 1.8, upper: true, walk: 'upper' },   // Need help! (3 waves)
  4: { f: attack, dur: 1.0, upper: false, walk: 'upper' }, // Attack! (the lunge legs only standing still)
  5: { f: retreat, dur: 1.4, upper: true, walk: 'upper' }, // Retreat!
  6: { f: bow, dur: 1.6, upper: true, walk: 'cancel' },   // GG (the bow stops when you walk)
  100: { f: nod, dur: 0.8, upper: true, walk: 'upper', only: HEADS }, // crew only: nod + look (answers 1 / 2)
};
export const hasEmotePose = (e) => !!EMOTE_POSES[e];

// start an emote on a loadPirate() object (root); delay = s before it begins (the crew's stagger). Returns false for ids without a motion.
export function startEmote(root, e, delay = 0) { if (!root || !EMOTE_POSES[e]) return false; root.userData.emote = { e, t: -delay, w: 0, live: true }; return true; }
export const stopEmote = (root) => { const m = root?.userData?.emote; if (m) m.live = false; };
export const emoting = (root) => !!root?.userData?.emote;

// js/onfoot/pirate.js update(), every frame: state = poseBody's state (null on dry ground). Clears itself when done.
export function emotePose(p, root, state, dt, speed = 0) {
  const m = root.userData.emote; if (!m) return; const r = rig(p); if (!r) { root.userData.emote = null; return; }
  const D = EMOTE_POSES[m.e]; if (!D) { root.userData.emote = null; return; }
  m.t += dt; if (m.t < 0) { if (state || root.userData.air) root.userData.emote = null; return; } // still waiting (crew stagger); dropped if wet / airborne
  const moving = speed > 0.4, land = !state && !root.userData.air;
  if (!land || (moving && D.walk === 'cancel')) m.live = false;
  m.up = D.upper || moving;   // the legs stay on the clip while walking
  const end = m.t >= D.dur;
  m.w = m.live && !end ? Math.min(1, m.w + dt / FADE_IN) : Math.max(0, m.w - dt / (m.live ? FADE_OUT : CANCEL));
  if (m.w <= 0 && (end || !m.live)) { root.userData.emote = null; return; }
  if (!p._emS) p._emS = Object.fromEntries(BONES.map((n) => [n, new THREE.Quaternion()]));
  p._em = m; p.addPost?.('emote', postEmote, 1); }
function postEmote() { // after mixer.update (+ the swim layer): pose, then slerp over the clip by the emote weight
  const m = this._em, r = this._swRig; if (!m || !r || m.w <= 0) return; const D = EMOTE_POSES[m.e]; if (!D) return;
  const { B, R, dir } = r, S = this._emS; D.f(S, R, dir, Math.min(D.dur, Math.max(0, m.t)), Math.min(1, Math.max(0, m.t / D.dur)));
  const w = m.w * m.w * (3 - 2 * m.w); for (const n of D.only || (m.up ? UPPER : BONES)) B[n].quaternion.slerp(S[n], w);
  if (m.w <= 0 || !m.live && m.w < 0.01) this._em = null; }
