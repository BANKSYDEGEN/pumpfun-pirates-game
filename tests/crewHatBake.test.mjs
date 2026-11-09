import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { cloneCrewBakeRig } from '../js/crewV4.js';
import { crewGear, crewToWire, crewFromWire, crewColorToWire, crewColorFromWire } from '../js/crewLoadout.js';
import { crewGearKey } from '../js/crewGear.js';

test('armed wardrobe bake clones the skeleton without JSON-copying cyclic carryState; source state survives', () => {
  const root = new THREE.Group(), bone = new THREE.Bone(); bone.name = 'head'; root.add(bone);
  const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  root.add(mesh); mesh.bind(new THREE.Skeleton([bone]));
  const state = { body: { object: mesh }, root }; root.userData.carryState = state; mesh.userData.carryState = state;
  const sourceRootData = root.userData, sourceBodyData = mesh.userData;
  assert.throws(() => root.clone(), /circular/i);
  const copy = cloneCrewBakeRig(root), copiedMesh = copy.children.find(o => o.isSkinnedMesh);
  assert.notEqual(copy, root); assert.notEqual(copiedMesh.skeleton, mesh.skeleton);
  assert.notEqual(copiedMesh.skeleton.bones[0], bone); assert.equal(copiedMesh.skeleton.bones[0].name, 'head');
  assert.equal(copiedMesh.geometry, mesh.geometry); assert.equal(root.userData, sourceRootData);
  assert.equal(mesh.userData, sourceBodyData); assert.equal(root.userData.carryState, state);
  assert.equal(state.body.object, mesh); assert.equal(state.root, root);
});

test('bake clone restores every source userData object even when cloning throws', () => {
  const root = new THREE.Group(), child = new THREE.Group(); root.add(child);
  root.userData = { circular: root }; child.userData = { circular: child };
  const a = root.userData, b = child.userData; root.clone = () => { throw Error('fixture clone failure'); };
  assert.throws(() => cloneCrewBakeRig(root), /fixture clone failure/);
  assert.equal(root.userData, a); assert.equal(child.userData, b);
});

test('all paid crew headgear and dye selections survive own/remote mapping and uniform bake key', () => {
  for (const hat of ['tricorn', 'bicorne', 'crown', 'crown_imperial', 'helmet_hq']) {
    const l = { crewhat: hat, crewhatColor: 4, crewoutfit: 'shirt' };
    const own = crewGear(l), remote = crewGear({ ...crewFromWire(crewToWire(l)), crewhatColor: crewColorFromWire(crewColorToWire(l)) });
    assert.equal(own.hat, hat); assert.equal(own.hatColor, 4); assert.deepEqual(remote, own);
    assert.equal(crewGearKey(own), crewGearKey(remote));
    assert.notEqual(crewGearKey(own), crewGearKey({ ...own, hat: 'none' }));
  }
  const source = readFileSync(new URL('../js/crewV4.js', import.meta.url), 'utf8');
  assert.match(source, /const scene = cloneCrewBakeRig\(gltf.scene\)/);
});
