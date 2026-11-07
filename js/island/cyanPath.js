// BANKSY cyan markers 1–44: foot coordinates, client-only. 37–42 branch from 24 to the rope bridge.
import * as THREE from 'three';
import { Kit, M } from './kit.js';
export const CYAN_ON = !(typeof location !== 'undefined' && /[?&]cyanpath=0(?:&|$)/.test(location.search));
export const MARKERS = [[-278.98, -70.67, 26.38], [-272.29, -64.86, 26.27], [-262.78, -58.99, 26.21], [-251.4, -58.24, 24.91], [-240.45, -56.82, 24.3], [-229.02, -57.13, 23.75], [-217.39, -55.66, 23.53], [-205.28, -54.74, 23.47], [-194.68, -52.98, 23.77], [-185.17, -50.59, 24.26], [-174.04, -49.69, 24.97], [-163.89, -47.36, 25.09], [-153.25, -46.75, 23.84], [-142.44, -45.38, 23.04], [-132.03, -41.7, 20.93], [-120.77, -41.93, 22.69], [-108.59, -41.5, 23.52], [-96.8, -39.91, 24.64], [-85.47, -38.77, 27.12], [-73.84, -36.09, 30.15], [-62.24, -35.46, 34.09], [-50.71, -35.32, 38.09], [-40.22, -33.98, 41.04], [-28.97, -34.23, 44], [-33.78, -24.77, 44.47], [-31.44, -13.68, 46.89], [-24.21, -4.55, 50.83], [-16.15, 4.3, 55.37], [-7.61, 11.12, 60.53], [1.17, 18.85, 64.5], [9.97, 27.31, 68.96], [19, 37.6, 73.91], [28.69, 47.72, 79.38], [36.54, 55.91, 83.4], [44.69, 64.95, 87.76], [54.49, 75.31, 91.43], [-18.51, -35.77, 46.17], [-8.64, -37.66, 47.25], [0.86, -40.65, 47.79], [9.64, -42.19, 47.45], [14.85, -48.85, 44.71], [15.53, -56.39, 38.94], [-270.14, -75.73, 27.17], [-259.39, -215.48, 52.23]];
export const ROUTES = [MARKERS.slice(0,36), [MARKERS[23], ...MARKERS.slice(36,42)], [MARKERS[0], ...MARKERS.slice(42)]];
export function nearest(x,z, routes=ROUTES) {
  let best={d:1e9,y:0};
  for (const P of routes) for(let i=1;i<P.length;i++) {
    const a=P[i-1],b=P[i],dx=b[0]-a[0],dz=b[1]-a[1], t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
    const d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
    if(d<best.d) best={d,y:a[2]+(b[2]-a[2])*t};
  } return best;
}
export const cyanDistance=(x,z)=>CYAN_ON?nearest(x,z).d:1e9;
// Existing rope bridge steps/landing remain authoritative: do not grade or cover them.
export const onBridge=(x,z)=>Math.abs(x-16)<5 && z < -44 && z > -110;
export const CYAN_PATHS=CYAN_ON?ROUTES.map((P,i)=>({id:'cyan_route_'+i,pts:P.map(p=>p.slice(0,2)),pave:true,hw:4.6,
  heightAt:(x,z,H)=>onBridge(x,z)?H(x,z):nearest(x,z,[P]).y})):[];
export default {
 id:'cyan_path',name:'Lagoon to Skull Peak',rect:[-290,65,-225,85],terrain:{paths:CYAN_PATHS},
 register(){},
 build({MATS,OUT,H,low}) {
   const k=new Kit(); const box=(x,y,z)=>new THREE.BoxGeometry(x,y,z);
   const post=(x,z)=>{const y=H(x,z);k.add(box(.18,1.25,.18),0x765033,{m:M(x,y+.6,z)});return new THREE.Vector3(x,y+1.08,z);};
   const rope=(a,b)=>{const d=b.clone().sub(a),o=new THREE.Object3D();o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());o.updateMatrix();k.add(new THREE.CylinderGeometry(.035,.035,d.length(),5),0xb89c66,{m:o.matrix,outline:false});};
   for(const P of ROUTES) {
     let travel=0, last=[null,null], nextLamp=8;
     for(let i=1;i<P.length;i++) {
       const a=P[i-1],b=P[i],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),nx=-dz/L,nz=dx/L,yaw=Math.atan2(dx,dz),grade=Math.abs(b[2]-a[2])/L;
       const n=Math.ceil(L/(low?4:3));
       for(let j=0;j<n;j++) {const t=j/n,x=a[0]+dx*t,z=a[1]+dz*t,s=travel+L*t;
         if(onBridge(x,z)) {last=[null,null];continue;}
         for(let side=0;side<2;side++) {const sign=side?1:-1,ex=x+nx*sign*3.5,ez=z+nz*sign*3.5;
           // Tiny merged border stones; never intrude into the walking lane.
           if(!low || j%2===0) k.add(new THREE.IcosahedronGeometry(.13+(j%3)*.04,0),0x98917a,{m:M(ex,H(ex,ez)+.08,ez,j*1.7,0,0,[1.4,.65,1]),outline:false});
           if(j%2===0) for(let blade=0;blade<2;blade++) k.add(new THREE.ConeGeometry(.07,.38,3),0x718249,{m:M(ex+blade*.12,H(ex,ez)+.16,ez+.18,blade*1.7,.16),outline:false});
           const cliff=H(ex,ez)-H(ex+nx*sign*3,ez+nz*sign*3)>1.4;
           if((grade>.28 || cliff) && j%2===0) {const p=post(ex,ez);if(last[side] && last[side].distanceTo(p)<10){const mid=last[side].clone().add(p).multiplyScalar(.5);mid.y-=.12;rope(last[side],mid);rope(mid,p);}last[side]=p;}else if(grade<=.28 && !cliff)last[side]=null;
         }
         if(s>=nextLamp) {nextLamp=s+42;const ex=x+nx*3.9,ez=z+nz*3.9,y=H(ex,ez);post(ex,ez);k.add(box(.42,.55,.42),0x292d2c,{m:M(ex,y+1.65,ez)});k.add(box(.32,.32,.44),0xffcd73,{m:M(ex,y+1.68,ez),outline:false});k.add(box(.62,.1,.62),0x35332c,{m:M(ex,y+1.98,ez)});}
       }
       // Shallow stone cross-bands on steep slopes, terrain-conforming; the graded ground carries feet continuously.
       if(grade>.32) for(let s=.8;s<L;s+=.8){const t=s/L,x=a[0]+dx*t,z=a[1]+dz*t;if(onBridge(x,z))continue;
         for(let lane=-1;lane<=1;lane++){const ex=x+nx*lane*1.65,ez=z+nz*lane*1.65;k.add(box(1.62,.12,.32),0xa29c87,{m:M(ex,H(ex,ez)+.025,ez,yaw),outline:false});}}
       travel+=L;
     }
   }
   const near=k.build(MATS,OUT);near.name='cyan_path_dressing';return {near};
 }
};
