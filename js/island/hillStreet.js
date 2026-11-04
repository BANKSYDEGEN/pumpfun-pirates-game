// [Timothy] PUMPFUN PIRATES hill street (Main Street, plaza -> town gate) as Blender-made models (BANKSY 7:35 PM "fix the buildings up the hill
// and make them match the plaza buildings and look good", his Port Royal reference, "multi story on both sides", "make them all shops").
// Source: tools/hill_blender/hill_street_blender.py -> assets/island/hill_street.glb (22 rentable shop buildings), hill_sword_shop.glb (L6),
// hill_musket_shop.glb (R6); *_low.glb = phones (LOD1 only). Same look as the plaza shops (plazaShops.js): vertex colour toon, solid + glow.
// foot.js buildStreet calls hillLot() once per lot (one guarded line, Raul's file): when the models are loaded the lot gets the Blender building,
// its own slide-friendly box colliders (walls with the doorway open, counter, the weapon-shop barrels) instead of the solid footprint box, and
// the colonial house is skipped; otherwise (load failed, ?hillglb=0, ?plaza=1) it returns false and the old house is built as before.
// Every ground floor is a walkable shop room (floor = the street's walk height); the door empties (door_rent_<n>, door_swords, door_muskets) and
// blank hanging sign plates (sign_rent_<n>, sign_swords, sign_muskets) are named objects in the scene. Data: js/island/hillShops.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { softRamp } from './look.js';
import { libMaterial } from './libTex.js';   // [Timothy] the shared material library (TEXCOORD_0 = layer code)

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
export const HILL_GLB_ON = !(Q && Q.get('hillglb') === '0');
export let HILL_KIT = null;          // { low, mats, lots: { L3: { lods: [Group], sign: Mesh, empty: Object3D, colliders, kind } } }
export const HILL_PLACES = [];       // [{ key, m: Matrix4 }] (foot-world) filled by hillLot
const RECTS = [];                    // town-local footprints of the placed buildings (+ the closed alleys): no grass in the shop rooms
export const hillClear = (lx, lz) => { for (const r of RECTS) if (lx > r[0] && lx < r[1] && lz > r[2] && lz < r[3]) return true; return false; };
const FILES = ['hill_street', 'hill_sword_shop', 'hill_musket_shop', 'hill_big_shop'];   // hill_big_shop = rent_big on the old Squad Hall plot (R0)
const LOD_D = 46;                    // desktop: LOD0 -> LOD1 (m)

export function loadHill(low) {
  if (!HILL_GLB_ON) return Promise.resolve(null);
  const solid = libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), low); solid.name = 'hill_solid';   // shop floors lie 1 cm over the terrain
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); glow.name = 'hill_glow';
  const pick = (m) => /glow/.test(m.name) ? glow : solid, lots = {};
  const one = (f) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`assets/island/${f}${low ? '_low' : ''}.glb`).then(gl => {
    gl.scene.updateMatrixWorld(true); const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
    gl.scene.traverse(o => { if (!/^hill_[LR]\d+$/.test(o.name) || o.isMesh) return; inv.copy(o.matrixWorld).invert(); const ex = o.userData || {}, lods = []; let sign = null, empty = null;
      for (const c of o.children) { const lv = +(/_LOD(\d)$/.exec(c.name) || [])[1];
        if (!isNaN(lv)) { const g = new THREE.Group(); g.name = c.name;
          c.traverse(mm => { if (!mm.isMesh) return; const mesh = new THREE.Mesh(mm.geometry, pick(mm.material)); rel.multiplyMatrices(inv, mm.matrixWorld).decompose(mesh.position, mesh.quaternion, mesh.scale);
            mesh.name = c.name + '_' + mesh.material.name.replace('hill_', ''); mesh.castShadow = !low && mesh.material === solid; mesh.receiveShadow = !low && mesh.material === solid; g.add(mesh); });
          lods[low ? lv - 1 : lv] = g; continue; }
        if (c.name === ex.sign) { let src = c.isMesh ? c : null; c.traverse(mm => { if (!src && mm.isMesh) src = mm; }); if (src) { sign = new THREE.Mesh(src.geometry, solid); rel.multiplyMatrices(inv, src.matrixWorld).decompose(sign.position, sign.quaternion, sign.scale); sign.name = ex.sign; sign.castShadow = !low; } continue; }
        if (c.name === ex.empty) { empty = new THREE.Object3D(); empty.name = ex.empty; rel.multiplyMatrices(inv, c.matrixWorld).decompose(empty.position, empty.quaternion, empty.scale); } }
      let colliders = []; try { colliders = JSON.parse(ex.colliders || '[]'); } catch (e) { /* none */ }
      lots[o.name.slice(5)] = { lods: lods.filter(Boolean), sign, empty, colliders, kind: ex.kind || 'rent' }; }); });
  return Promise.all(FILES.map(one)).then(() => { HILL_KIT = { low, lots, mats: { solid, glow } }; return HILL_KIT; })
    .catch(e => { console.warn('[hill] Blender hill street failed, the colonial houses instead', e); HILL_KIT = null; return null; });
}

// foot.js buildStreet, once per Main Street lot (world coords): true = this lot is the Blender building (colliders added here), false = build the old house
const LABEL = { sword: 'SWORD SHOP', musket: 'MUSKET SHOP' };
export function hillLot({ side, n, z, w, d, lx, x, wz, yaw, y, addBox, addCirc, LOTS_MAP }) {
  const key = (side < 0 ? 'L' : 'R') + n, L = HILL_KIT && HILL_KIT.lots[key]; if (!L || !L.lods.length) return false;
  const c = Math.cos(yaw), s = Math.sin(yaw), at = (bx, bz) => [x + bx * c + bz * s, wz - bx * s + bz * c];
  for (const q of L.colliders) { const [cx, cz] = at(q[1], q[2]); if (q[0] === 'c') addCirc(cx, cz, q[3]); else addBox(cx, cz, q[3], q[4], yaw); }
  const nm = LABEL[L.kind] ? `${LABEL[L.kind]} (${key})` : null;
  LOTS_MAP?.push({ lx, z, w, d, side, label: nm, col: nm ? '#fbbf24' : 'rgba(240,220,190,0.9)', tc: nm ? '#fde68a' : '#fff' });
  RECTS.push([lx - d / 2 - 0.4, lx + d / 2 + 0.4, z - w / 2 - 0.9, z + w / 2 + 0.9]);
  HILL_PLACES.push({ key, m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, wz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)) });
  return true;
}

// [BANKSY pt203u] foot.js buildStreet, the Squad Hall plot (one guarded line, Raul's file): when hill_big_shop is loaded the old town-kit Squad Hall
// building, its banners, its sign and its solid footprint box are skipped and the big empty shop (rent_big, R0) stands there with its own colliders.
// foot.js still pushes the 'SQUAD HALL (R0)' LOTS_MAP entry + the INTERACT 'squadhall' (E · SQUAD HALL) at the middle of the new shopfront, so the
// Squad Hall board, the map POI, main.js squadSign and battle.js storeDoors keep working unchanged. false = load failed / ?hillglb=0 / &bigshop=0: the old hall.
export const BIG_SHOP_ON = !(Q && Q.get('bigshop') === '0');   // &bigshop=0 = the old Squad Hall building (before / after shots)
export function bigShop({ x, y, wz, yaw, lx, z, addBox, addCirc }) {
  if (!BIG_SHOP_ON) return false;
  return hillLot({ side: 1, n: 0, z, w: 16.6, d: 14, lx, x, wz, yaw, y, addBox, addCirc });
}

// [Timothy] material library: the layer is projected in object space; merged into the world frame (phones) a building turned a quarter turn
// would swap the grain of its top faces (deck boards, roof tiles along the ridge), so flip their swap bit back (side faces keep it)
function libTurn(geo, m) {
  const U = geo.attributes.uv, N = geo.attributes.normal; if (!U || !N) return; const e = m.elements, quarter = Math.abs(e[0]) < 0.5;   // x axis mostly turned onto z
  if (!quarter) return;
  for (let i = 0; i < U.count; i++) { const ny = Math.abs(N.getY(i)); if (ny < Math.abs(N.getX(i)) || ny < Math.abs(N.getZ(i))) continue;
    const c = Math.floor(U.getX(i) * 32); if (c < 2) continue; U.setX(i, ((c ^ 1) + 0.5) / 32); }
}
// the placed street (call after foot.js buildStreet): desktop one THREE.LOD per building; phones all LOD1 buildings merged (2 draw calls)
export function buildHill() {
  const K = HILL_KIT; if (!K || !HILL_PLACES.length) return null;
  const root = new THREE.Group(); root.name = 'hill_street'; let tris = 0;
  const merge = { solid: [], glow: [] }, pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), mm = new THREE.Matrix4();
  for (const { key, m } of HILL_PLACES) { const L = K.lots[key]; if (!L) continue;
    const g = new THREE.Group(); g.name = 'hill_' + key; m.decompose(g.position, g.quaternion, g.scale); root.add(g);
    if (K.low) { g.updateMatrix(); L.lods[0].traverse(o => { if (!o.isMesh) return; o.updateMatrix(); mm.multiplyMatrices(g.matrix, o.matrix); const geo = o.geometry.clone();
        for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) geo.deleteAttribute(k);
        for (const k of ['position', 'normal', 'color', 'uv']) { const a = geo.attributes[k]; if (a && (a.normalized || !(a.array instanceof Float32Array))) { const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a.getComponent(i, j); geo.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); } }
        if (geo.attributes.color && geo.attributes.color.itemSize === 4) { const a = geo.attributes.color, f = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); } geo.setAttribute('color', new THREE.BufferAttribute(f, 3)); }
        geo.applyMatrix4(mm); libTurn(geo, mm); (o.material === K.mats.glow ? merge.glow : merge.solid).push(geo); }); }
    else { const lod = new THREE.LOD(); lod.name = 'hill_lod_' + key; L.lods.forEach((lv, i) => lod.addLevel(lv, i ? LOD_D : 0)); g.add(lod);
      L.lods[0].traverse(o => { if (o.isMesh) tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; }); }
    if (L.sign) g.add(L.sign); if (L.empty) g.add(L.empty); }
  if (K.low) for (const [k, list] of Object.entries(merge)) { if (!list.length) continue; const geo = mergeGeometries(list, false); list.forEach(gg => gg.dispose()); if (!geo) continue; geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, K.mats[k]); mesh.name = 'hill_street_merged_' + k; root.add(mesh); tris += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3; }
  root.userData.tris = tris; void pos; void q; void sc;
  return root;
}
