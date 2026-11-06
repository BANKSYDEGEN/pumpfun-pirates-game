// [perf4] BANKSY 11:34 AM "Merge together": static meshes that share a material become one mesh (fewer draw calls + shadow draws).
// Kill switches: &kitmerge=0 (island kit pieces), &shipmerge=0 (ship body parts).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const qs = (() => { try { return location.search; } catch { return ''; } })();
export const KIT_MERGE = !/[?&]kitmerge=0/.test(qs), SHIP_MERGE = !/[?&]shipmerge=0/.test(qs);
export const SMALL_CASTERS_OFF = !/[?&]plazashadow=1/.test(qs); // [perf5] &plazashadow=1 = every static island prop casts again (the v239 behaviour)
const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4(), _c = new THREE.Vector3();
const sig = (g) => (g.index ? 'i' : 'n') + Object.keys(g.attributes).sort().map(k => { const a = g.attributes[k]; return k + a.itemSize + (a.normalized ? 'N' : '') + a.array.constructor.name; }).join(',');

// meshes: candidate list; host: the Object3D the merged meshes go under; keyOf(mesh) -> extra key part (or null = skip).
// [v330 perf] opts.ignoreGroups: a single-material mesh draws its whole geometry whatever geometry.groups says (Box / Cylinder geometries
// always carry groups), so those groups can be dropped and the mesh merged. Only callers that opt in (js/opt.js mergeStaticGroup).
export function mergeInto(host, meshes, keyOf = () => '', opts = {}) {
  const ig = !!opts.ignoreGroups;
  host.updateMatrixWorld(true); _inv.copy(host.matrixWorld).invert();
  const groups = new Map();
  for (const o of meshes) {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material) || o.morphTargetInfluences || !o.visible || o.userData.noMerge) continue;
    const g = o.geometry; if (!g?.attributes?.position || (g.groups?.length && !ig) || g.drawRange.count !== Infinity || g.userData?.tagRanges) continue;
    const extra = keyOf(o); if (extra === null) continue;
    const k = [o.material.uuid, sig(g), o.castShadow, o.receiveShadow, o.renderOrder, o.frustumCulled, o.layers.mask, extra].join('|');
    if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o);
  }
  let saved = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map(o => { const c = o.geometry.clone(); if (ig) c.clearGroups(); c.applyMatrix4(_m.multiplyMatrices(_inv, o.matrixWorld)); return c; });
    let geo = null; try { geo = mergeGeometries(geos, false); } catch (e) { geo = null; } geos.forEach(c => c.dispose());
    if (!geo) continue;
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    const a = list[0], m = new THREE.Mesh(geo, a.material);
    m.name = a.name; m.castShadow = a.castShadow; m.receiveShadow = a.receiveShadow; m.renderOrder = a.renderOrder; m.frustumCulled = a.frustumCulled; m.layers.mask = a.layers.mask;
    m.userData = { ...a.userData, merged: list.length }; delete m.userData.kitItems;
    if (a.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) m.onBeforeRender = a.onBeforeRender;
    for (const o of list) { o.removeFromParent(); }   // originals are left un-disposed (shared geometries may be used elsewhere)
    host.add(m); saved += list.length - 1;
  }
  return saved;
}

// island kit meshes (Kit.build: island_toon / island_outline / island_glow / island_atlas): per top-level scene child + 200 m cell
const KIT_RE = /^island_(toon|outline|glow|atlas)$/;
export function mergeIslandKits(scene) {
  pruneProxies(); if (!KIT_MERGE) return 0; scene.updateMatrixWorld(true); let saved = 0;
  for (const top of scene.children) {
    const L = []; let ok = true;
    top.traverse(o => { if (o.isLOD || o.userData?.isShip) ok = false; });
    top.traverse(o => { if (!o.isMesh || !KIT_RE.test(o.name)) return; for (let p = o.parent; p && p !== top; p = p.parent) { if (p.isLOD || !p.visible || p.userData?.isShip) return; } L.push(o); });
    void ok; if (!L.length) continue;
    const cell = (o) => { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); _c.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld); return Math.floor(_c.x / 200) + ',' + Math.floor(_c.z / 200); };
    // host = the nearest area_* group (the areas show / hide their near + far sets by distance), else the top-level world
    const hostOf = (o) => { for (let p = o.parent; p && p !== top; p = p.parent) if (/^area_/.test(p.name)) return p; return top; }, byHost = new Map();
    for (const o of L) { const h = hostOf(o); if (!byHost.has(h)) byHost.set(h, []); byHost.get(h).push(o); }
    for (const [h, list] of byHost) { if (list.length > 1) saved += mergeInto(h, list, cell);
      const byCell = new Map(); for (const o of h.children) if (o.isMesh && KIT_RE.test(o.name) && o.castShadow) { const k = cell(o); if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(o); }
      for (const cl of byCell.values()) saved += shadowProxy(h, cl); }
  }
  return saved;
}

// [perf5] BANKSY 6:25 PM "only fix the lagging": desktop shadow pass, on foot. Small STATIC island props (world radius < 2.5 m: crates,
// barrels, lamps, signs, rocks) stop casting (they still receive); buildings, walls, the plaza, trees (instanced = one big sphere) and every
// pirate / ship / pet keep their shadows. Phones never had a shadow map. Only under the on-foot world roots below.
const STATIC_ROOT = /^(foot|hill_street|battle_areas)$/, _sp = new THREE.Sphere();
export function trimSmallCasters(scene) {
  if (!SMALL_CASTERS_OFF) return 0; let n = 0;
  scene.traverse(o => { if (!o.isMesh || !o.castShadow || o.isSkinnedMesh || o.isInstancedMesh || o.userData.shadowProxy || o.userData.keepShadow) return;
    let ok = false; for (let p = o.parent; p; p = p.parent) { if (p.userData?.isShip || /pirate|pet|crew|follower/i.test(p.name || '')) return; if (STATIC_ROOT.test(p.name || '')) ok = true; }
    if (!ok) return; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); _sp.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
    if (_sp.radius < 2.5) { o.castShadow = false; n++; } });
  return n;
}

// ship body: the direct mesh children of the body group with the same material (hull-dress / hull-legacy groups merge inside themselves,
// so skins that hide them still can). Sails, flags, crew and anything tagged (upgrade pieces) stay separate.
const SHIP_SKIP = /sail|flag|crew|pirate|cannon|gun|rig|rope|lantern|wake|dmg|damage|fire|smoke/i;
export function mergeShipBody(body) {
  if (!SHIP_MERGE || !body) return 0; let saved = 0;
  const groups = [body, ...body.children.filter(c => !c.isMesh && /^hull-(dress|legacy)$/.test(c.name))];
  for (const h of groups) { const ok = (c) => c.isMesh && !SHIP_SKIP.test(c.name) && !SHIP_SKIP.test(c.material?.name || '');
    saved += mergeInto(h, h.children.filter(ok)); saved += shadowProxy(h, h.children.filter(ok)); for (const c of h.children) if (c.userData.shadowProxy) c.userData.shipProxy = true; }
  return saved;
}

// [perf4] ship SHADOW PROXY: the ship's parts keep their own materials (tiled wood / normal maps / skins), but for the shadow map one
// merged position-only mesh per group casts instead of every part. The proxy is visible only inside renderer.shadowMap.render
// (installShadowProxies), so the main pass never draws it. &shipmerge=0 = off.
const PROXIES = new Set(), _pm = new THREE.MeshBasicMaterial({ colorWrite: false }); _pm.name = 'shadow-proxy';
export function shadowProxy(host, meshes) {
  host.updateMatrixWorld(true); _inv.copy(host.matrixWorld).invert(); const geos = [], used = [];
  for (const o of meshes) { const m = o.material; if (!o.isMesh || !o.castShadow || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(m) || m.transparent || m.alphaTest > 0 || m.alphaMap || o.userData.noMerge || o.geometry.userData?.tagRanges) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', o.geometry.attributes.position.clone()); if (o.geometry.index) g.setIndex(o.geometry.index.clone());
    const ng = g.index ? g.toNonIndexed() : g; if (ng !== g) g.dispose(); ng.applyMatrix4(_m.multiplyMatrices(_inv, o.matrixWorld)); geos.push(ng); used.push(o); }
  if (used.length < 2) { geos.forEach(g => g.dispose()); return 0; }
  let geo = null; try { geo = mergeGeometries(geos, false); } catch (e) { geo = null; } geos.forEach(g => g.dispose()); if (!geo) return 0;
  geo.computeBoundingSphere(); const p = new THREE.Mesh(geo, _pm); p.name = 'shadow_proxy'; p.castShadow = true; p.receiveShadow = false; p.visible = false; p.userData.shadowProxy = true;
  for (const o of used) o.castShadow = false; host.add(p); PROXIES.add(p); p.addEventListener('removed', () => PROXIES.delete(p));
  return used.length - 1;
}
export function installShadowProxies(renderer) {
  const sm = renderer?.shadowMap; if (!sm || sm.__proxied) return; sm.__proxied = true; const r0 = sm.render.bind(sm);
  sm.render = function (...a) { for (const p of PROXIES) p.visible = true; try { return r0(...a); } finally { for (const p of PROXIES) p.visible = false; } };
}
// [shop-exit-crash] a disposed ship's proxy left in PROXIES kept the whole ship (every part's geometry arrays) alive forever: every
// upgrade buy / pre-build / skin preview builds several ships, so phones ran out of memory in the UPGRADE SHOP and the tab reloaded.
// disposeShip calls this; detached SHIP proxies are also dropped on the next kit merge pass (a ship nobody disposed).
export function releaseShadowProxies(root) { root?.traverse?.(o => { if (o.userData?.shadowProxy) PROXIES.delete(o); }); }
function pruneProxies() { for (const p of PROXIES) { if (!p.userData.shipProxy) continue; let o = p; while (o.parent) o = o.parent; if (!o.isScene) PROXIES.delete(p); } } // ship proxies only (island kit areas may detach + re-attach)

// [perf4] SHIP ATLAS: plain toon part materials (kit() marks them userData.atlasOK: mast, iron, dark + their AO twins) share one
// canvas atlas + one material per class (vertex-coloured or not), so Parts.build merges them into one mesh. Each vertex carries
// its tile (aAtl = x0, y0, w, h in atlas UV; w < 0 = clamp, else the tile repeats). &shipmerge=0 = off.
const _atlases = new Map();
const mapOk = (t) => !t || (t.image?.width && t.repeat.x === 1 && t.repeat.y === 1 && t.offset.x === 0 && t.offset.y === 0 && t.rotation === 0 && t.flipY !== false);
export function atlasCandidate(m) { return SHIP_MERGE && m?.isMeshToonMaterial && m.userData?.atlasOK && m.side === THREE.FrontSide && !m.transparent && !m.normalMap && !(m.emissive && m.emissive.getHex()) && mapOk(m.map); }
export function shipAtlas(members, vertexColors, gradientMap) {
  const key = members.map(m => m.uuid).join(',') + vertexColors; if (_atlases.has(key)) return _atlases.get(key);
  const C = 256, P = 8, cols = Math.ceil(Math.sqrt(members.length)), rows = Math.ceil(members.length / cols), W = cols * C, H = rows * C;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'); const rect = new Map();
  members.forEach((m, i) => { const cx = (i % cols) * C, cy = Math.floor(i / cols) * C, col = '#' + m.color.getHexString();
    if (m.map) { // padded: the tile edge pixels are smeared into the padding so mip levels don't bleed
      x.drawImage(m.map.image, cx, cy, C, C); x.drawImage(m.map.image, cx + P, cy + P, C - 2 * P, C - 2 * P);
      if (col !== '#ffffff') { x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(cx, cy, C, C); x.globalCompositeOperation = 'source-over'; } }
    else { x.fillStyle = col; x.fillRect(cx, cy, C, C); }
    const rep = !m.map || m.map.wrapS === THREE.RepeatWrapping;
    rect.set(m, [(cx + P) / W, 1 - (cy + C - P) / H, ((C - 2 * P) / W) * (rep ? 1 : -1), (C - 2 * P) / H]); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.name = 'ship_atlas';
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, map: t, gradientMap, vertexColors }); mat.name = 'ship-atlas' + (vertexColors ? '-vc' : '');
  mat.onBeforeCompile = (s) => {
    s.vertexShader = 'attribute vec4 aAtl;\nvarying vec4 vAtl;\n' + s.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vAtl = aAtl;');
    s.fragmentShader = 'varying vec4 vAtl;\n' + s.fragmentShader.replace('#include <map_fragment>', `{ vec2 sz = vec2(abs(vAtl.z), vAtl.w); vec2 f = vAtl.z < 0.0 ? clamp(vMapUv, 0.0, 1.0) : fract(vMapUv);
      vec4 sampledDiffuseColor = textureGrad(map, vAtl.xy + f * sz, dFdx(vMapUv) * sz, dFdy(vMapUv) * sz); diffuseColor *= sampledDiffuseColor; }`); };
  mat.customProgramCacheKey = () => 'ship-atlas';
  const out = { mat, rect }; _atlases.set(key, out); return out;
}
