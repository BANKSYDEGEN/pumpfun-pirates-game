// [dock-ladders] PUMPFUN PIRATES: climbable dock / pier / jetty ladders (BANKSY t1715u "also make it if jump off docks can climb up the ladders").
// Jump off a jetty, swim back to one of the iron-hoop ladders and you go up it: swim INTO the ladder, touch its rungs, or press JUMP next
// to it. BANKSY t1723u "Don't need clickable dock ladders just if ladder is there climb up": NO prompt / button at all (the E button
// stays free for BOARD SHIP etc.), the climb is automatic. The harbor walk rules (js/dock/world.js blocked: a deck more than 2.4 m
// over where you float is a wall) stay exactly as they were: the climb is a walker ride (js/onfoot/walker.js w.ride) that owns
// x / y / z for ~0.55 s, straight up the rungs, over the top hoop and onto a landing spot on the deck that is clear of every prop.
// ONE catalogue (ladderCatalog) of every ladder drawn in the game, same numbers as the art:
//   - plaza v2 jetties J1..J5 (tools/plaza_blender/docks_blender.py): 2 at the outer end + 2 on the sides near the root  = 20
//   - the boardwalk sea face between the jetties (docks_blender.py boardwalk chunk loop, one per chunk clear of a root)  =  7
//   - the SWIM COVE jetty swim ladder (js/island/foot.js buildSwimCove)                                                    =  1
//   - Grandpa Gill's fishing dock on the Freshwater Lagoon (js/island/areas/lagoon.js)                                    =  1
//   (the old v103 T-head piers P3 / P4 kept west of the berth fan have no ladder art: nothing to climb there)
// Frames: 'town' = town-local (lx along the waterfront, +lz out to sea: js/island/coast.js t2w), 'foot' = the on-foot island world.
// &ladders=0 = off (the old behaviour: no ladder climbs).
import { ADM } from '../adminState.js';
import { placeBody } from '../onfoot/physics.js';

export const LADDERS_ON = !(typeof location !== 'undefined' && /[?&]ladders=0(&|$)/.test(location.search || ''));
export const LADDER = {
  grabR: 1.35,     // swim into the ladder this close to its grab point (+ moving toward the dock) = auto climb
  touchR: 0.75,    // this close = touching the rungs: climbs even with no move input
  jumpR: 2.2,      // JUMP in the water this close = climb
  nearR: 2.8,      // ladders looked at round you (in the water only)
  inDot: 0.25,     // move input . the inward direction must beat this for the auto climb
  grabOff: 0.55,   // grab point: this far out from the rungs, over the water
  faceOff: 0.42,   // body centre this far out from the rungs while climbing (chest at the rungs, never inside the deck)
  T: 0.55, Tmax: 0.85, upK: 0.72,   // ride time (s; a little longer for the tall harbor decks), the share of it spent going up the rungs
  cool: 0.8,       // after a climb: no auto climb
  entryCool: 0.85,  // after dropping into the water from above (jumped / fell off the dock): no auto climb
  dryK: 0.5,       // standing within this of the ladder top = on the deck: never a climb
  wadeK: 1.0,      // wading (not swimming) counts as "in the water" when the deck is this far above you
};
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---- the docks_blender.py boardwalk ladders: same chunks, same arange(lxa + 13, lxb - 2, 40), same in_root(x, 3) skip ----
export function boardwalkLadderX(PV) {
  const B = PV.BOARDWALK, st = (B.lxS - B.lx0) / 12, pieces = [];
  for (let i = 0; i < 12; i += 2) pieces.push([B.lx0 + i * st, B.lx0 + (i + 2) * st]);                 // 6 x 2 sloped BW_SEGS
  for (let i = 0; i < 6; i++) pieces.push([B.lxS + (B.lx1 - B.lxS) * i / 6, B.lxS + (B.lx1 - B.lxS) * (i + 1) / 6]); // 6 flat east chunks
  const roots = PV.JETTIES.map(j => [j.lx - PV.JETTY.w / 2, j.lx + PV.JETTY.w / 2]), inRoot = (x, pad) => roots.some(([a, b]) => a - pad < x && x < b + pad);
  const out = []; for (const [a, b] of pieces) for (let x = a + 13; x < b - 2; x += 40) if (!inRoot(x, 3)) out.push(+x.toFixed(3));
  return out;
}
// the boardwalk props a landing must clear (docks_blender.py BOLL bollards + rope coils, mooring posts at the roots, plazaTown torch posts)
export function boardwalkProps(PV) {
  const B = PV.BOARDWALK, roots = PV.JETTIES.map(j => [j.lx - PV.JETTY.w / 2, j.lx + PV.JETTY.w / 2]).sort((p, q) => p[0] - q[0]), spans = []; let x0 = B.lx0;
  for (const [a, b] of roots) { spans.push([x0, a]); x0 = b; } spans.push([x0, B.lx1]);
  const props = [];
  for (const [a, b] of spans) { if (b - a < 1) continue; for (let x = a + 6; x < b - 3; x += 12) { props.push({ lx: x, lz: B.lz1 - 0.9, r: 0.4 }); const ix = Math.trunc(x); if (((ix % 24) + 24) % 24 < 12) props.push({ lx: x - 0.9, lz: B.lz1 - 0.7, r: 0.42 }); } }
  for (const [a, b] of roots) for (const x of [a - 0.35, b + 0.35]) props.push({ lx: x, lz: B.lz1 - 0.2, r: 0.3 });
  for (const j of PV.JETTIES) for (const sx of [-1, 1]) props.push({ lx: j.lx + sx * (PV.JETTY.w / 2 + 0.6), lz: B.lz1 - 0.6, r: 0.3 });
  return props;
}
// nudge a boardwalk landing along lx off any prop circle (body radius 0.45): 0, +-0.4, +-0.8 .. +-2.4 m
export function nudgeClear(lx, lz, props, rad = 0.45) {
  for (const d of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.0, -2.0, 2.4, -2.4]) { const x = lx + d;
    if (props.every(p => Math.hypot(x - p.lx, lz - p.lz) >= p.r + rad + 0.05)) return +x.toFixed(3); }
  return lx;
}

/** Every ladder in the game, in its own frame. PV = js/island/plazaTown.js, CO = js/island/coast.js, lagoon = { x, z, out, dock, y? } (lagoon.js). */
export function ladderCatalog({ PV = null, CO = null, lagoon = null, plazaV2 = true } = {}) {
  const out = [];
  const add = (o) => out.push({ climbable: true, ...o });
  if (PV && plazaV2) {
    const JW = PV.JETTY.w, lz1 = PV.JETTY.lz1 + 0.15;   // docks_blender.py: lz1 = JLZ1 + 0.15, lz0 = j.lz0 - 0.5
    for (const j of PV.JETTIES) { const lz0 = j.lz0 - 0.5;
      for (const sx of [-1, 1]) {
        add({ id: `${j.id}_end_${sx < 0 ? 'w' : 'e'}`, kind: 'jetty_end', jetty: j.id, frame: 'town', rung: [j.lx + sx * 2.5, lz1 + 0.2], out: [0, 1], land: [j.lx + sx * 2.5, PV.JETTY.lz1 - 1.15], yTop: j.y });
        add({ id: `${j.id}_side_${sx < 0 ? 'w' : 'e'}`, kind: 'jetty_side', jetty: j.id, frame: 'town', rung: [j.lx + sx * (JW / 2 + 0.2), lz0 + 8], out: [sx, 0], land: [j.lx + sx * 4.5, 14.8], yTop: j.y });
      } }
    const props = boardwalkProps(PV), lzL = PV.BOARDWALK.lz1 - 1.5;   // lz 6.5: inside the sea rail (lz 7.7..7.9) and the bollard row (7.1)
    for (const x of boardwalkLadderX(PV)) add({ id: `bw_${Math.round(x)}`, kind: 'boardwalk', frame: 'town', rung: [x, PV.BOARDWALK.lz1 + 0.2], out: [0, 1], land: [nudgeClear(x, lzL, props), lzL], yTop: +PV.bwY(x).toFixed(3) });
  }
  if (CO?.SWIM_COVE) { const J = CO.SWIM_COVE.jetty;
    add({ id: 'cove_jetty', kind: 'cove', frame: 'town', rung: [J.lx1 + 2, J.lz - J.hw - 0.12], out: [0, -1], land: [J.lx1 + 2, J.lz], yTop: J.y }); }
  if (lagoon) add({ id: 'lagoon_dock', kind: 'lagoon', frame: 'foot', rung: [lagoon.x, lagoon.z], out: lagoon.out || [1, 0], land: [lagoon.dock ? lagoon.dock.x : lagoon.x - 2, lagoon.z], yTop: lagoon.y ?? null });
  return out;
}

/** Map the catalogue into a walk frame. town(lx, lz) -> [x, z], foot(x, z) -> [x, z] (both affine). Adds the grab point, the climb
 *  face point and the climb yaw (forward = (sin yaw, cos yaw), facing the rungs = into the dock). */
export function mapLadders(list, { town, foot }) {
  return list.map(L => { const f = L.frame === 'foot' ? foot : town; if (!f) return null;
    const [rx, rz] = f(...L.rung), [ax, az] = f(L.rung[0] + L.out[0], L.rung[1] + L.out[1]), [lx, lz] = f(...L.land);
    let ox = ax - rx, oz = az - rz; const n = Math.hypot(ox, oz) || 1; ox /= n; oz /= n;
    return { ...L, x: rx, z: rz, outX: ox, outZ: oz, landX: lx, landZ: lz, grabX: rx + ox * LADDER.grabOff, grabZ: rz + oz * LADDER.grabOff,
      faceX: rx + ox * LADDER.faceOff, faceZ: rz + oz * LADDER.faceOff, climbYaw: Math.atan2(-ox, -oz) }; }).filter(Boolean);
}
export function nearestLadder(list, x, z, r = LADDER.nearR) { let best = null, bd = r;
  for (const L of list) { if (!L.climbable || L.yTop == null) continue; const d = Math.hypot(x - L.grabX, z - L.grabZ); if (d < bd) { bd = d; best = L; } }
  return best ? { L: best, d: bd } : null; }
/** in the water at this ladder: swimming, or wading with the deck well above you (never when standing on the deck / in the air) */
export function inWaterAt(L, b, y, surf) { if (b.air) return false; if (y >= L.yTop - LADDER.dryK) return false; return !!b.swim || (surf != null && L.yTop - y > LADDER.wadeK); }
/** the climb decision: 'jump' (JUMP pressed near it), 'auto' (swimming into it / touching its rungs), or null. Nothing during the
 *  cooldowns (just dropped in off the dock, just climbed), not even JUMP: jumping off next to a ladder never sucks you back up */
export function climbWanted({ d, dot, jump, cool, inWater }) {
  if (!inWater || cool > 0) return null;
  if (jump && d <= LADDER.jumpR) return 'jump';
  return d <= LADDER.touchR || (d <= LADDER.grabR && dot > LADDER.inDot) ? 'auto' : null;
}
export const rideTime = (rise) => Math.min(LADDER.Tmax, Math.max(LADDER.T, LADDER.T + 0.08 * (rise - 2)));
/** where you are k (0..1) into the climb from (x0, y0, z0): onto the rung face, straight up the rungs, then over the top onto the deck */
export function climbPath(L, x0, y0, z0, k, out = {}) {
  const U = LADDER.upK, top = L.yTop + 0.05;
  if (k < U) { const u = k / U, h = sm(0, 0.3, u), e = u * u * (3 - 2 * u);
    out.x = lerp(x0, L.faceX, h); out.z = lerp(z0, L.faceZ, h); out.y = lerp(y0, top, e); out.phase = 'up'; }
  else { const v = Math.min(1, (k - U) / (1 - U)), e = v * v * (3 - 2 * v);
    out.x = lerp(L.faceX, L.landX, e); out.z = lerp(L.faceZ, L.landZ, e); out.y = v >= 1 ? L.yTop : top + 0.14 * Math.sin(Math.PI * v) - 0.05 * v; out.phase = 'over'; }
  return out;
}
/** move input as a world direction (the walker's camera-relative WASD / stick), or null */
export function moveDir(w) {
  const K = w.keys || {}; let f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), s = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
  if (w.joy?.on && Math.hypot(w.joy.x, w.joy.y) > 0.12) { f = -w.joy.y; s = w.joy.x; }
  const n = Math.hypot(f, s); if (n < 0.01) return null; const fx = Math.sin(w.camYaw), fz = Math.cos(w.camYaw);
  return [(fx * f - fz * s) / n, (fz * f + fx * s) / n];
}
/** spots on the deck for the crew / pet next to the landing: inward, then to the sides (free(x, z) = walkable + clear) */
export function deckSpots(L, n, free) {
  const ix = -L.outX, iz = -L.outZ, sx = -iz, sz = ix, got = [];
  const cand = []; for (let r = 1; r <= 4; r++) for (const [a, b] of [[r * 0.9, 0], [r * 0.6, 0.9], [r * 0.6, -0.9], [r * 0.3, 1.8], [r * 0.3, -1.8]]) cand.push([L.landX + ix * a + sx * b, L.landZ + iz * a + sz * b]);
  for (const [x, z] of cand) { if (got.length >= n) break; if (got.some(([gx, gz]) => Math.hypot(gx - x, gz - z) < 0.8)) continue; if (free(x, z)) got.push([x, z]); }
  while (got.length < n) got.push([L.landX, L.landZ]);
  return got;
}

/** The runtime (harbor game): js/dock/index.js calls tick(dt) right BEFORE walker.update (so a JUMP next to a ladder is eaten here).
 *  No prompt: climbing is automatic. */
export function createLadders({ world, layout, walker, pirate, crewF = null, petF = null, lagoon = null, sfx = null }) {
  const CO = layout.CO, FM = layout.FM, PV = FM?.PV || null, v2 = layout.decks.some(d => d.id === 'jetty_J1');
  const town = (lx, lz) => layout.footToHarbor(...CO.t2w(lx, lz)), foot = (x, z) => layout.footToHarbor(x, z);
  const list = mapLadders(ladderCatalog({ PV, CO, lagoon, plazaV2: v2 }), { town, foot });
  const free = (x, z, yTop) => !world.blocked(x, z) && Math.abs(world.ground(x, z) - yTop) < 0.15;
  // resolve against the live walk world once (lagoon dock height, a landing nudged off a prop; a ladder whose top is not walkable is off)
  for (const L of list) {
    if (L.yTop == null) L.yTop = world.ground(L.landX, L.landZ);
    if (!free(L.landX, L.landZ, L.yTop)) { const ix = -L.outX, iz = -L.outZ, sx = -iz, sz = ix; let ok = false;
      for (const [a, b] of [[0, 0.4], [0, -0.4], [0.4, 0], [0, 0.8], [0, -0.8], [0.8, 0], [0.4, 0.8], [0.4, -0.8], [1.2, 0], [0, 1.2], [0, -1.2]]) {
        const x = L.landX + ix * a + sx * b, z = L.landZ + iz * a + sz * b; if (free(x, z, L.yTop)) { L.landX = x; L.landZ = z; ok = true; break; } }
      if (!ok) L.climbable = false; } }
  const st = { cool: 0, prevAir: false, ride: null, last: null, climbs: 0 };
  const W = () => walker.w;
  function near() { const w = W(); if (!w.active || w.ride) return null; const n = nearestLadder(list, w.x, w.z, LADDER.nearR); if (!n) return null;
    const surf = world.water ? world.water(w.x, w.z) : null; if (!inWaterAt(n.L, w.body, w.y, surf)) return null; return n; }
  function finish(L) {
    const w = W(); st.cool = LADDER.cool; st.ride = null; st.last = L.id; st.climbs++;
    // the crew + pet: anyone still in the water (or stranded below the deck) comes up with you
    const fr = (x, z) => free(x, z, L.yTop);
    const crew = (crewF?.active ? crewF.list : []).filter(c => !c.zip && Math.hypot(c.x - w.x, c.z - w.z) < 30 && (c.body.swim || c.y < L.yTop - 1));
    const pet = petF?.active && petF.state && Math.hypot(petF.state.x - w.x, petF.state.z - w.z) < 30 && (petF.state.body.swim || petF.state.y < L.yTop - 1) ? petF.state : null;
    const spots = deckSpots(L, crew.length + (pet ? 1 : 0), fr);
    crew.forEach((c, i) => { [c.x, c.z] = spots[i]; c.speed = 0; c.stuck = 0; placeBody0(c.body, c.x, c.z, L.yTop); c.y = c.body.y; c.yaw = L.climbYaw; });
    if (pet) { [pet.x, pet.z] = spots[crew.length]; pet.speed = 0; pet.stuck = 0; placeBody0(pet.body, pet.x, pet.z, L.yTop); pet.y = pet.body.y; pet.yaw = L.climbYaw; }
  }
  const placeBody0 = (b, x, z, y) => placeBody(b, world, x, z, y);
  function climb(L) {
    const w = W(); if (!L || !L.climbable || w.ride || !w.active) return false;
    const x0 = w.x, y0 = w.y, z0 = w.z, T = rideTime(L.yTop - y0); let t = 0; const p = {};
    w.jumpQ = false; w.speed = 0; st.ride = { L, t: 0, T };
    w.ride = (dt) => { t += Math.min(dt, 0.1); st.ride.t = t; const k = Math.min(1, t / T); climbPath(L, x0, y0, z0, k, p);
      w.x = p.x; w.y = p.y; w.z = p.z; w.yaw = L.climbYaw; w.ridePose = k < 1 ? 'ladder' : null; pirate.object.userData.swimK = k;
      { let c = L.climbYaw - w.camYaw; c = Math.atan2(Math.sin(c), Math.cos(c)); if (!w.drags?.size) w.camYaw += c * Math.min(1, dt * 2.5); }   // the camera swings round behind you
      if (k >= 1) { w.ride = null; w.ridePose = null; w.x = L.landX; w.z = L.landZ; w.y = L.yTop; finish(L); return 'done'; }
      return 'active'; };
    try { sfx?.step?.(); } catch {}
    return true;
  }
  function tick(dt) {
    const w = W(); if (!w.active) return; st.cool = Math.max(0, st.cool - dt);
    const B = w.body, air = !!B.air; if (st.prevAir && !air) st.cool = Math.max(st.cool, LADDER.entryCool); st.prevAir = air;   // dropped in from above
    if (w.ride || ADM.frozen || ADM.noclip) return;
    const n = near(); if (!n) return;
    const m = moveDir(w), dot = m ? m[0] * -n.L.outX + m[1] * -n.L.outZ : 0;
    const why = climbWanted({ d: n.d, dot, jump: !!w.jumpQ, cool: st.cool, inWater: true });
    if (why) climb(n.L);
  }
  return { list, tick, climb, near, get climbing() { return !!st.ride; }, get state() { return st; } };
}
