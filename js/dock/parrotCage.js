// Existing V7 parrot asset, a low-poly brass cage, no lights or canvas allocations.
import * as THREE from 'three';
import { loadPirateGLB } from '../pirateGLB.js';
export const CAGE_SPOT = Object.freeze({ x: -2.25, z: 2.5, r: 1.65, label: 'PARROT CAGE · NAME & UPGRADE' });
const COLORS = { parrot_green: 0x69d66e, parrot_red: 0xf26a55, parrot_blue: 0x72aeff, parrot_cockatoo: 0xffffff, parrot_black: 0x555566, parrot_gold: 0xffd156, parrot_diamond: 0xc5eeff };
export function addParrotCage(room, floor = .14) {
  const g = new THREE.Group(); g.name = 'parrot_cage'; g.position.set(CAGE_SPOT.x, floor, CAGE_SPOT.z); room.add(g);
  const metal = new THREE.MeshBasicMaterial({ color: 0xb98a3b }), wood = new THREE.MeshBasicMaterial({ color: 0x53321a });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(new THREE.CylinderGeometry(.44, .5, .12, 16), wood, 0, .08, 0);
  add(new THREE.CylinderGeometry(.07, .14, .85, 8), metal, 0, .52, 0);
  for (const y of [1.02, 1.94]) add(new THREE.CylinderGeometry(.5, .5, .065, 20), metal, 0, y, 0);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; add(new THREE.CylinderGeometry(.014, .014, .92, 5), metal, Math.cos(a) * .47, 1.48, Math.sin(a) * .47); }
  add(new THREE.CylinderGeometry(.03, .03, .86, 6), wood, 0, 1.27, 0).rotation.z = Math.PI / 2;
  add(new THREE.TorusGeometry(.1, .018, 5, 12), metal, 0, 2.09, 0);
  let bird = null, dead = false, currentColor = 'parrot_green';
  const recolor = e => {
    currentColor = e?.detail?.color || currentColor;
    const tint = new THREE.Color(COLORS[currentColor] || COLORS.parrot_green), base = new THREE.Color(), hsl = {};
    bird?.traverse(o => {
      const col = o.geometry?.attributes?.color, original = o.userData.parrotColors;
      if (!col || !original) return;
      for (let i = 0; i < col.count; i++) {
        base.setRGB(original[i * 3], original[i * 3 + 1], original[i * 3 + 2]); base.getHSL(hsl);
        // Preserve eyes, feet and beak; recolor only saturated blue/green feather vertices.
        if (hsl.s > .22 && hsl.h > .23 && hsl.h < .76) base.copy(tint).multiplyScalar(Math.max(.3, hsl.l * 1.7));
        col.setXYZ(i, base.r, base.g, base.b);
      }
      col.needsUpdate = true;
    });
  };
  loadPirateGLB('assets/pirates/items/v7/parrot_plain_v7.glb').then(gltf => {
    if (dead || room.userData.disposed) return;
    // The game's shared Draco/Meshopt loader owns the cached source. Hull display owns ONLY its clones.
    bird = gltf.scene.clone(true);
    bird.traverse(o => { if (!o.isMesh) return; o.geometry = o.geometry.clone(); o.geometry.userData = {}; o.material = new THREE.MeshBasicMaterial({ vertexColors: !!o.geometry.attributes.color, color: 0xffffff }); const col = o.geometry.attributes.color; if (col) { const colors = new Float32Array(col.count * 3); for (let i = 0; i < col.count; i++) { colors[i*3] = col.getX(i); colors[i*3+1] = col.getY(i); colors[i*3+2] = col.getZ(i); } o.userData.parrotColors = colors; } });
    const box = new THREE.Box3().setFromObject(bird), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3()), scale = .58 / Math.max(size.x, size.y, size.z);
    bird.scale.setScalar(scale); bird.position.set(-center.x * scale, 1.28 - box.min.y * scale, -center.z * scale); g.add(bird); recolor();
  }).catch(() => {});
  window.addEventListener('pfp-parrot', recolor);
  room.userData.spots.parrot_cage = { ...CAGE_SPOT };
  room.userData.colliders.push({ x: CAGE_SPOT.x, z: CAGE_SPOT.z, w: 1, d: 1 });
  // Parent hull disposal owns all geometry/materials; detach the sole event listener before it runs.
  room.userData.parrotCageDispose = () => { dead = true; window.removeEventListener('pfp-parrot', recolor); };
  return g;
}
