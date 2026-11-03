// [Raul] PUMPFUN PIRATES island: standalone art / layout test scene (island.html). Not part of the game build or the service worker.
// URL: island.html?quality=high|low  &harbor=1 (place it in the BATTLE ROYALE harbor: storm sea, real rock islands, spawn
// overlay, AI duel, a ship sailing in to a jetty berth)  &view=<name>  &shot=1 (hide UI, freeze the clock)  &overlay=1 (layout +
// walkable area)  &full=1 (every berth filled)  &players=16 (players-to-scale markers on the plaza)  &lod (LOD in the lobby too)
// &walk=1 (get off at a pier as a pirate: WASD / arrows or tap-to-walk, drag to look; 4.2 m/s, Shift to run)
// &foot=1 (PHASE 1 blockout: the dock town becomes the tip of a massive on-foot island, js/island/foot.js, loaded only here)
//   &view=footMap|street|bridge|skull|cove|gallows|falls  &map=1 (2D review map)  &at=street (walker starts on the main street)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toon } from '../toon.js';
import { DEV } from '../env.js'; // [security L] viewer/test hooks on local dev servers only
import { createOcean, createSky, WAVES, FOG_COLOR } from '../ocean.js';
import { wind, makeSkullTexture, animateShip } from '../ships.js';
import { setCrewQuality } from '../crew.js';
import { compileShip } from '../upgradeVisuals.js';
import { getSkin } from '../skins.js';
import { createIslands } from '../props.js';
import { PVP_ARENA_R, ISLAND_TOKENS } from '../config.js';
import { copyText } from '../tokenChip.js';
import { isBase58 } from '../safe.js'; // [security] the DexScreener pair id goes into an iframe URL: base58 only
import { SPOTS, TOWER_H, TAVERN_S, HARBOR_ISLAND, PIER, PIER_ANGLES, pierUV, pierDecks, groundY, footY, canWalk, buildIsland, buildFarIsland, buildChest, buildPlants, buildPalmGrove, buildFx, lagoon, tokenSlots, ISLAND_POIS, makeAtlas, shoreFoam, islandColliders, BERTHS, harborWalls, walkable, scaleMarkers } from './art.js';
import { Kit, M } from './kit.js';
import { outlineMaterial, SWAY_DECL, SWAY_BODY } from './kit.js';
import { bakeShip } from './bake.js';
import { islandSurface } from './look.js';
import { loadTownKit, loadNatureKit, kitMesh } from './townkit.js';

const P = new URLSearchParams(location.search);
const phone = matchMedia('(max-width: 600px), (max-height: 520px)').matches;
const quality = P.get('quality') || (phone ? 'low' : 'high'), LOW = quality === 'low', SHOT = P.has('shot');
const WALK = P.has('walk');
const HARBOR = !!P.get('harbor') && P.get('harbor') !== '0', FULL = P.has('full'), NPLAYERS = +(P.get('players') || 0);
const COASTM = P.get('coast') === '1' && !HARBOR; // [coast] town built into the main island's west coast, no round dock island (js/island/coast.js)
const FOOT = (P.has('foot') || COASTM) && !HARBOR;
const FM = FOOT ? await import('./foot.js') : null; // the on-foot island module never loads in the harbor / ship view
if (SHOT) document.body.classList.add('shot');
document.getElementById('title').textContent = HARBOR ? 'PUMPFUN PIRATES · Island in the harbor' : FOOT ? 'PUMPFUN PIRATES · On-foot island' : 'PUMPFUN PIRATES · Island';

// ---------- renderer / scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.25 : 2));
renderer.setSize(innerWidth, innerHeight);
// lobby lighting presets (&light=golden | dusk): warm golden-hour haze, or dusk with the skull peak's eye caves lit
const LIGHTS = {
  golden: { fog: 0xf0c48e, fogD: 0.0026, hemi: [0xffdcae, 0x6f5a3a, 1.3], sun: [0xffb066, 2.7], dir: [90, 34, 70], top: 0x6d8fc4, exp: 1.08, glow: 1.6, smoke: 0xf3e2c8 },
  dusk: { fog: 0x8d6f8f, fogD: 0.0032, hemi: [0x9a8cc4, 0x2a2232, 1.05], sun: [0xff7a3a, 1.6], dir: [-95, 16, -30], top: 0x203566, exp: 1.0, glow: 3.0, smoke: 0x9c94a0 },
};
const LP = HARBOR ? null : LIGHTS[P.get('light')] || null;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = (HARBOR ? 1.2 : 1.15) * (LP ? LP.exp : 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
if (!LOW) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
const scene = new THREE.Scene();
const FOGC = HARBOR ? FOG_COLOR.clone() : new THREE.Color(LP ? LP.fog : 0x9ddcf2), FOGD = HARBOR ? 0.0042 : LP ? LP.fogD : FOOT ? (LOW ? 0.0026 : 0.0016) : 0.0021;
scene.fog = new THREE.FogExp2(FOGC, FOGD); scene.background = FOGC.clone();
const camera = new THREE.PerspectiveCamera(P.has('walk') ? 62 : HARBOR ? 55 : 46, innerWidth / innerHeight, 0.5, 3000);

// the island root: identity in the lobby scene, the harbor transform with ?harbor=1
const isle = new THREE.Group(); scene.add(isle);
if (HARBOR) { isle.position.set(HARBOR_ISLAND.x, 0, HARBOR_ISLAND.z); isle.rotation.y = HARBOR_ISLAND.yaw; }
if (FOOT) { isle.position.set(FM.TOWN.x, 0, FM.TOWN.z); isle.rotation.y = FM.TOWN.yaw; }
isle.updateMatrixWorld(true);
const L2W = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(isle.matrixWorld);

// lighting: harbor = the game's storm lighting; lobby = bright toy sunshine
scene.add(HARBOR ? new THREE.HemisphereLight(0x9fc2d4, 0x14262c, 1.9) : LP ? new THREE.HemisphereLight(...LP.hemi) : new THREE.HemisphereLight(0xcdeeff, 0x6f9a5a, 1.75));
const sun = HARBOR ? new THREE.DirectionalLight(0xffe2c4, 2.1) : LP ? new THREE.DirectionalLight(...LP.sun) : new THREE.DirectionalLight(0xfff0d6, 2.5);
const SUN_DIR = HARBOR ? new THREE.Vector3(-40, 50, 80) : LP ? new THREE.Vector3(...LP.dir) : new THREE.Vector3(55, 95, 62);
sun.position.copy(L2W(0, 0, 0)).add(SUN_DIR.clone().multiplyScalar(2)); sun.target.position.copy(L2W(0, 0, 0)); scene.add(sun, sun.target);
if (!LOW) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera, E = FOOT ? 80 : 112; sc.left = sc.bottom = -E; sc.right = sc.top = E; sc.near = 10; sc.far = FOOT ? 560 : 420; sun.shadow.bias = -0.0006; sun.shadow.normalBias = FOOT ? 0.25 : 0.4; sun.shadow.radius = 3; sc.updateProjectionMatrix(); }
const SUN_N = SUN_DIR.clone().normalize(), _sd = new THREE.Vector3();
// [light] on-foot High polish: warmer key, sky / bounce fill tuned to the jungle greens, a touch more exposure contrast
if (FOOT && !LP) { sun.color.set(0xffe9c8); sun.intensity = LOW ? 2.5 : 2.75; scene.children.filter(o => o.isHemisphereLight).forEach(h => { h.color.set(0xd6efff); h.groundColor.set(0x7a8f4e); h.intensity = LOW ? 1.75 : 1.6; });
  if (!LOW) renderer.toneMappingExposure = 1.12; }

// sky: the game's storm sky in the harbor, a sunny gradient dome in the lobby
let gameSky = null, lobbySky = null;
if (HARBOR) { gameSky = createSky(); scene.add(gameSky.mesh); }
else {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(LP ? LP.top : 0x1f86e0) }, uHor: { value: FOGC.clone() }, uSun: { value: SUN_DIR.clone().normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 uTop, uHor, uSun;
      void main(){ float h = clamp(vD.y, 0.0, 1.0); vec3 c = mix(uHor, uTop, pow(h, 0.55)); float s = max(dot(vD, uSun), 0.0);
        c += vec3(1.0, 0.92, 0.75) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.18); gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -10; scene.add(sky); lobbySky = sky;
}

// ---------- the game's ocean: full storm swell in the harbor, calmed to 0.32x in the lobby ----------
const CALM = HARBOR ? 1 : 0.32;
const ocean = createOcean(LOW ? 'low' : 'high'); ocean.mesh.renderOrder = 2; scene.add(ocean.mesh);
ocean.uniforms.uWaves.value.forEach(v => { v.z *= CALM; });
ocean.uniforms.uFogColor.value.copy(FOGC); ocean.uniforms.uFogDensity.value = FOGD; ocean.uniforms.uSun.value.copy(SUN_DIR).normalize();
const W = WAVES.map(([x, z, a, l]) => { const n = Math.hypot(x, z), k = 2 * Math.PI / l; return { dx: x / n, dz: z / n, a: a * CALM, k, w: Math.sqrt(9.8 * k) }; });
const waveH = (x, z, t) => { let h = 0; for (const v of W) h += v.a * Math.sin(v.k * (v.dx * x + v.dz * z) - v.w * t); return h; };

// ---------- island: near / mid (same merged meshes, outlines + sparkles off) / far (one silhouette mesh) ----------
const uTime = { value: 0 };
const skull = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/skull_transparent.png'; });
await document.fonts.load('40px "Just Another Hand"').catch(() => {});
const atlas = makeAtlas(skull);
// [look] textured surface + soft ramp (js/island/look.js)
const MATS = {
  toon: islandSurface(toon(0xffffff, null, { vertexColors: true }), { low: LOW }),
  sway: islandSurface(toon(0xffffff, null, { vertexColors: true }), { low: LOW, uTime, sway: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color().setScalar(LP ? LP.glow : 1) }), // lanterns, windows, the peak's eye caves
  atlas: toon(0xffffff, atlas.tex), // FrontSide: text never shows mirrored; two-sided signs / flags carry a back face
};
const OUT = { plain: outlineMaterial(0.09), sway: outlineMaterial(0.09, uTime) };
// moored fleet: real baked game ships on a few berths (Low 1, High 2, full 3), toy galleons merged into the island mesh on
// others (0 extra draw calls; Low 3, High 8, full = every berth). The approach ship's berth P1L stays free in the harbor.
const BERTH = Object.fromEntries(BERTHS().map(b => [b.id, b]));
const REAL = FULL ? ['P4R', 'P2R', 'P3L'] : ['P4R']; // High keeps ~1 baked ship (lobby < 60 calls); its extra fleet is decor
const DECOR = FULL || FOOT ? BERTHS().map(b => b.id).filter(id => !REAL.includes(id) && !(HARBOR && id === 'P1L')) : LOW ? ['P1R', 'P3L'] : ['P1R', 'P2L', 'P3R', 'P4L'];
const decor = DECOR.map((id, i) => [BERTH[id].x, BERTH[id].z, BERTH[id].yaw, i]);
// [kit] Blender town kit (assets/island/town_kit*.glb): pier modules + pier props here, houses / street props on foot (&kit=0 = procedural)
const KIT = P.get('kit') === '0' ? null : await loadTownKit(LOW, renderer).catch(e => { console.warn('town kit failed', e); return null; });
// [nature] Blender nature kit (palms, jungle trees, ferns, rocks / cliffs, Skull Peak): on foot only (&nature=0 = procedural)
const NAT = FOOT && P.get('nature') !== '0' && KIT ? await loadNatureKit(LOW, renderer).catch(e => { console.warn('nature kit failed', e); return null; }) : null;
const kitP = KIT ? [] : null;
const near = buildIsland({ low: LOW, atlas, decor, kitP, foot: FOOT }).build(MATS, OUT); near.name = 'island_near';
if (KIT) { const km = kitMesh(KIT, kitP, 'island_townkit'); if (km) near.add(km); }
near.traverse(o => { if (o.isMesh && !o.userData.outline && o.userData.bucket !== 'glow') { o.castShadow = !LOW; o.receiveShadow = !LOW; } });
const far = buildFarIsland().build({ toon: MATS.toon }, OUT); far.name = 'island_far'; far.visible = false;
const plants = buildPlants(LOW, MATS.toon); plants.receiveShadow = !LOW;
const foam = shoreFoam(uTime, LOW, ocean.uniforms.uWaves);
const lagoonMesh = lagoon(uTime, ocean.uniforms.uWaves, LOW);                   // turquoise shallows + pier foam (1 call)
const grove = buildPalmGrove(LOW, MATS.toon); grove.castShadow = !LOW;          // instanced palms (1 call)
const fx = buildFx(uTime, LOW); if (LP) fx.material.uniforms.uSmoke.value.set(LP.smoke); // gulls + smoke (1 call)
const setFxPx = () => { fx.material.uniforms.uPx.value = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); }; setFxPx();
isle.add(near, far, foam, plants, lagoonMesh, grove, fx);
if (COASTM) isle.visible = false; // the round Dock Town island is not part of the coast layout (kept only as the town frame)
// on-foot island (blockout): chunked heightmap terrain, streamed jungle, main street + inland POIs
if (FOOT) await FM.PV?.plazaShopsReady?.(LOW); // [Timothy] Blender storefront models (plaza v2)
const foot = FOOT ? FM.createFoot({ scene, isle, MATS, OUT, low: LOW, atlas, uTime, uWaves: ocean.uniforms.uWaves, renderer, kit: KIT, nat: NAT }) : null;
const _fw = new THREE.Vector3();
const fY = FOOT ? (x, z) => { _fw.set(x, 0, z).applyMatrix4(isle.matrixWorld); return COASTM ? foot.groundAt(_fw.x, _fw.z) : Math.max(footY(x, z), foot.groundAt(_fw.x, _fw.z)); } : footY;
const cW = FOOT ? (x, z) => fY(x, z) >= 0.8 : canWalk;
const _fw2 = new THREE.Vector3();
// [foot] world-space solids, water, slope limit and the bounded rope bridge (js/island/foot.js); x,z are town-local
const footBlocked = FOOT ? (x, z, fx, fz) => { _fw.set(x, 0, z).applyMatrix4(isle.matrixWorld); if (footY(x, z) > foot.H(_fw.x, _fw.z) + 0.3) return false; // the dock town deck
  _fw2.set(fx ?? x, 0, fz ?? z).applyMatrix4(isle.matrixWorld); return foot.blocked(_fw.x, _fw.z, fx === undefined ? undefined : _fw2.x, fx === undefined ? undefined : _fw2.z); } : null;

// daily-reward chest: bobbing chest + light beam (a beacon you can spot from sea) + sparkles
const chest = new THREE.Group(); const cs = SPOTS.chest, cy = groundY(cs.x, cs.z) + 1.15;
chest.position.set(cs.x, cy, cs.z); chest.rotation.y = -0.9;
chest.add(buildChest(LOW, atlas).build(MATS, OUT)); isle.add(chest);
const beamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `varying vec2 vUv; uniform float uTime;
    void main(){ float a = (1.0 - vUv.y) * (0.55 + 0.25 * sin(uTime * 2.5)) * (0.7 + 0.3 * sin(vUv.x * 37.7 + uTime * 3.0));
      gl_FragColor = vec4(vec3(1.0, 0.82, 0.35) * a, a); }`,
});
const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.6, 22, 20, 1, true), beamMat); beam.position.set(cs.x, cy + 11, cs.z); beam.renderOrder = 4; isle.add(beam);
let sparks = null;
if (!LOW) {
  const N = 60, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 5; pos[i * 3 + 2] = (Math.random() - 0.5) * 5; seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  sparks = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float aSeed; uniform float uTime, uPx; varying float vA;
      void main(){ float t = fract(uTime * 0.25 + aSeed); vec3 p = position; p.y = t * 14.0; p.xz *= 1.0 - t * 0.5; vA = sin(t * 3.14159);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (5.0 + 5.0 * aSeed) * uPx * (60.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(1.0, 0.85, 0.4) * a, a); }',
  }));
  sparks.position.set(cs.x, cy, cs.z); sparks.frustumCulled = false; isle.add(sparks);
}
// LOD by camera distance to the island centre (hysteresis so it never flickers on the boundary)
const LOD_NEAR = 200, LOD_FAR = 310, HYST = 12; let lod = 'near';
const outlines = []; near.traverse(o => { if (o.userData.outline) outlines.push(o); }); chest.traverse(o => { if (o.userData.outline) outlines.push(o); });
function setLod(d) {
  const want = d > LOD_FAR + (lod === 'far' ? -HYST : HYST) ? 'far' : d > LOD_NEAR + (lod === 'near' ? HYST : -HYST) ? 'mid' : 'near';
  if (want === lod && setLod.done) return; lod = want; setLod.done = true;
  near.visible = chest.visible = lod !== 'far'; far.visible = lod === 'far';
  for (const o of outlines) o.visible = lod === 'near';
  if (sparks) sparks.visible = lod === 'near'; foam.visible = lod !== 'far'; plants.visible = lod === 'near'; lagoonMesh.visible = grove.visible = lod !== 'far';
  near.traverse(o => { if (o.isMesh && !o.userData.outline && o.userData.bucket !== 'glow') o.castShadow = !LOW && lod === 'near'; });
}

// ---------- ships (the real game ship compiler) ----------
setCrewQuality(LOW ? 'low' : 'high', phone);
const flagTex = skull ? makeSkullTexture(skull, { w: 512, h: 340, pad: 0.1 }) : null;
const sailTex = skull ? makeSkullTexture(skull, { w: 512, h: 400, bg: '#121212', pad: 0.14 }) : null;
const mkShip = (levels, skin, bake) => {
  const mesh = compileShip(levels, { mainSailMap: sailTex, flagMap: flagTex, light: false, shadows: false, quality: LOW ? 'low' : 'high', skin: getSkin(skin) });
  if (bake) { for (let k = 0; k < 90; k++) animateShip(mesh, 0, 0.5); bakeShip(mesh); } // moored: static parts merged per material
  mesh.traverse(o => { o.castShadow = false; }); scene.add(mesh); return mesh;
};
const ships = [];
// real moored ships: Q1E is a maxed hull 3 (len 20.4, the longest a berth takes)
const REAL_KIT = [[{ hull: 3, sails: 1, cannons: 1, armor: 1 }, 'golden'], [{ hull: 2, sails: 1, cannons: 1 }, 'midnight'], [{ hull: 1, sails: 1 }, 'blood']];
const CB = COASTM ? Object.fromEntries(FM.CO.COAST_BERTHS.map(b => [b.id, b])) : null;
(COASTM ? ['P4'] : REAL).forEach((id, i) => { const b = BERTH[id], w = COASTM ? new THREE.Vector3(CB[id].x, 0, CB[id].z) : L2W(b.x, 0, b.z);
  ships.push({ mesh: mkShip(REAL_KIT[i][0], REAL_KIT[i][1], true), x: w.x, z: w.z, yaw: COASTM ? CB[id].yaw : b.yaw + isle.rotation.y, sail: 0.5, ph: i, moored: true, berth: id }); });
let approach = null; const duel = [];
if (HARBOR) {
  // a ship sailing in from open water and pulling alongside berth P1L (the harbor-facing end of pier 1; 40 s loop)
  approach = { mesh: mkShip({ hull: 1, sails: 1 }, 'classic', false), x: 0, z: 0, yaw: 0, sail: 1, ph: 1.3 }; ships.push(approach);
  // two AI-style ships duelling out in the harbor, in view of the beach / dock / terrace / lookout
  if (!LOW) for (let i = 0; i < 2; i++) { const s = { mesh: mkShip({ hull: i, cannons: 1 }, i ? 'blood' : 'midnight', false), x: 0, z: 0, yaw: 0, sail: 1, ph: i * 2.1 }; duel.push(s); ships.push(s); }
}
function approachPose(t) { // local frame: runs in along the head face of pier 1 (from 70 back, 14 further out), then a 12 s stop
  const b = BERTH.P1L, { u, v } = pierUV(PIER_ANGLES[0]), T = 40, p = (t % T) / T, k = Math.min(1, p / 0.7), e = 1 - Math.pow(1 - k, 2.2);
  const back = 70 * (1 - e), out = 14 * (1 - e) * (1 - e) + Math.sin(k * Math.PI) * 2 * (1 - k);
  return { x: b.x - v[0] * back + u[0] * out, z: b.z - v[1] * back + u[1] * out, yaw: b.yaw - 0.25 * (1 - e) * (1 - e), speed: (1 - k) * 9 };
}
const DUEL_C = new THREE.Vector3(HARBOR_ISLAND.x * 0.42, 0, HARBOR_ISLAND.z * 0.42); // harbor water ~150 off the beach
// [v84] keep water out of the hulls: same plane cap the game uses (ocean uHullY), read off each ship's water-mask lid
const _hc = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
function hullCap(s, out) {
  const ud = s.mesh.userData;
  if (ud.capLid === undefined) { ud.capLid = null; s.mesh.traverse(o => { if (!ud.capLid && o.userData.waterMask && o.geometry) ud.capLid = o; });
    if (ud.capLid) { const Pp = ud.capLid.geometry.attributes.position; let mn = Infinity; for (let i = 0; i < Pp.count; i++) mn = Math.min(mn, Pp.getY(i)); ud.capLid.userData.capY = mn; } }
  const lid = ud.capLid; if (!lid) { out.set(0, 0, 0, 0); return; }
  lid.updateWorldMatrix(true, false);
  const y = lid.userData.capY, [p0, pf, px] = _hc;
  p0.set(0, y, 0).applyMatrix4(lid.matrixWorld); pf.set(0, y, 1).applyMatrix4(lid.matrixWorld); px.set(1, y, 0).applyMatrix4(lid.matrixWorld);
  const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), xx = Math.cos(s.yaw), xz = -Math.sin(s.yaw);
  const dF = (pf.x - p0.x) * fx + (pf.z - p0.z) * fz, dX = (px.x - p0.x) * xx + (px.z - p0.z) * xz;
  const sF = Math.abs(dF) > 1e-4 ? (pf.y - p0.y) / dF : 0, sX = Math.abs(dX) > 1e-4 ? (px.y - p0.y) / dX : 0;
  const oF = (p0.x - s.x) * fx + (p0.z - s.z) * fz, oX = (p0.x - s.x) * xx + (p0.z - s.z) * xz;
  if (!lid.geometry.boundingBox) lid.geometry.computeBoundingBox();
  out.set(p0.y - sF * oF - sX * oX, sF, sX, Math.max(ud.beam * 0.5, Math.hypot(px.x - p0.x, px.z - p0.z) * lid.geometry.boundingBox.max.x));
}
function floatShips(t) {
  if (approach) { const a = approachPose(t), w = L2W(a.x, 0, a.z); approach.x = w.x; approach.z = w.z; approach.yaw = a.yaw + isle.rotation.y; approach.speed = a.speed; }
  duel.forEach((s, i) => { const a = t * 0.12 + i * Math.PI, R = 34; s.x = DUEL_C.x + Math.cos(a) * R; s.z = DUEL_C.z + Math.sin(a) * R; s.yaw = Math.atan2(-Math.sin(a), Math.cos(a)) + (i ? 0.25 : -0.25); s.speed = 7; });
  ships.forEach((s, k) => {
    const L = s.mesh.userData.len * 0.4, B = s.mesh.userData.beam * 0.5, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    const hF = waveH(s.x + fx * L, s.z + fz * L, t), hA = waveH(s.x - fx * L, s.z - fz * L, t), hP = waveH(s.x + fz * B, s.z - fx * B, t), hS = waveH(s.x - fz * B, s.z + fx * B, t);
    s.mesh.position.set(s.x, (hF + hA + hP + hS) / 4, s.z);
    s.mesh.rotation.set(Math.atan2(hA - hF, 2 * L) * 0.8, s.yaw, Math.atan2(hS - hP, 2 * B) * 0.6, 'YXZ');
    animateShip(s.mesh, t + s.ph, s.sail);
    if (k < 12) { ocean.uniforms.uHulls.value[k].set(s.x, s.z, s.yaw, s.mesh.userData.len); ocean.uniforms.uHullV.value[k] = s.speed || 0; hullCap(s, ocean.uniforms.uHullY.value[k]); }
  });
  ocean.uniforms.uHullCount.value = Math.min(12, ships.length);
}

// ---------- layout overlay: world (arena rings, spawns, respawns) + island-local (walkable, berths, walls, colliders, lanes) ----------
let rocks = null, overlay = null;
const WALKAREA = walkable(LOW ? 4 : 3);
const lines = (seg, col) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const o = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, fog: false, depthTest: false, transparent: true, opacity: 0.95 })); o.renderOrder = 9; return o; };
const mkRing = (seg, col) => (cx, cz, r, c, n = 64, y = 1) => { for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; seg.push(cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r); col.push(...c.toArray(), ...c.toArray()); } };
const C = (h) => new THREE.Color(h);
const localOverlay = (() => {
  const seg = [], col = [], ring = mkRing(seg, col), line = (x0, z0, x1, z1, c, y = 1.3) => { seg.push(x0, y, z0, x1, y, z1); col.push(...c.toArray(), ...c.toArray()); };
  const walkC = C(0xff2bd6); for (const [x0, z0, x1, z1] of WALKAREA.seg) line(x0, z0, x1, z1, walkC, 4.5);                        // walkable outline (land + decks)
  ring(SPOTS.plaza.x, SPOTS.plaza.z, SPOTS.plaza.r, C(0xfde047), 48, 5);                                                         // plaza (on-foot lobby)
  for (const d of SPOTS.digs) ring(d.x, d.z, 5, C(0xfb923c), 16, 5);
  for (const c of islandColliders()) ring(c.x, c.z, c.r, C(0xffffff), 24);
  for (const w of harborWalls()) { line(w.x0, w.z0, w.x1, w.z1, C(0xff8a00), 1.5); }
  const POIC = { spawn: 0x60a5fa, sail: 0x22d3ee, waves: 0xf59e0b, arena: 0xef4444, spectate: 0xa855f7 }; // future interact points (empty)
  for (const q of ISLAND_POIS) { const c = C(POIC[q.id]); for (const rr of [q.r, q.r + 1.2]) ring(q.x, q.z, rr, c, 20, 5); line(q.x - 4, q.z, q.x + 4, q.z, c, 5); line(q.x, q.z - 4, q.x, q.z + 4, c, 5); }
  for (const b of BERTHS()) { const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), c = C(0x67e8f9), Q = [[-3.65, -11], [3.65, -11], [3.65, 11], [-3.65, 11]].map(([sx, sf]) => [b.x + fz * sx + fx * sf, b.z - fx * sx + fz * sf]);
    for (let i = 0; i < 4; i++) line(...Q[i], ...Q[(i + 1) % 4], c);
    ring(b.x, b.z, 8.6, C(0x38bdf8), 20, 1.1); }
  const lane = C(0x93c5fd); for (const th of PIER_ANGLES) { const { u, v } = pierUV(th); for (const sx of [-1, 1]) { const x0 = u[0] * (PIER.berthD + 13) + v[0] * sx * 40, z0 = u[1] * (PIER.berthD + 13) + v[1] * sx * 40; line(x0, z0, x0 + u[0] * 30, z0 + u[1] * 30, lane); } } // approach lanes past each head
  for (const d of pierDecks()) { const { u, v } = pierUV(d.th); for (const [x0, z0, x1, z1] of d.rects) { const P4 = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([a, b]) => [v[0] * a + u[0] * b, v[1] * a + u[1] * b]); for (let i = 0; i < 4; i++) line(...P4[i], ...P4[(i + 1) % 4], C(0xff2bd6), 4.5); } }
  const o = lines(seg, col); o.visible = false; isle.add(o); return o;
})();
if (HARBOR) {
  rocks = createIslands(LOW ? 'low' : 'high'); scene.add(rocks.group);
  const seg = [], col = [], ring = mkRing(seg, col);
  ring(0, 0, PVP_ARENA_R, C(0xff3030), 128); ring(0, 0, 370, C(0xff9a3a), 128); ring(0, 0, PVP_ARENA_R * 0.82, C(0xfbbf24), 128);
  for (const r of [40, 85, 130]) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ring(Math.cos(a) * r, Math.sin(a) * r, 3, C(0x4ade80), 8); } // harbor death respawns
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; ring(Math.cos(a) * PVP_ARENA_R * 0.82, Math.sin(a) * PVP_ARENA_R * 0.82, 6, C(0xfbbf24), 10); } // AI / boss spawns
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * 6.283; ring(Math.cos(a) * PVP_ARENA_R * 0.42, Math.sin(a) * PVP_ARENA_R * 0.42, 6, C(0xfbbf24), 10); }
  ring(0, 0, 8, C(0x60a5fa), 16); // player harbor spawn
  overlay = lines(seg, col); overlay.visible = false; scene.add(overlay);
}
// players-to-scale markers on the plaza (one merged mesh, 2-3 calls)
let markers = null;
if (NPLAYERS) { markers = scaleMarkers(NPLAYERS).build(MATS, OUT); isle.add(markers); }

// ---------- camera views (island-local; transformed into the harbor with ?harbor=1) ----------
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 4; controls.maxDistance = 1200; controls.maxPolarAngle = 1.5; controls.enablePan = true;
controls.autoRotateSpeed = 0.45;
if (FOOT) controls.maxPolarAngle = Math.PI / 2 + 0.35; // eye-level views look up hills
const gy = (s) => groundY(s.x, s.z);
const T = SPOTS.tavern, TW = SPOTS.tower, deckY = gy(T) - 0.3 + 1.65 * TAVERN_S, towerTop = gy(TW) - 0.4 + TOWER_H + 0.5;
const D0 = SPOTS.digs[0], BD = SPOTS.board;
const EYE = PIER.y + 0.2 + 1.55; // a pirate's eye on a pier deck
const VIEWS = {
  hero: { p: [-150, 100, 175], t: [0, 0, 0] },
  concept: { p: [78, 24, 128], t: [-18, 9, -16] },                                // the angle of concept 1 (low over the shallows, town + fort up the hill)
  duskBeach: { p: [-12, 5.2, 56], t: [-36, 26, -44] },                            // from the harbor-side beach towards the skull peak
  exchange: { p: [0, 6.5, 30], t: [0, 3.5, 47] },
  seaNear: { p: [40, 10, 178], t: [0, 8, 0] },
  seaMid: { p: [70, 16, 262], t: [0, 6, 0] },
  seaFar: { p: [40, 20, 330], t: [0, 6, 0] },
  fullHarbor: { p: [-40, 70, 175], t: [0, 0, 30] },
  docked: { p: [-91, 12, 98], t: [-47, 4, 81] },
  dockDeck: { p: [-61, EYE + 2, 66], t: [-47, 4, 81] },
  disembark: { p: [40, EYE, 69.3], t: [0, 3.2, -8] },
  plaza: { p: [16, 13, 52], t: [0, 3, 18] },
  market: { p: [-4, 6, 42], t: [27, 4, 26] },
  hillPath: { p: [-10, 10, 26], t: [-40, 13, -12] },
  terrace: { p: [T.x, deckY + 2.2, T.z + 12.6 * TAVERN_S], t: [0, 2, 240] },
  lookout: { p: [TW.x + 0.5, towerTop + 2.4, TW.z + 2.3], t: [0, 0, 240] },
  tower: { p: [TW.x + 26, 18, TW.z + 30], t: [TW.x, gy(TW) + 11, TW.z] },
  tavern: { p: [T.x + 10, deckY + 8, T.z + 34], t: [T.x, deckY + 5, T.z] },
  jungle: { p: [66, 9, 18], t: [44, 5, -8] },
  beach: { p: [2, 9, -68], t: [18, 2, -46] },
  dig: { p: [D0.x + 12, gy(D0) + 9, D0.z + 14], t: [D0.x, gy(D0) + 1, D0.z] },
  chest: { p: [cs.x - 12, gy(cs) + 8, cs.z + 16], t: [cs.x, gy(cs) + 3, cs.z] },
  board: { p: [BD.x - 16, gy(BD) + 6, BD.z + 4], t: [BD.x, gy(BD) + 3.5, BD.z] },
  top: { p: [0.01, 260, 0], t: [0, 0, 0] },
};
if (!HARBOR && (innerWidth / innerHeight > 1.9 || phone)) VIEWS.hero = { p: [-135, 90, 160], t: [0, 0, 5] };
const WORLD_VIEWS = HARBOR ? { harborTop: { p: [0.01, 1050, 0], t: [0, 0, 0] }, spawn: { p: [0, 12, -30], t: [HARBOR_ISLAND.x, 8, HARBOR_ISLAND.z] } } : {};
if (FOOT) { // world-frame views on the big island: eye level = ground + 1.7 m
  const E = (x, z, up = 1.7) => [x, foot.H(x, z) + up, z], T = (lx, lz) => FM.townToWorld(lx, lz), Q = Object.fromEntries(foot.pois.map(q => [q.id, q]));
  const [s0x, s0z] = T(6, -62), [s1x, s1z] = T(6, -200), br = Q.bridge, sk = Q.skullpeak, cv = Q.cove, gl = Q.gallows, fl = Q.falls;
  Object.assign(WORLD_VIEWS, {
    footMap: { p: [-90, 2350, -19.99], t: [-90, 0, -20] },
    ...(COASTM ? (() => { const C = FM.CO, [cx, cz] = C.t2w(-95, 100), [tx, tz] = C.t2w(25, -125), [hx, hz] = C.HC;
      return { coast34: { p: [cx, 34, cz], t: [tx, 17, tz] }, coastTop: { p: [hx + 190, 1500, hz + 0.01], t: [hx + 190, 0, hz] } }; })() : {}),
    street: { p: [s0x, Math.max(foot.H(s0x, s0z), groundY(6, -62)) + 1.8, s0z], t: [s1x, foot.H(s1x, s1z) + 7, s1z] },       // arrival: up the main street
    harborFromStreet: { p: E(...T(6, -120), 22), t: [FM.TOWN.x, 4, FM.TOWN.z] },
    bridge: { p: [br.x + 75, br.deck + 3, br.z + 12], t: [br.x, br.deck - 6, br.z] },
    skull: { p: sk.view, t: [sk.x, sk.ty, sk.z] },
    cove: { p: E(cv.x + 60, cv.z - 40, 2), t: [cv.x, 0, cv.z] },
    gallows: { p: gl.view, t: [gl.x, gl.ty, gl.z] },
    falls: { p: fl.view, t: [fl.x, fl.ty, fl.z - 4] },
    squadSign: (() => { const q = FM.INTERACT.find(i => i.id === 'squadhall'), [lx, lz] = FM.worldToTown(q.x, q.z), [cx, cz] = T(lx - 10, lz + 2), [sx, sz] = T(lx + 1.6, lz);
      return { p: [cx, foot.H(cx, cz) + 2.4, cz], t: [sx, foot.H(sx, sz) + 8.6, sz] }; })(),                                                   // close-up: the SQUAD HALL facade sign
    lighthouse: (() => { const q = Q.lighthouse; return { p: E(q.x + 46, q.z + 30, 5), t: [q.x, q.y + 15, q.z] }; })(),
    fort: (() => { const t = SPOTS.tower, a = L2W(t.x - 34, groundY(t.x, t.z) + 14, t.z + 30), b = L2W(t.x, groundY(t.x, t.z) + 9, t.z); return { p: [a.x, a.y, a.z], t: [b.x, b.y, b.z] }; })(),
    footDig: (() => { const d = foot.digs[0]; return { p: E(d.x + 5.5, d.z + 4.5, 3.2), t: [d.x, d.y + 0.6, d.z] }; })(),
    footBeach: (() => { const d = foot.digs[1]; let best = null; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, h = foot.H(d.x + Math.cos(a) * 30, d.z + Math.sin(a) * 30); if (!best || h < best.h) best = { a, h }; }
      const c = Math.cos(best.a), s = Math.sin(best.a); return { p: E(d.x - c * 6 + s * 8, d.z - s * 6 - c * 8, 1.6), t: [d.x + c * 30, 0.4, d.z + s * 30] }; })(),
  });
}
let tween = null, curView = 'hero';
function resolve(name) {
  if (WORLD_VIEWS[name]) return { p: new THREE.Vector3(...WORLD_VIEWS[name].p), t: new THREE.Vector3(...WORLD_VIEWS[name].t) };
  const v = VIEWS[name] || VIEWS.hero; return { p: L2W(...v.p), t: L2W(...v.t) };
}
function goView(name, instant = false) {
  curView = name; controls.autoRotate = name === 'hero' && !SHOT;
  const to = resolve(name), top = name === 'harborTop' || name === 'footMap' || name === 'coastTop';
  if (overlay) overlay.visible = top || P.has('overlay'); localOverlay.visible = top || P.has('overlay');
  if (gameSky) gameSky.mesh.visible = !top; if (lobbySky) lobbySky.visible = !top; scene.background = top ? new THREE.Color(FOOT ? 0x1f6e94 : 0x0e2a36) : FOGC.clone(); if (FOOT) ocean.mesh.scale.setScalar(top ? 2.4 : 1);
  scene.fog.density = top ? 0 : FOGD; ocean.uniforms.uFogDensity.value = top ? 0 : FOGD; // top-down layout map: no fog
  if (instant) { camera.position.copy(to.p); controls.target.copy(to.t); controls.update(); tween = null; }
  else tween = { from: { p: camera.position.clone(), t: controls.target.clone() }, to, k: 0 };
  document.querySelectorAll('#ui button[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === name));
}
const ui = document.getElementById('ui');
const VIEW_NAMES = [...Object.keys(VIEWS), ...Object.keys(WORLD_VIEWS)];
if (innerHeight < 520 || innerWidth < 600) { // phones: one cycling VIEW button instead of a wall of buttons
  const b = document.createElement('button'); const label = () => { b.textContent = 'VIEW: ' + curView.toUpperCase() + ' ▸'; };
  b.onclick = () => { goView(VIEW_NAMES[(VIEW_NAMES.indexOf(curView) + 1) % VIEW_NAMES.length]); label(); }; ui.appendChild(b); setTimeout(label, 0);
} else for (const v of VIEW_NAMES) { const b = document.createElement('button'); b.textContent = v.toUpperCase(); b.dataset.v = v; b.onclick = () => goView(v); ui.appendChild(b); }
{ const b = document.createElement('button'); b.textContent = 'QUALITY: ' + quality.toUpperCase(); b.onclick = () => { P.set('quality', LOW ? 'high' : 'low'); location.search = P.toString(); }; ui.appendChild(b); }
{ const b = document.createElement('button'); b.textContent = HARBOR ? 'LOBBY VIEW' : 'IN THE HARBOR'; b.onclick = () => { if (HARBOR) P.delete('harbor'); else P.set('harbor', '1'); location.search = P.toString(); }; ui.appendChild(b); }
controls.addEventListener('start', () => { tween = null; controls.autoRotate = false; });
goView(P.get('view') || 'hero', true);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); setFxPx(); });

// ---------- on foot (&walk=1): get off at pier 1 as a pirate and walk the island ----------
// 4.2 m/s walking (Shift 6.5 running): the island is ~146 m across (~35 s to cross), the docks-ring path ~370 m (~90 s).
let walker = null;
if (WALK) {
  const k = new Kit(), skin = 0xf2c9a0;
  k.add(new THREE.CylinderGeometry(0.17, 0.2, 0.75, 8), 0x2b2f36, { m: M(-0.17, 0.37, 0) }); k.add(new THREE.CylinderGeometry(0.17, 0.2, 0.75, 8), 0x2b2f36, { m: M(0.17, 0.37, 0) });
  k.add(new THREE.CylinderGeometry(0.36, 0.42, 0.75, 10), 0xfa0d0d, { m: M(0, 1.05, 0) });                       // coat
  k.add(new THREE.CylinderGeometry(0.43, 0.43, 0.12, 10), 0x161616, { m: M(0, 0.8, 0), outline: false });           // belt
  k.add(new THREE.BoxGeometry(0.14, 0.12, 0.05), 0xffc93c, { m: M(0, 0.8, 0.43), outline: false });
  k.add(new THREE.SphereGeometry(0.36, 12, 10), skin, { m: M(0, 1.6, 0) });                                         // head
  k.add(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 12), 0x161616, { m: M(0, 1.83, 0) }); k.add(new THREE.CylinderGeometry(0.26, 0.36, 0.28, 10), 0x161616, { m: M(0, 1.96, 0) }); // tricorne-ish hat
  k.add(new THREE.BoxGeometry(0.2, 0.08, 0.04), 0x161616, { m: M(0.13, 1.66, 0.33), outline: false });               // eyepatch strap
  for (const sx of [-1, 1]) k.add(new THREE.CylinderGeometry(0.1, 0.11, 0.6, 6), 0xfa0d0d, { m: M(sx * 0.45, 1.1, 0, 0, 0, sx * 0.25) });
  const mesh = k.build(MATS, OUT); mesh.name = 'pirate'; isle.add(mesh);
  const { u } = pierUV(PIER_ANGLES[0]), yaw = Math.atan2(-u[0], -u[1]);
  const atEx = P.get('at') === 'exchange', S0 = tokenSlots()[0], atSt = FOOT && P.get('at') === 'street';
  walker = { mesh, x: atSt ? 6 : atEx ? S0.x : u[0] * 80, z: atSt ? -56 : atEx ? S0.z - 3 : u[1] * 80, yaw: atSt ? Math.PI : atEx ? 0 : yaw, camYaw: atSt ? Math.PI : atEx ? 0 : yaw, pitch: 0.12, target: null, keys: {}, ph: 0, drag: null };
  controls.enabled = false; controls.autoRotate = false;
  addEventListener('keydown', e => { walker.keys[e.code] = true; }); addEventListener('keyup', e => { walker.keys[e.code] = false; });
  const BLOCK = [{ ...SPOTS.tavern, r: 9.5 }, { ...SPOTS.tower, r: 5 }, { ...SPOTS.peak, r: 15 }, { x: SPOTS.exchange.x, z: SPOTS.exchange.z - 1, r: 3.6 }, ...SPOTS.houses.map(([x, z]) => ({ x, z, r: 3.4 })), ...ISLAND_POIS.filter(q => q.id === 'waves' || q.id === 'arena').map(q => ({ x: q.x, z: q.z, r: 1.4 })), { ...SPOTS.chest, r: 5 }, { ...SPOTS.flag, r: 1.6 }, ...SPOTS.stalls.map(q => ({ ...q, r: 3 }))];
  walker.blocked = FOOT ? (x, z) => footBlocked(x, z, walker.x, walker.z) : (x, z) => !cW(x, z) || BLOCK.some(b => Math.hypot(b.x - x, b.z - z) < b.r);
  canvas.addEventListener('pointerdown', e => { walker.drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointermove', e => { const d = walker.drag; if (!d) return; walker.camYaw -= (e.clientX - d.x) * 0.006; walker.pitch = Math.min(0.9, Math.max(-0.25, walker.pitch + (e.clientY - d.y) * 0.004)); d.x = e.clientX; d.y = e.clientY; walker.look = performance.now(); });
  canvas.addEventListener('pointerup', e => { const d = walker.drag; walker.drag = null; if (!d || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) return;
    const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
    const inv = isle.matrixWorld.clone().invert(), o = rc.ray.origin.clone().applyMatrix4(inv), dir = rc.ray.direction.clone().transformDirection(inv);
    for (let t = 0; t < 400; t += 0.4) { const q = o.clone().addScaledVector(dir, t); if (q.y <= fY(q.x, q.z)) { if (!(FOOT ? footBlocked(q.x, q.z) : walker.blocked(q.x, q.z))) walker.target = { x: q.x, z: q.z }; break; } } });
}
// ---------- TOKEN EXCHANGE: live boards ($SUNK / $AHOY / $PUMP; main pair = the highest-liquidity Solana pair from the
// DexScreener tokens API, refreshed every 60 s) + a chart panel opened from the walk-mode interact prompt (or &token=SYM)
const TOK = ISLAND_TOKENS.map(t => ({ ...t, chart: t.dex || t.site, pair: null }));
const fmtP = (v) => { v = +v; if (!isFinite(v) || v <= 0) return '—'; if (v >= 1) return '$' + v.toFixed(3); return '$' + v.toFixed(Math.min(10, 3 - Math.floor(Math.log10(v)))); };
const fmtUsd = (v) => v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? '$' + (v / 1e3).toFixed(1) + 'K' : '$' + Math.round(v || 0);
const statLine = (t) => { const p = t.pair; if (!p) return 'live price loading…'; const ch = +(p.priceChange?.h24 ?? 0); return `${fmtP(p.priceUsd)} · 24h ${ch >= 0 ? '+' : ''}${ch.toFixed(1)}% · liq ${fmtUsd(p.liquidity?.usd)} · vol ${fmtUsd(p.volume?.h24)}`; };
const panel = document.createElement('div'); panel.id = 'tokpanel';
panel.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(94vw,760px);height:min(86vh,560px);display:none;flex-direction:column;gap:8px;padding:12px;background:#161616f2;border:3px solid #ffcd77;border-radius:14px;color:#fff;font:15px system-ui,sans-serif;z-index:20;box-sizing:border-box';
document.body.appendChild(panel);
const prompt = document.createElement('button'); prompt.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);display:none;padding:10px 18px;font:26px "Just Another Hand",cursive;color:#ffcd77;background:#161616e6;border:3px solid #ffcd77;border-radius:12px;z-index:15';
document.body.appendChild(prompt);
function showPanel(sym) {
  const t = TOK.find(q => q.sym === sym); if (!t) return; panel.sym = sym;
  const id0 = t.pair?.pairAddress || (t.dex ? t.dex.split('/').pop() : null), id = isBase58(id0) ? id0 : null;
  panel.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><b style="font:40px 'Just Another Hand',cursive;color:${t.color}">$${sym}</b><span data-stat style="flex:1;opacity:.9">${statLine(t)}</span><button data-x style="font-size:20px;background:none;color:#fff;border:0;cursor:pointer">✕</button></div>
    <div style="display:flex;gap:8px;align-items:center"><code style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#000;padding:6px 8px;border-radius:6px">${t.ca}</code><button data-copy style="padding:6px 10px;background:#ffcd77;border:0;border-radius:6px;font-weight:700;cursor:pointer">COPY CA</button></div>
    ${id ? `<iframe title="$${sym} chart" src="https://dexscreener.com/solana/${id}?embed=1&theme=dark&trades=0&info=0" style="flex:1;width:100%;border:0;border-radius:8px;background:#000"></iframe>` : '<div style="flex:1;display:grid;place-items:center;opacity:.7">resolving the main pair…</div>'}
    <div style="display:flex;gap:16px"><a href="${t.chart}" target="_blank" rel="noopener" style="color:#ffcd77">OPEN CHART ON DEXSCREENER ▸</a>${t.site ? `<a href="${t.site}" target="_blank" rel="noopener" style="color:#7cff6b">PUMP.FUN ▸</a>` : ''}</div>`;
  panel.querySelector('[data-x]').onclick = () => { panel.style.display = 'none'; panel.sym = null; };
  panel.querySelector('[data-copy]').onclick = async (e) => { const ok = await copyText(t.ca); e.target.textContent = ok ? 'COPIED ✓' : 'COPY FAILED'; };
  panel.style.display = 'flex';
}
addEventListener('keydown', e => { if (e.code === 'Escape' && panel.sym) { panel.style.display = 'none'; panel.sym = null; } });
async function refreshTokens() {
  await Promise.all(TOK.map(async (t) => {
    try {
      const j = await (await fetch('https://api.dexscreener.com/latest/dex/tokens/' + t.ca)).json();
      const p = (j.pairs || []).filter(q => q.chainId === 'solana').sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      if (!p) throw new Error('no pair');
      const hadPair = !!t.pair; t.pair = p; if (!t.dex) t.chart = p.url;
      const ch = +(p.priceChange?.h24 ?? 0); atlas.drawTokenBoard(t.sym, [fmtP(p.priceUsd), `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}% 24h`, ch >= 0 ? '#7cff6b' : '#ff6b6b']);
      if (panel.sym === t.sym) { if (!hadPair && !t.dex) showPanel(t.sym); else { const st = panel.querySelector('[data-stat]'); if (st) st.textContent = statLine(t); } }
    } catch { if (!t.pair) atlas.drawTokenBoard(t.sym, ['CHART ▸', 'walk up + press E']); }
  }));
}
refreshTokens(); if (!SHOT) setInterval(refreshTokens, 60000);
if (P.get('token')) showPanel(P.get('token').toUpperCase().replace('$', ''));
const SLOTS = tokenSlots();
// [foot] interact points: dig sites (dig + reveal a chest, local only), the Squad Hall (squad panel), the treasure cave
function footPanel(q) {
  const code = (sessionStorage.ppParty ||= Math.random().toString(36).slice(2, 8).toUpperCase()), inv = `${location.origin}/?party=${code}`;
  panel.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><b style="font:40px 'Just Another Hand',cursive;color:#ffcd77">SQUAD HALL</b><span style="flex:1;opacity:.85">form a crew for Squads (2v2) · party code <b>${code}</b></span><button data-x style="font-size:20px;background:none;border:0;color:#fff;cursor:pointer">✕</button></div>
    <div style="display:flex;gap:8px;align-items:center"><code style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#000;padding:6px 8px;border-radius:6px">${inv}</code><button data-copy style="padding:6px 10px;background:#ffcd77;border:0;border-radius:6px;cursor:pointer">COPY INVITE</button></div>
    <div style="flex:1;display:grid;place-items:center;opacity:.8;text-align:center">Share the invite with your crewmate, then pick SQUADS from the game menu.<br>(party matchmaking from this link is not wired yet)</div>
    <div><a href="./" style="color:#ffcd77">OPEN THE GAME ▸ SQUADS</a></div>`;
  panel.querySelector('[data-x]').onclick = () => { panel.style.display = 'none'; panel.sym = null; };
  panel.querySelector('[data-copy]').onclick = async (e) => { const ok = await copyText(inv); e.target.textContent = ok ? 'COPIED ✓' : 'COPY FAILED'; };
  panel.sym = 'squad'; panel.style.display = 'flex';
}
function footPrompt(t) {
  const v = L2W(walker.x, 0, walker.z), q = foot.nearInteract(v.x, v.z);
  if (!q || panel.sym) return false;
  if (prompt.textContent !== q.label) prompt.textContent = q.label; prompt.style.display = 'block';
  const go = () => { const r = foot.activate(q, uTime.value); if (r === 'squadhall') footPanel(q); };
  prompt.onclick = go; walker.near = null; walker.footGo = q.info ? null : go; return true;
}
addEventListener('keydown', e => { if (e.code === 'KeyE' && walker && walker.footGo) { walker.footGo(); walker.footGo = null; } });
function tokenPrompt() {
  if (foot) { walker.footGo = null; if (footPrompt()) return; }
  let best = null, bd = 3.4; for (const q of SLOTS) { const d = Math.hypot(q.x - walker.x, q.z - walker.z); if (d < bd) { bd = d; best = q; } }
  if (best && !panel.sym) { const label = `E · $${best.sym} CHART`; if (prompt.textContent !== label) prompt.textContent = label; prompt.style.display = 'block'; prompt.onclick = () => showPanel(best.sym); walker.near = best.sym; }
  else { prompt.style.display = 'none'; walker.near = null; }
}
addEventListener('keydown', e => { if (e.code === 'KeyE' && walker && walker.near) showPanel(walker.near); });

function updateWalker(dt, t) {
  const w = walker, K = w.keys, fwd = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), side = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
  let dx = 0, dz = 0;
  if (fwd || side) { w.target = null; const fx = Math.sin(w.camYaw), fz = Math.cos(w.camYaw); dx = fx * fwd - fz * side; dz = fz * fwd + fx * side; }
  else if (w.target) { dx = w.target.x - w.x; dz = w.target.z - w.z; if (Math.hypot(dx, dz) < 0.4) { w.target = null; dx = dz = 0; } }
  const n = Math.hypot(dx, dz), speed = K.ShiftLeft || K.ShiftRight ? 6.5 : 4.2;
  if (n > 0) {
    dx /= n; dz /= n; const st = speed * dt;
    if (!w.blocked(w.x + dx * st, w.z + dz * st)) { w.x += dx * st; w.z += dz * st; } else if (!w.blocked(w.x + dx * st, w.z)) w.x += dx * st; else if (!w.blocked(w.x, w.z + dz * st)) w.z += dz * st; else w.target = null;
    const want = Math.atan2(dx, dz); let d = want - w.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); w.yaw += d * Math.min(1, dt * 10); w.ph += dt * speed * 2.2;
    if (!w.drag && performance.now() - (w.look || 0) > 1500) { let c = w.yaw - w.camYaw; c = Math.atan2(Math.sin(c), Math.cos(c)); w.camYaw += c * Math.min(1, dt * 1.6); }
  }
  const y = fY(w.x, w.z);
  w.mesh.position.set(w.x, y + Math.abs(Math.sin(w.ph)) * 0.08 * (n > 0 ? 1 : 0), w.z); w.mesh.rotation.y = w.yaw;
  const D = 6.5, cy = 2.6 + w.pitch * 6, cx = w.x - Math.sin(w.camYaw) * D * Math.cos(w.pitch * 0.6), cz = w.z - Math.cos(w.camYaw) * D * Math.cos(w.pitch * 0.6);
  const camY = Math.max(y + cy, fY(cx, cz) + 1.2, 0.8);
  camera.position.lerp(L2W(cx, camY, cz), SHOT ? 1 : Math.min(1, dt * 8)); controls.target.copy(L2W(w.x + Math.sin(w.camYaw) * 3, y + 1.6, w.z + Math.cos(w.camYaw) * 3)); camera.lookAt(controls.target);
}

// ---------- loop + stats ----------
const statsEl = document.getElementById('stats'); const clock = new THREE.Clock(); let frames = 0, acc = 0, fps = 0;
const T0 = SHOT ? +(P.get('t') || 4) : 0; // shots use a fixed sea clock so they are reproducible
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1), t = SHOT ? T0 : clock.elapsedTime;
  uTime.value = t; wind.uTime.value = t; ocean.uniforms.uTime.value = t; if (gameSky) gameSky.uniforms.uTime.value = t;
  floatShips(t);
  chest.position.y = cy + Math.sin(t * 1.6) * 0.18; chest.rotation.y = -0.9 + Math.sin(t * 0.7) * 0.12;
  if (walker) { updateWalker(SHOT ? 1 / 30 : dt, t); tokenPrompt(); }
  else {
    if (tween) { tween.k = Math.min(1, tween.k + dt * 1.1); const e = tween.k * tween.k * (3 - 2 * tween.k); camera.position.lerpVectors(tween.from.p, tween.to.p, e); controls.target.lerpVectors(tween.from.t, tween.to.t, e); if (tween.k >= 1) tween = null; }
    controls.update();
  }
  if (foot) { foot.update(camera.position, t, { all: curView === 'footMap' }); if (lobbySky) lobbySky.position.copy(camera.position);
    if (sun.castShadow && curView !== 'footMap') { // [light] High: the sun's shadow box follows the camera (centred ~35 m ahead, snapped to 1 m)
      camera.getWorldDirection(_sd); const cx = Math.round(camera.position.x + _sd.x * 35), cz = Math.round(camera.position.z + _sd.z * 35);
      sun.target.position.set(cx, foot.H(cx, cz), cz); sun.position.copy(sun.target.position).addScaledVector(SUN_N, 260); sun.target.updateMatrixWorld(); } }
  setLod(HARBOR || FOOT || P.has('lod') ? camera.position.distanceTo(isle.position) : 0); // the lobby scene is walked around: always full detail
  // the ocean follows the camera like it follows the player in the game (centred on the harbor for the top-down map)
  const step = ocean.mesh.userData.step, oc = curView === 'harborTop' ? new THREE.Vector3() : curView === 'footMap' ? new THREE.Vector3(-90, 0, -20) : camera.position;
  ocean.mesh.position.set(Math.round(oc.x / step) * step, 0, Math.round(oc.z / step) * step);
  if (gameSky) gameSky.mesh.position.set(camera.position.x, 0, camera.position.z);
  if (rocks) rocks.update(t, camera.position);
  renderer.render(scene, camera);
  frames++; acc += dt; if (acc >= 0.5) { fps = frames / acc; frames = 0; acc = 0; }
  const I = renderer.info.render;
  if (DEV) window.ISLAND_STATS = { calls: I.calls, triangles: I.triangles, fps: Math.round(fps), quality, harbor: HARBOR, lod, dist: Math.round(camera.position.distanceTo(isle.position)) };
  if (!SHOT) statsEl.textContent = `${quality.toUpperCase()}  ${Math.round(fps)} fps  LOD ${lod}\ncalls ${I.calls}  tris ${(I.triangles / 1000).toFixed(1)}k`;
  requestAnimationFrame(frame);
}
if (foot && P.get('dig')) foot.digs.forEach(d => { d.t = (SHOT ? T0 : 0) - +P.get('dig'); }); // &dig=SECONDS: shots of a dig mid-reveal
if (DEV) window.ISLAND_FOOT = foot ? { stats: foot.stats, pois: foot.pois, shop: FM.SHOP_SPOTS, coast: COASTM ? { HC: FM.CO.HC, berths: FM.CO.COAST_BERTHS, spawns: FM.CO.spawnCheck() } : null } : null;
if (DEV) window.ISLAND = { foot, renderer, scene, camera, controls, goView, VIEWS, ships, isle, near, far, rocks, overlay, localOverlay, markers, walker, pois: ISLAND_POIS, setLod, HARBOR_ISLAND, colliders: islandColliders(), berths: BERTHS(), walls: harborWalls(), walk: { landArea: WALKAREA.landArea, deckArea: WALKAREA.deckArea }, real: REAL, decor: DECOR };
requestAnimationFrame(frame);
// 2D layout review map (&foot=1&map=1): heightmap shading, both trail loops, street, river + lake, every POI labelled
if (COASTM && P.has('map')) { const cv = document.createElement('canvas'); cv.width = innerWidth; cv.height = innerHeight; cv.style.cssText = 'position:fixed;inset:0;z-index:50'; FM.drawCoastMap(cv); document.body.appendChild(cv); }
else if (FOOT && P.has('map')) {
  const cv = document.createElement('canvas'); cv.width = innerWidth; cv.height = innerHeight; cv.style.cssText = 'position:fixed;inset:0;z-index:50';
  const tp = ISLAND_POIS.map(q => { const v = L2W(q.x, 0, q.z); return { x: v.x, z: v.z, label: '', col: '#60a5fa' }; });
  FM.drawMap(cv, [...tp, { ...(() => { const [x, z] = FM.townToWorld(14, -66); return { x, z }; })(), label: 'Squad Hall', col: '#a855f7' }]); document.body.appendChild(cv);
}
