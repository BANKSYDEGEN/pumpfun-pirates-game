// [Emerly] PUMPFUN PIRATES on-foot pirate: ONE loader (loadPirate) so the body can be swapped for Raul's Blender pirates
// (assets/pirates/*_lo.glb, not on this branch yet: set PIRATE_GLB when they land) without touching the controller.
// Placeholder = a shirtless chibi deckhand (BANKSY: new pirates start shirtless; clothes, hats, patches, parrots and hooks come
// from the shop later, so there is NO gear here). Procedural idle / walk / run: hip + shoulder swing, bob, lean.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from '../toon.js';

export { PIRATE_GLB } from '../pirateGLB.js'; // [v100] Raul's Blender pirates v4 (js/pirates.js); the procedural deckhand below is the fallback while it loads
import { pirateFigure } from '../pirates.js';
import { playLocomotion } from './locomotion.js';
import { swimPose } from './swimPose.js'; // [Raul swim-anim] tread / crawl / pull-up / surface kick
import { emotePose, startEmote } from './emotePose.js'; // [Raul emotes] quick-chat body motions on land

const SKINS = [0xd99b6c, 0xf2c9a0, 0xe0a97c, 0xc68a5e, 0x9a6440, 0x6e4528];
const HAIR = [0x2b1b12, 0x4a2c17, 0x161616, 0x8a5a2b, 0xc9a25a];
const TROUSERS = 0x5b4636, BOOT = 0x1d1b1a, BELT = 0x2a1a10, BUCKLE = 0xffc93c;
let MAT = null; const mat = () => (MAT ||= toon(0xffffff, null, { vertexColors: true, key: 'onfoot-pirate' }));
let OUTM = null; const outMat = () => (OUTM ||= new THREE.MeshBasicMaterial({ color: 0x161616, side: THREE.BackSide }));
const _c = new THREE.Color();
function part(list) { // [[geometry, colour, Matrix4]] -> one vertex-coloured geometry
  const gs = list.map(([g, col, m]) => { let q = g.index ? g.toNonIndexed() : g; q.deleteAttribute('uv'); if (m) q.applyMatrix4(m); _c.set(col);
    const n = q.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; } q.setAttribute('color', new THREE.BufferAttribute(c, 3)); return q; });
  const g = mergeGeometries(gs, false); gs.forEach(x => x.dispose()); g.computeVertexNormals(); return g; }
const T = (x, y, z, rx = 0, ry = 0, rz = 0, s = [1, 1, 1]) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(...s));

// geometry cache per look (skin, hair): every pirate with the same look shares the buffers
const GEO = new Map();
function geos(look, low) {
  const key = `${look.skin}|${look.hair}|${low ? 1 : 0}`; if (GEO.has(key)) return GEO.get(key);
  const sk = SKINS[look.skin % SKINS.length], hr = HAIR[look.hair % HAIR.length], seg = low ? 8 : 14;
  const sphere = (r, a = seg, b = Math.max(6, seg - 4)) => new THREE.SphereGeometry(r, a, b), cyl = (a, b, h, n = seg) => new THREE.CylinderGeometry(a, b, h, n), box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const g = {
    // torso + head (pivot = hips, y 0.78): bare chest, belly, belt + buckle, chibi head with hair, eyes, brows, nose
    body: part([
      [cyl(0.25, 0.22, 0.5), sk, T(0, 0.27, 0)], [sphere(0.27), sk, T(0, 0.5, 0, 0, 0, 0, [1.05, 0.62, 0.85])],                // chest + shoulders
      [sphere(0.23), sk, T(0, 0.1, 0.02, 0, 0, 0, [1, 0.8, 0.9])],                                                           // belly
      [cyl(0.245, 0.245, 0.11), BELT, T(0, -0.03, 0)], [box(0.13, 0.1, 0.04), BUCKLE, T(0, -0.03, 0.235)],
      [cyl(0.24, 0.23, 0.2), TROUSERS, T(0, -0.15, 0)],                                                                    // hips
      [cyl(0.09, 0.1, 0.16), sk, T(0, 0.66, 0)],                                                                            // neck
      [sphere(0.4), sk, T(0, 1.02, 0.02, 0, 0, 0, [1, 0.95, 0.95])],                                                       // head (chibi)
      [sphere(0.42), hr, T(0, 1.12, -0.06, -0.25, 0, 0, [1.02, 0.78, 1.0])],                                                // hair cap
      [cyl(0.07, 0.03, 0.42, 6), hr, T(0, 0.86, -0.38, 0.5)],                                                               // ponytail
      [sphere(0.075, 8, 6), 0x161616, T(-0.14, 1.02, 0.36, 0, 0, 0, [1, 1.35, 0.6])], [sphere(0.075, 8, 6), 0x161616, T(0.14, 1.02, 0.36, 0, 0, 0, [1, 1.35, 0.6])],
      [sphere(0.025, 6, 4), 0xffffff, T(-0.12, 1.06, 0.405)], [sphere(0.025, 6, 4), 0xffffff, T(0.16, 1.06, 0.405)],
      [box(0.13, 0.03, 0.03), hr, T(-0.14, 1.15, 0.37, 0, 0, 0.15)], [box(0.13, 0.03, 0.03), hr, T(0.14, 1.15, 0.37, 0, 0, -0.15)],
      [sphere(0.05, 6, 4), sk, T(0, 0.96, 0.4)], [box(0.12, 0.025, 0.02), 0x8a3b2a, T(0, 0.87, 0.375)],
    ]),
    arm: part([[cyl(0.085, 0.075, 0.5), sk, T(0, -0.25, 0)], [sphere(0.09), sk, T(0, -0.52, 0.01)], [sphere(0.1), sk, T(0, 0, 0)]]), // pivot = shoulder
    leg: part([[cyl(0.11, 0.095, 0.5), TROUSERS, T(0, -0.25, 0)], [cyl(0.105, 0.11, 0.16), BOOT, T(0, -0.52, 0)], [box(0.19, 0.11, 0.3), BOOT, T(0, -0.6, 0.06)]]), // pivot = hip
  };
  GEO.set(key, g); return g;
}

// returns { object, update(dt, speed, state), dispose, height }
export function loadPirate({ look = { skin: 0, hair: 0 }, low = false, outline = !low, gear = null, local = false, bodyFromGear = local } = {}) {
  // Raul's GLB path goes here (load once, clone per pirate, drive its idle / walk / run clips); placeholder below meanwhile
  const g = geos(look, low), m = mat(), root = new THREE.Group(); root.name = 'pirate';
  const hips = new THREE.Group(); hips.position.y = 0.78; root.add(hips);
  const add = (geo, parent, pos) => { const o = new THREE.Mesh(geo, m); o.position.copy(pos); o.castShadow = !low; parent.add(o);
    if (outline) { const s = new THREE.Mesh(geo, outMat()); s.scale.setScalar(1.06); o.add(s); } return o; };
  const body = add(g.body, hips, new THREE.Vector3(0, 0, 0));
  const armL = add(g.arm, body, new THREE.Vector3(-0.32, 0.52, 0)), armR = add(g.arm, body, new THREE.Vector3(0.32, 0.52, 0));
  const legL = add(g.leg, hips, new THREE.Vector3(-0.12, -0.16, 0)), legR = add(g.leg, hips, new THREE.Vector3(0.12, -0.16, 0));
  armL.rotation.z = 0.12; armR.rotation.z = -0.12;
  // [v100] Raul's v4 GLB body: swaps in when loaded (hides the placeholder), clips idle / walk / run by speed
  let v4 = null; const fig = pirateFigure({ look, low, height: 1.75, gear, local, bodyFromGear, onReady: (p) => { v4 = p; hips.visible = false; } }); root.add(fig);
  let ph = 0, blend = 0, t = 0;
  function update(dt, speed = 0, state = 'idle') {
    if (v4) { // [Raul] state (js/onfoot/physics.js poseBody): fall = fast run (flailing). [Raul swim-anim] swim / tread / climb / hop = procedural
      // bone poses (js/onfoot/swimPose.js) over the idle clip, blended in and out
      v4.birdFly = true; v4.footSpeed = speed; v4.footState = state;   // [Raul items redo 2] on foot the parrot may take off (js/pirateGear.js birdPost)
      const wet = state === 'swim' || state === 'tread' || state === 'climb' || state === 'hop';
      const own = swimPose(v4, state, dt, speed, root.userData.swimK || 0);
      if (root.userData.emote) emotePose(v4, root, state, dt, speed);   // [Raul emotes] land only, over the clip (after the swim layer)
      const c = wet || own ? 'idle' : state === 'fall' ? 'run' : speed > 4.4 ? 'run' : speed > 0.25 ? 'walk' : 'idle';
      playLocomotion(v4, c, speed, state === 'fall'); return; }
    t += dt; const run = Math.min(1, Math.max(0, (speed - 4.4) / 2)), walk = Math.min(1, speed / 1.2);
    blend += (walk - blend) * Math.min(1, dt * 10);
    ph += dt * (speed > 0.1 ? 2.2 + speed * 1.15 : 0);
    const sw = Math.sin(ph), amp = blend * (0.55 + 0.35 * run);
    legL.rotation.x = sw * amp; legR.rotation.x = -sw * amp;
    armL.rotation.x = -sw * amp * 0.9; armR.rotation.x = sw * amp * 0.9;
    armL.rotation.z = 0.12 + run * 0.15; armR.rotation.z = -0.12 - run * 0.15;
    const breathe = (1 - blend) * Math.sin(t * 2.1) * 0.012;
    hips.position.y = 0.78 + Math.abs(Math.cos(ph)) * 0.07 * blend * (1 + run) + breathe;
    body.rotation.x = 0.08 * blend + 0.14 * run; body.rotation.y = -sw * 0.08 * blend;
    body.scale.set(1, 1 + breathe * 1.5, 1);
  }
  return { object: root, update, height: 1.75, emote: (e, delay = 0) => startEmote(root, e, delay), dispose() { fig.userData.dispose?.(); root.removeFromParent(); } };
}
