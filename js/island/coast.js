// [Raul] PUMPFUN PIRATES harbor coast (BLOCKOUT, island.html?coast=1). BANKSY: "I don't want dock island just build something
// into the side of main island." The round Dock Town island is gone: the town, quay and 8 berths are built INTO the harbor-facing
// (west) coast of the main on-foot island, and that coast is the east side of the Battle Royale harbor.
// Pure data (no three.js) so the harbor game (js/pvp.js, js/main.js) can import it later.
// Frames: town-local (lx along the waterfront, +lz out to sea) = js/island/foot.js TOWN frame, unchanged, so Main Street,
// the Squad Hall and Timothy's SHOP / stall spots keep their world coords. Harbor frame = foot world - HC (no rotation,
// metres, harbor +x points at the town), i.e. the frame js/pvp.js uses: spawn 0,0, rings 40/85/130, AI 176/344, edge 420.
export const COAST_ON = typeof location !== 'undefined' && new URLSearchParams(location.search).get('coast') !== '0'; // [release v100] ON by default (?coast=0 = the old round harbor)
const T = { x: -640, z: -90, yaw: -Math.PI / 2 }, C = Math.cos(T.yaw), S = Math.sin(T.yaw);
export const t2w = (lx, lz) => [T.x + lx * C + lz * S, T.z - lx * S + lz * C];
export const w2t = (x, z) => { const dx = x - T.x, dz = z - T.z; return [dx * C - dz * S, dx * S + dz * C]; };
export const t2wYaw = (ly) => ly + T.yaw;
// harbor centre (player spawn) 250 m straight out from the quay, centred on the waterfront
export const HARBOR_C = { lx: -60, lz: 250 };
export const HC = t2w(HARBOR_C.lx, HARBOR_C.lz);                                  // foot world (-890, -150)
export const toHarbor = (x, z) => [x - HC[0], z - HC[1]];
export const fromHarbor = (hx, hz) => [hx + HC[0], hz + HC[1]];
export const ARENA = { edge: 420, turnBack: 370, respawn: [40, 85, 130], ai: [176, 344] };
// waterfront, west -> east along lx: islet | wooden pier network (8 berths) | stone quay + plaza | stone mole + lighthouse | cliff headland + battery
export const QUAY = { lx0: -55, lx1: 100, y: 2.6 };                                // stone seawall section (plaza)
export const BOARDWALK = { lx0: -300, lx1: -55, lz0: -2, lz1: 6, y: 2.8 };         // wooden boardwalk on stilts along the beach
export const PIERS = [-90, -150, -210, -270].map((lx, k) => ({ k, lx, lz0: 4, head0: 40, head1: 44, half: 24 }));
export const BERTH_LZ = 48.5;                                                      // ships lie along the T-head face, 4.5 m off it
export const COAST_BERTHS = PIERS.flatMap(p => [-12, 12].map((t, j) => { const lx = p.lx + t, [x, z] = t2w(lx, BERTH_LZ), [hx, hz] = toHarbor(x, z);
  return { id: 'P' + (p.k + 1) + 'LR'[j], pier: p.k + 1, lx, lz: BERTH_LZ, x: +x.toFixed(2), z: +z.toFixed(2), hx: +hx.toFixed(2), hz: +hz.toFixed(2), yaw: +t2wYaw(Math.PI / 2).toFixed(4), len: 22, maxBeam: 7.3 }; }));
export const MOLE = { lx: 108, lz0: 0, lz1: 118, w: 8, tipR: 9, y: 2.4 };
export const HEADLAND = { lx: 160, lz: 36, r: 36, top: 21 };                       // rocky cliff + fort battery
export const FORT = { lx: 46, lz: -232, r: 15, top: 36 };                          // keep + towers at the top of Main Street
export const ISLET = { lx: -345, lz: 105, r: 22 };                                 // sandbar with palms
export const PLAZA = { lx0: -55, lx1: 100, lz0: -56, lz1: 0 };
export const PLAZA_POIS = [                                                        // town-local
  { id: 'waves', label: 'WAVES board', lx: -10, lz: -12 }, { id: 'arena', label: 'ARENA board', lx: 22, lz: -12 },
  { id: 'exchange', label: 'Token exchange', lx: 62, lz: -30 }, { id: 'market', label: 'Harbor market', lx: -36, lz: -32 },
  { id: 'spectate', label: 'Spectate spyglass', lx: MOLE.lx + 6, lz: MOLE.lz1 - 2 }, { id: 'tower', label: 'Harbor tower', lx: 86, lz: -44 },
  { id: 'arrive', label: 'Step ashore (P1 head)', lx: -90, lz: 42 },
];
// no-fire safe harbor (town-local polygon): berths + 22 m, the quay front and the mole
export const SAFE = [[-300, -5], [-300, 70], [92, 70], [92, 130], [124, 130], [124, -5]];
// the land added to the main island for the town (town-local polygon; straight quay along lz = 0)
export const APRON = [[-430, -300], [-430, -60], [-400, -15], [-360, 4], [-300, 2], [-55, 0], [100, 0], [126, 4], [134, 40], [148, 72], [172, 76], [192, 52],
  [206, 14], [240, -2], [300, -10], [345, -40], [360, -300]];
export const inPoly = (x, z, P) => { let inside = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, az] = P[j], [bx, bz] = P[i];
  if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside; } return inside; };
// pvp.js spawn rings re-checked against the coast: AI spawns in the town, on land or within 25 m of the no-fire zone are dropped
export function spawnCheck() {
  const out = [], R = ARENA.edge;
  const ring = (n, r, off) => Array.from({ length: n }, (_, i) => { const a = (i + off) / n * 2 * Math.PI; return [Math.cos(a) * r, Math.sin(a) * r, +(a * 180 / Math.PI).toFixed(1), r]; });
  for (const [hx, hz, deg, r] of [...ring(16, R * 0.82, 0), ...ring(6, R * 0.42, 0.5)]) { const [x, z] = fromHarbor(hx, hz), [lx, lz] = w2t(x, z);
    const land = inPoly(lx, lz, APRON) || Math.hypot(lx - ISLET.lx, lz - ISLET.lz) < ISLET.r + 10, safeD = Math.max(-5 - lz, lz - 70, -300 - lx, lx - 124);
    out.push({ r: Math.round(r), deg, hx: Math.round(hx), hz: Math.round(hz), ok: !land && lz > 70 + 25, why: land ? 'on land / in town' : lz <= 95 ? 'in or next to the no-fire zone' : '' }); }
  return out;
}
