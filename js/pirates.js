// [Emerly v100] PUMPFUN PIRATES: Raul's Blender pirates v4 (js/pirateGLB.js, assets/pirates/*.glb) in the game.
// One helper for every place a v4 pirate stands: the on-foot pirate (js/onfoot/pirate.js) and YOUR captain at the wheel
// (js/captainSlot.js builder). Returns a Group right away (sync callers) and fills it when the GLB arrives; until then
// (or if it fails) the caller's fallback stays visible. Every live pirate's mixer is ticked from tickPirates(dt).
import * as THREE from 'three';
import { PirateGLB } from './pirateGLB.js';
import { gearOnReady, getLocalGear, getLocalColors, markLocal, normalizeGear } from './pirateGear.js'; // [Timothy] island-shop gear

const LIVE = new Set();
// [v102] GEAR HOOK for Timothy's gear meshes: window.applyPirateGear(pirateObj, gear) puts the equipped gear on one pirate.
//   pirateObj = the Group from pirateFigure() / loadPirate().object (its v4 PirateGLB is pirateObj.userData.v4 or a child's, once loaded)
//   gear      = { hat, outfit, eyes, parrot, hook } ids from js/shopCatalog.js ('none' / 'shirtless' / 'plain' = nothing)
// Called for your on-foot pirate (js/dock/index.js, on every change) and your captain (look.gear, when the figure loads). Default: no-op.
// [v105] Timothy's gear is in: the hook is now his applyGear (js/pirateGear.js)
// [Timothy] window.applyPirateGear is set by js/pirateGear.js itself (adds your hat colour / sides / skin + hair and your ship-skin clothes colours)
const SKIN = ['#d99b6c', '#f2c9a0', '#e0a97c', '#c68a5e', '#9a6440', '#6e4528'];
const HAIR = ['#2b1b12', '#4a2c17', '#161616', '#8a5a2b', '#c9a25a'];
export const lookColors = (look = {}) => ({ skin: SKIN[(look.skin || 0) % SKIN.length], hair: HAIR[(look.hair || 0) % HAIR.length] });

// opts: { look, low, height (m), clip, female, onReady(p), gear ({ hat, outfit, eyes, parrot, hook, hatColor }, see js/pirateGear.js), gearColors ({ skin }), local }
// [v112] bodyFromGear: this figure is a PLAYER (yours, a remote player's captain / on-foot pirate, the shop thumbs): its body
// (male / female) = gear.body, the free BODY pick, and applyGear swaps it live (js/pirateGear.js). Crew + followers keep their seat look.
export function pirateFigure({ look = {}, low = false, height = 1.75, clip = 'idle', female = !!look.female, onReady = null, gear = null, local = false, gearColors = null, bodyFromGear = local } = {}) {
  const root = new THREE.Group(); root.name = 'pirate-v4'; root.userData.v4 = null;
  if (gear) { root.userData.gear = normalizeGear(gear); root.userData.gearColors = local ? getLocalColors() : gearColors; } if (local) markLocal(root);
  root.userData.bodyFromGear = bodyFromGear;
  let ticket = 0;
  const build = (fem) => { const tk = ++ticket; root.userData.bodyF = fem;
    return PirateGLB.create({ female: fem, lod: low ? 'lo' : 'hi', colors: bodyFromGear ? null : lookColors(look) }).then((p) => { // [v121] players keep the v5 drawn skin / hair as DEFAULT (picks: setBodyLook)
      if (root.userData.disposed || tk !== ticket) { try { p.dispose?.(); } catch {} return null; }   // a newer pick won
      const box = new THREE.Box3().setFromObject(p.root), h = Math.max(0.01, box.max.y - box.min.y);
      p.root.scale.setScalar(height / h); p.root.position.y = -box.min.y * height / h;
      p.root.traverse((o) => { if (o.isMesh) { o.castShadow = !low; o.frustumCulled = false; } });
      const old = root.userData.v4; p.play(old?.clip || clip, { fade: 0 }); root.add(p.root); root.userData.v4 = p; LIVE.add(p);
      if (old) { LIVE.delete(old); old.root.removeFromParent(); try { old.dispose?.(); } catch {} }   // the old body goes once the new one is in (no blank frame)
      const dressed = gearOnReady(root, p);
      onReady?.(p);
      return Promise.resolve(dressed).then(() => p);
    }).catch((e) => { console.warn('[pirates] v4 GLB failed, keeping the fallback', e); return null; }); };
  root.userData.setBody = (fem) => (root.userData.bodyF === !!fem ? null : build(!!fem));
  build(bodyFromGear && root.userData.gear ? root.userData.gear.body === 1 : female);
  root.userData.dispose = () => { root.userData.disposed = true; if (root.userData.v4) LIVE.delete(root.userData.v4); };
  return root;
}
const inScene = (o) => { while (o.parent) o = o.parent; return !!o.isScene; };
export function tickPirates(dt) { for (const p of LIVE) { if (!inScene(p.root)) { if (!p.root.parent?.parent?.parent) LIVE.delete(p); continue; } p.update(dt); } }
// captainSlot builder: captain JSON -> a ~2.1-unit figure (captainSlot scales it to the deck crew height) on the 'steer' clip
// gear: captain.gear ({ hat, outfit, eyes, parrot, hook, hatColor }), captain.skin = their ship skin (clothes colours); captain.local = YOUR captain (re-dressed by setLocalGear, reads the local save)
// captain.remote = another player's captain (Low LOD everywhere: 2 draw calls + 1 for the gear)
export const buildCaptainV4 = (low) => (captain) => pirateFigure({ look: captain?.look || captain || {}, low: low || !!captain?.remote, height: 2.1, clip: 'steer',
  gear: captain?.local ? getLocalGear() : (captain?.gear || null), gearColors: captain?.skin ? { skin: captain.skin } : null, local: !!captain?.local, bodyFromGear: !!(captain?.local || captain?.gear) });
