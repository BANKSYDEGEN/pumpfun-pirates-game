// [terrain-edit] PUMPFUN PIRATES owner BUILD MODE (BANKSY: "a terrain edit device and I'll level it where needed"; "Level, flatten,
// blend - make the buttons like Sims or Jurassic World"; "Make it so I can choose ring size").
// Everyone: the saved height deltas load at startup (localStorage copy first, then the pvp function) into foot.js TERRAIN, so the drawn
// ground, the walk / collision height and the followers all use the edited ground. The owner (the server says so in terrain_get) also
// gets a 🛠 BUILD button: a bottom toolbar of round tools (LEVEL / FLATTEN / BLEND / RAISE / LOWER), size S/M/L/XL + slider (1-40 m,
// wheel, [ ], pinch), strength, UNDO, RESET AREA, EXIT. Strokes paint where you point; saves go up (owner only, server-checked).
import * as THREE from 'three';
import { TERRAIN as T, H, pieceBlockers } from './foot.js';
import { terrainLoad, terrainSave } from '../pvpSave.js';
const LS = 'pfp_terrain_v1', LS_UI = 'pfp_tedit_ui';
const TOOLS = [
  { id: 'level', label: 'LEVEL', ico: '⛰️', tip: 'raise / lower toward the picked height (tap 🎯 to sample)' },
  { id: 'flatten', label: 'FLATTEN', ico: '🟫', tip: 'flatten to the height where the stroke starts' },
  { id: 'blend', label: 'BLEND', ico: '🌀', tip: 'smooth / soften edges' },
  { id: 'raise', label: 'RAISE', ico: '⬆️', tip: 'push the ground up' },
  { id: 'lower', label: 'LOWER', ico: '⬇️', tip: 'dig the ground down' },
  { id: 'paint', label: 'PAINT', ico: '🖌️', tip: 'paint the ground: pick grass, sand, dirt, rock or paved path' },
  { id: 'select', label: 'SELECT', ico: '👆', tip: 'tap a piece (shift / MULTI = add) · 🗑 / Delete hides it for everyone · arrows move · ⟲ ⟳ rotate' }]; // [build-select] SELECT + PAINT finished: no longer hidden
const LOCK = /chunk_|door|shop|npc|berth|cannon|battery|gun|spawn|squadhall|house|hill|street|plaza|dock_|lighthouse|fort|keep|wall/i, HIST = 'pfp_tedit_hist';
const SIZES = { S: 3, M: 8, L: 16, XL: 30 };
const MATS = [['grass', '🌿', 'GRASS', '#6fcf4a'], ['sand', '🏖️', 'SAND', '#f2d9a0'], ['dirt', '🟤', 'DIRT', '#b8975f'], ['rock', '🪨', 'ROCK', '#939089'], ['path', '🧱', 'PATH', '#b3a690']];
export async function initTerrainEdit({ scene, camera, canvas, footRoot, walker, touch, toast = () => {} }) {
  // 1) everyone: cached deltas now, the server's when they answer
  // built-in pieces: every Kit / nature item under the foot island, by a stable id (build path + item key)
  const REG = new Map(), PIECES = new Map(), live = { on: false }; // id -> item ; id -> override
  const seen = new Set(); function scan() { const path = (o) => { const a = []; for (let x = o; x && x !== footRoot.parent; x = x.parent) { const sib = x.parent ? x.parent.children.filter(c => c.name === x.name) : [x]; a.push((x.name || 'g') + (sib.length > 1 ? ':' + sib.indexOf(x) : '')); } /* stable: names, so async area load order can't shift ids */ return a.reverse().join('/'); };
    footRoot.traverse(o => { const its = o.userData?.kitItems; if (!(its instanceof Map) || seen.has(its)) return; seen.add(its); const base = path(o.parent && !o.userData.bucket?.startsWith?.('sway') && o.isMesh && its === o.parent.userData.kitItems ? o.parent : o);
      for (const it of its.values()) { const id = base + '#' + it.key; it.id = id; const big = Math.max(it.box.max.x - it.box.min.x, it.box.max.z - it.box.min.z) > 24;
        it.locked = big || LOCK.test(base) || LOCK.test(it.name || ''); it.label = (it.name || it.key.replace(/^p\d+$/, 'piece')).toUpperCase() + ' · ' + (base.split('/').slice(-2)[0] || '').split(':')[0].replace(/^(foot_|island_)/, ''); REG.set(id, it); if (PIECES.has(id)) applyGeo(it); } }); }
  scan(); setInterval(() => { if (PIECES.size || live.on) scan(); }, 3000); // area kits (route, lagoon ...) build late: register + apply their saved state when they appear
  function setPiece(id, ov) { ov && (ov.h || ov.dx || ov.dy || ov.dz || ov.ry) ? PIECES.set(id, ov) : PIECES.delete(id); const it = REG.get(id); if (it) applyGeo(it); }
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
  try { const c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c?.cells) T.replace(c.cells); if (c?.pieces) replacePieces(c.pieces); if (c?.paint) T.replacePaint(c.paint); } catch {}
  let rev = 0, owner = false;
  const j = await terrainLoad(); if (j?.ok) { rev = j.rev | 0; owner = !!j.owner; T.replace(j.cells); replacePieces(j.pieces); T.replacePaint(j.paint); try { localStorage.setItem(LS, JSON.stringify({ rev, cells: j.cells, pieces: j.pieces || {}, paint: j.paint || {} })); } catch {} }
  if (!owner) return { owner: false };
  // 2) the owner's build mode
  const ui = Object.assign({ tool: 'level', size: 8, str: 0.5, mat: 'path' }, (() => { try { return JSON.parse(localStorage.getItem(LS_UI) || '{}'); } catch { return {}; } })());
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
  .pfp-onfoot #te-btn { display: block; }
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
  #te-bar .selrow { display: none; } #te-bar.sel-on .selrow { display: flex; } #te-bar.sel-on .brush { display: none; }
  #te-chip { position: fixed; z-index: 62; pointer-events: none; font-family: 'Just Another Hand', cursive; font-size: 20px; background: #161616; color: #ffcd77; border: 2px solid #ffcd77; border-radius: 14px; padding: 0 10px; transform: translate(-50%, -130%); display: none; white-space: nowrap; }
  #te-chip.lock { border-color: #fa0d0d; color: #fa0d0d; }
  #te-rest { position: fixed; right: 10px; bottom: 210px; z-index: 63; max-height: 40vh; overflow: auto; background: rgba(22,22,22,.95); border: 2px solid #ffcd77; border-radius: 14px; padding: 8px; font-family: 'Just Another Hand', cursive; color: #ffcd77; font-size: 20px; display: none; }
  #te-rest button { font-family: inherit; font-size: 18px; margin-left: 6px; background: #ffcd77; color: #161616; border: 0; border-radius: 8px; }
  @media (max-width: 700px) { #te-bar .tool { width: 60px; height: 60px; font-size: 14px; } #te-bar .tool .i { font-size: 24px; } #te-bar input[type=range] { width: 96px; } #te-bar .row { gap: 6px; } }`;
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'te-btn'; btn.className = 'te-r'; btn.title = 'BUILD MODE (owner)'; btn.innerHTML = '<span class="i">🛠️</span>BUILD'; document.body.appendChild(btn);
  const ov = document.createElement('div'); ov.id = 'te-ov'; document.body.appendChild(ov);
  const bar = document.createElement('div'); bar.id = 'te-bar'; document.body.appendChild(bar);
  const r = (cls, ico, label, title = '') => `<button class="te-r ${cls}" title="${title}"><span class="i">${ico}</span>${label}</button>`;
  bar.innerHTML = `<div class="row">${TOOLS.map(t => r('tool" data-t="' + t.id, t.ico, t.label, t.tip)).join('')}
    ${r('sm pick', '🎯', 'PICK', 'LEVEL: sample a height (then tap the ground)')}</div>
    <div class="row paintrow" style="margin-top:6px">${MATS.map(([id, ico, lb, c]) => `<button class="te-r sw" data-p="${id}" title="${lb}" style="background:radial-gradient(circle at 35% 30%, ${c}, #161616 85%)"><span class="i">${ico}</span>${lb}</button>`).join('')}</div>
    <div class="row" style="margin-top:8px">${r('big undo', '↩️', 'UNDO', 'UNDO (Ctrl+Z)')}${r('sm redo', '↪️', 'REDO', 'REDO (Ctrl+Shift+Z / Ctrl+Y)')}
    <span class="row selrow">${r('sm multi', '➕', 'MULTI', 'add to the selection')}${r('sm mv" data-m="-1,0', '⬅️', 'LEFT')}${r('sm mv" data-m="1,0', '➡️', 'RIGHT')}${r('sm mv" data-m="0,1', '⬆️', 'AWAY')}${r('sm mv" data-m="0,-1', '⬇️', 'NEAR')}${r('sm rot" data-r="1', '⟲', 'ROT')}${r('sm rot" data-r="-1', '⟳', 'ROT')}${r('sm del', '🗑️', 'DELETE')}${r('sm rest', '🧺', 'RESTORE')}</span>
    <span class="row brush"><div class="grp">SIZE ${Object.keys(SIZES).map(k => `<button class="pre" data-s="${k}">${k}</button>`).join('')}<input type="range" class="sz" min="1" max="40" step="0.5"><b class="szv"></b></div>
    <div class="grp">STRENGTH <button class="pre sdn">−</button><input type="range" class="st" min="0.1" max="1" step="0.1"><button class="pre sup">+</button></div>
    ${r('sm reset', '♻️', 'RESET', 'RESET AREA: clear edits inside the ring')}</span>${r('sm exit', '✖️', 'EXIT')}</div><div class="tip"></div>`;
  const chip = document.createElement('div'); chip.id = 'te-chip'; document.body.appendChild(chip); const rest = document.createElement('div'); rest.id = 'te-rest'; document.body.appendChild(rest);
  const $ = (q) => bar.querySelector(q), tip = $('.tip');
  const paint = () => { bar.classList.toggle('sel-on', ui.tool === 'select'); bar.classList.toggle('paint-on', ui.tool === 'paint'); bar.querySelectorAll('.sw').forEach(b => b.classList.toggle('sel', b.dataset.p === ui.mat)); $('.undo').disabled = !undo.length; $('.redo').disabled = !redo.length; $('.multi').classList.toggle('sel', multi); bar.querySelectorAll('.tool').forEach(b => b.classList.toggle('sel', b.dataset.t === ui.tool));
    bar.querySelectorAll('.pre[data-s]').forEach(b => b.classList.toggle('sel', SIZES[b.dataset.s] === ui.size)); $('.sz').value = ui.size; $('.szv').textContent = ui.size + ' m'; $('.st').value = ui.str;
    const t = TOOLS.find(t => t.id === ui.tool); tip.textContent = sampling ? 'tap the ground to pick the LEVEL height' : (t.tip + (ui.tool === 'level' ? ` · target ${target == null ? 'your feet' : target.toFixed(2) + ' m'}` : '')); keepUi(); };
  const setSize = (v) => { ui.size = Math.max(1, Math.min(40, Math.round(v * 2) / 2)); paint(); };
  bar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.p) ui.mat = b.dataset.p; else if (b.dataset.t) { ui.tool = b.dataset.t; sampling = false; } else if (b.dataset.s) setSize(SIZES[b.dataset.s]);
    else if (b.classList.contains('sdn')) ui.str = Math.max(0.1, +(ui.str - 0.1).toFixed(1)); else if (b.classList.contains('sup')) ui.str = Math.min(1, +(ui.str + 0.1).toFixed(1));
    else if (b.classList.contains('pick')) { ui.tool = 'level'; sampling = true; } else if (b.classList.contains('undo')) doUndo(); else if (b.classList.contains('redo')) doRedo(); else if (b.classList.contains('multi')) multi = !multi; else if (b.dataset.m) moveSel(...b.dataset.m.split(',').map(Number)); else if (b.dataset.r) editSel({ ry: +b.dataset.r * Math.PI / 12 }); else if (b.classList.contains('del')) delSel(); else if (b.classList.contains('rest')) showRestore(); else if (b.classList.contains('reset')) resetArea(); else if (b.classList.contains('exit')) setOn(false);
    paint(); });
  $('.sz').addEventListener('input', (e) => setSize(+e.target.value)); $('.st').addEventListener('input', (e) => { ui.str = +e.target.value; paint(); });
  btn.addEventListener('click', () => setOn(true));
  function setOn(v) { on = v; live.on = v; if (v) scan(); document.documentElement.classList.toggle('pfp-tedit', v); ring.visible = grid.visible = false; if (!v) { sel.clear(); drawSel(); rest.style.display = 'none'; flush(); } paint(); }
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
    for (const id of sel) { const it = REG.get(id); if (!it) continue; let h = helpers.get(id); const ov = PIECES.get(id) || {}; const b = it.box.clone().translate(new THREE.Vector3(ov.dx || 0, ov.dy || 0, ov.dz || 0));
      if (!h) { h = new THREE.Box3Helper(b, it.locked ? 0xfa0d0d : 0xffcd77); h.material.depthTest = false; h.renderOrder = 999; frame.add(h); helpers.set(id, h); } else h.box.copy(b); }
    const first = [...sel][0], it = first && REG.get(first); if (!it || !on) { chip.style.display = 'none'; return; }
    chip.textContent = (it.locked ? '🔒 LOCKED · ' : '') + it.label + (sel.size > 1 ? ` (+${sel.size - 1})` : ''); chip.className = it.locked ? 'lock' : ''; chip.style.display = 'block'; chip.dataset.id = first; }
  function pickPiece(cx, cy, add) { const R = canvas.getBoundingClientRect(); ndc.set(((cx - R.left) / R.width) * 2 - 1, -((cy - R.top) / R.height) * 2 + 1); selRay.setFromCamera(ndc, camera);
    const hits = selRay.intersectObject(footRoot, true).filter(h => h.object.visible && h.object.userData.kitItems instanceof Map && !h.object.userData.outline);
    let found = null; for (const h of hits) { const vi = h.face ? h.face.a : -1; for (const it of h.object.userData.kitItems.values()) { if (PIECES.get(it.id)?.h) continue; if (it.ranges.some(([m, a, n]) => m === h.object && vi >= a && vi < a + n)) { found = it; break; } } if (found) break; }
    if (!add) sel.clear(); if (found) { if (add && sel.has(found.id)) sel.delete(found.id); else sel.add(found.id); } drawSel();
    if (!found) toast('NOTHING SELECTABLE THERE'); else if (found.locked) toast('🔒 LOCKED: ' + found.label); return found; }
  function editSel(d) { const c = []; for (const id of sel) { const it = REG.get(id); if (!it || it.locked) continue; const b = PIECES.get(id) || null, a = d.h ? { h: 1 } : { dx: (b?.dx || 0) + (d.dx || 0), dy: (b?.dy || 0) + (d.dy || 0), dz: (b?.dz || 0) + (d.dz || 0), ry: (b?.ry || 0) + (d.ry || 0) };
      c.push([id, b, a]); setPiece(id, a); }
    if (!c.length) { toast(sel.size ? '🔒 LOCKED' : 'SELECT A PIECE FIRST'); return; } push({ k: 'piece', c }); if (d.h) sel.clear(); drawSel(); }
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
  function queueSave() { clearTimeout(saveT); saveT = setTimeout(flush, 1500); }
  async function flush() { clearTimeout(saveT); const cells = T.dump(), pieces = dumpPieces(), paintD = T.dumpPaint(); try { localStorage.setItem(LS, JSON.stringify({ rev, cells, pieces, paint: paintD })); } catch {}
    const r = await terrainSave(cells, rev, pieces, paintD); if (r?.ok) rev = r.rev; else if (r?.status === 409 && r.body) { rev = r.body.rev | 0; toast('TERRAIN CHANGED ELSEWHERE · RELOADED'); T.replace(r.body.cells); replacePieces(r.body.pieces); T.replacePaint(r.body.paint); } else toast('TERRAIN SAVE FAILED: ' + (r?.error || '?')); }
  // input: one pointer paints (or picks), two pointers pinch the ring; wheel / [ ] resize on desktop
  const pts = new Map();
  ov.addEventListener('pointerdown', (e) => { ov.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { endStroke(); const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: ui.size }; return; }
    ptr = [e.clientX, e.clientY]; if (ui.tool === 'select') { pickPiece(e.clientX, e.clientY, multi || e.shiftKey); return; } hit = pick(e.clientX, e.clientY); if (!hit) return;
    if (sampling) { target = hit.y; sampling = false; paint(); toast(`LEVEL HEIGHT ${target.toFixed(2)} m`); return; }
    const W = walker.w; stroke = { y: hit.y, feet: Number.isFinite(W?.y) ? W.y : hit.y, old: new Map(), oldP: new Map() }; });
  ov.addEventListener('pointermove', (e) => { if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; setSize(pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(10, pinch.d)); return; }
    ptr = [e.clientX, e.clientY]; });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) endStroke(); };
  ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
  ov.addEventListener('wheel', (e) => { e.preventDefault(); setSize(ui.size * (e.deltaY > 0 ? 0.9 : 1.1)); }, { passive: false });
  addEventListener('keydown', (e) => { if (!on) return; if (e.key === '[') setSize(ui.size - 1); else if (e.key === ']') setSize(ui.size + 1); else if (e.key === 'Escape') setOn(false); else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) { e.preventDefault(); doRedo(); } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); doUndo(); } else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.tool === 'select') delSel(); });
  let last = performance.now(), lastPick = 0;
  function tick() { requestAnimationFrame(tick); if (!on) return; const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (ptr && now - lastPick > (touch ? 60 : 30)) { lastPick = now; const h = pick(ptr[0], ptr[1]); if (h) hit = h; }
    if (ui.tool === 'select') { ring.visible = grid.visible = false; const id = chip.dataset.id, it = id && REG.get(id); if (it && chip.style.display === 'block') { const ov = PIECES.get(id) || {}, c = it.box.getCenter(new THREE.Vector3()); c.x += ov.dx || 0; c.z += ov.dz || 0; c.y = it.box.max.y + (ov.dy || 0); frame.localToWorld(c); c.project(camera); chip.style.left = ((c.x + 1) / 2 * innerWidth) + 'px'; chip.style.top = ((1 - c.y) / 2 * innerHeight) + 'px'; } return; }
    if (stroke) apply(dt); drawRing(); }
  tick(); paint();
  return { owner: true, setOn, REG, PIECES, sel, pickPiece, delSel, doUndo, doRedo, get undo() { return undo; }, get on() { return on; }, ui, flush, get rev() { return rev; } };
}
