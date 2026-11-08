// [Raul] PUMPFUN PIRATES Blender pirates (tools/blender/build_pirates.py -> assets/pirates/pirate_{male,female}_{hi,lo}.glb).
// v4: one GLB per base and LOD, rest pose = T-pose. Each LOD is ONE smooth-skinned mesh on the shared humanoid armature (root, spine,
// head, braid, tails, upperarm/forearm/thigh/shin .L/.R) + the flat face decal; Blender-authored clips idle / walk / run / cannon /
// steer, draco geometry + webp textures. Colour lives in COLOR_0 ('_tint' = TINTS index per vertex, -1 = fixed colour), so retint =
// rewrite COLOR_0 (setColors). High ('pirate_hi_body'): toon x greyscale detail + AO atlas + normal atlas, ink hull as a second
// material (3 draw calls with the face). Low ('pirate_lo_body'): unlit baked-light atlas (2 draw calls with the face).
// Milestone 1 (starter bases only): shirtless male / wrap-top female, plain pants, basic boots, hair + face. Shop items: js/pirateItems.js.
import * as THREE from 'three';
import { sharedBodyClips } from './onfoot/retarget.js';
import { locomotionClip } from './onfoot/locomotion.js';
import { OPT_ON, animStep } from './opt.js'; // [Emerly perf-v304] &opt=0 = full-rate mixers
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'; // [v381] the restored V7 male + his gear refits are Meshopt-packed
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// [v121] BANKSY "Push them in game for now": the v5 bases (turnaround-sheet look, painted anime eyes, pill tattoo) on the SAME v4
// armature + clips, same layout ('pirate_{hi,lo}_body' atlas x COLOR_0 + _TINT; skin / hair / shirt tint keys), plus 'v5_face_eyes'
// (iris tint, setIris) and 'v5_tattoo' (alpha decal). Players (on foot, captain, remote, shop thumbs) use v5; the baked ship crew keeps v4.
// [V6] BANKSY "Do v6 characters": the V6 bases (whole AI-generated character from his exact turnaround sheets: sculpted hair, bare
// hands + feet, white underwear) REPLACE the v5 bodies for every player path. Same v5 armature / bone names / pivots / clips / origin /
// scale / 'v5warp' extras, same layout ('pirate_{hi,lo}_body' detail atlas x COLOR_0 + _TINT skin / hair, -1 = fixed underwear /
// tattoo) and 'v5_face_eyes' (= the V6 eyes / brows / lips alpha decal, iris tint via setIris). Body extras { v6: 1 }.
// hi ~19k / lo ~3.5k tris. Tools: tools/v6 (rig.py + morph.py + paint.py). BANKSY "V5 is fine tuned ... should be same shape": each V6 body (hi + lo)
// is CONFORMED to the v5 body shape (v5 skeleton + weights, the V6 paint / face / hair kept), so every v5 item GLB (items/v5) is worn UNCHANGED;
// the legacy base outfit (cloth_base: pants, belt, sash, boots, her wrap top) is still auto-worn, so nobody shows up barefoot / pantless. The ship crew bake keeps the v5 Low bodies
// (their painted outfits = the captain's clothes; V6 crews would all be in underwear).
// [V7 male] BANKSY-approved Meshy sculpt + single right-arm PumpFun pill, reweighted onto the
// unchanged 13-bone game rig. Same clips / gear warp / attachment pivots; V6 is retained as load fallback.
// Build: tools/v7/build_male.py. Female and the legacy V5 deck-crew bake are unchanged.
export const PIRATE_GLB = {
  male: { hi: 'assets/pirates/pirate_male_v7_hi.glb', lo: 'assets/pirates/pirate_male_v7_lo.glb' },
  female: { hi: 'assets/pirates/pirate_female_v7_hi.glb', lo: 'assets/pirates/pirate_female_v7_lo.glb' },
};
// [Emerly V7 female] BANKSY t1900u "let meshi do all the work just rig it": the Meshy V7 female mesh / texture / normals / hands / braid
// UNTOUCHED (uniform scale only); the 13 game bones were moved onto HER joints instead (same names / orientations / clips).
// Default look = the Meshy paint as-is; her own tint mask ('v7tint' extras) only applies when a player PICKS a skin / hair / eye colour.
// Build: tools/v7/build_female.py. V6 = load fallback.
export const PIRATE_GLB_V5 = {
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
  // [v339 mobile-stability] phones: 2 Draco WASM workers (default 4 = ~4 decoder heaps of native RAM on iOS); pirate bodies are boot-critical so not 1
  try { if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches) draco.setWorkerLimit(2); } catch {}
  _loader = new GLTFLoader(); _loader.setDRACOLoader(draco); _loader.setMeshoptDecoder(MeshoptDecoder); return _loader;
}
export function loadPirateGLB(url) {
  if (!_cache.has(url)) _cache.set(url, loader().loadAsync(new URL(url, document.baseURI).href).then(capTex).catch((e) => { _cache.delete(url); if (/pirate_(male|female)_v7_(hi|lo)\.glb$/.test(url)) return loadPirateGLB(url.replace('_v7_', '_v6_')); throw e; })); // [v112] retry a failed load next time
  return _cache.get(url);
}
// [perf3] the v5 pirate atlases are 2048 px (22 MB of GPU memory each with mips, six of them). Cap baked GLB maps at 1024 px:
// a pirate never covers enough of the screen for 2048 to show. ?pirtex=2048 (or 4096) turns it off.
const TEX_CAP = (() => { try { const m = /[?&]pirtex=(\d+)/.exec(location.search); return m ? +m[1] : 1024; } catch { return 1024; } })();
const _capped = new WeakMap();
function capTex(gl) {
  if (typeof document === 'undefined') return gl;
  gl.scene.traverse(o => { for (const m of [].concat(o.material || [])) for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap']) {
    const cap = o.userData?.v7 && TEX_CAP === 1024 ? 2048 : TEX_CAP;
    const t = m[k], img = t?.image; if (!img?.width || Math.max(img.width, img.height) <= cap) continue;
    try { let c = _capped.get(img); if (!c) { const f = cap / Math.max(img.width, img.height); c = document.createElement('canvas'); c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
        const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(img, 0, 0, c.width, c.height); _capped.set(img, c); }
      t.image = c; t.needsUpdate = true; } catch (e) { console.warn('[pirate] texture cap', e); } } });
  return gl;
}
// [v364 BANKSY t1922u/t1933u] V7 FACE RIG: the Meshy faces are painted into a fragmented texture (no face bones), so blinks + talking
// are drawn in the shader in BIND space (the undeformed body position, which follows the head through skinning): an eyelid wipes down
// over each painted eye and back (a blink), and a dark mouth opening grows over the painted lips while the pirate talks (emote voice
// lines). At rest nothing is drawn: the NFT eye shape stays exactly as painted. Centre xyz + half size xy, measured on the front renders.
export const V7_FACE = {
  male: { eyeL: [0.0947, 1.0294, 0.1497], eyeR: [-0.0928, 1.0294, 0.1498], eyeS: [0.058, 0.046], mouth: [0, 0.9232, 0.1543], mouthW: 0.05, lid: '#f0a06e' },
  female: { eyeL: [0.0959, 1.0705, 0.1546], eyeR: [-0.098, 1.0706, 0.1549], eyeS: [0.057, 0.055], mouth: [0, 0.9655, 0.1883], mouthW: 0.05, lid: '#fcb996' },
};
// V7 keeps the original Meshy texture intact. Independent pixel masks recolour skin / hair / iris;
// teal tattoos, underwear, eyebrows, pupils and glints are never tinted.
const _v7Masks = {};
// [perf v466] ONE load per mask url, shared with the plaza mannequins' pixel read (js/island/plazaMannequins.js maskPixels), which used to fetch it again
const _v7MaskImg = {};
export function v7MaskTexture(key) { if (!_v7Masks[key]) { let ok, bad; _v7MaskImg[key] = new Promise((a, b) => { ok = a; bad = b; }); _v7MaskImg[key].catch(() => {});
  const t = new THREE.TextureLoader().load(new URL('../' + key, import.meta.url).href, (tx) => ok(tx.image), undefined, bad); t.flipY = false; _v7Masks[key] = t; } return _v7Masks[key]; }
export function v7MaskImage(key) { v7MaskTexture(key); return _v7MaskImg[key] || Promise.resolve(_v7Masks[key]?.image || null); }
function v7FaceMask(fem) { return v7MaskTexture('assets/pirates/v7_' + (fem ? 'female' : 'male') + '_face.webp'); }
function v7Material(src, p, low, tint) {
  let cfg = null; try { cfg = typeof tint === 'string' ? JSON.parse(tint) : tint || null; } catch {}   // [Emerly V7 female] per-body mask
  const key = cfg?.mask || ('assets/pirates/v7_male_tint' + (low ? '_lo' : '') + '.webp');
  v7MaskTexture(key);
  // [Emerly V7 female] her Meshy normal map rides along on High (keeps the sculpted hair / cloth relief of the approved render)
  const m = new THREE.MeshLambertMaterial({ name: 'v7body', map: src.map, normalMap: (!low && cfg && src.normalMap) || null, side: THREE.DoubleSide });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, p._v7Tint, { v7Mask: { value: _v7Masks[key] } });
    s.vertexShader = 'varying vec3 vBind7; varying vec3 vFwd7;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vBind7 = position;').replace('#include <skinnormal_vertex>', '#include <skinnormal_vertex>\n vec3 fw7 = vec3(0., 0., 1.);\n #ifdef USE_SKINNING\n fw7 = (skinMatrix * vec4(fw7, 0.)).xyz;\n #endif\n vFwd7 = normalize(normalMatrix * fw7);');
    s.fragmentShader = 'uniform sampler2D v7Mask; uniform vec3 v7Skin; uniform vec3 v7Hair; uniform vec3 v7Iris; uniform vec3 v7On;\nvarying vec3 vBind7; varying vec3 vFwd7; uniform vec3 v7EyeL, v7EyeR, v7Mouth, v7Lid; uniform sampler2D v7FaceM; uniform vec4 v7FaceS; uniform vec2 v7Face;\n' + s.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n if (lidK7 > 0.5) normal = vFwd7;').replace('#include <map_fragment>', `#include <map_fragment>
      float lidK7 = 0.0;
      vec3 mask7 = texture2D(v7Mask, vMapUv).rgb;
      vec3 base7 = diffuseColor.rgb;
      // Relative luminance keeps the painted folds, freckles and carved hair detail.
      float skin7 = dot(base7, vec3(.2126,.7152,.0722)) / .43;
      float hair7 = dot(base7, vec3(.2126,.7152,.0722)) / .38;
      diffuseColor.rgb = mix(diffuseColor.rgb, v7Skin * skin7, mask7.r * v7On.r);
      diffuseColor.rgb = mix(diffuseColor.rgb, v7Hair * hair7, mask7.g * v7On.g);
      diffuseColor.rgb = mix(diffuseColor.rgb, v7Iris * max(.16, base7.b / .6), mask7.b * v7On.b);
    `).replace('#include <color_fragment>', `#include <color_fragment>
      if (v7Face.x > 0.001 || v7Face.y > 0.001) {
        vec3 lid7 = mix(v7Lid, v7Skin * (dot(v7Lid, vec3(.2126,.7152,.0722)) / .43), v7On.r);
        vec3 fm7 = texture2D(v7FaceM, vMapUv).rgb;   // the painted eyes (+ their outline), traced per texel
        for (int e = 0; e < 2; e++) { vec3 c7 = e == 0 ? v7EyeL : v7EyeR; vec2 d7 = (vBind7.xy - c7.xy) / (v7FaceS.xy * vec2(1.12, 1.0)); float in7 = e == 0 ? fm7.r : fm7.g;
          if (abs(vBind7.z - c7.z) < 0.07 && dot(d7, d7) < 2.2 && (in7 > 0.08 || (dot(d7, d7) < 1.3 && abs(vBind7.z - c7.z) < 0.035)) && !(d7.y > 0.75 && in7 < 0.5 && dot(base7, vec3(.333)) < 0.2)) {   // (the brow stays)   // the lid comes down from the top of the eye
            float yb = 1.25 - 1.45 * v7Face.x - 0.3 * (1.0 - clamp(d7.x * d7.x, 0.0, 1.0));   // curved lid edge: closed = a soft downward arc
            if (d7.y > yb + 0.14 || (v7Face.x > 0.85 && d7.y < yb - 0.02)) { diffuseColor.rgb = lid7 * (0.9 + 0.1 * clamp(d7.y, 0.0, 1.0)); lidK7 = 1.0; }
            else if (d7.y > yb && v7Face.x > 0.05) diffuseColor.rgb = vec3(0.08, 0.045, 0.035);   // lash line on the lid edge
          } }
        vec2 m7 = (vBind7.xy - v7Mouth.xy) / vec2(v7FaceS.z * (0.75 + 0.2 * v7Face.y), 0.003 + 0.019 * v7Face.y);
        if (v7Face.y > 0.02 && abs(vBind7.z - v7Mouth.z) < 0.045) { float r7 = dot(m7, m7);
          if (r7 < 1.0) diffuseColor.rgb = mix(vec3(0.15, 0.04, 0.04), vec3(0.45, 0.12, 0.12), smoothstep(0.2, 1.0, -m7.y) * 0.6);   // mouth inside + a hint of tongue
          else if (r7 < 1.5) diffuseColor.rgb *= 0.75; }   // lip shadow
      }
    `);
  };
  m.customProgramCacheKey = () => 'v7-tint-v5face'; return m;
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
const V6_LIFT = 1.12;   // [V6 quality 2] BANKSY 'both faces darker than V5's clean flat skin': the lit V6 body a touch brighter (V5 toon bands read lighter)
function toonize(src, colors, low, v6 = false) {
  const k = kindOf(src), key = tintOf(src);
  // [V6 AAA v2] velvety collectible body (sheen + subtle bump from detail atlas) + wet glossy anime eyes (clearcoat).
  // v5eyes = V6 face/eye decal material name from the GLB (kindOf splits on '.').
  if (v6 && (k === 'pirate_hi' || k === 'v6face' || k === 'v5eyes')) {
    const isFace = (k === 'v6face' || k === 'v5eyes');
    const m = new THREE.MeshPhysicalMaterial({
      name: src.name,
      color: isFace ? 0xffffff : new THREE.Color(V6_LIFT, V6_LIFT, V6_LIFT),
      map: src.map || null,
      vertexColors: k === 'pirate_hi',
      roughness: isFace ? 0.22 : 0.42,
      metalness: 0,
      envMapIntensity: isFace ? 1.25 : 0.9,
      // subtle micro-relief from the detail/AO atlas (hair grooves, tank ribs) — tiny so skin stays velvet
      bumpMap: (!low && src.map) ? src.map : null,
      bumpScale: isFace ? 0.0 : 0.0035,
      sheen: isFace ? 0.0 : 0.22,
      sheenRoughness: 0.65,
      sheenColor: new THREE.Color(0xfff3e8),
      clearcoat: isFace ? 0.6 : 0.0,
      clearcoatRoughness: isFace ? 0.12 : 0.0,
      alphaTest: isFace ? 0.5 : 0,
      transparent: false,
      side: isFace ? THREE.FrontSide : THREE.DoubleSide, // [v280] body DoubleSide; eyes front-only
    });
    if (m.map) { m.map.anisotropy = Math.max(m.map.anisotropy || 0, 8); m.map.colorSpace = m.map.colorSpace || THREE.SRGBColorSpace; }
    if (m.bumpMap) { m.bumpMap.anisotropy = Math.max(m.bumpMap.anisotropy || 0, 4); }
    m.userData = { tint: key, decal: isFace ? 'face' : '' };
    return m;
  }
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
    s.fragmentShader = 'uniform vec3 uIris; uniform float uIrisOn;\n' + s.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n if (lidK7 > 0.5) normal = vFwd7;').replace('#include <map_fragment>', `#include <map_fragment>
      float lidK7 = 0.0;
      if (uIrisOn > 0.5) { vec3 c0 = diffuseColor.rgb; float blu = c0.b - c0.r; float k = smoothstep(0.12, 0.32, blu);
        float hl = clamp((c0.r - 0.24) / 0.19, 0.0, 1.0); vec3 tint = mix(uIris, mix(uIris, vec3(1.0), 0.22), hl);
        diffuseColor.rgb = mix(c0, tint, k); }`); })(m.onBeforeCompile);
  const key = m.customProgramCacheKey?.bind(m); m.customProgramCacheKey = () => (key ? key() : '') + '|iris'; m.needsUpdate = true;
}
// [v138] BANKSY "beard edge": the v5 sculpt's beard / hair is ringed by fixed-colour verts whose baked texture is orange-brown, so every
// beard and hairline read as a shredded orange fringe (worse on Low's big triangles). The fixed verts touching the hair (2 rings) join
// the hair tint, once per shared geometry; the hair colour then runs cleanly to the skin edge.
const _rim = new WeakSet();
// [crew holes] ONE place for the v5 body fixes every render path needs (walking crew / captain / shop figure via PirateGLB, the deck crew
// bake in js/crewV4.js): the hair rim (skin-tinted verts round the hair -> hair, no skin specks / torn hair). Idempotent per geometry.
// [v280 crew holes] V6 bodies carry the spliced V5 head/hair on the SAME atlas mesh (userData.v6=1): skipping hairRim left
// skin/orange fringe through the hair on followers + mannequins (the player often covers it with a hat). Hair rim only
// retints fixed (-1) verts that share a face with hair (head/neck); underwear at the waist is untouched. &crewholes=0 = old skip.
export function prepV5Body(root, lod = 'hi') {
  const skipV6 = typeof location !== 'undefined' && /[?&]crewholes=0(?:&|$)/.test(location.search);
  root.traverse((o) => { if (o.isSkinnedMesh && o.geometry?.attributes?._tint && !(skipV6 && o.userData?.v6)) hairRim(o.geometry, lod === 'lo' ? 5 : 2); });
}
// [crew holes] which v5 body a render path uses (the v128 holes fix: the decimated Low body only where the GPU budget needs it).
// many = a path that draws a dozen+ bodies at once (the deck crew bake): High only on HIGH quality desktops.
export const pirateBodyLod = ({ low = false, many = false, quality = 'high' } = {}) => (low || (many && quality !== 'high') ? 'lo' : 'hi');
function hairRim(g, rings = 2) {
  const T = g.attributes._tint, C = g.attributes.color, P = g.attributes.position, N = g.attributes.normal, I = g.index?.array; if (!T || !C || !P || !I || _rim.has(T)) return; _rim.add(T);
  const iH = TINTS.indexOf('hair'), n = P.count, wid = new Int32Array(n), wm = new Map(); let nw = 0;
  for (let i = 0; i < n; i++) { const k = Math.round(P.getX(i) * 1e4) + ',' + Math.round(P.getY(i) * 1e4) + ',' + Math.round(P.getZ(i) * 1e4); let w = wm.get(k); if (w === undefined) { w = nw++; wm.set(k, w); } wid[i] = w; }
  const tw = new Int8Array(nw).fill(-2); for (let i = 0; i < n; i++) { const t = Math.round(T.getX(i)); if (t === iH || tw[wid[i]] === -2) tw[wid[i]] = t; }
  const hc = [0, 0, 0]; for (let i = 0; i < n; i++) if (Math.round(T.getX(i)) === iH) { hc[0] = C.getX(i); hc[1] = C.getY(i); hc[2] = C.getZ(i); break; }
  const lip = new Uint8Array(nw); if (N) for (let i = 0; i < n; i++) if (Math.abs(P.getX(i)) < 0.08 && N.getZ(i) > 0.6 && P.getY(i) > 0.96) lip[wid[i]] = 1;   // the mouth (front-facing, centre) stays as painted
  const hy = new Uint8Array(nw); for (let i = 0; i < n; i++) if (P.getY(i) > 0.86) hy[wid[i]] = 1;   // Low's wider rim: head / neck only
  for (let ring = 0; ring < rings; ring++) { const add = [];
    for (let f = 0; f < I.length; f += 3) { const a = wid[I[f]], b = wid[I[f + 1]], c = wid[I[f + 2]]; if (tw[a] !== iH && tw[b] !== iH && tw[c] !== iH) continue; for (const v of [a, b, c]) if (tw[v] === -1 && !lip[v] && (ring < 2 || hy[v])) add.push(v); }
    for (const v of add) tw[v] = iH; }
  for (let i = 0; i < n; i++) if (tw[wid[i]] === iH && Math.round(T.getX(i)) === -1) { T.setX(i, iH); C.setXYZ(i, hc[0], hc[1], hc[2]); }
  T.needsUpdate = true; C.needsUpdate = true;
}
export class PirateGLB {
  // opts: { female, lod: 'hi'|'lo', colors }
  static async create(opts = {}) { const p = new PirateGLB(opts); await p.ready; return p; }
  constructor({ female = false, lod = 'hi', colors = null, v4 = false, body = null, bodyURL = null, maleClipURL = null } = {}) {
    this.female = female; this.lod = lod; this.maleClipURL = maleClipURL; this.root = new THREE.Group(); this.root.name = 'pirateGLB';
    this.decals = []; this.tinted = []; this.action = null; this.clip = null;
    // body: 'v5' | 'v6' | null (null = __PIRATE_BODY_V5 ? v5 : live PIRATE_GLB). bodyURL is only used for the lightweight V7 ship-crew derivative; normal player selection is unchanged.
    const useV5 = body === 'v5' || (!body && !v4 && !!globalThis.__PIRATE_BODY_V5);
    this._url = bodyURL || (v4 ? PIRATE_GLB_V4 : useV5 ? PIRATE_GLB_V5 : PIRATE_GLB)[female ? 'female' : 'male'][lod];   // [V6] tools/gear_viewer.html?body=v5: V5 vs V6 review shots
    this.ready = loadPirateGLB(this._url).then((g) => this._init(g, colors));
  }
  async _init(gltf, colors) {
    const scene = SkeletonUtils.clone(gltf.scene); const low = this.lod === 'lo';
    this.v7 = false; scene.traverse(o => { if (o.userData?.v7) this.v7 = true; });
    this._v7Tint = { v7Skin: { value: new THREE.Color() }, v7Hair: { value: new THREE.Color() }, v7Iris: { value: new THREE.Color() }, v7On: { value: new THREE.Vector3() } };
    if (this.v7) { const F = V7_FACE[this.female ? 'female' : 'male']; Object.assign(this._v7Tint, { v7EyeL: { value: new THREE.Vector3(...F.eyeL) }, v7EyeR: { value: new THREE.Vector3(...F.eyeR) }, v7Mouth: { value: new THREE.Vector3(...F.mouth) },
      v7Lid: { value: new THREE.Color(F.lid) }, v7FaceS: { value: new THREE.Vector4(F.eyeS[0], F.eyeS[1], F.mouthW, 0) }, v7Face: { value: new THREE.Vector2() }, v7FaceM: { value: v7FaceMask(this.female) } });
      this._face = { blinkIn: 1.5 + Math.random() * 3, blinkT: -1, talk: 0, ph: Math.random() * 9 }; }
    this.v6 = false; scene.traverse((o) => { if (o.userData?.v6) this.v6 = true; });   // [V6] (no hair rim, glossy material)
    scene.traverse((o) => {
      if (!o.isMesh) return;
      if (this.v7 && o.userData.v7) { o.material = v7Material(o.material, this, low, o.userData.v7tint); return; }
      o.material = Array.isArray(o.material) ? o.material.map((m) => toonize(m, colors, low, this.v6)) : toonize(o.material, colors, low, this.v6);
      for (const m of [o.material].flat()) { if (m.userData?.decal) this.decals.push(m); else if (m.userData?.tint) this.tinted.push(m); }
    });
    this.atlasMeshes = []; scene.traverse((o) => { if (o.isSkinnedMesh && o.geometry.attributes._tint) this.atlasMeshes.push(o); });
    this.v5 = this.v7; this.warp = null; scene.traverse((o) => { if (/^v5_/.test(o.name)) this.v5 = true; });
    if (this.v5) for (const o of this.atlasMeshes) { o.userData.v5 = true; try { this.warp ||= JSON.parse(o.userData.v5warp || 'null'); } catch {} } // [v121]
    if (this.v5 && this.warp) for (const o of this.atlasMeshes) o.userData.warp = this.warp;
    // [v138] the eye decal stays front-only: drawn both sides it showed through the hair as blue specks on the back of Low heads
    if (this.v5 && !this.v7) prepV5Body(scene, this.lod);   // [v138] (shared with the crew bake: js/crewV4.js)
    if (low && !this.v7) this._mergeLow(scene);
    // [v123] v5 bodies are an AI sculpt with some faces wound inward: draw both sides (front-only showed HOLLOW pirates / crew followers)
    if (this.v5) scene.traverse((o) => { if (o.isMesh && !/ink/i.test(o.name) && !/face_eyes/i.test(o.name)) for (const m of [o.material].flat()) if (m && m.name !== 'ink') { m.side = THREE.DoubleSide; m.needsUpdate = true; } });
    // [v115] iris tint: the face decal's light-blue iris (both tones) is re-coloured in the shader, sclera / pupil / lids / glints untouched
    this._iris = { value: new THREE.Color(1, 1, 1) }; this._irisOn = { value: 0 };
    scene.traverse((o) => { if (!o.isMesh || !/face/i.test(o.name)) return; for (const m of [o.material].flat()) if (m?.map) irisPatch(m, this._iris, this._irisOn); });
    if (colors) this.setColors(colors);
    this.scene = scene; this.root.add(scene);
    scene.traverse((o) => { if (o.isBone) o.userData.swRest = o.quaternion.clone(); });   // [Raul] bind pose for the procedural swim poses (js/onfoot/swimPose.js)
    const animations = this.v7 && this.female ? sharedBodyClips(gltf, await loadPirateGLB(this.maleClipURL || PIRATE_GLB.male[this.lod])) : gltf.animations;
    this.mixer = new THREE.AnimationMixer(scene); this.clips = Object.fromEntries(animations.map((a) => [a.name, this.v7 && (a.name === 'walk' || a.name === 'run') ? locomotionClip(a) : a]));
    this.play('idle');
    return this;
  }
  // Low (exported from Blender already merged): 'pirate_lo_body' = ONE smooth-skinned mesh (T-pose bind), ONE atlas with baked AO + soft light in
  // the albedo, COLOR_0 = tint colour, '_tint' = tint key index (TINTS) -> unlit material, retint = rewrite COLOR_0.
  _mergeLow(scene) {
    scene.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const at = o.material.alphaTest || 0; o.material = this.v5 && o.geometry.attributes._tint ? Object.assign(new THREE.MeshLambertMaterial({ map: o.material.map || null, vertexColors: true, name: 'pirate_lo', side: THREE.DoubleSide }), { color: new THREE.Color(...(this.v6 ? [1.08, 1.08, 1.08] : [1.22, 1.22, 1.22])) }) /* [v128] v5 Low has no baked light in its atlas: lit (Lambert, cheap) so arms / skin aren't flat pale patches */ : new THREE.MeshBasicMaterial({ map: o.material.map || null, vertexColors: !!o.geometry.attributes.color, name: 'pirate_lo', alphaTest: at, side: THREE.DoubleSide }); /* [V6] the V6 eyes decal has no COLOR_0: vertexColors on it drew the Low eyes black */ /* [remote-crew-solid] BANKSY 7:14 PM: the Low body drawn front-only = hollow crew (same as v123) */ o.frustumCulled = false; if (o.geometry.attributes._tint) this.lowMesh = o; // [v121] v5: + eyes / tattoo meshes (tattoo keeps its alpha cut-out)
    });
  }
  // retint by ship skin / creator colours: { coat, accent, skin, hair, ... }
  setColors(colors) {
    for (const m of this.tinted) if (colors[m.userData.tint] != null) m.color.set(colors[m.userData.tint]);
    const col = new THREE.Color();
    if (this.v7) { for (const [key, axis] of [['skin', 'x'], ['hair', 'y']]) { if (colors[key] != null) { this._v7Tint[key === 'skin' ? 'v7Skin' : 'v7Hair'].value.set(colors[key]); this._v7Tint.v7On.value[axis] = 1; } } return; }
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
  setIris(hex) { if (this.v7) { this._v7Tint.v7On.value.z = hex ? 1 : 0; if (hex) this._v7Tint.v7Iris.value.set(hex); return; } if (!this._iris) return; if (hex) { this._iris.value.set(hex); this._irisOn.value = 1; } else this._irisOn.value = 0; } // [v115] null = the drawn blue
  setExpression(name) {
    const uv = EXPR_UV[name] || EXPR_UV.neutral;
    for (const m of this.decals) if (m.userData.decal !== 'skull' && m.map) { m.map.offset.set(uv[0], uv[1]); m.map.updateMatrix(); }
  }
  // [Raul emotes] shared post-mixer pose hook: procedural layers (js/onfoot/swimPose.js order 0, js/onfoot/emotePose.js order 1) run in
  // order after the clip, each blending its own bones; battle.js still wraps update() so its arm aim lands last
  addPost(key, fn, order = 0) { const L = this.posts || (this.posts = []); if (L.some((x) => x.key === key)) return; L.push({ key, fn, order }); L.sort((a, b) => a.order - b.order); }
  // [v364] V7 face: talk(seconds) = the mouth moves (emote voice lines); blinks run on their own every 2-6 s
  talk(sec = 2.5) { if (this._face) this._face.talk = Math.max(this._face.talk, sec); }
  _faceTick(dt) { const f = this._face, u = this._v7Tint?.v7Face?.value; if (!f || !u) return; dt = Math.min(dt, 0.1);
    f.blinkIn -= dt; if (f.blinkIn <= 0 && f.blinkT < 0) { f.blinkT = 0; f.blinkIn = 2 + Math.random() * 4 - (Math.random() < 0.15 ? 1.7 : 0); }
    let b = 0; if (f.blinkT >= 0) { f.blinkT += dt; const k = f.blinkT / 0.16; b = k < 0.45 ? k / 0.45 : k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4); if (k >= 1) f.blinkT = -1; }
    let m = 0; if (f.talk > 0) { f.talk -= dt; f.ph += dt; const t = f.ph; m = Math.max(0, 0.55 + 0.45 * Math.sin(t * 17.0) * Math.sin(t * 5.3 + 1.0)) * Math.min(1, f.talk * 4); }
    u.set(b, m); }
  update(dt) { // [Emerly perf-v304] distance LOD on the mixer (posts still run when near / mid so swim + zipline grips stay live)
    if (this._face) this._faceTick(dt);
    const step = OPT_ON ? animStep(this, dt) : dt;
    if (step > 0) { this.mixer?.update(step); for (const k in this.items || {}) this.items[k]?.mixer?.update(step); }
    else if (this._zip?.w > 0 || this._sw?.w > 0) { /* keep procedural grips / swim when layered even if mixer skipped */ }
    if (this.posts && (step > 0 || this._zip?.w > 0 || this._sw?.w > 0 || (this.root?.userData?.emote))) for (const x of this.posts) x.fn.call(this, dt);
  }   // items: js/pirateItems.js (parrot idle)
  stats() { let tris = 0, calls = 0; this.root.traverse((o) => { if (!o.isMesh) return; const g = o.geometry; const t = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += t; calls += Array.isArray(o.material) ? g.groups.length || o.material.length : 1; }); return { tris: Math.round(tris), calls }; }
}
