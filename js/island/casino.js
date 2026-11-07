// [Timothy] THE GOLDEN DOUBLOON CASINO (#47, BANKSY via Emerly): the walk-in pirate casino on Main Street (east row, between the SQUAD HALL #33
// and the UPGRADE SHOP #5). Model: tools/casino_blender/build_casino.py -> assets/island/casino_hall.glb (desktop: LOD0 + LOD1) and
// casino_hall_low.glb (phones: LOD1), meshopt, vertex colour toon (solid + glow, the hill street's look + material library).
// Data (footprint, the four stations, the terrain rule): js/island/casinoData.js. Gameplay UI: js/casino/ui.js (opened by the dock / island page).
// foot.js wiring (all guarded, all no-ops with &casino=0): coastH -> casinoGround (the hall's ground is the street level), buildStreet ->
// [AAA] BANKSY t214u-t216u ("3A studio touch": tables, signs, spacing, lighting, a raised ceiling): the tables are a separate sculpted kit
// (assets/island/casino_tables.glb: LOD0 + LOD1, casino_tables_low.glb: LOD1) instanced at the hall's 'kit' placements, the printed felts
// are canvas decals (js/island/casinoFelt.js), and the light baked into the vertex colours is topped with additive floor pools, flame halos
// and (desktop) soft lamp cones, plus a small fixed realtime rig. ?castables=0 = no kit, ?casfx=0 = no pools / halos / cones.
// casinoSite (the hall's colliders: hollow walls with the arch open + the tables / bar / props; the interior walk deck; the Squad Hall's north
// strip deck; the four E points; the map lot), grass -> casinoClear. plazaShops.js loads it with the hill street and adds buildCasino() to the scene.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildFelts, loadFeltFont } from './casinoFelt.js';
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
  const solid = bakeLit(libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), low), 0.22); solid.name = 'casino_solid';
  const tsolid = bakeLit(libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp() }), low), 0.5); tsolid.name = 'casino_tables_solid';   // the table kit: brighter self-lit bake (the lamp pools)
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); glow.name = 'casino_glow';
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), q = typeof location !== 'undefined' ? location.search : '';
  const kitP = /[?&]castables=0(&|$)/.test(q) ? Promise.resolve(null)
    : loader.loadAsync(`assets/island/casino_tables${low ? '_low' : ''}.glb`).catch(e => { console.warn('[casino] the table kit failed to load', e); return null; });
  const fontP = loadFeltFont();
  _p = Promise.all([loader.loadAsync(`assets/island/casino_hall${low ? '_low' : ''}.glb`), kitP, fontP]).then(([gl, kt]) => {
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
    CASINO_KIT = { low, lods: lods.filter(Boolean), colliders: J(ex.colliders, '[]'), tables: J(ex.tables, '{}'), footprint: J(ex.footprint, '{}'), wing: J(ex.wing, 'null'), dealers: J(ex.dealers, '[]'), mats: { solid, glow },
      placements: J(ex.kit, '[]'), pools: J(ex.pools, '[]'), halos: J(ex.halos, '[]'), lamps: J(ex.lamps, '[]'), kit: kt ? tableKit(kt, low, tsolid, glow) : null };
    return CASINO_KIT;
  }).catch(e => { console.warn('[casino] the casino model failed to load (no casino this session)', e); CASINO_KIT = null; return null; });
  return _p;
}

// [AAA] the baked interior light (vertex colours) also glows a little on its own, so the lamp pools + chandelier light read even where the
// sun / realtime rig can't reach (phones have no realtime casino lights at all): emissive += albedo * k
function bakeLit(mat, k) {
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (sh, r) => { if (base) base(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * ${k.toFixed(3)};`); };
  mat.customProgramCacheKey = () => key() + '_bk' + k.toFixed(3);
  return mat;
}
// the table kit GLB -> { kinds: { blackjack: [[geometry, material, local matrix] per LOD level] }, felts }
function tableKit(gl, low, solid, glow) {
  let root = null; gl.scene.traverse(o => { if (o.name === 'casino_tables' && !o.isMesh) root = o; }); if (!root) return null;
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), kinds = {};
  for (const c of root.children) { const m = /^(\w+?)_LOD(\d)$/.exec(c.name); if (!m) continue; const lv = low ? +m[2] - 1 : +m[2];
    const parts = []; c.traverse(mm => { if (!mm.isMesh) return;   // the node matrix stays separate (it carries the meshopt dequantisation)
      parts.push([mm.geometry, /glow/.test(mm.material?.name || '') ? glow : solid, new THREE.Matrix4().multiplyMatrices(inv, mm.matrixWorld)]); });
    (kinds[m[1]] ||= [])[lv] = parts; }
  let felts = null; try { felts = JSON.parse(root.userData?.felts || 'null'); } catch { felts = null; }
  return { kinds, felts };
}
// one InstancedMesh per (kind, material) at every placement of that kind (three.js building frame [kind, x, z, yaw])
function kitLevel(K, lv) {
  const g = new THREE.Group(); g.name = 'casino_tables_LOD' + lv; const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  for (const [kind, levels] of Object.entries(K.kit.kinds)) {
    const list = K.placements.filter(p => p[0] === kind), parts = levels[lv]; if (!list.length || !parts) continue;
    for (const [geo, mat, loc] of parts) { const im = new THREE.InstancedMesh(geo, mat, list.length); im.name = `casino_${kind}_LOD${lv}_${mat === K.mats.glow ? 'glow' : 'solid'}`;
      list.forEach(([, x, z, yaw], i) => { q.setFromAxisAngle(up, yaw); mm.compose(new THREE.Vector3(x, 0, z), q, one).multiply(loc); im.setMatrixAt(i, mm); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = !K.low && mat !== K.mats.glow && lv === 0; im.receiveShadow = !K.low && mat !== K.mats.glow; g.add(im); }
  }
  return g;
}
// soft additive light: radial floor pools (one InstancedMesh), flame halos (one Points), desktop lamp cones over the tables (one InstancedMesh)
let _glowTex = null;
function glowTex() {
  if (_glowTex !== null) return _glowTex;
  const c = typeof document !== 'undefined' && document.createElement ? document.createElement('canvas') : null, g = c && c.getContext ? c.getContext('2d') : null;
  if (!g) return (_glowTex = false);
  c.width = c.height = 128; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(0.6, 'rgba(255,255,255,0.14)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); _glowTex = new THREE.CanvasTexture(c); _glowTex.colorSpace = THREE.SRGBColorSpace; return _glowTex;
}
function casinoFx(K) {
  const tex = glowTex(); if (!tex) return null;
  const grp = new THREE.Group(), add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }; grp.name = 'casino_fx';
  const m = new THREE.Matrix4(), col = new THREE.Color();
  if (K.pools.length) {
    const geo = new THREE.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: tex, ...add, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }), K.pools.length); im.name = 'casino_pools';
    K.pools.forEach(([x, z, r, I], i) => { m.makeScale(r, 1, r).setPosition(x, 0.03, z); im.setMatrixAt(i, m); im.setColorAt(i, col.setRGB(0.62, 0.4, 0.2).multiplyScalar(I * (K.low ? 0.5 : 0.42))); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.renderOrder = 2; grp.add(im);
  }
  if (K.halos.length) {
    const pos = new Float32Array(K.halos.length * 3), siz = new Float32Array(K.halos.length);
    K.halos.forEach(([x, y, z, s], i) => { pos.set([x, y, z], i * 3); siz[i] = s; });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
    const mat = new THREE.ShaderMaterial({ ...add, uniforms: { map: { value: tex }, scale: { value: 600 }, tint: { value: new THREE.Color(1.0, 0.72, 0.4) } },
      vertexShader: 'attribute float size; uniform float scale; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(size * scale / max(-mv.z, 0.1), 1.0, 256.0); }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 tint; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(tint * a * 0.85, 1.0); }' });
    const pts = new THREE.Points(geo, mat); pts.name = 'casino_halos'; pts.frustumCulled = false; pts.renderOrder = 3;
    pts.onBeforeRender = (r) => { mat.uniforms.scale.value = r.getDrawingBufferSize(_v2).y * 0.9; };
    grp.add(pts);
  }
  const tables = K.placements.filter(p => p[0] !== 'slots');
  if (!K.low && tables.length) {   // the lamp cones: a faint warm shaft from each table lamp's hood down onto the felt
    const geo = new THREE.CylinderGeometry(0.4, 1.45, 1.95, 28, 6, true); geo.translate(0, 0.975 + 0.9, 0);   // hood (2.85) -> just above the felt
    const mat = new THREE.ShaderMaterial({ ...add, side: THREE.DoubleSide, uniforms: { tint: { value: new THREE.Color(1.0, 0.68, 0.36) }, k: { value: 0.11 } },
      vertexShader: 'varying float vF, vH; void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal);'
        + ' vec3 v = normalize(cameraPosition - wp.xyz); vF = abs(dot(n, v)); vH = (position.y - 0.9) / 1.95; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: 'uniform vec3 tint; uniform float k; varying float vF, vH; void main(){ float a = pow(vF, 2.2) * smoothstep(0.0, 0.35, vH) * (0.35 + 0.65 * vH) * k; gl_FragColor = vec4(tint * a, 1.0); }' });
    mat.name = 'casino_cones';
    const im = new THREE.InstancedMesh(geo, mat, tables.length); im.name = 'casino_cones'; const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const OFF = { blackjack: [0, 0.62], roulette: [-0.35, 0], dice: [0, 0] };
    tables.forEach(([kind, x, z, yaw], i) => { const [ox, oz] = OFF[kind] || [0, 0], c = Math.cos(yaw), s = Math.sin(yaw); q.setFromAxisAngle(up, yaw);
      m.compose(new THREE.Vector3(x + ox * c + oz * s, 0, z - ox * s + oz * c), q, one); im.setMatrixAt(i, m); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.renderOrder = 3; grp.add(im);
  }
  return grp;
}
const _v2 = new THREE.Vector2();

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
  if (!K._dressed) { K._dressed = true;   // the table kit, the felts and the light FX ride the near level (desktop LOD0 / phones the only level)
    if (K.kit) { K.lods.forEach((lv, i) => { if (K.kit.kinds && Object.values(K.kit.kinds).some(l => l[i])) lv.add(kitLevel(K, i)); });
      const felts = buildFelts(K.kit.felts, K.placements, { low: K.low, anisotropy: K.low ? 2 : 8 }); if (felts) K.lods[0].add(felts); }
    if (!/[?&]casfx=0(&|$)/.test(location.search)) { const fx = casinoFx(K); if (fx) K.lods[0].add(fx); }
  }
  if (K.low) g.add(K.lods[0]);
  else { const lod = new THREE.LOD(); lod.name = 'casino_lod'; K.lods.forEach((lv, i) => lod.addLevel(lv, i ? LOD_D : 0)); g.add(lod); }
  // warm chandelier light (desktop only, a fixed count so shaders never recompile): [AAA] the grand chandelier + down the wing, hung under the
  // raised ceilings (hall 8.2 m, wing 7.0 m), plus one low fill over the hall's tables. ?caslights=0 = off
  if (!K.low && !/[?&]caslights=0(&|$)/.test(location.search)) {
    const spots = [[0, 0.05, 4.1, 7.0, 15], [0, 0.05, 2.6, 2.6, 10]]; if (K.wing) spots.push([0, 11.5, 4.3, 5.6, 13], [0, 22.3, 4.3, 5.6, 13]);
    for (const [bx, by, y, I, d] of spots) { const L = new THREE.PointLight(0xffb060, I, d, 1.3); L.position.set(bx, y, -by); L.name = 'casino_light'; g.add(L); }
  }
  if (K.dealers?.length && !/[?&]casdealers=0(&|$)/.test(location.search)) v7Dealers(g, K.dealers);   // [t2007u] the dealers + bartender are V7 PUMPFUN PIRATES
  let tris = 0; K.lods[0].traverse(o => { if (o.isMesh) tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
  g.userData.tris = tris;
  return g;
}

// [t2007u] BANKSY: "make the dealers v7 pumpfun pirates". The Blender build leaves a marker per dealer (building frame x, y, z, facing, kind 1 = the bartender);
// each gets the real V7 body (lo GLB, Draco), male / female alternating, playing the idle clip (ticked while on screen). ?casdealers=0 = none
export function v7Dealers(g, list) { // [t2010u/t2011u] dressed through the game's own pirate builder: every dealer + the bartender wear the SAME casino suit
  // [t2012u/t2013u] mixed skin tones, hair + eye colours (1-based SKIN / HAIR / EYE_SWATCHES in js/pirateGear.js, natural range only)
  const LOOKS = [[3, 2, 1], [8, 1, 4], [5, 4, 3], [9, 1, 1], [2, 6, 4], [7, 3, 2], [4, 5, 3], [6, 1, 6], [1, 7, 5], [8, 8, 1]];
  Promise.all([import('../pirates.js'), import('../pirateGear.js')]).then(([{ pirateFigure }, { setBodyLook }]) => list.forEach(([bx, by, bz, a, kind], i) => {
    const [skinColor, hairColor, eyeColor] = LOOKS[i % LOOKS.length];
    const fig = pirateFigure({ low: true, height: 1.78, female: kind !== 1 && i % 2 === 1, clip: 'idle', gear: { outfit: 'suit', pants: 'classic_pants', boots: 'shoes_buckle' } /* [t2020u] pants + shoes */,
      onReady: (p) => { try { setBodyLook(p, { skinColor, hairColor, eyeColor }); } catch (e) { console.warn('[casino] dealer look', e); } } });
    const w = new THREE.Group(); w.name = 'casino_dealer_v7'; w.add(fig);
    w.position.set(bx, bz + (kind === 1 ? 0.42 : 0.03), -by); /* the bartender stands on the duckboard behind the bar */
    w.rotation.y = Math.atan2(Math.sin(a), -Math.cos(a)); g.add(w);
  })).catch(e => console.warn('[casino] V7 dealers', e));
}
