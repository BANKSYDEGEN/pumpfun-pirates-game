// [Timothy] PUMPFUN PIRATES ship art kit (Blender): tools/blender/ship_kit.py builds it, tools/blender/build.sh exports it.
// What it is: baked surface tiles (hull strakes, deck / cabin planks, sail cloth: tangent normal map + a grayscale
// detail map of AO x grain x weathering) and hero meshes (carriage gun, figurehead, stern carving, lantern cage,
// channels + deadeyes) with baked AO in vertex colours, as a High and a Low (phones) LOD.
// How it is used: the game's own parametric hull / layout (ships.js, upgradeVisuals.js) stays the source of every
// position, so hitboxes, gun slots and muzzle markers never move. The kit only changes how parts LOOK:
//   * detailize(canvasTex, kind) multiplies the detail map into a skin's painted canvas (tint stays the skin's),
//   * normalFor(kind) is the matching normal map for that material,
//   * geo(name) is a kit mesh in the exact local frame of the procedural part it replaces.
// If the kit fails to load (offline cache, old browser) everything falls back to the procedural art (KIT.ready = false).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const DIR = new URL('../assets/ships/kit/', import.meta.url).href;
export const KIT = { ready: false, lo: false, geos: { hi: new Map(), lo: new Map() }, img: {}, hi: {}, nrm: {}, err: null };

const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('kit image ' + url)); i.src = url; });
async function loadGlb(url) {
  const ld = new GLTFLoader(); ld.setMeshoptDecoder(MeshoptDecoder);
  const g = await ld.loadAsync(url), out = new Map();
  g.scene.updateMatrixWorld(true);
  g.scene.traverse(o => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (!geo.attributes.color) { const n = geo.attributes.position.count, c = new Float32Array(n * 3).fill(1); geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    else if (geo.attributes.color.itemSize === 4 || geo.attributes.color.normalized) { // -> plain float RGB (merge-friendly)
      const a = geo.attributes.color, n = a.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = a.getX(i); c[i * 3 + 1] = a.getY(i); c[i * 3 + 2] = a.getZ(i); }
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) geo.deleteAttribute(k);
    out.set(o.name, geo);
  });
  return out;
}
async function boot(lo) {
  KIT.lo = !!lo;
  const sfx = KIT.lo ? '_lo' : '';
  const kinds = ['hull', 'deck', 'sail'];
  const [glb, ...imgs] = await Promise.all([
    loadGlb(DIR + (KIT.lo ? 'player_kit_lo.glb' : 'player_kit.glb')),
    ...kinds.flatMap(k => [loadImg(`${DIR}${k}_d${sfx}.jpg`), loadImg(`${DIR}${k}_n${sfx}.jpg`)]),
  ]);
  KIT.geos[KIT.lo ? 'lo' : 'hi'] = glb;
  kinds.forEach((k, i) => {
    KIT.img[k] = imgs[i * 2];
    const t = new THREE.Texture(imgs[i * 2 + 1]); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.needsUpdate = true;
    KIT.nrm[k] = t;
  });
  { // sail seam highlight = the inverted cloth detail (computed once)
    const d = KIT.img.sail, c = document.createElement('canvas'); c.width = d.width; c.height = d.height;
    const g = c.getContext('2d'); g.drawImage(d, 0, 0); const px = g.getImageData(0, 0, c.width, c.height), a = px.data;
    for (let i = 0; i < a.length; i += 4) { const v = Math.max(0, Math.min(255, (255 - a[i]) * 2.2)); a[i] = a[i + 1] = a[i + 2] = v; }
    g.putImageData(px, 0, 0); KIT.hi.sail = c;
  }
  KIT.ready = true;
}
// main.js awaits this once at boot, after the graphics quality is known: lo = LOW quality or a phone (Low LOD + half-res maps)
let _init = null;
export function initKit(lo) {
  if (!_init) _init = Promise.race([boot(lo), new Promise((_, rej) => setTimeout(() => rej(new Error('kit timeout')), 12000))])
    .catch((e) => { KIT.err = String(e?.message || e); KIT.ready = false; console.warn('[ship kit] procedural fallback:', KIT.err); });
  return _init;
}

export const kitOn = () => KIT.ready;
// a kit mesh (shared, never disposed by disposeShip: callers clone it into their merge buffers)
export const geo = (name) => (KIT.ready ? KIT.geos[KIT.lo ? 'lo' : 'hi'].get(name) || null : null);

// the skin's painted canvas x the baked detail (AO / grain / seams), same UVs, cached per source texture
const _det = new WeakMap();
export function detailize(tex, kind, { flipX = false } = {}) {
  if (!KIT.ready || !tex?.image || !KIT.img[kind]) return tex;
  let per = _det.get(tex); if (!per) _det.set(tex, per = new Map());
  const key = kind + (flipX ? '-x' : ''); if (per.has(key)) return per.get(key);
  const d = KIT.img[kind], c = document.createElement('canvas');
  c.width = d.width; c.height = d.height;
  const g = c.getContext('2d');
  g.drawImage(tex.image, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'multiply';
  if (flipX) { g.save(); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(d, 0, 0, c.width, c.height); g.restore(); }
  else g.drawImage(d, 0, 0, c.width, c.height);
  if (KIT.hi[kind]) { // cloth: the seams / tabling / reef band also catch a little light, so they read on black sails too
    g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.2;
    if (flipX) { g.save(); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(KIT.hi[kind], 0, 0, c.width, c.height); g.restore(); }
    else g.drawImage(KIT.hi[kind], 0, 0, c.width, c.height);
    g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.repeat.copy(tex.repeat); t.offset.copy(tex.offset); t.anisotropy = tex.anisotropy || 4;
  per.set(key, t); return t;
}
// the matching baked normal map, wrapped / mirrored like the colour map it goes with
const _nrm = new Map();
export function normalFor(kind, like = null) {
  if (!KIT.ready || !KIT.nrm[kind]) return null;
  const mir = like && like.repeat.x < 0, k = kind + (mir ? '-m' : '');
  if (_nrm.has(k)) return _nrm.get(k);
  let t = KIT.nrm[kind];
  if (mir) { t = t.clone(); t.repeat.x = -1; t.offset.x = 1; t.needsUpdate = true; }
  _nrm.set(k, t); return t;
}
// give a toon material the kit look for `kind` (in place; call on a fresh material only)
export function dressMaterial(m, kind, { strength = 0.55 } = {}) {
  if (!KIT.ready || !m) return m;
  if (m.map) m.map = detailize(m.map, kind);
  const n = normalFor(kind, m.map); if (n) { m.normalMap = n; m.normalScale = new THREE.Vector2(strength, strength); }
  m.needsUpdate = true; return m;
}
// a vertex-coloured twin of a toon material for kit meshes (their AO lives in COLOR_0); same map + tint, so skins,
// materialFx and the ghost / golden / diamond looks treat it exactly like the material it copies
const _vc = new WeakMap();
export function aoTwin(m, role) {
  if (!m) return m;
  let t = _vc.get(m); if (t) return t;
  t = m.clone(); t.vertexColors = true; t.name = 'kit-' + role; t.userData.kitRole = role;
  t.onBeforeCompile = m.onBeforeCompile; if (m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) t.customProgramCacheKey = m.customProgramCacheKey;
  _vc.set(m, t); return t;
}
