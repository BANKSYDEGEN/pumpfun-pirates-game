// [post-petstore pass 2] pet store surfaces: canvas textures (<=512 px, halved on phones), lit Lambert, merged per texture, no lights.
// Green-gold damask over the wainscot, plaster frieze, plank-backed supply wall with stocked shelves, parrot portraits in gilt frames,
// bordered rug, plank texture on the stands. Everything here is near-only and disposed with the dress.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PET_STORE, PET_PROPS } from './site.js';
const can=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];};
const tex=(c,rep=true)=>{const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;if(rep)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;};
const rnd=(s=>()=>(s=(s*16807)%2147483647)/2147483647)(7);
function damaskTex(n){const [c,x]=can(n,n),k=n/512;x.fillStyle='#24453a';x.fillRect(0,0,n,n);
 const med=(cx,cy,s)=>{x.save();x.translate(cx*k,cy*k);x.scale(k*s,k*s);x.fillStyle='#2f5a4a';x.beginPath();x.moveTo(0,-118);x.bezierCurveTo(70,-80,92,-20,0,118);x.bezierCurveTo(-92,-20,-70,-80,0,-118);x.fill();
  x.fillStyle='#3a6a56';for(const sy of [-1,1]){x.beginPath();x.moveTo(0,sy*20);x.bezierCurveTo(40,sy*40,60,sy*90,0,sy*104);x.bezierCurveTo(-60,sy*90,-40,sy*40,0,sy*20);x.fill();}
  x.strokeStyle='rgba(214,174,84,0.6)';x.lineWidth=2.4;x.beginPath();x.moveTo(0,-118);x.bezierCurveTo(70,-80,92,-20,0,118);x.bezierCurveTo(-92,-20,-70,-80,0,-118);x.stroke();
  x.fillStyle='rgba(222,180,90,0.75)';x.beginPath();x.arc(0,0,14,0,7);x.fill();x.restore();};
 for(const [cx,cy] of [[128,128],[384,384],[384,-128],[128,640],[-128,384],[640,384]])med(cx,cy,1);
 for(const [cx,cy] of [[384,128],[128,384],[384,640],[640,128],[-128,128],[128,-128]])med(cx,cy,.4);
 x.fillStyle='rgba(222,180,90,0.35)';for(let i=0;i<=n;i+=n/4)x.fillRect(i-1,0,2*k,n);return tex(c);}
function plasterTex(n){const [c,x]=can(n,n);x.fillStyle='#d9c9a8';x.fillRect(0,0,n,n);for(let i=0;i<n*n/40;i++){const v=rnd();x.fillStyle=v<.5?'rgba(120,96,60,0.07)':'rgba(255,248,230,0.09)';x.fillRect(rnd()*n,rnd()*n,1+rnd()*4,1+rnd()*3);}
 x.strokeStyle='rgba(110,86,52,0.18)';x.lineWidth=1;for(let i=0;i<6;i++){x.beginPath();let px=rnd()*n,py=rnd()*n;x.moveTo(px,py);for(let j=0;j<5;j++){px+=(rnd()-.5)*30;py+=rnd()*20;x.lineTo(px,py);}x.stroke();}return tex(c);}
function plankTex(n){const [c,x]=can(n,n),pw=n/4;for(let i=0;i<4;i++){const b=70+((i*37)%3)*10;x.fillStyle=`rgb(${b+30},${b-12},${b-40})`;x.fillRect(i*pw,0,pw,n);
  for(let j=0;j<40;j++){x.strokeStyle=`rgba(40,20,8,${.08+rnd()*.15})`;x.lineWidth=.6+rnd()*1.2;const gx=i*pw+rnd()*pw;x.beginPath();x.moveTo(gx,0);x.bezierCurveTo(gx+(rnd()-.5)*8,n/3,gx+(rnd()-.5)*8,2*n/3,gx+(rnd()-.5)*6,n);x.stroke();}
  x.fillStyle='rgba(20,10,4,0.75)';x.fillRect(i*pw,0,2,n);const nk=rnd()*n;x.fillRect(i*pw+pw/2-3,(nk+n/2)%n,0,0);x.fillStyle='rgba(30,16,8,.6)';for(const y of [n*.12,n*.88]){x.beginPath();x.arc(i*pw+pw*.25,y,2.2,0,7);x.arc(i*pw+pw*.75,y,2.2,0,7);x.fill();}}return tex(c);}
function rugTex(w,h){const [c,x]=can(w,h),k=w/512;x.fillStyle='#1f2b44';x.fillRect(0,0,w,h);x.fillStyle='#8a1e24';x.fillRect(22*k,22*k,w-44*k,h-44*k);
 x.fillStyle='#d6a64a';x.fillRect(16*k,16*k,w-32*k,4*k);x.fillRect(16*k,h-20*k,w-32*k,4*k);x.fillRect(16*k,16*k,4*k,h-32*k);x.fillRect(w-20*k,16*k,4*k,h-32*k);
 x.strokeStyle='#d6a64a';x.lineWidth=2.5*k;x.strokeRect(30*k,30*k,w-60*k,h-60*k);
 for(let i=40;i<512-40;i+=16){x.fillStyle=(i/16)%2?'#d6a64a':'#c46a2e';x.save();x.translate(i*k,11*k);x.rotate(.785);x.fillRect(-3*k,-3*k,6*k,6*k);x.restore();x.save();x.translate(i*k,h-11*k);x.rotate(.785);x.fillRect(-3*k,-3*k,6*k,6*k);x.restore();}
 x.save();x.translate(w/2,h/2);x.fillStyle='#1f2b44';x.beginPath();x.ellipse(0,0,70*k,46*k,0,0,7);x.fill();x.strokeStyle='#d6a64a';x.lineWidth=3*k;x.stroke();x.fillStyle='#c46a2e';x.beginPath();x.ellipse(0,0,36*k,22*k,0,0,7);x.fill();x.restore();
 for(const sx of [-1,1]){x.save();x.translate(w/2+sx*150*k,h/2);x.strokeStyle='#d6a64a';x.lineWidth=2*k;x.beginPath();x.moveTo(-26*k,0);x.lineTo(0,-28*k);x.lineTo(26*k,0);x.lineTo(0,28*k);x.closePath();x.stroke();x.restore();}
 for(let i=0;i<w*h/30;i++){x.fillStyle=`rgba(0,0,0,${rnd()*.08})`;x.fillRect(rnd()*w,rnd()*h,1,1);}return tex(c,false);}
// atlas 4x2 cells: 0-4 parrot portraits, 5 cuttlebone/seed label sheet, 6-7 seed tin + feed box labels
function atlasTex(n){const [c,x]=can(n*4,n*2),k=n/256;
 const parrot=(cx,cy,s,body,wing,bg)=>{x.fillStyle=bg;x.fillRect(cx-128*k,cy-128*k,256*k,256*k);const gr=x.createRadialGradient(cx,cy-20*k,10*k,cx,cy,170*k);gr.addColorStop(0,'rgba(255,230,170,.25)');gr.addColorStop(1,'rgba(0,0,0,.35)');x.fillStyle=gr;x.fillRect(cx-128*k,cy-128*k,256*k,256*k);
  x.save();x.translate(cx,cy);x.scale(k*s,k*s);x.fillStyle='#5a3a22';x.fillRect(-90,62,180,12);
  x.fillStyle=wing;x.beginPath();x.moveTo(10,40);x.lineTo(40,120);x.lineTo(-5,110);x.fill();
  x.fillStyle=body;x.beginPath();x.ellipse(0,10,36,58,.15,0,7);x.fill();x.beginPath();x.arc(-6,-50,28,0,7);x.fill();
  x.fillStyle=wing;x.beginPath();x.ellipse(12,14,20,44,.25,0,7);x.fill();
  x.fillStyle='#f4ecd8';x.beginPath();x.ellipse(-16,-52,12,10,0,0,7);x.fill();x.fillStyle='#111';x.beginPath();x.arc(-16,-52,4,0,7);x.fill();
  x.fillStyle='#2a2420';x.beginPath();x.moveTo(-28,-44);x.quadraticCurveTo(-52,-36,-34,-20);x.quadraticCurveTo(-30,-32,-24,-34);x.fill();
  x.fillStyle='#e8c070';for(const dx of [-12,10]){x.fillRect(dx,62,6,10);}x.restore();
  x.strokeStyle='#8a6a2a';x.lineWidth=14*k;x.strokeRect(cx-121*k,cy-121*k,242*k,242*k);x.strokeStyle='#ffd27a';x.lineWidth=6*k;x.strokeRect(cx-121*k,cy-121*k,242*k,242*k);x.strokeStyle='#5a3a12';x.lineWidth=2*k;x.strokeRect(cx-110*k,cy-110*k,220*k,220*k);};
 const P=[['#d8262a','#2a6fd8','#3b4a3a'],['#2ea84a','#f2c230','#4a3a2e'],['#2a6fd8','#f2d24a','#3a2e44'],['#f2c230','#2ea84a','#2e3a4a'],['#e8e2d4','#f2c230','#4a2e2e']];
 P.forEach(([b,w,bg],i)=>parrot((i%4)*256*k+128*k,Math.floor(i/4)*256*k+128*k,1.15,b,w,bg));
 const label=(x0,y0,w,h,bg,fg,t1,t2)=>{x.fillStyle=bg;x.fillRect(x0*k,y0*k,w*k,h*k);x.strokeStyle=fg;x.lineWidth=3*k;x.strokeRect((x0+5)*k,(y0+5)*k,(w-10)*k,(h-10)*k);x.fillStyle=fg;x.textAlign='center';x.font=`bold ${22*k}px Georgia,serif`;x.fillText(t1,(x0+w/2)*k,(y0+h/2)*k);x.font=`${13*k}px Georgia,serif`;x.fillText(t2,(x0+w/2)*k,(y0+h/2+20)*k);};
 label(256,256,128,128,'#c9a64a','#4a2412','SEED','MIX');label(384,256,128,128,'#2e6b55','#f4e2b0','MILLET','SPRAY');label(256,384,128,128,'#7a1d22','#f4e2b0','PARROT','FEAST');label(384,384,128,128,'#1f2b44','#e8c070','NUT','TREATS');
 for(let i=0;i<4;i++)label(512+(i%2)*128,256+Math.floor(i/2)*128,128,128,['#e8dcc0','#d6a64a','#b5653a','#3a6a56'][i],'#3a1e0e',['CUTTLE','PELLETS','FRUIT','TOYS'][i],'BONE & CO'.slice(0,i===0?9:0)||'FINEST');
 x.fillStyle='#3a2414';x.fillRect(768*k,256*k,256*k,256*k);x.fillStyle='#e8c070';x.textAlign='center';x.font=`bold ${30*k}px Georgia,serif`;x.fillText('PARROTS',896*k,350*k);x.font=`italic ${20*k}px Georgia,serif`;x.fillText('of the Seven Seas',896*k,390*k);x.strokeStyle='#e8c070';x.lineWidth=3*k;x.strokeRect(778*k,266*k,236*k,236*k);
 return tex(c,false);}
const cell=(i)=>[(i%4)/4,1-Math.floor(i/4)/2-.5,.25,.5];
export function petLook(g,low){const S=PET_STORE,F=S.floor,C=F+S.ceil,I=S.I,n=low?256:512,bins={},add=(k,geo)=>(bins[k]||(bins[k]=[])).push(geo);
 const plane=(k,w,h,x,y,z,ry,tile,uvr)=>{const q=new THREE.PlaneGeometry(w,h),uv=q.attributes.uv;for(let i=0;i<uv.count;i++){if(uvr)uv.setXY(i,uvr[0]+uv.getX(i)*uvr[2],uvr[1]+uv.getY(i)*uvr[3]);else uv.setXY(i,uv.getX(i)*w/tile,uv.getY(i)*h/tile);}q.rotateY(ry);q.translate(x,y,z);add(k,q);};
 const box=(k,w,h,d,x,y,z,tile)=>{const q=new THREE.BoxGeometry(w,h,d);q.translate(x,y,z);const P=q.attributes.position,N=q.attributes.normal,uv=q.attributes.uv;for(let i=0;i<P.count;i++){const ax=Math.abs(N.getX(i)),ay=Math.abs(N.getY(i));const [u,v]=ax>.5?[P.getZ(i),P.getY(i)]:ay>.5?[P.getX(i),P.getZ(i)]:[P.getX(i),P.getY(i)];uv.setXY(i,u/tile,v/tile);}add(k,q);};
 const y0=F+1.42,y1=F+5.4,ym=(y0+y1)/2,h=y1-y0,dz0=S.door.lz-S.door.w/2-.3,dz1=S.door.lz+S.door.w/2+.3,o=.075;
 // damask over the wainscot, plaster frieze above (side walls, front wall split around the arch, back wall above the supply shelves)
 for(const [z,ry] of [[I.lz0+o,0],[I.lz1-o,Math.PI]]){plane('dam',I.lx1-I.lx0,h,(I.lx0+I.lx1)/2,ym,z,ry,1.6);plane('pla',I.lx1-I.lx0,C-y1-.05,(I.lx0+I.lx1)/2,(y1+C)/2,z,ry,2.2);}
 for(const [a,b] of [[I.lz0,dz0],[dz1,I.lz1]]){plane('dam',b-a,h,I.lx1-o,ym,(a+b)/2,-Math.PI/2,1.6);plane('pla',b-a,C-y1-.05,I.lx1-o,(y1+C)/2,(a+b)/2,-Math.PI/2,2.2);}
 plane('pla',dz1-dz0,C-F-4.5,I.lx1-o,(F+4.5+C)/2,S.door.lz,-Math.PI/2,2.2);
 plane('dam',I.lz1-I.lz0,h,I.lx0+o,ym,(I.lz0+I.lz1)/2,Math.PI/2,1.6);plane('pla',I.lz1-I.lz0,C-y1-.05,I.lx0+o,(y1+C)/2,(I.lz0+I.lz1)/2,Math.PI/2,2.2);
 // supply wall behind the counter: plank backing, three stocked shelves above the shelf unit (around the carved sign)
 const sz0=-117.6,sz1=-110.5,sx=I.lx0+.1;plane('pk',sz1-sz0,2.6,sx,F+4.1,(sz0+sz1)/2,Math.PI/2,1.2);
 for(const y of [F+4.25,F+5.05]){box('pk',.36,.06,sz1-sz0,sx+.18,y,(sz0+sz1)/2,1.2);for(const zz of [sz0+.3,(sz0+sz1)/2,sz1-.3])box('pk',.3,.22,.05,sx+.15,y-.14,zz,1.2);
  for(let i=0;i<14;i++){const zz=sz0+.35+i*(sz1-sz0-.7)/13,tin=i%3!==1,lab=6+(i%4)%2+((i>>2)%2)*0;const ci=5+(i%4);const ww=tin?.22:.3,hh=tin?.3:.42;
   const [u,v,uw,vh]=cell(ci<8?ci:5);const sub=(i%2)*.5,suv=[u+(i%4>1?uw/2:0),v+((i%2)?vh/2:0),uw/2,vh/2];plane('at',ww,hh,sx+.36,y+.03+hh/2,zz,Math.PI/2,0,i%7===3?cell(7):suv);box('pk',.2,hh,ww,sx+.25,y+.03+hh/2,zz,.6);}}
 // portraits: two per side wall, one each side of the arch inside the front wall
 const pz=[[-13.0,I.lz0+.09,0,0],[-8.4,I.lz0+.09,0,1],[-13.0,I.lz1-.09,Math.PI,2],[-8.4,I.lz1-.09,Math.PI,3],[-4.4,I.lz1-.09,Math.PI,4]];
 for(const [x,z,ry,i] of pz)plane('at',1.15,1.15,x,F+3.3,z,ry,0,cell(i));
 plane('at',1.0,1.0,I.lx1-.09,F+3.1,I.lz0+1.1,-Math.PI/2,0,cell(7));
 // bordered rug from the door to the counter
 {const q=new THREE.PlaneGeometry(6.6,2.9);q.rotateX(-Math.PI/2);q.translate(-6.55,F+.025,S.door.lz);add('rug',q);}
 // plank cladding on the stands / rack bases (thin skins over the lit parts)
 for(const [k,x,z,w,d] of PET_PROPS){if(k==='bigcage')box('pk',w+.02,.78,d+.02,x,F+.4,z,.9);if(k==='toyrack')box('pk',w+.02,2.38,.02,x,F+1.2,z+.15,.9);if(k==='counter')box('pk',.02,1.0,d-.1,x+.53,F+.55,z,.9);}
 const T={dam:damaskTex(n),pla:plasterTex(low?128:256),pk:plankTex(low?128:256),rug:rugTex(n,n/2),at:atlasTex(low?128:256)};
 for(const k in bins){const geo=mergeGeometries(bins[k]);bins[k].forEach(q=>q.dispose());const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({map:T[k],polygonOffset:k==='rug',polygonOffsetFactor:-1}));m.name='pet_look_'+k;g.add(m);}
 for(const k in T)if(!bins[k])T[k].dispose();}
