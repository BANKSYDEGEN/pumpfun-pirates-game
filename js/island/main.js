// [Raul] PUMPFUN PIRATES island: standalone art / layout test scene (island.html). Not part of the game build or the service worker.
// URL: island.html?quality=high|low  &harbor=1 (place it in the BATTLE ROYALE harbor: storm sea, real rock islands, spawn
// overlay, AI duel, a ship sailing the approach lane)  &view=<name>  &shot=1 (hide UI, freeze the clock)  &overlay=1
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toon } from '../toon.js';
import { createOcean, createSky, WAVES, FOG_COLOR } from '../ocean.js';
import { wind, makeSkullTexture, animateShip } from '../ships.js';
import { setCrewQuality } from '../crew.js';
import { compileShip } from '../upgradeVisuals.js';
import { getSkin } from '../skins.js';
import { createIslands } from '../props.js';
import { PVP_ARENA_R } from '../config.js';
import { SPOTS, TOWER_H, HARBOR_ISLAND, groundY, buildIsland, buildFarIsland, buildChest, makeAtlas, shoreFoam, islandColliders, BERTHS } from './art.js';
import { outlineMaterial, SWAY_DECL, SWAY_BODY } from './kit.js';
import { bakeShip } from './bake.js';

const P = new URLSearchParams(location.search);
const phone = matchMedia('(max-width: 600px), (max-height: 520px)').matches;
const quality = P.get('quality') || (phone ? 'low' : 'high'), LOW = quality === 'low', SHOT = P.has('shot');
const HARBOR = !!P.get('harbor') && P.get('harbor') !== '0';
if (SHOT) document.body.classList.add('shot');
document.getElementById('title').textContent = HARBOR ? 'PUMPFUN PIRATES · Island in the harbor' : 'PUMPFUN PIRATES · Island';

// ---------- renderer / scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.25 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = HARBOR ? 1.2 : 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
if (!LOW) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
const scene = new THREE.Scene();
const FOGC = HARBOR ? FOG_COLOR.clone() : new THREE.Color(0x9ddcf2), FOGD = HARBOR ? 0.0042 : 0.0021;
scene.fog = new THREE.FogExp2(FOGC, FOGD); scene.background = FOGC.clone();
const camera = new THREE.PerspectiveCamera(HARBOR ? 55 : 46, innerWidth / innerHeight, 0.5, 3000);

// the island root: identity in the lobby scene, the harbor transform with ?harbor=1
const isle = new THREE.Group(); scene.add(isle);
if (HARBOR) { isle.position.set(HARBOR_ISLAND.x, 0, HARBOR_ISLAND.z); isle.rotation.y = HARBOR_ISLAND.yaw; }
isle.updateMatrixWorld(true);
const L2W = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(isle.matrixWorld);

// lighting: harbor = the game's storm lighting; lobby = bright toy sunshine
scene.add(HARBOR ? new THREE.HemisphereLight(0x9fc2d4, 0x14262c, 1.9) : new THREE.HemisphereLight(0xcdeeff, 0x6f9a5a, 1.75));
const sun = HARBOR ? new THREE.DirectionalLight(0xffe2c4, 2.1) : new THREE.DirectionalLight(0xfff0d6, 2.5);
const SUN_DIR = HARBOR ? new THREE.Vector3(-40, 50, 80) : new THREE.Vector3(55, 95, 62);
sun.position.copy(isle.position).add(SUN_DIR); sun.target.position.copy(isle.position); scene.add(sun, sun.target);
if (!LOW) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = sc.bottom = -85; sc.right = sc.top = 85; sc.near = 10; sc.far = 320; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.4; sc.updateProjectionMatrix(); }

// sky: the game's storm sky in the harbor, a sunny gradient dome in the lobby
let gameSky = null;
if (HARBOR) { gameSky = createSky(); scene.add(gameSky.mesh); }
else {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(0x1f86e0) }, uHor: { value: FOGC.clone() }, uSun: { value: SUN_DIR.clone().normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 uTop, uHor, uSun;
      void main(){ float h = clamp(vD.y, 0.0, 1.0); vec3 c = mix(uHor, uTop, pow(h, 0.55)); float s = max(dot(vD, uSun), 0.0);
        c += vec3(1.0, 0.92, 0.75) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.18); gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -10; scene.add(sky);
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
const swayMat = toon(0xffffff, null, { vertexColors: true });
swayMat.onBeforeCompile = (s) => { s.uniforms.uTime = uTime; s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>' + SWAY_DECL).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY_BODY); };
swayMat.customProgramCacheKey = () => 'isl_sway';
const MATS = {
  toon: toon(0xffffff, null, { vertexColors: true }),
  sway: swayMat,
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  atlas: toon(0xffffff, atlas.tex, { side: THREE.DoubleSide }),
};
const OUT = { plain: outlineMaterial(0.09), sway: outlineMaterial(0.09, uTime) };
const near = buildIsland({ low: LOW, atlas }).build(MATS, OUT); near.name = 'island_near';
near.traverse(o => { if (o.isMesh && !o.userData.outline && o.userData.bucket !== 'glow') { o.castShadow = !LOW; o.receiveShadow = !LOW; } });
const far = buildFarIsland().build({ toon: MATS.toon }, OUT); far.name = 'island_far'; far.visible = false;
const foam = shoreFoam(uTime, LOW, ocean.uniforms.uWaves);
isle.add(near, far, foam);

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
const LOD_NEAR = 150, LOD_FAR = 280, HYST = 10; let lod = 'near';
const outlines = []; near.traverse(o => { if (o.userData.outline) outlines.push(o); }); chest.traverse(o => { if (o.userData.outline) outlines.push(o); });
function setLod(d) {
  const want = d > LOD_FAR + (lod === 'far' ? -HYST : HYST) ? 'far' : d > LOD_NEAR + (lod === 'near' ? HYST : -HYST) ? 'mid' : 'near';
  if (want === lod && setLod.done) return; lod = want; setLod.done = true;
  near.visible = chest.visible = lod !== 'far'; far.visible = lod === 'far';
  for (const o of outlines) o.visible = lod === 'near';
  if (sparks) sparks.visible = lod === 'near'; foam.visible = lod !== 'far';
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
{ // berth A: one moored ship on every quality (keeps High under 60 calls); maxed hull 3 = len 20.4, the longest the berth takes
  const b = BERTHS()[0], w = L2W(b.x, 0, b.z);
  ships.push({ mesh: mkShip({ hull: 3, sails: 1, cannons: 1, armor: 1 }, 'golden', true), x: w.x, z: w.z, yaw: b.yaw + isle.rotation.y, sail: 0.5, ph: 0, moored: true });
}
let approach = null; const duel = [];
if (HARBOR) {
  // a ship sailing the buoyed approach lane and pulling alongside berth B (40 s loop)
  approach = { mesh: mkShip({ hull: 1, sails: 1 }, 'classic', false), x: 0, z: 0, yaw: 0, sail: 1, ph: 1.3 }; ships.push(approach);
  // two AI-style ships duelling out in the harbor, in view of the beach / dock / terrace / lookout
  if (!LOW) for (let i = 0; i < 2; i++) { const s = { mesh: mkShip({ hull: i, cannons: 1 }, i ? 'blood' : 'midnight', false), x: 0, z: 0, yaw: 0, sail: 1, ph: i * 2.1 }; duel.push(s); ships.push(s); }
}
function approachPose(t) { // local frame: from the lane mouth (z 170) to berth B (z 80), easing out, then a 12 s stop
  const b = BERTHS()[1], T = 40, p = (t % T) / T, k = Math.min(1, p / 0.7), e = 1 - Math.pow(1 - k, 2.2);
  const z = 170 + (b.z - 170) * e, x = b.x + Math.sin(k * Math.PI) * 3.5 * (1 - k); return { x, z, yaw: b.yaw, speed: (1 - k) * 9 };
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

// ---------- harbor context: real rock islands + a layout overlay (spawns, rings, colliders, berths, lane) ----------
let rocks = null, overlay = null;
if (HARBOR) {
  rocks = createIslands(LOW ? 'low' : 'high'); scene.add(rocks.group);
  const seg = [], col = [], C = (h) => new THREE.Color(h);
  const ring = (cx, cz, r, c, n = 64) => { for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; seg.push(cx + Math.cos(a0) * r, 1, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, 1, cz + Math.sin(a1) * r); col.push(...c.toArray(), ...c.toArray()); } };
  ring(0, 0, PVP_ARENA_R, C(0xff3030), 128); ring(0, 0, 370, C(0xff9a3a), 128);
  for (const r of [40, 85, 130]) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ring(Math.cos(a) * r, Math.sin(a) * r, 3, C(0x4ade80), 8); } // harbor death respawns
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; ring(Math.cos(a) * PVP_ARENA_R * 0.82, Math.sin(a) * PVP_ARENA_R * 0.82, 6, C(0xfbbf24), 10); } // AI / boss spawns
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * 6.283; ring(Math.cos(a) * PVP_ARENA_R * 0.42, Math.sin(a) * PVP_ARENA_R * 0.42, 6, C(0xfbbf24), 10); }
  ring(0, 0, 8, C(0x60a5fa), 16); // player harbor spawn
  for (const c of islandColliders()) { const w = L2W(c.x, 0, c.z); ring(w.x, w.z, c.r, C(0xffffff), 24); }
  for (const b of BERTHS()) { const cs4 = [[-3.65, -11], [3.65, -11], [3.65, 11], [-3.65, 11]].map(([x, z]) => L2W(b.x + x, 0, b.z + z)); for (let i = 0; i < 4; i++) { const a = cs4[i], bb = cs4[(i + 1) % 4]; seg.push(a.x, 1.2, a.z, bb.x, 1.2, bb.z); col.push(0.4, 0.9, 1, 0.4, 0.9, 1); } }
  { const L = SPOTS.lane; for (const sx of [-1, 1]) { const a = L2W(sx * L.w / 2, 0, L.z0), b = L2W(sx * L.w / 2, 0, L.z1 + 15); seg.push(a.x, 1.2, a.z, b.x, 1.2, b.z); col.push(0.4, 0.9, 1, 0.4, 0.9, 1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  overlay = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, fog: false, depthTest: false, transparent: true, opacity: 0.9 })); overlay.renderOrder = 9; overlay.visible = P.has('overlay'); scene.add(overlay);
}

// ---------- camera views (island-local; transformed into the harbor with ?harbor=1) ----------
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 4; controls.maxDistance = 1200; controls.maxPolarAngle = 1.5; controls.enablePan = true;
controls.autoRotateSpeed = 0.45;
const gy = (s) => groundY(s.x, s.z);
const T = SPOTS.tavern, TW = SPOTS.tower, deckY = gy(T) - 0.3 + 1.65, towerTop = gy(TW) - 0.4 + TOWER_H + 0.5;
const VIEWS = {
  hero: { p: [-70, 52, 150], t: [0, 2, 26] },
  seaNear: { p: [34, 9, 118], t: [0, 6, 0] },
  seaMid: { p: [60, 11, 205], t: [0, 6, 0] },
  seaFar: { p: [40, 12, 300], t: [0, 6, 0] },
  docked: { p: [6, 8, 104], t: [-7, 3.5, 78] },
  beach: { p: [-20, gy({ x: -20, z: 45 }) + 2.4, 45], t: [-8, 3, 200] },
  dock: { p: [1.5, SPOTS.dock.y + 2.4, 103.5], t: [0, 2, 260] },
  terrace: { p: [3, deckY + 2.2, T.z + 12.6], t: [0, 2, 190] },
  lookout: { p: [TW.x + 0.5, towerTop + 2.4, TW.z + 2.3], t: [-2, 0, 200] },
  tower: { p: [-12, 14, 18], t: [TW.x, gy(TW) + 11, TW.z] },
  tavern: { p: [10, deckY + 8, T.z + 34], t: [0, deckY + 5, T.z] },
  dig: { p: [SPOTS.dig.x + 12, 14, SPOTS.dig.z + 16], t: [SPOTS.dig.x, gy(SPOTS.dig) + 1, SPOTS.dig.z] },
  chest: { p: [cs.x - 12, 12, cs.z + 16], t: [cs.x, gy(cs) + 3, cs.z] },
  board: { p: [12, 11, 12], t: [SPOTS.board.x, gy(SPOTS.board) + 3.5, SPOTS.board.z] },
  top: { p: [0.01, 195, 22], t: [0, 0, 22] },
};
if (!HARBOR && (innerWidth / innerHeight > 1.9 || phone)) VIEWS.hero = { p: [-56, 40, 120], t: [0, 0, 30] };
const WORLD_VIEWS = HARBOR ? { harborTop: { p: [0.01, 1050, 0], t: [0, 0, 0] }, spawn: { p: [0, 12, -30], t: [HARBOR_ISLAND.x, 8, HARBOR_ISLAND.z] } } : {};
let tween = null, curView = 'hero';
function resolve(name) {
  if (WORLD_VIEWS[name]) return { p: new THREE.Vector3(...WORLD_VIEWS[name].p), t: new THREE.Vector3(...WORLD_VIEWS[name].t) };
  const v = VIEWS[name] || VIEWS.hero; return { p: L2W(...v.p), t: L2W(...v.t) };
}
function goView(name, instant = false) {
  curView = name; controls.autoRotate = name === 'hero' && !SHOT;
  const to = resolve(name), top = name === 'harborTop';
  if (overlay) overlay.visible = top || P.has('overlay');
  if (gameSky) gameSky.mesh.visible = !top; scene.background = top ? new THREE.Color(0x0e2a36) : FOGC.clone();
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
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- loop + stats ----------
const statsEl = document.getElementById('stats'); const clock = new THREE.Clock(); let frames = 0, acc = 0, fps = 0;
const T0 = SHOT ? +(P.get('t') || 4) : 0; // shots use a fixed sea clock so they are reproducible
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1), t = SHOT ? T0 : clock.elapsedTime;
  uTime.value = t; wind.uTime.value = t; ocean.uniforms.uTime.value = t; if (gameSky) gameSky.uniforms.uTime.value = t;
  floatShips(t);
  chest.position.y = cy + Math.sin(t * 1.6) * 0.18; chest.rotation.y = -0.9 + Math.sin(t * 0.7) * 0.12;
  if (tween) { tween.k = Math.min(1, tween.k + dt * 1.1); const e = tween.k * tween.k * (3 - 2 * tween.k); camera.position.lerpVectors(tween.from.p, tween.to.p, e); controls.target.lerpVectors(tween.from.t, tween.to.t, e); if (tween.k >= 1) tween = null; }
  controls.update();
  setLod(HARBOR || P.has('lod') ? camera.position.distanceTo(isle.position) : 0); // the lobby scene is walked around: always full detail
  // the ocean follows the camera like it follows the player in the game (centred on the harbor for the top-down map)
  const step = ocean.mesh.userData.step, oc = curView === 'harborTop' ? new THREE.Vector3() : camera.position;
  ocean.mesh.position.set(Math.round(oc.x / step) * step, 0, Math.round(oc.z / step) * step);
  if (gameSky) gameSky.mesh.position.set(camera.position.x, 0, camera.position.z);
  if (rocks) rocks.update(t, camera.position);
  renderer.render(scene, camera);
  frames++; acc += dt; if (acc >= 0.5) { fps = frames / acc; frames = 0; acc = 0; }
  const I = renderer.info.render;
  window.ISLAND_STATS = { calls: I.calls, triangles: I.triangles, fps: Math.round(fps), quality, harbor: HARBOR, lod, dist: Math.round(camera.position.distanceTo(isle.position)) };
  if (!SHOT) statsEl.textContent = `${quality.toUpperCase()}  ${Math.round(fps)} fps  LOD ${lod}\ncalls ${I.calls}  tris ${(I.triangles / 1000).toFixed(1)}k`;
  requestAnimationFrame(frame);
}
window.ISLAND = { renderer, scene, camera, controls, goView, VIEWS, ships, isle, near, far, rocks, overlay, setLod, HARBOR_ISLAND, colliders: islandColliders(), berths: BERTHS() };
requestAnimationFrame(frame);
