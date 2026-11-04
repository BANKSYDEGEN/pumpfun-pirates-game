// [Raul shop items 2] PUMPFUN PIRATES ship cosmetics from the shop: a FLAG (replaces the flag texture) and a FIGUREHEAD (sits over the
// bow figure). BANKSY "Do new shop items". Visual only: no stats, hit box or ship-skin change (Timothy's skins are untouched: this
// dresses whatever ship was built, after the build). One extra draw call per figurehead, none for a flag.
//   import { applyShipGear } from './shipGear.js';  applyShipGear(shipMesh, gear)   // gear.flag / gear.figure (js/pirateGear.js ids); 'none' = the skin's own
import * as THREE from 'three';
import { flagMats } from './ships.js';

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
export function drawFlag(id, c) {
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
function figGeo(id) {
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
export function figureMesh(id) { const m = new THREE.Mesh(figGeo(id), figMat()); m.name = 'shipgear_figure'; m.userData.sharedGeo = true; return m; }
// FIGURE seat: Timothy's figure info (ships.js figInfo p = the seat on the cutwater, s = its scale); a ship without the kit figure: the bow
const FIG_K = 1.35, FIG_DY = 0.5, FIG_DZ = 0.85;   // figure size vs the kit figure; DY drops its centre (figures are ~1.5 tall from y 0) onto the skull-in-a-tricorn, DZ pushes it ahead of it
export function applyShipGear(ship, gear) {
  if (!ship?.userData) return; const u = ship.userData, fl = SHIP_FLAGS.includes(gear?.flag) ? gear.flag : null, fg = SHIP_FIGURES.includes(gear?.figure) ? gear.figure : null;
  const key = (fl || '') + '|' + (fg || ''); if (u.shipGearKey === key) return; u.shipGearKey = key;
  try {
    const F = u.flag; if (F?.children?.length >= 2) {
      if (!F.userData.mats0) F.userData.mats0 = [F.children[0].material, F.children[1].material];
      const m = fl ? flagMats(flagTex(fl)) : F.userData.mats0; F.children[0].material = m[0]; F.children[1].material = m[1];
    }
    const body = u.body || ship; const old = body.getObjectByName('shipgear_figure'); if (old) old.removeFromParent();
    if (fg) { const fi = u.figure, m = figureMesh(fg);
      if (fi) { const sc = fi.s * FIG_K; m.position.set(fi.p[0], fi.p[1] - FIG_DY * sc, fi.p[2] + FIG_DZ * fi.s); m.scale.setScalar(sc); }
      else { const L = u.layout; m.position.set(0, (L?.bowY ?? 2) - 1.0, (L?.zAt ? L.zAt(1) : (u.len || 16) / 2) - 0.3); m.scale.setScalar(0.9); }
      m.rotation.x = -0.35; m.castShadow = true; body.add(m); }
  } catch (e) { console.warn('[ship gear]', e); }
}
