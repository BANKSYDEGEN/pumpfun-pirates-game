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
  item('hat_tricorn', 'Pirate Hat', 'head', 250, { hat: '#18181b' }, [{ cyl: [0, -0.005, 0.27], y: [HY + 0.085, 9], tilt: 0.1, tints: ['hair'] }], { v5hide: [], skull: false }),   // [v128] BANKSY "Add this hat back in": the original compact v4 Pirate Hat (gold trim, big skull + crossbones) warped onto v5 (v5Fwd / v5Hat) instead of the wide v5 refit
  item('crown', 'Pirate King Crown', 'head', 1200, { accent: '#8e1b2a' }, [{ cyl: [0, 0, 0.228], y: [HY + 0.15, 9], tilt: 0.06, tints: ['hair'] }], { v5new: v5files('crown'), v5hide: [] }),   // v5new: Raul's Imperial State Crown, ships after BANKSY OKs the fit shots   // v5: Raul's Imperial State Crown (fixed colours)
  // [v143] BANKSY "Fix and ship the Imperial crown as well": Raul's Imperial State Crown as its own item (the Pirate King Crown above is untouched).
  // v5 bodies: his per-body fits re-seated by fitCrown, the hair inside hidden and the hair round the ermine rim tucked in under it (crownTuck)
  item('crown_imperial', 'Imperial Crown', 'head', 2500, null, [{ cyl: [0, 0, 0.228], y: [HY + 0.15, 9], tilt: 0.06, tints: ['hair'] }], { v5: v5files('crown'), v5hide: [], crownFit: true, files: files('crown'), glb: files('crown').male.hi, icon: `${DIR}icons/crown.png` }),
  // [v144] BANKSY "Add a green hq helmet": Raul's olive M1 helmet (HQ stencil, skull + crossbones on the left side, leather strap + brass buckle),
  // pre-fitted per body, rigid on 'head'. v4: hair under the dome hidden; v5: hatFlatten squashes the hair above the front rim (one-shell head)
  item('helmet_hq', 'HQ Helmet', 'head', 800, null, [{ cyl: [0, 0.01, 0.29], y: [HY + 0.06, 9], tilt: 0.08, tints: ['hair'] }], { v5: v5files('helmet_hq'), v5hide: [], skull: false, v5dy: { female: 0.015 } }),   // [v144] the female brim off her eyes
  item('hook_l', 'Hook Arm (Left)', 'handL', 400, null, [{ arm: 'L', s: 0.29 }], { v5: v5files('hook_l'), v5hide: [{ arm: 'L', s: 0.239, male: 1 }, { arm: 'L', s: 0.27, female: 1 }] }),
  item('hook_r', 'Hook Arm (Right)', 'handR', 400, null, [{ arm: 'R', s: 0.29 }], { v5: v5files('hook_r'), v5hide: [{ arm: 'R', s: 0.245, male: 1 }, { arm: 'R', s: 0.276, female: 1 }] }),
  item('peg_l', 'Peg Leg (Left)', 'legL', 400, { boots: '#221a16' }, [{ leg: 'L', y: 0.225, tints: ['pants'] }, { leg: 'L', y: 0.3, tints: ['boots', 'fixed'] }], { v5: v5files('peg_l'), v5hide: [{ leg: 'L', y: 0.233, tints: ['pants', 'boots', 'fixed'] }] }),
  item('peg_r', 'Peg Leg (Right)', 'legR', 400, { boots: '#221a16' }, [{ leg: 'R', y: 0.225, tints: ['pants'] }, { leg: 'R', y: 0.3, tints: ['boots', 'fixed'] }], { v5: v5files('peg_r'), v5hide: [{ leg: 'R', y: 0.233, tints: ['pants', 'boots', 'fixed'] }] }),
  // [v123] v5-only: Raul's per-body fits of Timothy's merged-gear pieces (js/pirateGear.js RAUL5); v4 bodies keep the merged pieces
  item('hat_bicorne', 'Bicorne', 'head', 0, null, [], { v5: v5files('hat_bicorne'), v5hide: [], v5only: true, keyed: true, skull: true, skullOpt: { gold: true, scale: 1.1 }, v5dy: 0.035 }),   // [v125] sat low: up 3.5 cm
  item('hat_bandana', 'Bandana', 'head', 0, null, [], { v5: v5files('hat_bandana'), v5hide: [], v5only: true, keyed: true, skull: true, skullOpt: { geometric: true, at: 0.62, scale: 0.85 } }),
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
    g.userData.basePos ||= g.attributes.position; g.userData.shrink = null;
    if (!rules.length) { g.setIndex(base); continue; }
    const P = g.userData.basePos, Tt = g.attributes._tint, n = P.count, hid = new Uint8Array(n); let shr = null;
    for (let i = 0; i < n; i++) { const t = Tt ? Math.round(Tt.getX(i)) : -1, rX = P.getX(i), rY = P.getY(i), rZ = P.getZ(i); let X = rX, Y = rY, Z = rZ; if (p.warp) { const q = v5Inv(p.warp, X, Y, Z); X = q[0]; Y = q[1]; Z = q[2]; }   // [v121] rules are in v4 bind space
      for (const r of rules) { if (r.raw) { if (r.tints && !r.tints.some((k) => TI(k) === t)) continue; const [ex, ez, ax, az] = r.ell; if (rY > r.y0 && ((rX - ex) / ax) ** 2 + ((rZ - ez) / az) ** 2 < 1) { hid[i] = 1; break; } continue; }   // [v123] v5 bind-space ellipse (crown)
        if (p.v5 && r.tints?.includes('hair') && !r.raw) continue;   // [v123] Raul: never hide v5 hair under a hat (the AI head is hollow: holes)
        if (p.v5 && r.v5torso) {   // [v124] BANKSY "jacket has holes": hiding the v5 torso opened the hollow body in the coat's open front.
          if (r.tints && !r.tints.some((k) => TI(k) === t)) continue;   // Now the torso is pulled in under the garment instead (shrink); only the upper arms inside the sleeves hide
          const [y0, y1, s1] = r.v5torso; if (Y < y0 || Y > y1) continue;
          if (Math.abs(X) < 0.2) { (shr ||= new Uint8Array(n))[i] = 1; continue; }
          if (s1 && sArm(X, Y, X > 0 ? 1 : -1) < s1 - 0.04) { hid[i] = 1; break; } continue; }
        if (ruleHit(r, X, Y, Z, t, p.female, p.lod, !!p.v5)) { hid[i] = 1; break; } } }
    const src = base.array, out = [];
    for (let i = 0; i < src.length; i += 3) if (!(hid[src[i]] && hid[src[i + 1]] && hid[src[i + 2]])) out.push(src[i], src[i + 1], src[i + 2]);
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1)); g.userData.shrink = shr; g.userData.under = null;
    const top = p.v5 && p.warp ? Object.values(p.items).find((it) => underOn(p, it.id) && it.obj?.geometry) : null;
    if (top && o.geometry.attributes.normal) { const cg = top.obj.geometry; let m = _under.get(cg); if (!m) _under.set(cg, (m = new WeakMap()));
      if (!m.has(P)) m.set(P, underCloth(P, o.geometry.attributes.normal, cg, p.lod === 'lo' ? 0.055 : 0.032, o.geometry.attributes._tint)); const D = m.get(P); if (D) { g.userData.under = D; g.userData.shrink = null; } }
    // [v137] BANKSY "speckled hair / black speckles by the braid": the braid + long hair lie ON the coat / shirt and z-fought it: hair
    // over a worn top is lifted just outside the cloth (the female: the male's hair stays tucked in his collar)
    const tp = p.v5 && p.warp ? Object.values(p.items).find((it) => (it.id === 'suit' || it.id === 'shirt') && it.obj?.geometry) : null;
    if (tp && g.attributes._tint) { const cg = tp.obj.geometry; let m = _hair.get(cg); if (!m) _hair.set(cg, (m = new WeakMap()));
      if (!m.has(P)) m.set(P, hairOver(P, g.attributes._tint, cg, !p.female)); const H = m.get(P);
      if (H) { const U0 = g.userData.under; if (U0) { const S2 = new Float32Array(U0.length); for (let i = 0; i < S2.length; i++) S2[i] = U0[i] + H[i]; g.userData.under = S2; } else g.userData.under = H; } }
    // [v136] body faces the cloth-coloured underlayer replaces go (Low's coarse chest poked through the lapels in big skin shards)
    if (top && T0(o)) { const { keep } = underKeep(p, o, UNDER[top.id]), I = g.index.array, o2 = [];
      for (let i = 0; i < I.length; i += 3) if (!(keep[I[i]] && keep[I[i + 1]] && keep[I[i + 2]])) o2.push(I[i], I[i + 1], I[i + 2]);
      g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(o2) : new Uint16Array(o2), 1)); }
    // [v136] the v5 body's red sash tails flap with the legs and poked through the long coat at the hips: hidden under it
    // (red in the body texture, waist down, off the centre line where the coat always covers)
    const tl = top && top.id === 'suit' ? sashTails(o, P) : null;
    if (tl) { const I = g.index.array, o2 = []; for (let i = 0; i < I.length; i += 3) if (!(tl[I[i]] || tl[I[i + 1]] || tl[I[i + 2]])) o2.push(I[i], I[i + 1], I[i + 2]);
      g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(o2) : new Uint16Array(o2), 1)); }
  }
  flattenHair(p);
}
function flattenHair(p) {   // [v124] hair under the worn hat (v5 only)
  const F = p.v5 ? Object.values(p.items || {}).map((it) => it.flatten).find(Boolean) : null, iH = TINTS.indexOf('hair');
  for (const o of p.atlasMeshes || []) {
    const g = ownGeometry(o); g.userData.basePos ||= o.geometry.attributes.position;
    const S = g.userData.shrink;
    const U = g.userData.under;
    if (!F && !S && !U) { if (g.attributes.position !== g.userData.basePos) g.setAttribute('position', g.userData.basePos); continue; }
    const B = g.userData.basePos, P = B.clone(), T = g.attributes._tint;
    if (U) for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) + U[i * 3], P.getY(i) + U[i * 3 + 1], P.getZ(i) + U[i * 3 + 2]);
    if (S) { let cz = 0, c = 0; for (let i = 0; i < P.count; i++) if (S[i]) { cz += P.getZ(i); c++; } cz /= c || 1;
      for (let i = 0; i < P.count; i++) if (S[i]) { P.setX(i, P.getX(i) * 0.9); P.setZ(i, cz + (P.getZ(i) - cz) * 0.9); } }   // torso 10 % in under the coat / shirt
    if (!F) { g.setAttribute('position', P); continue; }
    if (F.tuck) { tuckHair(P, T, F, iH); g.setAttribute('position', P); continue; }
    for (let i = 0; i < P.count; i++) { if (!T || Math.round(T.getX(i)) !== iH) continue; const y = P.getY(i); if (y <= F.y) continue;
      const dx = (P.getX(i) - F.cx) / F.ex, dz = (P.getZ(i) - F.cz) / F.ez; if (dx * dx + dz * dz > 1) continue; P.setY(i, F.y + (y - F.y) * F.k); }
    g.setAttribute('position', P);
  }
}
function itemMaterial(src, low, two = false) { const m = itemMaterial0(src, low); if (two) m.side = THREE.DoubleSide; return m; }   // [v124] v5 hats / eyewear / hooks: solid from inside too (tops have their own lining)
// [v139] BANKSY "black bits on the male phone shoulder line": the warped coat folds a few cloth triangles over at the shoulder / collar,
// so their inside (dark lining texels) faced out as black shards. Inside faces of the male tops now draw in the cloth colour, shaded.
function backCloth(m, hex, low) {
  if (hex == null) return m; const c = new THREE.Color(hex).multiplyScalar(low ? 0.7 : 0.85), u = { value: c };
  m.onBeforeCompile = (sh) => { sh.uniforms.uBack = u; sh.fragmentShader = 'uniform vec3 uBack;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  if (!gl_FrontFacing) diffuseColor.rgb = uBack;'); };
  m.customProgramCacheKey = () => 'backCloth'; return m;
}
function itemMaterial0(src, low) {
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
  // [v133] BANKSY "That male jacket is still bad": decimated Low tops tear (thin double-layer cloth); players on Low wear the High top
  // (one per pirate, Low material). Ship crews (crewV4 sets p.forCrew) still bake the light Low file.
  const base = p.female ? 'female' : 'male', low = p.lod === 'lo', url = def.files[base][low && def.slot === 'outfit' && !p.forCrew ? 'hi' : p.lod];
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
    const P0 = geo.attributes.position, P = P0.clone(), q = [0, 0, 0], hat = def.slot === 'head', hid = def.id === 'hat_tricorn' ? 'tricorn' : def.id;
    for (let i = 0; i < P.count; i++) { v5Fwd(p.warp, P.getX(i), P.getY(i), P.getZ(i), hat, q); if (hat) v5Hat(p.warp, hid, q); P.setXYZ(i, q[0], q[1], q[2]); }
    geo.setAttribute('position', P);
    if (underOn(p, def.id)) { taubin(geo, 8, (x, y) => y > 0.64 && Math.abs(x) < 0.3, P0); skirtOffArms(geo, P0, names); }   // [v136] v4-space mask: collar, lapels, shoulders (not buttons / cuffs)
    geo.computeBoundingSphere();
  }
  if (def.skull && !p.warp && geo === remapped(url, src, names)) geo = geo.clone();   // the decal repaints the old skull: own colours
  const UC = underOn(p, def.id) ? UNDER[def.id] : null, m = new THREE.SkinnedMesh(geo, UC ? backCloth(itemMaterial(src.material, low, true), opts.colors?.[UC.tint] || def.tint?.[UC.tint], low) : itemMaterial(src.material, low)); m.name = 'item_' + def.id; m.frustumCulled = false;   // [v136] tops: single cloth layer (lining stripped), both sides
  body.parent.add(m); m.bind(skel, body.bindMatrix);
  const under = p.warp && underOn(p, def.id) ? underShell(p, body, UNDER[def.id], opts.colors?.[UNDER[def.id].tint] || def.tint?.[UNDER[def.id].tint], low) : null;   // [v136]
  if (under) { const u = new THREE.SkinnedMesh(under, itemMaterial({}, low)); u.name = 'item_' + def.id + '_under'; u.frustumCulled = false; m.add(u); u.bind(skel, body.bindMatrix); }
  return { obj: m, decal: def.skull ? skullDecal(geo, skel, body, low) : null };
}
// [v136] BANKSY "That male jacket is still bad": the v5 body (broader male chest / shoulders) poked through the v4 coat warped onto
// it (skin shards on the lapels, collar and shoulders, specks on the back). The coat stays as authored; the BODY under it is pulled in:
// every body vertex the cloth covers is moved to >= CLEAR inside the nearest outward-facing cloth surface (smooth, no hard band steps).
const _sash = new WeakMap();
function sashTails(o, P) {
  if (_sash.has(P)) return _sash.get(P);
  let m = null;
  try { const map = o.material?.map, img = map?.image, U = o.geometry.attributes.uv, T = o.geometry.attributes._tint; if (img && U && T) {
    const S = 256, cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(S, S) : Object.assign(document.createElement('canvas'), { width: S, height: S }), cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0, S, S); const d = cx.getImageData(0, 0, S, S).data, n = P.count; m = new Uint8Array(n); let any = 0;
    for (let i = 0; i < n; i++) { if (Math.round(T.getX(i)) !== -1) continue; const y = P.getY(i); if (y < 0.25 || y > 0.62 || Math.abs(P.getX(i)) < 0.09) continue;
      let u = U.getX(i) % 1, v = U.getY(i) % 1; if (u < 0) u += 1; if (v < 0) v += 1; if (map.flipY) v = 1 - v;
      const k = (Math.min(S - 1, Math.floor(v * S)) * S + Math.min(S - 1, Math.floor(u * S))) * 4, R = d[k], G = d[k + 1], B = d[k + 2];
      if (R > 35 && R > G * 1.45 && R > B * 1.45) { m[i] = 1; any = 1; } }
    if (any) { const I = (o.geometry.userData.baseIndex || o.geometry.index).array;   // grow over the tails' dark fringe (a few rings, same zone)
      for (let ring = 0; ring < +(2); ring++) { const add = []; for (let t = 0; t < I.length; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2]; if (m[a] || m[b] || m[c]) add.push(a, b, c); }
        for (const q of add) { const y = P.getY(q); if (y >= 0.22 && y <= 0.6 && Math.abs(P.getX(q)) >= 0.1 && Math.round(T.getX(q)) === -1) m[q] = 1; } } }
    if (!any) m = null; } } catch (e) { m = null; }
  _sash.set(P, m); return m;
}
// [v137] hair verts below the head that sit inside / within 1.5 cm of a worn top are pushed radially out to just over its outer surface
// (angle x height bins of the cloth's outermost radius around the torso axis)
const _hair = new WeakMap();
function hairOver(B, T, cloth, tuck = false) {
  const iH = TINTS.indexOf('hair'), C = cloth.attributes.position, n = B.count; if (!C) return null;
  let cx = 0, cz = 0, y0 = Infinity, y1 = -Infinity; for (let i = 0; i < C.count; i++) { cx += C.getX(i); cz += C.getZ(i); const y = C.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; } cx /= C.count; cz /= C.count;
  const AS = 0.07, YS = 0.025, bins = new Map(), key = (a, h) => a * 4096 + h;
  for (let i = 0; i < C.count; i++) { const dx = C.getX(i) - cx, dz = C.getZ(i) - cz, r = Math.hypot(dx, dz), a = Math.round(Math.atan2(dx, dz) / AS), h = Math.round(C.getY(i) / YS), k = key(a, h);
    if (!(bins.get(k) >= r)) bins.set(k, r); }
  const na = Math.round(Math.PI / AS), D = new Float32Array(n * 3); let moved = 0;
  for (let i = 0; i < n; i++) { if (Math.round(T.getX(i)) !== iH) continue; const y = B.getY(i); if (y < y0 || y > y1) continue;
    const dx = B.getX(i) - cx, dz = B.getZ(i) - cz, r = Math.hypot(dx, dz); if (r < 1e-4) continue; const a = Math.round(Math.atan2(dx, dz) / AS), h = Math.round(y / YS);
    let rc = -1; for (let da = -1; da <= 1; da++) for (let dh = -1; dh <= 1; dh++) { let aa = a + da; if (aa > na) aa -= 2 * na; if (aa < -na) aa += 2 * na; const v = bins.get(key(aa, h + dh)); if (v > rc) rc = v; }
    if (rc < 0 || r > rc + 0.015 || r < rc - 0.08) continue;   // clear of it already / deep inside the body (not lying on the cloth)
    if (tuck) { if (r < rc + 0.02 && r > rc - 0.03) { const k = (rc - 0.03 - r) / r; D[i * 3] = dx * k; D[i * 3 + 2] = dz * k; moved++; } continue; }   // [v139] the male: his hair tips stay inside the collar / shoulders
    if (dz > 0 && r > rc - 0.03 && r < rc + 0.004) { const k = (rc - 0.03 - r) / r; D[i * 3] = dx * k; D[i * 3 + 2] = dz * k; moved++; continue; }   // front strands: tucked under the lapels instead
    if (dz > 0 && r < rc) continue;
    const k = (rc + 0.015 - r) / r; D[i * 3] = dx * k; D[i * 3 + 2] = dz * k; moved++; }
  return moved ? D : null;
}
const _under = new WeakMap();
function underCloth(B, BN, cloth, CLEAR, T) {
  const iH = TINTS.indexOf('hair');   // [v137] never the hair / beard (Low's beard got dragged into long shards along the collar)
  const R = 0.11, cs = 0.04, grid = new Map(), key = (x, y, z) => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  const C = cloth.attributes.position, CN = cloth.attributes.normal; if (!CN) return null;
  for (let i = 0; i < C.count; i++) { const k = key(Math.floor(C.getX(i) / cs), Math.floor(C.getY(i) / cs), Math.floor(C.getZ(i) / cs)); let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(i); }
  const n = B.count, D = new Float32Array(n * 3); let moved = 0;
  for (let i = 0; i < n; i++) { if (T && Math.round(T.getX(i)) === iH) continue;
    const x = B.getX(i), y = B.getY(i), z = B.getZ(i), bx = BN.getX(i), by = BN.getY(i), bz = BN.getZ(i), gx = Math.floor(x / cs), gy = Math.floor(y / cs), gz = Math.floor(z / cs); let best = -1, bd = R * R;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) { const L = grid.get(key(gx + a, gy + b, gz + c)); if (!L) continue;
      for (const j of L) { if (Math.abs(CN.getX(j) * bx + CN.getY(j) * by + CN.getZ(j) * bz) < 0.3) continue;   // [v136] single-layer cloth: either winding
        const dx = x - C.getX(j), dy = y - C.getY(j), dz = z - C.getZ(j), d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = j; } } }
    if (best < 0) continue;
    const nx = bx, ny = by, nz = bz, h = (x - C.getX(best)) * nx + (y - C.getY(best)) * ny + (z - C.getZ(best)) * nz;   // [v136] along the body normal
    const CL = CLEAR;
    if (h > -CL) { const k = Math.min(0.09, h + CL) * Math.min(1, (R - Math.sqrt(bd)) / (R * 0.4)); D[i * 3] = -nx * k; D[i * 3 + 1] = -ny * k; D[i * 3 + 2] = -nz * k; moved++; } }
  return moved ? D : null;
}
// [v136] coat skirt / shirt hem verts carrying arm / hand weights got dragged out by the swinging hands (red shards at the hips while
// walking): below the waist (v4 space) hand the arm share to the vertex's strongest torso / leg bone
function skirtOffArms(geo, P0, names) {
  const arm = names.map((nm) => /arm|hand|elbow|wrist|shoulder|clav|finger|thumb/i.test(nm)), SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const si = SI.array.slice(), sw = SW.array.slice();
  for (let i = 0; i < SI.count; i++) { const y = P0.getY(i); if (y > 0.62) continue;
    let a = 0, best = -1, bw = 0; for (let k = 0; k < 4; k++) { const j = si[i * 4 + k], w = sw[i * 4 + k]; if (!w) continue; if (arm[j]) a += w; else if (w > bw) { bw = w; best = k; } }
    if (!a || best < 0) continue; const t = Math.min(1, (0.62 - y) / 0.06);
    for (let k = 0; k < 4; k++) if (arm[si[i * 4 + k]]) sw[i * 4 + k] *= 1 - t; sw[i * 4 + best] += a * t; }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
}
// [v136] the v4 -> v5 warp folds thin cloth (lapel revers / collar) into saw-tooth spikes: Taubin smoothing (volume-keeping) on the
// welded cloth irons them out without shrinking the garment
function taubin(geo, iters, mask, P0) {
  const P = geo.attributes.position, n = P.count, I = geo.index ? geo.index.array : null; if (!I) return;
  const wid = new Int32Array(n), wm = new Map(); let nw = 0;
  for (let i = 0; i < n; i++) { const k = Math.round(P.getX(i) * 2e4) + ',' + Math.round(P.getY(i) * 2e4) + ',' + Math.round(P.getZ(i) * 2e4); let w = wm.get(k); if (w === undefined) { w = nw++; wm.set(k, w); } wid[i] = w; }
  const X = new Float32Array(nw * 3), on = new Float32Array(nw); for (let i = 0; i < n; i++) { X.set([P.getX(i), P.getY(i), P.getZ(i)], wid[i] * 3); if (!mask || mask(Math.abs(P0.getX(i)), P0.getY(i))) on[wid[i]] = 1; }
  const nb = Array.from({ length: nw }, () => new Set()); for (let t = 0; t < I.length; t += 3) { const a = wid[I[t]], b = wid[I[t + 1]], c = wid[I[t + 2]]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  const step = (k) => { const Y = X.slice(); for (let w = 0; w < nw; w++) { const L = nb[w]; if (L.size < 3 || !on[w]) continue; let sx = 0, sy = 0, sz = 0; for (const q of L) { sx += X[q * 3]; sy += X[q * 3 + 1]; sz += X[q * 3 + 2]; }
      const m = L.size; Y[w * 3] += k * (sx / m - X[w * 3]); Y[w * 3 + 1] += k * (sy / m - X[w * 3 + 1]); Y[w * 3 + 2] += k * (sz / m - X[w * 3 + 2]); } X.set(Y); };
  for (let it = 0; it < iters; it++) { step(0.5); step(-0.53); }
  for (let i = 0; i < n; i++) P.setXYZ(i, X[wid[i] * 3], X[wid[i] * 3 + 1], X[wid[i] * 3 + 2]);
  P.needsUpdate = true; geo.computeVertexNormals();
}
// [v136] BANKSY "That male jacket is still bad": the v4 coat / shirt warped onto the v5 bodies leaves slivers where the broader v5
// chest and shoulders show through between its panels. A thin cloth-coloured layer grown from the body's own torso + arm skin sits just
// under the garment (open V at the chest like the garment, sleeves stop inside the cuffs), so any gap shows cloth, never skin.
const UNDER = { suit: { tint: 'coat', vneck: 0.62, vk: 0.22, vkLo: 0.1, collar: 0.075, arms: 0.47, waist: [0.5, 0.62, 0.1, '#1d2a52'] }, shirt: { tint: 'shirt', vneck: 0.6, vkLo: 0.2, arms: 0.2, shade: 0.94 } };
// [v136] the male v4 tops only: the female coat / shirt sit right on the v5 female as authored (BANKSY's quality bar), untouched
const underOn = (p, id) => !!UNDER[id] && !p.female;
const T0 = (o) => !!(o.geometry.attributes._tint && o.geometry.attributes.normal && o.geometry.attributes.skinIndex);
const _uq = [0, 0, 0];
// [v136] which body verts the cloth-coloured underlayer replaces (cached per body geometry + top): torso / sleeve skin, minus the open V
const _keep = new WeakMap();
function underKeep(p, body, U) {
  const g = body.geometry, P = g.userData.basePos || g.attributes.position, T = g.attributes._tint; let c = _keep.get(P); if (!c) _keep.set(P, (c = new Map()));
  if (c.has(U)) return c.get(U);
  const iS = TINTS.indexOf('skin'), iSh = TINTS.indexOf('shirt'), n = P.count, keep = new Uint8Array(n), zone = new Uint8Array(n), acc = !!U.waist;
  for (let i = 0; i < n; i++) { const t = Math.round(T.getX(i)); if (t !== iS && t !== iSh && t !== -1) continue;
    const q = v5Inv(p.warp, P.getX(i), P.getY(i), P.getZ(i), _uq), qx = Math.abs(q[0]), qy = q[1], qz = q[2];
    if (qy < 0.46 || qy > 0.93 || (t === -1 && qy < 0.64)) continue;   // Low bakes the chest skin into the texture (fixed colour): above the belt only
    if (qx > 0.2 && qy > 0.7) { if (qx < U.arms) keep[i] = 1; continue; }   // sleeves (inside the garment's cuffs)
    if (qz > 0 && qy > U.vneck && qx < 0.03 + (qy - U.vneck) * ((p.lod === 'lo' ? U.vkLo : 0) || U.vk || 0.4)) continue;   // open V at the chest (narrower on Low's coarse body)
    if (qz > 0 && qy > 0.84 && qx < (U.collar || 0.11)) continue;   // collar / neck
    keep[i] = 1; if (acc && qz > 0 && qy > U.waist[0] && qy < U.waist[1] && qx < U.waist[2]) zone[i] = 1; }
  const r = { keep, zone }; c.set(U, r); return r;
}
function underShell(p, body, U, hex, low) {
  const g = body.geometry, P = g.userData.basePos || g.attributes.position, N = g.attributes.normal, T = g.attributes._tint, J = g.attributes.skinIndex, Wt = g.attributes.skinWeight;
  if (!N || !T || !J || !Wt) return null;
  const n = P.count, cloth = new THREE.Color(hex || '#b3201f'), acc = U.waist ? new THREE.Color(U.waist[3]) : null;
  const { keep, zone } = underKeep(p, body, U);
  const bi = g.userData.baseIndex || g.index; if (!bi) return null; const I = bi.array, remap = new Int32Array(n).fill(-1), list = [], out = [];
  for (let f = 0; f < I.length; f += 3) { const a = I[f], b = I[f + 1], c = I[f + 2]; if (!(keep[a] && keep[b] && keep[c])) continue;
    for (const v of [a, b, c]) { if (remap[v] < 0) { remap[v] = list.length; list.push(v); } out.push(remap[v]); } }
  if (!out.length) return null;
  const m = list.length, pos = new Float32Array(m * 3), nrm = new Float32Array(m * 3), col = new Float32Array(m * 3), uv = new Float32Array(m * 2), si = new Uint16Array(m * 4), sw = new Float32Array(m * 4), c = new THREE.Color();
  list.forEach((v, i) => { const nx = N.getX(v), ny = N.getY(v), nz = N.getZ(v), off = 0.004;
    pos.set([P.getX(v) + nx * off, P.getY(v) + ny * off, P.getZ(v) + nz * off], i * 3); nrm.set([nx, ny, nz], i * 3);
    for (let k = 0; k < 4; k++) { si[i * 4 + k] = J.getComponent(v, k); sw[i * 4 + k] = Wt.getComponent(v, k); }
    c.copy(zone[v] ? acc : cloth).multiplyScalar(U.shade || 0.8); col.set([c.r, c.g, c.b], i * 3); });   // a shade darker: reads as the inside / a fold
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(out); geo.computeBoundingSphere(); return geo;
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
  const dy = typeof def.v5dy === 'object' ? def.v5dy[base] || 0 : def.v5dy || 0;   // [v144] per body (the female helmet sits 1.5 cm higher)
  const geo = g0.clone(); if (def.crownFit || dy) geo.setAttribute('position', geo.attributes.position.clone());
  if (def.keyed) keyColors(geo, opts.colors, low); else if (opts.colors) retint(geo, opts.colors);
  const m = new THREE.SkinnedMesh(geo, itemMaterial(mat || {}, low, def.slot !== 'outfit')); m.name = 'item_' + def.id; m.frustumCulled = false;
  body.parent.add(m); m.bind(skel, body.bindMatrix);
  if (dy) { const P = geo.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) + dy); P.needsUpdate = true; geo.computeBoundingSphere(); }
  const decal = def.skull ? skullDecal(geo, skel, body, low, def.skullOpt || {}) : null;
  const v5hide = def.crownFit ? fitCrown(geo, p) : null;
  const flatten = def.crownFit ? (v5hide && crownTuck(v5hide, p)) : def.slot === 'head' ? hatFlatten(geo) : null;
  return { obj: m, decal, v5hide, flatten };
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
  return [{ raw: 1, ell: [cx, cz, rx * 0.97, rz * 0.97], y0: Y + 0.02, tints: ['hair'], rim: Y - CROWN_FIT.drop }];
}
// [v143] the hair round the crown's ermine rim (phone: black strands through the white fur, the female's long hair over it at the side /
// back; High: dark specks on the fur): every hair vertex from the rim's bottom up is drawn in inside the rim and pressed down into the band,
// and just below the rim the hair is eased in to the rim's line, so the fur sits on the hair instead of in it. Bind space, per pirate copy.
export const CROWN_TUCK = { r: 0.86, squash: 0.3, fall: { hi: 0.045, lo: 0.12 } };
function crownTuck(h, p) {
  const [cx, cz, rx, rz] = h[0].ell; return { tuck: 1, cx, cz, rx: rx / 0.97, rz: rz / 0.97, y0: h[0].rim, fall: CROWN_TUCK.fall[p.lod === 'lo' ? 'lo' : 'hi'] };
}
function tuckHair(P, T, F, iH) {
  for (let i = 0; i < P.count; i++) { const t = T ? Math.round(T.getX(i)) : 0, y = P.getY(i); if (t !== iH && t !== -1 && !(t === 0 && y > F.y0)) continue; if (y < F.y0 - F.fall) continue;   // hair + painted strands / ties round it (+ scalp skin above the rim: Low's forehead spikes)
    const dx = P.getX(i) - F.cx, dz = P.getZ(i) - F.cz, r = Math.sqrt((dx / F.rx) ** 2 + (dz / F.rz) ** 2);
    const a = Math.min(1, (y - (F.y0 - F.fall)) / F.fall), lim = CROWN_TUCK.r + (1 - a * a * (3 - 2 * a)) * 0.6;   // the limit closes in smoothly to the rim
    if (t === -1 && r > 1.6) continue; if (r > lim) { const k = lim / r; P.setX(i, F.cx + dx * k); P.setZ(i, F.cz + dz * k); }
    if (y > F.y0) P.setY(i, F.y0 + (y - F.y0) * CROWN_TUCK.squash); }
}
// [v123] BANKSY: every skull hat carries the REAL PUMPFUN PIRATES skull (assets/pirates/skull_decal.png, alpha decal). The modelled
// white skull on the hat is found by colour, painted over with the hat felt, and the decal sits on that spot (curved to the surface).
let _skullTex = null;
export function skullTexture() { if (_skullTex) return _skullTex; _skullTex = new THREE.TextureLoader().load('assets/pirates/skull_decal.png'); _skullTex.colorSpace = THREE.SRGBColorSpace; _skullTex.anisotropy = 4; return _skullTex; }
export const SKULL = { size: 0.075, lift: 0.004 };   // ~9-10 cm in game (the figure is drawn 1.25x the bind size)
export function skullDecal(geo, skel, body, low, opt = {}) {
  const P = geo.attributes.position, C = geo.attributes.color, N = geo.attributes.normal, n = P.count;
  const white = (i) => C && C.getX(i) > 0.78 && C.getY(i) > 0.72 && C.getZ(i) > 0.6 && C.getX(i) - C.getZ(i) < 0.25;   // cream / white (not gold trim)
  let y0 = 1e9, y1 = -1e9; for (let i = 0; i < n; i++) { y0 = Math.min(y0, P.getY(i)); y1 = Math.max(y1, P.getY(i)); }
  // the spot: the modelled skull (cream cluster on the front centre line), else the front-most centre point at 55% of the hat height
  const ctr = new THREE.Vector3(); let zmax = -1e9, cnt = 0;
  for (let i = 0; i < n; i++) if (white(i) && !opt.geometric && Math.abs(P.getX(i)) < 0.05 && P.getZ(i) > 0) zmax = Math.max(zmax, P.getZ(i));
  if (zmax > -1e9) { for (let i = 0; i < n; i++) if (white(i) && Math.abs(P.getX(i)) < 0.05 && P.getZ(i) > zmax - 0.03) { ctr.x += P.getX(i); ctr.y += P.getY(i); ctr.z += P.getZ(i); cnt++; } ctr.divideScalar(cnt); }
  else { const yt = y0 + (y1 - y0) * (opt.at ?? 0.55); let best = -1; for (let i = 0; i < n; i++) if (Math.abs(P.getX(i)) < 0.02 && Math.abs(P.getY(i) - yt) < 0.03 && (best < 0 || P.getZ(i) > P.getZ(best))) best = i;
    if (best < 0) return null; ctr.set(0, P.getY(best), P.getZ(best)); }
  ctr.x = 0;
  const size = SKULL.size * (opt.scale || 1), R = size * 0.9;
  // facing: the surface normal round the spot, kept mostly forward
  const nn = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { v.set(P.getX(i), P.getY(i), P.getZ(i)); if (v.distanceTo(ctr) < R && N && N.getZ(i) > 0.2) nn.add(new THREE.Vector3(N.getX(i), N.getY(i), N.getZ(i))); }
  if (nn.lengthSq() < 1e-6) nn.set(0, 0, 1); nn.normalize(); nn.y = Math.max(-0.35, Math.min(0.35, nn.y)); nn.x = 0; nn.normalize();
  // paint the old modelled skull with the felt round it, so only the real logo shows
  if (C && zmax > -1e9) { const near = [], S = []; for (let i = 0; i < n; i++) { v.set(P.getX(i), P.getY(i), P.getZ(i)); const d = v.distanceTo(ctr); if (d > 0.16 || P.getZ(i) < ctr.z - 0.12) continue; const lit = C.getX(i) + C.getY(i) + C.getZ(i) > 0.6; if (white(i) || (opt.gold && lit && d < 0.11 && P.getZ(i) > ctr.z - 0.06)) S.push(i); else if (!opt.gold || !lit) near.push(i); }
    if (near.length) { const ch = [0, 1, 2].map((k) => near.map((i) => C.getComponent(i, k)).sort((x, y) => x - y)[near.length >> 1]); const c2 = C.clone(); for (const i of S) c2.setXYZ(i, ch[0], ch[1], ch[2]); geo.setAttribute('color', c2); } }
  // 6 x 6 grid on the plane, each point lifted just above the hat surface under it (never sunk, never floating far)
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(nn, -nn.y).normalize(), rt = new THREE.Vector3().crossVectors(up, nn).normalize(), G = 6, pos = [], uv = [], idx = [], si = [], sw = [];
  const cand = []; for (let i = 0; i < n; i++) { v.set(P.getX(i), P.getY(i), P.getZ(i)); if (v.distanceTo(ctr) < size * 1.2) cand.push(i); }
  const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, q = new THREE.Vector3(); let anchor = cand[0] ?? 0;
  for (let a = 0; a <= G; a++) for (let b = 0; b <= G; b++) {
    const u = a / G, w = b / G; q.copy(ctr).addScaledVector(rt, (u - 0.5) * size).addScaledVector(up, (w - 0.5) * size);
    let d = -1e9; for (const i of cand) { v.set(P.getX(i), P.getY(i), P.getZ(i)).sub(q); const lat = v.clone().addScaledVector(nn, -v.dot(nn)).length(); if (lat < (low ? 0.03 : 0.012)) d = Math.max(d, v.dot(nn)); }
    if (d > -1e9 && d < 0.06) q.addScaledVector(nn, d);
    q.addScaledVector(nn, low ? SKULL.lift * 4 : SKULL.lift); pos.push(q.x, q.y, q.z); uv.push(u, w);
  }
  for (let i = 0; i < (G + 1) * (G + 1); i++) for (let k = 0; k < 4; k++) { si.push(SI.getComponent(anchor, k)); sw.push(SW.getComponent(anchor, k)); }
  for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) { const i0 = a * (G + 1) + b, i1 = i0 + G + 1; idx.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.setIndex(idx); g.computeVertexNormals();
  const mat = low ? new THREE.MeshBasicMaterial({ name: 'skull_decal', map: skullTexture(), alphaTest: 0.5, side: THREE.DoubleSide })
    : new THREE.MeshToonMaterial({ name: 'skull_decal', map: skullTexture(), alphaTest: 0.5, side: THREE.DoubleSide, gradientMap: gradient() });
  const m = new THREE.SkinnedMesh(g, mat); m.name = 'skull_decal'; m.frustumCulled = false; m.userData.skullDecal = true;
  body.parent.add(m); m.bind(skel, body.bindMatrix); return m;
}
// [v124] BANKSY: hair spikes poked through the bicorne / bandana. The v5 head is one shell (no hiding), so under a hat the hair above
// the hat's inner seat is squashed down into it (per pirate copy of the positions; the base mesh is untouched)
function hatFlatten(geo) {
  const P = geo.attributes.position; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ex = (x1 - x0) / 2, ez = (z1 - z0) / 2;
  for (let i = 0; i < P.count; i++) if (P.getZ(i) > cz + ez * 0.3 && Math.abs(P.getX(i) - cx) < ex * 0.3) y0 = Math.min(y0, P.getY(i));   // the seat: the hat's front rim (forehead)
  return { cx, cz, ex: ex * 0.95, ez: ez * 0.95, y: y0 + 0.03, k: 0.2 };
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
