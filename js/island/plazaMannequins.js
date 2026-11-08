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
// [v7-statue] BANKSY 7:52 PM "Those aren't v7 pirate mannequins": the forms are the UNMODIFIED V7 pirate (same sculpt, hair, beard,
// braid, face, eyes, proportions; the same High / Low asset the players use) painted ONE matte stone colour, like a statue of the V7
// pirate: no skin tone, no hair colour. The Meshy paint only survives as a narrow light / dark value (luminance) so the painted eyes,
// brows and hair strands still read in that one colour. Only the bare torso / arms / legs sit SHRINK inside their normals so the
// fitted garments never clip; the head, hair, beard and braid keep their exact V7 shape.
export const NECK = { m: 0.86, f: 0.9 };   // bind pose metres: nothing above this moves
export const SHRINK = 0.012;   // metres (bind pose) the bare body sits inside the garments it wears
export const STATUE_TONE = 0xbcae9a;   // pale warm stone: reads against the cream walls, warm under the shop's painted lamps
let _matUsers = 0; const _geo = {}, _mats = {}, _lookClones = new Map();   // source garment material -> its lit clone (clothes shop)
export function mannequinMaterial(src = null, key = 'm') {   // one matte stone per sex (it borrows that body's own albedo for value only)
  if (!_mats[key]) { const m = _mats[key] = new THREE.MeshLambertMaterial({ color: STATUE_TONE, map: src?.map || null, normalMap: src?.normalMap || null, side: THREE.DoubleSide, name: 'mannequin_stone' });
    m.userData.mannequin = true;
    m.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
      float lum7 = dot(texture2D(map, vMapUv).rgb, vec3(.2126, .7152, .0722));
      diffuseColor.rgb *= clamp(.6 + .9 * sqrt(lum7) - .25, .5, 1.);   // one colour: the paint only as a soft light / dark value
    #endif`); };
    m.customProgramCacheKey = () => 'mannequin_stone'; }
  return _mats[key];
}
async function maskPixels(url) {
  try { const im = await (await import('../pirateGLB.js')).v7MaskImage(url); if (!im) return null;   // [perf v466] the same image the V7 body shader loaded (was a 2nd fetch)
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 256, 256);
    return { w: 256, h: 256, d: g.getImageData(0, 0, 256, 256).data }; } catch { return null; }
}
// one shared body geometry per sex + LOD (the source geometry is never modified): the V7 geometry as-is, except the bare skin below
// the neck (not hair: the tint mask's hair channel, so his beard and her braid keep their shape) eased SHRINK inward
export function blankBodyGeometry(src, fem, mask) {
  const neck = NECK[fem ? 'f' : 'm'], g = src.clone(), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  const hairAt = (i) => { if (!mask || !U) return 0; const u = U.getX(i), v = U.getY(i); const px = Math.min(mask.w - 1, Math.max(0, Math.floor(u * mask.w))), py = Math.min(mask.h - 1, Math.max(0, Math.floor(v * mask.h))); return mask.d[(py * mask.w + px) * 4 + 1] / 255; };
  if (N) for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y <= 0.22 || y >= neck || hairAt(i) > 0.3) continue;
    const k = SHRINK * Math.min(1, (neck - y) / 0.05, (y - 0.22) / 0.04); P.setXYZ(i, P.getX(i) - N.getX(i) * k, y - N.getY(i) * k, P.getZ(i) - N.getZ(i) * k); }
  P.needsUpdate = true; g.computeBoundingSphere(); g.userData.mannequin = true;
  return g;
}
async function blankBody(p, fem, low) {
  let body = null; p.root.traverse(o => { if (o.isSkinnedMesh && o.geometry?.attributes?._tint && (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count)) body = o; });
  if (!body) return;
  const k = (fem ? 'f' : 'm') + (low ? 'lo' : 'hi');
  if (!_geo[k]) _geo[k] = (async () => { let cfg = null; try { cfg = JSON.parse(body.userData.v7tint || 'null'); } catch {}
    const mask = await maskPixels(cfg?.mask || ('assets/pirates/v7_' + (fem ? 'female' : 'male') + '_tint' + (low ? '_lo' : '') + '.webp')); return blankBodyGeometry(body.geometry, fem, mask); })();
  const g = await _geo[k]; const mat = mannequinMaterial(body.material, k); body.geometry = g; body.material = mat; body.userData.blank = true;
  return mat;
}
export function disposeBlankForms() { for (const k of Object.keys(_geo)) { Promise.resolve(_geo[k]).then(g => g?.dispose?.()); delete _geo[k]; }
  for (const k of Object.keys(_mats)) { _mats[k].dispose(); delete _mats[k]; }   // the borrowed albedo stays: it belongs to the shared V7 asset
  for (const m of _lookClones.values()) m.dispose(); _lookClones.clear(); }
// the garments on a blank form: one lit clone per source material (shared by every form wearing it; the player's own materials untouched)
function litClone(src, look) {
  if (!src || src.userData?.mannequin) return src; let c = _lookClones.get(src);
  if (!c) { c = src.clone(); c.onBeforeCompile = src.onBeforeCompile; if (src.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) c.customProgramCacheKey = src.customProgramCacheKey;
    c.userData = { ...src.userData }; delete c.userData.clothesLook; look(c); _lookClones.set(src, c); }
  return c;
}
// These display poses are frozen at .35 s: compute exact posed bounds once, not every frame.
export function cullStaticShopFigure(root) {
 root.updateWorldMatrix(true,false);root.updateMatrixWorld(true); // refresh SkinnedMesh attached bind inverses too
 root.traverse(o=>{if(!o.isMesh)return;if(o.isSkinnedMesh)o.computeBoundingSphere();else if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
  const b=o.isSkinnedMesh?o.boundingSphere:o.geometry.boundingSphere;o.frustumCulled=!!b&&Number.isFinite(b.radius)&&b.radius>0;if(o.isSkinnedMesh&&o.frustumCulled)b.radius+=.001;});
}
export function addMaleShopDisplays(parent, id, low = false, look = null) {
  const list = MALE_SHOP_DISPLAYS[id]; if (!list) return;
  const lod = new THREE.LOD(); lod.name = 'v7_shop_displays_' + id;
  // [perf v466] hidden past 38 m (phones) / 60 m (desktop, was 120), and only BUILT the first time the camera comes that close (their V7 bodies +
  // garment GLBs were ~2.6 MB and ~240k triangles on every harbor enter). Blank forms use the Low V7 on every platform (same unmodified asset).
  const group = new THREE.Group(); lod.addLevel(group, 0); lod.addLevel(new THREE.Group(), low ? 38 : 60); parent.add(lod);
  const blank = BLANK_FORMS.has(id); if (blank) _matUsers++;
  let ready = null; const start = () => (ready ||= build());
  const upd = lod.update.bind(lod); lod.update = (cam) => { upd(cam); if (!ready && lod.getCurrentLevel() === 0) start(); };
  Object.defineProperty(parent.userData, 'mannequinsReady', { get: start, configurable: true, enumerable: false });   // reading it (tools/v7/game_scenes.js) starts the build
  const build = () => { const r = Promise.all([import('../pirateGLB.js'), import('../pirateGear.js')]).then(([{ PirateGLB }, { applyGear }]) => Promise.all(list.map(async (d, i) => {
    const p = await PirateGLB.create({ lod: 'lo', female: !!d.female });   // [v7-statue] the players' own asset ([perf v466] Low everywhere)
    await applyGear(p, { ...d.gear, body: d.female ? 1 : 0, pants: 'classic_pants', boots: 'boots_classic' });
    if (blank) { const sm = await blankBody(p, !!d.female, true); if (sm && look && !sm.userData.clothesLook) look(sm);
      if (look) p.root.traverse(o => { if (o.isMesh && o.material && !o.userData.blank) o.material = Array.isArray(o.material) ? o.material.map(m => litClone(m, look)) : litClone(o.material, look); }); }
    p.mixer.setTime(.35); p.root.name = 'v7_mannequin_' + id + '_' + i;
    p.root.position.set(d.x, d.y ?? .718, d.z); p.root.rotation.y = d.yaw; p.root.scale.setScalar(d.scale ?? 1.3);   // [clothes-aaa] y .2 = the clothes shop's display plinths
    p.root.traverse(o => { if (o.isMesh) { o.castShadow = !low; o.frustumCulled = false; } });
    group.add(p.root); cullStaticShopFigure(p.root); return p;
  })));
  r.catch(e => console.warn('[V7 mannequins] load failed', e)); return r; };
  lod.addEventListener('removed', () => { if (!ready) { if (blank && --_matUsers <= 0) { _matUsers = 0; disposeBlankForms(); } return; } ready.then(ps => { for (const p of ps) { try { p.dispose?.(); } catch {} } }).catch(() => {});
    if (blank && --_matUsers <= 0) { _matUsers = 0; disposeBlankForms(); } });
}
