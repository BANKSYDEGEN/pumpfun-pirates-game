// [Raul] PUMPFUN PIRATES island lobby: standalone art test scene (island.html). Not part of the game build / service worker.
// URL: island.html?quality=high|low&view=hero|dock|tavern|dig|chest|board|top&shot=1 (shot hides the UI, freezes auto-orbit)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toon } from '../toon.js';
import { createOcean, WAVES } from '../ocean.js';
import { wind, makeSkullTexture, animateShip } from '../ships.js';
import { setCrewQuality } from '../crew.js';
import { compileShip } from '../upgradeVisuals.js';
import { getSkin } from '../skins.js';
import { SPOTS, groundY, buildIsland, buildChest, makeAtlas, shoreFoam } from './art.js';
import { outlineMaterial, SWAY_DECL, SWAY_BODY } from './kit.js';
import { bakeShip } from './bake.js';

const P = new URLSearchParams(location.search);
const phone = matchMedia('(max-width: 600px), (max-height: 520px)').matches;
const quality = P.get('quality') || (phone ? 'low' : 'high'), LOW = quality === 'low', SHOT = P.has('shot');
if (SHOT) document.body.classList.add('shot');

// ---------- renderer / scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.25 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
if (!LOW) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
const scene = new THREE.Scene();
const SKY_FOG = new THREE.Color(0x9ddcf2);
scene.fog = new THREE.FogExp2(SKY_FOG, 0.0021);
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.5, 2500);

// bright lobby lighting: warm sun + sky fill
scene.add(new THREE.HemisphereLight(0xcdeeff, 0x6f9a5a, 1.75));
const sun = new THREE.DirectionalLight(0xfff0d6, 2.5); sun.position.set(55, 95, 62); scene.add(sun, sun.target);
if (!LOW) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = sc.bottom = -95; sc.right = sc.top = 95; sc.near = 10; sc.far = 300; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.4; sc.updateProjectionMatrix(); }

// sunny toy sky dome (gradient + soft sun), one draw call
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uTop: { value: new THREE.Color(0x1f86e0) }, uHor: { value: SKY_FOG.clone() }, uSun: { value: sun.position.clone().normalize() } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `varying vec3 vD; uniform vec3 uTop, uHor, uSun;
    void main(){ float h = clamp(vD.y, 0.0, 1.0); vec3 c = mix(uHor, uTop, pow(h, 0.55)); float s = max(dot(vD, uSun), 0.0);
      c += vec3(1.0, 0.92, 0.75) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.18); gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
sky.renderOrder = -10; scene.add(sky);

// ---------- the game's ocean (calm lagoon: same shader, wave amplitudes scaled down) ----------
const CALM = 0.32;
const ocean = createOcean(LOW ? 'low' : 'high'); ocean.mesh.renderOrder = 2; scene.add(ocean.mesh);
ocean.uniforms.uWaves.value.forEach(v => { v.z *= CALM; });
ocean.uniforms.uFogColor.value.copy(SKY_FOG); ocean.uniforms.uFogDensity.value = 0.0021; ocean.uniforms.uSun.value.copy(sun.position).normalize();
const W = WAVES.map(([x, z, a, l]) => { const n = Math.hypot(x, z), k = 2 * Math.PI / l; return { dx: x / n, dz: z / n, a: a * CALM, k, w: Math.sqrt(9.8 * k) }; });
const waveH = (x, z, t) => { let h = 0; for (const v of W) h += v.a * Math.sin(v.k * (v.dx * x + v.dz * z) - v.w * t); return h; };

// ---------- island (merged buckets) ----------
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
const island = buildIsland({ low: LOW, atlas }).build(MATS, OUT);
island.traverse(o => { if (o.isMesh && !o.userData.outline && o.userData.bucket !== 'glow') { o.castShadow = !LOW; o.receiveShadow = !LOW; } });
scene.add(island);
const foam = shoreFoam(uTime, LOW); scene.add(foam);

// daily-reward chest: bobbing chest + light beam + sparkles
const chest = new THREE.Group(); const cs = SPOTS.chest, cy = groundY(cs.x, cs.z) + 1.15;
chest.position.set(cs.x, cy, cs.z); chest.rotation.y = -0.9;
chest.add(buildChest(LOW, atlas).build(MATS, OUT)); scene.add(chest);
const beamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `varying vec2 vUv; uniform float uTime;
    void main(){ float a = (1.0 - vUv.y) * (0.55 + 0.25 * sin(uTime * 2.5)) * (0.7 + 0.3 * sin(vUv.x * 37.7 + uTime * 3.0));
      gl_FragColor = vec4(vec3(1.0, 0.82, 0.35) * a, a); }`,
});
const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.6, 22, 20, 1, true), beamMat); beam.position.set(cs.x, cy + 11, cs.z); beam.renderOrder = 4; scene.add(beam);
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
  sparks.position.set(cs.x, cy, cs.z); sparks.frustumCulled = false; scene.add(sparks);
}

// ---------- moored ships (the real game ship compiler) ----------
setCrewQuality(LOW ? 'low' : 'high', phone);
const flagTex = skull ? makeSkullTexture(skull, { w: 512, h: 340, pad: 0.1 }) : null;
const sailTex = skull ? makeSkullTexture(skull, { w: 512, h: 400, bg: '#121212', pad: 0.14 }) : null;
const SHIPS = [{ levels: { hull: 2, sails: 1, cannons: 1, armor: 1 }, skin: 'classic' }, { levels: { hull: 1, sails: 1 }, skin: 'golden' }];
const ships = SPOTS.moor.slice(0, LOW ? 1 : 2).map((m, i) => {
  const mesh = compileShip(SHIPS[i].levels, { mainSailMap: sailTex, flagMap: flagTex, light: false, shadows: !LOW, quality: LOW ? 'low' : 'high', skin: getSkin(SHIPS[i].skin) });
  mesh.position.set(m.x, 0, m.z); mesh.rotation.y = m.yaw; for (let k = 0; k < 90; k++) animateShip(mesh, 0, 0.55); bakeShip(mesh); // moored: static parts merged per material
  mesh.traverse(o => { o.castShadow = false; }); // hulls sit on water (the ocean takes no shadows): skip the shadow pass for ships
  scene.add(mesh); return { mesh, x: m.x, z: m.z, yaw: m.yaw, ph: i * 1.7 };
});
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
  ships.forEach((s, k) => {
    const L = s.mesh.userData.len * 0.4, B = s.mesh.userData.beam * 0.5, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    const hF = waveH(s.x + fx * L, s.z + fz * L, t), hA = waveH(s.x - fx * L, s.z - fz * L, t), hP = waveH(s.x + fz * B, s.z - fx * B, t), hS = waveH(s.x - fz * B, s.z + fx * B, t);
    s.mesh.position.set(s.x, (hF + hA + hP + hS) / 4, s.z);
    s.mesh.rotation.set(Math.atan2(hA - hF, 2 * L) * 0.8, s.yaw, Math.atan2(hS - hP, 2 * B) * 0.6, 'YXZ');
    animateShip(s.mesh, t + s.ph, 0.55); // flag flies; sails half-reefed at the dock
    ocean.uniforms.uHulls.value[k].set(s.x, s.z, s.yaw, s.mesh.userData.len); ocean.uniforms.uHullV.value[k] = 0; hullCap(s, ocean.uniforms.uHullY.value[k]);
  });
  ocean.uniforms.uHullCount.value = ships.length;
}

// ---------- lobby camera ----------
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 14; controls.maxDistance = 260; controls.maxPolarAngle = 1.42; controls.enablePan = true;
controls.autoRotateSpeed = 0.45;
const gy = (s) => groundY(s.x, s.z);
const VIEWS = {
  hero: { p: [78, 58, 150], t: [4, 0, 30] },
  dock: { p: [-30, 15, 112], t: [0, 3, 80] },
  tavern: { p: [-4, 12, 14], t: [-21, gy(SPOTS.tavern) + 7, -10] },
  dig: { p: [8, 13, -14], t: [SPOTS.dig.x, gy(SPOTS.dig) + 1, SPOTS.dig.z] },
  chest: { p: [12, 11, 6], t: [SPOTS.chest.x, gy(SPOTS.chest) + 3, SPOTS.chest.z] },
  board: { p: [-6, 10, 52], t: [SPOTS.board.x, gy(SPOTS.board) + 3.5, SPOTS.board.z] },
  top: { p: [0.01, 185, 20], t: [0, 0, 20] },
};
if (innerWidth / innerHeight > 1.9 || phone) VIEWS.hero = { p: [58, 40, 112], t: [3, 0, 28] }; // phones (wide landscape): a closer lobby shot
let tween = null;
function goView(name, instant = false) {
  const v = VIEWS[name] || VIEWS.hero; controls.autoRotate = name === 'hero' && !SHOT;
  const to = { p: new THREE.Vector3(...v.p), t: new THREE.Vector3(...v.t) };
  if (instant) { camera.position.copy(to.p); controls.target.copy(to.t); controls.update(); tween = null; }
  else tween = { from: { p: camera.position.clone(), t: controls.target.clone() }, to, k: 0 };
  document.querySelectorAll('#ui button[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === name));
}
const ui = document.getElementById('ui');
for (const v of Object.keys(VIEWS)) { const b = document.createElement('button'); b.textContent = v.toUpperCase(); b.dataset.v = v; b.onclick = () => goView(v); ui.appendChild(b); }
{ const b = document.createElement('button'); b.textContent = 'QUALITY: ' + quality.toUpperCase(); b.onclick = () => { P.set('quality', LOW ? 'high' : 'low'); location.search = P.toString(); }; ui.appendChild(b); }
controls.addEventListener('start', () => { tween = null; controls.autoRotate = false; });
goView(P.get('view') || 'hero', true);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- loop + stats ----------
const statsEl = document.getElementById('stats'); const clock = new THREE.Clock(); let frames = 0, acc = 0, fps = 0;
const T0 = SHOT ? 4.0 : 0; // shots use a fixed sea clock so they are reproducible
renderer.info.autoReset = true;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1), t = SHOT ? T0 : clock.elapsedTime;
  uTime.value = t; wind.uTime.value = t; ocean.uniforms.uTime.value = t;
  floatShips(t);
  chest.position.y = cy + Math.sin(t * 1.6) * 0.18; chest.rotation.y = -0.9 + Math.sin(t * 0.7) * 0.12;
  if (tween) { tween.k = Math.min(1, tween.k + dt * 1.1); const e = tween.k * tween.k * (3 - 2 * tween.k); camera.position.lerpVectors(tween.from.p, tween.to.p, e); controls.target.lerpVectors(tween.from.t, tween.to.t, e); if (tween.k >= 1) tween = null; }
  controls.update();
  renderer.render(scene, camera);
  frames++; acc += dt; if (acc >= 0.5) { fps = frames / acc; frames = 0; acc = 0; }
  const I = renderer.info.render;
  window.ISLAND_STATS = { calls: I.calls, triangles: I.triangles, fps: Math.round(fps), quality, programs: renderer.info.programs.length, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries };
  if (!SHOT) statsEl.textContent = `${quality.toUpperCase()}  ${Math.round(fps)} fps\ncalls ${I.calls}  tris ${(I.triangles / 1000).toFixed(1)}k`;
  requestAnimationFrame(frame);
}
window.ISLAND = { renderer, scene, camera, controls, goView, VIEWS, ships, island };
requestAnimationFrame(frame);
