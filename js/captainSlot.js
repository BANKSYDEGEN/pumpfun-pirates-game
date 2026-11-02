// [Timothy v2] CAPTAIN SLOT: the player's own captain-creator pirate stands at the ship's wheel (anchor role 'captain').
// The ship never imports the creator: whoever owns it registers the builder once, then each ship gets a captain object.
//
//   import { buildCaptainMesh, getCaptain } from './captain/captainCreator.js';
//   registerCaptainBuilder(buildCaptainMesh);                 // once at boot
//   attachCaptain(ship, getCaptain());                         // local player (rebuild after every compileShip / skin swap)
//   attachCaptain(remoteShip, captainJsonFromNetwork);         // other players: pfp_captain_v1 { v, hat, hair, face, outfit, colors, parrot?, hook? }
//
// The figure is scaled to the deck crew's chibi height (CAPTAIN_H), stands on the anchor facing the bow, behind the wheel.
// The placeholder captain's body is hidden in the crew shader (uCapOff); the animated wheel stays. Future gear slots
// (parrot, hook) are passed through untouched to the builder. Visual only: nothing here touches hitboxes or stats.
import * as THREE from 'three';
import { crewU } from './crew.js';

export const CAPTAIN_H = 1.85;       // deck crew height (1.37-unit chibi x 1.35), the captain-creator figure is ~2.1 units
const SRC_H = 2.1;
let _build = null;
export function registerCaptainBuilder(fn) { _build = typeof fn === 'function' ? fn : null; }
export const captainAnchor = (ship) => ship?.userData?.anchors?.find(a => a.role === 'captain') || null;
export function detachCaptain(ship) {
  const ud = ship?.userData; if (!ud?.captainMesh) return;
  ud.captainMesh.parent?.remove(ud.captainMesh); ud.captainMesh = null;
  const U = crewUniforms(ship); if (U?.uCapOff) U.uCapOff.value = 0;
}
function crewUniforms(ship) { let U = null; ship.traverse(o => { if (!U && o.userData?.crewMesh) U = crewU(o); }); return U; }
export function attachCaptain(ship, captain, { height = CAPTAIN_H } = {}) {
  const a = captainAnchor(ship); if (!a || !_build || !captain) return null;
  detachCaptain(ship);
  let fig; try { fig = _build(captain); } catch (e) { console.warn('[captain] build failed, keeping the deck captain', e); return null; }
  if (!fig) return null;
  const k = (ship.userData.buildOpts?.boss ? 1.6 / 1.35 : 1) * height / SRC_H;
  fig.scale.setScalar(k); fig.position.copy(a.pos); fig.rotation.y = a.facing; fig.name = 'captain-figure';
  fig.userData.captain = captain;
  (a.node?.parent || ship.userData.body).add(fig); ship.userData.captainMesh = fig;
  const U = crewUniforms(ship); if (U?.uCapOff) U.uCapOff.value = 1;
  return fig;
}
// the local player's captain (set by the captain creator when it ships: setLocalCaptain(getCaptain()) + on 'pfp:captain')
let _local = null;
export function setLocalCaptain(c) { _local = c || null; }
export const localCaptain = () => _local;
