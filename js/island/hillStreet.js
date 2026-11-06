// [Timothy] PUMPFUN PIRATES hill street (Main Street, plaza -> town gate) as Blender-made models (BANKSY 7:35 PM "fix the buildings up the hill
// and make them match the plaza buildings and look good", his Port Royal reference, "multi story on both sides", "make them all shops").
// Source: tools/hill_blender/hill_street_blender.py -> assets/island/hill_street.glb (21 rentable shop buildings), hill_sword_shop.glb (R3 = #36,
// by the coliseum MAIN_GATE), hill_musket_shop.glb (R1+R2 = #34+#35: ONE wide building, origin R2, + an empty 'merged' R1 marker);
// [Raul hill-weapons] the old weapon lots L6 / R6 are plain rent shops (rent_23 / rent_24); *_low.glb = phones (LOD1 only).
// Same look as the plaza shops (plazaShops.js): vertex colour toon, solid + glow.
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
import { SQUAD_HALL } from './hillShops.js';  // [Timothy v312] the widened Squad Hall (R0) footprint / door / E · SQUAD HALL point (generated)

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
export const HILL_GLB_ON = !(Q && Q.get('hillglb') === '0');
export let HILL_KIT = null;          // { low, mats, lots: { L3: { lods: [Group], sign: Mesh, empty: Object3D, colliders, kind } } }
export const HILL_PLACES = [];       // [{ key, m: Matrix4 }] (foot-world) filled by hillLot
const RECTS = [];                    // town-local footprints of the placed buildings (+ the closed alleys): no grass in the shop rooms
export const hillClear = (lx, lz) => { for (const r of RECTS) if (lx > r[0] && lx < r[1] && lz > r[2] && lz < r[3]) return true; return false; };
const FILES = ['hill_street', 'hill_sword_shop', 'hill_musket_shop', 'hill_big_shop'];   // hill_big_shop = the SQUAD HALL (R0, [Timothy v312])
const LOD_D = 46;                    // desktop: LOD0 -> LOD1 (m)

const SIGN_MERGE = (() => { try { return !/[?&]signmerge=0/.test(location.search); } catch { return true; } })();
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
      let colliders = [], span = null; try { colliders = JSON.parse(ex.colliders || '[]'); span = ex.span ? JSON.parse(ex.span) : null; } catch (e) { /* none */ }
      lots[o.name.slice(5)] = { lods: lods.filter(Boolean), sign, empty, colliders, kind: ex.kind || 'rent', merged: ex.merged || null, span }; }); });   // [Raul hill-weapons] merged / span: the R1+R2 MUSKET SHOP
  return Promise.all(FILES.map(one)).then(() => { HILL_KIT = { low, lots, mats: { solid, glow } }; return HILL_KIT; })
    .catch(e => { console.warn('[hill] Blender hill street failed, the colonial houses instead', e); HILL_KIT = null; return null; });
}

// foot.js buildStreet, once per Main Street lot (world coords): true = this lot is the Blender building (colliders added here), false = build the old house
const LABEL = { sword: 'SWORD SHOP', musket: 'MUSKET SHOP' };
export function hillLot({ side, n, z, w, d, lx, x, wz, yaw, y, addBox, addCirc, LOTS_MAP }) {
  const key = (side < 0 ? 'L' : 'R') + n, L = HILL_KIT && HILL_KIT.lots[key];
  if (L && L.kind === 'merged') { const M_ = HILL_KIT.lots[L.merged]; return !!(M_ && M_.lods.length); }   // [Raul hill-weapons] R1 = the south bay of the MUSKET SHOP (R2): built (+ colliders, map) with R2
  if (!L || !L.lods.length) return false;
  const c = Math.cos(yaw), s = Math.sin(yaw), at = (bx, bz) => [x + bx * c + bz * s, wz - bx * s + bz * c];
  for (const q of L.colliders) { const [cx, cz] = at(q[1], q[2]); if (q[0] === 'c') addCirc(cx, cz, q[3]); else addBox(cx, cz, q[3], q[4], yaw); }
  const lots = Object.keys(HILL_KIT.lots).filter(k => HILL_KIT.lots[k].merged === key).concat(key).sort().join('+');   // 'R1+R2' for the double MUSKET SHOP
  const nm = LABEL[L.kind] ? `${LABEL[L.kind]} (${lots})` : null, zz = L.span ? (L.span[0] + L.span[1]) / 2 : z, ww = L.span ? L.span[1] - L.span[0] : w;   // span: town lz range of a widened building
  LOTS_MAP?.push({ lx, z: zz, w: ww, d, side, label: nm, col: nm ? '#fbbf24' : 'rgba(240,220,190,0.9)', tc: nm ? '#fde68a' : '#fff' });
  RECTS.push([lx - d / 2 - 0.4, lx + d / 2 + 0.4, zz - ww / 2 - 0.9, zz + ww / 2 + 0.9]);
  HILL_PLACES.push({ key, m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, wz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)) });
  return true;
}

// [Timothy v312] BANKSY pt381u "Upgrade the squad hall ... Make it wider, enhance inside and outside": hill_big_shop.glb (R0) is the SQUAD HALL
// again, rebuilt in tools/hill_blender/hill_street_blender.py squad_hall(): 24 x 14.5 m (was the 16.6 m empty rent shop), 3 storeys, a 5 m arched
// portal, a walk-in war room (war table, armory + captains' lounge wings, the squad roster board) with its own colliders. foot.js buildStreet (one
// guarded block, Raul's file) places it at SQUAD_HALL (lx 21.25, lz -71, front on the building line lx 14, lz -83 .. -59) and puts the 'SQUAD HALL (R0)'
// map entry + INTERACT 'squadhall' (E · SQUAD HALL) at SQUAD_HALL.interact inside the hall. false = load failed / ?hillglb=0 / &bigshop=0: the old hall.
export const BIG_SHOP_ON = !(Q && Q.get('bigshop') === '0');   // &bigshop=0 = the old town-kit Squad Hall building (before / after shots)
const squadKit = () => { const L = BIG_SHOP_ON && HILL_KIT && HILL_KIT.lots.R0; return L && L.lods.length && L.kind === 'squad' ? L : null; };
export const squadHall = () => (squadKit() ? SQUAD_HALL : null);   // foot.js: the hall data once the Blender hall is the one that stands
export function bigShop({ x, y, wz, yaw, lx, z, addBox, addCirc }) {
  if (!squadKit()) return false;
  return hillLot({ side: 1, n: 0, z, w: SQUAD_HALL.w, d: SQUAD_HALL.d, lx, x, wz, yaw, y, addBox, addCirc });
}
// the ground under the hall stays on the Main Street grade (the plaza blend dipped the south end 0.4 m below the floor): flat inside the footprint,
// eased back to the terrain over 2.5 m outside it (foot.js terrain, coast mode; static flags only: the terrain is built before the GLBs load)
const SQ_GROUND_ON = HILL_GLB_ON && BIG_SHOP_ON && !!SQUAD_HALL;
export function hallGround(lx, lz, h) {
  if (!SQ_GROUND_ON) return h; const R = SQUAD_HALL.rect, dx = Math.max(R.lx0 - 0.6 - lx, 0, lx - R.lx1 - 0.6), dz = Math.max(R.lz0 - 0.6 - lz, 0, lz - R.lz1 - 0.6), dd = Math.hypot(dx, dz);
  if (dd >= 2.5) return h; const t = 1 - dd / 2.5, k = t * t * (3 - 2 * t), ys = 3.0 + Math.max(0, -lz - 50) * 0.11; return h + (ys - h) * k;
}
// the street crates / barrels: none in front of the portal (foot.js street dressing, east row)
export const hallFront = (lz) => !!squadKit() && Math.abs(lz - SQUAD_HALL.door.lz) < SQUAD_HALL.doorW / 2 + 1.4;
// js/island/coliseum.js NEW_STORES (&colirent=1 only): a store whose footprint overlaps the hall is not built
export const squadOverlap = (lx0, lx1, lz0, lz1) => { if (!squadKit()) return false; const R = SQUAD_HALL.rect; return lx0 < R.lx1 && lx1 > R.lx0 && lz0 < R.lz1 && lz1 > R.lz0; };

// [Timothy] material library: the layer is projected in object space; merged into the world frame (phones) a building turned a quarter turn
// would swap the grain of its top faces (deck boards, roof tiles along the ridge), so flip their swap bit back (side faces keep it)
function libTurn(geo, m) {
  const U = geo.attributes.uv, N = geo.attributes.normal; if (!U || !N) return; const e = m.elements, quarter = Math.abs(e[0]) < 0.5;   // x axis mostly turned onto z
  if (!quarter) return;
  for (let i = 0; i < U.count; i++) { const ny = Math.abs(N.getY(i)); if (ny < Math.abs(N.getX(i)) || ny < Math.abs(N.getZ(i))) continue;
    const c = Math.floor(U.getX(i) * 32); if (c < 2) continue; U.setX(i, ((c ^ 1) + 0.5) / 32); }
}
// [Emerly] BANKSY: the coliseum entrance shops (#45 / #46, js/island/coliseum.js NEW_STORES, &colirent=1 only) = the same empty rent shop as the hill
// street (the R0 big shop model), placed again (cloned in buildHill). &colirent=0 = the old stone boxes. [Timothy v312] R0 is the Squad Hall now
// (never cloned onto another plot): the stores keep their stone boxes, and #46 (it overlaps the widened hall) is skipped (squadOverlap).
export const COLI_RENT_ON = BIG_SHOP_ON && !(Q && Q.get('colirent') === '0');
export function rentLot({ id, x, y, wz, yaw, addBox, addCirc }) {
  const L = COLI_RENT_ON && HILL_KIT && HILL_KIT.lots.R0; if (!L || !L.lods.length || L.kind === 'squad') return false;
  const c = Math.cos(yaw), s = Math.sin(yaw), at = (bx, bz) => [x + bx * c + bz * s, wz - bx * s + bz * c];
  for (const q of L.colliders) { const [cx, cz] = at(q[1], q[2]); if (q[0] === 'c') addCirc(cx, cz, q[3]); else addBox(cx, cz, q[3], q[4], yaw); }
  HILL_PLACES.push({ key: 'R0', id, m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, wz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)) });
  return true;
}
// [v335] meshopt-quantized attributes (normalized Int16 / Uint8) -> Float32 before baking a world matrix into them: the merged sign plates
// used to clamp to +-1 m at the frame origin (a merged mesh can't keep the node's dequantize scale)
function floatify(geo) {
  for (const k of ['position', 'normal', 'color', 'uv']) { const a = geo.attributes[k]; if (a && (a.normalized || !(a.array instanceof Float32Array) || a.isInterleavedBufferAttribute)) { const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a.getComponent(i, j); geo.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); } }
  if (geo.attributes.color && geo.attributes.color.itemSize === 4) { const a = geo.attributes.color, f = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); } geo.setAttribute('color', new THREE.BufferAttribute(f, 3)); }
  return geo; }
// the placed street (call after foot.js buildStreet): desktop one THREE.LOD per building; phones all LOD1 buildings merged (2 draw calls)
export function buildHill() {
  const K = HILL_KIT; if (!K || !HILL_PLACES.length) return null;
  const root = new THREE.Group(); root.name = 'hill_street'; let tris = 0;
  const merge = { solid: [], glow: [] }, signs = [], signObj = [], pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), mm = new THREE.Matrix4();
  const used = new Set(), owner = new Map();   // [v335] geo -> 'hill_<id>': BUILD MODE moves / deletes each building's vertices (+ its sign) inside the merged meshes
  for (const { key, m, id } of HILL_PLACES) { let L = K.lots[key]; if (!L) continue;
    if (used.has(key)) { const sg = L.sign && L.sign.clone(), em = L.empty && L.empty.clone(); if (sg) sg.name = 'sign_' + (id || key); if (em) em.name = 'door_' + (id || key); L = { ...L, lods: L.lods.map(lv => lv.clone(true)), sign: sg, empty: em }; } used.add(key);   // [Emerly] a second placement of one model (coliseum rent shops)
    const g = new THREE.Group(); g.name = 'hill_' + (id || key); m.decompose(g.position, g.quaternion, g.scale); root.add(g);
    if (K.low) { g.updateMatrix(); L.lods[0].traverse(o => { if (!o.isMesh) return; o.updateMatrix(); mm.multiplyMatrices(g.matrix, o.matrix); const geo = o.geometry.clone();
        for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) geo.deleteAttribute(k);
        floatify(geo); geo.applyMatrix4(mm); libTurn(geo, mm); owner.set(geo, g.name); (o.material === K.mats.glow ? merge.glow : merge.solid).push(geo); }); }
    else { const lod = new THREE.LOD(); lod.name = 'hill_lod_' + key; L.lods.forEach((lv, i) => lod.addLevel(lv, i ? LOD_D : 0)); g.add(lod);
      L.lods[0].traverse(o => { if (o.isMesh) tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; }); }
    if (L.sign && SIGN_MERGE && !K.low) { g.updateMatrix(); L.sign.updateMatrix(); const geo = L.sign.geometry.clone(); for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) geo.deleteAttribute(k);
      floatify(geo); geo.applyMatrix4(mm.multiplyMatrices(g.matrix, L.sign.matrix)); signs.push(geo); owner.set(geo, g.name); signObj.push([g, L.sign]); } // [perf3] the sign plates: one mesh, not one draw (+ shadow draw) each
    else if (L.sign) g.add(L.sign); if (L.empty) g.add(L.empty); }
  const ranges = {}, track = (list, name) => { let a = 0; for (const gg of list) { const n = gg.attributes.position.count, u = owner.get(gg); if (u) (ranges[u] ||= []).push([name, a, n]); a += n; } };
  if (signs.length) { let geo = null; try { geo = mergeGeometries(signs, false); } catch (e) { geo = null; } if (geo) track(signs, 'hill_signs_merged'); signs.forEach(gg => gg.dispose());
    if (geo) { geo.computeBoundingSphere(); const mesh = new THREE.Mesh(geo, K.mats.solid); mesh.name = 'hill_signs_merged'; mesh.castShadow = true; root.add(mesh); } else signObj.forEach(([gg, sg]) => gg.add(sg)); }
  if (K.low) for (const [k, list] of Object.entries(merge)) { if (!list.length) continue; const geo = mergeGeometries(list, false); if (geo) track(list, 'hill_street_merged_' + k); list.forEach(gg => gg.dispose()); if (!geo) continue; geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, K.mats[k]); mesh.name = 'hill_street_merged_' + k; root.add(mesh); tris += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3; }
  root.userData.tris = tris; root.userData.editRanges = ranges; void pos; void q; void sc;
  return root;
}
