import test from 'node:test';import assert from 'node:assert/strict';import {HQ,HQ_WALK_DECKS as decks} from '../js/pumpfun/site.js';import {readFileSync}from'node:fs';
function floorAt(x,z){let y=-Infinity;for(const d of decks){let a=d.ry||0,dx=x-d.lx,dz=z-d.lz,u=Math.cos(a)*dx-Math.sin(a)*dz,v=Math.sin(a)*dx+Math.cos(a)*dz;if(Math.abs(u)<=d.hw&&Math.abs(v)<=d.hl)y=Math.max(y,HQ.floor+d.top);}return y;}
test('boots stand on visible plank, runner, rug and dais tops; both thresholds covered',()=>{
 assert.equal(floorAt(-23,-40),HQ.floor+.034);assert.equal(floorAt(-18.5,-40),HQ.floor+.06);assert.equal(floorAt(-11,-44),HQ.floor+.055);assert.equal(floorAt(-18.5,-62),HQ.floor+HQ.dais.rise+.04);
 for(const d of decks.filter(d=>d.id.startsWith('hq_rug_')))assert.equal(floorAt(d.lx,d.lz),HQ.floor+.045);
 assert.equal(floorAt(HQ.door.lx,HQ.door.lz),HQ.floor+.034);assert.equal(floorAt(HQ.hillDoor.lx,HQ.hillDoor.lz),HQ.floor+.034);
});
test('surface decks drive collision only, retaining the approved green/gold floor and rug art',()=>{const s=readFileSync(new URL('../js/island/plazaTown.js',import.meta.url),'utf8');assert.ok(s.includes('y:HQ.floor+D.top'));assert.ok(s.includes('yaw:yaw0+(D.ry||0)'));const r=readFileSync(new URL('../js/pumpfun/render.js',import.meta.url),'utf8');assert.ok(r.includes("g.fillStyle='#0e2b21'"));assert.ok(r.includes('hallFloor'));assert.ok(r.includes('HQ.floor+.034'));});
