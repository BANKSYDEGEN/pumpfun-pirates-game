// [Raul items redo 2] GROUND PETS on foot (BANKSY 10:36 AM 2026-11-04: "have the cat and monkey follow you around like crew does";
// 10:53 AM: + chimp, black gorilla, white gorilla). Your pet (cat, black cat, monkey, chimp, gorilla, white gorilla: the parrot slot)
// steps off the ship with you and follows you round the island on the crew's own pathing (js/onfoot/followPath.js: your breadcrumb
// trail, wall sliding, arena keep-out, stuck recovery, lost = regroup behind you), a little closer than the crew, on your left.
// Gait + personality = js/petMotion.js (walk / run, the cat sits + grooms, the monkey hops, apes knuckle-walk, gorillas beat their chest).
// Other players' pets: the same follower behind their pirate (js/onfoot/net.js), from the gear they already send ('gr'): no new message.
// The pirate's bound copy (standing by his left foot: ship deck, shop) is hidden while the follower is out.
// Cheap: one mesh + ink shell per pet, one uniform write per frame, hidden beyond 70 m, no per-frame allocation.
import { petMesh, petLayerTick } from '../pirateItems.js';
import { PET_RIG } from '../petRig.js';
import { GROUND_PETS, PET_FOLLOW } from '../petMotion.js';
import { makeTrail, makeMover, followStep } from './followPath.js';
import { newBody, placeBody, stepBody, wadeFactor } from './physics.js';
const DEFLECT = [0.6, -0.6, 1.2, -1.2];
// [Raul items redo 2] the free copy is drawn at the PIRATE'S scale (pirateFigure scales the v5 body ~1.25x to 1.75 m; the bound copy rides
// that scale, the free copy did not: on foot every pet read ~20 % small next to you, the monkey under the knee). BANKSY 11:39 AM.
export const figScale = (fig) => { const r = fig?.root; if (!r?.getWorldScale) return 1.25; r.updateWorldMatrix?.(true, false); const v = r.getWorldScale(new r.scale.constructor()); return v.x > 0.05 ? v.x : 1.25; };
export function figOf(obj) { let f = obj?.userData?.v4 || null; if (!f) obj?.traverse?.((o) => { if (!f && o.userData?.v4) f = o.userData.v4; }); return f; }
export function createPetFollower({ scene, world, low = false, keepOut = null, lost = PET_FOLLOW.lost }) {
  let id = 'none', female = false, mesh = null, ticket = 0, active = false, fig = null;
  const c = { x: 0, z: 0, y: 0, yaw: 0, speed: 0, stuck: 0, idleT: 0, look: 0, body: newBody() };
  const TR = makeTrail(0.6, 48);
  const ko = (x, z, i) => { try { return keepOut ? keepOut(x, z, i) : null; } catch { return null; } };
  const blocked = (x, z, fx, fz) => world.blocked(x, z, fx, fz) || (!!keepOut && !ko(fx, fz, 0) && !!ko(x, z, 0));
  const env = { trail: TR, move: makeMover(blocked, DEFLECT), ko, free: (x, z, fx, fz) => !world.blocked(x, z, fx, fz), i: 3, lost, deflect: true,
    place: (q) => { placeBody(q.body, world, q.x, q.z); q.y = q.body.y; }, cap: (q, w) => (q.body.swim ? Math.min(w, 3.2) : w * wadeFactor(q.body)), back: 1.3, side: PET_FOLLOW.side, sp: null };
  function setPet(nid, fem) {
    if (nid === id && fem === female) return; id = nid; female = fem; const t = ++ticket;
    if (mesh) { mesh.removeFromParent(); mesh = null; }
    const R = PET_RIG[id]; if (!GROUND_PETS[id] || !R) return;
    const k = R.kind; env.back = (PET_FOLLOW.back[k] || 1.3) * 1.15; const sc = R.h * 1.25 / 0.3;   // follow distances at the pet's drawn size
    env.sp = { far: 7, run: PET_FOLLOW.run, near: PET_FOLLOW.near + 0.15 * sc, walk: PET_FOLLOW.run, base: 1.6, k: 2.4 };   // a smooth catch-up (no walk cap): a steady ~1.5-3 m behind you at a walk or a run
    petMesh(id, female, low).then((m) => { if (t !== ticket || !m) return; mesh = m; m.visible = active; scene.add(m); place(); }).catch((e) => console.warn('[pets]', e));
  }
  function bound(show) { const s = fig?.items?.shoulder?.obj; if (s && GROUND_PETS[id]) s.visible = show; }
  function enter(o) {
    const bx = -Math.sin(o.yaw), bz = -Math.cos(o.yaw); TR.clear(); c.x = o.x + bx * 0.9 + bz * 0.5; c.z = o.z + bz * 0.9 - bx * 0.5;   // just behind you, on your left
    if (world.blocked(c.x, c.z, o.x, o.z)) { c.x = o.x; c.z = o.z; }
    Object.assign(c, { yaw: o.yaw, speed: 0, stuck: 0, idleT: 0 }); placeBody(c.body, world, c.x, c.z); c.y = c.body.y; active = true; if (mesh) mesh.visible = true; place();
  }
  function exit() { active = false; if (mesh) mesh.visible = false; bound(true); }
  function place() { if (!mesh) return; const s = c.body.swim && world.water ? world.water(c.x, c.z) : null, R = PET_RIG[id], k = figScale(fig);
    mesh.scale.setScalar(k); mesh.position.set(c.x, s != null ? s - 0.32 * (R?.h || 0.3) * k : c.y, c.z); mesh.rotation.y = c.yaw; }   // swimming: head + back above the water
  // o = the pirate you follow { x, z, yaw }; pirateObj = their loadPirate object (finds the bound copy); petId = their parrot-slot id
  function update(dt, o, { camera = null, pirateObj = null, petId = 'none' } = {}) {
    fig = figOf(pirateObj) || fig; setPet(petId, !!fig?.female);
    if (!GROUND_PETS[id]) { if (mesh) { mesh.removeFromParent(); mesh = null; } return; }
    if (!active) enter(o);
    TR.push(o.x, o.z);
    if (followStep(c, o, dt, env) !== 'tp') { stepBody(c.body, world, c.x, c.z, dt, c.speed); c.y = c.body.y; }
    bound(!mesh);   // the bound copy stays until the follower has loaded
    if (!mesh) return;
    const far = camera ? camera.position.distanceToSquared(mesh.position) > 4900 : false; mesh.visible = !far; place();
    if (!far) petLayerTick(mesh.userData.layer, dt, c.speed);
  }
  function dispose() { ticket++; if (mesh) mesh.removeFromParent(); mesh = null; bound(true); active = false; }
  return { enter, exit, update, dispose, get state() { return c; }, get mesh() { return mesh; }, get id() { return id; }, get active() { return active; } };
}
