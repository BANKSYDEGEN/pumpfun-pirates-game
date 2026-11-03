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

// [v121] BANKSY "Push them in game for now": the v5 bases (turnaround-sheet look, painted anime eyes, pill tattoo) on the SAME v4
// armature + clips, same layout ('pirate_{hi,lo}_body' atlas x COLOR_0 + _TINT; skin / hair / shirt tint keys), plus 'v5_face_eyes'
// (iris tint, setIris) and 'v5_tattoo' (alpha decal). Players (on foot, captain, remote, shop thumbs) use v5; the baked ship crew keeps v4.
export const PIRATE_GLB = {
  male: { hi: 'assets/pirates/pirate_male_v5_hi.glb', lo: 'assets/pirates/pirate_male_v5_lo.glb' },
  female: { hi: 'assets/pirates/pirate_female_v5_hi.glb', lo: 'assets/pirates/pirate_female_v5_lo.glb' },
};
export const PIRATE_GLB_V4 = {
  male: { hi: 'assets/pirates/pirate_male_hi.glb', lo: 'assets/pirates/pirate_male_lo.glb' },
  female: { hi: 'assets/pirates/pirate_female_hi.glb', lo: 'assets/pirates/pirate_female_lo.glb' },
};
// [v121] v5 GEAR WARP: every hat / eyewear / hook / peg / garment was authored on the v4 body. The v5 body keeps its own sculpted
// proportions (uniform scale only), so gear is mapped v4 bind space -> v5 bind space instead: heights by landmarks (feet, arm line,
// eye line, crown), arms compressed past the shoulder to the shorter v5 arm, the face plane moved to the v5 face, hats scaled to
// the bigger v5 hair. W = the body's 'v5warp' extras (tools: brand/v5 rig.py). v5Inv = the way back (hide rules, clothes shells).
const lerpA = (v, A, B) => { if (v <= A[0]) return B[0] + (v - A[0]) * ((B[1] - B[0]) / (A[1] - A[0] || 1)); for (let i = 1; i < A.length; i++) if (v <= A[i] || i === A.length - 1) { const t = (v - A[i - 1]) / ((A[i] - A[i - 1]) || 1); return B[i - 1] + t * (B[i] - B[i - 1]); } return v; };
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const bandW = (W, y) => sstep(W.band[0] - 0.05, W.band[0] + 0.02, y) * (1 - sstep(W.band[1] - 0.02, W.band[1] + 0.05, y));
export function v5Fwd(W, x, y, z, hat = false, out = [0, 0, 0]) {
  const s0 = W.sh * 0.85, ax = Math.abs(x); let nx = x;
  if (ax > s0) { const w = Math.min(1, (ax - s0) / (W.sh * 0.3)) * bandW(W, y); nx = Math.sign(x) * (s0 + (ax - s0) * (1 + (W.armK - 1) * w)); }
  const ny = lerpA(y, W.a4, W.a5), hw = sstep(W.neck, W.neck + 0.08, y); let nz = z + hw * W.faceDz, fx = nx, fy = ny;
  if (hat) { const cx = W.headC[0], cy = W.a5[2], cz = W.headC[1] + W.faceDz * 0; fx = cx + (nx - cx) * W.hatS; fy = cy + (ny - cy) * W.hatS; nz = cz + (nz - cz) * W.hatS; }
  out[0] = fx; out[1] = fy; out[2] = nz; return out;
}
export function v5Inv(W, x, y, z, out = [0, 0, 0]) {
  const y4 = lerpA(y, W.a5, W.a4), s0 = W.sh * 0.85, ax = Math.abs(x); let a = ax;
  if (ax > s0) { const b = bandW(W, y4); for (let k = 0; k < 4; k++) { const w = Math.min(1, (a - s0) / (W.sh * 0.3)) * b; a = s0 + (ax - s0) / (1 + (W.armK - 1) * w); } }
  out[0] = Math.sign(x) * a; out[1] = y4; out[2] = z - sstep(W.neck, W.neck + 0.08, y4) * W.faceDz; return out;
}
// per-hat seat on the v5 hair after the warp (scale about the head centre, drop dy, push dz, tilt rx back): tuned on the gear grid
export const V5_HAT_FIT = { bandana: { s: 1, dy: 0, dz: 0, rx: 0 }, tricorn: { s: 1, dy: 0, dz: 0, rx: 0 }, bicorne: { s: 1, dy: 0, dz: 0, rx: 0 }, crown: { s: 1, dy: 0, dz: 0, rx: 0 } };
export function v5Hat(W, id, p) {   // p = [x, y, z] already warped; in place
  const F = V5_HAT_FIT[id]; if (!F) return p; const cx = W.headC[0], cy = W.a5[2], cz = W.headC[1];
  let x = cx + (p[0] - cx) * F.s, y = cy + (p[1] - cy) * F.s, z = cz + (p[2] - cz) * F.s;
  if (F.rx) { const c = Math.cos(F.rx), s = Math.sin(F.rx), yy = y - cy, zz = z - cz; y = cy + yy * c + zz * s; z = cz - yy * s + zz * c; }
  p[0] = x; p[1] = y - F.dy; p[2] = z + F.dz; return p;
}
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
  constructor({ female = false, lod = 'hi', colors = null, v4 = false } = {}) {
    this.female = female; this.lod = lod; this.root = new THREE.Group(); this.root.name = 'pirateGLB';
    this.decals = []; this.tinted = []; this.action = null; this.clip = null;
    this._url = (v4 ? PIRATE_GLB_V4 : PIRATE_GLB)[female ? 'female' : 'male'][lod];
    this.ready = loadPirateGLB(this._url).then((g) => this._init(g, colors));
  }
  _init(gltf, colors) {
    const scene = SkeletonUtils.clone(gltf.scene); const low = this.lod === 'lo';
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map((m) => toonize(m, colors, low)) : toonize(o.material, colors, low);
      for (const m of [o.material].flat()) { if (m.userData?.decal) this.decals.push(m); else if (m.userData?.tint) this.tinted.push(m); }
    });
    this.atlasMeshes = []; scene.traverse((o) => { if (o.isSkinnedMesh && o.geometry.attributes._tint) this.atlasMeshes.push(o); });
    this.v5 = false; this.warp = null; scene.traverse((o) => { if (/^v5_/.test(o.name)) this.v5 = true; });
    if (this.v5) for (const o of this.atlasMeshes) { o.userData.v5 = true; try { this.warp ||= JSON.parse(o.userData.v5warp || 'null'); } catch {} } // [v121]
    if (this.v5 && this.warp) for (const o of this.atlasMeshes) o.userData.warp = this.warp;
    if (low) this._mergeLow(scene);
    // [v123] v5 bodies are an AI sculpt with some faces wound inward: draw both sides (front-only showed HOLLOW pirates / crew followers)
    if (this.v5) scene.traverse((o) => { if (o.isMesh && !/ink/i.test(o.name)) for (const m of [o.material].flat()) if (m && m.name !== 'ink') { m.side = THREE.DoubleSide; m.needsUpdate = true; } });
    // [v115] iris tint: the face decal's light-blue iris (both tones) is re-coloured in the shader, sclera / pupil / lids / glints untouched
    this._iris = { value: new THREE.Color(1, 1, 1) }; this._irisOn = { value: 0 };
    scene.traverse((o) => { if (!o.isMesh || !/face/i.test(o.name)) return; for (const m of [o.material].flat()) if (m?.map) irisPatch(m, this._iris, this._irisOn); });
    if (colors) this.setColors(colors);
    this.scene = scene; this.root.add(scene);
    this.mixer = new THREE.AnimationMixer(scene); this.clips = Object.fromEntries(gltf.animations.map((a) => [a.name, a]));
    this.play('idle');
    return this;
  }
  // Low (exported from Blender already merged): 'pirate_lo_body' = ONE smooth-skinned mesh (T-pose bind), ONE atlas with baked AO + soft light in
  // the albedo, COLOR_0 = tint colour, '_tint' = tint key index (TINTS) -> unlit material, retint = rewrite COLOR_0.
  _mergeLow(scene) {
    scene.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const at = o.material.alphaTest || 0; o.material = new THREE.MeshBasicMaterial({ map: o.material.map || null, vertexColors: true, name: 'pirate_lo', alphaTest: at }); o.frustumCulled = false; if (o.geometry.attributes._tint) this.lowMesh = o; // [v121] v5: + eyes / tattoo meshes (tattoo keeps its alpha cut-out)
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
