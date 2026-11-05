import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const run=qs=>JSON.parse(execFileSync('node',['--import','./reg.mjs','coli_check.mjs'],{cwd:new URL('../tools/roundabout_blender/node/',import.meta.url),env:{...process.env,QS:qs},encoding:'utf8'}).trim().split('\n').pop());
const ON=run('?coast=1'),OFF=run('?coast=1&coliseum=0');
test('coli musket pad and sword pit share the arena walk level; range holster bounds remain active',()=>{
 assert.equal(ON.rangeY,9.2);assert.equal(ON.rangeY,ON.footY);assert.equal(ON.inRange,true);
});
test('main portal fills R4 alley and its street-facing edge is flush with the shop doors',()=>{
 assert.equal(ON.main.lx,14);assert.equal(ON.main.w,9.624);assert.equal(ON.main.lz,-114.761);assert.equal(ON.main.d,29);
 assert.deepEqual(ON.gateHits,[]);assert.equal(ON.wellHit,false);
});
test('back stairs reach fountain plaza with coherent walk heights and no centerline or shoulder obstructions',()=>{
 assert.ok(ON.stairLength>35);assert.ok(ON.maxErr<.03);assert.ok(ON.maxStep<.15);assert.deepEqual(ON.hits,[]);assert.deepEqual(ON.edgeHits,[]);
});
test('coliseum kill switch restores old range height, old bounds and square well collider',()=>{
 assert.equal(OFF.on,false);assert.equal(OFF.rangeY,13.6);assert.equal(OFF.inRange,false);assert.equal(OFF.wellHit,true);
});
test('arena grit and worn flags are look layers, not colored blank pads or new floor colliders',()=>{
 const src=readFileSync(new URL('../js/island/coliseum.js',import.meta.url),'utf8');
 assert.match(src,/SA = 8/);assert.match(src,/Worn flag patches/);assert.doesNotMatch(src,/0xd4b85a|0x8a6aad/);
});

test('back stair ends on the fountain plaza, not the upper castle approach',()=>{
 assert.deepEqual(ON.join,{lx:12,lz:-206,y:20.1});
});
test('fish market, marketplace and adjacent crew interior terrain stays below the original slab',()=>{
 for(const r of ON.interiors)assert.ok(r.max<r.floor-.03,`${r.id} terrain ${r.max} vs floor ${r.floor}`);
});
test('full exterior sweep has no unexplained blocks; main and battery gates are clear; masonry stays solid',()=>{
 assert.equal(ON.exteriorSummary.sampleCount,720);assert.equal(ON.exteriorSummary.unexplained,0);
 assert.deepEqual(ON.batteryHits,[]);assert.equal(ON.wallSolid,true);
});
