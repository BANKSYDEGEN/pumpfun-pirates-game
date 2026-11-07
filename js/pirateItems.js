import { V7M_FITS, V7M_SKIP } from './v7mFitData.js';
export const V7F_PAINT = { facepaint_retardio: { hi: 'assets/pirates/items/v7f_paint/facepaint_retardio_female_hi.glb', lo: 'assets/pirates/items/v7f_paint/facepaint_retardio_female_lo.glb' } };   // [v7f paint] V7 female face paints (tools/v7f_paint/), built from her own face
export const V7M_PAINT = { facepaint_retardio: 'assets/pirates/items/v7m_paint/facepaint_retardio_male.glb' };   // [v7m paint] restored V7 male face paints (tools/v7m_paint/) // [v381] restored V7 male gear refits
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
import { PET_RIG } from './petRig.js';   // [Raul items redo 2] the ground pets' rig + motion
import { petPose, newPetState, PET_SIT, PET_KIND_ID } from './petMotion.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { v5Fwd, v5Inv, v5Hat, loadPirateGLB, gradient, TINTS } from './pirateGLB.js';
import { recolorPixels } from './gearRecolor.js';
import { BOOT_CUT, BOOT5, bootKeep, bootHides } from './bootPeg.js';   // [Raul items redo] boots x peg legs   // [Raul gear colours] helmet + mask hat colours

const DIR = 'assets/pirates/items/', HY = 1.12;
export const ITEM_SLOTS = ['head', 'handL', 'handR', 'legL', 'legR', 'outfit', 'shoulder', 'eyes', 'face', 'base', 'beard', 'ears', 'teeth', 'boots', 'cape'];   // [Raul shop items 2] + beard / ears / teeth / boots / cape
// [v123] Raul's per-body v5 fits (raul_polish): assets/pirates/items/v5/<id>_<male|female>_<hi|lo>.glb, pre-fitted in the v5 bind space
// (no v5Fwd / v5Hat), skinned or rigid on bone 'head'; v5hide = his hide rules (v4 space, evaluated through v5Inv like the rest)
const V5DIR = DIR + 'v5/', v5files = (id) => Object.fromEntries(['male', 'female'].map((b) => [b, { hi: `${V5DIR}${id}_${b}_hi.glb`, lo: `${V5DIR}${id}_${b}_lo.glb` }]));
const files = (id, perBase) => Object.fromEntries(['male', 'female'].map((b) => [b, Object.fromEntries(['hi', 'lo'].map((l) => [l, `${DIR}item_${id}${perBase ? '_' + b : ''}_${l}.glb`]))]));
const item = (id, label, slot, price, tint, hide, o = {}) => ({ id, label, slot, price, currency: 'gold', glb: (o.perBase ? files(id, 1) : files(id)).male.hi,
  icon: `${DIR}icons/${id}.png`, tint, files: files(id, o.perBase), hide, ...o });
// [Raul pegleg] v5 peg fit (tools: brand/v5_models/raul_pegleg): the pant leg + boot on the peg side hide below the knee sleeve's CUT
// (v5 bind space, raw: knee joint - 1.2 cm, per body), everything round the knee stays and the fitted sleeve covers the cut edge
export const PEG_CUT = { male: 0.2022, female: 0.2122 };
const PEG5 = (s) => [{ leg5: s, y: PEG_CUT.male, male: 1 }, { leg5: s, y: PEG_CUT.female, female: 1 }];
// [Raul items redo] BANKSY (10:02 AM 2026-11-04) "the boots are real bad" + "boots don't work with peg leg": rebuilt one boot per foot;
// the hide rule + the peg-side drop live in js/bootPeg.js (pure, node-tested)
export { BOOT_CUT };
// hide rules (bind space, three units): region (cyl | arm | leg | torso | sph | all) AND optional tint keys ('fixed' = untinted parts)
export const ITEMS = [
  item('hat_tricorn', 'Pirate Hat', 'head', 250, { hat: '#18181b' }, [{ cyl: [0, -0.005, 0.27], y: [HY + 0.085, 9], tilt: 0.1, tints: ['hair'] }], { v5hide: [], skull: false }),   // [v128] BANKSY "Add this hat back in": the original compact v4 Pirate Hat (gold trim, big skull + crossbones) warped onto v5 (v5Fwd / v5Hat) instead of the wide v5 refit
  item('crown', 'Pirate King Crown', 'head', 1200, { accent: '#8e1b2a' }, [{ cyl: [0, 0, 0.228], y: [HY + 0.15, 9], tilt: 0.06, tints: ['hair'] }], { v5new: v5files('crown'), v5hide: [] }),   // v5new: Raul's Imperial State Crown, ships after BANKSY OKs the fit shots   // v5: Raul's Imperial State Crown (fixed colours)
  // [v143] BANKSY "Fix and ship the Imperial crown as well": Raul's Imperial State Crown as its own item (the Pirate King Crown above is untouched).
  // v5 bodies: his per-body fits re-seated by fitCrown, the hair inside hidden and the hair round the ermine rim tucked in under it (crownTuck)
  item('crown_imperial', 'Imperial Crown', 'head', 2500, null, [{ cyl: [0, 0, 0.228], y: [HY + 0.15, 9], tilt: 0.06, tints: ['hair'] }], { v5: v5files('crown'), v5hide: [], crownFit: true, files: files('crown'), glb: files('crown').male.hi, icon: `${DIR}icons/crown.png` }),
  // [v144] BANKSY "Add a green hq helmet": Raul's olive M1 helmet (HQ stencil, skull + crossbones on the left side, leather strap + brass buckle),
  // pre-fitted per body, rigid on 'head'. v4: hair under the dome hidden; v5: hatFlatten squashes the hair above the front rim (one-shell head)
  item('helmet_hq', 'HQ Helmet', 'head', 800, null, [{ cyl: [0, 0.01, 0.29], y: [HY + 0.06, 9], tilt: 0.08, tints: ['hair'] }], { v5: v5files('helmet_hq'), v5hide: [], skull: false, v5dy: { female: 0.015 }, recolor: 'helmet' }),   // [Raul gear colours] recolor: colors.recolor repaints its map   // [v144] the female brim off her eyes
  // [v145] BANKSY: Retardio face paint v2 (Raul): warm white face base, blue diamonds round the eyes, red Joker smile; a thin shell off the
  // face under all facial hair, eye holes open. v5 only (v4 bodies draw nothing), own slot 'face' so it is worn with shades / an eye patch
  item('facepaint_retardio', 'Retardio Face Paint', 'face', 350, null, [], { v5: v5files('facepaint_retardio'), v5hide: [], v5only: true, paint: true }),
  // [Raul wrestler] LUCHADOR MASK: full-head fabric hood (gold, red flame eye surrounds + mouth trim outlined white, PUMPFUN PIRATES
  // skull on the forehead, laced back), pre-fitted per body round the head + hair, rigid on 'head'. Hat slot (no hat over it); the
  // v2 (BANKSY "giant gold egg"): a snug hood a few mm off the face + skull; the LUCHA rule hides the head under it (hair, bangs, ears,
  // her long back hair), keeps the eye-hole + open-chin zones (his beard) and her braid (out the back). No flattening (noFlatten)
  item('mask_luchador', 'Luchador Mask', 'head', 0, null, [], { v5: v5files('mask_luchador'), v5hide: [{ lucha: 1 }], v5only: true, noFlatten: true, recolor: 'lucha' }),
  item('hook_l', 'Hook Arm (Left)', 'handL', 400, null, [{ arm: 'L', s: 0.29 }], { v5: v5files('hook_l'), v5hide: [{ arm: 'L', s: 0.239, male: 1 }, { arm: 'L', s: 0.27, female: 1 }] }),
  item('hook_r', 'Hook Arm (Right)', 'handR', 400, null, [{ arm: 'R', s: 0.29 }], { v5: v5files('hook_r'), v5hide: [{ arm: 'R', s: 0.245, male: 1 }, { arm: 'R', s: 0.276, female: 1 }] }),
  item('peg_l', 'Peg Leg (Left)', 'legL', 400, { boots: '#221a16' }, [{ leg: 'L', y: 0.225, tints: ['pants'] }, { leg: 'L', y: 0.3, tints: ['boots', 'fixed'] }], { v5: v5files('peg_l'), v5hide: PEG5('L') }),
  item('peg_r', 'Peg Leg (Right)', 'legR', 400, { boots: '#221a16' }, [{ leg: 'R', y: 0.225, tints: ['pants'] }, { leg: 'R', y: 0.3, tints: ['boots', 'fixed'] }], { v5: v5files('peg_r'), v5hide: PEG5('R') }),
  // [v123] v5-only: Raul's per-body fits of Timothy's merged-gear pieces (js/pirateGear.js RAUL5); v4 bodies keep the merged pieces
  item('hat_bicorne', 'Bicorne', 'head', 0, null, [], { v5: v5files('hat_bicorne'), v5hide: [], v5only: true, keyed: true, skull: true, skullOpt: { gold: true, scale: 1.1 }, v5dy: 0.035 }),   // [v125] sat low: up 3.5 cm
  item('hat_bandana', 'Bandana', 'head', 0, null, [], { v5: v5files('hat_bandana'), v5hide: [], v5only: true, keyed: true, skull: true, skullOpt: { geometric: true, at: 0.76, scale: 0.85 }, cream: '#f3efe6' }),   // [Raul clothes v5] rebuilt: smooth cap, rolled hem, back knot + tails; cream = the polka dots (texture alpha)
  item('eyes_eyepatch', 'Eye Patch', 'eyes', 0, null, [], { v5: v5files('eyes_eyepatch'), v5hide: [], v5only: true, keyed: true }),
  item('eyes_vr', 'VR Goggles', 'eyes', 0, null, [], { v5: v5files('eyes_vr'), v5hide: [], v5only: true, keyed: true }),
  // [Raul clothes v5] BANKSY "redo all the v5 clothes (not the coats)": each garment is its own single-layer skinned mesh per body + LOD
  // with its own texture (items/v5/cloth_<id>_<body>_<lod>.glb), tinted through _TINT 'shirt' exactly as before. The body under the
  // cloth is hidden by a cover mask (no poke-through in any clip); the hems keep the skin under them so no hollow ever shows.
  item('cloth_tank', 'Tank', 'outfit', 0, { shirt: '#f1ede2' }, [], { v5: v5files('cloth_tank'), v5hide: [], v5only: true, v5cloth: true }),
  item('cloth_tshirt', 'T-Shirt', 'outfit', 0, { shirt: '#222c4e' }, [], { v5: v5files('cloth_tshirt'), v5hide: [], v5only: true, v5cloth: true, cream: '#f3efe6' }),   // cream body (fixed) + stripes in the cloth colour
  item('cloth_base', 'Base outfit', 'base', 0, null, [], { v5: v5files('cloth_base'), v5hide: [], v5only: true, v5cloth: true, base: true }),   // [Raul clothes v5] the body's painted pants / belt / boots / sash (her wrap top) as their own cloth
  // [Raul wrestler] BANKSY "Make a wrestling singlet and libre mask": one-piece singlet (deep scoop straps, racer arm holes, legs to the
  // boot tops: the chibi thigh is ~5 cm) per body + LOD, tinted 'shirt' (ship skin / clothes colour, default red); cream = the gold side stripes
  item('cloth_singlet', 'Wrestling Singlet', 'outfit', 0, { shirt: '#c8302c' }, [], { v5: v5files('cloth_singlet'), v5hide: [], v5only: true, v5cloth: true, cream: '#e9b949' }),
  item('shirt', 'Pirate Shirt', 'outfit', 300, { shirt: '#f4efe3' }, [{ all: 1, tints: ['shirt'], lod: 'hi' }, { torso: [0.47, 0.62], tints: ['skin'], female: 1 }, { torso: [0.47, 0.54], tints: ['skin'], male: 1 }, { torso: [0.47, 0.86], back: 1, tints: ['skin'] },
    { arm: 'L', s: [0.04, 0.18], tints: ['skin'] }, { arm: 'R', s: [0.04, 0.18], tints: ['skin'] },
    { v5: 1, v5torso: [0.36, 0.95, 0.16], vneck: 0.62, tints: ['skin', 'shirt'] }], { perBase: true, v5: v5files('cloth_shirt'), v5hide: [], v5cloth: true, cream: '#3a2414' }),   // [Raul clothes v5] v5: own single-layer laced shirt (cream = the laces)   // [v121] v5: the body under the shirt
  item('suit', "Captain's Coat", 'outfit', 900, { coat: '#b3201f', accent: '#1d2a52' }, [{ all: 1, tints: ['shirt'] }, { torso: [0.47, 0.75], tints: ['skin'], female: 1 }, { torso: [0.47, 0.59], tints: ['skin'], male: 1 }, { torso: [0.47, 0.86], back: 1, tints: ['skin'] },
    { arm: 'L', s: [0.04, 0.3], tints: ['skin'] }, { arm: 'R', s: [0.04, 0.3], tints: ['skin'] },
    { v5: 1, v5torso: [0.36, 0.95, 0.28], vneck: 0.66, tints: ['skin', 'shirt'] }], { perBase: true, v5: v5files('cloth_suit'), v5hide: [], v5cloth: true, backTint: 'coat', longCoat: true }),   // [Raul coats v5] v5: own long coat (gold trim + epaulettes, waistcoat = accent, knee skirt on spine -> thighs); v4 keeps the old files
  // [Raul coats v5] BANKSY "Also need the jackets": the COAT (Timothy's grown shell on v4) is Raul's own per-body garment on v5: open front over
  // a striped shirt (cream + stripe colour via the texture alpha), trim = accent, tails from the belt to mid thigh (spine -> thigh weights)
  item('cloth_coat', 'Coat', 'outfit', 0, { coat: '#c8302c', accent: '#e9b949', shirt: '#222c4e' }, [], { v5: v5files('cloth_coat'), v5hide: [], v5only: true, v5cloth: true, cream: '#f3efe6', backTint: 'coat', longCoat: true }),
  // [Raul shop items 2] BANKSY "Do new shop items": v5-only per-body fits (brand/v5_models/raul_shop_items_2/tools/build.py), one mesh each,
  // own ink outline shell (single-sided: single). Beards + the captain's cape = marker colours (keyed: hair / clothes colour); rigid on 'head'
  // (beards, earrings, teeth), shins (boots, special pegs) or spine (capes, shoulder pets). No hide rules: each sits outside what it covers.
  item('beard_moustache', "Captain's Moustache", 'beard', 0, null, [], { v5: v5files('beard_moustache'), v5hide: [], v5only: true, keyed: true, single: true }),
  item('beard_forked', 'Forked Beard', 'beard', 0, null, [], { v5: v5files('beard_forked'), v5hide: [], v5only: true, keyed: true, single: true }),
  item('beard_black', 'Blackbeard', 'beard', 0, null, [], { v5: v5files('beard_black'), v5hide: [], v5only: true, single: true }),
  item('earring_hoop', 'Gold Hoops', 'ears', 0, null, [], { v5: v5files('earring_hoop'), v5hide: [], v5only: true, single: true }),
  item('earring_double', 'Double Hoops', 'ears', 0, null, [], { v5: v5files('earring_double'), v5hide: [], v5only: true, single: true }),
  item('earring_skull', 'Skull Earrings', 'ears', 0, null, [], { v5: v5files('earring_skull'), v5hide: [], v5only: true, single: true }),
  item('tooth_gold', 'Gold Tooth', 'teeth', 0, null, [], { v5: v5files('tooth_gold'), v5hide: [], v5only: true, single: true, decal: true }),
  item('grill_gold', 'Gold Grill', 'teeth', 0, null, [], { v5: v5files('grill_gold'), v5hide: [], v5only: true, single: true, decal: true }),
  item('grill_diamond', 'Diamond Grill', 'teeth', 0, null, [], { v5: v5files('grill_diamond'), v5hide: [], v5only: true, single: true, decal: true }),
  item('boots_buckle', 'Buckle Boots', 'boots', 0, null, [], { v5: v5files('boots_buckle'), v5hide: BOOT5('boots_buckle'), v5only: true, single: true, boots: true }),
  item('boots_cavalier', 'Cavalier Boots', 'boots', 0, null, [], { v5: v5files('boots_cavalier'), v5hide: BOOT5('boots_cavalier'), v5only: true, single: true, boots: true }),
  item('boots_gold', 'Gold-Toe Boots', 'boots', 0, null, [], { v5: v5files('boots_gold'), v5hide: BOOT5('boots_gold'), v5only: true, single: true, boots: true }),
  // [V6 store] Clothing Store shoes (boots slot) + pants ('base' item: the body's underwear under it goes, the boots cut it at the shaft)
  item('boots_classic', 'Classic Boots', 'boots', 0, null, [], { v5: v5files('boots_classic'), v5hide: BOOT5('boots_classic'), v5only: true, single: true, boots: true }),
  item('sandals', 'Sandals', 'boots', 0, null, [], { v5: v5files('sandals'), v5hide: BOOT5('sandals'), v5only: true, single: true, boots: true }),
  item('shoes_buckle', 'Low Buckle Shoes', 'boots', 0, null, [], { v5: v5files('shoes_buckle'), v5hide: BOOT5('shoes_buckle'), v5only: true, single: true, boots: true }),
  item('boots_sea', 'Sea Boots', 'boots', 0, null, [], { v5: v5files('boots_sea'), v5hide: BOOT5('boots_sea'), v5only: true, single: true, boots: true }),
  ...['classic_pants', 'canvas_pants', 'sailor_trousers', 'leather_breeches'].map((id) => item(id, id.replace(/_/g, ' '), 'base', 0, null, [], { v5: v5files(id), v5hide: [], v5only: true, v5cloth: true, base: true, pants: true })),
  item('cape_tattered', 'Tattered Cape', 'cape', 0, null, [], { v5: v5files('cape_tattered'), v5hide: [], v5only: true, single: true }),
  item('cape_captain', "Captain's Cape", 'cape', 0, null, [], { v5: v5files('cape_captain'), v5hide: [], v5only: true, single: true, keyed: true }),
  item('cape_royal', 'Royal Cape', 'cape', 0, null, [], { v5: v5files('cape_royal'), v5hide: [], v5only: true, single: true }),
  item('pet_monkey', 'Shoulder Monkey', 'shoulder', 0, null, [], { v5: v5files('pet_monkey'), v5hide: [], v5only: true, single: true }),
  item('pet_cat', "Ship's Cat", 'shoulder', 0, null, [], { v5: v5files('pet_cat'), v5hide: [], v5only: true, single: true }),
  item('pet_cat_black', 'Black Cat', 'shoulder', 0, null, [], { v5: v5files('pet_cat_black'), v5hide: [], v5only: true, single: true }),
  item('pet_chimp', 'Chimp', 'shoulder', 0, null, [], { v5: v5files('pet_chimp'), v5hide: [], v5only: true, single: true }),   // [Raul items redo 2]
  item('pet_gorilla', 'Gorilla', 'shoulder', 0, null, [], { v5: v5files('pet_gorilla'), v5hide: [], v5only: true, single: true, meshy: 'assets/pirates/items/v7/pet_gorilla_kn.glb' }),
  item('pet_tiger', 'Tiger', 'shoulder', 0, null, [], { v5: v5files('pet_tiger'), v5hide: [], v5only: true, single: true }),   // [Raul items redo 2] BANKSY 11:39 AM
  item('pet_gorilla_white', 'White Gorilla', 'shoulder', 0, null, [], { v5: v5files('pet_gorilla_white'), v5hide: [], v5only: true, single: true, meshy: 'assets/pirates/items/v7/pet_gorilla_white_kn.glb' }),
  // [Raul shop items 2] BANKSY (10:16 PM): SPECIAL peg legs, the peg slot's left / right fit; [Raul pegleg] re-seated on the v5 peg fit (knee sleeve, PEG5 hide)
  item('peg_gold_l', 'Gilded Peg (Left)', 'legL', 0, null, [], { v5: v5files('peg_gold_l'), v5hide: PEG5('L'), v5only: true }),
  item('peg_gold_r', 'Gilded Peg (Right)', 'legR', 0, null, [], { v5: v5files('peg_gold_r'), v5hide: PEG5('R'), v5only: true }),
  item('peg_kraken_l', 'Kraken Bone Peg (Left)', 'legL', 0, null, [], { v5: v5files('peg_kraken_l'), v5hide: PEG5('L'), v5only: true }),
  item('peg_kraken_r', 'Kraken Bone Peg (Right)', 'legR', 0, null, [], { v5: v5files('peg_kraken_r'), v5hide: PEG5('R'), v5only: true }),
  // [Raul pegs 2] BANKSY (11:47 PM via Emerly): the premium SPECIAL PEG, built natively on the knee-sleeve fit (tools/blender/pegleg/build_special.py); its ghost-green trim glows (glow: GLOW5)
  item('peg_ghost_l', 'Ghost Bone Peg (Left)', 'legL', 0, null, [], { v5: v5files('peg_ghost_l'), v5hide: PEG5('L'), v5only: true, glow: true }),
  item('peg_ghost_r', 'Ghost Bone Peg (Right)', 'legR', 0, null, [], { v5: v5files('peg_ghost_r'), v5hide: PEG5('R'), v5only: true, glow: true }),
  item('parrot', 'Parrot', 'shoulder', 1500, null, [],
    { attach: { bone: 'spine', feet: [0.242, 0.916, -0.016], offset: { male: [0, 0, 0], female: [0.05, -0.034, 0.0] }, lean: { male: 0, female: -0.42 } }, clip: 'parrot_idle' }),
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
export const itemsForSlot = (slot) => ITEMS.filter((d) => d.slot === slot && !d.v5only);

// [Raul clothes v5] cover mask: body (or base-outfit) verts lying just behind a worn v5 garment, at least CLOTH.in from its hems (_HEM).
// Faces with all 3 verts covered drop out, so no skin / wrap top can poke through the cloth in any pose; the hem rows stay.
export const CLOTH = { r: 0.024, in: 0.016, back: 0.004, cut: { male: 0.615, female: 0.66 } };
const _cover = new WeakMap(), _hkey = (x, y, z) => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
function coverMask(P, T, cloth) {
  let m = _cover.get(cloth); if (!m) _cover.set(cloth, (m = new WeakMap())); if (m.has(P)) return m.get(P);
  const C = cloth.attributes.position, CN = cloth.attributes.normal, H = cloth.attributes._hem, cs = CLOTH.r, grid = new Map(), n = P.count, out = new Uint8Array(n), iH = TINTS.indexOf('hair');
  for (let i = 0; i < C.count; i++) { const k = _hkey(Math.floor(C.getX(i) / cs), Math.floor(C.getY(i) / cs), Math.floor(C.getZ(i) / cs)); let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(i); }
  for (let i = 0; i < n; i++) { if (T && Math.round(T.getX(i)) === iH) continue;
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), gx = Math.floor(x / cs), gy = Math.floor(y / cs), gz = Math.floor(z / cs); let best = cs * cs, bj = -1;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const L = grid.get(_hkey(gx + a, gy + b, gz + c)); if (!L) continue;
      for (const j of L) { const d = (C.getX(j) - x) ** 2 + (C.getY(j) - y) ** 2 + (C.getZ(j) - z) ** 2; if (d < best) { best = d; bj = j; } } }
    if (bj < 0 || (H && H.getX(bj) < CLOTH.in)) continue;
    if (H || (C.getX(bj) - x) * CN.getX(bj) + (C.getY(bj) - y) * CN.getY(bj) + (C.getZ(bj) - z) * CN.getZ(bj) > -CLOTH.back) out[i] = 1; }   // well inside the garment: gone even if a bump of it pokes out
  m.set(P, out); return out;
}
// [Raul clothes v5] the base outfit (pants, belt, sash, boots, her wrap top) is its own mesh now: the body's painted outfit under it goes
// (Outfit verts below the belt line + her 'shirt' top; never the braid ties, bracelets or face bits above)
const _baseM = new WeakMap();
function baseMask(o, P, T, female) {
  if (_baseM.has(P)) return _baseM.get(P);
  const g = o.geometry, J = g.attributes.skinIndex, W = g.attributes.skinWeight, bones = o.skeleton?.bones.map((b) => b.name.replace(/[^A-Za-z0-9]/g, '').toLowerCase()) || [];
  const n = P.count, out = new Uint8Array(n), iSh = TINTS.indexOf('shirt'), cut = CLOTH.cut[female ? 'female' : 'male'];
  for (let i = 0; i < n; i++) { const t = Math.round(T.getX(i)); if (t !== -1 && t !== iSh) continue; if (t === -1 && P.getY(i) > cut) continue;
    if (J && W) { let b = 0, w = -1; for (let k = 0; k < 4; k++) { const x = W.getComponent(i, k); if (x > w) { w = x; b = J.getComponent(i, k); } } if (bones[b] === 'braid') continue; }
    out[i] = 1; }
  _baseM.set(P, out); return out;
}
// [Raul wrestler] under the luchador mask (three bind space, per body; tools/mask.py prints these): every head vertex above the mask's
// bottom (cut) goes, except the front eye-hole zones + the open chin (x, y centre, x, y radii; front = z > zf); below the cut only the
// hair (the male beard in front stays). Her braid (top bone 'braid') always stays.
export const LUCHA = {
  male: { cut: 0.855, zf: 0.1, eyes: [[0.0961, 1.0275, 0.1161, 0.1317], [-0.0887, 1.0245, 0.1141, 0.1256]], chin: [0, 0.735, 0.18, 0.189] },
  female: { cut: 0.925, zf: 0.1, eyes: [[0.0942, 1.0804, 0.1045, 0.0982], [-0.0919, 1.0905, 0.1129, 0.1227]], chin: [0, 0.805, 0.15, 0.202] },
};
const _braid = new WeakMap();
function braidOf(o) {   // per body geometry: the vertex's strongest bone, 1 = 'braid', 2 = 'head'
  const g = o.geometry, P = g.userData.basePos || g.attributes.position; if (_braid.has(P)) return _braid.get(P);
  const J = g.attributes.skinIndex, W = g.attributes.skinWeight, bones = o.skeleton?.bones.map((b) => b.name.replace(/[^A-Za-z0-9]/g, '').toLowerCase()) || [], out = new Uint8Array(P.count);
  if (J && W) for (let i = 0; i < P.count; i++) { let b = 0, w = -1; for (let k = 0; k < 4; k++) { const x = W.getComponent(i, k); if (x > w) { w = x; b = J.getComponent(i, k); } } out[i] = bones[b] === 'braid' ? 1 : bones[b] === 'head' ? 2 : 0; }
  _braid.set(P, out); return out;
}
const _ell = (e, x, y) => ((x - e[0]) / e[2]) ** 2 + ((y - e[1]) / e[3]) ** 2 < 1;
// [wrestler v2] BANKSY "singlet legs read like a dress": the baggy base pants under the singlet are pulled in round each leg's axis
// (same transform as the singlet's fitting proxy, singlet.py), so the singlet hugs the hips + thighs and opens a crotch line
export const LEGPULL = { male: { cx: 0.10, cz: 0.06, a: 0.22, belt: 0.58 }, female: { cx: 0.10, cz: 0.05, a: 0.18, belt: 0.64 } };
const _ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _pull = new WeakMap();
function legPull(P, L) {
  let m = _pull.get(P); if (!m) _pull.set(P, (m = new Map())); if (m.has(L)) return m.get(L);
  const Q = P.clone();
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), w = _ss(0.30, 0.36, y) * (1 - _ss(L.belt - 0.14, L.belt - 0.04, y)); if (!w) continue;
    const k = L.a * w, cx = L.cx * Math.tanh(x / 0.06); Q.setX(i, x - (x - cx) * k); Q.setZ(i, z - (z - L.cz) * k); }
  m.set(L, Q); return Q;
}
function luchaHit(L, x, y, z, t, bone) {   // braid / side strands hidden too (no clean re-attach out of the hood)
  if (bone === 1) return true;
  if (!L.male && bone === 2 && y < L.cut && (y < L.cut - 0.1 || Math.hypot(x, z) > 0.12)) return true;   // her loose strands round the neck (head-weighted, any tint); the neck itself stays
  const front = z > L.zf, hair = t === TINTS.indexOf('hair');
  if (y > L.cut) return !(front && ((_ell(L.chin, x, y) && (L.male || !hair)) || (!hair && L.eyes.some((e) => _ell(e, x, y)))));
  return hair && !(L.male && front);
}
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
  const bIt = p.v5 ? p.items.base : null, tops = p.v5 ? Object.values(p.items).filter((it) => it.cloth && it !== bIt && it.obj?.geometry) : [];   // [Raul clothes v5]
  for (const o of [...(p.atlasMeshes || []), ...(bIt?.obj ? [bIt.obj] : [])]) {
    const g = ownGeometry(o), base = g.userData.baseIndex, isCloth = o === bIt?.obj;
    g.userData.basePos ||= g.attributes.position; g.userData.shrink = null;
    if (!rules.length && !tops.length && !(bIt && !isCloth)) { if (isCloth && g.attributes.position !== g.userData.basePos) g.setAttribute('position', g.userData.basePos); g.setIndex(base); continue; }
    let P = g.userData.basePos; const Tt = g.attributes._tint, n = P.count, hid = new Uint8Array(n); let shr = null;
    if (isCloth) { const PP = p.items.outfit?.id === 'cloth_singlet' ? legPull(P, LEGPULL[p.female ? 'female' : 'male']) : P; if (g.attributes.position !== PP) g.setAttribute('position', PP); P = PP; }
    if (bIt && !isCloth && Tt) hid.set(baseMask(o, P, Tt, p.female));
    for (const tp of tops) { const cm = coverMask(P, Tt, tp.obj.geometry); for (let i = 0; i < n; i++) if (cm[i]) hid[i] = 1; }
    if (p.v6 && bIt?.obj?.geometry && !isCloth) { const cm = coverMask(P, Tt, bIt.obj.geometry); for (let i = 0; i < n; i++) if (cm[i]) hid[i] = 1; }   // [V6 store] the legs' skin under the pants
    if (isCloth && (p.items.outfit?.id === 'suit' || p.items.outfit?.id === 'cloth_singlet' || ITEM_BY_ID[p.items.outfit?.id]?.longCoat) && Tt) for (let i = 0; i < n; i++) if (Math.round(Tt.getX(i)) === TI('accent')) hid[i] = 1;   // sash tails under the long coats / the singlet
    const LU = p.v5 && !isCloth && rules.some((r) => r.lucha) ? { ...LUCHA[p.female ? 'female' : 'male'], male: !p.female } : null, BR = LU ? braidOf(o) : null;   // [Raul wrestler]
    const SG = p.v5 && !isCloth && p.items.outfit?.id === 'cloth_singlet' ? CLOTH.cut[p.female ? 'female' : 'male'] : 0, SB = SG ? braidOf(o) : null;
    for (let i = 0; i < n; i++) { if (hid[i]) continue; const t = Tt ? Math.round(Tt.getX(i)) : -1, rX = P.getX(i), rY = P.getY(i), rZ = P.getZ(i); let X = rX, Y = rY, Z = rZ; if (p.warp) { const q = v5Inv(p.warp, X, Y, Z); X = q[0]; Y = q[1]; Z = q[2]; }   // [v121] rules are in v4 bind space
      if (LU && luchaHit(LU, rX, rY, rZ, t, BR[i])) { hid[i] = 1; continue; }
      if (SG && t === TINTS.indexOf('hair') && rY < SG && (p.female || Math.abs(rX) < 0.14) && SB[i] !== 1) { hid[i] = 1; continue; }   // [wrestler v2] hair-tinted pants detail (fly / sash folds) under the fitted singlet legs (never the braid)
      for (const r of rules) { if (r.lucha) continue;
        if (r.boot5) { if (bootHides(r, rX, rY, p.female, p.items.legL, p.items.legR)) { hid[i] = 1; break; } continue; }   // [Raul items redo] both legs under the boots (not a peg leg: PEG5 owns that one)
        if (r.leg5) { if ((r.female && !p.female) || (r.male && p.female)) continue; const sx = r.leg5 === 'L' ? 1 : -1; if (sx * rX > 0.002 && sx * rX < 0.3 && rY < r.y) { hid[i] = 1; break; } continue; }   // [Raul pegleg] v5 raw: that leg below the cut (body + base outfit)
        if (r.raw) { if (r.tints && !r.tints.some((k) => TI(k) === t)) continue; const [ex, ez, ax, az] = r.ell; if (rY > r.y0 && ((rX - ex) / ax) ** 2 + ((rZ - ez) / az) ** 2 < 1) { hid[i] = 1; break; } continue; }   // [v123] v5 bind-space ellipse (crown)
        if (p.v5 && r.tints?.includes('hair') && !r.raw) continue;
        if (isCloth && (r.raw || r.v5torso)) continue;   // the base outfit only takes the plain region rules (peg leg)   // [v123] Raul: never hide v5 hair under a hat (the AI head is hollow: holes)
        if (p.v5 && r.v5torso) {   // [v124] BANKSY "jacket has holes": hiding the v5 torso opened the hollow body in the coat's open front.
          if (r.tints && !r.tints.some((k) => TI(k) === t)) continue;   // Now the torso is pulled in under the garment instead (shrink); only the upper arms inside the sleeves hide
          const [y0, y1, s1] = r.v5torso; if (Y < y0 || Y > y1) continue;
          if (Math.abs(X) < 0.2) { (shr ||= new Uint8Array(n))[i] = 1; continue; }
          if (s1 && sArm(X, Y, X > 0 ? 1 : -1) < s1 - 0.04) { hid[i] = 1; break; } continue; }
        if (ruleHit(r, X, Y, Z, t, p.female, p.lod, !!p.v5)) { hid[i] = 1; break; } } }
    const src = base.array, out = [];
    for (let i = 0; i < src.length; i += 3) if (!(hid[src[i]] && hid[src[i + 1]] && hid[src[i + 2]])) out.push(src[i], src[i + 1], src[i + 2]);
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1)); g.userData.shrink = shr; g.userData.under = null;
    if (isCloth) continue;
    const top = p.v5 && p.warp ? Object.values(p.items).find((it) => underOn(p, it.id) && it.obj?.geometry) : null;
    if (top && o.geometry.attributes.normal) { const cg = top.obj.geometry; let m = _under.get(cg); if (!m) _under.set(cg, (m = new WeakMap()));
      if (!m.has(P)) m.set(P, underCloth(P, o.geometry.attributes.normal, cg, p.lod === 'lo' ? 0.055 : 0.032, o.geometry.attributes._tint)); const D = m.get(P); if (D) { g.userData.under = D; g.userData.shrink = null; } }
    // [v137] BANKSY "speckled hair / black speckles by the braid": the braid + long hair lie ON the coat / shirt and z-fought it: hair
    // over a worn top is lifted just outside the cloth (the female: the male's hair stays tucked in his collar)
    const tp = p.v5 && p.warp ? Object.values(p.items).find((it) => (it.id === 'suit' || it.id === 'shirt' || (it.cloth && it !== bIt)) && it.obj?.geometry) : null;
    if (tp && g.attributes._tint) { const cg = tp.obj.geometry; let m = _hair.get(cg); if (!m) _hair.set(cg, (m = new WeakMap()));
      if (!m.has(P)) m.set(P, hairOver(P, g.attributes._tint, cg, !p.female, tp.cloth && tp.id !== 'cloth_singlet' ? 0.17 : 0)); const H = m.get(P);
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
  flattenHair(p); baseTop(p); bootsUnderPeg(p);
  // [v381] Raul: the restored V7 male's source head is locked (no hat / mask hides his head, hair or beard triangles).
  // never remove source head/hair/beard triangles to make a hat or mask appear to fit.
  if (p.v7 && !p.female) for (const o of p.atlasMeshes || []) {
    if (!o.userData.sourceLocked) continue;
    const g=o.geometry,B=g.userData.baseIndex,P=g.userData.basePos||g.attributes.position;
    if (g.attributes.position!==P) g.setAttribute('position',P);
    const SI=g.attributes.skinIndex,SW=g.attributes.skinWeight,hi=o.skeleton.bones.findIndex(b=>b.name==='head'),H=new Uint8Array(P.count);
    for(let i=0;i<P.count;i++)for(let k=0;k<4;k++)if(SI.getComponent(i,k)===hi&&SW.getComponent(i,k)>.99)H[i]=1;
    const out=[];for(let i=0;i<g.index.count;i+=3){const a=g.index.array.subarray(i,i+3);if(!a.some(v=>H[v]))out.push(...a);}
    for(let i=0;i<B.count;i+=3){const a=B.array.subarray(i,i+3);if(a.some(v=>H[v]))out.push(...a);}
    g.setIndex(new THREE.BufferAttribute(P.count>65535?new Uint32Array(out):new Uint16Array(out),1));
  }
}
// [Raul shop items 2] boots + a peg leg: the boot on the peg's side goes. [Raul items redo] BANKSY "boots don't work with peg leg":
// each boot is its own closed shell on its own side (bind-space x sign of the whole triangle), so the peg-side boot is dropped whole
// (nothing left over the peg or its knee sleeve). The full index is kept per geometry in a WeakMap (BufferGeometry.clone() SHARES
// userData between pirates), the peg key per worn item
const BOOTIX = new WeakMap();
function bootsUnderPeg(p) {
  const b = p.items?.boots, g = b?.obj?.geometry; if (!g) return; if (!BOOTIX.has(g)) BOOTIX.set(g, g.index);
  const L = !!p.items.legL, R = !!p.items.legR, key = (L ? 'L' : '') + (R ? 'R' : ''); if (b.pegKey === key) return; b.pegKey = key;
  const I0 = BOOTIX.get(g); if (!key) { g.setIndex(I0); return; }
  const P = g.attributes.position, out = bootKeep(P, I0.array, L, R);
  g.setIndex(new THREE.BufferAttribute(P.count > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1));
}
// [Raul clothes v5] (v141 tankTop, on the base outfit now) under a worn v5 top her wrap top takes the top's colour: no red rims at the
// arm holes / neckline; restored when it comes off (or under the coat)
function baseTop(p) {
  const b = p.items?.base, g = b?.obj?.geometry; if (!g || !b.col0) return; const top = p.items.outfit, hex = top?.cloth ? top.hex : null, key = hex || '';
  if (b.topKey === key) return; b.topKey = key; const T = g.attributes._tint, C = g.attributes.color, iSh = TINTS.indexOf('shirt'), col = new THREE.Color(hex || '#000');
  for (let i = 0; i < T.count; i++) { if (Math.round(T.getX(i)) !== iSh) continue; if (hex) C.setXYZ(i, col.r, col.g, col.b); else C.setXYZ(i, b.col0[i * 3], b.col0[i * 3 + 1], b.col0[i * 3 + 2]); }
  C.needsUpdate = true;
}
function flattenHair(p) {   // [v124] hair under the worn hat (v5 only)
  if (p.v7 && !p.female && p.atlasMeshes?.some(o => o.userData.sourceLocked)) return; // [v381] locked source: fit the gear, never squash / tuck / shrink him
  const F = p.v5 ? Object.values(p.items || {}).map((it) => it.flatten).find(Boolean) : null, iH = TINTS.indexOf('hair');
  const PT = p.v5 && p.lod === 'lo' ? Object.values(p.items || {}).find((it) => it.paint && it.obj?.geometry) : null;
  for (const o of p.atlasMeshes || []) {
    const g = ownGeometry(o); g.userData.basePos ||= o.geometry.attributes.position;
    const S = g.userData.shrink;
    const U = g.userData.under, D = PT && g.attributes.normal ? paintBack(g.userData.basePos, g.attributes.normal, g.attributes._tint, PT.obj.geometry) : null;
    if (!F && !S && !U && !D) { if (g.attributes.position !== g.userData.basePos) g.setAttribute('position', g.userData.basePos); continue; }
    const B = g.userData.basePos, P = B.clone(), T = g.attributes._tint;
    if (U) for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) + U[i * 3], P.getY(i) + U[i * 3 + 1], P.getZ(i) + U[i * 3 + 2]);
    if (D) for (let i = 0; i < P.count; i++) if (D[i]) P.setXYZ(i, P.getX(i) - g.attributes.normal.getX(i) * D[i], P.getY(i) - g.attributes.normal.getY(i) * D[i], P.getZ(i) - g.attributes.normal.getZ(i) * D[i]);
    if (S) { let cz = 0, c = 0; for (let i = 0; i < P.count; i++) if (S[i]) { cz += P.getZ(i); c++; } cz /= c || 1;
      for (let i = 0; i < P.count; i++) if (S[i]) { P.setX(i, P.getX(i) * 0.9); P.setZ(i, cz + (P.getZ(i) - cz) * 0.9); } }   // torso 10 % in under the coat / shirt
    if (!F) { g.setAttribute('position', P); continue; }
    if (F.tuck) { tuckHair(P, T, F, iH); g.setAttribute('position', P); continue; }
    for (let i = 0; i < P.count; i++) { if (!T || Math.round(T.getX(i)) !== iH) continue; const y = P.getY(i); if (y <= F.y) continue;
      const dx = (P.getX(i) - F.cx) / F.ex, dz = (P.getZ(i) - F.cz) / F.ez; if (dx * dx + dz * dz > 1) continue; P.setY(i, F.y + (y - F.y) * F.k); }
    g.setAttribute('position', P);
  }
}
// [Raul pegs 2] glow trims: vertices painted GLOW5 (pegfit.GLOW #39ff9c) stay full bright on desktop (toon light can't darken them; + a soft
// emissive lift). Phone (MeshBasic, unlit) already shows them full bright (the build skips the baked light on them). One shader variant, no extra draw.
export const GLOW5 = [0.0409, 1.0, 0.3325];   // linear #39ff9c
function glowMat(m) {
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#if defined( USE_COLOR )\n  if (distance(vColor.rgb, vec3(0.0409, 1.0, 0.3325)) < 0.06) totalEmissiveRadiance += vColor.rgb * 0.6;\n#endif'); };
  m.customProgramCacheKey = () => 'glow5'; return m;
}
function itemMaterial(src, low, two = false) { const m = itemMaterial0(src, low); if (two) m.side = THREE.DoubleSide; return m; }   // [v124] v5 hats / eyewear / hooks: solid from inside too (tops have their own lining)
// [v139] BANKSY "black bits on the male phone shoulder line": the warped coat folds a few cloth triangles over at the shoulder / collar,
// so their inside (dark lining texels) faced out as black shards. Inside faces of the male tops now draw in the cloth colour, shaded.
function backCloth(m, hex, low) {
  if (hex == null) return m; const c = new THREE.Color(hex).multiplyScalar(low ? 0.7 : 0.85), u = { value: c };
  m.onBeforeCompile = (sh) => { sh.uniforms.uBack = u; sh.fragmentShader = 'uniform vec3 uBack;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  if (!gl_FrontFacing) diffuseColor.rgb = uBack;'); };
  m.customProgramCacheKey = () => 'backCloth'; return m;
}
// [Raul clothes v5] his garments: both faces drawn, the inside in the cloth colour (shaded); two-tone tops (the t-shirt) keep the
// tint (vertex colour) where the texture alpha says so and a fixed cream elsewhere -> crisp stripes in any ship colour, no extra triangles
function clothMat(m, hex, low, cream) {
  const back = { value: new THREE.Color(hex || '#dddddd').multiplyScalar(low ? 0.7 : 0.85) }, cr = { value: new THREE.Color(cream || '#ffffff') }, two = !!cream && !!m.map;
  m.side = THREE.DoubleSide; m.transparent = false;
  m.onBeforeCompile = (sh) => { sh.uniforms.uBack = back; sh.uniforms.uCream = cr;
    sh.fragmentShader = 'uniform vec3 uBack;\nuniform vec3 uCream;\n' + sh.fragmentShader.replace('#include <color_fragment>', (two
      ? '#if defined( USE_COLOR )\n  diffuseColor.rgb *= mix(uCream, vec3(vColor), sampledDiffuseColor.a);\n#endif\n  diffuseColor.a = opacity;'
      : '#include <color_fragment>') + '\n  if (!gl_FrontFacing) diffuseColor.rgb = uBack;'); };
  m.customProgramCacheKey = () => 'cloth5' + (two ? '2' : '1'); return m;
}
function itemMaterial0(src, low) {
  if (low) return new THREE.MeshBasicMaterial({ name: 'item_lo', map: src.map || null, vertexColors: true });
  return new THREE.MeshToonMaterial({ name: 'item_hi', map: src.map || null, normalMap: src.normalMap || null, vertexColors: true, gradientMap: gradient() });
}
function retint(geo, colors) {
  const t = geo.attributes._tint; if (!t || !colors) return; const c = geo.attributes.color.clone(), col = new THREE.Color(); geo.setAttribute('color', c);
  for (let i = 0; i < t.count; i++) { const k = TINTS[Math.round(t.getX(i))]; if (k && colors[k] != null) { col.set(colors[k]); c.setXYZ(i, col.r, col.g, col.b); } }
}
// [Raul gear colours] the HQ helmet + luchador mask are painted maps: the hat colour repaints a cached COPY of the map
// (js/gearRecolor.js recolorPixels), never the shared original. m.userData.texVerts: ship crews bake vertex colours only, so
// js/crewV4.js samples this map per vertex for them (their helmet / mask in the same colour).
const _rcTex = new Map();
const RC_MAX = (() => { try { return matchMedia('(pointer: coarse)').matches ? 512 : 4096; } catch { return 4096; } })(); // [mobile-perf] phones: each colour copy at most 512 px (was the full map, up to 26 copies)
function recolorTex(tex, kind, hex) {
  const img = tex?.image; if (!img?.width || !img.height || typeof document === 'undefined') return tex;
  const key = tex.uuid + kind + hex; if (_rcTex.has(key)) return _rcTex.get(key);
  let out = tex;
  try {
    const k = Math.min(1, RC_MAX / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, c.width, c.height); const d = cx.getImageData(0, 0, c.width, c.height); recolorPixels(d.data, kind, hex, c.width); cx.putImageData(d, 0, 0);
    out = tex.clone(); out.source = new THREE.Source(c); out.needsUpdate = true;
  } catch (e) { console.warn('[gear] recolour', kind, e); }
  _rcTex.set(key, out); return out;
}
// Native fitted pants/shoes/plain capes carry fixed painted colours, not a pants/boots _TINT channel.
// Tint only their fabric/leather family in the shader; retain painted folds, ink, gold, cream and red sash.
function fittedGearRecolor(m, def, hex) {
  const kind = def.pants ? 'pants' : def.boots ? 'boots' : /^(cape_tattered|cape_royal)$/.test(def.id) ? 'cape' : null;
  if (!kind || !hex) return false;
  const mat = m.material, previous = mat.onBeforeCompile, cache = mat.customProgramCacheKey?.bind(mat);
  const U = { gearDye: { value: new THREE.Color(hex) }, gearDyeOn: { value: 1 } };
  const reference = ({ classic_pants:.16, canvas_pants:.32, sailor_trousers:.32, leather_breeches:.12, cape_tattered:.035, cape_royal:.16 })[def.id] || .09;
  const hasTint = !!m.geometry.attributes._tint;
  mat.onBeforeCompile = (shader, renderer) => {
    previous?.call(mat, shader, renderer); Object.assign(shader.uniforms, U);
    shader.vertexShader = 'varying float vGearY; varying float vGearTag;\n' + (hasTint ? 'attribute float _tint;\n' : '') + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGearY = position.y; vGearTag = ' + (hasTint ? '_tint' : '-1.0') + ';');
    shader.fragmentShader = 'uniform vec3 gearDye; uniform float gearDyeOn; varying float vGearY; varying float vGearTag;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      // Classification in sRGB; recolouring in linear light. Default (no dye) never installs this hook.
      vec3 dyeBase = diffuseColor.rgb;
      vec3 dc = mix(12.92 * dyeBase, 1.055 * pow(max(dyeBase, vec3(0.0)), vec3(1.0/2.4)) - .055, step(vec3(.0031308), dyeBase));
      float mx = max(dc.r,max(dc.g,dc.b)), mn = min(dc.r,min(dc.g,dc.b)), delta = mx-mn;
      float sat = delta/max(mx,.00001), hue = 0.0;
      if (delta > .00001) {
        if (mx == dc.r) hue = 60.0 * mod((dc.g-dc.b)/delta+6.0,6.0);
        else if (mx == dc.g) hue = 60.0*((dc.b-dc.r)/delta+2.0);
        else hue = 60.0*((dc.r-dc.g)/delta+4.0);
      }
      float red = float((hue<18.0 || hue>345.0) && sat>.30);
      float gold = float(hue>35.0 && hue<65.0 && sat>.55 && mx>.5);
      float neutralDark = float(sat<.20 && mx>.055 && mx<.75);
      float inkKeep = smoothstep(.018,.06,mx);
      float dyeMask = ${kind==='pants'?'(1.0-smoothstep(.565,.595,vGearY)) * (1.0-red) * (1.0-gold) * (1.0-step(2.5,vGearTag)*step(vGearTag,3.5))':kind==='boots'?'float((hue>10.0 && hue<75.0 && sat>.12) || neutralDark>.5) * (1.0-gold)':'max(red,neutralDark) * (1.0-gold)'} * inkKeep;
      float dyeShade = clamp(dot(dyeBase,vec3(.2126,.7152,.0722))/${reference.toFixed(5)},.035,2.0);
      diffuseColor.rgb = mix(dyeBase,gearDye*dyeShade,clamp(dyeMask*gearDyeOn,0.0,1.0));
    `);
  };
  mat.customProgramCacheKey = () => (cache?.() || '') + '|fitted-gear-dye-v1|' + kind + '|' + def.id + '|' + Number(hasTint);
  m.userData.gearRecolor = { kind, hex, uniforms: U, reference, hasTint };
  m.userData.texVerts = true; mat.needsUpdate = true; return true;
}

function recolorItem(m, def, colors) {
  if (fittedGearRecolor(m, def, colors?.recolor)) return;
  if (!def.recolor) return; m.userData.texVerts = true; const hex = colors?.recolor; if (!hex || !m.material?.map) return;
  m.material.map = recolorTex(m.material.map, def.recolor, hex); m.material.needsUpdate = true;
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
  // [v381] the restored V7 male wears his native-space refit (no second v4->v5 warp); V7M_SKIP items keep the old path for now
  // [v7m paint] BANKSY "Redo the retardio face paint on v7 characters" (male): his own skin-mapped shell (body topology + weights, painted map,
  // alpha-masked to his skin texels: hair / beard / brows / eyes stay his) instead of the refit v5 mask. Male V7 only; female + v5 unchanged.
  // [v7f paint] BANKSY t433u "Do v7 girl face paint too": her own skin-mapped shell (hi / lo each from that body), same Retardio design
  if (p.female && p.v7 && V7F_PAINT[def.id]) return buildV5(p, {...def, v5:{female:V7F_PAINT[def.id]}, crownFit:false, noFlatten:true, v5dy:0}, opts, low, body, skel, names);
  if (!p.female && p.v7 && body.userData.sourceLocked && V7M_PAINT[def.id]) { const u = V7M_PAINT[def.id];
    return buildV5(p, {...def, v5:{male:{hi:u,lo:u}}, crownFit:false, noFlatten:true, v5dy:0}, opts, low, body, skel, names); }
  if (!p.female && p.v7 && body.userData.sourceLocked && V7M_FITS[def.id] && !V7M_SKIP.has(def.id)) {
    const F=V7M_FITS[def.id];
    return buildV5(p, {...def, v5:{male:{hi:F.hi,lo:F.lo}}, crownFit:false, noFlatten:true, v5dy:0}, opts, low, body, skel, names);
  }
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
  recolorItem(m, def, opts.colors);
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
// [v145] the phone bodies' coarse face skin pokes through the 4 mm face paint shell in tan patches: skin under the paint (a paint
// vertex within 1.2 cm; tinted or painted skin) sinks 6 mm along its normal. Eye-hole rims and the hair keep their place. Bind space, cached per body + paint
const _paint = new WeakMap();
function paintBack(B, N, T, paint) {
  let m = _paint.get(paint); if (!m) _paint.set(paint, (m = new WeakMap())); if (m.has(B)) return m.get(B);
  const Q = paint.attributes.position, iS = TINTS.indexOf('skin'), grid = new Map(), c = 0.012, k = (x, y, z) => `${Math.floor(x / c)},${Math.floor(y / c)},${Math.floor(z / c)}`;
  let y0 = Infinity; for (let j = 0; j < Q.count; j++) { const x = Q.getX(j), y = Q.getY(j), z = Q.getZ(j), kk = k(x, y, z); y0 = Math.min(y0, y); (grid.get(kk) || grid.set(kk, []).get(kk)).push(x, y, z); }
  let D = null;
  for (let i = 0; i < B.count; i++) { const t = T ? Math.round(T.getX(i)) : -1; if (t !== iS && t !== -1) continue; const x = B.getX(i), y = B.getY(i), z = B.getZ(i); if (y < y0 - c) continue;
    const gx = Math.floor(x / c), gy = Math.floor(y / c), gz = Math.floor(z / c); let best = c * c;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) { const L = grid.get(`${gx + a},${gy + b},${gz + e}`); if (L) for (let j = 0; j < L.length; j += 3) best = Math.min(best, (L[j] - x) ** 2 + (L[j + 1] - y) ** 2 + (L[j + 2] - z) ** 2); }
    if (best < c * c) (D ||= new Float32Array(B.count))[i] = 0.006; }
  m.set(B, D); return D;
}
const _hair = new WeakMap();
function hairOver(B, T, cloth, tuck = false, xmax = 0) {   // xmax: [Raul clothes v5] torso only (sleeves would push the side strands out along the arms)
  const iH = TINTS.indexOf('hair'), C = cloth.attributes.position, n = B.count; if (!C) return null;
  let cx = 0, cz = 0, y0 = Infinity, y1 = -Infinity; for (let i = 0; i < C.count; i++) { cx += C.getX(i); cz += C.getZ(i); const y = C.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; } cx /= C.count; cz /= C.count;
  const AS = 0.07, YS = 0.025, bins = new Map(), key = (a, h) => a * 4096 + h;
  for (let i = 0; i < C.count; i++) { const dx = C.getX(i) - cx, dz = C.getZ(i) - cz; if (xmax && Math.abs(dx) > xmax) continue; const r = Math.hypot(dx, dz), a = Math.round(Math.atan2(dx, dz) / AS), h = Math.round(C.getY(i) / YS), k = key(a, h);
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
const underOn = (p, id) => !!UNDER[id] && !p.female && !(p.v5 && ITEM_BY_ID[id]?.v5cloth);   // [Raul clothes v5] his new tops: cover mask instead
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
const colors3 = (C) => { const a = new Float32Array(C.count * 3); for (let i = 0; i < C.count; i++) { a[i * 3] = C.getX(i); a[i * 3 + 1] = C.getY(i); a[i * 3 + 2] = C.getZ(i); } return a; };   // (COLOR_0 may be normalized uint16 x4)
// [v145] the phone face paint's baked light is flat per triangle (a blocky grey checker on the white). Snap each corner to its paint colour and
// average the light over the corners that share a spot, so it shades smoothly. Bind space, per pirate copy (the geometry is a clone)
const PAINT = [[0.8, 0.69, 0.53], [0.01, 0.04, 0.41], [0.43, 0, 0], [0, 0, 0.03]];
function paintLo(geo) {
  if (!geo.attributes.color) return; const C = geo.attributes.color.clone(), P = geo.attributes.position; geo.setAttribute('color', C);
  const lit = new Float32Array(C.count), pick = new Uint8Array(C.count), sum = new Map(), key = (i) => `${Math.round(P.getX(i) * 2000)},${Math.round(P.getY(i) * 2000)},${Math.round(P.getZ(i) * 2000)}`;
  for (let i = 0; i < C.count; i++) {
    const c = [C.getX(i), C.getY(i), C.getZ(i)], m = Math.max(...c, 1e-4); let best = 0, bd = 9;
    PAINT.forEach((q, j) => { const qm = Math.max(...q, 1e-4), d = (m < 0.06 ? 1 : 0) !== (j === 3 ? 1 : 0) ? 9 : q.reduce((a, v, k) => a + (v / qm - c[k] / m) ** 2, 0); if (d < bd) { bd = d; best = j; } });
    pick[i] = best; lit[i] = best === 3 ? 1 : Math.min(1, m / Math.max(...PAINT[best])); const k = key(i), e = sum.get(k) || [0, 0]; e[0] += lit[i]; e[1]++; sum.set(k, e);
  }
  for (let i = 0; i < C.count; i++) { const e = sum.get(key(i)), l = 0.25 + 0.75 * (e[0] / e[1]), q = PAINT[pick[i]]; C.setXYZ(i, q[0] * l, q[1] * l, q[2] * l); }
  C.needsUpdate = true;
}

// [Raul shop2 fixes] tiny vertex-shader layers on Raul's rigid items (bind space, before skinning, so they ride the bones as before):
//  - the shoulder PETS idle (BANKSY via Emerly "give the pets an idle animation"): breathing, the head looking about, the tail swishing
//  - the CAPE's swim lift: in the water (swim / tread / climb / hop) the cape floats a few cm off the back, so the crawl's shoulders and
//    the coat under it no longer push through
// Driven by ONE PirateGLB post hook ('items', order 2: after the swim (0) and emote (1) layers; battle.js weapons still land last).
// No bones, no mixer, no allocation per frame: one uniform write per item.
// [Raul items redo 2] the GROUND PETS (cat, black cat, monkey, chimp, gorillas) stand on the floor (bind copy: beside your left foot, rides
// 'root'; on foot js/onfoot/pets.js draws a free copy that follows you). Their motion is the PET layer below: the GLB's uv = the rig
// (u = part: 0 body, 1 head, 2 tail, 3 / 4 front limbs, 5 / 6 back legs; v = along the limb), pivots = js/petRig.js, numbers =
// js/petMotion.js petPose (walk / run gait, sit, groom, hop, knuckle-walk, chest-beat). The old shoulder pets' PET_IDLE is gone.
export const PET_IDLE = Object.fromEntries(Object.keys(PET_RIG).map((id) => [id, { kind: 'PET' }]));
export const CAPE_LIFT = 0.07;   // m off the back at full swim weight
const LAYER_FN = `
vec3 lyRotY(vec3 p, vec3 o, float a) { p -= o; float c = cos(a), s = sin(a); return o + vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 lyRotX(vec3 p, vec3 o, float a) { p -= o; float c = cos(a), s = sin(a); return o + vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
vec3 lyRotZ(vec3 p, vec3 o, float a) { p -= o; float c = cos(a), s = sin(a); return o + vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }`;
const PET_GLSL = `{ vec3 q = transformed - uLyB; float part = floor(uv.x + 0.5), lv = uv.y, ph = uLyG.x, wk = uLyG.y, rn = uLyG.z, st = uLyG.w, t = uLyT;
    float S = uLyK.x, kind = uLyK.y, ape = step(1.5, kind), mky = step(0.5, kind) * (1.0 - ape), cat = 1.0 - step(0.5, kind), tg = step(0.5, uLyK.z), beat = uLyA.x * ape, groom = uLyA.x * cat * (1.0 - tg), stc = uLyA.x * tg, pnc = uLyA.y * tg;   // tg: the tiger (cat gait + stretch / pounce)
    float th = st * mix(0.55, 0.32, step(0.5, kind)), amp = (wk * 0.5 + rn * 0.35) * (1.0 - st);
    // limbs: diagonal pairs at a walk, a bound at a run (fronts together, backs together); the monkey hops (legs together, arms swing)
    if (part > 2.5) { float li = part - 3.0; vec3 pv = li < 0.5 ? uPv[3] : li < 1.5 ? uPv[4] : li < 2.5 ? uPv[5] : uPv[6];
      float diag = (li < 0.5 || li > 2.5) ? 0.0 : 3.14159, bnd = li < 1.5 ? 0.0 : 2.2, o = mix(diag, bnd + mod(li, 2.0) * 0.3, rn);
      if (mky > 0.5) o = li < 1.5 ? (li < 0.5 ? 0.0 : 3.14159) : 1.57;
      float a = amp * sin(ph + o) * (mky > 0.5 && li > 1.5 ? 0.45 : 1.0) * (uLyK.w > 0.0 ? uLyK.w : 1.0);   // [v367] uLyK.w: per-model stride scale (the knuckle gorilla)
      if (li > 1.5) { q = pv + (q - pv) * vec3(1.0, 1.0 - 0.5 * st * cat * lv, 1.0); }   // sit: the hind legs fold under the haunch
      q = lyRotX(q, pv, a); q.y += max(0.0, cos(ph + o)) * (wk * 0.025 + rn * 0.035) * S * lv;
      if (li < 1.5) {   // front limbs: counter the sit pitch (paws stay down), groom (cat: the left paw up to the mouth), chest-beat (gorillas)
        q = lyRotX(q, pv, th); q.y -= st * 0.06 * S * lv * cat;
        q = lyRotX(q, pv, -0.95 * stc - 0.85 * pnc);   // tiger: front paws reach out in the stretch / the pounce
        float up = li < 0.5 ? groom : 0.0; q = lyRotX(q, pv, -1.5 * up + 0.12 * up * sin(t * 9.0));
        float sl = -1.35 * beat - 0.5 * beat * (li < 0.5 ? sin(t * 13.0) : -sin(t * 13.0)); q = lyRotY(lyRotX(q, pv, sl), pv, (li < 0.5 ? -0.7 : 0.7) * beat);
      } }
    // head: look about, nod; groom = head down to the paw; it counters the sit / beat pitch so the face stays level
    if (part > 0.5 && part < 1.5) { vec3 nk = uPv[0]; q = lyRotX(lyRotY(q, nk, uLyA.z + 0.25 * groom * sin(t * 4.5)), nk, uLyA.w + th * 0.8 + 0.3 * beat - 0.04 * sin(t * 1.3)); }
    // tail: lazy swish, faster at a walk, curls up when sitting
    if (part > 1.5 && part < 2.5) { vec3 tr = uPv[2]; q = lyRotY(q, tr, (0.32 * sin(t * 1.6) + 0.25 * wk * sin(ph)) * lv); q = lyRotX(q, tr, (-0.25 * st - 0.15 * rn) * lv); }
    // body: breathe, bob with the gait, hop, settle into the sit, rear up to beat the chest
    float br = 0.025 * sin(t * 2.4) * (1.0 - step(0.5, part)); q = vec3(q.x * (1.0 + br), q.y * (1.0 + br * 0.6), q.z);
    q.y += (wk * 0.012 + rn * 0.03) * S * abs(sin(ph)) * (1.0 - mky) + mky * (wk * 0.06 + rn * 0.09) * S * abs(sin(ph * 0.5)) + uLyA.y * 0.13 * S;
    vec3 sp = uPv[1]; q = lyRotX(q, sp, -th - 0.42 * beat + 0.3 * stc - 0.2 * pnc); q.y -= st * 0.035 * S * cat; q.z += pnc * 0.16 * S;   // tiger: chest down + rump up to stretch, leans into the pounce
    transformed = q + uLyB; }`;
const LAYER_GLSL = {
  PET: PET_GLSL,
  CAPE: `{ float w = smoothstep(uLyB.y, uLyB.y - 0.18, transformed.y) * uLyT; transformed.z -= w; transformed.x *= 1.0 + 0.6 * w; }`,
};
function itemLayer(m, g0, def, B0 = null, Z = null) {   // B0: a free pet copy (its own origin) instead of the bind-space anchor
  const pet = def.slot !== 'cape', kind = pet ? 'PET' : 'CAPE', bb = g0.boundingBox || (g0.computeBoundingBox(), g0.boundingBox), R = pet ? PET_RIG[def.id] : null;
  const B = !pet ? new THREE.Vector3(0, bb.max.y - 0.03, 0) : B0 || new THREE.Vector3(...R.anchor);
  const U = { uLyT: { value: 0 }, uLyB: { value: B } };
  if (pet) Object.assign(U, { uLyG: { value: new THREE.Vector4(0, 0, 0, PET_SIT[R.kind] || 0) }, uLyA: { value: new THREE.Vector4() },
    uLyK: { value: new THREE.Vector4((Z ? Z.h : R.h) / 0.3, PET_KIND_ID[R.kind], R.kind === 'tiger' ? 1 : 0, Z?.amp || 0) }, uPv: { value: ['neck', 'sit', 'tail', 'fl', 'fr', 'bl', 'br'].map((k) => new THREE.Vector3(...((Z ? Z.pv[k] || Z.pv.sit : R[k] || R.sit)))) } });
  const mat = m.material, prev = mat.onBeforeCompile, ck = mat.customProgramCacheKey?.bind(mat);
  mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uLyT; uniform vec3 uLyB;' + (pet ? ' uniform vec4 uLyG, uLyA, uLyK; uniform vec3 uPv[7];' : '') + (Z ? ' attribute vec2 petPart;' : '') + LAYER_FN).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (Z ? LAYER_GLSL[kind].replace('floor(uv.x + 0.5), lv = uv.y', 'floor(petPart.x + 0.5), lv = petPart.y') : LAYER_GLSL[kind])); };
  mat.customProgramCacheKey = () => (ck ? ck() : '') + '|ly' + kind + (Z ? 'm' : '');
  m.userData.layer = { kind, U, t: Math.random() * 20, st: pet ? newPetState(R.kind, Math.random()) : null };
  return m.userData.layer;
}
// drive one pet layer: speed = how fast it moves (0 = the bound copy: sits by your feet / on deck, does its idle acts)
export function petLayerTick(L, dt, speed = 0) {
  if (!L?.st) return; L.t += Math.min(0.1, dt || 0); L.U.uLyT.value = L.t; petPose(L.st, speed, dt);
  L.U.uLyG.value.fromArray(L.st.G); L.U.uLyA.value.fromArray(L.st.A);
}
function itemsPost(dt) {   // PirateGLB post hook (this = the pirate)
  for (const k of ['shoulder', 'cape']) { const L = this.items?.[k]?.obj?.userData?.layer; if (!L) continue;
    if (L.kind === 'CAPE') { const w = this._sw?.w || 0; L.U.uLyT.value = CAPE_LIFT * w * w * (3 - 2 * w); }
    else if (this.items[k].obj.visible) petLayerTick(L, dt, 0); }
}
// [Raul shop2 fixes] BANKSY via Emerly "fix the cape and coat clipping": the capes were rigid on the spine, so the back leg (walk / run),
// the flutter kick (swim) and the jig kicked through the hem. Below the hips the cape now blends from the spine onto the thighs, like the
// coat tails it hangs over (they move together: no tails poking through either): each side mostly its own thigh, a little of the other
// (no split down the middle). Bind-space weights only, computed once per GLB (same cost to draw, no new bones).
export const CAPE_FOLLOW = { top: 0.06, bottom: 0.3, max: 0.78, own: 0.8, side: 0.07 };
function capeFollowLegs(g0, geo, skel, names) {
  const ix = (n) => names.findIndex((b) => b.replace(/[^A-Za-z0-9]/g, '').toLowerCase() === n), iL = ix('thighl'), iR = ix('thighr'), iS = ix('spine');
  if (iL < 0 || iR < 0 || iS < 0) return;
  let W = g0.userData.capeW;
  if (!W) {
    const BL = new THREE.Matrix4().copy(skel.boneInverses[iL]).invert().elements, hy = BL[13], sx = Math.sign(BL[12]) || 1, P = g0.attributes.position, n = P.count, F = CAPE_FOLLOW;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i < n; i++) { const w = F.max * ss(hy + F.top, hy - F.bottom, P.getY(i)), l = ss(-F.side, F.side, P.getX(i) * sx), wl = w * (l * F.own + (1 - l) * (1 - F.own)), wr = w - wl;
      si.set([iS, iL, iR, 0], i * 4); sw.set([1 - w, wl, wr, 0], i * 4); }
    W = g0.userData.capeW = { si, sw };
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(W.si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(W.sw, 4));
}
// [Raul items redo 2] a FREE copy of a ground pet (js/onfoot/pets.js: it follows you on foot): a plain mesh, origin = the floor under it,
// facing +z, its own PET layer (drive it with petLayerTick(mesh.userData.layer, dt, speed)). Shares the GLB's buffers with the bound copy.
const _petGeo = new Map();
// [v360 BANKSY t1917u] the Meshy gorillas: static textured meshes (no PET layer), ground-centred, facing +z, real size
// [v363 BANKSY t1921u-t1925u] Meshy pets walk again: each vertex gets a PET part (head / arm / leg, + how far down the limb) from a per-model
// zone map (bind space of the Meshy mesh: y up, +z front, +x = its left), read by the same PET layer shader as the old pets via a petPart
// attribute. scale = drawn size: the gorilla stands so a pirate's head reaches its chest (BANKSY "pirate would be up to his nipple").
// [v367 BANKSY t1930u/t1946u] KNUCKLE-WALK like the old gorilla: the Meshy body is re-posed once in Blender (tools: /workspace/gorilla_rig/knuckle2.py,
// a 12-bone skeleton + distance-blended weights): torso pitched ~55° forward over the hips, arms straight down onto the knuckles, head up to look
// ahead, knees bent. Each vertex carries its PET part from that rig (_PETPART: head / arm / leg + how far down the limb); the PET shader swings the
// four limbs in diagonal pairs from the posed shoulder / hip pivots below (glTF space: y up, +z front).
export const MESHY_RIG = {
  pet_gorilla: { scale: 1.6, h: 1.23, baked: true, amp: 0.5,
    pv: { neck: [0, 0.83, 0.24], sit: [0, 0.43, -0.28], fl: [0.36, 0.81, 0.21], fr: [-0.36, 0.81, 0.21], bl: [0.15, 0.43, -0.28], br: [-0.15, 0.43, -0.28] } },
};
MESHY_RIG.pet_gorilla_white = { ...MESHY_RIG.pet_gorilla, scale: 1.47 };   // same build + the crown; same body height as the black one
function meshyParts(g, Z) {
  if (g.attributes.petPart) return; if (g.attributes._petpart) { g.setAttribute('petPart', g.attributes._petpart); return; }   // [v367] baked by the knuckle rig
  const P = g.attributes.position, A = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), ax = Math.abs(x); let part = 0, lv = 0;
    if (y > Z.head && ax < Z.headX) { part = 1; lv = 1; }
    else if (y > Z.arm.y0 && y < Z.arm.y1 && ax > Z.arm.x(y)) { part = x > 0 ? 3 : 4; lv = Math.min(1, Math.max(0, (Z.arm.y1 - y) / (Z.arm.y1 - Z.arm.y0))); }
    else if (y < Z.leg.y1 && ax < Z.leg.x) { part = x > 0 ? 5 : 6; lv = Math.min(1, Math.max(0, (Z.leg.y1 - y) / Z.leg.y1)); }
    A[i * 2] = part; A[i * 2 + 1] = lv; }
  g.setAttribute('petPart', new THREE.BufferAttribute(A, 2));
}
const _meshy = new Map();
async function meshyScene(url, id) {
  if (!_meshy.has(url)) _meshy.set(url, loadPirateGLB(url)); const g = await _meshy.get(url), Z = MESHY_RIG[id];
  const o = new THREE.Group(), inner = g.scene.clone(true); o.add(inner); if (Z) inner.scale.setScalar(Z.scale); let mesh = null;
  inner.traverse((m) => { if (!m.isMesh) return; m.castShadow = true; m.frustumCulled = false; if (Z && !mesh) { mesh = m; meshyParts(m.geometry, Z); m.material = m.material.clone(); } });
  if (Z && mesh) o.userData.layer = itemLayer(mesh, mesh.geometry, ITEM_BY_ID[id], new THREE.Vector3(), Z);
  return o;
}
export async function petMesh(id, female, low) {
  const def = ITEM_BY_ID[id], R = PET_RIG[id]; if (!def?.v5 || !R) return null;
  if (def.meshy) { const o = await meshyScene(def.meshy, id); o.name = 'pet-' + id; return o; }
  const url = def.v5[female ? 'female' : 'male'][low ? 'lo' : 'hi'];
  let e = _petGeo.get(url);
  if (!e) { const gltf = await loadPirateGLB(url); let src = null; gltf.scene.traverse((o) => { if (o.isMesh && (!src || o.geometry.attributes.position.count > src.geometry.attributes.position.count)) src = o; });
    const g = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'color', 'uv']) if (src.geometry.attributes[k]) g.setAttribute(k, k === 'position' ? src.geometry.attributes[k].clone() : src.geometry.attributes[k]);
    g.setIndex(src.geometry.index); g.translate(-R.anchor[0], -R.anchor[1], -R.anchor[2]); g.computeBoundingSphere(); e = { g, mat: src.material }; _petGeo.set(url, e); }
  const m = new THREE.Mesh(e.g, itemMaterial(e.mat || {}, low)); m.name = 'pet-' + id; m.frustumCulled = true;
  itemLayer(m, e.g, def, new THREE.Vector3()); return m;
}
async function buildV5(p, def, opts, low, body, skel, names) {
  if (def.meshy) { const o = await meshyScene(def.meshy, def.id); o.name = 'item_' + def.id; o.position.fromArray(PET_RIG[def.id].anchor); body.parent.add(o); if (o.userData.layer) p.addPost?.('items', itemsPost, 2); return { obj: o }; }   // [v360] beside your foot (bind space)
  const base = p.female ? 'female' : 'male', { geo: g0, mat } = await v5Geometry(def.v5[base][p.lod], names);
  const dy = typeof def.v5dy === 'object' ? def.v5dy[base] || 0 : def.v5dy || 0;   // [v144] per body (the female helmet sits 1.5 cm higher)
  const geo = g0.clone(); if (def.crownFit || dy) geo.setAttribute('position', geo.attributes.position.clone());
  if (def.slot === 'cape') capeFollowLegs(g0, geo, skel, names);   // [Raul shop2 fixes] the hem rides the thighs (walk / run / swim / emotes: no legs through it)
  if (def.keyed) keyColors(geo, opts.colors, low); else if (opts.colors && !def.base) retint(geo, opts.colors);
  if (def.paint && p.lod === 'lo') paintLo(geo);
  const bt = def.backTint || 'shirt', hex = def.v5cloth ? opts.colors?.[bt] ?? def.tint?.[bt] : null;   // [Raul coats v5] coats: the inside in the coat colour   // [Raul clothes v5] single-layer cloth: both sides drawn, the inside in the cloth colour (shaded)
  const m = new THREE.SkinnedMesh(geo, def.v5cloth && !def.base ? clothMat(itemMaterial(mat || {}, low, true), hex, low, def.cream) : def.keyed && def.cream ? clothMat(itemMaterial(mat || {}, low, true), opts.colors?.[1] || '#c8302c', low, def.cream) : itemMaterial(mat || {}, low, (def.slot !== 'outfit' || !!def.v5cloth) && !/^(hook|peg)_/.test(def.id) && !def.single)); m.name = 'item_' + def.id; m.frustumCulled = false;   // [Timothy] hooks + pegs single-sided: their black ink outline shell drew over the whole item when double-sided (black hook / peg)
  recolorItem(m, def, opts.colors);
  if (def.glow && !low) glowMat(m.material);   // [Raul pegs 2]
  if (PET_IDLE[def.id] || def.slot === 'cape') { itemLayer(m, g0, def); p.addPost?.('items', itemsPost, 2); }   // [Raul shop2 fixes] pet idle + the cape's swim lift
  if (def.decal) Object.assign(m.material, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });   // [Raul shop items 2] the grin sticker wins over the lips / beard under it
  if (def.paint) { m.material = m.material.clone(); Object.assign(m.material, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }); if (m.material.map) m.material.alphaTest = 0.5; }   // [v145] the paint wins over the skin under it (phone bodies poked through the 4 mm shell)
  body.parent.add(m); m.bind(skel, body.bindMatrix);
  if (dy) { const P = geo.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) + dy); P.needsUpdate = true; geo.computeBoundingSphere(); }
  const decal = def.skull ? skullDecal(geo, skel, body, low, def.skullOpt || {}) : null;
  const v5hide = def.crownFit ? fitCrown(geo, p) : null;
  const flatten = def.crownFit ? (v5hide && crownTuck(v5hide, p)) : def.slot === 'head' && !def.noFlatten ? hatFlatten(geo) : null;
  const cl = def.v5cloth ? { cloth: true, hex, col0: def.base ? colors3(geo.attributes.color) : null } : null;
  return { obj: m, decal, v5hide, flatten, ...cl };
}
// [v362] V7 female: widen the crown's rim (x / z about its centre, + a matching lift) to her hair's cross-section at the rim height
// plus a margin, so the Meshy hair sits inside it instead of poking out the sides. Only ever grows; bind space, per-pirate copy.
export const V7_HAT_GROW = { margin: 1.08, band: 0.02 };
function v7GrowHat(geo, p) {
  const P = geo.attributes.position; let ymin = 1e9; for (let i = 0; i < P.count; i++) ymin = Math.min(ymin, P.getY(i));
  let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (let i = 0; i < P.count; i++) { if (P.getY(i) > ymin + 0.03) continue; a0 = Math.min(a0, P.getX(i)); a1 = Math.max(a1, P.getX(i)); b0 = Math.min(b0, P.getZ(i)); b1 = Math.max(b1, P.getZ(i)); }
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const o of p.atlasMeshes || []) { const B = o.geometry.attributes.position; for (let i = 0; i < B.count; i++) { const y = B.getY(i); if (y < ymin - V7_HAT_GROW.band || y > ymin + 0.06) continue;
    const x = B.getX(i), z = B.getZ(i); if (Math.abs(x) > 0.5 || Math.abs(z) > 0.5) continue; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } }
  if (!(x1 > x0) || !(a1 > a0)) return;
  const sx = Math.max(1, (x1 - x0) * V7_HAT_GROW.margin / (a1 - a0)), sz = Math.max(1, (z1 - z0) * V7_HAT_GROW.margin / (b1 - b0)); if (sx === 1 && sz === 1) return;
  const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2, sy = (sx + sz) / 2;
  for (let i = 0; i < P.count; i++) P.setXYZ(i, ca + (P.getX(i) - ca) * sx, ymin + (P.getY(i) - ymin) * sy, cb + (P.getZ(i) - cb) * sz);
  P.needsUpdate = true; geo.computeBoundingSphere();
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
  if (p.v7 && p.female && def.id === 'crown') it.obj?.traverse?.((o) => { if (o.isMesh && o.geometry?.attributes.position) { o.geometry = o.geometry.clone(); v7GrowHat(o.geometry, p); } });   // [v362] BANKSY t1920u: her hair poked out the crown's sides
  if (p._eqTok[def.slot] !== tok) { drop(it); return null; }   // a newer equip / unequip on this slot won
  if (p.items[def.slot]) drop(p.items[def.slot]);
  p.items[def.slot] = { id, hide: def.hide, paint: def.paint, ...it, v5hide: def.v5 ? (it.v5hide || def.v5hide) : null }; applyHide(p); return it.obj;
}
export function unequip(p, slotOrId) {
  const slot = ITEM_SLOTS.includes(slotOrId) ? slotOrId : ITEM_BY_ID[slotOrId]?.slot; if (!slot || !p.items?.[slot]) return;
  p._eqTok[slot] = {}; drop(p.items[slot]); delete p.items[slot]; applyHide(p);
}
export const equipped = (p) => Object.fromEntries(Object.entries(p.items || {}).map(([s, it]) => [s, it.id]));
export const equipAll = (p, ids, opts) => Promise.all(ids.map((id) => equip(p, id, opts)));
