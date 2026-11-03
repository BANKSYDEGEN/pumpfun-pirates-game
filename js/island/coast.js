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
// [v117] BANKSY: "the ships get big so only allow 1 ship to park in middle of each pier" + "add some parking spots" on the plaza quay.
// ONE berth per pier, centred on its 48 m T-head (piers 60 m apart: two 44 m CANNONS VIII hulls keep a 16 m gap), plus 3 quay berths
// along the plaza seawall (wall at lz ~2, 4+ m deep from lz 4; VIII beam 10.4 m, so quay ships lie at lz 10.5 and pier ships 5.8 m off the T-head; 47 m apart, the west one clear of the boardwalk, the east one 16 m
// short of the mole). Quay ships lie bow-west and leave on a short swing (outLen) so they never sweep a neighbour.
// Old builds' ids P1L / P1R map onto P1 (js/dock/docking.js peerBerth).
export const BERTH_SLOT = 44;                                                      // longest visible hull (BR hull 6, CANNONS VIII)
export const PIER_BERTH_LZ = 49.8, QUAY_BERTH_LZ = 10.5, QUAY_BERTHS_LX = [-31, 16, 63];
const berthAt = (id, lx, lz, yaw, extra) => { const [x, z] = t2w(lx, lz), [hx, hz] = toHarbor(x, z);
  return { id, lx, lz, x: +x.toFixed(2), z: +z.toFixed(2), hx: +hx.toFixed(2), hz: +hz.toFixed(2), yaw: +t2wYaw(yaw).toFixed(4), len: BERTH_SLOT, maxBeam: 10.4, ...extra }; };
export const COAST_BERTHS = [...PIERS.map(p => berthAt('P' + (p.k + 1), p.lx, PIER_BERTH_LZ, Math.PI / 2, { pier: p.k + 1 })),
  ...QUAY_BERTHS_LX.map((lx, i) => berthAt('Q' + (i + 1), lx, QUAY_BERTH_LZ, -Math.PI / 2, { quay: true, ashoreLz: -2.6, outLen: 18 }))];
export const MOLE = { lx: 108, lz0: 0, lz1: 118, w: 8, tipR: 9, y: 2.4 };
// spectate spyglass: ON the mole deck 14 m short of the tip (the lighthouse base + its r 7.4 collider fill the tip), so a pirate can
// walk up to it. Single source of truth for the spyglass art (js/island/foot.js) and the interact point (js/dock/layout.js).
export const SPYGLASS = { lx: MOLE.lx, lz: MOLE.lz1 - MOLE.tipR - 5, y: MOLE.y, r: 3.4 };
export const HEADLAND = { lx: 160, lz: 36, r: 36, top: 21 };                       // rocky cliff + fort battery
export const FORT = { lx: 46, lz: -232, r: 15, top: 36 };                          // keep + towers at the top of Main Street
export const ISLET = { lx: -345, lz: 105, r: 22 };                                 // sandbar with palms
export const PLAZA = { lx0: -55, lx1: 100, lz0: -56, lz1: 0 };
export const PLAZA_POIS = [                                                        // town-local
  { id: 'waves', label: 'STORM HUNT board', lx: -10, lz: -12 }, { id: 'arena', label: 'ARENA board', lx: 22, lz: -12 },
  { id: 'exchange', label: 'Token exchange', lx: 62, lz: -30 }, { id: 'market', label: 'Harbor market', lx: -36, lz: -32 },
  { id: 'spectate', label: 'Spectate spyglass', lx: SPYGLASS.lx, lz: SPYGLASS.lz }, { id: 'tower', label: 'Harbor tower', lx: 86, lz: -44 },
  { id: 'arrive', label: 'Step ashore (P1 head)', lx: -90, lz: 42 },
];
// no-fire safe harbor (town-local polygon): berths + 22 m, the quay front and the mole
// [v124] BANKSY "make the harbor battle zone farther away from dock, I get shot right away": the no-fire zone runs ~105 m past the pier
// heads (was 26 m) and 60 m past the outer pier; leaving it you still cannot fire for layout.graceS (4 s)
export const SAFE = [[-360, -5], [-360, 150], [92, 150], [92, 170], [124, 170], [124, -5]];
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
