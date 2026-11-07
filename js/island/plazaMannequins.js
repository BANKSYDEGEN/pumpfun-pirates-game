// V7 male shop displays share the REAL body + garment fit pipeline with players and preview cards.
// The old merged wooden male forms are removed from plaza_shops*.glb; stands and female forms stay.
// [clothes-aaa] BANKSY t232u "Make maniquins v7 pirates with no skin or hair color": the clothes shop's V7 bodies are BLANK forms. The
// V7 asset itself is untouched (no fork): each sex gets ONE cloned body geometry (shared by every mannequin of that sex) whose head is
// pressed onto a smooth egg (hair, beard, ears, face gone) and whose hanging hair (beard / braid; the V7 tint mask's hair channel) is
// folded away inside the neck, plus ONE shared matte plaster material (no texture, no skin tone). The garments keep their colours.
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
// egg head (bind pose, metres): centre + radii; neck = below this the body is kept
const EGG = { m: { c: [0, 1.11, 0.0], r: [0.185, 0.255, 0.2], neck: 0.86 }, f: { c: [0, 1.13, 0.01], r: [0.17, 0.245, 0.19], neck: 0.9 } };
let _mat = null, _matUsers = 0; const _geo = {}, _lookClones = new Map();   // source garment material -> its lit clone (clothes shop)
export function mannequinMaterial() {
  if (!_mat) { _mat = new THREE.MeshLambertMaterial({ color: 0xece4d6, name: 'mannequin_plaster' }); _mat.userData.mannequin = true;
    _mat.onBeforeCompile = (sh) => {   // any triangle touching a cut (hair) vertex is dropped, so nothing stretches out of the body
      sh.vertexShader = 'attribute float blankCut; varying float vCut;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vCut = blankCut;');
      sh.fragmentShader = 'varying float vCut;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n if (vCut > 0.35) discard;'); };
    _mat.customProgramCacheKey = () => 'mannequin-blank'; }
  return _mat;
}
async function maskPixels(url) {
  try { const im = new Image(); im.src = new URL('../../' + url, import.meta.url).href; await im.decode();
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 256, 256);
    return { w: 256, h: 256, d: g.getImageData(0, 0, 256, 256).data }; } catch { return null; }
}
// one blank body geometry per sex (the source geometry is never modified)
export function blankBodyGeometry(src, fem, mask) {
  const E = EGG[fem ? 'f' : 'm'], g = src.clone(), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, H = new Float32Array(P.count);
  const [cx, cy, cz] = E.c, [rx, ry, rz] = E.r, hid = [cx, E.neck + 0.08, cz - 0.03];
  const hairAt = (i) => { if (!mask || !U) return 0; const u = U.getX(i), v = U.getY(i); const px = Math.min(mask.w - 1, Math.max(0, Math.floor(u * mask.w))), py = Math.min(mask.h - 1, Math.max(0, Math.floor(v * mask.h))); return mask.d[(py * mask.w + px) * 4 + 1] / 255; };
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
    const head = y > E.neck && ((dx / 1.6) ** 2 + (dy / 1.4) ** 2 + (dz / 1.8) ** 2 <= 1 || hairAt(i) > 0.2 || (fem && y > 0.87 && Math.abs(x) < 0.4));   // (+ her side locks)   // the head + its hair (never the shoulders)
    if (head) { const l = Math.hypot(dx, dy, dz) || 1, nx = dx / l, ny = dy / l, nz = dz / l; P.setXYZ(i, cx + nx * rx, cy + ny * ry, cz + nz * rz);
      if (N) { const ax = nx / rx, ay = ny / ry, az = nz / rz, al = Math.hypot(ax, ay, az) || 1; N.setXYZ(i, ax / al, ay / al, az / al); } continue; }
    const braid = fem && y > 0.45 && z < -0.09 && Math.abs(x) < 0.16;   // her braid down the back
    const strand = fem && y > 0.78 && hairAt(i) > 0.2;   // the strands on her shoulders
    const lock = fem && y > 0.79 && Math.abs(x) > 0.15;   // her locks over the shoulders
    if (braid || strand || lock || (hairAt(i) > 0.3 && y > 0.6) || (!fem && y > 0.62 && Math.abs(x) < 0.17 && z > 0.02 && hairAt(i) > 0.08)) { P.setXYZ(i, x * 0.1, y, hid[2] + (z - hid[2]) * 0.1); H[i] = 1; }   // hanging hair / beard: pulled inside the body + cut (blankCut)
  }
  P.needsUpdate = true; if (N) N.needsUpdate = true; g.deleteAttribute('_tint'); g.setAttribute('blankCut', new THREE.BufferAttribute(H, 1)); g.computeBoundingSphere(); g.userData.mannequin = true;
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
