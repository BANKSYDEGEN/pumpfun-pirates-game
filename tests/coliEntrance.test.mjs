// [Timothy v294] BANKSY: coliseum entrance off the fish-market plaza, south (+lx) end off the ground edge, musket + sword walled + spectatable.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const run=qs=>JSON.parse(execFileSync('node',['--import','./reg.mjs','coli_check.mjs'],{cwd:new URL('../tools/roundabout_blender/node/',import.meta.url),env:{...process.env,QS:qs},encoding:'utf8'}).trim().split('\n').pop());
const ON=run('?coast=1');
const src=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('fish-market approach: plaza level -> arena level, walk deck on profile, no colliders on the centreline or shoulders, no terrain through the paving',()=>{
  const f=ON.fish; assert.equal(f.on,true);
  assert.ok(Math.abs(f.startY-2.73)<0.02,`start ${f.startY}`); assert.ok(Math.abs(f.endY-9.2)<0.02,`end ${f.endY}`);
  assert.ok(f.maxErr<0.03); assert.ok(f.maxStep<0.15); assert.ok(f.poke<=0.03,`poke ${f.poke}`);
  assert.deepEqual(f.hits,[]); assert.deepEqual(f.edgeHits,[]);
  assert.ok(f.length>30 && 6.47/(f.length-10)<0.3,'gentle ramp');
});
test('fish gate opens the plaza-end wall, east of the FISH MARKET, on the shell',()=>{
  const g=ON.fish.gate; assert.ok(g.lz>-70 && g.lz<-55); assert.ok(g.w>=7);
});
test('south (+lx) end pulled in: shell edge at lx 88, battery gate on it, wall still solid',()=>{
  assert.equal(ON.ell.cx+ON.ell.rx,88); assert.ok(Math.abs(ON.battery.lx-87.93)<0.05,`battery ${ON.battery.lx}`);
  assert.equal(ON.wallSolid,true); assert.deepEqual(ON.batteryHits,[]); assert.equal(ON.exteriorSummary.unexplained,0);
});
test('musket range + sword pit: stone walls on the coliseum, fence / ropes when &coliseum=0; benches for spectators',()=>{
  const b=src('js/island/battleAreas.js'); assert.match(b,/const wall = \(a, b, y, h = 1\.25\) => \{ if \(!COLISEUM_ON\) return fence/); assert.match(b,/stone ring wall under the ropes/); assert.match(b,/spectator benches/);
  assert.equal(ON.inRange,true);
});
test('&coliseum=0 has no fish approach deck or paint',()=>{ const OFF=run('?coast=1&coliseum=0'); assert.equal(OFF.on,false); assert.equal(OFF.fish.length,undefined); });
