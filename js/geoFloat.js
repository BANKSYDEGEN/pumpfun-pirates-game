// [asset-diet] t2514u: meshopt + KHR_mesh_quantization keep Int16 / Uint8 (normalized) attributes.
// mergeGeometries and applyMatrix4 need dequantized Float32 first — same idea as js/island/hillStreet.js floatify.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function floatify(geo) {
  if (!geo?.attributes) return geo;
  for (const k of Object.keys(geo.attributes)) {
    const a = geo.attributes[k];
    if (!a) continue;
    if (a.normalized || !(a.array instanceof Float32Array) || a.isInterleavedBufferAttribute) {
      const f = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a.getComponent(i, j);
      geo.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
    }
  }
  const col = geo.attributes.color;
  if (col && col.itemSize === 4) {
    const f = new Float32Array(col.count * 3);
    for (let i = 0; i < col.count; i++) { f[i * 3] = col.getX(i); f[i * 3 + 1] = col.getY(i); f[i * 3 + 2] = col.getZ(i); }
    geo.setAttribute('color', new THREE.BufferAttribute(f, 3));
  }
  return geo;
}

export function mergeSafe(list, useGroups = false) {
  if (!list?.length) return null;
  for (const g of list) floatify(g);
  try { return mergeGeometries(list, useGroups); } catch { return null; }
}
