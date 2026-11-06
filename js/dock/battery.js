// [Timothy] PUMPFUN PIRATES headland battery, game side: walk up to a gun -> FIRE CANNON prompt (E / tap, the same action button as
// every other on-foot interact point). The gun follows your camera (drag to look: yaw within +-AIM.yaw of its embrasure, camera
// pitch = elevation), fires with the game's own cannon boom, muzzle flash + smoke (js/fx.js), recoils, and lobs a ball out to sea
// that splashes (fx.splash + ocean foam + splash sfx). [v171] BANKSY "make it so the cannons on cliff can damage ai and player ships":
// YOUR shots are live: each step asks hitShip(p, gun) (pvp.batteryStep: the same hit -> damage -> sink / kill-credit path as a ship
// cannon, basic BALL_DMG with no upgrades / boosts, never your own ship or a squadmate, SAFE HARBOR ships still immune). Peers' replayed
// shots stay visual; their hits arrive as normal 'hit' messages tagged with the gun (validated against shotRecent below).
// [v171] BANKSY "more range so can reach the battle area": muzzle speed 62 -> 104 m/s, elevation up to 0.45 rad (reach from the 21 m gun deck ~220 m -> ~640 m: the AI / pirate battle water sits ~500-620 m out).
// [lh-hit] BANKSY "lower cannon ball arch so can hit the lighthouse" + hit effect: flatter/faster ball, depression aim, cylinder hits on
// Mole + Sandbar lighthouses with lantern overload (&lhhit=0 = old AIM/BALL + no lighthouse hits). Works with both origin/main and
// timothy/cannon-hill gun objects (reads g.yaw/pitch/rest + B.muzzle/pose dynamically; does NOT touch js/island/battery.js).
// Pirates on foot (SWORD PIT / MUSKET RANGE) are never targets: balls only test ships, and stop on the ground. Reload AIM.reload s per gun.
// Peers: each shot rides in your harbor room state as 'bc' = [seq, gun, yaw*100, pitch*100] (the transport only sends changed
// fields; older clients ignore it), and theirs replay here. No new service, no extra messages.
import * as THREE from 'three';
import { waveHeight } from '../ocean.js';
import { AIM as AIM0 } from '../island/battery.js';
import { isNetId } from '../safe.js';
import { triggerLighthouseHit } from '../lighthouseKit.js';

const LH_HIT = !(typeof location !== 'undefined' && /[?&]lhhit=0(?:&|$)/.test(location.search || ''));
// Local aim / ball overrides (leave island/battery.js AIM alone so Timothy's cannon-hill branch stays clean).
const AIM = LH_HIT
  ? { yaw: 0.85, pitch: [-0.30, 0.36], rest: -0.02, reload: AIM0.reload ?? 5 }
  : { ...AIM0 };
const BALL = LH_HIT ? { speed: 122, g: 9.8, life: 18 } : { speed: 104, g: 14, life: 18 };
const STEP = 0.012; // s: sub-step so 122 m/s balls can't tunnel a ~4 m tower
const LH_R = 4.2;   // harbor-frame hit cylinder radius (tower + lantern room)

// [v171] who fired which gun when (local + replayed peers): a tagged battery hit is only accepted from a pirate whose shot from that gun we saw
const SHOTS = new Map(); export const BATTERY_GUNS = [];
export const shotRecent = (id, gun, ms = 9000) => { const r = SHOTS.get(id); return !!r && r.gun === gun && performance.now() - r.t < ms; };
export const BATTERY_RANGE = 700;   // m from the gun: hit validation cap (max ballistic reach from the cliff + margin)

// pooled shard / spark bits for lighthouse impacts (zero leaked geo/mat)
const _shardGeo = new THREE.TetrahedronGeometry(0.18, 0);
const _shardMat = new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
const _sparkMat = new THREE.MeshBasicMaterial({ color: 0xff4411, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
const _bits = [];

export function createBattery({ scene, world, layout, fx, ocean, sfx, camera, hitShip = null, hitFoot = null, myId = () => null, toast = () => {} }) { // [v347] hitFoot(p, by, impact): a peer's cliff ball kills YOU on foot
  const B = world.foot?.battery; if (!B) return null;
  const root = world.footGroup; root.updateMatrixWorld(true);
  const toW = (v) => v.applyMatrix4(root.matrixWorld);                         // foot world -> harbor (scene) world
  const pts = B.guns.map(g => { const [x, z] = layout.footToHarbor(g.sx, g.sz); const q = { id: 'gun' + g.i, kind: 'cannon', gun: g.i, x, z, r: 2.3, label: 'FIRE CANNON' }; layout.interact.push(q); BATTERY_GUNS[g.i] = { x, z }; return q; });
  const ballGeo = new THREE.SphereGeometry(0.34, 10, 8), ballMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1e });
  const balls = [], seen = new Map(); let seq = 0, mine = null, t = 0, manned = -1;
  const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _w = new THREE.Vector3(), _prev = new THREE.Vector3();
  const vol = (p) => Math.max(0.05, Math.min(1, 1 - p.distanceTo(camera.position) / 180));

  const _lh = new THREE.Vector3();
  function lhCyls() {
    const list = world.foot?.lighthouses || [];
    const out = [];
    for (const g of list) {
      if (!g?.parent) continue;
      g.updateWorldMatrix(true, false);
      g.getWorldPosition(_lh);
      const top = (g.userData.top || 26);
      out.push({ root: g, x: _lh.x, z: _lh.z, baseY: _lh.y - 0.5, topY: _lh.y + top + 4, r: LH_R });
    }
    return out;
  }
  function hitLhSeg(a, b) {
    if (!LH_HIT) return null;
    for (const L of lhCyls()) {
      // closest point on segment a->b to cylinder axis (x,z), then y in [base,top]
      const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz || 1e-6;
      let u = ((L.x - a.x) * dx + (L.z - a.z) * dz) / len2; u = Math.max(0, Math.min(1, u));
      const hx = a.x + dx * u, hz = a.z + dz * u, hy = a.y + (b.y - a.y) * u;
      if (Math.hypot(hx - L.x, hz - L.z) <= L.r && hy >= L.baseY && hy <= L.topY) return { L, x: hx, y: hy, z: hz };
    }
    return null;
  }
  function spawnLhFx(hit) {
    const p = new THREE.Vector3(hit.x, hit.y, hit.z);
    fx?.hit?.(p.clone());
    fx?.ring?.(p.clone(), 1.2, 7, 1.6);
    for (let k = 0; k < 5; k++) fx?.smoke?.(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2.5, (Math.random() - 0.5) * 2)), true);
    // lantern-top plume
    const top = new THREE.Vector3(hit.L.x, hit.L.topY - 2, hit.L.z);
    fx?.ring?.(top.clone(), 0.8, 5, 2.2);
    fx?.hit?.(top.clone());
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(_shardGeo, i % 3 ? _sparkMat : _shardMat);
      m.position.copy(i < 8 ? p : top);
      const v = new THREE.Vector3((Math.random() - 0.5) * 9, 4 + Math.random() * 8, (Math.random() - 0.5) * 9);
      scene.add(m); _bits.push({ m, v, life: 0.7 + Math.random() * 0.6 });
    }
    sfx?.cannon?.(Math.min(1, vol(p) * 1.35));
    sfx?.impact?.({ dmg: 40, maxHp: 40, kill: false, onPlayer: false, v: vol(p) });
    sfx?.coin?.();
    sfx?.spawnBell?.();
    triggerLighthouseHit(hit.L.root);
    try { toast('💥 LIGHTHOUSE STRUCK!', 2200); } catch {}
  }
  function tickBits(dt) {
    for (let i = _bits.length - 1; i >= 0; i--) {
      const b = _bits[i]; b.life -= dt; b.v.y -= 18 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += dt * 6; b.m.rotation.z += dt * 4;
      if (b.m.material) b.m.material.opacity = Math.max(0, b.life * 1.2);
      if (b.life <= 0) { b.m.removeFromParent(); _bits.splice(i, 1); }
    }
  }

  function shoot(i, yaw, pitch, local, by = null) {
    const g = B.guns[i]; if (!g) return false;
    if (local && g.cool > 0) return false;
    if (yaw !== undefined) { g.yaw = g.ty = yaw; g.pitch = g.tp = pitch; }
    g.cool = AIM.reload; g.recoil = 1; B.pose(g);
    B.muzzle(g, _p, _d); toW(_p); _w.set(_d.x, 0, _d.z).normalize();          // no rotation in the frame: directions carry over
    fx?.muzzle(_p.clone(), _w.clone()); for (let k = 0; k < 3; k++) fx?.smoke(_p.clone().addScaledVector(_w, -0.5 - k * 0.6), false);
    sfx?.cannon?.(vol(_p));
    const m = new THREE.Mesh(ballGeo, ballMat); m.position.copy(_p); m.name = 'battery_ball'; scene.add(m);
    // full 3D muzzle direction (includes pitch) for the flatter arc
    balls.push({ m, v: _d.clone().multiplyScalar(BALL.speed), life: BALL.life, live: !!local, gun: i, by: local ? null : by });
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
        // [lh-hit] x0.85 so look-down reaches pitch[0] (-0.30) and look-up reaches pitch[1]
        g.tp = Math.max(AIM.pitch[0], Math.min(AIM.pitch[1], AIM.rest + (0.28 - walker.w.pitch) * (LH_HIT ? 0.85 : 0.6))); }
      else if (g.cool <= 0) { g.ty = g.rest; g.tp = AIM.rest; }
      pts[g.i].label = g.cool > 0 ? `RELOADING · ${Math.ceil(g.cool)}` : 'FIRE CANNON';
    }
    B.update(dt);
    tickBits(dt);
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i], p = b.m.position;
      let left = dt, done = false;
      while (left > 0 && !done) {
        const step = Math.min(STEP, left); left -= step;
        _prev.copy(p);
        b.v.y -= BALL.g * step; p.addScaledVector(b.v, step); b.life -= step; fx?.trail(p);
        if (b.life <= 0) { done = true; break; }
        const lh = hitLhSeg(_prev, p);
        if (lh) { spawnLhFx(lh); done = true; break; }
        if (b.live && hitShip) { try { if (hitShip(p, b.gun)) { done = true; break; } } catch (e) { console.warn('[battery] hit', e); } }
        if (!b.live && hitFoot) { try { if (hitFoot(p, b.by, false)) { fx?.hit(p.clone()); done = true; break; } } catch (e) { console.warn('[battery] foot', e); } } // [v347] t1823u
        if (p.y < waveHeight(p.x, p.z, t)) { fx?.splash(p.clone()); ocean?.addSplash?.(p.x, p.z, 2.8, t); sfx?.splash?.(vol(p) * 0.8); done = true; break; }
        if (p.y < world.ground(p.x, p.z) - 0.2) { fx?.hit(p.clone()); for (let k = 0; k < 2; k++) fx?.smoke(p.clone(), false); if (!b.live) try { hitFoot?.(p, b.by, true); } catch {} done = true; break; } // [v347] lands on the coast: dust + splash kill
      }
      if (done) { b.m.removeFromParent(); balls.splice(i, 1); }
    }
  }
  const netState = () => (mine ? { bc: mine } : {});
  function onPeer(m) { // a harbor mate's shot: replay it (first sighting only records their counter, so joining never replays an old one)
    if (!m || !isNetId(m.i) || !Array.isArray(m.bc) || m.bc.length !== 4 || !m.bc.every(Number.isFinite)) return;
    const [s, i, y, p] = m.bc, last = seen.get(m.i); seen.set(m.i, s); if (last === undefined || last === s || !B.guns[i | 0]) return;
    const g = B.guns[i | 0]; shoot(i | 0, g.rest + Math.max(-AIM.yaw, Math.min(AIM.yaw, Math.atan2(Math.sin(y / 100 - g.rest), Math.cos(y / 100 - g.rest)))), Math.max(AIM.pitch[0], Math.min(AIM.pitch[1], p / 100)), false, m.i);
  }
  function clear() { for (const b of balls) b.m.removeFromParent(); balls.length = 0; for (const b of _bits) b.m.removeFromParent(); _bits.length = 0; }
  return { guns: B.guns, points: pts, fire, tick, netState, onPeer, clear, get manned() { return manned; }, get balls() { return balls.length; }, get lastBall() { return balls[balls.length - 1]?.m.position || null; }, AIM, BALL, LH_HIT };
}
