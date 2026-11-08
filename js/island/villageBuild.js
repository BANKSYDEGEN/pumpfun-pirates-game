// [post-village] v1 build of the BANKSY village (data: js/island/village.js). Roads = Hill/Main Street's own gravel (0xc9bfae, aMat 10,
// terrain-conforming strip), plaza extension = the dock slab paving, 23 rentals = the plaza stoneHouse look (ashlar, quoins, string
// courses, shuttered windows, timber balconies, tile roof, chimney) with ONE shared walk-in hall template: open doorway, tall
// beamed ceiling, colliders, a floor deck and a camera room. All merged into the plaza kit (no new draw calls per building, no lights).
import * as THREE from 'three';
import { VILLAGE_ON, VILLAGE_ROADS, VILLAGE_LOTS, VILLAGE_HALL, PLAZA_EXT, lotFrame, floorOf } from './village.js';
export function buildVillage(h, { camRoom, Y0, C }) {
  if (!VILLAGE_ON) return 0;
  const { k, W, box, cyl, M, at, addBox, T, H, low, yaw0 } = h, MASON = 11, TRIM = 22, TIMBER = 26;
  const STONES = [0xc9bfae, 0xb9b2a6, 0xd6c7a8, 0xa99f90], QUOIN = 0x8a837a, GRAVEL = 0xc9bfae;
  // ---- roads: Hill Street gravel strips, 1.25 m facets, 6 cm proud of the terrain ----
  const pos = [], step = 1.25, gy = (lx, lz) => { const [x, z] = T(lx, lz); return [x, H(x, z) + .06, z]; };
  for (const [x0, x1, z0, z1] of VILLAGE_ROADS) for (let a = x0; a < x1 - 1e-6; a += step) for (let b = z0; b < z1 - 1e-6; b += step) {
    const a1 = Math.min(x1, a + step), b1 = Math.min(z1, b + step), p = [gy(a, b), gy(a, b1), gy(a1, b1), gy(a1, b)];
    pos.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]); }
  // ---- plaza extension: the dock slab paving carried west (flat at the slab top; ground is cut under it in villageGround) ----
  { const P = PLAZA_EXT; for (let a = P.lx0; a < P.lx1 - 1e-6; a += 2) for (let b = P.lz0; b < P.lz1 - 1e-6; b += 2) {
    const a1 = Math.min(P.lx1 + .5, a + 2), b1 = Math.min(P.lz1, b + 2), v = (lx, lz) => { const [x, z] = T(lx, lz); return [x, Y0, z]; };
    const p = [v(a, b), v(a, b1), v(a1, b1), v(a1, b)]; pos.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]); } }
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    // facet winding is town-frame; force the normals up whatever the town->world handedness
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    W(k, g, GRAVEL, 10, null, false); }
  { const P = PLAZA_EXT, c = T((P.lx0 + P.lx1) / 2, (P.lz0 + P.lz1) / 2); h.addDeck?.({ id: 'village_plaza', x: c[0], z: c[1], hw: (P.lx1 - P.lx0) / 2, hl: (P.lz1 - P.lz0) / 2, yaw: yaw0, y: Y0 }); }
  // ---- buildings ----
  const rot = (f, u, v) => [f.cx + u * Math.cos(f.yaw) + v * Math.sin(f.yaw), f.cz - u * Math.sin(f.yaw) + v * Math.cos(f.yaw)];
  const wallBox = (f, u, v, a, b) => { const [lx, lz] = rot(f, u, v), sw = Math.abs(Math.cos(f.yaw)) > .5; addBox(...T(lx, lz), sw ? a : b, sw ? b : a, yaw0); };
  let n = 0;
  for (const o of VILLAGE_LOTS) {
    const f = lotFrame(o), y = floorOf(o), w = f.w - .6, d = f.d - .6, grand = o.n === 7, Hh = grand ? VILLAGE_HALL.grand : VILLAGE_HALL.h, t = VILLAGE_HALL.wall;
    const door = Math.min(4.2, w * .42), pier = (w - door) / 2, v = (o.n * 7) % 4, col = grand ? 0xb0453a : (o.fam === 't' ? [0x9fc7bf, 0x8db8b2][v & 1] : [0xe0c56e, 0xd9bb5f][v & 1]);
    const stone = STONES[v], sh = grand ? 0x6b1f1a : (o.fam === 't' ? 0x2f6f6a : 0xa77b1e), roof = grand ? 0x8e2f26 : C.ROOFS[v % C.ROOFS.length];
    let lo = y; for (const [u, q] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5], [0, 0], [0, .5], [0, -.5], [-.5, 0], [.5, 0]]) { const [lx, lz] = rot(f, u * w, q * d), [x, z] = T(lx, lz); lo = Math.min(lo, H(x, z)); }
    const ph = y - lo + .45, up = Math.max(0, o.fl - 2);   // the hall is two storeys tall; any 3rd storey sits on top
    at(f.cx, f.cz, f.yaw, () => {
      W(k, box(w + .6, ph, d + .6), QUOIN, TRIM, M(0, .12 - ph / 2, 0));                                   // plinth down into the ground
      W(k, box(w - 2 * t, .14, d - 2 * t), 0x6e4f33, TIMBER, M(0, .05, 0), false);                          // plank floor
      W(k, box(w, Hh, t), stone, MASON, M(0, Hh / 2, -d / 2 + t / 2));                                      // back
      for (const s of [-1, 1]) { W(k, box(t, Hh, d), stone, MASON, M(s * (w / 2 - t / 2), Hh / 2, 0));       // sides
        W(k, box(pier, Hh, t), stone, MASON, M(s * (door / 2 + pier / 2), Hh / 2, d / 2 - t / 2));        // front piers
        W(k, box(.55, 4.3, .6), QUOIN, TRIM, M(s * (door / 2 + .2), 2.15, d / 2), false);                  // door jambs
        for (const q of [-.25, .25]) { W(k, box(.14, 1.7, 1.2), 0x2b3d4a, 0, M(s * (w / 2 + .01), 3.2, q * d), false);   // side windows (plaza-facing walls too)
          W(k, box(.3, .25, 1.6), QUOIN, TRIM, M(s * (w / 2 + .1), 4.15, q * d), false);
          for (const e of [-1, 1]) W(k, box(.08, 1.7, .6), sh, TIMBER, M(s * (w / 2 + .14), 3.2, q * d + e * .92), false); }
        W(k, box(.8, Hh + up * 3.5, .8), QUOIN, TRIM, M(s * (w / 2 - .3), (Hh + up * 3.5) / 2, d / 2 - .3), false); }   // corner quoins
      W(k, box(door, Hh - 4.2, t), stone, MASON, M(0, 4.2 + (Hh - 4.2) / 2, d / 2 - t / 2));              // over the doorway
      W(k, box(door + 1.0, .5, .6), QUOIN, TRIM, M(0, 4.45, d / 2), false);                                  // lintel
      W(k, box(w - 2 * t, .3, d - 2 * t), 0x7a5a3c, TIMBER, M(0, Hh - .15, 0), false);                      // ceiling boards
      for (let z = -d / 2 + 2.2; z < d / 2 - 1; z += 3) W(k, box(w - 2 * t, .38, .4), C.WOOD_D, TIMBER, M(0, Hh - .5, z), false);   // beams
      W(k, box(Math.min(3.2, w * .4), 1.0, .8), C.WOOD, TIMBER, M(0, .55, -d / 2 + 1.6), false);           // counter
      for (const s of [-1, 1]) for (const yy of [1.2, 2.2]) W(k, box(.5, .08, Math.min(5, d * .5)), C.WOOD_D, TIMBER, M(s * (w / 2 - t - .25), yy, -d * .1), false);   // shelves
      for (const z of [-d * .2, d * .2]) { W(k, cyl(.02, .02, 1.2, 4), 0x222222, 0, M(0, Hh - 1.2, z), false);   // hanging lamps (emissive only)
        k.add(new THREE.SphereGeometry(.28, 8, 6), 0xffd36b, { bucket: 'glow', m: M(0, Hh - 1.9, z), outline: false }); }
      // facade: windows on the hall's upper half + the upper storey, timber balcony, string courses, eave, tile roof, gables, chimney
      W(k, box(w + .36, .3, d + .36), QUOIN, TRIM, M(0, Hh, 0), false);
      for (let fI = 0; fI <= up; fI++) {
        const y0 = fI === 0 ? Hh - 3.5 + .3 : Hh + (fI - 1) * 3.5;
        if (fI > 0) { W(k, box(w, 3.5, d), stone, MASON, M(0, y0 + 1.75, 0)); W(k, box(w + .36, .3, d + .36), QUOIN, TRIM, M(0, y0 + 3.5, 0), false); }
        const nw = Math.max(1, Math.floor(w / 3.4));
        for (let i = 0; i < nw; i++) { const wx = (i - (nw - 1) / 2) * (w / nw); if (fI === 0 && Math.abs(wx) < door / 2 + .9) continue;
          W(k, box(1.1, 1.5, .12), 0x2b3d4a, 0, M(wx, y0 + 1.7, d / 2 + .02), false); W(k, box(1.6, .3, .3), QUOIN, TRIM, M(wx, y0 + 2.6, d / 2 + .1), false);
          W(k, box(1.5, .18, .4), QUOIN, TRIM, M(wx, y0 + .9, d / 2 + .15), false);
          for (const s of [-1, 1]) W(k, box(.58, 1.5, .08), sh, TIMBER, M(wx + s * .88, y0 + 1.7, d / 2 + .22, s * .45), false); }
        if (fI === up && !low) { W(k, box(w - .8, .22, 1.3), C.WOOD, TIMBER, M(0, y0 + .1 + (fI ? 0 : .2), d / 2 + .65));
          W(k, box(w - .8, .12, .12), C.WOOD_D, TIMBER, M(0, y0 + 1.15, d / 2 + 1.25), false);
          for (let b = -(w - .8) / 2; b <= (w - .8) / 2 + .01; b += 1.0) W(k, box(.09, 1.0, .09), C.WOOD_L, TIMBER, M(b, y0 + .65, d / 2 + 1.25), false); }
      }
      W(k, box(w + .6, .5, .5), col, TRIM, M(0, Hh - 3.3, d / 2 + .1), false);                              // colour-family fascia band
      const top = Hh + up * 3.5; W(k, box(w + .2, .3, .3), C.WOOD_D, TIMBER, M(0, top - .2, d / 2 + .25), false);
      const pitch = .5, half = d / 2 + .8, slab = half / Math.cos(pitch), rise = Math.tan(pitch) * half;
      for (const s of [-1, 1]) W(k, box(w + 1.0, .32, slab), roof, 4, M(0, top + rise / 2, s * half / 2, 0, s * pitch));
      W(k, cyl(.26, .26, w + 1.1, 6), roof, 4, M(0, top + rise + .05, 0, 0, 0, Math.PI / 2), false);
      const gable = new THREE.BufferGeometry(); gable.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -d / 2, 0, 0, d / 2, 0, rise - .15, 0], 3)); gable.computeVertexNormals();
      for (const sx of [-1, 1]) { const g = gable.clone(); if (sx < 0) g.scale(-1, 1, 1); W(k, g, stone, MASON, M(sx * (w / 2 + .01), top, 0, sx > 0 ? 0 : Math.PI), false); }
      W(k, box(1.0, 2.6, 1.0), QUOIN, TRIM, M(w * .3, top + rise * .6 + 1.0, -d * .2));
      // FOR RENT hanging board (plain v1: bracket + board in the family colour)
      W(k, box(.1, .1, 1.3), 0x2a2a2a, 0, M(door / 2 + 1.0, 4.9, d / 2 + .65), false);
      W(k, box(.08, .8, 1.1), col, TIMBER, M(door / 2 + 1.0, 4.35, d / 2 + .75), false);
    }, y);
    // colliders: back, sides, front piers (town frame); floor deck incl. the threshold; camera room
    wallBox(f, 0, -d / 2 + t / 2, w, t); for (const s of [-1, 1]) { wallBox(f, s * (w / 2 - t / 2), 0, t, d); wallBox(f, s * (door / 2 + pier / 2), d / 2 - t / 2, pier, t); }
    wallBox(f, 0, -d / 2 + 1.6, Math.min(3.2, w * .4), .8);
    { const sw = Math.abs(Math.cos(f.yaw)) > .5, [lx, lz] = rot(f, 0, .3), c = T(lx, lz); h.addDeck?.({ id: 'village_' + o.n, x: c[0], z: c[1], hw: (sw ? w : d + .6) / 2 - .3, hl: (sw ? d + .6 : w) / 2 - .3, yaw: yaw0, y: y + .12 }); }
    { const a = rot(f, -w / 2 + t + .2, -d / 2 + t + .2), b = rot(f, w / 2 - t - .2, d / 2 - t - .2);
      camRoom({ id: 'village_' + o.n, lx0: Math.min(a[0], b[0]), lx1: Math.max(a[0], b[0]), lz0: Math.min(a[1], b[1]), lz1: Math.max(a[1], b[1]) }, Hh - .6, y); }
    n++;
  }
  return n;
}
