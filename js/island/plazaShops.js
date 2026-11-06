// [Timothy] PUMPFUN PIRATES plaza v2: the five STOREFRONTS as Blender-made models (BANKSY "make it in blender now, need quality put
// detail into the shops"). Source: tools/plaza_blender/plaza_shops_blender.py -> assets/island/plaza_shops.glb (desktop: LOD0-2) and
// plaza_shops_low.glb (phones: LOD1-2), meshopt-compressed, vertex colour only (no textures). Per shop one THREE.LOD; each level is
// one mesh with <= 3 primitives (toon solid / lantern glow / display glass), so the 5 shops cost 5-10 draw calls in view.
// The building frame is the blockout's (plazaTown.js stoneHouse: centre (lx, FACADE_LZ - ROW_D / 2), front = local +z), so the
// footprints, counters, interact points and walk surfaces are unchanged. Extra prop colliders ride in the GLB (node extras).
// &shopsglb=0 = the procedural blockout shells (also the fallback if the GLB fails to load).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { softRamp } from './look.js';
import { loadHill, buildHill } from './hillStreet.js';   // [Timothy] the Blender hill street (Main Street)
import { initLib, libMaterial } from './libTex.js';      // [Timothy] the shared material library (TEXCOORD_0 = layer code, no UV maps)

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
export const SHOPS_GLB_ON = !(Q && Q.get('shopsglb') === '0');
export let SHOPS_KIT = null;                 // { low, shops: { id: { lods: [Group...], colliders: [[kind, x, z, r | w, d]] } } }
export const SHOP_PLACES = [];               // [{ id, m: Matrix4 }] filled by plazaTown.buildPlazaV2 (foot-world frame)
let _p = null;
// LOD switch distances (m): desktop LOD0 / LOD1 / LOD2, phones LOD1 / LOD2
const DIST = { high: [0, 42, 120], low: [0, 38] };

// ---- the headland battery (tools/plaza_blender/battery_blender.py -> assets/island/battery*.glb): static art (LOD0 / LOD1, battery-local
// frame: x = lx - 160, z = lz - 42, y = world) + the gun carriage and barrel (barrel origin = the trunnion pivot js/island/battery.js
// createGuns poses). &batteryglb=0 = the procedural battery art.
export let BATTERY_KIT = null;
const BATTERY_GLB_ON = !(Q && Q.get('batteryglb') === '0');
function deq(src, m) {   // quantized glTF attributes -> float geometry in the parent frame (InstancedMesh / merge friendly)
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'color', 'uv']) { const a = src.attributes[k]; if (!a) continue; const n = Math.min(a.itemSize, 3), out = new Float32Array(a.count * n);   // uv = the library layer code
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); } g.setAttribute(k, new THREE.BufferAttribute(out, n)); }
  if (src.index) g.setIndex(Array.from(src.index.array)); g.applyMatrix4(m); return g;
}
export function loadBattery(low) {   // [cannon-hill] exported for tests/cannonHillUpgrade.test.mjs
  if (!BATTERY_GLB_ON) return Promise.resolve(null);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`assets/island/battery${low ? '_low' : ''}.glb`).then(gl => {
    gl.scene.updateMatrixWorld(true); const root = gl.scene.getObjectByName('battery'), inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), rel = new THREE.Matrix4();
    const solid = libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), low); solid.name = 'battery_solid';   // paving lies 3-7 mm over the terrain
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); glow.name = 'battery_glow';   // [cannon-hill] braziers / lanterns
    const merged = (name, want = 'solid') => { const node = gl.scene.getObjectByName(name); if (!node) return null; const parts = [];
      node.traverse(mm => { if (mm.isMesh && (/glow/.test(mm.material?.name || '') ? 'glow' : 'solid') === want) { rel.multiplyMatrices(inv, mm.matrixWorld); parts.push(deq(mm.geometry, rel)); } }); if (!parts.length) return null;
      const g = parts.length > 1 ? mergeGeometries(parts, false) : parts[0]; g.computeBoundingSphere(); return g; };
    const lv = [0, 1].map(i => ({ s: merged('battery_LOD' + i), g: merged('battery_LOD' + i, 'glow') })).filter(l => l.s);
    const lods = lv.map(l => l.s), glows = lv.map(l => l.g);
    let flag = null, rocks = []; try { flag = JSON.parse(root.userData.flag); } catch (e) { /* none */ }
    try { rocks = JSON.parse(root.userData.rocks || '[]'); } catch (e) { /* none */ }   // [collisions] [lx, lz, r] per Blender boulder
    BATTERY_KIT = { low, mat: solid, glow, lods, glows, carriage: merged('gun_carriage'), barrel: merged('gun_barrel'), flag, rocks };
    return BATTERY_KIT; }).catch(e => { console.warn('[battery] Blender models failed, procedural art instead', e); return null; });
}
// the static battery art as one LOD (Low: LOD1 only), placed in foot-world by the caller
export function buildBatteryStatic(pos, yaw) {
  const K = BATTERY_KIT; if (!K || !K.lods.length) return null;
  const lod = new THREE.LOD(); lod.name = 'battery_blender'; lod.position.copy(pos); lod.rotation.y = yaw;
  K.lods.forEach((g, i) => { const m = new THREE.Mesh(g, K.mat); m.name = 'battery_static_lod' + i; m.castShadow = !K.low; m.receiveShadow = !K.low;
    if (K.glows && K.glows[i]) { const gm = new THREE.Mesh(K.glows[i], K.glow); gm.name = 'battery_glow_lod' + i; m.add(gm); }   // [cannon-hill] brazier coals + lanterns
    lod.addLevel(m, i === 0 ? 0 : 90); });
  return lod;
}

// ---- the docks (tools/plaza_blender/docks_blender.py -> assets/island/docks*.glb): boardwalk + 5 jetties (B1-B10) in ~20-26 m chunks,
// each a THREE.LOD (desktop LOD0 / LOD1, phones LOD1). Chunk frame = town-local, origin at the chunk centre (lx, lz) = extras lxlz.
// Materials = the shared library (js/island/libTex.js: planks, timber, wet pilings, iron, rope) x vertex colour. Colliders (town-local) ride in the extras.
// &docksglb=0 = the procedural boardwalk / jetties.
export let DOCKS_KIT = null;                  // { low, chunks: [{ name, lx, lz, lods: [Group], colliders }] }
export const DOCK_PLACES = [];                // [{ i, m: Matrix4 }] filled by plazaTown.buildPlazaV2
const DOCKS_GLB_ON = !(Q && Q.get('docksglb') === '0');
function loadDocks(low) {
  if (!DOCKS_GLB_ON) return Promise.resolve(null);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`assets/island/docks${low ? '_low' : ''}.glb`).then(gl => {
    const wood = libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp() }), low); wood.name = 'dock_wood';   // planks / beams / pilings: library x vertex colour (no plank photo)
    const solid = libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), low); solid.name = 'dock_solid';
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); glow.name = 'dock_glow';
    const pick = (m) => /wood/.test(m.name) ? wood : /glow/.test(m.name) ? glow : solid;
    gl.scene.updateMatrixWorld(true); const inv = new THREE.Matrix4(), rel = new THREE.Matrix4(), chunks = [];
    gl.scene.traverse(o => { if (!/^dock_[a-zA-Z0-9]+$/.test(o.name) || o.isMesh) return; inv.copy(o.matrixWorld).invert(); const lods = [];
      for (const c of o.children) { const lv = +(/_LOD(\d)$/.exec(c.name) || [])[1]; if (isNaN(lv)) continue; const g = new THREE.Group(); g.name = c.name;
        c.traverse(mm => { if (!mm.isMesh) return; const mesh = new THREE.Mesh(mm.geometry, pick(mm.material)); rel.multiplyMatrices(inv, mm.matrixWorld).decompose(mesh.position, mesh.quaternion, mesh.scale);
          mesh.name = c.name + '_' + mesh.material.name.replace('dock_', ''); mesh.castShadow = !low && mesh.material !== glow; mesh.receiveShadow = !low; g.add(mesh); });
        lods[low ? lv - 1 : lv] = g; }
      let cols = [], lxlz = [0, 0]; try { cols = JSON.parse(o.userData.colliders || '[]'); lxlz = JSON.parse(o.userData.lxlz); } catch (e) { /* none */ }
      chunks.push({ name: o.name, lx: lxlz[0], lz: lxlz[1], lods: lods.filter(Boolean), colliders: cols }); });
    DOCKS_KIT = { low, chunks, mats: { wood, solid, glow } }; return DOCKS_KIT;
  }).catch(e => { console.warn('[docks] Blender models failed, procedural docks instead', e); return null; });
}

export function plazaShopsReady(low, renderer = null) {
  const bat = Promise.all([loadBattery(low), (Q && /^[01]$/.test(Q.get('plaza') || '')) ? null : loadDocks(low), initLib(low, renderer)]);   // [Timothy] + the material library (KTX2 array)
  if (!SHOPS_GLB_ON || (Q && /^[01]$/.test(Q.get('plaza') || ''))) return bat.then(() => null);   // ?plaza=1/0 = the old v103 plaza
  if (_p) return _p;
  const url = `assets/island/plaza_shops${low ? '_low' : ''}.glb`;
  _p = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url).then(gl => {
    const solid = libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp() }), low); solid.name = 'plaza_shops_solid';
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); glow.name = 'plaza_shops_glow';
    const glass = new THREE.MeshBasicMaterial({ color: 0xd8eef6, transparent: true, opacity: 0.22, depthWrite: false }); glass.name = 'plaza_shops_glass';
    const pick = (m) => /glow/.test(m.name) ? glow : /glass/.test(m.name) ? glass : solid;
    const shops = {};
    gl.scene.updateMatrixWorld(true); const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
    gl.scene.traverse(o => { if (!/^(shop|house)_[a-z]+$/.test(o.name) || o.isMesh) return; inv.copy(o.matrixWorld).invert();
      const ex = o.userData || {}, lods = [];
      for (const c of o.children) { const lv = +(/_LOD(\d)$/.exec(c.name) || [])[1]; if (isNaN(lv)) continue;
        const g = new THREE.Group(); g.name = c.name;
        c.traverse(mm => { if (!mm.isMesh) return; const mesh = new THREE.Mesh(mm.geometry, pick(mm.material)); rel.multiplyMatrices(inv, mm.matrixWorld).decompose(mesh.position, mesh.quaternion, mesh.scale); mesh.name = c.name + '_' + mesh.material.name.replace('plaza_shops_', '');
          mesh.castShadow = !low && mesh.material === solid; mesh.receiveShadow = !low && mesh.material === solid; if (mesh.material === glass) mesh.renderOrder = 2; g.add(mesh); });
        lods[low ? lv - 1 : lv] = g; }
      let cols = []; try { cols = JSON.parse(ex.colliders || '[]'); } catch (e) { /* none */ }
      shops[o.name] = { lods: lods.filter(Boolean), colliders: cols }; });
    SHOPS_KIT = { low, shops, url };
    return SHOPS_KIT;
  }).catch(e => { console.warn('[plaza] shop models failed, blockout shells instead', e); SHOPS_KIT = null; return null; });
  _p = Promise.all([_p, bat, loadHill(low)]).then(([s]) => s);   // [Timothy] + the hill street (only with the Blender plaza: buildPlazaShops places it)
  return _p;
}

// one THREE.LOD per storefront placed by SHOP_PLACES (call after buildPlazaV2)
export function buildPlazaShops() {
  const hill = buildHill();   // [Timothy] the hill street buildings (null = the colonial houses)
  if ((!SHOPS_KIT || !SHOP_PLACES.length) && !DOCK_PLACES.length) return hill;
  const root = new THREE.Group(); root.name = 'plaza_v2_shops'; const d = SHOPS_KIT.low ? DIST.low : DIST.high; let tris = 0; if (hill) root.add(hill);
  for (const { id, m } of SHOPS_KIT ? SHOP_PLACES : []) { const s = SHOPS_KIT.shops[id]; if (!s) continue;
    const lod = new THREE.LOD(); lod.name = 'plaza_' + id; m.decompose(lod.position, lod.quaternion, lod.scale);
    s.lods.forEach((g, i) => { lod.addLevel(g, d[i] ?? d[d.length - 1] + 80 * i); });
    s.lods[0].traverse(o => { if (o.isMesh) tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
    root.add(lod); }
  if (DOCKS_KIT) { const dd = DOCKS_KIT.low ? [0] : [0, 70];
    for (const { i, m } of DOCK_PLACES) { const c = DOCKS_KIT.chunks[i], lod = new THREE.LOD(); lod.name = 'plaza_' + c.name; m.decompose(lod.position, lod.quaternion, lod.scale);
      c.lods.forEach((g, k) => lod.addLevel(g, dd[k] ?? 70 * k)); root.add(lod); } }
  root.userData.tris = tris;
  return root;
}
