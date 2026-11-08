// Batch only immutable opaque decoration, per building and exact material/render state.
// Dynamic posters, the animated gong, transparency, and existing instances stay intact.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export function batchShopFront(root) {
  if (!root || root.userData.staticBatched) return;
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert(), buckets = new Map(), originals = [];
  // Preserve animated/visibility-controlled subtrees referenced by each prop's API.
  const protectedTrees = new Set();
  for (const v of Object.values(root.userData)) {
    if (v?.isObject3D) protectedTrees.add(v);
    else if (Array.isArray(v)) for (const o of v) if (o?.isObject3D) protectedTrees.add(o);
  }
  const visit = o => {
    if (o !== root && (!o.visible || o.isLOD || o.userData.batchDynamic || protectedTrees.has(o))) return;
    if (!o.isMesh) { for (const c of o.children) visit(c); return; }
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible || o.userData.part === 'bounty_poster') return;
    const m = o.material, g = o.geometry;
    if (!m || Array.isArray(m) || m.transparent || m.opacity !== 1 || m.wireframe || g.morphAttributes.position?.length || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    const attrs = Object.keys(g.attributes).sort().map(k => k + ':' + g.attributes[k].itemSize + ':' + g.attributes[k].normalized).join(',');
    const key = m.uuid + '/' + o.castShadow + '/' + o.receiveShadow + '/' + o.renderOrder + '/' + o.layers.mask + '/' + !!g.index + '/' + attrs;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  };
  visit(root);
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const copies = list.map(o => { const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); return g; });
    const geometry = mergeGeometries(copies, false); copies.forEach(g => g.dispose()); if (!geometry) continue;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const first = list[0], mesh = new THREE.Mesh(geometry, first.material);
    mesh.name = 'mm_static_batch'; mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow; mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask;
    root.add(mesh); originals.push(...list);
  }
  const candidates = new Set(originals.map(o => o.geometry));
  originals.forEach(o => o.removeFromParent());
  // A geometry can still belong to an unbatched instance or dynamic mesh.
  root.traverse(o => { if (o.geometry) candidates.delete(o.geometry); });
  candidates.forEach(g => g.dispose());
  root.userData.staticBatched = true;
}
