// [v348] BANKSY t1827u-t1830u + t1833u: live cannon muzzles + ship-way broadsides, continuous 5600 m sea,
// foot_shallows off (one sea), waterfall/lagoon/river mouth intact, boats/canoes/swimmers ride the live swell,
// base swim ~13% slower with jump-swim kept at the old top speed.
// node --test tests/v348CannonMuzzlesAndSeaHorizon.test.mjs
import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

register('../tools/roundabout_blender/node/hooks.mjs', import.meta.url);
globalThis.location = { search: '', href: 'http://x/', hostname: 'x' };
globalThis.window = globalThis; globalThis.self = globalThis;
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
const el = () => ({ getContext: () => null, style: {}, addEventListener() {}, appendChild() {}, setAttribute() {}, classList: { add() {}, remove() {}, contains: () => false } });
globalThis.document = { createElement: el, createElementNS: el, addEventListener() {}, body: el(), getElementById: () => null, querySelector: () => null, documentElement: el() };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.performance = { now: () => Date.now() };

const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const OCEAN = await import('../js/ocean.js');
const PHYS_M = await import('../js/onfoot/physics.js');
const FOOT = await import('../js/island/foot.js');
const RW = await import('../js/island/riverWater.js');
const CANOE = await import('../js/dock/canoe.js');
const { gunList } = await import('../js/upgrades.js');

// ---------- t1827u: cannon muzzles + moving velocity + remote onShot ----------
test('t1827u: fire() adds vel0 to aimed broadsides, pulls lead back by vel0*tf, refreshes matrices', () => {
  const m = R('js/main.js');
  assert.match(m, /aimPt\.x - vel0\.x \* tf/);
  assert.match(m, /g\.x \+ vel0\.x, g\.y, g\.z \+ vel0\.z/);
  assert.match(m, /shooter\.mesh\?\.updateMatrixWorld\(true\)/);
  assert.match(m, /b\.owner\.mesh\.updateMatrixWorld\(true\); m\.getWorldPosition\(_mp\)/);
  assert.match(m, /camera\.far = 9000|PerspectiveCamera\(55, innerWidth \/ innerHeight, 0\.5, 9000\)/);
});

test('t1827u: gunList spreads n shots across the deck row; onShot indexes gunList[gi] + updateMatrixWorld', () => {
  const u = R('js/upgrades.js'), p = R('js/pvp.js');
  assert.match(u, /Math\.round\(i \* \(D - 1\) \/ \(n - 1\)\)/);
  assert.match(p, /gunList\(owner, side\)/);
  assert.match(p, /ms\[\(b\[8\] \| 0\) % ms\.length\]/);
  assert.match(p, /owner\.mesh\.updateMatrixWorld\(true\).*t1827u|updateMatrixWorld\(true\); \/\/ \[v348\] t1827u/);
  // pure math: 6 deck barrels, 4 guns → indices 0,2,3,5
  const raw = [0, 1, 2, 3, 4, 5];
  const n = 4, D = 6;
  const pick = Array.from({ length: n }, (_, i) => raw[Math.round(i * (D - 1) / (n - 1))]);
  assert.deepEqual(pick, [0, 2, 3, 5]);
  // gunList with a fake ship
  const fakeMuzzles = raw.map((i) => ({ i, isObject3D: true }));
  const ship = { cannons: 4, mesh: { userData: { muzzles: { port: fakeMuzzles, star: fakeMuzzles }, deckGuns: 6 } } };
  const L = gunList(ship, 'port');
  assert.equal(L.length, 4);
  assert.deepEqual(L.map((m) => m.i), [0, 2, 3, 5]);
});

// ---------- t1828u: continuous sea + sky + camera ----------
test('t1828u: SEA_REACH 5600, SKY_R 6500, seaGeometry warp, horizon blend, camera.far 9000', () => {
  assert.equal(OCEAN.SEA_REACH, 5600);
  assert.equal(OCEAN.SKY_R, 6500);
  const g = OCEAN.seaGeometry(900, 260, 34);
  assert.equal(g.userData.reach, 5600);
  assert.ok(Math.abs(g.userData.step - 900 / 260) < 1e-9);
  // inner verts unwarped, outer verts pushed out
  const P = g.attributes.position;
  let maxAxis = 0;
  for (let i = 0; i < P.count; i++) maxAxis = Math.max(maxAxis, Math.abs(P.getX(i)), Math.abs(P.getZ(i)));
  assert.ok(maxAxis > 5500 && maxAxis < 5650, `axis reach ${maxAxis}`); // corners go to ~reach*√2
  const o = R('js/ocean.js');
  assert.match(o, /smoothstep\(2400\.0, 5200\.0/);
  assert.match(o, /SphereGeometry\(SKY_R/);
  assert.match(R('js/main.js'), /9000/);
  assert.match(o, /low \? 22 : 34/);
});

// ---------- t1829u / t1830u: one sea, waterfall/lagoon/river mouth ----------
test('t1829u: SHALLOWS_ON false by default; freshWater + cove + waterfall kept', () => {
  assert.equal(FOOT.SHALLOWS_ON, false);
  const f = R('js/island/foot.js');
  assert.match(f, /if \(SHALLOWS_ON\) root\.add\(shallows/);
  assert.match(f, /const fresh = freshWater/);
  assert.match(f, /coveWater/);
  assert.match(f, /waterfall\(/);
});

test('t1830u: MOUTH_SINK -2.6 under deepest trough; mouthSink/mouthSea exported; waterfall+lake intact', () => {
  assert.equal(RW.MOUTH_SINK, -2.6);
  assert.equal(RW.mouthSea(-1.2), 1);
  assert.equal(RW.mouthSea(1), 0);
  assert.ok(RW.mouthSink(0, -1.2) <= -2.5);
  const sumA = OCEAN.WAVES.reduce((s, w) => s + w[2], 0);
  assert.ok(sumA < 2.3 && RW.MOUTH_SINK < -sumA, `sink ${RW.MOUTH_SINK} under amp ${sumA}`);
  assert.match(R('js/island/foot.js'), /WATER_KIND/);
  assert.match(R('js/dock/world.js'), /mouthSink|mouthSea/);
});

// ---------- t1833u: buoyancy + swim speed ----------
test('t1833u: world.water() adds live waveHeight for sea (and sunk river mouth); blocked stays static', () => {
  const w = R('js/dock/world.js');
  assert.match(w, /from '\.\.\/ocean\.js'/);
  assert.match(w, /FOOT_SWIM\.seaY \+ waveHeight/);
  assert.match(w, /k === 'sea'/);
  assert.match(w, /mouthSea\(W\.h\)/);
  assert.match(w, /foot\.blocked\(fx, fz/); // static walkability
  assert.match(w, /SEA_SWELL/);
});

test('t1833u: farA is per-wavelength past the SAIL arena; |GPU-CPU| < 0.15 m for r≤1250', () => {
  const o = R('js/ocean.js');
  assert.match(o, /farBig = 1\.0 - smoothstep\(1350\.0, 2600\.0/);
  assert.match(o, /farTiny = 1\.0 - smoothstep\(1250\.0, 2200\.0/);
  assert.match(o, /i < 2 \? farBig : farTiny/);
  assert.equal(CANOE.SAIL.r, 1250);
  const far = (r, a, b) => 1 - Math.min(1, Math.max(0, (r - a) / (b - a)));
  const W = OCEAN.WAVES.map(([x, z, amp, l]) => {
    const n = Math.hypot(x, z), k = (2 * Math.PI) / l;
    return { dx: x / n, dz: z / n, a: amp, k, w: Math.sqrt(9.8 * k) };
  });
  let maxDiff = 0;
  for (let r = 0; r <= 1250; r += 25) {
    for (let t = 0; t < 20; t += 0.7) {
      for (let a = 0; a < Math.PI * 2; a += 1.1) {
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const cpu = OCEAN.waveHeight(x, z, t);
        const fb = far(r, 1350, 2600), ft = far(r, 1250, 2200);
        let gpu = 0;
        for (let i = 0; i < W.length; i++) {
          const v = W[i], fa = i < 2 ? fb : ft;
          gpu += v.a * fa * Math.sin(v.k * (v.dx * x + v.dz * z) - v.w * t);
        }
        maxDiff = Math.max(maxDiff, Math.abs(cpu - gpu));
      }
    }
  }
  assert.ok(maxDiff < 0.15, `max |GPU-CPU| ${maxDiff} within SAIL arena`);
});

test('t1833u: floatShip tracks steep crests (τ≈0.125 s + floor); canoe never lags under a crest', () => {
  const m = R('js/main.js'), c = R('js/dock/canoe.js');
  assert.match(m, /Math\.exp\(-dt \* 8\)/);
  assert.match(m, /s\.y < ty - 0\.08/);
  assert.match(c, /st\.y < ty - 0\.05/);
  assert.match(c, /Math\.exp\(-dt \* 10\)/);
  assert.equal(CANOE.CANOE_DIM.ride, 0.28);
  // simulate floatShip response to a 2.2 m crest jump
  let y = -0.6; const ty = 2.2 - 0.6, dt = 1 / 60;
  for (let i = 0; i < 15; i++) { const k = 1 - Math.exp(-dt * 8); y += (ty - y) * k; if (y < ty - 0.08) y = ty - 0.08; }
  assert.ok(ty - y < 0.05, `ship lag after 0.25 s: ${ty - y}`);
});

test('t1833u: PHYS.swim ~13% slower; jump-swim keeps exact old top speeds; no false cliff-fall on receding swell', () => {
  const { PHYS, SWIM_SURGE } = PHYS_M;
  assert.deepEqual(PHYS.swim, [7.4, 11.3]);
  assert.deepEqual(SWIM_SURGE.speed, [8.5 * 1.35, 13.0 * 1.35]);
  assert.ok(Math.abs(PHYS.swim[0] * SWIM_SURGE.kOf(false) - 11.475) < 1e-9);
  assert.ok(Math.abs(PHYS.swim[1] * SWIM_SURGE.kOf(true) - 17.55) < 1e-9);
  // ~13% slower than old base
  assert.ok(PHYS.swim[0] / 8.5 < 0.88 && PHYS.swim[0] / 8.5 > 0.85);
  assert.ok(PHYS.swim[1] / 13.0 < 0.88 && PHYS.swim[1] / 13.0 > 0.85);
  const ph = R('js/onfoot/physics.js'), wk = R('js/onfoot/walker.js'), fo = R('js/onfoot/followers.js');
  assert.match(ph, /&& !b\.swim\) \{ b\.air = true/); // no cliff-fall while/after swimming on a receding wave
  assert.match(ph, /ride = b\.swim && f\.swim && Math\.abs\(d\) < PHYS\.rideMax/);
  assert.match(wk, /SWIM_SURGE\.kOf\(run/);
  assert.match(fo, /SWIM_SURGE\.live/);
});

test('t1833u: hop landing uses live f.floor (air branch); WATER_KIND drives sea vs still water', () => {
  const ph = R('js/onfoot/physics.js'), f = R('js/island/foot.js');
  assert.match(ph, /if \(b\.y <= f\.floor\)/);
  assert.match(ph, /b\.hop = false/);
  assert.match(f, /W\.k = 'sea'/);
  assert.match(f, /W\.k = 'cove'/);
  assert.match(f, /W\.k = 'lake'/);
  assert.match(f, /W\.k = 'river'/);
});

test('sw.js VERSION is pfp-v348+', () => {
  assert.ok(+((R('sw.js').match(/const VERSION = 'pfp-v(\d+)'/) || [])[1]) >= 348); // [v349] later builds keep the v348 behaviour
});
