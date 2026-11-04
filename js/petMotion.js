// [Raul items redo 2] PUMPFUN PIRATES pets in motion (BANKSY 10:36 AM 2026-11-04: "have the cat and monkey follow you around like crew
// does, make the parrot fly around and land back on shoulder"; 10:53 AM: + chimp, black gorilla, white gorilla). PURE (no three.js):
// js/onfoot/pets.js + js/pirateItems.js (ground pets) and js/pirateGear.js (parrots) drive their shader layers from these numbers,
// tests/pets.test.mjs runs them in node.
//  - ground pets: gait (walk / run phase by stride), personality when idle (cat sits + grooms, monkey hops, chimp hops + sits,
//    gorillas knuckle-walk, sit back and beat their chest); out -> G = [phase, walk, run, sit], A = [groom | beat, hop, look, lookPitch]
//  - parrots: perched on the shoulder; on foot they take off now and then (sooner when you stand still), fly a loop round you and land
//    back on the shoulder: birdFlight(t) = offset from the perch (bind space, m), heading, bank, wing flap.
export const GROUND_PETS = { pet_cat: 'cat', pet_cat_black: 'cat', pet_monkey: 'monkey', pet_chimp: 'chimp', pet_gorilla: 'gorilla', pet_gorilla_white: 'gorilla', pet_tiger: 'tiger' };   // [BANKSY 11:39 AM] + tiger
export const isGroundPet = (id) => !!GROUND_PETS[id];
export const isBird = (id) => typeof id === 'string' && id.startsWith('parrot_');
export const PET_KIND_ID = { cat: 0, monkey: 1, chimp: 2, gorilla: 2, tiger: 0 };   // the tiger walks / runs / sits like the cat (+ uLyK.z = 1: stretch + pounce)
// follow distance behind you (m, along your own trail like the crew), side offset, stride (m per gait cycle), top speeds
export const PET_FOLLOW = {
  back: { cat: 1.25, monkey: 1.35, chimp: 1.55, gorilla: 1.9, tiger: 2.0 }, side: 0.85, lost: 30, stuck: 1.5,
  stride: { cat: 0.55, monkey: 0.7, chimp: 0.95, gorilla: 1.35, tiger: 1.45 }, run: 10.2, near: 0.5,
};
export const PET_ACTS = {   // idle personality: [act, every (s, + random up to the same again), lasts (s)]
  cat: [['groom', 6, 3.2]], monkey: [['hop', 2.6, 0.55], ['look', 4, 1.6]], chimp: [['hop', 4, 0.6], ['look', 5, 1.8]], gorilla: [['beat', 7, 2.2], ['look', 5, 2]],
  tiger: [['stretch', 7, 2.6], ['hop', 4.5, 0.75], ['look', 5, 1.8]],   // a big stretch + yawn, a playful pounce
};
export const PET_SIT = { cat: 1, monkey: 0, chimp: 0.7, gorilla: 0.55, tiger: 0.9 };   // how far they settle down when idle (on deck: sitting by the wheel)
export function newPetState(kind, seed = 0.5) {
  return { kind, ph: 0, walk: 0, run: 0, sit: PET_SIT[kind] || 0, act: '', actT: 0, actLen: 0, nextAct: 2 + seed * 3, idleT: 9, look: 0, lookP: 0, lookTo: 0,
    seed, G: [0, 0, 0, PET_SIT[kind] || 0], A: [0, 0, 0, 0] };
}
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const ease = (c, t, k) => c + (t - c) * Math.min(1, k);
// one step: speed (m/s) the pet moves at this frame; rnd() in [0, 1)
export function petPose(st, speed, dt, rnd = Math.random) {
  dt = Math.min(0.1, Math.max(0, dt || 0)); const k = st.kind, moving = speed > 0.2;
  const stride = PET_FOLLOW.stride[k] || 0.6; st.ph = (st.ph + (moving ? (speed / stride) * Math.PI * 2 * dt : 0)) % (Math.PI * 200);
  st.walk = ease(st.walk, clamp(speed / 1.1, 0, 1), dt * 8); st.run = ease(st.run, clamp((speed - 3.4) / 2.6, 0, 1), dt * 6);
  st.idleT = moving ? 0 : st.idleT + dt;
  const sitTo = moving || st.idleT < 0.9 ? 0 : PET_SIT[k] || 0; st.sit = ease(st.sit, sitTo, dt * (sitTo ? 2.2 : 7));
  // idle acts
  if (moving) { st.act = ''; st.actT = 0; } else if (st.act) { st.actT += dt; if (st.actT >= st.actLen) { st.act = ''; st.actT = 0; } }
  else if (st.idleT > 1.2 && (st.nextAct -= dt) <= 0) {
    const L = PET_ACTS[k] || []; const a = L[Math.floor(rnd() * L.length) % Math.max(1, L.length)];
    if (a) { st.act = a[0]; st.actT = 0; st.actLen = a[2]; st.nextAct = a[1] * (1 + rnd()); if (a[0] === 'look') st.lookTo = (rnd() - 0.5) * 1.6; }
  }
  const u = st.actLen ? st.actT / st.actLen : 0, env = st.act ? Math.min(1, u * 5, (1 - u) * 5) : 0;
  const groom = st.act === 'groom' ? env : 0, beat = st.act === 'beat' ? env : 0, stretch = st.act === 'stretch' ? env : 0;
  const hop = st.act === 'hop' ? Math.sin(Math.PI * clamp(u, 0, 1)) : 0;
  st.look = ease(st.look, st.act === 'look' ? st.lookTo : moving ? 0 : 0.25 * Math.sin(st.idleT * 0.6 + st.seed * 6), dt * 3);
  st.lookP = ease(st.lookP, groom ? 0.45 : beat ? -0.3 : stretch ? -0.55 * stretch : 0, dt * 6);   // stretch: head up in a big yawn
  st.G[0] = st.ph; st.G[1] = st.walk; st.G[2] = st.run; st.G[3] = st.sit;
  st.A[0] = k === 'cat' ? groom : k === 'tiger' ? stretch : beat; st.A[1] = hop; st.A[2] = st.look; st.A[3] = st.lookP;
  return st;
}
// ---------------------------------------------------------------- parrots
export const FLIGHT = { up: 0.55, loop: 3.4, land: 0.75, r: 0.95, h: 0.4, lie: 1.15, every: [18, 34], idle: 3.5 };
export const FLIGHT_T = FLIGHT.up + FLIGHT.loop + FLIGHT.land;
const sm = (t) => t * t * (3 - 2 * t);
// pitch: the perched bird stands upright; in the air it lies forward (lie) like a flying bird
// t = seconds since take-off; seat = the perch (bind space: x = your left, y up, z forward); out = { p: [x, y, z] absolute bind-space
// position of the bird's centre, yaw (rad, 0 = facing forward +z), bank, flap (wing angle) }, null once landed
export function birdFlight(t, seat, out = { p: [0, 0, 0], yaw: 0, bank: 0, pitch: 0, flap: 0 }) {
  if (t < 0 || t >= FLIGHT_T) return null;
  const R = FLIGHT.r, cy = seat[1] + FLIGHT.h, a0 = Math.atan2(seat[0], seat[2]);   // the loop: a circle round your body axis, starting over the perch
  const circ = (a) => [Math.sin(a) * R, cy + 0.1 * Math.sin(a * 2), Math.cos(a) * R];
  const fl = Math.sin(t * 24), T1 = FLIGHT.up, T2 = T1 + FLIGHT.loop;
  if (t < T1) {   // take off: hop up + out to the circle
    const u = sm(t / T1), q = circ(a0 - 0.0); for (let k = 0; k < 3; k++) out.p[k] = seat[k] + (q[k] - seat[k]) * u + (k === 1 ? 0.18 * Math.sin(Math.PI * u) : 0);
    { const y1 = a0 - Math.PI / 2; out.yaw = Math.atan2(Math.sin(y1), Math.cos(y1)) * u; } out.bank = 0; out.pitch = FLIGHT.lie * u - 0.35 * Math.sin(Math.PI * u); out.flap = 0.95 * fl;
  } else if (t < T2) {   // one loop round you (counter-clockwise seen from above: heading = tangent), banking into the turn
    const u = (t - T1) / FLIGHT.loop, a = a0 - Math.PI * 2 * sm(u), q = circ(a); out.p[0] = q[0]; out.p[1] = q[1]; out.p[2] = q[2];
    out.yaw = a - Math.PI / 2; out.bank = -0.45 * Math.sin(Math.PI * u); out.pitch = FLIGHT.lie; out.flap = (u > 0.35 && u < 0.6 ? 0.25 : 0.85) * fl;   // a glide half way
  } else {   // land: glide back onto the perch, wings spread to brake
    const u = sm((t - T2) / FLIGHT.land), q = circ(a0 - Math.PI * 2); for (let k = 0; k < 3; k++) out.p[k] = q[k] + (seat[k] - q[k]) * u + (k === 1 ? 0.12 * Math.sin(Math.PI * u) : 0);
    out.yaw = (a0 - Math.PI * 2 - Math.PI / 2) * (1 - u) + 0 * u; out.yaw = Math.atan2(Math.sin(out.yaw), Math.cos(out.yaw)) * (1 - u); out.bank = 0; out.pitch = FLIGHT.lie * (1 - u) - 0.3 * Math.sin(Math.PI * u);
    out.flap = (u > 0.7 ? 0.5 * (1 - u) / 0.3 : 0.9) * fl;
  }
  return out;
}
// scheduler: state { t: -1 (perched) | seconds into the flight, wait }, idle = seconds you've stood still, canFly = on foot + dry
export function newBirdState(seed = 0.5) { return { t: -1, wait: FLIGHT.every[0] * (0.6 + seed), still: 0 }; }
export function birdTick(b, dt, { moving = false, canFly = true } = {}, rnd = Math.random) {
  dt = Math.min(0.1, Math.max(0, dt || 0));
  if (b.t >= 0) { b.t += dt; if (b.t >= FLIGHT_T) { b.t = -1; b.wait = FLIGHT.every[0] + (FLIGHT.every[1] - FLIGHT.every[0]) * rnd(); b.still = -6; } return b; }
  b.still = moving ? 0 : b.still + dt; b.wait -= dt;
  if (canFly && (b.wait <= 0 || b.still > FLIGHT.idle)) { b.t = 0; b.still = 0; }
  return b;
}
