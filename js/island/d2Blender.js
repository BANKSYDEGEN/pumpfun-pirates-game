// [Timothy] PUMPFUN PIRATES D2 JUNGLE RUINS, Blender visuals (island grid cell D2; BANKSY via Emerly 11:47 PM): Post's jungle area
// (js/island/areas/jungle.js) keeps EVERYTHING it registers (colliders, the temple pad, the Ruin Steps cuts, the paved jungle_trail, walk
// heights, interact points) and every animated / stateful piece it builds (swinging log, darts, crumbling tiles, chests, idol shards, journal
// pages, the fire flame). Only its static kit mesh (the first child of build().near, and of build().far) is swapped for the Blender model
// (tools/d2_blender/d2_blender.py -> assets/island/d2_jungle.glb desktop LOD0 / d2_jungle_low.glb phones LOD1, shared material library),
// laid on the same anchors (tools/d2_blender/d2_layout.json = foot.H at every anchor). Old Mossbeard is rebuilt with Post's own npc() kit.
// Hook: js/island/libTex.js libAreaBuilt('jungle_ruins') (called by areas/index.js for every area build): NO Post file is changed.
// &d2glb=0 (or a failed load, or ground moved by build mode > 1 cm under an anchor) = Post's version exactly.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { softRamp } from './look.js';
import { libMaterial } from './libTex.js';
import { Kit, M, npc } from './areas/common.js';
import { JUNGLE_TRAILHEAD as TH } from './digSpots.js';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
export const D2GLB_ON = !(Q && Q.get('d2glb') === '0');
export const D2_STATS = { loaded: false, swapped: 0, tris: 0, bytes: 0 };
let P = null;
function load(low) {
  if (P) return P;
  const solid = libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), low); solid.name = 'd2_solid';   // treads + flagstones 8 mm over the walk
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); glow.name = 'd2_glow';
  const url = `assets/island/d2_jungle${low ? '_low' : ''}.glb`;
  P = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url).then(gl => {
    gl.scene.updateMatrixWorld(true); const near = new THREE.Group(), far = new THREE.Group(); near.name = 'd2_blender'; far.name = 'd2_blender_far';
    let hchk = []; gl.scene.traverse(o => { if (o.userData && o.userData.hchk) try { hchk = JSON.parse(o.userData.hchk); } catch (e) { /* none */ } });
    gl.scene.traverse(o => { if (!o.isMesh) return; const nm = o.name + ' ' + (o.parent ? o.parent.name : ''); if (!(low ? /_LOD1|_FAR/ : /_LOD0|_FAR/).test(nm)) return;
      const m = new THREE.Mesh(o.geometry, /glow/.test(o.material.name) ? glow : solid); o.matrixWorld.decompose(m.position, m.quaternion, m.scale); m.name = o.name;
      m.castShadow = !low && m.material === solid; m.receiveShadow = !low && m.material === solid;
      (/_FAR/.test(nm) ? far : near).add(m); if (!/_FAR/.test(nm)) D2_STATS.tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
    if (low) {   // phones: the chunks merged into one mesh per material (1 draw call for the whole cell, like the hill street)
      const by = new Map(); for (const m of [...near.children]) { m.updateMatrix(); const g = m.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k);
        for (const k of ['position', 'normal', 'color', 'uv']) { const a = g.attributes[k]; if (a && (a.normalized || !(a.array instanceof Float32Array))) { const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a.getComponent(i, j); g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); } }
        if (g.attributes.color && g.attributes.color.itemSize === 4) { const a = g.attributes.color, f = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); } g.setAttribute('color', new THREE.BufferAttribute(f, 3)); }
        g.applyMatrix4(m.matrix); if (!by.has(m.material)) by.set(m.material, []); by.get(m.material).push(g); near.remove(m); }
      for (const [mat, list] of by) { const g = mergeGeometries(list, false); list.forEach(q => q.dispose()); if (!g) continue; g.computeBoundingSphere(); const mm = new THREE.Mesh(g, mat); mm.name = 'd2_merged_' + mat.name; near.add(mm); } }
    D2_STATS.loaded = true; return { near, far, hchk }; })
    .catch(e => { console.warn('[d2] Blender jungle ruins failed, Post\'s kit instead', e); return null; });
  return P;
}
// Old Mossbeard exactly as jungle.js builds him (pose + colours), on his own small kit mesh
function mossbeard(ctx) {
  const k = new Kit(), x = TH.x + 2.5, z = TH.z + 5.5;
  k.at(M(x, ctx.H(x, z), z, Math.PI * 0.7), () => npc(k, { shirt: 0x4a7a3a, pants: 0x5a4a32, beard: 0x8fae6a, hat: 'tricorn', hatC: 0x3a5a2a, prop: 'staff' }));
  const g = k.build(ctx.MATS, ctx.OUT); g.name = 'd2_mossbeard'; return g;
}
const drop = (grp, o) => { if (!o) return; grp.remove(o); o.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); };
export function d2Built(built, ctx) {
  if (!D2GLB_ON || !built || !built.near || !ctx) return;
  const postNear = built.near.children[0], postFar = built.far ? built.far.children[0] : null;   // jungle.js build(): near.add(k.build()) / far.add(kf.build()) come first
  load(ctx.low).then(K => { if (!K) return;
    // the model is baked on the ground as it was (tools/d2_blender/d2_layout.json): if the owner's build mode (terrainEdit.js) has moved the
    // ground under any step / floor / prop anchor by more than 1 cm, keep Post's kit (it is built on the live ground) until the model is rebaked
    let worst = 0; for (const [x, z, y] of K.hchk) worst = Math.max(worst, Math.abs(ctx.H(x, z) - y)); D2_STATS.groundDrift = +worst.toFixed(4);
    if (worst > 0.01) { D2_STATS.skipped = 'ground moved ' + (worst * 100).toFixed(1) + ' cm'; console.warn('[d2] ground moved since the Blender bake, Post\'s kit kept', worst); return; }
    drop(built.near, postNear); drop(built.far, postFar);
    built.near.add(K.near.clone(), mossbeard(ctx)); if (built.far) built.far.add(K.far.clone());
    D2_STATS.swapped++; });
}
