// [Timothy hill-shopfronts] node-side loader for the REAL Blender hill-street lots (assets/island/hill_street.glb, LOD0), used by the shop-front
// clearance tests: returns { key: { tris: Float32Array (lot frame: x along the street, y up, +z out of the front), colliders } }.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three-0.165.0/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/three-0.165.0/examples/jsm/libs/meshopt_decoder.module.js';
import { readFileSync } from 'node:fs';
export async function loadHillLots(keys) {
  const buf = readFileSync(new URL('../../assets/island/hill_street.glb', import.meta.url));
  await MeshoptDecoder.ready;
  const gl = await new Promise((res, rej) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
  gl.scene.updateMatrixWorld(true); const out = {};
  gl.scene.traverse(o => { const m = /^hill_([LR]\d+)$/.exec(o.name); if (!m || o.isMesh || !keys.includes(m[1])) return;
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), rel = new THREE.Matrix4(), v = new THREE.Vector3(), tris = [];
    for (const c of o.children) { if (!/_LOD0$/.test(c.name)) continue;
      c.traverse(mm => { if (!mm.isMesh) return; rel.multiplyMatrices(inv, mm.matrixWorld); const g = mm.geometry, p = g.attributes.position, ix = g.index;
        const n = ix ? ix.count : p.count; for (let i = 0; i < n; i++) { v.fromBufferAttribute(p, ix ? ix.getX(i) : i).applyMatrix4(rel); tris.push(v.x, v.y, v.z); } }); }
    let colliders = []; try { colliders = JSON.parse(o.userData?.colliders || '[]'); } catch {}
    out[m[1]] = { tris: new Float32Array(tris), colliders }; });
  return out;
}
