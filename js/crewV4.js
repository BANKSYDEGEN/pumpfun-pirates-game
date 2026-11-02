// [Emerly v101] PUMPFUN PIRATES: Raul's Blender pirates v4 as the SHIP CREW (BANKSY: "Make all the pirates on ship those style";
// "They can be girls or different skin or hair colors but have them wearing what captain is").
// The crew stays ONE merged mesh + ONE draw call per ship with all animation in js/crew.js's vertex shader: here each v4 Low
// body (male / female, ~1.1k tris) is posed ONCE on the CPU from Raul's own clips (idle; cannon for gunners), baked to static
// geometry, split into the shader's parts by dominant bone (legs / arms swing about the real hip + shoulder heights) and
// normalised to the old crew height. Clothes = the captain's (Raul's baked v4 outfit colours, never per skin); per seat only
// the body (male / female), skin tone and hair colour vary, from a stable hash of the seat, so nothing flickers.
// Textures (body atlas + face decal, male + female) ride in the same material: uv.x carries a texture slot offset.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { loadPirateGLB, PIRATE_GLB, TINTS } from './pirateGLB.js';

export const CREW_H = 1.25;                     // the procedural crew's height (feet y 0, faces +Z); uS scales it on the ship
export let V4 = null;                           // { tpl: { m: { idle, cannon }, f: {...} }, tex: [atlasM, atlasF, faceM, faceF], hipY, shY, eyeY }
const SKIN = [0xf2c9a0, 0xe0ac7e, 0xc68a5e, 0x9a6440, 0x6e4528, 0xf5d6b8];
const HAIR = [0x1a1410, 0x4a2c17, 0x8a5a2b, 0xd9b25a, 0x161616, 0xb5401f, 0x7a4a22];
const hash = (i) => ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
const PART = { 'thigh.L': 1, 'shin.L': 1, 'thigh.R': 2, 'shin.R': 2, 'upperarm.L': 3, 'forearm.L': 3, 'upperarm.R': 4, 'forearm.R': 4 };
const bn = (s) => (s || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase(); // GLTFLoader sanitises 'thigh.L' -> 'thighL'
const PARTN = Object.fromEntries(Object.entries(PART).map(([k, v]) => [bn(k), v]));

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4(), _t = new THREE.Matrix4(), _n3 = new THREE.Matrix3();
function bake(gltf, clipName, time, slot) {
  const scene = SkeletonUtils.clone(gltf.scene); scene.updateMatrixWorld(true);
  const clip = gltf.animations.find(a => a.name === clipName) || gltf.animations.find(a => a.name === 'idle');
  if (clip) { const mx = new THREE.AnimationMixer(scene); mx.clipAction(clip).play(); mx.update(Math.min(time, clip.duration * 0.999)); }
  scene.updateMatrixWorld(true);
  let body = null, face = null; scene.traverse(o => { if (o.isSkinnedMesh && !body) body = o; else if (o.isMesh && !o.isSkinnedMesh && !face) face = o; });
  body.skeleton.update();
  const out = { pos: [], nrm: [], uv: [], col: [], tint: [], part: [] };
  { const g = body.geometry = body.geometry.index ? body.geometry.toNonIndexed() : body.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv,
      Cc = g.attributes.color, T = g.attributes._tint, J = g.attributes.skinIndex, W = g.attributes.skinWeight, bm = body.skeleton.boneMatrices;
    const full = new THREE.Matrix4();
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i); body.applyBoneTransform(i, _v); _v.applyMatrix4(body.matrixWorld); out.pos.push(_v.x, _v.y, _v.z);
      _m.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); let best = -1, bw = -1;
      for (let k = 0; k < 4; k++) { const w = W.getComponent(i, k); if (w <= 0) continue; const j = J.getComponent(i, k); _t.fromArray(bm, j * 16);
        for (let e = 0; e < 16; e++) _m.elements[e] += _t.elements[e] * w; if (w > bw) { bw = w; best = j; } }
      full.copy(body.matrixWorld).multiply(body.bindMatrixInverse).multiply(_m).multiply(body.bindMatrix); _n3.setFromMatrix4(full);
      _n.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize(); out.nrm.push(_n.x, _n.y, _n.z);
      out.uv.push(U ? U.getX(i) + slot : -1, U ? U.getY(i) : -1);
      out.col.push(Cc ? Cc.getX(i) : 1, Cc ? Cc.getY(i) : 1, Cc ? Cc.getZ(i) : 1); out.tint.push(T ? Math.round(T.getX(i)) : -1);
      out.part.push(PARTN[bn(body.skeleton.bones[best]?.name)] || 0);
    } }
  if (face) { const g = face.geometry.index ? face.geometry.toNonIndexed() : face.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv; _n3.getNormalMatrix(face.matrixWorld);
    for (let i = 0; i < P.count; i++) { _v.fromBufferAttribute(P, i).applyMatrix4(face.matrixWorld); out.pos.push(_v.x, _v.y, _v.z); _n.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize(); out.nrm.push(_n.x, _n.y, _n.z);
      out.uv.push(U.getX(i) + slot + 4, U.getY(i)); out.col.push(1, 1, 1); out.tint.push(-1); out.part.push(0); } }
  const bone = (nm) => { const b = body.skeleton.bones.find(q => bn(q.name) === bn(nm)); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
  return { out, hip: bone('thigh.L'), sh: bone('upperarm.L'), head: bone('head'), tex: [body.material.map, face?.material.map || null] };
}
function finish(b, k, y0) { // normalise: feet on y 0, CREW_H tall, centred on x/z
  const p = b.out.pos; for (let i = 0; i < p.length; i += 3) { p[i] *= k; p[i + 1] = (p[i + 1] - y0) * k; p[i + 2] *= k; }
  return { pos: new Float32Array(p), nrm: new Float32Array(b.out.nrm), uv: new Float32Array(b.out.uv), col: new Float32Array(b.out.col), tint: b.out.tint, part: new Float32Array(b.out.part) };
}
let _loading = null;
export function initCrewV4() {
  if (_loading) return _loading;
  _loading = (async () => {
    const [gm, gf] = await Promise.all([loadPirateGLB(PIRATE_GLB.male.lo), loadPirateGLB(PIRATE_GLB.female.lo)]);
    const tpl = {}, tex = [];
    let hipY = 0.36, shY = 0.72, eyeY = 0.97;
    for (const [sex, g, slot] of [['m', gm, 0], ['f', gf, 2]]) {
      const idle = bake(g, 'idle', 0, slot), gun = bake(g, 'cannon', 0, slot);
      let y0 = Infinity, y1 = -Infinity; for (let i = 1; i < idle.out.pos.length; i += 3) { y0 = Math.min(y0, idle.out.pos[i]); y1 = Math.max(y1, idle.out.pos[i]); }
      const k = CREW_H / (y1 - y0);
      if (sex === 'm') { if (idle.hip) hipY = (idle.hip.y - y0) * k; if (idle.sh) shY = (idle.sh.y - y0) * k; if (idle.head) eyeY = (idle.head.y - y0) * k + 0.12; }
      tpl[sex] = { idle: finish(idle, k, y0), cannon: finish(gun, k, y0) }; tex[slot === 0 ? 0 : 1] = idle.tex[0]; tex[slot === 0 ? 2 : 3] = idle.tex[1];
    }
    for (const t of tex) if (t) { t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; }
    V4 = { tpl, tex, hipY, shY, eyeY }; return V4;
  })().catch(e => { console.warn('[crew] v4 pirates failed, keeping the procedural crew', e); return null; });
  return _loading;
}
// one seat's pirate: stable look from the seat id v; pose 'idle' | 'cannon'. Same attributes as crew.js pirate(): position, normal, color, aPart (+ uv)
const _cache = new Map(), _c = new THREE.Color();
export function crewPirateV4(v, pose = 'idle', { female: fem = null } = {}) {
  const key = v + '|' + pose + '|' + fem; if (_cache.has(key)) return _cache.get(key);
  const female = fem ?? hash(v * 3.17 + 1) < 0.42, T = V4.tpl[female ? 'f' : 'm'][pose] || V4.tpl[female ? 'f' : 'm'].idle;
  const skin = _c.set(SKIN[Math.floor(hash(v * 5.3 + 2) * SKIN.length)]).clone(), hair = _c.set(HAIR[Math.floor(hash(v * 7.9 + 3) * HAIR.length)]).clone();
  const col = T.col.slice(), iS = TINTS.indexOf('skin'), iH = TINTS.indexOf('hair');
  for (let i = 0; i < T.tint.length; i++) { const t = T.tint[i], c = t === iS ? skin : t === iH ? hair : null; if (c) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(T.pos.slice(), 3)); g.setAttribute('normal', new THREE.BufferAttribute(T.nrm.slice(), 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(T.part.slice(), 1)); g.setAttribute('uv', new THREE.BufferAttribute(T.uv.slice(), 2));
  _cache.set(key, g); return g;
}
