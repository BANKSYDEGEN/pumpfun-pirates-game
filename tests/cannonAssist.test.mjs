// [cannon-assist] t2423u: a bit better player broadside assist — still no heat-seeking / extreme snap.
// node --test tests/cannonAssist.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as BA from '../js/broadsideAim.js';

const DEG = Math.PI / 180;
const sideDir = (yaw, side) => { const k = side === 'port' ? 1 : -1; return { x: Math.cos(yaw) * k, z: -Math.sin(yaw) * k }; };
const at = (dir, deg, d) => { const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG); return { x: (dir.x * c - dir.z * s) * d, z: (dir.x * s + dir.z * c) * d }; };
const offDir = (v, dir) => Math.acos(Math.min(1, (v.x * dir.x + v.z * dir.z) / Math.hypot(v.x, v.z))) / DEG;
const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('just-inside / just-outside cone (player lock window ~17°)', () => {
  assert.ok(Math.abs(BA.AIM.cone - 0.30) < 1e-9);
  const coneDeg = BA.AIM.cone / DEG; // ~17.19°
  for (const side of ['port', 'star']) {
    const dir = sideDir(1.2, side);
    const inside = at(dir, coneDeg - 0.4, 55);
    const outside = at(dir, coneDeg + 0.4, 55);
    assert.ok(BA.inCone(dir, inside.x, inside.z), `${side} just inside locks`);
    assert.ok(!BA.inCone(dir, outside.x, outside.z), `${side} just outside ignored`);
  }
});

test('port and starboard cones are symmetric; forward/aft never lock', () => {
  const yaw = -0.55;
  for (const side of ['port', 'star']) {
    const dir = sideDir(yaw, side);
    assert.ok(BA.inCone(dir, ...Object.values(at(dir, 0, 40))), `${side} beam locks`);
    // ship forward = (sin yaw, cos yaw); aft = opposite — both orthogonal to broadside → outside cone
    const fw = { x: Math.sin(yaw) * 50, z: Math.cos(yaw) * 50 };
    const aft = { x: -fw.x, z: -fw.z };
    assert.ok(!BA.inCone(dir, fw.x, fw.z), `${side} no bow snap`);
    assert.ok(!BA.inCone(dir, aft.x, aft.z), `${side} no stern snap`);
  }
});

test('fireLine clamps to maxDev — no 45°+/66° sideways snap; small offsets met exactly', () => {
  assert.ok(Math.abs(BA.AIM.maxDev - 0.12) < 1e-9);
  const dir = sideDir(0, 'port'); // +X
  const small = BA.fireLine(dir, 0, 0, 40, 3, BA.AIM.maxDev); // ~4.3° off
  assert.ok(offDir(small, dir) < 5 && Math.abs(small.dev) < BA.AIM.maxDev + 1e-9);
  const far = BA.fireLine(dir, 0, 0, 10, 80, BA.AIM.maxDev); // nearly forward
  assert.ok(Math.abs(far.dev) <= BA.AIM.maxDev + 1e-12);
  assert.ok(offDir(far, dir) <= BA.AIM.maxDev / DEG + 0.05);
  assert.ok(offDir(far, dir) < 8, 'still a gentle nudge, not a 45°+ swing');
});

test('no in-flight guidance / no mid-air re-aim; free shot path when no lock remains', () => {
  const m = R('js/main.js');
  assert.ok(!/BALL_EXIT_T/.test(m), 'BALL_EXIT_T gone');
  assert.ok(!/b\.ex\s*=\s*\{/.test(m) && !/b\.ex\.x/.test(m), 'no lateral ease');
  const launch = m.slice(m.indexOf('function launchBall'), m.indexOf('function launchBall') + 1500);
  assert.ok(!/aimT/.test(launch), 'no ripple re-aim onto a fixed point');
  // unaimed free shot still exists (dir * H + vel0) when line is null
  assert.match(m, /if \(!v\) \{ const t = range \/ H; v = dir\.clone\(\)\.multiplyScalar\(H\)\.add\(vel0\)/);
  assert.match(m, /if \(line\.d < 4\) line = null/);
});

test('lead nudge is player-only; AI assist constants unchanged', () => {
  assert.ok(Math.abs(BA.AIM.lead - 0.34) < 1e-9);
  assert.equal(BA.AIM.aiLead, 1);
  assert.ok(Math.abs(BA.AIM.aiMaxDev - 0.23) < 1e-9);
  // player lead stays well below full AI lead
  assert.ok(BA.AIM.lead < 0.5);
  const T = { x: 60, z: 0, yaw: Math.PI / 2, speed: 12 };
  const p28 = BA.leadPoint(0, 0, T, 0.28);
  const p34 = BA.leadPoint(0, 0, T, BA.AIM.lead);
  const pAI = BA.leadPoint(0, 0, T, BA.AIM.aiLead);
  // more lead ⇒ aim point further along target travel (here +X)
  assert.ok(p34.x > p28.x && pAI.x > p34.x);
});

test('range / target guards: inCone rejects zero-length; fireLine d>=0; gunVelocity floor range', () => {
  const dir = sideDir(0.2, 'star');
  assert.ok(!BA.inCone(dir, 0, 0));
  const L = BA.fireLine(dir, 5, 5, 5 - dir.x * 2, 5 - dir.z * 2, BA.AIM.maxDev); // behind the broadside
  assert.ok(L.d >= 0);
  const g = BA.gunVelocity({ x: 5, y: 2, z: 5 }, 5, 5, { x: dir.x, z: dir.z, d: 1 }, 2);
  assert.ok(g.t >= 0.3);
});

test('main.js still uses player AIM.* only for player; AI uses aiLead/aiMaxDev (no silent AI buff)', () => {
  const m = R('js/main.js');
  assert.match(m, /shooter === player \? BA\.AIM\.lead : BA\.AIM\.aiLead/);
  assert.match(m, /shooter === player \? BA\.AIM\.maxDev : BA\.AIM\.aiMaxDev/);
  // damage / cooldown / projectile count paths untouched by this commit's intent — gunList + reload still drive volleys
  assert.match(m, /const muzzles = gunList\(shooter, side\)/);
  assert.match(m, /player\.cd\[side\] = player\.reload/);
});

test('ballistics gravity constant preserved (G=20, H=42)', () => {
  assert.equal(BA.AIM.H, 42);
  assert.equal(BA.AIM.G, 20);
  const dir = sideDir(0, 'port'), t = at(dir, 2, 50);
  const L = BA.fireLine(dir, 0, 0, t.x, t.z, BA.AIM.maxDev);
  const v = BA.gunVelocity({ x: 0, y: 2.5, z: 0 }, 0, 0, L, 2);
  const y = 2.5 + v.y * v.t - 0.5 * BA.AIM.G * v.t * v.t;
  assert.ok(Math.abs(y - 2) < 1e-6);
});
