// [post-village] the BANKSY village (data: js/island/village.js). [v3] graded roads (straight profiles, flat across, kerbs like the dock
// plaza / Main Street gravel), terraced rows wall to wall, a 0.17 m gap between the plank slab and the stone base (no floor flicker),
// doorways clear (no band / balcony / board / collider in the bay), balconies on upper storeys only and never over the door bay,
// the Hill Street rent-shop interior (plaster walls + ceiling, plank floor, corner posts, beams, baluster counter, wall shelves, hanging
// lantern, TO RENT board), FOR RENT hanging boards (the plaza sign atlas), painted light pools (one additive mesh, no lights).
import * as THREE from 'three';
import { VILLAGE_ON, VILLAGE_ROADS, VILLAGE_LOTS, VILLAGE_HALL, PLAZA_EXT, lotFrame, floorOf, roadY } from './village.js';
const POOLS = [];   // [x, y, z, r] foot-world, filled by buildVillage, drawn by buildVillagePools
export function buildVillage(h, { camRoom, Y0, C, sign }) {
  if (!VILLAGE_ON) return 0;
  const { k, W, box, cyl, M, at, addBox, T, low, yaw0 } = h, MASON = 11, TRIM = 22, TIMBER = 26, PLASTER = 24, PLANKS = 27;
  const STONES = [0xc9bfae, 0xb9b2a6, 0xd6c7a8, 0xa99f90, 0xcfc2a2, 0xb5ab9a], QUOIN = 0x8a837a, GRAVEL = 0xc9bfae;
  const ROOFS = [...C.ROOFS, 0x8e4a2c, 0x6f5546, 0xa8542e];
  POOLS.length = 0;
  const lotsDoors = VILLAGE_LOTS.map(o => lotFrame(o).door);
  const inRect = (r, lx, lz, m = 0) => lx > r.lx0 - m && lx < r.lx1 + m && lz > r.lz0 - m && lz < r.lz1 + m;
  // ---- roads: flat across, straight along (the graded profile), 5 cm proud of the cut ground ----
  const pos = [], step = 1.25;
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (const r of VILLAGE_ROADS) { const v = (lx, lz) => { const [x, z] = T(lx, lz); return [x, roadY(r, lx, lz) + .05, z]; };
    for (let a = r.lx0; a < r.lx1 - 1e-6; a += step) for (let b = r.lz0; b < r.lz1 - 1e-6; b += step) { const a1 = Math.min(r.lx1, a + step), b1 = Math.min(r.lz1, b + step); quad(v(a, b), v(a, b1), v(a1, b1), v(a1, b)); } }
  { const P = PLAZA_EXT, v = (lx, lz) => { const [x, z] = T(lx, lz); return [x, Y0, z]; };
    for (let a = P.lx0; a < P.lx1 - 1e-6; a += 2) for (let b = P.lz0; b < P.lz1 - 1e-6; b += 2) { const a1 = Math.min(P.lx1 + .5, a + 2), b1 = Math.min(P.lz1, b + 2); quad(v(a, b), v(a, b1), v(a1, b1), v(a1, b)); } }
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    W(k, g, GRAVEL, 10, null, false); }
  { const P = PLAZA_EXT, c = T((P.lx0 + P.lx1) / 2, (P.lz0 + P.lz1) / 2); h.addDeck?.({ id: 'village_plaza', x: c[0], z: c[1], hw: (P.lx1 - P.lx0) / 2, hl: (P.lz1 - P.lz0) / 2, yaw: yaw0, y: Y0 }); }
  // ---- kerbs: dressed stone along both long edges; open at junctions, the plaza, Hill Street and every door ----
  const kr = [];
  for (const r of VILLAGE_ROADS) { const along = r.ax === 'x', L0 = along ? r.lx0 : r.lz0, L1 = along ? r.lx1 : r.lz1;
    for (const side of [0, 1]) for (let a = L0; a < L1 - .3; a += step) { const a1 = Math.min(L1, a + step), am = (a + a1) / 2;
      const e = along ? (side ? r.lz1 - .15 : r.lz0 + .15) : (side ? r.lx1 - .15 : r.lx0 + .15), o = along ? (side ? r.lz1 + .7 : r.lz0 - .7) : (side ? r.lx1 + .7 : r.lx0 - .7);
      const lx = along ? am : e, lz = along ? e : am, ox = along ? am : o, oz = along ? o : am;
      if (ox > -3 || VILLAGE_ROADS.some(q => q !== r && inRect(q, ox, oz)) || inRect(PLAZA_EXT, ox, oz, .5)) continue;
      if (lotsDoors.some(d => Math.hypot(d.lx - lx, d.lz - lz) < 3.4)) continue;
      const [x, z] = T(lx, lz), y = roadY(r, lx, lz); W(k, box(along ? a1 - a - .04 : .3, .34, along ? .3 : a1 - a - .04), QUOIN, TRIM, M(x, y + .02, z, yaw0), false);
      kr.push([side, along, e, a, a1]); }
    // [v4] kerb colliders: one box per unbroken run (not per stone)
    kr.sort((p, q) => p[0] - q[0] || p[3] - q[3]);
    for (let i = 0; i < kr.length;) { let j = i; while (j + 1 < kr.length && kr[j + 1][0] === kr[i][0] && Math.abs(kr[j + 1][3] - kr[j][4]) < .01) j++;
      const [, al, e, a] = kr[i], a1 = kr[j][4], m = (a + a1) / 2, L = a1 - a; if (L > .5) addBox(...T(al ? m : e, al ? e : m), al ? L : .3, al ? .3 : L, yaw0); i = j + 1; }
    kr.length = 0; }
  // ---- buildings ----
  const rot = (f, u, v) => [f.cx + u * Math.cos(f.yaw) + v * Math.sin(f.yaw), f.cz - u * Math.sin(f.yaw) + v * Math.cos(f.yaw)];
  const wallBox = (f, u, v, a, b) => { const [lx, lz] = rot(f, u, v), sw = Math.abs(Math.cos(f.yaw)) > .5; addBox(...T(lx, lz), sw ? a : b, sw ? b : a, yaw0); };
  let n = 0;
  for (const o of VILLAGE_LOTS) {
    const f = lotFrame(o), y = floorOf(o), w = f.w - .1, d = f.d - .1, grand = o.n === 7, Hh = grand ? VILLAGE_HALL.grand : VILLAGE_HALL.h, t = VILLAGE_HALL.wall;
    const v = (o.n * 7 + 3) % 6, du = f.du, door = Math.min(4.0, w * .36), dl = du - door / 2, dr = du + door / 2;
    const col = grand ? 0xb0453a : (o.fam === 't' ? [0x3f8f88, 0x2f6f6a, 0x4c9a8f][v % 3] : [0xd9b44a, 0xc99a2e, 0xe0c56e][v % 3]);
    const stone = grand ? 0xd9cbb0 : STONES[v], sh = grand ? 0x6b1f1a : (o.fam === 't' ? [0x2f6f6a, 0x1f4f5a, 0x35706a][v % 3] : [0xa77b1e, 0x7a4a1e, 0x8a5a24][v % 3]);
    const roof = grand ? 0x8e2f26 : ROOFS[(o.n * 5) % ROOFS.length], quoin = [QUOIN, 0x9a8f80, 0x7d756b][o.n % 3], boxes = o.n % 2 === 0, up = Math.max(0, o.fl - 2);
    let lo = y; for (const [u, q] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5], [0, 0], [0, .5], [0, -.5], [-.5, 0], [.5, 0]]) { const [lx, lz] = rot(f, u * w, q * d), [x, z] = T(lx, lz); lo = Math.min(lo, h.H(x, z)); }
    const ph = Math.max(.4, y - lo + .5), top = Hh + up * 3.5;
    at(f.cx, f.cz, f.yaw, () => {
      W(k, box(w + .3, ph, d + .3), quoin, TRIM, M(0, -.05 - ph / 2, 0));                                   // stone base: top 0.17 m under the slab
      W(k, box(w - 2 * t, .2, d - 2 * t), 0xa0703f, PLANKS, M(0, .02, 0));                                   // plank slab (top = floor + 0.12)
      W(k, box(w, Hh, t), stone, MASON, M(0, Hh / 2, -d / 2 + t / 2));                                      // back wall
      for (const s of [-1, 1]) W(k, box(t, Hh, d), stone, MASON, M(s * (w / 2 - t / 2), Hh / 2, 0));         // party walls
      { const pl = dl + w / 2, pr = w / 2 - dr; if (pl > .05) W(k, box(pl, Hh, t), stone, MASON, M(-w / 2 + pl / 2, Hh / 2, d / 2 - t / 2));
        if (pr > .05) W(k, box(pr, Hh, t), stone, MASON, M(w / 2 - pr / 2, Hh / 2, d / 2 - t / 2)); }
      W(k, box(door, Hh - 4.3, t), stone, MASON, M(du, 4.3 + (Hh - 4.3) / 2, d / 2 - t / 2));                 // over the doorway
      for (const s of [-1, 1]) W(k, box(.5, 4.3, .55), quoin, TRIM, M(du + s * (door / 2 + .25), 2.15, d / 2 + .02), false);   // jambs (outside the bay)
      W(k, box(door + 1.0, .45, .55), quoin, TRIM, M(du, 4.52, d / 2 + .02), false);                          // lintel
      // Hill Street rent-shop interior: plaster lining + ceiling, plank floor, corner posts, beams, baluster counter, shelves, lantern, TO RENT
      const iw = w - 2 * t, id = d - 2 * t, PL = 0xb7c4a6;
      W(k, box(iw, Hh - .4, .04), PL, PLASTER, M(0, (Hh - .4) / 2 + .12, -d / 2 + t + .02), false);
      for (const s of [-1, 1]) W(k, box(.04, Hh - .4, id), PL, PLASTER, M(s * (iw / 2 - .02), (Hh - .4) / 2 + .12, 0), false);
      W(k, box(iw, .12, id), PL, PLASTER, M(0, Hh - .3, 0), false);
      for (let z = -id / 2 + 2.4; z < id / 2 - 1; z += 3.2) W(k, box(iw, .4, .4), 0x4a2c18, TIMBER, M(0, Hh - .55, z), false);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) W(k, box(.32, Hh - .4, .32), 0x4a2c18, TIMBER, M(sx * (iw / 2 - .2), (Hh - .4) / 2 + .12, sz * (id / 2 - .2)), false);
      const cw = Math.min(3.6, iw * .45), cz0 = -id / 2 + 2.0;
      W(k, box(cw, .14, 1.0), 0xb07a45, TIMBER, M(0, 1.15, cz0), false); W(k, box(cw - .2, .95, .8), 0x6b4226, TIMBER, M(0, .6, cz0), false);
      for (let b = -cw / 2 + .3; b < cw / 2 - .2; b += .4) W(k, box(.06, .8, .06), 0x2a1a10, 0, M(b, .62, cz0 + .43), false);
      for (const s of [-1, 1]) for (const yy of [1.3, 2.1, 2.9]) W(k, box(.45, .07, Math.min(6, id * .55)), 0xb07a45, TIMBER, M(s * (iw / 2 - .26), yy, -id * .05), false);
      for (const z of id > 12 ? [-id * .22, id * .22] : [0]) { W(k, cyl(.02, .02, 1.3, 4), 0x222222, 0, M(0, Hh - 1.0, z), false); W(k, box(.42, .6, .42), 0x1d1d1d, 0, M(0, Hh - 1.95, z), false);
        k.add(new THREE.BoxGeometry(.3, .44, .3), 0xffc46b, { bucket: 'glow', m: M(0, Hh - 1.95, z), outline: false });
        const [lx, lz] = rot(f, 0, z), [x, zz] = T(lx, lz); POOLS.push([x, y + .14, zz, Math.min(5.5, iw * .42)]); }
      // facade: stone storey(s) over the tall hall, shuttered windows, window boxes, balconies (upper storeys only, never over the door bay)
      W(k, box(w + .3, .3, d + .3), col, TRIM, M(0, Hh, 0), false);                                          // family-colour string course (above the door)
      for (const sx of [-1, 1]) W(k, box(.75, top, .75), quoin, TRIM, M(sx * (w / 2 - .3), top / 2, d / 2 - .3), false);
      const nw = Math.max(2, Math.floor(w / 3.4)), wins = Array.from({ length: nw }, (_, i) => (i - (nw - 1) / 2) * (w / nw));
      for (let fI = 0; fI <= up; fI++) {
        const y0 = fI === 0 ? Hh - 3.2 : Hh + (fI - 1) * 3.5;
        if (fI > 0) { W(k, box(w, 3.5, d), stone, MASON, M(0, y0 + 1.75, 0)); W(k, box(w + .3, .26, d + .3), quoin, TRIM, M(0, y0 + 3.5, 0), false); }
        for (const wx of wins) { if (fI === 0 && Math.abs(wx - du) < door / 2 + .95) continue;
          W(k, box(1.1, 1.5, .12), 0x2b3d4a, 0, M(wx, y0 + 1.7, d / 2 + .02), false); W(k, box(1.6, .3, .3), quoin, TRIM, M(wx, y0 + 2.6, d / 2 + .1), false);
          W(k, box(1.5, .18, .4), quoin, TRIM, M(wx, y0 + .9, d / 2 + .15), false);
          for (const s of [-1, 1]) W(k, box(.58, 1.5, .08), sh, TIMBER, M(wx + s * .88, y0 + 1.7, d / 2 + .22, s * .45), false);
          if (boxes && fI > 0) { W(k, box(1.3, .3, .35), 0x5a3a20, TIMBER, M(wx, y0 + .72, d / 2 + .35), false); W(k, box(1.2, .22, .3), 0x3f8f3a, 0, M(wx, y0 + .95, d / 2 + .35), false); } }
        if (fI >= 1 && fI === up && !low && o.n % 3 !== 0) {   // balcony segments either side of the door bay
          for (const [a, b] of [[-w / 2 + .4, dl - 1.0], [dr + 1.0, w / 2 - .4]]) { if (b - a < 2.2) continue; const cx = (a + b) / 2, L = b - a;
            W(k, box(L, .22, 1.3), C.WOOD, TIMBER, M(cx, y0 + .1, d / 2 + .65)); W(k, box(L, .12, .12), col, TIMBER, M(cx, y0 + 1.15, d / 2 + 1.25), false);
            for (let bb = a; bb <= b + .01; bb += .9) W(k, box(.09, 1.0, .09), C.WOOD_L, TIMBER, M(bb, y0 + .65, d / 2 + 1.25), false);
            for (const e of [a + .3, b - .3]) W(k, box(.2, .9, .2), C.WOOD_D, TIMBER, M(e, y0 - .3, d / 2 + .55, 0, .75), false); } }
      }
      W(k, box(w + .2, .3, .3), C.WOOD_D, TIMBER, M(0, top - .2, d / 2 + .25), false);
      const pitch = .5, half = d / 2 + .6, slab = half / Math.cos(pitch), rise = Math.tan(pitch) * half;
      for (const s of [-1, 1]) W(k, box(w + .3, .32, slab), roof, 4, M(0, top + rise / 2, s * half / 2, 0, s * pitch));   // eaves stop at the party walls
      W(k, cyl(.26, .26, w + .3, 6), roof, 4, M(0, top + rise + .05, 0, 0, 0, Math.PI / 2), false);
      const gable = new THREE.BufferGeometry(); gable.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -d / 2, 0, 0, d / 2, 0, rise - .15, 0], 3)); gable.computeVertexNormals();
      for (const sx of [-1, 1]) { const g = gable.clone(); if (sx < 0) g.scale(-1, 1, 1); W(k, g, stone, MASON, M(sx * (w / 2 - .02), top, 0, sx > 0 ? 0 : Math.PI), false); }
      W(k, box(1.0, 2.6, 1.0), quoin, TRIM, M((o.n % 2 ? .3 : -.3) * w, top + rise * .6 + 1.0, -d * .2));
      // FOR RENT hanging board bracket (beside the door bay, 3.2 m up, clear of the opening)
      const sx = dr + 1.7 < w / 2 - .6 ? dr + 1.7 : dl - 1.7;   // [v4] bigger, readable board (2.4 x 1.2), well clear of the opening
      W(k, box(.12, .12, 2.1), 0x2a2a2a, 0, M(sx, 4.25, d / 2 + 1.05), false); W(k, box(.07, .7, .07), 0x2a2a2a, 0, M(sx, 3.95, d / 2 + .15), false);
      for (const s2 of [-1, 1]) W(k, box(.03, .55, .03), 0x2a2a2a, 0, M(sx + s2 * 1.0, 3.95, d / 2 + 1.35), false);
      if (sign) { const [lx, lz] = rot(f, sx, d / 2 + 1.35), yy = y + 3.1, ly = f.yaw + Math.PI / 2;
        sign('village_rent', 2.4, 1.2, lx, yy, lz, ly); sign('village_rent', 2.4, 1.2, lx, yy, lz, ly + Math.PI); }   // [v4] back-wall TO RENT board dropped (perf)
    }, y);
    if (o.annex) { const [a0, a1, b0, b1] = o.annex, cx = (a0 + a1) / 2, cz = (b0 + b1) / 2, aw = a1 - a0, ad = b1 - b0, hh = top0(o);
      at(cx, cz, 0, () => { W(k, box(aw, hh + 1.5, ad), STONES[2], MASON, M(0, (hh + 1.5) / 2 - 1.5, 0));
        for (const s of [-1, 1]) W(k, box(aw + .4, .32, ad / 2 / Math.cos(.5) + .3), ROOFS[(o.n * 5) % ROOFS.length], 4, M(0, hh + Math.tan(.5) * ad / 4, s * ad / 4, 0, s * .5)); }, y);
      addBox(...T(cx, cz), aw, ad, yaw0); }
    // colliders: back, party walls, door piers (never across the bay), counter; floor deck incl. the threshold; camera room
    wallBox(f, 0, -d / 2 + t / 2, w, t); for (const s of [-1, 1]) wallBox(f, s * (w / 2 - t / 2), 0, t, d);
    { const pl = dl + w / 2, pr = w / 2 - dr; if (pl > .05) wallBox(f, -w / 2 + pl / 2, d / 2 - t / 2, pl, t); if (pr > .05) wallBox(f, w / 2 - pr / 2, d / 2 - t / 2, pr, t); }
    wallBox(f, 0, -(d - 2 * t) / 2 + 2.0, Math.min(3.6, (w - 2 * t) * .45), 1.0);
    { const sw = Math.abs(Math.cos(f.yaw)) > .5, [lx, lz] = rot(f, 0, .35), c = T(lx, lz); h.addDeck?.({ id: 'village_' + o.n, x: c[0], z: c[1], hw: (sw ? w : d + .7) / 2 - .3, hl: (sw ? d + .7 : w) / 2 - .3, yaw: yaw0, y: y + .12 }); }
    { const a = rot(f, -w / 2 + t + .2, -d / 2 + t + .2), b = rot(f, w / 2 - t - .2, d / 2 - t - .2);
      camRoom({ id: 'village_' + o.n, lx0: Math.min(a[0], b[0]), lx1: Math.max(a[0], b[0]), lz0: Math.min(a[1], b[1]), lz1: Math.max(a[1], b[1]) }, Hh - .6, y); }
    n++;
  }
  // [v4] Outfit store west wing: carries the shop front out to Powder Lane (x -59); the GLB store, its interior and doors are untouched
  { const a0 = -58.9, a1 = -54.05, b0 = -47.9, b1 = -30.1, cx = (a0 + a1) / 2, cz = (b0 + b1) / 2, aw = a1 - a0, ad = b1 - b0;
    const yr = roadY(VILLAGE_ROADS.find(r => r.lx1 === -59 && r.lz1 === -27.4) || VILLAGE_ROADS[0], -60, cz);
    let lo = yr; for (const u of [0, .5, 1]) for (const v of [0, .5, 1]) lo = Math.min(lo, h.H(...T(a0 + u * aw, b0 + v * ad)));
    const Hw = 6.4, base = yr + .1, ph = base - lo + .6;
    at(cx, cz, 0, () => {
      W(k, box(aw + .3, ph, ad + .3), QUOIN, TRIM, M(0, -ph / 2, 0));
      W(k, box(aw, Hw, ad), 0xe6dccb, PLASTER, M(0, Hw / 2, 0));
      W(k, box(aw + .4, .45, ad + .4), 0x6b4a2a, TIMBER, M(0, Hw + .2, 0));
      for (const z of [-6, 0, 6]) { W(k, box(.12, 2.6, 4.2), 0x1d2a30, 0, M(-aw / 2 - .05, 2.1, z), false);                // shop windows on the lane
        k.add(new THREE.BoxGeometry(.1, 2.3, 3.9), 0xffd89a, { bucket: 'glow', m: M(-aw / 2 - .02, 2.1, z), outline: false });
        W(k, box(1.3, .08, 4.6), [0x2f6f6a, 0xb0453a, 0xd9b44a][(z / 6 + 1) | 0], 0, M(-aw / 2 - .65, 3.75, z, 0, 0, -.35), false); }
      W(k, box(.14, 3.4, 1.8), 0x5a3a22, TIMBER, M(-aw / 2 - .06, 1.7, -8.2), false);                                  // side door (shut)
    }, base);
    addBox(...T(cx, cz), aw, ad, yaw0);
    if (sign) { const [x, z] = [a0 - .1, cz]; sign('village_outfit', 7.5, 1.0, x, base + 5.2, z, -Math.PI / 2); } }
  // [v4] coped retaining walls wherever the cut behind / beside a lot would show a raw grass slope
  { const inAny = (lx, lz) => VILLAGE_LOTS.some(q => lx > q.lx0 - q.m - .2 && lx < q.lx1 + q.m + .2 && lz > q.lz0 - q.m - .2 && lz < q.lz1 + q.m + .2 || (q.annex && lx > q.annex[0] - .5 && lx < q.annex[1] + .5 && lz > q.annex[2] - .5 && lz < q.annex[3] + .5))
      || VILLAGE_ROADS.some(r => inRect(r, lx, lz, 1)) || inRect(PLAZA_EXT, lx, lz, 1) || lx > -34;
    for (const o of VILLAGE_LOTS) { const y = floorOf(o), m = o.m + .1, X0 = o.lx0 - m, X1 = o.lx1 + m, Z0 = o.lz0 - m, Z1 = o.lz1 + m;
      for (const [ax, c, a0, a1, s] of [[1, Z0, X0, X1, -1], [1, Z1, X0, X1, 1], [0, X0, Z0, Z1, -1], [0, X1, Z0, Z1, 1]])
        for (let a = a0; a < a1 - .2; a += 2) { const b = Math.min(a1, a + 2), mid = (a + b) / 2, ox = ax ? mid : c + s * 1.6, oz = ax ? c + s * 1.6 : mid;
          if (inAny(ox, oz)) continue; const ho = h.H(...T(ox, oz)); if (ho - y < .45) continue;
          const hh = ho - y + .45, [x, z] = T(ax ? mid : c + s * .22, ax ? c + s * .22 : mid);
          W(k, box(ax ? b - a + .02 : .45, hh, ax ? .45 : b - a + .02), STONES[1], MASON, M(x, y - .3 + hh / 2, z, yaw0));
          W(k, box(ax ? b - a + .1 : .6, .14, ax ? .6 : b - a + .1), QUOIN, TRIM, M(x, y - .3 + hh + .07, z, yaw0), false); } } }
  return n;
}
function top0(o) { return (o.n === 7 ? VILLAGE_HALL.grand : VILLAGE_HALL.h) + Math.max(0, o.fl - 2) * 3.5 - 1.5; }
// painted light pools under the lanterns: ONE additive mesh (radial canvas, 128 px), no lights
export function buildVillagePools() {
  if (!VILLAGE_ON || !POOLS.length) return null;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,196,110,0.55)'); gr.addColorStop(.5, 'rgba(255,170,80,0.22)'); gr.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const geos = POOLS.map(([x, y, z, r]) => { const p = new THREE.PlaneGeometry(2 * r, 2 * r); p.rotateX(-Math.PI / 2); p.translate(x, y + .02, z); return p; });
  const pos = [], uv = [], idx = []; let b = 0; for (const p of geos) { pos.push(...p.attributes.position.array); uv.push(...p.attributes.uv.array); idx.push(...Array.from(p.index.array, v => v + b)); b += p.attributes.position.count; p.dispose(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.name = 'village_pools'; m.renderOrder = 2; return m;
}
