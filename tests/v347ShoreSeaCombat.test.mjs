// [v347] shore <-> sea combat kept. [cannon-snake] player heat-seek restored with soft look + hull/deck hits.
// node --test tests/v347ShoreSeaCombat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as BA from '../js/broadsideAim.js';
import * as SC from '../js/shoreCombat.js';

const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DEG = Math.PI / 180;
// js/main.js sideDir(): port = (cos yaw, 0, -sin yaw), star = -that; ship forward = (sin yaw, cos yaw)
const sideDir = (yaw, side) => { const k = side === 'port' ? 1 : -1; return { x: Math.cos(yaw) * k, z: -Math.sin(yaw) * k }; };
const at = (dir, deg, d) => { const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG); return { x: (dir.x * c - dir.z * s) * d, z: (dir.x * s + dir.z * c) * d }; };
const offDir = (v, dir) => Math.acos(Math.min(1, (v.x * dir.x + v.z * dir.z) / Math.hypot(v.x, v.z))) / DEG;

test('player broadside lock window restored ~±43° (pre-v347 heat-seek); still ignores bow/stern', () => {
  const dir = sideDir(0.7, 'port');
  for (const deg of [0, 20, 40, -40]) { const p = at(dir, deg, 60); assert.ok(BA.inCone(dir, p.x, p.z), `${deg}° locks`); }
  for (const deg of [50, 90, 180]) { const p = at(dir, deg, 60); assert.ok(!BA.inCone(dir, p.x, p.z), `${deg}° ignored`); }
  assert.ok(Math.abs(BA.AIM.cone - 0.75) < 1e-9);
});

test('player launch clamp ~23° + smooth home; AI fireLine still <= ~13°', () => {
  const dir = sideDir(-1.1, 'star');
  for (const deg of [3, 10, 15, 30]) {
    const t = at(dir, deg, 70);
    const g = BA.playerAimVelocity({ x: 0, y: 2, z: 0 }, dir, t.x, t.z, 1.6, BA.AIM.maxDev);
    if (g) assert.ok(offDir(g, dir) <= BA.AIM.maxDev / DEG + 0.05, `player launch ${deg}`);
    const A = BA.fireLine(dir, 0, 0, t.x, t.z, BA.AIM.aiMaxDev);
    assert.ok(offDir(A, dir) <= 13.2, `AI ${deg}°`);
  }
  assert.equal(BA.AIM.lead, 1); assert.equal(BA.AIM.aiLead, 1);
  assert.ok(Math.abs(BA.AIM.aiMaxDev - 0.23) < 1e-9, 'AI assist unchanged');
});

test('AI volley still parallel via fireLine; player heat-seek fans along hull but stays clamped', () => {
  const yaw = 0.4, dir = sideDir(yaw, 'port'), fw = { x: Math.sin(yaw), z: Math.cos(yaw) }, n = 10, sx = 5, sz = -3;
  const tgt = at(dir, 4, 80), L = BA.fireLine(dir, sx, sz, sx + tgt.x, sz + tgt.z, BA.AIM.aiMaxDev);
  const guns = Array.from({ length: n }, (_, i) => { const k = (i - (n - 1) / 2) * 1.6; return { x: sx + fw.x * k + dir.x * 2, y: 2.4, z: sz + fw.z * k + dir.z * 2 }; });
  const vs = guns.map(g => BA.gunVelocity(g, sx, sz, L, 2, 42));
  const h0 = Math.atan2(vs[0].x, vs[0].z); for (const v of vs) assert.ok(Math.abs(Math.atan2(v.x, v.z) - h0) < 1e-9, 'AI same heading');
  const pvs = guns.map(g => BA.playerAimVelocity(g, dir, sx + tgt.x, sz + tgt.z, BA.hullAimY({ y: 0, deckY: 3, depth: 3 }), BA.AIM.maxDev));
  assert.ok(pvs.every(Boolean));
  for (const v of pvs) assert.ok(offDir(v, dir) <= BA.AIM.maxDev / DEG + 0.05);
});

test('js/main.js: no dual-path b.ex/b.tp; player heat-seek steers true path; hull/deck hits', () => {
  const m = R('js/main.js');
  assert.ok(!/BALL_EXIT_T/.test(m), 'BALL_EXIT_T gone');
  assert.ok(!/b\.ex\s*=\s*\{/.test(m), 'no lateral ease fake');
  assert.ok(!/b\.tp\s*\|\|/.test(m), 'drawn = simulated');
  assert.ok(/BA\.inCone\(dir, dx, dz\)/.test(m) && /BA\.playerAimVelocity\(/.test(m) && /BA\.steerHoriz\(/.test(m));
  assert.ok(/BA\.hullAimY\(/.test(m) && /BA\.inHullBand\(/.test(m));
  assert.ok(!/aimT/.test(m.slice(m.indexOf('function launchBall'), m.indexOf('function launchBall') + 1500)));
});

test('musket ray: captain cylinder + ship hull box (pure math)', () => {
  const o = { x: 0, y: 3, z: 0 }, f = { x: 1, z: 0 };
  assert.ok(Math.abs(SC.rayCylH(o, f, null, 150, 0.2, 0.6, 2, 4.5, 200) - (150 - Math.sqrt(0.36 - 0.04))) < 1e-9);
  assert.equal(SC.rayCylH(o, f, null, 150, 2, 0.6, 2, 4.5, 200), -1, 'wide miss'); assert.equal(SC.rayCylH(o, f, null, 250, 0, 0.6, 2, 4.5, 200), -1, 'out of range');
  const ship = { x: 120, z: 0, yaw: 0, hw: 3.5, hl: 11, y0: -1.2, y1: 18 }; // yaw 0: hull along z, beam along x
  assert.ok(Math.abs(SC.rayShipBox(o, f, null, ship, 200) - 116.5) < 1e-9);
  assert.equal(SC.rayShipBox(o, f, -0.2, ship, 200), -1, 'aimed into the water first');
  assert.equal(SC.rayShipBox({ x: 0, y: 3, z: 30 }, f, null, ship, 200), -1, 'passes the bow');
  assert.ok(SC.SHIP_RANGE >= 160 && SC.SHIP_RANGE <= 220);
});

test('t1822u: captain = the musket\'s own damage, hull = small ship damage (3-6 common)', () => {
  for (const r of [0, 0.5, 0.999]) { const d = SC.hullDamage(19, () => r); assert.ok(d >= 3 && d <= 6, `hull ${d}`); }
  assert.ok(SC.hullDamage(25, () => 0.999) <= 8); assert.equal(SC.CAPTAIN_HP, 100);
  const p = R('js/pvp.js');
  assert.match(p, /capHit \? Math\.max\(1, Math\.round\(gunDmg\)\) : SC\.hullDamage\(gunDmg\)/);
  assert.match(p, /kind: 'captain', s, bot \}; continue; \} \/\/ t1822u: the captain FIRST/);
  assert.match(p, /\.on\('gh', onGunHit\)/); assert.match(p, /localDamage\(SC\.BOMB_DMG, m\.s/);
  assert.match(p, /shipProtectedHarbor\(pl\)\) return; \/\/ on foot, crewed, out of SAFE HARBOR/);
  assert.match(p, /inSafeH\(fp\.x, fp\.z\)\) return; \/\/ nobody snipes out of an Island Safe Zone/);
  const b = R('js/onfoot/battle.js'); assert.match(b, /ships\.test\(\{ x, y: mz\.y, z \}, f, slope, lim\)/); assert.match(b, /ships\.hit\(hit\.ship, end, S\.dmg\)/);
});

test('t1823u: a cannonball kills a pirate on foot (direct or splash), never friendly / Safe Zone / god mode', () => {
  const q = { x: 10, y: 1, z: 10 };
  assert.ok(SC.blastHits({ x: 10.4, y: 2, z: 10.2 }, q, false), 'direct'); assert.ok(!SC.blastHits({ x: 12, y: 2, z: 10 }, q, false));
  assert.ok(SC.blastHits({ x: 12.5, y: 1, z: 11 }, q, true), 'splash'); assert.ok(!SC.blastHits({ x: 14, y: 1, z: 12 }, q, true), 'outside the blast');
  assert.ok(SC.BOMB_DMG >= 100);
  const p = R('js/pvp.js');
  assert.match(p, /sid && \(sid === myId \|\| isSquadMate\(sid\)\)\) return false; \/\/ no friendly fire/);
  assert.match(p, /B\.takeHit\(SC\.BOMB_DMG, by, sid\); \/\/ takeHit \+ sid → open-island KOTH victim claimKill/);
  assert.match(p, /KILLED BY/); assert.match(p, /BOMBED/); assert.match(p, /\.on\('bk', onBombKill\)/);
  assert.match(p, /if \(K\.dock\?\.onFoot && ballShore\(b, p, false\)\) return true;/);
  const b = R('js/onfoot/battle.js'); assert.match(b, /function takeHit\(n, by, byId = null\) \{ if \(ADM\.god\)/); assert.match(b, /canFightOnFoot\(isleSafe/);
  const m = R('js/main.js'); assert.match(m, /dock\.world\.ground\(p\.x, p\.z\) : -1e9/); assert.match(m, /if \(g > wh \+ 0\.05 && p\.y <= g\)/); assert.match(m, /islands\.hitBall\(p, gnd > -1e8\)/);
  assert.match(R('js/props.js'), /hitBall\(p, walkable = false\)/); assert.match(m, /pvp\.shoreImpact\?\.\(b, p\)/);
  assert.match(m, /pvp\.shoreTarget\?\.\(e\)/);
  const bt = R('js/dock/battery.js'); assert.match(bt, /hitFoot\(p, b\.by, false\)/); assert.match(R('js/dock/index.js'), /shoreBattery\?\.\(p, by, impact\)/);
});

test('sw version >= 347 + new modules cached', () => {
  const s = R('sw.js'); assert.ok(+((s.match(/const VERSION = 'pfp-v(\d+)'/) || [])[1]) >= 347);
  assert.match(s, /js\/shoreCombat\.js/); assert.match(s, /js\/broadsideAim\.js/);
});

test('t1826u: a tab refresh resumes the Harbor AT YOUR SHIP (never ashore / in the hull where you got stuck)', () => {
  const m = R('js/main.js'), boot = m.slice(m.indexOf('async function harborResumeBoot'), m.indexOf('async function harborResumeBoot') + 2500);
  assert.doesNotMatch(boot, /goAshoreAt|enterHull/); assert.match(boot, /pvp\.resumeServer\?\.\(r\)/);
  assert.match(boot, /dock\.applyResume\?\.\(r\); await wait\(\(\) => !dock\.onFoot && !dock\.inHull && dock\.docking\?\.mode === 'docked'/);
  const d = R('js/dock/index.js'), ar = d.slice(d.indexOf('applyResume: (r) =>'), d.indexOf('applyResume: (r) =>') + 600);
  assert.doesNotMatch(ar, /goAshoreAt|enterHull/); assert.match(ar, /if \(onFoot\) goAboard\(true\)/); assert.match(ar, /if \(shipHull\?\.inHull\) leaveHull\(\)/);
  assert.match(ar, /return docking\.mode === 'docked' && !onFoot && !shipHull\?\.inHull/);
});
