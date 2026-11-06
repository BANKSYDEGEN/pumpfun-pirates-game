// [Emerly perf-v304] BANKSY 6:22 PM: "Ok now optimize for mobile and pc". Runtime opts for BOTH.
// Kill switch: &opt=0 restores previous behaviour (no freeze / no mixer throttle / no extra merges).
import * as THREE from 'three';
import { mergeInto } from './staticMerge.js';

export const OPT_ON = !(typeof location !== 'undefined' && /[?&]opt=0(&|$)/.test(location.search));

let _cam = null, _camPos = new THREE.Vector3(), _camT = -1;
export function setOptCamera(cam) { _cam = cam || null; }
export function optCamPos(now = performance.now()) {
  if (!_cam) return null;
  if (now - _camT > 80) { _cam.getWorldPosition(_camPos); _camT = now; }
  return _camPos;
}

// Same static on-foot roots as js/staticMerge.js STATIC_ROOT — NEVER freeze the whole scene (ocean/sky/sun/fx stay live).
export const STATIC_ROOT = /^(foot|hill_street|battle_areas)$/;
const LIVE_NAME = /pirate|crew|pet|ship|sail|flag|flame|wake|ball|fx|handle|trolley|zip-handle|lantern_flame|sway/i;

// Freeze static Object3D matrices under a known-safe root. Skips lights/cameras/scene, skinned/instanced/LOD,
// ships/pirates, anything tagged live / tedit / terrainEdit, and LIVE_NAME matches.
export function freezeStatic(root, { force = false } = {}) {
  if (!OPT_ON && !force) return 0;
  if (!root || root.isScene || root.isCamera || root.isLight) return 0;
  root.updateMatrixWorld(true);
  let n = 0;
  root.traverse((o) => {
    if (o.isScene || o.isCamera || o.isLight) return;
    if (o.userData?.live || o.userData?.noFreeze || o.userData?.tedit || o.userData?.terrainEdit) return;
    if (o.isSkinnedMesh || o.isInstancedMesh || o.isLOD) return;
    if (o.userData?.isShip || o.userData?.v4 || o.userData?.shadowProxy) return;
    if (LIVE_NAME.test(o.name || '')) return;
    for (let p = o.parent; p; p = p.parent) {
      if (p.userData?.live || p.userData?.isShip || p.userData?.tedit || LIVE_NAME.test(p.name || '')) return;
    }
    if (o.matrixAutoUpdate) { o.updateMatrix(); o.matrixAutoUpdate = false; n++; }
  });
  return n;
}

// Only freeze children under known static on-foot world roots (foot / hill_street / battle_areas).
export function freezeStaticWorlds(scene) {
  if (!OPT_ON || !scene) return 0;
  let n = 0; const roots = [];
  scene.traverse((o) => { if (STATIC_ROOT.test(o.name || '')) roots.push(o); });
  for (const r of roots) n += freezeStatic(r);
  return n;
}

// Merge same-material static meshes under a host (zipline stations, etc.)
export function mergeStaticGroup(host) {
  if (!OPT_ON || !host) return 0;
  const list = [];
  host.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) return;
    if (o.userData?.live || o.userData?.noMerge) return;
    list.push(o);
  });
  if (list.length < 2) return 0;
  return mergeInto(host, list, () => '', { ignoreGroups: true }); // [v330 perf] Box / Cylinder parts carry geometry groups: they never merged (zipline stations were ~120 draw calls)
}

// Animation LOD: full / half / quarter rate by distance to camera (squared metres).
export function animStep(pirateGLB, dt) {
  if (!OPT_ON || !pirateGLB) return dt;
  const root = pirateGLB.root; if (!root?.visible) return 0;
  const cam = optCamPos(); if (!cam) return dt;
  const p = root.getWorldPosition(_tmp);
  const d2 = cam.distanceToSquared(p);
  const st = pirateGLB._opt || (pirateGLB._opt = { acc: 0, n: 0 });
  st.n++;
  if (d2 > 14400) return 0;
  if (d2 > 4900) { if (st.n & 3) return 0; return dt * 4; }
  if (d2 > 784) { if (st.n & 1) return 0; return dt * 2; }
  return dt;
}
const _tmp = new THREE.Vector3();

export function trimAccessoryShadows(root) {
  if (!OPT_ON || !root) return 0;
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.castShadow || o.isSkinnedMesh) return;
    const nm = (o.name || '') + (o.parent?.name || '');
    if (/item_|sword|musket|hook|peg|hat|parrot|eye|gear_|acc_/i.test(nm) || (o.geometry?.boundingSphere && o.geometry.boundingSphere.radius < 0.35)) {
      o.castShadow = false; n++;
    }
  });
  return n;
}
