import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { crewGear, crewFromWire, crewToWire, CREW_DEFAULT } from '../js/crewLoadout.js';
import { crewChoiceLabel } from '../js/crewWardrobe.js';
import { shoreCrewGear, CREW_BODY_GLB, crewFemale } from '../js/crewV4.js';
import { compactCrewSeat, addCrew, addLookout } from '../js/crew.js';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('new / legacy-default crew start in underwear and no hat, with unchanged save/wire indices', () => {
  for (const saved of [{}, CREW_DEFAULT, crewFromWire(''), crewFromWire('00')]) {
    const g = crewGear(saved); assert.equal(g.hat, 'none'); assert.equal(g.outfit, 'shirtless'); assert.equal(g.pants, 'none'); assert.equal(g.boots, 'none');
  }
  assert.equal(CREW_DEFAULT.crewoutfit, 'tank'); // existing server-free ID is a compatibility alias, not a new grant
  assert.equal(crewToWire(CREW_DEFAULT), '');
  assert.equal(crewChoiceLabel('crewoutfit', 'tank'), 'None · Underwear');
  assert.equal(crewChoiceLabel('crewpants', 'none'), 'None · Underwear');
  assert.equal(crewGear({ crewoutfit: 'coat', crewpants: 'classic_pants' }).outfit, 'coat');
});
test('empty pants stays underwear even with hats, coats or carried weapons; no automatic pants grant', () => {
  const g = shoreCrewGear({ ...crewGear(), hat: 'tricorn' }); assert.ok(!g.pants || g.pants === 'none');
  const p = shoreCrewGear({ ...crewGear(), pants: 'classic_pants' }); assert.equal(p.pants, 'classic_pants');
  // Explicit crew uniforms override generic NPC outfit variants; no automatic item grant.
  assert.match(read('js/crewNativeV7.js'), /g=gear\|\|GENERIC_CREW_STYLES/);
});
test('both sexes use authentic modest V7 crew LODs; player body / traits stay unchanged', () => {
  assert.ok(Array.from({ length: 20 }, (_, v) => crewFemale(v)).includes(true));
  assert.ok(Array.from({ length: 20 }, (_, v) => crewFemale(v)).includes(false));
  for (const [sex, path] of Object.entries(CREW_BODY_GLB)) { assert.match(path, new RegExp('pirate_' + sex + '_v7_crew\\.glb$')); assert.ok(existsSync(new URL('../' + path, import.meta.url))); }
  const glb = read('js/pirateGLB.js'); assert.match(glb, /pirate_male_v7_hi\.glb/); assert.match(glb, /pirate_female_v7_hi\.glb/);
  assert.match(read('js/crewV4.js'), /v5_\(face\|tattoo\)/); // original eyes and tattoo decal preserved, no repainted features
});
test('indexed seats preserve every triangle and attribute; lookout can merge with an indexed ship crew', () => {
  const source = new THREE.PlaneGeometry(1, 1).toNonIndexed(); source.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(6), 1));
  const compact = compactCrewSeat(source), expanded = compact.toNonIndexed(); assert.equal(compact.attributes.position.count, 4); assert.equal(compact.index.count, 6);
  for (const k of Object.keys(source.attributes)) assert.deepEqual(expanded.attributes[k].array, source.attributes[k].array);
  assert.equal(compactCrewSeat(source), compact);
  const ship = new THREE.Group(); ship.add(addCrew(ship, { guns: [{ x: 1, y: 0, z: 0, sx: 1 }] }));
  addLookout(ship, ship, { at: { x: 0, y: 2, z: 0 } });
  const geo = ship.children[0].children[0].geometry; assert.ok(geo.index); assert.ok(geo.attributes.position.count > 0);
});
