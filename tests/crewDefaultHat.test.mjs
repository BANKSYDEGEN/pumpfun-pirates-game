import test from 'node:test';
import assert from 'node:assert/strict';
import {crewGear,crewFromWire,crewToWire} from '../js/crewLoadout.js';
test('default and legacy uniform crew are bareheaded without renumbering saved hats',()=>{
  assert.equal(crewGear({}).hat,'none');
  assert.equal(crewGear(crewFromWire('')).hat,'none');
  assert.equal(crewGear({crewhat:'bandana'}).hat,'none');
  for(const hat of ['tricorn','bicorne','crown','crown_imperial','helmet_hq']) {
    assert.equal(crewGear(crewFromWire(crewToWire({crewhat:hat}))).hat,hat);
  }
});
