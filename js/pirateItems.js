// [Raul] PUMPFUN PIRATES shop cosmetics for the v4 Blender pirates (js/pirateGLB.js). Built by tools/blender/build_items.py into
// assets/pirates/items/item_<id>[_<base>]_{hi,lo}.glb. Each item = ONE mesh + ONE material (+1 draw call at High and Low):
//  - skinned items (hat, crown, hooks, pegs, shirt, suit) are authored in the pirate's T-pose bind space on the same armature and are
//    rebound here to the pirate's own skeleton by bone name, so they follow every clip (idle / walk / run / cannon / steer);
//  - the parrot has its own mini rig + 'parrot_idle' loop and rides the spine bone at the left shoulder.
// Covered base parts (hair under a hat, the hand under a hook, the boot under a peg, the female wrap top under an outfit) are hidden by
// rebuilding the base mesh index from bind-space rules (per pirate, attributes stay shared) -> no extra draw calls, no base rebuild.
// Usage (Timothy's shop):  import { ITEMS, equip, unequip, equipped } from './pirateItems.js';
//   const p = await PirateGLB.create({ female, lod }); await equip(p, 'crown'); await equip(p, 'suit', { colors: { coat: '#1d2a52' } });
//   unequip(p, 'head') // or unequip(p, 'crown');  equipped(p) -> { head: 'crown', outfit: 'suit' };  p.update(dt) also ticks the parrot.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { v5Fwd, v5Inv, v5Hat, loadPirateGLB, gradient, TINTS } from './pirateGLB.js';

const DIR = 'assets/pirates/items/', HY = 1.12;
export const ITEM_SLOTS = ['head', 'handL', 'handR', 'legL', 'legR', 'outfit', 'shoulder'];
const files = (id, perBase) => Object.fromEntries(['male', 'female'].map((b) => [b, Object.fromEntries(['hi', 'lo'].map((l) => [l, `${DIR}item_${id}${perBase ? '_' + b : ''}_${l}.glb`]))]));
const item = (id, label, slot, price, tint, hide, o = {}) => ({ id, label, slot, price, currency: 'gold', glb: (o.perBase ? files(id, 1) : files(id)).male.hi,
  icon: `${DIR}icons/${id}.png`, tint, files: files(id, o.perBase), hide, ...o });
// hide rules (bind space, three units): region (cyl | arm | leg | torso | sph | all) AND optional tint keys ('fixed' = untinted parts)
export const ITEMS = [
  item('hat_tricorn', 'Pirate Hat', 'head', 250, { hat: '#18181b' }, [{ cyl: [0, -0.005, 0.27], y: [HY + 0.085, 9], tilt: 0.1, tints: ['hair'] }]),
  item('crown', 'Pirate King Crown', 'head', 1200, { accent: '#8e1b2a' }, [{ cyl: [0, 0, 0.228], y: [HY + 0.15, 9], tilt: 0.06, tints: ['hair'] }]),
  item('hook_l', 'Hook Arm (Left)', 'handL', 400, null, [{ arm: 'L', s: 0.29 }]),
  item('hook_r', 'Hook Arm (Right)', 'handR', 400, null, [{ arm: 'R', s: 0.29 }]),
  item('peg_l', 'Peg Leg (Left)', 'legL', 400, { boots: '#221a16' }, [{ leg: 'L', y: 0.225, tints: ['pants'] }, { leg: 'L', y: 0.3, tints: ['boots', 'fixed'] }]),
  item('peg_r', 'Peg Leg (Right)', 'legR', 400, { boots: '#221a16' }, [{ leg: 'R', y: 0.225, tints: ['pants'] }, { leg: 'R', y: 0.3, tints: ['boots', 'fixed'] }]),
  item('shirt', 'Pirate Shirt', 'outfit', 300, { shirt: '#f4efe3' }, [{ all: 1, tints: ['shirt'], lod: 'hi' }, { torso: [0.47, 0.62], tints: ['skin'], female: 1 }, { torso: [0.47, 0.54], tints: ['skin'], male: 1 }, { torso: [0.47, 0.86], back: 1, tints: ['skin'] },
    { arm: 'L', s: [0.04, 0.18], tints: ['skin'] }, { arm: 'R', s: [0.04, 0.18], tints: ['skin'] },
    { v5: 1, v5torso: [0.36, 0.95, 0.16], vneck: 0.62, tints: ['skin', 'shirt'] }], { perBase: true }),   // [v121] v5: the body under the shirt
  item('suit', "Captain's Coat", 'outfit', 900, { coat: '#b3201f', accent: '#1d2a52' }, [{ all: 1, tints: ['shirt'] }, { torso: [0.47, 0.75], tints: ['skin'], female: 1 }, { torso: [0.47, 0.59], tints: ['skin'], male: 1 }, { torso: [0.47, 0.86], back: 1, tints: ['skin'] },
    { arm: 'L', s: [0.04, 0.3], tints: ['skin'] }, { arm: 'R', s: [0.04, 0.3], tints: ['skin'] },
    { v5: 1, v5torso: [0.36, 0.95, 0.28], vneck: 0.66, tints: ['skin', 'shirt'] }], { perBase: true }),   // [v121] v5: the body under the coat
  item('parrot', 'Parrot', 'shoulder', 1500, null, [],
    { attach: { bone: 'spine', feet: [0.242, 0.916, -0.016], offset: { male: [0, 0, 0], female: [0.05, -0.034, 0.0] }, lean: { male: 0, female: -0.42 } }, clip: 'parrot_idle' }),
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
export const itemsForSlot = (slot) => ITEMS.filter((d) => d.slot === slot);

const TI = (k) => (k === 'fixed' ? -1 : TINTS.indexOf(k));
const sArm = (x, y, sx) => (x - sx * 0.215) * sx * Math.sin(1.48) + (y - 0.86) * -Math.cos(1.48);   // distance along the T-pose arm from the shoulder
function ruleHit(r, x, y, z, t, female, lod, v5 = false) {
  if (r.v5 && !v5) return false;   // [v121] rules for the v5 bodies only
  if (r.female && !female) return false;
  if (r.male && female) return false;
  if (r.lod && r.lod !== lod && !v5) return false;   // v5: the base top hides under the shirt / coat on BOTH LODs
  if (r.v5torso) { const [y0, y1, s1] = r.v5torso; if (y < y0 || y > y1) return false;   // v5 torso (+ upper arms to s1) under a garment, front V-neck kept
    if (r.vneck && z > 0 && Math.abs(x) < 0.075 && y > r.vneck) return false;
    if (Math.abs(x) < 0.2) return true; if (!s1) return false; const s = sArm(x, y, x > 0 ? 1 : -1); return s < s1; }   // Low keeps the wrap top under the shirt (its chest skin is baked dark under it)
  if (r.tints && !r.tints.some((k) => TI(k) === t)) return false;
  if (r.all) return true;
  if (r.cyl) { const [cx, cz, rr] = r.cyl, dx = x - cx, dz = z - cz; return dx * dx + dz * dz < rr * rr && y > r.y[0] + (r.tilt || 0) * z && y < r.y[1]; }
  if (r.sph) { const [cx, cy, cz, rr] = r.sph; return (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 < rr * rr; }
  if (r.arm) { const sx = r.arm === 'L' ? 1 : -1; if (sx * x < 0.1) return false; const s = sArm(x, y, sx); return Array.isArray(r.s) ? s > r.s[0] && s < r.s[1] : s > r.s; }
  if (r.torso) return y > r.torso[0] && y < r.torso[1] && Math.abs(x) < 0.24 && (Math.abs(x) < 0.1 || sArm(x, y, x > 0 ? 1 : -1) < -0.01) && (!r.back || z < -0.02);
  if (r.leg) { const sx = r.leg === 'L' ? 1 : -1; return sx * x > 0 && Math.abs(x - sx * 0.09) < 0.16 && y < r.y; }
  return false;
}
function ownGeometry(o) {  // per-pirate geometry sharing the attributes (SkeletonUtils clones share geometry across pirates)
  if (o.userData.ownGeo) return o.geometry;
  const src = o.geometry, g = new THREE.BufferGeometry();
  for (const k in src.attributes) g.setAttribute(k, src.attributes[k]);
  g.setIndex(src.index); for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.boundingSphere = src.boundingSphere; g.boundingBox = src.boundingBox; g.userData.baseIndex = src.index; o.geometry = g; o.userData.ownGeo = true; return g;
}
function applyHide(p) {
  const rules = Object.values(p.items).flatMap((it) => it.hide || []);
  for (const o of p.atlasMeshes || []) {
    const g = ownGeometry(o), base = g.userData.baseIndex;
    if (!rules.length) { g.setIndex(base); continue; }
    const P = g.attributes.position, Tt = g.attributes._tint, n = P.count, hid = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const t = Tt ? Math.round(Tt.getX(i)) : -1; let X = P.getX(i), Y = P.getY(i), Z = P.getZ(i); if (p.warp) { const q = v5Inv(p.warp, X, Y, Z); X = q[0]; Y = q[1]; Z = q[2]; }   // [v121] rules are in v4 bind space
      for (const r of rules) if (ruleHit(r, X, Y, Z, t, p.female, p.lod, !!p.v5)) { hid[i] = 1; break; } }
    const src = base.array, out = [];
    for (let i = 0; i < src.length; i += 3) if (!(hid[src[i]] && hid[src[i + 1]] && hid[src[i + 2]])) out.push(src[i], src[i + 1], src[i + 2]);
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1));
  }
}
function itemMaterial(src, low) {
  if (low) return new THREE.MeshBasicMaterial({ name: 'item_lo', map: src.map || null, vertexColors: true });
  return new THREE.MeshToonMaterial({ name: 'item_hi', map: src.map || null, normalMap: src.normalMap || null, vertexColors: true, gradientMap: gradient() });
}
function retint(geo, colors) {
  const t = geo.attributes._tint; if (!t || !colors) return; const c = geo.attributes.color.clone(), col = new THREE.Color(); geo.setAttribute('color', c);
  for (let i = 0; i < t.count; i++) { const k = TINTS[Math.round(t.getX(i))]; if (k && colors[k] != null) { col.set(colors[k]); c.setXYZ(i, col.r, col.g, col.b); } }
}
const _remap = new Map();
function remapped(url, src, names) {  // item skinIndex -> pirate skeleton bone order (cached per GLB)
  if (_remap.has(url)) return _remap.get(url);
  const map = src.skeleton.bones.map((b) => names.indexOf(b.name)), si = src.geometry.attributes.skinIndex, a = new Uint16Array(si.count * 4);
  for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) a[i * 4 + k] = Math.max(0, map[si.getComponent(i, k)]);
  const g = new THREE.BufferGeometry(); for (const k in src.geometry.attributes) g.setAttribute(k, src.geometry.attributes[k]);
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(a, 4)); g.setIndex(src.geometry.index); g.computeBoundingSphere(); _remap.set(url, g); return g;
}
async function build(p, def, opts) {
  const base = p.female ? 'female' : 'male', low = p.lod === 'lo', url = def.files[base][p.lod], gltf = await loadPirateGLB(url);
  const body = p.atlasMeshes[0], skel = body.skeleton, names = skel.bones.map((b) => b.name);
  if (def.attach) {  // parrot: own rig + clip, rides a pirate bone (bind space -> bone space via that bone's inverse bind matrix)
    const sc = SkeletonUtils.clone(gltf.scene); sc.traverse((o) => { if (o.isMesh) { const g = o.geometry.clone(); retint(g, opts.colors); o.geometry = g; o.material = itemMaterial(o.material, low); o.frustumCulled = false; } });
    const A = def.attach, bi = names.indexOf(A.bone), off0 = A.offset?.[base] || [0, 0, 0], off = p.warp ? (() => { const f0 = A.feet || [0, 0, 0], q = v5Fwd(p.warp, f0[0] + off0[0], f0[1] + off0[1], f0[2] + off0[2]); return [q[0] - f0[0], q[1] - f0[1], q[2] - f0[2]]; })() : off0, f = A.feet || [0, 0, 0], holder = new THREE.Group(); holder.name = 'item_' + def.id; holder.matrixAutoUpdate = false;
    const M = new THREE.Matrix4(), lean = new THREE.Matrix4().makeTranslation(f[0], f[1], f[2]).multiply(M.makeRotationZ(A.lean?.[base] || 0)).multiply(new THREE.Matrix4().makeTranslation(-f[0], -f[1], -f[2]));
    holder.matrix.copy(skel.boneInverses[bi]).multiply(new THREE.Matrix4().makeTranslation(off[0], off[1], off[2])).multiply(lean).multiply(body.bindMatrix); holder.add(sc); skel.bones[bi].add(holder);
    const mixer = new THREE.AnimationMixer(sc), clip = gltf.animations.find((a) => a.name === def.clip) || gltf.animations[0];
    if (clip) mixer.clipAction(clip).play();
    return { obj: holder, mixer };
  }
  let src = null; gltf.scene.traverse((o) => { if (!src && o.isSkinnedMesh) src = o; });
  let geo = remapped(url, src, names); if (opts.colors || p.warp) { geo = geo.clone(); if (opts.colors) retint(geo, opts.colors); }
  if (p.warp) {   // [v121] v4-authored item -> the v5 body (heights, shorter arms, face plane, hat seat)
    const P = geo.attributes.position.clone(), q = [0, 0, 0], hat = def.slot === 'head', hid = def.id === 'hat_tricorn' ? 'tricorn' : def.id;
    for (let i = 0; i < P.count; i++) { v5Fwd(p.warp, P.getX(i), P.getY(i), P.getZ(i), hat, q); if (hat) v5Hat(p.warp, hid, q); P.setXYZ(i, q[0], q[1], q[2]); }
    geo.setAttribute('position', P); geo.computeBoundingSphere();
  }
  const m = new THREE.SkinnedMesh(geo, itemMaterial(src.material, low)); m.name = 'item_' + def.id; m.frustumCulled = false;
  body.parent.add(m); m.bind(skel, body.bindMatrix); return { obj: m };
}
function drop(it) { it.obj.parent?.remove(it.obj); it.obj.traverse((o) => { if (o.isMesh) { o.material.dispose(); } }); it.mixer?.stopAllAction(); }
export async function equip(p, id, opts = {}) {
  const def = ITEM_BY_ID[id]; if (!def) throw new Error('unknown item ' + id);
  await p.ready; p.items ||= {}; p._eqTok ||= {}; const tok = (p._eqTok[def.slot] = {});
  const it = await build(p, def, opts);
  if (p._eqTok[def.slot] !== tok) { drop(it); return null; }   // a newer equip / unequip on this slot won
  if (p.items[def.slot]) drop(p.items[def.slot]);
  p.items[def.slot] = { id, hide: def.hide, ...it }; applyHide(p); return it.obj;
}
export function unequip(p, slotOrId) {
  const slot = ITEM_SLOTS.includes(slotOrId) ? slotOrId : ITEM_BY_ID[slotOrId]?.slot; if (!slot || !p.items?.[slot]) return;
  p._eqTok[slot] = {}; drop(p.items[slot]); delete p.items[slot]; applyHide(p);
}
export const equipped = (p) => Object.fromEntries(Object.entries(p.items || {}).map(([s, it]) => [s, it.id]));
export const equipAll = (p, ids, opts) => Promise.all(ids.map((id) => equip(p, id, opts)));
