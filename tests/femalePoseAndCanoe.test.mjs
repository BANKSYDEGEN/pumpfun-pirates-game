import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {sharedBodyClips} from '../js/onfoot/retarget.js';
import {swimPose,BONES} from '../js/onfoot/swimPose.js';
const q = new T.Quaternion();
function fixture(female=false) {
 const scene=new T.Group();
 for(const n of BONES){const b=new T.Bone();b.name=n.replace('.','');scene.add(b);if(n.startsWith('forearm'))b.position.set(n.endsWith('L')?.13:-.13,female?-.039:-.02,0);}
 return {scene,animations:[new T.AnimationClip('idle',1,[...['upperarmL','upperarmR','spine','head'].map(n=>new T.QuaternionKeyframeTrack(n+'.quaternion',[0,1],[...q.toArray(),...q.toArray()])),new T.VectorKeyframeTrack('root.position',[0,1],[0,.5,0,0,.5,0]),new T.QuaternionKeyframeTrack('braid.quaternion',[0,1],[...q.toArray(),...q.toArray()])])]};
}
test('female shares male rotation keys without mutating either asset, positions or hair',()=>{
 const f=fixture(true),m=fixture(),before=JSON.stringify([f.animations[0].toJSON(),m.animations[0].toJSON()]);
 const [clip]=sharedBodyClips(f,m);
 assert.equal(JSON.stringify([f.animations[0].toJSON(),m.animations[0].toJSON()]),before);
 for(const name of ['spine.quaternion','head.quaternion'])assert.deepEqual(clip.tracks.find(t=>t.name===name).values,m.animations[0].tracks.find(t=>t.name===name).values);
 for(const name of ['root.position','braid.quaternion'])assert.deepEqual(clip.tracks.find(t=>t.name===name).values,f.animations[0].tracks.find(t=>t.name===name).values);
 const l=new T.Quaternion().fromArray(clip.tracks[0].values),r=new T.Quaternion().fromArray(clip.tracks[1].values);assert.ok(l.z>0&&r.z<0,'mirrored outward shoulder clearance');
});
for(const female of [false,true])test(`${female?'female':'male'} canoe seats and dismount releases pose`,()=>{
 const p={scene:fixture(female).scene,addPost(k,fn){this.post=fn;}};
 for(let i=0;i<30;i++){assert.ok(swimPose(p,'canoe',1/60,16));p.post.call(p);}
 assert.equal(p._sw.w,1);assert.ok(Math.abs(p._swRig.B['thigh.L'].rotation.x)>1,'legs bent forward not gait');
 for(let i=0;i<30;i++)swimPose(p,'walk',1/60,2.4);
 assert.equal(p._sw.w,0);
});

test('captain and both NPC crew use the same seated path on separate benches',async()=>{
 const {seatCanoeRider,CANOE_CREW_BENCHES}=await import('../js/onfoot/canoeSeat.js');
 const boat=new T.Group();boat.position.set(8,1.2,-4);boat.rotation.set(.07,.5,-.04,'YXZ');
 const calls=[],actors=[.72,.81,.77].map((h,i)=>{const object=new T.Group(),hip=new T.Bone();hip.name='root';hip.position.y=h;object.add(hip);return {object,update(dt,speed,state){calls.push([i,speed,state]);}};});
 [.55,...CANOE_CREW_BENCHES].forEach((z,i)=>seatCanoeRider(actors[i],boat,z,1/60));
 assert.deepEqual(calls,[[0,0,'canoe'],[1,0,'canoe'],[2,0,'canoe']]);
 for(let i=0;i<actors.length;i++){
  const obj=actors[i].object;assert.equal(obj.userData.canoeSeat,true);
  const hip=boat.worldToLocal(obj.children[0].getWorldPosition(new T.Vector3()));
  assert.ok(Math.abs(hip.y-.425)<1e-6);assert.ok(Math.abs(hip.z-[.55,...CANOE_CREW_BENCHES][i])<1e-6);
 }
});
