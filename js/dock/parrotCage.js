// Built-in hull birdcage (parrot_alcove_kit): shows YOUR parrot (selected/equipped inventory bird, its color + name tag)
// whenever you are in the hull (the companion never flies in here; it resumes outside if equipped). No parrot owned = empty cage. No lights, no PMREM.
import * as THREE from 'three';
import { createFlightParrot, colorParrot, perchParrot, isFlyingParrot } from '../parrotFlight.js';
// Shared anchor from Post’s built-in door-side alcove; keep all display coordinates relative to it.
export const CAGE_SPOT = Object.freeze({ x: -4.96, z: 3.3, r: 1.65, label: 'PARROT CAGE · NAME & UPGRADE' });
// Pure: which inventory bird sits in the cage (null = empty). state = { parrots, equipped }, gearParrot = getLocalGear().parrot
export function cageBird(state, gearParrot) {
  const birds = Array.isArray(state?.parrots) ? state.parrots : [];
  if (!birds.length) return null; // [t2085u] in the hull the bird always sits here (the flying companion hides while pfp-inhull)
  return birds.find(p => p.id === state.equipped) || birds[0];
}
function nameTag(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d'); x.fillStyle = '#21160fd9'; x.fillRect(0, 8, 256, 48); x.strokeStyle = '#ffcd77'; x.lineWidth = 3; x.strokeRect(2, 10, 252, 44);
  x.fillStyle = '#ffcd77'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(text).slice(0, 16), 128, 33);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(.6, .15, 1); s.position.set(0, 2.2, 0); s.name = 'parrot_cage_tag'; return s;
}
export function addParrotCage(room, floor = .14) {
  const g = new THREE.Group(); g.name = 'parrot_cage'; g.position.set(CAGE_SPOT.x, floor, CAGE_SPOT.z); room.add(g);
  let bird = null, tag = null, tagText = '', dead = false, loading = null, getGear = () => window.__pfpGear || null;
  let state = window.__pfpParrotState || null;
  const dropTag = () => { if (!tag) return; g.remove(tag); tag.material.map?.dispose(); tag.material.dispose(); tag = null; tagText = ''; };
  const sync = () => {
    if (dead || room.userData.disposed) return;
    const p = cageBird(state, getGear()?.parrot);
    g.userData.bird = p ? p.id : null;
    if (!p) { if (bird) bird.visible = false; dropTag(); return; }
    const color = isFlyingParrot(p.color) ? p.color : 'parrot_green';
    if (bird) { bird.visible = true; colorParrot(bird, color); }
    else if (!loading) loading = createFlightParrot(color).then(model => {
      if (dead || room.userData.disposed) { model.userData.dispose?.(); return; }
      bird = model; bird.scale.setScalar(.7); bird.position.set(0, 1.5, 0); perchParrot(bird, 0); g.add(bird); sync();
    }).catch(() => { loading = null; });
    const t = p.name || 'Parrot';
    if (t !== tagText && typeof document !== 'undefined' && document.createElement) { dropTag(); try { tag = nameTag(t); tagText = t; g.add(tag); } catch {} }
  };
  const onState = e => { state = e?.detail || null; sync(); };
  const onSelected = e => { // parrotsPanel 'pfp-parrot': the selected bird (or null) after a save
    const p = e?.detail; if (!p?.id) return sync();
    const birds = (state?.parrots || []).filter(b => b.id !== p.id); state = { parrots: [p, ...birds], equipped: p.id }; sync();
  };
  const onGear = () => sync();
  import('../pirateGear.js').then(m => { if (m.getLocalGear) getGear = m.getLocalGear; sync(); }).catch(() => {});
  const point = new THREE.Vector3();
  room.userData.parrotCageTick = (t, camera) => {
    if (!bird || !bird.visible || dead || document.hidden) return;
    if (camera) {
      g.getWorldPosition(point); point.y += 1.5; point.project(camera);
      if (!(point.z >= -1 && point.z <= 1 && Math.abs(point.x) < 1.2 && Math.abs(point.y) < 1.2)) return;
    }
    perchParrot(bird, t); // sits on the perch, wings folded (never flaps in place)
  };
  const EV = { 'pfp-parrot': onSelected, 'pfp-parrot-state': onState, 'pfp-gear': onGear, 'pfp-gear-local': onGear };
  for (const k in EV) window.addEventListener(k, EV[k]);
  sync();
  try { window.dispatchEvent(new CustomEvent('pfp-parrot-cage-sync')); } catch {} // ask dock/index.js for a fresh parrot_list
  room.userData.spots.parrot_cage = { ...CAGE_SPOT };
  room.userData.colliders.push({ x: CAGE_SPOT.x, z: CAGE_SPOT.z, w: 1, d: 1 });
  // Parent hull disposal owns bird geometry/materials; we own the name tag + listeners.
  room.userData.parrotCageDispose = () => { dead = true; room.userData.parrotCageTick = null; dropTag(); bird?.traverse(o => o.skeleton?.dispose?.()); for (const k in EV) window.removeEventListener(k, EV[k]); };
  return g;
}
