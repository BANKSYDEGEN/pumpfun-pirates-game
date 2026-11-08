// Personal, in-memory building waypoint only. Deliberately has no networking or persistence API.
export function createBuildingWaypoint() {
  let value = null;
  return {
    select(building) {
      if (!building?.id || !building.name || !Number.isFinite(building.x) || !Number.isFinite(building.z)) return false;
      value = { id:building.id, name:building.name, x:building.x, z:building.z, audience:'private' }; return true;
    },
    clear() { value = null; },
    get current() { return value && {...value}; },
  };
}
export function buildingPinButton(doc, building, selected, onSelect) {
  const button=doc.createElement('button'); button.type='button'; button.className='im-building';
  button.dataset.building=building.id; button.setAttribute('aria-pressed',String(selected));
  button.setAttribute('title','Place a private pin at '+building.name);
  button.addEventListener('pointerdown',e=>e.stopPropagation());
  button.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' ')e.stopPropagation(); }); // native button activation; no duplicate synthetic clicks
  button.addEventListener('click',e=>{ e.stopPropagation(); onSelect(building.id); });
  return button;
}
export function waypointOutsideView(pin, project, view, margin=16) {
  const [x,y]=project(pin.x,pin.z), mx=Math.min(margin,view.width/4),my=Math.min(margin,view.height/4);
  return x<view.x-view.width/2+mx || x>view.x+view.width/2-mx || y<view.y-view.height/2+my || y>view.y+view.height/2-my;
}
// The pointed tip, not the badge centre, is anchored at the canonical building centre.
export function drawBuildingPin(ctx, pin, project, radius=10) {
  if(!pin)return; const [x,y]=project(pin.x,pin.z),r=radius;
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#f0cf8d';ctx.strokeStyle='#17212a';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-r*.3,-r*.6,-r,-r*.9,-r,-r*1.6);ctx.arc(0,-r*1.6,r,Math.PI,0);ctx.bezierCurveTo(r,-r*.9,r*.3,-r*.6,0,0);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.arc(0,-r*1.6,r*.32,0,Math.PI*2);ctx.fillStyle='#17212a';ctx.fill();ctx.restore();
}
