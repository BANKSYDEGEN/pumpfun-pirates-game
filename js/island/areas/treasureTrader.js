// [v241] TREASURE TRADER (BANKSY 7:09-7:12 PM, was ANTIQUES): the hill-street shop #20 (rent_1, lot L0, the first building up Main Street
// on the west side) made the standout of the street, IN PLACE (same lot, same door, same E prompt, same sell logic). The Blender lot stays;
// this dresses it with library-material Kit pieces (stone / timber / iron / rope via libTex ROUTE_RULES, gold + cloth plain toon), so 0 new
// textures except one 1024x256 sign canvas + one 64 px glow:
//   - a stepped stone Dutch-gable false front on the gable that faces the plaza (lz -67.25, y 10.8 -> 20.6) with the big TREASURE TRADER board
//   - a projecting upper storey + crenellated parapet on the street front (lx -1.15, y 12.4 -> 19.4) with a second big board
//   - a corner turret with a gold cone roof + pennant over the plaza / street corner (tops out ~24.5 m, the tallest roof on the street)
//   - a double-sided bracket sign by the door that reads up + down the street, warm wall lanterns with a glow
//   - two treasure tables flanking the door: chests of gold, gem piles, gold bar stacks, maps, pearls (box colliders)
// Everything above y 10 sits over the lot or the pavement edge (no walk clipping); the only colliders are the two tables, clear of the door
// prompt (lx 0, lz -73.1, r 2.6). Town-local frame (js/island/coast.js t2w): local x = lx (+ = across to the street), local z = lz (+ = plaza).
import * as THREE from 'three';
import { Kit, M, box, cyl, W, C } from './common.js';
import { t2w } from '../coast.js';
export const TT = { name: 'TREASURE TRADER', door: { lx: -2.0, lz: -73.095 }, front: -1.15, gable: -67.25, lot: { lx0: -11.5, lx1: -1.9, lz0: -77.6, lz1: -67.25 },
  tables: [{ lx: -0.85, lz: -69.9 }, { lx: -0.85, lz: -76.3 }], table: { w: 1.1, d: 2.6 } };
const STONE = C.STONE, TRIM = C.STONE_D, WOOD = C.WOOD, WOOD_D = C.WOOD_D, IRON = C.IRON, GOLD = C.GOLD, GOLD_D = 0xd9a020, RED = 0x9b2335, PARCH = 0xe8d6a8;
const GEMS = [0xd8322f, 0x2a6df4, 0x2f8a3a, 0x9b5cff, 0xff7ab8];
const YAW = -Math.PI / 2, [OX, OZ] = t2w(0, 0);   // the town frame as a Kit transform (local x = lx, local z = lz)
export const ttWorld = (lx, lz) => t2w(lx, lz);
// colliders (register): the two treasure tables, w along lx, d along lz (yaw = the town frame)
export function ttColliders(addBox) { for (const t of TT.tables) { const [x, z] = t2w(t.lx, t.lz); addBox(x, z, TT.table.w + 0.2, TT.table.d + 0.2, YAW); } }
function signTex() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#5a1420'); grd.addColorStop(1, '#2e0a10'); g.fillStyle = grd; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#ffc93c'; g.lineWidth = 14; g.strokeRect(10, 10, 1004, 236); g.strokeStyle = '#a8741a'; g.lineWidth = 4; g.strokeRect(30, 30, 964, 196);
  for (const x of [72, 952]) { g.fillStyle = '#ffc93c'; g.beginPath(); g.moveTo(x, 92); g.lineTo(x + 30, 128); g.lineTo(x, 164); g.lineTo(x - 30, 128); g.closePath(); g.fill(); g.fillStyle = '#d8322f'; g.beginPath(); g.moveTo(x, 108); g.lineTo(x + 15, 128); g.lineTo(x, 148); g.lineTo(x - 15, 128); g.closePath(); g.fill(); }
  let px = 150; g.font = `${px}px "Just Another Hand", Georgia, serif`; while (px > 60 && g.measureText(TT.name).width > 800) { px -= 6; g.font = `${px}px "Just Another Hand", Georgia, serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#3a1f0a'; g.fillText(TT.name, 516, 138); g.fillStyle = '#ffd75a'; g.fillText(TT.name, 512, 133);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let GLOW = null;
function glowMat() { if (GLOW) return GLOW; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,214,120,0.95)'); r.addColorStop(0.35, 'rgba(255,170,60,0.45)'); r.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (GLOW = new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); }
export function buildTreasureTrader({ MATS, OUT, low, H }) {
  const g = new THREE.Group(); g.name = 'treasure_trader'; if (typeof document === 'undefined') return g;
  const k = new Kit(), signs = [], lamps = [];
  const gy = (lx, lz) => { const [x, z] = t2w(lx, lz); return H(x, z); };
  k.at(M(OX, 0, OZ, YAW), () => {
    // ---- 1. the stepped Dutch-gable false front facing the plaza ----
    { const z = TT.gable, cx = (TT.lot.lx0 + TT.lot.lx1) / 2, w0 = TT.lot.lx1 - TT.lot.lx0;
      const steps = [[w0, 10.8, 15.6], [7.4, 15.6, 17.6], [4.6, 17.6, 19.7]];
      for (const [w, y0, y1] of steps) { W(k, box(w, y1 - y0, 0.36), STONE, M(cx, (y0 + y1) / 2, z)); W(k, box(w + 0.4, 0.28, 0.6), TRIM, M(cx, y1 + 0.08, z + 0.05), false);
        for (const s of [-1, 1]) W(k, box(0.34, y1 - y0 + 0.02, 0.5), TRIM, M(cx + s * (w / 2 - 0.12), (y0 + y1) / 2, z + 0.05), false); }   // quoin edges + cornices
      W(k, box(w0 + 0.3, 0.22, 0.55), GOLD_D, M(cx, 10.85, z + 0.06), false);
      W(k, box(1.6, 0.9, 0.5), TRIM, M(cx, 20.2, z)); W(k, new THREE.ConeGeometry(0.35, 0.9, 8), GOLD, M(cx, 21.1, z), false); W(k, new THREE.SphereGeometry(0.22, 8, 6), GOLD, M(cx, 21.65, z), false);
      for (const s of [-1, 1]) { W(k, new THREE.SphereGeometry(0.28, 8, 6), GOLD, M(cx + s * 3.7, 17.95, z + 0.05), false); W(k, new THREE.SphereGeometry(0.28, 8, 6), GOLD, M(cx + s * 2.3, 20.0, z + 0.05), false); }
      W(k, cyl(0.85, 0.85, 0.16, 18), GOLD, M(cx, 18.65, z + 0.22, 0, Math.PI / 2), false); W(k, cyl(0.6, 0.6, 0.18, 18), GOLD_D, M(cx, 18.65, z + 0.25, 0, Math.PI / 2), false);   // the gold doubloon
      W(k, box(9.0, 2.75, 0.14), WOOD_D, M(cx, 13.25, z + 0.24)); W(k, box(9.2, 0.14, 0.2), GOLD, M(cx, 14.68, z + 0.26), false); W(k, box(9.2, 0.14, 0.2), GOLD, M(cx, 11.82, z + 0.26), false);
      signs.push([8.6, 2.15, new THREE.Matrix4().compose(new THREE.Vector3(cx, 13.25, z + 0.33), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))]);
      for (const s of [-1, 1]) { const lx = cx + s * 4.25; W(k, box(0.08, 0.08, 0.7), IRON, M(lx, 11.6, z + 0.5), false); W(k, box(0.3, 0.42, 0.3), 0xffd27a, M(lx, 11.3, z + 0.8), false); W(k, box(0.38, 0.08, 0.38), IRON, M(lx, 11.55, z + 0.8), false); lamps.push([lx, 11.3, z + 0.8, 2.2]); } }
    // ---- 2. the projecting upper storey + crenellated parapet on the street front ----
    { const x = TT.front, z0 = TT.lot.lz0, z1 = TT.gable - 0.2, L = z1 - z0, cz = (z0 + z1) / 2;
      W(k, box(0.3, 6.2, L), STONE, M(x, 15.5, cz)); W(k, box(1.4, 0.24, L), TRIM, M(x - 0.55, 12.42, cz));                       // the false front + its soffit
      for (let zz = z0 + 0.6; zz <= z1 - 0.5; zz += 2.0) W(k, box(1.15, 0.6, 0.32), TRIM, M(x - 0.6, 12.05, zz), false);           // corbels
      W(k, box(0.55, 0.3, L + 0.3), TRIM, M(x + 0.05, 18.6, cz), false); W(k, box(0.5, 0.22, L + 0.2), GOLD_D, M(x + 0.06, 12.7, cz), false);
      for (let zz = z0 + 0.45, i = 0; zz <= z1 - 0.4; zz += 1.6, i++) W(k, box(0.38, 0.8, 0.9), STONE, M(x, 19.15, zz));             // merlons
      for (const zz of [z0 + 0.2, z1 - 0.2]) W(k, box(0.5, 6.8, 0.5), TRIM, M(x + 0.02, 15.7, zz), false);
      W(k, box(0.14, 2.75, 9.1), WOOD_D, M(x + 0.2, 15.6, cz)); W(k, box(0.2, 0.14, 9.3), GOLD, M(x + 0.24, 17.03, cz), false); W(k, box(0.2, 0.14, 9.3), GOLD, M(x + 0.24, 14.17, cz), false);
      signs.push([8.7, 2.17, new THREE.Matrix4().compose(new THREE.Vector3(x + 0.29, 15.6, cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1))]); }
    // ---- 3. the corner turret (plaza / street corner), gold cone roof + pennant ----
    { const tx = -1.35, tz = -67.45, r = 1.35;
      // [v245] the base: a short stepped corbel collar + 8 stone brackets (was one 1.4 m cone tapering to 0.35 m = read as an upside-down cone)
      W(k, cyl(r + 0.08, r - 0.12, 0.34, 12), TRIM, M(tx, 10.93, tz)); W(k, cyl(r - 0.12, r - 0.38, 0.3, 12), TRIM, M(tx, 10.61, tz), false);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; W(k, box(0.26, 0.62, 0.34), TRIM, M(tx + Math.sin(a) * (r - 0.3), 10.45, tz + Math.cos(a) * (r - 0.3), a), false); } W(k, cyl(r, r, 10.0, 12), STONE, M(tx, 16.1, tz));
      for (const y of [11.2, 15.4, 21.1]) W(k, cyl(r + 0.12, r + 0.12, 0.26, 12), y === 21.1 ? TRIM : GOLD_D, M(tx, y, tz), false);
      if (!low) for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; W(k, box(0.36, 1.1, 0.12), 0x24170e, M(tx + Math.sin(a) * (r + 0.01), 18.3, tz + Math.cos(a) * (r + 0.01), a), false); }
      W(k, new THREE.ConeGeometry(r + 0.35, 2.8, 12), GOLD, M(tx, 22.6, tz)); W(k, new THREE.SphereGeometry(0.22, 8, 6), GOLD_D, M(tx, 24.1, tz), false);
      W(k, cyl(0.04, 0.04, 1.6, 4), IRON, M(tx, 24.9, tz), false); W(k, box(0.04, 0.5, 0.9), 0xd8322f, M(tx, 25.4, tz + 0.45), false); }
    // ---- 4. the bracket sign by the door (reads up + down the street) + the door lanterns ----
    { const z = TT.door.lz + 4.2, y = 9.15;   // plaza side of the door, clear of the lanterns W(k, box(1.9, 0.1, 0.1), IRON, M(-1.15, y + 0.75, z), false); W(k, box(0.07, 0.7, 0.07), IRON, M(-1.95, y + 0.4, z, 0, 0, 0.8), false);
      for (const xx of [-1.6, -0.6]) W(k, box(0.03, 0.35, 0.03), IRON, M(xx, y + 0.55, z), false); W(k, box(2.2, 1.0, 0.14), WOOD_D, M(-1.1, y, z));
      for (const s of [-1, 1]) signs.push([2.05, 0.82, new THREE.Matrix4().compose(new THREE.Vector3(-1.1, y, z + s * 0.08), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s > 0 ? 0 : Math.PI), new THREE.Vector3(1, 1, 1))]); }
    for (const dz of [-2.2, 2.2]) { const z = TT.door.lz + dz, y = gy(-1.8, z) + 2.9; W(k, box(0.5, 0.08, 0.08), IRON, M(-1.95, y + 0.45, z), false);
      W(k, box(0.32, 0.46, 0.32), 0xffd27a, M(-1.7, y, z), false); W(k, box(0.42, 0.08, 0.42), IRON, M(-1.7, y + 0.27, z), false); W(k, box(0.42, 0.06, 0.42), IRON, M(-1.7, y - 0.25, z), false); lamps.push([-1.7, y, z, 1.8]); }
    { const y = gy(-1.8, TT.door.lz) + 3.15;   // [v245] a TREASURE TRADER board over the shop door (covers the Blender lot's old TO RENT board), marks the walk-up spot
      W(k, box(0.12, 0.78, 2.7), WOOD_D, M(-1.84, y, TT.door.lz)); W(k, box(0.14, 0.08, 2.8), GOLD, M(-1.82, y + 0.42, TT.door.lz), false); W(k, box(0.14, 0.08, 2.8), GOLD, M(-1.82, y - 0.42, TT.door.lz), false);
      signs.push([2.55, 0.64, new THREE.Matrix4().compose(new THREE.Vector3(-1.76, y, TT.door.lz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1))]); }
    { const y = gy(-6.2, TT.door.lz) + 2.45, x = -10.62;   // [v246] inside: a TREASURE TRADER board on the back wall over the counter (covers the lot's TO RENT board)
      W(k, box(0.1, 1.15, 3.1), WOOD_D, M(x, y, TT.door.lz)); signs.push([2.9, 0.78, new THREE.Matrix4().compose(new THREE.Vector3(x + 0.07, y, TT.door.lz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1))]); }
    // [v249] BANKSY 8:09 PM 'fill the shelves': the lot's empty side-wall shelves (tools/hill_blender: 3 boards per side at floor + 0.9 / 1.6 /
    // 2.3, 1 board on phones) get gold bar stacks, coin heaps, small chests, gem clusters, pearls and rolled maps. All in this Kit (merged per
    // material, 0 new draw calls / textures); phones fill only their one board with every other item.
    { const fy = (lz) => 6.046 + (lz + 77.69) * (5.035 - 6.046) / 9.19, rows = low ? [0.9] : [0.9, 1.6, 2.3], step = low ? 1.1 : 0.62;
      for (const [wz, sz] of [[-77.44, 1], [-68.75, -1]]) rows.forEach((ry, ri) => { let i = ri * 2 + (sz > 0 ? 0 : 1);
        for (let lx = -9.1; lx <= -3.9; lx += step, i++) { const y = fy(wz) + ry + 0.03, z = wz, kind = i % 6;
          if (kind === 0) { for (const [bx, by, n] of [[0, 0, 2], [0, 1, 1]]) for (let j = 0; j < n; j++) W(k, box(0.26, 0.08, 0.12), GOLD, M(lx - (n - 1) * 0.07 + j * 0.14, y + 0.04 + by * 0.08, z), false); }   // gold bars
          else if (kind === 1) { W(k, new THREE.ConeGeometry(0.17, 0.16, 8), GOLD, M(lx, y + 0.08, z), false); if (!low) for (let j = 0; j < 3; j++) W(k, cyl(0.045, 0.045, 0.015, 8), GOLD, M(lx + 0.16 + j * 0.03, y + 0.01 + j * 0.016, z + 0.05), false); }   // coin heap
          else if (kind === 2) { W(k, box(0.34, 0.2, 0.24), WOOD_D, M(lx, y + 0.1, z)); W(k, box(0.36, 0.04, 0.26), GOLD_D, M(lx, y + 0.21, z), false); W(k, new THREE.ConeGeometry(0.13, 0.08, 8), GOLD, M(lx, y + 0.25, z), false); }   // small chest + gold
          else if (kind === 3) { for (let j = 0; j < (low ? 2 : 5); j++) W(k, new THREE.IcosahedronGeometry(0.05 + (j % 2) * 0.02, 0), GEMS[(i + j) % GEMS.length], M(lx - 0.1 + (j % 3) * 0.1, y + 0.05 + (j > 2 ? 0.05 : 0), z + (j % 2 ? 0.05 : -0.05)), false); }   // gems
          else if (kind === 4) { if (!low) W(k, cyl(0.12, 0.1, 0.05, 10), GOLD_D, M(lx, y + 0.025, z), false); for (let j = 0; j < (low ? 1 : 3); j++) W(k, new THREE.SphereGeometry(0.05, 6, 4), 0xf4efe6, M(lx - 0.05 + j * 0.05, y + 0.08, z), false); }   // pearls in a dish
          else { W(k, cyl(0.05, 0.05, 0.36, 6), PARCH, M(lx, y + 0.05, z, 0, 0, Math.PI / 2), false); W(k, cyl(0.055, 0.055, 0.04, 6), RED, M(lx, y + 0.05, z, 0, 0, Math.PI / 2), false); } } }); }   // rolled map
    // ---- 5. the treasure tables: chests of gold, gems, gold bars, maps, pearls ----
    TT.tables.forEach((t, ti) => { const y0 = gy(t.lx, t.lz), top = y0 + 0.9, { w, d } = TT.table;
      W(k, box(w, 0.9, d), WOOD, M(t.lx, y0 + 0.45, t.lz)); W(k, box(w + 0.16, 0.1, d + 0.16), RED, M(t.lx, top + 0.02, t.lz), false);
      for (let i = 0; i < 5; i++) W(k, box(0.06, 0.32, (d + 0.16) / 5 - 0.04), i % 2 ? GOLD : RED, M(t.lx + w / 2 + 0.09, top - 0.14, t.lz - (d + 0.16) / 2 + (i + 0.5) * (d + 0.16) / 5), false);   // gold-fringed cloth
      const cz = t.lz + (ti ? 0.65 : -0.65);   // the open chest heaped with gold
      W(k, box(0.8, 0.45, 0.55), WOOD_D, M(t.lx - 0.1, top + 0.3, cz)); for (const s of [-1, 1]) W(k, box(0.06, 0.47, 0.58), GOLD_D, M(t.lx - 0.1, top + 0.3, cz + s * 0.25), false);
      W(k, box(0.8, 0.32, 0.08), WOOD_D, M(t.lx - 0.48, top + 0.6, cz, 0, 0, 0.5), false);   // the lid, tipped back toward the wall
      W(k, new THREE.ConeGeometry(0.42, 0.34, 10), GOLD, M(t.lx - 0.1, top + 0.68, cz), false);
      for (let i = 0; i < (low ? 4 : 9); i++) W(k, cyl(0.06, 0.06, 0.02, 8), GOLD, M(t.lx + 0.25 + (i % 3) * 0.1, top + 0.08 + Math.floor(i / 3) * 0.022, cz + (ti ? -0.45 : 0.45) + (i % 2) * 0.05), false);
      const bz = t.lz + (ti ? -0.35 : 0.35);   // gold bar pyramid
      for (const [bx, by, n] of [[0, 0, 3], [0, 1, 2], [0, 2, 1]]) for (let i = 0; i < n; i++) W(k, box(0.3, 0.1, 0.14), GOLD, M(t.lx + 0.15, top + 0.12 + by * 0.1, bz - (n - 1) * 0.08 + i * 0.16), false);
      for (let i = 0; i < (low ? 6 : 14); i++) W(k, new THREE.IcosahedronGeometry(0.07 + (i % 3) * 0.02, 0), GEMS[(i + ti) % GEMS.length], M(t.lx + 0.3 + ((i * 37) % 5) * 0.05 - 0.1, top + 0.1 + (i % 4) * 0.035, t.lz + (ti ? -1.0 : 1.0) + ((i * 53) % 7) * 0.04 - 0.12), false);   // gem pile
      W(k, cyl(0.07, 0.07, 0.7, 8), PARCH, M(t.lx - 0.25, top + 0.12, t.lz + (ti ? -1.05 : 1.05), 0, Math.PI / 2), false); W(k, box(0.55, 0.02, 0.42), PARCH, M(t.lx + 0.1, top + 0.09, t.lz + (ti ? 0.1 : -0.1), 0.3), false);   // maps
      for (let i = 0; i < 3; i++) W(k, new THREE.SphereGeometry(0.06, 8, 6), 0xf4efe6, M(t.lx + 0.35, top + 0.12, t.lz + (ti ? 0.15 : -0.15) + i * 0.13), false); });   // pearls
  });
  const kit = k.build(MATS, OUT); kit.name = 'treasure_trader_kit'; g.add(kit);
  // one merged sign mesh (every board shares the TREASURE TRADER canvas)
  const pos = [], uv = [], idx = []; let base = 0;
  for (const [w, h, m] of signs) { const pg = new THREE.PlaneGeometry(w, h); pg.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(OX, 0, OZ), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), YAW), new THREE.Vector3(1, 1, 1)).multiply(m));
    pos.push(...pg.attributes.position.array); uv.push(...pg.attributes.uv.array); idx.push(...Array.from(pg.index.array, v => v + base)); base += pg.attributes.position.count; pg.dispose(); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(idx);
  const tex = signTex(), sm = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); sm.name = 'treasure_trader_signs'; g.add(sm);
  document.fonts?.load?.('150px "Just Another Hand"').then(() => { const t2 = signTex(); sm.material.map = t2; sm.material.needsUpdate = true; tex.dispose(); }).catch(() => {});
  for (const [lx, y, lz, s] of lamps) { const sp = new THREE.Sprite(glowMat()); const [x, z] = t2w(lx, lz); sp.position.set(x, y, z); sp.scale.set(s, s, 1); sp.renderOrder = 2; g.add(sp); }   // warm lantern glow
  return g;
}
