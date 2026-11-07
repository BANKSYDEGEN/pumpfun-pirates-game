// [AAA] BANKSY t214u-t216u: the printed table felts of THE GOLDEN DOUBLOON CASINO. The Blender kit (assets/island/casino_tables*.glb) carries
// the felt tops as plain vertex-coloured cloth; this module paints each game's layout (gold rules, cream lettering, the roulette number grid)
// on a canvas once and lays it over every instanced table as one transparent decal per game (one draw call each). Crisp at any distance:
// the canvas is drawn at a fixed texels-per-metre, mipmapped + anisotropic. Sizes come from the kit's root extras 'felts' (kit frame: x,
// z = -blender y, y up; players sit on +z, the dealer on -z, so the canvas top = -z). No document / canvas (node probes) -> no felts.
import * as THREE from 'three';

export const FELT_FONT = 'Cinzel Decorative';
const FONT_URL = new URL('../../assets/fonts/CinzelDecorative-Bold.ttf', import.meta.url);
let _font = null;
export function loadFeltFont() {   // resolves when the lettering face is ready (or after 4 s / on failure: the serif fallback is used)
  if (_font) return _font;
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return (_font = Promise.resolve(false));
  const ff = new FontFace(FELT_FONT, `url(${FONT_URL.href})`, { weight: '700' });
  _font = Promise.race([ff.load().then(f => { document.fonts.add(f); return true; }), new Promise(r => setTimeout(() => r(false), 4000))]).catch(() => false);
  return _font;
}

const GOLD = '#f0cf7a', CREAM = '#f6ead0', RED = '#a8231c', INK = '#121212';
const F = (px) => `700 ${Math.round(px)}px "${FELT_FONT}", Georgia, "Times New Roman", serif`;
const FX = (px) => `700 ${Math.round(px)}px Georgia, "Times New Roman", serif`;   // digits + the multiplication sign

function canvasFor(wm, hm, ppm) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const c = document.createElement('canvas'); if (!c || !c.getContext) return null;
  c.width = Math.max(8, Math.round(wm * ppm)); c.height = Math.max(8, Math.round(hm * ppm));
  const g = c.getContext('2d'); if (!g) return null;
  return { c, g, s: c.width / wm };   // s = px per metre
}
function rrectPath(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function text(g, t, x, y, px, col = CREAM, rot = 0, font = F) { g.save(); g.translate(x, y); g.rotate(rot); g.font = font(px); g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, 0); g.restore(); }
// lettering on an arc (centre cx, cy; radius r; centred on angle a0, canvas angles: +y down). Reads left -> right along the lower arc.
function arcText(g, t, cx, cy, r, a0, px, col = CREAM) {
  g.save(); g.font = F(px); g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
  const sp = px * 0.12, ws = [...t].map(ch => g.measureText(ch).width + sp), tot = ws.reduce((a, b) => a + b, 0);
  let a = a0 + tot / 2 / r;
  for (let i = 0; i < ws.length; i++) { const da = ws[i] / r, am = a - da / 2; g.save(); g.translate(cx + r * Math.cos(am), cy + r * Math.sin(am)); g.rotate(am - Math.PI / 2); g.fillText(t[i], 0, 0); g.restore(); a -= da; }
  g.restore();
}
function diamond(g, x, y, w, h, col) { g.beginPath(); g.moveTo(x, y - h / 2); g.lineTo(x + w / 2, y); g.lineTo(x, y + h / 2); g.lineTo(x - w / 2, y); g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = GOLD; g.lineWidth = Math.max(1, h * 0.06); g.stroke(); }
function die(g, x, y, s, n, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); rrectPath(g, -s / 2, -s / 2, s, s, s * 0.18); g.fillStyle = CREAM; g.fill(); g.strokeStyle = GOLD; g.lineWidth = s * 0.05; g.stroke();
  const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
  g.fillStyle = n === 1 ? RED : INK; for (const [px, py] of P) { g.beginPath(); g.arc(px * s * 0.26, py * s * 0.26, s * 0.085, 0, 7); g.fill(); }
  g.restore();
}

// ---- BLACKJACK: the half-moon (radius r, straight dealer edge at the canvas top) ----
function drawBlackjack(f, ppm) {
  const r = f.r, K = canvasFor(2 * r, r, ppm); if (!K) return null; const { g, s } = K, cx = r * s, cy = 0, R = r * s;
  g.lineJoin = 'round';
  g.strokeStyle = GOLD; g.lineWidth = 0.012 * s; g.beginPath(); g.arc(cx, cy, R - 0.07 * s, 0, Math.PI); g.stroke();       // the gold border rule
  g.lineWidth = 0.004 * s; g.beginPath(); g.arc(cx, cy, R - 0.095 * s, 0, Math.PI); g.stroke();
  // the five betting spots on the 1.0 m arc (where the kit's chips stand), double gold rings
  for (let k = 0; k < 5; k++) { const a = Math.PI * (k + 0.5) / 5, x = cx + Math.cos(Math.PI - a) * 1.0 * s, y = cy + Math.sin(a) * 1.0 * s;
    g.lineWidth = 0.01 * s; g.beginPath(); g.arc(x, y, 0.13 * s, 0, 7); g.stroke(); g.lineWidth = 0.004 * s; g.beginPath(); g.arc(x, y, 0.105 * s, 0, 7); g.stroke(); }
  arcText(g, 'BLACKJACK PAYS 3 TO 2', cx, cy, 0.7 * s, Math.PI / 2, 0.075 * s, GOLD);
  arcText(g, 'DEALER MUST DRAW TO 16 AND STAND ON ALL 17', cx, cy, 0.56 * s, Math.PI / 2, 0.036 * s, CREAM);
  g.lineWidth = 0.008 * s; g.strokeStyle = GOLD; g.beginPath(); g.arc(cx, cy, 0.8 * s, Math.PI * 0.16, Math.PI * 0.84); g.stroke();   // the insurance line
  g.lineWidth = 0.003 * s; g.beginPath(); g.arc(cx, cy, 0.48 * s, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
  // the doubloon crest under the chip tray
  g.lineWidth = 0.006 * s; g.beginPath(); g.arc(cx, 0.36 * s, 0.07 * s, 0, 7); g.stroke(); text(g, 'GD', cx, 0.362 * s, 0.05 * s, GOLD);
  return K.c;
}

// ---- ROULETTE: the 0-36 grid + dozens + even-money bets (the wheel at +x is left bare) ----
function drawRoulette(f, ppm) {
  const hx = f.hx, hz = f.hz, K = canvasFor(2 * hx, 2 * hz, ppm); if (!K) return null; const { g, s } = K;
  const X = (x) => (x + hx) * s, Z = (z) => (z + hz) * s, REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const x0 = -hx + 0.07, xz = x0 + 0.17, wx0 = f.wheel ? f.wheel[0] - f.wheel[2] - 0.08 : hx - 0.07, cw = (wx0 - xz) / 12;
  const z0 = -hz + 0.07, rh = 0.15, zd = z0 + 3 * rh, zo = zd + 0.17, zo1 = zo + 0.2;
  g.lineJoin = 'round'; g.strokeStyle = GOLD;
  // the zero
  g.beginPath(); g.moveTo(X(xz), Z(z0)); g.lineTo(X(x0 + 0.05), Z(z0)); g.lineTo(X(x0), Z(z0 + 1.5 * rh)); g.lineTo(X(x0 + 0.05), Z(zd)); g.lineTo(X(xz), Z(zd)); g.closePath();
  g.fillStyle = 'rgba(31,154,74,0.9)'; g.fill(); g.lineWidth = 0.008 * s; g.stroke(); text(g, '0', X((x0 + xz) / 2 + 0.01), Z(z0 + 1.5 * rh), 0.085 * s, CREAM, -Math.PI / 2, FX);
  for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) {
    const n = 3 * c + (3 - r), x = X(xz + c * cw), z = Z(z0 + r * rh), w = cw * s, h = rh * s;
    g.fillStyle = REDS.has(n) ? 'rgba(168,35,28,0.92)' : 'rgba(18,18,18,0.9)'; rrectPath(g, x + 0.012 * s, z + 0.014 * s, w - 0.024 * s, h - 0.028 * s, 0.03 * s); g.fill();
    g.lineWidth = 0.006 * s; g.strokeRect(x, z, w, h);
    text(g, String(n), x + w / 2, z + h / 2 + 0.003 * s, 0.07 * s, CREAM, -Math.PI / 2, FX);
  }
  g.lineWidth = 0.01 * s; g.strokeRect(X(xz), Z(z0), 12 * cw * s, 3 * rh * s);
  const DZ = ['1st 12', '2nd 12', '3rd 12'];
  for (let d = 0; d < 3; d++) { const x = X(xz + d * 4 * cw), w = 4 * cw * s; g.lineWidth = 0.007 * s; g.strokeRect(x, Z(zd), w, (zo - zd) * s); text(g, DZ[d].toUpperCase(), x + w / 2, Z((zd + zo) / 2), 0.06 * s, CREAM); }
  const OUT = ['1 - 18', 'EVEN', 'red', 'black', 'ODD', '19 - 36'];
  for (let o = 0; o < 6; o++) { const x = X(xz + o * 2 * cw), w = 2 * cw * s, zc = Z((zo + zo1) / 2); g.lineWidth = 0.007 * s; g.strokeRect(x, Z(zo), w, (zo1 - zo) * s);
    if (OUT[o] === 'red' || OUT[o] === 'black') diamond(g, x + w / 2, zc, w * 0.55, (zo1 - zo) * s * 0.62, OUT[o] === 'red' ? RED : INK);
    else text(g, OUT[o], x + w / 2, zc, 0.055 * s, CREAM, 0, /\d/.test(OUT[o]) ? FX : F); }
  text(g, 'STRAIGHT UP 36\u00d7  \u00b7  DOZENS 3\u00d7  \u00b7  EVEN MONEY 2\u00d7', X((xz + wx0) / 2), Z(zo1 + 0.12), 0.038 * s, GOLD, 0, FX);
  // the wheel well: a gold ring round the (geometry) wheel
  if (f.wheel) { g.lineWidth = 0.01 * s; g.beginPath(); g.arc(X(f.wheel[0]), Z(f.wheel[1]), (f.wheel[2] + 0.03) * s, 0, 7); g.stroke(); }
  g.lineWidth = 0.012 * s; rrectPath(g, 0.03 * s, 0.03 * s, (2 * hx - 0.06) * s, (2 * hz - 0.06) * s, ((f.rr || 0.16) - 0.03) * s); g.stroke();
  return K.c;
}

// ---- DICE (UNDER 7 / SEVEN / OVER 7 + DOUBLES): mirrored doubles strips so both sides of the tub read upright ----
function drawDice(f, ppm) {
  const hx = f.hx, hz = f.hz, K = canvasFor(2 * hx, 2 * hz, ppm); if (!K) return null; const { g, s } = K;
  const X = (x) => (x + hx) * s, Z = (z) => (z + hz) * s; g.lineJoin = 'round'; g.strokeStyle = GOLD;
  g.lineWidth = 0.012 * s; rrectPath(g, 0.04 * s, 0.04 * s, (2 * hx - 0.08) * s, (2 * hz - 0.08) * s, ((f.rr || 0.2) - 0.04) * s); g.stroke();
  const bz0 = -0.28, bz1 = 0.28, boxes = [[-hx + 0.12, -0.42, 'UNDER 7', 'PAYS 2\u00d7'], [-0.36, 0.36, 'SEVEN', 'PAYS 4\u00d7'], [0.42, hx - 0.12, 'OVER 7', 'PAYS 2\u00d7']];
  for (const [a, b, t1, t2] of boxes) { const w = (b - a) * s, h = (bz1 - bz0) * s, x = X(a), z = Z(bz0);
    g.lineWidth = 0.01 * s; rrectPath(g, x, z, w, h, 0.06 * s); g.stroke(); g.lineWidth = 0.004 * s; rrectPath(g, x + 0.025 * s, z + 0.025 * s, w - 0.05 * s, h - 0.05 * s, 0.045 * s); g.stroke();
    const seven = t1 === 'SEVEN'; if (seven) { g.fillStyle = 'rgba(168,35,28,0.85)'; rrectPath(g, x + 0.025 * s, z + 0.025 * s, w - 0.05 * s, h - 0.05 * s, 0.045 * s); g.fill(); }
    text(g, t1, x + w / 2, z + h * 0.4, (seven ? 0.085 : 0.095) * s, seven ? CREAM : GOLD); text(g, t2, x + w / 2, z + h * 0.74, 0.05 * s, CREAM, 0, FX);  }
  for (const sd of [-1, 1]) {   // the doubles strips (the far one turned to face the far side)
    const zc = sd * (bz1 + (hz - 0.06 - bz1) / 2), rot = sd < 0 ? Math.PI : 0, x0 = X(-hx + 0.16), x1 = X(hx - 0.16), z0 = Z(zc - 0.13), z1 = Z(zc + 0.13);
    g.lineWidth = 0.007 * s; rrectPath(g, x0, z0, x1 - x0, z1 - z0, 0.05 * s); g.stroke();
    g.save(); g.translate(X(0), Z(zc)); g.rotate(rot);
    text(g, 'DOUBLES PAY 5\u00d7', 0, 0.004 * s, 0.07 * s, GOLD);
    [[1, -0.95], [1, -0.8], [6, 0.8], [6, 0.95]].forEach(([n, x]) => die(g, x * s, 0, 0.12 * s, n, 0.08 * Math.sign(x)));
    g.restore(); }
  return K.c;
}

const DRAW = { blackjack: drawBlackjack, roulette: drawRoulette, dice: drawDice };

// felts: the kit's 'felts' extras; placements: [[kind, x, z, yaw]] (the hall's building frame); returns a Group of InstancedMeshes (or null)
export function buildFelts(felts, placements, { low = false, anisotropy = 4 } = {}) {
  if (!felts || !placements?.length) return null;
  const grp = new THREE.Group(); grp.name = 'casino_felts';
  const ppm = low ? 380 : 760, m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  for (const kind of Object.keys(DRAW)) {
    const f = felts[kind], list = placements.filter(p => p[0] === kind); if (!f || !list.length) continue;
    let cv = null; try { cv = DRAW[kind](f, ppm); } catch (e) { console.warn('[casino] felt', kind, e); }
    if (!cv) continue;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = anisotropy; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const w = f.shape === 'd' ? 2 * f.r : 2 * f.hx, h = f.shape === 'd' ? f.r : 2 * f.hz, cz = f.shape === 'd' ? f.r / 2 : 0;
    const geo = new THREE.PlaneGeometry(w, h); geo.rotateX(-Math.PI / 2); geo.translate(0, f.y + 0.0015, cz);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0xd2bf98, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); mat.name = 'casino_felt_' + kind;
    const im = new THREE.InstancedMesh(geo, mat, list.length); im.name = 'casino_felt_' + kind; im.renderOrder = 1;
    list.forEach(([, x, z, yaw], i) => { q.setFromAxisAngle(up, yaw); m.compose(new THREE.Vector3(x, 0, z), q, one); im.setMatrixAt(i, m); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); grp.add(im);
  }
  return grp.children.length ? grp : null;
}
