// Actual visible lower-ship bounds, not the design beam (prestige cabins can be wider).
// Cache per rebuilt mesh; ignore bob/roll and upper sails/rigging when measuring.
import { Matrix4, Vector3 } from 'three';
const cache = new WeakMap();
export const PARK_GAP = 2;
export function hullHalfBeam(s) {
  const mesh = s.mesh, u = mesh?.userData || {};
  if (!mesh || !u.body) return (u.beam || 5.4) / 2;
  if (cache.has(mesh)) return cache.get(mesh);
  const body = u.body, scale = Math.abs(mesh.scale.x), ceiling = (u.deckY || 3) / scale + (u.depth || 3) / scale * 0.7;
  body.updateWorldMatrix(true, true);
  const inv = body.matrixWorld.clone().invert(), mat = new Matrix4(), v = new Vector3();
  let half = (u.beam || 5.4) / 2;
  body.traverseVisible(o => {
    const pos = o.geometry?.attributes?.position; if (!pos || !o.isMesh || o.userData.waterMask) return;
    mat.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mat);
      if (v.y <= ceiling) half = Math.max(half, Math.abs(v.x) * scale);
    }
  });
  cache.set(mesh, half); return half;
}
export function parkedPose(s, b) {
  if (!b.edge || !b.away) return b;
  const n = b.away, distance = (b.x-b.edge.x)*n.x + (b.z-b.edge.z)*n.z;
  const extra = Math.max(0, hullHalfBeam(s) + PARK_GAP - distance);
  return { x: b.x + n.x*extra, z: b.z + n.z*extra, yaw: b.yaw };
}
