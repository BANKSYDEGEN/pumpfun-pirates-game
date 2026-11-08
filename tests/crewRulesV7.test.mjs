import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {crewAppearance,crewGearOf,GENERIC_CREW_STYLES} from '../js/crewV4.js';
import {SKIN_SWATCHES,HAIR_SWATCHES,EYE_SWATCHES} from '../js/pirateGear.js';
import {crewGear,CREW_DEFAULT,crewToWire,crewFromWire,crewColorToWire,crewColorFromWire} from '../js/crewLoadout.js';
import {addCrew,crewGearTag} from '../js/crew.js';
import {syncCrewGear,crewGearKey} from '../js/crewGear.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('random deck pirates mix original V7 sexes and permitted free colors only, deterministically',()=>{
 const looks=Array.from({length:40},(_,v)=>crewAppearance(v));assert.ok(looks.some(x=>x.female));assert.ok(looks.some(x=>!x.female));
 for(const [v,l]of looks.entries()){assert.deepEqual(l,crewAppearance(v));for(const [k,a]of [['skinColor',SKIN_SWATCHES],['hairColor',HAIR_SWATCHES],['eyeColor',EYE_SWATCHES]])assert.ok(l[k]>=1&&l[k]<=a.length);assert.deepEqual(Object.keys(l),['female','skinColor','hairColor','eyeColor']);}
 for(const k of ['skinColor','hairColor','eyeColor'])assert.ok(new Set(looks.map(l=>l[k])).size>=4);
});
test('AI uses one sensible uniform, explicit player underwear never falls back to that AI outfit',()=>{
 assert.equal(GENERIC_CREW_STYLES.length,1);assert.equal(GENERIC_CREW_STYLES[0].outfit,'shirt');assert.notEqual(GENERIC_CREW_STYLES[0].pants,'none');
 const body=new THREE.Group();body.add(addCrew(body,{guns:[{x:1,y:0,z:0,sx:1}]}));const gear=crewGear(CREW_DEFAULT);syncCrewGear(body,gear);assert.equal(crewGearTag(body),'@crew-empty');assert.equal(gear.outfit,'shirtless');assert.equal(gear.pants,'none');
 assert.match(read('js/crewV4.js'),/chunks\?\.uniformEmpty.*bare:true/);
});
test('crew uniform and all supported dyes round-trip existing cr/cc without player gear contamination',()=>{
 const l={crewoutfit:'coat',crewhat:'tricorn',crewpants:'leather_breeches',crewboots:'boots_classic',crewcape:'cape_captain',creweyes:'eyepatch',crewhatColor:4,crewcapeColor:3,crewpantsColor:2,crewbootsColor:5};
 const local=crewGear(l),remote=crewGear({...crewFromWire(crewToWire(l)),crewhatColor:crewColorFromWire(crewColorToWire(l))});assert.deepEqual(remote,local);
 const passed=crewGearOf(local);for(const k of ['hat','outfit','pants','boots','eyes','cape','hatColor','capeColor','pantsColor','bootsColor'])assert.equal(passed[k],local[k]);
 assert.notEqual(crewGearKey(local),crewGearKey({...local,pantsColor:1}));
});
test('local and remote captains use owner gear including default, never random crew traits',()=>{
 const p=read('js/pirates.js'),v=read('js/pvp.js');assert.match(p,/captain\?\.local \? getLocalGear\(\)/);assert.match(p,/bodyFromGear: !!\(captain\?\.local \|\| captain\?\.gear\)/);
 assert.match(v,/const gg = \{ \.\.\.gearFromWire\(gw\), eyeColor: ec \}/);assert.match(v,/p\.captain = \{ v: 1, remote: true, gear: gg/);assert.match(v,/m\.gr = gw; m\.ec = lg\.eyeColor/);
 assert.doesNotMatch(p,/crewAppearance/);assert.match(read('js/captainSlot.js'),/U\.uCapOff\.value = 1/);
});
test('per-instance colors ride three palette texels, not extra bodies, materials or draws; locks and caps stay intact',()=>{
 const n=read('js/crewNativeV7.js');assert.match(n,/bones\.length\*4\+3/);assert.match(n,/i\*b\.stride/);assert.match(n,/v7Skin=skinLook.rgb/);assert.match(n,/g=gear\|\|GENERIC_CREW_STYLES\[0\]/);
 assert.match(n,/s\.low\?24:36/);assert.match(n,/candidates\[0\]\?\.low\?1:2/);assert.doesNotMatch(n,/hairStyle:|tattoo:|eyeShape:/);
});
