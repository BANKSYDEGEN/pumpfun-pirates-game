// [v333] BANKSY t1765u–t1769u: walk-in Ship Captain's Quarters (treat like a house).
// Modular: room + enter/leave live here; storage reuses houses.js with cottage_id = 'ship_quarters'.
// Optional art: assets/island/captains_quarters.glb (Post) loads when present; crafted fallback always ships.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { toon } from '../toon.js';

export const SHIP_QUARTERS_ID = 'ship_quarters';
export const SHIP_QUARTERS_SLOTS = 12;
export const HULL_COMBAT_LOCK_S = 8;
export const HULL_QA = typeof location !== 'undefined' && /[?&]hullqa=1(?:&|$)/.test(location.search || '');

const GLB_URL = 'assets/island/captains_quarters.glb';
let _glbPromise = null;
function loadQuartersGlb() {
  if (_glbPromise) return _glbPromise;
  _glbPromise = new Promise((resolve) => {
    try {
      const ld = new GLTFLoader();
      try { ld.setMeshoptDecoder(MeshoptDecoder); } catch {}
      ld.load(GLB_URL, (gl) => resolve(gl?.scene || null), undefined, () => resolve(null));
    } catch { resolve(null); }
  });
  return _glbPromise;
}

/** Crafted wood-ribbed stern Captain's Quarters (complete out of the box). */
export function buildCaptainsQuartersRoom({ low = false } = {}) {
  const g = new THREE.Group(); g.name = 'captains_quarters';
  const W = 11, D = 9.2, H = 3.55;
  const wood = toon(0x8b5a2b, null, { key: 'cq-wood' });
  const woodD = toon(0x4a2e18, null, { key: 'cq-woodd' });
  const teak = toon(0xa8723a, null, { key: 'cq-teak' });
  const oak = toon(0xc49a68, null, { key: 'cq-oak' });
  const brass = toon(0xc89b54, null, { key: 'cq-brass' });
  const iron = toon(0x2b2f36, null, { key: 'cq-iron' });
  const glow = toon(0xffcf66, null, { key: 'cq-glow', emissive: 0xffcf66, emissiveIntensity: 0.85 });
  const glass = toon(0x7ec8e8, null, { key: 'cq-glass', transparent: true, opacity: 0.35 });
  const oceanGlow = toon(0x1a4a6e, null, { key: 'cq-ocean', emissive: 0x0a3050, emissiveIntensity: 0.55 });
  const rug = toon(0x6b1e1e, null, { key: 'cq-rug' });
  const chart = toon(0xe8d4a8, null, { key: 'cq-chart' });
  const linen = toon(0xd9c4a0, null, { key: 'cq-linen' });
  const blanket = toon(0x1a2e4a, null, { key: 'cq-blanket' });

  const add = (geo, mat, x, y, z, ry = 0, rx = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.order = 'YXZ'; m.rotation.y = ry; m.rotation.x = rx;
    m.scale.set(sx, sy, sz); m.castShadow = m.receiveShadow = false; g.add(m); return m;
  };

  // Ambient cabin light
  const hemi = new THREE.HemisphereLight(0xffe6ba, 0x1a1008, 0.7); hemi.name = 'cq_hemi'; g.add(hemi);
  const dir = new THREE.DirectionalLight(0xffd28a, 0.45); dir.position.set(1.5, 4.5, 2); dir.name = 'cq_dir'; g.add(dir);
  const sternFill = new THREE.PointLight(0x9ad0ff, 1.1, 14, 1.6); sternFill.position.set(0, 2.2, -D / 2 + 0.8); sternFill.name = 'cq_stern'; g.add(sternFill);
  const chLight = new THREE.PointLight(0xffc978, low ? 2.2 : 3.6, 12, 1.4); chLight.position.set(0, H - 0.55, 0.2); chLight.name = 'cq_ch'; g.add(chLight);
  const sconceL = new THREE.PointLight(0xffb060, 1.4, 6, 1.8); sconceL.position.set(-W / 2 + 0.7, 2.0, 1.2); sconceL.name = 'cq_sconce_l'; g.add(sconceL);
  const sconceR = new THREE.PointLight(0xffb060, 1.4, 6, 1.8); sconceR.position.set(W / 2 - 0.7, 2.0, 1.2); sconceR.name = 'cq_sconce_r'; g.add(sconceR);

  // Cambered teak deck planks
  add(new THREE.BoxGeometry(W, 0.22, D), teak, 0, 0, 0);
  for (let i = -4; i <= 4; i++) add(new THREE.BoxGeometry(0.06, 0.02, D - 0.4), woodD, i * 1.05, 0.12, 0);

  // Curved hull ribs (port / starboard)
  const ribN = low ? 5 : 8;
  for (let i = 0; i < ribN; i++) {
    const t = i / (ribN - 1), z = -D / 2 + 0.55 + t * (D - 1.1);
    const flare = 0.15 + Math.sin(t * Math.PI) * 0.25;
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.18, H - 0.3, 0.22), woodD, s * (W / 2 - 0.25 - flare * 0.3), H / 2, z, 0, s * 0.08);
    }
  }
  // Overhead deck beams
  for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(W - 0.6, 0.22, 0.28), woodD, 0, H - 0.15, i * 1.15);
  // Ceiling planks
  add(new THREE.BoxGeometry(W - 0.4, 0.1, D - 0.4), wood, 0, H, 0);

  // Bulkheads (bow / sides) with hollow wall thickness
  add(new THREE.BoxGeometry(W, H, 0.28), wood, 0, H / 2, D / 2 - 0.14); // companionway bulkhead (bow)
  add(new THREE.BoxGeometry(0.28, H, D), wood, -W / 2 + 0.14, H / 2, 0);
  add(new THREE.BoxGeometry(0.28, H, D), wood, W / 2 - 0.14, H / 2, 0);

  // Slanted mullioned stern gallery windows looking out at glowing ocean
  const sternZ = -D / 2 + 0.2;
  add(new THREE.BoxGeometry(W - 0.8, H - 0.5, 0.12), woodD, 0, H / 2, sternZ - 0.05);
  add(new THREE.PlaneGeometry(W - 1.4, H - 1.1), oceanGlow, 0, H / 2 + 0.05, sternZ - 0.12);
  // Mullions + glass panes
  for (let c = -2; c <= 2; c++) {
    add(new THREE.BoxGeometry(0.08, H - 1.2, 0.1), brass, c * 1.55, H / 2 + 0.1, sternZ);
    add(new THREE.PlaneGeometry(1.35, H - 1.35), glass, c * 1.55, H / 2 + 0.1, sternZ + 0.02);
  }
  for (let r = 0; r < 3; r++) add(new THREE.BoxGeometry(W - 1.5, 0.07, 0.1), brass, 0, 1.0 + r * 0.85, sternZ);

  // Cabin rug
  add(new THREE.BoxGeometry(4.2, 0.04, 3.0), rug, 0, 0.14, 0.4);

  // Mahogany chart table + map / compass / candles
  add(new THREE.BoxGeometry(2.6, 0.12, 1.4), woodD, -2.2, 1.05, -0.3);
  add(new THREE.BoxGeometry(0.14, 1.0, 0.14), woodD, -3.2, 0.5, -0.8);
  add(new THREE.BoxGeometry(0.14, 1.0, 0.14), woodD, -1.2, 0.5, -0.8);
  add(new THREE.BoxGeometry(0.14, 1.0, 0.14), woodD, -3.2, 0.5, 0.2);
  add(new THREE.BoxGeometry(0.14, 1.0, 0.14), woodD, -1.2, 0.5, 0.2);
  add(new THREE.BoxGeometry(2.2, 0.02, 1.1), chart, -2.2, 1.13, -0.3);
  add(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16), brass, -1.5, 1.18, 0.05); // compass
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 8), linen, -2.8, 1.22, -0.7); // candle
  add(new THREE.SphereGeometry(0.06, 8, 8), glow, -2.8, 1.36, -0.7);
  const candleLit = new THREE.PointLight(0xffaa55, 0.9, 4, 2); candleLit.position.set(-2.8, 1.4, -0.7); g.add(candleLit);

  // Captain's berth / bunk (port side)
  add(new THREE.BoxGeometry(2.4, 0.45, 1.35), woodD, 2.6, 0.45, -1.6);
  add(new THREE.BoxGeometry(2.2, 0.12, 1.2), linen, 2.6, 0.72, -1.6);
  add(new THREE.BoxGeometry(2.0, 0.18, 1.05), blanket, 2.6, 0.85, -1.55);
  add(new THREE.BoxGeometry(0.55, 0.2, 0.7), linen, 3.3, 0.9, -1.6); // pillow

  // Brass ship's-wheel chandelier (real housing, not a naked sphere)
  add(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 8), iron, 0, H - 0.4, 0.2);
  add(new THREE.TorusGeometry(0.55, 0.05, 8, 20), brass, 0, H - 0.75, 0.2, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(new THREE.BoxGeometry(0.06, 0.06, 0.5), brass, Math.cos(a) * 0.28, H - 0.75, 0.2 + Math.sin(a) * 0.28, a);
    add(new THREE.SphereGeometry(0.07, 8, 8), glow, Math.cos(a) * 0.55, H - 0.75, 0.2 + Math.sin(a) * 0.55);
  }

  // Lantern sconces (housing + warm glow)
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.22, 0.35, 0.18), iron, sx * (W / 2 - 0.45), 2.0, 1.2);
    add(new THREE.SphereGeometry(0.1, 8, 8), glow, sx * (W / 2 - 0.45), 2.0, 1.28);
    add(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 6), brass, sx * (W / 2 - 0.45), 2.25, 1.2);
  }

  // Coopered rum barrels
  for (const [bx, bz] of [[-3.6, 2.4], [-2.7, 2.55]]) {
    add(new THREE.CylinderGeometry(0.42, 0.45, 0.85, 12), woodD, bx, 0.5, bz, 0, Math.PI / 2);
    add(new THREE.TorusGeometry(0.44, 0.04, 6, 16), iron, bx, 0.5, bz, 0, Math.PI / 2);
  }

  // Cutlass rack
  add(new THREE.BoxGeometry(0.12, 1.6, 0.5), woodD, W / 2 - 0.55, 1.2, 2.0);
  for (let i = 0; i < 3; i++) {
    add(new THREE.BoxGeometry(0.06, 0.08, 0.85), iron, W / 2 - 0.7, 0.7 + i * 0.4, 2.0, 0.2);
    add(new THREE.BoxGeometry(0.12, 0.08, 0.18), brass, W / 2 - 0.7, 0.7 + i * 0.4, 2.35);
  }

  // Captain's Storage Chest (interact target)
  const chest = new THREE.Group(); chest.name = 'cq_chest';
  const cBody = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.7, 0.85), woodD); cBody.position.y = 0.4; chest.add(cBody);
  const cLid = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.9), teak); cLid.position.set(0, 0.8, 0); chest.add(cLid);
  const cBand = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 0.92), brass); cBand.position.y = 0.55; chest.add(cBand);
  const cLock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.1), brass); cLock.position.set(0, 0.55, 0.45); chest.add(cLock);
  chest.position.set(-2.4, 0, 2.35); g.add(chest);

  // Companionway hatch / door (LEAVE HULL)
  const door = new THREE.Group(); door.name = 'cq_hatch';
  const dFrame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.35, 0.16), woodD); dFrame.position.y = 1.2; door.add(dFrame);
  const dPanel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.0, 0.1), teak); dPanel.position.set(0, 1.15, 0.05); door.add(dPanel);
  const dKnob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), brass); dKnob.position.set(0.4, 1.1, 0.14); door.add(dKnob);
  door.position.set(0, 0, D / 2 - 0.35); g.add(door);

  // Furniture / wall colliders (hollow — walkable cabin)
  const colliders = [
    { x: -2.2, z: -0.3, w: 2.8, d: 1.6 }, // chart table
    { x: 2.6, z: -1.6, w: 2.6, d: 1.55 }, // bunk
    { x: -2.4, z: 2.35, w: 1.5, d: 1.1 }, // chest
    { x: -3.2, z: 2.5, w: 1.6, d: 1.2 }, // barrels
    { x: W / 2 - 0.7, z: 2.0, w: 0.8, d: 1.0 }, // cutlass rack
  ];
  const spots = {
    chest: { x: -2.4, z: 2.35, r: 2.3, kind: 'ship_chest', label: 'OPEN STORAGE' },
    exit: { x: 0, z: D / 2 - 1.4, r: 2.5, kind: 'ship_exit', label: 'LEAVE HULL' },
  };
  g.userData = { W, D, H, PEAK: H, colliders, spots, chest, door, fireLight: candleLit, chLight, cottageId: SHIP_QUARTERS_ID };
  return g;
}

/**
 * Controller: enter / leave Captain's Quarters, prompts, GLB swap, HUD leave button.
 * Storage is delegated to houses.openFor(SHIP_QUARTERS_ID).
 */
export function createShipHull({
  scene, world, walker, pirate, crewF, petF, fnet, camera = null,
  toast = () => {}, sfx = null, fadeTo = (fn) => fn(),
  houses = null, low = false, ocean = null, islands = null,
}) {
  const leaveBtn = document.createElement('button');
  leaveBtn.id = 'cq-leave'; leaveBtn.type = 'button'; leaveBtn.textContent = 'LEAVE HULL';
  leaveBtn.style.cssText = 'display:none;position:fixed;left:50%;bottom:calc(var(--safe-b,0px) + 92px);transform:translateX(-50%);z-index:9;font:22px "Just Another Hand",cursive;letter-spacing:.04em;padding:8px 18px 6px;border-radius:12px;border:3px solid #ffcd77;background:rgba(22,22,22,.9);color:#ffcd77;cursor:pointer;pointer-events:auto';
  document.body.appendChild(leaveBtn);

  let inHull = false, interior = null, roomOrigin = null, returnCtx = null, busy = false;
  const hiddenPeers = new Set();
  let _ground, _water, _stand, _blocked;
  if (world) {
    _ground = world.ground?.bind(world);
    _water = world.water?.bind(world);
    _stand = world.stand?.bind(world);
    _blocked = world.blocked?.bind(world);
  }
  const inPocket = (x, z) => !!(inHull && interior && roomOrigin
    && Math.abs(x - roomOrigin.x) < 60 && Math.abs(z - roomOrigin.z) < 60);
  const hitFurn = (lx, lz, pad = 0.34) => {
    for (const c of (interior?.userData?.colliders || [])) {
      if (Math.abs(lx - c.x) <= c.w / 2 + pad && Math.abs(lz - c.z) <= c.d / 2 + pad) return c;
    }
    return null;
  };
  function installPocket() {
    if (!world) return;
    if (typeof world.ground === 'function') world.ground = (x, z) => (inPocket(x, z) ? roomOrigin.y + 0.14 : _ground(x, z));
    if (typeof world.water === 'function') world.water = (x, z) => (inPocket(x, z) ? null : _water(x, z));
    if (typeof world.stand === 'function') world.stand = (x, z) => (inPocket(x, z) ? roomOrigin.y + 0.14 : _stand(x, z));
    if (typeof world.blocked === 'function') {
      world.blocked = (x, z, px, pz) => {
        if (!inPocket(x, z)) return _blocked(x, z, px, pz);
        const lx = x - roomOrigin.x, lz = z - roomOrigin.z;
        const halfW = interior.userData.W / 2 - 0.52, halfD = interior.userData.D / 2 - 0.52;
        if (Math.abs(lx) > halfW || Math.abs(lz) > halfD) return true;
        return !!hitFurn(lx, lz);
      };
    }
  }

  function applyCam() {
    if (!camera || !interior || !roomOrigin || !walker?.w) return;
    const w = walker.w;
    const yaw = Number.isFinite(w.camYaw) ? w.camYaw : w.yaw;
    const pitch = Math.max(-0.45, Math.min(0.65, w.pitch ?? 0.16));
    const dist = Math.min(4.6, Math.max(4.0, w.dist || 4.3));
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    let cx = w.x - Math.sin(yaw) * dist * cp;
    let cy = w.y + 1.7 + sp * dist;
    let cz = w.z - Math.cos(yaw) * dist * cp;
    const camHalfW = interior.userData.W / 2 - 0.3, camHalfD = interior.userData.D / 2 - 0.3;
    const yLo = roomOrigin.y + 0.9, yHi = roomOrigin.y + (interior.userData.H || 3.5) - 0.4;
    cx = roomOrigin.x + Math.max(-camHalfW, Math.min(camHalfW, cx - roomOrigin.x));
    cz = roomOrigin.z + Math.max(-camHalfD, Math.min(camHalfD, cz - roomOrigin.z));
    cy = Math.max(yLo, Math.min(yHi, cy));
    camera.position.set(cx, cy, cz);
    camera.lookAt(w.x, w.y + 1.35, w.z);
    camera.updateMatrixWorld?.(true);
  }

  async function placeRoom() {
    if (interior) { scene.remove(interior); interior = null; }
    const crafted = buildCaptainsQuartersRoom({ low });
    const glb = await loadQuartersGlb();
    if (glb) {
      interior = new THREE.Group(); interior.name = 'captains_quarters';
      const art = glb.clone(true);
      art.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = false; } });
      interior.add(art);
      // Keep interact spots / colliders from crafted metadata even when GLB art is shown
      interior.userData = { ...crafted.userData };
      // Soft lights still needed for GLB
      const hemi = new THREE.HemisphereLight(0xffe6ba, 0x1a1008, 0.65); interior.add(hemi);
      const pl = new THREE.PointLight(0xffc978, 3.2, 14, 1.4); pl.position.set(0, 2.8, 0); interior.add(pl);
    } else {
      interior = crafted;
    }
    const ox = 3200, oz = 3200, oy = 140; // pocket far from cottage pocket (2800,2800)
    roomOrigin = { x: ox, y: oy, z: oz };
    interior.position.set(ox, oy, oz);
    scene.add(interior);
    installPocket();
    return { ox, oy, oz };
  }

  function enter(ctx = {}) {
    if (inHull || busy) return false;
    busy = true;
    returnCtx = {
      from: ctx.from || 'dock', // 'dock' | 'sea'
      ax: ctx.ax, az: ctx.az, ayaw: ctx.ayaw,
      berthId: ctx.berthId || null,
    };
    const run = async () => {
      try {
        const { ox, oy, oz } = await placeRoom();
        inHull = true;
        document.documentElement.classList.add('pfp-inhull', 'pfp-onfoot', 'pfp-inhouse');
        leaveBtn.style.display = 'block';
        try { houses?.ensureShipQuarters?.(); } catch {}
        const w = walker.w;
        const lz = interior.userData.D / 2 - 1.55;
        if (typeof walker.enter === 'function' && w && w.active === false) {
          try { walker.enter(ox, oz + lz, Math.PI); } catch {}
        }
        w.x = ox; w.z = oz + lz; w.y = oy + 0.14;
        w.yaw = Math.PI; w.camYaw = Math.PI; w.pitch = 0.16; w.dist = 4.3;
        w.vy = 0; w.speed = 0; w.air = false; w.swim = false; w.wade = 0;
        if (w.body) Object.assign(w.body, { y: oy + 0.14, last: oy + 0.14, vy: 0, air: false, swim: false, wade: 0 });
        w._cqCamPrev = w.camHook;
        w.camHook = () => { applyCam(); };
        try {
          pirate.object.visible = true;
          pirate.object.position.set(w.x, w.y, w.z);
          pirate.object.rotation.order = 'YXZ';
          pirate.object.rotation.set(0, w.yaw, 0);
        } catch {}
        try { crewF?.exit?.(); } catch {}
        try { petF?.exit?.(); } catch {}
        try {
          for (const [id, p] of (fnet?.peers || [])) {
            if (p.pirate?.object) { p.pirate.object.visible = false; hiddenPeers.add(id); }
          }
        } catch {}
        try { if (world?.root) { world.root.userData._cqVis = world.root.visible; world.root.visible = false; } } catch {}
        try { if (ocean?.mesh) { ocean.mesh.userData._cqVis = ocean.mesh.visible; ocean.mesh.visible = false; } } catch {}
        try { if (islands?.group) { islands.group.userData._cqVis = islands.group.visible; islands.group.visible = false; } } catch {}
        try {
          if (scene.fog) { scene.userData._cqFog = scene.fog.density; scene.fog.density = 0; }
          scene.userData._cqBg = scene.background; scene.background = new THREE.Color(0x120c08);
        } catch {}
        sfx?.coin?.();
        toast("⚓ CAPTAIN'S QUARTERS", 1800);
      } finally { busy = false; }
    };
    if (ctx.skipFade) run();
    else fadeTo(() => { run(); });
    return true;
  }

  function leave(onBack = null) {
    if (!inHull || busy) return false;
    busy = true;
    const ctx = returnCtx;
    fadeTo(() => {
      try {
        try { houses?.closeStorage?.(); } catch {}
        if (interior) { scene.remove(interior); interior = null; }
        roomOrigin = null; inHull = false; returnCtx = null;
        leaveBtn.style.display = 'none';
        document.documentElement.classList.remove('pfp-inhull', 'pfp-inhouse');
        const w = walker?.w;
        if (w) { w.camHook = w._cqCamPrev || null; w._cqCamPrev = null; }
        for (const id of hiddenPeers) {
          try { const p = fnet?.peers?.get?.(id); if (p?.pirate?.object) p.pirate.object.visible = true; } catch {}
        }
        hiddenPeers.clear();
        try { if (world?.root) world.root.visible = world.root.userData._cqVis !== false; } catch {}
        try { if (ocean?.mesh) ocean.mesh.visible = ocean.mesh.userData._cqVis !== false; } catch {}
        try { if (islands?.group) islands.group.visible = islands.group.userData._cqVis !== false; } catch {}
        try {
          if (scene.fog && '_cqFog' in scene.userData) scene.fog.density = scene.userData._cqFog;
          if ('_cqBg' in scene.userData) scene.background = scene.userData._cqBg;
        } catch {}
        onBack?.(ctx);
        toast(ctx?.from === 'sea' ? '⚓ BACK ABOARD · ANCHORED' : '⚓ BACK ABOARD · HARBOR', 1600);
      } finally { busy = false; }
    });
    return true;
  }

  leaveBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (inHull) leaveBtn.dispatchEvent(new CustomEvent('cq-leave-request', { bubbles: true }));
  });

  function prompts() {
    if (!inHull || !interior || !roomOrigin || !walker?.w) return null;
    const w = walker.w;
    const lx = w.x - roomOrigin.x, lz = w.z - roomOrigin.z;
    const spots = interior.userData.spots || {};
    let best = null, bd = 1e9;
    for (const [tag, sp] of Object.entries(spots)) {
      const d = Math.hypot(lx - sp.x, lz - sp.z);
      if (d < (sp.r || 2.2) && d < bd) { bd = d; best = { tag, label: sp.label, primary: true, key: 'E' }; }
    }
    if (best?.tag === 'chest') return { a: { label: 'OPEN STORAGE', key: 'E', primary: true, tag: 'chest' }, b: { label: 'LEAVE HULL', key: 'Q', tag: 'leave' } };
    if (best?.tag === 'exit') return { a: { label: 'LEAVE HULL', key: 'E', primary: true, tag: 'leave' }, b: null };
    return { a: null, b: { label: 'LEAVE HULL', key: 'Q', tag: 'leave' } };
  }

  function act(tag) {
    if (tag === 'chest') { try { houses?.openFor?.(SHIP_QUARTERS_ID); } catch {} return true; }
    if (tag === 'leave') return 'leave';
    return false;
  }

  function tick() {
    if (!inHull || !walker?.w || !roomOrigin) return;
    // Soft lantern flicker
    try {
      const t = performance.now() * 0.001;
      if (interior?.userData?.chLight) interior.userData.chLight.intensity = 3.2 + Math.sin(t * 3.1) * 0.35;
      if (interior?.userData?.fireLight) interior.userData.fireLight.intensity = 0.8 + Math.sin(t * 5.2) * 0.25;
    } catch {}
  }

  function clear() {
    if (inHull) {
      try { houses?.closeStorage?.(); } catch {}
      if (interior) { scene.remove(interior); interior = null; }
      inHull = false; roomOrigin = null; returnCtx = null;
      leaveBtn.style.display = 'none';
      document.documentElement.classList.remove('pfp-inhull');
    }
  }

  return {
    get inHull() { return inHull; },
    get returnCtx() { return returnCtx; },
    SHIP_QUARTERS_ID, SHIP_QUARTERS_SLOTS, HULL_COMBAT_LOCK_S,
    enter, leave, prompts, act, tick, clear, leaveBtn,
    buildCaptainsQuartersRoom,
  };
}
