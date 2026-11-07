import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/threeRegister.mjs';
globalThis.location={search:'?coast=1',href:'http://x/',hostname:'x'};globalThis.window=globalThis;globalThis.self=globalThis;
const el=()=>({getContext:()=>null,style:{},addEventListener(){},appendChild(){},setAttribute(){},classList:{add(){},remove(){}}});
globalThis.document={createElement:el,createElementNS:el,addEventListener(){},body:el(),getElementById:()=>null,querySelector:()=>null};globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const FM=await import('../js/island/foot.js'), CP=await import('../js/island/cyanPath.js');
const Rx=new Proxy({},{get:()=>[0,0,1,1]});for(const fn of ['buildStreet','buildInland','buildCoast'])FM[fn](Rx,false,[]);
let maxGrade=0;const hits=[];for(const P of CP.ROUTES)for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);let prev=null;for(let s=0;s<=L;s+=.5){const x=a[0]+(b[0]-a[0])*s/L,z=a[1]+(b[1]-a[1])*s/L,y=FM.H(x,z);if(prev&&!CP.onBridge(x,z))maxGrade=Math.max(maxGrade,Math.abs(y-prev)/.5);prev=y;if(FM.hitCollider(x,z,.6))hits.push({x,z});}}
test('all 44 flags form the main trail and ordered bridge branch',()=>{assert.equal(CP.MARKERS.length,44);assert.equal(CP.ROUTES[0].length,36);assert.equal(CP.ROUTES[1].length,7);assert.deepEqual(CP.ROUTES[1][0],CP.MARKERS[23]);for(const p of CP.MARKERS)assert.equal(CP.cyanDistance(p[0],p[1]),0);});
test('entire marked route has no built-in prop collisions at 0.5 m sampling',()=>assert.deepEqual(hits,[]));
test('graded terrain remains smoothly walkable below 0.6 rise/run',()=>assert.ok(maxGrade<.6,`max grade ${maxGrade}`));
test('bridge stairs and landing are preserved',()=>{assert.ok(CP.onBridge(15.53,-56.39));assert.ok(!CP.onBridge(-28.97,-34.23));});


test('pirate dressing merges to at most two draw calls and a small triangle budget',async()=>{const THREE=await import('three');const mat=new THREE.MeshBasicMaterial();const {near}=CP.default.build({MATS:{toon:mat},OUT:{plain:mat},H:FM.H,low:true});let tris=0;near.traverse(o=>{if(o.isMesh)tris+=o.geometry.attributes.position.count/3;});assert.ok(near.children.length<=2);assert.ok(tris<20000,`triangles: ${tris}`);});

test('hill extension joins flag 1 through new flags 43 and 44',()=>{assert.equal(CP.ROUTES[2].length,3);assert.deepEqual(CP.ROUTES[2],[CP.MARKERS[0],CP.MARKERS[42],CP.MARKERS[43]]);});
