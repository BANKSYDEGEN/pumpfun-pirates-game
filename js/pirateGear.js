// [Timothy] PUMPFUN PIRATES island-shop GEAR on Raul's v4 pirates (hats, clothes, eyewear, parrots, hooks; ids = js/shopCatalog.js).
//
//   import { applyGear, setLocalGear, getLocalGear } from './pirateGear.js';
//   applyGear(target, { hat, outfit, eyes, parrot, hook });   // target: a pirateFigure() group, a loadPirate() result or a PirateGLB
//   setLocalGear(gear);                                        // after shop_equip: saves to pfp_captain_v1 + re-dresses YOUR on-foot
//                                                              // pirate and YOUR captain at the wheel (window 'pfp-gear' event)
//   window.PFP_GEAR = { applyGear, setLocalGear, getLocalGear, gearRenders, GEAR_RENDERS, GEAR_DEFAULTS }
//
// How it draws (one extra draw call per dressed pirate, none when undressed):
//  - every equipped piece is merged into ONE SkinnedMesh bound to the pirate's own skeleton + bind matrix, so it moves with every clip.
//  - clothes (tank / tshirt / coat) are grown from the body's own skinned torso + arm skin (offset along the normal, same bone
//    weights), so they fit male + female and the High + Low LODs exactly. No equipped clothing = shirtless (Raul's base).
//  - hats, eyewear, the parrot and the hook are small Blender meshes (tools/blender/build_gear.py -> assets/pirates/gear_{hi,lo}.glb,
//    meshopt), each skinned rigidly to its bone. The hook folds the right hand away (a per-pirate copy of the body geometry).
//  - the baked ship crew (js/crewV4.js) is NOT dressed: it stays ONE draw call per ship in the default outfit.
// Visual only: no stats, hitboxes, gold or server code. Unknown / unowned ids just draw nothing (the shop validates ownership).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { TINTS } from './pirateGLB.js';

export const GEAR_DEFAULTS = Object.freeze({ hat: 'none', outfit: 'shirtless', eyes: 'plain', parrot: 'none', hook: 'none' });
// catalog ids that actually show on the pirate (everything else in a slot draws nothing)
export const GEAR_RENDERS = Object.freeze({
  hat: ['bandana', 'tricorn', 'bicorne'], outfit: ['tank', 'tshirt', 'coat'], eyes: ['eyepatch', 'sunglasses', 'laser'],
  parrot: ['parrot_green', 'parrot_red', 'parrot_gold'], hook: ['hook_iron', 'hook_gold'],
});
export const gearRenders = (slot, id) => !!GEAR_RENDERS[slot]?.includes(id);
const GEAR_URL = { hi: 'assets/pirates/gear_hi.glb', lo: 'assets/pirates/gear_lo.glb' };
// accessory meshes in the GLB: [mesh name, bone, palette (tint key 1..3 -> colour; null = baked colours)]
const PIECES = {
  'hat:bandana': ['hat_bandana', 'head', (c) => ({ 1: c.cloth || '#c8302c' })],
  'hat:tricorn': ['hat_tricorn', 'head', null], 'hat:bicorne': ['hat_bicorne', 'head', null],
  'eyes:eyepatch': ['eyes_eyepatch', 'head', null], 'eyes:sunglasses': ['eyes_sunglasses', 'head', null], 'eyes:laser': ['eyes_laser', 'head', null],
  'parrot:parrot_green': ['parrot_parrot', 'spine', () => ({ 1: '#3fd16a', 2: '#2a6df4', 3: '#1f8f45' })],
  'parrot:parrot_red': ['parrot_parrot', 'spine', () => ({ 1: '#e8231d', 2: '#2a6df4', 3: '#ffcd3a' })],
  'parrot:parrot_gold': ['parrot_parrot', 'spine', () => ({ 1: '#ffcd77', 2: '#e9a93a', 3: '#fff2c4' })],
  'hook:hook_iron': ['hook_hook', 'forearm.R', () => ({ 1: '#9aa3ad' })], 'hook:hook_gold': ['hook_hook', 'forearm.R', () => ({ 1: '#ffcd77' })],
};
// clothes: which body skin they cover (bind pose, three space: y up, +z front; belt top y 0.49, wrist |x| 0.555) + colours
const OUTFITS = {
  tank:   { arms: 0, off: 0.010, col: (c) => c.cloth || '#f1ede2', hole: true },
  tshirt: { arms: 0.33, off: 0.011, col: (c) => c.cloth || '#24304f', stripes: true },
  coat:   { arms: 0.545, off: 0.016, col: (c) => c.cloth || '#c8302c', trim: (c) => c.trim || '#e9b949', tails: true },
};
const WRIST_X = 0.552, WRIST_Y = 0.842;

export function normalizeGear(g) {
  const s = (g && typeof g === 'object') ? g : {}, o = { ...GEAR_DEFAULTS };
  for (const k of Object.keys(GEAR_DEFAULTS)) if (typeof s[k] === 'string' && s[k]) o[k] = s[k];
  if (s.eyes == null && typeof s.face === 'string' && s.face !== 'plain') o.eyes = s.face;     // creator 'face' = shop 'eyes'
  if (s.eyepatch === true) o.eyes = 'eyepatch';
  if (o.parrot === 'parrot') o.parrot = 'parrot_green'; if (o.hook === 'hook') o.hook = 'hook_iron';
  return o;
}
const gearKey = (g) => Object.keys(GEAR_DEFAULTS).map((k) => g[k]).join('|');

// ---------- local save: the creator's pfp_captain_v1 (hat / outfit / face / parrot / hook). gearV marks a shop-written save, so an
// old creator save (its defaults were tricorn + eyepatch + coat) never dresses a new pirate for free: they start shirtless. ----------
const KEY = 'pfp_captain_v1';
function readSave() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
let _mem = null;
export function getLocalGear() {
  const c = _mem || readSave();
  if (!c || !c.gearV) return { ...GEAR_DEFAULTS };
  return normalizeGear({ hat: c.hat, outfit: c.outfit, eyes: c.eyes ?? c.face, parrot: c.parrot, hook: c.hook });
}
const LOCAL = new Set();   // your own pirates (on-foot + captain at the wheel), re-dressed by setLocalGear
export function markLocal(target) { const r = rootOf(target); if (r) LOCAL.add(r); return target; }
export function setLocalGear(gear) {
  const g = normalizeGear(gear), c = { ...(readSave() || { v: 1 }) };
  c.v = 1; c.gearV = 1; c.hat = g.hat; c.outfit = g.outfit; c.eyes = g.eyes; c.face = g.eyes === 'plain' ? 'plain' : g.eyes; c.parrot = g.parrot; c.hook = g.hook;
  _mem = c; try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* memory only */ }
  for (const r of LOCAL) { let o = r; while (o.parent) o = o.parent; if (!o.isScene) { LOCAL.delete(r); continue; } applyGear(r, g); }   // gone = dropped
  try { window.dispatchEvent(new CustomEvent('pfp-gear', { detail: g })); } catch {}
  return g;
}

// ---------- loading ----------
let _loader = null; const _libs = {};
function loadLib(lod) {
  if (_libs[lod]) return _libs[lod];
  _loader ||= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return (_libs[lod] = _loader.loadAsync(new URL(GEAR_URL[lod], document.baseURI).href).then((gltf) => {
    const out = {}; gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      const P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color, n = P.count;
      const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3), key = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        pos.set([P.getX(i), P.getY(i), P.getZ(i)], i * 3); nrm.set([N.getX(i), N.getY(i), N.getZ(i)], i * 3);
        col.set(C ? [C.getX(i), C.getY(i), C.getZ(i)] : [1, 1, 1], i * 3);
        const r = C ? C.getX(i) : 0, g = C ? C.getY(i) : 0, b = C ? C.getZ(i) : 0;   // marker colours: magenta 1, cyan 2, yellow 3
        key[i] = r > 0.9 && g < 0.1 && b > 0.9 ? 1 : r < 0.1 && g > 0.9 && b > 0.9 ? 2 : r > 0.9 && g > 0.9 && b < 0.1 ? 3 : 0;
      }
      let nm = o.name, a = o; while (!/^(hat|eyes|parrot|hook)_/.test(nm) && a.parent) { a = a.parent; nm = a.name; }   // gltfpack: the named node is the parent
      out[nm.replace(/\.\d+$/, '')] = { pos, nrm, col, key, n };
    });
    return out;
  }));
}

// ---------- shared bits ----------
const bn = (s) => (s || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
let _tex = null;
function stripeTex() {   // 2 x 2: u < .5 = sailor stripes (white / navy) along uv.y, u > .5 = plain white (vertex colour only)
  if (_tex) return _tex;
  _tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 34, 44, 78, 255, 255, 255, 255, 255]), 2, 2);
  _tex.magFilter = _tex.minFilter = THREE.NearestFilter; _tex.wrapT = THREE.RepeatWrapping; _tex.colorSpace = THREE.SRGBColorSpace; _tex.needsUpdate = true; return _tex;
}
let _grad = null;
function gradient() {
  if (_grad) return _grad;
  _grad = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]), 4, 1);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter; _grad.needsUpdate = true; return _grad;
}
const _mats = {};
function gearMat(low) {   // High: toon like Raul's body; Low: unlit (light baked into the vertex colours like Raul's Low atlas)
  return (_mats[low ? 'lo' : 'hi'] ||= low
    ? new THREE.MeshBasicMaterial({ name: 'pirate_gear_lo', vertexColors: true, map: stripeTex() })
    : new THREE.MeshToonMaterial({ name: 'pirate_gear', vertexColors: true, map: stripeTex(), gradientMap: gradient() }));
}
const LDIR = new THREE.Vector3(0.35, 0.8, 0.5).normalize();
const shade = (nx, ny, nz) => 0.58 + 0.42 * Math.max(0, nx * LDIR.x + ny * LDIR.y + nz * LDIR.z) + 0.08 * Math.max(0, ny);

// find the PirateGLB inside whatever the caller has
function rootOf(t) { return t?.isObject3D ? t : t?.object?.isObject3D ? t.object : t?.root?.isObject3D ? t.root : null; }
function pirateOf(t) {
  if (!t) return null;
  if (t.mixer && t.scene) return t;                               // PirateGLB
  const r = rootOf(t); if (!r) return null;
  if (r.userData.v4) return r.userData.v4;                        // pirateFigure group
  let p = null; r.traverse((o) => { if (!p && o.userData?.v4) p = o.userData.v4; }); return p;   // loadPirate() root / captain figure
}
function bodyOf(p) {
  let body = null; p.scene.traverse((o) => { if (!body && o.isSkinnedMesh && o.geometry.attributes._tint) body = o; }); return body;
}

// ---------- clothes shell from the body's skin (cached per body geometry + outfit + colours) ----------
const _shells = new Map();
function shellOf(body, id, colors, low) {
  const spec = OUTFITS[id]; if (!spec) return null;
  const ck = body.geometry.uuid + '|' + id + '|' + JSON.stringify(colors || {}); if (_shells.has(ck)) return _shells.get(ck);
  const g = body.geometry, P = g.attributes.position, N = g.attributes.normal, T = g.attributes._tint, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
  const bones = body.skeleton.bones.map((b) => bn(b.name)), iS = TINTS.indexOf('skin'), iSh = TINTS.indexOf('shirt');
  const cloth = new THREE.Color(spec.col(colors || {})), trim = spec.trim ? new THREE.Color(spec.trim(colors || {})) : null, white = new THREE.Color('#f4f1e8');
  const bone = (i) => { let b = 0, w = -1; for (let k = 0; k < 4; k++) { const x = W.getComponent(i, k); if (x > w) { w = x; b = J.getComponent(i, k); } } return bones[b] || ''; };
  const n = P.count, keep = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const t = Math.round(T.getX(i)); if (t !== iS && t !== iSh) continue;
    const b = bone(i), x = Math.abs(P.getX(i)), y = P.getY(i), z = P.getZ(i);
    if (b === 'spine') {
      if (y < 0.44) continue;   // a little under the belt top (0.49) so Low's coarse waist has no skin gap; the belt + pants hide it
      if (spec.hole && ((x > 0.13 && y > 0.80) || (z > 0 && x < 0.085 && y > 0.86))) continue;   // tank: arm holes + scoop neck
      keep[i] = 1;
    } else if ((b === 'upperarml' || b === 'upperarmr') && spec.arms && x < spec.arms) keep[i] = 1;
    else if ((b === 'forearml' || b === 'forearmr') && spec.arms > 0.4 && x < spec.arms) keep[i] = 1;
  }
  const idx = g.index ? g.index.array : null, tri = idx ? idx.length / 3 : n / 3, remap = new Int32Array(n).fill(-1), list = [], out = [];
  for (let f = 0; f < tri; f++) {
    const a = idx ? idx[f * 3] : f * 3, b = idx ? idx[f * 3 + 1] : f * 3 + 1, c = idx ? idx[f * 3 + 2] : f * 3 + 2;
    if (keep[a] + keep[b] + keep[c] < (low ? 2 : 3)) continue;   // Low's torso is coarse: 2 of 3 corners is enough there (no torn edges)
    for (const v of [a, b, c]) { if (remap[v] < 0) { remap[v] = list.length; list.push(v); } out.push(remap[v]); }
  }
  const m = list.length, pos = new Float32Array(m * 3), nrm = new Float32Array(m * 3), col = new Float32Array(m * 3), uv = new Float32Array(m * 2),
    si = new Uint16Array(m * 4), sw = new Float32Array(m * 4), c = new THREE.Color();
  list.forEach((v, i) => {
    const nx = N.getX(v), ny = N.getY(v), nz = N.getZ(v), x = P.getX(v), y = P.getY(v), z = P.getZ(v), ax = Math.abs(x);
    pos.set([x + nx * spec.off, y + ny * spec.off, z + nz * spec.off], i * 3); nrm.set([nx, ny, nz], i * 3);
    for (let k = 0; k < 4; k++) { si[i * 4 + k] = J.getComponent(v, k); sw[i * 4 + k] = W.getComponent(v, k); }
    let striped = !!spec.stripes; c.copy(cloth);
    if (spec.trim) {   // red coat: open front over a striped shirt, gold edging + cuffs (NFT redcoat)
      if (z > 0.02 && ax < 0.062 && y > 0.5) { c.copy(white); striped = true; }
      else if (z > 0.02 && ax < 0.085 && y > 0.5) c.copy(trim);
      else if (ax > spec.arms - 0.05) c.copy(trim);
    }
    if (low) c.multiplyScalar(shade(nx, ny, nz));
    col.set([c.r, c.g, c.b], i * 3); uv.set([striped ? 0.25 : 0.75, y * 15], i * 2);
  });
  const parts = { pos, nrm, col, uv, si, sw, index: out };
  if (spec.tails) Object.assign(parts, { tails: tailsOf(bones, cloth, trim, low) });
  _shells.set(ck, parts); return parts;
}
// coat tails: an open-front skirt from the belt to mid thigh, on the spine bone (back + sides only)
function tailsOf(bones, cloth, trim, low) {
  const bi = Math.max(0, bones.indexOf('spine')), NT = 18, NY = 4, pos = [], nrm = [], col = [], idx = [], c = new THREE.Color();
  for (let i = 0; i <= NT; i++) {
    const a = -0.22 * Math.PI + (1.44 * Math.PI) * i / NT;   // the front (+z, a = -pi/2) stays open ~100 deg
    for (let j = 0; j <= NY; j++) {
      const t = j / NY, y = 0.47 - 0.21 * t, r = 0.212 + 0.045 * t, x = Math.cos(a) * r, z = -Math.sin(a) * r * 0.92;
      pos.push(x, y, z); nrm.push(Math.cos(a), 0.15, -Math.sin(a));
      c.copy(j === NY ? trim : cloth); if (low) c.multiplyScalar(shade(Math.cos(a), 0.15, -Math.sin(a))); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NY; j++) {
    const a = i * (NY + 1) + j, b = a + NY + 1; idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const n = pos.length / 3;
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col), uv: new Float32Array(n * 2).fill(0.75),
    si: new Uint16Array(n * 4).map((_, k) => (k % 4 ? 0 : bi)), sw: new Float32Array(n * 4).map((_, k) => (k % 4 ? 0 : 1)), index: idx, double: true };
}

// ---------- hook: a copy of every skinned body mesh with the right hand folded into the wrist (restored when unequipped) ----------
const _hookGeo = new WeakMap();
function handless(mesh) {
  const src = mesh.userData.gearOrigGeo || mesh.geometry; if (_hookGeo.has(src)) return _hookGeo.get(src);
  const g = src.clone(), P = g.attributes.position, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
  const fr = mesh.skeleton.bones.findIndex((b) => bn(b.name) === 'forearmr');
  for (let i = 0; i < P.count; i++) {
    if (P.getX(i) > -WRIST_X) continue;
    let b = 0, w = -1; for (let k = 0; k < 4; k++) { const x = W.getComponent(i, k); if (x > w) { w = x; b = J.getComponent(i, k); } }
    if (b === fr) P.setXYZ(i, -WRIST_X, WRIST_Y, 0);
  }
  P.needsUpdate = true; _hookGeo.set(src, g); return g;
}
function setHandless(p, on) {
  p.scene.traverse((o) => {
    if (!o.isSkinnedMesh || o.userData.isGear) return;
    if (on) { if (!o.userData.gearOrigGeo) { const h = handless(o); o.userData.gearOrigGeo = o.geometry; o.geometry = h; } }
    else if (o.userData.gearOrigGeo) { o.geometry = o.userData.gearOrigGeo; o.userData.gearOrigGeo = null; }
  });
}

// ---------- the merged gear mesh ----------
function buildGearGeometry(p, body, gear, lib, colors) {
  const low = p.lod === 'lo', boneIx = (nm) => Math.max(0, body.skeleton.bones.findIndex((b) => bn(b.name) === bn(nm)));
  const chunks = [];
  if (gear.outfit !== 'shirtless') { const s = shellOf(body, gear.outfit, colors, low); if (s) { chunks.push(s); if (s.tails) chunks.push(s.tails); } }
  // accessories: GLB (scene space) -> body space
  p.scene.updateMatrixWorld(true);
  const toBody = new THREE.Matrix4().copy(body.matrixWorld).invert().multiply(p.scene.matrixWorld), nm3 = new THREE.Matrix3().getNormalMatrix(toBody), v = new THREE.Vector3(), c = new THREE.Color();
  for (const slot of ['hat', 'eyes', 'parrot', 'hook']) {
    const pc = PIECES[`${slot}:${gear[slot]}`]; if (!pc) continue;
    const src = lib?.[pc[0]]; if (!src) continue;
    const pal = pc[2] ? pc[2](colors || {}) : null, bi = boneIx(pc[1]), n = src.n;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.fromArray(src.pos, i * 3).applyMatrix4(toBody).toArray(pos, i * 3); v.fromArray(src.nrm, i * 3).applyMatrix3(nm3).normalize().toArray(nrm, i * 3);
      const k = src.key[i]; if (k && pal?.[k]) c.set(pal[k]); else if (k) c.set('#c8302c'); else c.fromArray(src.col, i * 3);
      if (low) c.multiplyScalar(shade(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]));
      c.toArray(col, i * 3);
    }
    chunks.push({ pos, nrm, col, uv: new Float32Array(n * 2).fill(0.75), si: new Uint16Array(n * 4).map((_, k) => (k % 4 ? 0 : bi)),
      sw: new Float32Array(n * 4).map((_, k) => (k % 4 ? 0 : 1)), index: null });
  }
  if (!chunks.length) return null;
  let nv = 0, ni = 0; for (const ch of chunks) { const n = ch.pos.length / 3; nv += n; ni += ch.index ? ch.index.length * (ch.double ? 2 : 1) : n; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), U = new Float32Array(nv * 2), SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4), I = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const ch of chunks) {
    const n = ch.pos.length / 3; P.set(ch.pos, ov * 3); N.set(ch.nrm, ov * 3); C.set(ch.col, ov * 3); U.set(ch.uv, ov * 2); SI.set(ch.si, ov * 4); SW.set(ch.sw, ov * 4);
    if (ch.index) { for (const x of ch.index) I[oi++] = x + ov; if (ch.double) for (let k = 0; k < ch.index.length; k += 3) { I[oi++] = ch.index[k] + ov; I[oi++] = ch.index[k + 2] + ov; I[oi++] = ch.index[k + 1] + ov; } }
    else for (let k = 0; k < n; k++) I[oi++] = ov + k;
    ov += n;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  g.setIndex(new THREE.BufferAttribute(I, 1)); return g;
}

function dress(p, gear, colors) {
  const body = bodyOf(p); if (!body) return Promise.resolve(null);
  const key = gearKey(gear) + '|' + JSON.stringify(colors || {});
  if (p.gearKey === key) return Promise.resolve(p.gearMesh || null);
  p.gearKey = key; const ticket = (p.gearTicket = (p.gearTicket || 0) + 1);
  const needLib = ['hat', 'eyes', 'parrot', 'hook'].some((s) => PIECES[`${s}:${gear[s]}`]);
  return (needLib ? loadLib(p.lod === 'lo' ? 'lo' : 'hi') : Promise.resolve(null)).then((lib) => {
    if (ticket !== p.gearTicket) return null;
    if (p.gearMesh) { p.gearMesh.removeFromParent(); p.gearMesh.geometry.dispose(); p.gearMesh = null; }
    setHandless(p, !!PIECES[`hook:${gear.hook}`]);
    const geo = buildGearGeometry(p, body, gear, lib, colors); if (!geo) return null;
    const m = new THREE.SkinnedMesh(geo, gearMat(p.lod === 'lo')); m.name = 'pirate-gear'; m.userData.isGear = true;
    m.frustumCulled = false; m.castShadow = p.lod !== 'lo';
    body.parent.add(m); m.bind(body.skeleton, body.bindMatrix); p.gearMesh = m; return m;
  }).catch((e) => { console.warn('[gear] failed, pirate stays as is', e); p.gearKey = null; return null; });
}

// public: dress a pirate. Works before the GLB arrives (applied on ready). colors: { cloth, trim } optional overrides.
export function applyGear(target, gear, colors = null) {
  const g = normalizeGear(gear), r = rootOf(target), p = pirateOf(target);
  if (r) { r.userData.gear = g; r.userData.gearColors = colors; }
  if (p) return dress(p, g, colors);
  return Promise.resolve(null);   // pirateFigure() applies r.userData.gear when its GLB is ready
}
// pirateFigure hook: called once the v4 GLB is in
export function gearOnReady(root, p) { const g = root.userData.gear; if (g) dress(p, g, root.userData.gearColors); }

window.PFP_GEAR = { applyGear, setLocalGear, getLocalGear, gearRenders, normalizeGear, GEAR_RENDERS, GEAR_DEFAULTS };
