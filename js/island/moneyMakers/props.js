import { batchShopFront } from './staticBatch.js';
import { formatGoldAmount } from '../../goldFormat.js';
// [v349 money-makers] procedural 3D props for the 5 island gold loops (no downloads): the WANTED board, the Coliseum Fight Master stand
// + gong + bookie, smuggler crate stacks / buyers / the crate on your back, wreck chests + clams, crab pots, ore veins, spice plots,
// the copper rum still and the Harbor Rum Export Stall. Every prop sits on world.ground (flush) and is built small (Lambert, few parts).
import * as THREE from 'three';

const M = new Map();
export const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!M.has(k)) M.set(k, new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o })); return M.get(k); };
const box = (w, h, d, c, o) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o));
const cyl = (rt, rb, h, c, n = 10, o) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, n), mat(c, o));
const ball = (r, c, o, n = 10) => new THREE.Mesh(new THREE.SphereGeometry(r, n, Math.max(6, n - 2)), mat(c, o));
const at = (m, x, y, z, ry = 0) => { m.position.set(x, y, z); m.rotation.y = ry; return m; };
const WOOD = 0x6e4325, WOODD = 0x4a2e18, ROPE = 0xc9a66b, IRON = 0x3a3a40, COPPER = 0xc8743a, PAPER = 0xf1e2bd;

// canvas sign / poster texture
export function signTex(lines, { w = 512, h = 256, bg = '#f1e2bd', fg = '#3a1c08', border = '#5a3219', font = 'Just Another Hand, cursive' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = border; g.lineWidth = Math.max(6, w / 40); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
  g.textAlign = 'center'; g.textBaseline = 'middle'; const n = lines.length;
  lines.forEach((l, i) => { const L = typeof l === 'string' ? { t: l } : l; g.fillStyle = L.c || fg; g.font = `${L.s || Math.floor(h / (n + 1.2))}px ${font}`; g.fillText(L.t, w / 2, h * (i + 0.85) / (n + 0.7)); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
}
const plane = (w, h, tex) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
// a floating label sprite (timers over pots / plots / stills); .set(text) redraws only when it changes
export function label(text = '', { w = 256, h = 64, sx = 1.6 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(sx, sx * h / w, 1); s.renderOrder = 8;
  let cur = null; s.userData.set = (txt, col = '#ffcd77') => { if (txt === cur) return; cur = txt; const g = c.getContext('2d'); g.clearRect(0, 0, w, h); if (!txt) { t.needsUpdate = true; return; }
    g.fillStyle = 'rgba(22,22,22,.82)'; const r = 14; g.beginPath(); if (g.roundRect) g.roundRect(2, 2, w - 4, h - 4, r); else g.rect(2, 2, w - 4, h - 4); g.fill(); g.lineWidth = 3; g.strokeStyle = col; g.stroke();
    g.fillStyle = col; g.font = `${Math.floor(h * 0.62)}px Just Another Hand, cursive`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2); t.needsUpdate = true; };
  s.userData.set(text); return s;
}
// a soft glowing ring on the ground (pickup / delivery / spot markers)
export function ring(r = 1.6, c = 0xffcd77) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.78, r, 32), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 2; return m;
}
// a tall light beam (crate destination) visible from far
export function beacon(c = 0xffcd77, h = 26) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.1, h, 12, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  m.position.y = h / 2; m.renderOrder = 3; return m;
}

// ---- 1. WANTED board: two posts, a roof, the WANTED header + 3 posters (the posters redraw from the live board) ----
export function wantedBoard() {
  const g = new THREE.Group(); g.name = 'mm_wanted_board';
  for (const x of [-1.55, 1.55]) g.add(at(box(0.22, 3.3, 0.22, WOODD), x, 1.65, 0));
  g.add(at(box(3.6, 2.0, 0.12, WOOD), 0, 2.05, 0));
  const roof = box(4.1, 0.14, 0.9, 0x7b2a1c); roof.rotation.x = 0.18; g.add(at(roof, 0, 3.32, 0.1));
  const head = plane(3.2, 0.5, signTex([{ t: 'WANTED · BOUNTIES', c: '#9b1010' }], { w: 512, h: 80, bg: '#e8d3a3' })); g.add(at(head, 0, 2.78, 0.075));
  const posters = []; for (let i = 0; i < 3; i++) { const p = plane(0.95, 1.2, signTex(['WANTED', '?', 'reward'], { w: 160, h: 200 })); g.add(at(p, -1.07 + i * 1.07, 1.78, 0.075)); posters.push(p); }
  g.userData.setPosters = (rows) => posters.forEach((p, i) => { const r = rows[i]; p.material.map?.dispose?.();
    p.material.map = r ? signTex([{ t: 'WANTED', c: '#9b1010' }, { t: String(r.name).slice(0, 12) }, { t: `${formatGoldAmount((r.pot | 0))}g`, c: '#7a5a00' }], { w: 160, h: 200 })
      : signTex([{ t: 'CONTRACT', c: '#2a5a1a' }, { t: ['RAIDERS', 'STALKERS', 'CAPTAINS'][i] }, { t: ['150g', '120g', '250g'][i], c: '#7a5a00' }], { w: 160, h: 200 }); p.material.needsUpdate = true; });
  g.userData.setPosters([]);
  return g;
}
// ---- 2. Coliseum: Fight Master's stand (counter + banner), a gong, the bookie's slate ----
export function fightMaster() {
  const g = new THREE.Group(); g.name = 'mm_fight_master';
  g.add(at(box(2.6, 1.05, 0.9, WOOD), 0, 0.52, 0)); g.add(at(box(2.8, 0.1, 1.05, WOODD), 0, 1.08, 0));
  for (const x of [-1.25, 1.25]) g.add(at(box(0.14, 2.9, 0.14, WOODD), x, 1.45, -0.35));
  const ban = plane(2.5, 0.75, signTex([{ t: 'PRIZE FIGHTS', c: '#ffcd77' }, { t: 'stakes · bets · horde', c: '#f1e2bd' }], { w: 512, h: 150, bg: '#7b1515', border: '#ffcd77' })); g.add(at(ban, 0, 2.55, -0.27));
  // the gong (Horde start) to the right
  const gong = new THREE.Group(); for (const x of [-0.6, 0.6]) gong.add(at(box(0.12, 2.1, 0.12, WOODD), x, 1.05, 0)); gong.add(at(box(1.35, 0.12, 0.12, WOODD), 0, 2.08, 0));
  const disc = cyl(0.5, 0.5, 0.06, 0xd9a032, 18, { emissive: 0x3a2200 }); disc.rotation.x = Math.PI / 2; gong.add(at(disc, 0, 1.35, 0)); g.add(at(gong, 2.3, 0, 0.1));
  // the bookie's chalk slate on the left
  const slate = plane(0.95, 0.75, signTex([{ t: 'RINGSIDE', c: '#ffcd77' }, { t: 'bets 50-500g', c: '#f1e2bd' }], { w: 200, h: 160, bg: '#25302a', border: '#6e4325' })); g.add(at(slate, -0.75, 1.62, 0.47));
  g.userData.gong = disc; return g;
}
// ---- 3. Smuggler crates ----
let crateSkullMaterial = null;
export function crateMesh(s = 1) {
  const g = new THREE.Group(); const b = box(0.9 * s, 0.62 * s, 0.62 * s, 0x8b5a2b); g.add(at(b, 0, 0.31 * s, 0));
  for (const x of [-0.42, 0.42]) g.add(at(box(0.07 * s, 0.66 * s, 0.66 * s, WOODD), x * s, 0.31 * s, 0));
  g.add(at(box(0.94 * s, 0.07 * s, 0.66 * s, IRON), 0, 0.31 * s, 0));
  crateSkullMaterial ||= new THREE.MeshBasicMaterial({map:signTex([{ t: '☠', c: '#161616' }], { w: 64, h: 64, bg: '#c9a66b', border: '#8b5a2b' }),side:THREE.DoubleSide});
  const skull = new THREE.Mesh(new THREE.PlaneGeometry(0.34*s,0.34*s),crateSkullMaterial); g.add(at(skull, 0, 0.36 * s, 0.315 * s)); return g;
}
export function crateStack(label = 'SMUGGLER CRATES') {
  const g = new THREE.Group(); g.name = 'mm_crate_stack';
  g.add(at(crateMesh(1.1), 0, 0, 0)); g.add(at(crateMesh(1.1), 1.05, 0, 0.1, 0.2)); g.add(at(crateMesh(1), 0.5, 0.68, 0.05, -0.15));
  const sign = plane(1.7, 0.55, signTex([label], { w: 400, h: 110 })); const post = box(0.1, 1.9, 0.1, WOODD); g.add(at(post, -0.95, 0.95, 0.3)); g.add(at(sign, -0.95, 1.75, 0.36)); return g;
}
export function buyerPost(title, col = '#2a4a6a') {
  const g = new THREE.Group(); g.name = 'mm_buyer';
  g.add(at(box(1.8, 0.95, 0.8, WOOD), 0, 0.47, 0)); g.add(at(box(0.12, 2.6, 0.12, WOODD), -0.8, 1.3, -0.3)); g.add(at(box(0.12, 2.6, 0.12, WOODD), 0.8, 1.3, -0.3));
  const awn = box(2.0, 0.08, 1.2, 0x7b2a1c); awn.rotation.x = 0.25; g.add(at(awn, 0, 2.55, 0.1));
  g.add(at(plane(1.6, 0.48, signTex([title], { w: 420, h: 120, bg: col, fg: '#f1e2bd', border: '#c9a66b' })), 0, 2.15, -0.23));
  g.add(at(cyl(0.3, 0.3, 0.7, 0x7a4a24, 10), 1.25, 0.35, 0.2)); g.add(at(cyl(0.3, 0.3, 0.7, 0x7a4a24, 10), 1.25, 0.35, -0.45)); return g;
}
// ---- 4. diving / crab pots / mining ----
export function wreckChest() {
  const g = new THREE.Group(); g.add(at(box(0.9, 0.5, 0.6, 0x5a3a20), 0, 0.25, 0)); const lid = box(0.92, 0.18, 0.62, 0x4a2e18); g.add(at(lid, 0, 0.58, 0)); lid.rotation.x = -0.25;
  g.add(at(box(0.95, 0.08, 0.64, 0x2e6b5a), 0, 0.12, 0)); g.add(at(ball(0.07, 0xffcd3c, { emissive: 0x553300 }), 0.12, 0.62, 0.1)); g.rotation.z = 0.12; return g;
}
export function clam() {
  const g = new THREE.Group(); const a = ball(0.32, 0xc7a7b8, {}, 8); a.scale.set(1, 0.32, 0.85); g.add(at(a, 0, 0.1, 0)); const b = ball(0.32, 0xb08aa0, {}, 8); b.scale.set(1, 0.3, 0.85); b.rotation.x = -0.5; g.add(at(b, 0, 0.22, -0.08));
  g.add(at(ball(0.07, 0xf8f4ff, { emissive: 0x333344 }), 0, 0.17, 0.05)); return g;
}
export function diveBuoy() { // floats on the surface over a dive spot
  const g = new THREE.Group(); g.name = 'mm_dive_buoy'; const b = ball(0.38, 0xd8322f, {}, 10); b.scale.y = 0.75; g.add(at(b, 0, 0.12, 0)); g.add(at(cyl(0.3, 0.3, 0.12, 0xf1e2bd, 10), 0, 0.3, 0));
  g.add(at(cyl(0.04, 0.04, 1.1, WOODD, 5), 0, 0.85, 0)); const f = plane(0.5, 0.34, signTex([{ t: '🤿', s: 60 }], { w: 96, h: 64, bg: '#d8322f', border: '#f1e2bd' })); g.add(at(f, 0.26, 1.2, 0));
  const r = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 28), new THREE.MeshBasicMaterial({ color: 0xdff7ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; g.add(at(r, -1.2, 0.04, 0)); return g;
}
export function crabPot() {
  const g = new THREE.Group(); g.name = 'mm_crab_pot';
  const cage = cyl(0.42, 0.48, 0.55, ROPE, 8, { wireframe: true }); g.add(at(cage, 0, 0.28, 0)); g.add(at(cyl(0.48, 0.48, 0.05, WOODD, 8), 0, 0.03, 0)); g.add(at(cyl(0.42, 0.42, 0.05, WOODD, 8), 0, 0.55, 0));
  const buoy = ball(0.15, 0xd8322f, {}, 8); g.add(at(buoy, 0.55, 0.9, 0)); g.add(at(cyl(0.015, 0.015, 0.7, ROPE, 4), 0.3, 0.6, 0));
  const crab = new THREE.Group(); const body = ball(0.13, 0xd2442a, {}, 8); body.scale.set(1.3, 0.55, 1); crab.add(body); for (const s of [-1, 1]) crab.add(at(ball(0.06, 0xd2442a, {}, 6), s * 0.17, 0.02, 0.1)); crab.visible = false; g.add(at(crab, 0, 0.15, 0)); g.userData.crab = crab; return g;
}
export function oreVein(kind = 'iron', col = 0xc46a3a, glow = 0xff8a4a) {
  const g = new THREE.Group(); g.name = 'mm_ore_' + kind;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), mat(0x8f877b, { emissive: 0x4a4238, emissiveIntensity: 1 })); rock.scale.set(1.25, 0.85, 0.9); g.add(at(rock, 0, 0.5, 0));
  const rock2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), mat(0x7a7268, { emissive: 0x3c362e, emissiveIntensity: 1 })); g.add(at(rock2, 0.75, 0.3, 0.25));
  const gems = []; for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 + (i % 2) * 0.06, 0), mat(col, { emissive: glow, emissiveIntensity: 0.9 })); c.scale.y = 1.6; const a = i * 1.3;
    g.add(at(c, Math.sin(a) * 0.65, 0.55 + (i % 3) * 0.18, Math.cos(a) * 0.45 + 0.25)); c.rotation.z = (i - 2) * 0.35; gems.push(c); }
  g.userData.gems = gems; g.userData.setCharges = (n, max = 3) => gems.forEach((c, i) => { c.visible = i < Math.ceil(5 * n / max); }); return g;
}
export function pickaxe() {
  const g = new THREE.Group(); g.add(at(box(0.06, 0.95, 0.06, WOOD), 0, 0, 0)); const h = box(0.7, 0.09, 0.09, IRON); g.add(at(h, 0, 0.45, 0)); return g;
}
// ---- 5. spice plot (3 growth stages) + copper still + rum stall ----
export function spicePlot() {
  const g = new THREE.Group(); g.name = 'mm_spice_plot';
  g.add(at(box(2.6, 0.18, 1.8, 0x5a3d22), 0, 0.09, 0)); for (const [x, z, w, d] of [[0, 0.95, 2.8, 0.12], [0, -0.95, 2.8, 0.12], [1.35, 0, 0.12, 1.9], [-1.35, 0, 0.12, 1.9]]) g.add(at(box(w, 0.32, d, WOODD), x, 0.16, z));
  for (let i = 0; i < 3; i++) g.add(at(box(2.3, 0.07, 0.26, 0x3f2a16), 0, 0.2, -0.55 + i * 0.55));
  const st = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  for (let i = 0; i < 9; i++) { const x = -0.85 + (i % 3) * 0.85, z = -0.55 + Math.floor(i / 3) * 0.55;
    st[0].add(at(ball(0.05, 0x8a6a3a, {}, 5), x, 0.25, z));
    const sp = cyl(0.015, 0.02, 0.32, 0x5fae3a, 4); st[1].add(at(sp, x, 0.38, z)); st[1].add(at(ball(0.08, 0x6cc04a, {}, 6), x, 0.55, z));
    const cane = cyl(0.04, 0.05, 1.25, 0x9cc25a, 6); st[2].add(at(cane, x - 0.12, 0.82, z)); st[2].add(at(box(0.5, 0.03, 0.12, 0x4f9a32), x - 0.12, 1.2, z));
    st[2].add(at(ball(0.11, i % 2 ? 0xd8322f : 0xf2a33a, {}, 6), x + 0.18, 0.42, z + 0.05)); }
  st.forEach((s, i) => { batchShopFront(s); s.userData.batchDynamic = true; s.visible = i === 0; g.add(s); });
  const sign = plane(0.9, 0.36, signTex(['SPICE PLOT'], { w: 240, h: 96 })); g.add(at(box(0.07, 0.95, 0.07, WOODD), -1.5, 0.47, 0.95)); g.add(at(sign, -1.5, 0.95, 0.99));
  g.userData.setStage = (n) => st.forEach((s, i) => { s.visible = i === n; }); return g;
}
export function copperStill() {
  const g = new THREE.Group(); g.name = 'mm_rum_still';
  g.add(at(box(1.5, 0.35, 1.3, 0x6a635a), 0, 0.17, 0)); // stone hearth
  const fire = box(0.7, 0.16, 0.5, 0xff7a2a, { emissive: 0xff5a10, emissiveIntensity: 0.9 }); g.add(at(fire, 0, 0.36, 0.2)); g.userData.fire = fire;
  const pot = ball(0.62, COPPER, { emissive: 0x2a1000 }, 14); pot.scale.y = 0.9; g.add(at(pot, 0, 0.95, 0));
  g.add(at(cyl(0.12, 0.38, 0.55, COPPER, 12), 0, 1.65, 0)); g.add(at(ball(0.16, 0xd8884a, {}, 10), 0, 1.98, 0));
  const arm = cyl(0.05, 0.05, 1.0, 0xb8652f, 8); arm.rotation.z = -1.0; g.add(at(arm, 0.42, 1.78, 0)); // lyne arm to the worm tub
  const tub = cyl(0.36, 0.38, 0.9, 0x7a4a24, 12); g.add(at(tub, 0.95, 0.45, 0)); g.add(at(cyl(0.38, 0.38, 0.06, IRON, 12), 0.95, 0.72, 0));
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 14), mat(COPPER)); coil.rotation.x = Math.PI / 2; g.add(at(coil, 0.95, 0.98, 0));
  const keg = cyl(0.26, 0.26, 0.5, 0x6e4325, 10); keg.rotation.z = Math.PI / 2; g.add(at(keg, 0.2, 0.27, -0.75));
  const bottles = new THREE.Group(); for (let i = 0; i < 2; i++) { const b = cyl(0.06, 0.08, 0.3, 0x5a2a12, 8, { transparent: true, opacity: 0.9 }); bottles.add(at(b, -0.55 + i * 0.18, 0.5, 0.5)); } bottles.visible = false; g.add(bottles); g.userData.bottles = bottles;
  return g;
}
export function rumStall() {
  const g = new THREE.Group(); g.name = 'mm_rum_stall';
  g.add(at(box(2.8, 1.0, 1.0, WOOD), 0, 0.5, 0)); g.add(at(box(3.0, 0.1, 1.15, WOODD), 0, 1.04, 0));
  for (const x of [-1.35, 1.35]) g.add(at(box(0.14, 2.8, 0.14, WOODD), x, 1.4, -0.42));
  for (let i = 0; i < 4; i++) { const s = box(0.6, 0.06, 1.6, i % 2 ? 0xf1e2bd : 0x2a5a8a); s.rotation.x = 0.28; g.add(at(s, -1.05 + i * 0.7, 2.75, 0.15)); }
  g.add(at(plane(2.4, 0.58, signTex([{ t: 'RUM EXPORT', c: '#ffcd77' }, { t: '140g · reserve 175g', c: '#f1e2bd', s: 34 }], { w: 512, h: 124, bg: '#3a1c08', border: '#ffcd77' })), 0, 2.2, -0.34));
  for (let i = 0; i < 5; i++) g.add(at(cyl(0.06, 0.08, 0.32, i % 2 ? 0x6a2a12 : 0x2f1a0c, 8), -0.9 + i * 0.45, 1.25, 0.15));
  for (const [x, z] of [[-1.9, 0.3], [1.9, 0.2], [1.95, -0.5]]) { const b = cyl(0.36, 0.36, 0.9, 0x7a4a24, 12); g.add(at(b, x, 0.45, z)); g.add(at(cyl(0.37, 0.37, 0.05, IRON, 12), x, 0.75, z)); }
  return g;
}
// ---- the skeleton enemies' parts are in enemies.js; the crate you carry ----
export function carriedCrate() { const g = crateMesh(0.8); g.name = 'mm_carried_crate'; g.position.set(0, 1.05, -0.38); return g; }
