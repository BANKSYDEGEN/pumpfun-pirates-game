// [Emerly v106] CREW FOLLOWERS ashore (BANKSY): 3 of your crew (2 on Low quality) step off the ship with you and follow you round
// the island. Local only (nobody else sees them, no network). Each keeps their own body / skin / hair and wears YOUR hat + clothes
// (the same crew rule as the deck crew: no hooks / pegs / parrots, those stay on the captain).
//  - they walk YOUR path: a breadcrumb trail of where you actually walked (always walkable), each a little further back, so they
//    go round walls, trees and rocks the way you did instead of cutting through them; small side offsets only where free
//  - walk / run blend matches their speed (they sprint to catch up), hop when you jump (staggered), wade / swim where you do
//  - idle: they stop a short way off, face you, glance around now and then
//  - lost (> 40 m behind, e.g. after a long run or a fast jump): they quietly regroup behind you
//  - cheap: one v4 Low pirate each (2 draw calls + their gear), hidden beyond 70 m, no per-frame allocation
import { loadPirate } from './pirate.js';
import { JUMP } from './walker.js';
import { PHYS, newBody, placeBody, jumpBody, stepBody, wadeFactor, poseBody, waterFX, bodyFX } from './physics.js'; // [Raul] they fall, wade + swim like you
import { applyGear, getLocalGear, getLocalColors, normalizeGear } from '../pirateGear.js';
import { crewGearOf } from '../crewV4.js';
import { crewGear } from '../crewLoadout.js';

const LOOKS = [{ skin: 2, hair: 1 }, { skin: 4, hair: 2, female: true }, { skin: 0, hair: 4 }];
const BACK = [2.4, 4.0, 5.6], SIDE = [-1.1, 1.1, 0], STEP = 0.8, TRAIL_N = 64;
export function createFollowers({ scene, world, walker, low }) {
  const n = low ? 2 : 3, crew = [];
  const trail = []; let trailLen = 0; // [x, z] newest first, ~STEP m apart
  // [v109b] the crew wears YOUR resolved clothes colours: your picked clothes colour (outfitColor) or your ship skin's when it's 0 / SHIP,
  // + your hat colour. Always read from pirateGear (getLocalGear + getLocalColors), never from the event detail (the BR profile's copy
  // has no free colours), and re-dress when the gear, the colour or the ship skin changes.
  const NAKED = { hat: 'none', outfit: 'shirtless', eyes: 'plain', parrot: 'none', hook: 'none' };
  // [Timothy] the crew's OWN loadout (Crew Shop, js/crewLoadout.js), not your hat + clothes
  const want = () => { const g = crewGearOf(crewGear()) || NAKED, c = getLocalColors(); return { g, c, k: JSON.stringify([g, c]) }; };
  let cur = want(), gear = cur.g, chkT = 0;
  for (let i = 0; i < n; i++) {
    // [v128] BANKSY "THE GIRLS too": the Low body (flat unlit skin chunks, jagged hair) right next to you on desktop; Low only on Low quality
    // [v130] BANKSY "no crew walking with me": v128 put that note at the end of this line and commented out applyGear / scene.add
    const p = loadPirate({ look: LOOKS[i], low, outline: false }); applyGear(p.object, gear, cur.c); p.object.visible = false; scene.add(p.object);
    crew.push({ p, body: newBody(), x: 0, z: 0, y: 0, yaw: 0, speed: 0, jt: 0, idleT: 0, look: 0, stuck: 0 });
  }
  // [v112] BANKSY "why are my crew members shirtless": a dress that failed once (gear library / item load error, or a dress started
  // before the pirate GLB arrived and lost) was never retried, because the wanted gear key hadn't changed. Now every check also looks
  // at what each follower ACTUALLY wears and re-dresses the ones that are off (failed = gearKey null, or holding other gear).
  const gk = (g) => JSON.stringify(g && [g.hat, g.outfit, g.hatColor | 0, g.outfitColor | 0]);
  function redress(force = false) { const w = want(), changed = w.k !== cur.k; cur = w; gear = w.g;
    for (const c of crew) { const r = c.p.object, v = r.userData?.v4 || null; let fig = v; if (!fig) r.traverse((o) => { if (!fig && o.userData?.v4) fig = o.userData.v4; });
      const off = gk(r.userData?.gear) !== gk(normalizeGear(w.g)) || (fig && !fig.gearKey && w.g !== NAKED);
      if (changed || force || off) { if (fig && off) fig.gearKey = null; applyGear(r, w.g, w.c); } } }
  addEventListener('pfp-gear', () => setTimeout(redress, 0)); addEventListener('pfp-crew', () => setTimeout(redress, 0)); // [Timothy] a Crew Shop equip // after pirateGear has merged it (its own 'pfp-gear' listener)
  let active = false, lastJumps = 0;
  function enter() {
    redress(true); // [v112] going ashore always re-dresses the crew in your current gear
    const W = walker.w; trail.length = 0; trailLen = 0; lastJumps = W.jumps;
    const bx = -Math.sin(W.yaw), bz = -Math.cos(W.yaw);
    crew.forEach((c, i) => { // start just behind you (on the gangway / quay), on free ground
      let x = W.x + bx * (1.2 + i * 0.9), z = W.z + bz * (1.2 + i * 0.9); if (world.blocked(x, z, W.x, W.z)) { x = W.x; z = W.z; }
      Object.assign(c, { x, z, yaw: W.yaw, speed: 0, jt: 0, idleT: 0, stuck: 0 }); placeBody(c.body, world, x, z); c.y = c.body.y; c.p.object.visible = true; place(c); });
    active = true;
  }
  function exit() { active = false; for (const c of crew) c.p.object.visible = false; }
  function place(c) { c.pose = poseBody(c.p.object, c.body, c.x, c.z, c.yaw, c.speed, performance.now() / 1000 + c.yaw); }
  // point on your trail `d` metres behind you
  const _pt = [0, 0];
  function trailAt(d) { const W = walker.w; let px = W.x, pz = W.z, acc = 0;
    for (const q of trail) { const s = Math.hypot(q[0] - px, q[1] - pz); if (acc + s >= d) { const f = (d - acc) / Math.max(1e-3, s); _pt[0] = px + (q[0] - px) * f; _pt[1] = pz + (q[1] - pz) * f; return _pt; } acc += s; px = q[0]; pz = q[1]; }
    _pt[0] = px; _pt[1] = pz; return _pt; }
  function move(c, dx, dz) { // slide along walls like the walker, ≤0.3 m sub-steps
    const k = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3)); let got = 0;
    for (let i = 0; i < k; i++) { const sx = dx / k, sz = dz / k;
      if (!world.blocked(c.x + sx, c.z + sz, c.x, c.z)) { c.x += sx; c.z += sz; got++; }
      else if (!world.blocked(c.x + sx, c.z, c.x, c.z)) { c.x += sx; got += 0.5; }
      else if (!world.blocked(c.x, c.z + sz, c.x, c.z)) { c.z += sz; got += 0.5; } }
    return got / k; }
  const fx = waterFX(scene, low);
  function update(dt, camera) {
    if (!active) return;
    if ((chkT -= dt) <= 0) { chkT = 0.5; redress(); } // ship skin / colour changes (cheap string compare, re-dress only on a change)
    const W = walker.w, now = performance.now();
    // breadcrumbs
    const h = trail[0]; if (!h || Math.hypot(W.x - h[0], W.z - h[1]) >= STEP) { trail.unshift([W.x, W.z]); if (trail.length > TRAIL_N) trail.pop(); }
    if (W.jumps !== lastJumps) { lastJumps = W.jumps; crew.forEach((c, i) => setTimeout(() => { if (active) jumpBody(c.body, JUMP.h); }, 120 + i * 140)); }
    crew.forEach((c, i) => {
      const pt = trailAt(BACK[i]); let tx = pt[0], tz = pt[1];
      { const bx = -Math.sin(W.yaw), bz = -Math.cos(W.yaw), sx = -bz * SIDE[i], sz = bx * SIDE[i]; if (SIDE[i] && !world.blocked(tx + sx, tz + sz, tx, tz)) { tx += sx; tz += sz; } }
      const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz), dp = Math.hypot(W.x - c.x, W.z - c.z);
      if (dp > 40) { const q = trailAt(BACK[i] + 1); c.x = q[0]; c.z = q[1]; placeBody(c.body, world, c.x, c.z); c.y = c.body.y; c.speed = 0; return place(c); } // lost: regroup
      let want = d > 5 ? 9.6 : d > 0.9 ? Math.min(4.2, 1.2 + d * 1.6) : 0; if (c.body.swim) want = Math.min(want, d > 5 ? PHYS.swim[1] * 1.1 : PHYS.swim[0]); else want *= wadeFactor(c.body);
      c.speed += (want - c.speed) * Math.min(1, dt * 6);
      if (c.speed > 0.15 && d > 0.05) {
        const got = move(c, dx / d * c.speed * dt, dz / d * c.speed * dt);
        c.stuck = got < 0.3 ? c.stuck + dt : 0; if (c.stuck > 1.5) { const q = trailAt(BACK[i]); c.x = q[0]; c.z = q[1]; c.stuck = 0; }
        let dy = Math.atan2(dx, dz) - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, dt * 10); c.idleT = 0;
      } else { // idle: face you, glance around every few seconds
        c.idleT += dt; if (c.idleT > 3 + i) { c.idleT = 0; c.look = (Math.random() - 0.5) * 1.6; }
        const face = Math.atan2(W.x - c.x, W.z - c.z) + (c.idleT < 1.4 ? c.look : 0); let dy = face - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, dt * 3);
      }
      stepBody(c.body, world, c.x, c.z, dt, c.speed); c.y = c.body.y; bodyFX(fx, c.body, c.x, c.z, c.speed, dt); fx?.update();
      const far = camera ? camera.position.distanceToSquared(c.p.object.position) > 4900 : false; c.p.object.visible = !far;
      place(c); if (!far) c.p.update(dt, c.speed, c.pose);
    });
  }
  return { enter, exit, update, get list() { return crew; }, get active() { return active; } };
}
