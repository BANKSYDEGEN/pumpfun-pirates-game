// [ship-collide] t2435u: ships bounce — head-on, side-swipe, moored, fast/slow, no tunneling.
// node --test tests/shipCollide.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COLLIDE, hullHalf, hullR, hullMass, contact, resolvePair, resolveAll,
  resolveCanoeVsShips, defaultIsStatic, ellipseRadius, isWreck,
} from '../js/shipCollide.js';

const ship = (o = {}) => ({
  x: 0, z: 0, yaw: 0, speed: 0, turn: 0, alive: true, anchor: false, _safe: false, remote: false,
  mesh: { userData: { hitLen: o.len ?? 16, beam: o.beam ?? 5.2, len: o.len ?? 16 } },
  ...o,
});

const overlap = (a, b) => {
  const c = contact(a, b);
  return c ? c.pen : 0;
};

test('ellipse radius is beam along abeam and length along bow', () => {
  assert.ok(Math.abs(ellipseRadius(8, 2.5, 1, 0) - 2.5) < 1e-9);
  assert.ok(Math.abs(ellipseRadius(8, 2.5, 0, 1) - 8) < 1e-9);
  assert.ok(ellipseRadius(8, 2.5, Math.SQRT1_2, Math.SQRT1_2) > 2.5);
  assert.ok(ellipseRadius(8, 2.5, Math.SQRT1_2, Math.SQRT1_2) < 8);
});

test('hullHalf uses hitLen/beam with pad; bigger ships get bigger broad-phase R', () => {
  const sloop = ship({ len: 14, beam: 4.4 });
  const galleon = ship({ len: 22, beam: 7 });
  const hs = hullHalf(sloop), hg = hullHalf(galleon);
  assert.ok(hg.hl > hs.hl && hg.hb > hs.hb);
  assert.ok(hullR(galleon) > hullR(sloop));
  assert.ok(hullMass(galleon) > hullMass(sloop));
  assert.equal(hullMass(ship({ remote: true })), COLLIDE.staticMass);
});

test('head-on: two ships sailing at each other separate and lose forward speed', () => {
  const a = ship({ x: 0, z: 0, yaw: 0, speed: 10, len: 16, beam: 5 });       // facing +Z
  const b = ship({ x: 0, z: 14, yaw: Math.PI, speed: 10, len: 16, beam: 5 }); // facing -Z, overlapping
  assert.ok(overlap(a, b) > 0.5, 'start overlapping');
  const before = overlap(a, b);
  resolvePair(a, b, 1 / 60);
  assert.ok(overlap(a, b) < before, 'penetration reduced');
  assert.ok(a.speed < 10 && b.speed < 10, 'speed bled');
  // After a few frames they should clear
  for (let i = 0; i < 20; i++) {
    a.x += Math.sin(a.yaw) * a.speed * (1 / 60);
    a.z += Math.cos(a.yaw) * a.speed * (1 / 60);
    b.x += Math.sin(b.yaw) * b.speed * (1 / 60);
    b.z += Math.cos(b.yaw) * b.speed * (1 / 60);
    resolvePair(a, b, 1 / 60);
  }
  assert.ok(overlap(a, b) < 0.15, `cleared overlap, pen=${overlap(a, b)}`);
});

test('side-swipe: parallel ships glancing — mostly slide, little opposite shove', () => {
  const a = ship({ x: 0, z: 0, yaw: 0, speed: 8, len: 16, beam: 5 });
  const b = ship({ x: 5.2, z: 2, yaw: 0, speed: 8, len: 16, beam: 5 }); // alongside, slight overlap
  assert.ok(overlap(a, b) > 0);
  const ax0 = a.x, bx0 = b.x;
  resolvePair(a, b, 1 / 60);
  // Separated along beam (X)
  assert.ok(a.x < ax0 || b.x > bx0, 'pushed apart sideways');
  // Still mostly going forward
  assert.ok(a.speed > 3 && b.speed > 3, 'keep forward slide');
});

test('ship vs moored ship: moored stays put, mover bounces', () => {
  const moored = ship({ x: 0, z: 20, yaw: 0, speed: 0, anchor: true, _safe: true, len: 18, beam: 6 });
  const mover = ship({ x: 0, z: 8, yaw: 0, speed: 12, len: 16, beam: 5 });
  // Place mover so bow overlaps moored stern
  mover.z = moored.z - (hullHalf(mover).hl + hullHalf(moored).hl) + 2;
  const mz = moored.z, mx = moored.x;
  assert.ok(overlap(mover, moored) > 0);
  resolvePair(mover, moored, 1 / 60, { isStatic: (s) => defaultIsStatic(s) });
  assert.equal(moored.x, mx);
  assert.equal(moored.z, mz);
  assert.ok(mover.z < moored.z - 1, 'mover pushed back / aside');
  assert.ok(mover.speed < 12, 'mover slowed');
});

test('remote ship is never moved (network authority)', () => {
  const remote = ship({ x: 10, z: 10, yaw: 1, speed: 7, remote: true, len: 16, beam: 5 });
  const local = ship({ x: 10, z: 10 + 10, yaw: Math.PI, speed: 9, len: 16, beam: 5 });
  // Force overlap
  local.z = remote.z + 6;
  const rx = remote.x, rz = remote.z, ry = remote.yaw, rsp = remote.speed;
  resolvePair(local, remote, 1 / 60, { isStatic: defaultIsStatic });
  assert.equal(remote.x, rx);
  assert.equal(remote.z, rz);
  assert.equal(remote.yaw, ry);
  assert.equal(remote.speed, rsp);
  assert.ok(local.x !== 10 || local.z !== remote.z + 6 || local.speed < 9, 'local reacted');
});

test('fast vs slow: lighter/faster ship absorbs more of the shove', () => {
  const heavy = ship({ x: 0, z: 0, yaw: 0, speed: 3, len: 22, beam: 8 });
  const light = ship({ x: 0, z: 18, yaw: Math.PI, speed: 14, len: 12, beam: 3.8 });
  // Overlap them
  light.z = heavy.z + 10;
  const hz0 = heavy.z, lz0 = light.z;
  resolvePair(heavy, light, 1 / 60);
  const dHeavy = Math.abs(heavy.z - hz0), dLight = Math.abs(light.z - lz0);
  assert.ok(dLight >= dHeavy * 0.9, `light moved more (${dLight} vs ${dHeavy})`);
});

test('no tunneling at max charge speed over a long step', () => {
  // Ramming charge ~21 m/s; even a 50 ms hitch should not leave them stuck inside after resolve.
  const a = ship({ x: 0, z: 0, yaw: 0, speed: 21, len: 16, beam: 5 });
  const b = ship({ x: 0, z: 40, yaw: Math.PI, speed: 21, len: 16, beam: 5 });
  const dt = 1 / 20; // 50 ms
  for (let t = 0; t < 3; t += dt) {
    a.z += Math.cos(a.yaw) * a.speed * dt;
    b.z += Math.cos(b.yaw) * b.speed * dt;
    resolveAll([a, b], dt);
  }
  // Either separated or only lightly overlapping (solver capped)
  assert.ok(overlap(a, b) < 1.2, `no deep tunnel pen=${overlap(a, b)}`);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 6, 'centres not stacked');
});

test('resolveAll multi-ship + resting contact does not explode / jitter forever', () => {
  const ships = [];
  for (let i = 0; i < 5; i++) ships.push(ship({ x: i * 4.5, z: 0, yaw: 0, speed: 0.2, len: 14, beam: 5 }));
  // Pack them so neighbours overlap
  for (let k = 0; k < 30; k++) resolveAll(ships, 1 / 60);
  for (const s of ships) {
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z) && Number.isFinite(s.speed));
    assert.ok(Math.abs(s.speed) < 8, 'no launch');
    assert.ok(Math.abs(s.x) < 80 && Math.abs(s.z) < 40, 'no teleport');
  }
  // Neighbours should be mostly clear
  let deep = 0;
  for (let i = 0; i < ships.length; i++) for (let j = i + 1; j < ships.length; j++) if (overlap(ships[i], ships[j]) > 0.5) deep++;
  assert.ok(deep <= 2, `few residual deep overlaps (${deep})`);
});

test('canoe bounces off a ship without moving the ship', () => {
  const big = ship({ x: 0, z: 0, yaw: 0, speed: 5, len: 18, beam: 6 });
  const canoe = { x: 0, z: 8, yaw: 0, speed: 12, len: 5.6, halfBeam: 0.78 };
  // Drive canoe into the bow
  canoe.z = hullHalf(big).hl - 0.5;
  const bx = big.x, bz = big.z, bsp = big.speed;
  const hits = resolveCanoeVsShips(canoe, [big], 1 / 60);
  assert.ok(hits >= 1);
  assert.equal(big.x, bx); assert.equal(big.z, bz); assert.equal(big.speed, bsp);
  assert.ok(canoe.z > hullHalf(big).hl - 0.5 - 0.01 || canoe.speed < 12, 'canoe reacted');
});

test('defaultIsStatic: remote, docked, moored-in-safe, dead', () => {
  assert.equal(defaultIsStatic(ship({ remote: true })), true);
  assert.equal(defaultIsStatic(ship({ alive: false })), true);
  assert.equal(defaultIsStatic(ship({ _docked: true })), true);
  assert.equal(defaultIsStatic(ship({ anchor: true, _safe: true, speed: 0 })), true);
  assert.equal(defaultIsStatic(ship({ anchor: true, _safe: true, speed: 2 })), false); // sailing out
  assert.equal(defaultIsStatic(ship({}), { docked: () => true }), true);
  assert.equal(defaultIsStatic(ship({ speed: 8 })), false);
});

test('wired into main.js; no damage path; broadsideAim untouched by this feature', () => {
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(main, /shipCollide\.js/);
  assert.match(main, /ShipCollide\.resolveAll/);
  assert.match(main, /ship-collide/);
  assert.match(main, /ShipCollide\.isWreck/);
  assert.ok(!/e\.alive \|\| e\.remote/.test(main), 'dead remotes must not stay in the hull list');
  // No HP change in the collide module
  const mod = readFileSync(new URL('../js/shipCollide.js', import.meta.url), 'utf8');
  assert.ok(!/\.hp\s*[+\-]=/.test(mod) && !/damage\(/.test(mod), 'no collision damage');
  // This feature must not edit broadsideAim (parallel worker)
  // (presence of import BA in main is fine — we just don't touch that file)
  assert.ok(!mod.includes('broadsideAim'));
});

test('COLLIDE tunables are finite and sane', () => {
  for (const [k, v] of Object.entries(COLLIDE)) {
    assert.ok(Number.isFinite(v), k);
  }
  assert.ok(COLLIDE.restitution >= 0 && COLLIDE.restitution < 1);
  assert.ok(COLLIDE.maxSep > 0.5 && COLLIDE.maxSep < 6);
  assert.ok(COLLIDE.iters >= 1 && COLLIDE.iters <= 4);
});

// [wreck-nonsolid] t2515u: sail through sunk / sinking wrecks (local + remote) to grab loot.
test('isWreck: dead or sinking; live ships are solid', () => {
  assert.equal(isWreck(ship()), false);
  assert.equal(isWreck(ship({ alive: false })), true);
  assert.equal(isWreck(ship({ alive: true, sinking: 0.001 })), true);
  assert.equal(isWreck(ship({ alive: false, remote: true, sinking: 99 })), true);
  assert.equal(isWreck(ship({ sinking: 0 })), false);
  assert.equal(isWreck(null), false);
});

test('sunk local ship is not solid: live ship sails through, no bounce', () => {
  const wreck = ship({ x: 0, z: 10, yaw: 0, speed: 0, alive: false, sinking: 1, len: 16, beam: 5 });
  const mover = ship({ x: 0, z: 10, yaw: 0, speed: 10, len: 16, beam: 5 }); // parked on the wreck
  const wx = wreck.x, wz = wreck.z, mx = mover.x, mz = mover.z, sp = mover.speed;
  assert.ok(overlap(mover, wreck) > 1, 'start overlapping the wreck');
  const hits = resolveAll([mover, wreck], 1 / 60, { isStatic: defaultIsStatic });
  assert.equal(hits, 0);
  assert.equal(resolvePair(mover, wreck, 1 / 60, { isStatic: defaultIsStatic }), null);
  assert.equal(wreck.x, wx); assert.equal(wreck.z, wz);
  assert.equal(mover.x, mx); assert.equal(mover.z, mz); assert.equal(mover.speed, sp);
});

test('remote sunk ship is not solid either (harbor / PvP sync)', () => {
  const wreck = ship({ x: 0, z: 0, yaw: 1, speed: 0, alive: false, sinking: 2, remote: true, len: 18, beam: 6 });
  const local = ship({ x: 0, z: 4, yaw: 0, speed: 11, len: 16, beam: 5 });
  const rx = wreck.x, rz = wreck.z, ry = wreck.yaw, lx = local.x, lz = local.z, sp = local.speed;
  assert.ok(overlap(local, wreck) > 0, 'overlapping a remote wreck');
  const hits = resolveAll([local, wreck], 1 / 60, { isStatic: defaultIsStatic });
  assert.equal(hits, 0);
  assert.equal(wreck.x, rx); assert.equal(wreck.z, rz); assert.equal(wreck.yaw, ry);
  assert.equal(local.x, lx); assert.equal(local.z, lz); assert.equal(local.speed, sp);
});

test('sinking but still flagged alive is already non-solid', () => {
  const wreck = ship({ x: 0, z: 0, yaw: 0, speed: 0, alive: true, sinking: 0.001, remote: true, len: 16, beam: 5 });
  const local = ship({ x: 0, z: 6, yaw: Math.PI, speed: 9, len: 16, beam: 5 });
  const lz = local.z, sp = local.speed;
  resolveAll([local, wreck], 1 / 60, { isStatic: defaultIsStatic });
  assert.equal(local.z, lz);
  assert.equal(local.speed, sp);
});

test('two live ships still bounce after the wreck change', () => {
  const a = ship({ x: 0, z: 0, yaw: 0, speed: 10, len: 16, beam: 5 });
  const b = ship({ x: 0, z: 14, yaw: Math.PI, speed: 10, len: 16, beam: 5 });
  const before = overlap(a, b);
  assert.ok(before > 0.5);
  resolvePair(a, b, 1 / 60);
  assert.ok(overlap(a, b) < before);
  assert.ok(a.speed < 10 && b.speed < 10);
});

test('live remote is still a static wall; only wreck remotes are skipped', () => {
  const remote = ship({ x: 0, z: 0, yaw: 0, speed: 4, remote: true, alive: true, sinking: 0, len: 16, beam: 5 });
  const local = ship({ x: 0, z: 6, yaw: Math.PI, speed: 9, len: 16, beam: 5 });
  const rx = remote.x, rz = remote.z, rsp = remote.speed;
  const lz0 = local.z, sp0 = local.speed;
  assert.ok(overlap(local, remote) > 0);
  resolvePair(local, remote, 1 / 60, { isStatic: defaultIsStatic });
  assert.equal(remote.x, rx); assert.equal(remote.z, rz); assert.equal(remote.speed, rsp);
  assert.ok(local.z !== lz0 || local.speed < sp0, 'local still bounced off a live remote');
});

test('canoe sails through a wreck and still bounces off a live ship', () => {
  const wreck = ship({ x: 0, z: 0, yaw: 0, speed: 0, alive: false, sinking: 3, remote: true, len: 18, beam: 6 });
  const canoe = { x: 0, z: 2, yaw: 0, speed: 12, len: 5.6, halfBeam: 0.78 };
  const cz = canoe.z, csp = canoe.speed;
  assert.equal(resolveCanoeVsShips(canoe, [wreck], 1 / 60), 0);
  assert.equal(canoe.z, cz); assert.equal(canoe.speed, csp);

  const live = ship({ x: 20, z: 0, yaw: 0, speed: 5, len: 18, beam: 6 });
  const canoe2 = { x: 20, z: hullHalf(live).hl - 0.5, yaw: 0, speed: 12, len: 5.6, halfBeam: 0.78 };
  const hits = resolveCanoeVsShips(canoe2, [live], 1 / 60);
  assert.ok(hits >= 1);
});
