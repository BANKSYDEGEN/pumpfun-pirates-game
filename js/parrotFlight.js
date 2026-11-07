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
  const a = t * .82 + phase, r = .38 + .055 * Math.sin(t * .47 + phase);
  return { x: Math.cos(a) * r, y: .94 + .055 * Math.sin(t * 1.4 + phase), z: Math.sin(a) * r * .74,
    yaw: -a, bank: -.22 - .10 * Math.sin(t * .47 + phase), pitch: .06 * Math.cos(t * 1.4 + phase) };
}
export function animateParrot(bird, t, { cage = false } = {}) {
  const bones = bird.userData.flightBones;
  const glide = cage ? 0 : Math.pow(Math.max(0, Math.sin(t * .63)), 8);
  const flap = Math.sin(t * 21) * (1 - glide * .94) * (cage ? .20 : .65);
  for (const s of [-1, 1]) {
    rotateBone(bird, s < 0 ? 'wing_L' : 'wing_R', 'z', s * (flap + .10));
    rotateBone(bird, s < 0 ? 'tip_L' : 'tip_R', 'z', s * Math.sin(t * 21 - .65) * (1-glide) * (cage ? .10 : .25));
  }
  rotateBone(bird, 'tail', 'x', .08 + .10 * Math.sin(t * 2.4));
  rotateBone(bird, 'head', 'y', .13 * Math.sin(t * 1.3));
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
    p.root.add(bird); bird.scale.setScalar(h * .32);
    p._flight = { bird, h, base: box.min.y, t: 0, phase: Math.random() * 6.28, avoidIn: 0, target: new THREE.Vector3(), position: new THREE.Vector3(), initialized: false };
    updateFlyingParrot(p, 0, null, true);
  }).catch(e => { if (ticket === p._flightTicket) p._flightId = null; console.warn('[parrot] model unavailable', e); });
  return p._flightReady;
}
const origin = new THREE.Vector3(), dest = new THREE.Vector3(), projected = new THREE.Vector3();
export function updateFlyingParrot(p, dt, camera = null, preview = false) {
  const b = p._flight; if (!b) return;
  if (typeof document !== 'undefined' && document.hidden && !preview) return;
  p.root.updateWorldMatrix(true, false);
  if (camera && !preview) {
    b.bird.getWorldPosition(projected); projected.project(camera);
    if (projected.z > 1 || projected.z < -1 || Math.abs(projected.x) > 1.15 || Math.abs(projected.y) > 1.15) { b.bird.visible = false; return; }
  }
  b.bird.visible = true; dt = Math.min(.05, Math.max(0, dt)); b.t += dt;
  const f = flightPose(b.t, b.phase); b.target.set(f.x*b.h, b.base+f.y*b.h, f.z*b.h);
  if (!preview && camera) {
    dest.copy(b.target); p.root.localToWorld(dest);
    // Reserve a generous camera near-field bubble, including first-person views.
    if (dest.distanceToSquared(camera.position) < .65*.65) {
      dest.sub(camera.position); if (dest.lengthSq() < .001) dest.set(1, .2, 0);
      dest.setLength(.65).add(camera.position); b.target.copy(p.root.worldToLocal(dest));
    }
  }
  b.avoidIn -= dt;
  if (!preview && world?.blocked && b.avoidIn <= 0) {
    b.avoidIn = .08;
    p.root.getWorldPosition(origin);
    // Sweep centre + wing clearance, shorten the orbit instead of crossing walls.
    for (let k = 0; k < 5; k++) {
      dest.copy(b.target); p.root.localToWorld(dest);
      if (!world.blocked(dest.x, dest.z, origin.x, origin.z) && !world.blocked(dest.x+.3, dest.z, origin.x, origin.z) && !world.blocked(dest.x-.3, dest.z, origin.x, origin.z) && !world.blocked(dest.x, dest.z+.3, origin.x, origin.z) && !world.blocked(dest.x, dest.z-.3, origin.x, origin.z)) break;
      b.target.x *= .65; b.target.z *= .65; b.target.y += b.h * .035;
    }
    if (Math.hypot(b.target.x, b.target.z) < b.h * .24) b.target.y = Math.max(b.target.y, b.base+b.h*1.20);
    b.safe = b.target.clone();
  } else if (!preview && b.safe) b.target.copy(b.safe);
  if (!b.initialized) { b.position.copy(b.target); b.initialized = true; }
  b.position.lerp(b.target, 1-Math.exp(-dt*9)); if (Math.hypot(b.position.x, b.position.z) < b.h*.24) b.position.y = Math.max(b.position.y, b.base+b.h*1.20); b.bird.position.copy(b.position);
  b.bird.rotation.set(f.pitch, f.yaw, f.bank, 'YXZ'); animateParrot(b.bird, b.t);
}

// Baked from this exact skinned mesh: mobile-safe full-time flight, no second GL context.
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
