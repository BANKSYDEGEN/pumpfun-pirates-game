// PUMPFUN PIRATES · first-run harbor cutscene.
// Camera flies a berth-first path around the island (smooth eased lerps, no hard cuts).
// The player does not walk or press keys to advance. Next / Skip + auto-advance.
// Shown once (localStorage pfp_harbor_tut_off, separate from the Storm Hunt card). Reopen from pause or the title "?".
import { FALLBACK } from './inventory/shopSpots.js';
import { toHarbor, t2w, t2wYaw } from './island/coast.js';
import {
  HARBOR_TUT_KEY, HARBOR_TUT_CSS, harborTutSteps, mountHarborTutPreview, HARBOR_TUT_IDS, harborTutDevice,
} from './harborTutorialSteps.js';
import { onPadMode, padConnected } from './gamepad.js';

export { HARBOR_TUT_KEY, harborTutSteps, mountHarborTutPreview, HARBOR_TUT_IDS, harborTutDevice };

const FLY_S = 1.35, FLY_MAX_S = 3.6, HOLD_S = 5.2;
const $ = (id) => document.getElementById(id);
const KEYBOARD = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return true; } };
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// Look-target constants (harbor / town / foot frames). Inlined so this module never imports Three.js-heavy files.
const HULL_WARDROBE = { x: 4.0, z: -3.65 };
const HULL_CREW = { x: -2.8, y: 0.14, z: -4.15 };
const HQ = { door: { lx: -18.5, lz: -30 }, mid: { lx: -18.5, lz: -47.5 }, board: { lx: -18.5, lz: -64.2, y: 8.53 }, floor: 2.73 };
const SQUAD = { lx: 17.95, lz: -71, doorY: 5.31 };
const COLI = { lx: 61, lz: -136 };
const COTTAGES = [ // foot frame, js/dock/houses.js FALLBACK_COTTAGES
  { x: -375.34, z: -157.54 }, { x: -359.48, z: -138.46 }, { x: -369.88, z: -115.50 }, { x: -388.99, z: -111.15 },
];
const GILL_DOCK = { x: -205, z: -80, y: 21.6 }; // foot; mid lagoon dock
const DIG_TOWN_SHORE = { x: -626, z: -258 }; // foot; dig6, active roll spot on the west shore near the boardwalk

let ctx = null, open = false, step = 0, phase = 'fly', t = 0, flyDur = FLY_S, from = null, to = null, returnCam = null, returnState = null, enteredHull = false, pinned = null;
const PIN_IDS = {
  fish: ['fish_market', 'invshop_fish'],
  antiques: ['invshop_antiques', 'rent_1', 'antiques', 'treasure_trader'],
  market: ['invshop_market', 'market'],
  pumpfun: ['pumpfun_hq', 'hq', 'pumpfun'],
  squads: ['squad_hall'],
  coliseum: ['coliseum'],
  cabins: ['cottage_gabled', 'cottage_garden', 'cottage_balcony', 'cottage_dormer'],
  fishing: ['lagoon', 'grandpa_gill', 'lagoon_gill', 'lagoon_dock'],
};

export function isHarborTutOff() { try { return localStorage.getItem(HARBOR_TUT_KEY) === '1'; } catch { return false; } }
export function isHarborTutOpen() { return open; }
function markSeen() { try { localStorage.setItem(HARBOR_TUT_KEY, '1'); } catch {} }

let forceDevice = null, padShown = false, unPad = null;
function isTouch() { return !!(ctx?.touch) || !KEYBOARD(); }
function activeDevice() {
  if (forceDevice) return forceDevice;
  if (padShown) return 'pad';
  return harborTutDevice(null, isTouch());
}
function steps() { return harborTutSteps(activeDevice()); }

function build() {
  if ($('harbor-tut')) return;
  const st = document.createElement('style'); st.id = 'harbor-tut-css'; st.textContent = HARBOR_TUT_CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'harbor-tut'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Harbor tutorial');
  el.innerHTML = `<div class="ht-card">
    <div class="ht-kicker" id="ht-kicker">HARBOR TUTORIAL · 1 / ${harborTutSteps(false).length}</div>
    <h2 id="ht-title">CONTROLS</h2>
    <div class="ht-body" id="ht-body"></div>
    <div class="ht-row">
      <div class="ht-bar" aria-hidden="true"><i id="ht-bar"></i></div>
      <button type="button" id="ht-skip" class="ghost">SKIP</button>
      <button type="button" id="ht-next" class="ht-next">NEXT</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  $('ht-skip').onclick = (e) => { e.stopPropagation(); closeHarborTutorial({ seen: true }); };
  $('ht-next').onclick = (e) => { e.stopPropagation(); next(); };
  for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'keydown' });
}

function renderCard() {
  const list = steps(), s = list[step]; if (!s) return;
  $('ht-kicker').textContent = `HARBOR TUTORIAL · ${step + 1} / ${list.length}`;
  $('ht-title').textContent = s.title;
  $('ht-body').innerHTML = s.body;
  $('ht-next').textContent = step === list.length - 1 ? 'DONE' : 'NEXT';
  $('ht-bar').style.width = '0%';
}

function ease(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
function distCam(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.px - b.px, a.py - b.py, a.pz - b.pz) + Math.hypot(a.tx - b.tx, a.ty - b.ty, a.tz - b.tz) * 0.35;
}
function flyTime(a, b) {
  const d = distCam(a, b);
  return Math.min(FLY_MAX_S, Math.max(FLY_S, 0.85 + d / 160));
}

function camNow() {
  const c = ctx?.camera; if (!c) return null;
  const t = ctx.controls?.target;
  return {
    px: c.position.x, py: c.position.y, pz: c.position.z,
    tx: t ? t.x : c.position.x, ty: t ? t.y : c.position.y, tz: t ? t.z : c.position.z - 1,
  };
}
function applyCam(shot) {
  const c = ctx?.camera; if (!c || !shot) return;
  c.position.set(shot.px, shot.py, shot.pz);
  if (ctx.controls?.target) ctx.controls.target.set(shot.tx, shot.ty, shot.tz);
  c.lookAt(shot.tx, shot.ty, shot.tz);
  c.updateMatrixWorld?.(true);
}
function lerpCam(a, b, u) {
  const e = ease(u);
  applyCam({
    px: a.px + (b.px - a.px) * e, py: a.py + (b.py - a.py) * e, pz: a.pz + (b.pz - a.pz) * e,
    tx: a.tx + (b.tx - a.tx) * e, ty: a.ty + (b.ty - a.ty) * e, tz: a.tz + (b.tz - a.tz) * e,
  });
}

function playerShip() {
  try { return ctx.getPlayer?.() || null; } catch { return null; }
}
function lookAtPoint(x, y, z, dist = 9, yaw = 0.6, pitch = 0.35) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return {
    px: x - Math.sin(yaw) * dist * cp, py: y + 1.4 + sp * dist, pz: z - Math.cos(yaw) * dist * cp,
    tx: x, ty: y + 1.2, tz: z,
  };
}
function footToH(x, z) {
  try { if (ctx?.layout?.footToHarbor) return ctx.layout.footToHarbor(x, z); } catch {}
  return toHarbor(x, z);
}
function townToH(lx, lz) {
  try {
    if (ctx?.layout?.footToHarbor && ctx.layout.CO?.t2w) return ctx.layout.footToHarbor(...ctx.layout.CO.t2w(lx, lz));
  } catch {}
  return toHarbor(...t2w(lx, lz));
}
function groundY(x, z, fallback = 3) {
  const y = ctx?.world?.ground?.(x, z);
  return Number.isFinite(y) ? y : fallback;
}
function townLook(lx, lz, yOff = 0.4, dist = 14, townYaw = Math.PI, pitch = 0.32, yAbs) {
  const [x, z] = townToH(lx, lz);
  const y = yAbs != null ? yAbs : groundY(x, z, 3) + yOff;
  const yaw = t2wYaw(townYaw);
  return lookAtPoint(x, y, z, dist, yaw, pitch);
}
function footLook(fx, fz, yOff = 0.4, dist = 14, yaw = Math.PI / 2, pitch = 0.32, yAbs) {
  const [x, z] = footToH(fx, fz);
  const y = yAbs != null ? yAbs : groundY(x, z, 3) + yOff;
  return lookAtPoint(x, y, z, dist, yaw, pitch);
}

function shopLook(id) {
  const q = (ctx.world?.footInteract || []).find((s) => s.id === 'invshop_' + id || s.src?.id === 'invshop_' + id);
  let x, z, y, rot = FALLBACK[id]?.rotY || 0;
  if (q) { x = q.x; z = q.z; y = ctx.world?.ground?.(q.x, q.z); }
  else {
    const fb = FALLBACK[id]?.trigger; if (!fb) return null;
    [x, z] = footToH(fb.x, fb.z); y = ctx.world?.ground?.(x, z) ?? fb.y;
  }
  if (!Number.isFinite(y)) y = 3;
  return lookAtPoint(x, y + 0.4, z, 11, rot + 0.85, 0.32);
}
function clampHullCam(shot) {
  const origin = ctx.shipHull?.roomOrigin, ud = ctx.shipHull?.interior?.userData;
  if (!origin || !shot) return shot;
  const halfW = ((ud?.W || 11.6) / 2) - 0.7, halfD = ((ud?.D || 11.0) / 2) - 0.7;
  const yLo = origin.y + 0.95, yHi = origin.y + (ud?.PEAK || 4.35) - 0.5;
  const cx = (v, c, h) => c + Math.max(-h, Math.min(h, v - c));
  return {
    px: cx(shot.px, origin.x, halfW), py: Math.max(yLo, Math.min(yHi, shot.py)), pz: cx(shot.pz, origin.z, halfD),
    tx: cx(shot.tx, origin.x, halfW), ty: Math.max(origin.y + 0.4, Math.min(yHi, shot.ty)), tz: cx(shot.tz, origin.z, halfD),
  };
}
function hullLook(kind) {
  const origin = ctx.shipHull?.roomOrigin; if (!origin) return null;
  const floorY = origin.y + 0.14;
  // Room is 11.6 x 11.0; the old lookAtPoint distances sat the camera outside the walls.
  if (kind === 'clothes') {
    // Sea chest under the aft starboard porthole (prop at local 5.0, -3.65).
    return clampHullCam({
      px: origin.x + 2.4, py: floorY + 1.4, pz: origin.z - 1.9,
      tx: origin.x + 5.0, ty: floorY + 0.6, tz: origin.z - 3.55,
    });
  }
  // Crew mannequin at local -2.8, -4.15, viewed from mid-room looking aft-port.
  return clampHullCam({
    px: origin.x + 0.45, py: floorY + 1.65, pz: origin.z - 1.05,
    tx: origin.x - 2.8, ty: floorY + 1.25, tz: origin.z - 4.15,
  });
}
function berthLook() {
  const s = playerShip(); if (!s) return camNow();
  const y = (s.y || 0) + 4;
  return lookAtPoint(s.x, y, s.z, 18, (s.yaw || 0) + 0.7, 0.38);
}
function inventoryLook() {
  const s = playerShip(); if (!s) return berthLook();
  return lookAtPoint(s.x, (s.y || 0) + 3.2, s.z, 10, (s.yaw || 0) + 0.35, 0.22);
}
function exteriorHullLook() {
  const s = playerShip(); if (!s) return berthLook();
  return lookAtPoint(s.x, (s.y || 0) + 3.2, s.z, 12, (s.yaw || 0) + Math.PI * 0.85, 0.22);
}
function pumpfunLook() {
  // Mid-hall, looking inland at the back boards.
  const [tx, tz] = townToH(HQ.board.lx, HQ.board.lz);
  const [cx, cz] = townToH(HQ.mid.lx, HQ.mid.lz);
  const y = HQ.floor + 1.6;
  return { px: cx, py: y + 1.2, pz: cz, tx, ty: HQ.floor + 4.3, tz };
}
function canoeLook() {
  const s = playerShip();
  if (s) {
    // Seaward of the ship (harbor -x is out to sea), looking along the water toward the hull and open water.
    const x = s.x - 26, z = s.z, y = (s.y || 0) + 2.2;
    return lookAtPoint(x, y, z, 22, Math.PI * 0.55, 0.28);
  }
  return townLook(16, 48, 2, 22, Math.PI * 0.2, 0.28, 4);
}

function pinFor(id) {
  const map = ctx.imap; if (!map?.selectBuildingPin) return;
  for (const a of (PIN_IDS[id] || [])) { try { if (map.selectBuildingPin(a)) { pinned = a; return; } } catch {} }
}
function clearPin() { try { if (pinned) ctx.imap?.clearPin?.(); } catch {} pinned = null; }

async function ensureHull(want) {
  if (want) {
    if (!ctx.shipHull?.inHull) {
      const ok = await Promise.resolve(ctx.enterHull?.());
      enteredHull = enteredHull || !!ok || !!ctx.shipHull?.inHull;
    }
    try { if (ctx.shipHull) ctx.shipHull.camHold = true; } catch {}
    return;
  }
  if (ctx.shipHull?.inHull && enteredHull) {
    try { ctx.shipHull.camHold = false; } catch {}
    await Promise.resolve(ctx.leaveHull?.());
    try { if (ctx.controls) ctx.controls.enabled = false; } catch {}
  }
}

async function prepareStep(id) {
  clearPin();
  const inHullShot = id === 'hull_clothes' || id === 'hull_crew';
  await ensureHull(inHullShot);
  if (inHullShot) return hullLook(id === 'hull_clothes' ? 'clothes' : 'crew') || exteriorHullLook();
  if (id === 'controls') return berthLook();
  if (id === 'inventory') return inventoryLook() || berthLook();
  if (id === 'fish' || id === 'antiques' || id === 'market') { pinFor(id); return shopLook(id) || berthLook(); }
  if (id === 'pumpfun') {
    pinFor(id);
    const shot = pumpfunLook();
    const pos = shot ? { x: shot.tx, z: shot.tz } : null;
    try { await Promise.resolve(ctx.pumpfun?.showAt?.(pos) || ctx.pumpfun?.update?.(true, pos, ctx.game?.t || 0)); } catch {}
    return shot;
  }
  if (id === 'squads') { pinFor(id); return townLook(SQUAD.lx, SQUAD.lz, 0.4, 13, Math.PI / 2, 0.22, SQUAD.doorY + 0.4); }
  if (id === 'coliseum') { pinFor(id); return townLook(COLI.lx, COLI.lz, 1.2, 32, Math.PI * 0.85, 0.48, 8); }
  if (id === 'cabins') {
    pinFor(id);
    const mx = COTTAGES.reduce((s, c) => s + c.x, 0) / COTTAGES.length;
    const mz = COTTAGES.reduce((s, c) => s + c.z, 0) / COTTAGES.length;
    return footLook(mx, mz, 0.6, 18, 2.4, 0.34);
  }
  if (id === 'fishing') { pinFor(id); return footLook(GILL_DOCK.x, GILL_DOCK.z, 0.4, 14, Math.PI * 0.15, 0.28, GILL_DOCK.y); }
  if (id === 'treasure') return footLook(DIG_TOWN_SHORE.x, DIG_TOWN_SHORE.z, 0.2, 9, 0.9, 0.42);
  if (id === 'canoe') return canoeLook();
  return berthLook();
}

function snapshot() {
  returnCam = camNow();
  const s = playerShip(), w = ctx.walker?.w;
  returnState = {
    onFoot: !!ctx.onFoot?.(), inHull: !!ctx.shipHull?.inHull,
    x: w?.x, z: w?.z, yaw: w?.yaw, camYaw: w?.camYaw, pitch: w?.pitch,
    sx: s?.x, sz: s?.z, syaw: s?.yaw,
  };
  enteredHull = false;
}

function restore() {
  clearPin();
  try { if (ctx.shipHull) ctx.shipHull.camHold = false; } catch {}
  if (enteredHull && ctx.shipHull?.inHull) {
    try { ctx.leaveHull?.(); } catch {}
  }
  enteredHull = false;
  try { if (ctx.controls) ctx.controls.enabled = !ctx.onFoot?.() && !ctx.shipHull?.inHull; } catch {}
  if (returnState?.onFoot && !ctx.onFoot?.() && Number.isFinite(returnState.x)) {
    try { ctx.goAshoreAt?.(returnState.x, returnState.z, returnState.yaw); } catch {}
  }
  if (returnCam && !returnState?.onFoot) {
    applyCam(returnCam);
    try { ctx.camReset?.(); } catch {}
  } else if (returnCam) applyCam(returnCam);
  returnCam = null; returnState = null;
}

function go(i) {
  const list = steps();
  if (i >= list.length) { closeHarborTutorial({ seen: true }); return; }
  step = i; phase = 'fly'; t = 0; flyDur = FLY_S; renderCard();
  from = camNow() || berthLook();
  Promise.resolve(prepareStep(list[step].id)).then((shot) => {
    to = shot || from;
    const now = camNow();
    // Hull is a private pocket far from the harbor — don't lerp across the void; ease from the new room instead.
    if (now && from && distCam(from, now) > 180) from = now;
    flyDur = reduced() ? 0.01 : flyTime(from, to);
    if (reduced()) { applyCam(to); phase = 'hold'; t = 0; }
  });
}

function next() {
  if (!open) return;
  if (phase === 'fly' && to) { applyCam(to); phase = 'hold'; t = 0; return; }
  go(step + 1);
}

export function closeHarborTutorial({ seen = false } = {}) {
  if (!open && !$('harbor-tut')?.classList.contains('on')) { restore(); return; }
  open = false; phase = 'fly'; t = 0;
  $('harbor-tut')?.classList.remove('on');
  document.documentElement.classList.remove('pfp-harbor-tut');
  removeLock();
  if (seen) markSeen();
  restore();
}

function onLockKey(e) {
  if (!open) return;
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeHarborTutorial({ seen: true }); return; }
  if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === 'keydown' && !e.repeat) next(); return; }
  e.stopPropagation();
  if (e.type === 'keydown') e.preventDefault();
}
function onLockPtr(e) {
  if (!open) return;
  if (e.target?.closest?.('#harbor-tut')) return;
  e.stopPropagation();
  if (e.cancelable) e.preventDefault();
}
function addLock() {
  addEventListener('keydown', onLockKey, true);
  addEventListener('keyup', onLockKey, true);
  for (const ev of ['pointerdown', 'pointermove', 'mousedown', 'touchstart', 'wheel', 'contextmenu']) addEventListener(ev, onLockPtr, true);
}
function removeLock() {
  removeEventListener('keydown', onLockKey, true);
  removeEventListener('keyup', onLockKey, true);
  for (const ev of ['pointerdown', 'pointermove', 'mousedown', 'touchstart', 'wheel', 'contextmenu']) removeEventListener(ev, onLockPtr, true);
}

export function showHarborTutorial() {
  if (!ctx) return;
  try { $('pause')?.classList.add('hidden'); if (ctx.game?.state === 'paused') ctx.game.state = 'playing'; } catch {}
  build(); snapshot();
  open = true; step = 0;
  document.documentElement.classList.add('pfp-harbor-tut');
  $('harbor-tut').classList.add('on');
  try { if (ctx.controls) ctx.controls.enabled = false; } catch {}
  addLock();
  go(0);
}

export function maybeShowHarborTutorial() {
  if (!ctx || open || isHarborTutOff()) return;
  if (ctx.hidden?.()) return;
  if (!ctx.on?.()) return;
  try { if (ctx.game && ctx.game.state !== 'playing') return; } catch {}
  try { if (ctx.pvp?.()?.where && ctx.pvp().where !== 'harbor') return; } catch {}
  try { if (ctx.pvp?.()?.spectating) return; } catch {}
  showHarborTutorial();
}

/** Drive the camera this frame. Returns true when the cutscene owns it (main.js / hull skip their cameras). */
export function harborTutCamera(dt) {
  if (!open) return false;
  const hold = reduced() ? 4 : HOLD_S; const fly = reduced() ? 0.01 : flyDur;
  if (phase === 'fly') {
    t += dt; const u = Math.min(1, t / Math.max(0.01, fly));
    if (from && to) lerpCam(from, to, u);
    if ($('ht-bar')) $('ht-bar').style.width = '0%';
    if (u >= 1) { phase = 'hold'; t = 0; if (to) applyCam(to); }
  } else {
    t += dt; if ($('ht-bar')) $('ht-bar').style.width = `${Math.min(100, (t / hold) * 100)}%`;
    if (to) applyCam(to);
    if (t >= hold) next();
  }
  return true;
}

function wireMenus() {
  const quit = $('btn-quit');
  if (quit && !$('btn-harbor-tut')) {
    const b = document.createElement('button'); b.className = 'ghost'; b.id = 'btn-harbor-tut'; b.type = 'button';
    b.textContent = 'HARBOR TUTORIAL'; b.onclick = () => showHarborTutorial();
    const hunt = $('btn-tut-pause'); (hunt || quit).before(b);
  }
  const faq = document.querySelector('#faq .faq-card');
  if (faq && !$('btn-harbor-tut-faq')) {
    const b = document.createElement('button'); b.id = 'btn-harbor-tut-faq'; b.type = 'button'; b.className = 'ghost';
    b.textContent = 'HARBOR TUTORIAL'; b.style.cssText = 'display:block;margin:8px 0 12px;';
    b.onclick = () => { try { $('faq')?.classList.add('hidden'); } catch {} showHarborTutorial(); };
    const h = faq.querySelector('h3'); if (h) h.before(b); else faq.appendChild(b);
  }
}

let startArmed = false, startAt = 0;
export function tickHarborTutorialStart() {
  if (open || isHarborTutOff() || !ctx) return;
  if (ctx.hidden?.() || !ctx.on?.()) { startArmed = false; return; }
  try { if (ctx.game && ctx.game.state !== 'playing') return; } catch {}
  try { if (ctx.pvp?.()?.spectating) return; } catch {}
  if (!startArmed) { startArmed = true; startAt = performance.now() + 1400; return; }
  if (performance.now() >= startAt) maybeShowHarborTutorial();
}

function hookPad() {
  try { unPad?.(); } catch {}
  const redraw = () => { if (open) renderCard(); };
  const on = (v) => { padShown = !!v; redraw(); };
  try { unPad = onPadMode(on); } catch { unPad = null; }
  const plugged = () => { padShown = true; redraw(); };
  const unplugged = () => { try { if (!padConnected()) padShown = false; } catch { padShown = false; } redraw(); };
  addEventListener('gamepadconnected', plugged);
  addEventListener('gamepaddisconnected', unplugged);
  const prev = unPad;
  unPad = () => { try { prev?.(); } catch {} removeEventListener('gamepadconnected', plugged); removeEventListener('gamepaddisconnected', unplugged); };
}

export function initHarborTutorial(c) {
  ctx = c; build(); wireMenus(); hookPad();
  // menus can be created after us (Storm Hunt HOW TO PLAY button)
  setTimeout(wireMenus, 0); setTimeout(wireMenus, 800);
  try {
    window.__pfpHarborTut = {
      show: showHarborTutorial, close: closeHarborTutorial, next,
      go: (i) => go(i), step: () => step, phase: () => phase, open: () => open,
      device: () => activeDevice(), setDevice: (d) => { forceDevice = d || null; if (d === 'pad') padShown = true; if (open) renderCard(); },
      freeze: () => { if (to) applyCam(to); phase = 'hold'; t = 0; },
      ids: HARBOR_TUT_IDS,
    };
  } catch {}
}
