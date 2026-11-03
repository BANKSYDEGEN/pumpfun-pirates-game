// [Raul] PUMPFUN PIRATES Blender pirates (tools/blender/build_pirates.py -> assets/pirates/pirate_{male,female}_{hi,lo}.glb).
// v4: one GLB per base and LOD, rest pose = T-pose. Each LOD is ONE smooth-skinned mesh on the shared humanoid armature (root, spine,
// head, braid, tails, upperarm/forearm/thigh/shin .L/.R) + the flat face decal; Blender-authored clips idle / walk / run / cannon /
// steer, draco geometry + webp textures. Colour lives in COLOR_0 ('_tint' = TINTS index per vertex, -1 = fixed colour), so retint =
// rewrite COLOR_0 (setColors). High ('pirate_hi_body'): toon x greyscale detail + AO atlas + normal atlas, ink hull as a second
// material (3 draw calls with the face). Low ('pirate_lo_body'): unlit baked-light atlas (2 draw calls with the face).
// Milestone 1 (starter bases only): shirtless male / wrap-top female, plain pants, basic boots, hair + face. Shop items: js/pirateItems.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const PIRATE_GLB = {
  male: { hi: 'assets/pirates/pirate_male_hi.glb', lo: 'assets/pirates/pirate_male_lo.glb' },
  female: { hi: 'assets/pirates/pirate_female_hi.glb', lo: 'assets/pirates/pirate_female_lo.glb' },
};
export const TINTS = ['skin', 'hair', 'coat', 'accent', 'hat', 'pants', 'boots', 'shirt'];
export const PIRATE_CLIPS = ['idle', 'walk', 'run', 'cannon', 'steer'];
// face / mouth decal atlases are 2 x 2: neutral | shout / hurt | blink  -> UV offset per expression
export const EXPR_UV = { neutral: [0, 0], shout: [0.5, 0], hurt: [0, 0.5], blink: [0.5, 0.5] };

let _loader = null; const _cache = new Map();
function loader() {
  if (_loader) return _loader;
  const draco = new DRACOLoader(); draco.setDecoderPath(new URL('../vendor/three-0.165.0/examples/jsm/libs/draco/gltf/', import.meta.url).href); // [security M4] self-hosted (was jsDelivr)
  _loader = new GLTFLoader(); _loader.setDRACOLoader(draco); return _loader;
}
export function loadPirateGLB(url) {
  if (!_cache.has(url)) _cache.set(url, loader().loadAsync(new URL(url, document.baseURI).href).catch((e) => { _cache.delete(url); throw e; })); // [v112] retry a failed load next time
  return _cache.get(url);
}
let _grad = null;
export function gradient() {
  if (_grad) return _grad;
  _grad = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]), 4, 1);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter; _grad.needsUpdate = true; return _grad;
}
const tintOf = (m) => m?.userData?.tint || '';
const kindOf = (m) => (m?.name || '').split('.')[0];

// colors: { skin, hair, coat, accent, ... } (hex / css / THREE.Color); keys not given keep the baked default
function toonize(src, colors, low) {
  const k = kindOf(src), key = tintOf(src);
  if (k === 'ink') return new THREE.MeshBasicMaterial({ color: 0x0b0b0c, name: 'ink', side: THREE.FrontSide });
  const decal = k === 'face' || k === 'mouth' || k === 'skull';
  const atlas = k === 'pirate_hi';   // merged High: ONE greyscale detail + AO atlas x COLOR_0 (tint colours), normal atlas
  const m = new THREE.MeshToonMaterial({ name: src.name, color: atlas ? 0xffffff : src.color.clone(), map: src.map || null, gradientMap: gradient(), vertexColors: atlas,
    normalMap: low ? null : src.normalMap || null, transparent: false, alphaTest: decal ? 0.5 : 0 });
  if (src.normalMap && !low) m.normalScale.set(1, 1);
  if (decal && m.map) { m.map = m.map.clone(); m.map.needsUpdate = true; }
  if (key && colors?.[key] != null) m.color.set(colors[key]);
  m.userData = { tint: key, decal: decal ? k : '' };
  return m;
}

// [v106] SkeletonUtils.clone shares geometry between clones, so COLOR_0 writes leaked into every pirate. Give the mesh its own
// geometry wrapper that shares every buffer (positions, skin, uv, index) except a cloned colour attribute: no extra mesh memory.
function ownColorAttr(o) {
  const g = o.geometry, c = g.attributes.color; o.userData.ownColor = true; if (!c) return;
  const n = new THREE.BufferGeometry(); n.setIndex(g.index); for (const k in g.attributes) n.setAttribute(k, k === 'color' ? c.clone() : g.attributes[k]);
  for (const k in g.morphAttributes) n.morphAttributes[k] = g.morphAttributes[k]; n.morphTargetsRelative = g.morphTargetsRelative;
  for (const gr of g.groups) n.addGroup(gr.start, gr.count, gr.materialIndex); n.boundingBox = g.boundingBox; n.boundingSphere = g.boundingSphere; n.drawRange = { ...g.drawRange }; n.userData = g.userData; n.name = g.name;
  o.geometry = n;
}
// [v115] eye colour: patch one face material. The authored iris is light blue (sRGB #88c0f0 + highlight #b0d8f0): blue clearly above red.
// Shade (dark iris -> highlight) is kept from the original red channel; edge pixels blend by how blue they are, so the outlines stay crisp.
function irisPatch(m, uIris, uOn) {
  m.onBeforeCompile = ((prev) => (s, r) => { prev?.(s, r); s.uniforms.uIris = uIris; s.uniforms.uIrisOn = uOn;
    s.fragmentShader = 'uniform vec3 uIris; uniform float uIrisOn;\n' + s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      if (uIrisOn > 0.5) { vec3 c0 = diffuseColor.rgb; float blu = c0.b - c0.r; float k = smoothstep(0.12, 0.32, blu);
        float hl = clamp((c0.r - 0.24) / 0.19, 0.0, 1.0); vec3 tint = mix(uIris, mix(uIris, vec3(1.0), 0.22), hl);
        diffuseColor.rgb = mix(c0, tint, k); }`); })(m.onBeforeCompile);
  const key = m.customProgramCacheKey?.bind(m); m.customProgramCacheKey = () => (key ? key() : '') + '|iris'; m.needsUpdate = true;
}
export class PirateGLB {
  // opts: { female, lod: 'hi'|'lo', colors }
  static async create(opts = {}) { const p = new PirateGLB(opts); await p.ready; return p; }
  constructor({ female = false, lod = 'hi', colors = null } = {}) {
    this.female = female; this.lod = lod; this.root = new THREE.Group(); this.root.name = 'pirateGLB';
    this.decals = []; this.tinted = []; this.action = null; this.clip = null;
    this.ready = loadPirateGLB(PIRATE_GLB[female ? 'female' : 'male'][lod]).then((g) => this._init(g, colors));
  }
  _init(gltf, colors) {
    const scene = SkeletonUtils.clone(gltf.scene); const low = this.lod === 'lo';
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map((m) => toonize(m, colors, low)) : toonize(o.material, colors, low);
      for (const m of [o.material].flat()) { if (m.userData?.decal) this.decals.push(m); else if (m.userData?.tint) this.tinted.push(m); }
    });
    this.atlasMeshes = []; scene.traverse((o) => { if (o.isSkinnedMesh && o.geometry.attributes._tint) this.atlasMeshes.push(o); });
    if (low) this._mergeLow(scene);
    // [v115] iris tint: the face decal's light-blue iris (both tones) is re-coloured in the shader, sclera / pupil / lids / glints untouched
    this._iris = { value: new THREE.Color(1, 1, 1) }; this._irisOn = { value: 0 };
    scene.traverse((o) => { if (!o.isMesh || !/face/i.test(o.name)) return; for (const m of [o.material].flat()) if (m?.map) irisPatch(m, this._iris, this._irisOn); });
    if (colors) this.setColors(colors);
    this.scene = scene; this.root.add(scene);
    this.mixer = new THREE.AnimationMixer(scene); this.clips = Object.fromEntries(gltf.animations.map((a) => [a.name, a]));
    this.play('idle'); return this;
  }
  // Low (exported from Blender already merged): 'pirate_lo_body' = ONE smooth-skinned mesh (T-pose bind), ONE atlas with baked AO + soft light in
  // the albedo, COLOR_0 = tint colour, '_tint' = tint key index (TINTS) -> unlit material, retint = rewrite COLOR_0.
  _mergeLow(scene) {
    scene.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      o.material = new THREE.MeshBasicMaterial({ map: o.material.map || null, vertexColors: true, name: 'pirate_lo' }); o.frustumCulled = false; this.lowMesh = o;
    });
  }
  // retint by ship skin / creator colours: { coat, accent, skin, hair, ... }
  setColors(colors) {
    for (const m of this.tinted) if (colors[m.userData.tint] != null) m.color.set(colors[m.userData.tint]);
    const col = new THREE.Color();
    for (const o of this.atlasMeshes || []) {   // merged meshes (High + Low): retint = rewrite COLOR_0 per tint key
      if (!o.userData.ownColor) ownColorAttr(o); // [v106] per-instance COLOR_0: recolouring one pirate never recolours its clones (crew followers, mixed crews)
      const g = o.geometry, t = g.attributes._tint, c = g.attributes.color; if (!t || !c) continue;
      for (let i = 0; i < t.count; i++) { const k = TINTS[Math.round(t.getX(i))]; if (k && colors[k] != null) { col.set(colors[k]); c.setXYZ(i, col.r, col.g, col.b); } }
      c.needsUpdate = true;
    }
  }
  play(name, { fade = 0.2, timeScale = 1 } = {}) {
    const clip = this.clips?.[name]; if (!clip || this.clip === name) return;
    const a = this.mixer.clipAction(clip); a.reset().setEffectiveTimeScale(timeScale).play();
    if (this.action) this.action.crossFadeTo(a, fade, false);
    this.action = a; this.clip = name;
  }
  setIris(hex) { if (!this._iris) return; if (hex) { this._iris.value.set(hex); this._irisOn.value = 1; } else this._irisOn.value = 0; } // [v115] null = the drawn blue
  setExpression(name) {
    const uv = EXPR_UV[name] || EXPR_UV.neutral;
    for (const m of this.decals) if (m.userData.decal !== 'skull' && m.map) { m.map.offset.set(uv[0], uv[1]); m.map.updateMatrix(); }
  }
  update(dt) { this.mixer?.update(dt); for (const k in this.items || {}) this.items[k]?.mixer?.update(dt); }   // items: js/pirateItems.js (parrot idle)
  stats() { let tris = 0, calls = 0; this.root.traverse((o) => { if (!o.isMesh) return; const g = o.geometry; const t = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += t; calls += Array.isArray(o.material) ? g.groups.length || o.material.length : 1; }); return { tris: Math.round(tris), calls }; }
}
