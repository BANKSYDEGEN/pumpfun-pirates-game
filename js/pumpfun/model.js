// Shared low-poly geometry description: runtime + Blender approval renders use these exact parts.
import { HQ, HQ_OUTWORKS, HQ_TOWERS, HQ_PILLARS, HQ_PROPS, HQ_PANELS, HQ_SQUAD_BOARDS, HQ_BOARD_BAND, PET_LOT, petFloor } from './site.js';
const stone = '#c9bfae', darkStone = '#8a837a', wood = '#4a3023', green = '#54d08a', roof = '#c8552e', gold = '#ffcd77', iron = '#2b2a28', flame = '#ffb347', candle = '#f3e6c4', bone = '#e8e0cc', mahog = '#5a2a1a', crimson = '#7a1d22';
export const HQ_TRENCH_LAMPS=[];
export function hqParts() {
  // [post-hq-castle] BANKSY t261u: ONE hall over the whole footprint (lx -33..-4, lz -65..-30), pirate-fortress stone outside,
  // casino-style warm interior (mahogany wainscot, gilded beamed ceiling, iron chandeliers, painted light pools in render.js).
  HQ_TRENCH_LAMPS.length=0; const p = [], mat=c=>c===stone?11:c===darkStone?22:c===wood?26:c===roof?4:0;
  const B = (x,y,z,w,h,d,c,detail=false,ex) => p.push({ kind:'box', x,y,z,w,h,d,c,detail,mat:mat(c),...ex });
  const Cy = (x,y,z,r,r1,h,n,c,detail=false,ex) => p.push({ kind:'cyl', x,y,z,r,r1,h,n,c,detail,mat:mat(c),...ex });
  const Y=HQ.floor, TOP=Y+HQ.wallTop, CEIL=Y+HQ.ceil, X0=HQ.lx0, X1=HQ.lx1, Z0=HQ.lz0, Z1=HQ.lz1, CX=(X0+X1)/2, CZ=(Z0+Z1)/2, D=Z1-Z0;
  const HD=HQ.hillDoor, hz0=HD.lz-HD.w/2, hz1=HD.lz+HD.w/2;
  B(CX,Y-.03,CZ,28.8,.12,D-.6,'#5b3b26',false,{mat:26}); // dark oiled deck planks // one floor, wall to wall
  // ---- outer walls, full height (no rear mass: the back half is part of the hall) ----
  const WH=TOP-(Y-.6), WY=(TOP+Y-.6)/2;
  B(X0+.3,WY,CZ,.6,WH,D,stone); B(CX,WY,Z0+.3,X1-X0,WH,.6,stone);
  B(X1-.5,WY,(Z1+hz1)/2,1.0,WH,Z1-hz1,stone); B(X1-.5,WY,(hz0+Z0)/2,1.0,WH,hz0-Z0,stone);   // east wall 1 m: inner face on the terrain grid line
  { const R=HD.w/2; for(let i=0;i<11;i++){const z0=-R+i*HD.w/11+HD.w/22, yy=Y+HD.h+Math.sqrt(Math.max(0,R*R-z0*z0)); B(X1-.5,(yy+TOP)/2,HD.lz+z0,1.0,TOP-yy,HD.w/11+.01,stone);} }   // round-arched Hill Street door
  for (const x of [-27.25,-9.75]) B(x,WY,Z1-.3,11.5,WH,.6,stone);
  // ---- dock plaza gate: 6 m opening, round stone arch (voussoirs), iron portcullis raised in the arch ----
  const GW=HQ.door.w, GS=Y+4.6, GR=GW/2;
  for(let i=0;i<14;i++){const x0=-GR+i*GW/14+GW/28, yy=GS+Math.sqrt(Math.max(0,GR*GR-x0*x0)); B(HQ.door.lx+x0,(yy+TOP)/2,Z1-.3,GW/14+.01,TOP-yy,.6,stone);}
  for(let i=0;i<11;i++){const a=Math.PI*(i+.5)/11; B(HQ.door.lx+Math.cos(a)*(GR+.3),GS+Math.sin(a)*(GR+.3),Z1+.05,.75,.5,.8,darkStone,false,{rz:a-Math.PI/2});}
  for(const s of [-1,1]) B(HQ.door.lx+s*(GR+.3),Y+2.3,Z1+.05,.8,4.6,.8,darkStone);
  // p2 gatehouse presence: projecting buttresses, a second deep outer arch ring + hood moulding, gilt skull keystone, iron-studded leaves
  for(const s of [-1,1]) { const bx=HQ.door.lx+s*3.6; B(bx,Y+4.6,Z1+.62,1.3,9.4,1.3,darkStone); B(bx,Y+9.45,Z1+.62,1.55,.35,1.55,darkStone); B(bx,Y+.7,Z1+.68,1.55,1.4,1.45,darkStone);
    B(bx,Y+10.0,Z1+.62,.9,.8,.9,stone); }   // BANKSY 12:47 AM: no doors, no portcullis: open stone archways

  for(let i=0;i<15;i++){const a=Math.PI*(i+.5)/15; B(HQ.door.lx+Math.cos(a)*(GR+.95),GS+Math.sin(a)*(GR+.95),Z1+.45,.95,.6,1.5,stone,false,{rz:a-Math.PI/2});}
  for(let i=0;i<17;i++){const a=Math.PI*(i+.5)/17; B(HQ.door.lx+Math.cos(a)*(GR+1.5),GS+Math.sin(a)*(GR+1.5),Z1+.55,.85,.22,1.25,darkStone,false,{rz:a-Math.PI/2});}
  for(let i=0;i<13;i++){const a=Math.PI*(i+.5)/13; B(HQ.door.lx+Math.cos(a)*(GR+.05),GS+Math.sin(a)*(GR+.05),Z1-.2,.6,.15,1.2,darkStone,true,{rz:a-Math.PI/2});}   // arch soffit through the wall
  for(const s of [-1,1]) { const bx=HQ.door.lx+s*3.6; B(bx,Y+3.4,Z1+1.35,.12,.12,.4,iron,true); B(bx,Y+3.55,Z1+1.55,.12,.5,.12,wood,true); B(bx,Y+3.95,Z1+1.55,.22,.38,.22,flame,true,{glow:true}); }
  B(HQ.door.lx,GS+GR+.85,Z1+1.25,.95,1.15,.3,gold); B(HQ.door.lx,GS+GR+.95,Z1+1.42,.55,.5,.06,bone,true); B(HQ.door.lx,GS+GR+.6,Z1+1.42,.3,.14,.06,bone,true);

  // ---- Hill Street door (east wall): dressed jambs, lintel, iron-strapped timber leaves folded open inside ----
  { const R=HD.w/2;
    for(const s of [-1,1]) { const z=HD.lz+s*(R+.4); B(X1-.35,Y+HD.h/2,z,1.5,HD.h,.8,darkStone); B(X1+.25,Y+.5,z+s*.05,.5,1.0,1.0,darkStone); B(X1-.35,Y+HD.h+.12,z,1.6,.24,.95,darkStone);   // thick jambs, plinth, impost
      B(X1+.25,Y+3.0,z+s*.85,.4,.12,.12,iron,true); B(X1+.48,Y+3.1,z+s*.85,.12,.5,.12,wood,true); B(X1+.48,Y+3.5,z+s*.85,.2,.35,.2,flame,true,{glow:true}); }   // street torches
    for(let i=0;i<11;i++){const a=Math.PI*(i+.5)/11; B(X1-.3,Y+HD.h+Math.sin(a)*(R+.35),HD.lz+Math.cos(a)*(R+.35),1.4,.62,.62,darkStone,false,{rx:-(a-Math.PI/2)});}
    for(let i=0;i<13;i++){const a=Math.PI*(i+.5)/13; B(X1+.05,Y+HD.h+Math.sin(a)*(R+.95),HD.lz+Math.cos(a)*(R+.95),.6,.22,.55,darkStone,false,{rx:-(a-Math.PI/2)});}
    B(X1+.32,Y+HD.h+R+.95,HD.lz,.3,1.0,.85,gold); B(X1+.49,Y+HD.h+R+1.0,HD.lz,.05,.45,.5,bone,true);   // gilt keystone
    B(X1+.18,Y+HD.h+R+2.3,HD.lz,.18,1.1,3.7,mahog); B(X1+.23,Y+HD.h+R+2.3,HD.lz,.1,1.24,3.86,gold);   // carved sign board (face drawn in render.js)
    B(X1-.5,Y+.005,HD.lz,2.6,.03,HD.w,darkStone,true);   // flush threshold, no bump
    // blind arch on the west wall opposite the archway (symmetry), framing the daily-ranks board
    const XW=X0+.75; for(const s of [-1,1]) { const z=HD.lz+s*(R+.4); B(XW,Y+HD.h/2,z,.5,HD.h,.8,darkStone); B(XW,Y+HD.h+.12,z,.6,.24,.95,darkStone); }
    for(let i=0;i<11;i++){const a=Math.PI*(i+.5)/11; B(XW,Y+HD.h+Math.sin(a)*(R+.35),HD.lz+Math.cos(a)*(R+.35),.5,.62,.62,darkStone,false,{rx:-(a-Math.PI/2)});}
    B(XW+.1,Y+HD.h+R+.95,HD.lz,.3,1.0,.85,gold); }
  // ---- fortress exterior: plinth, string course, crenellated parapet on all four walls, flat lead-and-stone roof ----
  for(const [a,b] of [[X0-.15,HQ.door.lx-HQ.door.w/2-.9],[HQ.door.lx+HQ.door.w/2+.9,X1+.15]]) B((a+b)/2,Y+.6,Z1+.12,b-a,1.4,.3,darkStone);   // plinth stops at the gate: open to the floor
  B(HQ.door.lx,Y+.005,Z1-.3,HQ.door.w+.2,.03,1.6,darkStone,true);   // flush threshold B(X0-.1,Y+.6,CZ,.3,1.4,D,darkStone);
  for(const [x,z,w,d] of [[CX,Z1+.1,X1-X0+.4,.4],[CX,Z0-.1,X1-X0+.4,.4],[X0-.1,CZ,.4,D+.4],[X1+.1,CZ,.4,D+.4]]) { B(x,TOP-1.6,z,w,.35,d,darkStone); B(x,TOP+.1,z,w,.4,d,darkStone); }
  B(CX,TOP-.6,CZ,X1-X0-1,.4,D-1,darkStone);
  const mer=(x0,z0,x1,z1)=>{const L=Math.hypot(x1-x0,z1-z0),n=Math.floor(L/1.8);for(let i=0;i<n;i++){const t=(i+.5)/n;B(x0+(x1-x0)*t,TOP+.95,z0+(z1-z0)*t,Math.abs(x1-x0)>1?.95:.75,1.3,Math.abs(x1-x0)>1?.75:.95,stone);}};
  mer(X0+.4,Z1-.1,X1-.4,Z1-.1); mer(X0+.4,Z0+.1,X1-.4,Z0+.1); mer(X0+.1,Z0+.5,X0+.1,Z1-.5); mer(X1-.1,Z0+.5,X1-.1,Z1-.5);
  // front corner gun towers (round, battered base, crenellated crown, no fairy-tale cones) + rear corner bartizans
  // BANKSY 12:48 AM "remove the corner pillars on inside of building, keep exterior": below the ceiling the towers are half-drums on the
  // OUTSIDE of the front wall only (cut face hidden in the wall), so the hall's front corners run clean wall-to-wall; full drum above the roof.
  for(const t of HQ_TOWERS){ const H=TOP+2.2-Y+.4, cut=Y+HQ.ceil+.6, rAt=y=>t.r+.2-(y-(Y-.4))/H*.2;
    Cy(t.lx,(cut+Y-.4)/2,t.lz,rAt(cut),t.r+.2,cut-Y+.4,16,stone,false,{half:1}); Cy(t.lx,(TOP+2.2+cut)/2,t.lz,t.r,rAt(cut),TOP+2.2-cut,16,stone); Cy(t.lx,Y+.8,t.lz,t.r+.45,t.r+.6,1.8,16,darkStone,false,{half:1});
    Cy(t.lx,TOP+2.4,t.lz,t.r+.35,t.r+.35,.45,16,darkStone); for(let i=0;i<8;i++){const a=i/8*Math.PI*2;B(t.lx+Math.cos(a)*(t.r+.1),TOP+3.25,t.lz+Math.sin(a)*(t.r+.1),.8,1.25,.8,stone,false,{ry:-a});}
    for(const y of [Y+6.5,Y+10.5]) { B(t.lx,y,t.lz+t.r+.05,.75,1.95,.22,darkStone); B(t.lx,y+1.05,t.lz+t.r+.1,.9,.22,.3,darkStone); B(t.lx,y,t.lz+t.r+.17,.2,1.35,.04,'#3a2a1c'); B(t.lx,y,t.lz+t.r+.19,.05,1.35,.03,iron,true); } // framed arrow slits
    B(t.lx,TOP+5.2,t.lz,.12,4.1,.12,wood,true); B(t.lx,TOP+7.25,t.lz,.22,.22,.22,gold,true); }
  for(const [x,z] of [[X0+.4,Z0+.4],[X1-.4,Z0+.4]]) { Cy(x,TOP-1.6,z,1.5,.4,2,12,darkStone); Cy(x,TOP+.7,z,1.5,1.5,2.6,12,stone); for(let i=0;i<6;i++){const a=i/6*Math.PI*2;B(x+Math.cos(a)*1.35,TOP+2.4,z+Math.sin(a)*1.35,.6,.9,.6,stone,false,{ry:-a});} }
  // side-wall arrow-slit lancets (glazed both faces) + front banners flanking the gate
  for(const z of [-36,-42,-54,-60]) for(const x of [X0+.3,X1-.5]) { const t=x>-10?1.12:.72; B(x,Y+8.4,z,t,3.2,1.0,'#33505f'); B(x,Y+10.1,z,t+.08,.3,1.4,darkStone); B(x,Y+6.7,z,t+.08,.3,1.4,darkStone); }
  for(const x of [-12.4]) { B(x,Y+6.85,Z1+.3,2.0,.12,.12,gold); for(const s of [-1,1]) Cy(x+s*1.02,Y+6.85,Z1+.3,.09,.09,.09,10,gold,true,{rz:Math.PI/2}); B(x,Y+7.0,Z1+.12,.12,.35,.3,iron,true); }   // banner rod (cloth: render.js)
  B(-18.5,Y+10.6,Z1+.2,18.4,2.3,.3,mahog); B(-18.5,Y+10.6,Z1+.3,18.7,2.6,.14,gold); for(const s of [-1,1]) { B(-18.5+s*9.6,Y+10.6,Z1+.32,.7,3.1,.35,darkStone); B(-18.5+s*9.6,Y+12.3,Z1+.32,.9,.3,.45,darkStone); }   // carved timber sign in a stone frame // HQ sign board
  // ---- interior: mahogany wainscot, gilded beamed ceiling on two stone arcades, dais under the big board ----
  const IX0=X0+.6, IX1=X1-1.0, IZ0=Z0+.6, IZ1=Z1-.6;
  for(const [x,z,w,d] of [[IX0+.06,CZ,.12,IZ1-IZ0],[CX,IZ0+.06,IX1-IX0,.12]]) { B(x,Y+.75,z,w,1.5,d,mahog,true); B(x,Y+1.55,z,w+.06,.1,d+.06,gold,true); B(x,Y+.08,z,w+.08,.16,d+.08,'#2a160d',true); }
  for(const [z0,z1] of [[IZ0,hz0],[hz1,IZ1]]) { const z=(z0+z1)/2,d=z1-z0; B(IX1-.06,Y+.75,z,.12,1.5,d,mahog,true); B(IX1-.06,Y+1.55,z,.18,.1,d,gold,true); }
  for(const x of [-27.25,-9.75]) { B(x+(x<-18?-.3:.3),Y+.75,IZ1-.06,10.9,1.5,.12,mahog,true); B(x+(x<-18?-.3:.3),Y+1.55,IZ1-.06,10.9,.1,.18,gold,true); }
  B(CX,CEIL+.18,CZ,IX1-IX0,.35,IZ1-IZ0,wood); // timber ceiling
  for(let z=IZ1-2.2;z>IZ0+1;z-=4.2){ B(CX,CEIL-.35,z,IX1-IX0,.8,.6,wood); B(CX,CEIL-.77,z,IX1-IX0,.06,.65,gold,true);
    for(const s of [-1,1]) { B(CX+s*(IX1-IX0)/2-s*.25,CEIL-1.0,z,.5,.8,.5,darkStone,true); B(CX+s*((IX1-IX0)/2-.9),CEIL-1.3,z,.22,2.0,.22,wood,true,{rz:s*.75}); } }
  for(let z=IZ1-2.2;z>IZ0+1;z-=4.2){ B(CX,CEIL-1.15,z,IX1-IX0-1.2,.35,.4,wood,true); for(const s of [-1,1]) B(CX+s*6.2,CEIL-.8,z,.25,.8,.3,wood,true); B(CX,CEIL-.75,z,.3,.9,.32,wood,true); }   // tie-beam trusses span wall to wall (no columns)
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
  for(const z of []) for(const s of [-1,1]) { const x=s<0?IX0+.1:IX1-.1; if(s>0&&Math.abs(z-HD.lz)<4)continue; if(s<0&&z>-46)continue; B(x,Y+4.6,z,.1,2.8,2.2,gold,true); B(x+(s<0?.04:-.04),Y+4.6,z,.08,2.45,1.85,s<0?'#3b2a1d':'#23303a',true); }
  // three iron ring chandeliers on chains (flames = glow parts drawn unlit in render.js, no realtime lights)
  for(const z of HQ_CHANDELIERS) { B(-18.5,CEIL-1.6,z,.06,3.0,.06,iron,true); B(-18.5,Y+7.6,z,.35,.3,.35,gold,true);
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2; B(-18.5+Math.cos(a)*1.25,Y+7.0,z+Math.sin(a)*1.25,.82,.1,.12,iron,true,{ry:-a+Math.PI/2}); B(-18.5+Math.cos(a)*1.25,Y+7.2,z+Math.sin(a)*1.25,.09,.32,.09,candle,true,{glow:true}); B(-18.5+Math.cos(a)*1.25,Y+7.45,z+Math.sin(a)*1.25,.07,.16,.07,flame,true,{glow:true}); } }
  // wall torches (iron bracket + glow flame) and pirate dressing: barrels, chest of gold, ship's wheel, anchor
  for(const [x,z] of HQ_TORCHES) { const s=x<-18?1:-1; B(x+s*.2,Y+3.0,z,.4,.12,.12,iron,true); B(x+s*.42,Y+3.1,z,.12,.5,.12,wood,true); B(x+s*.42,Y+3.5,z,.2,.35,.2,flame,true,{glow:true}); }

  // casino-style wall: gilt cap rail over the damask (render.js paints the damask panels), crimson/green banners between pillars
  for(const [x,z,w,d] of [[IX0+.05,CZ,.16,IZ1-IZ0],[CX,IZ0+.05,IX1-IX0,.16],[IX1-.05,CZ,.16,IZ1-IZ0]]) B(x,Y+6.3,z,w,.14,d,gold,true);
  for(const x of [-24.5,-12.5]) for(const [z,c] of [[-44,'#7a1d22'],[-52.5,'#1b4d36']]) { B(x,CEIL-1.25,z,2.0,.1,.1,iron,true); B(x,CEIL-1.4,z,1.9,.12,.12,gold,true); }

  // ---- p2 pirate dressing (HQ_PROPS also feeds the colliders in site.js) ----
  const iy=z=>Y+(z<HQ.dais.lz1&&z>HQ.dais.lz0?HQ.dais.rise:0);
  for(const [kind,x,z] of HQ_PROPS){ const y=iy(z);
    if(kind==='bench'){ B(x,y+.45,z,1.1,.9,5.3,mahog,true); B(x,y+.93,z,1.2,.08,5.4,'#2a160d',true); }
    if(kind==='cannon'){ B(x,y+.35,z,1.0,.5,1.7,'#3a2418',true); for(const s of [-1,1]) for(const dz of [-.55,.55]) Cy(x+s*.56,y+.3,z+dz,.3,.3,.12,10,wood,true,{rz:Math.PI/2});
      Cy(x,y+.85,z+.25,.24,.33,2.3,12,'#1d1d1f',true,{rx:Math.PI/2}); Cy(x,y+.85,z-.95,.36,.36,.12,12,'#1d1d1f',true,{rx:Math.PI/2}); Cy(x,y+.85,z+1.4,.27,.27,.14,12,'#2b2a28',true,{rx:Math.PI/2});
      for(const [dx,dz] of [[-.25,-1.15],[.05,-1.2],[-.1,-1.4]]) Cy(x+dx+.5,y+.12,z+dz,.13,.13,.24,8,'#121212',true); }
    if(kind==='maptable'){ B(x,y+.92,z,2.4,.12,1.6,mahog,true); for(const sx of [-1,1]) for(const sz of [-1,1]) B(x+sx*1.05,y+.44,z+sz*.65,.14,.88,.14,'#2a160d',true);
      B(x-.2,y+.99,z,1.7,.02,1.15,'#e8d6a8',true); B(x-.55,y+1.0,z-.1,.6,.01,.35,'#2f6b8a',true); B(x+.2,y+1.0,z+.25,.5,.01,.3,'#5f8a43',true); B(x+.35,y+1.01,z-.2,.08,.01,.08,'#9b2335',true);
      Cy(x+.9,y+1.02,z-.45,.18,.18,.05,14,gold,true); B(x-1.0,y+1.1,z+.55,.1,.22,.1,candle,true,{glow:true}); B(x-1.0,y+1.27,z+.55,.05,.1,.05,flame,true,{glow:true});
      Cy(x+.75,y+1.2,z+.45,.05,.05,.5,8,gold,true,{rz:Math.PI/2}); }
    if(kind==='rack'){ const s=x<-18?1:-1, rx=x; for(const dz of [-1.4,1.4]) B(rx,y+.95,z+dz,.18,1.9,.18,wood,true); for(const yy of [y+.45,y+1.6]) B(rx,yy,z,.18,.14,3.0,wood,true);
      for(let i=0;i<5;i++){const zz=z-1.1+i*.55; B(rx+s*.12,y+1.0,zz,.04,1.5,.09,'#c9ccd1',true,{rx:(i%2?.12:-.12)}); B(rx+s*.12,y+.38,zz,.12,.08,.32,gold,true); B(rx+s*.12,y+.22,zz,.06,.24,.06,'#2a160d',true);}
      Cy(rx+s*.15,y+2.0,z-1.0,.12,.12,.05,10,iron,true,{rz:Math.PI/2}); }
    if(kind==='treasure'){ Cy(x,y+.3,z,.2,.95,.6,14,gold,true); Cy(x+.55,y+.08,z+.4,.25,.25,.16,12,gold,true); Cy(x-.5,y+.06,z-.35,.22,.22,.12,12,gold,true);
      for(const [dx,dz,c] of [[.2,.3,'#d8322f'],[-.3,.25,'#2a6df4'],[.35,-.25,'#2f8a3a'],[-.15,-.4,'#9b5cff'],[0,.0,'#ff7ab8']]) B(x+dx,y+.55-(Math.abs(dx)+Math.abs(dz))*.4,z+dz,.14,.14,.14,c,true,{ry:dx*3});
      for(let i=0;i<3;i++) B(x-.7+i*.18,y+.08+i*.14,z+.55,.5,.12,.22,gold,true); Cy(x+.75,y+.25,z-.3,.12,.16,.5,8,'#e8e0cc',true); }
    if(kind==='chest'){ B(x,y+.35,z,1.5,.7,.95,wood,true); B(x,y+.86,z,1.52,.32,.97,'#3a2418',true); for(const dx of [-.55,0,.55]) B(x+dx,y+.6,z,.08,1.02,1,gold,true); B(x,y+.95,z+.2,1.2,.2,.5,gold,true); }
    if(kind==='barrels'){ const n=Math.max(1,Math.round(HQ_PROPS.find(q=>q[1]===x&&q[2]===z)[3]/1.15)); for(let i=0;i<n;i++){const bx=x+(i-(n-1)/2)*1.1; Cy(bx,y+.55,z,.5,.45,1.1,12,'#6b4428',true); for(const yy of [.3,.85]) Cy(bx,y+yy,z,.53,.53,.08,12,iron,true);} }
    if(kind==='crates'){ B(x,y+.5,z,1.0,1.0,1.0,'#7a5636',true); B(x+.05,y+1.35,z-.1,.7,.7,.7,'#8a6440',true,{ry:.3}); B(x,y+.5,z+.505,1.0,.12,.02,'#4a3023',true); }
    if(kind==='rope'){ for(let i=0;i<4;i++) Cy(x,y+.07+i*.13,z,.55-i*.06,.55-i*.06,.12,14,'#b39462',true); Cy(x,y+.35,z,.2,.2,.62,10,'#5b3b26',true); }
  }
  // hanging iron lanterns in the arcades (glow cores, no lights)
  for(const x of [-24.5,-12.5]) for(const z of [-36,-44,-52]) { const zz=z+(z===-44?4:z===-52?4.0:0); B(x+(x<-18?1.4:-1.4),CEIL-2.6,zz,.04,2.6,.04,iron,true); B(x+(x<-18?1.4:-1.4),Y+6.6,zz,.5,.08,.5,iron,true); B(x+(x<-18?1.4:-1.4),Y+6.15,zz,.32,.6,.32,flame,true,{glow:true}); B(x+(x<-18?1.4:-1.4),Y+5.8,zz,.45,.08,.45,iron,true); }
  // ---- p4 fortress detail: machicolation corbel table + projecting parapet, merlon caps, mid string course, wall arrow slits ----
  { const sides=[[X0+.3,Z1+.1,X1-.3,Z1+.1,0,1],[X1+.1,Z1-.3,X1+.1,Z0+.3,1,0],[X0-.1,Z1-.3,X0-.1,Z0+.3,-1,0],[X0+.3,Z0-.1,X1-.3,Z0-.1,0,-1]];
    for(const [x0,z0,x1,z1,nx,nz] of sides){ const L=Math.hypot(x1-x0,z1-z0),n=Math.floor(L/1.25),front=nz===1;
      for(let i=0;i<n;i++){const t=(i+.5)/n,x=x0+(x1-x0)*t+nx*.3,z=z0+(z1-z0)*t+nz*.3; B(x,TOP-1.05,z,nx?.6:.45,.75,nx?.45:.6,darkStone,!front); B(x+nx*.05,TOP-1.5,z+nz*.05,nx?.4:.35,.25,nx?.35:.4,darkStone,true); }
      const cx=(x0+x1)/2+nx*.42, cz=(z0+z1)/2+nz*.42; B(cx,TOP-.45,cz,nx?.3:L,.5,nx?L:.3,stone,!front);   // parapet face carried forward on the corbels
      { const cut=nz===1?[HQ.door.lx-GR-1.3,HQ.door.lx+GR+1.3]:nx===1?[HD.lz-HD.w/2-.9,HD.lz+HD.w/2+.9]:null, a0=nx?Math.min(z0,z1):Math.min(x0,x1), a1=nx?Math.max(z0,z1):Math.max(x0,x1);
        for(const [u0,u1] of cut?[[a0,cut[0]],[cut[1],a1]]:[[a0,a1]]){ const c=(u0+u1)/2, l=u1-u0; B(nx?x0+nx*.15:c,Y+5.6,nx?c:z0+nz*.15,nx?.3:l,.28,nx?l:.3,darkStone,!front); } } }   // mid string course, broken by the archways
  }
  for(const q of p.filter(q=>q.kind==='box'&&q.mat===11&&Math.abs(q.y-(TOP+.95))<.01&&q.h===1.3)) B(q.x,TOP+1.68,q.z,q.w+.14,.16,q.d+.14,darkStone,true);   // merlon caps
  const slit=(x,y,z,nx,nz)=>{ B(x+nx*.06,y,z+nz*.06,nx?.24:1.1,2.9,nx?1.1:.24,darkStone); B(x+nx*.14,y+1.55,z+nz*.14,nx?.34:1.35,.3,nx?1.35:.34,darkStone); B(x+nx*.14,y-1.5,z+nz*.14,nx?.34:1.2,.22,nx?1.2:.34,darkStone);
    B(x+nx*.19,y,z+nz*.19,nx?.04:.3,2.2,nx?.3:.04,'#1e150e'); B(x+nx*.19,y+.2,z+nz*.19,nx?.04:.9,.24,nx?.9:.04,'#1e150e');   // cross-slit (crosslet loop)
    B(x+nx*.08,y-3.0,z+nz*.08,nx?.04:.5,2.8,nx?.5:.04,'#7a7468',true); };   // rain streak below
  for(const x of [-27,-10]) slit(x,Y+11.3-.6,Z1,0,1);
  for(const z of [-33,-39,-48,-57,-63]) slit(X1,Y+3.4,z,1,0);
  for(const t of HQ_TOWERS){ Cy(t.lx,Y+1.6,t.lz,t.r+.25,t.r+.95,3.2,16,darkStone,false,{half:1}); Cy(t.lx,Y+3.3,t.lz,t.r+.3,t.r+.3,.25,16,darkStone,false,{half:1});   // battered talus + roll moulding
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2; B(t.lx+Math.cos(a)*(t.r+.25),TOP+1.9,t.lz+Math.sin(a)*(t.r+.25),.55,.6,.55,darkStone,true,{ry:-a});} }   // tower corbel ring
  const lamp=(px,pz)=>{ B(px,Y+4.15,pz,.12,.5,.12,iron,true); B(px,Y+4.42,pz,.46,.06,.46,iron,true); B(px,Y+5.02,pz,.5,.08,.5,iron,true); B(px,Y+5.15,pz,.22,.18,.22,iron,true);
    for(const [a,b] of [[-1,-1],[1,-1],[-1,1],[1,1]]) B(px+a*.21,Y+4.72,pz+b*.21,.05,.56,.05,iron,true);
    B(px,Y+4.68,pz,.2,.36,.2,flame,true,{glow:true}); HQ_TRENCH_LAMPS.push([px,pz]); };
  // trench: iron railing + lantern posts on the retaining wall coping, grated drains in the paving
  for(const [x,z,w,d] of HQ_OUTWORKS.slice(0,2)){ const along=w>d, L=Math.max(w,d), n=Math.floor(L/2.4);
    for(let i=0;i<=n;i++){const u=-L/2+i*L/n, px=along?x+u:x, pz=along?z:z+u; B(px,Y+3.6,pz,.14,1.2,.14,iron,true); B(px,Y+4.27,pz,.2,.14,.2,iron,true); if(i%3===1){ lamp(px,pz); } }
    for(const yy of [Y+3.45,Y+4.1]) B(x,yy,z,along?L:.1,.1,along?.1:L,iron,true);
    for(let u=-L/2+.6;u<L/2;u+=1.2){ const px=along?x+u:x, pz=along?z:z+u; B(px,Y+3.78,pz,.05,.6,.05,iron,true); B(px,Y+3.78,pz,along?.34:.05,.05,along?.05:.34,iron,true,{rz:along?Math.PI/4:0,rx:along?0:Math.PI/4}); B(px,Y+4.22,pz,.09,.18,.09,gold,true); } }   // pickets + diamond scrolls + finials
  for(let z=-51;z>-64;z-=4.2) B(X0-.95,Y+.04,z,.9,.03,.9,iron,true);
  // ---- p5 weathering: damp base band, moss patches at the foot, rain streaks under the corbel table (never across the two archways) ----
  { const gap=(nx,nz)=>nz===1?[HQ.door.lx-GR-1.3,HQ.door.lx+GR+1.3,'x']:nx===1?[HD.lz-HD.w/2-1.0,HD.lz+HD.w/2+1.0,'z']:null;
    const sides=[[X0,Z1+.07,X1,Z1+.07,0,1],[X1+.07,Z1,X1+.07,Z0,1,0],[X0-.07,Z1,X0-.07,Z0,-1,0],[X0,Z0-.07,X1,Z0-.07,0,-1]];
    for(const [sx0,sz0,sx1,sz1,nx,nz] of sides){ const g=gap(nx,nz), segs=[];
      if(!g) segs.push([sx0,sz0,sx1,sz1]); else if(g[2]==='x') segs.push([sx0,sz0,g[0],sz1],[g[1],sz0,sx1,sz1]); else segs.push([sx0,sz0,sx0,g[1]],[sx0,g[0],sx1,sz1]);
      for(const [x0,z0,x1,z1] of segs){ const L=Math.hypot(x1-x0,z1-z0),cx=(x0+x1)/2,cz=(z0+z1)/2; if(L<.5) continue;
      B(cx,Y+.55,cz,nx?.05:L,1.1,nx?L:.05,'#6b665b',true); B(cx+nx*.01,Y+1.25,cz+nz*.01,nx?.05:L,.3,nx?L:.05,'#7c766b',true);
      const m=Math.floor(L/2.6); for(let i=0;i<m;i++){ const t=(i+.37+((i*7)%5)*.08)/Math.max(1,m),x=x0+(x1-x0)*t+nx*.03,z=z0+(z1-z0)*t+nz*.03,w=.7+((i*13)%7)*.18,h=.35+((i*5)%4)*.22;
        B(x,Y+h/2,z,nx?.05:w,h,nx?w:.05,i%2?'#56643a':'#4d5a34',true); if(i%2===0) B(x+.4*Math.abs(nz),TOP-1.6-1.1,z+.4*Math.abs(nx),nx?.05:.35,2.2,nx?.35:.05,'#837c70',true); } } } }
  // west foot north of the trench: a stone stair-terrace instead of a bare slope down to the wall
  for(let k=0;k<4;k++){ const o=.25+k*.5,top=Y+(k+1)*.65,zc=(-48.3-30.2)/2; B(X0-o-.07,(top+Y-.2)/2,zc,.5,top-Y+.2,18.1,stone,true); B(X0-o-.1,top+.03,zc,.56,.08,18.2,darkStone,true); }
  B(X0-2.15,Y+2.75,(-48.3-30.2)/2,.3,.3,18.2,darkStone,true);   // kerb where the grass begins
  // ---- p3 outworks: coped stone retaining walls + paved trench floor around the west / back wall foot ----
  for(const [x,z,w,d] of HQ_OUTWORKS){ B(x,Y+1.25,z,w,3.1,d,stone); B(x,Y+2.9,z,w+.25,.22,d+.25,darkStone); }
  B(X0-.95,Y-.02,(HQ_OUTWORKS[0][1]),1.4,.1,HQ_OUTWORKS[0][3]-.4,darkStone); B((X0+X1)/2-.7,Y-.02,Z0-.95,X1-X0+1.2,.1,1.4,darkStone);
  for(let z=-50;z>-66;z-=3.2) B(X0-.32,Y+.25,z,.5,.5,.5,darkStone,true);   // drain blocks along the wall foot
  // ---- p3 AAA board frames: wall shadow inset, stepped mahogany moulding (bevel), gilt bead, brass corner rosettes, nameplate + chains ----
  const frameAt=(cx,cy,cz,face,w,h,plate=true)=>{ const nx=face==='w'?-1:face==='e'?1:0, nz=face==='s'?-1:face==='n'?1:0, ax=nz!==0;
    const F=(du,dv,off,bw,bh,bd,c,ex)=>B(cx+(ax?du:0)+nx*off,cy+dv,cz+(ax?0:du)+nz*off,ax?bw:bd,bh,ax?bd:bw,c,true,ex);
    F(0,-.06,.02,w+1.0,h+1.0,.04,'#140906');                                  // soft contact shadow on the wall
    for(const [o,t,d,c] of [[.34,.36,.12,'#3a1a0e'],[.24,.22,.2,mahog],[.12,.1,.26,'#7a3a22']]) {   // three stepped mouldings = bevelled profile
      const W2=w/2+o, H2=h/2+o; F(0,H2-t/2,d/2,w+2*o,t,d,c); F(0,-H2+t/2,d/2,w+2*o,t,d,c); F(W2-t/2,0,d/2,t,h+2*o-2*t,d,c); F(-W2+t/2,0,d/2,t,h+2*o-2*t,d,c); }
    for(const [u,v,L,vert] of [[0,h/2+.03,w+.06,0],[0,-h/2-.03,w+.06,0],[w/2+.03,0,h,1],[-w/2-.03,0,h,1]]) F(u,v,.29,vert?.05:L,vert?L:.05,.05,gold);   // gilt inner bead
    for(const su of [-1,1]) for(const sv of [-1,1]) { const u=su*(w/2+.24), v=sv*(h/2+.24); p.push({kind:'cyl',x:cx+(ax?u:0)+nx*.3,y:cy+v,z:cz+(ax?0:u)+nz*.3,r:.13,r1:.13,h:.06,n:12,c:gold,detail:true,mat:0,rx:ax?Math.PI/2:0,rz:ax?0:Math.PI/2});
      F(u,v,.33,.09,.09,.04,'#8a5a14'); }
    if(plate){ F(0,-h/2-.52,.16,1.2,.24,.06,gold); F(0,-h/2-.52,.2,1.0,.14,.02,'#3a2418'); }
    for(const su of [-1,1]) { F(su*w*.32,h/2+.75,.05,.035,1.0,.035,iron); F(su*w*.32,h/2+.37,.08,.12,.12,.06,gold); }   // brass eyes + hanging chains
  };
  const BY=Y+HQ_BOARD_BAND.y;
  for(const P of HQ_PANELS) frameAt(P.lx,BY,P.lz,P.face,P.w,P.h);
  for(const P of HQ_SQUAD_BOARDS) frameAt(P.lx,BY,P.lz,P.face,P.w,P.h);
  frameAt(HQ.board.lx,HQ.board.y,HQ.lz0+.6,'n',HQ.board.w,HQ.board.h,false);   // the main board
  frameAt(-24.6,Y+4.0,Z1,'n',3.2,.8,false);                                          // referral board outside
  // west wall: ship's wheel + anchor; jolly roger flags; crates and gold by the barrels
  { const wx=IX0+.2, wy=Y+4.3, wz=-60.5; B(wx,wy,wz,.25,.32,.32,wood,true);
    for(let i=0;i<4;i++) B(wx,wy,wz,.12,2.3,.12,wood,true,{rx:i*Math.PI/4});
    for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;B(wx,wy+Math.cos(a)*.82,wz+Math.sin(a)*.82,.16,.66,.14,wood,true,{rx:-a+Math.PI/2});}
    const az=-55.5; B(wx,Y+3.6,az,.18,2.6,.2,iron,true); B(wx,Y+4.65,az,.18,.18,1.3,iron,true); B(wx,Y+5.1,az,.18,.5,.5,iron,true);
    for(const sd of [-1,1]) B(wx,Y+2.5,az+sd*.5,.18,.2,1.15,iron,true,{rx:sd*.55}); }
  for(const [x,z,sg] of [[IX0+.1,-56.6,1],[IX1-.1,-63.4,-1]]) { B(x+sg*.6,Y+10.1,z,1.2,.1,.1,iron,true); B(x+sg*.05,Y+10.1,z,.1,.4,.3,iron,true); B(x+sg*1.2,Y+10.1,z,.14,.14,.14,gold,true); }   // flag brackets (cloth: render.js)
  for(const s of [-1,1]) { B(HQ.board.lx+s*(HQ.board.w/2+1.6),Y+5.5,HQ.board.lz,2.2,8.6,.08,'#1b4d36',true); B(HQ.board.lx+s*(HQ.board.w/2+1.6),Y+9.85,HQ.board.lz+.05,2.4,.16,.16,gold,true); B(HQ.board.lx+s*(HQ.board.w/2+1.6),Y+6.6,HQ.board.lz+.06,1.0,1.0,.04,gold,true); }
  return p;
}
export const HQ_CHANDELIERS = [-37, -46, -55];
export const HQ_TORCHES = [[-32.25,-38.5],[-32.25,-49.5],[-32.25,-56],[-32.25,-63.2],[-5.15,-38.5],[-5.15,-49.5],[-5.15,-56],[-5.15,-63.2]];
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
