// V7 male shop displays share the REAL body + garment fit pipeline with players and preview cards.
// The old merged wooden male forms are removed from plaza_shops*.glb; stands and female forms stay.
// [clothes-aaa] BANKSY t232u "Make maniquins v7 pirates with no skin or hair color": the clothes shop's V7 bodies are BLANK forms. The
// V7 asset itself is untouched (no fork): each sex gets ONE cloned body geometry (shared by every mannequin of that sex) with the real
// V7 head and its sculpted hair / beard flattened into the skull ([v7-forms] blankBodyGeometry), plus ONE shared matte plaster material
// (no texture, no skin tone). The garments keep their colours.
// Everything here is freed when the display LOD leaves the scene ('removed').
import * as THREE from 'three';
export const MALE_SHOP_DISPLAYS = {
  ship_store: [
    { x: -5.5, z: -4.5, y: 0, scale: 2, yaw: 0, gear: { outfit: 'shirt', hat: 'none' } },   // [ship-aaa] behind the hall's counters (lz -39.6)
    { x: 6, z: -4.5, y: 0, scale: 2, yaw: 0, gear: { outfit: 'suit', hat: 'none' } },
  ],
  // [clothes-aaa] the walk-in clothes shop (building frame: x across, z = toward the street, front wall z = +6, back wall z = -12);
  // [outfit-store] the building is Clothes + Accessories now (centre lx -44): the CLOTHING area is the left half (x -9.5 .. -0.5),
  // two window forms either side of its arch (x -5), the round dais in the middle of its hall. The Accessories half has plaster busts (GLB).
  shop_clothes: [
    { x: -8.05, z: 4.35, y: .2, yaw: .35, gear: { outfit: 'shirt', hat: 'none' } },
    { x: -1.95, z: 4.35, y: .2, yaw: -.35, female: true, gear: { outfit: 'shirt', hat: 'none' } },   // [v361] V7 female display (BANKSY t1919u)
    { x: -5.62, z: -1.0, y: .2, yaw: .45, gear: { outfit: 'suit', hat: 'none' } },
    { x: -4.38, z: -1.0, y: .2, yaw: -.45, gear: { outfit: 'tshirt', hat: 'none' } },
  ],
  // The former crew building has a static, built-in accessories counter (no hiring / crew mannequin).
};
export const BLANK_FORMS = new Set(['shop_clothes']);
// [v7-forms] the bald skull the hair is flattened onto (bind pose, metres, three frame, face = +z): a skull ellipsoid + a jaw ellipsoid
// (their union), fitted to the V7 lo face skin; neck = below this only hanging hair moves
export const SKULL = { m: { skull: [[0, 1.08, -0.03], [0.205, 0.27, 0.215]], jaw: [[0, 1.02, 0.0], [0.18, 0.14, 0.17]], neck: 0.86 },
  f: { skull: [[0, 1.12, 0.0], [0.2, 0.27, 0.22]], jaw: [[0, 1.02, 0.01], [0.185, 0.2, 0.2]], neck: 0.9 } };
export const SHRINK = 0.012;   // metres (bind pose) the bare body sits inside the garments it wears
let _mat = null, _matUsers = 0; const _geo = {}, _lookClones = new Map();   // source garment material -> its lit clone (clothes shop)
export function mannequinMaterial() {   // [v7-forms] one matte plaster for every form: no texture, no skin tone, no hair or eye colour
  if (!_mat) { _mat = new THREE.MeshLambertMaterial({ color: 0xece4d6, name: 'mannequin_plaster', side: THREE.DoubleSide }); _mat.userData.mannequin = true;
    // the flattened hair can fold a few triangles over on the skull (outer + inner hair shell land on the same surface): drawn both sides
    // with the skull's own normal they shade exactly like their neighbours, so the bald head reads as one smooth plaster cap (no see-through)
    _mat.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize( vNormal ); nonPerturbedNormal = normal;'); };
    _mat.customProgramCacheKey = () => 'mannequin_plaster_2s'; }
  return _mat;
}
async function maskPixels(url) {
  try { const im = new Image(); im.src = new URL('../../' + url, import.meta.url).href; await im.decode();
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 256, 256);
    return { w: 256, h: 256, d: g.getImageData(0, 0, 256, 256).data }; } catch { return null; }
}
// one blank body geometry per sex (the source geometry is never modified)
// [v7-forms] BANKSY 6:25 / 6:55 PM "make it v7 maniquins with no skin or hair color" / "do the v7 pirate mannequins in clothing shop": the
// REAL V7 head stays (face, nose, brows, ears, the chibi proportions); only the sculpted hair / beard is flattened into a smooth skull.
// Every hair vertex (the V7 tint mask's hair channel; for her noisy mask also anything outside the skull off the face) is pulled in
// along its ray from the head centre onto the skull ellipsoid, and only when it lies outside it, so the face (inside) is untouched and
// no triangle is removed (no holes). His beard and her side locks / nape land on the jaw's underside; her braid is pressed flat into
// the back (under the shirt). The rest of the bare body sits SHRINK inside its normals so the fitted garments never clip through.
export function blankBodyGeometry(src, fem, mask) {
  const K = SKULL[fem ? 'f' : 'm'], g = src.clone(), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, H = new Float32Array(P.count);
  const hairAt = (i) => { if (!mask || !U) return 0; const u = U.getX(i), v = U.getY(i); const px = Math.min(mask.w - 1, Math.max(0, Math.floor(u * mask.w))), py = Math.min(mask.h - 1, Math.max(0, Math.floor(v * mask.h))); return mask.d[(py * mask.w + px) * 4 + 1] / 255; };
  const proj = (x, y, z, e) => { const [c, r] = e, dx = (x - c[0]) / r[0], dy = (y - c[1]) / r[1], dz = (z - c[2]) / r[2], l = Math.hypot(dx, dy, dz) || 1; return { l, p: [c[0] + dx / l * r[0], c[1] + dy / l * r[1], c[2] + dz / l * r[2]], n: [dx / l / r[0], dy / l / r[1], dz / l / r[2]] }; };
  const inside = (p, e) => { const [c, r] = e; return ((p[0] - c[0]) / r[0]) ** 2 + ((p[1] - c[1]) / r[1]) ** 2 + ((p[2] - c[2]) / r[2]) ** 2 < 0.999; };
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), h = hairAt(i), ax = Math.abs(x);
    const A = proj(x, y, z, K.skull), B = proj(x, y, z, K.jaw), out = A.l > 1 && B.l > 1;
    let face = z > 0.04 && y < (fem ? 1.16 : 1.2) && ax < 0.17 && !(!fem && h > 0.5 && y > 1.11);   // brows, eyes, nose, mouth
    if (fem ? y < 0.98 && ax > 0.1 : y < 0.99 && A.l > 1.04 && B.l > 1.04) face = false;   // her locks past the chin / his beard spikes off the chin
    const ear = !fem && h < 0.25 && ax > 0.185 && y > 0.93 && y < 1.15 && Math.abs(z + 0.02) < 0.1;
    if (fem && y > 0.28 && y <= K.neck && ax < 0.3 && z < -0.105) { P.setZ(i, -0.075); H[i] = 1; continue; }   // her braid: pressed flat into the back
    let hair;
    if (y > K.neck) hair = Math.hypot(x, z) < 0.45 && !ear && (h > (fem ? 0.45 : 0.25) || (out && !face) || (fem && y < 1.06 && ax > 0.14) || (fem && y > 0.84 && z < -0.065));
    else hair = fem ? (y > 0.855 && ax > 0.11 && z > -0.105) || (y > 0.84 && z < -0.065)   // her side locks / nape (the neck is |x| < .1)
      : y > 0.6 && ax < 0.25 && ((z > 0.1 && (h > 0.3 || z > 0.125)) || (z > -0.02 && h > 0.3 && (ax < 0.15 || y > 0.76)));   // his beard over the chest
    if (!hair) {   // [v7-forms] clothing clipping: the bare form sits a little inside the fitted garments (feet / head / hands' tips untouched)
      if (N && y > 0.22 && y < K.neck) { const k = SHRINK * Math.min(1, (K.neck - y) / 0.05, (y - 0.22) / 0.04); P.setXYZ(i, x - N.getX(i) * k, y - N.getY(i) * k, z - N.getZ(i) * k); }
      continue; }
    if (!out && y > K.neck && face) continue;
    const c = [[A, K.jaw], [B, K.skull]].filter(([q, o]) => !inside(q.p, o)).map(([q]) => q), d = (q) => (q.p[0] - x) ** 2 + (q.p[1] - y) ** 2 + (q.p[2] - z) ** 2;
    const q = c.length ? c.reduce((a, b) => d(a) <= d(b) ? a : b) : A;
    P.setXYZ(i, ...q.p); H[i] = 1;
    if (N) { const nl = Math.hypot(...q.n) || 1; N.setXYZ(i, q.n[0] / nl, q.n[1] / nl, q.n[2] / nl); }
  }
  P.needsUpdate = true; if (N) N.needsUpdate = true; g.deleteAttribute('_tint'); g.setAttribute('blankHair', new THREE.BufferAttribute(H, 1)); g.computeBoundingSphere(); g.userData.mannequin = true;
  return g;
}
async function blankBody(p, fem) {
  const body = p.root.getObjectByName('pirate_lo_body'); if (!body) return;
  const k = fem ? 'f' : 'm';
  if (!_geo[k]) _geo[k] = (async () => { let cfg = null; try { cfg = JSON.parse(body.userData.v7tint || 'null'); } catch {}
    const mask = await maskPixels(cfg?.mask || 'assets/pirates/v7_male_tint_lo.webp'); return blankBodyGeometry(body.geometry, fem, mask); })();
  const g = await _geo[k]; body.geometry = g; body.material = mannequinMaterial(); body.userData.blank = true;
  p.root.traverse(o => { if (o.isMesh && /face|eyes|tattoo/i.test(o.name)) o.visible = false; });
}
export function disposeBlankForms() { for (const k of Object.keys(_geo)) { Promise.resolve(_geo[k]).then(g => g?.dispose?.()); delete _geo[k]; } _mat?.dispose(); _mat = null;
  for (const m of _lookClones.values()) m.dispose(); _lookClones.clear(); }
// the garments on a blank form: one lit clone per source material (shared by every form wearing it; the player's own materials untouched)
function litClone(src, look) {
  if (!src || src === _mat) return src; let c = _lookClones.get(src);
  if (!c) { c = src.clone(); c.onBeforeCompile = src.onBeforeCompile; if (src.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) c.customProgramCacheKey = src.customProgramCacheKey;
    c.userData = { ...src.userData }; delete c.userData.clothesLook; look(c); _lookClones.set(src, c); }
  return c;
}
export function addMaleShopDisplays(parent, id, low = false, look = null) {
  const list = MALE_SHOP_DISPLAYS[id]; if (!list) return;
  const lod = new THREE.LOD(); lod.name = 'v7_shop_displays_' + id;
  const group = new THREE.Group(); lod.addLevel(group, 0); lod.addLevel(new THREE.Group(), low ? 38 : 120); parent.add(lod);
  const blank = BLANK_FORMS.has(id); if (blank) { _matUsers++; if (look) look(mannequinMaterial()); }
  const ready = Promise.all([import('../pirateGLB.js'), import('../pirateGear.js')]).then(([{ PirateGLB }, { applyGear }]) => Promise.all(list.map(async (d, i) => {
    const p = await PirateGLB.create({ lod: 'lo', female: !!d.female });
    await applyGear(p, { ...d.gear, body: d.female ? 1 : 0, pants: 'classic_pants', boots: 'boots_classic' });
    if (blank) { await blankBody(p, !!d.female);
      if (look) p.root.traverse(o => { if (o.isMesh && o.material && !o.userData.blank) o.material = Array.isArray(o.material) ? o.material.map(m => litClone(m, look)) : litClone(o.material, look); }); }
    p.mixer.setTime(.35); p.root.name = 'v7_mannequin_' + id + '_' + i;
    p.root.position.set(d.x, d.y ?? .718, d.z); p.root.rotation.y = d.yaw; p.root.scale.setScalar(d.scale ?? 1.3);   // [clothes-aaa] y .2 = the clothes shop's display plinths
    p.root.traverse(o => { if (o.isMesh) { o.castShadow = !low; o.frustumCulled = false; } });
    group.add(p.root); return p;
  })));
  parent.userData.mannequinsReady = ready;
  ready.catch(e => console.warn('[V7 mannequins] load failed', e));
  lod.addEventListener('removed', () => { ready.then(ps => { for (const p of ps) { try { p.dispose?.(); } catch {} } }).catch(() => {});
    if (blank && --_matUsers <= 0) { _matUsers = 0; disposeBlankForms(); } });
}
