// [bed-desk] BANKSY t405u "Make it so if they are in hull of ship they can lay in bed or sit at desk" + t406u "Do same with cabin".
// Shared rest controller for the two walk-in interiors (js/dock/shipHull.js Captain's Quarters + js/dock/houses.js cottage cabins):
//  - E · LIE IN BED   at the bunk : the pirate snaps onto the mattress, laid flat on the back (head on the pillow, along the bed)
//  - E · SIT AT DESK  at the desk : the pirate snaps onto the nearest chair facing the desk, thighs level, hands on the desk top
//  - E again (the GET UP prompt), walking (WASD / stick), JUMP, controller B, leaving the room or taking a hit = stand up beside it
// While posed walker.w.rest = 'lie' | 'sit': js/onfoot/walker.js skips movement / jumping / falling and js/onfoot/swimPose.js poses
// the bones; this module writes the body transform AFTER the room tick (so the room's own standing transform never wins) and
// hands the room camera a framed focus point. Weapons are holstered + attacks off via js/onfoot/battle.js `posed`.
// Multiplayer: both interiors are private pockets (every other pirate is hidden inside and you are hidden from them), so the pose
// is local only: nothing new on the wire.
// ?beddesk=0 = off (no prompts, nothing changes).
export const BED_DESK_ON = !(typeof location !== 'undefined' && /[?&]beddesk=0(?:&|$)/.test(location.search || ''));
export const REST_LIE = 'lie', REST_SIT = 'sit';
export const REST_LABEL = Object.freeze({ bed: 'LIE IN BED', desk: 'SIT AT DESK', getup: 'GET UP', wardrobe: 'CHANGE CLOTHES' }); // [t408u] + the wardrobe
export const REST_GRACE_S = 0.35; // ignore the movement keys / stick for this long after settling in (the walk up to the bed)
const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const HALF_PI = Math.PI / 2;

// ---- the rest spots (room-local metres, y above the room origin; yaw = the way the body faces: for 'lie' = from the head to the feet) ----
/** Captain's Quarters (js/dock/shipHull.js, QFLOOR deck): berth_kit boxed bunk on the starboard hull + chart_table_kit with its two chairs. */
export function hullRestSpots() {
  return {
    bed: {
      kind: 'bed', label: REST_LABEL.bed, x: 3.05, z: 2.65, r: 1.75,
      bounds: { x0: 3.91, x1: 5.24, z0: 1.4, z1: 3.9, top: 0.9 },            // the mattress (linen) inside the berth frame
      pose: { x: 4.55, y: 1.05, z: 2.85, yaw: 0 },                          // feet anchor: head on the aft (-Z) pillows, feet forward
      stand: { x: 3.05, z: 2.65, yaw: -HALF_PI },
      cam: { yaw: HALF_PI + 0.55, pitch: 0.42, dist: 2.7 },
    },
    desk: {
      kind: 'desk', label: REST_LABEL.desk, x: 2.75, z: -1.9, r: 2.0,
      desk: { x0: 2.08, x1: 3.42, z0: -2.87, z1: -0.53, top: 0.94 },
      seats: [
        { x: 1.77, y: 0.26, z: -1.55, yaw: HALF_PI, seat: 0.72, stand: { x: 1.05, z: -1.55, yaw: -HALF_PI } },   // port chair, facing the table (+X)
        { x: 3.73, y: 0.26, z: -1.95, yaw: -HALF_PI, seat: 0.72, stand: { x: 4.45, z: -1.95, yaw: HALF_PI } },  // starboard chair, facing -X
        { x: 2.75, y: 0.26, z: -3.3, yaw: 0, seat: 0.72, stand: { x: 1.85, z: -3.35, yaw: -HALF_PI } },          // captain's armchair at the head of the table (+Z)
      ],
      cam: { pitch: 0.36, dist: 2.9, side: 0.75 },
    },
    // [t408u] clothes sea chest under the aft starboard porthole (shipHull.js builds it: qs_wardrobe); opens the WARDROBE changing room
    wardrobe: { kind: 'wardrobe', label: REST_LABEL.wardrobe, x: 4.0, z: -3.65, r: 1.4, prop: { x: 5.0, z: -3.65, w: 0.62, d: 1.15, ry: -HALF_PI } },
  };
}
/** Cottage cabin (js/dock/houses.js buildInteriorRoom, floor top 0.14): SW alcove bunk (pillows at -X) + East chart / dining table + 2 chairs. */
export function cabinRestSpots(W, D) {
  const bx = -W / 2 + 1.85, bz = D / 2 - 1.55, tx = W / 2 - 2.2, tz = 0.2;
  return {
    bed: {
      kind: 'bed', label: REST_LABEL.bed, x: bx + 0.3, z: bz - 1.2, r: 1.7,
      bounds: { x0: bx - 1.175, x1: bx + 1.175, z0: bz - 0.625, z1: bz + 0.625, top: 0.92 },
      pose: { x: bx + 0.3, y: 1.1, z: bz, yaw: HALF_PI },                   // feet anchor: head on the -X pillows, feet toward +X
      stand: { x: bx + 0.3, z: bz - 1.25, yaw: Math.PI },
      cam: { yaw: 0.62, pitch: 0.45, dist: 2.7 },
    },
    desk: {
      kind: 'desk', label: REST_LABEL.desk, x: tx - 0.15, z: tz, r: 1.95,
      desk: { x0: tx - 1.075, x1: tx + 1.075, z0: tz - 0.65, z1: tz + 0.65, top: 0.99 },
      seats: [
        { x: tx - 0.15, y: 0.16, z: tz + 1.12, yaw: Math.PI, seat: 0.59, stand: { x: tx - 0.15, z: tz + 1.8, yaw: 0 } },   // south chair, facing -Z
        { x: tx - 0.15, y: 0.16, z: tz - 1.12, yaw: 0, seat: 0.59, stand: { x: tx - 0.15, z: tz - 1.8, yaw: Math.PI } },  // north chair, facing +Z
      ],
      cam: { pitch: 0.36, dist: 2.9, side: 0.75 },
    },
    // [t408u] oak armoire in the SE corner against the east wall, doors facing into the room (houses.js builds it: hs_wardrobe)
    wardrobe: { kind: 'wardrobe', label: REST_LABEL.wardrobe, x: W / 2 - 1.5, z: D / 2 - 1.35, r: 1.15, prop: { x: W / 2 - 0.6, z: D / 2 - 1.35, w: 0.6, d: 1.2, ry: -HALF_PI } },
  };
}

/** Nearest rest spot in reach of a room-local point, or null. */
export function restPrompt(spots, lx, lz) {
  if (!BED_DESK_ON || !spots) return null;
  let best = null, bd = 1e9;
  for (const tag of ['bed', 'desk', 'wardrobe']) {
    const sp = spots[tag]; if (!sp) continue;
    const d = Math.hypot(lx - sp.x, lz - sp.z);
    if (d < sp.r && d < bd) { bd = d; best = { tag, label: sp.label, key: 'E', primary: true, dist: d }; }
  }
  return best;
}
/** The chair of a desk spot nearest the room-local point. */
export function pickSeat(spot, lx, lz) {
  let best = spot?.seats?.[0] || null, bd = 1e9;
  for (const s of spot?.seats || []) { const d = Math.hypot(lx - s.x, lz - s.z); if (d < bd) { bd = d; best = s; } }
  return best;
}
/** Where the body origin (feet) goes, room-local: { x, y, z, yaw, tilt } (tilt = -PI/2 lays the body flat on its back). */
export function restTransform(kind, spot, seat = null) {
  if (kind === REST_LIE) { const p = spot.pose; return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, tilt: -HALF_PI }; }
  const s = seat || spot.seats[0]; return { x: s.x, y: s.y, z: s.z, yaw: s.yaw, tilt: 0 };
}
/** Where the head ends up for a lying pose (room-local, chibi V4/V6 body: ~1.1 m from the feet to the crown along the bed). */
export function lieHead(spot, len = 1.1) { const p = spot.pose; return { x: p.x - Math.sin(p.yaw) * len, z: p.z - Math.cos(p.yaw) * len }; }

/**
 * One rest controller per room. walker = js/onfoot/walker.js, pirate = loadPirate() object holder.
 * getOrigin() = the room's world origin {x,y,z} (null = not inside).
 */
export function createRest({ walker, pirate, getOrigin = () => null, onChange = () => {}, now = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : 0) }) {
  let st = null; // { kind, spot, seat, t0, tf }
  const W = () => walker?.w;
  function begin(tag, spot, lx = 0, lz = 0) {
    const w = W(), o = getOrigin(); if (!BED_DESK_ON || !w || !o || !spot || st) return false;
    const kind = tag === 'bed' ? REST_LIE : REST_SIT, seat = kind === REST_SIT ? pickSeat(spot, lx, lz) : null;
    const tf = restTransform(kind, spot, seat);
    st = { kind, spot, seat, tf, t0: now() };
    // the walker anchor stays on the floor under the body (rooms clamp / pin w.y to the floor); the body itself is placed by apply()
    w.x = o.x + tf.x; w.z = o.z + tf.z; w.yaw = tf.yaw; w.speed = 0; w.vy = 0; w.air = false; w.jumpQ = false;
    for (const k of MOVE) if (w.keys) w.keys[k] = false;
    if (w.joy) { w.joy.x = w.joy.y = 0; }
    w.rest = kind;
    const c = spot.cam || {};
    if (kind === REST_LIE) { w.camYaw = c.yaw ?? tf.yaw + HALF_PI; }
    else { w.camYaw = tf.yaw + (c.side ?? 0.6); }
    w.pitch = c.pitch ?? 0.4; w.look = typeof performance !== 'undefined' ? performance.now() : 0;
    try { if (pirate?.object?.userData) pirate.object.userData.emote = null; } catch {}
    apply();
    onChange(kind);
    return true;
  }
  function end(reason = 'getup') {
    if (!st) return false;
    const w = W(), o = getOrigin(), s = st; st = null;
    if (w) {
      w.rest = null; w.jumpQ = false; w.speed = 0;
      const sp = s.kind === REST_LIE ? s.spot.stand : (s.seat?.stand || s.spot.stand);
      if (o && sp && reason !== 'leave') { w.x = o.x + sp.x; w.z = o.z + sp.z; w.yaw = sp.yaw ?? w.yaw; }
      try { const p = pirate?.object; if (p) { p.rotation.order = 'YXZ'; p.rotation.set(0, w.yaw, 0); p.position.set(w.x, w.y, w.z); p.scale.set(1, 1, 1); } } catch {}
    }
    onChange(null, reason);
    return true;
  }
  /** Per frame (before the room prompt): walking / the stick / JUMP = get up. Returns true when it stood you up. */
  function update() {
    if (!st) return false;
    const w = W(); if (!w || !getOrigin()) { end('leave'); return true; }
    if (!w.active) { end('leave'); return true; }
    if (now() - st.t0 < REST_GRACE_S) { w.jumpQ = false; return false; }
    const moving = MOVE.some((k) => w.keys?.[k]) || (w.joy?.on && Math.hypot(w.joy.x || 0, w.joy.y || 0) > 0.35);
    if (w.jumpQ || moving) { w.jumpQ = false; end('move'); return true; }
    return false;
  }
  /** After the room tick: the body transform (the room just wrote its standing one). */
  function apply() {
    if (!st) return;
    const o = getOrigin(), p = pirate?.object; if (!o || !p) return;
    const { x, y, z, yaw, tilt } = st.tf;
    p.visible = true; p.rotation.order = 'YXZ'; p.rotation.set(tilt, yaw, 0); p.position.set(o.x + x, o.y + y, o.z + z); p.scale.set(1, 1, 1);
    p.userData.air = false;
  }
  /** Camera focus for the room boom: { x, y, z, up, look, dMin, dMax } in world space, or null when standing. */
  function focus() {
    if (!st) return null;
    const o = getOrigin(); if (!o) return null;
    if (st.kind === REST_LIE) {
      const h = lieHead(st.spot), p = st.spot.pose, cx = (p.x + h.x) / 2, cz = (p.z + h.z) / 2;
      return { x: o.x + cx, y: o.y + st.spot.bounds.top, z: o.z + cz, up: 0.45, look: 0.1, dMin: 2.2, dMax: 3.2 };
    }
    const s = st.tf;
    return { x: o.x + s.x + Math.sin(s.yaw) * 0.25, y: o.y + 0.14, z: o.z + s.z + Math.cos(s.yaw) * 0.25, up: 1.05, look: 0.78, dMin: 2.4, dMax: 3.3 };
  }
  const prompt = () => (st ? { label: REST_LABEL.getup, key: 'E', primary: true, tag: 'getup' } : null);
  return {
    get posed() { return !!st; }, get kind() { return st?.kind || null; }, get state() { return st; },
    begin, end, update, apply, focus, prompt,
  };
}
