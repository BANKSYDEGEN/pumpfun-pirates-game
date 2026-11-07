// One texture-free, Meshopt skinned macaw per companion. No pirate bone attachment.
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { loadPirateGLB } from './pirateGLB.js';
export const PARROT_MODEL = 'assets/pirates/items/v7/parrot_flight.glb';
export const PARROT_COLORS = { parrot_green: '#3fd16a', parrot_red: '#e8231d', parrot_blue: '#1e74e8', parrot_cockatoo: '#f6f4ee', parrot_black: '#26262c', parrot_gold: '#ffc21f', parrot_diamond: '#bfe8ff' };
export const isFlyingParrot = id => Object.hasOwn(PARROT_COLORS, id);
const FLIGHT_PALETTES = { parrot_green: ['#187bd0','#edb528'], parrot_blue: ['#1a6be6','#ffc73b'], parrot_red: ['#e73627','#ffc83b'], parrot_cockatoo: ['#f4f0df','#fff7e0'], parrot_black: ['#242630','#30303a'], parrot_gold: ['#e7ad23','#ffe19b'], parrot_diamond: ['#b5e5ff','#f0fbff'] };
let featherMask = null;
const deltaRotation = new THREE.Quaternion();
function rotateBone(bird, name, axis, angle) {
  const bone = bird.userData.flightBones[name], rest = bird.userData.flightRest[name]; if (!bone || !rest) return;
  const direction = bird.userData.flightAxes[name][axis];
  bone.quaternion.copy(rest).premultiply(deltaRotation.setFromAxisAngle(direction, angle));
}
let world = null;
export function setParrotWorld(value) { world = value; }
// All positions are fractions of pirate height. Never pass through the head/body.
export function flightPose(t, phase = 0) {
  const a = t * .82 + phase, r = .52 + .055 * Math.sin(t * .47 + phase);
  return { x: Math.cos(a) * r, y: 1.0 + .055 * Math.sin(t * 1.4 + phase), z: Math.sin(a) * r * .74,
    yaw: -a, bank: -.22 - .10 * Math.sin(t * .47 + phase), pitch: .06 * Math.cos(t * 1.4 + phase) };
}
export function animateParrot(bird, t, { cage = false, glide: g = null } = {}) {
  const bones = bird.userData.flightBones;
  const glide = cage ? 0 : g ?? Math.pow(Math.max(0, Math.sin(t * .63)), 8);
  const flap = Math.sin(t * 21) * (1 - glide * .94) * (cage ? .20 : .65);
  for (const s of [-1, 1]) {
    rotateBone(bird, s < 0 ? 'wing_L' : 'wing_R', 'z', s * (flap + .10));
    rotateBone(bird, s < 0 ? 'tip_L' : 'tip_R', 'z', s * Math.sin(t * 21 - .65) * (1-glide) * (cage ? .10 : .25));
  }
  rotateBone(bird, 'tail', 'x', .08 + .10 * Math.sin(t * 2.4));
  rotateBone(bird, 'head', 'y', .13 * Math.sin(t * 1.3));
}
// [t2086u] perched in the hull cage: upright body, wings folded back along the flanks, feet on the perch; small idle only
// (head turns, a tail twitch, a breath). Built from the wing / tip / tail / head bones (the v417 rig has no folded clip). No allocation.
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
function foldBone(bird, name, ay, az) {
  const bone = bird.userData.flightBones[name], rest = bird.userData.flightRest[name]; if (!bone || !rest) return;
  const ax = bird.userData.flightAxes[name]; qa.setFromAxisAngle(ax.y, ay); qb.setFromAxisAngle(ax.z, az);
  bone.quaternion.copy(rest).premultiply(qa).premultiply(qb);
}
export const PERCH_PITCH = -.75;
export function perchParrot(bird, t, seed = 0) {
  bird.rotation.x = PERCH_PITCH; // stand upright on the perch (head up, tail down)
  for (const s of [-1, 1]) { const L = s < 0;
    foldBone(bird, L ? 'wing_L' : 'wing_R', s * 1.45, s * -.35);   // swept back + tucked down against the body
    foldBone(bird, L ? 'tip_L' : 'tip_R', s * .25, 0); }
  const look = Math.sin(t * .55 + seed) + .6 * Math.sin(t * 1.7 + seed * 2), snap = Math.max(-1, Math.min(1, look * 1.6));
  rotateBone(bird, 'head', 'y', .55 * snap);
  rotateBone(bird, 'tail', 'x', -.35 + .12 * Math.pow(Math.max(0, Math.sin(t * 1.3 + seed)), 24));
  const breathe = 1 + .015 * Math.sin(t * 2.6); bird.userData.flightBones.body?.scale.set(breathe, breathe, breathe);
}
export function colorParrot(bird, id) {
  const tint = new THREE.Color(PARROT_COLORS[id] || PARROT_COLORS.parrot_green), c = new THREE.Color(), hsl = {};
  bird.traverse(o => {
    if (o.userData.flightTint) {
      const U=o.userData.flightTint, pair=FLIGHT_PALETTES[id] || FLIGHT_PALETTES.parrot_green;
      U.parrotBlue.value.set(pair[0]); U.parrotYellow.value.set(pair[1]); U.parrotTintOn.value = id === 'parrot_green' ? 0 : 1;
      return;
    }
    const a = o.geometry?.attributes.color, base = o.userData.flightColors; if (!a || !base) return;
    for (let i = 0; i < a.count; i++) {
      c.setRGB(base[i*3], base[i*3+1], base[i*3+2]); c.getHSL(hsl);
      if (hsl.s > .22 && hsl.h > .23 && hsl.h < .76) c.copy(tint).multiplyScalar(hsl.h > .5 ? .65 : 1);
      a.setXYZ(i, c.r, c.g, c.b);
    }
    a.needsUpdate = true;
  });
}
export async function createFlightParrot(id = 'parrot_green') {
  return instantiateFlightParrot(await loadPirateGLB(PARROT_MODEL), id);
}
export function instantiateFlightParrot(gltf, id = 'parrot_green') {
  const bird = clone(gltf.scene), bones = {};
  bird.traverse(o => {
    if (o.isBone) bones[o.name] = o;
    if (!o.isMesh) return;
    o.geometry = o.geometry.clone(); o.geometry.userData = {};
    const source = Array.isArray(o.material) ? o.material[0] : o.material;
    o.material = new THREE.MeshLambertMaterial({ map: source.map || null, vertexColors: !source.map && !!o.geometry.attributes.color, side: THREE.DoubleSide });
    if (source.map) {
      if (!featherMask) { featherMask = new THREE.TextureLoader().load(new URL('../assets/pirates/items/v7/parrot_flight_mask.webp', import.meta.url).href); featherMask.flipY = false; }
      const U = { parrotMask: { value: featherMask }, parrotBlue: { value: new THREE.Color() }, parrotYellow: { value: new THREE.Color() }, parrotTintOn: { value: 0 } };
      o.userData.flightTint = U;
      o.material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, U);
        shader.fragmentShader = 'uniform sampler2D parrotMask; uniform vec3 parrotBlue, parrotYellow; uniform float parrotTintOn;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          vec2 featherRegion = texture2D(parrotMask, vMapUv).rg * parrotTintOn;
          float featherLight = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));
          diffuseColor.rgb = mix(diffuseColor.rgb, parrotBlue * (.40 + 1.8*featherLight), featherRegion.r);
          diffuseColor.rgb = mix(diffuseColor.rgb, parrotYellow * (.25 + 1.15*featherLight), featherRegion.g);`);
      };
      o.material.customProgramCacheKey = () => 'macaw-feather-mask-v1';
    }
    o.castShadow = false; o.frustumCulled = false;
    const a = o.geometry.attributes.color; if (!a) return; const base = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) { base[i*3] = a.getX(i); base[i*3+1] = a.getY(i); base[i*3+2] = a.getZ(i); }
    o.userData.flightColors = base;
  });
  bird.userData.flightBones = bones; bird.userData.flightRest = {}; bird.userData.flightAxes = {};
  bird.updateMatrixWorld(true);
  for (const [name,bone] of Object.entries(bones)) {
    bird.userData.flightRest[name] = bone.quaternion.clone();
    const inv = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    bird.userData.flightAxes[name] = { x:new THREE.Vector3(1,0,0).applyQuaternion(inv), y:new THREE.Vector3(0,1,0).applyQuaternion(inv), z:new THREE.Vector3(0,0,1).applyQuaternion(inv) };
  }
  bird.userData.dispose = () => { bird.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); o.skeleton?.dispose?.(); } }); bird.removeFromParent(); };
  colorParrot(bird, id); animateParrot(bird, 0); return bird;
}
export function disposeFlyingParrot(p) {
  p._flightTicket = (p._flightTicket || 0) + 1;
  p._flight?.bird.userData.dispose(); p._flight = null; p._flightId = null;
}
export function syncFlyingParrot(p, id, create = createFlightParrot) {
  if (p._flightId === id) return p._flightReady || Promise.resolve();
  disposeFlyingParrot(p);
  if (!isFlyingParrot(id)) return Promise.resolve();
  p._flightId = id; const ticket = p._flightTicket;
  // Raw pirate-space bounds, measured before adding the bird (not deformed by shoulder bones).
  p.root.updateWorldMatrix(true, true);
  const inv = p.root.matrixWorld.clone().invert(), box = new THREE.Box3().setFromObject(p.root).applyMatrix4(inv);
  const h = Math.max(.5, box.max.y - box.min.y);
  p._flightReady = create(id).then(bird => {
    if (ticket !== p._flightTicket) { bird.userData.dispose(); return; }
    p.root.add(bird); bird.scale.setScalar(h * .48); // [t2088u] macaw-sized, 1.5x
    p._flight = { bird, h, base: box.min.y, t: 0, phase: Math.random() * 6.28, avoidIn: 0, target: new THREE.Vector3(), position: new THREE.Vector3(), initialized: false };
    updateFlyingParrot(p, 0, null, true);
  }).catch(e => { if (ticket === p._flightTicket) p._flightId = null; console.warn('[parrot] model unavailable', e); });
  return p._flightReady;
}
const projected = new THREE.Vector3(), _me = new THREE.Vector3(), _fwd = new THREE.Vector3(), _to = new THREE.Vector3(), _want = new THREE.Vector3(), _nx = new THREE.Vector3();
const _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _e = new THREE.Euler();
// [t2089u] Independent companion flight (like a crew member, not an orbit). World-space wander AI around the pirate:
// picks its own targets 6-15 m out (ahead / sides / above), curves to them with banked turns, mixes glides, swoops, wide loops and
// short airborne hover-and-look beats; leash 20 m = flies back fast; > 60 m (fast travel, sailing) = snaps back. Ground + wall checks
// via world.ground / world.blocked (one probe every 0.1 s). Never lands on or touches the pirate. Each client runs it from a per-bird
// seed (remote birds behave the same way; their exact path is local, nothing is synced).
export const PARROT_AI = { near: 6, far: 15, leash: 20, snap: 60, cruise: 6.5, sprint: 15, minUp: 1.6, maxUp: 6.5, clear: 1.6, turn: 2.4 };
const rnd = b => (b.seed = (b.seed * 16807) % 2147483647) / 2147483647;
function ground(x, z, fallback) { try { const g = world?.ground?.(x, z); return Number.isFinite(g) ? g : fallback; } catch { return fallback; } }
function pickGoal(b, me, yaw) {
  const r = rnd(b);
  b.mode = r < .14 ? 'hover' : r < .26 ? 'loop' : r < .42 ? 'swoop' : r < .52 ? 'explore' : 'cruise';
  b.modeT = b.mode === 'hover' ? 1 + rnd(b) * 1.4 : b.mode === 'loop' ? 4 + rnd(b) * 3 : 3 + rnd(b) * 4;
  const A = PARROT_AI, dist = b.mode === 'explore' ? A.far + rnd(b) * 3 : A.near + rnd(b) * (A.far - A.near);
  const ang = yaw + (rnd(b) - .5) * (b.mode === 'explore' ? 4.2 : 2.6); // bias ahead of the pirate
  b.goal.set(me.x + Math.sin(ang) * dist, 0, me.z + Math.cos(ang) * dist);
  const gy = Math.max(ground(b.goal.x, b.goal.z, me.y), me.y - 3);
  b.goal.y = gy + A.minUp + rnd(b) * (b.mode === 'swoop' ? 1 : A.maxUp - A.minUp);
  b.loopC = b.goal.clone(); b.loopDir = rnd(b) < .5 ? -1 : 1; b.loopA = Math.atan2(b.wpos.x - b.goal.x, b.wpos.z - b.goal.z);
  if (b.mode === 'hover') b.goal.copy(b.wpos);
}
export function updateFlyingParrot(p, dt, camera = null, preview = false) {
  const b = p._flight; if (!b) return;
  if (typeof document !== 'undefined' && document.hidden && !preview) return;
  // [t2085u] inside the ship hull your parrot sits in the cage (js/dock/parrotCage.js), never flying; equip state untouched
  if (!preview && typeof document !== 'undefined' && document.documentElement?.classList?.contains('pfp-inhull')) { b.bird.visible = false; b.initialized = false; return; }
  const A = PARROT_AI; dt = Math.min(.05, Math.max(0, dt)); b.t += dt;
  p.root.updateWorldMatrix(true, false); p.root.getWorldPosition(_me);
  _fwd.set(0, 0, 1).transformDirection(p.root.matrixWorld); const yaw = Math.atan2(_fwd.x, _fwd.z);
  if (!b.wpos) { b.wpos = new THREE.Vector3(); b.vel = new THREE.Vector3(); b.goal = new THREE.Vector3(); b.seed = 1 + Math.floor(b.phase * 1e6) % 2147483646; b.bank = 0; b.glide = 0; }
  if (!b.initialized || b.wpos.distanceToSquared(_me) > A.snap * A.snap) { // spawn / snap beside the pirate's shoulder height + a little out
    b.wpos.set(_me.x + Math.sin(yaw + 1.2) * 2.5, _me.y + b.h * p.root.getWorldScale(_nx).y * 1.4 + 1, _me.z + Math.cos(yaw + 1.2) * 2.5); b.vel.set(0, 0, 0); b.initialized = true; pickGoal(b, _me, yaw);
  }
  const far = Math.hypot(b.wpos.x - _me.x, b.wpos.z - _me.z), behind = far > A.leash;
  b.modeT -= dt; if (b.modeT <= 0 || (b.mode !== 'hover' && b.mode !== 'loop' && b.wpos.distanceToSquared(b.goal) < 2.2) || behind) pickGoal(b, _me, yaw);
  if (behind) { b.mode = 'catch'; b.goal.set(_me.x + Math.sin(yaw) * A.near, _me.y + 2.5, _me.z + Math.cos(yaw) * A.near); }
  let speed = behind ? A.sprint : A.cruise;
  if (b.mode === 'loop') { b.loopA += b.loopDir * dt * .9; _want.set(b.loopC.x + Math.sin(b.loopA) * 6, b.loopC.y + 1.2 * Math.sin(b.loopA * 2), b.loopC.z + Math.cos(b.loopA) * 6); }
  else if (b.mode === 'swoop') { _want.copy(b.goal); _want.y += Math.sin(Math.min(1, b.modeT / 4) * Math.PI) * -1.2; speed *= 1.2; }
  else _want.copy(b.goal);
  _to.subVectors(_want, b.wpos); const d = _to.length();
  if (b.mode === 'hover') { _to.set(Math.sin(b.t * 1.7) * .4, Math.sin(b.t * 2.3) * .25, Math.cos(b.t * 1.3) * .4); speed = .8; }
  else _to.multiplyScalar(1 / Math.max(.001, d)).multiplyScalar(speed * Math.min(1, d / 3 + .35));
  b.vel.lerp(_to, 1 - Math.exp(-dt * A.turn)); // smooth curved paths: velocity eases toward the steering vector
  _nx.copy(b.wpos).addScaledVector(b.vel, dt);
  // keep clear of the pirate (never lands on / touches them)
  const dx = _nx.x - _me.x, dz = _nx.z - _me.z, dh = Math.hypot(dx, dz), top = _me.y + 2.2;
  if (dh < A.clear && _nx.y < top + .6) { const k = (A.clear - dh) / Math.max(.001, dh); _nx.x += dx * k; _nx.z += dz * k; _nx.y = Math.max(_nx.y, top + .6); }
  b.avoidIn = (b.avoidIn || 0) - dt;
  if (!preview && b.avoidIn <= 0) { b.avoidIn = .1;
    b.gy = ground(_nx.x, _nx.z, Math.min(_me.y, b.gy ?? _me.y));
    if (world?.blocked) { let hit = false; try { hit = world.blocked(_nx.x + b.vel.x * .4, _nx.z + b.vel.z * .4, b.wpos.x, b.wpos.z); } catch {} if (hit) { b.vel.multiplyScalar(-.3); b.vel.y = Math.abs(b.vel.y) + 1.5; if (!behind) pickGoal(b, _me, yaw); } }
  }
  _nx.y = Math.max(_nx.y, (b.gy ?? _me.y - 5) + 1.1);
  b.wpos.copy(_nx);
  // pose: heading from velocity, bank into turns, pitch with climb / dive; glide while descending or cruising straight
  const hs = Math.hypot(b.vel.x, b.vel.z), heading = hs > .3 ? Math.atan2(b.vel.x, b.vel.z) : (b.heading ?? yaw);
  let dyaw = heading - (b.heading ?? heading); dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); b.heading = heading;
  b.bank += (Math.max(-.7, Math.min(.7, -dyaw / Math.max(dt, .001) * .25)) - b.bank) * Math.min(1, dt * 4);
  const pitch = Math.max(-.5, Math.min(.4, -Math.atan2(b.vel.y, Math.max(.5, hs)) * .8));
  b.glide += ((b.vel.y < -.4 || (b.mode === 'cruise' && Math.abs(dyaw) < .002 && hs > 4)) ? 1 : 0) - b.glide;
  b.glide = Math.max(0, Math.min(1, b.glide));
  // into the pirate's local frame (the bird stays parented to the pirate root for disposal)
  const parent = b.bird.parent || p.root; parent.updateWorldMatrix(true, false);
  b.position.copy(b.wpos); parent.worldToLocal(b.position);
  if (camera && !preview) { // camera near-field bubble (first-person) + offscreen = no skinning work (the AI above keeps running)
    if (b.wpos.distanceToSquared(camera.position) < .42) { b.bird.visible = false; return; }
    projected.copy(b.wpos).project(camera);
    if (projected.z > 1 || projected.z < -1 || Math.abs(projected.x) > 1.15 || Math.abs(projected.y) > 1.15) { b.bird.visible = false; return; }
  }
  b.bird.visible = true; b.bird.position.copy(b.position); b.target.copy(b.position);
  _bq.setFromEuler(_e.set(pitch, heading, b.bank, 'YXZ')); parent.getWorldQuaternion(_pq).invert(); b.bird.quaternion.copy(_pq.multiply(_bq));
  animateParrot(b.bird, b.t, { glide: b.mode === 'hover' ? 0 : b.glide * .85 });
}

export function parrotPreviewEl(id) {
  if (!document.getElementById('parrot-flight-style')) {
    const style = document.createElement('style'); style.id = 'parrot-flight-style';
    const frames = Array.from({ length: 12 }, (_, i) => `${i/12*100}%{background-position:${i%4/3*100}% ${Math.floor(i/4)/2*100}%}`).join('');
    style.textContent = `.pfp-parrot-preview{background-repeat:no-repeat!important;background-size:400% 300%!important;animation:parrot-atlas .30s steps(1,end) infinite}.pfp-parrot-preview.paused{animation-play-state:paused}@keyframes parrot-atlas{${frames}100%{background-position:0% 0%}}@media(prefers-reduced-motion:reduce){.pfp-parrot-preview{animation:none}}`;
    document.head.append(style);
  }
  const el = document.createElement('div'); el.className = 'ishop-sw gear real3d pfp-parrot-preview';
  const color = isFlyingParrot(id) ? id.slice(7) : 'green';
  el.style.backgroundImage = `url("${new URL('../assets/pirates/items/v7/parrot_flight_'+color+'.webp', import.meta.url).href}")`;
  el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'Parrot flying with articulated wings');
  // One shared observer; removed cards are unobserved on the next render batch.
  if (typeof IntersectionObserver !== 'undefined') {
    if (!previewObserver) previewObserver = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('paused', !e.isIntersecting)));
    for (const old of previewElements) if (!old.isConnected) { previewObserver.unobserve(old); previewElements.delete(old); }
    previewElements.add(el); previewObserver.observe(el);
  }
  return el;
}
let previewObserver = null;
const previewElements = new Set();

export function releaseParrotPreviews(root) {
  for (const el of previewElements) if (!el.isConnected || root?.contains(el)) {
    el.classList.add('paused'); previewObserver?.unobserve(el); previewElements.delete(el);
  }
  if (!previewElements.size) { previewObserver?.disconnect(); previewObserver = null; }
}
