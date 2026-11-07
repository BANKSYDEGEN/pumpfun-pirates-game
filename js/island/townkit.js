// [Raul] PUMPFUN PIRATES island: the Blender town kit (tools/island/town_kit_blender.py -> assets/island/town_kit*.glb).
// Hero assets: 6 colonial house variants + the Squad Hall, harbor pier stem / T-head modules, barrels, crates, sacks,
// lamps, torches, chests, bollards. One shared trim sheet (albedo, A = emissive mask; normal map on High), contact AO baked
// into vertex colours. Placements from the street / pier builders are MERGED into one mesh per group, so the whole kit
// costs one draw call (+ shadow) wherever it is used. Low: LOD1 meshes, 1024 albedo, no normal map.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { softRamp } from './look.js';
import { initLib, libMaterial } from './libTex.js';
import { TOWN_SURFACE_RULES } from './sharedSurfaceData.js';

function toFloat(src, m) { // quantized glTF attributes -> plain float geometry in the node's frame
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'color']) { const a = src.attributes[k]; if (!a) continue; const n = a.itemSize, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); if (n > 1) out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); if (n > 3) out[i * n + 3] = a.getW(i); }
    g.setAttribute(k, new THREE.BufferAttribute(out, k === 'color' ? Math.min(n, 4) : n)); }
  if (g.attributes.color && g.attributes.color.itemSize === 4) { const c = g.attributes.color, o = new Float32Array(c.count * 3); for (let i = 0; i < c.count; i++) { o[i * 3] = c.getX(i); o[i * 3 + 1] = c.getY(i); o[i * 3 + 2] = c.getZ(i); } g.setAttribute('color', new THREE.BufferAttribute(o, 3)); }
  if (src.index) g.setIndex(Array.from(src.index.array)); g.applyMatrix4(m); return g;
}
// KTX2 (Basis) textures: transcoded to the GPU's compressed format (BC / ETC / ASTC); falls back to the webp twin files
let _ktx = null;
// [perf2] ONE KTX2 loader (one basis worker pool + one transcoder compile) for the town kits AND the material library (was two pools of 4 workers); phones use 2 workers
export function sharedKTX2(renderer) { if (!_ktx) { _ktx = new KTX2Loader().setTranscoderPath(new URL('../../vendor/three-0.165.0/examples/jsm/libs/basis/', import.meta.url).href) /* [security M4] self-hosted */;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches) _ktx.setWorkerLimit(2); _ktx.detectSupport(renderer); } return _ktx; }
function gltfLoader(renderer) { const l = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  if (renderer) l.setKTX2Loader(sharedKTX2(renderer));
  return l; }
async function loadKit(name, low, renderer) {
  const base = `assets/island/${name}${low ? '_low' : ''}`;
  try { if (!renderer) throw 0; const gl = await gltfLoader(renderer).loadAsync(base + '.glb'); gl.userData.ktx2 = true; gl.userData.url = base + '.glb'; return gl; }
  catch (e) { if (e) console.warn('kit ktx2 failed, webp fallback', e); const gl = await gltfLoader(null).loadAsync(base + '.webp.glb'); gl.userData.url = base + '.webp.glb'; return gl; }
}
// GPU bytes of a texture (compressed mip chain when KTX2, else RGBA8 + mips)
export function texBytes(t) { if (!t) return 0; if (t.isCompressedTexture && t.mipmaps && t.mipmaps.length) return t.mipmaps.reduce((s, m) => s + (m.data ? m.data.byteLength : 0), 0);
  const im = t.image || {}; return Math.round((im.width || 0) * (im.height || 0) * 4 * 1.33); }
let _kit = null;
// [v330 perf] one in-flight load per kit: js/dock/index.js starts the downloads before the island module is even imported, and
// js/dock/world.js awaits the same promise (no second copy). A failed load is forgotten so a later call can retry.
let _kitP = null, _natP = null;
export function loadTownKit(low, renderer = null) {
  if (_kit) return Promise.resolve(_kit);
  if (!_kitP) { _kitP = loadTownKit0(low, renderer); _kitP.catch(() => { _kitP = null; }); }
  return _kitP;
}
export function loadNatureKit(low, renderer = null) {
  if (_nat) return Promise.resolve(_nat);
  if (!_natP) { _natP = loadNatureKit0(low, renderer); _natP.catch(() => { _natP = null; }); }
  return _natP;
}
// Town fixtures retain their small unique sheet. Walls / roofs / docks / props
// share the same library codes as the plaza and hill street (no second trim set).
export function remapTownGeometry(g) {
  const uv = g.attributes.uv; if (!uv) return g;
  const original = new Float32Array(uv.count * 2), fixture = new Float32Array(uv.count * 2), done = new Uint8Array(uv.count);
  for (let i = 0; i < uv.count; i++) { original[i * 2] = uv.getX(i); original[i * 2 + 1] = uv.getY(i); }
  let color = g.attributes.color;
  if (!color) { color = new THREE.Float32BufferAttribute(new Float32Array(uv.count * 3).fill(1), 3); g.setAttribute('color', color); }
  const count = g.index?.count || uv.count;
  for (let t = 0; t + 2 < count; t += 3) {
    const ix = [0, 1, 2].map(k => g.index ? g.index.getX(t + k) : t + k);
    const u = ix.reduce((a, i) => a + original[i * 2], 0) / 3, v = ix.reduce((a, i) => a + original[i * 2 + 1], 0) / 3;
    const rule = TOWN_SURFACE_RULES.find(r => v >= r.rect[1] - 0.0002 && v <= r.rect[3] + 0.0002 &&
      (r.rect[1] < 0.85 || (u >= r.rect[0] && u <= r.rect[2])));
    for (const i of ix) {
      if (done[i]) continue; done[i] = 1;
      fixture[i * 2] = original[i * 2]; fixture[i * 2 + 1] = (original[i * 2 + 1] - 1760 / 2048) / (288 / 2048);
      uv.setXY(i, ((rule?.layer || 0) * 2 + 0.5) / 32, 0);
      if (rule) color.setXYZ(i, color.getX(i) * rule.tint[0], color.getY(i) * rule.tint[1], color.getZ(i) * rule.tint[2]);
    }
  }
  g.setAttribute('aFixtureUv', new THREE.BufferAttribute(fixture, 2));
  return g;
}
async function loadTownKit0(low, renderer = null) {
  if (_kit) return _kit;
  const url = `assets/island/town_shared${low ? '_low' : ''}.glb`;
  const [gl, fixtures] = await Promise.all([
    gltfLoader(null).loadAsync(url),
    new THREE.TextureLoader().loadAsync('assets/island/tex/town_fixtures.webp'),
    initLib(low, renderer),
  ]);
  gl.scene.updateMatrixWorld(true);
  const geos = {}, geos1 = {};
  gl.scene.traverse(o => { if (!o.isMesh) return; const nm = o.name.replace(/_LOD[01]$/, ''), lod = /_LOD1$/.test(o.name) ? 1 : 0;
    if (lod === (low ? 1 : 0)) geos[nm] = remapTownGeometry(toFloat(o.geometry, o.matrixWorld));
    if (lod === 1) geos1[nm] = geos[nm] || remapTownGeometry(toFloat(o.geometry, o.matrixWorld)); });
  fixtures.colorSpace = THREE.SRGBColorSpace; fixtures.flipY = false; fixtures.anisotropy = low ? 2 : 4;
  const mat = new THREE.MeshToonMaterial({ map: fixtures, vertexColors: true, gradientMap: softRamp() });
  mat.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aFixtureUv; varying vec2 vFixtureUv; varying float vTownLayer;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFixtureUv = aFixtureUv; vTownLayer = floor(floor(uv.x * 32.0) * 0.5);');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFixtureUv; varying float vTownLayer;')
      .replace('#include <map_fragment>', 'if (vTownLayer < 0.5) { diffuseColor.rgb *= texture2D(map, vFixtureUv).rgb; }')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (vTownLayer < 0.5) totalEmissiveRadiance += diffuseColor.rgb * (1.0 - texture2D(map, vFixtureUv).a) * 1.35;');
  };
  mat.customProgramCacheKey = () => 'town_shared_v1'; libMaterial(mat, low);
  return (_kit = { geos, geos1, mat, low, url, ktx2: true, texBytes: texBytes(fixtures), names: Object.keys(geos) });
}
// placements: [[name, Matrix4], ...] -> one merged mesh (one draw call)
export function kitMesh(kit, list, name = 'townkit', lod1 = false) {
  const parts = []; for (const [nm, m] of list) { const g = (lod1 ? kit.geos1 : kit.geos)[nm]; if (!g) continue; parts.push(g.clone().applyMatrix4(m)); }
  if (!parts.length) return null;
  const g = mergeGeometries(parts, false); parts.forEach(p => p.dispose()); g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, kit.mat); mesh.name = name; mesh.castShadow = !kit.low; mesh.receiveShadow = !kit.low; mesh.userData.tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  return mesh;
}
// house variants: [width, floors] (depth 9 m; the Squad Hall 16 x 14)
export const HOUSE_VARIANTS = [[7, 2], [9, 2], [11, 3], [7, 3], [9, 3], [11, 2]];
export function pickHouse(w, fl, seed) { let best = 0, bd = 1e9; HOUSE_VARIANTS.forEach(([vw, vf], i) => { const d = Math.abs(vw - w) + (vf === fl ? 0 : 50) + (i === seed % 6 ? -0.5 : 0); if (d < bd) { bd = d; best = i; } }); return best; }

// ---------- the Blender NATURE kit (tools/island/nature_kit_blender.py -> assets/island/nature_kit*.glb) ----------
// palm0-2, tree0-2, fern, rock0-2, cliff0-1, spire0 (LOD0 + LOD1) and the Skull Peak skull. Vertex colour = tint x baked AO,
// colour ALPHA = look.js surface id x 1/16 (3 rock, 5 bark, 6 leaf, 7 bone, 9 cliff, 14 cut-out card). Cards sample the card
// sheet through aCardUv (+ uv for the alpha-tested shadow pass). aSway is derived here per asset family.
function natGeo(src, m, name) {
  const g = toFloat(src, m), P = g.attributes.position, n = P.count, src4 = src.attributes.color, mat = new Float32Array(n), sw = new Float32Array(n);
  for (let i = 0; i < n; i++) mat[i] = src4 && src4.itemSize === 4 ? Math.round(src4.getW(i) * 16) : 3;
  let maxY = 0, cx = 0, cz = 0, nc = 0; for (let i = 0; i < n; i++) { maxY = Math.max(maxY, P.getY(i)); if (mat[i] === 14) { cx += P.getX(i); cz += P.getZ(i); nc++; } } if (nc) { cx /= nc; cz /= nc; }
  for (let i = 0; i < n; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), card = mat[i] === 14;
    sw[i] = /^palm/.test(name) ? (card ? 0.5 + Math.min(2.2, Math.hypot(x - cx, z - cz) / 2.4) : Math.pow(y / Math.max(1, maxY), 2) * 0.55)
      : /^tree/.test(name) ? Math.max(0, (y - 5) / 9) * (card ? 0.9 : 0.6) : /^fern/.test(name) ? Math.hypot(x, z) / 1.9 : 0; }
  g.setAttribute('aMat', new THREE.BufferAttribute(mat, 1)); g.setAttribute('aSway', new THREE.BufferAttribute(sw, 1));
  if (src.attributes.uv) { g.setAttribute('aCardUv', g.attributes.uv); }
  return g;
}
let _nat = null;
async function loadNatureKit0(low, renderer = null) {
  if (_nat) return _nat;
  const gl = await loadKit('nature_kit', low, renderer); gl.scene.updateMatrixWorld(true);
  const geos = {}; let cards = null;
  gl.scene.traverse(o => { if (!o.isMesh) return; const nm = o.name.replace(/_LOD[01]$/, ''), lod = /_LOD1$/.test(o.name) ? 1 : 0;
    geos[nm + '_' + lod] = natGeo(o.geometry, o.matrixWorld, nm); cards = cards || o.material.map; });
  if (cards) { cards.colorSpace = THREE.SRGBColorSpace; cards.anisotropy = low ? 4 : 8; } // [v330 perf] phones 2 -> 4
  const tris = Object.fromEntries(Object.entries(geos).map(([k, g]) => [k, (g.index ? g.index.count : g.attributes.position.count) / 3]));
  return (_nat = { geos, cards, low, url: gl.userData.url, ktx2: !!gl.userData.ktx2, texBytes: texBytes(cards), tris, get: (nm, lod) => geos[nm + '_' + lod] || geos[nm + '_1'] || geos[nm + '_0'] });
}
