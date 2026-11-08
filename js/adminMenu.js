import { itemIconHtml } from './inventory/itemIcon.js';
// PUMPFUN PIRATES · [admin-menu] BANKSY's owner-only ADMIN MENU (t1700u / t1701u / t1702u). Kill switch: &admin=0.
//   ⚙ SETTINGS > 👑 ADMIN MENU (owner only; nothing on the HUD, nothing in the DOM for anyone else) or F8 opens #pfp-admin:
//   🕊️ NOCLIP (fly through everything on foot, glide through rocks at sea; V) · ⚡ GOD MODE · 👻 INVISIBLE (ghost cloak) · 👁️ 3D ESP +
//   LIVE PLAYERS (TP · ❄️ FREEZE · 🎒 POCKETS: take / slip in items + gold).
// SECURITY: the panel mounts only when the SERVER says owner (admin_status -> owner: true; every owner action is re-checked server-side
// and returns 403 otherwise). URL params never unlock it on the live hosts; ?banksy=1 works on 127.0.0.1 / localhost only (tests).
// FREEZE / POCKETS live on the server (migration 045 + supabase/functions/pvp/admin.ts). The Realtime 'adm' poke only makes the target
// re-ask the server (admin_my_state / its inventory): a peer broadcast can never freeze anyone or move an item.
// Every player loads the small client half (presence heartbeat, the poke, the frozen lock + banner, icy tint on frozen pirates).
import { IS_PROD_HOST } from './env.js';
import { escHtml, isNetId } from './safe.js';
import { ADM } from './adminState.js';
import { invApi, ownerReady, ownerAllSkins, accountInfo, walletSession, shopCache } from './pvpSave.js';
import { FISH, VALUABLES, GUN_ITEMS, WEAPON_BASES, WEAPON_TIERS, itemInfo, RARITY_COLOR } from './inventory/catalog.js';
import { giveCatalog, spawnCatalog, maxKeyOf } from './adminSpawn.js'; // [admin-spawn t2149u]
import { placeBody } from './onfoot/physics.js';
import { createWorldAdmin, WORLD_CSS } from './adminWorld.js'; // [v346] ☀️ TIME & WEATHER + 🧱 COLLISIONS (t1819u / t1820u)

// ---------------- pure helpers (tests/adminMenu.test.mjs) ----------------
export const ADMIN_ON = typeof location === 'undefined' || !/[?&]admin=0(&|$)/.test(location.search);
// the ONLY ways in: the server said owner, or a local dev server with ?banksy=1 (never on the live hosts)
export function adminUnlocked({ serverOwner = false, prodHost = IS_PROD_HOST, search = (typeof location !== 'undefined' ? location.search : '') } = {}) {
  return serverOwner === true || (!prodHost && /[?&]banksy=1(&|$)/.test(search));
}
export const NOCLIP = { speed: 9, boost: 2, up: 7, levelPitch: 0.28 };
export const SPEEDS = [1, 2.5, 5];
// one noclip frame: fly along the camera (pitch 0.28 = level), Space up, C down, Shift boost. Ignores world.blocked / gravity / water.
export function noclipStep(w, keys, dt, mul = 1, joy = null) {
  const K = keys || {}; let f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), s = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
  if (joy?.on && Math.hypot(joy.x, joy.y) > 0.12) { f = -joy.y; s = joy.x; }
  const up = (K.Space ? 1 : 0) - (K.KeyC ? 1 : 0), boost = K.ShiftLeft || K.ShiftRight ? NOCLIP.boost : 1, v = NOCLIP.speed * mul * boost;
  const p = (w.pitch ?? NOCLIP.levelPitch) - NOCLIP.levelPitch, cp = Math.cos(p), sy = Math.sin(w.camYaw), cy = Math.cos(w.camYaw);
  const fwd = [sy * cp, -Math.sin(p), cy * cp], right = [-cy, 0, sy];
  let dx = fwd[0] * f + right[0] * s, dy = fwd[1] * f, dz = fwd[2] * f + right[2] * s; const n = Math.hypot(dx, dy, dz);
  if (n > 1e-6) { dx /= n; dy /= n; dz /= n; w.x += dx * v * dt; w.y += dy * v * dt; w.z += dz * v * dt; w.yaw = Math.atan2(dx, dz); w.speed = Math.min(9.6, v); } else w.speed = 0;
  w.y += up * NOCLIP.up * mul * boost * dt;
  w.y = Math.max(-40, Math.min(400, w.y));
  return w;
}
export const landY = (y, groundY) => Math.max(y, groundY);
// where a TP puts you next to a target (on foot: 1.8 m off, facing them; at sea: alongside their ship)
export function tpSpot(t, foot = true) {
  if (foot) { const x = t.x + 1.8, z = t.z + 1.8; return { x, z, yaw: Math.atan2(t.x - x, t.z - z), foot: true }; }
  return { x: t.x + 18, z: t.z + 18, yaw: Math.atan2(t.x - (t.x + 18), t.z - (t.z + 18)), foot: false };
}
export const dist2d = (a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0));
// ESP tag text (HTML-escaped)
export function espLabel(p, me) {
  const d = Math.round(dist2d(p, me)), hp = Number.isFinite(p.hp) ? ` · ${Math.round(p.hp)} HP` : '';
  return `${escHtml(p.name || 'PIRATE')} · ${escHtml(p.mode || '')}${hp} · ${d} m${p.frozen ? ' · ❄️ FROZEN' : ''}`;
}
// project a world point to screen pixels with a three.js camera (null = behind the camera)
export function toScreen(camera, x, y, z, W, H, V) {
  const v = V || new camera.position.constructor(); v.set(x, y, z).project(camera);
  if (v.z > 1 || v.z < -1) return null; return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
}
export { giveCatalog } from './adminSpawn.js';
export const itemLabel = (key) => { const i = itemInfo(key); return i ? `${i.icon || ''} ${i.name}` : String(key); };
// the target client: what the server said about ME
export function applyMyState(st, now = Date.now()) {
  const until = st?.until ? Date.parse(st.until) : 0;
  ADM.frozen = !!st?.frozen && (!until || until > now); ADM.frozenUntil = ADM.frozen ? (until || now + 600000) : 0; return ADM.frozen;
}
// frozen: every input that moves the pirate / ship is zeroed (the walker hook + main.js shipLocked do the rest)
export function frozenLock(w, ship) {
  if (w) { w.speed = 0; w.jumpQ = false; w.vy = 0; if (w.joy) { w.joy.x = 0; w.joy.y = 0; } }
  if (ship) { ship.speed = 0; ship.turn = 0; ship.sail = 0; }
}

// ---------------- runtime ----------------
const CSS = `
#pfp-admin{position:fixed;right:14px;top:calc(var(--safe-t,0px) + 64px);z-index:90;width:360px;max-height:calc(100vh - 90px);display:none;flex-direction:column;
  background:linear-gradient(160deg,#141210,#07070a 70%);border:2px solid #d9a93c;border-radius:16px;box-shadow:0 10px 40px #000c,0 0 0 1px #000 inset,0 0 24px #d9a93c33;color:#f3e3b5;font:13px/1.3 system-ui,sans-serif;overflow:hidden}
#pfp-admin.on{display:flex}
#pfp-admin .hd{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:move;background:linear-gradient(90deg,#2a1f0c,#120d05);border-bottom:1px solid #d9a93c66;user-select:none}
#pfp-admin .hd b{font:22px 'Just Another Hand',cursive;letter-spacing:.08em;color:#ffd36b;flex:1}
#pfp-admin .hd button{background:none;border:1px solid #d9a93c88;color:#ffd36b;border-radius:8px;width:26px;height:24px;cursor:pointer}
#pfp-admin .bd{overflow:auto;padding:8px 10px 10px}
#pfp-admin.min .bd{display:none}
#pfp-admin .pw{display:grid;grid-template-columns:1fr 1fr;gap:6px}
#pfp-admin .pw button,#pfp-admin .act{font:600 12px system-ui,sans-serif;letter-spacing:.03em;padding:8px 6px;border-radius:10px;border:1px solid #d9a93c77;background:#1b1712;color:#f3e3b5;cursor:pointer}
#pfp-admin .pw button.on{background:linear-gradient(#ffd36b,#c78d1c);color:#161007;border-color:#fff1c4;box-shadow:0 0 12px #ffd36b88}
#pfp-admin .spd{display:flex;gap:4px;align-items:center;margin:6px 0 2px;font-size:12px;color:#cdb98a}
#pfp-admin .spd button{flex:1;padding:4px;border-radius:8px;border:1px solid #d9a93c55;background:#15120e;color:#f3e3b5;cursor:pointer}
#pfp-admin .spd button.on{background:#d9a93c;color:#161007}
#pfp-admin .pills{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0 2px;min-height:18px}
#pfp-admin .pill{font-size:11px;padding:2px 8px;border-radius:999px;background:#0e2a2e;border:1px solid #63e6f0;color:#a8f6ff}
#pfp-admin h4{margin:10px 0 4px;font:600 11px system-ui;letter-spacing:.14em;color:#d9a93c;display:flex;justify-content:space-between;align-items:center}
#pfp-admin h4 button{font-size:11px;padding:2px 8px;border-radius:8px;border:1px solid #d9a93c66;background:#15120e;color:#f3e3b5;cursor:pointer}
#pfp-admin .pl{display:grid;grid-template-columns:1fr auto;gap:4px;padding:6px;border-radius:10px;background:#ffffff08;margin-bottom:4px;border:1px solid #ffffff10}
#pfp-admin .pl .n{font-weight:700;color:#fff3d0}
#pfp-admin .pl .m{font-size:11px;color:#bba77a}
#pfp-admin .pl .bt{display:flex;gap:4px;align-items:center}
#pfp-admin .pl .bt button{font:600 11px system-ui;padding:4px 7px;border-radius:8px;border:1px solid #d9a93c66;background:#1b1712;color:#f3e3b5;cursor:pointer}
#pfp-admin .pl .bt button.fz{border-color:#63e6f0;color:#a8f6ff}
#pfp-admin .pl .bt button[disabled]{opacity:.4;cursor:default}
#pfp-admin .pl.frozen{border-color:#63e6f0;background:#0e2a2e55}
#pfp-admin .empty{font-size:12px;color:#9c8b66;padding:6px}
#pfp-admin .pk{margin-top:8px;border:1px solid #d9a93c66;border-radius:12px;padding:8px;background:#0c0b09}
#pfp-admin .pk .ph{display:flex;justify-content:space-between;align-items:center;font-weight:700;color:#ffd36b;margin-bottom:6px}
#pfp-admin .pk .ph button{font-size:11px;border-radius:8px;border:1px solid #d9a93c66;background:#15120e;color:#f3e3b5;padding:2px 8px;cursor:pointer}
#pfp-admin .it{display:flex;align-items:center;gap:6px;padding:4px 2px;border-bottom:1px solid #ffffff0d}
#pfp-admin .it .q{min-width:28px;text-align:right;color:#fff;font-weight:700}
#pfp-admin .it .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#pfp-admin .it .rb{font-size:10px;padding:1px 5px;border-radius:6px;border:1px solid currentColor}
#pfp-admin .it button{font:600 10px system-ui;padding:3px 6px;border-radius:7px;border:1px solid #d9a93c66;background:#1b1712;color:#f3e3b5;cursor:pointer}
#pfp-admin .give{display:grid;grid-template-columns:1fr 54px;gap:4px;margin-top:6px}
#pfp-admin .give input,#pfp-admin .give select{background:#15120e;color:#f3e3b5;border:1px solid #d9a93c55;border-radius:8px;padding:5px;font:12px system-ui;min-width:0}
#pfp-admin .give .full{grid-column:1 / -1}
#pfp-admin .give .row{grid-column:1 / -1;display:flex;gap:4px}
#pfp-admin .give .row button{flex:1}
#pfp-esp{position:fixed;inset:0;pointer-events:none;z-index:85;display:none}
#pfp-esp.on{display:block}
#pfp-esp .t{position:absolute;transform:translate(-50%,-100%);white-space:nowrap;font:600 12px system-ui,sans-serif;color:#fff;background:rgba(10,10,14,.72);border:1px solid #ffd36b;border-radius:8px;padding:2px 7px;text-shadow:0 1px 2px #000}
#pfp-esp .t.fz{border-color:#63e6f0;color:#c9fbff}
#pfp-esp .t:after{content:'';position:absolute;left:50%;bottom:-7px;width:2px;height:6px;background:#ffd36b;transform:translateX(-50%)}
#pfp-frozen{position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:88;display:none;pointer-events:none;font:34px 'Just Another Hand',cursive;letter-spacing:.08em;color:#e8fdff;
  background:linear-gradient(180deg,rgba(40,120,150,.85),rgba(10,40,60,.9));border:3px solid #9ff3ff;border-radius:18px;padding:8px 26px 4px;text-shadow:0 2px 6px #024;box-shadow:0 0 40px #63e6f0aa}
#pfp-frozen small{display:block;font:13px system-ui,sans-serif;letter-spacing:.06em;color:#bdf4ff;text-align:center;padding-bottom:4px}
html.pfp-frozen #pfp-frozen{display:block}
html.pfp-frozen #dk-acts,html.pfp-frozen #bt-atk,html.pfp-frozen #dk-jump{display:none!important}
html.pfp-frozen body:after{content:'';position:fixed;inset:0;pointer-events:none;z-index:87;box-shadow:inset 0 0 120px 30px rgba(120,220,255,.45)}
#pfp-admin-toast{position:fixed;left:50%;bottom:22%;transform:translateX(-50%);z-index:95;font:600 15px system-ui,sans-serif;color:#fff3d0;background:rgba(14,12,8,.92);border:1px solid #d9a93c;border-radius:12px;padding:8px 14px;opacity:0;transition:opacity .25s;pointer-events:none}
#btn-set-admin{border-color:#d9a93c!important;color:#ffd36b!important}
` + WORLD_CSS;

export function initAdminMenu(ctx) {
  if (!ADMIN_ON || typeof document === 'undefined') return null;
  const dock = () => ctx.dock?.(), pvp = () => ctx.pvp?.(), player = () => ctx.player?.();
  const localUnlock = adminUnlocked({ serverOwner: false });
  const mockOn = !IS_PROD_HOST && localUnlock;
  const myNet = () => { const v = pvp()?.myId; const id = typeof v === 'function' ? v() : v; return isNetId(id) ? id : null; };
  const send = (ev, m) => { try { pvp()?.room?.send(ev, m, { now: true }); return true; } catch { return false; } };
  const st = { owner: false, open: false, esp: false, roster: [], server: [], pocket: null, pocketFor: null, pendingTp: null, lastCheck: -Infinity, lastBeat: 0, lastMine: 0, filter: '', sel: '' };

  // ---- server calls (owner actions are 403 server-side for everyone else). Local ?banksy=1 tests fall back to an in-memory mock. ----
  const mock = { pockets: new Map(), frozen: new Map(), mine: [], world: {} };
  const mockPid = (net) => 'dev:' + [...String(net)].reduce((a, c) => ((a * 31 + c.charCodeAt(0)) >>> 0), 7).toString(16).padStart(8, '0').repeat(3).slice(0, 24);
  const mockPocket = (pid) => { if (!mock.pockets.has(pid)) mock.pockets.set(pid, { items: [{ item: 'val:gold_bar', qty: 3 }, { item: 'val:ruby', qty: 1 }, { item: 'fish:koi', qty: 2 }, { item: 'wpn:sword:cutlass:epic', qty: 1 }, { item: 'wpn:musket:dragoon:legendary', qty: 1 }, { item: 'val:musket_parts', qty: 6 }], gold: 4250, pending: 0, equipped: { sword: 'wpn:sword:cutlass:epic' } }); return mock.pockets.get(pid); };
  function mockApi(action, b) {
    const P = b.target_pid && mockPocket(b.target_pid);
    switch (action) {
      case 'admin_status': return { ok: true, owner: true, mock: true };
      case 'admin_players': return { ok: true, players: liveRoster().map(p => ({ ...p, pid: mockPid(p.net), frozen: !!mock.frozen.get(mockPid(p.net)) })) };
      case 'admin_freeze': mock.frozen.set(b.target_pid, !!b.frozen); return { ok: true, frozen: !!b.frozen, until: b.frozen ? new Date(Date.now() + 600000).toISOString() : null };
      case 'admin_pocket_get': return { ok: true, ...P };
      case 'admin_pocket_take': { const r = P.items.find(i => i.item === b.item); if (!r) return { ok: false, error: 'not there' }; const q = b.all ? r.qty : Math.min(r.qty, b.qty | 0 || 1); r.qty -= q; if (!r.qty) P.items.splice(P.items.indexOf(r), 1); mock.mine.push({ item: b.item, qty: q }); return { ok: true, took: { item: b.item, qty: q }, target: P }; }
      case 'admin_pocket_give': { const r = P.items.find(i => i.item === b.item); if (r) r.qty += b.qty | 0; else P.items.push({ item: b.item, qty: b.qty | 0 }); return { ok: true, gave: { item: b.item, qty: b.qty }, target: P }; }
      case 'admin_world_get': return { ok: true, world: { ...mock.world }, mock: true };   // [v346] local ?banksy=1 only: in-memory world
      case 'admin_world_put': { for (const [k, v] of Object.entries(b.set || {})) { if (v === null) delete mock.world[k]; else mock.world[k] = v; } return { ok: true, world: { ...mock.world }, mock: true }; }
      case 'admin_pocket_gold': P.gold = Math.max(0, P.gold + (b.delta | 0)); return { ok: true, delta: b.delta, target: P };
      default: return { ok: false, error: 'offline' };
    }
  }
  async function call(action, body = {}) {
    const r = await invApi(action, body).catch(() => null);
    if (r && (r.ok || r.status === 403 || r.status === 400 || r.status === 409)) return r;
    return mockOn ? mockApi(action, body) : (r || { ok: false, error: 'offline' });
  }

  // ---- every player: presence heartbeat, the poke, MY freeze state ----
  function whereNow() {
    const P = pvp(), d = dock(), s = player(); if (!P?.active) return null;
    const room = P.where === 'harbor' ? `Harbor #${P.hb?.copy || 1}` : P.where === 'arena' ? 'Arena' : P.where || '';
    const foot = !!d?.onFoot, w = d?.walker?.w;
    const mode = d?.inHull ? 'hull' : d?.houses?.inHouse ? 'cottage' : foot ? 'foot' : d?.canoeing ? 'canoe' : 'sea';
    const pos = foot && w ? { x: w.x, y: w.y, z: w.z } : { x: s?.x || 0, y: 0, z: s?.z || 0 };
    return { room, mode, ...pos };
  }
  const portalSessionStart = Date.now();
  async function beat(now) {
    const net = myNet(), w = whereNow(); if (!net || !w || ADM.invisible) return;
    st.lastBeat = now; await call('admin_register_net', { net_id: net, name: pvp()?.name || 'PIRATE', ...w, portal_v: 1, session_started_at: portalSessionStart, device: /iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : /Mobi|Android/i.test(navigator.userAgent) ? 'phone' : 'desktop' }).catch(() => {});
    if (!st.lastMine) checkMine(true);
  }
  async function checkMine(force = false) {
    const now = performance.now(); if (!force && now - st.lastMine < 1500) return; st.lastMine = now;
    const r = await invApi('admin_my_state', { net_id: myNet() || undefined }).catch(() => null);
    if (r && r.ok) setFrozen(r);
  }
  const html = document.documentElement;
  let banner = null;
  function setFrozen(r) {
    const was = ADM.frozen; applyMyState(r);
    if (ADM.frozen) { ensureCss(); banner ||= mk('div', 'pfp-frozen', '❄️ FROZEN BY CAPTAIN BANKSY<small>you can\'t move until the captain thaws you</small>'); frozenLock(dock()?.walker?.w, player()); }
    html.classList.toggle('pfp-frozen', ADM.frozen);
    if (was && !ADM.frozen) toast('🔥 THAWED · YOU CAN MOVE AGAIN');
    return ADM.frozen;
  }
  async function refreshMyPockets() { try { await pvp()?.inv?.call('inv_pot'); } catch {} try { await dock()?.inventory?.refresh?.(); } catch {} }
  // [v346] the owner's sky / weather / collision edits: every pirate reads them from the SERVER (admin_world_get); a poke only says "re-read"
  const WA = createWorldAdmin({ dock, game: ctx.game || {}, camera: ctx.camera, canvas: ctx.canvas, player, call, invRead: (a) => call(a), send, toast: (t) => toast(t), isOwner: () => st.owner });
  setTimeout(() => WA.fetchWorld().catch(() => {}), 1500);
  try { Object.defineProperty(window, 'PFP_WORLD_ADMIN', { value: () => (st.owner ? WA : null), configurable: false }); } catch {}   // [v365 t1942u] the 🛠️ BUILD menu's 🧱 COLLISIONS panel (owner only)
  ADM.onPoke = (m, from) => {
    if (m && typeof m === 'object' && !m.t && (from == null || isNetId(from)) && WA.poke(m)) return; // { k: 'env' | 'col' } for everyone: re-read the server, never the poke
    if (!m || typeof m !== 'object' || m.t !== myNet()) return; // only pokes naming ME; the server decides everything
    if (from && !isNetId(from)) return;
    if (m.k === 'chk') checkMine(); else if (m.k === 'inv') refreshMyPockets();
  };

  // ---- the walker hook: server FREEZE + NOCLIP own the on-foot frame ----
  let hooked = null, flyWas = false;
  function hookWalker() {
    const d = dock(), wk = d?.walker; if (!wk || hooked === wk) return; hooked = wk;
    wk.w.adminHook = (dt, I) => {
      const w = wk.w, B = w.body;
      const follow = () => { I.camPos(I.cam); I.camera.position.lerp(I.cam, Math.min(1, dt * 10)); I.tgt.set(w.x, w.y + 1.5, w.z); I.camera.lookAt(I.tgt); };
      if (ADM.frozen) { frozenLock(w, null); I.place(); I.pirate.update(dt, 0, w.pose); follow(); return true; }
      if (ADM.noclip) { flyWas = true; noclipStep(w, w.keys, dt, ADM.noclipMul, w.joy); w.jumpQ = false;
        Object.assign(B, { y: w.y, vy: 0, air: false, swim: false, hop: false, climb: 0, wade: 0, last: w.y }); w.air = false; w.swim = false; w.vy = 0;
        I.place(); I.pirate.update(dt, w.speed, w.pose); follow(); return true; }
      if (flyWas) { flyWas = false; landHere(); }
      return false;
    };
  }
  function landHere() { const d = dock(), w = d?.walker?.w, world = d?.walker?.world || d?.world; if (!w || !world) return;
    const g = world.ground ? world.ground(w.x, w.z) : w.y; placeBody(w.body, world, w.x, w.z, w.y); w.y = landY(Math.min(w.y, Math.max(w.body.y, g)), w.body.y); w.body.y = w.y; }

  // ---- ghost cloak (own screen only) + icy tint on frozen pirates: per-mesh material clones, restored exactly ----
  function swapLook(root, tag, on, make) {
    if (!root) return; root.traverse?.((o) => { if (!o.isMesh && !o.isSkinnedMesh && !o.isSprite) return; const ud = o.userData; const key = '_adm_' + tag;
      if (on) { if (ud[key]) return; ud[key] = o.material; o.material = Array.isArray(o.material) ? o.material.map(m => make(m)) : make(o.material); }
      else if (ud[key]) { const nm = o.material; o.material = ud[key]; delete ud[key]; (Array.isArray(nm) ? nm : [nm]).forEach(m => m?.dispose?.()); } });
  }
  const ghostMat = (m) => { const c = m.clone(); c.transparent = true; c.opacity = 0.42; c.depthWrite = false; if (c.emissive) c.emissive.setRGB(0.1, 0.45, 0.5); return c; };
  const iceMat = (m) => { const c = m.clone(); if (c.color) c.color.lerp(new c.color.constructor(0x9ff3ff), 0.6); if (c.emissive) c.emissive.setRGB(0.15, 0.45, 0.6); return c; };
  function myBodies() { const d = dock(), out = []; if (d?.pirate?.object) out.push(d.pirate.object); for (const c of d?.followers?.list || []) if (c?.p?.object) out.push(c.p.object);
    if (d?.pet?.mesh) out.push(d.pet.mesh); if (player()?.mesh) out.push(player().mesh); if (d?.canoe?.mesh) out.push(d.canoe.mesh); return out; }
  function ghostAll(on) { for (const o of myBodies()) swapLook(o, 'ghost', on, ghostMat); }
  const iced = new Set();
  function tintFrozenPeers() {
    const P = pvp(), d = dock(), want = new Set();
    for (const [id, p] of P?.peers || []) if (p.fz || ADM.frozenPeers.has(id)) { const fp = d?.fnet?.peers?.get(id); if (fp?.pirate?.object) want.add(fp.pirate.object); if (p.ship?.mesh) want.add(p.ship.mesh); }
    for (const o of want) { swapLook(o, 'ice', true, iceMat); iced.add(o); }
    for (const o of [...iced]) if (!want.has(o)) { swapLook(o, 'ice', false); iced.delete(o); }
  }

  // ---- live roster (this server) + the server's cross-server list ----
  function liveRoster() {
    const P = pvp(), d = dock(), out = [];
    for (const [id, p] of P?.peers || []) { if (!isNetId(id)) continue; const fp = d?.fnet?.peers?.get(id), sh = p.ship;
      const foot = !!fp, x = foot ? fp.x : (sh?.x ?? p.st?.x ?? 0), z = foot ? fp.z : (sh?.z ?? p.st?.z ?? 0), y = foot ? (fp.body?.y ?? 0) : (sh?.y ?? 0);
      out.push({ net: id, name: String(p.name || fp?.name || 'PIRATE').slice(0, 20), mode: foot ? 'On Foot' : 'At Sea', foot, x, y, z, hp: p.st?.h, here: true, frozen: !!p.fz || ADM.frozenPeers.has(id), copy: P.hb?.copy || 0, room: P.where === 'harbor' ? `Harbor #${P.hb?.copy || 1}` : 'Arena' }); }
    for (const [id, fp] of d?.fnet?.peers || []) if (isNetId(id) && !out.some(o => o.net === id)) out.push({ net: id, name: fp.name || 'PIRATE', mode: 'On Foot', foot: true, x: fp.x, y: fp.body?.y ?? 0, z: fp.z, here: true, frozen: ADM.frozenPeers.has(id), copy: P?.hb?.copy || 0, room: `Harbor #${P?.hb?.copy || 1}` });
    return out;
  }
  function roster() {
    const live = liveRoster(), byNet = new Map(st.server.map(s => [s.net, s]));
    const out = live.map(p => { const s = byNet.get(p.net); return { ...p, pid: s?.pid || null, frozen: p.frozen || !!s?.frozen, mode: s?.mode === 'cottage' ? 'In Cottage' : p.mode }; });
    for (const s of st.server) if (!out.some(o => o.net === s.net)) out.push({ net: s.net, pid: s.pid, name: s.name, mode: s.mode === 'foot' ? 'On Foot' : s.mode === 'cottage' ? 'In Cottage' : s.mode === 'sea' ? 'At Sea' : s.w || '', foot: s.mode === 'foot', x: s.x || 0, y: s.y || 0, z: s.z || 0, here: false, frozen: !!s.frozen, copy: s.copy | 0, room: s.room || (s.w === 'arena' ? 'Arena' : s.copy ? `Harbor #${s.copy}` : '') });
    return out;
  }
  const meNow = () => { const d = dock(); if (d?.onFoot) return d.walker.w; const s = player(); return s ? { x: s.x, z: s.z } : { x: 0, z: 0 }; };

  // ---- owner UI ----
  let panel = null, esp = null, toastEl = null, setBtn = null;
  function mk(tag, id, inner = '') { const e = document.createElement(tag); e.id = id; e.innerHTML = inner; document.body.appendChild(e); return e; }
  function toast(t, ms = 2200) { toastEl ||= mk('div', 'pfp-admin-toast'); toastEl.textContent = t; toastEl.style.opacity = 1; clearTimeout(toast._t); toast._t = setTimeout(() => { toastEl.style.opacity = 0; }, ms); }
  const ensureCss = () => { if (!document.getElementById('pfp-admin-css')) { const s = document.createElement('style'); s.id = 'pfp-admin-css'; s.textContent = CSS; document.head.appendChild(s); } }; // only once something is shown (owner / frozen)

  function unlock(how) {
    if (st.owner) return; st.owner = true; ensureCss();
    // ⚙ SETTINGS > 👑 ADMIN MENU (t1702u: nothing on the HUD)
    const pz = document.querySelector('#pause .panel'), res = document.getElementById('btn-resume');
    if (pz && !document.getElementById('btn-set-admin')) { setBtn = document.createElement('button'); setBtn.id = 'btn-set-admin'; setBtn.type = 'button'; setBtn.className = 'ghost'; setBtn.textContent = '👑 ADMIN MENU';
      setBtn.title = "captain's console (F8)"; pz.insertBefore(setBtn, res || null);
      setBtn.addEventListener('click', () => { const pause = document.getElementById('pause'); if (pause && !pause.classList.contains('hidden')) { res?.click(); pause.classList.add('hidden'); } setOpen(true); }); }
    addEventListener('keydown', (e) => { if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'SELECT') return;
      if (e.code === 'F8') { e.preventDefault(); setOpen(!st.open); return; }
      if (st.open && e.code === 'KeyV' && !e.repeat) { setPower('noclip', !ADM.noclip); } }, true);
    st.how = how;
  }
  function build() {
    if (panel) return;
    panel = mk('div', 'pfp-admin', `<div class="hd"><b>👑 BANKSY ADMIN</b><button data-a="min" title="collapse">–</button><button data-a="x" title="close (F8)">✕</button></div>
      <div class="bd"><button class="act" data-a="portal" style="width:100%;margin-bottom:8px">⚓ ADMIN PORTAL · LIVE MAP & STATS</button><div class="pw">
        <button data-p="noclip">🕊️ NOCLIP</button><button data-p="god">⚡ GOD MODE</button>
        <button data-p="invisible">👻 INVISIBLE</button><button data-p="esp">👁️ 3D ESP</button></div>
        <div class="spd">FLY SPEED ${SPEEDS.map(v => `<button data-s="${v}">${v}×</button>`).join('')}</div>
        <div class="pills"></div>
        <div class="wa"></div>
        <h4>LIVE PLAYERS <button data-a="ref">↻ REFRESH</button></h4><div class="ros"></div>
        <div class="pk" hidden></div>
        <h4>🧰 ITEM SPAWNER · into MY inventory</h4><div class="sp"></div></div></div>`);
    esp = mk('div', 'pfp-esp'); WA.mount(panel.querySelector('.wa'));
    panel.addEventListener('click', onClick); panel.addEventListener('input', onInput); panel.addEventListener('change', onInput);
    // drag by the header
    const hd = panel.querySelector('.hd'); let drag = null;
    hd.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; const r = panel.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; hd.setPointerCapture(e.pointerId); });
    hd.addEventListener('pointermove', (e) => { if (!drag) return; panel.style.left = Math.max(0, Math.min(innerWidth - 80, e.clientX - drag.dx)) + 'px'; panel.style.top = Math.max(0, Math.min(innerHeight - 40, e.clientY - drag.dy)) + 'px'; panel.style.right = 'auto'; });
    hd.addEventListener('pointerup', () => { drag = null; });
    ['keydown', 'keyup'].forEach(t => panel.addEventListener(t, (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') e.stopPropagation(); }));
    paint();
  }
  function setOpen(v) { if (!st.owner) return; build(); st.open = v; panel.classList.toggle('on', v); if (v) { refreshServer(); paint(); } }
  function setPower(k, v) {
    if (!st.owner) return;
    if (k === 'esp') { st.esp = v; esp?.classList.toggle('on', v); paint(); return; }
    if (k === 'invisible') {
      if (v && !ADM.invisible) { const id = myNet(); if (id) send('bye', { i: id }); ADM.invisible = true; ghostAll(true); toast('👻 GHOST CLOAK ON · nobody can see you'); }
      else if (!v && ADM.invisible) { ADM.invisible = false; ghostAll(false); const id = myNet(); if (id) send('hello', { i: id }); toast('👻 CLOAK OFF · you are visible again'); }
    } else if (k === 'noclip') { ADM.noclip = !!v; if (!v) { landHere(); const s = player(); if (s && !dock()?.onFoot) s.speed = Math.min(s.speed, 12); } toast(v ? '🕊️ NOCLIP ON · Space up · C down · Shift boost' : '🕊️ NOCLIP OFF · landed'); }
    else if (k === 'god') { ADM.god = !!v; const s = player(); if (v && s) s.hp = s.maxHp; toast(v ? '⚡ GOD MODE ON · nothing can sink you' : '⚡ GOD MODE OFF'); }
    paint();
  }
  function pills() { const a = []; if (ADM.noclip) a.push('🕊️ NOCLIP'); if (ADM.god) a.push('⚡ GOD'); if (ADM.invisible) a.push('👻 CLOAKED'); if (st.esp) a.push('👁️ ESP'); return a; }
  function paint() {
    if (!panel) return;
    panel.querySelectorAll('.pw button').forEach(b => { const k = b.dataset.p, on = k === 'esp' ? st.esp : !!ADM[k]; b.classList.toggle('on', on);
      b.textContent = { noclip: '🕊️ NOCLIP', god: '⚡ GOD MODE', invisible: '👻 INVISIBLE', esp: '👁️ 3D ESP' }[k] + (on ? ': ON' : ''); });
    panel.querySelectorAll('.spd button').forEach(b => b.classList.toggle('on', +b.dataset.s === ADM.noclipMul));
    panel.querySelector('.pills').innerHTML = pills().map(p => `<span class="pill">${escHtml(p)}</span>`).join(' · ');
    paintRoster(); paintPocket(); paintSpawn();
  }
  function paintRoster() {
    const box = panel?.querySelector('.ros'); if (!box) return; const me = meNow(), list = roster(); st.roster = list;
    box.innerHTML = list.length ? list.map(p => `<div class="pl${p.frozen ? ' frozen' : ''}" data-net="${escHtml(p.net)}"><div><div class="n">${p.frozen ? '❄️ ' : ''}${escHtml(p.name)}</div>
      <div class="m">${escHtml(p.room || '')} · ${escHtml(p.frozen ? '❄️ Frozen' : p.mode || '')}${p.here ? ` · ${Math.round(dist2d(p, me))} m` : ''}</div></div>
      <div class="bt"><button data-a="tp">TP</button><button class="fz" data-a="fz"${p.pid ? '' : ' disabled title="waiting for their id"'}>${p.frozen ? '🔥 UNFREEZE' : '❄️ FREEZE'}</button><button data-a="pk"${p.pid ? '' : ' disabled'}>🎒 POCKETS</button></div></div>`).join('')
      : '<div class="empty">no other pirates right now</div>';
  }
  function paintPocket() {
    const box = panel?.querySelector('.pk'); if (!box) return; const P = st.pocket, who = st.roster.find(r => r.pid === st.pocketFor) || { name: st.pocketName || 'PIRATE' };
    box.hidden = !st.pocketFor; if (!st.pocketFor) return;
    const cat = giveCatalog(), f = st.filter.toLowerCase(), opts = cat.filter(c => !f || (c.name + ' ' + c.key + ' ' + c.group).toLowerCase().includes(f));
    const groups = [...new Set(opts.map(o => o.group))];
    const rows = P ? (P.items || []).map(it => { const i = itemInfo(it.item) || { name: it.item, icon: '❔', rarity: 'common' }, rc = RARITY_COLOR[i.rarity] || '#ccc';
      return `<div class="it" data-item="${escHtml(it.item)}"><span class="q">${it.qty | 0}×</span><span class="nm">${itemIconHtml(i, '')} ${escHtml(i.name)}</span><span class="rb" style="color:${escHtml(rc)}">${escHtml(i.rarity || '')}</span><button data-a="t1">TAKE 1</button><button data-a="ta">TAKE ALL</button></div>`; }).join('') || '<div class="empty">empty pockets</div>' : '<div class="empty">opening pockets…</div>';
    box.innerHTML = `<div class="ph"><span>🎒 ${escHtml(who.name)}'s Pockets · 💰 ${(P?.gold | 0).toLocaleString('en-US')}g${P?.pending ? ` <small>(${(P.pending | 0) > 0 ? '+' : ''}${P.pending | 0} waiting)</small>` : ''}</span><span><button data-a="pref">↻ Refresh</button> <button data-a="pclose">✕</button></span></div>
      <div class="items">${rows}</div>
      <h4>+ SLIP INTO POCKETS</h4>
      <div class="give"><input class="full" data-i="filter" placeholder="search items (ruby, koi, legendary…)" value="${escHtml(st.filter)}">
        <select data-i="sel">${groups.map(g => `<optgroup label="${escHtml(g)}">${opts.filter(o => o.group === g).map(o => `<option value="${escHtml(o.key)}"${o.key === st.sel ? ' selected' : ''}>${escHtml(o.icon + ' ' + o.name + ' · ' + o.rarity)}</option>`).join('')}</optgroup>`).join('')}</select>
        <input data-i="qty" type="number" min="1" max="99" value="1">
        <div class="row"><button class="act" data-a="give">+ ADD ITEM</button></div>
        <input data-i="gold" type="number" min="1" max="1000000" value="1000" placeholder="gold">
        <span></span>
        <div class="row"><button class="act" data-a="g+">+ GOLD</button><button class="act" data-a="g-">- GOLD</button></div></div>`;
  }
  // ---- [admin-spawn] ITEM SPAWNER + MAX UPGRADE (own pockets; the server re-checks owner on every call) ----
  const myPid = () => { const n = myNet(); return st.server.find(p => p.net === n)?.pid || st.mine?.pid || st.mePid || null; }; // [roster fix] owner's own pid comes back as r.me
  function paintSpawn() {
    const box = panel?.querySelector('.sp'); if (!box) return;
    const cat = spawnCatalog(), groups = [...new Set(cat.map(c => c.group))], f = (st.sf || '').toLowerCase();
    const opts = cat.filter(c => (!st.sg || c.group === st.sg) && (!f || (c.name + ' ' + c.key + ' ' + c.group + ' ' + c.rarity).toLowerCase().includes(f)));
    const mine = (st.mine?.items || []).filter(it => maxKeyOf(it.item));
    box.innerHTML = `<div class="give"><input class="full" data-i="sf" placeholder="search all ${cat.length} items…" value="${escHtml(st.sf || '')}">
      <select data-i="sg"><option value="">ALL CATEGORIES</option>${groups.map(g => `<option${g === st.sg ? ' selected' : ''}>${escHtml(g)}</option>`).join('')}</select>
      <select data-i="ssel" size="8" class="full">${opts.map(o => `<option value="${escHtml(o.key)}"${o.key === st.ssel ? ' selected' : ''} style="color:${escHtml(RARITY_COLOR[o.rarity] || '#ccc')}">${escHtml(o.icon + ' ' + o.name + ' · ' + o.rarity + (o.srv === '062' ? ' · (server 062)' : ''))}</option>`).join('')}</select>
      <input data-i="sq" type="number" min="1" max="99" value="${st.sq || 1}"><div class="row"><button class="act" data-a="spawn">+ SPAWN TO ME</button></div></div>
      <h4>⬆️ MAX UPGRADE <button data-a="mref">↻</button> <button data-a="maxall">MAX ALL</button></h4>
      <div class="items">${st.mine ? (mine.map(it => `<div class="it" data-item="${escHtml(it.item)}"><span class="nm">${escHtml(itemLabel(it.item))}</span><button data-a="max">MAX</button></div>`).join('') || '<div class="empty">nothing left to upgrade</div>') : '<div class="empty">press ↻ to load your weapons</div>'}</div>`;
  }
  async function loadMine() { const pid = myPid(); if (!pid) { await refreshServer(); } const id = myPid(); if (!id) return toast('your id is not on the roster yet: sail / walk a moment, then ↻');
    const r = await call('admin_pocket_get', { target_pid: id }); st.mine = r?.ok ? { ...r, pid: id } : null; if (!r?.ok) toast(`my pockets: ${r?.error || 'offline'}`); paintSpawn(); }
  async function spawnMe(item, qty) {
    if (!myPid()) await refreshServer(); const pid = myPid(); if (!pid) return toast('your id is not on the roster yet');
    const r = await call('admin_pocket_give', { target_pid: pid, item, qty: item.startsWith('wpn:') ? 1 : qty });
    if (!r?.ok) return toast(`couldn't spawn ${itemLabel(item)}: ${r?.error || 'refused'}${spawnCatalog().find(c => c.key === item)?.srv === '062' ? ' (needs server update 062)' : ''}`), false;
    if (r.target) st.mine = { ...r.target, pid }; refreshMyPockets(); toast(`🧰 Spawned ${item.startsWith('wpn:') ? 1 : qty}× ${itemLabel(item)}`); paintSpawn(); return true;
  }
  async function maxUp(items) { let n = 0; for (const it of items) { const k = maxKeyOf(it); if (k && await spawnMe(k, 1)) n++; } toast(n ? `⬆️ ${n} weapon${n > 1 ? 's' : ''} maxed (max copy added)` : 'nothing upgraded'); }
  function onInput(e) {
    const si = e.target.dataset.i; if (si === 'sf') { st.sf = e.target.value.slice(0, 40); const pos = e.target.selectionStart; paintSpawn(); const n = panel.querySelector('[data-i="sf"]'); n?.focus(); n?.setSelectionRange(pos, pos); return; }
    if (si === 'sg') { st.sg = e.target.value; return paintSpawn(); } if (si === 'ssel') { st.ssel = e.target.value; return; } if (si === 'sq') { st.sq = Math.max(1, Math.min(99, e.target.value | 0)); return; }
    return onInput0(e); }
  function onInput0(e) { if (e.target.dataset.wi || e.target.dataset.wf) return WA.input(e.target, e.type === 'change'); const i = e.target.dataset.i; if (i === 'filter') { st.filter = e.target.value.slice(0, 40); const pos = e.target.selectionStart; paintPocket(); const n = panel.querySelector('[data-i="filter"]'); n?.focus(); n?.setSelectionRange(pos, pos); } else if (i === 'sel') st.sel = e.target.value; }
  async function onClick(e) {
    if (e.target.closest('[data-a="portal"]') && st.owner) {
      setOpen(false);
      import('./adminPortal.js').then(m => m.openAdminPortal({ call: (a, b) => invApi(a, b), chart: () => dock()?.islandMap, self: () => { const w = whereNow(); return w ? { net: myNet(), name: pvp()?.name || 'BANKSY', ...w } : null; } })).catch(() => toast('Portal could not load; try refreshing.'));
      return;
    }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.w) return WA.click(b);
    if (b.dataset.p) return setPower(b.dataset.p, b.dataset.p === 'esp' ? !st.esp : !ADM[b.dataset.p]);
    if (b.dataset.s) { ADM.noclipMul = +b.dataset.s; return paint(); }
    const a = b.dataset.a, row = b.closest('.pl'), net = row?.dataset.net, p = net ? st.roster.find(r => r.net === net) : null;
    if (a === 'x') return setOpen(false);
    if (a === 'min') { panel.classList.toggle('min'); return; }
    if (a === 'ref') return refreshServer();
    if (a === 'tp' && p) return jumpTo(p);
    if (a === 'fz' && p) return freeze(p, !p.frozen);
    if (a === 'pk' && p) return openPocket(p);
    if (a === 'pref') return openPocket(st.roster.find(r => r.pid === st.pocketFor) || { pid: st.pocketFor, name: st.pocketName });
    if (a === 'pclose') { st.pocketFor = null; st.pocket = null; return paintPocket(); }
    if (a === 'spawn') { const k = panel.querySelector('[data-i="ssel"]')?.value || st.ssel; return k ? spawnMe(k, st.sq || 1) : toast('pick an item first'); }
    if (a === 'mref') return loadMine();
    if (a === 'max') { const k = b.closest('.it')?.dataset.item; if (k) return maxUp([k]); }
    if (a === 'maxall') { if (!st.mine) await loadMine(); return maxUp((st.mine?.items || []).map(i => i.item)); }
    const it = b.closest('.it')?.dataset.item;
    if ((a === 't1' || a === 'ta') && it) return take(it, a === 'ta');
    if (a === 'give') { const sel = panel.querySelector('[data-i="sel"]')?.value, q = Math.max(1, Math.min(99, panel.querySelector('[data-i="qty"]')?.value | 0)); if (sel) return give(sel, q); }
    if (a === 'g+' || a === 'g-') { const g = Math.max(1, Math.min(1000000, panel.querySelector('[data-i="gold"]')?.value | 0)); return gold(a === 'g+' ? g : -g); }
  }
  async function refreshServer() { const r = await call('admin_players'); if (r?.ok && typeof r.me === 'string') st.mePid = r.me; if (r?.ok && Array.isArray(r.players)) st.server = r.players.filter(p => isNetId(p.net)); paint(); }
  async function freeze(p, on) {
    if (!p.pid) return toast('no id for that pirate yet');
    const r = await call('admin_freeze', { target_net: isNetId(p.net) ? p.net : null, target_pid: p.pid, frozen: on, seconds: 600 });
    if (!r?.ok) return toast(`couldn't ${on ? 'freeze' : 'thaw'}: ${r?.error || 'refused'}`);
    if (isNetId(p.net)) { send('adm', { t: p.net, k: 'chk' }); on ? ADM.frozenPeers.add(p.net) : ADM.frozenPeers.delete(p.net); }
    const s = st.server.find(x => x.net === p.net); if (s) s.frozen = on; else st.server.push({ ...p, frozen: on });
    toast(on ? `❄️ ${p.name} IS FROZEN SOLID` : `🔥 ${p.name} THAWED`); paint();
  }
  async function openPocket(p) { if (!p?.pid) return; st.pocketFor = p.pid; st.pocketName = p.name; st.pocketNet = p.net; st.pocket = null; paintPocket();
    const r = await call('admin_pocket_get', { target_pid: p.pid }); if (st.pocketFor !== p.pid) return; st.pocket = r?.ok ? r : { items: [], gold: 0 }; if (!r?.ok) toast(`pockets: ${r?.error || 'offline'}`); paintPocket(); }
  const nudge = () => { if (isNetId(st.pocketNet)) send('adm', { t: st.pocketNet, k: 'inv' }); };
  async function take(item, all) {
    const r = await call('admin_pocket_take', { target_pid: st.pocketFor, item, all, qty: all ? undefined : 1 });
    if (!r?.ok) return toast(`couldn't take: ${r?.error || 'refused'}`);
    if (r.target) st.pocket = { ...st.pocket, ...r.target }; nudge(); dock()?.inventory?.refresh?.();
    toast(`🕵️ Took ${r.took?.qty > 1 ? r.took.qty + '× ' : ''}${itemLabel(item)} from ${st.pocketName || 'their'}'s pockets!`); paintPocket();
  }
  async function give(item, qty) {
    const r = await call('admin_pocket_give', { target_pid: st.pocketFor, item, qty });
    if (!r?.ok) return toast(`couldn't add: ${r?.error || 'refused'}`);
    if (r.target) st.pocket = { ...st.pocket, ...r.target }; nudge(); toast(`🎁 Slipped ${qty}× ${itemLabel(item)} into ${st.pocketName || 'their'}'s pockets`); paintPocket();
  }
  async function gold(delta) {
    const r = await call('admin_pocket_gold', { target_pid: st.pocketFor, delta });
    if (!r?.ok) return toast(`gold: ${r?.error || 'refused'}`);
    if (r.target) st.pocket = { ...st.pocket, ...r.target }; nudge(); if (delta < 0) { try { await pvp()?.inv?.call('inv_pot'); } catch {} }
    toast(delta > 0 ? `💰 Dropped ${delta.toLocaleString('en-US')}g into ${st.pocketName}'s pockets` : `💰 Confiscated ${(-delta).toLocaleString('en-US')}g from ${st.pocketName}`); paintPocket();
  }
  // ---- TP ----
  function jumpTo(p) {
    const P = pvp(), d = dock(); if (!d) return;
    if (!p.here) { if (p.copy && P?.joinWorld) { st.pendingTp = { net: p.net, until: performance.now() + 30000 }; P.joinWorld({ name: p.name, w: 'harbor', copy: p.copy }).then(r => toast(r?.ok ? `⛵ SAILING TO ${p.room || 'THEIR HARBOR'} · TP when you land` : (r?.why || 'could not switch'))); } else toast('they are not in a harbor copy'); return; }
    const live = liveRoster().find(r => r.net === p.net) || p;
    if (live.foot) { const s = tpSpot(live, true);
      if (d.onFoot) { d.walker.enter(s.x, s.z, s.yaw); if (ADM.noclip) { d.walker.w.y = live.y + 0.2; } } else d.goAshoreAt(s.x, s.z, s.yaw);
      toast(`⚡ JUMPED TO ${live.name}`); return; }
    if (d.onFoot && ADM.noclip) { const w = d.walker.w; w.x = live.x; w.z = live.z; w.y = (live.y || 0) + 6; toast(`🕊️ HOVERING OVER ${live.name}'s DECK`); return; }
    if (d.onFoot) d.goAboard(true); if (d.docking?.mode && d.docking.mode !== 'sea') d.docking.release();
    const sh = player(); if (sh) { const s = tpSpot(live, false); sh.x = s.x; sh.z = s.z; sh.yaw = s.yaw; sh.speed = 0; sh.anchor = false; }
    toast(`⚡ ALONGSIDE ${live.name}'s SHIP`);
  }
  // ---- ESP (DOM tags projected each frame: through walls / terrain) ----
  const tags = new Map(); let V = null;
  function drawEsp() {
    if (!esp) return; const cam = ctx.camera, on = st.esp && !!cam; esp.classList.toggle('on', on); if (!on) return;
    V ||= new cam.position.constructor(); const me = meNow(), seen = new Set(), W = innerWidth, H = innerHeight;
    for (const p of liveRoster()) { const s = toScreen(cam, p.x, (p.y || 0) + (p.foot ? 2.6 : 9), p.z, W, H, V); seen.add(p.net);
      let t = tags.get(p.net); if (!t) { t = document.createElement('div'); t.className = 't'; esp.appendChild(t); tags.set(p.net, t); }
      if (!s) { t.style.display = 'none'; continue; } t.style.display = ''; t.style.left = s.x.toFixed(0) + 'px'; t.style.top = s.y.toFixed(0) + 'px';
      t.classList.toggle('fz', !!p.frozen); const lab = espLabel(p, me); if (t._l !== lab) { t._l = lab; t.innerHTML = lab; } }
    for (const [k, t] of tags) if (!seen.has(k)) { t.remove(); tags.delete(k); }
  }

  // ---- owner check: only the SERVER unlocks it ----
  async function checkOwner(force = false) {
    if (st.owner) return; const now = performance.now(); if (!force && now - st.lastCheck < 60000) return; st.lastCheck = now;
    await ownerReady;
    const hint = ownerAllSkins() || !!accountInfo()?.owner || !!walletSession() || !!shopCache()?.owner || force;
    if (!hint) return;
    const r = await invApi('admin_status').catch(() => null); if (r?.ok && r.owner === true) unlock('server');
  }
  if (localUnlock) unlock('local'); else { checkOwner().catch(() => {}); addEventListener('pfp-shop-sync', (e) => { if (e?.detail?.owner) checkOwner(true).catch(() => {}); }); }

  // ---- per frame ----
  let paintT = 0, look = 0;
  function frame() {
    requestAnimationFrame(frame);
    try {
      const now = performance.now(); hookWalker();
      if (ADM.frozen) { if (ADM.frozenUntil && Date.now() > ADM.frozenUntil) setFrozen({ frozen: false }); else { frozenLock(null, dock()?.onFoot ? null : player()); if (now - st.lastMine > 30000) checkMine(true); } }
      if (now - st.lastBeat > 25000) beat(now);
      if (st.owner) {
        if (ADM.god) { const s = player(); if (s && s.alive) s.hp = s.maxHp; }
        if (ADM.invisible && now - look > 500) { look = now; ghostAll(true); }
        if (st.pendingTp) { const t = liveRoster().find(r => r.net === st.pendingTp.net); if (t) { const p = st.pendingTp; st.pendingTp = null; jumpTo({ ...t, here: true }); } else if (now > st.pendingTp.until) st.pendingTp = null; }
        drawEsp(); if (st.open && now - paintT > 1000) { paintT = now; const ae = document.activeElement; if (!panel.contains(ae) || ae.tagName === 'BUTTON') paintRoster(); }
      }
      if (now - (frame._ice || 0) > 400) { frame._ice = now; tintFrozenPeers(); }
      WA.frame(now);
    } catch (e) { if (!frame._w) { frame._w = 1; console.warn('[admin-menu]', e); } }
  }
  requestAnimationFrame(frame);

  const api = { get owner() { return st.owner; }, get open() { return st.open; }, world: WA, setOpen, setPower, refreshServer, jumpTo, freeze, openPocket, take, give, gold, roster, liveRoster, ADM };
  if (!IS_PROD_HOST) { // local dev / headless tests only (never on the live hosts)
    api._testApplyMyState = (s) => setFrozen(s); api._mockPid = mockPid; api._state = st;
    try { if (window.PFP && !Object.isFrozen(window.PFP)) window.PFP.admin = api; } catch {}
    window.PFP_ADMIN = api;
  }
  return api;
}
