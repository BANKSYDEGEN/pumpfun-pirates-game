// [Raul shop items 2] PUMPFUN PIRATES ship cosmetics from the shop: a FLAG (replaces the flag texture) and a FIGUREHEAD (sits over the
// bow figure). BANKSY "Do new shop items". Visual only: no stats, hit box or ship-skin change (Timothy's skins are untouched: this
// dresses whatever ship was built, after the build). One extra draw call per figurehead, none for a flag.
//   import { applyShipGear } from './shipGear.js';  applyShipGear(shipMesh, gear)   // gear.flag / gear.figure (js/pirateGear.js ids); 'none' = the skin's own
import * as THREE from 'three';
import { flagMats, setTagHidden } from './ships.js';
import { KIT } from './shipKit.js';
import { loadPirateGLB } from './pirateGLB.js';

export const SHIP_FLAGS = ['flag_cutlass', 'flag_red', 'flag_gold'];
export const SHIP_FIGURES = ['fig_mermaid', 'fig_kraken', 'fig_lion'];
let _skull = null; const _flags = new Map(), _waiting = new Set();
function skullImg() {
  if (_skull) return _skull; _skull = new Image(); _skull.src = new URL('../assets/skull_transparent.png', import.meta.url).href;
  _skull.onload = () => { for (const f of _waiting) f(); _waiting.clear(); }; return _skull;
}
function cutlass(g, x, y, a, s, blade = '#e8edf2', hilt = '#e9b949') {
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  g.fillStyle = blade; g.beginPath(); g.moveTo(-6, 40); g.quadraticCurveTo(26, -60, 4, -150); g.quadraticCurveTo(-4, -60, -18, 40); g.closePath(); g.fill();
  g.fillStyle = hilt; g.fillRect(-34, 38, 52, 12); g.fillStyle = '#5a3420'; g.fillRect(-14, 50, 12, 36); g.fillStyle = hilt; g.beginPath(); g.arc(-8, 92, 9, 0, 7); g.fill(); g.restore();
}
// the flag canvas (512 x 340 like ships.js makeSkullTexture): the REAL skull logo image, never redrawn
// [figureheads 2] the BLOOD RED flag, redrawn to the ships' quality: woven cloth with soft folds, a dark hoist sleeve with brass grommets, a
// stitched border, the skull with a cast shadow, a few blood drips off the head, a battle-worn fly (charred, frayed, two shot holes)
function drawRed(g, w, h, img) {
  const rnd = ((k) => () => (k = (k * 16807) % 2147483647) / 2147483647)(7);
  let gr = g.createRadialGradient(w * 0.56, h * 0.46, 20, w * 0.56, h * 0.46, w * 0.62); gr.addColorStop(0, '#c0141f'); gr.addColorStop(0.65, '#9a0c16'); gr.addColorStop(1, '#5e070c');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5; i++) { const x = 60 + i * 96, f = g.createLinearGradient(x - 48, 0, x + 48, 0); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(0.5, i % 2 ? 'rgba(255,190,190,0.07)' : 'rgba(0,0,0,0.13)'); f.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = f; g.fillRect(x - 48, 0, 96, h); }
  g.globalAlpha = 0.07; g.fillStyle = '#fff'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1); g.fillStyle = '#000'; for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1, h); g.globalAlpha = 1;
  // stitched border
  g.strokeStyle = '#2a0508'; g.lineWidth = 9; g.strokeRect(44, 12, w - 58, h - 24); g.setLineDash([9, 7]); g.strokeStyle = 'rgba(240,200,160,0.55)'; g.lineWidth = 2; g.strokeRect(56, 24, w - 82, h - 48); g.setLineDash([]);
  // blood drips off the head of the border
  g.fillStyle = '#4a0408'; for (const [x, l] of [[120, 34], [178, 18], [262, 46], [344, 24], [418, 38]]) { g.beginPath(); g.moveTo(x - 6, 14); g.lineTo(x + 6, 14); g.lineTo(x + 3, 14 + l); g.arc(x, 14 + l, 4.5, 0, Math.PI); g.closePath(); g.fill(); }
  // the skull (the real logo) with its shadow
  if (img.complete && img.naturalWidth) {
    const s = h * 0.7, ar = img.naturalWidth / img.naturalHeight, sw = ar >= 1 ? s : s * ar, sh = ar >= 1 ? s / ar : s, x = (w - sw) / 2 + 18, y = (h - sh) / 2;
    const t = document.createElement('canvas'); t.width = sw; t.height = sh; const tg = t.getContext('2d'); tg.drawImage(img, 0, 0, sw, sh); tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = '#1a0204'; tg.fillRect(0, 0, sw, sh);
    g.globalAlpha = 0.45; g.drawImage(t, x + 6, y + 7); g.globalAlpha = 1; g.drawImage(img, x, y, sw, sh);
  }
  // hoist sleeve + brass grommets
  gr = g.createLinearGradient(0, 0, 40, 0); gr.addColorStop(0, '#1c0306'); gr.addColorStop(1, '#3e070c'); g.fillStyle = gr; g.fillRect(0, 0, 40, h);
  g.setLineDash([6, 6]); g.strokeStyle = 'rgba(230,190,150,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(37, 0); g.lineTo(37, h); g.stroke(); g.setLineDash([]);
  for (const y of [h * 0.12, h * 0.5, h * 0.88]) { g.fillStyle = '#e0b04a'; g.beginPath(); g.arc(20, y, 9, 0, 7); g.fill(); g.fillStyle = '#7a5410'; g.beginPath(); g.arc(20, y, 9, 0, 7); g.lineWidth = 2; g.strokeStyle = '#7a5410'; g.stroke(); g.fillStyle = '#120204'; g.beginPath(); g.arc(20, y, 4.5, 0, 7); g.fill(); }
  // battle-worn fly: a charred, frayed edge and two shot holes
  g.fillStyle = '#240406'; g.beginPath(); g.moveTo(w, 0); for (let y = 0; y <= h; y += 10) g.lineTo(w - 10 - rnd() * 26, y); g.lineTo(w, h); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(40,4,6,0.8)'; g.lineWidth = 2; for (let y = 6; y < h; y += 9) { const x = w - 30 - rnd() * 22; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 10 - rnd() * 14, y + 2); g.stroke(); }
  for (const [x, y, r] of [[w - 80, h * 0.24, 7], [w - 128, h * 0.78, 5]]) { g.fillStyle = '#5a1a12'; g.beginPath(); g.arc(x, y, r + 4, 0, 7); g.fill(); g.fillStyle = '#0c0203'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
}
export function drawFlag(id, c) {
  if (id === 'flag_red') { c.width = 512; c.height = 340; drawRed(c.getContext('2d'), 512, 340, skullImg()); return c; }
  const w = c.width = 512, h = c.height = 340, g = c.getContext('2d'), img = skullImg(), S = { flag_cutlass: ['#0b0b0b', null], flag_red: ['#9e0c14', '#1a0a0a'], flag_gold: ['#14100a', '#f2c230'] }[id] || ['#0b0b0b', null];
  g.fillStyle = S[0]; g.fillRect(0, 0, w, h); g.globalAlpha = 0.07; g.fillStyle = '#fff'; for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 1); g.globalAlpha = 1;
  if (S[1]) { g.strokeStyle = S[1]; g.lineWidth = 14; g.strokeRect(9, 9, w - 18, h - 18); }
  if (id === 'flag_cutlass') { cutlass(g, w / 2 - 40, h / 2 + 70, -0.7, 1.1); cutlass(g, w / 2 + 40, h / 2 + 70, 0.7, 1.1); }
  if (id === 'flag_gold') { g.fillStyle = '#f2c230'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(w / 2, h / 2); g.arc(w / 2, h / 2, 230, a, a + 0.18); g.closePath(); g.globalAlpha = 0.22; g.fill(); } g.globalAlpha = 1; }
  if (img.complete && img.naturalWidth) {
    const s = h * (id === 'flag_cutlass' ? 0.62 : 0.74), ar = img.naturalWidth / img.naturalHeight, sw = ar >= 1 ? s : s * ar, sh = ar >= 1 ? s / ar : s;
    if (id === 'flag_gold') {   // the logo in gold: draw it, then tint its pixels
      const t = document.createElement('canvas'); t.width = sw; t.height = sh; const tg = t.getContext('2d'); tg.drawImage(img, 0, 0, sw, sh);
      tg.globalCompositeOperation = 'source-atop'; const gr = tg.createLinearGradient(0, 0, 0, sh); gr.addColorStop(0, '#ffe27a'); gr.addColorStop(1, '#c88a16'); tg.globalAlpha = 0.78; tg.fillStyle = gr; tg.fillRect(0, 0, sw, sh);
      g.drawImage(t, (w - sw) / 2, (h - sh) / 2 - (id === 'flag_cutlass' ? 20 : 0));
    } else g.drawImage(img, (w - sw) / 2, (h - sh) / 2 - (id === 'flag_cutlass' ? 20 : 0), sw, sh);
  }
  g.fillStyle = S[0]; for (let y = 0; y < h; y += 18) { g.beginPath(); g.moveTo(w, y); g.lineTo(w - 10 - (y % 36 ? 6 : 0), y + 9); g.lineTo(w, y + 18); g.fill(); }   // frayed fly edge
  return c;
}
function flagTex(id) {
  if (_flags.has(id)) return _flags.get(id);
  const c = drawFlag(id, document.createElement('canvas')), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (!(skullImg().complete && skullImg().naturalWidth)) _waiting.add(() => { drawFlag(id, c); t.needsUpdate = true; });
  _flags.set(id, t); return t;
}
// ---------- figureheads (toon, one merged mesh per figure; built once per id, shared geometry) ----------
const _figs = new Map(); let _grad = null;
const grad = () => _grad || (_grad = (() => { const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]), 4, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })());
function figGeoOld(id) {   // the procedural fallback (the GLB below failed / is not loaded yet)
  if (_figs.has(id)) return _figs.get(id);
  const parts = [], c = new THREE.Color();
  const add = (geo, hex, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const g = geo.toNonIndexed(); g.deleteAttribute('uv'); g.scale(...s); g.rotateX(r[0]); g.rotateY(r[1]); g.rotateZ(r[2]); g.translate(...p); c.set(hex);
    const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g); };
  const S = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h), C = (a, b, h, n = 12) => new THREE.CylinderGeometry(a, b, h, n);
  const tube = (pts, r, hex) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, r, 8), hex);
  if (id === 'fig_mermaid') {
    const SK = '#f2c9a0', HR = '#d8262c', TL = '#2ec4a0', TD = '#1f8f6a', GD = '#f2c230';
    tube([[0, -0.1, -0.15], [0, 0.15, 0.05], [0, 0.45, 0.12], [0, 0.62, 0.1]], 0.16, TL);                 // tail rising to the waist
    add(new THREE.ConeGeometry(0.28, 0.32, 3), TD, [0, -0.2, -0.28], [1.2, 0, 0], [1, 1, 0.35]);              // tail fin
    add(S(0.2), SK, [0, 0.8, 0.14], [0, 0, 0], [1, 1.15, 0.85]);                                              // torso
    for (const sx of [1, -1]) { add(S(0.075, 10, 8), GD, [sx * 0.09, 0.86, 0.28]); tube([[sx * 0.17, 0.92, 0.12], [sx * 0.24, 0.78, 0.3], [sx * 0.12, 0.7, 0.45]], 0.055, SK); }
    add(S(0.24), SK, [0, 1.17, 0.2]);                                                                         // big chibi head
    add(S(0.27), HR, [0, 1.22, 0.12], [0, 0, 0], [1.05, 1, 1]);                                               // hair cap behind
    tube([[0, 1.3, 0.0], [0.05, 1.0, -0.2], [-0.05, 0.7, -0.25]], 0.12, HR);                                  // flowing hair
    for (const sx of [1, -1]) { add(S(0.045, 10, 8), '#1c1c20', [sx * 0.08, 1.2, 0.42]); add(S(0.014, 6, 5), '#ffffff', [sx * 0.07, 1.22, 0.46]); }
    add(C(0.03, 0.03, 0.08, 8), '#c8302c', [0, 1.08, 0.42], [Math.PI / 2, 0, 0], [1.6, 1, 0.5]);
    add(new THREE.TorusGeometry(0.2, 0.03, 6, 16), GD, [0, 1.4, 0.15], [Math.PI / 2.4, 0, 0]);               // gold tiara
  } else if (id === 'fig_kraken') {
    const K = '#7a3fb0', KD = '#4e2478', SU = '#f0c6d8';
    add(S(0.34, 16, 12), K, [0, 1.05, 0.12], [0, 0, 0], [1, 1.25, 1]);                                       // mantle
    for (const sx of [1, -1]) { add(S(0.1, 12, 8), '#f2c230', [sx * 0.15, 0.95, 0.4]); add(S(0.05, 8, 6), '#1c1c20', [sx * 0.15, 0.95, 0.48]); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, x = Math.cos(a) * 0.22, z = Math.sin(a) * 0.18 + 0.15, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.4 + 0.3;
      tube([[x, 0.75, z], [cx * 0.8, 0.4, cz], [cx, 0.05, cz + 0.1], [cx * 0.6, -0.1, cz + 0.3]], 0.075 - i * 0.004, i % 2 ? K : KD);
      for (let k = 0; k < 3; k++) add(S(0.03, 6, 5), SU, [cx * (0.75 + k * 0.08), 0.5 - k * 0.2, cz + 0.08]); }
  } else {   // fig_lion
    const G1 = '#f2c230', G2 = '#c88a16', G3 = '#ffe27a';
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; add(S(0.16, 10, 8), i % 2 ? G2 : G1, [Math.cos(a) * 0.36, 1.0 + Math.sin(a) * 0.36, 0.05]); }   // mane
    add(S(0.32, 16, 12), G1, [0, 1.0, 0.18], [0, 0, 0], [1, 1, 0.9]);                                       // face
    add(S(0.15, 12, 8), G3, [0, 0.9, 0.44], [0, 0, 0], [1.2, 0.85, 0.8]);                                   // muzzle
    add(S(0.05, 8, 6), '#3a2014', [0, 0.97, 0.56]);                                                          // nose
    add(S(0.09, 10, 8), '#8e1b2a', [0, 0.8, 0.44], [0, 0, 0], [1, 0.6, 0.6]);                               // roaring mouth
    for (const sx of [1, -1]) { add(S(0.05, 8, 6), '#d8162c', [sx * 0.13, 1.1, 0.44]); add(S(0.08, 8, 6), G2, [sx * 0.26, 1.3, 0.1]); }   // ruby eyes, ears
    tube([[0, 0.65, 0.05], [0, 0.35, -0.05], [0, 0.05, -0.2]], 0.14, G2);                                   // chest into the stem
    for (const sx of [1, -1]) tube([[sx * 0.18, 0.65, 0.1], [sx * 0.22, 0.4, 0.3], [sx * 0.16, 0.25, 0.42]], 0.07, G1);   // paws
  }
  // ink outline shell (back faces, pushed out): the toy look of the pirates
  const ink = [];
  for (const g of parts) { const o = g.clone(); o.computeVertexNormals(); const P = o.attributes.position, N = o.attributes.normal; for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) + N.getX(i) * 0.025, P.getY(i) + N.getY(i) * 0.025, P.getZ(i) + N.getZ(i) * 0.025);
    const col = o.attributes.color; for (let i = 0; i < col.count; i++) col.setXYZ(i, 0.06, 0.05, 0.05);
    const I = []; for (let i = 0; i < P.count; i += 3) I.push(i, i + 2, i + 1); o.setIndex(I); ink.push(o.toNonIndexed()); }
  for (const g of parts) g.computeVertexNormals();
  const geo = mergeGeos([...parts, ...ink]); geo.computeBoundingSphere(); _figs.set(id, geo); return geo;
}
function mergeGeos(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count; const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  for (const g of list) { const k = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal ? g.attributes.normal.array : new Float32Array(k * 3), o * 3); C.set(g.attributes.color.array, o * 3); o += k; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); return g;
}
let _mat = null; const figMat = () => _mat || (_mat = new THREE.MeshToonMaterial({ name: 'ship_figure', vertexColors: true, gradientMap: grad() }));
// [figureheads 2] the carved figureheads: tools/blender/figureheads/build_figureheads.py -> assets/ships/gear/figureheads_{hi,lo}.glb (draco, one
// mesh per id, vertex colour + baked AO + its own ink shell). High ~4.5k tris, Low (phones) ~1.3k. Frame: y up, z forward, z = 0 = the figure's
// BACK (its mount plane), a mount block behind it. figuresReady(lo) loads once (main.js / island await it with the ship kit); a ship dressed
// before it lands gets the old procedural figure and is re-dressed when it does.
const _glb = { hi: null, lo: null }, _load = {}; let _lo = null;
const figLo = () => (_lo ?? !!KIT.lo);
export function figuresReady(lo) {
  if (lo != null && _lo == null) _lo = !!lo; const k = figLo() ? 'lo' : 'hi';
  if (!_load[k]) _load[k] = Promise.race([loadPirateGLB(new URL(`../assets/ships/gear/figureheads_${k}.glb`, import.meta.url).href).then((gl) => {
      const out = new Map(); gl.scene.updateMatrixWorld(true);
      gl.scene.traverse((o) => { if (!o.isMesh || !SHIP_FIGURES.includes(o.name)) return; const g = o.geometry.clone().applyMatrix4(o.matrixWorld), a = g.attributes.color;
        if (a && (a.itemSize === 4 || a.normalized)) { const c = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { c[i * 3] = a.getX(i); c[i * 3 + 1] = a.getY(i); c[i * 3 + 2] = a.getZ(i); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
        for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(n)) g.deleteAttribute(n);
        g.computeBoundingSphere(); g.computeBoundingBox(); out.set(o.name, g); });
      _glb[k] = out; return true; }), new Promise((r) => setTimeout(() => r(false), 10000))]).catch((e) => { console.warn('[ship gear] figureheads: procedural fallback', e?.message || e); return false; });
  return _load[k];
}
const figGeo = (id) => _glb[figLo() ? 'lo' : 'hi']?.get(id) || null;
export function figureMesh(id) { const g = figGeo(id), m = new THREE.Mesh(g || figGeoOld(id), figMat()); m.name = 'shipgear_figure'; m.userData.sharedGeo = true; m.userData.carved = !!g; return m; }
// SEAT: the figure's back plane is pressed onto the REAL bow of whatever was built (Timothy's kit hull, a skin's parts override, the COMMODORE
// boss build): rays from ahead of the bow at the figure's heights (x = 0 and either side, median) find the stem; the figure tilts with its rake
// and sits on its most forward point, its mount block (0.25 deep) filling any hollow behind. Height / size: Timothy's figure seat as before.
const FIG_K = 1.35, FIG_DY = 0.5, FIG_DZ = 0.85, EMBED = 0.04, NRAY = 10;   // FIG_DZ: the old procedural figure only
const _m4 = new THREE.Matrix4(), _bx = new THREE.Box3(), _sl = new THREE.Box3(), _p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
// the bow's front (max z) in NB height bins over [ya, yb], on the planes x = -w, 0, +w (body frame), median of the three per bin (a rope / stay
// crossing one plane is not the stem). One pass over the triangles of the visible, solid meshes whose box reaches the slab (no raycaster: ~ms).
function stemProfile(body, skip, w, ya, yb, NB) {
  const Z = [0, 1, 2].map(() => new Float32Array(NB).fill(-1e9)), X = [-w, 0, w], vis = (o) => { for (let q = o; q && q !== body.parent; q = q.parent) if (!q.visible) return false; return true; };
  body.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(body.matrixWorld).invert(); _sl.min.set(-w * 1.01, ya, -1e9); _sl.max.set(w * 1.01, yb, 1e9);
  const put = (k, y0, z0, y1, z1) => { let i0 = Math.floor((y0 - ya) / (yb - ya) * NB), i1 = Math.floor((y1 - ya) / (yb - ya) * NB); if (i0 > i1) { [i0, i1] = [i1, i0]; [y0, y1] = [y1, y0]; [z0, z1] = [z1, z0]; }
    for (let i = Math.max(0, i0); i <= Math.min(NB - 1, i1); i++) { const yc = ya + (i + 0.5) * (yb - ya) / NB, t = y1 > y0 ? Math.min(1, Math.max(0, (yc - y0) / (y1 - y0))) : 0, z = z0 + (z1 - z0) * t; if (z > Z[k][i]) Z[k][i] = z; } };
  body.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o === skip || !o.material || Array.isArray(o.material) || o.material.blending === THREE.AdditiveBlending || o.material.depthWrite === false || !vis(o)) return;
    const g = o.geometry, P = g.attributes.position; if (!P) return; if (!g.boundingBox) g.computeBoundingBox(); _m4.multiplyMatrices(inv, o.matrixWorld);
    if (!_bx.copy(g.boundingBox).applyMatrix4(_m4).intersectsBox(_sl)) return;
    const I = g.index, n = I ? I.count : P.count, e = _m4.elements;
    for (let t = 0; t < n; t += 3) { const ia = I ? I.getX(t) : t, ib = I ? I.getX(t + 1) : t + 1, ic = I ? I.getX(t + 2) : t + 2; if (ia === ib && ib === ic) continue;
      let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
      for (let j = 0; j < 3; j++) { const q = _p[j], vi = j === 0 ? ia : j === 1 ? ib : ic, x = P.getX(vi), y = P.getY(vi), z = P.getZ(vi);
        q.set(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
        xmin = Math.min(xmin, q.x); xmax = Math.max(xmax, q.x); ymin = Math.min(ymin, q.y); ymax = Math.max(ymax, q.y); }
      if (xmax < -w || xmin > w || ymax < ya || ymin > yb) continue;
      for (let k = 0; k < 3; k++) { const c = X[k]; if (xmax < c || xmin > c) continue; const pts = [];
        for (let j = 0; j < 3; j++) { const A = _p[j], B = _p[(j + 1) % 3], da = A.x - c, db = B.x - c; if (da === 0) pts.push(A.y, A.z); else if (da * db < 0) { const f = da / (da - db); pts.push(A.y + (B.y - A.y) * f, A.z + (B.z - A.z) * f); } }
        if (pts.length >= 4) put(k, pts[0], pts[1], pts[2], pts[3]); else if (pts.length === 2) put(k, pts[0], pts[1], pts[0], pts[1]); } } });
  return Array.from({ length: NB }, (_, i) => { const v = [Z[0][i], Z[1][i], Z[2][i]].sort((a, b) => a - b)[1]; return v > -1e8 ? v : null; });
}
// [Raul items redo] the ram's top + the bowsprit's underside along z (for a figure riding a RAM): per z bin over [za, zb], the highest hull point
// under ysplit (the ram) and the lowest over it (the bowsprit), from the x = 0 / +-w slices (ram: max of the three; ceiling: x = 0, a thin spar)
function zProfile(body, skip, w, ya, yb, ysplit, za, zb, NB) {
  const lo = new Float32Array(NB).fill(-1e9), hi = new Float32Array(NB).fill(1e9), X = [-w, 0, w], vis = (o) => { for (let q = o; q && q !== body.parent; q = q.parent) if (!q.visible) return false; return true; };
  body.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(body.matrixWorld).invert(); _sl.min.set(-w * 1.01, ya, za); _sl.max.set(w * 1.01, yb, zb);
  const put = (k, y0, z0, y1, z1) => { if (z0 > z1) { [y0, y1] = [y1, y0]; [z0, z1] = [z1, z0]; } const i0 = Math.floor((z0 - za) / (zb - za) * NB), i1 = Math.floor((z1 - za) / (zb - za) * NB);
    for (let i = Math.max(0, i0); i <= Math.min(NB - 1, i1); i++) { const zc = za + (i + 0.5) * (zb - za) / NB, t = z1 > z0 ? Math.min(1, Math.max(0, (zc - z0) / (z1 - z0))) : 0, y = y0 + (y1 - y0) * t;
      if (y < ya || y > yb) continue; if (y < ysplit) { if (y > lo[i]) lo[i] = y; } else if (k === 1 && y < hi[i]) hi[i] = y; } };
  body.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o === skip || !o.material || Array.isArray(o.material) || o.material.blending === THREE.AdditiveBlending || o.material.depthWrite === false || !vis(o)) return;
    const g = o.geometry, P = g.attributes.position; if (!P) return; if (!g.boundingBox) g.computeBoundingBox(); _m4.multiplyMatrices(inv, o.matrixWorld);
    if (!_bx.copy(g.boundingBox).applyMatrix4(_m4).intersectsBox(_sl)) return;
    const I = g.index, n = I ? I.count : P.count, e = _m4.elements;
    for (let t = 0; t < n; t += 3) { const ia = I ? I.getX(t) : t, ib = I ? I.getX(t + 1) : t + 1, ic = I ? I.getX(t + 2) : t + 2; if (ia === ib && ib === ic) continue;
      let xmin = 1e9, xmax = -1e9, zmin = 1e9, zmax = -1e9;
      for (let j = 0; j < 3; j++) { const q = _p[j], vi = j === 0 ? ia : j === 1 ? ib : ic, x = P.getX(vi), y = P.getY(vi), z = P.getZ(vi);
        q.set(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
        xmin = Math.min(xmin, q.x); xmax = Math.max(xmax, q.x); zmin = Math.min(zmin, q.z); zmax = Math.max(zmax, q.z); }
      if (xmax < -w || xmin > w || zmax < za || zmin > zb) continue;
      for (let k = 0; k < 3; k++) { const c = X[k]; if (xmax < c || xmin > c) continue; const pts = [];
        for (let j = 0; j < 3; j++) { const A = _p[j], B = _p[(j + 1) % 3], da = A.x - c, db = B.x - c; if (da === 0) pts.push(A.y, A.z); else if (da * db < 0) { const f = da / (da - db); pts.push(A.y + (B.y - A.y) * f, A.z + (B.z - A.z) * f); } }
        if (pts.length >= 4) put(k, pts[0], pts[1], pts[2], pts[3]); else if (pts.length === 2) put(k, pts[0], pts[1], pts[0], pts[1]); } } });
  return { lo: Array.from(lo, (v) => (v > -1e8 ? v : null)), hi: Array.from(hi, (v) => (v < 1e8 ? v : null)) };
}
const FIG_H = 1.97, FIG_D = 0.62, RAM_LEAN = 0.28;   // the carved figure's height / depth (frame units), its forward lean when it rides a ram
const _seats = new Map();   // ship build key -> seat (PvP: one sweep per build, not per ship)
export function seatFigure(body, m, u) {
  const fi = u.figure, fs = fi ? fi.s : (u.depth || 3) / 3.1 * 1.05, sc = fs * FIG_K, L = u.layout;
  const y0 = fi ? fi.p[1] - FIG_DY * sc : (fi?.bowY ?? L?.bowY ?? 2) - 0.95 * fs - FIG_DY * sc, zb = fi ? fi.zb : (L?.zAt ? L.zAt(1) : (u.len || 16) / 2);
  m.scale.setScalar(sc); m.rotation.set(0, 0, 0); m.position.set(0, y0, zb);
  if (!m.userData.carved) { if (fi) m.position.z = fi.p[2] + FIG_DZ * fi.s; m.rotation.x = -0.35; return; }
  const key = (u.key || '') + '|' + (u.skinId || '') + '|' + m.geometry.uuid, hit = u.key ? _seats.get(key) : null;
  if (hit) { m.rotation.x = hit[0]; m.position.z = hit[1]; m.position.y = hit[3]; m.scale.setScalar(hit[4]); m.userData.seat = hit[2]; return; }
  const bowY = fi?.bowY ?? L?.bowY ?? y0 + 2 * sc, top = Math.min(y0 + 1.25 * sc, bowY - 0.12 * sc), ya = y0 - 0.35 * sc, z = stemProfile(body, m, 0.1 * sc, ya, top, NRAY);
  const P = z.map((v, k) => [ya + (k + 0.5) * (top - ya) / NRAY, v]).filter((p) => p[1] != null); if (P.length < 2) { m.position.z = zb; return; }
  // the stem: walk down from the top bin while the bow stays within 0.15 of a figure of the bin above; a jump forward is a protrusion (a RAM
  // blade under the figure): the figure then stands on it (lifted clear of its top, scaled to fit under the bowsprit). Then least squares.
  P.sort((a, b) => b[0] - a[0]); const Q = [P[0]]; let yp = null;
  for (let k = 1; k < P.length; k++) { if (P[k][1] > Q[Q.length - 1][1] + 0.15 * sc) { yp = P[k][0] + 0.5 * (top - ya) / NRAY + 0.03 * sc; break; } Q.push(P[k]); }
  if (yp != null && yp > y0 - 0.42 * sc) {   // the ceiling over it: the bowsprit (the first bin above the stem head that reaches well forward)
    const cy0 = bowY - 0.6 * sc, cy1 = bowY + 1.2 * sc, C = stemProfile(body, m, 0.1 * sc, cy0, cy1, 12); let ceil = cy1;
    for (let k = 0; k < 12; k++) if (C[k] != null && C[k] > Q[0][1] + 0.5 * sc) { ceil = cy0 + k * (cy1 - cy0) / 12; break; }
    // [Raul items redo] BANKSY via Emerly: on ram builds the figure read at ~half size (squeezed between the ram's root and the bowsprit). The
    // bowsprit rises as it reaches forward, so walk the figure out along the ram's top to where it fits nearly full size (a small forward
    // lean under the spar), staying close to the stem; it still stands on the ram and never touches the bowsprit.
    const zs = Q[Q.length - 1][1], NZ = 16, zz1 = zs + 2.4 * sc, Z = zProfile(body, m, 0.1 * sc, ya, cy1, (yp + ceil) / 2, zs - 0.1 * sc, zz1, NZ), dz = (zz1 - zs + 0.1 * sc) / NZ;
    const cl = Math.cos(RAM_LEAN), hgt = (FIG_H * cl + FIG_D * Math.sin(RAM_LEAN)) * sc; let best = null;
    for (let i = 0; i < NZ; i++) { const z0 = zs - 0.1 * sc + i * dz; if (z0 < zs - 0.02 * sc || z0 > zs + 1.3 * sc) continue; let fl = -1e9, ce = 1e9, ok = true;
      for (let j = i; j < NZ && zs - 0.1 * sc + j * dz <= z0 + FIG_D * sc; j++) { if (Z.lo[j] == null) { if (j === i) ok = false; continue; } fl = Math.max(fl, Z.lo[j]); if (Z.hi[j] != null) ce = Math.min(ce, Z.hi[j]); }
      if (!ok || fl < -1e8) continue; if (ce > 1e8) ce = cy1;
      const k = Math.max(0.45, Math.min(1, (ce - 0.04 * sc - fl) / hgt)), score = k - 0.12 * (z0 - zs) / sc;
      if (!best || score > best.score) best = { score, k, z0, fl }; }
    const k0 = Math.max(0.45, Math.min(1, (ceil - 0.03 * sc - yp) / (FIG_H * sc)));
    if (best && best.k > k0 + 0.04) { m.scale.setScalar(sc * best.k); m.rotation.x = RAM_LEAN; m.position.set(0, best.fl + 0.42 * sc * best.k - 0.02 * sc, best.z0 + 0.06 * sc * best.k);
      m.userData.seat = { ram: true, k: +best.k.toFixed(2), k0: +k0.toFixed(2), dz: +((best.z0 - zs) / sc).toFixed(2) }; if (u.key) _seats.set(key, [m.rotation.x, m.position.z, m.userData.seat, m.position.y, m.scale.x]); return; }
    m.scale.setScalar(sc * k0); m.position.y = Math.max(y0, yp + 0.42 * sc * k0); }
  const my = Q.reduce((s, p) => s + p[0], 0) / Q.length, mz = Q.reduce((s, p) => s + p[1], 0) / Q.length;
  const sl = Q.length < 2 ? 0 : Math.max(0, Math.min(0.6, Q.reduce((s, p) => s + (p[0] - my) * (p[1] - mz), 0) / Math.max(1e-6, Q.reduce((s, p) => s + (p[0] - my) ** 2, 0))));
  const res = Q.map((p) => p[1] - (mz + sl * (p[0] - my))), keep = res;
  m.rotation.x = Math.atan(sl); m.position.z = mz + sl * (m.position.y - my) + Math.max(...keep) - EMBED * sc; m.userData.seat = { sl: +sl.toFixed(3), res: res.map((r) => +r.toFixed(2)) };
  if (u.key) _seats.set(key, [m.rotation.x, m.position.z, m.userData.seat, m.position.y, m.scale.x]);
}
export function applyShipGear(ship, gear) {
  if (!ship?.userData) return; const u = ship.userData, fl = SHIP_FLAGS.includes(gear?.flag) ? gear.flag : null, fg = SHIP_FIGURES.includes(gear?.figure) ? gear.figure : null;
  const key = (fl || '') + '|' + (fg || ''); if (u.shipGearKey === key) return; u.shipGearKey = key;
  try {
    const F = u.flag; if (F?.children?.length >= 2) {
      const C = F.children; if (!F.userData.mats0) F.userData.mats0 = [C[0].userData.teamOrig || C[0].material, C[1].userData.teamOrig || C[1].material];
      const m = fl ? flagMats(flagTex(fl)) : F.userData.mats0;
      // [Raul shop2 fixes] squads team paint (js/squads.js) keeps the flag it restores in userData.teamOrig: the shop flag goes there too, so a
      // team flag (2v2: team colour wins while it lasts) or a later teamPaint(null) in the harbor never puts the skin's flag back over yours
      for (const k of [0, 1]) { if (C[k].userData.teamOrig) C[k].userData.teamOrig = m[k]; if (u.teamHex == null) C[k].material = m[k]; }
    }
    const body = u.body || ship; const old = body.getObjectByName('shipgear_figure'); if (old) old.removeFromParent();
    setTagHidden(ship, 'fig', !!fg);   // [Raul shop2 fixes] BANKSY via Emerly: a shop figurehead REPLACES Timothy's skull-in-a-tricorn (+ its max-HULL crown + wings), no overlap
    if (fg) { const m = figureMesh(fg); m.castShadow = true; seatFigure(body, m, u); body.add(m);
      if (!m.userData.carved) figuresReady().then((ok) => { if (ok && m.parent && !u.baked) { u.shipGearKey = null; applyShipGear(ship, gear); } }); }
  } catch (e) { console.warn('[ship gear]', e); }
}
