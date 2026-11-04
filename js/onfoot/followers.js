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
import { PHYS, newBody, placeBody, jumpBody, stepBody, wadeFactor, poseBody, waterFX, bodyFX, climbing } from './physics.js'; // [Raul] they fall, wade + swim like you
import { applyGear, getLocalGear, getLocalColors, normalizeGear } from '../pirateGear.js';
import { crewGearOf } from '../crewV4.js';
import { crewGear } from '../crewLoadout.js';
import { makeTrail, makeMover, followStep } from './followPath.js'; // [Raul items redo 2] the pathing below, shared with the ground pets (js/onfoot/pets.js)

const LOOKS = [{ skin: 2, hair: 1 }, { skin: 4, hair: 2, female: true }, { skin: 0, hair: 4 }];
const BACK = [2.4, 4.0, 5.6], SIDE = [-1.1, 1.1, 0], STEP = 0.8, TRAIL_N = 64;
const DEFLECT = typeof location !== 'undefined' && /[?&]deflect=0/.test(location.search) ? null : [0.6, -0.6, 1.2, -1.2];   // [Timothy collisions] ?deflect=0 = old
// [Emerly] keepOut(x, z, i) -> null | [x, z]: places the crew must not walk into (the SWORD PIT / MUSKET RANGE, js/onfoot/battle.js);
// a target inside one becomes that place's waiting spot for follower i (outside the gate), and they never step across its edge.
export function createFollowers({ scene, world, walker, low, keepOut = null }) {
  const n = low ? 2 : 3, crew = [];
  const TR = makeTrail(STEP, TRAIL_N), trail = TR.trail; // [x, z] newest first, ~STEP m apart
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
    const W = walker.w; TR.clear(); lastJumps = W.jumps;
    const bx = -Math.sin(W.yaw), bz = -Math.cos(W.yaw);
    crew.forEach((c, i) => { // start just behind you (on the gangway / quay), on free ground
      let x = W.x + bx * (1.2 + i * 0.9), z = W.z + bz * (1.2 + i * 0.9); if (world.blocked(x, z, W.x, W.z)) { x = W.x; z = W.z; }
      Object.assign(c, { x, z, yaw: W.yaw, speed: 0, jt: 0, idleT: 0, stuck: 0 }); placeBody(c.body, world, x, z, W.y); c.y = c.body.y; c.p.object.visible = true; place(c); }); // [path-fix2] W.y: land on a high bridge with you
    active = true;
  }
  function exit() { active = false; for (const c of crew) c.p.object.visible = false; }
  function place(c) { c.pose = poseBody(c.p.object, c.body, c.x, c.z, c.yaw, c.speed, performance.now() / 1000 + c.yaw); }
  const trailAt = (d) => TR.at(d, walker.w.x, walker.w.z);
  const ko = (x, z, i) => { try { return keepOut ? keepOut(x, z, i) : null; } catch { return null; } };
  const blocked = (x, z, fx, fz) => world.blocked(x, z, fx, fz) || (!!keepOut && !ko(fx, fz, 0) && !!ko(x, z, 0)); // [Emerly] never step into an arena
  const mv0 = makeMover(blocked, DEFLECT), move = (c, dx, dz) => { world.layer?.(c.y); const g = mv0(c, dx, dz); world.layer?.(null); return g; }; // [path-fix2] high bridges: this follower's height; slide along walls like the walker, ≤0.3 m sub-steps; [Timothy collisions] walk round a post / barrel / lamp
  const free = (x, z, fx, fz) => !world.blocked(x, z, fx, fz);
  const snap = (c) => { placeBody(c.body, world, c.x, c.z, walker.w.y); c.y = c.body.y; }; // [path-fix2] regroup onto a high bridge when you're on it
  const cap = (c, want) => { if (c.body.swim) want = Math.min(want, want > 4.2 ? PHYS.swim[1] * 1.1 : PHYS.swim[0]); else want *= wadeFactor(c.body); if (climbing(c.body)) want = Math.min(want, PHYS.climbV); return want; }; // [Raul swim-anim] pull-up
  const env = { trail: TR, move, ko, free, cap, place: snap, deflect: !!DEFLECT, back: 0, side: 0, i: 0 };
  const fx = waterFX(scene, low);
  function update(dt, camera) {
    if (!active) return;
    if ((chkT -= dt) <= 0) { chkT = 0.5; redress(); } // ship skin / colour changes (cheap string compare, re-dress only on a change)
    const W = walker.w, now = performance.now();
    // breadcrumbs
    TR.push(W.x, W.z);
    if (W.jumps !== lastJumps) { lastJumps = W.jumps; crew.forEach((c, i) => setTimeout(() => { if (active) jumpBody(c.body, JUMP.h); }, 120 + i * 140)); }
    crew.forEach((c, i) => {
      env.back = BACK[i]; env.side = SIDE[i]; env.i = i;
      if (followStep(c, W, dt, env) === 'tp') return place(c); // lost (> 40 m behind): regroup on your trail
      stepBody(c.body, world, c.x, c.z, dt, c.speed); c.y = c.body.y; bodyFX(fx, c.body, c.x, c.z, c.speed, dt); fx?.update();
      const far = camera ? camera.position.distanceToSquared(c.p.object.position) > 4900 : false; c.p.object.visible = !far;
      place(c); if (!far) c.p.update(dt, c.speed, c.pose);
    });
  }
  return { enter, exit, update, get list() { return crew; }, get active() { return active; } };
}
