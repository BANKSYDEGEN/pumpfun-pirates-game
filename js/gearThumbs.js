// [Timothy] PUMPFUN PIRATES island shop: REAL 3D card art for every gear item (BANKSY: "Make sure in clothes shop all items render
// as real items"). One small offscreen three.js renderer draws Raul's v4 pirate wearing the item (applyGear + gear_hi / gear_lo.glb,
// the very meshes the game draws), framed on that item: hats in your hat colour, clothes in your ship skin's colours, eyewear,
// all 7 parrots, both hooks; treasure maps get a little rendered scroll.
//
//   import { gearThumb, gearThumbEl, gearLive } from './gearThumbs.js';
//   gearThumb(slot, id, { skin, hatColor, hookSide, legSide, skinColor, hairColor, w, h }) -> Promise<dataURL>   cached per item + what
//   changes its look (skin for clothes, hatColor for hats, the side for hooks / pegs, your skin + hair colour for all)
//   gearThumbEl(slot, id, opts) -> <img>: the pre-baked PNG (assets/pirates/thumbs/<slot>_<id>.png) at once, the live render when ready
//   gearLive(el, slot, id, opts) -> stop(): a slowly turning preview of the item in el (a <canvas>), stops itself when el leaves the page
//
// Cost: renders are queued, ONE per animation frame (~3-15 ms on a phone), so opening the shop never hitches a frame; the renderer
// (one WebGL context, <= 320 px) is released 15 s after the last use. Nothing here touches the game scene, stats or the network.
import { devHook } from './env.js'; // [security L] console/test hook: local dev servers only
import * as THREE from 'three';
import { pirateFigure } from './pirates.js';
import { pirateBodyLod } from './pirateGLB.js';
import { applyGear, normalizeGear, raulItemOf } from './pirateGear.js';

const LOW = (() => { try { return /quality=low/.test(location.search) || matchMedia('(pointer: coarse)').matches; } catch { return false; } })();
const PNG = (slot, id) => new URL(`../assets/pirates/thumbs/${slot}_${id}.png`, import.meta.url).href;
export const thumbFallback = PNG;
// framing per slot (pirate space: y up, +z = the pirate's front, +x = his left; height 1.75 m)
//   c = look-at point, d = camera direction, r = half the shown height
const FRAME = {   // measured from the skinned item bounds in the idle pose (big-head v4: head ~1.2-1.75 m, hands ~0.55 m)
  hat:    { c: [0, 1.68, 0.05], d: [0.3, 0.3, 1], r: 0.42 },   // [v142] v5 heads: tall hats (captain's hat to ~2.05 m) no longer cut at the top
  eyes:   { c: [0, 1.29, 0.12], d: [0.22, 0.05, 1], r: 0.3 },   // [v142] v5 eye line ~1.27 m
  face:   { c: [0, 1.22, 0.12], d: [0.22, 0.05, 1], r: 0.32 },   // [v145] face paint: eyes to chin
  outfit: { c: [0, 0.9, 0], d: [0.3, 0.12, 1], r: 0.52 },
  parrot: { c: [0.27, 1.28, 0], d: [0.9, 0.2, 0.85], r: 0.36 },
  hook:   { c: [-0.25, 0.68, 0.06], d: [-0.75, 0.25, 1], r: 0.2 },   // [v142] v5 shorter arms: the hand sits higher / closer in
  leg:    { c: [-0.14, 0.2, 0.05], d: [-0.25, 0.35, 1], r: 0.3 },   // right leg; LEFT = mirrored [v142] v5 peg y 0-0.33
  beard:  { c: [0, 1.12, 0.12], d: [0.35, 0.05, 1], r: 0.36 },   // [Raul shop items 2] chin to chest (braids)
  ears:   { c: [0.18, 1.2, 0.0], d: [0.85, 0.05, 0.75], r: 0.24 },
  teeth:  { c: [0, 1.15, 0.15], d: [0.1, 0.02, 1], r: 0.15 },
  boots:  { c: [0, 0.09, 0.06], d: [0.95, 0.28, 0.75], r: 0.15 },   // [v6-store-clothes] BANKSY 1:52 PM "better previews": side 3/4 close-up of the shoe pair, filling the card
  pants:  { c: [0, 0.5, 0.02], d: [0.35, 0.1, 1], r: 0.44 },     // [v6-store-clothes] hips to ankles (was the outfit torso frame)
  cape:   { c: [0, 0.85, -0.05], d: [0.7, 0.15, -1], r: 0.6 },
  full:   { c: [0, 0.98, 0], d: [0.35, 0.08, 1], r: 1.12 },   // [v6-store-clothes] CHANGING ROOM: head to feet
  // [Raul items redo 2] the ground pets stand by the captain's left foot (js/petRig.js anchors x 1.25 for the 1.75 m mannequin)
  'parrot:pet_cat': { c: [0.47, 0.2, 0.05], d: [0.75, 0.22, 1], r: 0.27 }, 'parrot:pet_cat_black': { c: [0.47, 0.2, 0.05], d: [0.75, 0.22, 1], r: 0.27 }, 'parrot:pet_monkey': { c: [0.56, 0.36, 0.05], d: [0.45, -0.05, 1], r: 0.46 },
  'parrot:pet_chimp': { c: [0.64, 0.4, 0.05], d: [0.45, -0.05, 1], r: 0.5 }, 'parrot:pet_gorilla': { c: [0.85, 0.5, 0.05], d: [0.75, 0.22, 1], r: 0.62 }, 'parrot:pet_gorilla_white': { c: [0.85, 0.5, 0.05], d: [0.75, 0.22, 1], r: 0.62 }, 'parrot:pet_tiger': { c: [0.62, 0.46, 0.05], d: [0.6, 0.0, 1], r: 0.64 },
  'hat:crown_imperial': { c: [0, 1.82, 0.05], d: [0.3, 0.22, 1], r: 0.5 },
  'hat:mask_luchador': { c: [0, 1.4, 0.05], d: [0.3, 0.12, 1], r: 0.36 },   // [Raul wrestler] the full-head mask: brow skull to the open chin   // [v143] the tall Imperial Crown (cross ~2.2 m) with the face under it
};
// the frame for this slot, mirrored to the pirate's LEFT (+x) for a left hook / peg
function frameOf(slot, o, id) { if (o?.frame === 'full') return FRAME.full; const F = FRAME[slot + ':' + id] || FRAME[slot] || FRAME.outfit, side = slot === 'hook' ? o.hookSide : slot === 'leg' ? o.legSide : 'R';
  return side === 'L' ? { c: [-F.c[0], F.c[1], F.c[2]], d: [-F.d[0], F.d[1], F.d[2]], r: F.r } : F; }
const lookOf = (slot, o) => slot === 'map' ? '' : [slot === 'outfit' ? (o.skin || 'classic') : '', slot === 'hat' ? (o.hatColor | 0) : '', slot === 'hook' ? (o.hookSide === 'L' ? 'L' : 'R') : '',
  slot === 'leg' ? (o.legSide === 'L' ? 'L' : 'R') : '', o.skinColor | 0, o.hairColor | 0, o.body | 0, o.eyeColor | 0, slot === 'cape' ? (o.capeColor | 0) : '', o.wear ? JSON.stringify(o.wear) + (o.skin || '') : ''].join('|');   // [Timothy] wear = other items worn under it (the Crew Shop's uniform)
const keyOf = (slot, id, o) => `${slot}:${id}|${lookOf(slot, o)}|${o.w || TW}x${o.h || TH}|${o.lod || ''}|${o.frame || ''}`;
const TW = 200, TH = 102;   // the shop card swatch is 150 x 76 (css .ishop-sw), drawn at ~1.33x
const cache = new Map();   // key -> dataURL
let R = null, scene = null, cam = null, fig = null, figP = null, scroll = null, idleT = 0;
const queue = []; let pumping = false;
export const thumbStats = { renders: 0, ms: [], dressMs: [], drawMs: [], firstReadyMs: 0 };

function setup(lod) {
  if (R) return figP;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: !LOW, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  R.setPixelRatio(1); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.15; R.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a4a5a, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 0.9); rim.position.set(-2, 2, -3); scene.add(rim);
  cam = new THREE.PerspectiveCamera(28, 1, 0.05, 20);
  const t0 = performance.now();
  figP = new Promise((res) => { fig = pirateFigure({ bodyFromGear: true, look: { skin: 0, hair: 0 }, low: (lod || pirateBodyLod({ low: false })) === 'lo', /* [crew holes] BANKSY "shop mannequins have holes": ONE figure, so phones get the High body too (the Low one shredded the beard / hair and poked skin through tops) */ height: 1.75, clip: 'idle', onReady: (p) => { thumbStats.firstReadyMs = Math.round(performance.now() - t0); res(p); } }); scene.add(fig); });
  return figP;
}
const IDLE_MS = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 3000 : 15000; // [shop-exit-crash] phones: free this 2nd GL context sooner (iOS drops the game's own context under memory pressure)
function release() { if (!R || performance.now() - idleT < IDLE_MS || queue.length || LIVE.size) return;
  try { fig?.userData.dispose?.(); } catch {} R.dispose(); R.forceContextLoss?.(); R = scene = cam = fig = figP = null; }
setInterval(release, IDLE_MS === 3000 ? 1500 : 5000);

// a little treasure map scroll (parchment with a dotted path and a red X between two wooden rolls)
function mapScroll() {
  if (scroll) return scroll;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const g = cv.getContext('2d');
  g.fillStyle = '#ead7a4'; g.fillRect(0, 0, 256, 160); g.fillStyle = 'rgba(120,80,30,.18)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, Math.random() * 160, 6, 3);
  g.fillStyle = '#7fb6c9'; g.beginPath(); g.ellipse(70, 60, 38, 26, 0.3, 0, 7); g.fill(); g.fillStyle = '#9bc46a'; g.beginPath(); g.ellipse(180, 95, 50, 34, -0.2, 0, 7); g.fill();
  g.strokeStyle = '#6b4527'; g.lineWidth = 4; g.setLineDash([8, 7]); g.beginPath(); g.moveTo(40, 130); g.bezierCurveTo(90, 40, 140, 150, 186, 88); g.stroke(); g.setLineDash([]);
  g.strokeStyle = '#c4161c'; g.lineWidth = 9; g.beginPath(); g.moveTo(176, 78); g.lineTo(198, 100); g.moveTo(198, 78); g.lineTo(176, 100); g.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group(); const W = 0.9, H = 0.56;
  const pg = new THREE.PlaneGeometry(W, H, 16, 1), pos = pg.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, 0.06 * Math.cos(x / W * Math.PI * 2)); } pg.computeVertexNormals();
  grp.add(new THREE.Mesh(pg, new THREE.MeshToonMaterial({ map: tex, side: THREE.DoubleSide })));
  const wood = new THREE.MeshToonMaterial({ color: 0x8a5a32 }), paper = new THREE.MeshToonMaterial({ color: 0xd9c08a });
  for (const sx of [-1, 1]) { const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, H + 0.02, 14), paper); roll.position.set(sx * W / 2, 0, 0.06); grp.add(roll);
    for (const sy of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), wood); k.position.set(sx * W / 2, sy * (H / 2 + 0.04), 0.06); grp.add(k); } }
  grp.rotation.set(-0.5, 0.25, 0.08); return (scroll = grp);
}

const dressKey = (slot, id, o) => `${slot}:${id}|${lookOf(slot, o)}`;
async function dressFor(slot, id, o) {
  // [v280 crew holes] mannequin is a V6 body: classic pants cover the lo underwear hem gap unless this card IS the pants/boots (or &crewholes=0).
  const cover = (typeof location === 'undefined' || !/[?&]crewholes=0(?:&|$)/.test(location.search)) && slot !== 'pants' && slot !== 'boots' && !o.wear?.pants;
  await applyGear(fig, normalizeGear({ ...(o.wear || {}), [slot]: id, hatColor: o.hatColor | 0, hookSide: o.hookSide, legSide: o.legSide, skinColor: o.skinColor | 0, hairColor: o.hairColor | 0, body: o.body | 0, eyeColor: o.eyeColor | 0, capeColor: o.capeColor | 0, ...(cover ? { pants: 'classic_pants' } : null) }), slot === 'outfit' || o.wear?.outfit ? { skin: o.skin || 'classic' } : null);
  fig.userData.thumbKey = dressKey(slot, id, o);
}
async function renderOne(slot, id, o) {
  const p = await setup(o.lod); const w = o.w || TW, h = o.h || TH; const t0 = performance.now();
  const isMap = slot === 'map';
  if (isMap) { fig.visible = false; const s = mapScroll(); if (!s.parent) scene.add(s); s.visible = true; cam.position.set(0, 0.25, 1.9); cam.lookAt(0, 0, 0); }
  else {
    if (scroll) scroll.visible = false; fig.visible = true;
    const td = performance.now(); await dressFor(slot, id, o); thumbStats.dressMs.push(Math.round((performance.now() - td) * 10) / 10);
    await new Promise((r) => requestAnimationFrame(r));   // dress and draw in separate frames (each stays short)
    (fig.userData.v4 || p).mixer?.setTime(0.35); fig.updateMatrixWorld(true); // [v112] the body may have been swapped (BODY pick)
    const F = frameOf(slot, o, id), d = new THREE.Vector3(...F.d).normalize(), dist = F.r / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    cam.position.set(F.c[0], F.c[1], F.c[2]).addScaledVector(d, dist); cam.lookAt(F.c[0], F.c[1], F.c[2]);
  }
  cam.aspect = w / h; cam.updateProjectionMatrix();
  if (R.domElement.width !== w || R.domElement.height !== h) R.setSize(w, h, false);
  const tr = performance.now(); R.render(scene, cam); const url = R.domElement.toDataURL('image/png'); thumbStats.drawMs.push(Math.round((performance.now() - tr) * 10) / 10);
  const ms = performance.now() - t0; thumbStats.renders++; thumbStats.ms.push(Math.round(ms * 10) / 10); idleT = performance.now();
  return url;
}
function pump() {
  if (pumping) return; pumping = true;
  const step = async () => {
    const job = queue.shift(); if (!job) { pumping = false; return; }
    try { job.res(await renderOne(job.slot, job.id, job.o)); } catch (e) { console.warn('[gear thumbs]', e); job.res(null); }
    requestAnimationFrame(step);   // one render per frame: never a hitch
  };
  requestAnimationFrame(step);
}
const SHIP_SLOTS = new Set(['flag', 'figure']);   // [Raul shop items 2] ship items: the pre-baked PNG only (no pirate to dress)
export function gearThumb(slot, id, opts = {}) {
  if (SHIP_SLOTS.has(slot)) return Promise.resolve(null);
  const k = keyOf(slot, id, opts);
  if (cache.has(k)) { if (opts.priority) { const i = queue.findIndex((j) => j.k === k); if (i > 0) queue.unshift(...queue.splice(i, 1)); } return cache.get(k); }   // [Timothy] the detail pane jumps the card queue
  const pr = new Promise((res) => { const job = { k, slot, id, o: opts, res }; if (opts.priority) queue.unshift(job); else queue.push(job); pump(); }).then((u) => { if (!u) cache.delete(k); return u; });
  cache.set(k, pr); return pr;
}
export const gearThumbCached = (slot, id, opts = {}) => { const v = cache.get(keyOf(slot, id, opts)); return v && typeof v.then !== 'function' ? v : null; };
export function gearThumbEl(slot, id, opts = {}) {
  const img = new Image(); img.className = 'gear-thumb'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
  const rid = raulItemOf(slot, id, opts), icon = rid && new URL(`../assets/pirates/items/icons/${rid}.png`, import.meta.url).href;   // Raul's 256 px icon (the chosen side)
  img.src = opts.png ? new URL(`../assets/pirates/thumbs/${opts.png}.png`, import.meta.url).href : PNG(slot, id); img.onerror = () => { if (icon && img.src !== icon) { img.src = icon; return; } img.onerror = null; img.style.visibility = 'hidden'; };
  gearThumb(slot, id, opts).then((u) => { if (u) { img.onerror = null; img.style.visibility = ''; img.src = u; img.classList.add('real'); } });
  return img;
}
// live turning preview (the detail pane): draws the shared renderer into el's own 2D canvas ~24 fps while el is on the page
const LIVE = new Set();
export function gearLive(el, slot, id, opts = {}) {
  const cv = el.tagName === 'CANVAS' ? el : el.appendChild(document.createElement('canvas')); const w = opts.w || (LOW ? 240 : 320), h = opts.h || Math.round(w * 76 / 150);
  cv.width = w; cv.height = h; cv.className = cv.className || 'gear-live'; const ctx = cv.getContext('2d');
  let on = true, last = 0, a = 0, ready = false, redress = false; const me = { stop }, dk = dressKey(slot, id, opts);
  if (SHIP_SLOTS.has(slot)) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, w, h); im.src = PNG(slot, id); return () => {}; }   // [Raul shop items 2]
  LIVE.add(me);
  // [Timothy] the pane is never empty: the pre-baked PNG at once, then this item's real still (rendered FIRST, ahead of the cards),
  // then the slow turn once the card queue has drained (the shared figure is re-dressed for the cards until then)
  let turned = false; const still = new Image(); still.decoding = 'async';
  still.onload = () => { if (on && !turned) { ctx.clearRect(0, 0, w, h); ctx.drawImage(still, 0, 0, w, h); } };
  if (slot !== 'map') still.src = opts.png ? new URL(`../assets/pirates/thumbs/${opts.png}.png`, import.meta.url).href : PNG(slot, id);
  (async () => { const u = await gearThumb(slot, id, { ...opts, priority: true }); if (u && on && !turned) still.src = u; ready = true; })();   // dresses + caches the still first
  function frame(t) {
    if (!on) return; if (!cv.isConnected && t > 2000 && last) return stop();
    requestAnimationFrame(frame); if (!ready || t - last < 1000 / (LOW ? 20 : 30) || !R || cv.offsetParent === null || document.hidden) return; last = t;
    if (slot === 'map') { const s = mapScroll(); s.rotation.y = 0.25 + Math.sin(t / 900) * 0.35; fig.visible = false; s.visible = true; cam.position.set(0, 0.25, 1.9); cam.lookAt(0, 0, 0); }
    else {
      if (fig.userData.thumbKey !== dk) { if (!queue.length && !redress) { redress = true; dressFor(slot, id, opts).finally(() => { redress = false; }); } return; }   // stills first
      if (scroll) scroll.visible = false; fig.visible = true; a += 0.03; fig.rotation.y = Math.sin(a) * 0.7;
      const F = frameOf(slot, opts, id), d = new THREE.Vector3(...F.d).normalize(), dist = F.r / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      cam.position.set(F.c[0], F.c[1], F.c[2]).addScaledVector(d, dist); cam.lookAt(F.c[0], F.c[1], F.c[2]);
    }
    cam.aspect = w / h; cam.updateProjectionMatrix(); if (R.domElement.width !== w || R.domElement.height !== h) R.setSize(w, h, false);
    R.render(scene, cam); ctx.clearRect(0, 0, w, h); ctx.drawImage(R.domElement, 0, 0); fig.rotation.y = 0; idleT = performance.now(); turned = true;
  }
  requestAnimationFrame(frame);
  function stop() { on = false; LIVE.delete(me); }
  return stop;
}
devHook('PFP_GEAR_THUMBS', { gearThumb, gearThumbEl, gearLive, thumbStats, cacheSize: () => cache.size, _fig: () => fig });
