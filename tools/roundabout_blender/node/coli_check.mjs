import {writeFileSync} from 'node:fs';
const F=await import('../../../js/island/foot.js'), C=await import('../../../js/island/coliseum.js'), CO=await import('../../../js/island/coast.js'), BA=await import('../../../js/island/battleAreas.js');
const R=new Proxy({}, {get:()=>[0,0,1,1]}); for(const fn of ['buildStreet','buildInland','buildCoast']) F[fn](R,true,[]);
const hits=[], samples=[], ga=(x,z)=>F.areaDeckAt(x,z)??F.H(x,z); let maxErr=0,maxStep=0,prev;
for(let s=0;s<=C.CASTLE_STAIR.length;s+=0.2) { const [lx,lz]=C.castleAt(s),[x,z]=CO.t2w(lx,lz),y=ga(x,z), err=Math.abs(y-C.castleY(s)); if(F.hitCollider(x,z,.45)) hits.push({s,lx,lz,y,blocks:undefined}); maxErr=Math.max(err,maxErr); if(prev!==undefined) maxStep=Math.max(maxStep,Math.abs(y-prev)); prev=y; samples.push({s,lx,lz,y,expect:C.castleY(s)}); }
const edgeHits=[]; if(C.COLISEUM_ON) for(let s=1;s<C.CASTLE_STAIR.length-4;s+=0.3) {
  const a=C.castleAt(s-.05),b=C.castleAt(s+.05),[lx,lz]=C.castleAt(s),len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(const off of [-1.4,1.4]) { const [x,z]=CO.t2w(lx-(b[1]-a[1])/len*off,lz+(b[0]-a[0])/len*off); if(F.hitCollider(x,z,.45)) edgeHits.push({s,off}); }
}
const gateHits=[]; for(let lx=11;lx<45;lx+=.2) for(const off of [-2,0,2]) {const [x,z]=CO.t2w(lx,C.MAIN_GATE.lz+off); if(F.hitCollider(x,z,.45))gateHits.push({lx,off}); }
// Sample every interior square metre, including the backs most affected by the 8m feather.
const PV=await import('../../../js/island/plazaTown.js');
const interiors=[{id:'fish',x0:57.4,x1:89,z0:-41.5,z1:-30.5},{id:'market',x0:38.5,x1:55.5,z0:-41.5,z1:-30.5},{id:'crew',x0:27.5,x1:36.5,z0:-41.5,z1:-30.5}].map(r=>{
  let max=-Infinity,n=0;for(let lx=r.x0;lx<=r.x1;lx+=.5)for(let lz=r.z0;lz<=r.z1;lz+=.5){max=Math.max(max,F.H(...CO.t2w(lx,lz)));n++;}return {id:r.id,max,n,floor:PV.STREET_Y};
});
const exterior=[];let unexplained=0;
const E=C.ELL||{cx:65,cz:-126,rx:31,rz:82};
for(let i=0;i<720;i++) { let lx,lz; if(C.contourAt){const c=C.contourAt(i/720*(C.CONTOUR_LEN||1),-3);lx=c.lx;lz=c.lz;} else {const a=i*Math.PI/360;lx=E.cx+(E.rx+3)*Math.cos(a);lz=E.cz+(E.rz+3)*Math.sin(a);} const [x,z]=CO.t2w(lx,lz),hit=F.hitCollider(x,z,.45);
  // This geometrical circle crosses real shop backs, portal returns and the new stair cheeks.
  // Keep those walls solid, and report them rather than pretending a 360-degree walk can cross masonry.
  const visibleBoundary=lz>-43?'fish_market_back_wall':C.inMainAlley(lx,lz,1)?'main_portal_return':C.castleSample(lx,lz).d<C.CASTLE_RAMP_HW+1.6?'back_stair_cheek':(C.fishSample&&Math.abs(C.fishSample(lx,lz).d-C.FISH_HW-0.35)<0.9)?'fish_approach_cheek':(lz<-200&&lx<50)?'fort_stair_landing_parapet':null;
  if(hit&&!visibleBoundary)unexplained++;
  exterior.push({angle:i/2,lx,lz,y:ga(x,z),hit,boundary:hit?visibleBoundary:null});
}
// Side exits through their entire shell thickness (not just a single point at the doorway).
const batteryHits=[];
{ const g=C.BATTERY_GATE, n=g.n||(()=>{const a=Math.atan2((g.lz-E.cz)/E.rz,(g.lx-E.cx)/E.rx);return [Math.cos(a),Math.sin(a)];})();
  for(let t=-4;t<=7;t+=.1){const lx=g.lx+n[0]*t,lz=g.lz+n[1]*t;if(F.hitCollider(...CO.t2w(lx,lz),.45))batteryHits.push({lx,lz});} }
const exteriorSummary={sampleCount:exterior.length,clear:exterior.filter(p=>!p.hit).length,visibleWallHits:exterior.filter(p=>p.hit).length,unexplained};
const wallSolid=F.hitCollider(...CO.t2w(E.cx+E.rx,E.cz),.45); // east shoulder still solid
// [v294] fish-market approach: plaza -> paved ramp -> gate -> arena. Centreline + both shoulders clear, deck = profile, small steps,
// starts at plaza level, ends at arena level; terrain never pokes through the paving.
const fish={on:!!C.FISH_STAIR};if(C.FISH_STAIR&&C.COLISEUM_ON){const FS=C.FISH_STAIR;let mE=0,mS=0,pv,poke=0;const fh=[],fe=[];
 for(let s=0;s<=FS.length;s+=0.2){const [lx,lz]=C.fishAt(s),[x,z]=CO.t2w(lx,lz),y=ga(x,z);mE=Math.max(mE,Math.abs(y-C.fishY(s)));if(pv!==undefined)mS=Math.max(mS,Math.abs(y-pv));pv=y;
  if(F.hitCollider(x,z,.45))fh.push({s:+s.toFixed(1),lx,lz});poke=Math.max(poke,F.H(x,z)-y);
  const a=C.fishAt(s-.05),b=C.fishAt(s+.05),l=Math.hypot(b[0]-a[0],b[1]-a[1]);for(const off of [-2.6,2.6]){const [ex,ez]=CO.t2w(lx-(b[1]-a[1])/l*off,lz+(b[0]-a[0])/l*off);if(F.hitCollider(ex,ez,.45))fe.push({s:+s.toFixed(1),off});}}
 const [sx,sz]=CO.t2w(...C.fishAt(0)),[ex,ez]=CO.t2w(...C.fishAt(FS.length));
 Object.assign(fish,{length:FS.length,maxErr:mE,maxStep:mS,poke,hits:fh.slice(0,8),edgeHits:fe.slice(0,8),startY:ga(sx,sz),endY:ga(ex,ez),gate:C.FISH_GATE});}
// [v300] wings inside the inner circle: every collider (walls, piers, backstop, rails, targets, cover, benches, torches, pennants, dummies)
// near the range / pit lies inside the kerb ellipse shrunk 1.2 m (rx 17.6, rz 72.5); and a 96-point sweep of the pink ring walk (offset 5.6) is clear.
const wings={n:0,out:[],ring:[]};if(C.COLISEUM_ON){const inset=9.4;const K=(lx,lz)=>C.ellF?C.ellF(lx,lz,inset):((lx-E.cx)/(E.rx-inset))**2+((lz-E.cz)/(E.rz-inset))**2;const R0=BA.RANGE,P0=BA.PIT;
 const near=(lx,lz)=>(lx>R0.lx0-4&&lx<R0.lx1+4&&lz>R0.lz0-4&&lz<R0.lz1+4)||Math.hypot(lx-P0.lx,lz-P0.lz)<P0.pad+2;
 for(const o of F.MAP_BOXES()){const [lx,lz]=CO.w2t(o.x,o.z);if(!near(lx,lz))continue;wings.n++;for(const [u,v] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const dx=u*o.hx,dz=v*o.hz,x=o.x+dx*o.c+dz*o.s,z=o.z-dx*o.s+dz*o.c,[a,b]=CO.w2t(x,z);if(K(a,b)>1){wings.out.push({t:'box',lx:+lx.toFixed(2),lz:+lz.toFixed(2),k:+K(a,b).toFixed(3)});break;}}}
 for(const o of F.MAP_CIRCS()){const [lx,lz]=CO.w2t(o.x,o.z);if(!near(lx,lz))continue;wings.n++;const r=o.r,k=Math.max(K(lx+r,lz),K(lx-r,lz),K(lx,lz+r),K(lx,lz-r));if(k>1)wings.out.push({t:'circ',lx:+lx.toFixed(2),lz:+lz.toFixed(2),k:+k.toFixed(3)});}
 wings.spawnHits=[];const sp=[];for(let t=-1;t<=1;t+=.25){sp.push([R0.lx1-5+t*1.5,R0.lz0+5],[R0.divider+4+t*2,R0.lz1-2.5],[R0.gate[0]+t*2,R0.lz1-2.5]);for(const b of [0,Math.PI/2,-Math.PI/2])sp.push(BA.pitAt(P0.gateA+b+t*0.3,P0.r-2.2));}
 wings.gateHits=[];for(let t=-3;t<=3;t+=.25){for(const [lx,lz] of [[R0.gate[0],R0.lz1+t],BA.pitAt(P0.gateA,P0.r+t)])if(F.hitCollider(...CO.t2w(lx,lz),.45))wings.gateHits.push([+lx.toFixed(2),+lz.toFixed(2)]);}
 for(const [lx,lz] of sp)if(F.hitCollider(...CO.t2w(lx,lz),.45))wings.spawnHits.push([+lx.toFixed(2),+lz.toFixed(2)]);wings.spawns=sp.length;
 for(let i=0;i<96;i++){let lx,lz; if(C.contourAt){const c=C.contourAt(i/96*(C.CONTOUR_LEN||1),5.6);lx=c.lx;lz=c.lz;} else {const a=i/96*2*Math.PI;lx=E.cx+Math.cos(a)*(E.rx-5.6);lz=E.cz+Math.sin(a)*(E.rz-5.6);} if(F.hitCollider(...CO.t2w(lx,lz),.45))wings.ring.push({i,lx:+lx.toFixed(1),lz:+lz.toFixed(1)});}}
// [v305] end-to-end foot walks through all 4 entrances + rounded-contour clearances
const walks={}; if(C.COLISEUM_ON){
  const walk=(id,pts)=>{const hits=[]; let stuck=0,prev; for(const [lx,lz] of pts){const [x,z]=CO.t2w(lx,lz); const y=ga(x,z); if(F.hitCollider(x,z,.45))hits.push([+lx.toFixed(2),+lz.toFixed(2)]); if(prev!=null&&Math.abs(y-prev)>0.55)stuck++; prev=y;} return {hits:hits.slice(0,8),stuck,n:pts.length};};
  const dens=(a,b,n)=>{const o=[]; for(let i=0;i<=n;i++){const t=i/n;o.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);} return o;};
  walks.main=walk('main',[...dens([10,C.MAIN_GATE.lz],[34,C.MAIN_GATE.lz],40),...dens([34,C.MAIN_GATE.lz],[61,C.MAIN_GATE.lz],40)]);
  walks.fish=walk('fish',(()=>{const o=[]; for(let s=0;s<=C.FISH_STAIR.length;s+=0.35)o.push(C.fishAt(s)); return o;})());
  walks.castle=walk('castle',(()=>{const o=[]; for(let s=0;s<=C.CASTLE_STAIR.length;s+=0.35)o.push(C.castleAt(s)); return o;})());
  walks.battery=walk('battery',(()=>{const g=C.BATTERY_GATE,n=g.n||[1,0],o=[]; for(let t=-3;t<=8;t+=0.25)o.push([g.lx+n[0]*t,g.lz+n[1]*t]); return o;})());
}
// [v307] outer-shell face ground: every non-gate sample at off=-1.2 must sit on FOOT.y (no cliff undercut)
const shellGround={min:Infinity,max:-Infinity,bad:[],n:0}; if(C.COLISEUM_ON&&C.contourAt){
  const N=96, gates=[C.MAIN_GATE,C.CASTLE_GATE,C.BATTERY_GATE,C.FISH_GATE];
  for(let i=0;i<N;i++){const c=C.contourAt((i+.5)/N*C.CONTOUR_LEN,0);
    const inGate=gates.some(g=>{const glx=g.shellLx??g.lx,glz=g.lz; const hw=g===C.MAIN_GATE?(g.opening/2+1.75):(g.w/2+1.6);
      return Math.hypot(c.lx-glx,c.lz-glz)<hw;});
    if(inGate) continue;
    const o=C.contourAt((i+.5)/N*C.CONTOUR_LEN,-1.2); const h=F.H(...CO.t2w(o.lx,o.lz));
    shellGround.n++; shellGround.min=Math.min(shellGround.min,h); shellGround.max=Math.max(shellGround.max,h);
    if(h<C.FOOT.y-0.35) shellGround.bad.push({i,lx:+o.lx.toFixed(2),lz:+o.lz.toFixed(2),h:+h.toFixed(2)});
  }
}
// [v307] 360° shell coverage: radial rays at contour must hit a collider except inside the 4 gate openings
const shellGaps={n:0,gaps:[]}; if(C.COLISEUM_ON&&C.contourAt){
  const gates=[C.MAIN_GATE,C.CASTLE_GATE,C.BATTERY_GATE,C.FISH_GATE];
  const N=180;
  for(let i=0;i<N;i++){const c=C.contourAt(i/N*C.CONTOUR_LEN,0);
    const inGate=gates.some(g=>{const glx=g.shellLx??g.lx,glz=g.lz; const hw=g===C.MAIN_GATE?(g.opening/2+0.15):(g.w/2+0.15);
      // arc-length aware: use contourNearest distance along contour
      const cg=C.contourNearest(glx,glz); const L=C.CONTOUR_LEN; const ds=Math.min(Math.abs(c.s-cg.s),L-Math.abs(c.s-cg.s));
      return ds<hw;});
    if(inGate) continue;
    shellGaps.n++;
    // probe just outside the wall face and at mid-wall — a solid bay/pier must block
    const [x,z]=CO.t2w(c.lx,c.lz);
    if(!F.hitCollider(x,z,.55)) shellGaps.gaps.push({i,lx:+c.lx.toFixed(2),lz:+c.lz.toFixed(2)});
  }
}
const interiorH={n:0,bumps:0,sample:[]}; if(C.COLISEUM_ON){for(let lx=34;lx<=88;lx+=1)for(let lz=-200;lz<=-72;lz+=1){if(!C.ellInside(lx,lz,2))continue;if(C.fishSample(lx,lz).d<C.FISH_HW+1.5&&C.fishSample(lx,lz).s<C.FISH_STAIR.sShell+2)continue;const h=F.H(...CO.t2w(lx,lz));interiorH.n++;if(Math.abs(h-C.FOOT.y)>0.08){interiorH.bumps++;if(interiorH.sample.length<5)interiorH.sample.push({lx,lz,h:+h.toFixed(2)});}}}
const tips={south:C.FOOT.lz1,north:C.FOOT.lz0,fishClear:(-42)-C.FOOT.lz1,p:C.ELL.p,rz:C.ELL.rz,rx:C.ELL.rx};
const [wx,wz]=CO.t2w(20,-114.761); const result={rangeY:BA.RANGE.y,footY:C.FOOT.y,inRange:BA.inRange(69,-158),wellHit:F.hitCollider(wx,wz,.45),on:C.COLISEUM_ON,main:C.MAIN_GATE,join:C.CASTLE_JOIN,stairLength:C.CASTLE_STAIR.length,maxErr,maxStep,hits,edgeHits,gateHits,batteryHits,wallSolid,fish,battery:C.BATTERY_GATE,ell:C.ELL,wings,range:BA.RANGE,pit:BA.PIT,interiors,exteriorSummary,exterior,samples,walks,tips,shellGround,shellGaps,interiorH};
if(process.env.COLI_REPORT) writeFileSync(process.env.COLI_REPORT,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,samples:undefined,exterior:undefined,hits:hits.slice(0,8)}));
