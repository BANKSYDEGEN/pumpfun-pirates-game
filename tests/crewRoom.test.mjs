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
test('hull display is one V7 pirate near stern window, using refitted wardrobe and explicit disposal', () => {
  const source = read('js/crew.js').split('export function createCrewRoomDisplay(spots) {')[1].split('// [v109b]')[0];
  assert.match(source, /const p = spots\[0\]/);
  assert.match(source, /pirateFigure\(\{ height: 1.75, low: true, bodyFromGear: true/);
  assert.match(source, /applyGear\(figure/);
  assert.match(source, /figure.userData.dispose\?\.\(\)/);
  assert.doesNotMatch(source, /PointLight|PMREM|CanvasTexture|crewGeo/);
  const hull = read('js/dock/shipHull.js');
  assert.match(hull, /HULL_CREW_SPOTS = Object.freeze\(\[\{ x: -2.8, y: 0.14, z: -4.15 \}\]\)/);
  assert.doesNotMatch(hull, /crew_room_bench/);
  assert.match(hull, /addParrotCage\(interior, QFLOOR\)/);
  assert.match(read('js/pirateGLB.js'), /pirate_male_v7_lo.glb/);
  assert.match(read('js/pirateItems.js'), /v7mFitData/);
  assert.match(read('js/pirateItems.js'), /v7fFitData/);
});
test('hull opens original CREW ROOM shop with owned-only cards and releases previews on exit', () => {
  const shop = read('js/islandShop.js');
  assert.match(shop, /openShop\(\{ vendor: 'crew', tab: 'wardrobe'/);
  assert.match(shop, /view.tab === 'wardrobe' \? itemsFor\(\).filter\(x => statusOf\(x\).owned\)/);
  assert.match(shop, /if \(x.it\?\.crew\) setCrewLoadout\(state.equipped\?\.gear \|\| \{\}\)/);
  assert.match(shop, /if \(view.vendor === 'crew'\) releaseGearPreviews\(\)/);
  assert.match(read('js/gearThumbs.js'), /for \(const live of \[...LIVE\]\) live.stop\(\)/);
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

test('owned wrestling singlet is a full-body crew choice, preserved on save and wire', () => {
 const state = { owned: { gear: ['outfit:singlet'] } };
 assert.ok(ownedCrewChoices(state, 'crewoutfit').includes('singlet'));
 assert.match(read('js/v7mFitData.js'), /"cloth_singlet"/);
 assert.match(read('js/v7fFitData.js'), /"cloth_singlet"/);
 assert.match(read('js/crewLoadout.js'), /pants: c.crewoutfit === 'singlet' \? 'none' : c.crewpants/);
 assert.match(read('supabase/functions/pvp/lib.ts'), /crewoutfit: \["tank", "tshirt", "coat", "shirt", "suit", "singlet"\]/);
});
