// [Raul] PUMPFUN PIRATES island in the REAL queue harbor (preview, visual + solid only: no docking, no on-foot mode).
// Builds the big round island (js/island/art.js) at HARBOR_ISLAND in the game's world frame, with the same near / mid / far
// LOD as island.html, and returns its world-space colliders for props.js (land circles + pier capsules as circle chains +
// the lighthouse). The harbor lighthouse (formerly on a props.js sea stack) now stands on the island's back headland.
import * as THREE from 'three';
import { toon } from '../toon.js';
import { HARBOR_ISLAND, PIER, PIER_ANGLES, pierUV, BERTHS, groundY, buildIsland, buildFarIsland, buildChest, buildPlants, buildFlowers, makeAtlas, shoreFoam, islandColliders, harborWalls, SPOTS, TORCHES, CRAB_SPOTS } from './art.js';
import { islandSurface, grassMaterial, detailTexture, buildBirds, buildCrabs, buildFlames, buildNets } from './look.js';
import { M, outlineMaterial } from './kit.js';

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
  // [look] textured island surface (detail layers, splat terrain, bump + rim on High), soft ramp, wind-swayed grass
  const MATS = { toon: islandSurface(toon(0xffffff, null, { vertexColors: true }), { low: LOW }), sway: islandSurface(toon(0xffffff, null, { vertexColors: true }), { low: LOW, uTime, sway: true }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), atlas: toon(0xffffff, atlas.tex, { side: THREE.DoubleSide }) };
  const texMB = (detailTexture(LOW).userData.bytes) / 1048576;
  const OUT = { plain: outlineMaterial(0.09), sway: outlineMaterial(0.09, uTime) };

  // moored toy galleons merged into the island mesh (0 extra draw calls); no real ships (no docking in this preview)
  const BERTH = Object.fromEntries(BERTHS().map(b => [b.id, b]));
  const DECOR = LOW ? ['P1R', 'P3L'] : ['P1R', 'P2L', 'P3R', 'P4L', 'P4R'];
  const nearKit = buildIsland({ low: LOW, atlas, decor: DECOR.map((id, i) => [BERTH[id].x, BERTH[id].z, BERTH[id].yaw, i]) });
  const far = buildFarIsland().build({ toon: MATS.toon }, OUT); far.visible = false;
  const plants = buildPlants(LOW, grassMaterial(toon(0xffffff, null, { vertexColors: true }), uTime)); plants.receiveShadow = !LOW;
  const foam = shoreFoam(uTime, LOW, ocean.uniforms.uWaves);
  const chest = new THREE.Group(), c0 = SPOTS.chest; chest.position.set(c0.x, groundY(c0.x, c0.z) + 1.15, c0.z); chest.rotation.y = -0.9;
  chest.add(buildChest(LOW, atlas).build(MATS, OUT));
  isle.add(far, plants, foam, chest);

  // ---- the harbor lighthouse, moved here from its sea stack: back headland (local -z, faces the open sea) ----
  let lz = -40; for (let z = -40; z >= -75; z -= 1) { if (groundY(0, z) >= 1.6) lz = z; else break; }
  const LH = { x: 0, z: lz, y: groundY(0, lz) - 0.3 }, S = 1.3;
  const lk = nearKit;
  lk.add(new THREE.CylinderGeometry(4.2, 5.2, 2.4, 12), 0x8d97a5, { m: M(LH.x, LH.y + 1.0, LH.z) });                 // stone plinth
  lk.add(new THREE.CylinderGeometry(2.2 * S, 3.2 * S, 16 * S, 12), 0xe9e2d0, { m: M(LH.x, LH.y + 8 * S, LH.z) });
  lk.add(new THREE.CylinderGeometry(2.55 * S, 2.75 * S, 3 * S, 12), 0xfa0d0d, { m: M(LH.x, LH.y + 9 * S, LH.z), outline: false });
  lk.add(new THREE.CylinderGeometry(2.7 * S, 2.7 * S, 0.5 * S, 12), 0x161616, { m: M(LH.x, LH.y + 16.2 * S, LH.z) });  // gallery
  lk.add(new THREE.ConeGeometry(2.8 * S, 3 * S, 12), 0x161616, { m: M(LH.x, LH.y + 21 * S, LH.z) });
  lk.add(new THREE.SphereGeometry(2.2 * S, 12, 8), 0xffd27a, { bucket: 'glow', m: M(LH.x, LH.y + 18 * S, LH.z), outline: false });
  const near = nearKit.build(MATS, OUT); near.name = 'island_near';
  near.traverse(o => { if (o.isMesh && !o.userData.outline && o.userData.bucket !== 'glow') { o.receiveShadow = !LOW; o.castShadow = !LOW; } });
  isle.add(near);
  // [look] life + fire: High = flowers, birds, crabs, flickering flames + 2 warm torch lights, nets; Low = birds only
  const extras = [], birds = buildBirds(LOW, uTime); isle.add(birds); extras.push(birds);
  const lights = [];
  if (!LOW) {
    const fl = buildFlowers(false, grassMaterial(toon(0xffffff, null, { vertexColors: true }), uTime)); isle.add(fl); extras.push(fl);
    const cr = buildCrabs(CRAB_SPOTS.slice(0, 10), uTime); isle.add(cr); extras.push(cr);
    const fm = buildFlames(TORCHES, uTime); isle.add(fm); extras.push(fm);
    const hz = (PIER.head0 + PIER.head1) / 2, netSpots = PIER_ANGLES.map((th) => ({ m: new THREE.Matrix4().makeRotationY(th).multiply(new THREE.Matrix4().makeTranslation(-PIER.headHalf + 8, PIER.y - 0.2, PIER.head1 + 0.1)) }));
    const nets = buildNets(netSpots); isle.add(nets); extras.push(nets);
    for (const [a, b] of [[0, 1], [2, 3]]) { const L = new THREE.PointLight(0xff9a3c, 0, 26, 1.7); L.position.set((TORCHES[a].x + TORCHES[b].x) / 2, TORCHES[a].y + 0.8, (TORCHES[a].z + TORCHES[b].z) / 2); isle.add(L); lights.push(L); }
  }
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
    plants.visible = lod === 'near'; foam.visible = lod !== 'far'; for (const e of extras) e.visible = lod === 'near' || (e === birds && lod === 'mid');
    near.traverse(o => { if (o.isMesh && !o.userData.outline && o.userData.bucket !== 'glow') o.castShadow = !LOW && lod === 'near'; });
  }
  return {
    group: isle, circles, bound, lighthouseWorld: W(LH.x, LH.z), texMB,
    get lod() { return lod; },
    setVisible(v) { on = v; isle.visible = v; },
    update(t, cam) {
      if (!on) return;
      setLod(Math.hypot(cam.x - HARBOR_ISLAND.x, cam.y, cam.z - HARBOR_ISLAND.z));
      beam.rotation.y = t * 0.8;
      for (let i = 0; i < lights.length; i++) lights[i].intensity = lod === 'near' ? 12 * (0.82 + 0.12 * Math.sin(t * 11 + i * 2) + 0.06 * Math.sin(t * 23 + i)) : 0; chest.position.y = groundY(c0.x, c0.z) + 1.15 + Math.sin(t * 2) * 0.12; chest.rotation.y = -0.9 + t * 0.4;
    },
  };
}
