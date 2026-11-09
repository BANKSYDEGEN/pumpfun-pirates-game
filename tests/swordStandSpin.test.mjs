// Standing with V7 sword drawn used to spin the torso: Three.PropertyMixer skips constant
// idle root/spine/thigh tracks, and v7Sword's post-mixer rot()/aimBone accumulated on the
// leftover twist (same class as tests/locomotion.test.mjs). battle.js hookBody must restore
// the last post-mixer locals before the next mixer update.
import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { v7SwordPose, makeV7SwordApply } from '../js/onfoot/v7Sword.js';

const SRC = fs.readFileSync(new URL('../js/onfoot/battle.js', import.meta.url), 'utf8');

test('battle.js restores the post-mixer bone snapshot before each mixer update (sword-stand-spin)', () => {
  assert.match(SRC, /__btMixQ/);
  assert.match(SRC, /b\.quaternion\.copy\(mq\[k\]\)/);
  assert.match(SRC, /Three\.PropertyMixer skips CONSTANT clip tracks|PropertyMixer skips CONSTANT/i);
  // still wraps update so the sword pose lands after the clip + swim/emote posts
  assert.match(SRC, /v4\.__btPose = \(\) => pose\(R\)/);
});

function makeRig() {
  const B = {}, mk = (n, p, par) => { const b = new THREE.Bone(); b.name = n; b.position.set(...p); (par || null)?.add(b); B[n] = b; return b; };
  const root = mk('root', [0, 0.55, 0]), spine = mk('spine', [0, 0.1, 0], root), head = mk('head', [0, 0.3, 0], spine);
  const uL = mk('upperarmL', [0.12, 0.2, 0], spine), uR = mk('upperarmR', [-0.12, 0.2, 0], spine);
  mk('forearmL', [0.13, 0, 0], uL); mk('forearmR', [-0.13, 0, 0], uR);
  const tL = mk('thighL', [0.09, -0.02, 0], root), tR = mk('thighR', [-0.09, -0.02, 0], root);
  mk('shinL', [0, -0.25, 0], tL); mk('shinR', [0, -0.25, 0], tR);
  const sc = new THREE.Group(); sc.add(root); sc.updateMatrixWorld(true);
  return {
    sc,
    B: { root, spine, head, uL, uR, fL: B.forearmL, fR: B.forearmR, tL, tR },
  };
}

const yawW = (o) => {
  const e = new THREE.Euler().setFromQuaternion(o.getWorldQuaternion(new THREE.Quaternion()), 'YXZ');
  return e.y;
};

function wrapLikeBattle(sc, bones, applyPose) {
  // Mirrors js/onfoot/battle.js hookBody: restore mix snapshot → mixer+posts → save snapshot → sword pose
  const tracks = Object.values(bones).map((b) => new THREE.QuaternionKeyframeTrack(b.name + '.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]));
  const mixer = new THREE.AnimationMixer(sc);
  mixer.clipAction(new THREE.AnimationClip('idle', 1, tracks)).play();
  let mixQ = null;
  return (dt, t) => {
    if (mixQ) for (const k of Object.keys(mixQ)) bones[k].quaternion.copy(mixQ[k]);
    mixer.update(dt);
    mixQ = mixQ || {};
    for (const k of Object.keys(bones)) (mixQ[k] ||= new THREE.Quaternion()).copy(bones[k].quaternion);
    applyPose(t);
  };
}

test('held V7 sword guard on constant idle: WITHOUT restore the spine world-yaw spins; WITH restore it stays put', () => {
  const apply = makeV7SwordApply(THREE), Q = new THREE.Quaternion();
  // Broken path (old): mixer then sword, no restore
  {
    const r = makeRig();
    const tracks = Object.values(r.B).map((b) => new THREE.QuaternionKeyframeTrack(b.name + '.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]));
    const mixer = new THREE.AnimationMixer(r.sc);
    mixer.clipAction(new THREE.AnimationClip('idle', 1, tracks)).play();
    const y0 = [];
    for (let i = 0; i < 180; i++) {
      mixer.update(1 / 60);
      apply(r.B, v7SwordPose(null, { time: i / 60 }), 1, Q, 'R');
      r.sc.updateMatrixWorld(true);
      if (i % 60 === 0) y0.push(yawW(r.B.spine));
    }
    assert.ok(Math.abs(y0[2] - y0[0]) > 1.5, `broken path must spin (Δyaw=${(y0[2] - y0[0]).toFixed(3)} over 2s), got ${y0}`);
  }
  // Fixed path
  {
    const r = makeRig();
    const step = wrapLikeBattle(r.sc, r.B, (t) => {
      apply(r.B, v7SwordPose(null, { time: t }), 1, Q, 'R');
      r.sc.updateMatrixWorld(true);
    });
    const ys = [];
    for (let i = 0; i < 180; i++) {
      step(1 / 60, i / 60);
      if (i % 60 === 0) ys.push(yawW(r.B.spine));
    }
    assert.ok(Math.abs(ys[2] - ys[0]) < 0.02, `fixed path must not spin (Δyaw=${(ys[2] - ys[0]).toFixed(4)}), got ${ys}`);
    assert.ok(Math.abs(ys[0] - 0.12) < 0.05, `guard net torso ~0.12 rad, got ${ys[0]}`);
  }
});
