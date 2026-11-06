// [Raul] PUMPFUN PIRATES swim animation (BANKSY queue: "swim animation polish"). Procedural bone poses on the shared v4 armature
// (v4 + v5 bodies, hi + lo: root, spine, head, upperarm/forearm/thigh/shin .L/.R; rest = T-pose, every bone ~identity, facing +Z):
//  - tread : upright, arms sculling out to the sides, egg-beater legs (the pirate is still in deep water)
//  - swim  : front crawl, arm cycle locked to the swim speed (SWIM_STRIDE metres per full two-arm cycle), flutter kick, body roll
//            + a breath to the side every other stroke
//  - climb : the 0.6 s pull-up out of the water (js/onfoot/physics.js PHYS.climbT): reach onto the ledge, press up, knee up, stand
//  - hop   : the surface kick (jump in deep water): streamline arms over the head, dolphin kick, nose-down re-entry
//  - ladder: [dock-ladders] up a dock ladder (js/dock/ladders.js ride): hands reach up the rails in turn, feet step up the rungs, then
//            a press over the top hoop onto the deck (upright: the body itself never tilts)
// Applied after the mixer (PirateGLB.post) and blended in / out over ~0.2 s so it never pops against the idle / walk / run clips.
// Cost: ~12 quaternion writes per visible pirate per frame, no allocation (phone-safe).
import * as THREE from 'three';

export const SWIM_STRIDE = 2.2;   // m per full crawl cycle: 2.3 m/s = 1.05 cycles/s, 3.6 m/s (sprint) = 1.64 cycles/s
export const BONES = ['root', 'spine', 'head', 'upperarm.L', 'forearm.L', 'upperarm.R', 'forearm.R', 'thigh.L', 'shin.L', 'thigh.R', 'shin.R'];
const BY = Object.fromEntries(BONES.flatMap((n) => [[n, n], [n.replace(/[^a-zA-Z]/g, ''), n]]));
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _d = new THREE.Vector3();
export const TAU = Math.PI * 2; export const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function rig(p) { // bone handles + rest quaternions + each arm's rest direction (to its child), once per body
  if (p._swRig !== undefined) return p._swRig; const B = {}; let ok = true;
  p.scene?.traverse((o) => { if (!o.isBone) return; const n = BY[o.name] || BY[o.name.replace(/[^a-zA-Z]/g, '')]; if (n && !B[n]) B[n] = o; }); // GLTFLoader drops the '.' (upperarm.L -> upperarmL)
  for (const n of BONES) if (!B[n]) ok = false;
  if (!ok) return (p._swRig = null);
  const R = {}; for (const n of BONES) R[n] = B[n].userData.swRest || (B[n].userData.swRest = B[n].quaternion.clone()); // the bind pose (captured before any clip ran: see PirateGLB._init)
  const dir = {}; for (const s of ['L', 'R']) { const fa = B['forearm.' + s]; dir[s] = fa.position.clone().applyQuaternion(R['upperarm.' + s]).normalize(); }
  return (p._swRig = { B, R, dir }); }

// per-bone targets (local, written into S then slerped over the mixer's pose by weight w)
export function eul(S, R, n, x, y, z) { _e.set(x, y, z, 'XYZ'); S[n].setFromEuler(_e).multiply(R[n]); }
export function arm(S, R, dir, s, tx, ty, tz, bend) { // s = 'L' | 'R': point the upper arm along (tx, ty, tz) (spine frame, mirrored for R), bend the elbow
  const m = s === 'L' ? 1 : -1; _d.set(tx * m, ty, tz).normalize(); _q.setFromUnitVectors(dir[s], _d); S['upperarm.' + s].copy(_q).multiply(R['upperarm.' + s]);
  _e.set(0, -bend * m, 0); S['forearm.' + s].setFromEuler(_e).multiply(R['forearm.' + s]); }
export function leg(S, R, s, thigh, knee, out = 0) { const m = s === 'L' ? 1 : -1; eul(S, R, 'thigh.' + s, thigh, 0, out * m); eul(S, R, 'shin.' + s, knee, 0, 0); }

function tread(S, R, dir, t) {
  const a = t * 3.1, sc = Math.sin(a);
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', 0.05, Math.sin(a * 0.5) * 0.05, 0); eul(S, R, 'head', -0.18, Math.sin(t * 0.7) * 0.25, 0);
  arm(S, R, dir, 'L', 1, -0.3, 0.35 + 0.35 * sc, 0.35 + 0.15 * sc); arm(S, R, dir, 'R', 1, -0.3, 0.35 - 0.35 * sc, 0.35 - 0.15 * sc); // sculling sweeps just under the surface
  const e = t * 4.2; leg(S, R, 'L', -0.75 + 0.25 * Math.sin(e), 1.05 + 0.35 * Math.cos(e), 0.35); leg(S, R, 'R', -0.75 + 0.25 * Math.sin(e + Math.PI), 1.05 + 0.35 * Math.cos(e + Math.PI), 0.35); }
function crawl(S, R, dir, ph) { // ph = stroke phase (rad, one full cycle = both arms)
  const roll = Math.sin(ph) * 0.38, breathe = sm(0.55, 0.9, Math.sin(ph * 0.5 + 0.3) ** 2) * (Math.sin(ph) > 0 ? 1 : 0);
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', 0, roll, 0); eul(S, R, 'head', -0.55, -roll * 0.6 + breathe * 0.7, 0);
  for (const [s, o] of [['L', 0], ['R', Math.PI]]) { // arm angle q: 0 = reaching ahead (over the head), PI/2 = pulling under the chest, PI = at the hip, 3PI/2 = recovering over the back
    const q = ph + o, c = Math.cos(q), n = Math.sin(q), rec = n < 0 ? -n : 0;
    arm(S, R, dir, s, 0.22 + 0.45 * rec, c, n > 0 ? n * 0.9 : n * 1.0, 0.25 + 0.5 * (n > 0 ? n : 0) + 0.85 * rec); }   // recovery: elbow high, out of the water
  const k = ph * 3; leg(S, R, 'L', 0.32 * Math.sin(k), 0.25 + 0.25 * Math.max(0, Math.sin(k + 0.9)), 0.05); leg(S, R, 'R', 0.32 * Math.sin(k + Math.PI), 0.25 + 0.25 * Math.max(0, Math.sin(k + Math.PI + 0.9)), 0.05); }
function climb(S, R, dir, k) { // k 0..1 over the pull-up
  const reach = 1 - sm(0.2, 0.55, k), press = sm(0.2, 0.55, k) * (1 - sm(0.7, 1, k)), stand = sm(0.7, 1, k), knee = sm(0.3, 0.6, k) * (1 - sm(0.8, 1, k));
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', 0.35 * press + 0.15 * reach, 0, 0); eul(S, R, 'head', -0.3 * reach + 0.1 * press, 0, 0);
  for (const s of ['L', 'R']) arm(S, R, dir, s, 0.3 * reach + 0.35 * press + 0.25 * stand, 0.75 * reach - 0.55 * press - 1 * stand, 0.85 * reach + 0.6 * press + 0.08 * stand, 0.15 * reach + 1.25 * press + 0.2 * stand);
  leg(S, R, 'L', -1.5 * knee, 1.6 * knee + 0.15 * reach, 0.05); leg(S, R, 'R', 0.25 * (reach + press) * (1 - stand), 0.35 * press, 0.03); }
function ladder(S, R, dir, k) { // k 0..1 over the ladder ride: 0..0.72 up the rungs (3 hand-over-hand cycles), 0.72..1 over the top
  const up = Math.min(1, k / 0.72), top = sm(0.72, 1, k), ph = up * 3 * TAU, a = Math.sin(ph), b = Math.sin(ph + Math.PI), lo = 1 - top, step = Math.sin(Math.PI * top);
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', 0.1 * lo + 0.3 * step, 0, 0); eul(S, R, 'head', -0.28 * lo + 0.05 * top, 0, 0);
  for (const [s, q] of [['L', a], ['R', b]]) { const r = 0.5 + 0.5 * q;   // r 1 = this hand reaching high up the rail, 0 = pulling down at the chest
    arm(S, R, dir, s, 0.2 * lo + 0.25 * top, (0.15 + 0.85 * r) * lo - 0.55 * top, 0.6 * lo + 0.55 * top, (1.05 - 0.75 * r) * lo + 0.45 * top); }
  for (const [s, q] of [['L', b], ['R', a]]) { const r = 0.5 + 0.5 * q;   // the opposite foot steps up as a hand reaches
    leg(S, R, s, -(0.2 + 0.9 * r) * lo - (s === 'L' ? 1.2 : 0.3) * step, (0.25 + 1.15 * r) * lo + (s === 'L' ? 1.3 : 0.4) * step, 0.04); } }
// [bed-desk] js/dock/bedDesk.js: the body is laid flat (lie) or set on the chair (sit) by the room; these are the limbs over it
function lie(S, R, dir, t) { // on the back in the bunk: upper body propped on the pillow (chibi head clear of it), hands folded on the belly, slow breaths
  const br = Math.sin(t * 1.5) * 0.02;
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', 0.34 + br, 0, 0); eul(S, R, 'head', 0.3, 0.1, 0);
  arm(S, R, dir, 'L', 0.3, -0.7, 0.62, 1.45); arm(S, R, dir, 'R', 0.3, -0.72, 0.6, 1.4);
  leg(S, R, 'L', 0.0, 0.05, 0.05); leg(S, R, 'R', -0.04, 0.12, 0.03); }
function sit(S, R, dir, t) { // on the chair facing the desk: thighs level, shins down, a little lean in, both hands resting on the desk top
  const br = Math.sin(t * 1.8) * 0.012;
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', 0.12 + br, 0, 0); eul(S, R, 'head', 0.16, Math.sin(t * 0.4) * 0.08, 0);
  arm(S, R, dir, 'L', 0.22, -0.32, 0.92, 0.5); arm(S, R, dir, 'R', 0.22, -0.32, 0.92, 0.5);
  leg(S, R, 'L', -1.5, 1.45, 0.06); leg(S, R, 'R', -1.5, 1.45, 0.06); }
export const REST_POSES = Object.freeze(['lie', 'sit']);
function hop(S, R, dir, k) { // k 0..1 over the surface kick
  const up = 1 - sm(0.75, 1, k), kick = Math.sin(k * TAU * 1.5) * (1 - k);
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', -0.3 * Math.sin(k * Math.PI), 0, 0); eul(S, R, 'head', -0.2 + 0.35 * k, 0, 0);
  for (const s of ['L', 'R']) arm(S, R, dir, s, 0.12, 0.6 + 0.4 * up, 0.55 * (1 - up) + 0.2, 0.1);
  for (const s of ['L', 'R']) leg(S, R, s, 0.25 + 0.45 * kick, 0.2 + 0.6 * Math.max(0, -kick), 0); }

// called from js/onfoot/pirate.js every frame with the physics state (poseBody): 'swim' | 'tread' | 'climb' | 'hop' | anything else (= fade out)
// k = climb / hop progress (0..1). Returns true while the procedural pose owns the body (the caller keeps the idle clip underneath).
export function swimPose(p, state, dt, speed = 0, k = 0) {
  const r = rig(p); if (!r) return false; const sw = p._sw || (p._sw = { w: 0, ph: 0, t: Math.random() * 9, st: null, S: Object.fromEntries(BONES.map((n) => [n, new THREE.Quaternion()])) });
  const on = state === 'swim' || state === 'tread' || state === 'climb' || state === 'hop' || state === 'ladder' || state === 'lie' || state === 'sit'; // [bed-desk] + lie / sit
  sw.w = Math.min(1, Math.max(0, sw.w + (on ? 1 : -1) * dt / (state === 'climb' || sw.st === 'climb' || state === 'ladder' || sw.st === 'ladder' ? 0.12 : 0.22)));
  if (on) { sw.st = state; sw.kk = k; } sw.t += dt;
  if (sw.st === 'swim') sw.ph += dt * TAU * Math.max(0.35, speed) / SWIM_STRIDE; else sw.ph += dt * 2; // keep turning slowly so the next stroke starts mid-cycle
  if (p.addPost) p.addPost('swim', postPose, 0); else if (!p.post) p.post = postPose; // [Raul emotes] shared post hook (PirateGLB.addPost)
  return sw.w > 0; }
function postPose() { // after mixer.update: pose the bones (PirateGLB.update)
  const sw = this._sw, r = this._swRig; if (!sw || !r || sw.w <= 0) return; const { B, R, dir } = r, S = sw.S;
  if (sw.st === 'tread') tread(S, R, dir, sw.t); else if (sw.st === 'swim') crawl(S, R, dir, sw.ph); else if (sw.st === 'climb') climb(S, R, dir, sw.kk); else if (sw.st === 'hop') hop(S, R, dir, sw.kk); else if (sw.st === 'ladder') ladder(S, R, dir, sw.kk); else if (sw.st === 'lie') lie(S, R, dir, sw.t); else if (sw.st === 'sit') sit(S, R, dir, sw.t); else return;
  const w = sw.w * sw.w * (3 - 2 * sw.w); for (const n of BONES) B[n].quaternion.slerp(S[n], w); }
