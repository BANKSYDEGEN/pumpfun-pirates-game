// [Raul] PUMPFUN PIRATES island: the Blender town kit (tools/island/town_kit_blender.py -> assets/island/town_kit*.glb).
// Hero assets: 6 colonial house variants + the Squad Hall, harbor pier stem / T-head modules, barrels, crates, sacks,
// lamps, torches, chests, bollards. One shared trim sheet (albedo, A = emissive mask; normal map on High), contact AO baked
// into vertex colours. Placements from the street / pier builders are MERGED into one mesh per group, so the whole kit
// costs one draw call (+ shadow) wherever it is used. Low: LOD1 meshes, 1024 albedo, no normal map.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { softRamp } from './look.js';

function toFloat(src, m) { // quantized glTF attributes -> plain float geometry in the node's frame
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'color']) { const a = src.attributes[k]; if (!a) continue; const n = a.itemSize, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); if (n > 1) out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); if (n > 3) out[i * n + 3] = a.getW(i); }
    g.setAttribute(k, new THREE.BufferAttribute(out, k === 'color' ? Math.min(n, 4) : n)); }
  if (g.attributes.color && g.attributes.color.itemSize === 4) { const c = g.attributes.color, o = new Float32Array(c.count * 3); for (let i = 0; i < c.count; i++) { o[i * 3] = c.getX(i); o[i * 3 + 1] = c.getY(i); o[i * 3 + 2] = c.getZ(i); } g.setAttribute('color', new THREE.BufferAttribute(o, 3)); }
  if (src.index) g.setIndex(Array.from(src.index.array)); g.applyMatrix4(m); return g;
}
let _kit = null;
export async function loadTownKit(low) {
  if (_kit) return _kit;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), url = `assets/island/town_kit${low ? '_low' : ''}.glb`;
  const gl = await loader.loadAsync(url); gl.scene.updateMatrixWorld(true);
  const geos = {}; let map = null, normalMap = null;
  gl.scene.traverse(o => { if (!o.isMesh) return; const nm = o.name.replace(/_LOD[01]$/, ''), lod = /_LOD1$/.test(o.name) ? 1 : 0;
    if (lod === (low ? 1 : 0)) geos[nm] = toFloat(o.geometry, o.matrixWorld);
    map = map || o.material.map; normalMap = normalMap || o.material.normalMap; });
  if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = low ? 2 : 8; }
  const mat = new THREE.MeshToonMaterial({ map, normalMap: low ? null : normalMap, vertexColors: true, gradientMap: softRamp() });
  if (mat.normalMap) mat.normalScale.set(1, 1);
  mat.onBeforeCompile = (s) => { // A channel of the trim albedo = emissive mask (lit windows, lantern glass)
    s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef USE_MAP
      { float em = 1.0 - texture2D(map, vMapUv).a; totalEmissiveRadiance += diffuseColor.rgb * em * 1.35; }
      #endif`).replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a = opacity;');
  };
  mat.customProgramCacheKey = () => 'townkit_' + (low ? 'l' : 'h');
  const bytes = (map ? map.image.width * map.image.height * 4 * 1.33 : 0) + (mat.normalMap ? normalMap.image.width * normalMap.image.height * 4 * 1.33 : 0);
  return (_kit = { geos, mat, low, url, texBytes: Math.round(bytes), names: Object.keys(geos) });
}
// placements: [[name, Matrix4], ...] -> one merged mesh (one draw call)
export function kitMesh(kit, list, name = 'townkit') {
  const parts = []; for (const [nm, m] of list) { const g = kit.geos[nm]; if (!g) continue; parts.push(g.clone().applyMatrix4(m)); }
  if (!parts.length) return null;
  const g = mergeGeometries(parts, false); parts.forEach(p => p.dispose()); g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, kit.mat); mesh.name = name; mesh.castShadow = !kit.low; mesh.receiveShadow = !kit.low; mesh.userData.tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  return mesh;
}
// house variants: [width, floors] (depth 9 m; the Squad Hall 16 x 14)
export const HOUSE_VARIANTS = [[7, 2], [9, 2], [11, 3], [7, 3], [9, 3], [11, 2]];
export function pickHouse(w, fl, seed) { let best = 0, bd = 1e9; HOUSE_VARIANTS.forEach(([vw, vf], i) => { const d = Math.abs(vw - w) + (vf === fl ? 0 : 50) + (i === seed % 6 ? -0.5 : 0); if (d < bd) { bd = d; best = i; } }); return best; }
