// Existing V7 parrot asset inside the built-in hull birdcage (parrot_alcove_kit); no lights or canvas allocations.
import * as THREE from 'three';
import { createFlightParrot, colorParrot, animateParrot } from '../parrotFlight.js';
// Shared anchor from Post’s built-in door-side alcove; keep all display coordinates relative to it.
export const CAGE_SPOT = Object.freeze({ x: -4.96, z: 3.3, r: 1.65, label: 'PARROT CAGE · NAME & UPGRADE' });
export function addParrotCage(room, floor = .14) {
  const g = new THREE.Group(); g.name = 'parrot_cage'; g.position.set(CAGE_SPOT.x, floor, CAGE_SPOT.z); room.add(g);
  let bird = null, dead = false, currentColor = 'parrot_green';
  const recolor = e => { currentColor = e?.detail?.color || currentColor; if (bird) colorParrot(bird, currentColor); };
  createFlightParrot(currentColor).then(model => {
    if (dead || room.userData.disposed) { model.userData.dispose(); return; }
    bird = model; bird.scale.setScalar(.55); bird.position.set(0, 1.338, 0); g.add(bird); recolor();
  }).catch(() => {});
  const point = new THREE.Vector3();
  room.userData.parrotCageTick = (t, camera) => {
    if (!bird || dead || document.hidden) return;
    if (camera) {
      g.getWorldPosition(point); point.y += 1.5; point.project(camera);
      bird.visible = point.z >= -1 && point.z <= 1 && Math.abs(point.x) < 1.2 && Math.abs(point.y) < 1.2;
      if (!bird.visible) return;
    }
    animateParrot(bird, t, { cage: true });
  };
  window.addEventListener('pfp-parrot', recolor);
  room.userData.spots.parrot_cage = { ...CAGE_SPOT };
  room.userData.colliders.push({ x: CAGE_SPOT.x, z: CAGE_SPOT.z, w: 1, d: 1 });
  // Parent hull disposal owns all geometry/materials; detach the sole event listener before it runs.
  room.userData.parrotCageDispose = () => { dead = true; room.userData.parrotCageTick = null; bird?.traverse(o => o.skeleton?.dispose?.()); window.removeEventListener('pfp-parrot', recolor); };
  return g;
}
