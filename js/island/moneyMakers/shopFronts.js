import { formatGoldAmount } from '../../goldFormat.js';
// [hill-shopfronts] BANKSY "Improve those buildings and signs" -> "Give job to Timothy": the 4 money-maker rent shops (v372) dressed as
// standout buildings FITTED TO THE REAL Blender lots (assets/island/hill_street.glb, tools/hill_blender/hill_street_blender.py), not stand-in walls.
// The v373 dressing ignored the lot: its board crossed the string course / jetty, its awning + lanterns doubled the baked ones, its bracket
// sign sat 0.6 m from the baked one on L3 / R5, its wall props hung past the end of L3 / R5 or over the display windows, and the Harbor Fence
// front was never built (keyed by the buyer name 'Harbor Fence'). Now, per lot (BAKED below = the generator's numbers for that lot):
//   - a big themed FASCIA BOARD bolted on the front of the first-floor balcony (reads from down the street, above every awning / lamp)
//   - the baked blank hanging plate gets the shop's painted name on both faces (reads up + down the street)
//   - a themed striped awning ONLY where the lot has none (L1, R5), same profile as the baked ones
//   - trade dressing over the display windows (wanted posters / rum barrel ends / cutlass + shield / a hoisted contraband crate)
//   - inside: a themed counter case over the baked counter (the stand sits in / behind it, no box-in-box), a name board over the TO RENT
//     board, themed goods on the baked side shelves, side-wall banners between the ceiling beams, a rug on the walk-up spot
// Everything decorative: no colliders, nothing in the doorway prism or the door -> E spot walk lane below head height (tests/hillShopFronts.test.mjs
// checks all of that + no intersection with the lot's real LOD0 triangles). Frame: origin = door sill centre on the facade plane, local x along the
// facade (= Blender x - door xo), +z out onto the street, y up.
import * as THREE from 'three';
import { RENTABLE_SHOPS } from '../hillShops.js';
import { mat } from './props.js';

// the generator's per-lot facts (Blender lot frame; hill_street_blender.py LOTS / find_door / bracket / balcony / display windows)
export const BAKED = {
  rent_2:  { lot: 'L1', G: 5.0, jet: 0.45, bal: [-3.95, 3.95], dep: 1.1, plate: -2.75, wins: [-3.37, 3.37], awning: false, pier: -1.65, top: 8.0 },
  rent_3:  { lot: 'L2', G: 4.8, jet: 0.45, bal: [-5.52, 5.52], dep: 1.15, plate: -1.95, wins: [-3.41, 3.81], awning: true, pier: -2.91, top: 7.62 },
  rent_4:  { lot: 'L3', G: 4.6, jet: 0, bal: [-4.52, 4.52], dep: 1.3, plate: -0.95, wins: [1.71], awning: true, pier: -1.77, top: 7.7 },
  rent_16: { lot: 'R5', G: 4.6, jet: 0, bal: [-3.72, 2.92], dep: 1.3, plate: -0.25, wins: [1.26], awning: false, noAwning: true, pier: -1.77, top: 7.7 },   // its balcony knee brace drops beside the door: no room (the lot never had one)
};
export const KIND_SHOP = { wanted: 'rent_2', rum: 'rent_3', fence: 'rent_4', fight: 'rent_16' };
const OPEN_TOP = 3.4, SLOPE = 0.11;

const THEMES = {
  wanted: { panel: '#4a2218', title: 'WANTED BOARD', sub: 'BOUNTIES  ·  CONTRACTS', icon: 'skull', bg: ['#5a1a12', '#2a0a08'], ink: '#ffd75a', trim: '#d4af37', cloth: ['#8b1e1e', '#efe0b8'], wood: 0x4a2414, accent: 0x8b1e1e },
  fight:  { panel: '#2e2622', title: 'FIGHT MASTER', sub: 'PRIZE FIGHTS  ·  BETS  ·  HORDE', icon: 'swords', bg: ['#2a2a2e', '#0e0e10'], ink: '#ff5a3a', trim: '#c9c9cf', cloth: ['#141414', '#b3121a'], wood: 0x2a2220, accent: 0xb3121a },
  rum:    { panel: '#5a3418', title: 'RUM EXPORT', sub: 'FINE CARIBBEAN RUM BOUGHT HERE', icon: 'bottle', bg: ['#6a3a10', '#2e1604'], ink: '#ffd98a', trim: '#e0a640', cloth: ['#7a3a12', '#f1d9a0'], wood: 0x6a3a18, accent: 0xc77a1e },
  fence:  { panel: '#2e3238', title: 'HARBOR FENCE', sub: 'NO QUESTIONS ASKED', icon: 'crate', bg: ['#16283a', '#081018'], ink: '#9fd3ff', trim: '#8fb8d8', cloth: ['#1e3348', '#cdb98a'], wood: 0x2e3a44, accent: 0x2a6d9a },
};
const IRON = 0x2b2b2e, GOLD = 0xd4af37, GOLD_D = 0xb8892a, WOOD_D = 0x3a2410, PARCH = 0xe8d6a8;
const box = (w, h, d, c, o) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o));
const cyl = (r0, r1, h, c, n = 10, o) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, n), mat(c, o));
const at = (m, x, y, z, rx = 0, ry = 0, rz = 0, part = null) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); if (part) m.userData.part = part; return m; };
const hasDoc = () => typeof document !== 'undefined';
const canvas = (w, h) => { if (!hasDoc()) return null; const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c) => { if (!c) return null; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const faceMaterials = new WeakMap();
const face = (w, h, t, part) => { let material = t && faceMaterials.get(t); if (!material) { material = new THREE.MeshBasicMaterial(t ? { map: t, toneMapped: false } : { color: 0x553322 }); if (t) faceMaterials.set(t, material); } const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material); m.userData.part = part; return m; };
const FONT = (p) => `${p}px "Just Another Hand", Georgia, serif`;

// ---- vector icons (no emoji: phones / headless browsers draw those as tofu) ----
function icon(g, kind, x, y, s, ink) {
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100); g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'skull') { g.fillStyle = '#f3ead2'; g.beginPath(); g.arc(0, -8, 34, 0, 7); g.fill(); g.fillRect(-20, 14, 40, 22);
    g.fillStyle = '#1a0a06'; for (const sx of [-13, 13]) { g.beginPath(); g.arc(sx, -6, 10, 0, 7); g.fill(); } g.beginPath(); g.moveTo(0, 6); g.lineTo(-5, 16); g.lineTo(5, 16); g.fill();
    for (const sx of [-11, 0, 11]) g.fillRect(sx - 2, 24, 4, 12);
    g.strokeStyle = '#f3ead2'; g.lineWidth = 10; for (const a of [-1, 1]) { g.beginPath(); g.moveTo(-46 * a, 30); g.lineTo(46 * a, 52); g.stroke(); } }
  else if (kind === 'swords') { for (const a of [-1, 1]) { g.save(); g.rotate(a * 0.7); g.fillStyle = '#e6e8ee'; g.beginPath(); g.moveTo(-5, 40); g.lineTo(5, 40); g.lineTo(3, -50); g.lineTo(0, -58); g.lineTo(-3, -50); g.fill();
      g.fillStyle = ink; g.fillRect(-18, 38, 36, 7); g.fillStyle = '#6a3a1c'; g.fillRect(-4, 45, 8, 16); g.fillStyle = ink; g.beginPath(); g.arc(0, 64, 5, 0, 7); g.fill(); g.restore(); } }
  else if (kind === 'bottle') { g.fillStyle = '#3b7a3a'; g.beginPath(); g.moveTo(-8, -56); g.lineTo(8, -56); g.lineTo(8, -26); g.quadraticCurveTo(26, -16, 26, 6); g.lineTo(26, 50); g.lineTo(-26, 50); g.lineTo(-26, 6); g.quadraticCurveTo(-26, -16, -8, -26); g.fill();
    g.fillStyle = '#8a5a2a'; g.fillRect(-9, -66, 18, 12); g.fillStyle = PARCHS; g.fillRect(-20, 4, 40, 28); g.fillStyle = '#5a1a0a'; g.font = 'bold 20px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('XXX', 0, 19); }
  else if (kind === 'crate') { g.fillStyle = '#9a6b3a'; g.fillRect(-42, -36, 84, 72); g.strokeStyle = '#3a2410'; g.lineWidth = 7; g.strokeRect(-42, -36, 84, 72); g.beginPath(); g.moveTo(-42, -36); g.lineTo(42, 36); g.moveTo(42, -36); g.lineTo(-42, 36); g.stroke();
    g.fillStyle = ink; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill(); g.fillStyle = '#0b1520'; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill(); }
  g.restore();
}
const PARCHS = '#efe0b8';
const shade = (hex) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(v * 0.55); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
function grain(g, w, h) {   // planks, long grain streaks, knots, edge wear (deterministic)
  let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const pl = 5; for (let i = 1; i < pl; i++) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * h / pl - 1.5, w, 3); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, i * h / pl + 1.5, w, 1.5); }
  for (let i = 0; i < w * h / 900; i++) { const y = rnd() * h, x = rnd() * w, L = 30 + rnd() * w * 0.25; g.strokeStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,230,190'},${0.03 + rnd() * 0.06})`; g.lineWidth = 1 + rnd() * 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L / 2, y + (rnd() - 0.5) * 6, x + L, y + (rnd() - 0.5) * 4); g.stroke(); }
  for (let i = 0; i < 4; i++) { const x = rnd() * w, y = rnd() * h, r = 4 + rnd() * h * 0.03; g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y, r * 2.2, r, 0, 0, 7); g.fill(); }
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.65); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = v; g.fillRect(0, 0, w, h); }
// the big boards: plank seams, double gold frame, corner rivets, the title fitted, an icon each end (wide) or on top (square-ish)
const boardTextures = new Map();
function boardTex(T, w, h, { sub = true } = {}) {
  const key = JSON.stringify([T, w, h, sub]); if (boardTextures.has(key)) return boardTextures.get(key);
  const c = canvas(w, h); if (!c) return null; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, T.bg[0]); gr.addColorStop(1, T.bg[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  grain(g, w, h);
  const m = Math.round(h * 0.05), fg = g.createLinearGradient(0, 0, 0, h); fg.addColorStop(0, '#fff0b0'); fg.addColorStop(0.5, T.trim); fg.addColorStop(1, shade(T.trim)); g.strokeStyle = fg; g.lineWidth = m; g.strokeRect(m, m, w - 2 * m, h - 2 * m);
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.strokeRect(m * 2.2, m * 2.2, w - m * 4.4, h - m * 4.4);
  for (const [x, y] of [[m * 1.6, m * 1.6], [w - m * 1.6, m * 1.6], [m * 1.6, h - m * 1.6], [w - m * 1.6, h - m * 1.6]]) { g.fillStyle = T.trim; g.beginPath(); g.arc(x, y, m * 0.55, 0, 7); g.fill(); }
  const wide = w / h > 2.4; g.textAlign = 'center'; g.textBaseline = 'middle';
  let px = Math.round(h * (wide ? (sub ? 0.5 : 0.62) : 0.36)); g.font = FONT(px); const maxW = w * (wide ? 0.68 : 0.86);
  while (px > 16 && g.measureText(T.title).width > maxW) { px -= 3; g.font = FONT(px); }
  const ty = wide ? h * (sub ? 0.42 : 0.52) : h * 0.66;
  g.lineWidth = Math.max(4, px * 0.1); g.strokeStyle = 'rgba(0,0,0,.9)'; g.strokeText(T.title, w / 2 + px * 0.03, ty + px * 0.04);   // carved shadow
  const tg = g.createLinearGradient(0, ty - px / 2, 0, ty + px / 2); tg.addColorStop(0, '#fff6c8'); tg.addColorStop(0.45, T.ink); tg.addColorStop(1, shade(T.ink)); g.fillStyle = tg; g.fillText(T.title, w / 2, ty);
  g.lineWidth = Math.max(1, px * 0.02); g.strokeStyle = 'rgba(255,255,230,.55)'; g.strokeText(T.title, w / 2 - 1, ty - 1);
  if (wide) { const s = h * 0.62; icon(g, T.icon, h * 0.5, h * 0.5, s, T.ink); icon(g, T.icon, w - h * 0.5, h * 0.5, s, T.ink);
    if (sub) { g.font = `bold ${Math.round(h * 0.13)}px Georgia, serif`; g.fillStyle = '#f3e3bf'; g.fillText(T.sub, w / 2, h * 0.8); } }
  else icon(g, T.icon, w / 2, h * 0.3, h * 0.36, T.ink);
  const texture = tex(c); boardTextures.set(key, texture); return texture;
}
function stripeTex(a, b) { const c = canvas(256, 16); if (!c) return null; const g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 32, 0, 32, 16); } const t = tex(c); t.wrapS = THREE.RepeatWrapping; return t; }
function posterTex(i) { const c = canvas(128, 170); if (!c) return null; const g = c.getContext('2d');
  g.fillStyle = PARCHS; g.fillRect(0, 0, 128, 170); g.strokeStyle = '#6a4a22'; g.lineWidth = 3; g.strokeRect(4, 4, 120, 162);
  g.fillStyle = '#3a1c08'; g.font = 'bold 24px Georgia'; g.textAlign = 'center'; g.fillText('WANTED', 64, 30);
  g.fillStyle = '#6a4a2c'; g.beginPath(); g.arc(64, 80, 28, 0, 7); g.fill(); g.fillStyle = PARCHS; g.fillRect(48, 72, 10, 7); g.fillRect(70, 72, 10, 7); g.fillStyle = '#3a1c08'; g.fillRect(46, 92, 36, 5);
  g.fillStyle = '#8b1e1e'; g.font = 'bold 19px Georgia'; g.fillText('REWARD', 64, 128); g.fillText(`${formatGoldAmount([500, 1000, 2500, 750][i % 4])} GOLD`, 64, 152); return tex(c); }

// ---- the per-shop frame (front-local) from hillShops.js + BAKED ----
export function shopFrame(id) {
  const S = RENTABLE_SHOPS.find(r => r.id === id), B = BAKED[id]; if (!S || !B) return null;
  const f = Math.sin(S.facing) >= 0 ? 1 : -1, I = S.interior, xo = -f * (S.door.lz - S.lz), g = SLOPE * f, off = g * xo;
  const X = (lz) => -f * (lz - S.door.lz), Z = (lx) => f * (lx - S.door.lx), LZ = (x) => S.door.lz - f * x;
  const floorAt = (x) => { const lz = LZ(x); return I.floorY.atLz0 + (lz - I.lz0) / (I.lz1 - I.lz0) * (I.floorY.atLz1 - I.floorY.atLz0) - S.doorY; };
  const xa = Math.min(X(I.lz0), X(I.lz1)), xb = Math.max(X(I.lz0), X(I.lz1)), back = Math.min(Z(I.lx0), Z(I.lx1)), cx = (xa + xb) / 2;
  const L = (x) => x - xo, Y = (z) => z - off;   // Blender lot x -> local x, lot height -> local y
  const stand = { x: X(S.lz), z: back + 1.5 }, spot = { x: stand.x, z: back + 1.5 + 1.6 };
  return { id, S, B, f, xo, g, off, X, Z, L, Y, floorAt, d: S.d, doorW: S.doorW,
    room: { xa, xb, back, front: -0.5, cx }, counter: { x: cx, z: back + 1.4, w: Math.min(4.2, (xb - xa) * 0.6), d: 0.9, top: 1.17 },
    stand, spot, G: Y(B.G), bal: { x0: L(B.bal[0]), x1: L(B.bal[1]), out: B.jet + B.dep }, plate: { x: L(B.plate), y: Y(3.35), z: 1.08 },
    wins: B.wins.map(L), openTop: Y(OPEN_TOP), blade: (() => { const yt = Y(B.top) - 0.22, yb = Y(B.G + 1.15), Ht = Math.min(1.55, yt - yb - 0.02); return { x: L(B.pier), y: Math.min(Y(B.G) + 2.15, yt - Ht / 2), Ht, z: B.jet + 1.05, wall: B.jet + (B.jet ? 0.2 : 0.1) }; })() };
}

// ---- facade parts ----
function fascia(F, T, g) {   // the big board on the balcony front
  const W = Math.min(4.8, F.bal.x1 - F.bal.x0 - 0.5), x = Math.min(Math.max(0, F.bal.x0 + W / 2 + 0.2), F.bal.x1 - W / 2 - 0.2), y = F.G + 0.4, z = F.bal.out + 0.12;
  g.add(at(box(W + 0.16, 1.2, 0.1, T.wood), x, y, z, 0, 0, 0, 'fascia'));
  g.add(at(face(W, 1.06, boardTex(T, 2048, 448)), x, y, z + 0.052, 0, 0, 0, 'fascia_face'));
  for (const s of [-1, 1]) g.add(at(box(W + 0.24, 0.07, 0.13, GOLD), x, y + s * 0.6, z + 0.01, 0, 0, 0, 'fascia_trim'));
  for (const s of [-1, 1]) { g.add(at(cyl(0.12, 0.12, 0.06, GOLD, 12), x + s * (W / 2 + 0.02), y, z + 0.08, Math.PI / 2, 0, 0, 'fascia_boss'));
    g.add(at(cyl(0.05, 0.05, W + 0.2, GOLD_D, 8), x, y + s * 0.53, z + 0.07, 0, 0, Math.PI / 2, 'fascia_moulding'));   // carved half-round gilt moulding
    // goose-neck sign lamps washing the board
    const lx = x + s * W * 0.3; g.add(at(box(0.04, 0.04, 0.42, IRON), lx, y + 0.66, z + 0.2, 0, 0, 0, 'sign_lamp')); g.add(at(cyl(0.04, 0.14, 0.12, IRON, 8), lx, y + 0.64, z + 0.42, 0, 0, 0, 'sign_lamp'));
    g.add(at(cyl(0.06, 0.06, 0.04, 0xfff0c0, 8, { emissive: 0xffc060, emissiveIntensity: 1.5 }), lx, y + 0.57, z + 0.42, 0, 0, 0, 'sign_lamp')); const gw = glow(1.3); gw.position.set(lx, y + 0.5, z + 0.4); g.add(gw); }
  return { x, W, y, z };
}
function blade(F, T, g) {   // the big projecting blade sign on the upper storey (2 lines, both faces), reads from far down the street
  const B = F.blade, Wd = 1.5, Ht = B.Ht, z = B.z;
  g.add(at(box(0.12, Ht + 0.12, Wd + 0.12, T.wood), B.x, B.y, z, 0, 0, 0, 'blade'));
  for (const sy of [-1, 1]) g.add(at(box(0.16, 0.07, Wd + 0.12, GOLD_D), B.x, B.y + sy * (Ht / 2 + 0.06), z, 0, 0, 0, 'blade_trim'));
  const t = bladeTex(T); for (const s of [-1, 1]) g.add(at(face(Wd - 0.08, Ht - 0.08, t, 'blade_face'), B.x + s * 0.062, B.y, z, 0, s * Math.PI / 2, 0));
  const top = B.y + Ht / 2 + 0.16; const a0 = B.wall, a1 = z + Wd / 2; g.add(at(box(0.06, 0.06, a1 - a0, IRON), B.x, top, (a0 + a1) / 2, 0, 0, 0, 'blade_arm'));   // wall arm + scroll stay
  g.add(at(box(0.05, 0.05, 0.7, IRON), B.x, top - 0.26, a0 + 0.27, -0.85, 0, 0, 'blade_arm'));
  for (const dz of [-Wd * 0.36, Wd * 0.36]) g.add(at(box(0.03, 0.1, 0.03, IRON), B.x, top - 0.08, z + dz, 0, 0, 0, 'blade_arm'));
  g.add(at(cyl(0.06, 0.06, 0.1, GOLD, 8), B.x, top, a1 + 0.05, Math.PI / 2, 0, 0, 'blade_arm')); }
function bladeTex(T) { const c = canvas(768, 800); if (!c) return null; const g = c.getContext('2d'), w = 768, h = 800;
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, T.bg[0]); gr.addColorStop(1, T.bg[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h); grain(g, w, h);
  const fg = g.createLinearGradient(0, 0, 0, h); fg.addColorStop(0, '#fff0b0'); fg.addColorStop(0.5, T.trim); fg.addColorStop(1, shade(T.trim)); g.strokeStyle = fg; g.lineWidth = 26; g.strokeRect(18, 18, w - 36, h - 36); g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeRect(52, 52, w - 104, h - 104);
  icon(g, T.icon, w / 2, 190, 230, T.ink); const words = T.title.split(' '); g.textAlign = 'center'; g.textBaseline = 'middle';
  words.forEach((wd, i) => { let px = 220; g.font = FONT(px); while (g.measureText(wd).width > w * 0.82) { px -= 6; g.font = FONT(px); } const y = 420 + i * 200;
    g.lineWidth = 14; g.strokeStyle = 'rgba(0,0,0,.9)'; g.strokeText(wd, w / 2 + 6, y + 8); const tg = g.createLinearGradient(0, y - px / 2, 0, y + px / 2); tg.addColorStop(0, '#fff6c8'); tg.addColorStop(0.45, T.ink); tg.addColorStop(1, shade(T.ink)); g.fillStyle = tg; g.fillText(wd, w / 2, y); });
  return tex(c); }
function plateFaces(F, T, g) {   // paint both faces of the baked hanging plate (1.4 out x 0.8 tall, 0.12 thick, between its rails)
  const t = boardTex(T, 1024, 544, { sub: false });
  for (const s of [-1, 1]) g.add(at(face(1.26, 0.66, t, 'plate_face'), F.plate.x + s * 0.068, F.plate.y, F.plate.z, 0, s * Math.PI / 2, 0));
}
function awning(F, T, g) {   // only on lots without a baked one: same profile (0 -> 1.6 m out, top +0.95 -> +0.15 over the opening)
  const aw = Math.min(F.doorW + 0.7, 3.1), y0 = Math.min(F.openTop + 0.95, F.Y(F.B.G - 0.5)), y1 = F.openTop + 0.15, a = Math.atan2(y0 - y1, 1.6);
  const z0 = y0 < F.openTop + 0.9 ? 0.4 : 0.1, L = Math.hypot(1.6 - z0, (y0 - y1) * (1.6 - z0) / 1.6), ym = y1 + (y0 - y1) * (1.6 - (z0 + 1.6) / 2) / 1.6, zm = (z0 + 1.6) / 2;   // under a low balcony: start past the keystone
  const st = stripeTex(...T.cloth); if (st) st.repeat.set(aw / 0.5, 1);
  const cl = new THREE.Mesh(new THREE.PlaneGeometry(aw, L), new THREE.MeshLambertMaterial(st ? { map: st, side: THREE.DoubleSide } : { color: T.accent, side: THREE.DoubleSide }));
  g.add(at(cl, 0, ym, zm, -Math.PI / 2 + a, 0, 0, 'awning'));   // starts off the wall (clear of the voussoirs / keystone)
  const n = Math.round(aw / 0.32); for (let i = 0; i < n; i++) { const tri = new THREE.Mesh(new THREE.ConeGeometry(aw / n / 2, 0.26, 3), mat(i % 2 ? T.cloth[1] : T.cloth[0], { side: THREE.DoubleSide }));
    tri.scale.z = 0.05; g.add(at(tri, -aw / 2 + (i + 0.5) * aw / n, y1 - 0.13, 1.63, Math.PI, 0, 0, 'awning_valance')); }
  for (const s of [-1, 1]) g.add(at(box(0.04, 0.04, L, IRON), s * (aw / 2 + 0.03), ym - 0.04, zm, a, 0, 0, 'awning_stay'));
}
function windowDressing(kind, F, T, g) {
  const cap = F.Y(F.B.G - 0.48), y0 = F.Y(3.45);   // between the window head (lot 3.38) and the balcony joists / jetty (lot G - 0.44)
  for (const wx of F.wins) {
    if (kind === 'wanted') { g.add(at(box(1.1, Math.min(0.86, cap - y0 - 0.04), 0.05, 0x5a3a1c), wx, y0 + 0.45, 0.11, 0, 0, 0, 'win_board'));
      for (let i = 0; i < 2; i++) { const p = face(0.42, 0.56, posterTex(i + (wx > 0 ? 2 : 0)), 'win_poster'); g.add(at(p, wx - 0.24 + i * 0.48, y0 + 0.45, 0.14, 0, 0, (i ? -1 : 1) * 0.06)); } }
    else if (kind === 'rum') { g.add(at(box(1.0, 0.06, 0.4, WOOD_D), wx, y0 + 0.04, 0.3, 0, 0, 0, 'win_shelf'));
      for (const [dx, dy] of [[-0.24, 0.27], [0.24, 0.27], [0, 0.66]]) { if (y0 + dy + 0.2 > cap) continue; g.add(at(cyl(0.19, 0.19, 0.32, 0x7a4a24, 14), wx + dx, y0 + dy, 0.31, Math.PI / 2, 0, 0, 'win_keg'));
        g.add(at(cyl(0.2, 0.2, 0.03, IRON, 14), wx + dx, y0 + dy, 0.48, Math.PI / 2, 0, 0, 'win_keg')); g.add(at(cyl(0.06, 0.06, 0.04, 0xc8a050, 8), wx + dx, y0 + dy - 0.1, 0.51, Math.PI / 2, 0, 0, 'win_tap')); } }
    else if (kind === 'fight') { const cy = (y0 + cap) / 2, k = Math.min(1, (cap - y0) / 0.82);
      for (const s of [-1, 1]) { const b = new THREE.Group(); b.add(at(box(0.07, 1.0, 0.025, 0xd9dde4), 0, 0.2, 0)); b.add(at(box(0.3, 0.06, 0.05, GOLD), 0, -0.32, 0)); b.add(at(box(0.06, 0.22, 0.06, WOOD_D), 0, -0.46, 0));
        b.traverse(o => { if (o.isMesh) o.userData.part = 'win_cutlass'; }); b.scale.setScalar(k); g.add(at(b, wx, cy, 0.11, 0, 0, s * 0.62)); }
      g.add(at(cyl(0.3 * k, 0.3 * k, 0.07, T.accent, 18), wx, cy, 0.19, Math.PI / 2, 0, 0, 'win_shield')); g.add(at(cyl(0.1, 0.1, 0.06, GOLD, 12), wx, cy, 0.24, Math.PI / 2, 0, 0, 'win_shield')); }
    else if (kind === 'fence') { g.add(at(box(1.1, 0.3, 0.05, WOOD_D), wx, y0 + 0.2, 0.11, 0, 0, 0, 'win_plank'));
      g.add(at(face(1.02, 0.24, boardTex({ ...T, title: 'NO QUESTIONS', sub: '' }, 512, 120, { sub: false }), 'win_plank_face'), wx, y0 + 0.2, 0.14));
      // a contraband crate hoisted on a rope under the balcony (between its joists), bottom well over head height
      const rx = wx + 0.37, top = F.G - 0.2, cyB = F.Y(3.6);   // crate top lot 4.1 < the joists (G - 0.38)
      g.add(at(cyl(0.015, 0.015, top - (cyB + 0.55), 0xb59a64, 5), rx, (top + cyB + 0.55) / 2, 0.9, 0, 0, 0, 'hoist_rope'));
      g.add(at(box(0.55, 0.5, 0.55, 0x8b5a2b), rx, cyB + 0.25, 0.9, 0, 0.3, 0, 'hoist_crate')); g.add(at(box(0.58, 0.07, 0.58, IRON), rx, cyB + 0.25, 0.9, 0, 0.3, 0, 'hoist_crate')); }
  }
}

function pierBanner(F, T, g) {   // a tall Fight Master banner flat on the pier between the door jamb and the display window (over the street crate)
  const a = F.doorW / 2 + 0.3, w = F.wins.filter(x => x > 0).sort((p, q) => p - q)[0]; if (w === undefined) return; const b = w - 0.68, W = Math.min(0.72, b - a - 0.06); if (W < 0.4) return;
  g.add(at(box(W + 0.1, 0.05, 0.05, WOOD_D), (a + b) / 2, 2.62, 0.1, 0, 0, 0, 'pier_rod')); g.add(at(face(W, 1.3, bannerTex(T), 'pier_banner'), (a + b) / 2, 1.93, 0.11)); }
function panelTex(T) { const c = canvas(512, 212); if (!c) return null; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 212); gr.addColorStop(0, T.bg[0]); gr.addColorStop(1, T.bg[1]); g.fillStyle = gr; g.fillRect(0, 0, 512, 212); grain(g, 512, 212);
  g.strokeStyle = T.trim; g.lineWidth = 8; g.strokeRect(10, 10, 492, 192); for (const x of [128, 384]) icon(g, T.icon, x, 106, 110, T.ink); return tex(c); }
let PLK = null; function planksTex() { if (PLK) return PLK; const c = canvas(512, 212); if (!c) return null; const g = c.getContext('2d'); g.fillStyle = '#7a5434'; g.fillRect(0, 0, 512, 212);
  for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + (i % 3) * 0.05})`; g.fillRect(i * 64, 0, 64, 212); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(i * 64, 0, 3, 212); } grain(g, 512, 212); return (PLK = tex(c)); }
function crestTex(T) { const c = canvas(128, 128); if (!c) return null; const g = c.getContext('2d'); g.fillStyle = T.bg[1]; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); icon(g, T.icon, 64, 64, 90, T.ink); return tex(c); }
let GL = null; const glowMat = () => GL || (GL = new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
function glowTex() { const c = canvas(64, 64); if (!c) return null; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(255,214,140,1)'); r.addColorStop(0.35, 'rgba(255,170,70,.4)'); r.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return tex(c); }
const glow = (s) => { const sp = new THREE.Sprite(glowMat()); sp.scale.set(s, s, 1); sp.userData.part = 'glow'; return sp; };
function lamp(col) { const g = new THREE.Group(); g.add(at(cyl(0.012, 0.012, 0.45, IRON, 4), 0, 0.415, 0, 0, 0, 0, 'lamp')); g.add(at(cyl(0.05, 0.2, 0.14, IRON, 8), 0, 0.16, 0, 0, 0, 0, 'lamp'));
  g.add(at(cyl(0.13, 0.11, 0.24, col, 8, { emissive: 0xff9a2a, emissiveIntensity: 1.3 }), 0, -0.04, 0, 0, 0, 0, 'lamp')); g.add(at(cyl(0.15, 0.15, 0.04, IRON, 8), 0, -0.17, 0, 0, 0, 0, 'lamp')); const gw = glow(1.4); gw.position.y = -0.04; g.add(gw); return g; }
function sconce(s) { const g = new THREE.Group(); g.add(at(box(0.04, 0.3, 0.16, IRON), 0, 0, 0, 0, 0, 0, 'sconce')); g.add(at(box(0.22, 0.04, 0.04, IRON), s * 0.11, -0.05, 0, 0, 0, 0, 'sconce'));
  g.add(at(cyl(0.035, 0.04, 0.16, 0xf3ead2, 6), s * 0.2, 0.04, 0, 0, 0, 0, 'sconce')); g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 5), mat(0xffd27a, { emissive: 0xffa040, emissiveIntensity: 1.5 })), s * 0.2, 0.16, 0, 0, 0, 0, 'sconce'));
  const gw = glow(0.9); gw.position.set(s * 0.2, 0.16, 0); g.add(gw); return g; }
// ======================= [hill-shopfronts v3] FITTED INTERIORS (BANKSY "incorporate them into building, doesn't need to have stands like that") =======================
// The freestanding v349 stall props are NOT built in these four shops any more (index.js): the business is part of the room.
// Each room = one built-in joinery run against the back wall, fitted between the baked corner posts, from the floor up to the ceiling beams:
//   plinth + carcass + cornice (one textured carcass face per shop: panelling / shelving / grilles painted in one canvas, not dozens of primitives)
//   + a FITTED service counter projecting from that joinery (returns tie it back to the cabinetry: no box standing in the room), wrapping the
//   baked lot counter, + the shop's ONE carved name plate on the cornice. Theme centrepieces are part of the joinery:
//   wanted = a framed, wall-mounted bounty board (the live posters) · rum = back bar with bottle shelves over a cask cellar rack
//   fence = iron-grilled secured display + a grille service window on the counter · fight = weapon wall + the horde gong + the booking slate
// Floors slope 0.11 m/m along the room; the joinery is flat-topped to the flat ceiling and its plinth runs down under the floor.
const DARK = 0x2a1a10;
function joinTex(kind, T, w, h) {   // the carcass face: frame-and-panel joinery with themed bays, drawn once (w x h metres -> 160 px/m)
  const s = 128, c = canvas(Math.round(w * s), Math.round(h * s)); if (!c) return null; const g = c.getContext('2d'), W = c.width, H = c.height;
  const wood = T.panel || '#5a3620'; g.fillStyle = wood; g.fillRect(0, 0, W, H); grain(g, W, H);
  const bays = Math.max(3, Math.round(w / 1.15)), bw = W / bays, plinth = 0.18 * s, rail = 0.09 * s;
  for (let i = 0; i < bays; i++) { const x0 = i * bw;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x0, 0, 0.05 * s, H);                               // stile shadow
    g.fillStyle = 'rgba(255,230,190,.08)'; g.fillRect(x0 + 0.05 * s, 0, 0.02 * s, H);
    // lower doors (raised panels) up to counter height, open shelving / themed bay above
    const yDoor = H - 1.05 * s; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 0.03 * s; g.strokeRect(x0 + 0.12 * s, yDoor + 0.1 * s, bw - 0.24 * s, H - yDoor - plinth - 0.18 * s);
    g.strokeStyle = 'rgba(255,230,190,.12)'; g.lineWidth = 0.012 * s; g.strokeRect(x0 + 0.17 * s, yDoor + 0.15 * s, bw - 0.34 * s, H - yDoor - plinth - 0.28 * s);
    g.fillStyle = '#c9a050'; g.beginPath(); g.arc(x0 + bw - 0.2 * s, yDoor + 0.45 * s, 0.025 * s, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0, yDoor - rail, bw, rail);
    bay(g, kind, T, x0 + 0.08 * s, 0.32 * s, bw - 0.16 * s, yDoor - rail - 0.4 * s, i, s); }
  g.fillStyle = '#1a0e06'; g.fillRect(0, H - plinth, W, plinth); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, W, 0.06 * s);
  return tex(c);
}
function bay(g, kind, T, x, y, w, h, i, s) {   // one upper bay of the joinery
  g.fillStyle = 'rgba(10,5,2,.55)'; g.fillRect(x, y, w, h);
  const shelves = Math.max(2, Math.round(h / (0.42 * s)));
  for (let k = 1; k <= shelves; k++) { const yy = y + k * h / shelves; g.fillStyle = '#3a2412'; g.fillRect(x - 2, yy - 0.04 * s, w + 4, 0.04 * s); g.fillStyle = 'rgba(255,220,170,.15)'; g.fillRect(x, yy - 0.04 * s, w, 2);
    const y0 = yy - 0.04 * s, n = Math.floor(w / (0.11 * s)); let sd = i * 31 + k * 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let j = 0; j < n; j++) { const cx = x + (j + 0.5) * w / n;
      if (kind === 'rum') { const hh = (0.2 + rnd() * 0.08) * s, ww = 0.07 * s; g.fillStyle = ['#2f6a34', '#6a2a12', '#24506e', '#3a2008', '#7a5a1a'][Math.floor(rnd() * 5)];
        g.fillRect(cx - ww / 2, y0 - hh, ww, hh * 0.72); g.fillRect(cx - ww / 5, y0 - hh, ww / 2.5, hh); g.fillStyle = '#e8d6a8'; g.fillRect(cx - ww / 2 + 2, y0 - hh * 0.45, ww - 4, hh * 0.18); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(cx - ww / 2 + 2, y0 - hh * 0.7, 2, hh * 0.5); }
      else if (kind === 'wanted') { if (rnd() < 0.55) { g.fillStyle = '#e8d6a8'; g.beginPath(); g.arc(cx, y0 - 0.06 * s, 0.045 * s, 0, 7); g.fill(); g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.arc(cx, y0 - 0.06 * s, 0.025 * s, 0, 7); g.stroke(); }
        else { g.fillStyle = '#d8c494'; g.fillRect(cx - 0.05 * s, y0 - 0.05 * s, 0.1 * s, 0.05 * s); } }
      else if (kind === 'fence') { if (j % 2) continue; const bw2 = 0.17 * s, bh = (0.12 + rnd() * 0.06) * s; g.fillStyle = rnd() < 0.5 ? '#6a4020' : '#4a3018'; g.fillRect(cx - bw2 / 2, y0 - bh, bw2, bh); g.fillStyle = '#b8892a'; g.fillRect(cx - bw2 / 2, y0 - bh * 0.6, bw2, 3); g.fillRect(cx - 2, y0 - bh * 0.6, 4, bh * 0.4);
        if (rnd() < 0.4) { g.fillStyle = '#ffd04a'; for (let q = 0; q < 4; q++) { g.beginPath(); g.ellipse(cx - bw2 / 3 + q * bw2 / 5, y0 - bh - 2, 0.02 * s, 0.008 * s, 0, 0, 7); g.fill(); } } }
      else if (kind === 'fight') { if (j % 3) continue; g.fillStyle = '#9aa0a8'; g.beginPath(); g.arc(cx, y0 - 0.1 * s, 0.09 * s, Math.PI, 0); g.fill(); g.fillRect(cx - 0.02 * s, y0 - 0.1 * s, 0.04 * s, 0.08 * s); } } }
  if (kind === 'fence') { g.strokeStyle = '#1c1c20'; g.lineWidth = 0.022 * s; for (let gx = x; gx <= x + w; gx += 0.1 * s) { g.beginPath(); g.moveTo(gx, y); g.lineTo(gx, y + h); g.stroke(); }   // iron grille doors
    for (const gy of [y + 0.05 * s, y + h / 2, y + h - 0.05 * s]) { g.lineWidth = 0.035 * s; g.beginPath(); g.moveTo(x, gy); g.lineTo(x + w, gy); g.stroke(); }
    g.fillStyle = '#b8892a'; g.fillRect(x + w / 2 - 0.05 * s, y + h / 2 - 0.07 * s, 0.1 * s, 0.14 * s); g.fillStyle = '#1c1c20'; g.fillRect(x + w / 2 - 0.012 * s, y + h / 2 - 0.03 * s, 0.024 * s, 0.05 * s); }
  g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 0.04 * s; g.strokeRect(x, y, w, h);
}
function counterTex(kind, T, w) {   // the counter front: raised and fielded panels with a carved frieze (no text)
  const s = 128, c = canvas(Math.round(w * s), Math.round(1.1 * s)); if (!c) return null; const g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = T.panel || '#5a3620'; g.fillRect(0, 0, W, H); grain(g, W, H); const n = Math.max(3, Math.round(w / 0.9)), pw = W / n;
  for (let i = 0; i < n; i++) { const x = i * pw; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, 0, 0.05 * s, H);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 6; g.strokeRect(x + 0.12 * s, 0.26 * s, pw - 0.24 * s, H - 0.5 * s); g.strokeStyle = 'rgba(255,230,190,.14)'; g.lineWidth = 2; g.strokeRect(x + 0.17 * s, 0.31 * s, pw - 0.34 * s, H - 0.6 * s);
    if (kind === 'fence') { g.fillStyle = '#2a2a2e'; g.fillRect(x, 0.5 * s, pw, 0.06 * s); for (const rx of [x + 0.2 * s, x + pw - 0.2 * s]) { g.fillStyle = '#4a4a50'; g.beginPath(); g.arc(rx, 0.53 * s, 0.03 * s, 0, 7); g.fill(); } }
    else { g.save(); g.globalAlpha = 0.5; icon(g, T.icon, x + pw / 2, H * 0.55, 0.32 * s, T.trim); g.restore(); } }
  g.fillStyle = T.trim; g.fillRect(0, 0.1 * s, W, 0.04 * s); g.fillStyle = '#120a04'; g.fillRect(0, H - 0.14 * s, W, 0.14 * s); return tex(c);
}
function plaqueTex(T) {   // the one carved + gilded name plate inside
  const c = canvas(1024, 200); if (!c) return null; const g = c.getContext('2d'); g.fillStyle = '#2a1608'; g.fillRect(0, 0, 1024, 200); grain(g, 1024, 200);
  const fg = g.createLinearGradient(0, 0, 0, 200); fg.addColorStop(0, '#fff0b0'); fg.addColorStop(0.5, T.trim); fg.addColorStop(1, shade(T.trim)); g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(10, 10, 1004, 180);
  icon(g, T.icon, 90, 100, 120, T.ink); icon(g, T.icon, 934, 100, 120, T.ink); let px = 130; g.font = FONT(px); g.textAlign = 'center'; g.textBaseline = 'middle'; while (g.measureText(T.title).width > 700) { px -= 4; g.font = FONT(px); }
  g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.9)'; g.strokeText(T.title, 515, 108); const tg = g.createLinearGradient(0, 40, 0, 160); tg.addColorStop(0, '#fff6c8'); tg.addColorStop(0.5, T.ink); tg.addColorStop(1, shade(T.ink)); g.fillStyle = tg; g.fillText(T.title, 512, 104); return tex(c);
}
function posterCanvasTex(row, i) {   // the live bounty posters on the wanted board (name + pot) or the standing contracts
  const c = canvas(200, 260); if (!c) return null; const g = c.getContext('2d'); g.fillStyle = '#ead7a6'; g.fillRect(0, 0, 200, 260); grain(g, 200, 260);
  g.strokeStyle = '#6a4a22'; g.lineWidth = 4; g.strokeRect(6, 6, 188, 248); g.textAlign = 'center'; g.fillStyle = '#5a0e0e'; g.font = 'bold 34px Georgia'; g.fillText(row ? 'WANTED' : 'CONTRACT', 100, 44);
  g.fillStyle = '#4a3420'; g.beginPath(); g.arc(100, 112, 40, 0, 7); g.fill(); g.fillStyle = '#ead7a6'; g.fillRect(78, 102, 14, 9); g.fillRect(108, 102, 14, 9);
  g.fillStyle = '#2a1608'; g.font = 'bold 24px Georgia'; g.fillText(row ? String(row.name).slice(0, 12).toUpperCase() : ['RAIDERS', 'STALKERS', 'CAPTAINS'][i], 100, 190);
  g.fillStyle = '#7a5a00'; g.font = 'bold 28px Georgia'; g.fillText(row ? `${formatGoldAmount((row.pot | 0))}g` : ['150g', '120g', '250g'][i], 100, 232); return tex(c);
}
function interior(kind, F, T, g) {
  const R = F.room, C = F.counter, fy = F.floorAt, api = {};
  const x0 = R.xa + 0.27, x1 = R.xb - 0.27, jw = x1 - x0, jx = (x0 + x1) / 2, top = F.G - 0.62, lo = Math.min(fy(R.xa), fy(R.xb)) - 0.35, jh = top - lo;
  const zj0 = R.back + 0.06, zj1 = R.back + 0.62, jd = zj1 - zj0, jz = (zj0 + zj1) / 2;   // the joinery depth (covers the TO RENT board, 0.16 m)
  // ---- back-wall joinery: carcass, textured face, cornice + frieze, pilasters at the bay ends of the counter
  g.add(at(box(jw, jh, jd, DARK), jx, lo + jh / 2, jz, 0, 0, 0, 'join_body'));
  g.add(at(face(jw, jh, joinTex(kind, T, jw, jh), 'join_face'), jx, lo + jh / 2, zj1 + 0.004));
  g.add(at(box(jw + 0.1, 0.16, jd + 0.14, 0x3a2412), jx, top - 0.08, jz + 0.07, 0, 0, 0, 'join_cornice'));
  g.add(at(box(jw + 0.04, 0.05, jd + 0.1, GOLD_D), jx, top - 0.2, jz + 0.05, 0, 0, 0, 'join_cornice'));
  // ---- the fitted counter: wraps the baked counter, returns run back into the joinery (no freestanding box), dark top with a brass nosing
  const cw = C.w + 0.36, cz0 = zj1, cz1 = C.z + 0.62, cd = cz1 - cz0, cTop = fy(C.x) + 1.2, cBot = lo;
  g.add(at(box(cw, cTop - cBot, cd, 0x3a2412), C.x, (cTop + cBot) / 2, (cz0 + cz1) / 2, 0, 0, 0, 'counter_body'));
  g.add(at(face(cw, 1.1, counterTex(kind, T, cw), 'counter_face'), C.x, cTop - 0.55 - 0.04, cz1 + 0.004));
  g.add(at(box(cw + 0.14, 0.07, cd + 0.1, kind === 'rum' ? 0x4a2a14 : 0x2a1a10), C.x, cTop + 0.035, (cz0 + cz1) / 2 + 0.05, 0, 0, 0, 'counter_top'));
  g.add(at(box(cw + 0.16, 0.03, 0.04, GOLD), C.x, cTop + 0.01, cz1 + 0.1, 0, 0, 0, 'counter_nosing'));
  if (kind === 'rum') for (const s of [-1, 1]) { const px = C.x + s * (cw / 2 - 0.25); g.add(at(cyl(0.025, 0.025, 0.5, GOLD, 6), px, fy(px) + 0.95, cz1 + 0.2, 0, 0, Math.PI / 2, 'brass_rail')); }
  if (kind === 'rum') { const sl = Math.atan(fy(C.x + 1) - fy(C.x)); g.add(at(cyl(0.03, 0.03, (cw - 0.2) / Math.cos(sl), GOLD, 8), C.x, fy(C.x) + 0.2, cz1 + 0.16, 0, 0, Math.PI / 2 + sl, 'brass_rail')); }   // bar foot rail, following the floor fall
  // ---- the ONE name plate, on the cornice frieze above the counter
  g.add(at(box(2.9, 0.56, 0.06, 0x2a1608), C.x, top - 0.55, zj1 + 0.05, 0, 0, 0, 'name_plate')); g.add(at(face(2.8, 0.5, plaqueTex(T), 'name_plate_face'), C.x, top - 0.55, zj1 + 0.084));
  // ---- theme centrepiece, set INTO the joinery between counter top and name plate
  const y0 = cTop + 0.25, y1 = top - 0.95, hc = y1 - y0, zc = zj1 + 0.03;
  if (kind === 'wanted') {   // framed, wall-mounted bounty board with the live posters
    const bw = Math.min(3.2, cw - 0.4); g.add(at(box(bw + 0.24, hc + 0.24, 0.08, GOLD_D), C.x, y0 + hc / 2, zc, 0, 0, 0, 'bounty_frame')); g.add(at(box(bw, hc, 0.06, 0x6a4a2a), C.x, y0 + hc / 2, zc + 0.03, 0, 0, 0, 'bounty_cork'));
    const P = [0, 1, 2].map(i => { const p = face(Math.min(0.62, bw / 3.6), Math.min(0.82, hc - 0.12), posterCanvasTex(null, i), 'bounty_poster'); g.add(at(p, C.x + (i - 1) * bw / 3, y0 + hc / 2, zc + 0.066, 0, 0, (i - 1) * 0.04)); return p; });
    api.setPosters = (rows) => P.forEach((p, i) => { const t = posterCanvasTex(rows?.[i] || null, i); if (!t) return; p.material.map?.dispose?.(); p.material.map = t; p.material.needsUpdate = true; }); }
  else if (kind === 'rum') {   // back bar: mirror panel + 3 glass shelves of bottles (instanced) over the cask cellar rack beside the counter
    const bw = cw - 0.3; g.add(at(box(bw, hc, 0.02, 0x8aa0a8, { emissive: 0x18242a }), C.x, y0 + hc / 2, zc, 0, 0, 0, 'backbar_mirror'));
    const geo = new THREE.CylinderGeometry(0.045, 0.05, 0.3, 8), n = Math.floor(bw / 0.16) * 3, im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), n); im.userData.part = 'backbar_bottles';
    const m4 = new THREE.Matrix4(), col = new THREE.Color(); let k = 0;
    for (let r = 0; r < 3; r++) { const ys = y0 + 0.06 + r * hc / 3; g.add(at(box(bw, 0.04, 0.24, 0x3a2412), C.x, ys, zc + 0.12, 0, 0, 0, 'backbar_shelf'));
      for (let j = 0; j < n / 3; j++) { m4.makeTranslation(C.x - bw / 2 + 0.1 + j * 0.16, ys + 0.17, zc + 0.12); im.setMatrixAt(k, m4); im.setColorAt(k++, col.setHex([0x2f6a34, 0x6a2a12, 0x24506e, 0x3a2008, 0x7a5a1a][(j + r * 2) % 5])); } }
    g.add(im);
    for (const s of [-1, 1]) { const xr = C.x + s * (cw / 2 + 0.75); if (s < 0 ? xr - 0.5 < x0 : xr + 0.5 > x1) continue; const yf = Math.max(fy(xr - 0.5), fy(xr + 0.5)) + 0.01;   // cellar rack: two casks on a cradle against the joinery
      g.add(at(box(1.0, 0.18, 0.8, 0x3a2412), xr, yf + 0.09, zj1 + 0.42, 0, 0, 0, 'cask_cradle'));
      for (const dy of [0.48, 1.15]) { g.add(at(cyl(0.34, 0.34, 0.72, 0x7a4a24, 16), xr, yf + dy, zj1 + 0.42, Math.PI / 2, 0, 0, 'cask')); for (const dz of [-0.26, 0.26]) g.add(at(cyl(0.35, 0.35, 0.04, IRON, 16), xr, yf + dy, zj1 + 0.42 + dz, Math.PI / 2, 0, 0, 'cask')); g.add(at(cyl(0.03, 0.03, 0.1, GOLD, 6), xr, yf + dy - 0.18, zj1 + 0.82, Math.PI / 2, 0, 0, 'cask_tap')); } } }
  else if (kind === 'fence') {   // iron grille service window on the counter (pass-through at the E side) + a banded strongbox
    const gh = Math.min(1.25, top - 0.7 - cTop), n = Math.round(cw / 0.12), gap = 1.1, gz = cz1 - 0.12, hole = F.spot.x;
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, gh, 0.025), mat(0x1c1c20), n); bars.userData.part = 'grille'; const m4 = new THREE.Matrix4(); let k = 0;
    for (let i = 0; i <= n; i++) { const bx = C.x - cw / 2 + 0.06 + i * (cw - 0.12) / n; if (Math.abs(bx - hole) < gap / 2) continue; m4.makeTranslation(bx, cTop + 0.07 + gh / 2, gz); if (k < n) bars.setMatrixAt(k++, m4); }
    bars.count = k; g.add(bars);
    g.add(at(box(cw, 0.06, 0.05, 0x1c1c20), C.x, cTop + 0.07 + gh, gz, 0, 0, 0, 'grille')); g.add(at(box(cw, 0.05, 0.05, 0x1c1c20), C.x, cTop + 0.1, gz, 0, 0, 0, 'grille'));
    g.add(at(box(gap + 0.1, 0.12, 0.08, GOLD_D), hole, cTop + 0.07 + gh - 0.03, gz + 0.01, 0, 0, 0, 'grille_arch'));
    const xs = C.x + (hole < C.x ? 1 : -1) * (cw / 2 - 0.55); g.add(at(box(0.7, 0.42, 0.42, 0x4a2a14), xs, cTop + 0.28, (cz0 + gz) / 2, 0, 0, 0, 'strongbox')); g.add(at(box(0.72, 0.06, 0.44, IRON), xs, cTop + 0.36, (cz0 + gz) / 2, 0, 0, 0, 'strongbox')); g.add(at(box(0.12, 0.14, 0.02, GOLD), xs, cTop + 0.3, (cz0 + gz) / 2 + 0.22, 0, 0, 0, 'strongbox')); }
  else if (kind === 'fight') {   // weapon wall: crossed cutlasses + shields set in the joinery, the horde gong in a frame, the chalk booking slate
    const bw = cw - 0.3; g.add(at(box(bw, hc, 0.03, 0x241410), C.x, y0 + hc / 2, zc, 0, 0, 0, 'weapon_wall'));
    const gong = new THREE.Group(); gong.position.set(C.x, y0 + hc / 2, zc + 0.1); const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(0.5, hc / 2 - 0.08), 0.045, 6, 24), mat(0x3a2412)); ring.userData.part = 'gong'; gong.add(ring);
    const disc = cyl(Math.min(0.42, hc / 2 - 0.14), Math.min(0.42, hc / 2 - 0.14), 0.04, 0xd9a032, 24, { emissive: 0x3a2200 }); disc.rotation.x = Math.PI / 2; disc.userData.part = 'gong'; gong.add(disc); g.add(gong); api.gong = disc;
    const blade2 = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, Math.min(0.95, hc - 0.1), 0.02), mat(0xd9dde4), 4); blade2.userData.part = 'weapon_rack'; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    [[-1, 0.55], [-1, -0.55], [1, 0.55], [1, -0.55]].forEach(([s, a], i) => { m4.compose(new THREE.Vector3(C.x + s * bw * 0.32, y0 + hc / 2, zc + 0.04), q.setFromEuler(e.set(0, 0, a)), new THREE.Vector3(1, 1, 1)); blade2.setMatrixAt(i, m4); }); g.add(blade2);
    for (const s of [-1, 1]) { g.add(at(cyl(0.24, 0.24, 0.05, T.accent, 18), C.x + s * bw * 0.32, y0 + hc / 2, zc + 0.08, Math.PI / 2, 0, 0, 'weapon_rack')); g.add(at(cyl(0.08, 0.08, 0.04, GOLD, 10), C.x + s * bw * 0.32, y0 + hc / 2, zc + 0.11, Math.PI / 2, 0, 0, 'weapon_rack')); }
    const sl = canvas(320, 200); if (sl) { const sg = sl.getContext('2d'); sg.fillStyle = '#1e2620'; sg.fillRect(0, 0, 320, 200); sg.strokeStyle = '#6e4325'; sg.lineWidth = 14; sg.strokeRect(0, 0, 320, 200); sg.fillStyle = '#e8eadf'; sg.textAlign = 'center'; sg.font = 'bold 34px Georgia'; sg.fillText('PRIZE FIGHTS', 160, 62); sg.font = '26px Georgia'; sg.fillText('ringside bets 50-500g', 160, 110); sg.fillText('skeleton horde', 160, 150); }
    const xs = C.x + (F.spot.x < C.x ? 1 : -1) * (cw / 2 - 0.5); g.add(at(box(0.68, 0.46, 0.04, 0x6e4325), xs, cTop + 0.3, cz1 - 0.2, -0.35, 0, 0, 'booking_slate')); g.add(at(face(0.62, 0.4, tex(sl), 'booking_slate_face'), xs, cTop + 0.31, cz1 - 0.172, -0.35)); }
  // ---- room finish: wainscot + chair rail on the side walls, timber posts where the joinery meets them, wall sconces, the counter lamp, the rug
  for (const [sx, s] of [[R.xa, 1], [R.xb, -1]]) { const y0w = fy(sx);
    g.add(at(box(0.03, 0.72, R.front - R.back - 0.9, 0x3a2412), sx + s * 0.065, y0w + 0.4, (R.front + zj1) / 2 + 0.1, 0, 0, 0, 'wainscot'));
    g.add(at(box(0.05, 0.06, R.front - R.back - 0.9, GOLD_D), sx + s * 0.09, y0w + 0.76, (R.front + zj1) / 2 + 0.1, 0, 0, 0, 'wainscot')); }
  for (const x of [R.xa + 0.06, R.xb - 0.06]) { const sc = sconce(x < R.cx ? 1 : -1); sc.position.set(x, fy(x) + 2.45, R.front - 0.9); g.add(sc); }
  { const lp = lamp(0xffc46a); lp.position.set(C.x + Math.min(1.2, C.w / 2 - 0.3), F.G - 0.95, cz1 + 0.7); g.add(lp); }
  const rg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.0), new THREE.MeshLambertMaterial(rugTex(T) ? { map: rugTex(T) } : { color: T.accent }));
  rg.rotation.set(-Math.PI / 2, 0, 0); const rw = new THREE.Group(); rw.add(rg); rw.rotation.z = Math.atan(F.g); rw.position.set(F.spot.x, fy(F.spot.x) + 0.02, F.spot.z + 0.3); rg.userData.part = 'rug'; g.add(rw);
  return api;
}

const BAN = new Map(), RUG = new Map();
function bannerTex(T) { if (BAN.has(T.title)) return BAN.get(T.title); const c = canvas(160, 220); let t = null;
  if (c) { const g = c.getContext('2d'); g.fillStyle = T.cloth[0]; g.beginPath(); g.moveTo(0, 0); g.lineTo(160, 0); g.lineTo(160, 190); g.lineTo(80, 220); g.lineTo(0, 190); g.fill();
    g.strokeStyle = T.trim; g.lineWidth = 6; g.strokeRect(10, 10, 140, 170); icon(g, T.icon, 80, 100, 110, T.ink); t = tex(c); }
  BAN.set(T.title, t); return t; }
function rugTex(T) { if (RUG.has(T.title)) return RUG.get(T.title); const c = canvas(128, 168); let t = null;
  if (c) { const g = c.getContext('2d'); g.fillStyle = T.cloth[0]; g.fillRect(0, 0, 128, 168); g.strokeStyle = T.trim; g.lineWidth = 8; g.strokeRect(10, 10, 108, 148); g.lineWidth = 2; g.strokeRect(22, 22, 84, 124);
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? T.cloth[1] : T.trim; g.globalAlpha = 0.55; g.fillRect(28, 30 + i * 20, 72, 6); } g.globalAlpha = 1;
    g.strokeStyle = T.cloth[1]; g.lineWidth = 4; g.beginPath(); g.moveTo(64, 34); g.lineTo(96, 84); g.lineTo(64, 134); g.lineTo(32, 84); g.closePath(); g.stroke(); t = tex(c); }
  RUG.set(T.title, t); return t; }

/** S = a v372 shop site ({ door: {x, z, y, out}, ry, shop }); kind = wanted | fight | rum | fence. Returns the facade + the fitted interior.
 *  The returned group carries the business hooks the stall props used to: userData.setPosters (wanted), userData.gong (fight). */
export function shopFront(S, kind) {
  const T = THEMES[kind], F = T && shopFrame(S?.shop || KIND_SHOP[kind]); if (!F || !S?.door) return null;
  const g0 = new THREE.Group(); g0.name = 'mm_front_' + kind; g0.position.set(S.door.x, S.door.y, S.door.z); g0.rotation.y = S.ry;
  const g = new THREE.Group(); g.name = 'mm_front_frame'; g.position.z = -(S.door.out ?? 0); g0.add(g);   // origin back on the facade plane
  fascia(F, T, g); plateFaces(F, T, g); blade(F, T, g); if (!F.B.awning && !F.B.noAwning) awning(F, T, g); if (kind === 'fight') pierBanner(F, T, g); windowDressing(kind, F, T, g);
  const api = interior(kind, F, T, g);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.userData.part ??= 'misc'; } });
  g0.userData.frame = F; Object.assign(g0.userData, api); return g0;
}
