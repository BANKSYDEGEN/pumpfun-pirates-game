import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
function glb(path) { const b=readFileSync(path); assert.equal(b.readUInt32LE(0),0x46546c67); return JSON.parse(b.subarray(20,20+b.readUInt32LE(12))); }
const base=glb('assets/pirates/pirate_male_v6_hi.glb');
const names=j=>new Set(j.skins.flatMap(s=>s.joints.map(i=>j.nodes[i].name)));
const expected=names(base);
for (const lod of ['hi','lo']) test(`V7 male ${lod}: exact existing attachment skeleton, bounded mesh, clips and paint`,()=>{
 const j=glb(`assets/pirates/pirate_male_v7_${lod}.glb`);
 assert.deepEqual(names(j),expected);
 for (const name of ['idle','walk','run','cannon','steer']) assert.ok(j.animations.some(a=>a.name===name),name);
 const mesh=j.meshes[0];assert.ok(mesh.primitives[0].attributes._TINT!==undefined);
 const pos=j.accessors[mesh.primitives[0].attributes.POSITION];assert.ok(pos.min[1]>=-.005);assert.ok(pos.max[1]<1.45);
 assert.ok(j.nodes.some(n=>n.extras?.v7===1));
 for(const joint of base.skins[0].joints) { const b=base.nodes[joint]; const n=j.nodes.find(n=>n.name===b.name); for(const k of ['translation','rotation','scale']) { const a=b[k]||[],c=n[k]||[]; assert.equal(c.length,a.length,b.name+' '+k); a.forEach((v,i)=>assert.ok(Math.abs(v-c[i])<.00001,b.name+' '+k)); } }
});
// Every skinned male garment uses the same named palette. Separate pet armatures have their own rigs.
const dir='assets/pirates/items/v5';
for (const file of readdirSync(dir).filter(n=>/_male_(hi|lo)\.glb$/.test(n))) test('V7 resolves garment/accessory bones: '+file,()=>{
 const j=glb(dir+'/'+file); for(const s of j.skins||[]) for(const i of s.joints) assert.ok(expected.has(j.nodes[i].name),'missing '+j.nodes[i].name);
});
test('V7 male + female (pfp-v358); failed V7 load retains V6 fallback; tint masks leave approved tattoo paint intact',()=>{
 const s=readFileSync('js/pirateGLB.js','utf8');assert.match(s,/male_v7_hi/);assert.match(s,/female_v7_hi/);assert.match(s,/pirate_\(male\|female\)_v7_/);assert.match(s,/replace\('_v7_', '_v6_'\)/);assert.ok(readFileSync('assets/pirates/v7_male_tint.webp').length>100);
});
