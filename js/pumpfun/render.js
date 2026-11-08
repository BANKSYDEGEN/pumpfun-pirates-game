import { ageLabel, rowFlash } from './liveui.js';
import { boardCanvas, boardTexture } from './boardtexture.js';
import { MAIN_ROW_Y0, MAIN_ROW_H, boardRows } from './boardgrid.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hqParts, petParts, HQ_CHANDELIERS, HQ_TORCHES, HQ_LANTERNS, HQ_TRENCH_LAMPS, gableVertices, PET_CHANDELIERS, PET_LAMPS, PET_PARROTS, PET_RINGS } from './model.js';
import { HQ, PET_LOT, PET_STORE, PET_PROPS, HQ_PANELS, HQ_SQUAD_BOARDS, HQ_BOARD_BAND, HQ_TOWERS } from './site.js';
import { WATCH_TOKENS } from './market.js';
import { skyPhase, sunElevation } from '../skyCycle.js';
import { petLook, petParrots, petBrass } from './petlook.js';
import { C, frame, icon, txt, rr, rowBg, logo as tokenLogoDot, pill, bar, tapHint, withUpdated, usd } from './boardkit.js';
export function buildParts(parts, low=false) {
 const group=new THREE.Group(),bins=new Map();
 for(const p of parts){if(p.detail&&low)continue;const geo=p.kind==='pill'?new THREE.CapsuleGeometry(p.h/2,p.w-p.h,4,low?8:12).rotateZ(Math.PI/2).scale(1,1,p.d/p.h):new THREE.BoxGeometry(p.w,p.h,p.d);geo.translate(p.x,p.y,p.z);(bins.get(p.c)||bins.set(p.c,[]).get(p.c)).push(geo);}
 for(const [c,geos] of bins){const geo=mergeGeometries(geos);geos.forEach(g=>g.dispose());group.add(new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:c})));}
 return group;
}
const plaqueMaterials=new WeakMap();
function plaque(group,url,w,h,x,y,z,yaw=0){let assets=plaqueMaterials.get(group);if(!assets){assets=new Map();plaqueMaterials.set(group,assets);}let material=assets.get(url);if(!material){const tex=new THREE.TextureLoader().load(url);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;tex.minFilter=THREE.LinearMipmapLinearFilter;material=new THREE.MeshBasicMaterial({map:tex,toneMapped:false});assets.set(url,material);}const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);m.position.set(x,y,z);m.rotation.y=yaw;group.add(m);return m;}
export function buildHQ(low=false){const group=new THREE.Group();group.name='pumpfun_hq_detail';
 const sign=carvedSign(low);for(const [w,h,x,y,z,ry] of [[17.6,2.0,-18.5,HQ.floor+10.6,-29.55,0],[3.5,1.0,HQ.hillDoor.lx+.85,HQ.floor+HQ.hillDoor.h+HQ.hillDoor.w/2+2.3,HQ.hillDoor.lz,Math.PI/2]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),sign);m.position.set(x,y,z);m.rotation.y=ry;group.add(m);}
 const panels=panelSlots(group,low);
 const referral=plaque(group,'assets/pumpfun/referral_sign.webp',4.2,1.575,-25.2,HQ.floor+5.5,-29.3);referral.userData.referral=true;
 const referral2=plaque(group,'assets/pumpfun/referral_sign.webp',4.2,1.575,HQ.lx1+.7,HQ.floor+5.5,HQ.hillDoor.lz-6.7,Math.PI/2);referral2.userData.referral=true;   // [post-village v3] BANKSY: the same sign on the Hill Street side, Treasure Trader side of the door
 const cv=boardCanvas(1536,384,low);const tex=boardTexture(cv,low);
 const board=new THREE.Mesh(new THREE.PlaneGeometry(HQ.board.w,HQ.board.h),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));board.position.set(HQ.board.lx,HQ.board.y,HQ.board.lz+.08);group.add(board);
 const squadBoards = HQ_SQUAD_BOARDS.map(P=>{const m=plaque(group,'assets/pumpfun/'+P.file+'.webp',P.w,P.h,P.lx+.14,HQ.floor+HQ_BOARD_BAND.y,P.lz,Math.PI/2);m.userData.pumpAction=P.kind;return m;});
 const extra=[];for(const f of [cloth,flags,rugs,hallFloor])try{f(group,low,extra);}catch(e){console.warn('[pumpfun] hall dressing skipped',e.message);}
 try{damask(group,low);}catch(e){console.warn('[pumpfun] damask skipped',e.message);}
 try{glow(group,low);}catch(e){console.warn('[pumpfun] hall glow skipped',e.message);}
 try{nightFill(group,low);}catch(e){console.warn('[pumpfun] night fill skipped',e.message);}
 return {group,board,referral,cv,tex,squadBoards,panels,dispose(){for(const m of extra)try{m.map?.dispose?.();m.dispose?.();}catch(e){}group.traverse(o=>{o.geometry?.dispose?.();const m=o.material;if(m){m.map?.dispose?.();m.dispose?.();}});group.removeFromParent();}};}
// carved timber sign (casino style: dark mahogany, gilt incised letters): replaces the flat green bar; one shared canvas
function carvedSign(low){const c=document.createElement('canvas');c.width=low?512:1024;c.height=c.width/8;const g=c.getContext('2d'),W=c.width,H=c.height;
 const gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#5a2a1a');gr.addColorStop(.5,'#3e1c10');gr.addColorStop(1,'#2a120a');g.fillStyle=gr;g.fillRect(0,0,W,H);
 g.globalAlpha=.12;g.strokeStyle='#000';for(let y=4;y<H;y+=H/16){g.beginPath();g.moveTo(0,y);g.bezierCurveTo(W*.3,y+3,W*.6,y-3,W,y+1);g.stroke();}g.globalAlpha=1;
 g.strokeStyle='#d9a441';g.lineWidth=H*.05;g.strokeRect(H*.08,H*.08,W-H*.16,H-H*.16);g.lineWidth=H*.015;g.strokeRect(H*.16,H*.16,W-H*.32,H-H*.32);
 g.font=`bold ${Math.round(H*.62)}px Georgia, "Times New Roman", serif`;g.textAlign='center';g.textBaseline='middle';
 g.fillStyle='#1a0a05';g.fillText('PUMPFUN PIRATES',W/2+H*.03,H*.55+H*.03);g.fillStyle='#e8b85a';g.fillText('PUMPFUN PIRATES',W/2,H*.55);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return new THREE.MeshBasicMaterial({map:t,toneMapped:false});}
// wall info-panel slots: one shared placeholder face; Emerly can swap mesh.material per slot later (userData.panelSlot = id)
function panelSlots(group,low){const Y=HQ.floor+HQ_BOARD_BAND.y;
 // p3: each slot gets its own engraved placeholder face (dark lacquer, gilt title, ruled rows); Emerly swaps mesh.material per slot
 return HQ_PANELS.map((P,i)=>{const c=boardCanvas(512,Math.round(512*P.h/P.w),low);const g=c.getContext('2d'),W=c.width,H=c.height,k=W/512;
  const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#16261f');bg.addColorStop(1,'#0c1612');g.fillStyle=bg;g.fillRect(0,0,W,H);
  g.strokeStyle='rgba(217,164,65,.55)';g.lineWidth=2*k;g.strokeRect(14*k,14*k,W-28*k,H-28*k);g.strokeStyle='rgba(217,164,65,.25)';g.strokeRect(22*k,22*k,W-44*k,H-44*k);
  g.textAlign='center';g.textBaseline='middle';g.font=`bold ${Math.round(40*k)}px Georgia, "Times New Roman", serif`;g.fillStyle='#000';g.fillText(P.title,W/2+2*k,62*k+2*k);g.fillStyle='#e8b85a';g.fillText(P.title,W/2,62*k);
  g.fillStyle='rgba(217,164,65,.6)';g.fillRect(W*.2,92*k,W*.6,2*k);
  for(let r=0;r<5;r++){const y=122*k+r*52*k;g.fillStyle=r%2?'rgba(255,255,255,.035)':'rgba(255,255,255,.07)';g.fillRect(36*k,y,W-72*k,42*k);g.fillStyle='rgba(232,184,90,.75)';g.font=`${Math.round(22*k)}px Georgia, serif`;g.textAlign='left';g.fillText((r+1)+'.',48*k,y+21*k);g.fillStyle='rgba(200,210,200,.35)';g.fillRect(84*k,y+18*k,(W-200*k)*(.5+.4*((r*37+i*13)%10)/10),6*k);}
  g.textAlign='center';g.fillStyle='rgba(168,191,176,.8)';g.font=`italic ${Math.round(18*k)}px Georgia, serif`;g.fillText('PUMPFUN PIRATES · TOKEN HALL',W/2,H-34*k);
  const t=boardTexture(c,low);const mat=new THREE.MeshBasicMaterial({map:t,toneMapped:false});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(P.w,P.h),mat);m.position.set(P.lx+(P.face==='w'?-.14:P.face==='e'?.14:0),Y,P.lz+(P.face==='s'?-.14:0));
  m.rotation.y=P.face==='w'?-Math.PI/2:P.face==='e'?Math.PI/2:Math.PI;m.userData.panelSlot=P.id;m.userData.placeholderMat=mat;m.name='hq_panel_'+P.id;group.add(m);return m;});}
// p3 cloth: one fabric canvas per colourway (weave + folds + gilt fringe) carrying the REAL logo; gentle vertex sway, no lights
let LOGO=null;function logo(low){return LOGO||(LOGO=new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src='assets/pumpfun/flag_logo_'+(low?256:512)+'.webp';}));}
function fabric(low,base,trim,withLogo,aspect,extra,fray){const c=document.createElement('canvas');c.width=low?128:256;c.height=Math.round(c.width*aspect);const g=c.getContext('2d'),W=c.width,H=c.height;
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 const paint=im=>{g.clearRect(0,0,W,H);g.fillStyle=base;g.fillRect(0,0,W,H);
  for(let x=0;x<W;x+=2){g.fillStyle=`rgba(0,0,0,${.05+.05*Math.sin(x*.9)})`;g.fillRect(x,0,1,H);}for(let y=0;y<H;y+=2){g.fillStyle='rgba(255,255,255,.025)';g.fillRect(0,y,W,1);}   // weave
  const fold=g.createLinearGradient(0,0,W,0);for(let i=0;i<=6;i++)fold.addColorStop(i/6,i%2?'rgba(0,0,0,.22)':'rgba(255,255,255,.06)');g.fillStyle=fold;g.fillRect(0,0,W,H);
  if(im){const s=Math.min(W*.86,H*.7),x=(W-s)/2,y=fray?(H-s)/2:H*.2;g.save();g.globalCompositeOperation='screen';g.drawImage(im,x,y,s,s);g.restore();}
  if(trim){g.fillStyle=trim;g.fillRect(0,0,W,W*.05);g.fillRect(0,0,W*.04,H);g.fillRect(W-W*.04,0,W*.04,H);if(!fray){g.fillRect(0,H*.9,W,W*.04);for(let x=0;x<W;x+=W/12){g.beginPath();g.moveTo(x,H*.93);g.lineTo(x+W/24,H);g.lineTo(x+W/12,H*.93);g.fill();}}}
  if(fray){g.globalCompositeOperation='destination-out';for(let y=0;y<H;y+=3){const d=(Math.sin(y*1.7)*.5+.5)*W*.03+Math.random()*W*.02;g.fillRect(W-d,y,d,3);}for(let x=0;x<W;x+=3){const d=Math.random()*H*.02;g.fillRect(x,H-d,3,d);}g.globalCompositeOperation='source-over';}
  t.needsUpdate=true;};
 paint(null);if(withLogo)logo(low).then(im=>{try{paint(im);}catch(e){}});
 const m=new THREE.MeshLambertMaterial({map:t,side:THREE.FrontSide,transparent:!!fray,alphaTest:fray?.5:0});const u={value:0};
 m.onBeforeCompile=sh=>{sh.uniforms.uT=u;sh.vertexShader='uniform float uT;\nattribute vec2 aSw;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.z+=sin(uT*1.7+aSw.x*5.0+aSw.y*3.0)*0.07*'+(fray?'aSw.x':'(1.0-aSw.y)')+';');};
 m.userData.tick=u;extra.push(m);return m;}
// two sheets back to back (front-face only): the back sheet has mirrored U and reversed winding, so the logo reads correctly from BOTH sides
function swayMesh(geo,mat){geo.setAttribute('aSw',geo.attributes.uv.clone());const back=geo.clone(),uv=back.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));
 const ix=back.index.array;for(let i=0;i<ix.length;i+=3){const a=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=a;}back.computeVertexNormals();
 const g=new THREE.Group(),f=new THREE.Mesh(geo,mat),b=new THREE.Mesh(back,mat);f.onBeforeRender=()=>{mat.userData.tick.value=performance.now()/1000;};g.add(f,b);return g;}
function cloth(group,low,extra){const Y=HQ.floor,CEIL=Y+HQ.ceil,seg=low?2:6;
 const red=fabric(low,'#6e1a20','#d9a441',true,2.6,extra,false),green=fabric(low,'#173d2c','#d9a441',true,2.6,extra,false);
 for(const x of [-24.5,-12.5]) for(const [z,mt] of [[-44,red],[-52.5,green]]){const g=new THREE.PlaneGeometry(1.75,4.6,1,seg);g.translate(0,-2.3,0);const m=swayMesh(g,mt);m.position.set(x,CEIL-1.45,z);group.add(m);}
 const g=new THREE.PlaneGeometry(1.75,5.0,1,seg);g.translate(0,-2.5,0);const m=swayMesh(g,green);m.position.set(-11.8,Y+6.8,-29.25);group.add(m);}
function flags(group,low,extra){const Y=HQ.floor,TOP=Y+HQ.wallTop,mat=fabric(low,'#0b0b0c',null,true,1.0,extra,true),seg=low?3:8;
 const add=(w,h,x,y,z,ry)=>{const g=new THREE.PlaneGeometry(w,h,seg,seg>>1);g.translate(w/2,-h/2,0);const m=swayMesh(g,mat);m.position.set(x,y,z);m.rotation.y=ry;group.add(m);};
 add(2.3,2.3,HQ.lx0+.75,Y+10.05,-49.3,-Math.PI/2);add(2.3,2.3,HQ.lx1-1.15,Y+10.05,-47.0,Math.PI/2);   // p8: both flags fly over lz -49.3..-47.0   // hall flags off the wall brackets
 for(const t of HQ_TOWERS)add(2.0,2.0,t.lx+.08,TOP+7.1,t.lz,0);}                                       // gun-tower flags
// UNPUSHED palette preview: one small repeating sRGB wood texture, one floor draw call.
function hallFloor(group,low,extra){const cv=document.createElement('canvas'),N=low?256:512;cv.width=cv.height=N;const g=cv.getContext('2d');
 const colors=['#735138','#6b4932','#805b3f','#65462f','#75543c','#6c4c35'];
 for(let i=0;i<6;i++){const x=i*N/6,w=N/6;g.fillStyle=colors[i];g.fillRect(x,0,w+1,N);g.fillStyle='#302117';g.fillRect(x,0,Math.max(1,N/256),N);
  for(let j=0;j<19;j++){const px=x+(j+1)*w/20;g.strokeStyle=j%3?'rgba(25,14,5,.08)':'rgba(245,209,150,.07)';g.lineWidth=Math.max(.5,N/700);g.beginPath();g.moveTo(px,0);g.bezierCurveTo(px+w*.07,N*.3,px-w*.08,N*.65,px,N);g.stroke();}
  const y=(i%2?.25:.75)*N;g.fillStyle='#3d2b1e';g.fillRect(x,y,w,Math.max(1,N/256));}
 const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=low?4:8;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
 const w=HQ.lx1-HQ.lx0-1.55,d=HQ.lz1-HQ.lz0-1.16;t.repeat.set(w/4,d/4);
 const mat=new THREE.MeshLambertMaterial({map:t,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.4});extra.push(mat);
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);mesh.name='hq_floor_palette_preview';mesh.rotation.x=-Math.PI/2;mesh.position.set((HQ.lx0+HQ.lx1)/2-.2,HQ.floor+.034,(HQ.lz0+HQ.lz1)/2);group.add(mesh);}
// p3 floor rugs: one 512 px medallion carpet canvas (256 on phones), Lambert, flat on the planks
function rugs(group,low,extra){const c=document.createElement('canvas');c.width=low?256:512;c.height=c.width*.62;const g=c.getContext('2d'),W=c.width,H=c.height;
 g.fillStyle='#0e2b21';g.fillRect(0,0,W,H);g.fillStyle='#161616';g.fillRect(W*.06,H*.1,W*.88,H*.8);g.fillStyle='#18593e';g.fillRect(W*.1,H*.17,W*.8,H*.66);
 g.strokeStyle='#ffcd77';g.lineWidth=W*.008;g.strokeRect(W*.03,H*.05,W*.94,H*.9);g.strokeRect(W*.1,H*.17,W*.8,H*.66);
 for(let i=0;i<24;i++){const x=W*.06+i*W*.88/24;g.fillStyle=i%2?'#ffcd77':'#2c9f68';g.beginPath();g.moveTo(x,H*.1);g.lineTo(x+W*.018,H*.135);g.lineTo(x,H*.17);g.fill();g.beginPath();g.moveTo(x,H*.83);g.lineTo(x+W*.018,H*.865);g.lineTo(x,H*.9);g.fill();}
 g.save();g.translate(W/2,H/2);for(let r=4;r>0;r--){g.fillStyle=['#ffcd77','#161616','#2c9f68','#eee2be'][r%4];g.beginPath();for(let a=0;a<16;a++){const R=(a%2?.55:1)*H*.075*r;g.lineTo(Math.cos(a*Math.PI/8)*R*1.5,Math.sin(a*Math.PI/8)*R);}g.fill();}g.restore();
 for(const sx of [-1,1])for(const sy of [-1,1]){g.fillStyle='#ffcd77';g.beginPath();g.arc(W/2+sx*W*.33,H/2+sy*H*.24,H*.05,0,7);g.fill();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;const mat=new THREE.MeshLambertMaterial({map:t,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.4,polygonOffset:true,polygonOffsetFactor:-1});extra.push(mat);
 const Y=HQ.floor,geos=[];for(const [x,z,w,d,ry] of [[-26.5,-37.5,5.2,3.2,Math.PI/2],[-10.5,-37.5,5.2,3.2,Math.PI/2],[-28.3,-52,4.6,2.9,0],[-8.6,-52.6,4.6,2.9,0],[-26.5,-45.5,5.2,3.2,Math.PI/2],[-10.5,-46.8,4.2,2.6,0]]){const g2=new THREE.PlaneGeometry(w,d);g2.rotateX(-Math.PI/2);g2.rotateY(ry);g2.translate(x,Y+.045,z);geos.push(g2);}
 const m=new THREE.Mesh(mergeGeometries(geos),mat);geos.forEach(q=>q.dispose());group.add(m);}
// [post-hq-castle] casino damask above the mahogany wainscot: ONE 256 px canvas pattern (128 on phones), lit Lambert, one merged mesh
function damask(group,low){const n=low?256:512,c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d'),k=n/512;
 // crimson tone-on-tone damask (the casino's motif family): ogee medallions on a half-drop lattice, gilt hairline, soft vertical sheen
 const bg=x.createLinearGradient(0,0,n,0);bg.addColorStop(0,'#5a171c');bg.addColorStop(.5,'#6a1d22');bg.addColorStop(1,'#5a171c');x.fillStyle=bg;x.fillRect(0,0,n,n);
 const med=(cx,cy,s)=>{x.save();x.translate(cx*k,cy*k);x.scale(k*s,k*s);
  x.fillStyle='#7d2a2c';x.beginPath();x.moveTo(0,-118);x.bezierCurveTo(70,-80,92,-20,0,118);x.bezierCurveTo(-92,-20,-70,-80,0,-118);x.fill();
  x.fillStyle='#8e3533';for(const sy of [-1,1]){x.beginPath();x.moveTo(0,sy*20);x.bezierCurveTo(40,sy*40,60,sy*90,0,sy*104);x.bezierCurveTo(-60,sy*90,-40,sy*40,0,sy*20);x.fill();}
  for(const sx of [-1,1]){x.beginPath();x.moveTo(sx*8,0);x.bezierCurveTo(sx*40,-28,sx*72,-8,sx*62,18);x.bezierCurveTo(sx*48,36,sx*22,16,sx*8,0);x.fill();}
  x.fillStyle='#a8463c';x.beginPath();x.arc(0,0,16,0,7);x.fill();x.fillStyle='#7d2a2c';x.beginPath();x.arc(0,0,8,0,7);x.fill();
  x.strokeStyle='rgba(214,164,74,0.45)';x.lineWidth=2.2;x.beginPath();x.moveTo(0,-118);x.bezierCurveTo(70,-80,92,-20,0,118);x.bezierCurveTo(-92,-20,-70,-80,0,-118);x.stroke();
  x.fillStyle='rgba(214,164,74,0.55)';for(const [dx,dy] of [[0,-128],[0,128],[0,-60],[0,60]]){x.beginPath();x.arc(dx,dy,3.2,0,7);x.fill();}x.restore();};
 for(const [cx,cy] of [[128,128],[384,384],[384,-128],[128,640],[-128,384],[640,384]])med(cx,cy,1);
 for(const [cx,cy] of [[384,128],[128,384],[384,640],[640,128],[-128,128],[128,-128]])med(cx,cy,.42);
 x.strokeStyle='rgba(214,164,74,0.18)';x.lineWidth=1.4*k;for(let i=-1;i<=2;i++){x.beginPath();x.moveTo(i*256*k,0);x.lineTo((i*256+512)*k,n);x.stroke();x.beginPath();x.moveTo((i*256+512)*k,0);x.lineTo(i*256*k,n);x.stroke();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;
 const Y=HQ.floor,y0=Y+1.62,y1=Y+7.18,h=y1-y0,geos=[];
 const panel=(w,px,pz,ry)=>{const g=new THREE.PlaneGeometry(w,h);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/1.8,uv.getY(i)*h/1.8);g.rotateY(ry);g.translate(px,(y0+y1)/2,pz);geos.push(g);};
 const X0=HQ.lx0+.62,X1=HQ.lx1-1.02,Z0=HQ.lz0+.62,Z1=HQ.lz1-.62,D=HQ.hillDoor;
 panel(Z1-Z0,X0,(Z0+Z1)/2,Math.PI/2);panel(X1-X0,(X0+X1)/2,Z0,0);
 for(const [a,b] of [[Z0,D.lz-D.w/2-.3],[D.lz+D.w/2+.3,Z1]])panel(b-a,X1,(a+b)/2,-Math.PI/2);
 for(const [a,b] of [[X0,HQ.door.lx-HQ.door.w/2-.5],[HQ.door.lx+HQ.door.w/2+.5,X1]])panel(b-a,(a+b)/2,Z1,Math.PI);
 const m=new THREE.Mesh(mergeGeometries(geos),new THREE.MeshLambertMaterial({map:t}));geos.forEach(g=>g.dispose());group.add(m);}
// [post-hq-castle] casino-style warmth with ZERO realtime lights: unlit flame cores + painted additive light pools on the floor,
// walls and ceiling (one 128 px gradient shared by every pool, all merged into ONE mesh).
function glow(group,low){
 const flames=hqParts().filter(p=>p.glow);if(flames.length){const g=buildParts(flames.map(p=>({...p,detail:false})),false);g.traverse(o=>{if(o.material){const c=o.material.color;o.material.dispose();o.material=new THREE.MeshBasicMaterial({color:c,toneMapped:false});}});group.add(g);}
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),r=x.createRadialGradient(64,64,2,64,64,64);
 r.addColorStop(0,'rgba(248,241,225,0.12)');r.addColorStop(.4,'rgba(244,239,225,0.055)');r.addColorStop(1,'rgba(244,239,225,0)');x.fillStyle=r;x.fillRect(0,0,128,128);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const Y=HQ.floor,geos=[];
 const pool=(w,px,py,pz,rx,ry)=>{const g=new THREE.PlaneGeometry(w,w);g.rotateX(rx);g.rotateY(ry);g.translate(px,py,pz);geos.push(g);};
 for(const z of HQ_CHANDELIERS){pool(11,-18.5,Y+.085,z,-Math.PI/2,0);if(!low)pool(6,-18.5,Y+HQ.ceil-.02,z,Math.PI/2,0);}
 for(const [px,pz] of HQ_LANTERNS){const s=px<-18?1:-1,wx=s>0?-32.25:-5.15;pool(5,px,Y+.085,pz,-Math.PI/2,0);}   // BANKSY t339u: no glow patches on the wall boards
 pool(10,HQ.board.lx,Y+HQ.dais.rise+.07,-61.8,-Math.PI/2,0);
 const m=new THREE.Mesh(mergeGeometries(geos),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2}));geos.forEach(g=>g.dispose());m.renderOrder=2;group.add(m);}
// BANKSY t303u "make the inside light even at night": an interior-only warm fill (additive planes just inside the walls, floor and
// ceiling, holes at both doorways). Opacity follows the sky's night amount every frame (onBeforeRender), so the hall reads like day
// at night and adds nothing at noon. No lights, nothing outside the hall; it goes away with the hall group (dispose on exit).
export const hqNightAmount=(p=skyPhase())=>{const e=sunElevation(p),t=Math.min(1,Math.max(0,(e+.05)/.3));return 1-t*t*(3-2*t);};
function nightFill(group,low){const Y=HQ.floor,C=Y+HQ.ceil-.04,X0=HQ.lx0+.58,X1=HQ.lx1-.98,Z0=HQ.lz0+.58,Z1=HQ.lz1-.58,geos=[];
 const q=(w,h,x,y,z,rx,ry)=>{if(w<=0||h<=0)return;const g=new THREE.PlaneGeometry(w,h);g.rotateX(rx);g.rotateY(ry);g.translate(x,y,z);geos.push(g);};
 // Floor/rugs use texture-modulated neutral fill; no flat additive wash over their colours.
 q(X1-X0,Z1-Z0,(X0+X1)/2,C,(Z0+Z1)/2,Math.PI/2,0);
 q(Z1-Z0,C-Y,X0,(Y+C)/2,(Z0+Z1)/2,0,Math.PI/2); q(X1-X0,C-Y,(X0+X1)/2,(Y+C)/2,Z0,0,0);
 const D=HQ.hillDoor,dz0=D.lz-D.w/2-.4,dz1=D.lz+D.w/2+.4,dt=Y+D.h+D.w/2+.5;   // east wall, hole for the Hill Street arch
 q(dz0-Z0,C-Y,X1,(Y+C)/2,(Z0+dz0)/2,0,-Math.PI/2); q(Z1-dz1,C-Y,X1,(Y+C)/2,(dz1+Z1)/2,0,-Math.PI/2); q(dz1-dz0,C-dt,X1,(dt+C)/2,D.lz,0,-Math.PI/2);
 const G=HQ.door,gx0=G.lx-G.w/2-.4,gx1=G.lx+G.w/2+.4,gt=Y+G.w/2+5.0;   // front wall, hole for the dock gate
 q(gx0-X0,C-Y,(X0+gx0)/2,(Y+C)/2,Z1,0,Math.PI); q(X1-gx1,C-Y,(gx1+X1)/2,(Y+C)/2,Z1,0,Math.PI); q(gx1-gx0,C-gt,G.lx,(gt+C)/2,Z1,0,Math.PI);
 const mat=new THREE.MeshBasicMaterial({color:0xe7ecf2,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});
 const m=new THREE.Mesh(mergeGeometries(geos),mat);geos.forEach(g=>g.dispose());m.name='hq_night_fill';m.renderOrder=1;m.frustumCulled=false;
 const peak=low?.2:.22;let at=0;m.onBeforeRender=()=>{const now=performance.now();if(now-at<500)return;at=now;mat.opacity=peak*hqNightAmount();};mat.opacity=peak*hqNightAmount();
 group.add(m);}
// [post-petstore] near-only pet store detail: props (boxes / cylinders / gables, rotations), unlit flames, carved signs, petlook.js textures, painted
// light pools (one 128 px gradient, additive, no lights). The shell is in the plaza kit (model.js petShellParts).
export function buildPetDress(low=false){const g=new THREE.Group();g.name='pet_store_L4_dress';const bins=new Map(),S=PET_STORE,F=S.floor;
 for(const p of petParts()){if(p.detail&&low&&!p.glow)continue;let geo;
  if(p.kind==='cyl')geo=new THREE.CylinderGeometry(p.r,p.r1,p.h,low?Math.max(6,p.n>>1):p.n);
  else if(p.kind==='gable'){geo=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(gableVertices(p),3));geo.computeVertexNormals();}
  else geo=new THREE.BoxGeometry(p.w,p.h,p.d);
  if(p.kind==='gable'){geo.translate(p.x,p.y,p.z);}else{const m=new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rx||0,p.ry||0,p.rz||0)),new THREE.Vector3(1,1,1));geo.applyMatrix4(m);}
  if(geo.index)geo=geo.toNonIndexed();for(const k of Object.keys(geo.attributes))if(k!=='position'&&k!=='normal')geo.deleteAttribute(k);
  const key=(p.glow?'G':p.glass?'T':'L')+p.c;(bins.get(key)||bins.set(key,[]).get(key)).push(geo);}
 for(const [key,geos] of bins){const geo=mergeGeometries(geos);geos.forEach(q=>q.dispose());const c=key.slice(1);
  const mat=key[0]==='G'?new THREE.MeshBasicMaterial({color:c,toneMapped:false}):key[0]==='T'?new THREE.MeshLambertMaterial({color:c,transparent:true,opacity:.5,depthWrite:false,emissive:0x0b3a48}):new THREE.MeshLambertMaterial({color:c});
  const m=new THREE.Mesh(geo,mat);if(key[0]==='T')m.renderOrder=1;g.add(m);}
 try{petLook(g,low);}catch(e){console.warn('[pet store] look skipped',e.message);}
 try{petParrots(g,PET_PARROTS,low);petBrass(g,PET_PROPS,PET_RINGS,F,F+S.ceil,low);}catch(e){console.warn('[pet store] parrots/brass skipped',e.message);}
 plaque(g,'assets/pumpfun/pet_sign_carved.webp',3.8,.95,S.x1+.21,F+5.45,S.door.lz,Math.PI/2);   // over the arch
 const hs=PET_STORE.floor+3.6;plaque(g,'assets/pumpfun/pet_sign_carved.webp',1.3,.33,S.x1+.75,hs,S.z0+.73,0);plaque(g,'assets/pumpfun/pet_sign_carved.webp',1.3,.33,S.x1+.75,hs,S.z0+.67,Math.PI);   // hanging bracket sign
 plaque(g,'assets/pumpfun/pet_sign_carved.webp',3.4,.85,-15.0,F+3.4,S.door.lz,Math.PI/2);   // board over the shelves behind the counter
 try{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),r=x.createRadialGradient(64,64,2,64,64,64);
  r.addColorStop(0,'rgba(255,196,118,0.62)');r.addColorStop(.4,'rgba(255,156,66,0.24)');r.addColorStop(1,'rgba(255,140,50,0)');x.fillStyle=r;x.fillRect(0,0,128,128);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const geos=[],pool=(w,px,py,pz,rx,ry)=>{const q=new THREE.PlaneGeometry(w,w);q.rotateX(rx);q.rotateY(ry);q.translate(px,py,pz);geos.push(q);};
  const C=F+S.ceil;for(const [px,pz] of PET_CHANDELIERS){pool(7.5,px,F+.06,pz,-Math.PI/2,0);pool(4,px,F+.07,pz,-Math.PI/2,0);if(!low)pool(4.5,px,C-.02,pz,Math.PI/2,0);}
  for(const [px,pz] of PET_LAMPS){pool(3.2,px-.05,F+2.8,pz,0,-Math.PI/2);pool(3,px-1.2,F+.05,pz,-Math.PI/2,0);}
  for(const s of [-1,1])pool(3,S.x1+.03,F+3.3,S.door.lz+s*(S.door.w/2+.75),0,Math.PI/2);
  const m=new THREE.Mesh(mergeGeometries(geos),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2}));geos.forEach(q=>q.dispose());m.renderOrder=2;g.add(m);}catch(e){console.warn('[pet store] pools skipped',e.message);}
 g.userData.dispose=()=>g.traverse(o=>{o.geometry?.dispose?.();const m=o.material;if(m){m.map?.dispose?.();m.dispose?.();}});
 return g;}
// Main 24 m board: ten compact rows per column; pointer grid shared with boardgrid.js.
export function drawHQBoard(cv,state,now=Date.now()){const g=cv.getContext('2d'),W=1536,H=384;g.save();g.setTransform(cv.width/W,0,0,cv.height/H,0,0);
 frame(g,W,H,{trim:10});icon(g,'market',46,32,17);txt(g,'PUMPFUN PIRATES · MARKET WATCH',72,33,36,C.gold,'left',760,true);txt(g,'FREE SNAPSHOTS · NOT A LIVE TRADE FEED',W-30,33,24,C.muted,'right',600);
 WATCH_TOKENS.map(t=>t.sym).forEach((sym,i)=>{const p=state.prices[sym],t=WATCH_TOKENS.find(t=>t.sym===sym),x=24+i*(1500/WATCH_TOKENS.length),w=1500/WATCH_TOKENS.length-18;rowBg(g,i,x-4,52,w,64);
  tokenLogoDot(g,{mint:t?.ca,symbol:sym,imageUrl:p?.imageUrl},x+28,84,24);txt(g,'$'+sym,x+60,85,42,C.gold,'left',112,true);
  const pw=pill(g,p?.change??null,x+w-14,70,24,p?.change!=null?(p.change>=0?'+':'')+p.change.toFixed(1)+'% 24h':'24h —');
  txt(g,p?usd(p.price)+(p.stale?' · STALE':''):state.status.prices==='Loading…'?'Loading…':'Feed offline',x+180,71,30,C.parch,'left',w-200-pw);
  txt(g,(p?.cap!=null?'MC '+usd(p.cap):p?.fdv!=null?'FDV '+usd(p.fdv):'MC —')+'  ·  VOL '+usd(p?.volume),x+180,100,24,C.muted,'left',w-194);});
 const defs=[['ABOUT TO BOND','bonding','bond','≈ curve progress · GeckoTerminal pump.fun pools'],['TRENDING TOKENS','trending','volume','GeckoTerminal · Pump venues, Solana trending'],['DEX BOOSTED','callouts','callout','Latest DexScreener boosts · pump.fun tokens']];
 defs.forEach(([title,key,ic,source],i)=>{const x=24+i*500,w=482;g.fillStyle='rgba(0,0,0,0.32)';rr(g,x-4,126,w,218,10);g.fill();g.strokeStyle='rgba(255,205,119,0.35)';g.lineWidth=1.5;g.stroke();
  icon(g,ic,x+20,145,14);txt(g,title,x+44,146,30,C.gold,'left',w-60,true);txt(g,source,x+8,166,18,C.muted,'left',w-20);
  const rows=boardRows(state,key,now);if(!rows.length){const st=state.status[key]||'Loading…';txt(g,st==='Loading…'?'Loading…':/offline/i.test(st)?'Feed offline':'—',x+w/2-4,240,32,C.parch,'center',w-30);txt(g,/offline/i.test(st)?'Retrying when nearby':'',x+w/2-4,276,22,C.muted,'center',w-30);}
  rows.forEach((r,n)=>{const cy=MAIN_ROW_Y0+MAIN_ROW_H*(n+.5),xr=x+w-18;rowBg(g,n,x+2,cy-7,w-12,14);tokenLogoDot(g,r,x+24,cy,6);let rw=0;
   if(key==='bonding'){rw=txt(g,'≈'+r.progress.toFixed(1)+'%',xr,cy+1,16,C.gold,'right',90);bar(g,x+210,cy-3,xr-rw-14-(x+210),6,r.progress/100);}
   else if(key==='trending'){rw=pill(g,r.change??null,xr,cy,14);const vw=txt(g,usd(r.volume),xr-rw-12,cy+1,16,C.parch,'right',110);txt(g,'VOL',xr-rw-18-vw,cy+1,13,C.dim,'right');}
   else{rw=txt(g,'+'+(r.boost||r.amount)+' boost',xr,cy+1,16,C.gold,'right',120);if(r.cap!=null)txt(g,'MC '+usd(r.cap),xr-rw-14,cy+1,15,C.muted,'right',110);}
   rowFlash(g,state,key,r.mint,x+2,cy-7,w-12,14,now);txt(g,r.symbol||r.mint.slice(0,6),x+38,cy+1,17,'#ffe9b8','left',key==='bonding'?156:150);});
  txt(g,rows.length?ageLabel(state.updated?.[key],now):(state.status[key]||'Loading…'),x+8,340,17,C.dim,'left',w-20);});
 // Slim price tape inside the existing canvas; it does not alter geometry or row hit targets.
 const tape=[...WATCH_TOKENS.map(t=>({symbol:t.sym,price:state.prices[t.sym]?.price})),...(state.trending||[]).slice(0,6)];
 const text=tape.map(r=>'$'+r.symbol+' '+usd(r.price)).join('     •     ');
 g.save();g.beginPath();g.rect(24,352,W-48,24);g.clip();g.fillStyle='#140e09';g.fillRect(24,352,W-48,24);g.font='700 19px system-ui,sans-serif';const span=g.measureText(text).width+90,offset=(now/1000*35)%Math.max(span,1);for(let x=24-offset;x<W;x+=span) {g.fillStyle=C.gold;g.textAlign='left';g.textBaseline='middle';g.fillText(text,x,365);}g.restore();g.restore();}
export { logoRev } from './logos.js';
export { attachDexPanel, drawDexPanel, dexPanelRow } from './dexpanel.js';
export { attachWallPanels, drawWallPanel, wallPanelMint } from './wallpanels.js';
