import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three-0.165.0/build/three.module.js';

// Exercise the production pose helpers without booting the whole game.
const source = readFileSync(new URL('../js/onfoot/battle.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('  const _q ='), source.indexOf('  const ringGeo2'));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const poseDefinition = source.match(/^const P_MUSKET = .+;$/m)?.[0];
assert.ok(poseDefinition, 'production musket pose definition');
const P_MUSKET = new Function('v3', `${poseDefinition}; return P_MUSKET;`)(v3);
function load(search = '', grip = () => null) {
  return new Function('THREE', 'location', 'P_MUSKET', 'v3', 'weaponEmpty', `
    const Z_PIT=1, Z_RANGE=2;
    ${helpers}
    return { pose, reachArm, boneByName, on: MUSKET_ARM_ON };
  `)(THREE, { search }, P_MUSKET, v3, grip);
}
function rig() {
  const fig = new THREE.Group(), spine = new THREE.Bone(); fig.add(spine);
  const bones = { spine };
  for (const [side, sign] of [['R', -1], ['L', 1]]) {
    const u = new THREE.Bone(), f = new THREE.Bone();
    u.name = `upperarm.${side}`; f.name = `forearm.${side}`;
    u.position.set(sign * .2, .8, 0); f.position.set(sign * .1, 0, 0);
    spine.add(u); u.add(f); bones[`u${side}`] = u; bones[`f${side}`] = f;
  }
  fig.updateMatrixWorld(true);
  return { fig, bones, st: { zone: 2, w: 1, recoil: 0 }, musket: null };
}
function direction(bone, axis) {
  return new THREE.Vector3(axis, 0, 0).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()));
}

test('production kill switch: default on, exact zero parameter disables', () => {
  for (const q of ['', '?foo=1', '?musketarm=1', '?musketarm=00', '?xmusketarm=0']) assert.equal(load(q).on, true, q);
  for (const q of ['?musketarm=0', '?holster=0&musketarm=0', '?musketarm=0&foo=1']) assert.equal(load(q).on, false, q);
});

test('production bone lookup finds dotted and sanitized bones', () => {
  const r = rig(), h = load();
  assert.equal(h.boneByName(r.fig, 'upperarmR'), r.bones.uR);
  r.bones.uL.name = 'upperarm_L';
  assert.equal(h.boneByName(r.fig, 'upperarmL'), r.bones.uL);
  assert.equal(h.boneByName(r.fig, 'missing'), undefined);
});

test('shoulder fallback points both actual hand axes forward', () => {
  const r = rig(); load().pose(r);
  for (const key of ['uR', 'fR', 'uL', 'fL']) {
    assert.ok(direction(r.bones[key], key.endsWith('L') ? 1 : -1).dot(P_MUSKET[key]) > .999, key);
  }
});

test('IK uses +X for the left arm and rejects unreachable grips without disturbing fallback', () => {
  const r = rig(), h = load(); h.pose(r);
  const before = r.bones.uL.quaternion.clone();
  assert.equal(h.reachArm(r.bones.uL, r.bones.fL, new THREE.Vector3(9, 9, 9), 1, 1, null), false);
  assert.ok(before.equals(r.bones.uL.quaternion));
  const target = new THREE.Vector3(.2, .8, .18);
  assert.equal(h.reachArm(r.bones.uL, r.bones.fL, target, 1, 1, null), true);
  const shoulder = r.bones.uL.getWorldPosition(new THREE.Vector3());
  const elbow = r.bones.fL.getWorldPosition(new THREE.Vector3());
  const hand = elbow.clone().addScaledVector(direction(r.bones.fL, 1), .112);
  assert.ok(hand.distanceTo(target) < .0001, `left hand miss: ${hand.distanceTo(target)}`);
  assert.ok(elbow.distanceTo(shoulder) > .09);
});

test('disabled fix preserves old grip-only early return instead of adding shoulder fallback', () => {
  const r = rig(); r.musket = new THREE.Group(); r.fig.add(r.musket);
  // Both grips exactly at each shoulder make the original solver return early.
  const h = load('?musketarm=0', (_kind, _id, name) => new THREE.Vector3(name==='grip_r' ? -.2 : .2, .8, 0));
  const before = Object.values(r.bones).map(b => b.quaternion.clone());
  h.pose(r);
  Object.values(r.bones).forEach((b, i) => assert.ok(b.quaternion.equals(before[i])));
});
