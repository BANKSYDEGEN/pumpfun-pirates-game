// Run with the game's Three.js import map (Node loader or installed three@0.165.0).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let THREE, GLTFLoader, addParrotCage;
try { THREE = await import('three'); ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')); ({ addParrotCage } = await import('../js/dock/parrotCage.js')); } catch {}
test('cage uses shared V7 loader, owns cloned geometry, stays inside bars, has no lights and cleans listeners', { skip: !addParrotCage && 'Needs game Three.js import map' }, async () => {
 const listeners = new Map(), previousWindow = globalThis.window, previousDocument = globalThis.document, original = GLTFLoader.prototype.loadAsync;
 globalThis.window = { addEventListener: (k,f) => listeners.set(k,f), removeEventListener: (k,f) => { if (listeners.get(k)===f) listeners.delete(k); } };
 globalThis.document = { baseURI: 'https://example.test/' };
 const source = new THREE.Group(), sourceMesh = new THREE.Mesh(new THREE.BoxGeometry(.4, .2, .3), new THREE.MeshBasicMaterial()); sourceMesh.position.y=-.023; const colors=new Float32Array(sourceMesh.geometry.attributes.position.count*3); for(let i=0;i<colors.length;i+=3)colors.set([.1,.6,.2],i);sourceMesh.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));source.add(sourceMesh);
 let loaded;
 GLTFLoader.prototype.loadAsync = function(url) { assert.match(url, /items\/v7\/parrot_flight\.glb$/); loaded=Promise.resolve({scene:source}); return loaded; };
 try {
  const room = new THREE.Group(); room.userData={spots:{},colliders:[]};
  const cage=addParrotCage(room); await loaded; await new Promise(resolve=>setImmediate(resolve));
  const bird=cage.children.find(o=>o.isGroup); assert.ok(bird,'V7 parrot clone is attached'); assert.notEqual(bird.children[0].geometry,sourceMesh.geometry); assert.notEqual(bird.children[0].material,sourceMesh.material);
  room.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(bird), size=box.getSize(new THREE.Vector3());
  assert.ok(Math.max(size.x,size.y,size.z)<=.59); assert.ok(box.min.y>=1.41 && box.max.y<=2.08,'bird inside cage height including floor');
  let lights=0; cage.traverse(o=>{ if(o.isLight) lights++; }); assert.equal(lights,0);
  assert.equal(room.userData.spots.parrot_cage.x,-4.96);
  assert.equal(listeners.size,1);
  listeners.get('pfp-parrot')({detail:{color:'parrot_red'}});
  room.userData.parrotCageDispose(); assert.equal(listeners.size,0);
 } finally { GLTFLoader.prototype.loadAsync=original; globalThis.window=previousWindow; globalThis.document=previousDocument; }
});
