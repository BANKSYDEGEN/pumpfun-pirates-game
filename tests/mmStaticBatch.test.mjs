import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/threeRegister.mjs';   // [village-opt] resolve the browser importmap's 'three' in Node (was: ERR_MODULE_NOT_FOUND without node_modules)
const THREE = await import('three');
const {batchShopFront} = await import('../js/island/moneyMakers/staticBatch.js');
test('static merge preserves triangles, exact material and transformed bounds',()=>{
 const scene=new THREE.Group(),root=new THREE.Group();scene.add(root);root.position.set(120,10,-80);root.rotation.y=.7;
 const mat=new THREE.MeshLambertMaterial({color:0xabcd12});let tris=0;
 for(let i=0;i<40;i++){const g=new THREE.Group();g.position.set(i%5,i%3,-i/10);g.rotation.z=.02*i;root.add(g);const m=new THREE.Mesh(new THREE.BoxGeometry(1,2,3),mat);g.add(m);tris+=m.geometry.index.count/3;}
 scene.updateMatrixWorld(true);const before=new THREE.Box3().setFromObject(root,true);batchShopFront(root);scene.updateMatrixWorld(true);
 const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o)});assert.equal(meshes.length,1);assert.equal(meshes[0].material,mat);assert.equal((meshes[0].geometry.index?.count||meshes[0].geometry.attributes.position.count)/3,tris);
 assert.ok(meshes[0].geometry.index,'keep indexed vertices rather than tripling shared vertex data');
 const after=new THREE.Box3().setFromObject(root,true);assert.ok(before.min.distanceTo(after.min)<1e-4);assert.ok(before.max.distanceTo(after.max)<1e-4);
 batchShopFront(root);assert.equal(meshes[0].parent,root);
});
test('dynamic gong, changing posters, transparency and existing instances are untouched',()=>{
 const root=new THREE.Group(),mat=new THREE.MeshBasicMaterial();const gong=new THREE.Mesh(new THREE.BoxGeometry(),mat),poster=gong.clone(),glass=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({transparent:true,opacity:.5})),im=new THREE.InstancedMesh(new THREE.BoxGeometry(),mat,2);
 root.userData.gong=gong;poster.userData.part='bounty_poster';root.add(gong,poster,glass,im);for(let i=0;i<3;i++)root.add(new THREE.Mesh(new THREE.BoxGeometry(),mat));batchShopFront(root);
 for(const o of [gong,poster,glass,im])assert.equal(o.parent,root);assert.equal(root.children.filter(o=>o.name==='mm_static_batch').length,1);
 gong.rotation.z=.4;poster.material.map=new THREE.Texture();assert.equal(gong.rotation.z,.4);
});

test('hidden groups, LOD levels and referenced visibility/animation trees never escape their parent',()=>{const root=new THREE.Group(),mat=new THREE.MeshLambertMaterial();const hidden=new THREE.Group(),anim=new THREE.Group(),lod=new THREE.LOD();for(const g of [hidden,anim]){for(let i=0;i<3;i++)g.add(new THREE.Mesh(new THREE.BoxGeometry(),mat));root.add(g);}hidden.visible=false;root.userData.crab=anim;const level=new THREE.Group();level.add(new THREE.Mesh(new THREE.BoxGeometry(),mat));lod.addLevel(level,0);root.add(lod);for(let i=0;i<3;i++)root.add(new THREE.Mesh(new THREE.BoxGeometry(),mat));batchShopFront(root);assert.equal(hidden.children.length,3);assert.equal(anim.children.length,3);assert.equal(level.children.length,1);assert.equal(root.children.filter(o=>o.name==='mm_static_batch').length,1);});
