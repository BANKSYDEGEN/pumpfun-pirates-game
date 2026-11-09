// [cannon-snake] t2434u/t2436u/t2437u: player heat-seek restored (soft look), hull/deck aim, no sail detonations.
// node --test tests/cannonAssist.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as BA from '../js/broadsideAim.js';

const DEG = Math.PI / 180;
const sideDir = (yaw, side) => { const k = side === 'port' ? 1 : -1; return { x: Math.cos(yaw) * k, z: -Math.sin(yaw) * k }; };
const at = (dir, deg, d) => { const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG); return { x: (dir.x * c - dir.z * s) * d, z: (dir.x * s + dir.z * c) * d }; };
const offDir = (v, dir) => Math.acos(Math.min(1, Math.max(-1, (v.x * dir.x + v.z * dir.z) / Math.hypot(v.x, v.z)))) / DEG;
const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const OUT = '/workspace/island-crash-bench/cannon-snake';

test('player lock window restored to pre-v347 ~±43°; AI constants unchanged', () => {
  assert.ok(Math.abs(BA.AIM.cone - 0.75) < 1e-9);
  assert.equal(BA.AIM.aiLead, 1);
  assert.ok(Math.abs(BA.AIM.aiMaxDev - 0.23) < 1e-9);
  const dir = sideDir(0.4, 'port');
  for (const deg of [0, 20, 40, -40]) assert.ok(BA.inCone(dir, ...Object.values(at(dir, deg, 55))), `${deg} locks`);
  for (const deg of [50, 90, 180]) assert.ok(!BA.inCone(dir, ...Object.values(at(dir, deg, 55))), `${deg} ignored`);
});

test('launch leave-angle clamped near broadside (no bow/stern snap); full lead', () => {
  assert.ok(BA.AIM.lead >= 0.99);
  assert.ok(BA.AIM.maxDev <= 0.45 && BA.AIM.maxDev >= 0.35);
  const dir = sideDir(0, 'port'); // +X
  const g = BA.playerAimVelocity({ x: 0, y: 2.4, z: 0 }, dir, 40, 30, 1.6, BA.AIM.maxDev); // ~37° off
  assert.ok(g, 'accepted within minAlong');
  assert.ok(Math.abs(g.launchDev) <= BA.AIM.maxDev + 1e-9);
  assert.ok(offDir(g, dir) <= BA.AIM.maxDev / DEG + 0.05);
  // extreme forward aim rejected by minAlong
  assert.equal(BA.playerAimVelocity({ x: 0, y: 2, z: 0 }, dir, 2, 80, 1.6), null);
});

test('in-flight steer is rate-limited (smooth curve, not a snap)', () => {
  const dt = 1 / 60, rate = BA.AIM.homeRate;
  let vx = 42, vz = 0; // going +X
  const s = BA.steerHoriz(vx, vz, 0, 0, 0, 100, rate, dt); // want +Z
  const dAng = Math.abs(Math.atan2(s.x, s.z) - Math.atan2(vx, vz));
  assert.ok(dAng <= rate * dt + 1e-9);
  assert.ok(Math.abs(Math.hypot(s.x, s.z) - 42) < 1e-6, 'horizontal speed preserved');
});

test('forwardVel is forward-only (no yaw-rate sideways inherit)', () => {
  const v = BA.forwardVel(Math.PI / 2, 10); // facing +X
  assert.ok(Math.abs(v.x - 10) < 1e-9 && Math.abs(v.z) < 1e-9);
  const m = R('js/main.js');
  assert.match(m, /BA\.forwardVel\(shooter\.yaw, shooter\.speed\)/);
  assert.match(m, /Do NOT add yaw-rate/);
  assert.match(m, /steerHoriz/);
  assert.match(m, /playerHome/);
});

test('hullAimY sits on hull/deck — never sail/spyglass height', () => {
  const y = BA.hullAimY({ y: 0, deckY: 3.2, depth: 3 });
  assert.ok(y >= 1.0 && y <= 4.0, `aimY=${y}`);
  assert.ok(y < BA.hullHitY1({ y: 0, deckY: 3.2, depth: 3 }), 'aim below hit cap');
  // spyglass / mast zone (~8–14 m) must be above hit band
  assert.ok(BA.hullHitY1({ y: 0, deckY: 3.2, depth: 3 }) < 7);
  assert.ok(!BA.inHullBand({ y: 0, deckY: 3.2, depth: 3 }, 9), 'no sail detonation at y=9');
  assert.ok(!BA.inHullBand({ y: 0, deckY: 3.2, depth: 3 }, 12), 'no spyglass detonation');
  assert.ok(BA.inHullBand({ y: 0, deckY: 3.2, depth: 3 }, 2.5), 'deck/hull hit ok');
  assert.equal(BA.hullAimY({ footY: 4 }), 4.6);
});

test('main.js + pvp.js ball hits use hull/deck band (not len*0.9 sails)', () => {
  const m = R('js/main.js'), p = R('js/pvp.js');
  assert.match(m, /BA\.inHullBand\(s, p\.y\)/);
  assert.doesNotMatch(m, /p\.y < s\.y \+ hl \* 0\.9/);
  assert.match(p, /ballY1/);
  assert.doesNotMatch(p, /p\.y < s\.y \+ u\.len \* 0\.9/);
});

test('AI still uses fireLine + aiMaxDev (no player heat-seek on AI)', () => {
  const m = R('js/main.js');
  assert.match(m, /BA\.AIM\.aiMaxDev/);
  assert.match(m, /BA\.fireLine\(/);
  assert.match(m, /isPlayer && playerHome/);
});

test('hit-rate: abeam + snaking — heat vs v567; impacts stay in hull/deck band', () => {
  const cases = [];
  // straight abeam, ranges 35–70
  for (const range of [35, 50, 65]) {
    for (const off of [0, 12, 25, 35]) {
      cases.push({ name: `abeam r${range} off${off}`, rangeHint: range, yaw: 0, preTurn: 0, turn: 0, tgtOff: off });
    }
  }
  // snaking: turn hard for 1.2s then fire at a target near the new beam
  for (const range of [40, 55]) {
    cases.push({ name: `snake r${range}`, rangeHint: range, yaw: 0, preTurn: 1.2, turn: 1, turnRate: 0.55, tgtOff: 18 });
    cases.push({ name: `snake-wide r${range}`, rangeHint: range, yaw: 0, preTurn: 1.4, turn: 1, turnRate: 0.62, tgtOff: 28 });
  }

  const run = (mode, c) => {
    const dir0 = sideDir(c.yaw, 'port');
    // after preTurn, yaw advances — place target relative to FINAL yaw for a fair "opened the side" test
    let y = c.yaw;
    if (c.preTurn) {
      const dt = 1 / 60; let t = 0;
      while (t < c.preTurn) { y += (c.turn || 0) * (c.turnRate || 0.62) * dt; t += dt; }
    }
    const dir = sideDir(y, 'port');
    const p = at(dir, c.tgtOff || 0, c.rangeHint);
    const target = { x: p.x, z: p.z, yaw: y + Math.PI, speed: 7, deckY: 3.1, depth: 3, beam: 5.2, len: 16, y: 0 };
    const opts = {
      mode, yaw: c.yaw, side: 'port', speed: 9, turn: c.turn || 0, turnRate: c.turnRate || 0.62, preTurn: c.preTurn || 0,
      target, rangeHint: c.rangeHint, gunY: 2.5,
    };
    if (mode === 'v567') Object.assign(opts, { cone: 0.30, lead: 0.34, maxDev: 0.12 });
    return BA.simulateHit(opts);
  };

  let before = 0, after = 0, sailHits = 0;
  const rows = [];
  for (const c of cases) {
    const a = run('v567', c), b = run('heat', c);
    if (a.hit) before++;
    if (b.hit) after++;
    if (b.hit && b.impactY > b.y1) sailHits++;
    rows.push({ name: c.name, before: a.hit, after: b.hit, impactY: b.impactY, aimY: b.aimY, reasonB: a.reason, reasonA: b.reason });
  }
  const n = cases.length;
  const rateB = before / n, rateA = after / n;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'hit-rates.json'), JSON.stringify({ n, before, after, rateBefore: rateB, rateAfter: rateA, sailHits, rows }, null, 2));
  assert.equal(sailHits, 0, 'no impacts above hull/deck cap');
  assert.ok(rateA > rateB, `heat ${rateA} should beat v567 ${rateB}`);
  assert.ok(rateA >= 0.55, `heat hit-rate ${rateA} too low`);
  // sample trajectory SVG for one snaking heat shot
  const snake = run('heat', { name: 'viz', rangeHint: 50, yaw: 0, preTurn: 1.2, turn: 1, turnRate: 0.55, tgtOff: 20 });
  const pts = snake.samples || [];
  if (pts.length) {
    const xs = pts.map(p => p.x), zs = pts.map(p => p.z), ys = pts.map(p => p.y);
    const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 1), minZ = Math.min(...zs, 0), maxZ = Math.max(...zs, 1);
    const W = 640, H = 360, pad = 30;
    const sx = (x) => pad + (x - minX) / (maxX - minX || 1) * (W - 2 * pad);
    const sz = (z) => H - pad - (z - minZ) / (maxZ - minZ || 1) * (H - 2 * pad);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sz(p.z).toFixed(1)}`).join(' ');
    const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="100%" height="100%" fill="#0b1c28"/>
<path d="${path}" fill="none" stroke="#ffd27a" stroke-width="3"/>
<circle cx="${sx(pts[0].x)}" cy="${sz(pts[0].z)}" r="5" fill="#7CFF6B"/>
<circle cx="${sx(pts[pts.length - 1].x)}" cy="${sz(pts[pts.length - 1].z)}" r="5" fill="#ff6b6b"/>
<text x="16" y="24" fill="#fff" font-size="14">player heat-seek (snake) — top-down; green=muzzle red=end</text>
<text x="16" y="44" fill="#9ab" font-size="12">y loft ${Math.min(...ys).toFixed(1)}→${Math.max(...ys).toFixed(1)} m · hit=${snake.hit} impactY=${(snake.impactY || 0).toFixed(2)}</text>
</svg>`;
    writeFileSync(join(OUT, 'curve-shot.svg'), svg);
  }
});

test('ballistics gravity constant preserved (G=20, H=42)', () => {
  assert.equal(BA.AIM.H, 42);
  assert.equal(BA.AIM.G, 20);
});
