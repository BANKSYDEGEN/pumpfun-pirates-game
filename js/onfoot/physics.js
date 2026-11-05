// [Raul] PUMPFUN PIRATES on-foot physics (BANKSY: "change it so they can fall off of cliffs also rn walk to bottom of lake / water
// you don't float / swim"). One vertical model for YOUR pirate, the crew followers and remote pirates:
//  - ground: feet sit exactly on the ground on slopes (no lag: the old 18/s height smoothing floated you up to ~14 cm off the
//    beach); only a sudden step (deck edge, stair) is eased, through a decaying offset
//  - falls: the floor dropping more than FOOT_SWIM.step below your feet = airborne, real gravity (JUMP.g), landing squash
//  - water: deeper than FOOT_SWIM.depth (chest) = swim: feet FOOT_SWIM.float under the still surface, slow strokes, bob, ripples;
//    shallower = wade (slower the deeper). A big drop into deep water dives under and bobs back up with a splash
// Horizontal rules (where you may go: off ledges, into water, climbing out) live in world.blocked (js/island/foot.js + js/dock/world.js).
import * as THREE from 'three';
import { FOOT_SWIM } from '../island/coast.js';

export const PHYS = { g: 32, stepRate: 1.4, stepEase: 14, bob: 0.05, swim: [2.3, 3.6], wade: 0.45, fallPose: 0.22, climbT: 0.6, climbV: 1.2, hop: 0.55, ...FOOT_SWIM }; // [Raul swim-anim] climbT = the pull-up out of the water (s), hop = the surface kick height (m)
// [Emerly] BANKSY: jump while swimming = a dolphin-kick surge (k x swim speed, eased in / out over t s; holding jump keeps it going). live = the
// leader's current factor (walker.js) so the crew can keep up (followers.js). Only in deep water: the hop height is unchanged. &swimjump=0 = old.
export const SWIM_SURGE = { on: !(typeof location !== 'undefined' && /[?&]swimjump=0(&|$)/.test(location.search)), k: 1.75, t: 1.1, live: 1 };
const _f = { gy: 0, surf: null, depth: 0, swim: false, floor: 0 };
export function floorAt(world, x, z, out = _f) { const gy = world.ground(x, z), s = world.water ? world.water(x, z) : null, d = s === null ? 0 : s - gy;
  out.gy = gy; out.surf = s; out.depth = d > 0 ? d : 0; out.swim = d > PHYS.depth; out.floor = out.swim ? s - PHYS.float : gy; return out; }
export const newBody = () => ({ y: 0, vy: 0, air: false, airT: 0, off: 0, last: null, swim: false, wade: 0, surf: null, dip: 0, dipV: 0, landT: -9, ev: null, impact: 0, climb: 0, climbD: 0, hop: false, hopFX: false });
export function placeBody(b, world, x, z, ly = null) { world.layer?.(ly); const f = floorAt(world, x, z); world.layer?.(null); // [path-fix2] ly = place at that height's layer (a follower joining you on a high bridge)
  Object.assign(b, { y: f.floor, vy: 0, air: false, off: 0, last: f.floor, swim: f.swim, wade: f.swim ? 0 : f.depth, surf: f.surf, dip: 0, dipV: 0, climb: 0, climbD: 0, hop: false }); }
// [Raul swim-anim] in deep water a jump is the surface kick: a small PHYS.hop hop (dolphin kick pose), back in with a splash
export function jumpBody(b, h) { if (b.air || b.climb) return false; if (b.swim) { h = PHYS.hop; b.hop = true; b.hopFX = true; b.dip = b.dipV = 0; }
  b.air = true; b.airT = 0; b.vy = Math.sqrt(2 * PHYS.g * h); b.off = 0; b.last = null; return true; }
export const climbing = (b) => b.climb > 0;   // mid pull-up (callers slow the walk to a shuffle meanwhile)
// one frame after the horizontal move; speed = horizontal m/s (how fast a slope may rise in one frame). Sets b.ev: 'land' | 'splash' | 'fall' | null
const EVR = { splash: 3, land: 2, fall: 1 };
export function stepBody(b, world, x, z, dt, speed = 0) { // fixed <= 1/30 s sub-steps: a slow phone frame never turns a fall into slow motion
  let ev = null; dt = Math.min(dt, 0.25); const fdt = dt;
  while (dt > 1e-4) { const h = Math.min(dt, 1 / 30); dt -= h; world.layer?.(b.y); const e = step1(b, world, x, z, h, speed, fdt); if (e && (!ev || EVR[e] > EVR[ev])) ev = e; }
  world.layer?.(null); b.ev = ev; return ev; } // [path-fix2] layer = this body's feet: a high bridge is the floor only for whoever is up on it
function step1(b, world, x, z, dt, speed, fdt) { // fdt = the whole frame (the horizontal move it made: slope vs step)
  const f = floorAt(world, x, z); b.ev = null; b.surf = f.surf;
  if (b.air) { b.airT += dt; b.vy -= PHYS.g * dt; b.y += b.vy * dt;
    if (b.y <= f.floor) { b.impact = -b.vy; b.air = false; b.hop = false; b.vy = 0; b.off = 0; b.last = f.floor;
      if (f.swim) { b.dipV = -Math.min(5, b.impact * 0.45); b.ev = 'splash'; } else { b.landT = performance.now() / 1000; b.ev = f.depth > 0.25 ? 'splash' : 'land'; }
      b.y = f.floor; } }
  else if (f.floor < b.y - PHYS.step - speed * fdt * 1.25 && !(b.swim && f.swim)) { b.air = true; b.airT = 0; b.vy = 0; b.off = 0; b.last = null; b.ev = 'fall'; } // walked off a ledge
  else { if (b.last === null) b.last = f.floor; const d = f.floor - b.last;
    // [Raul swim-anim] out of the water onto a ledge (was swimming, now standing, a real rise): a PHYS.climbT pull-up curve instead of
    // the 0.2 s step ease. Same end height, same place: only the vertical path in between changes
    if (b.swim && !f.swim && d > 0.3) { b.climb = 1e-4; b.climbD = d - b.off; b.off = 0; }
    if (b.climb && f.swim) b.climb = 0;   // backed into deep water mid pull-up: the step ease below takes it down from where it is
    if (b.climb) { b.climb += dt; const k = Math.min(1, b.climb / PHYS.climbT), e = k < 0.15 ? 0 : (k - 0.15) / 0.75, u = Math.min(1, e) ** 2 * (3 - 2 * Math.min(1, e));
      b.off = -b.climbD * (1 - u); if (k >= 1) { b.climb = 0; b.off = 0; } }
    else { if (Math.abs(d) > Math.max(0.05, speed * fdt * PHYS.stepRate)) b.off -= d;   // a step, not a slope: ease it
      b.off *= Math.exp(-dt * PHYS.stepEase); if (Math.abs(b.off) < 1e-3) b.off = 0; }
    b.last = f.floor; b.y = f.floor + b.off; }
  b.swim = !b.air && f.swim; b.wade = !b.air && !f.swim ? f.depth : 0;
  // dive dip: a spring that pulls you back up to the surface after a big drop into deep water
  if (b.dip || b.dipV) { b.dipV += (-b.dip * 40 - b.dipV * 7) * dt; b.dip += b.dipV * dt; if (Math.abs(b.dip) < 1e-3 && Math.abs(b.dipV) < 1e-2) b.dip = b.dipV = 0; }
  return b.ev; }
// horizontal speed factor for water: 1 on land, slower wading, swim speed is absolute (PHYS.swim)
export const wadeFactor = (b) => (b.wade > 0.15 ? 1 - PHYS.wade * Math.min(1, b.wade / PHYS.depth) : 1);
// visual: swim lean (pivot at the chest), treading bob, falling lean; the clip state for loadPirate().update
const _o = new THREE.Vector3();
export function poseBody(obj, b, x, z, yaw, speed, t, jh = 0) {
  let tilt = 0, y = b.y + jh, st = null, back = 0; // back = visual only: the pull-up starts with the chest at the ledge face, not inside it
  if (b.swim) { const mv = Math.min(1, speed / 1.5); tilt = 0.25 + 0.95 * mv; y += Math.sin(t * 2.4 + x * 0.3) * PHYS.bob + b.dip + 0.14 * mv; st = mv > 0.15 ? 'swim' : 'tread'; } // [Raul swim-anim] + 0.14 m visual lift while stroking: back + arms break the surface
  else if (b.hop) { const T = 2 * Math.sqrt(2 * PHYS.hop / PHYS.g), k = Math.min(1, b.airT / T); tilt = 0.35 + 0.95 * Math.min(1, speed / 1.5) * 0.6 + 0.5 * k; st = 'hop'; obj.userData.swimK = k; }   // [Raul swim-anim] surface kick
  else if (b.climb) { const k = Math.min(1, b.climb / PHYS.climbT); tilt = 0.35 * Math.sin(Math.PI * Math.min(1, k * 1.15)); st = 'climb'; obj.userData.swimK = k; back = 0.4 * (b.climbD > 0 ? -b.off / b.climbD : 0); }   // [Raul swim-anim] pull-up
  else if (b.air && b.vy < -4 && b.airT > PHYS.fallPose) { tilt = -0.18; st = 'fall'; }
  obj.userData.air = !!b.air; // [Raul emotes] land-only body emotes (js/onfoot/emotePose.js)
  obj.rotation.order = 'YXZ'; obj.rotation.y = yaw; obj.rotation.x = tilt;
  const hc = 1.05, s = Math.sin(yaw), c = Math.cos(yaw), oy = hc * (1 - Math.cos(tilt)), oz = -hc * Math.sin(tilt) * 0.7; // keep the chest where it was
  _o.set(x + s * (oz - back), y + oy, z + c * (oz - back)); obj.position.copy(_o); return st; }

// ---- water FX: expanding ripple rings + a splash burst (shared per scene, pooled, no per-frame allocation) ----
const FX = new WeakMap();
export function waterFX(scene, low) {
  if (!scene) return null; if (FX.has(scene)) return FX.get(scene);
  const N = low ? 6 : 12, rg = new THREE.RingGeometry(0.55, 0.75, low ? 20 : 32); rg.rotateX(-Math.PI / 2);
  const rings = []; for (let i = 0; i < N; i++) { const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: true }));
    m.visible = false; m.renderOrder = 4; m.frustumCulled = false; m.name = 'foot_ripple'; scene.add(m); rings.push({ m, t: 9, life: 1, s0: 1, s1: 3 }); }
  const P = low ? 24 : 48, pos = new Float32Array(P * 3), vel = new Float32Array(P * 3), pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xf4fbff, size: low ? 0.35 : 0.28, transparent: true, opacity: 0.9, depthWrite: false }));
  pts.visible = false; pts.frustumCulled = false; pts.renderOrder = 4; pts.name = 'foot_splash'; scene.add(pts);
  let ri = 0, sp = 9, sy = 0, last = performance.now();
  const fx = {
    ripple(x, y, z, big = 1) { const r = rings[ri++ % N]; r.t = 0; r.life = 0.9 + 0.5 * big; r.s0 = 0.5 * big; r.s1 = 2.4 * big + 0.6; r.m.position.set(x, y + 0.04, z); r.m.visible = true; },
    splash(x, y, z, power = 1) { power = Math.min(2.2, Math.max(0.5, power)); sp = 0; sy = y; pts.visible = true;
      for (let i = 0; i < P; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 0.6; pos[i * 3] = x + Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z + Math.sin(a) * r;
        const h = (1.2 + Math.random() * 2.2) * power; vel[i * 3] = Math.cos(a) * (0.8 + Math.random() * 1.6) * power; vel[i * 3 + 1] = 2.5 + h; vel[i * 3 + 2] = Math.sin(a) * (0.8 + Math.random() * 1.6) * power; }
      pg.attributes.position.needsUpdate = true; fx.ripple(x, y, z, 1.3 * power); fx.ripple(x, y, z, 0.8 * power); },
    update() { const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); if (dt < 0.002) return; last = now; // any caller, once per frame
      for (const r of rings) { if (!r.m.visible) continue; r.t += dt; const k = r.t / r.life; if (k >= 1) { r.m.visible = false; continue; }
        r.m.scale.setScalar(r.s0 + (r.s1 - r.s0) * (1 - (1 - k) * (1 - k))); r.m.material.opacity = 0.55 * (1 - k); }
      if (pts.visible) { sp += dt; if (sp > 1.4) { pts.visible = false; return; } let alive = 0;
        for (let i = 0; i < P; i++) { if (pos[i * 3 + 1] < sy - 0.2) continue; alive++; vel[i * 3 + 1] -= 18 * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; }
        pg.attributes.position.needsUpdate = true; pts.material.opacity = 0.9 * Math.max(0, 1 - sp / 1.4); if (!alive) pts.visible = false; } },
  };
  FX.set(scene, fx); return fx;
}
// per-body ripple trail + entry splash (call once per frame after stepBody); b.rt is the body's own ripple timer
export function bodyFX(fx, b, x, z, speed, dt) {
  if (!fx) return; if (b.hopFX) { b.hopFX = false; fx.splash(x, b.surf ?? b.y, z, 0.55); } if (b.ev === 'splash') fx.splash(x, b.surf ?? b.y, z, b.swim ? b.impact / 7 : 0.6);
  if (b.surf === null || b.air || (!b.swim && b.wade < 0.2)) return;
  b.rt = (b.rt ?? 0) - dt; if (b.rt > 0) return; const mv = speed > 0.4;
  b.rt = b.swim ? (mv ? 0.32 : 0.9) : (mv ? 0.42 : 99); if (b.rt < 50) fx.ripple(x, b.surf, z, b.swim ? (mv ? 0.9 : 0.6) : 0.55); }
