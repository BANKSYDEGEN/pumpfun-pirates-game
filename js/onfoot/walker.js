// [Emerly] PUMPFUN PIRATES on-foot controller: third-person pirate on the harbor world (layout walk API).
// PC: WASD / arrows move (camera-relative), Shift runs, drag the mouse to look (same left-drag as the ship camera), wheel zooms.
// Phone / tablet: virtual joystick (left thumb: push far = run), drag anywhere else to look, pinch zooms. Interact = E / the
// action button (js/onfoot/interact.js). Keys are swallowed while on foot so the ship never steers or fires underneath.
import * as THREE from 'three';
import { held, isKey } from '../keybinds.js'; // [v102] sprint = the rebindable 'sprint' key (default hold Shift)
import { PHYS, newBody, placeBody, jumpBody, stepBody, wadeFactor, poseBody, waterFX, bodyFX, climbing, SWIM_SURGE } from './physics.js'; // [Raul] falls + swimming

export const WALK = { walk: 4.2, run: 9.6, fovPush: 6, radius: 0.45, camD: [3.2, 7, 14], pitch: [-0.35, 1.1] };
// [v106] JUMP (BANKSY): Space (rebindable 'jump') / the phone JUMP button. Snappy ~1.1 m arc (high gravity, ~0.55 s in the air),
// keeps your run speed, squash on take-off + landing, no jump while swimming (ground under water) or mid-air.
export const JUMP = { h: 1.1, g: 32, swimY: -0.7 };
export const jumpArc = (t) => { const v = Math.sqrt(2 * JUMP.g * JUMP.h), y = v * t - JUMP.g * t * t / 2; return y > 0 ? y : 0; }; // height t s after take-off (peers)
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);

export function createWalker({ camera, canvas, world, pirate, touch, low = false }) {
  let fx = null;
  const w = { body: newBody(), x: 0, z: 0, y: 0, yaw: 0, speed: 0, camYaw: 0, pitch: 0.28, dist: WALK.camD[1], keys: {}, joy: { x: 0, y: 0, on: false }, active: false, drags: new Map(), look: 0, jh: 0, vy: 0, air: false, jumps: 0, landT: -9, jumpQ: false, falls: 0, swim: false, wade: 0, pose: null };
  const cam = new THREE.Vector3(), tgt = new THREE.Vector3();
  // [v102] sprint camera push: a few degrees of extra FOV while running, eased in / out. main.js owns camera.fov (resize), so we only
  // ever add / remove our own offset (fovSet = the value we last wrote; a different value means main.js just resized).
  let fovAdd = 0, fovSet = 0;
  function fovPush(dt, k) { if (!fovSet || camera.fov !== fovSet) { fovSet = 0; } const base = fovSet ? camera.fov - fovAdd : camera.fov;
    const next = fovAdd + (k * WALK.fovPush - fovAdd) * Math.min(1, dt * 5); if (Math.abs(next - fovAdd) < 1e-3 && fovSet) return;
    fovAdd = Math.abs(next) < 0.01 ? 0 : next; camera.fov = base + fovAdd; fovSet = camera.fov; camera.updateProjectionMatrix(); }
  function fovReset() { if (fovSet && camera.fov === fovSet && fovAdd) { camera.fov -= fovAdd; camera.updateProjectionMatrix(); } fovAdd = 0; fovSet = 0; }
  // ---- keyboard (capture phase: runs before the ship's handler; we swallow movement / fire / sail keys) ----
  const onKey = (e, down) => {
    if (!w.active || e.target?.tagName === 'INPUT') return false;
    if (isKey('jump', e.code)) { if (down && !e.repeat) w.jumpQ = true; w.keys[e.code] = down; e.preventDefault?.(); return true; }
    if (MOVE_KEYS.has(e.code) || isKey('sprint', e.code) || ['KeyQ', 'Space', 'KeyC'].includes(e.code)) { w.keys[e.code] = down; e.preventDefault?.(); return true; }
    return false;
  };
  // ---- pointer look (canvas) + pinch ----
  canvas.addEventListener('pointerdown', (e) => { if (!w.active) return; w.drags.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
  addEventListener('pointermove', (e) => { if (!w.active) return; const d = w.drags.get(e.pointerId); if (!d) return;
    if (w.drags.size >= 2) { const [a, b] = [...w.drags.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); d.x = e.clientX; d.y = e.clientY; const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      w.dist = Math.min(WALK.camD[2], Math.max(WALK.camD[0], w.dist * (d0 / Math.max(1, d1)))); return; }
    const k = (touch ? 0.0075 : 0.0055) * (w.lookK ?? 1); w.camYaw -= (e.clientX - d.x) * k; w.pitch = Math.min(WALK.pitch[1], Math.max(WALK.pitch[0], w.pitch + (e.clientY - d.y) * k * 0.8)); // [v351] lookK from tps ADS / scope
    d.x = e.clientX; d.y = e.clientY; w.look = performance.now(); });
  const up = (e) => w.drags.delete(e.pointerId); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { if (!w.active) return; w.dist = Math.min(WALK.camD[2], Math.max(WALK.camD[0], w.dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: true });
  addEventListener('blur', () => { for (const k in w.keys) w.keys[k] = false; });

  function enter(x, z, yaw) { Object.assign(w, { x, z, yaw, camYaw: yaw, speed: 0, active: true, pitch: 0.28, jh: 0, vy: 0, air: false, jumpQ: false }); placeBody(w.body, world, x, z); w.y = w.body.y; for (const k in w.keys) w.keys[k] = false; w.drags.clear(); pirate.object.visible = true; pirate.object.rotation.order = 'YXZ'; pirate.object.rotation.set(0, yaw, 0); place(); snapCam(); }
  function exit() { fovReset(); w.active = false; pirate.object.visible = false; w.drags.clear(); w.joy.on = false; w.joy.x = w.joy.y = 0; }
  function place() { w.pose = poseBody(pirate.object, w.body, w.x, w.z, w.yaw, w.speed, performance.now() / 1000);
    // squash + stretch: crouch into the take-off, stretch in the air, squash on landing (scale only: the v4 clips keep running)
    const tl = performance.now() / 1000 - w.landT, sq = tl < 0.18 ? 1 - 0.14 * Math.sin(tl / 0.18 * Math.PI) : 1, st = w.air ? 1 + 0.06 * Math.min(1, Math.abs(w.vy) / 6) : 1;
    pirate.object.scale.set(2 - sq * st, sq * st, 2 - sq * st); }
  function jump() { if (w.body.swim && SWIM_SURGE.on) w.surge = SWIM_SURGE.t; if (!jumpBody(w.body, JUMP.h)) return false; w.jumps++; w.landT = -9; return true; } // no jump mid-air / mid pull-up; in deep water = the surface kick (PHYS.hop)
  function camPos(out) { const cp = Math.cos(w.pitch); out.set(w.x - Math.sin(w.camYaw) * w.dist * cp, w.y + 1.7 + Math.sin(w.pitch) * w.dist, w.z - Math.cos(w.camYaw) * w.dist * cp);
    // [bridge-path-fix] (ported from post/island-rework-2) walls / cliff faces / slot walls (the walk ground jumps > 1.2 m between two samples)
    // between your head and the camera pull it in in front of them instead of popping it up over the top (the rope-bridge slots); smooth slopes still lift it
    world.layer?.(w.y); { const hx = w.x, hy = w.y + 1.5, hz = w.z, N = 10; let pg = world.ground(hx, hz), cut = 1;
      for (let i = 1; i <= N; i++) { const t = i / N, x = hx + (out.x - hx) * t, z = hz + (out.z - hz) * t, g = world.ground(x, z);
        if (g - pg > 1.2 && g + 0.3 > hy + (out.y - hy) * t) { cut = Math.max(0.1, t - 1 / N - 0.3 / w.dist); break; } pg = g; }
      if (cut < 1) out.set(hx + (out.x - hx) * cut, hy + (out.y - hy) * cut, hz + (out.z - hz) * cut); }
    const gy = world.ground(out.x, out.z), ws = world.water ? world.water(out.x, out.z) : null, lo = Math.max(gy, ws === null ? -1e9 : ws + 0.3); if (out.y < lo + 0.8) out.y = lo + 0.8; world.camClamp?.(out, w.x, w.y + 1.5, w.z); /* [clothes-aaa] walk-in shop rooms keep the camera inside */ world.layer?.(null); return out; }
  function snapCam() { camera.position.copy(camPos(cam)); tgt.set(w.x, w.y + 1.5, w.z); camera.lookAt(tgt); }
  const DEFLECT = typeof location !== 'undefined' && /[?&]deflect=0/.test(location.search) ? null : [0.6, -0.6, 1.2, -1.2];   // ?deflect=0 = the old axis-only slide
  function step(dx, dz) { // move with sliding + a few sub-steps so a fast run never tunnels through a wall
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3)); let moved = 0; world.layer?.(w.y); // [path-fix2] high bridges: you are at w.y // [v103] ≤0.3 m sub-steps (< the 0.45 m body radius) at the faster sprint
    for (let i = 0; i < n; i++) { const sx = dx / n, sz = dz / n;
      if (!world.blocked(w.x + sx, w.z + sz, w.x, w.z)) { w.x += sx; w.z += sz; moved++; }
      else if (Math.abs(sx) > 1e-4 && !world.blocked(w.x + sx, w.z, w.x, w.z)) { w.x += sx; moved += 0.5; }
      else if (Math.abs(sz) > 1e-4 && !world.blocked(w.x, w.z + sz, w.x, w.z)) { w.z += sz; moved += 0.5; }
      else if (DEFLECT) for (const r of DEFLECT) { const c = Math.cos(r), s = Math.sin(r), rx = sx * c - sz * s, rz = sx * s + sz * c; // [Timothy collisions] head-on into a post / round prop, or a V-notch
        if (!world.blocked(w.x + rx, w.z + rz, w.x, w.z)) { w.x += rx; w.z += rz; moved += 0.25; break; } } }        // between two props: slide round it instead of sticking
    world.layer?.(null); return moved / n;
  }
  function update(dt) {
    if (!w.active) return;
    if (w.rest) { // [bed-desk] lying in a bunk / seated at a desk (js/dock/bedDesk.js owns the body + reads the keys / stick / jump to get up): no walking, jumping or falling
      const B = w.body; w.speed = 0; w.vy = 0; w.air = false; B.y = w.y; B.vy = 0; B.air = false; B.swim = false; B.hop = false; B.climb = 0;
      pirate.object.userData.air = false; w.pose = w.rest; pirate.update(dt, 0, w.rest); fovPush(dt, 0);
      if (w.camHook) w.camHook(dt); return; }
    if (w.ride) { const r = w.ride(dt), B = w.body; // [Emerly zipline-v2] owns x/y/z while riding; 'drop' falls into air physics below
      if (r === 'done') { placeBody(B, world, w.x, w.z, w.y); w.y = B.y; w.air = false; w.vy = 0; w.speed = 0; place(); pirate.update(dt, 0, w.pose); fovPush(dt, 0);
        if (w.faceYaw != null) w.yaw = w.faceYaw; // [zipline-shoot] keep aim facing through dismount
        if (w.camHook) { w.camHook(dt); return; } // [zipline-shoot] ADS camera survives the landing frame
        camPos(cam); camera.position.lerp(cam, Math.min(1, dt * 6)); tgt.set(w.x, w.y + 1.5, w.z); camera.lookAt(tgt); return; }
      if (r !== 'drop') { B.y = w.y; B.vy = 0; B.air = false; B.swim = false; B.hop = false; B.climb = 0; w.air = false; w.vy = 0; w.speed = 0; place(); if (w.ridePose) w.pose = w.ridePose; pirate.update(dt, 0, w.pose); /* [dock-ladders] w.ridePose = 'ladder' while climbing (js/onfoot/swimPose.js) */ fovPush(dt, 0);
        if (w.faceYaw != null) w.yaw = w.faceYaw; // [zipline-shoot] face the crosshair while sliding
        if (w.camHook) { w.camHook(dt); return; } // [zipline-shoot] musket ADS / over-the-shoulder while on the cable
        camPos(cam); camera.position.lerp(cam, Math.min(1, dt * 6)); tgt.set(w.x, w.y + 1.5, w.z); camera.lookAt(tgt); return; }
      /* r === 'drop': keep going into normal air / fall with zipVx */ }
    if (w.adminHook && w.adminHook(dt, { place, camPos, cam, tgt, pirate, camera, fovPush })) return; // [admin-menu] js/adminMenu.js: NOCLIP fly / server FREEZE own this frame
    const K = w.keys; let f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), s = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
    let mag = Math.min(1, Math.hypot(f, s)), run = held('sprint', K);
    if (w.joy.on && Math.hypot(w.joy.x, w.joy.y) > 0.12) { f = -w.joy.y; s = w.joy.x; mag = Math.min(1, Math.hypot(f, s)); run = mag > 0.88; }
    { const B0 = w.body, on = SWIM_SURGE.on && B0.swim; if (on && held('jump', K)) w.surge = Math.max(w.surge || 0, 0.3); w.surge = Math.max(0, (w.surge || 0) - dt);   // [Emerly] swim surge (held jump on keys keeps it)
      const tk = on && w.surge > 0 ? SWIM_SURGE.kOf(run && !w.moveK) : 1; /* [v348] exact old jump-swim speeds */ w.sk = (w.sk || 1) + (tk - (w.sk || 1)) * Math.min(1, dt * (tk > (w.sk || 1) ? 5 : 2.5)); SWIM_SURGE.live = B0.swim ? w.sk : 1; }
    if (w.moveK) run = false; // [Timothy tps] aiming down the sights (js/onfoot/tps.js): no sprint
    let want = 0;
    if (mag > 0.01) {
      const n = Math.hypot(f, s), fx = Math.sin(w.camYaw), fz = Math.cos(w.camYaw), dx = (fx * f - fz * s) / n, dz = (fz * f + fx * s) / n;
      want = (w.body.swim ? PHYS.swim[run ? 1 : 0] : (run ? WALK.run : WALK.walk) * wadeFactor(w.body)) * (w.joy.on ? Math.max(0.35, mag) : 1) * (w.body.swim ? (w.sk || 1) * (globalThis.__pfpPillySwim || 1) : 1); /* [Pilly] companion level = swim speed */ // [Raul] swim / wade slower [Emerly] x the swim surge
      if (w.moveK) want *= w.moveK; // [Timothy tps] ADS: half speed
      if (w.carryK) want *= w.carryK; // [v349 money-makers] hauling a smuggler crate: 80% speed
      if (climbing(w.body)) want = Math.min(want, PHYS.climbV); // [Raul swim-anim] shuffle forward during the 0.6 s pull-up out of the water
      const yawT = Math.atan2(dx, dz); let dy = yawT - w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); w.yaw += dy * Math.min(1, dt * 12);
      w.speed += (want - w.speed) * Math.min(1, dt * 10);
      const got = step(dx * w.speed * dt, dz * w.speed * dt); if (got < 0.3) w.speed *= 0.5;
      // the camera drifts behind you while you walk (not while you are dragging / just dragged it)
      if (!w.drags.size && performance.now() - w.look > 1200) { let c = w.yaw - w.camYaw; c = Math.atan2(Math.sin(c), Math.cos(c)); w.camYaw += c * Math.min(1, dt * 1.4 * mag); }
    } else w.speed += (0 - w.speed) * Math.min(1, dt * 12);
    if (w.faceYaw !== undefined && w.faceYaw !== null) w.yaw = w.faceYaw; // [Timothy tps] aiming / just fired: face the crosshair
    // [Raul] vertical: exact ground on slopes (no smoothing lag), eased steps, gravity off ledges + jumps, swim at the surface
    if (w.jumpQ) { w.jumpQ = false; jump(); }
    if (w.zipVx != null) { // [Emerly zipline-v2] leftover horizontal after a mid-ride drop
      step(w.zipVx * dt, w.zipVz * dt); w.zipVx *= Math.exp(-dt * 0.5); w.zipVz *= Math.exp(-dt * 0.5);
      if (!w.body.air || Math.hypot(w.zipVx, w.zipVz) < 0.5) w.zipVx = w.zipVz = null; }
    const B = w.body; stepBody(B, world, w.x, w.z, dt, w.speed); w.y = B.y; w.air = B.air; w.vy = B.vy; w.swim = B.swim; w.wade = B.wade; w.jh = 0;
    if (B.ev === 'land' || B.ev === 'splash') { w.landT = B.landT; w.falls += B.impact > 9 ? 1 : 0; }
    fx ||= waterFX(pirate.object.parent, low); bodyFX(fx, B, w.x, w.z, w.speed, dt); if (fx) fx.update();
    place(); pirate.update(dt, w.speed, w.pose);
    fovPush(dt, Math.min(1, Math.max(0, (w.speed - WALK.walk) / (WALK.run - WALK.walk)))); w.running = w.speed > WALK.walk + 0.5;
    if (w.camHook) { w.camHook(dt); return; } // [Timothy tps] the musket's over-the-shoulder camera (js/onfoot/tps.js)
    camPos(cam); camera.position.lerp(cam, Math.min(1, dt * 10)); tgt.set(w.x, w.y + 1.5, w.z); camera.lookAt(tgt);
  }
  return { w, world, enter, exit, update, onKey, snapCam, jump: () => { w.jumpQ = true; }, get active() { return w.active; } };
}
