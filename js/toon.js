// Stylized toon toolkit: gradient ramps, toon materials, inverted-hull outlines and
// hand-painted-style procedural canvas textures (no image downloads).
import * as THREE from 'three';

// ---------- seeded random so every ship of a scheme paints the same ----------
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const hex = (c) => '#' + new THREE.Color(c).getHexString();
function shade(c, k) { const col = new THREE.Color(c); if (k >= 0) col.lerp(new THREE.Color(1, 1, 1), k); else col.multiplyScalar(1 + k); return '#' + col.getHexString(); }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat = false, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------- toon ramp ----------
let _ramp = null;
export function toonRamp() {
  if (_ramp) return _ramp;
  // 4 soft steps: deep shadow, shadow, lit, highlight
  const d = new Uint8Array([70, 70, 70, 255, 140, 140, 140, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  _ramp = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  _ramp.minFilter = _ramp.magFilter = THREE.NearestFilter; _ramp.generateMipmaps = false; _ramp.needsUpdate = true;
  return _ramp;
}
const _matCache = new Map();
export function toon(color = 0xffffff, map = null, extra = {}) {
  const key = extra.key ? `${extra.key}` : null;
  if (key && _matCache.has(key)) return _matCache.get(key);
  const { key: _k, ...rest } = extra;
  const m = new THREE.MeshToonMaterial({ color, map, gradientMap: toonRamp(), ...rest });
  if (key) _matCache.set(key, m);
  return m;
}
// HDR glow (values > 1 feed the bloom pass on high quality)
export function glowMat(color, k = 2.2, extra = {}) {
  const m = new THREE.MeshBasicMaterial({ ...extra });
  m.color.set(color).multiplyScalar(k);
  return m;
}

// ---------- inverted-hull outline ----------
const _outlineMats = new Map();
export function outlineMat(thickness = 0.06, color = 0x0b0d10) {
  const k = `${thickness}_${color}`;
  if (_outlineMats.has(k)) return _outlineMats.get(k);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, fog: true });
  m.onBeforeCompile = (s) => {
    s.uniforms.uOutline = { value: thickness };
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uOutline;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uOutline;');
  };
  m.customProgramCacheKey = () => 'outline';
  _outlineMats.set(k, m);
  return m;
}
// smooth normals for the outline shell so split (flat) normals don't crack it
export function outlineFor(mesh, thickness = 0.06) {
  let g = mesh.geometry;
  const o = new THREE.Mesh(smoothNormalsGeometry(g), outlineMat(thickness));
  o.position.copy(mesh.position); o.rotation.copy(mesh.rotation); o.scale.copy(mesh.scale);
  o.castShadow = false; o.renderOrder = 0; o.userData.outline = true;
  return o;
}
function smoothNormalsGeometry(g) {
  const pos = g.attributes.position, n = pos.count;
  const map = new Map(), acc = [];
  const out = new Float32Array(n * 3);
  const src = g.attributes.normal;
  for (let i = 0; i < n; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let a = map.get(k); if (a === undefined) { a = acc.length; acc.push([0, 0, 0]); map.set(k, a); }
    acc[a][0] += src.getX(i); acc[a][1] += src.getY(i); acc[a][2] += src.getZ(i);
    out[i * 3] = a;
  }
  const res = new THREE.BufferGeometry();
  res.setAttribute('position', pos);
  if (g.index) res.setIndex(g.index);
  const nn = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = acc[out[i * 3]]; const l = Math.hypot(...v) || 1; nn[i * 3] = v[0] / l; nn[i * 3 + 1] = v[1] / l; nn[i * 3 + 2] = v[2] / l; }
  res.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  return res;
}

// ---------- hand-painted wood planks ----------
// rows = planks across V, grain runs along U. `bands` paints strakes: [{from, to, color}] in 0..1 V.
export function woodTexture({ base = 0x7a4a2a, w = 512, h = 256, rows = 8, seed = 3, bands = [], seams = 0x2a160b, repeat = true, nails = true, vertical = false } = {}) {
  const [c, g] = canvas(w, h); const r = rng(seed);
  const rowH = h / rows;
  for (let i = 0; i < rows; i++) {
    const y0 = i * rowH, v = (i + 0.5) / rows;
    const band = bands.find(b => v >= b.from && v < b.to);
    const col = band ? band.color : base;
    // planks of varying length along U
    let x = -r() * 120;
    while (x < w) {
      const L = 110 + r() * 170;
      const tint = (r() - 0.5) * 0.22;
      g.fillStyle = shade(col, tint); g.fillRect(x, y0, L, rowH);
      // top highlight + bottom shadow (painted bevel)
      g.fillStyle = shade(col, 0.28 + tint * 0.5); g.fillRect(x, y0 + 1, L, Math.max(2, rowH * 0.14));
      g.fillStyle = shade(col, -0.35); g.fillRect(x, y0 + rowH * 0.82, L, rowH * 0.18);
      // grain strokes
      g.strokeStyle = shade(col, -0.28); g.globalAlpha = band?.flat ? 0.12 : 0.45; g.lineWidth = 1.4;
      for (let k = 0; k < 4; k++) {
        const yy = y0 + rowH * (0.25 + r() * 0.5), a = r() * 3, f = 0.02 + r() * 0.03;
        g.beginPath(); g.moveTo(x, yy);
        for (let s = 0; s <= L; s += 8) g.lineTo(x + s, yy + Math.sin(s * f + a) * rowH * 0.08);
        g.stroke();
      }
      // knot
      if (!band?.flat && r() < 0.35) { g.globalAlpha = 0.55; g.fillStyle = shade(col, -0.4); g.beginPath(); g.ellipse(x + r() * L, y0 + rowH * (0.35 + r() * 0.3), 6 + r() * 6, 2.5 + r() * 2, 0, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      // butt seam + nails
      g.fillStyle = hex(seams); g.fillRect(x + L - 2, y0, 3, rowH);
      if (nails) { g.fillStyle = shade(col, -0.55); for (const yy of [0.3, 0.7]) { g.beginPath(); g.arc(x + L - 8, y0 + rowH * yy, 1.8, 0, 7); g.fill(); } }
      x += L;
    }
    g.fillStyle = hex(seams); g.fillRect(0, y0 + rowH - 2, w, 2.5);
  }
  // painted gold pinstripes on band edges
  for (const b of bands) if (b.stripe) { g.fillStyle = hex(b.stripe); g.fillRect(0, b.from * h - 2, w, 4); g.fillRect(0, b.to * h - 3, w, 4); }
  // weathering
  g.globalCompositeOperation = 'multiply';
  for (let k = 0; k < 18; k++) { g.globalAlpha = 0.08 + r() * 0.08; g.fillStyle = '#5a4a3a'; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 60, 6 + r() * 14, 0, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  if (vertical) { const [c2, g2] = canvas(h, w); g2.translate(h, 0); g2.rotate(Math.PI / 2); g2.drawImage(c, 0, 0); return tex(c2, { repeat }); }
  return tex(c, { repeat });
}

// ---------- cloth: panels, seams, stitching, patches, weathering, optional emblem ----------
export function clothTexture({ base = 0xe8e0c8, w = 512, h = 400, seed = 5, panels = 5, patches = 3, patchColors = null, emblem = null, emblemPad = 0.14, border = null, stripes = null } = {}) {
  const [c, g] = canvas(w, h); const r = rng(seed);
  g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
  if (stripes) { const n = stripes.n || 4; for (let i = 0; i < n; i += 2) { g.fillStyle = hex(stripes.color); g.fillRect(i * w / n, 0, w / n, h); } }
  // vertical cloth panels with soft shading
  for (let i = 0; i < panels; i++) {
    const x0 = i * w / panels, pw = w / panels;
    const grd = g.createLinearGradient(x0, 0, x0 + pw, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0.10)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.05)'); grd.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = grd; g.fillRect(x0, 0, pw, h);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x0 + pw - 2, 0, 2, h);
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.setLineDash([5, 6]); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x0 + pw - 6, 0); g.lineTo(x0 + pw - 6, h); g.stroke(); g.setLineDash([]);
  }
  // fine weave
  g.globalAlpha = 0.05; g.fillStyle = '#fff'; for (let y = 0; y < h; y += 5) g.fillRect(0, y, w, 1); g.globalAlpha = 1;
  // patches (sewn on, with stitches)
  const pc = patchColors || [shade(base, -0.15), shade(base, 0.12)];
  for (let k = 0; k < patches; k++) {
    const pw = 40 + r() * 60, ph = 30 + r() * 50, x = r() * (w - pw), y = r() * (h - ph);
    const ang = (r() - 0.5) * 0.3;
    g.save(); g.translate(x + pw / 2, y + ph / 2); g.rotate(ang);
    g.fillStyle = hex(pc[k % pc.length]); g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.strokeRect(-pw / 2, -ph / 2, pw, ph);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.setLineDash([4, 4]); g.lineWidth = 1.5; g.strokeRect(-pw / 2 + 4, -ph / 2 + 4, pw - 8, ph - 8); g.setLineDash([]);
    g.restore();
  }
  // weathering stains, darker toward the foot
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(40,30,20,0.25)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 10; k++) { g.globalAlpha = 0.06 + r() * 0.06; g.fillStyle = '#3a2e22'; g.beginPath(); g.ellipse(r() * w, r() * h, 15 + r() * 40, 8 + r() * 20, r() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  if (emblem) {
    const s = Math.min(w, h) * (1 - emblemPad * 2), ar = emblem.width / emblem.height;
    const sw = ar >= 1 ? s : s * ar, sh = ar >= 1 ? s / ar : s;
    g.drawImage(emblem, (w - sw) / 2, (h - sh) / 2, sw, sh);
  }
  // bolt-rope hem
  g.strokeStyle = hex(border || shade(base, -0.45)); g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.strokeRect(11, 11, w - 22, h - 22);
  // grommets along the head
  g.fillStyle = '#c9a25a'; for (let x = 24; x < w - 10; x += 42) { g.beginPath(); g.arc(x, 14, 4, 0, 7); g.fill(); }
  return tex(c);
}

// ---------- painted metal (iron / brass) ----------
export function metalTexture({ base = 0x2b2f36, highlight = 0x8d97a6, w = 128, h = 64, seed = 9 } = {}) {
  const [c, g] = canvas(w, h); const r = rng(seed);
  g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
  // painted highlight streak around the barrel (cylinder U wraps around)
  const grd = g.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0.0, 'rgba(0,0,0,0)'); grd.addColorStop(0.18, hex(highlight)); grd.addColorStop(0.24, hex(shade(highlight, 0.4))); grd.addColorStop(0.3, hex(highlight)); grd.addColorStop(0.45, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.8; g.fillStyle = grd; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
  for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`; g.fillRect(r() * w, r() * h, 2 + r() * 5, 1 + r() * 2); }
  return tex(c, { repeat: true, aniso: 2 });
}

// ---------- gold trim (painted, with highlight band) ----------
export function goldTexture({ base = 0xffcd77, w = 128, h = 32 } = {}) {
  const [c, g] = canvas(w, h);
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, shade(base, 0.45)); grd.addColorStop(0.35, hex(base)); grd.addColorStop(0.7, shade(base, -0.25)); grd.addColorStop(1, shade(base, -0.5));
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.55)'; for (let x = 6; x < w; x += 24) g.fillRect(x, h * 0.22, 8, 2);
  return tex(c, { repeat: true, aniso: 2 });
}

// ---------- rock (stylized strata) ----------
export function rockTexture({ base = 0x5d6670, w = 256, h = 256, seed = 13 } = {}) {
  const [c, g] = canvas(w, h); const r = rng(seed);
  g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 10 + r() * 16) {
    g.fillStyle = shade(base, (r() - 0.5) * 0.35); g.fillRect(0, y, w, 6 + r() * 14);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, w, 2);
  }
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.08})`; g.beginPath(); g.ellipse(r() * w, r() * h, 6 + r() * 18, 2 + r() * 5, r() * 3, 0, 7); g.fill(); }
  for (let k = 0; k < 14; k++) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (r() - 0.5) * 30; y += r() * 20; g.lineTo(x, y); } g.stroke(); }
  return tex(c, { repeat: true });
}
