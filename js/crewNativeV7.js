// Near deck crew use the EXACT player V7 GLBs, native materials/face rig and full skeletal clips.
// Skeleton palettes are instanced per wardrobe/sex: shared full geometry, <= one draw per native mesh.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PirateGLB, PIRATE_GLB } from './pirateGLB.js';
import { applyGear, normalizeGear, SKIN_SWATCHES, HAIR_SWATCHES, EYE_SWATCHES } from './pirateGear.js';
import { crewFemale, crewAppearance, GENERIC_CREW_STYLES } from './crewV4.js';
const templates = new Map(), states = new Set(), scenes = new WeakSet();
const rows = new THREE.InstancedBufferAttribute(Float32Array.from({length:256},(_,i)=>i),1);
const cameraP=new THREE.Vector3(), worldP=new THREE.Vector3(), pos=new THREE.Vector3(), scale=new THREE.Vector3(), quat=new THREE.Quaternion(), Y=new THREE.Vector3(0,1,0), mat=new THREE.Matrix4(), normalise=new THREE.Matrix4();
const candidates=[],frustum=new THREE.Frustum(),viewMatrix=new THREE.Matrix4(),sphere=new THREE.Sphere(new THREE.Vector3(),35);
const hash = i => ((Math.sin(i*127.1+311.7)*43758.5453)%1+1)%1;
const fract=x=>x-Math.floor(x), smooth=(a,b,v)=>{const t=THREE.MathUtils.clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
// Stable free colour choices only. Hair/tattoo/eye SHAPES remain the stock V7 geometry/paint.
export {crewAppearance};
const tint=new THREE.Color();
function writeAppearance(data,offset,seat){const look=crewAppearance(seat.v);for(const [i,list,key]of [[0,SKIN_SWATCHES,'skinColor'],[1,HAIR_SWATCHES,'hairColor'],[2,EYE_SWATCHES,'eyeColor']]){tint.set(list[look[key]-1][1]);data.set([tint.r,tint.g,tint.b,1],offset+i*4);}}
async function template(female,low,gear,colors){
 const nativeGear=normalizeGear({...gear,skinColor:0,hairColor:0,eyeColor:0,body:female?1:0});const key=JSON.stringify([female,low,nativeGear,colors]);if(templates.has(key))return templates.get(key);
 const progress={phase:'body'}; const promise=(async()=>{const p=await PirateGLB.create({female,lod:low?'lo':'hi'}); // canonical player URLs, no crew derivatives
  if(!p.v7)throw new Error('Native V7 asset unavailable: refusing a legacy body as V7');p.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(p.root),k=1.75/(box.max.y-box.min.y);progress.phase='wardrobe';await applyGear(p,nativeGear,colors);
  progress.phase='bounds';p.root.updateMatrixWorld(true);
  const meshes=[];p.root.traverse(o=>{if(o.isMesh){const path=[];for(let n=o;n!==p.root;n=n.parent)path.unshift(n.parent.children.indexOf(n));const g=new THREE.InstancedBufferGeometry();for(const [n,a]of Object.entries(o.geometry.attributes))g.setAttribute(n,a);g.setIndex(o.geometry.index);for(const group of o.geometry.groups)g.addGroup(group.start,group.count,group.materialIndex);g.setDrawRange(o.geometry.drawRange.start,o.geometry.drawRange.count);g.setAttribute('crewBoneRow',rows);meshes.push({source:o,path,g,bind:o.bindMatrix?.clone()||new THREE.Matrix4(),inverse:o.bindMatrixInverse?.clone()||new THREE.Matrix4(),local:o.matrixWorld.clone()});}});
  progress.phase='done';return {p,meshes,k,y0:box.min.y,source:PIRATE_GLB[female?'female':'male'][low?'lo':'hi']};})().catch(e=>{templates.delete(key);throw e;});promise.progress=progress;templates.set(key,promise);return promise;
}
function nativeMaterial(source,palette,width,height,bind,inverse,skinned=true){
 if(Array.isArray(source))return source.map(m=>nativeMaterial(m,palette,width,height,bind,inverse,skinned));
 const m=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey.bind(source);if(skinned)m.defines={...m.defines,USE_SKINNING:''};
 m.onBeforeCompile=(s,r)=>{compile.call(m,s,r);Object.assign(s.uniforms,{bindMatrix:{value:bind},bindMatrixInverse:{value:inverse},crewBones:{value:palette},crewBoneSize:{value:new THREE.Vector2(width,height)}});
  if(source.name==='v7body'){
   const declarations='varying vec3 v7Skin; varying vec3 v7Hair; varying vec3 v7Iris; varying vec3 v7On;\n';
   for(const name of ['v7Skin','v7Hair','v7Iris','v7On'])s.fragmentShader=s.fragmentShader.replace('uniform vec3 '+name+';','varying vec3 '+name+';');
   s.vertexShader=declarations+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float lookY=(crewBoneRow+.5)/crewBoneSize.y;
    vec4 skinLook=texture2D(crewBones,vec2((crewBoneSize.x-2.5)/crewBoneSize.x,lookY));
    vec4 hairLook=texture2D(crewBones,vec2((crewBoneSize.x-1.5)/crewBoneSize.x,lookY));
    vec4 irisLook=texture2D(crewBones,vec2((crewBoneSize.x-.5)/crewBoneSize.x,lookY));
    v7Skin=skinLook.rgb;v7Hair=hairLook.rgb;v7Iris=irisLook.rgb;v7On=vec3(skinLook.a,hairLook.a,irisLook.a);`);
  }
  s.vertexShader=s.vertexShader.replace(skinned?'#include <skinning_pars_vertex>':'/* no crew skin */',`uniform mat4 bindMatrix,bindMatrixInverse; uniform sampler2D crewBones; uniform vec2 crewBoneSize; attribute float crewBoneRow;
  mat4 getBoneMatrix(const in float i){float x=i*4.0;float y=(crewBoneRow+.5)/crewBoneSize.y;return mat4(texture2D(crewBones,vec2((x+.5)/crewBoneSize.x,y)),texture2D(crewBones,vec2((x+1.5)/crewBoneSize.x,y)),texture2D(crewBones,vec2((x+2.5)/crewBoneSize.x,y)),texture2D(crewBones,vec2((x+3.5)/crewBoneSize.x,y)));}`)
   .replace('vFwd7 = normalize(normalMatrix * fw7);','vFwd7 = normalize(normalMatrix * mat3(instanceMatrix) * fw7);');};
 m.customProgramCacheKey=()=>key()+'-native-v7-crew-palettes-look2-'+skinned;return m;
}
function clear(state){state.mesh.visible=true;if(state.props){state.props.geometry.dispose();state.props=null;}for(const b of state.batches){b.palette.dispose();for(const o of b.draws){for(const m of [].concat(o.material))m.dispose();o.dispose();}for(const a of b.actors){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.root);a.skeleton.dispose();}}state.group.clear();state.batches=[];state.ready=false;}
function cloneRig(root){const saved=[];root.traverse(o=>{saved.push([o,o.userData]);o.userData={};});try{return SkeletonUtils.clone(root);}finally{for(const [o,data]of saved)o.userData=data;}}
async function populate(state,gear=null,colors=null){const ticket=++state.ticket;state.error=null;const sets=new Map();
 for(const seat of state.seats){const female=crewFemale(seat.v),g=gear||GENERIC_CREW_STYLES[0],key=JSON.stringify([female,g]);if(!sets.has(key))sets.set(key,{female,g,seats:[]});sets.get(key).seats.push(seat);}
 const entries=await Promise.all([...sets.values()].map(async s=>({...s,T:await template(s.female,state.low,s.g,colors)})));if(state.disposed||ticket!==state.ticket)return;clear(state);
 for(const entry of entries){const T=entry.T,actors=entry.seats.map(seat=>{const root=cloneRig(T.p.root),parts=T.meshes.map(part=>part.path.reduce((o,i)=>o.children[i],root)),body=parts.find(o=>o.isSkinnedMesh),mixer=new THREE.AnimationMixer(root);return {seat,root,parts,mixer,skeleton:body.skeleton,motion:{},clip:'',action:null};});
  const width=actors[0].skeleton.bones.length*4+3,height=actors.length,data=new Float32Array(width*height*4),palette=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);palette.needsUpdate=true;for(let i=0;i<actors.length;i++)writeAppearance(data,i*width*4+width*4-12,actors[i].seat);
  const draws=T.meshes.map(part=>{const mesh=new THREE.InstancedMesh(part.g,nativeMaterial(part.source.material,palette,width,height,part.bind,part.inverse,part.source.isSkinnedMesh),height);mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=false;mesh.userData.sharedGeo=true;mesh.userData.nativeV7Crew={source:T.source,triangles:(part.g.index?.count||part.g.attributes.position.count)/3,instances:height};mesh.onBeforeRender=(r,s)=>{state.scene=s;register(s);};state.group.add(mesh);return mesh;});
  state.batches.push({T,actors,palette,data,draws,stride:width*4});}
 state.appliedGear=gear;state.appliedColors=colors;state.appliedTicket=ticket;state.ready=true;
}
function move(actor,u,t){const c=actor.seat,[role,sx,ph,span]=c.info;let x=c.o[0],y=c.o[1],z=c.o[2],yaw=0,clip='idle',at=t+ph*3;
 if(role>2.5)clip='steer';else if(role<.5){yaw=sx*Math.PI/2;const age=t-(sx>0?u.uFireP.value:u.uFireS.value)-span*u.uGap.value;clip='cannon';at=age>=0&&age<2.6?age:0;}
 else if(role>1.5){const tt=t+ph*10,v=tt%10,cyc=Math.floor(tt/10),th=ph*Math.PI*2+(cyc+smooth(0,4,v))*1.75,face=smooth(3.9,4.6,v)*(1-smooth(9.2,9.9,v));x+=Math.cos(th)*sx;z+=Math.sin(th)*sx;yaw=THREE.MathUtils.lerp(-th,Math.PI/2-th,face);clip=v<4?'walk':'idle';}
 else {const s=fract(t*.9/Math.max(1,span*2)+ph);z+=span*(.5-Math.abs(s*2-1));yaw=s<.5?0:Math.PI;if(span>0)clip='walk';const A=u.uDk.value,B=u.uDk2.value;if(B.z>.5&&span>=0){const f=z<A.y?.25+(z-A.x)/A.z:.72+(z-A.y)/A.w,q=(f-.47)*2;y=B.x*(.5+.5*q*q)-B.y;}}
 const p=actor.motion;p.x=x;p.y=y;p.z=z;p.yaw=yaw;p.clip=clip;p.at=at;p.hidden=c.cap&&u.uCapOff.value>.5;p.size=u.uS.value/1.35*(role>1.5&&role<2.5?span:1);return p;
}
function update(state,t,dt,frame){const u=state.mesh.material.uniforms;for(const b of state.batches){if(b.T.faceFrame!==frame){b.T.faceFrame=frame;b.T.p._faceTick(dt);}for(let i=0;i<b.actors.length;i++){const a=b.actors[i],p=move(a,u,t),clip=b.T.p.clips[p.clip]||b.T.p.clips.idle;
 if(a.clip!==p.clip){a.mixer.stopAllAction();a.action=a.mixer.clipAction(clip);a.action.play();a.clip=p.clip;}a.action.time=p.clip==='cannon'?THREE.MathUtils.clamp(p.at,0,Math.max(0,clip.duration-.001)):THREE.MathUtils.euclideanModulo(p.at,Math.max(.001,clip.duration));a.mixer.update(0);a.root.updateMatrixWorld(true);a.skeleton.update();b.data.set(a.skeleton.boneMatrices,i*b.stride);
 pos.set(p.x,p.y,p.z);quat.setFromAxisAngle(Y,p.yaw);const k=p.hidden?1e-7:b.T.k*p.size;scale.setScalar(k);mat.compose(pos,quat,scale);normalise.makeTranslation(0,-b.T.y0,0);mat.multiply(normalise);
 for(let j=0;j<b.draws.length;j++){const M=worldMatrix.copy(mat).multiply(b.T.meshes[j].source.isSkinnedMesh?b.T.meshes[j].local:a.parts[j].matrixWorld);b.draws[j].setMatrixAt(i,M);}}
 b.palette.needsUpdate=true;for(const m of b.draws)m.instanceMatrix.needsUpdate=true;}}
const worldMatrix=new THREE.Matrix4();
function showProps(state){const source=state.mesh.geometry;if(state.propsSource!==source||!state.props){state.props?.geometry.dispose();state.props?.removeFromParent();const g=new THREE.BufferGeometry();for(const [n,a]of Object.entries(source.attributes))g.setAttribute(n,a);const parts=source.attributes.aPart,indices=source.index.array,out=[];for(let i=0;i<indices.length;i+=3)if(parts.getX(indices[i])>=4.5&&parts.getX(indices[i+1])>=4.5&&parts.getX(indices[i+2])>=4.5)out.push(indices[i],indices[i+1],indices[i+2]);g.setIndex(new THREE.BufferAttribute(new indices.constructor(out),1));state.props=new THREE.Mesh(g,state.mesh.material);state.props.name='crew-wheel-and-telescope';state.props.onBeforeRender=(...args)=>state.mesh.onBeforeRender.apply(state.mesh,args);state.props.frustumCulled=false;state.propsSource=source;state.group.add(state.props);}state.mesh.visible=false;}
function register(scene){if(scenes.has(scene))return;scenes.add(scene);const previous=scene.onBeforeRender;let last=0;
 scene.onBeforeRender=function(renderer,sc,camera,...args){previous?.call(this,renderer,sc,camera,...args);camera.getWorldPosition(cameraP);frustum.setFromProjectionMatrix(viewMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));candidates.length=0;
 for(const s of states){if(s.disposed||s.scene!==scene)continue;let root=s.lod,seen=true;for(;root.parent;root=root.parent)if(!root.visible)seen=false;if(root!==scene||!seen)continue;s.lod.update(camera);s.group.getWorldPosition(worldP);s.distance=worldP.distanceToSquared(cameraP);sphere.center.copy(worldP);if(s.ready&&s.distance<(s.low?24:36)**2&&frustum.intersectsSphere(sphere))candidates.push(s);s.group.visible=false;s.mesh.material.uniforms.uNativeCrew.value=0;}
 candidates.sort((a,b)=>a.distance-b.distance);const now=performance.now()/1000,dt=Math.min(.05,Math.max(0,now-last));last=now;
 for(let i=0;i<Math.min(candidates.length,candidates[0]?.low?1:2);i++){const s=candidates[i];s.group.visible=true;s.mesh.material.uniforms.uNativeCrew.value=1;showProps(s);update(s,s.mesh.material.uniforms.uT.value,dt,renderer.info.render.frame);s.group.updateMatrixWorld(true);}};
}
export function attachNativeCrew(lod,mesh,seats,low){if(typeof document==='undefined')return null;const group=new THREE.Group();group.name='canonical-v7-deck-crew';group.visible=false;lod.add(group);const state={group,mesh,seats,low,batches:[],ticket:0,ready:false,disposed:false,scene:null};state.lod=lod;lod.autoUpdate=false;states.add(state);group.userData.nativeV7State=state;group.userData.sharedGeo=true;
 group.userData.dispose=()=>{state.disposed=true;state.ticket++;clear(state);states.delete(state);};const old=mesh.onBeforeRender;mesh.onBeforeRender=function(r,s,c,...args){old?.call(this,r,s,c,...args);state.scene=s;register(s);};
 state.setGear=(gear,colors)=>{state.gear=gear;state.colors=colors;return populate(state,gear,colors).catch(e=>{state.error=String(e.stack||e);throw e;});};state.setGear().catch(e=>console.warn('[crew] canonical V7 preload failed',e));return state;}

export const nativeCrewDiagnostics=()=>({templates:[...templates].map(([key,p])=>({key,phase:p.progress.phase})),states:[...states].map(s=>({error:s.error,ready:s.ready,ticket:s.ticket,disposed:s.disposed,batches:s.batches.length}))});
