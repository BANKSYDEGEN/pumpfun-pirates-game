import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),n=read('js/crewNativeV7.js'),c=read('js/crew.js');
test('near sailors use canonical player V7 hi/lo assets and reject silent V6 fallback',()=>{
 assert.match(n,/PirateGLB\.create\(\{female,lod:low\?'lo':'hi'\}\)/);
 assert.match(n,/if\(!p\.v7\)throw/);assert.doesNotMatch(n,/bodyURL:|\.toNonIndexed\(|SimplifyModifier|computeVertexNormals/);
 assert.match(n,/source:PIRATE_GLB\[female\?'female':'male'\]/);
});
test('native source geometry, UVs, skin weights, materials and face shader are preserved',()=>{
 assert.match(n,/g\.setAttribute\(n,a\)/);assert.match(n,/g\.setIndex\(o\.geometry\.index\)/);
 assert.match(n,/source\.clone\(\)/);assert.match(n,/compile\.call\(m,s,r\)/);assert.match(n,/mat3\(instanceMatrix\) \* fw7/);
 assert.match(n,/skinColor:0,hairColor:0,eyeColor:0/);assert.doesNotMatch(n,/v7Skin\.value\.set|v7Hair\.value\.set|v7Iris\.value\.set/);
});
test('native skeleton palettes instance original meshes and native idle/walk/cannon/steer clips',()=>{
 assert.match(n,/new THREE\.InstancedMesh/);assert.match(n,/new THREE\.DataTexture/);assert.match(n,/SkeletonUtils\.clone\(root\)/);
 assert.match(n,/a\.skeleton\.boneMatrices/);for(const clip of ['idle','walk','steer','cannon'])assert.ok(n.includes("'"+clip+"'"));
 assert.match(n,/p\.clip==='cannon'\?THREE\.MathUtils\.clamp/);
});
test('near crew are budgeted, frustum checked and respect original far LOD',()=>{
 assert.match(n,/s\.low\?24:36/);assert.match(n,/candidates\[0\]\?\.low\?1:2/);assert.match(n,/frustum\.intersectsSphere/);
 assert.match(n,/lod\.autoUpdate=false/);assert.match(n,/s\.lod\.update\(camera\)/);assert.match(n,/root!==scene\|\|!seen/);
 assert.match(n,/state\.mesh\.visible=false/);assert.match(n,/crew-wheel-and-telescope/);
});
test('wardrobe changes and ship removal release per-ship palettes and cloned materials',()=>{
 assert.match(n,/b\.palette\.dispose/);assert.match(n,/m\.dispose\(\)/);assert.match(n,/states\.delete\(state\)/);
 assert.match(n,/state\.disposed\|\|ticket!==state\.ticket/);assert.match(c,/nativeV7\?\.setGear\(chunks\?\.gear/);
 assert.match(n,/finally\{for\(const \[o,data\]of saved\)o\.userData=data/);
});
test('all common ship crew and standalone lookouts attach native V7',()=>{
 assert.ok(c.split('attachNativeCrew(').length-1>=2);assert.match(read('sw.js'),/js\/crewNativeV7\.js/);
});
