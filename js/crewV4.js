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
import { loadPirateGLB, PIRATE_GLB_V5 as PIRATE_GLB, TINTS, prepV5Body } from './pirateGLB.js'; // [V6] crews stay on v5 Low (painted outfits) // [v121] the ship crews (yours, enemies, NPC ships) bake from the v5 Low bodies
import { skullTexture, ITEM_BY_ID } from './pirateItems.js'; // [v123] the hat skull decal texture (crew slot tF0)

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
  let body = null, face = null; const extra = [];
  scene.traverse(o => { if (o.isSkinnedMesh && o.geometry.attributes._tint && !body) body = o; else if (o.isSkinnedMesh && /^v5_face/.test(o.name)) extra.push(o); else if (o.isMesh && !o.isSkinnedMesh && !face) face = o; });
  if (!body) scene.traverse(o => { if (o.isSkinnedMesh && !body) body = o; });
  body.skeleton.update();
  const out = { pos: [], nrm: [], uv: [], col: [], tint: [], part: [] };
  let bodyEnd = 0; const main0 = body;
  for (const src of [body, ...extra]) { if (src !== main0 && !bodyEnd) bodyEnd = out.pos.length; // [v121] v5: the painted eyes are their own skinned mesh on the SAME atlas layout -> baked in with the body
  const body = src;
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
      out.uv.push(U ? U.getX(i) + slot + (src !== main0 ? 10 : 0) : -1, U ? U.getY(i) : -1); // [crew holes] the eyes sample their OWN map (slots 5 / 6 = tE0 / tE1): their uvs are the old albedo layout, not the per-part body atlas (streaked eyes)
      out.col.push(Cc ? Cc.getX(i) : 1, Cc ? Cc.getY(i) : 1, Cc ? Cc.getZ(i) : 1); out.tint.push(T ? Math.round(T.getX(i)) : -1);
      out.part.push(PARTN[bn(body.skeleton.bones[best]?.name)] || 0);
    } } }
  if (bodyEnd) { // [crew holes] the painted eyes sit a hair off the face: at crew scale they z-fought it (torn / streaked eyes). Lift them along their normal
    let y0 = Infinity, y1 = -Infinity; for (let i = 1; i < bodyEnd; i += 3) { y0 = Math.min(y0, out.pos[i]); y1 = Math.max(y1, out.pos[i]); } const e = (y1 - y0) * 0.004;
    for (let i = bodyEnd; i < out.pos.length; i++) out.pos[i] += out.nrm[i] * e; }
  if (face) { const g = face.geometry.index ? face.geometry.toNonIndexed() : face.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv; _n3.getNormalMatrix(face.matrixWorld);
    for (let i = 0; i < P.count; i++) { _v.fromBufferAttribute(P, i).applyMatrix4(face.matrixWorld); out.pos.push(_v.x, _v.y, _v.z); _n.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize(); out.nrm.push(_n.x, _n.y, _n.z);
      out.uv.push(U.getX(i) + slot + 4, U.getY(i)); out.col.push(1, 1, 1); out.tint.push(-1); out.part.push(0); } }
  { // [v123] smooth crew normals: weld by position + 2 neighbour passes. The v5 hair is a spiky sculpt; per-face normals made the
    // crew shader's inked rim / light bands speckle it ("shredded" hair, white shoulder patches). Shape is untouched.
    const P = out.pos, N = out.nrm, n = P.length / 3, key = new Int32Array(n), map = new Map(); let K = 0;
    for (let i = 0; i < n; i++) { const k = Math.round(P[i * 3] * 400) + ',' + Math.round(P[i * 3 + 1] * 400) + ',' + Math.round(P[i * 3 + 2] * 400);
      let id = map.get(k); if (id === undefined) { id = K++; map.set(k, id); } key[i] = id; }
    let acc = new Float32Array(K * 3); for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) acc[key[i] * 3 + a] += N[i * 3 + a];
    const nb = Array.from({ length: K }, () => new Set()); for (let v = 0; v + 2 < n; v += 3) { const a = key[v], b = key[v + 1], c = key[v + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
    for (let it = 0; it < 2; it++) { const nx = acc.slice(); for (let k = 0; k < K; k++) for (const j of nb[k]) { const l = Math.hypot(acc[j * 3], acc[j * 3 + 1], acc[j * 3 + 2]) || 1; for (let a = 0; a < 3; a++) nx[k * 3 + a] += acc[j * 3 + a] / l * 0.5; } acc = nx; }
    for (let i = 0; i < n; i++) { const k = key[i], l = Math.hypot(acc[k * 3], acc[k * 3 + 1], acc[k * 3 + 2]) || 1; for (let a = 0; a < 3; a++) N[i * 3 + a] = acc[k * 3 + a] / l; } }
  { // [v122] v5 hotfix: the decimated Low body has a few triangles wound against their normals; crews render front faces only -> holes. Re-wind them.
    const P = out.pos, N = out.nrm, sw = (a, s, i, j) => { for (let k = 0; k < s; k++) { const x = a[i * s + k]; a[i * s + k] = a[j * s + k]; a[j * s + k] = x; } };
    for (let v = 0; v + 2 < P.length / 3; v += 3) { const i = v * 3;
      const ax = P[i + 3] - P[i], ay = P[i + 4] - P[i + 1], az = P[i + 5] - P[i + 2], bx = P[i + 6] - P[i], by = P[i + 7] - P[i + 1], bz = P[i + 8] - P[i + 2];
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      if (cx * (N[i] + N[i + 3] + N[i + 6]) + cy * (N[i + 1] + N[i + 4] + N[i + 7]) + cz * (N[i + 2] + N[i + 5] + N[i + 8]) < 0) {
        sw(P, 3, v + 1, v + 2); sw(N, 3, v + 1, v + 2); sw(out.uv, 2, v + 1, v + 2); sw(out.col, 3, v + 1, v + 2); sw(out.tint, 1, v + 1, v + 2); sw(out.part, 1, v + 1, v + 2); } } }
  const bone = (nm) => { const b = body.skeleton.bones.find(q => bn(q.name) === bn(nm)); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
  return { out, hip: bone('thigh.L'), sh: bone('upperarm.L'), head: bone('head'), tex: [body.material.map, face?.material.map || null, extra[0]?.material?.map || null] };
}
function finish(b, k, y0) { // normalise: feet on y 0, CREW_H tall, centred on x/z
  const p = b.out.pos; for (let i = 0; i < p.length; i += 3) { p[i] *= k; p[i + 1] = (p[i + 1] - y0) * k; p[i + 2] *= k; }
  return { pos: new Float32Array(p), nrm: new Float32Array(b.out.nrm), uv: new Float32Array(b.out.uv), col: new Float32Array(b.out.col), tint: b.out.tint, part: new Float32Array(b.out.part) };
}
let _loading = null;
export function initCrewV4({ lod = 'lo' } = {}) { // [crew holes] lod from pirateBodyLod({ many: true }) in main.js
  if (_loading) return _loading;
  _loading = (async () => {
    const [gm, gf] = await Promise.all([loadPirateGLB(PIRATE_GLB.male[lod]), loadPirateGLB(PIRATE_GLB.female[lod])]);
    for (const g of [gm, gf]) prepV5Body(g.scene, lod); // [crew holes] the same hair rim the walking crew get (it was only there if a PirateGLB of that LOD happened to load first)
    const tpl = {}, tex = [];
    let hipY = 0.36, shY = 0.72, eyeY = 0.97;
    for (const [sex, g, slot] of [['m', gm, 0], ['f', gf, 2]]) {
      const idle = bake(g, 'idle', 0, slot), gun = bake(g, 'cannon', 0, slot);
      let y0 = Infinity, y1 = -Infinity; for (let i = 1; i < idle.out.pos.length; i += 3) { y0 = Math.min(y0, idle.out.pos[i]); y1 = Math.max(y1, idle.out.pos[i]); }
      const k = CREW_H / (y1 - y0);
      if (sex === 'm') { if (idle.hip) hipY = (idle.hip.y - y0) * k; if (idle.sh) shY = (idle.sh.y - y0) * k; if (idle.head) eyeY = (idle.head.y - y0) * k + 0.12; }
      tpl[sex] = { idle: finish(idle, k, y0), cannon: finish(gun, k, y0), k, y0 }; tex[slot === 0 ? 0 : 1] = idle.tex[0]; tex[slot === 0 ? 2 : 3] = idle.tex[1] || (slot === 0 ? skullTexture() : null); tex[slot === 0 ? 4 : 5] = idle.tex[2] || null; // [v123] v5 has no face decal: slot tF0 = the hat skull
    }
    for (const t of tex) if (t) { t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; }
    V4 = { tpl, tex, hipY, shY, eyeY }; return V4;
  })().catch(e => { console.warn('[crew] v4 pirates failed, keeping the procedural crew', e); return null; });
  return _loading;
}
// one seat's pirate: stable look from the seat id v; pose 'idle' | 'cannon'. Same attributes as crew.js pirate(): position, normal, color, aPart (+ uv)
const _cache = new Map(), _c = new THREE.Color();
export const crewFemale = (v) => hash(v * 3.17 + 1) < 0.42;
export function crewPirateV4(v, pose = 'idle', { female: fem = null } = {}) {
  const key = v + '|' + pose + '|' + fem; if (_cache.has(key)) return _cache.get(key);
  const female = fem ?? crewFemale(v), T = V4.tpl[female ? 'f' : 'm'][pose] || V4.tpl[female ? 'f' : 'm'].idle;
  const skin = _c.set(SKIN[Math.floor(hash(v * 5.3 + 2) * SKIN.length)]).clone(), hair = _c.set(HAIR[Math.floor(hash(v * 7.9 + 3) * HAIR.length)]).clone();
  const col = T.col.slice(), iS = TINTS.indexOf('skin'), iH = TINTS.indexOf('hair');
  for (let i = 0; i < T.tint.length; i++) { const t = T.tint[i], c = t === iS ? skin : t === iH ? hair : null; if (c) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(T.pos.slice(), 3)); g.setAttribute('normal', new THREE.BufferAttribute(T.nrm.slice(), 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(T.part.slice(), 1)); g.setAttribute('uv', new THREE.BufferAttribute(T.uv.slice(), 2));
  _cache.set(key, g); return g;
}

// [v106] CREW GEAR (BANKSY: "Make sure all the pirates on my ship wear same clothes I choose"). The player's hat + clothes are put
// on a hidden Low v4 pirate (male + female) with Timothy's applyGear (same colours / hat colour rules as your own pirate), posed with
// the same clips the crew bodies were baked from (idle, cannon), and baked to static crew-space chunks: position, normal, colour,
// shader part (dominant bone), uv (slot 4 = the gear stripe texture). js/crew.js merges a chunk onto every seat's body, so the
// dressed crew is STILL one mesh / one draw call per ship. Hooks, pegs, parrots and eyewear stay on the captain only.
const _gp = {}; let _gearMod = null;
const gearMod = () => (_gearMod ||= import('./pirateGear.js'));
async function gearPirate(sex) {
  if (_gp[sex]) return _gp[sex];
  const { PirateGLB } = await import('./pirateGLB.js');
  // [v280 crew holes] bake clothes on the V5 Low body (painted pants), not live V6 (bare underwear + neck splice gaps). Body seats stay V5.
  return (_gp[sex] = PirateGLB.create({ female: sex === 'f', lod: 'lo', body: 'v5' }).then((p) => { p.forCrew = true; return p; }));   // [v133] crews bake the light Low tops
}
export const CREW_GEAR_SLOTS = ['hat', 'outfit']; // what the crew copies from the captain (hatColor rides along)
// [Raul shop2 fixes] BANKSY via Emerly "deck crew wear the new items": the crew keep THEIR OWN hat + outfit (Crew Shop, js/crewLoadout.js) and
// also wear the captain's shop-items-2 EXTRAS: beard (male crew only, like the captain), earrings, gold teeth, boots, cape. Pets + pegs stay
// on the captain (no ship full of monkeys). Phone / Low crews: beard + cape only (earrings / teeth / boots are sub-pixel at crew size and
// cost the most triangles per seat). Baked into the same chunk: still ONE crew draw call per ship.
export const CREW_EXTRA_SLOTS = [], CREW_EXTRA_LOW = [];   // [v184] BANKSY "Crew shouldn't copy any of my items": no captain extras on the crew (they keep their own Crew Shop hat + coat)
export function captainExtras(gear, low = false) {
  const o = {}; for (const k of low ? CREW_EXTRA_LOW : CREW_EXTRA_SLOTS) if (gear?.[k] && gear[k] !== 'none') o[k] = gear[k]; return o;
}
export function crewGearOf(gear) {
  if (!gear) return null; const g = { hat: gear.hat || 'none', outfit: gear.outfit || 'shirtless', eyes: 'plain', parrot: 'none', hook: 'none', hatColor: gear.hatColor | 0, outfitColor: gear.outfitColor | 0 }; // [Timothy] + the free clothes colour
  for (const k of CREW_EXTRA_SLOTS) if (gear[k] && gear[k] !== 'none') g[k] = gear[k];   // [Raul shop2 fixes]
  return (g.hat === 'none' && g.outfit === 'shirtless' && !CREW_EXTRA_SLOTS.some((k) => g[k])) ? null : g;
}
// [v280 crew holes] shore followers (V6 bodies) get classic pants under the Crew Shop top so the lo underwear hem gap stays covered. Ship bake stays without pants (V5 seats already have painted pants). &crewholes=0 = bare.
export function shoreCrewGear(gear) {
  const g = crewGearOf(gear); if (!g) return g;
  if (typeof location !== 'undefined' && /[?&]crewholes=0(?:&|$)/.test(location.search)) return g;
  if (!g.pants || g.pants === 'none') return { ...g, pants: 'classic_pants' };
  return g;
}
const _gc = new Map();
export function crewGearV4(gear, colors = null) { // -> Promise<{ m: { idle, cannon }, f: {...} } | null>
  const g = crewGearOf(gear); if (!g || !V4) return Promise.resolve(null);
  const key = JSON.stringify([g, colors]); if (_gc.has(key)) return _gc.get(key);
  const pr = (async () => {
    const PG = await gearMod(), out = {};
    for (const sex of ['m', 'f']) {
      const p = await gearPirate(sex); await PG.applyGear(p, g, colors);
      // [Timothy] ONE gear system: Timothy's merged gear mesh + Raul's skinned items (tricorn, crown, pirate shirt, captain's coat; js/pirateItems.js)
      const items = Object.values(p.items || {}).map((it) => it.obj).filter((o) => o?.isSkinnedMesh && o.parent), meshes = [...(p.gearMesh ? [p.gearMesh] : []), ...items];
      if (!meshes.length) return null;
      out[sex] = {}; out[sex].top = g.outfit !== 'shirtless';   // [v128] the seat body is pulled in under tops (as the player since v124)
      const crown = Object.values(p.items || {}).find((it) => it.id === 'crown')?.obj; // [v109b] its velvet takes each seat's own hair colour
      const decals = Object.values(p.items || {}).map((it) => it.decal).filter((o) => o?.isSkinnedMesh && o.parent); // [v123] the PUMPFUN skull on the hat (crew slot tF0)
      const hairy = new Set(Object.values(p.items || {}).filter((it) => /^beard_(moustache|forked)$/.test(it.id)).map((it) => it.obj));   // [Raul shop2 fixes] beards in each seat's hair colour
      const raul2 = new Set(Object.values(p.items || {}).filter((it) => it.obj && ITEM_BY_ID[it.id]?.single).map((it) => it.obj));   // shop items 2: drop their ink shells (the crew shader inks its own rim)
      for (const pose of ['idle', 'cannon']) out[sex][pose] = joinChunks([...meshes.map((m) => bakeGear(p, m, pose, V4.tpl[sex], m !== p.gearMesh, m === crown ? 1 : hairy.has(m) ? 2 : 0, false, raul2.has(m))), ...decals.map((m) => bakeGear(p, m, pose, V4.tpl[sex], false, false, true))]);
    }
    return out;
  })().catch((e) => { console.warn('[crew] gear bake failed, crew keeps the default outfit', e); _gc.delete(key); return null; });
  _gc.set(key, pr); return pr;
}
function joinChunks(cs) { // [Timothy] several baked chunks -> one (same layout)
  if (cs.length === 1) return cs[0]; const o = {};
  for (const k of ['pos', 'nrm', 'col', 'uv', 'part', 'vel']) { const n = cs.reduce((a, c) => a + c[k].length, 0), a = new Float32Array(n); let off = 0; for (const c of cs) { a.set(c[k], off); off += c[k].length; } o[k] = a; }
  return o;
}
// [Raul gear colours] a map's pixels (cached per image) for the per-vertex sample above (the HQ helmet / luchador mask in the crew's colour)
const _texPx = new WeakMap();
function texPixels(t) {
  const img = t?.image; if (!img?.width || typeof document === 'undefined') return null; if (_texPx.has(img)) return _texPx.get(img);
  let r = null; try { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); r = { w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data }; } catch (e) { console.warn('[crew] map sample', e); }
  _texPx.set(img, r); return r;
}
function bakeGear(p, mesh, pose, T, plain = false, velvet = false, decal = false, noInk = false) {   // velvet: 1 = crown velvet (accent tint), 2 = the whole item (beards, scaled by its own shade) // plain: no stripe uv (Raul's items: vertex colour only)
  const clip = p.clips[pose] || p.clips.idle; p.mixer.stopAllAction(); p.action = null; p.clip = null;
  if (clip) { const a = p.mixer.clipAction(clip); a.reset().play(); p.mixer.update(0); }
  p.scene.updateMatrixWorld(true); mesh.skeleton.update();
  const g = mesh.geometry, P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color, U = g.attributes.uv, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
  let idx = g.index ? g.index.array : null; const bm = mesh.skeleton.boneMatrices, bones = mesh.skeleton.bones;
  if (noInk && idx && C) { const keep = [], isInk = (i) => { const r = C.getX(i), g = C.getY(i), b = C.getZ(i); return r > 0.003 && r < 0.0088 && Math.abs(g / r - 0.747) < 0.05 && Math.abs(b / r - 0.63) < 0.07; };
    // [Raul shop2 fixes] drop the item's inverted-hull ink shell (INK #15110f, x the Low light bake): the crew material is DoubleSide, so the
    // shell would paint the whole item black; the crew shader draws its own rim ink. Halves the triangles per seat too.
    for (let t = 0; t < idx.length; t += 3) if (!(isInk(idx[t]) && isInk(idx[t + 1]) && isInk(idx[t + 2]))) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    idx = keep; }
  const n = idx ? idx.length : P.count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2), part = new Float32Array(n), vel = new Float32Array(n);
  let vmax = 0; if (velvet === 2 && C) for (let i = 0; i < C.count; i++) vmax = Math.max(vmax, C.getX(i) + C.getY(i) + C.getZ(i));
  const TT = velvet === 1 ? g.attributes._tint : null, iA = TINTS.indexOf('accent'), TX = plain && mesh.userData.texVerts ? texPixels(mesh.material?.map) : null;   // [Raul gear colours] helmet / mask: their painted (recoloured) map
  const full = new THREE.Matrix4();
  for (let q = 0; q < n; q++) {
    const i = idx ? idx[q] : q;
    _v.fromBufferAttribute(P, i); mesh.applyBoneTransform(i, _v); _v.applyMatrix4(mesh.matrixWorld);
    pos[q * 3] = _v.x * T.k; pos[q * 3 + 1] = (_v.y - T.y0) * T.k; pos[q * 3 + 2] = _v.z * T.k;
    _m.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = W.getComponent(i, k); if (w <= 0) continue; const j = J.getComponent(i, k); _t.fromArray(bm, j * 16);
      for (let e = 0; e < 16; e++) _m.elements[e] += _t.elements[e] * w; if (w > bw) { bw = w; best = j; } }
    full.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(_m).multiply(mesh.bindMatrix); _n3.setFromMatrix4(full);
    _n.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize(); nrm[q * 3] = _n.x; nrm[q * 3 + 1] = _n.y; nrm[q * 3 + 2] = _n.z;
    col[q * 3] = C ? C.getX(i) : 1; col[q * 3 + 1] = C ? C.getY(i) : 1; col[q * 3 + 2] = C ? C.getZ(i) : 1;
    if (TX && U) { const x = Math.min(TX.w - 1, Math.floor((U.getX(i) % 1 + 1) % 1 * TX.w)), y = Math.min(TX.h - 1, Math.floor((U.getY(i) % 1 + 1) % 1 * TX.h)), o = (y * TX.w + x) * 4, D = TX.d;
      col[q * 3] *= (D[o] / 255) ** 2.2; col[q * 3 + 1] *= (D[o + 1] / 255) ** 2.2; col[q * 3 + 2] *= (D[o + 2] / 255) ** 2.2; }   // [Raul gear colours] painted map -> vertex colour (linear)
    uv[q * 2] = decal ? 4 + Math.min(0.999, U.getX(i)) : 8 + (U && !plain ? U.getX(i) : 0.75); uv[q * 2 + 1] = U && !plain ? U.getY(i) : 0;
    if (decal) { col[q * 3] = col[q * 3 + 1] = col[q * 3 + 2] = 1; }
    part[q] = PARTN[bn(bones[best]?.name)] || 0; if (TT && Math.round(TT.getX(i)) === iA) vel[q] = 1;
    if (velvet === 2 && vmax > 0) vel[q] = Math.max(0.05, (col[q * 3] + col[q * 3 + 1] + col[q * 3 + 2]) / vmax);   // the seat's hair x this vertex's shade (a shade darker under the braids)
  }
  return { pos, nrm, col, uv, part, vel };
}
// one seat's body + the baked gear chunk -> one geometry (same attributes as crewPirateV4)
const _dc = new Map();
export function crewPirateV4Dressed(v, pose, chunks, tag) {
  const female = crewFemale(v), ch = chunks?.[female ? 'f' : 'm']?.[pose] || chunks?.[female ? 'f' : 'm']?.idle;
  const base = crewPirateV4(v, pose); if (!ch) return base;
  const key = v + '|' + pose + '|' + tag; if (_dc.has(key)) return _dc.get(key);
  const cat = (a, b, k) => { const o = new Float32Array(a.length + b.length); o.set(a); o.set(b, a.length); return new THREE.BufferAttribute(o, k); };
  const A = base.attributes, g = new THREE.BufferGeometry();
  let BP = A.position.array;
  if (chunks?.[female ? 'f' : 'm']?.top) {   // [v128] BANKSY "fix the holes in crew members": the seat body's belt / waist poked out through the coat
    BP = BP.slice(); let H = 0; for (let i = 1; i < BP.length; i += 3) H = Math.max(H, BP[i]);   // and showed as holes in its back; pull the torso in under the top
    let cx = 0, cz = 0, c = 0; for (let i = 0; i < BP.length; i += 3) { const y = BP[i + 1] / H; if (y > 0.36 && y < 0.72) { cx += BP[i]; cz += BP[i + 2]; c++; } } cx /= c || 1; cz /= c || 1;
    for (let i = 0; i < BP.length; i += 3) { const y = BP[i + 1] / H; if (y <= 0.34 || y >= 0.74) continue; const w = Math.min(1, (y - 0.34) / 0.04, (0.74 - y) / 0.04), s = 1 - 0.12 * w;
      BP[i] = cx + (BP[i] - cx) * s; BP[i + 2] = cz + (BP[i + 2] - cz) * s; }
  }
  g.setAttribute('position', cat(BP, ch.pos, 3)); g.setAttribute('normal', cat(A.normal.array, ch.nrm, 3)); g.setAttribute('color', cat(A.color.array, ch.col, 3));
  g.setAttribute('aPart', cat(A.aPart.array, ch.part, 1)); g.setAttribute('uv', cat(A.uv.array, ch.uv, 2));
  if (ch.vel?.some?.((x) => x)) { const hair = _c.set(HAIR[Math.floor(hash(v * 7.9 + 3) * HAIR.length)]), C = g.attributes.color.array, o = A.position.count; // [v109b] crown velvet = this seat's hair
    for (let q = 0; q < ch.vel.length; q++) if (ch.vel[q]) { const k = ch.vel[q]; C[(o + q) * 3] = hair.r * k; C[(o + q) * 3 + 1] = hair.g * k; C[(o + q) * 3 + 2] = hair.b * k; } }
  if (_dc.size > 400) _dc.clear(); _dc.set(key, g); return g;
}
