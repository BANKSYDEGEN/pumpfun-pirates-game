// [v373] BANKSY t1974u "Improve those buildings and signs": dresses the 4 money-maker rent shops (v372) so each reads as its trade from
// down the street, like the Treasure Trader: a framed shop board over the door, a striped awning, a double-sided iron bracket sign that
// reads up + down the street, two warm wall lanterns, and a few trade props flush against the wall beside the door (never in the doorway).
// Built in a door frame: local x = along the facade, local +z = out onto the street, y = 0 at the door sill. No colliders (all hug the wall).
import * as THREE from 'three';
import { mat } from './props.js';

const THEMES = {
  wanted: { title: 'WANTED BOARD', sub: 'CONTRACTS · BOUNTIES', icon: '💀', bg: ['#4a1a12', '#24090a'], ink: '#ffd75a', cloth: ['#8b1e1e', '#e9d8b0'] },
  fight:  { title: 'FIGHT MASTER', sub: 'PRIZE FIGHTS · BETS · HORDE', icon: '⚔️', bg: ['#3a1010', '#170506'], ink: '#ffcf4a', cloth: ['#1c1c1c', '#b3121a'] },
  rum:    { title: 'RUM EXPORT', sub: 'SELL YOUR RUM', icon: '🥃', bg: ['#5a3412', '#2a1606'], ink: '#ffd98a', cloth: ['#7a3a12', '#f1d9a0'] },
  fence:  { title: 'HARBOR FENCE', sub: 'NO QUESTIONS ASKED', icon: '📦', bg: ['#1d2c3c', '#0b1520'], ink: '#9fd3ff', cloth: ['#24384e', '#cdb98a'] },
};
const WOOD = 0x5a3a1c, WOOD_D = 0x3a2410, IRON = 0x2b2b2e, GOLD = 0xd4af37;
const box = (w, h, d, c, o) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o));
const cyl = (r0, r1, h, c, n = 8, o) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, n), mat(c, o));
const at = (m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; };

function boardTex(T, w = 1024, h = 300) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, T.bg[0]); gr.addColorStop(1, T.bg[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + (i % 2) * 0.05})`; g.fillRect(0, i * h / 7, w, 2); }   // plank seams
  g.strokeStyle = '#d4af37'; g.lineWidth = h * 0.05; g.strokeRect(h * 0.04, h * 0.04, w - h * 0.08, h - h * 0.08);
  g.strokeStyle = 'rgba(212,175,55,.45)'; g.lineWidth = 3; g.strokeRect(h * 0.11, h * 0.11, w - h * 0.22, h - h * 0.22);
  for (const [x, y] of [[h * 0.1, h * 0.1], [w - h * 0.1, h * 0.1], [h * 0.1, h * 0.9], [w - h * 0.1, h * 0.9]]) { g.fillStyle = '#d4af37'; g.beginPath(); g.arc(x, y, h * 0.035, 0, 7); g.fill(); }
  const big = w / h > 2.2; let px = Math.round(h * (big ? 0.46 : 0.3)); const font = (p) => `${p}px "Just Another Hand", Georgia, serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(px); while (px > 20 && g.measureText(T.title).width > w * (big ? 0.66 : 0.84)) { px -= 4; g.font = font(px); }
  const ty = big ? h * 0.44 : h * 0.62;
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(T.title, w / 2 + 4, ty + 5); g.fillStyle = T.ink; g.fillText(T.title, w / 2, ty);
  g.font = `${Math.round(h * (big ? 0.34 : 0.28))}px serif`;
  if (big) { g.fillText(T.icon, h * 0.42, h * 0.5); g.fillText(T.icon, w - h * 0.42, h * 0.5); g.font = font(Math.round(h * 0.2)); g.fillStyle = '#f3e3bf'; g.fillText(T.sub, w / 2, h * 0.78); }
  else g.fillText(T.icon, w / 2, h * 0.27);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function stripeTex(a, b) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 16; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 16, 0, 16, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let GLOW = null;
function glowTex() { if (GLOW) return GLOW; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,214,140,1)'); r.addColorStop(0.35, 'rgba(255,170,70,.45)'); r.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); GLOW = new THREE.CanvasTexture(c); return GLOW; }

function lantern() { const g = new THREE.Group();
  g.add(at(box(0.08, 0.08, 0.5, IRON), 0, 0.3, 0.25));                         // wall arm
  g.add(at(box(0.3, 0.06, 0.3, IRON), 0, 0.2, 0.5)); g.add(at(box(0.3, 0.06, 0.3, IRON), 0, -0.22, 0.5));
  g.add(at(box(0.22, 0.36, 0.22, 0xffc46a, { emissive: 0xff9a2a, emissiveIntensity: 1.2 }), 0, 0, 0.5));
  g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 4), mat(IRON)), 0, 0.33, 0.5, 0, Math.PI / 4));
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.set(1.6, 1.6, 1); s.position.set(0, 0, 0.55); g.add(s);
  return g; }
function barrel(s = 1) { const g = new THREE.Group(); g.add(at(cyl(0.34 * s, 0.34 * s, 0.86 * s, 0x7a4a24, 12), 0, 0.43 * s, 0));
  for (const y of [0.14, 0.72]) g.add(at(cyl(0.35 * s, 0.35 * s, 0.05 * s, IRON, 12), 0, y * s, 0)); return g; }
function crate(s = 0.8) { const g = new THREE.Group(); g.add(at(box(s, s, s, 0x9a6b3a), 0, s / 2, 0)); g.add(at(box(s * 1.02, s * 0.12, s * 1.02, WOOD_D), 0, s * 0.5, 0)); g.add(at(box(s * 0.12, s * 1.02, s * 1.02, WOOD_D), 0, s / 2, 0)); return g; }
function poster(seed) { const c = document.createElement('canvas'); c.width = 128; c.height = 170; const g = c.getContext('2d');
  g.fillStyle = '#e8d6a8'; g.fillRect(0, 0, 128, 170); g.fillStyle = '#3a1c08'; g.font = 'bold 26px Georgia'; g.textAlign = 'center'; g.fillText('WANTED', 64, 30);
  g.fillStyle = '#5a3a1c'; g.beginPath(); g.arc(64, 80, 30, 0, 7); g.fill(); g.fillStyle = '#e8d6a8'; g.fillRect(44, 72, 12, 8); g.fillRect(72, 72, 12, 8);
  g.fillStyle = '#8b1e1e'; g.font = 'bold 20px Georgia'; g.fillText(`${[500, 1000, 2500][seed % 3]}g`, 64, 145);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.73), new THREE.MeshLambertMaterial({ map: t })); }

function tradeProps(kind, side) { const g = new THREE.Group(), X = side * 2.95;   // beside the door, hugging the wall
  if (kind === 'wanted') { g.add(at(box(1.5, 1.7, 0.08, WOOD), X, 1.55, 0.08)); for (let i = 0; i < 4; i++) g.add(at(poster(i), X - 0.35 + (i % 2) * 0.7, 1.95 - Math.floor(i / 2) * 0.82, 0.13, 0, 0, (i - 1.5) * 0.05)); }
  else if (kind === 'fight') { g.add(at(box(1.6, 0.1, 0.3, WOOD_D), X, 1.0, 0.2)); g.add(at(box(1.6, 0.1, 0.3, WOOD_D), X, 2.0, 0.2));
    for (const s of [-1, 1]) { const b = new THREE.Group(); b.add(at(box(0.09, 1.7, 0.03, 0xd9dde4), 0, 0.35, 0)); b.add(at(box(0.36, 0.07, 0.06, GOLD), 0, -0.48, 0)); b.add(at(box(0.07, 0.3, 0.07, WOOD_D), 0, -0.68, 0)); g.add(at(b, X, 2.05, 0.14, 0, 0, s * 0.62)); }
    const sh = at(cyl(0.42, 0.42, 0.08, 0x8b1e1e, 16), X, 1.45, 0.2, Math.PI / 2); g.add(sh); g.add(at(cyl(0.12, 0.12, 0.1, GOLD, 10), X, 1.45, 0.26, Math.PI / 2)); }
  else if (kind === 'rum') { g.add(at(barrel(1), X - 0.4, 0, 0.5)); g.add(at(barrel(1), X + 0.4, 0, 0.5)); const b = barrel(0.9); b.rotation.z = Math.PI / 2; b.position.set(X, 1.1, 0.5); g.add(b);
    for (let i = 0; i < 3; i++) g.add(at(cyl(0.06, 0.08, 0.32, [0x3b7a3a, 0x6a3a12, 0x2c5a7a][i], 8, { transparent: true, opacity: 0.85 }), X - 0.25 + i * 0.25, 1.62, 0.5)); }
  else if (kind === 'fence') { g.add(at(crate(0.8), X - 0.35, 0, 0.45)); g.add(at(crate(0.7), X + 0.45, 0, 0.42)); g.add(at(crate(0.6), X - 0.2, 0.8, 0.45, 0, 0.3));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mat(0xb59a64)), X + 0.5, 0.95, 0.42)); }
  return g; }

/** S = a v372 shop site ({ door: {x, z, y}, ry }); kind = wanted | fight | rum | fence */
export function shopFront(S, kind) {
  const T = THEMES[kind]; if (!T || !S?.door) return null;
  const g0 = new THREE.Group(); g0.name = 'mm_front_' + kind; g0.position.set(S.door.x, S.door.y, S.door.z); g0.rotation.y = S.ry; // local +z = out onto the street
  const g = new THREE.Group(); g.position.z = -(S.door.out ?? 0); g0.add(g);   // origin back on the wall plane
  // main shop board over the door
  const bt = boardTex(T); g.add(at(box(4.5, 1.2, 0.14, WOOD_D), 0, 4.15, 0.05));
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.08), new THREE.MeshBasicMaterial({ map: bt })), 0, 4.15, 0.125));
  // striped awning (slopes down and out), with two iron stays
  const aw = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.7), new THREE.MeshLambertMaterial({ map: stripeTex(...T.cloth), side: THREE.DoubleSide })); aw.material.map.wrapS = THREE.RepeatWrapping; aw.material.map.repeat.set(3, 1);
  g.add(at(aw, 0, 3.25, 0.75, -Math.PI / 2 + 0.42));
  const va = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.28), aw.material); g.add(at(va, 0, 2.95, 1.53));   // valance
  for (const s of [-1, 1]) g.add(at(box(0.05, 0.05, 1.9, IRON), s * 2.05, 3.1, 0.75, 0.42));
  // double-sided bracket sign, readable up + down the street
  const side = 1, sx = side * 2.75; g.add(at(box(0.08, 0.08, 1.7, IRON), sx, 3.75, 0.85)); g.add(at(box(0.06, 0.6, 0.06, IRON), sx, 3.5, 0.18, 0.9));
  const st = boardTex(T, 512, 360); g.add(at(box(0.08, 0.95, 1.3, WOOD_D), sx, 3.15, 1.0));
  for (const s of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.86), new THREE.MeshBasicMaterial({ map: st })), sx + s * 0.045, 3.15, 1.0, 0, s * Math.PI / 2));
  for (const z of [0.5, 1.5]) g.add(at(box(0.02, 0.3, 0.02, IRON), sx, 3.68, z));
  // wall lanterns either side of the door
  for (const s of [-1, 1]) g.add(at(lantern(), s * 2.35, 2.4, 0.02));   // clear of the 3.6 m doorway
  g.add(tradeProps(kind, -1));
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return g0;
}
