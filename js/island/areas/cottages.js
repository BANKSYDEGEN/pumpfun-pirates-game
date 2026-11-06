// [post/cottages] Charming red-roofed village at BANKSY's Build Mode LOCATION MARKERS
// (+mw2osffcajh8 / +mw2oslf9ghm9). Those stock houses are suppressed in terrainEdit while
// COTTAGES_ON; this area builds 4 bespoke cottages along ONE continuous cobblestone
// cottage_lane (pave:true → foot.js splat + buildKerbs, same as Trail A). NO path-ribbon box slabs
// slab clutter. Wishing well sits on the inner grass green, well clear of every path.
// Kill switch: &cottages=0.
import * as THREE from 'three';
import { Kit, M, box, cyl, ball, hash, W, C } from './common.js';

export const COTTAGES_ON = !(typeof location !== 'undefined' && /[?&]cottages=0(&|$)/.test(location.search));

// Marker anchors (foot world) — village sits around these, markers themselves are hidden.
export const LIVE_MARKERS = [
  { id: '+mw2osffcajh8', x: -380, y: 7.65, z: -146, ry: -1.05 },
  { id: '+mw2oslf9ghm9', x: -373, y: 7.57, z: -134, ry: -1.05 },
];

// Colonial palette — plaster chromaticities stay distinct from stone so libTex rules don't collide.
const ROOFS = [0xc8552e, 0xb8472a, 0xd2693a, 0xa94428];
const PLASTER = [0xfbf1dc, 0xf3d6a4, 0xe8c9a0, 0xf0e6d0]; // cream / ivory / sand / warm ivory
const SHUTTER = [0x2a6df4, 0x1f8a5a, 0x2b8fa3, 0xc0392b]; // blue / green / teal / red
const FH = 3.4;
const PLANKS = 0xc28a55; // weathered porch deck (libTex planks_weathered)

// ---- ONE continuous cobblestone crescent (joins live TRAIL_A at both ends) ----
// Ends are exact TRAIL_A spline points so cobbles + kerbs merge with zero grass gap.
export const LANE = [
  [-391.14, -155.97], // SW join on TRAIL_A
  [-384.00, -152.50],
  [-374.50, -147.00],
  [-367.50, -137.00], // east bulge
  [-370.50, -126.50],
  [-382.00, -120.50],
  [-396.00, -118.50],
  [-416.04, -119.28], // NW join on TRAIL_A
];

// Inner grassy village green (between TRAIL_A WSW and cottage_lane ENE). WELL ≥ 7 m from both.
export const WELL = { x: -391.0, z: -134.0 };
export const GREEN = { x: -392.0, z: -136.0 };

// 4 cottages on the OUTER arc. Each (x,z,ry) is derived from the lane Catmull spline:
//   pos = lanePt + outwardNormal * (2.95 + frontZ)
//   ry  = atan2(-outward.x, -outward.z)  → front door (+local Z) faces the lane
// so every front stoop lands on the outer kerb (~2.95 m from centerline).
export const COTTAGES = [
  // 1 SW: 2-story balcony, blue shutters — front step at 2.95 m from lane CL (outer kerb)
  { id: 'balcony', kind: 'balcony', x: -375.34, z: -157.54, ry: -0.4867, tint: 0, frontZ: 5.40, shut: 0 },
  // 2 SE: 1.5-story Tudor dormer, green shutters
  { id: 'dormer',  kind: 'dormer',  x: -359.48, z: -138.46, ry: -1.3910, tint: 1, frontZ: 5.20, shut: 1 },
  // 3 E/NE: 2-story gabled porch, teal shutters
  { id: 'gabled',  kind: 'gabled',  x: -369.88, z: -115.50, ry: -2.6347, tint: 2, frontZ: 6.30, shut: 2 },
  // 4 NE: 1-story garden cottage, red shutters
  { id: 'garden',  kind: 'garden',  x: -388.99, z: -111.15, ry: -3.0321, tint: 3, frontZ: 4.85, shut: 3 },
];

function glow(k, x, y, z, r = 0.18) {
  k.add(new THREE.SphereGeometry(r, 6, 4), 0xffd36b, { bucket: 'glow', m: M(x, y, z), outline: false });
}
function win(k, x, y, z, sh, lit = true) {
  W(k, box(1.25, 1.6, 0.16), C.WOOD_D, M(x, y, z + 0.04), false);
  k.add(box(0.95, 1.3, 0.08), lit ? 0xffcf6b : 0x2b3d4a, lit ? { bucket: 'glow', m: M(x, y, z + 0.1), outline: false } : { m: M(x, y, z + 0.1), outline: false, mat: 0 });
  W(k, box(0.07, 1.3, 0.05), C.WOOD_D, M(x, y, z + 0.15), false); // muntin |
  W(k, box(0.95, 0.07, 0.05), C.WOOD_D, M(x, y, z + 0.15), false); // muntin —
  W(k, box(1.5, 0.12, 0.35), C.STONE_D, M(x, y - 0.9, z + 0.18), false); // sill → stone_trim
  for (const s of [-1, 1]) W(k, box(0.55, 1.5, 0.06), sh, M(x + s * 0.92, y, z + 0.3, s * 0.45), false);
  // window flowerbox (attached under sill — not free-floating yard clutter)
  W(k, box(1.15, 0.22, 0.32), C.WOOD, M(x, y - 1.15, z + 0.4), false);
  for (let p = 0; p < 3; p++) k.add(new THREE.IcosahedronGeometry(0.11, 0), [0xff4f6d, 0xffd43b, 0xffffff][p], { m: M(x - 0.28 + p * 0.28, y - 0.95, z + 0.4), outline: false, mat: 0 });
}
function door(k, x, y, z) {
  W(k, box(1.85, 2.9, 0.28), C.STONE_D, M(x, y + 0.25, z + 0.05), false);
  W(k, box(1.35, 2.45, 0.14), 0x6e4325, M(x, y, z + 0.14), false);
  W(k, box(0.1, 0.1, 0.1), C.GOLD, M(x + 0.42, y - 0.05, z + 0.24), false);
  W(k, box(1.95, 0.22, 0.85), C.STONE_D, M(x, y - 1.35, z + 0.4), false); // doorstep
  W(k, box(0.08, 0.45, 0.25), C.IRON, M(x + 1.15, y + 1.2, z + 0.28), false);
  glow(k, x + 1.15, y + 1.05, z + 0.42, 0.16);
}
function gables(k, w, d, top, rise, wall) {
  const gable = new THREE.BufferGeometry();
  gable.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -d / 2 - 0.1, 0, 0, d / 2 + 0.1, 0, rise - 0.2, 0], 3));
  gable.computeVertexNormals();
  for (const sx of [-1, 1]) {
    const g = gable.clone(); if (sx < 0) g.scale(-1, 1, 1);
    W(k, g, wall, M(sx * (w / 2 + 0.25), top, 0, sx > 0 ? 0 : Math.PI), false);
  }
}
function pitchedRoof(k, w, d, top, roof, roof2) {
  const pitch = 0.6, half = d / 2 + 0.9, slab = half / Math.cos(pitch), rise = Math.tan(pitch) * half;
  for (const s of [-1, 1]) W(k, box(w + 1.4, 0.28, slab), roof, M(0, top + rise / 2, s * half / 2, 0, s * pitch));
  W(k, cyl(0.24, 0.24, w + 1.4, 6), roof2, M(0, top + rise + 0.04, 0, 0, 0, Math.PI / 2), false); // ridge beam
  return { pitch, half, rise };
}
function chimney(k, x, y, z) {
  W(k, box(0.9, 2.5, 0.9), C.STONE, M(x, y + 1.25, z));
  W(k, box(1.15, 0.25, 1.15), C.STONE_D, M(x, y + 2.6, z), false);
  W(k, cyl(0.16, 0.18, 0.35, 6), C.STONE_D, M(x, y + 2.9, z), false); // pot
}
// Deep stepped stone plinth (1.8 m below origin) so cottages never float on a slope.
function plinth(k, w, d) {
  W(k, box(w + 1.0, 1.8, d + 1.0), C.STONE_D, M(0, -0.55, 0)); // deep foundation
  W(k, box(w + 0.55, 0.35, d + 0.55), C.STONE, M(0, 0.40, 0), false); // visible plinth course
}

// ---- 1. Balcony cottage: 2-story stone & cream plaster, full-width timber balcony, blue shutters ----
function buildBalcony(k, tint, shut) {
  const wall = PLASTER[tint % PLASTER.length], sh = SHUTTER[shut], roof = ROOFS[tint % 4];
  const w = 9.0, d = 8.0;
  plinth(k, w, d);
  W(k, box(w, FH, d), C.STONE, M(0, 0.55 + FH / 2, 0));
  W(k, box(w + 0.12, 0.22, d + 0.12), C.WOOD_D, M(0, 0.55 + FH - 0.05, 0), false);
  W(k, box(w + 0.25, FH, d + 0.12), wall, M(0, 0.55 + FH + FH / 2, 0));
  // stone corner quoins
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 5; i++)
    W(k, box(0.5, 0.5, 0.5), i % 2 ? C.STONE : C.STONE_D, M(sx * (w / 2 + 0.02), 0.7 + i * 0.65, sz * (d / 2 + 0.02)), false);
  const top = 0.55 + 2 * FH;
  const { rise } = pitchedRoof(k, w, d, top, roof, ROOFS[(tint + 1) % 4]);
  gables(k, w, d, top, rise, wall);
  chimney(k, w * 0.28, top + rise * 0.45, -d * 0.18);
  door(k, 0, 1.7, d / 2);
  win(k, -2.8, 2.45, d / 2, sh, true); win(k, 2.8, 2.45, d / 2, sh, true);
  // full-width timber front balcony
  const by = 0.55 + FH;
  W(k, box(w - 0.6, 0.16, 1.4), PLANKS, M(0, by + 0.08, d / 2 + 0.7));
  W(k, box(w - 0.6, 0.1, 0.1), C.WOOD_D, M(0, by + 1.1, d / 2 + 1.3), false);
  for (let b = -(w - 0.8) / 2; b <= (w - 0.8) / 2 + 0.01; b += 0.38)
    W(k, cyl(0.035, 0.04, 0.95, 5), C.WOOD_L, M(b, by + 0.6, d / 2 + 1.3), false);
  for (const sx of [-1, 0, 1]) W(k, box(0.14, 0.8, 0.14), C.WOOD_D, M(sx * (w / 2 - 0.6), by - 0.2, d / 2 + 0.5, 0, 0.65), false);
  win(k, -2.5, by + 1.85, d / 2, sh, true); win(k, 0, by + 1.85, d / 2, sh, true); win(k, 2.5, by + 1.85, d / 2, sh, true);
  // balcony flower boxes
  for (const sx of [-2.4, 0, 2.4]) {
    W(k, box(1.05, 0.24, 0.32), C.WOOD, M(sx, by + 0.3, d / 2 + 1.2), false);
    for (let p = 0; p < 3; p++) k.add(new THREE.IcosahedronGeometry(0.12, 0), [0xff4f6d, 0xffd43b, 0xffffff][p], { m: M(sx - 0.28 + p * 0.28, by + 0.5, d / 2 + 1.2), outline: false, mat: 0 });
  }
}

// ---- 2. Dormer cottage: cozy 1.5-story Tudor half-timber, pitched porch roof, green shutters ----
function buildDormer(k, tint, shut) {
  const wall = PLASTER[tint % PLASTER.length], sh = SHUTTER[shut], roof = ROOFS[tint % 4];
  const w = 8.5, d = 7.5;
  plinth(k, w, d);
  W(k, box(w, FH * 1.15, d), C.STONE, M(0, 0.55 + FH * 0.575, 0));
  W(k, box(w + 0.12, 0.22, d + 0.12), C.WOOD_D, M(0, 0.55 + FH * 1.15 - 0.05, 0), false);
  // plaster attic band + flush Tudor half-timber on the front face
  const fy = 0.55 + FH * 1.15, ah = FH * 0.7;
  W(k, box(w + 0.15, ah, d + 0.08), wall, M(0, fy + ah / 2, 0));
  for (const sx of [-w / 2 + 0.12, w / 2 - 0.12, 0])
    W(k, box(0.18, ah - 0.05, 0.1), C.WOOD_D, M(sx, fy + ah / 2, d / 2 + 0.08), false);
  W(k, box(w + 0.15, 0.16, 0.1), C.WOOD_D, M(0, fy + 0.08, d / 2 + 0.08), false);
  W(k, box(w + 0.15, 0.16, 0.1), C.WOOD_D, M(0, fy + ah - 0.08, d / 2 + 0.08), false);
  for (const s of [-1, 1]) W(k, box(0.14, ah * 0.95, 0.08), C.WOOD_D, M(s * w * 0.22, fy + ah / 2, d / 2 + 0.09, 0, 0, s * 0.5), false);
  const top = fy + ah;
  const { rise } = pitchedRoof(k, w, d, top, roof, ROOFS[(tint + 1) % 4]);
  gables(k, w, d, top, rise, wall);
  // clean single front dormer (no intersecting boxes)
  W(k, box(2.2, 1.5, 1.5), wall, M(0, top + 0.15, d / 2 - 0.4));
  W(k, box(2.5, 0.18, 1.7), roof, M(0, top + 1.15, d / 2 + 0.15, 0, 0.35));
  W(k, box(2.5, 0.18, 1.5), roof, M(0, top + 1.15, d / 2 - 0.85, 0, -0.35));
  // dormer window (no free shutters overhanging)
  W(k, box(1.1, 1.15, 0.12), C.WOOD_D, M(0, top + 0.35, d / 2 + 0.4), false);
  k.add(box(0.85, 0.9, 0.06), 0xffcf6b, { bucket: 'glow', m: M(0, top + 0.35, d / 2 + 0.48), outline: false });
  W(k, box(0.06, 0.9, 0.04), C.WOOD_D, M(0, top + 0.35, d / 2 + 0.52), false);
  W(k, box(0.85, 0.06, 0.04), C.WOOD_D, M(0, top + 0.35, d / 2 + 0.52), false);
  chimney(k, -w * 0.25, top + rise * 0.35, -d * 0.2);
  door(k, 0, 1.7, d / 2);
  // pitched timber porch roof on two posts over the front door
  for (const sx of [-1.15, 1.15]) W(k, cyl(0.1, 0.12, 2.4, 6), C.WOOD_D, M(sx, 1.75, d / 2 + 1.35));
  W(k, box(3.0, 0.14, 1.7), PLANKS, M(0, 3.05, d / 2 + 0.85));
  W(k, box(3.2, 0.16, 1.9), roof, M(0, 3.25, d / 2 + 0.9, 0, 0.22));
  win(k, -2.55, 2.4, d / 2, sh, true); win(k, 2.55, 2.4, d / 2, sh, true);
}

// ---- 3. Gabled cottage: handsome 2-story with covered front porch, russet roof, teal shutters ----
function buildGabled(k, tint, shut) {
  const wall = PLASTER[tint % PLASTER.length], sh = SHUTTER[shut], roof = ROOFS[tint % 4];
  const w = 8.8, d = 8.2;
  plinth(k, w, d);
  W(k, box(w, FH, d), C.STONE, M(0, 0.55 + FH / 2, 0));
  W(k, box(w + 0.12, 0.22, d + 0.12), C.WOOD_D, M(0, 0.55 + FH - 0.05, 0), false);
  W(k, box(w + 0.22, FH, d + 0.1), wall, M(0, 0.55 + FH + FH / 2, 0));
  // half-timber belt on upper front
  W(k, box(w + 0.22, 0.16, 0.1), C.WOOD_D, M(0, 0.55 + FH + 0.1, d / 2 + 0.08), false);
  W(k, box(w + 0.22, 0.16, 0.1), C.WOOD_D, M(0, 0.55 + 2 * FH - 0.1, d / 2 + 0.08), false);
  for (const sx of [-w / 2 + 0.15, 0, w / 2 - 0.15])
    W(k, box(0.16, FH - 0.15, 0.1), C.WOOD_D, M(sx, 0.55 + FH + FH / 2, d / 2 + 0.08), false);
  const top = 0.55 + 2 * FH;
  const { rise } = pitchedRoof(k, w, d, top, roof, ROOFS[(tint + 1) % 4]);
  gables(k, w, d, top, rise, wall);
  chimney(k, w * 0.3, top + rise * 0.5, -d * 0.15);
  door(k, 0, 1.7, d / 2);
  // neat covered front porch
  W(k, box(4.0, 0.16, 2.2), PLANKS, M(0, 0.65, d / 2 + 1.1));
  for (const sx of [-1.6, 1.6]) W(k, cyl(0.11, 0.13, 2.55, 6), C.WOOD_D, M(sx, 0.65 + 1.25, d / 2 + 2.0));
  W(k, box(4.3, 0.18, 2.5), roof, M(0, 3.35, d / 2 + 1.2, 0, 0.2));
  // porch side rails
  for (const sx of [-1, 1]) {
    W(k, box(0.08, 0.7, 1.6), C.WOOD_D, M(sx * 1.9, 1.05, d / 2 + 1.2), false);
    W(k, box(0.1, 0.1, 1.6), C.WOOD, M(sx * 1.9, 1.4, d / 2 + 1.2), false);
  }
  win(k, -2.7, 2.45, d / 2, sh, true); win(k, 2.7, 2.45, d / 2, sh, true);
  win(k, -2.4, 2.45 + FH, d / 2, sh, true); win(k, 0, 2.45 + FH, d / 2, sh, true); win(k, 2.4, 2.45 + FH, d / 2, sh, true);
}

// ---- 4. Garden cottage: charming 1-story stone+plaster, covered stoop, chimney ----
function buildGarden(k, tint, shut) {
  const wall = PLASTER[tint % PLASTER.length], sh = SHUTTER[shut], roof = ROOFS[tint % 4];
  const w = 7.4, d = 6.4;
  plinth(k, w, d);
  W(k, box(w, FH, d), C.STONE, M(0, 0.55 + FH / 2, 0));
  W(k, box(w + 0.12, 0.22, d + 0.12), C.WOOD_D, M(0, 0.55 + FH - 0.05, 0), false);
  // short plaster loft band under the eaves
  W(k, box(w + 0.18, 0.7, d + 0.08), wall, M(0, 0.55 + FH + 0.3, 0));
  const top = 0.55 + FH + 0.7;
  const { rise } = pitchedRoof(k, w, d, top, roof, ROOFS[(tint + 1) % 4]);
  gables(k, w, d, top, rise, wall);
  chimney(k, w * 0.28, top + rise * 0.4, -d * 0.15);
  door(k, 0, 1.7, d / 2);
  // covered front stoop
  W(k, box(2.8, 0.14, 1.55), PLANKS, M(0, 0.62, d / 2 + 0.85));
  for (const sx of [-1.1, 1.1]) W(k, cyl(0.09, 0.1, 2.15, 5), C.WOOD_D, M(sx, 1.65, d / 2 + 1.4));
  W(k, box(3.0, 0.14, 1.75), roof, M(0, 2.85, d / 2 + 0.9, 0, 0.18));
  win(k, -2.2, 2.35, d / 2, sh, true); win(k, 2.2, 2.35, d / 2, sh, true);
}

const BUILDERS = { balcony: buildBalcony, dormer: buildDormer, gabled: buildGabled, garden: buildGarden };
export const COL_SIZES = { balcony: [9.8, 8.8], dormer: [9.2, 8.2], gabled: [9.6, 9.0], garden: [8.0, 7.0] };

// Trail-A-matching lantern (torchPost style: dark wood post + iron cap + glow)
function lanternPost(k, x, y, z) {
  W(k, cyl(0.1, 0.14, 2.6, 6), C.WOOD_D, M(x, y + 1.3, z));
  W(k, cyl(0.28, 0.18, 0.38, 8), C.IRON, M(x, y + 2.7, z), false);
  glow(k, x, y + 2.65, z, 0.2);
}
function bush(k, x, z, H, r = 0.55) {
  const y = H(x, z);
  W(k, ball(r, 7, 5), hash(x | 0, z | 0) > 0.5 ? 0x3c9a3e : 0x2f8a3a, M(x, y + r * 0.7, z, 0, 0, 0, [1, 0.75, 1]), false);
}
function well(k, x, z, H) {
  const y = H(x, z);
  // circular flat stone rim/pad on the grass (y = H + 0.04) — well sits on pad, NOT on cobbles
  W(k, cyl(2.15, 2.15, 0.1, 14), C.STONE, M(x, y + 0.04, z), false);
  W(k, cyl(1.95, 1.95, 0.06, 14), C.STONE_D, M(x, y + 0.1, z), false);
  W(k, cyl(1.05, 1.15, 1.1, 10), C.STONE, M(x, y + 0.65, z));
  W(k, cyl(1.2, 1.2, 0.22, 10), C.STONE_D, M(x, y + 1.25, z), false);
  W(k, cyl(0.7, 0.7, 0.08, 8), 0x1a3040, M(x, y + 1.05, z), false);
  for (const s of [-1, 1]) W(k, box(0.14, 1.6, 0.14), C.WOOD_D, M(x + s * 0.95, y + 2.0, z));
  W(k, box(2.2, 0.12, 1.4), C.WOOD, M(x, y + 2.85, z, 0, 0.15));
  W(k, box(2.35, 0.08, 0.12), C.WOOD_D, M(x, y + 2.95, z), false);
  W(k, cyl(0.05, 0.05, 1.5, 5), C.IRON, M(x, y + 2.1, z, 0, 0, Math.PI / 2), false);
  W(k, cyl(0.12, 0.12, 0.35, 6), C.WOOD_L, M(x + 0.55, y + 1.95, z), false);
}
function bench(k, x, z, H, yaw) {
  // yaw = facing direction (backrest at local -Z); pass atan2 toward the well
  const y = H(x, z);
  k.at(M(x, y, z, yaw), () => {
    W(k, box(1.6, 0.12, 0.5), C.WOOD, M(0, 0.45, 0));
    W(k, box(1.6, 0.5, 0.1), C.WOOD_D, M(0, 0.7, -0.22), false); // backrest
    for (const s of [-1, 1]) W(k, box(0.12, 0.45, 0.45), C.WOOD_D, M(s * 0.65, 0.22, 0), false);
  });
}
function flowerBarrel(k, x, z, H) {
  const y = H(x, z);
  W(k, cyl(0.38, 0.42, 0.7, 8), C.WOOD, M(x, y + 0.35, z));
  W(k, cyl(0.4, 0.4, 0.08, 8), C.WOOD_D, M(x, y + 0.72, z), false);
  for (let p = 0; p < 4; p++) {
    const a = p * Math.PI / 2;
    k.add(new THREE.IcosahedronGeometry(0.13, 0), [0xff4f6d, 0xffd43b, 0xffffff, 0xb36bff][p], {
      m: M(x + Math.cos(a) * 0.18, y + 0.9, z + Math.sin(a) * 0.18), outline: false, mat: 0,
    });
  }
}
// Low stone threshold/apron at each cottage front step — bridges stoop to cobbled road edge.
function frontApron(k, c, H) {
  // Stone threshold bridging porch/stoop → cobbled kerb (front step sits ~2.95 m from lane CL).
  const ox = Math.sin(c.ry), oz = Math.cos(c.ry);
  const sx = c.x + ox * c.frontZ, sz = c.z + oz * c.frontZ;
  const y0 = H(sx, sz);
  // Upper step flush with doorstep, lower step reaching onto the cobbles
  W(k, box(2.5, 0.18, 1.1), C.STONE, M(sx - ox * 0.15, y0 + 0.16, sz - oz * 0.15, c.ry), false);
  W(k, box(2.7, 0.16, 1.4), C.STONE_D, M(sx + ox * 0.7, y0 + 0.06, sz + oz * 0.7, c.ry), false);
  W(k, box(2.9, 0.12, 1.1), C.STONE, M(sx + ox * 1.5, y0 + 0.02, sz + oz * 1.5, c.ry), false);
}
// Deep foundation skirt sampled against terrain corners so nothing floats / buries a door.
function foundationSkirt(k, c, H) {
  const [bw, bd] = COL_SIZES[c.kind] || [8, 7];
  const cy = H(c.x, c.z);
  let lo = cy;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = (bw / 2) * sx, lz = (bd / 2) * sz;
    const wx = c.x + Math.sin(c.ry) * lz + Math.cos(c.ry) * lx;
    const wz = c.z + Math.cos(c.ry) * lz - Math.sin(c.ry) * lx;
    lo = Math.min(lo, H(wx, wz));
  }
  const depth = Math.max(1.6, cy - lo + 1.2);
  W(k, box(bw + 0.6, depth, bd + 0.6), C.STONE_D, M(c.x, cy - depth / 2 + 0.15, c.z, c.ry), false);
}

// ---- foliage / grass clearance (foot.js foliageSpots + grassOK) ----
// Oriented AABB in cottage local space: walls + 3.5 m margin (porch / apron / eaves).
export function clearAt(x, z) {
  if (!COTTAGES_ON) return false;
  if (Math.hypot(x - WELL.x, z - WELL.z) < 4.0) return true;
  for (const c of COTTAGES) {
    const [bw, bd] = COL_SIZES[c.kind] || [8, 7];
    const dx = x - c.x, dz = z - c.z;
    const lx = dx * Math.cos(c.ry) - dz * Math.sin(c.ry);
    const lz = dx * Math.sin(c.ry) + dz * Math.cos(c.ry);
    // Extra +Z margin covers the front porch + stone apron beyond the footprint
    const mx = bw / 2 + 3.5, mzBack = bd / 2 + 3.5, mzFront = Math.max(bd / 2, c.frontZ || 4.5) + 3.5;
    if (Math.abs(lx) <= mx && lz >= -mzBack && lz <= mzFront) return true;
  }
  return false;
}
// Tighter pad check for grass tufts (floors / porch / apron / well rim) — no blades through stone.
export function indoorOrPadAt(x, z) {
  if (!COTTAGES_ON) return false;
  if (Math.hypot(x - WELL.x, z - WELL.z) < 2.2) return true; // well stone rim pad
  for (const c of COTTAGES) {
    const [bw, bd] = COL_SIZES[c.kind] || [8, 7];
    const dx = x - c.x, dz = z - c.z;
    const lx = dx * Math.cos(c.ry) - dz * Math.sin(c.ry);
    const lz = dx * Math.sin(c.ry) + dz * Math.cos(c.ry);
    const mx = bw / 2 + 0.6, mzBack = bd / 2 + 0.6, mzFront = Math.max(bd / 2, c.frontZ || 4.5) + 1.8;
    if (Math.abs(lx) <= mx && lz >= -mzBack && lz <= mzFront) return true;
  }
  return false;
}

// [wish] same kill / reveal rules as the plaza fountain (hillRound.js)
export const WISH_ON = !(typeof location !== 'undefined' && /[?&]wish=0(&|$)/.test(location.search));
function wishHidden() {
  if (typeof window === 'undefined') return true;
  if (/[?&]wish=1(&|$)/.test(location.search)) return false;
  return !(window.PFP_INV_FLAGS && window.PFP_INV_FLAGS.wish_fountain);
}
// Approachable rim on the SE side of the well (toward cottage_lane / green open), outside the 1.5 m collider.
export const WELL_RIM = { x: WELL.x + 1.45, z: WELL.z + 0.85 };


const area = {
  id: 'cottages',
  name: 'Cottage Neighborhood',
  rect: [-425, -345, -175, -100],
  terrain: {
    pads: [],
    // ONE clean pave:true lane — foot.js paints Main Street cobbles + buildKerbs places ±2.8 m kerbs.
    // Do NOT also draw path-ribbon slabs on top (that was the jagged grey clutter).
    paths: COTTAGES_ON ? [{ id: 'cottage_lane', pts: LANE, pave: true }] : [],
    cuts: [],
  },
  register(h) {
    if (!COTTAGES_ON) return;
    // Single POI (map draws one label): clear 38 m covers all 4 outer-arc cottages + well + lane
    h.poi('cottage_green', 'Cottage neighborhood', -380, -135, { clear: 38 });
    for (const c of COTTAGES) {
      const [bw, bd] = COL_SIZES[c.kind] || [8, 7];
      h.addBox(c.x, c.z, bw, bd, c.ry);
    }
    h.addCirc(WELL.x, WELL.z, 1.5);
    // bench colliders on the green
    h.addCirc(WELL.x - 3.2, WELL.z + 2.0, 0.55);
    h.addCirc(WELL.x + 3.0, WELL.z - 1.8, 0.55);
    // [wish] E / tap at the well rim (same flag as plaza fountain). r=2.8 reaches a player outside the 1.5 m well collider.
    if (WISH_ON) h.INTERACT?.push({ id: 'cottage_well', kind: 'wish', area: 'cottages', x: WELL_RIM.x, z: WELL_RIM.z, r: 2.8, label: 'E · TOSS A COIN (100 gold)', hidden: wishHidden });
  },
  build({ MATS, OUT, low, H }) {
    if (!COTTAGES_ON) {
      const empty = new THREE.Group(); empty.name = 'area_cottages_off';
      return { near: empty, far: null };
    }
    const k = new Kit(), near = new THREE.Group(), far = new THREE.Group();
    near.name = 'area_cottages'; far.name = 'area_cottages_far';

    for (const c of COTTAGES) {
      foundationSkirt(k, c, H);
      const y = H(c.x, c.z), build = BUILDERS[c.kind];
      k.at(M(c.x, y, c.z, c.ry), () => build(k, c.tint, c.shut));
      frontApron(k, c, H);
      // neat manicured bushes tucked at porch corners (not random field clutter)
      const bx = c.x + Math.sin(c.ry) * (c.frontZ - 0.8);
      const bz = c.z + Math.cos(c.ry) * (c.frontZ - 0.8);
      const px = Math.cos(c.ry), pz = -Math.sin(c.ry);
      bush(k, bx + px * 2.4, bz + pz * 2.4, H, 0.5);
      bush(k, bx - px * 2.4, bz - pz * 2.4, H, 0.45);
    }

    // Wishing well on the INNER grass green — never on the cobbles
    well(k, WELL.x, WELL.z, H);
    // Two benches facing the well (backrest away from well)
    {
      const b1 = { x: WELL.x - 3.2, z: WELL.z + 2.0 };
      const b2 = { x: WELL.x + 3.0, z: WELL.z - 1.8 };
      const yaw1 = Math.atan2(WELL.x - b1.x, WELL.z - b1.z);
      const yaw2 = Math.atan2(WELL.x - b2.x, WELL.z - b2.z);
      bench(k, b1.x, b1.z, H, yaw1);
      bench(k, b2.x, b2.z, H, yaw2);
      flowerBarrel(k, WELL.x - 1.8, WELL.z - 2.6, H);
      flowerBarrel(k, WELL.x + 2.2, WELL.z + 2.4, H);
    }

    // Street lanterns along the INNER kerb of cottage_lane (3.3 m off centerline, never in the path)
    const lanterns = [
      [-385.48, -149.55],
      [-373.59, -141.25],
      [-373.01, -128.64],
      [-387.68, -122.53],
      [-405.06, -121.98],
    ];
    for (const [x, z] of lanterns) lanternPost(k, x, H(x, z), z);

    const g = k.build(MATS, OUT);
    g.traverse(o => { if (o.isMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); } });
    near.add(g);

    // Cheap far impostors
    const kf = new Kit();
    for (const c of COTTAGES) {
      const y = H(c.x, c.z), [bw, bd] = COL_SIZES[c.kind] || [8, 7];
      const h = c.kind === 'garden' ? 5.2 : 7.2;
      W(kf, box(bw * 0.9, h, bd * 0.9), PLASTER[c.tint % PLASTER.length], M(c.x, y + h / 2, c.z, c.ry), false);
      W(kf, box(bw, 0.35, bd * 0.55), ROOFS[c.tint % 4], M(c.x, y + h + 0.4, c.z, c.ry), false);
    }
    W(kf, cyl(1.1, 1.1, 1.2, 8), C.STONE, M(WELL.x, H(WELL.x, WELL.z) + 0.6, WELL.z), false);
    const fg = kf.build(MATS, OUT);
    fg.traverse(o => { if (o.isMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); } });
    far.add(fg);

    // [wish] gold coin flips from the rim into the well water, then a white ripple (identical feel to plaza fountain)
    const waterY = H(WELL.x, WELL.z) + 1.06;
    const rimY = H(WELL_RIM.x, WELL_RIM.z) + 1.15;
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.018, 12),
      new THREE.MeshStandardMaterial({ color: 0xffcd3c, metalness: 0.8, roughness: 0.3 }),
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
    );
    coin.visible = false; ring.rotation.x = -Math.PI / 2; ring.visible = false; near.add(coin, ring);
    let wishT = -1;
    const coinTarget = { x: WELL.x, y: waterY, z: WELL.z };
    const wishAt = (dt) => {
      const k = Math.min(1, dt / 0.8);
      coin.visible = k < 1;
      coin.position.set(
        WELL_RIM.x + (coinTarget.x - WELL_RIM.x) * k,
        rimY + 1.3 + 1.2 * k - 1.9 * k * k,
        WELL_RIM.z + (coinTarget.z - WELL_RIM.z) * k,
      );
      coin.rotation.x = dt * 14;
      const r = Math.max(0, (dt - 0.8) / 1.4);
      ring.visible = r > 0 && r < 1;
      ring.position.set(coinTarget.x, coinTarget.y + 0.02, coinTarget.z);
      ring.scale.setScalar(1 + r * 7);
      ring.material.opacity = 0.7 * (1 - r);
      return dt < 2.2;
    };
    return {
      near, far,
      wish: () => { wishT = 0; },
      tick(t) {
        if (wishT >= 0) {
          if (wishT === 0) wishT = t;
          if (!wishAt(t - wishT)) { wishT = -1; coin.visible = ring.visible = false; }
        }
      },
    };
  },
  // [wish] E / tap at the rim → pvp.js 'pfp-wish' (100 gold + lucky buff); splash runs our coin/ripple
  activate(q, t, api, b) {
    if (q?.id !== 'cottage_well' || typeof window === 'undefined') return null;
    window.dispatchEvent(new CustomEvent('pfp-wish', { detail: { toast: (m, ms) => api?.toast?.(m, ms), splash: () => b?.wish?.() } }));
    return null;
  },
  label() { return null; },
};

export default area;
