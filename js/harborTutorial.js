// PUMPFUN PIRATES · first-run harbor cutscene.
// Camera flies a berth-first path around the island (smooth eased lerps, no hard cuts).
// The player does not walk or press keys to advance. Next / Skip + auto-advance.
// Shown once (localStorage pfp_harbor_tut_off, separate from the Storm Hunt card). Reopen from pause or the title "?".
import { FALLBACK } from './inventory/shopSpots.js';
import { toHarbor, t2w, t2wYaw } from './island/coast.js';
import {
  HARBOR_TUT_KEY, HARBOR_TUT_CSS, harborTutSteps, mountHarborTutPreview, HARBOR_TUT_IDS, harborTutDevice, harborTutInvHint,
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
const CANOE_TOWN = { ship: { lx: -168, lz: 50 }, shore: { lx: -168, lz: 8 } }; // same west beach as the treasure shot
const INV_HINT_S = 1.7;
const CANOE_TIMES = { launch: 0.9, toShore: 3.2, drop: 1.8, reboard: 1.1, back: 3.2, aboard: 1.3 };
const CANOE_TOTAL = Object.values(CANOE_TIMES).reduce((a, b) => a + b, 0);

let ctx = null, open = false, step = 0, phase = 'fly', t = 0, flyDur = FLY_S, from = null, to = null, returnCam = null, returnState = null, enteredHull = false, pinned = null;
let invHintOn = false, invOpened = false, canoeRun = null, canoeSnap = null;
const PIN_IDS = {
  fish: ['fish_market', 'invshop_fish'],
  antiques: ['invshop_antiques', 'rent_1', 'antiques', 'treasure_trader'],
  market: ['invshop_market', 'market'],
  pumpfun: ['pumpfun_hq', 'hq', 'pumpfun'],
  squads: ['squad_hall'],
  coliseum: ['coliseum'],
  cabins: ['cottage_gabled', 'cottage_garden', 'cottage_balcony', 'cottage_dormer'],
  fishing: ['lagoon', 'grandpa_gill', 'lagoon_gill', 'lagoon_dock'],
  casino: ['casino', 'golden_doubloon', 'doubloon'],
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

function townShot(clx, clz, cy, tlx, tlz, ty) {
  const [px, pz] = townToH(clx, clz);
  const [tx, tz] = townToH(tlx, tlz);
  return { px, py: cy, pz, tx, ty, tz };
}
function shopLook(id) {
  // Street / doorway looking in at the counter. Town +lz is out to sea; shop fronts sit at lz -30.
  if (id === 'fish') return townShot(73.2, -26.0, 5.15, 73.2, -38.6, 3.55);
  if (id === 'market') return townShot(47.0, -26.0, 5.15, 47.0, -38.6, 3.55);
  if (id === 'antiques') {
    const gy = 3.0 + Math.max(0, 73.1 - 50) * 0.11;
    return townShot(5.4, -73.1, gy + 2.05, -6.5, -73.1, gy + 1.2);
  }
  const q = (ctx.world?.footInteract || []).find((s) => s.id === 'invshop_' + id || s.src?.id === 'invshop_' + id);
  let x, z, y, rot = FALLBACK[id]?.rotY || 0;
  if (q) { x = q.x; z = q.z; y = ctx.world?.ground?.(q.x, q.z); }
  else {
    const fb = FALLBACK[id]?.trigger; if (!fb) return null;
    [x, z] = footToH(fb.x, fb.z); y = ctx.world?.ground?.(x, z) ?? fb.y;
  }
  if (!Number.isFinite(y)) y = 3;
  return lookAtPoint(x, y + 0.4, z, 11, t2wYaw(rot) + 0.35, 0.32);
}
function casinoLook() {
  // Just inside the Main Street arch, looking into the hall at the tables.
  return townShot(16.2, -48.4, 4.9, 23.4, -52.4, 3.55);
}
function forceLoad(shot) {
  if (!shot) return;
  const pos = { x: shot.px, y: shot.py, z: shot.pz };
  try { ctx.world?.update?.(pos, ctx.game?.t || 0, 0); } catch {}
  try { ctx.plaza?.update?.(true, { position: pos, worldOn: true }); } catch {}
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
  if (id === 'inventory') { showInvHint(); return inventoryLook() || berthLook(); }
  if (id === 'fish' || id === 'antiques' || id === 'market') {
    pinFor(id);
    const shot = shopLook(id) || berthLook();
    forceLoad(shot);
    return shot;
  }
  if (id === 'pumpfun') {
    pinFor(id);
    const shot = pumpfunLook();
    const pos = shot ? { x: shot.tx, z: shot.tz } : null;
    try { await Promise.resolve(ctx.pumpfun?.showAt?.(pos) || ctx.pumpfun?.update?.(true, pos, ctx.game?.t || 0)); } catch {}
    forceLoad(shot);
    return shot;
  }
  if (id === 'casino') {
    pinFor(id);
    const shot = casinoLook();
    forceLoad(shot);
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
  if (id === 'canoe') return startCanoeScript() || canoeLook();
  return berthLook();
}

function invApi() { try { return ctx.inventory?.() || ctx.inventory || null; } catch { return null; } }
function invHintLabel() {
  const h = harborTutInvHint(activeDevice());
  return `<kbd>${h.key}</kbd><span>${h.phrase}</span>`;
}
function placeInvHint() {
  const btn = $('tm-btn'); const hint = $('ht-inv-hint'); if (!btn || !hint) return;
  const r = btn.getBoundingClientRect();
  hint.style.left = r.left + 'px';
  hint.style.top = r.top + 'px';
  hint.style.width = r.width + 'px';
  hint.style.height = r.height + 'px';
}
function showInvHint() {
  hideInvHint();
  const btn = $('tm-btn');
  if (btn) { btn.style.display = 'block'; document.documentElement.classList.add('ht-show-inv'); }
  let hint = $('ht-inv-hint');
  if (!hint) {
    hint = document.createElement('div'); hint.id = 'ht-inv-hint';
    hint.innerHTML = `<div class="ht-inv-ring"></div><div class="ht-inv-label">${invHintLabel()}</div>`;
    document.body.appendChild(hint);
  } else {
    const lab = hint.querySelector('.ht-inv-label'); if (lab) lab.innerHTML = invHintLabel();
  }
  hint.style.display = 'block'; hint.style.opacity = '1';
  invHintOn = true;
  placeInvHint();
}
function hideInvHint() {
  invHintOn = false;
  document.documentElement.classList.remove('ht-show-inv');
  const hint = $('ht-inv-hint'); if (hint) hint.style.display = 'none';
}
function openInvPanel() {
  const iv = invApi();
  try { iv?.open?.('bag'); } catch {}
  invOpened = !!(iv?.isOpen);
  $('harbor-tut')?.classList.add('ht-with-inv');
  hideInvHint();
  if ($('tm-btn')) { $('tm-btn').style.display = 'block'; document.documentElement.classList.add('ht-show-inv'); }
}
function closeInvPanel() {
  const iv = invApi();
  try { if (iv?.isOpen) iv.close(); } catch {}
  invOpened = false;
  hideInvHint();
  $('harbor-tut')?.classList.remove('ht-with-inv');
  document.documentElement.classList.remove('ht-show-inv');
}
function tickInventoryShot() {
  if (!open) return;
  const id = steps()[step]?.id;
  if (id !== 'inventory') { if (invHintOn || invOpened) closeInvPanel(); return; }
  if (invHintOn) placeInvHint();
  if (phase === 'hold' && !invOpened && t >= INV_HINT_S) openInvPanel();
}

function canoeHarbor(lx, lz) { return townToH(lx, lz); }
function canoeFollowCam() {
  const c = ctx.canoe?.state; if (!c || (c.mode !== 'canoe' && c.mode !== 'beached')) return canoeLook();
  const x = c.mode === 'beached' ? c.bx : c.cx, z = c.mode === 'beached' ? c.bz : c.cz;
  const y = (c.y || 0) + 1.8;
  return lookAtPoint(x, y, z, 13, (c.cyaw || 0) + 0.45, 0.30);
}
function snapCanoe() {
  const s = playerShip(), d = ctx.docking;
  return {
    sx: s?.x, sz: s?.z, syaw: s?.yaw, anchor: !!s?.anchor,
    dockMode: d?.mode, berth: d?.berth || null,
  };
}
function startCanoeScript() {
  stopCanoeScript(false);
  const canoe = ctx.canoe, s = playerShip();
  if (!canoe?.tutDeploy || !s) return canoeLook();
  const [sx, sz] = canoeHarbor(CANOE_TOWN.ship.lx, CANOE_TOWN.ship.lz);
  const [hx, hz] = canoeHarbor(CANOE_TOWN.shore.lx, CANOE_TOWN.shore.lz);
  const yaw = t2wYaw(0);
  canoeSnap = snapCanoe();
  try { ctx.docking?.release?.(); } catch {}
  const ok = canoe.tutDeploy(s, ctx.docking, { x: sx, z: sz, yaw });
  if (!ok) { canoeSnap = null; return canoeLook(); }
  const st = canoe.state;
  const inland = t2wYaw(Math.PI);
  let land = null;
  try { land = canoe.findDry?.(hx, hz, inland, 30) || canoe.findDry?.(st.cx, st.cz, st.cyaw, 80); } catch {}
  const endX = land?.x ?? hx, endZ = land?.z ?? hz, endYaw = land?.yaw ?? inland;
  canoeRun = {
    phase: 'launch', t: 0,
    startX: st.cx, startZ: st.cz, startYaw: st.cyaw,
    shoreX: endX, shoreZ: endZ, shoreYaw: endYaw,
    dropped: false, relaunched: false, boarded: false,
  };
  return lookAtPoint((s.x + st.cx) / 2, (s.y || 0) + 3.2, (s.z + st.cz) / 2, 18, st.cyaw + 0.5, 0.32);
}
function canoePhaseDur(name) { return CANOE_TIMES[name] || 1; }
function lerp(a, b, u) { return a + (b - a) * u; }
function tickCanoeScript(dt) {
  const canoe = ctx.canoe, run = canoeRun, s = playerShip();
  if (!run || !canoe) return null;
  if (phase === 'fly') return to;
  run.t += dt;
  const dur = canoePhaseDur(run.phase);
  const u = Math.min(1, run.t / Math.max(0.01, dur));
  const easeU = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  const goNext = (name) => { run.phase = name; run.t = 0; };
  if (run.phase === 'launch') {
    if (u >= 1) goNext('toShore');
  } else if (run.phase === 'toShore') {
    const x = lerp(run.startX, run.shoreX, easeU), z = lerp(run.startZ, run.shoreZ, easeU);
    const yaw = Math.atan2(run.shoreX - run.startX, run.shoreZ - run.startZ);
    try { canoe.tutPlace(x, z, yaw, 5); } catch {}
    if (u >= 1) {
      try { canoe.tutBeach(run.shoreX, run.shoreZ, (run.shoreYaw ?? 0) + Math.PI); } catch {}
      goNext('drop');
    }
  } else if (run.phase === 'drop') {
    if (!run.dropped) {
      run.dropped = true;
      try { ctx.goAshoreQuiet?.(run.shoreX, run.shoreZ, run.shoreYaw); } catch {}
    }
    if (u >= 1) goNext('reboard');
  } else if (run.phase === 'reboard') {
    if (!run.relaunched && u >= 0.35) {
      run.relaunched = true;
      try { ctx.goAboardQuiet?.(); } catch {}
      try { canoe.tutRelaunch(); } catch {}
      const st = canoe.state;
      run.backX = st.cx; run.backZ = st.cz;
    }
    if (u >= 1) goNext('back');
  } else if (run.phase === 'back') {
    const st = canoe.state, ax = st.ax, az = st.az;
    const sx0 = run.backX ?? run.shoreX, sz0 = run.backZ ?? run.shoreZ;
    const x = lerp(sx0, ax, easeU), z = lerp(sz0, az, easeU);
    const yaw = Math.atan2(ax - sx0, az - sz0);
    try { canoe.tutPlace(x, z, yaw, 5); } catch {}
    if (u >= 1) {
      try { canoe.tutBoardShip(s); } catch {}
      run.boarded = true;
      goNext('aboard');
    }
  } else if (run.phase === 'aboard') {
    if (u >= 1) { stopCanoeScript(true); next(); return camNow(); }
  }
  const follow = (run.phase === 'aboard') ? (playerShip() ? lookAtPoint(playerShip().x, (playerShip().y || 0) + 3.4, playerShip().z, 16, (playerShip().yaw || 0) + 0.6, 0.3) : canoeFollowCam()) : canoeFollowCam();
  to = follow;
  return follow;
}
function stopCanoeScript(keepShip = false) {
  const canoe = ctx.canoe, s = playerShip();
  if (!canoeRun && !canoeSnap) return;
  try { ctx.goAboardQuiet?.(); } catch {}
  if (!keepShip) {
    try { canoe?.tutRestore?.(s, ctx.docking, canoeSnap, ctx.controls); } catch { try { canoe?.clearAll?.(s, null); } catch {} }
    try { if (ctx.controls) ctx.controls.enabled = false; } catch {}
  } else {
    try { canoe?.tutBoardShip?.(s); } catch {}
  }
  canoeRun = null;
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
  closeInvPanel();
  stopCanoeScript(false);
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
  const prev = list[step]?.id, nextId = list[i]?.id;
  if (prev === 'inventory' && nextId !== 'inventory') closeInvPanel();
  if (prev === 'canoe' && nextId !== 'canoe') stopCanoeScript(false);
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
  const id = steps()[step]?.id;
  const canoeLive = id === 'canoe' && canoeRun;
  const hold = reduced() ? 4 : (canoeLive ? CANOE_TOTAL : HOLD_S); const fly = reduced() ? 0.01 : flyDur;
  if (phase === 'fly') {
    t += dt; const u = Math.min(1, t / Math.max(0.01, fly));
    if (from && to) lerpCam(from, to, u);
    if ($('ht-bar')) $('ht-bar').style.width = '0%';
    if (u >= 1) { phase = 'hold'; t = 0; if (to) applyCam(to); }
  } else if (canoeLive) {
    t += dt;
    const shot = tickCanoeScript(dt);
    if (shot) applyCam(shot);
    if ($('ht-bar')) {
      const done = Object.entries(CANOE_TIMES).reduce((acc, [name, dur]) => {
        if (!canoeRun) return acc + dur;
        if (name === canoeRun.phase) return acc + Math.min(dur, canoeRun.t);
        const order = Object.keys(CANOE_TIMES);
        return acc + (order.indexOf(name) < order.indexOf(canoeRun.phase) ? dur : 0);
      }, 0);
      $('ht-bar').style.width = `${Math.min(100, (done / CANOE_TOTAL) * 100)}%`;
    }
  } else {
    t += dt; if ($('ht-bar')) $('ht-bar').style.width = `${Math.min(100, (t / hold) * 100)}%`;
    if (to) applyCam(to);
    tickInventoryShot();
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
      openInv: () => { showInvHint(); openInvPanel(); },
      showInvHint: () => showInvHint(),
      canoePhase: () => canoeRun?.phase || null,
      canoeTo: (name) => {
        if (!canoeRun) return;
        phase = 'hold';
        const order = Object.keys(CANOE_TIMES);
        const idx = order.indexOf(name);
        if (idx < 0) return;
        for (const n of order.slice(0, idx)) { canoeRun.phase = n; canoeRun.t = CANOE_TIMES[n]; tickCanoeScript(0); }
        canoeRun.phase = name; canoeRun.t = CANOE_TIMES[name] * 0.55; tickCanoeScript(0);
      },
      ids: HARBOR_TUT_IDS,
    };
  } catch {}
}
