import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {instantiateFlightParrot,perchParrot,PERCH_PITCH,PARROT_AI,animateParrot,colorParrot,flightPose,syncFlyingParrot,disposeFlyingParrot,updateFlyingParrot,setParrotWorld} from '../js/parrotFlight.js';
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const bytes=fs.readFileSync(new URL('../assets/pirates/items/v7/parrot_flight.glb',import.meta.url));const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(()=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())})).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
test('compressed macaw: 2400 triangles, one draw call, seven articulated bones, one WebP atlas under 400KB',()=>{const b=instantiateFlightParrot(gltf);let calls=0,tris=0;b.traverse(o=>{if(o.isMesh){calls++;tris+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert.ok(o.material.map);}});assert.equal(calls,1);assert.equal(tris,2400);assert.ok(bytes.length<400000);assert.equal(Object.keys(b.userData.flightBones).length,7);animateParrot(b,0);const a=b.userData.flightBones.wing_L.rotation.z;animateParrot(b,.075);assert.notEqual(b.userData.flightBones.wing_L.rotation.z,a);
const mesh=b.getObjectByProperty('isSkinnedMesh',true), box=new THREE.Box3(), v=new THREE.Vector3();
for(const t of [0,.075,.15,.225]) {animateParrot(b,t);b.updateMatrixWorld(true);mesh.skeleton.update();box.makeEmpty();for(let i=0;i<mesh.geometry.attributes.position.count;i++)box.expandByPoint(mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld));const size=box.getSize(new THREE.Vector3());assert.ok(Math.max(size.x,size.y,size.z)<1.5,'flight rig remains bounded');}
b.userData.dispose();});
test('unlocked palette uniforms and material are instance-owned; all seven palettes preserve instance isolation',()=>{
 const a=instantiateFlightParrot(gltf),b=instantiateFlightParrot(gltf);const m=a.getObjectByProperty('isMesh',true),n=b.getObjectByProperty('isMesh',true);
 assert.notEqual(m.material,n.material);assert.equal(n.userData.flightTint.parrotTintOn.value,1);
 for(const c of ['red','blue','cockatoo','black','gold','diamond']) {colorParrot(a,'parrot_'+c);assert.equal(m.userData.flightTint.parrotTintOn.value,1);assert.equal(n.userData.flightTint.parrotTintOn.value,1);}
 const sh={vertexShader:'#include <begin_vertex>',uniforms:{},fragmentShader:'#include <map_fragment>'};m.material.onBeforeCompile(sh);assert.match(sh.fragmentShader,/texture2D\(parrotMask, vMapUv\)/);assert.ok(sh.uniforms.parrotBlue);colorParrot(a,'parrot_green');assert.equal(m.userData.flightTint.parrotTintOn.value,1);a.userData.dispose();b.userData.dispose();
});
test('independent companion: stays close, never on the pirate, leash + snap, offscreen hides but keeps flying',async()=>{
 const p={root:new THREE.Group()};p.root.add(new THREE.Mesh(new THREE.BoxGeometry(.5,1.75,.3),new THREE.MeshBasicMaterial()));
 await syncFlyingParrot(p,'parrot_green',async id=>instantiateFlightParrot(gltf,id));assert.ok(p._flight);setParrotWorld({ground:()=>0});
 const scene=new THREE.Scene();scene.add(p.root);const camera=new THREE.PerspectiveCamera(60,1,.01,500);camera.position.set(0,30,40);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 let maxD=0,minClear=1e9;for(let i=0;i<1200;i++){updateFlyingParrot(p,1/30,camera);const w=p._flight.wpos;const d=Math.hypot(w.x,w.z);maxD=Math.max(maxD,d);if(d<PARROT_AI.clear)minClear=Math.min(minClear,w.y);assert.ok(w.y>=1.09);}
 assert.ok(maxD>4,'roams away from the pirate, not a tight orbit');assert.ok(maxD<24,'stays leashed');assert.ok(minClear>=2.8||minClear===1e9,'never sits on the pirate');
 p.root.position.set(200,0,0);p.root.updateMatrixWorld(true);updateFlyingParrot(p,1/30,camera);assert.ok(p._flight.wpos.distanceTo(new THREE.Vector3(200,0,0))<10,'snaps back after fast travel');
 camera.lookAt(0,0,-500);camera.updateMatrixWorld(true);const before=p._flight.wpos.clone();updateFlyingParrot(p,1/30,camera);assert.equal(p._flight.bird.visible,false);assert.ok(!p._flight.wpos.equals(before),'AI keeps running offscreen');
 disposeFlyingParrot(p);assert.equal(p._flight,null);setParrotWorld(null);});

test('cage rest pose stays upright, folded and bounded through lively idle actions',()=>{
 const bird=instantiateFlightParrot(gltf);bird.scale.setScalar(.76);
 const mesh=bird.getObjectByProperty('isSkinnedMesh',true), v=new THREE.Vector3();
 assert.ok(Math.abs(PERCH_PITCH)<.2,'already upright GLB must not be tipped backwards');
 const poses=new Set();
 for(let t=0;t<90;t+=.25){
  perchParrot(bird,t,1.73);bird.updateMatrixWorld(true);mesh.skeleton.update();
  poses.add(bird.userData.flightBones.wing_L.quaternion.toArray().map(x=>x.toFixed(2)).join(','));
  assert.ok(Math.abs(bird.userData.perchShuffle)<=.066);
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);
   assert.ok(Math.hypot(v.x-.02,v.z+bird.userData.perchShuffle)<.45,'feathers clear cage bars');
   assert.ok(v.y+1.763>1.17 && v.y+1.763<2.25,'tail clears tray, head clears dome');
  }
 }
 assert.ok(poses.size>20,'varied wing flicks, stretch and ruffle, not a frozen bird');bird.userData.dispose();
});

// Meshy exports UV-split vertices. Decimating those islands separately used to
// leave 3,810 open edges: visible triangular holes across the wings and back.
test('macaw surface stays joined across UV seams after mobile decimation',()=>{
 const bird=instantiateFlightParrot(gltf), mesh=bird.getObjectByProperty('isSkinnedMesh',true);
 const g=mesh.geometry, p=g.attributes.position, ids=new Map(), welded=[];
 for(let i=0;i<p.count;i++){
  const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(5)).join(',');
  if(!ids.has(key))ids.set(key,ids.size);welded[i]=ids.get(key);
 }
 const edges=new Map(), index=g.index;
 for(let i=0;i<index.count;i+=3){
  const tri=[0,1,2].map(k=>welded[index.getX(i+k)]);
  for(let k=0;k<3;k++){
   const a=tri[k],b=tri[(k+1)%3];if(a===b)continue;
   const key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)||0)+1);
  }
 }
 assert.ok([...edges.values()].filter(n=>n===1).length<64,'wings and torso must not be a collection of disconnected triangles');
 assert.equal(mesh.material.side,THREE.DoubleSide);assert.equal(mesh.material.transparent,false);assert.equal(mesh.material.alphaTest,0);
 bird.userData.dispose();
});
