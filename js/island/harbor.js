// [Raul] PUMPFUN PIRATES island in the REAL queue harbor (preview, visual + solid only: no docking, no on-foot mode).
// Builds the big round island (js/island/art.js) at HARBOR_ISLAND in the game's world frame, with the same near / mid / far
// LOD as island.html, and returns its world-space colliders for props.js (land circles + pier capsules as circle chains +
// the lighthouse). The harbor lighthouse (formerly on a props.js sea stack) now stands on the island's back headland.
import * as THREE from 'three';
import { toon } from '../toon.js';
import { HARBOR_ISLAND, PIER, BERTHS, groundY, buildIsland, buildFarIsland, buildChest, buildPlants, makeAtlas, shoreFoam, islandColliders, harborWalls, SPOTS } from './art.js';
import { Kit, M, outlineMaterial, SWAY_DECL, SWAY_BODY } from './kit.js';

const LOD_NEAR = 200, LOD_FAR = 310, HYST = 12;

export async function createHarborIsland({ quality, ocean }) {
  const LOW = quality === 'low', uTime = ocean.uniforms.uTime;
  const isle = new THREE.Group(); isle.name = 'harbor_island';
  isle.position.set(HARBOR_ISLAND.x, 0, HARBOR_ISLAND.z); isle.rotation.y = HARBOR_ISLAND.yaw; isle.updateMatrixWorld(true);
  const cs = Math.cos(HARBOR_ISLAND.yaw), sn = Math.sin(HARBOR_ISLAND.yaw);
  const W = (x, z) => ({ x: HARBOR_ISLAND.x + x * cs + z * sn, z: HARBOR_ISLAND.z - x * sn + z * cs }); // island-local -> world

  const skull = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/skull_transparent.png'; });
  await document.fonts?.load('40px "Just Another Hand"').catch(() => {});
  const atlas = makeAtlas(skull);
  const swayMat = toon(0xffffff, null, { vertexColors: true });
  swayMat.onBeforeCompile = (s) => { s.uniforms.uTime = uTime; s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>' + SWAY_DECL).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY_BODY); };
  swayMat.customProgramCacheKey = () => 'isl_sway';
  const MATS = { toon: toon(0xffffff, null, { vertexColors: true }), sway: swayMat, glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), atlas: toon(0xffffff, atlas.tex, { side: THREE.DoubleSide }) };
  const OUT = { plain: outlineMaterial(0.09), sway: outlineMaterial(0.09, uTime) };

  // moored toy galleons merged into the island mesh (0 extra draw calls); no real ships (no docking in this preview)
  const BERTH = Object.fromEntries(BERTHS().map(b => [b.id, b]));
  const DECOR = LOW ? ['P1R', 'P3L'] : ['P1R', 'P2L', 'P3R', 'P4L', 'P4R'];
  const near = buildIsland({ low: LOW, atlas, decor: DECOR.map((id, i) => [BERTH[id].x, BERTH[id].z, BERTH[id].yaw, i]) }).build(MATS, OUT);
  near.traverse(o => { if (o.isMesh && !o.userData.outline) o.receiveShadow = !LOW; });
  const far = buildFarIsland().build({ toon: MATS.toon }, OUT); far.visible = false;
  const plants = buildPlants(LOW, MATS.toon);
  const foam = shoreFoam(uTime, LOW, ocean.uniforms.uWaves);
  const chest = new THREE.Group(), c0 = SPOTS.chest; chest.position.set(c0.x, groundY(c0.x, c0.z) + 1.15, c0.z); chest.rotation.y = -0.9;
  chest.add(buildChest(LOW, atlas).build(MATS, OUT));
  isle.add(near, far, plants, foam, chest);

  // ---- the harbor lighthouse, moved here from its sea stack: back headland (local -z, faces the open sea) ----
  let lz = -40; for (let z = -40; z >= -75; z -= 1) { if (groundY(0, z) >= 1.6) lz = z; else break; }
  const LH = { x: 0, z: lz, y: groundY(0, lz) - 0.3 }, S = 1.3;
  const lk = new Kit();
  lk.add(new THREE.CylinderGeometry(4.2, 5.2, 2.4, 12), 0x8d97a5, { m: M(LH.x, LH.y + 1.0, LH.z) });                 // stone plinth
  lk.add(new THREE.CylinderGeometry(2.2 * S, 3.2 * S, 16 * S, 12), 0xe9e2d0, { m: M(LH.x, LH.y + 8 * S, LH.z) });
  lk.add(new THREE.CylinderGeometry(2.55 * S, 2.75 * S, 3 * S, 12), 0xfa0d0d, { m: M(LH.x, LH.y + 9 * S, LH.z), outline: false });
  lk.add(new THREE.CylinderGeometry(2.7 * S, 2.7 * S, 0.5 * S, 12), 0x161616, { m: M(LH.x, LH.y + 16.2 * S, LH.z) });  // gallery
  lk.add(new THREE.ConeGeometry(2.8 * S, 3 * S, 12), 0x161616, { m: M(LH.x, LH.y + 21 * S, LH.z) });
  lk.add(new THREE.SphereGeometry(2.2 * S, 12, 8), 0xffd27a, { bucket: 'glow', m: M(LH.x, LH.y + 18 * S, LH.z), outline: false });
  const lighthouse = lk.build(MATS, OUT); lighthouse.name = 'island_lighthouse'; isle.add(lighthouse);
  const beamGeo = new THREE.ConeGeometry(9, 140, 16, 1, true); beamGeo.translate(0, -70, 0); beamGeo.rotateZ(Math.PI / 2);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.42, 0.2), transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  beam.position.set(LH.x, LH.y + 18 * S, LH.z); beam.renderOrder = 4; isle.add(beam);

  // ---- world colliders (props.js circle format {x, z, r, h}) ----
  const circles = islandColliders().map(c => ({ ...W(c.x, c.z), r: c.r, h: c.h }));
  for (const w of harborWalls()) { // pier capsules -> chains of circles (radius = deck half-width, spacing <= radius)
    const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0), n = Math.max(1, Math.ceil(L / (w.r * 1.2)));
    for (let i = 0; i <= n; i++) { const f = i / n; circles.push({ ...W(w.x0 + (w.x1 - w.x0) * f, w.z0 + (w.z1 - w.z0) * f), r: w.r, h: PIER.y + 1.5, pier: true }); }
  }
  circles.push({ ...W(LH.x, LH.z), r: 5, h: LH.y + 21 * S + 4 });
  const bound = { x: HARBOR_ISLAND.x, z: HARBOR_ISLAND.z, r: Math.max(...circles.map(c => Math.hypot(c.x - HARBOR_ISLAND.x, c.z - HARBOR_ISLAND.z) + c.r)) };

  let lod = '', on = true;
  function setLod(d) {
    const want = d > LOD_FAR + (lod === 'far' ? -HYST : HYST) ? 'far' : d > LOD_NEAR + (lod === 'near' ? HYST : -HYST) ? 'mid' : 'near';
    if (want === lod) return; lod = want;
    near.visible = chest.visible = lod !== 'far'; far.visible = lod === 'far';
    near.traverse(o => { if (o.userData.outline) o.visible = lod === 'near'; });
    chest.traverse(o => { if (o.userData.outline) o.visible = lod === 'near'; });
    lighthouse.traverse(o => { if (o.userData.outline) o.visible = lod === 'near'; });
    plants.visible = lod === 'near'; foam.visible = lod !== 'far';
  }
  return {
    group: isle, circles, bound, lighthouseWorld: W(LH.x, LH.z),
    get lod() { return lod; },
    setVisible(v) { on = v; isle.visible = v; },
    update(t, cam) {
      if (!on) return;
      setLod(Math.hypot(cam.x - HARBOR_ISLAND.x, cam.y, cam.z - HARBOR_ISLAND.z));
      beam.rotation.y = t * 0.8; chest.position.y = groundY(c0.x, c0.z) + 1.15 + Math.sin(t * 2) * 0.12; chest.rotation.y = -0.9 + t * 0.4;
    },
  };
}
