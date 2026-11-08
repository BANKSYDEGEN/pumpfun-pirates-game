// Shared low-poly geometry description: runtime + Blender approval renders use these exact parts.
import { HQ, HQ_TOWERS, HQ_PILLARS, PET_LOT, petFloor } from './site.js';
const stone = '#c9bfae', darkStone = '#8a837a', wood = '#4a3023', green = '#54d08a', roof = '#c8552e', gold = '#ffcd77', iron = '#2b2a28', flame = '#ffb347', candle = '#f3e6c4', bone = '#e8e0cc', mahog = '#5a2a1a', crimson = '#7a1d22';
export function hqParts() {
  // [post-hq-castle] BANKSY t261u: ONE hall over the whole footprint (lx -33..-4, lz -65..-30), pirate-fortress stone outside,
  // casino-style warm interior (mahogany wainscot, gilded beamed ceiling, iron chandeliers, painted light pools in render.js).
  const p = [], mat=c=>c===stone?11:c===darkStone?22:c===wood?26:c===roof?4:0;
  const B = (x,y,z,w,h,d,c,detail=false,ex) => p.push({ kind:'box', x,y,z,w,h,d,c,detail,mat:mat(c),...ex });
  const Cy = (x,y,z,r,r1,h,n,c,detail=false) => p.push({ kind:'cyl', x,y,z,r,r1,h,n,c,detail,mat:mat(c) });
  const Y=HQ.floor, TOP=Y+HQ.wallTop, CEIL=Y+HQ.ceil, X0=HQ.lx0, X1=HQ.lx1, Z0=HQ.lz0, Z1=HQ.lz1, CX=(X0+X1)/2, CZ=(Z0+Z1)/2, D=Z1-Z0;
  const HD=HQ.hillDoor, hz0=HD.lz-HD.w/2, hz1=HD.lz+HD.w/2;
  B(CX,Y-.03,CZ,28.8,.12,D-.6,'#5b3b26',false,{mat:26}); // dark oiled deck planks // one floor, wall to wall
  // ---- outer walls, full height (no rear mass: the back half is part of the hall) ----
  const WH=TOP-(Y-.6), WY=(TOP+Y-.6)/2;
  B(X0+.3,WY,CZ,.6,WH,D,stone); B(CX,WY,Z0+.3,X1-X0,WH,.6,stone);
  B(X1-.5,WY,(Z1+hz1)/2,1.0,WH,Z1-hz1,stone); B(X1-.5,WY,(hz0+Z0)/2,1.0,WH,hz0-Z0,stone);   // east wall 1 m: inner face on the terrain grid line
  B(X1-.5,(TOP+Y+HD.h)/2,HD.lz,1.0,TOP-Y-HD.h,HD.w,stone);
  for (const x of [-27.25,-9.75]) B(x,WY,Z1-.3,11.5,WH,.6,stone);
  // ---- dock plaza gate: 6 m opening, round stone arch (voussoirs), iron portcullis raised in the arch ----
  const GW=HQ.door.w, GS=Y+4.6, GR=GW/2;
  for(let i=0;i<14;i++){const x0=-GR+i*GW/14+GW/28, yy=GS+Math.sqrt(Math.max(0,GR*GR-x0*x0)); B(HQ.door.lx+x0,(yy+TOP)/2,Z1-.3,GW/14+.01,TOP-yy,.6,stone);}
  for(let i=0;i<11;i++){const a=Math.PI*(i+.5)/11; B(HQ.door.lx+Math.cos(a)*(GR+.3),GS+Math.sin(a)*(GR+.3),Z1+.05,.75,.5,.8,darkStone,false,{rz:a-Math.PI/2});}
  for(const s of [-1,1]) B(HQ.door.lx+s*(GR+.3),Y+2.3,Z1+.05,.8,4.6,.8,darkStone);
  for(let i=-5;i<=5;i++){const x0=i*.5, yy=GS+Math.sqrt(Math.max(0,GR*GR-x0*x0))-.2; if(yy>Y+6.8)B(HQ.door.lx+x0,(yy+Y+6.7)/2,Z1-.05,.08,yy-Y-6.7,.08,iron,true);}
  for(const y of [Y+6.85,Y+7.3]) B(HQ.door.lx,y,Z1-.05,2*Math.sqrt(GR*GR-(y-GS)**2)-.3,.08,.08,iron,true);
  // ---- Hill Street door (east wall): dressed jambs, lintel, iron-strapped timber leaves folded open inside ----
  for(const s of [-1,1]) { B(X1-.4,Y+HD.h/2,HD.lz+s*(HD.w/2+.25),1.3,HD.h,.5,darkStone); B(X1-1.6,Y+HD.h/2-.3,HD.lz+s*(HD.w/2-.05),2.0,HD.h-.6,.12,wood,true); }
  B(X1-.4,Y+HD.h+.3,HD.lz,1.3,.6,HD.w+1.1,darkStone); B(X1+.5,Y+HD.h+1.4,HD.lz,.12,1.5,HD.w*.7,'#1b4d36'); B(X1+.57,Y+HD.h+1.4,HD.lz,.05,.9,.9,gold);
  // ---- fortress exterior: plinth, string course, crenellated parapet on all four walls, flat lead-and-stone roof ----
  B(CX,Y+.6,Z1+.12,X1-X0+.3,1.4,.3,darkStone); B(X0-.1,Y+.6,CZ,.3,1.4,D,darkStone);
  for(const [x,z,w,d] of [[CX,Z1+.1,X1-X0+.4,.4],[CX,Z0-.1,X1-X0+.4,.4],[X0-.1,CZ,.4,D+.4],[X1+.1,CZ,.4,D+.4]]) { B(x,TOP-1.6,z,w,.35,d,darkStone); B(x,TOP+.1,z,w,.4,d,darkStone); }
  B(CX,TOP-.6,CZ,X1-X0-1,.4,D-1,darkStone);
  const mer=(x0,z0,x1,z1)=>{const L=Math.hypot(x1-x0,z1-z0),n=Math.floor(L/1.8);for(let i=0;i<n;i++){const t=(i+.5)/n;B(x0+(x1-x0)*t,TOP+.95,z0+(z1-z0)*t,Math.abs(x1-x0)>1?.95:.75,1.3,Math.abs(x1-x0)>1?.75:.95,stone);}};
  mer(X0+.4,Z1-.1,X1-.4,Z1-.1); mer(X0+.4,Z0+.1,X1-.4,Z0+.1); mer(X0+.1,Z0+.5,X0+.1,Z1-.5); mer(X1-.1,Z0+.5,X1-.1,Z1-.5);
  // front corner gun towers (round, battered base, crenellated crown, no fairy-tale cones) + rear corner bartizans
  for(const t of HQ_TOWERS){ Cy(t.lx,(TOP+2.2+Y-.4)/2,t.lz,t.r,t.r+.2,TOP+2.2-Y+.4,16,stone); Cy(t.lx,Y+.8,t.lz,t.r+.45,t.r+.6,1.8,16,darkStone);
    Cy(t.lx,TOP+2.4,t.lz,t.r+.35,t.r+.35,.45,16,darkStone); for(let i=0;i<8;i++){const a=i/8*Math.PI*2;B(t.lx+Math.cos(a)*(t.r+.1),TOP+3.25,t.lz+Math.sin(a)*(t.r+.1),.8,1.25,.8,stone,false,{ry:-a});}
    for(const y of [Y+6.5,Y+10.5]) { B(t.lx,y,t.lz+t.r+.05,.75,1.95,.22,darkStone); B(t.lx,y+1.05,t.lz+t.r+.1,.9,.22,.3,darkStone); B(t.lx,y,t.lz+t.r+.17,.2,1.35,.04,'#3a2a1c'); B(t.lx,y,t.lz+t.r+.19,.05,1.35,.03,iron,true); } // framed arrow slits
    B(t.lx,TOP+5.2,t.lz,.12,4,.12,wood,true); B(t.lx+.9,TOP+6.5,t.lz,1.7,1.1,.04,'#141414',true); B(t.lx+.9,TOP+6.55,t.lz+.03,.5,.5,.03,bone,true); }
  for(const [x,z] of [[X0+.4,Z0+.4],[X1-.4,Z0+.4]]) { Cy(x,TOP-1.6,z,1.5,.4,2,12,darkStone); Cy(x,TOP+.7,z,1.5,1.5,2.6,12,stone); for(let i=0;i<6;i++){const a=i/6*Math.PI*2;B(x+Math.cos(a)*1.35,TOP+2.4,z+Math.sin(a)*1.35,.6,.9,.6,stone,false,{ry:-a});} }
  // side-wall arrow-slit lancets (glazed both faces) + front banners flanking the gate
  for(const z of [-36,-42,-54,-60]) for(const x of [X0+.3,X1-.5]) { const t=x>-10?1.12:.72; B(x,Y+8.4,z,t,3.2,1.0,'#33505f'); B(x,Y+10.1,z,t+.08,.3,1.4,darkStone); B(x,Y+6.7,z,t+.08,.3,1.4,darkStone); }
  for(const x of [-24.6,-12.4]) { B(x,Y+4.2,Z1+.2,1.7,5.2,.06,'#1b4d36'); B(x,Y+6.85,Z1+.25,1.95,.18,.18,gold); B(x,Y+4.6,Z1+.24,.9,.9,.04,gold); B(x,Y+1.75,Z1+.22,1.7,.3,.05,gold); }
  B(-18.5,Y+9.4,Z1+.18,19.4,2.4,.25,wood); for (const y of [Y+8.18,Y+10.62]) B(-18.5,y,Z1+.3,19.6,.1,.18,gold); // HQ sign board
  // ---- interior: mahogany wainscot, gilded beamed ceiling on two stone arcades, dais under the big board ----
  const IX0=X0+.6, IX1=X1-1.0, IZ0=Z0+.6, IZ1=Z1-.6;
  for(const [x,z,w,d] of [[IX0+.06,CZ,.12,IZ1-IZ0],[CX,IZ0+.06,IX1-IX0,.12]]) { B(x,Y+.75,z,w,1.5,d,mahog,true); B(x,Y+1.55,z,w+.06,.1,d+.06,gold,true); B(x,Y+.08,z,w+.08,.16,d+.08,'#2a160d',true); }
  for(const [z0,z1] of [[IZ0,hz0],[hz1,IZ1]]) { const z=(z0+z1)/2,d=z1-z0; B(IX1-.06,Y+.75,z,.12,1.5,d,mahog,true); B(IX1-.06,Y+1.55,z,.18,.1,d,gold,true); }
  for(const x of [-27.25,-9.75]) { B(x+(x<-18?-.3:.3),Y+.75,IZ1-.06,10.9,1.5,.12,mahog,true); B(x+(x<-18?-.3:.3),Y+1.55,IZ1-.06,10.9,.1,.18,gold,true); }
  B(CX,CEIL+.18,CZ,IX1-IX0,.35,IZ1-IZ0,wood); // timber ceiling
  for(let z=IZ1-2.2;z>IZ0+1;z-=4.2){ B(CX,CEIL-.3,z,IX1-IX0,.6,.45,wood); B(CX,CEIL-.62,z,IX1-IX0,.06,.5,gold,true);
    for(const s of [-1,1]) { B(CX+s*(IX1-IX0)/2-s*.25,CEIL-1.0,z,.5,.8,.5,darkStone,true); B(CX+s*((IX1-IX0)/2-.9),CEIL-1.3,z,.22,2.0,.22,wood,true,{rz:s*.75}); } }
  for(const x of [-24.5,-12.5]) { B(x,CEIL-.9,CZ,.5,.5,IZ1-IZ0,wood); B(x,CEIL-1.17,CZ,.56,.05,IZ1-IZ0,gold,true); }
  for(const q of HQ_PILLARS) { B(q.lx,Y+(HQ.ceil-1.15)/2,q.lz,1.0,HQ.ceil-1.15,1.0,stone); B(q.lx,Y+.3,q.lz,1.3,.6,1.3,darkStone); B(q.lx,CEIL-1.35,q.lz,1.35,.4,1.35,darkStone);
    B(q.lx,Y+1.3,q.lz,1.04,.08,1.04,gold,true); }
  // long crimson runner from the plaza gate to the dais, cross runner from the Hill Street door
  B(-18.5,Y+.035,(IZ1+HQ.dais.lz1)/2,3.2,.05,IZ1-HQ.dais.lz1,crimson,true); for(const s of [-1,1]) B(-18.5+s*1.62,Y+.04,(IZ1+HQ.dais.lz1)/2,.12,.05,IZ1-HQ.dais.lz1,gold,true);
  B((-18.5+IX1)/2+.8,Y+.03,HD.lz,IX1+18.5-1.6,.05,2.6,crimson,true);
  // dais + board wall
  const DZ=(HQ.dais.lz0+HQ.dais.lz1)/2; B(CX,Y+HQ.dais.rise/2,DZ,IX1-IX0,HQ.dais.rise,HQ.dais.lz1-HQ.dais.lz0,darkStone); B(CX,Y+HQ.dais.rise+.02,DZ,IX1-IX0,.04,HQ.dais.lz1-HQ.dais.lz0-.2,'#3a2418',true);
  B(CX,Y+HQ.dais.rise-.05,HQ.dais.lz1+.05,IX1-IX0,.1,.12,gold,true);
  // big painted portraits (gilt frames, dark oil grounds) between the lancets, casino-style
  for(const z of [-39,-51,-57]) for(const s of [-1,1]) { const x=s<0?IX0+.1:IX1-.1; if(s>0&&Math.abs(z-HD.lz)<4)continue; if(s<0&&z>-46)continue; B(x,Y+4.6,z,.1,2.8,2.2,gold,true); B(x+(s<0?.04:-.04),Y+4.6,z,.08,2.45,1.85,s<0?'#3b2a1d':'#23303a',true); }
  // three iron ring chandeliers on chains (flames = glow parts drawn unlit in render.js, no realtime lights)
  for(const z of HQ_CHANDELIERS) { B(-18.5,CEIL-1.6,z,.06,3.0,.06,iron,true); B(-18.5,Y+7.6,z,.35,.3,.35,gold,true);
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2; B(-18.5+Math.cos(a)*1.25,Y+7.0,z+Math.sin(a)*1.25,.82,.1,.12,iron,true,{ry:-a+Math.PI/2}); B(-18.5+Math.cos(a)*1.25,Y+7.2,z+Math.sin(a)*1.25,.09,.32,.09,candle,true,{glow:true}); B(-18.5+Math.cos(a)*1.25,Y+7.45,z+Math.sin(a)*1.25,.07,.16,.07,flame,true,{glow:true}); } }
  // wall torches (iron bracket + glow flame) and pirate dressing: barrels, chest of gold, ship's wheel, anchor
  for(const [x,z] of HQ_TORCHES) { const s=x<-18?1:-1; B(x+s*.2,Y+3.0,z,.4,.12,.12,iron,true); B(x+s*.42,Y+3.1,z,.12,.5,.12,wood,true); B(x+s*.42,Y+3.5,z,.2,.35,.2,flame,true,{glow:true}); }
  for(const [x,z] of [[IX0+.8,IZ1-.9],[IX0+1.9,IZ1-.8],[IX1-.8,IZ1-.9],[IX0+.8,IZ0+.9],[IX1-.8,IZ0+.9]]) { Cy(x,Y+.55,z,.5,.45,1.1,12,'#6b4428',true); Cy(x,Y+.3,z,.53,.53,.08,12,iron,true); Cy(x,Y+.85,z,.5,.5,.08,12,iron,true); }
  { const cx=-11.5, cz=-62.5, y=Y+HQ.dais.rise; B(cx,y+.35,cz,1.5,.7,.95,wood,true); B(cx,y+.86,cz,1.52,.32,.97,'#3a2418',true); for(const dx of [-.55,0,.55]) B(cx+dx,y+.6,cz,.08,1.02,1,gold,true); for(const [dx,dz] of [[.95,.1],[1.15,-.3],[-1,.25]]) B(cx+dx,y+.08,cz+dz,.32,.16,.32,gold,true); }
  for(const [x,z] of [[-30.5,-42],[-6.9,-56]]) { B(x,Y+.45,z,1.1,.9,5.3,mahog,true); B(x,Y+.93,z,1.2,.08,5.4,'#2a160d',true); }

  // casino-style wall: gilt cap rail over the damask (render.js paints the damask panels), crimson/green banners between pillars
  for(const [x,z,w,d] of [[IX0+.05,CZ,.16,IZ1-IZ0],[CX,IZ0+.05,IX1-IX0,.16],[IX1-.05,CZ,.16,IZ1-IZ0]]) B(x,Y+6.3,z,w,.14,d,gold,true);
  for(const x of [-24.5,-12.5]) for(const [z,c] of [[-44,'#7a1d22'],[-52.5,'#1b4d36']]) { B(x,CEIL-1.25,z,2.0,.1,.1,iron,true); B(x,CEIL-3.6,z,1.7,4.6,.05,c,true); B(x,CEIL-1.4,z,1.8,.14,.09,gold,true); B(x,CEIL-4.4,z,.8,.8,.07,gold,true); B(x,CEIL-5.95,z,1.7,.12,.07,gold,true); }
  // west wall: ship's wheel + anchor; jolly roger flags; crates and gold by the barrels
  { const wx=IX0+.2, wy=Y+4.3, wz=-60.5; B(wx,wy,wz,.25,.32,.32,wood,true);
    for(let i=0;i<4;i++) B(wx,wy,wz,.12,2.3,.12,wood,true,{rx:i*Math.PI/4});
    for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;B(wx,wy+Math.cos(a)*.82,wz+Math.sin(a)*.82,.16,.66,.14,wood,true,{rx:-a+Math.PI/2});}
    const az=-55.5; B(wx,Y+3.6,az,.18,2.6,.2,iron,true); B(wx,Y+4.65,az,.18,.18,1.3,iron,true); B(wx,Y+5.1,az,.18,.5,.5,iron,true);
    for(const sd of [-1,1]) B(wx,Y+2.5,az+sd*.5,.18,.2,1.15,iron,true,{rx:sd*.55}); }
  for(const [x,z] of [[IX0+.12,-45],[IX1-.12,-61]]) { B(x,Y+8.2,z,.05,2.4,3.6,'#17130f',true); B(x,Y+8.45,z,.07,.62,.56,bone,true); for(const sd of [-1,1]) B(x,Y+7.7,z,.07,.12,1.1,bone,true,{rx:sd*.6}); }
  for(const [x,z,q] of [[IX0+.8,IZ1-2.1,1],[IX0+.75,IZ1-2.95,.7],[IX1-.8,IZ1-2.1,.9],[IX1-.8,IZ0+2.0,1]]) B(x,Y+q/2,z,q,q,q,'#7a5636',true);
  for(const [x,z] of [[IX0+1.9,IZ1-1.6],[IX1-1.9,IZ0+1.4]]) { B(x,Y+.12,z,.9,.24,.7,gold,true); B(x+.1,Y+.32,z,.5,.18,.4,gold,true); }
  B(HQ.board.lx,HQ.board.y,HQ.board.lz-.12,HQ.board.w+.6,HQ.board.h+.6,.25,mahog);
  B(HQ.board.lx,HQ.board.y,HQ.board.lz+.0,HQ.board.w+.25,HQ.board.h+.25,.07,gold);
  for(const s of [-1,1]) { B(HQ.board.lx+s*(HQ.board.w/2+1.6),Y+5.5,HQ.board.lz,2.2,8.6,.08,'#1b4d36',true); B(HQ.board.lx+s*(HQ.board.w/2+1.6),Y+9.85,HQ.board.lz+.05,2.4,.16,.16,gold,true); B(HQ.board.lx+s*(HQ.board.w/2+1.6),Y+6.6,HQ.board.lz+.06,1.0,1.0,.04,gold,true); }
  return p;
}
export const HQ_CHANDELIERS = [-37, -46, -55];
export const HQ_TORCHES = [[-32.25,-49],[-32.25,-62],[-5.15,-33.5],[-5.15,-47.8],[-5.15,-54],[-5.15,-61]];
export function petParts() {
 const p=[], I=PET_LOT.interior, B=(x,y,z,w,h,d,c)=>p.push({kind:'box',x,y,z,w,h,d,c});
 // Overlay both TO RENT plates and the blank fascia; never move the room or its counter.
 B(-9.15,petFloor(PET_LOT.lz)+2.55,PET_LOT.lz, .08,1.05,3.1,wood);
 B(-7.75,petFloor(-111.1)+1.15,-111.1,.09,1.25,1.7,wood);
 B(-1.25,PET_LOT.doorY+3.6,-114.76,.18,.65,5.8,wood);
 for(const z of [-117,-112.5]) { B(-7.7,petFloor(z)+1.1,z,.15,2.2,.15,wood);B(-7.7,petFloor(z)+2.2,z,.15,.1,1.5,gold); }
 return p;
}

// Closed triangular prism, shared with the approval renderer.
export function gableVertices(p) {
 const v=[[-p.w/2,0,-p.d/2],[-p.w/2,0,p.d/2],[-p.w/2,p.h,0],[p.w/2,0,-p.d/2],[p.w/2,0,p.d/2],[p.w/2,p.h,0]];
 return [0,2,1,3,4,5,0,1,4,0,4,3,1,2,5,1,5,4,2,0,3,2,3,5].flatMap(i=>v[i]);
}
