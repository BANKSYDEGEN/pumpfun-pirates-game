// [Raul] Reusable per-skin PARTS OVERRIDE API (PvP skins). Lets a skin change the ship's SHAPE and
// materials without editing js/ships.js and without touching any other skin.
//
//   skin.materialFx?: (material) => material         per-material swap (cached by the skin)
//   skin.partsOverride?: (ship, ctx) => void         add / hide / re-material parts
//
// runPartsOverride(ship, skin, opts) is the ONE hook: call it at the end of upgradeVisuals.js buildCompiled(),
// right after the existing skinMaterialFx() traverse and BEFORE ship.scale.setScalar(s):
//     runPartsOverride(ship, skin, { quality: opts.quality, levels: lv });
// Skins with neither field return immediately, so default skins build exactly as before.
//
// Fairness: collision only reads ship.userData.len / beam / depth (+ the upgrade compiler's traitBoxes,
// shipScale, rigTop, frameK, which are computed from those and the flag pole). They are snapshotted before the
// override and restored after it, so a skin can never change its hitbox, even by accident. Overrides must only
// add children to ctx.body / ship and toggle .visible / .material; never move muzzles, flagPole or sails.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, outlineFor, outlineMat } from '../../../js/toon.js';

const HIT_KEYS = ['len', 'beam', 'depth'];
// what an override gets to work with
function makeCtx(ship, skin, opts) {
  const ud = ship.userData, body = ud.body, layout = ud.layout;
  const kids = body.children;
  // the base hull is the first merged toon mesh buildShip adds (DoubleSide), its outline is the next sibling
  const hi = kids.findIndex(o => o.isMesh && o.material?.isMeshToonMaterial && o.material.side === THREE.DoubleSide && !o.userData.outline);
  const hull = hi >= 0 ? kids[hi] : null;
  const hullOutline = hull && kids[hi + 1]?.userData.outline ? kids[hi + 1] : null;
  // mast / yard / bowsprit / rail / flag pole share one material: read it off the flag pole's own pole mesh
  const pole = layout?.flagPole?.children.find(o => o.isMesh && o.geometry?.type === 'CylinderGeometry');
  const mastMat = pole?.material || null;
  const mast = []; if (mastMat) ship.traverse(o => { if (o.isMesh && o.material === mastMat) mast.push(o); });
  return {
    THREE, mergeGeometries, toon, outlineFor, outlineMat,
    quality: opts.quality === 'low' ? 'low' : 'high', levels: opts.levels || {},
    ud, body, layout, len: ud.len, beam: ud.beam, depth: ud.depth,
    base: { hull, hullOutline, mast, mastMat, sails: ud.sails, flagPole: layout?.flagPole },
    hide(o) { if (o) o.visible = false; },                       // hidden parts cost no draw call
    add(o, parent = body) { o.traverse(c => { c.userData.skinPart = skin.id; }); parent.add(o); return o; },
  };
}
export function runPartsOverride(ship, skin, opts = {}) {
  if (!skin || (!skin.materialFx && !skin.partsOverride)) return ship;
  const ud = ship.userData, snap = HIT_KEYS.map(k => ud[k]);
  if (skin.materialFx) ship.traverse(o => { if ((o.isMesh || o.isLineSegments) && !o.userData.waterMask) o.material = skin.materialFx(o.material); });
  if (skin.partsOverride) {
    try { skin.partsOverride(ship, makeCtx(ship, skin, opts)); } catch (e) { console.warn('[skin parts] override failed, keeping base parts', skin.id, e); }
  }
  HIT_KEYS.forEach((k, i) => { if (ud[k] !== snap[i]) { console.warn('[skin parts] hitbox change blocked', skin.id, k); ud[k] = snap[i]; } });
  return ship;
}
