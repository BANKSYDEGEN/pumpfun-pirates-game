// PUMPFUN PIRATES · Storm Hunt — main game
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createOcean, createSky, createRain, createBolt, waveHeight, FOG_COLOR, MAX_HULLS } from './ocean.js';
import { buildShip, animateShip, makeSkullTexture, makePillTexture, wind, disposeShip, ENEMY_SCHEMES } from './ships.js';
import { makeChest, chestTime, createIslands } from './props.js';
import { FX } from './fx.js';
import { initAudio, sfx, setMuted, muted } from './audio.js';
import { leaderboard, PERIODS } from './leaderboard.js';
import { isValidSolanaAddress, shortWallet, getSavedWallet, saveWallet, getSavedName, saveName } from './wallet.js';
import { rewardsStatus } from './rewards.js';
import { QUALITY } from './config.js';

// [Raul] ship upgrades
import { gunList } from './upgrades.js';
import { waveRoster, applyEnemyType } from './enemyTypes.js';
import { initShop, resetShop } from './shop.js';
import { compileShip } from './upgradeVisuals.js'; // [Raul] upgrade visuals: player ship compiled from upgrade traits

const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const CAPTAINS = [1, 10, 11, 12, 13, 15, 16, 33, 74, 100, 106, 172, 224, 250, 253, 307, 310, 321, 325, 333];
const ENEMY_NAMES = ['RUG PULLER', 'JEETER', 'PAPER HANDS', 'DUMPER', 'BAG DUMPER', 'FUD SPREADER', 'EXIT LIQUIDITY', 'SNIPER BOT', 'DEV SOLD'];

// ---------- quality ----------
const qp = new URLSearchParams(location.search).get('quality');
const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const quality = (qp === 'low' || qp === 'high') ? qp : (QUALITY !== 'auto' ? QUALITY : (isMobile || (navigator.hardwareConcurrency || 8) <= 4 ? 'low' : 'high'));

// ---------- renderer / scene ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1.25 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const HIGH = quality === 'high';
if (HIGH) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_COLOR.getHex(), 0.0042);
scene.background = FOG_COLOR.clone();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 2500);
camera.position.set(0, 16, -34);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.enablePan = false; controls.minDistance = 16; controls.maxDistance = 95;
controls.maxPolarAngle = 1.48; controls.minPolarAngle = 0.25;
controls.target.set(0, 4, 0);

// storm lighting: cool sky fill, a low warm-silver key from the sunset seam, soft shadows on high
const hemi = new THREE.HemisphereLight(0x9fc2d4, 0x14262c, 1.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2c4, 2.1); sun.position.set(-40, 50, 80); scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(-40, 50, 80);
if (HIGH) {
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -38; sc.right = sc.top = 38; sc.near = 10; sc.far = 220;
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
}

const ocean = createOcean(quality); ocean.mesh.renderOrder = 2; scene.add(ocean.mesh); // after ships' water masks (see ships.js)
const sky = createSky(); scene.add(sky.mesh);
const rain = createRain(quality === 'low' ? 1800 : 5000); scene.add(rain.mesh);
const fx = new FX(scene, quality);
const bolt = createBolt(); scene.add(bolt.mesh);
const islands = createIslands(quality); scene.add(islands.group);

// post-processing (high tier only; phones never download these modules)
let composer = null;
if (HIGH) {
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }, { FXAAShader }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/ShaderPass.js'),
      import('three/addons/postprocessing/OutputPass.js'), import('three/addons/shaders/FXAAShader.js'),
    ]);
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.92);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const vignette = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uStrength: { value: 0.42 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float uStrength; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.25, length(d * vec2(1.0, 0.9))); c.rgb *= mix(1.0 - uStrength, 1.0, v); gl_FragColor = c; }',
    });
    composer.addPass(vignette);
    const fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa);
    composer.userData = { fxaa, bloom };
  } catch (e) { console.warn('[gfx] post-processing unavailable, rendering directly', e); composer = null; }
}

// ---------- assets ----------
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
const [skullImg] = await Promise.all([loadImage('assets/skull_transparent.png'), document.fonts.load('40px "Just Another Hand"')]);
const flagTex = makeSkullTexture(skullImg, { w: 512, h: 340, pad: 0.1 });
const sailTex = makeSkullTexture(skullImg, { w: 512, h: 400, bg: '#121212', pad: 0.14 });
const pillTex = makePillTexture();

// ---------- state ----------
const game = {
  state: 'title', t: 0, score: 0, gold: 0, wave: 0, sunk: 0, startTime: 0,
  wallet: getSavedWallet(), name: getSavedName(), captain: CAPTAINS[0], saved: false, waveTimer: 0, shake: 0, flash: 0, nextLightning: 5,
};

// [Raul] upgrade visuals: level-0 traits compile to exactly the original player ship (len 17, beam 5.4, 4 guns, 3 masts)
const PLAYER_SHIP = { mainSailMap: sailTex, flagMap: flagTex, light: true, shadows: HIGH };
function makePlayer() {
  const mesh = compileShip({}, PLAYER_SHIP);
  scene.add(mesh);
  return { mesh, x: 0, z: 0, yaw: 0, speed: 0, sail: 2, anchor: false, hp: 100, maxHp: 100, cd: { port: 0, star: 0 }, reload: 2.2, roll: 0, pitch: 0, y: 0, sinking: 0, alive: true, turn: 0 };
}
let player = makePlayer();
// [Raul] upgrade visuals: swap in a freshly compiled ship for new upgrade levels (same pose, old one freed)
function rebuildPlayerShip(levels) {
  const old = player.mesh, mesh = compileShip(levels, PLAYER_SHIP);
  mesh.position.copy(old.position); mesh.rotation.copy(old.rotation); mesh.userData.body.rotation.copy(old.userData.body.rotation);
  mesh.userData.sails.forEach((sl, i) => { const o = old.userData.sails[i]; if (o) { sl.scale.y = o.scale.y; sl.scale.z = o.scale.z; } });
  scene.remove(old); disposeShip(old); scene.add(mesh); player.mesh = mesh;
  return mesh;
}
const enemies = [], balls = [], loot = [];
const ballGeo = new THREE.SphereGeometry(0.45, 10, 8);
const ballMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.6 });

// ---------- enemies ----------
function spawnEnemy(x, z, tier = 1, type = null) {
  const big = tier >= 2;
  const mesh = buildShip({
    len: big ? 19 : rnd(13, 15.5), beam: big ? 6 : rnd(4.4, 5), depth: 2.8,
    scheme: big ? 'boss' : ENEMY_SCHEMES[Math.floor(Math.random() * ENEMY_SCHEMES.length)], boss: big,
    flagMap: pillTex, flagScale: 1.45, cannonsPerSide: big ? 4 : 2, masts: big ? 3 : 2, shadows: HIGH,
  });
  scene.add(mesh);
  const hp = Math.round((big ? 160 : 70) * (1 + game.wave * 0.12));
  const bar = document.createElement('div'); bar.className = 'ehp';
  const name = big ? 'DEV WALLET (BOSS)' : ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)];
  bar.innerHTML = `<div class="name">${name}</div><div class="bar"><div class="fill"></div></div>`;
  $('bars').appendChild(bar);
  const e = {
    mesh, x, z, yaw: Math.random() * 6.28, speed: 3, turn: 0, hp, maxHp: hp, state: 'roam', wp: null, cd: rnd(2, 4), roll: 0, pitch: 0, y: 0,
    sinking: 0, alive: true, bar, fill: bar.querySelector('.fill'), big, maxSpeed: (big ? 6.5 : rnd(7, 9)) * (1 + Math.min(game.wave, 10) * 0.02),
    reload: Math.max(2.2, 5 - game.wave * 0.25), accuracy: clamp(0.55 + game.wave * 0.05, 0.5, 0.9), smokeT: 0,
  };
  if (type) applyEnemyType(e, type, game.wave); // [Raul] ship upgrades: enemy types
  enemies.push(e);
  return e;
}

function startWave() {
  game.wave++;
  if (player.alive) player.hp = player.maxHp; // full hull at the start of every wave (maxHp includes hull upgrades)
  const roster = waveRoster(game.wave), n = roster.length; // [Raul] ship upgrades: sloops / frigates / galleons / boss
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), d = rnd(130, 210);
    spawnEnemy(player.x + Math.cos(a) * d, player.z + Math.sin(a) * d, roster[i] === 'boss' ? 2 : 1, roster[i]);
  }
  banner(`WAVE ${game.wave}`, game.wave % 4 === 0 ? 'THE DEV WALLET APPROACHES' : `${n} rug ships on the horizon`);
  updateHud();
}

// ---------- cannon fire ----------
function sideDir(s, side) { const sx = side === 'port' ? 1 : -1; return new THREE.Vector3(Math.cos(s.yaw) * sx, 0, -Math.sin(s.yaw) * sx); }
function toLocal(s, x, z) { const dx = x - s.x, dz = z - s.z, c = Math.cos(s.yaw), n = Math.sin(s.yaw); return [dx * c - dz * n, dx * n + dz * c]; }

function fire(shooter, side, target = null, accuracy = 1) {
  const muzzles = gunList(shooter, side); // [Raul] ship upgrades: cannon count
  const dir = sideDir(shooter, side);
  const vel0 = new THREE.Vector3(Math.sin(shooter.yaw) * shooter.speed, 0, Math.cos(shooter.yaw) * shooter.speed);
  const H = 42; // horizontal muzzle speed
  // assisted ranging: aim at a target on that side, else default ~45 m
  let range = (shooter.range || 90) / 2, aimPt = null; // [Raul] ship upgrades: range
  if (!target && shooter === player) {
    let best = null, bd = 1e9;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - player.x, dz = e.z - player.z, d = Math.hypot(dx, dz);
      if (d > (shooter.range || 90)) continue; // [Raul] ship upgrades: range
      const cosang = (dx * dir.x + dz * dir.z) / d;
      if (cosang > Math.cos(0.75) && d < bd) { bd = d; best = e; }
    }
    target = best;
  }
  if (target) {
    const d = Math.hypot(target.x - shooter.x, target.z - shooter.z), t = d / H;
    aimPt = new THREE.Vector3(target.x + Math.sin(target.yaw) * target.speed * t, 0, target.z + Math.cos(target.yaw) * target.speed * t);
    const err = (1 - accuracy) * 14;
    aimPt.x += rnd(-err, err); aimPt.z += rnd(-err, err);
  }
  muzzles.forEach((m, i) => {
    const p = new THREE.Vector3(); m.getWorldPosition(p);
    let v;
    if (aimPt) {
      const tx = aimPt.x + (i - (muzzles.length - 1) / 2) * 1.2 - p.x, tz = aimPt.z - p.z;
      const d = Math.hypot(tx, tz); range = d;
      const t = Math.max(0.3, d / H);
      v = new THREE.Vector3(tx / t, (2 - p.y) / t + 0.5 * 20 * t, tz / t);
      // keep the shot roughly on its broadside
      const along = v.x * dir.x + v.z * dir.z;
      if (along < H * 0.4) v = null;
    }
    if (!v) { const t = range / H; v = dir.clone().multiplyScalar(H).add(vel0); v.y = 0.5 * 20 * t + rnd(-0.6, 0.6); v.x += rnd(-1, 1); v.z += rnd(-1, 1); }
    const mesh = new THREE.Mesh(ballGeo, ballMat); mesh.position.copy(p); scene.add(mesh);
    balls.push({ mesh, v, owner: shooter, life: 6, delay: i * 0.07 });
    setTimeout(() => fx.muzzle(p, dir), i * 70);
  });
  const dist = Math.hypot(shooter.x - player.x, shooter.z - player.z);
  sfx.cannon(clamp(1 - dist / 220, 0.1, 1));
}

function playerFire(side) {
  if (game.state !== 'playing' || !player.alive || player.cd[side] > 0) return;
  player.cd[side] = player.reload;
  fire(player, side);
  game.shake = Math.max(game.shake, 0.35);
  $('hint').style.opacity = 0;
}

function damage(s, amt, p) {
  if (!s.alive) return;
  s.hp -= amt;
  fx.hit(p); sfx.hit(clamp(1 - Math.hypot(s.x - player.x, s.z - player.z) / 200, 0.15, 1));
  if (s === player) { game.shake = Math.max(game.shake, 0.8); popup(p, `-${amt}`, 'dmg'); }
  else { addScore(5); popup(p, `-${amt}`, 'hit'); if (s.hp < s.maxHp * 0.3 && s.state !== 'flee') s.state = 'flee'; }
  if (s.hp <= 0) { s.hp = 0; s.alive = false; s.sinking = 0.001; sfx.sink(); fx.ring(new THREE.Vector3(s.x, 0, s.z), 3, 16, 2.2); fx.hit(new THREE.Vector3(s.x, s.y + 3, s.z));
    if (s === player) { setTimeout(gameOver, 3200); }
    else { game.sunk++; addScore(100 * (s.big ? 3 : 1) + 10 * game.wave); popup(new THREE.Vector3(s.x, 10, s.z), `SUNK! +${100 * (s.big ? 3 : 1) + 10 * game.wave}`); dropLoot(s); }
  }
  updateHud();
}

// ---------- loot ----------
function dropLoot(s) {
  const n = s.big ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const g = makeChest();
    g.scale.setScalar(1.3);
    scene.add(g);
    const l = { mesh: g, x: s.x + rnd(-4, 4), z: s.z + rnd(-4, 4), value: Math.round((s.big ? 60 : 25) + game.wave * 5), life: 45, ph: Math.random() * 6 };
    loot.push(l);
    fx.ring(new THREE.Vector3(l.x, 0, l.z), 1, 7, 1.4);
  }
}

// ---------- ship physics ----------
function floatShip(s, dt) {
  const t = game.t, L = s.mesh.userData.len * 0.4, B = s.mesh.userData.beam * 0.5;
  const fx_ = Math.sin(s.yaw), fz = Math.cos(s.yaw), px = Math.cos(s.yaw), pz = -Math.sin(s.yaw);
  const hC = waveHeight(s.x, s.z, t);
  const hF = waveHeight(s.x + fx_ * L, s.z + fz * L, t), hA = waveHeight(s.x - fx_ * L, s.z - fz * L, t);
  const hP = waveHeight(s.x + px * B, s.z + pz * B, t), hS = waveHeight(s.x - px * B, s.z - pz * B, t);
  const k = 1 - Math.exp(-dt * 4);
  s.y += ((hC + hF + hA) / 3 - 0.6 - s.y) * k;
  s.pitch += (-Math.atan2(hF - hA, 2 * L) - s.pitch) * k;
  s.roll += (Math.atan2(hP - hS, 2 * B) * 0.8 + (s.turn || 0) * s.speed * 0.012 - s.roll) * k;
  let sinkY = 0, sinkRoll = 0, sinkPitch = 0;
  if (s.sinking > 0) {
    s.sinking += dt;
    sinkY = -s.sinking * s.sinking * 0.5; sinkRoll = Math.min(0.9, s.sinking * 0.25); sinkPitch = Math.min(0.4, s.sinking * 0.08);
    if (Math.random() < 0.6) fx.bubbles(new THREE.Vector3(s.x, s.y, s.z));
  }
  s.mesh.position.set(s.x, s.y + sinkY, s.z);
  s.mesh.rotation.set(0, s.yaw, 0);
  s.mesh.userData.body.rotation.set(s.pitch + sinkPitch, 0, s.roll + sinkRoll);
}

function moveShip(s, dt, targetSpeed, turnInput) {
  const acc = targetSpeed > s.speed ? 2.2 : (s.anchor ? 7 : 3);
  s.speed += clamp(targetSpeed - s.speed, -acc * dt, acc * dt);
  const turnRate = 0.62 * (s.turnMul || 1) * (0.35 + 0.65 * Math.min(s.speed / 6, 1)); // [Raul] ship upgrades: rudder
  s.turn += (turnInput - s.turn) * Math.min(1, dt * 5);
  s.yaw += s.turn * turnRate * dt;
  s.x += Math.sin(s.yaw) * s.speed * dt; s.z += Math.cos(s.yaw) * s.speed * dt;
  // wake + bow spray
  if (s.speed > 1.5) {
    const p = s.mesh.userData, back = -p.len * 0.45;
    const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
    const sternX = s.x + n * back, sternZ = s.z + c * back;
    if (Math.random() < 0.9) fx.wake(new THREE.Vector3(sternX, 0, sternZ), new THREE.Vector3(c * (Math.random() < 0.5 ? 1 : -1), 0, -n * (Math.random() < 0.5 ? 1 : -1)));
    if (Math.random() < s.speed / 14) {
      const bx = s.x + n * p.len * 0.5, bz = s.z + c * p.len * 0.5, side = Math.random() < 0.5 ? 1 : -1;
      fx.spray(new THREE.Vector3(bx, s.y + 0.8, bz), new THREE.Vector3(c * side * rnd(2, 5) + n * 2, rnd(2, 5), -n * side * rnd(2, 5) + c * 2));
    }
  }
}

// ---------- enemy AI ----------
function updateEnemy(e, dt) {
  if (!e.alive) { floatShip(e, dt); return; }
  const dx = player.x - e.x, dz = player.z - e.z, d = Math.hypot(dx, dz);
  const toP = Math.atan2(dx, dz);
  let desired = e.yaw, spd = e.maxSpeed * 0.55;
  if (e.state === 'flee') {
    desired = toP + Math.PI; spd = e.maxSpeed;
    if (d > 260) { e.state = 'roam'; e.hp = Math.min(e.maxHp * 0.45, e.hp + 5); }
  } else if (d < 150 && player.alive) {
    e.state = 'engage';
    // circle at ~38 m presenting a broadside
    const ideal = 38;
    const tangent = toP + (Math.sin(e.yaw - toP) > 0 ? 1 : -1) * Math.PI / 2;
    const corr = clamp((d - ideal) / 30, -1, 1) * 0.9;
    desired = tangent - Math.sign(Math.sin(tangent - toP)) * corr;
    spd = e.maxSpeed * 0.8;
  } else {
    e.state = 'roam';
    if (!e.wp || Math.hypot(e.wp[0] - e.x, e.wp[1] - e.z) < 15) e.wp = [player.x + rnd(-120, 120), player.z + rnd(-120, 120)];
    desired = Math.atan2(e.wp[0] - e.x, e.wp[1] - e.z);
    if (d < 230) desired = toP; // spotted you, close in
  }
  // keep apart from other ships
  for (const o of [player, ...enemies]) {
    if (o === e || !o.alive) continue;
    const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz);
    if (od < 14 && od > 0.01) { const push = (14 - od) * 0.9 * dt; e.x += ox / od * push; e.z += oz / od * push; if (od < 22) desired = Math.atan2(ox, oz) * 0.5 + desired * 0.5; }
  }
  const diff = angWrap(desired - e.yaw);
  moveShip(e, dt, spd, clamp(diff * 2, -1, 1));
  floatShip(e, dt);
  // fire when player sits on a broadside
  e.cd -= dt;
  if (e.cd <= 0 && player.alive && d < 70 && e.state !== 'flee' || (e.cd <= 0 && e.state === 'flee' && d < 40)) {
    const [lx, lz] = toLocal(e, player.x, player.z);
    const ang = Math.abs(Math.atan2(lz, Math.abs(lx)));
    if (ang < 0.5) { fire(e, lx > 0 ? 'port' : 'star', player, e.accuracy); e.cd = e.reload * rnd(0.85, 1.25); }
  }
  // damage smoke
  if (e.hp < e.maxHp * 0.6) { e.smokeT -= dt; if (e.smokeT <= 0) { e.smokeT = 0.12; fx.smoke(new THREE.Vector3(e.x + rnd(-2, 2), e.y + 3, e.z + rnd(-3, 3)), e.hp < e.maxHp * 0.35); } }
}

// ---------- cannonballs ----------
const G = 20;
function updateBalls(dt) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.delay > 0) { b.delay -= dt; b.mesh.visible = false; continue; }
    b.mesh.visible = true;
    b.v.y -= G * dt; b.mesh.position.addScaledVector(b.v, dt); b.life -= dt;
    const p = b.mesh.position;
    fx.trail(p);
    let done = false;
    for (const s of [player, ...enemies]) {
      if (s === b.owner || !s.alive) continue;
      if (b.owner !== player && s !== player) continue; // enemies don't hurt each other
      const [lx, lz] = toLocal(s, p.x, p.z);
      const u = s.mesh.userData;
      if (Math.abs(lx) < u.beam / 2 + 0.7 && Math.abs(lz) < u.len / 2 + 0.6 && p.y > s.y - 1.5 && p.y < s.y + u.len * 0.9) {
        damage(s, b.owner === player ? Math.round(rnd(14, 20)) : Math.max(1, Math.round(rnd(6, 10) * (1 + game.wave * 0.04) * (b.owner.dmgMul || 1) * (1 - (player.armor || 0)))), p.clone()); // [Raul] ship upgrades: enemy type damage, armor
        done = true; break;
      }
    }
    if (!done && p.y < waveHeight(p.x, p.z, game.t)) { fx.splash(p.clone()); sfx.splash(clamp(1 - p.distanceTo(player.mesh.position) / 150, 0.05, 0.8)); done = true; }
    if (done || b.life <= 0) { scene.remove(b.mesh); balls.splice(i, 1); }
  }
}

// ---------- input ----------
const keys = {};
const held = { left: false, right: false };
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (game.state === 'playing') {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') setSail(player.sail + 1);
    if (e.code === 'KeyS' || e.code === 'ArrowDown') setSail(player.sail - 1);
    if (e.code === 'KeyQ') playerFire('port');
    if (e.code === 'KeyE') playerFire('star');
    if (e.code === 'Space') { toggleAnchor(); e.preventDefault(); }
    if (e.code === 'KeyC') resetCamera();
  }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyM') toggleSound();
  if (e.code === 'KeyF') toggleFull();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; held.left = held.right = false; });

function holdButton(el, onDown, onUp) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture?.(e.pointerId); el.classList.add('on'); onDown(); });
  const up = (e) => { el.classList.remove('on'); onUp && onUp(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
}
holdButton($('steer-left'), () => held.left = true, () => held.left = false);
holdButton($('steer-right'), () => held.right = true, () => held.right = false);
holdButton($('sail-up'), () => setSail(player.sail + 1));
holdButton($('sail-down'), () => setSail(player.sail - 1));
holdButton($('anchor'), toggleAnchor);
holdButton($('fire-port'), () => playerFire('port'));
holdButton($('fire-star'), () => playerFire('star'));

function setSail(n) { player.sail = clamp(n, 0, 3); if (player.sail > 0) player.anchor = false; updateHud(); }
function toggleAnchor() { player.anchor = !player.anchor; if (player.anchor) player.sail = 0; else if (player.sail === 0) player.sail = 1; updateHud(); }
function resetCamera() {
  const portrait = camera.aspect < 1, k = Math.pow(player.mesh.userData.shipScale || 1, 0.85), dist = (portrait ? 46 : 34) * k, up = (portrait ? 24 : 16) * k; // [Raul] upgrade visuals: framing scales with hull
  const back = new THREE.Vector3(-Math.sin(player.yaw) * dist, up, -Math.cos(player.yaw) * dist);
  camera.position.copy(player.mesh.position).add(back);
}
function toggleSound() { setMuted(!muted); $('btn-sound').textContent = muted ? '🔇' : '🔊'; }
function toggleFull() { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); }
$('btn-sound').textContent = muted ? '🔇' : '🔊';
$('btn-sound').onclick = toggleSound; $('btn-cam').onclick = resetCamera; $('btn-full').onclick = toggleFull;
$('btn-pause').onclick = togglePause; $('btn-resume').onclick = togglePause;
$('btn-quit').onclick = () => { $('pause').classList.add('hidden'); toTitle(); };

function togglePause() {
  if (game.state === 'playing') { game.state = 'paused'; $('pause').classList.remove('hidden'); }
  else if (game.state === 'paused') { game.state = 'playing'; $('pause').classList.add('hidden'); }
}

// ---------- HUD ----------
function updateHud() {
  $('score').textContent = game.score; $('wave').textContent = game.wave; $('gold').textContent = game.gold; $('sunk').textContent = game.sunk;
  $('player-hp').style.width = `${(player.hp / player.maxHp) * 100}%`;
  $('sail-level').textContent = player.sail;
  $('anchor').classList.toggle('on', player.anchor);
  const alive = enemies.filter(e => e.alive).length;
  $('enemies-left').textContent = alive ? `${alive} rug ship${alive > 1 ? 's' : ''} left` : '';
}
function addScore(n) { game.score += n; }
let bannerTimer = 0;
function banner(text, sub = '') {
  const b = $('banner'); b.innerHTML = `${text}${sub ? `<div style="font-size:0.38em;color:#fff;text-align:center">${sub}</div>` : ''}`;
  b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.add('hidden'), 2600);
}
const _v = new THREE.Vector3();
function screenPos(p) { _v.copy(p).project(camera); return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight, vis: _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1 }; }
function popup(p, text, cls = '') {
  const s = screenPos(p); if (!s.vis) return;
  const el = document.createElement('div'); el.className = `popup ${cls}`; el.textContent = text;
  el.style.left = `${s.x}px`; el.style.top = `${s.y}px`; $('popups').appendChild(el); setTimeout(() => el.remove(), 1400);
}
function updateBars() {
  for (const e of enemies) {
    const show = e.alive && game.state !== 'title';
    if (!show) { e.bar.style.display = 'none'; continue; }
    const s = screenPos(new THREE.Vector3(e.x, e.y + e.mesh.userData.len * 1.05, e.z));
    const d = Math.hypot(e.x - player.x, e.z - player.z);
    if (!s.vis || d > 260) { e.bar.style.display = 'none'; continue; }
    e.bar.style.display = 'block'; e.bar.style.left = `${s.x}px`; e.bar.style.top = `${s.y}px`;
    e.bar.style.opacity = clamp(1.4 - d / 220, 0.35, 1);
    e.fill.style.width = `${(e.hp / e.maxHp) * 100}%`;
    e.bar.classList.toggle('flee', e.state === 'flee');
  }
}
const radar = $('radar'), rctx = radar.getContext('2d');
function drawRadar() {
  const W = radar.width, R = W / 2, range = 260;
  rctx.clearRect(0, 0, W, W);
  rctx.strokeStyle = 'rgba(255,205,119,0.25)'; rctx.lineWidth = 1;
  [0.33, 0.66].forEach(f => { rctx.beginPath(); rctx.arc(R, R, R * f, 0, 7); rctx.stroke(); });
  const dot = (x, z, color, r) => {
    const [lx, lz] = toLocal(player, x, z);
    let px = -lx / range * R, py = -lz / range * R; // heading up, port on the left
    const m = Math.hypot(px, py); if (m > R - 5) { px *= (R - 5) / m; py *= (R - 5) / m; }
    rctx.fillStyle = color; rctx.beginPath(); rctx.arc(R + px, R + py, r, 0, 7); rctx.fill();
  };
  loot.forEach(l => dot(l.x, l.z, '#ffcd77', 3));
  enemies.forEach(e => e.alive && dot(e.x, e.z, e.state === 'flee' ? '#ff9b9b' : '#fa0d0d', e.big ? 5 : 3.5));
  rctx.fillStyle = '#fff'; rctx.beginPath(); rctx.moveTo(R, R - 7); rctx.lineTo(R - 5, R + 5); rctx.lineTo(R + 5, R + 5); rctx.fill();
}
function updateFireButtons() {
  for (const [side, id] of [['port', 'fire-port'], ['star', 'fire-star']]) {
    const el = $(id), f = player.cd[side] / player.reload;
    el.querySelector('.cd').style.width = `${clamp(f, 0, 1) * 100}%`;
    el.classList.toggle('ready', f <= 0);
  }
  $('knots').textContent = `${(player.speed * 1.2).toFixed(1)} kn`;
}

// ---------- title / wallet ----------
const walletInput = $('wallet-input'), nameInput = $('name-input');
walletInput.value = game.wallet; nameInput.value = game.name;
function validateWallet() {
  const v = walletInput.value.trim(), ok = isValidSolanaAddress(v);
  walletInput.classList.toggle('good', ok); walletInput.classList.toggle('bad', !!v && !ok);
  $('wallet-msg').textContent = !v ? 'Required. Only used to key your leaderboard score. Never asks for keys or signatures.' : ok ? `Ahoy ${shortWallet(v)}! Ready to sail.` : 'That doesn’t look like a Solana address (base58, 32–44 characters).';
  $('btn-start').disabled = !ok;
  return ok;
}
walletInput.addEventListener('input', validateWallet);
walletInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && validateWallet()) startGame(); });
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && validateWallet()) startGame(); });
validateWallet();
$('btn-rewards').textContent = `🔒 ${rewardsStatus().label.toUpperCase()}`;
$('btn-start').onclick = startGame;
document.querySelectorAll('.lb-mode').forEach(el => el.textContent = `(${leaderboard.mode})`);

// leaderboard period tabs (DAY / WEEK / MONTH / YEAR / ALL-TIME), remembered per device
let lbPeriod = localStorage.getItem('pfp_lb_period');
if (!PERIODS.some(p => p.id === lbPeriod)) lbPeriod = 'all';
const boardTokens = new WeakMap();
function buildTabs() {
  document.querySelectorAll('.lb-tabs').forEach(wrap => {
    wrap.innerHTML = '';
    for (const p of PERIODS) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = p.label; b.dataset.period = p.id; b.title = p.desc;
      b.setAttribute('role', 'tab');
      b.onclick = () => { lbPeriod = p.id; localStorage.setItem('pfp_lb_period', p.id); syncTabs(); refreshBoards(); };
      wrap.appendChild(b);
    }
  });
  syncTabs();
}
function syncTabs() {
  document.querySelectorAll('.lb-tabs button').forEach(b => {
    const on = b.dataset.period === lbPeriod;
    b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
    if (on && b.parentElement.scrollWidth > b.parentElement.clientWidth) b.parentElement.scrollLeft = b.offsetLeft - (b.parentElement.clientWidth - b.offsetWidth) / 2;
  });
}
function refreshBoards() {
  if (!$('title').classList.contains('hidden')) renderBoard($('board-title'));
  if (!$('gameover').classList.contains('hidden')) renderBoard($('board-over'));
}
async function renderBoard(el) {
  const token = {}; boardTokens.set(el, token);
  const period = lbPeriod, pd = PERIODS.find(p => p.id === period);
  let rows = [];
  try { rows = await leaderboard.getTop(10, period); } catch (e) { console.warn(e); }
  if (boardTokens.get(el) !== token) return; // a newer tab click won
  const where = leaderboard.lastWhere === 'online' ? 'online' : (leaderboard.remote ? 'this device · online board offline' : 'this device only');
  const label = `(${where}${period === 'all' ? '' : ` · ${pd.desc}`})`;
  el.closest('.board-wrap')?.querySelectorAll('.lb-mode').forEach(m => m.textContent = label);
  el.innerHTML = '';
  if (!rows.length) { el.innerHTML = `<li class="empty">${period === 'all' ? 'No scores yet. Be the first legend of the storm.' : `No scores in the ${pd.desc} yet. Claim the top spot!`}</li>`; return; }
  for (const r of rows) {
    const li = document.createElement('li');
    if (r.wallet === game.wallet) li.className = 'me';
    li.textContent = r.name ? `${r.name} · ${shortWallet(r.wallet)}` : shortWallet(r.wallet);
    const b = document.createElement('b'); b.textContent = r.score; li.appendChild(b);
    el.appendChild(li);
  }
}
buildTabs();

function clearWorld() {
  for (const e of enemies) { scene.remove(e.mesh); disposeShip(e.mesh); e.bar.remove(); }
  enemies.length = 0;
  for (const b of balls) scene.remove(b.mesh); balls.length = 0;
  for (const l of loot) scene.remove(l.mesh); loot.length = 0;
  fx.clear();
}

function startGame() {
  if (!validateWallet()) return;
  game.wallet = walletInput.value.trim(); saveWallet(game.wallet);
  game.name = nameInput.value.trim().slice(0, 20); saveName(game.name);
  initAudio();
  clearWorld();
  scene.remove(player.mesh); disposeShip(player.mesh); player = makePlayer();
  Object.assign(game, { state: 'playing', score: 0, gold: 0, wave: 0, sunk: 0, saved: false, startTime: performance.now(), waveTimer: 1.2, clearAck: false });
  game.captain = CAPTAINS[Math.floor(Math.random() * CAPTAINS.length)];
  $('captain-img').src = `assets/captains/${game.captain}.jpg`;
  $('captain-name').textContent = game.name ? `${game.name.toUpperCase()} · #${game.captain}` : `CAPT. #${game.captain}`;
  $('wallet-short').textContent = shortWallet(game.wallet);
  ['title', 'gameover', 'pause'].forEach(id => $(id).classList.add('hidden'));
  $('hud').classList.remove('hidden'); $('hint').style.opacity = 1;
  resetShop(); // [Raul] ship upgrades: fresh run, base stats
  resetCamera();
  updateHud();
  rotateTimer = 0; updateRotateHint();
  banner('SET SAIL!', 'hunt the rug ships');
}

function toTitle() {
  game.state = 'title';
  clearWorld();
  $('hud').classList.add('hidden'); $('gameover').classList.add('hidden'); $('title').classList.remove('hidden');
  scene.remove(player.mesh); disposeShip(player.mesh); player = makePlayer(); player.sail = 1;
  renderBoard($('board-title'));
}

async function gameOver() {
  if (game.state === 'over') return;
  game.state = 'over';
  $('go-score').textContent = game.score; $('go-wave').textContent = game.wave; $('go-sunk').textContent = game.sunk; $('go-gold').textContent = game.gold + (game.goldSpent || 0); // [Raul] gold looted, incl. spent
  $('go-wallet').textContent = `Wallet ${shortWallet(game.wallet)}`;
  $('go-name').value = game.name; $('save-msg').textContent = 'Save your score to the leaderboard (best score per wallet counts).';
  $('btn-save').disabled = false;
  $('gameover').classList.remove('hidden');
  renderBoard($('board-over'));
}
async function saveScore() {
  if (game.saved) return;
  game.saved = true; $('btn-save').disabled = true;
  game.name = $('go-name').value.trim().slice(0, 20); saveName(game.name);
  const r = await leaderboard.submit({ wallet: game.wallet, name: game.name, score: game.score, wave: game.wave, sunk: game.sunk, duration_s: Math.round((performance.now() - game.startTime) / 1000) });
  $('save-msg').textContent = r.where === 'online' ? 'Saved to the online leaderboard!' : 'Saved on this device.';
  await renderBoard($('board-over'));
}
$('btn-save').onclick = saveScore;
$('go-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveScore(); });
$('btn-again').onclick = async () => { await saveScore(); startGame(); };
$('btn-menu').onclick = async () => { await saveScore(); toTitle(); };

// ---------- main loop ----------
const clock = new THREE.Clock();
let lastTarget = new THREE.Vector3();
let camShipK = 1; // [Raul] upgrade visuals
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const running = game.state === 'playing' || game.state === 'over' || game.state === 'title';
  if (running) game.t += dt;
  const t = game.t;

  if (running) {
    // player
    if (game.state === 'playing' && player.alive) {
      const turn = ((keys.KeyA || keys.ArrowLeft || held.left) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight || held.right) ? 1 : 0);
      moveShip(player, dt, player.anchor ? 0 : player.sail * 4.2 * (player.speedMul || 1), turn); // [Raul] ship upgrades: sails
      player.cd.port = Math.max(0, player.cd.port - dt); player.cd.star = Math.max(0, player.cd.star - dt);
      if (player.hp < player.maxHp * 0.4 && Math.random() < 0.15) fx.smoke(new THREE.Vector3(player.x + rnd(-2, 2), player.y + 3, player.z + rnd(-3, 3)), player.hp < player.maxHp * 0.25);
      // waves
      if (!enemies.some(e => e.alive)) {
        if (!game.clearAck) {
          game.clearAck = true; game.waveTimer = game.wave === 0 ? 1.2 : 4;
          if (game.wave > 0) { banner('WAVE CLEARED!', `+${50 * game.wave} · hull repaired`); player.hp = Math.min(player.maxHp, player.hp + 25); addScore(50 * game.wave); updateHud(); }
        }
        game.waveTimer -= dt;
        if (game.waveTimer <= 0) { game.clearAck = false; startWave(); }
      }
    } else if (game.state === 'title') {
      moveShip(player, dt, 4, Math.sin(t * 0.1) * 0.25);
    } else if (game.state === 'playing' || game.state === 'over') {
      player.speed *= 0.98;
    }
    floatShip(player, dt);
    for (const e of enemies) updateEnemy(e, dt);
    // remove fully sunk ships
    for (let i = enemies.length - 1; i >= 0; i--) if (!enemies[i].alive && enemies[i].sinking > 7) { scene.remove(enemies[i].mesh); disposeShip(enemies[i].mesh); enemies[i].bar.remove(); enemies.splice(i, 1); updateHud(); }
    updateBalls(dt);
    // loot
    for (let i = loot.length - 1; i >= 0; i--) {
      const l = loot[i]; l.life -= dt;
      l.mesh.position.set(l.x, waveHeight(l.x, l.z, t) + 0.1 + Math.sin(t * 2 + l.ph) * 0.1, l.z); l.mesh.rotation.y += dt * 0.8;
      if (Math.random() < 0.3) fx.sparkle(l.mesh.position);
      if (player.alive && Math.hypot(l.x - player.x, l.z - player.z) < 10) {
        game.gold += l.value; addScore(l.value); sfx.coin(); popup(l.mesh.position.clone().setY(4), `+${l.value} GOLD`); scene.remove(l.mesh); loot.splice(i, 1); updateHud(); continue;
      }
      if (l.life <= 0) { scene.remove(l.mesh); loot.splice(i, 1); }
    }
    animateShip(player.mesh, t, player.anchor ? 0 : player.sail / 3);
    for (const e of enemies) animateShip(e.mesh, t + 1.3, e.alive ? 0.8 : 0.3);
    fx.update(dt, t);

    // lightning
    game.nextLightning -= dt;
    if (game.nextLightning <= 0) { game.flash = 1; game.nextLightning = rnd(6, 16); sfx.thunder(rnd(0.3, 1.5)); sky.uniforms.uBolt.value.copy(bolt.strike(camera.position, Math.atan2(camera.position.x - player.x, camera.position.z - player.z) + Math.PI + rnd(-0.9, 0.9))); }
  }
  game.flash = Math.max(0, game.flash - dt * 2.8);
  const fl = game.flash > 0 ? game.flash * (0.6 + 0.4 * Math.sin(game.flash * 40)) : 0;
  ocean.uniforms.uFlash.value = sky.uniforms.uFlash.value = rain.uniforms.uFlash.value = fl;
  hemi.intensity = 1.9 + fl * 3;
  bolt.mesh.visible = game.flash > 0.3; bolt.mesh.material.opacity = clamp(fl * 1.6, 0, 1);
  wind.uTime.value = t; chestTime(t);
  // hull foam collars for the water shader (nearest ships first)
  { const H = ocean.uniforms.uHulls.value; let k = 0;
    for (const s of [player, ...enemies]) { if (k >= MAX_HULLS) break; if (s.sinking > 3) continue; ocean.uniforms.uHullV.value[k] = s.speed; H[k++].set(s.x, s.z, s.yaw, s.mesh.userData.len); }
    ocean.uniforms.uHullCount.value = k; }

  // ocean follows the player, snapped to the grid so waves don't swim
  const step = ocean.mesh.userData.step;
  ocean.mesh.position.set(Math.round(player.x / step) * step, 0, Math.round(player.z / step) * step);
  ocean.uniforms.uTime.value = sky.uniforms.uTime.value = rain.uniforms.uTime.value = t;

  // camera follows the ship, orbit offset preserved
  const shipK = player.mesh.userData.shipScale || 1; // [Raul] upgrade visuals: bigger hulls pull the camera back to stay framed
  const tgt = new THREE.Vector3(player.x, player.y + 4 * shipK + 3 * (shipK - 1), player.z);
  camera.position.add(tgt.clone().sub(lastTarget)); lastTarget.copy(tgt);
  if (Math.abs(shipK - camShipK) > 1e-4) { const f = Math.pow(shipK / camShipK, 0.85); camera.position.sub(tgt).multiplyScalar(f).add(tgt); controls.maxDistance = (camera.aspect < 1 ? 120 : 95) * Math.max(1, shipK); camShipK = shipK; }
  controls.target.copy(tgt);
  if (game.state === 'title') { const off = camera.position.clone().sub(tgt).applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.06); camera.position.copy(tgt).add(off); }
  controls.update();
  const minY = waveHeight(camera.position.x, camera.position.z, t) + 2.5;
  if (camera.position.y < minY) camera.position.y = minY;
  if (game.shake > 0) { camera.position.x += rnd(-1, 1) * game.shake * 0.4; camera.position.y += rnd(-1, 1) * game.shake * 0.4; game.shake = Math.max(0, game.shake - dt * 2.5); }
  sky.mesh.position.copy(camera.position);
  islands.update(t, camera.position);
  if (HIGH) { sun.target.position.set(player.x, 0, player.z); sun.position.copy(sun.target.position).add(SUN_OFF); }
  rain.uniforms.uCam.value.copy(camera.position);

  if (game.state !== 'title') { updateBars(); drawRadar(); updateFireButtons(); }
  if (composer) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- viewport (Safari / in-app browsers: size to the *visible* area) ----------
let rotateDismissed = localStorage.getItem('pfp_rotate_dismissed') === '1', rotateTimer = 0;
function viewSize() {
  const vv = window.visualViewport;
  const w = Math.round(vv ? vv.width : innerWidth) || innerWidth;
  const h = Math.round(vv ? vv.height : innerHeight) || innerHeight;
  return [w, h];
}
function fitCamera(w, h) {
  const aspect = w / h;
  camera.aspect = aspect;
  // keep ~60° of horizontal view in portrait: widen vertical FOV, capped to avoid fisheye
  const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30)) / aspect));
  camera.fov = clamp(vfov, 55, 78);
  controls.maxDistance = (aspect < 1 ? 120 : 95) * Math.max(1, player?.mesh?.userData?.shipScale || 1); // [Raul] upgrade visuals
  camera.updateProjectionMatrix();
}
function isPortrait() { const [w, h] = viewSize(); return h > w; }
function updateRotateHint() {
  const show = isPortrait() && game.state === 'playing' && !rotateDismissed && isMobile;
  $('rotate').classList.toggle('show', show);
  if (show && !rotateTimer) rotateTimer = setTimeout(() => { $('rotate').classList.remove('show'); rotateDismissed = true; }, 9000);
}
$('rotate-x').addEventListener('pointerdown', (e) => { e.stopPropagation(); rotateDismissed = true; localStorage.setItem('pfp_rotate_dismissed', '1'); $('rotate').classList.remove('show'); });
function onResize() {
  const [w, h] = viewSize();
  const root = document.documentElement.style;
  root.setProperty('--app-w', `${w}px`); root.setProperty('--app-h', `${h}px`);
  fitCamera(w, h);
  renderer.setSize(w, h);
  if (composer) {
    const pr = renderer.getPixelRatio();
    composer.setPixelRatio(pr); composer.setSize(w, h);
    composer.userData.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
  }
  // point sprites scale with screen height AND field of view, so portrait (wide FOV) doesn't bloat particles
  fx.setScale(h * renderer.getPixelRatio() * 0.286 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  // iOS sometimes scrolls the layout viewport (toolbars / keyboard); pin it back unless typing
  if (document.activeElement?.tagName !== 'INPUT') window.scrollTo(0, 0);
  updateRotateHint();
}
let resizeQueued = false;
function queueResize() { if (resizeQueued) return; resizeQueued = true; requestAnimationFrame(() => { resizeQueued = false; onResize(); }); }
addEventListener('resize', queueResize);
addEventListener('orientationchange', () => { queueResize(); setTimeout(onResize, 250); setTimeout(onResize, 700); });
window.visualViewport?.addEventListener('resize', queueResize);
window.visualViewport?.addEventListener('scroll', queueResize);
document.addEventListener('focusout', () => setTimeout(onResize, 120));
onResize();
lastTarget.set(player.x, player.y + 4, player.z);
renderBoard($('board-title'));
$('loading').classList.add('hidden');
requestAnimationFrame(frame);

// PWA: offline cache
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then(r => console.log('[pwa] service worker ready, scope', r.scope)).catch(e => console.warn('[pwa] sw failed', e));
}

// [Raul] ship upgrades: SHOP button (top HUD row) + shipwright overlay
initShop({ game, getPlayer: () => player, updateHud, sfx, camera, rebuildShip: rebuildPlayerShip }); // [Raul] upgrade visuals: camera + ship rebuild

// Debug / test hooks (harmless; the leaderboard can't trust the client anyway, see README)
window.PFP = { game, get player() { return player; }, enemies, balls, loot, spawnEnemy, fire: playerFire, damage, startGame, gameOver, quality, camera };
