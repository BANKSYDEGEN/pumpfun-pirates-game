// V7 male shop displays share the REAL body + garment fit pipeline with players and preview cards.
// The old merged wooden male forms are removed from plaza_shops*.glb; stands and female forms stay.
import * as THREE from 'three';
export const MALE_SHOP_DISPLAYS = {
  shop_clothes: [
    { x: -2.6, z: 4.6, yaw: .25, gear: { outfit: 'shirt', hat: 'tricorn' } },
    { x: 2.6, z: 4.6, yaw: -.25, gear: { outfit: 'tshirt', hat: 'bicorne' } },
    { x: 1.4, z: 1.2, yaw: -.3, gear: { outfit: 'suit', hat: 'tricorn' } },
    { x: 0, z: 4.3, yaw: 0, female: true, gear: { outfit: 'shirt', hat: 'crown' } },   // [v361] V7 female display (BANKSY t1919u)
  ],
  shop_crew: [{ x: 2.2, z: 4.4, yaw: -.3, gear: { outfit: 'tank', hat: 'bandana' } }],
};
export function addMaleShopDisplays(parent, id, low = false) {
  const list = MALE_SHOP_DISPLAYS[id]; if (!list) return;
  const lod = new THREE.LOD(); lod.name = 'v7_shop_displays_' + id;
  const group = new THREE.Group(); lod.addLevel(group, 0); lod.addLevel(new THREE.Group(), low ? 38 : 120); parent.add(lod);
  const ready = Promise.all([import('../pirateGLB.js'), import('../pirateGear.js')]).then(([{ PirateGLB }, { applyGear }]) => Promise.all(list.map(async (d, i) => {
    const p = await PirateGLB.create({ lod: 'lo', female: !!d.female });
    await applyGear(p, { ...d.gear, body: d.female ? 1 : 0, pants: 'classic_pants', boots: 'boots_classic' });
    p.mixer.setTime(.35); p.root.name = 'v7_mannequin_' + id + '_' + i;
    p.root.position.set(d.x, .718, d.z); p.root.rotation.y = d.yaw; p.root.scale.setScalar(1.3);
    p.root.traverse(o => { if (o.isMesh) { o.castShadow = !low; o.frustumCulled = false; } });
    group.add(p.root); return p;
  })));
  parent.userData.mannequinsReady = ready;
  ready.catch(e => console.warn('[V7 mannequins] load failed', e));
}
