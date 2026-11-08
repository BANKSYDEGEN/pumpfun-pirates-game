import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// [village-live] t2410u: the village is ON by default; ?village=0 forces it off. This file runs as a ?village=0 visit, so the
// paused / old-map contracts below are exactly what a rollback (VILLAGE_DEFAULT = false) or ?village=0 gives.
import './helpers/threeRegister.mjs';
globalThis.location = { hostname: 'game.pumpfunpirates.com', search: '?village=0' };
const { VILLAGE_ON, VILLAGE_DEFAULT, VILLAGE_RENTALS, VILLAGE_RENTABLE, villageClear, villageGround, villageEnabledFor } = await import('../js/island/village.js');
const { buildVillage, buildVillagePools } = await import('../js/island/villageBuild.js');
test('village default + overrides: ?village=0 always off; default off = localhost ?village=1 QA only', () => {
  assert.equal(VILLAGE_ON,false);
  const prod = (q, def) => villageEnabledFor({location:{hostname:'game.pumpfunpirates.com',search:q}}, def), local = (q, def) => villageEnabledFor({location:{hostname:'127.0.0.1',search:q}}, def);
  assert.equal(prod('', true), true); assert.equal(prod('?village=0', true), false); assert.equal(local('?village=0', true), false);
  assert.equal(prod('?village=1', false), false); assert.equal(local('?village=1', false), true); assert.equal(local('', false), false);
  assert.equal(villageEnabledFor({location:{hostname:'game.pumpfunpirates.com',search:''}}), VILLAGE_DEFAULT);
});
test('paused village creates no geometry, invisible colliders, decks, camera rooms, pools or rental prompts', () => {
  const trap = new Proxy({}, {get(){throw Error('disabled village built something');}});
  assert.equal(buildVillage(trap, {camRoom:trap,Y0:0,C:trap,sign:trap}),0);
  assert.equal(buildVillagePools(),null);
  assert.deepEqual(VILLAGE_RENTALS,[]);assert.deepEqual(VILLAGE_RENTABLE,[]);
  assert.equal(villageClear(-80,-80),false);assert.equal(villageGround(-80,-80,17),17);
});
test('saved Harbor sessions return aboard a berth rather than a removed rental floor', () => {
  const s=readFileSync(new URL('../js/dock/index.js',import.meta.url),'utf8');
  assert.match(s,/applyResume/);assert.match(s,/if \(onFoot\) goAboard\(true\)/);
});

test('old L4 pet store, floor, doorway and props are restored with the village off', async () => {
  const { PET_DZ, PET_FLOOR, PET_LOT, PET_STORE, PET_SHOP, PET_PROPS, PET_WALLS } = await import('../js/pumpfun/site.js');
  assert.equal(PET_DZ,0);assert.equal(PET_FLOOR,PET_LOT.doorY);
  assert.equal(PET_STORE.z0,-119.15);assert.equal(PET_STORE.z1,-110.4);
  assert.equal(PET_STORE.door.lz,PET_LOT.door.lz);assert.equal(PET_SHOP.lz,PET_LOT.door.lz);
  assert.equal(PET_PROPS[0][2],-114.06);assert.equal(PET_WALLS.length,5);
  const foot=readFileSync(new URL('../js/island/foot.js',import.meta.url),'utf8');
  assert.match(foot,/PV.VILLAGE_ON && PV.villageGround/);
});
