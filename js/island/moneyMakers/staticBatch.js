// Batch only immutable opaque decoration, per building and exact material/render state.
// Dynamic posters, the animated gong, transparency, and existing instances stay intact.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export function batchShopFront(root) {
  if (!root || root.userData.staticBatched) return;
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert(), buckets = new Map(), originals = [];
  const gong = root.userData.gong;
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible || o === gong || o.userData.part === 'bounty_poster') return;
    const m = o.material, g = o.geometry;
    if (!m || Array.isArray(m) || m.transparent || m.opacity !== 1 || m.wireframe || g.morphAttributes.position?.length || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    const attrs = Object.keys(g.attributes).sort().map(k => k + ':' + g.attributes[k].itemSize + ':' + g.attributes[k].normalized).join(',');
    const key = m.uuid + '/' + o.castShadow + '/' + o.receiveShadow + '/' + o.renderOrder + '/' + o.layers.mask + '/' + attrs;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const copies = list.map(o => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); return g; });
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
