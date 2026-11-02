// [Emerly] PUMPFUN PIRATES on-foot controller: third-person pirate on the harbor world (layout walk API).
// PC: WASD / arrows move (camera-relative), Shift runs, drag the mouse to look (same left-drag as the ship camera), wheel zooms.
// Phone / tablet: virtual joystick (left thumb: push far = run), drag anywhere else to look, pinch zooms. Interact = E / the
// action button (js/onfoot/interact.js). Keys are swallowed while on foot so the ship never steers or fires underneath.
import * as THREE from 'three';
import { held, isKey } from '../keybinds.js'; // [v102] sprint = the rebindable 'sprint' key (default hold Shift)

export const WALK = { walk: 4.2, run: 9.6, fovPush: 6, radius: 0.45, camD: [3.2, 7, 14], pitch: [-0.35, 1.1] };
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);

export function createWalker({ camera, canvas, world, pirate, touch }) {
  const w = { x: 0, z: 0, y: 0, yaw: 0, speed: 0, camYaw: 0, pitch: 0.28, dist: WALK.camD[1], keys: {}, joy: { x: 0, y: 0, on: false }, active: false, drags: new Map(), look: 0 };
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
    if (MOVE_KEYS.has(e.code) || isKey('sprint', e.code) || ['KeyQ', 'Space', 'KeyC'].includes(e.code)) { w.keys[e.code] = down; e.preventDefault?.(); return true; }
    return false;
  };
  // ---- pointer look (canvas) + pinch ----
  canvas.addEventListener('pointerdown', (e) => { if (!w.active) return; w.drags.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
  addEventListener('pointermove', (e) => { if (!w.active) return; const d = w.drags.get(e.pointerId); if (!d) return;
    if (w.drags.size >= 2) { const [a, b] = [...w.drags.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); d.x = e.clientX; d.y = e.clientY; const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      w.dist = Math.min(WALK.camD[2], Math.max(WALK.camD[0], w.dist * (d0 / Math.max(1, d1)))); return; }
    const k = touch ? 0.0075 : 0.0055; w.camYaw -= (e.clientX - d.x) * k; w.pitch = Math.min(WALK.pitch[1], Math.max(WALK.pitch[0], w.pitch + (e.clientY - d.y) * k * 0.8));
    d.x = e.clientX; d.y = e.clientY; w.look = performance.now(); });
  const up = (e) => w.drags.delete(e.pointerId); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { if (!w.active) return; w.dist = Math.min(WALK.camD[2], Math.max(WALK.camD[0], w.dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: true });
  addEventListener('blur', () => { for (const k in w.keys) w.keys[k] = false; });

  function enter(x, z, yaw) { Object.assign(w, { x, z, yaw, camYaw: yaw, speed: 0, active: true, pitch: 0.28 }); w.y = world.ground(x, z); for (const k in w.keys) w.keys[k] = false; w.drags.clear(); pirate.object.visible = true; place(); snapCam(); }
  function exit() { fovReset(); w.active = false; pirate.object.visible = false; w.drags.clear(); w.joy.on = false; w.joy.x = w.joy.y = 0; }
  function place() { pirate.object.position.set(w.x, w.y, w.z); pirate.object.rotation.y = w.yaw; }
  function camPos(out) { const cp = Math.cos(w.pitch); out.set(w.x - Math.sin(w.camYaw) * w.dist * cp, w.y + 1.7 + Math.sin(w.pitch) * w.dist, w.z - Math.cos(w.camYaw) * w.dist * cp);
    const gy = world.ground(out.x, out.z); if (out.y < gy + 0.8) out.y = gy + 0.8; return out; }
  function snapCam() { camera.position.copy(camPos(cam)); tgt.set(w.x, w.y + 1.5, w.z); camera.lookAt(tgt); }
  function step(dx, dz) { // move with sliding + a few sub-steps so a fast run never tunnels through a wall
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3)); let moved = 0; // [v103] ≤0.3 m sub-steps (< the 0.45 m body radius) at the faster sprint
    for (let i = 0; i < n; i++) { const sx = dx / n, sz = dz / n;
      if (!world.blocked(w.x + sx, w.z + sz, w.x, w.z)) { w.x += sx; w.z += sz; moved++; }
      else if (Math.abs(sx) > 1e-4 && !world.blocked(w.x + sx, w.z, w.x, w.z)) { w.x += sx; moved += 0.5; }
      else if (Math.abs(sz) > 1e-4 && !world.blocked(w.x, w.z + sz, w.x, w.z)) { w.z += sz; moved += 0.5; } }
    return moved / n;
  }
  function update(dt) {
    if (!w.active) return;
    const K = w.keys; let f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), s = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
    let mag = Math.min(1, Math.hypot(f, s)), run = held('sprint', K);
    if (w.joy.on && Math.hypot(w.joy.x, w.joy.y) > 0.12) { f = -w.joy.y; s = w.joy.x; mag = Math.min(1, Math.hypot(f, s)); run = mag > 0.88; }
    let want = 0;
    if (mag > 0.01) {
      const n = Math.hypot(f, s), fx = Math.sin(w.camYaw), fz = Math.cos(w.camYaw), dx = (fx * f - fz * s) / n, dz = (fz * f + fx * s) / n;
      want = (run ? WALK.run : WALK.walk) * (w.joy.on ? Math.max(0.35, mag) : 1);
      const yawT = Math.atan2(dx, dz); let dy = yawT - w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); w.yaw += dy * Math.min(1, dt * 12);
      w.speed += (want - w.speed) * Math.min(1, dt * 10);
      const got = step(dx * w.speed * dt, dz * w.speed * dt); if (got < 0.3) w.speed *= 0.5;
      // the camera drifts behind you while you walk (not while you are dragging / just dragged it)
      if (!w.drags.size && performance.now() - w.look > 1200) { let c = w.yaw - w.camYaw; c = Math.atan2(Math.sin(c), Math.cos(c)); w.camYaw += c * Math.min(1, dt * 1.4 * mag); }
    } else w.speed += (0 - w.speed) * Math.min(1, dt * 12);
    const gy = world.ground(w.x, w.z); w.y += (gy - w.y) * Math.min(1, dt * 18);
    place(); pirate.update(dt, w.speed);
    fovPush(dt, Math.min(1, Math.max(0, (w.speed - WALK.walk) / (WALK.run - WALK.walk)))); w.running = w.speed > WALK.walk + 0.5;
    camPos(cam); camera.position.lerp(cam, Math.min(1, dt * 10)); tgt.set(w.x, w.y + 1.5, w.z); camera.lookAt(tgt);
  }
  return { w, world, enter, exit, update, onKey, snapCam, get active() { return w.active; } };
}
