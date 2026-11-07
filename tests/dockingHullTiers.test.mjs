import './helpers/threeRegister.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const g = new Proxy({}, {get:(o,k)=> k==='createLinearGradient'||k==='createRadialGradient' ? ()=>({addColorStop(){}}) : k==='getImageData' ? ()=>({data:new Uint8ClampedArray(256*256*4)}) : k==='measureText' ? ()=>({width:10}) : ()=>{}});
globalThis.Image=class {set src(v){queueMicrotask(()=>this.onerror?.());}};
globalThis.document={createElement:()=>({width:64,height:64,style:{},getContext:()=>g})};
const {compileShip,TRAITS}=await import('../js/upgradeVisuals.js');
const {SKINS}=await import('../js/skins.js');
const {NEW_SHIPS}=await import('../js/newShips.js');
const {DIAMOND}=await import('../assets/ships/pvp/diamond.js');
SKINS.push(DIAMOND,...NEW_SHIPS.map(s=>s.skin));
const {hullHalfBeam,parkedPose}=await import('../js/dock/parkPose.js');
const PV=await import('../js/island/plazaTown.js');
const {createDocking}=await import('../js/dock/docking.js');
const {disposeShip}=await import('../js/ships.js');
const parts=PV.harborParts((x,z)=>[x,z],y=>y);
const THREE = await import('../vendor/three-0.165.0/build/three.module.min.js');
const max = Object.fromEntries(Object.entries(TRAITS).map(([k,v])=>[k,v.length-1]));
test('every hull tier and prestige shape at full upgrades has measured 2 m pier clearance', () => {
 for (let tier=0;tier<TRAITS.hull.length;tier++) {
  for(const skin of ['classic','golden','diamond','opal','leviathan','celestial','sunking','poseidon']) {
   const m=compileShip({...max,hull:tier},{quality:'low',pvp:true,skin:SKINS.find(s=>s.id===skin),flagMap:new THREE.Texture()});
   assert.equal(m.userData.skinId,skin);
   const s={mesh:m,speed:0}, half=hullHalfBeam(s);
   for(const b of parts.berths) {
    const p=parkedPose(s,b), gap=(p.x-b.edge.x)*b.away.x+(p.z-b.edge.z)*b.away.z-half;
    assert.ok(gap>=2-1e-6,`${skin} hull ${tier} berth ${b.id}: ${gap}`);
    const d=createDocking({berths:parts.berths,myId:'me'}); d.moor(s,b);
    assert.equal(s.x,p.x); assert.equal(s.z,p.z);
   }
   disposeShip(m);
  }
 }
});
