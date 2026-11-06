// [map-streets] PUMPFUN PIRATES · named island districts + streets (BANKSY t1717u / t1718u / t1719u).
// Single source of truth for Full Map / Minimap HUD / Treasure Chart / 3D street signs.
// Foot frame (north = -z). Town→world matches js/island/coast.js + js/island/foot.js (yaw -π/2):
//   x = -640 - lz,  z = -90 + lx. Pure data — no three.js — so tests + maps never drift apart.
const TOWN = { x: -640, z: -90 };
export const tw = (lx, lz) => [TOWN.x - lz, TOWN.z + lx];

const catmull = (pts, closed = false, step = 6) => {
  const out = [], n = pts.length, P = (i) => pts[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), k = Math.max(2, Math.ceil(L / step));
    for (let s = 0; s < k; s++) {
      const t = s / k, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (closed) out.push(out[0].slice()); else out.push(pts[n - 1].slice());
  return out;
};
export const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};
export const polyDist = (x, z, pts) => {
  let d = 1e9; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(x, z, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return d;
};
const polyLen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
export const along = (pts, u) => {
  const want = Math.max(0, Math.min(1, u)) * polyLen(pts); let a = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (a + L >= want || i === pts.length - 1) {
      const t = L ? (want - a) / L : 0;
      const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, z = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
      const ang = Math.atan2(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      return { x, z, ang };
    }
    a += L;
  }
  return { x: pts[0][0], z: pts[0][1], ang: 0 };
};

// Mirrored from js/island/foot.js TRAIL_A / TRAIL_B (coast mode default).
const GATE = tw(6, -205);
const TRAIL_A_CTRL = [GATE, [-428, -100], [-380, -170], [-292, -262], [-170, -330], [-20, -400], [110, -330], [230, -262], [300, -150], [190, -100], [44, -149], [26, -151], [17, -150], [16, -144], [16, -110], [16, -82], [16, -56], [10, -44], [-30, -32], [-120, -40], [-300, -64]];
const TRAIL_B_CTRL = [[-120, -40], [-150, 60], [-140, 170], [-100, 290], [-30, 400], [20, 500], [40, 540], [150, 420], [198, 292], [232, 252], [196, 150], [130, 150], [40, 60], [-30, -10]];
const CRIMSON_PTS = catmull(TRAIL_A_CTRL, true, 8);
const DOUBLOON_PTS = catmull(TRAIL_B_CTRL, true, 8);

// plazaTown.js JETTY_LX / FACADE_LZ; cottages.js LANE; digSpots.js JUNGLE_TRAILHEAD; coliseum MAIN_GATE; fort LEG*; battery RAMP.
const FACADE_LZ = -30;
const JETTY_LX = [-150, -98, -46, 6, 58];
const COTTAGE_LANE = [[-391.14, -155.97], [-384, -152.5], [-374.5, -147], [-367.5, -137], [-370.5, -126.5], [-382, -120.5], [-396, -118.5], [-416.04, -119.28]];
const COTTAGE_GREEN = { x: -392, z: -136 };
const TH = { x: 4.7, z: -395.9, dx: 0.951, dz: 0.309 };
const MAIN_GATE = { lx: 14, lz: -114.761, d: 29, shellLx: 55 };
const SWIM = { lx: -244, lz: -48 };
const FORT_TL = { lx: 46, lz: -232 };
const BATTERY_TL = { lx: 160, lz: 42 };
const COLI = { lx0: 34, lx1: 88, lz0: -200, lz1: -72 };

const HIGHGATE_PTS = [tw(6, -58), tw(6, -205)];
const MARKET_PTS = [tw(-55, FACADE_LZ), tw(100, FACADE_LZ)];
const GUNPOWDER_PTS = [tw(18.5, -71), tw(18.5, -93.9), tw(18.3, -105), tw(14, -114.8)];
const GLADIATOR_PTS = [tw(MAIN_GATE.lx, MAIN_GATE.lz), tw(MAIN_GATE.lx + MAIN_GATE.d * 0.55, MAIN_GATE.lz), tw(MAIN_GATE.shellLx, MAIN_GATE.lz)];
const CITADEL_PTS = [[-434, -64], [-434, -46.5], [-422, -44], [-408, -44]];
const BATTERY_PTS = [tw(122, 0), tw(174, 0), tw(BATTERY_TL.lx, BATTERY_TL.lz)];
const BOARDWALK_PTS = [tw(-176, 4), tw(-55, 4), tw(100, 4)];
const LANTERN_PTS = COTTAGE_LANE.map((p) => p.slice());
const ANGLER_PTS = [[-120, -40], [-164, -45.6], [-205, -90], [-205, -130]];
const IDOL_PTS = [[TH.x, TH.z], [TH.x + TH.dx * 6, TH.z + TH.dz * 6], [16, -404], [24, -423], [41, -433], [45, -437]];
const BRIDGE_PTS = [[16, -103], [16, -64]];
const PIER_PTS = JETTY_LX.map((lx) => [tw(lx, 8), tw(lx, 55)]);

const [FORT_X, FORT_Z] = tw(FORT_TL.lx, FORT_TL.lz);
const [BAT_X, BAT_Z] = tw(BATTERY_TL.lx, BATTERY_TL.lz);
const [SWIM_X, SWIM_Z] = tw(SWIM.lx, SWIM.lz);
const [COLI_X, COLI_Z] = tw((COLI.lx0 + COLI.lx1) / 2, (COLI.lz0 + COLI.lz1) / 2);
const [SWORD_X, SWORD_Z] = tw(18.323, -105.031);
const [MUSKET_X, MUSKET_Z] = tw(18.483, -93.897);
const [TAVERN_X, TAVERN_Z] = tw(-10, FACADE_LZ); // Ship Shop / plaza storefront row stand-in for "plaza tavern" callouts
const [PIER1_X, PIER1_Z] = tw(JETTY_LX[0], 35);

/** Named island districts / areas. */
export const ISLAND_DISTRICTS = [
  { id: 'harbor_quay', name: 'HARBOR QUAY', short: 'Harbor Quay', x: -670, z: -136, r: 145, priority: 48 },
  { id: 'merchant_plaza', name: 'MERCHANT PLAZA', short: 'Merchant Plaza', x: -612, z: -68, r: 72, priority: 50 },
  { id: 'cottage_village', name: 'COTTAGE VILLAGE', short: 'Cottage Village', x: COTTAGE_GREEN.x, z: COTTAGE_GREEN.z, r: 42, priority: 55 },
  { id: 'coral_swim_cove', name: 'CORAL SWIM COVE', short: 'Coral Swim Cove', x: SWIM_X, z: SWIM_Z, r: 40, priority: 45 },
  { id: 'armory_hill', name: 'ARMORY HILL', short: 'Armory Hill', x: -540, z: -72, r: 48, priority: 60 },
  { id: 'bloodstone_colosseum', name: 'BLOODSTONE COLOSSEUM', short: 'Bloodstone Colosseum', x: COLI_X, z: COLI_Z, r: 55, priority: 65 },
  { id: 'crown_citadel', name: 'CROWN CITADEL', short: 'Crown Citadel', x: FORT_X, z: FORT_Z, r: 28, priority: 70 },
  { id: 'cannon_headland', name: 'CANNON HEADLAND', short: 'Cannon Headland', x: BAT_X, z: BAT_Z, r: 36, priority: 55 },
  { id: 'gills_lagoon', name: "GILL'S LAGOON", short: "Gill's Lagoon", x: -205, z: -130, r: 62, priority: 50 },
  { id: 'skull_peak', name: 'SKULL PEAK', short: 'Skull Peak', x: 90, z: 250, r: 70, priority: 45 },
  { id: 'gallows_ridge', name: 'GALLOWS RIDGE', short: 'Gallows Ridge', x: 110, z: -320, r: 55, priority: 45 },
  { id: 'temple_jungle', name: 'TEMPLE JUNGLE', short: 'Temple Jungle', x: 45, z: -450, r: 90, priority: 40 },
  { id: 'sunken_ruins', name: 'SUNKEN RUINS', short: 'Sunken Ruins', x: 45, z: -454, r: 40, priority: 58 },
  { id: 'smugglers_cove', name: "SMUGGLERS' COVE", short: "Smugglers' Cove", x: 262, z: 300, r: 50, priority: 45 },
  { id: 'dead_mans_cave', name: "DEAD MAN'S CAVE", short: "Dead Man's Cave", x: 270, z: 315, r: 32, priority: 52 },
  { id: 'north_bay', name: 'NORTH BAY', short: 'North Bay', x: -675, z: 80, r: 140, priority: 10, sea: true },
  { id: 'south_channel', name: 'SOUTH CHANNEL', short: 'South Channel', x: -800, z: -200, r: 160, priority: 10, sea: true },
  { id: 'east_shoals', name: 'EAST SHOALS', short: 'East Shoals', x: -500, z: 200, r: 150, priority: 10, sea: true },
  { id: 'west_breakers', name: 'WEST BREAKERS', short: 'West Breakers', x: -900, z: -50, r: 160, priority: 10, sea: true },
  { id: 'open_sea', name: 'OPEN SEA', short: 'Open Sea', x: -890, z: -150, r: 420, priority: 1, sea: true },
];

/** Named streets / lanes / trails / bridges. */
export const ISLAND_STREETS = [
  { id: 'boardwalk', name: 'BOARDWALK PROMENADE', short: 'Boardwalk', primary: true, pts: BOARDWALK_PTS, width: 10, labelU: 0.42 },
  ...PIER_PTS.map((pts, i) => ({ id: 'pier_' + (i + 1), name: 'PIER ' + (i + 1), short: 'Pier ' + (i + 1), primary: false, pts, width: 8, labelU: 0.55 })),
  { id: 'market_row', name: 'MARKET ROW', short: 'Market Row', primary: true, pts: MARKET_PTS, width: 14, labelU: 0.48 },
  { id: 'highgate_road', name: 'HIGHGATE ROAD', short: 'Highgate Road', primary: false, pts: HIGHGATE_PTS, width: 14, labelU: 0.55 },
  { id: 'gunpowder_row', name: 'GUNPOWDER ROW', short: 'Gunpowder Row', primary: true, pts: GUNPOWDER_PTS, width: 12, labelU: 0.45 },
  { id: 'gladiator_way', name: 'GLADIATOR WAY', short: 'Gladiator Way', primary: false, pts: GLADIATOR_PTS, width: 10, labelU: 0.5 },
  { id: 'citadel_ramp', name: 'CITADEL RAMP', short: 'Citadel Ramp', primary: false, pts: CITADEL_PTS, width: 6, labelU: 0.4 },
  { id: 'battery_trail', name: 'BATTERY TRAIL', short: 'Battery Trail', primary: false, pts: BATTERY_PTS, width: 8, labelU: 0.45 },
  { id: 'lantern_lane', name: 'LANTERN LANE', short: 'Lantern Lane', primary: true, pts: LANTERN_PTS, width: 6, labelU: 0.5 },
  { id: 'crimson_trail', name: 'CRIMSON TRAIL', short: 'Crimson Trail', primary: true, pts: CRIMSON_PTS, width: 8, labelU: 0.22, color: '#fa0d0d' },
  { id: 'doubloon_trail', name: 'DOUBLOON TRAIL', short: 'Doubloon Trail', primary: true, pts: DOUBLOON_PTS, width: 8, labelU: 0.58, color: '#ffc93c' },
  { id: 'anglers_path', name: "ANGLER'S PATH", short: "Angler's Path", primary: false, pts: ANGLER_PTS, width: 6, labelU: 0.55 },
  { id: 'hangmans_bridge', name: "HANGMAN'S BRIDGE", short: "Hangman's Bridge", primary: false, pts: BRIDGE_PTS, width: 4, labelU: 0.5 },
  { id: 'idol_trail', name: 'IDOL TRAIL', short: 'Idol Trail', primary: false, pts: IDOL_PTS, width: 5, labelU: 0.55 },
];

/** Landmark / district typography for Full Map + Treasure Chart (NO icons). */
export const GEO_LABELS = [
  { id: 'skull_peak', name: 'SKULL PEAK', x: 90, z: 262, size: 15, kind: 'district' },
  { id: 'gallows_ridge', name: 'GALLOWS RIDGE', x: 110, z: -300, size: 13, kind: 'district' },
  { id: 'gills_lagoon', name: "GILL'S LAGOON", x: -205, z: -130, size: 13, kind: 'district' },
  { id: 'waterfall', name: 'WATERFALL', x: -206, z: -186, size: 11, kind: 'spot' },
  { id: 'hangmans_bridge', name: "HANGMAN'S BRIDGE", x: 16, z: -82, size: 11, kind: 'street' },
  { id: 'smugglers_cove', name: "SMUGGLERS' COVE", x: 262, z: 300, size: 12, kind: 'district' },
  { id: 'dead_mans_cave', name: "DEAD MAN'S CAVE", x: 270, z: 330, size: 11, kind: 'district' },
  { id: 'crown_citadel', name: 'CROWN CITADEL', x: FORT_X, z: FORT_Z - 18, size: 12, kind: 'district' },
  { id: 'cannon_headland', name: 'CANNON HEADLAND', x: BAT_X, z: BAT_Z + 18, size: 11, kind: 'district' },
  { id: 'bloodstone', name: 'BLOODSTONE COLOSSEUM', x: COLI_X, z: COLI_Z, size: 11, kind: 'district' },
  { id: 'armory_hill', name: 'ARMORY HILL', x: -540, z: -55, size: 12, kind: 'district' },
  { id: 'merchant_plaza', name: 'MERCHANT PLAZA', x: -612, z: -50, size: 13, kind: 'district' },
  { id: 'harbor_quay', name: 'HARBOR QUAY', x: -675, z: -40, size: 13, kind: 'district' },
  { id: 'cottage_village', name: 'COTTAGE VILLAGE', x: COTTAGE_GREEN.x, z: COTTAGE_GREEN.z - 18, size: 12, kind: 'district' },
  { id: 'coral_swim', name: 'CORAL SWIM COVE', x: SWIM_X, z: SWIM_Z + 10, size: 11, kind: 'district' },
  { id: 'temple_jungle', name: 'TEMPLE JUNGLE', x: 50, z: -460, size: 12, kind: 'district' },
  { id: 'town_gate', name: 'TOWN GATE', x: GATE[0], z: GATE[1] + 14, size: 10, kind: 'spot' },
];

/** Known probe points for tests + HUD demos (foot frame). */
export const GEO_PROBES = {
  cottage_village: { x: -374.5, z: -147, district: 'COTTAGE VILLAGE', street: 'Lantern Lane' }, // on LANE cobbles
  musket_shop: { x: MUSKET_X, z: MUSKET_Z, district: 'ARMORY HILL', street: 'Gunpowder Row' },
  sword_shop: { x: SWORD_X, z: SWORD_Z, district: 'ARMORY HILL', street: 'Gunpowder Row' },
  plaza_tavern: { x: TAVERN_X, z: TAVERN_Z, district: 'MERCHANT PLAZA', street: 'Market Row' },
  coliseum_gate: { x: tw(MAIN_GATE.shellLx - 2, MAIN_GATE.lz)[0], z: tw(MAIN_GATE.shellLx - 2, MAIN_GATE.lz)[1], district: 'BLOODSTONE COLOSSEUM', street: 'Gladiator Way' },
  gills_lagoon: { x: -205, z: -130, district: "GILL'S LAGOON", street: "Angler's Path" },
  pier_1: { x: PIER1_X, z: PIER1_Z, district: 'HARBOR QUAY', street: 'Pier 1' }, // foot of jetty J1 (lx -150)
};

const STREET_REACH = 18;

export function nearestStreet(fx, fz, max = STREET_REACH) {
  let best = null, score = 1e9;
  for (const s of ISLAND_STREETS) {
    const d = polyDist(fx, fz, s.pts);
    if (d > max) continue;
    // Prefer being ON the road (within half-width) over a far parallel trail; primary roads break ties.
    const on = d <= Math.max(3, (s.width || 6) * 0.65);
    const local = /^(lantern_lane|market_row|gunpowder_row|highgate_road|gladiator_way|boardwalk|pier_|citadel_ramp|battery_trail|anglers_path|idol_trail|hangmans_bridge)/.test(s.id);
    const sc = (on ? d : d + 8) - (local ? 1.2 : 0) - (s.primary && !/trail$/.test(s.id) ? 0.4 : 0) - (s.id.startsWith('pier_') && d < 10 ? 1.5 : 0);
    if (sc < score) { score = sc; best = { street: s, dist: d }; }
  }
  return best;
}

export function nearestDistrict(fx, fz, { onFoot = true, inCanoe = false } = {}) {
  const sea = !onFoot || inCanoe;
  let best = null, bd = 1e9;
  for (const d of ISLAND_DISTRICTS) {
    if (d.sea && onFoot && !inCanoe) continue;
    if (!d.sea && sea && d.priority > 15) continue;
    const dist = Math.hypot(fx - d.x, fz - d.z);
    const score = dist - d.r * 0.35 - d.priority * 0.15;
    if (dist <= d.r * (d.sea ? 1.4 : 1.15) && score < bd) { bd = score; best = d; }
  }
  if (!best) {
    for (const d of ISLAND_DISTRICTS) {
      const dist = Math.hypot(fx - d.x, fz - d.z);
      if (dist < bd) { bd = dist; best = d; }
    }
  }
  return best;
}

/** @returns {{ district: string, street: string, callout: string, districtId: string|null, streetId: string|null }} */
export function locatePoint(fx, fz, opts = {}) {
  const d = nearestDistrict(fx, fz, opts);
  const sn = nearestStreet(fx, fz, opts.streetReach ?? STREET_REACH);
  const district = d ? d.name : (opts.onFoot === false || opts.inCanoe ? 'OPEN SEA' : 'ISLAND');
  const street = sn ? sn.street.short : '';
  const callout = street ? `${district} · ${street}` : district;
  return { district, street, callout, districtId: d?.id || null, streetId: sn?.street.id || null };
}

export function streetLabelPose(street) { return along(street.pts, street.labelU ?? 0.5); }
export function districtAt(id) { return ISLAND_DISTRICTS.find((d) => d.id === id) || null; }
export function streetAt(id) { return ISLAND_STREETS.find((s) => s.id === id) || null; }

/** [v335] BANKSY t1785u: "remove all the street signs that got added" — the 8 3D junction posts are gone (2D map districts / streets stay).
 *  Kept as an empty export so any old import still works. */
export const STREET_SIGN_SPOTS = [];

export const ISLAND_BOUNDS = { x0: -940, x1: 700, z0: -820, z1: 780 };

export const GEO = {
  ISLAND_DISTRICTS, ISLAND_STREETS, GEO_LABELS, STREET_SIGN_SPOTS, GEO_PROBES, ISLAND_BOUNDS,
  locatePoint, nearestStreet, nearestDistrict, streetLabelPose, districtAt, streetAt, tw, along, polyDist, segDist,
};
export default GEO;
