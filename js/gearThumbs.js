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
import * as THREE from 'three';
import { pirateFigure } from './pirates.js';
import { applyGear, normalizeGear, raulItemOf } from './pirateGear.js';

const LOW = (() => { try { return /quality=low/.test(location.search) || matchMedia('(pointer: coarse)').matches; } catch { return false; } })();
const PNG = (slot, id) => new URL(`../assets/pirates/thumbs/${slot}_${id}.png`, import.meta.url).href;
export const thumbFallback = PNG;
// framing per slot (pirate space: y up, +z = the pirate's front, +x = his left; height 1.75 m)
//   c = look-at point, d = camera direction, r = half the shown height
const FRAME = {   // measured from the skinned item bounds in the idle pose (big-head v4: head ~1.2-1.75 m, hands ~0.55 m)
  hat:    { c: [0, 1.6, 0.05], d: [0.3, 0.3, 1], r: 0.36 },
  eyes:   { c: [0, 1.42, 0.1], d: [0.22, 0.05, 1], r: 0.25 },
  outfit: { c: [0, 0.9, 0], d: [0.3, 0.12, 1], r: 0.52 },
  parrot: { c: [0.27, 1.28, 0], d: [0.9, 0.2, 0.85], r: 0.36 },
  hook:   { c: [-0.36, 0.57, 0.1], d: [-0.75, 0.25, 1], r: 0.2 },
  leg:    { c: [-0.08, 0.3, 0.05], d: [-0.25, 0.35, 1], r: 0.32 },   // right leg; LEFT = mirrored
};
// the frame for this slot, mirrored to the pirate's LEFT (+x) for a left hook / peg
function frameOf(slot, o) { const F = FRAME[slot] || FRAME.outfit, side = slot === 'hook' ? o.hookSide : slot === 'leg' ? o.legSide : 'R';
  return side === 'L' ? { c: [-F.c[0], F.c[1], F.c[2]], d: [-F.d[0], F.d[1], F.d[2]], r: F.r } : F; }
const lookOf = (slot, o) => slot === 'map' ? '' : [slot === 'outfit' ? (o.skin || 'classic') : '', slot === 'hat' ? (o.hatColor | 0) : '', slot === 'hook' ? (o.hookSide === 'L' ? 'L' : 'R') : '',
  slot === 'leg' ? (o.legSide === 'L' ? 'L' : 'R') : '', o.skinColor | 0, o.hairColor | 0].join('|');
const keyOf = (slot, id, o) => `${slot}:${id}|${lookOf(slot, o)}|${o.w || TW}x${o.h || TH}|${o.lod || ''}`;
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
  figP = new Promise((res) => { fig = pirateFigure({ look: { skin: 0, hair: 0 }, low: (lod || (LOW ? 'lo' : 'hi')) === 'lo', height: 1.75, clip: 'idle', onReady: (p) => { thumbStats.firstReadyMs = Math.round(performance.now() - t0); res(p); } }); scene.add(fig); });
  return figP;
}
function release() { if (!R || performance.now() - idleT < 15000 || queue.length || LIVE.size) return;
  try { fig?.userData.dispose?.(); } catch {} R.dispose(); R.forceContextLoss?.(); R = scene = cam = fig = figP = null; }
setInterval(release, 5000);

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
  await applyGear(fig, normalizeGear({ [slot]: id, hatColor: o.hatColor | 0, hookSide: o.hookSide, legSide: o.legSide, skinColor: o.skinColor | 0, hairColor: o.hairColor | 0 }), slot === 'outfit' ? { skin: o.skin || 'classic' } : null);
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
    p.mixer?.setTime(0.35); fig.updateMatrixWorld(true);
    const F = frameOf(slot, o), d = new THREE.Vector3(...F.d).normalize(), dist = F.r / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
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
export function gearThumb(slot, id, opts = {}) {
  const k = keyOf(slot, id, opts); if (cache.has(k)) return cache.get(k);
  const pr = new Promise((res) => { queue.push({ slot, id, o: opts, res }); pump(); }).then((u) => { if (!u) cache.delete(k); return u; });
  cache.set(k, pr); return pr;
}
export const gearThumbCached = (slot, id, opts = {}) => { const v = cache.get(keyOf(slot, id, opts)); return v && typeof v.then !== 'function' ? v : null; };
export function gearThumbEl(slot, id, opts = {}) {
  const img = new Image(); img.className = 'gear-thumb'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
  const rid = raulItemOf(slot, id, opts), icon = rid && new URL(`../assets/pirates/items/icons/${rid}.png`, import.meta.url).href;   // Raul's 256 px icon (the chosen side)
  img.src = PNG(slot, id); img.onerror = () => { if (icon && img.src !== icon) { img.src = icon; return; } img.onerror = null; img.style.visibility = 'hidden'; };
  gearThumb(slot, id, opts).then((u) => { if (u) { img.onerror = null; img.style.visibility = ''; img.src = u; img.classList.add('real'); } });
  return img;
}
// live turning preview (the detail pane): draws the shared renderer into el's own 2D canvas ~24 fps while el is on the page
const LIVE = new Set();
export function gearLive(el, slot, id, opts = {}) {
  const cv = el.tagName === 'CANVAS' ? el : el.appendChild(document.createElement('canvas')); const w = opts.w || (LOW ? 240 : 320), h = opts.h || Math.round(w * 76 / 150);
  cv.width = w; cv.height = h; cv.className = cv.className || 'gear-live'; const ctx = cv.getContext('2d');
  let on = true, last = 0, a = 0, ready = false, redress = false; const me = { stop }, dk = dressKey(slot, id, opts);
  LIVE.add(me);
  (async () => { await gearThumb(slot, id, opts); ready = true; })();   // dresses + caches the still first
  function frame(t) {
    if (!on) return; if (!cv.isConnected && t > 2000 && last) return stop();
    requestAnimationFrame(frame); if (!ready || t - last < 1000 / (LOW ? 20 : 30) || !R || cv.offsetParent === null || document.hidden) return; last = t;
    if (slot === 'map') { const s = mapScroll(); s.rotation.y = 0.25 + Math.sin(t / 900) * 0.35; fig.visible = false; s.visible = true; cam.position.set(0, 0.25, 1.9); cam.lookAt(0, 0, 0); }
    else {
      if (fig.userData.thumbKey !== dk) { if (!queue.length && !redress) { redress = true; dressFor(slot, id, opts).finally(() => { redress = false; }); } return; }   // stills first
      if (scroll) scroll.visible = false; fig.visible = true; a += 0.03; fig.rotation.y = Math.sin(a) * 0.7;
      const F = frameOf(slot, opts), d = new THREE.Vector3(...F.d).normalize(), dist = F.r / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      cam.position.set(F.c[0], F.c[1], F.c[2]).addScaledVector(d, dist); cam.lookAt(F.c[0], F.c[1], F.c[2]);
    }
    cam.aspect = w / h; cam.updateProjectionMatrix(); if (R.domElement.width !== w || R.domElement.height !== h) R.setSize(w, h, false);
    R.render(scene, cam); ctx.clearRect(0, 0, w, h); ctx.drawImage(R.domElement, 0, 0); fig.rotation.y = 0; idleT = performance.now();
  }
  requestAnimationFrame(frame);
  function stop() { on = false; LIVE.delete(me); }
  return stop;
}
window.PFP_GEAR_THUMBS = { gearThumb, gearThumbEl, gearLive, thumbStats, cacheSize: () => cache.size, _fig: () => fig };
