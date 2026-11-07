// [Emerly V7 female] pfp-v358: the raw Meshy female, rigged only (BANKSY t1900u / t1903u / t1908u).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
function glb(path) { const b=readFileSync(path); assert.equal(b.readUInt32LE(0),0x46546c67); return JSON.parse(b.subarray(20,20+b.readUInt32LE(12))); }
const names=j=>new Set(j.skins.flatMap(s=>s.joints.map(i=>j.nodes[i].name)));
const expected=names(glb('assets/pirates/pirate_female_v6_hi.glb'));
for (const lod of ['hi','lo']) test(`V7 female ${lod}: game bone names, all clips, untinted Meshy paint by default, own tint mask`,()=>{
 const j=glb(`assets/pirates/pirate_female_v7_${lod}.glb`);
 assert.deepEqual(names(j),expected);
 for (const name of ['idle','walk','run','cannon','steer']) assert.ok(j.animations.some(a=>a.name===name),name);
 const mesh=j.meshes[0];assert.ok(mesh.primitives[0].attributes._TINT!==undefined);
 const pos=j.accessors[mesh.primitives[0].attributes.POSITION];assert.ok(pos.min[1]>=-.005);assert.ok(pos.max[1]<1.45);
 const body=j.nodes.find(n=>n.extras?.v7===1);assert.ok(body);assert.match(body.extras.v7tint,/v7_female_tint/);
 const mat=j.materials[0];assert.ok(mat.pbrMetallicRoughness.baseColorTexture,'Meshy albedo');
 assert.deepEqual(mat.pbrMetallicRoughness.baseColorFactor||[1,1,1,1],[1,1,1,1],'no tint multiply on the albedo');
 if (lod==='hi') assert.ok(mat.normalTexture,'Meshy normal map kept on hi');
});
test('V7 female: tint only when a colour is picked (v7On starts off), per-body mask, v6 fallback',()=>{
 const s=readFileSync('js/pirateGLB.js','utf8');
 assert.match(s,/female: \{ hi: 'assets\/pirates\/pirate_female_v7_hi\.glb'/);assert.match(s,/cfg\?\.mask/);assert.match(s,/v7On: \{ value: new THREE\.Vector3\(\) \}/);
 assert.ok(readFileSync('assets/pirates/v7_female_tint.webp').length>100);assert.ok(readFileSync('assets/pirates/v7_female_tint_lo.webp').length>100);
});
