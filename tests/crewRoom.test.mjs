import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ownedCrewChoices, crewChoiceLabel, DRESS_SLOTS } from '../js/crewWardrobe.js';
import { CREW_DEFAULT, CREW_SLOTS } from '../js/crewLoadout.js';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('wardrobe includes only owned compatible clothes plus the free uniform', () => {
  const state = { owned: { gear: ['hat:tricorn', 'crewhat:crown', 'outfit:coat', 'pants:leather_breeches', 'hat:not_a_real_item', 'skin:golden'] } };
  assert.deepEqual(ownedCrewChoices(state, 'crewhat'), ['bandana', 'tricorn', 'crown']);
  assert.deepEqual(ownedCrewChoices(state, 'crewoutfit'), ['tank', 'coat']);
  assert.deepEqual(ownedCrewChoices(state, 'crewpants'), ['none', 'leather_breeches']);
  assert.deepEqual(ownedCrewChoices(state, 'crewboots'), ['none']);
  assert.deepEqual(ownedCrewChoices(state, 'tattoo'), []);
  for (const s of DRESS_SLOTS) assert.deepEqual(ownedCrewChoices({}, s), [CREW_DEFAULT[s]]);
  assert.equal(crewChoiceLabel('crewhat', 'bandana'), 'No hat');
  assert.equal(crewChoiceLabel('crewoutfit', 'tank'), 'None · Underwear');
});
test('owner wardrobe honors existing all-owned flag; ordinary wardrobe never lists catalog-only items', () => {
  for (const s of DRESS_SLOTS) assert.deepEqual(ownedCrewChoices({ owner: true }, s), CREW_SLOTS[s]);
  const owned = ['boots:boots_gold']; const state = { owned: { gear: owned } };
  ownedCrewChoices(state, 'crewboots'); assert.deepEqual(owned, ['boots:boots_gold']);
  assert.equal(ownedCrewChoices({ owner: 'true' }, 'crewhat').length, 1);
});
test('hull display reuses deck geometry in one draw call, without allocating lights or render targets', async () => {
  const { createCrewRoomDisplay } = await import('../js/crew.js');
  const room = createCrewRoomDisplay([{ x: -2.8, y: .14, z: 1.35 }, { x: -1.35, y: .14, z: 1.35 }]);
  const meshes = []; room.traverse(o => { assert.ok(!o.isLight); if (o.isMesh) meshes.push(o); });
  assert.equal(meshes.length, 1); assert.ok(meshes[0].userData.crewMesh);
  assert.equal(room.children[0].userData.seats.length, 2);
  assert.ok(meshes[0].geometry.attributes.position.count > 0);
  meshes[0].geometry.dispose(); meshes[0].material.dispose();
});
test('same hull prompt path supports E, phone tap and controller; saved uniform updates hull and deck', () => {
  const hull = read('js/dock/shipHull.js'), dock = read('js/dock/index.js');
  assert.match(hull, /best\?\.tag\?\.startsWith\('crew_'\)/);
  assert.match(hull, /openCrewRoom\?\.\(Number\(tag\.slice\(5\)\)\)/);
  assert.match(hull, /addEventListener\('pfp-crew', dressHullCrew\)/);
  assert.match(hull, /ud\.crewRoom\.userData\.disposed = true/);
  assert.match(read('js/crewGear.js'), /body\.userData\?\.disposed/);
  assert.match(dock, /openCrewRoom: \(member\) => openCrewRoom\(member\)/);
  assert.match(read('js/gamepad.js'), /'#crew-room\.on'/);
  assert.match(read('js/keybinds.js'), /\$\('crew-room'\)/);
});
test('dressing is a cosmetic equip through the existing provider, never a purchase or inventory removal', () => {
  const panel = read('js/crewWardrobe.js');
  assert.match(panel, /provider\.equip\('gear', `\$\{s\}:\$\{id\}`\)/);
  assert.match(panel, /fresh\?\.source !== 'live'/);
  assert.doesNotMatch(panel, /provider\.(buy|purchase)|\.inv\.call|renderTarget|CanvasTexture|PointLight/);
  assert.match(read('js/islandShop.js'), /generation !== hullCrewGeneration/);
  assert.match(read('js/pvp.js'), /setCrewLoadout\(profile\.gear\)/);
});
