// [Timothy] PUMPFUN PIRATES · MUSKET AIM (BANKSY 10:39 AM Nov 4: "in musket range improve the sight or ability to aim, give Fortnite no
// build controls like cod but 3rd person view"; 11:59 AM: "On pc make it point and click normal pc controls"). On wherever you shoulder
// a musket on foot (today: the MUSKET RANGE, js/onfoot/battle.js). &tps=0 = the old camera + aim (kill switch).
// PC (point and click): the normal on-foot camera (left-drag still turns it, wheel zooms), the mouse cursor stays free and IS the aim.
//  - a bloom reticle sits on the cursor (crosshair cursor + 4 ticks): it opens while you move / jump / just fired, tightens standing still.
//  - LEFT CLICK (a click, not a camera drag) or R fires at the cursor: a ray from the camera through the cursor finds the aim point
//    (target, pirate, cover, ground); the ball's line runs from you through it. Your pirate turns to face the aim point.
//  - hold RIGHT MOUSE = zoom 1.5x toward the cursor (the point under it stays put), tighter reticle, half speed, no sprint.
//  - no pointer lock: Esc pauses as usual, the emote wheel (T) clicks normally.
// PHONE (over the shoulder): camera over the RIGHT shoulder (⇄ swaps, pulled in before walls), centre crosshair with the same bloom,
//  drag the right side of the screen to look (the left keeps the stick), big AIM (1.5x) + FIRE, aim assist (look slows near a target),
//  AIM SENS slider in ⚙ SETTINGS (phones only: localStorage pfp_aim_sens, 20-300 %).
// Both: standing still or aiming the ball goes exactly where you aim; only the extra bloom from moving / jumping moves it. Hit = a hit
// marker (X) + the hit sound; each shot kicks (phone: the camera, PC: the reticle). Stats, reload, KOs and the boost rules are battle.js's,
// unchanged. Off in build mode, paused and on the leaderboard board; while knocked out it stays.
import * as THREE from 'three';
import { padActive } from '../gamepad.js'; // [Emerly gamepad] a pad on a PC aims like the phone: over the shoulder, centre crosshair, right stick looks
import { TPS, tpsOn, sensLoad, sensSave, spreadTarget, spreadReal, approach, aimDir, shoulderCam, yawTo, angleTo, raySphere, rayCyl, spreadPx, zoomWindow, clamp } from './tpsMath.js';

export const TPS_ON = tpsOn(typeof location !== 'undefined' ? location.search : '');

const CSS = `
#tps-x{position:fixed;left:50%;top:50%;width:0;height:0;z-index:8;pointer-events:none;display:none}
html.tps-on #tps-x{display:block}
#tps-x i{position:absolute;background:#fff;box-shadow:0 0 0 1px #161616,0 0 3px #000c;border-radius:1px}
#tps-x .d{width:4px;height:4px;left:-2px;top:-2px;border-radius:50%}
#tps-x .t,#tps-x .b{width:2px;height:10px;left:-1px}
#tps-x .l,#tps-x .r{width:10px;height:2px;top:-1px}
#tps-x.ads i{background:#ffcd77}
#tps-hm{position:fixed;left:50%;top:50%;width:0;height:0;z-index:9;pointer-events:none;opacity:0}
#tps-hm i{position:absolute;width:4px;height:15px;left:-2px;top:-7.5px;background:#fff;box-shadow:0 0 0 1.5px #161616,0 0 6px #000}
#tps-hm.ko i{background:#ff4a3d}
#tps-hm.on{animation:tpsHm .32s ease-out}
@keyframes tpsHm{0%{opacity:1;transform:scale(1.35)}60%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}
html.tps-on.tps-pc canvas{cursor:crosshair}
html.tps-pc #tps-x.off{display:none}
#tps-ads,#tps-sw{position:fixed;z-index:8;display:none;touch-action:none;font:24px 'Just Another Hand',cursive;letter-spacing:.04em;color:#161616;border:4px solid #161616;box-shadow:0 4px 10px rgba(0,0,0,.55);padding:4px 0 0}
#tps-ads{right:calc(var(--safe-r,0px) + 138px);bottom:calc(var(--safe-b,0px) + 34px);width:84px;height:84px;border-radius:50%;background:radial-gradient(#ffe2a8,#e0a84a)}
#tps-ads.on{background:radial-gradient(#fff,#ffcd77);transform:scale(.93)}
#tps-sw{right:calc(var(--safe-r,0px) + 154px);bottom:calc(var(--safe-b,0px) + 134px);width:54px;height:54px;border-radius:50%;background:rgba(255,205,119,.92);font-size:26px}
html.dk-touch.tps-on #tps-ads,html.dk-touch.tps-on #tps-sw{display:block}
html.dk-touch.tps-on #bt-atk{width:108px;height:108px;font-size:32px;right:calc(var(--safe-r,0px) + 18px);bottom:calc(var(--safe-b,0px) + 24px)}
`;
const hit3 = (o, d, c, r) => raySphere(o, d, c, r);

// opts: walker, camera, canvas, touch, world, sfx, attack() (battle.js: fires if loaded), aimables() -> { spheres: [[x, y, z, r, kind]], cyls: [[x, z, r, y0, y1, kind]] },
// pointers() -> [[x, y, z]] (aim-assist centres)
export function createTps({ walker, camera, canvas, touch, world, sfx, attack, aimables, pointers, farAimables = null }) { // [v347] farAimables() -> ships' cyls out to SHIP_RANGE
  const doc = document.documentElement, W = () => walker.w, pc = !touch, pcAim = () => pc && !st.pad; // [Emerly gamepad] pcAim: the cursor is the aim (PC without a pad in use)
  const st = { on: false, ads: 0, adsHeld: false, side: 1, sideK: 1, pitch: 0, kick: 0, spread: TPS.spread.hip, fired: -9, sens: sensLoad(globalThis.localStorage), look: null, camOk: false,
    mx: -1, my: -1, over: false, anchor: null, click: null, aim: null, pad: false };
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = (tag, id, html = '') => { const e = document.createElement(tag); e.id = id; e.innerHTML = html; document.body.appendChild(e); return e; };
  const xh = el('div', 'tps-x', '<i class="d"></i><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i>'), hm = el('div', 'tps-hm', '<i></i><i></i><i></i><i></i>');
  const adsB = el('button', 'tps-ads', 'AIM'), swB = el('button', 'tps-sw', '⇄');
  adsB.type = swB.type = 'button';
  { const [a, b, c, d] = hm.querySelectorAll('i'); a.style.transform = 'rotate(45deg) translateY(-17px)'; b.style.transform = 'rotate(135deg) translateY(-17px)'; c.style.transform = 'rotate(225deg) translateY(-17px)'; d.style.transform = 'rotate(315deg) translateY(-17px)'; }
  const parts = Object.fromEntries([...xh.querySelectorAll('i')].map(i => [i.className, i]));
  const swap = () => { st.side = -st.side; };
  // ---------- phone input ----------
  const stopBtn = (b, down, up) => { b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch {} down(); });
    if (up) for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up); };
  stopBtn(adsB, () => { st.adsHeld = true; adsB.classList.add('on'); }, () => { st.adsHeld = false; adsB.classList.remove('on'); });
  stopBtn(swB, swap);
  // look: a touch on the right side (runs before the walker's own drag look); aim assist slows it near a target / pirate
  function look(dx, dy, k) { const w = W(); let a = k * st.sens * (st.ads > 0.5 ? TPS.adsSens : 1);
    const o = camera.position.toArray(), d = aimDir(w.camYaw, st.pitch + st.kick); if (pointers().some(p => angleTo(o, d, p) < TPS.assist.cone)) a *= TPS.assist.k;
    w.camYaw -= dx * a; st.pitch = clamp(st.pitch - dy * a, TPS.pitch[0], TPS.pitch[1]); w.look = performance.now(); }
  if (touch) {
    addEventListener('pointerdown', (e) => { if (!st.on || e.target !== canvas || e.pointerType === 'mouse') return;
      if (e.clientX > innerWidth * 0.4 && !st.look) { e.stopImmediatePropagation(); st.look = { id: e.pointerId, x: e.clientX, y: e.clientY }; } }, true);
    addEventListener('pointermove', (e) => { const L = st.look; if (!st.on || !L || L.id !== e.pointerId) return; look(e.clientX - L.x, e.clientY - L.y, TPS.sensTouch); L.x = e.clientX; L.y = e.clientY; }, true);
    const lookEnd = (e) => { if (st.look?.id === e.pointerId) st.look = null; }; addEventListener('pointerup', lookEnd, true); addEventListener('pointercancel', lookEnd, true);
    // ⚙ SETTINGS: AIM SENS (phones only: the PC has no mouse-look to tune) next to the volume sliders
    const box = document.querySelector('#pause .vol-box'); if (box) { const lab = document.createElement('label'); lab.innerHTML = '<span class="label">AIM SENS</span><input type="range" id="aim-sens" min="20" max="300" step="5" aria-label="Musket aim sensitivity">';
      box.appendChild(lab); const inp = lab.querySelector('input'); inp.value = Math.round(st.sens * 100); inp.addEventListener('input', () => { st.sens = sensSave(globalThis.localStorage, +inp.value / 100); }); }
  }
  // ---------- PC input: the cursor is the aim ----------
  if (pc) {
    addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; st.mx = e.clientX; st.my = e.clientY; st.over = e.target === canvas; if (!(e.buttons & 2) && !st.pad) st.adsHeld = false; }, true);
    // left: a click (not a camera drag) fires at the cursor. mousedown / up, not pointer events: with the right button already held for the
    // zoom the browser sends no 2nd pointerdown. The walker keeps its left-drag camera turn.
    addEventListener('mousedown', (e) => { if (!st.on || e.target !== canvas) return;
      if (e.button === 0) st.click = { x: e.clientX, y: e.clientY };
      else if (e.button === 2) { st.adsHeld = true; st.anchor = [e.clientX, e.clientY]; e.preventDefault(); } }, true);
    addEventListener('mouseup', (e) => { if (e.button === 2 || !(e.buttons & 2)) st.adsHeld = false;
      if (e.button === 0 && st.click) { const c = st.click; st.click = null; if (st.on && Math.hypot(e.clientX - c.x, e.clientY - c.y) < 6) { st.mx = e.clientX; st.my = e.clientY; attack(); } } }, true);
  }
  // the synthetic MouseR key (js/keybinds.js mouse binds = starboard broadside) never reaches the ship while you hold a musket
  addEventListener('keydown', (e) => { if (st.on && e.code === 'MouseR') { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  addEventListener('keyup', (e) => { if (st.on && e.code === 'MouseR') { e.stopImmediatePropagation(); if (pc) st.adsHeld = false; } }, true);
  addEventListener('blur', () => { st.adsHeld = false; st.click = null; });
  // ---------- PC: ray through the cursor, zoom toward it (camera view offset: the point under the anchor stays put) ----------
  const _v = new THREE.Vector3();
  function cursorRay() { const r = canvas.getBoundingClientRect(), mx = st.mx < 0 ? r.left + r.width / 2 : st.mx, my = st.my < 0 ? r.top + r.height / 2 : st.my;
    let u = (mx - r.left) / r.width, v = (my - r.top) / r.height; const V = camera.view;
    if (V?.enabled) { u = (u * V.fullWidth - V.offsetX) / V.width; v = (v * V.fullHeight - V.offsetY) / V.height; } // zoomed: the view is a window of the full frame
    camera.updateMatrixWorld(); _v.set(u * 2 - 1, 1 - v * 2, 0.5).unproject(camera).sub(camera.position).normalize(); return [_v.x, _v.y, _v.z]; }
  let viewSet = false;
  function zoomView() { const z = 1 + (TPS.zoom * ((typeof window !== 'undefined' && window.PFP_GUN_ACC?.scope) ? 1.15 : 1) - 1) * st.ads; // [Emerly gunacc] scope: +15% aim zoom
    if (z < 1.002) { if (viewSet) { camera.clearViewOffset(); viewSet = false; } return; }
    const h = canvas.clientHeight || innerHeight, w = h * camera.aspect, r = canvas.getBoundingClientRect(), a = st.anchor || [r.left + r.width / 2, r.top + r.height / 2];
    const ax = (a[0] - r.left) / r.width * w, ay = (a[1] - r.top) / r.height * h;
    camera.setViewOffset(w, h, ...zoomWindow(ax, ay, w, h, z)); viewSet = true; }
  // ---------- phone camera (walker.w.camHook: called by the walker instead of its own orbit camera) ----------
  function camHook(dt) { const w = W(), p = st.pitch + st.kick;
    st.sideK = approach(st.sideK, st.side, 10, dt);
    const want = shoulderCam(w.x, w.y, w.z, w.camYaw, p, st.sideK, st.ads), hx = w.x, hy = w.y + TPS.head, hz = w.z;
    // pull in in front of walls (world.blocked) + ground / cliffs between your head and the camera
    let cut = 1; const N = 12; for (let i = 1; i <= N; i++) { const t = i / N, x = hx + (want[0] - hx) * t, y = hy + (want[1] - hy) * t, z = hz + (want[2] - hz) * t, px = hx + (want[0] - hx) * (t - 1 / N), pz = hz + (want[2] - hz) * (t - 1 / N);
      if (world.ground(x, z) + 0.25 > y || (t > 0.2 && world.blocked(x, z, px, pz))) { cut = Math.max(0.12, t - 1.5 / N); break; } }
    const c = [hx + (want[0] - hx) * cut, hy + (want[1] - hy) * cut, hz + (want[2] - hz) * cut];
    if (!st.camOk) { camera.position.set(...c); st.camOk = true; } else camera.position.lerp({ x: c[0], y: c[1], z: c[2] }, Math.min(1, dt * 22));
    const d = aimDir(w.camYaw, p); camera.lookAt(camera.position.x + d[0], camera.position.y + d[1], camera.position.z + d[2]);
    const z = 1 + (TPS.zoom - 1) * st.ads; if (Math.abs(camera.zoom - z) > 1e-4) { camera.zoom = z; camera.updateProjectionMatrix(); } }
  // ---------- aiming ----------
  // the aim point (+ the real part of the bloom): first target / pirate / cover / ground along the ray (PC: through the cursor, phone: the centre)
  function aimPoint(bloom = true) { const w = W(), o = camera.position.toArray(); let d = pcAim() ? cursorRay() : aimDir(w.camYaw, st.pitch + st.kick);
    const dev = bloom ? spreadReal(st.spread, st.ads) * Math.PI / 180 : 0;
    if (dev > 0) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * dev, y0 = Math.atan2(d[0], d[2]), p0 = Math.asin(clamp(d[1], -1, 1)); d = aimDir(y0 + Math.cos(a) * r, p0 + Math.sin(a) * r); }
    let best = TPS.range + 8, kind = null; const A = aimables();
    for (const s of A.spheres) { const t = hit3(o, d, s, s[3]); if (t > 0.5 && t < best) { best = t; kind = s[4]; } }
    for (const c of A.cyls) { const t = rayCyl(o, d, c[0], c[1], c[2], c[3], c[4]); if (t > 0.5 && t < best) { best = t; kind = c[5]; } }
    for (let t = 1; t < best; t += 0.7) { if (o[1] + d[1] * t < world.ground(o[0] + d[0] * t, o[2] + d[2] * t)) { best = Math.max(0.5, t - 0.35); kind = 'ground'; break; } }
    if (!kind && farAimables) { const F = farAimables(); let fb = 1e9, fk = null; // [v347] t1821u: nothing near -> a ship out over the water (captain / hull), unless the hill is in the way
      for (const c of F.cyls) { const t = rayCyl(o, d, c[0], c[1], c[2], c[3], c[4]); if (t > best - 8 && t < fb) { fb = t; fk = c[5]; } }
      if (fk) { let clear = true; for (let t = best; t < fb; t += 2) if (o[1] + d[1] * t < world.ground(o[0] + d[0] * t, o[2] + d[2] * t) - 0.2) { clear = false; break; } if (clear) { best = fb; kind = fk; } } }
    return { p: [o[0] + d[0] * best, o[1] + d[1] * best, o[2] + d[2] * best], kind, t: best }; }
  // battle.js shoot(): the yaw your ball flies along (from your feet x, z through the aim point) + the aim point for the tracer
  function shotYaw(x, z) { const a = aimPoint(true); st.lastAim = a; const dx = a.p[0] - x, dz = a.p[2] - z;
    if (Math.hypot(dx, dz) < 1.2) { const w = W(); return { yaw: pcAim() ? w.yaw : w.camYaw, aim: null }; } return { yaw: yawTo(x, z, a.p[0], a.p[2]), aim: a.p }; }
  function onShot(hit) { st.fired = performance.now(); if (!pcAim()) st.kick += TPS.recoil.kick * (st.ads > 0.5 ? 0.6 : 1); st.spread += TPS.spread.kick * (st.ads > 0.5 ? 0.5 : 1);
    if (pcAim()) { hm.style.left = st.mx + 'px'; hm.style.top = st.my + 'px'; } else hm.style.left = hm.style.top = '';
    if (hit && (hit.kind === 'target' || hit.kind === 'pirate' || hit.kind === 'captain' || hit.kind === 'ship')) { /* [v347] + a ship / its captain */ hm.classList.toggle('ko', hit.kind === 'pirate' && (hit.r?.hpShown ?? 100) <= 0); hm.classList.remove('on'); void hm.offsetWidth; hm.classList.add('on'); if (hit.kind === 'target') sfx?.hit?.(0.55); } } // a pirate hit already plays battle.js's hit sound
  // ---------- per frame (battle.tick) ----------
  function set(v) { if (v === st.on) return; st.on = v; doc.classList.toggle('tps-on', v); doc.classList.toggle('tps-pc', v && pcAim()); const w = W();
    if (v) { st.pitch = 0.04; st.kick = 0; st.ads = 0; st.camOk = false; st.side = st.sideK = 1; if (!pcAim()) w.camHook = camHook; }
    else { w.camHook = null; w.moveK = undefined; w.faceYaw = undefined; st.adsHeld = false; st.ads = 0; st.look = null; st.click = null; adsB.classList.remove('on');
      if (camera.zoom !== 1) { camera.zoom = 1; camera.updateProjectionMatrix(); } if (viewSet) { camera.clearViewOffset(); viewSet = false; } } }
  const blocked = () => { const pz = document.getElementById('pause'); return (!!pz && !pz.classList.contains('hidden')) || doc.classList.contains('pfp-tedit') || doc.classList.contains('dk-board'); };
  { const mo = new MutationObserver(() => { if (st.on && blocked()) set(false); }); mo.observe(doc, { attributes: true, attributeFilter: ['class'] }); const pz = document.getElementById('pause'); if (pz) mo.observe(pz, { attributes: true, attributeFilter: ['class'] }); }
  // [Emerly gamepad] PC: picking up / putting down a pad mid-range swaps the PC cursor aim <-> the phone shoulder camera
  function padSwitch() { const p = pc && padActive(); if (p === st.pad) return; st.pad = p; if (!st.on) return; const w = W();
    doc.classList.toggle('tps-pc', !p); xh.style.left = xh.style.top = ''; xh.classList.remove('off'); st.anchor = null; if (!p) st.adsHeld = false;
    if (viewSet) { camera.clearViewOffset(); viewSet = false; } if (camera.zoom !== 1) { camera.zoom = 1; camera.updateProjectionMatrix(); }
    if (p) { st.pitch = 0.04; st.camOk = false; w.camYaw = w.yaw; w.camHook = camHook; } else { w.camHook = null; w.faceYaw = undefined; } }
  function tick(dt, want) { 
    padSwitch(); set(!!want && !blocked() && walker.active); if (!st.on) return; const w = W(), now = performance.now();
    st.ads = approach(st.ads, st.adsHeld ? 1 : 0, 12, dt); st.kick = approach(st.kick, 0, TPS.recoil.rec, dt);
    st.spread = approach(st.spread, spreadTarget({ speed: w.speed, air: w.air, ads: st.ads }), TPS.spread.rec, dt);
    w.moveK = st.ads > 0.3 ? TPS.adsMove : undefined; // the walker: half speed + no sprint
    let zoom = camera.zoom;
    if (pcAim()) { zoomView(); zoom = 1 + (TPS.zoom - 1) * st.ads;
      // your pirate faces the point under the cursor
      const a = aimPoint(false); st.aim = a; const dx = a.p[0] - w.x, dz = a.p[2] - w.z; w.faceYaw = Math.hypot(dx, dz) > 1.2 ? yawTo(w.x, w.z, a.p[0], a.p[2]) : undefined;
      xh.style.left = (st.mx < 0 ? innerWidth / 2 : st.mx) + 'px'; xh.style.top = (st.my < 0 ? innerHeight / 2 : st.my) + 'px'; xh.classList.toggle('off', st.mx >= 0 && !st.over); }
    else { w.look = now; w.faceYaw = st.ads > 0.3 || now - st.fired < 700 ? w.camYaw : undefined; } // phone: no auto-drift while you aim; aiming / just fired = face the crosshair
    const g = spreadPx(st.spread, camera.fov, zoom, innerHeight) + 3; parts.t.style.top = (-g - 10) + 'px'; parts.b.style.top = g + 'px'; parts.l.style.left = (-g - 10) + 'px'; parts.r.style.left = g + 'px';
    xh.classList.toggle('ads', st.ads > 0.5); }
  return { tick, shotYaw, onShot, aimPoint, swap, off: () => set(false), st, get on() { return st.on; }, pc,
    padLook: (dx, dy) => { if (st.on && !pcAim()) look(dx, dy, TPS.sensTouch); } }; // [Emerly gamepad] right stick (virtual px): AIM SENS + aim assist apply
}
