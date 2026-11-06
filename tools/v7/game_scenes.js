async (device) => {
 const CO=await import('/js/island/coast.js'),PM=await import('/js/onfoot/pirate.js'),GG=await import('/js/pirateGear.js'),PS=await import('/js/pirates.js');
 const I=ISLAND;window.V7GAME={device};
 const gear={hat:'tricorn',outfit:'coat',pants:'classic_pants',boots:'boots_classic',parrot:'parrot_red'};
 const pr=PM.loadPirate({look:{},low:device==='phone',gear,bodyFromGear:true});I.scene.add(pr.object);pr.object.name='v7_proof_pirate';
 const [x,z]=CO.t2w(-8,-3.5),y=I.foot.groundAt(x,z);pr.object.position.set(x,y,z);pr.object.rotation.y=CO.t2wYaw(0);
 await new Promise(resolve=>{const id=setInterval(()=>{let p;pr.object.traverse(o=>{if(o.userData.v4)p=o.userData.v4});if(p?.gearKey){clearInterval(id);V7GAME.p=p;resolve();}},50)});
 await GG.applyGear(pr.object,gear);V7GAME.pr=pr;
 const aim=(c,t,fov=35)=>{I.camera.fov=fov;I.camera.updateProjectionMatrix();I.camera.position.set(...c);I.controls.target.set(...t);I.controls.update();I.camera.lookAt(...t);};
 const pnt=(lx,lz,yy)=>{const [xx,zz]=CO.t2w(lx,lz);return[xx,yy,zz]};
 V7GAME.bodyView=()=>aim(pnt(-8,2.2,y+1.25),pnt(-8,-3.5,y+.88));V7GAME.bodyView();
 V7GAME.mode='idle';setInterval(()=>{pr.update(.033,V7GAME.mode==='walk'?1.6:0,V7GAME.mode);PS.tickPirates(.033)},33);
 const B=await import('/js/onfoot/battle.js'),W=await import('/js/onfoot/swords.js');await W.loadWeaponModels(device==='phone');
 const bt=B.createBattle({scene:I.scene,world:{ground:()=>0},layout:{interact:[],footToHarbor:(x,z)=>[x,z],harborToFoot:(x,z)=>[x,z]},walker:{w:{},active:false},fnet:{peers:new Map()},sfx:null,camera:I.camera,canvas:null,touch:false,myId:()=> 'offline-proof',low:device==='phone'});bt.root.visible=false;V7GAME.bt=bt;
 V7GAME.hold=(zone)=>{V7GAME.held?.sword?.removeFromParent();V7GAME.held?.musket?.removeFromParent();V7GAME.held=bt.preview(pr.object,zone,zone===1?'cutlass':'navy',zone===1?{kind:1,t:.28*.42,hit:true}:null);};
 V7GAME.color=async(s,h,e)=>{await GG.applyGear(pr.object,{...gear,skinColor:s,hairColor:h,eyeColor:e});};
 V7GAME.shopView=async(id)=>{pr.object.visible=false;let parent;I.scene.traverse(o=>{if(o.name==='plaza_'+id)parent=o});if(parent?.userData.mannequinsReady)await parent.userData.mannequinsReady;const xx=id==='shop_crew'?32:-49;aim(pnt(xx,-25.4,4.63),pnt(xx,-34.5,4.13),device==='phone'?65:46);return{found:!!parent,displays:parent?.children.filter(o=>o.name.startsWith('v7_shop')).map(o=>o.children[0].children.map(c=>c.name))};};
 V7GAME.helm=async()=>{pr.object.visible=false;const C=await import('/js/captainSlot.js');C.registerCaptainBuilder(PS.buildCaptainV4(device==='phone'));const ship=I.ships[0].mesh,fig=C.attachCaptain(ship,{look:{},gear:{hat:'tricorn',outfit:'coat',pants:'classic_pants',boots:'boots_classic'}});if(!fig)throw Error('No captain anchor');await new Promise(resolve=>{const id=setInterval(()=>{if(fig.userData.v4?.gearKey){clearInterval(id);resolve()}},50)});const THREE=await import('three');I.scene.updateMatrixWorld(true);const pos=fig.getWorldPosition(new THREE.Vector3()),q=fig.getWorldQuaternion(new THREE.Quaternion()),off=new THREE.Vector3(.7,1.6,3.6).applyQuaternion(q);aim(pos.clone().add(off).toArray(),pos.clone().add(new THREE.Vector3(0,.9,0)).toArray(),40);return{v7:fig.userData.v4.v7,bones:fig.userData.v4.atlasMeshes[0].skeleton.bones.length};};
 return {v7:V7GAME.p.v7,feet:[x,y,z],items:Object.keys(V7GAME.p.items)};
}
