// Shared low-poly geometry description: runtime + Blender approval renders use these exact parts.
import { HQ, HQ_OUTWORKS, HQ_TOWERS, HQ_PILLARS, HQ_PROPS, HQ_PANELS, HQ_SQUAD_BOARDS, HQ_BOARD_BAND, PET_LOT, petFloor, PET_STORE, PET_DZ, PET_PROPS } from './site.js';
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
  for(let i=0;i<13;i++){const a=Math.PI*(i+.5)/13; B(HQ.door.lx+Math.cos(a)*(GR-.12),GS+Math.sin(a)*(GR-.12),Z1-.25,.6,.2,1.3,darkStone,true,{rz:a-Math.PI/2});}   // arch soffit, inset 0.2 m under the stepped infill (no shared plane)
  for(const s of [-1,1]) { const bx=HQ.door.lx+s*3.6; B(bx,Y+3.4,Z1+1.35,.12,.12,.4,iron,true); B(bx,Y+3.55,Z1+1.55,.12,.5,.12,wood,true); B(bx,Y+3.95,Z1+1.55,.22,.38,.22,flame,true,{glow:true}); }
  B(HQ.door.lx,GS+GR+.85,Z1+1.25,.95,1.15,.3,gold); B(HQ.door.lx,GS+GR+.95,Z1+1.42,.55,.5,.06,bone,true); B(HQ.door.lx,GS+GR+.6,Z1+1.42,.3,.14,.06,bone,true);

  // ---- Hill Street door (east wall): dressed jambs, lintel, iron-strapped timber leaves folded open inside ----
  { const R=HD.w/2;
    for(const s of [-1,1]) { const z=HD.lz+s*(R+.37); B(X1-.35,Y+HD.h/2,z,1.5,HD.h,.8,darkStone); B(X1+.25,Y+.5,z+s*.05,.5,1.0,1.0,darkStone); B(X1-.35,Y+HD.h+.12,z,1.6,.24,.95,darkStone);   // thick jambs, plinth, impost
      B(X1+.25,Y+3.0,z+s*.85,.4,.12,.12,iron,true); B(X1+.48,Y+3.1,z+s*.85,.12,.5,.12,wood,true); B(X1+.48,Y+3.5,z+s*.85,.2,.35,.2,flame,true,{glow:true}); }   // street torches
    for(let i=0;i<11;i++){const a=Math.PI*(i+.5)/11; B(X1-.3,Y+HD.h+Math.sin(a)*(R+.35),HD.lz+Math.cos(a)*(R+.35),1.4,.62,.62,darkStone,false,{rx:-(a-Math.PI/2)});}
    for(let i=0;i<13;i++){const a=Math.PI*(i+.5)/13; B(X1+.05,Y+HD.h+Math.sin(a)*(R+.95),HD.lz+Math.cos(a)*(R+.95),.6,.22,.55,darkStone,false,{rx:-(a-Math.PI/2)});}
    B(X1+.32,Y+HD.h+R+.95,HD.lz,.3,1.0,.85,gold); B(X1+.49,Y+HD.h+R+1.0,HD.lz,.05,.45,.5,bone,true);   // gilt keystone
    B(X1+.18,Y+HD.h+R+2.3,HD.lz,.18,1.1,3.7,mahog); B(X1+.23,Y+HD.h+R+2.3,HD.lz,.1,1.24,3.86,gold);   // carved sign board (face drawn in render.js)
    B(X1-.5,Y+.03,HD.lz,2.6,.03,HD.w-.04,darkStone,true);   // threshold 1.5 cm above the deck top (was coplanar-ish: flicker)
  }
  // ---- fortress exterior: plinth, string course, crenellated parapet on all four walls, flat lead-and-stone roof ----
  for(const [a,b] of [[X0-.15,HQ.door.lx-HQ.door.w/2-.9],[HQ.door.lx+HQ.door.w/2+.9,X1+.15]]) B((a+b)/2,Y+.6,Z1+.12,b-a,1.4,.3,darkStone);   // plinth stops at the gate: open to the floor
  B(HQ.door.lx,Y+.03,Z1-.3,HQ.door.w-.04,.03,1.6,darkStone,true);   // flush threshold B(X0-.1,Y+.6,CZ,.3,1.4,D,darkStone);
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
  B(-18.5,Y+10.6,Z1+.2,18.4,2.3,.3,mahog); B(-18.5,Y+10.6,Z1+.3,18.7,2.6,.14,gold);    // carved timber sign in a stone frame // HQ sign board
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
  // BANKSY t303u: wall lanterns removed; iron lanterns hang on chains from the ceiling over each board row (glow core unlit, pools in render.js)
  for(const [x,z] of HQ_LANTERNS) { const ly=Y+HQ_LANTERN_Y; B(x,(CEIL+ly+.75)/2,z,.05,CEIL-ly-.75,.05,iron,true); B(x,ly+.78,z,.12,.12,.12,gold,true);
    p.push({kind:'cyl',x,y:ly+.6,z,r:.06,r1:.36,h:.28,n:8,c:iron,detail:true}); B(x,ly+.44,z,.62,.06,.62,iron,true); B(x,ly-.44,z,.56,.07,.56,iron,true); p.push({kind:'cyl',x,y:ly-.58,z,r:.2,r1:.04,h:.2,n:8,c:iron,detail:true});
    for(const sx of [-1,1]) for(const sz of [-1,1]) B(x+sx*.27,ly,z+sz*.27,.05,.88,.05,iron,true); B(x,ly,z,.44,.8,.44,flame,true,{glow:true}); }

  // casino-style wall: gilt cap rail over the damask (render.js paints the damask panels), crimson/green banners between pillars
  for(const [x,z,w,d] of [[IX0+.05,CZ,.16,IZ1-IZ0],[CX,IZ0+.05,IX1-IX0,.16],[IX1-.05,CZ,.16,IZ1-IZ0]]) B(x,Y+7.25,z,w,.14,d,gold,true);
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
  const slit=(x,y,z,nx,nz)=>{ const R=(u,v,a,b,dep,c=stone)=>B(x+nx*dep/2+(nx?0:u),y+v,z+nz*dep/2+(nx?u:0),nx?dep:a,b,nx?a:dep,c);   // u along the wall, v up
    R(-.32,0,.22,2.7,.34); R(.32,0,.22,2.7,.34); R(0,1.42,.86,.26,.4); R(0,-1.42,.86,.22,.44);   // dressed jambs, head and sill stand proud: the loop sits 0.3 m deep
    for(const s2 of [-1,1]) B(x+nx*.15+(nx?0:s2*.3),y+.2,z+nz*.15+(nx?s2*.3:0),nx?.3:.38,.2,nx?.38:.3,stone,true);   // cross-arm reveals
    B(x+nx*.04,y,z+nz*.04,nx?.06:.42,2.62,nx?.42:.06,'#140d08',true); B(x+nx*.04,y+.2,z+nz*.04,nx?.06:1.0,.18,nx?1.0:.06,'#140d08',true);   // shadowed recess
    B(x+nx*.09,y,z+nz*.09,nx?.04:.12,2.2,nx?.12:.04,'#050302',true); B(x+nx*.09,y+.2,z+nz*.09,nx?.04:.78,.08,nx?.78:.04,'#050302',true); };   // the loop itself
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
  // ---- BANKSY t303u facade tidy: the p5 weathering (flat grey damp band, flat green moss, flat rain streaks) is gone; the east, west and back
  // walls get the same dressed darkStone plinth as the front (world-aligned library texture), broken at the Hill Street arch ----
  { const P=(x,z,w,d)=>{ if(w>.3&&d>.3){ B(x,Y+.6,z,w,1.4,d,darkStone); } };
    const za=HD.lz+HD.w/2+1.0, zb=HD.lz-HD.w/2-1.0;
    P(X1+.12,(Z1+za)/2,.3,Z1-za); P(X1+.12,(zb+Z0)/2,.3,zb-Z0); P(X0-.12,CZ,.3,D+.24); P(CX,Z0-.12,X1-X0+.54,.3); }
  // west foot north of the trench: a stone stair-terrace instead of a bare slope down to the wall
  for(let k=0;k<4;k++){ const o=.25+k*.5,top=Y+(k+1)*.65,zc=(-48.3-30.2)/2; B(X0-o-.07,(top+Y-.2)/2,zc,.5,top-Y+.2,18.1,stone,true); B(X0-o-.1,top+.03,zc,.56,.08,18.2,darkStone,true); }
  B(X0-2.15,Y+2.75,(-48.3-30.2)/2,.3,.3,18.2,darkStone,true);   // kerb where the grass begins
  // ---- p8: paved yard at the trench's north end (was bare sloping grass): flagstones level with the trench, coped retaining kerb holding the hill
  // p9: one raised flagstone bed (top Y+.14, a walkable 14 cm lip) over the whole flattened yard, wide coped kerbs hiding the terrain seam
  { const x0=-46.9, x1=-34.6, z0=-56.6, z1=-48.2, cx=(x0+x1)/2, cz=(z0+z1)/2;
    B(cx,Y-.1,cz,x1-x0,.48,z1-z0,stone); for(let i=1;i<7;i++) B(x0+i*(x1-x0)/7,Y+.145,cz,.06,.02,z1-z0-.2,darkStone,true); for(let j=1;j<4;j++) B(cx,Y+.145,z0+j*(z1-z0)/4,x1-x0-.2,.02,.06,darkStone,true);
    B(cx-.3,Y+.5,z0-.6,x1-x0+1.8,1.2,1.2,stone); B(cx-.3,Y+1.16,z0-.6,x1-x0+2.0,.14,1.35,darkStone);   // south retaining kerb (holds the hill), runs under the west kerb corner
    B(x0-.6,Y-.05,cz+.3,1.2,.5,z1-z0+.6,darkStone);   // west edge: flush kerb into Main Street (walkable)
    B(x0-.6,Y+1.3,z0-.6,1.5,.3,1.5,darkStone); }   // corner cap where the kerbs meet
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
  frameAt(-25.2,Y+5.5,Z1+.4,'n',4.2,1.575,false);   // BANKSY t303u: raised level with the skull banner, clear of the gate torch and the string course   // referral board outside: centred in the bay left of the gate, mirrors the banner
  B(-25.2,Y+5.5,Z1+.26,4.5,1.9,.28,mahog);   // backing block proud of the string course
  B(-11.8,Y+6.85,Z1+.75,2.1,.07,.07,iron,true); for(const s of [-1,1]) B(-11.8+s*.9,Y+6.85,Z1+.4,.07,.07,.75,iron,true);   // banner rod + wall brackets
  // west wall: jolly roger flags; crates and gold by the barrels (anchor stand removed, BANKSY 1:12 AM)
  // (BANKSY 1:16 AM: no blind arch / wheel opposite Hill Street; plain damask wall there)
  for(const [x,z,sg] of [[IX0+.1,-49.3,1],[IX1-.1,-47.0,-1]]) { B(x+sg*.6,Y+10.1,z,1.2,.1,.1,iron,true); B(x+sg*.05,Y+10.1,z,.1,.4,.3,iron,true); B(x+sg*1.2,Y+10.1,z,.14,.14,.14,gold,true); }   // flag brackets (cloth: render.js)
  for(const s of [-1,1]) { B(HQ.board.lx+s*(HQ.board.w/2+1.6),Y+5.5,HQ.board.lz,2.2,8.6,.08,'#1b4d36',true); B(HQ.board.lx+s*(HQ.board.w/2+1.6),Y+9.85,HQ.board.lz+.05,2.4,.16,.16,gold,true); B(HQ.board.lx+s*(HQ.board.w/2+1.6),Y+6.6,HQ.board.lz+.06,1.0,1.0,.04,gold,true); }
  return p;
}
export const HQ_CHANDELIERS = [-37, -46, -55];
export const HQ_TORCHES = [];   // BANKSY t303u: no wall lanterns in the hall
export const HQ_LANTERN_Y = 8.1;   // lantern centre above the floor, clear of the board frames (top ~ floor+6.9)
export const HQ_LANTERNS = [-27.6,-9.4].flatMap(x=>[-35.85,-44,-52.15,-59.5].map(z=>[x,z]));
// [post-petstore] PET STORE (L4) shell: merged into the plaza stone kit (always drawn, like the HQ). Stone pirate house front on the Main
// Street building line, arched walk-through doorway, quoins, string courses, gabled tile roof (gable end to the street), no awning.
// Inside: plank floor, mahogany wainscot to 1.3 m, plaster above, beamed 7 m ceiling. Props + flames + chandeliers: petParts() (near only).
export function petShellParts() {
  const p=[], stone='#c9bfae', darkStone='#8a837a', wood='#4a3023', roof='#c8552e', mahog='#5a2a1a', plaster='#e6d8bb', gold='#ffcd77', iron='#2b2a28', glass='#22323c';
  const mat=c=>c===stone?11:c===darkStone?22:c===wood?26:c===roof?4:0;
  const B=(x,y,z,w,h,d,c,detail=false,ex)=>p.push({kind:'box',x,y,z,w,h,d,c,detail,mat:mat(c),...ex});
  const S=PET_STORE, F=S.floor, X0=S.x0, X1=S.x1, Z0=S.z0, Z1=S.z1, T=F+S.top, WL=S.wall, I=S.I, D=S.door, CZ=(Z0+Z1)/2, L=X1-X0, Wd=Z1-Z0;
  const dz0=D.lz-D.w/2, dz1=D.lz+D.w/2, R=D.w/2, SP=F+D.h;   // arch springing
  // walls (stone), plinth down into the sloping street, back + sides full height
  B(X0+WL/2,(T+F-1.4)/2,CZ,WL,T-F+1.4,Wd,stone); for(const z of [Z0+WL/2,Z1-WL/2]) B((X0+X1)/2,(T+F-1.4)/2,z,L,T-F+1.4,WL,stone);
  const fx=X1-WL/2; B(fx,(T+F-1.4)/2,(Z0+dz0-.3)/2,WL,T-F+1.4,dz0-.3-Z0,stone); B(fx,(T+F-1.4)/2,(dz1+.3+Z1)/2,WL,T-F+1.4,Z1-dz1-.3,stone);
  for(let i=0;i<12;i++){const z0=-R-.3+i*(D.w+.6)/12+(D.w+.6)/24, yy=SP+Math.sqrt(Math.max(0,(R+.3)*(R+.3)-z0*z0)); B(fx,(yy+T)/2,D.lz+z0,WL,T-yy,(D.w+.6)/12+.01,stone);}
  for(const s of [-1,1]) B(fx,F+D.h/2-.7,D.lz+s*(R+.15),WL,D.h+1.4,.3,stone);   // jamb returns
  // arched doorway: dressed jambs, voussoirs, gilt keystone, flush threshold
  for(const s of [-1,1]){ B(X1+.05,F+D.h/2,D.lz+s*(R+.25),.4,D.h,.5,darkStone); B(X1+.05,F+.35,D.lz+s*(R+.3),.55,.7,.65,darkStone); B(X1+.08,SP+.08,D.lz+s*(R+.3),.5,.16,.62,darkStone); }
  for(let i=0;i<11;i++){const a=Math.PI*(i+.5)/11; B(X1+.05,SP+Math.sin(a)*(R+.28),D.lz+Math.cos(a)*(R+.28),.45,.56,.5,darkStone,false,{rx:-(a-Math.PI/2)});}
  B(X1+.25,SP+R+.45,D.lz,.25,.75,.55,gold); B(X1-.2,F+.01,D.lz,1.4,.04,D.w,darkStone,true);
  // arched windows either side (iron grille, stone sill + head), upper-floor windows with shutters
  const win=(z,y,w,h,detail)=>{ B(X1+.02,y,z,.08,h,w,glass,detail); B(X1+.12,y-h/2-.08,z,.3,.16,w+.4,darkStone,detail); for(let i=0;i<9;i++){const a=Math.PI*(i+.5)/9;B(X1+.08,y+h/2+Math.sin(a)*(w/2+.12),z+Math.cos(a)*(w/2+.12),.22,.26,.3,darkStone,detail,{rx:-(a-Math.PI/2)});}
    B(X1+.06,y+h/2+w/4,z,.06,w/2,w*.86,glass,detail); for(let i=1;i<4;i++) B(X1+.09,y,z-w/2+i*w/4,.05,h,.05,iron,true); B(X1+.09,y,z,.05,.05,w,iron,true); };
  win((-117.4+PET_DZ),F+2.0,1.5,2.1,false); win((-111.55+PET_DZ),F+2.0,1.0,2.1,false);
  for(const z of [(-117.4+PET_DZ),(-111.55+PET_DZ)]){ win(z,F+5.6,1.0,1.4,true); for(const s of [-1,1]) B(X1+.08,F+5.7,z+s*.85,.06,1.6,.55,'#2e5a46',true); }
  // quoins, string courses, cornice
  for(const z of [Z0+.25,Z1-.25]) for(let k=0;k<11;k++) B(X1+.04,F-.6+k*.82,z+(k%2?0:(z<CZ?.18:-.18)),.1,.62,k%2?.5:.86,darkStone,true);
  B(X1+.08,F+4.62,(Z0+D.lz-R-.7)/2,.3,.24,D.lz-R-.7-Z0,darkStone); B(X1+.08,F+4.62,(D.lz+R+.7+Z1)/2,.3,.24,Z1-D.lz-R-.7,darkStone);
  B(X1+.1,F+5.45,D.lz,.2,1.15,4.0,'#5a2a1a'); B(X1+.06,F+5.45,D.lz,.16,1.3,4.15,gold,true);   // carved sign board over the arch (face: render.js)
  B(X1+.7,F+4.35,Z0+.7,1.4,.08,.08,iron,true); B(X1+.08,F+4.1,Z0+.7,.08,.6,.08,iron,true); B(X1+.35,F+4.12,Z0+.7,.55,.06,.06,iron,true,{rz:.75});   // hanging-sign bracket B(X1+.12,T-.2,CZ,.4,.4,Wd+.3,darkStone); B(X1+.06,F-.55,CZ,.2,1.0,Wd,darkStone);
  for(const z of [Z0-.08,Z1+.08]) B((X0+X1)/2,F+4.62,z,L,.24,.2,darkStone,true);
  // gabled tile roof, ridge along x (gable end to the street), stone gable infills, ridge tiles, chimney
  B(X1-WL/2,T,CZ,WL,.01,Wd,stone);
  p.push({kind:'gable',x:X1-WL/2,y:T,z:CZ,w:WL,h:3.0,d:Wd,c:stone,mat:11,detail:false}); p.push({kind:'gable',x:X0+WL/2,y:T,z:CZ,w:WL,h:3.0,d:Wd,c:stone,mat:11,detail:false});
  p.push({kind:'gable',x:(X0+X1)/2,y:T+.12,z:CZ,w:L+.9,h:3.25,d:Wd+1.1,c:roof,mat:4,detail:false});
  B((X0+X1)/2,T+3.3,CZ,L+1.0,.22,.38,darkStone); B(X0+3,T+2.6,Z0+2.2,1.0,3.0,1.0,stone); B(X0+3,T+4.15,Z0+2.2,1.2,.2,1.2,darkStone);
  // interior: plank floor, wainscot, plaster, beamed ceiling
  B((I.lx0+I.lx1)/2,F-.12,(I.lz0+I.lz1)/2,I.lx1-I.lx0,.24,I.lz1-I.lz0,wood);
  const C=F+S.ceil; B((I.lx0+I.lx1)/2,C+.1,(I.lz0+I.lz1)/2,I.lx1-I.lx0,.2,I.lz1-I.lz0,'#3a2418');
  for(const z of [I.lz0+.03,I.lz1-.03]) { B((I.lx0+I.lx1)/2,F+.65,z,I.lx1-I.lx0,1.3,.06,mahog); B((I.lx0+I.lx1)/2,F+1.33,z+(z<CZ?.04:-.04),I.lx1-I.lx0,.08,.1,gold,true); B((I.lx0+I.lx1)/2,(F+1.37+C)/2,z,I.lx1-I.lx0,C-F-1.37,.04,plaster); }
  B(I.lx0+.03,F+.65,(I.lz0+I.lz1)/2,.06,1.3,I.lz1-I.lz0,mahog); B(I.lx0+.03,(F+1.3+C)/2,(I.lz0+I.lz1)/2,.04,C-F-1.3,I.lz1-I.lz0,plaster);
  for(const s of [-1,1]){ const zc=s<0?(I.lz0+dz0-.3)/2:(dz1+.3+I.lz1)/2, wz=s<0?dz0-.3-I.lz0:I.lz1-dz1-.3; B(I.lx1-.03,F+.65,zc,.06,1.3,wz,mahog); B(I.lx1-.03,(F+1.3+C)/2,zc,.04,C-F-1.3,wz,plaster); }
  for(let x=I.lx0+1.2;x<I.lx1-.5;x+=2.2){ B(x,C-.22,(I.lz0+I.lz1)/2,.34,.44,I.lz1-I.lz0,wood); for(const z of [I.lz0+.2,I.lz1-.2]) B(x,C-.85,z+(z<CZ?.25:-.25),.26,.26,.9,wood,true,{rx:z<CZ?-.6:.6}); }
  B((I.lx0+I.lx1)/2,C-.5,(I.lz0+I.lz1)/2,I.lx1-I.lx0,.3,.3,wood); B((I.lx0+I.lx1)/2,C-.66,(I.lz0+I.lz1)/2,I.lx1-I.lx0,.04,.34,gold,true);
  return p;
}
// near-only detail (render.js buildPetDress): counter, shelves, parrot cages, play tree, perches, toy rack, rugs, chandeliers + flames
export const PET_CHANDELIERS = [[-5.6,(-114.78+PET_DZ)],[-10.6,(-114.78+PET_DZ)]];
export const PET_LAMPS = [];
export const PET_PARROTS = [];   // [x, perchY, z, yaw, palette 0 scarlet / 1 blue-gold / 2 green-wing]
export const PET_RINGS = [[-5.2,(-117.2+PET_DZ)],[-8.2,(-117.4+PET_DZ)],[-5.2,(-110.9+PET_DZ)]];   // hanging brass ring perches
export function petParts() {
  const p=[], wood='#4a3023', mahog='#5a2a1a', dark='#2a160d', gold='#ffcd77', iron='#2b2a28', flame='#ffb347', candle='#f3e6c4', water='#2f8fa8', sand='#d8c38a', straw='#c9a64a', red='#7a1d22', green='#2e6b55';
  const B=(x,y,z,w,h,d,c,detail=false,ex)=>p.push({kind:'box',x,y,z,w,h,d,c,detail,...ex}), Cy=(x,y,z,r,r1,h,n,c,detail=false,ex)=>p.push({kind:'cyl',x,y,z,r,r1,h,n,c,detail,...ex});
  const S=PET_STORE, F=S.floor, C=F+S.ceil; PET_LAMPS.length=0; PET_PARROTS.length=0;
  for(const [k,x,z,w,d] of PET_PROPS){
    if(k==='counter'){ B(x,F+.55,z,w,1.1,d,mahog); B(x+.05,F+1.13,z,w+.25,.08,d+.25,dark); for(let i=0;i<6;i++) B(x+w/2+.02,F+.55,z-d/2+.47+i*(d-.94)/5,.04,.8,.6,'#6b3420',true); B(x+w/2+.04,F+.95,z,.03,.06,d-.1,gold,true);
      B(x,F+1.3,z-1.6,.5,.3,.4,gold,true); for(const dz of [-.3,.2,.7]) Cy(x-.1,F+1.24,z+1.2+dz*.6,.12,.12,.18,10,dz>0?'#9b6a2a':'#c58b3c',true); }   // till, seed jars
    if(k==='shelf'){ B(x,F+1.4,z,w,2.8,d,mahog); for(const y of [.55,1.15,1.75,2.35]) B(x+.32,F+y,z,.06,.06,d-.1,dark,true);
      for(let i=0;i<10;i++) for(const y of [.75,1.95]) Cy(x+.15,F+y,z-d/2+.4+i*(d-.8)/9,.13,.13,.34,8,['#c9a64a','#8a5a2b','#b5653a'][i%3],true);
      for(let i=0;i<5;i++) B(x+.15,F+1.37,z-d/2+.7+i*(d-1.4)/4,.4,.42,.55,straw,true); B(x+.28,F+3.4,z,.08,.9,d-.6,dark); B(x+.31,F+3.4,z,.04,1.0,d-.4,gold,true); }   // sign board (canvas in render.js)
    if(k==='cage'){ Cy(x,F+.4,z,.12,.2,.8,10,dark); Cy(x,F+.82,z,.45,.45,.06,16,'#3a2418'); B(x,F+1.2,z,.7,.03,.03,wood,true); }   // brass cage: petlook.js
    if(k==='perch'){ Cy(x,F+.05,z,.45,.5,.1,12,dark); Cy(x,F+1.0,z,.06,.07,1.9,8,wood); B(x,F+1.9,z,.08,.08,1.3,wood); B(x,F+1.55,z,.08,.08,.9,wood,false,{rx:Math.PI/2}); Cy(x,F+1.2,z+.35,.13,.1,.12,10,'#b5653a',true); }
    if(k==='bigcage'){ B(x,F+.4,z,w,.8,d,mahog); B(x,F+.83,z,w+.1,.06,d+.1,dark); B(x,F+.88,z,w-.1,.04,d-.1,'#d8c38a',true);   // ornate dome cage on a mahogany stand
      B(x,F+1.5,z,1.0,.04,.04,wood,true); B(x,F+1.9,z+.2,.04,.04,.8,wood,true,{ry:Math.PI/2}); }   // brass dome cage, swing, seed cup: petlook.js
    if(k==='tree'){ Cy(x,F+.15,z,.75,.8,.3,14,'#3a2418'); Cy(x,F+.31,z,.68,.68,.03,14,'#c9b087',true); Cy(x,F+1.4,z,.11,.16,2.2,8,'#6b4a2f');   // parrot play tree
      for(const [y,ry,L] of [[1.1,0,1.3],[1.6,1.1,1.1],[2.1,2.3,1.2],[2.45,.5,.9]]) B(x,F+y,z,L,.07,.07,'#7a5636',false,{ry}); Cy(x,F+2.55,z,.3,.3,.04,12,'#7a5636',true);
      for(const [dx,dz,c] of [[.5,.1,'#e84d2b'],[-.45,-.2,'#2a6fd8'],[.15,.4,'#f2c230']]){ B(x+dx,F+.95,z+dz,.02,.25,.02,iron,true); B(x+dx,F+.78,z+dz,.1,.1,.1,c,true); } }
    if(k==='toyrack'){ B(x,F+1.2,z+.2,w,2.4,.08,wood); B(x,F+.3,z,w,.6,d,mahog); B(x,F+.62,z,w+.06,.05,d+.06,dark);   // cuttlebone + toy rack against the north wall
      for(const y of [1.1,1.65,2.2]) B(x,F+y,z+.05,w-.1,.05,.3,dark,true);
      for(let i=0;i<6;i++){ const tx=x-w/2+.25+i*(w-.5)/5; B(tx,F+1.3,z+.08,.09,.32,.03,'#efe6cf',true); B(tx,F+1.85,z+.05,.13,.13,.13,['#e84d2b','#2a6fd8','#f2c230','#2ea84a','#9b4dd8','#ff8a3c'][i],true); Cy(tx,F+2.35,z+.05,.08,.08,.22,8,['#c9a64a','#b5653a'][i%2],true); }
      for(let i=0;i<4;i++) B(x-.75+i*.5,F+.85,z-.05,.36,.42,.3,['#c9b087','#d6c29a'][i%2],true); }
    if(k==='stand'){ Cy(x,F+.05,z,.3,.32,.1,12,dark); Cy(x,F+.8,z,.05,.06,1.5,8,wood); B(x,F+1.55,z,.06,.06,.7,wood); B(x,F+1.5,z+.3,.12,.06,.12,'#c58b3c',true); }
  }
  const parrot=(x,y,z,ry,pal)=>PET_PARROTS.push([x,y,z,ry,pal]);   // sculpted instanced macaws: petlook.js
  const pc=[[0],[1],[2],[0]];
  for(const [k,x,z,w,d] of PET_PROPS){ const i=Math.abs(Math.round(z))%4;
    if(k==='perch'){ parrot(x,F+1.94,z-.35,0,...pc[i]); parrot(x,F+1.94,z+.35,Math.PI,...pc[(i+1)%4]); parrot(x,F+1.94,z,Math.PI/2,...pc[(i+2)%4]); }
    if(k==='bigcage'){ parrot(x-.25,F+1.54,z,Math.PI*.3,...pc[i]); parrot(x+.3,F+1.94,z+.2,-Math.PI*.4,...pc[(i+2)%4]); }
    if(k==='tree'){ parrot(x+.5,F+1.14,z,Math.PI/2,...pc[i]); parrot(x-.3,F+1.64,z+.2,0,...pc[(i+1)%4]); parrot(x+.2,F+2.14,z-.3,Math.PI,...pc[(i+3)%4]); }
    if(k==='stand') parrot(x,F+1.59,z-.15,-Math.PI/2,...pc[(i+1)%4]);
    if(k==='cage') parrot(x,F+1.22,z,Math.PI*.7,...pc[(i+3)%4]);
    if(k==='counter'){ Cy(x,F+1.3,z-.4,.16,.16,.28,12,'#d6c29a',true); Cy(x,F+1.46,z-.4,.17,.17,.05,12,'#7a1d22',true); B(x,F+1.2,z+.5,.5,.06,.3,'#7a5636',true); }   // seed tin + perch tray
    if(k==='sacks') for(let j=0;j<3;j++){ const sx=x+(j%2?.2:-.2)*(w/.9),sz=z+(j-1)*.22,top=j===2; Cy(sx,F+(top?.85:.32),sz-(top?.22:0),.26,.3,.62,10,['#c9b087','#b89a6a','#d6c29a'][j]); Cy(sx,F+(top?1.2:.67),sz-(top?.22:0),.1,.22,.12,8,'#a68a5a',true); B(sx+.27,F+(top?.85:.32),sz-(top?.22:0),.02,.24,.3,['#7a1d22','#2e6b55','#1d2a3f'][j],true); }
  }
  // rugs, hanging bird hoops, wall lamps, chandeliers (iron ring + candles + flames = glow parts, painted pools in render.js)
  PET_RINGS.forEach(([x,z],i)=>{ B(x,C-1.07,z,.025,2.15,.025,iron,true); B(x,C-2.83,z,.62,.045,.045,wood,true); if(i===0) parrot(x,C-2.81,z,Math.PI/2,1); });
  for(const [x,z] of PET_CHANDELIERS){ B(x,C-.9,z,.05,1.8,.05,iron,true); Cy(x,C-1.85,z,.95,.95,.08,18,iron); Cy(x,C-1.6,z,.15,.15,.5,8,iron,true);
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2,cx=x+Math.cos(a)*.95,cz=z+Math.sin(a)*.95; B(cx,C-1.72,cz,.08,.24,.08,candle,true,{glow:true}); B(cx,C-1.53,cz,.06,.14,.06,flame,true,{glow:true});} }
  for(const z of [(-116.7+PET_DZ),(-111.45+PET_DZ)]){ const x=S.I.lx1-.15; B(x,F+2.6,z,.1,.4,.1,iron,true); B(x-.18,F+2.85,z,.22,.32,.22,flame,true,{glow:true}); PET_LAMPS.push([x,z]); }
  for(const s of [-1,1]){ const z=S.door.lz+s*(S.door.w/2+.75); B(S.x1+.25,F+2.9,z,.4,.1,.1,iron,true); B(S.x1+.45,F+3.05,z,.12,.45,.12,wood,true); B(S.x1+.45,F+3.45,z,.22,.35,.22,flame,true,{glow:true}); }   // street torches
  return p;
}

// Closed triangular prism, shared with the approval renderer.
export function gableVertices(p) {
 const v=[[-p.w/2,0,-p.d/2],[-p.w/2,0,p.d/2],[-p.w/2,p.h,0],[p.w/2,0,-p.d/2],[p.w/2,0,p.d/2],[p.w/2,p.h,0]];
 return [0,2,1,3,4,5,0,1,4,0,4,3,1,2,5,1,5,4,2,0,3,2,3,5].flatMap(i=>v[i]);
}
