// [waterfall-aaa] walk + zipline probes for tests/waterfallCorridor.test.mjs
import { readFileSync, statSync, existsSync } from 'node:fs';
const ROOT = new URL('../../../', import.meta.url);
const F = await import('../../../js/island/foot.js');
const HR = await import('../../../js/island/areas/hillRound.js');
const LG = await import('../../../js/island/areas/lagoon.js');
const WC = await import('../../../js/island/areas/waterfallCorridor.js');
const ZI = await import('../../../js/dock/zipline.js');
const FB = await import('../../../js/island/fallsBlender.js');

const R = new Proxy({}, { get: () => [0, 0, 1, 1] });
for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, true, []);

// Register areas so HB / decks / colliders exist
const decks = [], circs = [], boxes = [], pois = [], interacts = [];
const h = {
  H: F.H, TRAILS: F.TRAILS, GATE: F.GATE, STREET: F.STREET, townToWorld: F.townToWorld,
  AREA_DECKS: decks, INTERACT: interacts,
  addDeck: (d) => { decks.push(d); F.addDeck ? null : null; /* area decks go through registerAreas in createFoot; here we mirror */ 
    // Push into foot's AREA_DECKS via a side channel — foot exposes addDeck only inside createFoot.
    // For probes we use F.areaDeckAt after manually stuffing decks if needed. Use H + paved trail instead.
  },
  addCirc: (...a) => circs.push(a), addBox: (...a) => boxes.push(a),
  addHighBridge: (b) => { /* HIGH_BRIDGES filled by hillRound via foot hook — call hillRound.register which needs addHighBridge */ 
    // Import HIGH_BRIDGES isn't exported; hillRound calls h.addHighBridge?.(HB). Without createFoot the high bridge won't be in foot.
  },
  poi: (id, n, x, z) => pois.push({ id, x, z }),
  collidersOff: () => 0,
};
// Minimal: register lagoon + corridor + hillRound so their terrain paths are already in AREA_TERRAIN from module load.
HR.default.register({ ...h, addHighBridge: () => {} });
LG.default.register(h);
WC.default.register(h);

const { H, LAKE } = F;
const r = (v) => +(+v).toFixed(3);

function poly(pts, step = 0.35) {
  const o = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return o;
}
function walk(pts, label) {
  let maxStep = 0, prev = null, stuck = 0, blocked = 0, trees = 0;
  const samples = [];
  for (const [x, z] of pts) {
    const y = H(x, z);
    if (prev !== null) {
      const dy = Math.abs(y - prev);
      maxStep = Math.max(maxStep, dy);
      if (dy > 1.25) stuck++; // foot physics max grade-ish
    }
    prev = y;
    // foliage clear
    if (!WC.corridorClearAt(x, z) && F.trailDist(x, z) > 6) { /* off path */ }
    samples.push([r(x), r(z), r(y)]);
  }
  // trees on path: corridorClearAt must be true for every sample on the graded path
  const uncleared = pts.filter(([x, z]) => !WC.corridorClearAt(x, z)).length;
  return { label, n: pts.length, maxStep: r(maxStep), stuck, uncleared, nHits: blocked, first: samples[0], last: samples[samples.length - 1] };
}

const out = {
  lake: LAKE,
  dock: { x: -205, z0: -63, z1: -97 },
  gill: { x: -199.5, z: -61.5 },
  grotto: { x0: -214, x1: -198, z0: -199, z1: -188, y: 21 },
  hb: { bx: r(HR._hb.bx), bz: r(HR._hb.bz), yb: r(HR._hb.yb), L: r(HR._hb.L) },
  fallsOn: FB.FALLS_ON,
  paths: {
    fish: WC.FISH_APPROACH.length,
    hill: WC.WF_HILL_TRAIL.length,
  },
};

// 1) Fountain plaza → across HB conceptually → east landing → fish path → dock
out.walkFish = walk(poly(WC.FISH_APPROACH), 'hb_landing_to_dock');
// 2) Dock → hill trail → summit
out.walkHill = walk(poly(WC.WF_HILL_TRAIL), 'dock_to_summit');
// 3) Stepping stones ENTRY → GROTTO (sample a few points along lagoon stones arc)
const ENTRY = [-258, -158], GROT = { x: -206, z: -195, y: 21 };
const stonePts = [];
{ const a0 = Math.atan2(ENTRY[1] - LAKE.z, ENTRY[0] - LAKE.x), a1 = Math.atan2(-189 - LAKE.z, -206 - LAKE.x), R = 51.5;
  for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24; stonePts.push([LAKE.x + Math.cos(a) * R, LAKE.z + Math.sin(a) * R]); }
  stonePts.push([GROT.x, GROT.z]);
}
out.walkGrotto = walk(poly(stonePts), 'stones_to_grotto');
out.grottoY = { ground: r(H(GROT.x, GROT.z)), expected: 21 };

// 4) Zipline clearance
const pack = ZI.zipLines({ H: F.H, LAKE: F.LAKE, SKULL: F.SKULL });
out.zipline = {
  hill: pack.hill.map(r), ha: r(pack.ha),
  skull: { A: pack.skullLine.A.map(r), B: pack.skullLine.B.map(r), gA: r(pack.skullLine.gA), gB: r(pack.skullLine.gB), minClr: r(pack.skullLine.minClr), L: r(pack.skullLine.L) },
  castle: { A: pack.castleLine.A.map(r), B: pack.castleLine.B.map(r), gA: r(pack.castleLine.gA), gB: r(pack.castleLine.gB), minClr: r(pack.castleLine.minClr), L: r(pack.castleLine.L) },
};

// 5) GLB sizes + nodes
out.glb = {};
for (const f of ['falls.glb', 'falls_low.glb']) {
  const u = new URL('../../../assets/island/' + f, import.meta.url);
  if (!existsSync(u)) { out.glb[f] = null; continue; }
  const b = readFileSync(u), n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n).toString());
  out.glb[f] = { bytes: statSync(u).size, nodes: (j.nodes || []).map(q => q.name).filter(Boolean) };
}
out.layout = existsSync(new URL('../../../assets/island/falls_layout.json', import.meta.url));
out.killSwitch = { falls0: !FB.FALLS_ON === false, src: readFileSync(new URL('../../../js/island/fallsBlender.js', import.meta.url), 'utf8').includes('falls=0') };

// Anchors unchanged
out.anchorsOk = LAKE.x === -205 && LAKE.z === -130 && LAKE.r === 58 && LAKE.y === 20;

console.log(JSON.stringify(out));
