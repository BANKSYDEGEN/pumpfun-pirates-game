// [v328] BANKSY t1735u — High Rope Bridge east landing must be a solid walk deck (no sink into white
// stone tiles), mouth clear of signs, and the plateau path walkable both ways to Trail A + Gill's dock.
import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { H, waterAt } from '../js/island/foot.js';
import { _hb as HB, RB2, RBB_ON } from '../js/island/areas/hillRound.js';
import { STREET_SIGN_SPOTS } from '../js/islandGeography.js';
import { RB } from '../js/island/areas/ropeBridge.js';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const HR = src('js/island/areas/hillRound.js');
const GEO = src('js/islandGeography.js');

// ---- replicate the live HB end + landing decks (createFoot isn't booted in Node) ----
assert.equal(RBB_ON, true);
{ const [ex, ez] = RB2.end; let bx = ex, bz = ez; const ux = HB.ax - ex, uz = HB.az - ez, n = Math.hypot(ux, uz);
  for (let s = 0; s < 20; s += 0.5) { const x = ex + ux / n * s, z = ez + uz / n * s; if (H(x, z) < H(ex, ez) - 0.6) break; bx = x; bz = z; }
  Object.assign(HB, { bx, bz, yb: H(bx, bz), L: Math.hypot(bx - HB.ax, bz - HB.az), yaw: Math.atan2(bx - HB.ax, bz - HB.az) }); }
const ux = Math.sin(HB.yaw), uz = Math.cos(HB.yaw), c0 = Math.cos(HB.yaw), s0 = Math.sin(HB.yaw);
const DECKS = [];
const addDeck = (d) => DECKS.push({ ...d, c: Math.cos(d.yaw || 0), s: Math.sin(d.yaw || 0) });
{ const d0 = -0.4, d1 = 7.4, mid = (d0 + d1) / 2;
  addDeck({ id: 'rb_hb_east_land', x: HB.bx + ux * mid, z: HB.bz + uz * mid, hw: 5.2, hl: (d1 - d0) / 2, yaw: HB.yaw, y: HB.yb });
  const rd0 = 7.2, rLen = 8.0, rMid = rd0 + rLen / 2, ex = HB.bx + ux * (rd0 + rLen), ez = HB.bz + uz * (rd0 + rLen);
  addDeck({ id: 'rb_hb_east_ramp', x: HB.bx + ux * rMid, z: HB.bz + uz * rMid, hw: 2.8, hl: rLen / 2, yaw: HB.yaw, y: HB.yb, y1: H(ex, ez) + 0.03 }); }

function areaDeckAt(x, z) {
  let y = null;
  for (const d of DECKS) {
    const dx = x - d.x, dz = z - d.z, l = dx * d.s + dz * d.c;
    if (Math.abs(dx * d.c - dz * d.s) > d.hw || Math.abs(l) > d.hl) continue;
    const hp = d.hl, u = Math.min(1, Math.max(0, (l + hp) / (2 * hp)));
    const yy = d.y1 !== undefined ? d.y + (d.y1 - d.y) * u : d.y;
    y = Math.max(y ?? -1e9, yy);
  }
  return y;
}
function highBridgeAt(x, z, ly) {
  const dx = x - HB.ax, dz = z - HB.az, along = dx * ux + dz * uz, across = dx * c0 - dz * s0;
  if (along < -0.6 || along > HB.L + 0.6 || Math.abs(across) > HB.half + 0.6) return null;
  const y = HB.yAt(along / HB.L); if (ly < y - 2) return null;
  return { y, inside: Math.abs(across) <= HB.half };
}
function groundAt(x, z, ly = null) {
  const hb = ly != null ? highBridgeAt(x, z, ly) : null;
  if (hb) return hb.y + 0.12;
  const ad = areaDeckAt(x, z); if (ad !== null) return ad;
  return H(x, z);
}
const DECK_STEP = 0.6;
function blocked(x, z, fx, fz, ly = null) {
  const hb = ly != null ? highBridgeAt(x, z, ly) : null;
  if (hb) return !hb.inside;
  const to = groundAt(x, z, ly), fromG = groundAt(fx, fz, ly), rise = to - fromG;
  if (areaDeckAt(x, z) !== null) return rise > DECK_STEP;
  if (areaDeckAt(fx, fz) !== null && rise <= DECK_STEP) return false;
  if (rise > 1.25) return true;
  return false;
}

test('source: east landing addDeck + ramp + pinned tiles + no belvedere / falls', () => {
  assert.match(HR, /id:\s*'rb_hb_east_land'/);
  assert.match(HR, /id:\s*'rb_hb_east_ramp'/);
  assert.match(HR, /HB\.yb - 0\.06/);
  // comments may mention the old waterfall arch; live imports / assets must be gone
  assert.doesNotMatch(HR, /belvedere_sign|falls\.glb|falls_blender|waterfallCorridor/);
  assert.doesNotMatch(HR, /from ['\"].*falls/);
  assert.ok(+(((src('sw.js')).match(/VERSION = 'pfp-v(\d+)'/) || [])[1]) >= 331, 'sw at or past pfp-v331'); // [v330] numeric: later bumps keep passing
  assert.doesNotMatch(src('js/island/areas/index.js'), /fallsBlender|waterfallCorridor|falls\.glb/);
});

test('HB east landing: feet stay on stone (groundAt ≈ HB.yb) across the 10×7 m slab', () => {
  const visTop = HB.yb; // tiles top / deck top
  let n = 0;
  for (let d = 0; d <= 7.5; d += 0.4) for (let o = -4.8; o <= 4.8; o += 0.4) {
    const x = HB.bx + ux * d + c0 * o, z = HB.bz + uz * d - s0 * o;
    const g = groundAt(x, z, HB.yb + 1);
    assert.ok(Math.abs(g - visTop) < 0.15, `sink d=${d} o=${o} g=${g.toFixed(2)} vs ${visTop.toFixed(2)} (H=${H(x, z).toFixed(2)})`);
    n++;
  }
  assert.ok(n > 200);
});

test('walk High Rope Bridge A→B and B→A without rail / void', () => {
  const step = 0.4;
  for (const dir of [1, -1]) {
    let prev = null, ly = HB.ya + 1;
    for (let t = dir > 0 ? 0 : 1; dir > 0 ? t <= 1 : t >= 0; t += dir * (step / HB.L)) {
      const x = HB.ax + (HB.bx - HB.ax) * t, z = HB.az + (HB.bz - HB.az) * t;
      const g = groundAt(x, z, ly); assert.ok(g > -20, `void t=${t}`);
      ly = g + 1;
      if (prev) assert.equal(blocked(x, z, prev[0], prev[1], ly), false, `blocked t=${t}`);
      prev = [x, z];
    }
  }
});

test('walk east landing → rb_plateau_path → Trail A and Gill dock both ways', () => {
  const path = [[HB.bx + ux * 3.5, HB.bz + uz * 3.5], [HB.bx + ux * 7.4, HB.bz + uz * 7.4],
    [-278.0, -70.4], [-275.5, -66.2], [-271.5, -62.6], [-266, -59.8], [-260, -58.6], [-230, -60], [-205, -63]];
  const walk = (pts) => {
    let prev = null, ly = HB.yb + 1;
    for (const [x, z] of pts) {
      // densify
      if (prev) {
        const L = Math.hypot(x - prev[0], z - prev[1]), n = Math.max(1, Math.ceil(L / 0.4));
        for (let i = 1; i <= n; i++) {
          const px = prev[0] + (x - prev[0]) * i / n, pz = prev[1] + (z - prev[1]) * i / n;
          const g = groundAt(px, pz, ly); assert.ok(g > -20, `void ${px},${pz}`);
          assert.equal(blocked(px, pz, prev[0] + (x - prev[0]) * (i - 1) / n, prev[1] + (z - prev[1]) * (i - 1) / n, ly), false,
            `blocked at ${px.toFixed(1)},${pz.toFixed(1)} rise=${(g - groundAt(prev[0], prev[1], ly)).toFixed(2)}`);
          ly = g + 1; prev = [px, pz];
        }
      } else prev = [x, z];
    }
  };
  walk(path);
  walk([...path].reverse());
});

test('D3 Rope Bridge approaches clear both ways (signposts off stairs)', () => {
  // south approach z -150 → -104, north -45 → -63; deck itself is bridgeAt (not in this Node stub) — check approach ground grades
  for (const [z0, z1] of [[RB.s1, RB.s0], [RB.n1, RB.n0]]) {
    let prev = null;
    for (let z = z0; (z1 > z0 ? z <= z1 : z >= z1); z += Math.sign(z1 - z0) * 0.5 || 0.5) {
      const x = RB.x, h = H(x, z);
      assert.ok(h > 20, `D3 approach ground ${x},${z} H=${h}`);
      if (prev) assert.ok(Math.abs(h - prev) < 1.3, `D3 lip ${z}: ${prev.toFixed(2)}→${h.toFixed(2)}`);
      prev = h;
    }
  }
  // ROPE BRIDGE signposts sit beside stairs, not on centerline
  for (const [x, z] of [[RB.x - 3.4, RB.s1 + 1.5], [RB.x + 3.4, -57]]) {
    assert.ok(Math.abs(x - RB.x) > 2.5, 'sign off centerline');
    assert.equal(waterAt(x, z), null, `D3 sign dry at ${x},${z}`);
  }
});

test('[v335] the added 3D street signs are removed (STREET_SIGN_SPOTS empty, none at the bridge mouths)', () => {
  assert.equal(STREET_SIGN_SPOTS.length, 0);
  assert.doesNotMatch(GEO, /hangman_bridge|boardwalk_market|blades:/);
  for (const s of STREET_SIGN_SPOTS) assert.fail('unexpected street sign ' + s.id);
  void HB;
});

test('cliff-edge samples that previously sank 10+ m now ride the landing deck', () => {
  for (const [d, o] of [[0, -4.8], [1, -4.8], [2, -3], [4, 4.8]]) {
    const x = HB.bx + ux * d + c0 * o, z = HB.bz + uz * d - s0 * o;
    const g = groundAt(x, z, HB.yb + 1);
    assert.ok(Math.abs(g - HB.yb) < 0.15, `d=${d} o=${o}: g=${g} H=${H(x,z)}`);
    assert.ok(H(x, z) < HB.yb - 0.5, `precondition cliff drop d=${d} o=${o} H=${H(x,z)}`);
  }
});
