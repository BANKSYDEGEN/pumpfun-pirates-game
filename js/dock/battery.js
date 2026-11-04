// [Timothy] PUMPFUN PIRATES headland battery, game side: walk up to a gun -> FIRE CANNON prompt (E / tap, the same action button as
// every other on-foot interact point). The gun follows your camera (drag to look: yaw within +-AIM.yaw of its embrasure, camera
// pitch = elevation), fires with the game's own cannon boom, muzzle flash + smoke (js/fx.js), recoils, and lobs a ball out to sea
// that splashes (fx.splash + ocean foam + splash sfx). [v171] BANKSY "make it so the cannons on cliff can damage ai and player ships":
// YOUR shots are live: each step asks hitShip(p, gun) (pvp.batteryStep: the same hit -> damage -> sink / kill-credit path as a ship
// cannon, basic BALL_DMG with no upgrades / boosts, never your own ship or a squadmate, SAFE HARBOR ships still immune). Peers' replayed
// shots stay visual; their hits arrive as normal 'hit' messages tagged with the gun (validated against shotRecent below).
// [v171] BANKSY "more range so can reach the battle area": muzzle speed 62 -> 104 m/s, elevation up to 0.45 rad (reach from the 21 m gun deck ~220 m -> ~640 m: the AI / pirate battle water sits ~500-620 m out).
// Pirates on foot (SWORD PIT / MUSKET RANGE) are never targets: balls only test ships, and stop on the ground. Reload AIM.reload s per gun.
// Peers: each shot rides in your harbor room state as 'bc' = [seq, gun, yaw*100, pitch*100] (the transport only sends changed
// fields; older clients ignore it), and theirs replay here. No new service, no extra messages.
import * as THREE from 'three';
import { waveHeight } from '../ocean.js';
import { AIM } from '../island/battery.js';
import { isNetId } from '../safe.js';

const BALL = { speed: 104, g: 14, life: 18 };
// [v171] who fired which gun when (local + replayed peers): a tagged battery hit is only accepted from a pirate whose shot from that gun we saw
const SHOTS = new Map(); export const BATTERY_GUNS = [];
export const shotRecent = (id, gun, ms = 9000) => { const r = SHOTS.get(id); return !!r && r.gun === gun && performance.now() - r.t < ms; };
export const BATTERY_RANGE = 700;   // m from the gun: hit validation cap (max ballistic reach from the cliff + margin)
export function createBattery({ scene, world, layout, fx, ocean, sfx, camera, hitShip = null, myId = () => null }) {
  const B = world.foot?.battery; if (!B) return null;
  const root = world.footGroup; root.updateMatrixWorld(true);
  const toW = (v) => v.applyMatrix4(root.matrixWorld);                         // foot world -> harbor (scene) world
  const pts = B.guns.map(g => { const [x, z] = layout.footToHarbor(g.sx, g.sz); const q = { id: 'gun' + g.i, kind: 'cannon', gun: g.i, x, z, r: 2.3, label: 'FIRE CANNON' }; layout.interact.push(q); BATTERY_GUNS[g.i] = { x, z }; return q; });
  const ballGeo = new THREE.SphereGeometry(0.34, 10, 8), ballMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1e });
  const balls = [], seen = new Map(); let seq = 0, mine = null, t = 0, manned = -1;
  const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _w = new THREE.Vector3();
  const vol = (p) => Math.max(0.05, Math.min(1, 1 - p.distanceTo(camera.position) / 180));
  function shoot(i, yaw, pitch, local, by = null) {
    const g = B.guns[i]; if (!g) return false;
    if (local && g.cool > 0) return false;
    if (yaw !== undefined) { g.yaw = g.ty = yaw; g.pitch = g.tp = pitch; }
    g.cool = AIM.reload; g.recoil = 1; B.pose(g);
    B.muzzle(g, _p, _d); toW(_p); _w.set(_d.x, 0, _d.z).normalize();          // no rotation in the frame: directions carry over
    fx?.muzzle(_p.clone(), _w.clone()); for (let k = 0; k < 3; k++) fx?.smoke(_p.clone().addScaledVector(_w, -0.5 - k * 0.6), false);
    sfx?.cannon?.(vol(_p));
    const m = new THREE.Mesh(ballGeo, ballMat); m.position.copy(_p); m.name = 'battery_ball'; scene.add(m);
    balls.push({ m, v: _d.clone().multiplyScalar(BALL.speed), life: BALL.life, live: !!local, gun: i });
    const who = local ? myId() : by; if (who) SHOTS.set(who, { gun: i, t: performance.now() });
    if (local) { seq = (seq + 1) % 1000; mine = [seq, i, Math.round(g.yaw * 100), Math.round(g.pitch * 100)]; }
    return true;
  }
  function fire(q) { return shoot(q.gun, undefined, undefined, true); }
  // per frame (on foot or not): aim the gun you stand at, ease the rest home, fly the balls, prompt text
  function tick(dt, walker, onFoot) {
    t += dt; manned = -1;
    if (onFoot && walker) { const W = walker.w; let bd = 1e9; for (const q of pts) { const d = Math.hypot(q.x - W.x, q.z - W.z); if (d < q.r && d < bd) { bd = d; manned = q.gun; } } }
    for (const g of B.guns) {
      if (g.i === manned) { let dy = walker.w.camYaw - g.rest; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.ty = g.rest + Math.max(-AIM.yaw, Math.min(AIM.yaw, dy));
        g.tp = Math.max(AIM.pitch[0], Math.min(AIM.pitch[1], AIM.rest + (0.28 - walker.w.pitch) * 0.6)) /* [v171] x0.6: full look-up reaches the new 0.45 rad */; }
      else if (g.cool <= 0) { g.ty = g.rest; g.tp = AIM.rest; }
      pts[g.i].label = g.cool > 0 ? `RELOADING · ${Math.ceil(g.cool)}` : 'FIRE CANNON';
    }
    B.update(dt);
    for (let i = balls.length - 1; i >= 0; i--) { const b = balls[i], p = b.m.position; b.v.y -= BALL.g * dt; p.addScaledVector(b.v, dt); b.life -= dt; fx?.trail(p);
      let done = b.life <= 0;
      if (!done && b.live && hitShip) { try { done = !!hitShip(p, b.gun); } catch (e) { console.warn('[battery] hit', e); } }   // [v171] a ship: hit FX + damage via pvp
      if (!done && p.y < waveHeight(p.x, p.z, t)) { fx?.splash(p.clone()); ocean?.addSplash?.(p.x, p.z, 2.8, t); sfx?.splash?.(vol(p) * 0.8); done = true; }
      else if (!done && p.y < world.ground(p.x, p.z) - 0.2) { fx?.hit(p.clone()); done = true; }        // a low shot into the hill / rocks: a puff, nothing else
      if (done) { b.m.removeFromParent(); balls.splice(i, 1); } }
  }
  const netState = () => (mine ? { bc: mine } : {});
  function onPeer(m) { // a harbor mate's shot: replay it (first sighting only records their counter, so joining never replays an old one)
    if (!m || !isNetId(m.i) || !Array.isArray(m.bc) || m.bc.length !== 4 || !m.bc.every(Number.isFinite)) return;
    const [s, i, y, p] = m.bc, last = seen.get(m.i); seen.set(m.i, s); if (last === undefined || last === s || !B.guns[i | 0]) return;
    const g = B.guns[i | 0]; shoot(i | 0, g.rest + Math.max(-AIM.yaw, Math.min(AIM.yaw, Math.atan2(Math.sin(y / 100 - g.rest), Math.cos(y / 100 - g.rest)))), Math.max(AIM.pitch[0], Math.min(AIM.pitch[1], p / 100)), false, m.i);
  }
  function clear() { for (const b of balls) b.m.removeFromParent(); balls.length = 0; }
  return { guns: B.guns, points: pts, fire, tick, netState, onPeer, clear, get manned() { return manned; }, get balls() { return balls.length; }, get lastBall() { return balls[balls.length - 1]?.m.position || null; } };
}
