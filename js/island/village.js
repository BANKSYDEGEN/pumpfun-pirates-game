// [post-village] BANKSY t317u "Make it exactly like this, extend plaza, make the purple same road as hill street, each of those numbered
// buildings, move pet store one building up hill street". Town-local metres (north = -lz), traced from his numbered sketch over the
// minimap (HQ / Hill Street / Squad Hall calibration, 4.38 px/m). One table drives the roads, the ground, the buildings, colliders
// and the map. No three.js import here (tests + map read it).
// Emergency town safety pause (BANKSY Nov 8): default OFF, including colliders / decks / map / terrain cuts.
// Local QA may compare the old art; production URLs cannot re-enable it.
export const villageEnabledFor = (env = globalThis) => !!(env.location && /^(localhost|127\.0\.0\.1)$/.test(env.location.hostname) && new URLSearchParams(env.location.search).get('village') === '1');
export const VILLAGE_ON = villageEnabledFor();
// roads: Hill Street's gravel (colour 0xc9bfae, library layer 10). [v3] GRADED: each road has its own straight profile (knots along its
// long axis), flat across the width, with flat landings at the junctions; the ground is cut / filled to it (villageGround).
export const STREET_Y = 2.73;                                   // the dock plaza slab top (plazaTown STREET_Y)
const RUM = [[-124, 11.9], [-108, 11.9], [-52, 9.6], [-35, 9.6], [-2, 10.15]];   // landings at Cutlass Lane, Powder Lane, Hill Street
const prof = (K, a) => { if (a <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (a <= K[i][0]) { const [a0, h0] = K[i - 1], [a1, h1] = K[i]; return h0 + (h1 - h0) * (a - a0) / (a1 - a0); } return K[K.length - 1][1]; };
const R = (lx0, lx1, lz0, lz1, name, ax, K) => Object.freeze({ 0: lx0, 1: lx1, 2: lz0, 3: lz1, 4: name, lx0, lx1, lz0, lz1, name, ax, K, length: 5 });
export const VILLAGE_ROADS = Object.freeze([
  R(-122.5, -2, -119.2, -110.6, 'RUM ROW', 'x', RUM),                       // top road, joins Hill Street through the old pet store lot
  R(-122.5, -16.4, -120.4, -119.2, 'RUM ROW', 'x', RUM),                     // north verge up to the lot 1-5 fronts (stops short of the pet store)
  R(-122.5, -110.5, -110.6, -27.4, 'CUTLASS LANE', 'z', [[-110.6, 11.9], [-27.4, STREET_Y]]),
  R(-50, -37, -110.6, -86, 'POWDER LANE', 'z', [[-110.6, 9.6], [-86, 7.0]]),  // drops from Rum Row ...
  R(-76.5, -37, -86, -75, 'POWDER LANE', 'z', [[-86, 7.0], [-75, 7.0]]),       // ... a flat landing jogging west ...
  R(-76.5, -59, -75, -27.4, 'POWDER LANE', 'z', [[-75, 7.0], [-27.4, STREET_Y]]),   // ... and down to the plaza
]);
export const roadY = (r, lx, lz) => prof(r.K, r.ax === 'x' ? lx : lz);
export function roadAt(lx, lz) { let best = null, bd = 1e9; for (const r of VILLAGE_ROADS) { const dx = Math.max(r.lx0 - lx, 0, lx - r.lx1), dz = Math.max(r.lz0 - lz, 0, lz - r.lz1), d = Math.hypot(dx, dz); if (d < bd) { bd = d; best = r; } } return { r: best, d: bd }; }
export const ROAD_LABELS = Object.freeze([['RUM ROW', -70, -114.9, 0], ['CUTLASS LANE', -116.5, -70, 1], ['POWDER LANE', -67.75, -50, 1]]);
// plaza extension (the dock plaza paving carried west under lots 21 / 22 / 23 and the two road mouths)
export const PLAZA_EXT = Object.freeze({ lx0: -146, lx1: -54, lz0: -27.4, lz1: -2 });
// lots: n = BANKSY's number; [lx0, lx1, lz0, lz1]; face = the road the door opens onto (N/S/E/W = -lz/+lz/+lx/-lx); fl = storeys
const L = (n, lx0, lx1, lz0, lz1, face, fl, fam, m = 1.5) => ({ n, lx0, lx1, lz0, lz1, face, fl, fam, m });
// [v3] BANKSY "extend any buildings that have gaps between them": terraced rows, wall to wall, fronts on the road edges
export const VILLAGE_LOTS = Object.freeze([
  L(1, -122.6, -103.5, -137, -120.4, 'S', 2, 'y'), L(2, -103.5, -82, -137, -120.4, 'S', 3, 't'), L(3, -82, -60, -137, -120.4, 'S', 2, 'y'),
  L(4, -60, -38, -137, -120.4, 'S', 3, 't'), L(5, -38, -16.4, -137, -120.4, 'S', 2, 'y'),
  { ...L(6, -145, -122.6, -137, -105.25, 'E', 3, 't'), du: -6.6 },   // door bay onto the Rum Row / Cutlass corner
  L(10, -145, -122.6, -105.25, -86.5, 'E', 2, 'y'), L(13, -145, -122.6, -86.5, -68.5, 'E', 3, 't'),
  L(18, -145, -122.6, -68.5, -49, 'E', 2, 'y'), L(21, -145, -122.6, -49, -27.4, 'E', 3, 't'),
  L(7, -110.4, -76.6, -110.5, -86.1, 'N', 3, 'r'), L(8, -76.6, -50.1, -110.5, -98.25, 'N', 2, 'y'), L(11, -76.6, -50.1, -98.25, -86.1, 'S', 3, 't'),
  L(14, -110.4, -93.5, -86.1, -64.5, 'W', 2, 'y'), L(15, -93.5, -76.6, -86.1, -68, 'E', 3, 't'), L(19, -110.4, -93.5, -64.5, -47, 'W', 3, 't'),
  L(20, -93.5, -76.6, -68, -47, 'E', 2, 'y'), L(22, -110.4, -93.5, -47, -27.4, 'W', 2, 'y'), L(23, -93.5, -76.6, -47, -27.4, 'E', 3, 't'),
  L(17, -58.9, -37, -74.9, -62.5, 'N', 2, 'y'),
  { ...L(24, -58.9, -44.8, -62.5, -48.6, 'W', 3, 't', .3), annex: [-44.8, -35, -62.5, -58.0] },   // BANKSY pt323u + "make it big": 14.1 m deep + the closed back wing over the old yard strip
  L(9, -36.9, -12, -110.5, -98.25, 'W', 3, 't'), L(12, -36.9, -12, -98.25, -86.1, 'W', 2, 'y'), L(16, -36.9, -12, -86.1, -68.3, 'W', 3, 't'),
].sort((a, b) => a.n - b.n));
export const VILLAGE_HALL = Object.freeze({ h: 6.5, grand: 7.5, wall: .5, storey: 3.5 });   // tall walk-in hall; upper storeys are facade
// frame per lot: front centre, along-street width w, depth d, yaw (local +z = out the door), door point on the road
export function lotFrame(o) {
  const cx = (o.lx0 + o.lx1) / 2, cz = (o.lz0 + o.lz1) / 2, sx = o.lx1 - o.lx0, sz = o.lz1 - o.lz0;
  const F = { N: [0, -1, Math.PI], S: [0, 1, 0], E: [1, 0, Math.PI / 2], W: [-1, 0, -Math.PI / 2] }[o.face];
  const w = F[0] ? sz : sx, d = F[0] ? sx : sz;
  const fx = cx + F[0] * d / 2, fz = cz + F[1] * d / 2;
  const u = o.du || 0, tx = Math.cos(F[2]) * u, tz = -Math.sin(F[2]) * u;   // door bay offset along the frontage (local x)
  return { cx, cz, w, d, yaw: F[2], nx: F[0], nz: F[1], fx, fz, du: u, door: { lx: +(fx + tx + F[0] * 1.2).toFixed(2), lz: +(fz + tz + F[1] * 1.2).toFixed(2) }, doorW: Math.min(4.2, w * .45) };
}
// floors: the graded road level at each door (re-seated on the v3 road profiles), +0.15 m slab
export const floorOf = (o) => { const f = lotFrame(o), { r } = roadAt(f.door.lx, f.door.lz); return +(roadY(r, f.door.lx, f.door.lz) + .03).toFixed(2); };
// rental data for the later rental system (ids stable, numbers = BANKSY's sketch)
export const VILLAGE_RENTALS = (VILLAGE_ON ? VILLAGE_LOTS : []).map(o => { const f = lotFrame(o), y = floorOf(o), b = (u, v) => ({ lx: +(f.cx + f.nx * v + (f.nz ? u : 0) * (f.nz ? -f.nz : 1) + (f.nx ? 0 : 0)).toFixed(2), lz: +(f.cz + f.nz * v + (f.nx ? u * f.nx : 0)).toFixed(2) });
  return Object.freeze({ id: 'village_' + o.n, lot: o.n, name: 'FOR RENT', grand: o.n === 7, door: { ...f.door, y }, facing: o.face, storeys: o.fl,
    slots: { counter: b(0, -f.d / 2 + 1.6), shelves: [b(-f.w / 2 + 1, 0), b(f.w / 2 - 1, 0)], sign: { ...f.door, y: y + 4.6 } } }); });
const inR = (r, lx, lz, m = 0) => lx > r[0] - m && lx < r[1] + m && lz > r[2] - m && lz < r[3] + m;
const BB = [-147, 1.5, -139, -2];
export function villageClear(lx, lz) {   // no trees / palms / grass tufts on the village roads, lots or the plaza extension
  if (!VILLAGE_ON || !inR(BB, lx, lz)) return false;
  for (const r of VILLAGE_ROADS) if (inR(r, lx, lz, 1)) return true;
  for (const o of VILLAGE_LOTS) if (inR([o.lx0, o.lx1, o.lz0, o.lz1], lx, lz, 2) || (o.annex && inR(o.annex, lx, lz, 2))) return true;
  const P = PLAZA_EXT; return lx > P.lx0 && lx < P.lx1 + 1 && lz > P.lz0 - 1 && lz < P.lz1;
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function villageGround(lx, lz, h, plazaY = STREET_Y) {
  if (!VILLAGE_ON || !inR(BB, lx, lz, 5)) return h;
  const P = PLAZA_EXT;
  if (lx > P.lx0 - 2 && lx < P.lx1 + 2 && lz > P.lz0 - 2 && lz < P.lz1) h = Math.min(h, plazaY - .06);   // plaza extension: level with the dock plaza
  // roads: cut / fill to the profile, 4 cm under the gravel; a 4 m smooth shoulder back to the hill (none over Hill Street)
  if (lx < -2.5) { let wsum = 0, ysum = 0, hard = null;
    for (const r of VILLAGE_ROADS) { const dx = Math.max(r.lx0 - lx, 0, lx - r.lx1), dz = Math.max(r.lz0 - lz, 0, lz - r.lz1), d = Math.hypot(dx, dz);
      if (d > 4) continue; const y = roadY(r, Math.min(r.lx1, Math.max(r.lx0, lx)), Math.min(r.lz1, Math.max(r.lz0, lz))) - .04;
      if (d === 0) { hard = hard === null ? y : Math.min(hard, y); continue; } const w = 1 - sm(0, 4, d); wsum += w; ysum += y * w; }
    if (hard !== null) h = hard; else if (wsum > 0) { const w = Math.min(1, wsum); h = h * (1 - w) + (ysum / wsum) * w; } }
  for (const o of VILLAGE_LOTS) { if (inR([o.lx0, o.lx1, o.lz0, o.lz1], lx, lz, o.m)) h = Math.min(h, floorOf(o) - .35);   // well under the slab: no floor flicker
    if (o.annex && inR(o.annex, lx, lz, .3)) h = Math.min(h, floorOf(o) + .2); }
  return h;
}

// [v3] the village rentals in the Hill Street RENTABLE_SHOPS shape (js/island/hillShops.js): same fields, flat floors (slope 0), so anything
// that reads a hill rent shop (moneyMakers inShop, a rental system) reads these the same way. ALL_RENTABLE = hill + village.
export const VILLAGE_RENTABLE = (VILLAGE_ON ? VILLAGE_LOTS : []).map(o => { const f = lotFrame(o), y = floorOf(o), t = VILLAGE_HALL.wall + .3;
  const a = [f.cx - (f.nz ? f.w : f.d) / 2 + t, f.cz - (f.nz ? f.d : f.w) / 2 + t], b = [f.cx + (f.nz ? f.w : f.d) / 2 - t, f.cz + (f.nz ? f.d : f.w) / 2 - t];
  const ly = Math.atan2(f.nx, f.nz);
  return Object.freeze({ id: 'village_' + o.n, lot: 'V' + o.n, lx: f.cx, lz: f.cz, ly, w: f.w, d: f.d, storeys: o.fl, door: { lx: f.door.lx, lz: f.door.lz }, doorY: y,
    doorW: f.doorW, facing: ly, interior: { lx0: a[0], lz0: a[1], lx1: b[0], lz1: b[1], floorY: { atLz0: y + .15, atLz1: y + .15 }, slope: 0 }, sign: 'sign_village_' + o.n, empty: 'door_village_' + o.n, village: true }); });
