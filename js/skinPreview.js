// [Raul] skin previews — PUMPFUN PIRATES · Storm Hunt
// Real rendered side-view previews of YOUR current build in every skin, for the shop's SKINS tab.
// Performance: ONE shared offscreen WebGL renderer (alpha, transparent clear) renders each preview once into a
// small 2D canvas that is cached per skin + build key (upgrade levels + quality). Nothing animates in WebGL:
// cards just show the cached bitmap. Renders run one at a time in idle callbacks only while the shop is open,
// so opening the shop never hitches; the renderer (and its GL context) is released ~20 s after the shop closes.
// No sky / sea / fog / wake / particles / water lid: the scene only holds the ship + simple preview lighting.
// If WebGL is unavailable or a render fails, the card keeps its painted swatch (fallback).
import * as THREE from 'three';
import { compilePreview } from './upgradeVisuals.js';
import { disposeShip } from './ships.js';

const W = 360, H = 200;            // preview bitmap size (CSS shows it at card width; 2x on high-dpi via DPR below)
const cache = new Map();           // key -> HTMLCanvasElement (2D, transparent)
const MAX_CACHE = 24;
let R = null, failed = false, idleKill = 0;
let base = {};                     // buildShip extras from main.js (classic sail / flag textures), quality
export const previewOptions = { glow: 'rim' }; // 'none' | 'rim' (soft skin-tinted halo hugging the silhouette) | 'radial'

export function initSkinPreview(opts) { base = { ...opts }; }
const keyOf = (skin, levels) => `${skin.id}|${Object.keys(levels).sort().map(k => k + levels[k]).join('')}|${base.quality || 'high'}|${previewOptions.glow}`;
export const cachedPreview = (skin, levels) => cache.get(keyOf(skin, levels)) || null;

function renderer() {
  if (R) return R;
  if (failed) return null;
  try {
    const canvas = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1) * (base.quality === 'low' ? 0.75 : 1);
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    r.setPixelRatio(dpr); r.setSize(W, H, false); r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping;
    const scene = new THREE.Scene(); scene.background = null; scene.fog = null;
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a4a5a, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(30, 40, 18); scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.7); fill.position.set(10, 8, -30); scene.add(fill);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    R = { r, scene, cam, dpr };
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); releaseRenderer(); }, false);
    return R;
  } catch (e) { console.warn('[skin preview] WebGL unavailable, keeping swatches', e); failed = true; return null; }
}
export function releaseRenderer() {
  if (!R) return;
  try { R.r.dispose(); R.r.forceContextLoss?.(); } catch { /* already gone */ }
  R = null;
}
// render one preview synchronously; returns a transparent 2D canvas or null
export function renderPreview(skin, levels) {
  const k = keyOf(skin, levels);
  if (cache.has(k)) return cache.get(k);
  const X = renderer(); if (!X) return null;
  let ship = null;
  try {
    ship = compilePreview(levels, { ...base, skin, light: false, shadows: false });
    ship.traverse(o => { if (o.userData?.waterMask || o.isLight || o.isPoints || o.isSprite) o.visible = false; });
    // broadside profile, bow to the right. Square sails sit across the keel, so a dead-on 90° view shows them
    // edge-on (bare sticks); a 20° quarter turn keeps the side profile but lets the sail faces + skull read.
    ship.rotation.y = Math.PI / 2 - THREE.MathUtils.degToRad(20);
    X.scene.add(ship); ship.updateMatrixWorld(true);
    X.cam.position.set(0, 18, 120); X.cam.lookAt(0, 0, 0); X.cam.updateMatrixWorld(true); // ~8.5° downward tilt
    // fit tightly: bounds of every visible mesh's box corners in camera space
    const inv = X.cam.matrixWorldInverse, lo = new THREE.Vector3(1e9, 1e9, 1e9), hi = new THREE.Vector3(-1e9, -1e9, -1e9), v = new THREE.Vector3();
    ship.traverse(o => {
      if (!o.isMesh || !o.visible || o.userData.outline) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      for (let i = 0; i < 8; i++) { v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(o.matrixWorld).applyMatrix4(inv); lo.min(v); hi.max(v); }
    });
    const aspect = W / H, pad = 1.06, cx = (lo.x + hi.x) / 2, cy = (lo.y + hi.y) / 2;
    const halfH = Math.max((hi.y - lo.y) / 2, (hi.x - lo.x) / 2 / aspect) * pad;
    Object.assign(X.cam, { left: cx - halfH * aspect, right: cx + halfH * aspect, top: cy + halfH, bottom: cy - halfH });
    X.cam.updateProjectionMatrix();
    X.r.render(X.scene, X.cam);
    const out = document.createElement('canvas'); out.width = Math.round(W * X.dpr); out.height = Math.round(H * X.dpr);
    const g = out.getContext('2d');
    drawWithGlow(g, X.r.domElement, out.width, out.height, skin);
    cache.set(k, out);
    while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    return out;
  } catch (e) { console.warn('[skin preview] render failed, keeping swatch', e); return null; }
  finally { if (ship) { X.scene.remove(ship); disposeShip(ship); } }
}
// halo colour per skin (reads on the dark shop cards, esp. Midnight Black)
function glowColor(skin) { const c = skin.swatch?.trim || '#ffcd77'; return c; }
function drawWithGlow(g, src, w, h, skin) {
  const mode = previewOptions.glow, col = glowColor(skin);
  if (mode === 'radial') {
    const r = g.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, w * 0.5);
    r.addColorStop(0, hexA(col, 0.45)); r.addColorStop(0.55, hexA(col, 0.14)); r.addColorStop(1, hexA(col, 0));
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  } else if (mode === 'rim') { // soft halo hugging the silhouette: only the blurred shadow of an off-canvas copy lands
    const tmp = tint(src, w, h, col), off = w * 2; // (shadowBlur works on every browser, ctx.filter doesn't on older iOS)
    g.save(); g.shadowColor = hexA(col, 0.9); g.shadowOffsetX = off; g.shadowOffsetY = 0;
    for (const [b, a] of [[w * 0.035, 0.9], [w * 0.012, 0.8]]) { g.shadowBlur = Math.round(b); g.globalAlpha = a; g.drawImage(tmp, -off, 0); }
    g.restore();
  }
  g.drawImage(src, 0, 0, w, h);
}
function tint(src, w, h, col) { // silhouette in the glow colour
  const c = document.createElement('canvas'); c.width = w; c.height = h; const t = c.getContext('2d');
  t.drawImage(src, 0, 0, w, h); t.globalCompositeOperation = 'source-in'; t.fillStyle = col; t.fillRect(0, 0, w, h);
  return c;
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

// ---------- lazy queue: one preview per idle slot while the shop is open ----------
let queue = [], pumping = 0, onReady = null;
const idle = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 120 }) : (f) => setTimeout(() => f({ timeRemaining: () => 10 }), 16);
export function requestPreviews(skins, levels, cb) {
  clearTimeout(idleKill);
  onReady = cb;
  queue = skins.filter(s => !cache.has(keyOf(s, levels))).map(s => ({ s, levels: { ...levels } }));
  for (const s of skins) { const c = cache.get(keyOf(s, levels)); if (c) cb(s, c); }
  pump();
}
function pump() {
  if (pumping || !queue.length) return;
  pumping = 1;
  idle(() => {
    pumping = 0;
    const job = queue.shift(); if (!job) return;
    const c = renderPreview(job.s, job.levels);
    if (c) onReady?.(job.s, c); else if (failed) { queue = []; return; }
    pump();
  });
}
// shop closed: stop work, free the GL context after a while (cached bitmaps stay)
export function pausePreviews() { queue = []; clearTimeout(idleKill); idleKill = setTimeout(releaseRenderer, 20000); }
window.PFP_PREVIEW = { previewOptions, renderPreview, cache, releaseRenderer, clear: () => cache.clear() };
