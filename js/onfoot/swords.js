// [Timothy] PUMPFUN PIRATES battle areas: the cosmetic SWORDS + the range MUSKET as chunky low-poly geometry (one vertex-coloured
// BufferGeometry each, no textures, ~150-400 tris). Shared by the SWORD PIT / MUSKET RANGE runtime (js/onfoot/battle.js: in the
// hand, on the weapon racks) and the shop card renders (tools/battle/sword_thumbs.py -> assets/pirates/thumbs/sword_<id>.png).
// Frames: a sword's grip centre is the origin and the blade points +Y (edge facing +Z); the musket's butt is the origin, barrel +Z.
// SWORD_IDS is APPEND-ONLY: the index rides in the arena state ('ba') so other pirates see your blade.
import * as THREE from 'three';
import { toon } from '../toon.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SWORD_IDS = ['rusty', 'cutlass', 'rapier', 'bone', 'sabre_gilded', 'blade_gold'];
export const SWORD_DEFAULT = 'rusty';
const _c = new THREE.Color();
const T = (x, y, z, rx = 0, ry = 0, rz = 0, s = [1, 1, 1]) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(...s));
function merge(parts) { // [[geometry, colour, Matrix4]] -> one non-indexed vertex-coloured geometry
  const gs = parts.map(([g, col, m]) => { let q = g.index ? g.toNonIndexed() : g; q.deleteAttribute('uv'); q.deleteAttribute('normal'); if (m) q.applyMatrix4(m); _c.set(col);
    const n = q.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; } q.setAttribute('color', new THREE.BufferAttribute(c, 3)); return q; });
  const g = mergeGeometries(gs, false); gs.forEach(x => x.dispose()); g.computeVertexNormals(); return g;
}
// a curved single-edge blade: n segments along +Y, the back bowing towards -Z (a sabre / cutlass curve), tapering to a point
function curvedBlade(len, w0, w1, th, bow, n = 6, tipLen = 0.12) {
  const pos = [], idx = [], ring = (y, w, zc) => { const b = pos.length / 3; pos.push(0, y, zc + w * 0.5, th / 2, y, zc - w * 0.5 + th, -th / 2, y, zc - w * 0.5 + th, 0, y, zc - w * 0.5); return b; };
  const rings = []; for (let i = 0; i <= n; i++) { const t = i / n, y = t * (len - tipLen), zc = -bow * t * t; rings.push(ring(y, w0 + (w1 - w0) * t, zc)); }
  for (let i = 0; i < n; i++) { const a = rings[i], b = rings[i + 1]; for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; idx.push(a + k, b + k, b + k2, a + k, b + k2, a + k2); } }
  const tip = pos.length / 3, zt = -bow * 1.05; pos.push(0, len, zt - w1 * 0.25); const L = rings[n]; for (let k = 0; k < 4; k++) idx.push(L + k, tip, L + (k + 1) % 4);
  idx.push(rings[0], rings[0] + 2, rings[0] + 1, rings[0], rings[0] + 3, rings[0] + 2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, n = 8) => new THREE.CylinderGeometry(a, b, h, n), sph = (r, a = 8, b = 6) => new THREE.SphereGeometry(r, a, b);
const tor = (r, t, arc = Math.PI * 2, rs = 6, ts = 12) => new THREE.TorusGeometry(r, t, rs, ts, arc);
// grip: wrapped handle (with ridges), pommel at -Y
function grip(col, wrap, len = 0.2, pom = null) { const p = [[cyl(0.028, 0.03, len, 8), col, T(0, -len / 2 + 0.02, 0)]];
  for (let i = 0; i < 4; i++) p.push([cyl(0.032, 0.032, 0.014, 8), wrap, T(0, -0.02 - i * len / 4.6, 0)]);
  p.push([pom || sph(0.042), wrap, T(0, -len + 0.01, 0)]); return p; }
const SPECS = {
  rusty: () => merge([[curvedBlade(0.82, 0.075, 0.06, 0.016, 0.07), 0x8a6a52, T(0, 0.06, 0)],          // pitted brown-grey steel
    [box(0.05, 0.12, 0.012), 0x6b4a36, T(0.009, 0.3, 0.012)], [box(0.05, 0.08, 0.012), 0x5d4030, T(-0.009, 0.55, 0.0)],   // rust patches
    [box(0.22, 0.035, 0.05), 0x5a4a3c, T(0, 0.05, 0)], ...grip(0x4a3426, 0x2f241c)]),
  cutlass: () => merge([[curvedBlade(0.86, 0.09, 0.072, 0.018, 0.1), 0xd9dee6, T(0, 0.06, 0)],
    [curvedBlade(0.8, 0.016, 0.012, 0.02, 0.1), 0x9aa3ad, T(0, 0.07, -0.032)],                          // fuller
    [tor(0.1, 0.014, Math.PI), 0xd9a441, T(0, -0.05, 0.035, 0, Math.PI / 2, Math.PI / 2)],              // brass knuckle bow
    [box(0.07, 0.03, 0.16), 0xd9a441, T(0, 0.05, 0.02)], ...grip(0x3d2a1c, 0xd9a441)]),
  rapier: () => merge([[cyl(0.012, 0.006, 1.02, 6), 0xeef2f6, T(0, 0.58, 0)], [cyl(0.004, 0.0005, 0.06, 6), 0xeef2f6, T(0, 1.12, 0)],
    [tor(0.075, 0.009), 0xc9d1da, T(0, 0.07, 0, Math.PI / 2)], [tor(0.06, 0.008), 0xc9d1da, T(0, 0.02, 0, 0, 0, Math.PI / 2)],   // swept rings
    [box(0.26, 0.022, 0.022), 0xc9d1da, T(0, 0.06, 0)], [sph(0.02), 0xc9d1da, T(0.13, 0.06, 0)], [sph(0.02), 0xc9d1da, T(-0.13, 0.06, 0)],
    [sph(0.07, 10, 8), 0xc9d1da, T(0, 0.08, 0, 0, 0, 0, [1, 0.45, 1])], ...grip(0x1c1c22, 0xc9d1da, 0.18)]),
  bone: () => { const p = [[curvedBlade(0.84, 0.1, 0.08, 0.026, 0.05), 0xf1e8d0, T(0, 0.06, 0)]];
    for (let i = 0; i < 5; i++) p.push([new THREE.ConeGeometry(0.03, 0.07, 4), 0xe6dbbd, T(0, 0.18 + i * 0.13, -0.05 - i * 0.004, -1.9)]);   // jagged back teeth
    p.push([sph(0.055, 10, 8), 0xf1e8d0, T(0, 0.07, 0, 0, 0, 0, [2.0, 0.8, 1.2])], [box(0.04, 0.012, 0.03), 0x161616, T(0.05, 0.08, 0.06)], [box(0.04, 0.012, 0.03), 0x161616, T(-0.05, 0.08, 0.06)],
      ...grip(0x2b2520, 0xf1e8d0, 0.2, sph(0.055, 10, 8)), [sph(0.014), 0x161616, T(-0.02, -0.18, 0.045)], [sph(0.014), 0x161616, T(0.02, -0.18, 0.045)], [box(0.03, 0.008, 0.01), 0x161616, T(0, -0.205, 0.05)]);   // skull pommel face
    return merge(p); },
  sabre_gilded: () => merge([[curvedBlade(0.92, 0.075, 0.06, 0.016, 0.14), 0xf2f5f8, T(0, 0.06, 0)],
    [curvedBlade(0.6, 0.02, 0.016, 0.019, 0.09), 0xffc93c, T(0, 0.1, -0.025)],                          // gold etching
    [tor(0.11, 0.016, Math.PI), 0xffc93c, T(0, -0.05, 0.04, 0, Math.PI / 2, Math.PI / 2)], [box(0.08, 0.04, 0.2), 0xffc93c, T(0, 0.05, 0.02)],
    [sph(0.03), 0xd8322f, T(0, 0.05, 0.12)], ...grip(0x1b2f6b, 0xffc93c, 0.21, sph(0.05))]),
  blade_gold: () => merge([[curvedBlade(1.0, 0.13, 0.1, 0.03, 0.08), 0xffd24a, T(0, 0.07, 0)],
    [curvedBlade(0.92, 0.03, 0.022, 0.032, 0.08), 0xfff1b0, T(0, 0.08, 0.035)],                          // bright edge
    [box(0.36, 0.06, 0.08), 0xc98f1c, T(0, 0.06, 0)], [sph(0.05, 10, 8), 0xffc93c, T(0.18, 0.06, 0)], [sph(0.05, 10, 8), 0xffc93c, T(-0.18, 0.06, 0)],
    [new THREE.OctahedronGeometry(0.05), 0x38e1ff, T(0, 0.07, 0.045)], ...grip(0x161616, 0xffc93c, 0.22, new THREE.OctahedronGeometry(0.06))]),
};
const CACHE = new Map();
export function swordGeo(id) { const k = SPECS[id] ? id : SWORD_DEFAULT; if (!CACHE.has(k)) CACHE.set(k, SPECS[k]()); return CACHE.get(k); }
export const swordGlow = (id) => id === 'blade_gold' ? 0xffc93c : id === 'sabre_gilded' ? 0xfff1b0 : null;   // the trail colour of a swing
// the range MUSKETS (cosmetic skins, BANKSY Nov 3): MUSKET_IDS is APPEND-ONLY (its index rides in 'ba'). Frame: butt at the origin,
// barrel +Z, muzzle at MUSKET_SPEC[id].len. b = barrel length, bell = a flared blunderbuss mouth (radius), the rest are colours.
export const MUSKET_IDS = ['rusty', 'navy', 'blunder', 'dragoon', 'bone', 'blunder_gold'];
export const MUSKET_DEFAULT = 'rusty';
const MUSKET_SPEC = {
  rusty:        { b: 1.08, bell: 0,     stock: 0x5d4030, fore: 0x6b4a36, barrel: 0x6e5a4a, band: 0x5a4a3c, plate: 0x6b5a4a, lock: 0x7a6a5a },
  navy:         { b: 1.12, bell: 0,     stock: 0x3d2a1c, fore: 0x4a3426, barrel: 0x2b2f36, band: 0xd9a441, plate: 0xd9a441, lock: 0xc9d1da, sling: 0x1b2f6b },
  blunder:      { b: 0.82, bell: 0.075, stock: 0x6b4527, fore: 0x8a5a2b, barrel: 0x3a3f46, band: 0x9aa3ad, plate: 0x9aa3ad, lock: 0x9aa3ad },
  dragoon:      { b: 1.0,  bell: 0,     stock: 0x8a5a2b, fore: 0x9a6a3a, barrel: 0xd9a441, band: 0xc9d1da, plate: 0xd9a441, lock: 0xd9a441, sling: 0x8a1c1c },
  bone:         { b: 1.06, bell: 0,     stock: 0xf1e8d0, fore: 0xe6dbbd, barrel: 0x9aa3ad, band: 0x161616, plate: 0x161616, lock: 0x161616, skull: true },
  blunder_gold: { b: 0.86, bell: 0.085, stock: 0x161616, fore: 0x2b2520, barrel: 0xffd24a, band: 0xfff1b0, plate: 0xffc93c, lock: 0xffc93c, gem: 0x38e1ff },
};
export const muskets = MUSKET_SPEC;
export function musketGeo(id = MUSKET_DEFAULT) {
  const k = MUSKET_SPEC[id] ? id : MUSKET_DEFAULT, key = 'musket:' + k; if (CACHE.has(key)) return CACHE.get(key);
  const S = MUSKET_SPEC[k], bz = 0.3 + S.b / 2, end = 0.3 + S.b;
  const p = [[box(0.07, 0.13, 0.34), S.stock, T(0, -0.02, 0.16, -0.12)], [box(0.075, 0.14, 0.02), S.plate, T(0, -0.04, -0.01, -0.12)],   // butt + plate
    [box(0.06, 0.07, Math.min(0.62, S.b * 0.6)), S.fore, T(0, 0.02, 0.32 + Math.min(0.62, S.b * 0.6) / 2)], [cyl(0.018, 0.022, S.b, 8), S.barrel, T(0, 0.06, bz, Math.PI / 2)],   // fore-stock + barrel
    ...[0.5, 0.75, 1.0].filter(t => t * S.b < S.b - 0.1).map(t => [cyl(0.033, 0.033, 0.03, 8), S.band, T(0, 0.045, 0.3 + t * S.b, Math.PI / 2)]),   // bands
    [box(0.04, 0.05, 0.08), S.lock, T(0.04, 0.05, 0.36)], [box(0.012, 0.05, 0.012), S.lock, T(0.05, 0.1, 0.33, 0.4)],                 // lock + cock
    [tor(0.03, 0.006, Math.PI), S.band, T(0, -0.03, 0.38, 0, Math.PI / 2, 0)], [cyl(0.008, 0.008, S.b * 0.82, 5), 0x3d2a1c, T(0, 0.0, 0.3 + S.b * 0.45, Math.PI / 2)]];   // trigger guard + ramrod
  if (S.bell) p.push([cyl(S.bell, 0.022, 0.2, 10), S.barrel, T(0, 0.06, end - 0.06, Math.PI / 2)], [tor(S.bell, 0.008, Math.PI * 2, 4, 12), S.band, T(0, 0.06, end + 0.04)]);   // flared mouth
  if (S.sling) p.push([box(0.012, 0.03, 0.62), S.sling, T(-0.04, -0.06, 0.42, 0.18)]);
  if (S.skull) p.push([sph(0.05, 10, 8), 0xf1e8d0, T(0.045, 0.0, 0.14, 0, 0, 0, [0.6, 1, 1.1])], [sph(0.012), 0x161616, T(0.075, 0.015, 0.12)], [sph(0.012), 0x161616, T(0.075, 0.015, 0.16)]);
  if (S.gem) p.push([new THREE.OctahedronGeometry(0.03), S.gem, T(0.045, 0.0, 0.16)]);
  const g = merge(p); CACHE.set(key, g); return g;
}
export const musketMuzzle = (id) => { const e = weaponEmpty('musket', MUSKET_SPEC[id] ? id : MUSKET_DEFAULT, 'muzzle'); if (e) return e.clone(); const S = MUSKET_SPEC[id] || MUSKET_SPEC[MUSKET_DEFAULT]; return new THREE.Vector3(0, 0.06, 0.3 + S.b + (S.bell ? 0.04 : 0)); };
export const MUSKET = { len: 1.38, muzzle: new THREE.Vector3(0, 0.06, 1.38) }; // the rusty flintlock (musketMuzzle(id) per skin)
// [Raul] v5 WEAPON MODELS (Blender, /workspace/brand/v5_models/raul_weapons/tools/weapons.py): one vertex-coloured mesh per weapon in the
// same frames as above, hi + lo (the game's LOW flag), assets/pirates/items/v5/weapon_<sword|musket>_<id>_<hi|lo>.glb, with empties
// grip / tip (swords) and muzzle / grip_r / grip_l (muskets). Loaded once; a geometry already handed out by swordGeo / musketGeo is
// swapped IN PLACE (same BufferGeometry object), so blades on racks + in hands upgrade without re-dressing. Missing file = placeholder.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const EMPTIES = new Map(); let _weapons = null;
const weaponURL = (slot, id, lod) => new URL(`../../assets/pirates/items/v5/weapon_${slot}_${id}_${lod}.glb`, import.meta.url).href;
function adopt(dst, src) { dst.dispose(); for (const k of Object.keys(dst.attributes)) dst.deleteAttribute(k); for (const k of Object.keys(src.attributes)) dst.setAttribute(k, src.attributes[k]);
  dst.setIndex(src.index); dst.clearGroups(); dst.computeBoundingBox(); dst.computeBoundingSphere(); }
export function loadWeaponModels(low = false) {
  if (_weapons) return _weapons; const L = new GLTFLoader(), lod = low ? 'lo' : 'hi';
  const one = (slot, id) => L.loadAsync(weaponURL(slot, id, lod)).then((g) => {
    g.scene.updateMatrixWorld(true); const gs = [], E = {};
    g.scene.traverse((o) => { if (o.isMesh) { const q = o.geometry.clone().applyMatrix4(o.matrixWorld); for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') q.deleteAttribute(k); gs.push(q); }
      else if (o !== g.scene) E[o.name.replace(/\.\d+$/, '')] = o.getWorldPosition(new THREE.Vector3()); });
    const geo = gs.length === 1 ? gs[0] : mergeGeometries(gs, false); if (!geo?.attributes.color) return;
    const key = slot === 'sword' ? id : 'musket:' + id; EMPTIES.set(key, E);
    if (CACHE.has(key)) adopt(CACHE.get(key), geo); else CACHE.set(key, geo); })
    .catch((e) => console.warn('[weapons] model', slot, id, e?.message || e));
  _weapons = Promise.all([...SWORD_IDS.map((id) => one('sword', id)), ...MUSKET_IDS.map((id) => one('musket', id))]); return _weapons;
}
export const weaponEmpty = (slot, id, name) => EMPTIES.get(slot === 'sword' ? id : 'musket:' + id)?.[name] || null;   // grip_r / grip_l / tip / muzzle (file metres)

// [v332] BANKSY t1748–t1750u: bespoke LEGENDARY ornamentation (gold filigree + crimson rubies) on top of rank tint
let _legM = null;
const legM = () => { if (_legM) return _legM; _legM = {
  gold: toon(0xffd24a, null, { key: 'leg-gold', emissive: 0x7a4b00, emissiveIntensity: 0.55 }),
  gold2: toon(0xffe08a, null, { key: 'leg-gold2', emissive: 0x6b3a00, emissiveIntensity: 0.4 }),
  ruby: toon(0xc4161c, null, { key: 'leg-ruby', emissive: 0x5a0008, emissiveIntensity: 0.7 }),
  enamel: toon(0x8a1020, null, { key: 'leg-enamel' }),
}; return _legM; };
function _add(g, geo, mat, x, y, z, rx=0, ry=0, rz=0) { const o = new THREE.Mesh(geo, mat); o.position.set(x,y,z); o.rotation.set(rx,ry,rz); o.userData.legendary = true; g.add(o); return o; }

/** Ornate royal-gold filigree + ruby gems for a legendary sword mesh (blade +Y). */
export function legendarySwordMesh(mesh) {
  if (!mesh || mesh.userData._legOrn) return mesh; mesh.userData._legOrn = true;
  const M = legM(), g = new THREE.Group(); g.name = 'legendarySwordOrn';
  // filigree guard/collar bands
  _add(g, new THREE.TorusGeometry(0.055, 0.008, 6, 14), M.gold, 0, 0.05, 0, Math.PI / 2);
  _add(g, new THREE.TorusGeometry(0.04, 0.006, 5, 12), M.gold2, 0, 0.02, 0, Math.PI / 2);
  // crossguard cabochons + ruby pommel
  _add(g, new THREE.OctahedronGeometry(0.028), M.ruby, 0.12, 0.05, 0);
  _add(g, new THREE.OctahedronGeometry(0.028), M.ruby, -0.12, 0.05, 0);
  _add(g, new THREE.OctahedronGeometry(0.035), M.ruby, 0, -0.2, 0);
  // golden fuller / spine inlay along the blade
  _add(g, new THREE.BoxGeometry(0.01, 0.55, 0.008), M.gold2, 0, 0.4, 0.01);
  // crimson enamel collar
  _add(g, new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10), M.enamel, 0, 0.07, 0);
  mesh.add(g); return mesh;
}

/** Royal-gold barrel bands, ruby lock jewel, gilded trigger guard for a legendary musket (barrel +Z). */
export function legendaryMusketMesh(mesh, id = MUSKET_DEFAULT) {
  if (!mesh || mesh.userData._legOrn) return mesh; mesh.userData._legOrn = true;
  const M = legM(), mz = musketMuzzle(id), L = Math.max(0.6, mz.z || 1.38), y = mz.y || 0.06;
  const g = new THREE.Group(); g.name = 'legendaryMusketOrn';
  // royal-gold barrel bands
  for (const t of [0.35, 0.55, 0.78]) _add(g, new THREE.TorusGeometry(0.036, 0.007, 5, 12), M.gold, 0, y, L * t, Math.PI / 2);
  // filigree breech crest + ruby lock/sight jewel
  _add(g, new THREE.BoxGeometry(0.05, 0.04, 0.08), M.gold2, 0, y + 0.04, 0.34);
  _add(g, new THREE.OctahedronGeometry(0.022), M.ruby, 0.0, y + 0.07, 0.36);
  // gilded trigger guard + butt trim
  _add(g, new THREE.TorusGeometry(0.035, 0.007, 5, 10, Math.PI), M.gold, 0, y - 0.05, 0.38, 0, Math.PI / 2, 0);
  _add(g, new THREE.BoxGeometry(0.08, 0.14, 0.02), M.gold, 0, -0.02, -0.01, -0.12);
  _add(g, new THREE.BoxGeometry(0.01, 0.01, L * 0.5), M.gold2, 0.0, y + 0.025, L * 0.45); // spine gleam
  mesh.add(g); return mesh;
}

export function applyLegendaryOrnament(mesh, slot, id, rarity) {
  if (rarity !== 'legendary' || !mesh) return mesh;
  return slot === 'sword' ? legendarySwordMesh(mesh) : legendaryMusketMesh(mesh, id);
}
