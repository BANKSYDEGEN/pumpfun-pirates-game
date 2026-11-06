// [Raul weapon-sync] dress ONE weapon mesh (in hand: js/onfoot/battle.js · holstered: js/carryWeapons.js) with a pirate's synced look
// (js/onfoot/weaponLook.js): Legendary gold / ruby ornaments + the fitted 3D musket attachments + the rank tint. Idempotent: the old
// decoration is stripped first. Ornament + attachment geometry and materials are shared (swords.js _og / gunAccMesh.js), so a re-dress
// allocates a few Object3Ds and never a GPU buffer; callers only re-dress when the look's int key (look.sw / look.mu) or the id changes.
import { applyLegendaryOrnament, stripLegendaryOrnament } from './swords.js';
import { accMeshes, stripAccMeshes } from './gunAccMesh.js';
import { swordLook, muskLook } from '../musketUpgrades.js';

export function decorateSword(mesh, id, look) {
  stripLegendaryOrnament(mesh); applyLegendaryOrnament(mesh, 'sword', id, look?.sword || 'common'); return mesh;
}
export function decorateMusket(mesh, id, look) {
  stripAccMeshes(mesh); stripLegendaryOrnament(mesh);
  if (look?.accBits) accMeshes(mesh, look.acc, id);
  applyLegendaryOrnament(mesh, 'musket', id, look?.musket || 'common'); return mesh;
}
// the rank tint ({id, c, e, ei} | null) exactly as battle.js draws YOUR weapons (GILDED skin wins on the musket)
export const swordTint = (look) => swordLook(look?.sword || 'common');
export const musketTint = (look) => muskLook(look?.musket || 'common', { reload: 0, range: 0, acc: 0, skin: !!look?.gilded });
