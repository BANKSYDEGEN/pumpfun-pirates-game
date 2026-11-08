// Plaza -> Main Street alongside the Treasure Trader. Coordinates are town-local metres.
export const HILL_ENTRANCE = Object.freeze({lx:6.5,lx0:3.5,lx1:9.5,lz0:-76,lz1:-52,y0:5.86,y1:2.73});
export const entranceY = z => {const e=HILL_ENTRANCE;return e.y0+(e.y1-e.y0)*Math.max(0,Math.min(1,(z-e.lz0)/(e.lz1-e.lz0)));};
export function entranceGround(x,z,h){const e=HILL_ENTRANCE;if(z<e.lz0||z>e.lz1)return h;const d=Math.max(e.lx0-x,0,x-e.lx1),w=1-Math.min(1,d/2);return h+(entranceY(z)-.16-h)*w;}
export function entranceParts(){const e=HILL_ENTRANCE,rx=Math.atan((e.y0-e.y1)/24),p=[];
 const b=(x,y,z,w,h,d,c,mat,rot=0)=>p.push({kind:'box',x,y,z,w,h,d,c,mat,rx:rot});
 b(e.lx,(e.y0+e.y1)/2-.12/Math.cos(rx),-64,6,.24,24/Math.cos(rx),'#b9b2a6',22,rx);
 // Low, step-over stone curbs flank the ramp but leave both ends and the trader approach open.
 for(const x of [3.15,9.85]) b(x,(e.y0+e.y1)/2+.075,-64,.35,.15,24/Math.cos(rx),'#8a837a',22,rx);
 const z=-65,y=entranceY(z);
 for(const x of [2.75,10.25]) {b(x,y+2,z,.8,4,.9,'#c9bfae',11);b(x,y+.2,z,1,.4,1.1,'#8a837a',22);b(x,y+4,z,1,.3,1.1,'#8a837a',22);}
 // Stepped stone arch with 4 m headroom, no collider across the walking opening.
 b(6.5,y+4.6,z,8.4,.9,1,'#c9bfae',11);b(6.5,y+5.12,z,8.8,.2,1.25,'#8a837a',22);
 return p;
}
