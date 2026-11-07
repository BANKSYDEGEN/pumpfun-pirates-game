import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { locomotionClip, playLocomotion } from '../js/onfoot/locomotion.js';
const qs = angles => angles.flatMap(a => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), a).toArray());
function fixture(name = 'walk') {
  const t = [0,.25,.5,.75,1];
  return new THREE.AnimationClip(name,1,[
    new THREE.QuaternionKeyframeTrack('root.quaternion',[0,1],qs([0,0])),
    ...['spine','upperarmL','upperarmR','thighL','thighR'].map((n,i) => new THREE.QuaternionKeyframeTrack(n+'.quaternion',t,qs([0,.45*(i%2?1:-1),0,-.45*(i%2?1:-1),0]))),
    new THREE.VectorKeyframeTrack('root.position',[0,1],[0,.5,0,0,.5,0]),
    new THREE.QuaternionKeyframeTrack('braid.quaternion',[0,1],qs([.1,.1]))
  ]);
}
test('Three constant-root optimization reproduces the old post-mixer accumulation',()=>{
  const bone = new THREE.Bone();bone.name='root';const mixer=new THREE.AnimationMixer(bone);
  const clip = new THREE.AnimationClip('walk',1,[new THREE.QuaternionKeyframeTrack('.quaternion',[0,1],qs([0,0]))]);
  mixer.clipAction(clip).play();const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.025);
  for(let i=0;i<120;i++){mixer.update(1/60);bone.quaternion.premultiply(q);}
  assert.ok(new THREE.Vector3(0,1,0).applyQuaternion(bone.quaternion).y<-.9,'root is upside down despite mixer.update every frame');
});
for(const female of [false,true])for(const name of ['walk','run'])test(`${female?'female':'male'} ${name}: absolute bounded cyclic poses, no source mutation or drift`,()=>{
  const source=fixture(name),before=JSON.stringify(source.toJSON()),clip=locomotionClip(source,female);
  assert.notEqual(source,clip);assert.equal(JSON.stringify(source.toJSON()),before);assert.equal(locomotionClip(source,female),clip);
  for(const n of ['root.position','braid.quaternion'])assert.deepEqual(clip.tracks.find(t=>t.name===n).values,source.tracks.find(t=>t.name===n).values);
  const root=new THREE.Bone();root.name='root';for(const n of ['spine','upperarmL','upperarmR','thighL','thighR','braid']){const b=new THREE.Bone();b.name=n;root.add(b);}
  const mixer=new THREE.AnimationMixer(root);mixer.clipAction(clip).play();
  for(let i=0;i<36000;i++){
    mixer.update(i%7?1/60:.1);assert.ok(root.quaternion.angleTo(new THREE.Quaternion())<.045);assert.ok(Math.abs(root.quaternion.length()-1)<1e-6);
  }
  for(const tr of clip.tracks){if(!tr.name.endsWith('.quaternion'))continue;const q=new THREE.Quaternion().fromArray(tr.values,0),last=new THREE.Quaternion().fromArray(tr.values,tr.values.length-4);assert.ok(q.angleTo(last)<.001);}
});
test('phase preserved only between moving clips, with normal speed and idle fade',()=>{
  const p={clip:'walk',action:{time:.4,getClip:()=>({duration:1})},play(n){this.clip=n;this.action={time:0,getClip:()=>({duration:.8}),setEffectiveTimeScale(s){this.speed=s}};}};
  playLocomotion(p,'run',6);assert.ok(Math.abs(p.action.time-.32)<1e-10);assert.equal(p.action.speed,1);
  playLocomotion(p,'idle',0);assert.equal(p.action.time,0);assert.equal(p.action.speed,1);
});
