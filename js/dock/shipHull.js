// [v333+] Walk-in Ship Captain's Quarters (ship_quarters): sculpted 14-kit naval cabin + storage + dock/sea return.
// Modular: room + enter/leave live here; storage reuses houses.js with cottage_id = 'ship_quarters'.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRest, hullRestSpots, restPrompt } from './bedDesk.js'; // [bed-desk] t405u LIE IN BED (berth) / SIT AT DESK (chart table)

export const SHIP_QUARTERS_ID = 'ship_quarters';
export const SHIP_QUARTERS_SLOTS = 12;
export const HULL_COMBAT_LOCK_S = 8;
export const HULL_QA = typeof location !== 'undefined' && /[?&]hullqa=1(?:&|$)/.test(location.search || '');

export const QUARTERS_GLB = 'assets/island/captains_quarters.glb';
// [v339 mobile-stability] BANKSY t1792u "On mobile the tab refreshes and restarts me": iOS Safari kills (and reloads) a tab that crosses its
// ~350-450 MB budget. Phones / low-memory devices never decode the quarters at Harbor boot (lazy: first ENTER HULL), use the _lo ship-kit
// maps (no normal maps), anisotropy 1, quarter/half-size procedural canvases, ONE Draco worker, and free every per-visit GPU resource on leave.
// ?lowmem=1 / ?lowmem=0 force it on / off.
export const QUARTERS_LOW_MEM = (() => {
  try {
    const q = typeof location !== 'undefined' ? (location.search || '') : '';
    if (/[?&]lowmem=0(?:&|$)/.test(q)) return false;
    if (/[?&]lowmem=1(?:&|$)/.test(q)) return true;
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '', mem = +navigator.deviceMemory || 0;
    return /Android|iPhone|iPad|iPod/i.test(ua) || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || (mem > 0 && mem <= 4);
  } catch { return false; }
})();
const Q_ANISO = QUARTERS_LOW_MEM ? 1 : 8;
/** [v339] canvas scale on low-memory devices: 2048/1024 px -> 1/4, 512-768 px -> 1/2, small sprites untouched. */
function _texScale(w, h) { const m = Math.max(w, h); return QUARTERS_LOW_MEM ? (m >= 1024 ? 0.25 : m >= 512 ? 0.5 : 1) : Math.min(1, 1024 / m); }
export const QUARTERS_KITS = Object.freeze([
  'stern_gallery_kit', 'hull_rib_kit', 'wainscot_bay_kit', 'porthole_kit',
  'wheel_chandelier_kit', 'gimbal_lantern_kit', 'chart_table_kit', 'berth_kit',
  'quarters_chest_kit', 'navigator_bureau_kit', 'armory_bookcase_kit',
  'rum_cargo_kit', 'trophy_credenza_kit', 'companionway_door_kit',
]);

const QW = 11.6, QD = 11.0, QH = 3.95, QPEAK = 4.35, QTH = 0.55, QFLOOR = 0.14;
/** Tumblehome: how far the hull planking leans in at height y above the deck (0 at deck, 0.55 m at deck-head). */
export function quartersWallInset(y) { const z = Math.max(0, Math.min(QH, y)); return QTH * (z / QH) * (z / QH); }
/** Cambered deck-head height above the deck at athwartships x (QH at hull, QPEAK on centreline). */
export function quartersCeil(x) { const hw = QW / 2 - QTH, u = Math.min(1, Math.abs(x) / hw); return QH + (QPEAK - QH) * (1 - u * u); }

// --- Cached procedural textures & PBR helpers (zero per-visit regeneration) ---
const _texCache = Object.create(null);
function _canDraw() { return typeof document !== 'undefined' && typeof document.createElement === 'function'; }
function _rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function _canvasTex(key, w, h, draw, { repeatX = 1, repeatY = 1, colorSpace = true, wrap = true, pixel = false } = {}) {
  if (_texCache[key]) return _texCache[key];
  if (!_canDraw()) { _texCache[key] = null; return null; }
  const f = _texScale(w, h), cw = Math.max(1, Math.round(w * f)), ch = Math.max(1, Math.round(h * f));
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  // [v339] path-drawn textures keep their authored coordinates (ctx.scale); ImageData painters (pixel: true) fill the real canvas size
  try { if (pixel) draw(ctx, cw, ch); else { if (f !== 1) ctx.scale(f, f); draw(ctx, w, h); } } catch { /* headless fallback */ }
  const t = new THREE.CanvasTexture(cv);
  if (colorSpace) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY); }
  t.anisotropy = Q_ANISO; t.needsUpdate = true;
  t.userData = { cached: true };
  _texCache[key] = t;
  return t;
}
function _heightToNormal(key, w, h, heightFn, strength = 2.4) {
  if (_texCache[key]) return _texCache[key];
  if (!_canDraw() || QUARTERS_LOW_MEM) { _texCache[key] = null; return null; } // [v339] phones: no procedural normal maps (flat shading, zero extra VRAM)
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const H = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = heightFn(x, y, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const l = H[y * w + ((x - 1 + w) % w)], r = H[y * w + ((x + 1) % w)];
    const u = H[((y - 1 + h) % h) * w + x], d = H[((y + 1) % h) * w + x];
    const nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
    const inv = 1 / Math.hypot(nx, ny, nz), o = i * 4;
    img.data[o] = ((nx * inv) * 0.5 + 0.5) * 255;
    img.data[o + 1] = ((ny * inv) * 0.5 + 0.5) * 255;
    img.data[o + 2] = ((nz * inv) * 0.5 + 0.5) * 255;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Q_ANISO; t.needsUpdate = true;
  t.userData = { cached: true };
  _texCache[key] = t;
  return t;
}

function matStd(hex, key, {
  map = null, normalMap = null, roughnessMap = null, roughness = 0.7, metalness = 0.05,
  emissive = 0x000000, emissiveIntensity = 0, envMapIntensity = 0.35, normalScale = 1,
} = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: hex, map: map || null, normalMap: normalMap || null, roughnessMap: roughnessMap || null,
    roughness, metalness, emissive, emissiveIntensity, envMapIntensity,
    side: THREE.DoubleSide, fog: false,
  });
  if (normalMap) m.normalScale = new THREE.Vector2(normalScale, normalScale);
  m.userData.key = key;
  return m;
}

// Reuse the main scene environment: entering a room must not allocate a cube camera /
// PMREM render target while the entire Harbor (including the casino) is still resident.

/** Painted stern view: golden-hour sky, low sun, distant brigantine, turquoise sea, churning ship wake. */
function texSternWake() {
  return _canvasTex('cqWake', 2048, 1024, (ctx, w, h) => {
    const R = _rng(7331), hz = h * 0.47;
    let g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#2f5f93'); g.addColorStop(0.45, '#7fa6c4'); g.addColorStop(0.78, '#f0c784'); g.addColorStop(1, '#ffe3a6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz + 2);
    const sx = w * 0.63, sy = hz - h * 0.07;
    g = ctx.createRadialGradient(sx, sy, 0, sx, sy, w * 0.42);
    g.addColorStop(0, 'rgba(255,244,205,0.95)'); g.addColorStop(0.12, 'rgba(255,220,150,0.6)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz + 2);
    for (let c = 0; c < 26; c++) {
      const cx = R() * w, cy = h * (0.08 + R() * 0.3), cw = w * (0.06 + R() * 0.12);
      for (let p = 0; p < 14; p++) {
        const px = cx + (R() - 0.5) * cw * 1.6, py = cy + (R() - 0.5) * cw * 0.22, pr = cw * (0.18 + R() * 0.25);
        const cg = ctx.createRadialGradient(px, py - pr * 0.3, pr * 0.1, px, py, pr);
        const near = 1 - Math.min(1, Math.hypot(px - sx, py - sy) / (w * 0.5));
        cg.addColorStop(0, `rgba(255,${226 + near * 20 | 0},${178 + near * 40 | 0},${0.5 + near * 0.3})`);
        cg.addColorStop(0.6, 'rgba(214,170,170,0.28)'); cg.addColorStop(1, 'rgba(160,140,170,0)');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(px, py, pr * 1.6, pr * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(255,250,225,1)'; ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(92,92,110,0.75)'; ctx.beginPath(); ctx.moveTo(w * 0.04, hz);
    for (let i = 0; i <= 40; i++) { const t = i / 40; ctx.lineTo(w * (0.04 + 0.2 * t), hz - Math.sin(t * Math.PI) * h * 0.035 * (0.7 + 0.3 * Math.sin(t * 17))); }
    ctx.closePath(); ctx.fill();
    const bx = w * 0.3, by = hz - 2; ctx.fillStyle = 'rgba(52,40,36,0.85)';
    ctx.beginPath(); ctx.moveTo(bx - 34, by - 10); ctx.lineTo(bx + 40, by - 10); ctx.lineTo(bx + 30, by + 1); ctx.lineTo(bx - 26, by + 1); ctx.fill();
    ctx.fillRect(bx - 8, by - 74, 3, 64); ctx.fillRect(bx + 14, by - 62, 3, 52);
    ctx.fillStyle = 'rgba(250,232,200,0.85)';
    for (const [mx, top, hgt] of [[bx - 7, 70, 54], [bx + 15, 58, 44]]) for (let k = 0; k < 3; k++) {
      const y0 = by - top + k * hgt / 3, ww = 22 - k * 2;
      ctx.beginPath(); ctx.moveTo(mx - ww / 2, y0); ctx.quadraticCurveTo(mx + 4, y0 + hgt / 6, mx - ww / 2, y0 + hgt / 3 - 2);
      ctx.lineTo(mx + ww / 2, y0 + hgt / 3 - 2); ctx.quadraticCurveTo(mx + 8, y0 + hgt / 6, mx + ww / 2, y0); ctx.fill();
    }
    g = ctx.createLinearGradient(0, hz, 0, h);
    g.addColorStop(0, '#9ad9d6'); g.addColorStop(0.08, '#3fb3bf'); g.addColorStop(0.45, '#137f97'); g.addColorStop(1, '#0a4f68');
    ctx.fillStyle = g; ctx.fillRect(0, hz, w, h - hz);
    ctx.fillStyle = 'rgba(255,236,180,0.55)'; ctx.fillRect(0, hz, w, 2);
    for (let i = 0; i < 5200; i++) {
      const t = Math.pow(R(), 1.6), y = hz + 3 + t * (h - hz), s = 1 + t * 26;
      const x = R() * w, dark = R() < 0.5;
      ctx.fillStyle = dark ? `rgba(4,48,66,${0.18 + t * 0.15})` : `rgba(170,240,240,${0.1 + t * 0.12})`;
      ctx.fillRect(x, y, s * (3 + R() * 4), Math.max(1, s * 0.22));
    }
    for (let i = 0; i < 2600; i++) {
      const t = Math.pow(R(), 1.3), y = hz + 2 + t * (h - hz) * 0.9, spread = 30 + t * 520;
      const x = sx + (R() - 0.5) * spread * (0.6 + R()), s = 1 + t * 10;
      ctx.fillStyle = `rgba(255,${226 + R() * 29 | 0},${160 + R() * 80 | 0},${0.35 + 0.5 * (1 - t) * R()})`;
      ctx.fillRect(x, y, s * (2 + R() * 4), Math.max(1, s * 0.3));
    }
    const vx = w * 0.5;
    for (let i = 0; i < 4200; i++) {
      const t = Math.pow(R(), 0.75), y = hz + 4 + t * (h - hz), half = 6 + t * w * 0.34;
      const edge = R() < 0.55, side = R() < 0.5 ? -1 : 1;
      const x = edge ? vx + side * half * (0.86 + R() * 0.16) : vx + (R() - 0.5) * half * (0.35 + 0.5 * t);
      const s = 1 + t * 20, a = (edge ? 0.35 : 0.5) * (0.35 + 0.65 * t);
      ctx.fillStyle = edge ? `rgba(236,252,250,${a})` : `rgba(${180 + R() * 70 | 0},248,244,${a})`;
      ctx.beginPath(); ctx.ellipse(x, y, s * (1.6 + R() * 2.4), s * (0.35 + R() * 0.3), (R() - 0.5) * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    g = ctx.createLinearGradient(0, h * 0.72, 0, h); g.addColorStop(0, 'rgba(160,250,240,0)'); g.addColorStop(1, 'rgba(170,250,240,0.4)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(vx - 10, h * 0.72); ctx.lineTo(vx + 10, h * 0.72); ctx.lineTo(vx + w * 0.17, h); ctx.lineTo(vx - w * 0.17, h); ctx.fill();
    for (let i = 0; i < 60; i++) {
      if (R() > 0.25) continue; const gx = R() * w, gy = h * (0.12 + R() * 0.25), gs = 5 + R() * 7;
      ctx.strokeStyle = 'rgba(40,40,50,0.7)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(gx - gs, gy); ctx.quadraticCurveTo(gx - gs / 2, gy - gs / 2, gx, gy); ctx.quadraticCurveTo(gx + gs / 2, gy - gs / 2, gx + gs, gy); ctx.stroke();
    }
  }, { wrap: false });
}

function texPortholeSea() {
  return _canvasTex('cqPort', 512, 512, (ctx, w, h) => {
    const R = _rng(91), hz = h * 0.46;
    let g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#5d8fbf'); g.addColorStop(0.7, '#e9cf9a'); g.addColorStop(1, '#ffe8b4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz);
    for (let i = 0; i < 18; i++) {
      const x = R() * w, y = h * (0.1 + R() * 0.25), r = 20 + R() * 40;
      const c = ctx.createRadialGradient(x, y, 2, x, y, r);
      c.addColorStop(0, 'rgba(255,240,215,0.7)'); c.addColorStop(1, 'rgba(255,230,200,0)');
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    g = ctx.createLinearGradient(0, hz, 0, h); g.addColorStop(0, '#5cc4c8'); g.addColorStop(0.3, '#1a8fa4'); g.addColorStop(1, '#0b5670');
    ctx.fillStyle = g; ctx.fillRect(0, hz, w, h - hz);
    for (let i = 0; i < 1400; i++) {
      const t = Math.pow(R(), 1.4), y = hz + 2 + t * (h - hz), s = 1 + t * 8;
      ctx.fillStyle = R() < 0.5 ? `rgba(6,50,70,${0.2 + t * 0.2})` : `rgba(220,250,250,${0.15 + t * 0.35})`;
      ctx.fillRect(R() * w, y, s * (3 + R() * 5), Math.max(1, s * 0.25));
    }
  }, { wrap: false });
}

function _grainH(x, y, w, h) {
  const u = x / w, v = y / h;
  const warp = Math.sin(u * 6.283 * 2 + Math.sin(v * 6.283 * 3) * 1.4) * 0.06 + Math.sin(u * 6.283 * 5 + v * 6.283) * 0.02;
  const ring = Math.sin((v + warp) * 6.283 * 22);
  const fine = Math.sin((v + warp * 1.6) * 6.283 * 140 + Math.sin(u * 6.283 * 37) * 2);
  return 0.55 + ring * 0.25 + fine * 0.08;
}
function texMahogany() {
  return _canvasTex('cqMahog', 1024, 1024, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = _grainH(x, y, w, h), o = (y * w + x) * 4;
      img.data[o] = 150 + k * 100; img.data[o + 1] = 118 + k * 82; img.data[o + 2] = 100 + k * 70; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, { pixel: true });
}
function texMahoganyN() { return _heightToNormal('cqMahogN', 512, 512, (x, y, w, h) => _grainH(x * 2, y * 2, w * 2, h * 2) * 0.35, 2.0); }
function texVelvet() {
  return _canvasTex('cqVelvet', 256, 256, (ctx, w, h) => {
    const R = _rng(5); ctx.fillStyle = '#d8d8d8'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 180 + R() * 75 | 0; ctx.fillStyle = `rgba(${v},${v},${v},0.35)`; ctx.fillRect(R() * w, R() * h, 1, 1 + R() * 3); }
  });
}
function texRug() {
  return _canvasTex('cqRug', 1024, 768, (ctx, w, h) => {
    ctx.fillStyle = '#6e1014'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8000; i++) {
      const x = (i * 37) % w, y = (i * 61) % h;
      ctx.fillStyle = `rgba(${180 + i % 40},${30 + i % 20},30,${0.04 + (i % 4) * 0.01})`;
      ctx.fillRect(x, y, 2, 2);
    }
    let inset = 10;
    for (const [col, lw] of [['#c9a24b', 22], ['#2a0c0c', 8], ['#d4b45a', 14], ['#8b1e1e', 6], ['#e8c86a', 10]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
      inset += lw + 4;
    }
    ctx.fillStyle = '#c9a24b';
    for (const [cx, cy] of [[70, 70], [w - 70, 70], [70, h - 70], [w - 70, h - 70]]) {
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a0c0c'; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8c86a'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9a24b';
    }
    ctx.save(); ctx.translate(w / 2, h / 2);
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.beginPath(); ctx.moveTo(0, -110); ctx.lineTo(i % 2 ? 8 : 14, 0); ctx.lineTo(0, 18); ctx.lineTo(i % 2 ? -8 : -14, 0); ctx.closePath();
      ctx.fillStyle = i % 2 ? '#f4e2bb' : '#e8c86a'; ctx.fill();
      ctx.strokeStyle = '#2a0c0c'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fillStyle = '#2a0c0c'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fillStyle = '#c9a24b'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fillStyle = '#f4e2bb'; ctx.fill();
    ctx.restore();
  }, { wrap: false });
}
function texRugN() {
  return _heightToNormal('cqRugN', 512, 384, (x, y, w, h) => {
    const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
    let ht = 0.45 + ((x + y) % 3) * 0.02;
    if (edge < 18) ht = 0.62;
    if (Math.hypot(x - w / 2, y - h / 2) < 90) ht += 0.08;
    return ht;
  }, 2.0);
}
function texMap() {
  return _canvasTex('cqMap', 768, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d4b07a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(160,110,50,${0.04 + (i % 5) * 0.02})`;
      ctx.beginPath(); ctx.ellipse((i * 73) % w, (i * 97) % h, 34 + i % 24, 20, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(50, 260); ctx.bezierCurveTo(160, 90, 280, 110, 360, 200); ctx.bezierCurveTo(440, 290, 560, 220, 720, 270); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(80, 360); ctx.bezierCurveTo(180, 390, 260, 320, 340, 370); ctx.bezierCurveTo(450, 440, 560, 380, 700, 410); ctx.stroke();
    ctx.fillStyle = '#6a8a4a';
    for (const [ix, iy, ir] of [[200, 180, 36], [400, 250, 28], [560, 170, 22], [280, 330, 20]]) {
      ctx.beginPath(); ctx.ellipse(ix, iy, ir, ir * 0.7, 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.setLineDash([5, 7]); ctx.strokeStyle = '#8b1e1e'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(100, 310); ctx.lineTo(200, 180); ctx.lineTo(400, 250); ctx.lineTo(560, 170); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#a01818'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(545, 155); ctx.lineTo(575, 185); ctx.moveTo(575, 155); ctx.lineTo(545, 185); ctx.stroke();
    ctx.fillStyle = '#3a2410'; ctx.font = 'bold 22px serif'; ctx.fillText('N', 48, 58);
    ctx.font = '16px serif'; ctx.fillText('Isle of Doubloons', 480, 460);
  }, { wrap: false });
}
let _jollyTex = null;
function texJollyRoger() {
  if (_jollyTex) return _jollyTex;
  if (!_canDraw()) return null;
  const cv = document.createElement('canvas'), jf = QUARTERS_LOW_MEM ? 0.5 : 1; cv.width = 512 * jf; cv.height = 640 * jf;
  const ctx = cv.getContext('2d'); if (jf !== 1) ctx.scale(jf, jf); // [v339] half-size flag on phones
  ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, 512, 640);
  ctx.strokeStyle = '#c9a24b'; ctx.lineWidth = 14; ctx.strokeRect(14, 14, 484, 612);
  ctx.fillStyle = '#f4e2bb'; ctx.beginPath(); ctx.ellipse(256, 250, 100, 110, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0d0d0d';
  ctx.beginPath(); ctx.ellipse(216, 230, 22, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(296, 230, 22, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(236, 290, 40, 14);
  ctx.strokeStyle = '#f4e2bb'; ctx.lineWidth = 18;
  ctx.beginPath(); ctx.moveTo(140, 400); ctx.lineTo(372, 520); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(372, 400); ctx.lineTo(140, 520); ctx.stroke();
  ctx.fillStyle = '#c9a24b'; ctx.font = 'bold 36px serif'; ctx.textAlign = 'center';
  ctx.fillText('PUMPFUN PIRATES', 256, 580);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Q_ANISO; t.needsUpdate = true;
  t.userData = { cached: true };
  _jollyTex = t;
  try {
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, 512, 640);
      ctx.strokeStyle = '#c9a24b'; ctx.lineWidth = 14; ctx.strokeRect(14, 14, 484, 612);
      ctx.drawImage(img, 56, 70, 400, 400);
      ctx.fillStyle = '#c9a24b'; ctx.font = 'bold 36px serif'; ctx.textAlign = 'center';
      ctx.fillText('PUMPFUN PIRATES', 256, 560);
      t.needsUpdate = true;
    };
    img.src = 'assets/skull_transparent.png';
  } catch {}
  return _jollyTex;
}
function texSoftPad() {
  return _canvasTex('cqPad', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.12, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, { wrap: false, colorSpace: false });
}
function texMote() {
  return _canvasTex('cqMote', 64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.4, 'rgba(255,220,160,0.45)'); g.addColorStop(1, 'rgba(255,210,150,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, { wrap: false });
}
function texBeamGrad() {
  return _canvasTex('cqBeam', 64, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,230,170,0.55)'); g.addColorStop(0.35, 'rgba(255,210,140,0.22)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
    const side = ctx.createLinearGradient(0, 0, 64, 0);
    side.addColorStop(0, 'rgba(0,0,0,0.65)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = side; ctx.fillRect(0, 0, 64, 256);
  }, { wrap: false });
}
function texCaustics() {
  return _canvasTex('cqCaustics', 512, 256, (ctx, w, h) => {
    const R = _rng(2026);
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 95; i++) {
      const cx = R() * w, cy = R() * h, rx = 18 + R() * 54, ry = 8 + R() * 24;
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, rx);
      g.addColorStop(0, 'rgba(120,245,255,0.20)');
      g.addColorStop(0.55, 'rgba(255,220,150,0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, (R() - 0.5) * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }, { repeatX: 2, repeatY: 1 });
}

function matBeam() {
  const m = new THREE.MeshBasicMaterial({
    map: texBeamGrad(), color: 0xffe6ba, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, opacity: 0.34,
  });
  m.userData.key = 'qs-beam';
  return m;
}

/** Quarters texture set: ship-kit PBR maps at repeat 1 (UVs authored in metres) + NFT captain portraits. */
const _qTex = { ready: false, p: null };
const PORTRAIT_IDS = [1, 33, 74, 100];
function preloadQuartersTextures() {
  if (_qTex.p) return _qTex.p;
  if (!_canDraw()) return (_qTex.p = Promise.resolve(null));
  const L = new THREE.TextureLoader();
  const one = (path, color = true, wrap = true) => new Promise((res) => {
    try {
      L.load(path, (t) => {
        t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = Q_ANISO; t.needsUpdate = true;
        t.userData = { cached: true };
        res(t);
      }, undefined, () => res(null));
    } catch { res(null); }
  });
  const K = ['deck_d', 'deck_n', 'hull_d', 'hull_n', 'sail_d', 'sail_n'];
  // [v339] phones: the 512 px _lo diffuse maps only (deck_d_lo.jpg / hull_d_lo.jpg / sail_d_lo.jpg), no normal maps (~1/4 the VRAM of 6 x 1024 px)
  const kitUrl = (k) => (QUARTERS_LOW_MEM ? (k.endsWith('_n') ? null : `assets/ships/kit/${k}_lo.jpg`) : `assets/ships/kit/${k}.jpg`);
  _qTex.p = Promise.all([
    ...K.map((k) => (kitUrl(k) ? one(kitUrl(k), k.endsWith('_d')) : Promise.resolve(null))),
    ...PORTRAIT_IDS.map((id) => one(`assets/captains/${id}.jpg`, true, false)),
  ]).then((arr) => {
    K.forEach((k, i) => { _qTex[k] = arr[i]; });
    _qTex.cap = {};
    PORTRAIT_IDS.forEach((id, i) => { _qTex.cap[id] = arr[K.length + i]; });
    _qTex.ready = true;
    return _qTex;
  });
  return _qTex.p;
}

let _quartersGlb = null, _quartersGlbP = null;
/** Starts the Captain's Quarters Draco GLB + texture download (idempotent). */
export function preloadQuartersGlb() {
  if (_quartersGlbP) return _quartersGlbP;
  if (typeof window === 'undefined' || !_canDraw()) return null;
  try { window.__pfpQuartersGlbReady = !!_quartersGlb; } catch {}
  try { window.__pfpQuartersPreloads = (window.__pfpQuartersPreloads | 0) + 1; } catch {} // [v339] test probe: how many times the GLB decode started
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('../../vendor/three-0.165.0/examples/jsm/libs/draco/gltf/', import.meta.url).href);
  if (QUARTERS_LOW_MEM) draco.setWorkerLimit(1); // [v339] one Draco WASM heap on phones (default 4)
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  _quartersGlbP = Promise.all([
    loader.loadAsync(new URL(QUARTERS_GLB, document.baseURI).href),
    preloadQuartersTextures(),
  ]).then(([gltf]) => {
    gltf.scene.traverse((o) => {
      if (o.geometry) { o.geometry.userData = o.geometry.userData || {}; o.geometry.userData.sharedGlb = true; }
    });
    gltf.scene.updateMatrixWorld(true);
    _quartersGlb = gltf;
    try { window.__pfpQuartersGlbReady = true; window.dispatchEvent(new CustomEvent('pfp-quarters-glb')); } catch {}
    try { draco.dispose(); } catch {}
    return gltf;
  }).catch((e) => { console.warn('[quarters] glb', e); _quartersGlbP = null; return null; });
  return _quartersGlbP;
}

/** [v339] Phones: give back everything the quarters uploaded (GLB geometry, kit maps, procedural canvases, cabin PMREM) after LEAVE HULL,
 *  so Harbor VRAM / RAM returns to its pre-visit baseline. The next ENTER HULL simply reloads (HTTP / service-worker cache). */
export function releaseQuartersAssets() {
  if (_quartersGlbP && !_quartersGlb) return false; // still decoding: keep it (attach is pending)
  try { _quartersGlb?.scene?.traverse((o) => { try { o.geometry?.dispose?.(); } catch {} for (const m of [].concat(o.material || [])) { try { m?.dispose?.(); } catch {} } }); } catch {}
  _quartersGlb = null; _quartersGlbP = null;
  try { window.__pfpQuartersGlbReady = false; } catch {}
  for (const k of Object.keys(_texCache)) { try { _texCache[k]?.dispose?.(); } catch {} delete _texCache[k]; }
  try { _jollyTex?.dispose?.(); } catch {} _jollyTex = null;
  for (const k of ['deck_d', 'deck_n', 'hull_d', 'hull_n', 'sail_d', 'sail_n']) { try { _qTex[k]?.dispose?.(); } catch {} _qTex[k] = null; }
  for (const t of Object.values(_qTex.cap || {})) { try { t?.dispose?.(); } catch {} }
  _qTex.cap = {}; _qTex.ready = false; _qTex.p = null;
  try { window.__pfpQuartersReleased = (window.__pfpQuartersReleased | 0) + 1; } catch {}
  return true;
}

/** Per-visit material set (disposed cleanly on leave; shared textures stay cached). */
function quartersMaterials() {
  const mah = texMahogany(), mahN = texMahoganyN();
  const M = {
    deck: matStd(0xc39062, 'qs-deck', { roughness: 0.58, envMapIntensity: 0.32, normalScale: 0.9 }),
    deckhead: matStd(0x9a6a44, 'qs-deckhead', { roughness: 0.68, envMapIntensity: 0.22 }),
    hull: matStd(0xa87650, 'qs-hull', { roughness: 0.64, envMapIntensity: 0.26, normalScale: 1.1 }),
    bulk: matStd(0x8a4c2c, 'qs-bulk', { roughness: 0.54, envMapIntensity: 0.3 }),
    mahogany: matStd(0x8c4624, 'qs-mahogany', { map: mah, normalMap: mahN, roughness: 0.36, envMapIntensity: 0.6, normalScale: 0.45 }),
    oak_dark: matStd(0x765032, 'qs-oak', { map: mah, normalMap: mahN, roughness: 0.52, envMapIntensity: 0.36, normalScale: 0.6 }),
    brass: matStd(0xd8a446, 'qs-brass', { roughness: 0.23, metalness: 0.86, envMapIntensity: 1.18 }),
    gold: matStd(0xf4c85c, 'qs-gold', { roughness: 0.19, metalness: 0.91, envMapIntensity: 1.28 }),
    iron: matStd(0x282a2e, 'qs-iron', { roughness: 0.44, metalness: 0.82, envMapIntensity: 0.72 }),
    metal: matStd(0xd8a446, 'qs-metal', { roughness: 0.23, metalness: 0.86, envMapIntensity: 1.18 }),
    velvet: matStd(0x9a1626, 'qs-velvet', { map: texVelvet(), roughness: 0.78, envMapIntensity: 0.26 }),
    hide: matStd(0xffffff, 'qs-leather', { roughness: 0.52, envMapIntensity: 0.38 }),
    ruby: matStd(0xc81228, 'qs-ruby', { roughness: 0.08, metalness: 0.2, emissive: 0x32040a, emissiveIntensity: 0.85, envMapIntensity: 1.55 }),
    emerald: matStd(0x109848, 'qs-emerald', { roughness: 0.08, metalness: 0.2, emissive: 0x042812, emissiveIntensity: 0.85, envMapIntensity: 1.55 }),
    linen: matStd(0xf3eadb, 'qs-linen', { roughness: 0.86, envMapIntensity: 0.2 }),
    parchment: matStd(0xffffff, 'qs-parchment', { map: texMap(), roughness: 0.75, envMapIntensity: 0.22 }),
    wax: matStd(0xf7ecd6, 'qs-wax', { roughness: 0.55, emissive: 0xffa850, emissiveIntensity: 0.24, envMapIntensity: 0.2 }),
    rope: matStd(0xb4945e, 'qs-rope', { roughness: 0.92, envMapIntensity: 0.1 }),
    rug: matStd(0xffffff, 'qs-rug', { map: texRug(), normalMap: texRugN(), roughness: 0.92, envMapIntensity: 0.12, normalScale: 0.6 }),
  };
  M.hide.vertexColors = true;
  M.glass = new THREE.MeshStandardMaterial({ color: 0xdaf0f6, transparent: true, opacity: 0.17, roughness: 0.04, metalness: 0.2, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide, fog: false });
  M.glass.userData.key = 'qs-glass';
  M.glass_green = new THREE.MeshStandardMaterial({ color: 0x2e8040, transparent: true, opacity: 0.84, roughness: 0.08, metalness: 0.1, envMapIntensity: 1.1, side: THREE.DoubleSide, fog: false });
  M.glass_green.userData.key = 'qs-glass2';
  M.flame = new THREE.MeshBasicMaterial({ color: 0xffc35e, fog: false }); M.flame.userData.key = 'qs-flame';
  M.ocean_view = new THREE.MeshBasicMaterial({ map: texPortholeSea(), fog: false }); M.ocean_view.userData.key = 'qs-port';
  M.wake = new THREE.MeshBasicMaterial({ map: texSternWake(), fog: false, side: THREE.FrontSide }); M.wake.userData.key = 'qs-wake';
  M.caustics = new THREE.MeshBasicMaterial({ map: texCaustics(), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  M.caustics.userData.key = 'qs-caustics';
  M.ao = new THREE.MeshBasicMaterial({ color: 0xffffff, map: texSoftPad(), vertexColors: true, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.ao.userData.key = 'qs-ao';
  M.portrait = {};
  applyQuartersTextures(M);
  return M;
}

function applyQuartersTextures(M) {
  if (!_qTex.ready || !M || M._texApplied) return;
  M._texApplied = true;
  const set = (m, map, nrm) => { if (map) m.map = map; if (nrm) m.normalMap = nrm; m.needsUpdate = true; };
  set(M.deck, _qTex.deck_d, _qTex.deck_n); set(M.deckhead, _qTex.deck_d, _qTex.deck_n);
  set(M.hull, _qTex.hull_d, _qTex.hull_n); set(M.bulk, _qTex.hull_d, _qTex.hull_n);
  set(M.linen, _qTex.sail_d, _qTex.sail_n); set(M.velvet, null, _qTex.sail_n); set(M.hide, null, _qTex.sail_n);
  M.velvet.normalScale = new THREE.Vector2(0.5, 0.5);
  M.hide.normalScale = new THREE.Vector2(0.25, 0.25);
  M.linen.normalScale = new THREE.Vector2(0.6, 0.6);
  for (const id of PORTRAIT_IDS) {
    if (M.portrait[id] && _qTex.cap?.[id]) {
      M.portrait[id].map = _qTex.cap[id];
      M.portrait[id].color.set(0xffffff);
      M.portrait[id].needsUpdate = true;
    }
  }
}

function quartersMatFor(name, M) {
  const k = String(name || '').replace(/^.*?mat_/, '').replace(/\.\d+$/, '');
  return M[k] && M[k].isMaterial ? M[k] : M.mahogany;
}
function cloneQuartersKit(name, M) {
  const src = _quartersGlb?.scene?.getObjectByName(name);
  if (!src) return null;
  const k = src.clone(true);
  k.position.set(0, 0, 0); k.rotation.set(0, 0, 0); k.scale.set(1, 1, 1);
  k.traverse((o) => {
    if (!o.isMesh) return;
    o.material = quartersMatFor(o.material?.name || o.name, M);
    o.castShadow = false; o.receiveShadow = false;
    if (o.material === M.flame) o.userData.qsFlame = true;
  });
  k.userData.quartersKit = name;
  return k;
}
function instanceQuartersKit(name, M, mats) {
  const src = _quartersGlb?.scene?.getObjectByName(name);
  if (!src) return null;
  const grp = new THREE.Group(); grp.name = name + '_inst'; grp.userData.quartersKit = name;
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert(), local = new THREE.Matrix4(), m = new THREE.Matrix4();
  src.traverse((o) => {
    if (!o.isMesh) return;
    local.multiplyMatrices(inv, o.matrixWorld);
    const im = new THREE.InstancedMesh(o.geometry, quartersMatFor(o.material?.name || o.name, M), mats.length);
    mats.forEach((mm, i) => { m.multiplyMatrices(mm, local); im.setMatrixAt(i, m); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere?.();
    im.castShadow = false; im.receiveShadow = false;
    im.name = o.name; grp.add(im);
  });
  return grp;
}

function qGrid(nu, nv, pos, uv) {
  const P = [], U = [], I = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const u = i / nu, v = j / nv; P.push(...pos(u, v)); U.push(...uv(u, v)); }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = (i + 1) * (nv + 1) + j; I.push(a, b, b + 1, a, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.setIndex(I); geo.computeVertexNormals();
  return geo;
}
function qWallMatrix(side, z, y, out = 0) {
  const slope = 2 * QTH * y / (QH * QH);
  const x = side * (QW / 2 - quartersWallInset(y) - out);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, QFLOOR + y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.atan(slope), side < 0 ? Math.PI / 2 : -Math.PI / 2, 0, 'YXZ')),
    new THREE.Vector3(1, 1, 1)
  );
}
function qBulkheadShape(hole) {
  const s = new THREE.Shape(), hw = QW / 2 + 0.02;
  s.moveTo(-hw, -0.02); s.lineTo(hw, -0.02);
  for (let i = 0; i <= 8; i++) { const y = QH * i / 8; s.lineTo(hw - quartersWallInset(y), y); }
  for (let i = 0; i <= 24; i++) { const x = (QW / 2 - QTH) * (1 - 2 * i / 24); s.lineTo(x, quartersCeil(x) + 0.03); }
  for (let i = 8; i >= 0; i--) { const y = QH * i / 8; s.lineTo(-(hw - quartersWallInset(y)), y); }
  if (hole) {
    const p = new THREE.Path();
    p.moveTo(-4.1, 0.85); p.lineTo(4.1, 0.85); p.lineTo(4.1, 3.335); p.lineTo(-4.1, 3.335); p.closePath();
    s.holes.push(p);
  }
  const geo = new THREE.ShapeGeometry(s, 4);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
  return geo;
}

/**
 * Walk-in Ship Hull Captain's Quarters (cottage_id 'ship_quarters').
 * Seamless curved tumblehome hull + cambered deck-head shell + stern wake panorama,
 * populated by all 14 sculpted Draco GLB kits (stern gallery, hull ribs + overhead beams,
 * mahogany wainscoting, portholes, two-tier 12-candle ship's-wheel chandelier, swaying gimbal
 * lanterns, Admiral's chart table + 3-masted galleon model, boxed berth, brimming treasure chest,
 * Navigator's bureau + armillary sphere + tripod spyglass telescope, 86-book armory bookcase,
 * coopered rum cargo, Officer's trophy credenza + heraldic shield, and companionway bulkhead door).
 */
export function buildCaptainsQuartersRoom({ tier = 'captain', cottageId = SHIP_QUARTERS_ID, low = false } = {}) {
  preloadQuartersGlb();
  const g = new THREE.Group(); g.name = 'captains_quarters';
  const W = QW, D = QD, H = QH, PEAK = QPEAK, F = QFLOOR;
  const M = quartersMaterials();
  const add = (geo, mat, name) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = false;
    if (name) m.name = name;
    g.add(m); return m;
  };

  // --- Seamless hull shell: teak deck, cambered deck-head, tumblehome hull planking, aft + forward bulkheads ---
  add(qGrid(1, 1, (u, v) => [-W / 2 - 0.02 + u * (W + 0.04), F, -D / 2 - 0.02 + v * (D + 0.04)],
    (u, v) => [(-D / 2 + v * D) / 2.4, (-W / 2 + u * W) / 1.2]), M.deck, 'qs_deck');
  add(new THREE.BoxGeometry(W, 0.12, D), M.bulk, 'qs_deck_sub').position.y = F - 0.065;
  add(qGrid(24, 1, (u, v) => { const x = -(W / 2 - QTH) - 0.03 + u * (W - 2 * QTH + 0.06); return [x, F + quartersCeil(x), -D / 2 - 0.02 + v * (D + 0.04)]; },
    (u, v) => [(-D / 2 + v * D) / 2.4, (-(W / 2 - QTH) + u * (W - 2 * QTH)) / 1.2]), M.deckhead, 'qs_deckhead');
  add(qGrid(18, 1, (u, v) => { const x = -4.6 + u * 9.2; return [x, F + quartersCeil(x) - 0.015, -D / 2 + 0.25 + v * 3.8]; },
    (u, v) => [u * 2, v]), M.caustics, 'qs_caustics').renderOrder = 2;
  for (const s of [-1, 1]) {
    add(qGrid(14, 1, (u, v) => { const y = -0.03 + u * (H + 0.06); return [s * (W / 2 - quartersWallInset(y)), F + y, -D / 2 - 0.02 + v * (D + 0.04)]; },
      (u, v) => [(-D / 2 + v * D) / 2.0, u * (H + 0.06) / 2.0]), M.hull, s < 0 ? 'qs_hull_port' : 'qs_hull_stbd');
  }
  const aft = add(qBulkheadShape(true), M.bulk, 'qs_bulk_aft'); aft.position.set(0, F, -D / 2);
  const fwd = add(qBulkheadShape(false), M.bulk, 'qs_bulk_fwd'); fwd.position.set(0, F, D / 2); fwd.rotation.y = Math.PI;

  const wake = add(new THREE.PlaneGeometry(26, 11), M.wake, 'qs_wake');
  wake.position.set(0, F + 2.3, -D / 2 - 2.2);

  add(new THREE.BoxGeometry(5.0, 0.028, 3.6), M.rug, 'qs_rug').position.set(0, F + 0.015, -0.65);
  add(new THREE.BoxGeometry(1.75, 0.024, 2.7), M.rug, 'qs_runner').position.set(0, F + 0.013, 3.15);

  const frameGeos = [], tmpM = new THREE.Matrix4();
  const frameAt = (mat4, w, h, id) => {
    const rails = [[w + 0.16, 0.09, 0, h / 2 + 0.035], [w + 0.16, 0.09, 0, -h / 2 - 0.035], [0.09, h, -w / 2 - 0.035, 0], [0.09, h, w / 2 + 0.035, 0]];
    for (const [rw, rh, x, y] of rails) {
      const b = new THREE.BoxGeometry(rw, rh, 0.07);
      b.applyMatrix4(tmpM.makeTranslation(x, y, 0.035)); b.applyMatrix4(mat4); frameGeos.push(b);
    }
    const lip = new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.02);
    lip.applyMatrix4(tmpM.makeTranslation(0, 0, 0.012)); lip.applyMatrix4(mat4); frameGeos.push(lip);
    if (id == null) return;
    M.portrait[id] = matStd(0x6a5040, 'qs-portrait', { map: _qTex.cap?.[id] || null, roughness: 0.48, envMapIntensity: 0.36 });
    if (_qTex.cap?.[id]) M.portrait[id].color.set(0xffffff);
    const pg = new THREE.PlaneGeometry(w, h);
    pg.applyMatrix4(tmpM.makeTranslation(0, 0, 0.026)); pg.applyMatrix4(mat4);
    add(pg, M.portrait[id], 'qs_portrait_' + id);
  };
  frameAt(qWallMatrix(-1, 1.1, 2.15, 0.01), 0.78, 0.78, 33);
  frameAt(qWallMatrix(1, 1.1, 2.15, 0.01), 0.78, 0.78, 1);
  frameAt(qWallMatrix(1, -2.2, 2.15, 0.01), 0.72, 0.72, 100);
  frameAt(new THREE.Matrix4().compose(
    new THREE.Vector3(4.55, F + 2.15, D / 2 - 0.02),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
    new THREE.Vector3(1, 1, 1)
  ), 0.74, 0.74, 74);

  const banM = new THREE.Matrix4().compose(
    new THREE.Vector3(0, F + 3.36, D / 2 - 0.04),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
    new THREE.Vector3(1, 1, 1)
  );
  const ban = new THREE.PlaneGeometry(0.86, 1.04, 8, 1);
  {
    const p = ban.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.04 + 0.025 * Math.sin(p.getX(i) * 7.3));
    ban.computeVertexNormals();
  }
  ban.applyMatrix4(banM);
  M.banner = matStd(0xffffff, 'qs-banner', { map: texJollyRoger(), roughness: 0.88, envMapIntensity: 0.15 });
  add(ban, M.banner, 'qs_banner');
  {
    const rod = new THREE.CylinderGeometry(0.018, 0.018, 1.06, 10);
    rod.rotateZ(Math.PI / 2); rod.translate(0, 0.54, 0.05); rod.applyMatrix4(banM); frameGeos.push(rod);
    for (const s of [-1, 1]) {
      const f = new THREE.SphereGeometry(0.035, 10, 8);
      f.translate(s * 0.55, 0.54, 0.05); f.applyMatrix4(banM); frameGeos.push(f);
    }
  }
  add(mergeGeometries(frameGeos.map((q) => (q.index ? q.toNonIndexed() : q)), false), M.gold, 'qs_frames');
  for (const q of frameGeos) q.dispose();

  const pads = [
    [0, -0.65, 5.3, 3.9, 0.22], [0, 3.15, 2.0, 2.9, 0.18],
    [2.75, -1.7, 1.85, 2.95, 0.52], [2.75, -3.3, 0.9, 0.9, 0.38], [1.77, -1.55, 0.75, 0.75, 0.36], [3.73, -1.95, 0.75, 0.75, 0.36],
    [4.5, 2.65, 1.9, 3.1, 0.55], [5.0, 0.95, 0.85, 0.85, 0.42],
    [-4.45, -0.55, 1.65, 2.15, 0.56], [-4.85, -2.95, 1.25, 1.75, 0.52], [-4.36, -4.13, 0.95, 0.95, 0.38],
    [-4.55, 5.15, 2.2, 0.9, 0.5], [-5.0, 3.25, 1.5, 2.3, 0.5], [2.85, 5.15, 1.9, 0.85, 0.5],
    [0, -5.0, 9.2, 1.2, 0.5], [0, 5.15, 2.0, 0.9, 0.35],
    [-W / 2 + 0.25, 0, 0.7, D, 0.35], [W / 2 - 0.25, 0, 0.7, D, 0.35],
  ];
  {
    const P = [], C = [], U = [], I = [];
    pads.forEach(([x, z, w, d, a], i) => {
      const y = F + 0.003 + i * 0.0002;
      P.push(x - w / 2, y, z - d / 2, x + w / 2, y, z - d / 2, x + w / 2, y, z + d / 2, x - w / 2, y, z + d / 2);
      U.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let k = 0; k < 4; k++) C.push(0, 0, 0, a);
      const o = i * 4; I.push(o, o + 2, o + 1, o, o + 3, o + 2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 4));
    geo.setIndex(I);
    add(geo, M.ao, 'qs_aopads').renderOrder = 1;
  }

  const beams = matBeam(); beams.opacity = low ? 0.24 : 0.32; M.beam = beams;
  const bw = (8.2 - 6 * 0.16) / 5, shafts = [];
  {
    const P = [], U = [], I = [], X = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < 5; i++) {
      const bx = -4.1 + 0.16 + bw / 2 + i * (bw + 0.16);
      const A = new THREE.Vector3(bx, F + 2.35, -D / 2 - 0.1), B = new THREE.Vector3(bx * 0.72 + 0.35, F + 0.02, -1.25);
      shafts.push([A, B]);
      const dir = B.clone().sub(A).normalize(), n2 = new THREE.Vector3().crossVectors(dir, X).normalize();
      for (const sv of [X, n2]) {
        const o = P.length / 3, a = sv.clone().multiplyScalar(0.62), b = sv.clone().multiplyScalar(0.85);
        for (const v of [A.clone().sub(a), A.clone().add(a), B.clone().add(b), B.clone().sub(b)]) P.push(v.x, v.y, v.z);
        U.push(0, 1, 1, 1, 1, 0, 0, 0); I.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    geo.setIndex(I);
    add(geo, beams, 'qs_sunbeams').renderOrder = 3;
  }
  {
    const R = _rng(42), n = low ? 90 : 220, P = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const [A, B] = shafts[i % 5], t = R();
      P[i * 3] = A.x + (B.x - A.x) * t + (R() - 0.5) * 1.1;
      P[i * 3 + 1] = A.y + (B.y - A.y) * t + 0.1 + R() * 0.5;
      P[i * 3 + 2] = A.z + (B.z - A.z) * t + (R() - 0.5) * 0.9;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    M.mote = new THREE.PointsMaterial({ size: 0.035, map: texMote(), color: 0xffe2a8, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const pts = new THREE.Points(geo, M.mote); pts.name = 'qs_motes'; pts.userData.base = P.slice(); g.add(pts);
  }

  const chest = new THREE.Group(); chest.name = 'cq_chest';
  chest.position.set(-W / 2 + 1.25, F, -0.55); chest.rotation.y = Math.PI / 2;
  { const stand = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.9), M.oak_dark); stand.position.y = 0.45; stand.name = 'qs_chest_stand'; chest.add(stand); }
  g.add(chest);
  const door = new THREE.Group(); door.name = 'cq_hatch';
  door.position.set(0, F, D / 2 - 0.12); door.rotation.y = Math.PI;
  { const stand = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.12), M.mahogany); stand.position.y = 1.05; stand.name = 'qs_door_stand'; door.add(stand); }
  g.add(door);
  // [bed-desk t408u] clothes sea chest under the aft starboard porthole: E · CHANGE CLOTHES (the WARDROBE changing room)
  {
    const wp = hullRestSpots().wardrobe.prop, wr = new THREE.Group(); wr.name = 'qs_wardrobe';
    wr.position.set(wp.x, F, wp.z); wr.rotation.y = wp.ry;
    const part = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.rotation.z = rz; m.castShadow = m.receiveShadow = false; wr.add(m); return m; };
    part(new THREE.BoxGeometry(1.1, 0.5, 0.58), M.mahogany, 0, 0.29, 0);                       // body
    part(new THREE.BoxGeometry(1.14, 0.06, 0.62), M.oak_dark, 0, 0.04, 0);                     // plinth
    part(new THREE.CylinderGeometry(0.29, 0.29, 1.12, 16, 1, false, 0, Math.PI), M.mahogany, 0, 0.54, -0.06, 0, Math.PI / 2).rotation.set(-0.95, 0, Math.PI / 2); // lid, propped open
    for (const sx of [-0.42, 0, 0.42]) part(new THREE.BoxGeometry(0.06, 0.52, 0.6), sx ? M.iron : M.brass, sx, 0.29, 0);   // straps
    part(new THREE.BoxGeometry(0.16, 0.16, 0.04), M.gold, 0, 0.42, 0.3);                       // lock plate
    part(new THREE.BoxGeometry(0.98, 0.1, 0.46), M.velvet, 0, 0.56, 0.0);                      // folded coat on top
    part(new THREE.BoxGeometry(0.42, 0.05, 0.36), M.linen, -0.22, 0.63, 0.02);                // folded shirt
    part(new THREE.BoxGeometry(0.34, 0.24, 0.06), M.linen, 0.3, 0.46, 0.31, 0.18);           // a sleeve spilling over the front
    part(new THREE.CylinderGeometry(0.17, 0.2, 0.08, 14), M.hide, 0.28, 0.66, -0.04);        // tricorn crown on the pile
    g.add(wr);
  }

  // No per-visit lights. Six extra PointLights changed the shader light count on
  // every entry; retain the renderer's existing hemisphere / sun and emissive lamps.

  const colliders = [
    { x: 0, z: -D / 2 + 0.45, w: 8.6, d: 0.85 },
    { x: 2.75, z: -1.7, w: 1.35, d: 2.35 },
    { x: 2.75, z: -3.28, w: 0.75, d: 0.65 },
    { x: 1.77, z: -1.55, w: 0.55, d: 0.55 },
    { x: 3.73, z: -1.95, w: 0.55, d: 0.55 },
    { x: W / 2 - 1.25, z: 2.65, w: 1.55, d: 2.85 },
    { x: W / 2 - 0.8, z: 0.95, w: 0.6, d: 0.65 },
    { x: -W / 2 + 1.25, z: -0.55, w: 1.1, d: 1.7 },
    { x: -4.85, z: -2.95, w: 1.02, d: 1.52 },
    { x: -4.36, z: -4.13, w: 0.68, d: 0.68 },
    { x: -W / 2 + 0.75, z: 3.25, w: 1.3, d: 1.9 },
    { x: -4.55, z: D / 2 - 0.3, w: 1.85, d: 0.6 },
    { x: 2.85, z: D / 2 - 0.3, w: 1.72, d: 0.56 },
    { x: 5.0, z: -3.65, w: 0.62, d: 1.15 }, // [bed-desk t408u] clothes sea chest
  ];
  const spots = {
    chest: { x: -W / 2 + 2.25, z: -0.55, r: 2.5, kind: 'ship_chest', label: 'OPEN STORAGE' },
    exit: { x: 0, z: D / 2 - 1.35, r: 2.5, kind: 'ship_exit', label: 'LEAVE HULL' },
  };
  g.userData = {
    W, D, H, PEAK, tier, colliders, spots, chest, door, cottageId, kind: 'ship_quarters', rest: hullRestSpots(), // [bed-desk]
    wallInset: quartersWallInset, qMats: M, sway: [],
    lights: null, low, _quartersKitAttached: false, disposed: false,
  };
  if (_quartersGlb) attachQuartersKits(g);
  else preloadQuartersGlb()?.then(() => attachQuartersKits(g));
  return g;
}

/** Attach all 14 sculpted Draco GLB kits into a Captain's Quarters room (idempotent). */
function attachQuartersKits(g) {
  const ud = g?.userData;
  if (!ud || !_quartersGlb || ud._quartersKitAttached || ud.disposed) return false;
  const M = ud.qMats, F = QFLOOR, W = QW, D = QD;
  applyQuartersTextures(M);
  const put = (name, x, y, z, ry = 0, parent = g) => {
    const k = cloneQuartersKit(name, M);
    if (!k) return null;
    k.position.set(x, y, z); k.rotation.y = ry; parent.add(k); return k;
  };
  const pose = (x, y, z, ry, tilt = 0) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, ry, 0, 'YXZ')),
    new THREE.Vector3(1, 1, 1)
  );

  put('stern_gallery_kit', 0, F, -D / 2, 0);

  const ribs = [];
  for (const z of [-4.4, -2.2, 0, 2.2, 4.4]) {
    ribs.push(pose(-W / 2, F, z, Math.PI / 2), pose(W / 2, F, z, -Math.PI / 2));
  }
  const r = instanceQuartersKit('hull_rib_kit', M, ribs); if (r) g.add(r);

  const wains = [];
  for (const z of [-3.3, -1.1, 1.1, 3.3]) {
    wains.push(pose(-W / 2, F, z, Math.PI / 2), pose(W / 2, F, z, -Math.PI / 2));
  }
  const wb = instanceQuartersKit('wainscot_bay_kit', M, wains); if (wb) g.add(wb);

  const ph = [
    qWallMatrix(-1, -1.1, 1.95, 0), qWallMatrix(-1, 3.3, 1.95, 0),
    qWallMatrix(1, -3.3, 1.95, 0), qWallMatrix(1, -1.1, 1.95, 0),
  ];
  const p = instanceQuartersKit('porthole_kit', M, ph); if (p) g.add(p);

  const ch = put('wheel_chandelier_kit', 0, F + quartersCeil(0), -0.95, 0);
  if (ch) ud.sway.push({ o: ch, ph: 0, amp: 1 });

  const lantX = W / 2 - quartersWallInset(2.45) - 0.28;
  [
    [-lantX, 0, Math.PI / 2],
    [lantX, 0, -Math.PI / 2],
    [-lantX, -1.85, Math.PI / 2],
  ].forEach(([x, z, ry], i) => {
    const k = put('gimbal_lantern_kit', x, F + 2.45, z, ry);
    const piv = k?.getObjectByName('gimbal_lantern');
    if (piv) ud.sway.push({ o: piv, ph: 1.4 + i * 1.9, amp: 1 });
  });
  {
    const k = put('gimbal_lantern_kit', 4.05, F + 2.45, D / 2 - 0.02, Math.PI);
    const piv = k?.getObjectByName('gimbal_lantern');
    if (piv) ud.sway.push({ o: piv, ph: 5.1, amp: 1 });
  }

  put('chart_table_kit', 2.75, F, -1.7, 0);
  put('berth_kit', W / 2 - 0.52, F, 2.65, -Math.PI / 2);
  put('navigator_bureau_kit', -5.28, F, -2.95, Math.PI / 2);
  put('armory_bookcase_kit', -3.75, F, D / 2 - 0.04, Math.PI);
  put('rum_cargo_kit', -W / 2 + 0.12, F, 3.25, Math.PI / 2);
  put('trophy_credenza_kit', 2.85, F, D / 2 - 0.04, Math.PI);

  if (ud.chest) {
    const s = ud.chest.getObjectByName('qs_chest_stand');
    if (s) { ud.chest.remove(s); s.geometry.dispose(); }
    put('quarters_chest_kit', 0, 0, 0, 0, ud.chest);
  }
  if (ud.door) {
    const s = ud.door.getObjectByName('qs_door_stand');
    if (s) { ud.door.remove(s); s.geometry.dispose(); }
    put('companionway_door_kit', 0, 0, 0, 0, ud.door);
  }

  g.updateMatrixWorld(true);
  ud._quartersKitAttached = true;
  try { if (typeof window !== 'undefined') window.__pfpQuartersKitAttached = true; } catch {}
  return true;
}

/** Per-frame cabin motion: gentle sea-roll sway on chandelier & gimbal lanterns, candle flicker, sea caustics, dust motes. */
function tickQuarters(room, t) {
  const ud = room?.userData;
  if (!ud || ud.disposed) return;
  const M = ud.qMats, L = ud.lights, low = ud.low;
  if (!_qTex.ready || !M?._texApplied) applyQuartersTextures(M);
  const sw = Math.sin(t * 1.35) * 0.036;
  for (const s of ud.sway) {
    const a = Math.sin(t * 1.35 + s.ph) * 0.036 * s.amp;
    s.o.rotation.x = s.ph ? a : sw;
    s.o.rotation.z = Math.sin(t * 1.35 * 0.83 + 1.1 + s.ph) * 0.025 * s.amp;
  }
  const fl = 0.92 + 0.05 * Math.sin(t * 9.1) + 0.03 * Math.sin(t * 13.7);
  if (M?.flame) M.flame.color.setRGB(1.0, 0.72 + 0.08 * fl, 0.33 + 0.06 * fl);
  if (L) {
    L.candLight.intensity = (low ? 1.8 : 3.2) * (0.9 + 0.1 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 12.9));
    L.chestLight.intensity = (low ? 1.8 : 3.1) * (0.93 + 0.07 * Math.sin(t * 6.1 + 1.3));
    L.chandLight.intensity = (low ? 2.5 : 4.0) * (0.95 + 0.05 * Math.sin(t * 5.3 + 0.4));
    L.chandLight.position.x = Math.sin(t * 1.35) * 0.05;
    L.wakeLight.intensity = (low ? 1.1 : 1.9) * (0.85 + 0.15 * Math.sin(t * 0.9) * Math.sin(t * 2.3 + 0.5));
  }
  if (M?.wake?.map) {
    M.wake.map.offset.x = Math.sin(t * 0.21) * 0.0035;
    M.wake.map.offset.y = Math.sin(t * 0.37) * 0.0025;
  }
  if (M?.caustics?.map) {
    M.caustics.map.offset.x = (t * 0.035) % 1;
    M.caustics.map.offset.y = Math.sin(t * 0.42) * 0.06;
    M.caustics.opacity = (low ? 0.16 : 0.23) * (0.85 + 0.15 * Math.sin(t * 1.6));
  }
  if (M?.beam) M.beam.opacity = (low ? 0.24 : 0.32) * (0.86 + 0.14 * Math.sin(t * 0.8) * Math.sin(t * 1.9 + 0.7));
  const motes = room.getObjectByName('qs_motes');
  if (motes) {
    const a = motes.geometry.attributes.position.array, b = motes.userData.base;
    for (let i = 0; i < a.length; i += 3) {
      a[i] = b[i] + Math.sin(t * 0.31 + i) * 0.12;
      a[i + 1] = b[i + 1] + Math.sin(t * 0.23 + i * 0.7) * 0.1;
      a[i + 2] = b[i + 2] + Math.cos(t * 0.27 + i * 1.3) * 0.12;
    }
    motes.geometry.attributes.position.needsUpdate = true;
  }
}

function disposeInterior(room) {
  if (!room) return;
  const ud = room.userData || {};
  ud.disposed = true;
  const mats = new Set();
  room.traverse((o) => {
    if (o.isInstancedMesh) { try { o.dispose(); } catch {} }
    if (o.geometry && !o.geometry.userData?.sharedGlb) {
      try { o.geometry.dispose(); } catch {}
    }
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m && mats.add(m));
      else mats.add(o.material);
    }
  });
  // Some authored materials are replaced by the async kits before ever being drawn.
  for (const m of Object.values(ud.qMats || {})) if (m?.isMaterial) mats.add(m);
  for (const m of Object.values(ud.qMats?.portrait || {})) if (m?.isMaterial) mats.add(m);
  for (const m of mats) {
    try { m.dispose(); } catch {}
  }
}

/**
 * Controller: enter / leave Captain's Quarters, prompts, GLB kit attachment, HUD leave button.
 * Storage is delegated to houses.openFor(SHIP_QUARTERS_ID).
 */
export function createShipHull({
  scene, world, walker, pirate, crewF, petF, fnet, camera = null, renderer = null, game = null,
  toast = () => {}, sfx = null, fadeTo = (fn) => fn(),
  houses = null, low = false, ocean = null, islands = null, openWardrobe = null,
}) {
  // [v339] desktop warms the quarters at Harbor boot; phones / low-memory devices load them lazily on ENTER HULL (buildCaptainsQuartersRoom)
  if (!QUARTERS_LOW_MEM) preloadQuartersGlb();

  const leaveBtn = document.createElement('button');
  // [v350 t1838u] keep leaveBtn for API / cq-leave-request listeners, but never show it (door prompt lives on #dk-acts)
  leaveBtn.id = 'cq-leave'; leaveBtn.type = 'button'; leaveBtn.textContent = 'LEAVE HULL'; leaveBtn.setAttribute('hidden', ''); leaveBtn.setAttribute('aria-hidden', 'true');
  leaveBtn.style.cssText = 'display:none !important;position:fixed;left:50%;bottom:calc(var(--safe-b,0px) + 92px);transform:translateX(-50%);z-index:9;font:22px "Just Another Hand",cursive;letter-spacing:.04em;padding:8px 18px 6px;border-radius:12px;border:3px solid #ffcd77;background:rgba(22,22,22,.9);color:#ffcd77;cursor:pointer;pointer-events:auto';
  document.body.appendChild(leaveBtn);

  let inHull = false, interior = null, roomOrigin = null, returnCtx = null, busy = false;
  const rest = createRest({ walker, pirate, getOrigin: () => (inHull && interior && roomOrigin ? roomOrigin : null) }); // [bed-desk]
  const hiddenPeers = new Set();
  let _ground, _water, _stand, _blocked;
  if (world) {
    _ground = world.ground?.bind(world);
    _water = world.water?.bind(world);
    _stand = world.stand?.bind(world);
    _blocked = world.blocked?.bind(world);
  }
  const inPocket = (x, z) => !!(inHull && interior && roomOrigin
    && Math.abs(x - roomOrigin.x) < 60 && Math.abs(z - roomOrigin.z) < 60);
  const hitFurn = (lx, lz, pad = 0.30) => {
    for (const c of (interior?.userData?.colliders || [])) {
      if (Math.abs(lx - c.x) <= c.w / 2 + pad && Math.abs(lz - c.z) <= c.d / 2 + pad) return c;
    }
    return null;
  };
  function installPocket() {
    if (!world) return;
    if (typeof world.ground === 'function') world.ground = (x, z) => (inPocket(x, z) ? roomOrigin.y + QFLOOR : _ground(x, z));
    if (typeof world.water === 'function') world.water = (x, z) => (inPocket(x, z) ? null : _water(x, z));
    if (typeof world.stand === 'function') world.stand = (x, z) => (inPocket(x, z) ? roomOrigin.y + QFLOOR : _stand(x, z));
    if (typeof world.blocked === 'function') {
      world.blocked = (x, z, px, pz) => {
        if (!inPocket(x, z)) return _blocked(x, z, px, pz);
        const lx = x - roomOrigin.x, lz = z - roomOrigin.z;
        const inset = interior.userData.wallInset ? interior.userData.wallInset(1.25) : 0;
        const halfW = interior.userData.W / 2 - 0.44 - inset, halfD = interior.userData.D / 2 - 0.44;
        if (Math.abs(lx) > halfW || Math.abs(lz) > halfD) {
          if (px !== undefined && pz !== undefined) {
            const plx = px - roomOrigin.x, plz = pz - roomOrigin.z;
            if (Math.abs(lx) <= Math.abs(plx) && Math.abs(lz) <= Math.abs(plz)) return false;
          }
          return true;
        }
        const hit = hitFurn(lx, lz);
        if (hit && px !== undefined && pz !== undefined) {
          const plx = px - roomOrigin.x, plz = pz - roomOrigin.z;
          if (hitFurn(plx, plz) === hit) {
            const dNew = Math.max(Math.abs(lx - hit.x) - hit.w / 2, Math.abs(lz - hit.z) - hit.d / 2);
            const dOld = Math.max(Math.abs(plx - hit.x) - hit.w / 2, Math.abs(plz - hit.z) - hit.d / 2);
            if (dNew > dOld) return false;
          }
        }
        return !!hit;
      };
    }
  }

  function applyCam() {
    if (!camera || !interior || !roomOrigin || !walker?.w) return;
    const w = walker.w;
    const f = rest.focus() || { x: w.x, y: w.y, z: w.z, up: 1.68, look: 1.32, dMin: 3.8, dMax: 4.7 }; // [bed-desk] lying / seated: frame the body
    const yaw = Number.isFinite(w.camYaw) ? w.camYaw : w.yaw;
    const pitch = Math.max(-0.45, Math.min(0.65, w.pitch ?? 0.16));
    const dist = Math.min(f.dMax, Math.max(f.dMin, w.dist || 4.25));
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    let cx = f.x - Math.sin(yaw) * dist * cp;
    let cy = f.y + f.up + sp * dist;
    let cz = f.z - Math.cos(yaw) * dist * cp;
    const camIn = interior.userData.wallInset ? interior.userData.wallInset(Math.max(0, cy - roomOrigin.y - QFLOOR)) : 0;
    const camHalfW = interior.userData.W / 2 - 0.28 - camIn, camHalfD = interior.userData.D / 2 - 0.28;
    const yLo = roomOrigin.y + 0.85, yHi = roomOrigin.y + (interior.userData.PEAK || interior.userData.H || 4.2) - 0.28;
    cx = roomOrigin.x + Math.max(-camHalfW, Math.min(camHalfW, cx - roomOrigin.x));
    cz = roomOrigin.z + Math.max(-camHalfD, Math.min(camHalfD, cz - roomOrigin.z));
    cy = Math.max(yLo, Math.min(yHi, cy));
    camera.position.set(cx, cy, cz);
    camera.lookAt(f.x, f.y + f.look, f.z);
    camera.updateMatrixWorld?.(true);
  }

  function placeRoom() {
    if (interior) { scene.remove(interior); disposeInterior(interior); interior = null; }
    interior = buildCaptainsQuartersRoom({ low });
    const ox = 3200, oz = 3200, oy = 140;
    roomOrigin = { x: ox, y: oy, z: oz };
    interior.position.set(ox, oy, oz);
    scene.add(interior);
    installPocket();
    return { ox, oy, oz };
  }

  function restoreOutdoorScene() {
    for (const id of hiddenPeers) {
      try { const p = fnet?.peers?.get?.(id); if (p?.pirate?.object) p.pirate.object.visible = true; } catch {}
    }
    hiddenPeers.clear();
    try { if (world?.root) world.root.visible = world.root.userData._cqVis !== false; } catch {}
    try { if (ocean?.mesh) ocean.mesh.visible = ocean.mesh.userData._cqVis !== false; } catch {}
    try { if (islands?.group) islands.group.visible = islands.group.userData._cqVis !== false; } catch {}
    try {
      for (const [l, color, intensity, ground] of (scene.userData._cqOutLights || [])) {
        l.color.copy(color); l.intensity = intensity;
        if (ground) l.groundColor.copy(ground);
      }
      scene.userData._cqOutLights = null;
      if ('_cqEnv' in scene.userData) { scene.environment = scene.userData._cqEnv; delete scene.userData._cqEnv; }
      if ('_cqEnvInt' in scene.userData && 'environmentIntensity' in scene) { scene.environmentIntensity = scene.userData._cqEnvInt; delete scene.userData._cqEnvInt; }
      if (scene.fog && '_cqFog' in scene.userData) { scene.fog.density = scene.userData._cqFog; delete scene.userData._cqFog; }
      if ('_cqBg' in scene.userData) { scene.background = scene.userData._cqBg; delete scene.userData._cqBg; }
    } catch {}
  }

  function enter(ctx = {}) {
    if (inHull || busy) return false;
    busy = true;
    returnCtx = {
      from: ctx.from || 'dock',
      ax: ctx.ax, az: ctx.az, ayaw: ctx.ayaw,
      berthId: ctx.berthId || null,
    };
    const run = () => {
      try {
        const { ox, oy, oz } = placeRoom();
        inHull = true;
        document.documentElement.classList.add('pfp-inhull', 'pfp-onfoot', 'pfp-inhouse');
        leaveBtn.style.display = 'none'; // [v350 t1838u] door prompt via #dk-acts only — never the always-on #cq-leave
        try { houses?.ensureShipQuarters?.(); } catch {}
        const w = walker.w;
        const lz = interior.userData.D / 2 - 1.55;
        if (typeof walker.enter === 'function' && w && w.active === false) {
          try { walker.enter(ox, oz + lz, Math.PI); } catch {}
        }
        w.x = ox; w.z = oz + lz; w.y = oy + QFLOOR;
        w.yaw = Math.PI; w.camYaw = Math.PI; w.pitch = 0.14; w.dist = 4.25;
        w.vy = 0; w.speed = 0; w.air = false; w.swim = false; w.wade = 0;
        if (w.body) Object.assign(w.body, { y: oy + QFLOOR, last: oy + QFLOOR, vy: 0, air: false, swim: false, wade: 0 });
        w._cqCamPrev = w.camHook;
        w.camHook = () => { applyCam(); };
        try {
          pirate.object.visible = true;
          pirate.object.position.set(w.x, w.y, w.z);
          pirate.object.rotation.order = 'YXZ';
          pirate.object.rotation.set(0, w.yaw, 0);
        } catch {}
        try { crewF?.exit?.(); } catch {}
        try { petF?.exit?.(); } catch {}
        try {
          for (const [id, p] of (fnet?.peers || [])) {
            if (p.pirate?.object) { p.pirate.object.visible = false; hiddenPeers.add(id); }
          }
        } catch {}
        try { if (world?.root) { world.root.userData._cqVis = world.root.visible; world.root.visible = false; } } catch {}
        try { if (ocean?.mesh) { ocean.mesh.userData._cqVis = ocean.mesh.visible; ocean.mesh.visible = false; } } catch {}
        try { if (islands?.group) { islands.group.userData._cqVis = islands.group.visible; islands.group.visible = false; } } catch {}
        try {
          if (scene.fog) { scene.userData._cqFog = scene.fog.density; scene.fog.density = 0; }
          scene.userData._cqBg = scene.background;
          scene.background = new THREE.Color(0x0c0704);
          const outLights = [];
          for (const ch of scene.children) {
            if (ch.isHemisphereLight || ch.isDirectionalLight) {
              outLights.push([ch, ch.color.clone(), ch.intensity, ch.groundColor?.clone()]);
              ch.color.set(ch.isHemisphereLight ? 0xffe6ba : 0xffd28a);
              ch.intensity = ch.isHemisphereLight ? 2.0 : 0.82;
              if (ch.groundColor) ch.groundColor.set(0x604020);
            }
          }
          // Keep visibility / light counts stable: no full-world shader variant burst.
          scene.userData._cqOutLights = outLights;
        } catch {}
        applyCam();
        sfx?.coin?.();
        toast("⚓ CAPTAIN'S QUARTERS", 1800);
      } finally { busy = false; }
    };
    if (ctx.skipFade) run();
    else fadeTo(() => { run(); });
    return true;
  }

  function leave(onBack = null) {
    if (!inHull || busy) return false;
    rest.end('leave'); // [bed-desk] stand up before the room goes away
    busy = true;
    const ctx = returnCtx;
    fadeTo(() => {
      try {
        try { houses?.closeStorage?.(); } catch {}
        if (interior) { scene.remove(interior); disposeInterior(interior); interior = null; }
        if (QUARTERS_LOW_MEM) releaseQuartersAssets(); // [v339] phones: back to the Harbor VRAM baseline
        roomOrigin = null; inHull = false; returnCtx = null;
        leaveBtn.style.display = 'none';
        document.documentElement.classList.remove('pfp-inhull', 'pfp-inhouse');
        const w = walker?.w;
        if (w) { w.camHook = w._cqCamPrev || null; w._cqCamPrev = null; }
        restoreOutdoorScene();
        onBack?.(ctx);
        toast(ctx?.from === 'sea' ? '⚓ BACK ABOARD · ANCHORED' : '⚓ BACK ABOARD · HARBOR', 1600);
      } finally { busy = false; }
    });
    return true;
  }

  leaveBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (inHull) leaveBtn.dispatchEvent(new CustomEvent('cq-leave-request', { bubbles: true }));
  });

  function prompts() {
    // [v350 t1838u] LEAVE HULL only at the cabin exit door — never at the chest and never mid-room
    if (!inHull || !interior || !roomOrigin || !walker?.w) return null;
    if (rest.posed) return { a: rest.prompt(), b: null }; // [bed-desk] lying / seated: E = GET UP (nothing else)
    const w = walker.w;
    const lx = w.x - roomOrigin.x, lz = w.z - roomOrigin.z;
    const spots = interior.userData.spots || {};
    let best = null, bd = 1e9;
    for (const [tag, sp] of Object.entries(spots)) {
      const d = Math.hypot(lx - sp.x, lz - sp.z);
      if (d < (sp.r || 2.3) && d < bd) { bd = d; best = { tag, label: sp.label, primary: true, key: 'E' }; }
    }
    if (best?.tag === 'chest') return { a: { label: 'OPEN STORAGE', key: 'E', primary: true, tag: 'chest' }, b: null };
    if (best?.tag === 'exit') return { a: { label: 'LEAVE HULL', key: 'E', primary: true, tag: 'leave' }, b: null };
    const rp = restPrompt(interior.userData.rest, lx, lz); // [bed-desk] at the berth / the chart table
    if (rp) return { a: { label: rp.label, key: 'E', primary: true, tag: rp.tag }, b: null };
    return { a: null, b: null };
  }

  function act(tag) {
    if (tag === 'chest') { try { houses?.openFor?.(SHIP_QUARTERS_ID); } catch {} return true; }
    if (tag === 'leave') return 'leave';
    if (tag === 'bed' || tag === 'desk') { // [bed-desk]
      const w = walker?.w, sp = interior?.userData?.rest?.[tag]; if (!w || !sp || !roomOrigin) return false;
      return rest.begin(tag, sp, w.x - roomOrigin.x, w.z - roomOrigin.z);
    }
    if (tag === 'getup') return rest.end('getup');
    if (tag === 'wardrobe') { try { openWardrobe?.('hull'); } catch {} return true; } // [t408u] CHANGE CLOTHES
    return false;
  }

  function tick() {
    if (!inHull || !interior || !walker?.w || !roomOrigin) return;
    rest.update(); // [bed-desk] walk / stick / jump = get up
    const w = walker.w;
    const ceilY = roomOrigin.y + (interior.userData.PEAK || interior.userData.H || 4.1) - 1.55;
    if (w.y > ceilY) { w.y = ceilY; if (w.vy > 0) w.vy = 0; if (w.body) { w.body.y = ceilY; if (w.body.vy > 0) w.body.vy = 0; } }
    if (!w.air && w.y < roomOrigin.y + QFLOOR) { w.y = roomOrigin.y + QFLOOR; if (w.body) w.body.y = w.y; }
    const inset = interior.userData.wallInset ? interior.userData.wallInset(1.25) : 0;
    const halfW = interior.userData.W / 2 - 0.44 - inset, halfD = interior.userData.D / 2 - 0.44;
    w.x = Math.max(roomOrigin.x - halfW, Math.min(roomOrigin.x + halfW, w.x));
    w.z = Math.max(roomOrigin.z - halfD, Math.min(roomOrigin.z + halfD, w.z));
    try {
      pirate.object.visible = true;
      pirate.object.position.set(w.x, w.y, w.z);
      pirate.object.rotation.order = 'YXZ';
      pirate.object.rotation.set(0, w.yaw, 0);
    } catch {}
    rest.apply(); // [bed-desk] the lying / seated body wins over the standing transform above
    try {
      for (const [id, p] of (fnet?.peers || [])) {
        if (p.pirate?.object && p.pirate.object.visible) { p.pirate.object.visible = false; hiddenPeers.add(id); }
      }
    } catch {}
    applyCam();
    try { tickQuarters(interior, (game?.t ?? performance.now() * 0.001)); } catch {}
  }

  function clear() {
    if (inHull) {
      rest.end('leave'); // [bed-desk]
      try { houses?.closeStorage?.(); } catch {}
      if (interior) { scene.remove(interior); disposeInterior(interior); interior = null; }
      if (QUARTERS_LOW_MEM) releaseQuartersAssets(); // [v339]
      inHull = false; roomOrigin = null; returnCtx = null;
      leaveBtn.style.display = 'none';
      document.documentElement.classList.remove('pfp-inhull', 'pfp-inhouse');
      const w = walker?.w;
      if (w) { w.camHook = w._cqCamPrev || null; w._cqCamPrev = null; }
      restoreOutdoorScene();
    }
  }

  return {
    get inHull() { return inHull; },
    get returnCtx() { return returnCtx; },
    get interior() { return interior; },
    get roomOrigin() { return roomOrigin; },
    get posed() { return rest.posed; }, get restKind() { return rest.kind; }, standUp: (why = 'hit') => rest.end(why), rest, // [bed-desk]
    SHIP_QUARTERS_ID, SHIP_QUARTERS_SLOTS, HULL_COMBAT_LOCK_S,
    enter, leave, prompts, act, tick, clear, leaveBtn,
    buildCaptainsQuartersRoom,
  };
}
