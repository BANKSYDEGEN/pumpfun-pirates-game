// Shared low-poly geometry description: runtime + Blender approval renders use these exact parts.
import { HQ, PET_LOT, petFloor } from './site.js';
const stone = '#c9bfae', darkStone = '#8a837a', wood = '#4a3023', green = '#54d08a', roof = '#c8552e', gold = '#ffcd77';
export function hqParts() {
  const p = [], B = (x,y,z,w,h,d,c,detail=false) => p.push({ kind:'box', x,y,z,w,h,d,c,detail,mat:c===stone?11:c===darkStone?22:c===wood?26:c===roof?4:0 });
  const Y=HQ.floor;
  B(-18.5,Y-.03,-39.3,28.8,.12,18.5,darkStone);
  B(-32.7,Y+4.8,-39.5,.6,9.6,19,stone); // East side door faces the Treasure Trader / hill street; same 4.6 m clear height as front.
  B(-4.3,Y+4.8,-46.5,.6,9.6,5,stone);B(-4.3,Y+4.8,-35,.6,9.6,10,stone);
  B(-4.3,Y+7.1,-42,.6,5,4,stone);
  for(const z of [-44.3,-39.7])B(-3.95,Y+2.3,z,.8,4.6,.5,darkStone);
  B(-3.95,Y+4.85,-42,.8,.5,5.1,darkStone);
  B(-3.5,Y+4.5,-42,1.5,.18,4.8,wood);
  B(-3.3,Y+.025,-42,1.4,.25,4, darkStone); // one small stone doorstep, top = floor + .15
  for (const x of [-27.25,-9.75]) B(x,Y+4.8,-30.3,11.5,9.6,.6,stone);
  B(-18.5,Y+7.1,-30.3,6,5,.6,stone); // tall open doorway, no threshold
  B(-18.5,Y+4.8,-56.5,29,9.6,17,stone); // enclosed rear mass reaches the trader's edge
  for (const x of [-33,-4]) { B(x,Y+4.8,-30.1,.65,9.6,.85,darkStone); B(x,Y+4.8,-48,.65,9.6,.85,darkStone); }
  B(-18.5,Y+7.98,-39,28,.35,18.4,wood); // 7.8 m clear underside
  for(const z of [-30.3,-48.3]) B(-18.5,Y+9.65,z,29.6,.3,.75,darkStone);
  // Same 0.55 pitch, terracotta tile layer and timber eaves as plaza stoneHouse.
  const half=10, pitch=.55;
  for(const side of [-1,1]) { B(-18.5,Y+9.8+Math.tan(pitch)*half/2,-39.2+side*half/2,30,.32,half/Math.cos(pitch),roof);p[p.length-1].rx=side*pitch; }
  B(-18.5,Y+9.8+Math.tan(pitch)*half,-39.2,30.1,.35,.45,roof);
  for(const x of [-32.9,-4.1]) p.push({kind:'gable',x,y:Y+9.8,z:-39.2,w:.25,h:Math.tan(pitch)*half,d:20,c:stone,mat:11});
  B(-18.5,Y+9.8,-56.5,29,.4,17.4,roof);
  B(-18.5,Y+8.6,-29.6,21,2.2,.25,wood);
  for (const y of [Y+7.47,Y+9.72]) B(-18.5,y,-29.9,21.25,.1,.18,gold);
  for(const x of [-30,-7]) { B(x,Y+3.6,-29.9,.9,2.9,.2,wood); B(x,Y+3.6,-29.77,.68,2.65,.08,green); }
  // shuttered harbor windows and green canopy: pirate stone + timber, no extra textures.
  for(const x of [-28,-9]) { B(x,Y+2.9,-29.93,4.6,3.3,.18,wood); B(x,Y+2.9,-29.81,3.5,2.6,.1,'#2b3d4a'); B(x,Y+2.9,-29.71,.12,2.6,.12,gold); B(x,Y+2.9,-29.71,3.5,.12,.12,gold); }
  B(-18.5,Y+4.7,-29.4,7.2,.18,1.5,wood);
  // structural timber ribs, benches and warm lantern cores (no realtime lights)
  for(const z of [-33,-39,-46]) { B(-18.5,Y+7.65,z,28,.25,.24,wood,true); }
  for(const x of [-30.5,-6.5]) { B(x,Y+.5,x===-6.5?-34:-42,1.1,1,5.3,wood,true); }
  for(const x of [-31,-6]) for(const z of [-34,-44]) { B(x,Y+3.8,z,.4,.65,.4,gold,true); B(x,Y+4.2,z,.6,.12,.6,wood,true); }
  B(HQ.board.lx,HQ.board.y,HQ.board.lz-.12,HQ.board.w+.45,HQ.board.h+.45,.25,wood);
  B(HQ.board.lx,HQ.board.y,HQ.board.lz+.025,HQ.board.w+.2,HQ.board.h+.2,.07,gold);
  return p;
}
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
