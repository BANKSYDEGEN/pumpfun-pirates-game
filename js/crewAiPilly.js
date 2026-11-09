// AI-ship near deck crew: Pilly as a pirate SKIN at V7 height.
// Same stations / seat move() logic as crewNativeV7 (gunners, walkers, captain, lookout).
// Evidence against true V7 skeletal retarget: V7 pirate = 13 joints (root/spine/head/arms/legs…);
// pet_pilly.glb = 6 joints (root/body/arm_R/arm_L/foot_R/foot_L) with Idle/Walk/Run/Wave only.
// So we drive a shared Pilly lookalike with Pilly's own clips, mapped from crew roles
// (idle/cannon/steer → Idle, walk → Walk). Not a pet: no follow/wander/badge/face/ownership.
// Lazy load only — never imported from onfoot/pilly.js, never in preloadList.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const AI_PILLY_URL = 'assets/pirates/items/v7/pet_pilly.glb';
export const AI_PILLY_H_MODEL = 1.08; // authored height (matches onfoot/pilly.js H_MODEL)
export const AI_PILLY_H_TARGET = 1.75; // same normalize target as crewNativeV7 template()
const CLIP_MAP = { idle: 'Idle', walk: 'Walk', run: 'Run', cannon: 'Idle', steer: 'Idle' };

const states = new Set(), scenes = new WeakSet();
const cameraP = new THREE.Vector3(), worldP = new THREE.Vector3();
const candidates = [], frustum = new THREE.Frustum();
const viewMatrix = new THREE.Matrix4(), sphere = new THREE.Sphere(new THREE.Vector3(), 35);
const fract = (x) => x - Math.floor(x);
const smooth = (a, b, v) => { const t = THREE.MathUtils.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

let _loader = null, _template = null;
function loader() {
  if (_loader) return _loader;
  _loader = new GLTFLoader();
  _loader.setMeshoptDecoder(MeshoptDecoder);
  return _loader;
}

function template() {
  if (_template) return _template;
  const progress = { phase: 'load' };
  const promise = (async () => {
    const gl = await loader().loadAsync(new URL(AI_PILLY_URL, document.baseURI).href);
    progress.phase = 'rig';
    const root = gl.scene;
    root.name = 'ai-pilly-template';
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const h = Math.max(1e-3, box.max.y - box.min.y);
    const k = AI_PILLY_H_TARGET / h;
    const clips = Object.create(null);
    for (const a of gl.animations || []) clips[a.name] = a;
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = false;
      o.frustumCulled = false;
      if (o.material) {
        o.material = o.material.clone();
        o.material.side = THREE.FrontSide;
      }
    });
    progress.phase = 'done';
    return { root, clips, k, y0: box.min.y, source: AI_PILLY_URL, triangles: estimateTris(root) };
  })().catch((e) => { _template = null; throw e; });
  promise.progress = progress;
  _template = promise;
  return promise;
}

function estimateTris(root) {
  let n = 0;
  root.traverse((o) => { if (o.isMesh) n += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3; });
  return n;
}

function cloneRig(root) {
  const saved = [];
  root.traverse((o) => { saved.push([o, o.userData]); o.userData = {}; });
  try { return SkeletonUtils.clone(root); }
  finally { for (const [o, data] of saved) o.userData = data; }
}

function clear(state) {
  state.mesh.visible = true;
  if (state.props) { state.props.geometry.dispose(); state.props = null; }
  for (const a of state.actors) {
    a.mixer.stopAllAction();
    a.mixer.uncacheRoot(a.root);
    a.root.traverse((o) => {
      if (o.isMesh) {
        for (const m of [].concat(o.material)) m?.dispose?.();
      }
    });
  }
  state.group.clear();
  state.actors = [];
  state.ready = false;
}

async function populate(state) {
  const ticket = ++state.ticket;
  state.error = null;
  let T;
  try { T = await template(); }
  catch (e) { state.error = String(e.stack || e); return; }
  if (state.disposed || ticket !== state.ticket) return;
  clear(state);
  // Cap near actors hard (LOD already limits ships): keep all seats but share one template.
  state.actors = state.seats.map((seat) => {
    const root = cloneRig(T.root);
    root.name = 'ai-pilly-crew';
    const mixer = new THREE.AnimationMixer(root);
    state.group.add(root);
    return { seat, root, mixer, clip: '', action: null, motion: {} };
  });
  state.T = T;
  state.ready = true;
}

// Mirror crewNativeV7.move — same stations, yaw, clip roles; only the body look differs.
function move(actor, u, t) {
  const c = actor.seat, [role, sx, ph, span] = c.info;
  let x = c.o[0], y = c.o[1], z = c.o[2], yaw = 0, clip = 'idle', at = t + ph * 3;
  if (role > 2.5) clip = 'steer';
  else if (role < 0.5) {
    yaw = sx * Math.PI / 2;
    const age = t - (sx > 0 ? u.uFireP.value : u.uFireS.value) - span * u.uGap.value;
    clip = 'cannon';
    at = age >= 0 && age < 2.6 ? age : 0;
  } else if (role > 1.5) {
    const tt = t + ph * 10, v = tt % 10, cyc = Math.floor(tt / 10);
    const th = ph * Math.PI * 2 + (cyc + smooth(0, 4, v)) * 1.75;
    const face = smooth(3.9, 4.6, v) * (1 - smooth(9.2, 9.9, v));
    x += Math.cos(th) * sx; z += Math.sin(th) * sx;
    yaw = THREE.MathUtils.lerp(-th, Math.PI / 2 - th, face);
    clip = v < 4 ? 'walk' : 'idle';
  } else {
    const s = fract(t * 0.9 / Math.max(1, span * 2) + ph);
    z += span * (0.5 - Math.abs(s * 2 - 1));
    yaw = s < 0.5 ? 0 : Math.PI;
    if (span > 0) clip = 'walk';
    const A = u.uDk.value, B = u.uDk2.value;
    if (B.z > 0.5 && span >= 0) {
      const f = z < A.y ? 0.25 + (z - A.x) / A.z : 0.72 + (z - A.y) / A.w;
      const q = (f - 0.47) * 2;
      y = B.x * (0.5 + 0.5 * q * q) - B.y;
    }
  }
  const p = actor.motion;
  p.x = x; p.y = y; p.z = z; p.yaw = yaw; p.clip = clip; p.at = at;
  p.hidden = c.cap && u.uCapOff.value > 0.5;
  p.size = u.uS.value / 1.35 * (role > 1.5 && role < 2.5 ? span : 1);
  return p;
}

function pickClip(T, name) {
  const want = CLIP_MAP[name] || 'Idle';
  return T.clips[want] || T.clips.Idle || Object.values(T.clips)[0] || null;
}

function update(state, t, dt) {
  if (!state.ready || !state.T) return;
  const u = state.mesh.material.uniforms;
  for (const a of state.actors) {
    const p = move(a, u, t);
    const clip = pickClip(state.T, p.clip);
    if (clip && a.clip !== p.clip) {
      a.mixer.stopAllAction();
      a.action = a.mixer.clipAction(clip);
      a.action.play();
      a.clip = p.clip;
    }
    if (a.action && clip) {
      if (p.clip === 'cannon') a.action.time = THREE.MathUtils.clamp(p.at, 0, Math.max(0, clip.duration - 0.001));
      else a.action.time = THREE.MathUtils.euclideanModulo(p.at, Math.max(0.001, clip.duration));
      a.mixer.update(0);
    }
    const k = p.hidden ? 1e-7 : state.T.k * p.size;
    a.root.position.set(p.x, p.y - state.T.y0 * k, p.z);
    a.root.rotation.set(0, p.yaw, 0);
    a.root.scale.setScalar(k);
    a.root.visible = !p.hidden;
  }
}

function showProps(state) {
  const source = state.mesh.geometry;
  if (state.propsSource !== source || !state.props) {
    state.props?.geometry.dispose();
    state.props?.removeFromParent();
    const g = new THREE.BufferGeometry();
    for (const [n, a] of Object.entries(source.attributes)) g.setAttribute(n, a);
    const parts = source.attributes.aPart, indices = source.index.array, out = [];
    for (let i = 0; i < indices.length; i += 3) {
      if (parts.getX(indices[i]) >= 4.5 && parts.getX(indices[i + 1]) >= 4.5 && parts.getX(indices[i + 2]) >= 4.5) {
        out.push(indices[i], indices[i + 1], indices[i + 2]);
      }
    }
    g.setIndex(new THREE.BufferAttribute(new indices.constructor(out), 1));
    state.props = new THREE.Mesh(g, state.mesh.material);
    state.props.name = 'crew-wheel-and-telescope';
    state.props.onBeforeRender = (...args) => state.mesh.onBeforeRender.apply(state.mesh, args);
    state.props.frustumCulled = false;
    state.propsSource = source;
    state.group.add(state.props);
  }
  state.mesh.visible = false;
}

function register(scene) {
  if (scenes.has(scene)) return;
  scenes.add(scene);
  const previous = scene.onBeforeRender;
  let last = 0;
  scene.onBeforeRender = function (renderer, sc, camera, ...args) {
    previous?.call(this, renderer, sc, camera, ...args);
    camera.getWorldPosition(cameraP);
    frustum.setFromProjectionMatrix(viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    candidates.length = 0;
    for (const s of states) {
      if (s.disposed || s.scene !== scene) continue;
      let root = s.lod, seen = true;
      for (; root.parent; root = root.parent) if (!root.visible) seen = false;
      if (root !== scene || !seen) continue;
      s.lod.update(camera);
      s.group.getWorldPosition(worldP);
      s.distance = worldP.distanceToSquared(cameraP);
      sphere.center.copy(worldP);
      if (s.ready && s.distance < (s.low ? 24 : 36) ** 2 && frustum.intersectsSphere(sphere)) candidates.push(s);
      s.group.visible = false;
      s.mesh.material.uniforms.uNativeCrew.value = 0;
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const now = performance.now() / 1000, dt = Math.min(0.05, Math.max(0, now - last));
    last = now;
    // Same near-ship budget as canonical V7: 1 on low/phone, 2 otherwise.
    for (let i = 0; i < Math.min(candidates.length, candidates[0]?.low ? 1 : 2); i++) {
      const s = candidates[i];
      s.group.visible = true;
      s.mesh.material.uniforms.uNativeCrew.value = 1;
      showProps(s);
      update(s, s.mesh.material.uniforms.uT.value, dt);
      s.group.updateMatrixWorld(true);
    }
  };
}

export function attachAiPillyCrew(lod, mesh, seats, low) {
  if (typeof document === 'undefined') return null;
  const group = new THREE.Group();
  group.name = 'ai-pilly-deck-crew';
  group.visible = false;
  lod.add(group);
  const state = {
    group, mesh, seats, low, actors: [], ticket: 0, ready: false, disposed: false, scene: null, T: null, error: null, kind: 'ai-pilly',
  };
  state.lod = lod;
  lod.autoUpdate = false;
  states.add(state);
  group.userData.aiPillyState = state;
  group.userData.sharedGeo = true;
  group.userData.dispose = () => { state.disposed = true; state.ticket++; clear(state); states.delete(state); };
  const old = mesh.onBeforeRender;
  mesh.onBeforeRender = function (r, s, c, ...args) {
    old?.call(this, r, s, c, ...args);
    state.scene = s;
    register(s);
  };
  // Compatible with dressCrew / addLookout: wardrobe is a no-op look, but seats may have grown.
  state.setGear = (_gear, _colors) => {
    state.gear = _gear; state.colors = _colors;
    return populate(state).catch((e) => { state.error = String(e.stack || e); throw e; });
  };
  state.setGear().catch((e) => console.warn('[crew] AI Pilly preload failed — distant crew fallback', e));
  return state;
}

export const aiPillyCrewDiagnostics = () => ({
  template: _template ? { phase: _template.progress?.phase } : null,
  states: [...states].map((s) => ({
    error: s.error, ready: s.ready, ticket: s.ticket, disposed: s.disposed, actors: s.actors.length, kind: s.kind,
  })),
});
