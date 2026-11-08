import { formatGoldAmount } from './goldFormat.js';
import { renderPixelRatio, sceneSamples } from './graphicsBudget.js';
import { createGameplayHint } from './hudDeclutter.js';
// PUMPFUN PIRATES · Storm Hunt — main game
import { mergeIslandKits, installShadowProxies, trimSmallCasters } from './staticMerge.js';
import { OPT_ON, freezeStaticWorlds } from './opt.js'; // [Emerly perf-v304] &opt=0 — only foot/hill_street/battle_areas
import { DEV, devHook } from './env.js'; // [security L] console/test hooks exist on local dev servers only
import { setAvatar } from './avatar.js';
import * as THREE from 'three';
import * as BA from './broadsideAim.js'; // [v347] t1824u broadside aim (no homing)
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createOcean, createSky, createRain, createBolt, waveHeight, FOG_COLOR, STORM_FOG, MAX_HULLS } from './ocean.js';
import { evalSkyNow, setPhase as setSkyPhase, clearPhase as clearSkyPhase, skyPhase, phaseName, isStormForced, skyCycle } from './skyCycle.js'; // [v343] day/night sky
import { createWakes } from './wake.js'; // [aaa water] Kelvin wake trails
import { initKit } from './shipKit.js'; // [Timothy] Blender ship art kit
import { attachCaptain, localCaptain, registerCaptainBuilder, setLocalCaptain } from './captainSlot.js'; // [Timothy v2] your captain pirate at the wheel
import { setLocalSkin } from './pirateGear.js'; // [Timothy] shop clothes follow your ship skin
import { applyShipGear } from './shipGear.js'; // [Raul shop items 2] your shop FLAG + FIGUREHEAD on your ship
import { buildCaptainV4, tickPirates } from './pirates.js'; // [v100] Raul's v4 pirates: you are the captain at your wheel + the on-foot pirate
import { initCrewV4 } from './crewV4.js'; import { pirateBodyLod } from './pirateGLB.js';
import { syncCrewGear } from './crewGear.js';
import { crewGear } from './crewLoadout.js'; // [Timothy] CREW SHOP: the crew's own loadout
import { initHarborCard } from './harborCard.js'; // [v106] compact phone harbor card // [v106] your crew wears your hat + clothes
import { getLocalGear, getLocalColors } from './pirateGear.js'; // [v101] v4 pirates as the ship crew
import { buildShip, animateShip, makeSkullTexture, makePillTexture, wind, disposeShip, ENEMY_SCHEMES, stretchFor, setShipDetail } from './ships.js';
import { makeChest, chestTime, createIslands } from './props.js';
import { toon } from './toon.js'; // [enemy variety] ram spike
import { FX } from './fx.js';
import { setCrewQuality, crewFire, crewHit, crewSteer, rebakeCrewV4 } from './crew.js';
import { initEmotes, emoteTick, clearEmotes } from './emotes.js'; // [v96] quick-chat wheel // [Raul] deck crew · [v87] crew react to hits
import { ARMORED_ENEMIES as ARMORED } from './soundProfile.js'; // [Raul] damage sounds
import { initAudio, sfx, setMuted, muted, setLevel, setMusic, updateAmbient, onAudioState, setLoadout, setAudioQuality } from './audio.js'; // [Raul] sound upgrades
import { leaderboard, PERIODS, LB_SIZE, DAILY_TAB } from './leaderboard.js';
import { dailySeed, waveRng, untilNextDaily } from './daily.js'; // [daily] seeded run per UTC day
import { isValidSolanaAddress, shortWallet, getSavedWallet, saveWallet, getSavedName, saveName, syncName } from './wallet.js';
import { WALLET_VERIFY_ENABLED, WALLET_SAVE_ENABLED, ON_PORTAL, PVP_ENABLED } from './config.js'; // [wallet verify] off = walletVerify.js is never loaded
import { QUALITY } from './config.js';
import './tokenChip.js'; // title screen $SUNK CA chip + socials
import './uiProfile.js'; import './accountUi.js'; // [v106] player accounts: name + password (PROFILE > ACCOUNT, home LOG IN) // [v103] PROFILE panel: tap / click the captain card (top left) (Timothy c3c09f1)
// Score-card rendering is needed only at game over, not while loading the title/harbor.
let shareModule = null;
const loadShare = () => shareModule ||= import('./shareCard.js');
const prepareShare = (stats) => loadShare().then(m => m.prepareShare(stats));
const shareScore = (stats, opts) => loadShare().then(m => m.shareScore(stats, opts));
import { isKey, held as heldKey, installMouseBinds, binds, keyName, anyModalOpen, installModalKeyIsolation } from './keybinds.js'; // [keybinds] desktop rebindable keys (+ mouse buttons)
import { initControlsUi, openControls } from './controlsUi.js';
import { initGamepad, CONSOLE } from './gamepad.js'; // [Emerly gamepad] controllers (Gamepad API) + console browsers (Xbox Edge / PlayStation); &pad=0 = off
import { equippedSkin, ownsSkin, equipSkin, getSkin, skinSwatch } from './skins.js';
import { pvpSkin, shipTick } from './pvpSkins.js'; // [t1716u] Harbor skins (Flaming/Diamond/Kraken/…) in Waves + Daily
import { previewCards } from './skinPreview.js'; // [v75] real renders in the skins pickers
import { initHomeBoard } from './pvpBoard.js'; // [pvp] PvP KILLS board (home WAVES / BATTLE ROYALE switch)
import { COAST_ON } from './island/coast.js';
import { wavesStart, wavesClaim, harborEquippedSkinId } from './pvpSave.js'; // [v103] Waves banks gold · [t1716u] harborEquippedSkinId

// [Raul] ship upgrades
import { gunList, BALL_DMG } from './upgrades.js';
import { waveRoster, applyEnemyType, ENEMY_TYPES, ENEMY_BUILDS, updateSpecialEnemy, RUN, updateRepair, lateWave, spawnBossEscorts } from './enemyTypes.js'; // [enemy variety] builds + AI
import { initShop, resetShop, waveSkinUnlock, wavesUnlocks, close as closeShop, getRunLevels } from './shop.js';
import { createHealthDrops } from './healthDrops.js'; // [health drops]
import { initTutorial, maybeShowTutorial, close as closeTutorial } from './tutorial.js'; // [tutorial]
import { getMapStyle, setMapStyle, THEMES } from './mapIcons.js'; // [v153] MINIMAP STYLE setting // [minimap-themes] + NIGHT / GOLD / BLUEPRINT
import { wireHudHide } from './hudHide.js'; // [gold-hud] stats under captain + Hide HUD (H) · &goldhud=0
import { compileShip, setRenderContext, prebuildNext, prebuildSkin } from './upgradeVisuals.js';
// [t1716u] Waves uses shipTick from pvpSkins.js (Harbor animated skins); wavesShipTick no longer needed
import { touchesGold } from './hullReach.js'; // [big-hitbox]

import { escHtml } from './safe.js'; // [security H5]
import { HARBOR_MODULES } from './preloadList.js'; // [v330 perf] harbor module graph (generated)
import { ADM } from './adminState.js'; // [admin-menu] owner GOD / NOCLIP at sea, server FREEZE (js/adminMenu.js)
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
const isMobile = !CONSOLE && (matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)); // [Emerly gamepad] a console (its browser may report a coarse pointer) is never a phone: no touch sticks, the TV layout
document.documentElement.classList.toggle('pfp-desktop', !isMobile);
// [ultra] graphics choice (pause menu / start page), persisted: auto | low | high | ultra. ?quality=… still wins for one visit.
// ULTRA is opt-in only (never auto-picked, not offered on phones) and renders on top of the HIGH tier: quality stays 'high'
// for every gameplay / ship / hitbox path, the extras below are gated on ULTRA, so LOW and HIGH render exactly as before.
const GFX_KEY = 'pfp_gfx';
const gfxSaved = (() => { try { return localStorage.getItem(GFX_KEY); } catch { return null; } })();
// [v408] BANKSY 'outside of casino / stone exteriors look different': a past context loss no longer pins LOW for 24 h or overwrites the
// player's saved choice. Only the reload right after a loss (same tab, within 5 min) renders LOW once; the saved setting is untouched.
try { localStorage.removeItem('pfp_ctx_last_loss'); } catch {}
const ctxSafe = (() => { try { const r = JSON.parse(sessionStorage.getItem('pfp_ctx_recovery') || 'null'); return !!(r && r.n >= 1 && Date.now() - r.ts < 300000); } catch { return false; } })();
const gfxPick = ctxSafe ? 'low' : ['low', 'high', 'ultra'].includes(qp) ? qp : (['low', 'high', 'ultra'].includes(gfxSaved) ? gfxSaved : null);
const autoQ = QUALITY !== 'auto' ? QUALITY : (isMobile || (navigator.hardwareConcurrency || 8) <= 4 || (CONSOLE && !/Xbox Series/i.test(navigator.userAgent)) ? 'low' : 'high'); // [Emerly gamepad] Xbox One / PlayStation browsers: LOW (Series X|S: HIGH)
const ULTRA = gfxPick === 'ultra' && !isMobile;
const quality = ULTRA ? 'high' : (gfxPick === 'low' || gfxPick === 'high') ? gfxPick : autoQ;
const FXQ = ULTRA ? 'ultra' : quality; // ocean / wakes / particles get the ultra budget
setCrewQuality(quality, isMobile); setAudioQuality({ phone: isMobile, lite: gfxPick === 'low' }); // [v101] crew voice caps (phone 3, LOW 2) // [Raul] crew budget: high / phone (medium) / low = off
setShipDetail(quality === 'low'); // [v97] LOW / phones: lighter cannon + carriage geometry
// [load-speed] BANKSY 4:53 PM "work on loading speed": the crew bodies (~0.85-1.6 MB of pirate GLBs + the bake), the skull flag image and the
// brand font used to start only AFTER the ship kit + figureheads had finished; they don't depend on each other, so all of them load at once now
// (same awaits, same order of use: only the downloads overlap).
const bootArt = Promise.all([loadImage('assets/skull_transparent.png'), document.fonts.load('40px "Just Another Hand"')]); bootArt.catch(() => {});
const crewV4P = initCrewV4({ lod: pirateBodyLod({ low: quality === 'low' || isMobile, many: true, quality }) }); let crewV4Late = false;
await initKit(quality === 'low' || isMobile); // Figureheads load on first equipped use via applyShipGear(), never block boot.
// [crew holes] HIGH desktops bake the High body (the v128 walking-crew fix): crewV4P is started above, before the kit
await Promise.race([crewV4P, new Promise(r => setTimeout(() => { crewV4Late = true; r(); }, 8000))]); // [v101] crew bodies baked before the first ship is built (procedural crew if slow / failed)
// [v112] Raul: a late bake (slow phone) re-bakes every crew built meanwhile (rebakeCrewV4) and re-dresses yours, instead of keeping the placeholder crew forever
Promise.resolve(crewV4P).then(() => { if (!crewV4Late) return; const go = () => { try { const n = rebakeCrewV4(scene); crewGearT = 0; console.info('[crew] v4 bake landed late: re-baked', n, 'crews'); } catch (e) { setTimeout(go, 500); } }; go(); }, () => {});
registerCaptainBuilder(buildCaptainV4(quality === 'low' || isMobile)); setLocalCaptain({ v: 1, look: { skin: 0, hair: 0 }, local: true }); // [Timothy] local: true = wears your shop gear (js/pirateGear.js) // [v100] your pirate (v4 GLB) steers your ship
// [v106] your equipped gear for the crew (setLocalGear fires 'pfp-gear'); colours follow your pirate's rules (Timothy's getLocalColors when present)
let localGear = getLocalGear(), crewGearT = 1, PGmod = null;
import('./pirateGear.js').then(m => { PGmod = m; });
import('./bondfx.js').then(m => m.startBondFx()).catch(() => {}); // [heliuswh] island-wide $SUNK BONDED celebration (chain-confirmed only)
const localGearColors = () => getLocalColors();
addEventListener('pfp-crew', () => { crewGearT = 0; }); addEventListener('pfp-gear', () => { crewGearT = 0; }); // [v109b] the crew reads getLocalGear() (your resolved gear + free colours), not the event's (the BR profile copy has no clothes colour)

// ---------- renderer / scene ----------
const canvas = $('game');
// [perf2] BANKSY "hd sharp and fast": MSAA on every tier except an explicit LOW pick (phones were aliased at 1.0x); phones start at
// 1.5x on 2x+ screens (was 1.25, often stepped to 1.0 = blurry on a 3x phone), desktop 2x cap. Adaptive steps down only on slow FPS.
const DPR = window.devicePixelRatio || 1, LOW_PICK = gfxPick === 'low';
const PR_WANTED = Math.min(CONSOLE ? 1.25 : isMobile ? 1.5 : 2, ULTRA ? Math.min(2, Math.max(DPR, 1.5)) : quality === 'low' ? Math.min(DPR, LOW_PICK ? 1.25 : DPR >= 2 ? 1.5 : 1.25) : Math.min(DPR, 2)); // [Emerly gamepad] consoles: a 4K TV renders at most 1.25x the CSS size (adaptive steps still apply)
// Bound framebuffer memory before the island's first shader/geometry upload, not 12 seconds later.
const PR0 = renderPixelRatio(innerWidth, innerHeight, PR_WANTED, ULTRA);
// HIGH renders into its own multisampled scene target: a second MSAA canvas is unused.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !(quality === 'high' && !isMobile) && !LOW_PICK, powerPreference: 'high-performance' });
renderer.setPixelRatio(PR0); // [ultra] supersamples 1x screens
// [perf2] three.js reads every shader's info log after compiling (forces a synchronous wait per program: ~4.8 s of a 15 s desktop
// harbor entry). Off in production; ?shaderdebug=1 turns the checks back on.
renderer.debug.checkShaderErrors = /[?&]shaderdebug=1/.test(location.search);
// [perf2] sharper ground / decks at grazing angles: default anisotropy for every texture made from here on (explicit values stay)
THREE.Texture.DEFAULT_ANISOTROPY = Math.min(renderer.capabilities.getMaxAnisotropy() || 1, isMobile || quality === 'low' ? 4 : 8);
renderer.setSize(innerWidth, innerHeight);
// A context loss must not leave an invisible / frozen game. Preserve the Harbor
// resume snapshot, allow three.js to restore, then restart with a bounded budget.
let glLost = false, glLostT = 0, glReloading = false;
function graphicsRecovery() {
  if (glReloading) return;
  clearTimeout(glLostT);
  const banner = document.getElementById('pfp-ctx-reload');
  try {
    const now = Date.now();
    let r = JSON.parse(sessionStorage.getItem('pfp_ctx_recovery') || 'null');
    if (!r || !Number.isFinite(r.ts) || !Number.isFinite(r.n) || now - r.ts >= 300000) r = { ts: now, n: 0 };
    if (r.n >= 2) throw new Error('reload budget reached');
    r.n++;
    sessionStorage.setItem('pfp_ctx_recovery', JSON.stringify(r));
    try { harborResumeSave(true); } catch {}
    glReloading = true;
    location.reload();
  } catch {
    // Storage unavailable or two resets in five minutes: never enter a reload loop.
    if (banner) banner.textContent = glLost ? 'GRAPHICS PAUSED · CLOSE THIS TAB AND REOPEN THE GAME' : 'GRAPHICS RESTORED · LOW QUALITY RECOMMENDED';
    if (!glLost) setTimeout(() => banner?.remove(), 6000);
  }
}
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault(); glLost = true;
  graphicsSample('context-lost');
  try { harborResumeSave(true); } catch {}
  if (!document.getElementById('pfp-ctx-reload')) {
    const b = document.createElement('div'); b.id = 'pfp-ctx-reload'; b.setAttribute('role', 'status');
    b.textContent = 'Graphics reset, reloading…';
    b.style.cssText = 'position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:99999;padding:14px 22px;font:700 18px system-ui;background:#1a0f07;color:#ffcd77;border:2px solid #fbbf24;border-radius:14px;max-width:90vw';
    document.body.appendChild(b);
  }
  clearTimeout(glLostT); glLostT = setTimeout(graphicsRecovery, 1000);
}, false);
canvas.addEventListener('webglcontextrestored', () => { glLost = false; graphicsRecovery(); }, false);
// Keep numeric-only bounded diagnostics: no player identity or network payloads.
let graphicsLastFrame = performance.now(), graphicsVisibleAt = performance.now(), graphicsState = '', graphicsFrameSeen = false;
const graphicsHistory = [];
function graphicsSample(reason) {
  const m = renderer.info.memory;
  const sample = { reason, ms: Math.round(performance.now()), geometries: m.geometries,
    textures: m.textures, programs: renderer.info.programs?.length || 0,
    pixelRatio: renderer.getPixelRatio?.(), pixels: canvas.width * canvas.height,
    heap: performance.memory?.usedJSHeapSize || 0 };
  graphicsHistory.push(sample); if (graphicsHistory.length > 48) graphicsHistory.shift();
  window.__pfpGraphics = { history: graphicsHistory, quality, lost: glLost };
}
document.addEventListener('visibilitychange', () => { graphicsVisibleAt = graphicsLastFrame = performance.now(); });
setInterval(() => {
  if (document.hidden || glReloading) return;
  // Only a real lost context may trigger recovery. Island construction / shader compilation
  // can block frames for >6 s with a healthy context; fabricating a loss then reloads a
  // working game, and the reload itself can repeat the expensive island construction.
  if (!glLost && renderer.getContext().isContextLost()) {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  }
}, 1000);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const HIGH = quality === 'high' && !isMobile; // Phones never allocate shadow maps or the HDR/bloom pipeline, even with HIGH selected.
if (HIGH) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; } installShadowProxies(renderer); // [perf4] merged shadow-only meshes (js/staticMerge.js)

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_COLOR.getHex(), 0.0042);
const FOG_K = ULTRA ? 0.74 : 1; // [ultra] lighter fog, longer draw distance
scene.background = FOG_COLOR.clone();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 9000); // [v348] t1828u: 2500 -> 9000 (sea to the horizon, sky dome 6500)
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
  if (ULTRA) { sun.shadow.mapSize.set(4096, 4096); sc.left = sc.bottom = -64; sc.right = sc.top = 64; sc.far = 260; sun.shadow.radius = 5; sun.shadow.normalBias = 0.03; } // [ultra]
}

const ocean = createOcean(FXQ); ocean.mesh.renderOrder = 2; scene.add(ocean.mesh); // after ships' water masks (see ships.js)
const wakes = createWakes(FXQ, ocean.uniforms.uWaves); scene.add(wakes.mesh); // [aaa water] after the ocean
const sky = createSky(); scene.add(sky.mesh);
const rain = createRain(quality === 'low' ? 1800 : ULTRA ? 9000 : 5000); scene.add(rain.mesh);
const fx = new FX(scene, FXQ);
const bolt = createBolt(); scene.add(bolt.mesh);
const islands = createIslands(quality); scene.add(islands.group);
// [Raul] PUMPFUN PIRATES island in the PvP queue harbor (preview): loaded on first harbor visit, shown + solid only while you
// sail the harbor (never solo / Waves / the arena). The harbor zone also clears the old rocks (and the old lighthouse stack)
// inside r 470 for open water and frames the edge with a few curated islets. ?harborIsland=0 = the original harbor.
const HARBOR_ISLAND_ON = new URLSearchParams(location.search).get('harborIsland') !== '0';
const HARBOR_ISLETS = [[3, 492, -96, 0.6, 0.9], [6, -118, 488, 2.1, 0.85], [0, -470, 150, 4.0, 1.0], [7, -360, -340, 1.2, 0.9], [4, 70, -490, 5.1, 0.95]];
const harborIsle = { obj: null, loading: false, on: false };
// [Emerly] docking + on foot (js/dock/*, js/onfoot/*): the layout-driven waterfront on Raul's coast (js/island/coast.js), replaces Dock Town. ?dock=0 = off
const DOCK_ON = HARBOR_ISLAND_ON && COAST_ON && new URLSearchParams(location.search).get('dock') !== '0'; // gated on Raul's coast flag (on by default; ?coast=0 = old harbor)
let dock = null, dockLoading = false;
function dockLoad() { if (dock || dockLoading) return; dockLoading = true;
  import('./dock/index.js').then(m => m.createDock({ scene, camera, controls, renderer, ocean, islands, game, quality, canvas, islets: HARBOR_ISLETS.filter(i => i[1] < 200), getPlayer: () => player, pvp: () => pvp, sfx, fx, waveHeight, /* [v314] the canoe rides the real swell */ /* [Timothy] battery muzzle / smoke / splash */
    openWaves: () => openWavesEntry(), camReset: () => { resetCamera(); lastTarget.set(player.x, player.y + 4 * camScale(player.mesh.userData) + 2.2 * ((player.mesh.userData.frameK || 1) - 1), player.z); } }))
    .then(d => { dock = d; }).catch(e => { dockFailed = true; console.warn('[dock] failed', e); }).finally(() => { dockLoading = false; }); }
// [v157] BANKSY "Start them at dock": while the harbor world is still loading, a dark cover hides the sea spawn (under the name card),
// so the first ship frame you see is already moored at your berth (js/dock/index.js spawnNow)
let dockFailed = false, dockCover = null;
function dockCoverTick() {
  const want = DOCK_ON && !dockFailed && game.mode === 'pvp' && !!pvp && pvp.active && pvp.where === 'harbor' && !pvp.spectating && game.state !== 'title' && !dock?.on;
  if (want && !dockCover) { dockCover = document.createElement('div'); dockCover.id = 'dk-cover';
    dockCover.style.cssText = 'position:fixed;inset:0;z-index:29;background:radial-gradient(circle at 50% 40%,#10202c,#05080c);pointer-events:none;display:flex;align-items:flex-end;justify-content:center;padding-bottom:12vh;color:#f5c542;font:700 18px/1.2 system-ui,sans-serif;letter-spacing:.12em';
    dockCover.textContent = 'ROWING INTO THE HARBOR…'; const en = document.getElementById('pvp-entry'); if (en?.parentNode) en.parentNode.insertBefore(dockCover, en); else document.body.appendChild(dockCover); } // under the name card (same stacking context, z 29 < 30)
  if (dockCover) dockCover.style.display = want ? 'flex' : 'none';
  // [spawn-snap] BANKSY 4:18 PM "Why do they spawn at sea then jump to dock": while this cover is up you still sit at the sea spawn,
  // so js/pvp.js holds your harbor state until the dock has moored you (peers never see the sea spawn). &spawnsnap=0 = old.
  if (SPAWN_SNAP) document.documentElement.classList.toggle('pfp-spawn-pending', want);
}
const SPAWN_SNAP = !/[?&]spawnsnap=0(?:&|$)/.test(location.search);
function harborIslandTick(t) {
  if (DOCK_ON) { if (game.mode === 'pvp' && !!pvp && (pvp.where === 'harbor' || pvp.specHarbor)) dockLoad(); return; } // [v105] + harbor spectate (the whole coast island, no holes) // [Emerly] the dock world replaces Dock Town
  const want = HARBOR_ISLAND_ON && game.mode === 'pvp' && !!pvp && pvp.where === 'harbor';
  if (want && !harborIsle.obj && !harborIsle.loading) {
    harborIsle.loading = true;
    import('./island/harbor.js').then(m => m.createHarborIsland({ quality, ocean })).then(o => { harborIsle.obj = o; o.setVisible(false); scene.add(o.group); })
      .catch(e => console.warn('[island] harbor island failed', e)).finally(() => { harborIsle.loading = false; });
  }
  const o = harborIsle.obj, on = want && !!o;
  if (on !== harborIsle.on) { harborIsle.on = on; if (o) o.setVisible(on); islands.setHarbor(on ? { clearR: 470, islets: HARBOR_ISLETS, island: { circles: o.circles, bound: o.bound, avoidDisc: o.bound } } : null); }
  if (on) o.update(t, camera.position);
}

// post-processing (high tier only; phones never download these modules)
let composer = null;
if (HIGH) {
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }, { FXAAShader }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/ShaderPass.js'),
      import('three/addons/postprocessing/OutputPass.js'), import('three/addons/shaders/FXAAShader.js'),
    ]);
    // [ultra] 4x MSAA half-float target, stronger bloom so Diamond / Golden / Flaming glow, SMAA, subtle grade
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: sceneSamples(ULTRA) })); // 2x on HIGH; 4x is reserved for opt-in ULTRA
    // Only the scene target needs MSAA/depth. Fullscreen post passes need neither.
    // Pin read/write roles at frame start (none of these passes has temporal history).
    composer.renderTarget1.samples = 0; composer.renderTarget1.depthBuffer = false;
    composer.addPass(new RenderPass(scene, camera));
    // [v112] NaN / Inf guard (BANKSY: Ultra went black when a ship sank): one bad pixel in the half-float scene target (a NaN normal, a
    // huge additive burst) gets smeared over the whole frame by the bloom blur mips -> black screen. Clamp every channel to a finite
    // HDR range before bloom; non-finite -> 0. Ternaries, not mix(): NaN * 0 is still NaN.
    composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; float f(float x){ return (x > -1.0 && x < 60000.0) ? clamp(x, 0.0, 64.0) : 0.0; } void main(){ vec4 c = texture2D(tDiffuse, vUv); gl_FragColor = vec4(f(c.r), f(c.g), f(c.b), (c.a >= 0.0 && c.a <= 1.0) ? c.a : 1.0); }' }));
    const bloom = ULTRA ? new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.45, 0.9) : new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.4, 0.95);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const vignette = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uStrength: { value: 0.42 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float uStrength; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.25, length(d * vec2(1.0, 0.9))); c.rgb *= mix(1.0 - uStrength, 1.0, v); gl_FragColor = c; }',
    });
    composer.addPass(vignette);
    if (ULTRA) {
      composer.addPass(new ShaderPass({ // gentle grade: a touch more saturation + contrast, warm highlights / cool shadows (keeps the toon look)
        uniforms: { tDiffuse: { value: null } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.299,0.587,0.114)); c.rgb = mix(vec3(l), c.rgb, 1.07); c.rgb = (c.rgb - 0.5) * 1.04 + 0.5; c.rgb += mix(vec3(-0.004,0.0,0.012), vec3(0.012,0.006,-0.006), smoothstep(0.2,0.8,l)); gl_FragColor = vec4(clamp(c.rgb,0.0,1.0), c.a); }',
      }));
      const { SMAAPass } = await import('three/addons/postprocessing/SMAAPass.js');
      composer.addPass(new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()));
      composer.userData = { fxaa: null, bloom };
    } else {
      composer.userData = { fxaa: null, bloom }; // [perf2] MSAA replaces FXAA on HIGH (FXAA blurred the whole frame); FXAAShader still loads for ?fxaa=1
      if (/[?&]fxaa=1/.test(location.search)) { const fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa); composer.userData.fxaa = fxaa; }
    }
  } catch (e) { console.warn('[gfx] post-processing unavailable, rendering directly', e); composer = null; }
}

// ---------- assets ----------
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
const [skullImg] = await bootArt; // [load-speed] started at the top, next to the kit
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
let pvp = null; // [pvp] PvP ARENA controller (js/pvp.js), loaded on first PVP tap; null = solo only
// [t1716u] Waves/Daily wear whatever skin was chosen in Harbor (same partsOverride / look as BR). Never fall back to Waves-only pfp_skins_v1.
const harborSkinObj = () => (pvp ? pvp.skinObj() : pvpSkin(harborEquippedSkinId()));
const shipOpts = () => ({ ...PLAYER_SHIP, skin: harborSkinObj(), pvp: true });
function makePlayer() {
  const mesh = compileShip({}, shipOpts());
  attachCaptain(mesh, localCaptain()); applyShipGear(mesh, getLocalGear()); // [Raul shop items 2]
  scene.add(mesh);
  return { mesh, x: 0, z: 0, yaw: 0, speed: 0, sail: 2, anchor: false, hp: 100, maxHp: 100, cd: { port: 0, star: 0 }, reload: 2.2, roll: 0, pitch: 0, y: 0, sinking: 0, alive: true, turn: 0 };
}
let player = makePlayer();
addEventListener('pfp-gear', () => { try { applyShipGear(player?.mesh, getLocalGear()); } catch {} }); // [Raul shop items 2] a flag / figurehead bought or swapped: at once
// [Raul] upgrade visuals: swap in a freshly compiled ship for new upgrade levels (same pose, old one freed)
const PHONE_MQ = matchMedia('(max-width: 600px) and (orientation: portrait), (max-height: 520px) and (orientation: landscape)');
const PHONE_MQ_LAND = matchMedia('(orientation: landscape)');
let camLow = false;
function buildPlayerShip(levels) { const mesh = compileShip(levels, shipOpts()); attachCaptain(mesh, localCaptain()); applyShipGear(mesh, getLocalGear()); return mesh; } // [Raul shop items 2]
function swapPlayerShip(mesh) {
  const old = player.mesh;
  mesh.position.copy(old.position); mesh.rotation.copy(old.rotation); mesh.userData.body.rotation.copy(old.userData.body.rotation);
  mesh.userData.sails.forEach((sl, i) => { const o = old.userData.sails[i]; if (o) { sl.scale.y = o.scale.y; sl.scale.z = o.scale.z; } });
  scene.remove(old); disposeShip(old); scene.add(mesh); player.mesh = mesh;
  return mesh;
}
function rebuildPlayerShip(levels) { _swapTok++; return swapPlayerShip(buildPlayerShip(levels)); }
// [skin-swap-perf] BANKSY 10:27 PM "optimize the ship skin change it gets very slow": a new skin's materials meant ~15-20 new shader
// programs compiled synchronously on the next frame (1-10 s frozen on desktop, swiftshader). Skin swaps now compile the new ship with
// renderer.compileAsync (KHR_parallel_shader_compile where the GPU has it) while the old ship stays on screen, then swap in one frame.
// A newer swap (or any normal rebuild) wins; &skinasync=0 = the old synchronous swap.
const SKIN_ASYNC = !/[?&]skinasync=0(&|$)/.test(location.search);
let _swapTok = 0;
function rebuildPlayerShipSkin(levels) {
  if (!SKIN_ASYNC || typeof renderer.compileAsync !== 'function') return rebuildPlayerShip(levels);
  const tok = ++_swapTok, mesh = buildPlayerShip(levels), t0 = performance.now();
  const done = () => { if (tok !== _swapTok) { disposeShip(mesh); return; } swapPlayerShip(mesh); rebuildPlayerShipSkin.lastMs = performance.now() - t0; };
  let p; try { p = renderer.compileAsync(mesh, camera, scene); } catch (e) { p = null; }
  if (p?.then) p.then(done, done); else done();
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
// [v97] enemy hulls are built like yours: the waist stretches to fit their guns (same long-gun carriages, gunners, captain);
// the hit box stays the design length so Waves / harbor gameplay is unchanged
const enemyOpts = (o) => ({ ...o, stretch: stretchFor(o.cannonsPerSide || 0, o.len, 1.5), hitLen: o.len, lookout: true }); // + the spyglass lookout (visual)
function refitGuns(e) { // re-build an enemy hull for a new gun count (harbor boss: 5-7 guns), keeping its size / place
  const ud = e.mesh.userData, o = ud.buildOpts; if (!o || !(e.cannons > 0) || o.cannonsPerSide === e.cannons) return;
  const sc = e.mesh.scale.x, mesh = buildShip(enemyOpts({ ...o, cannonsPerSide: e.cannons })), u = mesh.userData;
  mesh.scale.setScalar(sc); u.len *= sc; u.hitLen *= sc; u.baseLen *= sc; u.beam *= sc; u.depth *= sc;
  mesh.position.copy(e.mesh.position); mesh.rotation.copy(e.mesh.rotation);
  scene.remove(e.mesh); disposeShip(e.mesh); scene.add(mesh); e.mesh = mesh;
}
function spawnEnemy(x, z, tier = 1, type = null) {
  [x, z] = islands.freeSpot(x, z, tier >= 2 ? 18 : 13); // [solid rocks] never spawn inside a rock
  const big = tier >= 2;
  const build = ENEMY_BUILDS[type]; // [enemy variety] rammer / runner hulls, rigs and colours
  const guns = ENEMY_TYPES[type]?.cannons || (big ? 4 : 2); // [v97] one barrel per gun the ship really fires (visual only; same RNG calls as before)
  const mesh = buildShip(enemyOpts(build ? { ...build, flagMap: pillTex, flagScale: 1.2, shadows: HIGH } : {
    len: big ? 19 : rnd(13, 15.5), beam: big ? 6 : rnd(4.4, 5), depth: 2.8,
    scheme: big ? 'boss' : ENEMY_SCHEMES[Math.floor(rand() * ENEMY_SCHEMES.length)], boss: big,
    flagMap: pillTex, flagScale: 1.45, cannonsPerSide: guns, masts: big ? 3 : 2, shadows: HIGH,
  }));
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
  if (game.mode === 'pvp') { e.tgtT = (e.tgtT || 0) - dt; if (e.tgtT > 0 && e.tgt && e.tgt.alive) return e.tgt; e.tgtT = 1.5; let T = pvp.botTarget(e); if (T.alive && dock?.isSafe(T)) T = dock.NO_TARGET; const S = pvp.shoreTarget?.(e); if (S && (!T.alive || Math.hypot(S.x - e.x, S.z - e.z) < Math.hypot(T.x - e.x, T.z - e.z))) { e.tgtT = 0.4; T = S; } return (e.tgt = T); } // [v347] t1821u: + a pirate exposed on the coast (shot at this ship / spotted) // [pvp] nearest ship of anyone's // [Emerly] SAFE HARBOR ships are never targeted
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
  if (dock && !dock.canFire(shooter)) return; // [Emerly] SAFE HARBOR: nobody fires inside it (or for a few s after leaving)
  const muzzles = gunList(shooter, side); // [Raul] ship upgrades: cannon count
  crewFire(shooter.mesh, side); // [Raul] that side's gun crews recoil + reload
  const shot = game.mode === 'pvp' ? [] : null; // [pvp] volley broadcast
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
      if (BA.inCone(dir, dx, dz) && d < bd) { bd = d; best = e; } // [v347] t1824u: lock only inside ±15° of the broadside (was ±43°)
    }
    target = best;
  }
  // [v347] t1824u: no more heat-seeking broadsides. A locked shot gets a partial lead (player 28 %, AI 100 %), then ONE firing line
  // turned at most ~5.7° (player) / ~13° (AI) off the gunports: every gun fires parallel along it and only the elevation ranges.
  let line = null, aimY = 2;
  if (target) {
    const lp = BA.leadPoint(shooter.x, shooter.z, target, shooter === player ? BA.AIM.lead : BA.AIM.aiLead);
    aimPt = new THREE.Vector3(lp.x, 0, lp.z);
    const err = (1 - accuracy) * 14;
    aimPt.x += rnd(-err, err); aimPt.z += rnd(-err, err);
    if (Number.isFinite(target.footY)) aimY = target.footY + 0.6; // [v347] t1821u: an AI bombarding a pirate on the coast ranges onto the beach
    // [v348] t1827u: the ball keeps the ship's own way (like the unaimed shot), so it leaves straight out of the moving barrel instead of
    // sliding astern of it; the aim point is pulled back by that drift so the shot still lands where it was aimed
    const tf = Math.hypot(aimPt.x - shooter.x, aimPt.z - shooter.z) / H;
    line = BA.fireLine(dir, shooter.x, shooter.z, aimPt.x - vel0.x * tf, aimPt.z - vel0.z * tf, shooter === player ? BA.AIM.maxDev : BA.AIM.aiMaxDev);
    if (line.d < 4) line = null;
  }
  const gap = Math.min(0.07, 0.5 / Math.max(1, muzzles.length)); // [v95] ripple fire: up to 12 guns a side still fire within ~0.5 s
  shooter.mesh?.updateMatrixWorld(true); // [v348] t1827u: a keydown between frames reads the barrels where they are NOW
  muzzles.forEach((m, i) => {
    const p = new THREE.Vector3(); m.getWorldPosition(p);
    let v;
    if (line) { const g = BA.gunVelocity(p, shooter.x, shooter.z, line, aimY, H); v = new THREE.Vector3(g.x + vel0.x, g.y, g.z + vel0.z); range = line.d; } // parallel, no aim-point convergence, + the ship's own way [v348]
    if (!v) { const t = range / H; v = dir.clone().multiplyScalar(H).add(vel0); v.y = 0.5 * 20 * t + rnd(-0.6, 0.6); v.x += rnd(-1, 1); v.z += rnd(-1, 1); }
    // [v95] the ball is LAUNCHED from its muzzle when its turn in the ripple comes (updateBalls, after this frame's ship moves):
    // spawning it here left delayed balls hanging where the gun WAS (up to ~8 m behind a ship at full speed) and a frame stale
    const mesh = getBall(); mesh.position.copy(p); mesh.visible = false;
    balls.push({ mesh, v, owner: shooter, life: 6, delay: i * gap, muzzle: m, gi: i, side, p0: p.clone() });
    if (shot) shot.push({ p: p.clone(), v: v.clone(), delay: i * gap, side, i }); // [pvp]
  });
  const dist = Math.hypot(shooter.x - player.x, shooter.z - player.z);
  if (shot) pvp.onFire(shooter, shot); // [pvp]
  if (shooter === player) sfx.broadside(Math.min(8, muzzles.length)); // [Raul] sound upgrades: one boom per gun that fires, CANNONS tier sets the sound
  else sfx.enemyBroadside(muzzles.length, clamp(1 - dist / 220, 0, 1), !!shooter.big);
}

function playerFire(side) {
  if (game.state !== 'playing' || !player.alive || player.cd[side] > 0) return;
  if (shipLocked()) return; // [v314] no broadsides from the canoe / the beach
  if (dock && !dock.canFire(player)) return; // [Emerly] SAFE HARBOR (no reload spent)
  player.cd[side] = player.reload;
  if (game.mode === 'pvp') pvp.onLocalFire(); // [pvp] firing ends spawn protection
  fire(player, side);
  game.shake = Math.max(game.shake, 0.35);
  $('hint').style.opacity = 0;
}

function damage(s, amt, p, src = null) {
  if (!s.alive) return;
  if (dock?.invuln(s)) return; // [Emerly] SAFE HARBOR: moored / parked ships can't be hurt
  if (s === player && ADM.god) { s.hp = s.maxHp; return; } // [admin-menu] GOD MODE: AI boats, the Commodore, cliff guns, players
  s.hp -= amt;
  crewHit(s.mesh, amt / Math.max(1, s.maxHp || 100) * 6); // [v87] the crew stagger (visual only)
  fx.hit(p); sfx.impact({ dmg: amt, maxHp: s.maxHp, kill: s.hp <= 0, onPlayer: s === player, boss: s.type === 'boss' || src?.type === 'boss', armor: s === player ? 0 : (ARMORED[s.type] || 0), v: s === player ? 1 : clamp(1 - Math.hypot(s.x - player.x, s.z - player.z) / 200, 0.15, 1) }); // [Raul] damage sounds: tier from damage dealt (soundProfile.js)
  if (s === player) { s.calm = 0; s.repT = 0; game.shake = Math.max(game.shake, 0.8); popup(p, `-${amt}`, 'dmg'); } // [repair] a hit resets the 20 s wait
  else if (s.ally) { s.calm = 0; s.repT = 0; } // [escorts] no score for hits on your own escorts
  else { s.calm = 0; s.repT = 0; addScore(src?.ally ? 3 : 5); popup(p, `-${amt}`, 'hit'); if (s.hp < s.maxHp * 0.3 && s.state !== 'flee' && !s.noFlee) s.state = 'flee'; }
  if (s.hp <= 0) { s.hp = 0; s.alive = false; s.sinking = 0.001; sfx.sink(!!s.big); fx.ring(new THREE.Vector3(s.x, 0, s.z), 3, 16, 2.2); fx.hit(new THREE.Vector3(s.x, s.y + 3, s.z));
    if (s === player) { if (game.mode === 'pvp') pvp.onLocalSunk(src); else setTimeout(gameOver, 3200); } // [pvp] respawn instead of game over
    else if (game.mode === 'pvp') pvp.onBotSunk(s, src); // [pvp] AI ship: gold pile + kill feed
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
  popup(new THREE.Vector3(s.x, 9, s.z), `+${formatGoldAmount(n * value)} GOLD SPILLED`, 'hit');
}

// [v84] water never inside a hull: the ocean shader caps the sea under each afloat ship just below the plane of that
// ship's water-mask lid (its gunwale), read off the real lid every frame, so pitch, roll, PvP lifted rigs, hull levels
// and ship scale all count. Sinking ships (and ships without a lid) get no cap, so they still go under.
const _hc = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
function hullCap(s, out) {
  const ud = s.mesh.userData;
  if (ud.capLid === undefined) { ud.capLid = null; s.mesh.traverse(o => { if (!ud.capLid && o.userData.waterMask && o.geometry) ud.capLid = o; });
    if (ud.capLid) { const P = ud.capLid.geometry.attributes.position; let mn = Infinity; for (let i = 0; i < P.count; i++) mn = Math.min(mn, P.getY(i));
      // [v114] the cap plane sat 0.3 m under the GUNWALE lid, but enemy / escort / boss decks are ~0.7 m under it: crests reached 0.4 m
      // over their deck ("water inside the hull" in Waves). Cap from the lower of the lid and the waist deck (same body frame), so the
      // shader's -0.3 lands under every deck. Visual only: physics / buoyancy never read this.
      if (Number.isFinite(ud.deckY) && ud.capLid.parent === ud.body) mn = Math.min(mn, ud.deckY - 0.25); // 0.25: low waist spots (hatches) too
      ud.capLid.userData.capY = mn; } }
  const lid = ud.capLid;
  if (!lid || s.sinking > 0 || s.alive === false || !s.mesh.parent || !s.mesh.visible) { out.set(0, 0, 0, 0); return; }
  lid.updateWorldMatrix(true, false);
  const y = lid.userData.capY, [p0, pf, px] = _hc;
  p0.set(0, y, 0).applyMatrix4(lid.matrixWorld); pf.set(0, y, 1).applyMatrix4(lid.matrixWorld); px.set(1, y, 0).applyMatrix4(lid.matrixWorld);
  const fx_ = Math.sin(s.yaw), fz = Math.cos(s.yaw), xx = Math.cos(s.yaw), xz = -Math.sin(s.yaw);
  const dF = (pf.x - p0.x) * fx_ + (pf.z - p0.z) * fz, dX = (px.x - p0.x) * xx + (px.z - p0.z) * xz;
  const sF = Math.abs(dF) > 1e-4 ? (pf.y - p0.y) / dF : 0, sX = Math.abs(dX) > 1e-4 ? (px.y - p0.y) / dX : 0;
  const oF = (p0.x - s.x) * fx_ + (p0.z - s.z) * fz, oX = (p0.x - s.x) * xx + (p0.z - s.z) * xz;
  if (!lid.geometry.boundingBox) lid.geometry.computeBoundingBox();
  const hb = Math.max(ud.beam * 0.5, Math.hypot(px.x - p0.x, px.z - p0.z) * lid.geometry.boundingBox.max.x); // PvP lifted / enlarged rigs too
  out.set(p0.y - sF * oF - sX * oX, sF, sX, hb);
}

// ---------- ship physics ----------
const HULL_LIFT = 0.17; // [v97] × hull depth: lifts every ship's mesh ~0.5 m so it no longer looks half sunk
function floatShip(s, dt) {
  const t = game.t, L = (s.mesh.userData.hitLen || s.mesh.userData.len) * 0.4, B = s.mesh.userData.beam * 0.5; // [v97] sample the waves over the design length (gameplay y unchanged by the longer hulls)
  const fx_ = Math.sin(s.yaw), fz = Math.cos(s.yaw), px = Math.cos(s.yaw), pz = -Math.sin(s.yaw);
  const hC = waveHeight(s.x, s.z, t);
  const hF = waveHeight(s.x + fx_ * L, s.z + fz * L, t), hA = waveHeight(s.x - fx_ * L, s.z - fz * L, t);
  const hP = waveHeight(s.x + px * B, s.z + pz * B, t), hS = waveHeight(s.x - px * B, s.z - pz * B, t);
  // [v348] t1833u: was dt*4 (τ≈0.25 s) — steep 27 m / 15 m crests left small boats + galleons up to ~0.5 m under / over the waterline.
  // dt*8 (τ≈0.125 s) + a crest floor (same idea as the canoe) keeps every hull (starter sloop, upgraded galleon, prestige liftRig) on the swell.
  const k = 1 - Math.exp(-dt * 8);
  const moored = s.anchor && s._safe && !(s.speed > 0.3); // [dock-waterline] moored in SAFE HARBOR: ride the full swell at its highest sample + 0.25 m, half the pitch / roll
  // (v176 halved the swell, so crests rose past the low sloop gunwale; the water moves fully, so the hull has to as well). Sailing unchanged.
  const hM = (hC + hF + hA) / 3, rk = moored ? 0.5 : 1;
  const ty = (moored ? Math.max(hM, hC, (hP + hS) / 2) + 0.25 : hM) - 0.6;
  s.y += (ty - s.y) * k; if (s.y < ty - 0.08) s.y = ty - 0.08; // never lag under a rising crest
  s.pitch += (-Math.atan2(hF - hA, 2 * L) * rk - s.pitch) * k;
  s.roll += (Math.atan2(hP - hS, 2 * B) * 0.8 * rk + (s.turn || 0) * s.speed * 0.012 - s.roll) * k;
  let sinkY = 0, sinkRoll = 0, sinkPitch = 0;
  if (s.sinking > 0) {
    s.sinking += dt;
    sinkY = -s.sinking * s.sinking * 0.5; sinkRoll = Math.min(0.9, s.sinking * 0.25); sinkPitch = Math.min(0.4, s.sinking * 0.08);
    if (Math.random() < 0.6) fx.bubbles(new THREE.Vector3(s.x, s.y, s.z));
  }
  s.mesh.position.set(s.x, s.y + sinkY + HULL_LIFT * (s.mesh.userData.depth || 3), s.z); // [v97] hulls ride higher (more freeboard); visual only, s.y (gameplay) unchanged
  s.mesh.rotation.set(0, s.yaw, 0);
  s.mesh.userData.body.rotation.set(s.pitch + sinkPitch, 0, s.roll + sinkRoll);
}

function moveShip(s, dt, targetSpeed, turnInput) {
  if (s !== player && !s.remote) { const av = islands.avoid(s); if (av !== null) { turnInput = av; targetSpeed *= 0.75; } } // [solid rocks] every AI ship steers around rocks
  const acc = targetSpeed > s.speed ? 2.2 : (s.anchor ? 7 : 3);
  s.speed += clamp(targetSpeed - s.speed, -acc * dt, acc * dt);
  const turnRate = 0.62 * (s.turnMul || 1) * (0.35 + 0.65 * Math.min(s.speed / 6, 1)); // [Raul] ship upgrades: rudder
  s.turn += (turnInput - s.turn) * Math.min(1, dt * 5);
  s.yaw += s.turn * turnRate * dt;
  s.x += Math.sin(s.yaw) * s.speed * dt; s.z += Math.cos(s.yaw) * s.speed * dt;
  if (!(s === player && ADM.noclip)) islands.collide(s, dt); // [admin-menu] NOCLIP glides through rocks / islands // [solid rocks] same solid rocks for the player, every enemy type, bosses, escorts and PvP AI
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
  if (e.remote) { pvp.updateRemote(e, dt); return; } // [pvp] another client's ship / the host's AI: interpolated
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
  const PV = game.mode === 'pvp', Y = PV ? T : player; // [pvp] AI ships hunt whoever is nearest, not just you
  const dYou = T === Y ? d : Math.hypot(Y.x - e.x, Y.z - e.z);
  let desired = e.yaw, spd = e.maxSpeed * 0.55;
  if (e.state === 'flee') {
    desired = Math.atan2(Y.x - e.x, Y.z - e.z) + Math.PI; spd = e.maxSpeed;
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
    const ring = PV && !T.alive && e.islandPatrol && e.patrolC; // [v314] no target (you are moored / ashore): patrol the outer island ring, never (0, 0) off the dock
    if (!e.wp || Math.hypot(e.wp[0] - e.x, e.wp[1] - e.z) < 15 || !!ring !== !!e.wpRing) {
      if (ring) { const [pcx, pcz] = e.patrolC, a = Math.atan2(e.z - pcz, e.x - pcx) + (e.patrolDir || 1) * 0.45, R = e.patrolR || 760; e.wp = [pcx + Math.cos(a) * R, pcz + Math.sin(a) * R]; e.wpRing = true; }
      else { e.wp = [Y.x + rnd(-120, 120), Y.z + rnd(-120, 120)]; e.wpRing = false; } }
    desired = Math.atan2(e.wp[0] - e.x, e.wp[1] - e.z);
    if (dYou < SPOT_RANGE && (!PV || T.alive)) desired = Math.atan2(Y.x - e.x, Y.z - e.z); // spotted you, close in ([spawn ring] was 230 m: covers the whole spawn ring so fresh waves still head straight in)
  }
  // keep apart from other ships
  for (const o of [player, ...escorts.list, ...enemies]) {
    if (o === e || !o.alive) continue;
    const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz);
    if (od < 14 && od > 0.01) { const push = (14 - od) * 0.9 * dt; e.x += ox / od * push; e.z += oz / od * push; if (od < 22) desired = Math.atan2(ox, oz) * 0.5 + desired * 0.5; }
  }
  if (game.mode === 'pvp') desired = pvp.botSteer(e, desired); // [pvp] stay inside the arena
  if (dock) desired = dock.aiSteer(e, desired); // [Emerly] AI keeps out of SAFE HARBOR
  const diff = angWrap(desired - e.yaw);
  moveShip(e, dt, spd, clamp(diff * 2, -1, 1));
  floatShip(e, dt);
  // fire when player sits on a broadside
  e.cd -= dt;
  if (e.cd <= 0 && T.alive && d < (e.fireR || 70) && e.state !== 'flee' || (e.cd <= 0 && e.state === 'flee' && d < 40)) {
    const [lx, lz] = toLocal(e, T.x, T.z);
    const ang = Math.abs(Math.atan2(lz, Math.abs(lx)));
    if (ang < 0.5) { fire(e, lx > 0 ? 'port' : 'star', T, e.accuracy); e.cd = e.reload * rnd(0.85, 1.25); }
  }
  // damage smoke
  if (e.hp < e.maxHp * 0.6) { e.smokeT -= dt; if (e.smokeT <= 0) { e.smokeT = 0.12; fx.smoke(new THREE.Vector3(e.x + rnd(-2, 2), e.y + 3, e.z + rnd(-3, 3)), e.hp < e.maxHp * 0.35); } }
}

// ---------- cannonballs ----------
const G = 20;
// [v95] place a ball at its muzzle's CURRENT world position (ship already moved / floated this frame). Aimed shots keep their aim
// point (velocity corrected for the gun's move since the trigger); unaimed ones keep their launch velocity. Muzzle flash here too.
const _mp = new THREE.Vector3();
function launchBall(b) {
  let m = b.muzzle; b.muzzle = null;
  const live = (o) => { while (o.parent) o = o.parent; return o === scene; };
  if (!live(m) && b.owner?.mesh) { const L = gunList(b.owner, b.side || 'port'); if (L.length) m = L[(b.gi | 0) % L.length]; } // ship rebuilt (skin / upgrade) mid-ripple: use the new barrel
  // [v348] t1827u: the LIVE barrel tip: this frame's moveShip / floatShip / remote interpolation already ran (updateBalls is after them),
  // and the ship's world matrix is refreshed before the read (three.js only does that at render time otherwise)
  if (m.parent && b.owner?.mesh?.parent) { b.owner.mesh.updateMatrixWorld(true); m.getWorldPosition(_mp); b.mesh.position.copy(_mp); }
  b.mesh.visible = true; b.spawnAt = b.mesh.position.clone();
  // [v347] t1824u: the ball leaves its muzzle on its TRUE parabola and never bends mid-air (the v97.1 b.ex / b.tp sideways ease and the
  // ripple-delay re-aim onto a fixed point are gone: those were what made broadsides look like heat-seeking missiles)
  b.tp = null; b.ex = null; b.ft = 0;
  window.PFP_BALL_TAP?.(b);
  if (b.owner?.mesh) fx.muzzle(b.mesh.position, sideDir(b.owner, b.side || 'port'));
}
function updateBalls(dt) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.delay > 0) { b.delay -= dt; if (b.delay > 0) { b.mesh.visible = false; continue; } }
    if (b.muzzle) { launchBall(b); continue; } // [v95] appears exactly at the barrel tip this frame, flies from the next
    b.mesh.visible = true;
    const p = b.mesh.position; // [v347] one true ballistic path: drawn = simulated, zero mid-flight lateral curve
    b.v.y -= G * dt; p.addScaledVector(b.v, dt); b.life -= dt;
    fx.trail(b.mesh.position);
    let done = false;
    const ownAlly = b.owner === player || b.owner.ally;
    if (game.mode === 'pvp') done = pvp.ballStep(b, p); // [pvp] free-for-all hits, shooter decides / victim applies
    else for (const s of [player, ...escorts.list, ...enemies]) {
      if (s === b.owner || !s.alive) continue;
      if (ownAlly === (s === player || !!s.ally)) continue; // [escorts] no friendly fire: enemies don't hurt each other, you + escorts don't either
      const [lx, lz] = toLocal(s, p.x, p.z);
      const u = s.mesh.userData;
      const hl = u.hitLen || u.len; // [v97] long hulls: the hit box stays the design length (Waves) / +10% max (Battle Royale)
      if (Math.abs(lx) < u.beam / 2 + 0.7 && Math.abs(lz) < hl / 2 + 0.6 && p.y > s.y - 1.5 && p.y < s.y + hl * 0.9) {
        damage(s, b.owner === player ? Math.round(rnd(BALL_DMG[0], BALL_DMG[1]) * (player.gunDmg || 1)) : b.owner.ally ? escorts.ballDmg(b.owner) : Math.max(1, Math.round(rnd(6, 10) * (1 + game.wave * 0.04) * (b.owner.dmgMul || 1) * (1 - (s.armor || 0)))), p.clone(), b.owner); // [escorts] escort balls; armor of whoever got hit // [Raul] ship upgrades: enemy type damage, armor; upgrade buffs: CANNONS gunDmg
        done = true; break;
      }
    }
    const wh = done ? 0 : waveHeight(p.x, p.z, game.t), gnd = !done && dock?.on && p.y < 70 ? dock.world.ground(p.x, p.z) : -1e9; // [v347] the walkable island under the ball
    // [v347] in the harbor the island's coarse 'rock' circles + nav land mask used to eat balls metres above the beach / shallows (they vanished): the real ground decides
    if (!done && islands.hitBall(p, gnd > -1e8)) { fx.hit(p.clone()); done = true; if (game.mode === 'pvp') pvp.shoreImpact?.(b, p); } // [solid rocks] balls stop on rocks
    // [v347] t1821u: a ball reaching the coast (beach, quay, pier, hill) lands ON it: blast + dust + thud (never through the island / under the sand)
    if (!done && gnd > -1e8) { const g = gnd; if (g > wh + 0.05 && p.y <= g) { p.y = g + 0.15; fx.hit(p.clone()); fx.smoke(p.clone(), false); fx.smoke(p.clone().setY(g + 0.8), false);
      sfx.impact?.({ dmg: 12, maxHp: 100, kill: false, onPlayer: false, armor: 0, v: clamp(1 - p.distanceTo(camera.position) / 160, 0.05, 0.7) }); done = true; if (game.mode === 'pvp') pvp.shoreImpact?.(b, p); } }
    if (!done && p.y < wh) { fx.splash(p); ocean.addSplash(p.x, p.z, 2.8, game.t); // [aaa water] lingering foam
      sfx.splash(clamp(1 - p.distanceTo(player.mesh.position) / 150, 0.05, 0.8)); done = true; if (game.mode === 'pvp' && dock?.onFoot) pvp.shoreImpact?.(b, p); } // [v347] a splash at the waterline still catches a pirate wading
    if (done || b.life <= 0) { freeBall(b.mesh); balls.splice(i, 1); }
  }
}

// ---------- input ----------
const keys = {};
const held = { left: false, right: false };
const shipLocked = () => !!(dock?.onFoot || dock?.canoeing || dock?.inHull || ADM.frozen); // [admin-menu] + frozen by the owner // [v314]/[v333] canoe / walker / hull own the input
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (game.state === 'playing') {
    const helmOff = shipLocked(); // [v314] in the canoe / ashore: no stray sail / fire / anchor input to the big ship
    if (!helmOff && isKey('sailUp', e.code)) setSail(player.sail + 1);
    if (!helmOff && isKey('sailDown', e.code)) setSail(player.sail - 1);
    if (!helmOff && !anyModalOpen?.() && !document.documentElement.classList.contains('pfp-tedit') && isKey('firePort', e.code)) playerFire('port');
    if (!helmOff && !anyModalOpen?.() && !document.documentElement.classList.contains('pfp-tedit') && isKey('fireStar', e.code)) playerFire('star');
    if (!helmOff && isKey('anchor', e.code)) { toggleAnchor(); e.preventDefault(); }
    if (isKey('camera', e.code)) resetCamera();
  }
  if (e.code === 'Space' && game.state === 'playing') e.preventDefault(); // never scroll / press a focused button
  // [v339] Escape closes the topmost modal (capture installer) — never opens Settings over it; gameplay keys ignored while a modal is open
  if (e.code === 'Escape' && anyModalOpen?.()) { e.preventDefault(); return; }
  if (anyModalOpen?.() && !isKey('pause', e.code)) return;
  if (isKey('pause', e.code) || e.code === 'Escape') togglePause();
  if (isKey('sound', e.code)) toggleSound();
  if (isKey('full', e.code) && !ON_PORTAL) toggleFull(); // portals bring their own fullscreen (CrazyGames forbids custom fullscreen)
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

function setSail(n) { if (shipLocked()) return; player.sail = clamp(n, 0, 3); if (player.sail > 0) player.anchor = false; updateHud(); }
function toggleAnchor() { if (shipLocked()) return; player.anchor = !player.anchor; if (player.anchor) player.sail = 0; else if (player.sail === 0) player.sail = 1; updateHud(); }
function resetCamera() {
  const portrait = camera.aspect < 1, k = camScale(player.mesh.userData), dist = (portrait ? 46 : 34) * k, up = (portrait ? 24 : 16) * k; // [Raul] upgrade visuals: framing scales with hull
  const back = new THREE.Vector3(-Math.sin(player.yaw) * dist, up, -Math.cos(player.yaw) * dist);
  camera.position.copy(player.mesh.position).add(back);
}
function toggleSound() { initAudio(); setMuted(!muted); } // [Raul] sound upgrades: button state follows onAudioState below
function toggleFull() { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); }
// [Raul] sound upgrades: clear sound button state + volume sliders in the pause menu
onAudioState((a) => {
  const quick = $('pause-sound'); if (quick) { const label = a.muted ? '🔇 MUTED' : '🔊 SOUND ON'; if (quick.textContent !== label) quick.textContent = label; quick.setAttribute('aria-pressed', String(a.muted)); }
  const b = $('btn-sound'); { const ic = a.muted ? '🔇' : '🔊'; if (b.textContent !== ic) b.textContent = ic; }
  b.classList.toggle('off', a.muted); b.classList.toggle('locked', !a.muted && !a.running);
  b.title = a.muted ? `Sound OFF (tap to turn on, ${keyName(binds('sound')[0])})` : a.running ? `Sound ON (tap to mute, ${keyName(binds('sound')[0])})` : 'Tap anywhere to enable sound';
  b.setAttribute('aria-pressed', a.muted ? 'true' : 'false');
  const t = $('btn-sound-title'); // [start mute] start-page button mirrors the same state
  if (t) { const ic = a.muted ? '🔇' : '🔊'; if (t.textContent !== ic) t.textContent = ic; // only on change: swapping the text node mid-press cancels the click in Chrome
    t.classList.toggle('off', a.muted); t.setAttribute('aria-pressed', a.muted ? 'true' : 'false');
    t.setAttribute('aria-label', a.muted ? 'Unmute sound' : 'Mute sound'); t.title = a.muted ? 'Sound OFF (tap to turn on, M)' : 'Sound ON (tap to mute, M)'; }
  for (const k of ['master', 'sfx', 'music']) { const el = $('vol-' + k); if (el && document.activeElement !== el) el.value = Math.round(a[k] * 100); }
});
for (const k of ['master', 'sfx', 'music']) { const el = $('vol-' + k); if (el) el.addEventListener('input', () => { const v = el.value / 100; initAudio(); if (muted && v > 0) setMuted(false); setLevel(k, v); }); } // read the value before initAudio(): its state notify re-syncs unfocused sliders (iOS doesn't focus range inputs on touch)
devHook('PFP_AUDIO', { sfx, setLoadout });
$('btn-sound').onclick = toggleSound; $('btn-sound-title').onclick = toggleSound; $('btn-cam').onclick = resetCamera; $('btn-full').onclick = toggleFull;
$('pause-sound').onclick = () => $('btn-sound').click();
$('pause-camera').onclick = () => { $('btn-cam').click(); if (!$('pause').classList.contains('hidden')) togglePause(); };
$('pause-fullscreen').onclick = () => $('btn-full').click();
$('btn-pause').onclick = togglePause; $('btn-resume').onclick = togglePause;
initControlsUi();
// [v76] ⚙ settings: low-key save status + CONNECT WALLET (the same signed flows as the save-progress pop-ups:
// Battle Royale = the 🏴 menu's wallet button (merges device progress), Waves / home = the Waves save-progress button)
function setSaveUi() {
  const row = $('set-save'); if (!row) return; if (ON_PORTAL) { row.remove(); return; }
  const br = game.mode === 'pvp' && !!pvp;
  let w = '';
  if (br) w = window.PFP_PVP_SAVE?.walletSession?.()?.wallet || '';
  else { try { const s = JSON.parse(localStorage.getItem('pfp_session_v1') || 'null'); if (s?.token && Date.parse(s.expires_at) > Date.now()) w = s.wallet || ''; } catch {} }
  $('set-save-t').textContent = w ? `Progress saved to wallet ${shortWallet(w)}` : 'Progress saved on this device';
  $('set-save-btn').textContent = w ? 'DISCONNECT' : 'CONNECT WALLET';
  const src = br ? $('pvp-wallet-state') : $('wallet-note'); $('set-save-msg').textContent = src && setSaveUi.watch ? src.textContent : '';
}
{ const b = $('set-save-btn'); if (b) b.onclick = () => {
  const br = game.mode === 'pvp' && !!pvp, connected = b.textContent === 'DISCONNECT';
  if (br) { pvp.renderMenu?.(); $('pvp-wallet')?.click(); } else (connected ? $('wc-out') : $('btn-wallet'))?.click();
  setSaveUi.watch = true; clearInterval(setSaveUi.t); let n = 0; setSaveUi.t = setInterval(() => { setSaveUi(); if (++n > 240) { clearInterval(setSaveUi.t); setSaveUi.watch = false; } }, 500);
}; }
// [v71] ⚙ settings holds the Battle Royale entries (BANKSY): 🏴 menu (skins / scoreboard / name / save) + ⚓ return to harbor
const _bsp = $('btn-set-pvpmenu'); if (_bsp) _bsp.onclick = () => { togglePause(); if (!$('pause').classList.contains('hidden')) $('pause').classList.add('hidden'); pvp?.toggleMenu(true); };
const _bsh = $('btn-set-harbor'); if (_bsh) _bsh.onclick = () => { if (_bsh.disabled) return; togglePause(); $('pause').classList.add('hidden'); $('pvp-menu-return')?.click(); };
installModalKeyIsolation(); installMouseBinds({ canvas, inGame: () => game.state === 'playing' || !!pvp?.spectating });
const pad = initGamepad({ game: () => game, controls, camera, binds, spectating: () => !!pvp?.spectating }); // [Emerly gamepad] js/gamepad.js
{ const b = $('btn-ctl-title'); if (b) b.onclick = () => openControls(); }
{ const b = $('btn-ctl-pause'); if (b) b.onclick = () => openControls(); }
$('btn-quit').onclick = () => { $('pause').classList.add('hidden'); if (WAVES_HOME && game.mode !== 'pvp') { wavesBank(); return returnToHarbor(); } toTitle(); }; // [v330] t1753u: quitting Storm Hunt banks 100 / wave and sails home

function togglePause() { // [v71] ⚙ settings: Waves pauses underneath; Battle Royale + spectate keep the shared sea running (just a menu)
  if (game.mode === 'pvp' && game.state === 'playing' && $('pvp-menu') && !$('pvp-menu').classList.contains('hidden')) { pvp.toggleMenu(false); return; } // [pvp] Esc closes the PvP menu first
  const pv = game.mode === 'pvp' || !!pvp?.spectating;
  if ($('pause-sub')) $('pause-sub').textContent = pv ? 'the battle keeps going' : 'game paused';
  setSaveUi();
  { const hb = $('btn-set-harbor'); if (hb) { const ok = pvp?.where === 'arena' && !pvp?.me?.dead; hb.disabled = !ok; hb.title = ok ? '' : 'You are already in the harbor'; } }
  if (pvp?.spectating && game.state !== 'playing' && game.state !== 'paused') { $('pause').classList.toggle('hidden'); return; }
  if (game.state === 'playing') { game.state = 'paused'; $('pause').classList.remove('hidden'); { const q = $('btn-quit'); if (q) q.textContent = WAVES_HOME && game.mode !== 'pvp' ? '⚓ RETURN TO HARBOR' : 'MAIN MENU'; } } // [v330] t1753u
  else if (game.state === 'paused') { game.state = 'playing'; $('pause').classList.add('hidden'); }
}

// ---------- HUD ----------
// [repair] player: 20 s without taking damage -> +5% max HP every 4 s, up to full (green pulse on the captain-card bar)
const PLAYER_REPAIR = { wait: 20, every: 4, pct: 0.05 };
function updatePlayerRepair(dt) {
  player.calm = (player.calm || 0) + dt;
  const on = player.calm >= (player.regenWait ?? PLAYER_REPAIR.wait) && // [Raul] upgrade buffs: HULL PLANKS shorten the wait
    player.hp < player.maxHp;
  player._repOn = on; syncHpBar(); // [t1724u] on foot the bar shows your pirate, never this ship tick
  if (!on) { player.repT = 0; return; }
  player.repT = (player.repT || 0) + dt;
  if (player.repT < PLAYER_REPAIR.every) return;
  player.repT -= PLAYER_REPAIR.every;
  player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * (player.regenPct ?? PLAYER_REPAIR.pct))); updateHud();
}
// [t1724u] BANKSY "For PvP use same health bar": ONE HP bar (the captain card #player-hp). On foot (ashore / in a cottage) it shows
// your pirate's on-foot PvP HP + the green .repairing pulse from js/onfoot/battle.js; the moment you board it is your ship again.
function footHp() { const d = dock; if (!d?.on || !d.onFoot) return null; const f = d.battle?.hpState?.(); return f && f.maxHp > 0 ? f : null; }
function syncHpBar() {
  const bar = $('player-hp'); if (!bar) return; const f = footHp();
  const pct = f ? f.hp / f.maxHp : player.hp / Math.max(1, player.maxHp), w = `${Math.max(0, Math.min(100, pct * 100))}%`;
  if (bar.style.width !== w) bar.style.width = w;
  bar.parentElement.classList.toggle('repairing', f ? !!f.repairing : !!player._repOn);
  document.documentElement.classList.toggle('pfp-foothp', !!f);
}
function updateHud() {
  $('score').textContent = game.score; $('wave').textContent = game.wave; $('gold').textContent = formatGoldAmount(game.gold); $('sunk').textContent = game.sunk;
  syncHpBar(); // [t1724u] ship HP at sea, your pirate's HP on foot
  $('sail-level').textContent = player.sail;
  $('anchor').classList.toggle('on', player.anchor);
  const alive = enemies.filter(e => e.alive).length;
  $('enemies-left').textContent = alive ? `${alive} rug ship${alive > 1 ? 's' : ''} left` : '';
  if (game.mode === 'pvp') pvp?.hud(); // [pvp] KILLS / DEATHS / GOLD / K/D
}
function addScore(n) { game.score += n; }
let bannerTimer = 0;
function banner(text, sub = '') {
  const b = $('banner'); b.innerHTML = `${escHtml(text)}${sub ? `<div style="font-size:0.38em;color:#fff;text-align:center">${escHtml(sub)}</div>` : ''}`; // [security H5] banners can carry pirate names: always plain text
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
    const s = screenPos(new THREE.Vector3(e.x, e.y + (e.mesh.userData.hitLen || e.mesh.userData.len) * 1.05, e.z));
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
    const s = e.alive && game.state !== 'title' ? screenPos(new THREE.Vector3(e.x, e.y + (e.mesh.userData.hitLen || e.mesh.userData.len) * 1.05, e.z)) : null;
    if (!s || !s.vis) { e.bar.style.display = 'none'; continue; }
    e.bar.style.display = 'block'; e.bar.style.left = `${s.x}px`; e.bar.style.top = `${s.y}px`;
    e.fill.style.width = `${(e.hp / e.maxHp) * 100}%`;
    e.bar.classList.toggle('low', e.state === 'retreat');
  }
}
const radar = $('radar'), rctx = radar.getContext('2d');
function drawRadar() {
  const W = radar.width, R = W / 2, range = 260;
  if (dock?.on) { // [v106] in the harbor (at sea + on foot): the whole-island map (js/islandMap.js), north up
    const peers = [], ai = [];
    // [v340] split by net kind (NOT radarColor): non-squad players are black, not AI red
    for (const e of enemies) if (e.alive) (e.net?.kind === 'player' ? peers : ai).push({ x: e.x, z: e.z, boss: !!e.harborBoss, squad: !!e._hbSquad });
    if (dock.drawMinimap(rctx, W, { ship: { x: player.x, z: player.z, yaw: player.yaw }, peers, ai, loot })) return;
  }
  rctx.clearRect(0, 0, W, W);
  rctx.strokeStyle = 'rgba(255,205,119,0.25)'; rctx.lineWidth = 1;
  [0.33, 0.66].forEach(f => { rctx.beginPath(); rctx.arc(R, R, R * f, 0, 7); rctx.stroke(); });
  // [t1726u] no Safe Zone overlay / pill on the ship radar
  const dot = (x, z, color, r) => {
    const [lx, lz] = toLocal(player, x, z);
    let px = -lx / range * R, py = -lz / range * R; // heading up, port on the left
    const m = Math.hypot(px, py); if (m > R - 5) { px *= (R - 5) / m; py *= (R - 5) / m; }
    rctx.fillStyle = color; rctx.beginPath(); rctx.arc(R + px, R + py, r, 0, 7); rctx.fill();
  };
  loot.forEach(l => dot(l.x, l.z, '#ffcd77', 3));
  healthDrops.radar(dot); // [health drops] green dots
  enemies.forEach(e => { if (!e.alive) return; // [v98] Arena squads: blue teammates · [v94] harbor boss · [v340] Harbor other players BLACK, squadmates GREEN
    if (e.harborBoss) { dot(e.x, e.z, '#ffcd00', 7.5); dot(e.x, e.z, '#fa0d0d', 5); return; }
    const r = e.big ? 5 : 3.8;
    if (e._hbSquad || e.radarColor === '#2fd866') { dot(e.x, e.z, '#f5efe0', r + 1.3); dot(e.x, e.z, '#2fd866', r); return; }
    if (e._hbOther || e.radarColor === '#0d0d10') { dot(e.x, e.z, '#f5efe0', r + 1.4); dot(e.x, e.z, '#0d0d10', e.big ? 5 : 3.8); return; }
    dot(e.x, e.z, e.radarColor || (e.state === 'flee' ? '#ff9b9b' : '#fa0d0d'), e.big ? 5 : 3.5);
  });
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
// [waves entry] WAVES opens the same entry pop-up as BATTLE ROYALE (name, optional airdrop wallet, save progress). Same saved name +
// wallet as before; the run, score submission, gold and skins are unchanged. Portal builds: straight to sea (crypto-free).
if (ON_PORTAL) document.querySelectorAll('#waves-entry .we-crypto').forEach(el => el.remove()); // crypto-free builds: name + skins only, no wallet UI
const we = $('waves-entry'), weName = $('we-name'), weAddr = $('we-addr');
function weCheck() {
  if (!weAddr) return false;
  const v = weAddr.value.trim(), ok = isValidSolanaAddress(v);
  weAddr.classList.toggle('good', ok); weAddr.classList.toggle('bad', !!v && !ok);
  $('we-addr-msg').textContent = !v ? 'Optional. Never asks for keys. Changing it later: a free signature.' : ok ? `Ahoy ${shortWallet(v)}! Never asks for keys. Changing it later: a free signature.` : 'That doesn’t look like a Solana address (base58, 32–44 characters).';
  return ok;
}
function renderWavesSkins() { // same cards as the BATTLE ROYALE picker; locked ones show their unlock wave
  const grid = $('we-skins'); if (!grid) return; grid.innerHTML = '';
  const cur = equippedSkin().id;
  for (const { skin, wave } of [{ skin: getSkin('classic'), wave: 0 }, ...wavesUnlocks()]) {
    const ok = ownsSkin(skin.id), c = document.createElement('button'); c.type = 'button'; c.className = `pvp-skin${ok ? '' : ' locked'}${skin.id === cur ? ' on' : ''}`; c.dataset.skin = skin.id;
    c.appendChild(skinSwatch(skin, 96, 48));
    const lab = document.createElement('span'); lab.innerHTML = `<b>${skin.name}</b>${ok ? (skin.id === cur ? 'SELECTED' : 'TAP TO USE') : `reach wave ${wave}`}`; c.appendChild(lab);
    c.disabled = !ok; c.onclick = () => { equipSkin(skin.id); try { rebuildPlayerShip(game.state === 'paused' || game.state === 'playing' ? getRunLevels() : {}); /* [v83] keep this run's upgrades */ } catch (e) { console.warn(e); } sfx.equip?.(); renderWavesSkins(); };
    grid.appendChild(c);
  }
  previewCards(grid, [getSkin('classic'), ...wavesUnlocks().map(u => u.skin)].map(sk => ({ id: sk.id, skin: sk })), {}); // [v75] real renders
}
// [t1716u] Waves cannot change skins mid-run — wear Harbor choice. Keep #waves-skins permanently hidden.
function openWavesSkins() { $('waves-skins')?.classList.add('hidden'); }
function closeWavesSkins() { $('waves-skins')?.classList.add('hidden'); if (game.state === 'paused') $('pause')?.classList.remove('hidden'); }
{ const b = $('btn-set-wskins'); if (b) { b.setAttribute('hidden', ''); b.classList.add('hidden'); b.onclick = (e) => { e.stopPropagation(); openWavesSkins(); }; }
  for (const id of ['ws-close', 'ws-done']) { const x = $(id); if (x) x.onclick = (e) => { e.stopPropagation(); closeWavesSkins(); }; }
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !$('waves-skins')?.classList.contains('hidden')) { e.stopImmediatePropagation(); e.preventDefault(); closeWavesSkins(); } }, true); }
// [v330] BANKSY t1752u "choosing storm hunt doesn't start the storm hunt mini game anymore": #waves-entry lived inside #title, which is
// display:none in-game, so the harbor card's START STORM HUNT and the island board's ▶ START STORM HUNT opened an invisible card.
// The card is a top-level overlay now, and from INSIDE the game (Harbor / Island) a pirate who already has a name sails straight
// into Storm Hunt: step aboard if on foot, then startGame() (pvp.leave() drops the harbor / island world). &wavesdirect=0 = always the card.
function openWavesEntry() {
  if (!we) return startGame();
  const inGame = game.mode === 'pvp' && game.state !== 'title', nm = getSavedName() || (pvp && pvp.name) || '';
  if (inGame && nm && !/[?&]wavesdirect=0(&|$)/.test(location.search)) {
    if (!getSavedName()) { try { saveName(String(nm).slice(0, 20)); } catch {} }
    try { if (dock?.onFoot) dock.goAboard?.(true); } catch (e) { console.warn('[waves] go aboard', e); }
    try { pvp?.toggleMenu?.(false); } catch {}
    for (const id of ['pvp-entry', 'waves-entry']) $(id)?.classList.add('hidden');
    startGame(); return;
  }
  weName.value = getSavedName(); if (weAddr) { weAddr.value = (pirate?.account.connected && pirate.account.wallet) || getSavedWallet(); weCheck(); }
  we.classList.remove('hidden'); setTimeout(() => (weName.value ? $('we-go') : weName).focus(), 50);
}
async function wavesGo() {
  const n = weName.value.trim().slice(0, 20), go = $('we-go'), msg = $('we-name-msg'); if (go?.disabled) return;
  if (n && n.toLowerCase() !== getSavedName().toLowerCase() && window.PFP_PVP_SAVE?.checkName) { // [v76] one name = one pirate
    if (go) go.disabled = true; const a0 = weAddr ? weAddr.value.trim() : '';
    const free = await window.PFP_PVP_SAVE.checkName(n, { mode: 'waves', wallet: isValidSolanaAddress(a0) ? a0 : '' }); if (go) go.disabled = false;
    if (free === false) { window.PFP_ACCT_UI?.nameTaken(msg, n); msg?.classList.remove('hidden'); weName.focus(); return; } } // [v106] + LOG IN
  msg?.classList.add('hidden');
  if (n) { saveName(n); syncName(n); }
  const a = weAddr ? weAddr.value.trim() : ''; if (isValidSolanaAddress(a)) saveWallet(a); // optional: anything else is ignored, never blocks
  we.classList.add('hidden'); startGame();
}
if (we) {
  weName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); weAddr ? weAddr.focus() : wavesGo(); } });
  if (weAddr) {
    weAddr.addEventListener('input', weCheck);
    weAddr.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!weAddr.value.trim() || weCheck()) wavesGo(); } });
  }
  $('we-go').onclick = wavesGo; $('we-close').onclick = () => we.classList.add('hidden');
  we.addEventListener('click', (e) => { if (e.target === we) we.classList.add('hidden'); });
}
$('btn-start').onclick = () => openWavesEntry();
window.PFP_OPEN_WAVES = () => openWavesEntry(); // [v103] the harbor card's WAVES tab + the island WAVES board open the same Waves entry
{ // [v98] home SPECTATE: SOLO / SQUADS / [v99] HARBOR switch (what to watch), remembered on this device
  const sw = $('spec-mode-sw');
  if (sw && !PVP_ENABLED) sw.remove();
  else if (sw) { const get = () => { try { const m = localStorage.getItem('pfp_spec_mode'); return m === 'squads' || m === 'harbor' ? m : 'solo'; } catch { return 'solo'; } }; // [v99] + HARBOR (the busiest shared harbor copy)
    const paint = () => sw.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.m === get()); b.setAttribute('aria-pressed', b.dataset.m === get()); });
    sw.addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (!b) return; e.stopPropagation(); try { localStorage.setItem('pfp_spec_mode', b.dataset.m); } catch {} paint(); window.PFP_HOME_LIVE?.(); });
    paint(); } }
if (PVP_ENABLED) { // [v103] BANKSY: the home screen just ENTERS THE GAME (the harbor + island). Waves = the WAVES board on the island,
  // Battle Royale = the harbor card (JOIN BATTLE / SPECTATE, SOLO / SQUADS) + the ARENA board. The portal builds keep WAVES (no PvP there).
  const bp = $('btn-pvp'); bp.textContent = 'ENTER GAME'; bp.title = 'Enter the harbor + island: Storm Hunt and Battle Royale are both in there'; $('btn-start')?.remove(); }
if (PVP_ENABLED) { $('btn-pvp').onclick = () => startPvp(); $('btn-spectate').onclick = () => startPvp(true); } else { $('btn-pvp')?.remove(); $('btn-spectate')?.remove(); } // [pvp] not on game portals
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
    const nm = document.createElement('span');
    const b = document.createElement('b'); b.textContent = r.score;
    if (!ON_PORTAL && r.wallet) { // [copy wallet] tap the wallet address to copy the full address
      if (r.name) nm.append(`${r.name} · `);
      const w = document.createElement('a'); w.className = 'lb-wallet'; w.textContent = shortWallet(r.wallet);
      w.dataset.wallet = r.wallet; w.tabIndex = 0; w.setAttribute('role', 'button'); w.title = 'Copy wallet address'; w.setAttribute('aria-label', `Copy wallet ${r.wallet}`);
      nm.append(w);
    } else nm.textContent = r.name ? `${r.name} · ${shortWallet(r.wallet)}` : shortWallet(r.wallet);
    li.append(rk, nm, b);
    el.appendChild(li);
  });
  // game over: if your row is below the first 5, scroll the list (only the list) so it's in view
  if (mine && el.id === 'board-over' && mine.offsetTop + mine.offsetHeight > el.clientHeight) el.scrollTop = mine.offsetTop - (el.clientHeight - mine.offsetHeight) / 2;
  boardHint(el);
}
// [copy wallet] one delegated listener per board (rows are rebuilt on every render)
async function copyText(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch {}
  try { // fallback: old WebViews / iOS without clipboard permission
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;';
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
let copyToastT = 0;
function copyToast(msg) {
  let t = $('copy-toast');
  if (!t) { t = document.createElement('div'); t.id = 'copy-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(copyToastT); copyToastT = setTimeout(() => t.classList.remove('on'), 1600);
}
async function copyRowWallet(a) {
  const w = a?.dataset.wallet; if (!w) return;
  const ok = await copyText(w);
  copyToast(ok ? `Copied! ${shortWallet(w)}` : `Copy failed: ${w}`);
}
for (const id of ['board-title', 'board-over']) {
  const el = $(id); if (!el) continue;
  el.addEventListener('click', (e) => copyRowWallet(e.target.closest('.lb-wallet')));
  el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.lb-wallet')) { e.preventDefault(); copyRowWallet(e.target); } });
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
  clearEmotes(); // [v96]
  const leftPvp = game.mode === 'pvp' && mode !== 'pvp'; // [v330] Harbor / Island -> Storm Hunt (t1752u)
  if (leftPvp) pvp?.leave(); // [pvp]
  if (mode !== 'pvp') harborResumeClear(); // [v339] Storm Hunt: never resume into the Harbor
  player.calm = 0; player.repT = 0; // [repair]
  // [set sail first] no name / wallet needed to sail; use whatever was saved last time (may be empty)
  game.wallet = (pirate?.account.connected && pirate.account.wallet) || getSavedWallet(); game.name = getSavedName();
  game.runId = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); game.claimP = null; // [wallet save] // [v330] one payout per run
  if (mode !== 'pvp') wavesStart(game.runId); // [v103] server notes the run start (for the score payout)
  // [daily] hidden from the UI: every run is a normal run
  game.mode = mode === 'pvp' ? 'pvp' : null; game.seed = null; game.lootRng = null; game.dropRng = null; // [pvp] PvP is its own mode
  initAudio(); setMusic(true); // [Raul] sound upgrades: shanty loop (Music slider in pause menu)
  clearWorld();
  scene.remove(player.mesh); disposeShip(player.mesh); player = makePlayer();
  rebuildPlayerShip({}); // [t1716u] wear Harbor skin (+ captain/ship gear) even if just swapped in plaza before Waves
  Object.assign(game, { escortSunk: 0, storm: 0, state: 'playing', score: 0, gold: 0, wave: 0, sunk: 0, saved: false, startTime: performance.now(), waveTimer: 1.2, clearAck: false });
  game.captain = CAPTAINS[Math.floor(Math.random() * CAPTAINS.length)];
  setAvatar($('captain-img'), `assets/captains/${game.captain}.jpg`); // [v78] falls back to the skull if it fails to load
  $('captain-name').classList.remove('cn-split');
  $('captain-name').textContent = game.name ? `${game.name.toUpperCase()} · #${game.captain}` : `CAPT. #${game.captain}`;
  $('wallet-short').textContent = shortWallet(game.wallet);
  ['title', 'gameover', 'pause'].forEach(id => $(id).classList.add('hidden'));
  $('hud').classList.remove('hidden'); $('hint').style.opacity = 1;
  resetShop(); // [Raul] ship upgrades: fresh run, base stats
  if (game.mode === 'pvp') { game.wave = 3; pvp.applyProfile(); pvp.showRank(); } // '#' = Battle Royale kills rank // [pvp] saved upgrades + gold; AI ships at wave-3 strength
  resetCamera();
  updateHud();
  rotateTimer = 0; updateRotateHint();
  if (game.mode === 'pvp') { pvp.begin(); return; } // [pvp] no waves, no tutorial: drop straight in
  // [v330] t1752u: from the Harbor / Island straight into Storm Hunt: switch the dock world off NOW (its own per-frame check only runs while
  // the game is 'playing', so the island / harbor stayed drawn behind the how-to-play card) -> open sea for wave 1.
  if (leftPvp && dock) { try { dock.ship(0); } catch (e) { console.warn('[waves] dock off', e); } }
  banner(game.mode === 'daily' ? 'DAILY CHALLENGE' : 'SET SAIL!', game.mode === 'daily' ? `same seas for every pirate · ${game.seed}` : 'hunt the rug ships');
  maybeShowTutorial(); // [tutorial] how-to-play card, game paused until closed
}
// [pvp] PVP (BETA) button: load the PvP module + save, then sail straight into a room
async function startPvp(watch = false) { // [pvp] watch = SPECTATE (receive-only, no ship)
  const b = $(watch ? 'btn-spectate' : 'btn-pvp'); if (b.disabled) return; b.disabled = true; const label = b.innerHTML; b.textContent = 'LOADING…';
  try {
    if (!pvp) { const m = await import('./pvp.js'); pvp = m.createPvp(pvpCtx); }
    await pvp.prepare(); pvp.spectate(watch);
    startGame('pvp');
  } catch (e) { console.warn('[pvp] could not start', e); banner('PVP UNAVAILABLE', 'try again in a moment'); }
  finally { b.disabled = false; b.innerHTML = label; }
}

function toTitle() {
  harborResumeClear(); // [v339] MAIN MENU = a deliberate exit: no auto-resume
  clearEmotes(); // [v96]
  closeTutorial(); // [tutorial]
  if (game.mode === 'pvp') { pvp?.leave(); closeShop(); $('shop')?.classList.add('hidden'); game.mode = null; } // [pvp]
  game.state = 'title';
  setMusic(false); // [v102] audio: no shanty left running on the title screen (startGame turns it back on)
  clearWorld();
  $('hud').classList.add('hidden'); $('gameover').classList.add('hidden'); $('title').classList.remove('hidden');
  scene.remove(player.mesh); disposeShip(player.mesh); player = makePlayer(); player.sail = 1;
  syncDailyBtn();
  renderBoard($('board-title'));
  initHomeBoard(); // [pvp] refresh the BATTLE ROYALE board when back on the title
}

async function gameOver() {
  if (game.state === 'over') return;
  showNextWave(-1); // [wave break]
  game.state = 'over';
  setMusic(false); sfx.defeat?.(); // [v102] audio: the shanty stops when the run ends + Waves defeat stinger
  $('go-score').textContent = game.score; $('go-wave').textContent = game.wave; $('go-sunk').textContent = game.sunk; $('go-gold').textContent = formatGoldAmount(game.gold + (game.goldSpent || 0)); // [Raul] gold looted, incl. spent
  // [set sail first] ask for name + wallet here; a returning pirate sees them prefilled and can still edit
  nameInput.value = getSavedName(); walletInput.value = (pirate?.account.connected && pirate.account.wallet) || getSavedWallet(); // [wallet save] connected wallet fills itself in
  pirate?.save({ now: true }); // [wallet save] end of run
  const known = isValidSolanaAddress(walletInput.value.trim());
  $('go-wallet').textContent = pirate?.account.connected ? 'Connected wallet filled in. Your progress is saved to it.' : known ? 'Your name and wallet from last time are filled in. Edit them if you like.' : 'Add your wallet to put this run on the leaderboard.';
  $('save-msg').textContent = 'Save your score to the leaderboard (best score per wallet counts).';
  validateWallet();
  $('gameover').classList.remove('hidden');
  if (game.mode !== 'pvp') { const pay = $('go-pay'); if (pay) { pay.hidden = false; pay.textContent = `Banking ${formatGoldAmount(game.wave * 100)} gold (100 per wave)…`; } // [v103] // [v330] t1753u
    wavesBank(); }
  wavesExitLabel(); // [v330] t1753u: Storm Hunt from the Harbor -> ⚓ RETURN TO HARBOR (your real upgrades + the 100 / wave payout)
  updateRotateHint(); // hide the 'turn sideways' pill so it can't sit on top of the stats
  renderBoard($('board-over'));
  prepareShare(shareStats()); // pre-render the card so SHARE opens the share sheet inside the tap
}
function shareStats() { let skin = ''; try { skin = harborSkinObj()?.name || 'Classic'; } catch { skin = 'Classic'; } return { score: game.score, wave: game.wave, sunk: game.sunk, gold: game.gold + (game.goldSpent || 0), name: $('go-name').value.trim().slice(0, 20) || game.name, wallet: isValidSolanaAddress(walletInput.value.trim()) ? walletInput.value.trim() : game.wallet, captain: game.captain, skin }; }
$('btn-share').onclick = () => { const s = shareStats(); if (s.name !== game.name || s.wallet !== game.wallet) prepareShare(s); shareScore(s, { onStatus: (st) => { if (st === 'downloaded') $('save-msg').textContent = 'Score card downloaded. Attach it to your X post!'; } }); };
async function saveScore() {
  if (game.saved) return;
  if (!validateWallet()) { $('save-msg').textContent = 'Add a Solana wallet to save this run to the leaderboard.'; return; } // no wallet = no leaderboard entry
  game.saved = true; $('btn-save').disabled = true;
  game.name = nameInput.value.trim().slice(0, 20); saveName(game.name);
  game.wallet = walletInput.value.trim(); saveWallet(game.wallet);
  if (pirate?.account.connected) pirate.save({ now: true }); // [wallet save] keep the name in sync
  const r = await leaderboard.submit({ run: game.runId, wallet: game.wallet, name: game.name, score: game.score, wave: game.wave, sunk: game.sunk, duration_s: Math.round((performance.now() - game.startTime) / 1000), ...(game.mode === 'daily' ? { mode: 'daily', seed: game.seed } : {}) }, { proof: walletVerify?.getProof(game.wallet) || null }); // [wallet verify] proof only exists when the flag is on
  $('save-msg').textContent = game.mode === 'daily'
    ? (r.where === 'online' ? 'Saved to the online DAILY board!' : leaderboard.remote ? 'Saved on this device. Online daily board coming soon.' : 'Saved on this device.')
    : (r.where === 'online' ? (r.verified ? 'Saved to the online leaderboard ✅ verified!' : 'Saved to the online leaderboard!') : 'Saved on this device.');
  await renderBoard($('board-over'));
}
$('btn-save').onclick = saveScore;
// leaving the game over screen saves automatically when a valid wallet is filled in (returning pirates aren't nagged); otherwise the run is skipped
const saveIfReady = async () => { if (!game.saved && isValidSolanaAddress(walletInput.value.trim())) await saveScore(); };
// [v330] BANKSY t1753u: "It should move them to another room and start small and do the waves and upgrades then when they die they come back
// to real upgrades and not gain the gold had at end of waves but give them 100 per wave". Storm Hunt is its own solo sea (pvp.leave() frees the
// Harbor seat), starts on the base hull with 0 run gold (resetShop), and that run gold only buys run upgrades. When it ends, the server banks a
// flat 100 gold per wave reached (supabase pvp waves_claim) into your real save; RETURN TO HARBOR waits for that payout, then reloads your real
// profile (pvp.prepare) so you're back at your berth with your saved upgrades + the new gold. The run's own game.gold is never banked.
const WAVES_HOME = PVP_ENABLED && !ON_PORTAL; // the home screen enters the Harbor: Storm Hunt always returns there
function wavesBank() { // one payout per run (wavesClaim forgets the run id after the first call)
  if (game.claimP || game.mode === 'pvp' || !game.runId) return game.claimP || Promise.resolve(null);
  const w = game.wave | 0;
  game.claimP = wavesClaim({ run: game.runId, score: game.score, wave: w, sunk: game.sunk }).then(r => { const el = $('go-pay');
    if (el) { if (r?.ok && r.gold > 0) el.innerHTML = `Wave ${w} × 100 → <b>+${formatGoldAmount((+r.gold | 0))} gold banked</b>${r.holder ? ` <span class="muted">(${r.owner ? 'owner' : 'holder'} 2×: ${formatGoldAmount(+r.base | 0)} × 2)</span>` : ''}<br><small class="muted">100 gold per wave · run gold stays in the storm</small>`;
      else if (r && r.ok === false && r.error) el.textContent = `No gold banked: ${r.error}`; else if (!w) el.textContent = 'No waves reached: no gold banked'; else el.hidden = true; }
    return r; }, () => null);
  return game.claimP;
}
function wavesExitLabel() { const b = $('btn-menu'); if (!b) return; const home = WAVES_HOME && game.mode !== 'pvp'; b.textContent = home ? '⚓ RETURN TO HARBOR' : 'MAIN MENU'; b.classList.toggle('big', home); }
let wavesHomeBusy = false;
async function returnToHarbor() { // Storm Hunt over -> the Harbor with your real upgrades
  if (wavesHomeBusy) return; wavesHomeBusy = true; const b = $('btn-menu'); if (b) b.disabled = true;
  try {
    await wavesBank(); // the 100 / wave payout lands in your save BEFORE the Harbor profile is loaded
    $('gameover').classList.add('hidden'); $('pause').classList.add('hidden'); closeShop?.(); $('shop')?.classList.add('hidden');
    await startPvp(false);
    if (game.mode !== 'pvp') toTitle(); // the Harbor could not load: the title, as before
  } finally { wavesHomeBusy = false; if (b) b.disabled = false; }
}
$('btn-again').onclick = async () => { await saveIfReady(); startGame(); };
$('btn-menu').onclick = async () => { await saveIfReady(); if (WAVES_HOME && game.mode !== 'pvp') return returnToHarbor(); toTitle(); };

// ---------- main loop ----------
const clock = new THREE.Clock();
const moodColor = new THREE.Color(); // [aaa water]
let lastTarget = new THREE.Vector3();
let camShipK = 1; // [Raul] upgrade visuals
// camera pull-back for a bigger ship: less than the hull growth (so upgrades read BIGGER on screen), but enough for the tallest mast
function camScale(ud) { return Math.max(1, Math.pow(ud.shipScale || 1, 0.8), 0.8 * (ud.frameK || 1)); }
// [mobile] adaptive resolution: on phones / low quality, if a busy scene averages under ~40 fps for 2 s of
// play, step the render pixel ratio down (1.25 -> 1.12 -> 1.0). Down only, so it never oscillates.
const ADAPT = { on: true, steps: quality === 'low' ? [1.25, 1.12, 1] : [1.5, 1.25], min: quality === 'low' ? 38 : 45, t0: 0, n: 0, slow: 0, fast: 0, warm: 0, downAt: 0 }; // [perf2] every tier adapts (desktop 2 -> 1.5 -> 1.25 only when slow), 8 s warm-up after (re)entering play, steps back up after 20 s of smooth play // [mobile-perf] BANKSY "graphics get downgraded really bad": softer steps (1.25 -> 1.12 -> 1.0, never the blurry 0.85) and only after TWO slow windows in a row (a loading hitch no longer costs resolution for good)
// [mobile-perf-2] phones: island pieces lost in the fog are not drawn. FogExp2 is >99.5 % fog colour past 2.3 / density (~550 m), so a
// static island mesh whose whole bounding sphere sits beyond that is invisible anyway: skip it (draw calls + triangles), no visual change.
// Only the static island art (terrain chunks, trees / palms / rocks / nature, docks, shops, hill street, coast kit), never a LOD's own
// levels, never anything another system hid (we only re-show what WE hid). Re-checked ~4x a second; candidates re-collected every 3 s.
const FC = { list: [], t: 0, n: 0, re: /^(chunk_|foot_(trees|palms|rocks|nature|townkit)|dock_|shop_|hill_|plaza_|battery_|island_(toon|outline|glow))/, _s: new THREE.Sphere() };
function fogCull() {
  const now = performance.now(); if (now - FC.t < 250) return; FC.t = now;
  if (now - (FC.c || 0) > 3000) { FC.c = now; const L = []; scene.traverse((o) => { if (o.isMesh && FC.re.test(o.name || '') && !o.parent?.isLOD && o.geometry) L.push(o); });
    for (const o of FC.list) if (o.userData.fogHid && !L.includes(o)) { o.visible = true; o.userData.fogHid = false; } FC.list = L; }
  const d = scene.fog?.density; if (!d) { for (const o of FC.list) if (o.userData.fogHid) { o.visible = true; o.userData.fogHid = false; } return; }
  const far = 2.3 / d, cp = camera.position;
  for (const o of FC.list) { if (!o.visible && !o.userData.fogHid) continue; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    FC._s.copy(g.boundingSphere).applyMatrix4(o.matrixWorld); const out = FC._s.center.distanceTo(cp) - FC._s.radius > far;
    if (out && o.visible) { o.visible = false; o.userData.fogHid = true; } else if (!out && o.userData.fogHid) { o.visible = true; o.userData.fogHid = false; } }
}
const ADAPT_OFF = /[?&]adapt=0/.test(location.search); // [v330 perf] read once (was a regex every frame)
function adaptResolution() {
  if (!ADAPT.on || game.state !== 'playing' || document.hidden || ADAPT_OFF) { ADAPT.t0 = 0; ADAPT.warm = 0; return; }
  const now = performance.now(); if (!ADAPT.warm) ADAPT.warm = now; if (now - ADAPT.warm < 8000) return; // [perf2] loading / shader-compile hitches right after entering never count
  if (!ADAPT.t0) { ADAPT.t0 = now; ADAPT.n = 0; return; }
  ADAPT.n++;
  if (now - ADAPT.t0 < 2000) return;
  const fps = ADAPT.n * 1000 / (now - ADAPT.t0); ADAPT.t0 = 0;
  const next = ADAPT.steps.find(r => r < renderer.getPixelRatio() - 0.01);
  ADAPT.slow = fps < ADAPT.min ? ADAPT.slow + 1 : 0; ADAPT.fast = fps > 57 ? ADAPT.fast + 1 : 0;
  if (ADAPT.slow >= 2 && next) { ADAPT.slow = 0; ADAPT.downAt = now; renderer.setPixelRatio(next); onResize(); console.info('[mobile] fps', fps.toFixed(1), '-> pixel ratio', next); return; }
  let up = null; for (let i = ADAPT.steps.length - 1; i >= 0; i--) { const r = ADAPT.steps[i]; if (r > renderer.getPixelRatio() + 0.01 && r <= PR0) { up = r; break; } }
  up ||= renderer.getPixelRatio() < PR0 - 0.01 ? PR0 : null;
  if (up) { const [w, h] = viewSize(); up = renderPixelRatio(w, h, up, ULTRA); }
  if (up > renderer.getPixelRatio() + 0.01 && ADAPT.fast >= 10 && now - ADAPT.downAt > 20000) { ADAPT.fast = 0; renderer.setPixelRatio(up); onResize(); console.info('[gfx] smooth', fps.toFixed(1), 'fps -> pixel ratio', up); } // [perf2] back up (20 s of 57+ fps)
}
const gameplayHint = createGameplayHint(document.documentElement);
addEventListener('keydown', (e) => {
  if (['left', 'right', 'sailUp', 'sailDown', 'firePort', 'fireStar', 'anchor', 'jump', 'sprint', 'weapon'].some(a => isKey(a, e.code)) || ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) gameplayHint.input(game.state);
}, true);
addEventListener('pointerdown', (e) => { if (e.target === canvas || e.target.closest?.('#controls, #dk-joy, #dk-jump, #dk-acts')) gameplayHint.input(game.state); }, true);
const _camTgt = new THREE.Vector3(), _camD = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0), _hullList = []; // [v330 perf] frame() scratch
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  try { pad.tick(dt); } catch (e) { console.warn('[pad]', e); } // [Emerly gamepad] poll the pads first: keys / sticks land before the ship + walker read them this frame
  gameplayHint.update(game.state);
  if (!window.__pfpPlayable && game.state === 'playing') { window.__pfpPlayable = true; dispatchEvent(new Event('pfp-playable'));  { let n = 0; const iv = setInterval(() => { window.__pfpKitMerged = (window.__pfpKitMerged || 0) + mergeIslandKits(scene); if (HIGH) window.__pfpCastTrim = (window.__pfpCastTrim || 0) + trimSmallCasters(scene); if (OPT_ON) window.__pfpFrozen = (window.__pfpFrozen || 0) + freezeStaticWorlds(scene); if (++n >= 45) clearInterval(iv); }, 4000); } } // [perf4] the on-foot world is built on harbor entry: merge whenever its kit meshes appear // [perf3] deferred loads (music) start now
  adaptResolution();
  const running = game.state === 'playing' || game.state === 'over' || game.state === 'title' || (game.mode === 'pvp' && (game.state === 'shop' || game.state === 'paused')); // [pvp] the shared sea never pauses
  if (running) game.t += dt;
  const t = game.t;

  if (dock?.on && (dock.onFoot || document.documentElement.classList.contains('pfp-foothp'))) syncHpBar(); // [t1724u] on-foot HP every frame + snap back to the ship on boarding
  if (running) {
    // player
    if (game.state === 'playing' && player.alive) {
      const helmOff = shipLocked(); // [v314] never steer / sail the big ship from the canoe or the beach
      const turn = helmOff ? 0 : ((heldKey('left', keys) || held.left) ? 1 : 0) - ((heldKey('right', keys) || held.right) ? 1 : 0);
      moveShip(player, dt, player.anchor || helmOff ? 0 : player.sail * 4.2 * (player.speedMul || 1) * (ADM.noclip ? 1.6 * ADM.noclipMul : 1), turn); // [admin-menu] NOCLIP: boosted glide // [Raul] ship upgrades: sails
      const cdWas = player.cd.port + player.cd.star; // [Raul] sound upgrades: reload-ready ratchet (GUN CREW)
      for (const sd of ['port', 'star']) { const was = player.cd[sd]; player.cd[sd] = Math.max(0, was - dt); if (was > 0 && player.cd[sd] === 0 && cdWas > 0) sfx.reloadReady(); }
      updatePlayerRepair(dt); // [repair] game time only: pause / shop / tutorial don't count
      if (player.hp < player.maxHp * 0.4 && Math.random() < 0.15) fx.smoke(new THREE.Vector3(player.x + rnd(-2, 2), player.y + 3, player.z + rnd(-3, 3)), player.hp < player.maxHp * 0.25);
      // waves
      if (game.mode !== 'pvp' && !enemies.some(e => e.alive)) { // [pvp] no waves
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
    } else if (game.state === 'playing' || game.state === 'over' || game.mode === 'pvp') {
      player.speed *= 0.98;
    }
    if (game.mode === 'pvp') pvp.update(dt); // [pvp] netcode, host duties, respawn
    dock?.ship(dt); // [Emerly] docking ease / moored pose, SAFE HARBOR, on-foot pirate + prompts
    dockCoverTick(); // [v157] hide the sea spawn until the dock is on (it moors you on that frame)
    floatShip(player, dt);
    setLocalSkin(player.mesh?.userData?.skinId); // [Timothy] your shop clothes follow your ship skin (no-op unless it changed)
    if (game.mode !== 'pvp') shipTick(player.mesh, { speed: player.speed || 0, alive: player.alive, dt, t: game.t }); // [t1716u] Harbor skins (Flaming/Diamond/Ghost/Golden/Kraken/tierLooks)
    for (const e of enemies) updateEnemy(e, dt);
    escorts.update(dt); // [escorts]
    // remove fully sunk ships
    for (let i = enemies.length - 1; i >= 0; i--) if (!enemies[i].alive && enemies[i].sinking > 7 && enemies[i].net?.kind !== 'player') { /* [pvp] other players' ships respawn: keep them */ scene.remove(enemies[i].mesh); disposeShip(enemies[i].mesh); enemies[i].bar.remove(); enemies.splice(i, 1); updateHud(); }
    updateBalls(dt);
    // loot
    for (let i = loot.length - 1; i >= 0; i--) {
      const l = loot[i]; l.life -= dt;
      l.mesh.position.set(l.x, (l.gy != null ? l.gy + 0.35 : waveHeight(l.x, l.z, t) + 0.1) + Math.sin(t * 2 + l.ph) * 0.1, l.z); // [v370] land piles sit on the ground l.mesh.rotation.y += dt * 0.8;
      if (Math.random() < 0.3) fx.sparkle(l.mesh.position);
      if (l.pid) { pvp?.lootStep(l); if (l.life <= 0) { scene.remove(l.mesh); loot.splice(i, 1); pvp?.piles.delete(l.pid); } continue; } // [pvp] gold piles: host decides who gets each
      if ((player.alive && touchesGold(player, l.x, l.z)) || escorts.list.some(e => e.alive && touchesGold(e, l.x, l.z))) { // [big-hitbox] any part of the hull · [escort pickups] escorts fish gold for you
        game.gold += l.value; addScore(l.value); sfx.coin(); popup(l.mesh.position.clone().setY(4), `+${formatGoldAmount(l.value)} GOLD`); scene.remove(l.mesh); loot.splice(i, 1); updateHud(); continue;
      }
      if (l.life <= 0) { scene.remove(l.mesh); loot.splice(i, 1); }
    }
    healthDrops.update(dt, t, player, escorts.list); // [health drops] bob, blink, pickup
    animateShip(player.mesh, t, player.anchor ? 0 : player.sail / 3);
    for (const e of enemies) animateShip(e.mesh, t + 1.3, e.alive ? 0.8 : 0.3);
    crewSteer(player.mesh, player.alive ? player.turn : 0, dt); for (const e of enemies) if (e.alive) crewSteer(e.mesh, e.turn, dt); for (const e of escorts.list) if (e.alive) crewSteer(e.mesh, e.turn, dt); // [v95] wheel + captain
    escorts.animate(t, animateShip); // [escorts]
    fx.update(dt, t);

    // lightning — only while storming (Storm Hunt / tempest); fair Harbor weather stays clear
    if ((game.storm || 0) > 0.4) {
      game.nextLightning -= dt;
      if (game.nextLightning <= 0) { game.flash = 1; game.nextLightning = rnd(6, 16); sfx.thunder(rnd(0.3, 1.5)); sky.uniforms.uBolt.value.copy(bolt.strike(camera.position, Math.atan2(camera.position.x - player.x, camera.position.z - player.z) + Math.PI + rnd(-0.9, 0.9))); }
    } else { game.nextLightning = Math.max(game.nextLightning, 4); bolt.mesh.visible = false; }
  }
  if (game.adminBolt) { game.adminBolt = 0; game.flash = 1; try { sfx.thunder(rnd(0.15, 0.5)); } catch {} const px = player?.x ?? 0, pz = player?.z ?? 0; sky.uniforms.uBolt.value.copy(bolt.strike(camera.position, Math.atan2(camera.position.x - px, camera.position.z - pz) + Math.PI + rnd(-0.9, 0.9))); } // [v346] the owner's ⚡ LIGHTNING (admin menu; synced through the server's '!env')
  game.flash = Math.max(0, game.flash - dt * 2.8);
  const fl = game.flash > 0 ? game.flash * (0.6 + 0.4 * Math.sin(game.flash * 40)) : 0;
  ocean.uniforms.uFlash.value = sky.uniforms.uFlash.value = rain.uniforms.uFlash.value = wakes.uniforms.uFlash.value = fl;
  // [v343] BANKSY t1812u–t1814u: shared-clock sunny day / sunrise / sunset / starry night; storm blends in from wave 6+ (Storm Hunt)
  { // Harbor / title / early waves: storm → 0 (true fair weather). Late Storm Hunt waves raise storm mood.
    const stormForced = isStormForced();
    let target = 0;
    if (stormForced != null) target = stormForced;
    else if (game.state !== 'title' && game.mode !== 'pvp') target = 1; // [v484] BANKSY t2241u: Storm Hunt is always storming (was ramping in from wave 6)
    // PvP Harbor stays fair (wave is pinned ~3 for AI strength only — never drives storm rain)
    game.storm = game.stormOverride ?? (game.storm || 0) + (target - (game.storm || 0)) * (1 - Math.exp(-dt * 0.6));
    const sm = game.storm;
    const skySt = evalSkyNow(sm);
    const dens = skySt.fogDensity * FOG_K;
    moodColor.setRGB(skySt.fogColor.r, skySt.fogColor.g, skySt.fogColor.b);
    if (sm > 0.01) moodColor.lerp(STORM_FOG, sm * 0.85);
    scene.fog.color.copy(moodColor); scene.fog.density = dens;
    // [v344] background tracks zenith (not pale horizon) so any dome edge stays Caribbean blue / night indigo
    scene.background.setRGB(skySt.zenith.r, skySt.zenith.g, skySt.zenith.b);
    if (sm > 0.01) scene.background.lerp(STORM_FOG, sm * 0.9);
    ocean.uniforms.uFogColor.value.copy(moodColor); sky.uniforms.uFogColor.value.copy(moodColor); wakes.uniforms.uFogColor.value.copy(moodColor);
    ocean.uniforms.uFogDensity.value = wakes.uniforms.uFogDensity.value = dens;
    ocean.uniforms.uStorm.value = sky.uniforms.uStorm.value = wakes.uniforms.uStorm.value = sm;
    // rain OFF in fair weather (was always streaking at alpha 0.28 — caused Harbor grey rain)
    rain.uniforms.uAlpha.value = skySt.rainAlpha;
    rain.mesh.visible = skySt.rainAlpha > 0.02;
    // sky dome live state
    sky.uniforms.uSunDir.value.set(skySt.sunDir.x, skySt.sunDir.y, skySt.sunDir.z);
    sky.uniforms.uMoonDir.value.set(skySt.moonDir.x, skySt.moonDir.y, skySt.moonDir.z);
    sky.uniforms.uZenith.value.setRGB(skySt.zenith.r, skySt.zenith.g, skySt.zenith.b);
    sky.uniforms.uMid.value.setRGB(skySt.mid.r, skySt.mid.g, skySt.mid.b);
    sky.uniforms.uHorizon.value.setRGB(skySt.horiz.r, skySt.horiz.g, skySt.horiz.b);
    sky.uniforms.uSunColor.value.setRGB(skySt.sunColor.r, skySt.sunColor.g, skySt.sunColor.b);
    sky.uniforms.uSunVis.value = skySt.sunVis; sky.uniforms.uMoonVis.value = skySt.moonVis; sky.uniforms.uStarVis.value = skySt.starVis;
    sky.uniforms.uCloudWarm.value = skySt.cloudWarm; sky.uniforms.uGolden.value = skySt.goldenW;
    // ocean mirrors sky
    ocean.uniforms.uSun.value.set(skySt.keyDir.x, Math.max(0.05, skySt.keyDir.y), skySt.keyDir.z).normalize();
    ocean.uniforms.uSunColor.value.setRGB(skySt.keyColor.r, skySt.keyColor.g, skySt.keyColor.b);
    ocean.uniforms.uSkyZenith.value.setRGB(skySt.zenith.r, skySt.zenith.g, skySt.zenith.b);
    ocean.uniforms.uSkyHorizon.value.setRGB(skySt.horiz.r, skySt.horiz.g, skySt.horiz.b);
    // scene lights
    sun.color.setRGB(skySt.keyColor.r, skySt.keyColor.g, skySt.keyColor.b);
    sun.intensity = skySt.keyIntensity * (1 - 0.15 * fl) + fl * 1.2;
    hemi.color.setRGB(skySt.hemiSky.r, skySt.hemiSky.g, skySt.hemiSky.b);
    hemi.groundColor.setRGB(skySt.hemiGround.r, skySt.hemiGround.g, skySt.hemiGround.b);
    hemi.intensity = skySt.hemiIntensity + fl * 3;
    renderer.toneMappingExposure = skySt.exposure;
    // keep a unit offset for the shadow light follow (scaled from keyDir)
    SUN_OFF.set(skySt.keyDir.x, Math.max(0.15, skySt.keyDir.y), skySt.keyDir.z).multiplyScalar(90);
    game._sky = skySt; // tests / debug
  }
  // Cabin reuses these same lights; weather must not overwrite its warm fill.
  if (scene.userData._cqOutLights?.length) {
    hemi.color.set(0xffe6ba); hemi.groundColor.set(0x604020); hemi.intensity = 2.0;
    sun.color.set(0xffd28a); sun.intensity = 0.82;
    renderer.toneMappingExposure = 1.2;
  }
  bolt.mesh.visible = game.flash > 0.3; bolt.mesh.material.opacity = clamp(fl * 1.6, 0, 1);
  wind.uTime.value = t; chestTime(t);
  // hull foam collars for the water shader (nearest ships first)
  { const H = ocean.uniforms.uHulls.value; let k = 0;
    const ships = escorts.list.length ? [...escorts.list, ...enemies] : enemies; // [escorts] foam collars + wakes too
    const list = ships.length < MAX_HULLS ? ships : ships.slice().sort((a, b) => ((a.x - player.x) ** 2 + (a.z - player.z) ** 2) - ((b.x - player.x) ** 2 + (b.z - player.z) ** 2)); // [late waves] up to 15+ ships: foam for the nearest
    const ch = dock?.canoeHull?.(); // [v314] the canoe's own water cap: always right after the player (its slot is reserved)
    _hullList.length = 0; _hullList.push(player); for (const s of list) _hullList.push(s); // [v330 perf] one reused array, not a fresh spread every frame
    for (const s of _hullList) { if (k >= MAX_HULLS - (ch && k > 0 ? 1 : 0)) break; if (s.sinking > 3) continue; ocean.uniforms.uHullV.value[k] = s.speed; hullCap(s, ocean.uniforms.uHullY.value[k]); H[k++].set(s.x, s.z, s.yaw, s.mesh.userData.len);
      if (ch && s === player && k < MAX_HULLS) { ocean.uniforms.uHullV.value[k] = ch.speed; ocean.uniforms.uHullY.value[k].set(ch.capY, ch.slopeZ, ch.slopeX, ch.halfBeam); H[k++].set(ch.x, ch.z, ch.yaw, ch.len); } }
    ocean.uniforms.uHullCount.value = k;
    wakes.update(player, list, t); } // [aaa water] wake trails: player first, then the nearest ships

  // ocean follows the player, snapped to the grid so waves don't swim
  const step = ocean.mesh.userData.step;
  const oc = dock?.focus() || player; // [Emerly] on foot the sea follows the camera (you can walk a long way inland)
  ocean.mesh.position.set(Math.round(oc.x / step) * step, 0, Math.round(oc.z / step) * step);
  ocean.uniforms.uTime.value = sky.uniforms.uTime.value = rain.uniforms.uTime.value = t;

  // camera follows the ship, orbit offset preserved
  if (!dock?.camera(dt)) { // [Emerly] on foot: the third-person pirate camera (js/onfoot/walker.js) instead
  const ud0 = player.mesh.userData, shipK = camScale(ud0); // [Raul] upgrade visuals: bigger hulls / taller rigs pull the camera back to stay framed
  const tgt = _camTgt.set(player.x, player.y + 4 * shipK + 2.2 * ((ud0.frameK || 1) - 1), player.z); // [v330 perf] reused vectors (no per-frame garbage)
  camera.position.add(_camD.copy(tgt).sub(lastTarget)); lastTarget.copy(tgt);
  if (Math.abs(shipK - camShipK) > 1e-4) { const f = shipK / camShipK; camera.position.sub(tgt).multiplyScalar(f).add(tgt); controls.maxDistance = (camera.aspect < 1 ? 120 : 95) * Math.max(1, shipK); camShipK = shipK; }
  controls.target.copy(tgt);
  if (game.state === 'title') { const off = _camD.copy(camera.position).sub(tgt).applyAxisAngle(_UP, dt * 0.06); camera.position.copy(tgt).add(off); }
  controls.update();

  { const low = game.state === 'title' && PHONE_MQ.matches; // [mobile title] phones: frame the ship lower on screen, under the logo
    if (low !== camLow) { camLow = low; applyCamLow(); } }
  const minY = waveHeight(camera.position.x, camera.position.z, t) + 2.5;
  if (camera.position.y < minY) camera.position.y = minY;
  if (game.shake > 0) { camera.position.x += rnd(-1, 1) * game.shake * 0.4; camera.position.y += rnd(-1, 1) * game.shake * 0.4; game.shake = Math.max(0, game.shake - dt * 2.5); }
  } // [Emerly]
  sky.mesh.position.copy(camera.position);
  harborIslandTick(t);
  islands.update(t, camera.position, game.storm || 0);
  if (HIGH) { sun.target.position.set(oc.x, 0, oc.z); sun.position.copy(sun.target.position).add(SUN_OFF); } // [Emerly] oc = ship, or the walker on foot
  rain.uniforms.uCam.value.copy(camera.position);

  if (game.state !== 'title') { updateBars(); updateEscortBars(); drawRadar(); updateFireButtons(); emoteTick(); }
  updateAmbient({ speed: player.speed, sail: player.anchor ? 0 : player.sail, playing: game.state === 'playing' && player.alive, hpFrac: player.hp / player.maxHp, roll: player.roll || 0, dt }); // [Raul] sound upgrades: sea / wind / creaks / low-hp
  { const cm = player.mesh.userData.captainMesh; if (cm) cm.visible = !dock?.onFoot && !dock?.canoeing && !dock?.inHull; } // [Emerly sail-around]/[v333] hide captain while paddling / in hull
  { crewGearT -= dt; if (crewGearT <= 0) { crewGearT = 0.5; syncCrewGear(player.mesh, crewGear(), localGearColors(), getLocalGear()); } } // [Timothy] the crew's OWN loadout (Crew Shop), not your clothes (was getLocalGear(), v106); colours = your ship skin; [Raul shop2 fixes] + your beard / earrings / teeth / boots / cape
  tickPirates(dt, camera); // [v100] v4 pirate clips (captain steer, on-foot idle / walk / run)
  if (isMobile || quality === 'low') fogCull(); // [mobile-perf-2]
  if (!glLost) {
    if (composer) { composer.readBuffer = composer.renderTarget2; composer.writeBuffer = composer.renderTarget1; composer.render(); } else renderer.render(scene, camera);
    graphicsLastFrame = performance.now(); graphicsFrameSeen = true;
    const state = dock?.inHull ? 'hull' : dock?.onFoot ? 'ashore' : 'ship';
    if (state !== graphicsState) { graphicsState = state; graphicsSample(state); }
  } // [v339] no draws while the GPU context is lost
  harborResumeTick();
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
  const [vw, vh] = viewSize(); // [v153] near-square phone screens (iPhone Duo inner + outer ~1.42) play fine upright: no rotate prompt (iPads keep it: short side >= 700)
  const show = isPortrait() && !(vh / vw < 1.5 && vw < 700) && game.state === 'playing' && !rotateDismissed && isMobile;
  $('rotate').classList.toggle('show', show);
  if (show && !rotateTimer) rotateTimer = setTimeout(() => { $('rotate').classList.remove('show'); rotateDismissed = true; }, 9000);
}
$('rotate-x').addEventListener('pointerdown', (e) => { e.stopPropagation(); rotateDismissed = true; localStorage.setItem('pfp_rotate_dismissed', '1'); $('rotate').classList.remove('show'); });
// [v79] phones on the title: frame the ship lower via a view offset. setViewOffset(fullW, fullH, ...) also sets
// camera.aspect = fullW / fullH, so it MUST use the real viewport size (the old (1, 1, ...) forced aspect 1 = everything
// stretched tall and narrow in portrait, on every quality). Re-applied on every resize; aspect always = CSS aspect.
let camLowOff = 0;
function applyCamLow() {
  const [w, h] = viewSize();
  camLowOff = camLow ? (PHONE_MQ_LAND.matches ? -0.18 : -0.26) : 0;
  if (camLow) camera.setViewOffset(w, h, 0, camLowOff * h, w, h); else camera.clearViewOffset();
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
function onResize() {
  const [w, h] = viewSize();
  const root = document.documentElement.style;
  root.setProperty('--app-w', `${w}px`); root.setProperty('--app-h', `${h}px`);
  fitCamera(w, h); if (camLow) applyCamLow();
  // Re-cap on resize too (Windows scaling, fullscreen and 4K displays).
  const capped = renderPixelRatio(w, h, Math.min(renderer.getPixelRatio(), PR_WANTED), ULTRA);
  if (capped !== renderer.getPixelRatio()) renderer.setPixelRatio(capped);
  renderer.setSize(w, h);
  if (composer) {
    const pr = renderer.getPixelRatio();
    composer.setPixelRatio(pr); composer.setSize(w, h);
    composer.userData.fxaa?.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
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
initHomeBoard(); // [pvp]
addEventListener('pfp-renamed', () => { if (!$('title').classList.contains('hidden')) renderBoard($('board-title')); }); // [v74] Waves board too
document.documentElement.classList.add('pfp-booted'); // [v167] BANKSY: "on refresh it shows the OLD home screen then the NEW one": index.html ships the old home markup and the code above reshapes it (ENTER GAME, no STORM HUNT, portal / account bits) after the GLB awaits; css/style.css keeps #title's panel hidden until here
$('loading').classList.add('hidden'); try { sessionStorage.removeItem('pfp_boot_retry'); } catch {}
setTimeout(() => harborResumeBoot(), 0); // [v339] a phone reload / OS tab eviction inside the Harbor drops you straight back in (no title, no name card)
// [perf2] BANKSY "fast to load": while the title screen is up, warm the harbor's code (fetch / parse only, nothing runs) so tapping in
// doesn't wait on the network. ?prefetch=0 = off.
// [v330 perf] BANKSY "Optimized load time ... first": the WHOLE harbor module graph (js/preloadList.js, generated from the real imports: was 7
// entry files whose ~85 dependencies still waterfalled 5 hops deep on SET SAIL), then the harbor's first-build art for THIS device's tier
// (town / nature kits, storefronts, docks, battery, material library) one file at a time at low priority while the title is still up.
// Art is skipped on Save-Data / 2G-3G connections and stops the moment you leave the title (the loaders fetch whatever is left).
if (DOCK_ON && !/[?&]prefetch=0/.test(location.search)) setTimeout(() => (window.requestIdleCallback || ((f) => setTimeout(f, 1)))(() => {
  const net = navigator.connection || {}, slow = net.saveData || /(^|-)2g$|^3g$/.test(net.effectiveType || '');
  if (slow || document.hidden) return;
  const head = document.head, have = new Set([...document.querySelectorAll('link[rel="modulepreload"]')].map(l => l.href));
  // [v339 mobile-stability] phones: the ~140 modulepreloads go in batches of 12 per idle slice (one burst spiked fetch + compile memory on iOS)
  const todo = []; for (const m of HARBOR_MODULES) { const href = new URL('../' + m, import.meta.url).href; if (!have.has(href)) todo.push(href); }
  const addPre = (href) => { const l = document.createElement('link'); l.rel = 'modulepreload'; l.fetchPriority = 'low'; l.href = href; head.appendChild(l); };
  const step = () => { if (game.state !== 'title' || dock || dockLoading || document.hidden) return; todo.splice(0, 12).forEach(addPre); if (todo.length) (window.requestIdleCallback || ((f) => setTimeout(f, 60)))(step, { timeout: 1500 }); }; step();
  if (slow || /[?&]warmart=0/.test(location.search)) return;
  const lo = quality === 'low' || isMobile, sfx2 = lo ? '_low' : '';
  const art = [`assets/island/town_kit${sfx2}.glb`, `assets/island/nature_kit${sfx2}.glb`, `assets/island/tex/lib${lo ? '_lo' : ''}.ktx2`, `assets/island/docks${sfx2}.glb`, `assets/island/battery${sfx2}.glb`, `assets/island/plaza_shops${sfx2}.glb`];
  (async () => { for (const u of art) { if (game.state !== 'title' || dock || dockLoading) return;
    try { const r = await fetch(u, { priority: 'low', credentials: 'same-origin' }); if (r.ok) await r.arrayBuffer(); } catch {} } })();
}, { timeout: 4000 }), 1500);
requestAnimationFrame(frame);

// PWA: offline cache
// (skipped on portal CDNs: itch.io's html*.itch.zone (folder URLs 403, itch serves its own copy) and Newgrounds'
// uploads.ungrounded.net (one origin shared by every NG game), so no offline cache inside those iframes)
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !/(^|\.)(itch\.zone|ungrounded\.net|crazygames\.com)$/.test(location.hostname)) {
  // [v276 load-perf] BANKSY 12:01 PM "took forever to open": the worker's install (~4.4 MB shell) + art fill used to start mid-boot and fight the
  // game's own downloads; register only after the page has loaded and gone idle. &loadperf=0 = the old register-at-boot (and the old sw timing).
  const LP = !/[?&]loadperf=0(&|$)/.test(location.search), swUrl = (isMobile ? './sw.js?m=1' : './sw.js') + (LP ? '' : (isMobile ? '&' : '?') + 'lp=0');
  const swReg = () => navigator.serviceWorker.register(swUrl) /* [mobile-perf] ?m=1: the sw precaches only the light art */
    .then(r => { console.log('[pwa] service worker ready, scope', r.scope); try { r.update(); } catch {} /* [v328] pick up pfp-v328+ on refresh, no stale HUD/radar */ return r; })
    .catch(e => console.warn('[pwa] sw failed', e));
  if (!LP || navigator.serviceWorker.controller) swReg(); // returning visitors: the update check is cheap and keeps phones current
  else { const later = () => setTimeout(() => (window.requestIdleCallback || ((f) => setTimeout(f, 1)))(swReg, { timeout: 8000 }), 6000); if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true }); }
}

// [Raul] ship upgrades: SHOP button (top HUD row) + shipwright overlay
initShop({ game, escorts, getPlayer: () => player, updateHud, sfx, camera, rebuildShip: rebuildPlayerShip, prebuildShips, previewBase: { mainSailMap: sailTex, flagMap: flagTex, quality } }); // [Raul] skin previews: classic sail/flag + quality // [Raul] upgrade visuals: camera + ship rebuild

// Debug / test hooks (harmless; the leaderboard can't trust the client anyway, see README)
initTutorial({ game }); // [tutorial] after initShop so the shop '?' button can be added
devHook('PFP_HEALTH', healthDrops); // [health drops] test hook
// [v96] quick-chat wheel: T / the 💬 button; arena callouts go over the realtime room (js/pvp.js), Waves + harbor stay local
initEmotes({ camera, getPlayer: () => player, canEmote: () => game.state === 'playing' && !document.documentElement.classList.contains('pvp-spec'),
  send: (e) => { if (game.mode === 'pvp') pvp?.emote?.(e); }, foot: (e) => dock?.footEmote?.(e) || null }); // [Raul emotes] on land: body motion + bubble over the head
// [pvp] what js/pvp.js may touch in the game
const pvpCtx = { skullImg, scene, game, enemies, balls, loot, fx, sfx, get dock() { return dock; }, getPlayer: () => player, spawnEnemy, refitGuns, damage, floatShip, moveShip, getBall, freeBall, disposeShip, toLocal, popup, banner, updateHud,
  resetCamera, camera, controls, islands, joinBattle: () => { toTitle(); startPvp(); }, toTitle: () => toTitle(), rebuildShip: (lv) => rebuildPlayerShip(lv), rebuildShipSkin: (lv) => rebuildPlayerShipSkin(lv), prebuildSkin: (lv, skin) => prebuildSkin(lv, { ...shipOpts(), skin }, skin), warmShip: (o) => (typeof renderer.compileAsync === 'function' ? renderer.compileAsync(o, camera, scene).catch(() => {}) : Promise.resolve()), get shipOpts() { return PLAYER_SHIP; } };
// [ultra] graphics menu (start page + pause): AUTO / LOW / HIGH / ULTRA (desktop only), saved on this device; a reload applies it
{
  const cur = ['low', 'high', 'ultra'].includes(gfxSaved) ? gfxSaved : 'auto';
  const opts = [['auto', 'AUTO'], ['low', 'LOW'], ['high', 'HIGH'], ...(isMobile ? [] : [['ultra', 'ULTRA']])];
  for (const box of [$('gfx-title'), $('gfx-pause')]) {
    if (!box) continue;
    box.innerHTML = `<span class="label">GRAPHICS</span><span class="gfx-seg" role="radiogroup" aria-label="Graphics quality"></span><small class="gfx-note muted"></small>`;
    const seg = box.querySelector('.gfx-seg'), note = box.querySelector('.gfx-note');
    for (const [id, label] of opts) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.q = id; b.setAttribute('role', 'radio');
      b.title = id === 'ultra' ? 'ULTRA: for strong desktop GPUs (bloom, MSAA + SMAA, 4K shadows, sharper water, more particles)' : id === 'auto' ? `AUTO (now ${autoQ.toUpperCase()})` : id.toUpperCase();
      b.classList.toggle('on', id === cur); b.setAttribute('aria-checked', id === cur);
      b.onclick = () => {
        try { id === 'auto' ? localStorage.removeItem(GFX_KEY) : localStorage.setItem(GFX_KEY, id); } catch {}
        box.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
        if (game.state === 'title') { note.textContent = 'applying…'; setTimeout(() => location.reload(), 150); }
        else { note.innerHTML = 'applies after a reload <button type="button" class="gfx-reload">RELOAD NOW</button>'; note.querySelector('.gfx-reload').onclick = () => location.reload(); }
      };
      seg.appendChild(b);
    }
    if (qp) note.textContent = `?quality=${qp} in the link overrides this`;
  }
  // [v153] BANKSY: MINIMAP STYLE in settings: COLORED (default) or PAPER (the MAPS parchment look), saved on this device, applies at once
  { const box = $('map-style-pause'); if (box) { const cur = getMapStyle();
    box.innerHTML = '<span class="label">MINIMAP</span><span class="gfx-seg" role="radiogroup" aria-label="Minimap style"></span>';
    const seg = box.querySelector('.gfx-seg');
    for (const [id, { label }] of Object.entries(THEMES)) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.ms = id; b.setAttribute('role', 'radio');
      b.classList.toggle('on', id === cur); b.setAttribute('aria-checked', id === cur);
      b.onclick = () => { setMapStyle(id); seg.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); };
      seg.appendChild(b); } } }
  try { wireHudHide({ isSpectating: () => !!pvp?.spectating, isTyping: () => document.documentElement.classList.contains('pfp-chat-open') }); } catch (e) { console.warn('[hud]', e); } // [gold-hud]
  // suggest ULTRA (never auto-pick it): desktop + high-end GPU string + a smooth HIGH title screen
  if (!isMobile && quality === 'high' && !ULTRA && !qp && !localStorage.getItem('pfp_gfx_hint')) setTimeout(() => {
    let gpu = ''; try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch {}
    const strong = /RTX\s?[2-9]0|RTX\s?A\d|RX\s?[67]\d{3}|RX\s?9\d{3}|Radeon Pro W|Apple M[1-9] (Pro|Max|Ultra)|Arc A7/i.test(gpu);
    const t0 = performance.now(); let n = 0;
    const probe = () => { n++; if (performance.now() - t0 < 2000) return requestAnimationFrame(probe);
      const ms = (performance.now() - t0) / n;
      if (strong && ms < 11 && game.state === 'title') { const note = $('gfx-title')?.querySelector('.gfx-note'); if (note) note.textContent = 'Your GPU can run ULTRA. Tap it to try.'; try { localStorage.setItem('pfp_gfx_hint', '1'); } catch {} } };
    requestAnimationFrame(probe);
  }, 6000);
}
try { initHarborCard(); } catch (e) { console.warn('[harbor card]', e); }
// [security L] the full debug object only on a local dev server; the live game exposes a tiny facade (what uiProfile.js / portal.js / pvp.js read)
const pfpFacade = () => Object.freeze({ get dock() { return dock; }, get pvp() { return pvp ? pvp.publicApi || null : null; },
  game: Object.freeze({ get mode() { return game.mode; }, get state() { return game.state; }, set state(v) { if (v === 'playing' && game.state === 'paused') game.state = v; }, get wallet() { return game.wallet; }, set wallet(v) { if (typeof v === 'string' && v.length <= 44) game.wallet = v; } }) });
window.PFP = DEV ? { get dock() { return dock; }, islands, harborIsle, ULTRA, GFX_KEY, get pvp() { return pvp; }, game, get player() { return player; }, enemies, balls, loot, spawnEnemy, escorts, fire: playerFire, damage, startGame, gameOver, toTitle: () => toTitle(), quality, camera, controls, renderer, scene, wakes, ocean, sky, rain, rebuildShip: (lv) => rebuildPlayerShip(lv),
  skyCycle, setSkyPhase, clearSkyPhase, get skyPhase() { return skyPhase(); }, get skyName() { return phaseName(skyPhase()); } } : pfpFacade(); // [v112] + rebuildShip // [v343] + sky day/night API
// [v343] always expose a tiny sky override for Playwright / ?sky= (safe; no gameplay secrets)
window.__pfpSky = Object.freeze({ setPhase: setSkyPhase, clearPhase: clearSkyPhase, phase: () => skyPhase(), name: () => phaseName(skyPhase()), eval: (st) => evalSkyNow(st ?? (game.storm || 0)), cycle: skyCycle });
// [admin-menu] the owner Admin Menu (⚙ SETTINGS > 👑 ADMIN MENU, F8). Every player loads the tiny client half (server FREEZE / pocket refresh pokes);
// the panel itself only mounts when the SERVER says owner (admin_status). &admin=0 = off.
if (!/[?&]admin=0(&|$)/.test(location.search)) import('./adminMenu.js').then(m => m.initAdminMenu({ dock: () => dock, pvp: () => pvp, player: () => player, game, scene, camera, canvas: renderer.domElement })).catch(e => console.warn('[admin-menu]', e));

// ---------- [v339 mobile-stability] Harbor session auto-resume ----------
// BANKSY t1792u: iOS / Android reload a tab after a memory kill or a long trip to another app, and a WebGL loss used to reload too. sessionStorage
// survives exactly those reloads (one tab, same session) and is EMPTY on a fresh visit / new tab / every automated page.goto(), so this only ever
// brings back the tab that was already in the Harbor. Saved every ~2 s and on pagehide / hidden while you're in the Harbor; cleared by MAIN MENU,
// Storm Hunt, the arena / spectating, and logging out. ?noresume=1 = off.
var RESUME_KEY = 'pfp_harbor_resume_v1', RESUME_MAX_MS = 15 * 60 * 1000, RESUME_ON = !/[?&]noresume=1(?:&|$)/.test(location.search);
var resumeBusy = false, resumeT = 0, resumeOff = false; // var: hoisted (toTitle / the frame loop may touch these before this line runs)
function harborResumeClear() { try { sessionStorage.removeItem(RESUME_KEY); } catch {} }
function harborResumeRead() { try { const r = JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null'); return r && r.v === 1 && Date.now() - (r.ts || 0) < RESUME_MAX_MS ? r : null; } catch { return null; } }
function harborResumeSnap() {
  if (!RESUME_ON || !DOCK_ON || resumeBusy || game.mode !== 'pvp' || !pvp || !dock?.on) return null;
  if (pvp.where !== 'harbor' || pvp.spectating || !['playing', 'paused', 'shop'].includes(game.state)) return null;
  const inf = pvp.harborInfo?.() || {}, W = dock.walker?.w, onFoot = !!dock.onFoot && !dock.inHull && !dock.canoeing;
  const s = player;
  return { v: 1, ts: Date.now(), prefix: inf.prefix || '', copy: inf.copy | 0, code: inf.code || '', pirateName: (pvp.name || '').slice(0, 24), onFoot, inHull: !!dock.inHull,
    moored: dock.docking?.mode === 'docked', x: +(onFoot ? W?.x : s?.x) || 0, z: +(onFoot ? W?.z : s?.z) || 0, yaw: +(onFoot ? W?.yaw : s?.yaw) || 0 };
}
function harborResumeSave(force = false) {
  if (resumeBusy || resumeOff) return;
  try { if (sessionStorage.getItem('pfp_acct_bye')) { resumeOff = true; harborResumeClear(); return; } } catch {} // LOG OUT reload: start fresh
  const r = harborResumeSnap();
  if (r) { try { sessionStorage.setItem(RESUME_KEY, JSON.stringify(r)); } catch {} return; }
  // left the Harbor for the arena / spectate / Storm Hunt / title: forget it (but never while a boot-time resume is still running)
  if (!force && game.state !== 'title' && pvp && (pvp.where !== 'harbor' || pvp.spectating)) harborResumeClear();
}
function harborResumeTick() { const now = performance.now(); if (now - resumeT < 2000) return; resumeT = now; harborResumeSave(); }
addEventListener('pagehide', () => harborResumeSave(true));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') harborResumeSave(true); });
addEventListener('pfp-acct', (e) => { if (e.detail?.out) { resumeOff = true; harborResumeClear(); } }, true);
async function harborResumeBoot() {
  const r = RESUME_ON && PVP_ENABLED && DOCK_ON ? harborResumeRead() : null;
  if (!r) { harborResumeClear(); return; }
  resumeBusy = true; window.__pfpResume = { state: 'start', r };
  const wait = async (f, ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { try { if (f()) return true; } catch {} await new Promise(q => setTimeout(q, 120)); } return false; };
  try {
    await startPvp();
    if (!await wait(() => dock?.on, 90000)) throw new Error('harbor did not load');
    const go = $('pvp-entry-go'); if (go && !$('pvp-entry')?.classList.contains('hidden')) go.click(); // the name card: same name as before the reload
    await wait(() => $('pvp-entry')?.classList.contains('hidden'), 4000); $('pvp-entry')?.classList.add('hidden');
    try { const p = pvp.resumeServer?.(r); if (p?.then) await p; } catch (e) { console.warn('[resume] server', e); }
    await wait(() => dock.docking?.mode === 'docked', 6000);
    // [v347] t1826u: same Harbor server, but ALWAYS back aboard your ship at its berth (never the stuck spot ashore / in the hull)
    dock.applyResume?.(r); await wait(() => !dock.onFoot && !dock.inHull && dock.docking?.mode === 'docked', 4000);
    window.__pfpResume = { state: 'done', r, onFoot: !!dock.onFoot, inHull: !!dock.inHull };
    console.info('[resume] back in the harbor', r);
  } catch (e) { console.warn('[resume] failed', e); window.__pfpResume = { state: 'failed', r, err: String(e) }; harborResumeClear(); }
  finally { resumeBusy = false; }
}
