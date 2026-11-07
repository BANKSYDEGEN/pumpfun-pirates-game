// [Timothy] THE GOLDEN DOUBLOON CASINO (#47, BANKSY via Emerly): the walk-in pirate casino on Main Street (east row, between the SQUAD HALL #33
// and the UPGRADE SHOP #5). Model: tools/casino_blender/build_casino.py -> assets/island/casino_hall.glb (desktop: LOD0 + LOD1) and
// casino_hall_low.glb (phones: LOD1), meshopt, vertex colour toon (solid + glow, the hill street's look + material library).
// Data (footprint, the four stations, the terrain rule): js/island/casinoData.js. Gameplay UI: js/casino/ui.js (opened by the dock / island page).
// foot.js wiring (all guarded, all no-ops with &casino=0): coastH -> casinoGround (the hall's ground is the street level), buildStreet ->
// casinoSite (the hall's colliders: hollow walls with the arch open + the tables / bar / props; the interior walk deck; the Squad Hall's north
// strip deck; the four E points; the map lot), grass -> casinoClear. plazaShops.js loads it with the hill street and adds buildCasino() to the scene.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { softRamp } from './look.js';
import { libMaterial } from './libTex.js';
import { t2w, t2wYaw } from './coast.js';
import { squadHall } from './hillStreet.js';
import { CASINO_ON, CASINO_HALL, CASINO_TABLES, CASINO_WING, CASINO_WING_TABLES, CASINO_Y, SQUAD_NORTH_DECK, streetGrade, casinoGround, casinoClear, casinoOverlap, casinoInteract } from './casinoData.js';
export { CASINO_ON, CASINO_HALL, CASINO_TABLES, CASINO_Y, casinoGround, casinoClear, casinoOverlap, casinoInteract };

export let CASINO_KIT = null;        // { low, lods: [Group], colliders: [['b', x, z, w, d] | ['c', x, z, r]] (three.js building frame), tables, mats }
let _p = null, PLACED = false;
const LOD_D = 55;                    // desktop: LOD0 -> LOD1 (m)

export function loadCasinoReady(low) {
  if (!CASINO_ON) return Promise.resolve(null);
  if (_p) return _p;
  const solid = libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), low); solid.name = 'casino_solid';
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); glow.name = 'casino_glow';
  _p = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`assets/island/casino_hall${low ? '_low' : ''}.glb`).then(gl => {
    gl.scene.updateMatrixWorld(true); let root = null; gl.scene.traverse(o => { if (o.name === 'casino_hall' && !o.isMesh) root = o; });
    if (!root) throw new Error('no casino_hall node');
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), rel = new THREE.Matrix4(), lods = [], ex = root.userData || {};
    for (const c of root.children) { const lv = +(/_LOD(\d)\b/.exec(c.name) || [])[1]; if (isNaN(lv)) continue;
      const g = new THREE.Group(); g.name = c.name;
      c.traverse(mm => { if (!mm.isMesh) return; const mat = /glow/.test(mm.material?.name || '') ? glow : solid, mesh = new THREE.Mesh(mm.geometry, mat);
        rel.multiplyMatrices(inv, mm.matrixWorld).decompose(mesh.position, mesh.quaternion, mesh.scale); mesh.name = c.name + '_' + mat.name.replace('casino_', '');
        mesh.castShadow = !low && mat === solid; mesh.receiveShadow = !low && mat === solid; g.add(mesh); });
      lods[low ? lv - 1 : lv] = g; }
    const J = (s, d) => { try { return JSON.parse(s || d); } catch { return JSON.parse(d); } };
    CASINO_KIT = { low, lods: lods.filter(Boolean), colliders: J(ex.colliders, '[]'), tables: J(ex.tables, '{}'), footprint: J(ex.footprint, '{}'), wing: J(ex.wing, 'null'), mats: { solid, glow } };
    return CASINO_KIT;
  }).catch(e => { console.warn('[casino] the casino model failed to load (no casino this session)', e); CASINO_KIT = null; return null; });
  return _p;
}

// world placement of the hall (foot frame): origin = the footprint centre at the walk deck, front (+z building frame) = -lx
export function casinoPlace() { const [x, z] = t2w(CASINO_HALL.lx, CASINO_HALL.lz); return { x, y: CASINO_Y, z, yaw: t2wYaw(CASINO_HALL.ly) }; }

// foot.js buildStreet (after the Squad Hall): colliders, decks, E points, map lot. Returns true when the hall stands.
export function casinoSite({ addBox, addCirc, addDeck, INTERACT, LOTS_MAP }) {
  if (!CASINO_ON) return false;
  const tw = (lx, lz) => t2w(lx, lz);
  if (addDeck && squadHall()) {   // the Squad Hall's north strip: the terrain row under it is lowered, its floor walk stays on the street grade
    const d = SQUAD_NORTH_DECK, [x, z] = tw((d.lx0 + d.lx1) / 2, (d.lz0 + d.lz1) / 2);
    addDeck({ x, z, hw: (d.lx1 - d.lx0) / 2, hl: (d.lz1 - d.lz0) / 2, yaw: -Math.PI / 2, y: streetGrade(d.lz0), y1: streetGrade(d.lz1), tag: 'squad_north' });
  }
  const K = CASINO_KIT; if (!K || !K.lods.length) return false;
  const P = casinoPlace(), c = Math.cos(P.yaw), s = Math.sin(P.yaw), at = (bx, bz) => [P.x + bx * c + bz * s, P.z - bx * s + bz * c];
  for (const q of K.colliders) { const [cx, cz] = at(q[1], q[2]); if (q[0] === 'c') addCirc(cx, cz, q[3]); else addBox(cx, cz, q[3], q[4], P.yaw); }
  if (addDeck) { const I = CASINO_HALL.inner, lx0 = CASINO_HALL.rect.lx0 - 0.1, [x, z] = tw((lx0 + I.lx1) / 2, (I.lz0 + I.lz1) / 2);   // the plank floor (+ the arch threshold)
    addDeck({ x, z, hw: (I.lz1 - I.lz0) / 2, hl: (I.lx1 - lx0) / 2, yaw: 0, y: CASINO_Y, tag: 'casino' }); }
  if (addDeck && K.wing) { const I = CASINO_WING.inner, [x, z] = tw((I.lx0 + I.lx1) / 2, (I.lz0 + I.lz1) / 2);   // [v378] THE HIGH SEAS ROOM floor
    addDeck({ x, z, hw: (I.lz1 - I.lz0) / 2, hl: (I.lx1 - I.lx0) / 2, yaw: 0, y: CASINO_Y, tag: 'casino_wing' }); }
  for (const t of K.wing ? [...CASINO_TABLES, ...CASINO_WING_TABLES] : CASINO_TABLES) { const [x, z] = tw(t.e.lx, t.e.lz); INTERACT.push({ id: t.id, x, z, r: t.r, label: t.label, game: t.game, casino: true }); }
  if (K.wing) { const R = CASINO_WING.rect; LOTS_MAP?.push({ lx: (R.lx0 + R.lx1) / 2, z: (R.lz0 + R.lz1) / 2, w: R.lz1 - R.lz0, d: R.lx1 - R.lx0, side: 1, label: 'CASINO: HIGH SEAS ROOM', col: '#d4a017', tc: '#fde68a', ldx: 40, ldy: -40 }); }
  LOTS_MAP?.push({ lx: CASINO_HALL.lx, z: CASINO_HALL.lz, w: CASINO_HALL.w, d: CASINO_HALL.d, side: 1, label: 'THE GOLDEN DOUBLOON CASINO (#47)', col: '#d4a017', tc: '#fde68a', ldx: 40, ldy: -60 });
  PLACED = true;
  return true;
}

// the placed hall (after foot.js buildStreet): desktop one THREE.LOD (LOD0 near, LOD1 far), phones the LOD1 meshes (2 draw calls)
export function buildCasino() {
  const K = CASINO_KIT; if (!K || !PLACED || !K.lods.length) return null;
  const P = casinoPlace(), g = new THREE.Group(); g.name = 'casino_hall'; g.position.set(P.x, P.y, P.z); g.rotation.y = P.yaw;
  if (K.low) g.add(K.lods[0]);
  else { const lod = new THREE.LOD(); lod.name = 'casino_lod'; K.lods.forEach((lv, i) => lod.addLevel(lv, i ? LOD_D : 0)); g.add(lod); }
  // [v378] warm chandelier light (desktop only, a fixed count so shaders never recompile): the hall + down the wing to the bar. ?caslights=0 = off
  if (!K.low && !/[?&]caslights=0(&|$)/.test(location.search)) {
    const spots = [[0, 0.1, 6.5, 12]]; if (K.wing) spots.push([0, 11.5, 6.5, 12], [0, 20.5, 6.5, 12], [0, 29.0, 6.0, 11]);
    for (const [bx, by, I, d] of spots) { const L = new THREE.PointLight(0xffb45c, I, d, 1.4); L.position.set(bx, 3.7, -by); L.name = 'casino_light'; g.add(L); }
  }
  let tris = 0; K.lods[0].traverse(o => { if (o.isMesh) tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
  g.userData.tris = tris;
  return g;
}
