import * as THREE from 'three';
// Local scene object only. Nothing is serialized into ship/foot state or sent to a room.
export function createPrivateBuildingMarker({parent,layout,ground}) {
  const group=new THREE.Group();group.name='private_building_waypoint';group.visible=false;parent.add(group);
  const material=new THREE.MeshBasicMaterial({color:0xf0cf8d,transparent:true,opacity:.75,depthWrite:false});
  const ring=new THREE.Mesh(new THREE.RingGeometry(2.1,2.5,32),material);ring.rotation.x=-Math.PI/2;ring.position.y=.15;
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,28,6),material);beam.position.y=14;
  const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(1.1),material);beacon.position.y=28;
  group.add(ring,beam,beacon);let disposed=false;
  return {
    group,
    update(pin,active=true) {
      group.visible=!disposed&&!!active&&pin?.audience==='private'&&Number.isFinite(pin.x)&&Number.isFinite(pin.z);
      if(!group.visible){delete group.userData.buildingId;return;}
      const [x,z]=layout.footToHarbor(pin.x,pin.z),y=ground(x,z);
      if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(y)){group.visible=false;return;}
      group.position.set(x,y,z);group.userData.buildingId=pin.id;
    },
    clear(){group.visible=false;delete group.userData.buildingId;},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const mesh of [ring,beam,beacon])mesh.geometry.dispose();material.dispose();group.visible=false;},
  };
}
