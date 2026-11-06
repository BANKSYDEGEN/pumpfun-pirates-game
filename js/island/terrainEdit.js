// [terrain-edit] PUMPFUN PIRATES owner BUILD MODE (BANKSY: "a terrain edit device and I'll level it where needed"; "Level, flatten,
// blend - make the buttons like Sims or Jurassic World"; "Make it so I can choose ring size").
// Everyone: the saved height deltas load at startup (localStorage copy first, then the pvp function) into foot.js TERRAIN, so the drawn
// ground, the walk / collision height and the followers all use the edited ground. The owner (the server says so in terrain_get) also
// gets a 🛠 BUILD button: a bottom toolbar of round tools (LEVEL / FLATTEN / BLEND / RAISE / LOWER), size S/M/L/XL + slider (1-40 m,
// wheel, [ ], pinch), strength, UNDO, RESET AREA, EXIT. Strokes paint where you point; saves go up (owner only, server-checked).
import * as THREE from 'three';
import { TERRAIN as T, H, pieceBlockers, PROP_CAT, propKit, propBlock, propUnblock, waterAt, CO } from './foot.js';
import { locatePoint } from '../islandGeography.js'; // [v335] rework flags name the district they sit in
import { terrainLoad, terrainSave } from '../pvpSave.js';
// [post/cottages] BANKSY's two Build Mode HOUSE pieces are village LOCATION MARKERS only —
// areas/cottages.js builds the real cottages. &cottages=0 restores the stock markers.
const COTTAGES_ON = !(typeof location !== 'undefined' && /[?&]cottages=0(&|$)/.test(location.search));
const COTTAGE_MARKERS = new Set(['+mw2osffcajh8', '+mw2oslf9ghm9']);
const LS = 'pfp_terrain_v1', LS_UI = 'pfp_tedit_ui';
const TOOLS = [
  { id: 'level', label: 'LEVEL', ico: '⛰️', tip: 'raise / lower toward the picked height (tap 🎯 to sample)' },
  { id: 'flatten', label: 'FLATTEN', ico: '🟫', tip: 'flatten to the height where the stroke starts' },
  { id: 'blend', label: 'BLEND', ico: '🌀', tip: 'smooth / soften edges' },
  { id: 'raise', label: 'RAISE', ico: '⬆️', tip: 'push the ground up' },
  { id: 'lower', label: 'LOWER', ico: '⬇️', tip: 'dig the ground down' },
  { id: 'paint', label: 'PAINT', ico: '🖌️', tip: 'paint the ground: pick grass, sand, dirt, rock or paved path' },
  { id: 'build', label: 'BUILD', ico: '🏗️', tip: 'pick a piece · tap to place · Q / E or ⟲ ⟳ turn · GRID / FREE snap · SELECT moves or deletes it' },
  { id: 'select', label: 'SELECT', ico: '👆', tip: 'tap a piece (shift / MULTI = add) · 🗑 / Delete hides it for everyone · arrows move · ⟲ ⟳ rotate' }, // [build-select] SELECT + PAINT finished: no longer hidden
  { id: 'rework', label: 'REWORK', ico: '🚩', tip: 'ONLY YOU SEE THESE: tap a part or the ground to drop a flag · PIN = that exact part · radius up to 160 m = a whole town · color + note say what to change' }];
// [v335] BANKSY t1777u/t1778u: "unlock" — nothing is LOCKED any more: Plaza shops + docks, Hill Street (with its signs) and every GLB / Kit unit can be
// selected, moved, turned, deleted (colliders off) and restored. BANKSY t1779u/t1781u: owner-only 🚩 REWORK flags (PIECES '!rw_*'), 8 colors + radius.
const RW = '!rw_', RW_COLORS = [['red', '#ff2e3b', 'RED'], ['blue', '#2f8bff', 'BLUE'], ['green', '#23d96b', 'GREEN'], ['gold', '#ffc933', 'GOLD'], ['purple', '#b84dff', 'PURPLE'], ['orange', '#ff7b1c', 'ORANGE'], ['cyan', '#1ee6eb', 'CYAN'], ['white', '#f4f7ff', 'WHITE']];
const RW_PRESETS = [[0, 'PIN'], [5, '5'], [15, '15'], [40, '40'], [80, '80 TOWN'], [140, '140 FULL']], RW_MAX = 160;
const rwHex = (c) => (RW_COLORS.find(k => k[0] === c) || RW_COLORS[0])[1], rwName = (c) => (RW_COLORS.find(k => k[0] === c) || RW_COLORS[0])[2];
// GLB / standalone units under the foot island that SELECT can move (terrain chunks, water, grass, outlines, placed + editor helpers are not units)
const UNIT = /^(plaza_(shop|dock)_|hill_(?!street|signs_merged|lod_)|battery_blender$|battery_pfp_flag$|lighthouse_|treasure_trader$|rb_fountain|fort_signs_|fort_walk_floor$|plaza_v2_signs$)/;
const HIST = 'pfp_tedit_hist';
const SIZES = { S: 3, M: 8, L: 16, XL: 30 };
const MATS = [['grass', '🌿', 'GRASS', '#6fcf4a'], ['sand', '🏖️', 'SAND', '#f2d9a0'], ['dirt', '🟤', 'DIRT', '#b8975f'], ['rock', '🪨', 'ROCK', '#939089'], ['path', '🧱', 'PATH', '#b3a690']];
export async function initTerrainEdit({ scene, camera, canvas, footRoot, walker, touch, toast = () => {} }) {
  // 1) everyone: cached deltas now, the server's when they answer
  // built-in pieces: every Kit / nature item under the foot island, by a stable id (build path + item key)
  const REG = new Map(), PIECES = new Map(), live = { on: false }; // id -> item ; id -> override
  const seen = new Set(); function scan() { const path = (o) => { const a = []; for (let x = o; x && x !== footRoot.parent; x = x.parent) { const sib = x.parent ? x.parent.children.filter(c => c.name === x.name) : [x]; a.push((x.name || 'g') + (sib.length > 1 ? ':' + sib.indexOf(x) : '')); } /* stable: names, so async area load order can't shift ids */ return a.reverse().join('/'); };
    footRoot.traverse(o => { const its = o.userData?.kitItems; if (!(its instanceof Map) || seen.has(its)) return; seen.add(its); const base = path(o.parent && !o.userData.bucket?.startsWith?.('sway') && o.isMesh && its === o.parent.userData.kitItems ? o.parent : o);
      for (const it of its.values()) { const id = base + '#' + it.key; it.id = id; const big = Math.max(it.box.max.x - it.box.min.x, it.box.max.z - it.box.min.z) > 24;
        it.locked = false; void big; it.label = (it.name || it.key.replace(/^p\d+$/, 'piece')).toUpperCase() + ' · ' + (base.split('/').slice(-2)[0] || '').split(':')[0].replace(/^(foot_|island_)/, ''); REG.set(id, it); if (PIECES.has(id)) applyGeo(it); } });
    // [v335] object units: '@' + stable path; hill buildings also own vertex ranges in the merged sign / phone meshes (hillStreet.js editRanges)
    const F = footRoot.parent || footRoot; F.updateWorldMatrix(true, true); const Finv = new THREE.Matrix4().copy(F.matrixWorld).invert();
    footRoot.traverse(o => { if (o.userData.editId || !o.name || o.userData.kitItems || o.name === 'placed' || !(UNIT.test(o.name) || (o.parent?.name?.startsWith('area_') && !o.parent.name.endsWith('_far') && o.isMesh))) return;
      for (let x = o.parent; x && x !== footRoot; x = x.parent) if (x.userData.editId) return; const id = '@' + path(o); if (REG.has(id)) return;
      let er = null; for (let x = o.parent; x && x !== footRoot; x = x.parent) if (x.userData.editRanges) { er = x; break; }
      const ranges = []; for (const [mn, a, n] of (er?.userData.editRanges?.[o.name] || [])) { const m = er.getObjectByName(mn); if (m?.isMesh) ranges.push([m, a, n]); }
      const box = new THREE.Box3().setFromObject(o).applyMatrix4(Finv), v = new THREE.Vector3();
      for (const [m, a, n] of ranges) { const P = m.geometry.attributes.position; for (let i = a; i < a + n; i += 3) box.expandByPoint(v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld).applyMatrix4(Finv)); }
      if (box.isEmpty() || !Number.isFinite(box.min.x)) return; o.userData.editId = id; const pw = o.getWorldPosition(new THREE.Vector3());
      for (const r of ranges) { r.c = r[0].worldToLocal(pw.clone()); (r[0].userData.unitRanges ||= []).push([r[1], r[2], id]); }
      const area = (path(o).split('/').find(x => /^area_|^plaza|^hill_street|^battery/.test(x)) || 'island').split(':')[0].replace(/^area_/, '');
      const it = { id, key: id, obj: o, isObj: true, locked: false, label: o.name.replace(/^(plaza_|hill_)/, (m0) => m0 === 'hill_' ? 'HILL STREET ' : 'PLAZA ').replace(/_/g, ' ').toUpperCase() + ' · ' + area.replace(/_/g, ' ').toUpperCase(),
        origPos: o.position.clone(), origRotY: o.rotation.y, origQuat: o.quaternion.clone(), box, ranges };
      REG.set(id, it); if (PIECES.has(id)) applyObj(it); }); }
  scan(); setInterval(() => { if (PIECES.size || live.on) scan(); }, 3000); // area kits (route, lagoon ...) build late: register + apply their saved state when they appear
  let rwHook = null; // [v335] owner only: redraws the 🚩 rework flags; everyone else keeps '!rw_*' (never sent to them anyway) as inert data
  function setPiece(id, ov) { if (id[0] === '+') return placeSet(id, ov); if (id.startsWith(RW)) { ov && ov.rework ? PIECES.set(id, ov) : PIECES.delete(id); rwHook?.(); return; }
    ov && (ov.h || ov.dx || ov.dy || ov.dz || ov.ry) ? PIECES.set(id, ov) : PIECES.delete(id); const it = REG.get(id); if (it) it.isObj ? applyObj(it) : applyGeo(it); }
  // [v335] an object unit (Plaza shop / dock LOD, Hill Street building + its sign, battery, lighthouse ...): position / turn about its origin, or hide it + its colliders
  function applyObj(it) { const ov = PIECES.get(it.id) || null, prev = it.cur || null; it.cur = ov; const o = it.obj, ry = ov?.ry || 0;
    o.visible = !ov?.h; o.position.set(it.origPos.x + (ov?.dx || 0), it.origPos.y + (ov?.dy || 0), it.origPos.z + (ov?.dz || 0)); o.quaternion.copy(it.origQuat).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry)); o.updateMatrixWorld(true);
    const cs = Math.cos(ry), sn = Math.sin(ry), done = new Set();
    for (const r of it.ranges) { const [m, a, n] = r, P = m.geometry.attributes.position, N = m.geometry.attributes.normal, c = r.c; if (!r.orig) { r.orig = P.array.slice(a * 3, (a + n) * 3); r.on = N ? N.array.slice(a * 3, (a + n) * 3) : null; }
      for (let i = 0; i < n; i++) { const k = (a + i) * 3, x = r.orig[i * 3] - c.x, y = r.orig[i * 3 + 1], z = r.orig[i * 3 + 2] - c.z;
        if (ov?.h) { P.array[k] = c.x; P.array[k + 1] = -500; P.array[k + 2] = c.z; continue; }
        P.array[k] = c.x + x * cs + z * sn + (ov?.dx || 0); P.array[k + 1] = y + (ov?.dy || 0); P.array[k + 2] = c.z - x * sn + z * cs + (ov?.dz || 0);
        if (r.on) { const nx = r.on[i * 3], nz = r.on[i * 3 + 2]; N.array[k] = nx * cs + nz * sn; N.array[k + 2] = -nx * sn + nz * cs; } }
      P.needsUpdate = true; if (N) N.needsUpdate = true; done.add(m.geometry); }
    for (const g of done) g.computeBoundingSphere();
    if (!!prev?.h !== !!ov?.h) pieceBlockers(it.box, !!ov?.h); }
  function applyGeo(it) { const ov = PIECES.get(it.id) || null, prev = it.cur || null; it.cur = ov;
    for (const r of it.ranges) { const [m, a, n] = r, P = m.geometry.attributes.position, N = m.geometry.attributes.normal; if (!r.orig) { r.orig = P.array.slice(a * 3, (a + n) * 3); r.on = N ? N.array.slice(a * 3, (a + n) * 3) : null; }
      const c = it.box.getCenter(new THREE.Vector3()), cs = Math.cos(ov?.ry || 0), sn = Math.sin(ov?.ry || 0);
      for (let i = 0; i < n; i++) { const k = (a + i) * 3, x = r.orig[i * 3] - c.x, y = r.orig[i * 3 + 1], z = r.orig[i * 3 + 2] - c.z;
        if (ov?.h) { P.array[k] = c.x; P.array[k + 1] = -500; P.array[k + 2] = c.z; continue; }
        P.array[k] = c.x + x * cs + z * sn + (ov?.dx || 0); P.array[k + 1] = y + (ov?.dy || 0); P.array[k + 2] = c.z - x * sn + z * cs + (ov?.dz || 0);
        if (r.on) { const nx = r.on[i * 3], nz = r.on[i * 3 + 2]; N.array[k] = nx * cs + nz * sn; N.array[k + 2] = -nx * sn + nz * cs; } }
      P.needsUpdate = true; if (N) N.needsUpdate = true; }
    if (!!prev?.h !== !!ov?.h) pieceBlockers(it.box, !!ov?.h); }
  function replacePieces(obj) { const next = obj || {}; for (const id of [...PIECES.keys()]) if (!next[id]) setPiece(id, null); for (const [id, ov] of Object.entries(next)) setPiece(id, ov); }
  const dumpPieces = () => Object.fromEntries(PIECES);
  // [build-place] owner-placed props: PIECES '+id' = { t: catalog index, x, y, z, ry } (foot frame). One merged template per type, every copy
  // drawn INSTANCED (a few draw calls per type), with its collider / walk deck (foot.js propBlock); SELECT moves / turns / deletes them
  const LOW = !!touch, placeRoot = new THREE.Group(); placeRoot.name = 'placed'; footRoot.add(placeRoot); const TYPES = new Map(), SLOT = new Map(), BLK = new Map();
  function islandMats() { const mats = {}, outs = {}; footRoot.traverse(o => { if (!o.isMesh || o.isInstancedMesh) return; if (o.userData.bucket && !mats[o.userData.bucket]) mats[o.userData.bucket] = o.material; if (o.name === 'island_outline') outs.plain = o.material; if (o.name === 'island_outline_sway') outs.sway = o.material; });
    const any = mats.toon || Object.values(mats)[0] || new THREE.MeshLambertMaterial({ vertexColors: true }); return { mats: new Proxy(mats, { get: (m, k) => m[k] || any }), outs: { plain: outs.plain || new THREE.MeshBasicMaterial({ color: 0x161616, side: THREE.BackSide }), sway: outs.sway || outs.plain } }; }
  function typeOf(t) { let ty = TYPES.get(t); if (ty) return ty; const P = PROP_CAT[t], { mats, outs } = islandMats(), g = propKit(P.id, LOW).build(mats, outs), parts = [];
    g.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(g); g.traverse(o => { if (o.isMesh) parts.push(o); });
    ty = { t, P, box, parts, meshes: [], ids: [], cap: 0 }; TYPES.set(t, ty); return ty; }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
  function redraw(ty) { if (ty.ids.length > ty.cap) { for (const m of ty.meshes) { placeRoot.remove(m); m.dispose(); } ty.cap = Math.max(16, ty.cap * 2, ty.ids.length);
      ty.meshes = ty.parts.map(o => { const m = new THREE.InstancedMesh(o.geometry, o.material, ty.cap); m.name = 'placed_' + ty.P.id; m.userData.placed = ty; m.frustumCulled = false; placeRoot.add(m); return m; }); }
    ty.ids.forEach((id, i) => { const r = PIECES.get(id); _m.compose(_p.set(r.x, r.y, r.z), _q.setFromAxisAngle(UP, r.ry || 0), _s); for (const m of ty.meshes) m.setMatrixAt(i, _m); });
    for (const m of ty.meshes) { m.count = ty.ids.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere?.(); } }
  function placeBox(ty, r) { return ty.box.clone().applyMatrix4(_m.compose(_p.set(r.x, r.y, r.z), _q.setFromAxisAngle(UP, r.ry || 0), _s)); }
  function placeSet(id, rec) { const old = PIECES.get(id); if (old) { const ty = typeOf(old.t), i = ty.ids.indexOf(id); if (i >= 0) ty.ids.splice(i, 1); propUnblock(BLK.get(id)); BLK.delete(id); PIECES.delete(id); REG.delete(id); redraw(ty); }
    if (!rec || !PROP_CAT[rec.t | 0]) return;
    // village markers: skip mesh + collider while the cottage neighborhood area is on
    if (COTTAGES_ON && COTTAGE_MARKERS.has(id)) { PIECES.set(id, { t: rec.t | 0, x: +rec.x || 0, y: +rec.y || 0, z: +rec.z || 0, ry: +rec.ry || 0, marker: 1 }); return; }
    rec = { t: rec.t | 0, x: +rec.x || 0, y: +rec.y || 0, z: +rec.z || 0, ry: +rec.ry || 0 }; const ty = typeOf(rec.t); PIECES.set(id, rec); ty.ids.push(id); redraw(ty);
    BLK.set(id, propBlock(ty.P.id, rec.x, rec.y, rec.z, rec.ry)); REG.set(id, { id, key: id, placed: true, locked: false, label: ty.P.label + ' · PLACED', box: placeBox(ty, rec), ranges: [] }); }
  const groundAt = (P, x, z) => { const h = H(x, z), w = P.water ? waterAt(x, z) : null; return w != null && w > h ? w : h; };
  try { const c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c?.cells) T.replace(c.cells); if (c?.pieces) replacePieces(c.pieces); if (c?.paint) T.replacePaint(c.paint); } catch {}
  let rev = 0, owner = false;
  const j = await terrainLoad(); if (j?.ok) { rev = j.rev | 0; owner = !!j.owner; T.replace(j.cells); replacePieces(j.pieces); T.replacePaint(j.paint); try { localStorage.setItem(LS, JSON.stringify({ rev, cells: j.cells, pieces: j.pieces || {}, paint: j.paint || {} })); } catch {} }
  if (!owner) return { owner: false };
  // 2) the owner's build mode
  const ui = Object.assign({ tool: 'level', size: 8, str: 0.5, mat: 'path', prop: 0, rot: 0, grid: true, rwColor: 'red', rwR: 0, rwShow: true }, (() => { try { return JSON.parse(localStorage.getItem(LS_UI) || '{}'); } catch { return {}; } })());
  if (!TOOLS.some(t => t.id === ui.tool)) ui.tool = 'level'; // [v183] a saved SELECT tool falls back to LEVEL while it is hidden
  const keepUi = () => { try { localStorage.setItem(LS_UI, JSON.stringify(ui)); } catch {} };
  let on = false, target = null, sampling = false, stroke = null, saveT = 0, ptr = null, pinch = null, multi = false; const sel = new Set();
  // ONE shared history for every tool (BANKSY: 'Add undo button'): cells strokes + piece changes, 60 steps, kept for the session (sessionStorage)
  let undo = [], redo = []; try { const h = JSON.parse(sessionStorage.getItem(HIST) || 'null'); if (h) { undo = h.u.map(dec); redo = h.r.map(dec); } } catch {}
  function enc(e) { return e.k === 'multi' ? { k: 'multi', e: e.e.map(enc) } : (e.k === 'cells' || e.k === 'paint') ? { k: e.k, o: [...e.o], n: [...e.n] } : e; } function dec(e) { return e.k === 'multi' ? { k: 'multi', e: e.e.map(dec) } : (e.k === 'cells' || e.k === 'paint') ? { k: e.k, o: new Map(e.o), n: new Map(e.n) } : e; }
  const keepHist = () => { try { sessionStorage.setItem(HIST, JSON.stringify({ u: undo.slice(-60).map(enc), r: redo.slice(-60).map(enc) })); } catch {} };
  const push = (e) => { undo.push(e); if (undo.length > 60) undo.shift(); redo = []; keepHist(); queueSave(); paint(); };
  const play = (e, back) => { if (e.k === 'multi') { for (const x of back ? [...e.e].reverse() : e.e) play(x, back); return; } if (e.k === 'paint') T.paint([...(back ? e.o : e.n)]); else if (e.k === 'cells') T.set([...(back ? e.o : e.n)]); else for (const [id, b, a] of e.c) setPiece(id, back ? b : a); drawSel(); };
  const css = document.createElement('style'); css.textContent = `
  #te-btn { position: fixed; top: calc(64px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 60; display: none; }
  /* [v190] BANKSY: "move the build button to settings": no floating HUD button; owner-only ⚙ SETTINGS entry (#btn-set-build) */
  #btn-set-build.off { opacity: .5; }
  .te-r { font-family: 'Just Another Hand', cursive; border-radius: 50%; border: 3px solid #ffcd77; background: radial-gradient(circle at 35% 30%, #3a2a1a, #161616 70%); color: #ffcd77;
    box-shadow: 0 4px 0 #000, 0 0 0 2px #000 inset; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; touch-action: manipulation; padding: 0; }
  #te-btn.te-r { width: 64px; height: 64px; font-size: 15px; } #te-btn .i { font-size: 26px; line-height: 1; }
  #te-ov { position: fixed; inset: 0; z-index: 55; display: none; touch-action: none; }
  #te-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 61; display: none; padding: 8px 10px calc(10px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, rgba(22,22,22,.92) 30%);
    font-family: 'Just Another Hand', cursive; color: #ffcd77; }
  .pfp-tedit #te-ov, .pfp-tedit #te-bar { display: block; } .pfp-tedit #te-btn { display: none; }
  .pfp-tedit #controls, .pfp-tedit #dk-acts, .pfp-tedit #dk-joy, .pfp-tedit #dk-jump, .pfp-tedit #dk-board-x, .pfp-tedit #dk-safe, .pfp-tedit .dk-acts, .pfp-tedit .dk-safe, .pfp-tedit [class*="joy"], .pfp-tedit [class*="jump"], .pfp-tedit [id*="emote"], .pfp-tedit [class*="emote-btn"], .pfp-tedit [class*="of-"] { display: none !important; }
  #te-bar .row { display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; }
  #te-bar .tool { width: 74px; height: 74px; font-size: 17px; } #te-bar .tool .i { font-size: 30px; line-height: 1; }
  #te-bar .tool.sel { border-color: #fff3c4; box-shadow: 0 0 18px 6px rgba(255,205,119,.85), 0 4px 0 #000; background: radial-gradient(circle at 35% 30%, #fa0d0d, #6a0505 75%); color: #fff; }
  #te-bar .sm { width: 52px; height: 52px; font-size: 13px; } #te-bar .sm .i { font-size: 22px; }
  #te-bar .exit { border-color: #fa0d0d; color: #fff; background: radial-gradient(circle at 35% 30%, #fa0d0d, #5a0000 75%); }
  #te-bar .grp { display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,.45); border: 2px solid #ffcd77; border-radius: 40px; padding: 4px 10px; font-size: 22px; }
  #te-bar .grp b { min-width: 58px; text-align: center; font-size: 26px; color: #fff; }
  #te-bar .pre { font-family: inherit; font-size: 20px; width: 40px; height: 40px; border-radius: 50%; border: 2px solid #ffcd77; background: #161616; color: #ffcd77; }
  #te-bar .pre.sel { background: #ffcd77; color: #161616; }
  #te-bar input[type=range] { width: 130px; height: 28px; accent-color: #fa0d0d; }
  #te-bar .tip { text-align: center; font-size: 20px; margin-top: 4px; color: #fff3c4; text-shadow: 0 2px 0 #000; }
  #te-bar .big { width: 70px; height: 70px; font-size: 16px; border-color: #fff3c4; } #te-bar .big .i { font-size: 28px; } #te-bar .sm[disabled] { opacity: .4; }
  #te-bar .paintrow { display: none; } #te-bar.paint-on .paintrow { display: flex; } #te-bar .sw { width: 56px; height: 56px; font-size: 14px; } #te-bar .sw .i { font-size: 22px; } #te-bar .sw.sel { box-shadow: 0 0 16px 5px rgba(255,205,119,.85), 0 4px 0 #000; border-color: #fff; }
  #te-bar .catrow { display: none; } #te-bar.build-on .catrow { display: flex; } #te-bar.build-on .brush { display: none; } #te-bar .cat { width: 62px; height: 62px; font-size: 14px; } #te-bar .cat .i { font-size: 26px; } #te-bar .cat.sel { box-shadow: 0 0 16px 5px rgba(255,205,119,.85), 0 4px 0 #000; border-color: #fff; background: radial-gradient(circle at 35% 30%, #fa0d0d, #6a0505 75%); color: #fff; }
  #te-bar .selrow { display: none; } #te-bar.sel-on .selrow { display: flex; } #te-bar.sel-on .brush { display: none; }
  #te-chip { position: fixed; z-index: 62; pointer-events: none; font-family: 'Just Another Hand', cursive; font-size: 20px; background: #161616; color: #ffcd77; border: 2px solid #ffcd77; border-radius: 14px; padding: 0 10px; transform: translate(-50%, -130%); display: none; white-space: nowrap; }
  #te-bar .reworkrow { display: none; } #te-bar.rw-on .reworkrow { display: flex; } #te-bar.rw-on .brush { display: none; }
  #te-bar .rwc { width: 46px; height: 46px; font-size: 12px; color: #161616; border-color: #161616; text-shadow: none; } #te-bar .rwc.sel { border-color: #fff; box-shadow: 0 0 14px 5px rgba(255,255,255,.85), 0 4px 0 #000; transform: scale(1.12); }
  #te-bar .rw-note { font-family: inherit; font-size: 22px; width: 240px; height: 40px; border-radius: 12px; border: 2px solid #ffcd77; background: #161616; color: #fff; padding: 0 10px; }
  #te-bar .rwn { font-size: 26px; color: #fff; min-width: 56px; text-align: center; } #te-bar .rwshow.sel { background: radial-gradient(circle at 35% 30%, #23d96b, #0b4a24 75%); color: #fff; }
  #te-rw-tags { position: fixed; inset: 0; z-index: 54; pointer-events: none; overflow: hidden; }
  #te-rw-tags .rwt { position: absolute; transform: translate(-50%, -100%); white-space: nowrap; font-family: 'Just Another Hand', cursive; font-size: 19px; line-height: 1.1; padding: 1px 9px 0; border-radius: 10px; background: rgba(22,22,22,.86); border: 2px solid; color: #fff; text-shadow: 0 1px 0 #000; }
  #te-rw-tags .rwt.sel { font-size: 23px; box-shadow: 0 0 14px 3px rgba(255,255,255,.6); }
  #te-rest { position: fixed; right: 10px; bottom: 210px; z-index: 63; max-height: 40vh; overflow: auto; background: rgba(22,22,22,.95); border: 2px solid #ffcd77; border-radius: 14px; padding: 8px; font-family: 'Just Another Hand', cursive; color: #ffcd77; font-size: 20px; display: none; }
  #te-rest button { font-family: inherit; font-size: 18px; margin-left: 6px; background: #ffcd77; color: #161616; border: 0; border-radius: 8px; }
  @media (max-width: 700px) { #te-bar .tool { width: 60px; height: 60px; font-size: 14px; } #te-bar .tool .i { font-size: 24px; } #te-bar input[type=range] { width: 96px; } #te-bar .row { gap: 6px; } #te-bar .row:first-child, #te-bar.build-on .catrow { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; scrollbar-width: none; } #te-bar .row > * { flex-shrink: 0; } #te-bar .cat { width: 54px; height: 54px; font-size: 12px; } #te-bar .cat .i { font-size: 22px; } } /* [build-place] phones: tools + catalog scroll sideways (one row each) */`;
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'te-btn'; btn.className = 'te-r'; btn.title = 'BUILD MODE (owner)'; btn.innerHTML = '<span class="i">🛠️</span>BUILD'; document.body.appendChild(btn);
  const ov = document.createElement('div'); ov.id = 'te-ov'; document.body.appendChild(ov);
  const bar = document.createElement('div'); bar.id = 'te-bar'; document.body.appendChild(bar);
  const r = (cls, ico, label, title = '') => `<button class="te-r ${cls}" title="${title}"><span class="i">${ico}</span>${label}</button>`;
  bar.innerHTML = `<div class="row">${TOOLS.map(t => r('tool" data-t="' + t.id, t.ico, t.label, t.tip)).join('')}
    ${r('sm pick', '🎯', 'PICK', 'LEVEL: sample a height (then tap the ground)')}</div>
    <div class="row paintrow" style="margin-top:6px">${MATS.map(([id, ico, lb, c]) => `<button class="te-r sw" data-p="${id}" title="${lb}" style="background:radial-gradient(circle at 35% 30%, ${c}, #161616 85%)"><span class="i">${ico}</span>${lb}</button>`).join('')}</div>
    <div class="row catrow" style="margin-top:6px">${PROP_CAT.map((c, i) => `<button class="te-r cat" data-c="${i}" title="${c.label}"><span class="i">${c.ico}</span>${c.label}</button>`).join('')}${r('sm prot" data-q="1', '⟲', 'TURN', 'Q')}${r('sm prot" data-q="-1', '⟳', 'TURN', 'E')}${r('sm snap', '#️⃣', 'GRID', 'GRID 1 m + 15° / FREE')}</div>
    <div class="row reworkrow" style="margin-top:6px">${RW_COLORS.map(([id, hex, lb]) => `<button class="te-r rwc" data-rwc="${id}" title="${lb} flag" style="background:${hex}">${lb}</button>`).join('')}
      <div class="grp">RADIUS ${RW_PRESETS.map(([v, lb]) => `<button class="pre rwp" data-rwr="${v}" style="width:auto;padding:0 8px;border-radius:20px">${lb}</button>`).join('')}<input type="range" class="rwr" min="0" max="${RW_MAX}" step="1"><b class="rwv"></b></div>
      <input class="rw-note" type="text" maxlength="140" placeholder="note: what to change here…" autocomplete="off" spellcheck="false"><b class="rwn">🚩 0</b>
      ${r('sm rwnew', '➕', 'NEW', 'next tap drops a NEW flag')}${r('sm rwdel', '🗑️', 'DEL FLAG', 'delete the selected flag')}${r('sm rwclear', '🧹', 'CLEAR ALL', 'remove every flag (UNDO brings them back)')}${r('sm rwshow', '👁️', 'IN-GAME', 'show your flags while playing (only you see them)')}</div>
    <div class="row" style="margin-top:8px">${r('big undo', '↩️', 'UNDO', 'UNDO (Ctrl+Z)')}${r('sm redo', '↪️', 'REDO', 'REDO (Ctrl+Shift+Z / Ctrl+Y)')}
    <span class="row selrow">${r('sm multi', '➕', 'MULTI', 'add to the selection')}${r('sm mv" data-m="-1,0', '⬅️', 'LEFT')}${r('sm mv" data-m="1,0', '➡️', 'RIGHT')}${r('sm mv" data-m="0,1', '⬆️', 'AWAY')}${r('sm mv" data-m="0,-1', '⬇️', 'NEAR')}${r('sm rot" data-r="1', '⟲', 'ROT')}${r('sm rot" data-r="-1', '⟳', 'ROT')}${r('sm del', '🗑️', 'DELETE')}${r('sm rest', '🧺', 'RESTORE')}</span>
    <span class="row brush"><div class="grp">SIZE ${Object.keys(SIZES).map(k => `<button class="pre" data-s="${k}">${k}</button>`).join('')}<input type="range" class="sz" min="1" max="40" step="0.5"><b class="szv"></b></div>
    <div class="grp">STRENGTH <button class="pre sdn">−</button><input type="range" class="st" min="0.1" max="1" step="0.1"><button class="pre sup">+</button></div>
    ${r('sm reset', '♻️', 'RESET', 'RESET AREA: clear edits inside the ring')}</span>${r('sm exit', '✖️', 'EXIT')}</div><div class="tip"></div>`;
  const chip = document.createElement('div'); chip.id = 'te-chip'; document.body.appendChild(chip); const rest = document.createElement('div'); rest.id = 'te-rest'; document.body.appendChild(rest);
  const $ = (q) => bar.querySelector(q), tip = $('.tip');
  const paint = () => { bar.classList.toggle('sel-on', ui.tool === 'select'); bar.classList.toggle('build-on', ui.tool === 'build'); bar.querySelectorAll('.cat').forEach(b => b.classList.toggle('sel', +b.dataset.c === ui.prop)); const sn = $('.snap'); sn.lastChild.textContent = ui.grid ? 'GRID' : 'FREE'; sn.classList.toggle('sel', ui.grid); bar.classList.toggle('paint-on', ui.tool === 'paint'); bar.querySelectorAll('.sw').forEach(b => b.classList.toggle('sel', b.dataset.p === ui.mat)); $('.undo').disabled = !undo.length; $('.redo').disabled = !redo.length; $('.multi').classList.toggle('sel', multi); bar.querySelectorAll('.tool').forEach(b => b.classList.toggle('sel', b.dataset.t === ui.tool));
    bar.querySelectorAll('.pre[data-s]').forEach(b => b.classList.toggle('sel', SIZES[b.dataset.s] === ui.size)); $('.sz').value = ui.size; $('.szv').textContent = ui.size + ' m'; $('.st').value = ui.str;
    bar.classList.toggle('rw-on', ui.tool === 'rework'); bar.querySelectorAll('.rwc').forEach(b => b.classList.toggle('sel', b.dataset.rwc === (rwCur()?.color || ui.rwColor)));
    const rr = rwCur() ? rwCur().r : ui.rwR; bar.querySelectorAll('.rwp').forEach(b => b.classList.toggle('sel', +b.dataset.rwr === rr)); $('.rwr').value = rr; $('.rwv').textContent = rr ? rr + ' m' : 'PIN';
    $('.rwn').textContent = '🚩 ' + rwIds().length; const sh = $('.rwshow'); sh.lastChild.textContent = ui.rwShow ? 'IN-GAME ON' : 'IN-GAME OFF'; sh.classList.toggle('sel', !!ui.rwShow); $('.rwdel').disabled = !rwCur(); $('.rwnew').classList.toggle('sel', !selReworkId);
    const t = TOOLS.find(t => t.id === ui.tool); tip.textContent = sampling ? 'tap the ground to pick the LEVEL height' : (t.tip + (ui.tool === 'level' ? ` · target ${target == null ? 'your feet' : target.toFixed(2) + ' m'}` : '')); keepUi(); };
  const setSize = (v) => { ui.size = Math.max(1, Math.min(40, Math.round(v * 2) / 2)); paint(); };
  bar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.c) ui.prop = +b.dataset.c; else if (b.dataset.q) turn(+b.dataset.q); else if (b.classList.contains('snap')) ui.grid = !ui.grid; else if (b.dataset.p) ui.mat = b.dataset.p; else if (b.dataset.t) { ui.tool = b.dataset.t; sampling = false; } else if (b.dataset.s) setSize(SIZES[b.dataset.s]);
    else if (b.classList.contains('sdn')) ui.str = Math.max(0.1, +(ui.str - 0.1).toFixed(1)); else if (b.classList.contains('sup')) ui.str = Math.min(1, +(ui.str + 0.1).toFixed(1));
    else if (b.dataset.rwc) rwSetColor(b.dataset.rwc); else if (b.dataset.rwr != null) rwSetR(+b.dataset.rwr, true); else if (b.classList.contains('rwnew')) { selReworkId = null; rwSync(); } else if (b.classList.contains('rwdel')) rwDelete(); else if (b.classList.contains('rwclear')) rwClear(); else if (b.classList.contains('rwshow')) { ui.rwShow = !ui.rwShow; rwDraw(); }
    else if (b.classList.contains('pick')) { ui.tool = 'level'; sampling = true; } else if (b.classList.contains('undo')) doUndo(); else if (b.classList.contains('redo')) doRedo(); else if (b.classList.contains('multi')) multi = !multi; else if (b.dataset.m) moveSel(...b.dataset.m.split(',').map(Number)); else if (b.dataset.r) editSel({ ry: +b.dataset.r * Math.PI / 12 }); else if (b.classList.contains('del')) delSel(); else if (b.classList.contains('rest')) showRestore(); else if (b.classList.contains('reset')) resetArea(); else if (b.classList.contains('exit')) setOn(false);
    paint(); });
  $('.rwr').addEventListener('input', (e) => rwSetR(+e.target.value, false)); $('.rwr').addEventListener('change', () => rwCommit());
  { const nt = $('.rw-note'); for (const ev of ['keydown', 'keyup', 'keypress']) nt.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && (e.key === 'Enter' || e.key === 'Escape')) nt.blur(); }); // typing a note never walks / shoots / opens menus
    nt.addEventListener('pointerdown', (e) => e.stopPropagation()); nt.addEventListener('input', () => { const v = nt.value.slice(0, 140); ui.rwNote = v; if (rwCur()) rwEdit({ note: v }); }); nt.addEventListener('change', () => rwCommit()); }
  $('.sz').addEventListener('input', (e) => setSize(+e.target.value)); $('.st').addEventListener('input', (e) => { ui.str = +e.target.value; paint(); });
  btn.addEventListener('click', () => setOn(true));
  addEventListener('keydown', (e) => { if (on && e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); setOn(false); } }, true); // [v190] Esc in build mode = EXIT only (not also ⚙ settings)
  { const pz = document.querySelector('#pause .panel'), res = document.getElementById('btn-resume'); if (pz) { const sb = document.createElement('button'); sb.id = 'btn-set-build'; sb.type = 'button'; sb.className = 'ghost'; sb.textContent = '🛠️ BUILD MODE';
      pz.insertBefore(sb, res || null); const sync = () => { const ok = document.documentElement.classList.contains('pfp-onfoot'); sb.classList.toggle('off', !ok); sb.title = ok ? 'owner build mode (EXIT / Esc to leave)' : 'go ashore first'; };
      new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); sync();
      sb.addEventListener('click', () => { if (!document.documentElement.classList.contains('pfp-onfoot')) { toast('GO ASHORE FIRST, THEN OPEN BUILD MODE'); return; }
        if (!document.getElementById('pause').classList.contains('hidden')) res?.click(); document.getElementById('pause').classList.add('hidden'); setOn(true); }); } }
  function setOn(v) { on = v; live.on = v; if (v) scan(); rwDraw(); document.documentElement.classList.toggle('pfp-tedit', v); ring.visible = grid.visible = false; if (ghost) ghost.visible = false; if (!v) { sel.clear(); drawSel(); rest.style.display = 'none'; flush(); } paint(); }
  // ring + height grid preview (in the foot island's frame: footRoot's parent)
  const frame = footRoot.parent || footRoot, N = 64, GN = 9;
  const ring = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)), new THREE.LineBasicMaterial({ color: 0xffcd77, depthTest: false, transparent: true }));
  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(GN * (GN - 1) * 2 * 2 * 3), 3)), new THREE.LineBasicMaterial({ color: 0xfa0d0d, depthTest: false, transparent: true, opacity: 0.6 }));
  ring.renderOrder = grid.renderOrder = 999; ring.frustumCulled = grid.frustumCulled = false; ring.visible = grid.visible = false; frame.add(ring, grid);
  let hit = null; const ray = new THREE.Raycaster(), inv = new THREE.Matrix4(), ndc = new THREE.Vector2();
  function pick(cx, cy) { const R = canvas.getBoundingClientRect(); ndc.set(((cx - R.left) / R.width) * 2 - 1, -((cy - R.top) / R.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    frame.updateWorldMatrix(true, false); inv.copy(frame.matrixWorld).invert(); const o = ray.ray.origin.clone().applyMatrix4(inv), d = ray.ray.direction.clone().transformDirection(inv);
    let t = 0, prev = null; for (let k = 0; k < 400; k++) { const p = o.clone().addScaledVector(d, t), h = H(p.x, p.z); if (p.y <= h) { if (!prev) return null; let a = t - 1.5, b = t; for (let m = 0; m < 8; m++) { const c = (a + b) / 2, q = o.clone().addScaledVector(d, c); if (q.y <= H(q.x, q.z)) b = c; else a = c; } const q = o.clone().addScaledVector(d, b); return { x: q.x, z: q.z, y: H(q.x, q.z) }; } prev = p; t += 1.5; if (t > 600) break; } return null; }
  function drawRing() { if (!hit) { ring.visible = grid.visible = false; return; } const P = ring.geometry.attributes.position, s = ui.size;
    for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, x = hit.x + Math.cos(a) * s, z = hit.z + Math.sin(a) * s; P.setXYZ(k, x, H(x, z) + 0.08, z); } P.needsUpdate = true;
    const Q = grid.geometry.attributes.position; let n = 0; const ty = ui.tool === 'level' ? target : null;
    for (let a = 0; a < GN; a++) for (let b = 0; b < GN - 1; b++) for (const [u0, v0, u1, v1] of [[a, b, a, b + 1], [b, a, b + 1, a]]) { const X = (u) => hit.x + (u / (GN - 1) * 2 - 1) * s * 0.7, Z = (v) => hit.z + (v / (GN - 1) * 2 - 1) * s * 0.7;
      const y = (x, z) => (ty != null ? ty : H(x, z)) + 0.1; Q.setXYZ(n++, X(u0), y(X(u0), Z(v0)), Z(v0)); Q.setXYZ(n++, X(u1), y(X(u1), Z(v1)), Z(v1)); }
    Q.needsUpdate = true; ring.visible = grid.visible = true; grid.material.color.set(ty != null ? 0x67e8f9 : 0xfa0d0d); }
  // the brush: falloff-weighted cell updates, one undo record per stroke
  function apply(dt) { if (!hit || !stroke) return; const s = ui.size, [ci, cj] = T.cell(hit.x, hit.z), R = Math.ceil(s / T.G) + 1, k = Math.min(1, ui.str * dt * 4), ch = [];
    if (ui.tool === 'paint') { const L = T.LAYERS[ui.mat] ?? 6, pc = [];
      for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) { if (i < 0 || j < 0 || i > T.NX || j > T.NZ) continue; const d = Math.hypot(T.X0 + i * T.G - hit.x, T.Z0 + j * T.G - hit.z); if (d > s) continue;
        const w = 0.5 + 0.5 * Math.cos(Math.PI * d / s), q = T.IDX(i, j), cur = T.paintMap.get(q) || null, base = cur && cur[0] === L ? cur[1] : 0, nv = Math.min(1, Math.round((base + k * 2.5 * w) * 100) / 100);
        if (cur && cur[0] === L && nv <= cur[1]) continue; if (!stroke.oldP.has(q)) stroke.oldP.set(q, cur); pc.push([q, [L, nv]]); }
      if (pc.length) T.paint(pc); return; }
    for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) { if (i < 0 || j < 0 || i > T.NX || j > T.NZ) continue;
      const x = T.X0 + i * T.G, z = T.Z0 + j * T.G, d = Math.hypot(x - hit.x, z - hit.z); if (d > s) continue; const w = 0.5 + 0.5 * Math.cos(Math.PI * d / s), q = T.IDX(i, j);
      const cur = T.base(q) + (T.delta.get(q) || 0); let nv = cur;
      if (ui.tool === 'raise') nv = cur + 1.5 * k * w; else if (ui.tool === 'lower') nv = cur - 1.5 * k * w;
      else if (ui.tool === 'flatten') nv = cur + (stroke.y - cur) * Math.min(1, k * 2 * w);
      else if (ui.tool === 'level') nv = cur + ((target ?? stroke.feet) - cur) * Math.min(1, k * 2 * w);
      else { let a = 0, c = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const qq = T.IDX(Math.min(T.NX, Math.max(0, i + di)), Math.min(T.NZ, Math.max(0, j + dj))); a += T.base(qq) + (T.delta.get(qq) || 0); c++; } nv = cur + (a / c - cur) * Math.min(1, k * 1.5 * w); }
      if (Math.abs(nv - cur) < 0.002) continue; if (!stroke.old.has(q)) stroke.old.set(q, T.delta.get(q) || 0); ch.push([q, nv - T.base(q)]); }
    if (ch.length) T.set(ch); }
  function endStroke() { if (stroke && stroke.old.size) { const n = new Map(); for (const q of stroke.old.keys()) n.set(q, T.delta.get(q) || 0); push({ k: 'cells', o: stroke.old, n }); }
    if (stroke && stroke.oldP.size) { const n = new Map(); for (const q of stroke.oldP.keys()) n.set(q, T.paintMap.get(q) || null); push({ k: 'paint', o: stroke.oldP, n }); } stroke = null; }
  function doUndo() { const e = undo.pop(); if (!e) { toast('NOTHING TO UNDO'); return; } play(e, true); redo.push(e); keepHist(); queueSave(); paint(); }
  function doRedo() { const e = redo.pop(); if (!e) { toast('NOTHING TO REDO'); return; } play(e, false); undo.push(e); keepHist(); queueSave(); paint(); }
  // SELECT: built-in pieces (Kit items, trees / rocks); locked = gameplay-critical (doors, shops, berths, guns, spawns, big merged buildings)
  const helpers = new Map(), selRay = new THREE.Raycaster();
  function drawSel() { for (const [id, h] of helpers) if (!sel.has(id)) { frame.remove(h); helpers.delete(id); }
    for (const id of [...sel]) { if (!REG.has(id)) sel.delete(id); } for (const id of sel) { const it = REG.get(id); if (!it) continue; let h = helpers.get(id); const ov = it.placed ? {} : PIECES.get(id) || {}; const b = it.box.clone().translate(new THREE.Vector3(ov.dx || 0, ov.dy || 0, ov.dz || 0));
      if (!h) { h = new THREE.Box3Helper(b, 0xffcd77); h.material.depthTest = false; h.renderOrder = 999; frame.add(h); helpers.set(id, h); } else h.box.copy(b); }
    const first = [...sel][0], it = first && REG.get(first); if (!it || !on) { chip.style.display = 'none'; return; }
    chip.textContent = it.label + (sel.size > 1 ? ` (+${sel.size - 1})` : ''); chip.className = ''; chip.style.display = 'block'; chip.dataset.id = first; }
  // [v335] everything under the pointer, nearest first: placed props, object units (walk up to the unit), merged hill ranges, Kit items; the ground in front stops it
  const shown = (o) => { for (let x = o; x && x !== footRoot; x = x.parent) if (!x.visible) return false; return true; };
  function findPiece(cx, cy) { const R = canvas.getBoundingClientRect(); ndc.set(((cx - R.left) / R.width) * 2 - 1, -((cy - R.top) / R.height) * 2 + 1); selRay.setFromCamera(ndc, camera);
    for (const h of selRay.intersectObject(footRoot, true)) { const o = h.object; if (o.userData.outline || !shown(o)) continue;
      if (o.userData.placed) { const it = h.instanceId != null && REG.get(o.userData.placed.ids[h.instanceId]); if (it) return { it, h }; continue; }
      const vi = h.face ? h.face.a : -1;
      if (o.userData.unitRanges) { const u = o.userData.unitRanges.find(([a, n, id]) => vi >= a && vi < a + n && !PIECES.get(id)?.h); if (u && REG.get(u[2])) return { it: REG.get(u[2]), h }; }
      let x = o; while (x && x !== footRoot && !x.userData.editId) x = x.parent; if (x?.userData?.editId && REG.get(x.userData.editId)) return { it: REG.get(x.userData.editId), h };
      if (o.userData.kitItems instanceof Map) { for (const it of o.userData.kitItems.values()) { if (PIECES.get(it.id)?.h) continue; if (it.ranges.some(([m, a, n]) => m === o && vi >= a && vi < a + n)) return { it, h }; } }
      if (/^chunk_/.test(o.name)) return { it: null, h }; }
    return null; }
  function pickPiece(cx, cy, add) { const f = findPiece(cx, cy), found = f?.it || null;
    if (!add) sel.clear(); if (found) { if (add && sel.has(found.id)) sel.delete(found.id); else sel.add(found.id); } drawSel();
    if (!found) toast('NOTHING SELECTABLE THERE'); return found; }
  function editSel(d) { const c = []; for (const id of sel) { const it = REG.get(id); if (!it) continue; const b = PIECES.get(id) || null;
      if (it.placed) { const a = d.h ? null : { ...b, x: b.x + (d.dx || 0), z: b.z + (d.dz || 0), ry: (b.ry || 0) + (d.ry || 0) }; if (a) a.y = groundAt(PROP_CAT[a.t], a.x, a.z); c.push([id, b, a]); setPiece(id, a); continue; }
      const a = d.h ? { h: 1 } : { dx: (b?.dx || 0) + (d.dx || 0), dy: (b?.dy || 0) + (d.dy || 0), dz: (b?.dz || 0) + (d.dz || 0), ry: (b?.ry || 0) + (d.ry || 0) };
      c.push([id, b, a]); setPiece(id, a); }
    if (!c.length) { toast('SELECT A PIECE FIRST'); return; } push({ k: 'piece', c }); if (d.h) sel.clear(); drawSel(); }
  function moveSel(sx, sz) { const f = new THREE.Vector3(); camera.getWorldDirection(f); frame.updateWorldMatrix(true, false); f.transformDirection(inv.copy(frame.matrixWorld).invert()); f.y = 0; f.normalize(); const rt = new THREE.Vector3(-f.z, 0, f.x), st = 0.5;
    editSel({ dx: (rt.x * sx + f.x * sz) * st, dz: (rt.z * sx + f.z * sz) * st }); }
  function delSel() { editSel({ h: 1 }); }
  function showRestore() { const hid = [...PIECES].filter(([, v]) => v.h); if (rest.style.display === 'block' || !hid.length) { rest.style.display = 'none'; if (!hid.length) toast('NOTHING DELETED'); return; }
    rest.innerHTML = '<b>RESTORE DELETED</b><br>' + hid.map(([id]) => `<div>${REG.get(id)?.label || id}<button data-id="${id}">RESTORE</button></div>`).join(''); rest.style.display = 'block'; }
  rest.addEventListener('click', (e) => { const id = e.target.dataset?.id; if (!id) return; const b = PIECES.get(id) || null; setPiece(id, null); push({ k: 'piece', c: [[id, b, null]] }); showRestore(); showRestore(); });
  function resetArea() { if (!hit) { toast('POINT THE RING AT THE GROUND FIRST'); return; } const old = new Map(), ch = [];
    for (const [q, d] of T.delta) { const i = q % (T.NX + 1), j = (q - i) / (T.NX + 1); if (Math.hypot(T.X0 + i * T.G - hit.x, T.Z0 + j * T.G - hit.z) <= ui.size) { old.set(q, d); ch.push([q, 0]); } }
    const oldP = new Map(), chP = []; for (const [q, v] of T.paintMap) { const i = q % (T.NX + 1), j = (q - i) / (T.NX + 1); if (Math.hypot(T.X0 + i * T.G - hit.x, T.Z0 + j * T.G - hit.z) <= ui.size) { oldP.set(q, v); chP.push([q, null]); } }
    if (!ch.length && !chP.length) { toast('NO EDITS IN THE RING'); return; } if (ch.length) T.set(ch); if (chP.length) T.paint(chP);
    push({ k: 'multi', e: [{ k: 'cells', o: old, n: new Map(ch) }, { k: 'paint', o: oldP, n: new Map(chP) }] }); toast(`RESET ${ch.length + chP.length} CELLS`); }
  // BUILD: ghost preview (see-through copy of the template) under the pointer; tap places it (one undo step), Q / E turn
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.45, depthWrite: false }); let ghost = null, ghostT = -1;
  const turn = (q) => { ui.rot = ((ui.rot || 0) + q * (ui.grid ? Math.PI / 12 : Math.PI / 36)) % (Math.PI * 2); paint(); };
  function snapAt(h) { const P = PROP_CAT[ui.prop], x = ui.grid ? Math.round(h.x) : h.x, z = ui.grid ? Math.round(h.z) : h.z; return { t: ui.prop, x: +x.toFixed(2), y: +groundAt(P, x, z).toFixed(2), z: +z.toFixed(2), ry: +(ui.rot || 0).toFixed(3) }; }
  function drawGhost() { const show = on && ui.tool === 'build' && hit; if (ghostT !== ui.prop) { if (ghost) frame.remove(ghost); ghost = new THREE.Group(); for (const o of typeOf(ui.prop).parts) if (!o.userData.outline) ghost.add(new THREE.Mesh(o.geometry, ghostMat)); ghost.renderOrder = 998; frame.add(ghost); ghostT = ui.prop; }
    ghost.visible = !!show; if (!show) return; const r = snapAt(hit); ghost.position.set(r.x, r.y, r.z); ghost.rotation.set(0, r.ry, 0); }
  function placeHere() { if (!hit) { toast('POINT AT THE GROUND FIRST'); return; } if ([...PIECES.keys()].filter(k => k[0] === '+').length >= 2000) { toast('PLACE LIMIT 2000'); return; }
    const id = '+' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), rec = snapAt(hit); setPiece(id, rec); push({ k: 'piece', c: [[id, null, rec]] }); }
  function queueSave() { clearTimeout(saveT); saveT = setTimeout(flush, 1500); }
  async function flush() { clearTimeout(saveT); const cells = T.dump(), pieces = dumpPieces(), paintD = T.dumpPaint(); try { localStorage.setItem(LS, JSON.stringify({ rev, cells, pieces, paint: paintD })); } catch {}
    const r = await terrainSave(cells, rev, pieces, paintD); if (r?.ok) rev = r.rev; else if (r?.status === 409 && r.body) { rev = r.body.rev | 0; toast('TERRAIN CHANGED ELSEWHERE · RELOADED'); T.replace(r.body.cells); replacePieces(r.body.pieces); T.replacePaint(r.body.paint); } else toast('TERRAIN SAVE FAILED: ' + (r?.error || '?')); }
  // input: one pointer paints (or picks), two pointers pinch the ring; wheel / [ ] resize on desktop
  const pts = new Map();
  ov.addEventListener('pointerdown', (e) => { ov.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { endStroke(); const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: ui.size, r: rwCur()?.r ?? ui.rwR }; return; }
    ptr = [e.clientX, e.clientY]; if (ui.tool === 'build') { const h = pick(e.clientX, e.clientY); if (h) hit = h; placeHere(); return; } if (ui.tool === 'select') { pickPiece(e.clientX, e.clientY, multi || e.shiftKey); return; } if (ui.tool === 'rework') { rwClick(e.clientX, e.clientY, e.shiftKey); return; } hit = pick(e.clientX, e.clientY); if (!hit) return;
    if (sampling) { target = hit.y; sampling = false; paint(); toast(`LEVEL HEIGHT ${target.toFixed(2)} m`); return; }
    const W = walker.w; stroke = { y: hit.y, feet: Number.isFinite(W?.y) ? W.y : hit.y, old: new Map(), oldP: new Map() }; });
  ov.addEventListener('pointermove', (e) => { if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size === 2 && ui.tool === 'rework') { const [a, b] = [...pts.values()]; rwSetR(Math.max(pinch.r, 4) * Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(10, pinch.d), false); rwCommitSoon(); return; }
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; setSize(pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(10, pinch.d)); return; }
    ptr = [e.clientX, e.clientY]; });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) endStroke(); };
  ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
  ov.addEventListener('wheel', (e) => { e.preventDefault(); if (ui.tool === 'rework') { const c = rwCur()?.r ?? ui.rwR; rwSetR(c + (e.deltaY > 0 ? -1 : 1) * Math.max(1, Math.round(c * 0.1)), false); rwCommitSoon(); return; } setSize(ui.size * (e.deltaY > 0 ? 0.9 : 1.1)); }, { passive: false });
  addEventListener('keydown', (e) => { if (!on || e.target?.closest?.('input, textarea, select')) return; if (ui.tool === 'rework' && (e.key === '[' || e.key === ']')) { rwSetR((rwCur()?.r ?? ui.rwR) + (e.key === ']' ? 5 : -5), false); rwCommitSoon(); return; } if (ui.tool === 'rework' && (e.key === 'Delete' || e.key === 'Backspace')) { rwDelete(); return; } if (e.key === '[') setSize(ui.size - 1); else if (e.key === ']') setSize(ui.size + 1); else if (e.key === 'Escape') setOn(false); else if (ui.tool === 'build' && (e.key === 'q' || e.key === 'Q')) turn(1); else if (ui.tool === 'build' && (e.key === 'e' || e.key === 'E')) turn(-1); else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) { e.preventDefault(); doRedo(); } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); doUndo(); } else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.tool === 'select') delSel(); });

  // ===== [v335] 🚩 REWORK FLAGS (owner only: terrain_get strips '!rw_*' for everyone else; zero colliders) =====
  // PIECES '!rw_<ts36><rand>' = { rework: 1, num, x, y, z (foot frame), lx, lz (town-local, coast.js w2t), r (0..160 m), note, part, partId, at, color }
  let selReworkId = null, rwHover = null, rwHoverT = 0, rwPend = null, rwPendT = 0;
  const rwIds = () => [...PIECES.keys()].filter(k => k.startsWith(RW)), rwCur = () => (selReworkId && PIECES.get(selReworkId)) || null;
  const rwRoot = new THREE.Group(); rwRoot.name = 'rework_flags'; frame.add(rwRoot);
  const tags = document.createElement('div'); tags.id = 'te-rw-tags'; document.body.appendChild(tags);
  const RWG = { pole: new THREE.CylinderGeometry(0.07, 0.09, 3.4, 8).translate(0, 1.7, 0), cap: new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10), fin: new THREE.OctahedronGeometry(0.2), disc: new THREE.RingGeometry(0.35, 0.75, 32).rotateX(-Math.PI / 2), hitG: new THREE.CylinderGeometry(0.7, 0.7, 4, 6).translate(0, 2, 0),
    pen: (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 3.3, 0, 1.6, 2.9, 0, 0, 2.45, 0], 3)); g.computeVertexNormals(); return g; })() };
  const RWM = new Map(), brass = new THREE.MeshBasicMaterial({ color: 0xc9a14a, toneMapped: false }), goldM = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false }), poleM = new THREE.MeshBasicMaterial({ color: 0x2a1c10 }), hitM = new THREE.MeshBasicMaterial({ visible: false });
  const rwMat = (c, ghost) => { const k = c + (ghost ? ':g' : ''); let m = RWM.get(k); if (!m) { const col = new THREE.Color(rwHex(c)); m = { pen: new THREE.MeshBasicMaterial({ color: col, toneMapped: false, side: THREE.DoubleSide, transparent: !!ghost, opacity: ghost ? 0.55 : 1 }),
      disc: new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
      line: new THREE.LineBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: ghost ? 0.6 : 0.95, toneMapped: false }),
      band: new THREE.MeshBasicMaterial({ color: col, depthTest: false, depthWrite: false, transparent: true, opacity: ghost ? 0.25 : 0.42, toneMapped: false, side: THREE.DoubleSide }) }; RWM.set(k, m); } return m; };
  const gy = (x, z) => H(x, z) + 0.18;
  function rwFlag(rec, id, ghost) { const g = new THREE.Group(), m = rwMat(rec.color, ghost); g.userData.rwId = id; g.position.set(rec.x, rec.y, rec.z);
    const pole = new THREE.Mesh(RWG.pole, poleM), cap = new THREE.Mesh(RWG.cap, brass), pen = new THREE.Mesh(RWG.pen, m.pen), fin = new THREE.Mesh(RWG.fin, goldM), disc = new THREE.Mesh(RWG.disc, m.disc), hp = new THREE.Mesh(RWG.hitG, hitM);
    cap.position.y = 3.42; fin.position.y = 3.62; disc.position.y = 0.06; pen.name = 'rw_pennant'; disc.name = 'rw_disc'; for (const o of [pole, cap, pen, fin, disc]) { o.renderOrder = 996; if (ghost) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; } } hp.userData.rwId = id;
    g.add(pole, cap, pen, fin, disc); if (!ghost) g.add(hp);
    const r = +rec.r || 0; if (r > 0) { const S = 96, pts = new Float32Array(S * 3), W = Math.max(0.45, Math.min(3, r * 0.02)), band = new Float32Array(S * 2 * 3), idx = [];
      for (let k = 0; k < S; k++) { const a = k / S * Math.PI * 2, cx = Math.cos(a), sz = Math.sin(a), x = rec.x + cx * r, z = rec.z + sz * r; pts.set([x - rec.x, gy(x, z) - rec.y, z - rec.z], k * 3);
        const xi = rec.x + cx * (r - W), zi = rec.z + sz * (r - W); band.set([xi - rec.x, gy(xi, zi) - rec.y, zi - rec.z, x - rec.x, gy(x, z) - rec.y, z - rec.z], k * 6); const k2 = (k + 1) % S; idx.push(k * 2, k2 * 2, k * 2 + 1, k * 2 + 1, k2 * 2, k2 * 2 + 1); }
      const loop = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3)), m.line); loop.renderOrder = 997; loop.frustumCulled = false; loop.name = 'rw_ring';
      const bg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(band, 3)); bg.setIndex(idx); const bm = new THREE.Mesh(bg, m.band); bm.renderOrder = 997; bm.frustumCulled = false; bm.name = 'rw_band';
      const sp = []; for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) for (let i = 0; i < 12; i++) for (const t of [i / 12, (i + 1) / 12]) { const x = rec.x + dx * r * t, z = rec.z + dz * r * t; sp.push(x - rec.x, gy(x, z) - rec.y, z - rec.z); } // N / E / S / W spokes
      const sl = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)), m.line); sl.renderOrder = 997; sl.frustumCulled = false; sl.name = 'rw_spokes'; g.add(loop, bm, sl); }
    return g; }
  function rwDispose(g) { g.traverse(o => { if (o.geometry && !Object.values(RWG).includes(o.geometry)) o.geometry.dispose(); }); }
  function rwDraw() { for (const c of [...rwRoot.children]) { rwRoot.remove(c); rwDispose(c); }
    if (selReworkId && !PIECES.has(selReworkId)) selReworkId = null;
    for (const id of rwIds()) { const rec = PIECES.get(id); if (rec && Number.isFinite(+rec.x)) rwRoot.add(rwFlag(rec, id, false)); }
    tags.innerHTML = rwIds().map(id => { const rec = PIECES.get(id); return `<div class="rwt" data-id="${id}" style="border-color:${rwHex(rec.color)}"></div>`; }).join('');
    for (const el of tags.children) { const rec = PIECES.get(el.dataset.id); el.textContent = rwLabel(rec); el.classList.toggle('sel', el.dataset.id === selReworkId); }
    paint(); }
  rwHook = () => { clearTimeout(rwDraw.t); rwDraw.t = setTimeout(rwDraw, 0); };
  const rwLabel = (rec) => `🚩 #${rec.num} · ${rwName(rec.color)} · ${rec.r ? 'R ' + rec.r + 'm' : 'PIN'} · ${String(rec.part || 'GROUND').toUpperCase().replace(/\s+/g, '_')}${rec.note ? ' — "' + rec.note + '"' : ''}`;
  const rwGhost = new THREE.Group(); rwGhost.visible = false; frame.add(rwGhost); let rwGhostKey = '';
  function rwGhostDraw() { const h = rwHover; if (!h || selReworkId) { rwGhost.visible = false; return; } const rec = { x: h.x, y: h.y, z: h.z, r: ui.rwR, color: ui.rwColor }, key = [h.x.toFixed(1), h.z.toFixed(1), ui.rwR, ui.rwColor].join();
    if (key !== rwGhostKey) { rwGhostKey = key; for (const c of [...rwGhost.children]) { rwGhost.remove(c); rwDispose(c); } rwGhost.add(rwFlag(rec, null, true)); } rwGhost.visible = true; }
  // the part under the pointer (Kit item / building / placed prop) vs the ground: the closer one wins
  function rwTarget(cx, cy) { const f = findPiece(cx, cy), g = pick(cx, cy); frame.updateWorldMatrix(true, false); const fi = inv.copy(frame.matrixWorld).invert(), cam = camera.getWorldPosition(new THREE.Vector3()).applyMatrix4(fi);
    let part = null; if (f?.it) { const p = f.h.point.clone().applyMatrix4(fi); part = { x: p.x, y: p.y, z: p.z, d: cam.distanceTo(p), part: f.it.label.split(' · ')[0], partId: f.it.id }; }
    const gd = g ? cam.distanceTo(new THREE.Vector3(g.x, g.y, g.z)) : Infinity; if (part && part.d <= gd + 0.05) return part;
    if (!g) return part; let dn = ''; try { dn = locatePoint(g.x, g.z, { onFoot: true }).district || ''; } catch {} return { x: g.x, y: g.y, z: g.z, part: 'GROUND' + (dn ? ' · ' + dn : ''), partId: '' }; }
  function rwPickFlag(cx, cy) { const R = canvas.getBoundingClientRect(); ndc.set(((cx - R.left) / R.width) * 2 - 1, -((cy - R.top) / R.height) * 2 + 1); selRay.setFromCamera(ndc, camera);
    const h = selRay.intersectObject(rwRoot, true).find(x => x.object.userData.rwId || x.object.parent?.userData.rwId); return h ? (h.object.userData.rwId || h.object.parent.userData.rwId) : null; }
  function rwClick(cx, cy, forceNew) { const fid = !forceNew && rwPickFlag(cx, cy); if (fid) { rwCommit(); selReworkId = fid; rwSync(); toast('🚩 FLAG #' + PIECES.get(fid).num + ' SELECTED'); return; }
    if (selReworkId && !forceNew) { rwCommit(); selReworkId = null; rwSync(); } const t = rwTarget(cx, cy); if (!t) { toast('POINT AT A PART OR THE GROUND'); return; } rwPlace(t); }
  function rwPlace(t) { const ids = rwIds(); if (ids.length >= 300) { toast('FLAG LIMIT 300'); return null; }
    const num = ids.reduce((m, k) => Math.max(m, PIECES.get(k).num | 0), 0) + 1, [lx, lz] = CO.w2t(t.x, t.z), id = RW + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const rec = { rework: 1, num, x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2), lx: +lx.toFixed(1), lz: +lz.toFixed(1), r: ui.rwR | 0, note: String(ui.rwNote || '').slice(0, 140), part: String(t.part || 'GROUND').slice(0, 60), partId: String(t.partId || '').slice(0, 160), at: Date.now(), color: ui.rwColor };
    rwCommit(); setPiece(id, rec); selReworkId = id; push({ k: 'piece', c: [[id, null, rec]] }); rwDraw(); toast(`🚩 FLAG #${num} · ${rwName(rec.color)} · ${rec.r ? 'R ' + rec.r + ' m' : 'PIN'} · ${rec.part}`); return id; }
  // edits to the selected flag apply live; one undo step per gesture (slider drag / wheel run / note typing)
  function rwEdit(patch) { const id = selReworkId, b = PIECES.get(id); if (!b) return; if (!rwPend || rwPend.id !== id) { rwCommit(); rwPend = { id, before: b }; } setPiece(id, { ...b, ...patch }); }
  function rwCommit() { clearTimeout(rwPendT); const p = rwPend; rwPend = null; if (!p) return; const a = PIECES.get(p.id) || null; if (JSON.stringify(a) !== JSON.stringify(p.before)) push({ k: 'piece', c: [[p.id, p.before, a]] }); }
  const rwCommitSoon = () => { clearTimeout(rwPendT); rwPendT = setTimeout(rwCommit, 700); };
  function rwSetR(v, commit) { v = Math.max(0, Math.min(RW_MAX, Math.round(+v || 0))); ui.rwR = v; if (rwCur()) { rwEdit({ r: v }); if (commit) rwCommit(); } paint(); }
  function rwSetColor(c) { if (!RW_COLORS.some(k => k[0] === c)) return; ui.rwColor = c; if (rwCur()) { rwEdit({ color: c }); rwCommit(); } paint(); }
  function rwSync() { const c = rwCur(), nt = $('.rw-note'); if (c) { ui.rwR = c.r | 0; ui.rwColor = c.color || 'red'; nt.value = c.note || ''; } else nt.value = ui.rwNote || ''; rwDraw(); }
  function rwDelete() { const id = selReworkId, b = PIECES.get(id); if (!b) { toast('TAP A FLAG FIRST'); return; } rwCommit(); setPiece(id, null); selReworkId = null; push({ k: 'piece', c: [[id, b, null]] }); rwDraw(); toast('🚩 FLAG #' + b.num + ' DELETED'); }
  function rwClear() { rwCommit(); const c = rwIds().map(id => [id, PIECES.get(id), null]); if (!c.length) { toast('NO FLAGS'); return; } for (const [id] of c) setPiece(id, null); selReworkId = null; push({ k: 'piece', c }); rwDraw(); toast(`🧹 CLEARED ${c.length} FLAGS (UNDO brings them back)`); }
  const _v = new THREE.Vector3();
  function rwTick() { const vis = on || (ui.rwShow && document.documentElement.classList.contains('pfp-onfoot')); rwRoot.visible = vis; tags.style.display = vis ? 'block' : 'none'; if (!vis || !rwRoot.children.length) return;
    const t = performance.now() / 1000, W = innerWidth, Hh = innerHeight; for (const g of rwRoot.children) { const d = g.getObjectByName('rw_disc'); if (d) d.scale.setScalar(1 + 0.25 * Math.sin(t * 3 + g.position.x)); const pen = g.getObjectByName('rw_pennant'); if (pen) pen.rotation.y = Math.sin(t * 2.2 + g.position.z) * 0.25; const cd = camera.position.distanceTo(g.getWorldPosition(_v)), k = Math.max(1, cd / 28) * (g.userData.rwId === selReworkId ? 1.25 : 1); for (const o of g.children) if (!/^rw_(ring|band|spokes)$/.test(o.name)) o.scale.setScalar(k); } // flags keep a readable size from a town-wide view
    for (const el of tags.children) { const rec = PIECES.get(el.dataset.id); if (!rec) continue; _v.set(rec.x, rec.y + (el.dataset.id === selReworkId ? 4.9 : 4.1), rec.z); frame.localToWorld(_v); _v.project(camera);
      if (_v.z > 1 || _v.x < -1.2 || _v.x > 1.2 || _v.y < -1.2 || _v.y > 1.2) { el.style.display = 'none'; continue; } el.style.display = 'block'; el.style.left = ((_v.x + 1) / 2 * W) + 'px'; el.style.top = ((1 - _v.y) / 2 * Hh) + 'px'; }
    // keep the tags readable: a tag that overlaps one already placed steps up a line
    const placed = []; for (const el of [...tags.children].filter(e => e.style.display !== 'none').sort((a, b) => parseFloat(b.style.top) - parseFloat(a.style.top))) { let y = parseFloat(el.style.top); const x = parseFloat(el.style.left), w = el.offsetWidth || 200;
      for (let n = 0; n < 12 && placed.some(p => Math.abs(p.y - y) < 22 && Math.abs(p.x - x) < (p.w + w) / 2); n++) y -= 23; el.style.top = y + 'px'; placed.push({ x, y, w }); } }
  rwDraw();
  let last = performance.now(), lastPick = 0;
  function tick() { requestAnimationFrame(tick); rwTick(); if (!on) return; const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (ptr && now - lastPick > (touch ? 60 : 30)) { lastPick = now; const h = pick(ptr[0], ptr[1]); if (h) hit = h; }
    if (ui.tool === 'rework') { ring.visible = grid.visible = false; if (ghost) ghost.visible = false; if (ptr && now - rwHoverT > 120) { rwHoverT = now; rwHover = rwTarget(ptr[0], ptr[1]); } rwGhostDraw(); return; } rwGhost.visible = false;
    if (ui.tool === 'select') { ring.visible = grid.visible = false; const id = chip.dataset.id, it = id && REG.get(id); if (it && chip.style.display === 'block') { const ov = it.placed ? {} : PIECES.get(id) || {}, c = it.box.getCenter(new THREE.Vector3()); c.x += ov.dx || 0; c.z += ov.dz || 0; c.y = it.box.max.y + (ov.dy || 0); frame.localToWorld(c); c.project(camera); chip.style.left = ((c.x + 1) / 2 * innerWidth) + 'px'; chip.style.top = ((1 - c.y) / 2 * innerHeight) + 'px'; } return; }
    drawGhost(); if (ui.tool === 'build') { ring.visible = grid.visible = false; return; } if (stroke) apply(dt); drawRing(); }
  tick(); paint();
  return { owner: true, setOn, placeHere, PROP_CAT, TYPES, placeRoot, REG, PIECES, sel, pickPiece, findPiece, delSel, rwPlace, rwTarget, rwClick, rwDelete, rwClear, rwSetR, rwSetColor, rwEdit, rwCommit, rwRoot, RW_COLORS, drawSel, get selReworkId() { return selReworkId; }, set selReworkId(v) { selReworkId = v; rwSync(); }, doUndo, doRedo, get undo() { return undo; }, get on() { return on; }, ui, flush, get rev() { return rev; } };
}
