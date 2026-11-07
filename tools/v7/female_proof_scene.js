// [Emerly V7 female] stage-1 proof: the real island.html (camera, lights, fog, tone mapping) + the real on-foot loader, base look only.
async (device) => {
 const CO=await import('/js/island/coast.js'),PM=await import('/js/onfoot/pirate.js'),GG=await import('/js/pirateGear.js'),PS=await import('/js/pirates.js');
 const THREE=await import('three');const I=ISLAND;window.V7F={device};
 const gear={body:1};
 const pr=PM.loadPirate({look:{},low:device==='phone',gear,bodyFromGear:true});I.scene.add(pr.object);
 const [x,z]=CO.t2w(-8,-3.5),y=I.foot.groundAt(x,z);pr.object.position.set(x,y,z);pr.object.rotation.y=CO.t2wYaw(0);
 await new Promise(resolve=>{const id=setInterval(()=>{let p;pr.object.traverse(o=>{if(o.userData.v4)p=o.userData.v4});if(p?.gearKey){clearInterval(id);V7F.p=p;resolve();}},50)});
 await GG.applyGear(pr.object,gear);V7F.pr=pr;
 const yaw0=pr.object.rotation.y;
 // camera orbit around her: a = 0 front, 90 side (her left), 180 back
 const H=1.397*(pr.object.scale.y||1);
 V7F.view=(a,dist,ty,fov=30)=>{const fwd=new THREE.Vector3(Math.sin(yaw0),0,Math.cos(yaw0));const r=a*Math.PI/180;const d=fwd.clone().applyAxisAngle(new THREE.Vector3(0,1,0),r);
  const t=[x,y+ty,z];I.camera.fov=fov;I.camera.updateProjectionMatrix();I.camera.position.set(x+d.x*dist,y+ty,z+d.z*dist);I.controls.target.set(...t);I.controls.update();I.camera.lookAt(...t);};
 V7F.mode='tpose';V7F.t=0;
 V7F.timer=setInterval(()=>{const p=V7F.p;if(V7F.mode==='tpose'){p.mixer.stopAllAction();p.action=null;p.clip=null;p.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose()});}else{pr.update(.033,V7F.mode==='walk'?1.6:0,V7F.mode);}PS.tickPirates(.033)},33);
 const info={};pr.object.traverse(o=>{if(o.isSkinnedMesh){info[o.name]={mat:o.material.type,map:!!o.material.map,cs:o.material.map?.colorSpace,nm:!!o.material.normalMap,img:o.material.map?.image?.width}}});
 info.url=V7F.p._url;info.v7=V7F.p.v7;info.v7On=V7F.p._v7Tint.v7On.value.toArray();info.scale=pr.object.scale.y;info.figScale=(()=>{let s=null;pr.object.traverse(o=>{if(o.userData.v4&&!s){const v=new THREE.Vector3();o.getWorldScale(v);s=v.y}});return s})();
 info.tone=I.renderer?.toneMapping;info.out=I.renderer?.outputColorSpace;
 return info;
}
