// PUMPFUN PIRATES · [v346] BANKSY's owner ADMIN MENU world tools (js/adminMenu.js mounts them inside #pfp-admin):
//   ☀️ TIME & WEATHER (t1819u "Give me time and weather control in admin menu"): time presets + 24 h slider (phase 0 = 00:00 ... 0.75 = 18:00),
//     ⏸ FREEZE TIME / ▶ RUN CLOCK, storm presets + intensity slider (game.stormOverride), ⚡ LIGHTNING, 🌐 SYNC ALL (every pirate) or LOCAL.
//   🧱 COLLISIONS (t1820u "add remove or move collisions"): 👁 SHOW (3D debug volumes within 140 m) + ✏️ EDIT (click to select, drag to move),
//     + BOX WALL / + CYLINDER (blockers '!col_*'), + PASS ZONE ('!noc_*' carves every check), move / resize / turn built-ins ('!cmod_<ob>'),
//     🗑 REMOVE ('!cdel_<ob>' for a built-in) + ↩ RESTORE.
// ZERO TRUST: the owner writes through the server (admin_world_put: owner-only, sanitized, pvp_terrain.pieces). The Realtime 'adm' poke
// { k: 'env' | 'col' } carries NO values: every pirate re-reads admin_world_get from the SERVER and applies only what it says.
import * as THREE from 'three';
import { phaseClock, phaseName } from './skyCycle.js';
import { escHtml } from './safe.js';

// ---------------- pure helpers (tests/v346AdminSkyAndCollisions.test.mjs) ----------------
export const TIME_PRESETS = [['auto', '🔄 AUTO', null], ['sunrise', '🌅 SUNRISE', 0.2604], ['noon', '☀️ NOON', 0.5], ['sunset', '🌇 SUNSET', 0.7396], ['night', '🌌 NIGHT', 0.9167], ['midnight', '🌑 MIDNIGHT', 0]];
export const STORM_PRESETS = [['auto', '🌤 AUTO', null], ['clear', '☀️ CLEAR', 0], ['squall', '🌦 SQUALL', 0.42], ['tempest', '⛈ TEMPEST', 1]];
export const SKY_CYCLE_MS = 1200 * 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (p) => (((Number(p) || 0) % 1) + 1) % 1;
export const sliderToPhase = (v) => clamp(Math.round(Number(v) || 0), 0, 1000) / 1000;
export const phaseToSlider = (p) => Math.round(wrap(p) * 1000) % 1000;
export const phaseBadge = (p) => `${phaseClock(p)} · ${phaseName(p).toUpperCase()}`;
export const DEFAULT_ENV = Object.freeze({ mode: 'auto', phase: 0.5, t: 0, storm: null, bolt: 0, bt: 0 });
/** where the sky is under an env at `now` (auto = the shared UTC clock) */
export function envPhase(env, now = Date.now()) { const e = env || DEFAULT_ENV;
  if (e.mode === 'hold') return wrap(e.phase);
  if (e.mode === 'run') return wrap(e.phase + (now - (e.t || now)) / SKY_CYCLE_MS);
  return wrap(now / SKY_CYCLE_MS); }
/** the owner's next env after one control: { k: 'time', id } | { k: 'slider', v } | { k: 'freeze' } | { k: 'storm', v } | { k: 'bolt' } */
export function envStep(cur, act, now = Date.now()) { const e = { ...DEFAULT_ENV, ...(cur || {}) };
  if (act.k === 'time') { const p = TIME_PRESETS.find(x => x[0] === act.id); if (!p) return e; if (p[2] === null) return { ...e, mode: 'auto', phase: envPhase(e, now), t: now };
    return { ...e, mode: e.mode === 'run' ? 'run' : 'hold', phase: p[2], t: now }; }
  if (act.k === 'slider') return { ...e, mode: e.mode === 'run' ? 'run' : 'hold', phase: sliderToPhase(act.v), t: now };
  if (act.k === 'freeze') { const ph = envPhase(e, now); return e.mode === 'hold' ? { ...e, mode: 'run', phase: ph, t: now } : { ...e, mode: 'hold', phase: ph, t: now }; }
  if (act.k === 'storm') return { ...e, storm: act.v === null || act.v === undefined ? null : clamp(Number(act.v) || 0, 0, 1) };
  if (act.k === 'stormPreset') { const p = STORM_PRESETS.find(x => x[0] === act.id); return p ? { ...e, storm: p[2] } : e; }
  if (act.k === 'bolt') return { ...e, bolt: (e.bolt | 0) + 1, bt: now };
  return e; }
/** make this client's sky + weather follow an env (sky = js/skyCycle.js API, game = main.js game) */
export function applyEnv(env, sky, game) { const e = env || DEFAULT_ENV;
  if (sky) { if (e.mode === 'hold') sky.setPhase(wrap(e.phase)); else if (e.mode === 'run') sky.runFrom(wrap(e.phase), e.t || Date.now()); else sky.clearPhase(); }
  if (game) { if (e.storm === null || e.storm === undefined) game.stormOverride = null; else { game.stormOverride = clamp(+e.storm, 0, 1); game.storm = game.stormOverride; } }
  return e; }
export const freezeLabel = (env) => (env?.mode === 'hold' ? '▶ RUN CLOCK' : '⏸ FREEZE TIME');
export const timeActive = (env) => { const e = env || DEFAULT_ENV; if (e.mode === 'auto') return 'auto'; const p = TIME_PRESETS.find(x => x[2] !== null && Math.abs(wrap(e.phase) - x[2]) < 0.0015); return e.mode === 'hold' && p ? p[0] : null; };
export const stormActive = (env) => { const s = env?.storm; if (s === null || s === undefined) return 'auto'; return (STORM_PRESETS.find(x => x[2] !== null && Math.abs(x[2] - s) < 0.006) || [null])[0]; };
// ---- collisions ----
export const COL_DEFAULT = { box: { s: 'box', w: 4, d: 1.2, h: 4 }, cyl: { s: 'cyl', r: 2, h: 4 }, noc: { s: 'box', w: 4, d: 4, h: 6 } };
export function newColId(kind, now = Date.now(), rnd = Math.random) { return `!${kind === 'noc' ? 'noc' : 'col'}_${now.toString(36)}${Math.floor(rnd() * 1679616).toString(36).padStart(4, '0')}`.slice(0, 29); }
/** a new blocker / pass zone 4 m in front of (x, z, yaw) standing on ground y */
export function spawnShape(kind, x, z, yaw, y) { const D = COL_DEFAULT[kind] || COL_DEFAULT.box, f = 4.5, cx = x + Math.sin(yaw) * f, cz = z + Math.cos(yaw) * f;
  const o = { s: D.s, x: +cx.toFixed(2), z: +cz.toFixed(2), y0: +(y - (kind === 'noc' ? 1.5 : 0.3)).toFixed(2), y1: +(y - (kind === 'noc' ? 1.5 : 0.3) + D.h).toFixed(2) };
  if (D.s === 'cyl') o.r = D.r; else { o.w = D.w; o.d = D.d; o.yaw = +(-yaw).toFixed(3); } return o; }
/** one field edit from the panel (rot in degrees); returns a new record */
export function editShape(rec, field, value) { const o = { ...rec }, v = Number(value); if (!Number.isFinite(v)) return o;
  if (field === 'x' || field === 'z') o[field] = clamp(v, -1500, 1500);
  else if (field === 'y0') { o.y0 = clamp(v, -60, 400); if (o.y1 !== undefined && o.y1 < o.y0 + 0.2) o.y1 = o.y0 + 0.2; }
  else if (field === 'y1') { o.y1 = clamp(v, -60, 400); if (o.y0 !== undefined && o.y1 < o.y0 + 0.2) o.y0 = o.y1 - 0.2; }
  else if (field === 'w') { if (o.s === 'cyl') o.r = clamp(v / 2, 0.2, 60); else o.w = clamp(v, 0.2, 120); }
  else if (field === 'r') o.r = clamp(v, 0.2, 60);
  else if (field === 'd') o.d = clamp(v, 0.2, 120);
  else if (field === 'rot') o.yaw = clamp(v * Math.PI / 180, -7, 7);
  return o; }

// ---------------- runtime ----------------
export const WORLD_CSS = `
#pfp-admin .tw,#pfp-admin .cl{border:1px solid #d9a93c44;border-radius:12px;padding:7px;background:#0c0b09;margin-bottom:4px}
#pfp-admin .g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
#pfp-admin .g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
#pfp-admin .tw button,#pfp-admin .cl button{font:600 11px system-ui,sans-serif;padding:6px 4px;border-radius:9px;border:1px solid #d9a93c66;background:#1b1712;color:#f3e3b5;cursor:pointer;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pfp-admin .tw button.on,#pfp-admin .cl button.on{background:linear-gradient(#ffd36b,#c78d1c);color:#161007;border-color:#fff1c4}
#pfp-admin .tw button.bolt{border-color:#9fd8ff;color:#d8f1ff}
#pfp-admin .sl{display:flex;align-items:center;gap:8px;margin:7px 0 5px}
#pfp-admin .sl input[type=range]{flex:1;min-width:0;accent-color:#ffd36b}
#pfp-admin .badge{font:700 11px system-ui;min-width:104px;text-align:center;padding:3px 6px;border-radius:999px;background:#2a1f0c;border:1px solid #d9a93c88;color:#ffe3a0}
#pfp-admin .tw .wide{width:100%;margin-bottom:6px}
#pfp-admin h4 .sync{font-size:10px}
#pfp-admin h4 .sync.on{border-color:#63e6f0;color:#a8f6ff}
#pfp-admin .sv{font:600 10px system-ui;color:#8fe3a0;letter-spacing:.04em}
#pfp-admin .sv.busy{color:#ffd36b}
#pfp-admin .sv.err{color:#ff8a8a}
#pfp-admin .cl .g3{margin-top:5px}
#pfp-admin .cl .add-noc{border-color:#25e878;color:#9df5c0}
#pfp-admin .cl .sel{margin-top:6px;padding:6px;border-radius:10px;border:1px solid #ffffff18;background:#ffffff06}
#pfp-admin .cl .sel .t{font-weight:700;color:#fff3d0;font-size:12px;margin-bottom:5px;display:flex;align-items:center;gap:6px}
#pfp-admin .cl .sel .t i{width:10px;height:10px;border-radius:3px;display:inline-block;flex:none}
#pfp-admin .cl .f{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
#pfp-admin .cl .f label{display:flex;flex-direction:column;font:600 9px system-ui;letter-spacing:.06em;color:#bba77a;min-width:0}
#pfp-admin .cl .f input{background:#15120e;color:#f3e3b5;border:1px solid #d9a93c55;border-radius:7px;padding:4px;font:12px system-ui;min-width:0;width:100%;box-sizing:border-box}
#pfp-admin .cl .ng{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;margin-top:5px}
#pfp-admin .cl .del{border-color:#ff5b6e;color:#ffb3bd}
#pfp-admin .cl .rest{margin-top:6px;font-size:11px;color:#bba77a}
#pfp-admin .cl .rest .r{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #ffffff0d}
#pfp-admin .cl .hint{font-size:10px;color:#9c8b66;margin-top:5px}
`;
const C_OB = 0xffb340, C_COL = 0xff3b5c, C_NOC = 0x25e878, C_MOD = 0x3ce8ff, C_DEL = 0x9a8f80;
const HEX = { ob: '#ffb340', col: '#ff3b5c', noc: '#25e878', mod: '#3ce8ff', del: '#9a8f80' };

export function createWorldAdmin(o) {
  const { dock, game, camera, canvas, call, send, toast, isOwner, invRead } = o;
  const st = { env: { ...DEFAULT_ENV }, sync: true, world: {}, show: false, edit: false, sel: null, saving: 0, saved: true, err: '', restOpen: false, lastFetch: 0, fetchT: 0, lastBolt: -1, firstFetch: true, obN: -1, at: null };
  const FMod = () => dock()?.layout?.FM || null;
  const sky = () => globalThis.__pfpSky ? { setPhase: globalThis.__pfpSky.setPhase, clearPhase: globalThis.__pfpSky.clearPhase, runFrom: globalThis.__pfpSky.cycle?.runFrom } : null;
  const skyApi = () => { const s = sky(); return s && s.runFrom ? s : null; };
  // ---- the SERVER's world -> this client (everyone) ----
  function applyWorld(world, fromServer = true) {
    st.world = { ...(world || {}) };
    const env = st.world['!env'];
    if (!(isOwner() && !st.sync && fromServer)) { // the owner in LOCAL keeps his own sky
      const e = env ? { ...DEFAULT_ENV, ...env } : { ...DEFAULT_ENV };
      if (!(isOwner() && fromServer && st.envDirty)) { st.env = e; applyEnv(e, skyApi(), game); }
      const b = env ? env.bolt | 0 : 0; // ⚡ a NEW bolt the server saved in the last 15 s strikes here too (never on the first read, never twice)
      if (st.lastBolt >= 0 && b > st.lastBolt && Date.now() - (env?.bt || 0) < 15000 && st.myBolt !== b) game.adminBolt = 1;
      st.lastBolt = Math.max(st.lastBolt, b); }
    applyCols(); paint(); }
  function applyCols() { const FM = FMod(); if (!FM?.applyAdminColliders) return false; FM.applyAdminColliders(st.world); st.obN = FM.MAP_CIRCS().length + FM.MAP_BOXES().length; st.vizDirty = true; return true; }
  async function fetchWorld() { st.lastFetch = performance.now(); const r = await invRead('admin_world_get').catch(() => null);
    if (r?.ok && r.world && typeof r.world === 'object') { st.at = r.at; applyWorld(r.world, true); } return r; }
  function poke(m) { if (!m || typeof m !== 'object' || (m.k !== 'env' && m.k !== 'col')) return false; // values are never read from the poke
    const wait = Math.max(0, 600 - (performance.now() - st.lastFetch)); clearTimeout(st.fetchT); st.fetchT = setTimeout(() => fetchWorld(), wait + Math.random() * 250); return true; }
  // ---- owner writes ----
  let envT = 0, envPend = false;
  function setEnv(next, now = false) { st.env = next; st.envDirty = true; applyEnv(next, skyApi(), game); paintEnv();
    if (!st.sync) { st.envDirty = false; return; } envPend = true; clearTimeout(envT); envT = setTimeout(flushEnv, now ? 0 : 250); }
  async function flushEnv() { if (!envPend) return; envPend = false; const r = await call('admin_world_put', { set: { '!env': st.env } });
    st.envDirty = envPend; if (r?.ok) { st.world['!env'] = r.world?.['!env'] ?? { ...st.env }; send('adm', { k: 'env' }); } else toast(`sky sync: ${r?.error || 'offline'}`); }
  function bolt() { const next = envStep(st.env, { k: 'bolt' }); game.adminBolt = 1; if (st.sync) { st.myBolt = next.bolt; st.lastBolt = next.bolt; setEnv(next, true); } else st.env = next; }
  // ---- collisions: records + save ----
  const pend = new Map(); let colT = 0;
  function put(id, rec) { if (rec) st.world[id] = rec; else delete st.world[id]; pend.set(id, rec || null); applyCols(); st.saved = false; paintSave(); clearTimeout(colT); colT = setTimeout(flushCols, 400); }
  async function flushCols() { if (!pend.size) return; const set = Object.fromEntries(pend); pend.clear(); st.saving++; paintSave();
    const r = await call('admin_world_put', { set }); st.saving--; if (r?.ok) { st.err = ''; if (!pend.size) st.saved = true; send('adm', { k: 'col' }); } else { st.err = r?.error || 'offline'; for (const [k, v] of Object.entries(set)) if (!pend.has(k)) pend.set(k, v); }
    paintSave(); }
  // selection = { kind: 'col' | 'noc' | 'ob', id: piece id ('!col_*' / '!noc_*') or the built-in's ob id }
  function selRec() { const s = st.sel; if (!s) return null; if (s.kind !== 'ob') return st.world[s.id] || null; const FM = FMod(); if (!FM) return null;
    const mod = st.world['!cmod_' + s.id]; if (mod) return mod; const ob = FM.obstacleIds().get(s.id); return ob ? FM.obstacleShape({ ...ob, x: ob.ox ?? ob.x, z: ob.oz ?? ob.z }) : null; }
  function setSel(rec) { const s = st.sel; if (!s || !rec) return; if (s.kind === 'ob') { const { s: sh, x, z, w, d, yaw, r } = rec; put('!cmod_' + s.id, sh === 'cyl' ? { s: sh, x, z, r } : { s: sh, x, z, w, d, yaw }); } else put(s.id, rec); paintSel(); }
  function meFoot() { const d = dock(), FM = FMod(), L = d?.layout; if (!d || !FM || !L) return null; const w = d.onFoot ? d.walker?.w : null, s = o.player?.();
    const hx = w ? w.x : (s?.x || 0), hz = w ? w.z : (s?.z || 0), [x, z] = L.harborToFoot(hx, hz), yaw = w ? w.yaw : (s?.yaw || 0);
    const g = d.world?.stand ? d.world.stand(hx, hz) : FM.H(x, z); return { x, z, yaw, y: Number.isFinite(g) ? g : 0, hx, hz, fy: w ? w.y : g }; }
  function add(kind) { const me = meFoot(); if (!me) return toast('go ashore / sail into the Harbor first'); const id = newColId(kind), rec = spawnShape(kind === 'cyl' ? 'cyl' : kind, me.x, me.z, me.yaw, me.y);
    put(id, rec); st.sel = { kind: kind === 'noc' ? 'noc' : 'col', id }; if (!st.show) st.show = true; if (!st.edit) st.edit = true; toast(kind === 'noc' ? '🟩 PASS ZONE ADDED · nothing blocks inside it' : kind === 'cyl' ? '🔴 CYLINDER ADDED' : '🔴 BOX WALL ADDED'); paint(); }
  function remove() { const s = st.sel; if (!s) return; if (s.kind === 'ob') { put('!cmod_' + s.id, null); put('!cdel_' + s.id, { d: 1 }); toast('🗑 BUILT-IN COLLIDER REMOVED · ↩ RESTORE anytime'); }
    else { put(s.id, null); st.sel = null; toast('🗑 COLLIDER DELETED'); } paint(); }
  function restore(ob) { put('!cdel_' + ob, null); toast('↩ COLLIDER RESTORED'); paint(); }
  const removedList = () => Object.keys(st.world).filter(k => k.startsWith('!cdel_')).map(k => k.slice(6));
  // ---- 👁 the 3D debug volumes (foot frame, under the island's footGroup) ----
  const G = { root: null, box: null, cyl: null, eb: null, ec: null, mats: {}, list: [], at: null };
  function mats(col, ghost) { const k = col + (ghost ? 'g' : ''); return G.mats[k] ||= { fill: new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: ghost ? 0.04 : 0.2, depthWrite: false, side: THREE.DoubleSide }),
    line: new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: ghost ? 0.35 : 0.95, depthTest: false }), hi: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }) }; }
  function ensureRoot() { const fg = dock()?.world?.footGroup; if (!fg) return null; if (G.root && G.root.parent === fg) return G.root;
    G.root = new THREE.Group(); G.root.name = 'admin_colliders'; G.root.renderOrder = 998; fg.add(G.root);
    G.box ||= new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); G.cyl ||= new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0);
    G.eb ||= new THREE.EdgesGeometry(G.box); G.ec ||= new THREE.EdgesGeometry(new THREE.CylinderGeometry(1, 1, 1, 24, 1).translate(0, 0.5, 0)); return G.root; }
  function vol(shape, y0, y1, col, kind, id, ghost) { const cyl = shape.s === 'cyl', m = mats(col, ghost), sel = st.sel && st.sel.kind === kind && st.sel.id === id;
    const g = new THREE.Group(), fill = new THREE.Mesh(cyl ? G.cyl : G.box, sel ? m.hi : m.fill), wire = new THREE.LineSegments(cyl ? G.ec : G.eb, m.line);
    fill.userData.pick = { kind, id }; fill.renderOrder = 998; wire.renderOrder = 999; g.add(fill, wire); const h = Math.max(0.2, y1 - y0);
    g.position.set(shape.x, y0, shape.z); if (cyl) g.scale.set(shape.r, h, shape.r); else { g.scale.set(shape.w, h, shape.d); g.rotation.y = shape.yaw || 0; } return g; }
  function rebuildViz(me) { const root = ensureRoot(), FM = FMod(); if (!root || !FM) return; for (const c of [...root.children]) root.remove(c); if (!st.show) { root.visible = false; return; } root.visible = true;
    const R = 140, near = (x, z) => Math.hypot(x - me.x, z - me.z) < R + 30, gy = (x, z) => { const a = FM.areaDeckAt ? FM.areaDeckAt(x, z) : null; return Math.max(FM.H(x, z), a ?? -1e9); };
    for (const b of FM.obstaclesNear(me.x, me.z, R)) { if (b.off) continue; if (b.mod) continue; if (b.del && !st.edit) continue; const y = gy(b.shape.x, b.shape.z) - 0.2;
      root.add(vol(b.shape, y, y + 3.2, b.del ? C_DEL : C_OB, 'ob', b.id, b.del)); }
    for (const [id, v] of Object.entries(st.world)) { if (!v || typeof v !== 'object') continue;
      if (id.startsWith('!col_') || id.startsWith('!noc_')) { if (!near(v.x, v.z)) continue; root.add(vol(v, v.y0, v.y1, id[1] === 'n' ? C_NOC : C_COL, id[1] === 'n' ? 'noc' : 'col', id)); }
      else if (id.startsWith('!cmod_')) { if (!near(v.x, v.z) || st.world['!cdel_' + id.slice(6)]) continue; const y = gy(v.x, v.z) - 0.2; root.add(vol(v, y, y + 3.2, C_MOD, 'ob', id.slice(6))); } }
    G.at = { x: me.x, z: me.z }; st.vizDirty = false; G.n = root.children.length; }
  // ---- ✏️ click to select, drag to move (capture phase: the walker / camera never see a press that lands on a collider) ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  let drag = null;
  function pickAt(e) { const cv = canvas || document.querySelector('canvas'); if (!cv || !G.root?.visible || !camera) return null; const r = cv.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const fills = []; G.root.traverse(x => { if (x.userData.pick) fills.push(x); }); const h = ray.intersectObjects(fills, false)[0]; return h ? { ...h.object.userData.pick, point: h.point } : null; }
  function footPoint(e, y) { const cv = canvas || document.querySelector('canvas'), r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); plane.constant = -y; if (!ray.ray.intersectPlane(plane, hit)) return null; const p = G.root.parent.worldToLocal(hit.clone()); return { x: p.x, z: p.z }; }
  function onDown(e) { if (!isOwner() || !st.edit || !st.show || e.button > 0) return; if (e.target !== (canvas || document.querySelector('canvas'))) return; const p = pickAt(e); if (!p) return;
    e.stopImmediatePropagation(); e.preventDefault(); st.sel = { kind: p.kind, id: p.id }; const rec = selRec(); st.vizDirty = true; paint();
    if (rec && !(p.kind === 'ob' && st.world['!cdel_' + p.id])) { const y = p.point.y, f = footPoint(e, y); if (f) drag = { y, dx: rec.x - f.x, dz: rec.z - f.z, id: e.pointerId, moved: false }; } }
  function onMove(e) { if (!drag || e.pointerId !== drag.id) return; e.stopImmediatePropagation(); e.preventDefault(); const f = footPoint(e, drag.y); if (!f) return; const rec = selRec(); if (!rec) return;
    rec2 = { ...rec, x: +(f.x + drag.dx).toFixed(2), z: +(f.z + drag.dz).toFixed(2) }; drag.moved = true; liveSet(rec2); }
  let rec2 = null;
  function liveSet(rec) { const s = st.sel; if (!s) return; const id = s.kind === 'ob' ? '!cmod_' + s.id : s.id; const v = s.kind === 'ob' ? (rec.s === 'cyl' ? { s: rec.s, x: rec.x, z: rec.z, r: rec.r } : { s: rec.s, x: rec.x, z: rec.z, w: rec.w, d: rec.d, yaw: rec.yaw }) : rec;
    st.world[id] = v; applyCols(); paintSelVals(); }
  function onUp(e) { if (!drag || e.pointerId !== drag.id) return; e.stopImmediatePropagation(); const moved = drag.moved; drag = null; if (moved && rec2) { setSel(rec2); toast('✋ COLLIDER MOVED'); } rec2 = null; }
  if (typeof addEventListener === 'function') { addEventListener('pointerdown', onDown, true); addEventListener('pointermove', onMove, true); addEventListener('pointerup', onUp, true);
    addEventListener('keydown', (e) => { if (!isOwner() || !st.edit || !st.sel) return; const t = e.target?.tagName; if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
      if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); remove(); } }, true); }
  // ---- the panel ----
  let box = null;
  function html() { return `<h4>☀️ TIME & WEATHER <button data-w="sync" class="sync">🌐 SYNC ALL: ON</button></h4>
    <div class="tw"><div class="g3">${TIME_PRESETS.map(p => `<button data-w="time" data-id="${p[0]}">${p[1]}</button>`).join('')}</div>
      <div class="sl"><input type="range" min="0" max="999" step="1" data-wi="time" aria-label="time of day"><span class="badge" data-wb="time">12:00 · SUNNY</span></div>
      <button class="wide" data-w="freeze">⏸ FREEZE TIME</button>
      <div class="g3">${STORM_PRESETS.map(p => `<button data-w="storm" data-id="${p[0]}">${p[1]}</button>`).join('')}<button class="bolt" data-w="bolt">⚡ LIGHTNING</button><span></span></div>
      <div class="sl"><input type="range" min="0" max="100" step="1" data-wi="storm" aria-label="storm intensity"><span class="badge" data-wb="storm">STORM AUTO</span></div></div>
    <h4>🧱 COLLISIONS <span class="sv" data-wb="save">💾 SAVED</span></h4>
    <div class="cl"><div class="g2"><button data-w="show">👁 SHOW COLLISIONS</button><button data-w="edit">✏️ EDIT COLLISIONS</button></div>
      <div class="g3"><button data-w="add" data-id="box">+ BOX WALL</button><button data-w="add" data-id="cyl">+ CYLINDER</button><button class="add-noc" data-w="add" data-id="noc" title="+ PASS ZONE (UNBLOCK AREA)">+ PASS ZONE</button></div>
      <div class="sel" data-wb="sel" hidden></div><div class="rest" data-wb="rest"></div>
      <div class="hint">✏️ EDIT: click a volume to select · drag to move · Del removes · 🟧 built-in · 🟥 blocker · 🟩 pass zone · 🟦 moved</div></div>`; }
  function mount(container) { box = container; box.innerHTML = html(); paint(); }
  const q = (s) => box?.querySelector(s);
  function paintEnv() { if (!box) return; const e = st.env, now = Date.now(), ph = e.mode === 'auto' ? envPhase({ mode: 'auto' }, now) : envPhase(e, now), ta = timeActive(e), sa = stormActive(e);
    box.querySelectorAll('[data-w="time"]').forEach(b => b.classList.toggle('on', b.dataset.id === ta)); box.querySelectorAll('[data-w="storm"]').forEach(b => b.classList.toggle('on', b.dataset.id === sa));
    const ts = q('[data-wi="time"]'); if (ts && document.activeElement !== ts) ts.value = String(phaseToSlider(ph)); const tb = q('[data-wb="time"]'); if (tb) tb.textContent = phaseBadge(ph) + (e.mode === 'run' ? ' ▶' : e.mode === 'hold' ? ' ⏸' : '');
    const fz = q('[data-w="freeze"]'); if (fz) { fz.textContent = freezeLabel(e); fz.classList.toggle('on', e.mode === 'hold'); }
    const ss = q('[data-wi="storm"]'), cur = e.storm ?? (game.storm || 0); if (ss && document.activeElement !== ss) ss.value = String(Math.round(cur * 100)); const sb = q('[data-wb="storm"]'); if (sb) sb.textContent = e.storm === null || e.storm === undefined ? `STORM AUTO · ${Math.round(cur * 100)}%` : `STORM ${Math.round(e.storm * 100)}%`;
    const sy = q('[data-w="sync"]'); if (sy) { sy.textContent = st.sync ? '🌐 SYNC ALL: ON' : '📍 LOCAL ONLY'; sy.classList.toggle('on', st.sync); } }
  function paintSave() { const s = q('[data-wb="save"]'); if (!s) return; s.classList.toggle('busy', !!st.saving || !st.saved); s.classList.toggle('err', !!st.err);
    s.textContent = st.err ? `⚠ NOT SAVED · ${st.err}` : st.saving || !st.saved ? '⏳ SAVING…' : '💾 SAVED'; }
  function kindOf(s) { if (!s) return null; if (s.kind === 'ob') return st.world['!cdel_' + s.id] ? 'del' : st.world['!cmod_' + s.id] ? 'mod' : 'ob'; return s.kind; }
  function paintSel() { const el = q('[data-wb="sel"]'); if (!el) return; const rec = selRec(), k = kindOf(st.sel); el.hidden = !rec; if (!rec) return;
    const name = { ob: 'BUILT-IN COLLIDER', mod: 'BUILT-IN · MOVED', del: 'BUILT-IN · REMOVED', col: rec.s === 'cyl' ? 'BLOCKER CYLINDER' : 'BLOCKER BOX WALL', noc: 'PASS ZONE (UNBLOCK AREA)' }[k];
    const yv = k === 'col' || k === 'noc', cyl = rec.s === 'cyl', F = (f, l, v, stp = 0.1) => `<label>${l}<input type="number" step="${stp}" data-wf="${f}" value="${(+v).toFixed(f === 'rot' ? 0 : 2)}"></label>`;
    el.innerHTML = `<div class="t"><i style="background:${HEX[k]}"></i>${escHtml(name)} <small style="color:#9c8b66;font-weight:400">${escHtml(String(st.sel.id).replace(/^!/, ''))}</small></div>
      ${k === 'del' ? `<button data-w="restore" data-id="${escHtml(st.sel.id)}" style="width:100%">↩ RESTORE THIS COLLIDER</button>` : `<div class="f">${F('x', 'X', rec.x)}${F('z', 'Z', rec.z)}${yv ? F('y0', 'Y BOTTOM', rec.y0) + F('y1', 'Y TOP', rec.y1) : ''}${cyl ? F('r', 'RADIUS', rec.r) : F('w', 'WIDTH', rec.w) + F('d', 'DEPTH', rec.d) + F('rot', 'ROTATE°', (rec.yaw || 0) * 180 / Math.PI, 5)}</div>
      <div class="ng"><button data-w="nudge" data-id="-x" title="west 0.5 m">◀</button><button data-w="nudge" data-id="+z" title="south 0.5 m">▼</button><button data-w="nudge" data-id="-z" title="north 0.5 m">▲</button><button data-w="nudge" data-id="+x" title="east 0.5 m">▶</button>${yv ? '<button data-w="nudge" data-id="+y" title="up 0.5 m">⤒</button><button data-w="nudge" data-id="-y" title="down 0.5 m">⤓</button>' : '<span></span><span></span>'}</div>
      <div class="g2" style="margin-top:5px"><button data-w="tome">📍 MOVE TO ME</button><button class="del" data-w="remove">🗑 REMOVE SELECTED</button></div>`}`; }
  function paintSelVals() { const rec = selRec(); if (!rec || !box) return; for (const i of box.querySelectorAll('[data-wf]')) { if (document.activeElement === i) continue; const f = i.dataset.wf; const v = f === 'rot' ? (rec.yaw || 0) * 180 / Math.PI : rec[f]; if (v !== undefined) i.value = (+v).toFixed(f === 'rot' ? 0 : 2); } }
  function paintRest() { const el = q('[data-wb="rest"]'); if (!el) return; const L = removedList();
    el.innerHTML = `<button data-w="rest" style="width:100%">↩ RESTORE REMOVED (${L.length})</button>${st.restOpen ? (L.length ? L.map(id => `<div class="r"><span>${escHtml(id)}</span><button data-w="restore" data-id="${escHtml(id)}">↩ RESTORE</button></div>`).join('') : '<div class="r">nothing removed</div>') : ''}`; }
  function paint() { if (!box) return; paintEnv(); paintSave(); const sh = q('[data-w="show"]'), ed = q('[data-w="edit"]');
    if (sh) { sh.classList.toggle('on', st.show); sh.title = st.show ? 'collisions shown (tap to hide)' : 'show collision volumes within 140 m'; } if (ed) { ed.classList.toggle('on', st.edit); ed.title = st.edit ? 'editing: click a volume, drag to move' : 'click to select + drag to move'; }
    paintSel(); paintRest(); }
  function click(b) { const w = b.dataset.w, id = b.dataset.id;
    if (w === 'sync') { st.sync = !st.sync; toast(st.sync ? '🌐 SYNC ALL · every pirate sees your sky' : '📍 LOCAL · only your screen'); if (st.sync) setEnv(st.env, true); else paintEnv(); return; }
    if (w === 'time') return setEnv(envStep(st.env, { k: 'time', id }));
    if (w === 'freeze') return setEnv(envStep(st.env, { k: 'freeze' }));
    if (w === 'storm') return setEnv(envStep(st.env, { k: 'stormPreset', id }));
    if (w === 'bolt') return bolt();
    if (w === 'show') { st.show = !st.show; if (!st.show) st.edit = false; st.vizDirty = true; return paint(); }
    if (w === 'edit') { st.edit = !st.edit; if (st.edit) st.show = true; st.vizDirty = true; return paint(); }
    if (w === 'add') return add(id);
    if (w === 'remove') return remove();
    if (w === 'restore') return restore(id);
    if (w === 'rest') { st.restOpen = !st.restOpen; return paintRest(); }
    if (w === 'tome') { const me = meFoot(), rec = selRec(); if (!me || !rec) return; const n = { ...rec, x: +(me.x + Math.sin(me.yaw) * 3).toFixed(2), z: +(me.z + Math.cos(me.yaw) * 3).toFixed(2) };
      if (n.y0 !== undefined) { const h = n.y1 - n.y0; n.y0 = +(me.y - 0.3).toFixed(2); n.y1 = +(n.y0 + h).toFixed(2); } return setSel(n); }
    if (w === 'nudge') { const rec = selRec(); if (!rec) return; const n = { ...rec }, s = id[0] === '+' ? 0.5 : -0.5, a = id[1]; if (a === 'y') { if (n.y0 === undefined) return; n.y0 += s; n.y1 += s; } else n[a] = +(n[a] + s).toFixed(2); return setSel(n); } }
  function input(el, final) { const k = el.dataset.wi, f = el.dataset.wf;
    if (k === 'time') return setEnv(envStep(st.env, { k: 'slider', v: el.value }));
    if (k === 'storm') return setEnv(envStep(st.env, { k: 'storm', v: (Number(el.value) || 0) / 100 }));
    if (f) { const rec = selRec(); if (!rec) return; const n = editShape(rec, f, el.value); if (final) setSel(n); else liveSet(n); } }
  // ---- per frame ----
  let lastObCheck = 0, lastViz = 0;
  function frame(now) { const FM = FMod(); if (!FM) return;
    if (now - lastObCheck > 2000) { lastObCheck = now; const n = FM.MAP_CIRCS().length + FM.MAP_BOXES().length; if (n !== st.obN && Object.keys(st.world).length) applyCols(); }   // area kits add colliders late
    if (now - st.lastFetch > 60000 && dock()?.on) fetchWorld();
    if (isOwner()) { if (st.show || G.root?.visible) { const me = meFoot(); if (me && (st.vizDirty || !G.at || Math.hypot(me.x - G.at.x, me.z - G.at.z) > 10 || now - lastViz > 1500)) { lastViz = now; rebuildViz(me); } }
      if (box && now - (frame._p || 0) > 500) { frame._p = now; paintEnv(); } } }
  return { st, fetchWorld, applyWorld, poke, mount, paint, click, input, frame, add, remove, restore, setEnv, envStep: (a) => setEnv(envStep(st.env, a)), bolt, selRec, select: (s) => { st.sel = s; st.vizDirty = true; paint(); }, flush: () => Promise.all([flushEnv(), flushCols()]), viz: G, pickAt };
}
