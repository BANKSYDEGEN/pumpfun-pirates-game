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
// [v240] BANKSY 6:20 PM: the plaza Token Exchange kiosk + its prompt are hidden (the FISH MARKET takes its spot + the tavern tables);
// &tokenx=1 brings the kiosk back. The $HQ / $RETARDIO posters + the TRENDING #1-5 row on the Harbor Exchange Hall (now the
// MARKETPLACE) are hidden too, and their DexScreener polling is skipped; &hallboards=1 brings them back. Client-only: no server change.
const QF = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
export const TOKENX_ON = !!QF && QF.get('tokenx') === '1', HALL_BOARDS_ON = !!QF && QF.get('hallboards') === '1';
// [hide-tavern] BANKSY 10:49 AM "Remove tavern and bounty boards for now" + 10:50 AM: pop-up prompts at empty rental lots (not buildings).
// Off by default; &tavern=1 / &bounty=1 bring the TAVERN / BOUNTY BOARD walk-near buttons (+ toast panels) back. Client-only.
export const SHOW_TAVERN = !!QF && QF.get('tavern') === '1', SHOW_BOUNTY_BOARDS = !!QF && QF.get('bounty') === '1';
// [hide-notice] BANKSY 11:42 AM "also remove the notion board on hill street" (NOTICE BOARD on Main Street / Pirates' Climb).
// Off by default; &noticeboard=1 brings the board + prompt back. Client-only.
export const SHOW_NOTICE_BOARD = !!QF && QF.get('noticeboard') === '1';
export const HALL_TOKENS = ['HQ', 'RETARDIO'];   // the hall_e posters (js/island/plazaTown.js TOKEN_SLOTS)
export const hallTokenHidden = (sym) => !HALL_BOARDS_ON && HALL_TOKENS.includes(sym);
// Boards face the Hill Street mouth, clear of #4/#5 walls + plinths. Shared by art, screens, colliders and prompts.
// The old lx -4.2 / 14.8 anchors buried the backing in the solid shop footprint; &coliseum=0 restores the quay.
const _coliBoards = !(typeof location !== 'undefined' && /[?&]coliseum=0(&|$)/.test(location.search));
export const PLAZA_POIS = [                                                        // town-local
  { id: 'waves', label: 'STORM HUNT board', lx: _coliBoards ? -2.6 : -10, lz: _coliBoards ? -36 : -12, yaw: _coliBoards ? Math.PI / 2 : 0 }, { id: 'arena', label: 'ARENA board', lx: _coliBoards ? 13.4 : 22, lz: _coliBoards ? -36 : -12, yaw: _coliBoards ? -Math.PI / 2 : 0 },
  { id: 'exchange', label: 'Token exchange', lx: 62, lz: -30 }, { id: 'market', label: 'Harbor market', lx: -36, lz: -32 },
  { id: 'spectate', label: 'Spectate spyglass', lx: SPYGLASS.lx, lz: SPYGLASS.lz }, { id: 'tower', label: 'Harbor tower', lx: 86, lz: -44 },
  { id: 'arrive', label: 'Step ashore (P1 head)', lx: -90, lz: 42 },
];
export const boardApproach = (q, distance = 2.6) => ({ lx: q.lx + Math.sin(q.yaw) * distance, lz: q.lz + Math.cos(q.yaw) * distance });
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
// [Raul] SWIM COVE (BANKSY "a swim area near that would be cool too"): a sheltered lagoon pool on the WEST beach behind the dune
// (town-local, lx -286..-202). Its own calm still surface at `y` (no swell, inland of the quay line: no ships, outside the ship lanes
// and the battle water), an ax x az ellipse round (lx, lz): sandy entry at the west end (wading), chest deep from the buoy rope on,
// deepest (y - bottom) at the east end under the diving platform. Clear of Post's NW camp (lx < -342) and the plaza (lx > -176).
export const SWIM_COVE = { lx: -244, lz: -48, ax: 42, az: 22, y: 2.8, bottom: 0.5, bank: 1.4,
  jetty: { lz: -46, lx0: -194, lx1: -212, hw: 1.2, y: 3.45, steps: [3.85, 4.25, 4.65, 5.05], tower: { lx0: -216, lx1: -222, hw: 1.8, y: 5.45 }, board: { lx1: -226, hw: 0.45 } },
  buoys: { lx: -258, lz0: -67, lz1: -29, n: 9 } };
export const coveQ = (lx, lz) => Math.hypot((lx - SWIM_COVE.lx) / SWIM_COVE.ax, (lz - SWIM_COVE.lz) / SWIM_COVE.az);
// [Raul] foot physics tuning (js/onfoot/physics.js + foot.js walk rules), metres: deeper than `depth` = swim with your feet `float`
// under the surface (head + shoulders out); pull out of the water onto ground / decks up to `climb` above the surface; `step` = the
// tallest step / ledge you walk up (taller drops are falls); `seaY` = still-water sea level; `maxSea` = how deep the sea floor may get
// before you are turned back (open water stays off limits, so do the dredged berths inside SAFE).
export const FOOT_SWIM = { depth: 1.25, float: 1.12, climb: 1.6, step: 0.45, seaY: 0.05, maxSea: -9 };
