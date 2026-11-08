import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hqParts, petParts, HQ_CHANDELIERS, HQ_TORCHES } from './model.js';
import { HQ, PET_LOT, HQ_PANELS, HQ_SQUAD_BOARDS, HQ_BOARD_BAND, HQ_TOWERS } from './site.js';
export function buildParts(parts, low=false) {
 const group=new THREE.Group(),bins=new Map();
 for(const p of parts){if(p.detail&&low)continue;const geo=p.kind==='pill'?new THREE.CapsuleGeometry(p.h/2,p.w-p.h,4,low?8:12).rotateZ(Math.PI/2).scale(1,1,p.d/p.h):new THREE.BoxGeometry(p.w,p.h,p.d);geo.translate(p.x,p.y,p.z);(bins.get(p.c)||bins.set(p.c,[]).get(p.c)).push(geo);}
 for(const [c,geos] of bins){const geo=mergeGeometries(geos);geos.forEach(g=>g.dispose());group.add(new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:c})));}
 return group;
}
function plaque(group,url,w,h,x,y,z,yaw=0){const tex=new THREE.TextureLoader().load(url);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=2;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));m.position.set(x,y,z);m.rotation.y=yaw;group.add(m);return m;}
export function buildHQ(low=false){const group=new THREE.Group();group.name='pumpfun_hq_detail';
 const sign=carvedSign(low);for(const [w,h,x,y,z,ry] of [[17.6,2.0,-18.5,HQ.floor+10.6,-29.55,0],[3.5,1.0,HQ.hillDoor.lx+.85,HQ.floor+HQ.hillDoor.h+HQ.hillDoor.w/2+2.3,HQ.hillDoor.lz,Math.PI/2]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),sign);m.position.set(x,y,z);m.rotation.y=ry;group.add(m);}
 const panels=panelSlots(group,low);
 const referral=plaque(group,'assets/pumpfun/referral_sign.webp',3.2,.8,-24.6,HQ.floor+4.0,-29.7);referral.userData.referral=true;
 const cv=document.createElement('canvas');cv.width=low?512:1024;cv.height=low?128:256;const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
 const board=new THREE.Mesh(new THREE.PlaneGeometry(HQ.board.w,HQ.board.h),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));board.position.set(HQ.board.lx,HQ.board.y,HQ.board.lz+.08);group.add(board);
 const squadBoards = HQ_SQUAD_BOARDS.map(P=>{const m=plaque(group,'assets/pumpfun/'+P.file+'.webp',P.w,P.h,P.lx+.14,HQ.floor+HQ_BOARD_BAND.y,P.lz,Math.PI/2);m.userData.pumpAction=P.kind;return m;});
 const extra=[];for(const f of [cloth,flags,rugs])try{f(group,low,extra);}catch(e){console.warn('[pumpfun] hall dressing skipped',e.message);}
 try{damask(group,low);}catch(e){console.warn('[pumpfun] damask skipped',e.message);}
 try{glow(group,low);}catch(e){console.warn('[pumpfun] hall glow skipped',e.message);}
 return {group,board,referral,cv,tex,squadBoards,panels,dispose(){for(const m of extra)try{m.map?.dispose?.();m.dispose?.();}catch(e){}group.traverse(o=>{o.geometry?.dispose?.();const m=o.material;if(m){m.map?.dispose?.();m.dispose?.();}});group.removeFromParent();}};}
// carved timber sign (casino style: dark mahogany, gilt incised letters): replaces the flat green bar; one shared canvas
function carvedSign(low){const c=document.createElement('canvas');c.width=low?512:1024;c.height=c.width/8;const g=c.getContext('2d'),W=c.width,H=c.height;
 const gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#5a2a1a');gr.addColorStop(.5,'#3e1c10');gr.addColorStop(1,'#2a120a');g.fillStyle=gr;g.fillRect(0,0,W,H);
 g.globalAlpha=.12;g.strokeStyle='#000';for(let y=4;y<H;y+=H/16){g.beginPath();g.moveTo(0,y);g.bezierCurveTo(W*.3,y+3,W*.6,y-3,W,y+1);g.stroke();}g.globalAlpha=1;
 g.strokeStyle='#d9a441';g.lineWidth=H*.05;g.strokeRect(H*.08,H*.08,W-H*.16,H-H*.16);g.lineWidth=H*.015;g.strokeRect(H*.16,H*.16,W-H*.32,H-H*.32);
 g.font=`bold ${Math.round(H*.62)}px Georgia, "Times New Roman", serif`;g.textAlign='center';g.textBaseline='middle';
 g.fillStyle='#1a0a05';g.fillText('PUMPFUN PIRATES',W/2+H*.03,H*.55+H*.03);g.fillStyle='#e8b85a';g.fillText('PUMPFUN PIRATES',W/2,H*.55);
 for(const x of [H*.55,W-H*.55]){g.fillStyle='#e8b85a';g.beginPath();g.arc(x,H/2,H*.2,0,7);g.fill();g.fillStyle='#5a2a1a';g.beginPath();g.arc(x,H/2,H*.1,0,7);g.fill();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return new THREE.MeshBasicMaterial({map:t,toneMapped:false});}
// wall info-panel slots: one shared placeholder face; Emerly can swap mesh.material per slot later (userData.panelSlot = id)
function panelSlots(group,low){const Y=HQ.floor+HQ_BOARD_BAND.y;
 // p3: each slot gets its own engraved placeholder face (dark lacquer, gilt title, ruled rows); Emerly swaps mesh.material per slot
 return HQ_PANELS.map((P,i)=>{const c=document.createElement('canvas');c.width=low?256:512;c.height=Math.round(c.width*P.h/P.w);const g=c.getContext('2d'),W=c.width,H=c.height,k=W/512;
  const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#16261f');bg.addColorStop(1,'#0c1612');g.fillStyle=bg;g.fillRect(0,0,W,H);
  g.strokeStyle='rgba(217,164,65,.55)';g.lineWidth=2*k;g.strokeRect(14*k,14*k,W-28*k,H-28*k);g.strokeStyle='rgba(217,164,65,.25)';g.strokeRect(22*k,22*k,W-44*k,H-44*k);
  g.textAlign='center';g.textBaseline='middle';g.font=`bold ${Math.round(40*k)}px Georgia, "Times New Roman", serif`;g.fillStyle='#000';g.fillText(P.title,W/2+2*k,62*k+2*k);g.fillStyle='#e8b85a';g.fillText(P.title,W/2,62*k);
  g.fillStyle='rgba(217,164,65,.6)';g.fillRect(W*.2,92*k,W*.6,2*k);
  for(let r=0;r<5;r++){const y=122*k+r*52*k;g.fillStyle=r%2?'rgba(255,255,255,.035)':'rgba(255,255,255,.07)';g.fillRect(36*k,y,W-72*k,42*k);g.fillStyle='rgba(232,184,90,.75)';g.font=`${Math.round(22*k)}px Georgia, serif`;g.textAlign='left';g.fillText((r+1)+'.',48*k,y+21*k);g.fillStyle='rgba(200,210,200,.35)';g.fillRect(84*k,y+18*k,(W-200*k)*(.5+.4*((r*37+i*13)%10)/10),6*k);}
  g.textAlign='center';g.fillStyle='rgba(168,191,176,.8)';g.font=`italic ${Math.round(18*k)}px Georgia, serif`;g.fillText('PUMPFUN PIRATES · TOKEN HALL',W/2,H-34*k);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshBasicMaterial({map:t,toneMapped:false});
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
 const g=new THREE.PlaneGeometry(1.75,5.0,1,seg);g.translate(0,-2.5,0);const m=swayMesh(g,green);m.position.set(-12.4,Y+6.8,-29.66);group.add(m);}
function flags(group,low,extra){const Y=HQ.floor,TOP=Y+HQ.wallTop,mat=fabric(low,'#0b0b0c',null,true,1.0,extra,true),seg=low?3:8;
 const add=(w,h,x,y,z,ry)=>{const g=new THREE.PlaneGeometry(w,h,seg,seg>>1);g.translate(w/2,-h/2,0);const m=swayMesh(g,mat);m.position.set(x,y,z);m.rotation.y=ry;group.add(m);};
 add(2.3,2.3,HQ.lx0+.75,Y+10.05,-56.6,-Math.PI/2);add(2.3,2.3,HQ.lx1-1.15,Y+10.05,-63.4,Math.PI/2);   // hall flags off the wall brackets
 for(const t of HQ_TOWERS)add(2.0,2.0,t.lx+.08,TOP+7.1,t.lz,0);}                                       // gun-tower flags
// p3 floor rugs: one 512 px medallion carpet canvas (256 on phones), Lambert, flat on the planks
function rugs(group,low,extra){const c=document.createElement('canvas');c.width=low?256:512;c.height=c.width*.62;const g=c.getContext('2d'),W=c.width,H=c.height;
 g.fillStyle='#5b1418';g.fillRect(0,0,W,H);g.fillStyle='#1d2a3f';g.fillRect(W*.06,H*.1,W*.88,H*.8);g.fillStyle='#6e1a20';g.fillRect(W*.1,H*.17,W*.8,H*.66);
 g.strokeStyle='#d9a441';g.lineWidth=W*.008;g.strokeRect(W*.03,H*.05,W*.94,H*.9);g.strokeRect(W*.1,H*.17,W*.8,H*.66);
 for(let i=0;i<24;i++){const x=W*.06+i*W*.88/24;g.fillStyle=i%2?'#d9a441':'#2e6b55';g.beginPath();g.moveTo(x,H*.1);g.lineTo(x+W*.018,H*.135);g.lineTo(x,H*.17);g.fill();g.beginPath();g.moveTo(x,H*.83);g.lineTo(x+W*.018,H*.865);g.lineTo(x,H*.9);g.fill();}
 g.save();g.translate(W/2,H/2);for(let r=4;r>0;r--){g.fillStyle=['#d9a441','#1d2a3f','#c8552e','#e8d6a8'][r%4];g.beginPath();for(let a=0;a<16;a++){const R=(a%2?.55:1)*H*.075*r;g.lineTo(Math.cos(a*Math.PI/8)*R*1.5,Math.sin(a*Math.PI/8)*R);}g.fill();}g.restore();
 for(const sx of [-1,1])for(const sy of [-1,1]){g.fillStyle='#d9a441';g.beginPath();g.arc(W/2+sx*W*.33,H/2+sy*H*.24,H*.05,0,7);g.fill();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;const mat=new THREE.MeshLambertMaterial({map:t,polygonOffset:true,polygonOffsetFactor:-1});extra.push(mat);
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
 const Y=HQ.floor,y0=Y+1.62,y1=Y+6.22,h=y1-y0,geos=[];
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
 r.addColorStop(0,'rgba(255,190,110,0.42)');r.addColorStop(.45,'rgba(255,150,60,0.16)');r.addColorStop(1,'rgba(255,140,50,0)');x.fillStyle=r;x.fillRect(0,0,128,128);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const Y=HQ.floor,geos=[];
 const pool=(w,px,py,pz,rx,ry)=>{const g=new THREE.PlaneGeometry(w,w);g.rotateX(rx);g.rotateY(ry);g.translate(px,py,pz);geos.push(g);};
 for(const z of HQ_CHANDELIERS){pool(9,-18.5,Y+.06,z,-Math.PI/2,0);if(!low)pool(6,-18.5,Y+HQ.ceil-.02,z,Math.PI/2,0);}
 for(const [px,pz] of HQ_TORCHES){const s=px<-18?1:-1;pool(4.2,px+s*.03,Y+3.4,pz,0,s*Math.PI/2);pool(4,px+s*1.6,Y+.05,pz,-Math.PI/2,0);}
 pool(10,HQ.board.lx,Y+HQ.dais.rise+.05,-61.8,-Math.PI/2,0);
 const m=new THREE.Mesh(mergeGeometries(geos),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2}));geos.forEach(g=>g.dispose());m.renderOrder=2;group.add(m);}
export function buildPetDress(low=false){const g=buildParts(petParts(),low);g.name='pet_store_L4_dress';
 plaque(g,'assets/pumpfun/pet_sign.webp',5.65,.6,-1.14,PET_LOT.doorY+3.6,-114.76,Math.PI/2);
 plaque(g,'assets/pumpfun/pet_sign.webp',3,.9,-9.09,12.69,-114.761,Math.PI/2);
 plaque(g,'assets/pumpfun/pet_sign.webp',1.6,1.1,-7.69,10.84,-111.1,Math.PI/2);
 return g;}
const usd=v=>v===null||v===undefined?'—':'$'+(Math.abs(v)>=1e6?(v/1e6).toFixed(2)+'M':Math.abs(v)>=1e3?(v/1e3).toFixed(1)+'K':v>=1?v.toFixed(2):v.toPrecision(3));
export function drawHQBoard(cv,state){const g=cv.getContext('2d'),k=cv.width/1536;g.save();g.setTransform(k,0,0,cv.height/384,0,0);const W=1536;
 g.fillStyle='#101f1c';g.fillRect(0,0,W,384);g.strokeStyle='#54d08a';g.lineWidth=5;g.strokeRect(3,3,W-6,378);g.textBaseline='middle';g.textAlign='left';
 const text=(s,x,y,n=27,c='#e9e5d6')=>{g.font=`${n}px "Just Another Hand",sans-serif`;g.fillStyle=c;g.fillText(String(s),x,y);};
 text('PUMPFUN PIRATES / MARKET WATCH',24,24,33,'#54d08a');text('FREE SNAPSHOTS · NOT A LIVE TRADE FEED',925,24,25,'#ffcd77');
 ['SUNK','AHOY','PUMP'].forEach((sym,i)=>{const p=state.prices[sym],x=24+i*500;text('$'+sym+'  '+(p?usd(p.price):state.status.prices==='Loading…'?'Loading…':'Feed offline')+'   '+(p?.cap!=null?'MC '+usd(p.cap):p?.fdv!=null?'FDV '+usd(p.fdv):'MC —'),x,65,29);text((p?.change!=null?(p.change>=0?'+':'')+p.change.toFixed(1)+'% 24h':'24h —')+'   VOL '+usd(p?.volume)+(p?.stale?' · STALE':''),x,98,24,p?.change<0?'#ff817b':'#54d08a');});
 const defs=[['ABOUT TO BOND','bonding','≈ curve progress · GeckoTerminal pump.fun pools'],['TRENDING TOKENS','trending','GeckoTerminal · Pump venues, Solana trending'],['CALLOUT FEED','callouts','Live DexScreener PAID BOOST events · pump.fun']];
 defs.forEach(([title,key,source],i)=>{const x=24+i*500;g.fillStyle='#254038';g.fillRect(x-4,126,482,216);text(title,x+8,149,32,'#ffcd77');text(source,x+8,180,22,'#a8bfb0');
  const rows=state[key].slice(0,3);if(!rows.length){const st=state.status[key]||'Loading…';text(st==='Loading…'?'Loading…':/offline/i.test(st)?'Feed offline':'Nothing to show right now',x+8,226,24);text(/offline/i.test(st)?'Retrying when nearby':'',x+8,261,23,'#a8bfb0');}
  text((state.status[key]||'Loading…').slice(0,58),x+8,326,19,'#a8bfb0');
  rows.forEach((r,n)=>text(`${n+1}. ${r.symbol}  ${key==='bonding'?'≈'+r.progress.toFixed(1)+'% bonded':key==='callouts'?'+'+(r.boost||r.amount)+' boost'+(r.cap!=null?'  MC '+usd(r.cap):''):usd(r.volume)+' vol / 24h'}`,x+8,221+n*39,29));});
 text('E / controller / tap to browse · token links open pump.fun · not financial advice',24,366,25,'#a8bfb0');g.restore();}
export { attachDexPanel, drawDexPanel, dexPanelRow } from './dexpanel.js';
export { attachWallPanels, drawWallPanel, wallPanelMint } from './wallpanels.js';
