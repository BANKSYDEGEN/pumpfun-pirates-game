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
function plankTex(n,dark){const [c,x]=can(n,n),pw=n/4;for(let i=0;i<4;i++){const b=(dark?46:70)+((i*37)%3)*10;x.fillStyle=`rgb(${b+30},${b-12},${b-40})`;x.fillRect(i*pw,0,pw,n);
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
 const parrot=(cx,cy,s,body,wing,bg)=>{const X=cx-128*k,Y=cy-128*k,W=256*k;x.save();x.beginPath();x.rect(X,Y,W,W);x.clip();
  const sky=x.createLinearGradient(0,Y,0,Y+W);sky.addColorStop(0,'#e9c98a');sky.addColorStop(.55,bg);sky.addColorStop(1,'#1c2a1e');x.fillStyle=sky;x.fillRect(X,Y,W,W);
  x.fillStyle='rgba(255,236,190,.55)';x.beginPath();x.arc(X+W*.72,Y+W*.3,W*.12,0,7);x.fill();
  for(let i=0;i<14;i++){const lx=X+((i*53)%256)*k,ly=Y+W*(.55+((i*29)%40)/100),sz=(26+(i*13)%30)*k;x.fillStyle=i%2?'rgba(30,70,40,.85)':'rgba(46,96,52,.8)';x.save();x.translate(lx,ly);x.rotate((i%5-2)*.5);x.beginPath();x.ellipse(0,0,sz*.35,sz,0,0,7);x.fill();x.strokeStyle='rgba(15,40,20,.6)';x.lineWidth=1.2*k;x.beginPath();x.moveTo(0,-sz);x.lineTo(0,sz);x.stroke();x.restore();}
  x.translate(cx,cy);x.scale(k*s,k*s);
  x.strokeStyle='#4a2e18';x.lineWidth=11;x.lineCap='round';x.beginPath();x.moveTo(-110,72);x.quadraticCurveTo(0,58,110,78);x.stroke();
  const tg=x.createLinearGradient(0,40,30,150);tg.addColorStop(0,wing);tg.addColorStop(1,body);x.fillStyle=tg;x.beginPath();x.moveTo(4,40);x.lineTo(30,150);x.lineTo(14,152);x.lineTo(-10,48);x.fill();
  const bg2=x.createRadialGradient(-12,-6,6,0,10,70);bg2.addColorStop(0,'rgba(255,255,255,.35)');bg2.addColorStop(.3,body);bg2.addColorStop(1,'rgba(0,0,0,.5)');
  x.fillStyle=body;x.beginPath();x.ellipse(0,12,34,56,.12,0,7);x.fill();x.fillStyle=bg2;x.beginPath();x.ellipse(0,12,34,56,.12,0,7);x.fill();
  x.fillStyle=body;x.beginPath();x.arc(-6,-48,27,0,7);x.fill();x.fillStyle='rgba(255,255,255,.18)';x.beginPath();x.arc(-14,-56,12,0,7);x.fill();
  x.fillStyle=wing;x.beginPath();x.ellipse(14,16,20,46,.28,0,7);x.fill();x.strokeStyle='rgba(0,0,0,.28)';x.lineWidth=1.6;for(let i=0;i<5;i++){x.beginPath();x.arc(14+i*2,-14+i*13,13,.3,2.6);x.stroke();}
  x.fillStyle='#f6f0e2';x.beginPath();x.ellipse(-20,-48,14,12,-.2,0,7);x.fill();x.strokeStyle='rgba(60,40,40,.5)';x.lineWidth=1;for(const dy of [-4,0,4]){x.beginPath();x.moveTo(-30,-48+dy);x.lineTo(-12,-50+dy);x.stroke();}
  x.fillStyle='#f2d24a';x.beginPath();x.arc(-16,-54,5.5,0,7);x.fill();x.fillStyle='#111';x.beginPath();x.arc(-16,-54,3.2,0,7);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(-17,-55.5,1.1,0,7);x.fill();
  x.fillStyle='#2a2420';x.beginPath();x.moveTo(-30,-58);x.bezierCurveTo(-52,-60,-60,-40,-46,-24);x.quadraticCurveTo(-46,-38,-32,-38);x.fill();x.fillStyle='#4a4038';x.beginPath();x.moveTo(-32,-38);x.quadraticCurveTo(-44,-32,-36,-26);x.lineTo(-28,-34);x.fill();
  x.fillStyle='#6a6058';for(const dx of [-12,8]){x.beginPath();x.ellipse(dx,66,7,5,0,0,7);x.fill();}x.restore();
  const fr=(o,w,c)=>{x.strokeStyle=c;x.lineWidth=w*k;x.strokeRect(X+o*k,Y+o*k,W-2*o*k,W-2*o*k);};fr(7,14,'#7a5a1e');fr(5,5,'#ffd27a');fr(13,3,'#5a3a12');fr(16,1.5,'#e8b860');};
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
 // planked ceiling between the beams (darker, finer boards)
 {const q=new THREE.PlaneGeometry(I.lx1-I.lx0,I.lz1-I.lz0),uv=q.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(I.lx1-I.lx0)/.9,uv.getY(i)*(I.lz1-I.lz0)/2.4);q.rotateX(Math.PI/2);q.translate((I.lx0+I.lx1)/2,C-.012,(I.lz0+I.lz1)/2);add('ceil',q);}
 // bordered rug from the door to the counter
 {const q=new THREE.PlaneGeometry(6.6,2.9);q.rotateX(-Math.PI/2);q.translate(-6.55,F+.025,S.door.lz);add('rug',q);}
 // plank cladding on the stands / rack bases (thin skins over the lit parts)
 for(const [k,x,z,w,d] of PET_PROPS){if(k==='bigcage')box('pk',w+.02,.78,d+.02,x,F+.4,z,.9);if(k==='toyrack')box('pk',w+.02,2.38,.02,x,F+1.2,z+.15,.9);if(k==='counter')box('pk',.02,1.0,d-.1,x+.53,F+.55,z,.9);}
 const T={dam:damaskTex(n),pla:plasterTex(low?128:256),pk:plankTex(low?128:256),rug:rugTex(n,n/2),ceil:plankTex(low?128:256,true),at:atlasTex(low?128:256)};
 for(const k in bins){const geo=mergeGeometries(bins[k]);bins[k].forEach(q=>q.dispose());const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({map:T[k],polygonOffset:k==='rug',polygonOffsetFactor:-1}));m.name='pet_look_'+k;g.add(m);}
 for(const k in T)if(!bins[k])T[k].dispose();}
// [pass 3] sculpted low-poly macaws (shared geometry, one InstancedMesh per part), brass cages (instanced round bars, domed tops,
// finials, seed cups, swings), hanging brass ring perches. Phong brass reuses the scene's existing lights; nothing new is lit.
const PAL=[{body:'#d42a22',wing:'#2a5fd0',band:'#f2c230',tail:'#c8241e',belly:'#d42a22'},   // scarlet: red / blue / yellow
 {body:'#2a6fd8',wing:'#2a62c8',band:'#2a62c8',tail:'#2456b8',belly:'#f2b82a'},              // blue & gold
 {body:'#c8261f',wing:'#2a9a4a',band:'#3fb0e0',tail:'#2a5fd0',belly:'#c8261f'}];             // green-wing
function parrotParts(low){const S=(r,ws=8,hs=6)=>new THREE.SphereGeometry(r,ws,hs),out=[],P=(geo,col,ex)=>{if(ex)ex(geo);out.push([geo,col]);};
 const m=(g,{sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,x=0,y=0,z=0})=>{g.scale(sx,sy,sz);g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);return g;};
 P(m(S(.085,low?6:9,low?5:7),{sy:1.45,rz:-.28,x:-.005,y:.17}),'body');
 P(m(S(.06,low?6:8,5),{sx:.75,sy:1.25,sz:.9,rz:-.2,x:.035,y:.15}),'belly');
 P(m(S(.066,low?6:9,low?5:7),{sx:1.05,y:.33,x:.035}),'body');
 // hooked beak: tapered upper mandible curling down + a short lower mandible
 {const u=new THREE.ConeGeometry(.032,.085,low?5:7);m(u,{rz:-2.25,x:.1,y:.315});P(u,'beak');const t=new THREE.ConeGeometry(.016,.05,5);m(t,{rz:-3.0,x:.122,y:.27});P(t,'beak');}
 P(m(S(.024,6,4),{sx:1.2,sy:.7,x:.085,y:.29}),'beakL');
 const pair=(f)=>mergeGeometries([f(1),f(-1)]);
 P(pair(s=>m(S(.026,6,5),{sx:.6,sy:1.1,x:.07,y:.335,z:s*.042})),'face');
 if(!low)P(pair(s=>m(S(.011,6,4),{x:.082,y:.345,z:s*.05})),'eye');
 P(pair(s=>m(S(.075,low?6:8,5),{sx:.55,sy:1.7,sz:.32,rz:-.35,ry:s*.12,x:-.03,y:.17,z:s*.072})),'wing');
 P(pair(s=>m(S(.05,6,4),{sx:.5,sy:.9,sz:.3,rz:-.35,x:-.02,y:.22,z:s*.082})),'band');
 {const t=new THREE.ConeGeometry(.045,.42,4);m(t,{sz:.45,rz:-2.85,x:-.1,y:-.09});P(t,'tail');const t2=new THREE.ConeGeometry(.03,.3,4);m(t2,{sz:.45,rz:-2.95,x:-.13,y:-.14});P(t2,'wing');}
 if(!low)P(mergeGeometries([1,-1].map(s=>{const g=new THREE.TorusGeometry(.024,.008,4,8,Math.PI*1.3);g.rotateZ(-.15);return m(g,{x:.0,y:-.005,z:s*.03});})),'foot');
 return out;}
const col=(pal,key)=>key==='beak'?'#2a2420':key==='beakL'?'#3a3430':key==='face'?'#f4eee2':key==='eye'?'#111111':key==='foot'?'#5a5550':PAL[pal][key];
export function petParrots(g,list,low){const items=low?list.filter((_,i)=>i%2===0):list;if(!items.length)return;const parts=parrotParts(low),M=new THREE.Matrix4(),Q=new THREE.Quaternion(),E=new THREE.Euler(),V=new THREE.Vector3(),ONE=new THREE.Vector3(1,1,1),c=new THREE.Color();
 for(const [geo,key] of parts){const mat=new THREE.MeshLambertMaterial({color:0xffffff}),im=new THREE.InstancedMesh(geo,mat,items.length);im.name='pet_parrot_'+key;
  items.forEach(([x,y,z,ry,pal],i)=>{M.compose(V.set(x,y,z),Q.setFromEuler(E.set(0,ry,0)),ONE);im.setMatrixAt(i,M);im.setColorAt(i,c.set(col(pal,key)));});
  im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;g.add(im);}}
export function petBrass(g,props,rings,F,C,low){const brass=new THREE.MeshPhongMaterial({color:0xc8962e,specular:0xffe7a8,shininess:70,emissive:0x2a1a04}),seg=low?4:6,geos=[],M=new THREE.Matrix4(),bars=[];
 const put=(geo,x,y,z,rx=0,ry=0,rz=0)=>{geo.rotateX(rx);geo.rotateZ(rz);geo.rotateY(ry);geo.translate(x,y,z);for(const k of Object.keys(geo.attributes))if(k!=='position'&&k!=='normal')geo.deleteAttribute(k);geos.push(geo.index?geo.toNonIndexed():geo);};
 const cage=(x,z,R,y0,y1,nb)=>{for(let i=0;i<nb;i++){const a=i/nb*Math.PI*2;bars.push([x+Math.cos(a)*R,(y0+y1)/2,z+Math.sin(a)*R,y1-y0,0,0]);
   bars.push([x+Math.cos(a)*R*.5,y1+R*.43,z+Math.sin(a)*R*.5,R*1.0,a,1]);}   // vertical bar + dome rib
  for(const y of [y0,y0+.05,(y0+y1)/2,y1])put(new THREE.TorusGeometry(R,.016,4,low?16:28),x,y,z,Math.PI/2);
  put(new THREE.SphereGeometry(R*.32,low?8:12,6,0,Math.PI*2,0,Math.PI/2),x,y1+R*.9,z);put(new THREE.TorusGeometry(R*.3,.02,4,14),x,y1+R*.9,z,Math.PI/2);
  put(new THREE.CylinderGeometry(.025,.05,.14,8),x,y1+R+.07,z);put(new THREE.SphereGeometry(.055,10,8),x,y1+R+.19,z);put(new THREE.TorusGeometry(.05,.01,4,10),x,y1+R+.27,z);
  put(new THREE.CylinderGeometry(.07,.055,.06,10,1,true),x+R*.7,y0+.35,z);   // seed cup
  const sw=y1-.08,sb=y0+.42;for(const s of [-1,1])put(new THREE.CylinderGeometry(.005,.005,sw-sb,4),x-R*.25,(sw+sb)/2,z+s*.12);put(new THREE.CylinderGeometry(.012,.012,.26,6),x-R*.25,sb,z,Math.PI/2);};   // swing
 for(const [k,x,z,w,d] of props){if(k==='cage')cage(x,z,.43,F+.86,F+1.86,low?10:16);if(k==='bigcage')cage(x,z,Math.min(w,d)/2-.06,F+.9,F+2.35,low?12:22);}
 for(const [x,z] of rings){put(new THREE.TorusGeometry(.36,.018,5,low?16:28),x,C-2.47,z);put(new THREE.SphereGeometry(.03,8,6),x,C-2.1,z);}
 // ribs: vertical bars use a unit cylinder scaled in y; dome ribs are a quarter arc rotated to face out
 const bar=new THREE.CylinderGeometry(.011,.011,1,seg);
 for(const [x,y,z,h,a,rib] of bars){if(!rib){const q=bar.clone();q.scale(1,h,1);put(q,x,y,z);}else{const R=h,q=new THREE.TorusGeometry(R,.01,seg-1,8,Math.PI/2);q.translate(0,0,0);// arc from rim (R,0) to apex (0,R)
   q.rotateY(-a);q.translate(x-Math.cos(a)*R*.5,y-R*.43,z-Math.sin(a)*R*.5);for(const k of Object.keys(q.attributes))if(k!=='position'&&k!=='normal')q.deleteAttribute(k);geos.push(q.index?q.toNonIndexed():q);}}
 bar.dispose();const m=new THREE.Mesh(mergeGeometries(geos),brass);geos.forEach(q=>q.dispose());m.name='pet_brass';g.add(m);}
