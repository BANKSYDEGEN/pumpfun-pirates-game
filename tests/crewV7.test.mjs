import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CREW_ITEM_LODS } from '../js/crewItemLods.js';
import { pillyEnabledFor } from '../js/features.js';
import { villageEnabledFor } from '../js/island/village.js';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const glb = p => { const b=readFileSync(new URL('../'+p,import.meta.url)); return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()); };
test('male and female ship LODs are authentic V7 with all source bones and clips, under the V6 crew triangle budget', () => {
 for (const sex of ['male','female']) {
  const old=glb(`assets/pirates/pirate_${sex}_v6_crew.glb`), source=glb(`assets/pirates/pirate_${sex}_v7_lo.glb`), crew=glb(`assets/pirates/pirate_${sex}_v7_crew.glb`);
  const tris=g=>g.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+g.accessors[p.indices].count/3,0);
  assert.ok(tris(crew)<=tris(old)); assert.ok(tris(crew)<7000);
  assert.ok(crew.nodes.some(n=>n.extras?.v7===1));
  assert.deepEqual(crew.animations.map(a=>a.name),source.animations.map(a=>a.name));
  const bones=g=>g.skins.flatMap(s=>s.joints.map(i=>g.nodes[i].name)).sort();
  assert.deepEqual(bones(crew),bones(source));
  for(const clip of ['idle','walk','run','cannon','steer']) assert.ok(crew.animations.some(a=>a.name===clip));
 }
});
test('all ship crew duties share V7 distant sources and retain one merged far draw per ship',()=>{
 const c=read('js/crewV4.js'), render=read('js/crew.js');
 assert.match(c, /pirate_male_v7_crew\.glb/); assert.match(c,/pirate_female_v7_crew\.glb/);
 assert.match(c,/sharedBodyClips\(gf, gm\)/);
 assert.doesNotMatch(c,/prepV5Body\(g.scene/);
 assert.match(c,/bodyURL: CREW_BODY_GLB/); assert.match(c,/maleClipURL: CREW_BODY_GLB.male/);
 assert.match(c,/!p\.v7 && g\.outfit/); // no V5 torso squashing of the locked V7 source
 assert.match(c,/bodyOnly: true/); // actual V7 apparel hide indices baked, no underwear showing through shirts
 assert.match(c,/_gearQueue = pr\.then/); // shared hidden skeletons never raced by concurrent outfits
 assert.match(render,/const geo = mergeGeometries\(parts, false\)/);
 assert.match(render,/_cap\?\.dispose\(\); _cap = null/);
 assert.match(c,/V4\.generic\[i\]/); assert.match(c,/V4.ready = true/); assert.match(render,/lod.userData.v4 = !!V4\?\.ready/); assert.doesNotMatch(c,/hairStyle:|eyeShape:|tattoo:/);
});
test('Pilly and village remain disabled',()=>{
 assert.equal(pillyEnabledFor({}),false);
 assert.equal(villageEnabledFor({location:{hostname:'game.pumpfunpirates.com',search:'?village=1'}}),false);
});

test('crew garments keep all source bones and fit metadata under an 800-triangle budget',()=>{for(const [source,path] of Object.entries(CREW_ITEM_LODS)){const original=glb(source),g=glb(path);const n=g.meshes.flatMap(m=>m.primitives).reduce((a,p)=>a+g.accessors[p.indices].count/3,0);assert.ok(n<=800,path);assert.equal(g.animations?.length||0,0);assert.deepEqual(g.skins.map(s=>s.joints.map(i=>g.nodes[i].name)),original.skins.map(s=>s.joints.map(i=>original.nodes[i].name)));}assert.match(read('js/pirateItems.js'),/p.forCrew && p.v7 \? CREW_ITEM_LODS\[sourceURL\]/);});
