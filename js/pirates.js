// [Emerly v100] PUMPFUN PIRATES: Raul's Blender pirates v4 (js/pirateGLB.js, assets/pirates/*.glb) in the game.
// One helper for every place a v4 pirate stands: the on-foot pirate (js/onfoot/pirate.js) and YOUR captain at the wheel
// (js/captainSlot.js builder). Returns a Group right away (sync callers) and fills it when the GLB arrives; until then
// (or if it fails) the caller's fallback stays visible. Every live pirate's mixer is ticked from tickPirates(dt).
import * as THREE from 'three';
import { PirateGLB } from './pirateGLB.js';

const LIVE = new Set();
// [v102] GEAR HOOK for Timothy's gear meshes: window.applyPirateGear(pirateObj, gear) puts the equipped gear on one pirate.
//   pirateObj = the Group from pirateFigure() / loadPirate().object (its v4 PirateGLB is pirateObj.userData.v4 or a child's, once loaded)
//   gear      = { hat, outfit, eyes, parrot, hook } ids from js/shopCatalog.js ('none' / 'shirtless' / 'plain' = nothing)
// Called for your on-foot pirate (js/dock/index.js, on every change) and your captain (look.gear, when the figure loads). Default: no-op.
if (typeof window !== 'undefined' && !window.applyPirateGear) window.applyPirateGear = () => false;
const SKIN = ['#d99b6c', '#f2c9a0', '#e0a97c', '#c68a5e', '#9a6440', '#6e4528'];
const HAIR = ['#2b1b12', '#4a2c17', '#161616', '#8a5a2b', '#c9a25a'];
export const lookColors = (look = {}) => ({ skin: SKIN[(look.skin || 0) % SKIN.length], hair: HAIR[(look.hair || 0) % HAIR.length] });

// opts: { look, low, height (m), clip, female, onReady(p) }
export function pirateFigure({ look = {}, low = false, height = 1.75, clip = 'idle', female = !!look.female, onReady = null } = {}) {
  const root = new THREE.Group(); root.name = 'pirate-v4'; root.userData.v4 = null;
  PirateGLB.create({ female, lod: low ? 'lo' : 'hi', colors: lookColors(look) }).then((p) => {
    if (root.userData.disposed) return;
    const box = new THREE.Box3().setFromObject(p.root), h = Math.max(0.01, box.max.y - box.min.y);
    p.root.scale.setScalar(height / h); p.root.position.y = -box.min.y * height / h;
    p.root.traverse((o) => { if (o.isMesh) { o.castShadow = !low; o.frustumCulled = false; } });
    p.play(clip, { fade: 0 }); root.add(p.root); root.userData.v4 = p; LIVE.add(p);
    try { if (look.gear) window.applyPirateGear?.(root, look.gear); } catch (e) { console.warn('[gear]', e); }
    onReady?.(p);
  }).catch((e) => console.warn('[pirates] v4 GLB failed, keeping the fallback', e));
  root.userData.dispose = () => { root.userData.disposed = true; if (root.userData.v4) LIVE.delete(root.userData.v4); };
  return root;
}
const inScene = (o) => { while (o.parent) o = o.parent; return !!o.isScene; };
export function tickPirates(dt) { for (const p of LIVE) { if (!inScene(p.root)) { if (!p.root.parent?.parent?.parent) LIVE.delete(p); continue; } p.update(dt); } }
// captainSlot builder: captain JSON -> a ~2.1-unit figure (captainSlot scales it to the deck crew height) on the 'steer' clip
export const buildCaptainV4 = (low) => (captain) => pirateFigure({ look: captain?.look || captain || {}, low, height: 2.1, clip: 'steer' });
