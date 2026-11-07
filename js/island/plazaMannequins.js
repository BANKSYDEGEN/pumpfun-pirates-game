// V7 male shop displays share the REAL body + garment fit pipeline with players and preview cards.
// The old merged wooden male forms are removed from plaza_shops*.glb; stands and female forms stay.
import * as THREE from 'three';
export const MALE_SHOP_DISPLAYS = {
  ship_store: [
    { x: -5.5, z: -3.5, y: 0, scale: 2, yaw: 0, gear: { outfit: 'shirt', hat: 'none' } },
    { x: 6, z: -3.5, y: 0, scale: 2, yaw: 0, gear: { outfit: 'suit', hat: 'none' } },
  ],
  shop_clothes: [
    { x: -2.6, z: 4.6, yaw: .25, gear: { outfit: 'shirt', hat: 'none' } },
    { x: 2.6, z: 4.6, yaw: -.25, gear: { outfit: 'tshirt', hat: 'none' } },
    { x: 1.4, z: 1.2, yaw: -.3, gear: { outfit: 'suit', hat: 'none' } },
    { x: 0, z: 4.3, yaw: 0, female: true, gear: { outfit: 'shirt', hat: 'none' } },   // [v361] V7 female display (BANKSY t1919u)
  ],
  // The former crew building has a static, built-in accessories counter (no hiring / crew mannequin).
};
export function addMaleShopDisplays(parent, id, low = false) {
  const list = MALE_SHOP_DISPLAYS[id]; if (!list) return;
  const lod = new THREE.LOD(); lod.name = 'v7_shop_displays_' + id;
  const group = new THREE.Group(); lod.addLevel(group, 0); lod.addLevel(new THREE.Group(), low ? 38 : 120); parent.add(lod);
  const ready = Promise.all([import('../pirateGLB.js'), import('../pirateGear.js')]).then(([{ PirateGLB }, { applyGear }]) => Promise.all(list.map(async (d, i) => {
    const p = await PirateGLB.create({ lod: 'lo', female: !!d.female });
    await applyGear(p, { ...d.gear, body: d.female ? 1 : 0, pants: 'classic_pants', boots: 'boots_classic' });
    p.mixer.setTime(.35); p.root.name = 'v7_mannequin_' + id + '_' + i;
    p.root.position.set(d.x, d.y ?? .718, d.z); p.root.rotation.y = d.yaw; p.root.scale.setScalar(d.scale ?? 1.3);
    p.root.traverse(o => { if (o.isMesh) { o.castShadow = !low; o.frustumCulled = false; } });
    group.add(p.root); return p;
  })));
  parent.userData.mannequinsReady = ready;
  ready.catch(e => console.warn('[V7 mannequins] load failed', e));
}
