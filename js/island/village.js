// [post-village] BANKSY t317u "Make it exactly like this, extend plaza, make the purple same road as hill street, each of those numbered
// buildings, move pet store one building up hill street". Town-local metres (north = -lz), traced from his numbered sketch over the
// minimap (HQ / Hill Street / Squad Hall calibration, 4.38 px/m). One table drives the roads, the ground, the buildings, colliders
// and the map. No three.js import here (tests + map read it).
export const VILLAGE_ON = !(typeof location !== 'undefined' && /[?&]village=0/.test(location.search));
// roads: Hill Street's gravel (colour 0xc9bfae, library layer 10), terrain-conforming. [lx0, lx1, lz0, lz1, name]
export const VILLAGE_ROADS = Object.freeze([
  [-122.5, 0, -119.2, -110.6, 'RUM ROW'],              // top road, joins Hill Street through the old pet store lot
  [-122.5, -17, -120.6, -119.2, 'RUM ROW'],              // north verge up to the lot 1-5 fronts (stops short of the pet store)
  [-122.5, -110.5, -110.6, -27.4, 'CUTLASS LANE'],     // west road down to the plaza
  [-50, -37, -110.6, -86, 'POWDER LANE'],              // middle road: drops from Rum Row ...
  [-76.5, -37, -86, -75, 'POWDER LANE'],               // ... jogs west ...
  [-76.5, -59, -75, -27.4, 'POWDER LANE'],             // ... and runs down to the plaza
]);
export const ROAD_LABELS = Object.freeze([['RUM ROW', -70, -114.9, 0], ['CUTLASS LANE', -116.5, -70, 1], ['POWDER LANE', -67.75, -50, 1]]);
// plaza extension (the dock plaza paving carried west under lots 21 / 22 / 23 and the two road mouths)
export const PLAZA_EXT = Object.freeze({ lx0: -146, lx1: -54, lz0: -27.4, lz1: -2 });
// lots: n = BANKSY's number; [lx0, lx1, lz0, lz1]; face = the road the door opens onto (N/S/E/W = -lz/+lz/+lx/-lx); fl = storeys
const L = (n, lx0, lx1, lz0, lz1, face, fl, fam) => ({ n, lx0, lx1, lz0, lz1, face, fl, fam });
export const VILLAGE_LOTS = Object.freeze([
  L(1, -125, -105, -137, -120.4, 'S', 2, 'y'), L(2, -102, -82, -137, -120.4, 'S', 3, 't'), L(3, -81, -61, -137, -120.4, 'S', 2, 'y'),
  L(4, -58, -38, -137, -120.4, 'S', 3, 't'), L(5, -35, -17.2, -137, -120.4, 'S', 2, 'y'),
  L(6, -145, -123.5, -123.5, -106, 'E', 3, 't'), L(10, -145, -123.5, -104.5, -87, 'E', 2, 'y'), L(13, -145, -123.5, -86, -69, 'E', 3, 't'),
  L(18, -145, -123.5, -68, -50.5, 'E', 2, 'y'), L(21, -145, -123.5, -49, -27.4, 'E', 3, 't'),
  L(7, -109.5, -77.5, -109.5, -86, 'N', 3, 'r'), L(8, -76, -51, -109.5, -98.5, 'N', 2, 'y'), L(11, -76, -51, -97.5, -87, 'S', 3, 't'),
  L(14, -109.5, -94, -85, -64, 'W', 2, 'y'), L(15, -92.5, -77.5, -83, -68.5, 'E', 3, 't'), L(19, -109.5, -96, -62, -48.5, 'W', 3, 't'),
  L(20, -92.5, -77.5, -67, -47.5, 'E', 2, 'y'), L(22, -109.5, -94, -47, -27.4, 'W', 2, 'y'), L(23, -92.5, -77.5, -46, -27.4, 'E', 3, 't'),
  L(17, -57.5, -37.5, -74, -62.5, 'N', 2, 'y'),
  L(9, -35, -15, -109.5, -97, 'W', 3, 't'), L(12, -35, -15, -96, -79, 'W', 2, 'y'), L(16, -35, -15, -78, -68.3, 'W', 3, 't'),
].sort((a, b) => a.n - b.n));
export const VILLAGE_HALL = Object.freeze({ h: 6.5, grand: 7.5, wall: .5, storey: 3.5 });   // tall walk-in hall; upper storeys are facade
// frame per lot: front centre, along-street width w, depth d, yaw (local +z = out the door), door point on the road
export function lotFrame(o) {
  const cx = (o.lx0 + o.lx1) / 2, cz = (o.lz0 + o.lz1) / 2, sx = o.lx1 - o.lx0, sz = o.lz1 - o.lz0;
  const F = { N: [0, -1, Math.PI], S: [0, 1, 0], E: [1, 0, Math.PI / 2], W: [-1, 0, -Math.PI / 2] }[o.face];
  const w = F[0] ? sz : sx, d = F[0] ? sx : sz;
  const fx = cx + F[0] * d / 2, fz = cz + F[1] * d / 2;
  return { cx, cz, w, d, yaw: F[2], nx: F[0], nz: F[1], fx, fz, door: { lx: +(fx + F[0] * 1.2).toFixed(2), lz: +(fz + F[1] * 1.2).toFixed(2) }, doorW: Math.min(4.2, w * .45) };
}
// floors: terrain height at each door point on the road (sampled from the live island before the village existed, snapped)
export const VILLAGE_FLOORS = Object.freeze({ 1: 11.99, 2: 12.75, 3: 11.12, 4: 9.36, 5: 8.8, 6: 11.71, 7: 11.43, 8: 9.93, 9: 7.69, 10: 9.79, 11: 6.91, 12: 7.48, 13: 7.19, 14: 6.53, 15: 6.02, 16: 6.51, 17: 6.65, 18: 4.9, 19: 4.71, 20: 5.02, 21: 3.53, 22: 3.54, 23: 3.54 });
export const floorOf = (o) => VILLAGE_FLOORS[o.n] ?? 3;
// rental data for the later rental system (ids stable, numbers = BANKSY's sketch)
export const VILLAGE_RENTALS = VILLAGE_LOTS.map(o => { const f = lotFrame(o), y = floorOf(o), b = (u, v) => ({ lx: +(f.cx + f.nx * v + (f.nz ? u : 0) * (f.nz ? -f.nz : 1) + (f.nx ? 0 : 0)).toFixed(2), lz: +(f.cz + f.nz * v + (f.nx ? u * f.nx : 0)).toFixed(2) });
  return Object.freeze({ id: 'village_' + o.n, lot: o.n, name: 'FOR RENT', grand: o.n === 7, door: { ...f.door, y }, facing: o.face, storeys: o.fl,
    slots: { counter: b(0, -f.d / 2 + 1.6), shelves: [b(-f.w / 2 + 1, 0), b(f.w / 2 - 1, 0)], sign: { ...f.door, y: y + 4.6 } } }); });
const inR = (r, lx, lz, m = 0) => lx > r[0] - m && lx < r[1] + m && lz > r[2] - m && lz < r[3] + m;
const BB = [-147, 1.5, -139, -2];
export function villageClear(lx, lz) {   // no trees / palms / grass tufts on the village roads, lots or the plaza extension
  if (!VILLAGE_ON || !inR(BB, lx, lz)) return false;
  for (const r of VILLAGE_ROADS) if (inR(r, lx, lz, 1)) return true;
  for (const o of VILLAGE_LOTS) if (inR([o.lx0, o.lx1, o.lz0, o.lz1], lx, lz, 2)) return true;
  const P = PLAZA_EXT; return lx > P.lx0 && lx < P.lx1 + 1 && lz > P.lz0 - 1 && lz < P.lz1;
}
export function villageGround(lx, lz, h, plazaY = 2.86) {
  if (!VILLAGE_ON || !inR(BB, lx, lz, 3)) return h;
  const P = PLAZA_EXT;
  if (lx > P.lx0 - 2 && lx < P.lx1 + 2 && lz > P.lz0 - 2 && lz < P.lz1) h = Math.min(h, plazaY - .06);   // plaza extension: level with the dock plaza
  for (const o of VILLAGE_LOTS) if (inR([o.lx0, o.lx1, o.lz0, o.lz1], lx, lz, 1.5)) h = Math.min(h, floorOf(o) - .08);   // nothing pokes through a hall floor
  return h;
}
