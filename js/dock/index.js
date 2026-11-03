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
import { getLocalGear, gearToWire } from '../pirateGear.js';
import { loadPirate } from '../onfoot/pirate.js';
import { createFootNet } from '../onfoot/net.js';
import { createFollowers } from '../onfoot/followers.js'; // [v106] 3 crew follow you ashore (2 on Low)
import { binds, keyName, isKey } from '../keybinds.js';
import { createIslandMap } from '../islandMap.js';
import { createTreasure } from './treasure.js'; // [v122] treasure maps: MAPS list, radar dig area, server digs
import { createPlaza } from './plaza.js'; // [v103] live leaderboards + token billboards on the harbor plaza
import { createBattery } from './battery.js'; // [Timothy] headland battery: playable cosmetic guns
import { createBattle } from '../onfoot/battle.js'; // [Timothy] battle areas: SWORD PIT + MUSKET RANGE (cosmetic, no rewards)

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
#dk-jump{position:fixed;left:calc(var(--safe-l,0px) + 168px);bottom:calc(var(--safe-b,0px) + 26px);width:70px;height:70px;border-radius:50%;display:none;z-index:8;font:24px 'Just Another Hand',cursive;color:#161616;background:rgba(255,205,119,.92);border:3px solid #161616;box-shadow:0 3px 8px rgba(0,0,0,.5);touch-action:none;padding:4px 0 0}
#dk-jump:active{transform:scale(.92)}
html.pfp-onfoot.dk-touch #dk-jump{display:block}
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
  const docking = createDocking({ berths: layout.berths, myId }); // [v152] a getter: the room id can arrive later
  const pirate = loadPirate({ look: ctx.look?.() || { skin: 0, hair: 0 }, low: LOW, gear: getLocalGear(), local: true }); pirate.object.visible = false; scene.add(pirate.object); // [Timothy] + your shop gear
  const walker = createWalker({ camera, canvas, world, pirate, touch, low: LOW });
  // [v102] your equipped pirate gear (js/pvp.js 'pfp-gear'): drawn by window.applyPirateGear (Timothy's gear meshes; a no-op until then)
  // [v105] setLocalGear (js/pirateGear.js) re-dresses the local pirate itself (loadPirate local: true)
  const fnet = createFootNet({ scene, low: LOW, world, docking });
  const crewF = new URLSearchParams(location.search).get('followers') === '0' ? null : createFollowers({ scene, world, walker, low: LOW, keepOut: (x, z, i) => battle?.keepOut?.(x, z, i) }); // [Emerly] the crew wait outside the SWORD PIT / MUSKET RANGE
  const imap = createIslandMap({ world, layout, low: LOW || touch, islands }); // [v106] the radar is the whole-island map in the harbor (at sea + on foot)
  // [v106] radar markers: main.js passes ship / AI / harbor mates / loot; we add you on foot + the on-foot pirates + the dig target
  let mapSt = {};
  function minimapState(st) {
    const W = walker.w, peers = [...(st.peers || [])];
    for (const p of fnet.peers.values()) peers.push({ x: p.x, z: p.z, foot: true });
    return { ...st, peers, me: onFoot ? { x: W.x, z: W.z, yaw: W.yaw, foot: true } : null, dig: treasure.target() || (typeof window !== 'undefined' && window.PFP_MAP_TARGET) || st.dig || null };
  }
  const openIsleMap = () => { if (on && game.state === 'playing' && !treasure.isOpen) imap.open(() => minimapState(mapSt)); };
  const radarEl = document.getElementById('radar');
  radarEl?.addEventListener('pointerdown', (e) => { if (!on || !radarEl.classList.contains('isle-tap')) return; e.preventDefault(); e.stopPropagation(); openIsleMap(); });
  // [v145] calm() = the treasure-map reveal may play now (never mid-fight); getPos() = you on foot, else your ship (harbor coords)
  const treasure = createTreasure({ world, layout, toast: (...a) => toast(...a), pvp: () => ctx.pvp(), isOn: () => on && inHarbor(), calm: () => calm(), sfx: ctx.sfx, low: LOW || touch,
    getPos: () => { if (onFoot) { const W = walker.w; return { x: W.x, z: W.z, yaw: W.yaw, foot: true }; } const s = P(); return s ? { x: s.x, z: s.z, yaw: s.yaw, foot: false } : null; } });
  const plaza = createPlaza({ world, ctx: { startWaves: () => { goAboard(true); ctx.openWaves(); }, openArena: () => openBoard() } });
  const battery = createBattery({ scene, world, layout, fx: ctx.fx, ocean, sfx: ctx.sfx, camera }); // [Timothy] adds its 6 FIRE CANNON points to layout.interact
  const battle = createBattle({ scene, world, layout, walker, fnet, sfx: ctx.sfx, camera, canvas, touch, myId, low: LOW }); // [Timothy] adds the WEAPON STORE point to layout.interact (window.openWeaponStore)
  const sets = colliderSets(layout.shipCircles);
  const NO_TARGET = { x: 0, z: 0, alive: false, yaw: 0, speed: 0 };

  // ---------- UI ----------
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  if (touch) document.documentElement.classList.add('dk-touch');
  const el = (tag, id, html = '') => { const e = document.createElement(tag); e.id = id; e.innerHTML = html; document.body.appendChild(e); return e; };
  const safeTag = el('div', 'dk-safe', '⚓ SAFE HARBOR'), acts = el('div', 'dk-acts'), fade = el('div', 'dk-fade'), toastEl = el('div', 'dk-toast');
  const joy = el('div', 'dk-joy', '<i></i>'), jumpB = el('button', 'dk-jump', 'JUMP'), boardX = el('button', 'dk-board-x', '✕ BACK');
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
  jumpB.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (on && onFoot) walker.jump(); }); // [v106] phone JUMP (next to the stick)
  boardX.onclick = (e) => { e.stopPropagation(); closeBoard(); };
  function openBoard() { document.documentElement.classList.add('dk-board'); ctx.pvp()?.harborUi?.(); }
  function closeBoard() { document.documentElement.classList.remove('dk-board'); }

  // ---------- state ----------
  let viewing = false; // [v105] harbor spectate view
  let on = false, onFoot = false, lastShot = 0, leftAt = -99, sprintHinted = false;
  // [v145] combat watch for the treasure-map reveal queue: a hit taken, a broadside fired or an AI ship close = fighting
  let combatT = -99, lastHp = null, lastCd = 0, bossOn = false;
  function calm() {
    const s = P(); if (!on || game.state !== 'playing' || !s || !s.alive || imap.isOpen || document.documentElement.classList.contains('dk-board')) return false;
    if (onFoot || docking.mode === 'docked' || zone.inside(s.x, s.z)) return true;
    if (game.t - combatT < 6) return false;
    return !(mapSt.ai || []).some(e => Math.hypot(e.x - s.x, e.z - s.z) < (e.boss ? 260 : 150));
  }
  const P = () => ctx.getPlayer();
  const inHarbor = () => game.mode === 'pvp' && !!ctx.pvp() && ctx.pvp().where === 'harbor' && !ctx.pvp().spectating && ['playing', 'paused', 'shop'].includes(game.state);
  // the harbor zone (clear water round the coast, curated islets, the coast colliders, no grid rocks on the land): sailing it OR spectating it
  let zoneOn = null; const setZone = (v) => { v = !!v; if (v === zoneOn) return; zoneOn = v; islands.setHarbor(v ? { clearR: 470, islets: ctx.islets, island: sets, land: (x, z) => layout.FM.H(...layout.harborToFoot(x, z)) > -6 } : null); };
  function setOn(v) {
    if (v === on) return; on = v; world.root.visible = v;
    setZone(v || viewing);
    if (!v) { imap.close(); radarEl?.classList.remove('isle-tap'); if (onFoot) goAboard(true); docking.release(); fnet.clear(); safeTag.style.display = 'none'; setActs(null, null); closeBoard(); battery?.clear(); battle?.clear(); }
  }
  // ---------- actions ----------
  // [v152] BANKSY "When they join harbor spawn them at an empty berth unless they are full then spawn them at sea": joining the harbor
  // (first join, back from the arena / spectate, a re-join) or respawning there after a sinking moors your ship at a free berth B1-B10.
  // [v157] BANKSY "Start them at dock": moored on the very frame you join / respawn (was: 1.5 s at the sea spawn, then a fade + jump to the berth).
  // The berth is provisional: a pirate already moored there (or a lower-id fresh spawn) still wins and you move over (the v152 'ds' clash rule);
  // every berth taken = back to the sea spawn. Those moves fade (no toast while the name card is up).
  // ?berthspawn=0 = the old sea spawn (tests)
  const BERTH_SPAWN = new URLSearchParams(location.search).get('berthspawn') !== '0';
  let spawnFrom = null, wasAlive = false;
  const hidden = () => { const en = document.getElementById('pvp-entry'); return !!en && !en.classList.contains('hidden'); }; // the name card is up: nothing on screen to jump
  function spawnNow(s) { // snap-moor on the spawn frame (no ease-in, no fade: the camera starts there)
    if (!BERTH_SPAWN || !s?.alive || onFoot || docking.mode !== 'sea') return;
    spawnFrom = { x: s.x, z: s.z, yaw: s.yaw };
    const b = docking.spawnPick(); if (!b) return; // all berths taken: the sea spawn stands
    docking.moor(s, b); ctx.camReset?.(); if (!hidden()) toast(`MOORED AT BERTH ${b.id} · SAFE HARBOR`, 2000);
  }
  function dockNow(b) { const s = P(); docking.begin(s, b); ctx.sfx?.coin?.(); toast(`MOORING AT BERTH ${b.id}`); }
  function goAshore() {
    if (docking.mode !== 'docked') return; const b = docking.berth;
    fadeTo(() => { onFoot = true; controls.enabled = false; document.documentElement.classList.add('pfp-onfoot');
      walker.enter(b.ashore.x, b.ashore.z, b.out ? Math.atan2(-b.out.x, -b.out.z) : b.yaw + Math.PI); // face inland
      crewF?.enter();
      if (!sprintHinted) { sprintHinted = true; toast(touch ? 'ASHORE<br><small>push the stick to the edge to sprint</small>' : `ASHORE<br><small>WASD walk · hold ${keyName(binds('sprint')[0])} to sprint</small>`, 2600); } });
  }
  function goAboard(instant = false) {
    const fin = () => { onFoot = false; walker.exit(); crewF?.exit(); closeBoard(); document.documentElement.classList.remove('pfp-onfoot'); controls.enabled = true; ctx.camReset(); };
    if (instant) fin(); else fadeTo(fin);
  }
  function setSail() { if (docking.setSail(P())) { const s = P(); s.anchor = false; s.sail = 1; toast('SET SAIL!'); } }
  function interact(q) {
    const pv = ctx.pvp(), t = game.t;
    switch (q.kind) {
      case 'waves': case 'arena': plaza.openBoard(q.kind); break; // [v103] live leaderboard; START WAVES / JOIN BATTLE buttons in the panel
      case 'token': plaza.openToken(q.sym); break;
      case 'cannon': battery?.fire(q); break; // [Timothy] cosmetic shot (no damage / kills / gold / stats)
      case 'exchange': plaza.openToken('SUNK'); break;
      case 'squadhall': if (pv?.lob?.state === 'harbor' && pv.mode !== 'squads') pv.setMode?.('squads'); openBoard(); break;
      case 'spyglass': goAboard(true); pv?.harborSpectate?.(); break;
      case 'shop': if (q.open === 'upgrades') { let ok = false; try { ok = !!window.PFP_OPEN_UPGRADES?.(); } catch {} if (!ok) toast('THE UPGRADE SHOP IS CLOSED RIGHT NOW<br><small>ship upgrades open from the harbor</small>', 2400); break; } // [v146] the UPGRADE SHOP storefront: straight to the upgrades panel (its own shop: never the skins grid)
        Promise.resolve(window.openShop ? window.openShop({ vendor: q.vendor || 'shop', tab: q.tab || (q.vendor === 'clothes' ? 'gear' : 'skins'), slot: q.slot, title: q.title, from: 'island' }) : false) // [Emerly] q.tab / q.title: SWORD SHOP / MUSKET SHOP
        .then(ok => { if (!ok) toast('THE SHOP IS CLOSED RIGHT NOW<br><small>check your connection and try again</small>', 2400); }); break;
      case 'tavern': toast('THE TAVERN<br><small>daily claim moves here soon</small>', 2200); break;
      case 'bounties': toast('BOUNTY BOARD<br><small>bounties coming soon</small>', 2200); break;
      case 'stall': toast(`${q.id === 'stall_red' ? 'THE TAILOR' : 'CURIOS'} · COMING SOON<br><small>${q.id === 'stall_red' ? 'hats, clothes + eye patches' : 'parrots, hooks + treasure maps'} for gold</small>`, 2400); break; // [v102] gear: no model on the pirate yet
      case 'dig': case 'cave': treasure.dig(q, t).then(h => { if (!h) toast(q.label); }); break; // [v122] server digs (the cave needs a legendary map)
      default: toast(q.label);
    }
  }
  // capture-phase keys: E = the main prompt, W = SET SAIL while moored; on foot the walker eats movement / fire keys
  const onKeyDown = (e) => {
    if (!on || e.target?.tagName === 'INPUT' || treasure.isOpen) return; // [v145] the treasure map closes on its own keys (Esc / M)
    if (imap.isOpen && (e.code === 'Escape' || isKey('map', e.code))) { imap.close(); e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (isKey('map', e.code) && !e.repeat && game.state === 'playing' && !document.documentElement.classList.contains('dk-board')) { openIsleMap(); e.stopImmediatePropagation(); e.preventDefault(); return; }
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
    const want = inHarbor() || (on && game.mode === 'pvp' && ctx.pvp()?.where === 'harbor' && game.state !== 'title'); const was = on; setOn(want);
    // [v105] HARBOR SPECTATE: show + stream the whole coast island (terrain chunks / LOD follow the spectate camera); no docking or walking
    const view = !on && game.mode === 'pvp' && !!ctx.pvp()?.specHarbor && game.state !== 'title'; if (view !== viewing) { viewing = view; world.root.visible = view || on; setZone(view || on); } if (view) world.update(camera.position, game.t, game.storm || 0);
    treasure.tick();
    if (!on) return;
    const s = P(), now = game.t; uTime.value = now;
    if ((!was || (s.alive && !wasAlive)) && s.alive) spawnNow(s); wasAlive = !!s.alive; // [v152] joined / respawned in the harbor; [v157] moored this frame
    if (hidden() && docking.fresh()) docking.st.spawnAt = performance.now(); // [v157] the clash grace starts when the name card closes
    { const cd = Math.max(s.cd?.port || 0, s.cd?.star || 0); if ((lastHp !== null && s.hp < lastHp - 0.01) || cd > lastCd + 0.05) combatT = now; lastHp = s.hp; lastCd = cd;
      const b = (mapSt.ai || []).some(e => e.boss); if (bossOn && !b) treasure.soon(6000); bossOn = b; } // a boss just sank: its map drop shows soon
    if (!s.alive) { if (docking.mode !== 'sea') docking.release(); if (onFoot) goAboard(true); }
    const r = docking.tick(s, dt);
    if (r === 'docked') toast('MOORED · SAFE HARBOR');
    if (r === 'free') { s.anchor = false; s.sail = Math.max(1, s.sail); leftAt = now; }
    zone.tick(s, now);
    battery?.tick(dt, walker, onFoot); // [Timothy] aim the gun you stand at, fly the cosmetic balls
    // HUD tag
    const g = zone.graceLeft(s, now);
    if (onFoot) safeTag.style.display = 'none'; // BANKSY: no SAFE HARBOR tag while walking the island
    else if (s._safe) { safeTag.style.display = 'block'; safeTag.className = ''; safeTag.textContent = '⚓ SAFE HARBOR'; }
    else if (g > 0) { safeTag.style.display = 'block'; safeTag.className = 'grace'; safeTag.textContent = `NO FIRING · ${Math.ceil(g)}`; }
    else safeTag.style.display = 'none';
    // prompts
    if (onFoot) {
      walker.update(dt); crewF?.update(dt, camera);
      const W = walker.w, b = docking.berth;
      let best = null, bd = 1e9;
      if (b && Math.hypot(W.x - b.ashore.x, W.z - b.ashore.z) < 4) best = { label: 'BOARD SHIP', fn: () => goAboard() };
      if (!best) for (const q of [...layout.interact, ...world.footInteract]) { if (q.used) continue; const d = Math.hypot(q.x - W.x, q.z - W.z); if (d < (q.r || 3) && d < bd) { bd = d; best = { label: treasure.label(q) || q.label, fn: () => interact(q) }; } }
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
    battle?.tick(dt, onFoot, pirate); // [Timothy] battle areas: weapons, swings / shots, KOs, HUD
    fnet.tick(dt);
    if (bcLink) bcLink.tick();
  }
  // camera: true = we drove it this frame (main.js skips its ship camera)
  function cameraHook() { plaza.update(on); if (!on) return false; world.update(camera.position, game.t, game.storm || 0); return onFoot; }

  // ---------- test transport (?harborbc=1): two tabs share a BroadcastChannel as their "harbor room" ----------
  let bcLink = null;
  if (new URLSearchParams(location.search).has('harborbc')) {
    const ch = new BroadcastChannel('pfp-harbor-test'); let last = 0;
    ch.onmessage = (ev) => { if (on) handlePeer(ev.data); };
    bcLink = { tick() { const now = performance.now(); if (now - last < 250) return; last = now; ch.postMessage({ i: myId(), n: ctx.pvp()?.name || 'PIRATE', ...fnet.netState(walker), ...(battery?.netState() || {}), ...(battle?.netState() || {}), gr: gearToWire(getLocalGear()), sk: ctx.pvp()?.skinId || 'classic' }); } };
  }
  function handlePeer(m) { battery?.onPeer(m); const r = fnet.onPeerState(m); battle?.onPeer(m);
    if (r && r.spawnMoved !== undefined) { const s = P(), b = r.spawnMoved; // [v152] two pirates spawned onto the same berth: the other keeps it
      const go = () => { if (!on || onFoot || !docking.fresh()) return;
        if (b) { docking.moor(s, b); ctx.camReset?.(); if (!hidden()) toast(`BERTH TAKEN · MOORED AT ${b.id}`); }
        else { docking.release(); if (spawnFrom) { s.x = spawnFrom.x; s.z = spawnFrom.z; s.yaw = spawnFrom.yaw; s.speed = 0; s.anchor = false; ctx.camReset?.(); } if (!hidden()) toast('ALL BERTHS TAKEN · AT SEA'); } };
      fadeTo(go); // [v157] a fade, never a visible jump (the name card is see-through)
      return; }
    if (r && r.moved !== undefined) { if (r.moved) { dockNow(r.moved); toast(`BERTH TAKEN · MOVING TO ${r.moved.id}`); } else { docking.release(); toast('NO FREE BERTH'); } } }

  const api = {
    layout, world, zone, docking, walker, fnet, NO_TARGET, plaza, battery, battle,
    get on() { return on; }, get onFoot() { return onFoot; },
    ship, camera: cameraHook,
    focus: () => (on && onFoot ? walker.w : null), followers: crewF,
    canFire(s) { if (!on) return true; const ok = zone.canFire(s, game.t);
      if (!ok && s === P() && !onFoot && performance.now() - lastShot > 1200) { lastShot = performance.now(); toast(zone.inside(s.x, s.z) ? 'SAFE HARBOR · NO FIRING' : 'NO FIRING · JUST LEFT SAFE HARBOR', 1200); }
      return ok; },
    invuln: (s) => on && zone.inside(s.x, s.z),
    isSafe: (s) => on && !!s && zone.inside(s.x, s.z),
    aiSteer: (e, desired) => on ? zone.steer(e, desired) : desired,
    netState: () => (on ? { ...fnet.netState(walker, (battle?.fastHz?.() || 0) > 1), ...(battery?.netState() || {}), ...(battle?.netState() || {}) } : {}), // [Timothy] + 'bc' (your last battery shot) + 'ba' / 'bh' (battle areas)
    onPeerState: (m) => { if (on) handlePeer(m); else if (m && typeof m.i === 'string' && typeof m.dk === 'string' && m.dk) docking.onPeer(m.i, m.dk, m.ds === 1 ? 1 : 0); }, // [v157] off: just note their berth (spawnPick skips it)
    dockAt: (id) => { const b = layout.berths.find(q => q.id === id); if (b) dockNow(b); }, goAshore, goAboard, setSail, interact, openBoard, closeBoard, treasure,
    // [v103] main.js drawRadar: on foot, draw the island map instead (true = drawn)
    drawMinimap: (ctx, W, st = {}) => { mapSt = st; if (on && !onFoot && !imap.ready) imap.bakeRows(4); const ok = on && onFoot && imap.drawLocal(ctx, W, minimapState(st), walker.w.camYaw); radarEl?.classList.toggle('isle-tap', !!ok); return ok; }, // [v108] on foot only (local, heading-up); on the ship = the original harbor radar
    islandMap: imap, openIsleMap,
    stats: () => ({ ...world.stats, berths: layout.berths.length, shipCircles: layout.shipCircles.length, sets: sets.length }),
  };
  return api;
}
