// One pose/bench placement path for captains and NPC crew, local and remote.
import * as THREE from 'three';
export const CANOE_CREW_BENCHES = [-.55, -1.60];
export function seatCanoeRider(actor, boat, z, dt) {
  const obj = actor?.object; if (!obj || !boat) return;
  obj.userData.canoeSeat = true; actor.update?.(dt, 0, 'canoe');
  let hip = null; obj.traverse(o => { if (o.isBone && o.name === 'root') hip = o; });
  obj.updateWorldMatrix(true, true);
  const h = hip ? obj.worldToLocal(hip.getWorldPosition(new THREE.Vector3())).y : .8;
  boat.updateWorldMatrix(true, false);
  obj.position.set(0, .425 - h * obj.scale.y, z).applyMatrix4(boat.matrixWorld);
  obj.visible = true; obj.rotation.order = 'YXZ'; obj.quaternion.copy(boat.quaternion);
}
