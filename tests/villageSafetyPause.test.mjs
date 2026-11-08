import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VILLAGE_ON, VILLAGE_RENTALS, VILLAGE_RENTABLE, villageClear, villageGround, villageEnabledFor } from '../js/island/village.js';
import { buildVillage, buildVillagePools } from '../js/island/villageBuild.js';
test('new village is paused in production even with a URL override; local QA only', () => {
  assert.equal(VILLAGE_ON,false);
  assert.equal(villageEnabledFor({location:{hostname:'game.pumpfunpirates.com',search:'?village=1'}}),false);
  assert.equal(villageEnabledFor({location:{hostname:'127.0.0.1',search:'?village=1'}}),true);
  assert.equal(villageEnabledFor({location:{hostname:'127.0.0.1',search:''}}),false);
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
