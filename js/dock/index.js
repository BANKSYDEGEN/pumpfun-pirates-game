// [Emerly] PUMPFUN PIRATES docking + on-foot controller (harbor only; Waves, the arena and spectate never load or run it).
// Layout-driven (js/dock/layout.js): berths, SAFE HARBOR zone, decks, interact points, ship colliders, walkable land.
// main.js talks to it through a handful of one-line hooks (see EMERLY-HOOKS in the report): ship(dt), camera(dt), focus(),
// canFire(s), invuln(s), isSafe(s), aiSteer(e, desired), and pvp.js (harbor room) through netState() / onPeerState(m).
import * as THREE from 'three';
import { coastLayout } from './layout.js';
import { buildWorld, colliderSets } from './world.js';
import { createSafeZone } from './safe.js';
import { createDocking } from './docking.js';
import { createWalker } from '../onfoot/walker.js';
import { loadPirate } from '../onfoot/pirate.js';
import { createFootNet } from '../onfoot/net.js';

const CSS = `
#dk-safe{position:fixed;left:50%;top:calc(var(--safe-t,0px) + 54px);transform:translateX(-50%);z-index:7;pointer-events:none;font:22px 'Just Another Hand',cursive;letter-spacing:.06em;color:#7cff6b;background:rgba(22,22,22,.72);border:2px solid #7cff6b;border-radius:999px;padding:2px 14px 0;white-space:nowrap;display:none}
#dk-safe.grace{color:#ffcd77;border-color:#ffcd77}
#dk-acts{position:fixed;left:50%;bottom:calc(var(--safe-b,0px) + 168px);transform:translateX(-50%);z-index:8;display:none;gap:10px;align-items:center;pointer-events:none}
#dk-acts button[hidden]{display:none!important}
#dk-acts button{pointer-events:auto;font:26px 'Just Another Hand',cursive;letter-spacing:.05em;line-height:1;padding:10px 20px 7px;border-radius:14px;border:3px solid #ffcd77;background:rgba(22,22,22,.86);color:#ffcd77;cursor:pointer;white-space:nowrap;touch-action:none}
#dk-acts button.primary{background:#fa0d0d;color:#fff;border-color:#ffcd77}
#dk-acts button[disabled]{opacity:.75;background:rgba(22,22,22,.86);color:#ddd;border-color:#888}
#dk-acts kbd{font:16px system-ui,sans-serif;background:#ffcd77;color:#161616;border-radius:5px;padding:1px 6px;margin-right:8px;vertical-align:3px}
html.dk-touch #dk-acts kbd{display:none}
html.pfp-onfoot #controls,html.pfp-onfoot #hint,html.pfp-onfoot #pvp-harbor,html.pfp-onfoot .ehp,html.pfp-onfoot #pvp-boss-bar{display:none!important}
html.pfp-onfoot.dk-board #pvp-harbor{display:flex!important}
#dk-board-x{position:fixed;right:14px;top:calc(var(--safe-t,0px) + 54px);z-index:9;display:none;font:22px 'Just Another Hand',cursive;padding:6px 14px 3px;border-radius:12px;border:2px solid #ffcd77;background:rgba(22,22,22,.86);color:#ffcd77}
html.dk-board #dk-board-x{display:block}
#dk-joy{position:fixed;left:calc(var(--safe-l,0px) + 22px);bottom:calc(var(--safe-b,0px) + 22px);width:132px;height:132px;border-radius:50%;background:rgba(22,22,22,.35);border:3px solid rgba(255,205,119,.65);z-index:8;display:none;touch-action:none}
#dk-joy i{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(255,205,119,.9);box-shadow:0 2px 6px #000}
html.pfp-onfoot.dk-touch #dk-joy{display:block}
html.dk-touch.pfp-onfoot #dk-acts{left:auto;right:calc(var(--safe-r,0px) + 22px);bottom:calc(var(--safe-b,0px) + 40px);transform:none;flex-direction:column;align-items:flex-end}
html.dk-touch.pfp-onfoot #dk-acts button{font-size:24px;padding:14px 18px 10px}
#dk-fade{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:30;transition:opacity .28s}
#dk-toast{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:9;pointer-events:none;font:30px 'Just Another Hand',cursive;color:#fff;text-shadow:0 2px 4px #000;opacity:0;transition:opacity .3s;text-align:center}
@media (max-height:480px){#dk-acts{bottom:calc(var(--safe-b,0px) + 104px)} #dk-acts button{font-size:22px;padding:8px 14px 5px} #dk-safe{top:calc(var(--safe-t,0px) + 46px);font-size:18px}}
@media (max-width:600px){#dk-acts{bottom:calc(var(--safe-b,0px) + 200px)} #dk-safe{top:calc(var(--safe-t,0px) + 112px);font-size:18px}}
`;

export async function createDock(ctx) {
  const { scene, camera, controls, renderer, ocean, islands, game, quality, canvas } = ctx;
  const LOW = quality === 'low', $ = (id) => document.getElementById(id);
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const layout = await coastLayout();
  const uTime = { value: 0 };
  const world = await buildWorld({ layout, scene, quality, ocean, renderer, uTime });
  const zone = createSafeZone(layout.safe, layout.graceS);
  const myId = () => ctx.pvp()?.myId || 'me';
  const docking = createDocking({ berths: layout.berths, myId: myId() });
  const pirate = loadPirate({ look: ctx.look?.() || { skin: 0, hair: 0 }, low: LOW }); pirate.object.visible = false; scene.add(pirate.object);
  const walker = createWalker({ camera, canvas, world, pirate, touch });
  const fnet = createFootNet({ scene, low: LOW, world, docking });
  const sets = colliderSets(layout.shipCircles);
  const NO_TARGET = { x: 0, z: 0, alive: false, yaw: 0, speed: 0 };

  // ---------- UI ----------
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  if (touch) document.documentElement.classList.add('dk-touch');
  const el = (tag, id, html = '') => { const e = document.createElement(tag); e.id = id; e.innerHTML = html; document.body.appendChild(e); return e; };
  const safeTag = el('div', 'dk-safe', '⚓ SAFE HARBOR'), acts = el('div', 'dk-acts'), fade = el('div', 'dk-fade'), toastEl = el('div', 'dk-toast');
  const joy = el('div', 'dk-joy', '<i></i>'), boardX = el('button', 'dk-board-x', '✕ BACK');
  const bA = document.createElement('button'), bB = document.createElement('button'); acts.append(bA, bB);
  let actA = null, actB = null, uiSig = '';
  function setActs(a, b) { // a / b: { label, key, fn, primary, disabled } | null
    actA = a; actB = b; const sig = JSON.stringify([a && [a.label, a.key, a.disabled, a.primary], b && [b.label, b.key]]); if (sig === uiSig) return; uiSig = sig;
    acts.style.display = a || b ? 'flex' : 'none';
    for (const [btn, s] of [[bA, a], [bB, b]]) { btn.hidden = !s; if (!s) continue; btn.innerHTML = (s.key && !touch ? `<kbd>${s.key}</kbd>` : '') + s.label; btn.disabled = !!s.disabled; btn.classList.toggle('primary', !!s.primary); }
  }
  const press = (s) => { if (s && !s.disabled) s.fn(); };
  for (const [btn, get] of [[bA, () => actA], [bB, () => actB]]) btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); press(get()); });
  let toastT = 0; function toast(t, ms = 1600) { toastEl.innerHTML = t; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = 0; }, ms); }
  const fadeTo = (fn) => { fade.style.opacity = 1; setTimeout(() => { fn(); setTimeout(() => { fade.style.opacity = 0; }, 60); }, 280); };
  // joystick
  { let id = null, cx = 0, cy = 0; const knob = joy.querySelector('i'), R = 52;
    joy.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); id = e.pointerId; const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; walker.w.joy.on = true; mv(e); try { joy.setPointerCapture(e.pointerId); } catch {} });
    const mv = (e) => { if (e.pointerId !== id) return; let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; walker.w.joy.x = dx / R; walker.w.joy.y = dy / R; };
    joy.addEventListener('pointermove', mv);
    const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; walker.w.joy.on = false; walker.w.joy.x = walker.w.joy.y = 0; };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end); joy.addEventListener('lostpointercapture', end); }
  boardX.onclick = (e) => { e.stopPropagation(); closeBoard(); };
  function openBoard() { document.documentElement.classList.add('dk-board'); ctx.pvp()?.harborUi?.(); }
  function closeBoard() { document.documentElement.classList.remove('dk-board'); }

  // ---------- state ----------
  let on = false, onFoot = false, lastShot = 0, leftAt = -99;
  const P = () => ctx.getPlayer();
  const inHarbor = () => game.mode === 'pvp' && !!ctx.pvp() && ctx.pvp().where === 'harbor' && !ctx.pvp().spectating && ['playing', 'paused', 'shop'].includes(game.state);
  function setOn(v) {
    if (v === on) return; on = v; world.root.visible = v;
    islands.setHarbor(v ? { clearR: 470, islets: ctx.islets, island: sets } : null);
    if (!v) { if (onFoot) goAboard(true); docking.release(); fnet.clear(); safeTag.style.display = 'none'; setActs(null, null); closeBoard(); }
  }
  // ---------- actions ----------
  function dockNow(b) { const s = P(); docking.begin(s, b); ctx.sfx?.coin?.(); toast(`MOORING AT BERTH ${b.id}`); }
  function goAshore() {
    if (docking.mode !== 'docked') return; const b = docking.berth;
    fadeTo(() => { onFoot = true; controls.enabled = false; document.documentElement.classList.add('pfp-onfoot');
      walker.enter(b.ashore.x, b.ashore.z, b.out ? Math.atan2(-b.out.x, -b.out.z) : b.yaw + Math.PI); }); // face inland
  }
  function goAboard(instant = false) {
    const fin = () => { onFoot = false; walker.exit(); closeBoard(); document.documentElement.classList.remove('pfp-onfoot'); controls.enabled = true; ctx.camReset(); };
    if (instant) fin(); else fadeTo(fin);
  }
  function setSail() { if (docking.setSail(P())) { const s = P(); s.anchor = false; s.sail = 1; toast('SET SAIL!'); } }
  function interact(q) {
    const pv = ctx.pvp(), t = game.t;
    switch (q.kind) {
      case 'waves': goAboard(true); ctx.openWaves(); break;
      case 'arena': openBoard(); break;
      case 'squadhall': if (pv?.lob?.state === 'harbor' && pv.mode !== 'squads') pv.setMode?.('squads'); openBoard(); break;
      case 'spyglass': goAboard(true); pv?.harborSpectate?.(); break;
      case 'shop': if (window.openShop) window.openShop({ from: 'island' }); else toast('THE SHOP OPENS SOON<br><small>skins + pirate gear for gold</small>', 2200); break;
      case 'tavern': toast('THE TAVERN<br><small>daily claim moves here soon</small>', 2200); break;
      case 'bounties': toast('BOUNTY BOARD<br><small>bounties coming soon</small>', 2200); break;
      case 'stall': case 'market': toast(q.label + '<br><small>opens soon</small>', 2000); break;
      case 'exchange': toast('TOKEN EXCHANGE<br><small>opens soon</small>', 2000); break;
      case 'dig': case 'cave': world.activate(q, t); break;
      default: toast(q.label);
    }
  }
  // capture-phase keys: E = the main prompt, W = SET SAIL while moored; on foot the walker eats movement / fire keys
  const onKeyDown = (e) => {
    if (!on || e.target?.tagName === 'INPUT') return;
    if (e.code === 'Escape' && document.documentElement.classList.contains('dk-board')) { closeBoard(); e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (game.state !== 'playing') return;
    let used = false;
    if (e.code === 'KeyE' && !e.repeat) { if (actA && actA.key === 'E') { press(actA); used = true; } else if (onFoot) used = true; }
    else if ((e.code === 'KeyW' || e.code === 'ArrowUp') && !onFoot && docking.mode === 'docked') { setSail(); used = true; }
    else if (onFoot && walker.onKey(e, true)) used = true;
    else if (!onFoot && docking.mode !== 'sea' && ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'KeyS', 'ArrowDown', 'Space'].includes(e.code)) used = true; // moored / easing: no helm
    if (used) { e.stopImmediatePropagation(); e.preventDefault(); }
  };
  const onKeyUp = (e) => { if (on && onFoot) walker.onKey(e, false); };
  addEventListener('keydown', onKeyDown, true); addEventListener('keyup', onKeyUp, true);

  // ---------- per frame (main.js: after pvp.update, before floatShip) ----------
  function ship(dt) {
    const want = inHarbor() || (on && game.mode === 'pvp' && ctx.pvp()?.where === 'harbor' && game.state !== 'title'); setOn(want);
    if (!on) return;
    const s = P(), now = game.t; uTime.value = now;
    if (!s.alive) { if (docking.mode !== 'sea') docking.release(); if (onFoot) goAboard(true); }
    const r = docking.tick(s, dt);
    if (r === 'docked') toast('MOORED · SAFE HARBOR');
    if (r === 'free') { s.anchor = false; s.sail = Math.max(1, s.sail); leftAt = now; }
    zone.tick(s, now);
    // HUD tag
    const g = zone.graceLeft(s, now);
    if (onFoot) safeTag.style.display = 'none'; // BANKSY: no SAFE HARBOR tag while walking the island
    else if (s._safe) { safeTag.style.display = 'block'; safeTag.className = ''; safeTag.textContent = '⚓ SAFE HARBOR'; }
    else if (g > 0) { safeTag.style.display = 'block'; safeTag.className = 'grace'; safeTag.textContent = `NO FIRING · ${Math.ceil(g)}`; }
    else safeTag.style.display = 'none';
    // prompts
    if (onFoot) {
      walker.update(dt);
      const W = walker.w, b = docking.berth;
      let best = null, bd = 1e9;
      if (b && Math.hypot(W.x - b.ashore.x, W.z - b.ashore.z) < 4) best = { label: 'BOARD SHIP', fn: () => goAboard() };
      if (!best) for (const q of [...layout.interact, ...world.footInteract]) { if (q.used) continue; const d = Math.hypot(q.x - W.x, q.z - W.z); if (d < (q.r || 3) && d < bd) { bd = d; best = { label: q.label, fn: () => interact(q) }; } }
      setActs(best ? { ...best, key: 'E', primary: true } : null, null);
    } else if (docking.mode === 'docked') setActs({ label: 'GO ASHORE', key: 'E', primary: true, fn: goAshore }, { label: 'SET SAIL', key: 'W', fn: setSail });
    else if (docking.mode === 'sea' && s.alive && game.state === 'playing') {
      const q = now - leftAt > 5 ? docking.query(s) : null; // no DOCK prompt for 5 s after SET SAIL
      if (!q) setActs(null, null);
      else if (q.reason === 'fast') setActs({ label: 'SLOW DOWN TO DOCK', disabled: true }, null);
      else if (q.reason === 'full') setActs({ label: 'ALL BERTHS TAKEN', disabled: true }, null);
      else if (q.reason === 'taken') setActs({ label: 'BERTH TAKEN', disabled: true }, null);
      else setActs({ label: '⚓ DOCK', key: 'E', primary: true, fn: () => dockNow(q.berth) }, null);
    } else setActs(null, null);
    fnet.tick(dt);
    if (bcLink) bcLink.tick();
  }
  // camera: true = we drove it this frame (main.js skips its ship camera)
  function cameraHook() { if (!on) return false; world.update(camera.position, game.t); return onFoot; }

  // ---------- test transport (?harborbc=1): two tabs share a BroadcastChannel as their "harbor room" ----------
  let bcLink = null;
  if (new URLSearchParams(location.search).has('harborbc')) {
    const ch = new BroadcastChannel('pfp-harbor-test'); let last = 0;
    ch.onmessage = (ev) => { if (on) handlePeer(ev.data); };
    bcLink = { tick() { const now = performance.now(); if (now - last < 250) return; last = now; ch.postMessage({ i: myId(), n: ctx.pvp()?.name || 'PIRATE', ...fnet.netState(walker) }); } };
  }
  function handlePeer(m) { const r = fnet.onPeerState(m); if (r && r.moved !== undefined) { if (r.moved) { dockNow(r.moved); toast(`BERTH TAKEN · MOVING TO ${r.moved.id}`); } else { docking.release(); toast('NO FREE BERTH'); } } }

  const api = {
    layout, world, zone, docking, walker, fnet, NO_TARGET,
    get on() { return on; }, get onFoot() { return onFoot; },
    ship, camera: cameraHook,
    focus: () => (on && onFoot ? walker.w : null),
    canFire(s) { if (!on) return true; const ok = zone.canFire(s, game.t);
      if (!ok && s === P() && !onFoot && performance.now() - lastShot > 1200) { lastShot = performance.now(); toast(zone.inside(s.x, s.z) ? 'SAFE HARBOR · NO FIRING' : 'NO FIRING · JUST LEFT SAFE HARBOR', 1200); }
      return ok; },
    invuln: (s) => on && zone.inside(s.x, s.z),
    isSafe: (s) => on && !!s && zone.inside(s.x, s.z),
    aiSteer: (e, desired) => on ? zone.steer(e, desired) : desired,
    netState: () => (on ? fnet.netState(walker) : {}),
    onPeerState: (m) => { if (on) handlePeer(m); },
    dockAt: (id) => { const b = layout.berths.find(q => q.id === id); if (b) dockNow(b); }, goAshore, goAboard, setSail, interact, openBoard, closeBoard,
    stats: () => ({ ...world.stats, berths: layout.berths.length, shipCircles: layout.shipCircles.length, sets: sets.length }),
  };
  return api;
}
