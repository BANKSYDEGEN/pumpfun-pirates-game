// PUMPFUN PIRATES · Storm Hunt — main game
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createOcean, createSky, createRain, createBolt, waveHeight, FOG_COLOR, STORM_FOG, MAX_HULLS } from './ocean.js';
import { createWakes } from './wake.js'; // [aaa water] Kelvin wake trails
import { buildShip, animateShip, makeSkullTexture, makePillTexture, wind, disposeShip, ENEMY_SCHEMES } from './ships.js';
import { makeChest, chestTime, createIslands } from './props.js';
import { toon } from './toon.js'; // [enemy variety] ram spike
import { FX } from './fx.js';
import { ARMORED_ENEMIES as ARMORED } from './soundProfile.js'; // [Raul] damage sounds
import { initAudio, sfx, setMuted, muted, setLevel, setMusic, updateAmbient, onAudioState, setLoadout } from './audio.js'; // [Raul] sound upgrades
import { leaderboard, PERIODS, LB_SIZE, DAILY_TAB } from './leaderboard.js';
import { dailySeed, waveRng, untilNextDaily } from './daily.js'; // [daily] seeded run per UTC day
import { isValidSolanaAddress, shortWallet, getSavedWallet, saveWallet, getSavedName, saveName } from './wallet.js';
import { WALLET_VERIFY_ENABLED, WALLET_SAVE_ENABLED } from './config.js'; // [wallet verify] off = walletVerify.js is never loaded
import { QUALITY } from './config.js';
import './tokenChip.js'; // title screen $AHOY CA chip + socials
import { prepareShare, shareScore } from './shareCard.js'; // game-over score card
import { equippedSkin } from './skins.js';

// [Raul] ship upgrades
import { gunList, BALL_DMG } from './upgrades.js';
import { waveRoster, applyEnemyType, ENEMY_BUILDS, updateSpecialEnemy, RUN, updateRepair, lateWave, spawnBossEscorts } from './enemyTypes.js'; // [enemy variety] builds + AI
import { initShop, resetShop, waveSkinUnlock } from './shop.js';
import { createHealthDrops } from './healthDrops.js'; // [health drops]
import { initTutorial, maybeShowTutorial, close as closeTutorial } from './tutorial.js'; // [tutorial]
import { compileShip, setRenderContext, prebuildNext } from './upgradeVisuals.js';
import { createEscorts, ESCORT, escortStep } from './escorts.js'; // [escorts] hired ally ships // [Raul] upgrade visuals: player ship compiled from upgrade traits + skin

const $ = (id) => document.getElementById(id);
let rand = Math.random; // [daily] swapped for a seeded stream while a DAILY wave spawns / drops chests
const rnd = (a, b) => a + rand() * (b - a);
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
const wakes = createWakes(quality, ocean.uniforms.uWaves); scene.add(wakes.mesh); // [aaa water] after the ocean
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
const PLAYER_SHIP = { mainSailMap: sailTex, flagMap: flagTex, light: true, shadows: HIGH, quality };
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
// [Raul] pre-compile likely next purchases + warm shaders, only while not actively sailing (title / shop / pause)
setRenderContext({ renderer, scene, camera, canWork: () => game.state !== 'playing' });
const prebuildShips = (levels, gold) => prebuildNext(levels, { gold });
prebuildShips({}, 0); // title screen idle time: first-tier ships ready before the first shop visit
const enemies = [], balls = [], loot = [];
const ballGeo = new THREE.SphereGeometry(0.45, 10, 8);
const ballMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.6 });
const ballPool = []; // [escorts] pooled cannonballs: meshes stay in the scene, hidden when idle
function getBall() { const m = ballPool.pop() || (() => { const b = new THREE.Mesh(ballGeo, ballMat); scene.add(b); return b; })(); m.visible = false; return m; }
function freeBall(m) { m.visible = false; ballPool.push(m); }

// ---------- enemies ----------
function spawnEnemy(x, z, tier = 1, type = null) {
  const big = tier >= 2;
  const build = ENEMY_BUILDS[type]; // [enemy variety] rammer / runner hulls, rigs and colours
  const mesh = buildShip(build ? { ...build, flagMap: pillTex, flagScale: 1.2, shadows: HIGH } : {
    len: big ? 19 : rnd(13, 15.5), beam: big ? 6 : rnd(4.4, 5), depth: 2.8,
    scheme: big ? 'boss' : ENEMY_SCHEMES[Math.floor(rand() * ENEMY_SCHEMES.length)], boss: big,
    flagMap: pillTex, flagScale: 1.45, cannonsPerSide: big ? 4 : 2, masts: big ? 3 : 2, shadows: HIGH,
  });
  if (build) decorateBuild(mesh, type);
  scene.add(mesh);
  const hp = Math.round((big ? 160 : 70) * (1 + game.wave * 0.12));
  const bar = document.createElement('div'); bar.className = 'ehp';
  const name = big ? 'THE COMMODORE' : ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)];
  bar.innerHTML = `<div class="name">${name}</div><div class="bar"><div class="fill"></div></div>`;
  $('bars').appendChild(bar);
  const e = {
    mesh, x, z, yaw: rand() * 6.28, speed: 3, turn: 0, hp, maxHp: hp, state: 'roam', wp: null, cd: rnd(2, 4), roll: 0, pitch: 0, y: 0,
    sinking: 0, alive: true, bar, fill: bar.querySelector('.fill'), big, maxSpeed: (big ? 6.5 : rnd(7, 9)) * (1 + Math.min(game.wave, 10) * 0.02),
    reload: Math.max(2.2, 5 - game.wave * 0.25), accuracy: clamp(0.55 + game.wave * 0.05, 0.5, 0.9), smokeT: 0,
  };
  if (type) applyEnemyType(e, type, game.wave); // [Raul] ship upgrades: enemy types
  { const L = lateWave(game.wave); if (L.hp !== 1) { e.hp = e.maxHp = Math.round(e.maxHp * L.hp); e.dmgMul = (e.dmgMul || 1) * L.dmg; e.lateDmg = L.dmg; } } // [late waves] tougher past wave 8
  if (type === 'runner') { e.yaw = Math.atan2(x - player.x, z - player.z); e.speed = 6; } // [enemy variety] already running when it appears
  enemies.push(e);
  return e;
}

// [enemy variety] silhouette extras: an iron ram on the rammer's bow, treasure chests on the runner's deck
const ramGeo = new THREE.ConeGeometry(0.75, 4.2, 8); ramGeo.rotateX(Math.PI / 2); ramGeo.userData = {};
const ramMat = toon(0x3a3f47, null, { key: 'ev-ram' }), ramBand = toon(0xfa0d0d, null, { key: 'ev-ram-band' });
const ramBandGeo = new THREE.TorusGeometry(0.78, 0.16, 6, 14);
function decorateBuild(mesh, type) {
  const ud = mesh.userData;
  if (type === 'rammer') {
    const ram = new THREE.Mesh(ramGeo, ramMat); ram.position.set(0, 0.9, ud.len / 2 + 1.4); ram.userData.sharedGeo = true; ud.body.add(ram);
    const band = new THREE.Mesh(ramBandGeo, ramBand); band.position.set(0, 0.9, ud.len / 2 - 0.4); band.userData.sharedGeo = true; ud.body.add(band);
  } else if (type === 'runner') {
    for (const [x, z, r] of [[-0.7, -1.2, 0.3], [0.8, 0.4, -0.5], [0, 2.2, 0.1]]) { const c = makeChest(); c.scale.setScalar(1.05); c.position.set(x, ud.deckY + 0.05, z); c.rotation.y = r; c.traverse(o => { o.userData.sharedGeo = true; if (o.material && o.material.isShaderMaterial) o.visible = false; }); ud.body.add(c); } // no loot beam while it's still on deck
  }
}
// [enemy variety] remove a ship that got away (no sink, no loot, no score)
function despawnEnemy(e) {
  e.alive = false; e.escaped = true; e.sinking = 99; e.mesh.visible = false; e.bar.style.display = 'none'; // the sunk-ship sweep in the loop removes + disposes it (no splice mid-iteration)
  popup(new THREE.Vector3(player.x, 8, player.z), 'IT GOT AWAY!', 'hit'); updateHud();
}
let specialTarget = null; // [escorts] who the special AI (rammer / boss barrage) is after this frame
// [escorts] enemies go for the nearest of you / your escorts, but an escort only wins if it's clearly closer (ESCORT.aggro); re-picked every ~1.5 s
function enemyTarget(e, dt) {
  e.tgtT = (e.tgtT || 0) - dt;
  if (e.tgtT > 0 && e.tgt && e.tgt.alive) return e.tgt;
  e.tgtT = 1.5;
  let best = player, bd = player.alive ? Math.hypot(player.x - e.x, player.z - e.z) : 1e9;
  for (const a of escorts.list) { if (!a.alive) continue; const d = Math.hypot(a.x - e.x, a.z - e.z) * ESCORT.aggro; if (d < bd) { bd = d; best = a; } }
  return (e.tgt = best);
}
const specialCtx = { get player() { return specialTarget || player; }, enemies, game, moveShip: (...a) => moveShip(...a), floatShip: (...a) => floatShip(...a), fire: (...a) => fire(...a), damage: (...a) => damage(...a), spawnEnemy: (...a) => spawnEnemy(...a), despawn: (e) => despawnEnemy(e), fx, popup: (...a) => popup(...a), sfx, V3: THREE.Vector3 };

// [spawn ring] waves appear 195-300 m out (was 130-210): deep in the fog, inside the ocean mesh (350 m half-size on low)
const SPAWN_MIN = 195, SPAWN_MAX = 300, SPOT_RANGE = SPAWN_MAX + 20;
function startWave() {
  game.wave++;
  waveSkinUnlock(game.wave); // [wave skins] waves 5, 10, 15...: free skin unlock toast (normal + DAILY)
  escorts.onWave(); // [escorts] full hull, stats follow the wave
  if (player.alive) player.hp = player.maxHp; // full hull at the start of every wave (maxHp includes hull upgrades)
  const daily = game.mode === 'daily'; // [daily] same mix, bearings, ranges, hulls and chest scatter for everyone today
  const roster = waveRoster(game.wave, daily ? waveRng(game.seed, game.wave, 'mix') : Math.random), n = roster.length; // [Raul] ship upgrades: sloops / frigates / galleons / boss
  if (daily) { rand = waveRng(game.seed, game.wave, 'spawn'); game.lootRng = waveRng(game.seed, game.wave, 'loot'); game.dropRng = waveRng(game.seed, game.wave, 'drops'); }
  let bossNow = null;
  try {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), d = rnd(SPAWN_MIN, SPAWN_MAX); // [spawn ring] farther out (was 130-210 m); same rng draws so DAILY stays seeded
      const e = spawnEnemy(player.x + Math.cos(a) * d, player.z + Math.sin(a) * d, roster[i] === 'boss' ? 2 : 1, roster[i]);
      if (roster[i] === 'boss') bossNow = e;
    }
    // [boss escorts] the DEV WALLET sails in with his 2 escorts flanking him (after the roster: fixed DAILY draw order)
    if (bossNow) { bossNow.yaw = Math.atan2(player.x - bossNow.x, player.z - bossNow.z); bossNow.escortList = spawnBossEscorts(bossNow, spawnEnemy); bossNow.escortList.forEach((s, i) => { s.leader = bossNow; s.slotN = i; s.state = 'follow'; s.tgt = null; s.tgtT = 0; }); }
  } finally { rand = Math.random; }
  banner(`WAVE ${game.wave}`, game.wave % 4 === 0 ? 'THE COMMODORE APPROACHES' : `${n} rug ships on the horizon`);
  if (roster.includes('boss')) sfx.boss(); else sfx.waveStart(); sfx.spawnBell(); // [Raul] sound upgrades (bell: SPYGLASS III)
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
    const mesh = getBall(); mesh.position.copy(p);
    balls.push({ mesh, v, owner: shooter, life: 6, delay: i * 0.07 });
    setTimeout(() => fx.muzzle(p, dir), i * 70);
  });
  const dist = Math.hypot(shooter.x - player.x, shooter.z - player.z);
  if (shooter === player) sfx.broadside(muzzles.length); // [Raul] sound upgrades: one boom per gun that fires, CANNONS tier sets the sound
  else sfx.enemyBroadside(muzzles.length, clamp(1 - dist / 220, 0, 1), !!shooter.big);
}

function playerFire(side) {
  if (game.state !== 'playing' || !player.alive || player.cd[side] > 0) return;
  player.cd[side] = player.reload;
  fire(player, side);
  game.shake = Math.max(game.shake, 0.35);
  $('hint').style.opacity = 0;
}

function damage(s, amt, p, src = null) {
  if (!s.alive) return;
  s.hp -= amt;
  fx.hit(p); sfx.impact({ dmg: amt, maxHp: s.maxHp, kill: s.hp <= 0, onPlayer: s === player, boss: s.type === 'boss' || src?.type === 'boss', armor: s === player ? 0 : (ARMORED[s.type] || 0), v: s === player ? 1 : clamp(1 - Math.hypot(s.x - player.x, s.z - player.z) / 200, 0.15, 1) }); // [Raul] damage sounds: tier from damage dealt (soundProfile.js)
  if (s === player) { s.calm = 0; s.repT = 0; game.shake = Math.max(game.shake, 0.8); popup(p, `-${amt}`, 'dmg'); } // [repair] a hit resets the 20 s wait
  else if (s.ally) { s.calm = 0; s.repT = 0; } // [escorts] no score for hits on your own escorts
  else { s.calm = 0; s.repT = 0; addScore(src?.ally ? 3 : 5); popup(p, `-${amt}`, 'hit'); if (s.hp < s.maxHp * 0.3 && s.state !== 'flee') s.state = 'flee'; }
  if (s.hp <= 0) { s.hp = 0; s.alive = false; s.sinking = 0.001; sfx.sink(!!s.big); fx.ring(new THREE.Vector3(s.x, 0, s.z), 3, 16, 2.2); fx.hit(new THREE.Vector3(s.x, s.y + 3, s.z));
    if (s === player) { setTimeout(gameOver, 3200); }
    else if (s.ally) escorts.onSunk(s); // [escorts] no loot, no crate roll
    else { if (src?.ally) game.escortSunk = (game.escortSunk || 0) + 1; const pts = Math.round((100 * (s.big ? 3 : 1) + 10 * game.wave) * (src?.ally ? ESCORT.killScore : 1)); game.sunk++; addScore(pts); popup(new THREE.Vector3(s.x, 10, s.z), `SUNK! +${pts}`); dropLoot(s); healthDrops.onSink(s, game.mode === 'daily' && game.dropRng ? game.dropRng : Math.random); } // [health drops] ~33% per sink (pity after 5 dry) + bosses; DAILY uses its own seeded drop stream
  }
  updateHud();
}

// ---------- loot ----------
const healthDrops = createHealthDrops({ scene, fx, sfx, popup, updateHud }); // [health drops]
const escorts = createEscorts({ scene, fx, sfx, game, enemies, getPlayer: () => player, moveShip: (...a) => moveShip(...a), floatShip: (...a) => floatShip(...a), fire: (...a) => fire(...a), popup: (...a) => popup(...a),
  loot, getCrates: () => healthDrops.drops, buildOpts: { mainSailMap: sailTex, flagMap: flagTex, shadows: HIGH, quality }, onChange: () => updateHud() }); // [escorts]
function dropLoot(s) { // [daily] chest scatter comes from the wave's loot stream on a DAILY run
  if (game.mode === 'daily' && game.lootRng) rand = game.lootRng;
  try { dropLootAt(s); } finally { rand = Math.random; }
}
function dropLootAt(s) {
  if (s.type === 'runner') return dropChests(s, RUN.goldChests, Math.round(RUN.goldBase + game.wave * RUN.goldPerWave)); // [enemy variety] big gold
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
function dropChests(s, n, value) { // [enemy variety]
  for (let i = 0; i < n; i++) {
    const g = makeChest(); g.scale.setScalar(1.5); scene.add(g);
    const l = { mesh: g, x: s.x + rnd(-5, 5), z: s.z + rnd(-5, 5), value, life: 45, ph: Math.random() * 6 };
    loot.push(l); fx.ring(new THREE.Vector3(l.x, 0, l.z), 1, 9, 1.6);
  }
  popup(new THREE.Vector3(s.x, 9, s.z), `+${n * value} GOLD SPILLED`, 'hit');
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
  // [aaa water] bow spray (the wake itself is the trail ribbon in wake.js): grows with speed, bursts when the bow plunges
  const sN = s.speed / 13;
  if (sN > 0.08 && s.alive !== false) {
    const len = s.mesh.userData.len, n = Math.sin(s.yaw), c = Math.cos(s.yaw), bx = s.x + n * len * 0.5, bz = s.z + c * len * 0.5;
    const sub = waveHeight(bx, bz, game.t) - (s.y + 0.3);
    s.sprayAcc = (s.sprayAcc || 0) + (sN * sN * 22 + Math.max(0, sub) * sN * 30) * fx.q * (s === player ? 1 : 0.5) * dt;
    while (s.sprayAcc >= 1) { s.sprayAcc -= 1; fx.bowSpray(bx, s.y + 0.7, bz, n, c, sN, sub > 0.2); }
  }
}

// ---------- enemy AI ----------
// [boss escorts] mirrored escort AI: formation beside the boss, engage the nearest of you / your escorts at broadside range
// (spread over targets), fall back to the boss below 30% hull. Enemy stats (speed, reload, accuracy, damage) unchanged.
const BOSS_SLOTS = [[-20, 4], [20, 4]];
function updateBossEscort(e, dt) {
  const foes = escorts.list.length ? [player, ...escorts.list] : [player];
  escortStep(e, dt, { k: { moveShip, floatShip, fire, game }, leader: e.leader, player, active: player.alive, foes,
    mates: e.leader.escortList, avoid: escorts.list.length ? [player, ...escorts.list, ...enemies] : [player, ...enemies], slot: BOSS_SLOTS[e.slotN % 2],
    P: { speed: e.maxSpeed * 0.8, catchUp: e.maxSpeed * 1.15, engageDist: 120, leash: 170, retreatAt: 0.3, rejoinAt: 0.55, range: 70 } });
  if (e.hp < e.maxHp * 0.6) { e.smokeT -= dt; if (e.smokeT <= 0) { e.smokeT = 0.12; fx.smoke(new THREE.Vector3(e.x + rnd(-2, 2), e.y + 3, e.z + rnd(-3, 3)), e.hp < e.maxHp * 0.35); } }
}
function updateEnemy(e, dt) {
  if (!e.alive) { floatShip(e, dt); return; }
  if (e.escort) { updateBossEscort(e, dt); return; } // [boss escorts] same AI as your hired escorts, mirrored
  updateRepair(e, dt); // [repair] fleeing ships patch up after 20 s untouched
  const T = enemyTarget(e, dt); specialTarget = e.type === 'runner' ? player : T; // [escorts] the runner only ever flees from you
  if (updateSpecialEnemy(e, dt, specialCtx)) { // [enemy variety] rammer / runner AI (boss attacks also run here, then fall through)
    if (e.alive && e.hp < e.maxHp * 0.6) { e.smokeT -= dt; if (e.smokeT <= 0) { e.smokeT = 0.12; fx.smoke(new THREE.Vector3(e.x + rnd(-2, 2), e.y + 3, e.z + rnd(-3, 3)), e.hp < e.maxHp * 0.35); } }
    return;
  }
  const dx = T.x - e.x, dz = T.z - e.z, d = Math.hypot(dx, dz); // [escorts] T = you, or an escort that's clearly closer
  const toP = Math.atan2(dx, dz);
  const dYou = T === player ? d : Math.hypot(player.x - e.x, player.z - e.z);
  let desired = e.yaw, spd = e.maxSpeed * 0.55;
  if (e.state === 'flee') {
    desired = Math.atan2(player.x - e.x, player.z - e.z) + Math.PI; spd = e.maxSpeed;
    if (dYou > 260) { e.state = 'roam'; e.hp = Math.min(e.maxHp * 0.45, e.hp + 5); }
  } else if (d < 150 && T.alive) {
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
    if (dYou < SPOT_RANGE) desired = Math.atan2(player.x - e.x, player.z - e.z); // spotted you, close in ([spawn ring] was 230 m: covers the whole spawn ring so fresh waves still head straight in)
  }
  // keep apart from other ships
  for (const o of [player, ...escorts.list, ...enemies]) {
    if (o === e || !o.alive) continue;
    const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz);
    if (od < 14 && od > 0.01) { const push = (14 - od) * 0.9 * dt; e.x += ox / od * push; e.z += oz / od * push; if (od < 22) desired = Math.atan2(ox, oz) * 0.5 + desired * 0.5; }
  }
  const diff = angWrap(desired - e.yaw);
  moveShip(e, dt, spd, clamp(diff * 2, -1, 1));
  floatShip(e, dt);
  // fire when player sits on a broadside
  e.cd -= dt;
  if (e.cd <= 0 && T.alive && d < 70 && e.state !== 'flee' || (e.cd <= 0 && e.state === 'flee' && d < 40)) {
    const [lx, lz] = toLocal(e, T.x, T.z);
    const ang = Math.abs(Math.atan2(lz, Math.abs(lx)));
    if (ang < 0.5) { fire(e, lx > 0 ? 'port' : 'star', T, e.accuracy); e.cd = e.reload * rnd(0.85, 1.25); }
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
    const ownAlly = b.owner === player || b.owner.ally;
    for (const s of [player, ...escorts.list, ...enemies]) {
      if (s === b.owner || !s.alive) continue;
      if (ownAlly === (s === player || !!s.ally)) continue; // [escorts] no friendly fire: enemies don't hurt each other, you + escorts don't either
      const [lx, lz] = toLocal(s, p.x, p.z);
      const u = s.mesh.userData;
      if (Math.abs(lx) < u.beam / 2 + 0.7 && Math.abs(lz) < u.len / 2 + 0.6 && p.y > s.y - 1.5 && p.y < s.y + u.len * 0.9) {
        damage(s, b.owner === player ? Math.round(rnd(BALL_DMG[0], BALL_DMG[1]) * (player.gunDmg || 1)) : b.owner.ally ? escorts.ballDmg(b.owner) : Math.max(1, Math.round(rnd(6, 10) * (1 + game.wave * 0.04) * (b.owner.dmgMul || 1) * (1 - (s.armor || 0)))), p.clone(), b.owner); // [escorts] escort balls; armor of whoever got hit // [Raul] ship upgrades: enemy type damage, armor; upgrade buffs: CANNONS gunDmg
        done = true; break;
      }
    }
    if (!done && p.y < waveHeight(p.x, p.z, game.t)) { fx.splash(p); ocean.addSplash(p.x, p.z, 2.8, game.t); // [aaa water] lingering foam
      sfx.splash(clamp(1 - p.distanceTo(player.mesh.position) / 150, 0.05, 0.8)); done = true; }
    if (done || b.life <= 0) { freeBall(b.mesh); balls.splice(i, 1); }
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
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture?.(e.pointerId); } catch { /* pointer already gone (iOS can cancel it mid-tap): still register the press */ } el.classList.add('on'); onDown(); });
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
  const portrait = camera.aspect < 1, k = camScale(player.mesh.userData), dist = (portrait ? 46 : 34) * k, up = (portrait ? 24 : 16) * k; // [Raul] upgrade visuals: framing scales with hull
  const back = new THREE.Vector3(-Math.sin(player.yaw) * dist, up, -Math.cos(player.yaw) * dist);
  camera.position.copy(player.mesh.position).add(back);
}
function toggleSound() { initAudio(); setMuted(!muted); } // [Raul] sound upgrades: button state follows onAudioState below
function toggleFull() { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); }
// [Raul] sound upgrades: clear sound button state + volume sliders in the pause menu
onAudioState((a) => {
  const b = $('btn-sound'); b.textContent = a.muted ? '🔇' : '🔊';
  b.classList.toggle('off', a.muted); b.classList.toggle('locked', !a.muted && !a.running);
  b.title = a.muted ? 'Sound OFF (tap to turn on, M)' : a.running ? 'Sound ON (tap to mute, M)' : 'Tap anywhere to enable sound';
  b.setAttribute('aria-pressed', a.muted ? 'true' : 'false');
  for (const k of ['master', 'sfx', 'music']) { const el = $('vol-' + k); if (el && document.activeElement !== el) el.value = Math.round(a[k] * 100); }
});
for (const k of ['master', 'sfx', 'music']) { const el = $('vol-' + k); if (el) el.addEventListener('input', () => { const v = el.value / 100; initAudio(); if (muted && v > 0) setMuted(false); setLevel(k, v); }); } // read the value before initAudio(): its state notify re-syncs unfocused sliders (iOS doesn't focus range inputs on touch)
window.PFP_AUDIO = { sfx, setLoadout };
$('btn-sound').onclick = toggleSound; $('btn-cam').onclick = resetCamera; $('btn-full').onclick = toggleFull;
$('btn-pause').onclick = togglePause; $('btn-resume').onclick = togglePause;
$('btn-quit').onclick = () => { $('pause').classList.add('hidden'); toTitle(); };

function togglePause() {
  if (game.state === 'playing') { game.state = 'paused'; $('pause').classList.remove('hidden'); }
  else if (game.state === 'paused') { game.state = 'playing'; $('pause').classList.add('hidden'); }
}

// ---------- HUD ----------
// [repair] player: 20 s without taking damage -> +5% max HP every 4 s, up to full (green pulse on the captain-card bar)
const PLAYER_REPAIR = { wait: 20, every: 4, pct: 0.05 };
function updatePlayerRepair(dt) {
  player.calm = (player.calm || 0) + dt;
  const on = player.calm >= (player.regenWait ?? PLAYER_REPAIR.wait) && // [Raul] upgrade buffs: HULL PLANKS shorten the wait
    player.hp < player.maxHp;
  $('player-hp').parentElement.classList.toggle('repairing', on);
  if (!on) { player.repT = 0; return; }
  player.repT = (player.repT || 0) + dt;
  if (player.repT < PLAYER_REPAIR.every) return;
  player.repT -= PLAYER_REPAIR.every;
  player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * (player.regenPct ?? PLAYER_REPAIR.pct))); updateHud();
}
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
    if (e.repTick > 0) e.repTick -= 1 / 60;
    e.bar.classList.toggle('repairing', !!e.repairing); e.bar.classList.toggle('repair-tick', e.repTick > 0); // [repair] green pulse on the bar only
  }
}
function updateEscortBars() { // [escorts] green bars over your escorts
  for (const e of escorts.list) {
    const s = e.alive && game.state !== 'title' ? screenPos(new THREE.Vector3(e.x, e.y + e.mesh.userData.len * 1.05, e.z)) : null;
    if (!s || !s.vis) { e.bar.style.display = 'none'; continue; }
    e.bar.style.display = 'block'; e.bar.style.left = `${s.x}px`; e.bar.style.top = `${s.y}px`;
    e.fill.style.width = `${(e.hp / e.maxHp) * 100}%`;
    e.bar.classList.toggle('low', e.state === 'retreat');
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
  healthDrops.radar(dot); // [health drops] green dots
  enemies.forEach(e => e.alive && dot(e.x, e.z, e.state === 'flee' ? '#ff9b9b' : '#fa0d0d', e.big ? 5 : 3.5));
  escorts.list.forEach(e => e.alive && (dot(e.x, e.z, '#ffffff', 4), dot(e.x, e.z, '#4ee37a', 2.8))); // [escorts] green dot, white ring
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
// [set sail first] SET SAIL needs nothing. Name + wallet are asked on the game over screen (prefilled from last time).
const walletInput = $('wallet-input'), nameInput = $('go-name');
walletInput.value = game.wallet; nameInput.value = game.name;
function validateWallet() {
  const v = walletInput.value.trim(), ok = isValidSolanaAddress(v);
  walletInput.classList.toggle('good', ok); walletInput.classList.toggle('bad', !!v && !ok);
  $('wallet-msg').textContent = !v ? (WALLET_VERIFY_ENABLED ? 'Add it to save this run to the leaderboard. Never asks for keys; verifying is an optional view-only signature.' : 'Add it to save this run to the leaderboard. Never asks for keys or signatures.') : ok ? `Ahoy ${shortWallet(v)}! Ready to save.` : 'That doesn’t look like a Solana address (base58, 32–44 characters).';
  if (!game.saved) $('btn-save').disabled = !ok;
  return ok;
}
walletInput.addEventListener('input', validateWallet);
walletInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (validateWallet()) { walletInput.blur(); saveScore(); } } });
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); walletInput.focus(); } });
// phones: keep the focused field above the on-screen keyboard (the overlay follows visualViewport, so it can scroll)
for (const inp of [nameInput, walletInput]) inp.addEventListener('focus', () => { for (const ms of [120, 350, 700]) setTimeout(() => { if (document.activeElement === inp) inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, ms); });
nameInput.addEventListener('change', () => saveName(nameInput.value)); // keep what they typed even if they skip saving
walletInput.addEventListener('change', () => { if (isValidSolanaAddress(walletInput.value.trim())) saveWallet(walletInput.value); });
validateWallet();
// [wallet verify] built but disabled. With the flag on: CONNECT PHANTOM (connect + signMessage only, view-only),
// fills the wallet field, and score saves carry the signature to the verify-score Edge Function.
let walletVerify = null;
if (WALLET_VERIFY_ENABLED) import('./walletVerify.js').then(m => {
  walletVerify = m;
  m.initWalletVerify({
    button: $('btn-rewards'), walletInput,
    onWallet: (addr) => { walletInput.value = addr; walletInput.dispatchEvent(new Event('input')); },
    setMsg: (t) => { $('wallet-msg').textContent = t; },
  });
}).catch(e => console.warn('[wallet verify] unavailable', e));
// [wallet save] read-only wallet sign-in: skins + best run saved on the server for that wallet (js/pirateAccount.js)
let pirate = null;
const runStats = () => (game.runId && game.state !== 'title') ? { id: game.runId, score: game.score, wave: game.wave, sunk: game.sunk, duration_s: Math.round((performance.now() - game.startTime) / 1000), gold_base: game.gold + (game.goldSpent || 0), gold_total: game.gold + (game.goldSpent || 0), over: game.state === 'over' } : null;
if (WALLET_SAVE_ENABLED) import('./pirateAccount.js').then(m => {
  pirate = m;
  return m.initAccount({ button: $('btn-wallet'), chip: $('wallet-chip'), addr: $('wc-addr'), out: $('wc-out'), note: $('wallet-note') }, {
    getRun: runStats,
    getName: () => (game.state === 'over' ? nameInput.value.trim().slice(0, 20) : '') || game.name || getSavedName(),
    onChange: () => { if (m.account.wallet && m.account.connected) { game.wallet = m.account.wallet; if (game.state !== 'over') walletInput.value = m.account.wallet; } },
    onSkins: () => { if (game.state === 'title') { scene.remove(player.mesh); disposeShip(player.mesh); player = makePlayer(); player.sail = 1; } },
  });
}).catch(e => { console.warn('[wallet save] unavailable', e); $('btn-wallet').classList.add('hidden'); $('wallet-note').textContent = ''; });
else { $('btn-wallet').classList.add('hidden'); $('wallet-note').textContent = ''; }
$('btn-start').onclick = () => startGame();
{ // [start help] "?" panel: close button, tap outside, Escape
  const faq = $('faq'), show = (on) => { faq.classList.toggle('hidden', !on); if (on) $('faq-close').focus(); else $('btn-faq').focus(); };
  $('btn-faq').onclick = () => show(true); $('faq-close').onclick = () => show(false);
  faq.addEventListener('click', e => { if (e.target === faq) show(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !faq.classList.contains('hidden')) { e.stopImmediatePropagation(); show(false); } }, true);
}
// [daily] DAILY mode is hidden from the UI (no button, no board tab). The seeded-run code below stays dormant.
const DAILY_LS = 'pfp_daily_played';
function dailyPlayed(wallet, seed = dailySeed()) { try { const d = JSON.parse(localStorage.getItem(DAILY_LS)); return !!d && d.seed === seed && d.wallets.includes(wallet); } catch { return false; } }
function markDailyPlayed(wallet, seed) {
  let d; try { d = JSON.parse(localStorage.getItem(DAILY_LS)); } catch { d = null; }
  if (!d || d.seed !== seed) d = { seed, wallets: [] };
  if (!d.wallets.includes(wallet)) d.wallets.push(wallet);
  try { localStorage.setItem(DAILY_LS, JSON.stringify(d)); } catch {}
}
function syncDailyBtn() {}
document.querySelectorAll('.lb-mode').forEach(el => el.textContent = `(${leaderboard.mode})`);

// leaderboard period tabs (DAY / WEEK / MONTH / YEAR / ALL-TIME), remembered per device
const TABS = [...PERIODS]; // [daily] DAILY board tab hidden
let lbPeriod = localStorage.getItem('pfp_lb_period');
if (!TABS.some(p => p.id === lbPeriod)) lbPeriod = 'all';
const boardTokens = new WeakMap();
function buildTabs() {
  document.querySelectorAll('.lb-tabs').forEach(wrap => {
    wrap.innerHTML = '';
    for (const p of TABS) {
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
  const period = lbPeriod, pd = TABS.find(p => p.id === period), isDaily = period === 'daily';
  let rows = [];
  try { rows = isDaily ? await leaderboard.getDaily(dailySeed(), LB_SIZE) : await leaderboard.getTop(LB_SIZE, period); } catch (e) { console.warn(e); }
  if (boardTokens.get(el) !== token) return; // a newer tab click won
  let label;
  if (isDaily) label = `(${leaderboard.lastWhere === 'online' ? 'online' : leaderboard.remote ? 'this device · daily board coming soon' : 'this device only'} · resets in ${untilNextDaily()})`;
  else label = `(${leaderboard.lastWhere === 'online' ? 'online' : (leaderboard.remote ? 'this device · online board offline' : 'this device only')}${period === 'all' ? '' : ` · ${pd.desc}`})`;
  el.closest('.board-wrap')?.querySelectorAll('.lb-mode').forEach(m => m.textContent = label);
  el.innerHTML = ''; el.scrollTop = 0;
  if (!rows.length) { el.innerHTML = `<li class="empty">${isDaily ? 'No daily runs yet today. Tap DAILY and set the mark.' : period === 'all' ? 'No scores yet. Be the first legend of the storm.' : `No scores in the ${pd.desc} yet. Claim the top spot!`}</li>`; boardHint(el); return; }
  let mine = null;
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    if (r.wallet === game.wallet) { li.className = 'me'; mine ??= li; }
    const rk = document.createElement('i'); rk.textContent = `${i + 1}.`;
    const nm = document.createElement('span'); nm.textContent = r.name ? `${r.name} · ${shortWallet(r.wallet)}` : shortWallet(r.wallet);
    const b = document.createElement('b'); b.textContent = r.score;
    li.append(rk, nm, b); el.appendChild(li);
  });
  // game over: if your row is below the first 5, scroll the list (only the list) so it's in view
  if (mine && el.id === 'board-over' && mine.offsetTop + mine.offsetHeight > el.clientHeight) el.scrollTop = mine.offsetTop - (el.clientHeight - mine.offsetHeight) / 2;
  boardHint(el);
}
// fade + "scroll for more" under a board that holds more than 5 rows; hidden once scrolled to the end
function boardHint(el) {
  let h = el.nextElementSibling;
  if (!h || !h.classList.contains('lb-more')) {
    h = document.createElement('div'); h.className = 'lb-more'; h.setAttribute('aria-hidden', 'true'); h.textContent = '▼ scroll for more';
    el.after(h); el.addEventListener('scroll', () => boardHint(el), { passive: true });
  }
  const more = el.scrollHeight - el.clientHeight - el.scrollTop > 2;
  el.classList.toggle('more', more); h.classList.toggle('on', more);
}
buildTabs();

// [wave break] 13 s between waves to collect gold, with a NEXT WAVE IN countdown (game time, so pause/shop don't count; DAILY same)
const WAVE_BREAK = 13;
let nextWaveEl = null, nextWaveN = -1;
function showNextWave(t) {
  const n = t > 0 ? Math.ceil(t) : -1;
  if (n === nextWaveN) return; nextWaveN = n;
  if (!nextWaveEl) { nextWaveEl = document.createElement('div'); nextWaveEl.id = 'next-wave'; document.body.appendChild(nextWaveEl); }
  nextWaveEl.style.display = n > 0 ? '' : 'none';
  if (n > 0) nextWaveEl.textContent = `NEXT WAVE IN ${n}...`;
}
function clearWorld() {
  showNextWave(-1);
  for (const e of enemies) { scene.remove(e.mesh); disposeShip(e.mesh); e.bar.remove(); }
  enemies.length = 0;
  for (const b of balls) freeBall(b.mesh); balls.length = 0;
  escorts.clear(); // [escorts] a new run starts with none
  for (const l of loot) scene.remove(l.mesh); loot.length = 0;
  healthDrops.clear(); // [health drops]
  fx.clear(); wakes.clear(); ocean.clearSplashes(); // [aaa water]
}

function startGame(mode = null) {
  player.calm = 0; player.repT = 0; // [repair]
  // [set sail first] no name / wallet needed to sail; use whatever was saved last time (may be empty)
  game.wallet = (pirate?.account.connected && pirate.account.wallet) || getSavedWallet(); game.name = getSavedName();
  game.runId = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); // [wallet save]
  // [daily] hidden from the UI: every run is a normal run
  game.mode = null; game.seed = null; game.lootRng = null; game.dropRng = null;
  initAudio(); setMusic(true); // [Raul] sound upgrades: shanty loop (Music slider in pause menu)
  clearWorld();
  scene.remove(player.mesh); disposeShip(player.mesh); player = makePlayer();
  Object.assign(game, { escortSunk: 0, storm: 0, state: 'playing', score: 0, gold: 0, wave: 0, sunk: 0, saved: false, startTime: performance.now(), waveTimer: 1.2, clearAck: false });
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
  banner(game.mode === 'daily' ? 'DAILY CHALLENGE' : 'SET SAIL!', game.mode === 'daily' ? `same seas for every pirate · ${game.seed}` : 'hunt the rug ships');
  maybeShowTutorial(); // [tutorial] how-to-play card, game paused until closed
}

function toTitle() {
  closeTutorial(); // [tutorial]
  game.state = 'title';
  clearWorld();
  $('hud').classList.add('hidden'); $('gameover').classList.add('hidden'); $('title').classList.remove('hidden');
  scene.remove(player.mesh); disposeShip(player.mesh); player = makePlayer(); player.sail = 1;
  syncDailyBtn();
  renderBoard($('board-title'));
}

async function gameOver() {
  if (game.state === 'over') return;
  showNextWave(-1); // [wave break]
  game.state = 'over';
  $('go-score').textContent = game.score; $('go-wave').textContent = game.wave; $('go-sunk').textContent = game.sunk; $('go-gold').textContent = game.gold + (game.goldSpent || 0); // [Raul] gold looted, incl. spent
  // [set sail first] ask for name + wallet here; a returning pirate sees them prefilled and can still edit
  nameInput.value = getSavedName(); walletInput.value = (pirate?.account.connected && pirate.account.wallet) || getSavedWallet(); // [wallet save] connected wallet fills itself in
  pirate?.save({ now: true }); // [wallet save] end of run
  const known = isValidSolanaAddress(walletInput.value.trim());
  $('go-wallet').textContent = pirate?.account.connected ? 'Connected wallet filled in. Your progress is saved to it.' : known ? 'Your name and wallet from last time are filled in. Edit them if you like.' : 'Add your wallet to put this run on the leaderboard.';
  $('save-msg').textContent = 'Save your score to the leaderboard (best score per wallet counts).';
  validateWallet();
  $('gameover').classList.remove('hidden');
  updateRotateHint(); // hide the 'turn sideways' pill so it can't sit on top of the stats
  renderBoard($('board-over'));
  prepareShare(shareStats()); // pre-render the card so SHARE opens the share sheet inside the tap
}
function shareStats() { let skin = ''; try { skin = equippedSkin().name; } catch { /* skins optional */ } return { score: game.score, wave: game.wave, sunk: game.sunk, gold: game.gold + (game.goldSpent || 0), name: $('go-name').value.trim().slice(0, 20) || game.name, wallet: isValidSolanaAddress(walletInput.value.trim()) ? walletInput.value.trim() : game.wallet, captain: game.captain, skin }; }
$('btn-share').onclick = () => { const s = shareStats(); if (s.name !== game.name || s.wallet !== game.wallet) prepareShare(s); shareScore(s, { onStatus: (st) => { if (st === 'downloaded') $('save-msg').textContent = 'Score card downloaded. Attach it to your X post!'; } }); };
async function saveScore() {
  if (game.saved) return;
  if (!validateWallet()) { $('save-msg').textContent = 'Add a Solana wallet to save this run to the leaderboard.'; return; } // no wallet = no leaderboard entry
  game.saved = true; $('btn-save').disabled = true;
  game.name = nameInput.value.trim().slice(0, 20); saveName(game.name);
  game.wallet = walletInput.value.trim(); saveWallet(game.wallet);
  if (pirate?.account.connected) pirate.save({ now: true }); // [wallet save] keep the name in sync
  const r = await leaderboard.submit({ wallet: game.wallet, name: game.name, score: game.score, wave: game.wave, sunk: game.sunk, duration_s: Math.round((performance.now() - game.startTime) / 1000), ...(game.mode === 'daily' ? { mode: 'daily', seed: game.seed } : {}) }, { proof: walletVerify?.getProof(game.wallet) || null }); // [wallet verify] proof only exists when the flag is on
  $('save-msg').textContent = game.mode === 'daily'
    ? (r.where === 'online' ? 'Saved to the online DAILY board!' : leaderboard.remote ? 'Saved on this device. Online daily board coming soon.' : 'Saved on this device.')
    : (r.where === 'online' ? (r.verified ? 'Saved to the online leaderboard ✅ verified!' : 'Saved to the online leaderboard!') : 'Saved on this device.');
  await renderBoard($('board-over'));
}
$('btn-save').onclick = saveScore;
// leaving the game over screen saves automatically when a valid wallet is filled in (returning pirates aren't nagged); otherwise the run is skipped
const saveIfReady = async () => { if (!game.saved && isValidSolanaAddress(walletInput.value.trim())) await saveScore(); };
$('btn-again').onclick = async () => { await saveIfReady(); startGame(); };
$('btn-menu').onclick = async () => { await saveIfReady(); toTitle(); };

// ---------- main loop ----------
const clock = new THREE.Clock();
const moodColor = new THREE.Color(); // [aaa water]
let lastTarget = new THREE.Vector3();
let camShipK = 1; // [Raul] upgrade visuals
// camera pull-back for a bigger ship: less than the hull growth (so upgrades read BIGGER on screen), but enough for the tallest mast
function camScale(ud) { return Math.max(1, Math.pow(ud.shipScale || 1, 0.8), 0.8 * (ud.frameK || 1)); }
// [mobile] adaptive resolution: on phones / low quality, if a busy scene averages under ~40 fps for 2 s of
// play, step the render pixel ratio down (1.25 -> 1.0 -> 0.85). Down only, so it never oscillates.
const ADAPT = { on: isMobile || quality === 'low', steps: [1, 0.85], t0: 0, n: 0 };
function adaptResolution() {
  if (!ADAPT.on || game.state !== 'playing' || document.hidden) { ADAPT.t0 = 0; return; }
  const now = performance.now();
  if (!ADAPT.t0) { ADAPT.t0 = now; ADAPT.n = 0; return; }
  ADAPT.n++;
  if (now - ADAPT.t0 < 2000) return;
  const fps = ADAPT.n * 1000 / (now - ADAPT.t0); ADAPT.t0 = 0;
  const next = ADAPT.steps.find(r => r < renderer.getPixelRatio() - 0.01);
  if (fps < 40 && next) { renderer.setPixelRatio(next); onResize(); console.info('[mobile] fps', fps.toFixed(1), '-> pixel ratio', next); }
}
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  adaptResolution();
  const running = game.state === 'playing' || game.state === 'over' || game.state === 'title';
  if (running) game.t += dt;
  const t = game.t;

  if (running) {
    // player
    if (game.state === 'playing' && player.alive) {
      const turn = ((keys.KeyA || keys.ArrowLeft || held.left) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight || held.right) ? 1 : 0);
      moveShip(player, dt, player.anchor ? 0 : player.sail * 4.2 * (player.speedMul || 1), turn); // [Raul] ship upgrades: sails
      const cdWas = player.cd.port + player.cd.star; // [Raul] sound upgrades: reload-ready ratchet (GUN CREW)
      for (const sd of ['port', 'star']) { const was = player.cd[sd]; player.cd[sd] = Math.max(0, was - dt); if (was > 0 && player.cd[sd] === 0 && cdWas > 0) sfx.reloadReady(); }
      updatePlayerRepair(dt); // [repair] game time only: pause / shop / tutorial don't count
      if (player.hp < player.maxHp * 0.4 && Math.random() < 0.15) fx.smoke(new THREE.Vector3(player.x + rnd(-2, 2), player.y + 3, player.z + rnd(-3, 3)), player.hp < player.maxHp * 0.25);
      // waves
      if (!enemies.some(e => e.alive)) {
        if (!game.clearAck) {
          game.clearAck = true; game.waveTimer = game.wave === 0 ? 1.2 : WAVE_BREAK; // [wave break] was 4 s
          if (game.wave > 0) for (const l of loot) l.life = Math.max(l.life, WAVE_BREAK + 3); // gold never expires mid-break
          if (game.wave > 0) { banner('WAVE CLEARED!', `+${50 * game.wave} · hull repaired`); player.hp = Math.min(player.maxHp, player.hp + 25); addScore(50 * game.wave); for (const e of escorts.alive()) e.hp = e.maxHp; /* [escort pickups] escorts patched to full */ updateHud(); }
        }
        game.waveTimer -= dt;
        if (game.wave > 0 && !loot.length && game.waveTimer > 3) game.waveTimer = 3; // all gold collected: skip ahead
        if (game.wave > 0) showNextWave(game.waveTimer);
        if (game.waveTimer <= 0) { game.clearAck = false; showNextWave(-1); startWave(); }
      }
    } else if (game.state === 'title') {
      moveShip(player, dt, 4, Math.sin(t * 0.1) * 0.25);
    } else if (game.state === 'playing' || game.state === 'over') {
      player.speed *= 0.98;
    }
    floatShip(player, dt);
    for (const e of enemies) updateEnemy(e, dt);
    escorts.update(dt); // [escorts]
    // remove fully sunk ships
    for (let i = enemies.length - 1; i >= 0; i--) if (!enemies[i].alive && enemies[i].sinking > 7) { scene.remove(enemies[i].mesh); disposeShip(enemies[i].mesh); enemies[i].bar.remove(); enemies.splice(i, 1); updateHud(); }
    updateBalls(dt);
    // loot
    for (let i = loot.length - 1; i >= 0; i--) {
      const l = loot[i]; l.life -= dt;
      l.mesh.position.set(l.x, waveHeight(l.x, l.z, t) + 0.1 + Math.sin(t * 2 + l.ph) * 0.1, l.z); l.mesh.rotation.y += dt * 0.8;
      if (Math.random() < 0.3) fx.sparkle(l.mesh.position);
      if ((player.alive && Math.hypot(l.x - player.x, l.z - player.z) < 10) || escorts.list.some(e => e.alive && Math.hypot(l.x - e.x, l.z - e.z) < 10)) { // [escort pickups] escorts fish gold for you
        game.gold += l.value; addScore(l.value); sfx.coin(); popup(l.mesh.position.clone().setY(4), `+${l.value} GOLD`); scene.remove(l.mesh); loot.splice(i, 1); updateHud(); continue;
      }
      if (l.life <= 0) { scene.remove(l.mesh); loot.splice(i, 1); }
    }
    healthDrops.update(dt, t, player, escorts.list); // [health drops] bob, blink, pickup
    animateShip(player.mesh, t, player.anchor ? 0 : player.sail / 3);
    for (const e of enemies) animateShip(e.mesh, t + 1.3, e.alive ? 0.8 : 0.3);
    escorts.animate(t, animateShip); // [escorts]
    fx.update(dt, t);

    // lightning
    game.nextLightning -= dt;
    if (game.nextLightning <= 0) { game.flash = 1; game.nextLightning = rnd(6, 16); sfx.thunder(rnd(0.3, 1.5)); sky.uniforms.uBolt.value.copy(bolt.strike(camera.position, Math.atan2(camera.position.x - player.x, camera.position.z - player.z) + Math.PI + rnd(-0.9, 0.9))); }
  }
  game.flash = Math.max(0, game.flash - dt * 2.8);
  const fl = game.flash > 0 ? game.flash * (0.6 + 0.4 * Math.sin(game.flash * 40)) : 0;
  ocean.uniforms.uFlash.value = sky.uniforms.uFlash.value = rain.uniforms.uFlash.value = wakes.uniforms.uFlash.value = fl;
  // [aaa water] mood by wave: sky, fog, light and water darken from wave 6, strongest by wave 12+ (DAILY too); a new run resets it
  { const w = game.state === 'title' ? 0 : clamp((game.wave - 5) / 7, 0, 1), target = w * w * (3 - 2 * w);
    game.storm = game.stormOverride ?? (game.storm || 0) + (target - (game.storm || 0)) * (1 - Math.exp(-dt * 0.6));
    const sm = game.storm, dens = 0.0042 + 0.0007 * sm;
    moodColor.copy(FOG_COLOR).lerp(STORM_FOG, sm);
    scene.fog.color.copy(moodColor); scene.background.copy(moodColor); scene.fog.density = dens;
    ocean.uniforms.uFogColor.value.copy(moodColor); sky.uniforms.uFogColor.value.copy(moodColor); wakes.uniforms.uFogColor.value.copy(moodColor);
    ocean.uniforms.uFogDensity.value = wakes.uniforms.uFogDensity.value = dens;
    ocean.uniforms.uStorm.value = sky.uniforms.uStorm.value = wakes.uniforms.uStorm.value = sm;
    rain.uniforms.uAlpha.value = 0.28 + 0.17 * sm; sun.intensity = 2.1 * (1 - 0.4 * sm);
    hemi.intensity = 1.9 * (1 - 0.28 * sm) + fl * 3; }
  bolt.mesh.visible = game.flash > 0.3; bolt.mesh.material.opacity = clamp(fl * 1.6, 0, 1);
  wind.uTime.value = t; chestTime(t);
  // hull foam collars for the water shader (nearest ships first)
  { const H = ocean.uniforms.uHulls.value; let k = 0;
    const ships = escorts.list.length ? [...escorts.list, ...enemies] : enemies; // [escorts] foam collars + wakes too
    const list = ships.length < MAX_HULLS ? ships : ships.slice().sort((a, b) => ((a.x - player.x) ** 2 + (a.z - player.z) ** 2) - ((b.x - player.x) ** 2 + (b.z - player.z) ** 2)); // [late waves] up to 15+ ships: foam for the nearest
    for (const s of [player, ...list]) { if (k >= MAX_HULLS) break; if (s.sinking > 3) continue; ocean.uniforms.uHullV.value[k] = s.speed; H[k++].set(s.x, s.z, s.yaw, s.mesh.userData.len); }
    ocean.uniforms.uHullCount.value = k;
    wakes.update(player, list, t); } // [aaa water] wake trails: player first, then the nearest ships

  // ocean follows the player, snapped to the grid so waves don't swim
  const step = ocean.mesh.userData.step;
  ocean.mesh.position.set(Math.round(player.x / step) * step, 0, Math.round(player.z / step) * step);
  ocean.uniforms.uTime.value = sky.uniforms.uTime.value = rain.uniforms.uTime.value = t;

  // camera follows the ship, orbit offset preserved
  const ud0 = player.mesh.userData, shipK = camScale(ud0); // [Raul] upgrade visuals: bigger hulls / taller rigs pull the camera back to stay framed
  const tgt = new THREE.Vector3(player.x, player.y + 4 * shipK + 2.2 * ((ud0.frameK || 1) - 1), player.z);
  camera.position.add(tgt.clone().sub(lastTarget)); lastTarget.copy(tgt);
  if (Math.abs(shipK - camShipK) > 1e-4) { const f = shipK / camShipK; camera.position.sub(tgt).multiplyScalar(f).add(tgt); controls.maxDistance = (camera.aspect < 1 ? 120 : 95) * Math.max(1, shipK); camShipK = shipK; }
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

  if (game.state !== 'title') { updateBars(); updateEscortBars(); drawRadar(); updateFireButtons(); }
  updateAmbient({ speed: player.speed, sail: player.anchor ? 0 : player.sail, playing: game.state === 'playing' && player.alive, hpFrac: player.hp / player.maxHp, roll: player.roll || 0, dt }); // [Raul] sound upgrades: sea / wind / creaks / low-hp
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
// (skipped on portal CDNs: itch.io's html*.itch.zone (folder URLs 403, itch serves its own copy) and Newgrounds'
// uploads.ungrounded.net (one origin shared by every NG game), so no offline cache inside those iframes)
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !/(^|\.)(itch\.zone|ungrounded\.net)$/.test(location.hostname)) {
  navigator.serviceWorker.register('./sw.js').then(r => console.log('[pwa] service worker ready, scope', r.scope)).catch(e => console.warn('[pwa] sw failed', e));
}

// [Raul] ship upgrades: SHOP button (top HUD row) + shipwright overlay
initShop({ game, escorts, getPlayer: () => player, updateHud, sfx, camera, rebuildShip: rebuildPlayerShip, prebuildShips, previewBase: { mainSailMap: sailTex, flagMap: flagTex, quality } }); // [Raul] skin previews: classic sail/flag + quality // [Raul] upgrade visuals: camera + ship rebuild

// Debug / test hooks (harmless; the leaderboard can't trust the client anyway, see README)
initTutorial({ game }); // [tutorial] after initShop so the shop '?' button can be added
window.PFP_HEALTH = healthDrops; // [health drops] test hook
window.PFP = { game, get player() { return player; }, enemies, balls, loot, spawnEnemy, escorts, fire: playerFire, damage, startGame, gameOver, quality, camera, renderer, scene, wakes, ocean }; // [Raul] + renderer/scene for perf tests
