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
export const ITEM_SLOTS = ['head', 'handL', 'handR', 'legL', 'legR', 'outfit', 'shoulder', 'eyes'];
// [v123] Raul's per-body v5 fits (raul_polish): assets/pirates/items/v5/<id>_<male|female>_<hi|lo>.glb, pre-fitted in the v5 bind space
// (no v5Fwd / v5Hat), skinned or rigid on bone 'head'; v5hide = his hide rules (v4 space, evaluated through v5Inv like the rest)
const V5DIR = DIR + 'v5/', v5files = (id) => Object.fromEntries(['male', 'female'].map((b) => [b, { hi: `${V5DIR}${id}_${b}_hi.glb`, lo: `${V5DIR}${id}_${b}_lo.glb` }]));
const files = (id, perBase) => Object.fromEntries(['male', 'female'].map((b) => [b, Object.fromEntries(['hi', 'lo'].map((l) => [l, `${DIR}item_${id}${perBase ? '_' + b : ''}_${l}.glb`]))]));
const item = (id, label, slot, price, tint, hide, o = {}) => ({ id, label, slot, price, currency: 'gold', glb: (o.perBase ? files(id, 1) : files(id)).male.hi,
  icon: `${DIR}icons/${id}.png`, tint, files: files(id, o.perBase), hide, ...o });
// hide rules (bind space, three units): region (cyl | arm | leg | torso | sph | all) AND optional tint keys ('fixed' = untinted parts)
export const ITEMS = [
  item('hat_tricorn', 'Pirate Hat', 'head', 250, { hat: '#18181b' }, [{ cyl: [0, -0.005, 0.27], y: [HY + 0.085, 9], tilt: 0.1, tints: ['hair'] }], { v5: v5files('hat_tricorn'), v5hide: [], skull: false }   /* skull decal: next push */),
  item('crown', 'Pirate King Crown', 'head', 1200, { accent: '#8e1b2a' }, [{ cyl: [0, 0, 0.228], y: [HY + 0.15, 9], tilt: 0.06, tints: ['hair'] }], { v5new: v5files('crown'), v5hide: [] }),   // v5new: Raul's Imperial State Crown, ships after BANKSY OKs the fit shots   // v5: Raul's Imperial State Crown (fixed colours)
  item('hook_l', 'Hook Arm (Left)', 'handL', 400, null, [{ arm: 'L', s: 0.29 }], { v5: v5files('hook_l'), v5hide: [{ arm: 'L', s: 0.239, male: 1 }, { arm: 'L', s: 0.27, female: 1 }] }),
  item('hook_r', 'Hook Arm (Right)', 'handR', 400, null, [{ arm: 'R', s: 0.29 }], { v5: v5files('hook_r'), v5hide: [{ arm: 'R', s: 0.245, male: 1 }, { arm: 'R', s: 0.276, female: 1 }] }),
  item('peg_l', 'Peg Leg (Left)', 'legL', 400, { boots: '#221a16' }, [{ leg: 'L', y: 0.225, tints: ['pants'] }, { leg: 'L', y: 0.3, tints: ['boots', 'fixed'] }], { v5: v5files('peg_l'), v5hide: [{ leg: 'L', y: 0.233, tints: ['pants', 'boots', 'fixed'] }] }),
  item('peg_r', 'Peg Leg (Right)', 'legR', 400, { boots: '#221a16' }, [{ leg: 'R', y: 0.225, tints: ['pants'] }, { leg: 'R', y: 0.3, tints: ['boots', 'fixed'] }], { v5: v5files('peg_r'), v5hide: [{ leg: 'R', y: 0.233, tints: ['pants', 'boots', 'fixed'] }] }),
  // [v123] v5-only: Raul's per-body fits of Timothy's merged-gear pieces (js/pirateGear.js RAUL5); v4 bodies keep the merged pieces
  item('hat_bicorne', 'Bicorne', 'head', 0, null, [], { v5: v5files('hat_bicorne'), v5hide: [], v5only: true, keyed: true, skull: false }),
  item('hat_bandana', 'Bandana', 'head', 0, null, [], { v5: v5files('hat_bandana'), v5hide: [], v5only: true, keyed: true }),
  item('eyes_eyepatch', 'Eye Patch', 'eyes', 0, null, [], { v5: v5files('eyes_eyepatch'), v5hide: [], v5only: true, keyed: true }),
  item('eyes_vr', 'VR Goggles', 'eyes', 0, null, [], { v5: v5files('eyes_vr'), v5hide: [], v5only: true, keyed: true }),
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
export const itemsForSlot = (slot) => ITEMS.filter((d) => d.slot === slot && !d.v5only);

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
  const rules = Object.values(p.items).flatMap((it) => (p.v5 && it.v5hide ? it.v5hide : it.hide) || []);
  for (const o of p.atlasMeshes || []) {
    const g = ownGeometry(o), base = g.userData.baseIndex;
    if (!rules.length) { g.setIndex(base); continue; }
    const P = g.attributes.position, Tt = g.attributes._tint, n = P.count, hid = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const t = Tt ? Math.round(Tt.getX(i)) : -1, rX = P.getX(i), rY = P.getY(i), rZ = P.getZ(i); let X = rX, Y = rY, Z = rZ; if (p.warp) { const q = v5Inv(p.warp, X, Y, Z); X = q[0]; Y = q[1]; Z = q[2]; }   // [v121] rules are in v4 bind space
      for (const r of rules) { if (r.raw) { if (r.tints && !r.tints.some((k) => TI(k) === t)) continue; const [ex, ez, ax, az] = r.ell; if (rY > r.y0 && ((rX - ex) / ax) ** 2 + ((rZ - ez) / az) ** 2 < 1) { hid[i] = 1; break; } continue; }   // [v123] v5 bind-space ellipse (crown)
        if (p.v5 && r.tints?.includes('hair') && !r.raw) continue;   // [v123] Raul: never hide v5 hair under a hat (the AI head is hollow: holes)
        if (ruleHit(r, X, Y, Z, t, p.female, p.lod, !!p.v5)) { hid[i] = 1; break; } } }
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
  const base = p.female ? 'female' : 'male', low = p.lod === 'lo', url = def.files[base][p.lod];
  const body = p.atlasMeshes[0], skel = body.skeleton, names = skel.bones.map((b) => b.name);
  if (p.v5 && def.v5) return buildV5(p, def, opts, low, body, skel, names);
  const gltf = await loadPirateGLB(url);
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
  if (def.skull && !p.warp && geo === remapped(url, src, names)) geo = geo.clone();   // the decal repaints the old skull: own colours
  const m = new THREE.SkinnedMesh(geo, itemMaterial(src.material, low)); m.name = 'item_' + def.id; m.frustumCulled = false;
  body.parent.add(m); m.bind(skel, body.bindMatrix); return { obj: m, decal: def.skull ? skullDecal(geo, skel, body, low) : null };
}
// [v123] Raul's pre-fitted v5 piece: skinned (his v5 armature, remapped by bone name) or rigid on 'head'; marker colours (keyed) like js/pirateGear.js
const _v5geo = new Map(), _kc = new THREE.Color();
async function v5Geometry(url, names) {
  if (_v5geo.has(url)) return _v5geo.get(url);
  const gltf = await loadPirateGLB(url); gltf.scene.updateMatrixWorld(true);
  let src = null; gltf.scene.traverse((o) => { if (o.isMesh && !/^ico/i.test(o.name) && (!src || o.geometry.attributes.position.count > src.geometry.attributes.position.count)) src = o; });
  let g;
  if (src.isSkinnedMesh) g = remapped(url, src, names);
  else { g = src.geometry.clone(); g.applyMatrix4(src.matrixWorld); const n = g.attributes.position.count, hi = Math.max(0, names.findIndex((b) => b.replace(/[^A-Za-z0-9]/g, '').toLowerCase() === 'head'));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, k) => (k % 4 ? 0 : hi)), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, k) => (k % 4 ? 0 : 1)), 4)); }
  if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  g.computeBoundingSphere(); const r = { geo: g, mat: src.material }; _v5geo.set(url, r); return r;
}
function keyColors(geo, pal, low) {   // magenta 1 / cyan 2 / yellow 3 / blue 4 marker colours -> the palette (as Timothy's merged gear), Low: baked light
  const C = geo.attributes.color, N = geo.attributes.normal, c = C.clone();
  for (let i = 0; i < c.count; i++) { const r = c.getX(i), g = c.getY(i), b = c.getZ(i);
    const k = r > 0.9 && g < 0.1 && b > 0.9 ? 1 : r < 0.1 && g > 0.9 && b > 0.9 ? 2 : r > 0.9 && g > 0.9 && b < 0.1 ? 3 : r < 0.1 && g < 0.1 && b > 0.9 ? 4 : 0;
    if (k) { _kc.set(pal?.[k] || pal?.[1] || '#c8302c'); c.setXYZ(i, _kc.r, _kc.g, _kc.b); }
    if (low && N) { const s = 0.58 + 0.42 * Math.max(0, N.getX(i) * 0.37 + N.getY(i) * 0.84 + N.getZ(i) * 0.4) + 0.08 * Math.max(0, N.getY(i)); c.setXYZ(i, c.getX(i) * s, c.getY(i) * s, c.getZ(i) * s); } }
  geo.setAttribute('color', c);
}
async function buildV5(p, def, opts, low, body, skel, names) {
  const base = p.female ? 'female' : 'male', { geo: g0, mat } = await v5Geometry(def.v5[base][p.lod], names);
  const geo = g0.clone(); if (def.id === 'crown') geo.setAttribute('position', geo.attributes.position.clone());
  if (def.keyed) keyColors(geo, opts.colors, low); else if (opts.colors) retint(geo, opts.colors);
  const m = new THREE.SkinnedMesh(geo, itemMaterial(mat || {}, low)); m.name = 'item_' + def.id; m.frustumCulled = false;
  body.parent.add(m); m.bind(skel, body.bindMatrix);
  const decal = def.skull ? skullDecal(geo, skel, body, low) : null;
  const v5hide = def.id === 'crown' ? fitCrown(geo, p) : null;
  return { obj: m, decal, v5hide };
}
// [v123] BANKSY on Raul's crown: "Looks good, doesn't fit on head". Same design, re-seated per body: the ermine rim is scaled to the
// head + hair cross-section at brow / ear height (bind space) and dropped there; the hair inside the crown is hidden (the velvet cap closes it).
export const CROWN_FIT = { brow: 0.075, snug: 1.02, drop: 0.012 };
function fitCrown(geo, p) {
  const body = p.atlasMeshes[0].geometry.attributes.position, eyeY = p.warp?.a5?.[2] ?? 1.05, Y = eyeY + CROWN_FIT.brow;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < body.count; i++) { const y = body.getY(i); if (y < Y - 0.012 || y > Y + 0.012) continue; const x = body.getX(i), z = body.getZ(i);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  if (!(x1 > x0)) return null;
  const P = geo.attributes.position; let ymin = 1e9; for (let i = 0; i < P.count; i++) ymin = Math.min(ymin, P.getY(i));
  let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (let i = 0; i < P.count; i++) { if (P.getY(i) > ymin + 0.03) continue; a0 = Math.min(a0, P.getX(i)); a1 = Math.max(a1, P.getX(i)); b0 = Math.min(b0, P.getZ(i)); b1 = Math.max(b1, P.getZ(i)); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rx = (x1 - x0) / 2, rz = (z1 - z0) / 2, ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
  const sx = rx * CROWN_FIT.snug / ((a1 - a0) / 2), sz = rz * CROWN_FIT.snug / ((b1 - b0) / 2), sy = (sx + sz) / 2;
  for (let i = 0; i < P.count; i++) P.setXYZ(i, cx + (P.getX(i) - ca) * sx, Y - CROWN_FIT.drop + (P.getY(i) - ymin) * sy, cz + (P.getZ(i) - cb) * sz);
  P.needsUpdate = true; geo.computeBoundingSphere();
  return [{ raw: 1, ell: [cx, cz, rx * 0.97, rz * 0.97], y0: Y + 0.02, tints: ['hair'] }];
}
// [v123] BANKSY: every skull hat carries the REAL PUMPFUN PIRATES skull (assets/pirates/skull_decal.png, alpha decal). The modelled
// white skull on the hat is found by colour, painted over with the hat felt, and the decal sits on that spot (curved to the surface).
let _skullTex = null;
export function skullTexture() { if (_skullTex) return _skullTex; _skullTex = new THREE.TextureLoader().load('assets/pirates/skull_decal.png'); _skullTex.colorSpace = THREE.SRGBColorSpace; _skullTex.anisotropy = 4; return _skullTex; }
export function skullDecal(geo, skel, body, low) {
  const P = geo.attributes.position, C = geo.attributes.color, N = geo.attributes.normal, n = P.count, W = [];
  const white = (i) => C.getX(i) > 0.78 && C.getY(i) > 0.72 && C.getZ(i) > 0.6 && C.getX(i) - C.getZ(i) < 0.25;   // cream / white skull (not the gold trim)
  for (let i = 0; i < n; i++) if (white(i) && P.getZ(i) > 0 && Math.abs(P.getX(i)) < 0.16) W.push(i);
  if (W.length < 6) return null;
  // the front cluster: whites near the front-most white vertex
  let f = W[0]; for (const i of W) if (P.getZ(i) > P.getZ(f)) f = i;
  const fx = P.getX(f), fy = P.getY(f), S = W.filter((i) => Math.hypot(P.getX(i) - fx, P.getY(i) - fy) < 0.14 && Math.abs(P.getX(i)) < 0.16);
  const ctr = new THREE.Vector3(), nn = new THREE.Vector3(), bb = new THREE.Box3();
  for (const i of S) { const v = new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)); ctr.add(v); bb.expandByPoint(v); if (N) nn.add(new THREE.Vector3(N.getX(i), N.getY(i), N.getZ(i))); }
  ctr.divideScalar(S.length); ctr.x = (bb.min.x + bb.max.x) / 2; ctr.y = (bb.min.y + bb.max.y) / 2;
  if (nn.lengthSq() < 1e-6) nn.set(0, 0, 1); nn.normalize(); nn.lerp(new THREE.Vector3(0, nn.y, 1), 0.5).normalize();
  const size = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) * 1.12;
  // paint the old modelled skull with the felt around it (median of the non-white front verts nearby)
  const near = []; for (let i = 0; i < n; i++) { if (white(i)) continue; const d = Math.hypot(P.getX(i) - ctr.x, P.getY(i) - ctr.y, P.getZ(i) - ctr.z); if (d < size * 1.2 && P.getZ(i) > 0) near.push(i); }
  if (near.length) { const ch = [0, 1, 2].map((k) => near.map((i) => C.getComponent(i, k)).sort((a, b) => a - b)[near.length >> 1]); const c2 = C.clone(); for (const i of S) c2.setXYZ(i, ch[0], ch[1], ch[2]); geo.setAttribute('color', c2); }
  // curved 8 x 8 grid over the spot, each point pushed onto the hat surface (nearest front vertex depth) + 3 mm
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(nn, -nn.y).normalize(), rt = new THREE.Vector3().crossVectors(up, nn).normalize(), G = 8, pos = [], uv = [], idx = [], si = [], sw = [];
  const cand = []; for (let i = 0; i < n; i++) if (P.getZ(i) > 0 && Math.hypot(P.getX(i) - ctr.x, P.getY(i) - ctr.y, P.getZ(i) - ctr.z) < size) cand.push(i);
  const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, q = new THREE.Vector3(), v = new THREE.Vector3();
  for (let a = 0; a <= G; a++) for (let b = 0; b <= G; b++) {
    const u = a / G, w = b / G; q.copy(ctr).addScaledVector(rt, (u - 0.5) * size).addScaledVector(up, (w - 0.5) * size);
    let best = -1, bd = 1e9; for (const i of cand) { v.set(P.getX(i), P.getY(i), P.getZ(i)); const d = v.clone().sub(q).cross(nn).lengthSq(); if (d < bd) { bd = d; best = i; } }
    if (best >= 0) { v.set(P.getX(best), P.getY(best), P.getZ(best)); q.addScaledVector(nn, v.sub(q).dot(nn)); }
    q.addScaledVector(nn, 0.003); pos.push(q.x, q.y, q.z); uv.push(u, w);
    const bi = best >= 0 ? best : 0; for (let k = 0; k < 4; k++) { si.push(SI.getComponent(bi, k)); sw.push(SW.getComponent(bi, k)); }
  }
  for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) { const i0 = a * (G + 1) + b, i1 = i0 + G + 1; idx.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.setIndex(idx); g.computeVertexNormals();
  const mat = low ? new THREE.MeshBasicMaterial({ name: 'skull_decal', map: skullTexture(), alphaTest: 0.5, side: THREE.DoubleSide })
    : new THREE.MeshToonMaterial({ name: 'skull_decal', map: skullTexture(), alphaTest: 0.5, side: THREE.DoubleSide, gradientMap: gradient() });
  const m = new THREE.SkinnedMesh(g, mat); m.name = 'skull_decal'; m.frustumCulled = false; m.renderOrder = 1; m.userData.skullDecal = true;
  body.parent.add(m); m.bind(skel, body.bindMatrix); return m;
}
function drop(it) { for (const ob of [it.obj, it.decal]) { if (!ob) continue; ob.parent?.remove(ob); ob.traverse((o) => { if (o.isMesh) { o.material.dispose(); } }); } it.mixer?.stopAllAction(); }
export async function equip(p, id, opts = {}) {
  const def = ITEM_BY_ID[id]; if (!def) throw new Error('unknown item ' + id);
  await p.ready; p.items ||= {}; p._eqTok ||= {}; const tok = (p._eqTok[def.slot] = {});
  const it = await build(p, def, opts);
  if (p._eqTok[def.slot] !== tok) { drop(it); return null; }   // a newer equip / unequip on this slot won
  if (p.items[def.slot]) drop(p.items[def.slot]);
  p.items[def.slot] = { id, hide: def.hide, ...it, v5hide: def.v5 ? (it.v5hide || def.v5hide) : null }; applyHide(p); return it.obj;
}
export function unequip(p, slotOrId) {
  const slot = ITEM_SLOTS.includes(slotOrId) ? slotOrId : ITEM_BY_ID[slotOrId]?.slot; if (!slot || !p.items?.[slot]) return;
  p._eqTok[slot] = {}; drop(p.items[slot]); delete p.items[slot]; applyHide(p);
}
export const equipped = (p) => Object.fromEntries(Object.entries(p.items || {}).map(([s, it]) => [s, it.id]));
export const equipAll = (p, ids, opts) => Promise.all(ids.map((id) => equip(p, id, opts)));
