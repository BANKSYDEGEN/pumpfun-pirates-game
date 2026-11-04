// [Raul items redo 2] the on-foot FOLLOW PATHING, shared by the crew followers (js/onfoot/followers.js, Emerly v106 + Timothy's
// collisions) and the ground pets (js/onfoot/pets.js): the same breadcrumb trail of where you actually walked (always walkable),
// the same wall-sliding / prop-deflecting mover, the same arena keep-out (wait at the gate), stuck recovery and "lost: regroup behind
// you" teleport. PURE (no three.js): tests/pets.test.mjs runs it against a fake world.
export function makeTrail(step = 0.8, n = 64) {
  const trail = [], _pt = [0, 0];
  return {
    trail,
    push(x, z) { const h = trail[0]; if (!h || Math.hypot(x - h[0], z - h[1]) >= step) { trail.unshift([x, z]); if (trail.length > n) trail.pop(); } },
    clear() { trail.length = 0; },
    // point on the trail `d` metres behind (ox, oz) = you
    at(d, ox, oz) { let px = ox, pz = oz, acc = 0;
      for (const q of trail) { const s = Math.hypot(q[0] - px, q[1] - pz); if (acc + s >= d) { const f = (d - acc) / Math.max(1e-3, s); _pt[0] = px + (q[0] - px) * f; _pt[1] = pz + (q[1] - pz) * f; return _pt; } acc += s; px = q[0]; pz = q[1]; }
      _pt[0] = px; _pt[1] = pz; return _pt; },
    // the crumb just ahead of the one nearest (x, z): walk round a prop corner the way you did
    ahead(x, z) { let m = 0, md = 1e9; for (let q = 0; q < trail.length; q++) { const e = (trail[q][0] - x) ** 2 + (trail[q][1] - z) ** 2; if (e < md) { md = e; m = q; } } return trail[Math.max(0, m - 1)]; },
  };
}
// slide along walls like the walker, <= 0.3 m sub-steps; deflect = angles tried round a post / barrel (null = off)
export function makeMover(blocked, deflect) {
  return function move(c, dx, dz) {
    const k = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3)); let got = 0;
    for (let i = 0; i < k; i++) { const sx = dx / k, sz = dz / k;
      if (!blocked(c.x + sx, c.z + sz, c.x, c.z)) { c.x += sx; c.z += sz; got++; }
      else if (!blocked(c.x + sx, c.z, c.x, c.z)) { c.x += sx; got += 0.5; }
      else if (!blocked(c.x, c.z + sz, c.x, c.z)) { c.z += sz; got += 0.5; }
      else if (deflect) for (const r of deflect) { const cs = Math.cos(r), sn = Math.sin(r), rx = sx * cs - sz * sn, rz = sx * sn + sz * cs;
        if (!blocked(c.x + rx, c.z + rz, c.x, c.z)) { c.x += rx; c.z += rz; got += 0.25; break; } } }
    return got / k; };
}
// one follower step. c = { x, z, yaw, speed, stuck, idleT, look }, o = you { x, z, yaw }. env: { trail, move, free(x, z, fx, fz) (side
// offsets: world.blocked), ko(x, z, i) (arena keep-out -> waiting spot | null), back, side, i, lost, sp: { far, run, near, walk, base, k },
// cap(c, want) (swim / wade / climb), place(c) (after a snap / teleport) }. Returns 'tp' when it regrouped (teleported), else ''.
export const CREW_SPEED = { far: 5, run: 9.6, near: 0.9, walk: 4.2, base: 1.2, k: 1.6 };
export function followStep(c, o, dt, env) {
  const { trail, move, ko = () => null, back, side = 0, i = 0, lost = 40, sp = CREW_SPEED, cap = (c, w) => w, place = () => {}, free = () => true, deflect = true } = env;
  const pt = trail.at(back, o.x, o.z); let tx = pt[0], tz = pt[1];
  { const bx = -Math.sin(o.yaw), bz = -Math.cos(o.yaw), sx = -bz * side, sz = bx * side; if (side && free(tx + sx, tz + sz, tx, tz)) { tx += sx; tz += sz; } }
  if (deflect && c.stuck > 0.3 && trail.trail.length > 1) { const q = trail.ahead(c.x, c.z); tx = q[0]; tz = q[1]; }
  const wait = ko(tx, tz, i) || (ko(o.x, o.z, i) ? ko(o.x, o.z, i) : null); if (wait) { tx = wait[0]; tz = wait[1]; }
  { const inside = ko(c.x, c.z, i); if (inside) { c.x = inside[0]; c.z = inside[1]; c.speed = 0; place(c); } }
  const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz), dp = Math.hypot(o.x - c.x, o.z - c.z);
  if (dp > lost && !wait) { const q0 = trail.at(back + 1, o.x, o.z), q = ko(q0[0], q0[1], i) || q0; c.x = q[0]; c.z = q[1]; c.speed = 0; c.stuck = 0; place(c); return 'tp'; }
  const want = cap(c, d > sp.far ? sp.run : d > sp.near ? Math.min(sp.walk, sp.base + d * sp.k) : 0);
  c.speed += (want - c.speed) * Math.min(1, dt * 6);
  if (c.speed > 0.15 && d > 0.05) {
    const got = move(c, dx / d * c.speed * dt, dz / d * c.speed * dt);
    c.stuck = got < 0.3 ? c.stuck + dt : 0;
    if (c.stuck > 1.5) { const q = wait || trail.at(back, o.x, o.z), w2 = ko(q[0], q[1], i) || q; c.x = w2[0]; c.z = w2[1]; c.stuck = 0; }
    let dy = Math.atan2(dx, dz) - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, dt * 10); c.idleT = 0;
  } else {   // idle: face you, glance around every few seconds
    c.idleT += dt; if (c.idleT > 3 + i) { c.idleT = 0; c.look = (Math.random() - 0.5) * 1.6; }
    const face = Math.atan2(o.x - c.x, o.z - c.z) + (c.idleT < 1.4 ? c.look : 0); let dy = face - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, dt * 3);
  }
  return '';
}
