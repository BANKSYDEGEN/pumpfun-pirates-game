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
for(let i=0;i<720;i++) { const a=i*Math.PI/360,lx=65+34*Math.cos(a),lz=-126+85*Math.sin(a),[x,z]=CO.t2w(lx,lz),hit=F.hitCollider(x,z,.45);
  // This geometrical circle crosses real shop backs, portal returns and the new stair cheeks.
  // Keep those walls solid, and report them rather than pretending a 360-degree walk can cross masonry.
  const visibleBoundary=lz>-43?'fish_market_back_wall':C.inMainAlley(lx,lz,1)?'main_portal_return':C.castleSample(lx,lz).d<C.CASTLE_RAMP_HW+1.6?'back_stair_cheek':null;
  if(hit&&!visibleBoundary)unexplained++;
  exterior.push({angle:i/2,lx,lz,y:ga(x,z),hit,boundary:hit?visibleBoundary:null});
}
// Side exits through their entire shell thickness (not just a single point at the doorway).
const batteryHits=[];const a=Math.atan2((C.BATTERY_GATE.lz+126)/82,(C.BATTERY_GATE.lx-65)/31);
for(let t=-4;t<=7;t+=.1){const lx=65+(31+t)*Math.cos(a),lz=-126+(82+t)*Math.sin(a);if(F.hitCollider(...CO.t2w(lx,lz),.45))batteryHits.push({lx,lz});}
const exteriorSummary={sampleCount:exterior.length,clear:exterior.filter(p=>!p.hit).length,visibleWallHits:exterior.filter(p=>p.hit).length,unexplained};
const wallSolid=F.hitCollider(...CO.t2w(96,-126),.45);
const [wx,wz]=CO.t2w(20,-114.761); const result={rangeY:BA.RANGE.y,footY:C.FOOT.y,inRange:BA.inRange(69,-158),wellHit:F.hitCollider(wx,wz,.45),on:C.COLISEUM_ON,main:C.MAIN_GATE,join:C.CASTLE_JOIN,stairLength:C.CASTLE_STAIR.length,maxErr,maxStep,hits,edgeHits,gateHits,batteryHits,wallSolid,interiors,exteriorSummary,exterior,samples};
if(process.env.COLI_REPORT) writeFileSync(process.env.COLI_REPORT,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,samples:undefined,exterior:undefined,hits:hits.slice(0,8)}));
