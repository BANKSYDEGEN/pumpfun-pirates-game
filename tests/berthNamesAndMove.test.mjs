import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { berthOccupantName, cleanBerthName, createBerthSigns } from '../js/dock/berthSigns.js';
import { BTN, MAP, resolve, glyphFor } from '../js/gamepad.js';
const dock = readFileSync(new URL('../js/dock/index.js', import.meta.url),'utf8');
test('local berth sign matches stable id even when the berth object was copied', () => {
  const b={id:'B7'}, d={berth:{id:'B7'},mode:'docked',takenBy:()=>null};
  assert.equal(berthOccupantName(b,d,'Banksy',new Map()),'BANKSY');
  assert.equal(berthOccupantName(b,{...d,mode:'out'},'Banksy',new Map()),'BANKSY');
  assert.equal(berthOccupantName(b,{...d,mode:'sea',berth:null},'Banksy',new Map()),'');
});
test('peer name, unnamed occupied fallback, open and long names', () => {
  const b={id:'B2'}, d={berth:null,mode:'sea',takenBy:()=> 'peer'};
  assert.equal(berthOccupantName(b,d,'Banksy',new Map([['peer','Salty Sam']])),'SALTY SAM');
  assert.equal(berthOccupantName(b,d,'Banksy',new Map()),'PIRATE');
  assert.equal(berthOccupantName(b,{...d,takenBy:()=>null},'Banksy',new Map()),'');
  assert.equal(cleanBerthName('Captain Extremely Long Name').length,16);
  assert.equal(cleanBerthName('0x'+'a'.repeat(40)),'PIRATE');
  assert.equal(cleanBerthName('https://example.test/?ref=example'),'PIRATE');
});
test('occupancy refresh precedes optional world and player update calls', () => {
  assert.ok(dock.indexOf('signs.tick(dt') < dock.indexOf('walker.update(dt)'));
  assert.match(dock,/berthOccupantRawName\(b, docking, ctx.pvp\(\)\?\.name, peerNames\)/);
});
test('open sign move uses Cross prompt instead of jump; keyboard remains E and consumes event', () => {
  assert.equal(resolve(MAP.foot[BTN.A],{prompt:[true,false]}),'promptA');
  assert.equal(glyphFor('ps','A'),'✕');
  assert.match(dock,/best = \{ label: `MOVE SHIP HERE · \$\{berthLabel\(mb\)\}`, pad: 'A', fn:/);
  assert.match(dock,/setActs\(best \? \{ \.\.\.best, key: 'E', primary: true \}/);
  assert.match(dock,/if \(e.code === 'KeyE'\) \{ if \(!e.repeat && actA && actA.key === 'E'\) \{ press\(actA\); used = true;/);
  assert.match(dock,/if \(used\) \{ e.stopImmediatePropagation\(\); e.preventDefault\(\); \}/);
  assert.match(dock,/if \(!docking.canMoveTo\(b\)\) continue;/);
});

test('rendered sign updates captain name and returns to OPEN on release', async () => {
  const THREE = await import('three');
  const previous=globalThis.document, labels=[];
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},strokeText(){},fillText(t){labels.push(t)},measureText:t=>({width:t.length*30})})})};
  try {
    const scene=new THREE.Scene(), b={id:'B7',x:0,z:0,ashore:{x:3,z:0,y:1},signBollards:[[0,19],[0,51]]};
    const signs=createBerthSigns({scene,berths:[b],low:true});
    let name='BANKSY'; signs.tick(.5,()=>name);
    assert.deepEqual(labels,['B4','BANKSY']);
    labels.length=0; name=''; signs.tick(.5,()=>name);
    assert.deepEqual(labels,['B4','OPEN']);
    assert.equal(scene.children.length,1,'reuse one sign instead of adding a stale second label');
    signs.clear(); assert.equal(scene.children.length,0);
  } finally { if(previous===undefined) delete globalThis.document; else globalThis.document=previous; }
});

test('unchanged signs retain canvas, material and texture version; cached post reuses coordinates', async () => {
 const THREE=await import('three'); const old=globalThis.document;let canvases=0,paint=0;
 globalThis.document={createElement:()=>{canvases++;return {width:0,height:0,getContext:()=>({fillRect(){paint++},strokeRect(){},strokeText(){},fillText(){},measureText:()=>({width:20})})}}};
 try {const scene=new THREE.Scene(), b={id:'B7',x:0,z:0,ashore:{x:3,z:0,y:1},signBollards:[[0,19],[0,51]]}, signs=createBerthSigns({scene,berths:[b],low:false});
 const post=signs.post(b);assert.equal(post,signs.post({...b}));let lookups=0;const who=()=>{lookups++;return 'Banksy'};signs.tick(.5,who);
 const material=scene.children[0].children[1].material,texture=material.map,version=texture.version;
 for(let i=0;i<1000;i++) signs.tick(.001,who);
 assert.equal(canvases,1);assert.equal(paint,1);assert.equal(texture.version,version);assert.equal(scene.children[0].children[1].material,material);assert.ok(lookups<=3);
 let disposed=0;texture.addEventListener('dispose',()=>disposed++);signs.clear();assert.equal(disposed,1);
 }finally{globalThis.document=old;}
});
